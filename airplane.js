// --- AIRPLANE ---
// Dependencies: THREE, scene

/** @type {number} */
let storedColor = localStorage.getItem('chill_flight_color');
let planeColor =
  storedColor !== null && !isNaN(parseInt(storedColor))
    ? parseInt(storedColor)
    : ChillFlightLogic.PLANE_COLORS[0];
/** @type {boolean} */
let hasSavedColor = localStorage.getItem('chill_flight_color') !== null;

const planeGroup = new THREE.Group();
planeGroup.rotation.y = 0;
scene.add(planeGroup);

// Fuselage
// better rotation order for airplanes
planeGroup.rotation.order = 'YXZ';

const airplaneModel = new THREE.Group();
planeGroup.add(airplaneModel);
window.airplaneModel = airplaneModel;

// --- AIRPLANE MODEL ---
const planeWhiteMat = createMaterial({
  color: planeColor === 0xe8c382 ? 0x1c3144 : 0xffffff,
  flatShading: true,
});
const planeMat = createMaterial({color: planeColor, flatShading: true});
window.planeWhiteMat = planeWhiteMat;
window.planeMat = planeMat;

// Fuselage (Main Body)
const bodyGeo = new THREE.CylinderGeometry(0.7, 1.8, 14, 8);
bodyGeo.rotateX(Math.PI / 2);
const body = new THREE.Mesh(bodyGeo, planeWhiteMat);
body.position.set(0, 0, -2);
body.scale.set(1, 1.3, 1);
airplaneModel.add(body);

// Nose Cowling
const noseGeo = new THREE.CylinderGeometry(1.8, 1.0, 2.5, 8); // Made front (1.0) blunter
noseGeo.rotateX(Math.PI / 2); // Same rotation as body for perfect segment alignment
const nose = new THREE.Mesh(noseGeo, planeWhiteMat);
nose.position.set(0, 0, -10.25);
nose.scale.set(1, 1.3, 1);
airplaneModel.add(nose);

// Cabin / Cockpit
const cabinGeo = new THREE.BoxGeometry(2.6, 2.0, 4.0);
const cabin = new THREE.Mesh(cabinGeo, planeWhiteMat);
cabin.position.set(0, 1.5, -3.5);
airplaneModel.add(cabin);

// Windshield
const windowMat = createMaterial({color: 0x111111, roughness: 0.1});
const windowGeo = new THREE.BoxGeometry(2.65, 1.8, 1.5);
const cockpit = new THREE.Mesh(windowGeo, windowMat);
cockpit.position.set(0, 1.8, -5.5);
cockpit.rotation.x = Math.PI / 5.5;
airplaneModel.add(cockpit);

// Side Windows
const sideWindowGeo = new THREE.BoxGeometry(2.7, 1.0, 2.0);
const sideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
sideWindow.position.set(0, 1.7, -3.5);
airplaneModel.add(sideWindow);

// Accent Stripe
const stripeGeo = new THREE.BoxGeometry(3.0, 0.4, 13);
const stripe = new THREE.Mesh(stripeGeo, planeMat);
stripe.position.set(0, 0.2, -2.0);
airplaneModel.add(stripe);

// Wings
const mainWingGeo = new THREE.BoxGeometry(28, 0.5, 4.5);
const mainWings = new THREE.Mesh(mainWingGeo, planeWhiteMat);
mainWings.position.set(0, 2.8, -3.5);
airplaneModel.add(mainWings);

const wingTipGeo = new THREE.BoxGeometry(2, 0.5, 4.5);
const wingTipL = new THREE.Mesh(wingTipGeo, planeMat);
wingTipL.position.set(-15, 2.8, -3.5);
airplaneModel.add(wingTipL);

const wingTipR = new THREE.Mesh(wingTipGeo, planeMat);
wingTipR.position.set(15, 2.8, -3.5);
airplaneModel.add(wingTipR);

