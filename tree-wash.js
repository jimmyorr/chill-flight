// --- PROP WASH IN THE TREES ---
// A plane flying low over trees or bushes pushes their tops aside, and they
// spring back after it's passed. The bending is in the leaves' vertex shader
// (addPropWash in terrain-geometry.js); this keeps its one uniform up to
// date: where the wash lands, trailing a little behind the plane so the
// trees it just passed are still leaning, and how strong it is.
import * as THREE from 'three';
import {state} from './state.js';
import {WATER_LEVEL} from './constants.js';
import {getElevation, WASH_HEIGHT, washUniforms} from './terrain-geometry.js';
import {activePlaneType, planeGroup} from './airplane.js';

// Nothing reaches the treetops from higher than this above the ground
// (units: the tallest trees plus the wash's reach)
const HIGH = 70 + WASH_HEIGHT;
// How far behind the plane the wash lands (units), how quickly it catches
// up (per second) and how quickly it builds and dies away (per second)
const BEHIND = 10;
const FOLLOW = 5;
const FADE = 3;

const _last = new THREE.Vector3();
const _fwd = new THREE.Vector3();
let hasLast = false;
let washX = 0;
let washZ = 0;
let strength = 0;

export function updateTreeWash(delta) {
  const wash = washUniforms.uWash.value;
  if (state.isPaused || delta <= 0) return;
  const p = planeGroup.position;
  const speed = hasLast ? _last.distanceTo(p) / delta : 0;
  hasLast = true;
  _last.copy(p);
  const ground = Math.max(getElevation(p.x, p.z), WATER_LEVEL);
  let target = 0;
  if (
    activePlaneType !== 'buggy' &&
    !state.isFreeCamera &&
    state._enableObjects &&
    p.y - ground < HIGH &&
    speed > 5 &&
    speed < 2000
  ) {
    target = Math.min(1, 0.3 + speed / 80);
  }
  _fwd.set(0, 0, -1).applyQuaternion(planeGroup.quaternion);
  const tx = p.x - _fwd.x * BEHIND;
  const tz = p.z - _fwd.z * BEHIND;
  // Just switched on, or a teleport: start where the plane is
  if (strength <= 0 || Math.hypot(tx - washX, tz - washZ) > 300) {
    washX = tx;
    washZ = tz;
  }
  const k = 1 - Math.exp(-FOLLOW * delta);
  washX += (tx - washX) * k;
  washZ += (tz - washZ) * k;
  strength += (target - strength) * (1 - Math.exp(-FADE * delta));
  if (strength < 0.02 && target === 0) strength = 0;
  wash.set(washX, washZ, p.y, strength);
}
