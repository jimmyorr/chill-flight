// --- AIRPLANE ---
// planeColor and the pontoon deployment flags live in state.js (other files
// write them).
import * as THREE from 'three';
import {scene} from './scene.js';
import {
  BASE_FLIGHT_SPEED,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  PLANE_HANDLING,
  UNITS_TO_M,
  WATER_LEVEL,
  createMaterial,
  headlightPoolUniforms,
  updateUrlParams,
} from './constants.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {createBiplaneModel, mergeStaticMeshes} from './biplane.js';
import {createTwinModel, setGearExtension} from './twin.js';
import {createJetModel} from './jet.js';
import {createBuggyModel} from './buggy-model.js';
import {simplex} from './noise.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {softenAnimeLight} from './art-style.js';

const initialSpawn = ChillFlightLogic.dailySpawn(simplex, {
  WATER_LEVEL,
  MAP_WORLD_SIZE,
  MAP_HEIGHT_SCALE,
});

export const planeGroup = new THREE.Group();
// Turned for today's scenic spawn (or the Falls on first play), unless heading specified in URL
planeGroup.rotation.y =
  ChillFlightLogic.START_HEADING !== null
    ? THREE.MathUtils.degToRad(ChillFlightLogic.START_HEADING)
    : initialSpawn.yaw;
if (ChillFlightLogic.START_PITCH !== null) {
  planeGroup.rotation.x = THREE.MathUtils.degToRad(
    ChillFlightLogic.START_PITCH
  );
}
if (ChillFlightLogic.START_ROLL !== null) {
  planeGroup.rotation.z = THREE.MathUtils.degToRad(ChillFlightLogic.START_ROLL);
}
scene.add(planeGroup);

// Fuselage
// better rotation order for airplanes
planeGroup.rotation.order = 'YXZ';

export const planeWhiteMat = createMaterial({
  color: state.planeColor === 0xe8c382 ? 0x1c3144 : 0xffffff,
  flatShading: true,
});
export const planeMat = createMaterial({
  color: state.planeColor,
  flatShading: true,
});

// Pontoons Group (created for the seaplane's water landing)
export const pontoonGroup = new THREE.Group();
pontoonGroup.visible = false;

const pontoonMat = createMaterial({
  color: 0xdce3ec,
  flatShading: true,
  roughness: 0.38,
  metalness: 0.22,
});
const pontoonDarkMat = createMaterial({
  color: 0x262c35,
  flatShading: true,
  roughness: 0.75,
});
const pontoonStrutMat = createMaterial({
  color: 0xc4cdd8,
  flatShading: true,
  roughness: 0.35,
  metalness: 0.3,
});

