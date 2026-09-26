/* global importScripts, ChillFlightLogic, simplex */
// terrain-worker.js
// Procedural Terrain Web Worker (Phase 2: Elevation & Positions)

if (typeof ChillFlightLogic === 'undefined') {
  importScripts('./noise.js', './chill-flight-logic.js');
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

    self.postMessage(
      {
        id,
        chunkX,
        chunkZ,
        status: 'success',
        maxChunkHeight,
        buffers: {
          terrainPositions: positions,
          heightGrid: heightGrid,
        },
      },
      [positions.buffer, heightGrid.buffer]
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
