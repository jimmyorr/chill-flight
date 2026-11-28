// --- TOWN PLAZA MODELS ---
// Civic plazas and signature Polyfork centerpieces for the five market towns
// west of Crossroads (Millbrook, Oakridge, Clearwater, Westgate, Redstone),
// each set on a stepped stone or timber town square with perimeter dusk
// bollards and two-band LOD support (pyramids.js, debug-models.js).
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {buildingMesh, ferrisGlowMat} from './building-models.js';
import * as windSpinner from './third-party/polyfork/oil-drum-wind-spinner-7c1a9d.mjs';
import * as clockTower from './third-party/polyfork/clock-tower-752081.mjs';
import * as promenadeBandstand from './third-party/polyfork/promenade-bandstand-1a71b5.mjs';
import * as tieredFountain from './third-party/polyfork/lobby-tiered-fountain-354424.mjs';
import * as glassConservatory from './third-party/polyfork/glass-conservatory-a938d5.mjs';
import * as airshipTender from './third-party/polyfork/lighter-than-air-tender-0c7361.mjs';
import * as copperDome from './third-party/polyfork/copper-dome-dwelling-dc8848.mjs';
import * as mineHeadframe from './third-party/polyfork/mine-headframe-735cf4.mjs';

const TAU = Math.PI * 2;

export const MILLBROOK_COLORWAYS = [
  'mint-oxide',
  'barn-red',
  'seafoam-slate',
  'cream-brass',
];
export const OAKRIDGE_COLORWAYS = [
  'sandstone-slate',
  'as-founded',
  'zinc-timber',
  'weathered-grey',
];
export const CLEARWATER_COLORWAYS = [
  'seafoam-brass',
  'mint-iron',
  'cream-copper',
  'barn-red',
];
export const WESTGATE_COLORWAYS = [
  'cream-mint',
  'seafoam-copper',
  'verdigris',
  'barn-red',
];
export const REDSTONE_COLORWAYS = [
  'pine-and-rust',
  'new-strike',
  'silvered-old-workings',
  'tarred-timber',
];

// Translucent glazing for Clearwater's botanical glasshouse: cool solar blue
// in daylight so interior foliage shows through, warming to amber lamplight at
// dusk (updated alongside ferrisGlowMat in game-loop.js).
export const conservatoryGlassMat = createMaterial({
  color: 0x3b7ca8,
  emissive: 0xffb866,
  emissiveIntensity: 0,
  transparent: true,
  opacity: 0.46,
  roughness: 0.25,
  flatShading: true,
  side: THREE.DoubleSide,
});

function pushTri(pos, col, a, b, c, color) {
  pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) col.push(color.r, color.g, color.b);
}

// Quad wound counter-clockwise when viewed from outside along a -> b -> c -> d
function pushQuad(pos, col, a, b, c, d, color) {
  pushTri(pos, col, a, b, c, color);
  pushTri(pos, col, a, c, d, color);
}

function pushBox(pos, col, x0, y0, z0, x1, y1, z1, color) {
  // Top & bottom
  pushQuad(
    pos,
    col,
    [x0, y1, z1],
    [x1, y1, z1],
    [x1, y1, z0],
    [x0, y1, z0],
    color
  );
  // Front (+z), back (-z), right (+x), left (-x)
  pushQuad(
    pos,
    col,
    [x0, y0, z1],
    [x1, y0, z1],
    [x1, y1, z1],
    [x0, y1, z1],
    color
  );
  pushQuad(
    pos,
    col,
    [x1, y0, z0],
    [x0, y0, z0],
    [x0, y1, z0],
    [x1, y1, z0],
    color
  );
  pushQuad(
    pos,
    col,
    [x1, y0, z1],
    [x1, y0, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    color
  );
  pushQuad(
    pos,
    col,
    [x0, y0, z0],
    [x0, y0, z1],
    [x0, y1, z1],
    [x0, y1, z0],
    color
  );
}

function pushOctaBulb(pos, col, cx, cy, cz, r, rxz, color) {
  const top = [cx, cy + r, cz];
  const bot = [cx, cy - r, cz];
  const ring = [
    [cx + rxz, cy, cz],
    [cx, cy, cz - rxz],
    [cx - rxz, cy, cz],
    [cx, cy, cz + rxz],
  ];
  for (let k = 0; k < 4; k++) {
    const p0 = ring[k];
    const p1 = ring[(k + 1) % 4];
    pushTri(pos, col, top, p1, p0, color);
    pushTri(pos, col, bot, p0, p1, color);
  }
}

function buildBufferGeo(pos, col) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const _tmpCol = new THREE.Color();
const _tmpVec = new THREE.Vector3();

// Extracts triangles from a Three.js object/mesh hierarchy into non-indexed
// vertex-coloured geometry, optionally filtering by hex colour or mesh predicate.
function extractAssetGeo(
  root,
  scale,
  {keepHex = null, skipMesh = null, sinkBottom = 0, offsetY = 0} = {}
) {
  root.updateMatrixWorld(true);
  const invRoot = root.matrixWorld.clone().invert();
  const pos = [];
  const col = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (skipMesh && skipMesh(o)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = g.attributes.position;
    const c = g.attributes.color;
    const localMat = invRoot.clone().multiply(o.matrixWorld);
    for (let t = 0; t < p.count; t += 3) {
      if (keepHex) {
        const hex = c ? _tmpCol.fromBufferAttribute(c, t).getHexString() : '';
        if (!keepHex(hex, o)) continue;
      }
      for (let i = t; i < t + 3; i++) {
        _tmpVec.fromBufferAttribute(p, i).applyMatrix4(localMat);
        const y =
          sinkBottom > 0 && _tmpVec.y <= 1e-3
            ? -sinkBottom
            : _tmpVec.y * scale + offsetY;
        pos.push(_tmpVec.x * scale, y, _tmpVec.z * scale);
        if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
        else col.push(1, 1, 1);
      }
    }
  });
  return buildBufferGeo(pos, col);
}

