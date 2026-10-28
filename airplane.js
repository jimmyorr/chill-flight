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
import {createBiplaneModel} from './biplane.js';
import {createTwinModel, setGearExtension} from './twin.js';
import {createJetModel} from './jet.js';
import {createBuggyModel} from './buggy-model.js';
import {simplex} from './noise.js';
import {state} from './state.js';
import {softenAnimeLight} from './art-style.js';

export const planeGroup = new THREE.Group();
// Turned so the Falls aren't dead ahead (spawnYaw), unless heading specified in URL
planeGroup.rotation.y =
  ChillFlightLogic.START_HEADING !== null
    ? THREE.MathUtils.degToRad(ChillFlightLogic.START_HEADING)
    : ChillFlightLogic.spawnYaw();
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

const pontoonMat = createMaterial({color: 0xd8dee6, flatShading: true});
const pontoonDarkMat = createMaterial({color: 0x2c323b, flatShading: true});
const pontoonGeo = new THREE.CylinderGeometry(1.05, 0.95, 13.5, 10);
pontoonGeo.rotateX(Math.PI / 2);
const pontoonNoseGeo = new THREE.ConeGeometry(1.05, 3.4, 10);
pontoonNoseGeo.rotateX(-Math.PI / 2);
const pontoonTailGeo = new THREE.CylinderGeometry(0.45, 0.95, 3.2, 10);
pontoonTailGeo.rotateX(Math.PI / 2);
const pontoonDeckGeo = new THREE.BoxGeometry(1.15, 0.18, 12.5);
const pontoonRudderGeo = new THREE.BoxGeometry(0.12, 0.9, 1.1);

function populatePontoon(group, sideSign) {
  const body = new THREE.Mesh(pontoonGeo, pontoonMat);
  body.scale.set(1, 0.76, 1);
  body.position.set(0, 0, -0.5);
  group.add(body);

  const nose = new THREE.Mesh(pontoonNoseGeo, pontoonMat);
  nose.scale.set(1, 0.76, 1);
  nose.position.set(0, 0, -8.95);
  group.add(nose);

  const tail = new THREE.Mesh(pontoonTailGeo, pontoonMat);
  tail.scale.set(1, 0.76, 1);
  tail.position.set(0, 0.08, 7.85);
  group.add(tail);

  const deck = new THREE.Mesh(pontoonDeckGeo, pontoonDarkMat);
  deck.position.set(0, 0.75, -0.5);
  group.add(deck);

  const waterRudder = new THREE.Mesh(pontoonRudderGeo, pontoonDarkMat);
  waterRudder.position.set(0, -0.35, 9.5);
  group.add(waterRudder);

  const strutGeo = new THREE.CylinderGeometry(0.11, 0.11, 5.0, 6);
  const strutF = new THREE.Mesh(strutGeo, pontoonMat);
  strutF.position.set(-sideSign * 2.5, 2.0, -3);
  strutF.rotation.z = sideSign * (Math.PI / 4);
  group.add(strutF);

  const strutB = new THREE.Mesh(strutGeo, pontoonMat);
  strutB.position.set(-sideSign * 2.5, 2.0, 3);
  strutB.rotation.z = sideSign * (Math.PI / 4);
  group.add(strutB);

  const diagStrutGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.8, 6);
  const strutDiag = new THREE.Mesh(diagStrutGeo, pontoonMat);
  strutDiag.position.set(-sideSign * 2.5, 2.0, 0);
  strutDiag.rotation.set(0.68, 0, sideSign * (Math.PI / 4));
  group.add(strutDiag);
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

