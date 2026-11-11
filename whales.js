// --- WHALES ---
// Now and then, flying low over the open sea, a whale surfaces ahead of the
// plane: its back breaks the water with a blow of mist, it rolls along for a
// few seconds, then arches and dives, lifting its tail out of the water. One
// whale at a time, one mesh, so it costs a single draw call while it's up.
// Hidden when ?traffic=0 is set.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {scene} from './scene.js';
import {state} from './state.js';
import {WATER_LEVEL, createMaterial} from './constants.js';
import {getElevation} from './terrain-geometry.js';
import {planeGroup} from './airplane.js';
import {whaleBlow, whaleSplash} from './particles.js';

// Seconds between sightings (a random wait in this range), and the first
// wait after the game starts
const WHALE_WAIT_MIN = 50;
const WHALE_WAIT_MAX = 110;
const WHALE_FIRST_WAIT = 25;
// Only when the plane is this low over the water (units)
const WHALE_MAX_HEIGHT = 900;
// How far ahead of the plane it surfaces, and how far to the side (units)
const WHALE_AHEAD_MIN = 500;
const WHALE_AHEAD_MAX = 1000;
const WHALE_SIDE = 350;
// The water must be at least this deep where it swims (units; the open
// sea's floor is about 10 down)
const WHALE_MIN_DEPTH = 8;
// Not in the frozen north's pack ice
const WHALE_MAX_NORTH = -18000;
// Swimming speed (units/s) and the length of one sighting (s)
const WHALE_SPEED = 7;
const WHALE_DURATION = 11;
// The model is about 15 m long; drawn a little bigger so it reads from the air
const WHALE_SCALE = 1.3;

// A humpback about 15 m long: a long, low body (head toward +z), flippers
// and a broad tail fluke
function createWhaleGeometry() {
  const parts = [];
  const body = new THREE.SphereGeometry(1, 10, 6);
  body.scale(4.5, 3.6, 15);
  parts.push(body);
  const stock = new THREE.CylinderGeometry(1.8, 0.7, 7, 6);
  stock.rotateX(Math.PI / 2);
  stock.translate(0, 0.3, -16);
  parts.push(stock);
  const fluke = new THREE.BoxGeometry(13, 0.5, 4);
  // Swept back at the tips
  const pos = fluke.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) - Math.abs(x) * 0.35);
  }
  fluke.translate(0, 0.5, -20);
  parts.push(fluke);
  for (const side of [-1, 1]) {
    const flipper = new THREE.BoxGeometry(9, 0.4, 2.4);
    flipper.translate(side * 4.5, 0, 0);
    flipper.rotateZ(side * -0.45);
    flipper.rotateY(side * -0.4);
    flipper.translate(side * 3, -1.6, 6);
    parts.push(flipper);
  }
  const merged = new THREE.BufferGeometry();
  const positions = [];
  for (const g of parts) {
    const ng = g.index ? g.toNonIndexed() : g;
    positions.push(...ng.attributes.position.array);
  }
  merged.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  merged.computeVertexNormals();
  return merged;
}

const whale = new THREE.Mesh(
  createWhaleGeometry(),
  createMaterial({color: 0x3a4a5e, flatShading: true})
);
whale.rotation.order = 'YXZ';
whale.scale.setScalar(WHALE_SCALE);
whale.visible = false;
whale.castShadow = true;
scene.add(whale);

let wait = WHALE_FIRST_WAIT;
let age = -1;
let blown = false;
let tailSplashed = false;
const start = new THREE.Vector3();
const dir = new THREE.Vector3();
const lastPlane = new THREE.Vector3();
let hasLast = false;
const _fwd = new THREE.Vector3();
const _tail = new THREE.Vector3();

function deepAt(x, z) {
  return getElevation(x, z) < WATER_LEVEL - WHALE_MIN_DEPTH;
}

// Starts a sighting at (x, z), swimming along (dx, dz), if the sea there is
// deep enough along its whole swim. Returns whether it started.
export function spawnWhale(x, z, dx, dz) {
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const swim = WHALE_SPEED * WHALE_DURATION;
  for (const s of [-40, 0, swim * 0.5, swim + 30]) {
    if (!deepAt(x + dx * s, z + dz * s)) return false;
  }
  if (!deepAt(x - dz * 60, z + dx * 60) || !deepAt(x + dz * 60, z - dx * 60))
    return false;
  start.set(x, 0, z);
  dir.set(dx, 0, dz);
  whale.rotation.y = Math.atan2(dx, dz);
  age = 0;
  blown = false;
  tailSplashed = false;
  whale.visible = true;
  return true;
}

