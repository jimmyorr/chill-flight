// --- PARTICLES ---
// One shared pool of soft puffs, drawn in a single call: each particle's
// motion (drift slowing under drag, gravity, growing, fading) is worked out
// in the vertex shader from where and when it was spawned, so the CPU only
// writes a particle once. Flat particles lie on the water and ride its swell
// (foam); the rest face the camera (spray, dust, smoke).
//
// The plane's effects below use it: spray and a foam wake on the water, and a
// puff of tire smoke or dust when the wheels touch down.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {
  WATER_SWELL_GLSL,
  getElevation,
  waterUniforms,
} from './terrain-geometry.js';
import {sampleGroundColor, sampleRoad} from './terrain-chunks.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {isOnWheels} from './flight-physics.js';
import {ChillFlightLogic} from './chill-flight-logic.js';

const POOL_SIZE = 1536;
// How quickly a particle's own speed dies away (per second)
const DRAG = 1.6;

const geometry = new THREE.InstancedBufferGeometry();
const quad = new THREE.PlaneGeometry(1, 1);
geometry.index = quad.index;
geometry.setAttribute('position', quad.attributes.position);
geometry.setAttribute('uv', quad.attributes.uv);
geometry.instanceCount = POOL_SIZE;

function poolAttribute(name, size) {
  const attr = new THREE.InstancedBufferAttribute(
    new Float32Array(POOL_SIZE * size),
    size
  );
  attr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute(name, attr);
  return attr;
}
// Spawn point; velocity (xyz) and gravity (w); birth time, lifetime, start
// size (negative for flat) and end size; colour and opacity
const aStart = poolAttribute('aStart', 3);
const aVel = poolAttribute('aVel', 4);
const aLife = poolAttribute('aLife', 4);
const aColor = poolAttribute('aColor', 4);
const attributes = [aStart, aVel, aLife, aColor];
// Nothing is alive until spawned
for (let i = 0; i < POOL_SIZE; i++) aLife.array[i * 4 + 1] = -1;

const uniforms = {
  uTime: {value: 0},
  uDrag: {value: DRAG},
  uLight: {value: new THREE.Color(1, 1, 1)},
  uWaterTime: waterUniforms.uTime,
};

