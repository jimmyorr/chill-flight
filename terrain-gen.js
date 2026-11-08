// terrain-gen.js
// Procedural chunk generation: elevation, water, terrain colors and props.
// Runs in the terrain workers (terrain-worker.js), and on the main thread
// only as a fallback when workers are unavailable, so both produce the same
// world.

import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';

function hue2rgb(p, q, t) {
  let tempT = t;
  if (tempT < 0) tempT += 1;
  if (tempT > 1) tempT -= 1;
  if (tempT < 1 / 6) return p + (q - p) * 6 * tempT;
  if (tempT < 1 / 2) return q;
  if (tempT < 2 / 3) return p + (q - p) * 6 * (2 / 3 - tempT);
  return p;
}

const _hslA = {h: 0, s: 0, l: 0};
const _hslB = {h: 0, s: 0, l: 0};

class Color {
  constructor(hex = 0) {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.setHex(hex);
  }
  setHex(hex) {
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
  getHex() {
    const byte = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    return (byte(this.r) << 16) | (byte(this.g) << 8) | byte(this.b);
  }
  copy(c) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  }
  clone() {
    return new Color().copy(this);
  }
  lerp(c, alpha) {
    this.r += (c.r - this.r) * alpha;
    this.g += (c.g - this.g) * alpha;
    this.b += (c.b - this.b) * alpha;
    return this;
  }
  multiplyScalar(s) {
    this.r *= s;
    this.g *= s;
    this.b *= s;
    return this;
  }
  getHSL(target) {
    const r = this.r;
    const g = this.g;
    const b = this.b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let hue = 0;
    let saturation = 0;
    const lightness = (min + max) / 2.0;
    if (min !== max) {
      const delta = max - min;
      saturation =
        lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
      switch (max) {
        case r:
          hue = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          hue = (b - r) / delta + 2;
          break;
        case b:
          hue = (r - g) / delta + 4;
          break;
      }
      hue /= 6;
    }
    target.h = hue;
    target.s = saturation;
    target.l = lightness;
    return target;
  }
  setHSL(h, s, l) {
    const clampedH = ((h % 1) + 1) % 1;
    const clampedS = Math.max(0, Math.min(1, s));
    const clampedL = Math.max(0, Math.min(1, l));
    if (clampedS === 0) {
      this.r = this.g = this.b = clampedL;
    } else {
      const p =
        clampedL <= 0.5
          ? clampedL * (1 + clampedS)
          : clampedL + clampedS - clampedL * clampedS;
      const q = 2 * clampedL - p;
      this.r = hue2rgb(q, p, clampedH + 1 / 3);
      this.g = hue2rgb(q, p, clampedH);
      this.b = hue2rgb(q, p, clampedH - 1 / 3);
    }
    return this;
  }
  lerpHSL(color, alpha) {
    this.getHSL(_hslA);
    color.getHSL(_hslB);
    const h = _hslA.h + (_hslB.h - _hslA.h) * alpha;
    const s = _hslA.s + (_hslB.s - _hslA.s) * alpha;
    const l = _hslA.l + (_hslB.l - _hslA.l) * alpha;
    return this.setHSL(h, s, l);
  }
}

// Pre-allocated palette colors matching terrain-geometry.js
const _colorPlains = new Color(0x7cb342);
const _colorForest = new Color(0x388e3c);
const _colorSnow = new Color(0xfafafa);
const _colorPackIce = new Color(0xa2b4bc);
const _colorSand = new Color(0xe0e0a8);
const _colorWetSand = new Color(0xb09d6b);
const _colorDesertSand = new Color(0xf4a460);
const _colorDesertWetSand = new Color(0xc47e3c);
const _colorWater = new Color(0x40c4ff);
const _colorSandSnowTint = new Color(0x999999);
const _colorUpperSandSnowTint = new Color(0xdddddd);
const _colorForestSnowTint = new Color(0x8ba192);
const _colorPlainsSnowTint = new Color(0xfafafa);
const _colorForestFloorSnow = new Color(0xd6dee2); // snow, a little shaded
const _colorForestFloorSand = new Color(0xdc9a60); // sand, a little shaded
const _colorSnowShade = new Color(0xc8d4e0); // cool drift shadow
const _colorSandShade = new Color(0xd08850); // warm hollow
const _colorMountainTint = new Color(0x7f8c8d);
const _colorAlpineRockDark = new Color(0x424a54);
const _colorAlpineRockLight = new Color(0x9ba2a8);
const _colorScree = new Color(0x736960);
const _colorAlpineMeadow = new Color(0x9aa95c);
const _colorSaltPan = new Color(0xdcc29a);
const _colorTundra = new Color(0x7f8a72);
const _colorLakeIce = new Color(0xb9dbe8);
const _colorLakeIceDark = new Color(0x86b2c4);
const _colorTundraDark = new Color(0x667060);
const _colorFrostRock = new Color(0x45474a);
const _colorSaltPanStain = new Color(0xbf9b6c);
const _panColor = new Color();
// The pan's colour fades into the sand up to this far above the water
const SALT_PAN_SHORE = 4;
const smoothRamp = (v, a, b) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const _colorDesertMountainRock = new Color(0xc24b2b);
const _colorIce = new Color(0x6ca6a8);
const _colorAutumnForestTint = new Color(0x5d4037);
// Fall leaf colors (see the broadleaf trees in generateChunkData)
const _colorFallGreen = new Color(0x1b5e20);
const _colorFallTurning = new Color(0x9e9d24);
const _colorFallRed = new Color(0xc0392b);
const _colorFallOrange = new Color(0xd35400);
const _colorFallYellow = new Color(0xf1c40f);
const _colorFallRusset = new Color(0x8d4a24);
const _fallColor = new Color();
// Ground under the woods, darkened like a canopy seen from above
const _colorForestFloor = new Color(0x1f4a24);
const _colorAutumnPlainsTint = new Color(0x8d6e63);
const _colorCherryForestTint = new Color(0xf8bbd0);
const _colorCherryPlainsTint = new Color(0xfce4ec);
const _colorSandMottleHigh = new Color(0xd2b48c);
const _colorSandMottleLow = new Color(0xdeb887);
const _colorArizonaDark = new Color(0x8b0000);
const _colorDesertMottle = new Color(0xdaa520);
// The pyramids: sandstone in courses this tall (units), and a pale
// limestone cap above this height on the great one
const _colorPyramidStone = new Color(0xd8b07a);
const _colorPyramidCap = new Color(0xf0e6cc);
const PYRAMID_COURSE = 12;
const PYRAMID_CAP = 690;
// The canyon's sandstone layers, one per tier of its walls, bottom to top
const _canyonBands = [
  new Color(0xb5532e), // rust
  new Color(0xe3b48a), // cream
  new Color(0xc9683b), // orange
  new Color(0x8f3b26), // deep red
  new Color(0xd99a64), // tan
  new Color(0xa84a2c), // red
];
const _colorForestDark = new Color(0x006400);
const _colorForestDeep = new Color(0x004d00);
const _colorForestLight = new Color(0x6b8e23);
const _colorPlainsDark = new Color(0x556b2f);
const _colorPlainsBright = new Color(0xbdb76b);
const _colorCliffSouth = new Color(0x8b3a3a);
const _colorVolcanoBasaltHi = new Color(0x5c5c5c);
const _colorVolcanoBasaltLo = new Color(0x3a3a3a);
const _colorEasternLowland = new Color(0x1a4d3a);
const _colorEasternRock = new Color(0x1a0a2e);
const _colorEasternPeak = new Color(0xc8f000);
const _colorEasternCliff = new Color(0x4b0082);
const _colorEasternWater = new Color(0x00ffe7);
// The eastern land's column tops (see the extreme zone colours): mosses,
// heather and lichens
const _colorBasaltTops = [
  new Color(0x1a4d3a), // deep moss
  new Color(0x2f6e3a), // moss
  new Color(0x1f7a72), // teal moss
  new Color(0x7a9a2a), // lime moss
  new Color(0x2f6e3a), // moss
  new Color(0x5a4580), // violet heather
  new Color(0x7e4a68), // dusky heather
  new Color(0x95593a), // rust lichen
];
const _colorBasaltWall = new Color(0x34304a);
const _colorWesternLowland = new Color(0x400020);
const _colorWesternRock = new Color(0x200000);
// Pale pink crystal, so the spires don't read as snow
const _colorWesternPeak = new Color(0xffb8ec);
const _colorWesternCliff = new Color(0xff4500);
const _colorWesternWater = new Color(0xff00ff);
const _snowColor = new Color(0xe0f7fa);
const _colorWhite = new Color(0xffffff);
const _colorIceMottleDark = new Color(0x8a9ea8);
const _colorSwampMud = new Color(0x3b3527);
// Peaty olive, not meadow green: brown enough that the tall grass
// (grass.js, green ground only) stays off it
const _colorSwampMoss = new Color(0x55553a);
const _colorSwampMossDark = new Color(0x3e402c);
const _tempColorObj = new Color();
const _baseBushColor = new Color();
const _iceHutColor = new Color();
const _treeBaseColor = new Color();
const _treeTempColor = new Color();

const VOLCANO_X = -5000;
const VOLCANO_Z = 5000;
// Palms stop where the desert takes over (desertFactor), leaving a gap
// before the cacti start at 0.4, so the two never grow side by side
const PALM_MAX_DESERT = 0.3;
// Desert scrub (bushes in a dusty sage green): chance per grid point in its
// loose patches, and of a lone one between them
const DESERT_SCRUB_PATCH = 0.035;
const DESERT_SCRUB_LONE = 0.004;
const DESERT_SCRUB_COLOR = 0x8f9a62;
// Hay bales: the share of the mown meadows among the fields that have them,
// and the chance of a bale (or a pair) at each grid point of one
const HAY_FIELD_CHANCE = 0.45;
const HAY_BALE_CHANCE = 0.12;
// Tractors (farm-models.js): the share of the crop fields with one parked
// out in them, and how many paint schemes there are (tractorBody,
// tractor2Body, ...)
const TRACTOR_FIELD_CHANCE = 0.12;
const TRACTOR_LOOKS = 3;
// Ice fishing huts on the far north's frozen lakes: they gather in little
// camps (a slow noise field) out on the ice, with this chance per grid point
const ICE_HUT_CHANCE = 0.03;
// Landmarks (building-models.js), each from a hash of a grid point fit for
// it, with this chance per such point: fire lookouts on wooded ridges,
// water towers in the villages, windpumps where the farmland dries out into
// desert, rows of beach huts on the beaches,
// ranger stations deep in the woods far from the villages, a fisherman's
// shack by some of the piers and a lean-to shelter by some of the
// campfires (`chance` there is per pier or campfire). Each is cleared of the trees and other props around it
// (`clear`, units) on ground no steeper than `flat` (rise across it,
// units). Towers stand on their own and topple whole; the rest are houses
// ('...Body' and '...Roof').
const LANDMARK_RULES = {
  fireLookout: {chance: 0.06, clear: 10, flat: 6, tower: true},
  waterTower: {chance: 0.006, clear: 24, flat: 3, tower: true},
  windpump: {chance: 0.004, clear: 9, flat: 4, tower: true},
  beachHut: {chance: 0.01, clear: 11, flat: 3},
  rangerStation: {chance: 0.007, clear: 22, flat: 5},
  // Log cabins in some squares of the woods (CABIN_CELL), thatched
  // cottages on the edges of the farm villages, cottages by the highways
  logCabin: {chance: 0.02, clear: 16, flat: 4},
  thatchedCottage: {chance: 0.004, clear: 12, flat: 3},
  roadCottage: {chance: 0.02, clear: 14, flat: 3},
  leanTo: {chance: 0.4, clear: 7, flat: 4},
  trailer: {chance: 0.4, clear: 9, flat: 4, tower: true},
  fishShack: {chance: 0.5, clear: 11, flat: 4},
  coveTavern: {chance: 0.5, clear: 12, flat: 8},
  waterMill: {chance: 0.3, clear: 10, flat: 6},
  // Swapped in for a village's two-storey house (VILLAGE_TAVERN_*)
  villageTavern: {chance: 0, clear: 0, flat: 0},
  farmhouse: {chance: 0.7, clear: 13, flat: 4},
  mushroomCottage: {chance: 0.03, clear: 30, flat: 6},
  dinoSkull: {chance: 0.0012, clear: 14, flat: 3.5, tower: true},
  // Placed behind the houses after the rest (GARDEN_SHED_*)
  gardenShed: {chance: 0, clear: 0, flat: 0},
};
const DINO_SKULL_LOOKS = 3;
// The share of piers that turn off to one side at the end, where there's
// room (an L)
const PIER_ELL_CHANCE = 0.35;
// The campers' trailers (trailer0, ...): how many looks, and how far from
// the campfire one is parked (units, to its middle)
const TRAILER_LOOKS = 4;
const TRAILER_FROM_FIRE = 24;
// How far a water mill's middle stands back from the river (its wheel on
// the river side), and how strongly the river there must flow
const MILL_FROM_RIVER = 14;
const MILL_RIVER_FLOW = 0.3;
// Water mills stand only in some squares this big (units; chance in
// LANDMARK_RULES)
const MILL_CELL = 2000;
// The share of the grid villages' two-storey houses that are an inn
// instead, and how far round it the other houses must leave room (units)
const VILLAGE_TAVERN_CHANCE = 0.08;
const VILLAGE_TAVERN_ROOM = 20;
// How many village houses have a garden shed, how far behind the house's
// middle it stands, and how far round it the trees are cleared (units)
const GARDEN_SHED_CHANCE = 0.25;
const GARDEN_SHED_BACK = 14;
const GARDEN_SHED_CLEAR = 7;
// How many paint schemes of farmhouse there are (farmhouse0Body, ...; the
// last is for the north), and where it stands from its barn (units, in
// the barn's frame: out along the strip and to the side)
const FARMHOUSE_LOOKS = 4;
const FARMHOUSE_YARD = 42;
const FARMHOUSE_SIDE = -14;
// How many paint schemes of beach hut there are (beachHut0Body, ...), and
// how far apart they stand in a row (units)
const BEACH_HUT_LOOKS = 4;
const BEACH_HUT_STEP = 19;
// Ranger stations stand only in some squares this big (units)
const RANGER_CELL = 3000;
// Log cabins stand only in some squares this big (units), and roadside
// cottages this far from the highway's middle (units, past its edge)
const CABIN_CELL = 2500;
const ROAD_COTTAGE_BACK = [30, 70];
// A fire lookout's spot must be this much higher than the ground this far
// round it on every side (units): the top of a ridge
const LOOKOUT_RIDGE_REACH = 150;
const LOOKOUT_RIDGE_RISE = 6;
export const ICE_HUT_COLORS = [
  0xb8463a, 0x3f6fa3, 0x4e8a4c, 0xd9a43c, 0xc9682f,
];
// Fallen logs and stumps toward the edges of the woods (not their dark
// cores, where the canopy hides them): chance of each per grid point
const FALLEN_LOG_CHANCE = 0.045;
const STUMP_CHANCE = 0.03;
// Channel buoys, red and green, in the sea's shallows off the harbours
// (near a pier, house or lighthouse): their chance per grid point between
// these depths
const BUOY_CHANCE = 0.012;
// How near a pier, house or lighthouse a buoy must be
const BUOY_HARBOUR_RANGE = 600;
const BUOY_MIN_DEPTH = 3;
const BUOY_MAX_DEPTH = 9;
const BUOY_COLORS = [0xc8372d, 0x2f8a52];
// Rock breakwaters: a rubble mound from the beach out into the sea off a
// harbour (near a pier, house or lighthouse), curving a little, with a
// beacon post at its end. The share of chunks that may have one, and their
// shape: segment spacing along the mound, length and total bend.
const BREAKWATER_CHUNK_CHANCE = 0.6;
const BREAKWATER_SEGMENT = 9;
const BREAKWATER_LENGTH = [130, 230];
const BREAKWATER_BEND = 0.55;
const BREAKWATER_HARBOUR_RANGE = 500;
// How deep the sea may get under it (rubble mounds stay in the shallows)
const BREAKWATER_MAX_DEPTH = 25;
// Lighthouses on headlands, besides Montauk's: the share of chunks that may
// have one (if they have a headland in a fitting region). Of two such chunks
// within LIGHTHOUSE_SPACING chunks of each other, only one may, so they never
// stand close together; and none within LIGHTHOUSE_MONTAUK_CLEAR of Montauk's
const LIGHTHOUSE_CHUNK_CHANCE = 0.15;
const LIGHTHOUSE_SPACING = 2;
const LIGHTHOUSE_MONTAUK_CLEAR = 4;
// How far props are cleared around one (its keeper's house and yard)
const LIGHTHOUSE_CLEAR = 55;
// Sheep grazing in loose flocks on open grassland and hill pasture (a slow
// noise field picks the pastures; in the farmland, only the meadows): their
// chance per grid point there, and their wool colours
const SHEEP_CHANCE = 0.12;
export const SHEEP_WOOL_COLORS = [0xf1ede2, 0xe6dfcf, 0xf4f1ea, 0xd9d1bf];
// Mountain goats on the rocky slopes round the tree line and deer in the
// woods: the chance a grid point in one of their patches has a group (of
// 1 to 3), and their coats
const GOAT_CHANCE = 0.018;
const DEER_CHANCE = 0.03;
export const GOAT_COLORS = [0xece6da, 0xd8c8a8, 0x8a6a4a, 0x47403a, 0xb0a79c];
export const DEER_COLORS = [0xa0703f, 0x8f6239, 0xb2804d, 0x7d5634];
// Birds: the chance of a flock of gulls over a coastal chunk (one that's
// part land, part water) and over open sea, none north of GULL_MAX_NORTH
// (the frozen lakes); and of a hawk over a mostly dry chunk
const GULL_COAST_CHANCE = 0.2;
const GULL_SEA_CHANCE = 0.04;
const GULL_MAX_NORTH = -22000;
const HAWK_CHANCE = 0.22;
// The share of the ice floes with a seal or two lying on them
const SEAL_FLOE_CHANCE = 0.45;
// Joshua trees: share of the desert's trees, and their tufts' colour
const JOSHUA_SHARE = 0.65;
export const JOSHUA_LEAF_COLOR = 0x6f8a3c;
const ENABLE_BARNS = true;
const ENABLE_MONASTERIES = true;
const ENABLE_CASTLE_RUINS = true;

// How alien (ChillFlightLogic.alienAt) the land must be for alien props
// A swamp tree standing where a forest tree would (pick by a hash of the
// spot, like the swamp groves)
function swampTreeFrom(spot, worldX, worldZ, gridSpacing, t) {
  const gx = Math.round(worldX / gridSpacing);
  const gz = Math.round(worldZ / gridSpacing);
  const hPick = fieldHash(gx + t * 17, gz + t * 31, 503);
  return {
    type:
      hPick < 0.34
        ? 'swampCypressMoss'
        : hPick < 0.64
          ? 'swampCypress'
          : hPick < 0.86
            ? 'swampTupelo'
            : hPick < 0.94
              ? 'swampDeadOak'
              : 'swampSnag',
    x: spot.x,
    y: spot.y - 0.3,
    z: spot.z,
    size: spot.size * (0.95 + 0.25 * fieldHash(gx, gz, 509 + t)),
    rotY: fieldHash(gx, gz, 521 + t) * Math.PI * 2,
  };
}

// Share of swamp trees not placed (see the swamp tree loop below): their
// models are 600-900 triangles each, against tens for a pine, so the swamp
// keeps about a third of them
const SWAMP_TREE_THINNING = 0.65;

export const ALIEN_PROPS_AT = 0.3;

// Above the tree line: alpine meadow for this many meters, then bare rock
const ALPINE_MEADOW_BAND = 150;
// Over this many meters below the tree line, the woods thin and shrink
const TREE_LINE_FADE = 150;

const ALIEN_CRYSTAL_COLORS = [0xff4fd8, 0xff7a3d, 0xffb8ec, 0xc04dff, 0xff2e7e];

// (The last two are the mushroom cottages' red and blueberry caps)
const ALIEN_MUSHROOM_CAP_COLORS = [
  0x9c27b0, 0xab47bc, 0x7b1fa2, 0xba68c8, 0x8e24aa, 0x00bcd4, 0x26a69a,
  0xc2422f, 0x7c7fc0,
];

const _matBuffer = new Float32Array(16);

function composeMatrix(out, offset, px, py, pz, sx, sy, sz, rx, ry, rz) {
  const a = Math.cos(rx);
  const b = Math.sin(rx);
  const c = Math.cos(ry);
  const d = Math.sin(ry);
  const e = Math.cos(rz);
  const f = Math.sin(rz);

  const ae = a * e;
  const af = a * f;
  const be = b * e;
  const bf = b * f;

  out[offset + 0] = c * e * sx;
  out[offset + 1] = (af + be * d) * sx;
  out[offset + 2] = (bf - ae * d) * sx;
  out[offset + 3] = 0;

  out[offset + 4] = -c * f * sy;
  out[offset + 5] = (ae - bf * d) * sy;
  out[offset + 6] = (be + af * d) * sy;
  out[offset + 7] = 0;

  out[offset + 8] = d * sz;
  out[offset + 9] = -b * c * sz;
  out[offset + 10] = a * c * sz;
  out[offset + 11] = 0;

  out[offset + 12] = px;
  out[offset + 13] = py;
  out[offset + 14] = pz;
  out[offset + 15] = 1;
}

function rotateY(x, z, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos + z * sin,
    z: -x * sin + z * cos,
  };
}

// The way a village's streets (and its fields) run, slowly varying
function villageAngleAt(x, z, simplex) {
  return (simplex.noise2D(x * 0.0004 - 13.1, z * 0.0004 + 5.9) + 1) * Math.PI;
}

// Farm fields around villages. The land is split into blocks about 1,200 m
// across (with wobbly edges), and each block is a parcel of strip fields
// turned to its village's orientation, so neighboring parcels meet at an
// angle, like a real patchwork. fieldAt fills _field with the point's place
// in its parcel: u along the strips' short side, v along their length, and
// the crop (an index into FIELD_CROP_COLORS, or -1 for plain pasture).
const FARM_BLOCK = 1500;
const FIELD_WIDTH = 220;
const FIELD_LENGTH = 480;
const FIELD_CROP_COLORS = [
  new Color(0xe3c255), // wheat
  new Color(0xc2cc5c), // barley
  new Color(0xa8d04a), // young crop
  new Color(0x4f8a2e), // potatoes, beans
  new Color(0x8a6242), // plowed
];
const _field = {u: 0, v: 0, angle: 0, cx: 0, cz: 0, bx: 0, bz: 0, crop: -1};
function fieldHash(a, b, c) {
  let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ c;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// fieldHash hashed again: a near salt in fieldHash alone gives rolls that
// follow its others' too closely (seen over the campfire spots)
function fireHash(a, b, c) {
  return fieldHash((fieldHash(a, b, c) * 2147483647) | 0, 0x2c1b3c6d, c);
}
// A chunk's roll for a headland lighthouse (0 to 1; one is possible under
// LIGHTHOUSE_CHUNK_CHANCE), and whether it wins: no lower roll among the
// possible ones within LIGHTHOUSE_SPACING chunks, and clear of Montauk's
function lighthouseRoll(cx, cz) {
  if (
    Math.max(Math.abs(cx - 5), Math.abs(cz - 2)) <= LIGHTHOUSE_MONTAUK_CLEAR
  ) {
    return 1;
  }
  return fieldHash(cx, cz, 197 + (ChillFlightLogic.WORLD_SEED % 100003));
}
function lighthouseChunkWins(cx, cz) {
  const roll = lighthouseRoll(cx, cz);
  if (roll >= LIGHTHOUSE_CHUNK_CHANCE) return false;
  for (let dz = -LIGHTHOUSE_SPACING; dz <= LIGHTHOUSE_SPACING; dz++) {
    for (let dx = -LIGHTHOUSE_SPACING; dx <= LIGHTHOUSE_SPACING; dx++) {
      if ((dx || dz) && lighthouseRoll(cx + dx, cz + dz) < roll) return false;
    }
  }
  return true;
}
function fieldAt(x, z, simplex) {
  const wx = x + simplex.noise2D(x * 0.0015 + 3.3, z * 0.0015 - 8.1) * 150;
  const wz = z + simplex.noise2D(x * 0.0015 - 6.7, z * 0.0015 + 2.9) * 150;
  const bx = Math.floor(wx / FARM_BLOCK);
  const bz = Math.floor(wz / FARM_BLOCK);
  _field.bx = bx;
  _field.bz = bz;
  _field.cx = (bx + 0.5) * FARM_BLOCK;
  _field.cz = (bz + 0.5) * FARM_BLOCK;
  _field.angle = villageAngleAt(_field.cx, _field.cz, simplex);
  const cos = Math.cos(_field.angle);
  const sin = Math.sin(_field.angle);
  const dx = x - _field.cx;
  const dz = z - _field.cz;
  _field.u = dx * cos - dz * sin;
  _field.v = dx * sin + dz * cos;
  const i = Math.floor(_field.u / FIELD_WIDTH);
  // Each strip's fields are staggered, so their ends don't line up
  const j = Math.floor(
    _field.v / FIELD_LENGTH + fieldHash(bx, bz, i * 7919 + 11)
  );
  const roll = fieldHash(bx * 31 + i, bz * 17 + j, 5);
  _field.crop =
    roll < 0.2
      ? -1
      : Math.floor(((roll - 0.2) / 0.8) * FIELD_CROP_COLORS.length);
  return _field;
}

// The farmsteads a farm parcel (fieldAt's result) may have: a few spots,
// one per field strip in turn, each kept about half the time, where a barn
// stands just inside a field's corner by its hedges, long side along the
// strip, and now and then a windmill beside it. Only the spots on fairly
// flat farmland outside the villages get built (steadOk in
// generateChunkData), so a parcel of fields has a farm or two.
const FARMSTEAD_SPOTS = 6;
const FARMSTEAD_CHANCE = 0.5;
const FARMSTEAD_MILL_CHANCE = 0.25;
function farmsteadsAt(f) {
  const {bx, bz} = f;
  const cos = Math.cos(f.angle);
  const sin = Math.sin(f.angle);
  const spots = [];
  for (let k = 0; k < FARMSTEAD_SPOTS; k++) {
    if (fieldHash(bx, bz, 4242 + k * 101) >= FARMSTEAD_CHANCE) continue;
    const i = k - FARMSTEAD_SPOTS / 2;
    const j = Math.floor(fieldHash(bx, bz, 91 + k * 37) * 3) - 1;
    const stagger = fieldHash(bx, bz, i * 7919 + 11);
    const u = i * FIELD_WIDTH + 30;
    const v = (j - stagger) * FIELD_LENGTH + 45;
    spots.push({
      x: f.cx + cos * u + sin * v,
      z: f.cz - sin * u + cos * v,
      rotY: f.angle,
      mill: fieldHash(bx, bz, 1313 + k * 53) < FARMSTEAD_MILL_CHANCE,
      // The windmill 70 units further into the field along the strip
      mx: f.cx + cos * (u + 20) + sin * (v + 70),
      mz: f.cz - sin * (u + 20) + cos * (v + 70),
    });
  }
  return spots;
}

// The spot where the field holding fieldAt's point `f` has a tractor, if it
// has one (TRACTOR_FIELD_CHANCE): somewhere inside it, facing along the
// strip either way. Returns {type, x, z, rotY} or null.
function tractorSpot(f) {
  const i = Math.floor(f.u / FIELD_WIDTH);
  const stagger = fieldHash(f.bx, f.bz, i * 7919 + 11);
  const j = Math.floor(f.v / FIELD_LENGTH + stagger);
  const h = (salt) => fieldHash(f.bx * 31 + i, f.bz * 17 + j, salt);
  if (h(61) >= TRACTOR_FIELD_CHANCE) return null;
  const u = (i + 0.25 + h(67) * 0.5) * FIELD_WIDTH;
  const v = (j - stagger + 0.2 + h(71) * 0.6) * FIELD_LENGTH;
  const cos = Math.cos(f.angle);
  const sin = Math.sin(f.angle);
  // (Hashed the other way round: h's rolls with nearby salts go together)
  const look = Math.floor(
    fieldHash(f.bz * 13 + j, f.bx * 7 + i, 977) * TRACTOR_LOOKS
  );
  return {
    type: look ? 'tractor' + (look + 1) + 'Body' : 'tractorBody',
    x: f.cx + cos * u + sin * v,
    z: f.cz - sin * u + cos * v,
    rotY: f.angle + (h(79) < 0.5 ? Math.PI : 0),
  };
}

// The nearest hedgerow to (x, z) in its field parcel, as a world point, or
// null if it's more than `reach` away. Hedges run along most of the strips'
// long sides and some of their ends.
function hedgeNear(x, z, simplex, reach) {
  const f = fieldAt(x, z, simplex);
  const {bx, bz} = f;
  let {u, v} = f;
  const iEdge = Math.round(u / FIELD_WIDTH);
  const i = Math.floor(u / FIELD_WIDTH);
  const stagger = fieldHash(bx, bz, i * 7919 + 11);
  const jEdge = Math.round(v / FIELD_LENGTH + stagger);
  const du = Math.abs(u - iEdge * FIELD_WIDTH);
  const dv = Math.abs(v - (jEdge - stagger) * FIELD_LENGTH);
  if (du <= dv && du < reach && fieldHash(bx, bz, iEdge * 13 + 3) < 0.7) {
    u = iEdge * FIELD_WIDTH;
  } else if (dv < reach && fieldHash(bx * 7 + i, bz, jEdge * 29 + 1) < 0.4) {
    v = (jEdge - stagger) * FIELD_LENGTH;
  } else {
    return null;
  }
  const cos = Math.cos(f.angle);
  const sin = Math.sin(f.angle);
  return {x: f.cx + cos * u + sin * v, z: f.cz - sin * u + cos * v};
}

// How far beyond a road's paved edge trees (most spread about 15),
// buildings and smaller props stand (keepOffRoads in generateChunkData)
const ROAD_TREE_CLEAR = 18;
const ROAD_BUILDING_CLEAR = 15;
const ROAD_PROP_CLEAR = 8;
// And how far from the pyramids' bases any prop stands
const PYRAMID_PROP_CLEAR = 30;

// Villages along the highways: now and then a stretch of road is lined on
// both sides with houses facing it, with a second row behind them toward the
// middle, like a village grown along its main street. Each road is split into
// stretches ROAD_VILLAGE_SLOT long, and about half of them hold a village.
const ROAD_VILLAGE_SLOT = 6000;
const ROAD_VILLAGE_CHANCE = 0.5;
// Front doors this far from the road's center line (the paved road and its
// shoulder reach 40), and the back row this much further out
const ROAD_VILLAGE_FRONT = 55;
const ROAD_VILLAGE_BACK = 28;

// Road n's village in stretch `slot`, or null: its center (`along` the road:
// z for the north-south roads and the east coast one, x for the
// cross-country one), half its
// length, and its own seed
function roadVillage(n, slot) {
  const seed = ChillFlightLogic.WORLD_SEED | 0;
  if (fieldHash(n * 101 + seed, slot, 4243) >= ROAD_VILLAGE_CHANCE) return null;
  const half = 180 + fieldHash(n + seed, slot, 977) * 220;
  const room = ROAD_VILLAGE_SLOT / 2 - half - 200;
  return {
    n,
    along:
      (slot + 0.5) * ROAD_VILLAGE_SLOT +
      (fieldHash(n, slot + seed, 31) - 0.5) * 2 * room,
    half,
    seed: Math.floor(fieldHash(seed, n * 7 + 3, slot) * 4294967296),
  };
}

// Where road n's centre is at `along`
function roadVillagePoint(n, along) {
  return ChillFlightLogic.roadPoint(
    n,
    along,
    ChillFlightLogic.roadCenter(n, along)
  );
}

// A road village's houses, in world coordinates. They depend only on the
// village, so neighboring chunks agree on them; each chunk keeps the ones on
// its own ground (and only where that ground suits a house).
function roadVillageHouses(v) {
  const rand = ChillFlightLogic.mulberry32(v.seed);
  const houses = [];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      // The back row only fills in toward the village's middle
      const reach = row === 0 ? v.half : v.half * 0.6;
      let s = -reach + rand() * 10;
      while (s < reach) {
        const twoStory = rand() < 0.35;
        const sx = twoStory
          ? rand() < 0.5
            ? 0.68 + rand() * 0.1
            : 0.92 + rand() * 0.15
          : rand() < 0.25
            ? 1.5 + rand() * 0.3
            : 0.9 + rand() * 0.2;
        const sy = 0.92 + rand() * 0.18;
        const halfW = 6.5 * sx;
        s += halfW;
        // Gaps here and there, more toward the village's ends, so it thins
        // out into the countryside rather than stopping at a line
        const edge = Math.max(0, Math.abs(s) / reach - 0.6) * 1.6;
        const keep = rand() > (row === 0 ? 0.08 : 0.3) + edge;
        const jitter = rand();
        // Mostly square to the road, sometimes a little off, and now and
        // then turned side-on, so the rows don't look like a wall
        const turn = (rand() - 0.5) * 0.2 + (rand() < 0.15 ? Math.PI / 2 : 0);
        if (keep && s < reach) {
          const along = v.along + s;
          const p = roadVillagePoint(v.n, along);
          const a = roadVillagePoint(v.n, along - 5);
          const b = roadVillagePoint(v.n, along + 5);
          const len = Math.hypot(b.x - a.x, b.z - a.z);
          // The road's direction, and its normal (east of a north-south
          // road, north of the cross-country one)
          const tx = (b.x - a.x) / len;
          const tz = (b.z - a.z) / len;
          const nx = tz;
          const nz = -tx;
          const off = ROAD_VILLAGE_FRONT + row * ROAD_VILLAGE_BACK + jitter * 9;
          houses.push({
            x: p.x + nx * off * side,
            z: p.z + nz * off * side,
            // Front door (+Z) toward the road, ridge along it
            rotY: Math.atan2(-nx * side, -nz * side) + turn,
            tx,
            tz,
            halfW,
            sx,
            sy,
            twoStory,
            smoke: jitter < 0.4,
          });
        }
        // A wider gap now and then, like a lane between the houses
        s += halfW + 3 + rand() * 5 + (rand() < 0.1 ? 25 + rand() * 15 : 0);
      }
    }
  }
  return houses;
}

