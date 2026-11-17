#!/usr/bin/env node
/**
 * scripts/test-scripted-flight.js
 *
 * Checks the promo clips' scripted attitude (promo-script.js): keyframes hit
 * their values, ease between them, hold after the last one, and convert from
 * degrees to radians.
 */
import {
  attitudeAt,
  cameraAt,
  driveAt,
  scriptedCamera,
  scriptedDrive,
  scriptedFlight,
  scriptedReplay,
  solveStartCoords,
  traceScriptedTrajectory,
} from '../promo-script.js';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {
  buildSegmentQuery,
  resolveLandmarkTarget,
  verifySegmentCorridor,
} from './shorts.js';

console.log(
  'Testing scripted flight, camera, drive, replay, and corridor checks...'
);

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}
const DEG = Math.PI / 180;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

const moves = [
  [0, 0, 0],
  [2, 30, 10],
  [4, 30, 0],
];
const at = (t) => attitudeAt(moves, t);

check(
  'starts at the first keyframe',
  near(at(0).roll, 0) && near(at(0).pitch, 0) && at(0).speed === null
);
check('before the first keyframe holds it', near(at(-3).roll, 0));
check(
  'hits a keyframe exactly',
  near(at(2).roll, 30 * DEG) && near(at(2).pitch, 10 * DEG)
);
check(
  'eases between keyframes (halfway is halfway, slow at the ends)',
  near(at(1).roll, 15 * DEG) && at(0.25).roll < 30 * DEG * 0.25
);
check(
  'holds the last keyframe after the end',
  near(at(9).roll, 30 * DEG) && near(at(9).pitch, 0)
);
check('one keyframe holds', near(attitudeAt([[1, -5, 2]], 0).roll, -5 * DEG));

const flat = [];
for (let t = 0; t <= 4; t += 0.01) flat.push(at(t).roll);
const rising = flat.every((v, i) => i === 0 || v >= flat[i - 1] - 1e-12);
check('a bank rises monotonically between keyframes', rising);
check('gentle maneuvers do not enable loop mode', !at(1).loop);

const clover = [
  [0, 0, 0, 0],
  [1, 0, null, 0],
  [2, -45, null, 45],
  [3, 0, null, 90],
  [4, 0, 360, 90],
];
const cloverAt = (t) => attitudeAt(clover, t);
check(
  'null intermediate channel eases across full span while other channels hit intermediate keyframes',
  cloverAt(2).loop &&
    near(cloverAt(2).roll, -45 * DEG) &&
    near(cloverAt(2).pitch, 180 * DEG) &&
    near(cloverAt(2).yaw, 45 * DEG) &&
    near(cloverAt(4).pitch, 360 * DEG) &&
    near(cloverAt(4).yaw, 90 * DEG)
);

// 5th channel: throttle multiplier + surface/direct flags
const throttleMoves = [
  [0, 0, 0, 0, 0.8],
  [2, 10, 4, 0, null],
  [4, 0, 0, 0, 1.6],
];
const surfFn = scriptedFlight(
  {moves: throttleMoves, surface: true, direct: true},
  1000
);
check(
  '5th channel speed eases smoothly across null intermediate keyframe and honors surface/direct flags',
  near(surfFn(1000).speed, 0.8) &&
    near(surfFn(3000).speed, 1.2) &&
    near(surfFn(5000).speed, 1.6) &&
    surfFn(3000).surface === true &&
    surfFn(3000).loop === true
);

// Scripted camera keyframes: Vertigo dolly-zoom + 360 orbit
const camTrack = [
  [0, 0, 8, 38, null, null, null, 75, 0, 0],
  [4, 0, 14, 114, null, null, null, 27, 360, -10],
];
const camFn = scriptedCamera(camTrack, 500);
const camMid = camFn(2500);
check(
  'cameraAt interpolates offset, fov, and orbit angles while preserving null channels',
  near(cameraAt(camTrack, 0).fov, 75) &&
    near(camMid.oz, 76) &&
    near(camMid.fov, 51) &&
    near(camMid.orbitYaw, 180 * DEG) &&
    near(camMid.orbitPitch, -5 * DEG) &&
    camMid.lx === null &&
    camMid.ly === null &&
    camMid.lz === null
);

// Scripted buggy driving keyframes
const driveTrack = [
  [0, 0, 1.0, 0, 0],
  [2, -0.8, 0.9, 1, 0],
  [3, 0.4, 1.0, 0, 1],
];
const driveFn = scriptedDrive(driveTrack, 0);
check(
  'driveAt interpolates steering/throttle and thresholds slide/hop flags',
  near(driveAt(driveTrack, 1).steer, -0.4) &&
    driveFn(2000).slide === true &&
    driveFn(2000).hop === false &&
    driveFn(3000).hop === true
);