// Builds a stepped V-bottom Edo seaplane float (bow z = -10.8 to stern z = +8.8)
function createSteppedFloatHullGeo() {
  // Cross-section stations: {z, halfW, deckY, chineY, keelY}
  // Notice the classic hydrodynamic step at z = 0.45 where keelY steps up!
  const stations = [
    {z: -10.65, w: 0.14, deckY: 0.42, chineY: 0.22, keelY: 0.08},
    {z: -9.6, w: 0.56, deckY: 0.62, chineY: 0.12, keelY: -0.36},
    {z: -7.4, w: 0.96, deckY: 0.72, chineY: 0.02, keelY: -0.68},
    {z: -3.5, w: 1.08, deckY: 0.74, chineY: -0.02, keelY: -0.8},
    {z: 0.45, w: 1.06, deckY: 0.74, chineY: -0.02, keelY: -0.82}, // Forebody step lip
    {z: 0.5, w: 1.04, deckY: 0.74, chineY: 0.02, keelY: -0.56}, // Aftbody stepped keel
    {z: 4.6, w: 0.88, deckY: 0.68, chineY: 0.08, keelY: -0.44},
    {z: 8.6, w: 0.42, deckY: 0.52, chineY: 0.18, keelY: -0.22},
  ];

  // 8-point symmetric ring per station (CCW looking from +Z toward -Z so normals face outward):
  // 0: top-center, 1: right deck shoulder, 2: right chine, 3: bottom V-keel,
  // 4: left chine, 5: left deck shoulder (closed back to 0)
  const ringPts = (st) => [
    [0, st.deckY + 0.04],
    [st.w * 0.76, st.deckY],
    [st.w, st.chineY],
    [0, st.keelY],
    [-st.w, st.chineY],
    [-st.w * 0.76, st.deckY],
  ];

  const positions = [];
  const uvs = [];
  const indices = [];
  const N = 6;

  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    const pts = ringPts(st);
    for (let j = 0; j <= N; j++) {
      const [x, y] = pts[j % N];
      positions.push(x, y, st.z);
      uvs.push(j / N, i / (stations.length - 1));
    }
  }

  const stride = N + 1;
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * stride + j;
      const b = i * stride + j + 1;
      const c = (i + 1) * stride + j;
      const d = (i + 1) * stride + j + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Cap bow and stern
  const bowCenterIdx = positions.length / 3;
  positions.push(0, 0.28, -10.8);
  uvs.push(0.5, 0);
  for (let j = 0; j < N; j++) {
    indices.push(bowCenterIdx, j, j + 1);
  }

  const sternBase = (stations.length - 1) * stride;
  const sternCenterIdx = positions.length / 3;
  positions.push(0, 0.18, 8.75);
  uvs.push(0.5, 1);
  for (let j = 0; j < N; j++) {
    indices.push(sternCenterIdx, sternBase + j + 1, sternBase + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const floatHullGeo = createSteppedFloatHullGeo();
const floatBumperGeo = new THREE.SphereGeometry(0.28, 8, 6);
floatBumperGeo.scale(0.95, 0.72, 1.35);
const pontoonDeckGeo = new THREE.BoxGeometry(1.12, 0.08, 12.6);
const pontoonRudderGeo = new THREE.BoxGeometry(0.1, 0.78, 0.95);

function populatePontoon(group, sideSign) {
  const hull = new THREE.Mesh(floatHullGeo, pontoonMat);
  group.add(hull);

  // Rubberized bow bumper nose cap
  const bumper = new THREE.Mesh(floatBumperGeo, pontoonDarkMat);
  bumper.position.set(0, 0.27, -10.75);
  group.add(bumper);

  // Non-skid flat walking deck strip
  const deck = new THREE.Mesh(pontoonDeckGeo, pontoonDarkMat);
  deck.position.set(0, 0.76, -1.2);
  group.add(deck);

  // Flush side livery accent stripe along outer & inner float flanks
  for (const flank of [-1, 1]) {
    const stripeShape = new THREE.Shape();
    stripeShape.moveTo(-7.2, 0.22);
    stripeShape.lineTo(5.8, 0.28);
    stripeShape.lineTo(6.6, 0.4);
    stripeShape.lineTo(-6.6, 0.42);
    stripeShape.closePath();
    const sGeo = new THREE.ExtrudeGeometry(stripeShape, {
      depth: 0.05,
      bevelEnabled: false,
      steps: 1,
    });
    sGeo.rotateY(flank > 0 ? Math.PI / 2 : -Math.PI / 2);
    sGeo.translate(flank * 0.96, 0, 0);
    const sMesh = new THREE.Mesh(sGeo, planeMat);
    sMesh.userData.matRole = 'accent';
    group.add(sMesh);
  }

  // Stern water rudder & hinge post
  const waterRudder = new THREE.Mesh(pontoonRudderGeo, pontoonDarkMat);
  waterRudder.position.set(0, -0.36, 9.15);
  group.add(waterRudder);

  // N-struts angling up to fuselage chine + twin horizontal spreader half-bars
  const strutGeo = new THREE.CylinderGeometry(0.1, 0.1, 4.9, 6);
  const strutF = new THREE.Mesh(strutGeo, pontoonStrutMat);
  strutF.position.set(-sideSign * 2.35, 2.15, -3.0);
  strutF.rotation.z = sideSign * 0.72;
  group.add(strutF);

  const strutB = new THREE.Mesh(strutGeo, pontoonStrutMat);
  strutB.position.set(-sideSign * 2.35, 2.15, 2.6);
  strutB.rotation.z = sideSign * 0.72;
  group.add(strutB);

  const diagStrutGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.7, 6);
  const strutDiag = new THREE.Mesh(diagStrutGeo, pontoonStrutMat);
  strutDiag.position.set(-sideSign * 2.35, 2.15, -0.2);
  strutDiag.rotation.set(0.68, 0, sideSign * 0.72);
  group.add(strutDiag);

  // Front & rear horizontal spreader bars tying left and right floats together
  const spreaderGeo = new THREE.CylinderGeometry(0.11, 0.11, 5.05, 8);
  spreaderGeo.rotateZ(Math.PI / 2);
  for (const sz of [-3.0, 2.6]) {
    const sp = new THREE.Mesh(spreaderGeo, pontoonStrutMat);
    sp.position.set(-sideSign * 2.5, 0.58, sz);
    group.add(sp);
  }

  mergeStaticMeshes(group);
  group.traverse((child) => {
    if (child.isMesh && child.material === planeMat) {
      child.userData.matRole = 'accent';
    }
  });
}

export const pontoonL = new THREE.Group();
populatePontoon(pontoonL, -1);
pontoonL.position.set(-5, -4.5, 0);
pontoonGroup.add(pontoonL);

export const pontoonR = new THREE.Group();
populatePontoon(pontoonR, 1);
pontoonR.position.set(5, -4.5, 0);
pontoonGroup.add(pontoonR);

export const hingeLF = new THREE.Group();
hingeLF.position.set(-5, 0, -3);
pontoonGroup.add(hingeLF);
export const hingeLB = new THREE.Group();
hingeLB.position.set(-5, 0, 3);
pontoonGroup.add(hingeLB);
export const hingeRF = new THREE.Group();
hingeRF.position.set(5, 0, -3);
pontoonGroup.add(hingeRF);
export const hingeRB = new THREE.Group();
hingeRB.position.set(5, 0, 3);
pontoonGroup.add(hingeRB);

// The seaplane: a de Havilland DHC-2 Beaver style bush floatplane. Model builder.
// The player's plane carries the shared pontoons; pass pontoons: false for another plane (traffic.js)
export function createSeaplaneModel(opts = {}) {
  const model = new THREE.Group();
  const activeWhiteMat = opts.planeWhiteMat || planeWhiteMat;
  const activePlaneMat = opts.planeMat || planeMat;
  const darkTrimMat = createMaterial({
    color: 0x1e232b,
    flatShading: true,
    roughness: 0.75,
  });
  const engineMetalMat = createMaterial({
    color: 0x8b95a3,
    flatShading: true,
    roughness: 0.38,
    metalness: 0.48,
  });
  const windowMat = createMaterial({
    color: 0x101824,
    roughness: 0.1,
    metalness: 0.72,
    transparent: true,
    opacity: 0.84,
  });

  // Super-ellipse helper: |cos|^e, |sin|^e smoothly morphs round cowling -> slab-rounded cabin -> oval tailcone
  const sgnPow = (v, exp) => Math.sign(v) * Math.pow(Math.abs(v), exp);
  const evalRing = (st, theta, scale = 1) => {
    const exp = 2 / st.p;
    const x = st.rx * scale * sgnPow(Math.cos(theta), exp);
    const y = st.cy + st.ry * scale * sgnPow(Math.sin(theta), exp);
    return [x, y];
  };

  // --- 1. LOFTED DHC-2 BEAVER FUSELAGE & SKIN-TIGHT LIVERY CHEATLINE ---
  const fuseGroup = new THREE.Group();
  const fuseStations = [
    {z: -8.65, rx: 1.62, ry: 1.64, cy: 0.06, p: 2.05}, // Firewall (matches radial cowling)
    {z: -6.65, rx: 1.64, ry: 1.68, cy: 0.12, p: 2.4}, // Base of V-windshield
    {z: -5.1, rx: 1.62, ry: 2.08, cy: 0.58, p: 3.3}, // Cabin roof brow / wing LE
    {z: -3.2, rx: 1.6, ry: 2.08, cy: 0.58, p: 3.3}, // Mid cabin
    {z: -1.45, rx: 1.52, ry: 1.98, cy: 0.52, p: 3.0}, // Aft cabin / wing TE
    {z: 0.55, rx: 1.24, ry: 1.5, cy: 0.34, p: 2.5}, // Porthole baggage bay
    {z: 3.4, rx: 0.82, ry: 1.08, cy: 0.34, p: 2.25}, // Mid tailcone
    {z: 6.2, rx: 0.42, ry: 0.78, cy: 0.44, p: 2.15}, // Empennage root
    {z: 7.35, rx: 0.14, ry: 0.62, cy: 0.52, p: 2.0}, // Vertical tailpost
  ];

  const segs = 14;
  const fPos = [];
  const fUvs = [];
  const fIdx = [];
  for (let i = 0; i < fuseStations.length; i++) {
    const st = fuseStations[i];
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const [x, y] = evalRing(st, theta);
      fPos.push(x, y, st.z);
      fUvs.push(s / segs, i / (fuseStations.length - 1));
    }
  }
  const fStride = segs + 1;
  for (let i = 0; i < fuseStations.length - 1; i++) {
    for (let s = 0; s < segs; s++) {
      const a = i * fStride + s;
      const b = i * fStride + s + 1;
      const c = (i + 1) * fStride + s;
      const d = (i + 1) * fStride + s + 1;
      fIdx.push(a, b, c, b, d, c);
    }
  }
  // Cap firewall & tailpost
  const fwIdx = fPos.length / 3;
  fPos.push(0, 0.06, -8.65);
  fUvs.push(0.5, 0);
  for (let s = 0; s < segs; s++) fIdx.push(fwIdx, s + 1, s);

  const tpBase = (fuseStations.length - 1) * fStride;
  const tpIdx = fPos.length / 3;
  fPos.push(0, 0.52, 7.38);
  fUvs.push(0.5, 1);
  for (let s = 0; s < segs; s++) fIdx.push(tpIdx, tpBase + s, tpBase + s + 1);

  const fuseGeo = new THREE.BufferGeometry();
  fuseGeo.setAttribute('position', new THREE.Float32BufferAttribute(fPos, 3));
  fuseGeo.setAttribute('uv', new THREE.Float32BufferAttribute(fUvs, 2));
  fuseGeo.setIndex(fIdx);
  fuseGeo.computeVertexNormals();
  fuseGroup.add(new THREE.Mesh(fuseGeo, activeWhiteMat));

  // Skin-tight lofted bush-plane livery cheatline along both flanks (sweeping up toward tail)
  for (const side of [-1, 1]) {
    const sPos = [];
    const sUvs = [];
    const sIdx = [];
    const bandRows = 4;
    const lastRing = fuseStations.length - 2; // Stops cleanly at empennage root (z = 6.2)
    for (let i = 0; i <= lastRing; i++) {
      const st = fuseStations[i];
      const t = i / lastRing;
      // Gently sweep the stripe upward toward the tail fin like classic Beaver bush liveries
      const centerAngle =
        side > 0 ? 0.05 + t * 0.24 : Math.PI - (0.05 + t * 0.24);
      const halfSpanAngle = 0.16 * (1 - t * 0.28);
      for (let r = 0; r <= bandRows; r++) {
        const frac = r / bandRows - 0.5;
        // Keep CCW theta progression so outward normal matches side
        const theta = centerAngle + frac * 2 * halfSpanAngle;
        const [x, y] = evalRing(st, theta, 1.014);
        sPos.push(x, y, st.z);
        sUvs.push(r / bandRows, t);
      }
    }
    const sStride = bandRows + 1;
    for (let i = 0; i < lastRing; i++) {
      for (let r = 0; r < bandRows; r++) {
        const a = i * sStride + r;
        const b = i * sStride + r + 1;
        const c = (i + 1) * sStride + r;
        const d = (i + 1) * sStride + r + 1;
        sIdx.push(a, b, c, b, d, c);
      }
    }
    const stripeGeo = new THREE.BufferGeometry();
    stripeGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(sPos, 3)
    );
    stripeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUvs, 2));
    stripeGeo.setIndex(sIdx);
    stripeGeo.computeVertexNormals();
    fuseGroup.add(new THREE.Mesh(stripeGeo, activePlaneMat));
  }
  model.add(fuseGroup);

  // --- 2. STOUT WASP JR RADIAL ENGINE COWLING, 9 CYLINDERS & CHIN SCOOP ---
  const cowlGroup = new THREE.Group();
  // Aft white cowling barrel (-10.15 to -8.65)
  const aftCowlProfile = [
    [1.58, -10.15],
    [1.62, -9.4],
    [1.62, -8.65],
  ];
  const aftCowlGeo = new THREE.LatheGeometry(
    aftCowlProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    14
  );
  aftCowlGeo.rotateX(Math.PI / 2);
  aftCowlGeo.scale(1.0, 1.01, 1.0);
  aftCowlGeo.translate(0, 0.06, 0);
  cowlGroup.add(new THREE.Mesh(aftCowlGeo, activeWhiteMat));

  // Front painted radial nose-bowl lip ring (-11.35 to -10.15) curving into cooling mouth
  const noseBowlProfile = [
    [1.04, -10.85], // Inner recessed cooling lip
    [1.16, -11.32], // Rounded front intake rim
    [1.38, -11.26], // Front nose bowl curve
    [1.54, -10.75],
    [1.585, -10.15],
  ];
  const noseBowlGeo = new THREE.LatheGeometry(
    noseBowlProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    14
  );
  noseBowlGeo.rotateX(Math.PI / 2);
  noseBowlGeo.scale(1.0, 1.01, 1.0);
  noseBowlGeo.translate(0, 0.06, 0);
  cowlGroup.add(new THREE.Mesh(noseBowlGeo, activePlaneMat));

  // Recessed dark engine baffle + 9-cylinder Wasp Jr radial star inside cowl opening
  const baffleGeo = new THREE.CylinderGeometry(1.08, 1.08, 0.35, 16);
  baffleGeo.rotateX(Math.PI / 2);
  baffleGeo.translate(0, 0.06, -10.78);
  cowlGroup.add(new THREE.Mesh(baffleGeo, darkTrimMat));

  const crankcaseGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.55, 12);
  crankcaseGeo.rotateX(Math.PI / 2);
  crankcaseGeo.translate(0, 0.06, -10.92);
  cowlGroup.add(new THREE.Mesh(crankcaseGeo, engineMetalMat));

  for (let c = 0; c < 9; c++) {
    const ang = (c / 9) * Math.PI * 2;
    const cylGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.56, 7);
    cylGeo.translate(0, 0.66, 0);
    cylGeo.rotateZ(ang);
    cylGeo.translate(0, 0.06, -10.95);
    cowlGroup.add(new THREE.Mesh(cylGeo, engineMetalMat));
  }

  // Signature DHC-2 Beaver underslung carburetor chin intake scoop
  const scoopOuterGeo = new THREE.BoxGeometry(0.84, 0.5, 1.85);
  const scPos = scoopOuterGeo.attributes.position;
  for (let i = 0; i < scPos.count; i++) {
    // Taper aft end of chin scoop smoothly into belly
    if (scPos.getZ(i) > 0) {
      scPos.setY(i, scPos.getY(i) * 0.55 + 0.12);
      scPos.setX(i, scPos.getX(i) * 0.78);
    }
  }
  scoopOuterGeo.computeVertexNormals();
  scoopOuterGeo.translate(0, -1.58, -9.95);
  cowlGroup.add(new THREE.Mesh(scoopOuterGeo, activePlaneMat));

  const scoopMouthGeo = new THREE.BoxGeometry(0.66, 0.34, 0.18);
  scoopMouthGeo.translate(0, -1.6, -10.82);
  cowlGroup.add(new THREE.Mesh(scoopMouthGeo, darkTrimMat));

  // Twin lower-cheek radial exhaust collector pipes (matches EXHAUSTS.seaplane)
  for (const side of [-1, 1]) {
    const exhGeo = new THREE.CylinderGeometry(0.11, 0.13, 1.05, 8);
    exhGeo.rotateX(Math.PI / 2 + 0.24);
    exhGeo.rotateZ(side * -0.28);
    exhGeo.translate(side * 1.44, -0.88, -9.3);
    cowlGroup.add(new THREE.Mesh(exhGeo, engineMetalMat));
  }
  model.add(cowlGroup);

  // --- 3. WRAPAROUND V-WINDSHIELD & BEAVER 3-WINDOW CABIN (WITH PORTHOLE!) ---
  const cabinGlassGroup = new THREE.Group();
  // Sloped two-pane V-windshield sitting cleanly proud of the cabin brow (-6.65 to -5.1)
  for (const side of [-1, 1]) {
    const paneGeo = new THREE.BoxGeometry(1.36, 1.28, 0.14);
    paneGeo.rotateY(side * -0.15);
    paneGeo.rotateX(0.72);
    paneGeo.translate(side * 0.69, 2.12, -5.96);
    cabinGlassGroup.add(new THREE.Mesh(paneGeo, windowMat));
  }
  // Crisp white center V-windshield divider post
  const centerPostGeo = new THREE.BoxGeometry(0.13, 1.32, 0.18);
  centerPostGeo.rotateX(0.72);
  centerPostGeo.translate(0, 2.15, -6.06);
  cabinGlassGroup.add(new THREE.Mesh(centerPostGeo, activeWhiteMat));

  // Side windows per flank: 1) Angled pilot door window, 2) Passenger window, 3) Round Beaver porthole!
  const frontWinShape = new THREE.Shape();
  frontWinShape.moveTo(-4.88, 1.18);
  frontWinShape.lineTo(-3.66, 1.18);
  frontWinShape.lineTo(-3.66, 2.15);
  frontWinShape.lineTo(-4.52, 2.15);
  frontWinShape.closePath();
  const baseFrontWinGeo = new THREE.ExtrudeGeometry(frontWinShape, {
    depth: 0.1,
    bevelEnabled: false,
    steps: 1,
  });
  baseFrontWinGeo.translate(0, 0, -0.05);
  // rotateY(-PI/2) maps (x, y, z) -> (-z, y, +x), keeping x = -4.88..-3.66 at z = -4.88..-3.66 on BOTH sides!
  baseFrontWinGeo.rotateY(-Math.PI / 2);

  for (const side of [-1, 1]) {
    // 1. Front pilot door window
    const frontWinMesh = new THREE.Mesh(baseFrontWinGeo, windowMat);
    frontWinMesh.position.set(side * 1.58, 0, 0);
    cabinGlassGroup.add(frontWinMesh);

    // 2. Rectangular mid passenger door window
    const midWinGeo = new THREE.BoxGeometry(0.1, 0.94, 1.32);
    midWinGeo.translate(side * 1.57, 1.65, -2.62);
    cabinGlassGroup.add(new THREE.Mesh(midWinGeo, windowMat));

    // 3. Signature circular rear DHC-2 Beaver porthole window
    const portholeGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12);
    portholeGeo.rotateZ(Math.PI / 2);
    portholeGeo.rotateY(side * -0.14);
    portholeGeo.translate(side * 1.32, 1.38, -0.58);
    cabinGlassGroup.add(new THREE.Mesh(portholeGeo, windowMat));
  }
  model.add(cabinGlassGroup);

  // --- 4. CAMBERED AIRFOIL STOL HIGH WING, LIFT STRUTS & JURY STRUTS ---
  const wingGroup = new THREE.Group();
  // Cambered NACA bush airfoil: with rotateY(-PI/2), shape +X maps to +Z (aft) and shape -X maps to -Z (forward)!
  const buildAirfoilShape = (chord, thick) => {
    const sh = new THREE.Shape();
    const zLE = -chord * 0.5; // Maps to world -Z (leading edge!)
    const zTE = chord * 0.5; // Maps to world +Z (trailing edge!)
    sh.moveTo(zLE, 0.0);
    // Upper cambered surface: thick rounded nose near zLE tapering to sharp trailing edge at zTE
    sh.bezierCurveTo(
      zLE,
      thick * 0.78,
      zLE + chord * 0.26,
      thick * 0.92,
      zLE + chord * 0.5,
      thick * 0.66
    );
    sh.quadraticCurveTo(zLE + chord * 0.78, thick * 0.34, zTE, -thick * 0.06);
    // Lower surface
    sh.quadraticCurveTo(
      zLE + chord * 0.55,
      -thick * 0.16,
      zLE + chord * 0.18,
      -thick * 0.24
    );
    sh.quadraticCurveTo(zLE, -thick * 0.2, zLE, 0.0);
    return sh;
  };

  const wingChord = 4.35;
  const wingThick = 0.54;
  const wingAirfoil = buildAirfoilShape(wingChord, wingThick);

  // Main high wing (-13.6 to +13.6) sitting flush on cabin roof
  // Note: rotateY(-PI/2) maps (x_shape, y_shape, z_extrude) -> (-z_extrude, y_shape, +x_shape)
  const mainWingGeo = new THREE.ExtrudeGeometry(wingAirfoil, {
    depth: 27.2,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 5,
  });
  mainWingGeo.translate(0, 0, -13.6);
  mainWingGeo.rotateY(-Math.PI / 2);
  mainWingGeo.translate(0, 2.58, -3.35);
  wingGroup.add(new THREE.Mesh(mainWingGeo, activeWhiteMat));

  // Tapered aerodynamic bush wingtips in player livery color (x = ±13.6 to ±16.2, zero seam overlap!)
  for (const side of [-1, 1]) {
    const tipGeo = new THREE.ExtrudeGeometry(wingAirfoil, {
      depth: 2.6,
      bevelEnabled: false,
      steps: 2,
      curveSegments: 5,
    });
    // Extrude is z = 0..2.6; after rotateY(-PI/2), x_world = -z_extrude = 0..-2.6 (left wing!).
    // For right wing (side > 0), translate z by -2.6 first so x_world = 0..+2.6 without mirroring Z!
    if (side > 0) tipGeo.translate(0, 0, -2.6);
    tipGeo.rotateY(-Math.PI / 2);
    const tPos = tipGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const spanFrac = Math.max(0, Math.abs(tPos.getX(i)) / 2.6);
      // Beaver outer leading-edge taper + subtle upward Hoerner STOL wingtip cant
      tPos.setZ(i, tPos.getZ(i) * (1 - spanFrac * 0.3) + spanFrac * 0.38);
      tPos.setY(i, tPos.getY(i) * (1 - spanFrac * 0.42) + spanFrac * 0.16);
    }
    tipGeo.computeVertexNormals();
    tipGeo.translate(side * 13.6, 2.58, -3.35);
    wingGroup.add(new THREE.Mesh(tipGeo, activePlaneMat));

    // Streamlined wing lift strut from lower cabin frame up to mid-wing + vertical jury strut
    const p1 = new THREE.Vector3(side * 1.48, -0.42, -3.55);
    const p2 = new THREE.Vector3(side * 8.6, 2.56, -3.55);
    const strutLen = p1.distanceTo(p2);
    const liftStrutGeo = new THREE.CylinderGeometry(0.11, 0.11, strutLen, 8);
    liftStrutGeo.scale(0.65, 1.0, 1.55); // Streamlined airfoil strut section
    const liftStrut = new THREE.Mesh(liftStrutGeo, activeWhiteMat);
    liftStrut.position.addVectors(p1, p2).multiplyScalar(0.5);
    liftStrut.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3().subVectors(p2, p1).normalize()
    );
    wingGroup.add(liftStrut);

    // Vertical jury strut bracing mid-lift-strut up to wing underside
    const jx = side * 5.6;
    const jyBottom = THREE.MathUtils.lerp(
      -0.42,
      2.56,
      (5.6 - 1.48) / (8.6 - 1.48)
    );
    const juryH = 2.58 - jyBottom;
    const juryGeo = new THREE.CylinderGeometry(0.045, 0.045, juryH, 6);
    juryGeo.translate(jx, jyBottom + juryH * 0.5, -3.55);
    wingGroup.add(new THREE.Mesh(juryGeo, engineMetalMat));
  }
  model.add(wingGroup);

  // --- 5. CURVED DE HAVILLAND TAIL, FLOATPLANE VENTRAL FIN & STABILIZER ---
  const tailGroup = new THREE.Group();

  // Classic curved de Havilland vertical fin & oval-top rudder + dorsal fillet
  const finShape = new THREE.Shape();
  finShape.moveTo(1.8, 1.18); // Dorsal strake start
  finShape.quadraticCurveTo(3.8, 1.38, 4.75, 2.25); // Sweeping dorsal fillet
  finShape.quadraticCurveTo(5.45, 3.85, 5.95, 4.88); // Curved leading edge
  finShape.bezierCurveTo(6.2, 5.32, 7.15, 5.32, 7.38, 4.78); // Rounded de Havilland crown
  finShape.quadraticCurveTo(7.62, 3.1, 7.45, 0.85); // Curved rudder trailing edge
  finShape.lineTo(4.5, 0.75);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    curveSegments: 10,
  });
  finGeo.translate(0, 0, -0.11);
  finGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(finGeo, activePlaneMat));

  // Crisp white horizontal rudder flash band near crown
  const finBandGeo = new THREE.BoxGeometry(0.32, 0.24, 1.52);
  finBandGeo.translate(0, 4.35, 6.68);
  tailGroup.add(new THREE.Mesh(finBandGeo, activeWhiteMat));

  // Floatplane Beaver ventral fin under tailcone (offsets float forward area)
  const vFinUnderShape = new THREE.Shape();
  vFinUnderShape.moveTo(3.1, 0.15);
  vFinUnderShape.lineTo(5.8, -0.54);
  vFinUnderShape.lineTo(7.05, -0.36);
  vFinUnderShape.lineTo(7.15, 0.35);
  vFinUnderShape.closePath();
  const vFinUnderGeo = new THREE.ExtrudeGeometry(vFinUnderShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  vFinUnderGeo.translate(0, 0, -0.06);
  vFinUnderGeo.rotateY(-Math.PI / 2);
  tailGroup.add(new THREE.Mesh(vFinUnderGeo, activePlaneMat));

  // Tapered airfoil horizontal stabilizer + rounded livery tips
  const hTailAirfoil = buildAirfoilShape(2.65, 0.28);
  const hCenterGeo = new THREE.ExtrudeGeometry(hTailAirfoil, {
    depth: 8.2,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 4,
  });
  hCenterGeo.translate(0, 0, -4.1);
  hCenterGeo.rotateY(-Math.PI / 2);
  hCenterGeo.translate(0, 0.72, 5.85);
  tailGroup.add(new THREE.Mesh(hCenterGeo, activeWhiteMat));

  for (const side of [-1, 1]) {
    const hTipGeo = new THREE.ExtrudeGeometry(hTailAirfoil, {
      depth: 1.35,
      bevelEnabled: false,
      steps: 2,
      curveSegments: 4,
    });
    if (side > 0) hTipGeo.translate(0, 0, -1.35);
    hTipGeo.rotateY(-Math.PI / 2);
    const hp = hTipGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      const f = Math.max(0, Math.abs(hp.getX(i)) / 1.35);
      hp.setZ(i, hp.getZ(i) * (1 - f * 0.36) + f * 0.24);
      hp.setY(i, hp.getY(i) * (1 - f * 0.42));
    }
    hTipGeo.computeVertexNormals();
    hTipGeo.translate(side * 4.1, 0.72, 5.85);
    tailGroup.add(new THREE.Mesh(hTipGeo, activePlaneMat));
  }
  model.add(tailGroup);

  // --- 6. SCULPTED HARTZELL BUSH PROPELLER WITH ACCENT SPINNER & TIP STRIPES ---
  const propGroup = new THREE.Group();
  propGroup.position.set(0, 0.06, -11.42);
  model.add(propGroup);

  const spinnerBackGeo = new THREE.CylinderGeometry(0.54, 0.56, 0.28, 12);
  spinnerBackGeo.rotateX(Math.PI / 2);
  propGroup.add(new THREE.Mesh(spinnerBackGeo, engineMetalMat));

  const spinnerProfile = [
    [0.0, -1.45],
    [0.24, -1.05],
    [0.44, -0.55],
    [0.54, -0.12],
  ];
  const spinnerConeGeo = new THREE.LatheGeometry(
    spinnerProfile.map(([r, z]) => new THREE.Vector2(r, z)),
    12
  );
  spinnerConeGeo.rotateX(Math.PI / 2);
  propGroup.add(new THREE.Mesh(spinnerConeGeo, activePlaneMat));

  // 4 tapered paddle blades with pitch twist & high-vis white tip bands
  const bladeMat = createMaterial({
    color: 0x1c2026,
    flatShading: true,
    roughness: 0.45,
  });
  const bladeTipMat = createMaterial({
    color: 0xfacc15,
    flatShading: true,
    roughness: 0.4,
  });

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.12, 0.35);
  bladeShape.quadraticCurveTo(-0.34, 1.8, -0.28, 3.85);
  bladeShape.lineTo(0.24, 3.85);
  bladeShape.quadraticCurveTo(0.3, 1.8, 0.12, 0.35);
  bladeShape.closePath();
  const singleBladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.08,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 6,
  });
  singleBladeGeo.translate(0, 0, -0.04);

  const tipBandGeo = new THREE.BoxGeometry(0.5, 0.42, 0.085);
  tipBandGeo.translate(-0.02, 4.06, 0);

  for (let b = 0; b < 4; b++) {
    const holder = new THREE.Group();
    holder.rotation.z = (b * Math.PI) / 2;
    const bMesh = new THREE.Mesh(singleBladeGeo, bladeMat);
    bMesh.rotation.y = 0.22;
    holder.add(bMesh);
    const tMesh = new THREE.Mesh(tipBandGeo, bladeTipMat);
    tMesh.rotation.y = 0.22;
    holder.add(tMesh);
    propGroup.add(holder);
  }
  mergeStaticMeshes(propGroup);

  model.propGroup = propGroup;

  // Add pontoons
  if (opts.pontoons !== false) {
    model.add(pontoonGroup);
    model.pontoonGroup = pontoonGroup;
  }

  mergeStaticMeshes(model, new Set([propGroup, pontoonGroup]));
  return model;
}

