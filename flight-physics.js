import * as THREE from 'three';
import {getElevation, sampleGround} from './terrain-geometry.js';
import {planeGroup} from './airplane.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {rainParticles} from './weather-manager.js';
import {state} from './state.js';
import {keys} from './game-input-bindings.js';
import {Achievements} from './achievements.js';

// Wheeled planes touch down on ground gentler than 15° (rise per unit) and,
// once rolling, stay down on ground up to 30°: the land is hilly at the scale
// of the terrain's triangles, and one threshold would bounce a rolling plane
// on and off the ground
const TOUCHDOWN_SLOPE = Math.tan((15 * Math.PI) / 180);
const ROLLING_SLOPE = Math.tan((30 * Math.PI) / 180);
const _ground = {height: 0, slopeX: 0, slopeZ: 0};
let isRolling = false;
// Whether the throttle has been opened since settling on the water or the
// ground (see the surface drag below), and its setting last frame: every
// throttle input (keys, gamepad, the on-screen buttons) raises it, and only
// the surface drag lowers it on its own
let throttleOpenedOnSurface = false;
let lastTargetSpeed = 0;
// The model's tilt to the slope under its wheels (pitch, roll), kept apart
// from the water bob and the in-flight turbulence so it eases back to level
// after takeoff instead of snapping
let groundTiltPitch = 0;
let groundTiltRoll = 0;
// How slowly the model levels out after leaving the ground (seconds)
const TILT_LEVEL_SECONDS = 0.5;

// Slow flight: how fast the plane sinks (units per second, 25 ft each), none
// at 100 knots and up, easing in to 15 at 50 knots, so landing is a matter of
// slowing down gently
const smoothstep = THREE.MathUtils.smoothstep;
function sinkRateAt(kts) {
  return 15 * (1 - smoothstep(kts, 50, 100));
}
// How quickly the sink follows a change of speed (seconds)
const SINK_EASE_SECONDS = 1.0;
// Slower still, the plane falls out of the sky and tumbles: gravity takes
// over, blending in from 55 down to 35 knots (fallAmount) instead of
// switching on at one speed
const FALL_START_KTS = 55;
const FALL_FULL_KTS = 35;
const GRAVITY = 120; // units/sec²: weighty but not instant
const TERMINAL_VELOCITY = -600;
// How quickly the fall comes on, and fades when powering out of it (seconds)
const FALL_EASE_SECONDS = 0.6;
let fallAmount = 0;
// How far the nose dips in slow flight, a stall you can see (radians)
const STALL_NOSE_DIP = -0.18;
let stallNose = 0;

// Eases the ground tilt back toward level, the same whatever the frame rate
function levelGroundTilt(delta) {
  const ease = 1 - Math.exp(-delta / TILT_LEVEL_SECONDS);
  groundTiltPitch = THREE.MathUtils.lerp(groundTiltPitch, 0, ease);
  groundTiltRoll = THREE.MathUtils.lerp(groundTiltRoll, 0, ease);
}

// The plane's height resting on its wheels on _ground: on a slope the wheels
// are wheelDepth from the ground at right angles to it, further straight up
function wheelRestHeight(wheelDepth) {
  return (
    _ground.height +
    wheelDepth * Math.sqrt(1 + _ground.slopeX ** 2 + _ground.slopeZ ** 2)
  );
}

