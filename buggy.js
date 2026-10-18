// --- BUGGY DRIVING ---
// The buggy takes the place of the flight model and flight physics
// (game-loop.js) while it's the active vehicle. Arcade handling: the engine
// pulls hard and tails off toward top speed, the steering tightens at low
// speed and is capped at speed by how much grip the tyres have, the tyres
// let the back step out a little in fast turns, and crests throw it into
// the air. It drives on the ground as drawn (sampleGround), the highway deck
// and bridges, and floats slowly across water.
//
// Controls: up/down (or the stick's forward and back) are gas and brake,
// then reverse once stopped; left/right steer. The throttle slider is a
// cruise control it holds when no pedal is pressed, and braking cancels it.
import * as THREE from 'three';
import {getElevation, sampleGround} from './terrain-geometry.js';
import {sampleRoad} from './terrain-chunks.js';
import {planeGroup} from './airplane.js';
import {BUGGY_WHEEL_RADIUS, BUGGY_WHEELBASE} from './buggy-model.js';
import {BASE_FLIGHT_SPEED, PLANE_HANDLING, WATER_LEVEL} from './constants.js';
import {state} from './state.js';
import {keys} from './game-input-bindings.js';
import {setOnWheels} from './flight-physics.js';

// Speeds in units per second, which read as knots; accelerations in units
// per second squared
const KTS_PER_MULT = BASE_FLIGHT_SPEED * 60;
const TOP_SPEED = PLANE_HANDLING.buggy.topKts;
const REVERSE_TOP = 15;
const WATER_TOP = 12;
// About 0 to 60 knots in 3.5 seconds
const ENGINE_ACCEL = 24;
const REVERSE_ACCEL = 10;
const BRAKE_DECEL = 45;
// Rolling resistance, and drag growing with the square of the speed
const ROLL_DRAG = 3;
const AIR_DRAG = 0.0007;
const WATER_DRAG = 0.04;
// A little over twice real gravity: hops come back down briskly
const GRAVITY = 40;
// The sideways push the tyres can take: the steering is capped so a turn
// never asks for more (units/s², about 2.5 g)
const MAX_CORNERING = 48;
const MAX_STEER = 0.55;
// How fast the front wheels turn toward the stick, and back to centre
// (radians per second)
const STEER_RATE = 2.4;
const STEER_RETURN_RATE = 4.5;
// How quickly the tyres kill sideways sliding (per second): less grip on
// dirt than on the road lets the back slide out in fast turns
const GRIP_ROAD = 14;
const GRIP_GROUND = 10;
const GRIP_WATER = 1.5;
// How quickly the turn follows the steering (seconds)
const YAW_EASE_SECONDS = 0.08;
// Leaving the ground: when the ground drops away from under the buggy by
// more than this much vertical speed in a frame, it flies on instead of
// sticking to it
const LAUNCH_SPEED = 7;
// and leaves it at no more than this speed upward (a hop of about 4 m)
const MAX_LAUNCH_SPEED = 25;
// Ground steeper than this (rise per unit) is a wall it bumps against
const WALL_SLOPE = Math.tan((50 * Math.PI) / 180);
// It stays parked on slopes gentler than this pull (units/s²)
const PARK_HOLD = 9;
// How far below the highway deck it can be and still count as on it
const ROAD_CATCH_DEPTH = 2.0;
// How deep it floats in the water, its wheels half under
const FLOAT_DEPTH = 0.9;
// A jump of more than this between frames is a teleport (units)
const TELEPORT_DISTANCE = 300;

// The springs: stiffness and damping of the body's bounce on its wheels,
// and how much it leans with acceleration and cornering
const SPRING = 170;
const DAMPING = 13;
const SQUAT_PER_ACCEL = 0.003;
const LEAN_PER_ACCEL = 0.0028;
const MAX_LEAN = 0.12;
const LEAN_EASE_SECONDS = 0.15;
// How quickly the chassis tilts to the slope under it, and to its flight
// path in the air (seconds)
const TILT_EASE_SECONDS = 0.06;
const AIR_TILT_EASE_SECONDS = 0.4;

const _surface = {height: 0, slopeX: 0, slopeZ: 0, kind: 'ground'};
const _road = {height: 0, slopeX: 0, slopeZ: 0};
const _lastPos = new THREE.Vector3();
let lastModel = null;
// Horizontal velocity (world x and z) and vertical speed
let velX = 0;
let velZ = 0;
let velY = 0;
let yaw = 0;
let yawRate = 0;
let steer = 0;
let airborne = false;
// The body on its springs, and the chassis's tilt
let bounce = 0;
let bounceVel = 0;
let squat = 0;
let lean = 0;
let tiltPitch = 0;
let tiltRoll = 0;

