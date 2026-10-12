// --- AUTOPILOT ---
// Flies to the waypoint (waypoint.js) and circles it on arrival until a new
// one is set. With no waypoint it tours the landmarks (landmarks.js): it flies
// to the nearest one it hasn't seen, circles it once, and moves on to the
// next. Either way it keeps a safe height over the ground ahead, climbing
// only as early as the terrain needs, and comes back down after.
// game-loop.js calls updateAutopilot each frame while it's engaged.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {LANDMARKS} from './landmarks.js';
import {getElevation} from './terrain-geometry.js';
import {planeGroup} from './airplane.js';
import {clearWaypoint, getWaypoint, setTourStop} from './waypoint.js';
import {log} from './logger.js';
import {state} from './state.js';

// Height to keep over the ground ahead (units; 25 ft each)
const CLEARANCE = 90;
// Look this far ahead for high ground (units), every SCAN_STEP, closer
// together over the first NEAR_AHEAD so a sharp ridge isn't missed
const LOOK_AHEAD = 4500;
const SCAN_STEP = 250;
const NEAR_AHEAD = 1000;
const NEAR_STEP = 100;
// Climb no steeper than this toward high ground ahead (rise per unit
// flown, about 14 degrees), which leaves the 30 degree limit as margin
const CLIMB_SLOPE = 0.25;
// Rescan the ground this often (s): sampling the terrain isn't free
const SCAN_INTERVAL = 0.25;
// Come back down no faster than this (units/s) once past high ground
const DESCENT_RATE = 15;
const MAX_CLIMB = Math.PI / 6;
const MAX_DESCENT = Math.PI / 25;
const MAX_ROLL = Math.PI / 4;
// Circle the spot at this radius (units), starting once this close
const ORBIT_RADIUS = 700;
// Speeds (150 kts = 1.0): a little slower while circling
const CRUISE_SPEED = 1.0;
const ORBIT_SPEED = 0.8;
// Height over the highest ground around the circle
const ORBIT_CLEARANCE = 60;
const ORBIT_SAMPLES = 12;
// The world repeats every MAP_WIDTH units east to west
const MAP_WIDTH = ChillFlightLogic.MAP_WIDTH;

let heldAlt = null; // The height being flown to (y), eased down, not up
let scanTimer = 0;
let orbit = null; // The circle being flown (startOrbit)
let tourStop = null; // {name, x, y, z}
const visited = new Set();

