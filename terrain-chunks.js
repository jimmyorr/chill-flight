// --- GLOBAL INSTANCING ARCHITECTURE ---
import * as THREE from 'three';
import {scene} from './scene.js';
import {
  BRIDGE_SEGMENT_LENGTH,
  ModelAssembler,
  VOLCANO_X,
  VOLCANO_Z,
  _terrainGeometryPool,
  _waterGeometryPool,
  assembleHawk,
  assembleSeagull,
  barnBodyGeo,
  barnBodyMat,
  barnDoorGeo,
  barnRoofGeo,
  barnRoofMat,
  barnSiloBodyGeo,
  barnSiloMat,
  barnSiloRoofGeo,
  barnSiloRoofMat,
  barnTrimGeo,
  barnWhiteMat,
  birdChunks,
  boatBoomGeo,
  boatDeckGeo,
  boatDeckMat,
  boatHullGeo,
  boatHullPalette,
  boatMastGeo,
  boatRimGeo,
  boatRimMat,
  boatSailGeo,
  boatSailMat,
  bridgeDeckGeo,
  bridgeDeckMat,
  bridgeGirderGeo,
  bridgeGirderMat,
  bridgePierCapGeo,
  bridgePierFootingGeo,
  bridgePierShaftGeo,
  bridgePilingMat,
  bridgeRailGeo,
  bushBaseMat,
  bushGeo,
  cactusGeo,
  cactusMat,
  castleRuinsGeo,
  castleRuinsMat,
  chunkQueueSet,
  chunks,
  createRockArchGeometries,
  deadTreeGeo,
  deadTreeMat,
  deciduousGeos,
  desertRockMat,
  fireCoreGeo,
  fireLogGeo,
  fireMat,
  getElevation,
  getInstancedMesh,
  gooseBeakGeo,
  gooseBlackMat,
  gooseBodyGeo,
  gooseBrownMat,
  gooseCheekGeo,
  gooseHeadGeo,
  gooseNeckGeo,
  gooseTailGeo,
  gooseWhiteMat,
  gooseWhiteTailGeo,
  gooseWingGeo,
  houseBodyGeo,
  houseBodyPalette,
  houseChimneyGeo,
  houseChimneyMat,
  houseDoorGeo,
  houseDoorMat,
  houseRoofGeo,
  houseRoofPalette,
  houseWindowGeo,
  houseWindowMats,
  iceFloeMainGeo,
  icebergMainGeo,
  icebergMat,
  japaneseMapleGeos,
  lighthouseBeamMat,
  lilyPadGeo,
  lilyPadMat,
  monasteryBodyGeo,
  monasteryBodyMat,
  monasteryRoofGeo,
  monasteryRoofMat,
  mushroomGeos,
  mushroomStalkMat,
  pagodaBodyGeo,
  pagodaBodyMat,
  pagodaRoofGeo,
  pagodaRoofMat,
  palmGeos,
  penguinBeakGeo,
  penguinBellyGeo,
  penguinBlackMat,
  penguinBodyGeo,
  penguinFootLGeo,
  penguinFootRGeo,
  penguinHeadGeo,
  penguinOrangeMat,
  penguinWhiteMat,
  penguinWingLGeo,
  penguinWingRGeo,
  persistentLighthouseBeam,
  persistentLighthouseLight,
  pierDeckGeo,
  pierPostGeo,
  pirateDeckGeo,
  pirateFlagGeo,
  pirateFlagMat,
  pirateHullGeo,
  pirateHullMat,
  pirateJollyRogerGeo,
  pirateJollyRogerMat,
  pirateMastGeo,
  pirateRimGeo,
  pirateRimMat,
  pirateSailGeo,
  pirateSailPalette,
  pirateShipReflectionGeo,
  reflectionMat,
  releaseInstancedMesh,
  resetChunkQueue,
  rockArchGrassMat,
  rockGeo,
  rockMat,
  sailboatReflectionGeo,
  smokeGeo,
  smokeMat,
  snowRockMat,
  snowmanBodyMat,
  snowmanGeos,
  snowmanNoseMat,
  strawHutBodyGeo,
  strawHutMat,
  strawHutRoofGeo,
  streetlightArmGeo,
  streetlightBulbGeo,
  streetlightBulbMat,
  streetlightDecalGeo,
  streetlightDecalMat,
  streetlightPoleGeo,
  streetlightPoleMat,
  tallDeciduousGeos,
  tentEntranceGeo,
  tentEntranceMat,
  tentGeo,
  tentPalette,
  tentPolesGeo,
  terrainMaterial,
  treeLeavesBaseMat,
  treeLeavesGeo,
  treeTrunkGeo,
  treeTrunkMat,
  twoStoryBodyGeo,
  twoStoryChimneyGeo,
  twoStoryRoofGeo,
  useInstancedDepthMaterial,
  waterMaterial,
  watercraftChunks,
  whiteSmokeMat,
  windmillBaseGeo,
  windmillBaseMat,
  windmillBladesDepthMat,
  windmillBladesGeo,
  windmillBladesMat,
  woodMat,
  yAxis,
} from './terrain-geometry.js';
import {
  CHUNK_SIZE,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  MOUNTAIN_LEVEL,
  WATER_LEVEL,
  updateUrlParams,
} from './constants.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {log} from './logger.js';
import {simplex} from './noise.js';
import {camera} from './sky.js';
import {planeGroup} from './airplane.js';
import {terrainWorkerManager} from './terrain-worker-manager.js';
import {generateChunkData} from './terrain-gen.js';
import {state} from './state.js';
import {performanceMonitor} from './game-performance.js';

// Trees and other world-wide props are instanced per type, in tiles of
// TREE_TILE_CHUNKS x TREE_TILE_CHUNKS chunks so three.js can skip tiles outside
// the view (one mesh per type for the whole world can't be culled). Bigger
// tiles mean fewer draw calls but coarser culling.
const TREE_TILE_CHUNKS = 4;
const TREE_TILE_SIZE = TREE_TILE_CHUNKS * CHUNK_SIZE;
// A chunk joins the tile containing its center, so a tile's instances reach
// half a chunk past its edges. The sphere (centered at y = 800) covers those
// corners from sea level to the highest peaks (~1,600), plus a margin.
const TREE_TILE_CULL_RADIUS =
  Math.hypot(((TREE_TILE_SIZE + CHUNK_SIZE) / 2) * Math.SQRT2, 800) + 200;

// The tiles don't cast shadows: that would draw every tree within draw
// distance (~10 km) into the shadow map, though the sun's shadow volume only
// reaches ~4,500 units from the plane, even at low sun. Instead a shadow-only
// mesh per type holds just the chunks within this radius of the plane (+1
// chunk for flying between rebuilds).
const TREE_SHADOW_CHUNK_RADIUS = 4;

// Beyond this many chunks (~4.5 km) from the plane, types with a far version
// (see setFarGeometry below) swap to it: a 5-unit bush or a tree canopy is a
// pixel or two across at that range, so the full models only cost triangles.
const TREE_LOD_CHUNK_RADIUS = 3;

// A simple shape (spanning -1..1) scaled and moved to fill `geo`'s bounds.
function fitToBounds(shape, geo) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  shape.scale(half.x, half.y, half.z);
  shape.translate(center.x, center.y, center.z);
  return shape;
}

function createTreeInstancedMesh(geo, mat, capacity, useColor) {
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  useInstancedDepthMaterial(mesh);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (useColor) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 3),
      3
    );
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  mesh.count = 0;
  return mesh;
}

function markInstancesUpdated(mesh, useColor) {
  mesh.instanceMatrix.clearUpdateRanges();
  mesh.instanceMatrix.addUpdateRange(0, mesh.count * 16);
  mesh.instanceMatrix.needsUpdate = true;
  if (useColor) {
    mesh.instanceColor.clearUpdateRanges();
    mesh.instanceColor.addUpdateRange(0, mesh.count * 3);
    mesh.instanceColor.needsUpdate = true;
  }
}

class GlobalInstanceManager {
  constructor() {
    this.types = new Map();
    this.group = new THREE.Group();
    this.group.name = 'GlobalInstances';
    scene.add(this.group);
    this._dirty = true;
  }

  requestRebuild() {
    this._dirty = true;
  }

  registerType(type, geo, mat, maxInstances = 30000, useColor = false) {
    // Shadow-only mesh with just the instances near the plane. three.js has no
    // shadow-only flag (layers are tested against the main camera even for
    // shadows), so it draws zero instances on screen: onBeforeRender only runs
    // for the on-screen pass, not the shadow pass.
    const shadowMesh = createTreeInstancedMesh(geo, mat, maxInstances, false);
    shadowMesh.frustumCulled = false;
    shadowMesh.castShadow = true;
    shadowMesh.onBeforeRender = () => {
      shadowMesh.userData.shadowCount = shadowMesh.count;
      shadowMesh.count = 0;
    };
    shadowMesh.onAfterRender = () => {
      shadowMesh.count = shadowMesh.userData.shadowCount;
    };
    this.group.add(shadowMesh);

    this.types.set(type, {
      geo,
      farGeo: geo, // see setFarGeometry
      mat,
      useColor,
      maxInstances,
      shadowMesh,
      tiles: new Map(), // tile key (+ '|far') -> on-screen InstancedMesh
    });
  }

  // Geometry for this type beyond TREE_LOD_CHUNK_RADIUS, or null to not draw
  // it that far away.
  setFarGeometry(type, farGeo) {
    this.types.get(type).farGeo = farGeo;
    this.requestRebuild();
  }

  // Geometry this type casts shadows with. The shadow map stores 4,096 units
  // in 2,048 texels (2 units each), so a small prop's detail can't show in its
  // shadow; a simple shape casts nearly the same one for far fewer triangles.
  setShadowGeometry(type, shadowGeo) {
    this.types.get(type).shadowMesh.geometry = shadowGeo;
  }

