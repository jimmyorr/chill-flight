// --- CRASH DETECTION, WRECK TUMBLE & CAMERA RECOVERY ---
// Forgives casual scrapes and bumps, but detects when the player genuinely
// crashes (crash-logic.js has the heuristics and camera maths):
// 1. High-speed nose-first impact into a steep cliff (wall-scrape.js)
// 2. Steep nose-dive or high-speed stall-plummet into the ground or water
//    (flight-physics.js)
// 3. Sustained grinding into a wall or plowing through several buildings in a
//    row before the short-window strain fades (wall-scrape.js, breakables.js)
//
// On a crash:
// - The plane breaks into tumbling pieces that scatter and bounce on the
//   ground or splash into the water, with sparks, smoke puffs, a crunch and
//   camera shake.
// - Act 1 (0 .. 1.35 s): the camera pulls back and orbits around the wreck.
// - Act 2 (1.35 .. 2.3 s): the plane respawns 120 units overhead in clear air
//   facing downhill away from any cliff, and the camera tilts up and arcs
//   smoothly into the chase view behind it.
import * as THREE from 'three';
import {state} from './state.js';
import {scene} from './scene.js';
import {camera} from './sky.js';
import {WATER_LEVEL} from './constants.js';
import {sampleGround} from './terrain-geometry.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {playSmash, playSplash} from './sfx-events.js';
import {smashHaptic} from './haptics.js';
import {propPuffs, scrapeSparks} from './particles.js';
import {hooks} from './hooks.js';
import {
  CRASH,
  addPropHitStrain,
  addWallScrapeStrain,
  crashCameraShot,
  crashRespawnPose,
  isDiveImpactCrash,
  isWallImpactCrash,
  newCrashState,
  stepCrashState,
  stepWreckPiece,
} from './crash-logic.js';

const crashState = newCrashState();
let lastX = NaN;
let lastY = NaN;
let lastZ = NaN;
const TELEPORT_DISTANCE = 100;

const SMOKE_DARK = new THREE.Color(0.32, 0.3, 0.28);
const DUST_LIGHT = new THREE.Color(0.76, 0.72, 0.65);
const SPRAY_WHITE = new THREE.Color(0.9, 0.95, 1.0);

const _ground = {height: 0, slopeX: 0, slopeZ: 0};
const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _m0 = new THREE.Matrix4();
const _shotChase = {
  camX: 0,
  camY: 0,
  camZ: 0,
  lookX: 0,
  lookY: 0,
  lookZ: 0,
};

// Active crash sequence, or null when flying normally
let seq = null;
const wreckPieces = [];

function clearWreckPieces() {
  for (const piece of wreckPieces) {
    scene.remove(piece.mesh);
  }
  wreckPieces.length = 0;
}

function endCrashSequence() {
  clearWreckPieces();
  if (state.airplaneModel) state.airplaneModel.visible = true;
  state.isCrashed = false;
  seq = null;
}

function resetCrashState() {
  crashState.strain = 0;
  crashState.cooldown = 0;
  if (seq) endCrashSequence();
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

// Clones the plane's visible parts at its current world pose into tumbling
// wreck pieces that fly apart and bounce on the ground or water
function spawnPlaneWreck(wreckPos, heading) {
  clearWreckPieces();
  const model = state.airplaneModel;
  if (!model) return;
  planeGroup.updateMatrixWorld(true);
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);

  for (const child of model.children) {
    if (!child.visible) continue;
    const clone = child.clone();
    clone.matrixAutoUpdate = false;
    const m0 = child.matrixWorld.toArray([]);
    clone.matrix.fromArray(m0);
    scene.add(clone);

    _box.setFromObject(child);
    if (_box.isEmpty()) _center.copy(wreckPos);
    else _box.getCenter(_center);

    let ox = _center.x - wreckPos.x;
    let oz = _center.z - wreckPos.z;
    const olen = Math.hypot(ox, oz);
    if (olen > 0.2) {
      ox /= olen;
      oz /= olen;
    } else {
      const a = Math.random() * Math.PI * 2;
      ox = Math.cos(a);
      oz = Math.sin(a);
    }
    const outSpeed = rand(10, 28);
    const fwdSpeed = rand(-8, 18);
    const vx = ox * outSpeed + fx * fwdSpeed;
    const vy = rand(14, 34);
    const vz = oz * outSpeed + fz * fwdSpeed;

    sampleGround(_center.x + vx * 0.4, _center.z + vz * 0.4, _ground);
    const rest = Math.max(WATER_LEVEL, _ground.height) + 0.6;
    const axis = new THREE.Vector3(
      rand(-1, 1),
      rand(-0.6, 0.6),
      rand(-1, 1)
    ).normalize();

    wreckPieces.push({
      mesh: clone,
      m0,
      from: _center.clone(),
      x: _center.x,
      y: _center.y,
      z: _center.z,
      vx,
      vy,
      vz,
      axis,
      angle: 0,
      spin: rand(2.5, 6.5),
      rest,
    });
  }
}

