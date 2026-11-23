// --- TALL GRASS (?grass=0 turns it off) ---
// A field of grass blades around the camera, drawn in one call, that only
// exists when the camera is low (the buggy, taxiing, low passes). The blades
// sit on a fixed world lattice that wraps around the field as the camera
// moves, so nothing slides; each blade finds its ground height, colour and
// slope in the vertex shader from a small grid of the terrain's own vertices
// around the camera (GRID x GRID texels), interpolated across the same
// triangles the terrain mesh draws. The base of each blade takes the
// ground's colour and lighting, so the field blends into the terrain where
// it thins out.
//
// Grass grows only on green ground (not sand, snow, rock or water), and
// taller wheat on the villages' golden wheat and barley fields, both off
// roads and runways. It bends in the same wind as the trees, in gusts that
// roll across the field (GRASS_WAVE_GLSL; the terrain shows the same gusts
// as a sheen from the air), and is pushed aside by the active vehicle: the
// buggy parts it and leaves a trail that springs back, a low plane's prop
// wash flattens and flutters it.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {
  CHUNK_SIZE,
  MOUNTAIN_LEVEL,
  WATER_LEVEL,
  createMaterial,
} from './constants.js';
import {
  GRASS_ON,
  GRASS_WAVE_GLSL,
  animationUniforms,
  chunks,
  getElevation,
  terrainMaterial,
  windUniforms,
} from './terrain-geometry.js';
import {sampleGroundColor} from './terrain-chunks.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {camera, renderer} from './sky.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';
import {
  CROP_KIND,
  forEachTownStreetNear,
  sampleFarmlandCrop,
} from './terrain-gen.js';
import {ART_POST} from './art-style.js';
import {drawTrample, trample} from './tire-tracks.js';

// Field radius and blade spacing (world units, ~0.5 m) by preset; tufts of
// three blades sit on a jittered square lattice
const FIELD = {
  mid: {radius: 85, spacing: 1.5},
  high: {radius: 110, spacing: 1.35},
  ultra: {radius: 130, spacing: 1.2},
};
const BLADES_PER_TUFT = 3;
// Terrain vertices around the field centre in the ground grid
const GRID = 12;
// Road segments and push points the shader looks at
const MAX_ROADS = 12;
const MAX_PUSH = 10;
// The camera's height above the ground where the grass fades out
const FADE_LOW = 70;
const FADE_HIGH = 150;

const groundData = new Float32Array(GRID * GRID * 4);
const groundTex = new THREE.DataTexture(
  groundData,
  GRID,
  GRID,
  THREE.RGBAFormat,
  THREE.FloatType
);
groundTex.magFilter = THREE.NearestFilter;
groundTex.minFilter = THREE.NearestFilter;

// Per-vertex farmland crop weights (r: wheat/barley, g: corn, b: tulip,
// a: wildflower) on the same 12x12 terrain grid so crops never rely on
// fragile RGB heuristics
const fieldData = new Uint8Array(GRID * GRID * 4);
const fieldTex = new THREE.DataTexture(
  fieldData,
  GRID,
  GRID,
  THREE.RGBAFormat,
  THREE.UnsignedByteType
);
fieldTex.magFilter = THREE.NearestFilter;
fieldTex.minFilter = THREE.NearestFilter;

const uniforms = {
  uGrassCenter: {value: new THREE.Vector2()},
  uGrassRadius: {value: 85},
  uGrassTile: {value: 170},
  uGrassFade: {value: 0},
  uGround: {value: groundTex},
  uField: {value: fieldTex},
  uGroundOrigin: {value: new THREE.Vector2()},
  uGroundStep: {value: 50},
  uRoads: {value: Array.from({length: MAX_ROADS}, () => new THREE.Vector4())},
  uRoadWidth: {value: new Float32Array(MAX_ROADS)},
  // Nearest airport: x, z, cos and sin of its runway's angle (w 0: none)
  uAirport: {value: new THREE.Vector4(0, 0, 1, 0)},
  uAirportOn: {value: 0},
  uPush: {value: Array.from({length: MAX_PUSH}, () => new THREE.Vector4())},
  // Where tyre tracks have flattened it (tire-tracks.js): the map, its
  // centre and span (0: none)
  uTrample: {value: trample.target.texture},
  uTrampleCenter: {value: trample.center},
  uTrampleSpan: {value: 0},
};

