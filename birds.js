// --- BIRDS RUNTIME UPDATER (GLOBAL INSTANCED POOL) ---
// Animates all active chunk-resident and cross-chunk stray birds each frame
// using the allocation-free state machines in `birds-logic.js` and renders all
// species through a single global `InstancedMesh` pool (zero per-bird Object3D
// hierarchies in the scene graph and ~12-21 instanced draw calls total).
import * as THREE from 'three';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {scene} from './scene.js';
import {state} from './state.js';
import {WIND_DIR_X, WIND_DIR_Z} from './terrain-gen.js';
import {BIRD_SPECIES, computeWingFlap, stepBirdState} from './birds-logic.js';
import {
  BIRD_RIG_LIST,
  birdVertexColorMat,
  getBirdRigIndex,
  writeBirdMatrices,
} from './bird-models.js';
import {
  birdChunks,
  getElevation,
  strayBirds,
  windUniforms,
} from './terrain-geometry.js';
import {performanceMonitor} from './game-performance.js';
import {Achievements} from './achievements.js';
import {precipitation} from './weather-manager.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {whaleSplash} from './particles.js';

// Max squared distance from camera before stray migratory geese despawn (15 km)
const STRAY_MAX_DIST_SQ = 15000 * 15000;
// Max distance from camera at which diving seabirds emit water-splash particles
const SPLASH_VISIBLE_DIST_SQ = 900 * 900;
// Chunk bounding radius around the player aircraft within which startle/wake
// checks run; chunks farther away skip per-bird threat math completely
const CHUNK_THREAT_RADIUS_SQ = 1150 * 1150;
// Initial instance capacity per species rig (doubles automatically on demand)
const INITIAL_RIG_CAPACITY = 128;

const birdInstancedGroup = new THREE.Group();
birdInstancedGroup.name = 'birdsInstanced';
birdInstancedGroup.matrixAutoUpdate = false;
scene.add(birdInstancedGroup);

function makePartInstancedMesh(geo, capacity) {
  const m = new THREE.InstancedMesh(geo, birdVertexColorMat, capacity);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.castShadow = false;
  m.receiveShadow = false;
  m.matrixAutoUpdate = false;
  m.count = 0;
  m.visible = false;
  return m;
}

const _rigBuckets = BIRD_RIG_LIST.map((rig) => {
  const bodyMesh = makePartInstancedMesh(rig.bodyGeo, INITIAL_RIG_CAPACITY);
  const wingRMesh = makePartInstancedMesh(rig.wingRGeo, INITIAL_RIG_CAPACITY);
  const wingLMesh = makePartInstancedMesh(rig.wingLGeo, INITIAL_RIG_CAPACITY);
  birdInstancedGroup.add(bodyMesh, wingRMesh, wingLMesh);
  return {
    rig,
    capacity: INITIAL_RIG_CAPACITY,
    count: 0,
    bodyMesh,
    wingRMesh,
    wingLMesh,
  };
});

function growRigBucket(bucket) {
  const nextCap = bucket.capacity * 2;
  const usedFloats = bucket.count * 16;

  const nextBody = makePartInstancedMesh(bucket.rig.bodyGeo, nextCap);
  const nextWingR = makePartInstancedMesh(bucket.rig.wingRGeo, nextCap);
  const nextWingL = makePartInstancedMesh(bucket.rig.wingLGeo, nextCap);

  nextBody.instanceMatrix.array.set(
    bucket.bodyMesh.instanceMatrix.array.subarray(0, usedFloats)
  );
  nextWingR.instanceMatrix.array.set(
    bucket.wingRMesh.instanceMatrix.array.subarray(0, usedFloats)
  );
  nextWingL.instanceMatrix.array.set(
    bucket.wingLMesh.instanceMatrix.array.subarray(0, usedFloats)
  );

  birdInstancedGroup.remove(
    bucket.bodyMesh,
    bucket.wingRMesh,
    bucket.wingLMesh
  );
  bucket.bodyMesh.dispose();
  bucket.wingRMesh.dispose();
  bucket.wingLMesh.dispose();

  birdInstancedGroup.add(nextBody, nextWingR, nextWingL);
  bucket.bodyMesh = nextBody;
  bucket.wingRMesh = nextWingR;
  bucket.wingLMesh = nextWingL;
  bucket.capacity = nextCap;
}

const _lastPlanePos = new THREE.Vector3();
let _hasLastPlane = false;
const _fallbackFwd = new THREE.Vector3();

const _aircraft = {
  active: false,
  x: 0,
  y: 0,
  z: 0,
  fx: 0,
  fy: 0,
  fz: -1,
  speed: 0,
  isJet: false,
};