// Stepped 16-sided civic plaza plinth with a buried skirt (-2.8 units), outer
// stone/timber kerb, +z entrance steps facing the crossing, and perimeter
// cast-iron bollard lanterns whose globes append to glowPos/glowCol.
function appendCivicPlazaBase(
  pos,
  col,
  glowPos,
  glowCol,
  {
    radius = 44,
    topY = 0.36,
    sides = 16,
    kerbWidth = 2.8,
    kerbHex = '#d5cec0',
    skirtHex = '#8d8579',
    deckHexA = '#bfb4a0',
    deckHexB = '#b3a792',
    stepWidth = 11,
    bollards = 8,
    bulbHex = '#ffd27d',
  } = {}
) {
  const kerbCol = new THREE.Color(kerbHex);
  const skirtCol = new THREE.Color(skirtHex);
  const deckA = new THREE.Color(deckHexA);
  const deckB = new THREE.Color(deckHexB);
  const ironCol = new THREE.Color('#3b3e42');
  const bulbCol = new THREE.Color(bulbHex);
  const innerR = radius - kerbWidth;
  const skirtBottom = -2.8;
  const kerbTop = topY + 0.18;

  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * TAU;
    const a1 = ((i + 1) / sides) * TAU;
    const x0o = Math.sin(a0) * radius;
    const z0o = Math.cos(a0) * radius;
    const x1o = Math.sin(a1) * radius;
    const z1o = Math.cos(a1) * radius;
    const x0i = Math.sin(a0) * innerR;
    const z0i = Math.cos(a0) * innerR;
    const x1i = Math.sin(a1) * innerR;
    const z1i = Math.cos(a1) * innerR;

    // Outer foundation skirt
    pushQuad(
      pos,
      col,
      [x0o, skirtBottom, z0o],
      [x1o, skirtBottom, z1o],
      [x1o, kerbTop, z1o],
      [x0o, kerbTop, z0o],
      skirtCol
    );
    // Kerb top ring
    pushQuad(
      pos,
      col,
      [x0i, kerbTop, z0i],
      [x0o, kerbTop, z0o],
      [x1o, kerbTop, z1o],
      [x1i, kerbTop, z1i],
      kerbCol
    );
    // Inner kerb lip down to deck
    pushQuad(
      pos,
      col,
      [x1i, topY, z1i],
      [x0i, topY, z0i],
      [x0i, kerbTop, z0i],
      [x1i, kerbTop, z1i],
      kerbCol
    );
    // Radial paving sector
    pushTri(
      pos,
      col,
      [0, topY, 0],
      [x0i, topY, z0i],
      [x1i, topY, z1i],
      i % 2 === 0 ? deckA : deckB
    );
  }

  // Front entrance steps at +z (facing the highway crossing)
  const hw = stepWidth * 0.5;
  pushBox(
    pos,
    col,
    -hw,
    skirtBottom,
    radius - 1.2,
    hw,
    topY * 0.65,
    radius + 2.4,
    kerbCol
  );
  pushBox(
    pos,
    col,
    -hw * 0.92,
    skirtBottom,
    radius + 2.2,
    hw * 0.92,
    0.05,
    radius + 4.8,
    skirtCol
  );

  // Perimeter bollard lamps (skipping the +z front entrance opening)
  const bollardR = radius - kerbWidth * 0.5;
  for (let b = 0; b < bollards; b++) {
    const ang = ((b + 0.5) / bollards) * TAU;
    if (Math.cos(ang) > 0.88) continue;
    const bx = Math.sin(ang) * bollardR;
    const bz = Math.cos(ang) * bollardR;
    pushBox(
      pos,
      col,
      bx - 0.36,
      kerbTop,
      bz - 0.36,
      bx + 0.36,
      kerbTop + 3.1,
      bz + 0.36,
      ironCol
    );
    pushBox(
      pos,
      col,
      bx - 0.56,
      kerbTop + 3.85,
      bz - 0.56,
      bx + 0.56,
      kerbTop + 4.08,
      bz + 0.56,
      ironCol
    );
    pushOctaBulb(glowPos, glowCol, bx, kerbTop + 3.48, bz, 0.48, 0.44, bulbCol);
  }
}

// --- 1. MILLBROOK: GIANT FOLK-ART WIND-SPINNER PLAZA ---
// ~88 units tall (almost 2x the 45-unit farm stone windmill), turned into the
// breeze on a stepped octagonal millstone plinth with a 38-unit 10-petal
// painted rotor and dusk hub/petal lantern bulbs.
const SPINNER_SCALE = 11.2;
const SPINNER_DIAL_HEX = new THREE.Color('#ffe6b0').getHexString();
const _millbrookGeos = new Map();

