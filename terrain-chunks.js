// --- GLOBAL INSTANCING ARCHITECTURE ---
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {joinColored} from './low-poly.js';
import {breakwaterTopIn} from './breakwater-logic.js';
import {createWaterfall} from './waterfalls.js';
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
  barnMat,
  barnRoofGeo,
  barnSiloBodyGeo,
  barnSiloMat,
  barnSiloRoofGeo,
  barnSiloRoofMat,
  birdChunks,
  headlandLighthouseChunks,
  strayBirds,
  boatBoomGeo,
  boatDeckGeo,
  boatDeckMat,
  boatHullGeo,
  boatHullPalette,
  boatMastGeo,
  boatRimGeo,
  boatRimFoamGeo,
  boatRimMat,
  boatSailGeo,
  boatSailMat,
  bridgeDeckGeo,
  bridgeDeckMat,
  highwayDeckMat,
  ROAD_ASPHALT,
  ROAD_PAINT,
  highwayRailMat,
  ROAD_RAIL,
  townStreetGeo,
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
  cactusShadowGeo,
  cactusMat,
  joshuaGeos,
  joshuaTrunkMat,
  hayBaleGeo,
  hayBarnBodyGeo,
  hayBarnRoofGeo,
  hayBaleMat,
  fallenLogGeo,
  stumpGeo,
  fallenLogMat,
  sealGeo,
  sealMat,
  buoyGeos,
  buoyTopMat,
  breakwaterRockGeos,
  breakwaterHeadGeo,
  breakwaterBeaconGeos,
  breakwaterSurfGeo,
  breakwaterSurfMat,
  sheepGeos,
  goatGeos,
  deerGeos,
  sheepDarkMat,
  iceHutGeos,
  iceHutRoofMat,
  appleTreeGeos,
  birchGeos,
  broadleafOakGeos,
  castleRuinsGeo,
  castleRuinsMat,
  cherryBlossomGeos,
  chunkQueueSet,
  chunks,
  clearElevationCache,
  createRockArchGeometries,
  deadCottonwoodGeo,
  deadTreeGeo,
  deadTreeMat,
  deciduousGeos,
  desertRockMat,
  fireCoreGeo,
  fireGlowMat,
  fireLogGeo,
  fireMat,
  fruitTreeGeos,
  getElevation,
  getInstancedMesh,
  gooseBrownMat,
  gooseStaticGeo,
  penguinGeo,
  penguinMat,
  gooseStaticMat,
  gooseWingGeo,
  houseBodyGeo,
  houseChimneyGeo,
  houseChimneyMat,
  houseDoorGeo,
  houseDoorMat,
  houseRoofGeo,
  houseTintMat,
  houseWindowGeo,
  houseWindowMat,
  iceFloeMainGeo,
  icebergMainGeo,
  icebergMat,
  japaneseMapleGeos,
  lighthouseBeamMat,
  lighthouseBeamGeo,
  LIGHTHOUSE_TOWER_PARTS,
  lighthouseHeadlandBeamMat,
  lilyPadGeo,
  lilyPadMat,
  magnoliaGeos,
  monasteryBodyGeo,
  monasteryBodyMat,
  monasteryRoofGeo,
  monasteryRoofMat,
  mountainRowanGeos,
  mushroomGeos,
  mushroomStalkMat,
  crystalClusterGeo,
  crystalMat,
  crystalShardGeo,
  crystalShardMat,
  crystalSpireGeos,
  oakGeos,
  orchardAppleGeos,
  palmGeos,
  persistentLighthouseBeam,
  persistentLighthouseLight,
  pierDeckGeo,
  pierDeckLGeo,
  pierDeckMat,
  pierPostGeo,
  pirateShipGeos,
  pirateShipReflectionGeos,
  pirateShipMat,
  plumTreeGeos,
  reflectionMat,
  releaseInstancedMesh,
  resetChunkQueue,
  roadCentreDashGeo,
  roadSlipLineGeo,
  SLIP_EDGE_LINE_X,
  ROAD_EDGE_LINE_X,
  roadEdgeLineGeo,
  roadCentreLinesGeo,
  roadLaneDashesGeo,
  roadWhiteMat,
  roadYellowMat,
  rockArchGrassMat,
  rockGeo,
  rockMat,
  sailboatMooredReflectionGeo,
  sailboatMoored,
  sailboatReflectionGeo,
  SAIL_FURL,
  sculptedPineGeos,
  smokeGeo,
  smokeMat,
  snowRockMat,
  snowSpruceGeos,
  snowmanGeo,
  snowmanMat,
  strawHutBodyGeo,
  timberBarnBodyGeo,
  timberBarnRoofGeo,
  strawHutMat,
  strawHutRoofGeo,
  streetlightArmGeo,
  streetlightBulbGeo,
  streetlightBulbMat,
  streetlightDecalGeo,
  streetlightDecalMat,
  tentGeos,
  tentMat,
  streetlightPoleGeo,
  streetlightPoleMat,
  tallDeciduousGeos,
  terrainMaterial,
  treeLeavesBaseMat,
  treeLeavesGeo,
  treeTrunkGeo,
  treeTrunkMat,
  twistedDeadOakGeo,
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
  FAR_CELL,
  FAR_SEGMENTS,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  MOUNTAIN_LEVEL,
  WATER_LEVEL,
  updateUrlParams,
} from './constants.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {boatMat, buildSmallBoatGeos} from './boat-models.js';
import {buildTractorGeos} from './farm-models.js';
import {buildSwampGeos, createSwampFarCanopy} from './swamp-models.js';
import {
  buildLandmarkGeos,
  buildingMat,
  LANDMARK_HOUSES,
  LANDMARK_SMALL,
  LANDMARK_TOWERS,
  PIER_DECK_TOP,
} from './building-models.js';
import {log} from './logger.js';
import {simplex} from './noise.js';
import {camera, dirLight, renderer} from './sky.js';
import {planeGroup} from './airplane.js';
import {terrainWorkerManager} from './terrain-worker-manager.js';
import {ALIEN_PROPS_AT, BREAKABLE, generateChunkData} from './terrain-gen.js';
import {hooks} from './hooks.js';
import {state} from './state.js';

// Geese whose chunk has unloaded fly on in the scene, animated with the rest
scene.add(strayBirds);
birdChunks.add(strayBirds);

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
// distance (~10 km) into the shadow map. Instead a shadow-only mesh per type
// holds just the chunks whose box touches the shadow camera's frustum. The
// set is refreshed once the light has moved SHADOW_REBUILD_STEP, so each
// chunk's box is padded by that much: chunks the shadow map reaches before
// the next refresh already cast.
const TREE_SHADOW_CHUNK_RADIUS = 4;
const SHADOW_REBUILD_STEP = 700;
const SHADOW_REBUILD_STEP_SQ = SHADOW_REBUILD_STEP * SHADOW_REBUILD_STEP;
const SHADOW_CHUNK_HALF = CHUNK_SIZE / 2 + SHADOW_REBUILD_STEP;
const _shadowMatrix = new THREE.Matrix4();
const _shadowFrustum = new THREE.Frustum();
const _chunkShadowBox = new THREE.Box3();

// Beyond this many chunks (~3 km) from the plane, types with a far version
// (see setFarGeometry below) swap to it: a 5-unit bush or a tree canopy is a
// few pixels across at that range, so the full models only cost triangles.
// (Woods are dense enough that 3 chunks out cost ~350k more triangles.)
const TREE_LOD_CHUNK_RADIUS = 2;

// Canopies, palms, cacti and bushes (setFarGeometry's `screenSized`) keep
// their full models only out to where a canopy still spans this many pixels:
// within 1 chunk (at least 1,500 units) on a phone, 2 on a bigger screen.
// They're most of the triangles drawn, and a 16-unit canopy is 3-4 pixels
// across on a phone at 2 chunks.
const CANOPY_DETAIL_PIXELS = 8;
// Types with a close-up version (setNearGeometry: the full Polyfork trees
// behind the low-poly stand-ins) draw it in the chunks within this many
// units of the plane, usually one or two
const CLOSE_UP_RANGE = 500;
// Which of the nine chunks round (cx, cz) are within CLOSE_UP_RANGE of
// (x, z), as bits
function closeUpMask(x, z, cx, cz) {
  let mask = 0;
  let bit = 1;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++, bit <<= 1) {
      const ox = Math.abs(x - (cx + dx) * CHUNK_SIZE) - CHUNK_SIZE / 2;
      const oz = Math.abs(z - (cz + dz) * CHUNK_SIZE) - CHUNK_SIZE / 2;
      if (Math.hypot(Math.max(ox, 0), Math.max(oz, 0)) <= CLOSE_UP_RANGE) {
        mask |= bit;
      }
    }
  }
  return mask;
}
const CANOPY_SIZE = 16;
function canopyDetailRadius() {
  // The preset's pixel ratio, not the one adaptive quality lowers for a while
  const height =
    window.innerHeight * (state._basePixelRatio ?? renderer.getPixelRatio());
  const pixelsPerUnitAt1 =
    height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  const detailDistance =
    (CANOPY_SIZE * pixelsPerUnitAt1) / CANOPY_DETAIL_PIXELS;
  return detailDistance < CHUNK_SIZE ? 1 : TREE_LOD_CHUNK_RADIUS;
}

function geometryAverageColor(geo) {
  const srcCol = geo.attributes.color;
  if (!srcCol) return [1, 1, 1];
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < srcCol.count; i++) {
    r += srcCol.getX(i);
    g += srcCol.getY(i);
    b += srcCol.getZ(i);
  }
  return [r / srcCol.count, g / srcCol.count, b / srcCol.count];
}

