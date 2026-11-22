// --- FARM MODELS ---
// Tractors parked out in the crop fields (tractorSpot in terrain-gen.js,
// drawn by terrain-chunks.js): Polyfork's Compact Tractor (polyfork.dev, free
// licence; source unchanged in third-party/polyfork) in three paint schemes,
// each merged into one vertex-coloured geometry at load (boat-models.js
// mergeAsset), wheels on y = 0, front toward +z, drawn bigger like the rest
// of the world.
import * as compactTractor from './third-party/polyfork/compact-tractor-35b84b.mjs';
import * as redBarn from './third-party/polyfork/red-barn-d41683.mjs';
import * as timberBarn from './third-party/polyfork/timber-barn-90b3ce.mjs';
import * as hayBarn from './third-party/polyfork/alpine-hay-barn-3965e5.mjs';
import * as grainSilo from './third-party/polyfork/grain-silo-58ca67.mjs';
import * as stoneWindmill from './third-party/polyfork/windmill-3aad49.mjs';
import * as THREE from 'three';
import {mergeAsset, POLYFORK_SCALE} from './boat-models.js';

// How much bigger than real life (a 2.8 m tractor comes out 7 units long,
// a little longer than the buggy)
export const TRACTOR_SCALE = POLYFORK_SCALE;

// Each tractor type (instanced by this name), in the order terrain-gen.js
// numbers them
const TRACTOR_SCHEMES = {
  tractorBody: 'harvest-red',
  tractor2Body: 'orchard-green',
  tractor3Body: 'meadow-blue',
};

export function buildTractorGeos() {
  const geos = {};
  for (const [type, colorway] of Object.entries(TRACTOR_SCHEMES)) {
    geos[type] = mergeAsset(
      compactTractor.createAsset({colorway}),
      0,
      TRACTOR_SCALE
    );
  }
  return geos;
}

// --- BARNS ---
// Polyfork barns in place of our old box barn, each split at its eaves into
// walls (which fold when hit) and roof (thrown off), and sized like the old
// one (about 18 x 28 units): the classic red barn in the heartland, and up
// north a timber-framed barn or an alpine hay barn (collectStructures in
// terrain-gen.js picks by a barn's style). Doors face +z and -z along the
// ridge, like the old barn's.

const BARNS = {
  // module, options, scale, eave height (m, as built)
  barn: [redBarn, {colorway: 'classic-red', depth: 9}, 3.0, 4.5],
  timberBarn: [timberBarn, {colorway: 'oak-thatch'}, 4.2, 3.3],
  hayBarn: [
    hayBarn,
    {colorway: 'weathered-larch', length: 8, snowfall: 0},
    2.8,
    2.7,
  ],
};

// {barnBody, barnRoof, timberBarnBody, ...}: each barn's walls and roof
export function buildBarnGeos() {
  const geos = {};
  for (const [name, [module, opts, scale, eave]] of Object.entries(BARNS)) {
    const asset = module.createAsset(opts);
    geos[name + 'Body'] = mergeAsset(
      asset,
      0,
      scale,
      0,
      (y) => y < eave - 0.01
    );
    geos[name + 'Roof'] = mergeAsset(
      asset,
      0,
      scale,
      0,
      (y) => y >= eave - 0.01
    );
  }
  return geos;
}

// The silo beside each red barn: Polyfork's Grain Silo, galvanised with a
// sage cap, about 8 units across and 26 tall, split at its eave into drum
// and cap (they topple together)
const SILO_SCALE = POLYFORK_SCALE;
const SILO_EAVE = 8;
export function buildSiloGeos() {
  const asset = grainSilo.createAsset({
    colorway: 'galvanised-sage',
    bodyHeight: SILO_EAVE,
  });
  return {
    body: mergeAsset(asset, 0, SILO_SCALE, 0, (y) => y < SILO_EAVE - 0.01),
    roof: mergeAsset(asset, 0, SILO_SCALE, 0, (y) => y >= SILO_EAVE - 0.01),
  };
}

