// --- BUGGY MODEL (RALLY HATCHBACK + AMPHIBIOUS HOVER CONVERSION) ---
// Playable 5-door 1980s rally hatchback adapted from the Polyfork asset
// (third-party/polyfork/compact-hatchback-386417.mjs, unchanged on disk),
// scaled to match road traffic (POLYFORK_SCALE = 3.5) and oriented with
// forward along -Z and tyres resting on y = 0.
// Features 5-spoke gravel rally wheels that visibly spin and steer, live
// player livery paint (`opts.planeMat`), emissive headlamps and tail lamps,
// and an integrated amphibious hovercraft conversion (`setBuggyHoverFold`):
// an inflatable wrap-around air-cushion skirt with livery collar plus
// articulated outrigger swing-arms and shrouded hover-fan ducts.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as compactHatchback from './third-party/polyfork/compact-hatchback-386417.mjs';
import * as policeCruiser from './third-party/polyfork/police-cruiser-a2d25e.mjs';
import {
  POLICE_BLUE_COLOR,
  collectPoliceStrobeMaterials,
  createPoliceStrobeMaterials,
} from './biplane.js';
import {createMaterial} from './constants.js';
import {state} from './state.js';

// Matches POLYFORK_SCALE / ROAD_VEHICLE_SCALE so the player car is the exact
// same size as the compact hatchbacks driving in highway traffic
const CAR_SCALE = 3.5;

// Dimensions from compact-hatchback-386417.mjs rotated Math.PI to face -Z,
// with a slightly wider flush rally track under the flared arches
export const BUGGY_WHEEL_RADIUS = 0.31 * CAR_SCALE;
const FRONT_AXLE = -1.18 * CAR_SCALE;
const REAR_AXLE = 1.28 * CAR_SCALE;
const HALF_TRACK = 2.75;

// How far each wheel moves out and down as it folds flat into its hover duct
const HOVER_OUT = 0.88;
const HOVER_DROP = 0.26;

// Keep the nimble 6.2-unit effective steering wheelbase so low-speed U-turns
// and highway cornering curves stay identical (buggy.js, test-buggy.js)
export const BUGGY_WHEELBASE = 6.2;

// Where the four tyres touch down for ground slope fitting and tyre tracks
export const BUGGY_AXLES = {
  front: FRONT_AXLE,
  rear: REAR_AXLE,
  halfTrack: HALF_TRACK,
};

const BODY_SENTINEL = 0xff00ff;
const HEAD_SENTINEL = 0x00ffff;
const TAIL_SENTINEL = 0xffff00;
const RED_STROBE_SENTINEL = 0xff00aa;
const BLUE_STROBE_SENTINEL = 0x00ff66;
const POLICE_FRONT_AXLE = -1.44 * CAR_SCALE;
const POLICE_REAR_AXLE = 1.44 * CAR_SCALE;
const POLICE_HALF_TRACK = 2.92;

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

function box(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  if (rz) geo.rotateZ(rz);
  geo.translate(x, y, z);
  return geo;
}

function cylY(rTop, rBot, len, segs, x, y, z) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  geo.translate(x, y, z);
  return geo;
}

function cylX(rTop, rBot, len, segs, x, y, z) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  geo.rotateZ(Math.PI / 2);
  geo.translate(x, y, z);
  return geo;
}

