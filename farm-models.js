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

// --- PROCEDURAL CRITTERS & SMALL COASTAL / CAMP PROPS ---

function cRgb(hex, mul = 1) {
  const c = new THREE.Color(hex);
  return [
    Math.min(1, Math.max(0, c.r * mul)),
    Math.min(1, Math.max(0, c.g * mul)),
    Math.min(1, Math.max(0, c.b * mul)),
  ];
}

function makeMeshBuilder(colored = true) {
  const pos = [];
  const col = [];
  function push(p, c) {
    pos.push(p[0], p[1], p[2]);
    if (colored) col.push(c[0], c[1], c[2]);
  }
  function tri(a, b, c, ca, cb = ca, cc = ca) {
    push(a, ca);
    push(b, cb);
    push(c, cc);
  }
  function quad(a, b, c, d, ca, cb = ca, cc = cb, cd = ca) {
    tri(a, b, c, ca, cb, cc);
    tri(a, c, d, ca, cc, cd);
  }
  function build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colored) {
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
  return {tri, quad, build};
}

// Vertical Y-axis loft: `a = 0` faces +z, `a = PI/2` faces +x, `a = PI` faces -z.
function addVerticalLoft(
  B,
  stations,
  {sides = 8, twist = 0, capTop = null, capBot = null} = {}
) {
  const rings = [];
  const cols = [];
  for (let i = 0; i < stations.length; i++) {
    const {cx = 0, cy, cz = 0, rx, rz = rx, colorFn} = stations[i];
    const rPts = [];
    const rCols = [];
    for (let k = 0; k < sides; k++) {
      const a = twist + (k / sides) * Math.PI * 2;
      rPts.push([cx + rx * Math.sin(a), cy, cz + rz * Math.cos(a)]);
      rCols.push(colorFn ? colorFn(a, k, i) : [1, 1, 1]);
    }
    rings.push(rPts);
    cols.push(rCols);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      const c0 = cols[i][k];
      const c01 = cols[i][k1];
      const c11 = cols[i + 1][k1];
      const c1 = cols[i + 1][k];
      B.quad(
        rings[i][k],
        rings[i][k1],
        rings[i + 1][k1],
        rings[i + 1][k],
        c0,
        c01,
        c11,
        c1
      );
    }
  }
  if (capBot) {
    const [bx, by, bz, bCol = [1, 1, 1]] = capBot;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      B.tri(
        rings[0][k1],
        rings[0][k],
        [bx, by, bz],
        cols[0][k1],
        cols[0][k],
        bCol
      );
    }
  }
  if (capTop) {
    const last = rings.length - 1;
    const [tx, ty, tz, tCol = [1, 1, 1]] = capTop;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      B.tri(
        rings[last][k],
        rings[last][k1],
        [tx, ty, tz],
        cols[last][k],
        cols[last][k1],
        tCol
      );
    }
  }
}