// Wing Struts
const wingStrutGeo = new THREE.CylinderGeometry(0.15, 0.15, 7.5, 6);
const wingStrutL = new THREE.Mesh(wingStrutGeo, planeWhiteMat);
wingStrutL.position.set(-4.5, 1.65, -3.5);
wingStrutL.rotation.z = Math.PI * 0.4;
airplaneModel.add(wingStrutL);

const wingStrutR = new THREE.Mesh(wingStrutGeo, planeWhiteMat);
wingStrutR.position.set(4.5, 1.65, -3.5);
wingStrutR.rotation.z = -Math.PI * 0.4;
airplaneModel.add(wingStrutR);

// Tail (Empennage) - Horizontal Stabilizer
const tailCenterGeo = new THREE.BoxGeometry(8, 0.4, 3);
const tailCenter = new THREE.Mesh(tailCenterGeo, planeWhiteMat);
tailCenter.position.set(0, 0.5, 5.5);
airplaneModel.add(tailCenter);

const tailTipGeo = new THREE.BoxGeometry(1, 0.4, 3);
const tailTipL = new THREE.Mesh(tailTipGeo, planeMat);
tailTipL.position.set(-4.5, 0.5, 5.5);
airplaneModel.add(tailTipL);

const tailTipR = new THREE.Mesh(tailTipGeo, planeMat);
tailTipR.position.set(4.5, 0.5, 5.5);
airplaneModel.add(tailTipR);

// Rudder (Vertical Stabilizer)
const rudderShape = new THREE.Shape();
rudderShape.moveTo(0, 0);
rudderShape.lineTo(3, 0);
rudderShape.lineTo(2.5, 4);
rudderShape.lineTo(1.0, 4);
rudderShape.lineTo(0, 0);

const extrudeSettings = {depth: 0.3, bevelEnabled: false};
const rudderGeo = new THREE.ExtrudeGeometry(rudderShape, extrudeSettings);
rudderGeo.translate(-1.5, 0, -0.15); // center locally
rudderGeo.rotateY(Math.PI / -2); // point forward
const rudder = new THREE.Mesh(rudderGeo, planeMat);
rudder.position.set(0, 0.7, 5.5); // Place at tail
airplaneModel.add(rudder);

// Propeller
const propGroup = new THREE.Group();
propGroup.position.set(0, -0.2, -11.6); // Moved to tip of nose
airplaneModel.add(propGroup);

const propCenterGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.0, 8);
propCenterGeo.rotateX(Math.PI / 2);
const propCenter = new THREE.Mesh(
  propCenterGeo,
  createMaterial({color: 0x333333})
);
propGroup.add(propCenter);

const bladeGeo = new THREE.BoxGeometry(9, 0.6, 0.1);
const bladeMat = createMaterial({color: 0x222222});
const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
blade2.rotation.z = Math.PI / 2;
propGroup.add(blade1);
propGroup.add(blade2);

// Pontoons Group
const pontoonGroup = new THREE.Group();
pontoonGroup.visible = false;
airplaneModel.add(pontoonGroup);

let pontoonDeploymentProgress = 0;
let isDeployingPontoons = false;
let isRetractingPontoons = false;

const pontoonMat = createMaterial({color: 0xcccccc, flatShading: true});
const pontoonGeo = new THREE.CylinderGeometry(1.0, 1.0, 15, 8);
pontoonGeo.rotateX(Math.PI / 2);
const pontoonNoseGeo = new THREE.ConeGeometry(1.0, 3, 8);
pontoonNoseGeo.rotateX(-Math.PI / 2); // Fix: point forward
const pontoonNoseMeshL = new THREE.Mesh(pontoonNoseGeo, pontoonMat);
pontoonNoseMeshL.position.set(0, 0, -9);

const pontoonL = new THREE.Group();
const pontoonBodyL = new THREE.Mesh(pontoonGeo, pontoonMat);
pontoonBodyL.scale.set(1, 0.7, 1);
pontoonNoseMeshL.scale.set(1, 0.7, 1);
pontoonL.add(pontoonBodyL);
pontoonL.add(pontoonNoseMeshL);
pontoonL.position.set(-5, -4.5, 0);

