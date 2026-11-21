// --- BIRDS: ECOLOGY, FORMATIONS & BEHAVIOR STATE MACHINES ---
// Pure math and deterministic data structures (no three.js or DOM), shared by
// the terrain web workers (terrain-gen.js), the main-thread bird runtime
// (birds.js), and the headless simulation test suite (scripts/test-birds.js).
//
// Nine ecological archetypes tailored to Chill Flight's biomes (including
// reactive ground, marsh-reed, beach, and meadow flocks that flush on low passes):
//   - goose:     High-altitude asymmetric V/J echelons + grazing meadow flocks.
//   - hawk:      Inland thermal climber (drifts downwind while spiraling up,
//                glides upwind to next thermal) with occasional hunting stoops.
//   - seagull:   Coastal/lighthouse/sea-arch/boat wheeler + loafing beach flocks.
//   - heron:     Swamp/bayou/river skimmer & reed wader (Great Blue & White Egret).
//   - pelican:   Coastal foraging pelicans wheeling, skimming swells & plunge-fishing.
//   - swallow:   Agile low-AGL meadow/canyon/waterfall insect darter.
//   - raven:     Mountain/canyon/cuesta ridge-lift surfer with playful 360 rolls.
//   - albatross: Deep-ocean dynamic soarer carving figure-8 wind-gradient S-turns.
//   - duck:      Mallard drakes & hens dabbling in marshy reeds & calm shallows,
//                bursting off the water with splashes when startled.

const TAU = Math.PI * 2;
// Ground under each bird is probed this often (s; the caller can pass a
// slower env.floorProbeInterval for far birds), this far ahead along its
// path (s), and the bird kept this far (units) above it
const FLOOR_PROBE_INTERVAL = 0.12;
const FLOOR_PROBE_LEAD = 0.6;
const FLOOR_CLEARANCE = 6;
// The probed ground changes in steps (one new reading per probe), so the
// floor a bird keeps above follows it on a critically damped spring of this
// stiffness (1/s): its height and climb rate both change smoothly
const FLOOR_FOLLOW_OMEGA = 7;
// Airborne height also rides a stiffer spring (1/s), which rounds off the
// jumps where a flight path hands over to the next (soar -> hover -> dive ->
// climb out) without visibly lagging the dive itself
const HEIGHT_FOLLOW_OMEGA = 12;