function tube(a, b, radius = 0.11, segs = 6) {
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

// Lofted octagonal ring between two perimeter loops [x, z] at heights y0..y1
function loftPerimeter(loop0, y0, loop1, y1, capBottom = false) {
  const pos = [];
  const n = loop0.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [x0a, z0a] = loop0[i];
    const [x0b, z0b] = loop0[j];
    const [x1a, z1a] = loop1[i];
    const [x1b, z1b] = loop1[j];
    // Outward winding for clockwise XZ perimeter loop viewed from +Y
    pos.push(x0a, y0, z0a, x1b, y1, z1b, x0b, y0, z0b);
    pos.push(x0a, y0, z0a, x1a, y1, z1a, x1b, y1, z1b);
    if (capBottom) {
      pos.push(0, y0, 0, x0a, y0, z0a, x0b, y0, z0b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Clockwise octagonal hovercraft planform in XZ (half-width hw, half-length hl, corner bevel)
function octagonLoop(hw, hl, bevX = 0.75, bevZ = 1.15) {
  return [
    [-hw + bevX, -hl],
    [hw - bevX, -hl],
    [hw, -hl + bevZ],
    [hw, hl - bevZ],
    [hw - bevX, hl],
    [-hw + bevX, hl],
    [-hw, hl - bevZ],
    [-hw, -hl + bevZ],
  ];
}

// Faceted open-ended cylindrical shroud ring (outer rOut, inner rIn, height h)
function buildDuctRingGeo(rOut, rIn, h, segs = 12) {
  const pos = [];
  const y0 = -h * 0.5;
  const y1 = h * 0.5;
  const rTopOut = rOut * 0.95;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);

    // Outer wall (outward normal +radial)
    pos.push(
      c0 * rOut,
      y0,
      s0 * rOut,
      c1 * rTopOut,
      y1,
      s1 * rTopOut,
      c1 * rOut,
      y0,
      s1 * rOut,
      c0 * rOut,
      y0,
      s0 * rOut,
      c0 * rTopOut,
      y1,
      s0 * rTopOut,
      c1 * rTopOut,
      y1,
      s1 * rTopOut
    );
    // Inner wall (inward normal -radial)
    pos.push(
      c1 * rIn,
      y0,
      s1 * rIn,
      c0 * rIn,
      y1,
      s0 * rIn,
      c0 * rIn,
      y0,
      s0 * rIn,
      c1 * rIn,
      y0,
      s1 * rIn,
      c1 * rIn,
      y1,
      s1 * rIn,
      c0 * rIn,
      y1,
      s0 * rIn
    );
    // Top rim (normal +Y)
    pos.push(
      c0 * rTopOut,
      y1,
      s0 * rTopOut,
      c1 * rIn,
      y1,
      s1 * rIn,
      c1 * rTopOut,
      y1,
      s1 * rTopOut,
      c0 * rTopOut,
      y1,
      s0 * rTopOut,
      c0 * rIn,
      y1,
      s0 * rIn,
      c1 * rIn,
      y1,
      s1 * rIn
    );
    // Bottom rim (normal -Y)
    pos.push(
      c1 * rOut,
      y0,
      s1 * rOut,
      c0 * rIn,
      y0,
      s0 * rIn,
      c0 * rOut,
      y0,
      s0 * rOut,
      c1 * rOut,
      y0,
      s1 * rOut,
      c1 * rIn,
      y0,
      s1 * rIn,
      c0 * rIn,
      y0,
      s0 * rIn
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

function prepMerge(geos) {
  return mergeGeometries(
    geos.map((g) => {
      const out = g.index ? g.toNonIndexed() : g;
      out.deleteAttribute('uv');
      if (!out.attributes.normal) out.computeVertexNormals();
      return out;
    })
  );
}

// 5-spoke rally gravel wheel: bevelled dark rubber tyre, deep dark brake drum,
// crisp 5-spoke light alloy face + outer lip, and livery center cap
function buildWheelGeometries(side) {
  const r = BUGGY_WHEEL_RADIUS;
  const width = 0.82;
  const treadW = width * 0.74;
  const shoulderW = (width - treadW) * 0.5;

  // 1. Tyre tread + shoulders
  const tread = cylX(r, r, treadW, 14, 0, 0, 0);
  const outShoulder = new THREE.CylinderGeometry(
    side > 0 ? r * 0.89 : r,
    side > 0 ? r : r * 0.89,
    shoulderW,
    14
  );
  outShoulder.rotateZ(Math.PI / 2);
  outShoulder.translate(side * (treadW * 0.5 + shoulderW * 0.5), 0, 0);

  const inShoulder = new THREE.CylinderGeometry(
    side > 0 ? r : r * 0.89,
    side > 0 ? r * 0.89 : r,
    shoulderW,
    14
  );
  inShoulder.rotateZ(Math.PI / 2);
  inShoulder.translate(-side * (treadW * 0.5 + shoulderW * 0.5), 0, 0);

  // Recessed dark brake-drum backing inside the spokes
  const drum = cylX(r * 0.66, r * 0.66, width * 0.72, 12, 0, 0, 0);
  const tyreGeo = prepMerge([tread, outShoulder, inShoulder, drum]);

  // 2. 5-spoke OZ/rally alloy rim + outer dish ring (on outer side `side`)
  const alloyParts = [];
  const rimRing = buildDuctRingGeo(r * 0.7, r * 0.57, 0.14, 14);
  rimRing.rotateZ(Math.PI / 2);
  rimRing.translate(side * (width * 0.5 - 0.06), 0, 0);
  alloyParts.push(rimRing);

  // Inner hub boss
  alloyParts.push(
    cylX(r * 0.25, r * 0.25, 0.14, 10, side * (width * 0.5 - 0.05), 0, 0)
  );

  // 5 bold rally spokes so axle spin and steering angle read clearly
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.BoxGeometry(0.11, 0.15, r * 0.58);
    spoke.translate(side * (width * 0.5 - 0.05), 0, r * 0.31);
    spoke.rotateX(a);
    alloyParts.push(spoke);
  }
  const alloyGeo = prepMerge(alloyParts);

  // 3. Center lug cap in vehicle livery color
  const capGeo = prepMerge([
    cylX(r * 0.14, r * 0.14, 0.16, 8, side * (width * 0.5 - 0.02), 0, 0),
  ]);

  return {tyreGeo, alloyGeo, capGeo};
}

let cachedParts = null;
let cachedPoliceParts = null;

function makeSubGeometry(posArr, normArr, colArr = null) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3));
  if (colArr) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  }
  geo.scale(CAR_SCALE, CAR_SCALE, CAR_SCALE);
  geo.rotateY(Math.PI);
  return geo;
}

