// --- GLOBAL INSTANCING ARCHITECTURE ---
class GlobalInstanceManager {
  constructor() {
    this.types = new Map();
    this.group = new THREE.Group();
    this.group.name = 'GlobalInstances';
    scene.add(this.group);
    this._dirty = true;
    this.counts = new Map();
  }

  requestRebuild() {
    this._dirty = true;
  }

  registerType(type, geo, mat, maxInstances = 30000, useColor = false) {
    const instMesh = new THREE.InstancedMesh(geo, mat, maxInstances);
    instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (useColor) {
      instMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(maxInstances * 3),
        3
      );
      instMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    instMesh.visible = _enableObjects;
    instMesh.count = 0;
    instMesh.receiveShadow = true;
    instMesh.castShadow = true;
    this.group.add(instMesh);

    this.types.set(type, {
      mesh: instMesh,
      useColor: useColor,
      maxInstances: maxInstances,
    });
    this.counts.set(type, 0);
  }

  rebuildAll() {
    if (!this._dirty) return;
    this._dirty = false;

    for (const typeInfo of this.types.values()) {
      typeInfo.currentCount = 0;
    }

    chunks.forEach((chunk) => {
      const instanceData = chunk.userData.instanceData;
      if (!instanceData) return;

      for (const type in instanceData) {
        const typeInfo = this.types.get(type);
        if (!typeInfo) continue;

        const data = instanceData[type];
        const count = typeInfo.currentCount;
        const maxInstances = typeInfo.maxInstances;
        const numToCopy = Math.min(data.count, maxInstances - count);
        if (numToCopy <= 0) continue;

        const mesh = typeInfo.mesh;
        mesh.instanceMatrix.array.set(
          data.matrices.subarray(0, numToCopy * 16),
          count * 16
        );

        if (typeInfo.useColor) {
          mesh.instanceColor.array.set(
            data.colors.subarray(0, numToCopy * 3),
            count * 3
          );
        }

        typeInfo.currentCount = count + numToCopy;
      }
    });

    for (const typeInfo of this.types.values()) {
      const count = typeInfo.currentCount;
      typeInfo.mesh.count = count;
      if (count > 0) {
        if (typeInfo.mesh.instanceMatrix) {
          typeInfo.mesh.instanceMatrix.clearUpdateRanges();
          typeInfo.mesh.instanceMatrix.addUpdateRange(0, count * 16);
          typeInfo.mesh.instanceMatrix.needsUpdate = true;
        }
        if (typeInfo.useColor && typeInfo.mesh.instanceColor) {
          typeInfo.mesh.instanceColor.clearUpdateRanges();
          typeInfo.mesh.instanceColor.addUpdateRange(0, count * 3);
          typeInfo.mesh.instanceColor.needsUpdate = true;
        }
        typeInfo.mesh.visible = _enableObjects;
      } else {
        typeInfo.mesh.visible = false;
      }
    }
  }
}

var globalInstancer = new GlobalInstanceManager();
window.globalInstancer = globalInstancer;

class ChunkDataCollector {
  constructor() {
    this.data = {};
  }

  add(type, matrix, color = null) {
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

    d.matrices.set(matrix.elements, d.count * 16);

    if (color) {
      d.colors[d.count * 3] = color.r;
      d.colors[d.count * 3 + 1] = color.g;
      d.colors[d.count * 3 + 2] = color.b;
    }

    d.count++;
  }
}