function fillVertexColor(geo, r, g, b) {
  const count = geo.attributes.position.count;
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    col[i * 3] = r;
    col[i * 3 + 1] = g;
    col[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

// A simple shape (spanning -1..1) scaled and moved to fill `geo`'s bounds.
function fitToBounds(shape, geo) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  shape.scale(half.x, half.y, half.z);
  shape.translate(center.x, center.y, center.z);
  if (geo.attributes.color) {
    const [r, g, b] = geometryAverageColor(geo);
    fillVertexColor(shape, r, g, b);
  }
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

function syncDrawnAt(data) {
  // (Refilled in place: rebuilds run this for every type of every chunk)
  const drawnAt = (data.drawnAt ??= []);
  drawnAt.length = 0;
  if (data._tileMesh) drawnAt.push(data._tileMesh, data._tileSlot);
  if (data._shadowMesh) drawnAt.push(data._shadowMesh, data._shadowSlot);
}

function copyScaledMatrices(dstM, dstSlot, srcM, count, share) {
  const {sx, sy, sz, tx, ty, tz} = share;
  for (let i = 0; i < count; i++) {
    const so = i * 16;
    const doff = (dstSlot + i) * 16;
    const m0 = srcM[so],
      m1 = srcM[so + 1],
      m2 = srcM[so + 2];
    const m4 = srcM[so + 4],
      m5 = srcM[so + 5],
      m6 = srcM[so + 6];
    const m8 = srcM[so + 8],
      m9 = srcM[so + 9],
      m10 = srcM[so + 10];
    dstM[doff] = m0 * sx;
    dstM[doff + 1] = m1 * sx;
    dstM[doff + 2] = m2 * sx;
    dstM[doff + 3] = 0;
    dstM[doff + 4] = m4 * sy;
    dstM[doff + 5] = m5 * sy;
    dstM[doff + 6] = m6 * sy;
    dstM[doff + 7] = 0;
    dstM[doff + 8] = m8 * sz;
    dstM[doff + 9] = m9 * sz;
    dstM[doff + 10] = m10 * sz;
    dstM[doff + 11] = 0;
    dstM[doff + 12] = m0 * tx + m4 * ty + m8 * tz + srcM[so + 12];
    dstM[doff + 13] = m1 * tx + m5 * ty + m9 * tz + srcM[so + 13];
    dstM[doff + 14] = m2 * tx + m6 * ty + m10 * tz + srcM[so + 14];
    dstM[doff + 15] = srcM[so + 15];
  }
}

class GlobalInstanceManager {
  constructor() {
    this.types = new Map();
    this.group = new THREE.Group();
    this.group.name = 'GlobalInstances';
    this.shadowGroup = new THREE.Group();
    this.shadowGroup.name = 'GlobalShadowInstances';
    this.shadowGroup.visible = false;
    this.group.add(this.shadowGroup);
    scene.add(this.group);
    this._dirty = true;
    this._planeChunkX = NaN;
    this._planeChunkZ = NaN;
    this._nextChunkId = 0;
    this._configVersion = 0;
    this._maxNearRadius = 0;
    this._maxFarRadius = 0;
    this._tileSigs = new Map();
    this._shadowSig = '';
    this._shadowLightPos = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._shadowTargetPos = new THREE.Vector3(Infinity, Infinity, Infinity);
    if (renderer?.shadowMap) {
      const origShadowRender = renderer.shadowMap.render.bind(
        renderer.shadowMap
      );
      renderer.shadowMap.render = (lights, sc, cam) => {
        this.shadowGroup.visible = true;
        try {
          origShadowRender(lights, sc, cam);
        } finally {
          this.shadowGroup.visible = false;
        }
      };
    }
  }

  requestRebuild() {
    this._dirty = true;
  }

  _createShadowMesh(geo, mat, capacity, customDepthMaterial) {
    const mesh = createTreeInstancedMesh(geo, mat, capacity, false);
    if (customDepthMaterial) mesh.customDepthMaterial = customDepthMaterial;
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.visible = false;
    return mesh;
  }

  registerType(
    type,
    geo,
    mat,
    maxInstances = 30000,
    useColor = false,
    castsShadow = true
  ) {
    // Shadow-only mesh with just the instances near the plane, kept in
    // shadowGroup (visible only during shadowMap.render) so the main pass
    // skips it completely instead of binding materials for a 0-instance draw.
    let shadowMesh = null;
    if (castsShadow) {
      shadowMesh = this._createShadowMesh(geo, mat, Math.min(64, maxInstances));
      this.shadowGroup.add(shadowMesh);
    }

    this.types.set(type, {
      geo,
      farGeo: geo, // see setFarGeometry
      farShare: null,
      nearGeo: null, // see setNearGeometry
      mat,
      useColor,
      maxInstances,
      shadowMesh,
      shadowShare: null,
      screenSized: false,
      nearRadius: null,
      farRadius: Infinity,
      tiles: new Map(), // tile key (+ '|far') -> on-screen InstancedMesh
    });
    this._configVersion++;
  }

  // Geometry for this type in the chunks within CLOSE_UP_RANGE of the plane
  // (its full model, where `geo` is a cheaper stand-in)
  setNearGeometry(type, nearGeo) {
    this.types.get(type).nearGeo = nearGeo;
    this._configVersion++;
    this.requestRebuild();
  }

  // Geometry for this type beyond TREE_LOD_CHUNK_RADIUS (or beyond
  // canopyDetailRadius() if `screenSized`), or null to not draw it that far
  // away. Beyond `farRadius` chunks it isn't drawn at all.
  setFarGeometry(
    type,
    farGeo,
    {
      screenSized = false,
      nearRadius = null,
      farRadius = Infinity,
      farShare = null,
    } = {}
  ) {
    Object.assign(this.types.get(type), {
      farGeo,
      screenSized,
      nearRadius,
      farRadius,
      farShare,
    });
    if (nearRadius !== null && nearRadius > this._maxNearRadius) {
      this._maxNearRadius = nearRadius;
    }
    if (Number.isFinite(farRadius) && farRadius > this._maxFarRadius) {
      this._maxFarRadius = farRadius;
    }
    this._configVersion++;
    this.requestRebuild();
  }

  // Geometry this type casts shadows with. The shadow map stores 4,096 units
  // in 2,048 texels (2 units each), so a small prop's detail can't show in its
  // shadow; a simple shape casts nearly the same one for far fewer triangles.
  setShadowGeometry(type, shadowGeo) {
    const typeInfo = this.types.get(type);
    if (shadowGeo._shadowShare) {
      if (typeInfo.shadowMesh) {
        this.shadowGroup.remove(typeInfo.shadowMesh);
        typeInfo.shadowMesh.dispose();
        typeInfo.shadowMesh = null;
      }
      typeInfo.shadowShare = shadowGeo._shadowShare;
    } else {
      typeInfo.shadowShare = null;
      typeInfo.shadowMesh.geometry = shadowGeo;
    }
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
      mesh.renderOrder = typeInfo.renderOrder || 0;
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
    } else if (mesh.geometry !== geo) {
      mesh.geometry = geo;
    }
    return mesh;
  }

  _removeTileMesh(typeInfo, meshKey) {
    const mesh = typeInfo.tiles.get(meshKey);
    if (!mesh) return;
    this.group.remove(mesh);
    mesh.dispose();
    typeInfo.tiles.delete(meshKey);
  }

  rebuildAll() {
    const planeChunkX = Math.round(planeGroup.position.x / CHUNK_SIZE);
    const planeChunkZ = Math.round(planeGroup.position.z / CHUNK_SIZE);
    if (
      planeChunkX !== this._planeChunkX ||
      planeChunkZ !== this._planeChunkZ
    ) {
      this._planeChunkX = planeChunkX;
      this._planeChunkZ = planeChunkZ;
      this._dirty = true;
    }
    const closeMask = closeUpMask(
      planeGroup.position.x,
      planeGroup.position.z,
      planeChunkX,
      planeChunkZ
    );
    if (closeMask !== this._closeMask) {
      this._closeMask = closeMask;
      this._dirty = true;
    }
    const hasShadowCam =
      dirLight.position.distanceToSquared(dirLight.target.position) > 100;
    if (
      !this._dirty &&
      hasShadowCam &&
      (dirLight.position.distanceToSquared(this._shadowLightPos) >
        SHADOW_REBUILD_STEP_SQ ||
        dirLight.target.position.distanceToSquared(this._shadowTargetPos) >
          SHADOW_REBUILD_STEP_SQ)
    ) {
      this._dirty = true;
    }
    if (!this._dirty) return;
    this._dirty = false;

    if (hasShadowCam) {
      this._shadowLightPos.copy(dirLight.position);
      this._shadowTargetPos.copy(dirLight.target.position);
      const shadowCam = dirLight.shadow.camera;
      shadowCam.position.copy(dirLight.position);
      shadowCam.lookAt(dirLight.target.position);
      shadowCam.updateProjectionMatrix();
      shadowCam.updateMatrixWorld();
      _shadowMatrix.multiplyMatrices(
        shadowCam.projectionMatrix,
        shadowCam.matrixWorldInverse
      );
      _shadowFrustum.setFromProjectionMatrix(_shadowMatrix);
    }

    const detailRadius = canopyDetailRadius();
    const maxLodRadius = Math.max(
      TREE_LOD_CHUNK_RADIUS,
      detailRadius,
      this._maxNearRadius,
      this._maxFarRadius
    );
    const sigPrefix = `${this._configVersion}|${state._enableObjects ? 1 : 0}|${detailRadius}|`;
    const tileChunks = new Map();
    const shadowChunks = [];
    let shadowSig = `${this._configVersion}|${state._enableObjects ? 1 : 0}|`;

    chunks.forEach((chunk) => {
      const instanceData = chunk.userData.instanceData;
      if (!instanceData) return;
      const id = (chunk.userData._instId ??= ++this._nextChunkId);
      const {chunkX, chunkZ} = chunk.userData;
      // Tiles are aligned so chunk centers (chunkX * CHUNK_SIZE) fall inside.
      const tileX = Math.floor((chunkX * CHUNK_SIZE) / TREE_TILE_SIZE);
      const tileZ = Math.floor((chunkZ * CHUNK_SIZE) / TREE_TILE_SIZE);
      const tileKey = tileX + ',' + tileZ;
      const chunkDistance = Math.max(
        Math.abs(chunkX - planeChunkX),
        Math.abs(chunkZ - planeChunkZ)
      );
      const band = Math.min(chunkDistance, maxLodRadius + 1);
      const ox = chunkX - planeChunkX + 1;
      const oz = chunkZ - planeChunkZ + 1;
      const close =
        chunkDistance <= 1 && ((closeMask >> (oz * 3 + ox)) & 1) === 1;
      let entry = tileChunks.get(tileKey);
      if (!entry) {
        entry = {tileX, tileZ, list: [], sig: sigPrefix};
        tileChunks.set(tileKey, entry);
      }
      entry.list.push({chunk, chunkDistance, close});
      entry.sig += `${id}:${band}${close ? 'c' : ''},`;

      let castsShadows;
      if (hasShadowCam) {
        const cx = chunkX * CHUNK_SIZE;
        const cz = chunkZ * CHUNK_SIZE;
        const minY = chunk.userData.minY ?? 0;
        const maxY = chunk.userData.maxY ?? 800;
        _chunkShadowBox.min.set(
          cx - SHADOW_CHUNK_HALF,
          minY,
          cz - SHADOW_CHUNK_HALF
        );
        _chunkShadowBox.max.set(
          cx + SHADOW_CHUNK_HALF,
          maxY,
          cz + SHADOW_CHUNK_HALF
        );
        castsShadows = _shadowFrustum.intersectsBox(_chunkShadowBox);
      } else {
        castsShadows = chunkDistance <= TREE_SHADOW_CHUNK_RADIUS;
      }
      if (castsShadows) {
        shadowChunks.push(chunk);
        shadowSig += `${id},`;
      }
    });

    // Drop any tile whose chunks were all evicted.
    for (const oldTileKey of this._tileSigs.keys()) {
      if (!tileChunks.has(oldTileKey)) {
        this._tileSigs.delete(oldTileKey);
        const farKey = oldTileKey + '|far';
        const closeKey = oldTileKey + '|close';
        for (const typeInfo of this.types.values()) {
          this._removeTileMesh(typeInfo, oldTileKey);
          this._removeTileMesh(typeInfo, farKey);
          this._removeTileMesh(typeInfo, closeKey);
        }
      }
    }

    const dirtyTiles = new Set();
    for (const [tileKey, entry] of tileChunks) {
      if (this._tileSigs.get(tileKey) !== entry.sig) {
        this._tileSigs.set(tileKey, entry.sig);
        dirtyTiles.add(tileKey);
      }
    }
    const shadowDirty = shadowSig !== this._shadowSig;
    if (shadowDirty) {
      this._shadowSig = shadowSig;
    }
    if (dirtyTiles.size === 0 && !shadowDirty) return;

    // 1. Group instance data only for dirty tiles (and shadow chunks if dirty).
    const byType = new Map(); // type -> Map(meshKey -> {tileX, tileZ, geo, parts, count})
    for (const tileKey of dirtyTiles) {
      const {tileX, tileZ, list} = tileChunks.get(tileKey);
      for (const {chunk, chunkDistance, close} of list) {
        const instanceData = chunk.userData.instanceData;
        for (const type in instanceData) {
          const typeInfo = this.types.get(type);
          if (!typeInfo) continue;
          const data = instanceData[type];
          data._tileMesh = null;
          data._tileSlot = 0;
          syncDrawnAt(data);
          if (!data.count || chunkDistance > typeInfo.farRadius) continue;
          const nearRadius =
            typeInfo.nearRadius ??
            (typeInfo.screenSized ? detailRadius : TREE_LOD_CHUNK_RADIUS);
          const useFar =
            chunkDistance > nearRadius && typeInfo.farGeo !== typeInfo.geo;
          if (useFar && typeInfo.farGeo === null) continue; // not drawn far away
          const closeUp = close && typeInfo.nearGeo !== null;
          const share = useFar ? typeInfo.farShare : null;
          const bucketType = share ? share.targetType : type;
          const bucketInfo = share ? this.types.get(bucketType) : typeInfo;
          const meshKey = useFar
            ? tileKey + '|far'
            : closeUp
              ? tileKey + '|close'
              : tileKey;
          let tiles = byType.get(bucketType);
          if (!tiles) {
            tiles = new Map();
            byType.set(bucketType, tiles);
          }
          let tile = tiles.get(meshKey);
          if (!tile) {
            tile = {
              tileX,
              tileZ,
              geo: share
                ? bucketInfo.geo
                : useFar
                  ? typeInfo.farGeo
                  : closeUp
                    ? typeInfo.nearGeo
                    : typeInfo.geo,
              parts: [],
              count: 0,
            };
            tiles.set(meshKey, tile);
          }
          tile.parts.push({data, share, tinted: typeInfo.useColor});
          tile.count += data.count;
        }
      }
    }

    const shadowParts = new Map(); // type -> [data]
    if (shadowDirty) {
      chunks.forEach((chunk) => {
        const instanceData = chunk.userData.instanceData;
        if (!instanceData) return;
        for (const type in instanceData) {
          const data = instanceData[type];
          if (data._shadowMesh) {
            data._shadowMesh = null;
            data._shadowSlot = 0;
            syncDrawnAt(data);
          }
        }
      });
      for (const chunk of shadowChunks) {
        const instanceData = chunk.userData.instanceData;
        for (const type in instanceData) {
          const typeInfo = this.types.get(type);
          if (!typeInfo?.shadowMesh && !typeInfo?.shadowShare) continue;
          const data = instanceData[type];
          if (!data.count) continue;
          const share = typeInfo.shadowShare;
          const bucketType = share ? share.targetType : type;
          let parts = shadowParts.get(bucketType);
          if (!parts) {
            parts = [];
            shadowParts.set(bucketType, parts);
          }
          parts.push({data, share});
        }
      }
    }

    // 2. Fill dirty tile meshes and (when shadowDirty) shadow-only meshes.
    for (const [type, typeInfo] of this.types) {
      if (dirtyTiles.size > 0) {
        const tiles = byType.get(type);
        for (const baseKey of dirtyTiles) {
          if (!tiles?.has(baseKey)) {
            this._removeTileMesh(typeInfo, baseKey);
          }
          for (const key of [baseKey + '|far', baseKey + '|close']) {
            if (!tiles?.has(key)) this._removeTileMesh(typeInfo, key);
          }
        }
        if (tiles) {
          for (const [meshKey, tile] of tiles) {
            const mesh = this._tileMesh(
              typeInfo,
              meshKey,
              tile.tileX,
              tile.tileZ,
              tile.count,
              tile.geo
            );
            let n = 0;
            for (const {data, share, tinted} of tile.parts) {
              data._tileMesh = mesh;
              data._tileSlot = n;
              syncDrawnAt(data);
              if (!share) {
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
              } else {
                copyScaledMatrices(
                  mesh.instanceMatrix.array,
                  n,
                  data.matrices,
                  data.count,
                  share
                );
                const {cr, cg, cb} = share;
                const srcC = data.colors;
                const dstC = mesh.instanceColor.array;
                for (let i = 0; i < data.count; i++) {
                  const co = (n + i) * 3;
                  // Types drawn without instance colours (trunks) leave
                  // theirs at 0: those take the species colour alone
                  if (tinted) {
                    const sco = i * 3;
                    dstC[co] = srcC[sco] * cr;
                    dstC[co + 1] = srcC[sco + 1] * cg;
                    dstC[co + 2] = srcC[sco + 2] * cb;
                  } else {
                    dstC[co] = cr;
                    dstC[co + 1] = cg;
                    dstC[co + 2] = cb;
                  }
                }
              }
              n += data.count;
            }
            mesh.count = n;
            markInstancesUpdated(mesh, typeInfo.useColor);
            mesh.visible = state._enableObjects;
          }
        }
      }

      if (!shadowDirty) continue;
      let shadowMesh = typeInfo.shadowMesh;
      if (!shadowMesh) continue;
      const parts = shadowParts.get(type) || [];
      let total = 0;
      for (const {data} of parts) total += data.count;
      total = Math.min(total, typeInfo.maxInstances);
      if (shadowMesh.instanceMatrix.count < total) {
        const capacity = Math.min(
          typeInfo.maxInstances,
          Math.max(64, 2 ** Math.ceil(Math.log2(total)))
        );
        const next = this._createShadowMesh(
          shadowMesh.geometry,
          typeInfo.mat,
          capacity,
          shadowMesh.customDepthMaterial
        );
        this.shadowGroup.remove(shadowMesh);
        shadowMesh.dispose();
        this.shadowGroup.add(next);
        typeInfo.shadowMesh = shadowMesh = next;
      }
      let n = 0;
      for (const {data, share} of parts) {
        const numToCopy = Math.min(data.count, typeInfo.maxInstances - n);
        if (numToCopy <= 0) break;
        data._shadowMesh = shadowMesh;
        data._shadowSlot = n;
        syncDrawnAt(data);
        if (!share) {
          shadowMesh.instanceMatrix.array.set(
            data.matrices.subarray(0, numToCopy * 16),
            n * 16
          );
        } else {
          copyScaledMatrices(
            shadowMesh.instanceMatrix.array,
            n,
            data.matrices,
            numToCopy,
            share
          );
        }
        n += numToCopy;
      }
      shadowMesh.count = n;
      if (n > 0) markInstancesUpdated(shadowMesh, false);
      shadowMesh.visible = state._enableObjects && n > 0;
    }
  }
}

export var globalInstancer = new GlobalInstanceManager();

// Stops drawing instance `index` of a chunk's instance data (a prop knocked
// over, breakables.js), now and in later rebuilds: its matrix is zeroed in
// the data and in the meshes already drawing it.
export function hideInstance(data, index) {
  data.matrices.fill(0, index * 16, index * 16 + 16);
  const drawnAt = data.drawnAt || [];
  for (let i = 0; i < drawnAt.length; i += 2) {
    const mesh = drawnAt[i];
    const slot = drawnAt[i + 1] + index;
    if (slot >= mesh.instanceMatrix.count) continue;
    mesh.instanceMatrix.array.fill(0, slot * 16, slot * 16 + 16);
    mesh.instanceMatrix.addUpdateRange(slot * 16, 16);
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// An instanced mesh drawing `type`'s model and material (as registered
// above) anywhere in the world, casting shadows, for props knocked over
export function createDebrisMesh(geo, mat, capacity, useColor) {
  const mesh = createTreeInstancedMesh(geo, mat, capacity, useColor);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// How big the campfires' logs and flame are drawn (their model is sized for
// an older, bigger look)
const CAMPFIRE_SCALE = 0.6;
// Models of props built per chunk that can be knocked over (piers, bridge
// supports, campfires and tents): type -> {geo, mat}, for breakables.js. A
// chunk lists them in userData.meshProps: [{kind, parts: [{type, mesh,
// index}]}], each part an instance of one of the chunk's instanced meshes.
export const debrisTypes = new Map();
// Sailboat scratch: a moored boat's sail matrix, and a zero matrix that
// draws nothing (a boat shown by the other reflection mesh)
const _furledSail = new THREE.Matrix4();
const _NO_BOAT = new THREE.Matrix4().makeScale(0, 0, 0);
const debrisType = (type, geo, mat) => debrisTypes.set(type, {geo, mat});
debrisType('pierDeck', pierDeckGeo, pierDeckMat);
debrisType('pierDeckL', pierDeckLGeo, pierDeckMat);
debrisType('fireLog', fireLogGeo, woodMat);
debrisType('fireCore', fireCoreGeo, fireMat);
debrisType('fireSmoke', smokeGeo, smokeMat);
debrisType('fireGlow', streetlightDecalGeo, fireGlowMat);
tentGeos.forEach((geo, i) => debrisType('tent' + i, geo, tentMat));
debrisType('bridgePierShaft', bridgePierShaftGeo, bridgePilingMat);
debrisType('bridgePierFooting', bridgePierFootingGeo, bridgePilingMat);
debrisType('streetlightPole', streetlightPoleGeo, streetlightPoleMat);
debrisType('streetlightArm', streetlightArmGeo, streetlightPoleMat);
debrisType('streetlightBulb', streetlightBulbGeo, streetlightBulbMat);
debrisType('streetlightDecal', streetlightDecalGeo, streetlightDecalMat);
// A crystal cluster shattering: its spires flying apart, and the glowing
// shards they burst into, each in its cluster's colour
crystalSpireGeos.forEach((geo, i) =>
  debrisTypes.set('crystalSpire' + i, {geo, mat: crystalMat, useColor: true})
);
debrisTypes.set('crystalShard', {
  geo: crystalShardGeo,
  mat: crystalShardMat,
  useColor: true,
});
// Boats sinking
boatHullPalette.forEach((mat, i) =>
  debrisType('boatHull' + i, boatHullGeo, mat)
);
debrisType('boatRim', boatRimGeo, boatRimMat);
debrisType('boatDeck', boatDeckGeo, boatDeckMat);
debrisType('boatMast', boatMastGeo, woodMat);
debrisType('boatBoom', boatBoomGeo, woodMat);
debrisType('boatSail', boatSailGeo, boatSailMat);
pirateShipGeos.forEach((geo, i) =>
  debrisType('pirateShip' + i, geo, pirateShipMat)
);

// A rock arch as a breakable prop: it comes down in its blocks, but only
// when you hit one of them, not when you fly through the gap. pos: the
// arch's spot in its chunk, already offset into the world by its meshes.
function rockArchProp(pos, meshes, blocks, grass = true) {
  const {x, y, z} = meshes[0].position;
  const c = Math.cos(pos.rotY);
  const s = Math.sin(pos.rotY);
  // In the world: [x, y, z, size, colour]
  const world = blocks
    .filter((b) => grass || !b[4])
    .map(([bx, by, bz, size, isGrass]) => [
      x + bx * c + bz * s,
      y + by,
      z - bx * s + bz * c,
      size,
      isGrass ? rockArchGrassMat.color.toArray() : rockMat.color.toArray(),
    ]);
  return {
    kind: BREAKABLE.HOUSE,
    parts: meshes.map((object) => ({type: 'obj', object, role: 'hide'})),
    rubble: 0,
    blocks: world,
    // Within half a block (and the vehicle's radius r) of one of them
    hit: (p, r) =>
      world.some(([bx, by, bz, size]) => {
        const reach = size * 0.5 + r;
        const dx = p.x - bx;
        const dy = p.y - by;
        const dz = p.z - bz;
        return dx * dx + dy * dy + dz * dz < reach * reach;
      }),
  };
}

// Where loaded waterfalls land (world units), by chunk group, and the top of
// the volcano's lava once built: for their particles (particles.js)
export const waterfallFeet = new Map();
export const volcanoCrater = {y: null};

// The glow up the volcano's crater walls. One light for the game's life,
// lit while the volcano's chunk is loaded: adding and removing a light
// changes the light count every lit shader is compiled for, so loading or
// dropping that chunk made all of them recompile at once (a big hitch,
// including right after START near the volcano). Physical units (candela):
// the legacy-tuned 30.0 converted to keep the glow at ~200 m (decay 1)
const VOLCANO_GLOW = 5600;
const volcanoGlow = new THREE.SpotLight(0xff4500, 0, 3000, Math.PI / 6, 0.5, 1);
scene.add(volcanoGlow);
scene.add(volcanoGlow.target);

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
const POLYFORK_TREES = [
  ['japaneseMaple', japaneseMapleGeos],
  ['cherryBlossom', cherryBlossomGeos],
  ['sculptedPine', sculptedPineGeos],
  ['birch', birchGeos],
  ['broadleafOak', broadleafOakGeos],
  ['oak', oakGeos],
  ['magnolia', magnoliaGeos],
  ['appleTree', appleTreeGeos],
  ['orchardApple', orchardAppleGeos],
  ['plumTree', plumTreeGeos],
  ['fruitTree', fruitTreeGeos],
  ['snowSpruce', snowSpruceGeos],
  ['mountainRowan', mountainRowanGeos],
];
for (const [prefix, geos] of POLYFORK_TREES) {
  globalInstancer.registerType(prefix + 'Trunk', geos.trunk, treeTrunkMat);
  globalInstancer.registerType(
    prefix + 'Leaves',
    geos.leaves,
    treeLeavesBaseMat,
    30000,
    true
  );
}
// Close to the plane, the full Polyfork models behind the low-poly trees
for (const [prefix, geos] of [...POLYFORK_TREES, ['palm', palmGeos]]) {
  if (!geos.fullLeaves) continue;
  globalInstancer.setNearGeometry(prefix + 'Trunk', geos.fullTrunk);
  globalInstancer.setNearGeometry(prefix + 'Leaves', geos.fullLeaves);
}
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
globalInstancer.registerType(
  'crystal',
  crystalClusterGeo,
  crystalMat,
  30000,
  true
);
globalInstancer.registerType('deadTrunk', deadTreeGeo, deadTreeMat);
globalInstancer.registerType(
  'deadCottonwoodTrunk',
  deadCottonwoodGeo,
  treeTrunkMat
);
globalInstancer.registerType(
  'twistedDeadOakTrunk',
  twistedDeadOakGeo,
  treeTrunkMat
);
globalInstancer.registerType('rock', rockGeo, rockMat);
globalInstancer.registerType('snowRock', rockGeo, snowRockMat);
globalInstancer.registerType('desertRock', rockGeo, desertRockMat);
globalInstancer.registerType('cactus', cactusGeo, cactusMat);
globalInstancer.registerType('hayBale', hayBaleGeo, hayBaleMat);
globalInstancer.registerType('fallenLog', fallenLogGeo, fallenLogMat);
globalInstancer.registerType(
  'stump',
  stumpGeo,
  buildingMat,
  30000,
  false,
  false
);
globalInstancer.registerType('seal', sealGeo, sealMat);
globalInstancer.registerType(
  'buoy',
  buoyGeos.body,
  houseTintMat,
  30000,
  true,
  false
);
globalInstancer.registerType(
  'buoyTop',
  buoyGeos.top,
  buoyTopMat,
  30000,
  false,
  false
);
// Rock breakwaters off harbours (terrain-gen.js findBreakwater): rare, a
// few dozen rubble stretches each
// (no shadow: in clear shallows it falls on the sea floor well off the
// rocks and makes the mound look as if it floats)
breakwaterRockGeos.forEach((geo, i) =>
  globalInstancer.registerType(
    'breakwaterRock' + i,
    geo,
    boatMat,
    4000,
    false,
    false
  )
);
globalInstancer.registerType(
  'breakwaterHead',
  breakwaterHeadGeo,
  boatMat,
  1000,
  false,
  false
);
globalInstancer.registerType(
  'breakwaterBeacon',
  breakwaterBeaconGeos.body,
  houseTintMat,
  1000,
  true,
  false
);
globalInstancer.registerType(
  'breakwaterSurf',
  breakwaterBeaconGeos.surf,
  breakwaterSurfMat,
  1000,
  true,
  false
);
globalInstancer.registerType(
  'breakwaterFoam',
  breakwaterSurfGeo,
  breakwaterSurfMat,
  4000,
  true,
  false
);
// Surf draws after the see-through water
globalInstancer.types.get('breakwaterSurf').renderOrder = 1;
globalInstancer.types.get('breakwaterFoam').renderOrder = 1;
globalInstancer.registerType(
  'breakwaterLamp',
  breakwaterBeaconGeos.lamp,
  buoyTopMat,
  1000,
  false,
  false
);
globalInstancer.registerType(
  'sheepWool',
  sheepGeos.wool,
  houseTintMat,
  30000,
  true,
  false
);
globalInstancer.registerType(
  'sheepDark',
  sheepGeos.dark,
  sheepDarkMat,
  30000,
  false,
  false
);
// Goats and deer, like the sheep: coat tinted per animal, dark parts
for (const [kind, geos] of [
  ['goat', goatGeos],
  ['deer', deerGeos],
]) {
  globalInstancer.registerType(
    kind + 'Coat',
    geos.coat,
    houseTintMat,
    4000,
    true,
    false
  );
  globalInstancer.registerType(
    kind + 'Dark',
    geos.dark,
    sheepDarkMat,
    4000,
    false,
    false
  );
}
globalInstancer.registerType(
  'iceHutBody',
  iceHutGeos.body,
  houseTintMat,
  30000,
  true
);
globalInstancer.registerType('iceHutRoof', iceHutGeos.roof, iceHutRoofMat);
globalInstancer.registerType('joshuaTrunk', joshuaGeos.trunk, joshuaTrunkMat);
globalInstancer.registerType(
  'joshuaLeaves',
  joshuaGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('snowman', snowmanGeo, snowmanMat);
globalInstancer.registerType('iceberg', icebergMainGeo, icebergMat);
globalInstancer.registerType('iceFloe', iceFloeMainGeo, icebergMat);
globalInstancer.registerType('penguin', penguinGeo, penguinMat);
globalInstancer.registerType(
  'lilypad',
  lilyPadGeo,
  lilyPadMat,
  30000,
  false,
  false
);
globalInstancer.registerType('bush', bushGeo, bushBaseMat, 30000, true);

// Houses: walls and roofs in one white material tinted per house, so a
// village costs the same few draw calls as one house. Doors and windows are
// too thin to cast a visible shadow.
globalInstancer.registerType(
  'houseBody',
  houseBodyGeo,
  houseTintMat,
  30000,
  true
);
globalInstancer.registerType(
  'houseRoof',
  houseRoofGeo,
  houseTintMat,
  30000,
  true
);
globalInstancer.registerType('houseChimney', houseChimneyGeo, houseChimneyMat);
globalInstancer.registerType(
  'twoStoryBody',
  twoStoryBodyGeo,
  houseTintMat,
  30000,
  true
);
globalInstancer.registerType(
  'twoStoryRoof',
  twoStoryRoofGeo,
  houseTintMat,
  30000,
  true
);
globalInstancer.registerType(
  'twoStoryChimney',
  twoStoryChimneyGeo,
  houseChimneyMat
);
globalInstancer.registerType(
  'houseDoor',
  houseDoorGeo,
  houseDoorMat,
  30000,
  false,
  false
);
globalInstancer.registerType(
  'houseWindow',
  houseWindowGeo,
  houseWindowMat,
  30000,
  true,
  false
);

for (const [shadowType, unitGeo] of [
  ['shadowBox', new THREE.BoxGeometry(2, 2, 2)],
  ['shadowCylinder', new THREE.CylinderGeometry(1, 1, 2, 8, 1, true)],
  ['shadowCone', new THREE.ConeGeometry(1, 2, 8, 1, false)],
]) {
  globalInstancer.registerType(shadowType, unitGeo, houseTintMat, 100000);
  globalInstancer.setFarGeometry(shadowType, null);
}
const sharedShadow = (targetType, shape, geo) => {
  const proxy = fitToBounds(shape, geo);
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  proxy._shadowShare = {
    targetType,
    sx: half.x,
    sy: half.y,
    sz: half.z,
    tx: center.x,
    ty: center.y,
    tz: center.z,
  };
  return proxy;
};
const shadowBox = (geo) =>
  sharedShadow('shadowBox', new THREE.BoxGeometry(2, 2, 2), geo); // 12 triangles
const shadowCylinder = (geo) =>
  sharedShadow(
    'shadowCylinder',
    new THREE.CylinderGeometry(1, 1, 2, 8, 1, true),
    geo
  ); // 16 triangles
// A round roof (straw hut, silo dome): a cone, closed on top unlike the
// open-ended cylinder, which looks hollow from above far away (16 triangles)
const shadowCone = (geo) =>
  sharedShadow('shadowCone', new THREE.ConeGeometry(1, 2, 8, 1, false), geo);
for (const [type, geo] of [
  ['houseBody', houseBodyGeo],
  ['houseChimney', houseChimneyGeo],
  ['twoStoryBody', twoStoryBodyGeo],
  ['twoStoryChimney', twoStoryChimneyGeo],
  ['iceHutBody', iceHutGeos.body],
]) {
  globalInstancer.setShadowGeometry(type, shadowBox(geo));
}
// A gable roof: a box whose top edges meet along the longer side (8 triangles)
const shadowGable = (geo) => {
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  const shape = new THREE.BoxGeometry(2, 2, 2);
  const pos = shape.attributes.position;
  const across = size.x < size.z ? 0 : 2; // ridge runs along the other axis
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setComponent(i, across, 0);
  }
  shape.computeVertexNormals();
  return fitToBounds(shape, geo);
};

const TOWER_FAR_CHUNK_RADIUS = 3;
function geometryBandColor(geo, y0Frac, y1Frac) {
  const pos = geo.attributes.position;
  const col = geo.attributes.color;
  if (!col) return [1, 1, 1];
  geo.computeBoundingBox();
  const {min, max} = geo.boundingBox;
  const h = max.y - min.y || 1;
  const y0 = min.y + h * y0Frac;
  const y1 = min.y + h * y1Frac;
  const index = geo.index;
  const n = index ? index.count : pos.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const tri = new THREE.Triangle();
  let r = 0;
  let g = 0;
  let bl = 0;
  let wSum = 0;
  for (let i = 0; i < n; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    const cy = (a.y + b.y + c.y) / 3;
    if (cy < y0 || cy > y1) continue;
    tri.set(a, b, c);
    const area = tri.getArea();
    if (area <= 0) continue;
    wSum += area;
    r += ((col.getX(i0) + col.getX(i1) + col.getX(i2)) / 3) * area;
    g += ((col.getY(i0) + col.getY(i1) + col.getY(i2)) / 3) * area;
    bl += ((col.getZ(i0) + col.getZ(i1) + col.getZ(i2)) / 3) * area;
  }
  if (wSum <= 0) return geometryAverageColor(geo);
  return [r / wSum, g / wSum, bl / wSum];
}
function taperedBox(wxTop, wzTop, wxBot, wzBot, y0, y1) {
  const g = new THREE.CylinderGeometry(1, 1, y1 - y0, 4, 1, true);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const isTop = p.getY(i) > 0;
    p.setX(i, p.getX(i) * Math.SQRT2 * (isTop ? wxTop : wxBot));
    p.setZ(i, p.getZ(i) * Math.SQRT2 * (isTop ? wzTop : wzBot));
  }
  g.translate(0, (y0 + y1) * 0.5, 0);
  return g;
}
function pyramidRoof(wxBot, wzBot, y0, y1) {
  const g = new THREE.ConeGeometry(1, y1 - y0, 4, 1, false);
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) * Math.SQRT2 * wxBot);
    p.setZ(i, p.getZ(i) * Math.SQRT2 * wzBot);
  }
  g.translate(0, (y0 + y1) * 0.5, 0);
  return g;
}
function towerFarGeo(type, geo) {
  geo.computeBoundingBox();
  const {min, max} = geo.boundingBox;
  const cx = (min.x + max.x) * 0.5;
  const cz = (min.z + max.z) * 0.5;
  const hx = (max.x - min.x) * 0.5;
  const hz = (max.z - min.z) * 0.5;
  const y0 = min.y;
  const y1 = max.y;
  const h = y1 - y0;
  if (type === 'castleRuins') {
    const t1 = new THREE.CylinderGeometry(5, 6.5, h, 6, 1, false).translate(
      0,
      y0 + h * 0.5,
      0
    );
    const keepH = Math.min(22.5, h);
    const keep = new THREE.BoxGeometry(16, keepH, 19).translate(
      12,
      y0 + keepH * 0.5,
      -5.5
    );
    const t2H = Math.min(20, h);
    const t2 = new THREE.CylinderGeometry(4.5, 6, t2H, 6, 1, false).translate(
      24,
      y0 + t2H * 0.5,
      4
    );
    const out = mergeGeometries([t1, keep, t2]);
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }
  if (type === 'fireLookout') {
    const yCab0 = y0 + h * 0.72;
    const yCab1 = y0 + h * 0.9;
    const legs = taperedBox(
      hx * 0.52,
      hz * 0.52,
      hx * 0.95,
      hz * 0.95,
      y0,
      yCab0
    ).translate(cx, 0, cz);
    const cab = new THREE.BoxGeometry(
      hx * 1.55,
      yCab1 - yCab0,
      hz * 1.55
    ).translate(cx, (yCab0 + yCab1) * 0.5, cz);
    const roof = pyramidRoof(hx * 0.92, hz * 0.92, yCab1, y1).translate(
      cx,
      0,
      cz
    );
    return joinColored([
      [legs, geometryBandColor(geo, 0, 0.72)],
      [cab, geometryBandColor(geo, 0.72, 0.9)],
      [roof, geometryBandColor(geo, 0.9, 1)],
    ]);
  }
  if (type === 'waterTower') {
    const r = Math.max(hx, hz);
    const yTank0 = y0 + h * 0.56;
    const yTank1 = y0 + h * 0.84;
    const legs = new THREE.CylinderGeometry(
      r * 0.48,
      r * 0.95,
      yTank0 - y0,
      6,
      1,
      true
    ).translate(cx, (y0 + yTank0) * 0.5, cz);
    const tank = new THREE.CylinderGeometry(
      r * 0.78,
      r * 0.78,
      yTank1 - yTank0,
      6,
      1,
      false
    ).translate(cx, (yTank0 + yTank1) * 0.5, cz);
    const roof = new THREE.ConeGeometry(
      r * 0.82,
      y1 - yTank1,
      6,
      1,
      true
    ).translate(cx, (yTank1 + y1) * 0.5, cz);
    return joinColored([
      [legs, geometryBandColor(geo, 0, 0.56)],
      [tank, geometryBandColor(geo, 0.56, 0.84)],
      [roof, geometryBandColor(geo, 0.84, 1)],
    ]);
  }
  if (type === 'windpump') {
    const yHead = y0 + h * 0.79;
    const legs = taperedBox(
      hx * 0.25,
      hz * 0.25,
      hx * 0.9,
      hz * 0.9,
      y0,
      yHead
    ).translate(cx, 0, cz);
    const wheelH = y1 - yHead;
    const wheel = new THREE.BoxGeometry(hx * 1.65, wheelH, hz * 0.28).translate(
      cx,
      (yHead + y1) * 0.5,
      cz
    );
    const vane = new THREE.BoxGeometry(
      hx * 0.26,
      wheelH * 0.62,
      hz * 1.65
    ).translate(cx, yHead + wheelH * 0.42, cz);
    const headCol = geometryBandColor(geo, 0.79, 1);
    return joinColored([
      [legs, geometryBandColor(geo, 0, 0.79)],
      [wheel, headCol],
      [vane, headCol],
    ]);
  }
  const r = Math.max(hx, hz);
  const yCap0 = y0 + h * 0.68;
  const yFin0 = y0 + h * 0.9;
  const body = new THREE.CylinderGeometry(
    r * 0.66,
    r * 0.98,
    yCap0 - y0,
    6,
    1,
    true
  ).translate(cx, (y0 + yCap0) * 0.5, cz);
  const cap = new THREE.ConeGeometry(
    r * 0.72,
    yFin0 - yCap0,
    6,
    1,
    false
  ).translate(cx, (yCap0 + yFin0) * 0.5, cz);
  const finial = new THREE.ConeGeometry(
    r * 0.12,
    y1 - yFin0,
    4,
    1,
    true
  ).translate(cx, (yFin0 + y1) * 0.5, cz);
  return joinColored([
    [body, geometryBandColor(geo, 0, 0.68)],
    [cap, geometryBandColor(geo, 0.68, 0.9)],
    [finial, geometryBandColor(geo, 0.9, 1)],
  ]);
}

