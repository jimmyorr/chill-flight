#!/usr/bin/env node
/**
 * scripts/test-fog.js
 *
 * Checks ChillFlightLogic.computeFogDensity() against the target densities
 * picked from in-game screenshots (issue #72), plus a few behaviors the
 * model should keep when its numbers are tuned.
 */

import {ChillFlightLogic} from '../chill-flight-logic.js';

const {computeFogDensity: fog, FOG} = ChillFlightLogic;

console.log('Testing fog density model...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.error(`FAIL: ${name} ${detail}`);
  }
}
const near = (a, b) => Math.abs(a - b) < 1e-7;

// Picks from the fog contact sheet (tod 0.5, 0.29, 0.6, 0.55).
const targets = [
  ['clear noon', {hour: 12}, 0.00005],
  ['clear early morning', {hour: 0.29 * 24}, 0.00011],
  ['overcast afternoon', {overcast: 0.8, hour: 0.6 * 24}, 0.00015],
  ['rain', {overcast: 1, precipIntensity: 1, hour: 0.55 * 24}, 0.0002],
];
for (const [name, conditions, want] of targets) {
  const got = fog(conditions);
  check(`${name} is ${want}`, near(got, want), `(got ${got})`);
}

check('clear nights stay clear', near(fog({hour: 2}), FOG.CLEAR));
check(
  'morning fog is thinning by 09:00',
  fog({hour: 9}) < fog({hour: 7}) && fog({hour: 9}) > FOG.CLEAR
);
check('morning fog is gone by 10:00', near(fog({hour: 10}), FOG.CLEAR));
check(
  'an overcast morning is not doubly foggy',
  near(fog({overcast: 1, hour: 6.5}), FOG.OVERCAST)
);
check(
  'rain is thicker than overcast',
  fog({overcast: 1, precipIntensity: 1}) > fog({overcast: 1})
);
check(
  'mist after rain is between clear and rain',
  fog({afterRain: 1}) > FOG.CLEAR &&
    fog({afterRain: 1}) < fog({precipIntensity: 1})
);
check(
  'debug override sets the clear-sky density',
  near(fog({clearDensity: 0.0001}), 0.0001)
);

if (failed) process.exit(1);
console.log('All fog model tests passed.');