function getCarParts() {
  if (cachedParts) return cachedParts;

  const asset = compactHatchback.createAsset({
    doors: '5-door',
    roofRack: false,
    body: BODY_SENTINEL,
    headlight: HEAD_SENTINEL,
    taillight: TAIL_SENTINEL,
  });

  const bodyCol = new THREE.Color(BODY_SENTINEL);
  const headCol = new THREE.Color(HEAD_SENTINEL);
  const tailCol = new THREE.Color(TAIL_SENTINEL);
  const matchCol = (r, g, b, c) =>
    Math.abs(r - c.r) < 1e-3 &&
    Math.abs(g - c.g) < 1e-3 &&
    Math.abs(b - c.b) < 1e-3;

  const srcBody = asset.getObjectByName('body').geometry;
  const pos = srcBody.attributes.position.array;
  const norm = srcBody.attributes.normal.array;
  const col = srcBody.attributes.color.array;

  const paintPos = [];
  const paintNorm = [];
  const headPos = [];
  const headNorm = [];
  const tailPos = [];
  const tailNorm = [];
  const trimPos = [];
  const trimNorm = [];
  const trimCol = [];

  for (let i = 0; i < pos.length; i += 9) {
    const r = col[i];
    const g = col[i + 1];
    const b = col[i + 2];
    if (matchCol(r, g, b, bodyCol)) {
      for (let k = 0; k < 9; k++) {
        paintPos.push(pos[i + k]);
        paintNorm.push(norm[i + k]);
      }
    } else if (matchCol(r, g, b, headCol)) {
      for (let k = 0; k < 9; k++) {
        headPos.push(pos[i + k]);
        headNorm.push(norm[i + k]);
      }
    } else if (matchCol(r, g, b, tailCol)) {
      for (let k = 0; k < 9; k++) {
        tailPos.push(pos[i + k]);
        tailNorm.push(norm[i + k]);
      }
    } else {
      for (let k = 0; k < 9; k++) {
        trimPos.push(pos[i + k]);
        trimNorm.push(norm[i + k]);
        trimCol.push(col[i + k]);
      }
    }
  }

  asset.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      o.material?.dispose();
    }
  });

  // Inflatable hovercraft skirt geometry: plump 3-tier octagonal air cushion
  // (y = 0.14..1.14) with vertical segment ribs + wheel-arch inner bulkheads,
  // plus a livery-colored clamping collar rail
  const topLoop = octagonLoop(2.94, 6.72, 0.68, 1.05);
  const midLoop = octagonLoop(3.34, 7.18, 0.82, 1.25);
  const botLoop = octagonLoop(3.12, 6.96, 0.76, 1.15);
  const skirtParts = [
    loftPerimeter(midLoop, 0.58, topLoop, 1.1, false),
    loftPerimeter(botLoop, 0.14, midLoop, 0.58, true),
  ];
  // Cushion vertical segment ribs around the sides and bumpers
  for (const zRib of [-4.9, -2.5, 0, 2.5, 5.1]) {
    skirtParts.push(box(0.12, 0.78, 0.16, -3.28, 0.58, zRib, 0, 0, -0.15));
    skirtParts.push(box(0.12, 0.78, 0.16, 3.28, 0.58, zRib, 0, 0, 0.15));
  }
  for (const xRib of [-1.45, 0, 1.45]) {
    skirtParts.push(box(0.16, 0.76, 0.12, xRib, 0.58, -7.12, 0.15, 0, 0));
    skirtParts.push(box(0.16, 0.76, 0.12, xRib, 0.58, 7.12, -0.15, 0, 0));
  }
  // Wheel-arch inner splash bulkheads so empty wheel wells stay dark and solid
  // when the wheels fold out over water
  for (const side of [-1, 1]) {
    for (const az of [FRONT_AXLE, REAR_AXLE]) {
      skirtParts.push(box(0.55, 1.32, 2.35, side * 2.48, 1.56, az));
    }
  }
  const hoverSkirtGeo = prepMerge(skirtParts);

  const collarTop = octagonLoop(3.02, 6.82, 0.7, 1.08);
  const collarBot = octagonLoop(3.12, 6.92, 0.74, 1.12);
  const hoverCollarGeo = loftPerimeter(collarBot, 0.96, collarTop, 1.14, false);

  // Chassis-side twin outrigger swing-arms bridging from inside each wheel well
  // to the steering kingpin collar at (side * HALF_TRACK, r + 0.22, axleZ)
  const chassisArmParts = [];
  const chassisRamParts = [];
  for (const side of [-1, 1]) {
    for (const az of [FRONT_AXLE, REAR_AXLE]) {
      const xIn = side * 2.05;
      const xPin = side * HALF_TRACK;
      const yPin = BUGGY_WHEEL_RADIUS + 0.22;
      chassisArmParts.push(
        tube([xIn, 1.72, az - 0.38], [xPin, yPin, az - 0.18], 0.1, 6),
        tube([xIn, 1.72, az + 0.38], [xPin, yPin, az + 0.18], 0.1, 6),
        cylY(0.2, 0.2, 0.28, 8, xPin, yPin, az)
      );
      chassisRamParts.push(
        tube([side * 2.15, 1.98, az], [xPin, yPin + 0.08, az], 0.065, 6)
      );
    }
  }
  const chassisArmsGeo = prepMerge(chassisArmParts);
  const chassisRamsGeo = prepMerge(chassisRamParts);

  // Pod-side knuckle arm + shrouded hover-fan duct (built per side)
  const buildPodGeos = (side) => {
    const xHub = side * HOVER_OUT;
    const yHub = -HOVER_DROP;
    const duct = buildDuctRingGeo(
      BUGGY_WHEEL_RADIUS + 0.17,
      BUGGY_WHEEL_RADIUS + 0.03,
      0.46,
      14
    );
    duct.translate(xHub, yHub, 0);

    const arm = prepMerge([
      duct,
      // Twin knuckle beams from kingpin (0, 0.22, 0) to center stator hub
      tube([0, 0.22, -0.16], [xHub, yHub + 0.48, -0.12], 0.095, 6),
      tube([0, 0.22, 0.16], [xHub, yHub + 0.48, 0.12], 0.095, 6),
      // Stator hub cap sitting cleanly above the upward-facing wheel center
      cylY(0.28, 0.35, 0.18, 10, xHub, yHub + 0.49, 0),
    ]);

    const accentRing = buildDuctRingGeo(
      BUGGY_WHEEL_RADIUS + 0.19,
      BUGGY_WHEEL_RADIUS + 0.12,
      0.1,
      14
    );
    accentRing.translate(xHub, yHub + 0.14, 0);

    return {arm, accentRing};
  };

  cachedParts = {
    paintGeo: makeSubGeometry(paintPos, paintNorm),
    trimGeo: makeSubGeometry(trimPos, trimNorm, trimCol),
    headLensGeo: makeSubGeometry(headPos, headNorm),
    tailLensGeo: makeSubGeometry(tailPos, tailNorm),
    wheelLeft: buildWheelGeometries(-1),
    wheelRight: buildWheelGeometries(1),
    hoverSkirtGeo,
    hoverCollarGeo,
    chassisArmsGeo,
    chassisRamsGeo,
    podLeft: buildPodGeos(-1),
    podRight: buildPodGeos(1),
  };
  return cachedParts;
}