const material = new THREE.ShaderMaterial({
  uniforms,
  transparent: true,
  depthWrite: false,
  // Flat particles face down as built
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    attribute vec3 aStart;
    attribute vec4 aVel;
    attribute vec4 aLife;
    attribute vec4 aColor;
    uniform float uTime;
    uniform float uDrag;
    uniform float uWaterTime;
    varying vec2 vUv;
    varying vec4 vColor;
    ${WATER_SWELL_GLSL}
    void main() {
      float t = uTime - aLife.x;
      float age = t / aLife.y;
      if (age < 0.0 || age > 1.0) {
        // Dead or not born: off screen
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vColor = vec4(0.0);
        return;
      }
      vec3 p = aStart + aVel.xyz * (1.0 - exp(-uDrag * t)) / uDrag;
      p.y += 0.5 * aVel.w * t * t;
      float grow = 1.0 - (1.0 - age) * (1.0 - age);
      float size = mix(abs(aLife.z), aLife.w, grow);
      if (aLife.z < 0.0) {
        // Flat on the water, riding the swell
        p.y += swell(p.xz, uWaterTime).x + 0.25;
        p.xz += position.xy * size;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      } else {
        vec4 mv = viewMatrix * vec4(p, 1.0);
        mv.xy += position.xy * size;
        gl_Position = projectionMatrix * mv;
      }
      vUv = uv;
      vColor = vec4(
        aColor.rgb,
        aColor.a * smoothstep(0.0, 0.06, age) * pow(1.0 - age, 1.5)
      );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uLight;
    varying vec2 vUv;
    varying vec4 vColor;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float soft = 1.0 - d * d;
      if (soft <= 0.0) discard;
      gl_FragColor = vec4(vColor.rgb * uLight, vColor.a * soft * soft);
    }
  `,
});

const mesh = new THREE.Mesh(geometry, material);
mesh.frustumCulled = false;
// After the water and terrain, so puffs blend over them
mesh.renderOrder = 2;
mesh.visible = false;
scene.add(mesh);

let cursor = 0;
let spawnedFrom = -1;
let spawnedCount = 0;
// When the last particle spawned so far dies
let allDeadAt = 0;

/**
 * Spawns one particle. p: {x, y, z}, v: {x, y, z}; gravity in units/s²
 * (negative falls); sizes in units; flat lays it on the water.
 */
function spawn(p, v, gravity, life, size0, size1, color, alpha, flat = false) {
  const i = cursor;
  cursor = (cursor + 1) % POOL_SIZE;
  if (spawnedCount === 0) spawnedFrom = i;
  spawnedCount = Math.min(POOL_SIZE, spawnedCount + 1);

  const s = aStart.array;
  s[i * 3] = p.x;
  s[i * 3 + 1] = p.y;
  s[i * 3 + 2] = p.z;
  const j = i * 4;
  const vel = aVel.array;
  vel[j] = v.x;
  vel[j + 1] = v.y;
  vel[j + 2] = v.z;
  vel[j + 3] = gravity;
  const l = aLife.array;
  l[j] = uniforms.uTime.value;
  l[j + 1] = life;
  l[j + 2] = flat ? -size0 : size0;
  l[j + 3] = size1;
  const c = aColor.array;
  c[j] = color.r;
  c[j + 1] = color.g;
  c[j + 2] = color.b;
  c[j + 3] = alpha;
  allDeadAt = Math.max(allDeadAt, uniforms.uTime.value + life);
}

// Uploads only the slots written this frame
function uploadSpawned() {
  if (spawnedCount === 0) return;
  const wraps = spawnedFrom + spawnedCount > POOL_SIZE;
  for (const attr of attributes) {
    attr.clearUpdateRanges();
    if (wraps) {
      attr.addUpdateRange(0, POOL_SIZE * attr.itemSize);
    } else {
      attr.addUpdateRange(
        spawnedFrom * attr.itemSize,
        spawnedCount * attr.itemSize
      );
    }
    attr.needsUpdate = true;
  }
  spawnedCount = 0;
}

// --- THE PLANE'S EFFECTS ---

// How far apart the left and right wheels or pontoons are (half, units)
const GEAR_HALF_TRACK = {seaplane: 5, twin: 5.8, biplane: 1.8, glider: 0};
// Where the pontoons end behind the plane's centre (units)
const PONTOON_STERN = 7.5;
// Below this speed on the water there's no spray or wake (speed multiplier)
const WAKE_MIN_SPEED = 0.08;
// How far apart the wake's foam is laid (units)
const WAKE_SPACING = 1.5;
// How far apart the rolling dust is laid (units)
const DUST_SPACING = 1.5;
// Skimming spray starts this far above the water (units, from the bottom of
// the plane)
const SKIM_HEIGHT = 14;
// Where the airshow smoke comes out, behind the plane's centre (units), and
// how long it hangs in the sky (seconds)
const SMOKE_TAIL = 7;
const SMOKE_LIFE = 7;

const WHITE = new THREE.Color(1, 1, 1);
const FOAM = new THREE.Color(0.93, 0.97, 1.0);
const TIRE_SMOKE = new THREE.Color(0.86, 0.86, 0.84);
const SMOKE = new THREE.Color(0.97, 0.97, 0.97);
const DUST_LIGHTEN = new THREE.Color(0.85, 0.8, 0.7);
const _dust = new THREE.Color();
const _road = {height: 0, slopeX: 0, slopeZ: 0};
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _q = new THREE.Vector3();

let lastWater = null;
let lastWheels = null;
let lastY = null;
let fallRate = 0;
// Where each wake line was last laid down to
const lastStern = [new THREE.Vector3(), new THREE.Vector3()];
let settleTime = 0;
let dustTravel = 0;
let dustCheckTimer = 0;
let groundDust = null;
const _rollDust = new THREE.Color();
const skimLast = new THREE.Vector3();
const smokeLast = new THREE.Vector3();
let smokeOn = false;

const rand = (a, b) => a + Math.random() * (b - a);

// A point beside the plane: `side` units to its right, `back` behind it
function planePoint(side, back, y, out) {
  const h = planeGroup.rotation.y;
  const c = Math.cos(h);
  const s = Math.sin(h);
  out.set(
    planeGroup.position.x + c * side + s * back,
    y,
    planeGroup.position.z - s * side + c * back
  );
  return out;
}

// The plane's ground velocity (units/s) from its heading and speed
function planeVelocity(out) {
  const speed = (state.flightSpeedMultiplier || 0) * BASE_FLIGHT_SPEED * 60;
  const h = planeGroup.rotation.y;
  return out.set(-Math.sin(h) * speed, 0, -Math.cos(h) * speed);
}

// Whether (x, z) is paved: a runway, an apron or a road
function isPaved(x, z) {
  if (sampleRoad(x, z, _road)) return true;
  const L = ChillFlightLogic;
  return L.AIRPORTS.some((a) => {
    const {u, v} = L.airportLocal(a, x, z);
    const half = L.RUNWAY_WIDTH / 2;
    // The runway, and the apron beside it (airports.js createRunway)
    return (
      (Math.abs(u) <= L.RUNWAY_LENGTH / 2 && Math.abs(v) <= half) ||
      (Math.abs(u) <= 85 && v >= half && v <= half + 51)
    );
  });
}

// A sheet of spray thrown up and out from both pontoons, and a low mist
function splash(strength) {
  const half = GEAR_HALF_TRACK[activePlaneType] ?? 3;
  const sides = half > 0 ? [-1, 1] : [0];
  const fwd = planeVelocity(_v).clone().multiplyScalar(0.35);
  const count = Math.round(14 + strength * 26);
  for (const side of sides) {
    for (let i = 0; i < count; i++) {
      const along = rand(-PONTOON_STERN, PONTOON_STERN);
      planePoint(side * half, along, WATER_LEVEL + 0.5, _p);
      const out = rand(4, 14) * (0.5 + strength);
      const h = planeGroup.rotation.y;
      spawn(
        _p,
        {
          x: Math.cos(h) * side * out + fwd.x,
          y: rand(10, 26) * (0.4 + strength),
          z: -Math.sin(h) * side * out + fwd.z,
        },
        -45,
        rand(1.0, 1.6),
        rand(1.5, 2.5),
        rand(4, 7),
        WHITE,
        rand(0.7, 0.9)
      );
    }
  }
  for (let i = 0; i < 6 + strength * 6; i++) {
    planePoint(rand(-half - 2, half + 2), rand(-6, 8), WATER_LEVEL + 1.5, _p);
    spawn(
      _p,
      {x: fwd.x * 0.5, y: rand(1, 3), z: fwd.z * 0.5},
      0,
      rand(2.5, 3.5),
      rand(5, 8),
      rand(14, 20),
      WHITE,
      0.4
    );
  }
}

// Spray off the pontoons and two lines of foam spreading out behind them,
// which the moving plane leaves as a V. The foam is laid every
// WAKE_SPACING units along the path, so the lines stay unbroken at any
// frame rate.
function wake(delta, speed) {
  const half = GEAR_HALF_TRACK[activePlaneType] ?? 3;
  const sides = half > 0 ? [-1, 1] : [0];
  const fast = THREE.MathUtils.clamp(speed / 1.2, 0, 1);
  const h = planeGroup.rotation.y;
  sides.forEach((side, i) => {
    const stern = planePoint(side * half, PONTOON_STERN, WATER_LEVEL, _p);
    const last = lastStern[i];
    if (!last.valid || last.distanceTo(stern) > WAKE_SPACING * 20) {
      last.copy(stern);
      last.valid = true;
    }
    const steps = Math.floor(last.distanceTo(stern) / WAKE_SPACING);
    for (let k = 1; k <= steps; k++) {
      _q.lerpVectors(last, stern, k / steps);
      const spread = rand(7, 11);
      spawn(
        _q,
        {x: Math.cos(h) * side * spread, y: 0, z: -Math.sin(h) * side * spread},
        0,
        rand(3, 4.5),
        rand(4, 5),
        rand(12, 16),
        FOAM,
        0.8 * (0.5 + 0.5 * fast),
        true
      );
    }
    if (steps > 0) last.copy(stern);

    // Spray thrown off the bow, more of it the faster
    if (Math.random() < fast * delta * 20) {
      planePoint(side * half, rand(-6, -2), WATER_LEVEL + 0.5, _q);
      const out = rand(3, 8);
      spawn(
        _q,
        {
          x: Math.cos(h) * side * out,
          y: rand(4, 9) * fast,
          z: -Math.sin(h) * side * out,
        },
        -40,
        rand(0.5, 0.9),
        rand(1.2, 2),
        rand(3, 5),
        WHITE,
        0.5
      );
    }
  });
}

// A puff where each wheel touches down: grey tire smoke on a runway or the
// highway, dust the colour of the ground elsewhere
function touchdownPuff(strength) {
  const half = GEAR_HALF_TRACK[activePlaneType] ?? 2;
  const sides = half > 0 ? [-1, 1] : [0];
  const groundY =
    planeGroup.position.y - (state.airplaneModel?.wheelDepth ?? 3);
  const {x, z} = planeGroup.position;
  let color = TIRE_SMOKE;
  if (!isPaved(x, z)) {
    color = sampleGroundColor(x, z, _dust)
      ? _dust.lerp(DUST_LIGHTEN, 0.55)
      : DUST_LIGHTEN;
  }
  const fwd = planeVelocity(_v).clone().multiplyScalar(0.25);
  const count = Math.round(6 + strength * 14);
  for (const side of sides) {
    for (let i = 0; i < count; i++) {
      planePoint(
        side * half + rand(-0.6, 0.6),
        rand(-0.5, 1.5),
        groundY + 0.6,
        _p
      );
      spawn(
        _p,
        {x: fwd.x + rand(-3, 3), y: rand(1, 4), z: fwd.z + rand(-3, 3)},
        1.5,
        rand(1.8, 3),
        rand(1, 2),
        rand(5, 8) * (0.7 + strength * 0.6),
        color,
        rand(0.35, 0.6)
      );
    }
  }
}

// The colour of the dust under the plane (null when paved), looked up a
// few times a second while rolling
function groundDustColor() {
  dustCheckTimer -= 1;
  if (dustCheckTimer > 0) return groundDust;
  dustCheckTimer = 10;
  const {x, z} = planeGroup.position;
  if (isPaved(x, z)) {
    groundDust = null;
  } else {
    groundDust = sampleGroundColor(x, z, _rollDust)
      ? _rollDust.lerp(DUST_LIGHTEN, 0.65)
      : DUST_LIGHTEN;
  }
  return groundDust;
}

// Rolling on dirt or grass: a low trail of dust off the wheels, laid every
// DUST_SPACING units travelled, and the propeller's wash blowing dust back
// along the ground while the throttle is open at low speed
function rollingDust(delta, speed) {
  const color = groundDustColor();
  if (!color) return;
  const half = GEAR_HALF_TRACK[activePlaneType] ?? 2;
  const sides = half > 0 ? [-1, 1] : [0];
  const groundY =
    planeGroup.position.y - (state.airplaneModel?.wheelDepth ?? 3);
  const fast = THREE.MathUtils.clamp(speed / 0.6, 0, 1);
  const h = planeGroup.rotation.y;

  // Laid back along the path covered this frame, so the trail stays
  // unbroken at any frame rate
  dustTravel += speed * BASE_FLIGHT_SPEED * 60 * delta;
  const count = Math.min(12, Math.floor(dustTravel / DUST_SPACING));
  dustTravel -= count * DUST_SPACING;
  for (let k = 0; k < count; k++) {
    for (const side of sides) {
      planePoint(
        side * half + rand(-0.5, 0.5),
        k * DUST_SPACING + rand(0, 1.5),
        groundY + 0.5,
        _p
      );
      spawn(
        _p,
        {x: rand(-1.5, 1.5), y: rand(0.5, 2), z: rand(-1.5, 1.5)},
        1,
        rand(1.5, 2.5),
        rand(2, 3),
        rand(4, 6) * (0.7 + 0.6 * fast),
        color,
        0.25 + 0.25 * fast
      );
    }
  }

  // Prop wash: strongest with the throttle open and the plane still slow
  if (activePlaneType === 'glider') return;
  const throttle = THREE.MathUtils.clamp(state.targetFlightSpeed || 0, 0, 1);
  const wash = throttle * (1 - fast);
  if (Math.random() > wash * delta * 30) return;
  const props = activePlaneType === 'twin' ? [-1, 1] : [0];
  for (const side of props) {
    planePoint(side * half + rand(-1.5, 1.5), rand(1, 4), groundY + 0.4, _p);
    const back = rand(12, 22) * throttle;
    spawn(
      _p,
      {
        x: Math.sin(h) * back + rand(-3, 3),
        y: rand(0.5, 2),
        z: Math.cos(h) * back + rand(-3, 3),
      },
      0.5,
      rand(1, 1.6),
      rand(0.8, 1.4),
      rand(3.5, 6),
      color,
      0.35 * wash + 0.1
    );
  }
}

// Skimming: flying just over the water (not on it), the propeller's wash
// and the wingtip vortices kick up a rooster tail of spray behind the
// plane and leave a faint line of foam, both fading out by SKIM_HEIGHT
function skim(delta, speed) {
  const {x, y, z} = planeGroup.position;
  const height = y - WATER_LEVEL - (state.airplaneModel?.wheelDepth ?? 4);
  if (height > SKIM_HEIGHT || getElevation(x, z) > WATER_LEVEL + 0.1) {
    skimLast.valid = false;
    return;
  }
  const fast = THREE.MathUtils.clamp(speed / 1.2, 0, 1);
  const close = 1 - THREE.MathUtils.clamp(height / SKIM_HEIGHT, 0, 1);
  const strength = close * close * (0.3 + 0.7 * fast);
  const h = planeGroup.rotation.y;
  const fwd = planeVelocity(_v);

  // Foam laid along the path, like the wake
  const here = planePoint(0, 2, WATER_LEVEL, _p);
  if (!skimLast.valid || skimLast.distanceTo(here) > WAKE_SPACING * 20) {
    skimLast.copy(here);
    skimLast.valid = true;
  }
  const steps = Math.floor(skimLast.distanceTo(here) / WAKE_SPACING);
  for (let k = 1; k <= steps; k++) {
    _q.lerpVectors(skimLast, here, k / steps);
    spawn(
      _q,
      {x: rand(-2, 2), y: 0, z: rand(-2, 2)},
      0,
      rand(2.5, 3.5),
      rand(3, 4),
      rand(9, 13),
      FOAM,
      0.6 * strength,
      true
    );
  }
  if (steps > 0) skimLast.copy(here);

  // The rooster tail: spray thrown up and back, carried along a little
  // with the plane
  const count = Math.floor(strength * delta * 90 + Math.random());
  for (let i = 0; i < count; i++) {
    planePoint(rand(-3, 3), rand(2, 8), WATER_LEVEL + 0.3, _p);
    const out = rand(-6, 6);
    spawn(
      _p,
      {
        x: fwd.x * 0.3 + Math.cos(h) * out,
        y: rand(10, 22) * (0.5 + 0.5 * strength),
        z: fwd.z * 0.3 - Math.sin(h) * out,
      },
      -45,
      rand(0.9, 1.5),
      rand(1.5, 2.5),
      rand(4, 7),
      WHITE,
      rand(0.5, 0.8) * (0.4 + 0.6 * strength)
    );
  }
}

// Airshow smoke from the tail, laid along the flight path so it stays
// unbroken at any speed and frame rate; it hangs in the sky, spreading and
// drifting up a little, and fades over SMOKE_LIFE seconds
function smokeTrail(speed) {
  const tail = _p.set(0, 0, SMOKE_TAIL);
  planeGroup.localToWorld(tail);
  if (!smokeLast.valid || smokeLast.distanceTo(tail) > 200) {
    smokeLast.copy(tail);
    smokeLast.valid = true;
    return;
  }
  // Close enough that young puffs overlap; ~60 a second at cruise
  const spacing = Math.max(2.5, (speed * BASE_FLIGHT_SPEED * 60) / 60);
  const steps = Math.floor(smokeLast.distanceTo(tail) / spacing);
  for (let k = 1; k <= steps; k++) {
    _q.lerpVectors(smokeLast, tail, k / steps);
    spawn(
      _q,
      {x: rand(-2, 2), y: rand(-1, 1), z: rand(-2, 2)},
      0.4,
      rand(SMOKE_LIFE * 0.8, SMOKE_LIFE),
      rand(4, 5),
      rand(14, 20),
      SMOKE,
      0.65
    );
  }
  if (steps > 0) smokeLast.copy(tail);
}

/** Turns the airshow smoke on or off; returns whether it's now on. */
export function toggleSmoke() {
  smokeOn = !smokeOn;
  smokeLast.valid = false;
  return smokeOn;
}

/** Per frame: spawns the plane's effects and moves the pool's clock. */
export function updateParticles(delta) {
  if (state.isPaused || delta <= 0) return;
  uniforms.uTime.value += delta;
  const now = uniforms.uTime.value;

  // Darker at night, like the chimney smoke
  const light = 0.3 + 0.7 * THREE.MathUtils.clamp(state.dayFactor, 0, 1);
  uniforms.uLight.value.setRGB(light, light, light * 1.04);

  // Vertical speed (units/s, positive falling), smoothed
  const y = planeGroup.position.y;
  if (lastY !== null) {
    const rate = (lastY - y) / delta;
    fallRate += (rate - fallRate) * Math.min(1, delta * 4);
  }
  lastY = y;

  const onWater = state.isOnWater;
  const wheels = isOnWheels();
  const speed = Math.max(0, state.flightSpeedMultiplier || 0);
  // Ignore the spawn and teleports settling
  settleTime += delta;
  if (!state.isFreeCamera && settleTime > 2) {
    const impact = THREE.MathUtils.clamp(
      0.3 + fallRate / 60 + speed * 0.3,
      0,
      1
    );
    if (onWater && lastWater === false) splash(impact);
    if (wheels && lastWheels === false && !onWater) touchdownPuff(impact);
    if (onWater && speed > WAKE_MIN_SPEED) wake(delta, speed);
    if (wheels && !onWater) rollingDust(delta, speed);
    if (!wheels && !onWater) skim(delta, speed);
    else skimLast.valid = false;
    if (smokeOn) smokeTrail(speed);
  }
  if (!onWater) for (const last of lastStern) last.valid = false;
  lastWater = onWater;
  lastWheels = wheels;

  uploadSpawned();
  mesh.visible = now < allDeadAt;
}