// Straw huts, barns, monasteries, castle ruins and windmills, one
// material each (collectStructures in terrain-gen.js). Past
// TREE_LOD_CHUNK_RADIUS the farm buildings, huts and chapels draw as the same
// simple shapes they cast shadows with: a barn is a few pixels there. Castle
// ruins and windmills switch to custom skyline models past TOWER_FAR_CHUNK_RADIUS.
const TOWER_FAR_TYPES = new Set(['castleRuins', 'windmillBase']);
for (const [type, geo, mat, round] of [
  ['strawHutBody', strawHutBodyGeo, strawHutMat, true],
  ['strawHutRoof', strawHutRoofGeo, strawHutMat, true],
  ['barnBody', barnBodyGeo, barnMat, false],
  ['barnRoof', barnRoofGeo, barnMat, false],
  ['timberBarnBody', timberBarnBodyGeo, barnMat, false],
  ['timberBarnRoof', timberBarnRoofGeo, barnMat, false],
  ['hayBarnBody', hayBarnBodyGeo, barnMat, false],
  ['hayBarnRoof', hayBarnRoofGeo, barnMat, false],
  ['barnSiloBody', barnSiloBodyGeo, barnSiloMat, true],
  ['barnSiloRoof', barnSiloRoofGeo, barnSiloRoofMat, true],
  ['monasteryBody', monasteryBodyGeo, monasteryBodyMat, false],
  ['monasteryRoof', monasteryRoofGeo, monasteryRoofMat, false],
  ['castleRuins', castleRuinsGeo, castleRuinsMat, false],
  ['windmillBase', windmillBaseGeo, windmillBaseMat, true],
  ['windmillBlades', windmillBladesGeo, windmillBladesMat, null],
]) {
  globalInstancer.registerType(type, geo, mat);
  if (round !== null) {
    const proxy = round
      ? type.endsWith('Roof')
        ? shadowCone(geo)
        : shadowCylinder(geo)
      : type.endsWith('Roof')
        ? shadowGable(geo)
        : shadowBox(geo);
    globalInstancer.setShadowGeometry(type, proxy);
    if (TOWER_FAR_TYPES.has(type)) {
      globalInstancer.setFarGeometry(type, towerFarGeo(type, geo), {
        nearRadius: TOWER_FAR_CHUNK_RADIUS,
      });
    } else {
      globalInstancer.setFarGeometry(type, proxy);
    }
  }
}
// Small boats (boat-models.js, placed by smallBoatAt in terrain-gen.js) and
// tractors (farm-models.js, tractorSpot): one model each, a few thousand
// triangles at most, so not drawn far away
for (const [type, geo] of Object.entries({
  ...buildSmallBoatGeos(),
  ...buildTractorGeos(),
})) {
  globalInstancer.registerType(type, geo, boatMat, 2000);
  globalInstancer.setFarGeometry(type, null);
  globalInstancer.setShadowGeometry(type, shadowBox(geo));
}
// Landmarks (building-models.js, LANDMARK_RULES in terrain-gen.js): a few
// thousand triangles each but only a handful about, so the towers stay in
// sight far off, over the woods and villages
for (const [type, geo] of Object.entries(buildLandmarkGeos(LANDMARK_TOWERS))) {
  globalInstancer.registerType(type, geo, buildingMat, 200);
  // Dinosaur skulls are rare enough to cast with their own shape
  if (!type.startsWith('dinoSkull')) {
    globalInstancer.setShadowGeometry(
      type,
      type === 'fireLookout' ? shadowBox(geo) : shadowCylinder(geo)
    );
    globalInstancer.setFarGeometry(type, towerFarGeo(type, geo), {
      nearRadius: TOWER_FAR_CHUNK_RADIUS,
    });
  }
}
// The campers' trailers: one part each, too small to see far off
for (const [type, geo] of Object.entries(buildLandmarkGeos(LANDMARK_SMALL))) {
  globalInstancer.registerType(type, geo, buildingMat, 200);
  globalInstancer.setFarGeometry(type, null);
  globalInstancer.setShadowGeometry(type, shadowBox(geo));
}
// The landmark houses (beach huts, shacks, ranger stations and
// lean-tos): too small to see far off
for (const [type, geo] of Object.entries(buildLandmarkGeos(LANDMARK_HOUSES))) {
  globalInstancer.registerType(type, geo, buildingMat, 400);
  globalInstancer.setFarGeometry(type, null);
  globalInstancer.setShadowGeometry(
    type,
    type.startsWith('mushroomCottage') ? shadowCylinder(geo) : shadowBox(geo)
  );
}
// The sails turn in their shader, shadows too
globalInstancer.types.get('windmillBlades').shadowMesh.customDepthMaterial =
  windmillBladesDepthMat;