function buildMillbrookGeos(colorway = 'mint-oxide') {
  if (_millbrookGeos.has(colorway)) return _millbrookGeos.get(colorway);
  const asset = windSpinner.createAsset({
    colorway,
    wear: 'kept',
    tallness: 4,
    blades: 10,
    cant: 38,
    gauge: true,
    dial: '#ffe6b0',
  });
  const mastObj = asset.getObjectByName('mast');
  const rotorObj = asset.getObjectByName('rotor');

  const pos = [];
  const col = [];
  const glowPos = [];
  const glowCol = [];
  appendCivicPlazaBase(pos, col, glowPos, glowCol, {
    radius: 43,
    kerbHex: '#d4cab8',
    skirtHex: '#847b6e',
    deckHexA: '#bcb09c',
    deckHexB: '#afa28d',
    bollards: 8,
  });

  // 10-spoke cobblestone pinwheel mosaic radiating across the square
  const rayWarm = new THREE.Color('#cfa56a');
  const rayCool = new THREE.Color('#6aa693');
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    const aL = a - 0.09;
    const aR = a + 0.14;
    pushTri(
      pos,
      col,
      [Math.sin(aL) * 13.8, 0.41, Math.cos(aL) * 13.8],
      [Math.sin(a) * 34.5, 0.41, Math.cos(a) * 34.5],
      [Math.sin(aR) * 13.8, 0.41, Math.cos(aR) * 13.8],
      k % 2 === 0 ? rayWarm : rayCool
    );
  }

  // Stepped 8-sided stone millstone plinth under the lattice mast (y = 0.36 -> 2.15)
  const plinthLo = new THREE.Color('#cfc6b4');
  const plinthHi = new THREE.Color('#dfd7c7');
  const trimBrass = new THREE.Color('#c89a42');
  for (const [r, y0, y1, c] of [
    [13.6, 0.36, 1.3, plinthLo],
    [10.4, 1.3, 2.15, plinthHi],
  ]) {
    for (let i = 0; i < 8; i++) {
      const a0 = ((i + 0.5) / 8) * TAU;
      const a1 = ((i + 1.5) / 8) * TAU;
      const x0 = Math.sin(a0) * r;
      const z0 = Math.cos(a0) * r;
      const x1 = Math.sin(a1) * r;
      const z1 = Math.cos(a1) * r;
      pushQuad(
        pos,
        col,
        [x0, y0, z0],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z0],
        c
      );
      pushTri(pos, col, [0, y1, 0], [x0, y1, z0], [x1, y1, z1], c);
    }
  }
  const lanternBulb = new THREE.Color('#ffd27d');
  for (let k = 0; k < 4; k++) {
    const a = ((k + 0.5) / 4) * TAU;
    const lx = Math.sin(a) * 11.8;
    const lz = Math.cos(a) * 11.8;
    pushBox(
      pos,
      col,
      lx - 0.45,
      1.3,
      lz - 0.45,
      lx + 0.45,
      2.55,
      lz + 0.45,
      trimBrass
    );
    pushOctaBulb(glowPos, glowCol, lx, 2.95, lz, 0.52, 0.48, lanternBulb);
  }

  // Dusk carnival/lantern bulbs mounted on the spinning 10-blade rotor
  const rotorGlowPos = [];
  const rotorGlowCol = [];
  const bulbWarm = new THREE.Color('#ffbe5c');
  const bulbCool = new THREE.Color('#7fe8d4');
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    const c = k % 2 === 0 ? bulbWarm : bulbCool;
    pushOctaBulb(
      rotorGlowPos,
      rotorGlowCol,
      Math.cos(a) * 15.6,
      Math.sin(a) * 15.6,
      1.6,
      0.56,
      0.52,
      c
    );
    pushOctaBulb(
      rotorGlowPos,
      rotorGlowCol,
      Math.cos(a) * 5.8,
      Math.sin(a) * 5.8,
      3.1,
      0.44,
      0.42,
      bulbWarm
    );
  }

  const out = {
    plazaBase: buildBufferGeo(pos, col),
    plazaGlow: buildBufferGeo(glowPos, glowCol),
    mastBody: extractAssetGeo(mastObj, SPINNER_SCALE, {
      keepHex: (hex) => hex !== SPINNER_DIAL_HEX,
      sinkBottom: 0.45,
    }),
    mastGlow: extractAssetGeo(mastObj, SPINNER_SCALE, {
      keepHex: (hex) => hex === SPINNER_DIAL_HEX,
    }),
    rotorPivot: rotorObj.position.clone().multiplyScalar(SPINNER_SCALE),
    rotorBody: extractAssetGeo(rotorObj, SPINNER_SCALE),
    rotorGlow: buildBufferGeo(rotorGlowPos, rotorGlowCol),
  };
  _millbrookGeos.set(colorway, out);
  return out;
}

export function millbrookPlazaGroup(
  colorway = 'mint-oxide',
  {detail = true} = {}
) {
  const geos = buildMillbrookGeos(colorway);
  const group = new THREE.Group();
  group.name = 'millbrook-plaza';
  group.add(buildingMesh(geos.plazaBase));
  group.add(new THREE.Mesh(geos.plazaGlow, ferrisGlowMat));

  const turret = new THREE.Group();
  turret.position.set(0, 2.15, 0);
  turret.add(buildingMesh(geos.mastBody));
  turret.add(new THREE.Mesh(geos.mastGlow, ferrisGlowMat));

  const rotorNode = new THREE.Group();
  rotorNode.position.copy(geos.rotorPivot);
  rotorNode.add(buildingMesh(geos.rotorBody));
  if (detail) {
    rotorNode.add(new THREE.Mesh(geos.rotorGlow, ferrisGlowMat));
  }
  turret.add(rotorNode);
  group.add(turret);
  // What can be knocked over (pyramids.js hands these to breakables.js)
  group.userData.breakParts = [{parts: [[turret, 'fold']], rubble: 10}];

  group.userData.animatePlaza = ({
    timeSec,
    windTimeSec = timeSec,
    windStrength = 0.7,
    windYaw = 0,
    parentYaw = 0,
  }) => {
    // (timeSec is already wrapped to a day: wrapping it again here made the
    // sways jump once an hour)
    const t = timeSec;
    const vaneSway = Math.sin(t * 0.28) * 0.06 * (0.5 + windStrength * 0.5);
    turret.rotation.y = windYaw + Math.PI - parentYaw + vaneSway;
    // ~26 s per full revolution in a fair breeze (~4.6 units/s rim speed)
    rotorNode.rotation.z = (windTimeSec * 0.24) % TAU;
  };
  return group;
}

// --- 2. OAKRIDGE: LIVE CIVIC CLOCK TOWER & PROMENADE BANDSTAND ---
const CLOCK_SCALE = 5.3;
const BANDSTAND_SCALE = 4.0;
const CLOCK_DIAL_HEX = new THREE.Color('#fff3d1').getHexString();
const BANDSTAND_LIT_HEX = new THREE.Color('#ffd484').getHexString();
const _oakridgeGeos = new Map();

const CLOCK_FACES = [
  {side: 'front', axis: 'z', sign: -1},
  {side: 'right', axis: 'x', sign: -1},
  {side: 'back', axis: 'z', sign: 1},
  {side: 'left', axis: 'x', sign: 1},
];

