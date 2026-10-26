/**
 * Getting a stuck buggy out (rescue-logic.js): noticing it's stuck, and
 * the spot on the nearest highway it's put back on.
 */
import {ChillFlightLogic as L} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {
  STUCK,
  nearestRoadSpot,
  newStuckWatch,
  stepStuck,
} from '../rescue-logic.js';

console.log('Testing getting stuck buggies out...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const DT = 1 / 60;
const run = (seconds, move, trying = true) => {
  const w = newStuckWatch();
  let x = 0;
  for (let i = 0; i < seconds * 60; i++) {
    x += move * DT;
    if (stepStuck(w, DT, x, 0, trying)) return i * DT;
  }
  return null;
};
{
  const at = run(10, 0);
  check(
    'Trying to go but going nowhere is stuck after STUCK.AFTER',
    at !== null && Math.abs(at - STUCK.AFTER) < 0.1,
    `(${at})`
  );
  check('Creeping along slowly is stuck too', run(10, 4) !== null);
  check('Driving along is never stuck', run(30, 30) === null);
  check('Parked (not trying to go) is never stuck', run(30, 0, false) === null);
}

const C = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180};
L.WORLD_SEED = 20261026;
simplex.seed(20261026);
{
  // Where Jimmy got stuck: off highway 7 in the western alien land
  const x = -75445;
  const z = 43180;
  const spot = nearestRoadSpot(x, z, Math.PI, simplex, C);
  check('Finds a highway near the western alien spot', !!spot);
  if (spot) {
    const n = 7;
    const off = Math.abs(spot.x - L.roadCenter(n, spot.z));
    check('On the road', off < 1, `(${off.toFixed(1)} off)`);
    check(
      'Close by',
      Math.hypot(spot.x - x, spot.z - z) < 4000,
      `(${Math.hypot(spot.x - x, spot.z - z).toFixed(0)})`
    );
    const ground = L.getElevation(spot.x, spot.z, simplex, C, null);
    check('On the ground, not a bridge', spot.y - ground < 12);
    const turn = (a, b) =>
      Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    check(
      'Facing along the road the way it was heading (south)',
      turn(spot.heading, Math.PI) < Math.PI / 2,
      `(${spot.heading.toFixed(2)})`
    );
    const north = nearestRoadSpot(x, z, 0, simplex, C);
    check(
      '...or the other way (north)',
      turn(north.heading, 0) < Math.PI / 2 &&
        Math.abs(turn(north.heading, spot.heading) - Math.PI) < 0.01
    );
  }
  check(
    'Nothing far out to sea in the east',
    nearestRoadSpot(90000, 0, 0, simplex, C) === null
  );
}

if (failed) {
  console.error('Rescue tests failed.');
  process.exit(1);
}
console.log('All rescue tests passed.');