// Distant versions (beyond TREE_LOD_CHUNK_RADIUS). The costliest models get a
// simple shape fitted to their bounds (same material and instance colors);
// props too small to see that far away aren't drawn. All tree species share a
// single far canopy mesh and a single far trunk mesh per tile.
const farCanopy = (geo) =>
  fitToBounds(new THREE.IcosahedronGeometry(1, 0), geo); // 20 triangles
breakwaterRockGeos.forEach((geo, i) =>
  globalInstancer.setFarGeometry('breakwaterRock' + i, farCanopy(geo), {
    nearRadius: TOWER_FAR_CHUNK_RADIUS,
  })
);
const farTrunk = (geo) => {
  geo.computeBoundingBox();
  const h = geo.boundingBox.max.y * 0.75;
  const shape = new THREE.CylinderGeometry(0.9, 1.4, h, 6, 1, true); // 12 triangles
  shape.translate(0, h * 0.5, 0);
  if (geo.attributes.color) {
    const [r, g, b] = geometryAverageColor(geo);
    fillVertexColor(shape, r, g, b);
  }
  return shape;
};
const sharedFarCanopyGeo = fillVertexColor(
  new THREE.IcosahedronGeometry(6, 0).translate(0, 12, 0),
  1,
  1,
  1
);
const sharedFarTrunkGeo = new THREE.CylinderGeometry(
  0.9,
  1.4,
  1,
  6,
  1,
  true
).translate(0, 0.5, 0);
globalInstancer.registerType(
  'farTreeLeaves',
  sharedFarCanopyGeo,
  treeLeavesBaseMat,
  30000,
  true,
  false
);
globalInstancer.registerType(
  'farTreeTrunk',
  sharedFarTrunkGeo,
  houseTintMat,
  30000,
  true,
  false
);
const shareFarCanopy = (type, geo) => {
  const farGeo = farCanopy(geo);
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const [cr, cg, cb] = geometryAverageColor(geo);
  const sx = half.x / 6;
  const sy = half.y / 6;
  const sz = half.z / 6;
  globalInstancer.setFarGeometry(type, farGeo, {
    screenSized: true,
    farShare: {
      targetType: 'farTreeLeaves',
      sx,
      sy,
      sz,
      tx: center.x,
      ty: center.y - 12 * sy,
      tz: center.z,
      cr,
      cg,
      cb,
    },
  });
  return farGeo;
};
// `mat`: the trunk's material, for its colour when the model has no vertex
// colours of its own (Joshua trees, mushroom stalks)
const SMALL_PROP_FAR_RADIUS = 4;
const shareFarTrunk = (type, geo, mat = null) => {
  const farGeo = farTrunk(geo);
  const h = geo.boundingBox.max.y * 0.75;
  const [cr, cg, cb] =
    mat && !geo.attributes.color
      ? [mat.color.r, mat.color.g, mat.color.b]
      : geometryAverageColor(geo);
  globalInstancer.setFarGeometry(type, farGeo, {
    screenSized: true,
    farRadius: SMALL_PROP_FAR_RADIUS,
    farShare: {
      targetType: 'farTreeTrunk',
      sx: 1,
      sy: h,
      sz: 1,
      tx: 0,
      ty: 0,
      tz: 0,
      cr,
      cg,
      cb,
    },
  });
  return farGeo;
};
const screenSized = {screenSized: true};
// Pines: the most numerous trees (thousands near the plane), and until now
// drawn whole at every distance. Past the canopy detail radius a six-sided
// cone (6 triangles, was 64) on the shared far trunk; their shadows are the
// cone too
{
  const pineFar = fitToBounds(
    new THREE.ConeGeometry(1, 2, 6, 1, true),
    treeLeavesGeo
  );
  globalInstancer.setFarGeometry('pineLeaves', pineFar, screenSized);
  globalInstancer.setShadowGeometry('pineLeaves', pineFar);
  shareFarTrunk('pineTrunk', treeTrunkGeo, treeTrunkMat);
}
shareFarCanopy('decidLeaves', deciduousGeos.leaves);
shareFarTrunk('decidTrunk', deciduousGeos.trunk);
shareFarCanopy('tallDecidLeaves', tallDeciduousGeos.leaves);
shareFarTrunk('tallDecidTrunk', tallDeciduousGeos.trunk);
shareFarCanopy('palmLeaves', palmGeos.leaves);
{
  const palmFarTrunk = fitToBounds(
    new THREE.CylinderGeometry(0.6, 1, 2, 6, 1, true),
    palmGeos.trunk
  );
  const box = palmGeos.trunk.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const [cr, cg, cb] = geometryAverageColor(palmGeos.trunk);
  globalInstancer.setFarGeometry('palmTrunk', palmFarTrunk, {
    screenSized: true,
    farRadius: SMALL_PROP_FAR_RADIUS,
    farShare: {
      targetType: 'farTreeTrunk',
      sx: (size.x * 0.5) / 1.4,
      sy: size.y,
      sz: (size.z * 0.5) / 1.4,
      tx: center.x,
      ty: box.min.y,
      tz: center.z,
      cr,
      cg,
      cb,
    },
  });
}
for (const [prefix, geos] of POLYFORK_TREES) {
  shareFarTrunk(prefix + 'Trunk', geos.trunk);
  shareFarCanopy(prefix + 'Leaves', geos.leaves);
}
for (const [deadType, deadGeo, deadMat] of [
  ['deadTrunk', deadTreeGeo, deadTreeMat],
  ['deadCottonwoodTrunk', deadCottonwoodGeo, null],
  ['twistedDeadOakTrunk', twistedDeadOakGeo, null],
]) {
  const farDead = shareFarTrunk(deadType, deadGeo, deadMat);
  globalInstancer.setShadowGeometry(deadType, farDead);
}
globalInstancer.setFarGeometry(
  'cactus',
  fitToBounds(new THREE.BoxGeometry(2, 2, 2), cactusGeo),
  screenSized
);
// Bushes (480 triangles each) are a fitted shape past the detail radius, and
// not drawn at all past TREE_LOD_CHUNK_RADIUS
globalInstancer.setFarGeometry('bush', farCanopy(bushGeo), {
  screenSized: true,
  farRadius: TREE_LOD_CHUNK_RADIUS,
});
for (const [type, geo] of [
  ['rock', rockGeo],
  ['snowRock', rockGeo],
  ['desertRock', rockGeo],
  ['lilypad', lilyPadGeo],
]) {
  globalInstancer.setFarGeometry(type, geo, {
    farRadius: SMALL_PROP_FAR_RADIUS,
  });
}
globalInstancer.setFarGeometry('snowman', null);
globalInstancer.setFarGeometry('hayBale', null);
globalInstancer.setFarGeometry('fallenLog', null);
globalInstancer.setShadowGeometry('fallenLog', shadowBox(fallenLogGeo));
globalInstancer.setFarGeometry('stump', null);
globalInstancer.setFarGeometry('seal', null);
globalInstancer.setFarGeometry('penguin', null);
// Small critters and snowmen (200-400 triangles) cast a fitted shape's shadow
globalInstancer.setShadowGeometry('penguin', shadowCylinder(penguinGeo));
globalInstancer.setShadowGeometry('seal', shadowBox(sealGeo));
globalInstancer.setShadowGeometry('snowman', shadowCylinder(snowmanGeo));
globalInstancer.setFarGeometry('buoy', null);
globalInstancer.setFarGeometry('buoyTop', null);
globalInstancer.setFarGeometry('sheepWool', null);
globalInstancer.setFarGeometry('sheepDark', null);

// Swamp biome vegetation and backwater props (swamp-models.js, vertex-colored)
const swampGeos = buildSwampGeos();
for (const [type, canopyHex, barkHex] of [
  ['swampCypress', 0x3d5c2e, 0x4b3b2c],
  ['swampCypressMoss', 0x485e38, 0x4b3b2c],
  ['swampTupelo', 0x3b582c, 0x4a3b2c],
]) {
  const farSwamp = createSwampFarCanopy(swampGeos[type], canopyHex, barkHex);
  globalInstancer.registerType(type, swampGeos[type], boatMat, 12000);
  // Far away, a blob in the shared far canopy mesh (one draw a tile for all
  // the trees, not one per kind)
  shareFarCanopy(type, swampGeos[type]);
  globalInstancer.setShadowGeometry(type, farSwamp);
}
// Reeds, cattails, lily pads, logs and stumps are 5-14 units and 600-1,000
// triangles each, and the swamp is thick with them: drawn only this many
// chunks out (a 5-unit reed clump is ~2 pixels at 1.5 km on a phone)
const SWAMP_SMALL_PROP_RADIUS = 1;
// Goats and deer only in the plane's chunk and the ring around it
for (const type of ['goatCoat', 'goatDark', 'deerCoat', 'deerDark']) {
  globalInstancer.setFarGeometry(type, null, {
    farRadius: SWAMP_SMALL_PROP_RADIUS,
  });
}
for (const type of ['swampDeadOak', 'swampSnag', 'swampLog', 'swampStump']) {
  const castsShadow = type !== 'swampStump';
  globalInstancer.registerType(
    type,
    swampGeos[type],
    boatMat,
    6000,
    false,
    castsShadow
  );
  // Small deadwood (~700-900 triangles each) only in the plane's chunk and the
  // ring around it; the tall dead oaks and snags are a trunk shape past the
  // detail radius instead
  const tall = type === 'swampDeadOak' || type === 'swampSnag';
  if (tall) shareFarTrunk(type, swampGeos[type]);
  else {
    globalInstancer.setFarGeometry(type, null, {
      farRadius: SWAMP_SMALL_PROP_RADIUS,
    });
  }
  if (castsShadow) {
    globalInstancer.setShadowGeometry(
      type,
      type === 'swampLog'
        ? shadowBox(swampGeos[type])
        : farTrunk(swampGeos[type])
    );
  }
}
// Unmarked giant twisted dead oak in the swamp (~272 units tall): kept in
// sight at full distance like the landmark towers
globalInstancer.registerType(
  'swampGiantOak',
  swampGeos.swampGiantOak,
  boatMat,
  16
);
globalInstancer.setShadowGeometry(
  'swampGiantOak',
  farTrunk(swampGeos.swampGiantOak)
);
for (const type of ['swampReeds', 'swampCattails']) {
  globalInstancer.registerType(
    type,
    swampGeos[type],
    boatMat,
    16000,
    false,
    false
  );
  globalInstancer.setFarGeometry(type, null, {
    farRadius: SWAMP_SMALL_PROP_RADIUS,
  });
}
globalInstancer.registerType(
  'swampLilyPads',
  swampGeos.swampLilyPads,
  boatMat,
  16000,
  false,
  false
);
globalInstancer.setFarGeometry('swampLilyPads', null, {
  farRadius: SWAMP_SMALL_PROP_RADIUS,
});
// Town streets: flat, so they cast no shadow
globalInstancer.registerType(
  'townStreet',
  townStreetGeo,
  bridgeDeckMat,
  30000,
  false,
  false
);

// Doors and chimneys aren't drawn far away; windows are, so villages still
// twinkle on the horizon at night
globalInstancer.setFarGeometry('houseDoor', null);
globalInstancer.setFarGeometry('houseChimney', null);
globalInstancer.setFarGeometry('twoStoryChimney', null);
globalInstancer.setFarGeometry(
  'houseWindow',
  new THREE.PlaneGeometry(2, 2.5).translate(0, 0, 0.25)
);

// Rounded canopies and bushes cast shadows with the same fitted shapes. Palm
// fronds cast with a flat 7-frond star (14 triangles, both faces), which keeps
// their distinctive star-shaped shadow.
globalInstancer.setShadowGeometry(
  'bush',
  globalInstancer.types.get('bush').farGeo
);
{
  palmGeos.leaves.computeBoundingBox();
  palmGeos.trunk.computeBoundingBox();
  const leavesBox = palmGeos.leaves.boundingBox;
  const trunkTop = palmGeos.trunk.boundingBox.max.y;
  const cx = (leavesBox.min.x + leavesBox.max.x) * 0.5;
  const cz = (leavesBox.min.z + leavesBox.max.z) * 0.5;
  const crownY = trunkTop + 1.8;
  const tipY = crownY - 3.8;
  const radius =
    Math.max(
      leavesBox.max.x - leavesBox.min.x,
      leavesBox.max.z - leavesBox.min.z
    ) * 0.5;
  const halfBase = radius * 0.22;
  const fronds = 7;
  const pos = [];
  for (let i = 0; i < fronds; i++) {
    const a = Math.PI + (i / fronds) * Math.PI * 2;
    const ux = Math.cos(a);
    const uz = Math.sin(a);
    const lx = cx - uz * halfBase;
    const lz = cz + ux * halfBase;
    const rx = cx + uz * halfBase;
    const rz = cz - ux * halfBase;
    const tx = cx + ux * radius;
    const tz = cz + uz * radius;
    pos.push(lx, crownY, lz, rx, crownY, rz, tx, tipY, tz);
    pos.push(lx, crownY, lz, tx, tipY, tz, rx, crownY, rz);
  }
  const palmShadowGeo = new THREE.BufferGeometry();
  palmShadowGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(pos, 3)
  );
  palmShadowGeo.computeVertexNormals();
  globalInstancer.setShadowGeometry('palmLeaves', palmShadowGeo);
}
// Palm trunks, Polyfork trunks and cacti cast with simpler models too (12
// triangles instead of 114..391, and 80 instead of 424): a trunk's shadow is
// 2-3 texels wide.
globalInstancer.setShadowGeometry(
  'palmTrunk',
  globalInstancer.types.get('palmTrunk').farGeo
);
globalInstancer.setShadowGeometry('cactus', cactusShadowGeo);
globalInstancer.setShadowGeometry(
  'decidLeaves',
  globalInstancer.types.get('decidLeaves').farGeo
);
globalInstancer.setShadowGeometry(
  'tallDecidLeaves',
  globalInstancer.types.get('tallDecidLeaves').farGeo
);
// Joshua trees and giant mushrooms cast with simple shapes and, far away,
// join the shared far trunk and canopy meshes like the other trees
for (const [type, proxy] of [
  [
    'joshuaTrunk',
    shareFarTrunk('joshuaTrunk', joshuaGeos.trunk, joshuaTrunkMat),
  ],
  ['joshuaLeaves', shareFarCanopy('joshuaLeaves', joshuaGeos.leaves)],
  [
    'mushroomStalk',
    shareFarTrunk('mushroomStalk', mushroomGeos.trunk, mushroomStalkMat),
  ],
  ['mushroomCap', shareFarCanopy('mushroomCap', mushroomGeos.leaves)],
]) {
  globalInstancer.setShadowGeometry(type, proxy);
}
for (const [prefix] of POLYFORK_TREES) {
  globalInstancer.setShadowGeometry(
    prefix + 'Trunk',
    globalInstancer.types.get(prefix + 'Trunk').farGeo
  );
  globalInstancer.setShadowGeometry(
    prefix + 'Leaves',
    globalInstancer.types.get(prefix + 'Leaves').farGeo
  );
}

const WATERCRAFT_DRAW_DISTANCE = 6000;

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
const _up = new THREE.Vector3();
const _glowNormal = new THREE.Vector3();
const WATER_DEPTH_RANGE = 40;