function buildOakridgeGeos(colorway = 'sandstone-slate') {
  if (_oakridgeGeos.has(colorway)) return _oakridgeGeos.get(colorway);
  const tower = clockTower.createAsset({
    colorway,
    storeys: 4,
    founded: '1890',
    dial: '#fff3d1',
  });
  const towerBodyMesh = tower.getObjectByName('clock-tower-body');
  const bandColorway =
    colorway === 'weathered-grey'
      ? 'harbour'
      : colorway === 'zinc-timber'
        ? 'promenade'
        : 'sea-green';
  const band = promenadeBandstand.createAsset({
    colorway: bandColorway,
    entrance: 'two',
    lit: '#ffd484',
  });

  const pos = [];
  const col = [];
  const glowPos = [];
  const glowCol = [];
  appendCivicPlazaBase(pos, col, glowPos, glowCol, {
    radius: 45,
    kerbHex: '#d6cfc1',
    skirtHex: '#878073',
    deckHexA: '#6ca142',
    deckHexB: '#63963b',
    bollards: 8,
  });

  // Sandstone outer promenade ring, tower plinth, & connecting diagonal walk
  const walkCol = new THREE.Color('#cbc0ac');
  const plinthCol = new THREE.Color('#dcd4c4');
  const outerWalkIn = 36.5;
  const outerWalkOut = 42.1;
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * TAU;
    const a1 = ((i + 1) / 16) * TAU;
    pushQuad(
      pos,
      col,
      [Math.sin(a0) * outerWalkIn, 0.4, Math.cos(a0) * outerWalkIn],
      [Math.sin(a0) * outerWalkOut, 0.4, Math.cos(a0) * outerWalkOut],
      [Math.sin(a1) * outerWalkOut, 0.4, Math.cos(a1) * outerWalkOut],
      [Math.sin(a1) * outerWalkIn, 0.4, Math.cos(a1) * outerWalkIn],
      walkCol
    );
  }
  // Paved promenade from front entrance (+z) across to clock tower & bandstand
  pushBox(pos, col, -4.5, 0.36, -6, 4.5, 0.43, 40, walkCol);
  pushBox(pos, col, -20, 0.36, -13, 18, 0.43, -4, walkCol);
  pushBox(pos, col, -24, 0.36, -19, -5, 0.85, 0, plinthCol);

  const hands = CLOCK_FACES.map(({side, axis, sign}) => {
    const hr = tower.getObjectByName(`hour-hand-${side}`);
    const mn = tower.getObjectByName(`minute-hand-${side}`);
    return {
      axis,
      sign,
      hourPivot: hr.position.clone().multiplyScalar(CLOCK_SCALE),
      hourGeo: extractAssetGeo(hr, CLOCK_SCALE),
      minPivot: mn.position.clone().multiplyScalar(CLOCK_SCALE),
      minGeo: extractAssetGeo(mn, CLOCK_SCALE),
    };
  });

  const out = {
    plazaBase: buildBufferGeo(pos, col),
    plazaGlow: buildBufferGeo(glowPos, glowCol),
    towerBody: extractAssetGeo(towerBodyMesh, CLOCK_SCALE, {
      keepHex: (hex) => hex !== CLOCK_DIAL_HEX,
      sinkBottom: 0.4,
    }),
    towerDials: extractAssetGeo(towerBodyMesh, CLOCK_SCALE, {
      keepHex: (hex) => hex === CLOCK_DIAL_HEX,
    }),
    hands,
    bandBody: extractAssetGeo(band, BANDSTAND_SCALE, {
      keepHex: (hex) => hex !== BANDSTAND_LIT_HEX,
      sinkBottom: 0.4,
    }),
    bandGlow: extractAssetGeo(band, BANDSTAND_SCALE, {
      keepHex: (hex) => hex === BANDSTAND_LIT_HEX,
    }),
  };
  _oakridgeGeos.set(colorway, out);
  return out;
}

export function oakridgePlazaGroup(
  colorway = 'sandstone-slate',
  {detail = true} = {}
) {
  const geos = buildOakridgeGeos(colorway);
  const group = new THREE.Group();
  group.name = 'oakridge-plaza';
  group.add(buildingMesh(geos.plazaBase));
  group.add(new THREE.Mesh(geos.plazaGlow, ferrisGlowMat));

  const towerGroup = new THREE.Group();
  towerGroup.position.set(-14.5, 0.85, -9.5);
  towerGroup.add(buildingMesh(geos.towerBody));
  towerGroup.add(new THREE.Mesh(geos.towerDials, ferrisGlowMat));

  const handPairs = [];
  if (detail) {
    for (const h of geos.hands) {
      const hrGroup = new THREE.Group();
      hrGroup.position.copy(h.hourPivot);
      hrGroup.add(buildingMesh(h.hourGeo));
      towerGroup.add(hrGroup);

      const mnGroup = new THREE.Group();
      mnGroup.position.copy(h.minPivot);
      mnGroup.add(buildingMesh(h.minGeo));
      towerGroup.add(mnGroup);
      handPairs.push({axis: h.axis, sign: h.sign, hrGroup, mnGroup});
    }
  }
  group.add(towerGroup);

  const bandGroup = new THREE.Group();
  bandGroup.position.set(13.5, 0.36, 6.5);
  bandGroup.add(buildingMesh(geos.bandBody));
  bandGroup.add(new THREE.Mesh(geos.bandGlow, ferrisGlowMat));
  group.add(bandGroup);
  group.userData.breakParts = [
    {parts: [[towerGroup, 'fold']], rubble: 16},
    {parts: [[bandGroup, 'fold']], rubble: 10},
  ];

  group.userData.animatePlaza = ({dayProgress = 0.5}) => {
    if (!detail) return;
    // Polyfork's hour hand is authored pointing down (-y, 6 o'clock) while its
    // minute hand points up (+y, 12 o'clock); +PI aligns both to 12 at noon.
    const hourAngle = dayProgress * 2 * TAU + Math.PI;
    const minAngle = dayProgress * 24 * TAU;
    for (let i = 0; i < handPairs.length; i++) {
      const p = handPairs[i];
      p.hrGroup.rotation[p.axis] = p.sign * hourAngle;
      p.mnGroup.rotation[p.axis] = p.sign * minAngle;
    }
  };
  return group;
}

// --- 3. CLEARWATER: THREE-TIER FOUNTAIN & GLASS CONSERVATORY ---
const FOUNTAIN_SCALE = 8.6;
const CONSERVATORY_SCALE = 8.4;
const CONSERVATORY_LAMP_HEX = new THREE.Color('#ffb85c').getHexString();
const _clearwaterGeos = new Map();