// Elliptical spine loft along 3D stations `{p:[x,y,z], ru, rv, colorFn}`.
// With ref=[0,1,0], `a = 0` is dorsal (+U/top), `a = PI` is ventral (-U/belly).
function addSpineLoft(
  B,
  stations,
  {sides = 8, twist = 0, capStart = null, capEnd = null} = {}
) {
  const n = stations.length;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  const tangents = [];
  for (let i = 0; i < n; i++) {
    if (n === 1) {
      tangents.push(norm(sub(capEnd || [0, 0, 1], stations[0].p)));
    } else if (i === 0) tangents.push(norm(sub(stations[1].p, stations[0].p)));
    else if (i === n - 1)
      tangents.push(norm(sub(stations[n - 1].p, stations[n - 2].p)));
    else {
      const t0 = norm(sub(stations[i].p, stations[i - 1].p));
      const t1 = norm(sub(stations[i + 1].p, stations[i].p));
      tangents.push(norm([t0[0] + t1[0], t0[1] + t1[1], t0[2] + t1[2]]));
    }
  }

  let u = null;
  const rings = [];
  const cols = [];
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    if (i === 0) {
      const ref = Math.abs(t[1]) < 0.92 ? [0, 1, 0] : [0, 0, 1];
      const d = dot(ref, t);
      u = norm([ref[0] - t[0] * d, ref[1] - t[1] * d, ref[2] - t[2] * d]);
    } else {
      const d = dot(u, t);
      const proj = [u[0] - t[0] * d, u[1] - t[1] * d, u[2] - t[2] * d];
      if (Math.hypot(proj[0], proj[1], proj[2]) > 1e-5) u = norm(proj);
    }
    const v = norm(cross(t, u));
    const {p, ru, rv = ru, scallop = 0, colorFn} = stations[i];
    const rPts = [];
    const rCols = [];
    for (let k = 0; k < sides; k++) {
      const a = twist + (k / sides) * Math.PI * 2;
      const mul = 1 + scallop * (k % 2 === 0 ? 1 : -1);
      const cu = Math.cos(a) * ru * mul;
      const sv = Math.sin(a) * rv * mul;
      rPts.push([
        p[0] + cu * u[0] + sv * v[0],
        p[1] + cu * u[1] + sv * v[1],
        p[2] + cu * u[2] + sv * v[2],
      ]);
      rCols.push(colorFn ? colorFn(a, k, i) : [1, 1, 1]);
    }
    rings.push(rPts);
    cols.push(rCols);
  }

  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      B.quad(
        rings[i][k],
        rings[i][k1],
        rings[i + 1][k1],
        rings[i + 1][k],
        cols[i][k],
        cols[i][k1],
        cols[i + 1][k1],
        cols[i + 1][k]
      );
    }
  }
  if (capStart) {
    const [sx, sy, sz, sCol = [1, 1, 1]] = capStart;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      B.tri(
        rings[0][k1],
        rings[0][k],
        [sx, sy, sz],
        cols[0][k1],
        cols[0][k],
        sCol
      );
    }
  }
  if (capEnd) {
    const last = n - 1;
    const [ex, ey, ez, eCol = [1, 1, 1]] = capEnd;
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      B.tri(
        rings[last][k],
        rings[last][k1],
        [ex, ey, ez],
        cols[last][k],
        cols[last][k1],
        eCol
      );
    }
  }
}

// Oriented tapered box (hx0/hz0 at bottom -hy, hx1/hz1 at top +hy) rotated by Euler
function addTaperedBox(
  B,
  {
    cx,
    cy,
    cz,
    hx0,
    hz0,
    hx1 = hx0,
    hz1 = hz0,
    hy,
    rx = 0,
    ry = 0,
    rz = 0,
    colTop = [1, 1, 1],
    colSide = colTop,
    colPosX = colSide,
    colNegX = colSide,
    colBot = colSide,
    capTop = true,
    capBot = true,
  }
) {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(rx, ry, rz, 'YXZ')
  );
  const v = new THREE.Vector3();
  const xf = (x, y, z) => {
    v.set(x, y, z).applyQuaternion(q);
    return [cx + v.x, cy + v.y, cz + v.z];
  };
  const b0 = xf(-hx0, -hy, hz0);
  const b1 = xf(hx0, -hy, hz0);
  const b2 = xf(hx0, -hy, -hz0);
  const b3 = xf(-hx0, -hy, -hz0);
  const t0 = xf(-hx1, hy, hz1);
  const t1 = xf(hx1, hy, hz1);
  const t2 = xf(hx1, hy, -hz1);
  const t3 = xf(-hx1, hy, -hz1);
  B.quad(b0, b1, t1, t0, colSide);
  B.quad(b1, b2, t2, t1, colPosX);
  B.quad(b2, b3, t3, t2, colSide);
  B.quad(b3, b0, t0, t3, colNegX);
  if (capTop) B.quad(t0, t1, t2, t3, colTop);
  if (capBot) B.quad(b3, b2, b1, b0, colBot);
}