export const BIRD_STATES = {
  ROOST: 'roost',
  FLUSH: 'flush',
  SETTLE: 'settle',
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
    drawDistSq: 5600 * 5600, // migratory V-geese use propLodSq; meadow geese use drawDistSq
    minDayFactor: 0.08,
    maxRain: 0.92,
    flapSpeed: 6.0,
    flapAmp: 0.45,
    dihedral: 0.02,
    startleRadius: 155,
    roostStartleRadius: 185,
    evadeDuration: 5.2,
    evadeDist: 105,
  },
  hawk: {
    scaleMin: 3.8,
    scaleMax: 4.4,
    drawDistSq: 6600 * 6600,
    minDayFactor: 0.14,
    maxRain: 0.65,
    flapSpeed: 5.8,
    flapAmp: 0.42,
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
    flapSpeed: 7.0,
    flapAmp: 0.42,
    dihedral: 0.03,
    startleRadius: 95,
    roostStartleRadius: 175,
    evadeDuration: 3.8,
    evadeDist: 65,
  },
  heron: {
    scaleMin: 3.6,
    scaleMax: 4.3,
    drawDistSq: 5600 * 5600,
    minDayFactor: 0.05, // active at dawn and dusk in the marshes
    maxRain: 0.85,
    flapSpeed: 3.9, // slow, deep, majestic strokes
    flapAmp: 0.54,
    dihedral: -0.04, // slightly bowed/cupped wings
    startleRadius: 125,
    roostStartleRadius: 180,
    evadeDuration: 4.6,
    evadeDist: 70,
  },
  pelican: {
    scaleMin: 3.8,
    scaleMax: 4.5,
    drawDistSq: 6000 * 6000,
    minDayFactor: 0.09,
    maxRain: 0.9,
    flapSpeed: 4.7,
    flapAmp: 0.4,
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
    flapSpeed: 11.2,
    flapAmp: 0.44,
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
    flapSpeed: 6.2,
    flapAmp: 0.43,
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
    flapSpeed: 3.4,
    flapAmp: 0.3,
    dihedral: 0.02,
    startleRadius: 120,
    evadeDuration: 4.5,
    evadeDist: 85,
  },
  duck: {
    scaleMin: 2.35,
    scaleMax: 2.85,
    drawDistSq: 4800 * 4800,
    minDayFactor: 0.06,
    maxRain: 0.95,
    flapSpeed: 8.6,
    flapAmp: 0.42,
    dihedral: 0.01,
    startleRadius: 105,
    roostStartleRadius: 175,
    evadeDuration: 3.4,
    evadeDist: 62,
  },
  plover: {
    scaleMin: 1.25,
    scaleMax: 1.55,
    drawDistSq: 3800 * 3800,
    minDayFactor: 0.07,
    maxRain: 0.9,
    flapSpeed: 9.2,
    flapAmp: 0.42,
    dihedral: -0.01,
    startleRadius: 90,
    roostStartleRadius: 170,
    evadeDuration: 3.0,
    evadeDist: 55,
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
  DUCK_MAX_NORTH: -20500,
};

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Critically damped spring step (as in Unity's SmoothDamp): moves
// data[key] toward target with its rate in data[velKey], so position and
// velocity never jump even when the target does. Stable for any dt
function springTo(data, key, velKey, target, omega, dt) {
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = data[key] - target;
  const temp = (data[velKey] + omega * change) * dt;
  data[velKey] = (data[velKey] - omega * temp) * decay;
  data[key] = target + (change + temp) * decay;
  return data[key];
}

// Smooth maximum of a and b: equals the larger one when they're far apart
// and rounds the corner over a width of k, so a path that meets the floor
// bends up onto it instead of kinking
function smoothMax(a, b, k) {
  if (k <= 0) return a > b ? a : b;
  const d = a - b;
  return (a + b + Math.sqrt(d * d + k * k)) * 0.5;
}

// First-order ease of a toward b at the given rate (1/s), frame-rate independent
function easeToward(a, b, rate, dt) {
  return a + (b - a) * (1 - Math.exp(-rate * dt));
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
  snowFactor = 0,
  desertFactor = 0,
  isAlienChunk = false,
  lighthousePos = null,
  sailboatPositions = null,
  rockArchPositions = null,
  pierPositions = null,
  reedPositions = null,
  isClearGround = null,
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
        flapSpeed: rand(6.4, 7.6),
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
          flapSpeed: rand(4.4, 5.1),
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
          flapSpeed: rand(10.5, 12.2),
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
          flapSpeed: rand(5.8, 6.8),
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
        flapSpeed: rand(5.4, 6.4),
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
    const flockChunkX = Math.round(worldOffsetX / chunkSize);
    const flockChunkZ = Math.round(worldOffsetZ / chunkSize);
    const flockId =
      ((flockChunkX & 0x7fff) << 16) | (flockChunkZ & 0x7fff) || 1;

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
        flockId,
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
        flapSpeed: 6.0 + rand(-0.04, 0.04),
        flapDuration: 1000.0,
        soarDuration: 0.0,
        weatherSeed: rng(),
      });
    }
  }

  // 7. Reactive ground, marsh-reed, sandy-beach & open-meadow roosting flocks:
  // birds rest with folded wings (idle dabbling, stalking, hopping, or grazing)
  // and scatter skyward when a low-flying aircraft or rally vehicle approaches.
  const windYaw = Math.atan2(wx, wz);
  const roostPlaced = [];
  const pushRoostBird = (opts) => {
    const minSepSq = (opts.minSep || 7.2) * (opts.minSep || 7.2);
    for (let k = 0; k < roostPlaced.length; k++) {
      const dx = roostPlaced[k].x - opts.x;
      const dz = roostPlaced[k].z - opts.z;
      if (dx * dx + dz * dz < minSepSq) return false;
    }
    roostPlaced.push({x: opts.x, z: opts.z});
    const ryaw = wrapAngle(windYaw + rand(-0.7, 0.7));
    birds.push({
      type: opts.type,
      variant: opts.variant || 0,
      scale: opts.scale,
      homeRoost: true,
      state: BIRD_STATES.ROOST,
      wingFold: 1,
      x: opts.x,
      y: opts.y,
      z: opts.z,
      roostX: opts.x,
      roostY: opts.y,
      roostZ: opts.z,
      roostClear: opts.roostClear ?? 0.62,
      roostWater: Boolean(opts.roostWater),
      roostYaw: ryaw,
      rotY: ryaw,
      shoreTangX: opts.shoreTangX ?? 1,
      shoreTangZ: opts.shoreTangZ ?? 0,
      shoreUpX: opts.shoreUpX ?? 0,
      shoreUpZ: opts.shoreUpZ ?? -1,
      idleSeed: rng() * TAU,
      flushDelay: rand(0, 0.25),
      scatterAngle: rand(-0.48, 0.48),
      cx: opts.x,
      cy: opts.y + opts.orbitHeight,
      cz: opts.z,
      circleRadius: opts.circleRadius,
      circleSpeed: opts.circleSpeed,
      patrolRadius: opts.patrolRadius || 155,
      speed: opts.speed || 28,
      angle: rng() * TAU,
      flapPhase: rng() * TAU,
      flapSpeed: opts.flapSpeed,
      flapDuration: opts.flapDuration,
      soarDuration: opts.soarDuration,
      stateTimer: rand(8, 20),
      nextForageWait: rand(14, 28),
      weatherSeed: rng(),
    });
    return true;
  };

  // 7a. Marshy reeds & calm shallows: Mallard duck rafts + stalking herons/egrets
  const hasReeds = reedPositions && reedPositions.length > 0;
  if (hasReeds && worldOffsetZ >= HABITAT_LIMITS.DUCK_MAX_NORTH) {
    if (rng() < 0.58) {
      const reed = reedPositions[Math.floor(rng() * reedPositions.length)];
      const baseX = worldOffsetX + (reed.x || 0);
      const baseZ = worldOffsetZ + (reed.z || 0);
      const duckCount = 4 + Math.floor(rng() * 4); // 4..7 Mallards
      const dirSign = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < duckCount; i++) {
        // Sample around the reed clump to place ducks in actual shallow water
        let dx = 0;
        let dz = 0;
        let foundWater = false;
        for (let s = 0; s < 12; s++) {
          const ang = rng() * TAU;
          const dist = rand(8, 38);
          const tx = baseX + Math.cos(ang) * dist;
          const tz = baseZ + Math.sin(ang) * dist;
          if (getElev(tx, tz) <= waterLevel - 0.35) {
            dx = tx;
            dz = tz;
            foundWater = true;
            break;
          }
        }
        if (!foundWater) continue;
        pushRoostBird({
          type: 'duck',
          variant: rng() < 0.54 ? 0 : 1, // Drake & Hen Mallards
          scale: rand(1.55, 1.85),
          minSep: 6.5,
          x: dx,
          y: waterLevel + 0.36,
          z: dz,
          roostClear: 0.36,
          roostWater: true,
          orbitHeight: rand(34, 52),
          circleRadius: rand(72, 118),
          circleSpeed: rand(0.36, 0.52) * dirSign,
          speed: rand(31, 38),
          flapSpeed: rand(8.2, 9.4),
          flapDuration: rand(2.4, 3.8),
          soarDuration: rand(1.1, 2.0),
        });
      }
    }

    if (rng() < 0.36) {
      const reed = reedPositions[Math.floor(rng() * reedPositions.length)];
      const baseX = worldOffsetX + (reed.x || 0);
      const baseZ = worldOffsetZ + (reed.z || 0);
      const waderCount = rng() < 0.36 ? 2 : 1;
      const variant = rng() < 0.48 ? 1 : 0; // Great Egret or Great Blue Heron
      for (let i = 0; i < waderCount; i++) {
        const wxSpot = baseX + rand(-10, 10) + i * 12;
        const wzSpot = baseZ + rand(-10, 10) - i * 9;
        const elev = getElev(wxSpot, wzSpot);
        if (elev >= waterLevel - 1.2 && elev <= waterLevel + 2.0) {
          const waderScale = rand(1.85, 2.2);
          const waderClear = 2.15 * waderScale;
          pushRoostBird({
            type: 'heron',
            variant,
            scale: waderScale,
            minSep: 9.0,
            x: wxSpot,
            y: Math.max(waterLevel - 0.35, elev) + waderClear,
            z: wzSpot,
            roostClear: waderClear,
            roostWater: elev < waterLevel + 0.1,
            orbitHeight: rand(24, 38),
            circleRadius: rand(120, 175),
            circleSpeed: rand(0.16, 0.24) * (rng() < 0.5 ? 1 : -1),
            patrolRadius: rand(135, 195),
            speed: rand(19, 23),
            flapSpeed: rand(3.7, 4.3),
            flapDuration: rand(5.5, 8.5),
            soarDuration: rand(2.2, 4.0),
          });
        }
      }
    }
  } else if (
    worldOffsetZ >= HABITAT_LIMITS.DUCK_MAX_NORTH &&
    waterShare >= 0.05 &&
    waterShare <= 0.78 &&
    snowFactor < 0.35 &&
    desertFactor < 0.3 &&
    swampFactor < 0.25 &&
    rng() < 0.2
  ) {
    // Calm temperate pond/lake/river shallows outside the bayou
    for (let s = 0; s < 8; s++) {
      const tx = worldOffsetX + rand(-0.4, 0.4) * chunkSize;
      const tz = worldOffsetZ + rand(-0.4, 0.4) * chunkSize;
      const th = getElev(tx, tz);
      if (th < waterLevel - 3.2 || th > waterLevel - 0.4) continue;
      if (isClearGround && !isClearGround(tx, tz, false)) continue;
      // Confirm shoreline proximity within 42 units so ducks hug calm banks
      const nearBank =
        getElev(tx + 42, tz) > waterLevel + 0.4 ||
        getElev(tx - 42, tz) > waterLevel + 0.4 ||
        getElev(tx, tz + 42) > waterLevel + 0.4 ||
        getElev(tx, tz - 42) > waterLevel + 0.4;
      if (!nearBank) continue;

      const duckCount = 4 + Math.floor(rng() * 3); // 4..6 Mallards
      const dirSign = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < duckCount; i++) {
        const dx = tx + rand(-16, 16);
        const dz = tz + rand(-16, 16);
        if (getElev(dx, dz) > waterLevel - 0.3) continue;
        pushRoostBird({
          type: 'duck',
          variant: rng() < 0.54 ? 0 : 1,
          scale: rand(1.55, 1.85),
          minSep: 6.5,
          x: dx,
          y: waterLevel + 0.36,
          z: dz,
          roostClear: 0.36,
          roostWater: true,
          orbitHeight: rand(34, 52),
          circleRadius: rand(72, 118),
          circleSpeed: rand(0.36, 0.52) * dirSign,
          speed: rand(31, 38),
          flapSpeed: rand(8.2, 9.4),
          flapDuration: rand(2.4, 3.8),
          soarDuration: rand(1.1, 2.0),
        });
      }
      break;
    }
  }

  // 7b. Sandy beaches & sandbars: scurrying Piping Plovers & loafing Coastal Gulls
  if (
    worldOffsetZ >= HABITAT_LIMITS.GULL_MAX_NORTH &&
    waterShare >= 0.08 &&
    waterShare <= 0.92 &&
    snowFactor < 0.4 &&
    swampFactor < 0.25 &&
    rng() < 0.68
  ) {
    // Try up to 3 wet-to-dry bisection rays so narrow beaches on coastal
    // headlands and islands (like Montauk) are reliably discovered
    for (let ray = 0; ray < 3; ray++) {
      let wetX = 0;
      let wetZ = 0;
      let hasWet = false;
      let dryX = 0;
      let dryZ = 0;
      let hasDry = false;
      for (let s = 0; s < 14 && (!hasWet || !hasDry); s++) {
        const px = worldOffsetX + rand(-0.44, 0.44) * chunkSize;
        const pz = worldOffsetZ + rand(-0.44, 0.44) * chunkSize;
        const ph = getElev(px, pz);
        if (!hasWet && ph < waterLevel - 0.5) {
          wetX = px;
          wetZ = pz;
          hasWet = true;
        } else if (!hasDry && ph > waterLevel + 2.6) {
          dryX = px;
          dryZ = pz;
          hasDry = true;
        }
      }
      if (!hasWet || !hasDry) continue;

      let ax = wetX;
      let az = wetZ;
      let bx0 = dryX;
      let bz0 = dryZ;
      for (let step = 0; step < 6; step++) {
        const mx = (ax + bx0) * 0.5;
        const mz = (az + bz0) * 0.5;
        if (getElev(mx, mz) < waterLevel + 1.5) {
          ax = mx;
          az = mz;
        } else {
          bx0 = mx;
          bz0 = mz;
        }
      }
      const tx = (ax + bx0) * 0.5;
      const tz = (az + bz0) * 0.5;
      const th = getElev(tx, tz);
      const hE = getElev(tx + 12, tz);
      const hW = getElev(tx - 12, tz);
      const hN = getElev(tx, tz - 12);
      const hS = getElev(tx, tz + 12);
      const slopeSpan = Math.max(hE, hW, hN, hS) - Math.min(hE, hW, hN, hS);

      if (
        th < waterLevel + 0.35 ||
        th > waterLevel + 5.4 ||
        slopeSpan > 5.0 ||
        (isClearGround && !isClearGround(tx, tz, false))
      ) {
        continue;
      }

      // Shoreline tangent & upslope unit vectors
      const gradX = hE - hW;
      const gradZ = hS - hN;
      const gLen = Math.hypot(gradX, gradZ) || 1;
      const upX = gradX / gLen;
      const upZ = gradZ / gLen;
      const tangX = -upZ;
      const tangZ = upX;
      const dirSign = rng() < 0.5 ? 1 : -1;
      const beachRoll = rng();
      const spawnPlovers = beachRoll < 0.62;
      const spawnGulls = beachRoll >= 0.38;

      if (spawnPlovers) {
        // Scurrying Piping Plovers right down along the wet surf line
        const ploverCount = 6 + Math.floor(rng() * 5); // 6..10 plovers
        for (let i = 0; i < ploverCount; i++) {
          for (let attempt = 0; attempt < 4; attempt++) {
            const along = rand(-34, 34);
            const across = rand(-8, 2);
            const bx = tx + tangX * along + upX * across;
            const bz = tz + tangZ * along + upZ * across;
            const by = getElev(bx, bz);
            if (by < waterLevel + 0.2 || by > waterLevel + 2.8) continue;
            if (isClearGround && !isClearGround(bx, bz, false)) continue;
            const ploverScale = rand(1.25, 1.55);
            const ploverClear = 1.12 * ploverScale;
            const tangSign = rng() < 0.5 ? 1 : -1;
            if (
              pushRoostBird({
                type: 'plover',
                scale: ploverScale,
                minSep: 4.8,
                x: bx,
                y: by + ploverClear,
                z: bz,
                roostClear: ploverClear,
                roostWater: false,
                shoreTangX: tangX * tangSign,
                shoreTangZ: tangZ * tangSign,
                shoreUpX: upX,
                shoreUpZ: upZ,
                orbitHeight: rand(18, 30),
                circleRadius: rand(38, 66),
                circleSpeed: rand(0.58, 0.82) * dirSign,
                speed: rand(28, 35),
                flapSpeed: rand(8.8, 9.8),
                flapDuration: rand(1.8, 3.0),
                soarDuration: rand(0.8, 1.5),
              })
            ) {
              break;
            }
          }
        }
      }

      if (spawnGulls) {
        // Loafing Coastal Gulls standing on open beach sand
        const gullOffset = spawnPlovers ? 42 : 0;
        const gullCount = 5 + Math.floor(rng() * 5); // 5..9 beach gulls
        for (let i = 0; i < gullCount; i++) {
          for (let attempt = 0; attempt < 5; attempt++) {
            const along = gullOffset + rand(-30, 30);
            const across = rand(-6, 3);
            const bx = tx + tangX * along + upX * across;
            const bz = tz + tangZ * along + upZ * across;
            const by = getElev(bx, bz);
            if (by < waterLevel + 0.35 || by > waterLevel + 3.4) continue;
            if (isClearGround && !isClearGround(bx, bz, false)) continue;
            const gullScale = rand(1.55, 1.9);
            const gullClear = 0.98 * gullScale;
            if (
              pushRoostBird({
                type: 'seagull',
                scale: gullScale,
                minSep: 7.2,
                x: bx,
                y: by + gullClear,
                z: bz,
                roostClear: gullClear,
                roostWater: false,
                shoreTangX: tangX,
                shoreTangZ: tangZ,
                shoreUpX: upX,
                shoreUpZ: upZ,
                orbitHeight: rand(44, 72),
                circleRadius: rand(52, 92),
                circleSpeed: rand(0.38, 0.56) * dirSign,
                speed: rand(25, 31),
                flapSpeed: rand(6.4, 7.6),
                flapDuration: rand(2.0, 3.6),
                soarDuration: rand(3.2, 5.6),
              })
            ) {
              break;
            }
          }
        }
      }
      break;
    }
  }

  // 7c. Open temperate meadows & pastures: foraging Canada Geese gaggles
  if (
    worldOffsetZ >= HABITAT_LIMITS.DUCK_MAX_NORTH &&
    waterShare < 0.45 &&
    snowFactor < 0.25 &&
    desertFactor < 0.2 &&
    swampFactor < 0.2 &&
    rng() < (farmFactor > 0.2 ? 0.28 : 0.16)
  ) {
    for (let s = 0; s < 8; s++) {
      const tx = worldOffsetX + rand(-0.4, 0.4) * chunkSize;
      const tz = worldOffsetZ + rand(-0.4, 0.4) * chunkSize;
      const th = getElev(tx, tz);
      if (th < waterLevel + 6 || th > waterLevel + 150) continue;
      if (isClearGround && !isClearGround(tx, tz, true)) continue;

      const hE = getElev(tx + 16, tz);
      const hW = getElev(tx - 16, tz);
      const hN = getElev(tx, tz - 16);
      const hS = getElev(tx, tz + 16);
      if (Math.max(hE, hW, hN, hS) - Math.min(hE, hW, hN, hS) > 3.0) continue;

      const gaggleSize = 5 + Math.floor(rng() * 4); // 5..8 grazing geese
      const dirSign = rng() < 0.5 ? 1 : -1;
      for (let i = 0; i < gaggleSize; i++) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const gx = tx + rand(-24, 24);
          const gz = tz + rand(-24, 24);
          const gy = getElev(gx, gz);
          if (gy < waterLevel + 4) continue;
          if (isClearGround && !isClearGround(gx, gz, true)) continue;
          const gooseScale = rand(1.75, 2.05);
          const gooseClear = 1.16 * gooseScale;
          if (
            pushRoostBird({
              type: 'goose',
              scale: gooseScale,
              minSep: 8.2,
              x: gx,
              y: gy + gooseClear,
              z: gz,
              roostClear: gooseClear,
              roostWater: false,
              orbitHeight: rand(52, 82),
              circleRadius: rand(88, 142),
              circleSpeed: rand(0.28, 0.42) * dirSign,
              speed: rand(34, 42),
              flapSpeed: rand(5.8, 6.4),
              flapDuration: rand(3.8, 5.8),
              soarDuration: rand(1.4, 2.6),
            })
          ) {
            break;
          }
        }
      }
      break;
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