export function updateFlightPhysics(delta, nowTime) {
  // --- FLIGHT PHYSICS & SPEED ---
  const terrainHeight = getElevation(
    planeGroup.position.x,
    planeGroup.position.z
  );
  let isWater = terrainHeight <= WATER_LEVEL + 0.1;

  // Ground avoidance heights:
  // Over water, avoidance and resting heights are anchored to WATER_LEVEL (surface)
  // rather than terrainHeight (the seabed below the water).
  let minFlightHeight = isWater ? WATER_LEVEL + 2.8 : terrainHeight + 10.0;
  let restingHeight = minFlightHeight + 2.0;

  // Wheeled planes (not the classic, a floatplane) with their gear down can
  // come down onto gentle ground and roll on their wheels, on the ground as
  // drawn (sampleGround). Elsewhere, and with the gear up, the cushion above
  // stays, so there's no landing on a mountainside.
  const wheelDepth = state.airplaneModel?.wheelDepth;
  const gearDown =
    wheelDepth !== undefined &&
    (!state.airplaneModel.gearGroups || state.gearExtension >= 1);
  let onLandableGround = false;
  if (!isWater && gearDown) {
    sampleGround(planeGroup.position.x, planeGroup.position.z, _ground);
    onLandableGround =
      Math.hypot(_ground.slopeX, _ground.slopeZ) <
      (isRolling ? ROLLING_SLOPE : TOUCHDOWN_SLOPE);
    if (onLandableGround) {
      restingHeight = wheelRestHeight(wheelDepth);
      minFlightHeight = restingHeight - 2.0;
    }
  }

  if (
    !state.isFreeCamera &&
    (state.flightSpeedMultiplier > 0 || Math.abs(state.targetFlightSpeed) > 0)
  ) {
    // Apply the yaw calculated by the flight model
    planeGroup.rotation.y = state._nextYaw;

    // --- GRAVITY ACCELERATION/DECELERATION ---
    // Nose down = gain speed, Nose up = lose speed
    // planeGroup.rotation.x: negative is diving, positive is climbing
    const pitchRad = planeGroup.rotation.x;
    const gravityEffect = -Math.sin(pitchRad); // positive when diving

    if (gravityEffect > 0) {
      // Accelerate in dive (reduced for softer feel)
      // Suppress gravity acceleration if we are actively being pushed up by ground avoidance
      const softBuffer = 2.0;
      const isAvoidingGround =
        planeGroup.position.y < minFlightHeight + softBuffer;

      // Dramatically reduced acceleration when skimming the ground/water,
      // and none while falling: a nose the tumble tipped down would win back
      // speed and pop the plane out of the fall, lurching forward
      const diveGain = (isAvoidingGround ? 0.1 : 0.7) * (1 - fallAmount);
      state.flightSpeedMultiplier += gravityEffect * diveGain * delta;
    }
  }

  // --- SPEED RECOVERY (DRAG & THROTTLE) ---
  // Automatically return to the target throttle speed.
  // We update this even at speed 0 so the vehicle can start moving again.
  if (
    Math.abs(state.flightSpeedMultiplier) > 0.001 ||
    Math.abs(state.targetFlightSpeed) > 0.001
  ) {
    let recoveryRate = 0.6;

    if (keys.Shift || state.flightSpeedMultiplier < state.targetFlightSpeed) {
      recoveryRate = 10.0; // Snappy responsiveness for active control/acceleration
    }
    state.flightSpeedMultiplier = THREE.MathUtils.lerp(
      state.flightSpeedMultiplier,
      state.targetFlightSpeed,
      recoveryRate * delta
    );

    // Easing never quite arrives, so settle once close (a plane stopping on
    // the water or the ground stops, rather than creeping and its prop
    // twitching)
    if (
      Math.abs(state.flightSpeedMultiplier - state.targetFlightSpeed) < 0.01
    ) {
      state.flightSpeedMultiplier = state.targetFlightSpeed;
    }
    state.flightSpeedMultiplier = Math.max(
      0,
      Math.min(10, state.flightSpeedMultiplier)
    );
  }

  // Move vehicle
  const currentKTS =
    BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  // Rolling on the wheels sticks to the ground (downhill too) unless the nose
  // is raised to take off
  const followingGround =
    isRolling && onLandableGround && planeGroup.rotation.x < 0.05;

  // Apply forward movement
  if (!state.isFreeCamera && state.flightSpeedMultiplier > 0) {
    planeGroup.translateZ(
      -(BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * delta * 60)
    );
  }

  // Slow flight sinks, more the slower it goes (sinkRateAt), down to the
  // resting height (on the water, the wheels or the cushion over land), not
  // the minimum below it, which the ground avoidance would only push it back
  // up from. Slower still it falls (fallAmount): gravity accelerates it and
  // it tumbles. Its fall carries over when it powers out, fading as the sink
  // takes back over, so neither the throttle nor the speed ever jerks it.
  const airborne =
    !state.isFreeCamera &&
    planeGroup.position.y > restingHeight &&
    !followingGround;
  fallAmount = THREE.MathUtils.lerp(
    fallAmount,
    airborne ? 1 - smoothstep(currentKTS, FALL_FULL_KTS, FALL_START_KTS) : 0,
    1 - Math.exp(-delta / FALL_EASE_SECONDS)
  );
  if (airborne) {
    state.verticalVelocity -= GRAVITY * fallAmount * delta;
    state.verticalVelocity = THREE.MathUtils.lerp(
      state.verticalVelocity,
      -sinkRateAt(currentKTS),
      (1 - fallAmount) * (1 - Math.exp(-delta / SINK_EASE_SECONDS))
    );
    state.verticalVelocity = Math.max(
      state.verticalVelocity,
      TERMINAL_VELOCITY
    );
    planeGroup.position.y = Math.max(
      restingHeight,
      planeGroup.position.y + state.verticalVelocity * delta
    );

    // Tumble, harder the faster it falls
    const tumble =
      Math.min(1.5, Math.abs(state.verticalVelocity) / 300) * fallAmount;
    if (tumble > 0) {
      planeGroup.rotation.x +=
        (Math.sin(nowTime * 0.002) + Math.cos(nowTime * 0.0011)) *
        0.8 *
        tumble *
        delta;
      planeGroup.rotation.z +=
        (Math.cos(nowTime * 0.0025) + Math.sin(nowTime * 0.0017)) *
        0.8 *
        tumble *
        delta;
      planeGroup.rotation.y +=
        (Math.sin(nowTime * 0.0015) + Math.cos(nowTime * 0.0009)) *
        0.5 *
        tumble *
        delta;
    }
  } else {
    state.verticalVelocity = 0;
  }
  // The nose dips as the plane gets slow, a visible stall (the tumble takes
  // over once it falls)
  stallNose = THREE.MathUtils.lerp(
    stallNose,
    airborne
      ? STALL_NOSE_DIP * (1 - smoothstep(currentKTS, 30, 70)) * (1 - fallAmount)
      : 0,
    1 - Math.exp(-delta / SINK_EASE_SECONDS)
  );

  if (
    !state.isFreeCamera &&
    (planeGroup.position.y <= restingHeight + 0.1 || followingGround)
  ) {
    // Grounded — rest flat peacefully, kill vertical velocity. On land the
    // plane stays level (so the flight model and controls work as on water)
    // and only the model tilts to the slope, below.
    state.verticalVelocity = 0;
    state.targetPitch = 0;
    state.targetRoll = 0;
    while (planeGroup.rotation.x > Math.PI)
      planeGroup.rotation.x -= 2 * Math.PI;
    while (planeGroup.rotation.x < -Math.PI)
      planeGroup.rotation.x += 2 * Math.PI;
    while (planeGroup.rotation.z > Math.PI)
      planeGroup.rotation.z -= 2 * Math.PI;
    while (planeGroup.rotation.z < -Math.PI)
      planeGroup.rotation.z += 2 * Math.PI;

    planeGroup.rotation.x = THREE.MathUtils.lerp(
      planeGroup.rotation.x,
      0,
      0.1 * delta * 60
    );
    planeGroup.rotation.z = THREE.MathUtils.lerp(
      planeGroup.rotation.z,
      0,
      0.1 * delta * 60
    );
    if (followingGround) {
      // Rolling on the wheels follows the ground exactly, where the plane is
      // now (it has moved since the top of the frame)
      sampleGround(planeGroup.position.x, planeGroup.position.z, _ground);
      planeGroup.position.y = wheelRestHeight(wheelDepth);
    } else {
      // Smooth landing
      planeGroup.position.y = THREE.MathUtils.lerp(
        planeGroup.position.y,
        restingHeight,
        0.1 * delta * 60
      );
    }

    if (state.airplaneModel) {
      if (isWater && planeGroup.position.y <= restingHeight + 0.1) {
        const bobTime = performance.now() * 0.001 * 1.2;
        levelGroundTilt(delta);
        state.airplaneModel.position.y = Math.sin(bobTime) * 0.15;
        state.airplaneModel.rotation.x =
          Math.cos(bobTime * 1.1) * 0.03 + groundTiltPitch;
        state.airplaneModel.rotation.z =
          Math.sin(bobTime * 0.8) * 0.04 + groundTiltRoll;
      } else if (onLandableGround) {
        // Tilt the model to the slope under its wheels
        const yaw = planeGroup.rotation.y;
        const groundPitch = Math.atan(
          -Math.sin(yaw) * _ground.slopeX - Math.cos(yaw) * _ground.slopeZ
        );
        const groundRoll = Math.atan(
          Math.cos(yaw) * _ground.slopeX - Math.sin(yaw) * _ground.slopeZ
        );
        const ease = 1 - Math.pow(1 - 0.2, delta * 60);
        groundTiltPitch = THREE.MathUtils.lerp(
          groundTiltPitch,
          groundPitch,
          ease
        );
        groundTiltRoll = THREE.MathUtils.lerp(groundTiltRoll, groundRoll, ease);
        state.airplaneModel.position.y = 0;
        state.airplaneModel.rotation.x = groundTiltPitch;
        state.airplaneModel.rotation.z = groundTiltRoll;
      } else {
        // Over ground too steep to roll on (just lifted off a slope the
        // wheels could stay on, but not touch down on): level out gently
        levelGroundTilt(delta);
        state.airplaneModel.position.y = 0;
        state.airplaneModel.rotation.x = groundTiltPitch;
        state.airplaneModel.rotation.z = groundTiltRoll;
      }
    }
  } else if (state.airplaneModel) {
    // In-flight turbulence bobbing (increases in rain/storms)
    const t = performance.now() * 0.001;
    const rainOpacity = rainParticles ? rainParticles.material.opacity : 0;
    const stormMult = 1.0 + rainOpacity * 4.0; // 1x calm → 3x heavy rain
    state.airplaneModel.position.y =
      (Math.sin(t * 0.7) * 0.12 + Math.sin(t * 1.3) * 0.06) * stormMult;
    // On top of the ground tilt, which levels out gently after takeoff
    levelGroundTilt(delta);
    state.airplaneModel.rotation.x =
      (Math.cos(t * 0.9) * 0.015 + Math.sin(t * 1.7) * 0.008) * stormMult +
      groundTiltPitch;
    state.airplaneModel.rotation.z =
      (Math.sin(t * 0.6) * 0.02 + Math.cos(t * 1.1) * 0.01) * stormMult +
      groundTiltRoll;
  }
  if (state.airplaneModel) state.airplaneModel.rotation.x += stallNose;

  // Speed controls

  if (keys.ArrowDown) {
    keys.ArrowUp = false;
  }

  // Apply Ground avoidance — soft cushion + hard clamp + kill velocity on impact
  const softBuffer = 2.0;
  if (planeGroup.position.y < minFlightHeight + softBuffer) {
    // Smoothly push up if we're in the "soft" buffer zone
    planeGroup.position.y = THREE.MathUtils.lerp(
      planeGroup.position.y,
      minFlightHeight + softBuffer,
      0.1 * delta * 60
    );

    // Hard clamp at the actual minimum
    if (planeGroup.position.y < minFlightHeight) {
      planeGroup.position.y = minFlightHeight;
      state.verticalVelocity = 0; // Kill accumulated gravity immediately on ground impact
    }
  }

  if (
    (isWater || onLandableGround) &&
    planeGroup.position.y <= restingHeight + 0.1
  ) {
    if (isWater && !state.isFreeCamera) {
      Achievements.unlock('splash_down');
    }
    if (isWater) state.gearWanted = true;
    // Water (or rolling) drag: after touching down the throttle eases back
    // to idle, so the plane slows to a gentle stop. Once it's opened again
    // on the surface, it stays open for the takeoff run.
    if (state.targetFlightSpeed > lastTargetSpeed + 1e-6) {
      throttleOpenedOnSurface = true;
    }
    if (!throttleOpenedOnSurface) {
      state.targetFlightSpeed = Math.max(
        0,
        state.targetFlightSpeed - delta * 0.5
      );
    }
  } else {
    throttleOpenedOnSurface = false;
  }
  lastTargetSpeed = state.targetFlightSpeed;

  const maxFlightHeight = 4045.5; // ~100,000 ft display altitude ((4045.5 - 45.5) * 25 = 100,000)
  if (planeGroup.position.y > maxFlightHeight) {
    planeGroup.position.y = maxFlightHeight;
  }

  // On the wheels this frame (on the ground under where the plane is now):
  // the next frame allows steeper ground
  isRolling = false;
  if (onLandableGround) {
    sampleGround(planeGroup.position.x, planeGroup.position.z, _ground);
    isRolling = planeGroup.position.y <= wheelRestHeight(wheelDepth) + 0.5;
  }

  // Pontoons and retractable wheels come down approaching water (and, for
  // wheels, any ground) and go up climbing away, by height above the surface
  const surfaceAlt = Math.round(
    Math.max(
      0,
      planeGroup.position.y - (isWater ? WATER_LEVEL : terrainHeight)
    ) * 25
  );
  if (surfaceAlt >= 2000) state.gearWanted = false;

  const currentY = planeGroup.position.y;
  const isDescending = currentY < state.lastY;
  state.lastY = currentY;

  // Low and coming down, or low and slow (an approach can hold its height
  // over rising ground)
  if (
    (isWater || wheelDepth !== undefined) &&
    surfaceAlt < 1500 &&
    (isDescending || currentKTS < 100)
  ) {
    state.gearWanted = true;
  }
}