function attachWaterDepthTexture(waterMesh, heightGrid, softDepth, reef) {
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
  // transparency, blending gradually from the beach to open water). B, A:
  // how much coral reef shows through, dark teal and dusky pink
  // (terrain-gen.js reefWeights).
  const bytes = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    bytes[i * 4] = encode(WATER_LEVEL - heightGrid[i]);
    bytes[i * 4 + 1] = encode(softDepth[i]);
    if (reef) {
      bytes[i * 4 + 2] = Math.round(reef[i * 2] * 255);
      bytes[i * 4 + 3] = Math.round(reef[i * 2 + 1] * 255);
    }
  }
  const tex = new THREE.DataTexture(bytes, n, n, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
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
    forceIslandType: ChillFlightLogic.FORCE_ISLAND_TYPE,
    forceContinent: ChillFlightLogic.CONTINENT,
    enableObjects: state._enableObjects,
    morphGrid: {cell: FAR_CELL, segments: FAR_SEGMENTS},
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
  hooks.clearFarTerrain?.();
}

// The top of Meadow Field's access road where it leaves the cross-country
// highway's end (ROAD_EW_END)
function meadowRoadStartY() {
  const i = ChillFlightLogic.ACCESS_ROADS.findIndex((r) => r.crossCountry);
  const ends = ChillFlightLogic.accessRoadEnds(i, simplex, {
    WATER_LEVEL,
    MOUNTAIN_LEVEL,
  });
  if (!ends) return null;
  return ChillFlightLogic.accessRoadDeck(
    ChillFlightLogic.ACCESS_ROADS[i],
    ends,
    ChillFlightLogic.ROAD_EW_END
  );
}

// Where a highway bridge span ends, found by walking along the road from one
// of its samples, keyed by seed, road, walk direction and sample position
// along the road; spans can
// be kilometres long, so neighbouring chunks share the walk
const abutmentCache = new Map();
const MAX_SPAN_SAMPLES = 400;
const roadHeightCache = new Map();
const MAX_ROAD_HEIGHT_CACHE = 8000;
let roadHeightSeed = null;

// Highway n's planned height and the terrain under it at world `along` wa
// (its centre `across` at roadC)
function roadHeightAt(n, wa, roadC) {
  if (roadHeightSeed !== ChillFlightLogic.WORLD_SEED) {
    roadHeightCache.clear();
    roadHeightSeed = ChillFlightLogic.WORLD_SEED;
  }
  const key = n * 1e8 + wa;
  const cached = roadHeightCache.get(key);
  if (cached !== undefined && (roadC === undefined || roadC === cached.roadC)) {
    return cached;
  }
  const rc = roadC ?? ChillFlightLogic.roadCenter(n, wa);
  if (cached !== undefined && rc === cached.roadC) return cached;
  const {x, z} = ChillFlightLogic.roadPoint(n, wa, rc);
  const sample = {
    rawY: ChillFlightLogic.highwayY(
      x,
      z,
      simplex,
      {WATER_LEVEL, MOUNTAIN_LEVEL},
      null
    ),
    actualTerrainH: getElevation(x, z),
    roadC: rc,
  };
  if (roadHeightCache.size >= MAX_ROAD_HEIGHT_CACHE) roadHeightCache.clear();
  roadHeightCache.set(key, sample);
  return sample;
}

// Is the deck there a bridge (well above the ground)?
const isBridgeSample = ({rawY, actualTerrainH}) => rawY - actualTerrainH > 10;

// Steps from `along` wa (a bridge sample) along highway n until the span
// ends; returns how many more bridge samples there were and the height of
// the ground sample past them
function findAbutment(n, wa, step) {
  const key = (a) => `${ChillFlightLogic.WORLD_SEED}:${n}:${step}:${a}`;
  const cached = abutmentCache.get(key(wa));
  if (cached) return {extra: (cached.a - wa) / step - 1, y: cached.y};
  let extra = 0;
  let y = 0;
  for (; extra < MAX_SPAN_SAMPLES; extra++) {
    const sample = roadHeightAt(n, wa + (extra + 1) * step);
    y = Math.max(sample.rawY, sample.actualTerrainH + 1.0);
    if (!isBridgeSample(sample)) break;
  }
  // Every bridge sample walked over leads to the same abutment, so the next
  // chunk along this span finds it without walking
  if (abutmentCache.size > 50000) abutmentCache.clear();
  const end = {a: wa + (extra + 1) * step, y};
  for (let k = 0; k <= extra; k++) abutmentCache.set(key(wa + k * step), end);
  return {extra, y};
}

// Highway n's deck height at `along` wa, graded across a bridge span as the
// chunks grade it (below): samples sit every BRIDGE_SEGMENT_LENGTH from
// half a segment past 0 (chunk edges are whole segments apart)
function gradedDeckY(n, wa) {
  const step = BRIDGE_SEGMENT_LENGTH;
  const at = (a) => {
    const sample = roadHeightAt(n, a);
    const y = Math.max(sample.rawY, sample.actualTerrainH + 1.0);
    if (!isBridgeSample(sample)) return y;
    const back = findAbutment(n, a, -step);
    const ahead = findAbutment(n, a, step);
    const t = (back.extra + 1) / (back.extra + ahead.extra + 2);
    return Math.max(
      WATER_LEVEL + 60,
      back.y + (ahead.y - back.y) * t,
      sample.actualTerrainH + 1.0
    );
  };
  const i = Math.floor((wa - step / 2) / step);
  const a0 = i * step + step / 2;
  const f = (wa - a0) / step;
  return at(a0) * (1 - f) + at(a0 + step) * f;
}

// Where a highway ends in a T on another (the east and coast ones), its deck
// eases to the other's height over this far, so they meet flush even where
// both are bridges graded between different abutments
const T_JUNCTION_BLEND = 300;

// Within this of a north-south highway's centre line, the cross-country
// highway (which crosses it) dips just under its deck, so the two don't
// fight where they overlap: its half width, a little for crossing at an
// angle, and a couple of segments
const JUNCTION_REACH = ChillFlightLogic.ROAD_WIDTH + 2 + 60;
const JUNCTION_DIP = 0.5;

// Where a highway stops short (at a coast), its deck slopes down to the
// ground over this far (units) before the end, rather than stopping in
// mid-air on its bridge
const ROAD_END_RAMP = 600;

// Is world (x, z) at a crossing with a north-south highway that runs there?
function atJunction(x, z) {
  const n = Math.round(
    (x - ChillFlightLogic.ROAD_BASE_X) / ChillFlightLogic.ROAD_SPACING
  );
  if (n < 0 || n > ChillFlightLogic.ROAD_LAST) return false;
  return (
    Math.abs(x - ChillFlightLogic.getRoadCenterX(z, n)) < JUNCTION_REACH &&
    ChillFlightLogic.highwayRunsAt(n, z, simplex, {
      WATER_LEVEL,
      MOUNTAIN_LEVEL,
    })
  );
}

// Is world (x, z), on the east coast highway, where it meets the
// cross-country one (at its north end)?
function atEastJunction(x, z) {
  return (
    x > ChillFlightLogic.ROAD_EW_WEST &&
    x < ChillFlightLogic.ROAD_EW_END &&
    Math.abs(z - ChillFlightLogic.getRoadCenterZ(x)) < JUNCTION_REACH
  );
}

// The slip roads round the corners of the highway crossings
// (ChillFlightLogic.slipRoads): the pieces whose middles are on the chunk
// centred on (worldOffsetX, worldOffsetZ), as decks narrower than a
// highway's with white edge lines, and in roadSegments for driving on
const SLIP_DECK_SCALE =
  (ChillFlightLogic.SLIP.HALF * 2 + 4) / (ChillFlightLogic.ROAD_WIDTH * 2 + 4);
const _slipDummy = new THREE.Object3D();
// The asphalt at world (x, z): the heartland's dark grey, weathered by the
// biome (dusty in the desert and wearing to packed dirt further out,
// snow-dusted in the north, faintly purple in the alien lands). Shared;
// copy it before the next call.
const _roadTint = new THREE.Color();
// And its railings' concrete and painted lane markings
const _railTint = new THREE.Color();
const _paintTint = new THREE.Color();
function roadRailAt(x, z) {
  const w = ChillFlightLogic.roadWeatherAt(x, z, simplex);
  return _railTint
    .copy(ROAD_RAIL.base)
    .lerp(ROAD_RAIL.alien, w.alien)
    .lerp(ROAD_RAIL.dust, w.dust)
    .lerp(ROAD_RAIL.snow, w.snow);
}
function roadAsphaltAt(x, z) {
  const w = ChillFlightLogic.roadWeatherAt(x, z, simplex);
  return _roadTint
    .copy(ROAD_ASPHALT.base)
    .lerp(ROAD_ASPHALT.alien, w.alien)
    .lerp(ROAD_ASPHALT.dust, w.dust)
    .lerp(ROAD_ASPHALT.dirt, w.dirt)
    .lerp(ROAD_ASPHALT.snow, w.snow);
}
// Paint colour (ROAD_PAINT.white or yellow) weathered by biome and faded by
// `fade` (0 fresh to 1 blended into the deck at (x, z))
function roadPaintAt(paint, x, z, fade) {
  const w = ChillFlightLogic.roadWeatherAt(x, z, simplex);
  const weather = Math.max(w.dust, w.snow, w.alien) * 0.25;
  const t = Math.min(1, weather + (1 - weather) * fade);
  return _paintTint.copy(paint).lerp(roadAsphaltAt(x, z), t);
}
function addSlipRoads(group, roadSegments, worldOffsetX, worldOffsetZ) {
  const half = CHUNK_SIZE / 2;
  const pieces = [];
  for (const s of ChillFlightLogic.slipRoads(simplex, {
    WATER_LEVEL,
    MOUNTAIN_LEVEL,
  })) {
    if (
      s.maxX < worldOffsetX - half ||
      s.minX > worldOffsetX + half ||
      s.maxZ < worldOffsetZ - half ||
      s.minZ > worldOffsetZ + half
    ) {
      continue;
    }
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const sx = (a.x + b.x) / 2;
      const sz = (a.z + b.z) / 2;
      const mx = sx - worldOffsetX;
      const mz = sz - worldOffsetZ;
      if (mx < -half || mx >= half || mz < -half || mz >= half) continue;
      pieces.push([a, b]);
      roadSegments.push({
        x0: a.x,
        z0: a.z,
        y0: a.y,
        x1: b.x,
        z1: b.z,
        y1: b.y,
        halfWidth: ChillFlightLogic.SLIP.HALF,
        rails: false,
        dirt: ChillFlightLogic.roadDirtAt(sx, sz, simplex) > 0.5,
      });
    }
  }
  if (pieces.length === 0) return;
  const deckInst = getInstancedMesh(
    bridgeDeckGeo,
    highwayDeckMat,
    pieces.length
  );
  // Each edge line one at a time, and only where it's clear of the
  // highways' decks (not while it runs inside a highway's lane)
  const lineInst = getInstancedMesh(
    roadSlipLineGeo,
    roadWhiteMat,
    pieces.length * 2
  );
  const dummy = _slipDummy;
  const next = new THREE.Vector3();
  pieces.forEach(([a, b], i) => {
    const sx = (a.x + b.x) / 2;
    const sz = (a.z + b.z) / 2;
    dummy.position.set(sx - worldOffsetX, (a.y + b.y) / 2, sz - worldOffsetZ);
    next.set(b.x - worldOffsetX, b.y, b.z - worldOffsetZ);
    dummy.lookAt(next);
    // A little longer than the piece, so the bends have no gaps
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) + 1.5;
    dummy.scale.set(SLIP_DECK_SCALE, 1, length / BRIDGE_SEGMENT_LENGTH);
    dummy.updateMatrix();
    deckInst.setMatrixAt(i, dummy.matrix);
    deckInst.setColorAt(i, roadAsphaltAt(sx, sz));
    const w = ChillFlightLogic.roadWeatherAt(sx, sz, simplex);
    const slipFade = Math.max(
      THREE.MathUtils.smoothstep(w.dirt, 0, 0.55),
      THREE.MathUtils.smoothstep(w.alien, 0.1, ALIEN_PROPS_AT)
    );
    const lineColor = roadPaintAt(ROAD_PAINT.white, sx, sz, slipFade);
    [-1, 1].forEach((side, k) => {
      dummy.position.set(sx - worldOffsetX, (a.y + b.y) / 2, sz - worldOffsetZ);
      dummy.lookAt(next);
      dummy.translateX(side * SLIP_EDGE_LINE_X);
      const clear =
        slipFade < 1 &&
        ChillFlightLogic.highwayDistance(
          dummy.position.x + worldOffsetX,
          dummy.position.z + worldOffsetZ
        ) >
          ChillFlightLogic.ROAD_WIDTH + 1;
      dummy.scale.setScalar(0);
      if (clear) dummy.scale.set(1, 1, length / BRIDGE_SEGMENT_LENGTH);
      dummy.updateMatrix();
      lineInst.setMatrixAt(i * 2 + k, dummy.matrix);
      lineInst.setColorAt(i * 2 + k, lineColor);
    });
  });
  if (deckInst.instanceColor) deckInst.instanceColor.needsUpdate = true;
  if (lineInst.instanceColor) lineInst.instanceColor.needsUpdate = true;
  for (const m of [deckInst, lineInst]) {
    m.position.set(worldOffsetX, 0, worldOffsetZ);
    group.add(m);
  }
  lineInst.userData.noShadow = true;
}

