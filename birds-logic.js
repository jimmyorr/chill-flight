// --- BIRDS: ECOLOGY, FORMATIONS & BEHAVIOR STATE MACHINES ---
// Pure math and deterministic data structures (no three.js or DOM), shared by
// the terrain web workers (terrain-gen.js), the main-thread bird runtime
// (birds.js), and the headless simulation test suite (scripts/test-birds.js).
//
// Eight ecological archetypes tailored to Chill Flight's biomes:
//   - goose:     High-altitude asymmetric V/J echelons; vortex-lagged wingbeats,
//                staggered terrain clearance, aircraft V-split & smooth regroup.
//   - hawk:      Inland thermal climber (drifts downwind while spiraling up,
//                glides upwind to next thermal) with occasional hunting stoops.
//   - seagull:   Coastal/lighthouse/sea-arch/boat wheeler; kites into the wind
//                before plunge-diving to the water with a surface splash.
//   - heron:     Swamp/bayou/river skimmer (Great Blue & White Egret morphs);
//                slow deep wingbeats, meandering low patrol & water-skim glides.
//   - pelican:   Coastal wave-skimming single-file squadron in ground effect,
//                periodically climbing to wheel and plunge-fish.
//   - swallow:   Agile low-AGL meadow/canyon/waterfall insect darter; rapid
//                banked figure-8 jinks, shelters in heavy rain, confetti scatter.
//   - raven:     Mountain/canyon/cuesta ridge-lift surfer aligned cross-wind,
//                with occasional playful corvid barrel-rolls in updrafts.
//   - albatross: Deep-ocean dynamic soarer; locked sabre wings carving banked
//                S-curves across the wind gradient (upwind climb, downwind swoop).

const TAU = Math.PI * 2;

export const BIRD_STATES = {
  CRUISE: 'cruise',
  SOAR: 'soar',
  THERMAL: 'thermal',
  GLIDE: 'glide',
  KITE: 'kite',
  FORAGE: 'forage',
  SKIM: 'skim',
  DART: 'dart',
  PLAY: 'play',
  EVADE: 'evade',
  REGROUP: 'regroup',
};

// Per-species profile: visual scale, squared cull distance, diurnal light floor,
// rain shelter threshold (above this rain intensity, non-hardy flyers thin out),
// wing kinematics, and base startle distance (units).
export const BIRD_SPECIES = {
  goose: {
    scaleMin: 3.3,
    scaleMax: 3.7,
    drawDistSq: 0, // uses dynamic prop LOD distance, strays cull at 15,000
    minDayFactor: 0.08,
    maxRain: 0.92,
    flapSpeed: 8.4,
    flapAmp: 0.52,
    dihedral: 0.02,
    startleRadius: 110,
    evadeDuration: 4.8,
    evadeDist: 75,
  },
  hawk: {
    scaleMin: 3.8,
    scaleMax: 4.4,
    drawDistSq: 6600 * 6600,
    minDayFactor: 0.14,
    maxRain: 0.65,
    flapSpeed: 7.2,
    flapAmp: 0.48,
    dihedral: 0.08, // classic Buteo V-dihedral while soaring
    startleRadius: 115,
    evadeDuration: 4.2,
    evadeDist: 85,
  },
  seagull: {
    scaleMin: 2.5,
    scaleMax: 3.4,
    drawDistSq: 5800 * 5800,
    minDayFactor: 0.08,
    maxRain: 0.95,
    flapSpeed: 10.5,
    flapAmp: 0.5,
    dihedral: 0.03,
    startleRadius: 95,
    evadeDuration: 3.8,
    evadeDist: 65,
  },
  heron: {
    scaleMin: 3.6,
    scaleMax: 4.3,
    drawDistSq: 5600 * 5600,
    minDayFactor: 0.05, // active at dawn and dusk in the marshes
    maxRain: 0.85,
    flapSpeed: 4.2, // slow, deep, majestic strokes
    flapAmp: 0.62,
    dihedral: -0.04, // slightly bowed/cupped wings
    startleRadius: 125,
    evadeDuration: 4.6,
    evadeDist: 70,
  },
  pelican: {
    scaleMin: 3.8,
    scaleMax: 4.5,
    drawDistSq: 6000 * 6000,
    minDayFactor: 0.09,
    maxRain: 0.9,
    flapSpeed: 5.4,
    flapAmp: 0.46,
    dihedral: 0.03,
    startleRadius: 105,
    evadeDuration: 4.2,
    evadeDist: 70,
  },
  swallow: {
    scaleMin: 1.55,
    scaleMax: 1.95,
    drawDistSq: 3200 * 3200, // tiny agile flyers: tighter cull saves draw calls
    minDayFactor: 0.14,
    maxRain: 0.48, // insectivores shelter when rain sets in
    flapSpeed: 19.5,
    flapAmp: 0.58,
    dihedral: -0.02,
    startleRadius: 85,
    evadeDuration: 2.6,
    evadeDist: 52,
  },
  raven: {
    scaleMin: 3.0,
    scaleMax: 3.6,
    drawDistSq: 5800 * 5800,
    minDayFactor: 0.05,
    maxRain: 0.82,
    flapSpeed: 8.6,
    flapAmp: 0.5,
    dihedral: 0.04,
    startleRadius: 88,
    evadeDuration: 3.4,
    evadeDist: 62,
  },
  albatross: {
    scaleMin: 5.2,
    scaleMax: 6.1, // giant open-ocean wingspan
    drawDistSq: 7200 * 7200,
    minDayFactor: 0.06,
    maxRain: 1.0, // flies right through ocean squalls
    flapSpeed: 4.0,
    flapAmp: 0.34,
    dihedral: 0.02,
    startleRadius: 120,
    evadeDuration: 4.5,
    evadeDist: 85,
  },
};