  // Tile mesh for `type` with room for `count` instances, reused if possible.
  _tileMesh(typeInfo, tileKey, tileX, tileZ, count, geo) {
    let mesh = typeInfo.tiles.get(tileKey);
    if (!mesh || mesh.instanceMatrix.count < count) {
      if (mesh) this.group.remove(mesh);
      // Round capacity up so tiles don't reallocate for every few trees.
      const capacity = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
      mesh = createTreeInstancedMesh(
        geo,
        typeInfo.mat,
        capacity,
        typeInfo.useColor
      );
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(
          (tileX + 0.5) * TREE_TILE_SIZE,
          800,
          (tileZ + 0.5) * TREE_TILE_SIZE
        ),
        TREE_TILE_CULL_RADIUS
      );
      typeInfo.tiles.set(tileKey, mesh);
      this.group.add(mesh);
    }
    return mesh;
  }

  rebuildAll() {
    if (!this._dirty) return;
    this._dirty = false;

    const planeChunkX = Math.round(planeGroup.position.x / CHUNK_SIZE);
    const planeChunkZ = Math.round(planeGroup.position.z / CHUNK_SIZE);

    // 1. Group each type's instance data by tile.
    const byType = new Map(); // type -> Map(tileKey -> {tileX, tileZ, parts, count})
    const shadowParts = new Map(); // type -> [data]
    chunks.forEach((chunk) => {
      const instanceData = chunk.userData.instanceData;
      if (!instanceData) return;
      const {chunkX, chunkZ} = chunk.userData;
      // Tiles are aligned so chunk centers (chunkX * CHUNK_SIZE) fall inside.
      const tileX = Math.floor((chunkX * CHUNK_SIZE) / TREE_TILE_SIZE);
      const tileZ = Math.floor((chunkZ * CHUNK_SIZE) / TREE_TILE_SIZE);
      const tileKey = tileX + ',' + tileZ;
      const chunkDistance = Math.max(
        Math.abs(chunkX - planeChunkX),
        Math.abs(chunkZ - planeChunkZ)
      );
      const castsShadows = chunkDistance <= TREE_SHADOW_CHUNK_RADIUS;
      const isFar = chunkDistance > TREE_LOD_CHUNK_RADIUS;

      for (const type in instanceData) {
        const typeInfo = this.types.get(type);
        if (!typeInfo) continue;
        const data = instanceData[type];
        if (!data.count) continue;
        if (castsShadows) {
          if (!shadowParts.has(type)) shadowParts.set(type, []);
          shadowParts.get(type).push(data);
        }
        const useFar = isFar && typeInfo.farGeo !== typeInfo.geo;
        if (useFar && typeInfo.farGeo === null) continue; // not drawn far away
        const meshKey = useFar ? tileKey + '|far' : tileKey;
        if (!byType.has(type)) byType.set(type, new Map());
        const tiles = byType.get(type);
        if (!tiles.has(meshKey)) {
          tiles.set(meshKey, {
            tileX,
            tileZ,
            geo: useFar ? typeInfo.farGeo : typeInfo.geo,
            parts: [],
            count: 0,
          });
        }
        const tile = tiles.get(meshKey);
        tile.parts.push(data);
        tile.count += data.count;
      }
    });

    // 2. Fill each type's tile meshes and its shadow-only mesh.
    for (const [type, typeInfo] of this.types) {
      const tiles = byType.get(type) || new Map();

      for (const [tileKey, mesh] of typeInfo.tiles) {
        if (!tiles.has(tileKey)) {
          this.group.remove(mesh);
          mesh.dispose();
          typeInfo.tiles.delete(tileKey);
        }
      }

      for (const [tileKey, tile] of tiles) {
        const mesh = this._tileMesh(
          typeInfo,
          tileKey,
          tile.tileX,
          tile.tileZ,
          tile.count,
          tile.geo
        );
        let n = 0;
        for (const data of tile.parts) {
          mesh.instanceMatrix.array.set(
            data.matrices.subarray(0, data.count * 16),
            n * 16
          );
          if (typeInfo.useColor) {
            mesh.instanceColor.array.set(
              data.colors.subarray(0, data.count * 3),
              n * 3
            );
          }
          n += data.count;
        }
        mesh.count = n;
        markInstancesUpdated(mesh, typeInfo.useColor);
        mesh.visible = state._enableObjects;
      }

      const shadowMesh = typeInfo.shadowMesh;
      let n = 0;
      for (const data of shadowParts.get(type) || []) {
        const numToCopy = Math.min(data.count, typeInfo.maxInstances - n);
        if (numToCopy <= 0) break;
        shadowMesh.instanceMatrix.array.set(
          data.matrices.subarray(0, numToCopy * 16),
          n * 16
        );
        n += numToCopy;
      }
      shadowMesh.count = n;
      if (n > 0) markInstancesUpdated(shadowMesh, false);
      shadowMesh.visible = state._enableObjects && n > 0;
    }
  }
}

export var globalInstancer = new GlobalInstanceManager();