// --- TOWNS ---
// Market towns where the cross-country highway crosses a north-south one:
// blocks of houses on a street grid lined up with the north-south road,
// thickest and tallest in the middle and thinning out into the country
// around it. Every crossing gets one: the first (nearest the airfields) is
// the biggest, reaching TOWN_RADIUS from the crossing, and the rest are
// smaller, down to TOWN_RADIUS_MIN.
const TOWN_ROADS = Array.from(
  {length: ChillFlightLogic.ROAD_LAST + 1},
  (_, n) => n
);
const TOWN_RADIUS = 650;
const TOWN_RADIUS_MIN = 380;
// Streets run across the grid's v every TOWN_BLOCK; each block holds two
// rows of houses back to back, facing the streets either side
const TOWN_BLOCK = 80;
// Cross streets run along v every TOWN_CROSS (give or take), and streets
// stop where the town has thinned to the odd house (TOWN_STREET_END of
// the town's radius from the middle)
const TOWN_CROSS = 150;
const TOWN_STREET_END = 0.85;
// Houses keep this far from a highway's centre line (its deck and shoulder
// reach 40), so the front row faces the highway like a village's
const TOWN_ROAD_CLEAR = 52;

// Where the cross-country highway crosses highway n, if both run there
// (cached per seed)
const _townCache = new Map();
function townAt(n, elevParams) {
  const key = ChillFlightLogic.WORLD_SEED + ':' + n;
  if (_townCache.has(key)) return _townCache.get(key);
  let x = ChillFlightLogic.ROAD_BASE_X + n * ChillFlightLogic.ROAD_SPACING;
  let z;
  // Each road's centre at the other's: settles on the crossing in a few steps
  for (let i = 0; i < 20; i++) {
    z = ChillFlightLogic.getRoadCenterZ(x);
    x = ChillFlightLogic.getRoadCenterX(z, n);
  }
  z = ChillFlightLogic.getRoadCenterZ(x);
  const runs =
    ChillFlightLogic.highwayRunsAt(n, z, simplex, elevParams) &&
    ChillFlightLogic.highwayRunsAt(
      ChillFlightLogic.ROAD_EW,
      x,
      simplex,
      elevParams
    );
  let town = null;
  if (runs) {
    // The grid lines up with the north-south road through the crossing
    const dxdz =
      (ChillFlightLogic.getRoadCenterX(z + 50, n) -
        ChillFlightLogic.getRoadCenterX(z - 50, n)) /
      100;
    town = {
      n,
      x,
      z,
      angle: Math.atan(dxdz),
      seed: Math.floor(
        fieldHash(ChillFlightLogic.WORLD_SEED | 0, n, 8101) * 4294967296
      ),
      radius:
        n === 0
          ? TOWN_RADIUS
          : TOWN_RADIUS_MIN +
            fieldHash(ChillFlightLogic.WORLD_SEED | 0, n, 8102) *
              (TOWN_RADIUS - 60 - TOWN_RADIUS_MIN),
    };
  }
  if (_townCache.size > 64) _townCache.clear();
  _townCache.set(key, town);
  return town;
}

// Distance from (x, z) to the nearer of the two highways through a town
function townRoadDistance(t, x, z) {
  return Math.min(
    Math.abs(x - ChillFlightLogic.getRoadCenterX(z, t.n)),
    Math.abs(z - ChillFlightLogic.getRoadCenterZ(x))
  );
}

// A town's houses, in world coordinates, in the same form as a road
// village's (roadVillageHouses), and its streets: pieces about
// TOWN_STREET_STEP long ({x0, z0, x1, z1}), off the highways
const TOWN_STREET_STEP = 15;
const TOWN_STREET_HALF_WIDTH = 7;
const _townHouses = new Map();
function townHouses(t) {
  const key = t.seed + ':' + t.x;
  if (_townHouses.has(key)) return _townHouses.get(key);
  // Each street's reach along u, from the houses facing it
  const streetReach = new Map();
  const rand = ChillFlightLogic.mulberry32(t.seed);
  const houses = [];
  const cos = Math.cos(t.angle);
  const sin = Math.sin(t.angle);
  // Grid axes: v along the north-south road, u across it
  const toWorld = (u, v) => ({
    x: t.x + u * cos + v * sin,
    z: t.z - u * sin + v * cos,
  });
  // Where the cross streets run, in u
  const crossU = [];
  for (
    let u = -t.radius + rand() * TOWN_CROSS * 0.5;
    u < t.radius;
    u += TOWN_CROSS * (0.8 + rand() * 0.4)
  ) {
    crossU.push(u);
  }
  const onCrossStreet = (u, halfW) =>
    crossU.some((c) => Math.abs(u - c) < halfW + TOWN_STREET_HALF_WIDTH + 3);
  const rows = Math.ceil(t.radius / TOWN_BLOCK);
  for (let row = -rows; row <= rows; row++) {
    // Two rows of lots per block: one facing the street at the block's
    // north edge, one the street at its south edge
    for (const facing of [-1, 1]) {
      const v = row * TOWN_BLOCK + facing * (TOWN_BLOCK / 2 - 16);
      let u = -t.radius + rand() * 10;
      while (u < t.radius) {
        const r = Math.hypot(u, v) / t.radius;
        // Bigger, taller houses toward the middle
        const middle = 1 - Math.min(1, r * 1.4);
        const twoStory = rand() < 0.3 + 0.6 * middle;
        const sx = twoStory
          ? 0.85 + rand() * 0.35 + middle * 0.25
          : 0.9 + rand() * 0.4;
        const sy = twoStory
          ? 0.95 + rand() * 0.15 + middle * middle * (0.2 + rand() * 0.25)
          : 0.92 + rand() * 0.18;
        const halfW = 6.5 * sx;
        u += halfW;
        // Thinning out past the middle, raggedly
        const keep =
          rand() > Math.max(0, r - 0.45) * 1.9 + 0.06 + (r > 1 ? 1 : 0);
        const jitter = rand();
        const turn = (rand() - 0.5) * 0.08;
        // Now and then an empty lot
        const gap = rand() < 0.08 ? 14 + rand() * 8 : 2 + rand() * 4;
        if (keep && !onCrossStreet(u, halfW)) {
          const p = toWorld(u, v + (jitter - 0.5) * 3);
          if (townRoadDistance(t, p.x, p.z) > TOWN_ROAD_CLEAR) {
            const street = row + (facing > 0 ? 1 : 0);
            const reach = streetReach.get(street) || {u0: u, u1: u};
            reach.u0 = Math.min(reach.u0, u - halfW);
            reach.u1 = Math.max(reach.u1, u + halfW);
            streetReach.set(street, reach);
            houses.push({
              x: p.x,
              z: p.z,
              // Front door (+Z) toward the street it faces
              rotY: t.angle + (facing > 0 ? 0 : Math.PI) + turn,
              tx: cos,
              tz: -sin,
              halfW,
              sx,
              sy,
              twoStory,
              smoke: jitter < 0.3,
            });
          }
        }
        u += halfW + gap;
      }
    }
  }
  // Streets run between the blocks (v at the blocks' edges), from the first
  // house facing them to the last, but not out into the scattered houses at
  // the town's edge. Cross streets join them, from the first street that
  // reaches them to the last. Both stop short of the highways' decks.
  const streets = [];
  // The same streets as unbroken runs of pieces ({x0, z0, x1, z1}), for
  // keeping the tall grass off them
  const lines = [];
  const end = t.radius * TOWN_STREET_END;
  const addStreet = (ua, va, ub, vb) => {
    const len = Math.hypot(ub - ua, vb - va);
    const pieces = Math.max(1, Math.round(len / TOWN_STREET_STEP));
    let run = null;
    for (let i = 0; i < pieces; i++) {
      const a = toWorld(
        ua + ((ub - ua) * i) / pieces,
        va + ((vb - va) * i) / pieces
      );
      const b = toWorld(
        ua + ((ub - ua) * (i + 1)) / pieces,
        va + ((vb - va) * (i + 1)) / pieces
      );
      const mid = {x: (a.x + b.x) / 2, z: (a.z + b.z) / 2};
      if (townRoadDistance(t, mid.x, mid.z) < 34) {
        run = null;
        continue;
      }
      streets.push({x0: a.x, z0: a.z, x1: b.x, z1: b.z});
      if (run) {
        run.x1 = b.x;
        run.z1 = b.z;
      } else {
        run = {x0: a.x, z0: a.z, x1: b.x, z1: b.z};
        lines.push(run);
      }
    }
  };
  const spans = [];
  for (const [street, reach] of streetReach) {
    const v = (street - 0.5) * TOWN_BLOCK;
    const limit = Math.sqrt(Math.max(0, end * end - v * v));
    const u0 = Math.max(reach.u0, -limit);
    const u1 = Math.min(reach.u1, limit);
    if (u1 - u0 < 60) continue;
    spans.push({v, u0, u1});
    addStreet(u0, v, u1, v);
  }
  for (const u of crossU) {
    let v0 = Infinity;
    let v1 = -Infinity;
    for (const sp of spans) {
      if (u < sp.u0 || u > sp.u1) continue;
      v0 = Math.min(v0, sp.v);
      v1 = Math.max(v1, sp.v);
    }
    // Clear of the long streets' own pieces at either end
    if (v1 - v0 >= TOWN_BLOCK) {
      addStreet(u, v0 + TOWN_STREET_HALF_WIDTH, u, v1 - TOWN_STREET_HALF_WIDTH);
    }
  }
  const town = {houses, streets, lines};
  if (_townHouses.size > 16) _townHouses.clear();
  _townHouses.set(key, town);
  return town;
}

// The pieces of town streets whose middles are on the chunk centered on
// (cx, cz)
function townStreetsNear(cx, cz, chunkSize, elevParams) {
  const half = chunkSize / 2;
  const out = [];
  for (const n of TOWN_ROADS) {
    const t = townAt(n, elevParams);
    if (
      !t ||
      Math.abs(t.x - cx) > half + t.radius ||
      Math.abs(t.z - cz) > half + t.radius
    ) {
      continue;
    }
    for (const st of townHouses(t).streets) {
      const mx = (st.x0 + st.x1) / 2 - cx;
      const mz = (st.z0 + st.z1) / 2 - cz;
      if (mx >= -half && mx < half && mz >= -half && mz < half) out.push(st);
    }
  }
  return out;
}

// Whether (x, z) is within `margin` of a town (townAt)
function nearTown(x, z, margin, elevParams) {
  for (const n of TOWN_ROADS) {
    const t = townAt(n, elevParams);
    if (t && Math.hypot(t.x - x, t.z - z) < t.radius + margin) return true;
  }
  return false;
}

// Calls fn(x0, z0, x1, z1, halfWidth) for each town street (a whole
// unbroken run) of any town within `reach` of (x, z)
export function forEachTownStreetNear(x, z, reach, elevParams, fn) {
  for (const n of TOWN_ROADS) {
    const t = townAt(n, elevParams);
    if (!t || Math.hypot(t.x - x, t.z - z) >= t.radius + reach) continue;
    for (const l of townHouses(t).lines) {
      fn(l.x0, l.z0, l.x1, l.z1, TOWN_STREET_HALF_WIDTH);
    }
  }
}

// Whether (x, z) is on a town's street, plus margin
export function isOnTownStreet(x, z, margin, elevParams) {
  const reach = TOWN_STREET_HALF_WIDTH + margin;
  const reach2 = reach * reach;
  for (const n of TOWN_ROADS) {
    const t = townAt(n, elevParams);
    if (!t || Math.hypot(t.x - x, t.z - z) >= t.radius + reach) continue;
    for (const s of townHouses(t).streets) {
      const dx = s.x1 - s.x0;
      const dz = s.z1 - s.z0;
      const u = Math.max(
        0,
        Math.min(1, ((x - s.x0) * dx + (z - s.z0) * dz) / (dx * dx + dz * dz))
      );
      const ex = x - s.x0 - dx * u;
      const ez = z - s.z0 - dz * u;
      if (ex * ex + ez * ez <= reach2) return true;
    }
  }
  return false;
}

// The houses of every road village that could reach the chunk centered on
// (cx, cz), and of any town
function roadVillageHousesNear(cx, cz, chunkSize, elevParams) {
  const reach = chunkSize / 2 + 100;
  const out = [];
  const towns = [];
  for (const n of TOWN_ROADS) {
    const t = townAt(n, elevParams);
    if (!t) continue;
    towns.push(t);
    if (
      Math.abs(t.x - cx) > reach + t.radius ||
      Math.abs(t.z - cz) > reach + t.radius
    ) {
      continue;
    }
    for (const h of townHouses(t).houses) {
      if (Math.abs(h.x - cx) < reach && Math.abs(h.z - cz) < reach) {
        out.push(h);
      }
    }
  }
  // Road villages give way to the towns
  const inTown = (h) =>
    towns.some((t) => Math.hypot(h.x - t.x, h.z - t.z) < t.radius + 150);
  const eastSpan = ChillFlightLogic.eastRoadSpan();
  for (let n = 0; n <= ChillFlightLogic.ROAD_SOUTH; n++) {
    const crossCountry = n === ChillFlightLogic.ROAD_EW;
    const east = n === ChillFlightLogic.ROAD_EAST;
    const coast = ChillFlightLogic.COAST_ROADS.includes(n);
    const coastSpan = coast ? ChillFlightLogic.coastRoadSpan(n) : null;
    if (east && !eastSpan) continue;
    if (coast && !coastSpan) continue;
    // The chunk's centre along the road and across it
    const ca = crossCountry || coast ? cx : cz;
    const cc = crossCountry || coast ? cz : cx;
    const slot0 = Math.floor((ca - reach - 500) / ROAD_VILLAGE_SLOT);
    const slot1 = Math.floor((ca + reach + 500) / ROAD_VILLAGE_SLOT);
    for (let slot = slot0; slot <= slot1; slot++) {
      const v = roadVillage(n, slot);
      if (!v || Math.abs(v.along - ca) > reach + v.half) continue;
      const across = ChillFlightLogic.roadCenter(n, v.along);
      if (Math.abs(across - cc) > reach + 400) continue;
      if (crossCountry) {
        // Within the road's ends, and clear of its run in to Meadow Field
        if (
          v.along - v.half < ChillFlightLogic.ROAD_EW_WEST ||
          v.along + v.half > ChillFlightLogic.ROAD_EW_EAST - 1500
        ) {
          continue;
        }
      } else if (east) {
        // Along its traced stretch, clear of its junction at the north end
        if (
          v.along - v.half < eastSpan[0] + 1500 ||
          v.along + v.half > eastSpan[1]
        ) {
          continue;
        }
      } else if (coast) {
        // Between its T junctions, clear of them
        if (
          v.along - v.half < coastSpan[0] + 1500 ||
          v.along + v.half > coastSpan[1] - 1500
        ) {
          continue;
        }
      } else if (across >= 0) {
        // The other north-south roads only run on the western land
        continue;
      }
      // Nor where the highway is left out (out at sea)
      if (!ChillFlightLogic.highwayRunsAt(n, v.along, simplex, elevParams)) {
        continue;
      }
      for (const h of roadVillageHouses(v)) {
        if (
          Math.abs(h.x - cx) < reach &&
          Math.abs(h.z - cz) < reach &&
          !inTown(h)
        ) {
          out.push(h);
        }
      }
    }
  }
  return out;
}

// What a breakable prop is, for how it breaks (breakables.js); SMALL is a
// campfire and the like, knocked apart, and a CRITTER (a penguin) gets out
// of the way instead
export const BREAKABLE = {TREE: 0, HOUSE: 1, SNOWMAN: 2, SMALL: 3, CRITTER: 4};

class InstanceCollector {
  constructor() {
    this.data = {};
    // Props that can be knocked over: each one's kind, and the instances
    // (type and index) drawing it, recorded between beginProp and endProp
    this.propKinds = [];
    this.propStarts = [];
    this.partTypes = [];
    this.partIndices = [];
    this.typeIds = new Map();
    this.propOpen = false;
  }

  beginProp(kind) {
    this.propKinds.push(kind);
    this.propStarts.push(this.partTypes.length);
    this.propOpen = true;
  }

  endProp() {
    this.propOpen = false;
  }

  add(type, matrixElements, color = null) {
    if (!this.data[type]) {
      const initialCapacity = 256;
      this.data[type] = {
        matrices: new Float32Array(initialCapacity * 16),
        colors: new Float32Array(initialCapacity * 3),
        count: 0,
        capacity: initialCapacity,
      };
    }

    const d = this.data[type];
    if (d.count >= d.capacity) {
      const newCapacity = d.capacity * 2;
      const newMatrices = new Float32Array(newCapacity * 16);
      newMatrices.set(d.matrices);
      d.matrices = newMatrices;

      const newColors = new Float32Array(newCapacity * 3);
      newColors.set(d.colors);
      d.colors = newColors;

      d.capacity = newCapacity;
    }

    d.matrices.set(matrixElements, d.count * 16);
    if (this.propOpen) {
      if (!this.typeIds.has(type)) this.typeIds.set(type, this.typeIds.size);
      this.partTypes.push(this.typeIds.get(type));
      this.partIndices.push(d.count);
    }

    if (color) {
      d.colors[d.count * 3] = color.r;
      d.colors[d.count * 3 + 1] = color.g;
      d.colors[d.count * 3 + 2] = color.b;
    }

    d.count++;
  }

  finish() {
    for (const type in this.data) {
      const d = this.data[type];
      if (d.count < d.capacity) {
        d.matrices = d.matrices.slice(0, d.count * 16);
        d.colors = d.colors.slice(0, d.count * 3);
        d.capacity = d.count;
      }
    }
    return this.data;
  }

  // The breakable props: prop i is drawn by parts propStarts[i] up to
  // propStarts[i + 1], each an instance (partIndices) of types[partTypes]
  breakables() {
    return {
      kinds: Uint8Array.from(this.propKinds),
      propStarts: Uint32Array.from([...this.propStarts, this.partTypes.length]),
      partTypes: Uint8Array.from(this.partTypes),
      partIndices: Uint32Array.from(this.partIndices),
      types: [...this.typeIds.keys()],
    };
  }
}

// House wall and roof colors, indexed by a house's bodyId and roofId. Houses
// are drawn by GlobalInstanceManager (terrain-chunks.js) in one white
// material tinted per instance; terrain-geometry.js builds the palettes the
// model debug page uses from these too.
export const HOUSE_BODY_COLORS = [
  0xf5e6c8, // Cream
  0xd9b99b, // Sandy tan
  0xb0c4a0, // Sage green
  0xc8d8e8, // Pale blue
  0xe8c8b0, // Terracotta peach
  0xccbbcc, // Dusty mauve
  // Stone, for the snowy north (6-8)
  0x9e9a92, // Grey stone
  0xb5ab9c, // Warm stone
  0x86827b, // Dark stone
  // Adobe, for the arid south (9-11)
  0xd9a066, // Ochre
  0xe3b98a, // Sand
  0xc98b5a, // Burnt clay
];
export const HOUSE_ROOF_COLORS = [
  0x5d4037, // Dark brown
  0x7b3f2a, // Brick red
  0x546e7a, // Slate blue-grey
  0x4a4a3a, // Charcoal
  // Slate, for stone houses (4-5)
  0x3f4a55, // Dark slate
  0x56606b, // Blue slate
  // Adobe's flat roof (6)
  0xc4956a, // Clay
];
const _houseBodyColors = HOUSE_BODY_COLORS.map((hex) => new Color(hex));
const _houseRoofColors = HOUSE_ROOF_COLORS.map((hex) => new Color(hex));
// Window pools: houses are split among this many window materials, which
// keep their own hours: lights on at dusk, off at bedtime (windowGlow in
// game-loop.js)
export const HOUSE_WINDOW_POOLS = 8;
// Each window's pool, as its instance colour (houseWindowMat reads red)
const _windowPools = Array.from({length: HOUSE_WINDOW_POOLS}, (_, i) => ({
  r: i / (HOUSE_WINDOW_POOLS - 1),
  g: 0,
  b: 0,
}));

// How far an adobe house's flat roof is squashed from the gable
const FLAT_ROOF = 0.12;

// Window spots on a house's walls (x along the ridge and y scale with the
// house; z is the wall)
const ONE_STORY_WINDOWS = [
  [-3, 4, 5.1],
  [3, 4, 5.1],
  [0, 4, -5.1],
];
const TWO_STORY_WINDOWS = [
  ...ONE_STORY_WINDOWS,
  [0, 10, 5.1],
  [-3, 10, 5.1],
  [3, 10, 5.1],
  [-3, 10, -5.1],
  [3, 10, -5.1],
];

// Adds the walls, roof, door, chimney and windows of each house to the
// collector, in world coordinates. Two-story houses have their own body, roof
// and chimney types; the door and windows are shared.
function collectHouses(collector, houses, twoStory, offsetX, offsetZ) {
  const prefix = twoStory ? 'twoStory' : 'house';
  // Where the gable's base sits, and the chimney's height above the walls'
  // default height
  const eaves = twoStory ? 14 : 8;
  const chimneyRise = twoStory ? 17.5 : 11;
  const windows = twoStory ? TWO_STORY_WINDOWS : ONE_STORY_WINDOWS;
  for (const pos of houses) {
    // The house's own proportions (sx along the ridge, sy up); its door,
    // windows and chimney move with the walls but keep their size
    const sx = pos.sx ?? 1;
    const sy = pos.sy ?? 1;
    const x = offsetX + pos.x;
    const z = offsetZ + pos.z;
    const cos = Math.cos(pos.rotY);
    const sin = Math.sin(pos.rotY);
    // A point on the house (lx along the ridge, ly up, lz toward the front)
    const part = (type, lx, ly, lz, color = null) => {
      composeMatrix(
        _matBuffer,
        0,
        x + lx * cos + lz * sin,
        pos.y + ly,
        z - lx * sin + lz * cos,
        1,
        1,
        1,
        0,
        pos.rotY,
        0
      );
      collector.add(type, _matBuffer, color);
    };

    collector.beginProp(BREAKABLE.HOUSE);
    composeMatrix(_matBuffer, 0, x, pos.y, z, sx, sy, 1, 0, pos.rotY, 0);
    collector.add(prefix + 'Body', _matBuffer, _houseBodyColors[pos.bodyId]);
    // Adobe: the gable squashed into a flat slab on top of the walls (its
    // base stays put), and no chimney
    const adobe = pos.style === 'adobe';
    if (!adobe)
      part(prefix + 'Chimney', 2.5 * sx, chimneyRise * (sy - 1), -2.5);
    const roofScale = adobe ? FLAT_ROOF : 1;
    composeMatrix(
      _matBuffer,
      0,
      x,
      pos.y + eaves * sy * (1 - roofScale),
      z,
      sx,
      sy * roofScale,
      1,
      0,
      pos.rotY,
      0
    );
    collector.add(prefix + 'Roof', _matBuffer, _houseRoofColors[pos.roofId]);

    part('houseDoor', 0, 2.25, 5.1);
    for (const [wx, wy, wz] of windows) {
      part('houseWindow', wx * sx, wy * sy, wz, _windowPools[pos.poolId]);
    }
    collector.endProp();
  }
}

// The direction the wind blows toward, on the XZ plane (not normalized)
export const WIND_DIR_X = 0.8;
export const WIND_DIR_Z = 0.5;
// Windmills all turn their sails (+Z in model space) into the wind.
export const WINDMILL_ROT_Y = Math.atan2(-WIND_DIR_X, -WIND_DIR_Z);
// The sails' hub on the windmill, up and out front (units; the Polyfork
// model's hub, farm-models.js buildWindmillGeos)
const WINDMILL_HUB_Y = 31.23;
const WINDMILL_HUB_Z = 8.88;
// A red barn's silo stands this far to its side (units, before turning)
const BARN_SILO_X = 15;
// North of this (units) the farms' barns are timber-framed barns or alpine
// hay barns instead of red ones, half and half
const NORTH_BARNS_Z = -4500;
// Which barn stands at (x, z): its type's name ('barn' for the red one)
function barnStyle(x, z) {
  if (z > NORTH_BARNS_Z) return 'barn';
  return fieldHash(Math.round(x), Math.round(z), 811) < 0.5
    ? 'timberBarn'
    : 'hayBarn';
}

// Adds straw huts, barns (and their silos), monasteries, castle ruins and
// windmills to the collector, each a breakable prop, in world coordinates.
// Huts keep their own scale; the rest are drawn at their model's size.
function collectStructures(collector, positions, offsetX, offsetZ) {
  const place = (type, x, y, z, s, rx, ry, rz) => {
    composeMatrix(_matBuffer, 0, x, y, z, s, s, s, rx, ry, rz);
    collector.add(type, _matBuffer);
  };
  const simple = (list, body, roof, scaled) => {
    for (const pos of list) {
      const s = scaled ? (pos.scale ?? 1) : 1;
      const x = offsetX + pos.x;
      const z = offsetZ + pos.z;
      collector.beginProp(BREAKABLE.HOUSE);
      place(body, x, pos.y, z, s, 0, pos.rotY, 0);
      if (roof) place(roof, x, pos.y, z, s, 0, pos.rotY, 0);
      collector.endProp();
    }
  };
  simple(positions.strawHutPositions, 'strawHutBody', 'strawHutRoof', true);
  simple(positions.monasteryPositions, 'monasteryBody', 'monasteryRoof');
  simple(positions.castleRuinsPositions, 'castleRuins', null);

  for (const pos of positions.barnPositions) {
    const x = offsetX + pos.x;
    const z = offsetZ + pos.z;
    const r = pos.rotY;
    const style = barnStyle(x, z);
    collector.beginProp(BREAKABLE.HOUSE);
    place(style + 'Body', x, pos.y, z, 1, 0, r, 0);
    place(style + 'Roof', x, pos.y, z, 1, 0, r, 0);
    collector.endProp();
    // A red barn's silo stands on its own, and topples
    if (style !== 'barn') continue;
    const silo = rotateY(BARN_SILO_X, 0, r);
    collector.beginProp(BREAKABLE.TREE);
    place('barnSiloBody', x + silo.x, pos.y, z + silo.z, 1, 0, r, 0);
    place('barnSiloRoof', x + silo.x, pos.y, z + silo.z, 1, 0, r, 0);
    collector.endProp();
  }

  // Each windmill's tower and its sails, on their hub out front
  const hub = rotateY(0, WINDMILL_HUB_Z, WINDMILL_ROT_Y);
  for (const pos of positions.windmillPositions) {
    const x = offsetX + pos.x;
    const z = offsetZ + pos.z;
    collector.beginProp(BREAKABLE.HOUSE);
    place('windmillBase', x, pos.y, z, 1.5, 0, WINDMILL_ROT_Y, 0);
    place(
      'windmillBlades',
      x + hub.x,
      pos.y + WINDMILL_HUB_Y,
      z + hub.z,
      1.5,
      0,
      WINDMILL_ROT_Y,
      0
    );
    collector.endProp();
  }
}

// Adds each piece of town street as a slab of asphalt tilted to the ground
// under it (a plane fitted to the mesh along and across the piece), raised
// just enough that the ground doesn't poke through. The box is sheared, not
// rotated: its sides stay vertical
const STREET_SAMPLES = [-1, 0, 1];
function collectTownStreets(
  collector,
  streets,
  offsetX,
  offsetZ,
  heightAt,
  waterLevel
) {
  const hw = TOWN_STREET_HALF_WIDTH;
  const ground = new Float32Array(9);
  for (const st of streets) {
    const x0 = st.x0 - offsetX;
    const z0 = st.z0 - offsetZ;
    const dx = st.x1 - st.x0;
    const dz = st.z1 - st.z0;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const mx = x0 + dx / 2;
    const mz = z0 + dz / 2;
    // Ground on a 3x3 grid over the piece: i along, j across
    let mean = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const a = (STREET_SAMPLES[i] * len) / 2;
        const c = STREET_SAMPLES[j] * hw;
        const y = heightAt(mx + ux * a - uz * c, mz + uz * a + ux * c);
        ground[i * 3 + j] = y;
        mean += y / 9;
      }
    }
    const along =
      (ground[6] + ground[7] + ground[8] - ground[0] - ground[1] - ground[2]) /
      (3 * len);
    const across =
      (ground[2] + ground[5] + ground[8] - ground[0] - ground[3] - ground[6]) /
      (6 * hw);
    // Not into water, up steep ground or across an airfield, where the
    // houses either side are left out too
    if (
      Math.min(...ground) < waterLevel + 2 ||
      Math.abs(along) > 0.2 ||
      Math.abs(across) > 0.2 ||
      ChillFlightLogic.isOnAirport(st.x0 + dx / 2, st.z0 + dz / 2, 40)
    ) {
      continue;
    }
    let lift = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const plane =
          mean +
          (along * STREET_SAMPLES[i] * len) / 2 +
          across * STREET_SAMPLES[j] * hw;
        lift = Math.max(lift, ground[i * 3 + j] - plane);
      }
    }
    // A slab 3 thick, its top 0.3 above the highest ground under it, a
    // little longer than the piece so neighbours overlap
    const w = hw * 2;
    const l = len + 1.5;
    const m = _matBuffer;
    m[0] = uz * w;
    m[1] = -across * w;
    m[2] = -ux * w;
    m[3] = 0;
    m[4] = 0;
    m[5] = 3;
    m[6] = 0;
    m[7] = 0;
    m[8] = ux * l;
    m[9] = along * l;
    m[10] = uz * l;
    m[11] = 0;
    m[12] = st.x0 + dx / 2;
    m[13] = mean + lift + 0.3 - 1.5;
    m[14] = st.z0 + dz / 2;
    m[15] = 1;
    collector.add('townStreet', m);
  }
}

function getElevation(x, z, elevParams) {
  return ChillFlightLogic.getElevation(
    x,
    z,
    simplex,
    elevParams,
    (a, b, t) => a + (b - a) * t
  );
}

// Lily pads float only on sheltered water (ponds, lakes, rivers, inlets):
// land within LILY_SHELTER units on at least two of eight sides
const LILY_SHELTER = 150;
function shelteredWater(x, z, elevParams) {
  let land = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    if (
      getElevation(
        x + Math.cos(a) * LILY_SHELTER,
        z + Math.sin(a) * LILY_SHELTER,
        elevParams
      ) > elevParams.WATER_LEVEL &&
      ++land >= 2
    )
      return true;
  }
  return false;
}

