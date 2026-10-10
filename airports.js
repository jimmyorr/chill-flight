// --- AIRPORTS ---
// The few fixed airfields (ChillFlightLogic.AIRPORTS): a runway with
// markings, an apron, a control tower, a hangar and a windsock, at the
// field height the terrain is flattened to (getElevation). They're rare
// landmarks, so each is one small group in the scene rather than chunk
// props.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {createMaterial} from './constants.js';
import {scene} from './scene.js';
import {getElevation} from './terrain-geometry.js';

const asphaltMat = createMaterial({color: 0x4f5155, flatShading: true});
const concreteMat = createMaterial({color: 0x9a9890, flatShading: true});
const markingMat = createMaterial({color: 0xf2f0e6, flatShading: true});
const wallMat = createMaterial({color: 0xe8e0cc, flatShading: true});
const glassMat = createMaterial({color: 0x2a4a5a, flatShading: true});
const trimMat = createMaterial({color: 0x5a6470, flatShading: true});
const hangarMat = createMaterial({color: 0x8a9aa6, flatShading: true});
const doorMat = createMaterial({color: 0x4a5560, flatShading: true});
const sockMat = createMaterial({color: 0xe8743b, flatShading: true});

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function mesh(geometries, material) {
  const m = new THREE.Mesh(mergeGeometries(geometries), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// The control tower: a cream shaft, a dark glass cab and a flat roof
export function createControlTower() {
  const group = new THREE.Group();
  group.add(
    mesh([box(7, 20, 7, 0, 10, 0), box(12, 1, 12, 0, 20.5, 0)], wallMat)
  );
  group.add(mesh([box(10, 6, 10, 0, 24, 0)], glassMat));
  group.add(
    mesh([box(13, 1.2, 13, 0, 27.6, 0), box(0.4, 5, 0.4, 3, 30.5, 3)], trimMat)
  );
  return group;
}

// The hangar: a long shed with a rounded roof and a big door on its front
// (+Z)
export function createHangar() {
  const group = new THREE.Group();
  group.add(mesh([box(34, 10, 26, 0, 5, 0)], hangarMat));
  const roof = new THREE.CylinderGeometry(13, 13, 34, 16, 1, false, 0, Math.PI);
  // On its side along X; theta 0..PI is then the upper half
  roof.rotateZ(Math.PI / 2);
  roof.scale(1, 0.55, 1);
  roof.translate(0, 10, 0);
  group.add(mesh([roof], hangarMat));
  group.add(mesh([box(24, 8.5, 0.6, 0, 4.25, 13)], doorMat));
  return group;
}

// The windsock: a thin pole and an orange sock streaming off it
export function createWindsock() {
  const group = new THREE.Group();
  group.add(mesh([box(0.5, 12, 0.5, 0, 6, 0)], trimMat));
  const sock = new THREE.ConeGeometry(1.4, 7, 8, 1, true);
  sock.rotateZ(Math.PI / 2);
  sock.translate(3.6, 11.4, 0);
  group.add(mesh([sock], sockMat));
  return group;
}

// The runway (along local X), its markings and the apron beside it (+Z)
function createRunway() {
  const length = ChillFlightLogic.RUNWAY_LENGTH;
  const width = ChillFlightLogic.RUNWAY_WIDTH;
  const group = new THREE.Group();
  const pave = mesh([box(length, 0.6, width, 0, 0.3, 0)], asphaltMat);
  pave.castShadow = false;
  group.add(pave);
  const apron = mesh(
    [
      box(170, 0.5, 46, 0, 0.25, width / 2 + 28),
      box(14, 0.5, 12, 0, 0.25, width / 2 + 2),
    ],
    concreteMat
  );
  apron.castShadow = false;
  group.add(apron);
  const marks = [];
  // Centerline dashes, clear of the threshold bars
  for (let u = -length / 2 + 70; u <= length / 2 - 70; u += 36) {
    marks.push(box(18, 0.08, 1, u, 0.64, 0));
  }
  // Threshold bars at each end, across the runway
  for (const end of [-1, 1]) {
    for (let k = -3; k <= 3; k++) {
      if (k === 0) continue;
      marks.push(box(24, 0.08, 2.2, end * (length / 2 - 18), 0.64, k * 4.6));
    }
    // A wide aiming bar further in
    for (const side of [-1, 1]) {
      marks.push(box(30, 0.08, 4, end * (length / 2 - 110), 0.64, side * 7));
    }
  }
  const markings = mesh(marks, markingMat);
  markings.castShadow = false;
  group.add(markings);
  return group;
}

function createAirport(a) {
  const group = new THREE.Group();
  group.name = a.name;
  group.add(createRunway());
  const tower = createControlTower();
  tower.position.set(-55, 0, 92);
  group.add(tower);
  const hangar = createHangar();
  hangar.position.set(45, 0, 98);
  hangar.rotation.y = Math.PI;
  group.add(hangar);
  const sock = createWindsock();
  sock.position.set(-ChillFlightLogic.RUNWAY_LENGTH / 2 + 60, 0, -34);
  group.add(sock);
  // The terrain is flat at the field height here (see getElevation)
  group.position.set(a.x, getElevation(a.x, a.z), a.z);
  // Local X along the runway: (cos angle, sin angle) in world x, z
  group.rotation.y = -a.angle;
  return group;
}

if (ChillFlightLogic.SHOW_OBJECTS !== false) {
  for (const a of ChillFlightLogic.AIRPORTS) scene.add(createAirport(a));
}
