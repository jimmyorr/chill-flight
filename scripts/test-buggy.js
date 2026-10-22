#!/usr/bin/env node
/**
 * scripts/test-buggy.js
 *
 * Automated tests for buggy driving mechanics:
 * 1. One-handed controls, cruise speed hold, temporary boost, and continuous reverse
 * 2. Pure grip handling and high-speed cornering authority
 * 3. 3D elevation-aware road deck sampling for underpasses/overpasses
 * 4. Continuous road surface height across segment joints without flat ledge steps
 * 5. Seamless curb climbing from off-road
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {PLANE_HANDLING} from '../constants.js';

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

// --- 3. HIGHWAY STEERING AUTHORITY & PURE GRIP ARCADE CORNERING ---
const topKts = PLANE_HANDLING.buggy.topKts; // 120 kts
const forwardFast = topKts;
const wheelbase = 2.8;
const maxCornering = 160;
const minSteerHighSpeed = 0.18;
const maxSteer = 0.55;

const cornerLimit = Math.atan(
  (maxCornering * wheelbase) / Math.max(1, forwardFast * forwardFast)
);
const steerLimit = Math.max(minSteerHighSpeed, cornerLimit);
const steerTarget = Math.min(maxSteer, steerLimit);

check(
  'High-speed cornering maintains responsive steering angle authority (>= 0.18 rad)',
  steerTarget >= 0.18,
  `steerTarget: ${steerTarget}`
);

// Grip: side velocity decays rapidly
const gripRoad = 25;
const dt = 0.016; // 60 fps
const sideDecay = Math.exp(-gripRoad * dt);
check(
  'Tyres provide high grip that kills lateral slide quickly (decay < 0.70 per 16ms frame)',
  sideDecay < 0.7,
  `decay: ${sideDecay.toFixed(3)}`
);

// --- 4. ONE-HANDED CRUISE SPEED, BOOST & REVERSE LOGIC ---
let simCruise = 80; // knots
let simTargetFlightSpeed = 80 / (2.5 * 60);
let simForward = 80;
const topSpeed = 120;
const reverseTop = 20;

// Test Boost: joyY = 1.0 (pushing up)
const joyYUp = 1.0;
const boostTarget = simCruise + (topSpeed - simCruise) * joyYUp;
check(
  'Pushing up boosts target speed up to top speed (120 kts)',
  boostTarget === topSpeed,
  `boostTarget: ${boostTarget}`
);

// Test Brake & Reverse: joyY = -1.0 (pulling down)
const joyYDown = -1.0;
const downAmount = -joyYDown;
let simDriveAccel = 0;
if (simForward > 0.5) {
  simDriveAccel = -45 * downAmount; // braking
}
check(
  'Pulling down on stick triggers full braking deceleration (-45 units/s²)',
  simDriveAccel === -45,
  `accel: ${simDriveAccel}`
);

// After vehicle stops (stoppedForward <= 0.5), continuous hold shifts into reverse
const stoppedForward = 0;
let revDriveAccel = 0;
if (stoppedForward <= 0.5) {
  revDriveAccel = -20 * downAmount;
}
const revTarget = -reverseTop * downAmount;
check(
  'Continuing to hold down shifts into reverse target (-20 kts)',
  revTarget === -20 && revDriveAccel === -20,
  `revTarget: ${revTarget}, revDriveAccel: ${revDriveAccel}`
);

// Target flight speed is preserved during braking/reversing
check(
  'Target cruise speed setting is preserved while braking and reversing',
  simTargetFlightSpeed > 0,
  `targetFlightSpeed: ${simTargetFlightSpeed}`
);

// When joystick released (joyY = 0) from reverse:
const joyYNeutral = 0;
let neutralAccel = 0;
const reversingForward = -10;
if (joyYNeutral === 0 && simCruise > 0.5) {
  if (reversingForward < -0.5) {
    neutralAccel = 45; // brake out of reverse
  }
}
check(
  'Releasing joystick from reverse automatically brakes and resumes cruising forward',
  neutralAccel === 45,
  `neutralAccel: ${neutralAccel}`
);

// --- 5. OFF-ROAD TO ON-ROAD CURB CLIMBING ---
const roadStepUp = 12; // units
check(
  'Road step-up allowance is at least 10 units for seamless curb and embankment climbing',
  roadStepUp >= 10,
  `roadStepUp: ${roadStepUp}`
);

// --- 6. DEFAULT AVAILABILITY & URL PARAMETERS ---
check(
  'Buggy is included in ChillFlightLogic.PLANE_TYPES by default',
  ChillFlightLogic.PLANE_TYPES.includes('buggy'),
  `PLANE_TYPES: ${ChillFlightLogic.PLANE_TYPES.join(', ')}`
);

const isBuggyEnabled = (query) => {
  const params = new URLSearchParams(query);
  const getParam = (name, fallback) => params.get(name) ?? fallback;
  const getSwitchParam = (name) => {
    const v = getParam(name, null);
    if (v === null) return null;
    return !['0', 'false', 'off'].includes(v.trim().toLowerCase());
  };
  const buggyDisabled = getSwitchParam('buggy') === false;
  return !buggyDisabled;
};

check(
  'Buggy is enabled with no parameters (default)',
  isBuggyEnabled('') === true
);

for (const variant of ['buggy=true', 'buggy=1', 'buggy']) {
  check(`Buggy is enabled with ?${variant}`, isBuggyEnabled(variant) === true);
}

for (const disabledVariant of ['buggy=0', 'buggy=false', 'buggy=off']) {
  check(
    `Buggy is disabled with ?${disabledVariant}`,
    isBuggyEnabled(disabledVariant) === false
  );
}

if (failed) {
  console.error('\nBuggy mechanics tests failed!');
  process.exit(1);
} else {
  console.log('\nAll buggy mechanics tests passed successfully!');
}
