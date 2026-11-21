// The player vehicle's surface shadow. High over land (with shadows enabled),
// the plane casts into the sun's shadow map like everything else so its shadow
// drapes over trees, roofs and hills. Everywhere else - on water (where 2-unit
// shadow-map texels break into a flickering comb), near the ground during
// approach, flare and rollout (where the shadow map's depth bias detaches the
// shadow below ~8 units), on the Low preset (where world shadows are off), and
// under heavy overcast, twilight or night close to the surface - the vehicle's
// live 256x256 silhouette is projected onto a small surface-conforming mesh
// instead, so the player never loses their ground-proximity cue.
import * as THREE from 'three';
import {CHUNK_SIZE, WATER_LEVEL} from './constants.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {scene} from './scene.js';
import {renderer, dirLight, hemiLight} from './sky.js';
import {planeGroup} from './airplane.js';
import {getElevation} from './terrain-geometry.js';
import {breakwaterTop, sampleRoad} from './terrain-chunks.js';
import {state} from './state.js';
import {hooks} from './hooks.js';

const LAYER = 7;
const SIZE = 256;
const GRID = 18;
const STRIDE = GRID + 1;
const VERT_COUNT = STRIDE * STRIDE;
// Vertical height above the surface (units) where the sun silhouette fades out
const FADE_START = 450;
const FADE_END = 1100;
// Penumbra: sharp right under the wheels, easing up to BLUR_BASE by ~42 units
// so the handoff to the sun's 2-unit shadow map matches its blur
const BLUR_CONTACT = 0.22;
const BLUR_BASE = 1.6;
const BLUR_PER_METRE = 0.01;
const BLUR_DIFFUSE = 1.1;
// Shoreline hysteresis around WATER_LEVEL so skimming a beach never flickers
// while shallow surf still gets the crisp water silhouette
const COAST_ENTER = -0.1;
const COAST_EXIT = 0.05;
// Over land (when world shadows are on), switch to the conformed silhouette
// below LOW_LAND_ENTER and hand back above LOW_LAND_EXIT
const LOW_LAND_ENTER = 38;
const LOW_LAND_EXIT = 46;
// Diffuse sky occlusion directly beneath the vehicle within this height (units)
// keeps a soft ground shadow under overcast skies, twilight and night
const CONTACT_FADE_END = 40;
const LIFT = 0.05;
// Elevated bridge decks sit well above terrain/water: discard the single
// drop cell at a deck's edge so the shadow never hangs in mid-air
const DECK_DROP = 2.5;

const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: true,
  depthBuffer: true,
});
const shadowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
shadowCam.layers.set(LAYER);
const coverMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  fog: false,
  side: THREE.DoubleSide,
});
// The silhouette is drawn in a scene of its own (the plane is moved into it
// for the draw). three.js keeps the lights it found for each scene, and the
// next frame's sun shadow pass runs on those before the lights are gathered
// again, so drawing the main scene from this camera, which sees no lights,
// made that shadow pass use different shaders: a second set of every
// shadow shader compiled mid-flight over water, and the lit materials
// rechecked their shaders every frame
const silhouetteScene = new THREE.Scene();
silhouetteScene.overrideMaterial = coverMaterial;
silhouetteScene.matrixWorldAutoUpdate = false;

const decalMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tMap: {value: target.texture},
    shadowMatrix: {value: new THREE.Matrix4()},
    blurUV: {value: 0.01},
    lod: {value: 0},
    strength: {value: 0.5},
  },
  vertexShader: /* glsl */ `
    attribute float aDeck;
    varying vec3 vWorld;
    varying float vDeck;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vDeck = aDeck;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform mat4 shadowMatrix;
    uniform float blurUV;
    uniform float lod;
    uniform float strength;
    varying vec3 vWorld;
    varying float vDeck;
    const vec2 TAPS[8] = vec2[8](
      vec2(0.0, 0.0), vec2(0.71, 0.0), vec2(-0.71, 0.0), vec2(0.0, 0.71),
      vec2(0.0, -0.71), vec2(0.5, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
    void main() {
      if (vDeck > 0.02 && vDeck < 0.98) discard;
      vec4 p = shadowMatrix * vec4(vWorld, 1.0);
      vec2 uv = p.xy * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      float cover = 0.0;
      for (int i = 0; i < 8; i++) {
        cover += textureLod(tMap, uv + TAPS[i] * blurUV, lod).r;
      }
      cover /= 8.0;
      if (cover < 0.004) discard;
      gl_FragColor = vec4(0.0, 0.0, 0.0, cover * strength);
    }
  `,
  transparent: true,
  depthWrite: false,
  // Preserve destination alpha (0 on water, 1 on land) for art-style post passes
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -6,
});