// Is world (x, z), on a highway (one running along x if crossCountry: the
// cross-country or north coast one), inside the box where it crosses
// another? Its lane markings stop there, so the crossing is plain asphalt.
// Out to `pad` past the other's edge.
function inCrossingBox(x, z, crossCountry, pad) {
  const constants = {WATER_LEVEL, MOUNTAIN_LEVEL};
  const reach = (slope) =>
    (ChillFlightLogic.ROAD_WIDTH + 2) * Math.hypot(1, slope) + pad;
  if (crossCountry) {
    // Where the east coast highway meets it
    const eastSpan = ChillFlightLogic.eastRoadSpan();
    if (eastSpan && Math.abs(z - eastSpan[0]) < 200) {
      const e = ChillFlightLogic.ROAD_EAST;
      const ex = ChillFlightLogic.getRoadCenterX(eastSpan[0], e);
      const slope =
        (ChillFlightLogic.getRoadCenterX(eastSpan[0] + 10, e) - ex) / 10;
      if (Math.abs(x - ex) < reach(slope)) return true;
    }
    const n = Math.round(
      (x - ChillFlightLogic.ROAD_BASE_X) / ChillFlightLogic.ROAD_SPACING
    );
    if (n < 0 || n > ChillFlightLogic.ROAD_LAST) return false;
    const slope =
      (ChillFlightLogic.getRoadCenterX(z + 5, n) -
        ChillFlightLogic.getRoadCenterX(z - 5, n)) /
      10;
    return (
      Math.abs(x - ChillFlightLogic.getRoadCenterX(z, n)) < reach(slope) &&
      ChillFlightLogic.highwayRunsAt(n, z, simplex, constants)
    );
  }
  // Where a coast one crosses it
  for (const coast of ChillFlightLogic.COAST_ROADS) {
    const span = ChillFlightLogic.coastRoadSpan(coast);
    if (!span || x < span[0] - 200 || x > span[1] + 200) continue;
    const cx = Math.max(span[0], Math.min(span[1], x));
    const cz = ChillFlightLogic.roadCenter(coast, cx);
    const slope =
      (ChillFlightLogic.roadCenter(coast, cx + 5) -
        ChillFlightLogic.roadCenter(coast, cx - 5)) /
      10;
    if (Math.abs(z - cz) < reach(slope)) return true;
  }
  if (
    x <= ChillFlightLogic.ROAD_EW_WEST ||
    x >= ChillFlightLogic.ROAD_EW_EAST
  ) {
    return false;
  }
  const slope =
    (ChillFlightLogic.getRoadCenterZ(x + 5) -
      ChillFlightLogic.getRoadCenterZ(x - 5)) /
    10;
  return (
    Math.abs(z - ChillFlightLogic.getRoadCenterZ(x)) < reach(slope) &&
    ChillFlightLogic.highwayRunsAt(
      ChillFlightLogic.ROAD_EW,
      x,
      simplex,
      constants
    )
  );
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
    geometry.setAttribute(
      'morphY',
      new THREE.BufferAttribute(
        new Float32Array(geometry.attributes.position.count),
        1
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
  const barnPositions = [];
  const monasteryPositions = [];
  const castleRuinsPositions = [];
  const rockArchPositions = [];
  const rockArchGrassPositions = [];
  let hasWater = !!workerData.hasWater;

  positions.set(workerData.buffers.terrainPositions);
  geometry.attributes.position.needsUpdate = true;

  colors.set(workerData.buffers.terrainColors);
  // For sampleGroundColor (the touchdown dust)
  group.userData.terrainColors = colors;
  group.userData.terrainSegments = state.SEGMENTS;
  const morphY = geometry.attributes.morphY;
  morphY.array.set(workerData.buffers.morphHeights);
  morphY.needsUpdate = true;
  const cp = workerData.chunkProps;
  if (cp.housePositions) housePositions.push(...cp.housePositions);
  if (cp.twoStoryHousePositions)
    twoStoryHousePositions.push(...cp.twoStoryHousePositions);
  if (cp.strawHutPositions) strawHutPositions.push(...cp.strawHutPositions);
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

  if (cp.waterfall) {
    const waterfall = createWaterfall(cp.waterfall);
    waterfall.position.set(worldOffsetX, 0, worldOffsetZ);
    group.add(waterfall);
    const foot = waterfall.userData.foot;
    const worldRibbon = foot.ribbon?.map((r) => ({
      x: worldOffsetX + r.x,
      y: r.y,
      z: worldOffsetZ + r.z,
      half: r.half,
      sideX: r.sideX,
      sideZ: r.sideZ,
    }));
    const segments = [];
    if (worldRibbon && worldRibbon.length > 1) {
      for (let j = 0; j < worldRibbon.length - 1; j++) {
        const p0 = worldRibbon[j];
        const p1 = worldRibbon[j + 1];
        const vx = p1.x - p0.x;
        const vy = p1.y - p0.y;
        const vz = p1.z - p0.z;
        const lenSq = vx * vx + vy * vy + vz * vz;
        if (lenSq < 1e-4) continue;
        const sideX = (p0.sideX + p1.sideX) * 0.5;
        const sideZ = (p0.sideZ + p1.sideZ) * 0.5;
        const sideLen = Math.hypot(sideX, sideZ) || 1;
        const sx = sideX / sideLen;
        const sz = sideZ / sideLen;
        const nx = vy * sz;
        const ny = vz * sx - vx * sz;
        const nz = -vy * sx;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        segments.push({
          p0,
          vx,
          vy,
          vz,
          lenSq,
          minY: Math.min(p0.y, p1.y) - 20,
          maxY: Math.max(p0.y, p1.y) + 5,
          minX: Math.min(p0.x, p1.x) - Math.max(p0.half, p1.half) - 15,
          maxX: Math.max(p0.x, p1.x) + Math.max(p0.half, p1.half) + 15,
          minZ: Math.min(p0.z, p1.z) - 20,
          maxZ: Math.max(p0.z, p1.z) + 20,
          half0: p0.half,
          dHalf: p1.half - p0.half,
          sx,
          sz,
          unx: nx / nLen,
          uny: ny / nLen,
          unz: nz / nLen,
        });
      }
    }
    waterfallFeet.set(group, {
      ...foot,
      x: worldOffsetX + foot.x,
      z: worldOffsetZ + foot.z,
      ribbon: worldRibbon,
      segments,
    });
  }

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
  group.userData.minY = geometry.boundingBox.min.y;
  group.userData.maxY = geometry.boundingBox.max.y + 120;

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
        volcanoCrater.y = minCalderaElev;
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

        // Spot light pointing up to cast a glow on the crater walls, placed
        // slightly above the lava surface to avoid being buried
        volcanoGlow.position.set(vX, lavaY + 10, vZ);
        volcanoGlow.target.position.set(vX, 2000, vZ);
        volcanoGlow.target.updateMatrixWorld();
        volcanoGlow.intensity = VOLCANO_GLOW;
        group.userData.volcanoGlow = true;
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
      waterGeo.setAttribute(
        'flow',
        new THREE.BufferAttribute(
          new Float32Array(waterGeo.attributes.position.count * 3),
          3
        )
      );
    }
    waterGeo.userData = {unique: true, poolType: 'water'};

    waterGeo.attributes.position.array.set(workerData.buffers.waterPositions);
    waterGeo.attributes.color.array.set(workerData.buffers.waterColors);
    waterGeo.attributes.flow.array.set(workerData.buffers.waterFlow);
    waterGeo.attributes.flow.needsUpdate = true;

    waterGeo.attributes.position.needsUpdate = true;
    waterGeo.attributes.color.needsUpdate = true;
    waterGeo.computeBoundingBox();
    waterGeo.computeBoundingSphere();
    const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
    waterMesh.position.set(worldOffsetX, 0, worldOffsetZ);
    attachWaterDepthTexture(
      waterMesh,
      workerData.buffers.heightGrid,
      workerData.buffers.softWaterDepth,
      workerData.buffers.reefGrid
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
  const lodDistance =
    state.manualPropLOD !== undefined
      ? state.manualPropLOD
      : Math.min(
          state.RENDER_DISTANCE * CHUNK_SIZE - CHUNK_SIZE / 2,
          maxPropLOD
        );
  objectsLOD.addLevel(emptyLODGroup, lodDistance);
  objectsLOD.visible = state._enableObjects;

  group.add(objectsLOD);
  group.userData.objectsGroup = objectsLOD;

  // Trees, rocks and other small props arrive as instanceData, drawn by
  // GlobalInstanceManager; the rest are built per chunk below.
  const dummy = new THREE.Object3D();
  const meshProps = [];
  group.userData.meshProps = meshProps;

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
      meshProps.push(rockArchProp(pos, [mesh], geos.blocks, false));
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
      meshProps.push(rockArchProp(pos, [rockMesh, grassMesh], geos.blocks));
    });
  }

  // Straw huts, barns, monasteries, castle ruins and windmills
  // arrive as instanceData too (collectStructures in terrain-gen.js), so they
  // can be knocked down (breakables.js).

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

    // The tower topples like a giant tree and its light goes out; the
    // keeper's house falls down and the flagpole tips over
    const objs = lighthouseGroup.children;
    const objPart = (object, role) => ({type: 'obj', object, role});
    // The rock islet comes after the tower and never breaks; then the house
    const h = LIGHTHOUSE_TOWER_PARTS + 1;
    meshProps.push({
      kind: BREAKABLE.TREE,
      parts: objs.slice(0, LIGHTHOUSE_TOWER_PARTS).map((o) => objPart(o)),
      onBreak: (g) => {
        const {lighthouseBeam: beam, lighthouseLight: light} = g.userData;
        if (beam) beam.visible = false;
        if (light) light.intensity = 0;
        g.userData.lighthouseBeam = null;
        g.userData.lighthouseLight = null;
      },
    });
    meshProps.push({
      kind: BREAKABLE.HOUSE,
      parts: [objPart(objs[h], 'fold'), objPart(objs[h + 1], 'fold')],
      rubble: 9,
    });
    meshProps.push({
      kind: BREAKABLE.TREE,
      parts: [objPart(objs[h + 2]), objPart(objs[h + 3])],
    });

    // Use persistent beam and light
    const beamHeight = 126; // Middle of lantern (63 * 2)

    if (pos.headland) {
      // A headland lighthouse: a beam of its own, and no spotlight (one is
      // plenty, at Montauk)
      const beam = new THREE.Mesh(lighthouseBeamGeo, lighthouseHeadlandBeamMat);
      beam.position.set(
        pos.x + worldOffsetX,
        pos.y + beamHeight,
        pos.z + worldOffsetZ
      );
      beam.rotation.order = 'YXZ';
      beam.rotation.y = pos.rotY;
      beam.rotation.x = 0.15;
      beam.scale.set(2, 2, 2);
      beam.visible = false;
      group.add(beam);
      group.userData.lighthouseBeam = beam;
      headlandLighthouseChunks.add(group);
    } else if (persistentLighthouseBeam) {
      persistentLighthouseBeam.position.set(
        pos.x + worldOffsetX,
        pos.y + beamHeight,
        pos.z + worldOffsetZ
      );
      // Yaw then tilt, so it dips the same whichever way it points
      persistentLighthouseBeam.rotation.order = 'YXZ';
      persistentLighthouseBeam.rotation.y = pos.rotY;
      persistentLighthouseBeam.rotation.x = 0.15; // Tilt slightly downward
      persistentLighthouseBeam.scale.set(2, 2, 2); // Scale beam to match
      persistentLighthouseBeam.visible = true;

      // Store in userData for game.js to animate!
      group.userData.lighthouseBeam = persistentLighthouseBeam;
    }

    if (persistentLighthouseLight && !pos.headland) {
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
    // Straight piers, and the ones turning off at the end (an L)
    const ells = pierPositions.filter((p) => p.ell).length;
    const deckInst = getInstancedMesh(
      pierDeckGeo,
      pierDeckMat,
      pierPositions.length - ells
    );
    const ellInst =
      ells > 0 ? getInstancedMesh(pierDeckLGeo, pierDeckMat, ells) : null;
    const postInst = getInstancedMesh(
      pierPostGeo,
      woodMat,
      pierPositions.length * 4 + ells * 3
    );

    let straightIndex = 0;
    let ellIndex = 0;
    let postIndex = 0;
    pierPositions.forEach((pos) => {
      // The deck at its old height (1 above the shore), its posts down
      // into the sand and water
      dummy.position.set(pos.x, pos.y + 1 - PIER_DECK_TOP, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      const inst = pos.ell ? ellInst : deckInst;
      const index = pos.ell ? ellIndex++ : straightIndex++;
      inst.setMatrixAt(index, dummy.matrix);
      meshProps.push({
        kind: BREAKABLE.HOUSE,
        parts: [{type: pos.ell ? 'pierDeckL' : 'pierDeck', mesh: inst, index}],
      });

      // Pilings carrying the deck's outer posts on down to the bottom (and
      // the L's outer corner and arm end)
      const offsets = [
        [-6.6, 10.5],
        [6.6, 10.5],
        [-6.6, 31],
        [6.6, 31],
      ];
      if (pos.ell) offsets.push([6.6, 41.5], [-34.5, 31.5], [-34.5, 41.5]);
      offsets.forEach((off) => {
        const p = new THREE.Vector3(
          off[0],
          1 - PIER_DECK_TOP - 5,
          off[1]
        ).applyAxisAngle(yAxis, pos.rotY);
        dummy.position.set(pos.x + p.x, pos.y + p.y, pos.z + p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        postInst.setMatrixAt(postIndex++, dummy.matrix);
      });
    });

    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    postInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(deckInst);
    objectsGroup.add(postInst);
    if (ellInst) {
      ellInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(ellInst);
    }
  }

  // 2.955 Generate West Coast Highway
  // Spawn continuous geometric road segments that elevate into bridges over water/valleys.
  // The north-south highways run along z; the cross-country one (ROAD_EW)
  // along x, so below `along` is the coordinate a road runs along and
  // `across` the other (ChillFlightLogic.roadCenter).
  if (!isCustom) {
    const halfChunk = CHUNK_SIZE / 2;
    const activeRoads = [];
    for (let n = 0; n <= ChillFlightLogic.ROAD_LAST; n++) {
      const baseX =
        ChillFlightLogic.ROAD_BASE_X + n * ChillFlightLogic.ROAD_SPACING;
      if (
        baseX + 4000 >= worldOffsetX - halfChunk &&
        baseX - 4000 <= worldOffsetX + halfChunk
      ) {
        activeRoads.push(n);
      }
    }
    if (
      Math.abs(ChillFlightLogic.ROAD_EW_BASE_Z - worldOffsetZ) <
        4000 + halfChunk &&
      worldOffsetX + halfChunk > ChillFlightLogic.ROAD_EW_WEST &&
      worldOffsetX - halfChunk < ChillFlightLogic.ROAD_EW_END
    ) {
      activeRoads.push(ChillFlightLogic.ROAD_EW);
    }
    // The east coast highway, along its traced stretch
    const eastSpan = ChillFlightLogic.eastRoadSpan();
    if (
      eastSpan &&
      worldOffsetZ + halfChunk > eastSpan[0] - 1000 &&
      worldOffsetZ - halfChunk < eastSpan[1] + 1000
    ) {
      const ex = ChillFlightLogic.getRoadCenterX(
        Math.max(eastSpan[0], Math.min(eastSpan[1], worldOffsetZ)),
        ChillFlightLogic.ROAD_EAST
      );
      // It turns at most about 58 degrees off north-south (a slope of 1.6)
      if (Math.abs(ex - worldOffsetX) < halfChunk * 3 + 2000) {
        activeRoads.push(ChillFlightLogic.ROAD_EAST);
      }
    }
    // The north and south coast ones, between their T junctions
    const coastSpans = {};
    for (const coast of ChillFlightLogic.COAST_ROADS) {
      const span = ChillFlightLogic.coastRoadSpan(coast);
      coastSpans[coast] = span;
      if (
        !span ||
        worldOffsetX + halfChunk <= span[0] - 1000 ||
        worldOffsetX - halfChunk >= span[1] + 1000
      ) {
        continue;
      }
      const cz = ChillFlightLogic.roadCenter(
        coast,
        Math.max(span[0], Math.min(span[1], worldOffsetX))
      );
      if (Math.abs(cz - worldOffsetZ) < halfChunk * 3 + 2000) {
        activeRoads.push(coast);
      }
    }

    const roadSegments = [];
    activeRoads.forEach((n) => {
      const crossCountry = n === ChillFlightLogic.ROAD_EW;
      // The east coast one starts at a T junction on the cross-country one
      // (spanStart), and runs east of 0 longitude
      const east = n === ChillFlightLogic.ROAD_EAST;
      // The coast ones run along x like the cross-country one, from a T
      // junction on one north-south highway to another
      const coastSpan = coastSpans[n];
      const alongX = crossCountry || !!coastSpan;
      // Where along it a road that starts or ends at a T junction does
      const spanStart = east
        ? eastSpan[0]
        : coastSpan
          ? coastSpan[0]
          : -Infinity;
      const spanEnd = coastSpan ? coastSpan[1] : Infinity;
      const alongOffset = alongX ? worldOffsetX : worldOffsetZ;
      const acrossOffset = alongX ? worldOffsetZ : worldOffsetX;
      const bridgePositions = [];
      const sampleStep = BRIDGE_SEGMENT_LENGTH;

      // Ensure we have access to the constants
      const constants = {
        WATER_LEVEL,
        MOUNTAIN_LEVEL,
      };

      const margin = 900;
      const rawSamples = [];
      const ewEnd = ChillFlightLogic.ROAD_EW_END;
      const minHeight = WATER_LEVEL + 60;

      // The road's planned height and the terrain under it at world
      // `along` wa (its centre `across` at roadC)
      const sampleRoadHeight = (wa, roadC) => roadHeightAt(n, wa, roadC);

      for (
        let sampleA = -halfChunk - margin;
        sampleA <= halfChunk + margin;
        sampleA += sampleStep
      ) {
        const wa = alongOffset + sampleA + sampleStep / 2;
        const roadC = ChillFlightLogic.roadCenter(n, wa);
        if (!alongX && !east && roadC >= 0) continue;

        const {rawY, actualTerrainH} = sampleRoadHeight(wa, roadC);

        rawSamples.push({
          sampleA,
          wa,
          // The cross-country one's last segment reaches ROAD_EW_END,
          // where it's cut off (below)
          onRoute:
            wa + sampleStep > spanStart &&
            wa - sampleStep < spanEnd &&
            ChillFlightLogic.highwayRunsAt(
              n,
              crossCountry && wa - sampleStep < ewEnd
                ? Math.min(wa, ewEnd)
                : Math.min(spanEnd, Math.max(wa, spanStart)),
              simplex,
              constants
            ),
          localC: roadC - acrossOffset,
          rawY,
          actualTerrainH,
          // Under the deck of the other road where they meet
          junction: alongX
            ? atJunction(wa, roadC)
            : east && atEastJunction(roadC, wa),
        });
      }

      // Off-route stretches draw nothing, so skip grading their spans
      if (rawSamples.some((sample) => sample.onRoute)) {
        // 1. Identify elevated bridge spans over water / deep canyons
        const isBridgeSegment = new Uint8Array(rawSamples.length);
        for (let i = 0; i < rawSamples.length; i++) {
          isBridgeSegment[i] = isBridgeSample(rawSamples[i]) ? 1 : 0;
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
            // A span that runs past the sampled window is followed out to
            // its real abutment, so every chunk grades it the same way and
            // the deck lines up at chunk edges.
            let before = 0;
            let after = 0;
            let yStart = finalY[runStart - 1];
            let yEnd = finalY[runEnd + 1];
            if (runStart === 0) {
              ({extra: before, y: yStart} = findAbutment(
                n,
                rawSamples[0].wa,
                -sampleStep
              ));
            }
            if (runEnd === rawSamples.length - 1) {
              ({extra: after, y: yEnd} = findAbutment(
                n,
                rawSamples[runEnd].wa,
                sampleStep
              ));
            }
            const spanLen = runEnd - runStart + 2 + before + after;
            for (let k = runStart; k <= runEnd; k++) {
              const t = (k - runStart + 1 + before) / spanLen;
              finalY[k] = Math.max(minHeight, yStart + (yEnd - yStart) * t);
              finalY[k] = Math.max(
                finalY[k],
                rawSamples[k].actualTerrainH + 1.0
              );
            }
            runStart = -1;
          }
        }

        // Slope down to the ground where the road stops short. Each sample
        // looks along the route itself (not just this chunk's window), so
        // neighbouring chunks agree on the deck's height.
        const rampSamples = Math.round(ROAD_END_RAMP / sampleStep);
        const runsAt = (wa) =>
          // The cross-country one carries on into Meadow Field's access
          // road, and the east coast one into the cross-country one
          (crossCountry && wa > ewEnd) ||
          // and the north coast one into the north-south ones at its ends
          wa < spanStart ||
          wa > spanEnd ||
          ChillFlightLogic.highwayRunsAt(n, wa, simplex, constants);
        for (let i = 0; i < rawSamples.length; i++) {
          if (!rawSamples[i].onRoute) continue;
          const wa = rawSamples[i].wa;
          for (let k = 1; k <= rampSamples; k++) {
            const dir = runsAt(wa + k * sampleStep)
              ? runsAt(wa - k * sampleStep)
                ? 0
                : -1
              : 1;
            if (!dir) continue;
            // The last sample on the route, where the deck meets the ground
            const endA = wa + (k - 1) * sampleStep * dir;
            const {actualTerrainH} = sampleRoadHeight(endA);
            const endY = Math.max(actualTerrainH, WATER_LEVEL) + 1.0;
            const t = (k - 1) / rampSamples;
            const ease = t * t * (3 - 2 * t);
            finalY[i] = Math.max(
              endY + (finalY[i] - endY) * ease,
              rawSamples[i].actualTerrainH + 1.0
            );
            break;
          }
        }

        // Level with the highway it meets at a T junction
        for (const t of ChillFlightLogic.roadTJunctions(n)) {
          if (Math.abs(t.along - alongOffset) > halfChunk + margin + 500) {
            continue;
          }
          const joinY = gradedDeckY(t.road, t.roadAlong);
          for (let i = 0; i < rawSamples.length; i++) {
            const d = Math.abs(rawSamples[i].wa - t.along);
            if (d >= T_JUNCTION_BLEND) continue;
            const u = d / T_JUNCTION_BLEND;
            const ease = u * u * (3 - 2 * u);
            finalY[i] = Math.max(
              joinY + (finalY[i] - joinY) * ease,
              rawSamples[i].actualTerrainH + 1.0
            );
          }
        }

        // Under the deck of a north-south highway it crosses (atJunction)
        for (let i = 0; i < rawSamples.length; i++) {
          if (rawSamples[i].junction) finalY[i] -= JUNCTION_DIP;
        }

        // The cross-country one's end is level with the start of Meadow
        // Field's access road, which carries on from it
        const endY = crossCountry ? meadowRoadStartY() : null;
        if (endY !== null) {
          for (let i = 0; i < rawSamples.length; i++) {
            if (rawSamples[i].wa > ewEnd - ChillFlightLogic.ROAD_WIDTH * 2) {
              finalY[i] = endY;
            }
          }
        }

        // 3. Assemble bridgePositions for this chunk
        for (let i = 0; i < rawSamples.length - 1; i++) {
          const curr = rawSamples[i];
          const next = rawSamples[i + 1];

          // Only keep segments whose center falls inside this chunk
          if (curr.sampleA < -halfChunk || curr.sampleA >= halfChunk) continue;
          if (curr.localC < -halfChunk || curr.localC >= halfChunk) continue;
          if (!curr.onRoute || !next.onRoute) continue;

          const needsPilings = finalY[i] - curr.actualTerrainH > 10;

          let a0 = curr.sampleA + sampleStep / 2;
          if (alongOffset + a0 < spanStart) a0 = spanStart - alongOffset;
          let a1 = curr.sampleA + sampleStep * 1.5;
          if (alongOffset + a1 > spanEnd) a1 = spanEnd - alongOffset;
          if (crossCountry && alongOffset + a1 > ewEnd) {
            a1 = ewEnd - alongOffset;
          }
          bridgePositions.push({
            x: alongX ? a0 : curr.localC,
            y: finalY[i],
            z: alongX ? curr.localC : a0,
            needsPilings: needsPilings,
            terrainH: curr.actualTerrainH,
            // No streetlights there, nor where a slip road joins
            junction:
              curr.junction ||
              next.junction ||
              ChillFlightLogic.isOnSlipRoad(
                (alongX ? a0 + a1 : curr.localC + next.localC) / 2 +
                  worldOffsetX,
                (alongX ? curr.localC + next.localC : a0 + a1) / 2 +
                  worldOffsetZ,
                ChillFlightLogic.ROAD_WIDTH + 4,
                simplex,
                constants
              ),
            nextPos: {
              x: alongX ? a1 : next.localC,
              y: finalY[i + 1],
              z: alongX ? next.localC : a1,
            },
          });
        }
      }

      // A segment's place along the road, counted from world 0, for piers
      // and streetlights at a steady cadence across chunks
      const segmentIndex = (pos) =>
        Math.round(
          (alongOffset +
            (alongX ? pos.x + pos.nextPos.x : pos.z + pos.nextPos.z) / 2) /
            BRIDGE_SEGMENT_LENGTH
        );

      // Out in the desert the road wears smoothly to packed dirt
      // (roadDirtAt); lane markings fade into the deck as the road leaves
      // the heartland or wears to dirt/frontier, and streetlights thin out
      // per segment rather than jumping at chunk edges.
      for (const pos of bridgePositions) {
        const mx = (pos.x + pos.nextPos.x) / 2 + worldOffsetX;
        const mz = (pos.z + pos.nextPos.z) / 2 + worldOffsetZ;
        const w = ChillFlightLogic.roadWeatherAt(mx, mz, simplex);
        const absAlong = Math.abs(crossCountry ? mx : mz);
        pos.dirt = w.dirt > 0.5;
        const bare = Math.max(
          THREE.MathUtils.smoothstep(w.dirt, 0, 0.55),
          THREE.MathUtils.smoothstep(w.alien, 0.1, ALIEN_PROPS_AT),
          THREE.MathUtils.smoothstep(absAlong, 46000, 50000)
        );
        pos.laneFade = Math.max(
          THREE.MathUtils.smoothstep(absAlong, 12000, 15000),
          bare
        );
        pos.centreLinesFade = Math.max(
          THREE.MathUtils.smoothstep(absAlong, 13500, 16000),
          bare
        );
        pos.centreDashFade = Math.max(
          1 - THREE.MathUtils.smoothstep(absAlong, 14500, 16500),
          THREE.MathUtils.smoothstep(w.dirt, 0, 0.15),
          bare
        );
        pos.slFreq =
          w.dirt > 0.15 || w.alien > ALIEN_PROPS_AT || absAlong > 50000
            ? 0
            : absAlong > 25000
              ? 16
              : absAlong > 15000
                ? 8
                : 4;
      }

      // The deck's centre line in world coordinates, for landing on the
      // road (sampleRoad)
      for (const pos of bridgePositions) {
        roadSegments.push({
          x0: pos.x + worldOffsetX,
          z0: pos.z + worldOffsetZ,
          y0: pos.y,
          x1: pos.nextPos.x + worldOffsetX,
          z1: pos.nextPos.z + worldOffsetZ,
          y1: pos.nextPos.y,
          // Raised sections have railings either side (below)
          rails: pos.needsPilings,
          dirt: pos.dirt,
        });
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

            const globalSegmentIndex = segmentIndex(pos);
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
          highwayDeckMat,
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
          highwayRailMat,
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
        // Whether a railing (placed by dummy, `length` long) runs onto
        // another road: any of its ends or middle inside another highway's
        // deck (this road's own centre is halfRoadW away, so it never
        // counts) or on a slip road
        const _railPoint = new THREE.Vector3();
        const railMeetsRoad = (rail, length) => {
          for (const t of [-0.5, 0, 0.5]) {
            _railPoint
              .set(0, 0, t * length)
              .applyQuaternion(rail.quaternion)
              .add(rail.position);
            const x = _railPoint.x + worldOffsetX;
            const z = _railPoint.z + worldOffsetZ;
            if (
              ChillFlightLogic.highwayDistance(x, z) <
                ChillFlightLogic.ROAD_WIDTH + 1 ||
              ChillFlightLogic.isOnSlipRoad(x, z, 1, simplex, constants)
            ) {
              return true;
            }
          }
          return false;
        };
        let girderIndex = 0;
        let railIndex = 0;
        let pierIndex = 0;

        // Lane markings thin out with the streetlights: full markings in
        // the heartland, fading out into a dashed centre line further out,
        // and fading into the deck on dirt or the frontier
        const hasLaneMarkings = bridgePositions.some((p) => p.laneFade < 1);
        const hasCentreLines = bridgePositions.some(
          (p) => p.centreLinesFade < 1
        );
        const hasCentreDash = bridgePositions.some((p) => p.centreDashFade < 1);
        const laneDashesInst = hasLaneMarkings
          ? getInstancedMesh(
              roadLaneDashesGeo,
              roadWhiteMat,
              bridgePositions.length
            )
          : null;
        const centreLinesInst = hasCentreLines
          ? getInstancedMesh(
              roadCentreLinesGeo,
              roadYellowMat,
              bridgePositions.length
            )
          : null;
        const centreDashInst = hasCentreDash
          ? getInstancedMesh(
              roadCentreDashGeo,
              roadYellowMat,
              bridgePositions.length
            )
          : null;
        // White edge lines with the lane lines, each side on its own so it
        // can break where a slip road joins
        const edgeInst = hasLaneMarkings
          ? getInstancedMesh(
              roadEdgeLineGeo,
              roadWhiteMat,
              bridgePositions.length * 2
            )
          : null;
        const markingInsts = [
          laneDashesInst,
          centreLinesInst,
          centreDashInst,
          edgeInst,
        ].filter(Boolean);

        // Calculate exact number of streetlights based on global segment alignment
        let numStreetlights = 0;
        bridgePositions.forEach((pos) => {
          if (
            pos.slFreq > 0 &&
            !pos.junction &&
            Math.abs(segmentIndex(pos)) % pos.slFreq === 0
          ) {
            numStreetlights++;
          }
        });
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
          const mx = midVec.x + worldOffsetX;
          const mz = midVec.z + worldOffsetZ;

          // 1. Deck (paper-thin, for all segments)
          dummy.position.copy(midVec);
          dummy.lookAt(nextVec);
          // A little longer than the segment, so no seam shows where the
          // road bends over a rise
          dummy.scale.set(1, 1, (dist + 1) / BRIDGE_SEGMENT_LENGTH);
          dummy.updateMatrix();
          deckInst.setMatrixAt(index, dummy.matrix);
          deckInst.setColorAt(index, roadAsphaltAt(mx, mz));
          // No markings in the box where it crosses another highway
          const inBox = inCrossingBox(mx, mz, alongX, sampleStep / 2);
          if (laneDashesInst) {
            dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
            if (inBox || pos.laneFade >= 1) dummy.scale.setScalar(0);
            dummy.updateMatrix();
            laneDashesInst.setMatrixAt(index, dummy.matrix);
            laneDashesInst.setColorAt(
              index,
              roadPaintAt(ROAD_PAINT.white, mx, mz, pos.laneFade)
            );
          }
          if (centreLinesInst) {
            dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
            if (inBox || pos.centreLinesFade >= 1) dummy.scale.setScalar(0);
            dummy.updateMatrix();
            centreLinesInst.setMatrixAt(index, dummy.matrix);
            centreLinesInst.setColorAt(
              index,
              roadPaintAt(ROAD_PAINT.yellow, mx, mz, pos.centreLinesFade)
            );
          }
          if (centreDashInst) {
            dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
            if (inBox || pos.centreDashFade >= 1) dummy.scale.setScalar(0);
            dummy.updateMatrix();
            centreDashInst.setMatrixAt(index, dummy.matrix);
            centreDashInst.setColorAt(
              index,
              roadPaintAt(ROAD_PAINT.yellow, mx, mz, pos.centreDashFade)
            );
          }
          if (edgeInst) {
            const edgeColor = roadPaintAt(
              ROAD_PAINT.white,
              mx,
              mz,
              pos.laneFade
            );
            [-1, 1].forEach((side, k) => {
              dummy.position.copy(midVec);
              dummy.lookAt(nextVec);
              dummy.translateX(side * ROAD_EDGE_LINE_X);
              dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
              if (
                inBox ||
                pos.laneFade >= 1 ||
                ChillFlightLogic.isOnSlipRoad(
                  dummy.position.x + worldOffsetX,
                  dummy.position.z + worldOffsetZ,
                  1,
                  simplex,
                  constants
                )
              ) {
                dummy.scale.setScalar(0);
              }
              dummy.updateMatrix();
              edgeInst.setMatrixAt(index * 2 + k, dummy.matrix);
              edgeInst.setColorAt(index * 2 + k, edgeColor);
            });
          }

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

            // Railings - one on each side, sitting flush on top of deck
            // (+0.75). None where another road joins or crosses: under the
            // other road's deck at a junction, or across the mouth where a
            // road or slip road leaves this one
            [-halfRoadW, halfRoadW].forEach((xOff) => {
              dummy.position.copy(midVec);
              dummy.lookAt(nextVec);
              dummy.translateX(xOff);
              dummy.translateY(2.05);
              dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
              if (pos.junction || railMeetsRoad(dummy, dist)) {
                dummy.scale.setScalar(0);
              }
              dummy.updateMatrix();
              railInst.setColorAt(
                railIndex,
                roadRailAt(midVec.x + worldOffsetX, midVec.z + worldOffsetZ)
              );
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

            // The shaft and footing crumble when hit; the cap stays up
            // under the deck, which stays up too
            if (shaftHeight > 0) {
              meshProps.push({
                kind: BREAKABLE.HOUSE,
                parts: [
                  {type: 'bridgePierShaft', mesh: pierShaftInst, role: 'fold'},
                  {
                    type: 'bridgePierFooting',
                    mesh: pierFootingInst,
                    role: 'rubble',
                  },
                ].map((part) => ({...part, index: pierIndex})),
                rubble: 20,
              });
            }

            pierIndex++;
          }

          // Streetlights
          if (pos.slFreq > 0 && slIndex < numStreetlights && !pos.junction) {
            const globalSegmentIndex = segmentIndex(pos);

            if (Math.abs(globalSegmentIndex) % pos.slFreq === 0) {
              const isLeftSide =
                Math.floor(Math.abs(globalSegmentIndex) / pos.slFreq) % 2 === 0;

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
                {geo: streetlightBulbGeo, rot: [0, slYaw, 0], pos: [0, 0, 0]},
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
              meshProps.push({
                kind: BREAKABLE.TREE,
                parts: [
                  ['streetlightPole', slBaseInst],
                  ['streetlightArm', slArmInst],
                  ['streetlightBulb', slBulbInst],
                  ['streetlightDecal', slDecalInst],
                ].map(([type, mesh]) => ({type, mesh, index: slIndex})),
              });

              slIndex++;
            }
          }
        });

        // The deck, girders, pier shafts and the lamps' glow show to the
        // horizon; lane markings, rails, pier caps and footings and lamp
        // posts are a pixel or less that far, so they go with the chunk's
        // props (hidden past the prop draw distance). Each is a draw call.
        if (deckInst.instanceColor) deckInst.instanceColor.needsUpdate = true;
        if (railInst.instanceColor) railInst.instanceColor.needsUpdate = true;
        deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
        group.add(deckInst);
        for (const m of markingInsts) {
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
          m.position.set(worldOffsetX, 0, worldOffsetZ);
          m.userData.noShadow = true;
          objectsGroup.add(m);
        }

        if (numGirderSegments > 0) {
          girderInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(girderInst);
        } else releaseInstancedMesh(girderInst);

        if (numRailSegments > 0) {
          railInst.position.set(worldOffsetX, 0, worldOffsetZ);
          objectsGroup.add(railInst);
        } else releaseInstancedMesh(railInst);

        if (numPiers > 0) {
          pierCapInst.position.set(worldOffsetX, 0, worldOffsetZ);
          pierShaftInst.position.set(worldOffsetX, 0, worldOffsetZ);
          pierFootingInst.position.set(worldOffsetX, 0, worldOffsetZ);
          objectsGroup.add(pierCapInst);
          group.add(pierShaftInst);
          objectsGroup.add(pierFootingInst);
        } else {
          // Unused: back to the pool (not in the chunk, so never released)
          releaseInstancedMesh(pierCapInst);
          releaseInstancedMesh(pierShaftInst);
          releaseInstancedMesh(pierFootingInst);
        }

        if (numStreetlights > 0) {
          slBaseInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slArmInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slBulbInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slDecalInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slBulbInst.visible = state._enableObjects;
          slDecalInst.visible = state._enableObjects;
          objectsGroup.add(slBaseInst);
          objectsGroup.add(slArmInst);
          group.add(slBulbInst);
          group.add(slDecalInst);
          (group.userData.streetlightMeshes ??= []).push(
            slBulbInst,
            slDecalInst
          );
        } else {
          for (const m of [slBaseInst, slArmInst, slBulbInst, slDecalInst]) {
            releaseInstancedMesh(m);
          }
        }
      }
    }); // End activeRoads.forEach
    addSlipRoads(group, roadSegments, worldOffsetX, worldOffsetZ);
    if (roadSegments.length > 0) group.userData.roadSegments = roadSegments;
  }

  // 2.96 Generate Campfires (logs and flame drawn at CAMPFIRE_SCALE, in
  // keeping with the tent and the lean-to shelters beside some of them)
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
    const glowInst = getInstancedMesh(
      streetlightDecalGeo,
      fireGlowMat,
      campfirePositions.length
    );
    const numTentColors = tentGeos.length;
    const tentCounts = Array(numTentColors).fill(0);
    const tentColorIndices = []; // Maps index to colorIndex

    campfirePositions.forEach((pos, index) => {
      // Deterministic color selection using seed-based RNG
      const colorIdx = Math.floor(rng() * numTentColors);
      tentColorIndices[index] = colorIdx;
      tentCounts[colorIdx]++;
    });

    const tentInsts = [];
    const currentComboIndices = Array(numTentColors).fill(0);

    for (let i = 0; i < numTentColors; i++) {
      if (tentCounts[i] > 0) {
        tentInsts[i] = getInstancedMesh(tentGeos[i], tentMat, tentCounts[i]);
        tentInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(tentInsts[i]);
      }
    }

    campfirePositions.forEach((pos, index) => {
      const structure = ModelAssembler.getStructure('campfire', pos.rotY || 0);
      structure.forEach((part, pIdx) => {
        dummy.position.set(
          pos.x + part.pos[0] * CAMPFIRE_SCALE,
          pos.y + part.pos[1] * CAMPFIRE_SCALE,
          pos.z + part.pos[2] * CAMPFIRE_SCALE
        );
        dummy.rotation.order = part.order || 'XYZ';
        dummy.rotation.set(...part.rot);
        dummy.scale.setScalar(CAMPFIRE_SCALE);
        dummy.updateMatrix();

        if (part.geo === fireLogGeo) {
          logInst.setMatrixAt(index * 3 + pIdx, dummy.matrix);
        } else if (part.geo === fireCoreGeo) {
          coreInst.setMatrixAt(index, dummy.matrix);
        }
      });

      const fire = [0, 1, 2].map((i) => ({
        type: 'fireLog',
        mesh: logInst,
        index: index * 3 + i,
      }));
      fire.push({type: 'fireCore', mesh: coreInst, index});
      fire.push({type: 'fireGlow', mesh: glowInst, index});

      // The pool of firelight, laid on the slope of the ground around it
      const gx = worldOffsetX + pos.x;
      const gz = worldOffsetZ + pos.z;
      const slopeX =
        (getElevation(gx + 10, gz) - getElevation(gx - 10, gz)) / 20;
      const slopeZ =
        (getElevation(gx, gz + 10) - getElevation(gx, gz - 10)) / 20;
      dummy.position.set(pos.x, pos.y + 1, pos.z);
      dummy.quaternion.setFromUnitVectors(
        _up.set(0, 1, 0),
        _glowNormal.set(-slopeX, 1, -slopeZ).normalize()
      );
      dummy.scale.set(2, 1, 2);
      dummy.updateMatrix();
      glowInst.setMatrixAt(index, dummy.matrix);
      for (let i = 0; i < 5; i++) {
        fire.push({type: 'fireSmoke', mesh: smokeInst, index: index * 5 + i});
      }
      meshProps.push({kind: BREAKABLE.SMALL, parts: fire});

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

      // Tent community (kept off the side where a trailer is parked)
      let angle = rng() * Math.PI * 2;
      if (pos.trailerAngle !== undefined) {
        // The trailer stands at -(sin, cos) of trailerAngle from the
        // fire, which is this angle in the tent's (cos, sin) terms
        const toTrailer = Math.PI / 2 - pos.trailerAngle + Math.PI;
        const d = Math.atan2(
          Math.sin(angle - toTrailer),
          Math.cos(angle - toTrailer)
        );
        if (Math.abs(d) < Math.PI / 2) angle += Math.PI;
      }
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

      meshProps.push({
        kind: BREAKABLE.TREE,
        parts: [
          {type: 'tent' + colorIdx, mesh: tentInsts[colorIdx], index: instIdx},
        ],
      });
    });

    logInst.position.set(worldOffsetX, 0, worldOffsetZ);
    coreInst.position.set(worldOffsetX, 0, worldOffsetZ);
    smokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
    glowInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(glowInst);
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
    // Not drawn past 6,000 units, where they stop animating too
    // (flight-camera.js); sails are a couple of pixels by then
    watercraftGroup = new THREE.Group();
    watercraftGroup.position.set(-worldOffsetX, 0, -worldOffsetZ);
    const watercraftLOD = new THREE.LOD();
    watercraftLOD.position.set(worldOffsetX, 0, worldOffsetZ);
    watercraftLOD.addLevel(watercraftGroup, 0);
    watercraftLOD.addLevel(new THREE.Group(), WATERCRAFT_DRAW_DISTANCE);
    watercraftLOD.visible = state._enableObjects;
    group.add(watercraftLOD);
    group.userData.watercraftGroup = watercraftLOD;
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
      boatRimFoamGeo,
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
    // Moored boats (sails down) are mirrored by their own mesh, only made
    // where a chunk has one; each boat shows in one of the two
    // (pos.moored, read by the boat animation in flight-camera.js)
    sailboatPositions.forEach((pos) => {
      pos.moored = sailboatMoored(worldOffsetX + pos.x, worldOffsetZ + pos.z);
    });
    const anyMoored = sailboatPositions.some((pos) => pos.moored);
    const mooredReflectionInst = anyMoored
      ? getInstancedMesh(
          sailboatMooredReflectionGeo,
          reflectionMat,
          sailboatPositions.length
        )
      : null;

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
      const moored = pos.moored;
      sailInst.setMatrixAt(
        index,
        moored
          ? _furledSail.multiplyMatrices(dummy.matrix, SAIL_FURL)
          : dummy.matrix
      );

      // Initialize reflection matrix with Y-flipped scale
      dummy.scale.set(1.8, -1.8, 1.8);
      dummy.updateMatrix();
      sailboatReflectionInst.setMatrixAt(
        index,
        moored ? _NO_BOAT : dummy.matrix
      );
      if (mooredReflectionInst)
        mooredReflectionInst.setMatrixAt(
          index,
          moored ? dummy.matrix : _NO_BOAT
        );
    });

    rimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
    boomInst.position.set(worldOffsetX, 0, worldOffsetZ);
    sailInst.position.set(worldOffsetX, 0, worldOffsetZ);
    sailboatReflectionInst.position.set(worldOffsetX, 0, worldOffsetZ);
    if (mooredReflectionInst) {
      mooredReflectionInst.position.set(worldOffsetX, 0, worldOffsetZ);
      mooredReflectionInst.instanceMatrix.needsUpdate = true;
      watercraftGroup.add(mooredReflectionInst);
    }
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
    group.userData.boatMooredReflections = mooredReflectionInst;
  }

  // 3.5 Pirate Ships: one mesh per look the chunk's ships use (null for the
  // others), and one for its reflections, each with a slot for every ship of
  // the chunk, by its index. A ship is drawn only in its own look's mesh;
  // the others keep a zero matrix there.
  if (pirateShipPositions.length > 0) {
    const n = pirateShipPositions.length;
    for (const pos of pirateShipPositions)
      pos.bodyId = (pos.bodyId || 0) % pirateShipGeos.length;
    const used = new Set(pirateShipPositions.map((pos) => pos.bodyId));
    const meshes = (geos, mat) =>
      geos.map((geo, look) => {
        if (!used.has(look)) return null;
        const inst = getInstancedMesh(geo, mat, n);
        inst.position.set(worldOffsetX, 0, worldOffsetZ);
        watercraftGroup.add(inst);
        return inst;
      });
    const ships = meshes(pirateShipGeos, pirateShipMat);
    const reflections = meshes(pirateShipReflectionGeos, reflectionMat);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const place = (list, pos, index) =>
      list.forEach((inst, look) => {
        if (inst)
          inst.setMatrixAt(index, look === pos.bodyId ? dummy.matrix : zero);
      });
    pirateShipPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(2.5, 2.5, 2.5);
      dummy.updateMatrix();
      place(ships, pos, index);
      // Reflection: the same, flipped about the water
      dummy.scale.set(2.5, -2.5, 2.5);
      dummy.updateMatrix();
      place(reflections, pos, index);
    });
    // Past 2,000 units the patrols stop moving (flight-camera.js), so these
    // resting matrices are what's drawn until then
    for (const inst of [...ships, ...reflections])
      if (inst) inst.instanceMatrix.needsUpdate = true;
    group.userData.pirateShipPositions = pirateShipPositions;
    group.userData.pirateShips = ships;
    group.userData.pirateReflections = reflections;
  }

  // 4. Generate Birds
  group.userData.birds = [];
  // This chunk's own geese may still be flying as strays from when it last
  // unloaded; they're replaced by its new flock
  const chunkKey = `${chunkX},${chunkZ}`;
  const strays = strayBirds.userData.birds;
  for (let i = strays.length - 1; i >= 0; i--) {
    if (strays[i].userData.sourceKey === chunkKey) {
      strayBirds.remove(strays[i]);
      strays.splice(i, 1);
    }
  }

  if (ChillFlightLogic.TRAFFIC_PARAM !== false) {
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
        const body = new THREE.Mesh(gooseStaticGeo, gooseStaticMat);
        const wingL = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
        const wingR = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
        wingL.rotation.y = Math.PI;
        goose.add(body, wingL, wingR);
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

        // Not with the chunk's props: those hide past the prop draw distance
        // from the chunk, and a flock flies far from where it spawned
        group.add(goose);
        group.userData.birds.push(goose);
      }
    });
  }

  if (group.userData.birds.length > 0) {
    birdChunks.add(group);
  }

  // Casting shadows: everything but water, smoke, beams, decals and what
  // can't show one (road paint flat on the deck, mirrored boats under the
  // water, waterline foam, birds in the air): each that casts is another
  // draw in the shadow pass
  const castsNoShadow = (child) => {
    if (child.userData.noShadow) return true;
    if (child.material === reflectionMat || child.material === boatRimMat)
      return true;
    for (let o = child.parent; o && o !== group; o = o.parent) {
      const t = o.userData.type;
      if (t === 'seagull' || t === 'hawk' || t === 'goose') return true;
    }
    return false;
  };
  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      if (child.material.userData.isWater) {
        child.receiveShadow = true;
      } else if (castsNoShadow(child)) {
        child.castShadow = false;
        child.receiveShadow = true;
      } else if (
        child.material !== smokeMat &&
        child.material !== lighthouseBeamMat &&
        child.material !== lighthouseHeadlandBeamMat &&
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
  group.userData.breakables = workerData.breakables || null;
  group.userData.breakwaters = workerData.breakwaters?.length
    ? workerData.breakwaters
    : null;
  enableChunkInstanceCulling(group);
  scene.add(group);
  return group;
}