// Habitat latitude & chance constants (units: negative Z is North, positive Z South)
export const HABITAT_LIMITS = {
  GULL_MAX_NORTH: -22000,
  PELICAN_MAX_NORTH: -14500,
  HERON_MAX_NORTH: -15500,
  SWALLOW_MAX_NORTH: -16500,
  ALBATROSS_MAX_NORTH: -19500,
  RAVEN_MAX_NORTH: -28500,
  GOOSE_MAX_NORTH: -26000,
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(x, e0, e1) {
  const t = clamp((x - e0) / (e1 - e0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrapAngle(a) {
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}

function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

function rotateXZ(x, z, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {x: x * s + z * c, z: z * s - x * c};
}

// Local frame matching Three.js YXZ yaw (`rotY = 0` faces -Z, `+rotY` turns left):
// right is (+cos(rotY), -sin(rotY)), back is (+sin(rotY), +cos(rotY)).
function localToWorldXZ(rightOff, backOff, rotY, out) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  out.x = rightOff * c + backOff * s;
  out.z = -rightOff * s + backOff * c;
  return out;
}

const _slot = {x: 0, z: 0};

// --- CHUNK HABITAT SPAWNER (WORKER-SAFE) ---
// Deterministically populates `birds` for a terrain chunk based on its biome,
// water coverage, relief, landmarks, and world coordinates.
export function generateChunkBirds({
  worldOffsetX,
  worldOffsetZ,
  chunkSize,
  waterLevel,
  waterShare,
  minElev = 0,
  maxElev = 0,
  swampFactor = 0,
  farmFactor = 0,
  canyonFactor = 0,
  fallsFactor = 0,
  isAlienChunk = false,
  lighthousePos = null,
  sailboatPositions = null,
  rockArchPositions = null,
  pierPositions = null,
  windDirX = 0.8,
  windDirZ = 0.6,
  getElev,
  rng,
}) {
  const birds = [];
  if (isAlienChunk) return birds;

  const rand = (lo, hi) => lo + rng() * (hi - lo);
  const elevSpan = Math.max(0, maxElev - minElev);
  const windLen = Math.hypot(windDirX, windDirZ) || 1;
  const wx = windDirX / windLen;
  const wz = windDirZ / windLen;

  const pushGullFlock = (cx, cz, cy, count, radius) => {
    for (let i = 0; i < count; i++) {
      const r = radius * rand(0.85, 1.65);
      const ang = rng() * TAU;
      const baseCy = cy + rand(-18, 22);
      birds.push({
        type: 'seagull',
        scale: rand(2.5, 3.4),
        x: cx + Math.cos(ang) * r,
        y: baseCy,
        z: cz + Math.sin(ang) * r,
        speed: rand(24, 31),
        circleSpeed: rand(0.38, 0.58) * (rng() < 0.5 ? 1 : -1),
        circleRadius: r,
        cx,
        cy: baseCy,
        cz,
        angle: ang,
        flapPhase: rng() * TAU,
        flapSpeed: rand(9.5, 13.5),
        flapDuration: rand(2.0, 3.8),
        soarDuration: rand(3.2, 5.8),
        stateTimer: rand(4, 18),
        nextForageWait: rand(12, 28),
        weatherSeed: rng(),
      });
    }
  };

  // 1. Landmark anchor flocks: lighthouses, sea arches, piers, and sailboats
  if (lighthousePos && worldOffsetZ >= HABITAT_LIMITS.GULL_MAX_NORTH) {
    pushGullFlock(
      worldOffsetX + lighthousePos.x,
      worldOffsetZ + lighthousePos.z,
      lighthousePos.y + 145,
      3 + Math.floor(rng() * 3),
      46
    );
  }

  if (
    rockArchPositions &&
    rockArchPositions.length > 0 &&
    waterShare > 0.1 &&
    worldOffsetZ >= HABITAT_LIMITS.GULL_MAX_NORTH &&
    rng() < 0.65
  ) {
    const arch = rockArchPositions[0];
    const ax = worldOffsetX + (arch.x || 0);
    const az = worldOffsetZ + (arch.z || 0);
    const ay = Math.max(waterLevel, getElev(ax, az)) + 85;
    pushGullFlock(ax, az, ay, 3 + Math.floor(rng() * 3), 55);
  }

  if (
    sailboatPositions &&
    sailboatPositions.length > 0 &&
    worldOffsetZ >= HABITAT_LIMITS.GULL_MAX_NORTH &&
    rng() < 0.35
  ) {
    const boat =
      sailboatPositions[Math.floor(rng() * sailboatPositions.length)];
    pushGullFlock(
      worldOffsetX + boat.x,
      worldOffsetZ + boat.z,
      waterLevel + rand(38, 65),
      2 + Math.floor(rng() * 3),
      38
    );
  }

  // 2. Swamp, marsh, river & waterfall skimmers: Herons & Great Egrets
  const isMarshy =
    worldOffsetZ >= HABITAT_LIMITS.HERON_MAX_NORTH &&
    (swampFactor > 0.28 ||
      fallsFactor > 0.2 ||
      (waterShare > 0.04 &&
        waterShare < 0.65 &&
        minElev < waterLevel + 6 &&
        elevSpan < 55));
  if (isMarshy && rng() < (swampFactor > 0.35 ? 0.38 : 0.14)) {
    const pairCount = rng() < 0.35 ? 2 : 1;
    // Variant 0: Great Blue Heron, Variant 1: White Egret (common in warm bayous)
    const variant = rng() < (swampFactor > 0.4 ? 0.45 : 0.25) ? 1 : 0;
    const hx = worldOffsetX + rand(-0.38, 0.38) * chunkSize;
    const hz = worldOffsetZ + rand(-0.38, 0.38) * chunkSize;
    const groundH = Math.max(waterLevel, getElev(hx, hz));
    const heading = rng() * TAU;
    for (let i = 0; i < pairCount; i++) {
      birds.push({
        type: 'heron',
        variant,
        scale: rand(3.6, 4.3),
        x: hx + i * 28,
        y: groundH + rand(20, 36) + i * 4,
        z: hz + i * 22,
        cx: hx,
        cy: groundH + rand(22, 36),
        cz: hz,
        rotY: heading,
        speed: rand(19, 23),
        patrolRadius: rand(130, 210),
        angle: rng() * TAU + i * 0.22,
        flapPhase: rng() * TAU,
        flapSpeed: rand(3.8, 4.6),
        flapDuration: rand(5.5, 8.5),
        soarDuration: rand(2.2, 4.0),
        stateTimer: rand(5, 14),
        weatherSeed: rng(),
      });
    }
  }

  // 3. Coastal foraging pelicans: independent wide-wheeling Brown Pelicans over baitballs & piers
  const isTemperateCoast =
    worldOffsetZ >= HABITAT_LIMITS.PELICAN_MAX_NORTH &&
    waterShare >= 0.18 &&
    waterShare <= 0.92;
  const hasPier = pierPositions && pierPositions.length > 0;
  if (isTemperateCoast && rng() < (hasPier ? 0.34 : 0.16)) {
    // Try up to 4 samples inside the chunk to find a spot over open water
    let px = worldOffsetX;
    let pz = worldOffsetZ;
    let overWater = false;
    for (let s = 0; s < 4; s++) {
      const tx = worldOffsetX + rand(-0.4, 0.4) * chunkSize;
      const tz = worldOffsetZ + rand(-0.4, 0.4) * chunkSize;
      if (getElev(tx, tz) < waterLevel - 1.5) {
        px = tx;
        pz = tz;
        overWater = true;
        break;
      }
    }
    if (overWater) {
      const groupSize = 2 + Math.floor(rng() * 3); // 2..4 independent pelicans
      const mainDir = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < groupSize; i++) {
        // Each pelican gets its own center offset, wide wheeling radius, speed,
        // altitude band, and independent forage timer so they never look like a
        // rigid single-file train on a circular track
        const cx = px + rand(-55, 55);
        const cz = pz + rand(-55, 55);
        const pRad = rand(115, 225);
        const pAng = rng() * TAU;
        const dirSign = rng() < 0.78 ? mainDir : -mainDir;
        const angSpeed = rand(0.16, 0.28) * dirSign;
        const skimOffset = rand(9.0, 16.5);
        const soarOffset = rand(56, 88);
        const startHigh = rng() < 0.45;
        const initY = waterLevel + (startHigh ? soarOffset : skimOffset);
        birds.push({
          type: 'pelican',
          scale: rand(3.8, 4.4),
          x: cx + Math.cos(pAng) * pRad,
          y: initY,
          z: cz + Math.sin(pAng) * pRad,
          cx,
          cy: waterLevel + skimOffset,
          cz,
          skimOffset,
          soarOffset,
          state: startHigh ? BIRD_STATES.SOAR : BIRD_STATES.SKIM,
          circleRadius: pRad,
          circleSpeed: angSpeed,
          angle: pAng,
          rank: i,
          flapPhase: rng() * TAU,
          flapSpeed: rand(4.7, 5.8),
          flapDuration: rand(1.9, 2.6),
          soarDuration: rand(5.2, 8.2),
          stateTimer: rand(4, 22),
          nextForageWait: rand(16, 36),
          weatherSeed: rng(),
        });
      }
    }
  }

  // 4. Open-ocean dynamic soarers: Wandering Albatross
  if (
    waterShare >= 0.94 &&
    worldOffsetZ >= HABITAT_LIMITS.ALBATROSS_MAX_NORTH &&
    rng() < 0.09
  ) {
    const ax = worldOffsetX + rand(-0.35, 0.35) * chunkSize;
    const az = worldOffsetZ + rand(-0.35, 0.35) * chunkSize;
    // Cross-wind axis (-wz, wx) is the main sweeping span, carving broad
    // figure-8 dynamic-soaring S-turns into and downwind at 42-75 units/s
    const crossSign = rng() < 0.5 ? 1 : -1;
    const initPhase = rng() * TAU;
    const crossAmp = rand(330, 410);
    const windAmp = rand(125, 160);
    const crossX = -wz * crossSign;
    const crossZ = wx * crossSign;
    const initCross = Math.sin(initPhase) * crossAmp;
    const initWind = -Math.sin(initPhase * 2) * windAmp;
    const initY = waterLevel + 36 + Math.sin(initPhase * 2) * 26;
    birds.push({
      type: 'albatross',
      scale: rand(5.2, 6.0),
      x: ax + crossX * initCross + wx * initWind,
      y: initY,
      z: az + crossZ * initCross + wz * initWind,
      cx: ax,
      cy: waterLevel + 36,
      cz: az,
      windX: wx,
      windZ: wz,
      crossSign,
      crossAmp,
      windAmp,
      soarPhase: initPhase,
      soarFreq: rand(0.155, 0.195),
      speed: rand(48, 68),
      flapPhase: rng() * TAU,
      flapSpeed: 3.6,
      flapDuration: 0.85,
      soarDuration: 18.0, // ~95% locked-wing dynamic soaring
      weatherSeed: rng(),
    });
  }

  // 5. Shoreline gulls vs inland raptors, swallows, and ridge ravens
  const gullChance =
    worldOffsetZ < HABITAT_LIMITS.GULL_MAX_NORTH
      ? 0
      : waterShare >= 0.92
        ? 0.035
        : waterShare > 0.08
          ? 0.18
          : 0;
  const mainRoll = rng();
  if (mainRoll < gullChance) {
    const cx = worldOffsetX + rand(-0.45, 0.45) * chunkSize;
    const cz = worldOffsetZ + rand(-0.45, 0.45) * chunkSize;
    const cy = Math.max(waterLevel, getElev(cx, cz)) + rand(42, 98);
    pushGullFlock(cx, cz, cy, 2 + Math.floor(rng() * 4), 52);
  } else if (waterShare < 0.48) {
    // Lowland meadows, farmlands, canyon & waterfall: agile Barn Swallows
    const swallowHabitat =
      worldOffsetZ >= HABITAT_LIMITS.SWALLOW_MAX_NORTH &&
      (farmFactor > 0.12 || fallsFactor > 0.15 || canyonFactor > 0.25);
    if (swallowHabitat && rng() < (farmFactor > 0.25 ? 0.34 : 0.22)) {
      const sx = worldOffsetX + rand(-0.35, 0.35) * chunkSize;
      const sz = worldOffsetZ + rand(-0.35, 0.35) * chunkSize;
      const groundH = Math.max(waterLevel, getElev(sx, sz));
      const swarmSize = 5 + Math.floor(rng() * 4); // 5..8 swallows
      for (let i = 0; i < swarmSize; i++) {
        birds.push({
          type: 'swallow',
          scale: rand(1.55, 1.95),
          x: sx + rand(-35, 35),
          y: groundH + rand(18, 36),
          z: sz + rand(-35, 35),
          cx: sx,
          cy: groundH + rand(20, 34),
          cz: sz,
          orbitA: rand(42, 78),
          orbitB: rand(28, 56),
          orbitRot: rng() * TAU,
          angle: rng() * TAU,
          dartSpeed: rand(0.95, 1.35) * (rng() < 0.5 ? 1 : -1),
          jinkFreq: rand(2.4, 3.6),
          jinkPhase: rng() * TAU,
          flapPhase: rng() * TAU,
          flapSpeed: rand(18.0, 23.0),
          flapDuration: rand(1.1, 2.0),
          soarDuration: rand(0.7, 1.4),
          weatherSeed: rng(),
        });
      }
    }

    // High relief ridges, canyons, cliffs & upland crags: Cliff Ravens
    const isRidge =
      worldOffsetZ >= HABITAT_LIMITS.RAVEN_MAX_NORTH &&
      (elevSpan > 85 || canyonFactor > 0.15 || maxElev > waterLevel + 175);
    if (isRidge && rng() < 0.32) {
      // Sample 4 spots in the chunk and anchor ravens above the highest crag
      // so they wheel prominently against the sky above the ridgeline
      let rx = worldOffsetX;
      let rz = worldOffsetZ;
      let bestH = -Infinity;
      for (let s = 0; s < 4; s++) {
        const tx = worldOffsetX + rand(-0.38, 0.38) * chunkSize;
        const tz = worldOffsetZ + rand(-0.38, 0.38) * chunkSize;
        const th = getElev(tx, tz);
        if (th > bestH) {
          bestH = th;
          rx = tx;
          rz = tz;
        }
      }
      const groundH = Math.max(waterLevel, bestH);
      const groupCount = 3 + Math.floor(rng() * 3); // 3..5 ravens surfing ridge
      // Ridge patrol axis perpendicular to wind
      const ridgeAxisX = -wz;
      const ridgeAxisZ = wx;
      const perpX = -ridgeAxisZ;
      const perpZ = ridgeAxisX;
      for (let i = 0; i < groupCount; i++) {
        const cx = rx + rand(-35, 35);
        const cz = rz + rand(-35, 35);
        const cy = groundH + rand(65, 115);
        const halfLen = rand(145, 215);
        const width = rand(52, 82);
        const ang = rng() * TAU;
        const initAlong = Math.sin(ang) * halfLen;
        const initAcross = Math.cos(ang) * width;
        birds.push({
          type: 'raven',
          scale: rand(3.6, 4.3),
          x: cx + ridgeAxisX * initAlong + perpX * initAcross,
          y: cy,
          z: cz + ridgeAxisZ * initAlong + perpZ * initAcross,
          cx,
          cy,
          cz,
          axisX: ridgeAxisX,
          axisZ: ridgeAxisZ,
          ridgeHalfLen: halfLen,
          ridgeWidth: width,
          angle: ang,
          circleSpeed: rand(0.26, 0.36) * (rng() < 0.5 ? 1 : -1),
          flapPhase: rng() * TAU,
          flapSpeed: rand(7.8, 9.6),
          flapDuration: rand(1.8, 3.0),
          soarDuration: rand(4.5, 7.5),
          nextPlayWait: rand(14, 32),
          weatherSeed: rng(),
        });
      }
    } else if (rng() < 0.19) {
      // Inland thermal columns: Red-Tailed Hawk
      const hx = worldOffsetX + rand(-0.42, 0.42) * chunkSize;
      const hz = worldOffsetZ + rand(-0.42, 0.42) * chunkSize;
      const groundH = Math.max(waterLevel, getElev(hx, hz));
      const baseAlt = Math.min(480, groundH + rand(145, 290));
      const hRad = rand(135, 225);
      const hAng = rng() * TAU;
      birds.push({
        type: 'hawk',
        scale: rand(3.8, 4.4),
        x: hx + Math.cos(hAng) * hRad,
        y: baseAlt,
        z: hz + Math.sin(hAng) * hRad,
        rotY: rng() * TAU,
        cx: hx,
        cy: baseAlt,
        cz: hz,
        homeX: hx,
        homeY: baseAlt,
        homeZ: hz,
        circleSpeed: rand(0.3, 0.46) * (rng() < 0.5 ? 1 : -1),
        circleRadius: hRad,
        thermalTop: baseAlt + rand(95, 155),
        climbRate: rand(6.5, 10.5),
        angle: hAng,
        flapPhase: rng() * TAU,
        flapSpeed: rand(6.8, 8.8),
        flapDuration: rand(2.2, 3.6),
        soarDuration: rand(5.5, 9.0),
        nextStoopWait: rand(28, 55),
        weatherSeed: rng(),
      });
    }
  }

  // 6. High-altitude migratory V / J-echelon Canada Geese
  if (worldOffsetZ >= HABITAT_LIMITS.GOOSE_MAX_NORTH && rng() < 0.042) {
    const flockSize = 7 + Math.floor(rng() * 7); // 7..13 geese
    // Asymmetric J-echelon bias: one wing of the V has 1-3 extra birds
    const leftBias = Math.floor(rng() * 3);
    const baseX = worldOffsetX + rand(-0.45, 0.45) * chunkSize;
    const baseZ = worldOffsetZ + rand(-0.45, 0.45) * chunkSize;
    const baseY = Math.min(
      1200,
      Math.max(waterLevel, getElev(baseX, baseZ)) + rand(400, 960)
    );
    const baseRotY = rng() * TAU;
    const speed = rand(54, 66); // units/s (~1.1-1.3 * 50 in legacy scale)
    const leaderFlapPhase = rng() * TAU;
    const spacing = 34;

    let leftRow = 0;
    let rightRow = 0;
    for (let i = 0; i < flockSize; i++) {
      let offRight = 0;
      let offBack = 0;
      let row = 0;
      if (i > 0) {
        const goLeft =
          leftRow - rightRow < leftBias
            ? i % 2 === 1 || rightRow > leftRow + 1
            : false;
        if (goLeft || (i % 2 === 1 && leftRow <= rightRow + leftBias)) {
          leftRow++;
          row = leftRow;
          offRight = -row * spacing * 0.94;
          offBack = row * spacing;
        } else {
          rightRow++;
          row = rightRow;
          offRight = row * spacing * 0.94;
          offBack = row * spacing;
        }
      }
      localToWorldXZ(offRight, offBack, baseRotY, _slot);
      birds.push({
        type: 'goose',
        scale: rand(3.35, 3.65),
        x: baseX + _slot.x,
        y: baseY + rand(-2.5, 2.5),
        z: baseZ + _slot.z,
        leaderX: baseX,
        leaderY: baseY,
        leaderZ: baseZ,
        slotRight: offRight,
        slotBack: offBack,
        slotWorldX: _slot.x,
        slotWorldZ: _slot.z,
        rotY: baseRotY,
        speed,
        row,
        // Wingtip-vortex phase lag: wingbeats ripple smoothly back down the V!
        flapPhase: leaderFlapPhase - row * 0.55 + rand(-0.08, 0.08),
        flapSpeed: rand(8.0, 9.2),
        flapDuration: 1000.0,
        soarDuration: 0.0,
        weatherSeed: rng(),
      });
    }
  }

  return birds;
}

// --- AIRCRAFT AWARENESS & WAKE TURBULENCE ---
// Evaluates whether a bird at (bx, by, bz) is startled by an approaching
// aircraft or buffeted by its trailing wake vortex cone. Writes into `out`
// with zero allocations.
export function evaluateAircraftThreat(bx, by, bz, aircraft, baseRadius, out) {
  out.triggered = false;
  out.wake = false;
  out.dx = 0;
  out.dy = 0;
  out.dz = 0;
  out.strength = 0;
  if (!aircraft || !aircraft.active) return out;

  const rx = bx - aircraft.x;
  const ry = by - aircraft.y;
  const rz = bz - aircraft.z;
  const distSq = rx * rx + ry * ry + rz * rz;

  // Fast jets project louder acoustic startle ahead; parked/slow vehicles less
  const speedBoost = clamp(aircraft.speed / 140, 0.65, 1.45);
  const jetMult = aircraft.isJet ? 1.25 : 1.0;
  const effRadius = baseRadius * speedBoost * jetMult;

  if (distSq < effRadius * effRadius) {
    // Break perpendicular to aircraft's velocity vector so the bird peels off
    // to the side rather than fleeing straight down the aircraft's nose!
    const fx = aircraft.fx;
    const fy = aircraft.fy;
    const fz = aircraft.fz;
    const along = rx * fx + ry * fy + rz * fz;
    let latX = rx - along * fx;
    let latY = ry - along * fy;
    let latZ = rz - along * fz;
    let latLen = Math.hypot(latX, latZ);

    if (latLen < 1e-3) {
      // Dead on the nose line: break right or left deterministically by position
      const side = bx + bz >= 0 ? 1 : -1;
      latX = -fz * side;
      latZ = fx * side;
      latLen = Math.hypot(latX, latZ) || 1;
    }
    latX /= latLen;
    latZ /= latLen;

    // Climb away if already above the plane (or near water/ground), dive-break
    // slightly if well below a high-passing plane
    const vertBias = latY >= -4 ? 0.42 : -0.18;
    const norm = Math.hypot(latX, vertBias, latZ) || 1;
    out.triggered = true;
    out.dx = latX / norm;
    out.dy = vertBias / norm;
    out.dz = latZ / norm;
    out.strength = 1 - Math.sqrt(distSq) / effRadius;
    return out;
  }

  // Trailing wake vortex cone behind fast-moving aircraft (80+ units/s):
  // extends 220 units behind the tail with a 48-unit core radius
  if (aircraft.speed > 80 && distSq < 240 * 240) {
    const along = rx * aircraft.fx + ry * aircraft.fy + rz * aircraft.fz;
    if (along < -12 && along > -225) {
      const radialSq = Math.max(0, distSq - along * along);
      const wakeRadius = 48 * (aircraft.isJet ? 1.2 : 1.0);
      if (radialSq < wakeRadius * wakeRadius) {
        const rLen = Math.sqrt(radialSq) || 1;
        const rxLat = (rx - along * aircraft.fx) / rLen;
        const rzLat = (rz - along * aircraft.fz) / rLen;
        out.triggered = true;
        out.wake = true;
        out.dx = rxLat;
        out.dy = -0.22;
        out.dz = rzLat;
        out.strength =
          (1 - rLen / wakeRadius) * (1 - Math.abs(along) / 225) * 0.85;
      }
    }
  }
  return out;
}

// --- WING KINEMATICS ---
// Returns the right-wing rotation angle `flap` (radians; left wing uses `-flap`
// on mirrored wing geometry so dihedral & flap stay symmetric).
export function computeWingFlap(data, elapsed) {
  const spec = BIRD_SPECIES[data.type] || BIRD_SPECIES.seagull;
  if (data.evadeT > 0) {
    // Urgent high-frequency evasion strokes tapering back to normal rhythm
    const urgency = 1 - clamp(data.evadeT / spec.evadeDuration, 0, 1);
    const rate = spec.flapSpeed * (1.35 + 1.15 * urgency);
    const amp = spec.flapAmp * (1.1 + 0.45 * urgency);
    return spec.dihedral + Math.sin(elapsed * rate + data.flapPhase) * amp;
  }

  // Plunge-diving gulls & pelicans tuck wings back/flat during steep descent
  if (data.state === BIRD_STATES.FORAGE && data.divePhase < 0.55) {
    return -0.18;
  }
  // Ravens tuck wings briefly mid-barrel-roll
  if (data.state === BIRD_STATES.PLAY) {
    return 0.05;
  }

  const flapDur = data.flapDuration ?? 3.0;
  const soarDur = data.soarDuration ?? 4.0;
  if (soarDur <= 0.01) {
    return (
      spec.dihedral +
      Math.sin(elapsed * data.flapSpeed + data.flapPhase) * spec.flapAmp
    );
  }

  // Hawks in thermal climb & pelicans in low skim spend extra time soaring
  const effSoar =
    data.state === BIRD_STATES.THERMAL || data.state === BIRD_STATES.SKIM
      ? soarDur * 1.45
      : soarDur;
  const total = flapDur + effSoar;
  const cyc = (((elapsed + data.flapPhase * 3.7) % total) + total) % total;
  if (cyc > flapDur) {
    return spec.dihedral;
  }

  const fade = Math.min(0.45, flapDur * 0.35);
  let env = 1;
  if (cyc < fade) env = cyc / fade;
  else if (flapDur - cyc < fade) env = (flapDur - cyc) / fade;

  return (
    spec.dihedral +
    Math.sin(elapsed * data.flapSpeed + data.flapPhase) * spec.flapAmp * env
  );
}

const _threat = {
  triggered: false,
  wake: false,
  dx: 0,
  dy: 0,
  dz: 0,
  strength: 0,
};

// --- PER-BIRD STATE MACHINE & TRAJECTORY STEP ---
// Updates `data` in place and writes the new world pose `{x, y, z, pitch, yaw,
// bank, splash, visible}` into `out` with zero heap allocations.
export function stepBirdState(data, curX, curY, curZ, env, rawDelta, out) {
  const dt = clamp(rawDelta, 0, 0.1);
  const spec = BIRD_SPECIES[data.type] || BIRD_SPECIES.seagull;
  out.splash = false;

  // Diurnal & storm visibility check (geese still advance position when hidden
  // by distance LOD, handled by the caller; night puts all birds to roost)
  const day = env.dayFactor ?? 1;
  const rain = env.rain ?? 0;
  const weatherClear =
    rain <= spec.maxRain ||
    (data.weatherSeed ?? 0.5) >
      (rain - spec.maxRain) / (1 - spec.maxRain + 1e-4);
  out.visible = day > spec.minDayFactor && weatherClear;
  if (day <= spec.minDayFactor && data.type !== 'goose') {
    out.x = curX;
    out.y = curY;
    out.z = curZ;
    out.pitch = 0;
    out.yaw = data.yaw || 0;
    out.bank = 0;
    return out;
  }

  // Initialize lazy runtime fields once
  if (data.state === undefined) {
    data.state =
      data.type === 'goose'
        ? BIRD_STATES.CRUISE
        : data.type === 'hawk'
          ? BIRD_STATES.THERMAL
          : data.type === 'pelican'
            ? BIRD_STATES.SKIM
            : data.type === 'swallow'
              ? BIRD_STATES.DART
              : BIRD_STATES.SOAR;
    data.evadeT = 0;
    data.evadeOx = 0;
    data.evadeOy = 0;
    data.evadeOz = 0;
    data.wakeRoll = 0;
    data.yaw = data.rotY ?? 0;
    data.pitch = 0;
    data.bank = 0;
    data.divePhase = 0;
    data.stateTimer = data.stateTimer ?? 8;
  }

  const windStrength = env.windStrength ?? 1;
  const windVx = (env.windDirX ?? 0.8) * 6.5 * windStrength;
  const windVz = (env.windDirZ ?? 0.6) * 6.5 * windStrength;
  const waterLevel = env.waterLevel ?? 45.5;

  // 1. Check aircraft proximity & wake turbulence when chunk is near the plane
  if (env.checkAircraft && data.evadeT <= 0) {
    evaluateAircraftThreat(
      curX,
      curY,
      curZ,
      env.aircraft,
      spec.startleRadius,
      _threat
    );
    if (_threat.triggered) {
      data.evadeT = 0.001;
      data.evadeDx = _threat.dx;
      data.evadeDy = _threat.dy;
      data.evadeDz = _threat.dz;
      data.evadeMag = spec.evadeDist * (0.65 + 0.55 * _threat.strength);
      if (_threat.wake) {
        data.wakeRoll = (_threat.dx >= 0 ? 1 : -1) * 0.75 * _threat.strength;
      }
      if (data.type === 'goose') {
        data.state = BIRD_STATES.EVADE;
      }
    }
  }

  // Advance evasion impulse & wake-vortex roll decay
  let evadeWeight = 0;
  if (data.evadeT > 0) {
    data.evadeT += dt;
    if (data.evadeT >= spec.evadeDuration) {
      data.evadeT = 0;
      data.evadeOx = 0;
      data.evadeOy = 0;
      data.evadeOz = 0;
      if (data.type === 'goose') data.state = BIRD_STATES.CRUISE;
    } else {
      // Fast burst away over first 0.65s, smooth regroup glide back to slot
      const u = data.evadeT;
      evadeWeight =
        u < 0.65
          ? Math.sin((u / 0.65) * Math.PI * 0.5)
          : 1 - smoothstep(u, 0.65, spec.evadeDuration);
      data.evadeOx = data.evadeDx * data.evadeMag * evadeWeight;
      data.evadeOy = data.evadeDy * data.evadeMag * evadeWeight;
      data.evadeOz = data.evadeDz * data.evadeMag * evadeWeight;
    }
  } else if (data.type === 'goose' && data.state === BIRD_STATES.EVADE) {
    data.state = BIRD_STATES.CRUISE;
  }
  if (Math.abs(data.wakeRoll) > 1e-3) {
    data.wakeRoll *= Math.exp(-3.2 * dt);
  } else {
    data.wakeRoll = 0;
  }

  let targetX = curX;
  let targetY = curY;
  let targetZ = curZ;
  let wantYaw = data.yaw;
  let wantPitch = 0;
  let wantBank = 0;

  // --- 2. ARCHETYPE BEHAVIORS ---
  switch (data.type) {
    case 'goose': {
      // Advance virtual V-leader along heading + subtle crosswind drift
      const fwdX = -Math.sin(data.rotY);
      const fwdZ = -Math.cos(data.rotY);
      const stepFwd = (data.speed || 58) * dt;
      data.leaderX =
        (data.leaderX ?? curX - (data.slotWorldX || 0)) +
        fwdX * stepFwd +
        windVx * 0.18 * dt;
      data.leaderZ =
        (data.leaderZ ?? curZ - (data.slotWorldZ || 0)) +
        fwdZ * stepFwd +
        windVz * 0.18 * dt;

      const slotX = data.leaderX + (data.slotWorldX || 0);
      const slotZ = data.leaderZ + (data.slotWorldZ || 0);

      // Staggered 4 Hz terrain lookahead so V-flocks climb smoothly over peaks
      if (env.getElev) {
        const phase = (((data.rotY / TAU) % 1) + 1) % 1;
        const slot = Math.floor((env.elapsed || 0) / 0.25 + phase);
        if (slot !== data.groundSlot) {
          data.groundSlot = slot;
          // Probe slightly ahead of the goose so climb starts before a ridge
          data.groundY = env.getElev(slotX + fwdX * 80, slotZ + fwdZ * 80);
        }
      }
      const minAlt = Math.max(waterLevel, data.groundY ?? waterLevel) + 250;
      const baseAlt = Math.max(data.leaderY ?? curY, minAlt);
      const climbDiff = baseAlt - (curY - (data.evadeOy || 0));
      const baseCurY =
        curY -
        (data.evadeOy || 0) +
        clamp(climbDiff * 2.4 * dt, -18 * dt, 32 * dt);

      targetX = slotX + data.evadeOx;
      targetY = Math.max(waterLevel + 12, baseCurY + data.evadeOy);
      targetZ = slotZ + data.evadeOz;

      wantYaw = data.rotY;
      wantPitch = clamp(climbDiff * 0.004, -0.18, 0.28);
      if (evadeWeight > 0.05) {
        // Bank into evasion break, then opposite bank while sliding back into V
        const escaping = data.evadeT < 0.65 ? 1 : -0.45;
        const sideDot =
          data.evadeDx * Math.cos(data.rotY) -
          data.evadeDz * Math.sin(data.rotY);
        wantYaw = data.rotY - sideDot * 0.42 * evadeWeight * escaping;
        wantBank = -sideDot * 0.55 * evadeWeight * escaping;
      }
      break;
    }

    case 'hawk': {
      // State cycle: THERMAL (spiral climb + downwind drift) <-> GLIDE (upwind
      // return) + occasional FORAGE stoop
      data.nextStoopWait = (data.nextStoopWait ?? 40) - dt;
      if (data.state === BIRD_STATES.THERMAL) {
        data.angle += data.circleSpeed * dt;
        // Thermal column drifts gently downwind while the hawk climbs
        data.cx += windVx * 0.28 * dt;
        data.cz += windVz * 0.28 * dt;
        data.cy += (data.climbRate || 8) * dt;
        if (data.cy >= (data.thermalTop || data.homeY + 120)) {
          data.state =
            data.nextStoopWait <= 0 ? BIRD_STATES.FORAGE : BIRD_STATES.GLIDE;
          data.divePhase = 0;
          if (data.state === BIRD_STATES.FORAGE) {
            data.nextStoopWait = 38 + ((data.flapPhase * 7) % 25);
          }
        }
        targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
        targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
        targetY = data.cy;
        const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
        const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
        wantYaw = Math.atan2(-tangX, -tangZ);
        wantPitch = 0.06;
        wantBank = Math.sign(data.circleSpeed) * 0.36;
      } else if (data.state === BIRD_STATES.FORAGE) {
        // Swift shallow raptor stoop and zoom recovery
        data.divePhase += dt / 3.4;
        data.angle += data.circleSpeed * 1.25 * dt;
        const stoopDrop = Math.sin(Math.min(1, data.divePhase) * Math.PI) * 85;
        targetX = data.cx + Math.cos(data.angle) * data.circleRadius * 0.85;
        targetZ = data.cz + Math.sin(data.angle) * data.circleRadius * 0.85;
        targetY = Math.max(waterLevel + 35, data.cy - stoopDrop);
        const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
        const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
        wantYaw = Math.atan2(-tangX, -tangZ);
        wantPitch = -Math.cos(data.divePhase * Math.PI) * 0.55;
        wantBank = Math.sign(data.circleSpeed) * 0.22;
        if (data.divePhase >= 1) {
          data.state = BIRD_STATES.GLIDE;
        }
      } else {
        // GLIDE: gently lose altitude while gliding back toward home upwind thermal
        const dx = (data.homeX ?? data.cx) - data.cx;
        const dz = (data.homeZ ?? data.cz) - data.cz;
        const dist = Math.hypot(dx, dz);
        const glideSpeed = 34;
        if (dist > 8) {
          data.cx += (dx / dist) * glideSpeed * dt;
          data.cz += (dz / dist) * glideSpeed * dt;
          wantYaw = Math.atan2(-dx, -dz);
        }
        data.cy = Math.max(data.homeY ?? 220, data.cy - 14 * dt);
        data.angle += data.circleSpeed * 0.5 * dt;
        targetX = data.cx + Math.cos(data.angle) * data.circleRadius * 0.6;
        targetZ = data.cz + Math.sin(data.angle) * data.circleRadius * 0.6;
        targetY = data.cy;
        wantPitch = -0.09;
        wantBank = Math.sign(data.circleSpeed) * 0.16;
        if (dist <= 22 && data.cy <= (data.homeY ?? 220) + 8) {
          data.state = BIRD_STATES.THERMAL;
        }
      }
      break;
    }

    case 'seagull': {
      // SOAR wheeling -> brief upwind KITE hover -> parabolic FORAGE dive to water
      if (data.state === BIRD_STATES.SOAR) {
        data.angle += data.circleSpeed * dt;
        data.stateTimer -= dt;
        targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
        targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
        targetY = data.cy + Math.sin(data.angle * 2 + data.flapPhase) * 6;
        const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
        const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
        wantYaw = Math.atan2(-tangX, -tangZ);
        wantBank = Math.sign(data.circleSpeed) * 0.32;
        if (data.stateTimer <= 0 && data.cy > waterLevel + 24) {
          data.state = BIRD_STATES.KITE;
          data.divePhase = 0;
        }
      } else if (data.state === BIRD_STATES.KITE) {
        // Turn nose into the wind and hover-flutter for 1.1s spotting fish
        data.divePhase += dt / 1.1;
        data.angle += data.circleSpeed * 0.18 * dt;
        targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
        targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
        targetY = data.cy + Math.sin(data.divePhase * Math.PI) * 5;
        wantYaw = Math.atan2(env.windDirX ?? 0.8, env.windDirZ ?? 0.6);
        wantPitch = 0.15;
        wantBank = 0;
        if (data.divePhase >= 1) {
          data.state = BIRD_STATES.FORAGE;
          data.divePhase = 0;
          data.splashed = false;
        }
      } else {
        // FORAGE: parabolic plunge to WATER_LEVEL + 2 and climb out
        const prevPhase = data.divePhase;
        data.divePhase += dt / 3.4;
        data.angle += data.circleSpeed * 0.55 * dt;
        const p = Math.min(1, data.divePhase);
        const depth = Math.max(10, data.cy - (waterLevel + 2.5));
        targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
        targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
        targetY = data.cy - Math.sin(p * Math.PI) * depth;
        if (!data.splashed && prevPhase < 0.5 && data.divePhase >= 0.5) {
          data.splashed = true;
          out.splash = true;
        }
        const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
        const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
        wantYaw = Math.atan2(-tangX, -tangZ);
        wantPitch = -Math.cos(p * Math.PI) * 0.78;
        wantBank = 0.08 * Math.sign(data.circleSpeed);
        if (data.divePhase >= 1) {
          data.state = BIRD_STATES.SOAR;
          data.stateTimer = data.nextForageWait || 18;
        }
      }
      break;
    }

    case 'heron': {
      // Lazy figure-8 / Lissajous marsh patrol alternating CRUISE (24-38 u)
      // and low SKIM glide (8-12 u above water/reeds)
      const rate = (data.speed || 21) / (data.patrolRadius || 165);
      const prevX = curX - (data.evadeOx || 0);
      const prevZ = curZ - (data.evadeOz || 0);
      data.angle += rate * dt;
      data.stateTimer -= dt;
      if (data.stateTimer <= 0) {
        data.state =
          data.state === BIRD_STATES.SKIM
            ? BIRD_STATES.CRUISE
            : BIRD_STATES.SKIM;
        data.stateTimer = data.state === BIRD_STATES.SKIM ? 6.5 : 10.5;
      }

      const r = data.patrolRadius || 165;
      const lx = Math.sin(data.angle) * r;
      const lz = Math.sin(data.angle * 2) * r * 0.48;
      const rot = rotateXZ(lx, lz, data.rotY || 0);
      const nextX = data.cx + rot.x;
      const nextZ = data.cz + rot.z;

      if (env.getElev) {
        const slot = Math.floor(
          (env.elapsed || 0) / 0.4 + (data.flapPhase % 1)
        );
        if (slot !== data.groundSlot) {
          data.groundSlot = slot;
          data.groundY = Math.max(waterLevel, env.getElev(nextX, nextZ));
        }
      }
      const floorY = data.groundY ?? waterLevel;
      const wantAlt = floorY + (data.state === BIRD_STATES.SKIM ? 9.0 : 28.0);
      const baseCurY = curY - (data.evadeOy || 0);
      const nextY =
        baseCurY + clamp((wantAlt - baseCurY) * 1.4 * dt, -10 * dt, 10 * dt);

      const vx = (nextX - prevX) / Math.max(dt, 1e-3);
      const vz = (nextZ - prevZ) / Math.max(dt, 1e-3);
      if (vx * vx + vz * vz > 0.5) {
        const nextYaw = Math.atan2(-vx, -vz);
        const yawRate = wrapAngle(nextYaw - data.yaw) / Math.max(dt, 1e-3);
        wantYaw = nextYaw;
        wantBank = clamp(-yawRate * 0.45, -0.32, 0.32);
      }
      wantPitch = clamp((wantAlt - baseCurY) * 0.015, -0.14, 0.14);
      targetX = nextX;
      targetY = nextY;
      targetZ = nextZ;
      break;
    }

    case 'pelican': {
      // Independent wide-wheeling coastal pelicans: low swell SKIM -> high
      // baitball SOAR -> steep FORAGE plunge-dive that bob-floats in place on
      // the water while scooping fish before climbing back into orbit
      data.stateTimer -= dt;
      const swell = Math.sin((env.elapsed || 0) * 1.6 + data.angle * 3) * 1.4;
      const skimH = data.skimOffset ?? 9.5;
      const soarH = data.soarOffset ?? 68;

      if (data.state === BIRD_STATES.SKIM) {
        data.angle += data.circleSpeed * dt;
        const wantY = waterLevel + skimH + swell;
        const baseY = curY - (data.evadeOy || 0);
        targetY = baseY + clamp((wantY - baseY) * 2.2 * dt, -18 * dt, 18 * dt);
        wantPitch = clamp((wantY - baseY) * 0.02, -0.12, 0.12);
        wantBank = Math.sign(data.circleSpeed) * 0.22;
        if (data.stateTimer <= 0) {
          data.state = BIRD_STATES.SOAR;
          data.stateTimer = 6.5;
        }
      } else if (data.state === BIRD_STATES.SOAR) {
        data.angle += data.circleSpeed * dt;
        const wantY = waterLevel + soarH;
        const baseY = curY - (data.evadeOy || 0);
        targetY = baseY + clamp((wantY - baseY) * 1.5 * dt, -16 * dt, 22 * dt);
        wantPitch = clamp((wantY - baseY) * 0.015, -0.1, 0.24);
        wantBank = Math.sign(data.circleSpeed) * 0.34;
        if (data.stateTimer <= 0) {
          data.state = BIRD_STATES.FORAGE;
          data.divePhase = 0;
          data.splashed = false;
        }
      } else {
        // Plunge dive (0..0.45), stationary surface float/scoop (0.45..0.72), climb out
        const prev = data.divePhase;
        data.divePhase += dt / 4.2;
        const p = Math.min(1, data.divePhase);
        if (p < 0.45) {
          const u = p / 0.45;
          data.angle += data.circleSpeed * (1 - u * 0.85) * dt;
          targetY = waterLevel + soarH - smoothstep(u, 0, 1) * (soarH - 2);
          wantPitch = -0.82 * Math.sin(u * Math.PI);
          wantBank = 0;
        } else if (p < 0.72) {
          // Hold horizontal position on the water while bobbing on the swell
          if (!data.splashed && prev < 0.45) {
            data.splashed = true;
            out.splash = true;
          }
          targetY = waterLevel + 1.8 + swell * 0.5;
          wantPitch = 0.04;
          wantBank = 0;
        } else {
          const u = (p - 0.72) / 0.28;
          data.angle += data.circleSpeed * smoothstep(u, 0, 1) * dt;
          targetY = waterLevel + 2.0 + smoothstep(u, 0, 1) * (skimH - 2.0);
          wantPitch = 0.22;
          wantBank = Math.sign(data.circleSpeed) * 0.16;
        }
        if (data.divePhase >= 1) {
          data.state = BIRD_STATES.SKIM;
          data.stateTimer = data.nextForageWait || 22;
        }
      }

      targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
      targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
      const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
      const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
      wantYaw = Math.atan2(-tangX, -tangZ);
      break;
    }

    case 'swallow': {
      // Fast low-AGL insect-hawking Lissajous + analytical derivatives (zero dt jitter)
      const t = env.elapsed || 0;
      const w = data.dartSpeed || 1.1;
      const jf = data.jinkFreq || 3.0;
      const jp = data.jinkPhase || 0;
      const A = data.orbitA || 55;
      const B = data.orbitB || 38;

      data.angle += w * dt;
      const ca = Math.cos(data.angle);
      const sa = Math.sin(data.angle);
      const c2 = Math.cos(data.angle * 2);
      const s2 = Math.sin(data.angle * 2);
      const jinkPhase = t * jf + jp;

      const lx = ca * A + Math.sin(jinkPhase) * 9;
      const lz = s2 * B;
      const dlx = -sa * A * w + Math.cos(jinkPhase) * 9 * jf;
      const dlz = 2 * c2 * B * w;
      const ddlx = -ca * A * w * w - Math.sin(jinkPhase) * 9 * jf * jf;
      const ddlz = -4 * s2 * B * w * w;

      const cRot = Math.cos(data.orbitRot || 0);
      const sRot = Math.sin(data.orbitRot || 0);
      targetX = data.cx + lx * cRot - lz * sRot;
      targetZ = data.cz + lx * sRot + lz * cRot;
      targetY =
        data.cy +
        Math.sin(data.angle * 3 + jp) * 7.5 +
        Math.cos(t * 2.8 + data.flapPhase) * 2.5;

      const vx = dlx * cRot - dlz * sRot;
      const vz = dlx * sRot + dlz * cRot;
      const ax = ddlx * cRot - ddlz * sRot;
      const az = ddlx * sRot + ddlz * cRot;
      const vy =
        Math.cos(data.angle * 3 + jp) * 22.5 * w -
        Math.sin(t * 2.8 + data.flapPhase) * 7.0;
      const hSpd = Math.hypot(vx, vz);
      if (hSpd > 0.5) {
        wantYaw = Math.atan2(-vx, -vz);
        wantBank = clamp(-(vx * az - vz * ax) / (hSpd * 95), -0.95, 0.95);
        wantPitch = clamp(Math.atan2(vy, hSpd), -0.55, 0.55);
      }
      break;
    }

    case 'raven': {
      // Cross-wind elongated ridge-lift racecourse + analytical curvature bank
      // + playful 360 updraft rolls
      const windLiftBoost = 0.85 + 0.35 * windStrength;
      const wEff = (data.circleSpeed || 0.32) * windLiftBoost;
      data.angle += wEff * dt;
      data.nextPlayWait = (data.nextPlayWait ?? 20) - dt;
      if (data.state !== BIRD_STATES.PLAY && data.nextPlayWait <= 0) {
        data.state = BIRD_STATES.PLAY;
        data.divePhase = 0;
      }

      const L = data.ridgeHalfLen || 175;
      const W = data.ridgeWidth || 65;
      const sa = Math.sin(data.angle);
      const ca = Math.cos(data.angle);
      const along = sa * L;
      const across = ca * W;
      const dAlong = ca * L * wEff;
      const dAcross = -sa * W * wEff;
      const ddAlong = -sa * L * wEff * wEff;
      const ddAcross = -ca * W * wEff * wEff;

      const axAxis = data.axisX ?? -0.6;
      const azAxis = data.axisZ ?? 0.8;
      const perpX = -azAxis;
      const perpZ = axAxis;
      targetX = data.cx + axAxis * along + perpX * across;
      targetZ = data.cz + azAxis * along + perpZ * across;

      if (env.getElev) {
        const slot = Math.floor(
          (env.elapsed || 0) / 0.35 + (data.flapPhase % 1)
        );
        if (slot !== data.groundSlot) {
          data.groundSlot = slot;
          const sampled = Math.max(waterLevel, env.getElev(targetX, targetZ));
          data.groundY = sampled;
          if (data.smoothedGroundY === undefined) {
            data.smoothedGroundY = sampled;
          }
        }
      }
      if (data.smoothedGroundY !== undefined && data.groundY !== undefined) {
        data.smoothedGroundY +=
          (data.groundY - data.smoothedGroundY) * (1 - Math.exp(-2.6 * dt));
      }
      const groundRef = data.smoothedGroundY ?? data.groundY ?? waterLevel;
      const ridgeClear = groundRef + 55;
      const liftWave = Math.sin(data.angle * 2) * 14 * windLiftBoost;
      targetY = Math.max(ridgeClear, data.cy + liftWave);

      const vx = axAxis * dAlong + perpX * dAcross;
      const vz = azAxis * dAlong + perpZ * dAcross;
      const accX = axAxis * ddAlong + perpX * ddAcross;
      const accZ = azAxis * ddAlong + perpZ * ddAcross;
      const vy = Math.cos(data.angle * 2) * 28 * windLiftBoost * wEff;
      const hSpd = Math.hypot(vx, vz);
      if (hSpd > 0.5) {
        wantYaw = Math.atan2(-vx, -vz);
        wantPitch = clamp(Math.atan2(vy, hSpd), -0.35, 0.35);
        wantBank = clamp(-(vx * accZ - vz * accX) / (hSpd * 28), -0.58, 0.58);
      }

      if (data.state === BIRD_STATES.PLAY) {
        // Joyful ~1.1-second 360-degree axial corvid barrel roll in ridge lift!
        data.divePhase += dt / 1.05;
        const u = Math.min(1, data.divePhase);
        // Smooth C1 roll profile: 0 -> 2*PI with zero rate at entry and exit
        wantBank += smoothstep(u, 0, 1) * TAU;
        if (data.divePhase >= 1) {
          data.state = BIRD_STATES.SOAR;
          data.nextPlayWait = 18 + ((data.flapPhase * 5) % 20);
        }
      }
      break;
    }

    case 'albatross': {
      // Sweeping figure-8 dynamic soaring across the ocean wind gradient:
      // continuous 42-75 units/s airspeed (never stalls at turnarounds) with
      // exact analytical tangent & centripetal bank (zero dt jitter).
      // Climbs from wave troughs (+10 u) to +62 u while turning into -wind,
      // then banks smoothly to swoop downwind back over the swells.
      const wx = data.windX ?? 0.8;
      const wz = data.windZ ?? 0.6;
      const crossX = -wz * (data.crossSign || 1);
      const crossZ = wx * (data.crossSign || 1);

      const w = data.soarFreq || 0.17;
      const A = data.crossAmp ?? 360;
      const B = data.windAmp ?? 140;
      data.soarPhase += w * dt;

      const th = data.soarPhase;
      const s1 = Math.sin(th);
      const c1 = Math.cos(th);
      const s2 = Math.sin(th * 2);
      const c2 = Math.cos(th * 2);

      // Position relative to sea anchor (cx, cz)
      const sCross = A * s1;
      const sWind = -B * s2;
      targetX = data.cx + crossX * sCross + wx * sWind;
      targetZ = data.cz + crossZ * sCross + wz * sWind;
      targetY = waterLevel + 36 + 26 * s2;

      // Exact analytical first & second derivatives with respect to time
      const vCross = A * w * c1;
      const vWind = -2 * B * w * c2;
      const vy = 52 * w * c2;
      const aCross = -A * w * w * s1;
      const aWind = 4 * B * w * w * s2;

      const vx = crossX * vCross + wx * vWind;
      const vz = crossZ * vCross + wz * vWind;
      const accX = crossX * aCross + wx * aWind;
      const accZ = crossZ * aCross + wz * aWind;
      const hSpd = Math.hypot(vx, vz);

      if (hSpd > 0.5) {
        wantYaw = Math.atan2(-vx, -vz);
        wantPitch = clamp(Math.atan2(vy, hSpd), -0.36, 0.36);
        wantBank = clamp(-(vx * accZ - vz * accX) / (hSpd * 18), -0.78, 0.78);
      }
      break;
    }

    default:
      break;
  }

  // Apply non-goose evasion offset on top of nominal habitat trajectory
  if (data.type !== 'goose' && evadeWeight > 0) {
    targetX += data.evadeOx;
    targetY = Math.max(waterLevel + 3, targetY + data.evadeOy);
    targetZ += data.evadeOz;
    if (data.evadeT < 0.75) {
      wantYaw = lerpAngle(
        wantYaw,
        Math.atan2(-data.evadeDx, -data.evadeDz),
        evadeWeight * 0.75
      );
      wantPitch = clamp(
        wantPitch + data.evadeDy * 0.45 * evadeWeight,
        -0.7,
        0.7
      );
      wantBank = clamp(wantBank + 0.55 * evadeWeight, -0.95, 0.95);
    }
  }

  // Smoothly filter attitude angles (skip yaw/bank filter clamp during raven 360 roll)
  const attEase = 1 - Math.exp(-9.0 * dt);
  data.yaw = lerpAngle(data.yaw, wantYaw, attEase);
  data.pitch += (wantPitch - data.pitch) * attEase;
  if (data.type === 'raven' && data.state === BIRD_STATES.PLAY) {
    data.bank = wantBank + data.wakeRoll;
  } else {
    data.bank = lerpAngle(data.bank, wantBank + data.wakeRoll, attEase);
  }

  out.x = targetX;
  out.y = targetY;
  out.z = targetZ;
  out.pitch = data.pitch;
  out.yaw = data.yaw;
  out.bank = data.bank;
  return out;
}
