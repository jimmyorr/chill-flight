#!/usr/bin/env node
/**
 * scripts/test-season.js
 *
 * Checks the Christmas season (seasonOf and resolveSeason in
 * chill-flight-logic.js; specs/christmas-village.md): read from the world
 * seed's date, Nov 1 to Jan 6, 'setup' in November and 'full' from December
 * to Twelfth Night, overridable with ?xmas= and ?xmasDay=, and off in Node
 * unless asked for, so tests pinned to 20260101 keep their world. Also that
 * generateChunkData hands a chunk job's season to a worker's logic module.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {generateChunkData} from '../terrain-gen.js';

console.log('Testing the Christmas season...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const {seasonOf, resolveSeason} = ChillFlightLogic;
const same = (a, b) => a.xmas === b.xmas && a.day === b.day;
const show = (s) => JSON.stringify(s);

// 1. From the date
const dates = [
  [20261031, null, 0],
  [20261101, 'setup', 1],
  [20261130, 'setup', 30],
  [20261201, 'full', 1],
  [20261224, 'full', 24],
  [20261231, 'full', 31],
  [20270101, 'full', 31],
  [20270106, 'full', 31],
  [20270107, null, 0],
  [20260701, null, 0],
];
for (const [seed, xmas, day] of dates) {
  const s = seasonOf(seed);
  check(
    `${seed} is ${xmas || 'off'}${xmas ? ` (day ${day})` : ''}`,
    same(s, {xmas, day}),
    show(s)
  );
}

// 2. Seeds that aren't dates have no season
for (const seed of [1, 42, 12345, 20261300, 20261200, 20261232, -20261215]) {
  check(`seed ${seed} has no season`, seasonOf(seed).xmas === null);
}

// 3. Off in Node unless asked for: this process never read a URL
check(
  'the season is off in Node by default',
  ChillFlightLogic.XMAS === null && ChillFlightLogic.XMAS_DAY === 0,
  `${ChillFlightLogic.XMAS} ${ChillFlightLogic.XMAS_DAY}`
);
check(
  'without byDate, the date alone turns nothing on',
  resolveSeason(20261215, null, null, false).xmas === null
);
check(
  'with byDate (the browser), the date turns it on',
  same(resolveSeason(20261215, null, null, true), {xmas: 'full', day: 15})
);

// 4. ?xmas= and ?xmasDay= overrides
const overrides = [
  // seed, xmas, xmasDay, byDate, expected
  [20261215, 'off', null, true, {xmas: null, day: 0}],
  [20261215, '0', null, true, {xmas: null, day: 0}],
  [20260701, 'full', null, true, {xmas: 'full', day: 1}],
  [20260701, 'setup', null, false, {xmas: 'setup', day: 1}],
  [20261215, 'full', null, true, {xmas: 'full', day: 15}],
  [20261215, 'setup', null, true, {xmas: 'setup', day: 1}],
  [20261215, 'on', null, true, {xmas: 'full', day: 15}],
  [20260701, 'on', null, true, {xmas: 'full', day: 1}],
  [20260701, 'FULL ', null, true, {xmas: 'full', day: 1}],
  [20260701, 'full', '20', true, {xmas: 'full', day: 20}],
  [20261215, null, '3', true, {xmas: 'full', day: 3}],
  [20261215, null, '40', true, {xmas: 'full', day: 15}],
  [20260701, null, '3', true, {xmas: null, day: 0}],
  [20261215, '', null, true, {xmas: 'full', day: 15}],
];
for (const [seed, xmas, day, byDate, want] of overrides) {
  const got = resolveSeason(seed, xmas, day, byDate);
  check(
    `seed ${seed}, xmas=${xmas}, xmasDay=${day}${byDate ? '' : ' (Node)'} gives ${show(want)}`,
    same(got, want),
    show(got)
  );
}

// 5. A chunk job carries the main thread's season into a worker's module
// (terrain-gen.js generateChunkData), and an off season clears it again.
// Objects off: only the season handoff matters here.
const job = (xmas, xmasDay) =>
  generateChunkData({
    chunkX: 0,
    chunkZ: 0,
    chunkSize: 1500,
    segments: 4,
    elevParams: {
      WATER_LEVEL: 40,
      MOUNTAIN_LEVEL: 180,
      MAP_WORLD_SIZE: 10000,
      MAP_HEIGHT_SCALE: 400,
    },
    worldSeed: 20260101,
    xmas,
    xmasDay,
    enableObjects: false,
  });
job('full', 12);
check(
  'a chunk job turns the season on in its module',
  ChillFlightLogic.XMAS === 'full' && ChillFlightLogic.XMAS_DAY === 12
);
job(null, 0);
check(
  'a chunk job with the season off turns it off',
  ChillFlightLogic.XMAS === null && ChillFlightLogic.XMAS_DAY === 0
);

if (failed) {
  console.error('Season tests failed.');
  process.exit(1);
}
console.log('All season tests passed.');
