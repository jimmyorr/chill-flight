#!/usr/bin/env node
/**
 * scripts/test-flight-speed.js
 *
 * Checks how climbs and dives move the planes' speed (pitchedTarget and
 * throttleSpeed in flight-physics-logic.js): a dive speeds the plane up and a
 * climb slows it, by the same amount at any frame rate, a climb never slows
 * it toward a stall, and it settles back to the throttle once level. Also
 * the thin air at the top of the sky (CEILING), and a barrel roll easing to
 * level when let go (stepRollExit).
 */
import {
  PLANE_HANDLING,
  BASE_FLIGHT_SPEED,
  MACH_1_KTS,
  UNITS_TO_M,
  displaySpeed,
  speedUnit,
} from '../constants.js';
import {
  CEILING,
  ceilingClimbLimit,
  ABOVE_CLOUDS_ROOM,
  flightCeiling,
  underCloudsCeiling,
  pitchedTarget,
  rollExitHandOver,
  rollExitTurns,
  sagClimbCap,
  stepRollExit,
  joystickResponse,
  thinAirAt,
  throttleSpeed,
} from '../flight-physics-logic.js';

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

// HUD speed readout mapping (KTS for planes, KM/H for buggy) and 1 unit = 1 m
check('world units to meters is 1:1', UNITS_TO_M === 1);
check(
  'plane top speeds map to realistic KTS (140 / 190 / 250 / 550)',
  displaySpeed(PLANE_HANDLING.biplane.topKts, 'biplane') === 140 &&
    displaySpeed(PLANE_HANDLING.seaplane.topKts, 'seaplane') === 190 &&
    displaySpeed(PLANE_HANDLING.twin.topKts, 'twin') === 250 &&
    displaySpeed(PLANE_HANDLING.jet.topKts, 'jet') === 550 &&
    speedUnit('seaplane') === 'KTS'
);
check(
  'biplane stall speed stays at 40 KTS and zero is 0',
  displaySpeed(0, 'biplane') === 0 &&
    displaySpeed(PLANE_HANDLING.biplane.stallKts, 'biplane') === 40
);
const jetDiveUnits = fly(
  'jet',
  PLANE_HANDLING.jet.topKts,
  PLANE_HANDLING.jet.topKts,
  -70,
  10,
  60
);
check(
  `jet in a steep dive breaks Mach 1 (${MACH_1_KTS} KTS)`,
  displaySpeed(jetDiveUnits, 'jet') >= MACH_1_KTS,
  `${displaySpeed(jetDiveUnits, 'jet')} KTS`
);
check(
  'buggy top speed maps to 161 KM/H (metric) and 100 MPH (imperial)',
  displaySpeed(PLANE_HANDLING.buggy.topKts, 'buggy', false) === 161 &&
    speedUnit('buggy', false) === 'KM/H' &&
    displaySpeed(PLANE_HANDLING.buggy.topKts, 'buggy', true) === 100 &&
    speedUnit('buggy', true) === 'MPH' &&
    speedUnit('seaplane', true) === 'KTS'
);

