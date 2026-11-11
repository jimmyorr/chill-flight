// --- FIREFLIES ---
// Fireflies drifting over green ground at dusk and through the night, round
// the camera when it's low (the buggy, taxiing, low passes). Each one sits at
// a spot the CPU picks once, on green ground in loose swarms; the vertex
// shader does the rest: a slow wander, a blink every few seconds, fading in
// after it's placed and out toward the edge of the field, and shying away
// from the active vehicle. Drawn as one batch of additive points.
//
// Spots that fall too far behind the camera are moved ahead of it, a few
// each frame, so the CPU never touches most of them.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {MOUNTAIN_LEVEL, WATER_LEVEL} from './constants.js';
import {animationUniforms, getElevation} from './terrain-geometry.js';
import {sampleGroundColor} from './terrain-chunks.js';
import {isOnTownStreet} from './terrain-gen.js';
import {planeGroup} from './airplane.js';
import {camera, renderer} from './sky.js';
import {precipitation} from './weather-manager.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';

// How many by graphics preset, and the field's radius (world units, ~0.5 m)
const COUNT = {low: 55, mid: 90, high: 120, ultra: 150};
const RADIUS = 110;
// Spots looked at (moved if they've fallen behind) per frame
const CHECKS_PER_FRAME = 12;
// The camera's height above the ground where they fade out
const FADE_LOW = 35;
const FADE_HIGH = 90;
// How far past a road's paved edge a spot must sit, so its wander stays off
const ROAD_CLEAR = 10;
// How close the active vehicle gets before a firefly drifts aside, and how fast
const PUSH_RADIUS = 18;
const PUSH_OUTER2 = (PUSH_RADIUS + 7) * (PUSH_RADIUS + 7);
const PUSH_SPEED = 22;
const _elevParams = {WATER_LEVEL, MOUNTAIN_LEVEL};

const uniforms = {
  uTime: animationUniforms.uTime,
  uAmount: {value: 0},
  uCenter: {value: new THREE.Vector3()},
  uRadius: {value: RADIUS},
  uScale: {value: 1},
};

const VERTEX = `
  attribute vec4 aSpot; // x, ground y, z, random
  attribute float aBorn; // time it was put there
  uniform float uTime;
  uniform float uAmount;
  uniform vec3 uCenter;
  uniform float uRadius;
  uniform float uScale;
  varying float vGlow;

  void main() {
    float r = aSpot.w;
    float r2 = fract(r * 13.7);
    float r3 = fract(r * 29.3);
    float t = uTime;
    // A slow, lazy wander round its spot, bobbing up and down
    vec3 p = vec3(aSpot.x, aSpot.y, aSpot.z);
    p.x += sin(t * (0.21 + 0.12 * r2) + r * 40.0) * 5.0
         + sin(t * (0.53 + 0.2 * r3) + r * 11.0) * 1.5;
    p.z += cos(t * (0.17 + 0.11 * r3) + r * 23.0) * 5.0
         + cos(t * (0.47 + 0.2 * r2) + r * 7.0) * 1.5;
    p.y += 2.5 + 5.0 * r3 + sin(t * (0.35 + 0.2 * r) + r * 17.0) * 1.2;

    // A blink every few seconds: a quick rise, a slower fade, then dark
    float period = 3.0 + 3.8 * r2;
    float ph = fract(t / period + r * 7.31);
    float flash = smoothstep(0.0, 0.06, ph) * (1.0 - smoothstep(0.1, 0.42, ph));
    // A few of them glow faintly between blinks
    flash = max(flash, 0.12 * step(0.8, r3));

    // Fade in after being placed, out toward the field's edge, and only
    // as many as the hour and weather call for
    float born = smoothstep(0.0, 2.5, t - aBorn);
    float edge = 1.0 - smoothstep(uRadius * 0.7, uRadius, length(aSpot.xz - uCenter.xz));
    float shown = step(r, uAmount);
    vGlow = flash * born * edge * shown;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Close to a metre of halo across, never under a few pixels
    gl_PointSize = vGlow > 0.003 ? max(2.5, 1.8 * uScale / -mv.z) : 0.0;
  }
`;