// Small boats (Polyfork models, terrain-chunks.js): the chance a water grid
// point has one (before it's sorted by where it is), how far out a fishing
// boat may sit from land, and south of this (units) the fishing boats are
// the island kind
const SMALL_BOAT_CHANCE = 0.0012;
// Floating boats need this much water under them (units), so none sit on
// the beach at the water's edge
const SMALL_BOAT_MIN_DEPTH = 2;
const FISHING_BOAT_NEAR_LAND = 500;
const SOUTH_BOATS_Z = 6000;
// A sunken boat lies in water this shallow (its grid point's height below
// sea level; the sea floor is drawn 5 lower) once in this many points
const SUNKEN_BOAT_DEPTH = [3, 8];
const SUNKEN_BOAT_CHANCE = 0.0004;
// Coral reefs drawn in the shallow water's colour (the water shader tints
// by these weights): south of this z, or among the island palms, in simplex
// patches of this scale (faded in between these values), in water this deep
// (fading in over the first pair, out over the second)
const REEF_SOUTH_Z = 6000;
const REEF_PATCH_SCALE = 0.0012;
const REEF_PATCH = [-0.35, 0.25];
// Reefs fade with depth in the water shader
function reefStep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
// Per height-grid point, how much reef there is in two colours (dark teal,
// dusky pink), interleaved, for the water's depth texture (terrain-chunks.js)
function reefWeights(
  heightGrid,
  gridX1,
  step,
  halfSize,
  worldOffsetX,
  worldOffsetZ,
  elevParams
) {
  const out = new Float32Array(gridX1 * gridX1 * 2);
  const wl = elevParams.WATER_LEVEL;
  for (let gz = 0; gz < gridX1; gz++) {
    const z = worldOffsetZ - halfSize + gz * step;
    if (z <= -5000) continue;
    for (let gx = 0; gx < gridX1; gx++) {
      const x = worldOffsetX - halfSize + gx * step;
      if (z <= REEF_SOUTH_Z && x <= 3000) continue;
      const depth = wl - heightGrid[gz * gridX1 + gx];
      // Loose gate only: far chunks have coarse height grids whose points
      // rarely land in the shallow band, so the water shader fades reefs by
      // its own interpolated depth instead
      if (depth < -30 || depth > 40) continue;
      const patch = simplex.noise2D(
        x * REEF_PATCH_SCALE + 7.7,
        z * REEF_PATCH_SCALE - 3.1
      );
      if (patch <= REEF_PATCH[0]) continue;
      if (z <= REEF_SOUTH_Z && ChillFlightLogic.getBiome(x, z, simplex) >= -0.1)
        continue;
      if (
        ChillFlightLogic.snowFactorAt(
          z,
          ChillFlightLogic.snowNoiseShift(x, z, simplex)
        ) > 0 ||
        ChillFlightLogic.swampFactorAt(x, z, simplex) > 0.1
      )
        continue;
      const flow = ChillFlightLogic.getRiverFlow(x, z, simplex);
      if (flow && Math.hypot(flow[0], flow[1]) > RIVER_BOAT_FLOW) continue;
      const w = reefStep(REEF_PATCH[0], REEF_PATCH[1], patch);
      const hue = reefStep(
        -0.3,
        0.3,
        simplex.noise2D(x * 0.006 - 19.3, z * 0.006 + 4.2)
      );
      out[(gz * gridX1 + gx) * 2] = w * (1 - hue);
      out[(gz * gridX1 + gx) * 2 + 1] = w * hue;
    }
  }
  return out;
}
// How strong a river's flow keeps the small boats off it
const RIVER_BOAT_FLOW = 0.5;
// How far a lake rowboat looks for the shore, and how far its middle sits
// back from the water's edge (its bow up on the sand), in units
const ROWBOAT_SHORE_REACH = 120;
const ROWBOAT_BEACHED = 4;
// How high a beached rowboat sits over the sand (it's built sunk to its
// waterline)
const ROWBOAT_KEEL = 0.6;
// The highest a beached rowboat's spot may be above the water (units)
const ROWBOAT_SHORE_RISE = 2;

// Which small boat (if any) a water point gets: a flat river boat on the
// rivers (along the flow), rowboats on lakes and ponds, and fishing boats in
// inlets and close inshore on the sea. Returns {type, rotY} or null.
function smallBoatAt(x, z, hash, elevParams, gridSpacing) {
  // None on the rivers (an empty boat in midstream looks lost)
  const flow = ChillFlightLogic.getRiverFlow(x, z, simplex);
  if (flow && Math.hypot(flow[0], flow[1]) > RIVER_BOAT_FLOW) return null;
  const rotY = hash(5) * Math.PI * 2;
  // Two paint schemes of each fishing boat
  const fishing =
    (z > SOUTH_BOATS_Z ? 'islandBoat' : 'fishingBoat') +
    (hash(13) < 0.5 ? 'Body' : '2Body');
  if (shelteredWater(x, z, elevParams)) {
    // Shut in on most sides: a lake or pond; open to the sea: an inlet
    let open = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (
        getElevation(
          x + Math.cos(a) * 1500,
          z + Math.sin(a) * 1500,
          elevParams
        ) <= elevParams.WATER_LEVEL
      )
        open++;
    }
    if (open < 3) {
      // A rowboat pulled up on the lake's shore, bow on the sand, so an
      // empty one reads as put away rather than adrift: toward the nearest
      // shore, if it's close
      let best = null;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + hash(9);
        const dx = Math.sin(a);
        const dz = Math.cos(a);
        for (let d = 4; d <= ROWBOAT_SHORE_REACH; d += 4) {
          if (best && d >= best.d) break;
          // The drawn shore runs by the first dry grid point (the sea
          // floor is drawn lower), so go by the grid point nearest
          const vx = Math.round((x + dx * d) / gridSpacing) * gridSpacing;
          const vz = Math.round((z + dz * d) / gridSpacing) * gridSpacing;
          if (getElevation(vx, vz, elevParams) > elevParams.WATER_LEVEL) {
            // That point's distance along the way
            const along = (vx - x) * dx + (vz - z) * dz;
            if (along > 0) best = {d: along, dx, dz, a};
            break;
          }
        }
      }
      if (!best) return null;
      const back = best.d - ROWBOAT_BEACHED;
      // Only on a gentle shore, low and flat enough to pull a boat up on
      const ground = getElevation(
        x + best.dx * back,
        z + best.dz * back,
        elevParams
      );
      if (ground > elevParams.WATER_LEVEL + ROWBOAT_SHORE_RISE) return null;
      return {
        type: hash(7) < 0.5 ? 'rowboatBody' : 'woodenRowboatBody',
        rotY: best.a,
        dx: best.dx * back,
        dz: best.dz * back,
        // Resting on the sand where it's dry under it
        y: Math.max(elevParams.WATER_LEVEL, ground + ROWBOAT_KEEL),
      };
    }
    return {type: fishing, rotY};
  }
  // On the sea, only close inshore
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + hash(9);
    if (
      getElevation(
        x + Math.cos(a) * FISHING_BOAT_NEAR_LAND,
        z + Math.sin(a) * FISHING_BOAT_NEAR_LAND,
        elevParams
      ) > elevParams.WATER_LEVEL
    )
      return {type: fishing, rotY};
  }
  return null;
}

// Pirate ships only sail water at least this deep, at their spot and 300
// units around it, so they stay off the south coast's shallow shelf (2 to
// 4.5 units deep, see southShelfFloor) and other shallows.
const PIRATE_SHIP_MIN_DEPTH = 6;
// Boats stay within this far (units, ~4 km) of land, so the open ocean
// past the coasts and islands is empty
const BOAT_MAX_OFFSHORE = 8000;
// Whether there's land within BOAT_MAX_OFFSHORE of (x, z): rings of samples
// 1000 units apart, nearest first, so islets aren't missed
function landNear(x, z, elevParams) {
  for (let r = 1000; r <= BOAT_MAX_OFFSHORE; r += 1000) {
    const n = Math.ceil((2 * Math.PI * r) / 1000);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const h = getElevation(
        x + Math.cos(a) * r,
        z + Math.sin(a) * r,
        elevParams
      );
      if (h > elevParams.WATER_LEVEL) return true;
    }
  }
  return false;
}

// Water depth averaged over about +-6 grid cells (~300 units on the mid
// preset), for the water's color and transparency: they blend gradually
// from the beach to open water instead of following the steep true depth.
// Samples a few cells past the chunk edge so neighboring chunks match.
const SOFT_DEPTH_PAD = 6;
function softenedWaterDepth(
  heightGrid,
  gridX1,
  step,
  halfSize,
  worldOffsetX,
  worldOffsetZ,
  elevParams
) {
  const P = SOFT_DEPTH_PAD;
  const W = gridX1 + 2 * P;
  let a = new Float32Array(W * W);
  let b = new Float32Array(W * W);
  for (let iz = 0; iz < W; iz++) {
    for (let ix = 0; ix < W; ix++) {
      const gx = ix - P;
      const gz = iz - P;
      const inside = gx >= 0 && gx < gridX1 && gz >= 0 && gz < gridX1;
      const h = inside
        ? heightGrid[gz * gridX1 + gx]
        : getElevation(
            worldOffsetX - halfSize + gx * step,
            worldOffsetZ - halfSize + gz * step,
            elevParams
          );
      a[iz * W + ix] = Math.max(-10, Math.min(10, elevParams.WATER_LEVEL - h));
    }
  }
  // Two box-blur passes of radius 3 in each direction (a tent of radius 6).
  const R = 3;
  const clampI = (i) => (i < 0 ? 0 : i >= W ? W - 1 : i);
  for (let pass = 0; pass < 2; pass++) {
    for (let iz = 0; iz < W; iz++) {
      for (let ix = 0; ix < W; ix++) {
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += a[iz * W + clampI(ix + k)];
        b[iz * W + ix] = sum / (2 * R + 1);
      }
    }
    for (let iz = 0; iz < W; iz++) {
      for (let ix = 0; ix < W; ix++) {
        let sum = 0;
        for (let k = -R; k <= R; k++) sum += b[clampI(iz + k) * W + ix];
        a[iz * W + ix] = sum / (2 * R + 1);
      }
    }
  }
  const out = new Float32Array(gridX1 * gridX1);
  for (let gz = 0; gz < gridX1; gz++) {
    for (let gx = 0; gx < gridX1; gx++) {
      out[gz * gridX1 + gx] = a[(gz + P) * W + gx + P];
    }
  }
  return out;
}

// Returns {result, transferables}: the chunk's buffers, instance data and
// prop placements, plus the buffers to transfer when posting from a worker.
// --- WATERFALLS ---
// Now and then a waterfall where a stream meets a tall, sheer drop into open
// water. Few places pass, on purpose: a few great falls rather than many
// awkward ones. Returns the fall's course (local x, y, z points, top to
// bottom), the stream feeding it (source to lip) and the patch of height grid
// around both, so they can lie on the terrain as drawn; or null. Its own
// random numbers, so the chunk's other props don't move.
// Where to start looking: points this far above the water
const WATERFALL_MIN_DROP = 45;
// How tall a fall has to be, and how sheer (down per unit across), at least
const WATERFALL_MIN_HEIGHT = 150;
const WATERFALL_MIN_SHEER = 1.5;
// How much of the ground within WATERFALL_POOL units of where it lands has to
// be water, so it lands in open water rather than a narrow inlet
const WATERFALL_POOL = 150;
const WATERFALL_MIN_OPEN = 0.3;
// How far the stream above a fall runs, at most
const WATERFALL_STREAM_LENGTH = 300;
// How far a stream has to run into a fall, at least, on gentle ground
const WATERFALL_MIN_STREAM = 100;
// A stream steeper than this (up per unit across) is part of the fall
const WATERFALL_STREAM_STEEP = 0.6;
// The stream feeding grid cell (x0, z0), as grid cells from there up to its
// source: each step to the higher neighbor that drains into it (whose own
// steepest way down leads here), the steepest of those, so it keeps to the
// valley floor; until nothing drains in or it has run far enough. Its
// length (in units) is upstream.run.
function traceStream(heightGrid, gridX1, step, x0, z0) {
  const drainsTo = (x, z) => {
    const h = heightGrid[z * gridX1 + x];
    let best = -1;
    let steepest = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const slope =
          (h - heightGrid[(z + dz) * gridX1 + x + dx]) / Math.hypot(dx, dz);
        if (slope > steepest) {
          steepest = slope;
          best = (z + dz) * gridX1 + x + dx;
        }
      }
    }
    return best;
  };
  const upstream = [[x0, z0]];
  let sx = x0;
  let sz = z0;
  let run = 0;
  while (run < WATERFALL_STREAM_LENGTH) {
    const h = heightGrid[sz * gridX1 + sx];
    const here = sz * gridX1 + sx;
    let nx = -1;
    let nz = -1;
    let nd = 0;
    let steepest = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = sx + dx;
        const z = sz + dz;
        if (x < 1 || z < 1 || x >= gridX1 - 1 || z >= gridX1 - 1) continue;
        const d = Math.hypot(dx, dz);
        const slope = (heightGrid[z * gridX1 + x] - h) / d;
        if (slope > steepest && drainsTo(x, z) === here) {
          steepest = slope;
          nx = x;
          nz = z;
          nd = d;
        }
      }
    }
    if (nx < 0) break;
    sx = nx;
    sz = nz;
    run += nd * step;
    upstream.push([sx, sz]);
  }
  upstream.run = run;
  return upstream;
}

// The falls landmark's lip (a grid cell on the top, just inside the wall),
// stream (grid cells from the lip up its valley to the pond) and the curve
// of the valley (local x, z from the pond to the lip), when it's in chunk
// (chunkX, chunkZ); otherwise null
function fallsCells(chunkX, chunkZ, chunkSize, step) {
  const L = ChillFlightLogic;
  if (
    chunkX !== Math.round(L.FALLS_X / chunkSize) ||
    chunkZ !== Math.round(L.FALLS_Z / chunkSize)
  ) {
    return null;
  }
  const x0 = L.FALLS_X - chunkX * chunkSize + chunkSize / 2;
  const z0 = L.FALLS_LIP_Z - chunkZ * chunkSize + chunkSize / 2;
  const lip = [Math.round(x0 / step), Math.floor(z0 / step)];
  const stream = [lip];
  for (let s = step; s < L.FALLS_POND + step; s += step / 2) {
    const along = Math.min(s, L.FALLS_POND);
    const cell = [
      Math.round((x0 + L.fallsValleyX(along)) / step),
      Math.round((z0 - along) / step),
    ];
    const last = stream[stream.length - 1];
    if (cell[0] !== last[0] || cell[1] !== last[1]) stream.push(cell);
  }
  let run = 0;
  for (let i = 1; i < stream.length; i++) {
    run += Math.hypot(
      stream[i][0] - stream[i - 1][0],
      stream[i][1] - stream[i - 1][1]
    );
  }
  stream.run = run * step;
  // The stream as drawn follows the valley itself, smoother than the cells,
  // to the lip's cell: the terrain as drawn slopes from there to the next
  // cell, down the wall, so any further and it would run down the rock
  const curve = [];
  const last = z0 - lip[1] * step;
  for (let along = L.FALLS_POND; along > last; along -= 10) {
    curve.push([
      x0 + L.fallsValleyX(along) - chunkSize / 2,
      z0 - along - chunkSize / 2,
    ]);
  }
  curve.push([
    x0 + L.fallsValleyX(last) - chunkSize / 2,
    z0 - last - chunkSize / 2,
  ]);
  return {lip, stream, curve, edge: z0 - chunkSize / 2};
}

// How far out from the lip the landmark's fall lands, leaping clear of the
// rock so there's room to fly behind it
const FALLS_LEAP = 150;
// The landmark's fall: from the end of its valley (curve, from fallsCells)
// at height top, over the edge (local z) and down to the water, out south
// (the way its bay faces) as it falls, like water thrown off a ledge (out
// with the square root of the drop)
function leapCourse(curve, edge, top, water) {
  const [x0, z0] = curve[curve.length - 1];
  // Starting a little back over the stream, where the fall fades in
  const course = [[x0, top, z0 - 12]];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    course.push([x0, top - (top - water) * f * f, edge + FALLS_LEAP * f]);
  }
  return course;
}

// Whether chunk (chunkX, chunkZ) may have a waterfall: its own random number
// is higher than the four chunks beside it, so falls are never side by side
// (a long cliff coast would otherwise line up several) and only about one
// chunk in five looks for one. The falls landmark's chunk always looks, and
// the four beside it never do.
function waterfallChunk(chunkX, chunkZ, chunkSize) {
  const fx = Math.round(ChillFlightLogic.FALLS_X / chunkSize);
  const fz = Math.round(ChillFlightLogic.FALLS_Z / chunkSize);
  const fromFalls = Math.abs(chunkX - fx) + Math.abs(chunkZ - fz);
  if (fromFalls === 0) return true;
  if (fromFalls === 1) return false;
  const lot = (x, z) =>
    ChillFlightLogic.mulberry32(
      (ChillFlightLogic.WORLD_SEED ^ (x * 73856093) ^ (z * 19349663)) + 4242
    )();
  const mine = lot(chunkX, chunkZ);
  return (
    lot(chunkX - 1, chunkZ) < mine &&
    lot(chunkX + 1, chunkZ) < mine &&
    lot(chunkX, chunkZ - 1) < mine &&
    lot(chunkX, chunkZ + 1) < mine
  );
}

// The falls landmark passes `fixed`, its lip and stream (see fallsCells):
// only that lip is tried, with that stream, and it skips the bar (the
// landmark is built to pass it).
function findWaterfall(heightGrid, gridX1, step, halfSize, water, fixed) {
  const heightOf = ([x, z]) => heightGrid[z * gridX1 + x];
  let best = null;
  let bestStream = null;
  let bestScore = 0;
  // Stay a few cells inside the chunk, so the path's neighbors exist
  for (let iz = 2; iz < gridX1 - 2; iz++) {
    for (let ix = 2; ix < gridX1 - 2; ix++) {
      if (fixed && (ix !== fixed.lip[0] || iz !== fixed.lip[1])) continue;
      const top = heightGrid[iz * gridX1 + ix];
      if (top - water < WATERFALL_MIN_DROP) continue;
      // Downhill, steepest neighbor each step, until the water
      const path = [[ix, iz]];
      let cx = ix;
      let cz = iz;
      let h = top;
      let length = 0;
      let reached = false;
      for (let s = 0; s < 12; s++) {
        let nx = -1;
        let nz = -1;
        let nh = h;
        let nd = 0;
        let steepest = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dz) continue;
            const x = cx + dx;
            const z = cz + dz;
            if (x < 1 || z < 1 || x >= gridX1 - 1 || z >= gridX1 - 1) continue;
            const d = Math.hypot(dx, dz);
            const hh = heightGrid[z * gridX1 + x];
            // The biggest drop per unit across
            const slope = (h - hh) / d;
            if (slope > steepest) {
              steepest = slope;
              nx = x;
              nz = z;
              nh = hh;
              nd = d;
            }
          }
        }
        if (nx < 0) break;
        cx = nx;
        cz = nz;
        h = nh;
        length += nd * step;
        path.push([cx, cz]);
        if (h < water - 1) {
          reached = true;
          break;
        }
      }
      if (!reached) continue;
      // The stream feeding it; where it runs down steep rock, that's part
      // of the fall, so the stream only lies on gentle ground
      const stream =
        fixed?.stream ?? traceStream(heightGrid, gridX1, step, ix, iz);
      let k = 0;
      let steepRun = 0;
      while (k + 1 < stream.length) {
        const across = Math.hypot(
          stream[k + 1][0] - stream[k][0],
          stream[k + 1][1] - stream[k][1]
        );
        const up = heightOf(stream[k + 1]) - heightOf(stream[k]);
        if (up / (across * step) < WATERFALL_STREAM_STEEP) break;
        steepRun += across * step;
        k++;
      }
      const gentleRun = stream.run - steepRun;
      const height = heightOf(stream[k]) - water;
      // Gentle all the way to its source, not steep again further up
      const climb = heightOf(stream[stream.length - 1]) - (height + water);
      length += steepRun;
      if (
        !fixed &&
        (gentleRun < WATERFALL_MIN_STREAM ||
          climb / gentleRun > WATERFALL_STREAM_STEEP ||
          // Tall and sheer, not a slide down a slope
          height < WATERFALL_MIN_HEIGHT ||
          height / length < WATERFALL_MIN_SHEER)
      ) {
        continue;
      }
      // Into open water
      const [bx, bz] = path[path.length - 1];
      const reach = Math.round(WATERFALL_POOL / step);
      let wet = 0;
      let all = 0;
      for (let dz = -reach; dz <= reach; dz++) {
        for (let dx = -reach; dx <= reach; dx++) {
          const x = bx + dx;
          const z = bz + dz;
          if (dx * dx + dz * dz > reach * reach) continue;
          if (x < 0 || z < 0 || x >= gridX1 || z >= gridX1) continue;
          all++;
          if (heightGrid[z * gridX1 + x] < water) wet++;
        }
      }
      if (!fixed && wet < all * WATERFALL_MIN_OPEN) continue;
      const score = (height / length) * height;
      if (score > bestScore) {
        bestScore = score;
        best = stream
          .slice(1, k + 1)
          .reverse()
          .concat(path);
        bestStream = stream.slice(k);
      }
    }
  }
  if (!best) return null;
  const toLocal = ([x, z]) => [
    -halfSize + x * step,
    heightGrid[z * gridX1 + x],
    -halfSize + z * step,
  ];
  const course = fixed
    ? leapCourse(fixed.curve, fixed.edge, heightOf(best[0]), water)
    : best.map(toLocal);
  const nearest = (v) =>
    Math.min(gridX1 - 1, Math.max(0, Math.round((v + halfSize) / step)));
  const stream = fixed
    ? fixed.curve.map(([x, z]) => [
        x,
        heightGrid[nearest(z) * gridX1 + nearest(x)],
        z,
      ])
    : bestStream.reverse().map(toLocal);
  best.push(...bestStream);
  // Wide enough for the fall's full width either side of its course, for it
  // to stand out from a gully (MAX_OUT in waterfalls.js), and for a pond at
  // the stream's source (POND_RADIUS)
  const pad = Math.ceil(90 / step) + 1;
  const xs = best.map((p) => p[0]);
  const zs = best.map((p) => p[1]);
  const x0 = Math.max(0, Math.min(...xs) - pad);
  const z0 = Math.max(0, Math.min(...zs) - pad);
  const x1 = Math.min(gridX1 - 1, Math.max(...xs) + pad);
  const z1 = Math.min(gridX1 - 1, Math.max(...zs) + pad);
  const cols = x1 - x0 + 1;
  const rows = z1 - z0 + 1;
  const heights = new Float32Array(cols * rows);
  for (let z = 0; z < rows; z++) {
    for (let x = 0; x < cols; x++) {
      heights[z * cols + x] = heightGrid[(z0 + z) * gridX1 + x0 + x];
    }
  }
  return {
    course,
    stream,
    leap: !!fixed,
    ground: {
      x: -halfSize + x0 * step,
      z: -halfSize + z0 * step,
      step,
      cols,
      rows,
      heights,
    },
  };
}

// Heights at `positions` (chunk-local x, z) as the distant terrain ring draws
// them: sampled on its grid (`cell` world units per cell, `segments` squares
// each, lined up on cell edges) and interpolated across the same two
// triangles per square as its PlaneGeometry.
function coarseGridHeights(
  positions,
  worldOffsetX,
  worldOffsetZ,
  halfSize,
  {cell, segments},
  elevParams
) {
  const step = cell / segments;
  const origin = -cell / 2;
  const nx0 = Math.floor((worldOffsetX - halfSize - origin) / step);
  const nz0 = Math.floor((worldOffsetZ - halfSize - origin) / step);
  const n = Math.ceil((2 * halfSize) / step) + 2;
  const grid = new Float32Array(n * n);
  for (let gz = 0; gz < n; gz++) {
    const wz = origin + (nz0 + gz) * step;
    for (let gx = 0; gx < n; gx++) {
      const wx = origin + (nx0 + gx) * step;
      grid[gz * n + gx] = getElevation(wx, wz, elevParams);
    }
  }
  const out = new Float32Array(positions.length / 3);
  for (let i = 0; i < out.length; i++) {
    const u = (worldOffsetX + positions[i * 3] - origin) / step - nx0;
    const v = (worldOffsetZ + positions[i * 3 + 2] - origin) / step - nz0;
    const gx = Math.min(n - 2, Math.max(0, Math.floor(u)));
    const gz = Math.min(n - 2, Math.max(0, Math.floor(v)));
    const fu = u - gx;
    const fv = v - gz;
    const h00 = grid[gz * n + gx];
    const h10 = grid[gz * n + gx + 1];
    const h01 = grid[(gz + 1) * n + gx];
    const h11 = grid[(gz + 1) * n + gx + 1];
    // PlaneGeometry splits each square along the (0,1)-(1,0) diagonal
    out[i] =
      fu + fv <= 1
        ? h00 + fu * (h10 - h00) + fv * (h01 - h00)
        : h11 + (1 - fu) * (h01 - h11) + (1 - fv) * (h10 - h11);
  }
  return out;
}

// A rock breakwater for a chunk, or null: tries spots on the beach (in a
// fixed hashed order) near a harbour anchor, runs out toward the deepest
// water, and keeps the first whose whole curving length lies over shallow
// open sea. Returns its rubble segments (local x/z, waterline y, rotY,
// stretch, variant) and the beacon at the end.
function findBreakwater(
  chunkX,
  chunkZ,
  worldOffsetX,
  worldOffsetZ,
  halfSize,
  elevParams,
  anchors,
  piers
) {
  const wl = elevParams.WATER_LEVEL;
  const elev = (x, z) => getElevation(x, z, elevParams);
  const near2 = BREAKWATER_HARBOUR_RANGE * BREAKWATER_HARBOUR_RANGE;
  const STEP = 25;
  const n = Math.floor((halfSize * 2 - 200) / STEP);
  for (let t = 0; t < 400; t++) {
    const i = Math.floor(fireHash(chunkX, chunkZ, 1900 + t) * n * n);
    const lx = -halfSize + 100 + (i % n) * STEP;
    const lz = -halfSize + 100 + Math.floor(i / n) * STEP;
    const wx = worldOffsetX + lx;
    const wz = worldOffsetZ + lz;
    const h = elev(wx, wz);
    // At the water's edge (the rubble starts at the waterline)
    if (h < wl - 2 || h > wl + 5) continue;
    if (!anchors.some((p) => (p.x - lx) ** 2 + (p.z - lz) ** 2 < near2)) {
      continue;
    }
    if (piers.some((p) => (p.x - lx) ** 2 + (p.z - lz) ** 2 < 120 * 120)) {
      continue;
    }
    if (
      ChillFlightLogic.alienAt(wx, wz, simplex) > ALIEN_PROPS_AT ||
      ChillFlightLogic.swampFactorAt(wx, wz, simplex) > 0.1 ||
      ChillFlightLogic.snowFactorAt(
        wz,
        ChillFlightLogic.snowNoiseShift(wx, wz, simplex)
      ) > 0.5
    ) {
      continue;
    }
    // Out toward the deepest water 60 units off
    let angle = -1;
    let deepest = wl;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const d = elev(wx + Math.sin(a) * 60, wz + Math.cos(a) * 60);
      if (d < deepest) {
        deepest = d;
        angle = a;
      }
    }
    if (angle === -1) continue;
    // The open sea, not a lake or a river: water most ways 1.5 km out
    let open = 0;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      if (elev(wx + Math.cos(a) * 1500, wz + Math.sin(a) * 1500) <= wl) open++;
    }
    if (open < 4) continue;
    const length =
      BREAKWATER_LENGTH[0] +
      (BREAKWATER_LENGTH[1] - BREAKWATER_LENGTH[0]) *
        fireHash(chunkX, chunkZ, 1811 + t);
    const bend = (fireHash(chunkX, chunkZ, 1812 + t) * 2 - 1) * BREAKWATER_BEND;
    const segs = Math.round(length / BREAKWATER_SEGMENT);
    const out = [];
    let x = wx;
    let z = wz;
    let a = angle;
    let ok = true;
    for (let k = 0; k <= segs && ok; k++) {
      // The bend comes in over the outer half
      if (k > segs / 2) a += (bend * 2) / segs;
      const d = elev(x, z);
      if (k > 2 && (d > wl - 0.5 || d < wl - BREAKWATER_MAX_DEPTH)) ok = false;
      // Open water to both sides past the beach (not up an inlet)
      if (k === Math.round(segs / 2) || k === segs) {
        for (const side of [-1, 1]) {
          const sx = x + Math.cos(a) * 45 * side;
          const sz = z - Math.sin(a) * 45 * side;
          if (elev(sx, sz) > wl) ok = false;
        }
      }
      out.push({
        x: x - worldOffsetX,
        y: wl,
        z: z - worldOffsetZ,
        // How much the water's swell is calmed here (as its shader does)
        calm: reefStep(1, 6, wl - d),
        rotY: a + (fireHash(chunkX + k, chunkZ, 1813 + t) < 0.5 ? 0 : Math.PI),
        sx: 0.85 + 0.3 * fireHash(chunkX + k, chunkZ, 1814 + t),
        sz: 1.15,
        variant: Math.floor(fireHash(chunkX + k, chunkZ, 1815 + t) * 3),
      });
      x += Math.sin(a) * BREAKWATER_SEGMENT;
      z += Math.cos(a) * BREAKWATER_SEGMENT;
    }
    // Sea on past the head and off to its sides, not a pond or a bay's
    // narrow end
    for (const [along, side] of [
      [120, 0],
      [300, 0],
      [550, 0],
      [200, -200],
      [200, 200],
    ]) {
      const fx = x + Math.sin(a) * along + Math.cos(a) * side;
      const fz = z + Math.cos(a) * along - Math.sin(a) * side;
      if (elev(fx, fz) > wl - 1) ok = false;
    }
    if (!ok) continue;
    // The head: a broader last stretch and the beacon on it
    const end = out[out.length - 1];
    end.sx = 1.25;
    out.push({
      x: end.x,
      y: wl,
      z: end.z,
      rotY: a,
      sx: 1,
      sz: 1,
      calm: end.calm,
      beacon: true,
      color: fireHash(chunkX, chunkZ, 1816) < 0.5 ? 0xc8372d : 0x2f8a52,
    });
    return out;
  }
  return null;
}

