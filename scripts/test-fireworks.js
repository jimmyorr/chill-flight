#!/usr/bin/env node
/**
 * scripts/test-fireworks.js
 *
 * Deterministic unit tests for Chill Flight's night fireworks system
 * (fireworks-logic.js): holiday date detection, URL overrides, clear-night
 * weather gating, forward-cone town/pier site scoring, exact drag+gravity
 * mortar ballistics, show choreography & finale timing, and achievement zone.
 */
import {
  COMET_DRAG,
  COMET_GRAVITY,
  FIREWORK_MODES,
  SHELL_TYPES,
  canRunFireworks,
  emitBurstSparks,
  emitLaunchSparks,
  isFireworksHoliday,
  isInsideFireworkShow,
  nextFireworksWait,
  pickFireworkSite,
  planFireworkShow,
  resolveFireworksMode,
  solveLaunchVelocity,
} from '../fireworks-logic.js';

console.log('Testing night fireworks logic, ballistics, and choreography...');

let failed = false;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    failed = true;
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    'resolveFireworksMode honors ?fireworks=0/1 and ?traffic=0',
    resolveFireworksMode(20261121, null, null) === FIREWORK_MODES.RARE &&
      resolveFireworksMode(20260704, null, null) === FIREWORK_MODES.HOLIDAY &&
      resolveFireworksMode(20261121, true, false) === FIREWORK_MODES.FORCED &&
      resolveFireworksMode(20260704, false, null) === FIREWORK_MODES.OFF &&
      resolveFireworksMode(20260704, null, false) === FIREWORK_MODES.OFF
  );

  const rng = mulberry32(99);
  const waitForced = nextFireworksWait(FIREWORK_MODES.FORCED, true, rng);
  const waitHoliday = nextFireworksWait(FIREWORK_MODES.HOLIDAY, false, rng);
  const waitRare = nextFireworksWait(FIREWORK_MODES.RARE, false, rng);
  check(
    'Wait intervals scale from short forced/holiday waits to rare 2.5-4.3 min waits',
    waitForced < 4 && waitHoliday < 70 && waitRare >= 145
  );
}

// 2. Night & weather gating
{
  check(
    'Fireworks run only at night under clear skies (unless forced)',
    !canRunFireworks({mode: FIREWORK_MODES.RARE, sunY: 0.25, rain: 0}) &&
      canRunFireworks({mode: FIREWORK_MODES.RARE, sunY: -0.35, rain: 0}) &&
      !canRunFireworks({mode: FIREWORK_MODES.RARE, sunY: -0.4, rain: 0.25}) &&
      !canRunFireworks({mode: FIREWORK_MODES.HOLIDAY, sunY: -0.4, snow: 0.3}) &&
      canRunFireworks({mode: FIREWORK_MODES.FORCED, sunY: -0.2, rain: 0.3}) &&
      !canRunFireworks({mode: FIREWORK_MODES.OFF, sunY: -0.5, rain: 0})
  );
}

// 3. Town, village, and coastal pier site selection
{
  const sites = [
    {x: 0, y: 45, z: 1200, kind: 'town'}, // behind tail (heading North = -Z)
    {x: 120, y: 41, z: -1350, kind: 'pier'}, // directly ahead in view!
    {x: 6500, y: 50, z: -6500, kind: 'town'}, // too far (>4000 u)
    {x: 20, y: 45, z: -80, kind: 'village'}, // too close (<260 u)
  ];
  const viewer = {x: 0, z: 0, fx: 0, fz: -1};
  const chosen = pickFireworkSite(sites, viewer, mulberry32(7));
  check(
    'pickFireworkSite selects forward-hemisphere pier/town in viewing range over behind/far/underfoot sites',
    chosen !== null && chosen.kind === 'pier' && chosen.z === -1350
  );
}

// 4. Exact drag + gravity mortar launch ballistics
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

// 5. Show choreography, all 5 shell types, spark emission & Grand finale zone
{
  const rng = mulberry32(20261231);
  const site = {x: -1500, y: 55, z: 2400, kind: 'town'};
  const show = planFireworkShow(site, FIREWORK_MODES.HOLIDAY, rng);

  const FinaleShells = show.shells.filter(
    (s) => s.launchAt >= show.finaleStart - 1e-3
  );
  check(
    'Planned show schedules sorted shells culminating in >= 8 grand finale shells',
    show.shells.length >= 16 &&
      FinaleShells.length >= 8 &&
      show.shells.every(
        (s, i) => i === 0 || s.launchAt >= show.shells[i - 1].launchAt
      ),
    `total=${show.shells.length}, finale=${FinaleShells.length}`
  );

  // Verify every shell archetype emits finite sparks with zero NaNs
  let totalSparks = 0;
  let allFinite = true;
  for (const type of SHELL_TYPES) {
    const sampleShell = {...show.shells[0], type};
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
    !isInsideFireworkShow(show, 0.2, site.x, site.y + 300, site.z) &&
      isInsideFireworkShow(
        show,
        show.firstBurstAt + 2.0,
        site.x + 120,
        site.y + 290,
        site.z - 80
      ) &&
      !isInsideFireworkShow(
        show,
        show.firstBurstAt + 2.0,
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