function getPoliceCarParts() {
  if (cachedPoliceParts) return cachedPoliceParts;
  const base = getCarParts();
  const asset = policeCruiser.createAsset({
    colorway: 'black-white',
    lens: HEAD_SENTINEL,
    tail: TAIL_SENTINEL,
    lampRed: RED_STROBE_SENTINEL,
    lampBlue: BLUE_STROBE_SENTINEL,
    lightbar: 'lit',
    pushBumper: true,
  });

  const headCol = new THREE.Color(HEAD_SENTINEL);
  const tailCol = new THREE.Color(TAIL_SENTINEL);
  const redCol = new THREE.Color(RED_STROBE_SENTINEL);
  const blueCol = new THREE.Color(BLUE_STROBE_SENTINEL);
  const matchCol = (r, g, b, c) =>
    Math.abs(r - c.r) < 1e-3 &&
    Math.abs(g - c.g) < 1e-3 &&
    Math.abs(b - c.b) < 1e-3;

  const srcBody = asset.children.find((c) => c.isMesh).geometry;
  const pos = srcBody.attributes.position.array;
  const norm = srcBody.attributes.normal.array;
  const col = srcBody.attributes.color.array;

  const bodyPos = [];
  const bodyNorm = [];
  const bodyCol = [];
  const headPos = [];
  const headNorm = [];
  const tailPos = [];
  const tailNorm = [];
  const redPos = [];
  const redNorm = [];
  const bluePos = [];
  const blueNorm = [];

  for (let i = 0; i < pos.length; i += 9) {
    const r = col[i];
    const g = col[i + 1];
    const b = col[i + 2];
    if (matchCol(r, g, b, headCol)) {
      for (let k = 0; k < 9; k++) {
        headPos.push(pos[i + k]);
        headNorm.push(norm[i + k]);
      }
    } else if (matchCol(r, g, b, tailCol)) {
      for (let k = 0; k < 9; k++) {
        tailPos.push(pos[i + k]);
        tailNorm.push(norm[i + k]);
      }
    } else if (matchCol(r, g, b, redCol)) {
      for (let k = 0; k < 9; k++) {
        redPos.push(pos[i + k]);
        redNorm.push(norm[i + k]);
      }
    } else if (matchCol(r, g, b, blueCol)) {
      for (let k = 0; k < 9; k++) {
        bluePos.push(pos[i + k]);
        blueNorm.push(norm[i + k]);
      }
    } else {
      for (let k = 0; k < 9; k++) {
        bodyPos.push(pos[i + k]);
        bodyNorm.push(norm[i + k]);
        bodyCol.push(col[i + k]);
      }
    }
  }

  asset.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose();
      o.material?.dispose();
    }
  });

  // Cruiser-length hovercraft skirt & swing-arms matching +/-5.04 axles
  const topLoop = octagonLoop(3.06, 8.2, 0.72, 1.2);
  const midLoop = octagonLoop(3.48, 8.68, 0.86, 1.38);
  const botLoop = octagonLoop(3.24, 8.42, 0.8, 1.28);
  const skirtParts = [
    loftPerimeter(midLoop, 0.58, topLoop, 1.1, false),
    loftPerimeter(botLoop, 0.14, midLoop, 0.58, true),
  ];
  for (const side of [-1, 1]) {
    for (const az of [POLICE_FRONT_AXLE, POLICE_REAR_AXLE]) {
      skirtParts.push(box(0.55, 1.32, 2.4, side * 2.58, 1.56, az));
    }
  }
  const hoverSkirtGeo = prepMerge(skirtParts);
  const collarTop = octagonLoop(3.14, 8.3, 0.74, 1.22);
  const collarBot = octagonLoop(3.24, 8.42, 0.78, 1.28);
  const hoverCollarGeo = loftPerimeter(collarBot, 0.96, collarTop, 1.14, false);

  const chassisArmParts = [];
  const chassisRamParts = [];
  for (const side of [-1, 1]) {
    for (const az of [POLICE_FRONT_AXLE, POLICE_REAR_AXLE]) {
      const xIn = side * 2.15;
      const xPin = side * POLICE_HALF_TRACK;
      const yPin = BUGGY_WHEEL_RADIUS + 0.22;
      chassisArmParts.push(
        tube([xIn, 1.72, az - 0.38], [xPin, yPin, az - 0.18], 0.1, 6),
        tube([xIn, 1.72, az + 0.38], [xPin, yPin, az + 0.18], 0.1, 6),
        cylY(0.2, 0.2, 0.28, 8, xPin, yPin, az)
      );
      chassisRamParts.push(
        tube([xIn, 1.98, az], [xPin - side * 0.15, yPin + 0.18, az], 0.065, 6)
      );
    }
  }

  cachedPoliceParts = {
    bodyGeo: makeSubGeometry(bodyPos, bodyNorm, bodyCol),
    headLensGeo: makeSubGeometry(headPos, headNorm),
    tailLensGeo: makeSubGeometry(tailPos, tailNorm),
    lampRedGeo: makeSubGeometry(redPos, redNorm),
    lampBlueGeo: makeSubGeometry(bluePos, blueNorm),
    wheelLeft: base.wheelLeft,
    wheelRight: base.wheelRight,
    hoverSkirtGeo,
    hoverCollarGeo,
    chassisArmsGeo: prepMerge(chassisArmParts),
    chassisRamsGeo: prepMerge(chassisRamParts),
    podLeft: base.podLeft,
    podRight: base.podRight,
  };
  return cachedPoliceParts;
}

