#!/usr/bin/env node
/**
 * scripts/test-fall.js
 *
 * Checks fall color as you head north (fallTurnAt and fallBareAt in
 * chill-flight-logic.js): green in the south, turning gradually through the
 * middle latitudes, fully turned further north, leaves dropping toward the
 * snow line, and hills turning before valleys.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {generateChunkData} from '../terrain-gen.js';

console.log('Testing fall colors...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

simplex.seed(20260101);
const {fallTurnAt, fallBareAt, FALL_FULL_LAT, SNOW_START_LAT} =
  ChillFlightLogic;
const z = (lat) => -lat * 5000;
// Averaged across longitudes, so the wobble doesn't decide the result
const avg = (fn, lat, height = 60) => {
  let sum = 0;
  for (let x = -20000; x <= 20000; x += 1000) {
    sum += fn(x, z(lat), height, simplex);
  }
  return sum / 41;
};

check('south of the equator stays green', avg(fallTurnAt, -0.5) === 0);
check(
  'the trees are fully turned well north',
  avg(fallTurnAt, FALL_FULL_LAT + 0.2) > 0.97
);
let rising = true;
let last = -1;
for (let lat = -0.2; lat <= 1.4; lat += 0.1) {
  const v = avg(fallTurnAt, lat);
  if (v < last - 1e-9) rising = false;
  last = v;
}
check('fall only deepens heading north', rising);
const mid = avg(fallTurnAt, 0.6);
check(
  'the middle latitudes are part-way through',
  mid > 0.2 && mid < 0.9,
  `at 0.6 North: ${mid.toFixed(2)}`
);
check(
  'no bare trees until near the snow',
  avg(fallBareAt, 1.0) === 0 && avg(fallBareAt, SNOW_START_LAT + 0.2) > 0.97
);
check(
  'hills turn before the valleys below them',
  avg(fallTurnAt, 0.5, 170) > avg(fallTurnAt, 0.5, 45)
);

// The terrain generator colors real trees with it: a chunk of woods around
// 0.9 North builds, with turned trees in it
let turnedTrees = 0;
let built = true;
try {
  for (let cx = -3; cx <= 0; cx++) {
    const {result} = generateChunkData({
      chunkX: cx,
      chunkZ: -3,
      chunkSize: 1500,
      segments: 30,
      elevParams: {
        WATER_LEVEL: 40,
        MOUNTAIN_LEVEL: 180,
        MAP_WORLD_SIZE: 10000,
        MAP_HEIGHT_SCALE: 400,
      },
      worldSeed: 20260101,
      enableObjects: true,
    });
    turnedTrees += result.chunkProps.counts.trees_autumn;
  }
} catch (e) {
  built = false;
  console.log(`  ${e.message}`);
}
check(
  'woods in the north build with turned trees',
  built && turnedTrees > 0,
  `${turnedTrees} turned`
);

if (failed) {
  console.log('Fall color tests FAILED.');
  process.exit(1);
}
console.log('All fall color tests passed.');