const _env = {
  elapsed: 0,
  dayFactor: 1,
  rain: 0,
  windDirX: WIND_DIR_X,
  windDirZ: WIND_DIR_Z,
  windStrength: 1,
  waterLevel: WATER_LEVEL,
  getElev: getElevation,
  aircraft: _aircraft,
  checkAircraft: false,
};

const _pose = {
  x: 0,
  y: 0,
  z: 0,
  pitch: 0,
  yaw: 0,
  bank: 0,
  splash: false,
  visible: true,
};

function updateAircraftSnapshot(delta) {
  const p = planeGroup.position;
  _aircraft.active = !state.isFreeCamera && !state.isCrashed;
  _aircraft.x = p.x;
  _aircraft.y = p.y;
  _aircraft.z = p.z;
  _aircraft.isJet = activePlaneType === 'jet';

  let vx = 0;
  let vy = 0;
  let vz = 0;
  let spd = 0;
  if (_hasLastPlane && delta > 1e-4) {
    const dx = p.x - _lastPlanePos.x;
    const dy = p.y - _lastPlanePos.y;
    const dz = p.z - _lastPlanePos.z;
    const dSq = dx * dx + dy * dy + dz * dz;
    // Ignore teleports (> 350 units in a single frame)
    if (dSq < 350 * 350) {
      vx = dx / delta;
      vy = dy / delta;
      vz = dz / delta;
      spd = Math.sqrt(dSq) / delta;
    }
  }
  _lastPlanePos.copy(p);
  _hasLastPlane = true;

  if (spd > 1.5) {
    _aircraft.fx = vx / spd;
    _aircraft.fy = vy / spd;
    _aircraft.fz = vz / spd;
    _aircraft.speed = spd;
  } else {
    _fallbackFwd.set(0, 0, -1).applyQuaternion(planeGroup.quaternion);
    _aircraft.fx = _fallbackFwd.x;
    _aircraft.fy = _fallbackFwd.y;
    _aircraft.fz = _fallbackFwd.z;
    _aircraft.speed =
      Math.abs(state.flightSpeedMultiplier || 0) * BASE_FLIGHT_SPEED * 60;
  }
}

const _birdDebugStats = {
  visible: 0,
  loaded: 0,
  drawCalls: 0,
};

export function getBirdDebugStats() {
  return _birdDebugStats;
}