function stepWreckPieces(dt) {
  for (const p of wreckPieces) {
    stepWreckPiece(p, dt);
    _m.makeTranslation(p.x, p.y, p.z);
    _m.multiply(_r.makeRotationAxis(p.axis, p.angle));
    _m.multiply(_t.makeTranslation(-p.from.x, -p.from.y, -p.from.z));
    _m.multiply(_m0.fromArray(p.m0));
    p.mesh.matrix.copy(_m);
  }
}

function triggerCrash() {
  if (crashState.cooldown > 0 || seq) return false;
  crashState.strain = 0;
  crashState.cooldown = CRASH.DURATION + CRASH.COOLDOWN;

  const pos = planeGroup.position;
  const heading = planeGroup.rotation.y;
  sampleGround(pos.x, pos.z, _ground);
  const overWater = _ground.height <= WATER_LEVEL + 0.5;
  const surfaceY = Math.max(WATER_LEVEL, _ground.height);
  const wreckPos = {
    x: pos.x,
    y: Math.max(surfaceY, pos.y),
    z: pos.z,
  };

  // Spawn tumbling plane pieces and hide the intact model during Act 1
  spawnPlaneWreck(wreckPos, heading);
  if (state.airplaneModel) state.airplaneModel.visible = false;

  // Sparks, smoke/dust or water spray, crunch and camera jolt
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  scrapeSparks(wreckPos.x, wreckPos.y, wreckPos.z, -fx, -fz, -fx, -fz, 120, 45);
  if (overWater) {
    propPuffs(wreckPos.x, WATER_LEVEL, wreckPos.z, 8, 5, SPRAY_WHITE, 32, 7, 7);
    playSplash(1);
  } else {
    propPuffs(wreckPos.x, wreckPos.y, wreckPos.z, 7, 5, DUST_LIGHT, 26, 8, 5);
  }
  propPuffs(wreckPos.x, wreckPos.y + 1, wreckPos.z, 5, 4, SMOKE_DARK, 18, 7, 6);
  playSmash(true, 1, 0);
  smashHaptic(true);
  state.impactShake = Math.max(state.impactShake || 0, 2.5);

  // Stop the plane at the crash site for Act 1 while the camera orbits
  const respawn = crashRespawnPose(pos.x, pos.z, heading, _ground, WATER_LEVEL);
  state.flightSpeedMultiplier = 0;
  state.verticalVelocity = 0;
  state.isOnGround = false;
  state.isOnWater = false;
  state.isLooping = false;
  state.isDoingImmelmann = false;
  state.isBarrelRolling = false;
  state.isSteepPitch = false;
  state.bumpRoll = 0;
  state.isCrashed = true;

  // Start the orbit from the camera's current bearing around the wreck,
  // swinging whichever way the camera is already offset
  const camDx = camera.position.x - wreckPos.x;
  const camDz = camera.position.z - wreckPos.z;
  const startAngle = Math.atan2(camDx, camDz);
  const cross = camDx * fz - camDz * fx;
  const dir = cross >= 0 ? 1 : -1;

  seq = {
    t: 0,
    planeType: activePlaneType,
    wreck: wreckPos,
    respawn,
    placed: false,
    startAngle,
    dir,
  };
  return true;
}

/**
 * Applies the two-act crash camera choreography in flight-camera.js when a
 * crash sequence is active. Returns true while active.
 */
