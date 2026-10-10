#!/usr/bin/env node
/**
 * scripts/test-terrain.js
 *
 * Automated regression test suite for procedural terrain generation.
 * Enforces critical world continuity invariants:
 *  1. No intermediate early returns in getElevation() procedural pipeline
 *  2. Continuous frozen north pack ice shelf (no vertical open-water tears)
 *  3. Continuous eastern alien biome (no periodic road-trench slices)
 *  4. Strict west-only boundaries for highway canyon carving (X < 0)
 *  5. Flat, dry airfields on any seed
 */

import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The world seed defaults to today's date, and on some days the terrain near
// a sampled line is naturally low. Pin the seed so results don't vary by day;
// the regressions checked here (tears, trenches) show up with any seed.
simplex.seed(20260101);

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
// Beyond 4.0N/5.0N (Z <= -25000), the ocean should be frozen pack ice shelf (elev >= 42).
// No point should drop into underwater ocean (elev <= 40).
const testLats = [-25000, -35000, -50000]; // 5.0N, 7.0N, 10.0N
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
        `FAIL: Frozen North has open-water tear at X=${testX}, Z=${testZ} (elev=${elev.toFixed(
          1
        )} < ${constants.WATER_LEVEL + 1.5})`
      );
      process.exit(1);
    }
  }
}
console.log(
  '  Passed: Frozen north pack ice shelf is continuous across all longitudes'
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
    simplex.seed(seed);
    const north = peak(-5000);
    const south = peak(5000);
    if (north < 800 || south < 800) {
      console.error(
        `FAIL: seed ${seed} has no early mountain range (peaks: 1N ${north.toFixed(0)}, 1S ${south.toFixed(0)})`
      );
      process.exit(1);
    }
  }
  simplex.seed(20260101);
}
console.log('  Passed: The first mountain ranges north and south always rise');

// --- AIRPORTS: FLAT RUNWAYS ON ANY SEED ---
// The ground under each runway is flat at the field height, above the water,
// whatever the land around it is like.
{
  const water = constants.WATER_LEVEL;
  for (const seed of [1, 42, 20260101, 20260928, 99999]) {
    simplex.seed(seed);
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
  simplex.seed(20260101);
}
console.log('  Passed: Every airport is flat and above the water on any seed');

console.log('All terrain invariant tests passed successfully!');
process.exit(0);
