// --- TWO-THUMB FLIGHT: LOGIC ---
// The "Two thumbs" touch scheme's flight model (game-loop.js applies it to
// the plane, input-manager.js reads the thumbs). One thumb rolls the plane
// and the other pulls its nose toward its own top, so a bank can be held
// (even on its side, knife edge) and a turn comes from pulling, as in a real
// plane, rather than from the bank alone. No three.js or DOM, so
// scripts/test-two-thumbs.js flies this same code in Node.
//
// Conventions (three.js, the plane's rotation order YXZ): the plane flies
// along its -Z, its top is +Y and its right wing +X. Pitch is nose up, roll
// is left wing down, yaw turns left.

export const TWO_THUMBS = {
  // Thumb travel inside which nothing happens (of full travel, 8 px of 60)
  DEAD_ZONE: 8 / 60,
  // Share of the response that's cubic (finer near the middle), as the
  // stick's (stickResponse in game-loop.js)
  CURVE: 0.45,
  // Full pull: radians a second, times the plane's agility. Pushing the nose
  // away from the plane's top reaches PUSH_SHARE of it
  PULL_RATE: 1.6,
  PUSH_SHARE: 0.5,
  // How quickly the roll and pull rates follow the thumbs (seconds)
  ROLL_EASE_SECONDS: 0.12,
  PULL_EASE_SECONDS: 0.1,
  // Lifting the roll thumb within NOTCH of level, a knife edge or upside
  // down eases the bank onto it over about NOTCH_SECONDS
  NOTCH: (10 * Math.PI) / 180,
  NOTCH_SECONDS: 0.3,
  // With the pull thumb up the nose eases back to the horizon (per second)
  RELAX: 1.2,
  // A bank alone still turns the plane a little: this many radians a second
  // at 45 degrees, fading to none level and on its side
  BANK_TURN: 0.3,
  // Both thumbs up this long (seconds) and the plane eases back to level,
  // coming on over RESCUE_EASE_SECONDS
  RESCUE_SECONDS: 3,
  RESCUE_EASE_SECONDS: 1.5,
  RESCUE_RATE: 1.5, // per second, of the bank left
  // Spring-back roll (the other roll mode): full thumb travel is this bank,
  // and the bank follows the thumb like a spring with no overshoot
  SPRING_BANK: Math.PI / 2,
  SPRING_OMEGA: 5,
  // Pulling the nose past LOOP_FROM is a loop (the camera follows the plane
  // over the top) until it is back upright and under LOOP_TO
  LOOP_FROM: (60 * Math.PI) / 180,
  LOOP_TO: (45 * Math.PI) / 180,
  // Let go upside down in a loop, it carries on round at this share of a
  // full pull
  LOOP_CARRY: 0.8,
  // Over a climb limit (slow, or near the top of the sky) the nose comes
  // back down this quickly (per second)
  LIMIT_RATE: 4,
};

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = (a) => a - TAU * Math.round(a / TAU);
function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

// A thumb's travel (-1 to 1) as a share of the full rate: nothing inside the
// dead zone, then rising from zero along a gentle curve
export function thumbResponse(v) {
  const a = Math.abs(v);
  if (a < TWO_THUMBS.DEAD_ZONE) return 0;
  const u = Math.min(
    1,
    (a - TWO_THUMBS.DEAD_ZONE) / (1 - TWO_THUMBS.DEAD_ZONE)
  );
  return (
    Math.sign(v) * ((1 - TWO_THUMBS.CURVE) * u + TWO_THUMBS.CURVE * u * u * u)
  );
}

// Quaternions are [x, y, z, w]
function multiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

