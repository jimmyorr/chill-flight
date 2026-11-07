// --- SWAMP MODELS ---
// Vegetation and backwater props for the southern bayou / swamp biome
// (placed in terrain-gen.js, drawn by terrain-chunks.js): low-poly models
// built here from a few primitives, and the one giant dead oak landmark from
// Polyfork (polyfork.dev, free licence; source unchanged in
// third-party/polyfork), merged into one vertex-coloured geometry via
// mergeAsset from boat-models.js.
import * as THREE from 'three';
import * as deadOak from './third-party/polyfork/twisted-dead-oak-49457b.mjs';
import {mergeAsset} from './boat-models.js';

// Extra-large twisted dead oak landmark in the swamp (~272 units tall,
// comparable to the 270-unit peak height of the rock arch).
const GIANT_SWAMP_OAK_SCALE = 39;

const SPANISH_MOSS = '#9aa08a';

// Strands of Spanish moss hanging under `count` of the model's triangles
// that `pick` (picked evenly, upper part of the tree only): two crossed
// triangles each way, so 4 triangles a strand
function hangMoss(
  geo,
  count,
  length,
  width,
  pick,
  from = 0.35,
  color = SPANISH_MOSS
) {
  const p = geo.attributes.position;
  const c = geo.attributes.color;
  geo.computeBoundingBox();
  const minY =
    geo.boundingBox.min.y +
    (geo.boundingBox.max.y - geo.boundingBox.min.y) * from;
  const spots = [];
  for (let t = 0; t < p.count; t += 3) {
    if (!pick(c, t, p)) continue;
    const y = Math.min(p.getY(t), p.getY(t + 1), p.getY(t + 2));
    if (y < minY) continue;
    spots.push([
      (p.getX(t) + p.getX(t + 1) + p.getX(t + 2)) / 3,
      y,
      (p.getZ(t) + p.getZ(t + 1) + p.getZ(t + 2)) / 3,
    ]);
  }
  const moss = new THREE.Color(color);
  const pos = [...p.array];
  const col = [...c.array];
  const step = Math.max(1, Math.floor(spots.length / count));
  for (let i = 0, n = 0; i < spots.length && n < count; i += step, n++) {
    const [x, y, z] = spots[i];
    const len = length * (0.7 + 0.6 * ((n * 0.618) % 1));
    for (const [dx, dz] of [
      [width, 0],
      [0, width],
    ]) {
      // Both windings, so it shows from either side
      pos.push(x - dx, y, z - dz, x + dx, y, z + dz, x, y - len, z);
      pos.push(x + dx, y, z + dz, x - dx, y, z - dz, x, y - len, z);
      for (let k = 0; k < 6; k++) col.push(moss.r, moss.g, moss.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

// The giant oak's limbs, out from the trunk, for its moss streamers
const GHOST_OAK_BARK = '#a8a59c';
const GHOST_OAK_STRANDS = 56;
// Greener than the bark, so the streamers read as moss, not more wood
const GHOST_OAK_MOSS = '#77845c';
const oakLimb = (c, t, p) =>
  Math.hypot(p.getX(t), p.getZ(t)) > 55 && c.getX(t) > 0.3;

// --- LOW-POLY SWAMP PROPS ---
// Built from a few flat-shaded primitives in the world's own style, about
// 10-100 triangles each: the Polyfork swamp models were 400-930 apiece, and
// the swamp has hundreds in view, which was too much for phones.

// Adds `src` (any primitive), placed by position/rotation/scale, to the
// parts list as flat triangles of one colour
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
function part(
  parts,
  src,
  hex,
  [x, y, z],
  [sx, sy, sz] = [1, 1, 1],
  rot = [0, 0, 0]
) {
  const g = src.index ? src.toNonIndexed() : src.clone();
  _m.compose(
    new THREE.Vector3(x, y, z),
    _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])),
    new THREE.Vector3(sx, sy, sz)
  );
  g.applyMatrix4(_m);
  parts.push([g, new THREE.Color(hex)]);
}

// The parts as one non-indexed vertex-coloured geometry (like mergeAsset's)
function joinParts(parts) {
  const pos = [];
  const col = [];
  for (const [g, c] of parts) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

// Open-ended tapered prism (no caps): sides * 2 triangles
const prism = (sides, top, bottom) =>
  new THREE.CylinderGeometry(top, bottom, 1, sides, 1, true).translate(
    0,
    0.5,
    0
  );
const blob = new THREE.IcosahedronGeometry(1, 0); // 20 triangles
const pad = new THREE.CylinderGeometry(1, 1, 1, 6, 1, false); // 24, flat top

// A moss strand: a thin hanging blade, both windings (4 triangles)
function strand(parts, x, y, z, len, w, hex, turn) {
  const c = Math.cos(turn) * w;
  const s = Math.sin(turn) * w;
  const g = new THREE.BufferGeometry();
  // prettier-ignore
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    x - c, y, z - s, x + c, y, z + s, x, y - len, z,
    x + c, y, z + s, x - c, y, z - s, x, y - len, z,
    x - s, y, z + c, x + s, y, z - c, x, y - len, z,
    x + s, y, z - c, x - s, y, z + c, x, y - len, z,
  ], 3));
  parts.push([g, new THREE.Color(hex)]);
}

