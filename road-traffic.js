// --- ROAD TRAFFIC ---
// A few buggies driving the highways, as the air traffic flies the sky
// (traffic.js). Each appears on a highway near the player, keeps to the
// right-hand lane, slows for bends, the car ahead and the player on the
// road, turns round where its highway ends, and is removed once it's well
// behind (road-traffic-logic.js has the driving). At night they drive with
// headlights (a glow at each lamp and a pool of light on the road ahead)
// and dim red tail lights, which brighten when they brake. Hidden with the
// air traffic (zen mode, ?traffic=0).
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {MOUNTAIN_LEVEL, WATER_LEVEL} from './constants.js';
import {state} from './state.js';
import {scene} from './scene.js';
import {camera} from './sky.js';
import {planeGroup, activePlaneType} from './airplane.js';
import {simplex} from './noise.js';
import {BUGGY_WHEEL_RADIUS} from './buggy-model.js';
import {buildPlaneModel, isLiveryMaterial} from './plane-models.js';
import {
  ROAD_VEHICLES,
  ROAD_VEHICLE_SCALE,
  buildRoadVehicle,
  cloneRoadVehicle,
} from './road-vehicles.js';
import {sampleRoad} from './terrain-chunks.js';
import {trafficEnabled} from './traffic.js';
import {
  brakeLightsOn,
  isRoadCarGone,
  spawnRoadCar,
  stepRoadCar,
} from './road-traffic-logic.js';

const MAX_CARS = 4;
// Seconds between building one more vehicle model in the background, until
// every kind has been built in this many paint schemes
const BUILD_EVERY = 0.4;
const SCHEMES_PER_KIND = 2;
// Seconds before the next car appears while there's room
const SPAWN_DELAY_MIN = 3;
const SPAWN_DELAY_MAX = 10;
const FIRST_SPAWN_DELAY = 2;
// Past this the buggy itself is a speck: only its lights are drawn
const MODEL_RANGE = 1600;
// Faster than this between frames is a teleport, not driving or flight
const MAX_TRACKED_SPEED = 400;

const L = ChillFlightLogic;
const CONSTANTS = {WATER_LEVEL, MOUNTAIN_LEVEL};
const _road = {};
const roads = {
  near(x, z) {
    const out = [];
    const n0 = Math.round((x - L.ROAD_BASE_X) / L.ROAD_SPACING);
    for (let n = n0 - 1; n <= n0 + 1; n++) {
      if (n < 0 || n > L.ROAD_LAST) continue;
      out.push({n, along: z});
    }
    if (x > L.ROAD_EW_WEST && x < L.ROAD_EW_END) {
      out.push({n: L.ROAD_EW, along: x});
    }
    const east = L.eastRoadNear(x, z, 3000);
    if (east) out.push({n: east.n, along: east.along});
    for (const c of L.coastRoadsNear(x, z, 3000)) {
      out.push({n: c.n, along: c.along});
    }
    return out;
  },
  center: (n, along) => L.roadCenter(n, along),
  point: (n, along, across, out) => L.roadPoint(n, along, across, out),
  runs: (n, along) => L.highwayRunsAt(n, along, simplex, CONSTANTS),
  surface(x, z, y) {
    if (!sampleRoad(x, z, _road, y)) return null;
    return _road;
  },
};

const cars = [];
let spawnTimer = FIRST_SPAWN_DELAY;
const lastCenter = new THREE.Vector3();
const velocity = new THREE.Vector3();
let hasLastCenter = false;

