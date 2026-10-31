#!/usr/bin/env node
/**
 * scripts/test-flight-speed.js
 *
 * Checks how climbs and dives move the planes' speed (pitchedTarget and
 * throttleSpeed in flight-physics-logic.js): a dive speeds the plane up and a
 * climb slows it, by the same amount at any frame rate, a climb never slows
 * it toward a stall, and it settles back to the throttle once level.
 */
import {PLANE_HANDLING, BASE_FLIGHT_SPEED} from '../constants.js';
import {pitchedTarget, throttleSpeed} from '../flight-physics-logic.js';

console.log('Testing climb and dive speeds...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const K = BASE_FLIGHT_SPEED * 60;
const deg = (d) => (d * Math.PI) / 180;

// Knots after `seconds` at `pitchDeg` from `startKts`, throttle at `throttleKts`
function fly(type, startKts, throttleKts, pitchDeg, seconds, fps) {
  const h = PLANE_HANDLING[type];
  let speed = startKts / K;
  const dt = 1 / fps;
  for (let i = 0; i < seconds * fps; i++) {
    const target = pitchedTarget(throttleKts / K, deg(pitchDeg), h, 0, false);
    speed = throttleSpeed(speed, target, h, dt);
  }
  return speed * K;
}

for (const type of ['biplane', 'seaplane', 'twin', 'jet']) {
  const top = PLANE_HANDLING[type].topKts;
  const at = (fps) => fly(type, top, top, -45, 6, fps);
  const gains = [30, 60, 120].map(at);
  check(
    `${type}: a 45° dive speeds it up the same at 30, 60 and 120 fps`,
    gains[0] > top + 40 && Math.max(...gains) - Math.min(...gains) < 2,
    gains.map((g) => g.toFixed(1)).join(', ')
  );
  const steep = fly(type, top, top, -90, 20, 60);
  check(
    `${type}: even straight down it tops out under 1.5x top speed`,
    steep < top * 1.5,
    steep.toFixed(0)
  );
  const climb = fly(type, top, top, 35, 10, 60);
  check(`${type}: a 35° climb slows it`, climb < top - 20, climb.toFixed(0));
  const h = PLANE_HANDLING[type];
  const steepClimb = fly(type, h.levelKts + 30, h.levelKts + 30, 75, 20, 60);
  check(
    `${type}: a steep slow climb keeps it above its level speed`,
    steepClimb >= h.levelKts + 19,
    steepClimb.toFixed(0)
  );
  const slow = fly(type, h.levelKts, h.levelKts, 35, 10, 60);
  check(
    `${type}: climbing below the floor doesn't slow it further`,
    Math.abs(slow - h.levelKts) < 1,
    slow.toFixed(1)
  );
  // Level again after a dive: back to the throttle
  const back = (() => {
    let speed = fly(type, top, top, -45, 6, 60) / K;
    for (let i = 0; i < 60 * 30; i++) {
      speed = throttleSpeed(speed, top / K, h, 1 / 60);
    }
    return speed * K;
  })();
  check(
    `${type}: levelling out settles back to the throttle`,
    Math.abs(back - top) < 0.5,
    back.toFixed(1)
  );
}

// Gliding at idle: a dive still carries the plane along
const glide = fly('seaplane', 100, 0, -30, 10, 60);
check('a dive at idle throttle glides', glide > 40, glide.toFixed(0));

// Falling (fallAmount 1): a tumbling nose wins back no speed
const h = PLANE_HANDLING.seaplane;
check(
  'falling, a nose-down tumble gains nothing',
  pitchedTarget(0.2, deg(-60), h, 1, false) === 0.2
);

if (failed) {
  console.log('Climb and dive speed tests FAILED.');
  process.exit(1);
}
console.log('All climb and dive speed tests passed.');
