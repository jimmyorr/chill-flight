#!/usr/bin/env node
/**
 * scripts/test-advanced-stick.js
 *
 * Checks the advanced joystick's flight model (advanced-stick-logic.js): a
 * bank left alone stays, a knife edge flies straight, pulling on its side turns the plane,
 * the notches and the hands-off rescue settle, loops and rolls done by hand
 * come round and are counted, and it flies the same at any frame rate.
 */
import {PLANE_HANDLING} from '../constants.js';
import {
  attitudeOf,
  newAdvancedStickState,
  quatFromAttitude,
  stepAdvancedStickAttitude,
  axisResponse,
} from '../advanced-stick-logic.js';

console.log('Testing advanced joystick flight...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const deg = (r) => (r * 180) / Math.PI;
const rad = (d) => (d * Math.PI) / 180;
const wrap = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
const h = PLANE_HANDLING.seaplane;

// Flies `steps` ([seconds, {roll, pull, rollHeld, pullHeld, ...}]) from an
// attitude; returns the final attitude, state and counts
function fly(steps, {fps = 60, start = [0, 0, 0], opts = {}} = {}) {
  const s = newAdvancedStickState();
  let quat = quatFromAttitude(...start);
  let rolls = 0;
  let loops = 0;
  let turnedYaw = 0;
  let lastYaw = attitudeOf(quat).yaw;
  const dt = 1 / fps;
  for (const [seconds, thumbs] of steps) {
    for (let i = 0; i < Math.round(seconds * fps); i++) {
      const out = stepAdvancedStickAttitude(s, {
        quat,
        roll: 0,
        pull: 0,
        rollHeld: false,
        pullHeld: false,
        handling: h,
        kts: 150,
        dt,
        ...opts,
        ...thumbs,
        levelTap: thumbs.levelTap && i === 0,
      });
      quat = out.quat;
      if (out.rolled) rolls++;
      if (out.looped) loops++;
      const yaw = attitudeOf(quat).yaw;
      turnedYaw += wrap(yaw - lastYaw);
      lastYaw = yaw;
    }
  }
  return {...attitudeOf(quat), s, rolls, loops, turnedYaw};
}

const ROLL_R = {roll: 1, rollHeld: true};
const PULL = {pull: 1, pullHeld: true};
const NONE = {};

check(
  'a stick inside the dead zone does nothing, and full travel is full rate',
  axisResponse(0.1) === 0 && axisResponse(-1) === -1 && axisResponse(1) === 1
);

// Roll right about 60 degrees, lift, wait: the bank stays
{
  const a = fly([
    [0.4, ROLL_R],
    [2, NONE],
  ]);
  check(
    'letting the stick back to the middle keeps the bank',
    a.roll < rad(-30) && a.roll > rad(-80) && Math.abs(a.s.rollRate) < 0.01,
    deg(a.roll).toFixed(1)
  );
}

// Lifted near 90 degrees, the bank settles onto the knife edge
{
  const a = fly([[1, NONE]], {start: [0, 0, rad(-84)]});
  // (a lift is needed for the notch to catch)
  const b = fly(
    [
      [0.05, {roll: 0, rollHeld: true}],
      [1.5, NONE],
    ],
    {start: [0, 0, rad(-84)]}
  );
  check(
    'a bank left alone is not pulled to a notch',
    Math.abs(deg(a.roll) + 84) < 0.5,
    deg(a.roll).toFixed(1)
  );
  check(
    'letting the stick back near a knife edge settles onto it',
    Math.abs(deg(b.roll) + 90) < 0.5,
    deg(b.roll).toFixed(2)
  );
}

// Knife edge with no pull flies straight and level
{
  const a = fly(
    [
      [0.05, {roll: 0, rollHeld: true}],
      [2.5, NONE],
    ],
    {start: [0, 0, rad(90)]}
  );
  check(
    'a knife edge with no pull keeps its heading and its height',
    Math.abs(deg(a.turnedYaw)) < 1 && Math.abs(deg(a.pitch)) < 0.5,
    `yaw ${deg(a.turnedYaw).toFixed(2)} pitch ${deg(a.pitch).toFixed(2)}`
  );
}

// On its left side, a full pull turns it left, about a circle in 4 seconds
{
  const a = fly([[2, {...PULL, roll: 0, rollHeld: true}]], {
    start: [0, 0, rad(90)],
  });
  check(
    'on its side, pulling turns the plane flat',
    deg(a.turnedYaw) > 150 &&
      deg(a.turnedYaw) < 200 &&
      Math.abs(deg(a.pitch)) < 3,
    `yaw ${deg(a.turnedYaw).toFixed(1)} pitch ${deg(a.pitch).toFixed(1)}`
  );
}

// A gentle bank alone curves the flight the way it leans
{
  const a = fly([[2, {roll: 0, rollHeld: true}]], {start: [0, 0, rad(30)]});
  check(
    'a gentle left bank alone turns left a little',
    deg(a.turnedYaw) > 10 && deg(a.turnedYaw) < 60,
    deg(a.turnedYaw).toFixed(1)
  );
}

// Level wings: pull climbs, and letting go eases back to level
{
  const up = fly([[0.5, PULL]]);
  const back = fly([
    [0.5, PULL],
    [2.9, NONE],
  ]);
  check(
    'pulling climbs, and the nose eases back level after',
    deg(up.pitch) > 25 &&
      Math.abs(deg(back.pitch)) < 2 &&
      Math.abs(deg(back.turnedYaw)) < 0.5,
    `${deg(up.pitch).toFixed(1)} then ${deg(back.pitch).toFixed(1)}`
  );
}

// A nose-high knife edge eases back to the horizon without turning
{
  const a = fly(
    [
      [0.05, {roll: 0, rollHeld: true}],
      [2.9, NONE],
    ],
    {start: [rad(30), 0, rad(90)]}
  );
  check(
    'on its side with the nose up, the nose eases down without turning',
    Math.abs(deg(a.pitch)) < 2 &&
      Math.abs(deg(a.turnedYaw)) < 1 &&
      Math.abs(deg(a.roll) - 90) < 2,
    `pitch ${deg(a.pitch).toFixed(1)} yaw ${deg(a.turnedYaw).toFixed(1)} roll ${deg(a.roll).toFixed(1)}`
  );
}

// Holding the pull goes round a whole loop and is counted
{
  const a = fly([[4.2, PULL]]);
  check(
    'holding the pull loops, and the loop is counted',
    a.loops === 1,
    `${a.loops}`
  );
  // Let go over the top: it carries on round and comes out upright and level
  const b = fly([
    [2.2, PULL],
    [4, NONE],
  ]);
  check(
    'letting go upside down in a loop carries on round to level',
    b.upright > 0.99 && Math.abs(deg(b.pitch)) < 3 && !b.s.looping,
    `upright ${b.upright.toFixed(2)} pitch ${deg(b.pitch).toFixed(1)}`
  );
}

// Holding the roll goes round and is counted
{
  const a = fly([[2.6, ROLL_R]]);
  check(
    'holding the roll rolls right round, and it is counted',
    a.rolls === 1,
    `${a.rolls}`
  );
}

// A quick tap rolls back to level; hands off for a while does too
{
  const a = fly([[2.5, {levelTap: true}]], {start: [0, 0, rad(120)]});
  check(
    'a tap of the stick levels the wings',
    Math.abs(deg(a.roll)) < 0.5,
    deg(a.roll).toFixed(1)
  );
  const early = fly([[2.9, NONE]], {start: [0, 0, rad(70)]});
  const late = fly([[9, NONE]], {start: [0, 0, rad(70)]});
  check(
    'hands off, the bank holds for 3 seconds, then eases level',
    Math.abs(deg(early.roll) - 70) < 0.5 && Math.abs(deg(late.roll)) < 2,
    `${deg(early.roll).toFixed(1)} then ${deg(late.roll).toFixed(1)}`
  );
  const inverted = fly([[12, NONE]], {start: [0, 0, rad(170)]});
  check(
    'hands off upside down, it rolls upright',
    inverted.upright > 0.99,
    inverted.upright.toFixed(3)
  );
}

// A finger resting on the stick in the middle holds off the rescue
{
  const a = fly([[9, {active: true}]], {start: [0, 0, rad(70)]});
  check(
    'a finger resting on the stick keeps the bank past 3 seconds',
    Math.abs(deg(a.roll) - 70) < 0.5,
    deg(a.roll).toFixed(1)
  );
}

// The spring-back roll: the bank follows the stick and levels when let go
{
  const held = fly([[1.5, ROLL_R]], {opts: {spring: true}});
  const let_go = fly(
    [
      [1.5, ROLL_R],
      [1.5, NONE],
    ],
    {opts: {spring: true}}
  );
  check(
    'spring back: full stick is a knife edge, and letting go levels the wings',
    Math.abs(deg(held.roll) + 90) < 2 && Math.abs(deg(let_go.roll)) < 1,
    `${deg(held.roll).toFixed(1)} then ${deg(let_go.roll).toFixed(1)}`
  );
}

// Slow or near the ceiling, the climb is held to the limit
{
  const a = fly([[3, PULL]], {opts: {climbLimit: rad(20)}});
  check(
    'a climb limit holds the nose down',
    deg(a.pitch) < 24,
    deg(a.pitch).toFixed(1)
  );
}

// On the ground the wings stay level
{
  const a = fly([[1, ROLL_R]], {opts: {grounded: true}});
  check(
    'on the ground the stick does not bank',
    Math.abs(deg(a.roll)) < 0.5,
    deg(a.roll).toFixed(1)
  );
}

// The same flight at 30, 60 and 120 fps
{
  const steps = [
    [0.5, ROLL_R],
    [1.5, {...PULL, roll: 0, rollHeld: true}],
    [1, NONE],
  ];
  const runs = [30, 60, 120].map((fps) => fly(steps, {fps}));
  const spread = (f) => Math.max(...runs.map(f)) - Math.min(...runs.map(f));
  check(
    'the same stick flies the same at 30, 60 and 120 fps',
    deg(spread((r) => r.roll)) < 4 &&
      deg(spread((r) => r.turnedYaw)) < 6 &&
      deg(spread((r) => r.pitch)) < 4,
    runs
      .map(
        (r) =>
          `${deg(r.roll).toFixed(1)}/${deg(r.turnedYaw).toFixed(1)}/${deg(r.pitch).toFixed(1)}`
      )
      .join('  ')
  );
}

if (failed) {
  console.error('Advanced joystick flight tests failed.');
  process.exit(1);
}
console.log('All advanced joystick flight tests passed.');
