// --- VR MODELS ---
// Lightweight low-poly 3D meshes for WebXR flight controls and hand tracking:
// - Minimal virtual flight stick (gimbal base + pivoting livery-accented grip)
// - Minimal virtual cruise-hold throttle (slotted quadrant + sliding T-handle)
// - Single-draw-call InstancedMesh for both 25-joint WebXR bare hands
// - Compact low-poly controller wand for physical XR grip spaces
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMaterial} from './constants.js';
import {softenAnimeLight} from './art-style.js';
import {planeMat} from './airplane.js';
import {VIRTUAL_THROTTLE_SPAN} from './vr-controls-logic.js';

// 19 anatomical bone segments per hand: [proximalJoint, distalJoint, defaultRadiusM]
export const VR_HAND_BONE_PAIRS = [
  ['wrist', 'thumb-metacarpal', 0.012],
  ['thumb-metacarpal', 'thumb-phalanx-proximal', 0.0105],
  ['thumb-phalanx-proximal', 'thumb-phalanx-distal', 0.009],
  ['thumb-phalanx-distal', 'thumb-tip', 0.0078],

  ['index-finger-metacarpal', 'index-finger-phalanx-proximal', 0.0105],
  ['index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 0.009],
  ['index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 0.0078],
  ['index-finger-phalanx-distal', 'index-finger-tip', 0.0068],

  ['middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 0.0108],
  [
    'middle-finger-phalanx-proximal',
    'middle-finger-phalanx-intermediate',
    0.0092,
  ],
  ['middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 0.008],
  ['middle-finger-phalanx-distal', 'middle-finger-tip', 0.0068],

  ['ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 0.0102],
  ['ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 0.0086],
  ['ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 0.0075],
  ['ring-finger-phalanx-distal', 'ring-finger-tip', 0.0064],

  ['pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 0.0092],
  [
    'pinky-finger-phalanx-proximal',
    'pinky-finger-phalanx-intermediate',
    0.0078,
  ],
  ['pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 0.0068],
];

// One pinky distal tip + 19 segments above + 1 palm block = 21 instances per hand
const ALL_BONE_PAIRS = [
  ...VR_HAND_BONE_PAIRS,
  ['pinky-finger-phalanx-distal', 'pinky-finger-tip', 0.0058],
];
const SEGMENTS_PER_HAND = 1 + ALL_BONE_PAIRS.length; // 1 palm + 20 finger segments = 21
const TOTAL_HAND_INSTANCES = SEGMENTS_PER_HAND * 2; // 42 instances for both hands (1 draw call)

// Indices within ALL_BONE_PAIRS for thumb-tip (3) and index-tip (7) pinch highlight
const PINCH_TIP_BONE_INDICES = new Set([3, 7]);

function boxGeo(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  if (x || y || z) g.translate(x, y, z);
  return g;
}

function cylGeo(rTop, rBot, h, segs, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  if (x || y || z) g.translate(x, y, z);
  return g;
}

/**
 * Builds the minimal low-poly VR flight stick.
 * Origin (0, 0, 0) sits at the center of the grip handle so anchoring the root
 * at the player's grab point places the handle directly inside their hand,
 * while the gimbal base rests 10.5 cm below.
 */
export function createVRFlightStickModel(opts = {}) {
  const root = new THREE.Group();
  root.name = 'vrFlightStick';

  const activeAccentMat =
    opts.accentMat ||
    planeMat ||
    createMaterial({color: 0x4794db, flatShading: true, roughness: 0.45});
  const darkMat = createMaterial({
    color: 0x1e242d,
    flatShading: true,
    roughness: 0.72,
  });
  const metalMat = createMaterial({
    color: 0x94a3b8,
    flatShading: true,
    roughness: 0.38,
    metalness: 0.25,
  });
  const goldMat = createMaterial({
    color: 0xe8c382,
    emissive: 0xe8c382,
    emissiveIntensity: 0.15,
    flatShading: true,
    roughness: 0.35,
  });

  // 1. Stationary gimbal base puck & bellows boot (10.5 cm below grip center)
  const baseDarkGeos = [
    cylGeo(0.048, 0.056, 0.014, 10, 0, -0.108, 0),
    cylGeo(0.024, 0.034, 0.016, 8, 0, -0.095, 0),
  ];
  const baseMesh = new THREE.Mesh(mergeGeometries(baseDarkGeos), darkMat);
  root.add(baseMesh);

  const baseRingGeo = cylGeo(0.038, 0.041, 0.005, 10, 0, -0.1, 0);
  const baseRingMesh = new THREE.Mesh(baseRingGeo, goldMat);
  root.add(baseRingMesh);

  // 2. Pivoting shaft & contoured low-poly grip (pivots around gimbal at y = -0.092)
  const pivotGroup = new THREE.Group();
  pivotGroup.position.set(0, -0.092, 0);
  pivotGroup.rotation.order = 'YXZ';
  root.add(pivotGroup);

  const shaftMesh = new THREE.Mesh(
    cylGeo(0.0085, 0.01, 0.046, 8, 0, 0.022, 0),
    metalMat
  );
  pivotGroup.add(shaftMesh);

  // Grip body centered around y = +0.092 inside pivotGroup (= y = 0 in root)
  const gripDarkGeos = [
    // Lower palm rest shelf
    boxGeo(0.044, 0.01, 0.048, 0, 0.044, 0.004),
    // Main ergonomic grip barrel tilted slightly forward (-0.14 rad)
    cylGeo(0.0175, 0.0195, 0.092, 8, 0, 0.09, -0.004, -0.14),
    // Subtle front finger ridge
    boxGeo(0.022, 0.068, 0.012, 0, 0.088, -0.018, -0.14),
  ];
  const gripMesh = new THREE.Mesh(mergeGeometries(gripDarkGeos), darkMat);
  pivotGroup.add(gripMesh);

  // Livery-colored angled stick head & trim cap
  const headAccentGeos = [boxGeo(0.036, 0.022, 0.042, 0, 0.138, -0.011, -0.22)];
  const headMesh = new THREE.Mesh(
    mergeGeometries(headAccentGeos),
    activeAccentMat
  );
  pivotGroup.add(headMesh);

  const topTrimMesh = new THREE.Mesh(
    cylGeo(0.007, 0.008, 0.006, 8, 0, 0.149, -0.012, -0.22),
    goldMat
  );
  pivotGroup.add(topTrimMesh);

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  softenAnimeLight(root);

  root.pivotGroup = pivotGroup;
  root.goldMat = goldMat;
  root.setGrabbed = (grabbed, hovered = false) => {
    goldMat.emissiveIntensity = grabbed ? 0.55 : hovered ? 0.35 : 0.15;
  };
  return root;
}

/**
 * Builds the minimal low-poly VR cruise-hold throttle quadrant.
 * Origin (0, 0, 0) corresponds to the center of the T-handle at 50% throttle,
 * with the slotted track sitting 6.2 cm below.
 */
export function createVRThrottleModel(opts = {}) {
  const root = new THREE.Group();
  root.name = 'vrThrottle';

  const activeAccentMat =
    opts.accentMat ||
    planeMat ||
    createMaterial({color: 0x4794db, flatShading: true, roughness: 0.45});
  const darkMat = createMaterial({
    color: 0x1e242d,
    flatShading: true,
    roughness: 0.72,
  });
  const metalMat = createMaterial({
    color: 0x94a3b8,
    flatShading: true,
    roughness: 0.38,
    metalness: 0.25,
  });
  const goldMat = createMaterial({
    color: 0xe8c382,
    emissive: 0xe8c382,
    emissiveIntensity: 0.18,
    flatShading: true,
    roughness: 0.35,
  });

  const trackLen = VIRTUAL_THROTTLE_SPAN + 0.044;
  const trackY = -0.062;

  // 1. Slotted low-poly base rail
  const railGeos = [
    boxGeo(0.064, 0.012, trackLen, 0, trackY, 0),
    // Side raised guide rails leaving a center slot
    boxGeo(0.016, 0.007, trackLen - 0.01, -0.022, trackY + 0.008, 0),
    boxGeo(0.016, 0.007, trackLen - 0.01, 0.022, trackY + 0.008, 0),
    // Front (MAX) and rear (IDLE) end-stop bumpers
    boxGeo(0.056, 0.01, 0.01, 0, trackY + 0.008, -trackLen * 0.5 + 0.006),
    boxGeo(0.056, 0.01, 0.01, 0, trackY + 0.008, trackLen * 0.5 - 0.006),
  ];
  const railMesh = new THREE.Mesh(mergeGeometries(railGeos), darkMat);
  root.add(railMesh);

  // Fill bar inside the slot showing current throttle level
  const fillGeo = new THREE.BoxGeometry(0.014, 0.005, 1.0);
  const fillMesh = new THREE.Mesh(fillGeo, goldMat);
  fillMesh.position.set(0, trackY + 0.007, 0);
  root.add(fillMesh);

  // 2. Sliding T-handle lever group
  const handleGroup = new THREE.Group();
  root.add(handleGroup);

  const strutGeos = [
    boxGeo(0.008, 0.058, 0.016, -0.014, -0.031, 0.006, 0.18),
    boxGeo(0.008, 0.058, 0.016, 0.014, -0.031, 0.006, 0.18),
  ];
  handleGroup.add(new THREE.Mesh(mergeGeometries(strutGeos), metalMat));

  // Wide ergonomic T-bar palm grip
  const barDarkGeos = [
    cylGeo(0.0145, 0.0145, 0.074, 8, 0, 0, 0, 0, Math.PI / 2),
  ];
  handleGroup.add(new THREE.Mesh(mergeGeometries(barDarkGeos), darkMat));

  // Livery end-caps on the T-bar
  const capGeos = [
    cylGeo(0.0155, 0.0135, 0.011, 8, -0.041, 0, 0, 0, Math.PI / 2),
    cylGeo(0.0135, 0.0155, 0.011, 8, 0.041, 0, 0, 0, Math.PI / 2),
  ];
  handleGroup.add(new THREE.Mesh(mergeGeometries(capGeos), activeAccentMat));

  // Gold center index band on T-bar
  const bandMesh = new THREE.Mesh(
    cylGeo(0.0152, 0.0152, 0.012, 8, 0, 0, 0, 0, Math.PI / 2),
    goldMat
  );
  handleGroup.add(bandMesh);

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  softenAnimeLight(root);

  root.handleGroup = handleGroup;
  root.fillMesh = fillMesh;
  root.goldMat = goldMat;
  root.setThrottle = (norm = 0.5, grabbed = false, hovered = false) => {
    const t = Math.max(0, Math.min(1, norm));
    const zPos = (0.5 - t) * VIRTUAL_THROTTLE_SPAN;
    handleGroup.position.z = zPos;
    const fillLen = Math.max(0.004, t * VIRTUAL_THROTTLE_SPAN);
    fillMesh.scale.z = fillLen;
    fillMesh.position.z = 0.5 * VIRTUAL_THROTTLE_SPAN - fillLen * 0.5;
    goldMat.emissiveIntensity = grabbed ? 0.55 : hovered ? 0.35 : 0.18;
  };
  root.setThrottle(0.5, false, false);
  return root;
}

/**
 * Builds a compact low-poly controller wand for physical XR controller grip
 * spaces so players can see their hands when reaching for the virtual stick.
 */
export function createVRControllerGripModel() {
  const root = new THREE.Group();
  root.name = 'vrControllerGrip';

  const darkMat = createMaterial({
    color: 0x222832,
    flatShading: true,
    roughness: 0.68,
  });
  const ringMat = createMaterial({
    color: 0xe8c382,
    emissive: 0xe8c382,
    emissiveIntensity: 0.12,
    flatShading: true,
    roughness: 0.4,
  });

  const bodyGeos = [
    // Ergonomic grip stem meeting the top face plate seamlessly
    cylGeo(0.014, 0.0115, 0.11, 8, 0, -0.022, 0.022, Math.PI * 0.36),
    // Neck bridge into tracking head
    boxGeo(0.022, 0.016, 0.032, 0, -0.002, -0.01, Math.PI * 0.2),
    // Top face plate
    cylGeo(0.023, 0.018, 0.015, 8, 0, 0.006, -0.022, Math.PI * 0.16),
  ];
  root.add(new THREE.Mesh(mergeGeometries(bodyGeos), darkMat));

  const haloGeo = new THREE.TorusGeometry(0.03, 0.0038, 6, 12);
  haloGeo.rotateX(Math.PI * 0.34);
  haloGeo.translate(0, 0.016, -0.022);
  root.add(new THREE.Mesh(haloGeo, ringMat));

  root.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  softenAnimeLight(root);
  return root;
}

// Pre-allocated scratch math objects for zero-GC 72/90Hz bare-hand updates
const _pA = new THREE.Vector3();
const _pB = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _palmAcross = new THREE.Vector3();
const _palmNormal = new THREE.Vector3();
const _upY = new THREE.Vector3(0, 1, 0);
const _rotMat = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _instMat = new THREE.Matrix4();
const _hiddenMat = new THREE.Matrix4().makeScale(0, 0, 0);
const _colGlove = new THREE.Color(0xe6ebf2);
const _colPalm = new THREE.Color(0xd5dde8);
const _colPinch = new THREE.Color(0xe8c382);

/**
 * Creates a single-draw-call `THREE.InstancedMesh` capable of rendering both
 * 25-joint WebXR bare hands (palm plate + 20 faceted finger phalanges each).
 */
export function createVRHandsInstancedMesh() {
  // Faceted 6-sided low-poly bone prism (24 triangles per instance)
  const segGeo = new THREE.CylinderGeometry(0.8, 1.0, 1.0, 6);
  const mat = createMaterial({
    color: 0xffffff,
    flatShading: true,
    roughness: 0.55,
  });

  const mesh = new THREE.InstancedMesh(segGeo, mat, TOTAL_HAND_INSTANCES);
  mesh.name = 'vrHandsInstancedMesh';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  for (let i = 0; i < TOTAL_HAND_INSTANCES; i++) {
    mesh.setMatrixAt(i, _hiddenMat);
    mesh.setColorAt(i, _colGlove);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  softenAnimeLight(mesh);
  return mesh;
}

function readJointVec(joints, name, out) {
  const j = joints?.[name];
  if (!j || j.visible === false || !j.position) return null;
  out.set(j.position.x, j.position.y, j.position.z);
  return out;
}

/**
 * Updates the single `InstancedMesh` for up to two WebXR hands with zero heap
 * allocations. Highlights thumb and index tips in warm gold while pinching or
 * grabbing so bare-hand players get immediate spatial confirmation.
 */
export function updateVRHandsInstancedMesh(mesh, hands) {
  if (!mesh) return;
  let anyVisible = false;

  for (let hIdx = 0; hIdx < 2; hIdx++) {
    const baseIdx = hIdx * SEGMENTS_PER_HAND;
    const entry = hands?.[hIdx];
    const joints = entry?.visible ? entry.joints : null;
    const activeHighlight = Boolean(entry?.active);

    if (!joints) {
      for (let s = 0; s < SEGMENTS_PER_HAND; s++) {
        mesh.setMatrixAt(baseIdx + s, _hiddenMat);
      }
      continue;
    }

    // 0: Contoured low-poly palm block bridging wrist to index/pinky knuckles
    const wrist = readJointVec(joints, 'wrist', _pA);
    const idxProx = readJointVec(joints, 'index-finger-phalanx-proximal', _pB);
    const pkyProx = readJointVec(joints, 'pinky-finger-phalanx-proximal', _mid);
    if (wrist && idxProx && pkyProx) {
      _palmAcross.subVectors(pkyProx, idxProx);
      const palmWidth = Math.max(0.055, _palmAcross.length() * 1.18);
      _palmAcross.normalize();

      // Knuckle bridge midpoint
      _pB.add(pkyProx).multiplyScalar(0.5);
      _dir.subVectors(_pB, wrist);
      const palmLen = Math.max(0.05, _dir.length() * 1.08);
      _dir.normalize();

      _palmNormal.crossVectors(_palmAcross, _dir).normalize();
      _palmAcross.crossVectors(_dir, _palmNormal).normalize();

      _rotMat.makeBasis(_palmAcross, _dir, _palmNormal);
      _quat.setFromRotationMatrix(_rotMat);
      _mid.lerpVectors(wrist, _pB, 0.46);
      _scale.set(palmWidth * 0.54, palmLen, 0.014);
      _instMat.compose(_mid, _quat, _scale);
      mesh.setMatrixAt(baseIdx, _instMat);
      mesh.setColorAt(baseIdx, _colPalm);
      anyVisible = true;
    } else {
      mesh.setMatrixAt(baseIdx, _hiddenMat);
    }

    // 1..20: Articulated finger bone segments
    for (let b = 0; b < ALL_BONE_PAIRS.length; b++) {
      const [nameA, nameB, fallbackRadius] = ALL_BONE_PAIRS[b];
      const instIdx = baseIdx + 1 + b;
      const a = readJointVec(joints, nameA, _pA);
      const c = readJointVec(joints, nameB, _pB);
      if (!a || !c) {
        mesh.setMatrixAt(instIdx, _hiddenMat);
        continue;
      }
      _dir.subVectors(c, a);
      const segLen = _dir.length();
      if (segLen < 1e-4) {
        mesh.setMatrixAt(instIdx, _hiddenMat);
        continue;
      }
      _dir.divideScalar(segLen);
      _quat.setFromUnitVectors(_upY, _dir);
      _mid.addVectors(a, c).multiplyScalar(0.5);

      const rawR = joints[nameA]?.jointRadius || fallbackRadius;
      const r = Math.max(0.005, Math.min(0.014, rawR));
      _scale.set(r, segLen * 1.14, r * 0.92);
      _instMat.compose(_mid, _quat, _scale);
      mesh.setMatrixAt(instIdx, _instMat);
      mesh.setColorAt(
        instIdx,
        activeHighlight && PINCH_TIP_BONE_INDICES.has(b) ? _colPinch : _colGlove
      );
      anyVisible = true;
    }
  }

  mesh.visible = anyVisible;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}

/**
 * Builds a standalone preview group of the low-poly articulated VR hand in a
 * natural relaxed or pinching pose for `debug/debug-models.html`.
 */
export function createVRHandPreviewModel({pinching = false} = {}) {
  const group = new THREE.Group();
  const mesh = createVRHandsInstancedMesh();

  const joints = {};
  const setJ = (name, x, y, z, jointRadius = 0.009) => {
    joints[name] = {position: {x, y, z}, visible: true, jointRadius};
  };

  setJ('wrist', 0, 0, 0.08, 0.022);
  if (pinching) {
    setJ('thumb-metacarpal', -0.026, -0.006, 0.052, 0.012);
    setJ('thumb-phalanx-proximal', -0.036, -0.004, 0.02, 0.01);
    setJ('thumb-phalanx-distal', -0.028, 0.002, -0.008, 0.009);
    setJ('thumb-tip', -0.018, 0.005, -0.028, 0.008);

    setJ('index-finger-metacarpal', -0.022, 0.004, 0.032, 0.011);
    setJ('index-finger-phalanx-proximal', -0.024, 0.008, -0.006, 0.01);
    setJ('index-finger-phalanx-intermediate', -0.022, 0.014, -0.026, 0.0085);
    setJ('index-finger-phalanx-distal', -0.019, 0.01, -0.033, 0.0075);
    setJ('index-finger-tip', -0.017, 0.006, -0.03, 0.0065);
  } else {
    setJ('thumb-metacarpal', -0.028, -0.005, 0.052, 0.012);
    setJ('thumb-phalanx-proximal', -0.046, -0.006, 0.024, 0.01);
    setJ('thumb-phalanx-distal', -0.056, -0.005, -0.004, 0.009);
    setJ('thumb-tip', -0.06, -0.004, -0.026, 0.008);

    setJ('index-finger-metacarpal', -0.024, 0.003, 0.032, 0.011);
    setJ('index-finger-phalanx-proximal', -0.028, 0.004, -0.012, 0.01);
    setJ('index-finger-phalanx-intermediate', -0.03, 0.002, -0.044, 0.0085);
    setJ('index-finger-phalanx-distal', -0.031, -0.002, -0.066, 0.0075);
    setJ('index-finger-tip', -0.031, -0.006, -0.084, 0.0065);
  }

  const fingerSpecs = [
    ['middle-finger', -0.006, 1.06],
    ['ring-finger', 0.013, 0.98],
    ['pinky-finger', 0.031, 0.82],
  ];
  for (const [prefix, xBase, lenScale] of fingerSpecs) {
    setJ(`${prefix}-metacarpal`, xBase * 0.85, 0.004, 0.034, 0.01);
    setJ(`${prefix}-phalanx-proximal`, xBase, 0.005, -0.01 * lenScale, 0.0095);
    setJ(
      `${prefix}-phalanx-intermediate`,
      xBase * 1.04,
      0.002,
      -0.044 * lenScale,
      0.0082
    );
    setJ(
      `${prefix}-phalanx-distal`,
      xBase * 1.06,
      -0.003,
      -0.068 * lenScale,
      0.0072
    );
    setJ(`${prefix}-tip`, xBase * 1.07, -0.008, -0.086 * lenScale, 0.0062);
  }

  updateVRHandsInstancedMesh(mesh, [{visible: true, joints, active: pinching}]);
  mesh.computeBoundingBox();
  group.add(mesh);
  return group;
}
