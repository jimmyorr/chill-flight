#!/usr/bin/env node
/**
 * scripts/test-coffee.js
 *
 * Checks the coffee run's errands (coffee-logic.js): Ray offers an errand when
 * you land at the roastery with nothing on, turning it down leaves nothing on,
 * only landing at the destination moves an errand on, a full errand (farm,
 * roastery, cafe) counts one delivery, cancelling drops it, and saved runs are
 * checked before they're used.
 */
import {
  CAFES,
  FARMS,
  ROASTERY,
  accept,
  cancel,
  cargoLabel,
  decline,
  destination,
  land,
  newRun,
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
const unfilled = (dialog) => dialog?.some((line) => line.includes('{'));
const badOffers = [];
const badLoops = [];

for (let seed = 1; seed <= 50; seed++) {
  const r = rng(seed);
  let run = newRun();

  // With nothing on, only the roastery has anything to say
  let offersOk = destination(run) === null;
  for (const other of AIRPORTS.filter((a) => a !== ROASTERY)) {
    if (land(run, other, r).run !== run) offersOk = false;
  }
  const offer = land(run, ROASTERY, r);
  const errand = offer.run;
  if (
    !offer.offer ||
    !offer.dialog?.length ||
    unfilled(offer.dialog) ||
    !(errand.farm in FARMS) ||
    !(errand.buyer in CAFES) ||
    errand.buyer === errand.farm ||
    destination(errand) !== null
  ) {
    offersOk = false;
  }
  // Not right now: still nothing on, and he asks again next time
  const no = decline(errand, r);
  if (destination(no.run) !== null || !no.run.met || !no.dialog.length) {
    offersOk = false;
  }
  if (!land(no.run, ROASTERY, r).offer) offersOk = false;
  if (!offersOk) badOffers.push(seed);

  // Five errands: each taken, then landing anywhere else changes nothing, and
  // the destination moves it on
  let loopsOk = true;
  run = no.run;
  for (let loop = 0; loop < 5 && loopsOk; loop++) {
    const yes = accept(land(run, ROASTERY, r).run, r);
    run = yes.run;
    if (destination(run) !== run.farm || unfilled(yes.dialog)) loopsOk = false;
    for (let step = 0; step < 3 && loopsOk; step++) {
      const target = destination(run);
      for (const other of AIRPORTS.filter((a) => a !== target)) {
        if (land(run, other, r).run !== run) loopsOk = false;
      }
      const before = run;
      const result = land(run, target, r);
      run = result.run;
      if (unfilled(result.dialog) || result.offer) loopsOk = false;
      if (before.step === 'buy' && run.cargo !== 'green') loopsOk = false;
      if (before.step === 'roast' && run.cargo !== 'roasted') loopsOk = false;
      if (run.cargo && !cargoLabel(run)) loopsOk = false;
    }
    if (destination(run) !== null || !run.back) loopsOk = false;
  }
  if (!loopsOk || run.delivered !== 5) badLoops.push(seed);
}
check(
  'the roastery offers an errand, and not right now leaves nothing on',
  !badOffers.length,
  `seeds ${badOffers}`
);
check(
  'five errands count five deliveries, moved on only at the destination',
  !badLoops.length,
  `seeds ${badLoops}`
);

const r = rng(3);
const onErrand = accept(land(newRun(), ROASTERY, r).run, r).run;
const pickedUp = land(onErrand, onErrand.farm, r).run;
check(
  'cancelling drops the errand and its cargo',
  destination(cancel(pickedUp)) === null && cancel(pickedUp).cargo === null
);
check('a saved run comes back', validRun(pickedUp) !== null);
check('a fresh run comes back', validRun(newRun()) !== null);
check(
  'a broken save is ignored',
  validRun({delivered: 5, met: true, step: 'fly'}) === null
);
check('nothing saved is ignored', validRun(null) === null);

if (failed) {
  console.error('Coffee run tests failed.');
  process.exit(1);
}
console.log('Coffee run tests passed.');