// The highway deck (or an airport's access road) under (x, z), if there is
// one: fills out.height (the top of the deck) and out.slopeX / out.slopeZ
// (rise per unit along x and z, as sampleGround does) and returns true. The deck sits a few units above the
// terrain (and well above it on bridges), so planes land on this rather than
// the ground beneath it (flight-physics.js).
// The terrain's colour at the grid point nearest (x, z), into out (a
// THREE.Color). False where no chunk is loaded.
export function sampleGroundColor(x, z, out) {
  const cx = Math.round(x / CHUNK_SIZE);
  const cz = Math.round(z / CHUNK_SIZE);
  const data = chunks.get(`${cx},${cz}`)?.userData;
  if (!data?.terrainColors) return false;
  const segments = data.terrainSegments;
  const step = CHUNK_SIZE / segments;
  const grid = (v, c) =>
    THREE.MathUtils.clamp(
      Math.round((v - c * CHUNK_SIZE + CHUNK_SIZE / 2) / step),
      0,
      segments
    );
  const i = (grid(z, cz) * (segments + 1) + grid(x, cx)) * 3;
  const colors = data.terrainColors;
  out.setRGB(colors[i], colors[i + 1], colors[i + 2]);
  return true;
}

// The top of a rock breakwater over (x, z), or -Infinity: they're solid
// ground to drive on and fly over (breakwater-logic.js)
export function breakwaterTop(x, z) {
  const cx = Math.round(x / CHUNK_SIZE);
  const cz = Math.round(z / CHUNK_SIZE);
  let top = -Infinity;
  // A breakwater can run a little past its own chunk
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cz - 1; j <= cz + 1; j++) {
      const pieces = chunks.get(`${i},${j}`)?.userData.breakwaters;
      if (pieces) top = Math.max(top, breakwaterTopIn(pieces, x, z));
    }
  }
  return top;
}