const decalGeo = new THREE.BufferGeometry();
const decalPositions = new Float32Array(VERT_COUNT * 3);
const decalDecks = new Float32Array(VERT_COUNT);
const rawHeights = new Float32Array(VERT_COUNT);
const liftHeights = new Float32Array(VERT_COUNT);
const posAttr = new THREE.BufferAttribute(decalPositions, 3);
const deckAttr = new THREE.BufferAttribute(decalDecks, 1);
posAttr.setUsage(THREE.DynamicDrawUsage);
deckAttr.setUsage(THREE.DynamicDrawUsage);
decalGeo.setAttribute('position', posAttr);
decalGeo.setAttribute('aDeck', deckAttr);
{
  const indices = new Uint16Array(GRID * GRID * 6);
  let k = 0;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const v00 = j * STRIDE + i;
      const v10 = v00 + 1;
      const v01 = v00 + STRIDE;
      const v11 = v01 + 1;
      indices[k++] = v00;
      indices[k++] = v01;
      indices[k++] = v10;
      indices[k++] = v10;
      indices[k++] = v01;
      indices[k++] = v11;
    }
  }
  decalGeo.setIndex(new THREE.BufferAttribute(indices, 1));
}

const decal = new THREE.Mesh(decalGeo, decalMaterial);
decal.frustumCulled = false;
// Over ground, water, tire tracks and waterfalls; under airborne dust and spray
decal.renderOrder = 2.5;
decal.visible = false;
scene.add(decal);

let measuredModel = null;
let halfExtent = 8;
let overWater = false;
let lowLand = false;
// One of the plane's meshes, to tell whether its shadow casting still
// matches what this module last set (the graphics preset resets it)
let sampleMesh = null;
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _sun = new THREE.Vector3();
const _castDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _road = {height: 0, slopeX: 0, slopeZ: 0};
const _hit = {x: 0, z: 0, terrain: 0, surface: 0, agl: 0, along: 0};
const _yAxis = new THREE.Vector3(0, 1, 0);
const _clear = new THREE.Color();

// Per-frame cache of terrain grid-corner elevations so conforming the 19x19
// decal mesh evaluates procedural noise ~9-16 times instead of 1,400+
const CORNER_CACHE_MAX = 128;
const _cornerKeysX = new Int32Array(CORNER_CACHE_MAX);
const _cornerKeysZ = new Int32Array(CORNER_CACHE_MAX);
const _cornerVals = new Float32Array(CORNER_CACHE_MAX);
let cornerCount = 0;

let nearAirport = null;
let nearAirportFieldY = 0;
let nearRoad = false;
let nearBreakwater = false;

function cornerElevation(ix, iz, step, half) {
  for (let i = 0; i < cornerCount; i++) {
    if (_cornerKeysX[i] === ix && _cornerKeysZ[i] === iz) return _cornerVals[i];
  }
  const h = getElevation(ix * step - half, iz * step - half);
  if (cornerCount < CORNER_CACHE_MAX) {
    _cornerKeysX[cornerCount] = ix;
    _cornerKeysZ[cornerCount] = iz;
    _cornerVals[cornerCount] = h;
    cornerCount++;
  }
  return h;
}

// Exact height of the rendered terrain triangles at (x, z) using cached corners
function sampleGroundFast(x, z) {
  const step = CHUNK_SIZE / state.SEGMENTS;
  const half = CHUNK_SIZE / 2;
  const gx = (x + half) / step;
  const gz = (z + half) / step;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const u = gx - ix;
  const v = gz - iz;
  const a = cornerElevation(ix, iz, step, half);
  const b = cornerElevation(ix, iz + 1, step, half);
  const c = cornerElevation(ix + 1, iz + 1, step, half);
  const d = cornerElevation(ix + 1, iz, step, half);
  return u + v <= 1
    ? a + (d - a) * u + (b - a) * v
    : c + (b - c) * (1 - u) + (d - c) * (1 - v);
}

function airportSurfaceAt(a, fieldY, x, z) {
  const L = ChillFlightLogic;
  const {u, v} = L.airportLocal(a, x, z);
  const halfW = L.RUNWAY_WIDTH / 2;
  const halfLen = L.RUNWAY_LENGTH / 2;
  // Runway slab (0.60) and painted markings (0.68), padded slightly past the kerb
  if (Math.abs(u) <= halfLen + 0.8 && Math.abs(v) <= halfW + 0.8) {
    return fieldY + 0.68;
  }
  // Concrete apron and taxiway throat (0.50)
  if (
    (Math.abs(u) <= 85.8 && v >= halfW - 0.8 && v <= halfW + 51.8) ||
    (Math.abs(u) <= 7.8 && v >= halfW - 4.8 && v <= halfW + 8.8)
  ) {
    return fieldY + 0.5;
  }
  return -Infinity;
}

