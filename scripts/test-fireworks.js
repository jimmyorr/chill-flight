#!/usr/bin/env node
/**
 * scripts/test-fireworks.js
 *
 * Deterministic unit tests for Chill Flight's world-scheduled night fireworks
 * system (fireworks-logic.js): holiday date detection, URL overrides, noon-
 * anchored unbroken night clock, curated 8-venue world roster, fair shuffle-bag
 * nightly rotation (zero back-to-back repeats), multiplayer-identical show
 * plans, exact drag+gravity ballistics, and achievement canopy checks.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {
  COMET_DRAG,
  COMET_GRAVITY,
  DAY_CYCLE_MS,
  FIREWORK_MODES,
  SHELL_TYPES,
  buildFireworkVenues,
  canRunFireworks,
  emitBurstSparks,
  emitLaunchSparks,
  isFireworksHoliday,
  isInsideFireworkShow,
  mulberry32,
  nightClockState,
  planFireworkShow,
  resolveFireworksMode,
  scheduledVenuesForNight,
  solveLaunchVelocity,
} from '../fireworks-logic.js';

console.log(
  'Testing world-scheduled night fireworks venues, rotation, and ballistics...'
);

let failed = false;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    failed = true;
  }
}

// 1. Holiday seed detection & URL parameter mode resolution
{
  check(
    'Dec 31, Jan 1, and Jul 4 seeds trigger holiday fireworks mode',
    isFireworksHoliday(20261231) &&
      isFireworksHoliday(20270101) &&
      isFireworksHoliday(20260704) &&
      !isFireworksHoliday(20261121) &&
      !isFireworksHoliday(42)
  );
  check(
    'resolveFireworksMode defaults to SCHEDULED and honors ?fireworks=0/1 and ?traffic=0',
    resolveFireworksMode(20261121, null, null) === FIREWORK_MODES.SCHEDULED &&
      resolveFireworksMode(20260704, null, null) === FIREWORK_MODES.HOLIDAY &&
      resolveFireworksMode(20261121, true, false) === FIREWORK_MODES.FORCED &&
      resolveFireworksMode(20260704, false, null) === FIREWORK_MODES.OFF &&
      resolveFireworksMode(20260704, null, false) === FIREWORK_MODES.OFF
  );
}

// 2. Noon-anchored nightClockState continuity across midnight
{
  const midnight = 10 * DAY_CYCLE_MS;
  const evening = midnight - 35000; // 35 s before midnight
  const afterMidnight = midnight + 25000; // 25 s after midnight
  const nextNoon = midnight + 185000; // past noon next day

  const sEve = nightClockState(evening);
  const sMid = nightClockState(midnight);
  const sLate = nightClockState(afterMidnight);
  const sNext = nightClockState(nextNoon);

  check(
    'nightClockState keeps one unbroken nightIndex across midnight and flips at noon',
    sEve.nightIndex === sMid.nightIndex &&
      sMid.nightIndex === sLate.nightIndex &&
      sNext.nightIndex === sMid.nightIndex + 1 &&
      sEve.inWindow &&
      sMid.inWindow &&
      sLate.inWindow &&
      !sNext.inWindow,
    `eve=${sEve.nightIndex}, mid=${sMid.nightIndex}, late=${sLate.nightIndex}, next=${sNext.nightIndex}`
  );
}

// 3. Night & weather gating
{
  check(
    'Fireworks run only at night outside heavy storms (unless forced)',
    !canRunFireworks({mode: FIREWORK_MODES.SCHEDULED, sunY: 0.25, rain: 0}) &&
      canRunFireworks({mode: FIREWORK_MODES.SCHEDULED, sunY: -0.35, rain: 0}) &&
      !canRunFireworks({
        mode: FIREWORK_MODES.SCHEDULED,
        sunY: -0.4,
        rain: 0.25,
      }) &&
      canRunFireworks({mode: FIREWORK_MODES.FORCED, sunY: -0.2, rain: 0.3}) &&
      !canRunFireworks({mode: FIREWORK_MODES.OFF, sunY: -0.5, rain: 0})
  );
}

// 4. Deterministic 8-venue world roster, runway clearance & fair nightly shuffle-bag
{
  const venues = buildFireworkVenues(20261121, {
    waterLevel: 40,
    getElev: () => 55,
    highwayCrossing: (n) => ({x: -3200 - n * 10000, z: 1800}),
    fallsX: 0,
    fallsLipZ: -2750,
  });

  // Ensure every venue stays >= 450 units clear of every airport center
  const clearOfRunways = venues.every((v) =>
    ChillFlightLogic.AIRPORTS.every(
      (ap) => Math.hypot(v.x - ap.x, v.z - ap.z) >= 450
    )
  );
  check(
    `buildFireworkVenues creates ${venues.length} deterministic regional venues clear of airport runways`,
    venues.length === 8 && clearOfRunways
  );

  // Check 32 consecutive nights aligned to 4 full 8-night epochs (96..127)
  const counts = {};
  let prevId = null;
  let allSingle = true;
  let anyBackToBack = false;
  for (let night = 96; night < 128; night++) {
    const tonight = scheduledVenuesForNight(
      venues,
      20261121,
      night,
      FIREWORK_MODES.SCHEDULED
    );
    if (tonight.length !== 1) allSingle = false;
    const id = tonight[0].venue.id;
    counts[id] = (counts[id] || 0) + 1;
    if (id === prevId) anyBackToBack = true;
    prevId = id;
  }
  const everyVenueFourTimes = venues.every((v) => counts[v.id] === 4);
  check(
    'Nightly shuffle-bag guarantees 1 show every night, visits every venue equally, and never repeats back-to-back',
    allSingle && everyVenueFourTimes && !anyBackToBack,
    `counts=${JSON.stringify(counts)}, backToBack=${anyBackToBack}`
  );

  const holidayTonight = scheduledVenuesForNight(
    venues,
    20261231,
    100,
    FIREWORK_MODES.HOLIDAY
  );
  check(
    'Holiday nights light up all 8 world venues simultaneously',
    holidayTonight.length === venues.length
  );
}

// 5. Exact drag + gravity mortar launch ballistics
{
  const pad = {x: 100, y: 42, z: -200};
  const target = {x: 135, y: 365, z: -165};
  const dur = 1.42;
  const v0 = solveLaunchVelocity(pad, target, dur, COMET_DRAG, COMET_GRAVITY);
  const c = (1 - Math.exp(-COMET_DRAG * dur)) / COMET_DRAG;
  const endX = pad.x + v0.vx * c;
  const endY = pad.y + v0.vy * c - 0.5 * COMET_GRAVITY * dur * dur;
  const endZ = pad.z + v0.vz * c;
  const err = Math.hypot(endX - target.x, endY - target.y, endZ - target.z);
  check(
    'solveLaunchVelocity hits burst apex with < 1e-6 ballistic error under drag and gravity',
    err < 1e-6,
    `err=${err}`
  );
}

// 6. Multiplayer-deterministic show plan, all 5 shell types, & Grand finale zone
{
  const site = {
    id: 'town_0',
    idHash: 0x11223344,
    name: 'Crossroads town',
    x: -3201,
    y: 55,
    z: 2071,
    kind: 'town',
  };
  const showA = planFireworkShow(site, FIREWORK_MODES.SCHEDULED, 20261121, 42);
  const showB = planFireworkShow(site, FIREWORK_MODES.SCHEDULED, 20261121, 42);

  const finaleShells = showA.shells.filter(
    (s) => s.launchAt >= showA.finaleStart - 1e-3
  );
  check(
    'planFireworkShow is 100% deterministic per (seed, nightIndex, venue) for multiplayer sync',
    JSON.stringify(showA) === JSON.stringify(showB) &&
      showA.shells.length >= 28 &&
      finaleShells.length >= 10
  );

  const rng = mulberry32(77);
  let totalSparks = 0;
  let allFinite = true;
  for (const type of SHELL_TYPES) {
    const sampleShell = {...showA.shells[0], type};
    emitLaunchSparks(sampleShell, 10, rng, (...args) => {
      totalSparks++;
      if (!args.every(Number.isFinite)) allFinite = false;
    });
    emitBurstSparks(sampleShell, 11.4, rng, (...args) => {
      totalSparks++;
      if (!args.every(Number.isFinite)) allFinite = false;
    });
  }
  check(
    `All ${SHELL_TYPES.length} shell archetypes emit finite launch & burst sparks (${totalSparks} sparks)`,
    allFinite && totalSparks > 650
  );

  check(
    'isInsideFireworkShow triggers Grand finale only inside the active burst canopy',
    !isInsideFireworkShow(showA, 0.2, site.x, site.y + 300, site.z) &&
      isInsideFireworkShow(
        showA,
        showA.firstBurstAt + 2.0,
        site.x + 120,
        site.y + 290,
        site.z - 80
      ) &&
      !isInsideFireworkShow(
        showA,
        showA.firstBurstAt + 2.0,
        site.x + 900,
        site.y + 290,
        site.z
      )
  );
}

if (failed) {
  console.error('\nFireworks tests failed!');
  process.exit(1);
}
console.log('\nAll fireworks tests passed!');
