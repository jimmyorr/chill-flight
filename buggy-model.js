// --- BUGGY MODEL ---
// A single-seat dune buggy: livery-coloured tub and fenders, a dark roll
// cage over an empty seat (no visible driver, like the planes), the engine
// out back and four chunky tyres.
// The origin is on the ground between the axles, forward is -Z, as for the
// planes. Moving parts for buggy.js: `wheels` (spin about X, and fold flat
// to hover over water, setBuggyHoverFold), `steerPivots` (the front wheels'
// pivots, turned about Y) and `body` (everything the springs carry, bounced
// and leaned).
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMaterial} from './constants.js';
import {state} from './state.js';

export const BUGGY_WHEEL_RADIUS = 1.45;
// Front and rear axles (z), and the wheels' distance either side (x)
const FRONT_AXLE = -3.3;
const REAR_AXLE = 2.9;
const HALF_TRACK = 2.5;
// How far the wheels move out and down as they fold flat to hover
const HOVER_OUT = 0.8;
const HOVER_DROP = 0.5;
// Axle to axle, for the steering (buggy.js)
export const BUGGY_WHEELBASE = REAR_AXLE - FRONT_AXLE;

// A box of the given size centred on (x, y, z), tipped by rx about X
function box(w, h, d, x, y, z, rx = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (rx) geo.rotateX(rx);
  geo.translate(x, y, z);
  return geo;
}

// A round tube from point a to point b
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
function tube(a, b, radius = 0.13) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  _dir.subVectors(end, start);
  const geo = new THREE.CylinderGeometry(radius, radius, _dir.length(), 6);
  _quat.setFromUnitVectors(_up, _dir.normalize());
  geo.applyQuaternion(_quat);
  geo.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2
  );
  return geo;
}

// A tyre with a light hub and a bar across it, so the spin shows
function createWheel(width, tyreMat, hubMat) {
  const wheel = new THREE.Group();
  const tyreGeo = new THREE.CylinderGeometry(
    BUGGY_WHEEL_RADIUS,
    BUGGY_WHEEL_RADIUS,
    width,
    14
  );
  tyreGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(tyreGeo, tyreMat));
  const hubGeo = new THREE.CylinderGeometry(0.62, 0.62, width + 0.06, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const barGeo = new THREE.BoxGeometry(width + 0.1, 0.26, 1.15);
  wheel.add(new THREE.Mesh(mergeGeometries([hubGeo, barGeo]), hubMat));
  return wheel;
}

// Folds the wheels flat like a hovercraft's pads (fold 1) or back down onto
// their treads (fold 0). Each tips over about its hub, moving out and down
// clear of the tub, and the spin about X stays about the axle, so a folded
// wheel turns like a fan.
export function setBuggyHoverFold(model, fold) {
  if (!model.wheels || model.hoverFold === fold) return;
  model.hoverFold = fold;
  const t = fold * fold * (3 - 2 * fold);
  for (const wheel of model.wheels) {
    const {side, baseX, baseY} = wheel.userData;
    wheel.rotation.order = 'ZXY';
    wheel.rotation.z = side * t * (Math.PI / 2);
    wheel.position.x = baseX + side * HOVER_OUT * t;
    wheel.position.y = baseY - HOVER_DROP * t;
  }
}