// Fills _surface with what the wheels would rest on at (x, z), for a buggy
// at height y: the highway deck (on bridges too) when on it, otherwise the
// ground as drawn, or the water's surface over water
function sampleSurface(x, z, y) {
  if (sampleRoad(x, z, _road) && y >= _road.height - ROAD_CATCH_DEPTH) {
    _surface.height = _road.height;
    _surface.slopeX = _road.slopeX;
    _surface.slopeZ = _road.slopeZ;
    _surface.kind = 'road';
    return _surface;
  }
  sampleGround(x, z, _surface);
  _surface.kind = 'ground';
  if (getElevation(x, z) <= WATER_LEVEL + 0.1) {
    const float = WATER_LEVEL - FLOAT_DEPTH;
    if (_surface.height < float) {
      _surface.height = float;
      _surface.slopeX = 0;
      _surface.slopeZ = 0;
    }
    _surface.kind = 'water';
  }
  return _surface;
}

// Into the buggy: set down on the ground under where the plane was, rolling
// on at the speed it had (up to the buggy's top speed). Also after a
// teleport (the map's click-to-fly).
function enter() {
  yaw = planeGroup.rotation.y;
  const speed = Math.min(
    TOP_SPEED,
    Math.abs(state.flightSpeedMultiplier) * KTS_PER_MULT
  );
  velX = -Math.sin(yaw) * speed;
  velZ = -Math.cos(yaw) * speed;
  velY = 0;
  yawRate = 0;
  steer = 0;
  airborne = false;
  bounce = 0;
  bounceVel = 0;
  const pos = planeGroup.position;
  pos.y = sampleSurface(pos.x, pos.z, Infinity).height;
  // A road under a bridge would be the deck above: check again from there
  pos.y = sampleSurface(pos.x, pos.z, pos.y).height;
  const s = _surface;
  tiltPitch = Math.atan(-Math.sin(yaw) * s.slopeX - Math.cos(yaw) * s.slopeZ);
  tiltRoll = Math.atan(Math.cos(yaw) * s.slopeX - Math.sin(yaw) * s.slopeZ);
  state.autopilotEnabled = false;
  _lastPos.copy(pos);
}

// The stick's position past its deadzone (gyro tilt always counts)
function analogAxis(value) {
  const live =
    state.mouseControlActive || state.currentControlScheme === 'gyro';
  return live && Math.abs(value) >= 0.15
    ? THREE.MathUtils.clamp(value, -1, 1)
    : 0;
}

// Moves a value toward a target at no more than rate per second
function approach(value, target, rate, delta) {
  const step = rate * delta;
  return value + THREE.MathUtils.clamp(target - value, -step, step);
}

