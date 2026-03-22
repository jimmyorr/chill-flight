// --- AIRPLANE ---
// Dependencies: THREE, scene, planeMat (set here as global for multiplayer to update)

/** @type {THREE.Material|null} */
let planeMat = null;

window.CALLSIGNS = [
    'Maverick', 'Goose', 'Iceman', 'Slider', 'Hollywood',
    'Wolfman', 'Cougar', 'Merlin', 'Viper', 'Jester',
    'Chipper', 'Sundown', 'Stinger'
];
window.defaultCallsign = window.CALLSIGNS[Math.floor(Math.random() * window.CALLSIGNS.length)];

/** @type {string} */
let playerName = localStorage.getItem('chill_flight_name') || window.defaultCallsign;
/** @type {number} */
let planeColor = parseInt(localStorage.getItem('chill_flight_color')) || 0xe74c3c;
/** @type {boolean} */
let hasSavedColor = localStorage.getItem('chill_flight_color') !== null;

// Helper to get a deterministic "chill" color for a player
function getPlaneColor(uid) {
    return ChillFlightLogic.getPlaneColor(uid);
}

const planeGroup = new THREE.Group();
planeGroup.rotation.y = 0;
scene.add(planeGroup);

// Fuselage
// better rotation order for airplanes
planeGroup.rotation.order = 'YXZ';

// --- VEHICLE SWITCHING ---
const airplaneModel = new THREE.Group();
planeGroup.add(airplaneModel);

const helicopterModel = new THREE.Group();
helicopterModel.visible = false;
planeGroup.add(helicopterModel);

/** @type {string} */
let vehicleType = localStorage.getItem('chill_flight_vehicle') || 'airplane';

/**
 * Sets the player's active vehicle type and updates visibility/UI.
 * @param {string} type - The vehicle type ('airplane' or 'helicopter').
 */
function setVehicle(type) {
    vehicleType = type;
    localStorage.setItem('chill_flight_vehicle', vehicleType);
    
    airplaneModel.visible = (vehicleType === 'airplane');
    helicopterModel.visible = (vehicleType === 'helicopter');
    
    // Update UI if it exists
    const select = document.getElementById('vehicle-select');
    if (select) select.value = vehicleType;

    console.log(`Vehicle switched to: ${vehicleType}`);
}

// --- AIRPLANE MODEL ---
// Fuselage
const bodyGeo = new THREE.BoxGeometry(4, 4, 16);
planeMat = createMaterial({ color: planeColor, flatShading: true });
const body = new THREE.Mesh(bodyGeo, planeMat);
airplaneModel.add(body);

// Cockpit window
const windowGeo = new THREE.BoxGeometry(3, 2, 4);
const windowMat = createMaterial({ color: 0x111111, roughness: 0.1 });
const cockpit = new THREE.Mesh(windowGeo, windowMat);
cockpit.position.set(0, 2.5, -2);
airplaneModel.add(cockpit);

// Wings
const wingGeo = new THREE.BoxGeometry(30, 0.5, 4);
const wingMat = createMaterial({ color: 0xecf0f1, flatShading: true });
const wings = new THREE.Mesh(wingGeo, wingMat);
wings.position.set(0, 0, -1);
airplaneModel.add(wings);

// Tail
const tailGeo = new THREE.BoxGeometry(10, 0.5, 3);
const tail = new THREE.Mesh(tailGeo, wingMat);
tail.position.set(0, 0, 7);
airplaneModel.add(tail);

const rudderGeo = new THREE.BoxGeometry(0.5, 5, 3);
const rudder = new THREE.Mesh(rudderGeo, planeMat);
rudder.position.set(0, 2.5, 7);
airplaneModel.add(rudder);

// Propeller
const propGroup = new THREE.Group();
propGroup.position.set(0, 0, -8.5);
airplaneModel.add(propGroup);

const propCenterGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
propCenterGeo.rotateX(Math.PI / 2);
const propCenter = new THREE.Mesh(propCenterGeo, createMaterial({ color: 0x333333 }));
propGroup.add(propCenter);

const bladeGeo = new THREE.BoxGeometry(12, 0.4, 0.4);
const bladeMat = createMaterial({ color: 0x222222 });
const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
blade2.rotation.z = Math.PI / 2;
propGroup.add(blade1);
propGroup.add(blade2);

// --- HELICOPTER MODEL ---
// Fuselage
const heliBodyGeo = new THREE.BoxGeometry(5, 5, 8);
const heliBody = new THREE.Mesh(heliBodyGeo, planeMat);
helicopterModel.add(heliBody);

// Cockpit window
const heliWindowGeo = new THREE.BoxGeometry(4, 3, 3);
const heliCockpit = new THREE.Mesh(heliWindowGeo, windowMat);
heliCockpit.position.set(0, 0.5, -3);
helicopterModel.add(heliCockpit);

// Tail Boom
const tailBoomGeo = new THREE.BoxGeometry(1.5, 1.5, 10);
const tailBoom = new THREE.Mesh(tailBoomGeo, planeMat);
tailBoom.position.set(0, 1, 8);
helicopterModel.add(tailBoom);

// Main Rotor
/** @type {THREE.Group} */
let mainRotorGroup = new THREE.Group();
mainRotorGroup.position.set(0, 3, 0);
helicopterModel.add(mainRotorGroup);

const rotorCenterGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
const rotorCenter = new THREE.Mesh(rotorCenterGeo, createMaterial({ color: 0x333333 }));
mainRotorGroup.add(rotorCenter);