function findAirportNear(x, z, margin) {
  const L = ChillFlightLogic;
  const reach = L.RUNWAY_LENGTH / 2 + 95 + margin;
  for (const a of L.AIRPORTS) {
    if (Math.abs(x - a.x) <= reach && Math.abs(z - a.z) <= reach) return a;
  }
  return null;
}

// Surface height at (x, z) at or below vehicleY (so flying under a highway
// bridge leaves the shadow on the water or valley floor below, not on the deck)
function surfaceFromTerrain(x, z, terrain, vehicleY, checkAll = false) {
  let y = Math.max(terrain, WATER_LEVEL);
  const ceiling = vehicleY + 2.0;
  if (checkAll || nearBreakwater) {
    const rocks = breakwaterTop(x, z);
    if (rocks > y && rocks <= ceiling) y = rocks;
  }
  if (checkAll) {
    const a = findAirportNear(x, z, 2);
    if (a) {
      const pave = airportSurfaceAt(a, getElevation(a.x, a.z), x, z);
      if (pave > y && pave <= ceiling) y = pave;
    }
  } else if (nearAirport) {
    const pave = airportSurfaceAt(nearAirport, nearAirportFieldY, x, z);
    if (pave > y && pave <= ceiling) y = pave;
  }
  if (
    (checkAll || nearRoad) &&
    sampleRoad(x, z, _road, vehicleY) &&
    _road.height > y &&
    _road.height <= ceiling
  ) {
    y = _road.height;
  }
  return y;
}

// Measures a newly loaded vehicle and puts its meshes on the silhouette layer
function prepareModel() {
  const model = state.airplaneModel;
  if (!model || model === measuredModel) return;
  measuredModel = model;
  const rot = planeGroup.rotation.clone();
  planeGroup.rotation.set(0, 0, 0);
  planeGroup.updateMatrixWorld(true);
  _box.setFromObject(model).getSize(_size);
  planeGroup.rotation.copy(rot);
  halfExtent = 0.5 * Math.hypot(_size.x, _size.y, _size.z) + 1.5;
  sampleMesh = null;
  planeGroup.traverse((child) => {
    if (child.isMesh) {
      child.layers.enable(LAYER);
      sampleMesh ??= child;
    }
  });
}

function setPlaneCastsShadow(on) {
  if (!sampleMesh || sampleMesh.castShadow === on) return;
  planeGroup.traverse((child) => {
    if (child.isMesh) child.castShadow = on;
  });
}

// Follows castDir from the vehicle down to the surface (iterated so it lands
// accurately on slopes, bridges and runways) and fills _hit
function traceToSurface(p, castDir) {
  let x = p.x;
  let z = p.z;
  let terrain = 0;
  let surface = 0;
  for (let i = 0; i < 3; i++) {
    terrain = sampleGroundFast(x, z);
    surface = surfaceFromTerrain(x, z, terrain, p.y, true);
    if (i === 2) break;
    const t = Math.max(0, p.y - surface) / castDir.y;
    x = p.x - castDir.x * t;
    z = p.z - castDir.z * t;
  }
  _hit.x = x;
  _hit.z = z;
  _hit.terrain = terrain;
  _hit.surface = surface;
  _hit.agl = Math.max(0, p.y - surface);
  _hit.along = _hit.agl / castDir.y;
}