// Register Tree types
globalInstancer.registerType('pineTrunk', treeTrunkGeo, treeTrunkMat);
globalInstancer.registerType(
  'pineLeaves',
  treeLeavesGeo,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('decidTrunk', deciduousGeos.trunk, treeTrunkMat);
globalInstancer.registerType(
  'decidLeaves',
  deciduousGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType(
  'tallDecidTrunk',
  tallDeciduousGeos.trunk,
  treeTrunkMat
);
globalInstancer.registerType(
  'tallDecidLeaves',
  tallDeciduousGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('palmTrunk', palmGeos.trunk, treeTrunkMat);
globalInstancer.registerType(
  'palmLeaves',
  palmGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType(
  'japaneseMapleTrunk',
  japaneseMapleGeos.trunk,
  treeTrunkMat
);
globalInstancer.registerType(
  'japaneseMapleLeaves',
  japaneseMapleGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType(
  'mushroomStalk',
  mushroomGeos.trunk,
  mushroomStalkMat
);
globalInstancer.registerType(
  'mushroomCap',
  mushroomGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('deadTrunk', deadTreeGeo, deadTreeMat);
globalInstancer.registerType('rock', rockGeo, rockMat);
globalInstancer.registerType('snowRock', rockGeo, snowRockMat);
globalInstancer.registerType('desertRock', rockGeo, desertRockMat);
globalInstancer.registerType('cactus', cactusGeo, cactusMat);
globalInstancer.registerType('snowmanBody', snowmanGeos.body, snowmanBodyMat);
globalInstancer.registerType('snowmanNose', snowmanGeos.nose, snowmanNoseMat);
globalInstancer.registerType('iceberg', icebergMainGeo, icebergMat);
globalInstancer.registerType('iceFloe', iceFloeMainGeo, icebergMat);
globalInstancer.registerType('penguinBody', penguinBodyGeo, penguinBlackMat);
globalInstancer.registerType('penguinBelly', penguinBellyGeo, penguinWhiteMat);
globalInstancer.registerType('penguinHead', penguinHeadGeo, penguinBlackMat);
globalInstancer.registerType('penguinBeak', penguinBeakGeo, penguinOrangeMat);
globalInstancer.registerType('penguinWingL', penguinWingLGeo, penguinBlackMat);
globalInstancer.registerType('penguinWingR', penguinWingRGeo, penguinBlackMat);
globalInstancer.registerType('penguinFootL', penguinFootLGeo, penguinOrangeMat);
globalInstancer.registerType('penguinFootR', penguinFootRGeo, penguinOrangeMat);
globalInstancer.registerType('lilypad', lilyPadGeo, lilyPadMat);
globalInstancer.registerType('bush', bushGeo, bushBaseMat, 30000, true);

// Distant versions (beyond TREE_LOD_CHUNK_RADIUS). The costliest models get a
// simple shape fitted to their bounds (same material and instance colors);
// props too small to see that far away aren't drawn. Pines, rocks and other
// cheap models stay as they are.
const farCanopy = (geo) =>
  fitToBounds(new THREE.IcosahedronGeometry(1, 0), geo); // 20 triangles
globalInstancer.setFarGeometry('decidLeaves', farCanopy(deciduousGeos.leaves));
globalInstancer.setFarGeometry(
  'tallDecidLeaves',
  farCanopy(tallDeciduousGeos.leaves)
);
globalInstancer.setFarGeometry('palmLeaves', farCanopy(palmGeos.leaves));
globalInstancer.setFarGeometry(
  'japaneseMapleLeaves',
  farCanopy(japaneseMapleGeos.leaves)
);
globalInstancer.setFarGeometry(
  'palmTrunk',
  fitToBounds(new THREE.CylinderGeometry(0.6, 1, 2, 6, 1, true), palmGeos.trunk)
);
globalInstancer.setFarGeometry(
  'cactus',
  fitToBounds(new THREE.BoxGeometry(2, 2, 2), cactusGeo)
);
globalInstancer.setFarGeometry('bush', null);
globalInstancer.setFarGeometry('snowmanBody', null);
globalInstancer.setFarGeometry('snowmanNose', null);

// Rounded canopies and bushes cast shadows with the same fitted shapes. Palm
// fronds keep their full model: their star-shaped shadow is distinctive.
globalInstancer.setShadowGeometry('bush', farCanopy(bushGeo));
globalInstancer.setShadowGeometry(
  'decidLeaves',
  globalInstancer.types.get('decidLeaves').farGeo
);
globalInstancer.setShadowGeometry(
  'tallDecidLeaves',
  globalInstancer.types.get('tallDecidLeaves').farGeo
);
globalInstancer.setShadowGeometry(
  'japaneseMapleLeaves',
  globalInstancer.types.get('japaneseMapleLeaves').farGeo
);

var workerChunkRequests = new Map();
var workerChunkResults = new Map();
// Chunks whose worker job failed; these are built on the main thread instead.
var workerChunkFailed = new Set();

// The water's depth below the surface, sampled per pixel from the chunk's
// terrain height grid (the water mesh itself is much coarser), so shallows,
// the deep-water edge and foam follow the shore smoothly instead of the
// water triangles. 8 bits: depth -30..10 mapped to 0..255.
const WATER_DEPTH_MIN = -30;
const _waterMaterialPool = [];
const WATER_DEPTH_RANGE = 40;

function attachWaterDepthTexture(waterMesh, heightGrid, softDepth) {
  const n = state.SEGMENTS + 1;
  const encode = (depth) =>
    Math.max(
      0,
      Math.min(
        255,
        Math.round(((depth - WATER_DEPTH_MIN) / WATER_DEPTH_RANGE) * 255)
      )
    );
  // R: exact depth (foam at the waterline). G: softened depth (color and
  // transparency, blending gradually from the beach to open water).
  const bytes = new Uint8Array(n * n * 2);
  for (let i = 0; i < n * n; i++) {
    bytes[i * 2] = encode(WATER_LEVEL - heightGrid[i]);
    bytes[i * 2 + 1] = encode(softDepth[i]);
  }
  const tex = new THREE.DataTexture(bytes, n, n, THREE.RGFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.unpackAlignment = 1; // rows are 2n bytes, not padded to 4
  tex.needsUpdate = true;
  // One shared material can't hold a different texture per draw, so each
  // water chunk gets its own material. Clones share the compiled shader, but
  // setting up a new material still costs a few ms of main-thread work, so
  // materials from unloaded chunks are reused.
  let mat = _waterMaterialPool.pop();
  while (
    mat &&
    (mat.transparent !== waterMaterial.transparent ||
      mat.opacity !== waterMaterial.opacity ||
      mat.depthWrite !== waterMaterial.depthWrite)
  ) {
    mat.dispose(); // made under a different graphics preset
    mat = _waterMaterialPool.pop();
  }
  if (!mat) {
    mat = waterMaterial.clone();
    mat.onBeforeCompile = waterMaterial.onBeforeCompile;
    mat.userData.isWater = true;
    mat.userData.depthUniforms = {
      uDepthTex: {value: null},
      uDepthGridSize: {value: n},
    };
  }
  mat.userData.depthUniforms.uDepthTex.value = tex;
  mat.userData.depthUniforms.uDepthGridSize.value = n;
  waterMesh.material = mat;
  waterMesh.userData.depthTex = tex;
}

export function disposeWaterDepthTexture(waterMesh) {
  if (waterMesh && waterMesh.userData.depthTex) {
    waterMesh.userData.depthTex.dispose();
    waterMesh.userData.depthTex = null;
    if (waterMesh.material !== waterMaterial) {
      if (_waterMaterialPool.length < 64) {
        _waterMaterialPool.push(waterMesh.material);
      } else {
        waterMesh.material.dispose();
      }
      waterMesh.material = waterMaterial;
    }
  }
}

// Inputs to generateChunkData(), identical for workers and the main thread.
function chunkGenParams(chunkX, chunkZ) {
  return {
    chunkX,
    chunkZ,
    segments: state.SEGMENTS,
    chunkSize: CHUNK_SIZE,
    elevParams: {WATER_LEVEL, MOUNTAIN_LEVEL, MAP_WORLD_SIZE, MAP_HEIGHT_SCALE},
    worldSeed: ChillFlightLogic.WORLD_SEED,
    enableObjects: state._enableObjects,
  };
}

function queueWorkerChunk(cx, cz, key, priority = 0) {
  if (workerChunkRequests.has(key) || workerChunkResults.has(key)) return;

  const req = terrainWorkerManager
    .requestChunk(cx, cz, {...chunkGenParams(cx, cz), priority})
    .then((result) => {
      workerChunkRequests.delete(key);
      if (chunkQueueSet.has(key)) {
        workerChunkResults.set(key, result);
      }
    })
    .catch((err) => {
      workerChunkRequests.delete(key);
      if (chunkQueueSet.has(key)) workerChunkFailed.add(key);
      log.warn('[Worker] Terrain chunk worker error, falling back:', err);
    });

  workerChunkRequests.set(key, req);
}

export function clearChunkQueue() {
  resetChunkQueue();
  workerChunkRequests.clear();
  workerChunkResults.clear();
  workerChunkFailed.clear();
  if (
    typeof window !== 'undefined' &&
    terrainWorkerManager &&
    terrainWorkerManager.isSupported
  ) {
    terrainWorkerManager.cancelRequests(() => true);
  }
}

// Builds a chunk's meshes from generateChunkData() output: a worker's result,
// or (when workers are unavailable) data generated here on the main thread.
function generateChunk(chunkX, chunkZ, workerData = null) {
  if (!workerData) {
    workerData = generateChunkData(chunkGenParams(chunkX, chunkZ)).result;
  }

  const group = new THREE.Group();
  group.userData.chunkX = chunkX;
  group.userData.chunkZ = chunkZ;
  group.userData.worldPosition = new THREE.Vector3(
    chunkX * CHUNK_SIZE,
    0,
    chunkZ * CHUNK_SIZE
  );

  const rng = ChillFlightLogic.chunkRng(chunkX, chunkZ);
  const isCustom = !!ChillFlightLogic.customMap;

  // 1. Generate Terrain Mesh
  let geometry;
  while (
    _terrainGeometryPool.length > 0 &&
    _terrainGeometryPool[_terrainGeometryPool.length - 1].parameters
      .widthSegments !== state.SEGMENTS
  ) {
    _terrainGeometryPool.pop().dispose();
  }
  if (_terrainGeometryPool.length > 0) {
    geometry = _terrainGeometryPool.pop();
  } else {
    geometry = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      state.SEGMENTS,
      state.SEGMENTS
    );
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array(geometry.attributes.position.count * 3),
        3
      )
    );
  }
  geometry.userData = {unique: true, poolType: 'terrain'};

  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;

  const worldOffsetX = chunkX * CHUNK_SIZE;
  const worldOffsetZ = chunkZ * CHUNK_SIZE;

  // Prop placements from the chunk data, used to build the meshes below.
  const housePositions = [];
  const twoStoryHousePositions = [];
  const strawHutPositions = [];
  const windmillPositions = [];
  let lighthousePos = null;
  const pierPositions = [];
  const campfirePositions = [];
  const chimneySmokePositions = [];
  const sailboatPositions = [];
  const pirateShipPositions = [];
  const pagodaPositions = [];
  const barnPositions = [];
  const monasteryPositions = [];
  const castleRuinsPositions = [];
  const rockArchPositions = [];
  const rockArchGrassPositions = [];
  let hasWater = !!workerData.hasWater;

  positions.set(workerData.buffers.terrainPositions);
  geometry.attributes.position.needsUpdate = true;

  colors.set(workerData.buffers.terrainColors);
  const cp = workerData.chunkProps;
  if (cp.housePositions) housePositions.push(...cp.housePositions);
  if (cp.twoStoryHousePositions)
    twoStoryHousePositions.push(...cp.twoStoryHousePositions);
  if (cp.strawHutPositions) strawHutPositions.push(...cp.strawHutPositions);
  if (cp.pagodaPositions) pagodaPositions.push(...cp.pagodaPositions);
  if (cp.barnPositions) barnPositions.push(...cp.barnPositions);
  if (cp.monasteryPositions) monasteryPositions.push(...cp.monasteryPositions);
  if (cp.castleRuinsPositions)
    castleRuinsPositions.push(...cp.castleRuinsPositions);
  if (cp.windmillPositions) windmillPositions.push(...cp.windmillPositions);
  if (cp.sailboatPositions) sailboatPositions.push(...cp.sailboatPositions);
  if (cp.pirateShipPositions)
    pirateShipPositions.push(...cp.pirateShipPositions);
  if (cp.rockArchPositions) rockArchPositions.push(...cp.rockArchPositions);
  if (cp.rockArchGrassPositions)
    rockArchGrassPositions.push(...cp.rockArchGrassPositions);
  if (cp.pierPositions) pierPositions.push(...cp.pierPositions);
  if (cp.campfirePositions) campfirePositions.push(...cp.campfirePositions);
  if (cp.chimneySmokePositions)
    chimneySmokePositions.push(...cp.chimneySmokePositions);
  if (cp.lighthousePos) lighthousePos = cp.lighthousePos;

  if (rockArchPositions.length > 0 || rockArchGrassPositions.length > 0) {
    const archPos = rockArchPositions[0] || rockArchGrassPositions[0];
    group.userData.rockArch = {
      x: worldOffsetX + archPos.x,
      y: archPos.y,
      z: worldOffsetZ + archPos.z,
      rotY: archPos.rotY,
    };
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // 2.99 Volcano Landmark Details
  // Must run BEFORE the early-exit guard to avoid the async race where the chunk
  // gets evicted while building, which would prevent these from ever being added.
  // Added directly to `scene` (not the chunk group) so they survive chunk reloads.
  {
    const vX = VOLCANO_X;
    const vZ = VOLCANO_Z;
    const isVolcanoChunk =
      Math.abs(vX - worldOffsetX) <= CHUNK_SIZE / 2 &&
      Math.abs(vZ - worldOffsetZ) <= CHUNK_SIZE / 2;

    if (isVolcanoChunk) {
      const craterBottom = getElevation(vX, vZ);

      // Sample the caldera basin perimeter (radius 60) to find the natural basin/breach floor.
      // Placing the lava surface at this level prevents it from protruding through mountain flanks.
      const LAVA_RADIUS = 60;
      let minCalderaElev = craterBottom;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const edgeElev = getElevation(
          vX + Math.cos(ang) * LAVA_RADIUS,
          vZ + Math.sin(ang) * LAVA_RADIUS
        );
        if (edgeElev < minCalderaElev) minCalderaElev = edgeElev;
      }

      // If any part of the crater's footprint is extremely low, a river has carved through the volcano.
      // We shouldn't place hovering lava or spotlights in the middle of a river gorge.
      if (minCalderaElev > 500) {
        // Lava disk - cylinder height is 15, so centering at minCalderaElev - 5 places
        // the top surface right at the caldera basin floor without breaching slopes.
        const lavaY = minCalderaElev - 5;
        const vElements = ModelAssembler.getStructure(
          'volcano_active_elements'
        );
        vElements.forEach((part) => {
          const mesh = new THREE.Mesh(part.geo, part.mat);
          mesh.position.set(
            vX + part.pos[0],
            lavaY + part.pos[1],
            vZ + part.pos[2]
          );
          mesh.rotation.set(...part.rot);
          if (part.scale) mesh.scale.set(...part.scale);
          group.add(mesh);
        });

        // Spot light pointing up to cast a glow on the crater walls
        // three.js r155+ uses physical light units (candela). Converted from
        // the legacy-tuned 30.0 to preserve the glow at ~200 m (decay was and
        // remains 1). Verify visually.
        const sLight = new THREE.SpotLight(
          0xff4500,
          5600,
          3000,
          Math.PI / 6,
          0.5,
          1
        );
        // Place spotlight slightly above lava surface to avoid being buried
        sLight.position.set(vX, lavaY + 10, vZ);
        const sTarget = new THREE.Object3D();
        sTarget.position.set(vX, 2000, vZ);
        group.add(sTarget);
        sLight.target = sTarget;
        group.add(sLight);
      }
    }
  }

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.position.set(worldOffsetX, 0, worldOffsetZ);
  group.add(mesh);

  // 1.5 Generate Water Plane
  if (hasWater) {
    const wSegments = Math.max(1, Math.floor(state.SEGMENTS / 4));
    let waterGeo;
    while (
      _waterGeometryPool.length > 0 &&
      _waterGeometryPool[_waterGeometryPool.length - 1].parameters
        .widthSegments !== wSegments
    ) {
      _waterGeometryPool.pop().dispose();
    }
    if (_waterGeometryPool.length > 0) {
      waterGeo = _waterGeometryPool.pop();
    } else {
      waterGeo = new THREE.PlaneGeometry(
        CHUNK_SIZE,
        CHUNK_SIZE,
        wSegments,
        wSegments
      );
      waterGeo.rotateX(-Math.PI / 2);
      waterGeo.setAttribute(
        'color',
        new THREE.BufferAttribute(
          new Float32Array(waterGeo.attributes.position.count * 3),
          3
        )
      );
    }
    waterGeo.userData = {unique: true, poolType: 'water'};

    waterGeo.attributes.position.array.set(workerData.buffers.waterPositions);
    waterGeo.attributes.color.array.set(workerData.buffers.waterColors);

    waterGeo.attributes.position.needsUpdate = true;
    waterGeo.attributes.color.needsUpdate = true;
    waterGeo.computeBoundingBox();
    waterGeo.computeBoundingSphere();
    const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
    waterMesh.position.set(worldOffsetX, 0, worldOffsetZ);
    attachWaterDepthTexture(
      waterMesh,
      workerData.buffers.heightGrid,
      workerData.buffers.softWaterDepth
    );
    group.add(waterMesh);
    group.userData.water = waterMesh; // accessible for animation!
  }

  // 1.6 Dedicated group for procedural objects (trees, houses, etc.)
  // This allows for bulk toggling visibility via the debug menu.
  const objectsGroup = new THREE.Group();
  objectsGroup.position.set(-worldOffsetX, 0, -worldOffsetZ); // Counter-shift for children
  const emptyLODGroup = new THREE.Group();

  const objectsLOD = new THREE.LOD();
  objectsLOD.position.set(worldOffsetX, 0, worldOffsetZ); // Correct position for distance calculation
  objectsLOD.addLevel(objectsGroup, 0);

  // Cull small chunk-local props (houses, chimneys, doors, boats) beyond 4,200 units
  // while trees continue to render globally via GlobalInstanceManager without pop-in
  const maxPropLOD =
    state.manualPropLOD !== undefined
      ? state.manualPropLOD
      : typeof state.PROP_LOD_DISTANCE !== 'undefined'
        ? state.PROP_LOD_DISTANCE
        : 4200;
  const lodMultiplier =
    performanceMonitor && typeof performanceMonitor.lodMultiplier === 'number'
      ? performanceMonitor.lodMultiplier
      : 1.0;
  const lodDistance =
    (state.manualPropLOD !== undefined
      ? state.manualPropLOD
      : Math.min(
          state.RENDER_DISTANCE * CHUNK_SIZE - CHUNK_SIZE / 2,
          maxPropLOD
        )) * lodMultiplier;
  objectsLOD.addLevel(emptyLODGroup, lodDistance);
  objectsLOD.visible = state._enableObjects;

  group.add(objectsLOD);
  group.userData.objectsGroup = objectsLOD;

  // Trees, rocks and other small props arrive as instanceData, drawn by
  // GlobalInstanceManager; the rest are built per chunk below.
  const dummy = new THREE.Object3D();

  // 2.3b Generate Rock Arches (Unique instances)
  if (rockArchPositions.length > 0) {
    rockArchPositions.forEach((pos) => {
      const geos = createRockArchGeometries(rng);
      const mesh = new THREE.Mesh(geos.rock, rockMat);
      mesh.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      mesh.rotation.y = pos.rotY;

      // Store unique geometries so they can be disposed
      mesh.geometry.userData.unique = true;
      geos.grass.dispose(); // Unused in this variant

      group.add(mesh);
    });
  }

  if (rockArchGrassPositions.length > 0) {
    rockArchGrassPositions.forEach((pos) => {
      const geos = createRockArchGeometries(rng);

      const rockMesh = new THREE.Mesh(geos.rock, rockMat);
      rockMesh.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      rockMesh.rotation.y = pos.rotY;
      rockMesh.geometry.userData.unique = true;

      const grassMesh = new THREE.Mesh(geos.grass, rockArchGrassMat);
      grassMesh.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      grassMesh.rotation.y = pos.rotY;
      grassMesh.geometry.userData.unique = true;

      group.add(rockMesh);
      group.add(grassMesh);
    });
  }

  // 2.5 Generate Houses
  if (housePositions.length > 0) {
    const numBodyColors = houseBodyPalette.length;
    const numRoofColors = houseRoofPalette.length;

    // Count houses per (body, roof) combo
    const comboCounts = {};
    const houseCombo = [];
    housePositions.forEach((pos, idx) => {
      const bodyId =
        pos.bodyId !== undefined
          ? pos.bodyId % numBodyColors
          : Math.floor(rng() * numBodyColors);
      const roofId =
        pos.roofId !== undefined
          ? pos.roofId % numRoofColors
          : Math.floor(rng() * numRoofColors);
      const key = `${bodyId}_${roofId}`;
      houseCombo[idx] = {bodyId, roofId, key};
      comboCounts[key] = (comboCounts[key] || 0) + 1;
    });

    // Build one InstancedMesh pair per combo that actually appears
    const bodyInsts = {};
    const roofInsts = {};
    const comboIndices = {};
    for (const key of Object.keys(comboCounts)) {
      const [bodyId, roofId] = key.split('_').map(Number);
      bodyInsts[key] = getInstancedMesh(
        houseBodyGeo,
        houseBodyPalette[bodyId],
        comboCounts[key]
      );
      roofInsts[key] = getInstancedMesh(
        houseRoofGeo,
        houseRoofPalette[roofId],
        comboCounts[key]
      );
      bodyInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      roofInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(bodyInsts[key]);
      objectsGroup.add(roofInsts[key]);
      comboIndices[key] = 0;
    }

    const windowPools = [];
    const poolCounts = [0, 0, 0, 0, 0];
    const houseToPool = [];

    housePositions.forEach((pos, idx) => {
      const poolId =
        pos.poolId !== undefined ? pos.poolId % 5 : Math.floor(rng() * 5);
      houseToPool[idx] = poolId;
      poolCounts[poolId]++;
    });

    for (let i = 0; i < 5; i++) {
      if (poolCounts[i] > 0) {
        windowPools[i] = getInstancedMesh(
          houseWindowGeo,
          houseWindowMats[i],
          poolCounts[i] * 3
        );
        windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(windowPools[i]);
      }
    }

    const doorInst = getInstancedMesh(
      houseDoorGeo,
      houseDoorMat,
      housePositions.length
    );
    const chimneyInst = getInstancedMesh(
      houseChimneyGeo,
      houseChimneyMat,
      housePositions.length
    );
    doorInst.position.set(worldOffsetX, 0, worldOffsetZ);
    chimneyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(doorInst);
    objectsGroup.add(chimneyInst);

    const poolIndices = [0, 0, 0, 0, 0];

    housePositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      const {key} = houseCombo[index];
      const ci = comboIndices[key];
      bodyInsts[key].setMatrixAt(ci, dummy.matrix);
      roofInsts[key].setMatrixAt(ci, dummy.matrix);
      comboIndices[key]++;

      const poolId = houseToPool[index];
      const pIdx = poolIndices[poolId];

      const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + doorOffset.x,
        pos.y + doorOffset.y,
        pos.z + doorOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      doorInst.setMatrixAt(index, dummy.matrix);

      const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + chimneyOffset.x,
        pos.y + chimneyOffset.y,
        pos.z + chimneyOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      chimneyInst.setMatrixAt(index, dummy.matrix);

      const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );

      dummy.position.set(
        pos.x + winF1Offset.x,
        pos.y + winF1Offset.y,
        pos.z + winF1Offset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      windowPools[poolId].setMatrixAt(pIdx * 3, dummy.matrix);

      dummy.position.set(
        pos.x + winF2Offset.x,
        pos.y + winF2Offset.y,
        pos.z + winF2Offset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      windowPools[poolId].setMatrixAt(pIdx * 3 + 1, dummy.matrix);

      dummy.position.set(
        pos.x + winBOffset.x,
        pos.y + winBOffset.y,
        pos.z + winBOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      windowPools[poolId].setMatrixAt(pIdx * 3 + 2, dummy.matrix);

      poolIndices[poolId]++;
    });
  }

  // 2.52 Generate Two Story Houses
  if (twoStoryHousePositions.length > 0) {
    const numBodyColors = houseBodyPalette.length;
    const numRoofColors = houseRoofPalette.length;

    const comboCounts = {};
    const houseCombo = [];
    twoStoryHousePositions.forEach((pos, idx) => {
      const bodyId =
        (pos.bodyId !== undefined
          ? pos.bodyId
          : Math.floor(rng() * numBodyColors)) % numBodyColors;
      const roofId =
        (pos.roofId !== undefined
          ? pos.roofId
          : Math.floor(rng() * numRoofColors)) % numRoofColors;
      const key = `${bodyId}_${roofId}`;
      houseCombo[idx] = {bodyId, roofId, key};
      comboCounts[key] = (comboCounts[key] || 0) + 1;
    });

    const bodyInsts = {};
    const roofInsts = {};
    const comboIndices = {};
    for (const key of Object.keys(comboCounts)) {
      const [bodyId, roofId] = key.split('_').map(Number);
      bodyInsts[key] = getInstancedMesh(
        twoStoryBodyGeo,
        houseBodyPalette[bodyId],
        comboCounts[key]
      );
      roofInsts[key] = getInstancedMesh(
        twoStoryRoofGeo,
        houseRoofPalette[roofId],
        comboCounts[key]
      );
      bodyInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      roofInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(bodyInsts[key]);
      objectsGroup.add(roofInsts[key]);
      comboIndices[key] = 0;
    }

    const windowPools = [];
    const poolCounts = [0, 0, 0, 0, 0];
    const houseToPool = [];

    twoStoryHousePositions.forEach((pos, idx) => {
      const poolId =
        (pos.poolId !== undefined ? pos.poolId : Math.floor(rng() * 5)) % 5;
      houseToPool[idx] = poolId;
      poolCounts[poolId]++;
    });

    for (let i = 0; i < 5; i++) {
      if (poolCounts[i] > 0) {
        windowPools[i] = getInstancedMesh(
          houseWindowGeo,
          houseWindowMats[i],
          poolCounts[i] * 8
        );
        windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(windowPools[i]);
      }
    }

    const doorInst = getInstancedMesh(
      houseDoorGeo,
      houseDoorMat,
      twoStoryHousePositions.length
    );
    const chimneyInst = getInstancedMesh(
      twoStoryChimneyGeo,
      houseChimneyMat,
      twoStoryHousePositions.length
    );
    doorInst.position.set(worldOffsetX, 0, worldOffsetZ);
    chimneyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(doorInst);
    objectsGroup.add(chimneyInst);

    const poolIndices = [0, 0, 0, 0, 0];

    twoStoryHousePositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      const {key} = houseCombo[index];
      const ci = comboIndices[key];
      bodyInsts[key].setMatrixAt(ci, dummy.matrix);
      roofInsts[key].setMatrixAt(ci, dummy.matrix);
      comboIndices[key]++;

      const poolId = houseToPool[index];
      const pIdx = poolIndices[poolId];

      const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + doorOffset.x,
        pos.y + doorOffset.y,
        pos.z + doorOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      doorInst.setMatrixAt(index, dummy.matrix);

      const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + chimneyOffset.x,
        pos.y + chimneyOffset.y,
        pos.z + chimneyOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      chimneyInst.setMatrixAt(index, dummy.matrix);

      const offsets = [
        new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(0, 4, -5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(0, 10, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(-3.0, 10, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(3.0, 10, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(-3.0, 10, -5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(3.0, 10, -5.1).applyAxisAngle(yAxis, pos.rotY),
      ];

      offsets.forEach((offset, i) => {
        dummy.position.set(
          pos.x + offset.x,
          pos.y + offset.y,
          pos.z + offset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        windowPools[poolId].setMatrixAt(pIdx * 8 + i, dummy.matrix);
      });

      poolIndices[poolId]++;
    });
  }

  // 2.55 Generate Straw Huts (islands)
  if (strawHutPositions.length > 0) {
    const strawHutBodyInst = getInstancedMesh(
      strawHutBodyGeo,
      strawHutMat,
      strawHutPositions.length
    );
    const strawHutRoofInst = getInstancedMesh(
      strawHutRoofGeo,
      strawHutMat,
      strawHutPositions.length
    );
    strawHutPositions.forEach((pos, i) => {
      const scale = pos.scale !== undefined ? pos.scale : 0.9 + rng() * 0.3;
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      strawHutBodyInst.setMatrixAt(i, dummy.matrix);
      strawHutRoofInst.setMatrixAt(i, dummy.matrix);
    });
    strawHutBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    strawHutRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(strawHutBodyInst);
    objectsGroup.add(strawHutRoofInst);
  }

  // 2.6 Generate Pagodas (rare, cherry blossom zones)
  if (pagodaPositions.length > 0) {
    const pagodaBodyInst = getInstancedMesh(
      pagodaBodyGeo,
      pagodaBodyMat,
      pagodaPositions.length
    );
    const pagodaRoofInst = getInstancedMesh(
      pagodaRoofGeo,
      pagodaRoofMat,
      pagodaPositions.length
    );
    pagodaPositions.forEach((pos, i) => {
      const scale = pos.scale !== undefined ? pos.scale : 0.9 + rng() * 0.3;
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      pagodaBodyInst.setMatrixAt(i, dummy.matrix);
      pagodaRoofInst.setMatrixAt(i, dummy.matrix);
    });
    pagodaBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    pagodaRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(pagodaBodyInst);
    objectsGroup.add(pagodaRoofInst);
  }

  // 2.61 Generate Barns (temperate plains)
  if (barnPositions.length > 0) {
    const barnBodyInst = getInstancedMesh(
      barnBodyGeo,
      barnBodyMat,
      barnPositions.length
    );
    const barnRoofInst = getInstancedMesh(
      barnRoofGeo,
      barnRoofMat,
      barnPositions.length
    );
    const barnDoorInst = getInstancedMesh(
      barnDoorGeo,
      barnWhiteMat,
      barnPositions.length * 2
    );
    const barnTrimInst = getInstancedMesh(
      barnTrimGeo,
      barnBodyMat,
      barnPositions.length * 4
    );
    const barnSiloBodyInst = getInstancedMesh(
      barnSiloBodyGeo,
      barnSiloMat,
      barnPositions.length
    );
    const barnSiloRoofInst = getInstancedMesh(
      barnSiloRoofGeo,
      barnSiloRoofMat,
      barnPositions.length
    );

    barnPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      barnBodyInst.setMatrixAt(i, dummy.matrix);
      barnRoofInst.setMatrixAt(i, dummy.matrix);

      const doorFOffset = new THREE.Vector3(0, 4.5, 14.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const doorBOffset = new THREE.Vector3(0, 4.5, -14.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const siloOffset = new THREE.Vector3(12, 0, 0).applyAxisAngle(
        yAxis,
        pos.rotY
      );

      // Front Door
      dummy.position.set(
        pos.x + doorFOffset.x,
        pos.y + doorFOffset.y,
        pos.z + doorFOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      barnDoorInst.setMatrixAt(i * 2, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, -Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4 + 1, dummy.matrix);

      // Back Door
      dummy.position.set(
        pos.x + doorBOffset.x,
        pos.y + doorBOffset.y,
        pos.z + doorBOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      barnDoorInst.setMatrixAt(i * 2 + 1, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4 + 2, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, -Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4 + 3, dummy.matrix);

      // Silo
      dummy.position.set(
        pos.x + siloOffset.x,
        pos.y + siloOffset.y,
        pos.z + siloOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      barnSiloBodyInst.setMatrixAt(i, dummy.matrix);
      barnSiloRoofInst.setMatrixAt(i, dummy.matrix);
    });

    barnBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnDoorInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnTrimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnSiloBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnSiloRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);

    objectsGroup.add(barnBodyInst);
    objectsGroup.add(barnRoofInst);
    objectsGroup.add(barnDoorInst);
    objectsGroup.add(barnTrimInst);
    objectsGroup.add(barnSiloBodyInst);
    objectsGroup.add(barnSiloRoofInst);
  }

  // 2.62 Generate Monasteries (rare, temperate highlands)
  if (monasteryPositions.length > 0) {
    const monasteryBodyInst = getInstancedMesh(
      monasteryBodyGeo,
      monasteryBodyMat,
      monasteryPositions.length
    );
    const monasteryRoofInst = getInstancedMesh(
      monasteryRoofGeo,
      monasteryRoofMat,
      monasteryPositions.length
    );
    monasteryPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      monasteryBodyInst.setMatrixAt(i, dummy.matrix);
      monasteryRoofInst.setMatrixAt(i, dummy.matrix);
    });
    monasteryBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    monasteryRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(monasteryBodyInst);
    objectsGroup.add(monasteryRoofInst);
  }

  // 2.63 Generate Castle Ruins (very rare, elevated terrain)
  if (castleRuinsPositions.length > 0) {
    const castleInst = getInstancedMesh(
      castleRuinsGeo,
      castleRuinsMat,
      castleRuinsPositions.length
    );
    castleRuinsPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      castleInst.setMatrixAt(i, dummy.matrix);
    });
    castleInst.position.set(worldOffsetX, 0, worldOffsetZ);
    group.add(castleInst);
  }

  // 2.7 Generate Windmills
  if (windmillPositions.length > 0) {
    const baseInst = getInstancedMesh(
      windmillBaseGeo,
      windmillBaseMat,
      windmillPositions.length
    );
    const bladesInst = getInstancedMesh(
      windmillBladesGeo,
      windmillBladesMat,
      windmillPositions.length * 4
    );
    bladesInst.customDepthMaterial = windmillBladesDepthMat;

    windmillPositions.forEach((pos, index) => {
      const structure = ModelAssembler.getStructure('windmill', pos.rotY);
      structure.forEach((part, pIdx) => {
        dummy.position.set(
          pos.x + part.pos[0],
          pos.y + part.pos[1],
          pos.z + part.pos[2]
        );
        dummy.rotation.order = part.order || 'XYZ';
        dummy.rotation.set(...part.rot);
        dummy.scale.set(...part.scale);
        dummy.updateMatrix();

        if (pIdx === 0) {
          baseInst.setMatrixAt(index, dummy.matrix);
        } else {
          bladesInst.setMatrixAt(index * 4 + (pIdx - 1), dummy.matrix);
        }
      });
    });

    baseInst.position.set(worldOffsetX, 0, worldOffsetZ);
    bladesInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(baseInst);
    objectsGroup.add(bladesInst);
  }

  // 2.9 Generate Lighthouse
  if (lighthousePos) {
    const pos = lighthousePos;
    const structure = ModelAssembler.getStructure('lighthouse', pos.rotY || 0);
    const lighthouseGroup = new THREE.Group();

    structure.forEach((part) => {
      const mesh = new THREE.Mesh(part.geo, part.mat);
      mesh.position.set(...part.pos);
      mesh.rotation.set(...part.rot);
      if (part.scale) mesh.scale.set(...part.scale);
      lighthouseGroup.add(mesh);
    });

    lighthouseGroup.scale.set(2, 2, 2); // Scale lighthouse by 100% bigger (double size)
    lighthouseGroup.position.set(
      pos.x + worldOffsetX,
      pos.y,
      pos.z + worldOffsetZ
    );
    group.add(lighthouseGroup);

    // Use persistent beam and light
    const beamHeight = 126; // Middle of lantern (63 * 2)

    if (persistentLighthouseBeam) {
      persistentLighthouseBeam.position.set(
        pos.x + worldOffsetX,
        pos.y + beamHeight,
        pos.z + worldOffsetZ
      );
      persistentLighthouseBeam.rotation.y = pos.rotY;
      persistentLighthouseBeam.rotation.x = 0.15; // Tilt slightly downward
      persistentLighthouseBeam.scale.set(2, 2, 2); // Scale beam to match
      persistentLighthouseBeam.visible = true;

      // Store in userData for game.js to animate!
      group.userData.lighthouseBeam = persistentLighthouseBeam;
    }

    if (persistentLighthouseLight) {
      persistentLighthouseLight.position.set(
        pos.x + worldOffsetX,
        pos.y + beamHeight,
        pos.z + worldOffsetZ
      );
      persistentLighthouseLight.target.position.set(
        pos.x + worldOffsetX + Math.sin(pos.rotY) * 200,
        pos.y + beamHeight - 30,
        pos.z + worldOffsetZ + Math.cos(pos.rotY) * 200
      );
      persistentLighthouseLight.intensity = 0; // Controlled by animate loop (dayFactor)

      // Store in userData for game.js to animate!
      group.userData.lighthouseLight = persistentLighthouseLight;
      group.userData.lighthouseTarget = persistentLighthouseLight.target;
    }
  }

  // 2.95 Generate Piers
  if (pierPositions.length > 0) {
    const deckInst = getInstancedMesh(
      pierDeckGeo,
      woodMat,
      pierPositions.length
    );
    const postInst = getInstancedMesh(
      pierPostGeo,
      woodMat,
      pierPositions.length * 4
    );

    pierPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y - 1, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      deckInst.setMatrixAt(index, dummy.matrix);

      // Posts
      const offsets = [
        [-6, 10],
        [6, 10],
        [-6, 25],
        [6, 25],
      ];
      offsets.forEach((off, i) => {
        const p = new THREE.Vector3(off[0], -5, off[1]).applyAxisAngle(
          yAxis,
          pos.rotY
        );
        dummy.position.set(pos.x + p.x, pos.y + p.y, pos.z + p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        postInst.setMatrixAt(index * 4 + i, dummy.matrix);
      });
    });

    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    postInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(deckInst);
    objectsGroup.add(postInst);
  }

  // 2.955 Generate West Coast Highway
  // Spawn continuous geometric road segments that elevate into bridges over water/valleys
  if (!isCustom) {
    const halfChunk = CHUNK_SIZE / 2;
    const activeRoads = [];
    for (let n = -20; n <= 20; n++) {
      const baseX =
        ChillFlightLogic.ROAD_BASE_X + n * ChillFlightLogic.ROAD_SPACING;
      if (
        baseX + 4000 >= worldOffsetX - halfChunk &&
        baseX - 4000 <= worldOffsetX + halfChunk
      ) {
        activeRoads.push(n);
      }
    }

    activeRoads.forEach((n) => {
      const bridgePositions = [];
      const sampleStep = BRIDGE_SEGMENT_LENGTH;

      // Ensure we have access to the constants
      const constants = {
        WATER_LEVEL,
        MOUNTAIN_LEVEL,
      };

      const margin = 900;
      const rawSamples = [];
      const minHeight = WATER_LEVEL + 60;

      for (
        let sampleZ = -halfChunk - margin;
        sampleZ <= halfChunk + margin;
        sampleZ += sampleStep
      ) {
        const wz = worldOffsetZ + sampleZ + sampleStep / 2;
        const roadX = ChillFlightLogic.getRoadCenterX(wz, n);
        if (roadX >= 0) continue;

        const naturalH = ChillFlightLogic.getElevation(
          roadX,
          wz,
          simplex,
          constants,
          null,
          {ignoreRivers: true, ignoreRoads: true, forRoad: true}
        );
        let rawY = minHeight + (naturalH - minHeight) * 0.35;
        rawY = Math.max(rawY, minHeight);
        rawY = Math.min(rawY, ChillFlightLogic.MAX_HIGHWAY_HEIGHT);

        const actualTerrainH = getElevation(roadX, wz);

        rawSamples.push({
          sampleZ,
          wz,
          roadX,
          localRoadX: roadX - worldOffsetX,
          rawY,
          actualTerrainH,
        });
      }

      if (rawSamples.length > 0) {
        // 1. Identify elevated bridge spans over water / deep canyons
        const isBridgeSegment = new Uint8Array(rawSamples.length);
        for (let i = 0; i < rawSamples.length; i++) {
          isBridgeSegment[i] =
            rawSamples[i].rawY - rawSamples[i].actualTerrainH > 10 ? 1 : 0;
        }

        // Ground highway segments follow rawY directly to sit flush with the carved canyon floor
        const finalY = new Float32Array(rawSamples.length);
        for (let i = 0; i < rawSamples.length; i++) {
          finalY[i] = Math.max(
            rawSamples[i].rawY,
            rawSamples[i].actualTerrainH + 1.0
          );
        }

        // 2. Linearly grade elevated bridge spans between entry and exit abutments to remove jagged elevation changes
        let runStart = -1;
        for (let i = 0; i <= rawSamples.length; i++) {
          const isElevated = i < rawSamples.length && isBridgeSegment[i] === 1;
          if (isElevated && runStart === -1) {
            runStart = i;
          } else if (!isElevated && runStart !== -1) {
            const runEnd = i - 1;
            const yStart =
              runStart > 0 ? finalY[runStart - 1] : finalY[runStart];
            const yEnd =
              runEnd < rawSamples.length - 1
                ? finalY[runEnd + 1]
                : finalY[runEnd];
            const spanLen = runEnd - runStart + 2;
            for (let k = runStart; k <= runEnd; k++) {
              const t = (k - runStart + 1) / spanLen;
              finalY[k] = Math.max(minHeight, yStart + (yEnd - yStart) * t);
              finalY[k] = Math.max(
                finalY[k],
                rawSamples[k].actualTerrainH + 1.0
              );
            }
            runStart = -1;
          }
        }

        // 3. Assemble bridgePositions for this chunk
        for (let i = 0; i < rawSamples.length - 1; i++) {
          const curr = rawSamples[i];
          const next = rawSamples[i + 1];

          // Only keep segments whose center falls inside this chunk
          if (curr.sampleZ < -halfChunk || curr.sampleZ >= halfChunk) continue;
          if (Math.abs(curr.localRoadX) > halfChunk + 50) continue;

          const needsPilings = finalY[i] - curr.actualTerrainH > 10;

          bridgePositions.push({
            x: curr.localRoadX,
            y: finalY[i],
            z: curr.sampleZ + sampleStep / 2,
            needsPilings: needsPilings,
            terrainH: curr.actualTerrainH,
            nextPos: {
              x: next.localRoadX,
              y: finalY[i + 1],
              z: curr.sampleZ + sampleStep * 1.5,
            },
          });
        }
      }

      if (bridgePositions.length > 0) {
        // 1. Determine which segments need girders, railings, and piers
        let numGirderSegments = 0;
        let numRailSegments = 0;
        let numPiers = 0;

        bridgePositions.forEach((pos) => {
          if (pos.needsPilings) {
            numGirderSegments++;
            numRailSegments++;

            const midZ = (pos.z + pos.nextPos.z) / 2;
            const globalZ = worldOffsetZ + midZ;
            const globalSegmentIndex = Math.round(
              globalZ / BRIDGE_SEGMENT_LENGTH
            );
            // Place major piers every 4 segments (120 units)
            pos.hasPier = Math.abs(globalSegmentIndex) % 4 === 0;
          } else {
            pos.hasPier = false;
          }
        });

        // Ensure short elevated bridge runs that missed the % 4 cadence still get at least one central pier
        let runStart = -1;
        for (let i = 0; i <= bridgePositions.length; i++) {
          const isElevated =
            i < bridgePositions.length && bridgePositions[i].needsPilings;
          if (isElevated && runStart === -1) {
            runStart = i;
          } else if (!isElevated && runStart !== -1) {
            let hasAnyPier = false;
            let maxClearanceIdx = runStart;
            let maxClearance = -1;
            for (let j = runStart; j < i; j++) {
              if (bridgePositions[j].hasPier) hasAnyPier = true;
              const cl = bridgePositions[j].y - bridgePositions[j].terrainH;
              if (cl > maxClearance) {
                maxClearance = cl;
                maxClearanceIdx = j;
              }
            }
            if (!hasAnyPier && maxClearance > 12) {
              bridgePositions[maxClearanceIdx].hasPier = true;
            }
            runStart = -1;
          }
        }

        bridgePositions.forEach((p) => {
          if (p.hasPier) numPiers++;
        });

        // Road decks (paper-thin, for all segments)
        const deckInst = getInstancedMesh(
          bridgeDeckGeo,
          bridgeDeckMat,
          bridgePositions.length
        );

        // Box girders (trapezoidal underside, only for elevated bridge sections)
        const girderInst = getInstancedMesh(
          bridgeGirderGeo,
          bridgeGirderMat,
          numGirderSegments > 0 ? numGirderSegments : 1
        );

        // Railings (2 per segment, only for elevated bridge sections)
        const railInst = getInstancedMesh(
          bridgeRailGeo,
          bridgePilingMat,
          numRailSegments > 0 ? numRailSegments * 2 : 1
        );

        // Pier caps (sculpted hammerhead brackets)
        const pierCapInst = getInstancedMesh(
          bridgePierCapGeo,
          bridgePilingMat,
          numPiers > 0 ? numPiers : 1
        );

        // Pier shafts (faceted octagonal pylons)
        const pierShaftInst = getInstancedMesh(
          bridgePierShaftGeo,
          bridgePilingMat,
          numPiers > 0 ? numPiers : 1
        );

        // Pier footings (foundation caissons)
        const pierFootingInst = getInstancedMesh(
          bridgePierFootingGeo,
          bridgePilingMat,
          numPiers > 0 ? numPiers : 1
        );

        const halfRoadW = ChillFlightLogic.ROAD_WIDTH + 1.4;
        let girderIndex = 0;
        let railIndex = 0;
        let pierIndex = 0;

        // Streetlights
        let slFrequency = 2; // Normal: every other segment
        const absZ = Math.abs(worldOffsetZ);

        // Stop completely (abs(Z) > 50000, 10.0° North/South)
        if (absZ > 50000) {
          slFrequency = 0;
          // Sparse further out (abs(Z) > 25000, 5.0° North/South)
        } else if (absZ > 25000) {
          slFrequency = 8;
          // Somewhat sparse further out (abs(Z) > 15000, 3.0° North/South)
        } else if (absZ > 15000) {
          slFrequency = 4;
        }

        // Calculate exact number of streetlights based on global segment alignment
        let numStreetlights = 0;
        if (slFrequency > 0) {
          bridgePositions.forEach((pos) => {
            const midZ = (pos.z + pos.nextPos.z) / 2;
            const globalZ = worldOffsetZ + midZ;
            const globalSegmentIndex = Math.round(
              globalZ / BRIDGE_SEGMENT_LENGTH
            );
            if (Math.abs(globalSegmentIndex) % slFrequency === 0) {
              numStreetlights++;
            }
          });
        }
        const slBaseInst = getInstancedMesh(
          streetlightPoleGeo,
          streetlightPoleMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        const slArmInst = getInstancedMesh(
          streetlightArmGeo,
          streetlightPoleMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        const slBulbInst = getInstancedMesh(
          streetlightBulbGeo,
          streetlightBulbMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        const slDecalInst = getInstancedMesh(
          streetlightDecalGeo,
          streetlightDecalMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        let slIndex = 0;

        bridgePositions.forEach((pos, index) => {
          const currentVec = new THREE.Vector3(pos.x, pos.y, pos.z);
          const nextVec = new THREE.Vector3(
            pos.nextPos.x,
            pos.nextPos.y,
            pos.nextPos.z
          );

          // Calculate center of the edge and the exact distance
          const midVec = currentVec.clone().lerp(nextVec, 0.5);
          const dist = currentVec.distanceTo(nextVec);

          // 1. Deck (paper-thin, for all segments)
          dummy.position.copy(midVec);
          dummy.lookAt(nextVec);
          dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
          dummy.updateMatrix();
          deckInst.setMatrixAt(index, dummy.matrix);

          // Extract just the yaw from the deck's rotation for pilings
          const euler = new THREE.Euler().setFromQuaternion(
            dummy.quaternion,
            'YXZ'
          );
          const yaw = euler.y;

          // 2. Box Girder & Railings (only for elevated bridge segments)
          if (pos.needsPilings) {
            dummy.position.copy(midVec);
            dummy.lookAt(nextVec);
            dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
            dummy.updateMatrix();
            girderInst.setMatrixAt(girderIndex++, dummy.matrix);

            // Railings — one on each side, sitting flush on top of deck (+0.75)
            [-halfRoadW, halfRoadW].forEach((xOff) => {
              dummy.position.copy(midVec);
              dummy.lookAt(nextVec);
              dummy.translateX(xOff);
              dummy.translateY(2.05);
              dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
              dummy.updateMatrix();
              railInst.setMatrixAt(railIndex++, dummy.matrix);
            });
          }

          // 3. Viaduct Piers (every 120 units on elevated sections)
          if (pos.hasPier) {
            const targetGroundY = Math.max(WATER_LEVEL, pos.terrainH);
            const seatY = midVec.y - 7.0;
            const shaftHeight = Math.max(0, seatY - targetGroundY);

            // Hammerhead pier cap (sits flush under deck)
            dummy.position.set(midVec.x, midVec.y, midVec.z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            pierCapInst.setMatrixAt(pierIndex, dummy.matrix);

            // Faceted pylon shaft (stretches from pier cap seat down to ground/water)
            dummy.position.set(midVec.x, seatY, midVec.z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(1, shaftHeight, 1);
            dummy.updateMatrix();
            pierShaftInst.setMatrixAt(pierIndex, dummy.matrix);

            // Foundation footing (anchored into ground/water)
            dummy.position.set(midVec.x, targetGroundY + 1.5, midVec.z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            pierFootingInst.setMatrixAt(pierIndex, dummy.matrix);

            pierIndex++;
          }

          // Streetlights
          if (slFrequency > 0 && slIndex < numStreetlights) {
            const globalZ = worldOffsetZ + midVec.z;
            const globalSegmentIndex = Math.round(
              globalZ / BRIDGE_SEGMENT_LENGTH
            );

            if (Math.abs(globalSegmentIndex) % slFrequency === 0) {
              const isLeftSide =
                Math.floor(Math.abs(globalSegmentIndex) / slFrequency) % 2 ===
                0;

              const sideOff = isLeftSide ? halfRoadW - 0.5 : -halfRoadW + 0.5;
              const slYaw = isLeftSide ? yaw + Math.PI : yaw;

              const dxSl = sideOff * Math.cos(yaw);
              const dzSl = -sideOff * Math.sin(yaw);

              const slPos = new THREE.Vector3(
                midVec.x + dxSl,
                midVec.y,
                midVec.z + dzSl
              );

              // Position pole, arm, bulb
              const slParts = [
                {geo: streetlightPoleGeo, rot: [0, slYaw, 0], pos: [0, 0, 0]},
                {geo: streetlightArmGeo, rot: [0, slYaw, 0], pos: [0, 0, 0]},
                {
                  geo: streetlightBulbGeo,
                  rot: [0, slYaw, 0],
                  pos: [17 * Math.cos(slYaw), 23.8, -17 * Math.sin(slYaw)],
                },
              ];

              slParts.forEach((part, pIdx) => {
                dummy.position.set(
                  slPos.x + part.pos[0],
                  slPos.y + part.pos[1],
                  slPos.z + part.pos[2]
                );
                dummy.rotation.set(...part.rot);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                if (pIdx === 0) slBaseInst.setMatrixAt(slIndex, dummy.matrix);
                else if (pIdx === 1)
                  slArmInst.setMatrixAt(slIndex, dummy.matrix);
                else if (pIdx === 2)
                  slBulbInst.setMatrixAt(slIndex, dummy.matrix);
              });

              // Decal on the road under the bulb
              const decalDx = 17 * Math.cos(slYaw);
              const decalDz = -17 * Math.sin(slYaw);
              // Push it slightly higher (1.2) to prevent any Z-fighting on steep bridges
              const decalPos = new THREE.Vector3(
                slPos.x + decalDx,
                slPos.y + 1.2,
                slPos.z + decalDz
              );

              const forward = new THREE.Vector3()
                .subVectors(nextVec, midVec)
                .normalize();

              dummy.position.copy(decalPos);
              dummy.lookAt(decalPos.clone().add(forward));
              dummy.scale.set(1.5, 1, 1.5); // Perfectly circular, large soft pool
              dummy.updateMatrix();
              slDecalInst.setMatrixAt(slIndex, dummy.matrix);

              slIndex++;
            }
          }
        });

        deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
        group.add(deckInst);

        if (numGirderSegments > 0) {
          girderInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(girderInst);
        }

        if (numRailSegments > 0) {
          railInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(railInst);
        }

        if (numPiers > 0) {
          pierCapInst.position.set(worldOffsetX, 0, worldOffsetZ);
          pierShaftInst.position.set(worldOffsetX, 0, worldOffsetZ);
          pierFootingInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(pierCapInst);
          group.add(pierShaftInst);
          group.add(pierFootingInst);
        }

        if (numStreetlights > 0) {
          slBaseInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slArmInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slBulbInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slDecalInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(slBaseInst);
          group.add(slArmInst);
          group.add(slBulbInst);
          group.add(slDecalInst);
        }
      }
    }); // End activeRoads.forEach
  }

  // 2.96 Generate Campfires
  if (campfirePositions.length > 0) {
    const logInst = getInstancedMesh(
      fireLogGeo,
      woodMat,
      campfirePositions.length * 3
    );
    const coreInst = getInstancedMesh(
      fireCoreGeo,
      fireMat,
      campfirePositions.length
    );
    const smokeInst = getInstancedMesh(
      smokeGeo,
      smokeMat,
      campfirePositions.length * 5
    ); // 5 particles per fire community
    const numTentColors = tentPalette.length;
    const tentCounts = Array(numTentColors).fill(0);
    const tentColorIndices = []; // Maps index to colorIndex

    campfirePositions.forEach((pos, index) => {
      // Deterministic color selection using seed-based RNG
      const colorIdx = Math.floor(rng() * numTentColors);
      tentColorIndices[index] = colorIdx;
      tentCounts[colorIdx]++;
    });

    const tentInsts = [];
    const tentPolesInst = getInstancedMesh(
      tentPolesGeo,
      woodMat,
      campfirePositions.length
    );
    const tentEntranceInst = getInstancedMesh(
      tentEntranceGeo,
      tentEntranceMat,
      campfirePositions.length
    );
    const currentComboIndices = Array(numTentColors).fill(0);

    for (let i = 0; i < numTentColors; i++) {
      if (tentCounts[i] > 0) {
        tentInsts[i] = getInstancedMesh(tentGeo, tentPalette[i], tentCounts[i]);
        tentInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(tentInsts[i]);
      }
    }

    tentPolesInst.position.set(worldOffsetX, 0, worldOffsetZ);
    tentEntranceInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(tentPolesInst, tentEntranceInst);

    campfirePositions.forEach((pos, index) => {
      const structure = ModelAssembler.getStructure('campfire', pos.rotY || 0);
      structure.forEach((part, pIdx) => {
        dummy.position.set(
          pos.x + part.pos[0],
          pos.y + part.pos[1],
          pos.z + part.pos[2]
        );
        dummy.rotation.order = part.order || 'XYZ';
        dummy.rotation.set(...part.rot);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        if (part.geo === fireLogGeo) {
          logInst.setMatrixAt(index * 3 + pIdx, dummy.matrix);
        } else if (part.geo === fireCoreGeo) {
          coreInst.setMatrixAt(index, dummy.matrix);
        }
      });

      // Smoke community
      for (let i = 0; i < 5; i++) {
        dummy.position.set(pos.x, pos.y + 5, pos.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        const smokeIdx = index * 5 + i;
        smokeInst.setMatrixAt(smokeIdx, dummy.matrix);

        const phase = ((pos.x + pos.z) % 10.0) / 10.0;
        smokeInst.setColorAt(smokeIdx, new THREE.Color(i / 10.0, phase, 0));
      }

      // Tent community
      const angle = rng() * Math.PI * 2;
      const dist = 12 + rng() * 4;
      const tentX = pos.x + Math.cos(angle) * dist;
      const tentZ = pos.z + Math.sin(angle) * dist;
      const tentY = getElevation(worldOffsetX + tentX, worldOffsetZ + tentZ);

      dummy.position.set(tentX, tentY, tentZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      const colorIdx = tentColorIndices[index];
      const instIdx = currentComboIndices[colorIdx]++;
      tentInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

      tentPolesInst.setMatrixAt(index, dummy.matrix);
      tentEntranceInst.setMatrixAt(index, dummy.matrix);
    });

    logInst.position.set(worldOffsetX, 0, worldOffsetZ);
    coreInst.position.set(worldOffsetX, 0, worldOffsetZ);
    smokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(logInst);
    objectsGroup.add(coreInst);
    objectsGroup.add(smokeInst);

    group.userData.campfires = coreInst;
    group.userData.campfireSmoke = smokeInst;
  }

  // 2.97 Generate Chimney Smoke
  if (chimneySmokePositions.length > 0) {
    const chimneySmokeInst = getInstancedMesh(
      smokeGeo,
      whiteSmokeMat,
      chimneySmokePositions.length * 4
    );

    chimneySmokePositions.forEach((pos, index) => {
      for (let i = 0; i < 4; i++) {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        const smokeIdx = index * 4 + i;
        chimneySmokeInst.setMatrixAt(smokeIdx, dummy.matrix);

        const phase = ((pos.x + pos.z) % 10.0) / 10.0;
        chimneySmokeInst.setColorAt(
          smokeIdx,
          new THREE.Color(i / 10.0, phase, 0)
        );
      }
    });

    chimneySmokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(chimneySmokeInst);

    group.userData.chimneySmoke = chimneySmokeInst;
  }

  // 2.98 Generate Sailboats
  let watercraftGroup = null;
  if (sailboatPositions.length > 0 || pirateShipPositions.length > 0) {
    watercraftGroup = new THREE.Group();
    watercraftGroup.visible = state._enableObjects;
    group.add(watercraftGroup);
    group.userData.watercraftGroup = watercraftGroup;
  }

  if (sailboatPositions.length > 0) {
    const numBoatColors = boatHullPalette.length;
    const boatCounts = Array(numBoatColors).fill(0);
    const boatColorIndices = [];

    sailboatPositions.forEach((pos, index) => {
      const colorIdx =
        (pos.bodyId !== undefined
          ? pos.bodyId
          : Math.floor(rng() * numBoatColors)) % numBoatColors;
      boatColorIndices[index] = colorIdx;
      boatCounts[colorIdx]++;
    });

    const hullInsts = [];
    const currentComboIndices = Array(numBoatColors).fill(0);
    const boatInstIndices = [];

    for (let i = 0; i < numBoatColors; i++) {
      if (boatCounts[i] > 0) {
        hullInsts[i] = getInstancedMesh(
          boatHullGeo,
          boatHullPalette[i],
          boatCounts[i]
        );
        hullInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
        watercraftGroup.add(hullInsts[i]);
      }
    }

    const rimInst = getInstancedMesh(
      boatRimGeo,
      boatRimMat,
      sailboatPositions.length
    );
    const deckInst = getInstancedMesh(
      boatDeckGeo,
      boatDeckMat,
      sailboatPositions.length
    );
    const mastInst = getInstancedMesh(
      boatMastGeo,
      woodMat,
      sailboatPositions.length
    );
    const boomInst = getInstancedMesh(
      boatBoomGeo,
      woodMat,
      sailboatPositions.length
    );
    const sailInst = getInstancedMesh(
      boatSailGeo,
      boatSailMat,
      sailboatPositions.length
    );
    const sailboatReflectionInst = getInstancedMesh(
      sailboatReflectionGeo,
      reflectionMat,
      sailboatPositions.length
    );

    sailboatPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1.8, 1.8, 1.8);
      dummy.updateMatrix();

      const colorIdx = boatColorIndices[index];
      const instIdx = currentComboIndices[colorIdx]++;
      boatInstIndices[index] = instIdx;
      hullInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

      rimInst.setMatrixAt(index, dummy.matrix);
      deckInst.setMatrixAt(index, dummy.matrix);
      mastInst.setMatrixAt(index, dummy.matrix);
      boomInst.setMatrixAt(index, dummy.matrix);
      sailInst.setMatrixAt(index, dummy.matrix);

      // Initialize reflection matrix with Y-flipped scale
      dummy.scale.set(1.8, -1.8, 1.8);
      dummy.updateMatrix();
      sailboatReflectionInst.setMatrixAt(index, dummy.matrix);
    });

    rimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
    boomInst.position.set(worldOffsetX, 0, worldOffsetZ);
    sailInst.position.set(worldOffsetX, 0, worldOffsetZ);
    sailboatReflectionInst.position.set(worldOffsetX, 0, worldOffsetZ);
    watercraftGroup.add(
      rimInst,
      deckInst,
      mastInst,
      boomInst,
      sailInst,
      sailboatReflectionInst
    );

    // Performance optimization: When boats are outside the 2,000-unit dynamic animation
    // radius, per-frame matrix recalculations and buffer re-uploads are paused.
    // Marking needsUpdate = true once upon creation guarantees their static resting matrices
    // are uploaded to the GPU on first render so they remain visible from any distance.
    rimInst.instanceMatrix.needsUpdate = true;
    deckInst.instanceMatrix.needsUpdate = true;
    mastInst.instanceMatrix.needsUpdate = true;
    boomInst.instanceMatrix.needsUpdate = true;
    sailInst.instanceMatrix.needsUpdate = true;
    sailboatReflectionInst.instanceMatrix.needsUpdate = true;
    hullInsts.forEach((h) => {
      if (h) h.instanceMatrix.needsUpdate = true;
    });

    group.userData.sailboatPositions = sailboatPositions;
    group.userData.boatHulls = hullInsts;
    group.userData.boatColorIndices = boatColorIndices;
    group.userData.boatInstIndices = boatInstIndices;
    group.userData.boatMasts = mastInst;
    group.userData.boatSails = sailInst;
    group.userData.boatRims = rimInst;
    group.userData.boatDecks = deckInst;
    group.userData.boatBooms = boomInst;
    group.userData.boatReflections = sailboatReflectionInst;
  }

  // 3.5 Pirate Ships
  if (pirateShipPositions.length > 0) {
    const sailInsts = pirateSailPalette.map((mat) =>
      getInstancedMesh(pirateSailGeo, mat, pirateShipPositions.length)
    );
    const hullInst = getInstancedMesh(
      pirateHullGeo,
      pirateHullMat,
      pirateShipPositions.length
    );
    const rimInst = getInstancedMesh(
      pirateRimGeo,
      pirateRimMat,
      pirateShipPositions.length
    );
    const deckInst = getInstancedMesh(
      pirateDeckGeo,
      woodMat,
      pirateShipPositions.length
    );
    const mastInst = getInstancedMesh(
      pirateMastGeo,
      woodMat,
      pirateShipPositions.length
    );
    const flagInst = getInstancedMesh(
      pirateFlagGeo,
      pirateFlagMat,
      pirateShipPositions.length
    );
    const jrInst = getInstancedMesh(
      pirateJollyRogerGeo,
      pirateJollyRogerMat,
      pirateShipPositions.length
    );
    const pirateReflectionInst = getInstancedMesh(
      pirateShipReflectionGeo,
      reflectionMat,
      pirateShipPositions.length
    );

    const sailCounts = new Array(pirateSailPalette.length).fill(0);

    pirateShipPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(2.5, 2.5, 2.5);
      dummy.updateMatrix();

      const colorIdx =
        (pos.bodyId !== undefined ? pos.bodyId : 0) % pirateSailPalette.length;
      const instIdx = sailCounts[colorIdx]++;
      sailInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

      hullInst.setMatrixAt(index, dummy.matrix);
      rimInst.setMatrixAt(index, dummy.matrix);
      deckInst.setMatrixAt(index, dummy.matrix);
      mastInst.setMatrixAt(index, dummy.matrix);
      flagInst.setMatrixAt(index, dummy.matrix);
      jrInst.setMatrixAt(index, dummy.matrix);

      // Initialize reflection matrix with Y-flipped scale
      dummy.scale.set(2.5, -2.5, 2.5);
      dummy.updateMatrix();
      pirateReflectionInst.setMatrixAt(index, dummy.matrix);
    });

    hullInst.position.set(worldOffsetX, 0, worldOffsetZ);
    rimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
    flagInst.position.set(worldOffsetX, 0, worldOffsetZ);
    jrInst.position.set(worldOffsetX, 0, worldOffsetZ);
    pirateReflectionInst.position.set(worldOffsetX, 0, worldOffsetZ);
    watercraftGroup.add(
      hullInst,
      rimInst,
      deckInst,
      mastInst,
      flagInst,
      jrInst,
      pirateReflectionInst
    );

    sailInsts.forEach((inst, idx) => {
      if (sailCounts[idx] > 0) {
        inst.count = sailCounts[idx];
        inst.position.set(worldOffsetX, 0, worldOffsetZ);
        watercraftGroup.add(inst);
      }
    });

    // Performance optimization: When pirate ships are outside 2,000 units, dynamic
    // patrol and wave calculations are culled. Marking needsUpdate = true once ensures
    // their resting matrices are uploaded to the GPU on initial chunk render.
    hullInst.instanceMatrix.needsUpdate = true;
    rimInst.instanceMatrix.needsUpdate = true;
    deckInst.instanceMatrix.needsUpdate = true;
    mastInst.instanceMatrix.needsUpdate = true;
    flagInst.instanceMatrix.needsUpdate = true;
    jrInst.instanceMatrix.needsUpdate = true;
    pirateReflectionInst.instanceMatrix.needsUpdate = true;
    sailInsts.forEach((inst) => {
      if (inst) inst.instanceMatrix.needsUpdate = true;
    });

    group.userData.pirateShipPositions = pirateShipPositions;
    group.userData.pirateHulls = hullInst;
    group.userData.pirateRims = rimInst;
    group.userData.pirateDecks = deckInst;
    group.userData.pirateMasts = mastInst;
    group.userData.pirateFlags = flagInst;
    group.userData.pirateJollyRogers = jrInst;
    group.userData.pirateSails = sailInsts;
    group.userData.pirateReflections = pirateReflectionInst;
  }

  // 4. Generate Birds
  group.userData.birds = [];

  workerData.chunkProps.birds.forEach((bData) => {
    if (bData.type === 'seagull') {
      const seagull = assembleSeagull(bData.scale);
      seagull.position.set(bData.x, bData.y, bData.z);

      seagull.userData.type = 'seagull';
      seagull.userData.speed = 0.5;
      seagull.userData.circleSpeed = bData.circleSpeed;
      seagull.userData.circleRadius = bData.circleRadius;
      seagull.userData.circleCenter = new THREE.Vector3(
        bData.circleCenter.x,
        bData.circleCenter.y,
        bData.circleCenter.z
      );
      seagull.userData.angle = bData.angle;
      seagull.userData.flapPhase = bData.flapPhase;
      seagull.userData.flapSpeed = bData.flapSpeed;
      seagull.userData.flapDuration = bData.flapDuration;
      seagull.userData.soarDuration = bData.soarDuration;
      seagull.userData.isDiving = false;
      seagull.userData.diveTimer = bData.diveTimer;
      seagull.userData.nextDiveWait = bData.nextDiveWait;

      objectsGroup.add(seagull);
      group.userData.birds.push(seagull);
    } else if (bData.type === 'hawk') {
      const hawk = assembleHawk(bData.scale);
      hawk.position.set(bData.x, bData.y, bData.z);
      hawk.rotation.y = bData.rotY;

      hawk.userData.type = 'hawk';
      hawk.userData.speed = 0.4;
      hawk.userData.circleSpeed = bData.circleSpeed;
      hawk.userData.circleRadius = bData.circleRadius;
      hawk.userData.circleCenter = new THREE.Vector3(
        bData.circleCenter.x,
        bData.circleCenter.y,
        bData.circleCenter.z
      );
      hawk.userData.angle = bData.angle;
      hawk.userData.flapPhase = bData.flapPhase;
      hawk.userData.flapSpeed = bData.flapSpeed;
      hawk.userData.flapDuration = bData.flapDuration;
      hawk.userData.soarDuration = bData.soarDuration;
      hawk.userData.isDiving = false;

      objectsGroup.add(hawk);
      group.userData.birds.push(hawk);
    } else if (bData.type === 'goose') {
      const goose = new THREE.Group();
      const body = new THREE.Mesh(gooseBodyGeo, gooseBrownMat);
      const neck = new THREE.Mesh(gooseNeckGeo, gooseBlackMat);
      const head = new THREE.Mesh(gooseHeadGeo, gooseBlackMat);
      const beak = new THREE.Mesh(gooseBeakGeo, gooseBlackMat);
      const cheek = new THREE.Mesh(gooseCheekGeo, gooseWhiteMat);
      const tailWhite = new THREE.Mesh(gooseWhiteTailGeo, gooseWhiteMat);
      const tailBlack = new THREE.Mesh(gooseTailGeo, gooseBlackMat);
      const wingL = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
      const wingR = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
      wingL.rotation.y = Math.PI;
      goose.add(
        body,
        neck,
        head,
        beak,
        cheek,
        tailWhite,
        tailBlack,
        wingL,
        wingR
      );
      goose.scale.set(3.5, 3.5, 3.5);
      goose.userData.wings = [wingL, wingR];

      goose.position.set(bData.x, bData.y, bData.z);
      goose.rotation.y = bData.rotY;

      goose.userData.type = 'goose';
      goose.userData.speed = bData.speed;
      goose.userData.flapPhase = bData.flapPhase;
      goose.userData.flapSpeed = bData.flapSpeed;
      goose.userData.flapDuration = bData.flapDuration;
      goose.userData.soarDuration = bData.soarDuration;
      goose.userData.isDiving = false;

      objectsGroup.add(goose);
      group.userData.birds.push(goose);
    }
  });

  if (group.userData.birds.length > 0) {
    birdChunks.add(group);
  }

  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      if (child.material.userData.isWater) {
        child.receiveShadow = true;
      } else if (
        child.material !== smokeMat &&
        child.material !== lighthouseBeamMat &&
        child.material !== houseDoorMat &&
        !houseWindowMats.includes(child.material) &&
        child.geometry !== houseDoorGeo &&
        child.geometry !== houseWindowGeo &&
        child.geometry !== streetlightDecalGeo
      ) {
        child.castShadow = true;
        child.receiveShadow = true;
      } else {
        child.receiveShadow = true;
      }
    }
  });

  group.userData.counts = {
    ...workerData.chunkProps.counts,
    houses:
      housePositions.length +
      pagodaPositions.length +
      barnPositions.length +
      monasteryPositions.length +
      castleRuinsPositions.length,
    lighthouses: lighthousePos ? 1 : 0,
    castles: castleRuinsPositions.length,
    windmills: windmillPositions.length,
    campfires: campfirePositions.length,
    boats: sailboatPositions.length,
    pirateships: pirateShipPositions.length,
    piers: pierPositions.length,
    birds: group.userData.birds.length,
    chimneys: chimneySmokePositions.length,
  };

  if (sailboatPositions.length > 0 || pirateShipPositions.length > 0) {
    watercraftChunks.add(group);
  }

  group.userData.instanceData = workerData.instanceData;
  enableChunkInstanceCulling(group, chunkX, chunkZ);
  scene.add(group);
  return group;
}

// Chunk props are pooled instanced meshes created with culling off (a reused
// mesh's automatic bounds would be stale), so every chunk's props were drawn
// every frame, in the main view and the shadow map, even when off-screen.
// Give them a fixed sphere around the whole chunk instead, so three.js can
// skip chunks outside the camera or shadow frustum. The sphere covers the
// chunk's corners from sea level to the highest peaks (~1,600), plus drifting
// boats and props at the edges. Some meshes sit under chunk-offset parents,
// so the sphere is expressed in each mesh's own space.
const CHUNK_CULL_CENTER_Y = 800;
const CHUNK_CULL_RADIUS = 1700;
const _toMeshSpace = new THREE.Matrix4();

function enableChunkInstanceCulling(group, chunkX, chunkZ) {
  const worldCenter = new THREE.Vector3(
    chunkX * CHUNK_SIZE,
    CHUNK_CULL_CENTER_Y,
    chunkZ * CHUNK_SIZE
  );
  group.updateMatrixWorld(true);
  group.traverse((object) => {
    if (object.isInstancedMesh) {
      _toMeshSpace.copy(object.matrixWorld).invert();
      object.boundingSphere = new THREE.Sphere(
        worldCenter.clone().applyMatrix4(_toMeshSpace),
        CHUNK_CULL_RADIUS
      );
      object.frustumCulled = true;
    }
  });
}

export function updateChunks() {
  const target =
    typeof window !== 'undefined' && state.isFreeCamera ? camera : planeGroup;
  const currentChunkX = Math.round(target.position.x / CHUNK_SIZE);
  const currentChunkZ = Math.round(target.position.z / CHUNK_SIZE);
  const renderDistance = state.RENDER_DISTANCE;

  // Compute forward horizontal unit vector for directional priority
  let fwdX = 0;
  let fwdZ = -1;
  if (target && target.quaternion) {
    const fwdVec = new THREE.Vector3(0, 0, -1).applyQuaternion(
      target.quaternion
    );
    const fwdLen = Math.hypot(fwdVec.x, fwdVec.z);
    if (fwdLen > 0.001) {
      fwdX = fwdVec.x / fwdLen;
      fwdZ = fwdVec.z / fwdLen;
    }
  }

  const computeChunkPriority = (cx, cz) => {
    const dx = cx - currentChunkX;
    const dz = cz - currentChunkZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.001) return 1000;
    const dot = (dx * fwdX + dz * fwdZ) / dist; // -1 to 1
    // Prioritize closer chunks, with forward chunks heavily favored
    return -dist * 10 + dot * 25;
  };

  // Update dynamic priorities for workers
  if (
    typeof window !== 'undefined' &&
    terrainWorkerManager &&
    terrainWorkerManager.isSupported
  ) {
    terrainWorkerManager.updatePriorities(computeChunkPriority);
  }

  const missingChunks = [];

  for (let x = -renderDistance; x <= renderDistance; x++) {
    for (let z = -renderDistance; z <= renderDistance; z++) {
      const cx = currentChunkX + x;
      const cz = currentChunkZ + z;
      const key = `${cx},${cz}`;
      if (!chunks.has(key) && !chunkQueueSet.has(key)) {
        const priority = computeChunkPriority(cx, cz);
        missingChunks.push({
          cx,
          cz,
          key,
          priority,
          distSq: x * x + z * z,
        });
        chunkQueueSet.add(key);
        if (
          typeof window !== 'undefined' &&
          terrainWorkerManager &&
          terrainWorkerManager.isSupported
        ) {
          queueWorkerChunk(cx, cz, key, priority);
        }
      }
    }
  }

  // Sort missing chunks ascending by priority so popping from the end yields the highest priority chunk
  missingChunks.sort((a, b) => a.priority - b.priority);
  state.chunkQueue.push(...missingChunks);

  // Prune chunks from queue that are beyond renderDistance + 2 to prevent queue bloat
  const maxQueueDistSq = (renderDistance + 2) * (renderDistance + 2);
  const prunedQueue = [];
  state.chunkQueue.forEach((item) => {
    const dx = item.cx - currentChunkX;
    const dz = item.cz - currentChunkZ;
    const dSq = dx * dx + dz * dz;
    if (dSq <= maxQueueDistSq) {
      item.distSq = dSq;
      item.priority = computeChunkPriority(item.cx, item.cz);
      prunedQueue.push(item);
    } else {
      chunkQueueSet.delete(item.key);
      workerChunkRequests.delete(item.key);
      workerChunkResults.delete(item.key);
      if (
        typeof window !== 'undefined' &&
        terrainWorkerManager &&
        terrainWorkerManager.isSupported
      ) {
        terrainWorkerManager.cancelJob(item.cx, item.cz);
      }
    }
  });
  state.chunkQueue = prunedQueue;
  // Sort ascending by priority so popping from the end yields the highest priority chunk
  state.chunkQueue.sort((a, b) => a.priority - b.priority);

  let chunksEvicted = false;

  chunks.forEach((group, key) => {
    const cx = group.userData.chunkX;
    const cz = group.userData.chunkZ;
    if (
      Math.abs(cx - currentChunkX) > renderDistance + 1 ||
      Math.abs(cz - currentChunkZ) > renderDistance + 1
    ) {
      // Collect instanced meshes and pool/dispose unique geometries in a single traversal
      const instancedMeshesToRelease = [];
      group.traverse((child) => {
        if (child.isInstancedMesh) {
          instancedMeshesToRelease.push(child);
        }
        if (child.isMesh || child.isInstancedMesh) {
          if (child.geometry && child.geometry.userData.unique) {
            if (child.geometry.userData.poolType === 'terrain') {
              if (
                _terrainGeometryPool.length < 25 &&
                child.geometry.parameters &&
                child.geometry.parameters.widthSegments === state.SEGMENTS
              ) {
                _terrainGeometryPool.push(child.geometry);
              } else {
                child.geometry.dispose();
              }
            } else if (child.geometry.userData.poolType === 'water') {
              const wSegments = Math.max(1, Math.floor(state.SEGMENTS / 4));
              if (
                _waterGeometryPool.length < 25 &&
                child.geometry.parameters &&
                child.geometry.parameters.widthSegments === wSegments
              ) {
                _waterGeometryPool.push(child.geometry);
              } else {
                child.geometry.dispose();
              }
            } else {
              child.geometry.dispose();
            }
          }
        }
      });

      // Detach all child objects and clear chunk references
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }

      for (let i = 0; i < instancedMeshesToRelease.length; i++) {
        releaseInstancedMesh(instancedMeshesToRelease[i]);
      }
      group.userData.instanceData = null;
      group.userData.objectsGroup = null;
      group.userData.watercraftGroup = null;
      disposeWaterDepthTexture(group.userData.water);
      group.userData.water = null;
      group.userData.sailboatPositions = null;
      group.userData.boatHulls = null;
      group.userData.boatColorIndices = null;
      group.userData.boatInstIndices = null;
      group.userData.boatMasts = null;
      group.userData.boatSails = null;
      group.userData.boatRims = null;
      group.userData.boatDecks = null;
      group.userData.boatBooms = null;
      group.userData.boatReflections = null;
      group.userData.pirateShipPositions = null;
      group.userData.pirateHulls = null;
      group.userData.pirateRims = null;
      group.userData.pirateDecks = null;
      group.userData.pirateMasts = null;
      group.userData.pirateFlags = null;
      group.userData.pirateJollyRogers = null;
      group.userData.pirateSails = null;
      group.userData.pirateReflections = null;
      group.userData.birds = null;
      group.userData.counts = null;
      group.userData.rockArch = null;

      scene.remove(group);
      chunks.delete(key);
      watercraftChunks.delete(group);
      birdChunks.delete(group);
      workerChunkRequests.delete(key);
      workerChunkResults.delete(key);
      if (
        typeof window !== 'undefined' &&
        terrainWorkerManager &&
        terrainWorkerManager.isSupported
      ) {
        terrainWorkerManager.cancelJob(cx, cz);
      }
      chunksEvicted = true;
      if (key === '4,2') {
        if (persistentLighthouseLight) persistentLighthouseLight.intensity = 0;
        if (persistentLighthouseBeam) persistentLighthouseBeam.visible = false;
      }
    }
  });

  if (chunksEvicted) {
    globalInstancer.requestRebuild();
  }
}

// A queued chunk is ready to build once its worker result has arrived. It is
// built on the main thread (much slower) only when workers are unavailable or
// its worker job failed.
function isChunkReady(key) {
  return (
    workerChunkResults.has(key) ||
    workerChunkFailed.has(key) ||
    !terrainWorkerManager.isSupported
  );
}

// Builds ready chunks, highest priority first, until budgetMs is used up
// (always at least one per frame, so loading never stalls).
export function processChunkQueue(budgetMs = 4) {
  if (state.chunkQueue.length === 0) return 1.0;

  const start = performance.now();
  let generatedThisFrame = 0;

  while (state.chunkQueue.length > 0) {
    let itemIdx = -1;
    for (let i = state.chunkQueue.length - 1; i >= 0; i--) {
      if (isChunkReady(state.chunkQueue[i].key)) {
        itemIdx = i;
        break;
      }
    }
    if (itemIdx === -1) break;

    const item = state.chunkQueue.splice(itemIdx, 1)[0];
    chunkQueueSet.delete(item.key);
    const workerData = workerChunkResults.get(item.key) || null;
    workerChunkResults.delete(item.key);
    workerChunkFailed.delete(item.key);

    if (!chunks.has(item.key)) {
      chunks.set(item.key, generateChunk(item.cx, item.cz, workerData));
      generatedThisFrame++;
    }

    if (performance.now() - start >= budgetMs) break;
  }

  if (generatedThisFrame > 0) {
    globalInstancer.requestRebuild();
  }

  return getChunkLoadingProgress();
}

export function getChunkLoadingProgress() {
  const totalChunks = chunks.size + state.chunkQueue.length;
  if (totalChunks === 0) return 1.0;
  return chunks.size / totalChunks;
}
export function toggleProceduralObjects(enabled) {
  state._enableObjects = enabled;
  ChillFlightLogic.setShowObjects(enabled);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('chill_flight_show_objects', enabled);
  }

  // Update all existing chunks
  chunks.forEach((group) => {
    if (group.userData.objectsGroup) {
      group.userData.objectsGroup.visible = enabled;
    }
    if (group.userData.watercraftGroup) {
      group.userData.watercraftGroup.visible = enabled;
    }
  });

  globalInstancer.requestRebuild();

  // Update debug menu UI if it exists
  const toggle = document.getElementById('debug-objects-toggle');
  if (toggle) toggle.checked = enabled;

  if (typeof window !== 'undefined') {
    if (!enabled) {
      updateUrlParams({objects: 'none'});
    } else {
      updateUrlParams({}, ['objects']);
    }
  }
}

// Global expose
