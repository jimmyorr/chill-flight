// --- AUTOPILOT: FLIGHT LOGIC ---
// How the autopilot flies (autopilot.js picks where to): steering toward a
// target or round a circle, and keeping a safe height over the ground ahead,
// climbing only as early as the terrain needs and coming back down after.
// No three.js or DOM, so scripts/flight-sim.js flies this same code in Node.

export const AUTOPILOT = {
  // Height to keep over the ground ahead (units, about 80 m), and the lowest
  // it cruises (y, about 150 m on the altitude readout), so it flies high
  // over low country too
  CLEARANCE: 160,
  CRUISE_FLOOR: 330,
  // Look this far ahead for high ground (units), every SCAN_STEP, closer
  // together over the first NEAR_AHEAD so a sharp ridge isn't missed, and
  // over the first NEAR_AHEAD also SIDE_OFFSET either side of the track, so
  // a turn doesn't find a hill late (not further out, or it climbs over
  // every peak it merely passes beside)
  LOOK_AHEAD: 9000,
  SCAN_STEP: 300,
  NEAR_AHEAD: 1500,
  NEAR_STEP: 150,
  SIDE_OFFSET: 250,
  // While turning onto the course, how far along the current heading to look
  TURN_LOOK_AHEAD: 2500,
  // Climb no steeper than this toward high ground ahead (rise per unit
  // flown, about 7 degrees): gentle, and started early thanks to LOOK_AHEAD
  CLIMB_SLOPE: 0.12,
  // Rescan the ground this often (s): sampling the terrain isn't free
  SCAN_INTERVAL: 0.25,
  // Once past high ground, stay up until the held height is this much more
  // than needed (units), then come down no faster than DESCENT_RATE
  // (units/s, a gentle 7 degrees at cruise), so it doesn't dip into every
  // valley
  DESCENT_MARGIN: 100,
  DESCENT_RATE: 18,
  // Pitch toward the held height: so much per unit of height to go, less so
  // much per unit/s already climbing or sinking, so it eases on rather than
  // overshooting and bobbing
  PITCH_PER_UNIT: 0.006,
  PITCH_DAMPING: 0.012,
  MAX_CLIMB: Math.PI / 6,
  MAX_DESCENT: Math.PI / 25,
  MAX_ROLL: Math.PI / 4,
  // Circle the spot at this radius (units), starting once this close
  ORBIT_RADIUS: 700,
  // Speeds (150 kts = 1.0): a little slower while circling
  CRUISE_SPEED: 1.0,
  ORBIT_SPEED: 0.8,
  // Height over the highest ground around the circle
  ORBIT_CLEARANCE: 120,
  ORBIT_SAMPLES: 12,
};

const A = AUTOPILOT;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// The heading (rotation.y) that points from (x, z) toward (tx, tz): heading
// 0 looks down -Z
export function headingTo(x, z, tx, tz) {
  return Math.atan2(-(tx - x), -(tz - z));
}

/**
 * The autopilot's flying: the circle it's on, the height it's holding, and
 * its vertical speed. `groundAt(x, z)` is the height to clear there (the
 * water's surface over water).
 */
export class AutopilotCore {
  constructor(groundAt) {
    this.groundAt = groundAt;
    this.reset();
  }

  // Forgets the route
  reset() {
    this.heldAlt = null; // The height being flown to (y), eased down, not up
    this.lastY = null; // For the vertical speed
    this.verticalSpeed = 0;
    this.scanTimer = 0;
    this.orbit = null; // The circle being flown (startOrbit)
  }

  /** Whether (x, z) is close enough to `target` to start circling it. */
  reached(x, z, target) {
    return (
      !this.orbit &&
      !!target &&
      Math.hypot(target.x - x, target.z - z) < A.ORBIT_RADIUS
    );
  }

  /** Whether a circle that isn't loitering has gone all the way round. */
  get lapDone() {
    return (
      !!this.orbit &&
      !this.orbit.loiter &&
      Math.abs(this.orbit.swept) >= Math.PI * 2
    );
  }

  // The height needed now at (x, z) to clear the ground along a heading, at
  // the climb slope: a peak far ahead needs less height now than one close by
  heightAlong(x, z, heading, range = A.LOOK_AHEAD) {
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    // Across the track (to the right)
    const sx = -fz;
    const sz = fx;
    let needed = A.CRUISE_FLOOR;
    for (
      let d = 0;
      d <= range;
      d += d < A.NEAR_AHEAD ? A.NEAR_STEP : A.SCAN_STEP
    ) {
      const cx = x + fx * d;
      const cz = z + fz * d;
      const ground =
        d <= A.NEAR_AHEAD
          ? Math.max(
              this.groundAt(cx, cz),
              this.groundAt(cx + sx * A.SIDE_OFFSET, cz + sz * A.SIDE_OFFSET),
              this.groundAt(cx - sx * A.SIDE_OFFSET, cz - sz * A.SIDE_OFFSET)
            )
          : this.groundAt(cx, cz);
      const h = ground + A.CLEARANCE - d * A.CLIMB_SLOPE;
      if (h > needed) needed = h;
    }
    return needed;
  }

