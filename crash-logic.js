// --- CRASH DETECTION & RECOVERY: THE MATHS ---
// Pure functions for crash.js (no three.js or DOM), so they can be tested in
// Node (scripts/test-crash.js). Casual mistakes are forgiven: a wingtip
// grazing a cliff scrapes, a hard landing settles, and knocking over a tree or
// a house slows the plane down. Only a deliberate or extreme impact counts as
// a crash:
// 1. Flying nose first at high speed straight into a steep cliff
// 2. A steep nose-dive or high-speed stall-plummet into the ground or water
// 3. Sustained grinding into a wall or plowing through several buildings in a
//    row before the strain has time to fade
//
// When a crash happens, the plane breaks into tumbling pieces while the camera
// orbits the wreck (ORBIT_SECONDS) and then arcs up behind the fresh plane
// waiting in clear air overhead (SWING_SECONDS), facing downhill away from any
// cliff.

export const CRASH = {
  // 1. Direct nose-first impact into a steep wall: closing speed (-f·n * kts)
  // at least this high, dead-on (-f·n >= WALL_COS, within ~35°) against a
  // wall at least WALL_SLOPE steep (~45°)
  WALL_CLOSING_KTS: 135,
  WALL_COS: 0.82,
  WALL_SLOPE: 1.0,

  // 2. Nose-dive or stall-plummet into the ground or water: either a steep
  // dive (pitch below DIVE_PITCH, ~37° nose down) with downward speed at
  // least DIVE_VERTICAL_SPEED, or a sustained stall-fall reaching
  // PLUMMET_VERTICAL_SPEED (units/s)
  DIVE_PITCH: -0.65,
  DIVE_VERTICAL_SPEED: 110,
  PLUMMET_VERTICAL_SPEED: 200,

  // 3. Short-window strain (0..1, crashing at 1): decays by DECAY per second
  // of clean flight (~2 s from full), so wingtip grazes never add up, while
  // boring nose-first into a cliff or smashing through several buildings in a
  // row pushes it over 1
  STRAIN_DECAY: 0.5,
  HEAD_ON_STRAIN_PER_SEC: 0.85,
  GRAZE_STRAIN_PER_SEC: 0.15,
  GRAZE_STRAIN_CAP: 0.45,
  HOUSE_STRAIN: 0.4,
  TREE_STRAIN: 0.08,

  // Sequence timing (s): Act 1 orbits the wreck, Act 2 swings up to the
  // respawned plane overhead, then COOLDOWN prevents an immediate re-crash
  ORBIT_SECONDS: 1.35,
  SWING_SECONDS: 0.95,
  DURATION: 2.3,
  COOLDOWN: 2.5,

  // Respawn clearance above the ground or water (units, ~60 m)
  RESPAWN_CLEARANCE: 120,
  // Slope above which respawn turns downhill away from the hill/cliff
  SLOPE_TURN_THRESHOLD: 0.25,

  // Camera orbit around the wreck (units and radians)
  ORBIT_RADIUS_START: 42,
  ORBIT_RADIUS_END: 64,
  ORBIT_HEIGHT_START: 18,
  ORBIT_HEIGHT_END: 34,
  ORBIT_SWEEP_RAD: 1.25,

  // Wreck piece physics (units/s²)
  GRAVITY: -55,
  BOUNCE: 0.3,
};

function wrapAngle(a) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

const lerp = (a, b, t) => a + (b - a) * t;

/** A fresh crash tracker state. */
export function newCrashState() {
  return {strain: 0, cooldown: 0};
}

/** Steps the crash state's decay and cooldown over `dt` seconds. */
export function stepCrashState(s, dt) {
  if (dt <= 0) return s;
  s.cooldown = Math.max(0, s.cooldown - dt);
  s.strain = Math.max(0, s.strain - CRASH.STRAIN_DECAY * dt);
  return s;
}

/**
 * Heuristic 1: Whether a nose contact with a wall facing (nx, nz) of `slope`
 * at `kts` and `heading` is a direct, high-speed head-on crash.
 */
export function isWallImpactCrash(heading, nx, nz, slope, kts) {
  if (slope < CRASH.WALL_SLOPE) return false;
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  const into = -(fx * nx + fz * nz);
  if (into < CRASH.WALL_COS) return false;
  return into * kts >= CRASH.WALL_CLOSING_KTS;
}

/**
 * Heuristic 2: Whether touching the ground or water at `pitch` (radians,
 * negative nose down), `kts` and `verticalVelocity` (units/s, negative
 * falling) is a steep nose-dive or stall-plummet crash.
 */
export function isDiveImpactCrash(pitch, kts, verticalVelocity) {
  const p = wrapAngle(pitch);
  const pitchDownSpeed = Math.max(0, -Math.sin(p) * kts);
  const fallDownSpeed = Math.max(0, -verticalVelocity);
  if (fallDownSpeed >= CRASH.PLUMMET_VERTICAL_SPEED) return true;
  return (
    p <= CRASH.DIVE_PITCH &&
    pitchDownSpeed + fallDownSpeed >= CRASH.DIVE_VERTICAL_SPEED
  );
}

/**
 * Heuristic 3a: Adds strain from a frame of wall contact (`dt` seconds).
 * Nose-first grinding builds strain past 1 in ~1.2 s; a wingtip graze is
 * capped below GRAZE_STRAIN_CAP so scraping a canyon wall never crashes on
 * its own. Returns true if strain reaches 1.
 */