// The turn of `x`, `y`, `z` radians about those axes at once
function fromRotationVector(x, y, z) {
  const angle = Math.hypot(x, y, z);
  if (angle < 1e-9) return [x / 2, y / 2, z / 2, 1];
  const s = Math.sin(angle / 2) / angle;
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

// The quaternion's pitch, yaw and roll (rotation order YXZ, as three.js
// reads it), and how upright the plane is (1 upright, -1 upside down)
export function attitudeOf(q) {
  const [x, y, z, w] = q;
  const m13 = 2 * (x * z + w * y);
  const m23 = 2 * (y * z - w * x);
  const m33 = 1 - 2 * (x * x + y * y);
  const m21 = 2 * (x * y + w * z);
  const m22 = 1 - 2 * (x * x + z * z);
  const pitch = Math.asin(-clamp(m23, -1, 1));
  let yaw;
  let roll;
  if (Math.abs(m23) < 0.9999999) {
    yaw = Math.atan2(m13, m33);
    roll = Math.atan2(m21, m22);
  } else {
    yaw = Math.atan2(-2 * (x * z - w * y), 1 - 2 * (y * y + z * z));
    roll = 0;
  }
  return {pitch, yaw, roll, upright: m22};
}

// The quaternion of a pitch, yaw and roll (rotation order YXZ)
export function quatFromAttitude(pitch, yaw, roll) {
  return multiply(
    multiply(fromRotationVector(0, yaw, 0), fromRotationVector(pitch, 0, 0)),
    fromRotationVector(0, 0, roll)
  );
}

// What carries over from frame to frame
export function newTwoThumbState() {
  return {
    rollRate: 0, // rad/s about the nose, left wing down positive
    pullRate: 0, // rad/s about the wings, nose toward the top positive
    idle: 0, // seconds with both thumbs up
    notch: null, // the bank the roll is easing onto, if any
    rollWasHeld: false,
    looping: false,
    loopDir: 1,
    rollTurned: 0, // radians rolled one way without stopping
    pullTurned: 0, // radians pitched one way without stopping
    rollStill: 0,
    pullStill: 0,
  };
}

/**
 * One frame of two-thumb flight. `s` (newTwoThumbState) is updated in place.
 *   quat       the plane's attitude [x, y, z, w]
 *   roll       the roll thumb, -1 (left) to 1 (right)
 *   pull       the pull thumb, -1 (push) to 1 (pull)
 *   rollHeld, pullHeld  whether each thumb is down
 *   levelTap   a quick tap of the roll thumb: roll back to level
 *   spring     the spring-back roll mode
 *   handling   the plane's PLANE_HANDLING entry
 *   kts        its speed
 *   climbLimit the steepest climb allowed now (radians), or Infinity
 *   turnScale  the speed-dependent turn rate (1 slow, less when fast)
 *   grounded   on the wheels or the water: no roll, and no bank turn
 * Returns {quat, rolled, looped}: the new attitude, and whether a whole
 * roll or loop was just completed by hand.
 */
export function stepTwoThumbAttitude(s, input) {
  const {
    quat,
    rollHeld,
    pullHeld,
    levelTap = false,
    spring = false,
    handling,
    kts,
    climbLimit = Infinity,
    turnScale = 1,
    grounded = false,
    dt,
  } = input;
  const T = TWO_THUMBS;
  const roll = rollHeld && !grounded ? thumbResponse(input.roll) : 0;
  const pull = pullHeld ? thumbResponse(input.pull) : 0;
  const att = attitudeOf(quat);
  const bank = att.roll;
  const steep = Math.abs(att.pitch) > T.LOOP_FROM;

  // --- Hands off: after a while, ease back to level ---
  s.idle = rollHeld || pullHeld ? 0 : s.idle + dt;
  const rescue = smoothstep(
    s.idle,
    T.RESCUE_SECONDS,
    T.RESCUE_SECONDS + T.RESCUE_EASE_SECONDS
  );

  // --- Roll ---
  const maxRoll = handling.rollRate;
  if (levelTap) s.notch = 0;
  if (rollHeld) {
    s.notch = null;
  } else if (s.rollWasHeld && !spring && !steep) {
    // Just lifted: catch the nearest notch
    for (const n of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      if (Math.abs(wrap(n - bank)) < T.NOTCH) s.notch = n;
    }
  }
  s.rollWasHeld = rollHeld;

  if (spring) {
    // The bank follows the thumb, and springs level when it lifts
    const target = grounded ? 0 : -roll * T.SPRING_BANK;
    const step = Math.min(dt, 0.05);
    const w = T.SPRING_OMEGA * handling.agility;
    s.rollRate += (w * w * wrap(target - bank) - 2 * w * s.rollRate) * step;
    s.rollRate = clamp(s.rollRate, -maxRoll, maxRoll);
    s.notch = null;
  } else {
    let want = -roll * maxRoll;
    if (!rollHeld) {
      if (s.notch !== null) {
        const d = wrap(s.notch - bank);
        if (Math.abs(d) < 0.003 && Math.abs(s.rollRate) < 0.05) s.notch = null;
        else want = clamp(d / T.NOTCH_SECONDS, -maxRoll, maxRoll);
      } else if (rescue > 0 || grounded) {
        want = clamp(
          wrap(-bank) * T.RESCUE_RATE * (grounded ? 4 : rescue),
          -maxRoll,
          maxRoll
        );
      }
    }
    s.rollRate +=
      (want - s.rollRate) * (1 - Math.exp(-dt / T.ROLL_EASE_SECONDS));
  }

  // --- Pull ---
  // Less pull when slow (as the climb limit is), so the nose can't be hung
  // up at the stall
  const authority =
    handling.stallKts > 0
      ? 0.35 + 0.65 * smoothstep(kts, handling.stallKts, handling.levelKts)
      : 1;
  const maxPull = T.PULL_RATE * handling.agility * authority;
  if (steep && pullHeld && Math.abs(s.pullRate) > 0.3) {
    s.looping = true;
    s.loopDir = Math.sign(s.pullRate);
  } else if (
    s.looping &&
    att.upright > 0.5 &&
    Math.abs(att.pitch) < T.LOOP_TO
  ) {
    s.looping = false;
  }
  let wantPull = pull >= 0 ? pull * maxPull : pull * maxPull * T.PUSH_SHARE;
  // The nose's angle to the horizon eases back on its own (radians a
  // second), without turning the plane
  let settle = 0;
  if (!pullHeld) {
    if (s.looping && att.upright < 0) {
      // Let go upside down in a loop: carry on round
      wantPull = s.loopDir * maxPull * T.LOOP_CARRY;
    } else {
      settle = -att.pitch * Math.max(T.RELAX, rescue * T.RESCUE_RATE);
    }
  }
  if (!(s.looping && att.upright < 0) && att.pitch > climbLimit) {
    settle -= (att.pitch - climbLimit) * T.LIMIT_RATE;
    if (att.upright > 0) wantPull = Math.min(wantPull, 0);
  }
  s.pullRate +=
    (wantPull - s.pullRate) * (1 - Math.exp(-dt / T.PULL_EASE_SECONDS));

  // --- Turn the plane ---
  // The settle moves the nose straight up or down the sky whatever the
  // bank: part pitch, part yaw, in the plane's own axes
  const pitchRate = s.pullRate + settle * Math.cos(bank);
  const yawRate = -settle * Math.sin(bank);
  let q = multiply(
    quat,
    fromRotationVector(pitchRate * dt, yawRate * dt, s.rollRate * dt)
  );
  // A gentle bank still curves the flight; on its side it flies straight
  if (!grounded) {
    const bankTurn =
      T.BANK_TURN *
      2 *
      Math.sin(bank) *
      Math.max(0, Math.cos(bank)) *
      Math.cos(att.pitch) *
      handling.agility *
      turnScale;
    q = multiply(fromRotationVector(0, bankTurn * dt, 0), q);
  }
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  q = [q[0] / n, q[1] / n, q[2] / n, q[3] / n];

  // --- Whole rolls and loops done by hand ---
  const rolled = turned(s, 'rollTurned', 'rollStill', s.rollRate, dt);
  const looped = turned(s, 'pullTurned', 'pullStill', s.pullRate, dt);

  return {quat: q, rolled, looped};
}

// Adds this frame's turning to a running total that starts again when the
// turning stops or reverses; true as it passes a whole turn
function turned(s, total, still, rate, dt) {
  if (Math.abs(rate) < 0.3) {
    s[still] += dt;
    if (s[still] > 0.5) s[total] = 0;
    return false;
  }
  s[still] = 0;
  if (s[total] !== 0 && Math.sign(s[total]) !== Math.sign(rate)) s[total] = 0;
  s[total] += rate * dt;
  if (Math.abs(s[total]) >= TAU) {
    s[total] = 0;
    return true;
  }
  return false;
}
