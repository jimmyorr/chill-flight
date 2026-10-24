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
import {BASE_FLIGHT_SPEED, UNITS_TO_M, WATER_LEVEL} from './constants.js';
import {
  VOLCANO_X,
  VOLCANO_Z,
  WATER_SWELL_GLSL,
  getElevation,
  waterUniforms,
  watercraftChunks,
} from './terrain-geometry.js';
import {
  sampleGroundColor,
  sampleRoad,
  volcanoCrater,
  waterfallFeet,
} from './terrain-chunks.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {isOnWheels} from './flight-physics.js';
import {ChillFlightLogic} from './chill-flight-logic.js';

// Room for four or more planes' smoke trails (~1,000 each), water spray, and
// environment effects
const POOL_SIZE = 8192;
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
    varying float vGlow;
    ${WATER_SWELL_GLSL}
    void main() {
      float t = uTime - aLife.x;
      float age = t / aLife.y;
      if (age < 0.0 || age > 1.0) {
        // Dead or not born: off screen
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        vColor = vec4(0.0);
        vGlow = 0.0;
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
      // Negative alpha: glows, unaffected by the light
      vGlow = aColor.a < 0.0 ? 1.0 : 0.0;
      vColor = vec4(
        aColor.rgb,
        abs(aColor.a) * smoothstep(0.0, 0.06 * min(aLife.y, 4.0), t) *
          pow(1.0 - age, 1.5)
      );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uLight;
    varying vec2 vUv;
    varying vec4 vColor;
    varying float vGlow;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float soft = 1.0 - d * d;
      if (soft <= 0.0) discard;
      vec3 light = mix(uLight, vec3(1.0), vGlow);
      gl_FragColor = vec4(vColor.rgb * light, vColor.a * soft * soft);
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
 * (negative falls); sizes in units; flat lays it on the water; glow keeps
 * it bright at night.
 */
function spawn(
  p,
  v,
  gravity,
  life,
  size0,
  size1,
  color,
  alpha,
  flat = false,
  glow = false
) {
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
  c[j + 3] = glow ? -alpha : alpha;
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
const GEAR_HALF_TRACK = {
  seaplane: 5,
  twin: 5.8,
  jet: 2.4,
  biplane: 1.8,
  buggy: 2.6,
};
// Where the pontoons end behind the plane's centre (units); the hovering
// buggy's folded back wheels are nearer
const PONTOON_STERN = {buggy: 3.6};
const DEFAULT_STERN = 7.5;
const sternOf = (type) => PONTOON_STERN[type] ?? DEFAULT_STERN;
// Below this speed on the water there's no spray or wake (speed multiplier)
const WAKE_MIN_SPEED = 0.08;
// How far apart the wake's foam is laid (units)
const WAKE_SPACING = 1.5;
// How far apart the rolling dust is laid (units)
const DUST_SPACING = 1.5;
// Skimming spray starts this far above the water (units, from the bottom of
// the plane)
const SKIM_HEIGHT = 20 / UNITS_TO_M; // 20 m on the altimeter
// Where the airshow smoke comes out, behind the plane's centre (units), and
// how long it hangs in the sky (seconds)
const SMOKE_TAIL = 7;
const SMOKE_LIFE = 18;
// Each plane's right wingtip (units, from its centre), for the vapour
const WINGTIPS = {
  biplane: [14.5, 2.9, -3],
  seaplane: [16, 2.8, -2.5],
  twin: [16.3, -0.2, 1],
  jet: [11, 0.8, 4],
};
const VAPOUR_SPACING = 1.5;
// Where the engines' exhausts are (units, from the plane's centre)
const EXHAUSTS = {
  biplane: [
    [-1.6, -0.6, -8.5],
    [1.6, -0.6, -8.5],
  ],
  seaplane: [
    [-1.6, -0.8, -9.5],
    [1.6, -0.8, -9.5],
  ],
  twin: [
    [-5.8, -0.6, -1.5],
    [5.8, -0.6, -1.5],
  ],
  jet: [
    [-1.1, -0.2, 14.2],
    [1.1, -0.2, 14.2],
  ],
  buggy: [
    [-0.6, 2.9, 4.1],
    [0.6, 2.9, 4.1],
  ],
};

// --- THE WORLD'S EFFECTS ---
// Boats, waterfalls and the volcano only spawn this near the plane (units)
const WORLD_RANGE = 3000;
const VOLCANO_RANGE = 7000;
// How far a boat moves between bits of its wake (units, sailboat size)
const BOAT_WAKE_SPACING = 3;
// Mist puffs a second at each waterfall
const MIST_RATE = 10;
// Embers and ash puffs a second from the volcano
const EMBER_RATE = 14;
const ASH_RATE = 2;
// How far the lava is below the crater's rim (units)
const CRATER_DEPTH = 450;

const WHITE = new THREE.Color(1, 1, 1);
const FOAM = new THREE.Color(0.93, 0.97, 1.0);
const EXHAUST = new THREE.Color(0.45, 0.45, 0.45);
const EMBER = new THREE.Color(1.0, 0.45, 0.12);
const ASH = new THREE.Color(0.55, 0.53, 0.52);
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
let vapour = 0;
const vapourLast = [new THREE.Vector3(), new THREE.Vector3()];
let lastTarget = null;

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
      const stern = sternOf(activePlaneType);
      const along = rand(-stern, stern);
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
    const stern = planePoint(
      side * half,
      sternOf(activePlaneType),
      WATER_LEVEL,
      _p
    );
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
      const bow = sternOf(activePlaneType);
      planePoint(side * half, rand(-0.8, -0.27) * bow, WATER_LEVEL + 0.5, _q);
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
  if (activePlaneType === 'buggy' || activePlaneType === 'jet') return;
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

// The buggy sliding (state.buggySlide, from buggy.js): smoke off the rear
// tyres on paving, or a thick plume of dust on dirt
function slideSmoke(delta) {
  const slide = state.buggySlide || 0;
  if (slide < 0.15) return;
  const groundY =
    planeGroup.position.y - (state.airplaneModel?.wheelDepth ?? 0);
  const fwd = planeVelocity(_v);
  const color = groundDustColor() || TIRE_SMOKE;
  const count = Math.floor(slide * delta * 70 + Math.random());
  for (let i = 0; i < count; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    planePoint(
      side * 2.65 + rand(-0.4, 0.4),
      rand(2.5, 3.5),
      groundY + 0.6,
      _p
    );
    spawn(
      _p,
      {
        x: fwd.x * 0.15 + rand(-2, 2),
        y: rand(1, 3),
        z: fwd.z * 0.15 + rand(-2, 2),
      },
      1,
      rand(1.4, 2.4),
      rand(1.5, 2.5),
      rand(6, 10) * (0.6 + 0.4 * slide),
      color,
      rand(0.3, 0.5) * slide
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
  // Square root so the spray is still clear well up toward SKIM_HEIGHT
  const strength = Math.sqrt(close) * (0.3 + 0.7 * fast);
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
      // The foam line only shows down low
      0.6 * close * close * strength,
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

// Airshow smoke from the tail of `plane` (the player's, or a friend's when
// flying together), laid along the flight path from `last` so it stays
// unbroken at any speed and frame rate; it hangs in the sky, spreading and
// drifting up a little, and fades over SMOKE_LIFE seconds. `spread` lays
// the puffs further apart.
function smokeTrail(plane, last, speed, color, spread = 1) {
  const tail = _p.set(0, 0, SMOKE_TAIL);
  plane.localToWorld(tail);
  if (!last.valid || last.distanceTo(tail) > 200) {
    last.copy(tail);
    last.valid = true;
    return;
  }
  // Close enough that young puffs overlap; ~60 a second at cruise, so a
  // full trail is ~1,000 of the pool
  const spacing = Math.max(2.5, (speed * BASE_FLIGHT_SPEED * 60) / 60) * spread;
  const steps = Math.floor(last.distanceTo(tail) / spacing);
  for (let k = 1; k <= steps; k++) {
    _q.lerpVectors(last, tail, k / steps);
    spawn(
      _q,
      {x: rand(-2, 2), y: rand(-1, 1), z: rand(-2, 2)},
      0.4,
      rand(SMOKE_LIFE * 0.8, SMOKE_LIFE),
      rand(6, 7),
      rand(22, 30),
      color,
      0.8
    );
  }
  if (steps > 0) last.copy(tail);
}

// Flying together tints everyone's smoke with their livery, half and half
// with white so it stays soft (setSmokeTint)
const smokeTint = new THREE.Color();
let tinted = false;

/** The smoke colour for a livery (hex), or white when `livery` is null. */
export function smokeColor(livery, out = new THREE.Color()) {
  if (livery === null) return out.copy(SMOKE);
  return out.set(livery).lerp(WHITE, 0.5);
}

/** Tints the player's smoke with a livery (hex), or back to white (null). */
export function setSmokeTint(livery) {
  tinted = livery !== null;
  smokeColor(livery, smokeTint);
}

/** Whether the player's airshow smoke is on. */
export function isSmokeOn() {
  return smokeOn || !!state.mpForceSmoke;
}

/**
 * A friend's smoke for this frame, from their plane (an Object3D) since
 * `last` (a Vector3 kept per plane; set last.valid = false to start afresh).
 */
export function trailSmoke(plane, last, speed, color) {
  if (state.isPaused) return;
  smokeTrail(plane, last, speed, color, 1.5);
}

// Wingtip vapour: thin white streaks off the wingtips while pulling hard
// (loops, Immelmanns and sharp turns), fading in and out with the pull
function wingtipVapour(delta, speed) {
  const pull =
    state.isLooping || state.isDoingImmelmann ? 1 : state.sharpTurnAmount;
  const target = pull * THREE.MathUtils.clamp(speed / 0.8, 0, 1);
  vapour += (target - vapour) * Math.min(1, delta * 3);
  if (vapour < 0.05) {
    for (const last of vapourLast) last.valid = false;
    return;
  }
  const [x, y, z] = WINGTIPS[activePlaneType] ?? WINGTIPS.seaplane;
  [-1, 1].forEach((side, i) => {
    const tip = planeGroup.localToWorld(_p.set(side * x, y, z));
    const last = vapourLast[i];
    if (!last.valid || last.distanceTo(tip) > 200) {
      last.copy(tip);
      last.valid = true;
      return;
    }
    const steps = Math.floor(last.distanceTo(tip) / VAPOUR_SPACING);
    for (let k = 1; k <= steps; k++) {
      _q.lerpVectors(last, tip, k / steps);
      spawn(
        _q,
        {x: rand(-0.5, 0.5), y: rand(-0.5, 0.5), z: rand(-0.5, 0.5)},
        0,
        rand(0.6, 0.9),
        1.6,
        rand(2.5, 3.5),
        WHITE,
        0.4 * vapour
      );
    }
    if (steps > 0) last.copy(tip);
  });
}

// A cough of grey smoke from the exhausts as the engine starts
function engineStartPuff() {
  for (const [x, y, z] of EXHAUSTS[activePlaneType] ?? []) {
    for (let i = 0; i < 10; i++) {
      planeGroup.localToWorld(_p.set(x, y, z));
      _v.set(Math.sign(x) * rand(2, 6), rand(0, 3), rand(4, 12));
      _v.transformDirection(planeGroup.matrixWorld).multiplyScalar(rand(4, 9));
      spawn(
        _p,
        _v,
        1.5,
        rand(1.6, 2.6),
        rand(2, 3),
        rand(6, 9),
        EXHAUST,
        rand(0.35, 0.55)
      );
    }
  }
}

function nearPlane(x, z, range) {
  const dx = x - planeGroup.position.x;
  const dz = z - planeGroup.position.z;
  return dx * dx + dz * dz < range * range;
}

// Foam spreading in a V behind the boats as they drift and patrol, laid as
// they move (flight-camera.js works out where they are)
function boatWake(boats, scale) {
  if (!boats) return;
  for (const b of boats) {
    if (b.worldX === undefined || b.sunk) continue;
    if (b.wakeX === undefined) {
      b.wakeX = b.worldX;
      b.wakeZ = b.worldZ;
      continue;
    }
    const dx = b.worldX - b.wakeX;
    const dz = b.worldZ - b.wakeZ;
    const d = Math.hypot(dx, dz);
    if (d < BOAT_WAKE_SPACING * scale) continue;
    b.wakeX = b.worldX;
    b.wakeZ = b.worldZ;
    // A jump (far boats only move every few frames)
    if (d > 50 * scale) continue;
    const fx = dx / d;
    const fz = dz / d;
    for (const side of [-1, 1]) {
      // From the corners of the stern, spreading out
      _p.set(
        b.worldX - (fx * 7 + fz * side * 2.5) * scale,
        WATER_LEVEL,
        b.worldZ - (fz * 7 - fx * side * 2.5) * scale
      );
      const out = rand(4, 7) * scale;
      spawn(
        _p,
        {x: -fz * side * out, y: 0, z: fx * side * out},
        0,
        rand(7, 10),
        rand(2.5, 3.5) * scale,
        rand(9, 13) * scale,
        FOAM,
        0.5,
        true
      );
    }
  }
}

// Every boat near the plane
function boatWakes() {
  for (const chunk of watercraftChunks) {
    const wp = chunk.userData.worldPosition;
    if (!wp || !nearPlane(wp.x, wp.z, WORLD_RANGE)) continue;
    boatWake(chunk.userData.sailboatPositions, 1);
    boatWake(chunk.userData.pirateShipPositions, 1.4);
  }
}

// Mist rolling out and up from where each waterfall lands
function waterfallMist(delta) {
  for (const foot of waterfallFeet.values()) {
    if (!nearPlane(foot.x, foot.z, WORLD_RANGE)) continue;
    const count = Math.floor(delta * MIST_RATE + Math.random());
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * foot.half;
      _p.set(
        foot.x + Math.cos(a) * r,
        WATER_LEVEL + 2,
        foot.z + Math.sin(a) * r
      );
      const out = rand(15, 30);
      spawn(
        _p,
        {x: Math.cos(a) * out, y: rand(15, 30), z: Math.sin(a) * out},
        3,
        rand(5, 7),
        foot.size * 0.2,
        foot.size * rand(0.7, 0.9),
        WHITE,
        0.5
      );
    }
  }
}

// Glowing embers rising out of the volcano's crater, and puffs of ash
// drifting off the top
function volcanoEffects(delta) {
  if (volcanoCrater.y === null) return;
  if (!nearPlane(VOLCANO_X, VOLCANO_Z, VOLCANO_RANGE)) return;
  const lava = volcanoCrater.y;
  let count = Math.floor(delta * EMBER_RATE + Math.random());
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(0, 100);
    _p.set(
      VOLCANO_X + Math.cos(a) * r,
      lava + rand(CRATER_DEPTH * 0.4, CRATER_DEPTH),
      VOLCANO_Z + Math.sin(a) * r
    );
    const out = rand(5, 20);
    spawn(
      _p,
      {x: Math.cos(a) * out, y: rand(30, 60), z: Math.sin(a) * out},
      25,
      rand(5, 8),
      rand(16, 24),
      rand(5, 8),
      EMBER,
      0.95,
      false,
      true
    );
  }
  count = Math.floor(delta * ASH_RATE + Math.random());
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(0, 100);
    _p.set(
      VOLCANO_X + Math.cos(a) * r,
      lava + CRATER_DEPTH,
      VOLCANO_Z + Math.sin(a) * r
    );
    spawn(
      _p,
      {x: rand(10, 20), y: rand(15, 25), z: rand(-5, 5)},
      2,
      rand(14, 20),
      rand(60, 90),
      rand(250, 350),
      ASH,
      0.4
    );
  }
}

/** Turns the airshow smoke on or off; returns whether it's now on. */
// Puffs off a prop knocked over (breakables.js): `count` of them, `color`,
// scattered within `spread` of (x, z) and from y up to y + height, drifting
// up to `rise` units/s
export function propPuffs(
  x,
  y,
  z,
  spread,
  height,
  color,
  count,
  size = 4,
  rise = 3
) {
  for (let i = 0; i < count; i++) {
    _p.set(
      x + rand(-spread, spread),
      y + rand(0, height),
      z + rand(-spread, spread)
    );
    spawn(
      _p,
      {x: rand(-4, 4), y: rand(0.5, rise), z: rand(-4, 4)},
      0.5,
      rand(2, 3.5),
      size * rand(0.4, 0.7),
      size * rand(1.2, 1.8),
      color,
      rand(0.35, 0.6)
    );
  }
}

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
    if (activePlaneType === 'buggy' && !onWater) slideSmoke(delta);
    if (!wheels && !onWater) skim(delta, speed);
    else skimLast.valid = false;
    if (isSmokeOn()) {
      smokeTrail(planeGroup, smokeLast, speed, tinted ? smokeTint : SMOKE);
    } else {
      smokeLast.valid = false;
    }
    if (!wheels && !onWater) wingtipVapour(delta, speed);
    else vapour = 0;
    const target = state.targetFlightSpeed || 0;
    if (lastTarget === 0 && target > 0 && speed < 0.05) engineStartPuff();
    lastTarget = target;
  }
  boatWakes();
  waterfallMist(delta);
  volcanoEffects(delta);
  if (!onWater) for (const last of lastStern) last.valid = false;
  lastWater = onWater;
  lastWheels = wheels;

  uploadSpawned();
  mesh.visible = now < allDeadAt;
}