  /**
   * Starts circling `spot` from a plane at (x, z) heading `yaw`; `loiter`
   * keeps circling, otherwise lapDone turns true after one lap.
   */
  startOrbit(spot, x, z, yaw, loiter) {
    // Turn the way that's closer to the current heading
    const out = headingTo(spot.x, spot.z, x, z);
    const dir =
      Math.abs(wrapAngle(yaw - (out + Math.PI / 2))) <
      Math.abs(wrapAngle(yaw - (out - Math.PI / 2)))
        ? 1
        : -1;
    // One height all the way around, over the highest ground on the circle
    let top = this.groundAt(spot.x, spot.z);
    for (let i = 0; i < A.ORBIT_SAMPLES; i++) {
      const a = (i / A.ORBIT_SAMPLES) * Math.PI * 2;
      top = Math.max(
        top,
        this.groundAt(
          spot.x + Math.cos(a) * A.ORBIT_RADIUS,
          spot.z + Math.sin(a) * A.ORBIT_RADIUS
        )
      );
    }
    this.orbit = {
      x: spot.x,
      z: spot.z,
      alt: top + A.ORBIT_CLEARANCE,
      dir,
      loiter,
      swept: 0, // How far around it's flown (radians)
      lastOut: out,
    };
  }

  /**
   * One frame of flying, for a plane at {x, y, z} heading `yaw` at
   * `speedKts` with the agility of its handling, toward `target` ({x, z},
   * or null to fly straight on) unless circling. Returns the roll, pitch
   * and speed (multiplier) to aim for.
   */
  update({x, y, z, yaw, speedKts, agility, target, delta}) {
    // Heading, and the roll toward it plus a steady bank to hold a turn
    let heading = yaw;
    let roll = 0;
    const steer = (h, bank = 0) =>
      clamp(wrapAngle(h - yaw) * 1.5 + bank, -A.MAX_ROLL, A.MAX_ROLL);
    const orbit = this.orbit;
    if (orbit) {
      const out = headingTo(orbit.x, orbit.z, x, z);
      orbit.swept += wrapAngle(out - orbit.lastOut) * orbit.dir;
      orbit.lastOut = out;
      // Along the circle, leaning in or out to hold its radius
      const dist = Math.hypot(x - orbit.x, z - orbit.z);
      const correction = clamp(
        (dist - A.ORBIT_RADIUS) / A.ORBIT_RADIUS,
        -0.8,
        0.8
      );
      heading = out + orbit.dir * (Math.PI / 2 + correction);
      // The bank that turns at the circle's rate (the flight model yaws 1.5
      // radians per second for each radian of roll, scaled by the plane's
      // agility; the orbit is slow enough to turn at full rate)
      const bank = (orbit.dir * speedKts) / A.ORBIT_RADIUS / (1.5 * agility);
      roll = steer(heading, bank);
    } else if (target) {
      heading = headingTo(x, z, target.x, target.z);
      roll = steer(heading);
    }

    // Height: over the ground ahead, or the circle's set height
    this.scanTimer -= delta;
    if (this.heldAlt === null || this.scanTimer <= 0) {
      this.scanTimer = A.SCAN_INTERVAL;
      let needed;
      if (orbit) {
        needed = orbit.alt;
      } else {
        // Far ahead along the course to the target, where it's going; along
        // the current heading only as far as it flies before turning onto
        // that course (a glance down a heading mid-turn would otherwise
        // climb over the volcano across the bay)
        needed = this.heightAlong(x, z, heading);
        if (Math.abs(wrapAngle(heading - yaw)) > 0.2) {
          needed = Math.max(
            needed,
            this.heightAlong(x, z, yaw, A.TURN_LOOK_AHEAD)
          );
        }
      }
      // Climb as needed; come down only once well clear, and gradually
      if (this.heldAlt === null || needed > this.heldAlt) {
        this.heldAlt = needed;
      } else if (this.heldAlt - needed > A.DESCENT_MARGIN) {
        this.heldAlt -= A.DESCENT_RATE * A.SCAN_INTERVAL;
      }
    }
    if (this.lastY !== null && delta > 0) {
      // Smoothed, so a frame's jitter doesn't twitch the pitch
      const k = 1 - Math.exp(-delta * 4);
      this.verticalSpeed += ((y - this.lastY) / delta - this.verticalSpeed) * k;
    }
    this.lastY = y;
    const pitch = clamp(
      (this.heldAlt - y) * A.PITCH_PER_UNIT -
        this.verticalSpeed * A.PITCH_DAMPING,
      -A.MAX_DESCENT,
      A.MAX_CLIMB
    );

    return {roll, pitch, speed: orbit ? A.ORBIT_SPEED : A.CRUISE_SPEED};
  }
}