// Emperor penguin (`Aptenodytes forsteri`): sleek rounded black head with
// bright eye highlights, sunny-gold collar & ear patches, lemon-cream chest,
// snow-white belly, curved two-tone bill, hydrofoil flippers, and amber feet.
export function buildPenguinGeo() {
  const B = makeMeshBuilder(true);
  const hoodBlack = cRgb(0x161d26);
  const dorsalSlate = cRgb(0x233040);
  const dorsalBack = cRgb(0x2d3c4f);
  const bellySnow = cRgb(0xf6f8fb);
  const bellyCream = cRgb(0xfef1be);
  const collarGold = cRgb(0xf9cb52);
  const earGold = cRgb(0xf6aa2e);
  const eyeSparkle = cRgb(0xf2f6fa);
  const billBlack = cRgb(0x191f28);
  const billOrange = cRgb(0xf57a24);
  const footAmber = cRgb(0xeb7f1c);
  const flipperInner = cRgb(0xe4eaf0);

  // 8-sided solid-facet body: k = 0, 1 span -45..+45 deg across the front (+z);
  // k = 2, 7 are the shoulder lapels / side-neck golden ear patches.
  const N = 8;
  const pStations = [
    {cy: 0.2, cz: -0.02, rx: 0.96, rz: 0.98},
    {cy: 1.15, cz: 0.1, rx: 1.28, rz: 1.26},
    {cy: 2.25, cz: 0.12, rx: 1.18, rz: 1.14},
    {cy: 2.92, cz: 0.1, rx: 1.0, rz: 0.98},
    {cy: 3.44, cz: 0.1, rx: 0.88, rz: 0.9},
    {cy: 4.18, cz: 0.1, rx: 0.8, rz: 0.84},
    {cy: 4.54, cz: 0.08, rx: 0.48, rz: 0.52},
  ];
  const pRings = pStations.map(({cy, cz, rx, rz}) => {
    const pts = [];
    for (let k = 0; k < N; k++) {
      const a = ((k - 1) / N) * Math.PI * 2;
      pts.push([rx * Math.sin(a), cy, cz + rz * Math.cos(a)]);
    }
    return pts;
  });

  const bandFacetCol = (bandIdx, k) => {
    if (bandIdx <= 1) {
      if (k <= 1) return bellySnow;
      if (k === 2 || k === 7) return hoodBlack;
      return k === 4 || k === 5 ? dorsalBack : dorsalSlate;
    }
    if (bandIdx === 2) {
      if (k <= 1) return bellyCream;
      if (k === 2 || k === 7) return hoodBlack;
      return dorsalSlate;
    }
    if (bandIdx === 3) {
      if (k <= 1) return collarGold;
      if (k === 2 || k === 7) return earGold;
      return hoodBlack;
    }
    // Head and crown (bandIdx >= 4): 100% sleek black hood (no cheek streaks!)
    return hoodBlack;
  };

  for (let i = 0; i < pRings.length - 1; i++) {
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const col = bandFacetCol(i, k);
      B.quad(
        pRings[i][k],
        pRings[i][k1],
        pRings[i + 1][k1],
        pRings[i + 1][k],
        col
      );
    }
  }
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    const topIdx = pRings.length - 1;
    B.tri(pRings[topIdx][k], pRings[topIdx][k1], [0, 4.72, 0.06], hoodBlack);
  }

  // Sleek downward-curving two-tone Emperor bill
  addSpineLoft(
    B,
    [
      {
        p: [0, 3.78, 0.84],
        ru: 0.2,
        rv: 0.21,
        colorFn: (a) => (Math.cos(a) > 0.1 ? billBlack : billOrange),
      },
      {
        p: [0, 3.73, 1.36],
        ru: 0.12,
        rv: 0.13,
        colorFn: (a) => (Math.cos(a) > 0.15 ? billBlack : billOrange),
      },
    ],
    {
      sides: 4,
      capEnd: [0, 3.6, 1.84, billOrange],
    }
  );

  // Stubby counter-balance tail wedge at the rear (-z)
  addSpineLoft(
    B,
    [{p: [0, 0.52, -0.88], ru: 0.22, rv: 0.38, colorFn: () => dorsalSlate}],
    {
      sides: 4,
      // Single 4-tri pyramid wedge
      capEnd: [0, 0.22, -1.54, hoodBlack],
    }
  );

  // Cheerful bright eye highlights, single-box hydrofoil flippers, and amber feet
  for (const sx of [-1, 1]) {
    const ex = sx * 0.46;
    const ey = 3.9;
    const ez = 0.8;
    const pInner = [sx * 0.38, ey, ez + 0.033];
    const pOuter = [sx * 0.54, ey, ez - 0.033];
    const pLeft = sx > 0 ? pInner : pOuter;
    const pRight = sx > 0 ? pOuter : pInner;
    B.quad(
      [ex, ey - 0.09, ez + 0.01],
      pRight,
      [ex, ey + 0.09, ez - 0.01],
      pLeft,
      eyeSparkle
    );

    addTaperedBox(B, {
      cx: sx * 1.22,
      cy: 2.02,
      cz: 0.02,
      hx0: 0.09,
      hz0: 0.24,
      hx1: 0.13,
      hz1: 0.38,
      hy: 0.96,
      rz: sx * 0.22,
      rx: -0.1,
      colTop: dorsalSlate,
      colSide: dorsalSlate,
      colPosX: sx < 0 ? flipperInner : dorsalSlate,
      colNegX: sx > 0 ? flipperInner : dorsalSlate,
      colBot: hoodBlack,
    });

    addTaperedBox(B, {
      cx: sx * 0.54,
      cy: 0.11,
      cz: 0.58,
      hx0: 0.38,
      hz0: 0.56,
      hx1: 0.28,
      hz1: 0.46,
      hy: 0.11,
      ry: sx * 0.22,
      colTop: footAmber,
      colSide: cRgb(0xc96814),
      capBot: false,
    });
  }

  return B.build();
}