export function addWallScrapeStrain(s, headOn, intoWall, kts, dt) {
  if (headOn || intoWall) {
    const speedScale = Math.max(0.6, Math.min(1.6, kts / 120));
    s.strain +=
      (CRASH.HEAD_ON_STRAIN_PER_SEC * speedScale + CRASH.STRAIN_DECAY) * dt;
  } else if (s.strain < CRASH.GRAZE_STRAIN_CAP) {
    s.strain = Math.min(
      CRASH.GRAZE_STRAIN_CAP,
      s.strain + (CRASH.GRAZE_STRAIN_PER_SEC + CRASH.STRAIN_DECAY) * dt
    );
  }
  return s.strain >= 1;
}

/**
 * Heuristic 3b: Adds strain from smashing a prop ('house', 'tree', 'snowman')
 * at `kts` while flying. Returns true if strain reaches 1.
 */
export function addPropHitStrain(s, kind, kts) {
  if (kind === 'snowman') return false;
  const base = kind === 'house' ? CRASH.HOUSE_STRAIN : CRASH.TREE_STRAIN;
  const speedScale = Math.max(0.5, Math.min(1.5, kts / 140));
  s.strain += base * speedScale;
  return s.strain >= 1;
}

/**
 * Option B respawn pose: lifted RESPAWN_CLEARANCE above the ground or water at
 * (x, z), level, at cruise speed 1.0, and facing downhill (`-slopeX, -slopeZ`)
 * whenever the ground is sloped so the plane flies out into open air away from
 * the cliff.
 */
export function crashRespawnPose(x, z, heading, ground, waterLevel) {
  const surface = Math.max(waterLevel, ground.height);
  const slope = Math.hypot(ground.slopeX || 0, ground.slopeZ || 0);
  const respawnHeading =
    slope >= CRASH.SLOPE_TURN_THRESHOLD
      ? Math.atan2(ground.slopeX, ground.slopeZ)
      : heading;
  return {
    x,
    y: surface + CRASH.RESPAWN_CLEARANCE,
    z,
    heading: respawnHeading,
    speed: 1.0,
  };
}

/**
 * Two-act camera choreography for a crash at `wreck` ({x, y, z}) recovering to
 * `chase` ({camX, camY, camZ, lookX, lookY, lookZ}):
 * - Act 1 (0 .. ORBIT_SECONDS): pulls back and orbits around the wreck by
 *   ORBIT_SWEEP_RAD in direction `dir` (1 or -1) from `startAngle`.
 * - Act 2 (ORBIT_SECONDS .. DURATION): smoothly arcs up into the chase camera
 *   pose behind the respawned plane overhead.
 * Returns {pos: {x, y, z}, look: {x, y, z}, act: 1 | 2, swingT: 0..1}.
 */
export function crashCameraShot({t, wreck, startAngle, dir = 1, chase}) {
  const orbitFrac = Math.min(1, Math.max(0, t / CRASH.ORBIT_SECONDS));
  const easeOrbit = smoothstep(orbitFrac);
  const angle = startAngle + dir * CRASH.ORBIT_SWEEP_RAD * easeOrbit;
  const radius = lerp(
    CRASH.ORBIT_RADIUS_START,
    CRASH.ORBIT_RADIUS_END,
    easeOrbit
  );
  const height = lerp(
    CRASH.ORBIT_HEIGHT_START,
    CRASH.ORBIT_HEIGHT_END,
    easeOrbit
  );
  const orbitPos = {
    x: wreck.x + Math.sin(angle) * radius,
    y: wreck.y + height,
    z: wreck.z + Math.cos(angle) * radius,
  };
  const orbitLook = {
    x: wreck.x,
    y: wreck.y + 2,
    z: wreck.z,
  };
  if (t <= CRASH.ORBIT_SECONDS) {
    return {pos: orbitPos, look: orbitLook, act: 1, swingT: 0};
  }
  const swingRaw = (t - CRASH.ORBIT_SECONDS) / CRASH.SWING_SECONDS;
  const swingT = smoothstep(swingRaw);
  return {
    pos: {
      x: lerp(orbitPos.x, chase.camX, swingT),
      y: lerp(orbitPos.y, chase.camY, swingT),
      z: lerp(orbitPos.z, chase.camZ, swingT),
    },
    look: {
      x: lerp(orbitLook.x, chase.lookX, swingT),
      y: lerp(orbitLook.y, chase.lookY, swingT),
      z: lerp(orbitLook.z, chase.lookZ, swingT),
    },
    act: 2,
    swingT,
  };
}

/**
 * Steps a tumbling wreck piece `p` ({x, y, z, vx, vy, vz, angle, spin, rest})
 * over `dt` seconds under gravity, bouncing on `p.rest`.
 */
export function stepWreckPiece(p, dt) {
  p.vy += CRASH.GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  p.angle += p.spin * dt;
  if (p.y <= p.rest && p.vy < 0) {
    p.y = p.rest;
    p.vy = -p.vy * CRASH.BOUNCE;
    p.vx *= 0.7;
    p.vz *= 0.7;
    p.spin *= 0.7;
    if (p.vy < 3) p.vy = 0;
  }
  return p;
}
