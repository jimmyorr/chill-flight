// --- CRASH DETECTION ---
// Forgives casual scrapes and bumps, but detects when the player genuinely
// crashes (crash-logic.js has the heuristics):
// 1. High-speed nose-first impact into a steep cliff (wall-scrape.js)
// 2. Steep nose-dive or high-speed stall-plummet into the ground or water
//    (flight-physics.js)
// 3. Sustained grinding into a wall or plowing through several buildings in a
//    row before the short-window strain fades (wall-scrape.js, breakables.js)
// Shows a "Crashed!" toast notification so we can feel out the thresholds.
import {state} from './state.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {Achievements} from './achievements.js';
import {
  CRASH,
  addPropHitStrain,
  addWallScrapeStrain,
  isDiveImpactCrash,
  isWallImpactCrash,
  newCrashState,
  stepCrashState,
} from './crash-logic.js';

const crashState = newCrashState();
let lastX = NaN;
let lastY = NaN;
let lastZ = NaN;
const TELEPORT_DISTANCE = 100;

function resetCrashState() {
  crashState.strain = 0;
  crashState.cooldown = 0;
}

function triggerCrash() {
  if (crashState.cooldown > 0) return false;
  crashState.strain = 0;
  crashState.cooldown = CRASH.COOLDOWN;
  Achievements.toast({
    emoji: '💥',
    label: 'IMPACT',
    title: 'Crashed!',
  });
  return true;
}

/** Called once per frame from game-loop.js to decay short-window strain. */
export function updateCrash(delta) {
  const p = planeGroup.position;
  if (
    Number.isFinite(lastX) &&
    Math.hypot(p.x - lastX, p.y - lastY, p.z - lastZ) > TELEPORT_DISTANCE
  ) {
    resetCrashState();
  }
  lastX = p.x;
  lastY = p.y;
  lastZ = p.z;

  if (
    activePlaneType === 'buggy' ||
    state.isFreeCamera ||
    state.isOnGround ||
    state.isOnWater
  ) {
    crashState.strain = 0;
  }
  stepCrashState(crashState, delta);
}

/**
 * Checks a wall contact frame from wall-scrape.js (Heuristic 1: hard head-on
 * cliff impact, and Heuristic 3a: sustained wall-grinding strain).
 */
export function checkWallCrash({heading, nose, headOn, intoWall, kts, delta}) {
  if (activePlaneType === 'buggy' || state.isFreeCamera) return false;
  if (nose && isWallImpactCrash(heading, nose.nx, nose.nz, nose.slope, kts)) {
    return triggerCrash();
  }
  if (addWallScrapeStrain(crashState, headOn, intoWall, kts, delta)) {
    return triggerCrash();
  }
  return false;
}

/**
 * Checks a ground or water impact from flight-physics.js (Heuristic 2: steep
 * nose-dive or high-speed stall-plummet).
 */
export function checkDiveCrash(pitch, kts, verticalVelocity) {
  if (activePlaneType === 'buggy' || state.isFreeCamera) return false;
  if (isDiveImpactCrash(pitch, kts, verticalVelocity)) {
    return triggerCrash();
  }
  return false;
}

/**
 * Records a prop smash ('house', 'tree', 'snowman') from breakables.js while
 * flying (Heuristic 3b: smashing through multiple buildings/trees in a row).
 */
export function recordPropCrashStrain(kind, kts, buggy) {
  if (buggy || state.isFreeCamera || state.isOnGround || state.isOnWater) {
    return false;
  }
  if (addPropHitStrain(crashState, kind, kts)) {
    return triggerCrash();
  }
  return false;
}