const FRAGMENT = `
  varying float vGlow;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d2 = dot(c, c) * 4.0;
    float core = exp(-d2 * 18.0);
    float halo = exp(-d2 * 3.5) * 0.45;
    float a = (core + halo) * vGlow;
    if (a < 0.004) discard;
    // Warm yellow-green, whiter at the centre
    vec3 col = mix(vec3(0.62, 0.95, 0.22), vec3(1.0, 1.0, 0.75), core);
    gl_FragColor = vec4(col * a, 1.0);
  }
`;

let points = null;
let count = 0;
let spots = null;
let born = null;
let nextCheck = 0;
let lastTime = 0;
const _cam = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _color = new THREE.Color();

// A pseudo-random generator with a fixed seed, so nothing else's randomness
// moves
let seed = 4242;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}

// Whether a firefly can live at (x, z): green ground above the water, off the
// roads, in a loose swarm, outside the alien lands. Returns the ground height
// or null.
function groundAt(x, z) {
  if (!sampleGroundColor(x, z, _color)) return null;
  const swamp = ChillFlightLogic.swampFactorAt(x, z, simplex);
  if (swamp <= 0.25 && _color.g - Math.max(_color.r, _color.b) < 0.015) {
    return null;
  }
  const y = getElevation(x, z);
  if (y < (swamp > 0.25 ? WATER_LEVEL - 2.8 : WATER_LEVEL + 1.5)) return null;
  // Swarms tens of metres across, with a few strays between them (more in the swamp)
  const swarm = simplex.noise2D(x * 0.006 + 31.7, z * 0.006 - 12.3);
  if (swarm < -0.15 && rand() > (swamp > 0.25 ? 0.5 : 0.15)) return null;
  if (
    ChillFlightLogic.highwayDistance(x, z) <
      ChillFlightLogic.ROAD_WIDTH + ROAD_CLEAR ||
    ChillFlightLogic.isOnAccessRoad(x, z, ROAD_CLEAR, simplex, _elevParams) ||
    ChillFlightLogic.isOnSlipRoad(x, z, ROAD_CLEAR, simplex, _elevParams) ||
    isOnTownStreet(x, z, ROAD_CLEAR, _elevParams)
  ) {
    return null;
  }
  if (ChillFlightLogic.alienAt(x, z, simplex) > 0.3) return null;
  return Math.max(y, WATER_LEVEL);
}

// Puts firefly i at a spot in the field; if that spot is on a road, water or
// between swarms it stays dark there until the field moves past it, so swarms
// and roads thin the field out instead of crowding into the nearest grass
function place(i, cx, cz, now) {
  const k = i * 4;
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * RADIUS;
  const x = cx + Math.cos(a) * d;
  const z = cz + Math.sin(a) * d;
  spots[k] = x;
  spots[k + 2] = z;
  if (!sampleGroundColor(x, z, _color)) {
    spots[k + 1] = -1e5;
    born[i] = -1e3;
    return;
  }
  const y = groundAt(x, z);
  spots[k + 1] = y !== null ? y : -1e5;
  born[i] = now;
}

function build(preset) {
  count = COUNT[preset] || COUNT.mid;
  spots = new Float32Array(count * 4);
  born = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    spots[i * 4 + 1] = -1e5;
    spots[i * 4 + 3] = (i + 0.5) / count;
    born[i] = -1e3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(spots, 4));
  geometry.setAttribute('aSpot', geometry.getAttribute('position'));
  geometry.setAttribute('aBorn', new THREE.BufferAttribute(born, 1));
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'fireflies';
  points.raycast = () => {};
  points.renderOrder = 10;
  points.visible = false;
  points.userData.preset = preset;
  scene.add(points);
}

// How many are out: none by day, the most from dusk into the evening,
// fewer in the small hours, none in rain or snow
function amountNow() {
  const night = THREE.MathUtils.clamp((0.5 - state.dayFactor) / 0.35, 0, 1);
  const late = 1 - 0.5 * THREE.MathUtils.smoothstep(-state.sunY, 0.55, 0.9);
  const dry = 1 - Math.min(1, (precipitation.rain + precipitation.snow) * 3);
  return night * late * dry;
}

