// --- DOLPHINS ---
// Now and then, low over the sea (or sitting on it in the seaplane), a pod
// of dolphins appears ahead: they swim along just under the surface, heading
// the way you are, and take turns leaping clear of the water with a splash.
// The model is Polyfork's Dolphin (terrain-geometry.js createDolphinModel), a
// skinned mesh whose spine bones beat the tail as it swims. A few meshes, one
// draw call each, only while the pod is up. Hidden when ?traffic=0 is set.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {scene} from './scene.js';
import {state} from './state.js';
import {WATER_LEVEL} from './constants.js';
import {createDolphinModel, getElevation} from './terrain-geometry.js';
import {planeGroup} from './airplane.js';
import {whaleSplash} from './particles.js';
import {whaleAge} from './whales.js';

// Seconds between sightings (a random wait in this range), and the first
// wait after the game starts
const POD_WAIT_MIN = 40;
const POD_WAIT_MAX = 90;
const POD_FIRST_WAIT = 15;
// Only when the plane is this low over the water (units)
const POD_MAX_HEIGHT = 600;
// How far ahead of the plane the pod appears, and how far to the side
const POD_AHEAD_MIN = 250;
const POD_AHEAD_MAX = 600;
const POD_SIDE = 200;
// The water must be at least this deep along the pod's swim (units)
const POD_MIN_DEPTH = 4;
// Not in the frozen north's pack ice
const POD_MAX_NORTH = -18000;
// Swimming speed (units/s) and the length of one sighting (s)
const POD_SPEED = 16;
const POD_DURATION = 16;
// Dolphins in the biggest pod (each sighting has 3 to this many)
const POD_MAX = 5;
// The model is 2.5 to 2.8 m long; drawn bigger so it reads from the air
const DOLPHIN_SCALE = 2.6;
// One leap: seconds in the air, peak height (units, before scale) and how
// long each dolphin swims between leaps
const LEAP_TIME = 1.1;
const LEAP_HEIGHT = 1.6;
const LEAP_GAP_MIN = 1.6;
const LEAP_GAP_MAX = 3.2;
// Swimming depth under the surface, and how deep it starts and ends
const SWIM_DEPTH = 1.2;
const HIDDEN_DEPTH = 8;
// The model's body centre above its belly
const BODY_Y = 0.47;

const dolphins = [];
for (let i = 0; i < POD_MAX; i++) {
  const {group, bones} = createDolphinModel(i / (POD_MAX - 1));
  group.position.y = -BODY_Y;
  const holder = new THREE.Group();
  holder.add(group);
  holder.rotation.order = 'YXZ';
  holder.scale.setScalar(DOLPHIN_SCALE);
  holder.visible = false;
  scene.add(holder);
  dolphins.push({
    holder,
    bones,
    // Place in the pod (along, across), set per sighting
    along: 0,
    across: 0,
    // Seconds until its next leap, and seconds into the current one (-1
    // while swimming)
    nextLeap: 0,
    leap: -1,
    beat: Math.random() * Math.PI * 2,
  });
}

let wait = POD_FIRST_WAIT;
let age = -1;
let podSize = 0;
const start = new THREE.Vector3();
const dir = new THREE.Vector3();
const lastPlane = new THREE.Vector3();
let hasLast = false;
const _fwd = new THREE.Vector3();

const smooth = (t) => t * t * (3 - 2 * t);
const ramp = (t, a, b) => smooth(Math.max(0, Math.min(1, (t - a) / (b - a))));
const rand = (a, b) => a + Math.random() * (b - a);

function deepAt(x, z) {
  return getElevation(x, z) < WATER_LEVEL - POD_MIN_DEPTH;
}

// Starts a sighting at (x, z), swimming along (dx, dz), if the sea there is
// deep enough along the pod's whole swim. Returns whether it started.
export function spawnDolphins(x, z, dx, dz, size = 0) {
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const swim = POD_SPEED * POD_DURATION;
  for (const s of [-40, 0, swim * 0.5, swim + 30]) {
    if (!deepAt(x + dx * s, z + dz * s)) return false;
  }
  if (!deepAt(x - dz * 40, z + dx * 40) || !deepAt(x + dz * 40, z - dx * 40))
    return false;
  start.set(x, 0, z);
  dir.set(dx, 0, dz);
  podSize = size || 3 + Math.floor(Math.random() * (POD_MAX - 2));
  dolphins.forEach((d, i) => {
    d.holder.visible = i < podSize;
    d.holder.rotation.set(0, Math.atan2(dx, dz), 0);
    // A loose cluster, a few body lengths apart
    d.along = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * rand(5, 9) + rand(-2, 2);
    d.across = (i % 2 ? 1 : -1) * rand(3, 10);
    d.nextLeap = 1.5 + i * 0.45 + rand(0, 1);
    d.leap = -1;
  });
  age = 0;
  return true;
}