export function updateBuggy(delta) {
  const model = state.airplaneModel;
  if (state.isFreeCamera || !model) return;
  const pos = planeGroup.position;
  if (
    model !== lastModel ||
    pos.distanceToSquared(_lastPos) > TELEPORT_DISTANCE ** 2
  ) {
    lastModel = model;
    enter();
  }
  const dt = Math.min(delta, 0.05);

  // --- INPUT ---
  const shift = keys.Shift;
  let steerIn = -analogAxis(state.mouseX);
  if (keys.ArrowLeft && !shift) steerIn = 1;
  else if (keys.ArrowRight && !shift) steerIn = -1;
  let pedal = analogAxis(state.mouseY);
  if (keys.ArrowUp && !shift) pedal = 1;
  else if (keys.ArrowDown && !shift) pedal = -1;

  // --- FORCES ---
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let forward = velX * fx + velZ * fz;
  let side = velX * rx + velZ * rz;
  const speed = Math.hypot(velX, velZ);

  const ground = sampleSurface(pos.x, pos.z, pos.y);
  const onWater = ground.kind === 'water';
  const top = onWater ? WATER_TOP : TOP_SPEED;

  // The front wheels turn toward the stick, as far as the tyres can hold
  const cornerLimit = Math.atan(
    (MAX_CORNERING * BUGGY_WHEELBASE) / Math.max(1, forward * forward)
  );
  const steerTarget = steerIn * Math.min(MAX_STEER, cornerLimit);
  const returning =
    steerTarget === 0 || Math.sign(steerTarget) !== Math.sign(steer);
  steer = approach(
    steer,
    steerTarget,
    returning ? STEER_RETURN_RATE : STEER_RATE,
    dt
  );

  let driveAccel = 0;
  if (!airborne) {
    // Gravity along the slope: downhill speeds up, uphill slows
    const norm = Math.sqrt(1 + ground.slopeX ** 2 + ground.slopeZ ** 2);
    const slopeAlong = (fx * ground.slopeX + fz * ground.slopeZ) / norm;
    const slopeAcross = (rx * ground.slopeX + rz * ground.slopeZ) / norm;
    const slopeAccel = -GRAVITY * slopeAlong;

    // Rolling resistance and drag, which the engine makes up for below top
    // speed: it pulls hard away from a stop and tails off to nothing at top
    // speed, so that's where it tops out on the flat
    const drag =
      ROLL_DRAG +
      (onWater ? WATER_DRAG : AIR_DRAG) * forward * forward +
      (onWater ? 4 : 0);
    const engine = (v, max, accel) =>
      v >= max ? 0 : accel * (1 - (v / max) ** 2) + drag;

    // Gas, brake and reverse, or holding the cruise speed
    const cruise = Math.min(top, state.targetFlightSpeed * KTS_PER_MULT);
    if (pedal > 0) {
      driveAccel =
        forward < -1
          ? BRAKE_DECEL * pedal
          : engine(Math.max(0, forward), top, ENGINE_ACCEL) * pedal;
    } else if (pedal < 0) {
      // Braking cancels the cruise control (and the throttle slider shows it)
      if (state.targetFlightSpeed > 0) state.targetFlightSpeed = 0;
      driveAccel =
        forward > 1
          ? BRAKE_DECEL * pedal
          : engine(Math.max(0, -forward), REVERSE_TOP, REVERSE_ACCEL) * pedal;
    } else if (cruise > 0.5) {
      driveAccel = THREE.MathUtils.clamp(
        (cruise - forward) * 1.5 + drag,
        -BRAKE_DECEL * 0.3,
        engine(Math.max(0, forward), top, ENGINE_ACCEL)
      );
    }

    const coasting = pedal === 0 && cruise <= 0.5;
    if (
      coasting &&
      Math.abs(forward) < 0.5 &&
      Math.abs(slopeAccel) < PARK_HOLD
    ) {
      // Parked: the tyres hold it on gentle slopes
      forward = 0;
      side = 0;
    } else {
      forward += (driveAccel + slopeAccel) * dt;
      forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
    }

    // The tyres grip, killing most of any sideways slide
    side += -GRAVITY * slopeAcross * dt;
    const grip =
      ground.kind === 'road' ? GRIP_ROAD : onWater ? GRIP_WATER : GRIP_GROUND;
    side *= Math.exp(-grip * dt);

    // Turning: the turn the front wheels ask for, at this speed
    const wantYawRate = (forward * Math.tan(steer)) / BUGGY_WHEELBASE;
    yawRate += (wantYawRate - yawRate) * (1 - Math.exp(-dt / YAW_EASE_SECONDS));
  } else {
    // In the air: no grip, the spin carries on and slowly dies away
    yawRate *= Math.exp(-dt * 1.5);
  }

  // Velocity stays in the world as the buggy turns under it: the tyres pull
  // it round next frame, and that lag is the slide
  velX = fx * forward + rx * side;
  velZ = fz * forward + rz * side;
  yaw += yawRate * dt;

  // --- MOVE ---
  const oldX = pos.x;
  const oldZ = pos.z;
  const oldHeight = ground.height;
  pos.x += velX * dt;
  pos.z += velZ * dt;
  let surface = sampleSurface(pos.x, pos.z, pos.y);

  // Too steep to climb: a wall it bumps off, keeping only the part of its
  // speed along the wall
  const moved = Math.hypot(pos.x - oldX, pos.z - oldZ);
  const rise = surface.height - oldHeight;
  if (!onWater && rise > 0.5 && rise > WALL_SLOPE * moved) {
    pos.x = oldX;
    pos.z = oldZ;
    const g = Math.hypot(surface.slopeX, surface.slopeZ) || 1;
    const nx = surface.slopeX / g;
    const nz = surface.slopeZ / g;
    const into = velX * nx + velZ * nz;
    if (into > 0) {
      velX -= nx * into * 1.3;
      velZ -= nz * into * 1.3;
    }
    surface = sampleSurface(pos.x, pos.z, pos.y);
  }

  // --- UP AND DOWN ---
  const kick = (impact) => {
    bounceVel -= impact;
  };
  if (!airborne) {
    // Stick to the ground, unless it drops away faster than the buggy can
    // follow: then fly on (off a crest, or the end of a ramp)
    const groundVelY = (surface.height - pos.y) / dt;
    if (velY - groundVelY > LAUNCH_SPEED && !onWater) {
      airborne = true;
      // The springs soak up some of a steep ramp's kick
      velY = Math.min(velY, MAX_LAUNCH_SPEED) - GRAVITY * dt;
      pos.y += velY * dt;
    } else {
      // Bumps (the ground's slope changing under the wheels) jolt the springs
      kick((groundVelY - velY) * 0.06);
      velY = THREE.MathUtils.clamp(groundVelY, -200, 200);
      pos.y = surface.height;
    }
  } else {
    velY = Math.max(-400, velY - GRAVITY * dt);
    pos.y += velY * dt;
    if (pos.y <= surface.height) {
      // Touchdown: the springs take the impact, and a hard landing scrubs
      // off some speed
      const groundVelY = velX * surface.slopeX + velZ * surface.slopeZ;
      const impact = Math.max(0, groundVelY - velY);
      kick(impact * 0.09);
      const scrub = 1 - Math.min(0.3, impact * 0.004);
      velX *= scrub;
      velZ *= scrub;
      velY = groundVelY;
      pos.y = surface.height;
      airborne = false;
    }
  }
  _lastPos.copy(pos);

  // --- LOOKS ---
  planeGroup.rotation.set(0, yaw, 0);
  const s = surface;
  if (!airborne) {
    const pitch = Math.atan(
      -Math.sin(yaw) * s.slopeX - Math.cos(yaw) * s.slopeZ
    );
    const roll = Math.atan(Math.cos(yaw) * s.slopeX - Math.sin(yaw) * s.slopeZ);
    const ease = 1 - Math.exp(-dt / TILT_EASE_SECONDS);
    tiltPitch += (pitch - tiltPitch) * ease;
    tiltRoll += (roll - tiltRoll) * ease;
  } else {
    // Nose follows the flight path a little, and the roll levels out
    const ease = 1 - Math.exp(-dt / AIR_TILT_EASE_SECONDS);
    const path = Math.atan2(velY, Math.max(1, speed)) * 0.6;
    tiltPitch += (path - tiltPitch) * ease;
    tiltRoll += (0 - tiltRoll) * ease;
  }
  model.rotation.set(tiltPitch, 0, tiltRoll);
  model.position.y = 0;

  // The body bounces on its springs, squats as it pulls away (dips as it
  // brakes) and leans out of turns
  bounceVel += (-SPRING * bounce - DAMPING * bounceVel) * dt;
  bounce = THREE.MathUtils.clamp(bounce + bounceVel * dt, -0.6, 0.6);
  const leanEase = 1 - Math.exp(-dt / LEAN_EASE_SECONDS);
  const squatTarget = airborne ? 0 : driveAccel * SQUAT_PER_ACCEL;
  const leanTarget = airborne ? 0 : -forward * yawRate * LEAN_PER_ACCEL;
  squat +=
    (THREE.MathUtils.clamp(squatTarget, -MAX_LEAN, MAX_LEAN) - squat) *
    leanEase;
  lean +=
    (THREE.MathUtils.clamp(leanTarget, -MAX_LEAN, MAX_LEAN) - lean) * leanEase;
  if (model.body) {
    const bob = onWater ? Math.sin(performance.now() * 0.0024) * 0.12 : 0;
    model.body.position.y = bounce + bob;
    model.body.rotation.set(squat, 0, lean);
  }
  if (model.wheels) {
    const roll = (forward * dt) / BUGGY_WHEEL_RADIUS;
    for (const wheel of model.wheels) wheel.rotation.x -= roll;
  }
  if (model.steerPivots) {
    for (const pivot of model.steerPivots) pivot.rotation.y = steer;
  }

  // --- WHAT THE REST OF THE GAME READS ---
  // The speed readout, the engine sound and the dust go by the speed, and
  // the jobs count a stop at an airport by the wheels being down
  state.flightSpeedMultiplier = speed / KTS_PER_MULT;
  state._nextYaw = yaw;
  state.verticalVelocity = 0;
  state.lastY = pos.y;
  state.isOnWater = !airborne && onWater;
  state.isOnGround = !airborne && !onWater;
  setOnWheels(state.isOnGround);
  // None of the planes' maneuvers apply (a triple tap can still ask for one)
  state.targetPitch = 0;
  state.targetRoll = 0;
  state.isDoingImmelmann = false;
  state.isLooping = false;
  state.isBarrelRolling = false;
  state.isSteepPitch = false;
  state.sharpTurnAmount = 0;
}