// The farm windmills: Polyfork's Windmill, cream stone with a timber cap,
// about 45 units tall and 26 across at the foot like our old one. Built for
// terrain-gen.js's instance scale (1.5): the tower, and its sails about
// their hub (turning about z in windmillBladesMat's shader). The hub's
// place on the tower, after scaling, is WINDMILL_HUB in terrain-gen.js.
const WINDMILL_SCALE = 4.7;
const WINDMILL_INSTANCE_SCALE = 1.5;
export function buildWindmillGeos() {
  const asset = stoneWindmill.createAsset({
    colorway: 'cream-stone',
    sailSpan: 1.15,
  });
  asset.updateMatrixWorld(true);
  const sails = asset.getObjectByName('sails');
  const hub = new THREE.Vector3().setFromMatrixPosition(sails.matrixWorld);
  const inSails = (o) => {
    for (let p = o; p; p = p.parent) if (p === sails) return true;
    return false;
  };
  const tower = [];
  const blades = [];
  asset.traverse((o) => {
    if (o.isMesh) (inSails(o) ? blades : tower).push(o);
  });
  const k = WINDMILL_SCALE / WINDMILL_INSTANCE_SCALE;
  const merge = (meshes, origin) => {
    const pos = [];
    const col = [];
    const v = new THREE.Vector3();
    for (const o of meshes) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const p = g.attributes.position;
      const c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).sub(origin);
        pos.push(v.x * k, v.y * k, v.z * k);
        if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
        else col.push(1, 1, 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  };
  return {
    base: merge(tower, new THREE.Vector3()),
    blades: merge(blades, hub),
    // Where the hub is, at the game's scale (units)
    hub: hub.multiplyScalar(WINDMILL_SCALE),
  };
}

// --- IRISH DRY-STONE WALLS (#184) ---
// Unit-length dry-stone wall segment spanning z in [-0.5, +0.5], authored at
// its natural ~13.5-unit bay length in world proportions before normalizing z
// to [-0.5, +0.5]. Battered profile (~2.35 units wide at ground level tapering
// to ~1.35 at the ridge, ~3.45 units tall above ground and buried 1.3 units
// below y = 0 so hillside facets never show daylight underneath).
export const STONE_WALL_HEIGHT = 3.45;
export const STONE_WALL_RUINED_HEIGHT = 1.95;
export const STONE_WALL_HALF_WIDTH = 1.18;
const WALL_BAY_REF = 13.5;

function wallMulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pushTri(pos, col, a, b, c, rgb) {
  pos.push(
    a[0],
    a[1],
    a[2] / WALL_BAY_REF,
    b[0],
    b[1],
    b[2] / WALL_BAY_REF,
    c[0],
    c[1],
    c[2] / WALL_BAY_REF
  );
  for (let i = 0; i < 3; i++) col.push(rgb[0], rgb[1], rgb[2]);
}

function pushQuad(pos, col, a, b, c, d, rgb) {
  pushTri(pos, col, a, b, c, rgb);
  pushTri(pos, col, a, c, d, rgb);
}