// --- LIGHTS ---
// A white texture whose alpha is alphaAt(x, y) (pixel centres, y down as on
// a canvas). Written
// directly, not drawn as a canvas gradient: Safari dithers canvas gradients,
// and its premultiplied canvas turns the faint dithered edge of a glow into
// texels of strong, random colour once un-premultiplied for WebGL. Stretched
// over a headlight pool on the road they showed as coloured polka dots.
function alphaTexture(w, h, alphaAt) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((h - 1 - y) * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(
        255 * THREE.MathUtils.clamp(alphaAt(x + 0.5, y + 0.5), 0, 1)
      );
    }
  }
  const tex = new THREE.DataTexture(data, w, h);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Glows of a fixed size on screen (as the planes' navigation lights), so a
// car far off at night is still a pair of lights
function glowTexture() {
  const size = 32;
  const h = size / 2;
  return alphaTexture(size, size, (x, y) => {
    const r = Math.hypot(x - h, y - h) / h;
    // (the stops of the old canvas gradient: 1 at the middle, 0.6 at 0.35)
    return r < 0.35 ? 1 - (0.4 * r) / 0.35 : 0.6 * Math.max(0, (1 - r) / 0.65);
  });
}
const glow = glowTexture();
// Additive, except the tail lights: red added to daylight barely shows, so
// they're painted over it (a brake light still shows by day)
const glowMat = (color, additive = true) =>
  new THREE.SpriteMaterial({
    map: glow,
    color,
    transparent: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    sizeAttenuation: false,
    opacity: 0,
  });
// Headlights are shared (they're on together at night); tail lights are
// each car's own, since each brakes on its own
const headMat = glowMat(0xfff1c8);
const HEAD_SIZE = 0.016;
const TAIL_SIZE = 0.009;
const BRAKE_SIZE = 0.015;
// Tail lights at night, and how bright braking makes them (day or night)
const TAIL_NIGHT = 0.45;
const TAIL_BRAKE = 0.6;
// The lamps' and lenses' places on the buggy (buggy-model.js)
const HEAD_X = 0.95;
const HEAD_Y = 2.65;
const HEAD_Z = -4.55;
const TAIL_X = 1.05;
const TAIL_Y = 2.75;
const TAIL_Z = 3.8;

// The pool of light the headlights throw on the road ahead: a soft oval,
// brightest near the car
function poolTexture() {
  const w = 32;
  const h = 64;
  return alphaTexture(w, h, (x, y) => {
    // An oval 2.2 times as long as it's wide, centred 80% of the way down
    const r = Math.hypot(x - w / 2, (y - h * 0.8) / 2.2) / (w / 2);
    if (r >= 1) return 0;
    return r < 0.5 ? 0.9 - 1.1 * r : 0.35 * (1 - r) * 2;
  });
}
const POOL_WIDTH = 18;
const POOL_LENGTH = 40;
const POOL_OPACITY = 0.4;
const poolGeo = new THREE.PlaneGeometry(POOL_WIDTH, POOL_LENGTH);
poolGeo.rotateX(-Math.PI / 2);
// Its bright end just in front of the bumper
poolGeo.translate(0, 0.35, HEAD_Z - POOL_LENGTH * 0.3);
const poolMat = new THREE.MeshBasicMaterial({
  map: poolTexture(),
  color: 0xffe9b8,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  opacity: 0,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  fog: true,
});

const SHARED = new Set([headMat, poolMat]);

function addGlow(group, mat, size, x, y, z) {
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  sprite.position.set(x, y, z);
  group.add(sprite);
  return sprite;
}

// Vehicles built so far, and the ones still to build (each kind in a couple
// of its paint schemes, in random order)
const built = [];
const toBuild = [];
for (const kind of ROAD_VEHICLES) {
  const schemes = [...kind.colorways].sort(() => Math.random() - 0.5);
  for (const colorway of schemes.slice(0, SCHEMES_PER_KIND)) {
    toBuild.push({kind, colorway});
  }
}
toBuild.sort(() => Math.random() - 0.5);
let buildTimer = BUILD_EVERY;

function buildNextVehicle() {
  const next = toBuild.pop();
  if (next) built.push(buildRoadVehicle(next.kind, next.colorway));
}

// A random built vehicle, by the kinds' weights (null before any is built)
function pickVehicle() {
  let total = 0;
  for (const b of built) total += b.kind.weight / SCHEMES_PER_KIND;
  let r = Math.random() * total;
  for (const b of built) {
    r -= b.kind.weight / SCHEMES_PER_KIND;
    if (r <= 0) return b;
  }
  return built[built.length - 1] || null;
}

function buildCar(car) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const vehicle = pickVehicle();
  let model;
  // Where its lamps are (the buggy's, or from the vehicle's size), and its
  // wheel radius
  let head = {x: HEAD_X, y: HEAD_Y, z: HEAD_Z};
  let tail = {x: TAIL_X, y: TAIL_Y, z: TAIL_Z};
  let wheelRadius = BUGGY_WHEEL_RADIUS;
  if (vehicle) {
    // Facing -z, like the buggy
    const S = ROAD_VEHICLE_SCALE;
    model = cloneRoadVehicle(vehicle);
    model.scale.setScalar(S);
    model.rotation.y = Math.PI;
    const b = vehicle.box;
    const lampY = Math.min(0.8, (b.max.y - b.min.y) * 0.38) * S;
    head = {x: b.max.x * 0.72 * S, y: lampY, z: -b.max.z * S};
    tail = {x: b.max.x * 0.75 * S, y: lampY, z: -b.min.z * S};
    const w = model.wheels[0];
    wheelRadius = (w ? w.position.y || 0.33 : 0.33) * S;
    car.vehicle = vehicle.kind.name;
  } else {
    model = buildPlaneModel('buggy', car.livery);
  }
  group.add(model);

  // The lenses glow brighter at night, the tail lenses when braking too
  let headLens = null;
  let tailLens = null;
  model.traverse((child) => {
    const m = child.material;
    if (!m?.emissive) return;
    if (m.emissive.getHex() === 0xffd54f) headLens = m;
    else if (m.emissive.getHex() === 0xb71c1c) tailLens = m;
  });

  for (const side of [-1, 1]) {
    addGlow(group, headMat, HEAD_SIZE, side * head.x, head.y, head.z);
  }
  const tailMat = glowMat(0xff2a1a, false);
  const tails = [-1, 1].map((side) =>
    addGlow(group, tailMat, TAIL_SIZE, side * tail.x, tail.y, tail.z)
  );
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.z = head.z - HEAD_Z;
  pool.renderOrder = 1;
  group.add(pool);

  group.userData = {
    model,
    tailMat,
    tails,
    pool,
    headLens,
    tailLens,
    wheelRadius,
    shared: !!vehicle,
  };
  scene.add(group);
  return group;
}

