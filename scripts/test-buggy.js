#!/usr/bin/env node
/**
 * scripts/test-buggy.js
 *
 * Automated tests for buggy driving mechanics, run against the real
 * functions in chill-flight-logic.js:
 * 1. 3D elevation-aware road deck sampling for underpasses/overpasses
 * 2. Continuous road surface height across segment joints without flat ledge steps
 * 3. Speed-dependent steering limit and stick curves
 * 4. One-handed cruise speed, boost, braking and reverse
 * 5. The ?buggy= switch
 * 6. Incline vertical momentum and catching air
 * 7. Turning into a hovercraft on water
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {PLANE_HANDLING} from '../constants.js';
import {BUGGY_WHEELBASE} from '../buggy-model.js';

console.log('Testing buggy driving mechanics...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAILED: ${name}${detail ? ` (${detail})` : ''}`);
    failed = true;
  }
}

// --- 1. 3D ELEVATION-AWARE ROAD SAMPLING (UNDERPASSES & OVERPASSES) ---
// Two intersecting road segments at (100, 200):
// Segment 1 (underpass deck at y = 50)
// Segment 2 (overpass deck at y = 72)
const underpassSeg = {
  x0: 80,
  z0: 200,
  y0: 50,
  x1: 120,
  z1: 200,
  y1: 50,
};
const overpassSeg = {
  x0: 100,
  z0: 180,
  y0: 72,
  x1: 100,
  z1: 220,
  y1: 72,
};

const sampleUnderState = {found: false, bestDist: Infinity, bestInside: false};
const outUnder = {height: 0, slopeX: 0, slopeZ: 0};
ChillFlightLogic.sampleRoadSegment(
  underpassSeg,
  100,
  200,
  outUnder,
  50,
  sampleUnderState
);
ChillFlightLogic.sampleRoadSegment(
  overpassSeg,
  100,
  200,
  outUnder,
  50,
  sampleUnderState
);

check(
  'Sampling road near lower deck (y=50) selects the underpass',
  sampleUnderState.found && Math.abs(outUnder.height - 50.75) < 0.1,
  `expected ~50.75, got ${outUnder.height}`
);

const sampleOverState = {found: false, bestDist: Infinity, bestInside: false};
const outOver = {height: 0, slopeX: 0, slopeZ: 0};
ChillFlightLogic.sampleRoadSegment(
  underpassSeg,
  100,
  200,
  outOver,
  72,
  sampleOverState
);
ChillFlightLogic.sampleRoadSegment(
  overpassSeg,
  100,
  200,
  outOver,
  72,
  sampleOverState
);

check(
  'Sampling road near upper deck (y=72) selects the overpass',
  sampleOverState.found && Math.abs(outOver.height - 72.75) < 0.1,
  `expected ~72.75, got ${outOver.height}`
);

const sampleDefaultState = {
  found: false,
  bestDist: Infinity,
  bestInside: false,
};
const outDefault = {height: 0, slopeX: 0, slopeZ: 0};
ChillFlightLogic.sampleRoadSegment(
  underpassSeg,
  100,
  200,
  outDefault,
  null,
  sampleDefaultState
);
ChillFlightLogic.sampleRoadSegment(
  overpassSeg,
  100,
  200,
  outDefault,
  null,
  sampleDefaultState
);

check(
  'Sampling road without vehicle elevation falls back to highest deck (72.75)',
  sampleDefaultState.found && Math.abs(outDefault.height - 72.75) < 0.1,
  `expected ~72.75, got ${outDefault.height}`
);

// --- 2. CONTINUOUS ROAD SURFACE ACROSS SEGMENT JOINTS ---
// Two consecutive sloping segments joining at (100, 0, y=30):
// Seg A: (50, 0, y=25) -> (100, 0, y=30), grade = 5/50 = 0.10
// Seg B: (100, 0, y=30) -> (150, 0, y=34), grade = 4/50 = 0.08
const segA = {
  x0: 50,
  z0: 0,
  y0: 25,
  x1: 100,
  z1: 0,
  y1: 30,
};
const segB = {
  x0: 100,
  z0: 0,
  y0: 30,
  x1: 150,
  z1: 0,
  y1: 34,
};

// Sample just before joint (x = 99.5), at joint (x = 100.0), and just after (x = 100.5)
const sampleRoadAt = (x, z, y) => {
  const out = {height: 0, slopeX: 0, slopeZ: 0};
  const state = {found: false, bestDist: Infinity, bestInside: false};
  ChillFlightLogic.sampleRoadSegment(segA, x, z, out, y, state);
  ChillFlightLogic.sampleRoadSegment(segB, x, z, out, y, state);
  return out;
};

const outBefore = sampleRoadAt(99.5, 0, 30);
const outAt = sampleRoadAt(100.0, 0, 30);
const outAfter = sampleRoadAt(100.5, 0, 30);

const stepBeforeToAt = Math.abs(outAt.height - outBefore.height);
const stepAtToAfter = Math.abs(outAfter.height - outAt.height);

check(
  'Road elevation is continuous across segment joint without ledge step',
  stepBeforeToAt < 0.15 && stepAtToAfter < 0.15,
  `step before: ${stepBeforeToAt.toFixed(4)}, step after: ${stepAtToAfter.toFixed(4)}`
);

// --- 3. HIGHWAY STEERING AUTHORITY & SPEED-DEPENDENT TURN RADIUS ---
const topKts = PLANE_HANDLING.buggy.topKts;
const {MAX_STEER, BRAKE_DECEL, REVERSE_TOP, ROLL_DRAG} =
  ChillFlightLogic.BUGGY_DRIVE;
const steerLimit = (speed) =>
  ChillFlightLogic.buggySteerLimit(speed, BUGGY_WHEELBASE);
const radiusAt = (speed) => BUGGY_WHEELBASE / Math.tan(steerLimit(speed));

// Low speed (5 kts): full lock for parking and U-turns
check(
  'Low-speed parking gets full lock (radius about 11 units)',
  radiusAt(5) <= 12 && Math.abs(steerLimit(5) - MAX_STEER) < 1e-9,
  `radius: ${radiusAt(5).toFixed(1)}, steer: ${steerLimit(5).toFixed(3)}`
);

// High speed: grip-limited, so the radius grows with the square of the speed
// (~195 units at 150 kts, ~348 at the 200 kts top speed)
check(
  'Turn radius at 150 kts is ~195 units',
  radiusAt(150) >= 180 && radiusAt(150) <= 210,
  `radius: ${radiusAt(150).toFixed(1)}`
);
check(
  `Top-speed (${topKts} kts) turn radius is ~348 units`,
  radiusAt(topKts) >= 330 && radiusAt(topKts) <= 370,
  `radius: ${radiusAt(topKts).toFixed(1)}`
);
const yawRateTop = (topKts * Math.tan(steerLimit(topKts))) / BUGGY_WHEELBASE;
check(
  'High-speed full-lock yaw rate is controlled (<= 50 deg/s)',
  yawRateTop * (180 / Math.PI) <= 50,
  `yaw rate: ${(yawRateTop * (180 / Math.PI)).toFixed(1)} deg/s`
);

// Joystick curve for straight highway driving: the virtual joystick's full
// throw is 0.5, and small nudges around the centre steer very little
const steerAxis = (v) => ChillFlightLogic.buggySteerAxis(v, true);
check(
  'Joystick steering curve gives gentle sub-2% lane control around center for straight roads',
  steerAxis(0.12) > 0 && steerAxis(0.12) < 0.02,
  `steer: ${steerAxis(0.12).toFixed(4)}`
);
check(
  'Joystick half deflection provides progressive ~18% intermediate steering',
  steerAxis(0.25) > 0.15 && steerAxis(0.25) < 0.22,
  `steer: ${steerAxis(0.25).toFixed(4)}`
);
check(
  'Joystick steering reaches 100% full steering lock on full deflection',
  Math.abs(steerAxis(0.5) - 1) < 1e-6 && Math.abs(steerAxis(-0.5) + 1) < 1e-6,
  `steer: ${steerAxis(0.5).toFixed(4)}`
);
check('Joystick steering ignores the deadzone', steerAxis(0.05) === 0);
check(
  'Joystick throttle is linear past its deadzone, to full at full throw',
  ChillFlightLogic.buggyThrottleAxis(0.05, true) === 0 &&
    Math.abs(ChillFlightLogic.buggyThrottleAxis(-0.5, true) + 1) < 1e-9 &&
    Math.abs(ChillFlightLogic.buggyThrottleAxis(0.29, true) - 0.5) < 1e-9
);

// --- 4. ONE-HANDED CRUISE SPEED, BOOST & REVERSE LOGIC ---
// Steps the drive force and drag (no slope) as buggy.js does, on land or
// water alike, until it settles
function settle({forward, joyY, cruise, seconds = 30}) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const drag = ChillFlightLogic.buggyDrag(forward);
    const a = ChillFlightLogic.buggyDriveAccel({
      forward,
      joyY,
      cruise,
      top: topKts,
      drag,
    });
    forward += a * dt;
    forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
  }
  return forward;
}
const drive = (forward, joyY, cruise) =>
  ChillFlightLogic.buggyDriveAccel({
    forward,
    joyY,
    cruise,
    top: topKts,
    drag: ROLL_DRAG,
  });

const cruiseSettled = settle({forward: 0, joyY: 0, cruise: 80});
check(
  'Stick at rest holds the throttle slider speed',
  Math.abs(cruiseSettled - 80) < 2,
  `forward: ${cruiseSettled.toFixed(1)}`
);
const boosted = settle({forward: 80, joyY: 1, cruise: 80});
check(
  `Pushing up boosts to top speed (${topKts} kts)`,
  Math.abs(boosted - topKts) < 3,
  `forward: ${boosted.toFixed(1)}`
);
check(
  'Pulling down on stick triggers full braking deceleration',
  drive(80, -1, 80) === -BRAKE_DECEL,
  `accel: ${drive(80, -1, 80)}`
);
const reversed = settle({forward: 80, joyY: -1, cruise: 80});
check(
  `Continuing to hold down reverses at up to ${REVERSE_TOP} kts`,
  Math.abs(reversed + REVERSE_TOP) < 1,
  `forward: ${reversed.toFixed(1)}`
);
check(
  'Releasing joystick from reverse brakes, then cruises forward again',
  drive(-10, 0, 80) === BRAKE_DECEL &&
    settle({forward: -10, joyY: 0, cruise: 80}) > 78,
  `accel: ${drive(-10, 0, 80)}`
);
check(
  'With no cruise set, the stick at rest coasts to a stop',
  drive(30, 0, 0) === -ROLL_DRAG && drive(0, 0, 0) === 0
);

// --- 5. DEFAULT AVAILABILITY & URL PARAMETERS ---
check(
  'Buggy is included in ChillFlightLogic.PLANE_TYPES by default',
  ChillFlightLogic.PLANE_TYPES.includes('buggy'),
  `PLANE_TYPES: ${ChillFlightLogic.PLANE_TYPES.join(', ')}`
);
for (const [value, expected] of [
  ['', true],
  ['1', true],
  ['true', true],
  ['0', false],
  ['false', false],
  ['OFF', false],
]) {
  check(
    `?buggy=${value} switch reads as ${expected ? 'on' : 'off'}`,
    ChillFlightLogic.parseSwitch(value) === expected
  );
}
check(
  'No ?buggy= leaves the switch unset (buggy offered)',
  ChillFlightLogic.parseSwitch(null) === null
);

// --- 6. INCLINE VERTICAL MOMENTUM & CATCHING AIR ---
{
  // Climbs at `up` units/s for a second, then the ground runs on at `down`
  // units/s (a crest), stepped at `fps`: whether it took off, and how long
  // it was in the air
  const crest = (fps, up, down) => {
    const dt = 1 / fps;
    let b = {y: 0, velY: 0, airborne: false};
    let ground = 0;
    let air = 0;
    for (let i = 0; i < fps * 4; i++) {
      const gVelY = i < fps ? up : down;
      ground += gVelY * dt;
      b = ChillFlightLogic.stepBuggyVertical({
        ...b,
        surfaceHeight: ground,
        groundVelY: gVelY,
        onWater: false,
        dt,
      });
      if (b.airborne) air += dt;
    }
    return air;
  };
  // A small crest that rolls over, and a sharp one that launches, the same
  // at 30, 60 and 120 fps
  for (const fps of [30, 60, 120]) {
    check(
      `A gentle crest stays on the ground at ${fps} fps`,
      crest(fps, 12, 0) === 0
    );
    const air = crest(fps, 10, -10);
    check(
      `A sharp crest catches air at ${fps} fps`,
      air > 0.3,
      `airTime=${air.toFixed(2)}s`
    );
  }

  // 6a. Cruising on flat ground stays planted (never launches)
  let flat = {y: 0, velY: 0, airborne: false};
  let launchedOnFlat = false;
  for (let t = 0; t < 2; t += 0.016) {
    flat = ChillFlightLogic.stepBuggyVertical({
      ...flat,
      surfaceHeight: 0,
      groundVelY: 0,
      onWater: false,
      dt: 0.016,
    });
    if (flat.airborne) launchedOnFlat = true;
  }
  check('Cruising on flat ground does not launch', !launchedOnFlat);

  // 6b. Driving high speed up an incline reliably catches air over the crest
  // 150 kts up a 0.25 slope -> groundVelY = 37.5 units/s upward
  let incline = {y: 0, velY: 0, airborne: false};
  let launchedOverCrest = false;
  let maxAirHeight = 0;
  let airTime = 0;
  let height = 0;
  for (let t = 0; t < 3; t += 0.016) {
    const climbing = t < 1.0;
    const gVelY = climbing ? 37.5 : 0;
    height += gVelY * 0.016;
    incline = ChillFlightLogic.stepBuggyVertical({
      ...incline,
      surfaceHeight: height,
      groundVelY: gVelY,
      onWater: false,
      dt: 0.016,
    });
    if (incline.airborne) {
      launchedOverCrest = true;
      airTime += 0.016;
      const air = incline.y - height;
      if (air > maxAirHeight) maxAirHeight = air;
    }
  }
  check(
    'High-speed incline crest reliably catches air',
    launchedOverCrest && airTime >= 1.5 && maxAirHeight >= 12,
    `airTime=${airTime.toFixed(2)}s, maxAir=${maxAirHeight.toFixed(1)} units`
  );

  // 6c. Low speed up a gentle slope does not catch air (stays grounded)
  let gentle = {y: 0, velY: 0, airborne: false};
  let launchedGentle = false;
  let gHeight = 0;
  for (let t = 0; t < 2; t += 0.016) {
    const climbing = t < 1.0;
    const gVelY = climbing ? 2.5 : 0;
    gHeight += gVelY * 0.016;
    gentle = ChillFlightLogic.stepBuggyVertical({
      ...gentle,
      surfaceHeight: gHeight,
      groundVelY: gVelY,
      onWater: false,
      dt: 0.016,
    });
    if (gentle.airborne) launchedGentle = true;
  }
  check(
    'Low speed on gentle slope hugs ground without launching',
    !launchedGentle
  );

  // 6d. Driving off a cliff/ledge reliably launches into free-fall
  let cliff = {y: 50, velY: 0, airborne: false};
  let launchedCliff = false;
  for (let t = 0; t < 1; t += 0.016) {
    const h = t < 0.2 ? 50 : 20;
    cliff = ChillFlightLogic.stepBuggyVertical({
      ...cliff,
      surfaceHeight: h,
      groundVelY: 0,
      onWater: false,
      dt: 0.016,
    });
    if (cliff.airborne) launchedCliff = true;
  }
  check('Driving off a cliff or ledge reliably launches', launchedCliff);

  // 6e. On water, buggy floats and never launches
  let water = {y: 0, velY: 0, airborne: false};
  let launchedWater = false;
  for (let t = 0; t < 1; t += 0.016) {
    water = ChillFlightLogic.stepBuggyVertical({
      ...water,
      surfaceHeight: -0.9,
      groundVelY: 20,
      onWater: true,
      dt: 0.016,
    });
    if (water.airborne) launchedWater = true;
  }
  check('Buggy on water floats without launching', !launchedWater);

  // 6f. Jumping into water from the bank falls in, rather than dropping
  // straight to the surface
  let splash = {y: 30, velY: 10, airborne: true};
  splash = ChillFlightLogic.stepBuggyVertical({
    ...splash,
    surfaceHeight: -0.9,
    groundVelY: 0,
    onWater: true,
    dt: 0.016,
  });
  check(
    'Airborne over water carries on through the air',
    splash.airborne && splash.y > 29,
    `y=${splash.y.toFixed(1)}`
  );
}

// --- 7. HOVERCRAFT ON WATER ---
{
  // Off a bridge 40 units up at 160 kts: it falls, lands on the water and
  // hovers there rather than sinking or getting stuck
  let b = {y: 40, velY: 0, airborne: true};
  let t = 0;
  while (b.airborne && t < 5) {
    b = ChillFlightLogic.stepBuggyVertical({
      ...b,
      surfaceHeight: -0.3,
      groundVelY: 0,
      onWater: true,
      dt: 1 / 60,
    });
    t += 1 / 60;
  }
  check(
    'Falling off a bridge lands on the water and hovers',
    !b.airborne && b.y === -0.3,
    `airborne=${b.airborne}, y=${b.y}`
  );
  const kept = settle({forward: 160, joyY: 0, cruise: 160, seconds: 10});
  check(
    'It carries on across the water at the set speed',
    Math.abs(kept - 160) < 2,
    `forward: ${kept.toFixed(1)}`
  );
  const fromRest = settle({forward: 0, joyY: 1, cruise: 0, seconds: 20});
  check(
    'From a stop on the water it boosts up to top speed',
    fromRest > topKts - 3,
    `forward: ${fromRest.toFixed(1)}`
  );

  // The wheels fold flat over water and back down over land, in
  // FOLD_SECONDS at any frame rate
  const {FOLD_SECONDS} = ChillFlightLogic.BUGGY_HOVER;
  for (const fps of [30, 60, 144]) {
    let fold = 0;
    let half = 0;
    for (let i = 0; i < fps * FOLD_SECONDS; i++) {
      fold = ChillFlightLogic.stepBuggyHoverFold(fold, true, 1 / fps);
      if (i === Math.floor((fps * FOLD_SECONDS) / 2) - 1) half = fold;
    }
    let back = fold;
    for (let i = 0; i < fps * FOLD_SECONDS; i++) {
      back = ChillFlightLogic.stepBuggyHoverFold(back, false, 1 / fps);
    }
    check(
      `Wheels fold flat on water and back on land at ${fps} fps`,
      Math.abs(fold - 1) < 1e-9 && half > 0.4 && half < 0.6 && back < 1e-9,
      `fold=${fold}, half=${half}, back=${back}`
    );
  }
  check(
    'It slides a little wider on water than on the ground',
    ChillFlightLogic.BUGGY_HOVER.GRIP > 4 &&
      ChillFlightLogic.BUGGY_HOVER.GRIP < 18
  );
}

if (failed) {
  console.error('\nBuggy mechanics tests failed!');
  process.exit(1);
} else {
  console.log('\nAll buggy mechanics tests passed successfully!');
}
