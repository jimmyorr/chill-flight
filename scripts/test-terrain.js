#!/usr/bin/env node
/**
 * scripts/test-terrain.js
 *
 * Automated regression test suite for procedural terrain generation.
 * Enforces critical world continuity invariants:
 *  1. No intermediate early returns in getElevation() procedural pipeline
 *  2. Continuous frozen north pack ice shelf past the north coast (no vertical open-water tears)
 *  3. Continuous eastern alien biome (no periodic road-trench slices)
 *  4. Strict west-only boundaries for highway canyon carving (X < 0)
 *  5. Flat, dry airfields on any seed
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {
  CROP_KIND,
  LIGHTHOUSE_PALETTES,
  fieldAt,
  generateChunkData,
  getFamineWallRoutes,
  lighthouseChunkWins,
  sampleFarmlandCrop,
  stoneWallZoneAt,
} from '../terrain-gen.js';
import {buildStoneWallGeos} from '../farm-models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The world seed defaults to today's date, which picks the noise and the
// continent's outline. Pin both so results don't vary by day; the regressions
// checked here (tears, trenches) show up with any seed.
function useSeed(seed) {
  ChillFlightLogic.WORLD_SEED = seed;
  simplex.seed(seed);
}
useSeed(20260101);

console.log('Testing procedural terrain invariants...');

// --- 1. STATIC CODE ANALYSIS: NO INTERMEDIATE EARLY RETURNS ---
const logicSrc = fs.readFileSync(
  path.join(__dirname, '..', 'chill-flight-logic.js'),
  'utf8'
);

const getElevationStart = logicSrc.indexOf('function getElevation(');
if (getElevationStart === -1) {
  console.error(
    'FAIL: Could not find function getElevation() in chill-flight-logic.js'
  );
  process.exit(1);
}

// Find the start of the procedural generation pipeline
const proceduralStart = logicSrc.indexOf(
  'const biome = getBiome(',
  getElevationStart
);
if (proceduralStart === -1) {
  console.error(
    'FAIL: Could not find start of procedural pipeline in getElevation()'
  );
  process.exit(1);
}

// Find the end of getElevation (where the exports begin)
const exportsStart = logicSrc.indexOf('// --- EXPORTS ---', proceduralStart);
if (exportsStart === -1) {
  console.error('FAIL: Could not find end of getElevation()');
  process.exit(1);
}

const proceduralBody = logicSrc.slice(proceduralStart, exportsStart);

// Strip comments so mentions of "return" in comments do not trigger false positives
const codeWithoutComments = proceduralBody
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

const returnMatches = [...codeWithoutComments.matchAll(/\breturn\b([^;]+);/g)];

// In the procedural pipeline, the ONLY allowed return statement is the final `return n;`
if (returnMatches.length !== 1 || returnMatches[0][1].trim() !== 'n') {
  console.error(
    `FAIL: Found ${returnMatches.length} return statement(s) in the procedural pipeline of getElevation().`
  );
  console.error('CRITICAL: Only the final `return n;` is permitted.');
  returnMatches.forEach((m, idx) => {
    console.error(`  [${idx + 1}] return${m[1]};`);
  });
  process.exit(1);
}
console.log(
  '  Passed: No intermediate early returns found in getElevation() pipeline'
);

const constants = {
  WATER_LEVEL: 40,
  MAP_WORLD_SIZE: 10000,
  MAP_HEIGHT_SCALE: 400,
};

// --- 2. INVARIANT TEST: FROZEN NORTH CONTINUITY ---
// Past the continent's north coast, the open water along it (up to about 2
// degrees) and the floes beyond (2.5 more), the sea should be frozen pack ice
// shelf (elev >= 42). No point should drop into underwater ocean (elev <= 40).
// The leaning outline's cape pushes the coast far enough north that leads open
// up to about 15.5N, so check further out, on every outline (each seed picks
// one).
const testLats = [-85000, -90000]; // 17.0N, 18.0N
for (const name of ChillFlightLogic.CONTINENT_NAMES) {
  ChillFlightLogic.CONTINENT = name;
  for (const testZ of testLats) {
    for (let testX = 5000; testX <= 45000; testX += 1000) {
      const elev = ChillFlightLogic.getElevation(
        testX,
        testZ,
        simplex,
        constants
      );
      if (elev < constants.WATER_LEVEL + 1.5) {
        console.error(
          `FAIL: Frozen North has open-water tear on the ${name} outline at X=${testX}, Z=${testZ} (elev=${elev.toFixed(
            1
          )} < ${constants.WATER_LEVEL + 1.5})`
        );
        process.exit(1);
      }
    }
  }
}
ChillFlightLogic.CONTINENT = null;
console.log(
  '  Passed: Frozen north pack ice shelf is continuous across all longitudes'
);

// --- 2b. INVARIANT TEST: EVERY CONTINENT ENDS IN SEA ---
// For each outline the seed can pick: well past the south coast (at most
// about 14S, on Boot's toe), the west coast (at most about 20W) and the
// eastern land's east coast (at most about 20E), there's only sea, and the
// landmarks and airports stay on land.
const pastCoasts = [];
for (let x = -100000; x <= 100000; x += 5000) pastCoasts.push([x, 80000]); // 16S
for (let z = -15000; z <= 60000; z += 5000) {
  pastCoasts.push([-110000, z]); // 22W
  pastCoasts.push([115000, z]); // 23E
}
const onLand = [
  ['the falls', ChillFlightLogic.FALLS_X, ChillFlightLogic.FALLS_Z],
  ['the volcano', -5000, 5000],
  ...ChillFlightLogic.AIRPORTS.map((a) => [a.name, a.x, a.z]),
];
for (const name of ChillFlightLogic.CONTINENT_NAMES) {
  ChillFlightLogic.CONTINENT = name;
  for (const [testX, testZ] of pastCoasts) {
    const elev = ChillFlightLogic.getElevation(
      testX,
      testZ,
      simplex,
      constants
    );
    if (elev > constants.WATER_LEVEL) {
      console.error(
        `FAIL: ${name}: land past the continent's coast at X=${testX}, Z=${testZ} (elev=${elev.toFixed(1)})`
      );
      process.exit(1);
    }
  }
  for (const [what, testX, testZ] of onLand) {
    const elev = ChillFlightLogic.getElevation(
      testX,
      testZ,
      simplex,
      constants
    );
    if (elev <= constants.WATER_LEVEL) {
      console.error(
        `FAIL: ${name}: ${what} is under water at X=${testX}, Z=${testZ} (elev=${elev.toFixed(1)})`
      );
      process.exit(1);
    }
  }
}
ChillFlightLogic.CONTINENT = null;

// --- 2c. THE CANYON ---
// In every outline its rim stands well above the sea and its river, at the
// bottom, is water, so the gorge is really cut.
for (const name of ChillFlightLogic.CONTINENT_NAMES) {
  ChillFlightLogic.CONTINENT = name;
  for (const [lon, lat] of ChillFlightLogic.CANYON_PATH.slice(1, 4)) {
    const x = lon * 5000;
    const z = -lat * 5000;
    let rim = -Infinity;
    let floor = Infinity;
    for (let dx = -3500; dx <= 3500; dx += 50) {
      const h = ChillFlightLogic.getElevation(x + dx, z, simplex, constants);
      rim = Math.max(rim, h);
      floor = Math.min(floor, h);
    }
    if (rim < 250 || floor > constants.WATER_LEVEL) {
      console.error(
        `FAIL: ${name}: the canyon at ${lon}E ${-lat}S has rim ${rim.toFixed(0)}, floor ${floor.toFixed(0)}`
      );
      process.exit(1);
    }
  }
}
ChillFlightLogic.CONTINENT = null;
console.log(
  '  Passed: The canyon is cut, with a river at the bottom, in every continent'
);
console.log(
  `  Passed: Every continent (${ChillFlightLogic.CONTINENT_NAMES.join(', ')}) ends in sea, with the landmarks on land`
);

// --- 3. INVARIANT TEST: EASTERN ALIEN BIOME CONTINUITY ---
// Beyond 10.0E (X >= 55000), the eastern alien biome should have terrain.
// Verify no periodic flat sea-level tears at 10,000-unit road multiples (55000, 65000, 75000).
for (const testX of [55000, 65000, 75000]) {
  let hasElevatedTerrain = false;
  for (let testZ = -10000; testZ <= 10000; testZ += 1000) {
    const elev = ChillFlightLogic.getElevation(
      testX,
      testZ,
      simplex,
      constants
    );
    if (elev > constants.WATER_LEVEL + 50) {
      hasElevatedTerrain = true;
      break;
    }
  }
  if (!hasElevatedTerrain) {
    console.error(
      `FAIL: Eastern Alien Biome at X=${testX} appears flattened/sliced`
    );
    process.exit(1);
  }
}
console.log(
  '  Passed: Eastern alien biome terrain is continuous without periodic slices'
);

// --- 4. INVARIANT TEST: HIGHWAY GEOGRAPHIC BOUNDS ---
// Highways only exist at X < 0, but for the east coast highway. For X >= 0
// away from that one, ignoreRoads: true vs false MUST be identical.
for (let testX = 0; testX <= 30000; testX += 5000) {
  for (let testZ = -20000; testZ <= 20000; testZ += 5000) {
    if (ChillFlightLogic.eastRoadNear(testX, testZ, 6000)) continue;
    const elevWithRoads = ChillFlightLogic.getElevation(
      testX,
      testZ,
      simplex,
      constants,
      null,
      {ignoreRoads: false}
    );
    const elevNoRoads = ChillFlightLogic.getElevation(
      testX,
      testZ,
      simplex,
      constants,
      null,
      {ignoreRoads: true}
    );
    if (Math.abs(elevWithRoads - elevNoRoads) > 1e-4) {
      console.error(
        `FAIL: Highway canyon logic affected eastern coordinates at X=${testX}, Z=${testZ}`
      );
      process.exit(1);
    }
  }
}
console.log(
  '  Passed: Highway carving confined to the west and the east coast highway'
);

// --- 5. MONTAUK LIGHTHOUSE ISLAND ---
// The island (world 7500, 3000) is part of the shared getElevation(), so the
// rendered terrain, physics and minimap all agree it rises above the water.
{
  const center = ChillFlightLogic.getElevation(7500, 3000, simplex, constants);
  if (center <= constants.WATER_LEVEL + 5) {
    console.error(
      `FAIL: Montauk island is missing (height ${center.toFixed(1)} at X=7500, Z=3000)`
    );
    process.exit(1);
  }
}
console.log('  Passed: Montauk lighthouse island rises above the water');

// --- 6. PROPS FOLLOW THE WORLD SEED ---
// Terrain workers can't see the page URL, so they set ChillFlightLogic.WORLD_SEED
// to the seed they're given; per-chunk prop placement must use that value.
{
  const originalSeed = ChillFlightLogic.WORLD_SEED;
  ChillFlightLogic.WORLD_SEED = 111;
  const a = ChillFlightLogic.chunkRng(3, 4)();
  ChillFlightLogic.WORLD_SEED = 222;
  const b = ChillFlightLogic.chunkRng(3, 4)();
  ChillFlightLogic.WORLD_SEED = 111;
  const c = ChillFlightLogic.chunkRng(3, 4)();
  ChillFlightLogic.WORLD_SEED = originalSeed;
  if (a === b || a !== c) {
    console.error('FAIL: chunkRng does not follow ChillFlightLogic.WORLD_SEED');
    process.exit(1);
  }
}
console.log('  Passed: Chunk prop placement follows the world seed');

// --- 7. SNOW COVER RISES GRADUALLY TO THE NORTH ---
// No snow at the first mountain range (1 degree North), full snow by 2.5
// North, and never a jump in between (a hard edge reads as a white wall).
{
  const f = (lat) => ChillFlightLogic.snowFactorAt(-lat * 5000, 0);
  let maxStep = 0;
  for (let lat = 0; lat < 3; lat += 0.01) {
    maxStep = Math.max(maxStep, f(lat + 0.01) - f(lat));
  }
  if (f(1.0) !== 0 || f(2.6) !== 1 || maxStep > 0.02) {
    console.error(
      `FAIL: snow cover ramp (1N ${f(1.0)}, 2.6N ${f(2.6)}, max step ${maxStep.toFixed(3)})`
    );
    process.exit(1);
  }
}
console.log('  Passed: Snow cover rises gradually to the north');

// --- 8. FIRST MOUNTAIN RANGES ARE ALWAYS THERE (#76) ---
// Whatever the seed, a range rises around 1 North (Z = -5000) and 1 South
// (Z = 5000), west of 1.5 West (X = -7500) where ranges are at full height.
{
  const peak = (zCenter) => {
    let max = -Infinity;
    for (let x = -12000; x <= -8000; x += 500) {
      for (let z = zCenter - 3000; z <= zCenter + 3000; z += 100) {
        max = Math.max(
          max,
          ChillFlightLogic.getElevation(x, z, simplex, constants)
        );
      }
    }
    return max;
  };
  for (const seed of [1, 42, 20260101, 20260928, 99999]) {
    useSeed(seed);
    const north = peak(-5000);
    const south = peak(5000);
    if (north < 800 || south < 800) {
      console.error(
        `FAIL: seed ${seed} has no early mountain range (peaks: 1N ${north.toFixed(0)}, 1S ${south.toFixed(0)})`
      );
      process.exit(1);
    }
  }
  useSeed(20260101);
}
console.log('  Passed: The first mountain ranges north and south always rise');

// --- AIRPORTS: FLAT RUNWAYS ON ANY SEED ---
// The ground under each runway is flat at the field height, above the water,
// whatever the land around it is like.
{
  const water = constants.WATER_LEVEL;
  for (const seed of [1, 42, 20260101, 20260928, 99999]) {
    useSeed(seed);
    for (const a of ChillFlightLogic.AIRPORTS) {
      let min = Infinity;
      let max = -Infinity;
      for (let u = -400; u <= 400; u += 40) {
        for (let v = -60; v <= 110; v += 17) {
          const c = Math.cos(a.angle);
          const sn = Math.sin(a.angle);
          const h = ChillFlightLogic.getElevation(
            a.x + u * c - v * sn,
            a.z + u * sn + v * c,
            simplex,
            constants
          );
          min = Math.min(min, h);
          max = Math.max(max, h);
        }
      }
      if (max - min > 0.5 || min < water + 10) {
        console.error(
          `FAIL: seed ${seed}, ${a.name} isn't flat and dry (ground ${min.toFixed(1)} to ${max.toFixed(1)})`
        );
        process.exit(1);
      }
    }
  }
  useSeed(20260101);
}
console.log('  Passed: Every airport is flat and above the water on any seed');

// --- AIRPORTS: HIGHWAYS PASS BESIDE, ACCESS ROADS REACH THEM (#114) ---
// A highway never crosses an airfield (it used to, and its deck was a bump
// on the runway), and each built access road's deck stays above its ground
// and meets the highway at the highway's own height.
{
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180};
  for (const seed of [20260101, 20261006, 20261022, 7]) {
    useSeed(seed);
    ChillFlightLogic.ACCESS_ROADS.forEach((r, i) => {
      const a = ChillFlightLogic.AIRPORTS[r.index];
      for (let z = a.z - 2000; z <= a.z + 2000; z += 10) {
        const x = ChillFlightLogic.getRoadCenterX(z, r.n);
        if (ChillFlightLogic.isOnAirport(x, z, 380 + 30)) {
          console.error(`FAIL: seed ${seed}, a highway crosses ${a.name}`);
          process.exit(1);
        }
      }
      const ends = ChillFlightLogic.accessRoadEnds(i, simplex, constants);
      if (!ends.built) return;
      for (let x = r.minX; x <= r.maxX; x += 5) {
        const deck = ChillFlightLogic.accessRoadDeck(r, ends, x);
        const ground = ChillFlightLogic.getElevation(
          x,
          r.z,
          simplex,
          constants
        );
        if (deck - ground < 0.3 || deck - ground > 3) {
          console.error(
            `FAIL: seed ${seed}, ${a.name}'s access road is ${(deck - ground).toFixed(2)} above the ground at x = ${x.toFixed(0)}`
          );
          process.exit(1);
        }
      }
      const highway = ChillFlightLogic.highwayY(
        r.x1,
        r.z,
        simplex,
        constants,
        null
      );
      if (Math.abs(highway - ends.highway) > 0.01) {
        console.error(
          `FAIL: seed ${seed}, ${a.name}'s access road meets the highway at ${ends.highway.toFixed(1)}, not ${highway.toFixed(1)}`
        );
        process.exit(1);
      }
    });
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Highways pass beside the airfields, and access roads reach them'
);

// --- HIGHWAYS: NO STRANDED STRETCHES OUT AT SEA ---
// Seed 20261019's highway 0 ran into the sea at 6.3 S, then a piece of it
// floated over open water further south (a 9 km gap is too long to bridge,
// but each end of it was within reach of land) and another sat alone on an
// islet. Both are left out now; the highway still runs on the mainland.
{
  useSeed(20261019);
  const runs = (z) =>
    ChillFlightLogic.highwayRunsAt(0, z, simplex, {
      WATER_LEVEL: 40,
      MOUNTAIN_LEVEL: 180,
    });
  const stranded = [34500, 35500, 36500, 40250].filter(runs);
  if (stranded.length || !runs(25000)) {
    console.error(
      stranded.length
        ? `FAIL: seed 20261019, highway 0 runs out at sea at z = ${stranded.join(', ')}`
        : 'FAIL: seed 20261019, highway 0 no longer runs on the mainland at z = 25000'
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log('  Passed: Highways leave out stretches stranded at sea');

// --- PROPS KEEP OFF THE HIGHWAYS ---
// highwayDistance measures square to the road: compare it with the nearest
// point of the centre lines, sampled finely. Then trees and rocks along
// highway 0 and the cross-country one all stand clear of the paved road.
// (They used to be kept off by distance along x alone, which let them onto
// the road wherever it ran at an angle, near 1.2 N 1.2 W on seed 20261019.)
{
  useSeed(20261019);
  const L = ChillFlightLogic;
  const rng = L.mulberry32(5);
  for (let i = 0; i < 200; i++) {
    const z = (rng() - 0.5) * 40000;
    const n = Math.floor(rng() * 3);
    const x = L.getRoadCenterX(z, n) + (rng() - 0.5) * 200;
    let brute = Infinity;
    for (let zz = z - 300; zz <= z + 300; zz += 0.5) {
      brute = Math.min(brute, Math.hypot(x - L.getRoadCenterX(zz, n), z - zz));
    }
    const coasts = L.COAST_ROADS.map((c) => [c, L.coastRoadSpan(c)]);
    for (let xx = x - 300; xx <= x + 300; xx += 0.5) {
      brute = Math.min(brute, Math.hypot(xx - x, z - L.getRoadCenterZ(xx)));
      for (const [c, span] of coasts) {
        if (!span || xx < span[0] || xx > span[1]) continue;
        brute = Math.min(brute, Math.hypot(xx - x, z - L.roadCenter(c, xx)));
      }
    }
    const d = L.highwayDistance(x, z);
    if (brute < 120 && Math.abs(d - brute) > 3) {
      console.error(
        `FAIL: highwayDistance at X ${x.toFixed(0)}, Z ${z.toFixed(0)} is ${d.toFixed(1)}, the road is ${brute.toFixed(1)} away`
      );
      process.exit(1);
    }
  }
  const chunks = [];
  for (let cz = -6; cz <= 2; cz++) {
    chunks.push([Math.round(L.getRoadCenterX(cz * 1500, 0) / 1500), cz]);
  }
  for (let cx = -8; cx <= -4; cx++) {
    chunks.push([cx, Math.round(L.getRoadCenterZ(cx * 1500) / 1500)]);
  }
  let checked = 0;
  for (const [chunkX, chunkZ] of chunks) {
    const {result} = generateChunkData({
      chunkX,
      chunkZ,
      chunkSize: 1500,
      segments: 40,
      elevParams: {
        WATER_LEVEL: 40,
        MOUNTAIN_LEVEL: 180,
        MAP_WORLD_SIZE: 10000,
        MAP_HEIGHT_SCALE: 400,
      },
      worldSeed: 20261019,
      enableObjects: true,
    });
    for (const type in result.instanceData) {
      if (!/Leaves|rock|Rock|bush|cactus/.test(type)) continue;
      const d = result.instanceData[type];
      for (let i = 0; i < d.count; i++) {
        const x = d.matrices[i * 16 + 12];
        const z = d.matrices[i * 16 + 14];
        if (L.highwayDistance(x, z) < L.ROAD_WIDTH + 5) {
          console.error(
            `FAIL: ${type} on a highway at X ${x.toFixed(0)}, Z ${z.toFixed(0)}`
          );
          process.exit(1);
        }
        checked++;
      }
    }
  }
  if (checked < 1000) {
    console.error(`FAIL: only ${checked} props near the highways to check`);
    process.exit(1);
  }
  useSeed(20260101);
}
console.log('  Passed: Trees and rocks stand clear of the highways');

// --- HIGHWAYS HAVE NO RAMPS STEEPER THAN MAX_GRADE ---
// Every highway, end to end. The western alien land's spires used to rise
// up through the road (seed 20261026, highway 7 near z = 43000), and
// elsewhere the road followed cliffs in the land under it, up to 1.4:1
// (seed 20261026, highway 2 at z = -12750)
{
  const MAX_GRADE = 0.4;
  const C = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180};
  const L = ChillFlightLogic;
  const deck = (n, a) => {
    const {x, z} = L.roadPoint(n, a, L.roadCenter(n, a));
    return Math.max(
      L.highwayY(x, z, simplex, C, null),
      L.getElevation(x, z, simplex, C, null) + 1
    );
  };
  useSeed(20261026);
  for (let n = 0; n <= L.ROAD_EW; n++) {
    const ew = n === L.ROAD_EW;
    const [from, to] = ew ? [L.ROAD_EW_WEST, L.ROAD_EW_END] : [-60000, 60000];
    let prev = null;
    for (let a = from; a <= to; a += 50) {
      if (
        !L.highwayRunsAt(n, a, simplex, C) ||
        (!ew && L.roadCenter(n, a) >= 0)
      ) {
        prev = null;
        continue;
      }
      const y = deck(n, a);
      if (prev !== null && Math.abs(y - prev) / 50 > MAX_GRADE) {
        console.error(
          `FAIL: highway ${n} ramps ${prev.toFixed(0)} to ${y.toFixed(0)} in 50 units at ${a}`
        );
        process.exit(1);
      }
      prev = y;
    }
  }
  useSeed(20260101);
}
console.log('  Passed: Highways have no ramps steeper than 0.4');

// --- SLIP ROADS ROUND THE CROSSINGS ---
// Where the cross-country highway crosses a north-south one, slip roads
// curve round the corners: smooth, gentle, on the ground (not buried in a
// hill or floating over a hollow), and nothing stands on them
{
  const L = ChillFlightLogic;
  const params = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400,
  };
  const fail = (msg) => {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  };
  let total = 0;
  for (const seed of [20261026, 20260101, 20261025, 20261019]) {
    useSeed(seed);
    const slips = L.slipRoads(simplex, params);
    total += slips.length;
    for (const s of slips) {
      const p = s.pts;
      for (let i = 1; i < p.length; i++) {
        const run = Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
        const grade = Math.abs(p[i].y - p[i - 1].y) / run;
        if (grade > 0.3) {
          fail(
            `seed ${seed}, a slip road off highway ${s.n} climbs ${grade.toFixed(2)}`
          );
        }
        if (i < p.length - 1) {
          const h0 = Math.atan2(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
          const h1 = Math.atan2(p[i + 1].x - p[i].x, p[i + 1].z - p[i].z);
          let turn = Math.abs(h1 - h0);
          if (turn > Math.PI) turn = Math.PI * 2 - turn;
          if (turn > 1e-4 && run / turn < L.SLIP.MIN_RADIUS * 0.9) {
            fail(
              `seed ${seed}, a slip road off highway ${s.n} turns ${(run / turn).toFixed(0)} round`
            );
          }
        }
        // The ground just under its deck (which is 1.5 thick)
        const below =
          p[i].y - L.getElevation(p[i].x, p[i].z, simplex, params, null);
        if (below < 0.75 || below > 2) {
          fail(
            `seed ${seed}, a slip road off highway ${s.n} is ${below.toFixed(1)} over the ground at X ${p[i].x.toFixed(0)}, Z ${p[i].z.toFixed(0)}`
          );
        }
      }
    }
  }
  // Most corners of the 32 crossings get one
  if (total < 70) fail(`only ${total} slip roads on four worlds`);

  // Nothing stands on them, round Jimmy's crossing
  const seed = 20261026;
  useSeed(seed);
  const c = L.highwayCrossing(0);
  for (
    let cx = Math.round(c.x / 1500) - 1;
    cx <= Math.round(c.x / 1500) + 1;
    cx++
  ) {
    for (
      let cz = Math.round(c.z / 1500) - 1;
      cz <= Math.round(c.z / 1500) + 1;
      cz++
    ) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize: 1500,
        segments: 40,
        elevParams: params,
        worldSeed: seed,
        enableObjects: true,
      });
      for (const type in result.instanceData) {
        const d = result.instanceData[type];
        for (let i = 0; i < d.count; i++) {
          const x = d.matrices[i * 16 + 12];
          const z = d.matrices[i * 16 + 14];
          if (L.isOnSlipRoad(x, z, 2, simplex, params)) {
            fail(
              `${type} on a slip road at X ${x.toFixed(0)}, Z ${z.toFixed(0)}`
            );
          }
        }
      }
    }
  }
}
console.log(
  '  Passed: Slip roads round the highway crossings are smooth and clear'
);

// --- THE CROSS-COUNTRY HIGHWAY ENDS WHERE MEADOW FIELD'S ROAD STARTS ---
// It used to run on past the junction, a deck over the access road
{
  const runs = (x) =>
    ChillFlightLogic.highwayRunsAt(ChillFlightLogic.ROAD_EW, x, simplex, {
      WATER_LEVEL: 40,
      MOUNTAIN_LEVEL: 180,
    });
  const end = ChillFlightLogic.ROAD_EW_END;
  for (const seed of [20260101, 20261019]) {
    useSeed(seed);
    if (runs(end + 1) || runs(end + 400)) {
      console.error(
        `FAIL: seed ${seed}, the cross-country highway runs past its end at x = ${end}`
      );
      process.exit(1);
    }
  }
  useSeed(20260101);
}
console.log(
  "  Passed: The cross-country highway ends at Meadow Field's access road"
);

// --- NOTHING STANDS ON THE PYRAMIDS ---
// Trees, rocks and cacti used to sprout from their faces
{
  const L = ChillFlightLogic;
  const seed = 20261025;
  useSeed(seed);
  const elevParams = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400,
  };
  const site = L.pyramidSite(simplex, elevParams);
  let checked = 0;
  const cx0 = Math.round(site.x / 1500);
  const cz0 = Math.round(site.z / 1500);
  for (let cx = cx0 - 2; cx <= cx0 + 2; cx++) {
    for (let cz = cz0 - 2; cz <= cz0 + 2; cz++) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize: 1500,
        segments: 40,
        elevParams,
        worldSeed: seed,
        enableObjects: true,
      });
      for (const type in result.instanceData) {
        const d = result.instanceData[type];
        for (let i = 0; i < d.count; i++) {
          const x = d.matrices[i * 16 + 12];
          const z = d.matrices[i * 16 + 14];
          if (L.pyramidFootAt(x, z, simplex, elevParams) < 20) {
            console.error(
              `FAIL: ${type} on a pyramid at X ${x.toFixed(0)}, Z ${z.toFixed(0)}`
            );
            process.exit(1);
          }
          checked++;
        }
      }
    }
  }
  if (checked < 1000) {
    console.error(`FAIL: only ${checked} props near the pyramids to check`);
    process.exit(1);
  }
  const dragon = L.dragonSite(simplex, elevParams);
  const dcx0 = Math.round(dragon.x / 1500);
  const dcz0 = Math.round(dragon.z / 1500);
  for (let cx = dcx0 - 1; cx <= dcx0 + 1; cx++) {
    for (let cz = dcz0 - 1; cz <= dcz0 + 1; cz++) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize: 1500,
        segments: 40,
        elevParams,
        worldSeed: seed,
        enableObjects: true,
      });
      for (const type in result.instanceData) {
        const d = result.instanceData[type];
        for (let i = 0; i < d.count; i++) {
          const x = d.matrices[i * 16 + 12];
          const z = d.matrices[i * 16 + 14];
          if (L.dragonFootAt(x, z, simplex, elevParams) < 20) {
            console.error(
              `FAIL: ${type} on the dragon skeleton at X ${x.toFixed(0)}, Z ${z.toFixed(0)}`
            );
            process.exit(1);
          }
        }
      }
    }
  }
  // Rare dinosaur skulls in the south-west desert (X < -5000, Z > 10000)
  const skullTypes = ['dinoSkull0', 'dinoSkull1', 'dinoSkull2'];
  const skullCounts = {dinoSkull0: 0, dinoSkull1: 0, dinoSkull2: 0};
  let totalSkulls = 0;
  for (let cx = -12; cx <= -5; cx++) {
    for (let cz = 9; cz <= 14; cz++) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize: 1500,
        segments: 40,
        elevParams,
        worldSeed: seed,
        enableObjects: true,
      });
      for (const type of skullTypes) {
        const d = result.instanceData[type];
        if (!d) continue;
        for (let i = 0; i < d.count; i++) {
          const x = d.matrices[i * 16 + 12];
          const y = d.matrices[i * 16 + 13];
          const z = d.matrices[i * 16 + 14];
          if (x >= -5000 || z <= 10000) {
            console.error(
              `FAIL: ${type} outside south-west desert at X=${x.toFixed(0)}, Z=${z.toFixed(0)}`
            );
            process.exit(1);
          }
          if (y <= elevParams.WATER_LEVEL) {
            console.error(
              `FAIL: ${type} underwater at X=${x.toFixed(0)}, Z=${z.toFixed(0)} (y=${y.toFixed(1)})`
            );
            process.exit(1);
          }
          if (L.highwayDistance(x, z) < L.ROAD_WIDTH + 10) {
            console.error(
              `FAIL: ${type} on highway at X=${x.toFixed(0)}, Z=${z.toFixed(0)}`
            );
            process.exit(1);
          }
          skullCounts[type]++;
          totalSkulls++;
        }
      }
    }
  }
  if (
    totalSkulls < 3 ||
    !skullCounts.dinoSkull0 ||
    !skullCounts.dinoSkull1 ||
    !skullCounts.dinoSkull2
  ) {
    console.error(
      `FAIL: expected all three dinosaur skull species in south-west desert, got ${JSON.stringify(skullCounts)}`
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Nothing grows or stands on the pyramids or the dragon skeleton, and dinosaur skulls spawn in the south-west desert'
);

// --- SWAMP BIOME BASIN AND BAYOU PROPS ---
{
  const L = ChillFlightLogic;
  useSeed(20260101);
  const elevParams = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400,
  };
  if (
    L.swampFactorAt(-15000, 8000, simplex) < 0.8 ||
    L.swampFactorAt(-3000, 8200, simplex) < 0.8
  ) {
    console.error('FAIL: swampFactorAt is not active in the A+B swamp basin');
    process.exit(1);
  }
  if (
    L.swampFactorAt(5000, 8000, simplex) > 0 ||
    L.swampFactorAt(-5000, 5000, simplex) > 0 ||
    L.swampFactorAt(0, -10000, simplex) > 0
  ) {
    console.error(
      'FAIL: swampFactorAt leaked onto the East Coast, Volcano, or northern autumn region'
    );
    process.exit(1);
  }
  const {result} = generateChunkData({
    chunkX: -8,
    chunkZ: 5,
    chunkSize: 1500,
    segments: 40,
    elevParams,
    worldSeed: 20260101,
    enableObjects: true,
  });
  const id = result.instanceData;
  const swampTrees =
    (id.swampCypress?.count || 0) +
    (id.swampCypressMoss?.count || 0) +
    (id.swampTupelo?.count || 0);
  const swampReeds =
    (id.swampReeds?.count || 0) + (id.swampCattails?.count || 0);
  if (swampTrees < 20 || swampReeds < 20 || !(id.swampLilyPads?.count > 0)) {
    console.error(
      `FAIL: expected swamp trees, reeds, and lily pads in chunk (-8, 5); got trees=${swampTrees}, reeds=${swampReeds}, lilyPads=${id.swampLilyPads?.count || 0}`
    );
    process.exit(1);
  }
  if ((id.houseBody?.count || 0) > 0 || (id.barnBody?.count || 0) > 0) {
    console.error('FAIL: suburban houses or barns spawned inside deep swamp');
    process.exit(1);
  }
  const giantOakRng = L.mulberry32((20260101 ^ 0x57a490a4) >>> 0);
  const giantOakX = -11200 + giantOakRng() * 2600;
  const giantOakZ = 7800 + giantOakRng() * 1400;
  const {result: oakChunk} = generateChunkData({
    chunkX: Math.round(giantOakX / 1500),
    chunkZ: Math.round(giantOakZ / 1500),
    chunkSize: 1500,
    segments: 40,
    elevParams,
    worldSeed: 20260101,
    enableObjects: true,
  });
  if (oakChunk.instanceData.swampGiantOak?.count !== 1) {
    console.error(
      `FAIL: expected 1 swampGiantOak in target swamp chunk, got ${oakChunk.instanceData.swampGiantOak?.count || 0}`
    );
    process.exit(1);
  }
}
console.log('  Passed: Swamp biome basin and bayou props');

// --- PLATEAU ESCARPMENTS ---
// Cuesta plateaus rise 300 m behind steep escarpments across the mainland,
// easing back down on their dip slopes while staying clear of the Falls view.
{
  const L = ChillFlightLogic;
  if (L.PLATEAU_RISE !== 300) {
    console.error(`FAIL: expected PLATEAU_RISE = 300, got ${L.PLATEAU_RISE}`);
    process.exit(1);
  }
  for (const seed of [20260101, 20261111, 42]) {
    useSeed(seed);
    let steepScarps = 0;
    for (let z = -18000; z <= 22000; z += 500) {
      for (let x = -32000; x <= -3000; x += 500) {
        if (L.getBiome(x, z, simplex) < 0.1) continue;
        const p0 = L.landformAt(x, z, simplex).plateau;
        const px = L.landformAt(x + 350, z, simplex).plateau;
        const pz = L.landformAt(x, z + 350, simplex).plateau;
        if (
          Math.max(Math.abs(p0 - px), Math.abs(p0 - pz)) * L.PLATEAU_RISE >
          180
        ) {
          steepScarps++;
        }
      }
    }
    if (steepScarps < 30) {
      console.error(
        `FAIL: seed ${seed} has too few steep plateau escarpments (${steepScarps})`
      );
      process.exit(1);
    }
    const midCorridor = L.getElevation(0, -2400, simplex, constants);
    if (midCorridor > 260) {
      console.error(
        `FAIL: seed ${seed} blocks spawn-to-Falls sightline at (0, -2400) with elev=${midCorridor.toFixed(1)}`
      );
      process.exit(1);
    }
  }
  useSeed(20260101);
}
console.log(
  '  Passed: 300 m cuesta escarpments recur across the mainland and stay clear of the Falls sightline'
);

// --- FALLS CUESTA HEADLAND ---
// The Falls landmark rises as an asymmetric cuesta headland with a sheer SSE
// bay and plunge tarn, an open northern dip slope without an inland moat, a
// WNW ridge under 200 units across spawn's flight path, and a valid leaping
// waterfall across coarse and fine chunk grids.
{
  const L = ChillFlightLogic;
  const yaw = (15 * Math.PI) / 180;
  for (const seed of [20260101, 20261111, 42]) {
    useSeed(seed);
    const lipH = L.getElevation(L.FALLS_X, L.FALLS_LIP_Z, simplex, constants);
    const plungeH = L.getElevation(
      L.FALLS_X,
      L.FALLS_LIP_Z + 150,
      simplex,
      constants
    );
    if (lipH < 390 || plungeH >= 35) {
      console.error(
        `FAIL: seed ${seed} Falls lip/plunge invalid: lip=${lipH.toFixed(1)}, plunge=${plungeH.toFixed(1)}`
      );
      process.exit(1);
    }
    for (let t = 3500; t <= 5800; t += 50) {
      const rh = L.getElevation(
        -t * Math.sin(yaw),
        -t * Math.cos(yaw),
        simplex,
        constants
      );
      if (rh >= 200) {
        console.error(
          `FAIL: seed ${seed} Falls WNW ridge exceeds 200 along spawn path at t=${t}: ${rh.toFixed(1)}`
        );
        process.exit(1);
      }
    }
    for (const segments of [20, 40]) {
      const {result} = generateChunkData({
        chunkX: 0,
        chunkZ: -3,
        chunkSize: 1500,
        segments,
        elevParams: constants,
        worldSeed: seed,
        enableObjects: true,
      });
      const wf = result.chunkProps.waterfall;
      if (!wf || !wf.leap || !wf.stream || wf.stream.length < 4) {
        console.error(
          `FAIL: seed ${seed} segments=${segments} missing leaping Falls waterfall`
        );
        process.exit(1);
      }
    }
  }
  useSeed(20260101);
  const northDip = L.getElevation(0, -5350, simplex, constants);
  const eastToe = L.getElevation(580, -4800, simplex, constants);
  if (northDip <= 50 || eastToe <= 50) {
    console.error(
      `FAIL: inland seed 20260101 carved moat/ditch on north dip (${northDip.toFixed(1)}) or east toe (${eastToe.toFixed(1)})`
    );
    process.exit(1);
  }
}
console.log(
  '  Passed: Falls cuesta headland preserves waterfall leap, dry inland slopes, and spawn clearance'
);

// --- MUSHROOM COTTAGES STAY OUT OF THE SNOWY NORTH ---
// Regression: mushroom cottages must not spawn on the frozen northern ice
// shelf or north of the freeze boundary (e.g. 15.3N 15.3E), while still
// appearing in the eastern mushroom groves further south.
{
  useSeed(20261116);
  const elevParams = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400,
  };
  let frozenCottages = 0;
  for (let cx = 50; cx <= 53; cx++) {
    for (let cz = -53; cz <= -50; cz++) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize: 1500,
        segments: 40,
        elevParams,
        worldSeed: 20261116,
        enableObjects: true,
      });
      frozenCottages +=
        (result.instanceData.mushroomCottage0Body?.count || 0) +
        (result.instanceData.mushroomCottage1Body?.count || 0);
    }
  }
  if (frozenCottages !== 0) {
    console.error(
      `FAIL: found ${frozenCottages} mushroom cottage(s) in the snowy north (15.3N 15.3E)`
    );
    process.exit(1);
  }
  let groveCottages = 0;
  for (let cx = 42; cx <= 56; cx += 2) {
    for (let cz = -6; cz <= 8; cz += 2) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize: 1500,
        segments: 40,
        elevParams,
        worldSeed: 20261116,
        enableObjects: true,
      });
      groveCottages +=
        (result.instanceData.mushroomCottage0Body?.count || 0) +
        (result.instanceData.mushroomCottage1Body?.count || 0);
    }
  }
  if (groveCottages === 0) {
    console.error(
      'FAIL: expected mushroom cottages in the eastern mushroom groves'
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log(
  '  Passed: mushroom cottages stay out of the snowy north and appear in eastern groves'
);

// --- MUSHROOMS STAY OFF STEEP BASALT CLIFF WALLS ---
// Regression: eastern alien mushrooms must not hang off sheer basalt column
// walls (such as chunk 40, -1 at X = 60000, Z = -1500 / 0.3 North, 12.0 East),
// while still growing across the column tops.
{
  const seed = 20261119;
  useSeed(seed);
  const elevParams = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000 * ChillFlightLogic.SCALE,
    MAP_HEIGHT_SCALE: 400,
  };
  const chunkSize = 1500;
  const segments = 64;
  const step = chunkSize / segments;
  let totalMushrooms = 0;
  for (let cx = 40; cx <= 43; cx++) {
    for (let cz = -2; cz <= 0; cz++) {
      const {result} = generateChunkData({
        chunkX: cx,
        chunkZ: cz,
        chunkSize,
        segments,
        elevParams,
        worldSeed: seed,
        enableObjects: true,
      });
      const cap = result.instanceData.mushroomCap;
      if (!cap) continue;
      totalMushrooms += cap.count;
      for (let i = 0; i < cap.count; i++) {
        const lx = cap.matrices[i * 16 + 12];
        const lz = cap.matrices[i * 16 + 14];
        const wx = cx * chunkSize + lx;
        const wz = cz * chunkSize + lz;
        const ix = Math.round((lx + chunkSize / 2) / step);
        const iz = Math.round((lz + chunkSize / 2) / step);
        const h = ChillFlightLogic.getElevation(wx, wz, simplex, elevParams);
        const hE = ChillFlightLogic.getElevation(
          wx + step,
          wz,
          simplex,
          elevParams
        );
        const hW = ChillFlightLogic.getElevation(
          wx - step,
          wz,
          simplex,
          elevParams
        );
        const hS = ChillFlightLogic.getElevation(
          wx,
          wz + step,
          simplex,
          elevParams
        );
        const hN = ChillFlightLogic.getElevation(
          wx,
          wz - step,
          simplex,
          elevParams
        );
        const sx =
          ix > 0 && ix < segments
            ? (hE - hW) / (2 * step)
            : ix === 0
              ? (hE - h) / step
              : (h - hW) / step;
        const sz =
          iz > 0 && iz < segments
            ? (hS - hN) / (2 * step)
            : iz === 0
              ? (hS - h) / step
              : (h - hN) / step;
        const slopeFactor = Math.min(1, Math.hypot(sx, sz) * 0.5);
        if (slopeFactor >= 0.3) {
          console.error(
            `FAIL: mushroom ${i} in chunk (${cx}, ${cz}) at (${wx}, ${wz}) spawned on steep cliff wall (slopeFactor=${slopeFactor.toFixed(2)})`
          );
          process.exit(1);
        }
      }
    }
  }
  if (totalMushrooms < 100) {
    console.error(
      `FAIL: expected >=100 mushrooms on plateau tops across chunks (40..43, -2..0), got ${totalMushrooms}`
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log(
  '  Passed: eastern alien mushrooms stay off steep basalt cliff walls'
);

// --- MONTAUK VS HEADLAND LIGHTHOUSE NAUTICAL PALETTES ---
// Montauk (chunk 5, 2 at X=7500, Z=3000 / 0.6 South, 1.5 East) always uses
// palette 0 (harbour-red), while procedural headland lighthouses pick
// deterministically from non-red nautical palettes (1..LIGHTHOUSE_PALETTES-1).
{
  useSeed(20260101);
  const elevParams = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400,
  };
  const {result: montauk} = generateChunkData({
    chunkX: 5,
    chunkZ: 2,
    chunkSize: 1500,
    segments: 20,
    elevParams,
    worldSeed: 20260101,
    enableObjects: true,
  });
  const mp = montauk.chunkProps.lighthousePos;
  if (!mp || mp.headland || mp.colorIndex !== 0) {
    console.error(
      `FAIL: Montauk lighthouse expected !headland and colorIndex=0, got ${JSON.stringify(mp)}`
    );
    process.exit(1);
  }
  const seenHeadlandPalettes = new Set();
  let headlandCount = 0;
  for (const seed of [20260101, 20261025, 20261116, 42]) {
    useSeed(seed);
    for (let cx = -35; cx <= 20; cx++) {
      for (let cz = -28; cz <= 10; cz++) {
        if ((cx === 5 && cz === 2) || !lighthouseChunkWins(cx, cz)) continue;
        const {result} = generateChunkData({
          chunkX: cx,
          chunkZ: cz,
          chunkSize: 1500,
          segments: 40,
          elevParams,
          worldSeed: seed,
          enableObjects: true,
        });
        const lp = result.chunkProps.lighthousePos;
        if (!lp) continue;
        headlandCount++;
        if (
          !lp.headland ||
          !Number.isInteger(lp.colorIndex) ||
          lp.colorIndex < 1 ||
          lp.colorIndex >= LIGHTHOUSE_PALETTES.length
        ) {
          console.error(
            `FAIL: headland lighthouse at chunk (${cx}, ${cz}) got invalid palette ${JSON.stringify(lp)}`
          );
          process.exit(1);
        }
        // Re-running the same chunk produces the exact same palette
        const {result: repeat} = generateChunkData({
          chunkX: cx,
          chunkZ: cz,
          chunkSize: 1500,
          segments: 40,
          elevParams,
          worldSeed: seed,
          enableObjects: true,
        });
        if (repeat.chunkProps.lighthousePos?.colorIndex !== lp.colorIndex) {
          console.error(
            `FAIL: non-deterministic headland lighthouse colorIndex at chunk (${cx}, ${cz})`
          );
          process.exit(1);
        }
        seenHeadlandPalettes.add(lp.colorIndex);
      }
    }
  }
  if (headlandCount < 8 || seenHeadlandPalettes.size < 4) {
    console.error(
      `FAIL: expected >=8 headland lighthouses across >=4 nautical palettes, got count=${headlandCount}, palettes=${[...seenHeadlandPalettes].join(',')}`
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Montauk stays classic red and headland lighthouses pick deterministic nautical palettes'
);

// --- FARMLAND CORN, WILDFLOWERS, AND GREEN-STRIP GROUND TULIPS (#164) ---
{
  useSeed(20261121);
  const elevParams = {
    WATER_LEVEL: 40,
    MOUNTAIN_LEVEL: 180,
    MAP_WORLD_SIZE: 10000 * ChillFlightLogic.SCALE,
    MAP_HEIGHT_SCALE: 400,
  };
  let sawCorn = false;
  let sawWildflower = false;
  let sawPasture = false;
  let tulipFarmSamples = 0;
  let totalFarmSamples = 0;
  const tulipColorsSeen = new Set();
  const out = {wheat: 0, corn: 0, tulip: 0, wildflower: 0, crop: -1};

  for (let x = -22000; x <= 8000; x += 180) {
    for (let z = -9500; z <= 9500; z += 180) {
      const h = ChillFlightLogic.getElevation(x, z, simplex, elevParams);
      if (h <= 44 || h >= 420) continue;
      sampleFarmlandCrop(x, z, h, 0.04, 40, simplex, out);
      const f = fieldAt(x, z, simplex);
      if (f.crop === CROP_KIND.PASTURE) sawPasture = true;
      const activeCrop = out.wheat + out.corn + out.tulip + out.wildflower;
      if (activeCrop > 0.25) {
        totalFarmSamples++;
        if (out.corn > 0.35) sawCorn = true;
        if (out.wildflower > 0.35) sawWildflower = true;
        if (out.tulip > 0.35) {
          tulipFarmSamples++;
          tulipColorsSeen.add(out.crop);
        }
      }
    }
  }

  // Alien zones and deep frozen north must never report farmland crops
  sampleFarmlandCrop(64000, 0, 120, 0.02, 40, simplex, out);
  const alienCrop = out.wheat + out.corn + out.tulip + out.wildflower;
  sampleFarmlandCrop(0, -28000, 80, 0.02, 40, simplex, out);
  const polarCrop = out.wheat + out.corn + out.tulip + out.wildflower;

  const tulipShare = tulipFarmSamples / Math.max(1, totalFarmSamples);
  if (
    !sawPasture ||
    !sawCorn ||
    !sawWildflower ||
    tulipColorsSeen.size < 4 ||
    tulipShare < 0.005 ||
    tulipShare > 0.2 ||
    alienCrop !== 0 ||
    polarCrop !== 0
  ) {
    console.error(
      `FAIL: farmland crop invariants failed (pasture=${sawPasture}, corn=${sawCorn}, wild=${sawWildflower}, tulipColors=${tulipColorsSeen.size}, tulipShare=${tulipShare.toFixed(3)}, alien=${alienCrop}, polar=${polarCrop})`
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Farmland generates corn, wildflower, and 4-color ground tulip strips within temperate bounds'
);

// --- 26. Irish meandering dry-stone famine walls & snow-country slate walls (#184) ---
{
  const {
    stoneWall,
    stoneWallFar,
    stoneWallRuined,
    stoneWallRuinedFar,
    stoneWallSnow,
    stoneWallSnowFar,
    stoneWallSnowRuined,
    stoneWallSnowRuinedFar,
  } = buildStoneWallGeos();
  const nearPos = stoneWall.attributes.position;
  const nearNorm = stoneWall.attributes.normal;
  const ruinedPos = stoneWallRuined.attributes.position;
  const snowPos = stoneWallSnow.attributes.position;
  const snowNorm = stoneWallSnow.attributes.normal;
  const snowRuinedPos = stoneWallSnowRuined.attributes.position;
  const farTris = stoneWallFar.attributes.position.count / 3;
  const ruinedFarTris = stoneWallRuinedFar.attributes.position.count / 3;
  const snowFarTris = stoneWallSnowFar.attributes.position.count / 3;
  const snowRuinedFarTris =
    stoneWallSnowRuinedFar.attributes.position.count / 3;
  let finiteVerts =
    nearPos.count > 0 &&
    ruinedPos.count > 0 &&
    snowPos.count > 0 &&
    snowRuinedPos.count > 0 &&
    farTris === 10 &&
    ruinedFarTris === 10 &&
    snowFarTris === 10 &&
    snowRuinedFarTris === 10;
  let topNy = 0;
  let topCount = 0;
  for (let i = 0; i < nearPos.count; i++) {
    if (
      !Number.isFinite(nearPos.getX(i)) ||
      !Number.isFinite(nearPos.getY(i)) ||
      !Number.isFinite(nearPos.getZ(i))
    ) {
      finiteVerts = false;
      break;
    }
    if (nearPos.getY(i) > 2.95) {
      topNy += nearNorm.getY(i);
      topCount++;
    }
  }
  let snowTopNy = 0;
  let snowTopCount = 0;
  for (let i = 0; i < snowPos.count; i++) {
    if (
      !Number.isFinite(snowPos.getX(i)) ||
      !Number.isFinite(snowPos.getY(i)) ||
      !Number.isFinite(snowPos.getZ(i))
    ) {
      finiteVerts = false;
      break;
    }
    if (snowPos.getY(i) > 2.95) {
      snowTopNy += snowNorm.getY(i);
      snowTopCount++;
    }
  }
  if (
    !finiteVerts ||
    topCount === 0 ||
    topNy / topCount <= 0 ||
    snowTopCount === 0 ||
    snowTopNy / snowTopCount <= 0
  ) {
    console.error(
      `FAIL: stoneWall geometry invalid (finite=${finiteVerts}, farTris=${farTris}, topNy=${topNy / Math.max(1, topCount)}, snowTopNy=${snowTopNy / Math.max(1, snowTopCount)})`
    );
    process.exit(1);
  }

  useSeed(20260928);
  const routes = getFamineWallRoutes(simplex);
  const multiKmPrimary = routes.filter(
    (r) => !r.isSpur && r.uMax - r.uMin >= 8000
  );
  if (routes.length < 20 || multiKmPrimary.length < 15) {
    console.error(
      `FAIL: expected multi-km famine wall routes (total=${routes.length}, >=8km=${multiKmPrimary.length})`
    );
    process.exit(1);
  }

  const elevParams = {
    WATER_LEVEL: 25,
    MOUNTAIN_LEVEL: 400,
    MAP_WORLD_SIZE: 60000,
    MAP_HEIGHT_SCALE: 1,
  };
  // Excluded biomes must never report active stone-wall zones
  const alienWall = stoneWallZoneAt(64000, 0, simplex, elevParams).active;
  const polarWall = stoneWallZoneAt(0, -28000, simplex, elevParams).active;
  const desertWall = stoneWallZoneAt(-8000, 14500, simplex, elevParams).active;
  const swampWall = stoneWallZoneAt(-10000, 8500, simplex, elevParams).active;
  const fallsWall = stoneWallZoneAt(0, -900, simplex, elevParams).active;
  if (alienWall || polarWall || desertWall || swampWall || fallsWall) {
    console.error(
      `FAIL: stoneWallZoneAt leaked into excluded region (alien=${alienWall}, polar=${polarWall}, desert=${desertWall}, swamp=${swampWall}, falls=${fallsWall})`
    );
    process.exit(1);
  }

  // Multi-chunk meandering famine-wall corridor (-11,-1), (-10,-1), and (-7,0)
  let totalIntact = 0;
  let totalRuined = 0;
  for (const [cx, cz] of [
    [-11, -1],
    [-10, -1],
    [-7, 0],
  ]) {
    const a = generateChunkData({
      chunkX: cx,
      chunkZ: cz,
      chunkSize: 1000,
      segments: 20,
      elevParams,
      _enableObjects: true,
    }).result;
    const b = generateChunkData({
      chunkX: cx,
      chunkZ: cz,
      chunkSize: 1000,
      segments: 20,
      elevParams,
      _enableObjects: true,
    }).result;
    const wallA = a.instanceData.stoneWall;
    const wallB = b.instanceData.stoneWall;
    const ruinedA = a.instanceData.stoneWallRuined;
    if (!wallA || wallA.count < 30 || wallA.count !== wallB?.count) {
      console.error(
        `FAIL: chunk (${cx}, ${cz}) stoneWall count mismatch (${wallA?.count} vs ${wallB?.count})`
      );
      process.exit(1);
    }
    totalIntact += wallA.count;
    totalRuined += ruinedA?.count || 0;
    for (const data of [wallA, ruinedA]) {
      if (!data) continue;
      const m = data.matrices;
      for (let i = 0; i < data.count; i++) {
        const o = i * 16;
        // 3x3 determinant must stay strictly positive (no inverted winding)
        const det = m[o + 5] * (m[o + 0] * m[o + 10] - m[o + 2] * m[o + 8]);
        const wx = m[o + 12];
        const wz = m[o + 14];
        const roadDist = ChillFlightLogic.highwayDistance(wx, wz);
        if (
          !(det > 0) ||
          roadDist < ChillFlightLogic.ROAD_WIDTH + 12 ||
          ChillFlightLogic.isOnAirport(wx, wz, 80)
        ) {
          console.error(
            `FAIL: invalid stoneWall bay in chunk (${cx}, ${cz}) (det=${det}, roadDist=${roadDist})`
          );
          process.exit(1);
        }
      }
    }
  }
  if (totalIntact < 200 || totalRuined < 20) {
    console.error(
      `FAIL: expected both intact and crumbled famine-wall bays (intact=${totalIntact}, ruined=${totalRuined})`
    );
    process.exit(1);
  }

  // Snow-country northern slate walls (-9, -18) and (-3, -15), south of Z = -20000
  const snowZone = stoneWallZoneAt(-9240, -18385, simplex, elevParams);
  if (!snowZone.active || !snowZone.snowy) {
    console.error(
      `FAIL: expected active snowy stone-wall zone at (-9240, -18385), got active=${snowZone.active}, snowy=${snowZone.snowy}`
    );
    process.exit(1);
  }
  const snowChunkA = generateChunkData({
    chunkX: -9,
    chunkZ: -18,
    chunkSize: 1000,
    segments: 20,
    elevParams,
    _enableObjects: true,
  }).result;
  const snowChunkB = generateChunkData({
    chunkX: -9,
    chunkZ: -18,
    chunkSize: 1000,
    segments: 20,
    elevParams,
    _enableObjects: true,
  }).result;
  const snowWallA = snowChunkA.instanceData.stoneWallSnow;
  const snowWallB = snowChunkB.instanceData.stoneWallSnow;
  const snowRuinedA = snowChunkA.instanceData.stoneWallSnowRuined;
  if (
    !snowWallA ||
    snowWallA.count < 80 ||
    snowWallA.count !== snowWallB?.count ||
    !snowRuinedA ||
    snowRuinedA.count < 15
  ) {
    console.error(
      `FAIL: snow-country chunk (-9, -18) stoneWallSnow mismatch (intact=${snowWallA?.count} vs ${snowWallB?.count}, ruined=${snowRuinedA?.count})`
    );
    process.exit(1);
  }
  for (const data of [snowWallA, snowRuinedA]) {
    const m = data.matrices;
    for (let i = 0; i < data.count; i++) {
      const o = i * 16;
      const det = m[o + 5] * (m[o + 0] * m[o + 10] - m[o + 2] * m[o + 8]);
      const wx = m[o + 12];
      const wz = m[o + 14];
      const roadDist = ChillFlightLogic.highwayDistance(wx, wz);
      if (
        !(det > 0) ||
        wz < -20000 ||
        roadDist < ChillFlightLogic.ROAD_WIDTH + 12 ||
        ChillFlightLogic.isOnAirport(wx, wz, 80)
      ) {
        console.error(
          `FAIL: invalid stoneWallSnow bay in chunk (-9, -18) (det=${det}, wz=${wz}, roadDist=${roadDist})`
        );
        process.exit(1);
      }
    }
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Meandering multi-km Irish dry-stone famine walls, snow-country slate walls, and crumbled stretches hug hills clear of roads and airfields'
);

// --- 27. Slip roads at the coast roads' crossings survive landmark placement ---
// The first ground lookup on a world places the pyramids (and the other
// landmarks) with the coast roads off, and that lookup reaches slipRoads.
// They used to be kept from then on without the coast roads' slip roads,
// while the terrain workers had them and filled the ground up to them,
// burying the coast road where it crosses a north-south highway (seed
// 20261121, south coast road over highway 1 near x -15850, z -13450).
{
  useSeed(20261121);
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180};
  ChillFlightLogic.getElevation(
    -15850,
    -13450,
    simplex,
    constants,
    (a, b, t) => a + (b - a) * t
  );
  const near = ChillFlightLogic.slipRoads(simplex, constants).filter(
    (s) =>
      s.minX < -15500 && s.maxX > -16300 && s.minZ < -13000 && s.maxZ > -13900
  );
  if (near.length !== 4) {
    console.error(
      `FAIL: expected 4 slip roads at the south coast road's crossing with highway 1 on seed 20261121, got ${near.length}`
    );
    process.exit(1);
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Coast road crossings keep their slip roads after the landmarks are placed'
);

// --- 28. Procedural waterfall lip handoff, desert palm-oasis springs, and biome gates ---
{
  useSeed(20261122);
  const elevParams = {
    WATER_LEVEL: 50,
    MOUNTAIN_LEVEL: 500,
    MAP_WORLD_SIZE: 40000,
    MAP_HEIGHT_SCALE: 1000,
  };
  const {result} = generateChunkData({
    chunkX: 0,
    chunkZ: 18,
    chunkSize: 1500,
    segments: 40,
    elevParams,
    worldSeed: 20261122,
    enableObjects: true,
  });
  const wf = result.chunkProps.waterfall;
  if (!wf || wf.leap || wf.desert < 0.8 || wf.course.length < 18) {
    console.error(
      `FAIL: expected desert oasis procedural waterfall in chunk (0, 18) on seed 20261122, got ${JSON.stringify(
        wf && {
          leap: wf.leap,
          desert: wf.desert,
          courseLen: wf.course.length,
        }
      )}`
    );
    process.exit(1);
  }

  // Course starts upstream along the incoming stream tangent and arcs off the
  // diagonal gorge along its true SW cliff normal instead of snapping due South
  const streamEnd = wf.stream[wf.stream.length - 1];
  const streamPrev = wf.stream[wf.stream.length - 2];
  const inLen = Math.hypot(
    streamEnd[0] - streamPrev[0],
    streamEnd[2] - streamPrev[2]
  );
  const inX = (streamEnd[0] - streamPrev[0]) / inLen;
  const inZ = (streamEnd[2] - streamPrev[2]) / inLen;
  const overlapDx = streamEnd[0] - wf.course[0][0];
  const overlapDz = streamEnd[2] - wf.course[0][2];
  const overlapDist = Math.hypot(overlapDx, overlapDz);
  const overlapDot = (overlapDx * inX + overlapDz * inZ) / overlapDist;
  if (Math.abs(overlapDist - 14) > 0.5 || overlapDot < 0.99) {
    console.error(
      `FAIL: waterfall course head does not overlap stream tangent cleanly (dist=${overlapDist.toFixed(2)}, dot=${overlapDot.toFixed(3)})`
    );
    process.exit(1);
  }
  const foot = wf.course[wf.course.length - 1];
  const fallDx = foot[0] - streamEnd[0];
  const fallDz = foot[2] - streamEnd[2];
  const fallHoriz = Math.hypot(fallDx, fallDz);
  if (fallDx / fallHoriz > -0.45 || fallDz / fallHoriz < 0.45) {
    console.error(
      `FAIL: diagonal gorge waterfall snapped off cliff normal (dir=(${(fallDx / fallHoriz).toFixed(2)}, ${(fallDz / fallHoriz).toFixed(2)}))`
    );
    process.exit(1);
  }

  // Oasis palms, boulders, and bushes dress the desert spring, while green turf
  // colors the source vertex without leaking across the X = 750 chunk border
  const counts = result.chunkProps.counts;
  if (counts.trees_palm < 6 || counts.rocks < 8 || counts.bushes < 10) {
    console.error(
      `FAIL: desert waterfall oasis missing expected palms/rocks/bushes: ${JSON.stringify(
        {
          palms: counts.trees_palm,
          rocks: counts.rocks,
          bushes: counts.bushes,
        }
      )}`
    );
    process.exit(1);
  }
  const cols = result.buffers.terrainColors;
  const srcGx = Math.round((wf.stream[0][0] + 750) / 37.5);
  const srcGz = Math.round((wf.stream[0][2] + 750) / 37.5);
  const springIdx = (srcGz * 41 + srcGx) * 3;
  if (cols[springIdx + 1] <= cols[springIdx] + 0.08) {
    console.error(
      `FAIL: expected lush green oasis turf at spring source vertex, got rgb=(${cols[springIdx].toFixed(2)}, ${cols[springIdx + 1].toFixed(2)}, ${cols[springIdx + 2].toFixed(2)})`
    );
    process.exit(1);
  }
  const borderIdx = (srcGz * 41 + 40) * 3; // eastern X = 750 chunk seam beside spring
  if (cols[borderIdx] <= cols[borderIdx + 1]) {
    console.error(
      `FAIL: oasis turf leaked onto chunk border vertex (750, ${wf.stream[0][2]}), rgb=(${cols[borderIdx].toFixed(2)}, ${cols[borderIdx + 1].toFixed(2)}, ${cols[borderIdx + 2].toFixed(2)})`
    );
    process.exit(1);
  }

  // Temperate procedural waterfall (chunk -9, 0) gets the same 2D cliff-normal
  // lip overlap without any desert oasis palms or desert flag
  const {result: rTemp} = generateChunkData({
    chunkX: -9,
    chunkZ: 0,
    chunkSize: 1500,
    segments: 40,
    elevParams,
    worldSeed: 20261122,
    enableObjects: true,
  });
  const wfTemp = rTemp.chunkProps.waterfall;
  if (
    !wfTemp ||
    wfTemp.desert !== 0 ||
    rTemp.chunkProps.counts.trees_palm > 0
  ) {
    console.error(
      `FAIL: temperate waterfall in chunk (-9, 0) should have desert=0 and 0 palms, got ${JSON.stringify(
        wfTemp && {
          desert: wfTemp.desert,
          palms: rTemp.chunkProps.counts.trees_palm,
        }
      )}`
    );
    process.exit(1);
  }
  const tEnd = wfTemp.stream[wfTemp.stream.length - 1];
  const tPrev = wfTemp.stream[wfTemp.stream.length - 2];
  const tInLen = Math.hypot(tEnd[0] - tPrev[0], tEnd[2] - tPrev[2]);
  const tOverlapDx = tEnd[0] - wfTemp.course[0][0];
  const tOverlapDz = tEnd[2] - wfTemp.course[0][2];
  const tOverlapDist = Math.hypot(tOverlapDx, tOverlapDz);
  const tOverlapDot =
    (tOverlapDx * (tEnd[0] - tPrev[0]) + tOverlapDz * (tEnd[2] - tPrev[2])) /
    (tOverlapDist * tInLen);
  if (Math.abs(tOverlapDist - 14) > 0.5 || tOverlapDot < 0.99) {
    console.error(
      `FAIL: temperate waterfall course head does not overlap stream tangent cleanly (dist=${tOverlapDist.toFixed(2)}, dot=${tOverlapDot.toFixed(3)})`
    );
    process.exit(1);
  }

  // Frozen north and alien chunks must never spawn procedural waterfalls
  for (const [cx, cz] of [
    [0, -16],
    [-46, 0],
    [46, 0],
  ]) {
    const {result: rDisallowed} = generateChunkData({
      chunkX: cx,
      chunkZ: cz,
      chunkSize: 1500,
      segments: 30,
      elevParams,
      worldSeed: 20261122,
      enableObjects: true,
    });
    if (rDisallowed.chunkProps.waterfall) {
      console.error(
        `FAIL: unexpected procedural waterfall in disallowed snow/alien chunk (${cx}, ${cz})`
      );
      process.exit(1);
    }
  }
  useSeed(20260101);
}
console.log(
  '  Passed: Procedural waterfalls align lip handoffs with 2D cliff normals, dress desert springs as palm oases, and stay out of snow and alien lands'
);

console.log('All terrain invariant tests passed successfully!');
process.exit(0);