// Evaluates whether a grounded, marsh-wading, or water-resting bird at
// `(bx, by, bz)` is startled into flight (`FLUSH`) by a low-flying aircraft or
// approaching ground/hover vehicle. High-altitude overflights (>145 u above)
// pass peacefully overhead without spooking flocks on the ground.
export function evaluateRoostThreat(bx, by, bz, aircraft, baseRadius, out) {
  out.triggered = false;
  out.wake = false;
  out.dx = 0;
  out.dy = 0;
  out.dz = 0;
  out.strength = 0;
  if (!aircraft || !aircraft.active) return out;

  const altAbove = aircraft.y - by;
  if (altAbove < -35 || altAbove > 145) return out;

  const rx = bx - aircraft.x;
  const rz = bz - aircraft.z;
  const hDistSq = rx * rx + rz * rz;

  const speedBoost = clamp(aircraft.speed / 120, 0.72, 1.42);
  const jetMult = aircraft.isJet ? 1.2 : 1.0;
  const effRadius = (baseRadius || 175) * speedBoost * jetMult;

  if (hDistSq < effRadius * effRadius) {
    const hDist = Math.sqrt(hDistSq);
    let radX = hDist > 1e-3 ? rx / hDist : -aircraft.fz;
    let radZ = hDist > 1e-3 ? rz / hDist : aircraft.fx;

    // Lateral peel-off perpendicular to vehicle heading so flocks dead ahead
    // split apart into a natural wave on either side of the flight line
    const fLen = Math.hypot(aircraft.fx, aircraft.fz);
    let fx = fLen > 1e-3 ? aircraft.fx / fLen : 0;
    let fz = fLen > 1e-3 ? aircraft.fz / fLen : -1;
    const crossSide = rx * -fz + rz * fx >= 0 ? 1 : -1;
    const latX = -fz * crossSide;
    const latZ = fx * crossSide;

    let escX = radX * 0.58 + latX * 0.42;
    let escZ = radZ * 0.58 + latZ * 0.42;
    const escLen = Math.hypot(escX, escZ) || 1;
    escX /= escLen;
    escZ /= escLen;

    out.triggered = true;
    out.dx = escX;
    out.dy = 0.48;
    out.dz = escZ;
    out.strength = 1 - hDist / effRadius;
    return out;
  }

  // Low high-speed pass whose trailing wake sweeps across the roost
  if (aircraft.speed > 85 && hDistSq < 235 * 235) {
    const along =
      rx * aircraft.fx + (by - aircraft.y) * aircraft.fy + rz * aircraft.fz;
    if (along < -10 && along > -220) {
      const distSq = hDistSq + altAbove * altAbove;
      const radialSq = Math.max(0, distSq - along * along);
      const wakeR = 54 * (aircraft.isJet ? 1.2 : 1.0);
      if (radialSq < wakeR * wakeR) {
        const hDist = Math.sqrt(hDistSq) || 1;
        out.triggered = true;
        out.wake = true;
        out.dx = rx / hDist;
        out.dy = 0.45;
        out.dz = rz / hDist;
        out.strength = 0.7;
      }
    }
  }
  return out;
}