// Bald cypress: flared buttress, tall straight trunk, flat-topped tiers of
// foliage and Spanish moss under them (~110 triangles)
function lowCypress(foliage, bark, moss, strands) {
  const parts = [];
  part(parts, prism(6, 0.9, 2.6), bark, [0, -0.5, 0], [1, 5, 1]);
  part(parts, prism(5, 0.45, 0.9), bark, [0, 4.4, 0], [1, 24, 1]);
  const tiers = [
    [0, 16.5, 0, 10, 2.4],
    [3, 21.5, -2, 8, 2.2],
    [-2.5, 25.5, 2, 6.5, 2],
    [0.5, 29, 0, 4, 1.6],
  ];
  for (const [x, y, z, r, h] of tiers) {
    part(parts, pad, foliage, [x, y, z], [r, h, r * 0.85], [0, x * 0.4, 0]);
  }
  for (let i = 0; i < strands; i++) {
    const [x, y, z, r] = tiers[i % 3];
    const a = i * 2.4;
    strand(
      parts,
      x + Math.cos(a) * r * 0.75,
      y - 0.8,
      z + Math.sin(a) * r * 0.65,
      4 + (i % 3) * 1.5,
      0.7,
      moss,
      a
    );
  }
  return joinParts(parts);
}

// Leaning tupelo / water oak: trunk and three rounded crowns (~70)
function lowTupelo() {
  const parts = [];
  part(
    parts,
    prism(5, 0.6, 1.5),
    '#595043',
    [0, -0.5, 0],
    [1, 17, 1],
    [0, 0, 0.12]
  );
  part(parts, blob, '#445931', [-1.8, 19, 0], [8, 6, 7]);
  part(parts, blob, '#4a6136', [4, 22, 2], [6.5, 5, 6]);
  part(parts, blob, '#3f542d', [0, 25, -2.5], [5.5, 4.5, 5]);
  return joinParts(parts);
}

// Gnarled bare dead oak: squat trunk and crooked limbs (~50)
function lowDeadOak() {
  const parts = [];
  const bark = '#776a68';
  part(parts, prism(5, 1.2, 2.4), bark, [0, -0.5, 0], [1, 11, 1]);
  for (const [a, tilt, len, w] of [
    [0, 1.0, 15, 0.9],
    [2.1, 0.8, 13, 0.8],
    [4.0, 1.1, 14, 0.8],
    [5.3, 0.4, 11, 0.7],
  ]) {
    part(
      parts,
      prism(4, w * 0.3, w),
      bark,
      [0, 9.5, 0],
      [1, len, 1],
      [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt]
    );
  }
  return joinParts(parts);
}

// Standing dead snag: a tall bare pole with broken stubs (~30)
function lowSnag() {
  const parts = [];
  part(parts, prism(5, 0.25, 1.1), '#6f6a62', [0, -0.5, 0], [1, 27, 1]);
  part(
    parts,
    prism(4, 0.1, 0.35),
    '#5e5448',
    [0, 15, 0],
    [1, 4, 1],
    [0, 0, 1.1]
  );
  part(
    parts,
    prism(4, 0.1, 0.3),
    '#5e5448',
    [0, 20, 0],
    [1, 3, 1],
    [0.9, 0, -0.4]
  );
  return joinParts(parts);
}