const VERTEX_PARS = `
  attribute vec3 aTuft;
  uniform float uTime;
  uniform float uWindStrength;
  uniform vec2 uGrassCenter;
  uniform float uGrassRadius;
  uniform float uGrassTile;
  uniform float uGrassFade;
  uniform sampler2D uGround;
  uniform sampler2D uField;
  uniform vec2 uGroundOrigin;
  uniform float uGroundStep;
  uniform vec4 uRoads[${MAX_ROADS}];
  uniform float uRoadWidth[${MAX_ROADS}];
  uniform vec4 uAirport;
  uniform float uAirportOn;
  uniform vec4 uPush[${MAX_PUSH}];
  uniform sampler2D uTrample;
  uniform vec2 uTrampleCenter;
  uniform float uTrampleSpan;
  ${GRASS_WAVE_GLSL}
  float grassSegDist(vec2 p, vec4 s) {
    vec2 a = s.xy, ab = s.zw - s.xy;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    return length(p - a - ab * t);
  }
`;

// Sets bladePos (world), bladeNormal (the ground's) and vColor
const VERTEX_MAIN = `
  // Where this tuft is: its lattice point, wrapped into the tile around the
  // field centre, so it stays put in the world as the field moves
  vec2 tileMin = uGrassCenter - 0.5 * uGrassTile;
  vec2 tuftWxz = tileMin + mod(aTuft.xy - tileMin, uGrassTile);
  float rnd = aTuft.z;
  float rTuft = fract(rnd * 17.31);
  float tuftYaw = rnd * 6.2832;
  float bladeIdx = position.z;
  float yaw = tuftYaw + bladeIdx * 2.1;
  float r2 = fract(rnd * 17.31 + bladeIdx * 0.37);

  // Sample farmland crop weights at the tuft's own position so all three
  // blades of a corn plant, tulip or wildflower agree on what plant they form
  vec2 gf = (tuftWxz - uGroundOrigin) / uGroundStep;
  vec2 cfF = floor(gf);
  vec2 ff = gf - cfF;
  ivec2 cfi = clamp(ivec2(cfF), ivec2(0), ivec2(${GRID - 2}));
  vec4 fA = texelFetch(uField, cfi, 0);
  vec4 fB = texelFetch(uField, cfi + ivec2(0, 1), 0);
  vec4 fC = texelFetch(uField, cfi + ivec2(1, 1), 0);
  vec4 fD = texelFetch(uField, cfi + ivec2(1, 0), 0);
  vec4 cropVec = (ff.x + ff.y <= 1.0)
    ? fA + (fD - fA) * ff.x + (fB - fA) * ff.y
    : fC + (fB - fC) * (1.0 - ff.x) + (fD - fC) * (1.0 - ff.y);
  float cWheat = cropVec.r;
  float cCorn = cropVec.g;
  float cTulip = cropVec.b;
  float cWild = step(cTulip, 0.05) * clamp(cropVec.a * 2.55, 0.0, 1.0);

  // Pick tulip variety from the cell corner with strongest tulip weight
  float bestT = fA.b;
  float bestA = fA.a;
  if (fB.b > bestT + 0.02 || (abs(fB.b - bestT) <= 0.02 && ff.y > 0.5)) {
    bestT = fB.b;
    bestA = fB.a;
  }
  if (fD.b > bestT + 0.02 || (abs(fD.b - bestT) <= 0.02 && ff.x > 0.5 && ff.y <= 0.5)) {
    bestT = fD.b;
    bestA = fD.a;
  }
  if (fC.b > bestT + 0.02 || (abs(fC.b - bestT) <= 0.02 && ff.x > 0.5 && ff.y > 0.5)) {
    bestT = fC.b;
    bestA = fC.a;
  }
  float tulipKind = clamp(floor((bestA * 255.0 - 128.0) / 32.0 + 0.5), 0.0, 3.0);

  float isCorn = step(0.32, cCorn) * step(cWheat, cCorn) * step(cTulip, cCorn);
  float isTulip = (1.0 - isCorn) * step(0.32, cTulip) * step(cWheat, cTulip);
  float hasWildBloom = (1.0 - isCorn) * (1.0 - isTulip) * step(cWheat, 0.32)
                     * step(fract(rnd * 13.37), cWild * 0.42);
  float sharedStem = max(max(isCorn, isTulip), hasWildBloom * step(bladeIdx, 1.5));

  vec2 tuftJitter = vec2(cos(tuftYaw * 1.7 + 1.0), sin(tuftYaw * 1.7 + 1.0)) * (0.2 + 0.35 * rTuft);
  vec2 bladeJitter = vec2(cos(yaw * 1.7 + 1.0), sin(yaw * 1.7 + 1.0)) * (0.25 + 0.45 * r2);
  vec2 wxz = tuftWxz + mix(bladeJitter, tuftJitter, sharedStem);

  // The ground under it, on the terrain mesh's triangles (abd and bcd, split
  // along b-d as PlaneGeometry does)
  vec2 g = (wxz - uGroundOrigin) / uGroundStep;
  vec2 cellF = floor(g);
  vec2 f = g - cellF;
  ivec2 ci = clamp(ivec2(cellF), ivec2(0), ivec2(${GRID - 2}));
  vec4 gA = texelFetch(uGround, ci, 0);
  vec4 gB = texelFetch(uGround, ci + ivec2(0, 1), 0);
  vec4 gC = texelFetch(uGround, ci + ivec2(1, 1), 0);
  vec4 gD = texelFetch(uGround, ci + ivec2(1, 0), 0);
  vec4 ground;
  vec2 slope;
  if (f.x + f.y <= 1.0) {
    ground = gA + (gD - gA) * f.x + (gB - gA) * f.y;
    slope = vec2(gD.x - gA.x, gB.x - gA.x) / uGroundStep;
  } else {
    ground = gC + (gB - gC) * (1.0 - f.x) + (gD - gC) * (1.0 - f.y);
    slope = vec2(gC.x - gB.x, gC.x - gD.x) / uGroundStep;
  }
  vec3 groundN = normalize(vec3(-slope.x, 1.0, -slope.y));
  vec3 groundCol = ground.yzw;
  float loaded = step(0.01, groundCol.r + groundCol.g + groundCol.b);

  // Grass on green ground, wheat on golden wheat and barley fields, plus
  // explicit farmland corn, tulip and wildflower weights from uField
  float gOverR = groundCol.g / max(groundCol.r, 1e-3);
  float rgbWheat = smoothstep(0.22, 0.32, min(groundCol.r, groundCol.g) - groundCol.b)
                 * smoothstep(0.75, 0.82, gOverR) * smoothstep(1.16, 1.1, gOverR);
  float wheat = max(cWheat, rgbWheat * (1.0 - cTulip));
  float grass = smoothstep(0.015, 0.06, groundCol.g - max(groundCol.r, groundCol.b))
              * smoothstep(0.08, 0.14, groundCol.g - groundCol.b)
              * (1.0 - wheat) * (1.0 - isCorn) * (1.0 - isTulip);
  float isWheat = (1.0 - isCorn) * (1.0 - isTulip) * step(grass, wheat) * step(0.05, wheat);

  float density = loaded;
  density *= step(${(WATER_LEVEL + 1.5).toFixed(1)}, ground.x);
  density *= smoothstep(0.62, 0.8, groundN.y);
  for (int i = 0; i < ${MAX_ROADS}; i++) {
    float w = uRoadWidth[i];
    if (w > 0.0) density *= smoothstep(w, w + 4.0, grassSegDist(wxz, uRoads[i]));
  }
  if (uAirportOn > 0.5) {
    vec2 d = wxz - uAirport.xy;
    float u = d.x * uAirport.z + d.y * uAirport.w;
    float v = -d.x * uAirport.w + d.y * uAirport.z;
    // The runway's strip, then the apron behind it (to its back edge at
    // v = 71, plus a blade's lean) where the tower and hangar stand
    float strip = step(abs(u), 430.0) * step(-30.0, v) * step(v, 28.0);
    float apron = step(abs(u), 90.0) * step(-30.0, v) * step(v, 75.0);
    density *= 1.0 - max(strip, apron);
  }
  float dC = length(wxz - uGrassCenter);
  float edge = smoothstep(uGrassRadius, uGrassRadius * 0.4, dC);
  float cover = max(max(grass, wheat), max(cCorn, max(cTulip, cWild)));
  float keepHash = mix(fract(rnd * 7.13 + bladeIdx * 0.29), fract(rnd * 7.13), sharedStem);
  float keep = step(keepHash, cover * density * edge);

  // Heights: grass ~1.4-2.8, tulips ~2.1-2.6, wheat ~3.0-3.8, corn ~5.2-6.5
  float fullH = 1.4 + 1.4 * r2;
  if (hasWildBloom > 0.5 && bladeIdx < 1.5) fullH = 1.9 + 1.0 * rTuft;
  if (isTulip > 0.5) fullH = 2.05 + 0.55 * rTuft;
  if (isWheat > 0.5) fullH = 3.0 + 0.8 * r2;
  if (isCorn > 0.5) fullH = 5.2 + 1.3 * rTuft;
  float bladeH = keep * uGrassFade * fullH * mix(0.35, 1.0, edge);

  // Lying low along tyre tracks, so the ruts show through
  float trampled = 0.0;
  if (uTrampleSpan > 0.0) {
    vec2 tuv = (wxz - uTrampleCenter) / uTrampleSpan;
    tuv = vec2(tuv.x + 0.5, 0.5 - tuv.y);
    trampled = textureLod(uTrample, tuv, 0.0).r;
    bladeH *= 1.0 - 0.9 * trampled;
  }

  // Bend: the wind's gusts, a little flutter, the plant's own lean, and
  // anything pushing it aside
  vec2 wd = GRASS_WIND_DIR;
  float gust = grassGust(wxz, uTime);
  float gustShare = isWheat > 0.5 ? (0.1 + 0.85 * gust)
                  : isCorn > 0.5 ? (0.08 + 0.42 * gust)
                  : isTulip > 0.5 ? (0.12 + 0.45 * gust)
                  : (0.18 + 0.6 * gust);
  float flutterShare = (isWheat > 0.5 || isCorn > 0.5) ? 0.025 : 0.065;
  float leanYaw = sharedStem > 0.5 ? tuftYaw : yaw;
  float leanAmt = (isWheat > 0.5 || isCorn > 0.5 || isTulip > 0.5) ? 0.045 : 0.12;
  vec2 bend = wd * gustShare * uWindStrength;
  bend += vec2(-wd.y, wd.x) * sin(uTime * 3.1 + rnd * 40.0) * flutterShare * uWindStrength;
  bend += vec2(cos(leanYaw), sin(leanYaw)) * leanAmt;
  float pushed = 0.0;
  for (int i = 0; i < ${MAX_PUSH}; i++) {
    vec4 p = uPush[i];
    if (p.w <= 0.0) continue;
    vec2 dv = wxz - p.xy;
    float d = length(dv);
    float s = p.w * (1.0 - smoothstep(p.z * 0.35, p.z, d));
    bend += dv / max(d, 0.2) * s;
    pushed += s;
  }
  pushed = min(pushed, 1.0);
  bend += vec2(-wd.y, wd.x) * sin(uTime * 17.0 + rnd * 23.0) * 0.18 * pushed;
  float bendLen = length(bend);
  vec2 bendDir = bend / max(bendLen, 1e-4);
  float bendAngle = min(bendLen, 1.45);
  bendAngle = mix(bendAngle, 1.35, trampled);

  // Blade geometry & colour per vegetation type (3 blades x 5 vertices)
  float rawY = position.y;
  float t = rawY;
  float width = 0.42 * (1.0 - 0.9 * t);
  float orientYaw = yaw;
  float leafOut = 0.0;

  vec3 tipCol = groundCol * mix(vec3(1.18, 1.14, 0.82), vec3(1.14, 1.08, 0.8), isWheat);
  vec3 bladeCol = mix(groundCol * mix(0.78, 0.68, isWheat), tipCol, rawY);

  if (isWheat > 0.5) {
    t = rawY > 0.25 && rawY < 0.75 ? 0.7 : rawY;
    width = rawY < 0.01 ? 0.1 : (rawY < 0.99 ? 0.34 : 0.0);
  } else if (isCorn > 0.5) {
    if (bladeIdx < 0.5) {
      // Feathery golden-straw tassel plume crowning the top of the maize stalk
      t = 0.76 + rawY * 0.24;
      width = rawY < 0.01 ? 0.08 : (rawY < 0.99 ? 0.21 : 0.0);
      orientYaw = tuftYaw + 0.5;
      bladeCol = mix(vec3(0.80, 0.69, 0.30), vec3(0.95, 0.87, 0.50), rawY);
    } else if (bladeIdx < 1.5) {
      // Broad arching deep-green maize leaf curving out from mid-stalk
      t = 0.16 + rawY * 0.52;
      width = rawY < 0.01 ? 0.16 : (rawY < 0.99 ? 0.46 : 0.0);
      orientYaw = tuftYaw + 1.5708;
      float leafSide = rTuft < 0.5 ? 1.0 : -1.0;
      leafOut = leafSide * 1.35 * rawY * (1.3 - 0.5 * rawY);
      bladeCol = mix(vec3(0.18, 0.42, 0.13), vec3(0.32, 0.60, 0.20), rawY);
    } else {
      // Slender upright maize stalk rising into the tassel base
      t = rawY * 0.82;
      width = rawY < 0.01 ? 0.18 : (rawY < 0.99 ? 0.13 : 0.07);
      orientYaw = tuftYaw;
      bladeCol = mix(vec3(0.17, 0.39, 0.12), vec3(0.28, 0.55, 0.18), rawY);
    }
  } else if (isTulip > 0.5) {
    if (bladeIdx > 1.5) {
      // Broad waxy glaucous-green basal leaf & stem rising into the cup
      t = rawY * 0.68;
      width = rawY < 0.01 ? 0.52 : (rawY < 0.99 ? 0.18 : 0.08);
      orientYaw = tuftYaw + 0.78;
      bladeCol = mix(vec3(0.17, 0.37, 0.16), vec3(0.28, 0.54, 0.24), rawY);
    } else {
      // Two 90-degree crossed petal quads forming a plump 3D goblet cup
      t = 0.60 + rawY * 0.40;
      width = rawY < 0.01 ? 0.16 : (rawY < 0.99 ? 0.62 : 0.0);
      orientYaw = tuftYaw + bladeIdx * 1.5708;
      vec3 petal = tulipKind < 0.5 ? vec3(0.91, 0.23, 0.23)
                 : tulipKind < 1.5 ? vec3(0.97, 0.80, 0.20)
                 : tulipKind < 2.5 ? vec3(0.93, 0.44, 0.65)
                 : vec3(0.58, 0.37, 0.87);
      bladeCol = mix(petal * 0.74, mix(petal * 1.15, vec3(1.0, 0.98, 0.92), 0.18), rawY);
    }
  } else if (hasWildBloom > 0.5 && bladeIdx < 1.5) {
    if (bladeIdx < 0.5) {
      // Wildflower blossom head perched atop blade 1's stem
      t = 0.70 + rawY * 0.30;
      width = rawY < 0.01 ? 0.12 : (rawY < 0.99 ? 0.44 : 0.0);
      orientYaw = tuftYaw + 0.6;
      float bp = fract(rnd * 31.7);
      vec3 bTop = bp < 0.30 ? vec3(0.97, 0.81, 0.22)
                : bp < 0.58 ? vec3(0.97, 0.96, 0.90)
                : bp < 0.80 ? vec3(0.36, 0.56, 0.94)
                : vec3(0.93, 0.42, 0.50);
      vec3 bBase = (bp >= 0.30 && bp < 0.58) ? vec3(0.92, 0.76, 0.24) : bTop * 0.78;
      bladeCol = mix(bBase, bTop, rawY);
    } else {
      // Green stem supporting the blossom head
      t = rawY * 0.75;
      width = 0.14 * (1.0 - 0.45 * rawY);
      orientYaw = tuftYaw;
      bladeCol = mix(groundCol * 0.75, groundCol * 1.08, rawY);
    }
  }

  float a = bendAngle * t;
  vec2 side = vec2(cos(orientYaw), sin(orientYaw));
  vec2 outPerp = vec2(-side.y, side.x);
  vec3 bladePos = vec3(wxz.x, ground.x, wxz.y);
  bladePos.xz += side * position.x * width * step(0.001, bladeH);
  bladePos.xz += outPerp * leafOut * step(0.001, bladeH);
  bladePos.xz += bendDir * bladeH * t * sin(a) * 0.9;
  bladePos.y += bladeH * t * cos(a) - 0.15;
  vec3 bladeNormal = groundN;

  float sheenAmt = isWheat > 0.5 ? 0.28 : (isTulip > 0.5 ? 0.10 : 0.16);
  bladeCol *= 1.0 + (sheenAmt * gust + 0.3 * pushed) * t;
  // Toward the field's edge, the ground's own colour, so it ends unseen
  bladeCol = mix(groundCol, bladeCol, edge);
`;

