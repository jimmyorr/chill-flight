// --- KNOCKING PROPS OVER ---
// Trees, cacti and snowmen topple and houses fall apart when the plane or
// the buggy runs into them, a friend's too in multiplayer: each player's game
// runs the same hit test for the friends it shows, and the world is the same
// from the seed, so nothing is sent over the network.
//
// The terrain worker lists each chunk's breakable props and the instances
// drawing them (InstanceCollector.breakables in terrain-gen.js). A hit stops
// drawing those instances (hideInstance) and draws copies here, in one
// instanced mesh per model, that fall over and stay down. Wrecks are kept
// for the session, so a chunk loaded again shows them where they fell.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {BASE_FLIGHT_SPEED, CHUNK_SIZE} from './constants.js';
import {chunks, getElevation, houseTintMat} from './terrain-geometry.js';
import {BREAKABLE} from './terrain-gen.js';
import {
  createDebrisMesh,
  globalInstancer,
  hideInstance,
  sampleGroundColor,
} from './terrain-chunks.js';
import {camera} from './sky.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {playSmash} from './sfx-events.js';
import {smashHaptic} from './haptics.js';
import {slowBuggy} from './buggy.js';
import {propPuffs} from './particles.js';
import {forEachPeerVehicle} from './multiplayer.js';
import {
  BREAK,
  restAngle,
  speedKept,
  stepFlying,
  stepTopple,
  sweptHit,
} from './breakables-logic.js';

// Spatial grid cell for looking up a chunk's props (units)
const CELL = 64;
// The buggy's centre above its position (which is where its wheels touch)
const BUGGY_CENTER = 2;
// Gravity on bits of house (units/s², about 2 g, so they don't float)
const GRAVITY = -40;
// How fast bits of house fly off (units/s), at most
const FLING_MAX = 35;
// How long a house's walls take to fold down (s), how low they end up
// (fraction of their height) and how far they lean over (rad)
const COLLAPSE_TIME = 0.9;
const COLLAPSE_HEIGHT = 0.22;
const COLLAPSE_LEAN = 0.35;
// Rubble blocks thrown out of a one-story and a two-story house
const RUBBLE = {house: 9, twoStory: 13};
// Camera jolt for a hit (flight-camera.js), and how far off a friend's hit is
// still heard (units)
const SHAKE = {tree: 1.2, house: 3, snowman: 0.6};
const HEAR_RANGE = 900;
// How far past its chunk's edge a prop may stand (units)
const CHUNK_SPILL = 150;
// Higher than this above the ground (units), no prop reaches
const HIGH_ABOVE_GROUND = 250;
// Time after spawning or a teleport before hits count (s)
const SETTLE = 1.5;

const LEAF_PUFF = new THREE.Color();
const SNOW = new THREE.Color(0.96, 0.97, 1);
const DUST = new THREE.Color(0.8, 0.75, 0.66);
const _dust = new THREE.Color();
const _m = new THREE.Matrix4();
const _m0 = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _box = new THREE.Box3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

const rubbleGeo = new THREE.BoxGeometry(1, 1, 1);

// Wrecks this session, by chunk key then prop index: {x, z, pieces:
// [{type, m, color}]}, m being the piece's matrix where it lies
const wrecks = new Map();
// Copies being drawn: per model type {mesh, pieces, dirty}
const pools = new Map();
// Pieces falling this frame
const moving = new Set();
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
  return globalInstancer.types.get(type);
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
function addPiece(type, m, color, group) {
  const p = pool(type);
  const piece = {type, m, color, group, slot: p.pieces.length};
  p.pieces.push(piece);
  p.dirty = true;
  fresh?.push(piece);
  return piece;
}