function buildClearwaterGeos(colorway = 'seafoam-brass') {
  if (_clearwaterGeos.has(colorway)) return _clearwaterGeos.get(colorway);
  const ftnColorway =
    colorway === 'barn-red' ? 'bronze-sapphire' : 'lobby-gold';
  const ftn = tieredFountain.createAsset({
    colorway: ftnColorway,
    tiers: 3,
    tallness: 1,
    running: true,
    water: '#52caf5',
  });
  const cons = glassConservatory.createAsset({
    colorway,
    wear: 'kept',
    storeys: 3,
    bays: 6,
    archRise: 1.4,
    lamp: '#ffb85c',
  });

  const pos = [];
  const col = [];
  const glowPos = [];
  const glowCol = [];
  appendCivicPlazaBase(pos, col, glowPos, glowCol, {
    radius: 45,
    kerbHex: '#e4dfd4',
    skirtHex: '#8d969d',
    deckHexA: '#d7d2c7',
    deckHexB: '#c5cdd2',
    bollards: 8,
  });

  // Flanking stone-kerbed parterre flowerbeds beside the central fountain court
  const hedgeKerb = new THREE.Color('#e6e1d7');
  const hedgeGreen = new THREE.Color('#528e3a');
  const bloomA = new THREE.Color('#5ad8ff');
  const bloomB = new THREE.Color('#f48b7b');
  for (const sx of [-1, 1]) {
    const x0 = sx * 21.5;
    const x1 = sx * 30.5;
    const xa = Math.min(x0, x1);
    const xb = Math.max(x0, x1);
    pushBox(pos, col, xa, 0.36, -18, xb, 1.15, 18, hedgeKerb);
    pushBox(pos, col, xa + 0.7, 1.15, -17.3, xb - 0.7, 1.65, 17.3, hedgeGreen);
    for (let bz = -13; bz <= 13; bz += 6.5) {
      pushBox(
        pos,
        col,
        xa + 2.2,
        1.65,
        bz - 0.8,
        xb - 2.2,
        2.0,
        bz + 0.8,
        Math.abs(bz) > 7 ? bloomA : bloomB
      );
    }
  }

  // Soft underwater uplight gems around the fountain's octagonal rim
  const aquaGlow = new THREE.Color('#66dcff');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    pushOctaBulb(
      glowPos,
      glowCol,
      Math.sin(a) * 11.2,
      4.9,
      13.5 + Math.cos(a) * 11.2,
      0.42,
      0.55,
      aquaGlow
    );
  }

  const ftnStone = ftn.getObjectByName('fountain');
  const ftnPools = ftn.getObjectByName('pools');
  const flows = [0, 1, 2].map((idx) => {
    const fo = ftn.getObjectByName(`flow-${idx}`);
    return {
      pivotY: fo.position.y * FOUNTAIN_SCALE,
      geo: extractAssetGeo(fo, FOUNTAIN_SCALE),
    };
  });

  // Crown water-jet plume above the fountain finial
  const plumePos = [];
  const plumeCol = [];
  pushOctaBulb(
    plumePos,
    plumeCol,
    0,
    0,
    0,
    1.8,
    0.95,
    new THREE.Color('#aef0ff')
  );

  const isGlazing = (o) => o.name === 'glazing' || o.name === 'door-glazing';
  const out = {
    plazaBase: buildBufferGeo(pos, col),
    plazaGlow: buildBufferGeo(glowPos, glowCol),
    ftnBase: extractAssetGeo(ftnStone, FOUNTAIN_SCALE, {sinkBottom: 0.4}),
    ftnPools: extractAssetGeo(ftnPools, FOUNTAIN_SCALE),
    flows,
    plumeGeo: buildBufferGeo(plumePos, plumeCol),
    consShell: extractAssetGeo(cons, CONSERVATORY_SCALE, {
      skipMesh: isGlazing,
      keepHex: (hex) => hex !== CONSERVATORY_LAMP_HEX,
      sinkBottom: 0.4,
    }),
    consLamp: extractAssetGeo(cons, CONSERVATORY_SCALE, {
      skipMesh: isGlazing,
      keepHex: (hex) => hex === CONSERVATORY_LAMP_HEX,
    }),
    consGlass: extractAssetGeo(cons, CONSERVATORY_SCALE, {
      keepHex: (_hex, o) => isGlazing(o),
    }),
  };
  _clearwaterGeos.set(colorway, out);
  return out;
}

export function clearwaterPlazaGroup(
  colorway = 'seafoam-brass',
  {detail = true} = {}
) {
  const geos = buildClearwaterGeos(colorway);
  const group = new THREE.Group();
  group.name = 'clearwater-plaza';
  group.add(buildingMesh(geos.plazaBase));
  group.add(new THREE.Mesh(geos.plazaGlow, ferrisGlowMat));

  const ftnGroup = new THREE.Group();
  ftnGroup.position.set(0, 0.36, 13.5);
  ftnGroup.add(buildingMesh(geos.ftnBase));
  ftnGroup.add(buildingMesh(geos.ftnPools));

  const flowNodes = [];
  for (const f of geos.flows) {
    const fg = new THREE.Group();
    fg.position.y = f.pivotY;
    const fm = new THREE.Mesh(f.geo, ferrisGlowMat);
    fg.add(fm);
    ftnGroup.add(fg);
    flowNodes.push(fg);
  }
  let plume = null;
  if (detail) {
    plume = new THREE.Mesh(geos.plumeGeo, ferrisGlowMat);
    plume.position.y = 3.35 * FOUNTAIN_SCALE;
    ftnGroup.add(plume);
  }
  group.add(ftnGroup);

  const consGroup = new THREE.Group();
  consGroup.position.set(0, 0.36, -15.0);
  consGroup.add(buildingMesh(geos.consShell));
  consGroup.add(new THREE.Mesh(geos.consLamp, ferrisGlowMat));
  const glassMesh = new THREE.Mesh(geos.consGlass, conservatoryGlassMat);
  glassMesh.receiveShadow = true;
  consGroup.add(glassMesh);
  group.add(consGroup);
  group.userData.breakParts = [
    {parts: [[ftnGroup, 'fold']], rubble: 8},
    {parts: [[consGroup, 'fold']], rubble: 16},
  ];

  group.userData.animatePlaza = ({timeSec}) => {
    if (!detail) return;
    // (timeSec is already wrapped to a day: wrapping it again here made the
    // sways jump once an hour)
    const t = timeSec;
    for (let i = 0; i < flowNodes.length; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      flowNodes[i].rotation.y = (t * (0.8 + i * 0.3) * dir) % TAU;
      const pulse = 1 + 0.045 * Math.sin(t * 4.2 + i * 1.4);
      flowNodes[i].scale.set(pulse, 1, pulse);
    }
    if (plume) {
      const s = 0.92 + 0.16 * Math.sin(t * 5.1);
      plume.scale.set(1, s, 1);
    }
  };
  return group;
}

