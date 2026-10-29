// --- KNOCKING PROPS OVER ---
// Trees, cacti, snowmen, streetlights, tents, towers and the lighthouse
// topple, buildings fall apart, boulders and rock arches come down in
// blocks, piers in planks, icebergs and ice floes crack into floating chunks,
// and boats roll over and sink, when the plane or the buggy runs into them,
// a friend's too in multiplayer: each player's game
// runs the same hit test for the friends it shows, and the world is the same
// from the seed, so nothing is sent over the network. Bridges and waterfalls
// never break.
//
// The terrain worker lists each chunk's breakable props and the instances
// drawing them (InstanceCollector.breakables in terrain-gen.js); props built
// per chunk are listed in its userData.meshProps, and the airports' in
// standaloneProps (terrain-chunks.js). A hit stops drawing those (hidePart)
// and draws copies here, in one instanced mesh per model (or a copy of a
// whole object), that fall over and stay down. Wrecks are kept for the
// session, so a chunk loaded again shows them where they fell.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  BASE_FLIGHT_SPEED,
  CHUNK_SIZE,
  WATER_LEVEL,
  createMaterial,
} from './constants.js';
import {
  animationUniforms,
  chunks,
  getElevation,
  houseTintMat,
  icebergMat,
  penguinStillMats,
  penguinWaddlePose,
  watercraftChunks,
  windmillBladesStillMat,
} from './terrain-geometry.js';
import {BREAKABLE} from './terrain-gen.js';
import {
  createDebrisMesh,
  debrisTypes,
  globalInstancer,
  hideInstance,
  sampleGroundColor,
} from './terrain-chunks.js';
import {standaloneProps} from './airports.js';
import {camera} from './sky.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {playSmash} from './sfx-events.js';
import {smashHaptic} from './haptics.js';
import {recordPropCrashStrain} from './crash.js';
import {slowBuggy} from './buggy.js';
import {propPuffs} from './particles.js';
import {forEachPeerVehicle} from './multiplayer.js';
import {
  BREAK,
  restAngle,
  speedKept,
  stepFlying,
  stepFold,
  stepSink,
  stepTopple,
  sweptHit,
} from './breakables-logic.js';

// Spatial grid cell for looking up a chunk's props (units)
const CELL = 64;
// The buggy's centre above its position (which is where its wheels touch)
const BUGGY_CENTER = 2;
// Animation and physics constants shared from breakables-logic.js:
// - GRAVITY: gravity on bits of house (units/s², about 2 g)
// - HOP_TIME, HOP_HEIGHT, DIVE_TIME, DIVE_OUT, DIVE_DEPTH: penguin scatter timings
const {DIVE_DEPTH, DIVE_OUT, DIVE_TIME, GRAVITY, HOP_HEIGHT, HOP_TIME} = BREAK;
// How fast bits of house fly off (units/s), at most
const FLING_MAX = 35;
// Rubble blocks thrown out of each kind of building, by its first part
const RUBBLE = {
  houseBody: BREAK.RUBBLE.house,
  twoStoryBody: BREAK.RUBBLE.two_story_house,
  strawHutBody: BREAK.RUBBLE.straw_hut,
  pagodaBody: BREAK.RUBBLE.pagoda,
  barnBody: BREAK.RUBBLE.barn,
  monasteryBody: BREAK.RUBBLE.monastery,
  castleRuins: BREAK.RUBBLE.castle,
  windmillBase: BREAK.RUBBLE.windmill,
  pierDeck: BREAK.RUBBLE.pier,
  rock: BREAK.RUBBLE.rock,
  snowRock: BREAK.RUBBLE.rock,
  desertRock: BREAK.RUBBLE.rock,
  iceberg: BREAK.RUBBLE.iceberg,
  iceFloe: BREAK.RUBBLE.iceFloe,
};
// Chunks of ice are bigger than bits of house
const ICE_CHUNK = 2.2;
// Rubble colour for a model drawn in vertex colours (the windmill's
// whitewash)
const PLASTER = [0.86, 0.82, 0.72];
// How a building's parts go: folded down where they stand, flung off, or
// gone (doors, windows, a campfire's flames and smoke). A pier's deck goes
// to planks.
const FOLDS = /Body$|^castleRuins$|^windmillBase$|^bush$/;
const FLINGS = /Roof$|Chimney$|Blades$|^fireLog$/;
const ROCKS = /^(rock|snowRock|desertRock)$/;
const ICE = /^(iceberg|iceFloe)$/;
// Parts that don't count toward how wide a prop is (a streetlight's arm
// reaches out over the road), and parts that just go out when it falls
// (its pool of light, or a campfire's) and don't count toward its size at all
const OVERHANG = /^streetlight(Arm|Bulb|Decal)$/;
const GOES_OUT = /^streetlightDecal$|^fireGlow$/;
// The sails turn in their shader at this rate (rad/s, terrain-geometry.js),
// clockwise about their hub
const SAIL_SPIN = 1.5;
// Camera jolt for a hit (flight-camera.js), and how far off a friend's hit is
// still heard (units)
const SHAKE = {tree: 1.2, house: 3, snowman: 0.6};
const HEAR_RANGE = 900;
// How far past its chunk's edge a prop may stand (units)
const CHUNK_SPILL = 150;
// Higher than this above the ground (units), no prop reaches
const HIGH_ABOVE_GROUND = 320;
// Time after spawning or a teleport before hits count (s)
const SETTLE = 1.5;
// A penguin hops off its floe and dives in when something comes this close
// (units, across and above)
const SCARE_RADIUS = 200;
const SCARE_HEIGHT = 150;
// How far a floe's edge is from its middle (units, at scale 1), and how far
// a penguin can be from it
const FLOE_RADIUS = 15;
const FLOE_NEAR = 25;

const LEAF_PUFF = new THREE.Color();
const SNOW = new THREE.Color(0.96, 0.97, 1);
const SPRAY = new THREE.Color(0.9, 0.95, 1);
const EMBERS = new THREE.Color(1, 0.55, 0.2);
const DUST = new THREE.Color(0.8, 0.75, 0.66);
const _dust = new THREE.Color();
const _m = new THREE.Matrix4();
const _m0 = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _r2 = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _box = new THREE.Box3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

const rubbleGeo = new THREE.BoxGeometry(1, 1, 1);
// Chunks of ice, glassy like the berg they came off
const iceChunkGeo = new THREE.IcosahedronGeometry(0.65, 0);

// Wrecks this session, by chunk key then prop index: {x, z, pieces:
// [{type, m, color}]}, m being the piece's matrix where it lies
const wrecks = new Map();
// Copies being drawn: per model type {mesh, pieces, dirty}
const pools = new Map();
// Pieces falling this frame
const moving = new Set();
// Copies of whole objects (addObjectPiece)
const objectPieces = new Set();
// Each vehicle's last position, by id ('me' for the player)
const lastPos = new Map();
// Pieces made by the prop being broken, for its wreck
let fresh = null;
let frame = 0;
let settle = 0;
let sweepTimer = 0;
let lastSoundAt = -Infinity;

