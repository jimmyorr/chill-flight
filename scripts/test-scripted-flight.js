#!/usr/bin/env node
/**
 * scripts/test-scripted-flight.js
 *
 * Checks the promo clips' scripted attitude (promo-script.js): keyframes hit
 * their values, ease between them, hold after the last one, and convert from
 * degrees to radians.
 */
import {attitudeAt} from '../promo-script.js';

console.log('Testing scripted flight keyframes...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}
const DEG = Math.PI / 180;
const near = (a, b) => Math.abs(a - b) < 1e-9;

const moves = [
  [0, 0, 0],
  [2, 30, 10],
  [4, 30, 0],
];
const at = (t) => attitudeAt(moves, t);

check(
  'starts at the first keyframe',
  near(at(0).roll, 0) && near(at(0).pitch, 0)
);
check('before the first keyframe holds it', near(at(-3).roll, 0));
check(
  'hits a keyframe exactly',
  near(at(2).roll, 30 * DEG) && near(at(2).pitch, 10 * DEG)
);
check(
  'eases between keyframes (halfway is halfway, slow at the ends)',
  near(at(1).roll, 15 * DEG) && at(0.25).roll < 30 * DEG * 0.25
);
check(
  'holds the last keyframe after the end',
  near(at(9).roll, 30 * DEG) && near(at(9).pitch, 0)
);
check('one keyframe holds', near(attitudeAt([[1, -5, 2]], 0).roll, -5 * DEG));

const flat = [];
for (let t = 0; t <= 4; t += 0.01) flat.push(at(t).roll);
const rising = flat.every((v, i) => i === 0 || v >= flat[i - 1] - 1e-12);
check('a bank rises monotonically between keyframes', rising);

console.log(
  failed ? 'Scripted flight test failed' : 'Scripted flight test passed'
);
process.exit(failed ? 1 : 0);