function disposeCar(group) {
  scene.remove(group);
  group.userData.tailMat.dispose();
  // A built vehicle's copies share its geometry and material
  if (group.userData.shared) return;
  group.userData.model.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (
      child.material &&
      !SHARED.has(child.material) &&
      !isLiveryMaterial(child.material)
    ) {
      child.material.dispose();
    }
  });
}

function removeAll() {
  for (const c of cars) disposeCar(c.group);
  cars.length = 0;
  spawnTimer = FIRST_SPAWN_DELAY;
}

// Each car driving now, for bumps (bumps.js): fn(car), a road-traffic-logic
// car {x, y, z, heading, speed, ...}
export function forEachRoadCar(fn) {
  for (const c of cars) fn(c);
}

// How many cars are driving now (for the debug panel)
export function roadCarCount() {
  return cars.length;
}

const _pos = new THREE.Vector3();

// Called once per frame while flying (not while paused)
export function updateRoadTraffic(delta) {
  if (!trafficEnabled()) {
    if (cars.length) removeAll();
    return;
  }
  const center = state.isFreeCamera ? camera.position : planeGroup.position;
  if (hasLastCenter && delta > 0) {
    velocity.subVectors(center, lastCenter).divideScalar(delta);
    if (velocity.length() > MAX_TRACKED_SPEED) velocity.set(0, 0, 0);
  }
  lastCenter.copy(center);
  hasLastCenter = true;

  buildTimer -= delta;
  if (buildTimer <= 0 && toBuild.length) {
    buildTimer = BUILD_EVERY;
    buildNextVehicle();
  }

  spawnTimer -= delta;
  if (spawnTimer <= 0) {
    spawnTimer =
      SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
    if (cars.length < MAX_CARS) {
      const car = spawnRoadCar(
        Math.random,
        center.x,
        center.z,
        roads,
        L.PLANE_COLORS.length,
        cars
      );
      if (car) {
        car.group = buildCar(car);
        cars.push(car);
      }
    }
  }

  // The player's plane or buggy, for cars to slow behind on the road (a
  // plane low over the road counts too)
  const player = state.isFreeCamera
    ? null
    : {
        x: center.x,
        y: center.y + (activePlaneType === 'buggy' ? 0 : -2),
        z: center.z,
        vx: velocity.x,
        vz: velocity.z,
      };

  const night = 1 - THREE.MathUtils.smoothstep(state.dayFactor, 0.3, 0.8);
  headMat.opacity = night;
  poolMat.opacity = night * POOL_OPACITY;
  headMat.visible = poolMat.visible = night > 0.001;

  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i];
    stepRoadCar(car, delta, roads, cars, player);
    if (isRoadCarGone(car, center.x, center.z)) {
      disposeCar(car.group);
      cars.splice(i, 1);
      continue;
    }
    const g = car.group;
    const u = g.userData;
    g.position.set(car.x, car.y, car.z);
    g.rotation.set(car.pitch, car.heading, 0);
    g.visible = car.grounded;
    u.model.visible =
      camera.position.distanceToSquared(_pos.set(car.x, car.y, car.z)) <
      MODEL_RANGE * MODEL_RANGE;
    if (u.model.visible) {
      const roll = (car.speed * delta) / u.wheelRadius;
      // The buggy faces -z; built vehicles face +z inside the group
      const spin = u.shared ? roll : -roll;
      for (const wheel of u.model.wheels) wheel.rotation.x += spin;
      for (const pivot of u.model.steerPivots) pivot.rotation.y = car.steer;
    }

    const braking = brakeLightsOn(car) ? car.brake : 0;
    u.tailMat.opacity = Math.min(1, night * TAIL_NIGHT + braking * TAIL_BRAKE);
    const size = TAIL_SIZE + (BRAKE_SIZE - TAIL_SIZE) * braking;
    for (const s of u.tails) s.scale.set(size, size, 1);
    if (u.headLens) u.headLens.emissiveIntensity = 0.35 + night * 1.2;
    if (u.tailLens) {
      u.tailLens.emissiveIntensity = 0.3 + night * 0.5 + braking * 1.2;
    }
  }
}