export function createBuggyModel(opts = {}) {
  const root = new THREE.Group();

  const planeColor =
    opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0xe0564c;
  const whiteColor = planeColor === 0xe8c382 ? 0x1c3144 : 0xf8fafc;

  const accentMat =
    opts.planeMat ||
    createMaterial({color: planeColor, flatShading: true, roughness: 0.5});
  const lightMat =
    opts.planeWhiteMat ||
    createMaterial({color: whiteColor, flatShading: true, roughness: 0.5});
  const darkMat = createMaterial({
    color: 0x2a2a2e,
    flatShading: true,
    roughness: 0.8,
  });
  const lensMat = createMaterial({color: 0xfff1b8, flatShading: true});

  // Everything on the springs, one mesh per material
  const body = new THREE.Group();
  root.add(body);

  const accent = [
    // Floor pan, the sloping nose and the side pods
    box(3.6, 0.5, 7.0, 0, 1.95, -0.2),
    box(3.2, 0.8, 2.4, 0, 2.45, -3.3, -0.22),
    box(0.5, 0.9, 3.4, -1.75, 2.55, 0.3),
    box(0.5, 0.9, 3.4, 1.75, 2.55, 0.3),
    // Front fenders over the wheels
    box(1.3, 0.18, 2.4, -HALF_TRACK, 3.1, FRONT_AXLE, 0.08),
    box(1.3, 0.18, 2.4, HALF_TRACK, 3.1, FRONT_AXLE, 0.08),
  ];
  body.add(new THREE.Mesh(mergeGeometries(accent), accentMat));

  const dark = [
    // Bumpers, the engine and the seat
    box(4.0, 0.4, 0.45, 0, 1.95, -4.65),
    box(3.4, 0.4, 0.45, 0, 2.0, 3.55),
    box(2.4, 1.2, 1.7, 0, 2.75, 2.55),
    box(1.7, 0.45, 1.5, 0, 2.4, 0.6),
    box(1.7, 1.9, 0.35, 0, 3.25, 1.35, 0.18),
    // Steering wheel
    box(1.0, 0.16, 0.16, 0, 3.55, -0.75),
    box(0.16, 0.7, 0.16, 0, 3.4, -0.85, 0.5),
    // Roll cage: front hoop, roof rails, main hoop behind the seat and its
    // braces down to the back
    tube([-1.55, 2.4, -1.9], [-1.3, 5.1, -0.3]),
    tube([1.55, 2.4, -1.9], [1.3, 5.1, -0.3]),
    tube([-1.3, 5.1, -0.3], [1.3, 5.1, -0.3]),
    tube([-1.3, 5.1, -0.3], [-1.3, 5.1, 1.6]),
    tube([1.3, 5.1, -0.3], [1.3, 5.1, 1.6]),
    tube([-1.45, 2.4, 1.6], [-1.3, 5.1, 1.6]),
    tube([1.45, 2.4, 1.6], [1.3, 5.1, 1.6]),
    tube([-1.3, 5.1, 1.6], [1.3, 5.1, 1.6]),
    tube([-1.3, 5.1, 1.6], [-1.2, 2.5, 3.4]),
    tube([1.3, 5.1, 1.6], [1.2, 2.5, 3.4]),
  ];
  body.add(new THREE.Mesh(mergeGeometries(dark), darkMat));

  const light = [
    // Exhaust pipes
    tube([-0.6, 2.6, 3.3], [-0.6, 2.9, 4.1], 0.16),
    tube([0.6, 2.6, 3.3], [0.6, 2.9, 4.1], 0.16),
  ];
  body.add(new THREE.Mesh(mergeGeometries(light), lightMat));

  const lenses = [
    box(0.7, 0.45, 0.2, -1.05, 2.75, -4.5),
    box(0.7, 0.45, 0.2, 1.05, 2.75, -4.5),
  ];
  body.add(new THREE.Mesh(mergeGeometries(lenses), lensMat));

  // Wheels: the front pair turn on pivots, the back ones are a bit wider
  const wheels = [];
  const steerPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * HALF_TRACK, BUGGY_WHEEL_RADIUS, FRONT_AXLE);
    const front = createWheel(1.1, darkMat, lightMat);
    front.userData = {side, baseX: 0, baseY: 0};
    pivot.add(front);
    root.add(pivot);
    steerPivots.push(pivot);
    wheels.push(front);

    const rear = createWheel(1.4, darkMat, lightMat);
    rear.position.set(
      side * (HALF_TRACK + 0.15),
      BUGGY_WHEEL_RADIUS,
      REAR_AXLE
    );
    rear.userData = {side, baseX: rear.position.x, baseY: rear.position.y};
    root.add(rear);
    wheels.push(rear);
  }

  root.body = body;
  root.wheels = wheels;
  root.steerPivots = steerPivots;
  root.isBuggy = true;
  // The follow camera sits closer behind something this small, and the
  // first-person view is from the driver's seat (flight-camera.js)
  root.cameraScale = 0.45;
  root.firstPersonEye = new THREE.Vector3(0, 4.6, -0.3);
  return root;
}
