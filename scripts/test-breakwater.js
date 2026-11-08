#!/usr/bin/env node
/**
 * scripts/test-breakwater.js
 *
 * Checks the rock breakwaters as ground (breakwater-logic.js): a stretch's
 * crown stands above the water and its slopes run down to the sea floor
 * across it, turned the way its drawn rocks are (terrain-gen.js
 * composeMatrix), it ends along its length, and the round head rises all
 * the way round.
 */
import {BREAKWATER_STRIDE, breakwaterTopIn} from '../breakwater-logic.js';

let failed = false;
function check(ok, what) {
  console.log(`  ${ok ? 'Passed' : 'FAILED'}: ${what}`);
  if (!ok) failed = true;
}

const WL = 40;
const rot = 0.7;
const sz = 1.15;
// One stretch at (100, 200) and a head at (300, 200)
const pieces = [100, 200, WL, rot, 1, sz, 0, 300, 200, WL, 0, 1, 1, 1];
check(pieces.length === 2 * BREAKWATER_STRIDE, 'pieces are 7 numbers each');
// A point in the stretch's own frame, in the world (as composeMatrix turns it)
const c = Math.cos(rot);
const s = Math.sin(rot);
const at = (lx, lz) => [100 + c * lx + s * lz * sz, 200 - s * lx + c * lz * sz];
const top = (lx, lz) => breakwaterTopIn(pieces, ...at(lx, lz));

check(top(0, 0) > WL + 2, 'the crown stands above the water');
check(top(0, 4) > WL + 2, 'the crown runs along the stretch');
check(
  top(6, 0) < top(0, 0) && top(-6, 0) < top(0, 0),
  'it slopes down to each side'
);
check(top(9, 0) > WL - 0.5 && top(9, 0) < WL + 1, 'its flanks meet the water');
check(top(13, 0) < WL - 2, 'its toes are under water');
check(top(16, 0) === -Infinity, 'nothing past its foot');
check(top(0, 6) === -Infinity, 'it ends along its length');
// Across it the rise is gentle enough for the buggy to drive up
let steepest = 0;
for (let x = 0; x < 14; x += 0.5) {
  steepest = Math.max(steepest, Math.abs(top(x + 0.5, 0) - top(x, 0)) / 0.5);
}
check(
  steepest < 1,
  `its slopes are drivable (steepest ${steepest.toFixed(2)})`
);
let round = true;
for (let a = 0; a < Math.PI * 2; a += 0.5) {
  const h = breakwaterTopIn(
    pieces,
    300 + Math.sin(a) * 4,
    200 + Math.cos(a) * 4
  );
  if (!(h > WL + 1)) round = false;
}
check(round, 'the head rises all the way round');

if (failed) process.exit(1);
console.log('All breakwater tests passed.');