const chunkKey = (cx, cz) => `${ChillFlightLogic.WORLD_SEED}:${cx},${cz}`;

function typeInfo(type) {
  if (type === 'rubble') {
    return {geo: rubbleGeo, mat: houseTintMat, useColor: true};
  }
  if (type === 'iceChunk') return {geo: iceChunkGeo, mat: icebergMat};
  return globalInstancer.types.get(type) || debrisTypes.get(type);
}

// A fallen streetlight's bulb, gone out
const deadBulbMat = createMaterial({color: 0x6a6a6a, flatShading: true});

// What draws a type's copies: knocked-off sails stop turning, a fallen
// streetlight's bulb goes dark, and a scared penguin stops its waddle
function debrisInfo(type) {
  const info = typeInfo(type);
  if (type === 'windmillBlades') return {...info, mat: windmillBladesStillMat};
  if (type === 'streetlightBulb') return {...info, mat: deadBulbMat};
  const still = penguinStillMats.get(info.mat);
  if (still) return {...info, mat: still};
  return info;
}

function pool(type) {
  let p = pools.get(type);
  if (!p) {
    p = {type, mesh: null, pieces: [], dirty: true};
    pools.set(type, p);
  }
  return p;
}

// Draws a copy of a model: type, matrix (array, kept and moved in place),
// colour (array or null), and the chunk it belongs to
function addPiece(type, m, color, group, source) {
  if (type === 'obj') return addObjectPiece(m, group, source);
  const p = pool(type);
  const piece = {type, m, color, group, slot: p.pieces.length};
  p.pieces.push(piece);
  p.dirty = true;
  fresh?.push(piece);
  return piece;
}

// A copy of a whole object (a lighthouse's tower, a hangar), drawn by itself
// at matrix m: source is {object, k}, k being its place among its prop's
// parts
function addObjectPiece(m, group, source) {
  const object = source.object.clone();
  object.matrixAutoUpdate = false;
  object.matrix.fromArray(m);
  object.visible = true;
  scene.add(object);
  const piece = {type: 'obj', m, color: null, group, object, k: source.k};
  objectPieces.add(piece);
  fresh?.push(piece);
  return piece;
}

function removePiece(piece) {
  if (piece.object) {
    scene.remove(piece.object);
    objectPieces.delete(piece);
    moving.delete(piece);
    return;
  }
  const p = pools.get(piece.type);
  const last = p.pieces.pop();
  if (last !== piece) {
    p.pieces[piece.slot] = last;
    last.slot = piece.slot;
  }
  p.dirty = true;
  moving.delete(piece);
}

function uploadPools() {
  for (const p of pools.values()) {
    const n = p.pieces.length;
    if (p.dirty && (!p.mesh || p.mesh.instanceMatrix.count < n)) {
      if (p.mesh) {
        scene.remove(p.mesh);
        p.mesh.dispose();
      }
      const info = debrisInfo(p.type);
      const capacity = Math.max(32, 2 ** Math.ceil(Math.log2(n || 1)));
      p.mesh = createDebrisMesh(info.geo, info.mat, capacity, info.useColor);
      p.mesh.name = 'Breakable ' + p.type;
      scene.add(p.mesh);
    }
    if (!p.mesh) continue;
    const mats = p.mesh.instanceMatrix;
    let changed = p.dirty;
    for (const piece of p.pieces) {
      if (!p.dirty && !moving.has(piece)) continue;
      mats.array.set(piece.m, piece.slot * 16);
      changed = true;
      if (p.dirty && p.mesh.instanceColor && piece.color) {
        p.mesh.instanceColor.array.set(piece.color, piece.slot * 3);
      }
    }
    p.mesh.count = n;
    p.mesh.visible = state._enableObjects && n > 0;
    if (changed) {
      mats.clearUpdateRanges();
      mats.addUpdateRange(0, n * 16);
      mats.needsUpdate = true;
      if (p.dirty && p.mesh.instanceColor) {
        p.mesh.instanceColor.clearUpdateRanges();
        p.mesh.instanceColor.addUpdateRange(0, n * 3);
        p.mesh.instanceColor.needsUpdate = true;
      }
    }
    p.dirty = false;
  }
}

// --- WHERE THE PROPS ARE ---

const _geoBoxes = new Map();
function geoBox(type) {
  let box = _geoBoxes.get(type);
  if (!box) {
    const geo = typeInfo(type).geo;
    if (!geo.boundingBox) geo.computeBoundingBox();
    box = {
      c: geo.boundingBox.getCenter(new THREE.Vector3()),
      h: geo.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5),
    };
    _geoBoxes.set(type, box);
  }
  return box;
}

// The world box a model's bounds fill with matrix elements e at offset o,
// into _box
function partBox(type, e, o) {
  const {c, h} = geoBox(type);
  const cx = e[o] * c.x + e[o + 4] * c.y + e[o + 8] * c.z + e[o + 12];
  const cy = e[o + 1] * c.x + e[o + 5] * c.y + e[o + 9] * c.z + e[o + 13];
  const cz = e[o + 2] * c.x + e[o + 6] * c.y + e[o + 10] * c.z + e[o + 14];
  const hx =
    Math.abs(e[o]) * h.x + Math.abs(e[o + 4]) * h.y + Math.abs(e[o + 8]) * h.z;
  const hy =
    Math.abs(e[o + 1]) * h.x +
    Math.abs(e[o + 5]) * h.y +
    Math.abs(e[o + 9]) * h.z;
  const hz =
    Math.abs(e[o + 2]) * h.x +
    Math.abs(e[o + 6]) * h.y +
    Math.abs(e[o + 10]) * h.z;
  _box.min.set(cx - hx, cy - hy, cz - hz);
  _box.max.set(cx + hx, cy + hy, cz + hz);
  return _box;
}

// How many breakable props a chunk has: the worker's (instanceData), then
// the ones built per chunk (meshProps)
function propCount(ud) {
  return ud.breakables.kinds.length + (ud.meshProps?.length || 0);
}

// A prop built per chunk's own settings ({kind, parts, rubble, onBreak}),
// or null
function propSpec(ud, i) {
  const n = ud.breakables.kinds.length;
  return i < n ? null : ud.meshProps[i - n];
}

function propKind(ud, i) {
  const n = ud.breakables.kinds.length;
  return i < n ? ud.breakables.kinds[i] : ud.meshProps[i - n].kind;
}

