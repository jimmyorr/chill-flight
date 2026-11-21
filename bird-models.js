// --- BIRD 3D MODELS ---
// Sculpted low-poly, vertex-colored bird models for all eight Chill Flight
// archetypes: goose, hawk, seagull, heron (Great Blue & White Egret morphs),
// pelican, swallow, raven, and albatross.
//
// Performance design:
// - Every bird rig has 3 geometries (static body + right wing + X-mirrored left
//   wing) sharing ONE single `birdVertexColorMat` across all species, adding
//   zero custom shader compilations at startup.
// - At runtime (`birds.js`), all active birds across all loaded chunks render
//   through a global `InstancedMesh` pool (~12-24 draw calls total instead of
//   hundreds of individual per-bird `THREE.Mesh` calls and `Object3D` nodes).
// - Left wings use true X-mirrored geometry (`mirrorGeometryX`) rather than Y
//   180-deg rotation so backward sweep, gull-wing wrist bends, and camber match
//   symmetrically on both sides (`wingR` flaps `+flap`, `wingL` flaps `-flap`).
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createMaterial} from './constants.js';

export const birdVertexColorMat = createMaterial({
  color: 0xffffff,
  vertexColors: true,
  flatShading: true,
  roughness: 0.78,
});

function paintGeo(geo, hex) {
  const out = geo.index ? geo.toNonIndexed() : geo.clone();
  out.deleteAttribute('uv');
  const count = out.attributes.position.count;
  const col = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.computeVertexNormals();
  return out;
}

function cBox(w, h, d, x, y, z, hex, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return paintGeo(g, hex);
}

function cCone(r, len, segs, x, y, z, hex, rx = -Math.PI / 2, ry = 0, rz = 0) {
  const g = new THREE.ConeGeometry(r, len, segs);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return paintGeo(g, hex);
}

function cCyl(rTop, rBot, len, segs, x, y, z, hex, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return paintGeo(g, hex);
}

