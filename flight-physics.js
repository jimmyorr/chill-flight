import * as THREE from 'three';
import {getElevation} from './terrain-geometry.js';
import {planeGroup, pontoonGroup} from './airplane.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {rainParticles} from './weather-manager.js';
import {state} from './state.js';
import {inputManager, keys} from './game-input-bindings.js';

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

      if (!isAvoidingGround) {
        state.flightSpeedMultiplier += gravityEffect * 0.7 * delta;
      } else {
        // Dramatically reduced acceleration when skimming the ground/water
        state.flightSpeedMultiplier += gravityEffect * 0.1 * delta;
      }
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

    state.flightSpeedMultiplier = Math.max(
      0,
      Math.min(10, state.flightSpeedMultiplier)
    );
  }

  // Altitude and Speed constants
  const controlBaseAlt = Math.max(0, planeGroup.position.y - 45.5);
  const controlAlt = Math.round(controlBaseAlt * 25);

  // Move vehicle
  const currentKTS =
    BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  // Lower threshold for isFreefalling to eliminate the "stuck in mid-air" dead zone
  const isFreefalling =
    currentKTS < 50 && planeGroup.position.y > restingHeight + 2;

  // Apply forward movement
  if (!state.isFreeCamera && state.flightSpeedMultiplier > 0) {
    planeGroup.translateZ(
      -(BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * delta * 60)
    );
  }

  if (state.flightSpeedMultiplier > 0 && !isFreefalling) {
    state.verticalVelocity = 0; // Reset gravity accumulation while flying normally

    // Low speed stall/sink mechanics
    if (currentKTS < 100 && planeGroup.position.y > minFlightHeight) {
      const stallFactor = Math.max(0, (100 - Math.max(50, currentKTS)) / 50);
      planeGroup.position.y -= 15 * stallFactor * delta;
    }
  }

  if (!state.isFreeCamera && isFreefalling) {
    // Freefall tumble & accelerating gravity
    const GRAVITY = 120; // units/sec² — feels weighty but not instant
    state.verticalVelocity -= GRAVITY * delta;

    // Cap terminal velocity so it doesn't go impossibly fast
    const TERMINAL_VELOCITY = -600;
    state.verticalVelocity = Math.max(
      state.verticalVelocity,
      TERMINAL_VELOCITY
    );

    planeGroup.position.y += state.verticalVelocity * delta;

    const tumbleIntensity = Math.min(
      1.5,
      Math.abs(state.verticalVelocity) / 300
    );
    planeGroup.rotation.x +=
      (Math.sin(nowTime * 0.002) + Math.cos(nowTime * 0.0011)) *
      0.8 *
      tumbleIntensity *
      delta;
    planeGroup.rotation.z +=
      (Math.cos(nowTime * 0.0025) + Math.sin(nowTime * 0.0017)) *
      0.8 *
      tumbleIntensity *
      delta;
    planeGroup.rotation.y +=
      (Math.sin(nowTime * 0.0015) + Math.cos(nowTime * 0.0009)) *
      0.5 *
      tumbleIntensity *
      delta;
  } else if (
    !state.isFreeCamera &&
    planeGroup.position.y <= restingHeight + 0.1
  ) {
    // Grounded — rest flat peacefully, kill vertical velocity
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
    planeGroup.position.y = THREE.MathUtils.lerp(
      planeGroup.position.y,
      restingHeight,
      0.1 * delta * 60
    ); // Smooth landing

    if (state.airplaneModel) {
      if (isWater && planeGroup.position.y <= restingHeight + 0.1) {
        const bobTime = performance.now() * 0.001 * 1.2;
        state.airplaneModel.position.y = Math.sin(bobTime) * 0.15;
        state.airplaneModel.rotation.x = Math.cos(bobTime * 1.1) * 0.03;
        state.airplaneModel.rotation.z = Math.sin(bobTime * 0.8) * 0.04;
      } else {
        state.airplaneModel.position.y = 0;
        state.airplaneModel.rotation.x = 0;
        state.airplaneModel.rotation.z = 0;
      }
    }
  } else if (state.airplaneModel) {
    // In-flight turbulence bobbing (increases in rain/storms)
    const t = performance.now() * 0.001;
    const rainOpacity = rainParticles ? rainParticles.material.opacity : 0;
    const stormMult = 1.0 + rainOpacity * 4.0; // 1x calm → 3x heavy rain
    state.airplaneModel.position.y =
      (Math.sin(t * 0.7) * 0.12 + Math.sin(t * 1.3) * 0.06) * stormMult;
    state.airplaneModel.rotation.x =
      (Math.cos(t * 0.9) * 0.015 + Math.sin(t * 1.7) * 0.008) * stormMult;
    state.airplaneModel.rotation.z =
      (Math.sin(t * 0.6) * 0.02 + Math.cos(t * 1.1) * 0.01) * stormMult;
  }

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

  if (isWater && planeGroup.position.y <= restingHeight + 0.1) {
    if (typeof Achievements !== 'undefined' && !state.isFreeCamera) {
      Achievements.unlock('splash_down');
    }
    if (!pontoonGroup.visible) {
      pontoonGroup.scale.setScalar(0);
      state.pontoonDeploymentProgress = 0;
      pontoonGroup.visible = true;
      state.isDeployingPontoons = true;
    }
    const isThrottlingUp =
      keys.Shift ||
      (typeof inputManager !== 'undefined' &&
        inputManager.isThrottlingUp &&
        inputManager.isThrottlingUp());
    if (!isThrottlingUp) {
      // Apply water drag: smoothly reduce targetFlightSpeed to 0
      state.targetFlightSpeed = Math.max(
        0,
        state.targetFlightSpeed - delta * 0.5
      );
    }
    if (state.targetFlightSpeed === 0 && state.flightSpeedMultiplier < 0.05) {
      state.flightSpeedMultiplier = 0; // Force full stop to prevent prop twitching
    }
    // When on water, force neutral pitch/roll to ensure a level rest on water
    state.targetPitch = THREE.MathUtils.lerp(
      state.targetPitch,
      0,
      0.05 * delta * 60
    );
    state.targetRoll = THREE.MathUtils.lerp(
      state.targetRoll,
      0,
      0.05 * delta * 60
    );
  }

  const maxFlightHeight = 4045.5; // ~100,000 ft display altitude ((4045.5 - 45.5) * 25 = 100,000)
  if (planeGroup.position.y > maxFlightHeight) {
    planeGroup.position.y = maxFlightHeight;
  }

  if (
    controlAlt >= 2000 &&
    pontoonGroup.visible &&
    !state.isRetractingPontoons
  ) {
    state.isRetractingPontoons = true;
  }

  const currentY = planeGroup.position.y;
  const isDescending = currentY < state.lastY;
  state.lastY = currentY;

  if (isWater && controlAlt < 1500 && isDescending && !pontoonGroup.visible) {
    pontoonGroup.scale.setScalar(0);
    state.pontoonDeploymentProgress = 0;
    pontoonGroup.visible = true;
    state.isDeployingPontoons = true;
  }
}
window.updateFlightPhysics = updateFlightPhysics;

// Bridge for classic scripts that haven't been converted to ES modules yet.