// The top of the sky (#176)
{
  const top = flightCeiling(3000);
  const climb = (75 * Math.PI) / 180;
  check(
    'the top of the sky is above the clouds and follows them',
    top === 3000 + ABOVE_CLOUDS_ROOM &&
      flightCeiling(5000) === 5000 + ABOVE_CLOUDS_ROOM
  );
  check(
    'kept under the clouds (?aboveClouds=0, contrails), 100 under them',
    underCloudsCeiling(3000) === 2900 &&
      underCloudsCeiling(5000) === 4900 &&
      underCloudsCeiling(300) === CEILING.MIN
  );
  check(
    'thin air: full climb well below, level just under the top, a sag at it',
    ceilingClimbLimit(top - CEILING.THIN_AIR - 1, top, climb) === climb &&
      ceilingClimbLimit(top - 300, top, climb) < climb * 0.6 &&
      ceilingClimbLimit(top - 300, top, climb) > climb * 0.4 &&
      Math.abs(ceilingClimbLimit(top - 20, top, climb)) < 0.03 &&
      ceilingClimbLimit(top, top, climb) < 0
  );
  const later = sagClimbCap(1, 0, 150, 0.1);
  check(
    'the nose follows a falling limit late, the same distance at any speed, and a rising one at once',
    later < 1 &&
      later > 0.9 &&
      Math.abs(sagClimbCap(1, 0, 300, 0.05) - later) < 1e-9 &&
      sagClimbCap(0, 0.5, 150, 0.1) === 0.5 &&
      sagClimbCap(null, 0.2, 150, 0.1) === 0.2
  );
  const h = PLANE_HANDLING.seaplane;
  const cruise = h.topKts / (BASE_FLIGHT_SPEED * 60);
  const pitch = (20 * Math.PI) / 180;
  const low = pitchedTarget(cruise, pitch, h, 0, false, thinAirAt(1000, top));
  const high = pitchedTarget(cruise, pitch, h, 0, false, thinAirAt(top, top));
  const floor = (h.levelKts + 20) / (BASE_FLIGHT_SPEED * 60);
  check(
    'a climb in thin air costs more speed, never below the climb floor',
    high < low && high >= Math.min(cruise, floor) - 1e-9,
    `(${low.toFixed(3)} low, ${high.toFixed(3)} high)`
  );
}

// Letting go of a barrel roll: it eases to the level its momentum carries
// it nearest, brakes no harder than about twice its ease-in, never turns
// back once heading for a level ahead, and settles the same at any frame rate
{
  const TURN = Math.PI * 2;
  for (const [name, h] of Object.entries(PLANE_HANDLING)) {
    const rate = h.rollRate;
    if (!rate) continue;
    for (const deg of [10, 60, 100, 150, 220, 300, 350]) {
      const results = [30, 60, 120].map((fps) => {
        const s = {roll: TURN + (deg * Math.PI) / 180, rate, accel: 0};
        const target = rollExitTurns(s.roll, s.rate, 0, rate);
        let t = 0;
        let done = false;
        let peak = 0;
        let turnedBack = false;
        let over = 0;
        while (!done && t < 4) {
          const before = s.rate;
          done = stepRollExit(s, target, rate, 1 / fps);
          t += 1 / fps;
          peak = Math.max(peak, Math.abs(s.rate - before) * fps);
          // Heading for the level ahead, it never rolls back short of it
          // (beyond the few degrees it rocks back after swinging past)
          if (target > TURN && s.rate < -0.05 && s.roll < target - 0.15) {
            turnedBack = true;
          }
          if (target > TURN) over = Math.max(over, s.roll - target);
        }
        return {target, t, peak, done, turnedBack, over};
      });
      const [a, b, c] = results;
      const want = deg < 180 ? TURN : TURN * 2;
      check(
        `${name} let go ${deg}° round settles level ${deg < 180 ? 'back' : 'ahead'}`,
        results.every(
          (r) =>
            r.done &&
            r.target === want &&
            !r.turnedBack &&
            r.over < (25 * Math.PI) / 180
        ),
        `(${results.map((r) => r.t.toFixed(2)).join('/')} s)`
      );
      check(
        `${name} let go ${deg}° round brakes gently and alike at 30/60/120 fps`,
        results.every((r) => r.peak < (rate / 0.25) * 2.2) &&
          Math.abs(a.t - b.t) < 0.25 &&
          Math.abs(c.t - b.t) < 0.25,
        `(peak ${b.peak.toFixed(1)} rad/s², ease-in ${(rate / 0.25).toFixed(1)})`
      );
    }
  }
}