const mainBladeGeo = new THREE.BoxGeometry(24, 0.2, 1.5);
const mainBlade = new THREE.Mesh(mainBladeGeo, bladeMat);
mainRotorGroup.add(mainBlade);
const mainBlade2 = mainBlade.clone();
mainBlade2.rotation.y = Math.PI / 2;
mainRotorGroup.add(mainBlade2);

// Tail Rotor
/** @type {THREE.Group} */
let tailRotorGroup = new THREE.Group();
tailRotorGroup.position.set(1.2, 1, 13);
helicopterModel.add(tailRotorGroup);

const tailRotorBladeGeo = new THREE.BoxGeometry(4, 0.1, 0.4);
const tailRotorBlade = new THREE.Mesh(tailRotorBladeGeo, bladeMat);
tailRotorBlade.rotation.y = Math.PI / 2;
tailRotorGroup.add(tailRotorBlade);
const tailRotorBlade2 = tailRotorBlade.clone();
tailRotorBlade2.rotation.x = Math.PI / 2;
tailRotorGroup.add(tailRotorBlade2);

// Skids
const skidGeo = new THREE.BoxGeometry(0.5, 0.5, 10);
const skidMat = createMaterial({ color: 0x333333 });
const skidL = new THREE.Mesh(skidGeo, skidMat);
skidL.position.set(-2.5, -3.5, 0);
helicopterModel.add(skidL);
const skidR = new THREE.Mesh(skidGeo, skidMat);
skidR.position.set(2.5, -3.5, 0);
helicopterModel.add(skidR);

const skidStrutGeo = new THREE.BoxGeometry(0.3, 2, 0.3);
const skidStrutLF = new THREE.Mesh(skidStrutGeo, skidMat);
skidStrutLF.position.set(-2.5, -2.5, -3);
helicopterModel.add(skidStrutLF);
const skidStrutLB = new THREE.Mesh(skidStrutGeo, skidMat);
skidStrutLB.position.set(-2.5, -2.5, 3);
helicopterModel.add(skidStrutLB);
const skidStrutRF = new THREE.Mesh(skidStrutGeo, skidMat);
skidStrutRF.position.set(2.5, -2.5, -3);
helicopterModel.add(skidStrutRF);
const skidStrutRB = new THREE.Mesh(skidStrutGeo, skidMat);
skidStrutRB.position.set(2.5, -2.5, 3);
helicopterModel.add(skidStrutRB);

// Initialize vehicle
setVehicle(vehicleType);

// Pontoons Group
const pontoonGroup = new THREE.Group();
pontoonGroup.visible = false;
airplaneModel.add(pontoonGroup);

let pontoonDeploymentProgress = 0;
let isDeployingPontoons = false;
let isRetractingPontoons = false;

const pontoonMat = createMaterial({ color: 0xcccccc, flatShading: true });
const pontoonGeo = new THREE.CylinderGeometry(1.5, 1.5, 18, 8);
pontoonGeo.rotateX(Math.PI / 2);
const pontoonNoseGeo = new THREE.ConeGeometry(1.5, 4, 8);
pontoonNoseGeo.rotateX(Math.PI / 2);
const pontoonNoseMeshL = new THREE.Mesh(pontoonNoseGeo, pontoonMat);
pontoonNoseMeshL.position.set(0, 0, -11);

const pontoonL = new THREE.Group();
const pontoonBodyL = new THREE.Mesh(pontoonGeo, pontoonMat);
pontoonL.add(pontoonBodyL);
pontoonL.add(pontoonNoseMeshL);
pontoonL.position.set(-5, -4.5, 0);
pontoonGroup.add(pontoonL);

const pontoonNoseMeshR = pontoonNoseMeshL.clone();
const pontoonR = new THREE.Group();
const pontoonBodyR = new THREE.Mesh(pontoonGeo, pontoonMat);
pontoonR.add(pontoonBodyR);
pontoonR.add(pontoonNoseMeshR);
pontoonR.position.set(5, -4.5, 0);
pontoonGroup.add(pontoonR);

const strutGeo = new THREE.CylinderGeometry(0.2, 0.2, 4.5, 4);
const strutMat = createMaterial({ color: 0x333333 });

const hingeLF = new THREE.Group(); hingeLF.position.set(-5, 0, -3); pontoonGroup.add(hingeLF);
const strutLF = new THREE.Mesh(strutGeo, strutMat); strutLF.position.set(0, -2.25, 0); hingeLF.add(strutLF);

const hingeLB = new THREE.Group(); hingeLB.position.set(-5, 0, 3); pontoonGroup.add(hingeLB);
const strutLB = new THREE.Mesh(strutGeo, strutMat); strutLB.position.set(0, -2.25, 0); hingeLB.add(strutLB);

const hingeRF = new THREE.Group(); hingeRF.position.set(5, 0, -3); pontoonGroup.add(hingeRF);
const strutRF = new THREE.Mesh(strutGeo, strutMat); strutRF.position.set(0, -2.25, 0); hingeRF.add(strutRF);

const hingeRB = new THREE.Group(); hingeRB.position.set(5, 0, 3); pontoonGroup.add(hingeRB);
const strutRB = new THREE.Mesh(strutGeo, strutMat); strutRB.position.set(0, -2.25, 0); hingeRB.add(strutRB);

// Initial folded state
pontoonL.position.set(-5, -0.5, 0);
pontoonL.rotation.z = Math.PI / 2;
pontoonR.position.set(5, -0.5, 0);
pontoonR.rotation.z = -Math.PI / 2;

hingeLF.rotation.z = Math.PI / 2;
hingeLB.rotation.z = Math.PI / 2;
hingeRF.rotation.z = -Math.PI / 2;
hingeRB.rotation.z = -Math.PI / 2;

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
planeGroup.position.set(0, 445.5, 0);
