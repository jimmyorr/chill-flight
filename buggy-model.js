// --- BUGGY MODEL ---
// A single-seat dune buggy: livery-coloured tub and arched fenders, visible
// A-arm suspension and coilover shocks, a dark roll cage over a bucket seat
// and round steering wheel, round bucket headlights, an exposed rear engine
// with twin exhaust stingers, and four chunky off-road tyres.
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
// Where the tyres touch down, for resting it on the ground under all four
// (buggy.js)
export const BUGGY_AXLES = {
  front: FRONT_AXLE,
  rear: REAR_AXLE,
  halfTrack: HALF_TRACK,
};

// A box of the given size centred on (x, y, z), rotated by (rx, ry, rz)
function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

// A cylinder aligned along Z (like headlights, engine barrels, or taillights)
function cylZ(rTop, rBot, len, segs, x, y, z, rx = 0) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  geo.rotateX(Math.PI / 2 + rx);
  geo.translate(x, y, z);
  return geo;
}

// A cylinder aligned along X (like horizontally opposed cylinder heads)
function cylX(rTop, rBot, len, segs, x, y, z) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  geo.rotateZ(Math.PI / 2);
  geo.translate(x, y, z);
  return geo;
}

// A cylinder aligned along Y
function cylY(rTop, rBot, len, segs, x, y, z) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  geo.translate(x, y, z);
  return geo;
}

// A round tube from point a to point b
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();
function tube(a, b, radius = 0.13, segs = 6) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  _dir.subVectors(end, start);
  const geo = new THREE.CylinderGeometry(radius, radius, _dir.length(), segs);
  _quat.setFromUnitVectors(_up, _dir.normalize());
  geo.applyQuaternion(_quat);
  geo.translate(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    (start.z + end.z) / 2
  );
  return geo;
}

// 3-piece arched fender over a wheel at (cx, zCenter)
function fenderArch(cx, yTop, zCenter, width, length) {
  const segLen = length * 0.46;
  const lipLen = length * 0.36;
  const angle = 0.46;
  const drop = lipLen * 0.5 * Math.sin(angle);
  const zOff = segLen * 0.5 + lipLen * 0.5 * Math.cos(angle) - 0.04;
  return [
    // Center crown
    box(width, 0.18, segLen, cx, yTop, zCenter),
    // Front downward-sloped lip
    box(width, 0.17, lipLen, cx, yTop - drop, zCenter - zOff, -angle),
    // Rear downward-sloped lip
    box(width, 0.17, lipLen, cx, yTop - drop, zCenter + zOff, angle),
  ];
}

