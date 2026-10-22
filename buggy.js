// --- BUGGY DRIVING ---
// The buggy takes the place of the flight model and flight physics
// (game-loop.js) while it's the active vehicle. Arcade handling: the engine
// pulls hard and tails off toward top speed, the steering is responsive on
// highway curves and tightens at speed, tyres grip firmly with zero sliding
// out, and suspension is critically damped for a smooth, stable ride over
// rolling hills. It drives on the ground as drawn (sampleGround), the highway
// deck and bridges (sampleRoad with 3D elevation awareness), and floats
// slowly across water.
//
// Controls: one-handed joystick control. The throttle slider sets target cruise
// speed. The virtual joystick steers left/right. Pushing up temporarily boosts
// up to top speed. Pulling down smoothly brakes to a stop, and continuing to
// hold down shifts into reverse. Releasing the stick smoothly resumes cruising
// forward at the set speed. Tapping the screen (or double-tap-and-dragging,
// tapping with a second finger, or pressing Spacebar) triggers a hop;
// landing from a hop while turning locks into a drift that charges a
// mini-turbo speed boost upon release.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {getElevation, sampleGround} from './terrain-geometry.js';
import {sampleRoad} from './terrain-chunks.js';
import {planeGroup} from './airplane.js';
import {BUGGY_WHEEL_RADIUS, BUGGY_WHEELBASE} from './buggy-model.js';
import {BASE_FLIGHT_SPEED, PLANE_HANDLING, WATER_LEVEL} from './constants.js';
import {state} from './state.js';
import {inputManager, keys} from './game-input-bindings.js';
import {setOnWheels} from './flight-physics.js';

// Speeds in units per second, which read as knots; accelerations in units
// per second squared
const KTS_PER_MULT = BASE_FLIGHT_SPEED * 60;
const TOP_SPEED = PLANE_HANDLING.buggy.topKts;
const REVERSE_TOP = 20;
const WATER_TOP = 12;
// About 0 to 60 knots in 3 seconds, 100 in 7
const ENGINE_ACCEL = 30;
const REVERSE_ACCEL = 14;
const BRAKE_DECEL = 45;
// Rolling resistance, and drag growing with the square of the speed
const ROLL_DRAG = 3;
const AIR_DRAG = 0.0007;
const WATER_DRAG = 0.04;
// A little over twice real gravity: hops come back down briskly
const GRAVITY = 40;
// Responsive cornering authority so the buggy hugs highway curves even at high speed
const MAX_CORNERING = 160;
const MAX_STEER = 0.55;
const MIN_STEER_HIGH_SPEED = 0.18;
// How fast the front wheels turn toward the stick, and back to centre
// (radians per second)
const STEER_RATE = 2.8;
const STEER_RETURN_RATE = 5.0;
// Pure grip: tyres kill sideways sliding quickly so the buggy tracks predictably
const GRIP_ROAD = 25;
const GRIP_GROUND = 18;
const GRIP_WATER = 4;
// How quickly the turn follows the steering (seconds)
const YAW_EASE_SECONDS = 0.08;
// Leaving the ground: roads hug hill contours; rough ground hops off crests
const LAUNCH_SPEED_ROAD = 35;
const LAUNCH_SPEED_GROUND = 10;
// How the height the springs follow eases toward the ground under the wheels
const RIDE_RISE_SECONDS = 0.06;
const RIDE_FALL_SECONDS = 0.5;
// and leaves it at no more than this speed upward
const MAX_LAUNCH_SPEED = 25;
// Ground steeper than this (rise per unit) is a wall it bumps against
const WALL_SLOPE = Math.tan((50 * Math.PI) / 180);
// It stays parked on slopes gentler than this pull (units/s²)
const PARK_HOLD = 9;
// Roads: a deck up to this far above the wheels is a kerb it smoothly mounts
// (allowing the buggy to easily climb back onto the highway from off-road)
const ROAD_STEP_UP = 12;
const BRIDGE_CLEARANCE = 12;
// How deep it floats in the water, its wheels half under
const FLOAT_DEPTH = 0.9;
// A jump of more than this between frames is a teleport (units)
const TELEPORT_DISTANCE = 300;