// The seaplane: a Cessna-style monoplane on floats. Model builder. The player's plane carries the
// shared pontoons; pass pontoons: false for another plane (traffic.js)
export function createSeaplaneModel(opts = {}) {
  const model = new THREE.Group();
  const activeWhiteMat = opts.planeWhiteMat || planeWhiteMat;
  const activePlaneMat = opts.planeMat || planeMat;
  const darkTrimMat = createMaterial({color: 0x22252a, flatShading: true});

  // Fuselage (Main Body)
  const bodyGeo = new THREE.CylinderGeometry(0.68, 1.82, 14, 10);
  bodyGeo.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(bodyGeo, activeWhiteMat);
  body.position.set(0, 0, -2);
  body.scale.set(1, 1.3, 1);
  model.add(body);

  // Nose Cowling + lower air intake scoop
  const noseGeo = new THREE.CylinderGeometry(1.82, 1.02, 2.6, 10);
  noseGeo.rotateX(Math.PI / 2);
  const nose = new THREE.Mesh(noseGeo, activeWhiteMat);
  nose.position.set(0, 0, -10.25);
  nose.scale.set(1, 1.3, 1);
  model.add(nose);

  const scoopGeo = new THREE.BoxGeometry(0.95, 0.55, 1.4);
  const scoop = new THREE.Mesh(scoopGeo, darkTrimMat);
  scoop.position.set(0, -1.25, -10.55);
  model.add(scoop);

  // Cabin / Cockpit with sloped rear dorsal spine transition
  const cabinGeo = new THREE.BoxGeometry(2.62, 2.0, 4.2);
  const cabin = new THREE.Mesh(cabinGeo, activeWhiteMat);
  cabin.position.set(0, 1.5, -3.5);
  model.add(cabin);

  const rearCabinGeo = new THREE.CylinderGeometry(0.55, 1.35, 4.2, 8);
  rearCabinGeo.rotateX(Math.PI / 2);
  const rearCabin = new THREE.Mesh(rearCabinGeo, activeWhiteMat);
  rearCabin.position.set(0, 1.15, 0.3);
  rearCabin.scale.set(0.95, 0.85, 1);
  model.add(rearCabin);

  // Windshield & Side Windows
  const windowMat = createMaterial({color: 0x11161f, roughness: 0.1});
  const windowGeo = new THREE.BoxGeometry(2.66, 1.75, 1.55);
  const cockpit = new THREE.Mesh(windowGeo, windowMat);
  cockpit.position.set(0, 1.78, -5.55);
  cockpit.rotation.x = Math.PI / 5.5;
  model.add(cockpit);

  const sideWindowGeo = new THREE.BoxGeometry(2.72, 1.02, 2.2);
  const sideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
  sideWindow.position.set(0, 1.72, -3.55);
  model.add(sideWindow);

  const rearWindowGeo = new THREE.BoxGeometry(2.68, 0.72, 1.1);
  const rearWindow = new THREE.Mesh(rearWindowGeo, windowMat);
  rearWindow.position.set(0, 1.62, -1.6);
  model.add(rearWindow);

  // Accent Fuselage Stripe + Nose Cowling Accent Band
  const stripeGeo = new THREE.BoxGeometry(3.05, 0.42, 13.4);
  const stripe = new THREE.Mesh(stripeGeo, activePlaneMat);
  stripe.position.set(0, 0.22, -2.2);
  model.add(stripe);

  // High-wing center section & main wings with tapered tips
  const mainWingGeo = new THREE.BoxGeometry(27.6, 0.48, 4.5);
  const mainWings = new THREE.Mesh(mainWingGeo, activeWhiteMat);
  mainWings.position.set(0, 2.82, -3.5);
  model.add(mainWings);

  const createTaperedTip = (span, chord, thickness, sign) => {
    const geo = new THREE.BoxGeometry(span, thickness, chord);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      if (sign * x > 0) {
        pos.setZ(i, pos.getZ(i) * 0.68 + 0.35);
        pos.setY(i, pos.getY(i) * 0.72);
      }
    }
    geo.computeVertexNormals();
    return geo;
  };

  const wingTipL = new THREE.Mesh(
    createTaperedTip(2.4, 4.5, 0.48, -1),
    activePlaneMat
  );
  wingTipL.position.set(-15.0, 2.82, -3.5);
  model.add(wingTipL);

  const wingTipR = new THREE.Mesh(
    createTaperedTip(2.4, 4.5, 0.48, 1),
    activePlaneMat
  );
  wingTipR.position.set(15.0, 2.82, -3.5);
  model.add(wingTipR);

  // Wing Struts + Jury Struts
  const wingStrutGeo = new THREE.CylinderGeometry(0.14, 0.14, 7.6, 6);
  const wingStrutL = new THREE.Mesh(wingStrutGeo, activeWhiteMat);
  wingStrutL.position.set(-4.5, 1.65, -3.5);
  wingStrutL.rotation.z = Math.PI * 0.4;
  model.add(wingStrutL);

  const wingStrutR = new THREE.Mesh(wingStrutGeo, activeWhiteMat);
  wingStrutR.position.set(4.5, 1.65, -3.5);
  wingStrutR.rotation.z = -Math.PI * 0.4;
  model.add(wingStrutR);

  // Tail (Empennage) - Horizontal Stabilizer with tapered tips
  const tailCenterGeo = new THREE.BoxGeometry(8.0, 0.38, 3.0);
  const tailCenter = new THREE.Mesh(tailCenterGeo, activeWhiteMat);
  tailCenter.position.set(0, 0.55, 5.5);
  model.add(tailCenter);

  const tailTipL = new THREE.Mesh(
    createTaperedTip(1.3, 3.0, 0.38, -1),
    activePlaneMat
  );
  tailTipL.position.set(-4.65, 0.55, 5.5);
  model.add(tailTipL);

  const tailTipR = new THREE.Mesh(
    createTaperedTip(1.3, 3.0, 0.38, 1),
    activePlaneMat
  );
  tailTipR.position.set(4.65, 0.55, 5.5);
  model.add(tailTipR);

  // Rudder (Vertical Stabilizer) with dorsal strake fillet
  const rudderShape = new THREE.Shape();
  rudderShape.moveTo(-1.2, 0); // Forward dorsal fillet
  rudderShape.lineTo(3.2, 0);
  rudderShape.lineTo(2.6, 4.3);
  rudderShape.lineTo(1.1, 4.3);
  rudderShape.lineTo(0.1, 0.9);
  rudderShape.closePath();

  const extrudeSettings = {
    depth: 0.32,
    bevelEnabled: true,
    bevelSegments: 1,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  };
  const rudderGeo = new THREE.ExtrudeGeometry(rudderShape, extrudeSettings);
  rudderGeo.translate(-1.5, 0, -0.16);
  rudderGeo.rotateY(Math.PI / -2);
  const rudder = new THREE.Mesh(rudderGeo, activePlaneMat);
  rudder.position.set(0, 0.65, 5.3);
  model.add(rudder);

  // Propeller with pointed accent spinner cone
  const propGroup = new THREE.Group();
  propGroup.position.set(0, -0.1, -11.65);
  model.add(propGroup);

  const spinnerBackGeo = new THREE.CylinderGeometry(0.66, 0.66, 0.35, 10);
  spinnerBackGeo.rotateX(Math.PI / 2);
  propGroup.add(new THREE.Mesh(spinnerBackGeo, darkTrimMat));

  const spinnerConeGeo = new THREE.ConeGeometry(0.66, 1.55, 10);
  spinnerConeGeo.rotateX(-Math.PI / 2);
  spinnerConeGeo.translate(0, 0, -0.95);
  propGroup.add(new THREE.Mesh(spinnerConeGeo, activePlaneMat));

  const bladeGeo = new THREE.BoxGeometry(8.8, 0.58, 0.12);
  const bladeMat = createMaterial({color: 0x1e2024});
  const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
  const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
  blade2.rotation.z = Math.PI / 2;
  propGroup.add(blade1);
  propGroup.add(blade2);

  model.propGroup = propGroup;

  // Add pontoons
  if (opts.pontoons !== false) {
    model.add(pontoonGroup);
    model.pontoonGroup = pontoonGroup;
  }

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
// the best: top speed, agility, and float (a low stall speed, or the buggy's hop/hover)
function updatePlaneStats() {
  const stats = document.getElementById('plane-stats');
  if (!stats) return;
  const planes = Object.values(PLANE_HANDLING).filter((p) => p.stallKts > 0);
  const h = planeHandling();
  const values = {
    speed: h.topKts / Math.max(...planes.map((p) => p.topKts)),
    agility: h.agility / Math.max(...planes.map((p) => p.agility)),
    float: h.float ?? Math.min(...planes.map((p) => p.stallKts)) / h.stallKts,
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
      btn.classList.toggle(
        'active',
        btn.getAttribute('data-plane') === planeType
      );
    });
  }
  updatePlaneStats();

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
export const headlight = new THREE.SpotLight(0xffd1a3, 0);
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

// Each frame: place the beam for the vehicle, and point the pool where it
// shines (only while driving with the lights on).
export function updateHeadlightBeam(driving) {
  const beam = driving ? BUGGY_BEAM : PLANE_BEAM;
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
let startX = 0;
let startZ = 0;
let startY = 445.5;

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
