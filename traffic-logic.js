// --- AIR TRAFFIC: FLIGHT LOGIC ---
// Pure math for the other planes in the sky (traffic.js draws them): where one
// appears, how it wanders and keeps clear of the ground, and when it's gone.
// No three.js or DOM, so scripts/test-traffic.js can run it in Node.

// Planes appear this far from the player (far enough to be specks in the haze)
// and are removed past DESPAWN_DISTANCE.
export const SPAWN_DISTANCE_MIN = 4500;
export const SPAWN_DISTANCE_MAX = 6000;
export const DESPAWN_DISTANCE = 8000;
// They head for a point within this distance of the player, so their path
// crosses the player's part of the sky.
export const AIM_RADIUS = 2000;
// Height above the ground they keep. Like the player's autopilot
// (autopilot.js), they scan far ahead along their course to start a gentle
// climb early, hold their height across valleys before easing back down,
// turn toward lower ground when a tall peak is ahead, and never dip below
// MIN_CLEARANCE over the ground beneath.
export const GROUND_CLEARANCE = 160;
export const MIN_CLEARANCE = 40;
const LOOK_AHEAD = 9000;
const SCAN_STEP = 300;
const NEAR_AHEAD = 1500;
const NEAR_STEP = 150;
const SIDE_OFFSET = 250;
const CLIMB_SLOPE = 0.12; // rise per unit flown (~7 degrees)
const SCAN_INTERVAL = 0.25; // seconds between terrain scans
const DESCENT_MARGIN = 100; // hold height until this far above needed
const DESCENT_RATE = 18; // units/s (~7 degrees at cruise)
const MAX_CLIMB_RATE = 45; // units/s
const MAX_SINK_RATE = 18;
const CLIMB_GAIN = 0.4; // target vertical speed per unit of altitude error
const VERTICAL_EASE = 2.5; // per second: overdamped so climbs ease off without overshoot
const AVOID_HEIGHT = 400; // ground this far above them ahead: turn away
const AVOID_LOOK = 2500;
const AVOID_ANGLE = 0.6;
const AVOID_TURN_RATE = 0.15; // rad/s
// Gentle wandering: the turn rate drifts between ±MAX_TURN_RATE (rad/s)
const MAX_TURN_RATE = 0.08;
const MAX_BANK = 0.35; // radians

export const TRAFFIC_TYPES = ['seaplane', 'biplane', 'twin'];

// Pacing, so the player can find a plane and follow it around: within
// PACE_RADIUS of the player a plane flies at the player's speed, a little
// slower when it's ahead of them (up to PACE_OFFSET slower, so they catch
// up) or faster when it's behind, matching exactly within PACE_CLOSE. It
// eases there over a couple of seconds, and back to its own cruising speed
// once the player is gone. Never below MIN_SPEED, where planes sink.
export const PACE_RADIUS = 800;
export const PACE_CLOSE = 150;
export const PACE_OFFSET = 40;
export const MIN_SPEED = 100;
export const MAX_SPEED = 220;
const PACE_EASE = 0.6; // per second