// --- 4. WESTGATE: COPPER MOORING DOME & WIND-TETHERED AIRSHIP ---
const DOME_SCALE = 5.5;
const AIRSHIP_SCALE = 10.2;
const DOME_GLOW_HEXES = new Set([
  new THREE.Color('#ffc878').getHexString(),
  new THREE.Color('#ffb454').getHexString(),
]);
const AIRSHIP_GLOW_HEXES = new Set([
  new THREE.Color('#ffb454').getHexString(),
  new THREE.Color('#7fe0c8').getHexString(),
]);
const _westgateGeos = new Map();

function buildUnitCableGeo(radius, colorHex) {
  const pos = [];
  const col = [];
  const c = new THREE.Color(colorHex);
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * TAU;
    const a1 = ((i + 1) / segs) * TAU;
    const x0 = Math.cos(a0) * radius;
    const y0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius;
    const y1 = Math.sin(a1) * radius;
    pushQuad(pos, col, [x0, y0, 0], [x1, y1, 0], [x1, y1, 1], [x0, y0, 1], c);
  }
  return buildBufferGeo(pos, col);
}

function buildWestgateGeos(colorway = 'cream-mint') {
  if (_westgateGeos.has(colorway)) return _westgateGeos.get(colorway);
  const domeColorway =
    colorway === 'seafoam-copper'
      ? 'seafoam-verdigris'
      : colorway === 'verdigris'
        ? 'cream-brass'
        : colorway === 'barn-red'
          ? 'barn-red'
          : 'mint-copper';
  const dome = copperDome.createAsset({
    colorway: domeColorway,
    floors: 2,
    partyWalls: false,
    door: 'glazed',
    wear: 'kept',
    lantern: true,
    glass: '#ffc878',
    lamp: '#ffb454',
  });
  const ship = airshipTender.createAsset({
    colorway,
    wear: 'kept',
    bagLength: 1.15,
    girth: 1.08,
    lamp: '#ffb454',
    dial: '#7fe0c8',
  });

  const pos = [];
  const col = [];
  const glowPos = [];
  const glowCol = [];
  appendCivicPlazaBase(pos, col, glowPos, glowCol, {
    radius: 44,
    kerbHex: '#d5c7b0',
    skirtHex: '#7d7568',
    deckHexA: '#c4b49b',
    deckHexB: '#b7a68d',
    bollards: 8,
  });

  // Inlaid 8-point brass & verdigris compass rose around the mooring dome
  const compassBrass = new THREE.Color('#cfa044');
  const compassVerd = new THREE.Color('#4a9481');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU;
    const aL = a - 0.14;
    const aR = a + 0.14;
    const rTip = k % 2 === 0 ? 35.5 : 27.5;
    pushTri(
      pos,
      col,
      [0, 0.41, -3],
      [Math.sin(aL) * 14, 0.41, -3 + Math.cos(aL) * 14],
      [Math.sin(a) * rTip, 0.41, -3 + Math.cos(a) * rTip],
      k % 2 === 0 ? compassBrass : compassVerd
    );
    pushTri(
      pos,
      col,
      [0, 0.41, -3],
      [Math.sin(a) * rTip, 0.41, -3 + Math.cos(a) * rTip],
      [Math.sin(aR) * 14, 0.41, -3 + Math.cos(aR) * 14],
      k % 2 === 0 ? compassVerd : compassBrass
    );
  }

  // Brass mooring mast rising above the copper dome's finial (y = 50.5 -> 58.0)
  const domeTopY = 9.15 * DOME_SCALE;
  const mastTopY = domeTopY + 7.5;
  pushBox(
    pos,
    col,
    -0.42,
    0.36 + domeTopY - 1.2,
    -3 - 0.42,
    0.42,
    0.36 + mastTopY,
    -3 + 0.42,
    compassBrass
  );
  pushOctaBulb(
    glowPos,
    glowCol,
    0,
    0.36 + mastTopY + 0.55,
    -3,
    0.65,
    0.65,
    new THREE.Color('#ffbe66')
  );

  const domeHouse = dome.getObjectByName('house');
  const valveMount = dome.getObjectByName('valve-mount');
  const propSwivel = ship.getObjectByName('prop-swivel');
  const propMesh = ship.getObjectByName('prop-mesh');
  const bowLamp = ship.getObjectByName('lamp');
  const isShipDynamic = (o) =>
    o === propMesh ||
    o.parent === bowLamp ||
    o === bowLamp ||
    o.parent === propSwivel;

  const out = {
    plazaBase: buildBufferGeo(pos, col),
    plazaGlow: buildBufferGeo(glowPos, glowCol),
    mastPivotY: 0.36 + mastTopY,
    domeBody: extractAssetGeo(domeHouse, DOME_SCALE, {
      keepHex: (hex) => !DOME_GLOW_HEXES.has(hex),
      sinkBottom: 0.4,
    }),
    domeGlow: extractAssetGeo(domeHouse, DOME_SCALE, {
      keepHex: (hex) => DOME_GLOW_HEXES.has(hex),
    }),
    valvePivot: valveMount.position.clone().multiplyScalar(DOME_SCALE),
    valveGeo: extractAssetGeo(valveMount, DOME_SCALE),
    shipBody: extractAssetGeo(ship, AIRSHIP_SCALE, {
      skipMesh: isShipDynamic,
      keepHex: (hex) => !AIRSHIP_GLOW_HEXES.has(hex),
    }),
    shipDialGlow: extractAssetGeo(ship, AIRSHIP_SCALE, {
      skipMesh: isShipDynamic,
      keepHex: (hex) => AIRSHIP_GLOW_HEXES.has(hex),
    }),
    propPivot: propSwivel.position.clone().multiplyScalar(AIRSHIP_SCALE),
    propGeo: extractAssetGeo(propMesh, AIRSHIP_SCALE),
    lampPivot: bowLamp.position.clone().multiplyScalar(AIRSHIP_SCALE),
    lampBody: extractAssetGeo(bowLamp, AIRSHIP_SCALE, {
      keepHex: (hex) => !AIRSHIP_GLOW_HEXES.has(hex),
    }),
    lampGlow: extractAssetGeo(bowLamp, AIRSHIP_SCALE, {
      keepHex: (hex) => AIRSHIP_GLOW_HEXES.has(hex),
    }),
    cableGeo: buildUnitCableGeo(0.2, '#5a4b3a'),
  };
  _westgateGeos.set(colorway, out);
  return out;
}