// Deploys or stows the amphibious hovercraft conversion (fold 0 on land -> 1
// on water): inflates the underbody air-cushion skirt, extends the wheel-arch
// outrigger swing-arms, tips all four 5-spoke wheels flat as lift/thrust fans,
// and wraps each wheel in a shrouded hover duct.
export function setBuggyHoverFold(model, fold) {
  if (!model.wheels || model.hoverFold === fold) return;
  model.hoverFold = fold;
  const t = fold * fold * (3 - 2 * fold);
  const showHover = t > 0.01;

  for (const wheel of model.wheels) {
    const {side, baseX, baseY} = wheel.userData;
    wheel.rotation.order = 'ZXY';
    wheel.rotation.z = side * t * (Math.PI / 2);
    wheel.position.x = baseX + side * HOVER_OUT * t;
    wheel.position.y = baseY - HOVER_DROP * t;
  }

  if (model.hoverSkirt) {
    model.hoverSkirt.visible = showHover;
    if (showHover) {
      model.hoverSkirt.position.y = (1 - t) * 0.85;
      model.hoverSkirt.scale.set(
        0.88 + 0.12 * t,
        0.25 + 0.75 * t,
        0.92 + 0.08 * t
      );
    }
  }
  if (model.hoverArms) {
    model.hoverArms.visible = showHover;
    if (showHover) {
      model.hoverArms.position.y = (1 - t) * 0.35;
    }
  }
  if (model.hoverPods) {
    for (const pod of model.hoverPods) {
      pod.visible = showHover;
      if (showHover) {
        pod.position.x = pod.userData.baseX;
        pod.position.y = pod.userData.baseY + (1 - t) * 0.25;
        pod.scale.set(t, 0.65 + 0.35 * t, 0.75 + 0.25 * t);
      }
    }
  }
}

