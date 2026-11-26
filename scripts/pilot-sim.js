// Pure-Node deterministic virtual-pilot flight simulator matching the airborne
// controls and physics in `game-loop.js` + `flight-physics.js` (`weightedRoll`,
// `stepRollExit`, `stepLoopPitch`, `isDoingImmelmann`, `sharpTurnAmount`,
// `pitchedTarget`, `throttleSpeed`, and `airborneVerticalVelocity`).
// Used by `scripts/shorts.js` to back-solve spawn coordinates (`solvePilotStartCoords`)
// and pre-verify terrain/arch clearance (`verifySegmentCorridor`) in < 2ms.

import {ChillFlightLogic} from '../chill-flight-logic.js';
import {BASE_FLIGHT_SPEED, PLANE_HANDLING, TURN_SPEED} from '../constants.js';
import {
  LOOP,
  ROLL_EXIT,
  airborneVerticalVelocity,
  canEnterLoop,
  ceilingClimbLimit,
  fallAmountAt,
  flightCeiling,
  loopDipAt,
  loopRateAt,
  loopSwingAt,
  pitchedTarget,
  rollExitHandOver,
  rollExitTurns,
  sagClimbCap,
  stepLoopPitch,
  stepRollExit,
  thinAirAt,
  throttleSpeed,
} from '../flight-physics-logic.js';
import {pilotAt} from '../promo-script.js';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
const BARREL_ROLL_EASE_IN = 0.25;
const BARREL_ROLL_SPEED = 0.7;
const SHARP_TURN_BANK_ANGLE = 78 * DEG;
const SHARP_TURN_YAW_MULT = 1.5;
const SHARP_TURN_ROLL_SPEED = 0.045;
const SHARP_TURN_EASE_IN = 0.8;
const SHARP_TURN_EASE_OUT = 0.6;
const PITCH_EASE_IN = 0.25;
const STEEP_PITCH_EASE_IN = 0.3;
const PITCH_EASE_OUT = 2.5;
const PITCH_SPEED = 1.0;
const STEEP_PITCH_SPEED = 1.6;
const CLIMB_ANGLE = 35 * DEG;
const DIVE_ANGLE = -45 * DEG;
const STEEP_CLIMB_ANGLE = 60 * DEG;
const STEEP_DIVE_ANGLE = -70 * DEG;
const MAX_DIVE_ANGLE = -75 * DEG;
const MAX_CLIMB_ANGLE = 75 * DEG;
const SLOW_CLIMB_ANGLE = 20 * DEG;
const WEIGHTED_ROLL_OMEGA = 1.69;
const TURN_FADE_FROM_KTS = 150;
const TURN_FADE_TO_KTS = 450;
const TURN_FAST_SCALE = 0.7;
const IMMELMANN_DURATION = 2.4;
const IMMELMANN_PITCH_END = 0.88;
const IMMELMANN_SPEED_DIP = 0.18;
const DEFAULT_CLOUD_HEIGHT = 3000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, u) => a + (b - a) * u;

function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const u = (x - min) / (max - min);
  return u * u * (3 - 2 * u);
}

function wrapAngle(a) {
  return a - TWO_PI * Math.round(a / TWO_PI);
}

function climbLimit(cap, kts, handling) {
  const speedCap =
    handling.stallKts > 0
      ? lerp(
          SLOW_CLIMB_ANGLE,
          MAX_CLIMB_ANGLE,
          smoothstep(kts, handling.stallKts, handling.levelKts)
        )
      : MAX_CLIMB_ANGLE;
  return Math.min(cap ?? MAX_CLIMB_ANGLE, speedCap);
}