function trySpawn() {
  const p = planeGroup.position;
  if (p.y - WATER_LEVEL > POD_MAX_HEIGHT || p.z < POD_MAX_NORTH) return;
  // The way the plane is heading, from its movement
  _fwd.set(p.x - lastPlane.x, 0, p.z - lastPlane.z);
  if (_fwd.lengthSq() < 1e-6) {
    const a = Math.random() * Math.PI * 2;
    _fwd.set(Math.sin(a), 0, Math.cos(a));
  }
  _fwd.normalize();
  const ahead = rand(POD_AHEAD_MIN, POD_AHEAD_MAX);
  const side = rand(-1, 1) * POD_SIDE;
  const x = p.x + _fwd.x * ahead - _fwd.z * side;
  const z = p.z + _fwd.z * ahead + _fwd.x * side;
  // Heading roughly the plane's way, so they race along with it
  const turn = rand(-0.4, 0.4);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  spawnDolphins(x, z, _fwd.x * c - _fwd.z * s, _fwd.x * s + _fwd.z * c);
}

// Seconds into the current sighting, or -1 between sightings
export function dolphinAge() {
  return age;
}

function hidePod() {
  age = -1;
  dolphins.forEach((d) => (d.holder.visible = false));
}

// Tail beat: a wave down the spine, stronger toward the flukes
const SPINE = [
  ['Spine1', 0.05],
  ['Spine2', 0.08],
  ['Spine3', 0.12],
  ['Tail', 0.18],
  ['TailEnd', 0.24],
];
function swimPose(d, delta, rate) {
  d.beat += delta * rate;
  SPINE.forEach(([name, amp], k) => {
    const b = d.bones[name];
    if (b) b.rotation.x = Math.sin(d.beat - k * 0.6) * amp;
  });
}

export function updateDolphins(delta) {
  if (ChillFlightLogic.TRAFFIC_PARAM === false) {
    if (age >= 0) {
      hidePod();
      wait = POD_FIRST_WAIT;
    }
    return;
  }
  if (state.isPaused || delta <= 0) return;
  const p = planeGroup.position;
  if (age < 0) {
    wait -= delta;
    if (wait <= 0 && hasLast && whaleAge() < 0) {
      trySpawn();
      // Look again in a few seconds if there was no open sea ahead
      wait = age >= 0 ? rand(POD_WAIT_MIN, POD_WAIT_MAX) : 4;
    }
    lastPlane.copy(p);
    hasLast = true;
    return;
  }
  lastPlane.copy(p);
  age += delta;
  const t = age;
  // Rise from the deep at the start, sink away at the end
  const surface =
    ramp(t, 0, 1.5) * (1 - ramp(t, POD_DURATION - 1.5, POD_DURATION));
  const swimY = -HIDDEN_DEPTH + (HIDDEN_DEPTH - SWIM_DEPTH) * surface;
  const s = POD_SPEED * t;
  for (let i = 0; i < podSize; i++) {
    const d = dolphins[i];
    // Leaps only while the pod is up
    if (d.leap < 0) {
      d.nextLeap -= delta;
      if (d.nextLeap <= 0 && surface > 0.95) {
        d.leap = 0;
        const h = d.holder;
        whaleSplash(h.position.x, h.position.z, 0.35);
      }
    }
    let y = swimY;
    let pitch = 0;
    if (d.leap >= 0) {
      d.leap += delta;
      const u = d.leap / LEAP_TIME;
      if (u >= 1) {
        d.leap = -1;
        d.nextLeap = rand(LEAP_GAP_MIN, LEAP_GAP_MAX);
        whaleSplash(d.holder.position.x, d.holder.position.z, 0.45);
      } else {
        // A parabola from swimming depth up through the surface and back,
        // nose following the arc
        const top = LEAP_HEIGHT + SWIM_DEPTH;
        y = -SWIM_DEPTH + 4 * top * u * (1 - u);
        const slope = (4 * top * (1 - 2 * u)) / (POD_SPEED * LEAP_TIME);
        pitch = -Math.atan(slope * DOLPHIN_SCALE);
      }
    }
    // Weave gently side to side as they swim
    const weave = Math.sin(t * 0.7 + i * 1.3) * 2;
    const along = s + d.along;
    const across = d.across + weave;
    d.holder.position.set(
      start.x + dir.x * along - dir.z * across,
      WATER_LEVEL + y * DOLPHIN_SCALE,
      start.z + dir.z * along + dir.x * across
    );
    d.holder.rotation.x = pitch;
    swimPose(d, delta, d.leap >= 0 ? 4 : 9);
  }
  if (t >= POD_DURATION) {
    hidePod();
    wait = rand(POD_WAIT_MIN, POD_WAIT_MAX);
  }
}
