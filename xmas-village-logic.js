// --- THE CHRISTMAS VILLAGE: LAYOUT ---
// Where everything in the Christmas village stands (specs/christmas-village.md),
// in the village's own frame: units, +z away from the airport, the entrance
// and its sign at -z facing Pinewood Field. chill-flight-logic.js picks the
// site (xmasVillageSite) and flattens the ground; terrain-gen.js clears it and
// draws these (models in xmas-models.js). Pure data, no three.js: the terrain
// workers use it too.
//
// Each placement: {type, x, z, rotY, kind, sx?, parts?}. `type` is the
// instanced type (or the house's landmark type, drawn as its Body and Roof),
// `kind` how it breaks: 'house' (folds, roof thrown off), 'tower' (topples),
// 'small' (folds flat) or 'snowman'. `parts` are extra instanced types drawn
// with it (lights), each [type, dx, dy, dz, sx] in its own frame.

// The farmhouses lining the lane (building-models.js), turned to face it
const HOUSE_TYPES = ['farmhouse0', 'farmhouse3', 'farmhouse2', 'farmhouse1'];
// Where a farmhouse's front eave runs (units, in its frame: Polyfork's Gabled
// Farmhouse at POLYFORK_SCALE, its eave 2.4 m up and 2.5 m out), how long
// it is, and how long one roofline light run is (Polyfork's 4 m run)
const EAVE_Y = 2.4 * 3.5;
const EAVE_Z = 2.5 * 3.5 + 0.15;
const EAVE_LENGTH = 6 * 3.5 - 0.6;
const LIGHT_RUN = 4 * 3.5;
// The lane's houses: z of each pair, x of each side
const HOUSE_Z = [-105, -72, -39];
const HOUSE_X = 34;
// The order the lane's houses light up in through Advent (index into the
// houses: left side first at each z, then right), and how many are lit in
// November and on Dec 1
const LIGHT_ORDER = [0, 3, 1, 4, 2, 5];
const LIT_SETUP = 2;
const LIT_DEC_1 = 3;
// The flat, cleared ground the village needs round its middle (units),
// for chill-flight-logic.js and terrain-gen.js
export const XMAS_VILLAGE_RADIUS = 150;

// How many of the lane's houses have their lights up: two in November,
// then more each day of Advent until all are lit by Christmas Eve (and
// stay lit to Twelfth Night, which seasonOf gives as day 31)
export function xmasLitHouses(phase, day) {
  const houses = HOUSE_Z.length * 2;
  if (phase === 'setup') return LIT_SETUP;
  if (phase !== 'full') return 0;
  const d = Math.max(1, Math.min(31, day || 1));
  return Math.min(
    houses,
    LIT_DEC_1 + Math.floor(((d - 1) * (houses - LIT_DEC_1)) / 15)
  );
}