// Steering during a barrel roll exit: hands over to normal flight once near
// level (or banked toward the steer), never while hands-off, inverted, or
// steeply banked the opposite way
{
  const MAX_BANK = (78 * Math.PI) / 180;
  const rad = (deg) => (deg * Math.PI) / 180;
  check(
    'roll exit keeps settling when not steering (or inside dead zone)',
    !rollExitHandOver(0, 0, MAX_BANK) &&
      !rollExitHandOver(rad(8), rad(2), MAX_BANK)
  );
  check(
    'roll exit hands over immediately when steering in the settle zone',
    rollExitHandOver(rad(8), rad(-75), MAX_BANK) &&
      rollExitHandOver(rad(-25), rad(75), MAX_BANK)
  );
  check(
    'roll exit hands over up to max bank when already banked toward the steer',
    rollExitHandOver(rad(-60), rad(-75), MAX_BANK) &&
      rollExitHandOver(rad(70), rad(75), MAX_BANK)
  );
  check(
    'roll exit waits when steeply banked opposite the steer or inverted',
    !rollExitHandOver(rad(-60), rad(75), MAX_BANK) &&
      !rollExitHandOver(rad(120), rad(75), MAX_BANK) &&
      !rollExitHandOver(rad(-150), rad(-75), MAX_BANK)
  );
}

// Loop exits reuse rollExitTurns/stepRollExit scaled by each plane's agility:
// releasing near inverted commits once by momentum and settles cleanly
{
  const LOOP_RATE = 2.2;
  const LOOP_SWING = 0.35;
  for (const [name, h] of Object.entries(PLANE_HANDLING)) {
    if (!h.rollRate) continue;
    const effRate = LOOP_RATE * h.agility;
    for (const deg of [45, 165, 175, 220, 310]) {
      const pitch = (deg * Math.PI) / 180;
      const s = {
        roll: pitch,
        rate: effRate + LOOP_SWING * h.agility * Math.cos(pitch),
        accel: 0,
      };
      const target = rollExitTurns(s.roll, s.rate, 0, effRate);
      let t = 0;
      let done = false;
      while (!done && t < 4) {
        done = stepRollExit(s, target, effRate, 1 / 60);
        t += 1 / 60;
      }
      check(
        `${name} loop let go at ${deg}° settles cleanly to ${Math.round((target * 180) / Math.PI)}°`,
        done && Math.abs(s.roll - target) < 0.03,
        `(${t.toFixed(2)} s)`
      );
    }
  }
}

// The phone joystick (joystickResponse) on its 70 px throw: never twitchier
// than the old 50 px gentle stick for the same thumb travel, the keyboard's
// full bank at the rim
{
  const SENS = 0.7167;
  const OLD_R = 50;
  const R = 70;
  const old = (px) => {
    const a = Math.min(1, px / OLD_R) * SENS;
    if (a < 0.15) return 0;
    const u = (a - 0.15) / 0.85;
    return 0.55 * u + 0.45 * u * u * u;
  };
  const calmer = [5, 10, 15, 20, 25, 30, 35, 40].every(
    (px) => joystickResponse(px / R) <= old(px) + 0.01
  );
  check(
    'joystick: up to 40 px of travel no twitchier than the old stick',
    calmer
  );
  check(
    'joystick: dead first ~10 px, as before',
    joystickResponse(10 / R) === 0 && joystickResponse(11 / R) > 0
  );
  check(
    'joystick: the rim asks for what an arrow key does',
    joystickResponse(1) === 1 &&
      joystickResponse(-1) === -1 &&
      old(OLD_R) < 0.51
  );
  let rising = true;
  for (let d = 0.15; d < 1; d += 0.01) {
    if (joystickResponse(d + 0.01) <= joystickResponse(d)) rising = false;
  }
  check('joystick: rises all the way to the rim', rising);
}

if (failed) {
  console.log('Climb and dive speed tests FAILED.');
  process.exit(1);
}
console.log('All climb and dive speed tests passed.');