export function createBuggyModel(opts = {}) {
  const isPolice = !!opts.police;
  const root = new THREE.Group();
  const parts = isPolice ? getPoliceCarParts() : getCarParts();
  const frontAxle = isPolice ? POLICE_FRONT_AXLE : FRONT_AXLE;
  const rearAxle = isPolice ? POLICE_REAR_AXLE : REAR_AXLE;
  const halfTrack = isPolice ? POLICE_HALF_TRACK : HALF_TRACK;

  const planeColor = isPolice
    ? POLICE_BLUE_COLOR
    : opts.planeColor !== undefined
      ? opts.planeColor
      : typeof state.planeColor !== 'undefined'
        ? state.planeColor
        : 0xb58941;

  const accentMat = isPolice
    ? createMaterial({
        color: POLICE_BLUE_COLOR,
        flatShading: true,
        roughness: 0.5,
      })
    : opts.planeMat ||
      createMaterial({color: planeColor, flatShading: true, roughness: 0.55});
  const trimMat = createMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: isPolice ? 0.58 : 0.8,
  });
  const tyreMat = createMaterial({
    color: 0x262322,
    flatShading: true,
    roughness: 0.88,
  });
  const alloyMat = createMaterial({
    color: isPolice ? 0x303640 : 0xb8b2a8,
    flatShading: true,
    roughness: 0.45,
  });
  const hubCapMat = isPolice
    ? createMaterial({color: 0xd8dee6, flatShading: true, roughness: 0.32})
    : accentMat;
  const skirtMat = createMaterial({
    color: 0x252830,
    flatShading: true,
    roughness: 0.85,
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

  // Sprung body group (bounced, squatted, and leaned by buggy.js)
  const body = new THREE.Group();
  if (isPolice) {
    const {redMat, blueMat} = createPoliceStrobeMaterials();
    body.add(new THREE.Mesh(parts.bodyGeo.clone(), trimMat));
    body.add(new THREE.Mesh(parts.lampRedGeo.clone(), redMat));
    body.add(new THREE.Mesh(parts.lampBlueGeo.clone(), blueMat));
  } else {
    body.add(new THREE.Mesh(parts.paintGeo.clone(), accentMat));
    body.add(new THREE.Mesh(parts.trimGeo.clone(), trimMat));
  }
  body.add(new THREE.Mesh(parts.headLensGeo.clone(), lensMat));
  body.add(new THREE.Mesh(parts.tailLensGeo.clone(), tailMat));

  // Inflatable hovercraft skirt + livery collar under the body (deployed on water)
  const hoverSkirt = new THREE.Group();
  hoverSkirt.visible = false;
  hoverSkirt.add(new THREE.Mesh(parts.hoverSkirtGeo.clone(), skirtMat));
  hoverSkirt.add(new THREE.Mesh(parts.hoverCollarGeo.clone(), accentMat));
  body.add(hoverSkirt);

  root.add(body);

  // Chassis-side outrigger arms connecting wheel wells to kingpins
  const hoverArms = new THREE.Group();
  hoverArms.visible = false;
  hoverArms.add(new THREE.Mesh(parts.chassisArmsGeo.clone(), skirtMat));
  hoverArms.add(new THREE.Mesh(parts.chassisRamsGeo.clone(), hubCapMat));
  root.add(hoverArms);

  // Wheels + shrouded hover pods: front pair turn on steering pivots
  const wheels = [];
  const steerPivots = [];
  const hoverPods = [];
  for (const side of [-1, 1]) {
    const wGeos = side < 0 ? parts.wheelLeft : parts.wheelRight;
    const pGeos = side < 0 ? parts.podLeft : parts.podRight;

    const makeWheelGroup = () => {
      const wg = new THREE.Group();
      wg.add(new THREE.Mesh(wGeos.tyreGeo.clone(), tyreMat));
      wg.add(new THREE.Mesh(wGeos.alloyGeo.clone(), alloyMat));
      wg.add(new THREE.Mesh(wGeos.capGeo.clone(), hubCapMat));
      return wg;
    };

    const makePodGroup = (bx, by, bz) => {
      const pg = new THREE.Group();
      pg.visible = false;
      pg.position.set(bx, by, bz);
      pg.userData = {baseX: bx, baseY: by};
      pg.add(new THREE.Mesh(pGeos.arm.clone(), skirtMat));
      pg.add(new THREE.Mesh(pGeos.accentRing.clone(), accentMat));
      hoverPods.push(pg);
      return pg;
    };

    const pivot = new THREE.Group();
    pivot.position.set(side * halfTrack, BUGGY_WHEEL_RADIUS, frontAxle);
    const front = makeWheelGroup();
    front.userData = {side, baseX: 0, baseY: 0};
    pivot.add(front);
    pivot.add(makePodGroup(0, 0, 0));
    root.add(pivot);
    steerPivots.push(pivot);
    wheels.push(front);

    const rear = makeWheelGroup();
    rear.position.set(side * halfTrack, BUGGY_WHEEL_RADIUS, rearAxle);
    rear.userData = {side, baseX: rear.position.x, baseY: rear.position.y};
    root.add(rear);
    root.add(makePodGroup(side * halfTrack, BUGGY_WHEEL_RADIUS, rearAxle));
    wheels.push(rear);
  }

  root.body = body;
  root.wheels = wheels;
  root.steerPivots = steerPivots;
  root.hoverSkirt = hoverSkirt;
  root.hoverArms = hoverArms;
  root.hoverPods = hoverPods;
  root.isBuggy = true;
  // Where its wheels are drawn, for the tyre tracks (tire-tracks.js); the
  // police cruiser's sit further out than the buggy's, though it drives on
  // the buggy's (BUGGY_AXLES) so both handle the same
  root.axles = {front: frontAxle, rear: rearAxle, halfTrack};
  root.isPolice = isPolice;
  if (isPolice) root.policeStrobeMats = collectPoliceStrobeMaterials(root);
  // Follow camera framing and bonnet/windshield first-person camera
  root.cameraScale = 0.5;
  // Bird's eye view lower over it (120 up, not the planes' 400), and no
  // closer than 45 (the planes go down to 50)
  root.birdsEyeScale = 0.3;
  root.birdsEyeZoomMin = 0.375;
  root.chaseLift = 1.55;
  root.chaseFrame = 0.45;
  root.firstPersonEye = new THREE.Vector3(0, 4.35, -2.35);
  return root;
}
