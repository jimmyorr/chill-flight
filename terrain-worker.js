/* global importScripts, ChillFlightLogic, simplex */
// terrain-worker.js
// Procedural Terrain Web Worker (Phase 3: Elevation, Positions & Water Geometry)

if (typeof ChillFlightLogic === 'undefined') {
  importScripts('./noise.js', './chill-flight-logic.js');
}

function srgbToLinear(c) {
  return c < 0.04045
    ? c * 0.0773993808
    : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

class Color {
  constructor(hex = 0) {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.setHex(hex);
  }
  setHex(hex) {
    this.r = srgbToLinear(((hex >> 16) & 255) / 255);
    this.g = srgbToLinear(((hex >> 8) & 255) / 255);
    this.b = srgbToLinear((hex & 255) / 255);
    return this;
  }
  copy(c) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  }
  lerp(c, alpha) {
    this.r += (c.r - this.r) * alpha;
    this.g += (c.g - this.g) * alpha;
    this.b += (c.b - this.b) * alpha;
    return this;
  }
}

function getElevation(x, z, elevParams) {
  let n = ChillFlightLogic.getElevation(
    x,
    z,
    simplex,
    elevParams,
    (a, b, t) => a + (b - a) * t
  );

  // Add Montauk lighthouse island at chunk 5,2 (world 7500, 3000)
  const dx = x - 7500;
  const dz = z - 3000;
  const distSq = dx * dx + dz * dz;
  const islandRadius = 400;
  if (distSq < islandRadius * islandRadius) {
    const dist = Math.sqrt(distSq);
    const factor = 1.0 - dist / islandRadius;
    const sFactor = factor * factor * (3 - 2 * factor);
    const noise = simplex.noise2D(x * 0.002, z * 0.002) * 0.5 + 0.5;
    const irregularFactor = sFactor * (0.7 + noise * 0.3);
    n = Math.max(n, elevParams.WATER_LEVEL + 20 * irregularFactor);
  }
  return n;
}

self.onmessage = function (e) {
  const {id, chunkX, chunkZ, chunkSize, segments, elevParams} = e.data;

  try {
    const gridX1 = segments + 1;
    const totalVerts = gridX1 * gridX1;
    const halfSize = chunkSize / 2;
    const step = chunkSize / segments;
    const worldOffsetX = chunkX * chunkSize;
    const worldOffsetZ = chunkZ * chunkSize;

    const positions = new Float32Array(totalVerts * 3);
    const heightGrid = new Float32Array(totalVerts);

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
    const transferables = [positions.buffer, heightGrid.buffer];

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
          waterDepths[wIdx] = Math.max(
            0.0,
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

    self.postMessage(
      {
        id,
        chunkX,
        chunkZ,
        status: 'success',
        maxChunkHeight,
        hasWater,
        buffers: {
          terrainPositions: positions,
          heightGrid: heightGrid,
          waterPositions,
          waterColors,
          waterDepths,
        },
      },
      transferables
    );
  } catch (error) {
    self.postMessage({
      id,
      chunkX,
      chunkZ,
      status: 'error',
      error: error.message,
    });
  }
};
