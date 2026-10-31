import * as THREE from 'three';
import {getElevation, sampleGround} from './terrain-geometry.js';
import {sampleRoad} from './terrain-chunks.js';
import {ARCH, archCeiling, archGround} from './arches-logic.js';
import {arches} from './arches.js';
import {planeGroup, planeHandling} from './airplane.js';
import {BASE_FLIGHT_SPEED, WATER_LEVEL} from './constants.js';
import {precipitation} from './weather-manager.js';
import {state} from './state.js';
import {
  FLIGHT,
  airborneVerticalVelocity,
  canLiftOff,
  fallAmountAt,
  pitchedTarget,
  throttleSpeed,
} from './flight-physics-logic.js';
import {keys} from './game-input-bindings.js';
import {Achievements} from './achievements.js';
import {hooks} from './hooks.js';

// Wheeled planes touch down on ground gentler than 15° (rise per unit) and,
// once rolling, stay down on ground up to 30°: the land is hilly at the scale
// of the terrain's triangles, and one threshold would bounce a rolling plane
// on and off the ground
const TOUCHDOWN_SLOPE = Math.tan((15 * Math.PI) / 180);
const ROLLING_SLOPE = Math.tan((30 * Math.PI) / 180);
const _ground = {height: 0, slopeX: 0, slopeZ: 0};
const _road = {height: 0, slopeX: 0, slopeZ: 0};
let isRolling = false;
// Whether the plane is over the highway this frame, at or above its deck
// (flying under a bridge goes on by): the deck is then the ground, for
// landing and for keeping clear of it
let onRoad = false;
// How far below the deck the plane can be and still count as on it
const ROAD_CATCH_DEPTH = 2.0;
// Over an arch's rock (arches.js) this frame: its top is the ground, but not
// for landing on
let onArch = false;
const _arch = {height: 0, slopeX: 0, slopeZ: 0};
// Whether the plane was held under an arch's underside this frame
// (wall-scrape.js scrapes it)
export let underArch = false;
// Whether the throttle has been opened since settling on the water or the
// ground (see the surface drag below), and its setting last frame: every
// throttle input (keys, gamepad, the throttle slider) raises it, and only
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
// The ride height on the wheels, following the ground under them: it rises
// quickly so the wheels never sink into a bump, and falls more slowly so a dip
// is eased into rather than dropped into (seconds). It can sit this far above
// the ground under it (units) and still count as rolling
const RIDE_RISE_SECONDS = 0.06;
const RIDE_FALL_SECONDS = 0.3;
const RIDE_LAG = 3;
// The smoothed ride height while rolling, or null when not rolling
let rideHeight = null;
// Over land the plane keeps this far above the ground (units) unless it
// can land there. Leaving the wheels (rolling onto ground too steep for
// them, say) it grows back from 0 at GROUND_CUSHION_RISE units a second,
// instead of lifting the plane 5 m in one frame.
const GROUND_CUSHION = 10;
const GROUND_CUSHION_RISE = 20;
let groundCushion = GROUND_CUSHION;
// Where the plane was at the end of the last frame: a jump further than
// this (units) is a warp, or a switch from the buggy, and the wheels'
// contact with the ground it left is forgotten
const TELEPORT_DISTANCE = 100;
const _lastPosition = new THREE.Vector3(NaN, NaN, NaN);

// Speed, sinking and falling (flight-physics-logic.js, shared with
// scripts/flight-sim.js)
const smoothstep = THREE.MathUtils.smoothstep;
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

// Fills _ground with the surface under (x, z): the road deck while on the
// road, otherwise the ground as drawn
function sampleSurface(x, z) {
  if (!onRoad || !sampleRoad(x, z, _ground)) sampleGround(x, z, _ground);
}

// The plane's height resting on its wheels on _ground: on a slope the wheels
// are wheelDepth from the ground at right angles to it, further straight up
function wheelRestHeight(wheelDepth) {
  return (
    _ground.height +
    wheelDepth * Math.sqrt(1 + _ground.slopeX ** 2 + _ground.slopeZ ** 2)
  );
}

// Whether the plane is rolling on its wheels on the ground (jobs.js counts
// a landing by it)
export function isOnWheels() {
  return isRolling;
}

// The buggy (buggy.js) drives in place of this file's physics, and says
// when its wheels are down
export function setOnWheels(onWheels) {
  isRolling = onWheels;
}

