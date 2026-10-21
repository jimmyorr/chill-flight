/**
 * scripts/flight-sim.js
 *
 * Headless flight dynamics and autopilot simulation engine in pure Node.
 * Runs deterministic flight physics and terrain look-ahead navigation at
 * thousands of frames per second to validate world generation, approach
 * corridors, and autopilot stability invariants without a browser or WebGL.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {
  BASE_FLIGHT_SPEED,
  WATER_LEVEL,
  MOUNTAIN_LEVEL,
  PLANE_HANDLING,
  TURN_SPEED,
} from '../constants.js';

export const AUTOPILOT = {
  CLEARANCE: 160,
  CRUISE_FLOOR: 330,
  LOOK_AHEAD: 9000,
  SCAN_STEP: 300,
  NEAR_AHEAD: 1500,
  NEAR_STEP: 150,
  SIDE_OFFSET: 250,
  TURN_LOOK_AHEAD: 2500,
  CLIMB_SLOPE: 0.12,
  SCAN_INTERVAL: 0.25,
  DESCENT_MARGIN: 100,
  DESCENT_RATE: 18,
  PITCH_PER_UNIT: 0.006,
  PITCH_DAMPING: 0.012,
  MAX_CLIMB: Math.PI / 6,
  MAX_DESCENT: Math.PI / 25,
  MAX_ROLL: Math.PI / 4,
  ORBIT_RADIUS: 700,
  CRUISE_SPEED: 1.0,
  ORBIT_SPEED: 0.8,
  ORBIT_CLEARANCE: 120,
  ORBIT_SAMPLES: 12,
};

export const PHYSICS = {
  THROTTLE_EASE: 2,
  SINK_EASE_SECONDS: 1.0,
  FALL_BLEND_KTS: 20,
  GRAVITY: 120,
  TERMINAL_VELOCITY: -600,
  FALL_EASE_SECONDS: 0.6,
};

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

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

export function headingTo(x, z, tx, tz) {
  return Math.atan2(-(tx - x), -(tz - z));
}

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

    // Autopilot state
    this.autopilotEnabled = options.autopilot ?? true;
    this.waypoint = options.waypoint ? {...options.waypoint} : null;
    this.heldAlt = options.heldAlt ?? null;
    this.lastY = this.position.y;
    this.smoothedVerticalSpeed = 0;
    this.scanTimer = 0;
    this.orbit = null;

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
    this.orbit = null;
  }

  clearWaypoint() {
    this.waypoint = null;
  }

  startOrbit(spot, loiter = true) {
    const {x, z} = this.position;
    const out = headingTo(spot.x, spot.z, x, z);
    const yaw = this.rotation.yaw;
    const dir =
      Math.abs(wrapAngle(yaw - (out + Math.PI / 2))) <
      Math.abs(wrapAngle(yaw - (out - Math.PI / 2)))
        ? 1
        : -1;

    let top = this.groundAt(spot.x, spot.z);
    for (let i = 0; i < AUTOPILOT.ORBIT_SAMPLES; i++) {
      const a = (i / AUTOPILOT.ORBIT_SAMPLES) * Math.PI * 2;
      top = Math.max(
        top,
        this.groundAt(
          spot.x + Math.cos(a) * AUTOPILOT.ORBIT_RADIUS,
          spot.z + Math.sin(a) * AUTOPILOT.ORBIT_RADIUS
        )
      );
    }

    this.orbit = {
      x: spot.x,
      z: spot.z,
      alt: top + AUTOPILOT.ORBIT_CLEARANCE,
      dir,
      loiter,
      swept: 0,
      lastOut: out,
    };
  }

  heightAlong(heading, range = AUTOPILOT.LOOK_AHEAD) {
    const {x, z} = this.position;
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    const sx = -fz;
    const sz = fx;

    let needed = AUTOPILOT.CRUISE_FLOOR;
    for (
      let d = 0;
      d <= range;
      d += d < AUTOPILOT.NEAR_AHEAD ? AUTOPILOT.NEAR_STEP : AUTOPILOT.SCAN_STEP
    ) {
      const cx = x + fx * d;
      const cz = z + fz * d;
      const ground =
        d <= AUTOPILOT.NEAR_AHEAD
          ? Math.max(
              this.groundAt(cx, cz),
              this.groundAt(
                cx + sx * AUTOPILOT.SIDE_OFFSET,
                cz + sz * AUTOPILOT.SIDE_OFFSET
              ),
              this.groundAt(
                cx - sx * AUTOPILOT.SIDE_OFFSET,
                cz - sz * AUTOPILOT.SIDE_OFFSET
              )
            )
          : this.groundAt(cx, cz);
      const h = ground + AUTOPILOT.CLEARANCE - d * AUTOPILOT.CLIMB_SLOPE;
      if (h > needed) needed = h;
    }
    return needed;
  }

  steerTo(heading, bank = 0) {
    const yawError = wrapAngle(heading - this.rotation.yaw);
    this.targetRoll = clamp(
      yawError * 1.5 + bank,
      -AUTOPILOT.MAX_ROLL,
      AUTOPILOT.MAX_ROLL
    );
  }

  updateAutopilot(dt) {
    const {x, z, y} = this.position;

    // Arrived at waypoint: start orbiting
    if (
      !this.orbit &&
      this.waypoint &&
      Math.hypot(this.waypoint.x - x, this.waypoint.z - z) <
        AUTOPILOT.ORBIT_RADIUS
    ) {
      this.startOrbit(this.waypoint, true);
    }

    this.targetSpeed = this.orbit
      ? AUTOPILOT.ORBIT_SPEED
      : AUTOPILOT.CRUISE_SPEED;

    let heading = this.rotation.yaw;
    if (this.orbit) {
      const out = headingTo(this.orbit.x, this.orbit.z, x, z);
      this.orbit.swept += wrapAngle(out - this.orbit.lastOut) * this.orbit.dir;
      this.orbit.lastOut = out;

      const dist = Math.hypot(x - this.orbit.x, z - this.orbit.z);
      const correction = clamp(
        (dist - AUTOPILOT.ORBIT_RADIUS) / AUTOPILOT.ORBIT_RADIUS,
        -0.8,
        0.8
      );
      heading = out + this.orbit.dir * (Math.PI / 2 + correction);

      const kts = BASE_FLIGHT_SPEED * this.speed * 60;
      const bank =
        (this.orbit.dir * kts) /
        AUTOPILOT.ORBIT_RADIUS /
        (1.5 * this.handling.agility);
      this.steerTo(heading, bank);
    } else if (this.waypoint) {
      heading = headingTo(x, z, this.waypoint.x, this.waypoint.z);
      this.steerTo(heading);
    } else {
      this.targetRoll = 0;
    }

    // Terrain lookahead altitude hold
    this.scanTimer -= dt;
    if (this.heldAlt === null || this.scanTimer <= 0) {
      this.scanTimer = AUTOPILOT.SCAN_INTERVAL;
      let needed;
      if (this.orbit) {
        needed = this.orbit.alt;
      } else {
        needed = this.heightAlong(heading);
        if (Math.abs(wrapAngle(heading - this.rotation.yaw)) > 0.2) {
          needed = Math.max(
            needed,
            this.heightAlong(this.rotation.yaw, AUTOPILOT.TURN_LOOK_AHEAD)
          );
        }
      }

      if (this.heldAlt === null || needed > this.heldAlt) {
        this.heldAlt = needed;
      } else if (this.heldAlt - needed > AUTOPILOT.DESCENT_MARGIN) {
        this.heldAlt -= AUTOPILOT.DESCENT_RATE * AUTOPILOT.SCAN_INTERVAL;
      }
    }

    if (dt > 0) {
      const k = 1 - Math.exp(-dt * 4);
      this.smoothedVerticalSpeed +=
        ((y - this.lastY) / dt - this.smoothedVerticalSpeed) * k;
    }
    this.lastY = y;

    this.targetPitch = clamp(
      (this.heldAlt - y) * AUTOPILOT.PITCH_PER_UNIT -
        this.smoothedVerticalSpeed * AUTOPILOT.PITCH_DAMPING,
      -AUTOPILOT.MAX_DESCENT,
      AUTOPILOT.MAX_CLIMB
    );
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

    // Stall, sink rate and gravity fall
    const currentKts = BASE_FLIGHT_SPEED * Math.abs(this.speed) * 60;
    const ground = this.groundAt(this.position.x, this.position.z);
    const airborne = this.position.y > ground;

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
    const clearance = this.position.y - ground;
    if (clearance < this.minClearance) {
      this.minClearance = clearance;
    }

    if (clearance < 0) {
      this.crashed = true;
    }

    this.simTime += dt;
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