// Reeds: a fan of thin blades (~16)
function lowReeds(blade, head) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    strand(
      parts,
      Math.cos(a) * 0.5,
      0,
      Math.sin(a) * 0.5,
      -7 - (i % 2),
      0.35,
      blade,
      a
    );
  }
  if (head) {
    part(parts, prism(4, 0.3, 0.3), head, [0.3, 5.5, 0.2], [1, 1.8, 1]);
    part(parts, prism(4, 0.3, 0.3), head, [-0.4, 6.2, -0.3], [1, 1.8, 1]);
  }
  return joinParts(parts);
}

// Lily pads: a few flat discs on the water (~18)
function lowLilyPads() {
  const parts = [];
  const disc = new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2);
  for (const [x, z, r, hex] of [
    [0, 0, 1.6, '#4f7a3a'],
    [2.6, 1.2, 1.2, '#5a8240'],
    [-1.8, 1.9, 1.1, '#46703a'],
    [1.2, -2.2, 1.3, '#557d3d'],
  ]) {
    part(parts, disc, hex, [x, 0.05, z], [r, 1, r]);
  }
  part(parts, blob, '#e5d5c4', [0.4, 0.3, 0.2], [0.45, 0.3, 0.45]);
  return joinParts(parts);
}

// Fallen mossy log lying along z (~30)
function lowLog() {
  const parts = [];
  part(
    parts,
    prism(6, 1.1, 1.3),
    '#5a4632',
    [0, 0, -6.5],
    [1, 13, 1],
    [Math.PI / 2, 0, 0]
  );
  part(parts, blob, '#5c6a2e', [0, 1.1, 1], [1.2, 0.4, 3]);
  return joinParts(parts);
}

// Mossy stump with a moss cap (~20)
function lowStump() {
  const parts = [];
  part(parts, prism(6, 1.0, 1.5), '#5e4431', [0, -0.3, 0], [1, 3.2, 1]);
  part(
    parts,
    new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2),
    '#5c6a2e',
    [0, 2.9, 0]
  );
  return joinParts(parts);
}

export function buildSwampGeos() {
  return {
    swampCypress: lowCypress('#4d6330', '#634835', SPANISH_MOSS, 4),
    swampCypressMoss: lowCypress('#6d7a50', '#543f30', SPANISH_MOSS, 8),
    swampTupelo: lowTupelo(),
    swampDeadOak: lowDeadOak(),
    // A bleached silver-grey "ghost oak", long moss streamers off its limbs
    swampGiantOak: hangMoss(
      mergeAsset(
        deadOak.createAsset({
          colorway: 'moonlit-silver',
          bark: GHOST_OAK_BARK,
          gnarl: 0.9,
          spread: 1.2,
          knothole: true,
          roots: 7,
        }),
        0.12,
        GIANT_SWAMP_OAK_SCALE
      ),
      GHOST_OAK_STRANDS,
      52,
      4,
      oakLimb,
      0.3,
      GHOST_OAK_MOSS
    ),
    swampSnag: lowSnag(),
    swampReeds: lowReeds('#6b7a3a', null),
    swampCattails: lowReeds('#5f7a3c', '#75563b'),
    swampLilyPads: lowLilyPads(),
    swampLog: lowLog(),
    swampStump: lowStump(),
  };
}

// Low-triangle vertex-coloured proxy fitted to `geo`'s bounding box for
// distant swamp trees beyond canopyDetailRadius().
export function createSwampFarCanopy(geo, canopyHex, barkHex = '#5c4633') {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const raw = new THREE.IcosahedronGeometry(1, 0);
  const nonIdx = raw.index ? raw.toNonIndexed() : raw;
  nonIdx.scale(half.x * 0.85, half.y * 0.9, half.z * 0.85);
  nonIdx.translate(center.x, center.y, center.z);
  nonIdx.computeVertexNormals();
  nonIdx.computeBoundingSphere();

  const p = nonIdx.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cTop = new THREE.Color(canopyHex);
  const cBot = new THREE.Color(barkHex);
  const splitY = box.min.y + (box.max.y - box.min.y) * 0.3;
  for (let i = 0; i < p.count; i++) {
    const c = p.getY(i) < splitY ? cBot : cTop;
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  nonIdx.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return nonIdx;
}
