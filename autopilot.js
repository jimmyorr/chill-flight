// --- AUTOPILOT ---
// Flies to the waypoint (waypoint.js) and circles it on arrival until a new
// one is set. With no waypoint it tours the landmarks (landmarks.js): it flies
// to the nearest one it hasn't seen, circles it once, and moves on to the
// next. Either way it keeps a safe height over the ground ahead, climbing
// only as early as the terrain needs, and comes back down after.
// game-loop.js calls updateAutopilot each frame while it's engaged.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {AutopilotCore} from './autopilot-logic.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {LANDMARKS} from './landmarks.js';
import {getElevation} from './terrain-geometry.js';
import {planeGroup, planeHandling} from './airplane.js';
import {clearWaypoint, getWaypoint, setTourStop} from './waypoint.js';
import {log} from './logger.js';
import {state} from './state.js';

// The world repeats every MAP_WIDTH units east to west
const MAP_WIDTH = ChillFlightLogic.MAP_WIDTH;

let tourStop = null; // {name, x, y, z}
const visited = new Set();

function groundAt(x, z) {
  return Math.max(WATER_LEVEL, getElevation(x, z));
}

// How it flies (autopilot-logic.js, shared with scripts/flight-sim.js)
const pilot = new AutopilotCore(groundAt);

// The nearest landmark not yet visited (the nearest copy east or west, as
// the world repeats), starting over once all are
function nextTourStop() {
  const px = planeGroup.position.x;
  const pz = planeGroup.position.z;
  if (LANDMARKS.every((lm) => visited.has(lm.name))) visited.clear();
  let best = null;
  let bestDist = Infinity;
  for (const lm of LANDMARKS) {
    if (visited.has(lm.name)) continue;
    const dx = THREE.MathUtils.euclideanModulo(
      lm.x - px + MAP_WIDTH / 2,
      MAP_WIDTH
    );
    const x = px + dx - MAP_WIDTH / 2;
    const dist = Math.hypot(x - px, lm.z - pz);
    if (dist < bestDist) {
      bestDist = dist;
      best = {name: lm.name, x, y: groundAt(x, lm.z), z: lm.z};
    }
  }
  if (best) log.info(`[Autopilot] Touring to ${best.name}`);
  return best;
}

export function updateAutopilot(delta) {
  state.isDoingImmelmann = false;
  const {x, y, z} = planeGroup.position;
  const waypoint = getWaypoint();

  // A new waypoint ends any circling
  if (pilot.orbit && waypoint) pilot.orbit = null;
  if (waypoint) tourStop = null;
  if (!pilot.orbit && !waypoint && !tourStop) {
    tourStop = nextTourStop();
  }
  const target = waypoint || tourStop;

  // Arrived: circle it. The waypoint's done; the tour moves on after a lap.
  if (pilot.reached(x, z, target)) {
    pilot.startOrbit(target, x, z, planeGroup.rotation.y, !!waypoint);
    if (waypoint) {
      if (!waypoint.stay) clearWaypoint();
    } else visited.add(tourStop.name);
  }
  if (pilot.lapDone) {
    pilot.orbit = null;
    tourStop = nextTourStop();
  }
  setTourStop(pilot.orbit ? null : tourStop);

  const {roll, pitch, speed} = pilot.update({
    x,
    y,
    z,
    yaw: planeGroup.rotation.y,
    speedKts: BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * 60,
    agility: planeHandling().agility,
    target,
    delta,
  });
  state.targetRoll = roll;
  state.targetPitch = pitch;
  state.targetFlightSpeed = speed;

  // Cancel manual maneuvers
  state.isLooping = false;
  state.isSteepPitch = false;
  state.isBarrelRolling = false;
  state.isClampedRoll = false;
}

// Forget the route when the autopilot is turned off
export function resetAutopilot() {
  pilot.reset();
  tourStop = null;
  setTourStop(null);
}