// Appends an organic faceted 10-vertex polyhedral boulder/fieldstone (12
// triangles, open underside) authored in world-unit coordinates (x, y, z)
// with 3D yaw/pitch/roll and boulder facet perturbation so stones read as
// weathered hand-stacked limestone cobbles rather than rectangular bricks.
function pushBoulderStone(
  pos,
  col,
  rand,
  {
    cx,
    cy,
    cz,
    rx,
    ry,
    rz,
    yaw = 0,
    pitch = 0,
    roll = 0,
    shoulder = 0.54,
    peak = 0.9,
    rgb,
    topRgb,
    snowMask = 0,
  }
) {
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);

  const xform = (lx, ly, lz) => {
    // Roll (Z), then Pitch (X), then Yaw (Y)
    const x1 = lx * cr - ly * sr;
    const y1 = lx * sr + ly * cr;
    const y2 = y1 * cp - lz * sp;
    const z2 = y1 * sp + lz * cp;
    const x3 = x1 * cyaw + z2 * syaw;
    const z3 = -x1 * syaw + z2 * cyaw;
    return [cx + x3, cy + y2, cz + z3];
  };

  // 6-sided irregular shoulder ring + low blunt table crown (12 tris)
  const ring = [];
  const baseRing = [];
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2 + (rand() - 0.5) * 0.22;
    const rad = 0.9 + rand() * 0.18;
    const wx = Math.cos(ang) * rx * rad;
    const wz = Math.sin(ang) * rz * rad;
    ring.push(xform(wx, ry * (shoulder + (rand() - 0.5) * 0.14), wz));
    baseRing.push(xform(wx * 1.05, -ry * (0.85 + rand() * 0.18), wz * 1.05));
  }
  const apex = xform(
    (rand() - 0.5) * rx * 0.18,
    ry * peak,
    (rand() - 0.5) * rz * 0.18
  );
  const shade = [rgb[0] * 0.84, rgb[1] * 0.85, rgb[2] * 0.88];
  const snowBright = [0.85, 0.89, 0.93];
  const snowShade = [0.77, 0.82, 0.88];
  for (let k = 0; k < 6; k++) {
    const next = (k + 1) % 6;
    const sideCol = k >= 2 && k <= 4 ? shade : rgb;
    const hasSnow = ((snowMask >> k) & 1) !== 0;
    const crownCol = hasSnow
      ? k % 2 === 0
        ? snowBright
        : snowShade
      : k % 2 === 0
        ? topRgb
        : rgb;
    // Counter-clockwise from outside so vertex normals point outward & upward
    pushTri(pos, col, ring[next], ring[k], apex, crownCol);
    pushQuad(
      pos,
      col,
      baseRing[next],
      baseRing[k],
      ring[k],
      ring[next],
      sideCol
    );
  }
}

// Appends a battered open-bottom prism spanning z in [z0, z1] world units (10 tris).
function pushBatteredCore(
  pos,
  col,
  {z0, z1, yBase, yTop0, yTop1, wBase, wTop, sideRgb, topRgb}
) {
  const bL0 = [-wBase, yBase, z0];
  const bR0 = [wBase, yBase, z0];
  const bR1 = [wBase, yBase, z1];
  const bL1 = [-wBase, yBase, z1];
  const tL0 = [-wTop, yTop0, z0];
  const tR0 = [wTop, yTop0, z0];
  const tR1 = [wTop, yTop1, z1];
  const tL1 = [-wTop, yTop1, z1];
  const darkSide = [sideRgb[0] * 0.88, sideRgb[1] * 0.89, sideRgb[2] * 0.92];
  pushQuad(pos, col, tL0, tL1, tR1, tR0, topRgb);
  pushQuad(pos, col, bR0, bR1, tR1, tR0, sideRgb);
  pushQuad(pos, col, bL1, bL0, tL0, tL1, darkSide);
  pushQuad(pos, col, bR1, bL1, tL1, tR1, sideRgb);
  pushQuad(pos, col, bL0, bR0, tR0, tL0, darkSide);
}

const STONE_PALETTE = [
  [0.5, 0.53, 0.55], // weathered limestone
  [0.58, 0.6, 0.62], // pale Connemara grey
  [0.43, 0.46, 0.49], // dark greywacke
  [0.55, 0.56, 0.5], // warm lichen grey
  [0.46, 0.51, 0.44], // mossy slate
  [0.62, 0.64, 0.63], // silver granite
];
const SNOW_SLATE_PALETTE = [
  [0.33, 0.36, 0.4], // cold wet northern slate
  [0.4, 0.43, 0.47], // frosted greywacke
  [0.28, 0.31, 0.35], // dark winter basalt-slate
  [0.45, 0.48, 0.52], // pale frost granite
  [0.36, 0.39, 0.43], // weathered tors slate
];
const MOSS_TINT = [0.35, 0.45, 0.3];