// Basking Arctic harbour seal (`Phoca vitulina`, 128 tris): curved banana
// haul-out pose with mottled silver-slate coat, cream belly, raised snout with
// dark eyes and nose, braced fore-flippers, and V-fanned hind flippers.
export function buildSealGeo() {
  const B = makeMeshBuilder(true);
  const coatDark = cRgb(0x57606b);
  const coatMid = cRgb(0x6d7682);
  const coatSpot = cRgb(0x7f8894);
  const bellyCream = cRgb(0xc6cdd2);
  const bellySide = cRgb(0x9ca5ae);
  const flipperDark = cRgb(0x434b54);
  const noseBlack = cRgb(0x181b20);

  const sealCoat = (a, k, i) => {
    const ca = Math.cos(a);
    if (ca < -0.35) return bellyCream;
    if (ca < 0.05) return bellySide;
    return (k + i) % 2 === 0 ? coatMid : i > 3 ? coatDark : coatSpot;
  };

  // Lean 6-sided curved fusiform body from rump -> barrel -> neck -> muzzle
  addSpineLoft(
    B,
    [
      {p: [0, 0.54, -2.55], ru: 0.44, rv: 0.5, colorFn: sealCoat},
      {p: [0, 0.86, -0.45], ru: 0.96, rv: 1.28, colorFn: sealCoat},
      {p: [0, 1.08, 1.28], ru: 0.86, rv: 1.08, colorFn: sealCoat},
      {p: [0, 1.58, 2.18], ru: 0.68, rv: 0.74, colorFn: sealCoat},
      {p: [0, 1.94, 2.68], ru: 0.62, rv: 0.64, colorFn: sealCoat},
      {p: [0, 1.84, 3.18], ru: 0.34, rv: 0.38, colorFn: () => coatDark},
    ],
    {
      sides: 6,
      capStart: [0, 0.56, -2.85, flipperDark],
      capEnd: [0, 1.8, 3.48, noseBlack],
    }
  );

  for (const sx of [-1, 1]) {
    addTaperedBox(B, {
      cx: sx * 0.44,
      cy: 2.06,
      cz: 2.84,
      hx0: 0.09,
      hz0: 0.11,
      hx1: 0.07,
      hz1: 0.09,
      hy: 0.09,
      ry: sx * 0.35,
      colTop: noseBlack,
      capBot: false,
    });

    // 3-sided fore-flipper and cocked hind-flipper paddles
    addSpineLoft(
      B,
      [
        {
          p: [sx * 0.92, 0.42, 1.15],
          ru: 0.14,
          rv: 0.34,
          colorFn: () => coatDark,
        },
        {
          p: [sx * 1.62, 0.14, 0.72],
          ru: 0.09,
          rv: 0.42,
          colorFn: () => flipperDark,
        },
      ],
      {sides: 3, capEnd: [sx * 1.92, 0.06, 0.45, flipperDark]}
    );

    addSpineLoft(
      B,
      [
        {
          p: [sx * 0.24, 0.56, -2.55],
          ru: 0.16,
          rv: 0.24,
          colorFn: () => coatDark,
        },
        {
          p: [sx * 0.76, 0.98, -3.38],
          ru: 0.1,
          rv: 0.46,
          colorFn: () => flipperDark,
        },
      ],
      {sides: 3, capEnd: [sx * 1.02, 1.18, -3.78, flipperDark]}
    );
  }

  return B.build();
}

