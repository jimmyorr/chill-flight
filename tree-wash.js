// --- PROP WASH IN THE TREES ---
// A plane flying low over trees or bushes pushes their tops aside, and they
// spring back after it's passed. The bending is in the leaves' vertex shader
// (addPropWash in terrain-geometry.js); this keeps its uniforms up to date:
// where the plane's wash is now, and a short trail of where it was, fading.
import * as THREE from 'three';
import {state} from './state.js';
import {WATER_LEVEL} from './constants.js';
import {
  getElevation,
  WASH_HEIGHT,
  WASH_POINTS,
  washUniforms,
} from './terrain-geometry.js';
import {activePlaneType, planeGroup} from './airplane.js';

// Nothing reaches the treetops from higher than this above the ground
// (units: the tallest trees plus the wash's reach)
const HIGH = 70 + WASH_HEIGHT;
// How often a trail point is dropped (s) and how long trees take to spring
// back (s)
const TRAIL_EVERY = 0.15;
const LIFE = 1.4;

const trail = []; // {x, z, y, s, age}
let trailTimer = 0;
const _last = new THREE.Vector3();
const _fwd = new THREE.Vector3();
let hasLast = false;

export function updateTreeWash(delta) {
  const wash = washUniforms.uWash.value;
  if (state.isPaused || delta <= 0) return;
  const p = planeGroup.position;
  const speed = hasLast ? _last.distanceTo(p) / delta : 0;
  hasLast = true;
  _last.copy(p);
  const ground = Math.max(getElevation(p.x, p.z), WATER_LEVEL);
  let s = 0;
  let x = p.x;
  let z = p.z;
  if (
    activePlaneType !== 'buggy' &&
    !state.isFreeCamera &&
    state._enableObjects &&
    p.y - ground < HIGH &&
    speed > 5 &&
    speed < 2000
  ) {
    // Just behind the plane, where its prop wash and downwash land
    _fwd.set(0, 0, -1).applyQuaternion(planeGroup.quaternion);
    x -= _fwd.x * 6;
    z -= _fwd.z * 6;
    s = Math.min(1, 0.3 + speed / 80);
  }

  trailTimer += delta;
  for (const t of trail) t.age += delta;
  while (trail.length && trail[0].age > LIFE) trail.shift();
  if (s > 0 && trailTimer > TRAIL_EVERY) {
    trailTimer = 0;
    trail.push({x, z, y: p.y, s, age: 0});
    if (trail.length > WASH_POINTS - 1) trail.shift();
  }

  wash[0].set(x, z, p.y, s);
  let on = s > 0;
  for (let i = 1; i < WASH_POINTS; i++) {
    const t = trail[trail.length - i];
    if (!t) {
      wash[i].w = 0;
      continue;
    }
    const k = 1 - t.age / LIFE;
    wash[i].set(t.x, t.z, t.y, t.s * k * k);
    on = true;
  }
  washUniforms.uWashOn.value = on ? 1 : 0;
}