export function updateFlightPhysics(delta, nowTime) {
  const handling = planeHandling();
  if (planeGroup.position.distanceTo(_lastPosition) > TELEPORT_DISTANCE) {
    isRolling = false;
    rideHeight = null;
    groundCushion = GROUND_CUSHION;
  }
  // --- FLIGHT PHYSICS & SPEED ---
  let terrainHeight = getElevation(
    planeGroup.position.x,
    planeGroup.position.z
  );
  let isWater = terrainHeight <= WATER_LEVEL + 0.1;
  onRoad =
    sampleRoad(planeGroup.position.x, planeGroup.position.z, _road) &&
    planeGroup.position.y >= _road.height - ROAD_CATCH_DEPTH;
  if (onRoad) {
    // On bridges too, over water or a valley
    terrainHeight = _road.height;
    isWater = false;
  }
  // Above an arch's underside, its top is the ground (below, it goes by)
  _arch.height = isWater ? WATER_LEVEL : terrainHeight;
  onArch = archGround(
    arches,
    planeGroup.position.x,
    planeGroup.position.z,
    planeGroup.position.y,
    _arch
  );
  if (onArch) {
    terrainHeight = _arch.height;
    isWater = false;
  }

  // Ground avoidance heights:
  // Over water, avoidance and resting heights are anchored to WATER_LEVEL (surface)
  // rather than terrainHeight (the seabed below the water).
  let minFlightHeight = isWater
    ? WATER_LEVEL + 2.8
    : terrainHeight + groundCushion;
  let restingHeight = minFlightHeight + 2.0;

  // Planes with their gear down (wheels, or the seaplane's pontoons) can
  // come down onto gentle ground and roll on it, on the ground as
  // drawn (sampleGround), or on the highway deck. Elsewhere, and with the gear up, the cushion above
  // stays, so there's no landing on a mountainside.
  const wheelDepth = state.airplaneModel?.wheelDepth;
  const retracts =
    state.airplaneModel?.gearGroups || state.airplaneModel?.pontoonGroup;
  const gearDown =
    wheelDepth !== undefined && (!retracts || state.gearExtension >= 1);
  let onLandableGround = false;
  if (!isWater && !onArch && gearDown) {
    sampleSurface(planeGroup.position.x, planeGroup.position.z);
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
  }

  // --- SPEED (THROTTLE, CLIMBS AND DIVES) ---
  // Toward the throttle's target, even at speed 0 so the vehicle can start
  // moving again. Nose down it heads for a faster speed and nose up a slower
  // one (pitchedTarget), much less while being pushed up by ground avoidance;
  // the throttle slider itself stays where it was set.
  if (
    Math.abs(state.flightSpeedMultiplier) > 0.001 ||
    Math.abs(state.targetFlightSpeed) > 0.001
  ) {
    const flying =
      !state.isFreeCamera &&
      !state.isOnGround &&
      !state.isOnWater &&
      state.flightSpeedMultiplier > 0;
    const softBuffer = 2.0;
    const target = flying
      ? pitchedTarget(
          state.targetFlightSpeed,
          planeGroup.rotation.x,
          handling,
          fallAmount,
          planeGroup.position.y < minFlightHeight + softBuffer
        )
      : state.targetFlightSpeed;
    state.flightSpeedMultiplier = throttleSpeed(
      state.flightSpeedMultiplier,
      target,
      handling,
      delta
    );
  }

  // Move vehicle
  const currentKTS =
    BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  // Rolling on the wheels sticks to the ground (downhill too) unless the nose
  // is raised to take off, and the plane is fast enough to fly
  // (canLiftOff)
  const liftingOff =
    planeGroup.rotation.x >= 0.05 &&
    canLiftOff(currentKTS, planeGroup.rotation.x, handling);
  const followingGround = isRolling && onLandableGround && !liftingOff;
  // Afloat, the water holds the plane the same way
  const heldByWater = state.isOnWater && isWater && !liftingOff;

  // Apply forward movement
  if (!state.isFreeCamera && state.flightSpeedMultiplier > 0) {
    planeGroup.translateZ(
      -(BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * delta * 60)
    );
    if (heldByWater) {
      planeGroup.position.y = Math.min(planeGroup.position.y, restingHeight);
    }
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
  fallAmount = fallAmountAt(fallAmount, airborne, currentKTS, handling, delta);
  const isAerobatic = state.isLooping || state.isDoingImmelmann;
  if (airborne && !isAerobatic) {
    state.verticalVelocity = airborneVerticalVelocity(
      state.verticalVelocity,
      fallAmount,
      currentKTS,
      handling,
      delta
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
      ? STALL_NOSE_DIP *
          (1 -
            smoothstep(
              currentKTS,
              handling.stallKts - 25,
              handling.levelKts - 30
            )) *
          (1 - fallAmount)
      : 0,
    1 - Math.exp(-delta / FLIGHT.SINK_EASE_SECONDS)
  );

  // Off the wheels, their ride height starts again from wherever they next
  // touch
  if (!followingGround) rideHeight = null;
  if (
    !state.isFreeCamera &&
    (planeGroup.position.y <= restingHeight + 0.1 || followingGround)
  ) {
    if (!state.isOnGround && !state.isOnWater && !followingGround) {
      if (
        hooks.checkDiveCrash?.(
          planeGroup.rotation.x,
          currentKTS,
          state.verticalVelocity
        )
      ) {
        return;
      }
    }
    state.isOnWater = isWater && planeGroup.position.y <= restingHeight + 0.1;
    state.isOnGround = !state.isOnWater;

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
      sampleSurface(planeGroup.position.x, planeGroup.position.z);
      const target = wheelRestHeight(wheelDepth);
      const seconds =
        target > rideHeight ? RIDE_RISE_SECONDS : RIDE_FALL_SECONDS;
      // From where the wheels touched, which can be up to RIDE_LAG above
      // the ground, so touching down doesn't drop it there in one frame
      rideHeight =
        rideHeight === null
          ? planeGroup.position.y
          : rideHeight +
            (target - rideHeight) * (1 - Math.exp(-delta / seconds));
      planeGroup.position.y = rideHeight;
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
  } else {
    state.isOnWater = false;
    state.isOnGround = false;
    if (state.airplaneModel) {
      // In-flight turbulence bobbing (increases in rain/storms)
      const t = performance.now() * 0.001;
      const stormMult = 1.0 + precipitation.rain * 2.0; // 1x calm → 3x heavy rain
      state.airplaneModel.position.y =
        (Math.sin(t * 0.7) * 0.12 + Math.sin(t * 1.3) * 0.06) * stormMult;
      // On top of the ground tilt, which levels out gently after takeoff
      levelGroundTilt(delta);
      state.airplaneModel.rotation.x =
        (Math.cos(t * 0.9) * 0.015 + Math.sin(t * 1.7) * 0.008) * stormMult +
        groundTiltPitch;
      state.airplaneModel.rotation.z =
        (Math.sin(t * 0.6) * 0.02 + Math.cos(t * 1.1) * 0.01) * stormMult +
        groundTiltRoll +
        state.waggleRoll +
        state.bumpRoll;
    }
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

  // Under an arch, its underside holds the plane down (a climb into it is
  // stopped there, scraping it)
  underArch = false;
  const ceiling = archCeiling(
    arches,
    planeGroup.position.x,
    planeGroup.position.z,
    planeGroup.position.y
  );
  if (
    ceiling !== null &&
    planeGroup.position.y > ceiling - ARCH.CEILING_MARGIN
  ) {
    planeGroup.position.y = Math.max(
      minFlightHeight,
      ceiling - ARCH.CEILING_MARGIN
    );
    state.verticalVelocity = Math.min(0, state.verticalVelocity);
    underArch = true;
  }

  const maxFlightHeight = 4045.5; // About 2,060 m on the altitude readout
  if (planeGroup.position.y > maxFlightHeight) {
    planeGroup.position.y = maxFlightHeight;
  }

  // On the wheels this frame (on the ground under where the plane is now):
  // the next frame allows steeper ground
  isRolling = false;
  if (onLandableGround) {
    sampleSurface(planeGroup.position.x, planeGroup.position.z);
    isRolling =
      planeGroup.position.y <= wheelRestHeight(wheelDepth) + 0.5 + RIDE_LAG;
  }
  groundCushion = isRolling
    ? 0
    : Math.min(GROUND_CUSHION, groundCushion + GROUND_CUSHION_RISE * delta);
  _lastPosition.copy(planeGroup.position);

  // Pontoons and retractable wheels come down approaching water (and, for
  // wheels, any ground) and go up climbing away, by height above the surface
  // (units: down within 60, about 30 m, and up past 80)
  const surfaceAlt =
    planeGroup.position.y - (isWater ? WATER_LEVEL : terrainHeight);
  if (surfaceAlt >= 80) state.gearWanted = false;

  const currentY = planeGroup.position.y;
  const isDescending = currentY < state.lastY;
  state.lastY = currentY;

  // Low and coming down, or low and slow (an approach can hold its height
  // over rising ground)
  if (
    (isWater || wheelDepth !== undefined) &&
    surfaceAlt < 60 &&
    (isDescending || currentKTS < 100)
  ) {
    state.gearWanted = true;
  }
}