// Active plane state and switching
export let activePlaneType =
  ChillFlightLogic.START_PLANE ||
  ChillFlightLogic.normalizePlaneType(
    localStorage.getItem('chill_flight_plane')
  ) ||
  'biplane';

// Poses the landing gear for how far down it is (state.gearExtension, 0 up to
// 1 down): the seaplane's pontoons swing down on their hinges and grow, and
// the twin's and jet's wheels unfold
export function poseGear(extension) {
  const ease = 1 - Math.pow(1 - extension, 3);
  pontoonGroup.visible = extension > 0;
  pontoonGroup.scale.setScalar(ease);
  const fold = (Math.PI / 2) * (1 - ease);
  pontoonL.rotation.z = fold;
  hingeLF.rotation.z = fold;
  hingeLB.rotation.z = fold;
  pontoonR.rotation.z = -fold;
  hingeRF.rotation.z = -fold;
  hingeRB.rotation.z = -fold;
  pontoonL.position.y = -0.5 - 4.0 * ease;
  pontoonR.position.y = -0.5 - 4.0 * ease;
  if (state.airplaneModel?.gearGroups) {
    setGearExtension(state.airplaneModel, ease);
  }
}

// The active plane's speed and handling (PLANE_HANDLING in constants.js)
export function planeHandling() {
  return PLANE_HANDLING[activePlaneType];
}