// Add visual struts to pontoons
const strutGeo = new THREE.CylinderGeometry(0.1, 0.1, 5.0, 6);
const strut1L = new THREE.Mesh(strutGeo, pontoonMat);
strut1L.position.set(2.5, 2.0, -3);
strut1L.rotation.z = -Math.PI / 4;
pontoonL.add(strut1L);

const strut2L = new THREE.Mesh(strutGeo, pontoonMat);
strut2L.position.set(2.5, 2.0, 3);
strut2L.rotation.z = -Math.PI / 4;
pontoonL.add(strut2L);

pontoonGroup.add(pontoonL);

const pontoonNoseMeshR = pontoonNoseMeshL.clone();
const pontoonR = new THREE.Group();
const pontoonBodyR = new THREE.Mesh(pontoonGeo, pontoonMat);
pontoonBodyR.scale.set(1, 0.7, 1);
pontoonNoseMeshR.scale.set(1, 0.7, 1);
pontoonR.add(pontoonBodyR);
pontoonR.add(pontoonNoseMeshR);
pontoonR.position.set(5, -4.5, 0);

const strut1R = new THREE.Mesh(strutGeo, pontoonMat);
strut1R.position.set(-2.5, 2.0, -3);
strut1R.rotation.z = Math.PI / 4;
pontoonR.add(strut1R);

const strut2R = new THREE.Mesh(strutGeo, pontoonMat);
strut2R.position.set(-2.5, 2.0, 3);
strut2R.rotation.z = Math.PI / 4;
pontoonR.add(strut2R);

pontoonGroup.add(pontoonR);

const hingeLF = new THREE.Group();
hingeLF.position.set(-5, 0, -3);
pontoonGroup.add(hingeLF);
const hingeLB = new THREE.Group();
hingeLB.position.set(-5, 0, 3);
pontoonGroup.add(hingeLB);
const hingeRF = new THREE.Group();
hingeRF.position.set(5, 0, -3);
pontoonGroup.add(hingeRF);
const hingeRB = new THREE.Group();
hingeRB.position.set(5, 0, 3);
pontoonGroup.add(hingeRB);

// Better rotation order for airplanes
planeGroup.rotation.order = 'YXZ';

// Headlight
const headlight = new THREE.SpotLight(0xffd1a3, 0);
headlight.position.set(0, 0, -10);

const headlightTarget = new THREE.Object3D();
headlightTarget.position.set(0, -20, -100);
planeGroup.add(headlightTarget);
headlight.target = headlightTarget;

headlight.angle = Math.PI / 4;
headlight.penumbra = 1.0;
headlight.distance = 1500;
headlight.decay = 2.0;

const headlightGlow = new THREE.PointLight(0xffd1a3, 0, 50);
headlightGlow.position.set(0, 5, 0);
planeGroup.add(headlightGlow);
planeGroup.add(headlight);

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
  startY = urlAltVal / 25 + 45.5;
} else if (urlLatVal !== null || urlLonVal !== null) {
  // If starting position was specified, calculate terrain elevation at startX, startZ
  // to ensure player starts at a safe altitude above the ground (e.g. 400 units above terrain)
  try {
    const terrainHeight = ChillFlightLogic.getElevation(
      startX,
      startZ,
      simplex,
      {
        WATER_LEVEL: typeof WATER_LEVEL !== 'undefined' ? WATER_LEVEL : 40,
        MAP_WORLD_SIZE:
          typeof MAP_WORLD_SIZE !== 'undefined' ? MAP_WORLD_SIZE : 10000,
        MAP_HEIGHT_SCALE:
          typeof MAP_HEIGHT_SCALE !== 'undefined' ? MAP_HEIGHT_SCALE : 400,
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

// Enable shadows for the vehicle
planeGroup.traverse((child) => {
  if (child.isMesh) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
});
