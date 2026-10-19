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
import {generateChunkData} from '../terrain-gen.js';

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
// Highways only exist at X < 0. For X >= 0, ignoreRoads: true vs false MUST be identical.
for (let testX = 0; testX <= 30000; testX += 5000) {
  for (let testZ = -20000; testZ <= 20000; testZ += 5000) {
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
  '  Passed: Highway canyon carving strictly confined to West Coast (X < 0)'
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
      const natural = ChillFlightLogic.getElevation(
        r.x1,
        r.z,
        simplex,
        constants,
        null,
        {ignoreRivers: true, ignoreRoads: true, forRoad: true}
      );
      const highway = ChillFlightLogic.highwayHeight(natural, 40);
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
    for (let xx = x - 300; xx <= x + 300; xx += 0.5) {
      brute = Math.min(brute, Math.hypot(xx - x, z - L.getRoadCenterZ(xx)));
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

console.log('All terrain invariant tests passed successfully!');
process.exit(0);