// Register Tree types
globalInstancer.registerType('pineTrunk', treeTrunkGeo, treeTrunkMat);
globalInstancer.registerType(
  'pineLeaves',
  treeLeavesGeo,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('decidTrunk', deciduousGeos.trunk, treeTrunkMat);
globalInstancer.registerType(
  'decidLeaves',
  deciduousGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType(
  'tallDecidTrunk',
  tallDeciduousGeos.trunk,
  treeTrunkMat
);
globalInstancer.registerType(
  'tallDecidLeaves',
  tallDeciduousGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('palmTrunk', palmGeos.trunk, treeTrunkMat);
globalInstancer.registerType(
  'palmLeaves',
  palmGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType(
  'japaneseMapleTrunk',
  japaneseMapleGeos.trunk,
  treeTrunkMat
);
globalInstancer.registerType(
  'japaneseMapleLeaves',
  japaneseMapleGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType(
  'mushroomStalk',
  mushroomGeos.trunk,
  mushroomStalkMat
);
globalInstancer.registerType(
  'mushroomCap',
  mushroomGeos.leaves,
  treeLeavesBaseMat,
  30000,
  true
);
globalInstancer.registerType('deadTrunk', deadTreeGeo, deadTreeMat);
globalInstancer.registerType('rock', rockGeo, rockMat);
globalInstancer.registerType('snowRock', rockGeo, snowRockMat);
globalInstancer.registerType('desertRock', rockGeo, desertRockMat);
globalInstancer.registerType('cactus', cactusGeo, cactusMat);
globalInstancer.registerType('snowmanBody', snowmanGeos.body, snowmanBodyMat);
globalInstancer.registerType('snowmanNose', snowmanGeos.nose, snowmanNoseMat);
globalInstancer.registerType('iceberg', icebergMainGeo, icebergMat);
globalInstancer.registerType('iceFloe', iceFloeMainGeo, icebergMat);
globalInstancer.registerType('penguinBody', penguinBodyGeo, penguinBlackMat);
globalInstancer.registerType('penguinBelly', penguinBellyGeo, penguinWhiteMat);
globalInstancer.registerType('penguinHead', penguinHeadGeo, penguinBlackMat);
globalInstancer.registerType('penguinBeak', penguinBeakGeo, penguinOrangeMat);
globalInstancer.registerType('penguinWingL', penguinWingLGeo, penguinBlackMat);
globalInstancer.registerType('penguinWingR', penguinWingRGeo, penguinBlackMat);
globalInstancer.registerType('penguinFootL', penguinFootLGeo, penguinOrangeMat);
globalInstancer.registerType('penguinFootR', penguinFootRGeo, penguinOrangeMat);
globalInstancer.registerType('lilypad', lilyPadGeo, lilyPadMat);
globalInstancer.registerType('bush', bushGeo, bushBaseMat, 30000, true);

var _chunkHeightGrid = new Float32Array(65 * 65);

function* generateChunk(chunkX, chunkZ) {
  const checkYield = () => {
    if (
      window._chunkQueueStartTime &&
      window._chunkQueueTimeBudget &&
      performance.now() - window._chunkQueueStartTime >
        window._chunkQueueTimeBudget
    )
      return true;
    return false;
  };
  const collector = new ChunkDataCollector();
  const group = new THREE.Group();
  group.userData.chunkX = chunkX;
  group.userData.chunkZ = chunkZ;
  group.userData.worldPosition = new THREE.Vector3(
    chunkX * CHUNK_SIZE,
    0,
    chunkZ * CHUNK_SIZE
  );

  const rng = ChillFlightLogic.chunkRng(chunkX, chunkZ);
  const isCustom = !!ChillFlightLogic.customMap;

  // 1. Generate Terrain Mesh
  let geometry;
  while (
    _terrainGeometryPool.length > 0 &&
    _terrainGeometryPool[_terrainGeometryPool.length - 1].parameters
      .widthSegments !== SEGMENTS
  ) {
    _terrainGeometryPool.pop().dispose();
  }
  if (_terrainGeometryPool.length > 0) {
    geometry = _terrainGeometryPool.pop();
  } else {
    geometry = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      SEGMENTS,
      SEGMENTS
    );
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(
        new Float32Array(geometry.attributes.position.count * 3),
        3
      )
    );
  }
  geometry.userData = {unique: true, poolType: 'terrain'};

  const positions = geometry.attributes.position.array;
  const colors = geometry.attributes.color.array;
  let colorIdx = 0;
  const _tempColorObj = new THREE.Color();

  const worldOffsetX = chunkX * CHUNK_SIZE;
  const worldOffsetZ = chunkZ * CHUNK_SIZE;

  const treePositions = []; // Pines (Snow/Mountain)
  const deciduousTreePositions = []; // Standard green oak
  const tallDeciduousTreePositions = []; // Tall green oak
  const palmTreePositions = []; // Tropical
  const deadTreePositions = []; // Desert
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
  const isMontaukChunk = chunkX === 5 && chunkZ === 2;
  let bestMontaukPos = null;
  let fallbackMontaukPos = null;
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
  let hasWater = false;

  // Normalize density so higher SEGMENTS doesn't mean more trees/houses/etc
  const densityFactor = 40 / SEGMENTS;
  const densityScale = densityFactor * densityFactor;
  let maxChunkHeight = WATER_LEVEL;

  const gridX1 = SEGMENTS + 1;
  const totalVerts = gridX1 * gridX1;
  if (_chunkHeightGrid.length < totalVerts) {
    _chunkHeightGrid = new Float32Array(totalVerts);
  }

  // Pass 1: Compute height for all grid vertices once
  for (let vertIdx = 0; vertIdx < totalVerts; vertIdx++) {
    if (vertIdx % 200 === 0 && checkYield()) yield;
    const i = vertIdx * 3;
    const localX = positions[i];
    const localZ = positions[i + 2];
    const worldX = worldOffsetX + localX;
    const worldZ = worldOffsetZ + localZ;

    const height = getElevation(worldX, worldZ);
    _chunkHeightGrid[vertIdx] = height;
    positions[i + 1] = height;
    if (height > maxChunkHeight) maxChunkHeight = height;
  }

  const gridSpacing = CHUNK_SIZE / SEGMENTS;
  const invGridSpacing = 1.0 / gridSpacing;
  const invTwoGridSpacing = 0.5 / gridSpacing;

  for (let i = 0; i < positions.length; i += 3) {
    if (i % 300 === 0 && checkYield()) yield;
    const vertIdx = i / 3;
    const localX = positions[i];
    const localZ = positions[i + 2];
    const worldX = worldOffsetX + localX;
    const worldZ = worldOffsetZ + localZ;
    const isEast = worldX > 0;
    const isAlienLand = Math.abs(worldX) > 25000;
    const isEastAlien = isEast && isAlienLand;

    const height = _chunkHeightGrid[vertIdx];

    // --- ORGANIC TEXTURING & SLOPE LOGIC ---
    // 1. Calculate local slope using finite differences directly from the elevation grid
    const ix = vertIdx % gridX1;
    const iy = (vertIdx / gridX1) | 0;

    let slopeX;
    if (ix > 0 && ix < SEGMENTS) {
      slopeX =
        (_chunkHeightGrid[vertIdx + 1] - _chunkHeightGrid[vertIdx - 1]) *
        invTwoGridSpacing;
    } else if (ix === 0) {
      slopeX = (_chunkHeightGrid[vertIdx + 1] - height) * invGridSpacing;
    } else {
      slopeX = (height - _chunkHeightGrid[vertIdx - 1]) * invGridSpacing;
    }

    let slopeZ;
    if (iy > 0 && iy < SEGMENTS) {
      slopeZ =
        (_chunkHeightGrid[vertIdx + gridX1] -
          _chunkHeightGrid[vertIdx - gridX1]) *
        invTwoGridSpacing;
    } else if (iy === 0) {
      slopeZ = (_chunkHeightGrid[vertIdx + gridX1] - height) * invGridSpacing;
    } else {
      slopeZ = (height - _chunkHeightGrid[vertIdx - gridX1]) * invGridSpacing;
    }

    const slope = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);
    const slopeFactor = Math.min(1, slope * 0.5); // [0, 1] — steeper means higher factor

    // 2. Procedural Mottling (Multi-octave patches)
    const mottle1 = simplex.noise2D(worldX * 0.002, worldZ * 0.002);
    const mottle2 = simplex.noise2D(worldX * 0.01, worldZ * 0.01) * 0.3;
    const mottle = (mottle1 + mottle2 + 0.5) * 0.5; // Shifted [0, 1] range approx

    // 3. High-frequency micro-grain
    const grain = simplex.noise2D(worldX * 0.2, worldZ * 0.2) * 0.05;

    // --- EXTREME ZONE FACTOR (East/West beyond 10 degrees) ---
    const extremeEdgeWorld = 50000;
    const absWorldX = Math.abs(worldX);
    const extremeZoneFactor = Math.max(
      0,
      Math.min(1, (absWorldX - extremeEdgeWorld) / 15000)
    );
    // Smoothstep for a less abrupt transition
    const extremeBlend =
      extremeZoneFactor * extremeZoneFactor * (3 - 2 * extremeZoneFactor);

    // --- BIOME FACTORS ---
    const northInfluence = Math.max(0, -worldZ / 5000);
    // Add more noise to biome transitions to avoid smooth boring circles
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

    const temperature = noisePath - northInfluence * 1.5;
    const isSnowBiome = snowFactor > 0.5;

    // East code beachfront
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

    // --- COLOR ASSIGNMENT & FEATURE SPAWNING ---
    if (isCustom) {
      let finalHeight = height;
      // Altitude mapping (38.0 -> 125.5 range)
      if (height <= WATER_LEVEL + 5.0) {
        hasWater = true;
        _tempColorObj.copy(_colorSand);

        // Smooth dip from 5 units deep at water level to 0 at +5 units elevation
        // This ensures that shallow land stays underwater and avoids Z-fighting.
        const t = Math.max(0, Math.min(1, (height - WATER_LEVEL) / 5.0));
        const dip = 5.0 * (1.0 - t);
        finalHeight = height - dip;
      } else if (height > 105.0) {
        _tempColorObj.copy(_colorMountainTint);
      } else {
        _tempColorObj.copy(isForest ? _colorForest : _colorPlains);
        // Apply subtle mottling for custom maps too
        _tempColorObj.lerp(_colorBlack, mottle * 0.1);
      }
      positions[i + 1] = finalHeight;
    } else {
      if (height <= sandMaxHeight) {
        if (height <= WATER_LEVEL) {
          hasWater = true;
          if (_enableObjects) {
            if (rng() < 0.0001 * densityScale) {
              // Pirate Ship spawn
              if (
                height <= WATER_LEVEL + 0.1 && // depth check (compatible with custom maps)
                snowFactor < 0.2 // avoid frozen north
              ) {
                // open water check
                const eN = getElevation(worldX, worldZ - 300);
                const eS = getElevation(worldX, worldZ + 300);
                const eE = getElevation(worldX + 300, worldZ);
                const eW = getElevation(worldX - 300, worldZ);
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
                    bodyId: Math.floor(rng() * 4), // 4 sail colors
                  });
                }
              }
            } else if (rng() < 0.0005 * densityScale) {
              // Very rare sailboat
              sailboatPositions.push({
                x: localX,
                y: WATER_LEVEL,
                z: localZ,
                rotY: rng() * Math.PI * 2,
              });
            } else if (snowFactor > 0.5) {
              if (rng() < 0.0005 * densityScale) {
                // Iceberg
                icebergPositions.push({
                  x: localX,
                  y: WATER_LEVEL,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                });
              } else if (rng() < 0.00075 * densityScale) {
                // Ice floe
                iceFloePositions.push({
                  x: localX,
                  y: WATER_LEVEL,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                });
                // 0-3 penguins on the ice floe (sometimes none)
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
              getBiome(worldX, worldZ) > -0.15 &&
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
          if (!isCustom) {
            // Apply beach wave shaping to underwater shore
            const waveX = Math.sin(worldX * 0.05) * 0.5;
            const waveZ = Math.cos(worldZ * 0.05) * 0.5;
            positions[i + 1] += (waveX + waveZ) * 0.3;
          }
          positions[i + 1] = height - 5;
          _tempColorObj.copy(_colorSand).lerp(_colorWater, 0.15); // Submerged sand tinted with water
          if (snowFactor > 0)
            _tempColorObj.lerp(_colorSandSnowTint, snowFactor);
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

          // Mottling for sand (adding some dark/light patches)
          if (!isCustom && mottle > 0.6)
            _tempColorObj.lerp(_colorSandMottleHigh, (mottle - 0.6) * 0.5);
          if (!isCustom && mottle < 0.4)
            _tempColorObj.lerp(_colorSandMottleLow, (0.4 - mottle) * 0.5);
        }
      } else if (
        height > MOUNTAIN_LEVEL ||
        (snowFactor > 0.5 && height > MOUNTAIN_LEVEL - 50)
      ) {
        // Massive sierra gets highly refined, patchy-to-solid snow OR Arizona desert rock
        const sierraSnowNoise1 = simplex.noise2D(
          worldX * 0.003,
          worldZ * 0.003
        );
        const sierraSnowNoise2 =
          simplex.noise2D(worldX * 0.012, worldZ * 0.012) * 0.5;
        const organicNoise = sierraSnowNoise1 + sierraSnowNoise2;

        const isDesertMountain = !isCustom && desertFactor > 0.35;
        const canHaveSnow = !isDesertMountain;

        // In northern snowy biomes (snowFactor > 0.3), permanent snow blankets
        // the mountain massifs with exposed rock crags on sheer headwalls.
        // In temperate zones, snowline sits majestically at high altitude (around 1100-1250 units).
        let baseSnowline;
        if (snowFactor > 0.3) {
          baseSnowline = Math.max(WATER_LEVEL + 10, 300 - snowFactor * 400);
        } else if (isDesertMountain) {
          baseSnowline = 2400; // Extreme peaks only in desert
        } else {
          baseSnowline = 1150;
        }
        const snowline = baseSnowline + organicNoise * 180;

        // Sheer rock cliff face detection:
        // Snow clings to slopes up to ~65° (slopeFactor ~0.78-0.84).
        // Truly sheer vertical headwalls and couloir walls shed snow to expose dark granite crags.
        const cliffThreshold = snowFactor > 0.3 ? 0.84 : 0.78;
        const isSheerCliff = slopeFactor > cliffThreshold;
        const canHoldSnow =
          canHaveSnow && (!isSheerCliff || height > snowline + 300);

        if (canHoldSnow && height > snowline) {
          // Alpine snowcap & couloir snow
          const snowT = Math.min(1, (height - snowline) / 180);
          _tempColorObj.copy(_colorSnow);
          if (snowT < 1.0) {
            // Transition zone: patchy snow over rock
            const rockBase = isDesertMountain
              ? _colorDesertMountainRock
              : _colorMountainTint;
            _tempColorObj.lerp(rockBase, 1.0 - snowT);
          }
        } else if (height > 550 || isSheerCliff) {
          // Exposed alpine crags, cliffs, and rocky massifs
          if (isDesertMountain) {
            _tempColorObj.copy(_colorDesertMountainRock);
            if (desertFactor > 0.5) _tempColorObj.lerp(_colorDesertSand, 0.35);
            if (mottle > 0.7) _tempColorObj.lerp(_colorArizonaDark, 0.25);
          } else {
            // Alpine granite with geological strata and depth
            const strata =
              Math.sin(height * 0.025 + worldX * 0.0015 + worldZ * 0.001) *
              0.15;
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

            // Darken steep sheer cliff faces
            if (slopeFactor > 0.5) {
              const cliffDarken = Math.min(1, (slopeFactor - 0.5) * 2.2);
              _tempColorObj.lerp(_colorAlpineRockDark, cliffDarken * 0.5);
            }

            // Lower scree / talus slopes (transition between rock and foothills)
            if (height < 700 && slopeFactor > 0.25 && slopeFactor < 0.55) {
              _tempColorObj.lerp(_colorScree, 0.35);
            }
          }
        } else {
          // Mountain foothills and sub-alpine meadows
          if (isDesertMountain) {
            _tempColorObj.copy(_colorDesertSand);
            if (height > WATER_LEVEL + 5)
              _tempColorObj.lerp(_colorSandMottleHigh, 0.3);
            _tempColorObj.lerp(_colorDesertMottle, mottle * 0.2);
          } else if (snowFactor > 0.4) {
            _tempColorObj.copy(_colorForestSnowTint);
          } else {
            // Lush sub-alpine meadow / forest foothills
            _tempColorObj.copy(_colorForest);
            if (!isCustom) _tempColorObj.lerp(_colorForestDark, mottle * 0.3);
            // Subtle transition into mountain rock as altitude nears 550
            if (height > 400) {
              const rockBlend = (height - 400) / 150;
              _tempColorObj.lerp(_colorMountainTint, rockBlend * 0.5);
            }
          }
        }
      } else {
        // --- STANDARD LAND COLORING (Plains/Forest) ---
        if (isForest) {
          _tempColorObj.copy(_colorForest);
          if (snowFactor > 0)
            _tempColorObj.lerp(_colorForestSnowTint, snowFactor);
          if (desertFactor > 0)
            _tempColorObj.lerp(_colorForestDesertTint, desertFactor);

          // Mottling for Forest: Mix in some darker evergreens and lighter mossy patches
          _tempColorObj.lerp(_colorForestDeep, mottle * 0.4);
          if (mottle < 0.3) _tempColorObj.lerp(_colorForestLight, 0.2);
        } else {
          _tempColorObj.copy(_colorPlains);
          if (snowFactor > 0)
            _tempColorObj.lerp(_colorPlainsSnowTint, snowFactor);
          if (desertFactor > 0)
            _tempColorObj.lerp(_colorDesertSand, desertFactor);

          // Mottling for Plains: Dry grass vs lush grass
          _tempColorObj.lerp(_colorPlainsDark, mottle * 0.4);
          if (mottle > 0.8) _tempColorObj.lerp(_colorPlainsBright, 0.3);
        }
      }
    }

    // --- EXTREME ZONE COLOR BLEND ---
    // Gradually paint alien colors over whatever biome is underneath,
    // so the transition feels organic rather than a hard cut.
    if (extremeBlend > 0) {
      const colorWater = isEast ? _colorEasternWater : _colorWesternWater;
      const colorCliff = isEast ? _colorEasternCliff : _colorWesternCliff;
      const colorPeak = isEast ? _colorEasternPeak : _colorWesternPeak;
      const colorRock = isEast ? _colorEasternRock : _colorWesternRock;
      const colorLowland = isEast ? _colorEasternLowland : _colorWesternLowland;

      const baseLandColor = slopeFactor > 0.4 ? colorRock : colorLowland;

      if (height <= WATER_LEVEL) {
        // Neon cyan alien ocean / Magenta liquid
        _tempColorObj.lerp(colorWater, extremeBlend * 0.85);
      } else if (height < WATER_LEVEL + 4) {
        // Smoothly bleed the glowing water color onto the immediate shoreline
        const bleed = 1.0 - (height - WATER_LEVEL) / 4.0;
        const shoreColor = baseLandColor.clone().lerp(colorWater, bleed);
        _tempColorObj.lerp(shoreColor, extremeBlend * 0.85);
      } else if (height > MOUNTAIN_LEVEL) {
        // Acid yellow / indigo cliffs / White crystal / Fiery faults
        const peakFrac = Math.min(1, (height - MOUNTAIN_LEVEL) / 400);
        _tempColorObj.lerp(colorCliff, extremeBlend * 0.7);
        _tempColorObj.lerp(colorPeak, extremeBlend * peakFrac * 0.9);
      } else {
        // Mid-elevation: obsidian rock on slopes, teal lowland flat areas
        _tempColorObj.lerp(baseLandColor, extremeBlend * 0.75);
      }
    }

    // --- FROZEN NORTH ZONE ---
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

        // Generate a local mottle for the ice texturing
        const iceMottle = simplex.noise2D(worldX * 0.01, worldZ * 0.01);

        // If the physical height indicates this is the ice shelf (or land), force it to be white
        let isPhysicalIceShelf = false;
        let visualFreeze = freezeFactor;
        if (height >= WATER_LEVEL + 2.8) {
          visualFreeze = Math.max(visualFreeze, 0.95);
          isPhysicalIceShelf = true;
        }

        // Blend everything toward snow/ice. If it's the physical ice shelf, use pure white so it doesn't look like teal water.
        const targetColor = isPhysicalIceShelf
          ? new THREE.Color(0xffffff)
          : _colorPackIce;
        _tempColorObj.lerp(targetColor, visualFreeze);

        if (iceMottle > 0) {
          _tempColorObj.lerpHSL(
            new THREE.Color(0xffffff),
            iceMottle * 0.15 * visualFreeze
          );
        } else {
          _tempColorObj.lerpHSL(
            new THREE.Color(0x8a9ea8),
            -iceMottle * 0.15 * freezeFactor
          );
        }

        // Smoothly blend in cyan ice near the water level
        const iceBlend = Math.max(
          0,
          Math.min(1, (WATER_LEVEL + 10 - height) / 10)
        );
        if (iceBlend > 0) {
          _tempColorObj.lerp(_colorIce, freezeFactor * iceBlend);
        }
      }
    }

    // --- LAND TYPE CLASSIFICATION ---
    const isStandardLand =
      !isCustom &&
      height > sandMaxHeight &&
      height <= MOUNTAIN_LEVEL + (snowFactor > 0.5 ? -50 : 0);
    const isCustomLand =
      isCustom && height > WATER_LEVEL + 5.0 && height < 105.0;

    // --- BIOME TINTING (Autumn/Cherry) ---
    if ((isStandardLand || isCustomLand) && snowFactor < 0.2 && !isFrozen) {
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

    if (
      _enableObjects &&
      (isStandardLand || isCustomLand || isAlienVegetationLand) &&
      !isFrozen &&
      !isOnRoad
    ) {
      if (isForest) {
        const treeRoll = rng();
        if (isAlienLand) {
          if (isEast) {
            // Eastern alien biome: ONLY tree-sized mushrooms with diverse scales and vibrant cap colors
            if (treeRoll < 0.032 * densityScale) {
              const scaleRoll = rng();
              let scale;
              if (scaleRoll < 0.25) {
                scale = 0.5 + rng() * 0.4; // 0.5 - 0.9 (small understory)
              } else if (scaleRoll < 0.8) {
                scale = 1.0 + rng() * 1.0; // 1.0 - 2.0 (standard tree-sized)
              } else {
                scale = 2.2 + rng() * 2.3; // 2.2 - 4.5 (towering giant canopy)
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
          // Western alien biome: no trees or mushrooms (completely barren crystalline/fiery biome)
        } else if (
          treeRoll <
          (desertFactor > 0.5 ? 0.05 : 0.15) * densityScale
        ) {
          const isIsland = worldX > 3000 && getBiome(worldX, worldZ) < -0.1;
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
                // 25% chance of tall deciduous tree
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
          const h = getElevation(worldX + offX, worldZ + offZ);
          campfirePositions.push({x: localX + offX, y: h, z: localZ + offZ});
        }
      } else {
        if (isEastAlien) {
          // Scattered individual mushrooms in open alien plains
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
            const isIsland = worldX > 3000 && getBiome(worldX, worldZ) < -0.1;
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
                // Chimney smoke for houses in snowy areas
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
            !isMontaukChunk &&
            !lighthousePos &&
            rng() < 0.0004 * densityScale &&
            height < sandMaxHeight + 15
          ) {
            const hN = getElevation(worldX, worldZ - 50);
            const hS = getElevation(worldX, worldZ + 50);
            const hE = getElevation(worldX + 50, worldZ);
            const hW = getElevation(worldX - 50, worldZ);
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
            const hN = getElevation(worldX, worldZ - 20);
            const hS = getElevation(worldX, worldZ + 20);
            const hE = getElevation(worldX + 20, worldZ);
            const hW = getElevation(worldX - 20, worldZ);
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
        // Decorate pagoda with Japanese maples to create a beautiful zen garden
        const offset1X = -12;
        const offset1Z = 12;
        const h1 = getElevation(worldX + offset1X, worldZ + offset1Z);
        japaneseMapleTreePositions.push({
          x: localX + offset1X,
          y: h1,
          z: localZ + offset1Z,
        });

        const offset2X = 12;
        const offset2Z = -12;
        const h2 = getElevation(worldX + offset2X, worldZ + offset2Z);
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

    // --- FINAL DETAIL PASS ---
    // Apply cliff rock to steep lowland bluffs and riverbanks without overwriting mountain snow & crags
    if (
      height <= MOUNTAIN_LEVEL &&
      slopeFactor > 0.45 &&
      height > WATER_LEVEL + 5
    ) {
      const cliffBlend = Math.min(1, (slopeFactor - 0.45) * 5.0);
      const isSouthBiome = !isCustom && desertFactor > 0.3;
      const rockColor = isSouthBiome ? _colorCliffSouth : _colorMountainTint;
      _tempColorObj.lerp(rockColor, cliffBlend);
      _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.15);
    } else if (height <= MOUNTAIN_LEVEL && slopeFactor > 0.1) {
      _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.3);
    }

    if (!isCustom) {
      _tempColorObj.multiplyScalar(1.0 + grain);
    }

    // --- VOLCANO TEXTURING ---
    if (distToVolcano < 2000) {
      const vFactor = Math.max(0, Math.min(1, (2000 - distToVolcano) / 1000));
      const basaltColor = _colorVolcanoBasaltHi
        .clone()
        .lerp(_colorVolcanoBasaltLo, height / 1400);
      _tempColorObj.lerp(basaltColor, vFactor);
    }

    // --- EAST COAST ROAD REMOVED ---

    colors[colorIdx++] = _tempColorObj.r;
    colors[colorIdx++] = _tempColorObj.g;
    colors[colorIdx++] = _tempColorObj.b;
  }

  if (isMontaukChunk) {
    lighthousePos = {
      x: 0,
      y: getElevation(7500, 3000),
      z: 0,
      rotY: rng() * Math.PI * 2,
    };
    console.log(
      `[Lighthouse] Placed Montauk lighthouse at fixed position (0, ${lighthousePos.y}, 0)`
    );
  }

  const archSeededRng = ChillFlightLogic.mulberry32(
    ChillFlightLogic.WORLD_SEED
  );
  const archTargetZ = archSeededRng() * 10000 - 5000;
  const archTargetChunkZ = Math.round(archTargetZ / CHUNK_SIZE);

  if (chunkX === 2 && chunkZ === archTargetChunkZ && _enableObjects) {
    if (rockArchPositions.length === 0 && rockArchGrassPositions.length === 0) {
      const localArchZ = archTargetZ - worldOffsetZ;
      const archHeight = Math.max(
        WATER_LEVEL,
        getElevation(worldOffsetX, worldOffsetZ + localArchZ)
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
      group.userData.rockArch = {
        x: worldOffsetX + archPos.x,
        y: archPos.y,
        z: worldOffsetZ + archPos.z,
        rotY: archPos.rotY,
      };

      // Guarantee a pirate ship spawns nearby in a water spot
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
        const h = getElevation(wX, wZ);
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

  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.color.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (checkYield()) yield;

  // 2.99 Volcano Landmark Details
  // Must run BEFORE the early-exit guard to avoid the async race where the chunk
  // gets evicted while building, which would prevent these from ever being added.
  // Added directly to `scene` (not the chunk group) so they survive chunk reloads.
  {
    const vX = VOLCANO_X;
    const vZ = VOLCANO_Z;
    const isVolcanoChunk =
      Math.abs(vX - worldOffsetX) <= CHUNK_SIZE / 2 &&
      Math.abs(vZ - worldOffsetZ) <= CHUNK_SIZE / 2;

    if (isVolcanoChunk) {
      const craterBottom = getElevation(vX, vZ);

      // Sample the edges of the lava disk (radius 280) to ensure the river didn't carve the side
      const northEdge = getElevation(vX, vZ - 300);
      const southEdge = getElevation(vX, vZ + 300);
      const eastEdge = getElevation(vX + 300, vZ);
      const westEdge = getElevation(vX - 300, vZ);
      const minElevation = Math.min(
        craterBottom,
        northEdge,
        southEdge,
        eastEdge,
        westEdge
      );

      // If any part of the crater's footprint is extremely low, a river has carved through the volcano.
      // We shouldn't place hovering lava or spotlights in the middle of a river gorge.
      if (minElevation > 500) {
        // Lava disk
        const vElements = ModelAssembler.getStructure(
          'volcano_active_elements'
        );
        vElements.forEach((part) => {
          const mesh = new THREE.Mesh(part.geo, part.mat);
          // Position relative to crater bottom. Yesterday's seed gave height ~1070.
          // Hardcoded 890 was ~180 below crater bottom. We preserve that offset.
          mesh.position.set(
            vX + part.pos[0],
            craterBottom - 180,
            vZ + part.pos[2]
          );
          mesh.rotation.set(...part.rot);
          if (part.scale) mesh.scale.set(...part.scale);
          group.add(mesh);
        });

        // Spot light pointing up to cast a glow on the crater walls
        // three.js r155+ uses physical light units (candela). Converted from
        // the legacy-tuned 30.0 to preserve the glow at ~200 m (decay was and
        // remains 1). Verify visually.
        const sLight = new THREE.SpotLight(
          0xff4500,
          5600,
          3000,
          Math.PI / 6,
          0.5,
          1
        );
        // Place spotlight slightly above crater bottom to avoid being buried
        sLight.position.set(vX, craterBottom + 10, vZ);
        const sTarget = new THREE.Object3D();
        sTarget.position.set(vX, 2000, vZ);
        group.add(sTarget);
        sLight.target = sTarget;
        group.add(sLight);
      }
    }
  }

  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.position.set(worldOffsetX, 0, worldOffsetZ);
  group.add(mesh);

  // 1.5 Generate Water Plane
  if (hasWater) {
    const wSegments = Math.max(1, Math.floor(SEGMENTS / 4));
    let waterGeo;
    while (
      _waterGeometryPool.length > 0 &&
      _waterGeometryPool[_waterGeometryPool.length - 1].parameters
        .widthSegments !== wSegments
    ) {
      _waterGeometryPool.pop().dispose();
    }
    if (_waterGeometryPool.length > 0) {
      waterGeo = _waterGeometryPool.pop();
    } else {
      waterGeo = new THREE.PlaneGeometry(
        CHUNK_SIZE,
        CHUNK_SIZE,
        wSegments,
        wSegments
      );
      waterGeo.rotateX(-Math.PI / 2);
      waterGeo.setAttribute(
        'color',
        new THREE.BufferAttribute(
          new Float32Array(waterGeo.attributes.position.count * 3),
          3
        )
      );
      waterGeo.setAttribute(
        'aWaterDepth',
        new THREE.BufferAttribute(
          new Float32Array(waterGeo.attributes.position.count),
          1
        )
      );
    }
    waterGeo.userData = {unique: true, poolType: 'water'};
    const wPositions = waterGeo.attributes.position.array;
    const wColors = waterGeo.attributes.color.array;
    const wDepths = waterGeo.attributes.aWaterDepth.array;
    let wColorIdx = 0;
    const _tempWColorObj = new THREE.Color();
    for (let i = 0; i < wPositions.length; i += 3) {
      const worldX = worldOffsetX + wPositions[i];
      const worldZ = worldOffsetZ + wPositions[i + 2];
      const wIdx = i / 3;

      wPositions[i + 1] = WATER_LEVEL;

      const terrainHeight = getElevation(worldX, worldZ);
      wDepths[wIdx] = Math.max(0.0, WATER_LEVEL - terrainHeight);

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

      _tempWColorObj.copy(_colorWater);
      if (snowFactor > 0) _tempWColorObj.lerp(_colorIcyWater, snowFactor);
      if (desertFactor > 0)
        _tempWColorObj.lerp(_colorDesertWater, desertFactor);

      wColors[wColorIdx++] = _tempWColorObj.r;
      wColors[wColorIdx++] = _tempWColorObj.g;
      wColors[wColorIdx++] = _tempWColorObj.b;
    }
    waterGeo.attributes.position.needsUpdate = true;
    waterGeo.attributes.color.needsUpdate = true;
    waterGeo.attributes.aWaterDepth.needsUpdate = true;
    waterGeo.computeBoundingBox();
    waterGeo.computeBoundingSphere();
    const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
    waterMesh.position.set(worldOffsetX, 0, worldOffsetZ);
    group.add(waterMesh);
    group.userData.water = waterMesh; // accessible for animation!
  }
  if (checkYield()) yield;

  // 1.6 Dedicated group for procedural objects (trees, houses, etc.)
  // This allows for bulk toggling visibility via the debug menu.
  const objectsGroup = new THREE.Group();
  objectsGroup.position.set(-worldOffsetX, 0, -worldOffsetZ); // Counter-shift for children
  const emptyLODGroup = new THREE.Group();

  const objectsLOD = new THREE.LOD();
  objectsLOD.position.set(worldOffsetX, 0, worldOffsetZ); // Correct position for distance calculation
  objectsLOD.addLevel(objectsGroup, 0);

  // Cull small chunk-local props (houses, chimneys, doors, boats) beyond 4,200 units
  // while trees continue to render globally via GlobalInstanceManager without pop-in
  const maxPropLOD =
    window.manualPropLOD !== undefined
      ? window.manualPropLOD
      : typeof PROP_LOD_DISTANCE !== 'undefined'
        ? PROP_LOD_DISTANCE
        : 4200;
  const lodMultiplier =
    typeof window.performanceMonitor !== 'undefined' &&
    window.performanceMonitor &&
    typeof window.performanceMonitor.lodMultiplier === 'number'
      ? window.performanceMonitor.lodMultiplier
      : 1.0;
  const lodDistance =
    (window.manualPropLOD !== undefined
      ? window.manualPropLOD
      : Math.min(RENDER_DISTANCE * CHUNK_SIZE - CHUNK_SIZE / 2, maxPropLOD)) *
    lodMultiplier;
  objectsLOD.addLevel(emptyLODGroup, lodDistance);
  objectsLOD.visible = _enableObjects;

  group.add(objectsLOD);
  group.userData.objectsGroup = objectsLOD;

  // 2. Generate Trees
  const dummy = new THREE.Object3D();

  // Helper for rendering instanced trees with latitude-based snow coloring
  const _tempColor = new THREE.Color();
  const _snowColor = new THREE.Color(0xe0f7fa);
  const _baseColorObj = new THREE.Color();

  const renderTrees = (positions, trunkKey, leavesKey, baseLeafColor) => {
    if (positions.length === 0) return;

    positions.forEach((pos) => {
      const worldZ = worldOffsetZ + pos.z;
      const northInfluence = Math.max(0, -worldZ / 4000);

      const tempNoise = simplex.noise2D(
        (worldOffsetX + pos.x) * 0.0001,
        worldZ * 0.0001
      );
      // Fix smooth snow blending (matching terrain snowFactor logic)
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

      dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();

      if (trunkKey) collector.add(trunkKey, dummy.matrix);

      if (leavesKey && baseLeafColor) {
        // Add slight random color variation per tree
        const rVariation = (rng() - 0.5) * 0.1;
        const gVariation = (rng() - 0.5) * 0.1;
        const bVariation = (rng() - 0.5) * 0.1;

        // Use a reused temporary color for the variation without allocating new objects
        const leafHex = pos.color !== undefined ? pos.color : baseLeafColor;
        _baseColorObj.setHex(leafHex);
        _baseColorObj.r = Math.max(
          0,
          Math.min(1, _baseColorObj.r + rVariation)
        );
        _baseColorObj.g = Math.max(
          0,
          Math.min(1, _baseColorObj.g + gVariation)
        );
        _baseColorObj.b = Math.max(
          0,
          Math.min(1, _baseColorObj.b + bVariation)
        );

        // Set leaf color: base leaf color lerped toward snow-white based on snowFactor
        _tempColor.copy(_baseColorObj);
        if (snowFactor > 0 && leavesKey !== 'mushroomCap') {
          _tempColor.lerp(_snowColor, snowFactor);
        }
        collector.add(leavesKey, dummy.matrix, _tempColor);
      }
    });
  };

  // Render variations
  renderTrees(treePositions, 'pineTrunk', 'pineLeaves', 0x1b5e20);
  renderTrees(snowTreePositions, 'pineTrunk', 'pineLeaves', 0x1b5e20);
  renderTrees(deciduousTreePositions, 'decidTrunk', 'decidLeaves', 0x1b5e20);
  renderTrees(
    tallDeciduousTreePositions,
    'tallDecidTrunk',
    'tallDecidLeaves',
    0x1a451d
  );
  if (checkYield()) yield;
  renderTrees(palmTreePositions, 'palmTrunk', 'palmLeaves', 0x689f38);
  renderTrees(cherryTreePositions, 'decidTrunk', 'decidLeaves', 0xf8bbd0);
  renderTrees(autumnTree1Positions, 'decidTrunk', 'decidLeaves', 0xd35400);
  renderTrees(autumnTree2Positions, 'decidTrunk', 'decidLeaves', 0xf39c12);
  renderTrees(autumnTree3Positions, 'decidTrunk', 'decidLeaves', 0xc0392b);
  renderTrees(yellowCortezTreePositions, 'decidTrunk', 'decidLeaves', 0xffeb3b);
  renderTrees(mushroomTreePositions, 'mushroomStalk', 'mushroomCap', 0x9c27b0); // Vibrant purple caps
  renderTrees(
    japaneseMapleTreePositions,
    'japaneseMapleTrunk',
    'japaneseMapleLeaves',
    0xa31515
  );
  if (checkYield()) yield;

  if (deadTreePositions.length > 0) {
    deadTreePositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.8;
      dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      collector.add('deadTrunk', dummy.matrix);
    });
  }

  // 2.3 Generate Rocks
  const rockVariations = [
    {pos: rockPositions, key: 'rock'},
    {pos: snowRockPositions, key: 'snowRock'},
    {pos: desertRockPositions, key: 'desertRock'},
  ];

  rockVariations.forEach((variation) => {
    if (variation.pos.length > 0) {
      variation.pos.forEach((pos) => {
        // Random scale between 0.5 and 2.5 on each axis for uniquely shaped boulders
        const sx = 0.5 + rng() * 2.0;
        const sy = 0.5 + rng() * 2.0;
        const sz = 0.5 + rng() * 2.0;

        // Random rotation
        dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
        dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix();

        collector.add(variation.key, dummy.matrix);
      });
    }
  });
  if (checkYield()) yield;

  // 2.3b Generate Rock Arches (Unique instances)
  if (rockArchPositions.length > 0) {
    rockArchPositions.forEach((pos) => {
      const geos = createRockArchGeometries(rng);
      const mesh = new THREE.Mesh(geos.rock, rockMat);
      mesh.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      mesh.rotation.y = pos.rotY;

      // Store unique geometries so they can be disposed
      mesh.geometry.userData.unique = true;
      geos.grass.dispose(); // Unused in this variant

      group.add(mesh);
    });
  }

  if (rockArchGrassPositions.length > 0) {
    rockArchGrassPositions.forEach((pos) => {
      const geos = createRockArchGeometries(rng);

      const rockMesh = new THREE.Mesh(geos.rock, rockMat);
      rockMesh.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      rockMesh.rotation.y = pos.rotY;
      rockMesh.geometry.userData.unique = true;

      const grassMesh = new THREE.Mesh(geos.grass, rockArchGrassMat);
      grassMesh.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      grassMesh.rotation.y = pos.rotY;
      grassMesh.geometry.userData.unique = true;

      group.add(rockMesh);
      group.add(grassMesh);
    });
  }

  // 2.4 Generate Cactuses
  if (cactusPositions.length > 0) {
    cactusPositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.6;
      dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      collector.add('cactus', dummy.matrix);
    });
  }

  // 2.45 Generate Snowmen
  if (snowmanPositions.length > 0) {
    snowmanPositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.4;
      dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      collector.add('snowmanBody', dummy.matrix);
      collector.add('snowmanNose', dummy.matrix);
    });
  }

  // 2.46 Generate Icebergs, Ice Floes, and Penguins
  if (icebergPositions.length > 0) {
    icebergPositions.forEach((pos) => {
      // Main iceberg
      dummy.position.set(worldOffsetX + pos.x, pos.y - 4, worldOffsetZ + pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      collector.add('iceberg', dummy.matrix);

      // Small 1
      const offset1 = new THREE.Vector3(14, -4, 6).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        worldOffsetX + pos.x + offset1.x,
        pos.y - 8,
        worldOffsetZ + pos.z + offset1.z
      );
      dummy.rotation.set(0, pos.rotY + 1.2, 0);
      dummy.scale.set(0.5, 0.4, 0.5);
      dummy.updateMatrix();
      collector.add('iceberg', dummy.matrix);

      // Small 2
      const offset2 = new THREE.Vector3(-12, -5, -8).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        worldOffsetX + pos.x + offset2.x,
        pos.y - 9,
        worldOffsetZ + pos.z + offset2.z
      );
      dummy.rotation.set(0, pos.rotY - 0.8, 0);
      dummy.scale.set(0.4, 0.3, 0.4);
      dummy.updateMatrix();
      collector.add('iceberg', dummy.matrix);
    });
  }

  if (iceFloePositions.length > 0) {
    iceFloePositions.forEach((pos) => {
      // Main floe
      dummy.position.set(worldOffsetX + pos.x, pos.y - 1, worldOffsetZ + pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      collector.add('iceFloe', dummy.matrix);

      // Small 1
      const offset1 = new THREE.Vector3(16, -0.8, 4).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        worldOffsetX + pos.x + offset1.x,
        pos.y - 1.8,
        worldOffsetZ + pos.z + offset1.z
      );
      dummy.rotation.set(0, pos.rotY + 0.5, 0);
      dummy.scale.set(0.5, 0.6, 0.5);
      dummy.updateMatrix();
      collector.add('iceFloe', dummy.matrix);

      // Small 2
      const offset2 = new THREE.Vector3(-15, -1, -6).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        worldOffsetX + pos.x + offset2.x,
        pos.y - 2,
        worldOffsetZ + pos.z + offset2.z
      );
      dummy.rotation.set(0, pos.rotY - 0.5, 0);
      dummy.scale.set(0.4, 0.5, 0.4);
      dummy.updateMatrix();
      collector.add('iceFloe', dummy.matrix);
    });
  }

  if (penguinPositions.length > 0) {
    penguinPositions.forEach((pos) => {
      const scale = 0.8 + rng() * 0.4;
      dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      collector.add('penguinBody', dummy.matrix);
      collector.add('penguinBelly', dummy.matrix);
      collector.add('penguinHead', dummy.matrix);
      collector.add('penguinBeak', dummy.matrix);
      collector.add('penguinWingL', dummy.matrix);
      collector.add('penguinWingR', dummy.matrix);
      collector.add('penguinFootL', dummy.matrix);
      collector.add('penguinFootR', dummy.matrix);
    });
  }

  // 2.47 Generate Lily Pads
  if (lilyPadPositions.length > 0) {
    lilyPadPositions.forEach((pos) => {
      const scale = 0.6 + rng() * 0.8;
      dummy.position.set(
        worldOffsetX + pos.x,
        pos.y + 0.15,
        worldOffsetZ + pos.z
      ); // Slightly above water to prevent Z-fighting
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      collector.add('lilypad', dummy.matrix);
    });
  }

  // 2.48 Generate Bushes
  if (bushPositions.length > 0) {
    bushPositions.forEach((pos) => {
      const scale = 0.5 + rng() * 1.5; // High variance in bush sizes
      dummy.position.set(worldOffsetX + pos.x, pos.y, worldOffsetZ + pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();

      // Base bush green: 0x558b2f
      const rVariation = (rng() - 0.5) * 0.15;
      const gVariation = (rng() - 0.5) * 0.15;
      const bVariation = (rng() - 0.5) * 0.15;

      const baseBushColor = new THREE.Color(0x558b2f);
      baseBushColor.r = Math.max(0, Math.min(1, baseBushColor.r + rVariation));
      baseBushColor.g = Math.max(0, Math.min(1, baseBushColor.g + gVariation));
      baseBushColor.b = Math.max(0, Math.min(1, baseBushColor.b + bVariation));

      collector.add('bush', dummy.matrix, baseBushColor);
    });
  }
  if (checkYield()) yield;

  // 2.5 Generate Houses
  if (housePositions.length > 0) {
    const numBodyColors = houseBodyPalette.length;
    const numRoofColors = houseRoofPalette.length;

    // Count houses per (body, roof) combo
    const comboCounts = {};
    const houseCombo = [];
    housePositions.forEach((pos, idx) => {
      const bodyId = Math.floor(rng() * numBodyColors);
      const roofId = Math.floor(rng() * numRoofColors);
      const key = `${bodyId}_${roofId}`;
      houseCombo[idx] = {bodyId, roofId, key};
      comboCounts[key] = (comboCounts[key] || 0) + 1;
    });

    // Build one InstancedMesh pair per combo that actually appears
    const bodyInsts = {};
    const roofInsts = {};
    const comboIndices = {};
    for (const key of Object.keys(comboCounts)) {
      const [bodyId, roofId] = key.split('_').map(Number);
      bodyInsts[key] = getInstancedMesh(
        houseBodyGeo,
        houseBodyPalette[bodyId],
        comboCounts[key]
      );
      roofInsts[key] = getInstancedMesh(
        houseRoofGeo,
        houseRoofPalette[roofId],
        comboCounts[key]
      );
      bodyInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      roofInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(bodyInsts[key]);
      objectsGroup.add(roofInsts[key]);
      comboIndices[key] = 0;
    }

    const windowPools = [];
    const poolCounts = [0, 0, 0, 0, 0];
    const houseToPool = [];

    housePositions.forEach((pos, idx) => {
      const poolId = Math.floor(rng() * 5);
      houseToPool[idx] = poolId;
      poolCounts[poolId]++;
    });

    for (let i = 0; i < 5; i++) {
      if (poolCounts[i] > 0) {
        windowPools[i] = getInstancedMesh(
          houseWindowGeo,
          houseWindowMats[i],
          poolCounts[i] * 3
        );
        windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(windowPools[i]);
      }
    }

    const doorInst = getInstancedMesh(
      houseDoorGeo,
      houseDoorMat,
      housePositions.length
    );
    const chimneyInst = getInstancedMesh(
      houseChimneyGeo,
      houseChimneyMat,
      housePositions.length
    );
    doorInst.position.set(worldOffsetX, 0, worldOffsetZ);
    chimneyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(doorInst);
    objectsGroup.add(chimneyInst);

    const poolIndices = [0, 0, 0, 0, 0];

    housePositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      const {key} = houseCombo[index];
      const ci = comboIndices[key];
      bodyInsts[key].setMatrixAt(ci, dummy.matrix);
      roofInsts[key].setMatrixAt(ci, dummy.matrix);
      comboIndices[key]++;

      const poolId = houseToPool[index];
      const pIdx = poolIndices[poolId];

      const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + doorOffset.x,
        pos.y + doorOffset.y,
        pos.z + doorOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      doorInst.setMatrixAt(index, dummy.matrix);

      const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + chimneyOffset.x,
        pos.y + chimneyOffset.y,
        pos.z + chimneyOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      chimneyInst.setMatrixAt(index, dummy.matrix);

      const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );

      dummy.position.set(
        pos.x + winF1Offset.x,
        pos.y + winF1Offset.y,
        pos.z + winF1Offset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      windowPools[poolId].setMatrixAt(pIdx * 3, dummy.matrix);

      dummy.position.set(
        pos.x + winF2Offset.x,
        pos.y + winF2Offset.y,
        pos.z + winF2Offset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      windowPools[poolId].setMatrixAt(pIdx * 3 + 1, dummy.matrix);

      dummy.position.set(
        pos.x + winBOffset.x,
        pos.y + winBOffset.y,
        pos.z + winBOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      windowPools[poolId].setMatrixAt(pIdx * 3 + 2, dummy.matrix);

      poolIndices[poolId]++;
    });
  }

  // 2.52 Generate Two Story Houses
  if (twoStoryHousePositions.length > 0) {
    const numBodyColors = houseBodyPalette.length;
    const numRoofColors = houseRoofPalette.length;

    const comboCounts = {};
    const houseCombo = [];
    twoStoryHousePositions.forEach((pos, idx) => {
      const bodyId = Math.floor(rng() * numBodyColors);
      const roofId = Math.floor(rng() * numRoofColors);
      const key = `${bodyId}_${roofId}`;
      houseCombo[idx] = {bodyId, roofId, key};
      comboCounts[key] = (comboCounts[key] || 0) + 1;
    });

    const bodyInsts = {};
    const roofInsts = {};
    const comboIndices = {};
    for (const key of Object.keys(comboCounts)) {
      const [bodyId, roofId] = key.split('_').map(Number);
      bodyInsts[key] = getInstancedMesh(
        twoStoryBodyGeo,
        houseBodyPalette[bodyId],
        comboCounts[key]
      );
      roofInsts[key] = getInstancedMesh(
        twoStoryRoofGeo,
        houseRoofPalette[roofId],
        comboCounts[key]
      );
      bodyInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      roofInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(bodyInsts[key]);
      objectsGroup.add(roofInsts[key]);
      comboIndices[key] = 0;
    }

    const windowPools = [];
    const poolCounts = [0, 0, 0, 0, 0];
    const houseToPool = [];

    twoStoryHousePositions.forEach((pos, idx) => {
      const poolId = Math.floor(rng() * 5);
      houseToPool[idx] = poolId;
      poolCounts[poolId]++;
    });

    for (let i = 0; i < 5; i++) {
      if (poolCounts[i] > 0) {
        windowPools[i] = getInstancedMesh(
          houseWindowGeo,
          houseWindowMats[i],
          poolCounts[i] * 8
        );
        windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(windowPools[i]);
      }
    }

    const doorInst = getInstancedMesh(
      houseDoorGeo,
      houseDoorMat,
      twoStoryHousePositions.length
    );
    const chimneyInst = getInstancedMesh(
      twoStoryChimneyGeo,
      houseChimneyMat,
      twoStoryHousePositions.length
    );
    doorInst.position.set(worldOffsetX, 0, worldOffsetZ);
    chimneyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(doorInst);
    objectsGroup.add(chimneyInst);

    const poolIndices = [0, 0, 0, 0, 0];

    twoStoryHousePositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      const {key} = houseCombo[index];
      const ci = comboIndices[key];
      bodyInsts[key].setMatrixAt(ci, dummy.matrix);
      roofInsts[key].setMatrixAt(ci, dummy.matrix);
      comboIndices[key]++;

      const poolId = houseToPool[index];
      const pIdx = poolIndices[poolId];

      const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + doorOffset.x,
        pos.y + doorOffset.y,
        pos.z + doorOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      doorInst.setMatrixAt(index, dummy.matrix);

      const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      dummy.position.set(
        pos.x + chimneyOffset.x,
        pos.y + chimneyOffset.y,
        pos.z + chimneyOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      chimneyInst.setMatrixAt(index, dummy.matrix);

      const offsets = [
        new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(0, 4, -5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(0, 10, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(-3.0, 10, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(3.0, 10, 5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(-3.0, 10, -5.1).applyAxisAngle(yAxis, pos.rotY),
        new THREE.Vector3(3.0, 10, -5.1).applyAxisAngle(yAxis, pos.rotY),
      ];

      offsets.forEach((offset, i) => {
        dummy.position.set(
          pos.x + offset.x,
          pos.y + offset.y,
          pos.z + offset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        windowPools[poolId].setMatrixAt(pIdx * 8 + i, dummy.matrix);
      });

      poolIndices[poolId]++;
    });
  }

  // 2.55 Generate Straw Huts (islands)
  if (strawHutPositions.length > 0) {
    const strawHutBodyInst = getInstancedMesh(
      strawHutBodyGeo,
      strawHutMat,
      strawHutPositions.length
    );
    const strawHutRoofInst = getInstancedMesh(
      strawHutRoofGeo,
      strawHutMat,
      strawHutPositions.length
    );
    strawHutPositions.forEach((pos, i) => {
      const scale = 0.9 + rng() * 0.3;
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      strawHutBodyInst.setMatrixAt(i, dummy.matrix);
      strawHutRoofInst.setMatrixAt(i, dummy.matrix);
    });
    strawHutBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    strawHutRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(strawHutBodyInst);
    objectsGroup.add(strawHutRoofInst);
  }

  // 2.6 Generate Pagodas (rare, cherry blossom zones)
  if (pagodaPositions.length > 0) {
    const pagodaBodyInst = getInstancedMesh(
      pagodaBodyGeo,
      pagodaBodyMat,
      pagodaPositions.length
    );
    const pagodaRoofInst = getInstancedMesh(
      pagodaRoofGeo,
      pagodaRoofMat,
      pagodaPositions.length
    );
    pagodaPositions.forEach((pos, i) => {
      const scale = 0.9 + rng() * 0.3;
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      pagodaBodyInst.setMatrixAt(i, dummy.matrix);
      pagodaRoofInst.setMatrixAt(i, dummy.matrix);
    });
    pagodaBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    pagodaRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(pagodaBodyInst);
    objectsGroup.add(pagodaRoofInst);
  }

  // 2.61 Generate Barns (temperate plains)
  if (barnPositions.length > 0) {
    const barnBodyInst = getInstancedMesh(
      barnBodyGeo,
      barnBodyMat,
      barnPositions.length
    );
    const barnRoofInst = getInstancedMesh(
      barnRoofGeo,
      barnRoofMat,
      barnPositions.length
    );
    const barnDoorInst = getInstancedMesh(
      barnDoorGeo,
      barnWhiteMat,
      barnPositions.length * 2
    );
    const barnTrimInst = getInstancedMesh(
      barnTrimGeo,
      barnBodyMat,
      barnPositions.length * 4
    );
    const barnSiloBodyInst = getInstancedMesh(
      barnSiloBodyGeo,
      barnSiloMat,
      barnPositions.length
    );
    const barnSiloRoofInst = getInstancedMesh(
      barnSiloRoofGeo,
      barnSiloRoofMat,
      barnPositions.length
    );

    barnPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      barnBodyInst.setMatrixAt(i, dummy.matrix);
      barnRoofInst.setMatrixAt(i, dummy.matrix);

      const doorFOffset = new THREE.Vector3(0, 4.5, 14.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const doorBOffset = new THREE.Vector3(0, 4.5, -14.1).applyAxisAngle(
        yAxis,
        pos.rotY
      );
      const siloOffset = new THREE.Vector3(12, 0, 0).applyAxisAngle(
        yAxis,
        pos.rotY
      );

      // Front Door
      dummy.position.set(
        pos.x + doorFOffset.x,
        pos.y + doorFOffset.y,
        pos.z + doorFOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      barnDoorInst.setMatrixAt(i * 2, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, -Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4 + 1, dummy.matrix);

      // Back Door
      dummy.position.set(
        pos.x + doorBOffset.x,
        pos.y + doorBOffset.y,
        pos.z + doorBOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      barnDoorInst.setMatrixAt(i * 2 + 1, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4 + 2, dummy.matrix);

      dummy.rotation.set(0, pos.rotY, -Math.atan2(8, 9));
      dummy.updateMatrix();
      barnTrimInst.setMatrixAt(i * 4 + 3, dummy.matrix);

      // Silo
      dummy.position.set(
        pos.x + siloOffset.x,
        pos.y + siloOffset.y,
        pos.z + siloOffset.z
      );
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      barnSiloBodyInst.setMatrixAt(i, dummy.matrix);
      barnSiloRoofInst.setMatrixAt(i, dummy.matrix);
    });

    barnBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnDoorInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnTrimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnSiloBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    barnSiloRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);

    objectsGroup.add(barnBodyInst);
    objectsGroup.add(barnRoofInst);
    objectsGroup.add(barnDoorInst);
    objectsGroup.add(barnTrimInst);
    objectsGroup.add(barnSiloBodyInst);
    objectsGroup.add(barnSiloRoofInst);
  }

  // 2.62 Generate Monasteries (rare, temperate highlands)
  if (monasteryPositions.length > 0) {
    const monasteryBodyInst = getInstancedMesh(
      monasteryBodyGeo,
      monasteryBodyMat,
      monasteryPositions.length
    );
    const monasteryRoofInst = getInstancedMesh(
      monasteryRoofGeo,
      monasteryRoofMat,
      monasteryPositions.length
    );
    monasteryPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      monasteryBodyInst.setMatrixAt(i, dummy.matrix);
      monasteryRoofInst.setMatrixAt(i, dummy.matrix);
    });
    monasteryBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
    monasteryRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(monasteryBodyInst);
    objectsGroup.add(monasteryRoofInst);
  }

  // 2.63 Generate Castle Ruins (very rare, elevated terrain)
  if (castleRuinsPositions.length > 0) {
    const castleInst = getInstancedMesh(
      castleRuinsGeo,
      castleRuinsMat,
      castleRuinsPositions.length
    );
    castleRuinsPositions.forEach((pos, i) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      castleInst.setMatrixAt(i, dummy.matrix);
    });
    castleInst.position.set(worldOffsetX, 0, worldOffsetZ);
    group.add(castleInst);
  }

  // 2.7 Generate Windmills
  if (windmillPositions.length > 0) {
    const baseInst = getInstancedMesh(
      windmillBaseGeo,
      windmillBaseMat,
      windmillPositions.length
    );
    const bladesInst = getInstancedMesh(
      windmillBladesGeo,
      windmillBladesMat,
      windmillPositions.length * 4
    );
    bladesInst.customDepthMaterial = windmillBladesDepthMat;

    windmillPositions.forEach((pos, index) => {
      const structure = ModelAssembler.getStructure('windmill', pos.rotY);
      structure.forEach((part, pIdx) => {
        dummy.position.set(
          pos.x + part.pos[0],
          pos.y + part.pos[1],
          pos.z + part.pos[2]
        );
        dummy.rotation.order = part.order || 'XYZ';
        dummy.rotation.set(...part.rot);
        dummy.scale.set(...part.scale);
        dummy.updateMatrix();

        if (pIdx === 0) {
          baseInst.setMatrixAt(index, dummy.matrix);
        } else {
          bladesInst.setMatrixAt(index * 4 + (pIdx - 1), dummy.matrix);
        }
      });
    });

    baseInst.position.set(worldOffsetX, 0, worldOffsetZ);
    bladesInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(baseInst);
    objectsGroup.add(bladesInst);
  }
  if (checkYield()) yield;

  // 2.9 Generate Lighthouse
  if (lighthousePos) {
    const pos = lighthousePos;
    const structure = ModelAssembler.getStructure('lighthouse', pos.rotY || 0);
    const lighthouseGroup = new THREE.Group();

    structure.forEach((part) => {
      const mesh = new THREE.Mesh(part.geo, part.mat);
      mesh.position.set(...part.pos);
      mesh.rotation.set(...part.rot);
      if (part.scale) mesh.scale.set(...part.scale);
      lighthouseGroup.add(mesh);
    });

    lighthouseGroup.scale.set(2, 2, 2); // Scale lighthouse by 100% bigger (double size)
    lighthouseGroup.position.set(
      pos.x + worldOffsetX,
      pos.y,
      pos.z + worldOffsetZ
    );
    group.add(lighthouseGroup);

    // Use persistent beam and light
    const beamHeight = 126; // Middle of lantern (63 * 2)

    if (persistentLighthouseBeam) {
      persistentLighthouseBeam.position.set(
        pos.x + worldOffsetX,
        pos.y + beamHeight,
        pos.z + worldOffsetZ
      );
      persistentLighthouseBeam.rotation.y = pos.rotY;
      persistentLighthouseBeam.rotation.x = 0.15; // Tilt slightly downward
      persistentLighthouseBeam.scale.set(2, 2, 2); // Scale beam to match
      persistentLighthouseBeam.visible = true;

      // Store in userData for game.js to animate!
      group.userData.lighthouseBeam = persistentLighthouseBeam;
    }

    if (persistentLighthouseLight) {
      persistentLighthouseLight.position.set(
        pos.x + worldOffsetX,
        pos.y + beamHeight,
        pos.z + worldOffsetZ
      );
      persistentLighthouseLight.target.position.set(
        pos.x + worldOffsetX + Math.sin(pos.rotY) * 200,
        pos.y + beamHeight - 30,
        pos.z + worldOffsetZ + Math.cos(pos.rotY) * 200
      );
      persistentLighthouseLight.intensity = 0; // Controlled by animate loop (dayFactor)

      // Store in userData for game.js to animate!
      group.userData.lighthouseLight = persistentLighthouseLight;
      group.userData.lighthouseTarget = persistentLighthouseLight.target;
    }
  }

  // 2.95 Generate Piers
  if (pierPositions.length > 0) {
    const deckInst = getInstancedMesh(
      pierDeckGeo,
      woodMat,
      pierPositions.length
    );
    const postInst = getInstancedMesh(
      pierPostGeo,
      woodMat,
      pierPositions.length * 4
    );

    pierPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y - 1, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.updateMatrix();
      deckInst.setMatrixAt(index, dummy.matrix);

      // Posts
      const offsets = [
        [-6, 10],
        [6, 10],
        [-6, 25],
        [6, 25],
      ];
      offsets.forEach((off, i) => {
        const p = new THREE.Vector3(off[0], -5, off[1]).applyAxisAngle(
          yAxis,
          pos.rotY
        );
        dummy.position.set(pos.x + p.x, pos.y + p.y, pos.z + p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        postInst.setMatrixAt(index * 4 + i, dummy.matrix);
      });
    });

    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    postInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(deckInst);
    objectsGroup.add(postInst);
  }

  // 2.955 Generate West Coast Highway
  // Spawn continuous geometric road segments that elevate into bridges over water/valleys
  if (!isCustom) {
    const halfChunk = CHUNK_SIZE / 2;
    const activeRoads = [];
    for (let n = -20; n <= 20; n++) {
      const baseX =
        ChillFlightLogic.ROAD_BASE_X + n * ChillFlightLogic.ROAD_SPACING;
      if (
        baseX + 4000 >= worldOffsetX - halfChunk &&
        baseX - 4000 <= worldOffsetX + halfChunk
      ) {
        activeRoads.push(n);
      }
    }

    activeRoads.forEach((n) => {
      const bridgePositions = [];
      const sampleStep = BRIDGE_SEGMENT_LENGTH;

      // Ensure we have access to the constants
      const constants = {
        WATER_LEVEL,
        MOUNTAIN_LEVEL:
          typeof MOUNTAIN_LEVEL !== 'undefined' ? MOUNTAIN_LEVEL : 180,
      };

      const margin = 900;
      const rawSamples = [];
      const minHeight = WATER_LEVEL + 60;

      for (
        let sampleZ = -halfChunk - margin;
        sampleZ <= halfChunk + margin;
        sampleZ += sampleStep
      ) {
        const wz = worldOffsetZ + sampleZ + sampleStep / 2;
        const roadX = ChillFlightLogic.getRoadCenterX(wz, n);
        if (roadX >= 0) continue;

        const naturalH = ChillFlightLogic.getElevation(
          roadX,
          wz,
          simplex,
          constants,
          null,
          {ignoreRivers: true, ignoreRoads: true, forRoad: true}
        );
        let rawY = minHeight + (naturalH - minHeight) * 0.85;
        rawY = Math.max(rawY, minHeight);
        rawY = Math.min(rawY, ChillFlightLogic.MAX_HIGHWAY_HEIGHT);

        const actualTerrainH = getElevation(roadX, wz);

        rawSamples.push({
          sampleZ,
          wz,
          roadX,
          localRoadX: roadX - worldOffsetX,
          rawY,
          actualTerrainH,
        });
      }

      if (rawSamples.length > 0) {
        // 1. Identify elevated bridge spans over water / deep canyons
        const isBridgeSegment = new Uint8Array(rawSamples.length);
        for (let i = 0; i < rawSamples.length; i++) {
          isBridgeSegment[i] =
            rawSamples[i].rawY - rawSamples[i].actualTerrainH > 10 ? 1 : 0;
        }

        // Ground highway segments follow rawY directly to sit flush with the carved canyon floor
        const finalY = new Float32Array(rawSamples.length);
        for (let i = 0; i < rawSamples.length; i++) {
          finalY[i] = Math.max(
            rawSamples[i].rawY,
            rawSamples[i].actualTerrainH + 1.0
          );
        }

        // 2. Linearly grade elevated bridge spans between entry and exit abutments to remove jagged elevation changes
        let runStart = -1;
        for (let i = 0; i <= rawSamples.length; i++) {
          const isElevated = i < rawSamples.length && isBridgeSegment[i] === 1;
          if (isElevated && runStart === -1) {
            runStart = i;
          } else if (!isElevated && runStart !== -1) {
            const runEnd = i - 1;
            const yStart =
              runStart > 0 ? finalY[runStart - 1] : finalY[runStart];
            const yEnd =
              runEnd < rawSamples.length - 1
                ? finalY[runEnd + 1]
                : finalY[runEnd];
            const spanLen = runEnd - runStart + 2;
            for (let k = runStart; k <= runEnd; k++) {
              const t = (k - runStart + 1) / spanLen;
              finalY[k] = Math.max(minHeight, yStart + (yEnd - yStart) * t);
              finalY[k] = Math.max(
                finalY[k],
                rawSamples[k].actualTerrainH + 1.0
              );
            }
            runStart = -1;
          }
        }

        // 3. Assemble bridgePositions for this chunk
        for (let i = 0; i < rawSamples.length - 1; i++) {
          const curr = rawSamples[i];
          const next = rawSamples[i + 1];

          // Only keep segments whose center falls inside this chunk
          if (curr.sampleZ < -halfChunk || curr.sampleZ >= halfChunk) continue;
          if (Math.abs(curr.localRoadX) > halfChunk + 50) continue;

          const needsPilings = finalY[i] - curr.actualTerrainH > 10;

          bridgePositions.push({
            x: curr.localRoadX,
            y: finalY[i],
            z: curr.sampleZ + sampleStep / 2,
            needsPilings: needsPilings,
            terrainH: curr.actualTerrainH,
            nextPos: {
              x: next.localRoadX,
              y: finalY[i + 1],
              z: curr.sampleZ + sampleStep * 1.5,
            },
          });
        }
      }

      if (bridgePositions.length > 0) {
        // 1. Determine which segments need girders, railings, and piers
        let numGirderSegments = 0;
        let numRailSegments = 0;
        let numPiers = 0;

        bridgePositions.forEach((pos) => {
          if (pos.needsPilings) {
            numGirderSegments++;
            numRailSegments++;

            const midZ = (pos.z + pos.nextPos.z) / 2;
            const globalZ = worldOffsetZ + midZ;
            const globalSegmentIndex = Math.round(
              globalZ / BRIDGE_SEGMENT_LENGTH
            );
            // Place major piers every 4 segments (120 units)
            pos.hasPier = Math.abs(globalSegmentIndex) % 4 === 0;
          } else {
            pos.hasPier = false;
          }
        });

        // Ensure short elevated bridge runs that missed the % 4 cadence still get at least one central pier
        let runStart = -1;
        for (let i = 0; i <= bridgePositions.length; i++) {
          const isElevated =
            i < bridgePositions.length && bridgePositions[i].needsPilings;
          if (isElevated && runStart === -1) {
            runStart = i;
          } else if (!isElevated && runStart !== -1) {
            let hasAnyPier = false;
            let maxClearanceIdx = runStart;
            let maxClearance = -1;
            for (let j = runStart; j < i; j++) {
              if (bridgePositions[j].hasPier) hasAnyPier = true;
              const cl = bridgePositions[j].y - bridgePositions[j].terrainH;
              if (cl > maxClearance) {
                maxClearance = cl;
                maxClearanceIdx = j;
              }
            }
            if (!hasAnyPier && maxClearance > 12) {
              bridgePositions[maxClearanceIdx].hasPier = true;
            }
            runStart = -1;
          }
        }

        bridgePositions.forEach((p) => {
          if (p.hasPier) numPiers++;
        });

        // Road decks (paper-thin, for all segments)
        const deckInst = getInstancedMesh(
          bridgeDeckGeo,
          bridgeDeckMat,
          bridgePositions.length
        );

        // Box girders (trapezoidal underside, only for elevated bridge sections)
        const girderInst = getInstancedMesh(
          bridgeGirderGeo,
          bridgeGirderMat,
          numGirderSegments > 0 ? numGirderSegments : 1
        );

        // Railings (2 per segment, only for elevated bridge sections)
        const railInst = getInstancedMesh(
          bridgeRailGeo,
          bridgePilingMat,
          numRailSegments > 0 ? numRailSegments * 2 : 1
        );

        // Pier caps (sculpted hammerhead brackets)
        const pierCapInst = getInstancedMesh(
          bridgePierCapGeo,
          bridgePilingMat,
          numPiers > 0 ? numPiers : 1
        );

        // Pier shafts (faceted octagonal pylons)
        const pierShaftInst = getInstancedMesh(
          bridgePierShaftGeo,
          bridgePilingMat,
          numPiers > 0 ? numPiers : 1
        );

        // Pier footings (foundation caissons)
        const pierFootingInst = getInstancedMesh(
          bridgePierFootingGeo,
          bridgePilingMat,
          numPiers > 0 ? numPiers : 1
        );

        const halfRoadW = ChillFlightLogic.ROAD_WIDTH + 1.4;
        let girderIndex = 0;
        let railIndex = 0;
        let pierIndex = 0;

        // Streetlights
        let slFrequency = 2; // Normal: every other segment
        const absZ = Math.abs(worldOffsetZ);

        // Stop completely (abs(Z) > 50000, 10.0° North/South)
        if (absZ > 50000) {
          slFrequency = 0;
          // Sparse further out (abs(Z) > 25000, 5.0° North/South)
        } else if (absZ > 25000) {
          slFrequency = 8;
          // Somewhat sparse further out (abs(Z) > 15000, 3.0° North/South)
        } else if (absZ > 15000) {
          slFrequency = 4;
        }

        // Calculate exact number of streetlights based on global segment alignment
        let numStreetlights = 0;
        if (slFrequency > 0) {
          bridgePositions.forEach((pos) => {
            const midZ = (pos.z + pos.nextPos.z) / 2;
            const globalZ = worldOffsetZ + midZ;
            const globalSegmentIndex = Math.round(
              globalZ / BRIDGE_SEGMENT_LENGTH
            );
            if (Math.abs(globalSegmentIndex) % slFrequency === 0) {
              numStreetlights++;
            }
          });
        }
        const slBaseInst = getInstancedMesh(
          streetlightPoleGeo,
          streetlightPoleMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        const slArmInst = getInstancedMesh(
          streetlightArmGeo,
          streetlightPoleMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        const slBulbInst = getInstancedMesh(
          streetlightBulbGeo,
          window.streetlightBulbMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        const slDecalInst = getInstancedMesh(
          streetlightDecalGeo,
          window.streetlightDecalMat,
          numStreetlights > 0 ? numStreetlights : 1
        );
        let slIndex = 0;

        bridgePositions.forEach((pos, index) => {
          const currentVec = new THREE.Vector3(pos.x, pos.y, pos.z);
          const nextVec = new THREE.Vector3(
            pos.nextPos.x,
            pos.nextPos.y,
            pos.nextPos.z
          );

          // Calculate center of the edge and the exact distance
          const midVec = currentVec.clone().lerp(nextVec, 0.5);
          const dist = currentVec.distanceTo(nextVec);

          // 1. Deck (paper-thin, for all segments)
          dummy.position.copy(midVec);
          dummy.lookAt(nextVec);
          dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
          dummy.updateMatrix();
          deckInst.setMatrixAt(index, dummy.matrix);

          // Extract just the yaw from the deck's rotation for pilings
          const euler = new THREE.Euler().setFromQuaternion(
            dummy.quaternion,
            'YXZ'
          );
          const yaw = euler.y;

          // 2. Box Girder & Railings (only for elevated bridge segments)
          if (pos.needsPilings) {
            dummy.position.copy(midVec);
            dummy.lookAt(nextVec);
            dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
            dummy.updateMatrix();
            girderInst.setMatrixAt(girderIndex++, dummy.matrix);

            // Railings — one on each side, sitting flush on top of deck (+0.75)
            [-halfRoadW, halfRoadW].forEach((xOff) => {
              dummy.position.copy(midVec);
              dummy.lookAt(nextVec);
              dummy.translateX(xOff);
              dummy.translateY(2.05);
              dummy.scale.set(1, 1, dist / BRIDGE_SEGMENT_LENGTH);
              dummy.updateMatrix();
              railInst.setMatrixAt(railIndex++, dummy.matrix);
            });
          }

          // 3. Viaduct Piers (every 120 units on elevated sections)
          if (pos.hasPier) {
            const targetGroundY = Math.max(WATER_LEVEL, pos.terrainH);
            const seatY = midVec.y - 7.0;
            const shaftHeight = Math.max(0, seatY - targetGroundY);

            // Hammerhead pier cap (sits flush under deck)
            dummy.position.set(midVec.x, midVec.y, midVec.z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            pierCapInst.setMatrixAt(pierIndex, dummy.matrix);

            // Faceted pylon shaft (stretches from pier cap seat down to ground/water)
            dummy.position.set(midVec.x, seatY, midVec.z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(1, shaftHeight, 1);
            dummy.updateMatrix();
            pierShaftInst.setMatrixAt(pierIndex, dummy.matrix);

            // Foundation footing (anchored into ground/water)
            dummy.position.set(midVec.x, targetGroundY + 1.5, midVec.z);
            dummy.rotation.set(0, yaw, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            pierFootingInst.setMatrixAt(pierIndex, dummy.matrix);

            pierIndex++;
          }

          // Streetlights
          if (slFrequency > 0 && slIndex < numStreetlights) {
            const globalZ = worldOffsetZ + midVec.z;
            const globalSegmentIndex = Math.round(
              globalZ / BRIDGE_SEGMENT_LENGTH
            );

            if (Math.abs(globalSegmentIndex) % slFrequency === 0) {
              const isLeftSide =
                Math.floor(Math.abs(globalSegmentIndex) / slFrequency) % 2 ===
                0;

              const sideOff = isLeftSide ? halfRoadW - 0.5 : -halfRoadW + 0.5;
              const slYaw = isLeftSide ? yaw + Math.PI : yaw;

              const dxSl = sideOff * Math.cos(yaw);
              const dzSl = -sideOff * Math.sin(yaw);

              const slPos = new THREE.Vector3(
                midVec.x + dxSl,
                midVec.y,
                midVec.z + dzSl
              );

              // Position pole, arm, bulb
              const slParts = [
                {geo: streetlightPoleGeo, rot: [0, slYaw, 0], pos: [0, 0, 0]},
                {geo: streetlightArmGeo, rot: [0, slYaw, 0], pos: [0, 0, 0]},
                {
                  geo: streetlightBulbGeo,
                  rot: [0, slYaw, 0],
                  pos: [17 * Math.cos(slYaw), 23.8, -17 * Math.sin(slYaw)],
                },
              ];

              slParts.forEach((part, pIdx) => {
                dummy.position.set(
                  slPos.x + part.pos[0],
                  slPos.y + part.pos[1],
                  slPos.z + part.pos[2]
                );
                dummy.rotation.set(...part.rot);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                if (pIdx === 0) slBaseInst.setMatrixAt(slIndex, dummy.matrix);
                else if (pIdx === 1)
                  slArmInst.setMatrixAt(slIndex, dummy.matrix);
                else if (pIdx === 2)
                  slBulbInst.setMatrixAt(slIndex, dummy.matrix);
              });

              // Decal on the road under the bulb
              const decalDx = 17 * Math.cos(slYaw);
              const decalDz = -17 * Math.sin(slYaw);
              // Push it slightly higher (1.2) to prevent any Z-fighting on steep bridges
              const decalPos = new THREE.Vector3(
                slPos.x + decalDx,
                slPos.y + 1.2,
                slPos.z + decalDz
              );

              const forward = new THREE.Vector3()
                .subVectors(nextVec, midVec)
                .normalize();

              dummy.position.copy(decalPos);
              dummy.lookAt(decalPos.clone().add(forward));
              dummy.scale.set(1.5, 1, 1.5); // Perfectly circular, large soft pool
              dummy.updateMatrix();
              slDecalInst.setMatrixAt(slIndex, dummy.matrix);

              slIndex++;
            }
          }
        });

        deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
        group.add(deckInst);

        if (numGirderSegments > 0) {
          girderInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(girderInst);
        }

        if (numRailSegments > 0) {
          railInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(railInst);
        }

        if (numPiers > 0) {
          pierCapInst.position.set(worldOffsetX, 0, worldOffsetZ);
          pierShaftInst.position.set(worldOffsetX, 0, worldOffsetZ);
          pierFootingInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(pierCapInst);
          group.add(pierShaftInst);
          group.add(pierFootingInst);
        }

        if (numStreetlights > 0) {
          slBaseInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slArmInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slBulbInst.position.set(worldOffsetX, 0, worldOffsetZ);
          slDecalInst.position.set(worldOffsetX, 0, worldOffsetZ);
          group.add(slBaseInst);
          group.add(slArmInst);
          group.add(slBulbInst);
          group.add(slDecalInst);
        }
      }
    }); // End activeRoads.forEach
  }

  // 2.96 Generate Campfires
  if (campfirePositions.length > 0) {
    const logInst = getInstancedMesh(
      fireLogGeo,
      woodMat,
      campfirePositions.length * 3
    );
    const coreInst = getInstancedMesh(
      fireCoreGeo,
      fireMat,
      campfirePositions.length
    );
    const smokeInst = getInstancedMesh(
      smokeGeo,
      smokeMat,
      campfirePositions.length * 5
    ); // 5 particles per fire community
    const numTentColors = tentPalette.length;
    const tentCounts = Array(numTentColors).fill(0);
    const tentColorIndices = []; // Maps index to colorIndex

    campfirePositions.forEach((pos, index) => {
      // Deterministic color selection using seed-based RNG
      const colorIdx = Math.floor(rng() * numTentColors);
      tentColorIndices[index] = colorIdx;
      tentCounts[colorIdx]++;
    });

    const tentInsts = [];
    const tentPolesInst = getInstancedMesh(
      tentPolesGeo,
      woodMat,
      campfirePositions.length
    );
    const tentEntranceInst = getInstancedMesh(
      tentEntranceGeo,
      tentEntranceMat,
      campfirePositions.length
    );
    const currentComboIndices = Array(numTentColors).fill(0);

    for (let i = 0; i < numTentColors; i++) {
      if (tentCounts[i] > 0) {
        tentInsts[i] = getInstancedMesh(tentGeo, tentPalette[i], tentCounts[i]);
        tentInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(tentInsts[i]);
      }
    }

    tentPolesInst.position.set(worldOffsetX, 0, worldOffsetZ);
    tentEntranceInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(tentPolesInst, tentEntranceInst);

    campfirePositions.forEach((pos, index) => {
      const structure = ModelAssembler.getStructure('campfire', pos.rotY || 0);
      structure.forEach((part, pIdx) => {
        dummy.position.set(
          pos.x + part.pos[0],
          pos.y + part.pos[1],
          pos.z + part.pos[2]
        );
        dummy.rotation.order = part.order || 'XYZ';
        dummy.rotation.set(...part.rot);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        if (part.geo === fireLogGeo) {
          logInst.setMatrixAt(index * 3 + pIdx, dummy.matrix);
        } else if (part.geo === fireCoreGeo) {
          coreInst.setMatrixAt(index, dummy.matrix);
        }
      });

      // Smoke community
      for (let i = 0; i < 5; i++) {
        dummy.position.set(pos.x, pos.y + 5, pos.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        const smokeIdx = index * 5 + i;
        smokeInst.setMatrixAt(smokeIdx, dummy.matrix);

        const phase = ((pos.x + pos.z) % 10.0) / 10.0;
        smokeInst.setColorAt(smokeIdx, new THREE.Color(i / 10.0, phase, 0));
      }

      // Tent community
      const angle = rng() * Math.PI * 2;
      const dist = 12 + rng() * 4;
      const tentX = pos.x + Math.cos(angle) * dist;
      const tentZ = pos.z + Math.sin(angle) * dist;
      const tentY = getElevation(worldOffsetX + tentX, worldOffsetZ + tentZ);

      dummy.position.set(tentX, tentY, tentZ);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();

      const colorIdx = tentColorIndices[index];
      const instIdx = currentComboIndices[colorIdx]++;
      tentInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

      tentPolesInst.setMatrixAt(index, dummy.matrix);
      tentEntranceInst.setMatrixAt(index, dummy.matrix);
    });

    logInst.position.set(worldOffsetX, 0, worldOffsetZ);
    coreInst.position.set(worldOffsetX, 0, worldOffsetZ);
    smokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(logInst);
    objectsGroup.add(coreInst);
    objectsGroup.add(smokeInst);

    group.userData.campfires = coreInst;
    group.userData.campfireSmoke = smokeInst;
  }

  // 2.97 Generate Chimney Smoke
  if (chimneySmokePositions.length > 0) {
    const chimneySmokeInst = getInstancedMesh(
      smokeGeo,
      whiteSmokeMat,
      chimneySmokePositions.length * 4
    );

    chimneySmokePositions.forEach((pos, index) => {
      for (let i = 0; i < 4; i++) {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        const smokeIdx = index * 4 + i;
        chimneySmokeInst.setMatrixAt(smokeIdx, dummy.matrix);

        const phase = ((pos.x + pos.z) % 10.0) / 10.0;
        chimneySmokeInst.setColorAt(
          smokeIdx,
          new THREE.Color(i / 10.0, phase, 0)
        );
      }
    });

    chimneySmokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
    objectsGroup.add(chimneySmokeInst);

    group.userData.chimneySmoke = chimneySmokeInst;
  }

  // 2.98 Generate Sailboats
  let watercraftGroup = null;
  if (sailboatPositions.length > 0 || pirateShipPositions.length > 0) {
    watercraftGroup = new THREE.Group();
    watercraftGroup.visible = _enableObjects;
    group.add(watercraftGroup);
    group.userData.watercraftGroup = watercraftGroup;
  }

  if (sailboatPositions.length > 0) {
    const numBoatColors = boatHullPalette.length;
    const boatCounts = Array(numBoatColors).fill(0);
    const boatColorIndices = [];

    sailboatPositions.forEach((pos, index) => {
      const colorIdx = Math.floor(rng() * numBoatColors);
      boatColorIndices[index] = colorIdx;
      boatCounts[colorIdx]++;
    });

    const hullInsts = [];
    const currentComboIndices = Array(numBoatColors).fill(0);
    const boatInstIndices = [];

    for (let i = 0; i < numBoatColors; i++) {
      if (boatCounts[i] > 0) {
        hullInsts[i] = getInstancedMesh(
          boatHullGeo,
          boatHullPalette[i],
          boatCounts[i]
        );
        hullInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
        watercraftGroup.add(hullInsts[i]);
      }
    }

    const rimInst = getInstancedMesh(
      boatRimGeo,
      boatRimMat,
      sailboatPositions.length
    );
    const deckInst = getInstancedMesh(
      boatDeckGeo,
      boatDeckMat,
      sailboatPositions.length
    );
    const mastInst = getInstancedMesh(
      boatMastGeo,
      woodMat,
      sailboatPositions.length
    );
    const boomInst = getInstancedMesh(
      boatBoomGeo,
      woodMat,
      sailboatPositions.length
    );
    const sailInst = getInstancedMesh(
      boatSailGeo,
      boatSailMat,
      sailboatPositions.length
    );
    const sailboatReflectionInst = getInstancedMesh(
      sailboatReflectionGeo,
      reflectionMat,
      sailboatPositions.length
    );

    sailboatPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(1.8, 1.8, 1.8);
      dummy.updateMatrix();

      const colorIdx = boatColorIndices[index];
      const instIdx = currentComboIndices[colorIdx]++;
      boatInstIndices[index] = instIdx;
      hullInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

      rimInst.setMatrixAt(index, dummy.matrix);
      deckInst.setMatrixAt(index, dummy.matrix);
      mastInst.setMatrixAt(index, dummy.matrix);
      boomInst.setMatrixAt(index, dummy.matrix);
      sailInst.setMatrixAt(index, dummy.matrix);

      // Initialize reflection matrix with Y-flipped scale
      dummy.scale.set(1.8, -1.8, 1.8);
      dummy.updateMatrix();
      sailboatReflectionInst.setMatrixAt(index, dummy.matrix);
    });

    rimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
    boomInst.position.set(worldOffsetX, 0, worldOffsetZ);
    sailInst.position.set(worldOffsetX, 0, worldOffsetZ);
    sailboatReflectionInst.position.set(worldOffsetX, 0, worldOffsetZ);
    watercraftGroup.add(
      rimInst,
      deckInst,
      mastInst,
      boomInst,
      sailInst,
      sailboatReflectionInst
    );

    // Performance optimization: When boats are outside the 2,000-unit dynamic animation
    // radius, per-frame matrix recalculations and buffer re-uploads are paused.
    // Marking needsUpdate = true once upon creation guarantees their static resting matrices
    // are uploaded to the GPU on first render so they remain visible from any distance.
    rimInst.instanceMatrix.needsUpdate = true;
    deckInst.instanceMatrix.needsUpdate = true;
    mastInst.instanceMatrix.needsUpdate = true;
    boomInst.instanceMatrix.needsUpdate = true;
    sailInst.instanceMatrix.needsUpdate = true;
    sailboatReflectionInst.instanceMatrix.needsUpdate = true;
    hullInsts.forEach((h) => {
      if (h) h.instanceMatrix.needsUpdate = true;
    });

    group.userData.sailboatPositions = sailboatPositions;
    group.userData.boatHulls = hullInsts;
    group.userData.boatColorIndices = boatColorIndices;
    group.userData.boatInstIndices = boatInstIndices;
    group.userData.boatMasts = mastInst;
    group.userData.boatSails = sailInst;
    group.userData.boatRims = rimInst;
    group.userData.boatDecks = deckInst;
    group.userData.boatBooms = boomInst;
    group.userData.boatReflections = sailboatReflectionInst;
  }

  // 3.5 Pirate Ships
  if (pirateShipPositions.length > 0) {
    const sailInsts = pirateSailPalette.map((mat) =>
      getInstancedMesh(pirateSailGeo, mat, pirateShipPositions.length)
    );
    const hullInst = getInstancedMesh(
      pirateHullGeo,
      pirateHullMat,
      pirateShipPositions.length
    );
    const rimInst = getInstancedMesh(
      pirateRimGeo,
      pirateRimMat,
      pirateShipPositions.length
    );
    const deckInst = getInstancedMesh(
      pirateDeckGeo,
      woodMat,
      pirateShipPositions.length
    );
    const mastInst = getInstancedMesh(
      pirateMastGeo,
      woodMat,
      pirateShipPositions.length
    );
    const flagInst = getInstancedMesh(
      pirateFlagGeo,
      pirateFlagMat,
      pirateShipPositions.length
    );
    const jrInst = getInstancedMesh(
      pirateJollyRogerGeo,
      pirateJollyRogerMat,
      pirateShipPositions.length
    );
    const pirateReflectionInst = getInstancedMesh(
      pirateShipReflectionGeo,
      reflectionMat,
      pirateShipPositions.length
    );

    const sailCounts = new Array(pirateSailPalette.length).fill(0);

    pirateShipPositions.forEach((pos, index) => {
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.rotation.set(0, pos.rotY, 0);
      dummy.scale.set(2.5, 2.5, 2.5);
      dummy.updateMatrix();

      const colorIdx = pos.bodyId;
      const instIdx = sailCounts[colorIdx]++;
      sailInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

      hullInst.setMatrixAt(index, dummy.matrix);
      rimInst.setMatrixAt(index, dummy.matrix);
      deckInst.setMatrixAt(index, dummy.matrix);
      mastInst.setMatrixAt(index, dummy.matrix);
      flagInst.setMatrixAt(index, dummy.matrix);
      jrInst.setMatrixAt(index, dummy.matrix);

      // Initialize reflection matrix with Y-flipped scale
      dummy.scale.set(2.5, -2.5, 2.5);
      dummy.updateMatrix();
      pirateReflectionInst.setMatrixAt(index, dummy.matrix);
    });

    hullInst.position.set(worldOffsetX, 0, worldOffsetZ);
    rimInst.position.set(worldOffsetX, 0, worldOffsetZ);
    deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
    mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
    flagInst.position.set(worldOffsetX, 0, worldOffsetZ);
    jrInst.position.set(worldOffsetX, 0, worldOffsetZ);
    pirateReflectionInst.position.set(worldOffsetX, 0, worldOffsetZ);
    watercraftGroup.add(
      hullInst,
      rimInst,
      deckInst,
      mastInst,
      flagInst,
      jrInst,
      pirateReflectionInst
    );

    sailInsts.forEach((inst, idx) => {
      if (sailCounts[idx] > 0) {
        inst.count = sailCounts[idx];
        inst.position.set(worldOffsetX, 0, worldOffsetZ);
        watercraftGroup.add(inst);
      }
    });

    // Performance optimization: When pirate ships are outside 2,000 units, dynamic
    // patrol and wave calculations are culled. Marking needsUpdate = true once ensures
    // their resting matrices are uploaded to the GPU on initial chunk render.
    hullInst.instanceMatrix.needsUpdate = true;
    rimInst.instanceMatrix.needsUpdate = true;
    deckInst.instanceMatrix.needsUpdate = true;
    mastInst.instanceMatrix.needsUpdate = true;
    flagInst.instanceMatrix.needsUpdate = true;
    jrInst.instanceMatrix.needsUpdate = true;
    pirateReflectionInst.instanceMatrix.needsUpdate = true;
    sailInsts.forEach((inst) => {
      if (inst) inst.instanceMatrix.needsUpdate = true;
    });

    group.userData.pirateShipPositions = pirateShipPositions;
    group.userData.pirateHulls = hullInst;
    group.userData.pirateRims = rimInst;
    group.userData.pirateDecks = deckInst;
    group.userData.pirateMasts = mastInst;
    group.userData.pirateFlags = flagInst;
    group.userData.pirateJollyRogers = jrInst;
    group.userData.pirateSails = sailInsts;
    group.userData.pirateReflections = pirateReflectionInst;
  }

  // 4. Generate Birds
  group.userData.birds = [];
  const isAlienChunk = Math.abs(worldOffsetX) > 25000;
  if (!isCustom && !isAlienChunk && rng() < 0.2) {
    const baseX = worldOffsetX + (rng() - 0.5) * CHUNK_SIZE;
    const baseZ = worldOffsetZ + (rng() - 0.5) * CHUNK_SIZE;
    let baseY = getElevation(baseX, baseZ) + 150 + rng() * 200;
    if (baseY > 400) baseY = 400;

    const baseRotationY = rng() * Math.PI * 2;

    const isSouth = worldOffsetZ > 0;
    const heightAtCenter = getElevation(worldOffsetX, worldOffsetZ);
    const isBeach =
      heightAtCenter > WATER_LEVEL - 20 && heightAtCenter < WATER_LEVEL + 40;

    if (isSouth && isBeach && rng() < 0.3) {
      // Spawn seagulls
      const numSeagulls = 2 + Math.floor(rng() * 4); // 2 to 5
      const flockCenterX = worldOffsetX + (rng() - 0.5) * CHUNK_SIZE;
      const flockCenterZ = worldOffsetZ + (rng() - 0.5) * CHUNK_SIZE;
      let flockBaseY =
        getElevation(flockCenterX, flockCenterZ) + 40 + rng() * 60;

      for (let i = 0; i < numSeagulls; i++) {
        const seagull = assembleSeagull(2.5 + rng() * 1.0); // Slightly smaller scale than hawk
        seagull.position.set(flockCenterX, flockBaseY, flockCenterZ);

        seagull.userData.type = 'seagull';
        seagull.userData.speed = 0.5; // Slightly faster
        seagull.userData.circleSpeed = 0.4 + rng() * 0.2;
        seagull.userData.circleRadius = 50 + rng() * 80;
        seagull.userData.circleCenter = new THREE.Vector3(
          flockCenterX,
          flockBaseY + (rng() - 0.5) * 40,
          flockCenterZ
        );
        seagull.userData.angle = rng() * Math.PI * 2;
        seagull.userData.flapPhase = rng() * Math.PI * 2;
        seagull.userData.flapSpeed = 10.0 + rng() * 5.0; // Faster flapping
        seagull.userData.flapDuration = 2.0 + rng() * 2.0;
        seagull.userData.soarDuration = 3.0 + rng() * 3.0;
        seagull.userData.isDiving = false;
        seagull.userData.diveTimer = rng() * 10;
        seagull.userData.nextDiveWait = 10.0 + rng() * 20.0;

        objectsGroup.add(seagull);
        group.userData.birds.push(seagull);
      }
    } else {
      // Spawn hawk

      const hawk = assembleHawk(4.0);
      hawk.position.set(baseX, baseY, baseZ);
      hawk.rotation.y = baseRotationY;

      hawk.userData.type = 'hawk';
      hawk.userData.speed = 0.4;
      hawk.userData.circleSpeed = 0.3 + rng() * 0.2;
      hawk.userData.circleRadius = 150 + rng() * 100;
      hawk.userData.circleCenter = new THREE.Vector3(baseX, baseY, baseZ);
      hawk.userData.angle = rng() * Math.PI * 2;
      hawk.userData.flapPhase = rng() * Math.PI * 2;
      hawk.userData.flapSpeed = 8.0 + rng() * 4.0;
      hawk.userData.flapDuration = 3.0 + rng() * 3.0;
      hawk.userData.soarDuration = 4.0 + rng() * 4.0;
      hawk.userData.isDiving = false;

      objectsGroup.add(hawk);
      group.userData.birds.push(hawk);
    }
  }

  if (!isCustom && !isAlienChunk && rng() < 0.04) {
    const flockSize = 7 + Math.floor(rng() * 6); // 7 to 12 geese
    const baseX = worldOffsetX + (rng() - 0.5) * CHUNK_SIZE;
    const baseZ = worldOffsetZ + (rng() - 0.5) * CHUNK_SIZE;
    let baseY = getElevation(baseX, baseZ) + 400 + rng() * 600;
    if (baseY > 1200) baseY = 1200;

    const baseRotationY = rng() * Math.PI * 2;
    const speed = 0.5 + rng() * 0.2;

    for (let i = 0; i < flockSize; i++) {
      const goose = new THREE.Group();
      const body = new THREE.Mesh(gooseBodyGeo, gooseBrownMat);
      const neck = new THREE.Mesh(gooseNeckGeo, gooseBlackMat);
      const head = new THREE.Mesh(gooseHeadGeo, gooseBlackMat);
      const beak = new THREE.Mesh(gooseBeakGeo, gooseBlackMat);
      const cheek = new THREE.Mesh(gooseCheekGeo, gooseWhiteMat);
      const tailWhite = new THREE.Mesh(gooseWhiteTailGeo, gooseWhiteMat);
      const tailBlack = new THREE.Mesh(gooseTailGeo, gooseBlackMat);
      const wingL = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
      const wingR = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
      wingL.rotation.y = Math.PI;
      goose.add(
        body,
        neck,
        head,
        beak,
        cheek,
        tailWhite,
        tailBlack,
        wingL,
        wingR
      );
      goose.scale.set(3.5, 3.5, 3.5);
      goose.userData.wings = [wingL, wingR];

      let offsetX = 0;
      let offsetZ = 0;
      if (i > 0) {
        const row = Math.floor((i + 1) / 2);
        const side = i % 2 === 0 ? 1 : -1;
        offsetX = side * row * 35;
        offsetZ = row * 35;
      }

      const localPos = new THREE.Vector3(offsetX, 0, offsetZ);
      localPos.applyAxisAngle(yAxis, baseRotationY);

      goose.position.set(baseX + localPos.x, baseY, baseZ + localPos.z);
      goose.rotation.y = baseRotationY;

      goose.userData.type = 'goose';
      goose.userData.speed = speed;
      goose.userData.flapPhase = rng() * Math.PI * 2;
      goose.userData.flapSpeed = 3.0 + rng() * 1.0;
      goose.userData.flapDuration = 1000.0;
      goose.userData.soarDuration = 0.0;

      objectsGroup.add(goose);
      group.userData.birds.push(goose);
    }
  }

  if (group.userData.birds.length > 0) {
    birdChunks.add(group);
  }

  group.traverse((child) => {
    if (child.isMesh || child.isInstancedMesh) {
      if (child.material === waterMaterial) {
        child.receiveShadow = true;
      } else if (
        child.material !== smokeMat &&
        child.material !== lighthouseBeamMat &&
        child.material !== houseDoorMat &&
        !houseWindowMats.includes(child.material) &&
        child.geometry !== houseDoorGeo &&
        child.geometry !== houseWindowGeo &&
        child.geometry !== streetlightDecalGeo
      ) {
        child.castShadow = true;
        child.receiveShadow = true;
      } else {
        child.receiveShadow = true;
      }
    }
  });

  group.userData.counts = {
    trees_pine: treePositions.length + snowTreePositions.length,
    trees_decid:
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
    houses:
      housePositions.length +
      pagodaPositions.length +
      barnPositions.length +
      monasteryPositions.length +
      castleRuinsPositions.length,

    rocks:
      rockPositions.length +
      snowRockPositions.length +
      desertRockPositions.length,
    bushes: bushPositions.length,
    snowmen: snowmanPositions.length,
    cactus: cactusPositions.length,
    lighthouses: lighthousePos ? 1 : 0,
    castles: castleRuinsPositions.length,
    windmills: windmillPositions.length,
    campfires: campfirePositions.length,
    boats: sailboatPositions.length,
    pirateships: pirateShipPositions.length,
    lily_pads: lilyPadPositions.length,
    piers: pierPositions.length,
    birds: group.userData.birds.length,
    chimneys: chimneySmokePositions.length,
  };

  if (sailboatPositions.length > 0 || pirateShipPositions.length > 0) {
    watercraftChunks.add(group);
  }

  group.userData.instanceData = collector.data;
  scene.add(group);
  return group;
}

function updateChunks() {
  const target =
    typeof window !== 'undefined' && window.isFreeCamera ? camera : planeGroup;
  const currentChunkX = Math.round(target.position.x / CHUNK_SIZE);
  const currentChunkZ = Math.round(target.position.z / CHUNK_SIZE);
  const renderDistance = RENDER_DISTANCE;

  const missingChunks = [];

  for (let x = -renderDistance; x <= renderDistance; x++) {
    for (let z = -renderDistance; z <= renderDistance; z++) {
      const cx = currentChunkX + x;
      const cz = currentChunkZ + z;
      const key = `${cx},${cz}`;
      if (
        !chunks.has(key) &&
        !chunkQueueSet.has(key) &&
        !chunkGenerators.has(key)
      ) {
        missingChunks.push({cx, cz, key, distSq: x * x + z * z});
        chunkQueueSet.add(key);
      }
    }
  }

  missingChunks.sort((a, b) => b.distSq - a.distSq);
  chunkQueue.push(...missingChunks);

  // Prune chunks from queue that are beyond renderDistance + 2 to prevent queue bloat
  const maxQueueDistSq = (renderDistance + 2) * (renderDistance + 2);
  const prunedQueue = [];
  chunkQueue.forEach((item) => {
    const dx = item.cx - currentChunkX;
    const dz = item.cz - currentChunkZ;
    const dSq = dx * dx + dz * dz;
    if (dSq <= maxQueueDistSq) {
      item.distSq = dSq;
      prunedQueue.push(item);
    } else {
      chunkQueueSet.delete(item.key);
    }
  });
  chunkQueue = prunedQueue;
  chunkQueue.sort((a, b) => b.distSq - a.distSq);

  let chunksEvicted = false;

  // Evict generators that are out of bounds
  chunkGenerators.forEach((gen, key) => {
    const [cxStr, czStr] = key.split(',');
    const cx = parseInt(cxStr);
    const cz = parseInt(czStr);
    if (
      Math.abs(cx - currentChunkX) > renderDistance + 1 ||
      Math.abs(cz - currentChunkZ) > renderDistance + 1
    ) {
      chunkGenerators.delete(key);
    }
  });

  chunks.forEach((group, key) => {
    const cx = group.userData.chunkX;
    const cz = group.userData.chunkZ;
    if (
      Math.abs(cx - currentChunkX) > renderDistance + 1 ||
      Math.abs(cz - currentChunkZ) > renderDistance + 1
    ) {
      // Collect instanced meshes and pool/dispose unique geometries in a single traversal
      const instancedMeshesToRelease = [];
      group.traverse((child) => {
        if (child.isInstancedMesh) {
          instancedMeshesToRelease.push(child);
        }
        if (child.isMesh || child.isInstancedMesh) {
          if (child.geometry && child.geometry.userData.unique) {
            if (child.geometry.userData.poolType === 'terrain') {
              if (
                _terrainGeometryPool.length < 25 &&
                child.geometry.parameters &&
                child.geometry.parameters.widthSegments === SEGMENTS
              ) {
                _terrainGeometryPool.push(child.geometry);
              } else {
                child.geometry.dispose();
              }
            } else if (child.geometry.userData.poolType === 'water') {
              const wSegments = Math.max(1, Math.floor(SEGMENTS / 4));
              if (
                _waterGeometryPool.length < 25 &&
                child.geometry.parameters &&
                child.geometry.parameters.widthSegments === wSegments
              ) {
                _waterGeometryPool.push(child.geometry);
              } else {
                child.geometry.dispose();
              }
            } else {
              child.geometry.dispose();
            }
          }
        }
      });

      // Detach all child objects and clear chunk references
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }

      for (let i = 0; i < instancedMeshesToRelease.length; i++) {
        releaseInstancedMesh(instancedMeshesToRelease[i]);
      }
      group.userData.instanceData = null;
      group.userData.objectsGroup = null;
      group.userData.watercraftGroup = null;
      group.userData.water = null;
      group.userData.sailboatPositions = null;
      group.userData.boatHulls = null;
      group.userData.boatColorIndices = null;
      group.userData.boatInstIndices = null;
      group.userData.boatMasts = null;
      group.userData.boatSails = null;
      group.userData.boatRims = null;
      group.userData.boatDecks = null;
      group.userData.boatBooms = null;
      group.userData.boatReflections = null;
      group.userData.pirateShipPositions = null;
      group.userData.pirateHulls = null;
      group.userData.pirateRims = null;
      group.userData.pirateDecks = null;
      group.userData.pirateMasts = null;
      group.userData.pirateFlags = null;
      group.userData.pirateJollyRogers = null;
      group.userData.pirateSails = null;
      group.userData.pirateReflections = null;
      group.userData.birds = null;
      group.userData.counts = null;
      group.userData.rockArch = null;

      scene.remove(group);
      chunks.delete(key);
      watercraftChunks.delete(group);
      birdChunks.delete(group);
      chunksEvicted = true;
      if (key === '4,2') {
        if (persistentLighthouseLight) persistentLighthouseLight.intensity = 0;
        if (persistentLighthouseBeam) persistentLighthouseBeam.visible = false;
      }
    }
  });

  if (chunksEvicted && typeof globalInstancer !== 'undefined') {
    globalInstancer.requestRebuild();
  }
}

var chunkGenerators = new Map();
window.chunkGenerators = chunkGenerators;

window.processChunkQueue = function (timeBudget = 4) {
  if (chunkQueue.length === 0 && chunkGenerators.size === 0) return 1.0; // 100% progress when queue is empty

  window._chunkQueueStartTime = performance.now();
  window._chunkQueueTimeBudget = timeBudget;
  let generatedThisFrame = 0;

  // Process active generators first
  for (const [key, gen] of chunkGenerators.entries()) {
    const result = gen.next();
    if (result.done) {
      chunks.set(key, result.value);
      chunkGenerators.delete(key);
      generatedThisFrame++;
    }
    // If we exceed time budget, stop processing generators
    if (performance.now() - window._chunkQueueStartTime > timeBudget) {
      break;
    }
  }

  // If we still have budget, pop new chunks and start them.
  // Limit concurrent active generators during normal flight so we finish chunks sequentially.
  const maxActiveGenerators = timeBudget > 10 ? 8 : 2;
  while (
    chunkQueue.length > 0 &&
    chunkGenerators.size < maxActiveGenerators &&
    performance.now() - window._chunkQueueStartTime < timeBudget
  ) {
    const item = chunkQueue.pop();
    chunkQueueSet.delete(item.key);

    if (!chunks.has(item.key) && !chunkGenerators.has(item.key)) {
      const gen = generateChunk(item.cx, item.cz);
      const result = gen.next();
      if (result.done) {
        chunks.set(item.key, result.value);
        generatedThisFrame++;
      } else {
        chunkGenerators.set(item.key, gen);
      }
    }
  }

  if (generatedThisFrame > 0 && typeof globalInstancer !== 'undefined') {
    globalInstancer.requestRebuild();
  }

  const totalChunks = chunks.size + chunkQueue.length + chunkGenerators.size;
  if (totalChunks === 0) return 1.0;
  return chunks.size / totalChunks;
};

window.getChunkLoadingProgress = function () {
  const totalChunks = chunks.size + chunkQueue.length + chunkGenerators.size;
  if (totalChunks === 0) return 1.0;
  return chunks.size / totalChunks;
};
function toggleProceduralObjects(enabled) {
  _enableObjects = enabled;
  ChillFlightLogic.setShowObjects(enabled);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('chill_flight_show_objects', enabled);
  }

  // Update all existing chunks
  chunks.forEach((group) => {
    if (group.userData.objectsGroup) {
      group.userData.objectsGroup.visible = enabled;
    }
    if (group.userData.watercraftGroup) {
      group.userData.watercraftGroup.visible = enabled;
    }
  });

  if (typeof globalInstancer !== 'undefined') {
    globalInstancer.requestRebuild();
  }

  // Update debug menu UI if it exists
  const toggle = document.getElementById('debug-objects-toggle');
  if (toggle) toggle.checked = enabled;

  if (
    typeof window !== 'undefined' &&
    typeof window.updateUrlParams === 'function'
  ) {
    if (!enabled) {
      window.updateUrlParams({objects: 'none'});
    } else {
      window.updateUrlParams({}, ['objects']);
    }
  }
}

// Global expose
window.toggleProceduralObjects = toggleProceduralObjects;
