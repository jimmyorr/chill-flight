#!/usr/bin/env node
/**
 * scripts/test-birds.js
 *
 * Deterministic unit, ecological habitat, behavioral state-machine, 3D rig,
 * aircraft-evasion/wake, and performance tests for Chill Flight's 8-species
 * bird system (birds-logic.js & bird-models.js).
 */
import {
  BIRD_SPECIES,
  BIRD_STATES,
  computeWingFlap,
  evaluateAircraftThreat,
  generateChunkBirds,
  stepBirdState,
} from '../birds-logic.js';
import {
  assembleBird,
  birdVertexColorMat,
  getBirdPropParts,
  writeBirdMatrices,
} from '../bird-models.js';

console.log(
  'Testing expanded 8-species bird ecology, behaviors, and 3D rigs...'
);

let failed = false;
function check(name, cond, detail = '') {
  if (cond) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAIL: ${name}${detail ? ` (${detail})` : ''}`);
    failed = true;
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WATER = 45.5;

// --- 1. HABITAT ECOLOGY & DETERMINISM ---
{
  const rngA = mulberry32(20261121);
  const rngB = mulberry32(20261121);
  const sampleArgs = {
    worldOffsetX: -7500,
    worldOffsetZ: 3000,
    chunkSize: 1200,
    waterLevel: WATER,
    waterShare: 0.42,
    minElev: 20,
    maxElev: 95,
    swampFactor: 0,
    farmFactor: 0.3,
    canyonFactor: 0,
    fallsFactor: 0,
    isAlienChunk: false,
    lighthousePos: {x: 40, y: 85, z: -30},
    pierPositions: [{x: 0, z: 0}],
    windDirX: 0.8,
    windDirZ: 0.6,
    getElev: (x) => (x < -7500 ? 30 : 65),
  };
  const runA = generateChunkBirds({...sampleArgs, rng: rngA});
  const runB = generateChunkBirds({...sampleArgs, rng: rngB});
  check(
    'generateChunkBirds is 100% deterministic for a fixed seed',
    JSON.stringify(runA) === JSON.stringify(runB) && runA.length > 0,
    `len=${runA.length}`
  );

  const alienBirds = generateChunkBirds({
    ...sampleArgs,
    isAlienChunk: true,
    rng: mulberry32(7),
  });
  check('Alien biome chunks spawn zero earth birds', alienBirds.length === 0);

  const polarBirds = generateChunkBirds({
    ...sampleArgs,
    worldOffsetZ: -30000,
    waterShare: 0.5,
    lighthousePos: {x: 0, y: 80, z: 0},
    rng: mulberry32(9),
  });
  check(
    'Extreme frozen pack-ice north (-30000 Z) excludes temperate/sub-boreal birds',
    polarBirds.length === 0,
    `len=${polarBirds.length}`
  );

  // Sweep chunks per biome to confirm all 8 archetypes & heron/egret morphs appear
  const rng = mulberry32(1337);
  const counts = {};
  let sawBlueHeron = false;
  let sawWhiteEgret = false;

  for (let i = 0; i < 80; i++) {
    // Swamp / bayou
    for (const b of generateChunkBirds({
      worldOffsetX: -9000,
      worldOffsetZ: 8000,
      chunkSize: 1200,
      waterLevel: WATER,
      waterShare: 0.35,
      minElev: 43,
      maxElev: 54,
      swampFactor: 0.75,
      getElev: () => 46,
      rng,
    })) {
      counts[b.type] = (counts[b.type] || 0) + 1;
      if (b.type === 'heron' && b.variant === 0) sawBlueHeron = true;
      if (b.type === 'heron' && b.variant === 1) sawWhiteEgret = true;
    }
    // Coastal surf with pier & sea arch
    for (const b of generateChunkBirds({
      worldOffsetX: -6000,
      worldOffsetZ: 4000,
      chunkSize: 1200,
      waterLevel: WATER,
      waterShare: 0.55,
      minElev: 20,
      maxElev: 90,
      pierPositions: [{x: 10, z: 10}],
      rockArchPositions: [{x: -50, z: 40}],
      getElev: (x) => (x < -6000 ? 28 : 60),
      rng,
    })) {
      counts[b.type] = (counts[b.type] || 0) + 1;
    }
    // Deep open ocean
    for (const b of generateChunkBirds({
      worldOffsetX: 25000,
      worldOffsetZ: 5000,
      chunkSize: 1200,
      waterLevel: WATER,
      waterShare: 0.99,
      minElev: 5,
      maxElev: 20,
      getElev: () => 10,
      rng,
    })) {
      counts[b.type] = (counts[b.type] || 0) + 1;
    }
    // Farmland meadows
    for (const b of generateChunkBirds({
      worldOffsetX: -1500,
      worldOffsetZ: 1200,
      chunkSize: 1200,
      waterLevel: WATER,
      waterShare: 0.0,
      minElev: 55,
      maxElev: 85,
      farmFactor: 0.7,
      getElev: () => 68,
      rng,
    })) {
      counts[b.type] = (counts[b.type] || 0) + 1;
    }
    // Mountain ridge & canyon
    for (const b of generateChunkBirds({
      worldOffsetX: -2500,
      worldOffsetZ: -2500,
      chunkSize: 1200,
      waterLevel: WATER,
      waterShare: 0.0,
      minElev: 90,
      maxElev: 290,
      canyonFactor: 0.45,
      windDirX: 0.8,
      windDirZ: 0.6,
      getElev: () => 210,
      rng,
    })) {
      counts[b.type] = (counts[b.type] || 0) + 1;
    }
  }

  const allEight = Object.keys(BIRD_SPECIES).every((k) => (counts[k] || 0) > 0);
  check(
    'All 8 bird species spawn in their respective habitats',
    allEight,
    JSON.stringify(counts)
  );
  check(
    'Bayou/marsh habitat spawns both Great Blue Heron and Great White Egret morphs',
    sawBlueHeron && sawWhiteEgret
  );
}

// --- 2. AIRCRAFT AWARENESS & WAKE TURBULENCE ---
{
  const out = {};
  // Plane at (0, 200, 0) flying due North (0, 0, -1) at 150 u/s
  const plane = {
    active: true,
    x: 0,
    y: 200,
    z: 0,
    fx: 0,
    fy: 0,
    fz: -1,
    speed: 150,
    isJet: false,
  };

  // Bird dead ahead on nose line at (0, 202, -70)
  evaluateAircraftThreat(0, 202, -70, plane, 100, out);
  const forwardDot = Math.abs(
    out.dx * plane.fx + out.dy * plane.fy + out.dz * plane.fz
  );
  check(
    'Startled bird ahead of aircraft breaks laterally off flight path (not straight ahead)',
    out.triggered && !out.wake && Math.abs(out.dx) > 0.7 && forwardDot < 0.25,
    `dir=(${out.dx.toFixed(2)}, ${out.dy.toFixed(2)}, ${out.dz.toFixed(2)})`
  );

  // Jet acoustic reach vs slow prop reach at 135 units distance
  const propOut = {};
  const jetOut = {};
  evaluateAircraftThreat(
    0,
    200,
    -135,
    {...plane, speed: 90, isJet: false},
    105,
    propOut
  );
  evaluateAircraftThreat(
    0,
    200,
    -135,
    {...plane, speed: 220, isJet: true},
    105,
    jetOut
  );
  check(
    'High-speed jet startles birds from farther out than a slow prop cruiser',
    !propOut.triggered && jetOut.triggered
  );

  // Wake vortex cone 140 units behind tail (+Z = +140), 22 units off axis
  const wakeOut = {};
  evaluateAircraftThreat(22, 200, 140, {...plane, speed: 170}, 95, wakeOut);
  check(
    'Fast aircraft trailing wake cone triggers wake turbulence scatter behind tail',
    wakeOut.triggered &&
      wakeOut.wake &&
      wakeOut.dx > 0.7 &&
      wakeOut.strength > 0.1,
    JSON.stringify(wakeOut)
  );
}

// --- 3. ARCHETYPE STATE MACHINES & FLIGHT PHYSICS ---
{
  const pose = {};
  const baseEnv = {
    elapsed: 0,
    dayFactor: 0.8,
    rain: 0,
    windDirX: 0.8,
    windDirZ: 0.6,
    windStrength: 1.0,
    waterLevel: WATER,
    getElev: () => 50,
    aircraft: {active: false},
    checkAircraft: false,
  };

  // 3a. Goose: terrain lookahead climb + V-split evasion + exact regroup
  const goose = {
    type: 'goose',
    x: 25,
    y: 300,
    z: 35,
    leaderX: 0,
    leaderY: 300,
    leaderZ: 0,
    slotRight: 25,
    slotBack: 35,
    slotWorldX: 25,
    slotWorldZ: 35,
    rotY: 0,
    speed: 60,
    row: 1,
    flapPhase: 0.5,
    flapSpeed: 8.4,
    flapDuration: 1000,
    soarDuration: 0,
  };
  let gx = goose.x;
  let gy = goose.y;
  let gz = goose.z;
  // High mountain ahead at elevation 400 -> minClearance = 650
  for (let i = 0; i < 180; i++) {
    stepBirdState(
      goose,
      gx,
      gy,
      gz,
      {...baseEnv, elapsed: i / 60, getElev: () => 400},
      1 / 60,
      pose
    );
    gx = pose.x;
    gy = pose.y;
    gz = pose.z;
  }
  check(
    'Goose climbs smoothly toward 250-unit terrain clearance over mountains',
    gy > 370 && pose.pitch > 0,
    `gy=${gy.toFixed(1)}, pitch=${pose.pitch.toFixed(3)}`
  );

  // Buzz the goose with an aircraft -> V-split evade -> regroup back to V-slot
  const buzzEnv = {
    ...baseEnv,
    checkAircraft: true,
    aircraft: {
      active: true,
      x: gx - 10,
      y: gy,
      z: gz + 30,
      fx: 0,
      fy: 0,
      fz: -1,
      speed: 180,
      isJet: true,
    },
  };
  stepBirdState(goose, gx, gy, gz, buzzEnv, 1 / 60, pose);
  gx = pose.x;
  gy = pose.y;
  gz = pose.z;
  const enteredEvade = goose.state === BIRD_STATES.EVADE && goose.evadeT > 0;
  let maxSlotDeviation = 0;
  for (let i = 0; i < 360; i++) {
    stepBirdState(
      goose,
      gx,
      gy,
      gz,
      {...baseEnv, elapsed: 5 + i / 60},
      1 / 60,
      pose
    );
    gx = pose.x;
    gy = pose.y;
    gz = pose.z;
    const dev = Math.hypot(
      gx - (goose.leaderX + goose.slotWorldX),
      gz - (goose.leaderZ + goose.slotWorldZ)
    );
    if (dev > maxSlotDeviation) maxSlotDeviation = dev;
  }
  const finalDev = Math.hypot(
    gx - (goose.leaderX + goose.slotWorldX),
    gz - (goose.leaderZ + goose.slotWorldZ)
  );
  check(
    'Startled goose breaks V-formation (>35 units) and regroups cleanly into slot',
    enteredEvade &&
      maxSlotDeviation > 35 &&
      finalDev < 0.5 &&
      goose.state === BIRD_STATES.CRUISE,
    `maxDev=${maxSlotDeviation.toFixed(1)}, finalDev=${finalDev.toFixed(2)}`
  );

  // 3b. Hawk: thermal spiral climb + downwind drift -> stoop/glide transition
  const hawk = {
    type: 'hawk',
    x: 150,
    y: 200,
    z: 0,
    cx: 0,
    cy: 200,
    cz: 0,
    homeX: 0,
    homeY: 200,
    homeZ: 0,
    circleSpeed: 0.4,
    circleRadius: 150,
    thermalTop: 260,
    climbRate: 12,
    angle: 0,
    flapPhase: 0,
    flapSpeed: 7.5,
    flapDuration: 2.5,
    soarDuration: 6.5,
    nextStoopWait: 2, // trigger FORAGE stoop at top of first thermal
  };
  let hx = hawk.x;
  let hy = hawk.y;
  let hz = hawk.z;
  const seenHawkStates = new Set();
  for (let i = 0; i < 900; i++) {
    stepBirdState(
      hawk,
      hx,
      hy,
      hz,
      {...baseEnv, elapsed: i / 60},
      1 / 60,
      pose
    );
    hx = pose.x;
    hy = pose.y;
    hz = pose.z;
    seenHawkStates.add(hawk.state);
  }
  check(
    'Hawk transitions through THERMAL climb -> FORAGE stoop -> upwind GLIDE',
    seenHawkStates.has(BIRD_STATES.THERMAL) &&
      seenHawkStates.has(BIRD_STATES.FORAGE) &&
      seenHawkStates.has(BIRD_STATES.GLIDE),
    `states=${[...seenHawkStates].join(',')}`
  );

  // 3c. Seagull: SOAR -> upwind KITE -> FORAGE plunge dive with water splash
  const gull = {
    type: 'seagull',
    x: 60,
    y: WATER + 65,
    z: 0,
    cx: 0,
    cy: WATER + 65,
    cz: 0,
    circleRadius: 60,
    circleSpeed: 0.45,
    angle: 0,
    flapPhase: 0,
    flapSpeed: 10,
    flapDuration: 2.5,
    soarDuration: 3.5,
    stateTimer: 0.5,
    nextForageWait: 15,
  };
  let sx = gull.x;
  let sy = gull.y;
  let sz = gull.z;
  let minGullY = Infinity;
  let gullSplashed = false;
  const seenGullStates = new Set();
  for (let i = 0; i < 400; i++) {
    stepBirdState(
      gull,
      sx,
      sy,
      sz,
      {...baseEnv, getElev: () => WATER - 8, elapsed: i / 60},
      1 / 60,
      pose
    );
    sx = pose.x;
    sy = pose.y;
    sz = pose.z;
    if (sy < minGullY) minGullY = sy;
    if (pose.splash) gullSplashed = true;
    seenGullStates.add(gull.state);
  }
  check(
    'Seagull kites into wind, plunge-dives to water surface with splash, and climbs out',
    seenGullStates.has(BIRD_STATES.KITE) &&
      seenGullStates.has(BIRD_STATES.FORAGE) &&
      gullSplashed &&
      minGullY < WATER + 4 &&
      gull.state === BIRD_STATES.SOAR,
    `minY=${minGullY.toFixed(1)}, splashed=${gullSplashed}`
  );

  // 3d. Pelican: wave-skimming ground effect -> climb -> plunge dive + surface float
  const pelican = {
    type: 'pelican',
    x: 110,
    y: WATER + 10,
    z: 0,
    cx: 0,
    cy: WATER + 10,
    cz: 0,
    circleRadius: 110,
    circleSpeed: 0.26,
    angle: 0,
    rank: 0,
    flapPhase: 0,
    flapSpeed: 5.4,
    flapDuration: 2.1,
    soarDuration: 6.8,
    stateTimer: 1.0,
    nextForageWait: 20,
  };
  let px = pelican.x;
  let py = pelican.y;
  let pz = pelican.z;
  let pelicanSplashed = false;
  let maxPelicanY = -Infinity;
  let floatDrift = 0;
  let prevFloatX = null;
  let prevFloatZ = null;
  for (let i = 0; i < 800; i++) {
    stepBirdState(
      pelican,
      px,
      py,
      pz,
      {...baseEnv, getElev: () => WATER - 8, elapsed: i / 60},
      1 / 60,
      pose
    );
    if (
      pelican.state === BIRD_STATES.FORAGE &&
      pelican.divePhase >= 0.48 &&
      pelican.divePhase < 0.7
    ) {
      if (prevFloatX !== null) {
        floatDrift += Math.hypot(pose.x - prevFloatX, pose.z - prevFloatZ);
      }
      prevFloatX = pose.x;
      prevFloatZ = pose.z;
    }
    px = pose.x;
    py = pose.y;
    pz = pose.z;
    if (py > maxPelicanY) maxPelicanY = py;
    if (pose.splash) pelicanSplashed = true;
  }
  check(
    'Pelican climbs, plunge-fishes with splash, floats stationary on water, and resumes skim',
    maxPelicanY > WATER + 55 &&
      pelicanSplashed &&
      floatDrift < 0.01 &&
      pelican.state === BIRD_STATES.SKIM,
    `maxY=${maxPelicanY.toFixed(1)}, floatDrift=${floatDrift.toFixed(4)}, state=${pelican.state}`
  );

  // 3e. Heron: alternates marsh CRUISE and low water-stalking SKIM
  const heron = {
    type: 'heron',
    x: 0,
    y: WATER + 26,
    z: 0,
    cx: 0,
    cy: WATER + 26,
    cz: 0,
    rotY: 0.4,
    speed: 20,
    patrolRadius: 150,
    angle: 0,
    flapPhase: 0,
    flapSpeed: 4.2,
    flapDuration: 6,
    soarDuration: 3,
    stateTimer: 1.0,
  };
  let hrx = heron.x;
  let hry = heron.y;
  let hrz = heron.z;
  let minHeronY = Infinity;
  let maxHeronY = -Infinity;
  for (let i = 0; i < 900; i++) {
    stepBirdState(
      heron,
      hrx,
      hry,
      hrz,
      {...baseEnv, getElev: () => WATER, elapsed: i / 60},
      1 / 60,
      pose
    );
    hrx = pose.x;
    hry = pose.y;
    hrz = pose.z;
    if (hry < minHeronY) minHeronY = hry;
    if (hry > maxHeronY) maxHeronY = hry;
  }
  check(
    'Heron glides down to ~9-unit water skim and lifts back to marsh patrol height',
    minHeronY < WATER + 11.5 && maxHeronY > WATER + 24,
    `minY=${(minHeronY - WATER).toFixed(1)}, maxY=${(maxHeronY - WATER).toFixed(1)}`
  );

  // 3f. Swallow: high-bank darting + shelters in heavy storm rain
  const swallow = {
    type: 'swallow',
    x: 40,
    y: 80,
    z: 0,
    cx: 0,
    cy: 80,
    cz: 0,
    orbitA: 55,
    orbitB: 38,
    orbitRot: 0.3,
    angle: 0,
    dartSpeed: 1.2,
    jinkFreq: 3.1,
    jinkPhase: 0.2,
    flapPhase: 0,
    flapSpeed: 20,
    flapDuration: 1.4,
    soarDuration: 0.9,
    weatherSeed: 0.3,
  };
  let swx = swallow.x;
  let swy = swallow.y;
  let swz = swallow.z;
  let maxSwallowBank = 0;
  for (let i = 0; i < 240; i++) {
    stepBirdState(
      swallow,
      swx,
      swy,
      swz,
      {...baseEnv, elapsed: i / 60},
      1 / 60,
      pose
    );
    swx = pose.x;
    swy = pose.y;
    swz = pose.z;
    maxSwallowBank = Math.max(maxSwallowBank, Math.abs(pose.bank));
  }
  stepBirdState(
    swallow,
    swx,
    swy,
    swz,
    {...baseEnv, rain: 0.92, elapsed: 5},
    1 / 60,
    pose
  );
  check(
    'Swallow carves agile >20-deg banked jinks in fair weather and shelters in heavy rain',
    maxSwallowBank > 0.35 && !pose.visible,
    `maxBank=${((maxSwallowBank * 180) / Math.PI).toFixed(1)} deg`
  );

  // 3g. Raven: ridge clearance + playful 360-deg corvid barrel roll
  const raven = {
    type: 'raven',
    x: 0,
    y: 240,
    z: 0,
    cx: 0,
    cy: 240,
    cz: 0,
    axisX: -0.6,
    axisZ: 0.8,
    ridgeHalfLen: 150,
    ridgeWidth: 45,
    angle: 0,
    circleSpeed: 0.35,
    flapPhase: 0,
    flapSpeed: 8.5,
    flapDuration: 2.2,
    soarDuration: 5.5,
    nextPlayWait: 0.3,
  };
  let rvx = raven.x;
  let rvy = raven.y;
  let rvz = raven.z;
  let maxRavenRoll = 0;
  for (let i = 0; i < 120; i++) {
    stepBirdState(
      raven,
      rvx,
      rvy,
      rvz,
      {...baseEnv, getElev: () => 210, elapsed: i / 60},
      1 / 60,
      pose
    );
    rvx = pose.x;
    rvy = pose.y;
    rvz = pose.z;
    maxRavenRoll = Math.max(maxRavenRoll, pose.bank);
  }
  check(
    'Raven maintains >=55-unit ridge clearance and executes playful 360-deg barrel roll',
    rvy >= 265 - 1e-3 &&
      maxRavenRoll > Math.PI * 1.5 &&
      raven.state === BIRD_STATES.SOAR,
    `y=${rvy.toFixed(1)}, maxRoll=${((maxRavenRoll * 180) / Math.PI).toFixed(0)} deg`
  );

  // 3h. Albatross: smooth high-speed dynamic soaring climbs into wind, swoops
  // downwind, and stays jitter-free across uneven 60Hz/30Hz frames
  const albatross = {
    type: 'albatross',
    x: 0,
    y: WATER + 36,
    z: 0,
    cx: 0,
    cy: WATER + 36,
    cz: 0,
    windX: 0.8,
    windZ: 0.6,
    crossSign: 1,
    crossAmp: 360,
    windAmp: 140,
    soarPhase: 0,
    soarFreq: 0.175,
    speed: 55,
    flapPhase: 0,
    flapSpeed: 3.6,
    flapDuration: 0.85,
    soarDuration: 18,
  };
  let ax = albatross.x;
  let ay = albatross.y;
  let az = albatross.z;
  let climbIntoWind = 0;
  let swoopDownwind = 0;
  let minAlbSpeed = Infinity;
  let maxBankStep = 0;
  let prevBank = 0;
  let elapsedSim = 0;
  for (let i = 0; i < 1600; i++) {
    const dt = i % 2 === 0 ? 1 / 60 : 1 / 30;
    elapsedSim += dt;
    const prevAx = ax;
    const prevAy = ay;
    const prevAz = az;
    stepBirdState(
      albatross,
      ax,
      ay,
      az,
      {...baseEnv, elapsed: elapsedSim},
      dt,
      pose
    );
    ax = pose.x;
    ay = pose.y;
    az = pose.z;
    if (i > 10) {
      const vy = (ay - prevAy) / dt;
      const spd = Math.hypot(ax - prevAx, az - prevAz) / dt;
      if (spd < minAlbSpeed) minAlbSpeed = spd;
      maxBankStep = Math.max(maxBankStep, Math.abs(pose.bank - prevBank));
      const alongWind = ((ax - prevAx) * 0.8 + (az - prevAz) * 0.6) / dt;
      if (vy > 2.0 && alongWind < 0) climbIntoWind++;
      if (vy < -2.0 && alongWind > 0) swoopDownwind++;
    }
    prevBank = pose.bank;
  }
  check(
    'Albatross dynamic-soars >=38 u/s into/downwind smoothly across uneven frames',
    climbIntoWind > 200 &&
      swoopDownwind > 200 &&
      minAlbSpeed >= 38 &&
      maxBankStep < 0.08,
    `climb=${climbIntoWind}, swoop=${swoopDownwind}, minSpd=${minAlbSpeed.toFixed(1)}, maxBankStep=${maxBankStep.toFixed(3)}`
  );
}

// --- 4. 3D RIG BUDGET, SYMMETRY & SHARED MATERIAL ---
{
  const modelTypes = [
    'goose',
    'hawk',
    'seagull',
    'heron',
    'egret',
    'pelican',
    'swallow',
    'raven',
    'albatross',
  ];
  let allThreeMeshes = true;
  let allSymmetric = true;
  let allFinite = true;

  for (const t of modelTypes) {
    const group =
      t === 'egret' ? assembleBird('heron', 4.0, 1) : assembleBird(t, 4.0, 0);
    const meshes = [];
    group.traverse((c) => {
      if (c.isMesh) meshes.push(c);
    });
    if (
      meshes.length !== 3 ||
      !meshes.every((m) => m.material === birdVertexColorMat)
    ) {
      allThreeMeshes = false;
    }

    const [wingR, wingL] = group.userData.wings;
    wingR.geometry.computeBoundingBox();
    wingL.geometry.computeBoundingBox();
    const br = wingR.geometry.boundingBox;
    const bl = wingL.geometry.boundingBox;
    if (
      Math.abs(br.max.x + bl.min.x) > 1e-4 ||
      Math.abs(br.min.z - bl.min.z) > 1e-4 ||
      Math.abs(br.max.z - bl.max.z) > 1e-4
    ) {
      allSymmetric = false;
    }

    for (const m of meshes) {
      const pos = m.geometry.attributes.position.array;
      const nrm = m.geometry.attributes.normal.array;
      for (let i = 0; i < pos.length; i++) {
        if (!Number.isFinite(pos[i]) || !Number.isFinite(nrm[i])) {
          allFinite = false;
        }
      }
    }

    const parts = getBirdPropParts(t, 0.5);
    if (parts.length !== 3) allThreeMeshes = false;
  }

  check(
    'Every bird species builds as exactly 3 meshes sharing 1 vertex-color material',
    allThreeMeshes
  );
  check(
    'Left and right wings have exact X-mirror symmetry with matching backward sweep',
    allSymmetric
  );
  check(
    'All bird geometries have finite vertex positions and normals',
    allFinite
  );
}

// --- 5. CPU THROUGHPUT & EXTREME DT STABILITY BENCHMARK ---
{
  const rng = mulberry32(424242);
  const flock = [];
  while (flock.length < 200) {
    for (const b of generateChunkBirds({
      worldOffsetX: -6000,
      worldOffsetZ: 3000,
      chunkSize: 1200,
      waterLevel: WATER,
      waterShare: 0.38,
      minElev: 30,
      maxElev: 180,
      swampFactor: 0.4,
      farmFactor: 0.4,
      canyonFactor: 0.3,
      pierPositions: [{x: 0, z: 0}],
      getElev: () => 52,
      rng,
    })) {
      flock.push({data: b, x: b.x, y: b.y, z: b.z});
      if (flock.length >= 200) break;
    }
  }

  const env = {
    elapsed: 0,
    dayFactor: 0.75,
    rain: 0.1,
    windDirX: 0.8,
    windDirZ: 0.6,
    windStrength: 1.2,
    waterLevel: WATER,
    getElev: () => 52,
    checkAircraft: true,
    aircraft: {
      active: true,
      x: -6000,
      y: 120,
      z: 3000,
      fx: 0,
      fy: 0,
      fz: -1,
      speed: 140,
      isJet: false,
    },
  };
  const out = {};
  let finiteOk = true;
  const t0 = performance.now();
  for (let frame = 0; frame < 600; frame++) {
    env.elapsed = frame / 60;
    const dt = frame === 300 ? 2.5 : 1 / 60; // include a 2.5s hitch spike
    for (let i = 0; i < flock.length; i++) {
      const item = flock[i];
      stepBirdState(item.data, item.x, item.y, item.z, env, dt, out);
      computeWingFlap(item.data, env.elapsed);
      item.x = out.x;
      item.y = out.y;
      item.z = out.z;
      if (
        !Number.isFinite(out.x) ||
        !Number.isFinite(out.y) ||
        !Number.isFinite(out.z) ||
        !Number.isFinite(out.pitch) ||
        !Number.isFinite(out.yaw) ||
        !Number.isFinite(out.bank)
      ) {
        finiteOk = false;
      }
    }
  }
  const elapsedMs = performance.now() - t0;
  // (a loose ceiling that only catches a runaway: wall-clock time varies
  // a lot between machines, ~250-430 ms on a cloud runner)
  check(
    `120,000 bird state + flap steps (200 birds x 600 frames) run finite in ${elapsedMs.toFixed(1)} ms`,
    finiteOk && elapsedMs < 2000,
    `elapsed=${elapsedMs.toFixed(1)} ms`
  );
}

// 9. InstancedMesh matrix writer exact parity vs Three.js Group hierarchy
{
  const bird = assembleBird('seagull', 3.25, 0);
  const px = -1420.5;
  const py = 188.25;
  const pz = 3910.75;
  const pitch = -0.34;
  const yaw = 2.18;
  const bank = 0.51;
  const flap = 0.42;

  bird.position.set(px, py, pz);
  bird.rotation.set(pitch, yaw, bank);
  bird.userData.wings[0].rotation.z = flap;
  bird.userData.wings[1].rotation.z = -flap;
  bird.updateMatrixWorld(true);

  const bodyArr = new Float32Array(32);
  const wingRArr = new Float32Array(32);
  const wingLArr = new Float32Array(32);
  writeBirdMatrices(
    bodyArr,
    wingRArr,
    wingLArr,
    1,
    px,
    py,
    pz,
    pitch,
    yaw,
    bank,
    flap,
    3.25
  );

  const [bodyMesh, wingRMesh, wingLMesh] = bird.children;
  let maxErr = 0;
  for (let k = 0; k < 16; k++) {
    maxErr = Math.max(
      maxErr,
      Math.abs(bodyArr[16 + k] - bodyMesh.matrixWorld.elements[k]),
      Math.abs(wingRArr[16 + k] - wingRMesh.matrixWorld.elements[k]),
      Math.abs(wingLArr[16 + k] - wingLMesh.matrixWorld.elements[k])
    );
  }
  check(
    'writeBirdMatrices matches Three.js YXZ Group + child wing world matrices (< 1e-5)',
    maxErr < 1e-5,
    `maxErr=${maxErr}`
  );
}

// 10. Every species stays above a hill its path crosses, and gulls and
// pelicans only plunge (and splash) over water
{
  const HILL = 260;
  // A hill rising across the east half of each bird's circle
  const hillElev = (x) => (x > 0 ? HILL : WATER - 8);
  const env = {
    elapsed: 0,
    dayFactor: 1,
    rain: 0,
    windDirX: 0.8,
    windDirZ: 0.6,
    windStrength: 1,
    waterLevel: WATER,
    getElev: hillElev,
    aircraft: {active: false},
    checkAircraft: false,
  };
  const rng = mulberry32(99);
  const birds = generateChunkBirds({
    worldOffsetX: 0,
    worldOffsetZ: 0,
    chunkSize: 1500,
    waterLevel: WATER,
    waterShare: 0.5,
    minElev: WATER - 8,
    maxElev: HILL,
    swampFactor: 0.5,
    farmFactor: 0.5,
    canyonFactor: 0.5,
    fallsFactor: 1,
    isAlienChunk: false,
    lighthousePos: {x: 0, y: 60, z: 0},
    sailboatPositions: [{x: -100, z: 0}],
    rockArchPositions: [],
    pierPositions: [{x: 0, z: 0}],
    windDirX: 0.8,
    windDirZ: 0.6,
    getElev: hillElev,
    rng,
  });
  let worst = Infinity;
  let worstType = '';
  let landSplashes = 0;
  const out = {};
  for (const b of birds) {
    let x = b.x;
    let y = b.y;
    let z = b.z;
    for (let i = 0; i < 60 * 90; i++) {
      env.elapsed = i / 60;
      stepBirdState(b, x, y, z, env, 1 / 60, out);
      x = out.x;
      y = out.y;
      z = out.z;
      // (after the first probe has run)
      if (i > 30) {
        const clear = y - Math.max(WATER, hillElev(x));
        if (clear < worst) {
          worst = clear;
          worstType = b.type;
        }
      }
      if (out.splash && hillElev(x) > WATER) landSplashes++;
    }
  }
  check(
    `Birds crossing a ${HILL}-unit hill stay above it (${birds.length} birds)`,
    birds.length > 0 && worst > -2,
    `worst clearance ${worst.toFixed(1)} (${worstType})`
  );
  check('Gulls and pelicans never splash down on land', landSplashes === 0);
}

if (failed) {
  console.error('\nBird system tests failed!');
  process.exit(1);
}
console.log(
  '\nAll bird ecology, state-machine, 3D rig, and perf tests passed!'
);
