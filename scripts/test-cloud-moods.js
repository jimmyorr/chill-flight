#!/usr/bin/env node
/**
 * scripts/test-cloud-moods.js
 *
 * Checks the day's cloud mood (cloudMoodForDay in chill-flight-logic.js): the
 * same seed and day always give the same sky, every mood comes up, the
 * amounts stay in range, and cloudMood= forces a mood.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';

console.log('Testing cloud moods...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const {cloudMoodForDay, CLOUD_MOOD_NAMES} = ChillFlightLogic;
const SEED = 20260101;

const a = cloudMoodForDay(SEED, 1234);
const b = cloudMoodForDay(SEED, 1234);
check(
  'a seed and day always give the same mood',
  JSON.stringify(a) === JSON.stringify(b)
);

const days = Array.from({length: 500}, (_, i) => cloudMoodForDay(SEED, i));
const seen = new Set(days.map((m) => m.name));
check(
  'every mood comes up',
  CLOUD_MOOD_NAMES.every((n) => seen.has(n)),
  [...seen].join(',')
);

const inUnit = (v) => v >= 0 && v <= 1;
check(
  'cloud amounts stay between 0 and 1',
  days.every((m) => inUnit(m.cumulus) && inUnit(m.cirrus) && inUnit(m.mackerel))
);

const boosted = days.filter((m) => m.duskBoost > 0).length / days.length;
check(
  'about 60% of days build up cloud at dusk',
  boosted > 0.5 && boosted < 0.7,
  boosted.toFixed(2)
);

let changes = 0;
for (let i = 1; i < days.length; i++) {
  if (days[i].name !== days[i - 1].name) changes++;
}
check(
  'consecutive days vary',
  changes > days.length * 0.5,
  `${changes} changes`
);

check(
  'extra cover stays small, so the weather still leads',
  days.every((m) => Math.abs(m.cover) <= 0.15)
);

check(
  'cloudMood= forces the mood',
  CLOUD_MOOD_NAMES.every((n) => cloudMoodForDay(SEED, 7, n).name === n)
);

if (failed) process.exit(1);
console.log('All cloud mood tests passed.');