// The world box of a part (see propParts), into _box
function partWorldBox(part) {
  if (part.object) return _box.setFromObject(part.object);
  if (!part.mesh) {
    return partBox(part.type, part.data.matrices, part.index * 16);
  }
  const box = partBox(
    part.type,
    part.mesh.instanceMatrix.array,
    part.index * 16
  );
  return box.translate(part.mesh.position);
}

// A chunk's props as upright cylinders, in a grid, built the first time
// something comes near: {x, z (where the first part stands), cx, cz (the
// middle), radius, base, top, broken, cells, maxTop}
function chunkIndex(group) {
  const ud = group.userData;
  if (ud.breakIndex) return ud.breakIndex;
  if (!ud.breakables || !ud.instanceData) return null;
  const n = propCount(ud);
  const index = {
    x: new Float32Array(n),
    z: new Float32Array(n),
    cx: new Float32Array(n),
    cz: new Float32Array(n),
    radius: new Float32Array(n),
    base: new Float32Array(n),
    top: new Float32Array(n),
    broken: ud.breakBroken || new Set(),
    cells: new Map(),
    maxTop: -Infinity,
  };
  for (let i = 0; i < n; i++) {
    if (index.broken.has(i)) continue;
    const parts = propParts(group, i);
    if (!parts.length) continue;
    const first = copyMatrix(parts[0]);
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    let base = Infinity;
    let top = -Infinity;
    for (const part of parts) {
      if (GOES_OUT.test(part.type)) continue;
      const box = partWorldBox(part);
      base = Math.min(base, box.min.y);
      top = Math.max(top, box.max.y);
      if (OVERHANG.test(part.type)) continue;
      x0 = Math.min(x0, box.min.x);
      x1 = Math.max(x1, box.max.x);
      z0 = Math.min(z0, box.min.z);
      z1 = Math.max(z1, box.max.z);
    }
    // A sign's posts reach into the ground: it falls from where they go in
    if (i >= ud.breakables.kinds.length) {
      base = Math.max(base, getElevation(first[12], first[14]) - 1);
    }
    const kind = propKind(ud, i);
    // Trees are measured from their trunk, buildings from their middle
    const tree = kind !== BREAKABLE.HOUSE && kind !== BREAKABLE.SMALL;
    const cx = tree ? first[12] : (x0 + x1) / 2;
    const cz = tree ? first[14] : (z0 + z1) / 2;
    const reach = Math.max(cx - x0, x1 - cx, cz - z0, z1 - cz);
    // A penguin is "hit" when something comes near enough to scare it
    const critter = kind === BREAKABLE.CRITTER;
    if (critter) top = base + SCARE_HEIGHT;
    const radius = critter
      ? SCARE_RADIUS
      : reach *
        (kind === BREAKABLE.HOUSE ? BREAK.HOUSE_REACH : BREAK.TREE_REACH);
    index.x[i] = first[12];
    index.z[i] = first[14];
    index.cx[i] = cx;
    index.cz[i] = cz;
    index.radius[i] = radius;
    index.base[i] = base;
    index.top[i] = top;
    index.maxTop = Math.max(index.maxTop, top);
    const gx0 = Math.floor((cx - radius) / CELL);
    const gx1 = Math.floor((cx + radius) / CELL);
    const gz0 = Math.floor((cz - radius) / CELL);
    const gz1 = Math.floor((cz + radius) / CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const key = gx * 100003 + gz;
        let cell = index.cells.get(key);
        if (!cell) index.cells.set(key, (cell = []));
        cell.push(i);
      }
    }
  }
  ud.breakIndex = index;
  return index;
}

// --- BREAKING ---

// The parts of prop i in a chunk: [{type, data, index}] for the worker's
// props, or [{type, mesh, index}] for ones built per chunk
function propParts(group, i) {
  const {breakables: b, instanceData: data, meshProps} = group.userData;
  const n = b.kinds.length;
  if (i >= n) return meshProps[i - n].parts;
  const parts = [];
  for (let j = b.propStarts[i]; j < b.propStarts[i + 1]; j++) {
    const type = b.types[b.partTypes[j]];
    parts.push({type, data: data[type], index: b.partIndices[j]});
  }
  return parts;
}

// A part's matrix in the world
function copyMatrix(part) {
  if (part.object) {
    part.object.updateWorldMatrix(true, false);
    return new Float32Array(part.object.matrixWorld.elements);
  }
  const o = part.index * 16;
  if (!part.mesh) return part.data.matrices.slice(o, o + 16);
  const m = part.mesh.instanceMatrix.array.slice(o, o + 16);
  m[12] += part.mesh.position.x;
  m[13] += part.mesh.position.y;
  m[14] += part.mesh.position.z;
  return m;
}

function copyColor(part) {
  if (part.mesh || part.object || !typeInfo(part.type)?.useColor) return null;
  const o = part.index * 3;
  return part.data.colors.slice(o, o + 3);
}

// A part's colour as rubble: its own, or its material's
function rubbleColor(part) {
  const color = copyColor(part);
  if (color) return color;
  let mat = part.object
    ? firstMesh(part.object)?.material
    : typeInfo(part.type).mat;
  if (Array.isArray(mat)) mat = mat[0];
  if (!mat?.color) return PLASTER;
  return mat.vertexColors ? PLASTER : mat.color.toArray();
}

function firstMesh(object) {
  let found = null;
  object.traverse((o) => {
    if (!found && o.isMesh) found = o;
  });
  return found;
}

// Stops drawing a part where it stood
function hidePart(part) {
  if (part.object) {
    part.object.visible = false;
    return;
  }
  if (!part.mesh) {
    hideInstance(part.data, part.index);
    return;
  }
  const mats = part.mesh.instanceMatrix;
  mats.array.fill(0, part.index * 16, part.index * 16 + 16);
  mats.needsUpdate = true;
}

// A tree (or cactus or snowman) tips over along (dx, dz) from its base
function topple(
  group,
  parts,
  x,
  base,
  z,
  height,
  thickness,
  dx,
  dz,
  kts,
  snowman
) {
  const groundAt = (d) => getElevation(x + dx * d, z + dz * d) - base;
  const anim = {
    kind: 'topple',
    pivot: new THREE.Vector3(x, base, z),
    axis: new THREE.Vector3(dz, 0, -dx),
    angle: 0,
    spin:
      (snowman ? 2 : 1) * (BREAK.TOPPLE_SPIN + kts * BREAK.TOPPLE_SPIN_PER_KT),
    rest: restAngle(height, thickness, groundAt),
    done: false,
    pieces: [],
  };
  anim.spin = Math.min(anim.spin, BREAK.TOPPLE_SPIN_MAX * (snowman ? 2 : 1));
  parts.forEach((part, k) => {
    if (GOES_OUT.test(part.type)) return;
    const m0 = copyMatrix(part);
    const piece = addPiece(part.type, m0.slice(), copyColor(part), group, {
      object: part.object,
      k,
    });
    piece.m0 = m0;
    piece.anim = anim;
    anim.pieces.push(piece);
    moving.add(piece);
  });
  return anim;
}