// Grazing pasture sheep (131 tris/sheep):
// scalloped fleece (`wool`) with poll cap & tail, plus tapered blackface muzzle,
// outspread ears, and slender legs (`dark`).
export function buildSheepGeos() {
  const W = makeMeshBuilder(false);
  const D = makeMeshBuilder(false);

  addSpineLoft(
    W,
    [
      {p: [0, 1.72, -1.28], ru: 0.78, rv: 0.88, scallop: 0.08},
      {p: [0, 1.84, -0.2], ru: 1.0, rv: 1.16, scallop: 0.1},
      {p: [0, 1.74, 0.82], ru: 0.94, rv: 1.06, scallop: 0.08},
      {p: [0, 1.56, 1.34], ru: 0.62, rv: 0.68, scallop: 0.06},
    ],
    {
      sides: 6,
      twist: Math.PI / 6,
      capStart: [0, 1.66, -1.58],
      capEnd: [0, 1.48, 1.52],
    }
  );

  // Fluffy woolly poll cap between the ears
  addSpineLoft(
    W,
    [
      {p: [0, 1.74, 1.38], ru: 0.26, rv: 0.34},
      {p: [0, 1.68, 1.72], ru: 0.22, rv: 0.28},
    ],
    {sides: 4, capEnd: [0, 1.6, 1.88]}
  );

  // Short woolly docked tail drooping off the rump
  addSpineLoft(
    W,
    [
      {p: [0, 1.68, -1.42], ru: 0.22, rv: 0.22},
      {p: [0, 1.34, -1.66], ru: 0.15, rv: 0.15},
    ],
    {sides: 3, capEnd: [0, 1.18, -1.74]}
  );

  // Tapered grazing blackface head (wider at poll -hy, narrow at grazing muzzle +hy)
  addTaperedBox(D, {
    cx: 0,
    cy: 1.32,
    cz: 1.76,
    hx0: 0.3,
    hz0: 0.28,
    hx1: 0.17,
    hz1: 0.16,
    hy: 0.46,
    rx: 1.08,
    capBot: false,
  });

  // Outspread horizontal lamb ears
  for (const sx of [-1, 1]) {
    addTaperedBox(D, {
      cx: sx * 0.45,
      cy: 1.56,
      cz: 1.52,
      hx0: 0.23,
      hz0: 0.1,
      hx1: 0.15,
      hz1: 0.07,
      hy: 0.06,
      rz: -sx * 0.24,
      ry: -sx * 0.22,
      capBot: false,
    });
  }

  // Four slender tapered legs in a natural grazing stance
  for (const [lx, lz, leanX] of [
    [0.46, 0.88, 0.08],
    [-0.46, 0.72, -0.03],
    [0.48, -0.82, -0.04],
    [-0.48, -0.92, 0.04],
  ]) {
    addTaperedBox(D, {
      cx: lx,
      cy: 0.62,
      cz: lz,
      hx0: 0.1,
      hz0: 0.1,
      hx1: 0.16,
      hz1: 0.17,
      hy: 0.62,
      rx: leanX,
      capTop: false,
      capBot: false,
    });
  }

  return {
    wool: W.build(),
    dark: D.build(),
  };
}