export function westgatePlazaGroup(
  colorway = 'cream-mint',
  {detail = true} = {}
) {
  const geos = buildWestgateGeos(colorway);
  const group = new THREE.Group();
  group.name = 'westgate-plaza';
  group.add(buildingMesh(geos.plazaBase));
  group.add(new THREE.Mesh(geos.plazaGlow, ferrisGlowMat));

  const domeGroup = new THREE.Group();
  domeGroup.position.set(0, 0.36, -3);
  domeGroup.add(buildingMesh(geos.domeBody));
  domeGroup.add(new THREE.Mesh(geos.domeGlow, ferrisGlowMat));
  let valveNode = null;
  if (detail) {
    valveNode = new THREE.Group();
    valveNode.position.copy(geos.valvePivot);
    valveNode.add(buildingMesh(geos.valveGeo));
    domeGroup.add(valveNode);
  }
  group.add(domeGroup);

  // Mooring swivel at the masthead: local +z points upwind so the airship
  // trails downwind along -z with its bow (+z) tethered to (0, 0, 0).
  const mooringSwivel = new THREE.Group();
  mooringSwivel.position.set(0, geos.mastPivotY, -3);
  const shipRig = new THREE.Group();
  const baseShipY = 3.0;
  const baseShipZ = -36.5;
  shipRig.position.set(0, baseShipY, baseShipZ);
  shipRig.add(buildingMesh(geos.shipBody));
  shipRig.add(new THREE.Mesh(geos.shipDialGlow, ferrisGlowMat));

  let propSwivel = null;
  let propSpin = null;
  let lampNode = null;
  if (detail) {
    propSwivel = new THREE.Group();
    propSwivel.position.copy(geos.propPivot);
    propSpin = new THREE.Group();
    propSpin.add(buildingMesh(geos.propGeo));
    propSwivel.add(propSpin);
    shipRig.add(propSwivel);

    lampNode = new THREE.Group();
    lampNode.position.copy(geos.lampPivot);
    lampNode.add(buildingMesh(geos.lampBody));
    lampNode.add(new THREE.Mesh(geos.lampGlow, ferrisGlowMat));
    shipRig.add(lampNode);
  }
  mooringSwivel.add(shipRig);

  const cableMesh = buildingMesh(geos.cableGeo);
  cableMesh.castShadow = false;
  mooringSwivel.add(cableMesh);
  group.add(mooringSwivel);
  // The dome and its mast fold; the airship is a prop of its own, thrown
  // off when hit and falls to the ground. Knocking the mast down brings the
  // airship down with it (alsoBreaks); either one cuts the cable (alsoHide)
  group.userData.breakParts = [
    {
      parts: [[domeGroup, 'fold']],
      rubble: 14,
      alsoHide: [cableMesh],
      alsoBreaks: [1],
    },
    {
      parts: [[shipRig, 'fling', {restOnGround: true}]],
      rubble: 8,
      alsoHide: [cableMesh],
    },
  ];

  // Nose cone attachment in shipRig local space (~2.35m up, +2.15m forward)
  const noseLocalY = 2.35 * AIRSHIP_SCALE;
  const noseLocalZ = 2.15 * AIRSHIP_SCALE;
  const updateCable = (bobY) => {
    const dy = baseShipY + bobY + noseLocalY;
    const dz = baseShipZ + noseLocalZ;
    const len = Math.hypot(dy, dz);
    cableMesh.scale.set(1, 1, len);
    cableMesh.rotation.set(-Math.atan2(dy, -dz), Math.PI, 0, 'YXZ');
  };
  updateCable(0);

  group.userData.animatePlaza = ({
    timeSec,
    windTimeSec = timeSec,
    windStrength = 0.7,
    windYaw = 0,
    parentYaw = 0,
  }) => {
    // (timeSec is already wrapped to a day: wrapping it again here made the
    // sways jump once an hour)
    const t = timeSec;
    const wander =
      (Math.sin(t * 0.44) * 0.15 + Math.sin(t * 0.97 + 1.1) * 0.06) *
      (0.6 + windStrength * 0.4);
    mooringSwivel.rotation.y = windYaw + Math.PI - parentYaw + wander;
    const bobY = Math.sin(t * 0.75) * 2.6 + Math.sin(t * 1.53) * 0.75;
    shipRig.position.y = baseShipY + bobY;
    if (detail) {
      shipRig.rotation.z =
        Math.sin(t * 0.88 + 0.4) * 0.055 * (0.5 + windStrength * 0.5);
      shipRig.rotation.x = Math.cos(t * 0.75) * 0.035;
      if (propSpin) propSpin.rotation.z = (windTimeSec * 6.5) % TAU;
      if (propSwivel) propSwivel.rotation.y = Math.sin(t * 0.65) * 0.22;
      if (lampNode) lampNode.rotation.x = Math.sin(t * 1.65) * 0.13;
      if (valveNode) valveNode.rotation.x = (t * 0.5) % TAU;
    }
    updateCable(bobY);
  };
  return group;
}

// --- 5. REDSTONE: SOLO THREE-LIFT TIMBER MINE HEADFRAME ---
// ~88 units tall, centered cleanly on a red-ochre shaft-collar square with a
// narrow-gauge tramway spur, spinning hooded sheave wheel, and hoist bucket.
const HEADFRAME_SCALE = 7.4;
const HEADFRAME_LAMP_HEX = new THREE.Color('#ffca68').getHexString();
const _redstoneGeos = new Map();