// Flings a piece of house: centre (cx, cy, cz) of its model, thrown with
// velocity (vx, vy, vz), turning about `axis` until it lands at `rest`
function fling(piece, cx, cy, cz, vx, vy, vz, axis, spin, rest) {
  piece.m0 = piece.m.slice();
  piece.anim = {
    kind: 'fly',
    from: new THREE.Vector3(cx, cy, cz),
    axis,
    x: cx,
    y: cy,
    z: cz,
    vx,
    vy,
    vz,
    angle: 0,
    spin,
    rest,
    done: false,
  };
  moving.add(piece);
}

const rand = (a, b) => a + Math.random() * (b - a);

// What a building's part does when it falls down (see FOLDS): a part can
// also say for itself (role)
function partRole(part) {
  if (part.role) return part.role;
  if (FOLDS.test(part.type)) return 'fold';
  if (FLINGS.test(part.type)) return 'fling';
  if (part.type === 'pierDeck' || ROCKS.test(part.type) || ICE.test(part.type))
    return 'rubble';
  return 'hide';
}

// A building folds down and leans along (dx, dz); its roof, chimney or
// sails are thrown off along with blocks of wall and roof (planks off a
// pier), in a cloud of dust. radius: how far it spreads; spec: the prop's
// own settings, if any ({rubble})
function collapse(group, parts, x, base, z, top, radius, dx, dz, kts, spec) {
  const fwd = Math.min(FLING_MAX, kts * 0.12);
  const axis = new THREE.Vector3(dz, 0, -dx);
  let bodyColor = null;
  let roofColor = null;
  parts.forEach((part, k) => {
    const type = part.type;
    const role = partRole(part);
    const source = {object: part.object, k};
    if (role === 'fold') {
      bodyColor = rubbleColor(part);
      const m0 = copyMatrix(part);
      const piece = addPiece(type, m0.slice(), copyColor(part), group, source);
      piece.m0 = m0;
      piece.anim = {
        kind: 'fold',
        pivot: new THREE.Vector3(x, base, z),
        axis,
        t: 0,
        done: false,
      };
      moving.add(piece);
    } else if (role === 'fling') {
      const color = copyColor(part);
      const roof = type.endsWith('Roof') || !!part.object;
      if (roof) roofColor = rubbleColor(part);
      const m = copyMatrix(part);
      // A sail stops where it had turned to
      if (type === 'windmillBlades') {
        _m.fromArray(m).multiply(
          _r.makeRotationZ(-SAIL_SPIN * animationUniforms.uTime.value)
        );
        _m.toArray(m);
      }
      const box = part.object
        ? _box.setFromObject(part.object)
        : partBox(type, m, 0);
      const piece = addPiece(type, m, color, group, source);
      const tumble = roof || type === 'windmillBlades';
      fling(
        piece,
        (box.min.x + box.max.x) / 2,
        (box.min.y + box.max.y) / 2,
        (box.min.z + box.max.z) / 2,
        dx * fwd * rand(0.4, 0.8) + rand(-3, 3),
        rand(2, 6),
        dz * fwd * rand(0.4, 0.8) + rand(-3, 3),
        tumble
          ? axis
          : new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(),
        tumble ? rand(0.6, 1.2) : rand(3, 6),
        base + (roof ? Math.max(2.5, (box.max.y - box.min.y) * 0.25) : 1)
      );
    } else if (role === 'rubble') {
      bodyColor = rubbleColor(part);
    }
    // Doors, windows and the like are hidden with the rest and not redrawn
  });
  // Something built of blocks (a rock arch) comes down in them
  for (const [bx, by, bz, size, color] of spec?.blocks || []) {
    _m.compose(
      _p.set(bx, by, bz),
      _q.setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)),
      _s.set(size, size * rand(0.6, 1), size)
    );
    const piece = addPiece(
      'rubble',
      _m.toArray(new Float32Array(16)),
      color,
      group
    );
    fling(
      piece,
      bx,
      by,
      bz,
      dx * fwd * rand(0.1, 0.3) + rand(-4, 4),
      rand(-2, 4),
      dz * fwd * rand(0.1, 0.3) + rand(-4, 4),
      new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
      rand(0.3, 1),
      Math.max(getElevation(bx, bz), WATER_LEVEL - 0.3) + size * 0.3
    );
  }
  const count = spec?.rubble ?? (RUBBLE[parts[0].type] || 0);
  const planks = parts[0].type === 'pierDeck';
  const ice = ICE.test(parts[0].type);
  const floe = parts[0].type === 'iceFloe';
  const height = Math.max(2, top - base);
  const spread = Math.max(4, radius * 0.5);
  const scale = Math.min(2.2, Math.max(1, radius / 8)) * (ice ? ICE_CHUNK : 1);
  for (let i = 0; i < count; i++) {
    const size = rand(0.8, 1.8) * scale;
    const color = (i % 3 === 2 ? roofColor : bodyColor) || bodyColor;
    const px = x + rand(-spread, spread);
    const py = base + rand(0.3, 0.8) * height;
    const pz = z + rand(-spread, spread);
    _m.compose(
      _p.set(px, py, pz),
      _q.setFromEuler(
        floe
          ? new THREE.Euler(rand(-0.15, 0.15), rand(0, 3), rand(-0.15, 0.15))
          : new THREE.Euler(rand(0, 3), rand(0, 3), 0)
      ),
      planks
        ? _s.set(size * 2.5, size * 0.25, size * 0.7)
        : floe
          ? _s.set(size * rand(1.2, 1.8), size * 0.3, size * rand(1, 1.5))
          : _s.set(size, size * rand(0.5, 1), size)
    );
    const piece = addPiece(
      ice ? 'iceChunk' : 'rubble',
      _m.toArray(new Float32Array(16)),
      ice ? null : color,
      group
    );
    const out = rand(4, 12);
    const ox = px - x;
    const oz = pz - z;
    const len = Math.hypot(ox, oz) || 1;
    fling(
      piece,
      px,
      py,
      pz,
      dx * fwd * rand(0.6, 1.1) + (ox / len) * out,
      // Slabs of a floe skid out flat, turning
      floe ? rand(1, 3) : rand(4, 12),
      dz * fwd * rand(0.6, 1.1) + (oz / len) * out,
      floe
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
      rand(2, 6),
      // Planks and ice float
      Math.max(getElevation(px, pz), WATER_LEVEL - 0.3) + size * 0.3
    );
  }
}

const hasChimney = (parts) => parts.some((p) => p.type.endsWith('Chimney'));

