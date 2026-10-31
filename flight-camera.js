import * as THREE from 'three';
import {camera, clock, moonMesh, sunMesh} from './sky.js';
import {updateChunks} from './terrain-chunks.js';
import {getMaxFlightSpeedMult, planeGroup} from './airplane.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  animationUniforms,
  birdChunks,
  chunks,
  fireMat,
  getElevation,
  smokeMat,
  strayBirds,
  waterUniforms,
  watercraftChunks,
  whiteSmokeMat,
} from './terrain-geometry.js';
import {
  BASE_FLIGHT_SPEED,
  LIGHTHOUSE_BEAM_OPACITY_MAX,
  LIGHTHOUSE_BEAM_OPACITY_MIN,
  LIGHTHOUSE_LIGHT_INTENSITY,
  UNITS_TO_M,
  WATER_LEVEL,
  updateDOM,
} from './constants.js';
import {log} from './logger.js';
import {state} from './state.js';
import {
  _lastChunkUpdatePos,
  cameraDolly,
  currentCinematicIndex,
  keys,
} from './game-input-bindings.js';
import {
  CINEMATIC_CONFIGS,
  _boatDummy,
  _boatHash,
  _cameraAnchorMatrix,
  _cameraAnchorQuat,
  _cameraOffset,
  _cinematicLookTargetCurrent,
  _cinematicOffsetCurrent,
  _cinematicStableMatrix,
  _cinematicStableQuat,
  _currentLookTarget,
  _freeCamFwd,
  _freeCamSide,
  _idealCameraPos,
  _idealCameraPos_Cinematic,
  _idealCameraPos_FirstPerson,
  _idealCameraPos_Follow,
  _idealCameraPos_TopDown,
  _idealLookTarget,
  _idealLookTarget_Cinematic,
  _idealLookTarget_FirstPerson,
  _idealLookTarget_Follow,
  _idealLookTarget_TopDown,
  _idealUp,
  _introCameraPosStart,
  _introLookTargetStart,
  _lighthouseBeamWorldPos,
  _lookOffset,
  _pirateSailCounts,
  _up_FirstPerson,
  _up_Follow,
  _up_TopDown,
  _virtualCameraPos,
  _virtualLookTarget,
  _yAxis,
} from './game.js';
import {performanceMonitor} from './game-performance.js';
import {Achievements} from './achievements.js';
import {applyCrashCamera} from './crash.js';

// Swinging the cinematic camera around the plane with the stick: full stick
// turns this fast (radians a second), between these angles from overhead
const ORBIT_YAW_RATE = 1.6;
const ORBIT_PITCH_RATE = 0.9;
const ORBIT_MIN_PHI = 0.15;
const ORBIT_MAX_PHI = Math.PI / 2 + 0.4;
const _orbitSpherical = new THREE.Spherical();
const _orbitOffset = new THREE.Vector3();
const _orbitLook = new THREE.Vector3();
const _orbitAxis = new THREE.Vector3(0, 1, 0);

let _frameCount;
// A sunk boat's matrix: nothing drawn
const _SUNK = new THREE.Matrix4().makeScale(0, 0, 0);
// A hawk or gull flies off when the plane comes this close (units), this far
// (units), and is back circling after this long (s)
const BIRD_STARTLE_RADIUS = 90;
const BIRD_STARTLE_DISTANCE = 60;
const BIRD_STARTLE_TIME = 4;
const _birdAway = new THREE.Vector3();

// How locked the follow camera is to the plane in aerobatics, 0 to 1. Rolls
// and loops lock its turn to the plane's (lagging behind would swing the
// view or flip it past vertical), and loops its position and up too. Each
// eases in and out with a time constant of AEROBATIC_LOCK_SECONDS, so
// starting or finishing a maneuver doesn't jump the view.
const AEROBATIC_LOCK_SECONDS = 0.25;
let anchorLock = 0;
let loopLock = 0;

// Where the vehicle was last frame, so a seat view can carry the camera along
// with it (see firstPerson)
const _lastVehiclePos = new THREE.Vector3();
const _seatCarry = new THREE.Vector3();

function easeLock(lock, locked, ease) {
  const target = locked ? 1 : 0;
  const next = lock + (target - lock) * ease;
  return Math.abs(target - next) < 0.001 ? target : next;
}

