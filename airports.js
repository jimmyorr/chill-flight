// --- AIRPORTS ---
// The few fixed airfields (ChillFlightLogic.AIRPORTS): a runway with
// markings, an apron, a control tower, a hangar and a windsock, at the
// field height the terrain is flattened to (getElevation). They're rare
// landmarks, so each is one small group in the scene rather than chunk
// props.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {createMaterial, WATER_LEVEL, MOUNTAIN_LEVEL} from './constants.js';
import {scene} from './scene.js';
import {simplex} from './noise.js';
import {getElevation} from './terrain-geometry.js';
import {BREAKABLE} from './terrain-gen.js';
import {standaloneProps} from './terrain-chunks.js';
import {buildPlaneModel} from './plane-models.js';

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

// --- RUNWAY LIGHTS ---
// Glowing points along the runway edges (warm white) and across its ends
// (green at the landing end, red at the far end),
// faded in at night with the streetlights (updateAirportLights). Points
// don't write depth, so the anime outline pass leaves them alone.
function glowTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const _glow = typeof document !== 'undefined' ? glowTexture() : null;
const lightMats = [0xffe2a8, 0x6dff8a, 0xff5a4a].map(
  (color) =>
    new THREE.PointsMaterial({
      color,
      map: _glow,
      size: 7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
);

function points(positions, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const p = new THREE.Points(geo, material);
  p.visible = false;
  return p;
}

function createRunwayLights() {
  const halfL = ChillFlightLogic.RUNWAY_LENGTH / 2;
  const halfW = ChillFlightLogic.RUNWAY_WIDTH / 2 + 1.5;
  const y = 1.2;
  const edge = [];
  for (let u = -halfL; u <= halfL; u += 40) {
    edge.push(u, y, -halfW, u, y, halfW);
  }
  const green = [];
  const red = [];
  // Green where planes land (the -X end), red where the runway ends (+X):
  // back to back at each end, they'd blend into yellow from a distance
  for (let v = -halfW; v <= halfW; v += 5) {
    green.push(-halfL - 2, y, v);
    red.push(halfL + 2, y, v);
  }
  const group = new THREE.Group();
  group.add(points(edge, lightMats[0]));
  group.add(points(green, lightMats[1]));
  group.add(points(red, lightMats[2]));
  return group;
}

const _lightGroups = [];

// Fades the runway lights with the night (0 by day, 1 and up at night: the
// streetlights' value, game-loop.js)
export function updateAirportLights(night) {
  const opacity = Math.min(1, night);
  for (const m of lightMats) m.opacity = opacity;
  const on = opacity > 0.01;
  for (const g of _lightGroups) {
    for (const p of g.children) p.visible = on;
  }
}

// --- PARKED PLANES ---
// One to three planes parked side by side on the apron, noses toward the
// runway, each airport its own (from the world seed): biplanes and twins.
// (The seaplane flies without its pontoons, so it has no landing gear.)
const PARKED_TYPES = ['biplane', 'twin'];
const APRON_TOP = 0.5;
const _box = new THREE.Box3();

// Swaps the second and third corners of each triangle (non-indexed geometry)
function reverseWinding(geo) {
  for (const attr of Object.values(geo.attributes)) {
    const {array, itemSize} = attr;
    for (let i = 0; i < attr.count; i += 3) {
      for (let k = 0; k < itemSize; k++) {
        const a = (i + 1) * itemSize + k;
        const b = (i + 2) * itemSize + k;
        const t = array[a];
        array[a] = array[b];
        array[b] = t;
      }
    }
  }
}

// Parked planes never move, so each is baked into one mesh per material: a
// plane is 50 to 70 meshes, each its own draw call (twice, with shadows).
// `group` has no parent, so world matrices are relative to it.
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const byMaterial = new Map();
  group.traverseVisible((object) => {
    if (!object.isMesh) return;
    const geo = object.geometry.index
      ? object.geometry.toNonIndexed()
      : object.geometry.clone();
    geo.applyMatrix4(object.matrixWorld);
    // A mirrored part draws with its winding flipped; baked in, it needs its
    // triangles turned back around
    if (object.matrixWorld.determinant() < 0) reverseWinding(geo);
    if (!byMaterial.has(object.material)) byMaterial.set(object.material, []);
    byMaterial.get(object.material).push(geo);
  });
  const merged = new THREE.Group();
  for (const [material, geos] of byMaterial) {
    const m = new THREE.Mesh(mergeGeometries(geos), material);
    m.castShadow = true;
    merged.add(m);
    for (const geo of geos) geo.dispose();
  }
  return merged;
}

function createParkedPlanes(index) {
  const rng = ChillFlightLogic.mulberry32(
    ChillFlightLogic.WORLD_SEED * 31 + index * 7919 + 17
  );
  const group = new THREE.Group();
  const count = 1 + Math.floor(rng() * 3);
  // Left to right from the middle of the apron, clear of the tower, with a
  // gap between wingtips
  let x = -42;
  for (let i = 0; i < count; i++) {
    const type = PARKED_TYPES[Math.floor(rng() * PARKED_TYPES.length)];
    const livery = Math.floor(rng() * ChillFlightLogic.PLANE_COLORS.length);
    const plane = buildPlaneModel(type, livery);
    // A little off square, as parked by hand
    plane.rotation.y = (rng() - 0.5) * 0.4;
    _box.setFromObject(plane);
    const span = _box.max.x - _box.min.x;
    plane.position.set(x + span / 2, APRON_TOP - _box.min.y, 48);
    x += span + 4 + rng() * 6;
    // Each on its own, so one can be knocked over (breakables.js)
    group.add(mergeByMaterial(plane));
  }
  return group;
}

// --- AIRPORT SIGN ---
// A green highway sign with the airport's name and an arrow toward its
// access road (arrow -1 left, 1 right), on two posts, its face toward +Z.
// The posts reach well below 0 so the sign stands on uneven ground.
const SIGN_WIDTH = 28;
const SIGN_HEIGHT = 8;
const SIGN_CLEARANCE = 7;
const signGreenMat = createMaterial({color: 0x1f6b45, flatShading: true});
const signPostMat = createMaterial({color: 0x8a9096, flatShading: true});

function signTexture(name, arrow) {
  const canvas = document.createElement('canvas');
  canvas.width = 576;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1f6b45';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#f2f0e6';
  ctx.lineWidth = 7;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  ctx.fillStyle = '#f2f0e6';
  ctx.textBaseline = 'middle';
  // The arrow on the side it points to, the name beside it, as large as fits
  const arrowW = 70;
  let fontSize = 80;
  let textW;
  do {
    ctx.font = `bold ${fontSize}px Inter, Helvetica, Arial, sans-serif`;
    textW = ctx.measureText(name).width;
    fontSize -= 4;
  } while (arrowW + 24 + textW > canvas.width - 70 && fontSize > 32);
  const total = arrowW + 24 + textW;
  const left = (canvas.width - total) / 2;
  const arrowX = arrow > 0 ? left + textW + 24 : left;
  ctx.fillText(name, arrow > 0 ? left : left + arrowW + 24, 82);
  const y = 80;
  const tip = arrow > 0 ? arrowX + arrowW : arrowX;
  const tail = arrow > 0 ? arrowX : arrowX + arrowW;
  const head = arrow > 0 ? tip - 30 : tip + 30;
  ctx.fillRect(Math.min(tail, head), y - 7, Math.abs(head - tail), 14);
  ctx.beginPath();
  ctx.moveTo(tip, y);
  ctx.lineTo(head, y - 26);
  ctx.lineTo(head, y + 26);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export function createAirportSign(name, arrow) {
  const group = new THREE.Group();
  const face = createMaterial({map: signTexture(name, arrow)});
  // Box faces: +x, -x, +y, -y, +z (the front), -z
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(SIGN_WIDTH, SIGN_HEIGHT, 0.5),
    [signGreenMat, signGreenMat, signGreenMat, signGreenMat, face, signGreenMat]
  );
  panel.position.y = SIGN_CLEARANCE + SIGN_HEIGHT / 2;
  panel.castShadow = true;
  group.add(panel);
  const postHeight = SIGN_CLEARANCE + SIGN_HEIGHT + 8;
  group.add(
    mesh(
      [-1, 1].map((side) =>
        box(
          0.5,
          postHeight,
          0.5,
          side * (SIGN_WIDTH / 2 - 2),
          postHeight / 2 - 8,
          -0.6
        )
      ),
      signPostMat
    )
  );
  return group;
}

// --- ACCESS ROAD ---
// The road from the apron's end to the highway (ACCESS_ROADS), along world
// x, with skirts down its sides where it ramps up onto the highway and a
// dashed centre line. Built in world space, then moved into the frame of
// the airport at (a.x, fieldY, a.z).
const ACCESS_ROAD_STEP = 10;
// How far before the turn the highway's signs stand
const SIGN_LEAD = 250;
const ACCESS_ROAD_SKIRT = 3;
const DASH_LENGTH = 10;
const DASH_GAP = 14;

function addQuad(out, a, b, c, d) {
  out.push(...a, ...b, ...c, ...b, ...d, ...c);
}

function createAccessRoad(road, a, fieldY) {
  const index = ChillFlightLogic.ACCESS_ROADS.indexOf(road);
  const ends = ChillFlightLogic.accessRoadEnds(index, simplex, {
    WATER_LEVEL,
    MOUNTAIN_LEVEL,
  });
  if (!ends?.built) return null;
  const dir = Math.sign(road.x1 - road.x0);
  const w = ChillFlightLogic.ACCESS_ROAD_WIDTH;
  // From a little under the apron to the highway's edge
  const xa = road.x0 - dir * 12;
  const xb = road.x1 - dir * (ChillFlightLogic.ROAD_WIDTH + 1);
  const x0 = Math.min(xa, xb);
  const x1 = Math.max(xa, xb);
  const steps = Math.ceil((x1 - x0) / ACCESS_ROAD_STEP);
  const xs = [];
  for (let i = 0; i <= steps; i++) xs.push(x0 + ((x1 - x0) * i) / steps);
  const top = (x) => ChillFlightLogic.accessRoadDeck(road, ends, x);

  const z = road.z;
  const pave = [];
  for (let i = 0; i < steps; i++) {
    const xL = xs[i];
    const xR = xs[i + 1];
    const yL = top(xL);
    const yR = top(xR);
    addQuad(
      pave,
      [xL, yL, z - w],
      [xL, yL, z + w],
      [xR, yR, z - w],
      [xR, yR, z + w]
    );
    const bL = yL - ACCESS_ROAD_SKIRT;
    const bR = yR - ACCESS_ROAD_SKIRT;
    addQuad(
      pave,
      [xL, yL, z - w],
      [xR, yR, z - w],
      [xL, bL, z - w],
      [xR, bR, z - w]
    );
    addQuad(
      pave,
      [xL, yL, z + w],
      [xL, bL, z + w],
      [xR, yR, z + w],
      [xR, bR, z + w]
    );
  }
  // Centre line dashes, fixed from the apron end
  const dashes = [];
  for (
    let d = 20;
    d + DASH_LENGTH < Math.abs(xb - xa) - 20;
    d += DASH_LENGTH + DASH_GAP
  ) {
    const xL = Math.min(xa + dir * d, xa + dir * (d + DASH_LENGTH));
    const xR = xL + DASH_LENGTH;
    const yL = top(xL) + 0.06;
    const yR = top(xR) + 0.06;
    addQuad(
      dashes,
      [xL, yL, z - 0.5],
      [xL, yL, z + 0.5],
      [xR, yR, z - 0.5],
      [xR, yR, z + 0.5]
    );
  }

  // Into the airport's frame: rotated by +angle about y, since the airport
  // is rotated by -angle
  const toLocal = new THREE.Matrix4()
    .makeRotationY(a.angle)
    .multiply(new THREE.Matrix4().makeTranslation(-a.x, -fieldY, -a.z));
  const group = new THREE.Group();

  // A sign on the highway's shoulder each way, before the turn: traffic
  // heading north (-z) has +x on its right, heading south -x
  const signs = new THREE.Group();
  const toAirport = Math.sign(road.x0 - road.x1);
  for (const heading of [-1, 1]) {
    const right = -heading;
    const x = road.x1 + right * (ChillFlightLogic.ROAD_WIDTH + 8);
    const sz = road.z - heading * SIGN_LEAD;
    const sign = createAirportSign(a.name, toAirport * right);
    sign.position.set(x, getElevation(x, sz), sz);
    sign.rotation.y = heading < 0 ? 0 : Math.PI;
    signs.add(sign);
  }
  signs.applyMatrix4(toLocal);
  group.add(signs);
  group.userData.signs = signs.children;
  for (const [positions, material] of [
    [pave, asphaltMat],
    [dashes, markingMat],
  ]) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geo.applyMatrix4(toLocal);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}

// Beyond this the parked planes and windsock are a few pixels across, so
// only the runway and buildings draw
const AIRPORT_DETAIL_DISTANCE = 4000;
// And beyond this, nothing: past the near terrain (6 to 12 km by preset),
// an airport only costs draw calls behind haze
const AIRPORT_DRAW_DISTANCE = 12000;

function createAirport(a, index) {
  const group = new THREE.Group();
  group.add(createRunway());
  const lights = createRunwayLights();
  _lightGroups.push(lights);
  group.add(lights);
  const tower = createControlTower();
  tower.position.set(-55, 0, 92);
  group.add(tower);
  const hangar = createHangar();
  hangar.position.set(45, 0, 98);
  hangar.rotation.y = Math.PI;
  group.add(hangar);
  const details = new THREE.Group();
  details.add(createParkedPlanes(index));
  const sock = createWindsock();
  sock.position.set(-ChillFlightLogic.RUNWAY_LENGTH / 2 + 60, 0, -34);
  details.add(sock);
  const detailLOD = new THREE.LOD();
  detailLOD.addLevel(details, 0);
  detailLOD.addLevel(new THREE.Group(), AIRPORT_DETAIL_DISTANCE);
  group.add(detailLOD);
  const airport = new THREE.LOD();
  airport.name = a.name;
  airport.addLevel(group, 0);
  airport.addLevel(new THREE.Group(), AIRPORT_DRAW_DISTANCE);
  // The terrain is flat at the field height here (see getElevation)
  const fieldY = getElevation(a.x, a.z);
  const road = ChillFlightLogic.ACCESS_ROADS.find((r) => r.index === index);
  const accessRoad = road && createAccessRoad(road, a, fieldY);
  if (accessRoad) group.add(accessRoad);
  airport.position.set(a.x, fieldY, a.z);
  // Local X along the runway: (cos angle, sin angle) in world x, z
  airport.rotation.y = -a.angle;
  airport.updateMatrixWorld(true);
  addBreakables(index, {
    tower,
    hangar,
    sock,
    planes: details.children[0].children,
    signs: accessRoad?.userData.signs || [],
  });
  return airport;
}

// What can be knocked over at an airport (breakables.js): the tower and
// windsock and signs topple, the hangar falls in and parked planes tumble
function addBreakables(index, {tower, hangar, sock, planes, signs}) {
  const part = (object, role) => ({type: 'obj', object, role});
  const topples = (group) => ({
    kind: BREAKABLE.TREE,
    parts: group.children.map((o) => part(o)),
  });
  const meshProps = [
    topples(tower),
    topples(sock),
    ...signs.map(topples),
    {
      kind: BREAKABLE.HOUSE,
      parts: [
        part(hangar.children[0], 'fold'),
        part(hangar.children[1], 'fling'),
        part(hangar.children[2], 'fling'),
      ],
      rubble: 22,
    },
    ...planes.map((plane) => ({
      kind: BREAKABLE.HOUSE,
      parts: [part(plane, 'fling')],
      rubble: 5,
    })),
  ];
  standaloneProps.push({
    userData: {
      breakables: {kinds: []},
      instanceData: {},
      meshProps,
      chunkX: 'airport',
      chunkZ: index,
      standalone: true,
    },
  });
}

if (ChillFlightLogic.SHOW_OBJECTS !== false) {
  ChillFlightLogic.AIRPORTS.forEach((a, i) => scene.add(createAirport(a, i)));
}