// Watertight 6-face tapered airfoil wing panel spanning x = x0..x1 (+X right wing).
// Leading edge sits at zLead0..zLead1 (negative Z = forward), trailing edge at
// zTrail0..zTrail1 (+Z = aft), vertical camber/gull-bend at y0..y1.
function wingPanel({
  x0,
  x1,
  zLead0,
  zTrail0,
  zLead1,
  zTrail1,
  y0 = 0,
  y1 = 0,
  t0 = 0.12,
  t1 = 0.06,
  hex,
}) {
  const ht0 = t0 * 0.5;
  const ht1 = t1 * 0.5;
  // 8 corners: root (0..3: TL, BL, BT, TT) and tip (4..7: TL, BL, BT, TT)
  const p = [
    [x0, y0 + ht0, zLead0], // 0 root top-lead
    [x0, y0 - ht0 * 0.6, zLead0], // 1 root bot-lead
    [x0, y0 - ht0 * 0.5, zTrail0], // 2 root bot-trail
    [x0, y0 + ht0 * 0.4, zTrail0], // 3 root top-trail
    [x1, y1 + ht1, zLead1], // 4 tip top-lead
    [x1, y1 - ht1 * 0.6, zLead1], // 5 tip bot-lead
    [x1, y1 - ht1 * 0.5, zTrail1], // 6 tip bot-trail
    [x1, y1 + ht1 * 0.4, zTrail1], // 7 tip top-trail
  ];
  const quads = [
    [0, 3, 7, 4], // top surface (+Y)
    [1, 5, 6, 2], // bottom surface (-Y)
    [0, 4, 5, 1], // leading edge (-Z)
    [3, 2, 6, 7], // trailing edge (+Z)
    [4, 7, 6, 5], // wingtip cap (+X)
    [0, 1, 2, 3], // root cap (-X)
  ];
  const pos = [];
  for (const [a, b, c, d] of quads) {
    pos.push(...p[a], ...p[b], ...p[c], ...p[a], ...p[c], ...p[d]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return paintGeo(geo, hex);
}

// Mirrors a right-wing geometry across X = 0 while preserving outward triangle winding
function mirrorGeometryX(geo) {
  const out = geo.clone();
  const pos = out.attributes.position.array;
  const col = out.attributes.color.array;
  for (let i = 0; i < pos.length; i += 9) {
    pos[i] = -pos[i];
    pos[i + 3] = -pos[i + 3];
    pos[i + 6] = -pos[i + 6];
    // Swap vertex 1 and vertex 2 to keep counter-clockwise outward normals
    for (let k = 0; k < 3; k++) {
      const tmpP = pos[i + 3 + k];
      pos[i + 3 + k] = pos[i + 6 + k];
      pos[i + 6 + k] = tmpP;
      const tmpC = col[i + 3 + k];
      col[i + 3 + k] = col[i + 6 + k];
      col[i + 6 + k] = tmpC;
    }
  }
  out.computeVertexNormals();
  return out;
}

function finishBirdRig(bodyParts, wingRParts) {
  const bodyGeo = mergeGeometries(bodyParts);
  const wingRGeo = mergeGeometries(wingRParts);
  const wingLGeo = mirrorGeometryX(wingRGeo);
  return {bodyGeo, wingRGeo, wingLGeo};
}

// --- 1. CANADA GOOSE ---
function buildGooseRig() {
  const body = [
    cBox(1.15, 0.88, 3.2, 0, 0, 0, 0x8b7355),
    cBox(1.02, 0.55, 1.8, 0, -0.28, 0.3, 0xa89478),
    // Outstretched black neck, head, white cheek strap, and bill
    cCyl(0.24, 0.34, 2.3, 6, 0, 0.42, -2.35, 0x222428, Math.PI / 2 - 0.14),
    cBox(0.56, 0.56, 1.08, 0, 0.62, -3.75, 0x222428),
    cBox(0.6, 0.28, 0.46, 0, 0.52, -3.72, 0xf8fafc),
    cCone(0.19, 0.72, 4, 0, 0.58, -4.55, 0x2a2d32),
    // White upper-tail coverts + black wedge tail
    cBox(0.96, 0.46, 0.95, 0, -0.05, 1.65, 0xf8fafc),
    cBox(0.78, 0.26, 1.15, 0, 0.12, 2.15, 0x222428),
  ];
  const wingR = [
    wingPanel({
      x0: 0.45,
      x1: 3.1,
      zLead0: -0.95,
      zTrail0: 1.05,
      zLead1: -0.55,
      zTrail1: 1.15,
      y0: 0.12,
      y1: 0.22,
      t0: 0.16,
      t1: 0.1,
      hex: 0x8b7355,
    }),
    wingPanel({
      x0: 3.1,
      x1: 5.9,
      zLead0: -0.55,
      zTrail0: 1.15,
      zLead1: 0.35,
      zTrail1: 1.35,
      y0: 0.22,
      y1: 0.08,
      t0: 0.1,
      t1: 0.05,
      hex: 0x3b332b,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 2. RED-TAILED HAWK ---
function buildHawkRig() {
  const body = [
    cBox(1.22, 0.82, 3.1, 0, 0, -0.1, 0x4e3118),
    cBox(1.16, 0.28, 2.5, 0, -0.36, -0.15, 0xdfd0b8),
    cBox(0.82, 0.76, 1.02, 0, 0.22, -1.92, 0x432914),
    // Hooked golden cere & raptor beak
    cCone(0.26, 0.62, 4, 0, 0.12, -2.68, 0xf5c542, -Math.PI / 2 - 0.18),
    // Fanned brick-red tail (3 splayed panels)
    cBox(0.72, 0.14, 1.75, 0, 0.04, 2.15, 0xa84228),
    cBox(0.62, 0.13, 1.68, -0.45, 0.04, 2.12, 0xa84228, 0, 0.24, 0),
    cBox(0.62, 0.13, 1.68, 0.45, 0.04, 2.12, 0xa84228, 0, -0.24, 0),
  ];
  const wingR = [
    // Broad inner soaring arm
    wingPanel({
      x0: 0.5,
      x1: 3.0,
      zLead0: -0.95,
      zTrail0: 1.25,
      zLead1: -0.75,
      zTrail1: 1.35,
      y0: 0.1,
      y1: 0.24,
      t0: 0.16,
      t1: 0.11,
      hex: 0x57371b,
    }),
    // Outer slotted primary panel
    wingPanel({
      x0: 3.0,
      x1: 5.35,
      zLead0: -0.75,
      zTrail0: 1.35,
      zLead1: -0.15,
      zTrail1: 1.25,
      y0: 0.24,
      y1: 0.34,
      t0: 0.11,
      t1: 0.05,
      hex: 0x332010,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 3. COASTAL SEAGULL ---
function buildSeagullRig() {
  const body = [
    cBox(0.96, 0.72, 2.85, 0, 0, 0, 0xf8fafc),
    cBox(0.92, 0.22, 1.85, 0, 0.32, -0.1, 0xcbd5e1), // pale grey mantle
    cBox(0.68, 0.68, 0.92, 0, 0.28, -1.72, 0xf8fafc),
    cCone(0.18, 0.68, 4, 0, 0.2, -2.48, 0xfbbf24),
    cBox(1.12, 0.16, 1.22, 0, 0.04, 1.82, 0xf8fafc),
  ];
  // Classic M-gull wing bend: inner arm rises to wrist, outer hand angles back
  const wingR = [
    wingPanel({
      x0: 0.42,
      x1: 2.55,
      zLead0: -0.78,
      zTrail0: 0.85,
      zLead1: -0.62,
      zTrail1: 0.82,
      y0: 0.14,
      y1: 0.42,
      t0: 0.13,
      t1: 0.09,
      hex: 0xcbd5e1,
    }),
    wingPanel({
      x0: 2.55,
      x1: 3.95,
      zLead0: -0.62,
      zTrail0: 0.82,
      zLead1: 0.05,
      zTrail1: 1.02,
      y0: 0.42,
      y1: 0.24,
      t0: 0.09,
      t1: 0.06,
      hex: 0xcbd5e1,
    }),
    wingPanel({
      x0: 3.95,
      x1: 5.05,
      zLead0: 0.05,
      zTrail0: 1.02,
      zLead1: 0.65,
      zTrail1: 1.15,
      y0: 0.24,
      y1: 0.08,
      t0: 0.06,
      t1: 0.04,
      hex: 0x1e293b,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 4. GREAT BLUE HERON & GREAT WHITE EGRET ---
function buildHeronRig(isEgret = false) {
  const bodyHex = isEgret ? 0xf8fafc : 0x64748b;
  const neckHex = isEgret ? 0xf8fafc : 0x94a3b8;
  const primaryHex = isEgret ? 0xeef2f6 : 0x334155;
  const legHex = isEgret ? 0x1e293b : 0x475569;
  const billHex = isEgret ? 0xf59e0b : 0xe2a03f;

  const body = [
    // Slender wading body
    cBox(0.95, 0.78, 2.95, 0, 0, 0, bodyHex),
    // Tucked S-curve neck folded back over shoulders in flight
    cCyl(0.2, 0.26, 1.15, 6, 0, 0.22, -1.55, neckHex, Math.PI / 2 + 0.45),
    cCyl(0.18, 0.21, 0.95, 6, 0, 0.56, -1.42, neckHex, Math.PI / 2 - 0.55),
    cBox(0.52, 0.48, 0.92, 0, 0.74, -1.88, isEgret ? 0xf8fafc : 0xe2e8f0),
    // Long dagger bill pointing level ahead
    cCone(0.15, 1.45, 4, 0, 0.7, -2.98, billHex),
    // Short wedge tail + iconic long trailing stilt legs extending behind!
    cBox(0.76, 0.18, 0.92, 0, 0.05, 1.75, bodyHex),
    cCyl(0.065, 0.055, 3.2, 5, -0.2, -0.14, 2.95, legHex, Math.PI / 2 + 0.04),
    cCyl(0.065, 0.055, 3.2, 5, 0.2, -0.14, 2.95, legHex, Math.PI / 2 + 0.04),
  ];
  if (!isEgret) {
    // Dark slate crown & trailing occipital crest plume on Great Blue Heron
    body.push(cBox(0.54, 0.18, 1.15, 0, 0.96, -1.62, 0x1e293b, -0.12));
  }

  // Broad, deeply arched/cupped wading wings
  const wingR = [
    wingPanel({
      x0: 0.4,
      x1: 3.1,
      zLead0: -0.95,
      zTrail0: 1.25,
      zLead1: -0.65,
      zTrail1: 1.38,
      y0: 0.14,
      y1: 0.36,
      t0: 0.15,
      t1: 0.1,
      hex: bodyHex,
    }),
    wingPanel({
      x0: 3.1,
      x1: 5.85,
      zLead0: -0.65,
      zTrail0: 1.38,
      zLead1: -0.05,
      zTrail1: 1.3,
      y0: 0.36,
      y1: 0.02,
      t0: 0.1,
      t1: 0.05,
      hex: primaryHex,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 5. BROWN PELICAN ---
function buildPelicanRig() {
  const body = [
    // Heavy coastal seabird torso
    cBox(1.28, 0.96, 3.25, 0, 0, 0.05, 0x6b635b),
    cBox(1.12, 0.32, 2.3, 0, -0.42, 0.1, 0x47413c),
    // Tucked white/cream neck & head
    cBox(0.76, 0.78, 1.05, 0, 0.36, -1.68, 0xf1ede4),
    cBox(0.68, 0.68, 0.88, 0, 0.56, -2.18, 0xf8f5ec),
    // Unmistakable long flat pelican upper mandible + deep throat pouch!
    cBox(0.36, 0.18, 1.95, 0, 0.54, -3.45, 0xd99b52, 0.05),
    cBox(0.34, 0.44, 1.72, 0, 0.28, -3.25, 0x4a423d, 0.14),
    // Short broad tail
    cBox(1.04, 0.2, 1.05, 0, 0.08, 2.02, 0x5c554e),
  ];
  const wingR = [
    wingPanel({
      x0: 0.55,
      x1: 3.25,
      zLead0: -0.95,
      zTrail0: 1.15,
      zLead1: -0.65,
      zTrail1: 1.18,
      y0: 0.16,
      y1: 0.38,
      t0: 0.17,
      t1: 0.11,
      hex: 0x787067,
    }),
    wingPanel({
      x0: 3.25,
      x1: 5.95,
      zLead0: -0.65,
      zTrail0: 1.18,
      zLead1: 0.15,
      zTrail1: 1.22,
      y0: 0.38,
      y1: 0.16,
      t0: 0.11,
      t1: 0.05,
      hex: 0x38332f,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 6. BARN SWALLOW ---
function buildSwallowRig() {
  const body = [
    // Sleek cobalt-blue streamlined body + warm rufous throat & buff belly
    cBox(0.82, 0.62, 2.25, 0, 0, -0.1, 0x1e3a5f),
    cBox(0.74, 0.24, 1.65, 0, -0.26, 0.05, 0xd9a982),
    cBox(0.64, 0.58, 0.78, 0, 0.12, -1.42, 0x1e3a5f),
    cBox(0.58, 0.32, 0.58, 0, -0.06, -1.52, 0xc45a36), // cinnamon-red throat
    cCone(0.14, 0.38, 4, 0, 0.08, -1.94, 0x111827),
    // Iconic deeply forked V-streamer swallow tail!
    cBox(0.46, 0.1, 0.75, 0, 0.02, 1.25, 0x172554),
    cBox(0.18, 0.09, 2.05, -0.44, 0.04, 1.92, 0x172554, 0, -0.24, 0),
    cBox(0.18, 0.09, 2.05, 0.44, 0.04, 1.92, 0x172554, 0, 0.24, 0),
  ];
  // Swept-back scimitar crescent wings
  const wingR = [
    wingPanel({
      x0: 0.36,
      x1: 1.75,
      zLead0: -0.72,
      zTrail0: 0.62,
      zLead1: -0.82,
      zTrail1: 0.48,
      y0: 0.08,
      y1: 0.18,
      t0: 0.11,
      t1: 0.08,
      hex: 0x1e3a5f,
    }),
    wingPanel({
      x0: 1.75,
      x1: 4.15,
      zLead0: -0.82,
      zTrail0: 0.48,
      zLead1: 0.85,
      zTrail1: 1.38,
      y0: 0.18,
      y1: 0.04,
      t0: 0.08,
      t1: 0.03,
      hex: 0x172554,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 7. CLIFF RAVEN ---
function buildRavenRig() {
  const body = [
    // Glossy obsidian-indigo body + heavy throat hackles + arched chisel bill
    cBox(1.08, 0.82, 2.98, 0, 0, -0.05, 0x222938),
    cBox(1.02, 0.22, 2.2, 0, 0.34, -0.1, 0x2d384d), // subtle iridescent slate-blue dorsal sheen
    cBox(0.78, 0.74, 1.0, 0, 0.18, -1.82, 0x1c2230),
    cCone(0.25, 0.86, 4, 0, 0.14, -2.64, 0x11151d, -Math.PI / 2 - 0.08),
    // Classic raven diamond/wedge tail (longer center feathers than hawk/crow)
    cBox(0.7, 0.14, 1.82, 0, 0.02, 2.16, 0x1c2230),
    cBox(0.44, 0.12, 1.4, -0.42, 0.02, 1.92, 0x283246, 0, 0.18, 0),
    cBox(0.44, 0.12, 1.4, 0.42, 0.02, 1.92, 0x283246, 0, -0.18, 0),
  ];
  const wingR = [
    wingPanel({
      x0: 0.46,
      x1: 2.85,
      zLead0: -0.88,
      zTrail0: 1.08,
      zLead1: -0.68,
      zTrail1: 1.12,
      y0: 0.1,
      y1: 0.2,
      t0: 0.14,
      t1: 0.09,
      hex: 0x2b364b,
    }),
    wingPanel({
      x0: 2.85,
      x1: 5.15,
      zLead0: -0.68,
      zTrail0: 1.12,
      zLead1: -0.06,
      zTrail1: 1.08,
      y0: 0.2,
      y1: 0.26,
      t0: 0.09,
      t1: 0.04,
      hex: 0x181e2b,
    }),
  ];
  return finishBirdRig(body, wingR);
}

// --- 8. WANDERING ALBATROSS ---
function buildAlbatrossRig() {
  const body = [
    // Torpedo-streamlined white seabird body + rose-ivory hooked tube-nose bill
    cBox(1.08, 0.84, 3.25, 0, 0, 0, 0xf8fafc),
    cBox(0.74, 0.74, 1.05, 0, 0.24, -1.95, 0xf8fafc),
    cCone(0.21, 0.96, 4, 0, 0.18, -2.85, 0xf2b8a2, -Math.PI / 2 - 0.06),
    cBox(0.92, 0.18, 1.12, 0, 0.04, 1.98, 0x262b34),
  ];
  // Extra-long, ultra-narrow high-aspect-ratio sabre wings (~15.4 span before scale!)
  const wingR = [
    wingPanel({
      x0: 0.48,
      x1: 3.7,
      zLead0: -0.72,
      zTrail0: 0.72,
      zLead1: -0.52,
      zTrail1: 0.62,
      y0: 0.14,
      y1: 0.26,
      t0: 0.14,
      t1: 0.09,
      hex: 0xf1f5f9,
    }),
    wingPanel({
      x0: 3.7,
      x1: 7.75,
      zLead0: -0.52,
      zTrail0: 0.62,
      zLead1: 0.32,
      zTrail1: 0.88,
      y0: 0.26,
      y1: 0.04,
      t0: 0.09,
      t1: 0.035,
      hex: 0x262b34,
    }),
  ];
  return finishBirdRig(body, wingR);
}

const RIGS = {
  goose: buildGooseRig(),
  hawk: buildHawkRig(),
  seagull: buildSeagullRig(),
  heron: buildHeronRig(false),
  egret: buildHeronRig(true),
  pelican: buildPelicanRig(),
  swallow: buildSwallowRig(),
  raven: buildRavenRig(),
  albatross: buildAlbatrossRig(),
};

export const BIRD_RIG_KEYS = [
  'goose',
  'hawk',
  'seagull',
  'heron',
  'egret',
  'pelican',
  'swallow',
  'raven',
  'albatross',
];

export const BIRD_RIG_LIST = BIRD_RIG_KEYS.map((k) => RIGS[k]);

const RIG_INDEX = {
  goose: 0,
  hawk: 1,
  seagull: 2,
  heron: 3,
  egret: 4,
  pelican: 5,
  swallow: 6,
  raven: 7,
  albatross: 8,
};

export function getBirdRigIndex(type, variant = 0) {
  if (type === 'heron' && variant === 1) return RIG_INDEX.egret;
  return RIG_INDEX[type] ?? RIG_INDEX.seagull;
}

export function getBirdRig(type, variant = 0) {
  if (type === 'heron' && variant === 1) return RIGS.egret;
  return RIGS[type] || RIGS.seagull;
}

// Writes column-major 4x4 world matrices for a bird's body, right wing (+flap),
// and left wing (-flap) directly into InstancedMesh Float32Arrays.
// Matches Three.js `Euler(pitch, yaw, bank, 'YXZ')` + uniform `scale` + child
// `wing.rotation.z = +/-flap` (`R_y(yaw) * R_x(pitch) * R_z(bank +/- flap) * s`).
export function writeBirdMatrices(
  bodyArr,
  wingRArr,
  wingLArr,
  instIdx,
  px,
  py,
  pz,
  pitch,
  yaw,
  bank,
  flap,
  scale
) {
  const a = Math.cos(pitch);
  const b = Math.sin(pitch);
  const c = Math.cos(yaw);
  const d = Math.sin(yaw);

  // Basis columns of A = scale * R_y(yaw) * R_x(pitch)
  const ux = scale * c;
  const uz = -scale * d;
  const vx = scale * d * b;
  const vy = scale * a;
  const vz = scale * c * b;
  const wx = scale * d * a;
  const wy = -scale * b;
  const wz = scale * c * a;

  const o = instIdx * 16;

  // 1. Body: A * R_z(bank)
  const cb = Math.cos(bank);
  const sb = Math.sin(bank);
  bodyArr[o] = ux * cb + vx * sb;
  bodyArr[o + 1] = vy * sb;
  bodyArr[o + 2] = uz * cb + vz * sb;
  bodyArr[o + 3] = 0;
  bodyArr[o + 4] = -ux * sb + vx * cb;
  bodyArr[o + 5] = vy * cb;
  bodyArr[o + 6] = -uz * sb + vz * cb;
  bodyArr[o + 7] = 0;
  bodyArr[o + 8] = wx;
  bodyArr[o + 9] = wy;
  bodyArr[o + 10] = wz;
  bodyArr[o + 11] = 0;
  bodyArr[o + 12] = px;
  bodyArr[o + 13] = py;
  bodyArr[o + 14] = pz;
  bodyArr[o + 15] = 1;

  // 2. Right wing: A * R_z(bank + flap)
  const cr = Math.cos(bank + flap);
  const sr = Math.sin(bank + flap);
  wingRArr[o] = ux * cr + vx * sr;
  wingRArr[o + 1] = vy * sr;
  wingRArr[o + 2] = uz * cr + vz * sr;
  wingRArr[o + 3] = 0;
  wingRArr[o + 4] = -ux * sr + vx * cr;
  wingRArr[o + 5] = vy * cr;
  wingRArr[o + 6] = -uz * sr + vz * cr;
  wingRArr[o + 7] = 0;
  wingRArr[o + 8] = wx;
  wingRArr[o + 9] = wy;
  wingRArr[o + 10] = wz;
  wingRArr[o + 11] = 0;
  wingRArr[o + 12] = px;
  wingRArr[o + 13] = py;
  wingRArr[o + 14] = pz;
  wingRArr[o + 15] = 1;

  // 3. Left wing: A * R_z(bank - flap)
  const cl = Math.cos(bank - flap);
  const sl = Math.sin(bank - flap);
  wingLArr[o] = ux * cl + vx * sl;
  wingLArr[o + 1] = vy * sl;
  wingLArr[o + 2] = uz * cl + vz * sl;
  wingLArr[o + 3] = 0;
  wingLArr[o + 4] = -ux * sl + vx * cl;
  wingLArr[o + 5] = vy * cl;
  wingLArr[o + 6] = -uz * sl + vz * cl;
  wingLArr[o + 7] = 0;
  wingLArr[o + 8] = wx;
  wingLArr[o + 9] = wy;
  wingLArr[o + 10] = wz;
  wingLArr[o + 11] = 0;
  wingLArr[o + 12] = px;
  wingLArr[o + 13] = py;
  wingLArr[o + 14] = pz;
  wingLArr[o + 15] = 1;
}

export function assembleBird(type, scale = 3.5, variant = 0) {
  const rig = getBirdRig(type, variant);
  const bird = new THREE.Group();
  bird.rotation.order = 'YXZ';

  const body = new THREE.Mesh(rig.bodyGeo, birdVertexColorMat);
  const wingR = new THREE.Mesh(rig.wingRGeo, birdVertexColorMat);
  const wingL = new THREE.Mesh(rig.wingLGeo, birdVertexColorMat);
  body.userData.noShadow = true;
  wingR.userData.noShadow = true;
  wingL.userData.noShadow = true;

  bird.add(body, wingR, wingL);
  bird.scale.setScalar(scale);
  bird.userData.wings = [wingR, wingL];
  return bird;
}

// Prop-part descriptor array for terrain-geometry.js getPropParts / debug-models.html
export function getBirdPropParts(type, rotY = 0) {
  const rig = RIGS[type] || RIGS.seagull;
  return [
    {
      geo: rig.bodyGeo,
      mat: birdVertexColorMat,
      pos: [0, 0, 0],
      rot: [0, rotY, 0],
    },
    {
      geo: rig.wingRGeo,
      mat: birdVertexColorMat,
      pos: [0, 0, 0],
      rot: [0, rotY, 0],
    },
    {
      geo: rig.wingLGeo,
      mat: birdVertexColorMat,
      pos: [0, 0, 0],
      rot: [0, rotY, 0],
    },
  ];
}