export function updateBirds(delta, elapsed, camPos) {
  updateAircraftSnapshot(delta);

  _env.elapsed = elapsed;
  _env.dayFactor = state.dayFactor ?? 1;
  _env.rain = precipitation.rain || 0;
  _env.windStrength = windUniforms.uWindStrength.value;

  const propLod = performanceMonitor.getEffectiveLOD();
  const propLodSq = propLod * propLod;
  const chunkCullDistSq = (propLod + 950) * (propLod + 950);
  const objectsEnabled = Boolean(state._enableObjects);
  const camX = camPos.x;
  const camY = camPos.y;
  const camZ = camPos.z;

  for (let r = 0; r < _rigBuckets.length; r++) {
    _rigBuckets[r].count = 0;
  }

  let loadedCount = 0;
  for (const chunkGroup of birdChunks) {
    const birds = chunkGroup.userData.birds;
    if (!birds || birds.length === 0) continue;
    loadedCount += birds.length;

    const isStrayGroup = chunkGroup === strayBirds;
    const checkPos = chunkGroup.userData.worldPosition || chunkGroup.position;
    const cdx = checkPos.x - camX;
    const cdy = checkPos.y - camY;
    const cdz = checkPos.z - camZ;
    const chunkCamDistSq = cdx * cdx + cdy * cdy + cdz * cdz;

    // Non-stray chunks beyond prop LOD + chunk margin can skip all resident
    // non-goose birds immediately without iterating their state machines
    const chunkBeyondAllLocal =
      !isStrayGroup && chunkCamDistSq > chunkCullDistSq;

    // Spatial early-out for aircraft proximity/wake checks
    let chunkNearPlane = isStrayGroup && _aircraft.active;
    if (!isStrayGroup && _aircraft.active) {
      const pdx = checkPos.x - _aircraft.x;
      const pdz = checkPos.z - _aircraft.z;
      chunkNearPlane = pdx * pdx + pdz * pdz < CHUNK_THREAT_RADIUS_SQ;
    }
    _env.checkAircraft = chunkNearPlane;

    for (let i = 0; i < birds.length; i++) {
      const data = birds[i];
      const isGoose = data.type === 'goose';

      if (!objectsEnabled) {
        data.visible = false;
        if (!isGoose) continue;
      }

      if (chunkBeyondAllLocal && !isGoose) {
        data.visible = false;
        continue;
      }

      const bdx = data.x - camX;
      const bdy = data.y - camY;
      const bdz = data.z - camZ;
      const birdDistSq = bdx * bdx + bdy * bdy + bdz * bdz;

      const spec = BIRD_SPECIES[data.type] || BIRD_SPECIES.seagull;
      const maxDistSq = isGoose
        ? propLodSq
        : Math.min(spec.drawDistSq, propLodSq);

      if (!isGoose && birdDistSq > maxDistSq) {
        data.visible = false;
        continue;
      }

      // Step behavioral state machine & trajectory
      stepBirdState(data, data.x, data.y, data.z, _env, delta, _pose);

      data.x = _pose.x;
      data.y = _pose.y;
      data.z = _pose.z;

      const visibleNow =
        objectsEnabled && _pose.visible && birdDistSq <= maxDistSq;
      data.visible = visibleNow;

      if (visibleNow) {
        const rigIdx =
          data.rigIndex ?? getBirdRigIndex(data.type, data.variant);
        const bucket = _rigBuckets[rigIdx];
        if (bucket.count >= bucket.capacity) {
          growRigBucket(bucket);
        }
        const flap = computeWingFlap(data, elapsed);
        writeBirdMatrices(
          bucket.bodyMesh.instanceMatrix.array,
          bucket.wingRMesh.instanceMatrix.array,
          bucket.wingLMesh.instanceMatrix.array,
          bucket.count,
          _pose.x,
          _pose.y,
          _pose.z,
          _pose.pitch,
          _pose.yaw,
          _pose.bank,
          flap,
          data.scale || 3.5
        );
        bucket.count++;

        // Surface spray puff when a gull or pelican plunge-fishes nearby
        if (_pose.splash && birdDistSq < SPLASH_VISIBLE_DIST_SQ) {
          whaleSplash(_pose.x, _pose.z, data.type === 'pelican' ? 0.36 : 0.24);
        }
      }

      // Achievement check: close pass to a goose ('geese_police')
      if (isGoose && _aircraft.active) {
        const gdx = _pose.x - _aircraft.x;
        const gdy = _pose.y - _aircraft.y;
        const gdz = _pose.z - _aircraft.z;
        if (gdx * gdx + gdy * gdy + gdz * gdz < 625) {
          Achievements.unlock('geese_police');
        }
      }
    }
  }

  birdInstancedGroup.visible = objectsEnabled;
  let visibleTotal = 0;
  let activeDrawCalls = 0;
  for (let r = 0; r < _rigBuckets.length; r++) {
    const b = _rigBuckets[r];
    const c = b.count;
    visibleTotal += c;
    const vis = objectsEnabled && c > 0;
    if (vis) activeDrawCalls += 3;
    b.bodyMesh.count = c;
    b.wingRMesh.count = c;
    b.wingLMesh.count = c;
    b.bodyMesh.visible = vis;
    b.wingRMesh.visible = vis;
    b.wingLMesh.visible = vis;
    if (vis) {
      const floatCount = c * 16;
      b.bodyMesh.instanceMatrix.clearUpdateRanges();
      b.bodyMesh.instanceMatrix.addUpdateRange(0, floatCount);
      b.bodyMesh.instanceMatrix.needsUpdate = true;

      b.wingRMesh.instanceMatrix.clearUpdateRanges();
      b.wingRMesh.instanceMatrix.addUpdateRange(0, floatCount);
      b.wingRMesh.instanceMatrix.needsUpdate = true;

      b.wingLMesh.instanceMatrix.clearUpdateRanges();
      b.wingLMesh.instanceMatrix.addUpdateRange(0, floatCount);
      b.wingLMesh.instanceMatrix.needsUpdate = true;
    }
  }
  _birdDebugStats.visible = visibleTotal;
  _birdDebugStats.loaded = loadedCount;
  _birdDebugStats.drawCalls = activeDrawCalls;

  // Prune stray geese once they fly more than 15 km from the camera
  const strays = strayBirds.userData.birds;
  for (let i = strays.length - 1; i >= 0; i--) {
    const sb = strays[i];
    const sdx = sb.x - camX;
    const sdy = sb.y - camY;
    const sdz = sb.z - camZ;
    if (sdx * sdx + sdy * sdy + sdz * sdz > STRAY_MAX_DIST_SQ) {
      strays.splice(i, 1);
    }
  }
}