function buildStoneWallSet(seed, snowy) {
  const rand = wallMulberry32(seed);
  const pos = [];
  const col = [];
  const halfBay = WALL_BAY_REF * 0.5;
  const palette = snowy ? SNOW_SLATE_PALETTE : STONE_PALETTE;

  // 1. Dark recessed dry-stone core tucked strictly inside the stone courses so
  // crevices read as mortar-free shadow and no core shelf pokes out sideways.
  const coreHeights = [2.58, 2.5, 2.62, 2.54];
  for (let s = 0; s < 3; s++) {
    const z0 = -halfBay + (s / 3) * WALL_BAY_REF;
    const z1 = -halfBay + ((s + 1) / 3) * WALL_BAY_REF;
    pushBatteredCore(pos, col, {
      z0,
      z1,
      yBase: -1.3,
      yTop0: coreHeights[s],
      yTop1: coreHeights[s + 1],
      wBase: 0.9,
      wTop: 0.34,
      sideRgb: snowy ? [0.22, 0.25, 0.29] : [0.27, 0.3, 0.32],
      topRgb: snowy ? [0.25, 0.28, 0.32] : [0.35, 0.39, 0.36],
    });
  }

  const pickStoneColor = (mossWeight) => {
    const base = palette[Math.floor(rand() * palette.length)];
    const jitter = (rand() - 0.5) * 0.06;
    if (snowy) {
      const rgb = [base[0] + jitter, base[1] + jitter, base[2] + jitter];
      const topRgb = [
        Math.min(1, rgb[0] * 1.15),
        Math.min(1, rgb[1] * 1.15),
        Math.min(1, rgb[2] * 1.18),
      ];
      return {rgb, topRgb};
    }
    const m = rand() < mossWeight ? 0.25 + rand() * 0.32 : 0;
    const rgb = [
      (base[0] + jitter) * (1 - m) + MOSS_TINT[0] * m,
      (base[1] + jitter) * (1 - m) + MOSS_TINT[1] * m,
      (base[2] + jitter) * (1 - m) + MOSS_TINT[2] * m,
    ];
    const topM = m * 0.55 + (rand() < 0.24 ? 0.24 : 0);
    const topRgb = [
      Math.min(1, rgb[0] * 1.08 * (1 - topM) + MOSS_TINT[0] * 1.15 * topM),
      Math.min(1, rgb[1] * 1.08 * (1 - topM) + MOSS_TINT[1] * 1.15 * topM),
      Math.min(1, rgb[2] * 1.07 * (1 - topM) + MOSS_TINT[2] * 1.15 * topM),
    ];
    return {rgb, topRgb};
  };

  // 2. Two staggered courses of faceted fieldstone boulders on each face
  const courses = [
    {
      y: 0.95,
      ry: 0.68,
      xOut: 0.78,
      rx: 0.44,
      count: 5,
      moss: 0.45,
      snowChance: 0.3,
      outMaskPos: 0b100001,
      outMaskNeg: 0b001100,
    },
    {
      y: 2.12,
      ry: 0.58,
      xOut: 0.62,
      rx: 0.38,
      count: 6,
      moss: 0.22,
      snowChance: 0.66,
      outMaskPos: 0b100011,
      outMaskNeg: 0b011100,
    },
  ];
  for (const side of [-1, 1]) {
    for (const c of courses) {
      const span = WALL_BAY_REF / c.count;
      for (let i = 0; i < c.count; i++) {
        const rz = span * (0.44 + rand() * 0.12);
        const rawZ = -halfBay + (i + 0.5) * span + (rand() - 0.5) * span * 0.22;
        const cz = Math.max(
          -halfBay + rz * 0.85,
          Math.min(halfBay - rz * 0.85, rawZ)
        );
        const {rgb, topRgb} = pickStoneColor(c.moss + (side < 0 ? 0.14 : 0));
        // Dust outward-facing upper shoulder ledges on both faces while keeping
        // vertical stone flanks cold dark slate
        const snowHit = snowy && rand() < c.snowChance;
        const outMask = side > 0 ? c.outMaskPos : c.outMaskNeg;
        pushBoulderStone(pos, col, rand, {
          cx: side * (c.xOut + (rand() - 0.5) * 0.09),
          cy: c.y + (rand() - 0.5) * 0.16,
          cz,
          rx: c.rx * (0.9 + rand() * 0.24),
          ry: c.ry * (0.86 + rand() * 0.22),
          rz,
          yaw: (rand() - 0.5) * 0.3,
          pitch: (rand() - 0.5) * 0.14,
          roll: -side * (0.08 + rand() * 0.1),
          shoulder: 0.62,
          peak: 0.84 + rand() * 0.1,
          rgb,
          topRgb,
          snowMask: snowHit ? outMask : 0,
        });
      }
    }
  }

  // 3. Rounded boulder quoins at z = +/-halfBay
  for (const endSign of [-1, 1]) {
    const {rgb, topRgb} = pickStoneColor(0.32);
    pushBoulderStone(pos, col, rand, {
      cx: (rand() - 0.5) * 0.06,
      cy: 1.55,
      cz: endSign * (halfBay - 0.55),
      rx: 0.96,
      ry: 1.32,
      rz: 0.65,
      yaw: (rand() - 0.5) * 0.16,
      pitch: 0,
      roll: 0,
      shoulder: 0.65,
      peak: 0.85,
      rgb,
      topRgb,
      snowMask: snowy ? 0b111111 : 0,
    });
  }

  // 4. Blunt, flat-topped fieldstone / slate cope slabs along the top ridge,
  // with patchy winter snow resting on ~60% of the flat slab tables in snow country.
  const copeCount = 9;
  const copeSpan = WALL_BAY_REF / copeCount;
  const slabSnowPattern = [1, 1, 0, 1, 1, 1, 0, 0, 1];
  for (let i = 0; i < copeCount; i++) {
    const rz = copeSpan * (0.48 + rand() * 0.1);
    const cz = Math.max(
      -halfBay + rz * 0.82,
      Math.min(
        halfBay - rz * 0.82,
        -halfBay + (i + 0.5) * copeSpan + (rand() - 0.5) * 0.14
      )
    );
    const {rgb, topRgb} = pickStoneColor(0.26);
    const copeSnowMask = snowy && slabSnowPattern[i] ? 0b111111 : 0;
    pushBoulderStone(pos, col, rand, {
      cx: (rand() - 0.5) * 0.1,
      cy: 2.76 + (rand() - 0.5) * 0.1,
      cz,
      rx: 0.72 + rand() * 0.12,
      ry: 0.36 + rand() * 0.1,
      rz,
      yaw: (rand() - 0.5) * 0.22,
      pitch: (rand() - 0.5) * 0.1,
      roll: (rand() - 0.5) * 0.1,
      shoulder: 0.72,
      peak: snowy ? 0.86 + rand() * 0.06 : 0.92 + rand() * 0.12,
      rgb,
      topRgb,
      snowMask: copeSnowMask,
    });
  }

  const nearGeo = new THREE.BufferGeometry();
  nearGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  nearGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  nearGeo.computeVertexNormals();
  nearGeo.computeBoundingBox();
  nearGeo.computeBoundingSphere();

  // Far LOD: dark winter slate flanks in snow country so walls read crisply
  // across white hills from altitude, with a frosted silver-slate ridge.
  const farPos = [];
  const farCol = [];
  pushBatteredCore(farPos, farCol, {
    z0: -halfBay,
    z1: halfBay,
    yBase: -1.1,
    yTop0: 3.5,
    yTop1: 3.5,
    wBase: 1.55,
    wTop: 0.98,
    sideRgb: snowy ? [0.31, 0.34, 0.39] : [0.5, 0.53, 0.53],
    topRgb: snowy ? [0.74, 0.79, 0.85] : [0.62, 0.65, 0.64],
  });
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute('position', new THREE.Float32BufferAttribute(farPos, 3));
  farGeo.setAttribute('color', new THREE.Float32BufferAttribute(farCol, 3));
  farGeo.computeVertexNormals();
  farGeo.computeBoundingBox();
  farGeo.computeBoundingSphere();

  // Crumbled / decrepit bay
  const rPos = [];
  const rCol = [];
  const slumpedHeights = [1.35, 0.78, 0.86, 1.3];
  for (let s = 0; s < 3; s++) {
    const z0 = -halfBay + (s / 3) * WALL_BAY_REF;
    const z1 = -halfBay + ((s + 1) / 3) * WALL_BAY_REF;
    pushBatteredCore(rPos, rCol, {
      z0,
      z1,
      yBase: -1.25,
      yTop0: slumpedHeights[s],
      yTop1: slumpedHeights[s + 1],
      wBase: 1.02,
      wTop: 0.4,
      sideRgb: snowy ? [0.24, 0.27, 0.31] : [0.29, 0.34, 0.28],
      topRgb: snowy ? [0.28, 0.31, 0.36] : [0.34, 0.4, 0.32],
    });
  }
  for (let i = 0; i < 12; i++) {
    const span = WALL_BAY_REF / 12;
    const cz = -halfBay + (i + 0.5) * span + (rand() - 0.5) * 0.28;
    const dip = 1 - 0.35 * Math.sin(((i + 0.5) / 12) * Math.PI);
    const {rgb, topRgb} = pickStoneColor(0.58);
    const rMask = snowy && i % 3 !== 1 ? 0b111111 : 0;
    pushBoulderStone(rPos, rCol, rand, {
      cx: (rand() - 0.5) * 0.85,
      cy: (1.35 + rand() * 0.55) * dip,
      cz,
      rx: 0.82 + rand() * 0.34,
      ry: 0.52 + rand() * 0.24,
      rz: 0.68 + rand() * 0.3,
      yaw: rand() * Math.PI,
      pitch: (rand() - 0.5) * 0.22,
      roll: (rand() - 0.5) * 0.26,
      shoulder: 0.68,
      peak: 0.86 + rand() * 0.08,
      rgb,
      topRgb,
      snowMask: rMask,
    });
  }
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const cz = -halfBay + 1.1 + rand() * (WALL_BAY_REF - 2.2);
    const outX = side * (1.4 + rand() * 1.75);
    const {rgb, topRgb} = pickStoneColor(0.65);
    const spillMask = snowy && i % 3 !== 2 ? 0b111111 : 0;
    pushBoulderStone(rPos, rCol, rand, {
      cx: outX,
      cy: 0.48 + rand() * 0.38,
      cz,
      rx: 0.64 + rand() * 0.38,
      ry: 0.44 + rand() * 0.24,
      rz: 0.66 + rand() * 0.38,
      yaw: rand() * Math.PI,
      pitch: (rand() - 0.5) * 0.2,
      roll: side * (0.1 + rand() * 0.22),
      shoulder: 0.7,
      peak: 0.86 + rand() * 0.08,
      rgb,
      topRgb,
      snowMask: spillMask,
    });
  }
  const ruinedGeo = new THREE.BufferGeometry();
  ruinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  ruinedGeo.setAttribute('color', new THREE.Float32BufferAttribute(rCol, 3));
  ruinedGeo.computeVertexNormals();
  ruinedGeo.computeBoundingBox();
  ruinedGeo.computeBoundingSphere();

  const rFarPos = [];
  const rFarCol = [];
  pushBatteredCore(rFarPos, rFarCol, {
    z0: -halfBay,
    z1: halfBay,
    yBase: -1.0,
    yTop0: 2.05,
    yTop1: 2.05,
    wBase: 2.15,
    wTop: 1.4,
    sideRgb: snowy ? [0.34, 0.37, 0.42] : [0.44, 0.49, 0.43],
    topRgb: snowy ? [0.7, 0.75, 0.81] : [0.53, 0.57, 0.5],
  });
  const ruinedFarGeo = new THREE.BufferGeometry();
  ruinedFarGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(rFarPos, 3)
  );
  ruinedFarGeo.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(rFarCol, 3)
  );
  ruinedFarGeo.computeVertexNormals();
  ruinedFarGeo.computeBoundingBox();
  ruinedFarGeo.computeBoundingSphere();

  return {nearGeo, farGeo, ruinedGeo, ruinedFarGeo};
}

export function buildStoneWallGeos() {
  const temperate = buildStoneWallSet(184509, false);
  const snowy = buildStoneWallSet(184717, true);
  return {
    stoneWall: temperate.nearGeo,
    stoneWallFar: temperate.farGeo,
    stoneWallRuined: temperate.ruinedGeo,
    stoneWallRuinedFar: temperate.ruinedFarGeo,
    stoneWallSnow: snowy.nearGeo,
    stoneWallSnowFar: snowy.farGeo,
    stoneWallSnowRuined: snowy.ruinedGeo,
    stoneWallSnowRuinedFar: snowy.ruinedFarGeo,
  };
}
