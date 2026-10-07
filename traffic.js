// --- AIR TRAFFIC ---
// A few other planes flying around, so the player occasionally spots someone
// else up there (issue #86). Each appears far off in the haze, wanders across
// the player's part of the sky and is removed once it's well past
// (traffic-logic.js has the flight math). They fly the game's own models in
// random liveries, and show navigation lights at night. The "Other planes"
// switch in the pause menu's Settings tab turns them off (saved), and
// ?traffic=0/1 sets them for one visit.
import * as THREE from 'three';
import {Achievements} from './achievements.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {createMaterial} from './constants.js';
import {scene} from './scene.js';
import {camera} from './sky.js';
import {createBiplaneModel} from './biplane.js';
import {createGliderModel} from './glider.js';
import {createTwinModel} from './twin.js';
import {createClassicAirplaneModel, planeGroup} from './airplane.js';
import {getElevation} from './terrain-geometry.js';
import {
  isTrafficPlaneGone,
  spawnTrafficPlane,
  stepTrafficPlane,
} from './traffic-logic.js';

const STORAGE_KEY = 'chill_flight_traffic';
const MAX_PLANES = 3;
// Seconds before the next plane appears, so they come and go rather than
// arriving in a crowd
const SPAWN_DELAY_MIN = 15;
const SPAWN_DELAY_MAX = 45;
const FIRST_SPAWN_DELAY = 5;
// Wingman: fly within this distance of another plane for this long
const WINGMAN_DISTANCE = 250;
const WINGMAN_SECONDS = 3;

const checkbox = document.getElementById('traffic-toggle-input');

function loadEnabled() {
  if (ChillFlightLogic.TRAFFIC_PARAM !== null) {
    return ChillFlightLogic.TRAFFIC_PARAM;
  }
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

let enabled = loadEnabled();
const planes = [];
let spawnTimer = FIRST_SPAWN_DELAY;
// The player's velocity, so new planes aim for where they'll be
const lastCenter = new THREE.Vector3();
const velocity = new THREE.Vector3();
let hasLastCenter = false;
const MAX_TRACKED_SPEED = 400; // units/s; faster is a teleport, not flight

// --- Models ---
const BUILDERS = {
  classic: (opts) => createClassicAirplaneModel({...opts, pontoons: false}),
  biplane: createBiplaneModel,
  twin: createTwinModel,
  glider: createGliderModel,
};

// One pair of materials per livery, shared by every plane wearing it (the
// light trim is dark on sand, as on the player's plane)
const liveryMats = new Map();
function materialsFor(livery) {
  if (!liveryMats.has(livery)) {
    const color = ChillFlightLogic.PLANE_COLORS[livery];
    liveryMats.set(livery, {
      planeMat: createMaterial({color, flatShading: true}),
      planeWhiteMat: createMaterial({
        color: color === 0xe8c382 ? 0x1c3144 : 0xffffff,
        flatShading: true,
      }),
    });
  }
  return liveryMats.get(livery);
}

// Navigation lights: red on the left wingtip, green on the right and a white
// strobe on the tail. Sprites of a fixed size on screen, so a plane far off
// at night is still a few points of light.
function glowTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const glow = glowTexture();
const lightMat = (color) =>
  new THREE.SpriteMaterial({
    map: glow,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: false,
    opacity: 0,
  });
const navMats = {
  red: lightMat(0xff3030),
  green: lightMat(0x30ff60),
  strobe: lightMat(0xffffff),
};
const NAV_LIGHT_SIZE = 0.012;

function addNavLight(group, mat, x, y, z) {
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(NAV_LIGHT_SIZE, NAV_LIGHT_SIZE, 1);
  sprite.position.set(x, y, z);
  group.add(sprite);
  return sprite;
}

const _box = new THREE.Box3();
const _planePos = new THREE.Vector3();

function buildPlane(p) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ'; // as the player's plane
  const mats = materialsFor(p.livery);
  const model = BUILDERS[p.type]({
    planeColor: ChillFlightLogic.PLANE_COLORS[p.livery],
    ...mats,
  });
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
  group.add(model);

  _box.setFromObject(model);
  addNavLight(group, navMats.red, _box.min.x, _box.max.y - 1, 0);
  addNavLight(group, navMats.green, _box.max.x, _box.max.y - 1, 0);
  // Each plane's strobe flashes on its own rhythm, not in step with the
  // others
  group.userData.strobe = addNavLight(
    group,
    navMats.strobe,
    0,
    _box.max.y,
    _box.max.z
  );
  group.userData.strobePeriod = 1 + Math.random() * 0.4;
  group.userData.strobePhase = Math.random() * 2;

  group.userData.props = model.propGroups || [model.propGroup];
  scene.add(group);
  return group;
}

