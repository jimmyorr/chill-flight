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
 */

const fs = require('fs');
const path = require('path');

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

// --- LOAD LOGIC & SIMPLEX NOISE FOR RUNTIME INVARIANTS ---
const ChillFlightLogic = require('../chill-flight-logic.js');
global.ChillFlightLogic = ChillFlightLogic;

const noiseSrc = fs
  .readFileSync(path.join(__dirname, '..', 'noise.js'), 'utf8')
  .replace('const simplex =', 'global.simplex =');
eval(noiseSrc);

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
      global.simplex,
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
      global.simplex,
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
      global.simplex,
      constants,
      null,
      {ignoreRoads: false}
    );
    const elevNoRoads = ChillFlightLogic.getElevation(
      testX,
      testZ,
      global.simplex,
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

console.log('All terrain invariant tests passed successfully!');
process.exit(0);