// Everything in the village for this phase ('setup' in November, 'full'
// from December) and day of the month
export function xmasVillagePlacements(phase, day) {
  if (phase !== 'setup' && phase !== 'full') return [];
  const full = phase === 'full';
  const out = [];
  const put = (type, x, z, rotY, kind, extra = {}) =>
    out.push({type, x, z, rotY, kind, ...extra});

  // The lane: farmhouses either side facing it, their front eaves strung
  // with lights as Advent goes on
  const lit = new Set(LIGHT_ORDER.slice(0, xmasLitHouses(phase, day)));
  const runs = Math.max(1, Math.round(EAVE_LENGTH / LIGHT_RUN));
  const runLength = EAVE_LENGTH / runs;
  let h = 0;
  for (const side of [-1, 1]) {
    for (const z of HOUSE_Z) {
      const i = h++;
      const parts = [];
      if (lit.has(i)) {
        for (let k = 0; k < runs; k++) {
          const dx = -EAVE_LENGTH / 2 + runLength * (k + 0.5);
          const sx = runLength / LIGHT_RUN;
          parts.push(['xmasRoofLights', dx, EAVE_Y, EAVE_Z, sx]);
          parts.push(['xmasRoofLightsGlow', dx, EAVE_Y, EAVE_Z, sx]);
        }
      }
      // Facing the lane: +z turned to -x on the right, +x on the left
      put(
        HOUSE_TYPES[i % HOUSE_TYPES.length],
        side * HOUSE_X,
        z,
        (-side * Math.PI) / 2,
        'house',
        {parts}
      );
    }
  }
  // Candy canes along both sides of the lane, lamp posts with garland
  // between the houses
  for (const side of [-1, 1]) {
    for (let z = -128; z <= -20; z += 18) {
      put('xmasCandyCanesBody', side * 12, z, Math.PI / 2, 'small');
    }
    for (const z of [-122, -88, -55, -22]) {
      put('xmasLampPost', side * 19, z, 0, 'tower', {
        parts: [['xmasLampPostGlow', 0, 0, 0, 1]],
      });
    }
  }
  // The sign at the entrance, facing the airport
  put('xmasSign', -16, -140, Math.PI, 'tower');

  // The square: the big tree in the middle, bare in November and decorated
  // and lit in December, with lamp posts either side
  if (full) {
    put('xmasFir', 0, 25, 0, 'tower', {parts: [['xmasFirGlow', 0, 0, 0, 1]]});
  } else {
    put('xmasFirBare', 0, 25, 0, 'tower');
  }
  for (const side of [-1, 1]) {
    put('xmasLampPost', side * 30, 52, 0, 'tower', {
      parts: [['xmasLampPostGlow', 0, 0, 0, 1]],
    });
  }
  // The cocoa stand and its treats on the square's east side, open from
  // November
  put('xmasCocoaStand', 40, 18, -Math.PI / 2, 'tower', {
    parts: [['xmasCocoaStandGlow', 0, 0, 0, 1]],
  });
  put('xmasTreatTableBody', 27, 38, -Math.PI / 2, 'small');
  // The tree lot by the entrance: a rack of cut trees and a row in buckets
  put('xmasTreeRackBody', -56, -12, Math.PI / 2, 'small');
  for (let k = 0; k < 4; k++) {
    put('xmasCutFirBody', -46 - k * 7, 6 + (k % 2) * 2, k * 0.9, 'small');
  }
  // The side yard: a snow fort, snowmen and a shovel left in a drift
  put('xmasSnowFortBody', 52, 72, -0.4, 'small');
  put('snowman', 64, 54, -0.9, 'snowman');
  put('snowman', 44, 92, 2.6, 'snowman');
  put('xmasShovelBody', 60, 66, 0.3, 'small');
  // The gingerbread house closing off the square, facing back down it
  put('xmasGingerbread', 0, 108, Math.PI, 'house', {
    parts: [['xmasGingerbreadGlow', 0, 0, 0, 1]],
  });

  if (full) {
    // Presents round the tree, giant ornaments round them
    for (let k = 0; k < 3; k++) {
      const a = (k * 2 * Math.PI) / 3 + 0.5;
      put(
        'xmasPresentsBody',
        Math.cos(a) * 12,
        25 + Math.sin(a) * 12,
        a,
        'small'
      );
    }
    put('xmasBigPresentBody', 9, 39, 0.4, 'small');
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      put(
        k % 2 ? 'xmasOrnamentGoldBody' : 'xmasOrnamentRedBody',
        Math.cos(a) * 20,
        25 + Math.sin(a) * 20,
        a,
        'small'
      );
    }
    // Lit reindeer on the square's west side
    put('xmasReindeer', -32, 40, 0.6, 'tower', {
      parts: [['xmasReindeerGlow', 0, 0, 0, 1]],
    });
    put('xmasReindeerGrazing', -38, 28, 1.3, 'tower', {
      parts: [['xmasReindeerGrazingGlow', 0, 0, 0, 1]],
    });
    // Letters for Santa, and his sleigh parked behind the square, loaded up
    put('xmasMailboxBody', -22, 2, Math.PI / 2, 'small');
    put('xmasSleighBody', -50, 82, 0.5, 'small', {
      parts: [['xmasSleighGlow', 0, 0, 0, 1]],
    });
    put('xmasToySackBody', -40, 72, 1.1, 'small');
  }
  return out;
}

// A placement's spot in the world, for a village at site {x, z, yaw}
// (rotation.y, as three.js turns things): {x, z, rotY}
export function xmasToWorld(site, p) {
  const c = Math.cos(site.yaw);
  const s = Math.sin(site.yaw);
  return {
    x: site.x + p.x * c + p.z * s,
    z: site.z - p.x * s + p.z * c,
    rotY: site.yaw + p.rotY,
  };
}