function trySpawn() {
  const p = planeGroup.position;
  if (p.y - WATER_LEVEL > WHALE_MAX_HEIGHT || p.z < WHALE_MAX_NORTH) return;
  // The way the plane is heading, from its movement
  _fwd.set(p.x - lastPlane.x, 0, p.z - lastPlane.z);
  if (_fwd.lengthSq() < 1e-6) {
    const a = Math.random() * Math.PI * 2;
    _fwd.set(Math.sin(a), 0, Math.cos(a));
  }
  _fwd.normalize();
  const ahead =
    WHALE_AHEAD_MIN + Math.random() * (WHALE_AHEAD_MAX - WHALE_AHEAD_MIN);
  const side = (Math.random() * 2 - 1) * WHALE_SIDE;
  const x = p.x + _fwd.x * ahead - _fwd.z * side;
  const z = p.z + _fwd.z * ahead + _fwd.x * side;
  // Swimming roughly away from the plane or toward it, so its tail lifts
  // broadside on to the view as it dives
  const turn = (Math.random() < 0.6 ? 0 : Math.PI) + (Math.random() - 0.5);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  spawnWhale(x, z, _fwd.x * c - _fwd.z * s, _fwd.x * s + _fwd.z * c);
}

// Seconds into the current sighting, or -1 between sightings
export function whaleAge() {
  return age;
}

const smooth = (t) => t * t * (3 - 2 * t);
const ramp = (t, a, b) => smooth(Math.max(0, Math.min(1, (t - a) / (b - a))));

export function updateWhales(delta) {
  if (ChillFlightLogic.TRAFFIC_PARAM === false) {
    if (whale.visible) {
      age = -1;
      whale.visible = false;
      wait = WHALE_FIRST_WAIT;
    }
    return;
  }
  if (state.isPaused || delta <= 0) return;
  const p = planeGroup.position;
  if (age < 0) {
    wait -= delta;
    if (wait <= 0 && hasLast) {
      trySpawn();
      // Look again in a few seconds if there was no deep sea ahead
      wait =
        age >= 0
          ? WHALE_WAIT_MIN + Math.random() * (WHALE_WAIT_MAX - WHALE_WAIT_MIN)
          : 4;
    }
    lastPlane.copy(p);
    hasLast = true;
    return;
  }
  lastPlane.copy(p);
  age += delta;
  const t = age;
  // Rises (0-2 s), rolls along the surface (2-5 s), arches into a dive
  // lifting its tail (5-8.5 s), and sinks away (8.5-11 s)
  const depth =
    -14 + 11.5 * ramp(t, 0, 2) - 3.5 * ramp(t, 5, 8) - 22 * ramp(t, 8.5, 11);
  // A gentle rise and fall while it rolls along the surface
  const bob = Math.sin(Math.min(t, 5) * 1.6) * 0.4 * ramp(t, 2, 3);
  const pitch = -0.12 * (1 - ramp(t, 0, 2)) + 1.0 * ramp(t, 5, 8.5);
  const s = WHALE_SPEED * t;
  whale.position.set(
    start.x + dir.x * s,
    WATER_LEVEL + depth + bob,
    start.z + dir.z * s
  );
  whale.rotation.x = pitch;
  if (!blown && t > 1.9) {
    blown = true;
    whaleBlow(
      whale.position.x + dir.x * 9 * WHALE_SCALE,
      whale.position.z + dir.z * 9 * WHALE_SCALE
    );
    whaleSplash(whale.position.x, whale.position.z, 0.8);
  }
  if (!tailSplashed && t > 9.4) {
    tailSplashed = true;
    _tail
      .set(0, 0, -20 * WHALE_SCALE)
      .applyEuler(whale.rotation)
      .add(whale.position);
    whaleSplash(_tail.x, _tail.z, 1.1);
  }
  if (t >= WHALE_DURATION) {
    age = -1;
    whale.visible = false;
    wait = WHALE_WAIT_MIN + Math.random() * (WHALE_WAIT_MAX - WHALE_WAIT_MIN);
  }
}
