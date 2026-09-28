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
const _colorForestDesertTint = new Color(0xa0522d);
const _colorPlainsSnowTint = new Color(0xfafafa);
const _colorMountainTint = new Color(0x7f8c8d);
const _colorAlpineRockDark = new Color(0x424a54);
const _colorAlpineRockLight = new Color(0x9ba2a8);
const _colorScree = new Color(0x736960);
const _colorDesertMountainRock = new Color(0xc24b2b);
const _colorIce = new Color(0x6ca6a8);
const _colorAutumnForestTint = new Color(0x5d4037);
const _colorAutumnPlainsTint = new Color(0x8d6e63);
const _colorCherryForestTint = new Color(0xf8bbd0);
const _colorCherryPlainsTint = new Color(0xfce4ec);
const _colorSandMottleHigh = new Color(0xd2b48c);
const _colorSandMottleLow = new Color(0xdeb887);
const _colorArizonaDark = new Color(0x8b0000);
const _colorDesertMottle = new Color(0xdaa520);
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
const _colorWesternLowland = new Color(0x400020);
const _colorWesternRock = new Color(0x200000);
const _colorWesternPeak = new Color(0xffffff);
const _colorWesternCliff = new Color(0xff4500);
const _colorWesternWater = new Color(0xff00ff);
const _snowColor = new Color(0xe0f7fa);
const _colorWhite = new Color(0xffffff);
const _colorIceMottleDark = new Color(0x8a9ea8);
const _tempColorObj = new Color();
const _baseBushColor = new Color();
const _treeBaseColor = new Color();
const _treeTempColor = new Color();

const VOLCANO_X = -5000;
const VOLCANO_Z = 5000;
const ENABLE_PAGODAS = false;
const ENABLE_BARNS = true;
const ENABLE_MONASTERIES = true;
const ENABLE_CASTLE_RUINS = true;
const ENABLE_LIGHTHOUSES = false;