function groundAt(x, z) {
  return Math.max(WATER_LEVEL, getElevation(x, z));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// The heading (rotation.y) that points from (x, z) toward (tx, tz): heading
// 0 looks down -Z
function headingTo(x, z, tx, tz) {
  return Math.atan2(-(tx - x), -(tz - z));
}

// The height needed now to clear the ground along a heading, at the climb
// slope: a peak far ahead needs less height now than one close by
function heightAlong(heading) {
  const x = planeGroup.position.x;
  const z = planeGroup.position.z;
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  let needed = -Infinity;
  for (
    let d = 0;
    d <= LOOK_AHEAD;
    d += d < NEAR_AHEAD ? NEAR_STEP : SCAN_STEP
  ) {
    const h = groundAt(x + fx * d, z + fz * d) + CLEARANCE - d * CLIMB_SLOPE;
    if (h > needed) needed = h;
  }
  return needed;
}

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

function startOrbit(spot, loiter) {
  const x = planeGroup.position.x;
  const z = planeGroup.position.z;
  // Turn the way that's closer to the current heading
  const out = headingTo(spot.x, spot.z, x, z);
  const yaw = planeGroup.rotation.y;
  const dir =
    Math.abs(wrapAngle(yaw - (out + Math.PI / 2))) <
    Math.abs(wrapAngle(yaw - (out - Math.PI / 2)))
      ? 1
      : -1;
  // One height all the way around, over the highest ground on the circle
  let top = groundAt(spot.x, spot.z);
  for (let i = 0; i < ORBIT_SAMPLES; i++) {
    const a = (i / ORBIT_SAMPLES) * Math.PI * 2;
    top = Math.max(
      top,
      groundAt(
        spot.x + Math.cos(a) * ORBIT_RADIUS,
        spot.z + Math.sin(a) * ORBIT_RADIUS
      )
    );
  }
  orbit = {
    x: spot.x,
    z: spot.z,
    alt: top + ORBIT_CLEARANCE,
    dir,
    loiter,
    swept: 0, // How far around it's flown (radians)
    lastOut: out,
  };
}

// Roll toward a heading, plus a steady bank to hold a turn
function steerTo(heading, bank = 0) {
  const yawError = wrapAngle(heading - planeGroup.rotation.y);
  state.targetRoll = THREE.MathUtils.clamp(
    yawError * 1.5 + bank,
    -MAX_ROLL,
    MAX_ROLL
  );
}

function flyOrbit() {
  const x = planeGroup.position.x;
  const z = planeGroup.position.z;
  const out = headingTo(orbit.x, orbit.z, x, z);
  orbit.swept += wrapAngle(out - orbit.lastOut) * orbit.dir;
  orbit.lastOut = out;
  // Along the circle, leaning in or out to hold its radius
  const dist = Math.hypot(x - orbit.x, z - orbit.z);
  const correction = THREE.MathUtils.clamp(
    (dist - ORBIT_RADIUS) / ORBIT_RADIUS,
    -0.8,
    0.8
  );
  const heading = out + orbit.dir * (Math.PI / 2 + correction);
  // The bank that turns at the circle's rate (the flight model yaws 1.5
  // radians per second for each radian of roll)
  const speed = BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * 60;
  const bank = (orbit.dir * speed) / ORBIT_RADIUS / 1.5;
  steerTo(heading, bank);
}

export function updateAutopilot(delta) {
  state.isDoingImmelmann = false;
  const x = planeGroup.position.x;
  const z = planeGroup.position.z;
  const waypoint = getWaypoint();

  // A new waypoint ends any circling
  if (orbit && waypoint) orbit = null;
  if (waypoint) tourStop = null;
  if (!orbit && !waypoint && !tourStop) {
    tourStop = nextTourStop();
  }
  const target = waypoint || tourStop;

  // Arrived: circle it. The waypoint's done; the tour moves on after a lap.
  if (
    !orbit &&
    target &&
    Math.hypot(target.x - x, target.z - z) < ORBIT_RADIUS
  ) {
    startOrbit(target, !!waypoint);
    if (waypoint) clearWaypoint();
    else visited.add(tourStop.name);
  }
  if (orbit && !orbit.loiter && Math.abs(orbit.swept) >= Math.PI * 2) {
    orbit = null;
    tourStop = nextTourStop();
  }
  setTourStop(orbit ? null : tourStop);
  state.targetFlightSpeed = orbit ? ORBIT_SPEED : CRUISE_SPEED;

  // Heading
  let heading = planeGroup.rotation.y;
  if (orbit) {
    flyOrbit();
  } else if (target) {
    heading = headingTo(x, z, target.x, target.z);
    steerTo(heading);
  } else {
    state.targetRoll = 0;
  }

  // Height: over the ground ahead, or the circle's set height
  scanTimer -= delta;
  if (heldAlt === null || scanTimer <= 0) {
    scanTimer = SCAN_INTERVAL;
    let needed;
    if (orbit) {
      needed = orbit.alt;
    } else {
      needed = heightAlong(planeGroup.rotation.y);
      // Turning toward the target: clear what's that way too
      if (Math.abs(wrapAngle(heading - planeGroup.rotation.y)) > 0.2) {
        needed = Math.max(needed, heightAlong(heading));
      }
    }
    // Climb at once; come down gradually
    if (heldAlt === null || needed > heldAlt) heldAlt = needed;
    else heldAlt = Math.max(needed, heldAlt - DESCENT_RATE * SCAN_INTERVAL);
  }
  state.targetPitch = THREE.MathUtils.clamp(
    (heldAlt - planeGroup.position.y) * 0.015,
    -MAX_DESCENT,
    MAX_CLIMB
  );

  // Cancel manual maneuvers
  state.isLooping = false;
  state.isSteepPitch = false;
  state.isBarrelRolling = false;
  state.isClampedRoll = false;
}

// Forget the route when the autopilot is turned off
export function resetAutopilot() {
  heldAlt = null;
  orbit = null;
  tourStop = null;
  setTourStop(null);
}