let mesh = null;
let field = null;
const _fwd = new THREE.Vector3();
const _cam = new THREE.Vector3();
const _color = new THREE.Color();
let lastOrigin = '';
let lastComplete = false;
let framesSinceGrid = 0;

function buildMesh(preset) {
  field = FIELD[preset] || FIELD.mid;
  const tile = field.radius * 2;
  const n = Math.floor(tile / field.spacing);
  const count = n * n;
  // Tuft lattice, jittered, with a random number per tuft
  let seed = 12345;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const tufts = new Float32Array(count * 3);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = (i * n + j) * 3;
      tufts[k] = (i + rand()) * field.spacing;
      tufts[k + 1] = (j + rand()) * field.spacing;
      tufts[k + 2] = rand();
    }
  }
  // One tuft: three blades of five vertices (three triangles), each blade's
  // index in z
  const pos = [];
  const idx = [];
  for (let b = 0; b < BLADES_PER_TUFT; b++) {
    const base = pos.length / 3;
    pos.push(-0.5, 0, b, 0.5, 0, b, -0.5, 0.5, b, 0.5, 0.5, b, 0, 1, b);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    idx.push(base + 2, base + 3, base + 4);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(new Float32Array(pos), 3)
  );
  geometry.setIndex(idx);
  // Unused (the shader gives each blade the ground's normal), but without a
  // normal attribute three.js shades the mesh flat
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3)
  );
  geometry.setAttribute('aTuft', new THREE.InstancedBufferAttribute(tufts, 3));
  geometry.instanceCount = count;

  const material = createMaterial({
    vertexColors: true,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  material.flatShading = false;
  material.onBeforeCompile = (shader, renderer) => {
    // The terrain's own lighting, fog and colour treatment (snow exposure,
    // the anime style's painted greens), so the grass matches the ground
    terrainMaterial.onBeforeCompile(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.uTime = animationUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    const hasColor = shader.vertexShader.includes('#include <color_vertex>');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>\n${VERTEX_MAIN}\nvColor.rgb = bladeCol;`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `${hasColor ? '' : VERTEX_MAIN}\nvec3 objectNormal = bladeNormal;`
      )
      .replace('#include <begin_vertex>', `vec3 transformed = bladePos;`);
    // Both faces of a blade take the ground's normal (three.js would flip
    // it on the back face, turning it dark)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
       normal = normalize(vNormal);`
    );
    // With the art style's post pass, alpha 0 (after opaque_fragment sets it
    // to 1) tells the outline pass to leave the blades uninked. Only there:
    // without the pass the blades draw straight to the canvas, and Chrome on
    // macOS can composite its alpha even though the context has none, which
    // showed the blades as the page's black background.
    if (ART_POST) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
       gl_FragColor.a = 0.0;`
      );
    }
  };
  material.customProgramCacheKey = () => 'tallGrass';

  mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.visible = false;
  mesh.name = 'tallGrass';
  uniforms.uGrassRadius.value = field.radius;
  uniforms.uGrassTile.value = n * field.spacing;
  scene.add(mesh);
}

const _cropSample = {wheat: 0, corn: 0, tulip: 0, wildflower: 0, crop: -1};

// The terrain vertices around the field centre: height, colour and crop type
function updateGround(cx, cz) {
  const step = CHUNK_SIZE / state.SEGMENTS;
  const half = CHUNK_SIZE / 2;
  const ix0 = Math.floor((cx + half) / step) - GRID / 2 + 1;
  const iz0 = Math.floor((cz + half) / step) - GRID / 2 + 1;
  const key = `${ix0},${iz0},${step}`;
  framesSinceGrid++;
  // Chunk colours can arrive after the grid was filled, so keep retrying while
  // any overlapped chunk is still streaming, then refresh periodically
  if (key === lastOrigin && lastComplete && framesSinceGrid < 30) return false;
  lastOrigin = key;
  framesSinceGrid = 0;
  let chunksReady = true;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const x = (ix0 + i) * step - half;
      const z = (iz0 + j) * step - half;
      if (
        !chunks.has(
          `${Math.round(x / CHUNK_SIZE)},${Math.round(z / CHUNK_SIZE)}`
        )
      ) {
        chunksReady = false;
      }
      const k = (j * GRID + i) * 4;
      groundData[k] = getElevation(x, z);
      if (sampleGroundColor(x, z, _color)) {
        groundData[k + 1] = _color.r;
        groundData[k + 2] = _color.g;
        groundData[k + 3] = _color.b;
      } else {
        groundData[k + 1] = groundData[k + 2] = groundData[k + 3] = 0;
      }
    }
  }
  lastComplete = chunksReady;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const k = (j * GRID + i) * 4;
      const loaded =
        groundData[k + 1] + groundData[k + 2] + groundData[k + 3] > 0.01;
      if (!loaded) {
        fieldData[k] =
          fieldData[k + 1] =
          fieldData[k + 2] =
          fieldData[k + 3] =
            0;
        continue;
      }
      const x = (ix0 + i) * step - half;
      const z = (iz0 + j) * step - half;
      const h = groundData[k];
      const hL = i > 0 ? groundData[k - 4] : h;
      const hR = i < GRID - 1 ? groundData[k + 4] : h;
      const hU = j > 0 ? groundData[k - GRID * 4] : h;
      const hD = j < GRID - 1 ? groundData[k + GRID * 4] : h;
      const dx = i > 0 && i < GRID - 1 ? 2 * step : step;
      const dz = j > 0 && j < GRID - 1 ? 2 * step : step;
      const slopeFactor = Math.min(
        1,
        Math.hypot((hR - hL) / dx, (hD - hU) / dz) * 0.5
      );
      sampleFarmlandCrop(
        x,
        z,
        h,
        slopeFactor,
        WATER_LEVEL,
        simplex,
        _cropSample
      );
      fieldData[k] = Math.round(_cropSample.wheat * 255);
      fieldData[k + 1] = Math.round(_cropSample.corn * 255);
      fieldData[k + 2] = Math.round(_cropSample.tulip * 255);
      fieldData[k + 3] =
        _cropSample.tulip > 0
          ? 128 +
            Math.max(0, Math.min(3, _cropSample.crop - CROP_KIND.TULIP_RED)) *
              32
          : Math.round(_cropSample.wildflower * 100);
    }
  }
  groundTex.needsUpdate = true;
  fieldTex.needsUpdate = true;
  uniforms.uGroundOrigin.value.set(ix0 * step - half, iz0 * step - half);
  uniforms.uGroundStep.value = step;
  return true;
}

// Roads, access roads and the runway near the field, so no grass grows on them
const _roadPick = [];
const _elevParams = {WATER_LEVEL, MOUNTAIN_LEVEL};
function updateRoads(cx, cz) {
  const reach = field.radius + 80;
  _roadPick.length = 0;
  const ccx = Math.round(cx / CHUNK_SIZE);
  const ccz = Math.round(cz / CHUNK_SIZE);
  const consider = (x0, z0, x1, z1, hw) => {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.min(
      1,
      Math.max(0, ((cx - x0) * dx + (cz - z0) * dz) / len2)
    );
    const d = Math.hypot(cx - x0 - dx * t, cz - z0 - dz * t) - hw;
    if (d < reach) _roadPick.push({d, x0, z0, x1, z1, hw});
  };
  for (let i = ccx - 1; i <= ccx + 1; i++) {
    for (let j = ccz - 1; j <= ccz + 1; j++) {
      const ud = chunks.get(`${i},${j}`)?.userData;
      const segs = ud?.roadSegments;
      if (segs) {
        for (const s of segs) {
          consider(
            s.x0,
            s.z0,
            s.x1,
            s.z1,
            (s.halfWidth ?? ChillFlightLogic.ROAD_WIDTH) + 2
          );
        }
      }
      const wfSegs = ud?.waterfallStreamSegments;
      if (wfSegs) {
        for (const s of wfSegs) {
          consider(s.x0, s.z0, s.x1, s.z1, Math.max(1.5, s.hw - 2.5));
        }
      }
    }
  }
  const roads = ChillFlightLogic.ACCESS_ROADS;
  for (let i = 0; i < roads.length; i++) {
    const r = roads[i];
    if (Math.abs(cz - r.z) > reach + 20) continue;
    if (cx < r.minX - reach || cx > r.maxX + reach) continue;
    const ends = ChillFlightLogic.accessRoadEnds(i, simplex, {
      WATER_LEVEL,
      MOUNTAIN_LEVEL,
    });
    if (!ends?.built) continue;
    consider(r.minX, r.z, r.maxX, r.z, ChillFlightLogic.ACCESS_ROAD_WIDTH + 2);
  }
  // Town streets, between the blocks of houses
  forEachTownStreetNear(cx, cz, reach, _elevParams, (x0, z0, x1, z1, hw) =>
    consider(x0, z0, x1, z1, hw + 2)
  );
  _roadPick.sort((a, b) => a.d - b.d);
  for (let i = 0; i < MAX_ROADS; i++) {
    const r = _roadPick[i];
    uniforms.uRoadWidth.value[i] = r ? r.hw : 0;
    if (r) uniforms.uRoads.value[i].set(r.x0, r.z0, r.x1, r.z1);
  }

  uniforms.uAirportOn.value = 0;
  for (const ap of ChillFlightLogic.AIRPORTS) {
    if (Math.hypot(ap.x - cx, ap.z - cz) < 700) {
      uniforms.uAirport.value.set(
        ap.x,
        ap.z,
        Math.cos(ap.angle),
        Math.sin(ap.angle)
      );
      uniforms.uAirportOn.value = 1;
      break;
    }
  }
}

// The active vehicle pushing grass aside: where it is now, and a trail of
// where it was that fades as the grass springs back
const TRAIL_EVERY = 0.12;
const trail = []; // {x, z, r, s, age}
let trailTimer = 0;
const _lastPos = new THREE.Vector3();
let hasLast = false;

function updatePush(delta) {
  const p = planeGroup.position;
  const ground = getElevation(p.x, p.z);
  const agl = p.y - Math.max(ground, WATER_LEVEL);
  const speed = hasLast && delta > 0 ? _lastPos.distanceTo(p) / delta : 0;
  hasLast = true;
  _lastPos.copy(p);
  const buggy = activePlaneType === 'buggy';
  let r = 0;
  let s = 0;
  let x = p.x;
  let z = p.z;
  if (buggy) {
    // Parts the grass round the body and wheels
    if (agl < 6) {
      r = 6;
      s = 1.6 * (1 - agl / 6);
    }
  } else if (agl < 55) {
    // Prop wash and downwash: wider and weaker with height, behind the plane
    // when it's low and fast
    _fwd.set(0, 0, -1).applyQuaternion(planeGroup.quaternion);
    const back = Math.min(12, agl * 0.3);
    x -= _fwd.x * back;
    z -= _fwd.z * back;
    r = 10 + agl * 0.6;
    s = 1.5 * (1 - agl / 55) * Math.min(1, 0.3 + speed / 60);
  }

  trailTimer += delta;
  for (const t of trail) t.age += delta;
  const life = buggy ? 1.8 : 1.2;
  while (trail.length && trail[0].age > life) trail.shift();
  if (s > 0 && trailTimer > TRAIL_EVERY && speed > 2) {
    trailTimer = 0;
    trail.push({x, z, r: buggy ? r * 0.8 : r * 1.2, s, age: 0});
    if (trail.length > MAX_PUSH - 1) trail.shift();
  }

  const push = uniforms.uPush.value;
  push[0].set(x, z, r, s);
  for (let i = 1; i < MAX_PUSH; i++) {
    const t = trail[trail.length - i];
    if (!t) {
      push[i].w = 0;
      continue;
    }
    const k = 1 - t.age / life;
    push[i].set(t.x, t.z, t.r, t.s * k * k);
  }
}

export function updateGrass(delta) {
  if (!GRASS_ON) return;
  const preset = state.graphicsPreset;
  if (preset === 'low' || state.isVRPresenting) {
    if (mesh) mesh.visible = false;
    return;
  }
  if (!mesh || FIELD[preset] !== field) {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    buildMesh(preset);
  }

  const cam = camera.getWorldPosition(_cam);
  const camAgl = cam.y - Math.max(getElevation(cam.x, cam.z), WATER_LEVEL);
  const snow = ChillFlightLogic.snowFactorAt(
    cam.z,
    ChillFlightLogic.snowNoiseShift(cam.x, cam.z, simplex)
  );
  const fade =
    (1 - THREE.MathUtils.smoothstep(camAgl, FADE_LOW, FADE_HIGH)) *
    (1 - THREE.MathUtils.smoothstep(snow, 0.05, 0.25));
  uniforms.uGrassFade.value = fade;
  mesh.visible = fade > 0;
  if (!mesh.visible) {
    // (Nothing to part up high: start afresh on the way down)
    trail.length = 0;
    hasLast = false;
    return;
  }
  updatePush(delta);

  // The field reaches further ahead of the camera than behind it
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
  const cx = cam.x + _fwd.x * field.radius * 0.45;
  const cz = cam.z + _fwd.z * field.radius * 0.45;
  uniforms.uGrassCenter.value.set(cx, cz);
  // Tyre tracks flattening it, in a map just wider than the field
  drawTrample(renderer, cx, cz, field.radius * 2 + 16);
  uniforms.uTrampleSpan.value = trample.live ? trample.span : 0;
  if (updateGround(cx, cz)) updateRoads(cx, cz);
}
