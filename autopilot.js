// --- AUTOPILOT ---
// Flies to the waypoint (waypoint.js) and circles it on arrival until a new
// one is set. With no waypoint it follows the sun across the day and the moon
// by night, nudged gently back toward the equator (z = 0) so it drifts around
// the world without wandering off north or south. Either way it keeps a safe
// height over the ground ahead, climbing only as early as the terrain needs,
// and comes back down after. In the buggy it drives to the waypoint and parks
// there, or with none tours the landmarks (landmarks.js), driving a lap round
// each, and follows a road going its way (updateDrivingAutopilot).
// game-loop.js calls updateAutopilot or updateDrivingAutopilot each frame
// while it's engaged.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  AutopilotCore,
  DrivingAutopilotCore,
  skyHeading,
} from './autopilot-logic.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {LANDMARKS} from './landmarks.js';
import {getElevation} from './terrain-geometry.js';
import {archTop} from './arches-logic.js';
import {breakwaterTop} from './terrain-chunks.js';
import {arches} from './arches.js';
import {planeGroup, planeHandling} from './airplane.js';
import {buggySurface} from './buggy.js';
import {clearWaypoint, getWaypoint, setTourStop} from './waypoint.js';
import {log} from './logger.js';
import {state} from './state.js';

// The world repeats every MAP_WIDTH units east to west
const MAP_WIDTH = ChillFlightLogic.MAP_WIDTH;

let tourStop = null; // {name, x, y, z}, for the buggy's landmark tour
const visited = new Set();

// The ground, the water or an arch's top (flying over arches, not into them)
function groundAt(x, z) {
  return Math.max(
    WATER_LEVEL,
    getElevation(x, z),
    archTop(arches, x, z),
    breakwaterTop(x, z)
  );
}

// How it flies (autopilot-logic.js, shared with scripts/flight-sim.js)
const pilot = new AutopilotCore(groundAt);
const driver = new DrivingAutopilotCore(
  (x, z, y) => buggySurface(x, z, y).height
);
// Which of the two was driving last frame, to start the other afresh
let wasDriving = false;

// The nearest landmark not yet visited (the nearest copy east or west, as
// the world repeats), starting over once all are, for the buggy's tour
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

// Forget the route when the autopilot is turned off
export function resetAutopilot() {
  pilot.reset();
  driver.reset();
  wasDriving = false;
  tourStop = null;
  setTourStop(null);
}

export function updateAutopilot(delta) {
  if (wasDriving) resetAutopilot();
  state.isDoingImmelmann = false;
  const {x, y, z} = planeGroup.position;
  const waypoint = getWaypoint();

  // A new waypoint ends any circling
  if (
    pilot.orbit &&
    waypoint &&
    (waypoint.x !== pilot.orbit.x || waypoint.z !== pilot.orbit.z)
  ) {
    pilot.orbit = null;
  }
  setTourStop(null);

  // Arrived at the waypoint: circle it until a new one is set
  if (pilot.reached(x, z, waypoint)) {
    pilot.startOrbit(waypoint, x, z, planeGroup.rotation.y);
    if (!waypoint.stay) clearWaypoint();
  }

  const course = waypoint
    ? null
    : skyHeading(
        z,
        state.sunX,
        state.sunY,
        state.sunZ,
        state.moonX,
        state.moonZ
      );

  const {roll, pitch, speed} = pilot.update({
    x,
    y,
    z,
    yaw: planeGroup.rotation.y,
    speedKts: BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * 60,
    agility: planeHandling().agility,
    target: waypoint,
    course,
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

/**
 * The buggy's autopilot: sets state.autopilotDrive ({steer, throttle}, the
 * stick, which buggy.js drives by) and the cruise speed.
 */
export function updateDrivingAutopilot(delta) {
  if (!wasDriving) resetAutopilot();
  wasDriving = true;
  const {x, y, z} = planeGroup.position;
  const here = buggySurface(x, z, y);
  const road =
    here.kind === 'road'
      ? {
          dirX: here.normalZ,
          dirZ: -here.normalX,
          across: here.across,
          halfWidth: here.halfWidth,
        }
      : null;
  // With no waypoint (and not parked at one) it tours the landmarks
  const waypoint = getWaypoint();
  if (waypoint || driver.parked) tourStop = null;
  else tourStop ??= nextTourStop();
  const {steer, throttle, cruise, done} = driver.update({
    x,
    y,
    z,
    yaw: planeGroup.rotation.y,
    speed: BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60,
    target: waypoint,
    stop: tourStop,
    road,
    delta,
  });
  if (done) {
    visited.add(tourStop.name);
    tourStop = nextTourStop();
  }
  setTourStop(driver.tour?.lap ? null : tourStop);
  state.autopilotDrive = {steer, throttle};
  state.targetFlightSpeed = cruise / (BASE_FLIGHT_SPEED * 60);
}