function hideChimneySmoke(group, x, z) {
  const smoke = group.userData.chimneySmoke;
  if (!smoke) return;
  const lx = x - smoke.position.x;
  const lz = z - smoke.position.z;
  const e = smoke.instanceMatrix.array;
  let hid = false;
  for (let i = 0; i < smoke.count; i++) {
    const dx = e[i * 16 + 12] - lx;
    const dz = e[i * 16 + 14] - lz;
    if (dx * dx + dz * dz < 12 * 12) {
      e.fill(0, i * 16, i * 16 + 16);
      hid = true;
    }
  }
  if (hid) smoke.instanceMatrix.needsUpdate = true;
}

// Breaks prop i of a chunk, hit along (dx, dz) at kts. mine: the player hit
// it (rather than a friend), so they feel it.
function breakProp(group, index, i, dx, dz, kts, mine, buggy) {
  index.broken.add(i);
  group.userData.breakBroken = index.broken;
  const kind = propKind(group.userData, i);
  const parts = propParts(group, i);
  const x = index.x[i];
  const z = index.z[i];
  const base = index.base[i];
  const top = index.top[i];
  const house = kind === BREAKABLE.HOUSE;
  const small = kind === BREAKABLE.SMALL;
  const snowman = kind === BREAKABLE.SNOWMAN;
  const pier = parts[0].type === 'pierDeck';
  const ice = ICE.test(parts[0].type);

  fresh = [];
  if (house || small) {
    collapse(
      group,
      parts,
      index.cx[i],
      base,
      index.cz[i],
      top,
      index.radius[i],
      dx,
      dz,
      kts,
      propSpec(group.userData, i)
    );
  } else {
    const thickness = (index.radius[i] / BREAK.TREE_REACH) * 0.5;
    topple(
      group,
      parts,
      x,
      base,
      z,
      top - base,
      thickness,
      dx,
      dz,
      kts,
      snowman
    );
  }
  for (const part of parts) hidePart(part);
  if (hasChimney(parts)) hideChimneySmoke(group, x, z);
  propSpec(group.userData, i)?.onBreak?.(group);
  const wreck = {x, z, pieces: fresh};
  fresh = null;
  const key = chunkKey(group.userData.chunkX, group.userData.chunkZ);
  if (!wrecks.has(key)) wrecks.set(key, new Map());
  wrecks.get(key).set(i, wreck);

  // Dust, leaves or snow
  const height = top - base;
  const dust = sampleGroundColor(x, z, _dust) ? _dust.lerp(DUST, 0.5) : DUST;
  if (pier) {
    propPuffs(x, WATER_LEVEL, z, index.radius[i], 4, SPRAY, 30, 6, 6);
  } else if (ice) {
    const r = index.radius[i];
    propPuffs(x, WATER_LEVEL, z, r, 4, SPRAY, Math.round(20 + r * 2), 7, 6);
    propPuffs(
      x,
      WATER_LEVEL + height * 0.4,
      z,
      r * 0.7,
      height * 0.5,
      SNOW,
      Math.round(10 + r * 2),
      5,
      4
    );
  } else if (house) {
    // A bridge support standing in the water throws up spray too
    if (parts[0].type === 'bridgePierShaft' && base < WATER_LEVEL + 2) {
      propPuffs(x, WATER_LEVEL, z, index.radius[i], 4, SPRAY, 30, 6, 6);
    }
    const spread = Math.max(8, index.radius[i] * 0.7);
    const count = Math.min(90, Math.round(40 * (spread / 8)));
    propPuffs(x, base, z, spread, height * 0.6, dust, count, 9, 5);
  } else if (parts[0].type === 'bush') {
    const c = parts[0].data.colors;
    const o = parts[0].index * 3;
    LEAF_PUFF.setRGB(c[o], c[o + 1], c[o + 2]);
    const r = index.radius[i];
    propPuffs(x, base + height * 0.5, z, r, height * 0.5, LEAF_PUFF, 8, 2.5, 2);
  } else if (small) {
    propPuffs(x, base, z, 3, 3, EMBERS, 12, 2, 6);
    propPuffs(x, base, z, 3, 2, dust, 8, 4, 2);
  } else if (snowman) {
    propPuffs(x, base, z, 2, height, SNOW, 14, 3, 3);
  } else {
    const leaves = parts.find((p) => typeInfo(p.type)?.useColor);
    if (leaves) {
      const c = leaves.data.colors;
      const o = leaves.index * 3;
      LEAF_PUFF.setRGB(c[o], c[o + 1], c[o + 2]);
      propPuffs(
        x,
        base + height * 0.6,
        z,
        index.radius[i],
        height * 0.4,
        LEAF_PUFF,
        10,
        3,
        2
      );
    }
    propPuffs(x, base, z, 2, 2, dust, 6, 4, 2);
  }

  // A boulder or a floe is knocked aside about as easily as a tree
  const boulder = ROCKS.test(parts[0].type) || parts[0].type === 'iceFloe';
  const what =
    house && !boulder ? 'house' : snowman || small ? 'snowman' : 'tree';
  const fallTime = house ? 0 : 1.1 - Math.min(0.6, kts / 400);
  if (mine) {
    const keep = speedKept(what, buggy);
    if (buggy) slowBuggy(keep);
    else state.flightSpeedMultiplier *= keep;
    recordPropCrashStrain(what, kts, buggy);
    state.impactShake = Math.max(state.impactShake || 0, SHAKE[what]);
    smashHaptic(house);
    playSmashSound(house, 1, fallTime);
  } else {
    const d = camera.position.distanceTo(_v.set(x, base, z));
    if (d < HEAR_RANGE) playSmashSound(house, 1 - d / HEAR_RANGE, fallTime);
  }
}

function playSmashSound(house, loud, fallTime) {
  const now = performance.now();
  // Plowing through a forest: one crack every so often, not one per tree
  if (!house && now - lastSoundAt < 70) return;
  lastSoundAt = now;
  playSmash(house, loud, fallTime);
}