export function applyCrashCamera(
  activeCamTarget,
  currentLookTarget,
  idealPos,
  idealLook
) {
  if (!seq) return false;
  _shotChase.camX = idealPos.x;
  _shotChase.camY = idealPos.y;
  _shotChase.camZ = idealPos.z;
  _shotChase.lookX = idealLook.x;
  _shotChase.lookY = idealLook.y;
  _shotChase.lookZ = idealLook.z;

  const shot = crashCameraShot({
    t: seq.t,
    wreck: seq.wreck,
    startAngle: seq.startAngle,
    dir: seq.dir,
    chase: _shotChase,
  });
  sampleGround(shot.pos.x, shot.pos.z, _ground);
  const minSurfaceY = Math.max(WATER_LEVEL, _ground.height) + 4;
  const jolt = state.impactShake || 0;
  const jx = jolt > 0 ? (Math.random() - 0.5) * jolt : 0;
  const jy = jolt > 0 ? (Math.random() - 0.5) * jolt : 0;
  activeCamTarget.position.set(
    shot.pos.x + jx,
    Math.max(minSurfaceY, shot.pos.y) + jy,
    shot.pos.z
  );
  currentLookTarget.set(shot.look.x, shot.look.y, shot.look.z);
  return true;
}

/** Called once per frame from game-loop.js. */
export function updateCrash(delta) {
  const p = planeGroup.position;
  if (
    Number.isFinite(lastX) &&
    Math.hypot(p.x - lastX, p.y - lastY, p.z - lastZ) > TELEPORT_DISTANCE
  ) {
    resetCrashState();
  }
  lastX = p.x;
  lastY = p.y;
  lastZ = p.z;

  if (seq) {
    if (activePlaneType !== seq.planeType || state.isFreeCamera) {
      resetCrashState();
      return;
    }
    seq.t += delta;
    stepWreckPieces(delta);

    // Entering Act 2: place the fresh plane overhead in clear air so the
    // camera can arc smoothly up into the chase view behind it
    if (!seq.placed && seq.t >= CRASH.ORBIT_SECONDS) {
      seq.placed = true;
      const r = seq.respawn;
      planeGroup.position.set(r.x, r.y, r.z);
      planeGroup.rotation.set(0, r.heading, 0, 'YXZ');
      state._nextYaw = r.heading;
      state.targetPitch = 0;
      state.targetRoll = 0;
      state.manualPitch = 0;
      if (state.airplaneModel) {
        state.airplaneModel.position.set(0, 0, 0);
        state.airplaneModel.rotation.set(0, 0, 0);
        state.airplaneModel.visible = true;
      }
      if (state.previousPosition) {
        state.previousPosition.copy(planeGroup.position);
      }
      lastX = r.x;
      lastY = r.y;
      lastZ = r.z;
    }

    // End of Act 2: hand controls back at cruise speed
    if (seq.t >= CRASH.DURATION) {
      const r = seq.respawn;
      state.flightSpeedMultiplier = r.speed;
      state.targetFlightSpeed = Math.max(state.targetFlightSpeed, r.speed);
      endCrashSequence();
    }
    return;
  }

  if (
    activePlaneType === 'buggy' ||
    state.isFreeCamera ||
    state.isOnGround ||
    state.isOnWater
  ) {
    crashState.strain = 0;
  }
  stepCrashState(crashState, delta);
}

/**
 * Checks a wall contact frame from wall-scrape.js (Heuristic 1: hard head-on
 * cliff impact, and Heuristic 3a: sustained wall-grinding strain).
 */
export function checkWallCrash({heading, nose, headOn, intoWall, kts, delta}) {
  if (activePlaneType === 'buggy' || state.isFreeCamera || state.isCrashed) {
    return false;
  }
  if (nose && isWallImpactCrash(heading, nose.nx, nose.nz, nose.slope, kts)) {
    return triggerCrash();
  }
  if (addWallScrapeStrain(crashState, headOn, intoWall, kts, delta)) {
    return triggerCrash();
  }
  return false;
}

/**
 * Checks a ground or water impact from flight-physics.js (Heuristic 2: steep
 * nose-dive or high-speed stall-plummet).
 */
export function checkDiveCrash(pitch, kts, verticalVelocity) {
  if (activePlaneType === 'buggy' || state.isFreeCamera || state.isCrashed) {
    return false;
  }
  if (isDiveImpactCrash(pitch, kts, verticalVelocity)) {
    return triggerCrash();
  }
  return false;
}
hooks.checkDiveCrash = checkDiveCrash;

/**
 * Records a prop smash ('house', 'tree', 'snowman') from breakables.js while
 * flying (Heuristic 3b: smashing through multiple buildings/trees in a row).
 */
export function recordPropCrashStrain(kind, kts, buggy) {
  if (
    buggy ||
    state.isFreeCamera ||
    state.isOnGround ||
    state.isOnWater ||
    state.isCrashed
  ) {
    return false;
  }
  if (addPropHitStrain(crashState, kind, kts)) {
    return triggerCrash();
  }
  return false;
}
