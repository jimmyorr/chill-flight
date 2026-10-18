#!/usr/bin/env node
/**
 * scripts/test-weather.js
 *
 * Flies a plane for hours through ChillFlightLogic.weatherAt() (with the
 * same easing as weather-manager.js) and checks how often it rains or
 * snows, how long storms last, and that they build up and clear gradually.
 * Pass --report to print the numbers.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';

const SEED = 20261018;
ChillFlightLogic.WORLD_SEED = SEED;
const {simplex} = await import('../noise.js');
simplex.seed(SEED);

const {weatherAt, WEATHER} = ChillFlightLogic;
const report = process.argv.includes('--report');

console.log('Testing weather...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.error(`FAIL: ${name} ${detail}`);
  }
}

// Same easing as weather-manager.js (RAIN_EASE_SECONDS, SNOW_EASE_SECONDS)
const EASE = {rain: 6, snow: 8};
const FULL = {rain: WEATHER.RAIN_FULL, snow: WEATHER.SNOW_STORM};

// Flies at `kts` (a unit per second) near latitude `lat`, wandering in
// heading every few minutes, and times the episodes of `kind` above
// `threshold` (a fraction of FULL).
function fly({lat, kts, hours, kind, threshold = 0.1}) {
  const rand = ChillFlightLogic.mulberry32(7);
  const dt = 0.5;
  let x = -5000;
  let z = -lat * 5000;
  let heading = 0.7;
  let clock = Date.UTC(2026, 9, 18, 8);
  let level = 0;
  let maxStep = 0;
  let episodeStart = null;
  const episodes = [];
  let wet = 0;
  const steps = (hours * 3600) / dt;
  for (let i = 0; i < steps; i++) {
    clock += dt * 1000;
    if (i % (240 / dt) === 0) heading += (rand() - 0.5) * 1.5;
    x += Math.sin(heading) * kts * dt;
    z += Math.cos(heading) * kts * dt;
    // Stay within half a degree of the latitude
    if (Math.abs(-z / 5000 - lat) > 0.5) {
      heading = Math.PI - heading;
      z = Math.max(-(lat + 0.5) * 5000, Math.min(-(lat - 0.5) * 5000, z));
    }
    const target = weatherAt(x, z, clock, simplex)[kind];
    const next = level + (target - level) * (1 - Math.exp(-dt / EASE[kind]));
    maxStep = Math.max(maxStep, Math.abs(next - level) / FULL[kind] / dt);
    level = next;
    const on = level / FULL[kind] > threshold;
    if (on) wet += dt;
    if (on && episodeStart === null) episodeStart = i * dt;
    if (!on && episodeStart !== null) {
      episodes.push(i * dt - episodeStart);
      episodeStart = null;
    }
  }
  episodes.sort((a, b) => a - b);
  return {
    perHour: episodes.length / hours,
    share: wet / (hours * 3600),
    median: episodes[episodes.length >> 1] || 0,
    p90: episodes[Math.floor(episodes.length * 0.9)] || 0,
    maxStep,
  };
}

function show(label, r) {
  if (!report) return;
  console.log(
    `    ${label}: ${r.perHour.toFixed(1)}/h, ${(r.share * 100).toFixed(1)}% of ` +
      `the time, median ${r.median.toFixed(0)} s, 90% under ` +
      `${r.p90.toFixed(0)} s, fastest change ` +
      `${(r.maxStep * 100).toFixed(1)}%/s`
  );
}

const cruise = fly({lat: 0, kts: 150, hours: 40, kind: 'rain'});
show('rain at 150 kts', cruise);
check(
  'it rains now and then at cruise (2 to 6 storms an hour)',
  cruise.perHour >= 2 && cruise.perHour <= 6,
  `(${cruise.perHour.toFixed(1)}/h)`
);
check(
  'it rains 4% to 12% of the time',
  cruise.share >= 0.04 && cruise.share <= 0.12,
  `(${(cruise.share * 100).toFixed(1)}%)`
);
check(
  'a storm lasts 40 seconds or more at cruise',
  cruise.median >= 40,
  `(median ${cruise.median.toFixed(0)} s)`
);
check(
  'nine storms in ten are over within 2.5 minutes at cruise',
  cruise.p90 <= 150,
  `(${cruise.p90.toFixed(0)} s)`
);
check(
  'rain builds and clears gradually (under 10% of full a second)',
  cruise.maxStep < 0.1,
  `(${(cruise.maxStep * 100).toFixed(1)}%/s)`
);

const fast = fly({lat: 0, kts: 300, hours: 40, kind: 'rain'});
show('rain at 300 kts', fast);
check(
  'a storm still lasts 25 seconds at 300 kts',
  fast.median >= 25,
  `(median ${fast.median.toFixed(0)} s)`
);

const parked = fly({lat: 0, kts: 0, hours: 40, kind: 'rain'});
show('rain parked', parked);
check(
  'a storm passes over a parked plane in under 4 minutes',
  parked.median > 0 && parked.median < 240,
  `(median ${parked.median.toFixed(0)} s)`
);

const desert = fly({lat: -4.5, kts: 150, hours: 20, kind: 'rain'});
check('it never rains deep in the desert', desert.share === 0);

const north = fly({lat: 3, kts: 150, hours: 40, kind: 'snow', threshold: 0.2});
show('snow at 150 kts', north);
check(
  'it snows often in the snow country (30% to 75% of the time)',
  north.share >= 0.3 && north.share <= 0.75,
  `(${(north.share * 100).toFixed(1)}%)`
);
check(
  'snow comes and goes gradually (under 10% of a storm a second)',
  north.maxStep < 0.1,
  `(${(north.maxStep * 100).toFixed(1)}%/s)`
);
const northRain = fly({lat: 4, kts: 150, hours: 10, kind: 'rain'});
check('it never rains in the snow country', northRain.share === 0);

// Snow only falls from cloud, and gets heavier farther north
let snowFromClearSky = 0;
let edge = 0;
let deep = 0;
for (let i = 0; i < 4000; i++) {
  const x = (i % 200) * 3000 - 300000;
  const clock = Date.UTC(2026, 9, 18) + Math.floor(i / 200) * 600000;
  const w = weatherAt(x, -2.6 * 5000, clock, simplex);
  if (w.snow > 0.05 && w.cloud < 0.5) snowFromClearSky++;
  edge += weatherAt(x, -1.8 * 5000, clock, simplex).snow;
  deep += weatherAt(x, -4.5 * 5000, clock, simplex).snow;
}
check(
  'snow never falls from a clear sky',
  snowFromClearSky === 0,
  `(${snowFromClearSky} samples)`
);
check('snow gets heavier farther north', deep > edge * 1.3);

process.exit(failed ? 1 : 0);