export function getMaxFlightSpeedMult() {
  return (
    (planeHandling().topKts / (BASE_FLIGHT_SPEED * 60)) *
    (state.mpSpeedBoost || 1)
  );
}

// The pause menu's bars for the active vehicle's handling, each a fraction of
// the best: top speed and agility
function updatePlaneStats() {
  const stats = document.getElementById('plane-stats');
  if (!stats) return;
  const vehicles = Object.values(PLANE_HANDLING);
  const h = planeHandling();
  const values = {
    speed: h.topKts / Math.max(...vehicles.map((v) => v.topKts)),
    agility: h.agility / Math.max(...vehicles.map((v) => v.agility)),
  };
  for (const [stat, value] of Object.entries(values)) {
    stats
      .querySelector(`[data-stat="${stat}"]`)
      ?.style.setProperty('--v', value.toFixed(3));
  }
}

export function setActivePlane(planeType, skipStorage = false) {
  if (!ChillFlightLogic.PLANE_TYPES.includes(planeType)) return;
  if (state.mpLockedPlane && planeType !== state.mpLockedPlane) return;
  activePlaneType = planeType;
  state.planeType = planeType;
  if (!skipStorage) {
    try {
      localStorage.setItem('chill_flight_plane', planeType);
    } catch {
      /* ignore */
    }
  }

  // Smoothly ramp down speed if switching to a plane with a lower max speed
  if (typeof state.targetFlightSpeed !== 'undefined') {
    state.targetFlightSpeed = Math.min(
      state.targetFlightSpeed,
      getMaxFlightSpeedMult()
    );
  }

  // Switching from another plane, rather than the game loading
  const switching = !!state.airplaneModel;
  // Remove existing model from planeGroup
  if (state.airplaneModel && planeGroup) {
    planeGroup.remove(state.airplaneModel);
  }

  // Build new model
  let newModel;
  if (planeType === 'biplane') {
    newModel = createBiplaneModel({
      planeColor:
        typeof state.planeColor !== 'undefined' ? state.planeColor : 0xffffff,
      planeMat: planeMat,
      planeWhiteMat: planeWhiteMat,
    });
  } else if (planeType === 'jet') {
    newModel = createJetModel({
      planeColor:
        typeof state.planeColor !== 'undefined' ? state.planeColor : 0xffffff,
      planeMat: planeMat,
      planeWhiteMat: planeWhiteMat,
    });
  } else if (planeType === 'buggy') {
    newModel = createBuggyModel({
      planeColor:
        typeof state.planeColor !== 'undefined' ? state.planeColor : 0xffffff,
      planeMat: planeMat,
      planeWhiteMat: planeWhiteMat,
    });
  } else if (planeType === 'twin') {
    newModel = createTwinModel({
      planeColor:
        typeof state.planeColor !== 'undefined' ? state.planeColor : 0xffffff,
      planeMat: planeMat,
      planeWhiteMat: planeWhiteMat,
    });
  } else {
    newModel = createSeaplaneModel({
      planeColor:
        typeof state.planeColor !== 'undefined' ? state.planeColor : 0xffffff,
      planeMat: planeMat,
      planeWhiteMat: planeWhiteMat,
    });
  }

  // How far the wheels reach below the plane's center, for landing on land
  // (flight-physics.js). The seaplane sets down on its pontoons, measured
  // with them all the way down.
  if (planeType === 'seaplane') poseGear(1);
  newModel.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(newModel);
  newModel.wheelDepth = -box.min.y;
  // How far the wingtips and the nose reach, for scraping walls
  // (wall-scrape.js)
  newModel.halfSpan = Math.max(-box.min.x, box.max.x);
  newModel.noseLength = -box.min.z;
  if (planeType === 'seaplane') poseGear(state.gearExtension);

  // The buggy drops from where the plane was (buggy.js)
  newModel.switchedTo = switching;
  state.airplaneModel = newModel;
  // Active vehicle class for styling
  document.body.classList.toggle('vehicle-buggy', planeType === 'buggy');
  // The jet and the buggy have no prop
  state.propGroup = newModel.propGroup || null;
  state.propGroups =
    newModel.propGroups || (state.propGroup ? [state.propGroup] : []);
  planeGroup.add(newModel);

  // Enable shadow casting
  newModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
  softenAnimeLight(newModel);

  // Update UI buttons if present in pause overlay
  const planeSelectGroup = document.getElementById('plane-select-group');
  if (planeSelectGroup) {
    planeSelectGroup.querySelectorAll('.scheme-btn').forEach((btn) => {
      const active = btn.getAttribute('data-plane') === planeType;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }
  updatePlaneStats();
  hooks.updateThrottle?.();

  // Update URL parameters
  updateUrlParams({plane: planeType}, ['plane', 'vehicle']);
}

// Locks everyone to one plane while a multiplayer game is active
// (multiplayer.js), without overwriting their saved solo choice; null
// unlocks. Everyone stays in the game's vehicle afterwards, hanging out
// together, until they pick another.
export function setLockedPlane(planeType) {
  state.mpLockedPlane =
    planeType && ChillFlightLogic.PLANE_TYPES.includes(planeType)
      ? planeType
      : null;
  if (state.mpLockedPlane && activePlaneType !== state.mpLockedPlane) {
    setActivePlane(state.mpLockedPlane, true);
  }
  const planeSelectGroup = document.getElementById('plane-select-group');
  if (planeSelectGroup) {
    planeSelectGroup.querySelectorAll('.scheme-btn').forEach((btn) => {
      btn.disabled = !!state.mpLockedPlane;
    });
  }
}

// Vehicles left out of PLANE_TYPES get no button in the pause menu
document.querySelectorAll('#plane-select-group .scheme-btn').forEach((btn) => {
  if (!ChillFlightLogic.PLANE_TYPES.includes(btn.dataset.plane)) btn.remove();
});

// Initialize active plane model
setActivePlane(activePlaneType, true);

// Better rotation order for airplanes
planeGroup.rotation.order = 'YXZ';

// Headlight
export const HEADLIGHT_COLOR = new THREE.Color(0xffd1a3);
export const headlight = new THREE.SpotLight(HEADLIGHT_COLOR, 0);
headlight.position.set(0, 0, -10);

const headlightTarget = new THREE.Object3D();
// Aimed ~7 degrees below the nose with a 30-degree cone, so the pool of light
// sits ahead of the plane rather than below it.
headlightTarget.position.set(0, -12, -100);
planeGroup.add(headlightTarget);
headlight.target = headlightTarget;

headlight.angle = Math.PI / 6;
headlight.penumbra = 0.8;
// No inverse-square falloff (decay 0): with it, the pool of light on the
// ground was ~1% as bright at cruise altitude (400+ units away) as at 40
// units, and vanished unless flying at ground level (#78). Instead it fades
// out smoothly near `distance`, as the light did before three.js's physical
// light units, so it lights the ground from typical flight altitudes.
headlight.distance = 3500;
headlight.decay = 0;

export const headlightGlow = new THREE.PointLight(0xffd1a3, 0, 50);
headlightGlow.position.set(0, 5, 0);
// three.js r155+ uses physical light units (candela). The glow's intensity is
// converted from the legacy-tuned value (~5 m out); r128 PointLight default
// decay was 1, so keep that explicitly. The spotlight's (with decay 0 above)
// was tuned on night flights at 120 to 900 units up.
export const HEADLIGHT_INTENSITY = 6;
export const HEADLIGHT_GLOW_INTENSITY = 0.3;
headlightGlow.decay = 1;
planeGroup.add(headlightGlow);
planeGroup.add(headlight);

// The buggy's lamps sit low on its nose (buggy-model.js), and its beam is
// mostly the pool on the ground (headlightPoolUniforms in constants.js); the
// spotlight from there still lights trees, houses and hillsides ahead.
const PLANE_BEAM = {pos: [0, 0, -10], target: [0, -12, -100]};
const BUGGY_BEAM = {pos: [0, 2.75, -4.7], target: [0, 1, -100]};
const BUGGY_POOL_BRIGHTNESS = 0.9;
const _beamPos = new THREE.Vector3();
const _beamTarget = new THREE.Vector3();

// The plane's beam has no falloff with distance (see above), so it lit a
// bright pool on the ground even from well over a kilometre up. It fades
// with the plane's height over the ground instead: full below
// PLANE_BEAM_FADE.x, gone by .y (on/off stays headlight.intensity, so it's
// the colour that dims)
const PLANE_BEAM_FADE = {x: 350, y: 1100};
// How much daylight dims both lamps (1 = gone at full day)
const DAYLIGHT_DIM = 0.8;

// Each frame: place the beam for the vehicle, dim the plane's with its
// height over the ground (groundY under it), and point the pool where it
// shines (only while driving with the lights on).
export function updateHeadlightBeam(driving, groundY) {
  const beam = driving ? BUGGY_BEAM : PLANE_BEAM;
  const fade = driving
    ? 1
    : 1 -
      THREE.MathUtils.smoothstep(
        planeGroup.position.y - groundY,
        PLANE_BEAM_FADE.x,
        PLANE_BEAM_FADE.y
      );
  // In daylight the lamp barely shows against the sun, as a real one
  // would: at full strength it blew rock walls out to white close up
  const day = Math.min(1, state.dayFactor ?? 0);
  headlight.color
    .copy(HEADLIGHT_COLOR)
    .multiplyScalar(fade * (1 - DAYLIGHT_DIM * day));
  headlight.position.fromArray(beam.pos);
  headlightTarget.position.fromArray(beam.target);
  const pool = headlightPoolUniforms;
  if (!driving || headlight.intensity === 0) {
    pool.uHeadlightColor.value.setRGB(0, 0, 0);
    return;
  }
  planeGroup.updateMatrixWorld();
  planeGroup.localToWorld(_beamPos.fromArray(beam.pos));
  planeGroup.localToWorld(_beamTarget.fromArray(beam.target));
  pool.uHeadlightPos.value.copy(_beamPos);
  pool.uHeadlightDir.value.subVectors(_beamTarget, _beamPos).normalize();
  pool.uHeadlightColor.value
    .copy(headlight.color)
    .multiplyScalar(BUGGY_POOL_BRIGHTNESS);
}

// Initial position
let startX = initialSpawn.x;
let startZ = initialSpawn.z;
let startY = initialSpawn.y;

const urlLatVal = ChillFlightLogic.parsedLat;
const urlLonVal = ChillFlightLogic.parsedLon;
const urlAltVal = ChillFlightLogic.parsedAlt;

if (urlLatVal !== null && urlLatVal !== undefined) {
  startZ = -urlLatVal * 5000;
}
if (urlLonVal !== null && urlLonVal !== undefined) {
  startX = urlLonVal * 5000;
}

if (urlAltVal !== null && urlAltVal !== undefined) {
  startY = urlAltVal / UNITS_TO_M + 45.5;
} else if (urlLatVal !== null || urlLonVal !== null) {
  // If starting position was specified, calculate terrain elevation at startX, startZ
  // to ensure player starts at a safe altitude above the ground (e.g. 400 units above terrain)
  try {
    const terrainHeight = ChillFlightLogic.getElevation(
      startX,
      startZ,
      simplex,
      {
        WATER_LEVEL,
        MAP_WORLD_SIZE,
        MAP_HEIGHT_SCALE,
      }
    );
    startY = terrainHeight + 400.0;
  } catch (e) {
    console.warn(
      'Failed to calculate exact starting height, using default flying altitude:',
      e
    );
    startY = 445.5;
  }
}

planeGroup.position.set(startX, startY, startZ);

// Enable shadow casting for the vehicle (receiveShadow disabled to prevent
// self-shadowing strobe artifacts at low sun angles)
planeGroup.traverse((child) => {
  if (child.isMesh) {
    child.castShadow = true;
    child.receiveShadow = false;
  }
});