function disposePlane(group) {
  scene.remove(group);
  const shared = new Set([
    ...[...liveryMats.values()].flatMap((m) => [m.planeMat, m.planeWhiteMat]),
    ...Object.values(navMats),
  ]);
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material && !shared.has(child.material)) {
      child.material.dispose();
    }
  });
}

function removeAll() {
  for (const p of planes) disposePlane(p.group);
  planes.length = 0;
}

export function setTrafficEnabled(on, save = true) {
  enabled = on;
  if (checkbox) checkbox.checked = on;
  if (save) {
    try {
      localStorage.setItem(STORAGE_KEY, String(on));
    } catch {
      /* ignore */
    }
  }
  if (!on) removeAll();
  spawnTimer = FIRST_SPAWN_DELAY;
}

if (checkbox) {
  checkbox.checked = enabled;
  checkbox.addEventListener('change', (e) =>
    setTrafficEnabled(e.target.checked)
  );
}

// How many other planes are flying now (for the debug panel)
export function trafficCount() {
  return planes.length;
}

// Called once per frame while flying (not while paused)
export function updateTraffic(delta) {
  if (!enabled) return;
  const center = state.isFreeCamera ? camera.position : planeGroup.position;
  if (hasLastCenter && delta > 0) {
    velocity.subVectors(center, lastCenter).divideScalar(delta);
    if (velocity.length() > MAX_TRACKED_SPEED) velocity.set(0, 0, 0);
  }
  lastCenter.copy(center);
  hasLastCenter = true;

  spawnTimer -= delta;
  if (spawnTimer <= 0 && planes.length < MAX_PLANES) {
    const p = spawnTrafficPlane(
      Math.random,
      center.x,
      center.z,
      getElevation,
      ChillFlightLogic.PLANE_COLORS.length,
      velocity.x,
      velocity.z
    );
    p.group = buildPlane(p);
    planes.push(p);
    spawnTimer =
      SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
  }

  // Lights show as the day fades; strobes flash briefly every 1-1.4 s
  const night = 1 - THREE.MathUtils.smoothstep(state.dayFactor, 0.3, 0.8);
  navMats.red.opacity = navMats.green.opacity = navMats.strobe.opacity = night;
  const now = performance.now() / 1000;

  // Planes pace the player's plane (not the free camera)
  const player = state.isFreeCamera
    ? null
    : {
        x: center.x,
        y: center.y,
        z: center.z,
        speed: Math.hypot(velocity.x, velocity.z),
      };
  for (let i = planes.length - 1; i >= 0; i--) {
    const p = planes[i];
    stepTrafficPlane(p, delta, getElevation, player);
    if (isTrafficPlaneGone(p, center.x, center.z)) {
      disposePlane(p.group);
      planes.splice(i, 1);
      continue;
    }
    if (!state.isFreeCamera) {
      const near =
        planeGroup.position.distanceToSquared(_planePos.set(p.x, p.y, p.z)) <
        WINGMAN_DISTANCE * WINGMAN_DISTANCE;
      p.nearTime = near ? (p.nearTime || 0) + delta : 0;
      if (p.nearTime > WINGMAN_SECONDS) Achievements.unlock('wingman');
    }
    const g = p.group;
    g.userData.strobe.visible =
      (now + g.userData.strobePhase) % g.userData.strobePeriod < 0.08;
    g.position.set(p.x, p.y, p.z);
    g.rotation.set(p.pitch, p.heading, p.bank);
    const spin = p.speed * delta * 0.15;
    for (const prop of g.userData.props) if (prop) prop.rotation.z += spin;
  }
}