const _pose = new THREE.Matrix4();
const smoothstep = (x) => x * x * (3 - 2 * x);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// A penguin (prop i of a chunk) scared by something at (vx, vz) heading
// along (hx, hz) turns away, out of its path, hops to the edge of its floe
// and dives in. It's back when its chunk loads again.
function scatter(group, index, i, vx, vz, hx, hz) {
  index.broken.add(i);
  const parts = propParts(group, i);
  // Its copies carry on from where its waddle had got to: the step and turn
  // go into their matrices, and its sway eases off as it hops
  const first = copyMatrix(parts[0]);
  const sway = penguinWaddlePose(
    first[12],
    first[14],
    animationUniforms.uTime.value,
    _pose
  );
  const m0 = _m.fromArray(first).multiply(_pose).toArray(first);
  const x = m0[12];
  const z = m0[14];
  let ux = x - vx;
  let uz = z - vz;
  let len = Math.hypot(ux, uz) || 1;
  // Mostly off to the side it's on, a little away
  const side = ux * -hz + uz * hx > 0 ? 1 : -1;
  ux = -hz * side * 0.8 + (ux / len) * 0.4;
  uz = hx * side * 0.8 + (uz / len) * 0.4;
  len = Math.hypot(ux, uz) || 1;
  const turn = rand(-0.5, 0.5);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  [ux, uz] = [(ux / len) * c - (uz / len) * s, (ux / len) * s + (uz / len) * c];
  // How far it is to the water: out to the edge of the floe it stands on
  let out = 2;
  const floes = group.userData.instanceData.iceFloe;
  for (let k = 0; floes && k < floes.count; k++) {
    const e = floes.matrices;
    const fx = e[k * 16 + 12] - x;
    const fz = e[k * 16 + 14] - z;
    const scale = Math.hypot(e[k * 16], e[k * 16 + 2]);
    if (fx * fx + fz * fz > FLOE_NEAR * FLOE_NEAR || scale < 0.9) continue;
    // Along (ux, uz) from the penguin to the circle around the floe
    const r = FLOE_RADIUS * scale;
    const b = -(fx * ux + fz * uz);
    const disc = b * b - (fx * fx + fz * fz - r * r);
    if (disc > 0) out = Math.max(out, -b + Math.sqrt(disc));
  }
  const hops = Math.max(1, Math.round(out / 3.5));
  const anim = {
    kind: 'scatter',
    p0: new THREE.Vector3(x, m0[13], z),
    ux,
    uz,
    // From facing its own way (model +z) to facing (ux, uz), the short way
    turn: wrapAngle(Math.atan2(ux, uz) - Math.atan2(m0[8], m0[10])),
    sway,
    hops,
    hopLen: (out + 0.5) / hops,
    t: -rand(0, 0.3),
    splashed: false,
    pieces: [],
  };
  parts.forEach((part) => {
    const m = _m.fromArray(copyMatrix(part)).multiply(_pose).toArray([]);
    const piece = addPiece(part.type, m.slice(), null, group);
    piece.m0 = m;
    piece.anim = anim;
    anim.pieces.push(piece);
    moving.add(piece);
    hidePart(part);
  });
}

// Where a scattering penguin is at its time t: into _r (its turn and tilt)
// and _p (how far its feet have moved). Returns whether it's gone.
function scatterPose(anim) {
  const t = Math.max(0, anim.t);
  const hopEnd = anim.hops * HOP_TIME;
  let along;
  let up;
  let pitch = 0;
  let roll = 0;
  // It turns and stops swaying over its first hop, easing in and out
  const e = smoothstep(Math.min(1, t / HOP_TIME));
  const turn = anim.turn * e;
  anim.swayNow = anim.sway * (1 - e);
  if (t < hopEnd) {
    const h = t / HOP_TIME;
    const f = h - Math.floor(h);
    along = Math.floor(h) * anim.hopLen + f * anim.hopLen;
    up = Math.sin(f * Math.PI) * HOP_HEIGHT;
    roll = Math.sin(h * Math.PI) * 0.2;
  } else {
    // Belly first into the water
    const d = Math.min(1, (t - hopEnd) / DIVE_TIME);
    along = anim.hops * anim.hopLen + d * DIVE_OUT;
    up = Math.sin(d * Math.PI) * HOP_HEIGHT - d * d * DIVE_DEPTH;
    pitch = Math.min(1.5, d * 2.5);
  }
  _r.makeRotationY(turn);
  _r.premultiply(_r2.makeRotationAxis(_axis.set(anim.uz, 0, -anim.ux), pitch));
  _r.premultiply(_r2.makeRotationAxis(_axis.set(anim.ux, 0, anim.uz), roll));
  _p.set(anim.ux * along, up, anim.uz * along);
  return t >= hopEnd + DIVE_TIME;
}

function countPieces() {
  let n = 0;
  for (const p of pools.values()) n += p.pieces.length;
  return n + objectPieces.size;
}

// --- HITS ---

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

const _near = [];

// --- BOATS ---
// Boats drift and bob (flight-camera.js), so they aren't in a chunk's list:
// each frame the vehicle is checked against the boats nearby, and one hit
// rolls over and sinks (pos.sunk stops it being drawn), for the session.

// How far a boat's middle can be from its chunk's (units)
const BOAT_RANGE = 1200;
// Sunk boats this session: chunk key + ':s' or ':p' + index
const sunk = new Set();
const BOATS = {
  s: {positions: 'sailboatPositions', scale: 1.8, mast: 'boatMast'},
  p: {positions: 'pirateShipPositions', scale: 2.5, mast: 'pirateMast'},
};
const _boatShape = {};

// A boat's reach and height above its waterline, from its models
function boatShape(kind) {
  if (_boatShape[kind]) return _boatShape[kind];
  const {scale, mast} = BOATS[kind];
  const hull = geoBox(kind === 's' ? 'boatHull0' : 'pirateHull');
  const m = geoBox(mast);
  const shape = {
    radius: Math.max(hull.h.x, hull.h.z) * scale * 0.7,
    top: (m.c.y + m.h.y) * scale,
  };
  _boatShape[kind] = shape;
  return shape;
}

// The models of boat `index` of a chunk (`kind` 's' or 'p'), each with the
// mesh and instance drawing it: [{type, mesh, slot}]
function boatModels(ud, kind, index) {
  if (kind === 's') {
    const c = ud.boatColorIndices[index];
    return [
      ['boatHull' + c, ud.boatHulls[c], ud.boatInstIndices[index]],
      ['boatRim', ud.boatRims, index],
      ['boatDeck', ud.boatDecks, index],
      ['boatMast', ud.boatMasts, index],
      ['boatBoom', ud.boatBooms, index],
      ['boatSail', ud.boatSails, index],
    ];
  }
  const sail =
    (ud.pirateShipPositions[index].bodyId || 0) % ud.pirateSails.length;
  // A pirate ship's sail instance moves about, but its matrix is the same as
  // its mast's
  return [
    ['pirateHull', ud.pirateHulls, index],
    ['pirateRim', ud.pirateRims, index],
    ['pirateDeck', ud.pirateDecks, index],
    ['pirateMast', ud.pirateMasts, index],
    ['pirateFlag', ud.pirateFlags, index],
    ['pirateJollyRoger', ud.pirateJollyRogers, index],
    ['pirateSail' + sail, ud.pirateMasts, index],
  ];
}

