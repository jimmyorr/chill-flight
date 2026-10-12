#!/usr/bin/env node
/**
 * scripts/test-coffee.js
 *
 * Checks the coffee run's errands (coffee-logic.js): a run starts with an
 * errand, only landing at the destination moves it on, a full loop (farm,
 * roastery, cafe, roastery) counts one delivery, and saved runs are checked
 * before they're used.
 */
import {
  CAFES,
  FARMS,
  ROASTERY,
  cargoLabel,
  destination,
  land,
  startRun,
  validRun,
} from '../coffee-logic.js';

console.log('Testing the coffee run...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
    failed = true;
  }
}

// A seeded random, so failures repeat
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const AIRPORTS = [ROASTERY, ...Object.keys(CAFES)];
const badStarts = [];
const badLoops = [];

for (let seed = 1; seed <= 50; seed++) {
  const r = rng(seed);
  const start = startRun(r);
  let run = start.run;
  const ok =
    run.delivered === 0 &&
    run.step === 'buy' &&
    run.farm in FARMS &&
    run.buyer in CAFES &&
    run.buyer !== run.farm &&
    start.dialog.length > 0 &&
    start.dialog.every((line) => !line.includes('{'));
  if (!ok) {
    badStarts.push(seed);
    continue;
  }

  // Five loops: landing anywhere else changes nothing, and the destination
  // moves the run on
  let loopsOk = true;
  for (let loop = 0; loop < 5 && loopsOk; loop++) {
    for (let step = 0; step < 4 && loopsOk; step++) {
      const target = destination(run);
      for (const other of AIRPORTS.filter((a) => a !== target)) {
        if (land(run, other, r).run !== run) loopsOk = false;
      }
      const before = run;
      const result = land(run, target, r);
      run = result.run;
      if (result.dialog?.some((line) => line.includes('{'))) loopsOk = false;
      if (before.step === 'buy' && run.cargo !== 'green') loopsOk = false;
      if (before.step === 'roast' && run.cargo !== 'roasted') loopsOk = false;
      if (before.step === 'sell' && run.delivered !== before.delivered + 1) {
        loopsOk = false;
      }
      if (before.step === 'return' && run.step !== 'buy') loopsOk = false;
      if (run.cargo && !cargoLabel(run)) loopsOk = false;
    }
  }
  if (!loopsOk || run.delivered !== 5) {
    badLoops.push(seed);
  }
}
check('a new run has an errand', !badStarts.length, `seeds ${badStarts}`);
check(
  'five loops count five deliveries, moved on only at the destination',
  !badLoops.length,
  `seeds ${badLoops}`
);

check('a saved run comes back', validRun(startRun(rng(7)).run) !== null);
check(
  'a broken save is ignored',
  validRun({delivered: 5, step: 'fly'}) === null
);
check('nothing saved is ignored', validRun(null) === null);

if (failed) {
  console.error('Coffee run tests failed.');
  process.exit(1);
}
console.log('Coffee run tests passed.');