function buildRedstoneGeos(colorway = 'pine-and-rust') {
  if (_redstoneGeos.has(colorway)) return _redstoneGeos.get(colorway);
  const hf = mineHeadframe.createAsset({
    colorway,
    lifts: 3,
    hood: true,
    boomtown: 0.75,
    glass: '#ffca68',
  });

  const pos = [];
  const col = [];
  const glowPos = [];
  const glowCol = [];
  appendCivicPlazaBase(pos, col, glowPos, glowCol, {
    radius: 43,
    kerbHex: '#735038',
    skirtHex: '#8c533c',
    deckHexA: '#b4674a',
    deckHexB: '#a45a3f',
    bollards: 8,
    bulbHex: '#ffc96b',
  });

  // Narrow-gauge iron mine rails on timber sleepers leading forward (+z) from the shaft collar
  const sleeperCol = new THREE.Color('#5c412d');
  const railCol = new THREE.Color('#434548');
  const z0 = 9.5;
  const z1 = 35.5;
  for (let s = 0; s <= 10; s++) {
    const mz = z0 + ((z1 - z0) * s) / 10;
    pushQuad(
      pos,
      col,
      [-2.2, 0.45, mz + 0.42],
      [2.2, 0.45, mz + 0.42],
      [2.2, 0.45, mz - 0.42],
      [-2.2, 0.45, mz - 0.42],
      sleeperCol
    );
  }
  for (const rx of [-1.15, 1.15]) {
    pushQuad(
      pos,
      col,
      [rx - 0.18, 0.58, z1],
      [rx + 0.18, 0.58, z1],
      [rx + 0.18, 0.58, z0],
      [rx - 0.18, 0.58, z0],
      railCol
    );
  }

  const hfMesh = hf.getObjectByName('headframe');
  const sheave = hf.getObjectByName('sheave');
  const bucket = hf.getObjectByName('bucket');
  const stores = hf.getObjectByName('stores');

  // Vertical hoist cable unit rod (1 unit along -y)
  const ropePos = [];
  const ropeCol = [];
  pushBox(
    ropePos,
    ropeCol,
    -0.16,
    -1,
    -0.16,
    0.16,
    0,
    0.16,
    new THREE.Color('#3b3936')
  );

  const out = {
    plazaBase: buildBufferGeo(pos, col),
    plazaGlow: buildBufferGeo(glowPos, glowCol),
    hfBody: extractAssetGeo(hfMesh, HEADFRAME_SCALE, {
      keepHex: (hex) => hex !== HEADFRAME_LAMP_HEX,
      sinkBottom: 0.4,
    }),
    hfStores: extractAssetGeo(stores, HEADFRAME_SCALE),
    hfGlow: extractAssetGeo(hfMesh, HEADFRAME_SCALE, {
      keepHex: (hex) => hex === HEADFRAME_LAMP_HEX,
    }),
    sheavePivot: sheave.position.clone().multiplyScalar(HEADFRAME_SCALE),
    sheaveGeo: extractAssetGeo(sheave, HEADFRAME_SCALE),
    bucketGeo: extractAssetGeo(bucket, HEADFRAME_SCALE),
    ropeGeo: buildBufferGeo(ropePos, ropeCol),
  };
  _redstoneGeos.set(colorway, out);
  return out;
}

export function redstonePlazaGroup(
  colorway = 'pine-and-rust',
  {detail = true} = {}
) {
  const geos = buildRedstoneGeos(colorway);
  const group = new THREE.Group();
  group.name = 'redstone-plaza';
  group.add(buildingMesh(geos.plazaBase));
  group.add(new THREE.Mesh(geos.plazaGlow, ferrisGlowMat));

  const hfGroup = new THREE.Group();
  hfGroup.position.set(0, 0.36, -1.5);
  hfGroup.add(buildingMesh(geos.hfBody));
  hfGroup.add(buildingMesh(geos.hfStores));
  hfGroup.add(new THREE.Mesh(geos.hfGlow, ferrisGlowMat));

  const sheaveNode = new THREE.Group();
  sheaveNode.position.copy(geos.sheavePivot);
  sheaveNode.add(buildingMesh(geos.sheaveGeo));
  hfGroup.add(sheaveNode);

  let bucketNode = null;
  let ropeMesh = null;
  const ropeAnchorY = 10.1 * HEADFRAME_SCALE;
  const bucketBailBaseY = 2.02 * HEADFRAME_SCALE;
  if (detail) {
    bucketNode = buildingMesh(geos.bucketGeo);
    hfGroup.add(bucketNode);
    ropeMesh = buildingMesh(geos.ropeGeo);
    ropeMesh.castShadow = false;
    ropeMesh.position.set(-0.75 * HEADFRAME_SCALE, ropeAnchorY, 0);
    ropeMesh.scale.y = ropeAnchorY - bucketBailBaseY;
    hfGroup.add(ropeMesh);
  }
  group.add(hfGroup);
  group.userData.breakParts = [{parts: [[hfGroup, 'fold']], rubble: 16}];

  group.userData.animatePlaza = ({timeSec}) => {
    const u = (timeSec % 16) / 16;
    const lift = 0.5 - 0.5 * Math.cos(u * TAU);
    sheaveNode.rotation.z = lift * 9.6;
    if (!detail) return;
    const rise = lift * 6.4 * HEADFRAME_SCALE;
    if (bucketNode) bucketNode.position.y = rise;
    if (ropeMesh) {
      ropeMesh.scale.y = Math.max(2, ropeAnchorY - (bucketBailBaseY + rise));
    }
  };
  return group;
}

export function createTownPlazaGroup(kind, opts = {}) {
  switch (kind) {
    case 'millbrook':
      return millbrookPlazaGroup(opts.colorway, opts);
    case 'oakridge':
      return oakridgePlazaGroup(opts.colorway, opts);
    case 'clearwater':
      return clearwaterPlazaGroup(opts.colorway, opts);
    case 'westgate':
      return westgatePlazaGroup(opts.colorway, opts);
    case 'redstone':
      return redstonePlazaGroup(opts.colorway, opts);
    default:
      return null;
  }
}