function sinkBoat(group, kind, index, dx, dz, kts, mine, buggy) {
  const ud = group.userData;
  const pos = ud[BOATS[kind].positions][index];
  pos.sunk = true;
  sunk.add(chunkKey(ud.chunkX, ud.chunkZ) + ':' + kind + index);
  const models = boatModels(ud, kind, index);
  // Where it is now, from its mast's matrix
  const mast = models[3][1];
  const m0 = mast.instanceMatrix.array.slice(index * 16, index * 16 + 16);
  m0[12] += mast.position.x;
  m0[13] += mast.position.y;
  m0[14] += mast.position.z;
  const x = m0[12];
  const z = m0[14];
  // Rolls away from the hit, about its length
  const fx = m0[8];
  const fz = m0[10];
  const len = Math.hypot(fx, fz) || 1;
  const side = dx * -fz + dz * fx > 0 ? 1 : -1;
  const anim = {
    kind: 'sink',
    pivot: new THREE.Vector3(x, WATER_LEVEL, z),
    axis: new THREE.Vector3((fx / len) * side, 0, (fz / len) * side),
    t: 0,
    done: false,
    pieces: [],
  };
  // Stop drawing it now (flight-camera.js keeps it hidden while it moves
  // the rest): a pirate ship's sail is found by where it stands
  const hide = (mesh, slot) => {
    if (!mesh || slot < 0) return;
    mesh.instanceMatrix.array.fill(0, slot * 16, slot * 16 + 16);
    mesh.instanceMatrix.needsUpdate = true;
  };
  for (const [type, mesh, slot] of models) {
    if (!type.startsWith('pirateSail')) hide(mesh, slot);
  }
  if (kind === 'p') {
    const sails = ud.pirateSails[models[6][0].slice(10)];
    const e = sails.instanceMatrix.array;
    let slot = -1;
    for (let i = 0; i < sails.count; i++) {
      const dx = e[i * 16 + 12] + sails.position.x - x;
      const dz = e[i * 16 + 14] + sails.position.z - z;
      if (dx * dx + dz * dz < 0.01) slot = i;
    }
    hide(sails, slot);
  }
  hide(kind === 's' ? ud.boatReflections : ud.pirateReflections, index);
  for (const [type] of models) {
    const piece = addPiece(type, m0.slice(), null, group);
    piece.m0 = m0;
    piece.anim = anim;
    anim.pieces.push(piece);
    moving.add(piece);
  }
  const shape = boatShape(kind);
  propPuffs(x, WATER_LEVEL, z, shape.radius, 4, SPRAY, 40, 7, 6);
  if (mine) {
    const keep = speedKept('house', buggy);
    if (buggy) slowBuggy(keep);
    else state.flightSpeedMultiplier *= keep;
    state.impactShake = Math.max(state.impactShake || 0, SHAKE.house);
    smashHaptic(true);
    playSmashSound(true, 1, 0);
  } else {
    const d = camera.position.distanceTo(_v.set(x, WATER_LEVEL, z));
    if (d < HEAR_RANGE) playSmashSound(true, 1 - d / HEAR_RANGE, 0);
  }
}

// Checks the boats a vehicle (radius r) touched moving from a to b
function sweepBoats(a, b, r, ux, uz, kts, mine, buggy) {
  if (Math.min(a.y, b.y) - r > WATER_LEVEL + 120) return;
  for (const group of watercraftChunks) {
    const ud = group.userData;
    const wp = ud.worldPosition || group.position;
    if (Math.abs(wp.x - b.x) > BOAT_RANGE || Math.abs(wp.z - b.z) > BOAT_RANGE)
      continue;
    for (const kind in BOATS) {
      const list = ud[BOATS[kind].positions];
      if (!list) continue;
      const shape = boatShape(kind);
      list.forEach((pos, index) => {
        if (pos.sunk) return;
        const x = pos.worldX ?? wp.x + pos.x;
        const z = pos.worldZ ?? wp.z + pos.z;
        const top = pos.y + shape.top;
        if (sweptHit(a, b, r, x, z, shape.radius, WATER_LEVEL - 2, top)) {
          sinkBoat(group, kind, index, ux, uz, kts, mine, buggy);
        }
      });
    }
  }
}

// Checks the props a vehicle (radius r) touched moving from a to b
function sweep(a, b, r, mine, buggy) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const step = Math.hypot(dx, dz);
  if (step < 1e-4 || step > BREAK.MAX_STEP) return;
  const dt = Math.max(1e-3, state.smoothedDelta || 1 / 60);
  const kts = mine
    ? BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60
    : step / dt; // 1 unit/s is about 1 knot
  const minY = Math.min(a.y, b.y) - r;
  // Well above the ground, nothing to hit (and no chunk to index)
  if (minY - getElevation(b.x, b.z) > HIGH_ABOVE_GROUND) return;
  const ux = dx / step;
  const uz = dz / step;
  const x0 = Math.min(a.x, b.x) - r;
  const x1 = Math.max(a.x, b.x) + r;
  const z0 = Math.min(a.z, b.z) - r;
  const z1 = Math.max(a.z, b.z) + r;
  // A chunk's props can stand a little past its edge (a town's streets run
  // on), so neighbours close by are checked too
  const cx0 = Math.round((x0 - CHUNK_SPILL) / CHUNK_SIZE);
  const cx1 = Math.round((x1 + CHUNK_SPILL) / CHUNK_SIZE);
  const cz0 = Math.round((z0 - CHUNK_SPILL) / CHUNK_SIZE);
  const cz1 = Math.round((z1 + CHUNK_SPILL) / CHUNK_SIZE);
  _near.length = 0;
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const group = chunks.get(`${cx},${cz}`);
      if (group?.userData.breakables) _near.push(group);
    }
  }
  _near.push(...standaloneProps);
  sweepBoats(a, b, r, ux, uz, kts, mine, buggy);
  for (const group of _near) {
    const index = chunkIndex(group);
    if (!index || minY > index.maxTop) continue;
    for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
      for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
        const cell = index.cells.get(gx * 100003 + gz);
        if (!cell) continue;
        for (const i of cell) {
          if (index.broken.has(i)) continue;
          const critter = propKind(group.userData, i) === BREAKABLE.CRITTER;
          if (
            sweptHit(
              a,
              b,
              r,
              index.cx[i],
              index.cz[i],
              index.radius[i],
              index.base[i],
              index.top[i]
            )
          ) {
            if (critter) {
              scatter(group, index, i, b.x, b.z, ux, uz);
              continue;
            }
            // Some props have gaps you can pass through (a rock arch)
            const spec = propSpec(group.userData, i);
            if (spec?.hit && !spec.hit(b, r)) continue;
            // Falls the way it was pushed, give or take
            const jitter = rand(-0.3, 0.3);
            const c = Math.cos(jitter);
            const s = Math.sin(jitter);
            breakProp(
              group,
              index,
              i,
              ux * c - uz * s,
              ux * s + uz * c,
              kts,
              mine,
              buggy
            );
          }
        }
      }
    }
  }
}