// Coastal navigation channel buoy (133 tris/buoy): stepped steel float with
// rubbing strake and open 4-legged lattice daymark skeleton (`body`), topped by
// a dark service gallery, marine solar lantern, and radar topmark (`top`).
export function buildBuoyGeos() {
  const Body = makeMeshBuilder(false);
  const Top = makeMeshBuilder(false);

  addVerticalLoft(
    Body,
    [
      {cy: -1.0, rx: 1.24},
      {cy: 0.1, rx: 1.64},
      {cy: 0.95, rx: 1.68},
      {cy: 1.32, rx: 1.24},
    ],
    {
      sides: 8,
      capTop: [0, 1.44, 0],
    }
  );

  // Four angled 3-sided angle-iron lattice corner struts
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    addSpineLoft(
      Body,
      [
        {p: [sx * 0.82, 1.28, sz * 0.82], ru: 0.11, rv: 0.11},
        {p: [sx * 0.36, 4.38, sz * 0.36], ru: 0.09, rv: 0.09},
      ],
      {sides: 3}
    );
  }

  // Horizontal mid-tower daymark girt collar
  addVerticalLoft(
    Body,
    [
      {cy: 2.72, rx: 0.86},
      {cy: 3.16, rx: 0.78},
    ],
    {sides: 4, twist: Math.PI / 4}
  );

  // Dark marine iron service gallery + solar beacon + radar finial
  addVerticalLoft(
    Top,
    [
      {cy: 4.32, rx: 0.74},
      {cy: 4.58, rx: 0.76},
    ],
    {sides: 6, capTop: [0, 4.62, 0]}
  );
  addVerticalLoft(
    Top,
    [
      {cy: 4.58, rx: 0.36},
      {cy: 5.32, rx: 0.34},
    ],
    {sides: 5, capTop: [0, 5.46, 0]}
  );
  addVerticalLoft(
    Top,
    [
      {cy: 5.44, rx: 0.12},
      {cy: 5.72, rx: 0.32},
    ],
    {sides: 4, capTop: [0, 5.96, 0]}
  );

  return {
    body: Body.build(),
    top: Top.build(),
  };
}