export function updateFireflies() {
  if (ChillFlightLogic.TRAFFIC_PARAM === false) {
    if (points) points.visible = false;
    return;
  }
  const preset = state.graphicsPreset;
  if (!points || points.userData.preset !== preset) {
    if (points) {
      scene.remove(points);
      points.geometry.dispose();
      points.material.dispose();
    }
    build(preset);
  }
  camera.getWorldPosition(_cam);
  const camAgl = _cam.y - Math.max(getElevation(_cam.x, _cam.z), WATER_LEVEL);
  const amount =
    amountNow() * (1 - THREE.MathUtils.smoothstep(camAgl, FADE_LOW, FADE_HIGH));
  uniforms.uAmount.value = amount;
  points.visible = amount > 0.01;
  if (!points.visible) return;

  // The field reaches further ahead of the camera than behind it
  camera.getWorldDirection(_fwd);
  _fwd.y = 0;
  if (_fwd.lengthSq() > 1e-6) _fwd.normalize();
  const cx = _cam.x + _fwd.x * RADIUS * 0.4;
  const cz = _cam.z + _fwd.z * RADIUS * 0.4;
  uniforms.uCenter.value.set(cx, 0, cz);
  // Point size: pixels per world unit at distance 1
  const h = renderer.domElement.height;
  uniforms.uScale.value =
    h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

  const now = animationUniforms.uTime.value;
  const dt = Math.min(0.1, Math.max(0, now - lastTime));
  lastTime = now;
  let moved = false;

  // Drift spots to the side of the active vehicle and leave them there, so
  // they never snap back after it passes
  const p = planeGroup.position;
  const vehAgl = p.y - Math.max(getElevation(p.x, p.z), WATER_LEVEL);
  if (dt > 0 && vehAgl < PUSH_RADIUS) {
    const yaw = planeGroup.rotation.y;
    const sx = Math.cos(yaw);
    const sz = -Math.sin(yaw);
    for (let i = 0; i < count; i++) {
      const k = i * 4;
      if (spots[k + 1] < -1e4) continue;
      const dx0 = spots[k] - p.x;
      const dz0 = spots[k + 2] - p.z;
      if (dx0 * dx0 + dz0 * dz0 > PUSH_OUTER2) continue;
      const r = spots[k + 3];
      const r2 = (r * 13.7) % 1;
      const r3 = (r * 29.3) % 1;
      const dx =
        dx0 +
        Math.sin(now * (0.21 + 0.12 * r2) + r * 40) * 5 +
        Math.sin(now * (0.53 + 0.2 * r3) + r * 11) * 1.5;
      const dz =
        dz0 +
        Math.cos(now * (0.17 + 0.11 * r3) + r * 23) * 5 +
        Math.cos(now * (0.47 + 0.2 * r2) + r * 7) * 1.5;
      const d2 = dx * dx + dz * dz;
      if (d2 >= PUSH_RADIUS * PUSH_RADIUS) continue;
      const side = dx * sx + dz * sz >= 0 ? 1 : -1;
      const step = (1 - Math.sqrt(d2) / PUSH_RADIUS) * PUSH_SPEED * dt * side;
      spots[k] += sx * step;
      spots[k + 2] += sz * step;
      // Follow the ground, so a push across a slope doesn't bury or strand it
      spots[k + 1] = Math.max(
        getElevation(spots[k], spots[k + 2]),
        WATER_LEVEL + 1.5
      );
      moved = true;
    }
  }

  // Move the ones that have fallen behind (or whose chunk wasn't loaded yet)
  for (let n = 0; n < CHECKS_PER_FRAME; n++) {
    const i = nextCheck;
    nextCheck = (nextCheck + 1) % count;
    const k = i * 4;
    const dx = spots[k] - cx;
    const dz = spots[k + 2] - cz;
    if (born[i] < 0 || dx * dx + dz * dz > RADIUS * RADIUS) {
      place(i, cx, cz, now);
      moved = true;
    }
  }
  if (moved) {
    points.geometry.getAttribute('aSpot').needsUpdate = true;
    points.geometry.getAttribute('aBorn').needsUpdate = true;
  }
}