// Converts Euler(pitch, yaw, roll, 'YXZ') forward vector [0, 0, -1] to new yaw
// after an Immelmann half-loop + half-roll completes.
function immelmannExitYaw(pitch, yaw) {
  const cp = Math.cos(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const fx = -sy * cp;
  const fz = -cy * cp;
  return Math.atan2(-fx, -fz);
}

export function simulatePilotTrajectory({
  planeType = 'seaplane',
  x = 0,
  y = 400,
  z = 0,
  headingDeg = 0,
  speedMult = 1,
  pilotMoves = null,
  endFrame = 0,
  prerollSec = 1.5,
  fps = 30,
  cloudHeight = DEFAULT_CLOUD_HEIGHT,
  weightedRoll = true,
}) {
  const handling = PLANE_HANDLING[planeType] || PLANE_HANDLING.seaplane;
  const agility = handling.agility || 1;
  const manualRollSpeed = handling.rollRate * BARREL_ROLL_SPEED;
  const dt = 1 / fps;
  const prerollSteps = Math.round(prerollSec * fps);

  let px = x;
  let py = y;
  let pz = z;
  let pitch = 0;
  let yaw = headingDeg * DEG;
  let roll = 0;
  let speed = speedMult;
  let targetSpeed = speedMult;
  let verticalVelocity = 0;
  let fallAmount = 0;
  let ceilingCap = null;
  let rollRate = 0;

  let sharpTurnRamp = 0;
  let sharpTurnDir = 0;

  let manualPitchVel = 0;
  let manualPitchActive = false;
  let steepPitchActive = false;
  let lastPitchMode = 0;

  let barrelRollDir = 0;
  let barrelRollRate = 0;
  const rollExit = {active: false, roll: 0, rate: 0, accel: 0, turns: 0, t: 0};

  let loopActive = false;
  let loopRecovering = false;
  let loopPitchRate = 0;
  let loopSpeed = speedMult;
  const loopExit = {roll: 0, rate: 0, accel: 0, turns: 0, t: 0};
  const loopStep = {pitch: 0, rate: 0};

  let isDoingImmelmann = false;
  let immelmannProgress = 0;
  let immelmannLatched = false;
  const immelmann = {
    pitch: 0,
    pitchRate: 0,
    roll: 0,
    yaw: 0,
    speed: 0,
    duration: 2.4,
  };

  const samples = [
    {
      frame: -prerollSteps,
      t: -prerollSec,
      x: px,
      y: py,
      z: pz,
      roll,
      pitch,
      yaw,
      speed,
    },
  ];

  const totalSteps = prerollSteps + endFrame;
  for (let stepIdx = 1; stepIdx <= totalSteps; stepIdx++) {
    const frame = stepIdx - prerollSteps;
    const t = frame / fps;
    const pilot =
      frame <= 0
        ? {steerX: 0, steerY: 0, throttle: null, stunt: null}
        : pilotAt(pilotMoves, t);

    const effMouseX = clamp(pilot.steerX || 0, -1, 1);
    const effMouseY = clamp(pilot.steerY || 0, -1, 1);
    const stunt = pilot.stunt;

    const isUp =
      stunt === 'climb' || stunt === 'steep-climb' || stunt === 'loop';
    const dtUp = stunt === 'steep-climb';
    const ttUp = stunt === 'loop';
    const isDown = stunt === 'dive' || stunt === 'steep-dive';
    const dtDown = stunt === 'steep-dive';
    const isLeft = stunt === 'roll-left' || stunt === 'sharp-left';
    const dtLeft = stunt === 'sharp-left';
    const ttLeft = stunt === 'roll-left';
    const isRight = stunt === 'roll-right' || stunt === 'sharp-right';
    const dtRight = stunt === 'sharp-right';
    const ttRight = stunt === 'roll-right';

    if (stunt === 'immelmann') {
      if (!immelmannLatched && !isDoingImmelmann && !loopActive) {
        isDoingImmelmann = true;
        immelmannProgress = 0;
      }
      immelmannLatched = true;
    } else {
      immelmannLatched = false;
    }

    if (pilot.throttle !== null && pilot.throttle !== undefined) {
      targetSpeed = pilot.throttle;
    }

    const maxPitch = Math.PI / 4;
    const maxRoll = Math.PI / 3;
    let targetPitch = effMouseY * maxPitch;
    let targetRoll = -effMouseX * (maxRoll * 1.25);

    if (isUp) {
      targetPitch = Math.min(
        MAX_CLIMB_ANGLE,
        (dtUp ? STEEP_CLIMB_ANGLE : CLIMB_ANGLE) + effMouseY * (maxPitch * 0.4)
      );
    } else if (isDown) {
      targetPitch = Math.max(
        MAX_DIVE_ANGLE,
        (dtDown ? STEEP_DIVE_ANGLE : DIVE_ANGLE) + effMouseY * (maxPitch * 0.4)
      );
    }

    let sharpHeld = 0;
    if (isLeft && dtLeft) sharpHeld = 1;
    else if (isRight && dtRight) sharpHeld = -1;
    if (sharpHeld) sharpTurnDir = sharpHeld;
    sharpTurnRamp = clamp(
      sharpTurnRamp +
        (sharpHeld ? dt / SHARP_TURN_EASE_IN : -dt / SHARP_TURN_EASE_OUT),
      0,
      1
    );
    const sharpTurnAmount = smoothstep(sharpTurnRamp, 0, 1);
    if (sharpTurnAmount > 0) {
      const sharpRoll =
        sharpTurnDir * SHARP_TURN_BANK_ANGLE - effMouseX * (maxRoll * 0.15);
      targetRoll = lerp(targetRoll, sharpRoll, sharpTurnAmount);
      targetPitch += 0.12 * sharpTurnAmount * Math.sin(Math.abs(roll));
    }

    let isBarrelRolling = false;
    let isLooping = false;
    let isSteepPitch = false;

    if (isDoingImmelmann) {
      if (immelmannProgress === 0) {
        loopActive = false;
        loopRecovering = false;
        immelmann.pitch = wrapAngle(pitch);
        immelmann.pitchRate = manualPitchActive ? manualPitchVel : 0;
        immelmann.roll = wrapAngle(roll);
        immelmann.yaw = yaw;
        immelmann.speed = speed;
        immelmann.duration = IMMELMANN_DURATION / agility;
      }
      immelmannProgress += dt;
      const u = Math.min(1.0, immelmannProgress / immelmann.duration);
      const s = Math.min(1, u / IMMELMANN_PITCH_END);
      const pitchSeconds = immelmann.duration * IMMELMANN_PITCH_END;
      const s2 = s * s;
      const s3 = s2 * s;
      pitch =
        (2 * s3 - 3 * s2 + 1) * immelmann.pitch +
        (s3 - 2 * s2 + s) * immelmann.pitchRate * pitchSeconds +
        (3 * s2 - 2 * s3) * Math.PI;
      roll =
        immelmann.roll * (1 - smoothstep(u, 0, 0.3)) +
        Math.PI * smoothstep(u, 0.35, 0.95);
      const speedDip = Math.sin(smoothstep(s, 0, 1) * Math.PI);
      speed = immelmann.speed * (1 - speedDip * IMMELMANN_SPEED_DIP);
      yaw = immelmann.yaw;
      isLooping = true;
      isBarrelRolling = true;
      verticalVelocity = 0;
      manualPitchVel = 0;
      manualPitchActive = false;
      steepPitchActive = false;
      lastPitchMode = 0;

      if (u >= 1.0) {
        isDoingImmelmann = false;
        isLooping = false;
        isBarrelRolling = false;
        yaw = immelmannExitYaw(pitch, yaw);
        pitch = 0;
        roll = 0;
        immelmannProgress = 0;
      }
    } else {
      const currentKts = BASE_FLIGHT_SPEED * Math.abs(speed) * 60;
      const loopCeiling = flightCeiling(cloudHeight);
      const loopThinAir = thinAirAt(py, loopCeiling);
      const loopHeld = isUp && ttUp;
      const canStartLoop = loopRecovering
        ? currentKts >= handling.stallKts + 10
        : canEnterLoop(currentKts, ceilingCap, handling);

      if (loopHeld && !loopActive && canStartLoop) {
        const entryRate = loopRateAt(currentKts, handling, loopThinAir);
        if (!loopRecovering) {
          const wrappedX = wrapAngle(pitch);
          const climbCarry = wrappedX > 0.12 ? LOOP.CARRY_SHARE * entryRate : 0;
          loopPitchRate = Math.max(
            manualPitchActive ? Math.max(0, manualPitchVel) : 0,
            climbCarry
          );
          loopSpeed = speed;
          pitch = wrappedX;
        } else {
          loopPitchRate = Math.max(0, loopExit.rate);
          pitch = ((pitch % TWO_PI) + TWO_PI) % TWO_PI;
        }
        loopActive = true;
        loopRecovering = false;
        steepPitchActive = false;
        manualPitchActive = false;
        manualPitchVel = 0;
        lastPitchMode = 0;
      }

      if (loopActive || loopRecovering) {
        loopSpeed = throttleSpeed(loopSpeed, targetSpeed, handling, dt);
        const baseKts = BASE_FLIGHT_SPEED * Math.abs(loopSpeed) * 60;
        const effLoopRate = loopRateAt(
          baseKts,
          handling,
          loopActive ? loopThinAir : 0
        );
        const effLoopSwing = loopSwingAt(baseKts, handling);
        const effLoopAccel = handling.loopAccel || LOOP.ACCEL * agility;
        const effLoopDip = loopDipAt(baseKts, handling);

        if (loopActive) {
          loopStep.pitch = pitch;
          loopStep.rate = loopPitchRate;
          stepLoopPitch(loopStep, effLoopRate, effLoopSwing, effLoopAccel, dt);
          pitch = loopStep.pitch;
          loopPitchRate = loopStep.rate;

          if (
            !isBarrelRolling &&
            !rollExit.active &&
            Math.abs(targetRoll) < 0.02
          ) {
            const levelEase = 1 - Math.exp(-LOOP.WING_LEVEL_RATE * dt);
            roll = wrapAngle(roll) * (1 - levelEase);
            rollRate *= 1 - levelEase;
          }

          if (!loopHeld) {
            loopActive = false;
            loopRecovering = true;
            loopExit.roll = pitch;
            loopExit.rate = loopPitchRate;
            loopExit.accel = 0;
            loopExit.turns = rollExitTurns(
              loopExit.roll,
              loopExit.rate,
              0,
              effLoopRate
            );
            loopExit.t = 0;
          }
        } else {
          const wrappedPitch = wrapAngle(pitch);
          const pitchSteer = isUp
            ? Math.max(targetPitch, 0.1)
            : isDown
              ? Math.min(targetPitch, -0.1)
              : targetPitch;
          if (rollExitHandOver(wrappedPitch, pitchSteer, MAX_CLIMB_ANGLE)) {
            loopRecovering = false;
            pitch = wrappedPitch;
            manualPitchVel = loopExit.rate;
            manualPitchActive = true;
            lastPitchMode = 0;
          } else {
            loopExit.t += dt;
            loopExit.roll = pitch;
            const settled = stepRollExit(
              loopExit,
              loopExit.turns,
              effLoopRate,
              dt
            );
            pitch = loopExit.roll;
            loopPitchRate = loopExit.rate;
            if (settled || loopExit.t > ROLL_EXIT.MAX_SECONDS) {
              pitch = wrapAngle(loopExit.roll);
              loopRecovering = false;
              loopPitchRate = 0;
              manualPitchVel = 0;
              manualPitchActive = false;
              lastPitchMode = 0;
            }
          }
        }

        if (loopActive || loopRecovering) {
          speed = loopSpeed * (1 - (effLoopDip * (1 - Math.cos(pitch))) / 2);
        }
        isLooping = loopActive || loopRecovering;
      }

      if (!loopActive && !loopRecovering) {
        let pitchMode = 0;
        if (isUp) pitchMode = dtUp ? 2 : 1;
        else if (isDown) pitchMode = dtDown ? -2 : -1;

        if (pitchMode !== lastPitchMode && pitchMode !== 0) {
          if (!manualPitchActive) manualPitchVel = 0;
          manualPitchActive = true;
        }
        lastPitchMode = pitchMode;

        if (manualPitchActive) {
          if (Math.abs(pitchMode) === 2) steepPitchActive = true;
          else if (pitchMode !== 0) steepPitchActive = false;

          const pitchModulation = effMouseY * (maxPitch * 0.4);
          let targetAngle = targetPitch;
          if (pitchMode === 2)
            targetAngle = STEEP_CLIMB_ANGLE + pitchModulation;
          else if (pitchMode === 1) targetAngle = CLIMB_ANGLE + pitchModulation;
          else if (pitchMode === -1) targetAngle = DIVE_ANGLE + pitchModulation;
          else if (pitchMode === -2) {
            targetAngle = STEEP_DIVE_ANGLE + pitchModulation;
          }

          const maxSpeed =
            (steepPitchActive ? STEEP_PITCH_SPEED : PITCH_SPEED) * agility;
          const kts = BASE_FLIGHT_SPEED * Math.abs(speed) * 60;
          const maxClimb = climbLimit(ceilingCap, kts, handling);
          targetAngle = Math.min(
            maxClimb,
            Math.max(MAX_DIVE_ANGLE, targetAngle)
          );
          const diff = wrapAngle(targetAngle - pitch);
          if (
            pitchMode === 0 &&
            Math.abs(diff) <= 0.02 &&
            Math.abs(manualPitchVel) < 0.2
          ) {
            pitch = targetAngle;
            manualPitchActive = false;
            manualPitchVel = 0;
            steepPitchActive = false;
            isSteepPitch = false;
          } else {
            const easeIn = steepPitchActive
              ? STEEP_PITCH_EASE_IN
              : PITCH_EASE_IN;
            const wantVel =
              Math.sign(diff) *
              Math.min(maxSpeed, Math.abs(diff) * PITCH_EASE_OUT * agility);
            const maxStep = (maxSpeed * dt) / easeIn;
            manualPitchVel += clamp(
              wantVel - manualPitchVel,
              -maxStep,
              maxStep
            );
            const pitched = pitch + manualPitchVel * dt;
            pitch = clamp(pitched, MAX_DIVE_ANGLE, MAX_CLIMB_ANGLE);
            if (pitch !== pitched) manualPitchVel = 0;
            isSteepPitch = steepPitchActive;
          }
        }
      }

      let rollHeld = 0;
      if (!isDoingImmelmann) {
        if (isLeft && ttLeft) rollHeld = 1;
        else if (isRight && ttRight) rollHeld = -1;
      }
      if (rollHeld !== barrelRollDir) {
        if (rollHeld !== 0) {
          barrelRollRate = rollExit.active
            ? Math.max(0, rollHeld * rollExit.rate)
            : 0;
          rollExit.active = false;
        } else {
          rollExit.active = true;
          rollExit.roll = roll;
          rollExit.rate = barrelRollDir * barrelRollRate;
          rollExit.accel = 0;
          rollExit.turns = rollExitTurns(
            rollExit.roll,
            rollExit.rate,
            0,
            manualRollSpeed
          );
          rollExit.t = 0;
          barrelRollRate = 0;
        }
        barrelRollDir = rollHeld;
      }
      if (rollExit.active) {
        const wrapped = wrapAngle(roll);
        if (rollExitHandOver(wrapped, targetRoll, SHARP_TURN_BANK_ANGLE)) {
          rollExit.active = false;
          roll = wrapped;
          rollRate = rollExit.rate;
        } else {
          rollExit.t += dt;
          rollExit.roll = roll;
          const settled = stepRollExit(
            rollExit,
            rollExit.turns,
            manualRollSpeed,
            dt
          );
          roll = rollExit.roll;
          if (settled || rollExit.t > ROLL_EXIT.MAX_SECONDS) {
            rollExit.active = false;
            roll = wrapAngle(rollExit.roll);
            rollRate = rollExit.rate;
          } else {
            isBarrelRolling = true;
          }
        }
      }
      if (barrelRollDir !== 0) {
        barrelRollRate = Math.min(
          manualRollSpeed,
          barrelRollRate + (manualRollSpeed * dt) / BARREL_ROLL_EASE_IN
        );
        roll += barrelRollDir * barrelRollRate * dt;
        isBarrelRolling = true;
      }
    }

    const effTurnSpeed =
      lerp(TURN_SPEED, SHARP_TURN_ROLL_SPEED, sharpTurnAmount) * agility;
    const kts = BASE_FLIGHT_SPEED * Math.abs(speed) * 60;
    const turnRate =
      agility *
      lerp(
        1,
        TURN_FAST_SCALE,
        smoothstep(kts, TURN_FADE_FROM_KTS, TURN_FADE_TO_KTS)
      );

    const flightRot = ChillFlightLogic.computeFlightRotation({
      currentPitch: pitch,
      currentRoll: roll,
      currentYaw: yaw,
      targetPitch,
      targetRoll,
      turningRoll: roll,
      isBarrelRolling,
      isLooping: isLooping || isSteepPitch || manualPitchActive,
      isClampedRoll: false,
      turnSpeed: effTurnSpeed,
      delta: dt,
      yawMultiplier: lerp(1.0, SHARP_TURN_YAW_MULT, sharpTurnAmount) * turnRate,
      manualYaw: isBarrelRolling && frame > 0 ? -effMouseX : 0,
    });

    pitch = flightRot.pitch;
    const topCeiling = flightCeiling(cloudHeight);
    if (!isLooping && !isDoingImmelmann) {
      ceilingCap = sagClimbCap(
        ceilingCap,
        ceilingClimbLimit(py, topCeiling, MAX_CLIMB_ANGLE),
        kts,
        dt
      );
      const maxClimb = climbLimit(ceilingCap, kts, handling);
      if (pitch > maxClimb) manualPitchVel = 0;
      pitch = clamp(pitch, MAX_DIVE_ANGLE, maxClimb);
    }

    const rollBefore = roll;
    if (weightedRoll && !isBarrelRolling) {
      const omega = WEIGHTED_ROLL_OMEGA * effTurnSpeed * 60;
      const wrappedRoll = wrapAngle(rollBefore);
      let target = targetRoll;
      while (target > wrappedRoll + Math.PI) target -= TWO_PI;
      while (target < wrappedRoll - Math.PI) target += TWO_PI;
      const step = Math.min(dt, 0.05);
      rollRate +=
        (omega * omega * (target - wrappedRoll) - 2 * omega * rollRate) * step;
      roll = wrapAngle(wrappedRoll + rollRate * step);
    } else {
      roll = flightRot.roll;
      rollRate =
        barrelRollDir !== 0
          ? barrelRollDir * barrelRollRate
          : rollExit.active
            ? rollExit.rate
            : (flightRot.roll - rollBefore) / dt;
    }

    yaw = flightRot.yaw;

    // Flight physics speed, forward translation, and vertical sink
    const speedTarget = pitchedTarget(
      targetSpeed,
      pitch,
      handling,
      fallAmount,
      false,
      thinAirAt(py, topCeiling)
    );
    speed = throttleSpeed(speed, speedTarget, handling, dt);

    const stepDist = BASE_FLIGHT_SPEED * speed * dt * 60;
    const cosPitch = Math.cos(pitch);
    px += -Math.sin(yaw) * cosPitch * stepDist;
    py += Math.sin(pitch) * stepDist;
    pz += -Math.cos(yaw) * cosPitch * stepDist;

    const afterKts = BASE_FLIGHT_SPEED * Math.abs(speed) * 60;
    fallAmount = fallAmountAt(fallAmount, true, afterKts, handling, dt);
    if (!isLooping && !isDoingImmelmann) {
      verticalVelocity = airborneVerticalVelocity(
        verticalVelocity,
        fallAmount,
        afterKts,
        handling,
        dt
      );
      py += verticalVelocity * dt;
    } else {
      verticalVelocity = 0;
    }
    if (py > topCeiling) py = topCeiling;

    samples.push({
      frame,
      t,
      x: px,
      y: py,
      z: pz,
      roll,
      pitch,
      yaw,
      speed,
    });
  }

  return samples;
}

// Solves starting `(x, y, z, headingDeg)` so that a virtual-pilot flight
// arrives at `(tx, ty, tz)` on `targetFrame` (and optionally aligns its heading
// with `headingDeg` at `targetFrame`, e.g. carving into an arch or portal).
export function solvePilotStartCoords({
  planeType = 'seaplane',
  tx = 0,
  ty = 400,
  tz = 0,
  headingDeg = 0,
  speedMult = 1,
  pilotMoves = null,
  targetFrame = 0,
  prerollSec = 1.5,
  fps = 30,
  alignHeading = false,
  round = true,
}) {
  const idx = Math.round(prerollSec * fps) + Math.max(0, targetFrame);
  let spawnHeading = headingDeg;

  // First pass at `ty` discovers any yaw accumulated by `targetFrame`
  const probe = simulatePilotTrajectory({
    planeType,
    x: 0,
    y: ty,
    z: 0,
    headingDeg: spawnHeading,
    speedMult,
    pilotMoves,
    endFrame: Math.max(0, targetFrame),
    prerollSec,
    fps,
  });
  const hit0 = probe[idx] || probe[probe.length - 1];
  if (alignHeading) {
    const yawDeltaDeg = (hit0.yaw - spawnHeading * DEG) / DEG;
    spawnHeading = headingDeg - yawDeltaDeg;
  }

  // Two fixed-point passes handle thin-air altitude dependence if near ceiling
  let sx = tx - hit0.x;
  let sy = ty - (hit0.y - ty);
  let sz = tz - hit0.z;
  for (let pass = 0; pass < 2; pass++) {
    const traced = simulatePilotTrajectory({
      planeType,
      x: sx,
      y: sy,
      z: sz,
      headingDeg: spawnHeading,
      speedMult,
      pilotMoves,
      endFrame: Math.max(0, targetFrame),
      prerollSec,
      fps,
    });
    const hit = traced[idx] || traced[traced.length - 1];
    sx += tx - hit.x;
    sy += ty - hit.y;
    sz += tz - hit.z;
  }

  return round
    ? {
        x: Math.round(sx),
        y: Math.round(sy),
        z: Math.round(sz),
        headingDeg: Number(spawnHeading.toFixed(2)),
      }
    : {x: sx, y: sy, z: sz, headingDeg: spawnHeading};
}