// Off-road tyre with shoulder bevels, a 5-spoke alloy rim and an accent hubcap
function createWheel(width, tyreMat, hubMat, accentMat) {
  const wheel = new THREE.Group();
  const r = BUGGY_WHEEL_RADIUS;
  const treadW = width * 0.76;

  // Main tread + bevelled shoulders for a chunky off-road profile
  const treadGeo = new THREE.CylinderGeometry(r, r, treadW, 14);
  treadGeo.rotateZ(Math.PI / 2);
  const shoulderL = new THREE.CylinderGeometry(
    r * 0.88,
    r,
    (width - treadW) * 0.5,
    14
  );
  shoulderL.rotateZ(Math.PI / 2);
  shoulderL.translate(treadW * 0.5 + (width - treadW) * 0.25, 0, 0);
  const shoulderR = new THREE.CylinderGeometry(
    r,
    r * 0.88,
    (width - treadW) * 0.5,
    14
  );
  shoulderR.rotateZ(Math.PI / 2);
  shoulderR.translate(-(treadW * 0.5 + (width - treadW) * 0.25), 0, 0);

  wheel.add(
    new THREE.Mesh(mergeGeometries([treadGeo, shoulderL, shoulderR]), tyreMat)
  );

  // Alloy wheel rim & 5 spokes (makes wheel spin clearly visible)
  const rimParts = [];
  const rimDisk = new THREE.CylinderGeometry(0.76, 0.76, width * 0.82, 10);
  rimDisk.rotateZ(Math.PI / 2);
  rimParts.push(rimDisk);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(width + 0.06, 0.18, 0.72);
    spoke.translate(0, 0, 0.34);
    spoke.rotateX(a);
    rimParts.push(spoke);
  }
  wheel.add(new THREE.Mesh(mergeGeometries(rimParts), hubMat));

  // Center lug cap in vehicle accent color
  const capGeo = new THREE.CylinderGeometry(0.28, 0.28, width + 0.12, 8);
  capGeo.rotateZ(Math.PI / 2);
  wheel.add(new THREE.Mesh(capGeo, accentMat));

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
    createMaterial({color: whiteColor, flatShading: true, roughness: 0.45});
  const darkMat = createMaterial({
    color: 0x24262b,
    flatShading: true,
    roughness: 0.8,
  });
  const lensMat = createMaterial({
    color: 0xfff3c4,
    emissive: 0xffd54f,
    emissiveIntensity: 0.35,
    flatShading: true,
  });
  const tailMat = createMaterial({
    color: 0xe53935,
    emissive: 0xb71c1c,
    emissiveIntensity: 0.3,
    flatShading: true,
  });

  // Everything on the springs, grouped by material
  const body = new THREE.Group();
  root.add(body);

  // --- 1. ACCENT BODYWORK (TUB, SLOPED HOOD, ARCHED FENDERS, COIL SPRINGS) ---
  const accent = [
    // Main floor pan and lower belly tub
    box(3.3, 0.45, 6.2, 0, 1.88, -0.2),
    // Sculpted, forward-sloping Meyers-Manx style hood & nose cone
    box(3.1, 0.65, 1.8, 0, 2.48, -2.15, -0.18),
    box(2.6, 0.55, 1.6, 0, 2.22, -3.55, -0.26),
    // Angled hood side cheeks
    box(0.45, 0.52, 2.6, -1.35, 2.32, -2.7, -0.2, 0.14, 0),
    box(0.45, 0.52, 2.6, 1.35, 2.32, -2.7, -0.2, -0.14, 0),
    // Side sill pods with rear quarter kick-up
    box(0.52, 0.82, 3.3, -1.65, 2.38, 0.15),
    box(0.52, 0.82, 3.3, 1.65, 2.38, 0.15),
    box(0.55, 0.92, 1.5, -1.62, 2.68, 2.0, 0.18),
    box(0.55, 0.92, 1.5, 1.62, 2.68, 2.0, 0.18),
    // Rear engine cowling deck lid behind the roll cage
    box(2.5, 0.32, 1.2, 0, 3.22, 2.0, -0.15),
    // Arched front fenders over the front wheels
    ...fenderArch(-HALF_TRACK, 3.25, FRONT_AXLE, 1.28, 2.55),
    ...fenderArch(HALF_TRACK, 3.25, FRONT_AXLE, 1.28, 2.55),
    // Wider arched rear Baja fenders over the rear wheels
    ...fenderArch(-(HALF_TRACK + 0.12), 3.32, REAR_AXLE, 1.52, 2.75),
    ...fenderArch(HALF_TRACK + 0.12, 3.32, REAR_AXLE, 1.52, 2.75),
    // Coilover spring collars on all four shocks
    tube([-1.95, 1.9, FRONT_AXLE], [-1.52, 2.85, FRONT_AXLE], 0.19, 8),
    tube([1.95, 1.9, FRONT_AXLE], [1.52, 2.85, FRONT_AXLE], 0.19, 8),
    tube([-2.05, 1.9, REAR_AXLE], [-1.55, 2.95, REAR_AXLE], 0.21, 8),
    tube([2.05, 1.9, REAR_AXLE], [1.55, 2.95, REAR_AXLE], 0.21, 8),
    // Whip antenna pennant flag at the top
    box(0.06, 0.38, 0.65, 1.15, 6.65, 1.95),
  ];
  body.add(new THREE.Mesh(mergeGeometries(accent), accentMat));

  // --- 2. DARK CHASSIS, SUSPENSION A-ARMS, ROLL CAGE, SEAT, ENGINE & WHEEL ---
  // Round steering wheel rim (torus) + 3 spokes
  const steerWheelRim = new THREE.TorusGeometry(0.44, 0.075, 6, 12);
  steerWheelRim.rotateX(0.55);
  steerWheelRim.translate(0, 3.55, -0.82);

  const dark = [
    steerWheelRim,
    // Steering wheel spokes, center hub, and column shaft
    box(0.82, 0.09, 0.09, 0, 3.55, -0.82, 0.55),
    box(0.09, 0.42, 0.09, 0, 3.38, -0.72, 0.55),
    cylZ(0.14, 0.14, 0.16, 8, 0, 3.55, -0.82, -1.02),
    tube([0, 3.05, -1.35], [0, 3.55, -0.82], 0.1),
    // Dashboard brow and cockpit floor footwell
    box(2.5, 0.42, 0.65, 0, 2.95, -1.45, 0.2),
    box(2.6, 0.15, 2.4, 0, 1.72, -0.3),

    // Sculpted bucket seat: base cushion, side bolsters, backrest, headrest
    box(1.65, 0.38, 1.45, 0, 2.18, 0.55, -0.06),
    box(0.28, 0.52, 1.4, -0.78, 2.38, 0.55, -0.06),
    box(0.28, 0.52, 1.4, 0.78, 2.38, 0.55, -0.06),
    box(1.55, 1.75, 0.34, 0, 3.08, 1.25, 0.18),
    box(0.26, 1.55, 0.42, -0.72, 3.05, 1.15, 0.18),
    box(0.26, 1.55, 0.42, 0.72, 3.05, 1.15, 0.18),
    box(0.85, 0.55, 0.32, 0, 4.18, 1.42, 0.12),

    // Front bullbar bumper & tubular hoop
    box(2.8, 0.34, 0.4, 0, 1.85, -4.45),
    tube([-1.35, 1.85, -4.45], [-0.95, 2.55, -4.55], 0.11),
    tube([1.35, 1.85, -4.45], [0.95, 2.55, -4.55], 0.11),
    tube([-0.95, 2.55, -4.55], [0.95, 2.55, -4.55], 0.11),

    // Round bucket headlight housings
    cylZ(0.38, 0.32, 0.48, 10, -0.95, 2.65, -4.2),
    cylZ(0.38, 0.32, 0.48, 10, 0.95, 2.65, -4.2),

    // Front & rear fender support struts
    tube([-1.3, 2.25, FRONT_AXLE], [-HALF_TRACK, 3.18, FRONT_AXLE], 0.08),
    tube([1.3, 2.25, FRONT_AXLE], [HALF_TRACK, 3.18, FRONT_AXLE], 0.08),
    tube(
      [-1.45, 2.55, REAR_AXLE],
      [-(HALF_TRACK + 0.1), 3.25, REAR_AXLE],
      0.09
    ),
    tube([1.45, 2.55, REAR_AXLE], [HALF_TRACK + 0.1, 3.25, REAR_AXLE], 0.09),

    // Front double-wishbone A-arm suspension (left & right)
    tube([-1.2, 1.75, FRONT_AXLE - 0.55], [-2.35, 1.45, FRONT_AXLE], 0.1),
    tube([-1.2, 1.75, FRONT_AXLE + 0.55], [-2.35, 1.45, FRONT_AXLE], 0.1),
    tube([-1.25, 2.15, FRONT_AXLE - 0.35], [-2.25, 1.75, FRONT_AXLE], 0.085),
    tube([-1.25, 2.15, FRONT_AXLE + 0.35], [-2.25, 1.75, FRONT_AXLE], 0.085),
    tube([1.2, 1.75, FRONT_AXLE - 0.55], [2.35, 1.45, FRONT_AXLE], 0.1),
    tube([1.2, 1.75, FRONT_AXLE + 0.55], [2.35, 1.45, FRONT_AXLE], 0.1),
    tube([1.25, 2.15, FRONT_AXLE - 0.35], [2.25, 1.75, FRONT_AXLE], 0.085),
    tube([1.25, 2.15, FRONT_AXLE + 0.35], [2.25, 1.75, FRONT_AXLE], 0.085),
    // Front shock tower hoop
    tube([-1.45, 2.2, FRONT_AXLE], [-1.38, 3.1, FRONT_AXLE], 0.11),
    tube([1.45, 2.2, FRONT_AXLE], [1.38, 3.1, FRONT_AXLE], 0.11),

    // Rear trailing-arm & wishbone suspension (left & right)
    tube([-1.25, 1.8, REAR_AXLE - 0.7], [-2.45, 1.45, REAR_AXLE], 0.11),
    tube([-1.25, 1.8, REAR_AXLE + 0.45], [-2.45, 1.45, REAR_AXLE], 0.11),
    tube([-1.3, 2.25, REAR_AXLE - 0.35], [-2.35, 1.8, REAR_AXLE], 0.09),
    tube([1.25, 1.8, REAR_AXLE - 0.7], [2.45, 1.45, REAR_AXLE], 0.11),
    tube([1.25, 1.8, REAR_AXLE + 0.45], [2.45, 1.45, REAR_AXLE], 0.11),
    tube([1.3, 2.25, REAR_AXLE - 0.35], [2.35, 1.8, REAR_AXLE], 0.09),

    // Detailed rear air-cooled boxer engine: crankcase, fan shroud, cylinder banks
    box(1.65, 1.15, 1.55, 0, 2.45, 2.75),
    cylZ(0.68, 0.68, 0.55, 10, 0, 2.85, 2.45),
    cylX(0.46, 0.46, 2.45, 8, 0, 2.35, 2.55),
    cylX(0.46, 0.46, 2.45, 8, 0, 2.35, 3.05),
    // Rear engine guard cage / bumper
    tube([-1.35, 1.95, 3.45], [1.35, 1.95, 3.45], 0.13),
    tube([-1.35, 1.95, 3.45], [-1.05, 2.55, 3.85], 0.12),
    tube([1.35, 1.95, 3.45], [1.05, 2.55, 3.85], 0.12),
    tube([-1.05, 2.55, 3.85], [1.05, 2.55, 3.85], 0.12),
    // Taillight pods
    cylZ(0.24, 0.24, 0.24, 8, -1.05, 2.75, 3.55),
    cylZ(0.24, 0.24, 0.24, 8, 1.05, 2.75, 3.55),

    // Roll cage: A-pillars, windshield header, roof rails, B-pillar hoop, V-braces & rear down-bars
    tube([-1.48, 2.55, -1.85], [-1.22, 4.95, -0.35], 0.13),
    tube([1.48, 2.55, -1.85], [1.22, 4.95, -0.35], 0.13),
    tube([-1.22, 4.95, -0.35], [1.22, 4.95, -0.35], 0.13),
    tube([-1.22, 4.95, -0.35], [-1.22, 5.05, 1.55], 0.13),
    tube([1.22, 4.95, -0.35], [1.22, 5.05, 1.55], 0.13),
    tube([-0.45, 4.95, -0.35], [-0.45, 5.05, 1.55], 0.09),
    tube([0.45, 4.95, -0.35], [0.45, 5.05, 1.55], 0.09),
    tube([-1.45, 2.45, 1.55], [-1.22, 5.05, 1.55], 0.135),
    tube([1.45, 2.45, 1.55], [1.22, 5.05, 1.55], 0.135),
    tube([-1.22, 5.05, 1.55], [1.22, 5.05, 1.55], 0.135),
    // Diagonal harness bar / V-brace behind the seat
    tube([-1.35, 3.35, 1.55], [1.35, 3.35, 1.55], 0.1),
    tube([0, 3.35, 1.55], [-0.75, 5.05, 1.55], 0.09),
    tube([0, 3.35, 1.55], [0.75, 5.05, 1.55], 0.09),
    // Rear cage down-bars anchoring to the rear shock towers and engine guard
    tube([-1.22, 5.05, 1.55], [-1.15, 2.45, 3.45], 0.125),
    tube([1.22, 5.05, 1.55], [1.15, 2.45, 3.45], 0.125),
    // Flexible whip antenna pole on right rear cage
    tube([1.15, 3.2, 1.6], [1.15, 6.85, 1.65], 0.045, 5),
  ];
  body.add(new THREE.Mesh(mergeGeometries(dark), darkMat));

  // --- 3. LIGHT / CHROME DETAILS (STRIPE, SKID PLATE, SHOCKS, HEADERS, VALVE COVERS) ---
  const light = [
    // Raised center hood racing stripe / vent scoop
    box(0.75, 0.12, 3.1, 0, 2.66, -2.75, -0.22),
    // Angled front aluminum skid plate under the nose
    box(2.1, 0.14, 1.15, 0, 1.62, -4.15, 0.42),
    // Dashboard instrument gauge faces
    cylZ(0.18, 0.18, 0.08, 8, -0.35, 3.02, -1.12, 0.2),
    cylZ(0.18, 0.18, 0.08, 8, 0.35, 3.02, -1.12, 0.2),
    // Chrome shock absorber shafts (all 4 corners)
    tube([-2.22, 1.52, FRONT_AXLE], [-1.42, 3.02, FRONT_AXLE], 0.09),
    tube([2.22, 1.52, FRONT_AXLE], [1.42, 3.02, FRONT_AXLE], 0.09),
    tube([-2.32, 1.52, REAR_AXLE], [-1.45, 3.12, REAR_AXLE], 0.1),
    tube([2.32, 1.52, REAR_AXLE], [1.45, 3.12, REAR_AXLE], 0.1),
    // Engine top chrome air cleaner, alternator pulley & finned valve covers
    cylY(0.48, 0.42, 0.32, 10, 0, 3.35, 2.85),
    cylZ(0.26, 0.26, 0.16, 8, 0, 2.85, 3.56),
    box(0.18, 0.55, 1.15, -1.28, 2.35, 2.8),
    box(0.18, 0.55, 1.15, 1.28, 2.35, 2.8),
    // Twin curved exhaust header pipes & angled megaphone stingers
    tube([-1.15, 2.15, 2.95], [-0.55, 2.55, 3.65], 0.12, 8),
    tube([1.15, 2.15, 2.95], [0.55, 2.55, 3.65], 0.12, 8),
    tube([-0.55, 2.55, 3.65], [-0.42, 3.15, 4.35], 0.17, 8),
    tube([0.55, 2.55, 3.65], [0.42, 3.15, 4.35], 0.17, 8),
  ];
  body.add(new THREE.Mesh(mergeGeometries(light), lightMat));

  // --- 4. HEADLIGHT & TAILLIGHT LENSES ---
  const lenses = [
    cylZ(0.31, 0.31, 0.12, 10, -0.95, 2.65, -4.42),
    cylZ(0.31, 0.31, 0.12, 10, 0.95, 2.65, -4.42),
  ];
  body.add(new THREE.Mesh(mergeGeometries(lenses), lensMat));

  const tails = [
    cylZ(0.19, 0.19, 0.1, 8, -1.05, 2.75, 3.66),
    cylZ(0.19, 0.19, 0.1, 8, 1.05, 2.75, 3.66),
  ];
  body.add(new THREE.Mesh(mergeGeometries(tails), tailMat));

  // Wheels: the front pair turn on pivots, the back ones are wider
  const wheels = [];
  const steerPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * HALF_TRACK, BUGGY_WHEEL_RADIUS, FRONT_AXLE);
    const front = createWheel(1.15, darkMat, lightMat, accentMat);
    front.userData = {side, baseX: 0, baseY: 0};
    pivot.add(front);
    root.add(pivot);
    steerPivots.push(pivot);
    wheels.push(front);

    const rear = createWheel(1.48, darkMat, lightMat, accentMat);
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
  // and higher, looking up the road, so the buggy sits in the lower third
  root.chaseLift = 1.6;
  root.chaseFrame = 0.45;
  root.firstPersonEye = new THREE.Vector3(0, 4.6, -0.3);
  return root;
}