// Stone-ring campfire (207 tris total across 3x fireLogGeo + 1x fireCoreGeo):
// 6 river-cobble stones, glowing charcoal-and-ember bed, 3 split bark-and-pine
// firewood logs with charred glowing tips, and 5 multi-tone flame spires.
export function buildCampfireGeos() {
  const L = makeMeshBuilder(true);
  const F = makeMeshBuilder(true);

  const ashOuter = cRgb(0x262220);
  const coalMid = cRgb(0x8c2b14);
  const coalHot = cRgb(0xf26419);
  const barkDark = cRgb(0x4a3425);
  const splitWood = cRgb(0xd8b27c);
  const charBlack = cRgb(0x1f1b1a);
  const emberTip = cRgb(0xe85318);

  // 120-degree wedge of charcoal ash rim rising to glowing coals at the center
  const a0 = 0;
  const a1 = (Math.PI * 2) / 3;
  const aMid = Math.PI / 3;
  const rAsh = 2.75;
  const rCoal = 1.45;
  const pCenter = [0, 0.34, 0];
  const c0 = [rCoal * Math.sin(a0), 0.24, rCoal * Math.cos(a0)];
  const cM = [rCoal * Math.sin(aMid), 0.24, rCoal * Math.cos(aMid)];
  const c1 = [rCoal * Math.sin(a1), 0.24, rCoal * Math.cos(a1)];
  const o0 = [rAsh * Math.sin(a0), -0.08, rAsh * Math.cos(a0)];
  const oM = [rAsh * Math.sin(aMid), -0.08, rAsh * Math.cos(aMid)];
  const o1 = [rAsh * Math.sin(a1), -0.08, rAsh * Math.cos(a1)];
  L.tri(c0, cM, pCenter, coalMid, coalMid, coalHot);
  L.tri(cM, c1, pCenter, coalMid, coalMid, coalHot);
  L.quad(o0, oM, cM, c0, ashOuter, ashOuter, coalMid, coalMid);
  L.quad(oM, o1, c1, cM, ashOuter, ashOuter, coalMid, coalMid);

  // 2 faceted river-cobble stones per 120-deg arc (6 stones total, no underground bottom caps)
  const stoneSpecs = [
    [0.42, 2.88, 0.86, 0.48, 0.64, 0x847a6c, 0x665e53],
    [1.48, 2.9, 0.82, 0.44, 0.6, 0x737670, 0x585b56],
  ];
  for (const [ang, rad, w, h, d, topHex, sideHex] of stoneSpecs) {
    const sx = rad * Math.sin(ang);
    const sz = rad * Math.cos(ang);
    addVerticalLoft(
      L,
      [
        {
          cx: sx,
          cy: -0.22,
          cz: sz,
          rx: w * 1.05,
          rz: d * 1.05,
          colorFn: () => ashOuter,
        },
        {
          cx: sx,
          cy: h * 0.68,
          cz: sz,
          rx: w * 0.86,
          rz: d * 0.86,
          colorFn: (a) =>
            Math.cos(a - ang) < -0.15 ? cRgb(0x3a332f) : cRgb(sideHex),
        },
      ],
      {
        sides: 4,
        twist: ang + 0.35,
        capTop: [sx, h, sz, cRgb(topHex)],
      }
    );
  }

  // Split 4-sided firewood log leaning across the stones into the central coals
  addSpineLoft(
    L,
    [
      {
        p: [2.75, 0.36, 0.52],
        ru: 0.44,
        rv: 0.48,
        colorFn: (a) => (Math.cos(a) > 0.2 ? splitWood : barkDark),
      },
      {
        p: [1.35, 0.96, 0.16],
        ru: 0.41,
        rv: 0.44,
        colorFn: (a) => (Math.cos(a) > 0.2 ? cRgb(0xc29963) : barkDark),
      },
      {
        p: [0.38, 1.52, -0.14],
        ru: 0.34,
        rv: 0.36,
        colorFn: () => charBlack,
      },
    ],
    {
      sides: 4,
      capStart: [2.98, 0.28, 0.58, splitWood],
      capEnd: [0.14, 1.66, -0.22, emberTip],
    }
  );

  // 5 lean 3-sided flickering flame tongues (no hidden bottom caps)
  const flameWhite = cRgb(0xfff5ad);
  const flameGold = cRgb(0xffad24);
  const flameOrange = cRgb(0xff4f0a);
  const flameCrimson = cRgb(0xd92b04);

  const tongues = [
    {
      x: 0,
      y0: -0.25,
      z: 0,
      r: 0.92,
      h: 3.15,
      leanX: 0.08,
      leanZ: -0.06,
      cBase: flameWhite,
      cMid: flameGold,
      cTip: flameOrange,
    },
    {
      x: -0.58,
      y0: -0.2,
      z: 0.42,
      r: 0.72,
      h: 2.35,
      leanX: 0.18,
      leanZ: -0.12,
      cBase: flameGold,
      cMid: flameOrange,
      cTip: flameCrimson,
    },
    {
      x: 0.62,
      y0: -0.2,
      z: 0.36,
      r: 0.68,
      h: 2.2,
      leanX: -0.2,
      leanZ: -0.1,
      cBase: flameGold,
      cMid: flameOrange,
      cTip: flameCrimson,
    },
    {
      x: 0.04,
      y0: -0.2,
      z: -0.64,
      r: 0.7,
      h: 2.28,
      leanX: -0.06,
      leanZ: 0.22,
      cBase: flameGold,
      cMid: flameOrange,
      cTip: flameCrimson,
    },
    {
      x: -0.36,
      y0: -0.15,
      z: -0.34,
      r: 0.54,
      h: 1.75,
      leanX: 0.14,
      leanZ: 0.12,
      cBase: flameWhite,
      cMid: flameGold,
      cTip: flameOrange,
    },
  ];
  for (const t of tongues) {
    addVerticalLoft(
      F,
      [
        {cx: t.x, cy: t.y0, cz: t.z, rx: t.r, colorFn: () => t.cBase},
        {
          cx: t.x + t.leanX * 0.5,
          cy: t.y0 + t.h * 0.48,
          cz: t.z + t.leanZ * 0.5,
          rx: t.r * 0.58,
          colorFn: () => t.cMid,
        },
      ],
      {
        sides: 3,
        twist: t.x * 1.9 + t.z,
        capTop: [t.x + t.leanX, t.y0 + t.h, t.z + t.leanZ, t.cTip],
      }
    );
  }

  return {
    fireLogGeo: L.build(),
    fireCoreGeo: F.build(),
  };
}