// --- WING KINEMATICS ---
// Incrementally integrates each bird's wingbeat phase (`data.wingPhase += rate * dt`)
// and applies C1 exponential smoothing (`data.wingFlap`) so time-varying flap rates
// during `FLUSH` or `EVADE` never wind phase backwards with global `elapsed` time,
// and state transitions (`FLUSH -> SOAR`, `SOAR -> FORAGE`, `SETTLE`) never snap.
function stepWingKinematics(data, spec, dt) {
  const baseSpeed = data.flapSpeed || spec.flapSpeed;
  let targetFlap;
  if (data.state === BIRD_STATES.ROOST) {
    targetFlap = 0;
  } else if (data.state === BIRD_STATES.FLUSH) {
    if ((data.flushT ?? 0) < 0) {
      targetFlap = 0.08;
    } else {
      const u = clamp((data.flushT || 0) / (data.flushDur || 3.3), 0, 1);
      const urgency = 1 - u * 0.65;
      const rate = baseSpeed * (1.1 + 0.24 * urgency);
      const amp = spec.flapAmp * (1.04 + 0.14 * urgency);
      data.wingPhase = (data.wingPhase + rate * dt) % TAU;
      targetFlap = spec.dihedral + Math.sin(data.wingPhase) * amp;
    }
  } else if (data.state === BIRD_STATES.SETTLE) {
    const p = data.settlePhase || 0;
    if (p < 0.72) {
      targetFlap = spec.dihedral * 1.3;
    } else {
      const flare = Math.sin(clamp((p - 0.72) / 0.26, 0, 1) * Math.PI);
      data.wingPhase = (data.wingPhase + baseSpeed * 0.95 * dt) % TAU;
      targetFlap =
        spec.dihedral + Math.sin(data.wingPhase) * spec.flapAmp * 0.72 * flare;
    }
  } else if (data.evadeT > 0) {
    const urgency = 1 - clamp(data.evadeT / spec.evadeDuration, 0, 1);
    const rate = baseSpeed * (1.12 + 0.25 * urgency);
    const amp = spec.flapAmp * (1.04 + 0.16 * urgency);
    data.wingPhase = (data.wingPhase + rate * dt) % TAU;
    targetFlap = spec.dihedral + Math.sin(data.wingPhase) * amp;
  } else if (
    data.type === 'pelican' &&
    data.state === BIRD_STATES.FORAGE &&
    data.divePhase >= 0.45 &&
    data.divePhase < 0.72
  ) {
    // Pelicans floating stationary on water hold wings gently tucked
    targetFlap = 0.04;
  } else if (data.state === BIRD_STATES.FORAGE && data.divePhase < 0.55) {
    // Plunge-diving gulls & pelicans sweep wings back during descent
    targetFlap = -0.18;
  } else if (data.state === BIRD_STATES.PLAY) {
    // Ravens tuck wings briefly mid-barrel-roll
    targetFlap = 0.05;
  } else {
    const flapDur = data.flapDuration ?? 3.0;
    const soarDur = data.soarDuration ?? 4.0;
    data.wingPhase = (data.wingPhase + baseSpeed * dt) % TAU;
    if (soarDur <= 0.01) {
      targetFlap = spec.dihedral + Math.sin(data.wingPhase) * spec.flapAmp;
    } else {
      const effSoar =
        data.state === BIRD_STATES.THERMAL || data.state === BIRD_STATES.SKIM
          ? soarDur * 1.45
          : soarDur;
      const total = flapDur + effSoar;
      data.wingCycleT = (data.wingCycleT + dt) % total;
      if (data.wingCycleT > flapDur) {
        targetFlap = spec.dihedral;
      } else {
        const fade = Math.min(0.65, flapDur * 0.35);
        let env = 1;
        if (data.wingCycleT < fade) env = smoothstep(data.wingCycleT, 0, fade);
        else if (flapDur - data.wingCycleT < fade) {
          env = smoothstep(flapDur - data.wingCycleT, 0, fade);
        }
        targetFlap =
          spec.dihedral + Math.sin(data.wingPhase) * spec.flapAmp * env;
      }
    }
  }

  const flapEase = (16.0 * dt) / (1 + 16.0 * dt);
  data.wingFlap += (targetFlap - data.wingFlap) * flapEase;
  return data.wingFlap;
}