function sweepVehicle(id, pos, buggy, mine) {
  _b.copy(pos);
  if (buggy) _b.y += BUGGY_CENTER;
  const last = lastPos.get(id);
  if (last) {
    _a.copy(last);
    sweep(_a, _b, buggy ? BREAK.BUGGY_RADIUS : BREAK.PLANE_RADIUS, mine, buggy);
    last.copy(_b);
  } else {
    lastPos.set(id, _b.clone());
  }
}

// --- EACH FRAME ---

function animate(delta) {
  for (const piece of moving) {
    const anim = piece.anim;
    if (anim.kind === 'topple') {
      // Pieces of one tree share it: step it once per frame
      if (anim.stepped !== frame) {
        anim.stepped = frame;
        stepTopple(anim, delta);
      }
      _r.makeRotationAxis(_axis.copy(anim.axis).normalize(), anim.angle);
    } else if (anim.kind === 'sink') {
      if (anim.stepped !== frame) {
        anim.stepped = frame;
        stepSink(anim, delta);
      }
      const pv = anim.pivot;
      _m.makeTranslation(pv.x, pv.y - anim.drop, pv.z);
      _m.multiply(_r.makeRotationAxis(anim.axis, anim.roll));
      _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
      _m.multiply(_m0.fromArray(piece.m0));
      _m.toArray(piece.m);
      if (anim.done) removePiece(piece);
      continue;
    } else if (anim.kind === 'scatter') {
      if (anim.stepped !== frame) {
        anim.stepped = frame;
        anim.t += delta;
      }
      const gone = scatterPose(anim);
      const pv = anim.p0;
      // Into the water with a splash
      if (!anim.splashed && pv.y + _p.y < WATER_LEVEL) {
        anim.splashed = true;
        propPuffs(
          pv.x + _p.x,
          WATER_LEVEL,
          pv.z + _p.z,
          1.5,
          2,
          SPRAY,
          10,
          3,
          3
        );
      }
      _m.makeTranslation(pv.x + _p.x, pv.y + _p.y, pv.z + _p.z);
      _m.multiply(_r);
      _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
      _m.multiply(_m0.fromArray(piece.m0));
      _m.multiply(_t.makeRotationZ(-anim.swayNow));
      _m.toArray(piece.m);
      if (gone) removePiece(piece);
      continue;
    } else if (anim.kind === 'fold') {
      stepFold(anim, delta);
      _r.makeRotationAxis(_axis.copy(anim.axis).normalize(), anim.lean);
      _r.multiply(_t.makeScale(1, anim.squash, 1));
    } else {
      stepFlying(anim, delta, GRAVITY);
      _m.makeTranslation(anim.x, anim.y, anim.z);
      _m.multiply(_r.makeRotationAxis(anim.axis, anim.angle));
      _m.multiply(_t.makeTranslation(-anim.from.x, -anim.from.y, -anim.from.z));
      _m.multiply(_m0.fromArray(piece.m0));
      _m.toArray(piece.m);
      piece.object?.matrix.fromArray(piece.m);
      if (anim.done) moving.delete(piece);
      continue;
    }
    // Turn about the base: T(pivot) R T(-pivot) M0
    const pv = anim.pivot;
    _m.makeTranslation(pv.x, pv.y, pv.z);
    _m.multiply(_r);
    _m.multiply(_t.makeTranslation(-pv.x, -pv.y, -pv.z));
    _m.multiply(_m0.fromArray(piece.m0));
    _m.toArray(piece.m);
    piece.object?.matrix.fromArray(piece.m);
    if (anim.done) moving.delete(piece);
  }
}

// Shows the wrecks of chunks loaded again, and drops the pieces of chunks
// unloaded
function syncChunks() {
  for (const group of chunks.values()) {
    const ud = group.userData;
    if (ud.breakSynced || !ud.breakables || !ud.instanceData) continue;
    const n = propCount(ud);
    ud.breakSynced = true;
    const key = chunkKey(ud.chunkX, ud.chunkZ);
    for (const kind in BOATS) {
      ud[BOATS[kind].positions]?.forEach((pos, index) => {
        if (sunk.has(key + ':' + kind + index)) pos.sunk = true;
      });
    }
    const list = wrecks.get(key);
    if (!list) continue;
    ud.breakBroken = new Set();
    for (const [i, wreck] of list) {
      if (i >= n) continue;
      const parts = propParts(group, i);
      // Only if the prop is where it was (a graphics setting can change
      // what a chunk holds)
      const m = parts[0] && copyMatrix(parts[0]);
      if (
        !m ||
        Math.abs(m[12] - wreck.x) > 0.5 ||
        Math.abs(m[14] - wreck.z) > 0.5
      )
        continue;
      ud.breakBroken.add(i);
      for (const part of parts) hidePart(part);
      if (hasChimney(parts)) hideChimneySmoke(group, wreck.x, wreck.z);
      propSpec(ud, i)?.onBreak?.(group);
      wreck.pieces = wreck.pieces.map((old) =>
        addPiece(old.type, old.m, old.color, group, {
          object: parts[old.k]?.object,
          k: old.k,
        })
      );
    }
  }
  // Pieces of chunks no longer loaded
  if (--sweepTimer > 0) return;
  sweepTimer = 30;
  const gone = (piece) => {
    const {chunkX, chunkZ, standalone} = piece.group.userData;
    return !standalone && chunks.get(`${chunkX},${chunkZ}`) !== piece.group;
  };
  for (const p of pools.values()) {
    for (let i = p.pieces.length - 1; i >= 0; i--) {
      if (gone(p.pieces[i])) removePiece(p.pieces[i]);
    }
  }
  for (const piece of objectPieces) if (gone(piece)) removePiece(piece);
}

/** Per frame: knocks over what the player and friends ran into, and moves
 * what's falling. */
export function updateBreakables(delta) {
  if (state.isPaused || delta <= 0) return;
  frame++;
  syncChunks();
  const live = state._enableObjects && !state.isFreeCamera;
  settle = live ? settle + delta : 0;
  if (settle > SETTLE) {
    sweepVehicle('me', planeGroup.position, activePlaneType === 'buggy', true);
    forEachPeerVehicle((id, pos, buggy) => sweepVehicle(id, pos, buggy, false));
  } else {
    lastPos.clear();
  }
  animate(delta);
  uploadPools();
}

/** For tests: how many props are down, and how many pieces are drawn. */
export function breakablesStats() {
  let wrecked = 0;
  for (const list of wrecks.values()) wrecked += list.size;
  return {wrecked, pieces: countPieces(), moving: moving.size};
}