const ALIEN_MUSHROOM_CAP_COLORS = [
  0x9c27b0, 0xab47bc, 0x7b1fa2, 0xba68c8, 0x8e24aa, 0x00bcd4, 0x26a69a,
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

class InstanceCollector {
  constructor() {
    this.data = {};
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

// Returns {result, transferables}: the chunk's buffers, instance data and
// prop placements, plus the buffers to transfer when posting from a worker.
export function generateChunkData({
  chunkX,
  chunkZ,
  chunkSize,
  segments,
  elevParams,
  worldSeed,
  enableObjects,
}) {
  if (worldSeed !== undefined) {
    ChillFlightLogic.WORLD_SEED = worldSeed;
    simplex.seed(worldSeed);
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
  let waterDepths = null;
  const transferables = [
    positions.buffer,
    heightGrid.buffer,
    terrainColors.buffer,
  ];

  if (hasWater) {
    const wSegments = Math.max(1, Math.floor(segments / 4));
    const wGridX1 = wSegments + 1;
    const wTotalVerts = wGridX1 * wGridX1;
    const wStep = chunkSize / wSegments;
    const wHalfSize = chunkSize / 2;

    waterPositions = new Float32Array(wTotalVerts * 3);
    waterColors = new Float32Array(wTotalVerts * 3);
    waterDepths = new Float32Array(wTotalVerts);

    const colorWater = new Color(0x40c4ff);
    const colorIcyWater = new Color(0x88ccff);
    const colorDesertWater = new Color(0x00ced1);
    const tempColor = new Color();

    let wPosIdx = 0;
    let wIdx = 0;

    for (let iz = 0; iz < wGridX1; iz++) {
      const localZ = -wHalfSize + iz * wStep;
      const worldZ = worldOffsetZ + localZ;
      for (let ix = 0; ix < wGridX1; ix++) {
        const localX = -wHalfSize + ix * wStep;
        const worldX = worldOffsetX + localX;

        waterPositions[wPosIdx] = localX;
        waterPositions[wPosIdx + 1] = elevParams.WATER_LEVEL;
        waterPositions[wPosIdx + 2] = localZ;

        const terrainHeight = getElevation(worldX, worldZ, elevParams);
        // Negative on land (bounded), so depth interpolated across a
        // shoreline triangle reaches 0 right at the visible waterline; the
        // water shader's foam and shallows rely on that.
        waterDepths[wIdx] = Math.max(
          -30.0,
          elevParams.WATER_LEVEL - terrainHeight
        );

        const tempNoise = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
        const northInfluence = Math.max(0, -worldZ / 4500);
        const southInfluence = Math.max(0, worldZ / 4500);
        const snowRaw = Math.max(
          0,
          Math.min(1, (northInfluence + tempNoise * 0.05 - 0.7) * 1.5)
        );
        const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);
        const desertRaw = Math.max(
          0,
          Math.min(1, (southInfluence + tempNoise * 0.05 - 0.7) * 1.5)
        );
        const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

        tempColor.copy(colorWater);
        if (snowFactor > 0) tempColor.lerp(colorIcyWater, snowFactor);
        if (desertFactor > 0) tempColor.lerp(colorDesertWater, desertFactor);

        waterColors[wPosIdx] = tempColor.r;
        waterColors[wPosIdx + 1] = tempColor.g;
        waterColors[wPosIdx + 2] = tempColor.b;

        wPosIdx += 3;
        wIdx++;
      }
    }

    transferables.push(
      waterPositions.buffer,
      waterColors.buffer,
      waterDepths.buffer
    );
  }

  // Pass 2: Terrain Coloring & Prop Placement Sampling
  const rng = ChillFlightLogic.chunkRng(chunkX, chunkZ);
  const densityFactor = 40 / segments;
  const densityScale = densityFactor * densityFactor;

  const gridSpacing = chunkSize / segments;
  const invGridSpacing = 1.0 / gridSpacing;
  const invTwoGridSpacing = 0.5 / gridSpacing;

  // Prop candidate arrays
  const treePositions = [];
  const deciduousTreePositions = [];
  const tallDeciduousTreePositions = [];
  const palmTreePositions = [];
  const deadTreePositions = [];
  const snowTreePositions = [];
  const mushroomTreePositions = [];
  const autumnTree1Positions = [];
  const autumnTree2Positions = [];
  const autumnTree3Positions = [];
  const cherryTreePositions = [];
  const yellowCortezTreePositions = [];
  const japaneseMapleTreePositions = [];

  const housePositions = [];
  const twoStoryHousePositions = [];
  const strawHutPositions = [];
  const windmillPositions = [];
  let lighthousePos = null;
  const pierPositions = [];
  const campfirePositions = [];
  const chimneySmokePositions = [];
  const sailboatPositions = [];
  const pirateShipPositions = [];
  const icebergPositions = [];
  const iceFloePositions = [];
  const penguinPositions = [];
  const rockPositions = [];
  const snowRockPositions = [];
  const desertRockPositions = [];
  const cactusPositions = [];
  const snowmanPositions = [];
  const lilyPadPositions = [];
  const bushPositions = [];
  const pagodaPositions = [];
  const barnPositions = [];
  const monasteryPositions = [];
  const castleRuinsPositions = [];
  const rockArchPositions = [];
  const rockArchGrassPositions = [];

  const WATER_LEVEL = elevParams.WATER_LEVEL;
  const MOUNTAIN_LEVEL = elevParams.MOUNTAIN_LEVEL;

  let colorIdx = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const vertI = i / 3;
    const localX = positions[i];
    const localZ = positions[i + 2];
    const worldX = worldOffsetX + localX;
    const worldZ = worldOffsetZ + localZ;
    const isEast = worldX > 0;
    const isAlienLand = Math.abs(worldX) > 25000;
    const isEastAlien = isEast && isAlienLand;

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

    const extremeEdgeWorld = 50000;
    const absWorldX = Math.abs(worldX);
    const extremeZoneFactor = Math.max(
      0,
      Math.min(1, (absWorldX - extremeEdgeWorld) / 15000)
    );
    const extremeBlend =
      extremeZoneFactor * extremeZoneFactor * (3 - 2 * extremeZoneFactor);

    const northInfluence = Math.max(0, -worldZ / 5000);
    const noisePath = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
    const biomeNoise = simplex.noise2D(worldX * 0.0005, worldZ * 0.0005) * 0.1;

    const snowRaw = Math.max(
      0,
      Math.min(1, (northInfluence + noisePath * 0.05 + biomeNoise - 1.0) * 1.5)
    );
    const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);

    const southInfluence = Math.max(0, worldZ / 5000);
    const desertRaw = Math.max(
      0,
      Math.min(1, (southInfluence + noisePath * 0.05 - biomeNoise - 2.0) * 1.0)
    );
    const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

    const eastCoastFactor = Math.max(0, Math.min(1, (worldX + 2000) / 2000));
    const sandMaxHeight = WATER_LEVEL + 2 + eastCoastFactor * 10;

    const isForest =
      simplex.noise2D(worldX * 0.005 + 100, worldZ * 0.005) > 0.2;
    const autumnNoise = simplex.noise2D(
      worldX * 0.0003 + 500,
      worldZ * 0.0003 + 500
    );
    const cherryNoise = simplex.noise2D(
      worldX * 0.0005 + 1000,
      worldZ * 0.0005 + 1000
    );

    // Color assignment & feature spawning
    if (height <= sandMaxHeight) {
      if (height <= WATER_LEVEL) {
        hasWater = true;
        if (_enableObjects) {
          if (rng() < 0.0001 * densityScale) {
            if (height <= WATER_LEVEL + 0.1 && snowFactor < 0.2) {
              const eN = getElevation(worldX, worldZ - 300, elevParams);
              const eS = getElevation(worldX, worldZ + 300, elevParams);
              const eE = getElevation(worldX + 300, worldZ, elevParams);
              const eW = getElevation(worldX - 300, worldZ, elevParams);
              if (
                eN <= WATER_LEVEL + 0.1 &&
                eS <= WATER_LEVEL + 0.1 &&
                eE <= WATER_LEVEL + 0.1 &&
                eW <= WATER_LEVEL + 0.1
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
            sailboatPositions.push({
              x: localX,
              y: WATER_LEVEL,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
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
            }
          }
          if (
            snowFactor < 0.1 &&
            desertFactor < 0.1 &&
            ChillFlightLogic.getBiome(worldX, worldZ, simplex) > -0.15 &&
            rng() < 0.015 * densityScale
          ) {
            lilyPadPositions.push({
              x: localX,
              y: WATER_LEVEL,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          }
        }
        positions[i + 1] = height - 5;
        _tempColorObj.copy(_colorSand).lerp(_colorWater, 0.15);
        if (snowFactor > 0) _tempColorObj.lerp(_colorSandSnowTint, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorDesertSand, desertFactor);
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
      }
    } else if (
      height > MOUNTAIN_LEVEL ||
      (snowFactor > 0.5 && height > MOUNTAIN_LEVEL - 50)
    ) {
      const sierraSnowNoise1 = simplex.noise2D(worldX * 0.003, worldZ * 0.003);
      const sierraSnowNoise2 =
        simplex.noise2D(worldX * 0.012, worldZ * 0.012) * 0.5;
      const organicNoise = sierraSnowNoise1 + sierraSnowNoise2;

      const isDesertMountain = desertFactor > 0.35;
      const canHaveSnow = !isDesertMountain;

      let baseSnowline;
      if (snowFactor > 0.3) {
        baseSnowline = Math.max(WATER_LEVEL + 10, 300 - snowFactor * 400);
      } else if (isDesertMountain) {
        baseSnowline = 2400;
      } else {
        baseSnowline = 1150;
      }
      const snowline = baseSnowline + organicNoise * 180;

      const cliffThreshold = snowFactor > 0.3 ? 0.84 : 0.78;
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
      } else if (height > 550 || isSheerCliff) {
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

          if (height < 700 && slopeFactor > 0.25 && slopeFactor < 0.55) {
            _tempColorObj.lerp(_colorScree, 0.35);
          }
        }
      } else {
        if (isDesertMountain) {
          _tempColorObj.copy(_colorDesertSand);
          if (height > WATER_LEVEL + 5)
            _tempColorObj.lerp(_colorSandMottleHigh, 0.3);
          _tempColorObj.lerp(_colorDesertMottle, mottle * 0.2);
        } else if (snowFactor > 0.4) {
          _tempColorObj.copy(_colorForestSnowTint);
        } else {
          _tempColorObj.copy(_colorForest);
          _tempColorObj.lerp(_colorForestDark, mottle * 0.3);
          if (height > 400) {
            const rockBlend = (height - 400) / 150;
            _tempColorObj.lerp(_colorMountainTint, rockBlend * 0.5);
          }
        }
      }
    } else {
      if (isForest) {
        _tempColorObj.copy(_colorForest);
        if (snowFactor > 0)
          _tempColorObj.lerp(_colorForestSnowTint, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorForestDesertTint, desertFactor);

        _tempColorObj.lerp(_colorForestDeep, mottle * 0.4);
        if (mottle < 0.3) _tempColorObj.lerp(_colorForestLight, 0.2);
      } else {
        _tempColorObj.copy(_colorPlains);
        if (snowFactor > 0)
          _tempColorObj.lerp(_colorPlainsSnowTint, snowFactor);
        if (desertFactor > 0)
          _tempColorObj.lerp(_colorDesertSand, desertFactor);

        _tempColorObj.lerp(_colorPlainsDark, mottle * 0.4);
        if (mottle > 0.8) _tempColorObj.lerp(_colorPlainsBright, 0.3);
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

      if (height <= WATER_LEVEL) {
        _tempColorObj.lerp(colorWater, extremeBlend * 0.85);
      } else if (height < WATER_LEVEL + 4) {
        const bleed = 1.0 - (height - WATER_LEVEL) / 4.0;
        const shoreColor = baseLandColor.clone().lerp(colorWater, bleed);
        _tempColorObj.lerp(shoreColor, extremeBlend * 0.85);
      } else if (height > MOUNTAIN_LEVEL) {
        const peakFrac = Math.min(1, (height - MOUNTAIN_LEVEL) / 400);
        _tempColorObj.lerp(colorCliff, extremeBlend * 0.7);
        _tempColorObj.lerp(colorPeak, extremeBlend * peakFrac * 0.9);
      } else {
        _tempColorObj.lerp(baseLandColor, extremeBlend * 0.75);
      }
    }

    // Frozen North Zone
    let isFrozen = false;
    const freezeBoundaryZ =
      -20000 + simplex.noise2D(worldX * 0.0002, worldZ * 0.0002) * 2000;
    if (worldZ < freezeBoundaryZ) {
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

    const isStandardLand =
      height > sandMaxHeight &&
      height <= MOUNTAIN_LEVEL + (snowFactor > 0.5 ? -50 : 0);

    if (isStandardLand && snowFactor < 0.2 && !isFrozen) {
      if (autumnNoise > 0.35) {
        const factor = Math.min(1, (autumnNoise - 0.35) / 0.1);
        const tint = isForest ? _colorAutumnForestTint : _colorAutumnPlainsTint;
        _tempColorObj.lerp(tint, factor * (isForest ? 0.65 : 0.45));
      } else if (cherryNoise > 0.55) {
        const factor = Math.min(1, (cherryNoise - 0.55) / 0.1);
        const tint = isForest ? _colorCherryForestTint : _colorCherryPlainsTint;
        _tempColorObj.lerp(tint, factor * (isForest ? 0.45 : 0.3));
      }
    }

    const distToVolcano = Math.sqrt(
      (worldX - VOLCANO_X) ** 2 + (worldZ - VOLCANO_Z) ** 2
    );
    const isOnRoad = ChillFlightLogic.getRoadFactor(worldX, worldZ) > 0;
    const isAlienVegetationLand =
      isAlienLand &&
      height > WATER_LEVEL + 2.0 &&
      height <= MOUNTAIN_LEVEL + 50;

    // Spawning objects
    if (
      _enableObjects &&
      (isStandardLand || isAlienVegetationLand) &&
      !isFrozen &&
      !isOnRoad
    ) {
      if (isForest) {
        const treeRoll = rng();
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
          }
        } else if (
          treeRoll <
          (desertFactor > 0.5 ? 0.05 : 0.15) * densityScale
        ) {
          const isIsland =
            worldX > 3000 &&
            ChillFlightLogic.getBiome(worldX, worldZ, simplex) < -0.1;
          const isSouthOf1N = worldZ > -5000;

          if (distToVolcano < 3000 && rng() < 0.7) {
            yellowCortezTreePositions.push({x: localX, y: height, z: localZ});
          } else if (isIsland && isSouthOf1N) {
            palmTreePositions.push({x: localX, y: height, z: localZ});
          } else if (
            snowFactor > 0.4 ||
            (height > MOUNTAIN_LEVEL - 100 && desertFactor < 0.3)
          ) {
            snowTreePositions.push({x: localX, y: height, z: localZ});
          } else if (desertFactor > 0.6) {
            deadTreePositions.push({x: localX, y: height, z: localZ});
          } else if (
            eastCoastFactor > 0.7 &&
            height < WATER_LEVEL + 40 &&
            !isIsland
          ) {
            palmTreePositions.push({x: localX, y: height, z: localZ});
          } else {
            if (cherryNoise > 0.65) {
              if (rng() < 0.35) {
                japaneseMapleTreePositions.push({
                  x: localX,
                  y: height,
                  z: localZ,
                });
              } else {
                cherryTreePositions.push({x: localX, y: height, z: localZ});
              }
            } else if (autumnNoise > 0.45) {
              const variety = rng();
              if (variety < 0.12)
                japaneseMapleTreePositions.push({
                  x: localX,
                  y: height,
                  z: localZ,
                });
              else if (variety < 0.41)
                autumnTree1Positions.push({x: localX, y: height, z: localZ});
              else if (variety < 0.7)
                autumnTree2Positions.push({x: localX, y: height, z: localZ});
              else autumnTree3Positions.push({x: localX, y: height, z: localZ});
            } else {
              if (rng() < 0.25) {
                tallDeciduousTreePositions.push({
                  x: localX,
                  y: height,
                  z: localZ,
                });
              } else {
                deciduousTreePositions.push({
                  x: localX,
                  y: height,
                  z: localZ,
                });
              }
            }
          }
        } else if (
          treeRoll <
          (desertFactor > 0.5 ? 0.0505 : 0.151) * densityScale
        ) {
          const offX = (rng() - 0.5) * 15;
          const offZ = (rng() - 0.5) * 15;
          const h = getElevation(worldX + offX, worldZ + offZ, elevParams);
          campfirePositions.push({x: localX + offX, y: h, z: localZ + offZ});
        }
      } else {
        if (isEastAlien) {
          if (rng() < 0.007 * densityScale) {
            const scaleRoll = rng();
            let scale;
            if (scaleRoll < 0.3) {
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
        } else {
          const houseThreshold =
            (desertFactor > 0.5 ? 0.002 : 0.005) * densityScale;
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

            if (!isAlienLand && !isBeyond5DegNorth) {
              if (isIsland && !isBeyond1DegNorth) {
                strawHutPositions.push({
                  x: localX,
                  y: height,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                });
              } else if (!isIsland) {
                if (rng() > 0.85) {
                  twoStoryHousePositions.push({
                    x: localX,
                    y: height,
                    z: localZ,
                    rotY: rng() * Math.PI * 2,
                  });
                } else {
                  housePositions.push({
                    x: localX,
                    y: height,
                    z: localZ,
                    rotY: rng() * Math.PI * 2,
                  });
                }
                if (snowFactor > 0.3) {
                  chimneySmokePositions.push({
                    x: localX,
                    y: height + 10,
                    z: localZ,
                  });
                }
              }
            }
          } else if (
            !isAlienLand &&
            ENABLE_BARNS &&
            worldX < -5000 &&
            plainsRoll < barnThreshold &&
            snowFactor < 0.4 &&
            desertFactor < 0.3 &&
            height > WATER_LEVEL + 15 &&
            height < MOUNTAIN_LEVEL - 100
          ) {
            barnPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            !isAlienLand &&
            ENABLE_MONASTERIES &&
            plainsRoll < monasteryThreshold &&
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
            height > WATER_LEVEL + 5 &&
            height < MOUNTAIN_LEVEL - 100 &&
            desertFactor < 0.3 &&
            snowFactor < 0.3
          ) {
            windmillPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            ENABLE_LIGHTHOUSES &&
            !(chunkX === 5 && chunkZ === 2) &&
            !lighthousePos &&
            rng() < 0.0004 * densityScale &&
            height < sandMaxHeight + 15
          ) {
            const hN = getElevation(worldX, worldZ - 50, elevParams);
            const hS = getElevation(worldX, worldZ + 50, elevParams);
            const hE = getElevation(worldX + 50, worldZ, elevParams);
            const hW = getElevation(worldX - 50, worldZ, elevParams);
            if (
              hN <= WATER_LEVEL ||
              hS <= WATER_LEVEL ||
              hE <= WATER_LEVEL ||
              hW <= WATER_LEVEL
            ) {
              lighthousePos = {
                x: localX,
                y: height,
                z: localZ,
                rotY: rng() * Math.PI * 2,
              };
            }
          }

          if (
            height > WATER_LEVEL + 0.5 &&
            height < WATER_LEVEL + 3 &&
            rng() < 0.15 * densityScale
          ) {
            const hN = getElevation(worldX, worldZ - 20, elevParams);
            const hS = getElevation(worldX, worldZ + 20, elevParams);
            const hE = getElevation(worldX + 20, worldZ, elevParams);
            const hW = getElevation(worldX - 20, worldZ, elevParams);
            let angleToWater = -1;
            if (hN <= WATER_LEVEL) angleToWater = Math.PI;
            else if (hS <= WATER_LEVEL) angleToWater = 0;
            else if (hE <= WATER_LEVEL) angleToWater = -Math.PI / 2;
            else if (hW <= WATER_LEVEL) angleToWater = Math.PI / 2;
            if (angleToWater !== -1) {
              pierPositions.push({
                x: localX,
                y: height,
                z: localZ,
                rotY: angleToWater,
              });
            }
          }
        }
      }

      if (
        !isAlienLand &&
        ENABLE_PAGODAS &&
        cherryNoise > 0.65 &&
        snowFactor < 0.2 &&
        desertFactor < 0.2 &&
        height > WATER_LEVEL + 5 &&
        height < MOUNTAIN_LEVEL - 80 &&
        rng() < 0.0003 * densityScale
      ) {
        pagodaPositions.push({
          x: localX,
          y: height,
          z: localZ,
          rotY: rng() * Math.PI * 2,
        });
        const offset1X = -12;
        const offset1Z = 12;
        const h1 = getElevation(
          worldX + offset1X,
          worldZ + offset1Z,
          elevParams
        );
        japaneseMapleTreePositions.push({
          x: localX + offset1X,
          y: h1,
          z: localZ + offset1Z,
        });

        const offset2X = 12;
        const offset2Z = -12;
        const h2 = getElevation(
          worldX + offset2X,
          worldZ + offset2Z,
          elevParams
        );
        japaneseMapleTreePositions.push({
          x: localX + offset2X,
          y: h2,
          z: localZ + offset2Z,
        });
      }

      if (rng() < 0.015 * densityScale) {
        if (snowFactor > 0.4)
          snowRockPositions.push({x: localX, y: height, z: localZ});
        else if (desertFactor > 0.4)
          desertRockPositions.push({x: localX, y: height, z: localZ});
        else rockPositions.push({x: localX, y: height, z: localZ});
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
      }
    }

    // Final detail pass (slope darkening & grain)
    if (
      height <= MOUNTAIN_LEVEL &&
      slopeFactor > 0.45 &&
      height > WATER_LEVEL + 5
    ) {
      const cliffBlend = Math.min(1, (slopeFactor - 0.45) * 5.0);
      const isSouthBiome = desertFactor > 0.3;
      const rockColor = isSouthBiome ? _colorCliffSouth : _colorMountainTint;
      _tempColorObj.lerp(rockColor, cliffBlend);
      _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.15);
    } else if (height <= MOUNTAIN_LEVEL && slopeFactor > 0.1) {
      _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.3);
    }

    _tempColorObj.multiplyScalar(1.0 + grain);

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
        if (h <= WATER_LEVEL + 1.1) {
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
      const worldZ = worldOffsetZ + pos.z;
      const northInfluence = Math.max(0, -worldZ / 4000);
      const tempNoise = simplex.noise2D(
        (worldOffsetX + pos.x) * 0.0001,
        worldZ * 0.0001
      );
      const snowRaw = Math.max(
        0,
        Math.min(1, (northInfluence + tempNoise * 0.05 - 0.7) * 1.5)
      );
      const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);

      const baseScale = 0.6 + Math.min(0.6, northInfluence * 0.5);
      const scale =
        pos.scale !== undefined
          ? pos.scale
          : baseScale + rng() * (0.4 + rng() * 0.5);

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

      if (trunkKey) collector.add(trunkKey, _matBuffer);

      if (leavesKey && baseLeafColor) {
        const rVariation = (rng() - 0.5) * 0.1;
        const gVariation = (rng() - 0.5) * 0.1;
        const bVariation = (rng() - 0.5) * 0.1;

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
        if (snowFactor > 0 && leavesKey !== 'mushroomCap') {
          _treeTempColor.lerp(_snowColor, snowFactor);
        }
        collector.add(leavesKey, _matBuffer, _treeTempColor);
      }
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
    palmTreePositions,
    'palmTrunk',
    'palmLeaves',
    0x689f38
  );
  renderTreesToCollector(
    cherryTreePositions,
    'decidTrunk',
    'decidLeaves',
    0xf8bbd0
  );
  renderTreesToCollector(
    autumnTree1Positions,
    'decidTrunk',
    'decidLeaves',
    0xd35400
  );
  renderTreesToCollector(
    autumnTree2Positions,
    'decidTrunk',
    'decidLeaves',
    0xf39c12
  );
  renderTreesToCollector(
    autumnTree3Positions,
    'decidTrunk',
    'decidLeaves',
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
  renderTreesToCollector(
    japaneseMapleTreePositions,
    'japaneseMapleTrunk',
    'japaneseMapleLeaves',
    0xa31515
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
      collector.add('deadTrunk', _matBuffer);
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
        collector.add(variation.key, _matBuffer);
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
      collector.add('cactus', _matBuffer);
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
      collector.add('snowmanBody', _matBuffer);
      collector.add('snowmanNose', _matBuffer);
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
      collector.add('iceberg', _matBuffer);

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
      collector.add('iceberg', _matBuffer);

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
      collector.add('iceberg', _matBuffer);
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
      collector.add('iceFloe', _matBuffer);

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
      collector.add('iceFloe', _matBuffer);

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
      collector.add('iceFloe', _matBuffer);
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
      collector.add('penguinBody', _matBuffer);
      collector.add('penguinBelly', _matBuffer);
      collector.add('penguinHead', _matBuffer);
      collector.add('penguinBeak', _matBuffer);
      collector.add('penguinWingL', _matBuffer);
      collector.add('penguinWingR', _matBuffer);
      collector.add('penguinFootL', _matBuffer);
      collector.add('penguinFootR', _matBuffer);
    });
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
      const scale = 0.5 + rng() * 1.5;
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

      _baseBushColor.setHex(0x558b2f);
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

      collector.add('bush', _matBuffer, _baseBushColor);
    });
  }

  // Populate attributes for chunk local props in identical deterministic sequence
  if (housePositions.length > 0) {
    housePositions.forEach((pos) => {
      pos.bodyId = Math.floor(rng() * 6);
      pos.roofId = Math.floor(rng() * 4);
    });
    housePositions.forEach((pos) => {
      pos.poolId = Math.floor(rng() * 5);
    });
  }

  if (twoStoryHousePositions.length > 0) {
    twoStoryHousePositions.forEach((pos) => {
      pos.bodyId = Math.floor(rng() * 6);
      pos.roofId = Math.floor(rng() * 4);
    });
    twoStoryHousePositions.forEach((pos) => {
      pos.poolId = Math.floor(rng() * 5);
    });
  }

  if (strawHutPositions.length > 0) {
    strawHutPositions.forEach((pos) => {
      pos.scale = 0.9 + rng() * 0.3;
    });
  }

  if (pagodaPositions.length > 0) {
    pagodaPositions.forEach((pos) => {
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

  if (sailboatPositions.length > 0) {
    sailboatPositions.forEach((pos) => {
      pos.bodyId = Math.floor(rng() * 3);
    });
  }

  const birds = [];
  const isAlienChunk = Math.abs(worldOffsetX) > 25000;
  if (!isAlienChunk && rng() < 0.2) {
    const baseX = worldOffsetX + (rng() - 0.5) * chunkSize;
    const baseZ = worldOffsetZ + (rng() - 0.5) * chunkSize;
    let baseY = getElevation(baseX, baseZ, elevParams) + 150 + rng() * 200;
    if (baseY > 400) baseY = 400;

    const baseRotationY = rng() * Math.PI * 2;
    const isSouth = worldOffsetZ > 0;
    const heightAtCenter = getElevation(worldOffsetX, worldOffsetZ, elevParams);
    const isBeach =
      heightAtCenter > WATER_LEVEL - 20 && heightAtCenter < WATER_LEVEL + 40;

    if (isSouth && isBeach && rng() < 0.3) {
      const numSeagulls = 2 + Math.floor(rng() * 4);
      const flockCenterX = worldOffsetX + (rng() - 0.5) * chunkSize;
      const flockCenterZ = worldOffsetZ + (rng() - 0.5) * chunkSize;
      const flockBaseY =
        getElevation(flockCenterX, flockCenterZ, elevParams) + 40 + rng() * 60;

      for (let i = 0; i < numSeagulls; i++) {
        birds.push({
          type: 'seagull',
          scale: 2.5 + rng() * 1.0,
          x: flockCenterX,
          y: flockBaseY,
          z: flockCenterZ,
          circleSpeed: 0.4 + rng() * 0.2,
          circleRadius: 50 + rng() * 80,
          circleCenter: {
            x: flockCenterX,
            y: flockBaseY + (rng() - 0.5) * 40,
            z: flockCenterZ,
          },
          angle: rng() * Math.PI * 2,
          flapPhase: rng() * Math.PI * 2,
          flapSpeed: 10.0 + rng() * 5.0,
          flapDuration: 2.0 + rng() * 2.0,
          soarDuration: 3.0 + rng() * 3.0,
          diveTimer: rng() * 10,
          nextDiveWait: 10.0 + rng() * 20.0,
        });
      }
    } else {
      birds.push({
        type: 'hawk',
        scale: 4.0,
        x: baseX,
        y: baseY,
        z: baseZ,
        rotY: baseRotationY,
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

  if (!isAlienChunk && rng() < 0.04) {
    const flockSize = 7 + Math.floor(rng() * 6);
    const baseX = worldOffsetX + (rng() - 0.5) * chunkSize;
    const baseZ = worldOffsetZ + (rng() - 0.5) * chunkSize;
    let baseY = getElevation(baseX, baseZ, elevParams) + 400 + rng() * 600;
    if (baseY > 1200) baseY = 1200;

    const baseRotationY = rng() * Math.PI * 2;
    const speed = 0.5 + rng() * 0.2;

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
        flapSpeed: 3.0 + rng() * 1.0,
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

  const chunkProps = {
    housePositions,
    twoStoryHousePositions,
    strawHutPositions,
    pagodaPositions,
    barnPositions,
    monasteryPositions,
    castleRuinsPositions,
    windmillPositions,
    sailboatPositions,
    pirateShipPositions,
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
        deciduousTreePositions.length + tallDeciduousTreePositions.length,
      trees_deciduous:
        deciduousTreePositions.length + tallDeciduousTreePositions.length,
      trees_palm: palmTreePositions.length,
      trees_dead: deadTreePositions.length,
      trees_autumn:
        autumnTree1Positions.length +
        autumnTree2Positions.length +
        autumnTree3Positions.length,
      trees_cherry: cherryTreePositions.length,
      trees_yellow_cortez: yellowCortezTreePositions.length,
      trees_mushroom: mushroomTreePositions.length,
      trees_japanese_maple: japaneseMapleTreePositions.length,
      rocks:
        rockPositions.length +
        snowRockPositions.length +
        desertRockPositions.length,
      bushes: bushPositions.length,
      snowmen: snowmanPositions.length,
      cactus: cactusPositions.length,
      lily_pads: lilyPadPositions.length,
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
        waterPositions,
        waterColors,
        waterDepths,
      },
      instanceData,
      chunkProps,
    },
    transferables,
  };
}