// Returns the right-wing rotation angle `flap` (radians; left wing uses `-flap`
// on mirrored wing geometry so dihedral & flap stay symmetric).
export function computeWingFlap(data, elapsed) {
  if (data.wingFlap !== undefined) {
    return data.wingFlap;
  }
  const spec = BIRD_SPECIES[data.type] || BIRD_SPECIES.seagull;
  if (data.state === BIRD_STATES.ROOST) return 0;
  const baseSpeed = data.flapSpeed || spec.flapSpeed;
  return (
    spec.dihedral +
    Math.sin((elapsed || 0) * baseSpeed + (data.flapPhase || 0)) * spec.flapAmp
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

// Fixed-size zero-allocation ring buffer of recent migratory goose V-flock
// startle events so startling one bird ripples an outward peel-break wave
// across the rest of its V-echelon (`flockId`).
const FLOCK_ALERT_SLOTS = 8;
const _flockAlertIds = new Int32Array(FLOCK_ALERT_SLOTS);
const _flockAlertTimes = new Float64Array(FLOCK_ALERT_SLOTS);
const _flockAlertAx = new Float32Array(FLOCK_ALERT_SLOTS);
const _flockAlertAz = new Float32Array(FLOCK_ALERT_SLOTS);
const _flockAlertFx = new Float32Array(FLOCK_ALERT_SLOTS);
const _flockAlertFz = new Float32Array(FLOCK_ALERT_SLOTS);
const _flockAlertStr = new Float32Array(FLOCK_ALERT_SLOTS);
let _flockAlertCursor = 0;

function broadcastGooseFlockAlert(flockId, elapsed, aircraft, strength) {
  for (let i = 0; i < FLOCK_ALERT_SLOTS; i++) {
    if (
      _flockAlertIds[i] === flockId &&
      Math.abs(elapsed - _flockAlertTimes[i]) < 1.2
    ) {
      if (strength > _flockAlertStr[i]) _flockAlertStr[i] = strength;
      return;
    }
  }
  const idx = _flockAlertCursor;
  _flockAlertCursor = (_flockAlertCursor + 1) % FLOCK_ALERT_SLOTS;
  _flockAlertIds[idx] = flockId;
  _flockAlertTimes[idx] = elapsed;
  _flockAlertAx[idx] = aircraft.x;
  _flockAlertAz[idx] = aircraft.z;
  _flockAlertFx[idx] = aircraft.fx;
  _flockAlertFz[idx] = aircraft.fz;
  _flockAlertStr[idx] = strength;
}

function findGooseFlockAlert(flockId, elapsed) {
  for (let i = 0; i < FLOCK_ALERT_SLOTS; i++) {
    if (_flockAlertIds[i] !== flockId) continue;
    const age = elapsed - _flockAlertTimes[i];
    if (age >= -0.05 && age <= 0.85) return i;
  }
  return -1;
}

// --- PER-BIRD STATE MACHINE & TRAJECTORY STEP ---
// Updates `data` in place and writes the new world pose `{x, y, z, pitch, yaw,
// bank, wingFold, splash, flushed, gooseStartled, visible}` into `out` with zero heap allocations.
export function stepBirdState(data, curX, curY, curZ, env, rawDelta, out) {
  const dt = clamp(rawDelta, 0, 0.1);
  // Paths that climb or sink from the current height carry on from their
  // own height, not the eased one drawn (see HEIGHT_FOLLOW_OMEGA)
  if (data.ySm !== undefined && data.pathY !== undefined) curY = data.pathY;
  const spec = BIRD_SPECIES[data.type] || BIRD_SPECIES.seagull;
  out.splash = false;
  out.flushed = false;
  out.gooseStartled = false;
  out.wingFold = data.wingFold ?? (data.state === BIRD_STATES.ROOST ? 1 : 0);
  out.flap = data.wingFlap ?? 0;

  // Diurnal & storm visibility check (migratory geese still advance position
  // when hidden by distance LOD, handled by the caller; night puts birds to roost)
  const isMigratoryGoose = data.type === 'goose' && !data.homeRoost;
  const day = env.dayFactor ?? 1;
  const rain = env.rain ?? 0;
  const weatherClear =
    rain <= spec.maxRain ||
    (data.weatherSeed ?? 0.5) >
      (rain - spec.maxRain) / (1 - spec.maxRain + 1e-4);
  out.visible = day > spec.minDayFactor && weatherClear;
  if (day <= spec.minDayFactor && !isMigratoryGoose) {
    out.x = curX;
    out.y = curY;
    out.z = curZ;
    out.pitch = 0;
    out.yaw = data.yaw ?? data.rotY ?? 0;
    out.bank = 0;
    return out;
  }

  // Initialize lazy runtime fields once (including pre-seeded states like ROOST)
  if (!data._init) {
    data._init = true;
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
    }
    data.wingFold = data.wingFold ?? (data.state === BIRD_STATES.ROOST ? 1 : 0);
    data.wingPhase = data.flapPhase || 0;
    data.wingCycleT = (data.flapPhase || 0) * 1.9;
    data.wingFlap = data.state === BIRD_STATES.ROOST ? 0 : spec.dihedral;
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

  const isRoostOrSettle =
    data.state === BIRD_STATES.ROOST || data.state === BIRD_STATES.SETTLE;

  // 1a. Grounded / marsh / beach roost startle check (`ROOST` or `SETTLE` -> `FLUSH`)
  if (isRoostOrSettle && env.checkAircraft) {
    evaluateRoostThreat(
      curX,
      curY,
      curZ,
      env.aircraft,
      spec.roostStartleRadius || 175,
      _threat
    );
    if (_threat.triggered) {
      const sa = data.scatterAngle || 0;
      const cs = Math.cos(sa);
      const ss = Math.sin(sa);
      const fdx = _threat.dx * cs - _threat.dz * ss;
      const fdz = _threat.dx * ss + _threat.dz * cs;
      const fromSettle = data.state === BIRD_STATES.SETTLE;

      data.state = BIRD_STATES.FLUSH;
      data.flushT = fromSettle ? 0 : -(data.flushDelay || 0);
      data.flushDur = 3.1 + ((data.idleSeed || 0) % 0.75);
      data.flushDx = fdx;
      data.flushDz = fdz;
      data.flushSpeed =
        (data.type === 'heron' ? 23 : 38) * (0.9 + 0.25 * _threat.strength);
      data.flushClimb =
        (data.type === 'heron' ? 11.5 : 16.5) * (0.9 + 0.25 * _threat.strength);
      data.flushedEmitted = false;
      data.orbitTimeLeft = 24 + ((data.idleSeed || 0) % 10);
      data.evadeT = 0;
      data.evadeOx = 0;
      data.evadeOy = 0;
      data.evadeOz = 0;
      if (data.type === 'goose') {
        out.gooseStartled = true;
      }
    }
  }

  const inGroundCycle =
    data.state === BIRD_STATES.ROOST ||
    data.state === BIRD_STATES.FLUSH ||
    data.state === BIRD_STATES.SETTLE;

  // 1b. Airborne aircraft proximity & wake turbulence check
  if (
    !inGroundCycle &&
    env.checkAircraft &&
    data.evadeT <= 0 &&
    !(data.evadeDelay > 0)
  ) {
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
      data.evadeDelay = 0;
      data.evadeDx = _threat.dx;
      data.evadeDy = _threat.dy;
      data.evadeDz = _threat.dz;
      data.evadeMag = spec.evadeDist * (0.65 + 0.55 * _threat.strength);
      if (_threat.wake) {
        data.wakeRoll = (_threat.dx >= 0 ? 1 : -1) * 0.75 * _threat.strength;
      }
      if (data.type === 'goose') {
        out.gooseStartled = true;
      }
      if (isMigratoryGoose) {
        data.state = BIRD_STATES.EVADE;
        if (data.flockId) {
          const alertClock = env.elapsed ?? 0;
          broadcastGooseFlockAlert(
            data.flockId,
            alertClock,
            env.aircraft,
            _threat.strength
          );
          data.lastFlockAlertTime = alertClock;
        }
      }
      if (data.homeRoost) {
        data.orbitTimeLeft = Math.max(data.orbitTimeLeft || 0, 20);
      }
    }
  }

  // 1c. Propagate V-formation alarm ripple across fellow geese in the same skein
  if (
    isMigratoryGoose &&
    data.flockId &&
    data.evadeT <= 0 &&
    !(data.evadeDelay > 0)
  ) {
    const slotIdx = findGooseFlockAlert(data.flockId, env.elapsed ?? 0);
    if (slotIdx >= 0 && data.lastFlockAlertTime !== _flockAlertTimes[slotIdx]) {
      data.lastFlockAlertTime = _flockAlertTimes[slotIdx];
      const ax = _flockAlertAx[slotIdx];
      const az = _flockAlertAz[slotIdx];
      const afx = _flockAlertFx[slotIdx];
      const afz = _flockAlertFz[slotIdx];
      const aStr = _flockAlertStr[slotIdx];

      // Peel outward along this bird's arm of the V + away from aircraft's path
      const rx = curX - ax;
      const rz = curZ - az;
      const along = rx * afx + rz * afz;
      let latX = rx - along * afx;
      let latZ = rz - along * afz;
      const latLen = Math.hypot(latX, latZ) || 1;
      latX /= latLen;
      latZ /= latLen;

      const armSign =
        data.slotRight < -1
          ? -1
          : data.slotRight > 1
            ? 1
            : (data.weatherSeed ?? 0.5) < 0.5
              ? -1
              : 1;
      const wingOutX = Math.cos(data.rotY) * armSign;
      const wingOutZ = -Math.sin(data.rotY) * armSign;
      let mixX = latX * 0.75 + wingOutX * 0.35;
      let mixZ = latZ * 0.75 + wingOutZ * 0.35;
      const awayDot = mixX * latX + mixZ * latZ;
      if (awayDot < 0.4) {
        mixX += latX * (0.4 - awayDot);
        mixZ += latZ * (0.4 - awayDot);
      }
      const seed = data.weatherSeed ?? 0.5;
      const vert = (seed - 0.42) * 0.68;
      const norm = Math.hypot(mixX, vert, mixZ) || 1;

      data.evadeDx = mixX / norm;
      data.evadeDy = vert / norm;
      data.evadeDz = mixZ / norm;
      data.evadeMag =
        spec.evadeDist * (0.55 + 0.4 * aStr) * (0.85 + 0.3 * seed);
      data.evadeDelay = Math.min(0.24, Math.max(0.02, (data.row || 0) * 0.04));
      data.state = BIRD_STATES.EVADE;
    }
  }

  if (!inGroundCycle && data.evadeDelay > 0) {
    data.evadeDelay -= dt;
    if (data.evadeDelay <= 0) {
      data.evadeDelay = 0;
      data.evadeT = 0.001;
    }
  }

  // Advance evasion impulse & wake-vortex roll decay
  let evadeWeight = 0;
  if (!inGroundCycle && data.evadeT > 0) {
    data.evadeT += dt;
    if (data.evadeT >= spec.evadeDuration) {
      data.evadeT = 0;
      data.evadeOx = 0;
      data.evadeOy = 0;
      data.evadeOz = 0;
      if (isMigratoryGoose) data.state = BIRD_STATES.CRUISE;
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
  } else if (
    isMigratoryGoose &&
    data.state === BIRD_STATES.EVADE &&
    !(data.evadeDelay > 0)
  ) {
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

  // --- 2A. REACTIVE ROOST / FLUSH / SETTLE STATES ---
  if (data.state === BIRD_STATES.ROOST) {
    data.wingFold += (1 - data.wingFold) * (1 - Math.exp(-8.0 * dt));
    const t = env.elapsed || 0;
    const seed = data.idleSeed || 0;
    const rx0 = data.roostX ?? curX;
    const ry0 = data.roostY ?? curY;
    const rz0 = data.roostZ ?? curZ;
    const ryaw = data.roostYaw ?? 0;

    if (data.type === 'duck') {
      // Lazy marsh-reed figure-8 paddling + water swell bob + dabbling dips
      const ph = t * 0.42 + seed;
      const lx = Math.sin(ph) * 2.8;
      const lz = Math.sin(ph * 2) * 1.5;
      const vx = Math.cos(ph) * 2.8 * 0.42;
      const vz = Math.cos(ph * 2) * 3.0 * 0.42;
      let nx = rx0 + lx;
      let nz = rz0 + lz;
      if (env.getElev && env.getElev(nx, nz) > waterLevel - 0.15) {
        nx = rx0;
        nz = rz0;
      }
      targetX = nx;
      targetZ = nz;
      targetY = ry0 + Math.sin(t * 1.9 + seed) * 0.14;
      if (vx * vx + vz * vz > 0.02) {
        wantYaw = Math.atan2(-vx, -vz);
      }
      const cyc = (t + seed * 2.1) % 5.6;
      if (cyc < 0.95) {
        wantPitch = -0.42 * Math.sin((cyc / 0.95) * Math.PI);
      }
    } else if (data.type === 'heron') {
      // Upright reed-bed wading posture with slow watchful scans & fishing strikes
      targetX = rx0;
      targetZ = rz0;
      targetY = ry0 + (data.roostWater ? Math.sin(t * 1.7 + seed) * 0.04 : 0);
      wantYaw = ryaw + Math.sin(t * 0.48 + seed) * 0.32;
      wantPitch = 0;
      const cyc = (t + seed * 3.1) % 7.4;
      if (cyc < 0.55) {
        wantPitch = -0.46 * Math.sin((cyc / 0.55) * Math.PI);
      }
    } else if (data.type === 'plover') {
      // Signature Piping Plover surf-line run-stop-peck scurry along the wet sand
      const cyc = (t + seed * 1.3) % 4.6;
      const txDir = data.shoreTangX ?? 1;
      const tzDir = data.shoreTangZ ?? 0;
      const uxDir = data.shoreUpX ?? 0;
      const uzDir = data.shoreUpZ ?? -1;
      let sAlong;
      let sUp = 0;
      let hop = 0;
      let dirSign;
      if (cyc < 1.15) {
        const u = cyc / 1.15;
        sAlong = -3.8 + 7.6 * smoothstep(u, 0, 1);
        sUp = -1.1 * Math.sin(u * Math.PI);
        hop = Math.abs(Math.sin(t * 22 + seed)) * 0.1;
        dirSign = 1;
      } else if (cyc < 2.3) {
        sAlong = 3.8;
        dirSign = 1;
        if (cyc > 1.45 && cyc < 1.85) {
          wantPitch = -0.44 * Math.sin(((cyc - 1.45) / 0.4) * Math.PI);
        }
      } else if (cyc < 3.45) {
        const u = (cyc - 2.3) / 1.15;
        sAlong = 3.8 - 7.6 * smoothstep(u, 0, 1);
        sUp = 0.9 * Math.sin(u * Math.PI);
        hop = Math.abs(Math.sin(t * 22 + seed)) * 0.1;
        dirSign = -1;
      } else {
        sAlong = -3.8;
        dirSign = -1;
        if (cyc > 3.75 && cyc < 4.15) {
          wantPitch = -0.44 * Math.sin(((cyc - 3.75) / 0.4) * Math.PI);
        }
      }
      targetX = rx0 + txDir * sAlong + uxDir * sUp;
      targetZ = rz0 + tzDir * sAlong + uzDir * sUp;
      const dh = env.getElev
        ? env.getElev(targetX, targetZ) - env.getElev(rx0, rz0)
        : 0;
      targetY = Math.max(waterLevel + 0.35, ry0 + dh) + hop;
      wantYaw = Math.atan2(-txDir * dirSign, -tzDir * dirSign);
    } else if (data.type === 'seagull') {
      // Beach loafing with periodic little hops and sand-pecking dips
      const walkPh = t * 0.28 + seed;
      targetX = rx0 + Math.cos(walkPh) * 1.5;
      targetZ = rz0 + Math.sin(walkPh * 1.3) * 1.5;
      const cyc = (t + seed * 1.7) % 6.2;
      let hopY = 0;
      if (cyc < 0.52) {
        hopY = 0.78 * Math.sin((cyc / 0.52) * Math.PI);
        wantPitch = 0.12;
      } else if (cyc > 2.2 && cyc < 2.85) {
        wantPitch = -0.34 * Math.sin(((cyc - 2.2) / 0.65) * Math.PI);
      }
      const dh = env.getElev
        ? env.getElev(targetX, targetZ) - env.getElev(rx0, rz0)
        : 0;
      targetY = Math.max(waterLevel + 0.4, ry0 + dh) + hopY;
      wantYaw = ryaw + Math.sin(walkPh * 0.8) * 0.42;
    } else {
      // Grazing meadow geese: slow pasture walk + grass-pecking dips
      const walkPh = t * 0.22 + seed;
      const vx = -Math.sin(walkPh) * 2.4 * 0.22;
      const vz = Math.cos(walkPh) * 1.8 * 0.22;
      targetX = rx0 + Math.cos(walkPh) * 2.4;
      targetZ = rz0 + Math.sin(walkPh) * 1.8;
      const dh = env.getElev
        ? env.getElev(targetX, targetZ) - env.getElev(rx0, rz0)
        : 0;
      targetY = Math.max(waterLevel + 1.0, ry0 + dh);
      wantYaw =
        vx * vx + vz * vz > 0.01
          ? lerpAngle(ryaw, Math.atan2(-vx, -vz), 0.35)
          : ryaw;
      const cyc = (t + seed * 1.9) % 4.8;
      if (cyc < 1.35) {
        wantPitch = -0.48 * Math.sin((cyc / 1.35) * Math.PI);
      }
    }
  } else if (data.state === BIRD_STATES.FLUSH) {
    const prevT = data.flushT ?? 0;
    data.flushT = prevT + dt;
    if (data.flushT < 0) {
      // Staggered pre-jump alert crouch (0..250 ms) so the flock lifts as a wave
      data.wingFold += (0.72 - data.wingFold) * (1 - Math.exp(-14.0 * dt));
      wantYaw = Math.atan2(-data.flushDx, -data.flushDz);
      wantPitch = 0.16;
    } else {
      if (!data.flushedEmitted) {
        data.flushedEmitted = true;
        out.flushed = true;
        if (
          data.roostWater &&
          (!env.getElev || env.getElev(curX, curZ) <= waterLevel + 0.2)
        ) {
          out.splash = true;
        }
      }
      data.wingFold = clamp(1 - data.flushT / 0.2, 0, 1);
      const dur = data.flushDur || 3.3;
      const u = clamp(data.flushT / dur, 0, 1);

      // Gentle arc onto orbit direction while climbing steeply away
      const turnRate = (data.circleSpeed || 0.36) * 0.45 * u * dt;
      const ct = Math.cos(turnRate);
      const st = Math.sin(turnRate);
      const nx = data.flushDx * ct - data.flushDz * st;
      const nz = data.flushDx * st + data.flushDz * ct;
      data.flushDx = nx;
      data.flushDz = nz;

      const hSpd = (data.flushSpeed || 36) * (1 - 0.18 * u);
      const vSpd = (data.flushClimb || 15) * (1 - 0.78 * u * u);
      targetX = curX + nx * hSpd * dt;
      targetZ = curZ + nz * hSpd * dt;
      let minFloor = waterLevel + 1.5;
      if (env.getElev) {
        minFloor = Math.max(minFloor, env.getElev(targetX, targetZ) + 2.0);
      }
      targetY = Math.max(minFloor, curY + vSpd * dt);

      wantYaw = Math.atan2(-nx, -nz);
      wantPitch = clamp(Math.atan2(vSpd, hSpd) * 1.1, 0.06, 0.52);
      wantBank =
        Math.sign(data.circleSpeed || 1) * 0.34 * smoothstep(u, 0.22, 1.0);

      if (data.flushT >= dur) {
        data.wingFold = 0;
        if (data.type === 'heron') {
          // C0-exact handoff into Lissajous marsh patrol (`lx = lz = 0` at angle 0)
          data.cx = targetX;
          data.cz = targetZ;
          data.cy = targetY;
          data.angle = 0;
          data.rotY = Math.atan2(-nx, -nz);
          data.state = BIRD_STATES.CRUISE;
          data.stateTimer = 8.5;
        } else {
          // C1-exact position + tangent handoff onto overhead wheeling circle
          const sign = Math.sign(data.circleSpeed || 0.38) || 1;
          const R = data.circleRadius || 85;
          data.angle = Math.atan2(-nx * sign, nz * sign);
          data.cx = targetX - Math.cos(data.angle) * R;
          data.cz = targetZ - Math.sin(data.angle) * R;
          data.cy = targetY;
          data.state = BIRD_STATES.SOAR;
          data.stateTimer = data.nextForageWait || 18;
        }
      }
    }
  } else if (data.state === BIRD_STATES.SETTLE) {
    data.settlePhase = (data.settlePhase || 0) + dt / (data.settleDur || 4.5);
    const p = clamp(data.settlePhase, 0, 1);
    const s = smoothstep(p, 0, 1);
    const sx0 = data.settleStartX ?? curX;
    const sy0 = data.settleStartY ?? curY;
    const sz0 = data.settleStartZ ?? curZ;
    const rx0 = data.roostX ?? curX;
    const ry0 = data.roostY ?? curY;
    const rz0 = data.roostZ ?? curZ;

    targetX = sx0 + (rx0 - sx0) * s;
    targetZ = sz0 + (rz0 - sz0) * s;
    const descent = 1 - Math.pow(1 - p, 1.65);
    targetY = sy0 + (ry0 - sy0) * descent;
    data.wingFold = p > 0.82 ? smoothstep(p, 0.82, 1.0) : 0;

    const dx = rx0 - sx0;
    const dz = rz0 - sz0;
    const appYaw =
      dx * dx + dz * dz > 1 ? Math.atan2(-dx, -dz) : data.roostYaw || 0;
    wantYaw =
      p > 0.76
        ? lerpAngle(appYaw, data.roostYaw ?? appYaw, smoothstep(p, 0.76, 1.0))
        : appYaw;
    wantPitch = p < 0.74 ? -0.14 : 0.18 * (1 - smoothstep(p, 0.92, 1.0));
    wantBank = 0;

    if (data.settlePhase >= 1) {
      data.state = BIRD_STATES.ROOST;
      data.wingFold = 1;
      if (
        data.roostWater &&
        (!env.getElev || env.getElev(targetX, targetZ) <= waterLevel + 0.2)
      ) {
        out.splash = true;
      }
    }
  } else {
    data.wingFold = 0;

    // --- 2B. AIRBORNE ARCHETYPE BEHAVIORS ---
    switch (data.type) {
      case 'goose': {
        if (data.homeRoost) {
          // Flushed meadow geese wheel cohesively over their pasture before resettling
          data.angle += (data.circleSpeed || 0.34) * dt;
          targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
          targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
          targetY = data.cy + Math.sin(data.angle * 2 + data.flapPhase) * 4.5;
          const sign = Math.sign(data.circleSpeed || 1);
          const tangX = -Math.sin(data.angle) * sign;
          const tangZ = Math.cos(data.angle) * sign;
          wantYaw = Math.atan2(-tangX, -tangZ);
          wantPitch = 0.03;
          wantBank = sign * 0.28;
          break;
        }
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
          // Bank and pitch into evasion peel-break, then counter-bank back into V
          const escaping = data.evadeT < 0.8 ? 1 : -0.45;
          const sideDot =
            data.evadeDx * Math.cos(data.rotY) -
            data.evadeDz * Math.sin(data.rotY);
          wantYaw = data.rotY - sideDot * 0.56 * evadeWeight * escaping;
          wantPitch = clamp(
            wantPitch + data.evadeDy * 0.45 * evadeWeight * escaping,
            -0.35,
            0.42
          );
          wantBank = -sideDot * 0.68 * evadeWeight * escaping;
        }
        break;
      }

      case 'hawk': {
        // State cycle: THERMAL (spiral climb + downwind drift) <-> GLIDE (upwind
        // return) + occasional FORAGE stoop
        data.nextStoopWait = (data.nextStoopWait ?? 40) - dt;
        // Circle size and turn rate per state, eased so the hawk swings
        // wider or tighter instead of jumping sideways when it changes state
        const hawkRad =
          data.state === BIRD_STATES.THERMAL
            ? 1
            : data.state === BIRD_STATES.FORAGE
              ? 0.85
              : 0.6;
        const hawkRate =
          data.state === BIRD_STATES.THERMAL
            ? 1
            : data.state === BIRD_STATES.FORAGE
              ? 1.25
              : 0.5;
        if (data.radMul === undefined) {
          data.radMul = hawkRad;
          data.radMulV = 0;
        }
        springTo(data, 'radMul', 'radMulV', hawkRad, 1.2, dt);
        data.rateMul = easeToward(data.rateMul ?? hawkRate, hawkRate, 2, dt);
        const hawkR = data.circleRadius * data.radMul;
        // The circle's centre drifts downwind in a thermal and heads home in
        // a glide; its velocity is eased too, so the hawk doesn't lurch
        const homeDx = (data.homeX ?? data.cx) - data.cx;
        const homeDz = (data.homeZ ?? data.cz) - data.cz;
        const homeDist = Math.hypot(homeDx, homeDz);
        let driftX = 0;
        let driftZ = 0;
        if (data.state === BIRD_STATES.THERMAL) {
          driftX = windVx * 0.28;
          driftZ = windVz * 0.28;
        } else if (data.state === BIRD_STATES.GLIDE && homeDist > 1) {
          const glideSpeed = Math.min(34, homeDist * 0.8);
          driftX = (homeDx / homeDist) * glideSpeed;
          driftZ = (homeDz / homeDist) * glideSpeed;
        }
        data.driftVx = easeToward(data.driftVx ?? driftX, driftX, 1.5, dt);
        data.driftVz = easeToward(data.driftVz ?? driftZ, driftZ, 1.5, dt);
        data.cx += data.driftVx * dt;
        data.cz += data.driftVz * dt;
        if (data.state === BIRD_STATES.THERMAL) {
          data.angle += data.circleSpeed * data.rateMul * dt;
          // (the thermal column drifts gently downwind while the hawk climbs)
          data.cy += (data.climbRate || 8) * dt;
          if (data.cy >= (data.thermalTop || data.homeY + 120)) {
            data.state =
              data.nextStoopWait <= 0 ? BIRD_STATES.FORAGE : BIRD_STATES.GLIDE;
            data.divePhase = 0;
            if (data.state === BIRD_STATES.FORAGE) {
              data.nextStoopWait = 38 + ((data.flapPhase * 7) % 25);
            }
          }
          targetX = data.cx + Math.cos(data.angle) * hawkR;
          targetZ = data.cz + Math.sin(data.angle) * hawkR;
          targetY = data.cy;
          const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
          const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
          wantYaw = Math.atan2(-tangX, -tangZ);
          wantPitch = 0.06;
          wantBank = Math.sign(data.circleSpeed) * 0.36;
        } else if (data.state === BIRD_STATES.FORAGE) {
          // Swift shallow raptor stoop and zoom recovery
          data.divePhase += dt / 3.4;
          data.angle += data.circleSpeed * data.rateMul * dt;
          const stoopDrop =
            Math.sin(Math.min(1, data.divePhase) * Math.PI) * 85;
          targetX = data.cx + Math.cos(data.angle) * hawkR;
          targetZ = data.cz + Math.sin(data.angle) * hawkR;
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
          if (homeDist > 8) {
            wantYaw = Math.atan2(-homeDx, -homeDz);
          }
          data.cy = Math.max(data.homeY ?? 220, data.cy - 14 * dt);
          data.angle += data.circleSpeed * data.rateMul * dt;
          targetX = data.cx + Math.cos(data.angle) * hawkR;
          targetZ = data.cz + Math.sin(data.angle) * hawkR;
          targetY = data.cy;
          wantPitch = -0.09;
          wantBank = Math.sign(data.circleSpeed) * 0.16;
          if (homeDist <= 22 && data.cy <= (data.homeY ?? 220) + 8) {
            data.state = BIRD_STATES.THERMAL;
          }
        }
        break;
      }

      case 'seagull': {
        // SOAR wheeling -> brief upwind KITE hover -> parabolic FORAGE dive to water
        // (the gull slows into the hover and speeds back up rather than
        // switching speed in one frame)
        const gullRate =
          data.state === BIRD_STATES.KITE
            ? 0.18
            : data.state === BIRD_STATES.FORAGE
              ? 0.55
              : 1;
        if (data.rateMul === undefined) {
          data.rateMul = gullRate;
          data.rateMulV = 0;
        }
        springTo(data, 'rateMul', 'rateMulV', gullRate, 4, dt);
        if (data.state === BIRD_STATES.SOAR) {
          data.angle += data.circleSpeed * data.rateMul * dt;
          data.stateTimer -= dt;
          targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
          targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
          targetY = data.cy + Math.sin(data.angle * 2 + data.flapPhase) * 6;
          const tangX = -Math.sin(data.angle) * Math.sign(data.circleSpeed);
          const tangZ = Math.cos(data.angle) * Math.sign(data.circleSpeed);
          wantYaw = Math.atan2(-tangX, -tangZ);
          wantBank = Math.sign(data.circleSpeed) * 0.32;
          if (data.stateTimer <= 0 && data.cy > waterLevel + 24) {
            // Only plunge for fish over the water, not over the shore or a cliff
            if ((data.floorY ?? waterLevel) > waterLevel + 0.5) {
              data.stateTimer = 1.5;
              break;
            }
            data.state = BIRD_STATES.KITE;
            data.divePhase = 0;
          }
        } else if (data.state === BIRD_STATES.KITE) {
          // Turn nose into the wind and hover-flutter for 1.1s spotting fish
          data.divePhase += dt / 1.1;
          data.angle += data.circleSpeed * data.rateMul * dt;
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
          data.angle += data.circleSpeed * data.rateMul * dt;
          const p = Math.min(1, data.divePhase);
          const depth = Math.max(10, data.cy - (waterLevel + 2.5));
          targetX = data.cx + Math.cos(data.angle) * data.circleRadius;
          targetZ = data.cz + Math.sin(data.angle) * data.circleRadius;
          targetY = data.cy - Math.sin(p * Math.PI) * depth;
          if (!data.splashed && prevPhase < 0.5 && data.divePhase >= 0.5) {
            data.splashed = true;
            out.splash = (data.floorY ?? waterLevel) <= waterLevel + 0.5;
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
          targetY =
            baseY + clamp((wantY - baseY) * 2.2 * dt, -18 * dt, 18 * dt);
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
          targetY =
            baseY + clamp((wantY - baseY) * 1.5 * dt, -16 * dt, 22 * dt);
          wantPitch = clamp((wantY - baseY) * 0.015, -0.1, 0.24);
          wantBank = Math.sign(data.circleSpeed) * 0.34;
          if (data.stateTimer <= 0) {
            if ((data.floorY ?? waterLevel) > waterLevel + 0.5) {
              // Over the shore: wheel on and try again a moment later
              data.stateTimer = 1.5;
            } else {
              data.state = BIRD_STATES.FORAGE;
              data.divePhase = 0;
              data.splashed = false;
              // (dive from wherever it is: still climbing, or lifted
              // over a headland, it may be well off its soar height)
              data.diveFromY = curY - (data.evadeOy || 0);
            }
          }
        } else {
          // Plunge dive (0..0.45), stationary surface float/scoop (0.45..0.72), climb out
          const prev = data.divePhase;
          data.divePhase += dt / 4.2;
          const p = Math.min(1, data.divePhase);
          if (p < 0.45) {
            const u = p / 0.45;
            data.angle += data.circleSpeed * (1 - u * 0.85) * (1 - u * u) * dt;
            const fromY = data.diveFromY ?? waterLevel + soarH;
            targetY = fromY - smoothstep(u, 0, 1) * (fromY - waterLevel - 2);
            wantPitch = -0.82 * Math.sin(u * Math.PI);
            wantBank = 0;
          } else if (p < 0.72) {
            // Hold horizontal position on the water while bobbing on the swell
            if (!data.splashed && prev < 0.45) {
              data.splashed = true;
              out.splash = (data.floorY ?? waterLevel) <= waterLevel + 0.5;
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

      case 'duck': {
        // Brisk low-altitude wheeling orbit over marsh reeds or pond shallows
        const w = data.circleSpeed || 0.42;
        const R = data.circleRadius || 88;
        data.angle += w * dt;
        targetX = data.cx + Math.cos(data.angle) * R;
        targetZ = data.cz + Math.sin(data.angle) * R;
        targetY = data.cy + Math.sin(data.angle * 2 + data.flapPhase) * 3.5;
        const sign = Math.sign(w) || 1;
        const tangX = -Math.sin(data.angle) * sign;
        const tangZ = Math.cos(data.angle) * sign;
        wantYaw = Math.atan2(-tangX, -tangZ);
        wantPitch = 0.04;
        wantBank = sign * 0.36;
        break;
      }

      case 'plover': {
        // Nimble low-altitude shorebird wheeling with steep synchronized banks
        const w = data.circleSpeed || 0.68;
        const R = data.circleRadius || 52;
        data.angle += w * dt;
        targetX = data.cx + Math.cos(data.angle) * R;
        targetZ = data.cz + Math.sin(data.angle) * R;
        targetY = data.cy + Math.sin(data.angle * 2 + data.flapPhase) * 2.5;
        const sign = Math.sign(w) || 1;
        const tangX = -Math.sin(data.angle) * sign;
        const tangZ = Math.cos(data.angle) * sign;
        wantYaw = Math.atan2(-tangX, -tangZ);
        wantPitch = 0.03;
        wantBank = sign * 0.48;
        break;
      }

      default:
        break;
    }

    // Flushed ground/marsh flocks eventually glide back down to their roost
    // once the player has flown well clear
    if (
      data.homeRoost &&
      data.state !== BIRD_STATES.FORAGE &&
      data.state !== BIRD_STATES.KITE
    ) {
      data.orbitTimeLeft = (data.orbitTimeLeft ?? 24) - dt;
      if (data.orbitTimeLeft <= 0) {
        let safeToLand = true;
        if (env.checkAircraft && env.aircraft && env.aircraft.active) {
          const adx = (data.roostX ?? targetX) - env.aircraft.x;
          const adz = (data.roostZ ?? targetZ) - env.aircraft.z;
          if (adx * adx + adz * adz < 240 * 240) {
            safeToLand = false;
            data.orbitTimeLeft = 8;
          }
        }
        if (safeToLand) {
          data.state = BIRD_STATES.SETTLE;
          data.settleStartX = targetX;
          data.settleStartY = targetY;
          data.settleStartZ = targetZ;
          data.settlePhase = 0;
          const distHome = Math.hypot(
            (data.roostX ?? targetX) - targetX,
            (data.roostZ ?? targetZ) - targetZ
          );
          data.settleDur = clamp(distHome / 28, 3.4, 6.8);
        }
      }
    }
  }

  // Apply non-migratory-goose evasion offset on top of nominal airborne trajectory
  if (!isMigratoryGoose && !inGroundCycle && evadeWeight > 0) {
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

  // Keep every bird above the ground: the flight paths above are drawn round
  // a centre point with water level as their floor, but a coastal circle or a
  // meadow orbit crosses shores, hills and cliffs. The ground under the bird
  // and a little ahead of it is probed a few times a second (staggered), and
  // the bird is lifted smoothly over it
  if (env.getElev) {
    const interval = env.floorProbeInterval || FLOOR_PROBE_INTERVAL;
    const slot = Math.floor(
      (env.elapsed || 0) / interval + (data.flapPhase || 0) / TAU
    );
    if (slot !== data.floorSlot) {
      data.floorSlot = slot;
      const lead = FLOOR_PROBE_LEAD / Math.max(dt, 1e-3);
      const aheadX = targetX + (targetX - curX) * lead;
      const aheadZ = targetZ + (targetZ - curZ) * lead;
      data.floorY = Math.max(
        waterLevel,
        env.getElev(targetX, targetZ),
        env.getElev(aheadX, aheadZ)
      );
      // Height to keep above: clear of the land, or just over open water
      // (where a plunge-diver may touch the surface), blended across the
      // shoreline so it doesn't jump there
      const floorFor = Math.max(
        waterLevel + 1,
        data.floorY +
          FLOOR_CLEARANCE * smoothstep(data.floorY, waterLevel, waterLevel + 2)
      );
      data.floorFrom =
        data.floorTo === undefined ? floorFor : (data.floorAt ?? floorFor);
      data.floorTo = floorFor;
      data.floorT = 0;
    } else {
      data.floorT = (data.floorT || 0) + dt;
    }
    // Slide from the last reading to the new one over one probe interval,
    // so the floor moves continuously instead of stepping at each probe
    data.floorAt =
      data.floorTo === undefined
        ? waterLevel + 1
        : data.floorFrom +
          (data.floorTo - data.floorFrom) * clamp(data.floorT / interval, 0, 1);
    if (inGroundCycle) {
      data.floorSm = undefined;
      const minSurface = Math.max(
        waterLevel + 0.3,
        env.getElev(targetX, targetZ) + 0.3
      );
      if (targetY < minSurface) targetY = minSurface;
    } else {
      const floorY = data.floorAt;
      if (data.type === 'goose' && !data.homeRoost) {
        // (migratory geese keep their own 250-unit climb; this only stops a cliff face)
        if (targetY < floorY) targetY = floorY;
      } else {
        // Follow the floor on a spring so a bird rides up over a ridge with
        // no jolts, then round the corner where its own path meets the floor
        // (only over land, so a plunge still reaches the water)
        if (data.floorSm === undefined) {
          data.floorSm = floorY;
          data.floorVel = 0;
        }
        const floorSm = springTo(
          data,
          'floorSm',
          'floorVel',
          floorY,
          FLOOR_FOLLOW_OMEGA,
          dt
        );
        const round = 8 * smoothstep(floorSm, waterLevel + 1, waterLevel + 7);
        targetY = smoothMax(targetY, floorSm, round);
        // (last resort on a sheer cliff the spring can't climb in time:
        // never below the latest reading of the ground itself)
        const hardFloor = data.floorTo - FLOOR_CLEARANCE;
        if (targetY < hardFloor) {
          targetY = hardFloor;
          if (data.floorSm < hardFloor) {
            data.floorSm = hardFloor;
            data.floorVel = Math.max(0, data.floorVel);
          }
        }
      }
    }
  }

  // Ease the height through hand-overs between flight paths (each path is
  // smooth, but the next one starts a few metres off). Ground hopping and
  // perching keep their exact heights
  data.pathY = targetY;
  if (inGroundCycle || (data.type === 'goose' && !data.homeRoost)) {
    data.ySm = undefined;
  } else if (
    data.ySm === undefined ||
    Math.abs(data.ySm - targetY) > 60 ||
    !(data.ySm === data.ySm)
  ) {
    // (first frame, or back from a pause: start where the path is)
    data.ySm = targetY;
    data.yVel = 0;
  } else {
    targetY = springTo(data, 'ySm', 'yVel', targetY, HEIGHT_FOLLOW_OMEGA, dt);
    // (still never below the last reading of the ground)
    if (data.floorTo !== undefined && env.getElev) {
      const hardFloor = data.floorTo - FLOOR_CLEARANCE;
      if (targetY < hardFloor) {
        targetY = data.ySm = hardFloor;
        data.yVel = Math.max(0, data.yVel);
      }
    }
  }

  // Smoothly filter attitude angles (skip yaw/bank filter clamp during raven 360 roll)
  const attEase = (9.0 * dt) / (1 + 9.0 * dt);
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
  out.wingFold = data.wingFold;
  out.flap = stepWingKinematics(data, spec, dt);
  return out;
}