function removePiece(piece) {
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
      const info = typeInfo(p.type);
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

// A chunk's props as upright cylinders, in a grid, built the first time
// something comes near: {x, z, radius, base, top, broken, cells, maxTop}
function chunkIndex(group) {
  const ud = group.userData;
  if (ud.breakIndex) return ud.breakIndex;
  const b = ud.breakables;
  const data = ud.instanceData;
  if (!b || !data) return null;
  const n = b.kinds.length;
  const index = {
    x: new Float32Array(n),
    z: new Float32Array(n),
    radius: new Float32Array(n),
    base: new Float32Array(n),
    top: new Float32Array(n),
    broken: ud.breakBroken || new Set(),
    cells: new Map(),
    maxTop: -Infinity,
  };
  for (let i = 0; i < n; i++) {
    const start = b.propStarts[i];
    const end = b.propStarts[i + 1];
    if (end === start || index.broken.has(i)) continue;
    const first = data[b.types[b.partTypes[start]]];
    const fo = b.partIndices[start] * 16;
    const x = first.matrices[fo + 12];
    const z = first.matrices[fo + 14];
    let reach = 0;
    let base = Infinity;
    let top = -Infinity;
    for (let j = start; j < end; j++) {
      const type = b.types[b.partTypes[j]];
      const box = partBox(type, data[type].matrices, b.partIndices[j] * 16);
      reach = Math.max(
        reach,
        Math.abs(box.min.x - x),
        Math.abs(box.max.x - x),
        Math.abs(box.min.z - z),
        Math.abs(box.max.z - z)
      );
      base = Math.min(base, box.min.y);
      top = Math.max(top, box.max.y);
    }
    const radius =
      reach *
      (b.kinds[i] === BREAKABLE.HOUSE ? BREAK.HOUSE_REACH : BREAK.TREE_REACH);
    index.x[i] = x;
    index.z[i] = z;
    index.radius[i] = radius;
    index.base[i] = base;
    index.top[i] = top;
    index.maxTop = Math.max(index.maxTop, top);
    const x0 = Math.floor((x - radius) / CELL);
    const x1 = Math.floor((x + radius) / CELL);
    const z0 = Math.floor((z - radius) / CELL);
    const z1 = Math.floor((z + radius) / CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gz = z0; gz <= z1; gz++) {
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

// The parts of prop i in a chunk: [{type, data, index}]
function propParts(group, i) {
  const {breakables: b, instanceData: data} = group.userData;
  const parts = [];
  for (let j = b.propStarts[i]; j < b.propStarts[i + 1]; j++) {
    const type = b.types[b.partTypes[j]];
    parts.push({type, data: data[type], index: b.partIndices[j]});
  }
  return parts;
}

function copyMatrix(part) {
  const o = part.index * 16;
  return part.data.matrices.slice(o, o + 16);
}

function copyColor(part) {
  if (!typeInfo(part.type)?.useColor) return null;
  const o = part.index * 3;
  return part.data.colors.slice(o, o + 3);
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
  for (const part of parts) {
    const m0 = copyMatrix(part);
    const piece = addPiece(part.type, m0.slice(), copyColor(part), group);
    piece.m0 = m0;
    piece.anim = anim;
    anim.pieces.push(piece);
    moving.add(piece);
  }
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

// A house folds down and leans along (dx, dz); its roof and chimney are
// thrown off along with blocks of wall and roof, in a cloud of dust
function collapse(group, parts, x, base, z, top, dx, dz, kts) {
  const fwd = Math.min(FLING_MAX, kts * 0.12);
  const axis = new THREE.Vector3(dz, 0, -dx);
  const twoStory = parts[0].type.startsWith('twoStory');
  let bodyColor = null;
  let roofColor = null;
  for (const part of parts) {
    if (part.type.endsWith('Body')) {
      bodyColor = copyColor(part);
      const m0 = copyMatrix(part);
      const piece = addPiece(part.type, m0.slice(), bodyColor, group);
      piece.m0 = m0;
      piece.anim = {
        kind: 'fold',
        pivot: new THREE.Vector3(x, base, z),
        axis,
        t: 0,
        done: false,
      };
      moving.add(piece);
    } else if (part.type.endsWith('Roof') || part.type.endsWith('Chimney')) {
      const color = copyColor(part);
      if (color) roofColor = color;
      const m = copyMatrix(part);
      const box = partBox(part.type, m, 0);
      const piece = addPiece(part.type, m, color, group);
      const roof = part.type.endsWith('Roof');
      fling(
        piece,
        (box.min.x + box.max.x) / 2,
        (box.min.y + box.max.y) / 2,
        (box.min.z + box.max.z) / 2,
        dx * fwd * rand(0.4, 0.8) + rand(-3, 3),
        rand(2, 6),
        dz * fwd * rand(0.4, 0.8) + rand(-3, 3),
        roof
          ? axis
          : new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(),
        roof ? rand(0.6, 1.2) : rand(3, 6),
        base + (roof ? 2.5 : 1)
      );
    }
    // Doors and windows are hidden with the rest and not redrawn
  }
  const count = twoStory ? RUBBLE.twoStory : RUBBLE.house;
  const height = top - base;
  for (let i = 0; i < count; i++) {
    const size = rand(0.8, 1.8);
    const color = (i % 3 === 2 ? roofColor : bodyColor) || bodyColor;
    const px = x + rand(-4, 4);
    const py = base + rand(0.3, 0.8) * height;
    const pz = z + rand(-4, 4);
    _m.compose(
      _p.set(px, py, pz),
      _q.setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)),
      _s.set(size, size * rand(0.5, 1), size)
    );
    const piece = addPiece(
      'rubble',
      _m.toArray(new Float32Array(16)),
      color,
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
      rand(4, 12),
      dz * fwd * rand(0.6, 1.1) + (oz / len) * out,
      new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
      rand(2, 6),
      getElevation(px, pz) + size * 0.3
    );
  }
}

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
  const kind = group.userData.breakables.kinds[i];
  const parts = propParts(group, i);
  const x = index.x[i];
  const z = index.z[i];
  const base = index.base[i];
  const top = index.top[i];
  const house = kind === BREAKABLE.HOUSE;
  const snowman = kind === BREAKABLE.SNOWMAN;

  fresh = [];
  if (house) {
    collapse(group, parts, x, base, z, top, dx, dz, kts);
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
  for (const part of parts) hideInstance(part.data, part.index);
  if (house) hideChimneySmoke(group, x, z);
  const wreck = {x, z, pieces: fresh};
  fresh = null;
  const key = chunkKey(group.userData.chunkX, group.userData.chunkZ);
  if (!wrecks.has(key)) wrecks.set(key, new Map());
  wrecks.get(key).set(i, wreck);

  // Dust, leaves or snow
  const height = top - base;
  const dust = sampleGroundColor(x, z, _dust) ? _dust.lerp(DUST, 0.5) : DUST;
  if (house) {
    propPuffs(x, base, z, 8, height * 0.6, dust, 40, 9, 5);
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

  const what = house ? 'house' : snowman ? 'snowman' : 'tree';
  const fallTime = house ? 0 : 1.1 - Math.min(0.6, kts / 400);
  if (mine) {
    const keep = speedKept(what, buggy);
    if (buggy) slowBuggy(keep);
    else state.flightSpeedMultiplier *= keep;
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

function countPieces() {
  let n = 0;
  for (const p of pools.values()) n += p.pieces.length;
  return n;
}

// --- HITS ---

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

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
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const group = chunks.get(`${cx},${cz}`);
      if (!group?.userData.breakables) continue;
      const index = chunkIndex(group);
      if (!index || minY > index.maxTop) continue;
      for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++) {
        for (
          let gz = Math.floor(z0 / CELL);
          gz <= Math.floor(z1 / CELL);
          gz++
        ) {
          const cell = index.cells.get(gx * 100003 + gz);
          if (!cell) continue;
          for (const i of cell) {
            if (index.broken.has(i)) continue;
            if (
              sweptHit(
                a,
                b,
                r,
                index.x[i],
                index.z[i],
                index.radius[i],
                index.base[i],
                index.top[i]
              )
            ) {
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
    } else if (anim.kind === 'fold') {
      anim.t = Math.min(1, anim.t + delta / COLLAPSE_TIME);
      const e = 1 - (1 - anim.t) * (1 - anim.t);
      _r.makeRotationAxis(_axis.copy(anim.axis).normalize(), COLLAPSE_LEAN * e);
      _r.multiply(_t.makeScale(1, 1 - (1 - COLLAPSE_HEIGHT) * e, 1));
      if (anim.t >= 1) anim.done = true;
    } else {
      stepFlying(anim, delta, GRAVITY);
      _m.makeTranslation(anim.x, anim.y, anim.z);
      _m.multiply(_r.makeRotationAxis(anim.axis, anim.angle));
      _m.multiply(_t.makeTranslation(-anim.from.x, -anim.from.y, -anim.from.z));
      _m.multiply(_m0.fromArray(piece.m0));
      _m.toArray(piece.m);
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
    if (anim.done) moving.delete(piece);
  }
}

// Shows the wrecks of chunks loaded again, and drops the pieces of chunks
// unloaded
function syncChunks() {
  for (const group of chunks.values()) {
    const ud = group.userData;
    if (ud.breakSynced || !ud.breakables || !ud.instanceData) continue;
    ud.breakSynced = true;
    const list = wrecks.get(chunkKey(ud.chunkX, ud.chunkZ));
    if (!list) continue;
    ud.breakBroken = new Set();
    for (const [i, wreck] of list) {
      if (i >= ud.breakables.kinds.length) continue;
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
      for (const part of parts) hideInstance(part.data, part.index);
      const kind = ud.breakables.kinds[i];
      if (kind === BREAKABLE.HOUSE) hideChimneySmoke(group, wreck.x, wreck.z);
      wreck.pieces = wreck.pieces.map((old) =>
        addPiece(old.type, old.m, old.color, group)
      );
    }
  }
  // Pieces of chunks no longer loaded
  if (--sweepTimer > 0) return;
  sweepTimer = 30;
  for (const p of pools.values()) {
    for (let i = p.pieces.length - 1; i >= 0; i--) {
      const piece = p.pieces[i];
      const {chunkX, chunkZ} = piece.group.userData;
      if (chunks.get(`${chunkX},${chunkZ}`) !== piece.group) removePiece(piece);
    }
  }
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
