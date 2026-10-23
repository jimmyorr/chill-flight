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
 * 6. Hop-to-drift
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
// Steps the drive force alone (no slope, drag ROLL_DRAG) until it settles
function settle({forward, joyY, cruise, seconds = 30}) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    const a = ChillFlightLogic.buggyDriveAccel({
      forward,
      joyY,
      cruise,
      top: topKts,
      drag: ROLL_DRAG,
    });
    forward += a * dt;
    forward -= Math.sign(forward) * Math.min(Math.abs(forward), ROLL_DRAG * dt);
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

// --- 6. HOP-TO-DRIFT MECHANICS ---
{
  check(
    'Hop upward velocity is increased to 9.6 units/s',
    ChillFlightLogic.BUGGY_DRIFT.HOP_VELOCITY === 9.6,
    `HOP_VELOCITY: ${ChillFlightLogic.BUGGY_DRIFT.HOP_VELOCITY}`
  );

  const d = ChillFlightLogic.createBuggyDriftState();

  // 6a. Trigger hop while grounded and turning left (steerIn = 1)
  ChillFlightLogic.stepBuggyDrift(
    d,
    {hop: true, airborne: false, onWater: false, forward: 75, steerIn: 1},
    0.016
  );
  check(
    'Hop on ground triggers hopJustStarted and hopping state',
    d.hopJustStarted === true && d.hopping === true && d.hopSteerDir === 1
  );

  // 6b. Land from hop while steering left -> locks into left drift (driftDir = 1)
  ChillFlightLogic.stepBuggyDrift(
    d,
    {hop: false, airborne: false, onWater: false, forward: 75, steerIn: 1},
    0.016
  );
  check(
    'Landing from hop while steering locks into drift in that direction',
    d.hopping === false && d.driftDir === 1
  );

  // 6c. Tightening vs counter-steering turn rates in a drift
  const {driftYawRate: tightYawRate} = ChillFlightLogic.stepBuggyDrift(
    d,
    {hop: false, airborne: false, onWater: false, forward: 75, steerIn: 1},
    0.016
  );
  const {driftYawRate: wideYawRate} = ChillFlightLogic.stepBuggyDrift(
    d,
    {hop: false, airborne: false, onWater: false, forward: 75, steerIn: -0.5},
    0.016
  );
  check(
    'Steering into drift tightens turn rate; counter-steering widens arc without cancelling drift',
    d.driftDir === 1 && tightYawRate > wideYawRate && wideYawRate > 0,
    `tightYawRate=${tightYawRate?.toFixed(3)}, wideYawRate=${wideYawRate?.toFixed(3)}`
  );

  // 6d. Sustained drift rotates chassis slip angle inward
  for (let i = 0; i < 60; i++) {
    ChillFlightLogic.stepBuggyDrift(
      d,
      {hop: false, airborne: false, onWater: false, forward: 75, steerIn: 1},
      0.016
    );
  }
  check(
    'Holding drift angles chassis slipYaw inward',
    d.driftDir === 1 && d.slipYaw > 0.2,
    `driftDir=${d.driftDir}, slipYaw=${d.slipYaw.toFixed(3)}`
  );

  // 6e. Release steering stick -> smoothly ends drift back to straight grip driving
  for (let i = 0; i < 12; i++) {
    ChillFlightLogic.stepBuggyDrift(
      d,
      {hop: false, airborne: false, onWater: false, forward: 75, steerIn: 0},
      0.016
    );
  }
  check(
    'Releasing steering ends drift smoothly',
    d.driftDir === 0,
    `driftDir=${d.driftDir}`
  );

  // 6f. Single-tap hop (neutral in air) followed by steering right after landing (grace window)
  const dGrace = ChillFlightLogic.createBuggyDriftState();
  ChillFlightLogic.stepBuggyDrift(
    dGrace,
    {hop: true, airborne: false, onWater: false, forward: 75, steerIn: 0},
    0.016
  );
  // Land with steerIn = 0
  ChillFlightLogic.stepBuggyDrift(
    dGrace,
    {hop: false, airborne: false, onWater: false, forward: 75, steerIn: 0},
    0.016
  );
  // Steer right 80ms after landing (within 250ms grace window)
  ChillFlightLogic.stepBuggyDrift(
    dGrace,
    {hop: false, airborne: false, onWater: false, forward: 75, steerIn: -1},
    0.08
  );
  check(
    'Tapping to hop and dragging to steer shortly after landing still locks into drift',
    dGrace.driftDir === -1,
    `driftDir=${dGrace.driftDir}`
  );

  // 6g. Hard braking cancels drift cleanly
  ChillFlightLogic.stepBuggyDrift(
    dGrace,
    {
      hop: false,
      airborne: false,
      onWater: false,
      forward: 75,
      steerIn: -1,
      joyY: -1,
    },
    0.016
  );
  check('Braking cancels active drift cleanly', dGrace.driftDir === 0);
}

if (failed) {
  console.error('\nBuggy mechanics tests failed!');
  process.exit(1);
} else {
  console.log('\nAll buggy mechanics tests passed successfully!');
}
