#!/usr/bin/env node
/**
 * scripts/test-scripted-flight.js
 *
 * Checks the promo clips' scripted attitude (promo-script.js): keyframes hit
 * their values, ease between them, hold after the last one, and convert from
 * degrees to radians.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  attitudeAt,
  cameraAt,
  driveAt,
  pilotAt,
  scriptedCamera,
  scriptedDrive,
  scriptedFlight,
  scriptedPilot,
  scriptedReplay,
  solveStartCoords,
  traceScriptedTrajectory,
} from '../promo-script.js';
import {simulatePilotTrajectory, solvePilotStartCoords} from './pilot-sim.js';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {
  SHORT_BADGE_TOP_PX,
  buildSegmentQuery,
  resolveLandmarkTarget,
  verifySegmentCorridor,
  writeShortMetadata,
} from './shorts.js';
import {
  DEFAULT_COMMENT_CTA,
  DEFAULT_RELATED_VIDEO,
  buildDefaultPinnedComment,
  extractYouTubeVideoId,
  parseRelatedVideoSpec,
  parseShortMetadataFile,
  pickBestRelatedCardIndex,
  pickPinMenuItemIndex,
  resolvePinnedComment,
  resolveRelatedVideo,
} from './post-short.js';
import {canReuseTab} from './dev-browser.js';

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

// YouTube Short "Related video" metadata, URL/ID parsing, and picker matching
check(
  'extractYouTubeVideoId handles watch, youtu.be, shorts, studio, and bare 11-char IDs',
  extractYouTubeVideoId('https://www.youtube.com/watch?v=H4NvDp-tQb4&t=12s') ===
    'H4NvDp-tQb4' &&
    extractYouTubeVideoId('https://youtu.be/S71d0JFVuM8') === 'S71d0JFVuM8' &&
    extractYouTubeVideoId('https://youtube.com/shorts/9TxYMm-RhbI') ===
      '9TxYMm-RhbI' &&
    extractYouTubeVideoId(
      'https://studio.youtube.com/video/AbCdEfGh123/edit'
    ) === 'AbCdEfGh123' &&
    extractYouTubeVideoId('AbCdEfGh123') === 'AbCdEfGh123' &&
    extractYouTubeVideoId(DEFAULT_RELATED_VIDEO) === null
);

const defaultSpec = parseRelatedVideoSpec(DEFAULT_RELATED_VIDEO);
const urlSpec = parseRelatedVideoSpec('https://youtu.be/H4NvDp-tQb4');
check(
  'parseRelatedVideoSpec distinguishes title queries, video URLs, and none/off',
  defaultSpec?.query === DEFAULT_RELATED_VIDEO &&
    defaultSpec?.videoId === null &&
    urlSpec?.videoId === 'H4NvDp-tQb4' &&
    urlSpec?.query === '' &&
    parseRelatedVideoSpec('none') === null &&
    parseRelatedVideoSpec('off') === null
);

const mockCards = [
  {
    videoId: '9TxYMm-RhbI',
    title: '9 months of building Chill Flight (Short clip)',
    text: '9 months of building Chill Flight (Short clip)\n0:12',
  },
  {
    videoId: 'Evo9MoVideo',
    title: '9 months of building Chill Flight: from prototype to v1.2.12',
    text: '9 months of building Chill Flight: from prototype to v1.2.12\n3:19',
  },
  {
    videoId: 'TrailerVid1',
    title: 'Chill Flight Official Trailer',
    text: 'Chill Flight Official Trailer\n1:15',
  },
];
check(
  'pickBestRelatedCardIndex matches prefix title, exact videoId, and excludes current Short',
  pickBestRelatedCardIndex(mockCards, defaultSpec, '9TxYMm-RhbI') === 1 &&
    pickBestRelatedCardIndex(
      mockCards,
      parseRelatedVideoSpec('https://youtu.be/TrailerVid1'),
      '9TxYMm-RhbI'
    ) === 2 &&
    pickBestRelatedCardIndex(
      mockCards,
      parseRelatedVideoSpec('Nonexistent Video Title'),
      '9TxYMm-RhbI'
    ) === -1
);

check(
  'SHORT_BADGE_TOP_PX places top pill inside Shorts ~15% safe zone on 540x960 CSS viewport',
  SHORT_BADGE_TOP_PX === 140 &&
    SHORT_BADGE_TOP_PX / 960 >= 0.14 &&
    SHORT_BADGE_TOP_PX / 960 <= 0.16
);

check(
  'pickPinMenuItemIndex matches Pin / Pin comment and ignores Unpin / Delete / Report',
  pickPinMenuItemIndex([{text: 'Edit'}, {text: 'Delete'}, {text: 'Pin'}]) ===
    2 &&
    pickPinMenuItemIndex([{text: 'Unpin'}, {text: 'Pin comment'}]) === 1 &&
    pickPinMenuItemIndex([{text: 'Unpin'}, {text: 'Report'}]) === -1
);

const tmpMetaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-short-meta-'));
try {
  const sampleMp4 = path.join(tmpMetaDir, 'short-test.mp4');
  const sampleTxt = path.join(tmpMetaDir, 'short-test.txt');
  writeShortMetadata(sampleMp4, {
    title: 'Test Short across 4 biomes (Play free: chillflight.app)',
    tiktokQuestion: 'Which biome should I add next?',
    stops: ['0:00 Twin Falls (0.9°N, 0.0°E)'],
    trackTitle: 'Sky Lake',
  });
  const parsedNew = parseShortMetadataFile(sampleTxt);
  check(
    'writeShortMetadata + parseShortMetadataFile keep YouTube Title punchy (no URL suffix) and round-trip Related video + Pinned comment',
    parsedNew.youtube.title === 'Test Short across 4 biomes' &&
      !parsedNew.youtube.title.includes('chillflight.app') &&
      parsedNew.youtube.relatedVideo === DEFAULT_RELATED_VIDEO &&
      parsedNew.youtube.pinnedComment ===
        buildDefaultPinnedComment({
          tiktokQuestion: 'Which biome should I add next?',
        }) &&
      parsedNew.youtube.pinnedComment.includes(DEFAULT_COMMENT_CTA) &&
      !parsedNew.youtube.description.includes('Related video:') &&
      !parsedNew.youtube.description.includes('Pinned comment:') &&
      parsedNew.youtube.description.startsWith(
        'Play Chill Flight free in your browser'
      )
  );

  // Multi-line custom Pinned comment round-trip
  const multiCommentMp4 = path.join(tmpMetaDir, 'short-multi.mp4');
  const multiCommentTxt = path.join(tmpMetaDir, 'short-multi.txt');
  writeShortMetadata(multiCommentMp4, {
    title: 'Wingtip cam through a sea arch ✈️',
    pinnedComment:
      'Did you spot the dragon skeleton?\nPlay free at chillflight.app or search "Chill Flight" on the iOS App Store!',
    trackTitle: 'Sky Lake',
  });
  const parsedMulti = parseShortMetadataFile(multiCommentTxt);
  check(
    'parseShortMetadataFile preserves multi-line Pinned comment blocks cleanly',
    parsedMulti.youtube.pinnedComment ===
      'Did you spot the dragon skeleton?\nPlay free at chillflight.app or search "Chill Flight" on the iOS App Store!'
  );

  // Legacy .txt without "Related video:" or "Pinned comment:" still falls back cleanly
  const legacyTxt = path.join(tmpMetaDir, 'legacy.txt');
  fs.writeFileSync(
    legacyTxt,
    [
      '=== YouTube Shorts ===',
      'Title:',
      'Legacy Short (Play free: chillflight.app)',
      '',
      'Description:',
      'Play Chill Flight free!',
      '',
      '=== TikTok ===',
      'Caption:',
      'Legacy Short Play free at chillflight.app',
      'Spot the dragon skeleton?',
      '#chillflight',
    ].join('\n')
  );
  const parsedLegacy = parseShortMetadataFile(legacyTxt);
  check(
    'resolveRelatedVideo and resolvePinnedComment handle legacy .txt fallbacks and CLI overrides',
    parsedLegacy.youtube.relatedVideo === null &&
      parsedLegacy.youtube.pinnedComment === null &&
      resolveRelatedVideo({}, parsedLegacy, '')?.raw ===
        DEFAULT_RELATED_VIDEO &&
      resolveRelatedVideo({related: 'Chill Flight Official Trailer'}, parsedNew)
        ?.raw === 'Chill Flight Official Trailer' &&
      resolveRelatedVideo({related: 'none'}, parsedNew) === null &&
      resolvePinnedComment({}, parsedLegacy, '') ===
        buildDefaultPinnedComment({question: 'Spot the dragon skeleton?'}) &&
      resolvePinnedComment({comment: 'Custom hook!'}, parsedNew, '') ===
        'Custom hook!' &&
      resolvePinnedComment({comment: 'none'}, parsedNew, '') === null
  );
} finally {
  fs.rmSync(tmpMetaDir, {recursive: true, force: true});
}

// In-tab warp eligibility (dev-browser.js canReuseTab, #185)
check(
  'canReuseTab allows warping across position, camera, tod, clouds, weather, and plane within one world',
  canReuseTab(
    'seed=20260928&x=0&y=413&z=0&tod=0.614&clouds=0.2&freecam=true',
    'seed=20260928&x=-9000&y=250&z=8000&heading=180&tod=0.735&clouds=0.45&weather=rain&plane=jet&freecam=true'
  ) &&
    canReuseTab(
      'preset=mid&islandType=volcanic&x=0&z=0',
      'graphics=mid&island=volcanic&camX=100&camY=200&camZ=300'
    )
);
check(
  'canReuseTab forces a fresh navigation when seed, preset, style, xmas, or objects change',
  !canReuseTab('seed=20260928&x=0&z=0', 'seed=20260929&x=0&z=0') &&
    !canReuseTab('seed=20260928&preset=mid', 'seed=20260928&preset=ultra') &&
    !canReuseTab('seed=20260928', 'seed=20260928&style=anime') &&
    !canReuseTab('seed=20260928', 'seed=20260928&xmas=full') &&
    !canReuseTab('seed=20260928', 'seed=20260928&objects=0')
);

// Monotone cubic Hermite spline keeps smooth non-zero angular velocity across interior keyframes
const multiKeyRoll = [
  [0, 0, 0],
  [1, 90, 0],
  [2, 270, 0],
  [3, 360, 0],
];
const eps = 1e-4;
const velAt1 =
  (attitudeAt(multiKeyRoll, 1 + eps).roll -
    attitudeAt(multiKeyRoll, 1 - eps).roll) /
  (2 * eps);
const velAt2 =
  (attitudeAt(multiKeyRoll, 2 + eps).roll -
    attitudeAt(multiKeyRoll, 2 - eps).roll) /
  (2 * eps);
const multiSamples = [];
for (let t = 0; t <= 3; t += 0.02) {
  multiSamples.push(attitudeAt(multiKeyRoll, t).roll);
}
const multiMonotonic = multiSamples.every(
  (v, i) =>
    v >= -1e-12 &&
    v <= 360 * DEG + 1e-12 &&
    (i === 0 || v >= multiSamples[i - 1] - 1e-12)
);
check(
  'monotone cubic Hermite spline maintains continuous non-zero velocity through interior roll keyframes without overshoot',
  near(attitudeAt(multiKeyRoll, 1).roll, 90 * DEG) &&
    near(attitudeAt(multiKeyRoll, 2).roll, 270 * DEG) &&
    velAt1 > 90 * DEG &&
    velAt2 > 90 * DEG &&
    multiMonotonic
);

// Virtual human pilot (pilotAt + scriptedPilot + simulatePilotTrajectory + solvePilotStartCoords)
const samplePilot = {
  stick: [
    [0.0, 0, 0, 1.2],
    [1.2, -0.45, 0.08, null],
    [2.4, 0, 0, 1.3],
    [5.8, 0.35, -0.05, 1.3],
    [7.5, 0, 0, 1.2],
  ],
  stunts: [[2.6, 4.7, 'roll-right']],
};
const pFn = scriptedPilot(samplePilot, 1000);
check(
  'pilotAt + scriptedPilot interpolate stick/throttle and activate held stunts cleanly',
  pilotAt(samplePilot, -0.5).stunt === null &&
    pFn(500).steerX === 0 &&
    pFn(2200).steerX < -0.4 &&
    pFn(3800).stunt === 'roll-right' &&
    pFn(6000).stunt === null
);

const pilotSim = simulatePilotTrajectory({
  planeType: 'biplane',
  x: 0,
  y: 450,
  z: 0,
  headingDeg: 35,
  speedMult: 1.2,
  pilotMoves: samplePilot,
  endFrame: 225, // 7.5s at 30 fps
  prerollSec: 1.5,
  fps: 30,
});
// Check constant non-staggered roll rate during held barrel roll (frames 90..138 => t = 3.0s..4.6s)
const prerollOffset = 45;
let minMidRollRate = Infinity;
for (let f = 90; f <= 138; f++) {
  const s0 = pilotSim[prerollOffset + f - 1];
  const s1 = pilotSim[prerollOffset + f];
  const rate = Math.abs(s1.roll - s0.roll) * 30;
  if (rate < minMidRollRate) minMidRollRate = rate;
}
const endSample = pilotSim[pilotSim.length - 1];
const endWrappedRoll =
  endSample.roll - Math.PI * 2 * Math.round(endSample.roll / (Math.PI * 2));
check(
  'simulatePilotTrajectory flies a smooth constant-rate barrel roll (>2.4 rad/s) and settles back near wings-level',
  minMidRollRate > 2.4 && Math.abs(endWrappedRoll) < 8 * DEG
);

const archTarget = {tx: 3100, ty: 280, tz: -6400};
const archHeading = 128;
const archHitFrame = 54;
const solvedPilotStart = solvePilotStartCoords({
  planeType: 'biplane',
  ...archTarget,
  headingDeg: archHeading,
  speedMult: 1.2,
  pilotMoves: samplePilot,
  targetFrame: archHitFrame,
  prerollSec: 1.5,
  fps: 30,
  alignHeading: true,
  round: false,
});
const verifyPilotTrace = simulatePilotTrajectory({
  planeType: 'biplane',
  x: solvedPilotStart.x,
  y: solvedPilotStart.y,
  z: solvedPilotStart.z,
  headingDeg: solvedPilotStart.headingDeg,
  speedMult: 1.2,
  pilotMoves: samplePilot,
  endFrame: 90,
  prerollSec: 1.5,
  fps: 30,
});
const pilotHit = verifyPilotTrace.find((s) => s.frame === archHitFrame);
check(
  'solvePilotStartCoords hits target (tx, ty, tz) and aligns curved approach heading at targetFrame',
  Boolean(pilotHit) &&
    near(pilotHit.x, archTarget.tx, 1e-6) &&
    near(pilotHit.y, archTarget.ty, 1e-6) &&
    near(pilotHit.z, archTarget.tz, 1e-6) &&
    near(pilotHit.yaw, archHeading * DEG, 1e-6)
);

console.log(
  failed ? 'Scripted flight test failed' : 'Scripted flight test passed'
);
process.exit(failed ? 1 : 0);
