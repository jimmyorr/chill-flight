// --- CRASH DETECTION: THE MATHS ---
// Pure functions for crash.js (no three.js or DOM), so they can be tested in
// Node (scripts/test-crash.js). Casual mistakes are forgiven: a wingtip
// grazing a cliff scrapes, a hard landing settles, and knocking over a tree or
// a house slows the plane down. Only a deliberate or extreme impact counts as
// a crash:
// 1. Flying nose first at high speed straight into a steep cliff
// 2. A steep nose-dive or high-speed stall-plummet into the ground or water
// 3. Sustained grinding into a wall or plowing through several buildings in a
//    row before the strain has time to fade

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

  // Seconds after a crash before another can fire
  COOLDOWN: 3.0,
};

function wrapAngle(a) {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

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