export function generateChunkData({
  chunkX,
  chunkZ,
  chunkSize,
  segments,
  elevParams,
  worldSeed,
  forceIslandType,
  forceContinent,
  enableObjects,
  morphGrid,
}) {
  if (worldSeed !== undefined) {
    ChillFlightLogic.WORLD_SEED = worldSeed;
    simplex.seed(worldSeed);
  }
  // Workers have their own copy of the logic module, so the debug UI's (or
  // URL's) forced island type has to travel with each job.
  if (forceIslandType !== undefined) {
    ChillFlightLogic.FORCE_ISLAND_TYPE = forceIslandType;
  }
  // Likewise a forced continent outline (?continent=)
  if (forceContinent !== undefined) {
    ChillFlightLogic.CONTINENT = forceContinent;
  }
  const _enableObjects = enableObjects !== false;

  const gridX1 = segments + 1;
  const totalVerts = gridX1 * gridX1;
  const halfSize = chunkSize / 2;
  const step = chunkSize / segments;
  const worldOffsetX = chunkX * chunkSize;
  const worldOffsetZ = chunkZ * chunkSize;

  const positions = new Float32Array(totalVerts * 3);
  const heightGrid = new Float32Array(totalVerts);
  // Which kind of house suits each vertex's ground (for the road villages):
  // 0 none, 1 plain, 2 stone, 3 stone with chimney smoke, 4 adobe
  const houseStyleGrid = new Uint8Array(totalVerts);
  const terrainColors = new Float32Array(totalVerts * 3);

  let maxChunkHeight = (elevParams && elevParams.WATER_LEVEL) || 40;
  let vertIdx = 0;
  let posIdx = 0;

  for (let iz = 0; iz < gridX1; iz++) {
    const localZ = -halfSize + iz * step;
    const worldZ = worldOffsetZ + localZ;
    for (let ix = 0; ix < gridX1; ix++) {
      const localX = -halfSize + ix * step;
      const worldX = worldOffsetX + localX;

      const height = getElevation(worldX, worldZ, elevParams);
      heightGrid[vertIdx] = height;

      positions[posIdx] = localX;
      positions[posIdx + 1] = height;
      positions[posIdx + 2] = localZ;

      if (height > maxChunkHeight) maxChunkHeight = height;

      vertIdx++;
      posIdx += 3;
    }
  }

  // Each vertex's height on the distant terrain ring's coarser grid, which
  // the terrain shader morphs toward near the draw distance so the ring takes
  // over without a visible jump in shape (#81).
  const morphHeights = morphGrid
    ? coarseGridHeights(
        positions,
        worldOffsetX,
        worldOffsetZ,
        halfSize,
        morphGrid,
        elevParams
      )
    : null;

  // Water plane computation
  let hasWater = false;
  for (let i = 0; i < totalVerts; i++) {
    const h = heightGrid[i];
    const localX = positions[i * 3];
    const worldX = worldOffsetX + localX;
    const eastCoastFactor = Math.max(0, Math.min(1, (worldX + 2000) / 2000));
    const sandMaxHeight = elevParams.WATER_LEVEL + 2 + eastCoastFactor * 10;
    if (h <= sandMaxHeight && h <= elevParams.WATER_LEVEL) {
      hasWater = true;
      break;
    }
  }

  let waterPositions = null;
  let waterColors = null;
  let waterFlow = null;
  let softWaterDepth = null;
  let reefGrid = null;
  const transferables = [
    positions.buffer,
    heightGrid.buffer,
    terrainColors.buffer,
  ];
  if (morphHeights) transferables.push(morphHeights.buffer);

  if (hasWater) {
    const wSegments = Math.max(1, Math.floor(segments / 4));
    const wGridX1 = wSegments + 1;
    const wTotalVerts = wGridX1 * wGridX1;
    const wStep = chunkSize / wSegments;
    const wHalfSize = chunkSize / 2;

    waterPositions = new Float32Array(wTotalVerts * 3);
    waterColors = new Float32Array(wTotalVerts * 3);
    // Which way the rivers run at each vertex (getRiverFlow), for the water
    // shader's current
    waterFlow = new Float32Array(wTotalVerts * 2);

    const colorWater = new Color(0x40c4ff);
    const colorIcyWater = new Color(0x88ccff);
    const colorDesertWater = new Color(0x00ced1);
    // Dark tea-brown; its very low blue also tells the water shader it's swamp
    // water (opaque, no shore foam)
    const colorSwampWater = new Color(0x3a3320);
    const tempColor = new Color();

    let wPosIdx = 0;

    for (let iz = 0; iz < wGridX1; iz++) {
      const localZ = -wHalfSize + iz * wStep;
      const worldZ = worldOffsetZ + localZ;
      for (let ix = 0; ix < wGridX1; ix++) {
        const localX = -wHalfSize + ix * wStep;
        const worldX = worldOffsetX + localX;

        waterPositions[wPosIdx] = localX;
        waterPositions[wPosIdx + 1] = elevParams.WATER_LEVEL;
        waterPositions[wPosIdx + 2] = localZ;

        const tempNoise = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
        const southInfluence =
          Math.max(0, worldZ / 4500) +
          ChillFlightLogic.desertShift(worldX, worldZ, simplex);
        const snowFactor = ChillFlightLogic.snowFactorAt(
          worldZ,
          ChillFlightLogic.snowNoiseShift(worldX, worldZ, simplex)
        );
        const desertRaw = Math.max(
          0,
          Math.min(1, (southInfluence + tempNoise * 0.05 - 0.7) * 1.5)
        );
        const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);
        const swampWaterFactor = ChillFlightLogic.swampFactorAt(
          worldX,
          worldZ,
          simplex
        );

        tempColor.copy(colorWater);
        if (snowFactor > 0) tempColor.lerp(colorIcyWater, snowFactor);
        if (desertFactor > 0) tempColor.lerp(colorDesertWater, desertFactor);
        if (swampWaterFactor > 0)
          tempColor.lerp(colorSwampWater, Math.min(1, swampWaterFactor * 1.25));

        const flow = ChillFlightLogic.getRiverFlow(worldX, worldZ, simplex);

        waterColors[wPosIdx] = tempColor.r;
        waterColors[wPosIdx + 1] = tempColor.g;
        waterColors[wPosIdx + 2] = tempColor.b;

        if (flow) {
          waterFlow[(wPosIdx / 3) * 2] = flow[0];
          waterFlow[(wPosIdx / 3) * 2 + 1] = flow[1];
        }

        wPosIdx += 3;
      }
    }

    softWaterDepth = softenedWaterDepth(
      heightGrid,
      gridX1,
      step,
      halfSize,
      worldOffsetX,
      worldOffsetZ,
      elevParams
    );
    reefGrid = reefWeights(
      heightGrid,
      gridX1,
      step,
      halfSize,
      worldOffsetX,
      worldOffsetZ,
      elevParams
    );
    transferables.push(
      waterPositions.buffer,
      waterColors.buffer,
      waterFlow.buffer,
      softWaterDepth.buffer,
      reefGrid.buffer
    );
  }

  // Pass 2: Terrain Coloring & Prop Placement Sampling
  const rng = ChillFlightLogic.chunkRng(chunkX, chunkZ);
  const densityFactor = 40 / segments;
  const densityScale = densityFactor * densityFactor;

  const gridSpacing = chunkSize / segments;
  const invGridSpacing = 1.0 / gridSpacing;
  // Ground height at a chunk-local point between vertices, bilinear over the
  // height grid (trees are nudged off the vertices so they don't line up)
  const heightAtLocal = (lx, lz) => {
    const fx = Math.min(
      segments,
      Math.max(0, (lx + halfSize) * invGridSpacing)
    );
    const fz = Math.min(
      segments,
      Math.max(0, (lz + halfSize) * invGridSpacing)
    );
    const ix0 = Math.min(segments - 1, fx | 0);
    const iz0 = Math.min(segments - 1, fz | 0);
    const tx = fx - ix0;
    const tz = fz - iz0;
    const i00 = iz0 * gridX1 + ix0;
    const h0 = heightGrid[i00] + (heightGrid[i00 + 1] - heightGrid[i00]) * tx;
    const h1 =
      heightGrid[i00 + gridX1] +
      (heightGrid[i00 + gridX1 + 1] - heightGrid[i00 + gridX1]) * tx;
    return h0 + (h1 - h0) * tz;
  };
  // The height of the terrain mesh itself (each grid square is two flat
  // triangles split along the (0, 1)-(1, 0) diagonal, as PlaneGeometry does),
  // reading the grid's neighbours past the chunk's edge from getElevation
  const gridHeightAt = (ix, iz) =>
    ix >= 0 && ix <= segments && iz >= 0 && iz <= segments
      ? heightGrid[iz * gridX1 + ix]
      : getElevation(
          worldOffsetX - halfSize + ix * gridSpacing,
          worldOffsetZ - halfSize + iz * gridSpacing,
          elevParams
        );
  const meshHeightAtLocal = (lx, lz) => {
    const fx = (lx + halfSize) * invGridSpacing;
    const fz = (lz + halfSize) * invGridSpacing;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    const tx = fx - ix;
    const tz = fz - iz;
    const h01 = gridHeightAt(ix, iz + 1);
    const h10 = gridHeightAt(ix + 1, iz);
    if (tx + tz <= 1) {
      const h00 = gridHeightAt(ix, iz);
      return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    }
    const h11 = gridHeightAt(ix + 1, iz + 1);
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  };
  const invTwoGridSpacing = 0.5 / gridSpacing;

  // Prop candidate arrays
  const treePositions = [];
  const deciduousTreePositions = [];
  const tallDeciduousTreePositions = [];
  const palmTreePositions = [];
  const deadTreePositions = [];
  const joshuaTreePositions = [];
  const hayBalePositions = [];
  // Tractors: {type, x, y, z, rotY}
  const tractorPositions = [];
  const iceHutPositions = [];
  // Landmarks: {type, x, y, z, rotY}
  const landmarkPositions = [];
  const fallenLogPositions = [];
  const snowTreePositions = [];
  const mushroomTreePositions = [];
  const crystalPositions = [];
  const autumnTree1Positions = [];
  const autumnTree2Positions = [];
  const autumnTree3Positions = [];
  const cherryTreePositions = [];
  const yellowCortezTreePositions = [];
  const japaneseMapleTreePositions = [];
  const sculptedPineTreePositions = [];
  const birchTreePositions = [];
  const broadleafOakTreePositions = [];
  const oakTreePositions = [];
  const magnoliaTreePositions = [];
  const appleTreePositions = [];
  const orchardAppleTreePositions = [];
  const plumTreePositions = [];
  const fruitTreePositions = [];
  const fruitTreeLists = [
    appleTreePositions,
    orchardAppleTreePositions,
    plumTreePositions,
    fruitTreePositions,
  ];

  const housePositions = [];
  const twoStoryHousePositions = [];
  const strawHutPositions = [];
  const windmillPositions = [];
  let lighthousePos = null;
  // Whether this chunk may have a headland lighthouse (see the loop)
  const lighthouseChunk = _enableObjects && lighthouseChunkWins(chunkX, chunkZ);
  const pierPositions = [];
  const campfirePositions = [];
  const chimneySmokePositions = [];
  const sailboatPositions = [];
  const pirateShipPositions = [];
  const icebergPositions = [];
  const iceFloePositions = [];
  const penguinPositions = [];
  const sealPositions = [];
  const buoyPositions = [];
  const breakwaterPositions = [];
  const sheepPositions = [];
  const herdPositions = [];
  const rockPositions = [];
  const snowRockPositions = [];
  const desertRockPositions = [];
  const cactusPositions = [];
  const snowmanPositions = [];
  const lilyPadPositions = [];
  // Small boats and sunken ones: {type, x, y, z, rotY}
  const smallBoatPositions = [];
  const bushPositions = [];
  const barnPositions = [];
  // Grid points where a farmstead may stand (see farmsteadsAt)
  const steadOk = new Uint8Array(positions.length / 3);
  const monasteryPositions = [];
  const castleRuinsPositions = [];
  const rockArchPositions = [];
  const rockArchGrassPositions = [];
  const swampTreePositions = [];
  const swampReedPositions = [];
  const swampLilyPadPositions = [];
  const swampLogPositions = [];

  const WATER_LEVEL = elevParams.WATER_LEVEL;
  const MOUNTAIN_LEVEL = elevParams.MOUNTAIN_LEVEL;

  let colorIdx = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const vertI = i / 3;
    const localX = positions[i];
    const localZ = positions[i + 2];
    const worldX = worldOffsetX + localX;
    const worldZ = worldOffsetZ + localZ;
    // The chunk's east and south rows of grid points are its neighbours'
    // west and north rows too. Props placed from hashes of the grid point
    // (not the chunk's rolls) skip them, so they aren't placed twice.
    const sharedEdge = localX > chunkSize / 2 - 1 || localZ > chunkSize / 2 - 1;
    const isEast = worldX > 0;
    // How alien the colours are, past the wandering edges of the alien lands.
    // Props turn alien (mushrooms, no houses or ordinary trees) partway in,
    // where the alien terrain and colours have taken hold.
    const extremeBlend = ChillFlightLogic.alienAt(worldX, worldZ, simplex);
    const isAlienLand = extremeBlend > ALIEN_PROPS_AT;
    const isEastAlien = isEast && isAlienLand;
    // The eastern land's basalt column here (its top's colour, mushroom
    // groves and giant mushrooms)
    const basaltCol =
      isEast && extremeBlend > 0
        ? ChillFlightLogic.basaltColumnAt(worldX, worldZ, simplex)
        : null;

    const height = heightGrid[vertI];

    // Slope finite differences
    const ix = vertI % gridX1;
    const iy = (vertI / gridX1) | 0;

    let slopeX;
    if (ix > 0 && ix < segments) {
      slopeX =
        (heightGrid[vertI + 1] - heightGrid[vertI - 1]) * invTwoGridSpacing;
    } else if (ix === 0) {
      slopeX = (heightGrid[vertI + 1] - height) * invGridSpacing;
    } else {
      slopeX = (height - heightGrid[vertI - 1]) * invGridSpacing;
    }

    let slopeZ;
    if (iy > 0 && iy < segments) {
      slopeZ =
        (heightGrid[vertI + gridX1] - heightGrid[vertI - gridX1]) *
        invTwoGridSpacing;
    } else if (iy === 0) {
      slopeZ = (heightGrid[vertI + gridX1] - height) * invGridSpacing;
    } else {
      slopeZ = (height - heightGrid[vertI - gridX1]) * invGridSpacing;
    }

    const slope = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);
    const slopeFactor = Math.min(1, slope * 0.5);

    const mottle1 = simplex.noise2D(worldX * 0.002, worldZ * 0.002);
    const mottle2 = simplex.noise2D(worldX * 0.01, worldZ * 0.01) * 0.3;
    const mottle = (mottle1 + mottle2 + 0.5) * 0.5;

    const grain = simplex.noise2D(worldX * 0.2, worldZ * 0.2) * 0.05;

    const noisePath = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
    const biomeNoise = simplex.noise2D(worldX * 0.0005, worldZ * 0.0005) * 0.1;

    const snowFactor = ChillFlightLogic.snowFactorAt(
      worldZ,
      noisePath * 0.05 +
        biomeNoise +
        ChillFlightLogic.snowWobble(worldX, worldZ, simplex)
    );

    const southInfluence =
      Math.max(0, worldZ / 5000) +
      ChillFlightLogic.desertShift(worldX, worldZ, simplex);
    const desertRaw = Math.max(
      0,
      Math.min(1, (southInfluence + noisePath * 0.05 - biomeNoise - 2.0) * 1.0)
    );
    const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);
    const swampFactor = ChillFlightLogic.swampFactorAt(worldX, worldZ, simplex);

    const eastCoastFactor =
      Math.max(0, Math.min(1, (worldX + 2000) / 2000)) * (1 - swampFactor);
    const sandMaxHeight =
      WATER_LEVEL + (2 + eastCoastFactor * 10) * (1 - 0.85 * swampFactor);

    // The tree line: about 600 m in the south, 400 m by 1 North, and down
    // toward the valleys with the snow, wobbling so it isn't a contour line.
    // Woods thin and shrink over the last 150 m below it; above it there's a
    // band of alpine meadow, then scree and rock.
    const alpine = Math.max(0, Math.min(1, (-worldZ / 5000 - 0.3) / 0.7));
    const treeLine =
      600 -
      200 * alpine -
      270 * snowFactor +
      simplex.noise2D(worldX * 0.003 + 51, worldZ * 0.003 - 17) * 60;
    const rockLine = treeLine + ALPINE_MEADOW_BAND;

    const forestNoise = simplex.noise2D(worldX * 0.005 + 100, worldZ * 0.005);
    // Villages (a slow noise field, so a village is a few hundred meters
    // across), and the farmland around them (fieldAt) on gentle ground below
    // the upland woods. The
    // farmland is cleared of the woods, apart from the odd thick patch left as
    // woodlots between the fields.
    const villageNoise = simplex.noise2D(
      worldX * 0.0011 + 71.3,
      worldZ * 0.0011 - 29.7
    );
    let farm = 0;
    if (
      !isAlienLand &&
      height > sandMaxHeight &&
      height < treeLine - TREE_LINE_FADE &&
      desertFactor < 0.3 &&
      snowFactor < 0.3 &&
      swampFactor < 0.5
    ) {
      farm =
        Math.max(0, Math.min(1, (villageNoise + 0.05) / 0.2)) *
        (1 - Math.max(0, Math.min(1, (slopeFactor - 0.25) / 0.2))) *
        (1 - desertFactor / 0.3) *
        (1 - snowFactor / 0.3) *
        (1 - Math.min(1, swampFactor * 2)) *
        Math.min(1, (treeLine - TREE_LINE_FADE - height) / 60);
    }
    const isForest = forestNoise > 0.2 + 0.6 * farm;
    if (isForest) farm = 0;
    if (farm > 0) fieldAt(worldX, worldZ, simplex);
    const cherryNoise = simplex.noise2D(
      worldX * 0.0005 + 1000,
      worldZ * 0.0005 + 1000
    );

    // Color assignment & feature spawning. Lowland is the grass and woods
    // below the mountains' colors (up to the tree line).
    let isLowland = false;
    let isLakeIce = false;
    if (height <= sandMaxHeight) {
      if (height <= WATER_LEVEL) {
        hasWater = true;
        if (_enableObjects) {
          if (rng() < 0.0001 * densityScale) {
            const shipFloor = WATER_LEVEL - PIRATE_SHIP_MIN_DEPTH;
            if (height <= shipFloor && snowFactor < 0.2) {
              const eN = getElevation(worldX, worldZ - 300, elevParams);
              const eS = getElevation(worldX, worldZ + 300, elevParams);
              const eE = getElevation(worldX + 300, worldZ, elevParams);
              const eW = getElevation(worldX - 300, worldZ, elevParams);
              if (
                eN <= shipFloor &&
                eS <= shipFloor &&
                eE <= shipFloor &&
                eW <= shipFloor
              ) {
                pirateShipPositions.push({
                  x: localX,
                  y: WATER_LEVEL,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                  bodyId: Math.floor(rng() * 4),
                });
              }
            }
          } else if (rng() < 0.0005 * densityScale) {
            const rotY = rng() * Math.PI * 2;
            if (swampFactor < 0.2) {
              sailboatPositions.push({
                x: localX,
                y: WATER_LEVEL,
                z: localZ,
                rotY,
              });
            }
          } else if (snowFactor > 0.5) {
            if (rng() < 0.0005 * densityScale) {
              icebergPositions.push({
                x: localX,
                y: WATER_LEVEL,
                z: localZ,
                rotY: rng() * Math.PI * 2,
              });
            } else if (rng() < 0.00075 * densityScale) {
              iceFloePositions.push({
                x: localX,
                y: WATER_LEVEL,
                z: localZ,
                rotY: rng() * Math.PI * 2,
              });
              const numPenguins = Math.floor(rng() * 4);
              for (let p = 0; p < numPenguins; p++) {
                penguinPositions.push({
                  x: localX + (rng() - 0.5) * 12,
                  y: WATER_LEVEL + 3,
                  z: localZ + (rng() - 0.5) * 12,
                  rotY: rng() * Math.PI * 2,
                });
              }
              // A seal or two hauled out on some of the floes, from hashes
              // of the grid point (so the rolls after come out as before)
              const gx = Math.round(worldX / gridSpacing);
              const gz = Math.round(worldZ / gridSpacing);
              const seals =
                fieldHash(gx, gz, 131) < SEAL_FLOE_CHANCE
                  ? fieldHash(gx, gz, 137) < 0.35
                    ? 2
                    : 1
                  : 0;
              for (let k = 0; k < seals; k++) {
                // The second lies across the floe from the first
                const a =
                  fieldHash(gx, gz, 139) * Math.PI * 2 +
                  k * (Math.PI + (fieldHash(gx, gz, 141) - 0.5) * 1.2);
                const d = 7 + 2 * fieldHash(gx, gz, 149 + k);
                sealPositions.push({
                  x: localX + Math.cos(a) * d,
                  y: WATER_LEVEL + 2.4,
                  z: localZ + Math.sin(a) * d,
                  rotY: fieldHash(gx, gz, 151 + k) * Math.PI * 2,
                  size: 1.6 + 0.4 * fieldHash(gx, gz, 157 + k),
                });
              }
            }
          }
          if (
            snowFactor < 0.1 &&
            desertFactor < 0.1 &&
            ChillFlightLogic.getBiome(worldX, worldZ, simplex) > -0.15 &&
            rng() < 0.035 * densityScale &&
            shelteredWater(worldX, worldZ, elevParams)
          ) {
            lilyPadPositions.push({
              x: localX,
              y: WATER_LEVEL,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          }
          // Small boats, by a hash of the grid point (not rng(), so the
          // props after them stay where they were)
          if (snowFactor < 0.3 && !isAlienLand && swampFactor < 0.2) {
            const gx = Math.round(worldX / gridSpacing);
            const gz = Math.round(worldZ / gridSpacing);
            const hash = (salt) => fieldHash(gx, gz, 400 + salt);
            if (
              hash(0) < SMALL_BOAT_CHANCE * densityScale &&
              height < WATER_LEVEL - SMALL_BOAT_MIN_DEPTH
            ) {
              const boat = smallBoatAt(
                worldX,
                worldZ,
                hash,
                elevParams,
                gridSpacing
              );
              if (boat) {
                smallBoatPositions.push({
                  type: boat.type,
                  rotY: boat.rotY,
                  x: localX + (boat.dx || 0),
                  y: boat.y || WATER_LEVEL,
                  z: localZ + (boat.dz || 0),
                });
              }
            } else if (
              height <= WATER_LEVEL - SUNKEN_BOAT_DEPTH[0] &&
              height >= WATER_LEVEL - SUNKEN_BOAT_DEPTH[1] &&
              hash(1) < SUNKEN_BOAT_CHANCE * densityScale
            ) {
              smallBoatPositions.push({
                type: 'sunkenBoatBody',
                x: localX,
                y: height - 5,
                z: localZ,
                rotY: hash(11) * Math.PI * 2,
              });
            }
          }
        }
        positions[i + 1] = height - 5 * (1 - 0.75 * swampFactor);
        _tempColorObj.copy(_colorSand).lerp(_colorWater, 0.15);
        if (snowFactor > 0) _tempColorObj.lerp(_colorSandSnowTint, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorDesertSand, desertFactor);
        if (swampFactor > 0)
          _tempColorObj.lerp(_colorSwampMud, swampFactor * 0.92);
      } else if (
        worldZ < -19000 &&
        Math.abs(height - WATER_LEVEL - ChillFlightLogic.LAKE_ICE_RISE) < 0.02
      ) {
        // A frozen lake or river in the far north: blue-white ice
        isLakeIce = true;
        _tempColorObj.copy(_colorLakeIce);
        _tempColorObj.lerp(_colorLakeIceDark, mottle * 0.5);
      } else if (height <= WATER_LEVEL + 1.2) {
        const wetFactor = 1.0 - (height - WATER_LEVEL) / 1.2;
        _tempColorObj.copy(_colorSand);
        if (desertFactor > 0) {
          _tempColorObj.lerp(_colorDesertSand, desertFactor);
          _tempColorObj.lerp(_colorDesertWetSand, wetFactor);
        } else {
          _tempColorObj.lerp(_colorWetSand, wetFactor);
        }
        if (snowFactor > 0) _tempColorObj.lerp(_colorSnow, snowFactor);
        if (swampFactor > 0)
          _tempColorObj.lerp(_colorSwampMud, swampFactor * 0.9);
      } else {
        _tempColorObj.copy(_colorSand);
        if (snowFactor > 0)
          _tempColorObj.lerp(_colorUpperSandSnowTint, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorDesertSand, desertFactor);

        if (mottle > 0.6)
          _tempColorObj.lerp(_colorSandMottleHigh, (mottle - 0.6) * 0.5);
        if (mottle < 0.4)
          _tempColorObj.lerp(_colorSandMottleLow, (0.4 - mottle) * 0.5);
        if (swampFactor > 0)
          _tempColorObj.lerp(_colorSwampMud, swampFactor * 0.88);
      }
    } else if (
      height >
      (desertFactor > 0.35
        ? MOUNTAIN_LEVEL - 50 * snowFactor
        : Math.max(MOUNTAIN_LEVEL - 50 * snowFactor, treeLine - 40))
    ) {
      const sierraSnowNoise1 = simplex.noise2D(worldX * 0.003, worldZ * 0.003);
      const sierraSnowNoise2 =
        simplex.noise2D(worldX * 0.012, worldZ * 0.012) * 0.5;
      const organicNoise = sierraSnowNoise1 + sierraSnowNoise2;

      const isDesertMountain = desertFactor > 0.35;
      const canHaveSnow = !isDesertMountain;

      // The snowline comes down gradually heading north: from 1,150 near the
      // equator to 750 by 1 North (so the first northern range has
      // snow-capped peaks), then with the snow cover down to the valleys.
      const baseSnowline = isDesertMountain
        ? 2400
        : 1150 - 400 * alpine + (WATER_LEVEL + 10 - 750) * snowFactor;
      const snowline = baseSnowline + organicNoise * 180;

      const cliffThreshold = 0.78 + 0.06 * snowFactor;
      const isSheerCliff = slopeFactor > cliffThreshold;
      const canHoldSnow =
        canHaveSnow && (!isSheerCliff || height > snowline + 300);

      if (canHoldSnow && height > snowline) {
        const snowT = Math.min(1, (height - snowline) / 180);
        _tempColorObj.copy(_colorSnow);
        if (snowT < 1.0) {
          const rockBase = isDesertMountain
            ? _colorDesertMountainRock
            : _colorMountainTint;
          _tempColorObj.lerp(rockBase, 1.0 - snowT);
        }
      } else if (height > (isDesertMountain ? 550 : rockLine) || isSheerCliff) {
        if (isDesertMountain) {
          _tempColorObj.copy(_colorDesertMountainRock);
          if (desertFactor > 0.5) _tempColorObj.lerp(_colorDesertSand, 0.35);
          if (mottle > 0.7) _tempColorObj.lerp(_colorArizonaDark, 0.25);
        } else {
          const strata =
            Math.sin(height * 0.025 + worldX * 0.0015 + worldZ * 0.001) * 0.15;
          _tempColorObj.copy(_colorMountainTint);
          if (strata > 0.04) {
            _tempColorObj.lerp(
              _colorAlpineRockLight,
              Math.min(0.5, strata * 2.5)
            );
          } else if (strata < -0.04) {
            _tempColorObj.lerp(
              _colorAlpineRockDark,
              Math.min(0.6, -strata * 2.5)
            );
          }

          if (slopeFactor > 0.5) {
            const cliffDarken = Math.min(1, (slopeFactor - 0.5) * 2.2);
            _tempColorObj.lerp(_colorAlpineRockDark, cliffDarken * 0.5);
          }

          if (
            height < rockLine + 150 &&
            slopeFactor > 0.25 &&
            slopeFactor < 0.55
          ) {
            _tempColorObj.lerp(_colorScree, 0.35);
          }
        }
      } else {
        if (isDesertMountain) {
          _tempColorObj.copy(_colorDesertSand);
          if (height > WATER_LEVEL + 5)
            _tempColorObj.lerp(_colorSandMottleHigh, 0.3);
          _tempColorObj.lerp(_colorDesertMottle, mottle * 0.2);
        } else {
          // The last of the woods, then alpine meadow going to scree
          _tempColorObj.copy(_colorForest);
          _tempColorObj.lerp(_colorForestDark, mottle * 0.3);
          const meadow = Math.max(
            0,
            Math.min(1, (height - treeLine + 40) / 80)
          );
          _tempColorObj.lerp(_colorAlpineMeadow, meadow);
          const scree = Math.max(
            0,
            Math.min(1, (height - treeLine - 50) / (ALPINE_MEADOW_BAND - 50))
          );
          _tempColorObj.lerp(_colorScree, scree * 0.6);
          if (snowFactor > 0)
            _tempColorObj.lerp(
              _colorForestSnowTint,
              Math.min(1, snowFactor * 2)
            );
        }
      }
    } else {
      isLowland = true;
      // Grass mottling first, so snow and sand cover it (applied after, its
      // dark greens showed through as camouflage-like blotches); then only a
      // gentle shade on snow and sand. Forest ground is slightly shaded snow
      // or sand rather than grey-green or sienna patches.
      if (isForest) {
        _tempColorObj.copy(_colorForest);
        _tempColorObj.lerp(_colorForestDeep, mottle * 0.4);
        if (mottle < 0.3) _tempColorObj.lerp(_colorForestLight, 0.2);
        if (snowFactor > 0)
          _tempColorObj.lerp(_colorForestFloorSnow, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorForestFloorSand, desertFactor);
      } else {
        _tempColorObj.copy(_colorPlains);
        _tempColorObj.lerp(_colorPlainsDark, mottle * 0.4);
        if (mottle > 0.8) _tempColorObj.lerp(_colorPlainsBright, 0.3);
        // Hillsides deepen toward the mountains' green
        if (height > MOUNTAIN_LEVEL)
          _tempColorObj.lerp(
            _colorForest,
            Math.min(0.4, (height - MOUNTAIN_LEVEL) / 750)
          );
        if (farm > 0 && _field.crop >= 0)
          _tempColorObj.lerp(FIELD_CROP_COLORS[_field.crop], farm * 0.95);
        if (snowFactor > 0)
          _tempColorObj.lerp(_colorPlainsSnowTint, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorDesertSand, desertFactor);
      }
      if (snowFactor > 0)
        _tempColorObj.lerp(_colorSnowShade, mottle * 0.3 * snowFactor);
      if (desertFactor > 0)
        _tempColorObj.lerp(_colorSandShade, mottle * 0.25 * desertFactor);
      if (swampFactor > 0) {
        const mudMix = Math.max(
          0,
          Math.min(1, 1 - (height - WATER_LEVEL) / 2.2)
        );
        const swampGround =
          mottle > 0.48 ? _colorSwampMoss : _colorSwampMossDark;
        _tempColorObj.lerp(swampGround, swampFactor * 0.85);
        if (mudMix > 0) {
          _tempColorObj.lerp(_colorSwampMud, swampFactor * mudMix * 0.85);
        }
      }
    }

    // A salt pan (a dried desert lake): a pale crust, stained, over the
    // pan's floor and fading into the sand up its shore and where the lake
    // is only partly dry, so its edge isn't a hard white line along the grid
    if (desertFactor > 0.3) {
      const above = height - WATER_LEVEL;
      if (above > 0.3 && above < SALT_PAN_SHORE) {
        const dry = ChillFlightLogic.saltPanAt(worldX, worldZ, simplex);
        const pan =
          smoothRamp(dry, 0.35, 0.95) *
          (above < ChillFlightLogic.SALT_PAN_RISE
            ? smoothRamp(above, 0.3, ChillFlightLogic.SALT_PAN_RISE)
            : 1 - smoothRamp(above, 0.85, SALT_PAN_SHORE));
        if (pan > 0) {
          _panColor.copy(_colorSaltPan);
          _panColor.lerp(_colorSaltPanStain, mottle * 0.7);
          _tempColorObj.lerp(_panColor, pan * Math.min(1, desertFactor * 1.5));
        }
      }
    }

    // Extreme zone color blend
    if (extremeBlend > 0) {
      const colorWater = isEast ? _colorEasternWater : _colorWesternWater;
      const colorCliff = isEast ? _colorEasternCliff : _colorWesternCliff;
      const colorPeak = isEast ? _colorEasternPeak : _colorWesternPeak;
      const colorRock = isEast ? _colorEasternRock : _colorWesternRock;
      const colorLowland = isEast ? _colorEasternLowland : _colorWesternLowland;

      const baseLandColor = slopeFactor > 0.4 ? colorRock : colorLowland;
      // In the west the colours take over twice as fast as the terrain
      // (spires, terraces, chasms) and cover the snow and grass completely,
      // so the spires never stand on green fields or read as grey snow
      const blend = isEast ? extremeBlend : Math.min(1, extremeBlend * 2);
      const cover = isEast ? 0.75 : 1;

      if (height <= WATER_LEVEL) {
        _tempColorObj.lerp(colorWater, blend * 0.85);
      } else if (height < WATER_LEVEL + 4) {
        const bleed = 1.0 - (height - WATER_LEVEL) / 4.0;
        const shoreColor = baseLandColor.clone().lerp(colorWater, bleed);
        _tempColorObj.lerp(shoreColor, blend * 0.85);
      } else if (basaltCol && basaltCol.top > 0 && slopeFactor <= 0.4) {
        // A column's flat top: each one moss, heather or lichen all over,
        // more of one kind in some places than others, so the honeycomb
        // reads as a patchwork from above
        const mix =
          basaltCol.tint * 0.65 +
          (simplex.noise2D(
            basaltCol.cx * 0.00008 - 41.3,
            basaltCol.cz * 0.00008 + 7.9
          ) +
            1) *
            0.25;
        const tops = _colorBasaltTops;
        const topColor =
          tops[Math.min(tops.length - 1, (mix * tops.length) | 0)];
        _tempColorObj.lerp(topColor, blend * 0.8);
      } else if (basaltCol && basaltCol.top > 0) {
        // A column's walls: dark basalt, all the way up the organ pipes
        _tempColorObj.lerp(_colorBasaltWall, blend * 0.8);
      } else if (height > MOUNTAIN_LEVEL) {
        const peakFrac = Math.min(1, (height - MOUNTAIN_LEVEL) / 400);
        _tempColorObj.lerp(colorCliff, blend * (isEast ? 0.7 : 1));
        _tempColorObj.lerp(colorPeak, blend * peakFrac * 0.9);
      } else {
        _tempColorObj.lerp(baseLandColor, blend * cover);
      }
    }

    // Frozen North Zone
    let isFrozen = false;
    const freezeBoundaryZ =
      -20000 + simplex.noise2D(worldX * 0.0002, worldZ * 0.0002) * 2000;
    if (worldZ < freezeBoundaryZ && !isLakeIce) {
      const freezeFactor = Math.max(
        0,
        Math.min(1, (freezeBoundaryZ - worldZ) / 5000)
      );
      if (freezeFactor > 0) {
        isFrozen = freezeFactor > 0.5;

        const iceMottle = simplex.noise2D(worldX * 0.01, worldZ * 0.01);
        let visualFreeze = freezeFactor;
        let isPhysicalIceShelf = false;
        if (height >= WATER_LEVEL + 2.8) {
          visualFreeze = Math.max(visualFreeze, 0.95);
          isPhysicalIceShelf = true;
        }

        const targetColor = isPhysicalIceShelf ? _colorWhite : _colorPackIce;
        _tempColorObj.lerp(targetColor, visualFreeze);

        if (iceMottle > 0) {
          _tempColorObj.lerpHSL(_colorWhite, iceMottle * 0.15 * visualFreeze);
        } else {
          _tempColorObj.lerpHSL(
            _colorIceMottleDark,
            -iceMottle * 0.15 * freezeFactor
          );
        }

        const iceBlend = Math.max(
          0,
          Math.min(1, (WATER_LEVEL + 10 - height) / 10)
        );
        if (iceBlend > 0) {
          _tempColorObj.lerp(_colorIce, freezeFactor * iceBlend);
        }
      }
    }

    // The far north's low ground isn't all snow: from about 3 North the wind
    // scours small patches of grey-green tundra, and bares the dark rock of
    // the tors and steep banks. Above the sea ice's height, so the frozen sea
    // stays white; the hills and mountains keep their snow.
    const farNorth = Math.max(0, Math.min(1, (-worldZ / 5000 - 3) / 1));
    if (farNorth > 0 && !isAlienLand && height > WATER_LEVEL + 20) {
      const above = Math.min(1, (height - WATER_LEVEL - 20) / 15);
      const low = 1 - Math.max(0, Math.min(1, (height - 250) / 100));
      const scour =
        simplex.noise2D(worldX * 0.003 + 404, worldZ * 0.003 - 77) +
        0.4 * simplex.noise2D(worldX * 0.011 - 9, worldZ * 0.011 + 31);
      const tundra =
        Math.max(0, Math.min(1, (scour - 0.45) / 0.25)) *
        above *
        low *
        farNorth;
      if (tundra > 0) {
        _tempColorObj.lerp(
          mottle > 0.5 ? _colorTundraDark : _colorTundra,
          tundra * 0.6
        );
      }
      const bare =
        Math.max(0, Math.min(1, (slopeFactor - 0.15) / 0.15)) *
        above *
        low *
        farNorth;
      if (bare > 0) _tempColorObj.lerp(_colorFrostRock, bare * 0.95);
    }

    const isStandardLand = height > sandMaxHeight && height <= treeLine;
    houseStyleGrid[vertI] =
      !isStandardLand ||
      isFrozen ||
      isAlienLand ||
      worldZ < -25000 ||
      swampFactor > 0.2
        ? 0
        : desertFactor > 0.5
          ? 4
          : snowFactor > 0.3
            ? 3
            : snowFactor > 0.25 || worldZ < -8000
              ? 2
              : 1;

    // The woods' ground darkens with how thick they are, so a forest reads
    // as canopy from the air, not just as trees standing on grass
    const woodsShade = isForest
      ? Math.min(1, (forestNoise - 0.2) / 0.25) *
        Math.max(
          0,
          Math.min(
            1,
            0.5 +
              0.7 * simplex.noise2D(worldX * 0.007 + 37, worldZ * 0.007 - 11)
          )
        )
      : 0;
    if (
      isStandardLand &&
      !isAlienLand &&
      snowFactor < 0.4 &&
      !isFrozen &&
      desertFactor < 0.5 &&
      woodsShade > 0
    ) {
      _tempColorObj.lerp(_colorForestFloor, woodsShade * 0.6);
    }

    if (isStandardLand && snowFactor < 0.2 && !isFrozen) {
      if (cherryNoise > 0.55) {
        const factor = Math.min(1, (cherryNoise - 0.55) / 0.1);
        const tint = isForest ? _colorCherryForestTint : _colorCherryPlainsTint;
        _tempColorObj.lerp(tint, factor * (isForest ? 0.45 : 0.3));
      } else if (!isAlienLand && desertFactor < 0.5) {
        // Fallen leaves: the ground turns russet with the trees as you head
        // north (ChillFlightLogic.fallTurnAt)
        const fall = ChillFlightLogic.fallTurnAt(
          worldX,
          worldZ,
          height,
          simplex
        );
        if (fall > 0) {
          const tint = isForest
            ? _colorAutumnForestTint
            : _colorAutumnPlainsTint;
          _tempColorObj.lerp(tint, fall * (isForest ? 0.4 : 0.15));
        }
      }
    }

    const distToVolcano = Math.sqrt(
      (worldX - VOLCANO_X) ** 2 + (worldZ - VOLCANO_Z) ** 2
    );
    // Props stay off the road surface and the airfields (with a margin)
    const isOnRoad =
      ChillFlightLogic.getRoadFactor(worldX, worldZ) > 0 ||
      ChillFlightLogic.isOnAirport(worldX, worldZ, 40) ||
      ChillFlightLogic.isOnAccessRoad(
        worldX,
        worldZ,
        30,
        simplex,
        elevParams
      ) ||
      ChillFlightLogic.isOnSlipRoad(worldX, worldZ, 20, simplex, elevParams);
    // The falls landmark: no props on its walls (they'd hang off the rock),
    // apart from its shelf's ledge
    const falls = ChillFlightLogic.fallsSiteAt(worldX, worldZ, simplex);
    const onFallsWall = falls !== null && falls.out > -15 && slopeFactor > 0.35;
    const isAlienVegetationLand =
      isAlienLand &&
      height > WATER_LEVEL + 2.0 &&
      height <= MOUNTAIN_LEVEL + 50;

    // Spawning objects
    if (
      _enableObjects &&
      (isStandardLand || isAlienVegetationLand) &&
      !isFrozen &&
      !isOnRoad &&
      !onFallsWall
    ) {
      // Trees: woods with dense cores that thin toward their edges, in clumps
      // and clearings, and lone trees out in the open near them. Steep slopes
      // carry few; low ground near water carries more. A dense core has
      // several trees per grid point (treeChance above 1), so woods can be
      // thicker than the terrain grid.
      const treeRoll = rng();
      // A crystal cluster here (western alien land), mostly small, a few huge
      const pushCrystal = () => {
        const roll = rng();
        crystalPositions.push({
          x: localX,
          y: height - 1,
          z: localZ,
          scale: roll < 0.6 ? 0.8 + rng() * 0.8 : 2 + rng() * 3,
          color:
            ALIEN_CRYSTAL_COLORS[
              Math.floor(rng() * ALIEN_CRYSTAL_COLORS.length)
            ],
        });
      };
      let treeChance = 0;
      let treeCount = 0;
      if (!isAlienLand) {
        const woods = isForest ? Math.min(1, (forestNoise - 0.2) / 0.25) : 0;
        const clump = Math.max(
          0,
          0.5 + 0.7 * simplex.noise2D(worldX * 0.007 + 37, worldZ * 0.007 - 11)
        );
        const openGround = isForest
          ? 0
          : Math.max(0, Math.min(1, (forestNoise + 0.3) / 0.5));
        const steep = Math.max(0, Math.min(1, (slopeFactor - 0.3) / 0.4));
        const lowland =
          1 - Math.max(0, Math.min(1, (height - WATER_LEVEL - 3) / 60));
        // Thinning toward the tree line (over less where it comes down
        // near the water, in the snowy north)
        const treeFade = Math.max(
          0,
          Math.min(
            1,
            (treeLine - height) /
              Math.max(
                10,
                Math.min(TREE_LINE_FADE, treeLine - WATER_LEVEL - 20)
              )
          )
        );
        treeChance =
          (isForest
            ? (0.02 + 1.2 * woods * woods * woods) * clump
            : 0.012 * openGround * (1 - farm)) *
          (1 - 0.85 * steep) *
          (1 + 0.5 * lowland) *
          // About three times the trees of the old even scatter (1.3 times on
          // the low preset, for slower devices)
          (segments <= 20 ? 0.45 : 1.02) *
          // The desert's trees are sparse: lone Joshua trees and snags, not a wood
          (desertFactor > 0.5 ? 0.2 : 1) *
          treeFade *
          densityScale;
        treeCount =
          Math.floor(treeChance) + (treeRoll < treeChance % 1 ? 1 : 0);
        for (let t = 0; t < treeCount; t++) {
          // Off the vertex grid, and bigger deep in the woods than at the edge
          const jx = localX + (rng() - 0.5) * gridSpacing * 0.9;
          const jz = localZ + (rng() - 0.5) * gridSpacing * 0.9;
          const treeSpot = {
            x: jx,
            y: heightAtLocal(jx, jz),
            z: jz,
            // Stunted toward the tree line
            size:
              (isForest ? 0.85 + 0.35 * woods : 0.9 + rng() * 0.3) *
              (0.5 + 0.5 * treeFade),
          };
          const isIsland =
            worldX > 3000 &&
            ChillFlightLogic.getBiome(worldX, worldZ, simplex) < -0.1;
          const isSouthOf1N = worldZ > -5000;

          if (distToVolcano < 3000 && rng() < 0.7) {
            if (swampFactor > 0.35) {
              swampTreePositions.push(
                swampTreeFrom(treeSpot, worldX, worldZ, gridSpacing, t)
              );
            } else {
              yellowCortezTreePositions.push(treeSpot);
            }
          } else if (
            isIsland &&
            isSouthOf1N &&
            desertFactor < PALM_MAX_DESERT
          ) {
            // Palms on the tropical islands, but not out in the desert's
            // dunes, which belong to the cacti (they start at 0.4)
            palmTreePositions.push(treeSpot);
          } else if (
            snowFactor > 0.4 ||
            // Mixed woods: valleys mostly broadleaf, conifers taking over
            // up the hillsides (most of the woods above MOUNTAIN_LEVEL), and
            // only conifers near the tree line
            (desertFactor < 0.3 &&
              (treeFade < 0.6 ||
                rng() <
                  Math.min(
                    0.85,
                    Math.max(0, (height - (MOUNTAIN_LEVEL - 130)) / 140)
                  )))
          ) {
            if (snowFactor > 0.35) {
              const snowRoll = fieldHash(
                Math.round(worldX),
                Math.round(worldZ),
                601
              );
              if (snowRoll < 0.45) {
                treeSpot.trunkKey = 'snowSpruceTrunk';
                treeSpot.leavesKey = 'snowSpruceLeaves';
                treeSpot.color = 0xf2f2f2;
              } else if (snowRoll < 0.58) {
                treeSpot.trunkKey = 'mountainRowanTrunk';
                treeSpot.leavesKey = 'mountainRowanLeaves';
                treeSpot.color = 0xf2f2f2;
              }
            }
            if (swampFactor > 0.35 && snowFactor < 0.3) {
              // No pines in the bayou: a swamp tree instead
              swampTreePositions.push(
                swampTreeFrom(treeSpot, worldX, worldZ, gridSpacing, t)
              );
            } else {
              snowTreePositions.push(treeSpot);
            }
          } else if (desertFactor > 0.6) {
            // Joshua trees, and the odd bare snag among them
            if (rng() < JOSHUA_SHARE) {
              joshuaTreePositions.push(treeSpot);
            } else {
              treeSpot.deadType =
                fieldHash(Math.round(worldX), Math.round(worldZ), 607) < 0.65
                  ? 'deadCottonwoodTrunk'
                  : 'deadTrunk';
              deadTreePositions.push(treeSpot);
            }
          } else if (
            eastCoastFactor > 0.7 &&
            height < WATER_LEVEL + 40 &&
            !isIsland &&
            desertFactor < PALM_MAX_DESERT &&
            // Only where the woods stay green: north of where the leaves
            // start to turn, the coast's palms would stand among pines,
            // autumn colours and bare trees
            ChillFlightLogic.fallTurnAt(worldX, worldZ, height, simplex) === 0
          ) {
            palmTreePositions.push(treeSpot);
          } else {
            if (cherryNoise > 0.65) {
              const groveRoll = rng();
              if (swampFactor > 0.35) {
                const gx = Math.round(worldX / gridSpacing);
                const gz = Math.round(worldZ / gridSpacing);
                const hPick = fieldHash(gx + t * 17, gz + t * 31, 503);
                swampTreePositions.push({
                  type:
                    hPick < 0.34
                      ? 'swampCypressMoss'
                      : hPick < 0.64
                        ? 'swampCypress'
                        : hPick < 0.86
                          ? 'swampTupelo'
                          : hPick < 0.94
                            ? 'swampDeadOak'
                            : 'swampSnag',
                  x: treeSpot.x,
                  y: treeSpot.y - 0.3,
                  z: treeSpot.z,
                  size:
                    treeSpot.size * (0.95 + 0.25 * fieldHash(gx, gz, 509 + t)),
                  rotY: fieldHash(gx, gz, 521 + t) * Math.PI * 2,
                });
              } else if (groveRoll < 0.25) {
                japaneseMapleTreePositions.push(treeSpot);
              } else if (groveRoll < 0.45) {
                sculptedPineTreePositions.push(treeSpot);
              } else {
                cherryTreePositions.push(treeSpot);
              }
            } else {
              // Broadleaf trees turn as you head north, each at its own
              // point (some early, some late), into maple red, orange,
              // birch yellow or oak russet; toward the snow they drop their
              // leaves (ChillFlightLogic.fallTurnAt / fallBareAt)
              const fall = ChillFlightLogic.fallTurnAt(
                worldX,
                worldZ,
                height,
                simplex
              );
              const bare = ChillFlightLogic.fallBareAt(
                worldX,
                worldZ,
                height,
                simplex
              );
              const turned = Math.max(
                0,
                Math.min(1, (fall - rng() * 0.85) * 4)
              );
              if (rng() < bare) {
                const deadRoll = fieldHash(
                  Math.round(worldX),
                  Math.round(worldZ),
                  607
                );
                treeSpot.deadType =
                  deadRoll < 0.45
                    ? 'twistedDeadOakTrunk'
                    : deadRoll < 0.75
                      ? 'deadCottonwoodTrunk'
                      : 'deadTrunk';
                deadTreePositions.push(treeSpot);
              } else if (turned > 0) {
                const kind = rng();
                const list =
                  kind < 0.3
                    ? autumnTree3Positions // red
                    : kind < 0.6
                      ? autumnTree1Positions // orange
                      : kind < 0.85
                        ? autumnTree2Positions // yellow
                        : autumnTree1Positions; // russet
                const full =
                  kind < 0.3
                    ? _colorFallRed
                    : kind < 0.6
                      ? _colorFallOrange
                      : kind < 0.85
                        ? _colorFallYellow
                        : _colorFallRusset;
                // Green, through yellow-green, to its fall color
                _fallColor.copy(_colorFallGreen);
                if (turned < 0.5) {
                  _fallColor.lerp(_colorFallTurning, turned * 2);
                } else {
                  _fallColor
                    .copy(_colorFallTurning)
                    .lerp(full, (turned - 0.5) * 2);
                }
                treeSpot.color = _fallColor.getHex();
                list.push(treeSpot);
              } else {
                const tallRoll = rng() < 0.25;
                if (swampFactor > 0.35) {
                  const gx = Math.round(worldX / gridSpacing);
                  const gz = Math.round(worldZ / gridSpacing);
                  const hPick = fieldHash(gx + t * 17, gz + t * 31, 503);
                  const sType =
                    hPick < 0.34
                      ? 'swampCypressMoss'
                      : hPick < 0.64
                        ? 'swampCypress'
                        : hPick < 0.86
                          ? 'swampTupelo'
                          : hPick < 0.94
                            ? 'swampDeadOak'
                            : 'swampSnag';
                  swampTreePositions.push({
                    type: sType,
                    x: treeSpot.x,
                    y: treeSpot.y - 0.3,
                    z: treeSpot.z,
                    size:
                      treeSpot.size *
                      (0.95 + 0.25 * fieldHash(gx, gz, 509 + t)),
                    rotY: fieldHash(gx, gz, 521 + t) * Math.PI * 2,
                  });
                } else if (tallRoll) {
                  const woodRoll = fieldHash(
                    Math.round(worldX),
                    Math.round(worldZ),
                    503
                  );
                  if (
                    worldZ > -4000 &&
                    (villageNoise > 0.35 || cherryNoise > 0.45) &&
                    woodRoll < 0.18
                  ) {
                    magnoliaTreePositions.push(treeSpot);
                  } else if (woodRoll < (worldZ < 0 ? 0.5 : 0.3)) {
                    birchTreePositions.push(treeSpot);
                  } else if (woodRoll < 0.78) {
                    oakTreePositions.push(treeSpot);
                  } else {
                    tallDeciduousTreePositions.push(treeSpot);
                  }
                } else {
                  const woodRoll = fieldHash(
                    Math.round(worldX),
                    Math.round(worldZ),
                    509
                  );
                  if (woodRoll < 0.45) {
                    broadleafOakTreePositions.push(treeSpot);
                  } else {
                    deciduousTreePositions.push(treeSpot);
                  }
                }
              }
            }
          }
        }
      }
      // Hay bales on some of the mown meadows among the fields (fields
      // with no crop), in loose rows along the strip. From hashes of the
      // field and the grid point, not the chunk's rolls.
      if (farm > 0.4 && slopeFactor < 0.25) {
        const f = fieldAt(worldX, worldZ, simplex);
        if (f.crop === -1) {
          const fi = Math.floor(f.u / FIELD_WIDTH);
          const fj = Math.floor(f.v / FIELD_LENGTH);
          const gx = Math.round(worldX / gridSpacing);
          const gz = Math.round(worldZ / gridSpacing);
          if (
            !sharedEdge &&
            fieldHash(f.bx * 31 + fi, f.bz * 17 + fj, 9) < HAY_FIELD_CHANCE &&
            fieldHash(gx, gz, 23) < HAY_BALE_CHANCE * densityScale
          ) {
            const jx = (fieldHash(gx, gz, 29) - 0.5) * gridSpacing * 0.7;
            const jz = (fieldHash(gx, gz, 31) - 0.5) * gridSpacing * 0.7;
            const pair = fieldHash(gx, gz, 37) < 0.35;
            for (let b = 0; b < (pair ? 2 : 1); b++) {
              // A pair lies end to end along the bale's axis
              const ax = Math.cos(f.angle) * 6 * b;
              const az = -Math.sin(f.angle) * 6 * b;
              const hx = localX + jx + ax;
              const hz = localZ + jz + az;
              hayBalePositions.push({
                x: hx,
                y: heightAtLocal(hx, hz),
                z: hz,
                rotY: f.angle + (fieldHash(gx, gz, 41 + b) - 0.5) * 0.4,
              });
            }
          }
        }
      }
      // Now and then a tractor stands out in a crop field, along its
      // strip: each field has one spot for it, built by the grid point
      // nearest to it (hashes, not the chunk's rolls)
      if (farm > 0.4 && slopeFactor < 0.2 && snowFactor < 0.1) {
        const f = fieldAt(worldX, worldZ, simplex);
        const tractor = f.crop >= 0 && tractorSpot(f);
        if (
          tractor &&
          Math.round(tractor.x / gridSpacing) ===
            Math.round(worldX / gridSpacing) &&
          Math.round(tractor.z / gridSpacing) ===
            Math.round(worldZ / gridSpacing)
        ) {
          const tx = tractor.x - worldOffsetX;
          const tz = tractor.z - worldOffsetZ;
          // A spot on the chunks' shared edge goes to one of them
          const half = chunkSize / 2;
          if (tx >= -half && tx < half && tz >= -half && tz < half)
            tractorPositions.push({
              type: tractor.type,
              x: tx,
              y: heightAtLocal(tx, tz),
              z: tz,
              rotY: tractor.rotY,
            });
        }
      }
      // Fairly flat farmland outside the villages can take a farmstead
      // (placed after the loop, farmsteadsAt)
      if (farm > 0.3 && villageNoise < 0.4 && slopeFactor < 0.2) {
        steadOk[vertI] = 1;
      }
      // Hedgerows between the fields (fieldAt): bushes, and now and then a
      // tree, lined up along the field edges
      if (farm > 0.3 && rng() < 0.35 * farm * densityScale) {
        const hedge = hedgeNear(
          worldX + (rng() - 0.5) * gridSpacing,
          worldZ + (rng() - 0.5) * gridSpacing,
          simplex,
          30
        );
        if (hedge) {
          const spot = {
            x: hedge.x - worldOffsetX,
            y: getElevation(hedge.x, hedge.z, elevParams),
            z: hedge.z - worldOffsetZ,
          };
          if (spot.y > sandMaxHeight + 1) {
            if (rng() < 0.75) {
              spot.rotY = rng() * Math.PI * 2;
              bushPositions.push(spot);
            } else {
              const hedgeRoll = fieldHash(
                Math.round(hedge.x),
                Math.round(hedge.z),
                601
              );
              if (snowFactor < 0.1 && hedgeRoll < 0.6) {
                fruitTreeLists[Math.floor((hedgeRoll / 0.6) * 4)].push(spot);
              } else if (hedgeRoll < 0.8) {
                broadleafOakTreePositions.push(spot);
              } else {
                deciduousTreePositions.push(spot);
              }
            }
          }
        }
      }
      if (isForest) {
        if (isAlienLand) {
          if (isEast) {
            if (treeRoll < 0.032 * densityScale) {
              const scaleRoll = rng();
              let scale;
              if (scaleRoll < 0.25) {
                scale = 0.5 + rng() * 0.4;
              } else if (scaleRoll < 0.8) {
                scale = 1.0 + rng() * 1.0;
              } else {
                scale = 2.2 + rng() * 2.3;
              }
              const capColor =
                ALIEN_MUSHROOM_CAP_COLORS[
                  Math.floor(rng() * ALIEN_MUSHROOM_CAP_COLORS.length)
                ];
              mushroomTreePositions.push({
                x: localX,
                y: height,
                z: localZ,
                scale: scale,
                color: capColor,
              });
            }
          } else if (treeRoll < 0.012 * densityScale) {
            pushCrystal();
          }
        } else if (
          treeCount === 0 &&
          treeRoll < (treeChance % 1) + 0.001 * densityScale
        ) {
          const offX = (rng() - 0.5) * 15;
          const offZ = (rng() - 0.5) * 15;
          const h = getElevation(worldX + offX, worldZ + offZ, elevParams);
          campfirePositions.push({x: localX + offX, y: h, z: localZ + offZ});
        }
      } else if (treeCount === 0) {
        // Open ground (unless a lone tree took this spot)
        if (isEastAlien) {
          // A few columns are mushroom groves, crowded with big ones; and
          // now and then a giant towers over a column's top
          const grove =
            basaltCol !== null &&
            basaltCol.spire === 0 &&
            basaltCol.tint > 0.86;
          const flatTop = slopeFactor < 0.25;
          const giantRoll = rng();
          if (flatTop && giantRoll < 0.0004 * densityScale) {
            mushroomTreePositions.push({
              x: localX,
              y: height,
              z: localZ,
              scale: 9 + rng() * 7,
              color:
                ALIEN_MUSHROOM_CAP_COLORS[
                  Math.floor(rng() * ALIEN_MUSHROOM_CAP_COLORS.length)
                ],
            });
          } else if (rng() < (grove ? 0.09 : 0.007) * densityScale) {
            const scaleRoll = rng();
            let scale;
            if (grove) {
              scale = 2 + rng() * 3.5;
            } else if (scaleRoll < 0.3) {
              scale = 0.5 + rng() * 0.4;
            } else if (scaleRoll < 0.85) {
              scale = 1.0 + rng() * 1.0;
            } else {
              scale = 2.2 + rng() * 2.3;
            }
            const capColor =
              ALIEN_MUSHROOM_CAP_COLORS[
                Math.floor(rng() * ALIEN_MUSHROOM_CAP_COLORS.length)
              ];
            mushroomTreePositions.push({
              x: localX,
              y: height,
              z: localZ,
              scale: scale,
              color: capColor,
            });
          }
        } else if (isAlienLand) {
          // The western alien land: crystal clusters, nothing else
          if (rng() < 0.004 * densityScale) pushCrystal();
        } else {
          // (Every building here needs fairly flat ground: houses through
          // \`flat\`, the rest through their slopeFactor limits below.)
          // Houses gather in villages and hamlets (a slow noise field, so a
          // village is a few hundred units across), with only a few lone
          // farmhouses between them, and only on fairly flat ground
          const village = Math.max(0, Math.min(1, (villageNoise - 0.45) / 0.3));
          const flat =
            1 - Math.max(0, Math.min(1, (slopeFactor - 0.12) / 0.12));
          const houseThreshold =
            ((desertFactor > 0.5 ? 0.0008 : 0.0015) +
              (desertFactor > 0.5 ? 0.05 : 0.12) * village * village) *
            flat *
            densityScale;
          // A village's houses share an orientation, like houses along its
          // streets (turned by a quarter, or a little off, now and then)
          const villageAngle = villageAngleAt(worldX, worldZ, simplex);
          const houseRotY = () =>
            village > 0
              ? villageAngle +
                (rng() < 0.3 ? Math.PI / 2 : 0) +
                (rng() < 0.5 ? Math.PI : 0) +
                (rng() - 0.5) * 0.25
              : rng() * Math.PI * 2;
          const barnThreshold = houseThreshold + 0.002 * densityScale;
          const monasteryThreshold = houseThreshold + 0.0023 * densityScale;
          const castleThreshold = houseThreshold + 0.0024 * densityScale;
          const windmillThreshold = houseThreshold + 0.0008 * densityScale;

          const plainsRoll = rng();
          if (plainsRoll < houseThreshold) {
            const isIsland =
              worldX > 3000 &&
              ChillFlightLogic.getBiome(worldX, worldZ, simplex) < -0.1;
            const isBeyond5DegNorth = worldZ < -25000;
            const isBeyond1DegNorth = worldZ < -5000;

            if (
              !isAlienLand &&
              !isBeyond5DegNorth &&
              (!isIsland || !isBeyond1DegNorth)
            ) {
              // In a village, a house has neighbors in a row beside it, along
              // the village's orientation, so houses line streets rather than
              // sitting a whole grid cell apart
              const rotY = houseRotY();
              const neighbors =
                village > 0.35 ? Math.floor(rng() * (1 + 2.5 * village)) : 0;
              const rowX = Math.cos(villageAngle);
              const rowZ = -Math.sin(villageAngle);
              // Each house's own proportions: one-story houses are sometimes
              // long farmhouses, two-story ones sometimes narrow townhouses,
              // and all vary a little (sx widens along the ridge, sy raises)
              // Regional styles: stone and slate in the snowy north, adobe
              // with flat roofs in the arid south
              const houseStyle =
                desertFactor > 0.5
                  ? 'adobe'
                  : snowFactor > 0.25 || worldZ < -8000
                    ? 'stone'
                    : 'plain';
              let rowEnd = 0;
              for (let k = 0; k <= neighbors; k++) {
                const twoStory = !isIsland && rng() > 0.85;
                const sx = twoStory
                  ? rng() < 0.4
                    ? 0.68 + rng() * 0.1
                    : 0.92 + rng() * 0.15
                  : rng() < 0.3
                    ? 1.5 + rng() * 0.3
                    : 0.9 + rng() * 0.2;
                const sy = 0.92 + rng() * 0.18;
                // Spaced along the row by their widths (a house is up to 6 *
                // sx from its center along the row), with a small gap
                const half = 6.5 * sx;
                const along = k === 0 ? 0 : rowEnd + half + 3 + rng() * 5;
                rowEnd = along + half;
                const across = (rng() - 0.5) * 4;
                const hx = localX + rowX * along - rowZ * across;
                const hz = localZ + rowZ * along + rowX * across;
                const hy = k === 0 ? height : heightAtLocal(hx, hz);
                const houseRot = k === 0 ? rotY : houseRotY();
                // Straw huts on the tropical islands; the desert's islands
                // get its adobe houses
                if (isIsland && houseStyle !== 'adobe') {
                  if (swampFactor < 0.2) {
                    strawHutPositions.push({
                      x: hx,
                      y: hy,
                      z: hz,
                      rotY: houseRot,
                    });
                  }
                  continue;
                }
                if (swampFactor < 0.2) {
                  (twoStory ? twoStoryHousePositions : housePositions).push({
                    x: hx,
                    y: hy,
                    z: hz,
                    rotY: houseRot,
                    sx,
                    sy,
                    style: houseStyle,
                  });
                  if (snowFactor > 0.3 && houseStyle !== 'adobe') {
                    chimneySmokePositions.push({x: hx, y: hy + 10, z: hz});
                  }
                }
              }
            }
          } else if (
            !isAlienLand &&
            ENABLE_BARNS &&
            worldX < -5000 &&
            plainsRoll < barnThreshold &&
            slopeFactor < 0.2 &&
            snowFactor < 0.4 &&
            desertFactor < 0.3 &&
            height > WATER_LEVEL + 15 &&
            height < MOUNTAIN_LEVEL - 100
          ) {
            const rotY = rng() * Math.PI * 2;
            if (swampFactor < 0.2) {
              barnPositions.push({
                x: localX,
                y: height,
                z: localZ,
                rotY,
              });
            }
          } else if (
            !isAlienLand &&
            ENABLE_MONASTERIES &&
            plainsRoll < monasteryThreshold &&
            slopeFactor < 0.2 &&
            snowFactor < 0.2 &&
            desertFactor < 0.2 &&
            height > WATER_LEVEL + 50 &&
            height < MOUNTAIN_LEVEL - 50
          ) {
            monasteryPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            !isAlienLand &&
            ENABLE_CASTLE_RUINS &&
            plainsRoll < castleThreshold &&
            slopeFactor < 0.3 &&
            snowFactor < 0.5 &&
            desertFactor < 0.3 &&
            height > WATER_LEVEL + 40 &&
            height < MOUNTAIN_LEVEL - 30
          ) {
            castleRuinsPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            !isAlienLand &&
            plainsRoll < windmillThreshold &&
            slopeFactor < 0.2 &&
            height > WATER_LEVEL + 5 &&
            height < MOUNTAIN_LEVEL - 100 &&
            desertFactor < 0.3 &&
            snowFactor < 0.3
          ) {
            // Windmills all face into the wind (see WINDMILL_ROT_Y), but this
            // roll stays so the rolls after it, and the world, don't shift.
            rng();
            if (swampFactor < 0.2) {
              windmillPositions.push({x: localX, y: height, z: localZ});
            }
          }

          if (
            height > WATER_LEVEL + 0.5 &&
            height < WATER_LEVEL + 3 &&
            rng() < 0.15 * densityScale
          ) {
            // Out toward the deepest water round about (of eight ways, 40
            // units off), so the pier runs out from the shore rather than
            // along it
            // (only where there's water 20 units off on one side)
            const shore =
              getElevation(worldX, worldZ - 20, elevParams) <= WATER_LEVEL ||
              getElevation(worldX, worldZ + 20, elevParams) <= WATER_LEVEL ||
              getElevation(worldX + 20, worldZ, elevParams) <= WATER_LEVEL ||
              getElevation(worldX - 20, worldZ, elevParams) <= WATER_LEVEL;
            let angleToWater = -1;
            let ell = false;
            let deepest = WATER_LEVEL;
            for (let k = 0; shore && k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              const h = getElevation(
                worldX + Math.sin(a) * 40,
                worldZ + Math.cos(a) * 40,
                elevParams
              );
              if (h <= deepest) {
                deepest = h;
                angleToWater = a;
              }
            }
            // Open water out past the pier's end and to either side of it,
            // so it doesn't jam into a narrow inlet between steep banks
            if (angleToWater !== -1) {
              const dx = Math.sin(angleToWater);
              const dz = Math.cos(angleToWater);
              const wet = (along, side) =>
                getElevation(
                  worldX + dx * along + dz * side,
                  worldZ + dz * along - dx * side,
                  elevParams
                ) <= WATER_LEVEL;
              const open =
                wet(20, 0) &&
                wet(45, 0) &&
                wet(80, 0) &&
                wet(30, -35) &&
                wet(30, 35) &&
                wet(60, -50) &&
                wet(60, 50);
              if (!open) angleToWater = -1;
              // About a third of the piers turn off to one side at the end
              // (an L, building-models.js buildPierGeo) where there's open
              // water under the arm and past it
              else
                ell =
                  fieldHash(Math.round(worldX), Math.round(worldZ), 1307) <
                    PIER_ELL_CHANCE &&
                  wet(37, -20) &&
                  wet(37, -40) &&
                  wet(55, -30);
            }
            if (angleToWater !== -1 && swampFactor < 0.2) {
              pierPositions.push({
                x: localX,
                y: height,
                z: localZ,
                rotY: angleToWater,
                ell,
              });
            }
          }
        }
      }

      if (rng() < 0.015 * densityScale) {
        if (snowFactor > 0.4)
          snowRockPositions.push({x: localX, y: height, z: localZ});
        else if (desertFactor > 0.4)
          desertRockPositions.push({x: localX, y: height, z: localZ});
        else if (swampFactor < 0.4)
          rockPositions.push({x: localX, y: height, z: localZ});
      }

      if (
        !isAlienLand &&
        desertFactor > 0.4 &&
        rng() < 0.04 * densityScale &&
        height > WATER_LEVEL + 5 &&
        height < MOUNTAIN_LEVEL - 50
      ) {
        cactusPositions.push({x: localX, y: height, z: localZ});
      }
      if (
        !isAlienLand &&
        snowFactor > 0.6 &&
        rng() < 0.002 * densityScale &&
        height > WATER_LEVEL + 5 &&
        height < MOUNTAIN_LEVEL - 50
      ) {
        snowmanPositions.push({
          x: localX,
          y: height,
          z: localZ,
          rotY: rng() * Math.PI * 2,
        });
      }
      if (
        !isAlienLand &&
        desertFactor < 0.2 &&
        snowFactor < 0.3 &&
        height > WATER_LEVEL + 3 &&
        height < MOUNTAIN_LEVEL - 100 &&
        rng() < 0.08 * densityScale
      ) {
        bushPositions.push({
          x: localX,
          y: height,
          z: localZ,
          rotY: rng() * Math.PI * 2,
        });
      } else if (
        !isAlienLand &&
        desertFactor >= 0.2 &&
        slopeFactor < 0.4 &&
        height > WATER_LEVEL + 3 &&
        height < MOUNTAIN_LEVEL - 50 &&
        rng() <
          (simplex.noise2D(worldX * 0.004 + 19, worldZ * 0.004 - 53) > 0.1
            ? DESERT_SCRUB_PATCH
            : DESERT_SCRUB_LONE) *
            densityScale
      ) {
        // Desert scrub: low, dusty sage-green bushes in loose patches
        bushPositions.push({
          x: localX,
          y: height,
          z: localZ,
          rotY: rng() * Math.PI * 2,
          scrub: true,
        });
      }
    }

    // Ice fishing huts out on a frozen lake, in little camps. From hashes of
    // the grid point, not the chunk's rolls.
    if (_enableObjects && isLakeIce && !isAlienLand && !sharedEdge) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      if (
        simplex.noise2D(worldX * 0.002 + 61, worldZ * 0.002 - 47) > 0.55 &&
        fieldHash(gx, gz, 71) < ICE_HUT_CHANCE * densityScale
      ) {
        iceHutPositions.push({
          x: localX + (fieldHash(gx, gz, 73) - 0.5) * gridSpacing * 0.6,
          y: height,
          z: localZ + (fieldHash(gx, gz, 79) - 0.5) * gridSpacing * 0.6,
          rotY: fieldHash(gx, gz, 83) * Math.PI * 2,
          color:
            ICE_HUT_COLORS[
              Math.floor(fieldHash(gx, gz, 89) * ICE_HUT_COLORS.length)
            ],
        });
      }
    }

    // A mushroom cottage in some of the eastern mushroom groves (the
    // basalt columns crowded with big mushrooms), checked like the
    // landmarks below
    if (
      _enableObjects &&
      !sharedEdge &&
      isEastAlien &&
      basaltCol !== null &&
      basaltCol.spire === 0 &&
      basaltCol.tint > 0.86 &&
      slopeFactor < 0.2 &&
      height > WATER_LEVEL + 3
    ) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      if (
        fieldHash(gx, gz, 1351) / densityScale <
        LANDMARK_RULES.mushroomCottage.chance
      ) {
        landmarkPositions.push({
          type: 'mushroomCottage' + (fieldHash(gx, gz, 1353) < 0.5 ? 0 : 1),
          rule: 'mushroomCottage',
          group: landmarkPositions.length,
          x: localX,
          y: height,
          z: localZ,
          rotY: fieldHash(gx, gz, 1357) * Math.PI * 2,
        });
      }
    }

    // Landmarks (LANDMARK_RULES), from hashes of the grid point like the
    // huts above. Checked for flat ground and roads after the grid pass.
    if (
      _enableObjects &&
      !sharedEdge &&
      !isAlienLand &&
      !isLakeIce &&
      height > WATER_LEVEL + 1
    ) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      const roll = fieldHash(gx, gz, 1201) / densityScale;
      let type = null;
      // A roadside cottage's way to the road
      let roadFacing = 0;
      if (
        isForest &&
        snowFactor < 0.4 &&
        desertFactor < 0.3 &&
        height > WATER_LEVEL + 120 &&
        height < treeLine &&
        roll < LANDMARK_RULES.fireLookout.chance
      ) {
        let ridge = true;
        for (let k = 0; k < 4 && ridge; k++) {
          const a = (k * Math.PI) / 2;
          ridge =
            getElevation(
              worldX + Math.cos(a) * LOOKOUT_RIDGE_REACH,
              worldZ + Math.sin(a) * LOOKOUT_RIDGE_REACH,
              elevParams
            ) <
            height - LOOKOUT_RIDGE_RISE;
        }
        if (ridge) type = 'fireLookout';
      } else if (
        farm > 0 &&
        villageNoise > 0.45 &&
        slopeFactor < 0.15 &&
        roll < LANDMARK_RULES.waterTower.chance
      ) {
        type = 'waterTower';
      } else if (
        height > sandMaxHeight + 3 &&
        desertFactor > 0.08 &&
        desertFactor < 0.7 &&
        slopeFactor < 0.2 &&
        snowFactor < 0.1 &&
        roll < LANDMARK_RULES.windpump.chance
      ) {
        type = 'windpump';
      } else if (
        height < sandMaxHeight &&
        snowFactor < 0.2 &&
        desertFactor < 0.5 &&
        swampFactor < 0.2 &&
        roll < LANDMARK_RULES.beachHut.chance
      ) {
        type = 'beachHut';
      } else if (
        height > sandMaxHeight + 3 &&
        (isForest || villageNoise < -0.35) &&
        villageNoise < -0.15 &&
        snowFactor < 0.5 &&
        desertFactor < 0.2 &&
        swampFactor < 0.2 &&
        slopeFactor < 0.12 &&
        height < treeLine - TREE_LINE_FADE &&
        roll < LANDMARK_RULES.rangerStation.chance &&
        // Only in one 3 km square in four, so they don't crowd the wilds
        fieldHash(
          Math.floor(worldX / RANGER_CELL),
          Math.floor(worldZ / RANGER_CELL),
          1331
        ) < 0.25
      ) {
        type = 'rangerStation';
      } else if (
        height > sandMaxHeight + 3 &&
        isForest &&
        villageNoise < 0 &&
        // Not among the palms (tropical islands, the warm east coast)
        !(
          worldX > 3000 &&
          worldZ > -5000 &&
          ChillFlightLogic.getBiome(worldX, worldZ, simplex) < -0.1
        ) &&
        eastCoastFactor < 0.5 &&
        snowFactor < 0.6 &&
        desertFactor < 0.2 &&
        swampFactor < 0.2 &&
        slopeFactor < 0.12 &&
        height < treeLine - TREE_LINE_FADE &&
        roll < LANDMARK_RULES.logCabin.chance &&
        fireHash(
          Math.floor(worldX / CABIN_CELL),
          Math.floor(worldZ / CABIN_CELL),
          1381
        ) < 0.6
      ) {
        type = 'logCabin' + (fireHash(gx, gz, 1383) < 0.5 ? 0 : 1);
      } else if (
        height > sandMaxHeight + 3 &&
        farm > 0 &&
        villageNoise > 0.15 &&
        villageNoise < 0.42 &&
        snowFactor < 0.2 &&
        desertFactor < 0.2 &&
        swampFactor < 0.2 &&
        slopeFactor < 0.12 &&
        roll < LANDMARK_RULES.thatchedCottage.chance
      ) {
        type = 'thatchedCottage';
      } else if (
        height > sandMaxHeight + 3 &&
        snowFactor < 0.4 &&
        desertFactor < 0.3 &&
        swampFactor < 0.2 &&
        slopeFactor < 0.12 &&
        roll < LANDMARK_RULES.roadCottage.chance
      ) {
        const d = ChillFlightLogic.highwayDistance(worldX, worldZ);
        const edge = ChillFlightLogic.ROAD_WIDTH;
        if (
          d > edge + ROAD_COTTAGE_BACK[0] &&
          d < edge + ROAD_COTTAGE_BACK[1]
        ) {
          // Facing the road: down the slope of the distance to it
          const gxd =
            ChillFlightLogic.highwayDistance(worldX + 4, worldZ) -
            ChillFlightLogic.highwayDistance(worldX - 4, worldZ);
          const gzd =
            ChillFlightLogic.highwayDistance(worldX, worldZ + 4) -
            ChillFlightLogic.highwayDistance(worldX, worldZ - 4);
          roadFacing = Math.atan2(-gxd, -gzd);
          type = 'roadCottage';
        }
      } else if (
        worldX < -5000 &&
        worldZ > 10000 &&
        height > sandMaxHeight + 3 &&
        height < MOUNTAIN_LEVEL - 50 &&
        desertFactor > 0.5 &&
        villageNoise < 0.25 &&
        slopeFactor < 0.18
      ) {
        const skullRoll = fieldHash(gx, gz, 1361) / densityScale;
        if (skullRoll < LANDMARK_RULES.dinoSkull.chance) {
          type =
            'dinoSkull' +
            Math.min(
              DINO_SKULL_LOOKS - 1,
              Math.floor(
                (skullRoll / LANDMARK_RULES.dinoSkull.chance) * DINO_SKULL_LOOKS
              )
            );
        }
      }
      // A water mill on a river bank, its wheel side (+x) to the stream
      let millRotY = null;
      if (
        !type &&
        height < WATER_LEVEL + 3 &&
        snowFactor < 0.4 &&
        desertFactor < 0.4 &&
        swampFactor < 0.2 &&
        // Only in some squares, as a bank has many grid points to try
        fireHash(
          Math.floor(worldX / MILL_CELL),
          Math.floor(worldZ / MILL_CELL),
          1213
        ) < LANDMARK_RULES.waterMill.chance
      ) {
        for (let k = 0; k < 8 && millRotY === null; k++) {
          const a = (k / 8) * Math.PI * 2;
          const rx = worldX + Math.sin(a) * MILL_FROM_RIVER;
          const rz = worldZ + Math.cos(a) * MILL_FROM_RIVER;
          if (getElevation(rx, rz, elevParams) > WATER_LEVEL - 0.5) continue;
          const flow = ChillFlightLogic.getRiverFlow(rx, rz, simplex);
          if (flow && Math.hypot(flow[0], flow[1]) > MILL_RIVER_FLOW) {
            millRotY = a - Math.PI / 2;
          }
        }
        if (millRotY !== null) type = 'waterMill';
      }
      if (type) {
        landmarkPositions.push({
          type,
          rule: type.replace(/\d+$/, ''),
          group: landmarkPositions.length,
          x: localX,
          y: height,
          z: localZ,
          // Windpumps' wheels face into the wind, like the windmills'
          rotY:
            type === 'windpump'
              ? WINDMILL_ROT_Y
              : type === 'waterMill'
                ? millRotY
                : type === 'roadCottage'
                  ? roadFacing
                  : fieldHash(gx, gz, 1203) * Math.PI * 2,
          bank: type === 'waterMill',
          look: fieldHash(gx, gz, 1207),
        });
      }
    }

    // Fallen logs and stumps where the woods thin out, from hashes of the
    // grid point like the huts above
    if (
      _enableObjects &&
      !sharedEdge &&
      isForest &&
      !isAlienLand &&
      !isLakeIce &&
      forestNoise < 0.4 &&
      desertFactor < 0.3 &&
      // Not in the snow, where bare dark wood looks pasted on
      snowFactor < 0.2 &&
      swampFactor < 0.35 &&
      slopeFactor < 0.3 &&
      height > WATER_LEVEL + 3 &&
      height < MOUNTAIN_LEVEL
    ) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      const roll = fieldHash(gx, gz, 97);
      if (roll < (FALLEN_LOG_CHANCE + STUMP_CHANCE) * densityScale) {
        const x = localX + (fieldHash(gx, gz, 101) - 0.5) * gridSpacing * 0.7;
        const z = localZ + (fieldHash(gx, gz, 103) - 0.5) * gridSpacing * 0.7;
        fallenLogPositions.push({
          x,
          y: heightAtLocal(x, z),
          z,
          rotY: fieldHash(gx, gz, 107) * Math.PI * 2,
          stump: roll >= FALLEN_LOG_CHANCE * densityScale,
          size: 0.8 + 0.4 * fieldHash(gx, gz, 109),
        });
      }
    }

    // Swamp bayou vegetation and backwater props (from hashes of the grid
    // point, so the chunk's rng() sequence stays unchanged): bald cypress,
    // tupelo and dead snags standing in shallow water and on mudbanks,
    // clumps of reeds and cattails along water edges, lily pad drifts in
    // the sloughs, and mossy hollow logs and stumps on the hummocks
    if (
      _enableObjects &&
      !sharedEdge &&
      !isAlienLand &&
      !isLakeIce &&
      !isOnRoad &&
      !onFallsWall &&
      swampFactor > 0.25 &&
      slopeFactor < 0.26
    ) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      const swampGrove =
        0.5 + 0.5 * simplex.noise2D(worldX * 0.004 + 313, worldZ * 0.004 - 197);

      // 1. Shallow-water & mudbank swamp trees, plus extra grove trees on hummocks
      if (height >= WATER_LEVEL - 1.9 && height <= WATER_LEVEL + 6.5) {
        const inSloughOrBank = height <= WATER_LEVEL + 1.4;
        const treeChanceSwamp =
          (inSloughOrBank
            ? 0.14 + 0.34 * swampGrove
            : 0.08 + 0.22 * swampGrove) *
          swampFactor *
          (segments <= 20 ? 0.55 : 1.0) *
          densityScale;
        if (fieldHash(gx, gz, 601) < treeChanceSwamp) {
          const tx =
            localX + (fieldHash(gx, gz, 603) - 0.5) * gridSpacing * 0.85;
          const tz =
            localZ + (fieldHash(gx, gz, 605) - 0.5) * gridSpacing * 0.85;
          const wx = worldOffsetX + tx;
          const wz = worldOffsetZ + tz;
          const ty = heightAtLocal(tx, tz);
          if (
            ty >= WATER_LEVEL - 2.0 &&
            ChillFlightLogic.getRoadFactor(wx, wz) === 0
          ) {
            const pick = fieldHash(gx, gz, 607);
            const sType =
              ty <= WATER_LEVEL + 0.2
                ? pick < 0.38
                  ? 'swampCypressMoss'
                  : pick < 0.68
                    ? 'swampCypress'
                    : pick < 0.84
                      ? 'swampTupelo'
                      : pick < 0.93
                        ? 'swampDeadOak'
                        : 'swampSnag'
                : pick < 0.3
                  ? 'swampCypressMoss'
                  : pick < 0.58
                    ? 'swampCypress'
                    : pick < 0.86
                      ? 'swampTupelo'
                      : pick < 0.94
                        ? 'swampDeadOak'
                        : 'swampSnag';
            swampTreePositions.push({
              type: sType,
              x: tx,
              y: Math.max(WATER_LEVEL - 1.2, ty - 0.35),
              z: tz,
              size: 0.85 + 0.45 * fieldHash(gx, gz, 611),
              rotY: fieldHash(gx, gz, 613) * Math.PI * 2,
            });
          }
        }
      }

      // 2. Clumps of tall reeds and cattails along shallow water edges and mudbanks
      if (height >= WATER_LEVEL - 1.3 && height <= WATER_LEVEL + 1.1) {
        // (A quarter as many as at first, for frame rate)
        if (fieldHash(gx, gz, 617) < 0.12 * swampFactor * densityScale) {
          const clumpCount = fieldHash(gx, gz, 619) < 0.2 ? 2 : 1;
          for (let c = 0; c < clumpCount; c++) {
            const rx =
              localX +
              (fieldHash(gx, gz, 623 + c * 2) - 0.5) * gridSpacing * 0.85;
            const rz =
              localZ +
              (fieldHash(gx, gz, 624 + c * 2) - 0.5) * gridSpacing * 0.85;
            const ry = heightAtLocal(rx, rz);
            if (
              ry >= WATER_LEVEL - 1.4 &&
              ry <= WATER_LEVEL + 1.3 &&
              ChillFlightLogic.getRoadFactor(
                worldOffsetX + rx,
                worldOffsetZ + rz
              ) === 0
            ) {
              swampReedPositions.push({
                type:
                  fieldHash(gx, gz, 631 + c) < 0.52
                    ? 'swampReeds'
                    : 'swampCattails',
                x: rx,
                y: Math.max(WATER_LEVEL - 0.4, ry - 0.15),
                z: rz,
                size: 0.85 + 0.45 * fieldHash(gx, gz, 635 + c),
                rotY: fieldHash(gx, gz, 639 + c) * Math.PI * 2,
              });
            }
          }
        }
      }

      // 3. Drifts of lily pads in the shallow backwaters
      if (height >= WATER_LEVEL - 2.6 && height <= WATER_LEVEL - 0.15) {
        if (fieldHash(gx, gz, 643) < 0.08 * swampFactor * densityScale) {
          const lx =
            localX + (fieldHash(gx, gz, 647) - 0.5) * gridSpacing * 0.8;
          const lz =
            localZ + (fieldHash(gx, gz, 649) - 0.5) * gridSpacing * 0.8;
          const ly = heightAtLocal(lx, lz);
          if (
            ly <= WATER_LEVEL - 0.1 &&
            ChillFlightLogic.getRoadFactor(
              worldOffsetX + lx,
              worldOffsetZ + lz
            ) === 0
          ) {
            swampLilyPadPositions.push({
              x: lx,
              y: WATER_LEVEL + 0.04,
              z: lz,
              size: 0.85 + 0.55 * fieldHash(gx, gz, 653),
              rotY: fieldHash(gx, gz, 655) * Math.PI * 2,
            });
          }
        }
      }

      // 4. Fallen mossy hollow logs and mossy stumps on mudbanks and hummocks
      if (height >= WATER_LEVEL - 0.2 && height <= WATER_LEVEL + 5.0) {
        if (fieldHash(gx, gz, 659) < 0.04 * swampFactor * densityScale) {
          const lx =
            localX + (fieldHash(gx, gz, 661) - 0.5) * gridSpacing * 0.75;
          const lz =
            localZ + (fieldHash(gx, gz, 663) - 0.5) * gridSpacing * 0.75;
          const ly = heightAtLocal(lx, lz);
          if (
            ly >= WATER_LEVEL - 0.3 &&
            ChillFlightLogic.getRoadFactor(
              worldOffsetX + lx,
              worldOffsetZ + lz
            ) === 0
          ) {
            swampLogPositions.push({
              type: fieldHash(gx, gz, 665) < 0.55 ? 'swampLog' : 'swampStump',
              x: lx,
              y: ly - 0.1,
              z: lz,
              size: 0.85 + 0.35 * fieldHash(gx, gz, 667),
              rotY: fieldHash(gx, gz, 671) * Math.PI * 2,
            });
          }
        }
      }
    }

    // A lighthouse on a headland: a point of fairly low land with water on
    // most sides, on the temperate and northern coasts (not the desert, the
    // ice, the alien lands or the tropical islands), in a few chunks only
    if (
      lighthouseChunk &&
      !lighthousePos &&
      !sharedEdge &&
      !isAlienLand &&
      !isLakeIce &&
      desertFactor < 0.3 &&
      snowFactor < 0.7 &&
      swampFactor < 0.2 &&
      !(
        worldX > 3000 &&
        worldZ > -5000 &&
        ChillFlightLogic.getBiome(worldX, worldZ, simplex) < -0.1
      ) &&
      height > WATER_LEVEL + 6 &&
      height < WATER_LEVEL + 70 &&
      slopeFactor < 0.35 &&
      fieldHash(
        Math.round(worldX / gridSpacing),
        Math.round(worldZ / gridSpacing),
        191
      ) < 0.3 &&
      !ChillFlightLogic.isOnAirport(worldX, worldZ, 300)
    ) {
      let wet = 0;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        if (
          getElevation(
            worldX + Math.cos(a) * 130,
            worldZ + Math.sin(a) * 130,
            elevParams
          ) <= WATER_LEVEL
        ) {
          wet++;
        }
      }
      // Out on the sea, not a lake: open water much further out too
      let open = 0;
      for (let k = 0; wet >= 5 && k < 8; k++) {
        const a = (k * Math.PI) / 4;
        if (
          getElevation(
            worldX + Math.cos(a) * 1500,
            worldZ + Math.sin(a) * 1500,
            elevParams
          ) <= WATER_LEVEL
        ) {
          open++;
        }
      }
      if (wet >= 5 && open >= 4) {
        lighthousePos = {
          x: localX,
          y: height,
          z: localZ,
          rotY:
            fieldHash(
              Math.round(worldX / gridSpacing),
              Math.round(worldZ / gridSpacing),
              193
            ) *
            Math.PI *
            2,
          headland: true,
        };
      }
    }

    // Sheep on the pastures: open, gentle, temperate grassland, from hashes
    // of the grid point; one or two grazing near each chosen point
    if (
      _enableObjects &&
      !sharedEdge &&
      !isAlienLand &&
      !isForest &&
      desertFactor < 0.2 &&
      snowFactor < 0.2 &&
      swampFactor < 0.2 &&
      slopeFactor < 0.35 &&
      height > WATER_LEVEL + 6 &&
      height < MOUNTAIN_LEVEL + 60 &&
      simplex.noise2D(worldX * 0.0025 - 71, worldZ * 0.0025 + 23) > 0.5
    ) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      if (
        fieldHash(gx, gz, 199) < SHEEP_CHANCE * densityScale &&
        (farm <= 0.3 || fieldAt(worldX, worldZ, simplex).crop === -1)
      ) {
        const n = fieldHash(gx, gz, 211) < 0.4 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const x =
            localX + (fieldHash(gx, gz, 223 + k) - 0.5) * gridSpacing * 0.9;
          const z =
            localZ + (fieldHash(gx, gz, 227 + k) - 0.5) * gridSpacing * 0.9;
          sheepPositions.push({
            x,
            y: heightAtLocal(x, z),
            z,
            rotY: fieldHash(gx, gz, 229 + k) * Math.PI * 2,
            size: 1.15 + 0.3 * fieldHash(gx, gz, 233 + k),
            color:
              SHEEP_WOOL_COLORS[
                Math.floor(
                  fieldHash(gx, gz, 239 + k) * SHEEP_WOOL_COLORS.length
                )
              ],
          });
        }
      }
    }

    // A few mountain goats on the rocky slopes round the tree line, and deer
    // in the temperate woods (not among the palms), in patches; 1 to 3 in
    // a group
    if (
      _enableObjects &&
      !sharedEdge &&
      !isAlienLand &&
      desertFactor < 0.2 &&
      swampFactor < 0.2 &&
      snowFactor < 0.6 &&
      height > WATER_LEVEL + 6
    ) {
      const goatLand =
        height > treeLine - 120 && slopeFactor > 0.12 && slopeFactor < 0.7;
      const deerLand =
        !goatLand &&
        isForest &&
        slopeFactor < 0.3 &&
        height < treeLine - TREE_LINE_FADE &&
        eastCoastFactor < 0.5;
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      if (
        (goatLand || deerLand) &&
        fieldHash(gx, gz, 751) <
          (goatLand ? GOAT_CHANCE : DEER_CHANCE) * densityScale &&
        simplex.noise2D(worldX * 0.002 + 41, worldZ * 0.002 - 17) > 0.3 &&
        (goatLand ||
          !(
            worldX > 3000 &&
            worldZ > -5000 &&
            ChillFlightLogic.getBiome(worldX, worldZ, simplex) < -0.1
          ))
      ) {
        const kind = goatLand ? 'goat' : 'deer';
        const colors = goatLand ? GOAT_COLORS : DEER_COLORS;
        const n = 1 + Math.floor(fireHash(gx, gz, 753) * 3);
        const facing = fireHash(gx, gz, 755) * Math.PI * 2;
        for (let k = 0; k < n; k++) {
          const x = localX + (fireHash(gx, gz, 760 + k * 10) - 0.5) * 24;
          const z = localZ + (fireHash(gx, gz, 761 + k * 10) - 0.5) * 24;
          const y = heightAtLocal(x, z);
          if (y < WATER_LEVEL + 2) continue;
          herdPositions.push({
            kind,
            x,
            y,
            z,
            // Grazing roughly the same way
            rotY: facing + (fireHash(gx, gz, 762 + k * 10) - 0.5) * 1.6,
            size: 1.15 + 0.3 * fireHash(gx, gz, 763 + k * 10),
            color:
              colors[
                Math.floor(fireHash(gx, gz, 764 + k * 10) * colors.length)
              ],
          });
        }
      }
    }

    // A channel buoy in the shallows off the coast (not among the ice, nor
    // off the wild western coasts)
    if (
      _enableObjects &&
      !sharedEdge &&
      !isAlienLand &&
      !isLakeIce &&
      snowFactor < 0.5 &&
      swampFactor < 0.2 &&
      height < WATER_LEVEL - BUOY_MIN_DEPTH &&
      height > WATER_LEVEL - BUOY_MAX_DEPTH
    ) {
      const gx = Math.round(worldX / gridSpacing);
      const gz = Math.round(worldZ / gridSpacing);
      if (fieldHash(gx, gz, 163) < BUOY_CHANCE * densityScale) {
        buoyPositions.push({
          x: localX,
          y: WATER_LEVEL,
          z: localZ,
          rotY: fieldHash(gx, gz, 167) * Math.PI * 2,
          color: BUOY_COLORS[fieldHash(gx, gz, 173) < 0.5 ? 0 : 1],
        });
      }
    }

    // The falls landmark's top, above the tree line: boulders among its
    // crags, a few stunted pines out of the wind, and bushes along the stream
    if (_enableObjects && falls !== null && falls.out < -20) {
      const roll = rng();
      if (roll < (0.06 + 0.5 * falls.crag) * densityScale) {
        rockPositions.push({x: localX, y: height, z: localZ});
      } else if (
        falls.crag < 0.2 &&
        falls.valley < 0.5 &&
        roll < 0.6 &&
        rng() < 0.3 * densityScale
      ) {
        const jx = localX + (rng() - 0.5) * gridSpacing * 0.8;
        const jz = localZ + (rng() - 0.5) * gridSpacing * 0.8;
        snowTreePositions.push({
          x: jx,
          y: heightAtLocal(jx, jz),
          z: jz,
          size: 0.5 + rng() * 0.3,
        });
      } else if (
        falls.valley > 0.25 &&
        falls.valley < 0.85 &&
        rng() < 0.3 * densityScale
      ) {
        bushPositions.push({
          x: localX,
          y: height,
          z: localZ,
          rotY: rng() * Math.PI * 2,
        });
      }
    }

    // Final detail pass (slope darkening & grain)
    if (
      (height <= MOUNTAIN_LEVEL || isLowland) &&
      slopeFactor > 0.45 &&
      height > WATER_LEVEL + 5
    ) {
      const cliffBlend = Math.min(1, (slopeFactor - 0.45) * 5.0);
      const isSouthBiome = desertFactor > 0.3;
      const rockColor = isSouthBiome ? _colorCliffSouth : _colorMountainTint;
      _tempColorObj.lerp(rockColor, cliffBlend);
      _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.15);
    } else if ((height <= MOUNTAIN_LEVEL || isLowland) && slopeFactor > 0.1) {
      _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.3);
    }

    _tempColorObj.multiplyScalar(1.0 + grain);

    // The canyon's rock: each tier of its walls is its own layer of
    // sandstone (rust, cream, orange, deep red, tan), so the gorge steps down
    // in bands of colour like the Grand Canyon's strata
    const canyonRock = ChillFlightLogic.canyonRockAt(worldX, worldZ, simplex);
    if (canyonRock > 0 && height > WATER_LEVEL + 4) {
      const tier = Math.floor(
        (height - WATER_LEVEL - 14) / ChillFlightLogic.CANYON_TIER_HEIGHT
      );
      const band =
        _canyonBands[
          ((tier % _canyonBands.length) + _canyonBands.length) %
            _canyonBands.length
        ];
      _tempColorObj.lerp(band, canyonRock * 0.85);
    }

    // The pyramids' stone: sandstone laid in courses, with a pale cap on
    // the great one's tip
    const pyramidStone = ChillFlightLogic.pyramidStoneAt(
      worldX,
      worldZ,
      simplex,
      elevParams
    );
    if (pyramidStone > 0) {
      _tempColorObj.copy(
        pyramidStone > PYRAMID_CAP ? _colorPyramidCap : _colorPyramidStone
      );
      if (Math.floor(pyramidStone / PYRAMID_COURSE) % 2) {
        _tempColorObj.multiplyScalar(0.93);
      }
      _tempColorObj.multiplyScalar(1.0 + grain);
    }

    // The falls landmark's crags are bare rock
    if (falls !== null && falls.crag > 0) {
      _tempColorObj.lerp(
        mottle > 0.5 ? _colorMountainTint : _colorAlpineRockDark,
        Math.min(1, falls.crag * 2) * 0.9
      );
    }

    // The dragon skeleton's hollow is wind-scoured bare stone
    const dragonBed = ChillFlightLogic.dragonBedAt(
      worldX,
      worldZ,
      simplex,
      elevParams
    );
    if (dragonBed > 0) {
      _tempColorObj.lerp(
        mottle > 0.5 ? _colorMountainTint : _colorAlpineRockDark,
        dragonBed * 0.88
      );
    }

    // Volcano texturing
    if (distToVolcano < 2000) {
      const vFactor = Math.max(0, Math.min(1, (2000 - distToVolcano) / 1000));
      const basaltColor = _colorVolcanoBasaltHi
        .clone()
        .lerp(_colorVolcanoBasaltLo, height / 1400);
      _tempColorObj.lerp(basaltColor, vFactor);
    }

    terrainColors[colorIdx++] = _tempColorObj.r;
    terrainColors[colorIdx++] = _tempColorObj.g;
    terrainColors[colorIdx++] = _tempColorObj.b;
  }

  // Farmsteads (farmsteadsAt): each farm parcel touching this chunk whose
  // barn spot is on this chunk, on a grid point fit for one, with the
  // trees, bushes and rocks cleared from around the barn and windmill
  if (_enableObjects) {
    const steadClear = [];
    const bx0 = Math.floor((worldOffsetX - halfSize - 300) / FARM_BLOCK);
    const bx1 = Math.floor((worldOffsetX + halfSize + 300) / FARM_BLOCK);
    const bz0 = Math.floor((worldOffsetZ - halfSize - 300) / FARM_BLOCK);
    const bz1 = Math.floor((worldOffsetZ + halfSize + 300) / FARM_BLOCK);
    const vertexAt = (wx, wz) => {
      const ix = Math.round((wx - worldOffsetX + halfSize) / gridSpacing);
      const iz = Math.round((wz - worldOffsetZ + halfSize) / gridSpacing);
      return ix < 0 || iz < 0 || ix > segments || iz > segments
        ? -1
        : iz * gridX1 + ix;
    };
    for (let bx = bx0; bx <= bx1; bx++) {
      for (let bz = bz0; bz <= bz1; bz++) {
        const cx = (bx + 0.5) * FARM_BLOCK;
        const cz = (bz + 0.5) * FARM_BLOCK;
        for (const stead of farmsteadsAt({
          bx,
          bz,
          cx,
          cz,
          angle: villageAngleAt(cx, cz, simplex),
        })) {
          const lx = stead.x - worldOffsetX;
          const lz = stead.z - worldOffsetZ;
          if (Math.abs(lx) >= halfSize || Math.abs(lz) >= halfSize) continue;
          const v = vertexAt(stead.x, stead.z);
          if (v < 0 || !steadOk[v]) continue;
          const by = getElevation(stead.x, stead.z, elevParams);
          if (by <= WATER_LEVEL + 5) continue;
          barnPositions.push({
            x: lx,
            y: by,
            z: lz,
            rotY: stead.rotY,
            stead: true,
          });
          steadClear.push({x: lx, z: lz, r: 26});
          const mv = vertexAt(stead.mx, stead.mz);
          if (stead.mill && mv >= 0 && steadOk[mv]) {
            const my = getElevation(stead.mx, stead.mz, elevParams);
            if (my > WATER_LEVEL + 5) {
              const mlx = stead.mx - worldOffsetX;
              const mlz = stead.mz - worldOffsetZ;
              windmillPositions.push({x: mlx, y: my, z: mlz});
              steadClear.push({x: mlx, z: mlz, r: 16});
            }
          }
        }
      }
    }
    if (steadClear.length > 0) {
      const clearStead = (arr) => {
        let kept = 0;
        for (const p of arr) {
          let blocked = false;
          for (const c of steadClear) {
            const dx = p.x - c.x;
            const dz = p.z - c.z;
            if (dx * dx + dz * dz < c.r * c.r) {
              blocked = true;
              break;
            }
          }
          if (!blocked) arr[kept++] = p;
        }
        arr.length = kept;
      };
      [
        treePositions,
        deciduousTreePositions,
        tallDeciduousTreePositions,
        snowTreePositions,
        autumnTree1Positions,
        autumnTree2Positions,
        autumnTree3Positions,
        cherryTreePositions,
        japaneseMapleTreePositions,
        sculptedPineTreePositions,
        birchTreePositions,
        broadleafOakTreePositions,
        oakTreePositions,
        magnoliaTreePositions,
        ...fruitTreeLists,
        deadTreePositions,
        bushPositions,
        rockPositions,
        campfirePositions,
        hayBalePositions,
        fallenLogPositions,
        sheepPositions,
        herdPositions,
        swampTreePositions,
        swampReedPositions,
        swampLogPositions,
      ].forEach(clearStead);
    }
  }

  // Road villages (see roadVillageHouses): each house on this chunk's
  // ground, if that ground is dry, flat and fit for a house, with the woods
  // and other props cleared from around it
  // Pieces of town street on this chunk ({x0, z0, x1, z1}, world)
  // Only where houses could stand (not in the alien lands, say)
  const townStreets = _enableObjects
    ? townStreetsNear(worldOffsetX, worldOffsetZ, chunkSize, elevParams).filter(
        (st) =>
          // Stopping short of the slip roads round the crossing
          !ChillFlightLogic.isOnSlipRoad(
            (st.x0 + st.x1) / 2,
            (st.z0 + st.z1) / 2,
            TOWN_STREET_STEP / 2 + TOWN_STREET_HALF_WIDTH + 2,
            simplex,
            elevParams
          ) &&
          houseStyleGrid[
            Math.round(((st.z0 + st.z1) / 2 - worldOffsetZ + halfSize) / step) *
              gridX1 +
              Math.round(((st.x0 + st.x1) / 2 - worldOffsetX + halfSize) / step)
          ] !== 0
      )
    : [];
  if (_enableObjects) {
    const villageHouses = roadVillageHousesNear(
      worldOffsetX,
      worldOffsetZ,
      chunkSize,
      elevParams
    );
    if (villageHouses.length > 0 || townStreets.length > 0) {
      const clearings = [];
      for (const st of townStreets) {
        clearings.push({
          x: (st.x0 + st.x1) / 2 - worldOffsetX,
          z: (st.z0 + st.z1) / 2 - worldOffsetZ,
          r: TOWN_STREET_STEP / 2 + TOWN_STREET_HALF_WIDTH + 4,
        });
      }
      for (const h of villageHouses) {
        const lx = h.x - worldOffsetX;
        const lz = h.z - worldOffsetZ;
        clearings.push({x: lx, z: lz, r: h.halfW + 8});
        if (
          lx < -halfSize ||
          lx >= halfSize ||
          lz < -halfSize ||
          lz >= halfSize
        )
          continue;
        const style =
          houseStyleGrid[
            Math.round((lz + halfSize) / step) * gridX1 +
              Math.round((lx + halfSize) / step)
          ];
        if (style === 0) continue;
        // The footprint's corners (along the road by halfW, across by 6)
        let lo = Infinity;
        let hi = -Infinity;
        for (const [a, b] of [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
          [0, 0],
        ]) {
          const ax = h.tx * h.halfW * a + h.tz * 6 * b;
          const az = h.tz * h.halfW * a - h.tx * 6 * b;
          const y = heightAtLocal(lx + ax, lz + az);
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
        if (
          hi - lo > 3.5 ||
          lo < WATER_LEVEL + 3 ||
          ChillFlightLogic.isOnAirport(h.x, h.z, 40) ||
          ChillFlightLogic.isOnAccessRoad(h.x, h.z, 30, simplex, elevParams) ||
          ChillFlightLogic.isOnSlipRoad(
            h.x,
            h.z,
            h.halfW + 6,
            simplex,
            elevParams
          )
        ) {
          continue;
        }
        const houseStyle =
          style === 4 ? 'adobe' : style === 1 ? 'plain' : 'stone';
        (h.twoStory ? twoStoryHousePositions : housePositions).push({
          x: lx,
          y: lo,
          z: lz,
          rotY: h.rotY,
          sx: h.sx,
          sy: h.sy,
          style: houseStyle,
          roadVillage: true,
        });
        // Smoke from some of the chimneys in the snow
        if (style === 3 && h.smoke) {
          chimneySmokePositions.push({
            x: lx,
            y: lo + 10,
            z: lz,
            roadVillage: true,
          });
        }
      }
      // Clear the trees and other props (other houses too) out of the
      // houses' way
      const clear = (arr) => {
        let kept = 0;
        for (const p of arr) {
          let blocked = false;
          if (!p.roadVillage) {
            for (const c of clearings) {
              const dx = p.x - c.x;
              const dz = p.z - c.z;
              if (dx * dx + dz * dz < c.r * c.r) {
                blocked = true;
                break;
              }
            }
          }
          if (!blocked) arr[kept++] = p;
        }
        arr.length = kept;
      };
      [
        treePositions,
        deciduousTreePositions,
        tallDeciduousTreePositions,
        palmTreePositions,
        deadTreePositions,
        joshuaTreePositions,
        snowTreePositions,
        autumnTree1Positions,
        autumnTree2Positions,
        autumnTree3Positions,
        cherryTreePositions,
        yellowCortezTreePositions,
        japaneseMapleTreePositions,
        sculptedPineTreePositions,
        birchTreePositions,
        broadleafOakTreePositions,
        oakTreePositions,
        magnoliaTreePositions,
        ...fruitTreeLists,
        bushPositions,
        hayBalePositions,
        fallenLogPositions,
        sheepPositions,
        herdPositions,
        housePositions,
        twoStoryHousePositions,
        chimneySmokePositions,
        rockPositions,
        snowRockPositions,
        desertRockPositions,
        cactusPositions,
        snowmanPositions,
        windmillPositions,
        barnPositions,
        monasteryPositions,
        castleRuinsPositions,
        swampTreePositions,
        swampReedPositions,
        swampLogPositions,
      ].forEach(clear);
    }
  }

  // Landmarks: each kept only on flat, dry ground off the roads and
  // airports and clear of the others, standing on its lowest corner, with
  // the trees and other props cleared from round it
  // A fisherman's shack beside some of the piers, set back from the water
  // to one side, facing it like the pier, and a harbour inn on the other
  // side of some
  for (const pier of pierPositions) {
    const wx = Math.round(worldOffsetX + pier.x);
    const wz = Math.round(worldOffsetZ + pier.z);
    const group = landmarkPositions.length;
    const side = fieldHash(wx, wz, 1303) < 0.5 ? -1 : 1;
    if (fieldHash(wx, wz, 1301) < LANDMARK_RULES.fishShack.chance) {
      const back = rotateY(side * 19, -17, pier.rotY);
      landmarkPositions.push({
        type: 'fishShack',
        rule: 'fishShack',
        group,
        x: pier.x + back.x,
        y: pier.y,
        z: pier.z + back.z,
        rotY: pier.rotY,
        pier: true,
      });
    }
    if (fireHash(wx, wz, 1305) < LANDMARK_RULES.coveTavern.chance) {
      const back = rotateY(-side * 26, -22, pier.rotY);
      landmarkPositions.push({
        type: 'coveTavern',
        rule: 'coveTavern',
        group,
        x: pier.x + back.x,
        y: pier.y,
        z: pier.z + back.z,
        rotY: pier.rotY,
        pier: true,
      });
    }
  }
  // A farmhouse across the yard from most of the farmsteads' barns, out
  // past the barn's door along the strip, a little to the side away from
  // any windmill, facing it
  for (const barn of barnPositions) {
    if (!barn.stead) continue;
    const wx = Math.round(worldOffsetX + barn.x);
    const wz = Math.round(worldOffsetZ + barn.z);
    if (fieldHash(wx, wz, 1331) >= LANDMARK_RULES.farmhouse.chance) continue;
    const yard = rotateY(FARMHOUSE_SIDE, FARMHOUSE_YARD, barn.rotY);
    const look =
      wz < NORTH_BARNS_Z
        ? FARMHOUSE_LOOKS - 1
        : Math.floor(fieldHash(wx, wz, 1333) * (FARMHOUSE_LOOKS - 1));
    landmarkPositions.push({
      type: 'farmhouse' + look,
      rule: 'farmhouse',
      group: landmarkPositions.length,
      x: barn.x + yard.x,
      y: barn.y,
      z: barn.z + yard.z,
      rotY: barn.rotY + Math.PI,
    });
  }
  // A lean-to shelter beside some of the campfires, its open front to the
  // fire, and a camper's trailer parked across from it at some (the
  // tent, placed in terrain-chunks.js, keeps clear of the trailer)
  for (const fire of campfirePositions) {
    const wx = Math.round(worldOffsetX + fire.x);
    const wz = Math.round(worldOffsetZ + fire.z);
    const group = landmarkPositions.length;
    const a = fieldHash(wx, wz, 1323) * Math.PI * 2;
    if (fieldHash(wx, wz, 1321) < LANDMARK_RULES.leanTo.chance) {
      landmarkPositions.push({
        type: 'leanTo',
        rule: 'leanTo',
        group,
        x: fire.x - Math.sin(a) * 11,
        y: fire.y,
        z: fire.z - Math.cos(a) * 11,
        rotY: a,
        fire,
      });
    }
    if (fireHash(wx, wz, 1327) < LANDMARK_RULES.trailer.chance) {
      // Across the fire from the lean-to, side on to the fire
      const b = a + Math.PI + (fireHash(wx, wz, 1329) - 0.5) * 0.8;
      fire.trailerAngle = b;
      landmarkPositions.push({
        type: 'trailer' + Math.floor(fireHash(wx, wz, 1331) * TRAILER_LOOKS),
        rule: 'trailer',
        group,
        x: fire.x - Math.sin(b) * TRAILER_FROM_FIRE,
        y: fire.y,
        z: fire.z - Math.cos(b) * TRAILER_FROM_FIRE,
        rotY: b + Math.PI / 2,
        fire,
      });
    }
  }
  // Each beach hut spot becomes a row of huts along the shore, facing the
  // water
  {
    const rows = [];
    for (const p of landmarkPositions) {
      const x = worldOffsetX + p.x;
      const z = worldOffsetZ + p.z;
      if (p.type === 'beachHut') {
        // Toward the lowest ground round about: the water
        let best = Infinity;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const h = getElevation(
            x + Math.sin(a) * 60,
            z + Math.cos(a) * 60,
            elevParams
          );
          if (h < best) {
            best = h;
            p.rotY = a;
          }
        }
        if (best > WATER_LEVEL) continue;
        const n = 3 + Math.floor(p.look * 3);
        for (let i = 0; i < n; i++) {
          const along = rotateY((i - (n - 1) / 2) * BEACH_HUT_STEP, 0, p.rotY);
          rows.push({
            type:
              'beachHut' +
              Math.floor(fieldHash(Math.round(x), i, 1311) * BEACH_HUT_LOOKS),
            rule: 'beachHut',
            group: p.group,
            x: p.x + along.x,
            y: p.y,
            z: p.z + along.z,
            rotY: p.rotY,
            beach: true,
          });
        }
      }
    }
    let n = 0;
    for (const p of landmarkPositions) {
      if (p.type !== 'beachHut') landmarkPositions[n++] = p;
    }
    landmarkPositions.length = n;
    landmarkPositions.push(...rows);
  }
  if (landmarkPositions.length > 0) {
    let kept = 0;
    const clearings = [];
    for (const p of landmarkPositions) {
      const rule = LANDMARK_RULES[p.rule];
      const x = worldOffsetX + p.x;
      const z = worldOffsetZ + p.z;
      const r = rule.clear;
      let lo = Infinity;
      let hi = -Infinity;
      for (const [a, b] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ]) {
        const y = heightAtLocal(
          Math.max(-halfSize, Math.min(halfSize, p.x + a * r * 0.7)),
          Math.max(-halfSize, Math.min(halfSize, p.z + b * r * 0.7))
        );
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      // Huts on the beach and shacks by the piers stand lower, just clear
      // of the water, and a water mill's wheel side goes down to the river
      const low = p.bank
        ? WATER_LEVEL - 4
        : p.beach || p.pier
          ? WATER_LEVEL + 0.8
          : WATER_LEVEL + 3;
      const road = ChillFlightLogic.ROAD_WIDTH + ROAD_BUILDING_CLEAR + r;
      if (
        Math.abs(p.x) >= halfSize ||
        Math.abs(p.z) >= halfSize ||
        nearTown(x, z, r + 40, elevParams) ||
        housePositions.some(
          (h) => h.roadVillage && Math.hypot(h.x - p.x, h.z - p.z) < r + 12
        ) ||
        twoStoryHousePositions.some(
          (h) => h.roadVillage && Math.hypot(h.x - p.x, h.z - p.z) < r + 12
        ) ||
        hi - lo > rule.flat ||
        lo < low ||
        clearings.some(
          (c) => c.group !== p.group && Math.hypot(c.x - p.x, c.z - p.z) < 300
        ) ||
        ChillFlightLogic.highwayDistance(x, z) < road ||
        ChillFlightLogic.isOnAirport(x, z, 60) ||
        ChillFlightLogic.isOnAccessRoad(x, z, r + 6, simplex, elevParams) ||
        ChillFlightLogic.isOnSlipRoad(x, z, r + 6, simplex, elevParams)
      ) {
        continue;
      }
      p.y = p.bank ? Math.max(lo, WATER_LEVEL + 0.3) : lo;
      landmarkPositions[kept++] = p;
      clearings.push({x: p.x, z: p.z, r, group: p.group});
    }
    landmarkPositions.length = kept;
    const clear = (arr) => {
      let n = 0;
      for (const q of arr) {
        let blocked = false;
        for (const c of clearings) {
          const dx = q.x - c.x;
          const dz = q.z - c.z;
          if (dx * dx + dz * dz < c.r * c.r) {
            blocked = true;
            break;
          }
        }
        if (!blocked) arr[n++] = q;
      }
      arr.length = n;
    };
    [
      treePositions,
      deciduousTreePositions,
      tallDeciduousTreePositions,
      palmTreePositions,
      deadTreePositions,
      joshuaTreePositions,
      snowTreePositions,
      autumnTree1Positions,
      autumnTree2Positions,
      autumnTree3Positions,
      cherryTreePositions,
      yellowCortezTreePositions,
      japaneseMapleTreePositions,
      sculptedPineTreePositions,
      birchTreePositions,
      broadleafOakTreePositions,
      oakTreePositions,
      magnoliaTreePositions,
      ...fruitTreeLists,
      mushroomTreePositions,
      bushPositions,
      hayBalePositions,
      fallenLogPositions,
      sheepPositions,
      herdPositions,
      housePositions,
      twoStoryHousePositions,
      chimneySmokePositions,
      rockPositions,
      snowRockPositions,
      desertRockPositions,
      cactusPositions,
      snowmanPositions,
      campfirePositions,
      windmillPositions,
      barnPositions,
      monasteryPositions,
      castleRuinsPositions,
      swampTreePositions,
      swampReedPositions,
      swampLogPositions,
    ].forEach(clear);
  }

  // A garden shed behind some of the village houses (not the towns' or
  // the road villages'), its door toward the house, wherever it fits clear
  // of the other houses and the roads, with the trees round it cleared
  {
    // Trees and other props cleared from round some new spots (r units)
    const clearAround = (spots, r) => {
      const r2 = r * r;
      const clearList = (arr) => {
        let n = 0;
        for (const q of arr) {
          if (!spots.some((c) => (q.x - c.x) ** 2 + (q.z - c.z) ** 2 < r2)) {
            arr[n++] = q;
          }
        }
        arr.length = n;
      };
      [
        treePositions,
        deciduousTreePositions,
        tallDeciduousTreePositions,
        snowTreePositions,
        autumnTree1Positions,
        autumnTree2Positions,
        autumnTree3Positions,
        cherryTreePositions,
        japaneseMapleTreePositions,
        sculptedPineTreePositions,
        birchTreePositions,
        broadleafOakTreePositions,
        oakTreePositions,
        magnoliaTreePositions,
        ...fruitTreeLists,
        deadTreePositions,
        bushPositions,
        rockPositions,
        snowRockPositions,
        hayBalePositions,
        fallenLogPositions,
        sheepPositions,
        herdPositions,
        campfirePositions,
      ].forEach(clearList);
    };

    // An inn in place of a few of the grid villages' two-storey houses,
    // where the houses round about leave it room, its chimney smoke gone
    // with the house
    const taverns = [];
    {
      const all = [...housePositions, ...twoStoryHousePositions];
      let n = 0;
      for (const h of twoStoryHousePositions) {
        let swap = false;
        if (!h.roadVillage && h.style !== 'adobe') {
          const wx = Math.round(worldOffsetX + h.x);
          const wz = Math.round(worldOffsetZ + h.z);
          const near = (o, d) => Math.hypot(o.x - h.x, o.z - h.z) < d;
          swap =
            fireHash(wx, wz, 1371) < VILLAGE_TAVERN_CHANCE &&
            !all.some((o) => o !== h && near(o, VILLAGE_TAVERN_ROOM)) &&
            !landmarkPositions.some((o) => near(o, 30)) &&
            !taverns.some((o) => near(o, 600));
        }
        if (swap) {
          taverns.push({
            type: 'villageTavern',
            rule: 'villageTavern',
            x: h.x,
            y: h.y,
            z: h.z,
            rotY: h.rotY,
          });
        } else {
          twoStoryHousePositions[n++] = h;
        }
      }
      twoStoryHousePositions.length = n;
      if (taverns.length > 0) {
        let k = 0;
        for (const q of chimneySmokePositions) {
          if (!taverns.some((t) => Math.hypot(q.x - t.x, q.z - t.z) < 12)) {
            chimneySmokePositions[k++] = q;
          }
        }
        chimneySmokePositions.length = k;
        clearAround(taverns, VILLAGE_TAVERN_ROOM - 4);
        landmarkPositions.push(...taverns);
      }
    }

    const houses = [...housePositions, ...twoStoryHousePositions];
    const sheds = [];
    for (const h of houses) {
      if (h.roadVillage || h.style === 'adobe') continue;
      const wx = Math.round(worldOffsetX + h.x);
      const wz = Math.round(worldOffsetZ + h.z);
      if (fieldHash(wx, wz, 1341) >= GARDEN_SHED_CHANCE) continue;
      const side = (fieldHash(wx, wz, 1343) - 0.5) * 2 * (5 * h.sx - 3);
      const at = rotateY(side, -GARDEN_SHED_BACK, h.rotY);
      const x = h.x + at.x;
      const z = h.z + at.z;
      if (Math.abs(x) >= halfSize || Math.abs(z) >= halfSize) continue;
      if (
        houses.some(
          (o) => o !== h && Math.hypot(o.x - x, o.z - z) < 6 + 6 * o.sx
        ) ||
        sheds.some((o) => Math.hypot(o.x - x, o.z - z) < 12) ||
        landmarkPositions.some((o) => Math.hypot(o.x - x, o.z - z) < 20)
      ) {
        continue;
      }
      const gx = worldOffsetX + x;
      const gz = worldOffsetZ + z;
      const y = heightAtLocal(x, z);
      if (
        y < WATER_LEVEL + 3 ||
        Math.abs(y - h.y) > 3 ||
        ChillFlightLogic.highwayDistance(gx, gz) <
          ChillFlightLogic.ROAD_WIDTH + 8 ||
        ChillFlightLogic.isOnAccessRoad(gx, gz, 8, simplex, elevParams) ||
        ChillFlightLogic.isOnSlipRoad(gx, gz, 8, simplex, elevParams)
      ) {
        continue;
      }
      sheds.push({
        type: 'gardenShed' + (fieldHash(wx, wz, 1347) < 0.5 ? 0 : 1),
        rule: 'gardenShed',
        x,
        y: Math.min(y, h.y),
        z,
        rotY: h.rotY,
      });
    }
    if (sheds.length > 0) {
      clearAround(sheds, GARDEN_SHED_CLEAR);
      landmarkPositions.push(...sheds);
    }

    // Flowering magnolias in warm village yards beside some houses, and small
    // orchards of apple, plum and fruit trees beside farmstead barns (seeded
    // by fieldHash with noRoll so downstream rng rolls stay unchanged)
    for (const h of houses) {
      if (h.roadVillage || h.style !== 'plain') continue;
      const wx = Math.round(worldOffsetX + h.x);
      const wz = Math.round(worldOffsetZ + h.z);
      if (wz < -4000 || fieldHash(wx, wz, 1361) >= 0.3) continue;
      const side =
        (fieldHash(wx, wz, 1363) < 0.5 ? -1 : 1) * (6 * (h.sx || 1) + 6);
      const at = rotateY(side, 4, h.rotY);
      const x = h.x + at.x;
      const z = h.z + at.z;
      if (Math.abs(x) >= halfSize || Math.abs(z) >= halfSize) continue;
      const y = heightAtLocal(x, z);
      if (
        y < WATER_LEVEL + 3 ||
        Math.abs(y - h.y) > 3 ||
        houses.some(
          (o) => o !== h && Math.hypot(o.x - x, o.z - z) < 8 + 6 * (o.sx || 1)
        ) ||
        landmarkPositions.some((o) => Math.hypot(o.x - x, o.z - z) < 16)
      ) {
        continue;
      }
      magnoliaTreePositions.push({x, y, z, noRoll: true});
    }
    for (const barn of barnPositions) {
      if (!barn.stead) continue;
      const wx = Math.round(worldOffsetX + barn.x);
      const wz = Math.round(worldOffsetZ + barn.z);
      if (wz < NORTH_BARNS_Z) continue;
      const baseKind = Math.floor(fieldHash(wx, wz, 1371) * 4);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const at = rotateY(-30 - row * 12, -10 + col * 12, barn.rotY);
          const x = barn.x + at.x;
          const z = barn.z + at.z;
          if (Math.abs(x) >= halfSize || Math.abs(z) >= halfSize) continue;
          const y = heightAtLocal(x, z);
          if (
            y < WATER_LEVEL + 3 ||
            Math.abs(y - barn.y) > 4 ||
            houses.some(
              (o) => Math.hypot(o.x - x, o.z - z) < 8 + 6 * (o.sx || 1)
            ) ||
            windmillPositions.some((o) => Math.hypot(o.x - x, o.z - z) < 16) ||
            landmarkPositions.some((o) => Math.hypot(o.x - x, o.z - z) < 16)
          ) {
            continue;
          }
          const kind = (baseKind + row) % 4;
          fruitTreeLists[kind].push({x, y, z, noRoll: true});
        }
      }
    }
  }

  // Keep the props clear of the roads, where they ended up. The check above
  // only looks at the grid point, by its distance along x (or z), which
  // lets them onto the road where it runs at an angle; and trees are set off
  // the grid, and hedgerows follow the fields. Done here, after the grid
  // pass, so the rest of the chunk comes out as before.
  if (_enableObjects) {
    const keepOffRoads = (arr, margin) => {
      let kept = 0;
      for (const p of arr) {
        const x = worldOffsetX + p.x;
        const z = worldOffsetZ + p.z;
        if (
          p.roadVillage ||
          (ChillFlightLogic.highwayDistance(x, z) >=
            ChillFlightLogic.ROAD_WIDTH + margin &&
            !ChillFlightLogic.isOnAccessRoad(
              x,
              z,
              margin,
              simplex,
              elevParams
            ) &&
            !ChillFlightLogic.isOnSlipRoad(x, z, margin, simplex, elevParams))
        ) {
          arr[kept++] = p;
        }
      }
      arr.length = kept;
    };
    [
      treePositions,
      deciduousTreePositions,
      tallDeciduousTreePositions,
      palmTreePositions,
      deadTreePositions,
      joshuaTreePositions,
      snowTreePositions,
      autumnTree1Positions,
      autumnTree2Positions,
      autumnTree3Positions,
      cherryTreePositions,
      yellowCortezTreePositions,
      japaneseMapleTreePositions,
      sculptedPineTreePositions,
      birchTreePositions,
      broadleafOakTreePositions,
      oakTreePositions,
      magnoliaTreePositions,
      ...fruitTreeLists,
      mushroomTreePositions,
      crystalPositions,
    ].forEach((arr) => keepOffRoads(arr, ROAD_TREE_CLEAR));
    [
      bushPositions,
      rockPositions,
      snowRockPositions,
      desertRockPositions,
      cactusPositions,
      snowmanPositions,
      campfirePositions,
      hayBalePositions,
      fallenLogPositions,
      sheepPositions,
      herdPositions,
    ].forEach((arr) => keepOffRoads(arr, ROAD_PROP_CLEAR));
    // A house's chimney smoke sits on the same spot, so goes with it
    [
      housePositions,
      twoStoryHousePositions,
      chimneySmokePositions,
      strawHutPositions,
      barnPositions,
      windmillPositions,
      iceHutPositions,
    ].forEach((arr) => keepOffRoads(arr, ROAD_BUILDING_CLEAR));

    // Buoys only mark harbour approaches: on the sea (open water well out,
    // not a river or lake) and near a pier, a house or the lighthouse, so
    // the wild shores stay wild
    if (buoyPositions.length > 0) {
      const anchors = [
        ...pierPositions,
        ...housePositions,
        ...twoStoryHousePositions,
        ...(lighthousePos ? [lighthousePos] : []),
      ];
      const near2 = BUOY_HARBOUR_RANGE * BUOY_HARBOUR_RANGE;
      let kept = 0;
      for (const b of buoyPositions) {
        if (!anchors.some((p) => (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < near2)) {
          continue;
        }
        let open = 0;
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          if (
            getElevation(
              worldOffsetX + b.x + Math.cos(a) * 1500,
              worldOffsetZ + b.z + Math.sin(a) * 1500,
              elevParams
            ) <= WATER_LEVEL
          ) {
            open++;
          }
        }
        if (open >= 4) buoyPositions[kept++] = b;
      }
      buoyPositions.length = kept;
    }

    // At most one rock breakwater, off a harbour on the open sea
    if (
      fireHash(chunkX, chunkZ, 1811) < BREAKWATER_CHUNK_CHANCE &&
      (pierPositions.length > 0 ||
        housePositions.length > 0 ||
        twoStoryHousePositions.length > 0 ||
        lighthousePos)
    ) {
      const bw = findBreakwater(
        chunkX,
        chunkZ,
        worldOffsetX,
        worldOffsetZ,
        halfSize,
        elevParams,
        [
          ...pierPositions,
          ...housePositions,
          ...twoStoryHousePositions,
          ...(lighthousePos ? [lighthousePos] : []),
        ],
        pierPositions
      );
      if (bw) breakwaterPositions.push(...bw);
    }

    // A headland lighthouse stays off the roads too, and clears the props
    // from around itself and its keeper's house
    if (lighthousePos?.headland) {
      const lh = [lighthousePos];
      keepOffRoads(lh, ROAD_BUILDING_CLEAR + 40);
      if (lh.length === 0) {
        lighthousePos = null;
      } else {
        const {x: lx, z: lz} = lighthousePos;
        const r2 = LIGHTHOUSE_CLEAR * LIGHTHOUSE_CLEAR;
        const clearLighthouse = (arr) => {
          let kept = 0;
          for (const p of arr) {
            const dx = p.x - lx;
            const dz = p.z - lz;
            if (dx * dx + dz * dz >= r2) arr[kept++] = p;
          }
          arr.length = kept;
        };
        [
          treePositions,
          deciduousTreePositions,
          tallDeciduousTreePositions,
          palmTreePositions,
          deadTreePositions,
          joshuaTreePositions,
          snowTreePositions,
          autumnTree1Positions,
          autumnTree2Positions,
          autumnTree3Positions,
          cherryTreePositions,
          yellowCortezTreePositions,
          japaneseMapleTreePositions,
          sculptedPineTreePositions,
          birchTreePositions,
          broadleafOakTreePositions,
          oakTreePositions,
          magnoliaTreePositions,
          ...fruitTreeLists,
          bushPositions,
          rockPositions,
          snowRockPositions,
          desertRockPositions,
          cactusPositions,
          snowmanPositions,
          campfirePositions,
          hayBalePositions,
          fallenLogPositions,
          sheepPositions,
          herdPositions,
          housePositions,
          twoStoryHousePositions,
          chimneySmokePositions,
          strawHutPositions,
          barnPositions,
          windmillPositions,
          monasteryPositions,
          castleRuinsPositions,
          pierPositions,
        ].forEach(clearLighthouse);
      }
    }

    // Nothing grows or stands on the pyramids or the dragon skeleton
    const keepOffPyramids = (arr) => {
      let kept = 0;
      for (const p of arr) {
        const wx = worldOffsetX + p.x;
        const wz = worldOffsetZ + p.z;
        if (
          ChillFlightLogic.pyramidFootAt(wx, wz, simplex, elevParams) >=
            PYRAMID_PROP_CLEAR &&
          ChillFlightLogic.dragonFootAt(wx, wz, simplex, elevParams) >=
            PYRAMID_PROP_CLEAR
        ) {
          arr[kept++] = p;
        }
      }
      arr.length = kept;
    };
    [
      treePositions,
      deciduousTreePositions,
      tallDeciduousTreePositions,
      palmTreePositions,
      deadTreePositions,
      joshuaTreePositions,
      snowTreePositions,
      autumnTree1Positions,
      autumnTree2Positions,
      autumnTree3Positions,
      cherryTreePositions,
      yellowCortezTreePositions,
      japaneseMapleTreePositions,
      sculptedPineTreePositions,
      birchTreePositions,
      broadleafOakTreePositions,
      oakTreePositions,
      magnoliaTreePositions,
      ...fruitTreeLists,
      mushroomTreePositions,
      crystalPositions,
      bushPositions,
      rockPositions,
      snowRockPositions,
      desertRockPositions,
      cactusPositions,
      snowmanPositions,
      campfirePositions,
      housePositions,
      twoStoryHousePositions,
      chimneySmokePositions,
      strawHutPositions,
      barnPositions,
      windmillPositions,
      monasteryPositions,
      castleRuinsPositions,
      rockArchPositions,
      rockArchGrassPositions,
      landmarkPositions,
    ].forEach(keepOffPyramids);
  }

  // Montauk chunk lighthouse
  if (chunkX === 5 && chunkZ === 2) {
    lighthousePos = {
      x: 0,
      y: getElevation(7500, 3000, elevParams),
      z: 0,
      rotY: rng() * Math.PI * 2,
    };
  }

  // Rock arch check
  const archSeededRng = ChillFlightLogic.mulberry32(
    ChillFlightLogic.WORLD_SEED
  );
  const archTargetZ = archSeededRng() * 10000 - 5000;
  const archTargetChunkZ = Math.round(archTargetZ / chunkSize);

  if (chunkX === 2 && chunkZ === archTargetChunkZ && _enableObjects) {
    if (rockArchPositions.length === 0 && rockArchGrassPositions.length === 0) {
      const localArchZ = archTargetZ - worldOffsetZ;
      const archHeight = Math.max(
        WATER_LEVEL,
        getElevation(worldOffsetX, worldOffsetZ + localArchZ, elevParams)
      );
      const archPos = {
        x: 0,
        y: archHeight - 10,
        z: localArchZ,
        rotY: rng() * Math.PI * 2,
      };
      if (rng() < 0.5) {
        rockArchPositions.push(archPos);
      } else {
        rockArchGrassPositions.push(archPos);
      }

      const offsets = [
        [150, 150],
        [-150, -150],
        [150, -150],
        [-150, 150],
        [250, 0],
        [-250, 0],
        [0, 250],
        [0, -250],
      ];
      for (const [dx, dz] of offsets) {
        const px = dx;
        const pz = localArchZ + dz;
        const wX = worldOffsetX + px;
        const wZ = worldOffsetZ + pz;
        const h = getElevation(wX, wZ, elevParams);
        if (h <= WATER_LEVEL - PIRATE_SHIP_MIN_DEPTH) {
          pirateShipPositions.push({
            x: px,
            y: WATER_LEVEL,
            z: pz,
            rotY: rng() * Math.PI * 2,
            bodyId: Math.floor(rng() * 4),
          });
          break;
        }
      }
    }
  }

  // Unmarked giant twisted dead oak landmark in the heart of the swamp
  // (~272 units tall, comparable to the height of the rock arch), seeded
  // once per world between the 1.0 West and 3.0 West highways.
  const giantOak = ChillFlightLogic.giantSwampOak();
  const giantOakTargetX = giantOak.x;
  const giantOakTargetZ = giantOak.z;
  const giantOakChunkX = Math.round(giantOakTargetX / chunkSize);
  const giantOakChunkZ = Math.round(giantOakTargetZ / chunkSize);
  if (
    chunkX === giantOakChunkX &&
    chunkZ === giantOakChunkZ &&
    _enableObjects
  ) {
    const localOakX = giantOakTargetX - worldOffsetX;
    const localOakZ = giantOakTargetZ - worldOffsetZ;
    const clearR2 = 95 * 95;
    const clearGiantOak = (arr) => {
      let kept = 0;
      for (const p of arr) {
        const dx = p.x - localOakX;
        const dz = p.z - localOakZ;
        if (dx * dx + dz * dz >= clearR2) arr[kept++] = p;
      }
      arr.length = kept;
    };
    [
      swampTreePositions,
      swampReedPositions,
      swampLilyPadPositions,
      swampLogPositions,
      treePositions,
      deciduousTreePositions,
      tallDeciduousTreePositions,
      deadTreePositions,
      bushPositions,
      rockPositions,
    ].forEach(clearGiantOak);
    const oakGroundY = Math.max(
      WATER_LEVEL - 1.5,
      getElevation(giantOakTargetX, giantOakTargetZ, elevParams)
    );
    swampTreePositions.push({
      type: 'swampGiantOak',
      x: localOakX,
      y: oakGroundY,
      z: localOakZ,
      rotY: giantOak.rotY,
      size: 1,
    });
  }

  // Instance collector for global instances
  const collector = new InstanceCollector();

  const renderTreesToCollector = (
    positionsList,
    trunkKey,
    leavesKey,
    baseLeafColor
  ) => {
    if (positionsList.length === 0) return;
    positionsList.forEach((pos) => {
      const worldX = worldOffsetX + pos.x;
      const worldZ = worldOffsetZ + pos.z;
      const northInfluence = Math.max(0, -worldZ / 4000);
      const snowFactor = ChillFlightLogic.snowFactorAt(
        worldZ,
        ChillFlightLogic.snowNoiseShift(worldX, worldZ, simplex)
      );
      const hx = Math.round(worldX);
      const hz = Math.round(worldZ);
      const roll = (salt) => (pos.noRoll ? fieldHash(hx, hz, salt) : rng());

      const baseScale = 0.6 + Math.min(0.6, northInfluence * 0.5);
      const scale =
        (pos.scale !== undefined
          ? pos.scale
          : baseScale + roll(1401) * (0.4 + roll(1403) * 0.5)) *
        (pos.size || 1);

      composeMatrix(
        _matBuffer,
        0,
        worldX,
        pos.y,
        worldZ,
        scale,
        scale,
        scale,
        0,
        roll(1405) * Math.PI * 2,
        0
      );

      const tKey = pos.trunkKey || trunkKey;
      const lKey = pos.leavesKey || leavesKey;

      collector.beginProp(BREAKABLE.TREE);
      if (tKey) collector.add(tKey, _matBuffer);

      if (lKey && baseLeafColor) {
        const rVariation = (roll(1407) - 0.5) * 0.1;
        const gVariation = (roll(1409) - 0.5) * 0.1;
        const bVariation = (roll(1411) - 0.5) * 0.1;

        const leafHex = pos.color !== undefined ? pos.color : baseLeafColor;
        _treeBaseColor.setHex(leafHex);
        _treeBaseColor.r = Math.max(
          0,
          Math.min(1, _treeBaseColor.r + rVariation)
        );
        _treeBaseColor.g = Math.max(
          0,
          Math.min(1, _treeBaseColor.g + gVariation)
        );
        _treeBaseColor.b = Math.max(
          0,
          Math.min(1, _treeBaseColor.b + bVariation)
        );

        _treeTempColor.copy(_treeBaseColor);
        if (
          snowFactor > 0 &&
          lKey !== 'mushroomCap' &&
          lKey !== 'crystal' &&
          lKey !== 'snowSpruceLeaves' &&
          lKey !== 'mountainRowanLeaves'
        ) {
          _treeTempColor.lerp(_snowColor, snowFactor);
        }
        collector.add(lKey, _matBuffer, _treeTempColor);
      }
      collector.endProp();
    });
  };

  renderTreesToCollector(treePositions, 'pineTrunk', 'pineLeaves', 0x1b5e20);
  renderTreesToCollector(
    snowTreePositions,
    'pineTrunk',
    'pineLeaves',
    0x1b5e20
  );
  renderTreesToCollector(
    deciduousTreePositions,
    'decidTrunk',
    'decidLeaves',
    0x1b5e20
  );
  renderTreesToCollector(
    tallDeciduousTreePositions,
    'tallDecidTrunk',
    'tallDecidLeaves',
    0x1a451d
  );
  renderTreesToCollector(
    birchTreePositions,
    'birchTrunk',
    'birchLeaves',
    0xb3d47f
  );
  renderTreesToCollector(
    broadleafOakTreePositions,
    'broadleafOakTrunk',
    'broadleafOakLeaves',
    0x77b258
  );
  renderTreesToCollector(oakTreePositions, 'oakTrunk', 'oakLeaves', 0x7d8a5a);
  renderTreesToCollector(
    magnoliaTreePositions,
    'magnoliaTrunk',
    'magnoliaLeaves',
    0xf2f2f2
  );
  renderTreesToCollector(
    appleTreePositions,
    'appleTreeTrunk',
    'appleTreeLeaves',
    0xf2f2f2
  );
  renderTreesToCollector(
    orchardAppleTreePositions,
    'orchardAppleTrunk',
    'orchardAppleLeaves',
    0xf2f2f2
  );
  renderTreesToCollector(
    plumTreePositions,
    'plumTreeTrunk',
    'plumTreeLeaves',
    0xf2f2f2
  );
  renderTreesToCollector(
    fruitTreePositions,
    'fruitTreeTrunk',
    'fruitTreeLeaves',
    0xf2f2f2
  );
  renderTreesToCollector(
    palmTreePositions,
    'palmTrunk',
    'palmLeaves',
    0x8fbf5a
  );
  renderTreesToCollector(
    cherryTreePositions,
    'cherryBlossomTrunk',
    'cherryBlossomLeaves',
    0xf7c9d6
  );
  renderTreesToCollector(
    autumnTree1Positions,
    'broadleafOakTrunk',
    'broadleafOakLeaves',
    0xd35400
  );
  renderTreesToCollector(
    autumnTree2Positions,
    'birchTrunk',
    'birchLeaves',
    0xf39c12
  );
  renderTreesToCollector(
    autumnTree3Positions,
    'oakTrunk',
    'oakLeaves',
    0xc0392b
  );
  renderTreesToCollector(
    yellowCortezTreePositions,
    'decidTrunk',
    'decidLeaves',
    0xffeb3b
  );
  renderTreesToCollector(
    mushroomTreePositions,
    'mushroomStalk',
    'mushroomCap',
    0x9c27b0
  );
  renderTreesToCollector(crystalPositions, null, 'crystal', 0xff4fd8);
  renderTreesToCollector(
    joshuaTreePositions,
    'joshuaTrunk',
    'joshuaLeaves',
    JOSHUA_LEAF_COLOR
  );
  renderTreesToCollector(
    japaneseMapleTreePositions,
    'japaneseMapleTrunk',
    'japaneseMapleLeaves',
    0xb5433a
  );
  renderTreesToCollector(
    sculptedPineTreePositions,
    'sculptedPineTrunk',
    'sculptedPineLeaves',
    0x7fa95c
  );

  if (deadTreePositions.length > 0) {
    deadTreePositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.8;
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y,
        worldOffsetZ + pos.z,
        scale,
        scale,
        scale,
        0,
        rng() * Math.PI * 2,
        0
      );
      collector.beginProp(BREAKABLE.TREE);
      collector.add(pos.deadType || 'deadTrunk', _matBuffer);
      collector.endProp();
    });
  }

  const rockVariations = [
    {pos: rockPositions, key: 'rock'},
    {pos: snowRockPositions, key: 'snowRock'},
    {pos: desertRockPositions, key: 'desertRock'},
  ];
  rockVariations.forEach((variation) => {
    if (variation.pos.length > 0) {
      variation.pos.forEach((pos) => {
        const sx = 0.5 + rng() * 2.0;
        const sy = 0.5 + rng() * 2.0;
        const sz = 0.5 + rng() * 2.0;
        composeMatrix(
          _matBuffer,
          0,
          worldOffsetX + pos.x,
          pos.y,
          worldOffsetZ + pos.z,
          sx,
          sy,
          sz,
          rng() * Math.PI,
          rng() * Math.PI,
          rng() * Math.PI
        );
        // Boulders shatter (breakables.js)
        collector.beginProp(BREAKABLE.HOUSE);
        collector.add(variation.key, _matBuffer);
        collector.endProp();
      });
    }
  });

  if (cactusPositions.length > 0) {
    cactusPositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.6;
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y,
        worldOffsetZ + pos.z,
        scale,
        scale,
        scale,
        0,
        rng() * Math.PI * 2,
        0
      );
      collector.beginProp(BREAKABLE.TREE);
      collector.add('cactus', _matBuffer);
      collector.endProp();
    });
  }

  if (snowmanPositions.length > 0) {
    snowmanPositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.4;
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y,
        worldOffsetZ + pos.z,
        scale,
        scale,
        scale,
        0,
        pos.rotY,
        0
      );
      collector.beginProp(BREAKABLE.SNOWMAN);
      collector.add('snowmanBody', _matBuffer);
      collector.add('snowmanNose', _matBuffer);
      collector.endProp();
    });
  }

  if (icebergPositions.length > 0) {
    icebergPositions.forEach((pos) => {
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y - 4,
        worldOffsetZ + pos.z,
        1,
        1,
        1,
        0,
        pos.rotY,
        0
      );
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add('iceberg', _matBuffer);
      collector.endProp();

      const r1 = rotateY(14, 6, pos.rotY);
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x + r1.x,
        pos.y - 8,
        worldOffsetZ + pos.z + r1.z,
        0.5,
        0.4,
        0.5,
        0,
        pos.rotY + 1.2,
        0
      );
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add('iceberg', _matBuffer);
      collector.endProp();

      const r2 = rotateY(-12, -8, pos.rotY);
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x + r2.x,
        pos.y - 9,
        worldOffsetZ + pos.z + r2.z,
        0.4,
        0.3,
        0.4,
        0,
        pos.rotY - 0.8,
        0
      );
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add('iceberg', _matBuffer);
      collector.endProp();
    });
  }

  if (iceFloePositions.length > 0) {
    iceFloePositions.forEach((pos) => {
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y - 1,
        worldOffsetZ + pos.z,
        1,
        1,
        1,
        0,
        pos.rotY,
        0
      );
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add('iceFloe', _matBuffer);
      collector.endProp();

      const r1 = rotateY(16, 4, pos.rotY);
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x + r1.x,
        pos.y - 1.8,
        worldOffsetZ + pos.z + r1.z,
        0.5,
        0.6,
        0.5,
        0,
        pos.rotY + 0.5,
        0
      );
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add('iceFloe', _matBuffer);
      collector.endProp();

      const r2 = rotateY(-15, -6, pos.rotY);
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x + r2.x,
        pos.y - 2,
        worldOffsetZ + pos.z + r2.z,
        0.4,
        0.5,
        0.4,
        0,
        pos.rotY - 0.5,
        0
      );
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add('iceFloe', _matBuffer);
      collector.endProp();
    });
  }

  if (penguinPositions.length > 0) {
    penguinPositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.4;
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y,
        worldOffsetZ + pos.z,
        scale,
        scale,
        scale,
        0,
        pos.rotY,
        0
      );
      collector.beginProp(BREAKABLE.CRITTER);
      collector.add('penguin', _matBuffer);
      collector.endProp();
    });
  }

  // Each small boat and tractor is one model, folded flat when hit like a
  // bush
  for (const pos of [...smallBoatPositions, ...tractorPositions]) {
    collector.beginProp(BREAKABLE.SMALL);
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      1,
      1,
      1,
      0,
      pos.rotY,
      0
    );
    collector.add(pos.type, _matBuffer);
    collector.endProp();
  }

  if (lilyPadPositions.length > 0) {
    lilyPadPositions.forEach((pos) => {
      const scale = 0.6 + rng() * 0.8;
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y + 0.15,
        worldOffsetZ + pos.z,
        scale,
        scale,
        scale,
        0,
        pos.rotY,
        0
      );
      collector.add('lilypad', _matBuffer);
    });
  }

  if (bushPositions.length > 0) {
    bushPositions.forEach((pos) => {
      const scale = (0.5 + rng() * 1.5) * (pos.scrub ? 0.8 : 1);
      composeMatrix(
        _matBuffer,
        0,
        worldOffsetX + pos.x,
        pos.y,
        worldOffsetZ + pos.z,
        scale,
        scale,
        scale,
        0,
        pos.rotY,
        0
      );
      const rVariation = (rng() - 0.5) * 0.15;
      const gVariation = (rng() - 0.5) * 0.15;
      const bVariation = (rng() - 0.5) * 0.15;

      _baseBushColor.setHex(pos.scrub ? DESERT_SCRUB_COLOR : 0x558b2f);
      _baseBushColor.r = Math.max(
        0,
        Math.min(1, _baseBushColor.r + rVariation)
      );
      _baseBushColor.g = Math.max(
        0,
        Math.min(1, _baseBushColor.g + gVariation)
      );
      _baseBushColor.b = Math.max(
        0,
        Math.min(1, _baseBushColor.b + bVariation)
      );

      // Bushes get flattened (breakables.js)
      collector.beginProp(BREAKABLE.SMALL);
      collector.add('bush', _matBuffer, _baseBushColor);
      collector.endProp();
    });
  }

  // A lean-to or trailer whose campfire was cleared away since (off the
  // roads, out of the clearings) goes with it
  {
    const fires = new Set(campfirePositions);
    let n = 0;
    for (const p of landmarkPositions) {
      const keep = !p.fire || fires.has(p.fire);
      delete p.fire;
      if (keep) landmarkPositions[n++] = p;
    }
    landmarkPositions.length = n;
  }
  // Landmarks: towers stand on their own and topple whole; the rest are
  // houses, walls and roof
  for (const pos of landmarkPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      1,
      1,
      1,
      0,
      pos.rotY,
      0
    );
    if (LANDMARK_RULES[pos.rule].tower) {
      collector.beginProp(BREAKABLE.TREE);
      collector.add(pos.type, _matBuffer);
    } else {
      collector.beginProp(BREAKABLE.HOUSE);
      collector.add(pos.type + 'Body', _matBuffer);
      collector.add(pos.type + 'Roof', _matBuffer);
    }
    collector.endProp();
  }

  // Ice fishing huts (no rolls here either)
  for (const pos of iceHutPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      1,
      1,
      1,
      0,
      pos.rotY,
      0
    );
    _iceHutColor.setHex(pos.color);
    collector.beginProp(BREAKABLE.HOUSE);
    collector.add('iceHutBody', _matBuffer, _iceHutColor);
    collector.add('iceHutRoof', _matBuffer);
    collector.endProp();
  }

  // Sheep: they bound off out of your way, like the penguins (no rolls)
  for (const pos of sheepPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    _iceHutColor.setHex(pos.color);
    collector.beginProp(BREAKABLE.CRITTER);
    collector.add('sheepWool', _matBuffer, _iceHutColor);
    collector.add('sheepDark', _matBuffer);
    collector.endProp();
  }

  // Goats and deer bound off and get punted like the sheep
  for (const pos of herdPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    _iceHutColor.setHex(pos.color);
    collector.beginProp(BREAKABLE.CRITTER);
    collector.add(pos.kind + 'Coat', _matBuffer, _iceHutColor);
    collector.add(pos.kind + 'Dark', _matBuffer);
    collector.endProp();
  }

  // Breakwater rubble: solid, driven on as ground (breakwater-logic.js,
  // from the pieces listed here); only the beacon at the end is a prop
  // that can be knocked over
  const breakwaters = [];
  for (const pos of breakwaterPositions) {
    breakwaters.push(
      worldOffsetX + pos.x,
      worldOffsetZ + pos.z,
      pos.y,
      pos.rotY,
      pos.sx,
      pos.sz,
      pos.beacon ? 1 : 0
    );
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.sx,
      1,
      pos.sz,
      0,
      pos.rotY,
      0
    );
    // Its surf stays when the rocks are knocked off; it rides the swell,
    // calmed in the shallows (red channel, breakwaterSurfMat)
    _iceHutColor.setHex(0x00ffff).r = pos.calm;
    collector.add(
      pos.beacon ? 'breakwaterSurf' : 'breakwaterFoam',
      _matBuffer,
      _iceHutColor
    );
    if (pos.beacon) {
      // The mound's round end, under the beacon
      collector.add('breakwaterHead', _matBuffer);
      collector.beginProp(BREAKABLE.SMALL);
      _iceHutColor.setHex(pos.color);
      collector.add('breakwaterBeacon', _matBuffer, _iceHutColor);
      collector.add('breakwaterLamp', _matBuffer);
      collector.endProp();
    } else {
      collector.add('breakwaterRock' + pos.variant, _matBuffer);
    }
  }

  // Channel buoys: nothing to break, you pass over them
  for (const pos of buoyPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      1,
      1,
      1,
      0,
      pos.rotY,
      0
    );
    _iceHutColor.setHex(pos.color);
    collector.add('buoy', _matBuffer, _iceHutColor);
    collector.add('buoyTop', _matBuffer);
  }

  // Seals on the floes: they slip into the water as you come, like the
  // penguins
  for (const pos of sealPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    collector.beginProp(BREAKABLE.CRITTER);
    collector.add('seal', _matBuffer);
    collector.endProp();
  }

  // Fallen logs and stumps (no rolls here either)
  for (const pos of fallenLogPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    collector.beginProp(BREAKABLE.SMALL);
    if (pos.stump) {
      collector.add('stump', _matBuffer);
    } else {
      collector.add('fallenLog', _matBuffer);
    }
    collector.endProp();
  }

  // Swamp trees, reeds, cattails, lily pads, logs, and stumps (no rolls here)
  for (const pos of swampTreePositions) {
    // Most of the swamp trees (from every path above) left out for frame
    // rate (SWAMP_TREE_THINNING)
    if (
      pos.type !== 'swampGiantOak' &&
      fieldHash(
        Math.round(worldOffsetX + pos.x),
        Math.round(worldOffsetZ + pos.z),
        661
      ) < SWAMP_TREE_THINNING
    ) {
      continue;
    }
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    // The giant oak stands solid (its trunk is in arches.js), not knocked over
    if (pos.type === 'swampGiantOak') {
      collector.add(pos.type, _matBuffer);
      continue;
    }
    collector.beginProp(BREAKABLE.TREE);
    collector.add(pos.type, _matBuffer);
    collector.endProp();
  }

  for (const pos of swampReedPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    collector.add(pos.type, _matBuffer);
  }

  for (const pos of swampLilyPadPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    collector.add('swampLilyPads', _matBuffer);
  }

  for (const pos of swampLogPositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      pos.size,
      pos.size,
      pos.size,
      0,
      pos.rotY,
      0
    );
    collector.beginProp(BREAKABLE.SMALL);
    collector.add(pos.type, _matBuffer);
    collector.endProp();
  }

  // Hay bales (no rolls here, so the props after them come out as before)
  for (const pos of hayBalePositions) {
    composeMatrix(
      _matBuffer,
      0,
      worldOffsetX + pos.x,
      pos.y,
      worldOffsetZ + pos.z,
      1,
      1,
      1,
      0,
      pos.rotY,
      0
    );
    collector.beginProp(BREAKABLE.SMALL);
    collector.add('hayBale', _matBuffer);
    collector.endProp();
  }

  // Wall and roof colors (indices into houseBodyPalette and
  // houseRoofPalette) from the house's regional style
  const pickHouseColors = (pos) => {
    const body = rng();
    const roof = rng();
    if (pos.style === 'stone') {
      pos.bodyId = 6 + Math.floor(body * 3);
      pos.roofId = 4 + Math.floor(roof * 2);
    } else if (pos.style === 'adobe') {
      pos.bodyId = 9 + Math.floor(body * 3);
      pos.roofId = 6;
    } else {
      pos.bodyId = Math.floor(body * 6);
      pos.roofId = Math.floor(roof * 4);
    }
  };
  // Populate attributes for chunk local props in identical deterministic sequence
  if (housePositions.length > 0) {
    housePositions.forEach(pickHouseColors);
    housePositions.forEach((pos) => {
      pos.poolId = Math.floor(rng() * HOUSE_WINDOW_POOLS);
    });
  }

  if (twoStoryHousePositions.length > 0) {
    twoStoryHousePositions.forEach(pickHouseColors);
    twoStoryHousePositions.forEach((pos) => {
      pos.poolId = Math.floor(rng() * HOUSE_WINDOW_POOLS);
    });
  }
  collectHouses(collector, housePositions, false, worldOffsetX, worldOffsetZ);
  collectTownStreets(
    collector,
    townStreets,
    worldOffsetX,
    worldOffsetZ,
    meshHeightAtLocal,
    WATER_LEVEL
  );
  collectHouses(
    collector,
    twoStoryHousePositions,
    true,
    worldOffsetX,
    worldOffsetZ
  );

  if (strawHutPositions.length > 0) {
    strawHutPositions.forEach((pos) => {
      pos.scale = 0.9 + rng() * 0.3;
    });
  }

  if (monasteryPositions.length > 0) {
    monasteryPositions.forEach((pos) => {
      pos.scale = 0.9 + rng() * 0.2;
    });
  }

  if (castleRuinsPositions.length > 0) {
    castleRuinsPositions.forEach((pos) => {
      pos.scale = 0.9 + rng() * 0.3;
    });
  }

  if (windmillPositions.length > 0) {
    windmillPositions.forEach((pos) => {
      pos.scale = 0.8 + rng() * 0.4;
    });
  }
  collectStructures(
    collector,
    {
      strawHutPositions,
      barnPositions,
      monasteryPositions,
      castleRuinsPositions,
      windmillPositions,
    },
    worldOffsetX,
    worldOffsetZ
  );

  if (sailboatPositions.length > 0) {
    sailboatPositions.forEach((pos) => {
      pos.bodyId = Math.floor(rng() * 3);
    });
  }

  const birds = [];
  const isAlienChunk =
    ChillFlightLogic.alienAt(worldOffsetX, worldOffsetZ, simplex) >
    ALIEN_PROPS_AT;
  // Gulls over the coasts (any but the frozen far north), now and then out
  // at sea, and a few always round a lighthouse; hawks over the land only
  let wetPoints = 0;
  for (let k = 0; k < heightGrid.length; k++) {
    if (heightGrid[k] < WATER_LEVEL) wetPoints++;
  }
  const waterShare = wetPoints / heightGrid.length;
  const gullChance =
    worldOffsetZ < GULL_MAX_NORTH
      ? 0
      : waterShare >= 0.92
        ? GULL_SEA_CHANCE
        : waterShare > 0.08
          ? GULL_COAST_CHANCE
          : 0;
  const pushGulls = (cx, cz, cy, n, radius) => {
    for (let i = 0; i < n; i++) {
      birds.push({
        type: 'seagull',
        scale: 2.5 + rng() * 1.0,
        x: cx,
        y: cy,
        z: cz,
        circleSpeed: 0.4 + rng() * 0.2,
        circleRadius: radius + rng() * radius * 0.8,
        circleCenter: {x: cx, y: cy + (rng() - 0.5) * 40, z: cz},
        angle: rng() * Math.PI * 2,
        flapPhase: rng() * Math.PI * 2,
        flapSpeed: 10.0 + rng() * 5.0,
        flapDuration: 2.0 + rng() * 2.0,
        soarDuration: 3.0 + rng() * 3.0,
        diveTimer: rng() * 10,
        nextDiveWait: 10.0 + rng() * 20.0,
      });
    }
  };
  if (!isAlienChunk) {
    const roll = rng();
    if (roll < gullChance) {
      const cx = worldOffsetX + (rng() - 0.5) * chunkSize;
      const cz = worldOffsetZ + (rng() - 0.5) * chunkSize;
      const cy =
        Math.max(WATER_LEVEL, getElevation(cx, cz, elevParams)) +
        40 +
        rng() * 60;
      pushGulls(cx, cz, cy, 2 + Math.floor(rng() * 4), 50);
    } else if (waterShare < 0.5 && rng() < HAWK_CHANCE) {
      const baseX = worldOffsetX + (rng() - 0.5) * chunkSize;
      const baseZ = worldOffsetZ + (rng() - 0.5) * chunkSize;
      const baseY = Math.min(
        400,
        getElevation(baseX, baseZ, elevParams) + 150 + rng() * 200
      );
      birds.push({
        type: 'hawk',
        scale: 4.0,
        x: baseX,
        y: baseY,
        z: baseZ,
        rotY: rng() * Math.PI * 2,
        circleSpeed: 0.3 + rng() * 0.2,
        circleRadius: 150 + rng() * 100,
        circleCenter: {x: baseX, y: baseY, z: baseZ},
        angle: rng() * Math.PI * 2,
        flapPhase: rng() * Math.PI * 2,
        flapSpeed: 8.0 + rng() * 4.0,
        flapDuration: 3.0 + rng() * 3.0,
        soarDuration: 4.0 + rng() * 4.0,
      });
    }
  }
  // A few gulls wheeling round each lighthouse's lantern (Montauk's too)
  if (lighthousePos) {
    pushGulls(
      worldOffsetX + lighthousePos.x,
      worldOffsetZ + lighthousePos.z,
      lighthousePos.y + 150,
      3 + Math.floor(rng() * 2),
      45
    );
  }

  if (!isAlienChunk && rng() < 0.04) {
    const flockSize = 7 + Math.floor(rng() * 6);
    const baseX = worldOffsetX + (rng() - 0.5) * chunkSize;
    const baseZ = worldOffsetZ + (rng() - 0.5) * chunkSize;
    let baseY = getElevation(baseX, baseZ, elevParams) + 400 + rng() * 600;
    if (baseY > 1200) baseY = 1200;

    const baseRotationY = rng() * Math.PI * 2;
    const speed = 1.1 + rng() * 0.2;

    for (let i = 0; i < flockSize; i++) {
      let offsetX = 0;
      let offsetZ = 0;
      if (i > 0) {
        const row = Math.floor((i + 1) / 2);
        const side = i % 2 === 0 ? 1 : -1;
        offsetX = side * row * 35;
        offsetZ = row * 35;
      }

      const localPos = rotateY(offsetX, offsetZ, baseRotationY);

      birds.push({
        type: 'goose',
        x: baseX + localPos.x,
        y: baseY,
        z: baseZ + localPos.z,
        rotY: baseRotationY,
        speed,
        flapPhase: rng() * Math.PI * 2,
        flapSpeed: 8.0 + rng() * 2.0,
        flapDuration: 1000.0,
        soarDuration: 0.0,
      });
    }
  }

  const instanceData = collector.finish();
  for (const type in instanceData) {
    const d = instanceData[type];
    transferables.push(d.matrices.buffer);
    transferables.push(d.colors.buffer);
  }
  const breakables = collector.breakables();
  transferables.push(
    breakables.kinds.buffer,
    breakables.propStarts.buffer,
    breakables.partTypes.buffer,
    breakables.partIndices.buffer
  );

  const waterfall =
    _enableObjects && hasWater && waterfallChunk(chunkX, chunkZ, chunkSize)
      ? findWaterfall(
          heightGrid,
          gridX1,
          step,
          halfSize,
          elevParams.WATER_LEVEL,
          fallsCells(chunkX, chunkZ, chunkSize, step)
        )
      : null;

  // Boats sail near land, and not off the western alien land's coasts
  // (left out here, after every roll, so the rest of the chunk stays as it
  // was)
  const boatHere = (p) =>
    (worldOffsetX > 0 ||
      ChillFlightLogic.alienAt(
        worldOffsetX + p.x,
        worldOffsetZ + p.z,
        simplex
      ) <= ALIEN_PROPS_AT) &&
    landNear(worldOffsetX + p.x, worldOffsetZ + p.z, elevParams);
  const chunkProps = {
    waterfall,
    housePositions,
    twoStoryHousePositions,
    strawHutPositions,
    barnPositions,
    monasteryPositions,
    castleRuinsPositions,
    windmillPositions,
    sailboatPositions: sailboatPositions.filter(boatHere),
    pirateShipPositions: pirateShipPositions.filter(boatHere),
    rockArchPositions,
    rockArchGrassPositions,
    pierPositions,
    campfirePositions,
    chimneySmokePositions,
    lighthousePos,
    birds,
    counts: {
      trees_pine: treePositions.length + snowTreePositions.length,
      trees_decid:
        deciduousTreePositions.length +
        tallDeciduousTreePositions.length +
        birchTreePositions.length +
        broadleafOakTreePositions.length +
        oakTreePositions.length,
      trees_deciduous:
        deciduousTreePositions.length +
        tallDeciduousTreePositions.length +
        birchTreePositions.length +
        broadleafOakTreePositions.length +
        oakTreePositions.length,
      trees_palm: palmTreePositions.length,
      trees_dead: deadTreePositions.length,
      trees_joshua: joshuaTreePositions.length,
      trees_autumn:
        autumnTree1Positions.length +
        autumnTree2Positions.length +
        autumnTree3Positions.length,
      trees_cherry: cherryTreePositions.length,
      trees_yellow_cortez: yellowCortezTreePositions.length,
      trees_mushroom: mushroomTreePositions.length,
      crystals: crystalPositions.length,
      trees_japanese_maple: japaneseMapleTreePositions.length,
      trees_sculpted_pine: sculptedPineTreePositions.length,
      trees_birch: birchTreePositions.length,
      trees_oak: broadleafOakTreePositions.length + oakTreePositions.length,
      trees_magnolia: magnoliaTreePositions.length,
      trees_fruit:
        appleTreePositions.length +
        orchardAppleTreePositions.length +
        plumTreePositions.length +
        fruitTreePositions.length,
      trees_snow_spruce: snowTreePositions.filter(
        (p) => p.trunkKey === 'snowSpruceTrunk'
      ).length,
      trees_mountain_rowan: snowTreePositions.filter(
        (p) => p.trunkKey === 'mountainRowanTrunk'
      ).length,
      rocks:
        rockPositions.length +
        snowRockPositions.length +
        desertRockPositions.length,
      bushes: bushPositions.length,
      snowmen: snowmanPositions.length,
      cactus: cactusPositions.length,
      lily_pads: lilyPadPositions.length,
      small_boats: smallBoatPositions.length,
      herd: herdPositions.length,
      breakwater: breakwaterPositions.length,
      tractors: tractorPositions.length,
      landmarks: landmarkPositions.length,
      icebergs: icebergPositions.length,
      ice_floes: iceFloePositions.length,
      penguins: penguinPositions.length,
    },
  };

  return {
    result: {
      maxChunkHeight,
      hasWater,
      buffers: {
        terrainPositions: positions,
        heightGrid: heightGrid,
        terrainColors: terrainColors,
        morphHeights,
        waterPositions,
        waterColors,
        waterFlow,
        softWaterDepth,
        reefGrid,
      },
      instanceData,
      breakables,
      breakwaters,
      chunkProps,
    },
    transferables,
  };
}
