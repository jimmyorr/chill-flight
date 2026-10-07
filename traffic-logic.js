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
// Height above the ground they keep. They look ahead to climb before a hill
// rather than into it, turn toward lower ground when a mountain is far above
// them, and never dip below MIN_CLEARANCE over the ground beneath.
export const GROUND_CLEARANCE = 150;
export const MIN_CLEARANCE = 40;
const LOOK_AHEAD = [300, 700, 1200];
const MAX_CLIMB_RATE = 45; // units/s
const MAX_SINK_RATE = 15;
const AVOID_HEIGHT = 400; // ground this far above them ahead: turn away
const AVOID_LOOK = 900;
const AVOID_ANGLE = 0.6;
const AVOID_TURN_RATE = 0.15; // rad/s
// Gentle wandering: the turn rate drifts between ±MAX_TURN_RATE (rad/s)
const MAX_TURN_RATE = 0.08;
const MAX_BANK = 0.35; // radians

export const TRAFFIC_TYPES = ['classic', 'biplane', 'twin', 'glider'];

// Cruising speed range per type, in units per second, which the HUD shows as
// knots (the player starts at 150). All above 100: below that the player's
// plane sinks (flight-physics.js), so a slower plane holding its height would
// look wrong.
const SPEEDS = {
  classic: [120, 150],
  biplane: [105, 125],
  twin: [140, 170],
  glider: [105, 120],
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
  return {
    x,
    y: cruiseAlt,
    z,
    heading,
    pitch: 0,
    bank: 0,
    speed,
    cruiseAlt,
    type,
    livery: Math.floor(rng() * liveryCount),
    // The wander: turn rate follows a slow sine of its own frequency and phase
    turnFreq: lerp(0.03, 0.08, rng()),
    turnPhase: rng() * Math.PI * 2,
    turnAmount: lerp(0.3, 1, rng()),
    age: 0,
  };
}

// Ground height at a distance ahead along a heading
function groundAhead(p, heading, dist, elevationAt) {
  const f = forwardOf(heading);
  return elevationAt(p.x + f.x * dist, p.z + f.z * dist);
}

// Advances a plane by dt seconds, in place.
export function stepTrafficPlane(p, dt, elevationAt) {
  p.age += dt;

  let ground = elevationAt(p.x, p.z);
  for (const dist of LOOK_AHEAD) {
    ground = Math.max(ground, groundAhead(p, p.heading, dist, elevationAt));
  }
  const targetY = Math.max(p.cruiseAlt, ground + GROUND_CLEARANCE);

  let turnRate =
    MAX_TURN_RATE *
    p.turnAmount *
    Math.sin(p.turnPhase + p.age * p.turnFreq * Math.PI * 2);
  // A mountain ahead: turn toward the lower side (heading increasing turns
  // left)
  if (targetY - p.y > AVOID_HEIGHT) {
    const left = groundAhead(
      p,
      p.heading + AVOID_ANGLE,
      AVOID_LOOK,
      elevationAt
    );
    const right = groundAhead(
      p,
      p.heading - AVOID_ANGLE,
      AVOID_LOOK,
      elevationAt
    );
    turnRate = left <= right ? AVOID_TURN_RATE : -AVOID_TURN_RATE;
  }
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

  const climb = clamp((targetY - p.y) * 0.5, -MAX_SINK_RATE, MAX_CLIMB_RATE);
  p.y = Math.max(p.y + climb * dt, elevationAt(p.x, p.z) + MIN_CLEARANCE);
  p.pitch = Math.atan2(climb, p.speed);
  return p;
}

export function isTrafficPlaneGone(p, centerX, centerZ) {
  const dx = p.x - centerX;
  const dz = p.z - centerZ;
  return dx * dx + dz * dz > DESPAWN_DISTANCE * DESPAWN_DISTANCE;
}
