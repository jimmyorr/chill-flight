// --- A RETRIEVAL JOB'S PACKAGE ---
// The package a retrieval job sends you out for (jobs.js places it): a
// small wooden crate lying on the ground or bobbing on the water, with a
// red flare burning on top. The flare spits sparks, glows (seen from a few
// km off, brighter at night) and sends up a thin pale plume of smoke that
// drifts away on the wind, so it can be spotted from the air.
// One crate at most; nothing is drawn or spawned without a job's package.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {WATER_LEVEL, createMaterial} from './constants.js';
import {sampleGround} from './terrain-geometry.js';
import {camera} from './sky.js';
import {flareSmoke, flareSparks, propPuffs} from './particles.js';

// The crate's size (world units: a bit larger than life, like the buggy)
const CRATE = 4;
// The flare's tip, above the crate's middle
const FLARE_TOP = CRATE + 2.4;
// Smoke puffs a second, and sparks a frame
const SMOKE_RATE = 12;
const SPARKS = 2;
const FLARE_PUFF = new THREE.Color(0.92, 0.88, 0.86);
// No smoke or sparks spawned farther off than this (they'd be too small)
const SPAWN_RANGE = 9000;
// The glow keeps at least this share of the view's height, so it reads
// from far off, and fades out past GLOW_RANGE
const GLOW_MIN_SCREEN = 0.03;
// The flame's bright core (drawn normally, so it shows on a bright day too)
const CORE_MIN_SCREEN = 0.007;
const GLOW_RANGE = 12000;

const group = new THREE.Group();
group.visible = false;
group.name = 'package-flare';

const wood = createMaterial({color: 0xb98347, flatShading: true});
const strap = createMaterial({color: 0x5b3a1e, flatShading: true});
const stickMat = createMaterial({color: 0xd8262a, flatShading: true});

const crate = new THREE.Mesh(new THREE.BoxGeometry(CRATE, CRATE, CRATE), wood);
crate.position.y = CRATE / 2;
crate.castShadow = true;
group.add(crate);
// Two dark straps round it
for (const sx of [-0.28, 0.28]) {
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(CRATE * 0.12, CRATE * 1.02, CRATE * 1.02),
    strap
  );
  band.position.set(sx * CRATE, CRATE / 2, 0);
  group.add(band);
}
// The flare stick, leaning a little, stuck in the top
const stick = new THREE.Mesh(
  new THREE.CylinderGeometry(0.22, 0.22, 2.6, 6),
  stickMat
);
stick.position.set(0, CRATE + 1.1, 0);
stick.rotation.z = 0.15;
group.add(stick);

// A soft red glow round the flame
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 235, 225, 1)');
  grad.addColorStop(0.18, 'rgba(255, 90, 70, 0.85)');
  grad.addColorStop(0.5, 'rgba(230, 30, 25, 0.25)');
  grad.addColorStop(1, 'rgba(200, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const glowMat = new THREE.SpriteMaterial({
  map: glowTexture(),
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
});
const glow = new THREE.Sprite(glowMat);
glow.position.y = FLARE_TOP;
glow.renderOrder = 2;
group.add(glow);
const coreMat = new THREE.SpriteMaterial({
  map: glowMat.map,
  color: 0xffd0c8,
  transparent: true,
  depthWrite: false,
  fog: false,
});
const core = new THREE.Sprite(coreMat);
core.position.y = FLARE_TOP;
core.renderOrder = 3;
group.add(core);

scene.add(group);

// Where the package lies: {x, z, water} or null
let spot = null;
let smokeDue = 0;
let clock = 0;
const _ground = {height: 0, slopeX: 0, slopeZ: 0};
const _world = new THREE.Vector3();

/** Shows the package at (x, z) (on the ground, or the water there). */
export function showPackage(x, z) {
  if (spot && spot.x === x && spot.z === z) return;
  sampleGround(x, z, _ground);
  const water = _ground.height <= WATER_LEVEL + 0.1;
  spot = {x, z, water, y: water ? WATER_LEVEL : _ground.height};
  group.position.set(x, spot.y, z);
  // Tipped to lie on the slope
  group.rotation.set(
    water ? 0 : Math.atan(_ground.slopeZ),
    (x * 0.013 + z * 0.007) % (Math.PI * 2),
    water ? 0 : -Math.atan(_ground.slopeX)
  );
  group.visible = true;
}

/** Hides it: picked up (with a puff of smoke) or the job's off. */
export function hidePackage(picked = false) {
  if (!spot) return;
  if (picked) {
    propPuffs(spot.x, spot.y + 1, spot.z, 4, CRATE, FLARE_PUFF, 12, 6, 4);
  }
  spot = null;
  group.visible = false;
}
/** Per frame: the flare flickers, smokes and sparks. */
export function updatePackage(delta) {
  if (!spot || state.isPaused || delta <= 0) return;
  clock += delta;
  if (spot.water) {
    // Bobbing on the swell
    group.position.y = spot.y - 0.8 + Math.sin(clock * 1.3) * 0.35;
    group.rotation.x = Math.sin(clock * 0.9) * 0.06;
    group.rotation.z = Math.cos(clock * 1.1) * 0.06;
  }
  glow.getWorldPosition(_world);
  const dist = camera.position.distanceTo(_world);
  // Flickering, and kept a readable size from far off
  const flicker =
    0.85 + 0.1 * Math.sin(clock * 23) + 0.08 * Math.sin(clock * 37 + 1.3);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const minSize = 2 * dist * Math.tan(fov / 2) * GLOW_MIN_SCREEN;
  const size = Math.max(7, minSize) * flicker;
  glow.scale.set(size, size, 1);
  const coreSize =
    Math.max(1.6, (minSize * CORE_MIN_SCREEN) / GLOW_MIN_SCREEN) * flicker;
  core.scale.set(coreSize, coreSize, 1);
  // Brighter after dark (dayFactor 1 noon, 0 night)
  const night = THREE.MathUtils.clamp(
    1.1 - (state.dayFactor ?? 1) * 0.45,
    0.65,
    1
  );
  glowMat.opacity =
    night *
    flicker *
    (1 - THREE.MathUtils.smoothstep(dist, GLOW_RANGE * 0.6, GLOW_RANGE));
  if (dist > SPAWN_RANGE) return;
  flareSparks(_world.x, _world.y, _world.z, SPARKS);
  smokeDue -= delta;
  while (smokeDue <= 0) {
    flareSmoke(_world.x, _world.y + 0.5, _world.z);
    smokeDue += 1 / SMOKE_RATE;
  }
}

/** Where the package lies now ({x, y, z, water}), or null. */
export function packageSpot() {
  return spot;
}