// The springs: critically damped body bounce on its wheels (c = 2*sqrt(k))
// to eliminate irritating oscillations and pogo-stick bouncing
const SPRING = 80;
const DAMPING = 18;
const SQUAT_PER_ACCEL = 0.0025;
const LEAN_PER_ACCEL = 0.0024;
const MAX_LEAN = 0.1;
const LEAN_EASE_SECONDS = 0.18;
// How quickly the chassis tilts to the slope under it
const TILT_EASE_SECONDS = 0.12;
const AIR_TILT_EASE_SECONDS = 0.4;

const _surface = {
  height: 0,
  slopeX: 0,
  slopeZ: 0,
  kind: 'ground',
  underDeck: false,
};
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
// The eased ground height the springs follow, or null while airborne
let ride = null;
// The body on its springs, and the chassis's tilt
let bounce = 0;
let bounceVel = 0;
let squat = 0;
let lean = 0;
let tiltPitch = 0;
let tiltRoll = 0;
const driftState = ChillFlightLogic.createBuggyDriftState();

// Fills _surface with what the wheels would rest on at (x, z), for a buggy
// at height y: the highway deck (with 3D elevation awareness for junctions/overpasses)
// when on it, otherwise the ground as drawn, or the water's surface over water
function sampleSurface(x, z, y) {
  const onDeck = sampleRoad(x, z, _road, y);
  if (onDeck && y >= _road.height - ROAD_STEP_UP) {
    _surface.height = _road.height;
    _surface.slopeX = _road.slopeX;
    _surface.slopeZ = _road.slopeZ;
    _surface.kind = 'road';
    _surface.underDeck = false;
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
  // Beside a deck too high to climb up onto, and within clearance of girder underside
  _surface.underDeck =
    onDeck &&
    y >= _road.height - BRIDGE_CLEARANCE &&
    y < _road.height - ROAD_STEP_UP;
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
  // Cruise control no faster than the buggy goes
  state.targetFlightSpeed = Math.min(
    state.targetFlightSpeed || 0,
    TOP_SPEED / KTS_PER_MULT
  );
  velY = 0;
  yawRate = 0;
  steer = 0;
  airborne = false;
  bounce = 0;
  bounceVel = 0;
  Object.assign(driftState, ChillFlightLogic.createBuggyDriftState());
  inputManager.consumeHop();
  const pos = planeGroup.position;
  pos.y = sampleSurface(pos.x, pos.z, Infinity).height;
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
  if ((keys.ArrowLeft || keys.KeyA) && !shift) steerIn = 1;
  else if ((keys.ArrowRight || keys.KeyD) && !shift) steerIn = -1;

  let joyY = analogAxis(state.mouseY);
  if ((keys.ArrowUp || keys.KeyW) && !shift) joyY = 1;
  else if ((keys.ArrowDown || keys.KeyS) && !shift) joyY = -1;

  const hop = inputManager.consumeHop();
  const spaceHeld = !!keys.Space;

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

  // Hop-to-drift state machine
  const {driftYawRate} = ChillFlightLogic.stepBuggyDrift(
    driftState,
    {hop, airborne, onWater, forward, steerIn, joyY, spaceHeld},
    dt
  );
  if (driftState.hopJustStarted) {
    const groundVelY = velX * ground.slopeX + velZ * ground.slopeZ;
    airborne = true;
    ride = null;
    velY = groundVelY + ChillFlightLogic.BUGGY_DRIFT.HOP_VELOCITY;
    pos.y = Math.max(pos.y, ground.height) + 0.15;
    bounceVel += ChillFlightLogic.BUGGY_DRIFT.HOP_SPRING_KICK;
  }
  if (driftState.boostJustFired > 0) {
    squat -= 0.06;
  }

  // Steering authority: responsive cornering on highway curves even at speed
  const cornerLimit = Math.atan(
    (MAX_CORNERING * BUGGY_WHEELBASE) / Math.max(1, forward * forward)
  );
  const steerLimit = Math.max(MIN_STEER_HIGH_SPEED, cornerLimit);
  const steerTarget = steerIn * Math.min(MAX_STEER, steerLimit);
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

    // Rolling resistance and drag
    const drag =
      ROLL_DRAG +
      (onWater ? WATER_DRAG : AIR_DRAG) * forward * forward +
      (onWater ? 4 : 0);
    const engine = (v, max, accel) =>
      v >= max ? 0 : accel * (1 - (v / max) ** 2) + drag;

    // Throttle slider sets baseline cruise speed
    const cruise = Math.min(
      top,
      Math.max(0, (state.targetFlightSpeed || 0) * KTS_PER_MULT)
    );

    if (driftState.boostTimer > 0 && !onWater && joyY >= -0.05) {
      // Mini-turbo speed boost awarded after releasing a charged drift
      const boostMax = top + driftState.boostSpeed;
      const baseTarget =
        joyY > 0.05
          ? cruise + (top - cruise) * joyY
          : Math.max(cruise, top * 0.75);
      const boostTarget = Math.min(
        boostMax,
        baseTarget + driftState.boostSpeed
      );
      driveAccel = THREE.MathUtils.clamp(
        (boostTarget - forward) * 3.0 + drag,
        -BRAKE_DECEL * 0.3,
        ChillFlightLogic.BUGGY_DRIFT.BOOST_ACCEL
      );
    } else if (joyY > 0.05) {
      // Pushing up: temporary boost above cruise speed up to top speed
      const boostTarget = cruise + (top - cruise) * joyY;
      driveAccel = THREE.MathUtils.clamp(
        (boostTarget - forward) * 2.0 + drag,
        -BRAKE_DECEL * 0.3,
        engine(Math.max(0, forward), top, ENGINE_ACCEL)
      );
    } else if (joyY < -0.05) {
      // Pulling down: brakes to a halt, then continuous hold shifts into reverse
      const downAmount = -joyY;
      if (forward > 0.5) {
        driveAccel = -BRAKE_DECEL * downAmount;
      } else {
        const revTarget = -REVERSE_TOP * downAmount;
        driveAccel = THREE.MathUtils.clamp(
          (revTarget - forward) * 2.0 - drag,
          -engine(Math.max(0, -forward), REVERSE_TOP, REVERSE_ACCEL),
          BRAKE_DECEL * 0.5
        );
      }
    } else if (cruise > 0.5) {
      // Neutral: hold set cruise speed. If reversing, brake to stop first then cruise forward
      if (forward < -0.5) {
        driveAccel = BRAKE_DECEL;
      } else {
        driveAccel = THREE.MathUtils.clamp(
          (cruise - forward) * 1.5 + drag,
          -BRAKE_DECEL * 0.3,
          engine(Math.max(0, forward), top, ENGINE_ACCEL)
        );
      }
    } else {
      // Cruise is 0 and stick is neutral: coast to stop
      driveAccel = forward > 0.5 ? -ROLL_DRAG : forward < -0.5 ? ROLL_DRAG : 0;
    }

    const coasting = Math.abs(joyY) <= 0.05 && cruise <= 0.5;
    if (
      coasting &&
      Math.abs(forward) < 0.5 &&
      Math.abs(slopeAccel) < PARK_HOLD
    ) {
      // Parked: tyres hold it on gentle slopes
      forward = 0;
      side = 0;
    } else {
      forward += (driveAccel + slopeAccel) * dt;
      forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
    }

    // Pure grip: tyres kill sideways sliding firmly without drift break-loose
    side += -GRAVITY * slopeAcross * dt;
    const grip =
      ground.kind === 'road' ? GRIP_ROAD : onWater ? GRIP_WATER : GRIP_GROUND;
    side *= Math.exp(-grip * dt);

    // Turning: follows drift arc when drifting, or front wheel angle normally
    const wantYawRate =
      driftYawRate !== null
        ? driftYawRate
        : (forward * Math.tan(steer)) / BUGGY_WHEELBASE;
    yawRate += (wantYawRate - yawRate) * (1 - Math.exp(-dt / YAW_EASE_SECONDS));
  } else if (driftState.hopping && Math.abs(steerIn) > 0.1) {
    // Mid-hop pre-rotation toward the turn
    const hopTurn = steerIn * ChillFlightLogic.BUGGY_DRIFT.BASE_YAW_RATE * 0.85;
    yawRate += (hopTurn - yawRate) * (1 - Math.exp(-dt / 0.08));
  } else {
    // In the air: spin carries on and slowly dies away
    yawRate *= Math.exp(-dt * 1.5);
  }

  yaw += yawRate * dt;
  const nfx = -Math.sin(yaw);
  const nfz = -Math.cos(yaw);
  const nrx = Math.cos(yaw);
  const nrz = -Math.sin(yaw);
  velX = nfx * forward + nrx * side;
  velZ = nfz * forward + nrz * side;

  const kick = (impact) => {
    bounceVel -= impact;
  };

  // --- MOVE ---
  const oldX = pos.x;
  const oldZ = pos.z;
  const oldHeight = ground.height;
  const wasOnRoad = ground.kind === 'road';
  const wasUnderDeck = ground.underDeck;

  const blocker = (x, z) => {
    const s = sampleSurface(x, z, pos.y);
    if (s.underDeck && !wasUnderDeck) return 'barrier';
    if (wasOnRoad && s.kind !== 'road' && oldHeight - s.height > ROAD_STEP_UP) {
      return 'barrier';
    }
    const rise = s.height - oldHeight;
    const moved = Math.hypot(x - oldX, z - oldZ);
    if (
      !onWater &&
      s.kind !== 'road' &&
      rise > 0.5 &&
      rise > WALL_SLOPE * moved
    ) {
      return 'wall';
    }
    return null;
  };

  const block = blocker(oldX + velX * dt, oldZ + velZ * dt);
  if (!block) {
    pos.x += velX * dt;
    pos.z += velZ * dt;
  } else if (block === 'barrier') {
    if (!blocker(oldX, oldZ + velZ * dt)) {
      pos.z += velZ * dt;
      velX *= -0.2;
    } else if (!blocker(oldX + velX * dt, oldZ)) {
      pos.x += velX * dt;
      velZ *= -0.2;
    } else {
      velX *= -0.2;
      velZ *= -0.2;
    }
    kick(Math.min(1.5, speed * 0.02));
  } else {
    const s = sampleSurface(oldX + velX * dt, oldZ + velZ * dt, pos.y);
    const g = Math.hypot(s.slopeX, s.slopeZ) || 1;
    const nx = s.slopeX / g;
    const nz = s.slopeZ / g;
    const into = velX * nx + velZ * nz;
    if (into > 0) {
      velX -= nx * into * 1.3;
      velZ -= nz * into * 1.3;
    }
  }
  const surface = sampleSurface(pos.x, pos.z, pos.y);

  // --- UP AND DOWN ---
  if (
    !airborne &&
    surface.kind === 'road' &&
    !wasOnRoad &&
    surface.height - pos.y > 0.5
  ) {
    // Smooth curb mounting when driving onto road from off-road
    const step = Math.min(surface.height - pos.y, ROAD_STEP_UP);
    pos.y += Math.min(step, 25 * dt);
    if (pos.y >= surface.height - 0.1) {
      pos.y = surface.height;
    }
    velY = 0;
    ride = pos.y;
  } else if (!airborne) {
    if (ride === null) ride = pos.y;
    const prevRide = ride;
    // On paved roads, follow the smoothed road deck closely so crests don't launch
    const seconds =
      surface.kind === 'road'
        ? 0.04
        : surface.height > ride
          ? RIDE_RISE_SECONDS
          : RIDE_FALL_SECONDS;
    ride += (surface.height - ride) * (1 - Math.exp(-dt / seconds));
    const rideVelY = (ride - prevRide) / dt;
    const launchLimit =
      surface.kind === 'road' ? LAUNCH_SPEED_ROAD : LAUNCH_SPEED_GROUND;

    if (velY - rideVelY > launchLimit && !onWater) {
      airborne = true;
      ride = null;
      velY = Math.min(velY, MAX_LAUNCH_SPEED) - GRAVITY * dt;
      pos.y += velY * dt;
    } else {
      // Critically damped suspension absorbs road contours without jarring kicks
      if (surface.kind !== 'road') {
        kick((rideVelY - velY) * 0.02);
      }
      velY = THREE.MathUtils.clamp(rideVelY, -200, 200);
      pos.y = ride;
    }
  } else {
    velY = Math.max(-400, velY - GRAVITY * dt);
    pos.y += velY * dt;
    if (pos.y <= surface.height) {
      // Touchdown: critically damped suspension settles quickly
      const groundVelY = velX * surface.slopeX + velZ * surface.slopeZ;
      const impact = Math.max(0, groundVelY - velY);
      if (impact > 2) kick(impact * 0.04);
      const scrub = 1 - Math.min(0.15, impact * 0.002);
      velX *= scrub;
      velZ *= scrub;
      velY = groundVelY;
      pos.y = surface.height;
      ride = null;
      airborne = false;
    }
  }
  _lastPos.copy(pos);

  // --- LOOKS ---
  planeGroup.rotation.set(0, yaw, 0);
  const s = surface;
  const visualYaw = yaw + driftState.slipYaw;
  if (!airborne) {
    const pitch = Math.atan(
      -Math.sin(visualYaw) * s.slopeX - Math.cos(visualYaw) * s.slopeZ
    );
    const roll = Math.atan(
      Math.cos(visualYaw) * s.slopeX - Math.sin(visualYaw) * s.slopeZ
    );
    const ease = 1 - Math.exp(-dt / TILT_EASE_SECONDS);
    tiltPitch += (pitch - tiltPitch) * ease;
    tiltRoll += (roll - tiltRoll) * ease;
  } else {
    const ease = 1 - Math.exp(-dt / AIR_TILT_EASE_SECONDS);
    const path = Math.atan2(velY, Math.max(1, speed)) * 0.6;
    tiltPitch += (path - tiltPitch) * ease;
    tiltRoll += (0 - tiltRoll) * ease;
  }
  model.rotation.order = 'YXZ';
  model.rotation.set(tiltPitch, driftState.slipYaw, tiltRoll);
  model.position.y = 0;

  // The body on its critically damped springs
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
    const wheelSteer = THREE.MathUtils.clamp(
      steer - driftState.slipYaw * 0.6,
      -MAX_STEER,
      MAX_STEER
    );
    for (const pivot of model.steerPivots) pivot.rotation.y = wheelSteer;
  }

  // --- WHAT THE REST OF THE GAME READS ---
  state.flightSpeedMultiplier = speed / KTS_PER_MULT;
  state._nextYaw = yaw;
  state.verticalVelocity = 0;
  state.lastY = pos.y;
  state.isOnWater = !airborne && onWater;
  state.isOnGround = !airborne && !onWater;
  setOnWheels(state.isOnGround);
  state.targetPitch = 0;
  state.targetRoll = 0;
  state.isDoingImmelmann = false;
  state.isLooping = false;
  state.isBarrelRolling = false;
  state.isSteepPitch = false;
  state.sharpTurnAmount = 0;
  state.buggySlide =
    !airborne && !onWater && driftState.driftDir !== 0
      ? THREE.MathUtils.clamp(0.75 + 0.12 * driftState.driftLevel, 0, 1)
      : 0;
  state.buggyDriftDir = driftState.driftDir;
  state.buggyDriftLevel = !airborne && !onWater ? driftState.driftLevel : 0;
  state.buggyBoost =
    driftState.boostTimer > 0
      ? THREE.MathUtils.clamp(driftState.boostTimer / 0.8, 0, 1)
      : 0;
  state.buggySlipYaw = driftState.slipYaw;
  state.buggyDriftState = driftState;
}