// Updates the 19x19 decal mesh to follow water, terrain, runways and roads
// around (cx, cz), lifting cells that straddle convex ridges or kerbs
function updateDecalMesh(cx, cz, side, vehicleY) {
  const half = side * 0.5;
  const cell = side / GRID;

  nearAirport = findAirportNear(cx, cz, half + 4);
  nearAirportFieldY = nearAirport
    ? getElevation(nearAirport.x, nearAirport.z)
    : 0;

  nearRoad = false;
  for (let j = 0; j < 4 && !nearRoad; j++) {
    const pz = cz - half + (side * j) / 3;
    for (let i = 0; i < 4; i++) {
      const px = cx - half + (side * i) / 3;
      if (sampleRoad(px, pz, _road, vehicleY)) {
        nearRoad = true;
        break;
      }
    }
  }

  nearBreakwater = false;
  for (let j = 0; j < 3 && !nearBreakwater; j++) {
    const pz = cz - half + (side * j) / 2;
    for (let i = 0; i < 3; i++) {
      const px = cx - half + (side * i) / 2;
      if (breakwaterTop(px, pz) > WATER_LEVEL - 1) {
        nearBreakwater = true;
        break;
      }
    }
  }

  // Deep open water fast path: flat quad grid with zero elevation queries
  if (
    _hit.terrain < WATER_LEVEL - 25 &&
    !nearAirport &&
    !nearRoad &&
    !nearBreakwater
  ) {
    const wy = WATER_LEVEL + LIFT;
    let idx = 0;
    for (let j = 0; j <= GRID; j++) {
      const wz = cz - half + j * cell;
      for (let i = 0; i <= GRID; i++) {
        decalPositions[idx * 3] = cx - half + i * cell;
        decalPositions[idx * 3 + 1] = wy;
        decalPositions[idx * 3 + 2] = wz;
        decalDecks[idx] = 0;
        idx++;
      }
    }
    posAttr.needsUpdate = true;
    deckAttr.needsUpdate = true;
    return;
  }

  let idx = 0;
  for (let j = 0; j <= GRID; j++) {
    const wz = cz - half + j * cell;
    for (let i = 0; i <= GRID; i++) {
      const wx = cx - half + i * cell;
      const terrain = sampleGroundFast(wx, wz);
      const surface = surfaceFromTerrain(wx, wz, terrain, vehicleY, false);
      const base = Math.max(terrain, WATER_LEVEL);
      decalPositions[idx * 3] = wx;
      decalPositions[idx * 3 + 2] = wz;
      rawHeights[idx] = surface;
      liftHeights[idx] = 0;
      decalDecks[idx] = surface - base > DECK_DROP ? 1 : 0;
      idx++;
    }
  }

  // Lift vertices of any cell whose shared diagonal sags under a convex
  // terrain crease or runway/road kerb (skipping bridge-edge drop cells)
  for (let j = 0; j < GRID; j++) {
    const wzMid = cz - half + (j + 0.5) * cell;
    for (let i = 0; i < GRID; i++) {
      const v00 = j * STRIDE + i;
      const v10 = v00 + 1;
      const v01 = v00 + STRIDE;
      const v11 = v01 + 1;
      const dSum =
        decalDecks[v00] + decalDecks[v10] + decalDecks[v01] + decalDecks[v11];
      if (dSum > 0 && dSum < 4) continue;
      const wxMid = cx - half + (i + 0.5) * cell;
      const midTerrain = sampleGroundFast(wxMid, wzMid);
      const midY = surfaceFromTerrain(
        wxMid,
        wzMid,
        midTerrain,
        vehicleY,
        false
      );
      const diagY = 0.5 * (rawHeights[v01] + rawHeights[v10]);
      const excess = midY - diagY;
      if (excess > 0.005) {
        if (excess > liftHeights[v00]) liftHeights[v00] = excess;
        if (excess > liftHeights[v10]) liftHeights[v10] = excess;
        if (excess > liftHeights[v01]) liftHeights[v01] = excess;
        if (excess > liftHeights[v11]) liftHeights[v11] = excess;
      }
    }
  }

  for (let v = 0; v < VERT_COUNT; v++) {
    decalPositions[v * 3 + 1] = rawHeights[v] + liftHeights[v] + LIFT;
  }
  posAttr.needsUpdate = true;
  deckAttr.needsUpdate = true;
}

// Renders the plane from shadowCam into target, in silhouetteScene
function drawSilhouette() {
  const parent = planeGroup.parent;
  const index = parent ? parent.children.indexOf(planeGroup) : -1;
  const prevTarget = renderer.getRenderTarget();
  const prevShadows = renderer.shadowMap.enabled;
  const prevXr = renderer.xr.enabled;
  renderer.getClearColor(_clear);
  const prevAlpha = renderer.getClearAlpha();
  try {
    planeGroup.updateMatrixWorld();
    silhouetteScene.add(planeGroup);
    renderer.shadowMap.enabled = false;
    renderer.xr.enabled = false;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(silhouetteScene, shadowCam);
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(_clear, prevAlpha);
    renderer.xr.enabled = prevXr;
    renderer.shadowMap.enabled = prevShadows;
    // Back in its place among the scene's children
    silhouetteScene.remove(planeGroup);
    if (parent) {
      parent.children.splice(index, 0, planeGroup);
      planeGroup.parent = parent;
    }
  }
}