export function updateFlightCamera(delta, nowTime) {
  // --- CAMERA UPDATES ---

  if (state.isFreeCamera) {
    // Free movement logic
    const moveSpeed = (keys.Shift ? 1000 : 250) * delta;
    const rotateSpeedDrag = 0.005;

    // Rotation from Drag (respecting invertYAxis)
    camera.rotation.y += state.freeCamDeltaX * rotateSpeedDrag;
    camera.rotation.x +=
      state.freeCamDeltaY * rotateSpeedDrag * (state.invertYAxis ? -1 : 1);
    camera.rotation.z = 0;

    state.freeCamDeltaX = 0;
    state.freeCamDeltaY = 0;

    // Translation
    _freeCamFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    _freeCamSide.set(1, 0, 0).applyQuaternion(camera.quaternion);

    if (keys.ArrowUp) camera.position.addScaledVector(_freeCamFwd, moveSpeed);
    if (keys.ArrowDown)
      camera.position.addScaledVector(_freeCamFwd, -moveSpeed);
    if (keys.ArrowLeft)
      camera.position.addScaledVector(_freeCamSide, -moveSpeed);
    if (keys.ArrowRight)
      camera.position.addScaledVector(_freeCamSide, moveSpeed);
    if (keys.E) camera.position.y += moveSpeed;
    if (keys.Q) camera.position.y -= moveSpeed;

    // Still update chunks based on camera position
    if (camera.position.distanceToSquared(_lastChunkUpdatePos) > 10000) {
      updateChunks();
      _lastChunkUpdatePos.copy(camera.position);
    }
  } else {
    let targetProgress = 0;
    if (state.cameraMode === 'first-person') targetProgress = 0.5;
    else if (state.cameraMode === 'birds-eye') targetProgress = 1.0;

    let speed = 0.25; // Slower transitions for all modes

    if (state.cameraTransitionProgress < targetProgress) {
      state.cameraTransitionProgress = Math.min(
        targetProgress,
        state.cameraTransitionProgress + delta * speed
      );
    } else if (state.cameraTransitionProgress > targetProgress) {
      state.cameraTransitionProgress = Math.max(
        targetProgress,
        state.cameraTransitionProgress - delta * speed
      );
    }

    // Smoothly follow the bird's eye view's pinch zoom
    const targetBirdEyeHeight =
      ChillFlightLogic.BIRDS_EYE_HEIGHT * state.cameraZoom['birds-eye'];

    state.currentBirdEyeHeight = THREE.MathUtils.lerp(
      state.currentBirdEyeHeight,
      targetBirdEyeHeight,
      1 - Math.pow(1 - 0.05, delta * 60)
    );

    // Cubic ease-in for the "swoop up" drama: t^3
    // This makes it start slow and accelerate significantly towards the top-down view.
    const easedT =
      state.cameraTransitionProgress *
      state.cameraTransitionProgress *
      state.cameraTransitionProgress;

    // Camera follow
    const isPortrait = window.innerHeight > window.innerWidth;
    const isNative =
      typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
    const mobileCameraScale = isPortrait || isNative ? 1.35 : 1.0;
    // Closer behind something small (the buggy)
    const followScale =
      mobileCameraScale * (state.airplaneModel?.cameraScale ?? 1);

    // The buggy's whole speed range widens the view and pulls the camera
    // back, so its top speed feels fast
    const speedFactor = state.airplaneModel?.cameraScale
      ? THREE.MathUtils.clamp(
          state.flightSpeedMultiplier / getMaxFlightSpeedMult(),
          0,
          1
        )
      : (state.flightSpeedMultiplier - 0.5) / 9.5;
    const diveFactor = Math.max(0, -planeGroup.rotation.x / (Math.PI / 4)); // 1.0 at 45 degree dive

    // Pinched in or out (cameraZoom)
    const followZoom = state.cameraZoom.follow;
    const zOffset =
      THREE.MathUtils.lerp(40 * followScale, 60 * followScale, speedFactor) *
      followZoom;
    // A vehicle can sit the camera higher over itself (chaseLift)
    const yOffset =
      THREE.MathUtils.lerp(12 * followScale, 20 * followScale, speedFactor) *
      (state.airplaneModel?.chaseLift ?? 1) *
      followZoom;

    // FOV expands with speed AND dive/loop steepness, capped at 70 to avoid excessive distortion
    // We use a smoothed factor to prevent "jumping" when entering loops
    // Steep climbs and dives widen it too, but leave the camera's follow alone:
    // locking it to the plane like a loop rolls the view by the whole bank (#98)
    const maneuverFactor = Math.max(
      diveFactor,
      state.isLooping || state.isSteepPitch ? 3.0 : 0
    );
    state.smoothedManeuverFactor = THREE.MathUtils.lerp(
      state.smoothedManeuverFactor,
      maneuverFactor,
      1 - Math.pow(1 - 0.05, delta * 60)
    );

    // How far the camera is into the first-person view, 0 to 1 along the
    // same eased path as the transition to it. On the way the camera sheds
    // the follow lag gradually, riding along with the vehicle, so at speed it
    // doesn't trail back behind the nose (or into the jet). In a vehicle's
    // seat (the buggy) it also stays put, with no speed zoom
    let firstPerson = 0;
    if (state.cameraMode !== 'cinematic') {
      const p = state.cameraTransitionProgress;
      const t = p <= 0.5 ? p / 0.5 : (1 - p) / 0.5;
      firstPerson = t * t * (3 - 2 * t);
    }
    const seatLock = state.airplaneModel?.firstPersonEye ? firstPerson : 0;

    // Slightly wider base FOV for mobile to increase peripheral awareness
    const baseFov =
      THREE.MathUtils.lerp(60, 85, speedFactor * (1 - seatLock)) +
      (mobileCameraScale > 1.0 ? 5 : 0);
    const targetFov = Math.min(
      75,
      baseFov +
        state.smoothedManeuverFactor *
          15 *
          Math.min(1, state.flightSpeedMultiplier / 2)
    );

    camera.fov = THREE.MathUtils.lerp(
      camera.fov,
      targetFov,
      1 - Math.pow(1 - 0.05, delta * 60)
    );
    camera.updateProjectionMatrix();

    // Pull back the camera during high-G maneuvers for extra scale
    const pullBack =
      state.smoothedManeuverFactor *
      20 *
      Math.min(1, state.flightSpeedMultiplier / 2);
    _cameraOffset.set(0, yOffset, zOffset + pullBack);

    // Add subtle camera vibration at high speeds/steep dives
    if (state.flightSpeedMultiplier > 4.0 && diveFactor > 0.5) {
      const shakeIntensity =
        (state.flightSpeedMultiplier - 4.0) * 0.05 * diveFactor;
      _cameraOffset.x += (Math.random() - 0.5) * shakeIntensity;
      _cameraOffset.y += (Math.random() - 0.5) * shakeIntensity;
    }

    // A jolt when knocking a tree or house over (breakables.js)
    if (state.impactShake > 0) {
      const jolt = state.impactShake;
      _cameraOffset.x += (Math.random() - 0.5) * jolt;
      _cameraOffset.y += (Math.random() - 0.5) * jolt;
      state.impactShake = Math.max(0, jolt - delta * (2 + jolt * 3));
    }

    // 1. Calculate Follow State

    // Smooth the plane's rotation to create camera inertia, locked to it in
    // acrobatic loops and rolls so the camera doesn't get lost
    const lockEase = 1 - Math.exp(-delta / AEROBATIC_LOCK_SECONDS);
    anchorLock = easeLock(
      anchorLock,
      state.isLooping || state.isBarrelRolling,
      lockEase
    );
    loopLock = easeLock(loopLock, state.isLooping, lockEase);
    _cameraAnchorQuat.slerp(
      planeGroup.quaternion,
      THREE.MathUtils.lerp(1 - Math.pow(1 - 0.15, delta * 60), 1, anchorLock)
    );

    _cameraAnchorMatrix.makeRotationFromQuaternion(_cameraAnchorQuat);
    _cameraAnchorMatrix.setPosition(planeGroup.position);

    _idealCameraPos_Follow
      .copy(_cameraOffset)
      .applyMatrix4(_cameraAnchorMatrix);

    // Planes sit in the middle of the view. A car sits low (chaseFrame, the
    // way from the middle to the bottom edge), with more road ahead in view
    const chaseFrame = state.airplaneModel?.chaseFrame;
    if (chaseFrame) {
      const back = zOffset + pullBack;
      const below = Math.atan2(yOffset, back);
      const tilt = Math.atan(
        chaseFrame * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      );
      _lookOffset.set(
        0,
        yOffset - 100 * Math.sin(below - tilt),
        back - 100 * Math.cos(below - tilt)
      );
    } else {
      _lookOffset.set(0, 0, -20);
    }
    _idealLookTarget_Follow.copy(_lookOffset).applyMatrix4(_cameraAnchorMatrix);

    // World up, or the plane's up in a loop (so the view doesn't flip as
    // the nose passes vertical)
    _up_Follow
      .set(0, 1, 0)
      .applyQuaternion(_cameraAnchorQuat)
      .multiplyScalar(loopLock);
    _up_Follow.y += 1 - loopLock;
    if (_up_Follow.lengthSq() < 1e-6) _up_Follow.set(0, 1, 0);
    _up_Follow.normalize();

    // 1.5 Calculate First Person State
    // From the driver's seat where the vehicle has one (the buggy, tilting
    // with it over the ground), otherwise out ahead of the nose
    const eye = state.airplaneModel?.firstPersonEye;
    if (eye) {
      const seat = state.airplaneModel.matrixWorld;
      _idealCameraPos_FirstPerson.copy(eye).applyMatrix4(seat);
      _idealLookTarget_FirstPerson
        .set(eye.x, eye.y - 1.5, eye.z - 30)
        .applyMatrix4(seat);
      _up_FirstPerson.set(0, 1, 0).transformDirection(seat);
    } else {
      _idealCameraPos_FirstPerson
        .set(0, 1.0, -50)
        .applyMatrix4(planeGroup.matrixWorld);
      _idealLookTarget_FirstPerson
        .set(0, 1.0, -70)
        .applyMatrix4(planeGroup.matrixWorld);
      _up_FirstPerson.set(0, 1, 0).applyQuaternion(planeGroup.quaternion);
    }

    // 2. Calculate Top-Down State
    _idealCameraPos_TopDown.set(
      planeGroup.position.x,
      planeGroup.position.y + state.currentBirdEyeHeight,
      planeGroup.position.z
    );
    _idealLookTarget_TopDown.copy(planeGroup.position);
    _up_TopDown.set(0, 0, -1); // North is UP

    // 3. Calculate Cinematic State
    const cinematicConfig =
      CINEMATIC_CONFIGS[currentCinematicIndex] || CINEMATIC_CONFIGS[0];
    if (state._cinematicStableHeading === null) {
      state._cinematicStableHeading = planeGroup.rotation.y;
    }
    if (state.cameraMode === 'cinematic') {
      // Smoothen the switches between cinematic offsets
      const hasOffsetJumped =
        _cinematicOffsetCurrent.distanceToSquared(cinematicConfig.offset) >
        0.001;
      if (hasOffsetJumped) {
        _cinematicOffsetCurrent.lerp(cinematicConfig.offset, 0.02 * delta * 60);
        _cinematicLookTargetCurrent.lerp(
          cinematicConfig.lookOffset,
          0.02 * delta * 60
        );
      }

      // Optimize: Only recalculate matrix if plane has moved or rotated, or if offset is still transitioning
      const rotationChanged =
        Math.abs(state._cinematicStableHeading - planeGroup.rotation.y) >
        0.0001;
      // Check position change without expensive extra calculations
      const positionChanged =
        Math.abs(_cinematicStableMatrix.elements[12] - planeGroup.position.x) >
          0.1 ||
        Math.abs(_cinematicStableMatrix.elements[13] - planeGroup.position.y) >
          0.1 ||
        Math.abs(_cinematicStableMatrix.elements[14] - planeGroup.position.z) >
          0.1;

      if (rotationChanged || positionChanged || hasOffsetJumped) {
        state._cinematicStableHeading = ChillFlightLogic.lerpAngle(
          state._cinematicStableHeading,
          planeGroup.rotation.y,
          0.05 * delta * 60
        );
        _cinematicStableQuat.setFromAxisAngle(
          _yAxis,
          state._cinematicStableHeading
        );
        _cinematicStableMatrix.makeRotationFromQuaternion(_cinematicStableQuat);
        _cinematicStableMatrix.setPosition(planeGroup.position);
      }
    } else {
      // Keep heading in sync while not in cinematic mode for smooth entry
      state._cinematicStableHeading = planeGroup.rotation.y;
    }

    // Swung around the plane by the stick (game-loop.js), from the preset
    if (state.cameraMode === 'cinematic') {
      state.cinematicOrbitYaw += state.cinematicSteerX * ORBIT_YAW_RATE * delta;
      state.cinematicOrbitPitch +=
        state.cinematicSteerY * ORBIT_PITCH_RATE * delta;
    }
    _orbitSpherical.setFromVector3(_cinematicOffsetCurrent);
    // Kept between nearly overhead and a little below the plane
    state.cinematicOrbitPitch = THREE.MathUtils.clamp(
      state.cinematicOrbitPitch,
      _orbitSpherical.phi - ORBIT_MAX_PHI,
      _orbitSpherical.phi - ORBIT_MIN_PHI
    );
    _orbitSpherical.theta += state.cinematicOrbitYaw;
    _orbitSpherical.phi -= state.cinematicOrbitPitch;
    _orbitSpherical.radius *= state.cameraZoom.cinematic;
    _orbitOffset.setFromSpherical(_orbitSpherical);
    _orbitLook
      .copy(_cinematicLookTargetCurrent)
      .applyAxisAngle(_orbitAxis, state.cinematicOrbitYaw);
    _idealCameraPos_Cinematic
      .copy(_orbitOffset)
      .applyMatrix4(_cinematicStableMatrix);
    _idealLookTarget_Cinematic
      .copy(_orbitLook)
      .applyMatrix4(_cinematicStableMatrix);

    // 4. Blend FOV
    // Follow mode has dynamic FOV, Top-down is fixed at 60, Cinematic is per-config
    const followFov = targetFov;
    const topDownFov = 60;
    const cinematicFov = cinematicConfig.fov;

    let targetBlendedFov;
    if (state.cameraMode === 'cinematic') {
      targetBlendedFov = THREE.MathUtils.lerp(followFov, cinematicFov, 1.0); // Simple snap for FOV in cinematic
    } else {
      targetBlendedFov = THREE.MathUtils.lerp(followFov, topDownFov, easedT);
    }

    camera.fov = THREE.MathUtils.lerp(
      camera.fov,
      targetBlendedFov,
      1 - Math.pow(1 - 0.1, delta * 60)
    );
    camera.updateProjectionMatrix();

    // 5. Blend Positions & Targets
    if (state.cameraMode === 'cinematic') {
      _idealCameraPos.copy(_idealCameraPos_Cinematic);
      _idealLookTarget.copy(_idealLookTarget_Cinematic);
      _idealUp.set(0, 1, 0); // Always world-up for cinematic
    } else {
      const p = state.cameraTransitionProgress;
      if (p < 0.5) {
        const t = p / 0.5;
        const easedSegT = t * t * (3 - 2 * t); // smoothstep
        _idealCameraPos.lerpVectors(
          _idealCameraPos_Follow,
          _idealCameraPos_FirstPerson,
          easedSegT
        );
        _idealLookTarget.lerpVectors(
          _idealLookTarget_Follow,
          _idealLookTarget_FirstPerson,
          easedSegT
        );
        _idealUp.lerpVectors(_up_Follow, _up_FirstPerson, easedSegT);
      } else {
        const t = (p - 0.5) / 0.5;
        const easedSegT = t * t * (3 - 2 * t); // smoothstep
        _idealCameraPos.lerpVectors(
          _idealCameraPos_FirstPerson,
          _idealCameraPos_TopDown,
          easedSegT
        );
        _idealLookTarget.lerpVectors(
          _idealLookTarget_FirstPerson,
          _idealLookTarget_TopDown,
          easedSegT
        );
        _idealUp.lerpVectors(_up_FirstPerson, _up_TopDown, easedSegT);
      }
    }

    // Camera collision avoidance with terrain & water surface
    const idealTerrainHeight = getElevation(
      _idealCameraPos.x,
      _idealCameraPos.z
    );
    const minCamSurface = Math.max(WATER_LEVEL, idealTerrainHeight);
    if (_idealCameraPos.y < minCamSurface + 2.0) {
      _idealCameraPos.y = minCamSurface + 2.0;
    }

    // Apply smooth tracking to the results
    // We use smoothedDelta and a higher lerp factor for a more "locked-in" feel.
    if (
      applyCrashCamera(
        state.isVRPresenting ? cameraDolly : camera,
        _currentLookTarget,
        _idealCameraPos,
        _idealLookTarget
      )
    ) {
      const activeCamTarget = state.isVRPresenting ? cameraDolly : camera;
      _virtualCameraPos.copy(activeCamTarget.position);
      _virtualLookTarget.copy(_currentLookTarget);
      _idealUp.set(0, 1, 0);
    } else if (state.isIntroTransitionActive) {
      // Update the virtual tracking camera (steady state lag)
      _virtualCameraPos.lerp(
        _idealCameraPos,
        1 - Math.pow(1 - 0.25, delta * 60)
      );
      _virtualLookTarget.lerp(
        _idealLookTarget,
        1 - Math.pow(1 - 0.25, delta * 60)
      );

      const progress = (nowTime - state.introTransitionStartTime) / 1250;
      if (progress < 1) {
        // Ease In Out Cubic
        const easedProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const activeCamTarget = state.isVRPresenting ? cameraDolly : camera;

        // Interpolate visual camera between start and virtual tracking camera
        _currentLookTarget.lerpVectors(
          _introLookTargetStart,
          _virtualLookTarget,
          easedProgress
        );
        activeCamTarget.position.lerpVectors(
          _introCameraPosStart,
          _virtualCameraPos,
          easedProgress
        );
      } else {
        state.isIntroTransitionActive = false;
        const activeCamTarget = state.isVRPresenting ? cameraDolly : camera;
        activeCamTarget.position.copy(_virtualCameraPos);
        _currentLookTarget.copy(_virtualLookTarget);
      }
    } else {
      const activeCamTarget = state.isVRPresenting ? cameraDolly : camera;
      // Into first person the camera rides along with the vehicle, so it
      // doesn't trail behind it by the follow lag
      _seatCarry
        .subVectors(planeGroup.position, _lastVehiclePos)
        .multiplyScalar(firstPerson);
      activeCamTarget.position.add(_seatCarry);
      _currentLookTarget.add(_seatCarry);
      // In loops the position locks on, as inertia lag could flip lookAt,
      // and in a seat view it stays fixed to the seat
      const follow = THREE.MathUtils.lerp(
        1 - Math.pow(1 - 0.25, delta * 60),
        1,
        Math.max(loopLock, seatLock)
      );
      activeCamTarget.position.lerp(_idealCameraPos, follow);
      _currentLookTarget.lerp(_idealLookTarget, follow);
    }

    _lastVehiclePos.copy(planeGroup.position);

    const activeCamTarget = state.isVRPresenting ? cameraDolly : camera;

    // Hard clamp to prevent dipping below terrain during fast movement
    const actualTerrainHeight = getElevation(
      activeCamTarget.position.x,
      activeCamTarget.position.z
    );
    if (activeCamTarget.position.y < actualTerrainHeight + 1.0) {
      activeCamTarget.position.y = actualTerrainHeight + 1.0;
    }

    if (state.isVRPresenting && loopLock === 0) {
      activeCamTarget.up.set(0, 1, 0); // Keep world up stable in VR during normal flight
    } else {
      // During vertical loops, up vector must match the inverted plane to prevent gimbal lock at 90°
      activeCamTarget.up
        .lerp(
          _idealUp,
          THREE.MathUtils.lerp(1 - Math.pow(1 - 0.1, delta * 60), 1, loopLock)
        )
        .normalize();
    }

    activeCamTarget.lookAt(_currentLookTarget);

    // Update terrain chunks (only if the plane has moved ~50 units)
    if (planeGroup.position.distanceToSquared(_lastChunkUpdatePos) > 2500) {
      updateChunks();
      _lastChunkUpdatePos.copy(planeGroup.position);
    }
  }

  // Celestial positions
  const sunOrbitRadius = 8000;
  const moonOrbitRadius = 7500; // Moon is closer so it renders in front of sun during overlaps

  // 1. Realistic Sun Path
  const latitude = state.currentLatRad;
  const declination = 0.409; // Summer tilt
  const hourAngle = state.timeOfDay + Math.PI;

  state.sunY =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  state.sunX = -Math.cos(declination) * Math.sin(hourAngle);
  state.sunZ =
    Math.cos(latitude) * Math.sin(declination) -
    Math.sin(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  // Spread dayFactor over a wider sun angle so sunrise/sunset lighting builds up gradually,
  // drawing out the visual transition rather than hitting full intensity right at 6:00 AM.
  // We must ensure the offset (-0.5) is deeper than dawnDuskFactor's fadeout (-0.4) to prevent abrupt clipping!
  state.dayFactor = Math.max(0, Math.min(1, (state.sunY + 0.5) / 0.8)); // 0.0 at SunY=-0.5 (4 AM), 1.0 at SunY=0.3 (~7:15 AM)
  // The direct sunlight (and its shadows) only while the sun is at the
  // horizon or above it, unlike the sky glow dayFactor builds up before dawn
  state.sunLightFactor = THREE.MathUtils.smoothstep(state.sunY, -0.02, 0.08);

  // Shadows are culled while the sun is down
  performanceMonitor.updateSunLight(state.sunLightFactor);

  // 2. Fixed Moon Position (West-Southwest Sky near Horizon)

  // Set WSW fixed position (approx. -126 degrees azimuth)
  const baseMoonAngle = -2.2;
  // Low elevation (~10 degrees above the horizon)
  const baseMoonElev = 0.18;

  // Slow lunar wobble: drifts slightly over time so it feels alive
  const moonWobbleSpeed = state.worldClockNow * 0.00005;
  const moonWobbleX = Math.sin(moonWobbleSpeed) * 0.03;
  const moonWobbleY = Math.cos(moonWobbleSpeed) * 0.015;

  state.moonY = Math.sin(baseMoonElev + moonWobbleY);
  state.moonX =
    Math.cos(baseMoonAngle + moonWobbleX) *
    Math.cos(baseMoonElev + moonWobbleY);
  state.moonZ =
    Math.sin(baseMoonAngle + moonWobbleX) *
    Math.cos(baseMoonElev + moonWobbleY);

  // Update water shader uniform — the GPU handles all wave displacement
  waterUniforms.uTime.value = nowTime * 0.0015;

  // Update global animation time for GPU-offloaded objects
  animationUniforms.uTime.value = performance.now() * 0.001;

  // Update global opacity materials outside of chunk loop

  fireMat.emissiveIntensity = 2.0 * (1.0 - state.dayFactor * 0.8);

  smokeMat.opacity = 0.4 * (1.0 - state.dayFactor * 0.5);

  whiteSmokeMat.opacity = 0.6 - state.dayFactor * 0.3;

  // Animate Birds
  const activeBirds = birdChunks;
  // Geese hide past the prop draw distance like the houses below them (each
  // is 9 meshes, and a dot that far off)
  const gooseDrawDistSq = performanceMonitor.getEffectiveLOD() ** 2;
  activeBirds.forEach((chunkGroup) => {
    // Optimization: Distance culling (6000 units) for the hawks and seagulls
    // circling a distant chunk. Geese always animate: a flock flies far from
    // its chunk (or has outlived it, in strayBirds) and can still be in view
    const checkPos = chunkGroup.userData.worldPosition || chunkGroup.position;
    const chunkIsFar =
      chunkGroup !== strayBirds &&
      checkPos.distanceToSquared(camera.position) > 36000000;

    if (chunkGroup.userData.birds) {
      chunkGroup.userData.birds.forEach((bird) => {
        if (chunkIsFar && bird.userData.type !== 'goose') return;
        bird.visible = state.dayFactor > 0.1;
        if (!bird.visible) return;
        // Still animated, so the flock is where it should be when it shows
        if (bird.userData.type === 'goose')
          bird.visible =
            bird.position.distanceToSquared(camera.position) < gooseDrawDistSq;

        const data = bird.userData;
        const flapSpeed = data.flapSpeed || 2;
        const flapPhase = data.flapPhase || 0;
        const flapDuration = data.flapDuration || 4.0;
        const soarDuration = data.soarDuration || 6.0;

        const totalCycle = flapDuration + soarDuration;
        const cycleProgress =
          (clock.getElapsed() + flapPhase * 10) % totalCycle;
        const isSoaring = cycleProgress > flapDuration;

        let flap = 0;
        if (!isSoaring) {
          let amplitude = 0.5;
          const transitionTime = 0.5; // 0.5s smooth fade envelope
          if (cycleProgress < transitionTime) {
            amplitude *= cycleProgress / transitionTime;
          } else if (flapDuration - cycleProgress < transitionTime) {
            amplitude *= (flapDuration - cycleProgress) / transitionTime;
          }
          flap =
            Math.sin(clock.getElapsed() * flapSpeed + flapPhase) * amplitude;
        }
        // A hawk or gull the plane comes close to flaps off out of its way
        // and drifts back to its circle (startle: {t, dir}, the way it goes)
        const startle = data.startle;
        if (startle) {
          startle.t += delta;
          flap = Math.sin(startle.t * 22) * 0.8;
          if (startle.t > BIRD_STARTLE_TIME) data.startle = null;
        }
        if (data.wings) {
          data.wings[0].rotation.z = flap;
          data.wings[1].rotation.z = flap;
        }
        bird.translateZ(-(data.speed * delta * 50));

        if (data.type === 'hawk' || data.type === 'seagull') {
          data.angle += data.circleSpeed * delta;
          const targetX =
            data.circleCenter.x + Math.cos(data.angle) * data.circleRadius;
          const targetZ =
            data.circleCenter.z + Math.sin(data.angle) * data.circleRadius;

          // Back where it would be without last frame's startle
          if (data.startleOffset) {
            bird.position.sub(data.startleOffset);
            data.startleOffset = null;
          }
          let targetY = bird.position.y;
          let tiltZ = 0.3; // Bank angle for circling
          let tiltX = 0; // Pitch angle

          // Seagull diving logic
          if (data.type === 'seagull') {
            if (data.isDiving) {
              data.diveTimer += delta;
              const diveProgress = data.diveTimer / data.diveDuration;
              if (diveProgress > 1.0) {
                data.isDiving = false;
                data.diveTimer = 0;
              } else {
                // Parabolic dive towards WATER_LEVEL
                const baseHeight = data.circleCenter.y;
                // We want to dive down to water level and back up
                const diveDepth = baseHeight - WATER_LEVEL - 5;
                // sine wave from 0 to PI makes a parabola-like curve
                const diveOffset = Math.sin(diveProgress * Math.PI) * diveDepth;
                targetY = baseHeight - diveOffset;

                // Pitch down then up
                tiltX = Math.sin(diveProgress * Math.PI * 2) * -0.8;
                tiltZ = 0; // Stop banking while diving
              }
            } else {
              data.diveTimer += delta;
              if (data.diveTimer > data.nextDiveWait) {
                data.isDiving = true;
                data.diveTimer = 0;
                data.diveDuration = 3.0 + Math.random() * 2.0;
                data.nextDiveWait = 10.0 + Math.random() * 20.0;
              }
            }
          }

          bird.lookAt(
            data.circleCenter.x +
              Math.cos(data.angle - 0.1) * data.circleRadius,
            data.type === 'seagull' && data.isDiving
              ? targetY
              : bird.position.y,
            data.circleCenter.z + Math.sin(data.angle - 0.1) * data.circleRadius
          );

          bird.rotation.z = tiltZ;
          bird.rotation.x += tiltX;

          bird.position.set(targetX, targetY, targetZ);
          if (!data.startle && !state.isFreeCamera) {
            _birdAway.subVectors(bird.position, planeGroup.position);
            if (_birdAway.lengthSq() < BIRD_STARTLE_RADIUS ** 2) {
              _birdAway.normalize();
              _birdAway.y = Math.max(0.3, _birdAway.y + 0.4);
              data.startle = {t: 0, dir: _birdAway.clone().normalize()};
            }
          }
          if (data.startle) {
            // Out fast, back slowly
            const t = data.startle.t;
            const out =
              t < 0.6
                ? Math.sin((t / 0.6) * Math.PI * 0.5)
                : 1 - THREE.MathUtils.smoothstep(t, 0.6, BIRD_STARTLE_TIME);
            data.startleOffset = data.startle.dir
              .clone()
              .multiplyScalar(out * BIRD_STARTLE_DISTANCE);
            bird.position.add(data.startleOffset);
          }
        } else if (data.type === 'goose') {
          // Prevent geese from flying into the volcano or terrain
          const groundY = getElevation(bird.position.x, bird.position.z);
          const minClearance = 250;
          if (bird.position.y < groundY + minClearance) {
            bird.position.y +=
              (groundY + minClearance - bird.position.y) * 3.0 * delta;
          }
        }

        // Collide check (goose trigger)
        if (data.type === 'goose' && !state.isFreeCamera) {
          const distToPlaneSq = bird.position.distanceToSquared(
            planeGroup.position
          );
          if (distToPlaneSq < 625) {
            Achievements.unlock('geese_police');
          }
        }
      });
    }
  });

  // Stray geese (their chunk has unloaded) go once they're 15000 units away,
  // where a goose is under a pixel (chunks unload nearer, at about 9000 units
  // on ultra, where a flock still shows as a V of dots)
  const strays = strayBirds.userData.birds;
  for (let i = strays.length - 1; i >= 0; i--) {
    if (strays[i].position.distanceToSquared(camera.position) > 225000000) {
      strayBirds.remove(strays[i]);
      strays.splice(i, 1);
    }
  }

  // Animate Lighthouse Beam directly if active chunk is present
  if (chunks.has('5,2')) {
    const chunkGroup = chunks.get('5,2');
    if (chunkGroup && chunkGroup.userData.lighthouseBeam) {
      const beam = chunkGroup.userData.lighthouseBeam;
      beam.rotation.y += delta * 0.15; // Slower sweep

      // Fade on after sunset and fade off before sunrise using dayFactor
      const fadeFactor = 1.0 - state.dayFactor;
      beam.visible = fadeFactor > 0;

      if (beam.visible) {
        const baseOpacity =
          LIGHTHOUSE_BEAM_OPACITY_MIN +
          (Math.sin(performance.now() * 0.002) * 0.5 + 0.5) *
            (LIGHTHOUSE_BEAM_OPACITY_MAX - LIGHTHOUSE_BEAM_OPACITY_MIN);
        beam.material.opacity = baseOpacity * fadeFactor;
      }

      // Check for gatsby achievement (Lighthouse flyby)
      if (!state.isFreeCamera) {
        beam.getWorldPosition(_lighthouseBeamWorldPos);
        const distSq = planeGroup.position.distanceToSquared(
          _lighthouseBeamWorldPos
        );
        if (distSq < 22500) {
          Achievements.unlock('gatsby');
          log.info(
            `[Lighthouse flyby] Position: X = ${_lighthouseBeamWorldPos.x.toFixed(1)}, Z = ${_lighthouseBeamWorldPos.z.toFixed(1)} (${(_lighthouseBeamWorldPos.x / 5000).toFixed(2)} ${_lighthouseBeamWorldPos.x >= 0 ? 'East' : 'West'}, ${(-_lighthouseBeamWorldPos.z / 5000).toFixed(2)} ${_lighthouseBeamWorldPos.z <= 0 ? 'North' : 'South'})`
          );
        }
      }

      // Rotate functional light target
      if (
        chunkGroup.userData.lighthouseTarget &&
        chunkGroup.userData.lighthouseLight
      ) {
        const target = chunkGroup.userData.lighthouseTarget;
        const light = chunkGroup.userData.lighthouseLight;

        if (beam.visible) {
          // Align target perfectly with the beam's Z-axis trajectory
          const distance = 600; // Doubled distance for scaled lighthouse
          target.position.set(
            light.position.x + Math.sin(beam.rotation.y) * distance,
            light.position.y - Math.sin(beam.rotation.x) * distance, // Account for downward tilt
            light.position.z + Math.cos(beam.rotation.y) * distance
          );
          light.intensity = LIGHTHOUSE_LIGHT_INTENSITY * fadeFactor;
        } else {
          light.intensity = 0;
        }
      }
    }
  }

  // Animate Watercraft (Sailboats & Pirate Ships)
  // Performance optimization:
  // 1. Only iterate watercraftChunks (chunks containing boats) rather than all loaded chunks.
  // 2. Beyond 1,500 units, boats stagger GPU buffer attribute updates to once
  //    every 30 frames to drastically reduce PCIe bus traffic while preventing visual snapping.
  // 3. When time speed is paused (daySpeedMultiplier === 0), freeze updates once initialized.
  const activeWatercraft = watercraftChunks;

  const isTimePaused =
    typeof state.daySpeedMultiplier !== 'undefined' &&
    state.daySpeedMultiplier === 0;

  if (typeof _frameCount === 'undefined') _frameCount = 0;
  _frameCount++;

  activeWatercraft.forEach((chunkGroup) => {
    if (isTimePaused && chunkGroup.userData.boatsInitialized) return;
    chunkGroup.userData.boatsInitialized = true;

    const checkPos = chunkGroup.userData.worldPosition || chunkGroup.position;
    const distSq = checkPos.distanceToSquared(camera.position);

    // Completely cull animation updates beyond 6000 units
    if (distSq > 36000000) return;

    // Throttle GPU updates for distant boats (between 2000 and 6000 units)
    if (distSq > 4000000) {
      const chunkHash =
        Math.abs(chunkGroup.userData.chunkX + chunkGroup.userData.chunkZ) || 0;
      if ((_frameCount + chunkHash) % 30 !== 0) {
        return;
      }
    }

    // Animate Sailboats (Drifting & Bobbing)
    if (
      chunkGroup.userData.boatHulls &&
      chunkGroup.userData.sailboatPositions
    ) {
      const hulls = chunkGroup.userData.boatHulls;
      const masts = chunkGroup.userData.boatMasts;
      const sails = chunkGroup.userData.boatSails;
      const rims = chunkGroup.userData.boatRims;
      const decks = chunkGroup.userData.boatDecks;
      const booms = chunkGroup.userData.boatBooms;
      const positions = chunkGroup.userData.sailboatPositions;

      positions.forEach((pos, index) => {
        const driftPhase = _boatHash(index, 1) * Math.PI * 2;
        const driftSpeed = 0.03 + _boatHash(index, 2) * 0.04; // Extremely slow drifting
        const doesDrift = _boatHash(index, 3) < 0.8; // 80% drift, 20% completely anchored in place
        const isAnchored = doesDrift && _boatHash(index, 4) < 0.6; // 60% of drifting ones are on a tight anchor, 40% are loose

        let driftRadius = 0;
        if (doesDrift) {
          driftRadius = isAnchored
            ? 4 + _boatHash(index, 5) * 4
            : 15 + _boatHash(index, 5) * 15;
        }

        let dx = 0;
        let dz = 0;
        let yawOffset = Math.sin(clock.getElapsed() * 0.4 + driftPhase) * 0.05; // Gentle sway

        if (driftRadius > 0) {
          const t = clock.getElapsed() * driftSpeed + driftPhase;
          dx = Math.sin(t * 1.6) * driftRadius;
          dz = Math.cos(t * 1.0) * driftRadius;

          // Tangent of the slow drift Lissajous trajectory for orientation heading
          const tx = 1.6 * Math.cos(t * 1.6) * driftRadius;
          const tz = -1.0 * Math.sin(t * 1.0) * driftRadius;

          // Compute angle of movement
          const tangentYaw = Math.atan2(tx, tz);
          yawOffset += tangentYaw;
        }

        // Where it is now, for its wake (particles.js)
        pos.worldX = checkPos.x + pos.x + dx;
        pos.worldZ = checkPos.z + pos.z + dz;

        // Bobbing & Wave dynamics (Roll/Pitch)
        const bobTime = clock.getElapsed() * 1.2 + driftPhase;
        const dy = Math.sin(bobTime) * 0.15;
        const roll = Math.sin(bobTime * 0.8) * 0.04;
        const pitch = Math.cos(bobTime * 1.1) * 0.03;

        _boatDummy.position.set(pos.x + dx, pos.y + dy, pos.z + dz);
        _boatDummy.rotation.set(0, 0, 0);
        _boatDummy.rotation.y = pos.rotY + yawOffset;
        _boatDummy.rotation.x = pitch;
        _boatDummy.rotation.z = roll;
        _boatDummy.scale.set(1.8, 1.8, 1.8);
        _boatDummy.updateMatrix();
        // Sunk (breakables.js): drawn no more
        if (pos.sunk) _boatDummy.matrix.copy(_SUNK);

        if (Array.isArray(hulls)) {
          const colorIdx = chunkGroup.userData.boatColorIndices[index];
          const instIdx = chunkGroup.userData.boatInstIndices[index];
          hulls[colorIdx].setMatrixAt(instIdx, _boatDummy.matrix);
        } else {
          hulls.setMatrixAt(index, _boatDummy.matrix);
        }

        masts.setMatrixAt(index, _boatDummy.matrix);
        sails.setMatrixAt(index, _boatDummy.matrix);
        if (rims) rims.setMatrixAt(index, _boatDummy.matrix);
        if (decks) decks.setMatrixAt(index, _boatDummy.matrix);
        if (booms) booms.setMatrixAt(index, _boatDummy.matrix);

        if (chunkGroup.userData.boatReflections) {
          _boatDummy.position.set(pos.x + dx, pos.y - dy, pos.z + dz);
          _boatDummy.rotation.set(0, 0, 0);
          _boatDummy.rotation.y = pos.rotY + yawOffset;
          _boatDummy.rotation.x = -pitch;
          _boatDummy.rotation.z = -roll;
          _boatDummy.scale.set(1.8, -1.8, 1.8);
          _boatDummy.updateMatrix();
          if (pos.sunk) _boatDummy.matrix.copy(_SUNK);
          chunkGroup.userData.boatReflections.setMatrixAt(
            index,
            _boatDummy.matrix
          );
        }
      });

      if (Array.isArray(hulls)) {
        hulls.forEach((h) => {
          if (h) h.instanceMatrix.needsUpdate = true;
        });
      } else {
        hulls.instanceMatrix.needsUpdate = true;
      }

      masts.instanceMatrix.needsUpdate = true;
      sails.instanceMatrix.needsUpdate = true;
      if (rims) rims.instanceMatrix.needsUpdate = true;
      if (decks) decks.instanceMatrix.needsUpdate = true;
      if (booms) booms.instanceMatrix.needsUpdate = true;
      if (chunkGroup.userData.boatReflections) {
        chunkGroup.userData.boatReflections.instanceMatrix.needsUpdate = true;
      }
    }

    // Animate Pirate Ships (Patrolling & Bobbing)
    if (
      chunkGroup.userData.pirateHulls &&
      chunkGroup.userData.pirateShipPositions
    ) {
      const hulls = chunkGroup.userData.pirateHulls;
      const rims = chunkGroup.userData.pirateRims;
      const decks = chunkGroup.userData.pirateDecks;
      const masts = chunkGroup.userData.pirateMasts;
      const flags = chunkGroup.userData.pirateFlags;
      const jollyRogers = chunkGroup.userData.pirateJollyRogers;
      const sailInsts = chunkGroup.userData.pirateSails;
      const positions = chunkGroup.userData.pirateShipPositions;

      const sailCounts = _pirateSailCounts.fill(0);

      positions.forEach((pos, index) => {
        const patrolRadius = 40 + _boatHash(index, 7) * 30;
        const patrolSpeed = 0.05 + _boatHash(index, 8) * 0.03;
        const patrolPhase = _boatHash(index, 9) * Math.PI * 2;

        const t = clock.getElapsed() * patrolSpeed + patrolPhase;
        const dx = Math.cos(t) * patrolRadius;
        const dz = Math.sin(t) * patrolRadius;

        const tangentYaw = Math.atan2(-Math.sin(t), Math.cos(t));
        pos.worldX = checkPos.x + pos.x + dx;
        pos.worldZ = checkPos.z + pos.z + dz;

        // Bobbing & Wave dynamics (Roll/Pitch)
        const bobTime = clock.getElapsed() * 0.8 + patrolPhase;
        const dy = Math.sin(bobTime) * 0.25;
        const roll = Math.sin(bobTime * 0.7) * 0.03;
        const pitch = Math.cos(bobTime * 0.9) * 0.02;

        _boatDummy.position.set(pos.x + dx, pos.y + dy, pos.z + dz);
        _boatDummy.rotation.set(0, 0, 0);
        _boatDummy.rotation.y = tangentYaw + Math.PI;
        _boatDummy.rotation.x = pitch;
        _boatDummy.rotation.z = roll;
        _boatDummy.scale.set(2.5, 2.5, 2.5);
        _boatDummy.updateMatrix();
        // Sunk (breakables.js): drawn no more
        if (pos.sunk) _boatDummy.matrix.copy(_SUNK);

        const colorIdx = pos.bodyId;
        const instIdx = sailCounts[colorIdx]++;
        sailInsts[colorIdx].setMatrixAt(instIdx, _boatDummy.matrix);

        hulls.setMatrixAt(index, _boatDummy.matrix);
        rims.setMatrixAt(index, _boatDummy.matrix);
        decks.setMatrixAt(index, _boatDummy.matrix);
        masts.setMatrixAt(index, _boatDummy.matrix);
        flags.setMatrixAt(index, _boatDummy.matrix);
        jollyRogers.setMatrixAt(index, _boatDummy.matrix);

        if (chunkGroup.userData.pirateReflections) {
          _boatDummy.position.set(pos.x + dx, pos.y - dy, pos.z + dz);
          _boatDummy.rotation.set(0, 0, 0);
          _boatDummy.rotation.y = tangentYaw + Math.PI;
          _boatDummy.rotation.x = -pitch;
          _boatDummy.rotation.z = -roll;
          _boatDummy.scale.set(2.5, -2.5, 2.5);
          _boatDummy.updateMatrix();
          if (pos.sunk) _boatDummy.matrix.copy(_SUNK);
          chunkGroup.userData.pirateReflections.setMatrixAt(
            index,
            _boatDummy.matrix
          );
        }
      });

      hulls.instanceMatrix.needsUpdate = true;
      rims.instanceMatrix.needsUpdate = true;
      decks.instanceMatrix.needsUpdate = true;
      masts.instanceMatrix.needsUpdate = true;
      flags.instanceMatrix.needsUpdate = true;
      jollyRogers.instanceMatrix.needsUpdate = true;
      sailInsts.forEach((inst) => {
        if (inst) inst.instanceMatrix.needsUpdate = true;
      });
      if (chunkGroup.userData.pirateReflections) {
        chunkGroup.userData.pirateReflections.instanceMatrix.needsUpdate = true;
      }
    }
  });

  // Update Cockpit HUD
  const hudTarget = state.isFreeCamera ? camera : planeGroup;
  const hudHeadingY = state.isFreeCamera
    ? camera.rotation.y
    : planeGroup.rotation.y;

  const hours = (state.timeOfDay / (Math.PI * 2)) * 24;
  const hh = Math.floor(hours).toString().padStart(2, '0');
  const mm = Math.floor((hours % 1) * 60)
    .toString()
    .padStart(2, '0');
  const timeStr = `${hh}:${mm}`;

  const dirStr = ChillFlightLogic.computeHeadingDirection(hudHeadingY);
  const latVal = -hudTarget.position.z / state.latScale;
  const lonVal = hudTarget.position.x / state.latScale;
  const latStr =
    Math.abs(latVal).toFixed(3) + '\u00b0 ' + (latVal >= 0 ? 'N' : 'S');
  const lonStr =
    Math.abs(lonVal).toFixed(3) + '\u00b0 ' + (lonVal >= 0 ? 'E' : 'W');
  const coordStr = `${latStr} ${lonStr}`;
  const altStr = `${Math.round(Math.max(0, hudTarget.position.y - 45.5) * UNITS_TO_M)} M`;
  const spdStr = `${Math.round(BASE_FLIGHT_SPEED * state.flightSpeedMultiplier * 60)} KTS`;

  updateDOM('cockpit-time', timeStr);
  updateDOM('cockpit-dir', dirStr);
  updateDOM('cockpit-coords', coordStr);
  updateDOM('cockpit-alt', altStr);
  updateDOM('cockpit-spd', spdStr);

  sunMesh.position.set(
    state.sunX * sunOrbitRadius,
    state.sunY * sunOrbitRadius,
    state.sunZ * sunOrbitRadius
  );
  moonMesh.position.set(
    state.moonX * moonOrbitRadius,
    state.moonY * moonOrbitRadius,
    state.moonZ * moonOrbitRadius
  );
}
