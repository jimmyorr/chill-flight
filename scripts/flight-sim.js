/**
 * scripts/flight-sim.js
 *
 * Headless flight dynamics and autopilot simulation engine in pure Node.
 * Runs deterministic flight physics and terrain look-ahead navigation at
 * thousands of frames per second to validate world generation, approach
 * corridors, and autopilot stability invariants without a browser or WebGL.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {AUTOPILOT, AutopilotCore, headingTo} from '../autopilot-logic.js';
import {simplex} from '../noise.js';
import {
  BASE_FLIGHT_SPEED,
  WATER_LEVEL,
  MOUNTAIN_LEVEL,
  PLANE_HANDLING,
  TURN_SPEED,
} from '../constants.js';

export {AUTOPILOT};

export const PHYSICS = {
  THROTTLE_EASE: 2,
  SINK_EASE_SECONDS: 1.0,
  FALL_BLEND_KTS: 20,
  GRAVITY: 120,
  TERMINAL_VELOCITY: -600,
  FALL_EASE_SECONDS: 0.6,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export {headingTo};

export function sinkRateAt(kts, handling) {
  return 15 * (1 - smoothstep(kts, handling.stallKts - 5, handling.levelKts));
}

export class FlightSimulator {
  constructor(options = {}) {
    this.planeType = options.planeType || 'seaplane';
    this.handling = {
      ...PLANE_HANDLING[this.planeType],
      ...(options.handling || {}),
    };
    this.worldSeed = options.worldSeed ?? 20260101;
    this.constants = {WATER_LEVEL, MOUNTAIN_LEVEL};

    // Both pick the world: the noise, and the continent's outline
    ChillFlightLogic.WORLD_SEED = this.worldSeed;
    simplex.seed(this.worldSeed);

    this.position = {
      x: options.x ?? 0,
      y: options.y ?? 400,
      z: options.z ?? 0,
    };

    this.rotation = {
      pitch: options.pitch ?? 0,
      yaw: options.yaw ?? 0,
      roll: options.roll ?? 0,
    };

    this.speed = options.speed ?? 1.0;
    this.targetSpeed = options.targetSpeed ?? this.speed;
    this.targetPitch = this.rotation.pitch;
    this.targetRoll = this.rotation.roll;

    this.verticalVelocity = options.verticalVelocity ?? 0;
    this.fallAmount = 0;

    // Landing gear and runway rollout state
    this.gearDown = options.gearDown ?? true;
    this.isRolling = options.isRolling ?? false;
    this.braking = options.braking ?? false;
    this.wheelHeight = options.wheelHeight ?? 2.0;
    this.touchdownCount = 0;
    this.takeoffCount = 0;

    // Autopilot state: the game's own autopilot (autopilot-logic.js)
    this.autopilotEnabled = options.autopilot ?? true;
    this.waypoint = options.waypoint ? {...options.waypoint} : null;
    this.pilot = new AutopilotCore((x, z) => this.groundAt(x, z));
    this.pilot.heldAlt = options.heldAlt ?? null;

    this.simTime = 0;
    this.crashed = false;
    this.minClearance = Infinity;
  }

  groundAt(x, z) {
    return Math.max(
      WATER_LEVEL,
      ChillFlightLogic.getElevation(x, z, simplex, this.constants)
    );
  }

  setWaypoint(x, z, y = null) {
    this.waypoint = {x, z, y};
    this.pilot.orbit = null;
  }

  get orbit() {
    return this.pilot.orbit;
  }

  clearWaypoint() {
    this.waypoint = null;
  }

  startOrbit(spot, loiter = true) {
    const {x, z} = this.position;
    this.pilot.startOrbit(spot, x, z, this.rotation.yaw, loiter);
  }

  updateAutopilot(dt) {
    const {x, y, z} = this.position;
    // Arrived at the waypoint: circle it
    if (this.pilot.reached(x, z, this.waypoint)) {
      this.startOrbit(this.waypoint, true);
    }
    const {roll, pitch, speed} = this.pilot.update({
      x,
      y,
      z,
      yaw: this.rotation.yaw,
      speedKts: BASE_FLIGHT_SPEED * this.speed * 60,
      agility: this.handling.agility,
      target: this.waypoint,
      delta: dt,
    });
    this.targetRoll = roll;
    this.targetPitch = pitch;
    this.targetSpeed = speed;
  }

  step(dt = 1 / 60) {
    if (this.crashed) return;

    if (this.autopilotEnabled && this.speed > 0) {
      this.updateAutopilot(dt);
    }

    // Flight rotation smoothing
    const effTurnSpeed = TURN_SPEED * this.handling.agility;
    const flightRot = ChillFlightLogic.computeFlightRotation({
      currentPitch: this.rotation.pitch,
      currentRoll: this.rotation.roll,
      currentYaw: this.rotation.yaw,
      targetPitch: this.targetPitch,
      targetRoll: this.targetRoll,
      turningRoll: this.rotation.roll,
      isBarrelRolling: false,
      isLooping: false,
      isClampedRoll: false,
      turnSpeed: effTurnSpeed,
      delta: dt,
      yawMultiplier: this.handling.agility,
    });

    this.rotation.pitch = flightRot.pitch;
    this.rotation.roll = flightRot.roll;
    this.rotation.yaw = flightRot.yaw;

    // Throttle / speed recovery & gravity in dives
    const diff = this.targetSpeed - this.speed;
    const ktsPerMult = BASE_FLIGHT_SPEED * 60;
    const maxRate =
      (diff > 0 ? this.handling.accelKts : this.handling.decelKts) / ktsPerMult;
    const step = Math.min(Math.abs(diff) * PHYSICS.THROTTLE_EASE, maxRate) * dt;
    this.speed += Math.sign(diff) * Math.min(step, Math.abs(diff));

    // Gravity acceleration when diving
    const gravityEffect = -Math.sin(this.rotation.pitch);
    if (gravityEffect > 0) {
      this.speed +=
        gravityEffect * this.handling.diveGain * dt * (1 - this.fallAmount);
    }
    this.speed = clamp(this.speed, 0, 10);

    // Forward translation along local forward vector (YXZ Euler)
    const forwardDist = BASE_FLIGHT_SPEED * this.speed * dt * 60;
    const cosPitch = Math.cos(this.rotation.pitch);
    const dx = -Math.sin(this.rotation.yaw) * cosPitch * forwardDist;
    const dz = -Math.cos(this.rotation.yaw) * cosPitch * forwardDist;
    const dy = Math.sin(this.rotation.pitch) * forwardDist;

    this.position.x += dx;
    this.position.z += dz;
    this.position.y += dy;

    // Ground contact and touchdown
    const ground = this.groundAt(this.position.x, this.position.z);
    const restingHeight = ground + this.wheelHeight;

    if (this.gearDown && this.position.y <= restingHeight + 0.5) {
      if (!this.isRolling) {
        if (Math.abs(this.verticalVelocity) > 40) {
          this.crashed = true;
        } else {
          this.isRolling = true;
          this.touchdownCount++;
          this.position.y = restingHeight;
          this.verticalVelocity = 0;
          this.rotation.pitch = 0;
        }
      } else {
        this.position.y = restingHeight;
        this.verticalVelocity = 0;
      }
    }

    const currentKts = BASE_FLIGHT_SPEED * Math.abs(this.speed) * 60;

    // Rollout dynamics
    if (this.isRolling) {
      // Rotate nose up for takeoff if airspeed is above rotation speed
      if (this.targetPitch > 0.05 && currentKts > this.handling.stallKts + 5) {
        this.rotation.pitch = clamp(this.targetPitch, 0, AUTOPILOT.MAX_CLIMB);
        if (this.position.y > restingHeight + 0.5) {
          this.isRolling = false;
          this.takeoffCount++;
        }
      } else {
        this.rotation.pitch = clamp(this.rotation.pitch, -0.02, 0.05);
        this.rotation.roll = 0;
        this.targetRoll = 0;
      }

      if (this.braking || this.targetSpeed === 0) {
        const brakeDecel = 30 / (BASE_FLIGHT_SPEED * 60);
        this.speed = Math.max(0, this.speed - brakeDecel * dt);
      }
    }

    // Stall, sink rate and gravity fall
    const airborne = !this.isRolling && this.position.y > restingHeight;

    this.fallAmount = lerp(
      this.fallAmount,
      airborne
        ? 1 -
            smoothstep(
              currentKts,
              this.handling.stallKts - PHYSICS.FALL_BLEND_KTS,
              this.handling.stallKts
            )
        : 0,
      1 - Math.exp(-dt / PHYSICS.FALL_EASE_SECONDS)
    );

    if (airborne) {
      this.verticalVelocity -= PHYSICS.GRAVITY * this.fallAmount * dt;
      this.verticalVelocity = lerp(
        this.verticalVelocity,
        -sinkRateAt(currentKts, this.handling),
        (1 - this.fallAmount) * (1 - Math.exp(-dt / PHYSICS.SINK_EASE_SECONDS))
      );
      this.verticalVelocity = Math.max(
        this.verticalVelocity,
        PHYSICS.TERMINAL_VELOCITY
      );
      this.position.y += this.verticalVelocity * dt;
    } else {
      this.verticalVelocity = 0;
    }

    // Terrain clearance and collision check
    const clearance = this.isRolling
      ? this.wheelHeight
      : this.position.y - ground;
    if (clearance < this.minClearance) {
      this.minClearance = clearance;
    }

    if (!this.isRolling && clearance < 0) {
      this.crashed = true;
    }

    this.simTime += dt;
  }

  touchAndGo({
    rolloutDuration = 3.0,
    climbPitch = 0.12,
    climbTargetAlt = 400,
  } = {}) {
    let rollTimer = 0;
    let state = 'approach';

    return this.runUntil({
      maxDuration: 60,
      condition: (s) => state === 'climbing' && s.position.y >= climbTargetAlt,
      onStep: (s) => {
        if (state === 'approach' && s.isRolling) {
          state = 'rolling';
          s.targetSpeed = 0.5;
          s.braking = true;
        } else if (state === 'rolling') {
          rollTimer += 1 / 60;
          if (rollTimer >= rolloutDuration) {
            state = 'climbing';
            s.braking = false;
            s.targetSpeed = 1.0;
            s.targetPitch = climbPitch;
          }
        }
      },
    });
  }

  runUntil({maxDuration = 60, dt = 1 / 60, condition = null, onStep = null}) {
    let steps = 0;
    const startSimTime = this.simTime;
    while (
      this.simTime - startSimTime < maxDuration &&
      !this.crashed &&
      (!condition || !condition(this))
    ) {
      this.step(dt);
      steps++;
      if (onStep) onStep(this);
    }
    return {
      duration: this.simTime - startSimTime,
      steps,
      crashed: this.crashed,
      minClearance: this.minClearance,
      finalState: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z,
        pitch: this.rotation.pitch,
        yaw: this.rotation.yaw,
        roll: this.rotation.roll,
        speed: this.speed,
        kts: BASE_FLIGHT_SPEED * this.speed * 60,
      },
    };
  }
}