// Cruising speed range per type, in units per second, which the HUD shows as
// knots (the player starts at 150). All above 100: below that the player's
// plane sinks (flight-physics.js), so a slower plane holding its height would
// look wrong.
const SPEEDS = {
  seaplane: [120, 150],
  biplane: [105, 125],
  twin: [140, 170],
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Heading as the game uses it: 0 flies north (-z), PI / 2 flies west (-x)
export function forwardOf(heading) {
  return {x: -Math.sin(heading), z: -Math.cos(heading)};
}

export function headingToward(fromX, fromZ, toX, toZ) {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

// The height needed now to clear the ground along a heading, at the climb
// slope: a peak far ahead needs less height now than one close by (as in
// autopilot.js)
function heightAlong(p, heading, elevationAt, range = LOOK_AHEAD) {
  const {x: fx, z: fz} = forwardOf(heading);
  // Across the track (to the right)
  const sx = -fz;
  const sz = fx;
  let needed = p.cruiseAlt;
  for (let d = 0; d <= range; d += d < NEAR_AHEAD ? NEAR_STEP : SCAN_STEP) {
    const cx = p.x + fx * d;
    const cz = p.z + fz * d;
    const ground =
      d <= NEAR_AHEAD
        ? Math.max(
            elevationAt(cx, cz),
            elevationAt(cx + sx * SIDE_OFFSET, cz + sz * SIDE_OFFSET),
            elevationAt(cx - sx * SIDE_OFFSET, cz - sz * SIDE_OFFSET)
          )
        : elevationAt(cx, cz);
    const h = ground + GROUND_CLEARANCE - d * CLIMB_SLOPE;
    if (h > needed) needed = h;
  }
  return needed;
}

// A new plane around (centerX, centerZ). rng() returns [0, 1); elevationAt
// (x, z) gives the ground height. liveryCount is how many liveries to pick
// from. (velX, velZ) is the player's velocity in units/s: the plane aims for
// where the player will be when it gets there, so their paths cross.
export function spawnTrafficPlane(
  rng,
  centerX,
  centerZ,
  elevationAt,
  liveryCount,
  velX = 0,
  velZ = 0
) {
  const angle = rng() * Math.PI * 2;
  const dist = lerp(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX, rng());
  const x = centerX + Math.cos(angle) * dist;
  const z = centerZ + Math.sin(angle) * dist;

  const type = TRAFFIC_TYPES[Math.floor(rng() * TRAFFIC_TYPES.length)];
  const [minSpeed, maxSpeed] = SPEEDS[type];
  const speed = lerp(minSpeed, maxSpeed, rng());

  const lead = dist / speed;
  const aimAngle = rng() * Math.PI * 2;
  const aimDist = rng() * AIM_RADIUS;
  const heading = headingToward(
    x,
    z,
    centerX + velX * lead + Math.cos(aimAngle) * aimDist,
    centerZ + velZ * lead + Math.sin(aimAngle) * aimDist
  );

  const cruiseAlt = Math.max(
    lerp(350, 900, rng()),
    elevationAt(x, z) + GROUND_CLEARANCE + 50
  );
  const y = heightAlong({x, z, cruiseAlt}, heading, elevationAt, LOOK_AHEAD);
  return {
    x,
    y,
    z,
    heading,
    pitch: 0,
    bank: 0,
    speed,
    cruiseSpeed: speed,
    cruiseAlt,
    heldAlt: null,
    verticalSpeed: 0,
    scanTimer: 0,
    avoidTurn: 0,
    type,
    livery: Math.floor(rng() * liveryCount),
    // The wander: turn rate follows a slow sine of its own frequency and phase
    turnFreq: lerp(0.03, 0.08, rng()),
    turnPhase: rng() * Math.PI * 2,
    turnAmount: lerp(0.3, 1, rng()),
    age: 0,
  };
}

// The speed a plane eases toward: its cruising speed, or paced to the
// player's when they're near. player is {x, y, z, speed}, or null.
export function targetSpeed(p, player) {
  if (!player) return p.cruiseSpeed;
  const dx = p.x - player.x;
  const dy = p.y - player.y;
  const dz = p.z - player.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > PACE_RADIUS) return p.cruiseSpeed;
  // Ahead of the player along the plane's own course: slow down; behind:
  // speed up
  const fwd = forwardOf(p.heading);
  const ahead = dx * fwd.x + dz * fwd.z > 0 ? -1 : 1;
  const gap = clamp((dist - PACE_CLOSE) / (PACE_RADIUS - PACE_CLOSE), 0, 1);
  return clamp(player.speed + ahead * PACE_OFFSET * gap, MIN_SPEED, MAX_SPEED);
}

// Advances a plane by dt seconds, in place. player ({x, y, z, speed}, or
// null) is for pacing.
export function stepTrafficPlane(p, dt, elevationAt, player = null) {
  p.age += dt;
  p.speed += (targetSpeed(p, player) - p.speed) * Math.min(1, dt * PACE_EASE);

  const phase = p.turnPhase + p.age * p.turnFreq * Math.PI * 2;
  // Mean course without the sinusoidal wander, so a temporary weave doesn't
  // scan 9 km off to the side
  const course = p.turnFreq
    ? p.heading +
      ((MAX_TURN_RATE * p.turnAmount) / (p.turnFreq * Math.PI * 2)) *
        Math.cos(phase)
    : p.heading;

  p.scanTimer = (p.scanTimer ?? 0) - dt;
  if (p.heldAlt == null || p.scanTimer <= 0) {
    p.scanTimer = SCAN_INTERVAL;
    const nearAhead = heightAlong(p, p.heading, elevationAt, AVOID_LOOK);
    let needed;
    // A mountain ahead: turn toward the lower flank if one side is lower
    // (heading increasing turns left)
    if (nearAhead - p.y > AVOID_HEIGHT) {
      const left = heightAlong(
        p,
        p.heading + AVOID_ANGLE,
        elevationAt,
        AVOID_LOOK
      );
      const right = heightAlong(
        p,
        p.heading - AVOID_ANGLE,
        elevationAt,
        AVOID_LOOK
      );
      if (Math.min(left, right) < nearAhead - 50) {
        p.avoidTurn = left <= right ? AVOID_TURN_RATE : -AVOID_TURN_RATE;
        needed = Math.max(
          heightAlong(p, p.heading, elevationAt, NEAR_AHEAD),
          Math.min(left, right)
        );
      } else {
        p.avoidTurn = 0;
        needed = Math.max(
          nearAhead,
          heightAlong(p, course, elevationAt, LOOK_AHEAD)
        );
      }
    } else {
      p.avoidTurn = 0;
      needed = Math.max(
        nearAhead,
        heightAlong(p, course, elevationAt, LOOK_AHEAD)
      );
    }
    // Climb as needed; hold height across valleys until well clear, then
    // descend gradually
    if (p.heldAlt == null) {
      p.heldAlt = Math.max(p.y, needed);
    } else if (needed > p.heldAlt) {
      p.heldAlt = needed;
    } else if (p.heldAlt - needed > DESCENT_MARGIN) {
      p.heldAlt -= DESCENT_RATE * SCAN_INTERVAL;
    }
  }

  const turnRate =
    p.avoidTurn || MAX_TURN_RATE * p.turnAmount * Math.sin(phase);
  p.heading += turnRate * dt;
  // Bank into the turn (turning left, heading increasing, rolls left)
  const targetBank = clamp(
    (turnRate / MAX_TURN_RATE) * MAX_BANK,
    -MAX_BANK * 1.5,
    MAX_BANK * 1.5
  );
  p.bank += (targetBank - p.bank) * Math.min(1, dt * 1.5);

  const fwd = forwardOf(p.heading);
  p.x += fwd.x * p.speed * dt;
  p.z += fwd.z * p.speed * dt;

  const desiredClimb = clamp(
    (p.heldAlt - p.y) * CLIMB_GAIN,
    -MAX_SINK_RATE,
    MAX_CLIMB_RATE
  );
  const k = 1 - Math.exp(-dt * VERTICAL_EASE);
  p.verticalSpeed =
    (p.verticalSpeed ?? 0) + (desiredClimb - (p.verticalSpeed ?? 0)) * k;
  p.y = Math.max(
    p.y + p.verticalSpeed * dt,
    elevationAt(p.x, p.z) + MIN_CLEARANCE
  );
  p.pitch = Math.atan2(p.verticalSpeed, p.speed);
  return p;
}

export function isTrafficPlaneGone(p, centerX, centerZ) {
  const dx = p.x - centerX;
  const dz = p.z - centerZ;
  return dx * dx + dz * dz > DESPAWN_DISTANCE * DESPAWN_DISTANCE;
}