// Deterministic pose replay with shortest-angle wrap across +/-PI
const replayData = {
  fps: 30,
  plane: 'seaplane',
  frames: [
    [0, 100, 42, -200, 0, 179 * DEG, 0, 0.9, 1, 0, 0, 0],
    [1, 160, 48, -260, 0.1, -179 * DEG, -0.2, 1.3, 2, 0.6, 0.2, 1],
  ],
};
const repFn = scriptedReplay(replayData, 1000);
const repMid = repFn(1500);
const wrappedPi = Math.abs(Math.abs(repMid.ry) - Math.PI) < 1e-6;
check(
  'replayAt interpolates position, wraps yaw across +/-PI, and decodes surface flags',
  near(repMid.x, 130) &&
    near(repMid.y, 45) &&
    near(repMid.z, -230) &&
    wrappedPi &&
    near(repMid.speed, 1.1) &&
    near(repMid.gear, 0.5) &&
    repFn(1000).isOnWater === true &&
    repFn(2000).isOnGround === true
);

// Exact trajectory back-solving at an interior hitFrame (including variable 5th-channel speed + loopDip)
const aerobaticWithSpeed = [
  [0, 0, 0, 0, 1.1],
  [2, 45, 35, -18, 1.35],
  [5, 360, -12, -32, 1.5],
];
const targetHit = {tx: 4250, ty: 380, tz: -9120};
const hitFrame = 114;
const exactStart = solveStartCoords({
  ...targetHit,
  headingDeg: 64,
  speedMult: 1.1,
  moves: aerobaticWithSpeed,
  targetFrame: hitFrame,
  prerollSec: 1.5,
  fps: 30,
  loopDip: true,
  round: false,
});
const traced = traceScriptedTrajectory({
  ...exactStart,
  headingDeg: 64,
  speedMult: 1.1,
  moves: aerobaticWithSpeed,
  endFrame: 150,
  prerollSec: 1.5,
  fps: 30,
  loopDip: true,
});
const hitSample = traced.find((s) => s.frame === hitFrame);
check(
  'solveStartCoords + traceScriptedTrajectory hit interior targetFrame exactly with 5th-channel speed and loopDip',
  Boolean(hitSample) &&
    near(hitSample.x, targetHit.tx, 1e-7) &&
    near(hitSample.y, targetHit.ty, 1e-7) &&
    near(hitSample.z, targetHit.tz, 1e-7)
);

// CAM_FRAMES constant and per-segment query overrides
check(
  'ChillFlightLogic exposes all four camera reference frames',
  ['yaw', 'yaw-lock', 'plane', 'world-track'].every((f) =>
    ChillFlightLogic.CAM_FRAMES.includes(f)
  )
);

const mergedQuery = buildSegmentQuery(
  {
    cam: 'plane=biplane&livery=coral&smoke=1&speed=1.15&camOffset=24,8,-48',
    camFrame: 'yaw-lock',
  },
  {
    plane: 'jet',
    livery: 'black',
    style: 'anime',
    camFrame: 'plane',
    gear: true,
    camOffset: [0, 3.2, -1.5],
    extra: 'tod=0.72&cloudMood=busy',
  },
  {x: 100, y: 250, z: -400},
  90,
  1.6,
  20260101
);
const qp = new URLSearchParams(mergedQuery);
check(
  'buildSegmentQuery cleanly overrides clip defaults without duplicate keys',
  qp.get('plane') === 'jet' &&
    qp.get('livery') === 'black' &&
    qp.get('style') === 'anime' &&
    qp.get('camFrame') === 'plane' &&
    qp.get('gear') === '1' &&
    qp.get('speed') === '1.6' &&
    qp.get('camOffset') === '0,3.2,-1.5' &&
    mergedQuery.split('plane=').length === 2
);

// Declarative portal target resolution + corridor verifier (clean warp vs terrain crash)
const eastPortal = resolveLandmarkTarget(20260101, {
  kind: 'portal',
  side: 'east',
});
const portalStart = solveStartCoords({
  tx: eastPortal.tx,
  ty: eastPortal.ty,
  tz: eastPortal.tz,
  headingDeg: eastPortal.heading,
  speedMult: 1.2,
  moves: [[0, 0, 0, 0]],
  targetFrame: 45,
});
const portalCorridor = verifySegmentCorridor({
  seed: 20260101,
  label: 'portal-test',
  ...portalStart,
  headingDeg: eastPortal.heading,
  speedMult: 1.2,
  moves: [[0, 0, 0, 0]],
  startFrame: 0,
  endFrame: 90,
});
check(
  'resolveLandmarkTarget + verifySegmentCorridor thread East->West alien portal cleanly',
  portalCorridor.ok && portalCorridor.portalCrossFrame !== null
);

const crashCorridor = verifySegmentCorridor({
  seed: 20260101,
  label: 'underground-crash',
  x: -5000,
  y: 25,
  z: 5000,
  headingDeg: 0,
  speedMult: 1,
  moves: [[0, 0, 0, 0]],
  startFrame: 0,
  endFrame: 30,
});
check(
  'verifySegmentCorridor catches terrain/water collisions before rendering',
  !crashCorridor.ok && crashCorridor.violations.length > 0
);

console.log(
  failed ? 'Scripted flight test failed' : 'Scripted flight test passed'
);
process.exit(failed ? 1 : 0);
