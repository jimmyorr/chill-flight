#!/usr/bin/env node
/**
 * scripts/test-prop-spin.js
 *
 * Tests the propeller's spin-up, coast-down and settle, run against the real
 * functions in prop-spin-logic.js:
 * 1. The engine runs while moving or with the throttle open
 * 2. Spin-up eases in rather than jumping
 * 3. With the engine off it coasts a turn or more, slowing all the way
 * 4. It swings past its rest, rocks back, and comes to a stop
 * 5. Opening the throttle mid-settle spins it back up
 */
import {
  PROP_SPIN,
  newPropSpin,
  propSpinTarget,
  stepPropSpin,
} from '../prop-spin-logic.js';

console.log('Testing propeller spin...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAILED: ${name}${detail ? ` (${detail})` : ''}`);
    failed = true;
  }
}

const FRAME = 1 / 60;
const TURN = 2 * Math.PI;

// --- 1. ENGINE ON AND OFF ---
check(
  'engine off when stopped with the throttle closed',
  propSpinTarget(0, 0) === 0
);
check('idles while rolling', propSpinTarget(0.01, 0) === 4);
check('starts with the throttle open', propSpinTarget(0, 0.5) === 4);
check('2-blade prop spins faster', propSpinTarget(1, 1, 2) === 30);
check('capped', propSpinTarget(3, 3, 2) === PROP_SPIN.MAX);

// --- 2. SPIN-UP ---
{
  const prop = newPropSpin();
  stepPropSpin(prop, 8, FRAME);
  check('spin-up eases in', prop.spin > 0 && prop.spin < 1, `${prop.spin}`);
  for (let i = 0; i < 180; i++) stepPropSpin(prop, 8, FRAME);
  check('reaches the engine speed', Math.abs(prop.spin - 8) < 0.1);
}

// --- 3 & 4. COAST-DOWN AND SETTLE (seaplane idle, biplane idle) ---
for (const idle of [4, 8]) {
  for (const start of [0, 1, 2.5]) {
    const prop = newPropSpin(start);
    for (let i = 0; i < 120; i++) stepPropSpin(prop, idle, FRAME);
    const from = prop.angle;
    let slowing = true;
    let settledAt = null;
    let stoppedAt = null;
    let peak = -Infinity;
    let last = prop.spin;
    for (let i = 0; i < 60 * 15 && stoppedAt === null; i++) {
      stepPropSpin(prop, 0, FRAME);
      if (prop.rest === null && settledAt !== null && prop.spin === 0) {
        stoppedAt = i * FRAME;
      }
      if (prop.rest !== null && settledAt === null) settledAt = i * FRAME;
      if (settledAt === null && prop.spin > last + 1e-9) slowing = false;
      last = prop.spin;
      peak = Math.max(peak, prop.angle);
    }
    const label = `idle ${idle}, from ${start}`;
    const turns = (prop.angle - from) / TURN;
    check(`${label}: coasts down without speeding up`, slowing);
    check(`${label}: coasts a turn or more`, turns > 1, turns.toFixed(2));
    check(
      `${label}: lingers before catching (over 1.5 s)`,
      settledAt > 1.5,
      `${settledAt}`
    );
    const past = ((peak - prop.angle) * 180) / Math.PI;
    check(
      `${label}: swings 8-25 degrees past rest and rocks back`,
      past > 8 && past < 25,
      past.toFixed(1)
    );
    check(`${label}: stops within 9 s`, stoppedAt !== null && stoppedAt < 9);
    const angle = prop.angle;
    stepPropSpin(prop, 0, 1);
    check(`${label}: stays put once stopped`, prop.angle === angle);
  }
}

// --- 5. RESTART MID-SETTLE ---
{
  const prop = newPropSpin();
  for (let i = 0; i < 120; i++) stepPropSpin(prop, 4, FRAME);
  while (prop.rest === null) stepPropSpin(prop, 0, FRAME);
  for (let i = 0; i < 120; i++) stepPropSpin(prop, 4, FRAME);
  check(
    'throttle up mid-settle spins it back up',
    prop.rest === null && prop.spin > 3.5
  );
}

if (failed) {
  console.error('Propeller spin tests FAILED');
  process.exit(1);
}
console.log('All propeller spin tests passed.');