export function sampleRoad(x, z, out, vehicleY = null) {
  const cx = Math.round(x / CHUNK_SIZE);
  const cz = Math.round(z / CHUNK_SIZE);
  const sampleState = {found: false, bestDist: Infinity, bestInside: false};

  // Segments can reach a little past their own chunk, so check its neighbours
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let j = cz - 1; j <= cz + 1; j++) {
      const segments = chunks.get(`${i},${j}`)?.userData.roadSegments;
      if (!segments) continue;
      for (const seg of segments) {
        ChillFlightLogic.sampleRoadSegment(
          seg,
          x,
          z,
          out,
          vehicleY,
          sampleState
        );
      }
    }
  }
  // And the airports' access roads, which run straight along x
  const roads = ChillFlightLogic.ACCESS_ROADS;
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    if (Math.abs(z - r.z) > ChillFlightLogic.ACCESS_ROAD_WIDTH + 1) continue;
    if (x < r.minX || x > r.maxX) continue;
    const ends = ChillFlightLogic.accessRoadEnds(i, simplex, {
      WATER_LEVEL,
      MOUNTAIN_LEVEL,
    });
    if (!ends?.built) continue;
    const height = ChillFlightLogic.accessRoadDeck(r, ends, x);
    const slopeX =
      (ChillFlightLogic.accessRoadDeck(r, ends, x + 1) -
        ChillFlightLogic.accessRoadDeck(r, ends, x - 1)) /
      2;
    const slopeZ = 0;

    if (vehicleY !== null) {
      const dist = Math.abs(height - vehicleY);
      if (sampleState.found && dist >= sampleState.bestDist) continue;
      sampleState.bestDist = dist;
    } else {
      if (sampleState.found && height <= out.height) continue;
    }

    out.height = height;
    out.slopeX = slopeX;
    out.slopeZ = slopeZ;
    out.normalX = 0;
    out.normalZ = 1;
    out.across = z - r.z;
    out.halfWidth = ChillFlightLogic.ACCESS_ROAD_WIDTH;
    out.rails = false;
    out.dirt = false;
    sampleState.found = true;
  }
  return sampleState.found;
}

// Chunk props are pooled instanced meshes created with culling off (a reused
// mesh's automatic bounds would be stale), so every chunk's props were drawn
// every frame, in the main view and the shadow map, even when off-screen.
// Once a chunk is built, give each mesh a sphere around its own instances
// (houses, boats and piers usually fill a small part of the chunk, and a
// whole-chunk sphere let half of these draws through), padded for what
// moves after the build: boats drift up to ~30 units and chimney and
// campfire smoke rises ~150 in the vertex shader.
const CHUNK_INSTANCE_CULL_MARGIN = 160;

function enableChunkInstanceCulling(group) {
  group.traverse((object) => {
    if (object.isInstancedMesh) {
      object.boundingSphere = null; // recomputed from this chunk's instances
      object.computeBoundingSphere();
      object.boundingSphere.radius += CHUNK_INSTANCE_CULL_MARGIN;
      object.frustumCulled = true;
    }
  });
}

function disposeChunkGroup(group, key, poolGeometries = true) {
  const instancedMeshesToRelease = [];
  group.traverse((child) => {
    if (child.isInstancedMesh) {
      instancedMeshesToRelease.push(child);
    }
    if (child.isMesh || child.isInstancedMesh) {
      if (child.geometry && child.geometry.userData.unique) {
        if (poolGeometries && child.geometry.userData.poolType === 'terrain') {
          if (
            _terrainGeometryPool.length < 25 &&
            child.geometry.parameters &&
            child.geometry.parameters.widthSegments === state.SEGMENTS
          ) {
            _terrainGeometryPool.push(child.geometry);
          } else {
            child.geometry.dispose();
          }
        } else if (
          poolGeometries &&
          child.geometry.userData.poolType === 'water'
        ) {
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

  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  for (let i = 0; i < instancedMeshesToRelease.length; i++) {
    releaseInstancedMesh(instancedMeshesToRelease[i]);
  }
  group.userData.instanceData = null;
  group.userData.breakables = null;
  group.userData.breakwaters = null;
  group.userData.meshProps = null;
  group.userData.objectsGroup = null;
  group.userData.watercraftGroup = null;
  group.userData.streetlightMeshes = null;
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
  group.userData.boatMooredReflections = null;
  group.userData.pirateShipPositions = null;
  group.userData.pirateShips = null;
  group.userData.pirateReflections = null;
  group.userData.birds = null;
  group.userData.counts = null;
  group.userData.rockArch = null;
  group.userData.roadSegments = null;
  if (group.userData.volcanoGlow) volcanoGlow.intensity = 0;

  scene.remove(group);
  chunks.delete(key);
  watercraftChunks.delete(group);
  waterfallFeet.delete(group);
  birdChunks.delete(group);
  headlandLighthouseChunks.delete(group);
  workerChunkRequests.delete(key);
  workerChunkResults.delete(key);
  if (key === '5,2') {
    if (persistentLighthouseLight) persistentLighthouseLight.intensity = 0;
    if (persistentLighthouseBeam) persistentLighthouseBeam.visible = false;
  }
}

export function clearAllChunks() {
  for (const [key, group] of [...chunks.entries()]) {
    disposeChunkGroup(group, key, false);
  }
  while (_terrainGeometryPool.length > 0) _terrainGeometryPool.pop().dispose();
  while (_waterGeometryPool.length > 0) _waterGeometryPool.pop().dispose();
  while (strayBirds.children.length > 0) {
    strayBirds.remove(strayBirds.children[0]);
  }
  if (strayBirds.userData.birds) strayBirds.userData.birds.length = 0;
  clearChunkQueue();
  clearElevationCache();
  globalInstancer.requestRebuild();
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
      // Its geese fly on as strays rather than vanishing mid-sky
      if (group.userData.birds) {
        for (const bird of group.userData.birds) {
          if (bird.userData.type !== 'goose') continue;
          bird.userData.sourceKey = key;
          strayBirds.attach(bird);
          strayBirds.userData.birds.push(bird);
        }
      }

      disposeChunkGroup(group, key, true);
      if (
        typeof window !== 'undefined' &&
        terrainWorkerManager &&
        terrainWorkerManager.isSupported
      ) {
        terrainWorkerManager.cancelJob(cx, cz);
      }
      chunksEvicted = true;
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
export function toggleProceduralObjects(enabled, syncUrl = true) {
  state._enableObjects = enabled;
  ChillFlightLogic.setShowObjects(enabled);
  strayBirds.visible = enabled;

  // Update all existing chunks
  chunks.forEach((group) => {
    if (group.userData.objectsGroup) {
      group.userData.objectsGroup.visible = enabled;
    }
    if (group.userData.watercraftGroup) {
      group.userData.watercraftGroup.visible = enabled;
    }
    if (group.userData.streetlightMeshes) {
      for (const m of group.userData.streetlightMeshes) m.visible = enabled;
    }
  });

  globalInstancer.requestRebuild();

  // Update debug menu UI if it exists
  const toggle = document.getElementById('debug-objects-toggle');
  if (toggle) toggle.checked = enabled;

  if (syncUrl && typeof window !== 'undefined') {
    if (!enabled) {
      updateUrlParams({objects: 'none'});
    } else {
      updateUrlParams({}, ['objects']);
    }
  }
}

// Global expose
