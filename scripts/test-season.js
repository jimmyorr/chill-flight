#!/usr/bin/env node
/**
 * scripts/test-season.js
 *
 * Checks the Christmas season (seasonOf and resolveSeason in
 * chill-flight-logic.js; specs/christmas-village.md): read from the world
 * seed's date, Nov 1 to Jan 6, 'setup' in November and 'full' from December
 * to Twelfth Night, overridable with ?xmas= and ?xmasDay=, and off in Node
 * unless asked for, so tests pinned to 20260101 keep their world. Also that
 * generateChunkData hands a chunk job's season to a worker's logic module.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {
  xmasLitHouses,
  xmasVillagePlacements,
  xmasToWorld,
} from '../xmas-village-logic.js';
import {generateChunkData} from '../terrain-gen.js';

console.log('Testing the Christmas season...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const {seasonOf, resolveSeason} = ChillFlightLogic;
const same = (a, b) => a.xmas === b.xmas && a.day === b.day;
const show = (s) => JSON.stringify(s);

// 1. From the date
const dates = [
  [20261031, null, 0],
  [20261101, 'setup', 1],
  [20261130, 'setup', 30],
  [20261201, 'full', 1],
  [20261224, 'full', 24],
  [20261231, 'full', 31],
  [20270101, 'full', 31],
  [20270106, 'full', 31],
  [20270107, null, 0],
  [20260701, null, 0],
];
for (const [seed, xmas, day] of dates) {
  const s = seasonOf(seed);
  check(
    `${seed} is ${xmas || 'off'}${xmas ? ` (day ${day})` : ''}`,
    same(s, {xmas, day}),
    show(s)
  );
}

// 2. Seeds that aren't dates have no season
for (const seed of [1, 42, 12345, 20261300, 20261200, 20261232, -20261215]) {
  check(`seed ${seed} has no season`, seasonOf(seed).xmas === null);
}

// 3. Off in Node unless asked for: this process never read a URL
check(
  'the season is off in Node by default',
  ChillFlightLogic.XMAS === null && ChillFlightLogic.XMAS_DAY === 0,
  `${ChillFlightLogic.XMAS} ${ChillFlightLogic.XMAS_DAY}`
);
check(
  'without byDate, the date alone turns nothing on',
  resolveSeason(20261215, null, null, false).xmas === null
);
check(
  'with byDate (the browser), the date turns it on',
  same(resolveSeason(20261215, null, null, true), {xmas: 'full', day: 15})
);

// 4. ?xmas= and ?xmasDay= overrides
const overrides = [
  // seed, xmas, xmasDay, byDate, expected
  [20261215, 'off', null, true, {xmas: null, day: 0}],
  [20261215, '0', null, true, {xmas: null, day: 0}],
  [20260701, 'full', null, true, {xmas: 'full', day: 1}],
  [20260701, 'setup', null, false, {xmas: 'setup', day: 1}],
  [20261215, 'full', null, true, {xmas: 'full', day: 15}],
  [20261215, 'setup', null, true, {xmas: 'setup', day: 1}],
  [20261215, 'on', null, true, {xmas: 'full', day: 15}],
  [20260701, 'on', null, true, {xmas: 'full', day: 1}],
  [20260701, 'FULL ', null, true, {xmas: 'full', day: 1}],
  [20260701, 'full', '20', true, {xmas: 'full', day: 20}],
  [20261215, null, '3', true, {xmas: 'full', day: 3}],
  [20261215, null, '40', true, {xmas: 'full', day: 15}],
  [20260701, null, '3', true, {xmas: null, day: 0}],
  [20261215, '', null, true, {xmas: 'full', day: 15}],
];
for (const [seed, xmas, day, byDate, want] of overrides) {
  const got = resolveSeason(seed, xmas, day, byDate);
  check(
    `seed ${seed}, xmas=${xmas}, xmasDay=${day}${byDate ? '' : ' (Node)'} gives ${show(want)}`,
    same(got, want),
    show(got)
  );
}

// 5. A chunk job carries the main thread's season into a worker's module
// (terrain-gen.js generateChunkData), and an off season clears it again.
// Objects off: only the season handoff matters here.
const job = (xmas, xmasDay) =>
  generateChunkData({
    chunkX: 0,
    chunkZ: 0,
    chunkSize: 1500,
    segments: 4,
    elevParams: {
      WATER_LEVEL: 40,
      MOUNTAIN_LEVEL: 180,
      MAP_WORLD_SIZE: 10000,
      MAP_HEIGHT_SCALE: 400,
    },
    worldSeed: 20260101,
    xmas,
    xmasDay,
    enableObjects: false,
  });
job('full', 12);
check(
  'a chunk job turns the season on in its module',
  ChillFlightLogic.XMAS === 'full' && ChillFlightLogic.XMAS_DAY === 12
);
job(null, 0);
check(
  'a chunk job with the season off turns it off',
  ChillFlightLogic.XMAS === null && ChillFlightLogic.XMAS_DAY === 0
);

// 6. Advent ramp and village layout (xmas-village-logic.js)
check(
  'November lights 2 houses',
  xmasLitHouses('setup', 15) === 2,
  String(xmasLitHouses('setup', 15))
);
const litCounts = [1, 4, 8, 12, 16, 20].map((d) => xmasLitHouses('full', d));
check(
  'December lights 3, 3, 4, 5, 6, 6 houses through Dec 20',
  JSON.stringify(litCounts) === JSON.stringify([3, 3, 4, 5, 6, 6]),
  JSON.stringify(litCounts)
);
const setupTypes = new Set(
  xmasVillagePlacements('setup', 1).map((p) => p.type)
);
const fullTypes = new Set(xmasVillagePlacements('full', 20).map((p) => p.type));
check(
  'November has the bare fir, tree lot and cocoa stand, and no sleigh, presents or Santa',
  setupTypes.has('xmasFirBare') &&
    setupTypes.has('xmasTreeRackBody') &&
    setupTypes.has('xmasCocoaStand') &&
    !setupTypes.has('xmasFir') &&
    !setupTypes.has('xmasSleighBody') &&
    !setupTypes.has('xmasSanta') &&
    !setupTypes.has('xmasPresentsBody'),
  [...setupTypes].join(',')
);
check(
  'December has the lit fir, sleigh, Santa, reindeer, presents, snow fort and gingerbread house',
  fullTypes.has('xmasFir') &&
    fullTypes.has('xmasSleighBody') &&
    fullTypes.has('xmasSanta') &&
    fullTypes.has('xmasReindeer') &&
    fullTypes.has('xmasPresentsBody') &&
    fullTypes.has('xmasSnowFortBody') &&
    fullTypes.has('xmasGingerbread') &&
    !fullTypes.has('xmasFirBare'),
  [...fullTypes].join(',')
);

// 7. Site finder and chunk generation beside Pinewood Field
const elevParams = {
  WATER_LEVEL: 40,
  MOUNTAIN_LEVEL: 180,
  MAP_WORLD_SIZE: 10000,
  MAP_HEIGHT_SCALE: 400,
};
for (const seed of [20261113, 20261215, 20261224]) {
  ChillFlightLogic.WORLD_SEED = seed;
  simplex.seed(seed);
  ChillFlightLogic.XMAS = 'full';
  ChillFlightLogic.XMAS_DAY = 20;
  const site = ChillFlightLogic.xmasVillageSite(simplex, elevParams);
  check(
    `seed ${seed} finds a dry village site near Pinewood Field`,
    site !== null &&
      Math.hypot(site.x - -4000, site.z - -17200) < 1600 &&
      site.base > elevParams.WATER_LEVEL + 5,
    JSON.stringify(site)
  );
  const w = xmasToWorld(site, {x: 0, z: 30, rotY: 0});
  check(
    `seed ${seed} flattens the village bed at the square`,
    Math.abs(
      ChillFlightLogic.getElevation(w.x, w.z, simplex, elevParams) - site.base
    ) < 0.01
  );
}

// 8. Chunk generation over the village on seed 20261113
ChillFlightLogic.WORLD_SEED = 20261113;
simplex.seed(20261113);
ChillFlightLogic.XMAS = 'full';
const site = ChillFlightLogic.xmasVillageSite(simplex, elevParams);
const vcx = Math.round(site.x / 1500);
const vcz = Math.round(site.z / 1500);
const fullChunk = generateChunkData({
  chunkX: vcx,
  chunkZ: vcz,
  chunkSize: 1500,
  segments: 8,
  elevParams,
  worldSeed: 20261113,
  xmas: 'full',
  xmasDay: 20,
  enableObjects: true,
}).result;
check(
  'village chunk in December emits the fir, gingerbread house, Santa, houses and lamp posts, plus northern village yard firs and roofline lights',
  fullChunk.instanceData.xmasFir?.count === 1 &&
    fullChunk.instanceData.xmasGingerbreadBody?.count === 1 &&
    fullChunk.instanceData.xmasSanta?.count === 1 &&
    fullChunk.instanceData.farmhouse0Body?.count === 2 &&
    fullChunk.instanceData.xmasLampPost?.count >= 10 &&
    fullChunk.instanceData.xmasYardFir?.count >= 1 &&
    (fullChunk.instanceData.xmasRoofLights?.count >= 1 ||
      fullChunk.instanceData.xmasRoofLightsWarm?.count >= 1),
  Object.keys(fullChunk.instanceData)
    .filter((k) => /^xmas|^farmhouse/.test(k))
    .join(',')
);
const setupChunk = generateChunkData({
  chunkX: vcx,
  chunkZ: vcz,
  chunkSize: 1500,
  segments: 8,
  elevParams,
  worldSeed: 20261113,
  xmas: 'setup',
  xmasDay: 13,
  enableObjects: true,
}).result;
check(
  'in November (setup), northern houses have no yard firs and the village has no Santa',
  !setupChunk.instanceData.xmasYardFir &&
    !setupChunk.instanceData.xmasSanta &&
    setupChunk.instanceData.xmasFirBare?.count === 1,
  Object.keys(setupChunk.instanceData)
    .filter((k) => k.startsWith('xmas'))
    .join(',')
);
const offChunk = generateChunkData({
  chunkX: vcx,
  chunkZ: vcz,
  chunkSize: 1500,
  segments: 8,
  elevParams,
  worldSeed: 20261113,
  xmas: null,
  xmasDay: 0,
  enableObjects: true,
}).result;
check(
  'with the season off, the same chunk emits no xmas props',
  !Object.keys(offChunk.instanceData).some((k) => k.startsWith('xmas'))
);

if (failed) {
  console.error('Season tests failed.');
  process.exit(1);
}
console.log('All season tests passed.');