// For the loading screen's warm-up (hooks.warmUps): one silhouette and the
// surface decal on every preset, so their shaders compile during load
hooks.warmUps.push(async () => {
  if (!renderer) return null;
  prepareModel();
  shadowCam.position.copy(planeGroup.position).add(_yAxis);
  shadowCam.lookAt(planeGroup.position);
  shadowCam.updateMatrixWorld();
  drawSilhouette();
  const wasVisible = decal.visible;
  const {x, y, z} = planeGroup.position;
  for (let v = 0; v < VERT_COUNT; v++) {
    decalPositions[v * 3] = x + ((v % STRIDE) - GRID * 0.5);
    decalPositions[v * 3 + 1] = y - 10;
    decalPositions[v * 3 + 2] = z + (Math.floor(v / STRIDE) - GRID * 0.5);
    decalDecks[v] = 0;
  }
  posAttr.needsUpdate = true;
  deckAttr.needsUpdate = true;
  decal.visible = true;
  return () => (decal.visible = wasVisible);
});

// Call once a frame before the main render
export function updatePlaneShadow() {
  if (!renderer) return;
  prepareModel();
  if (!planeGroup.visible || !state.airplaneModel?.visible) {
    decal.visible = false;
    setPlaneCastsShadow(false);
    return;
  }

  cornerCount = 0;
  _sun.set(state.sunX, Math.max(0.15, state.sunY), state.sunZ).normalize();
  const sunLight = dirLight.intensity * _sun.y;
  const sunShare = sunLight / Math.max(1e-3, sunLight + hemiLight.intensity);
  const sunWeight = THREE.MathUtils.smoothstep(sunShare, 0.02, 0.12);
  // Under overcast skies, twilight or night, diffuse sky occlusion projects
  // straight down onto the ground directly beneath the vehicle
  _castDir.copy(_yAxis).lerp(_sun, sunWeight).normalize();

  const p = planeGroup.position;
  traceToSurface(p, _castDir);

  const worldShadows = dirLight.castShadow;
  overWater =
    _hit.surface <= WATER_LEVEL + 0.01 &&
    _hit.terrain < WATER_LEVEL + (overWater ? COAST_EXIT : COAST_ENTER);
  lowLand = !overWater && _hit.agl < (lowLand ? LOW_LAND_EXIT : LOW_LAND_ENTER);

  const useDecal = !worldShadows || overWater || lowLand;
  setPlaneCastsShadow(worldShadows && !useDecal);

  if (!useDecal || _hit.agl >= FADE_END) {
    decal.visible = false;
    return;
  }

  const fade = 1 - THREE.MathUtils.smoothstep(_hit.agl, FADE_START, FADE_END);
  const directStrength = fade * sunShare;
  const skyCover =
    0.58 + 0.42 * THREE.MathUtils.clamp(state.dayFactor ?? 1, 0, 1);
  const contactStrength =
    0.26 *
    skyCover *
    (1 - THREE.MathUtils.smoothstep(_hit.agl, 2, CONTACT_FADE_END));
  const strength = Math.max(directStrength, contactStrength);
  if (strength < 0.01) {
    decal.visible = false;
    return;
  }

  // Draw the vehicle's silhouette from _castDir
  _right.crossVectors(_yAxis, _castDir);
  if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
  _right.normalize();
  _up.crossVectors(_castDir, _right).normalize();
  shadowCam.position.copy(p).addScaledVector(_castDir, 300);
  shadowCam.up.copy(_up);
  shadowCam.lookAt(p);
  shadowCam.left = -halfExtent;
  shadowCam.right = halfExtent;
  shadowCam.top = halfExtent;
  shadowCam.bottom = -halfExtent;
  shadowCam.updateProjectionMatrix();
  shadowCam.updateMatrixWorld();

  drawSilhouette();

  const u = decalMaterial.uniforms;
  u.shadowMatrix.value.multiplyMatrices(
    shadowCam.projectionMatrix,
    shadowCam.matrixWorldInverse
  );
  const nearGroundBlur = THREE.MathUtils.lerp(
    BLUR_CONTACT,
    BLUR_BASE,
    THREE.MathUtils.smoothstep(_hit.agl, 2, LOW_LAND_EXIT)
  );
  const penumbraAlong = Math.min(_hit.along, _hit.agl * 3.5);
  const blurWorld =
    nearGroundBlur +
    penumbraAlong * BLUR_PER_METRE +
    BLUR_DIFFUSE * (1 - sunWeight);
  const blurUV = blurWorld / (2 * halfExtent);
  u.blurUV.value = blurUV;
  u.lod.value = Math.max(0, Math.log2(blurUV * SIZE) - 0.5);
  u.strength.value = strength;

  const side = (2.4 * halfExtent) / _castDir.y;
  updateDecalMesh(_hit.x, _hit.z, side, p.y);
  decal.visible = true;
}
