// --- ROAD TRAFFIC: DRIVING LOGIC ---
// Pure math for the buggies driving the highways (road-traffic.js draws
// them): where one appears, how it keeps to its lane, slows for bends, the
// car ahead and the player, turns round where its highway ends, and when
// it's gone. No three.js or DOM, so scripts/test-road-traffic.js can run it
// in Node.
//
// Cars ride the highway's own line, not physics: a car is a highway n, a
// distance `along` it (z for the north-south ones, x for the cross-country
// one, as ChillFlightLogic.roadCenter has it), a direction (+1 or -1 along)
// and an offset to the right of the centre line (its lane). The `roads`
// passed in tells it about the world:
//   near(x, z): the highways near (x, z), [{n, along}]
//   center(n, along): the centre line's other coordinate (roadCenter)
//   point(n, along, across, out): the world {x, z} (roadPoint)
//   runs(n, along): whether the highway is built there (highwayRunsAt)
//   surface(x, z, y): the deck under (x, z) nearest height y, as
//     {height, slopeX, slopeZ}, or null where it isn't loaded

// Cars appear between these distances from the player (horizontally) and
// are removed past DESPAWN_DISTANCE
export const SPAWN_DISTANCE_MIN = 900;
export const SPAWN_DISTANCE_MAX = 2400;
export const DESPAWN_DISTANCE = 3200;
// The two lanes each way, right of the centre line: the middles of the
// highway's lanes (its lane lines are 15 out and the edge lines 28.5).
// Slower cars keep to the outside lane, faster ones (above FAST) the
// inside one.
export const LANE_OUTER = 21.5;
export const LANE_INNER = 7.5;
export const FAST = 72;
// Cruising speed range, units per second (shown as knots): well under the
// player's buggy (top 240) and the planes (100+), so you overtake them
export const CRUISE_MIN = 55;
export const CRUISE_MAX = 85;
// Sideways grip for bends: the speed a bend allows is sqrt(GRIP * radius)
const GRIP = 18;
const BEND_LOOK = 150; // along the road, how far ahead to judge a bend
// Following: look FOLLOW_GAP ahead for a car (or the player on the road),
// slowing at FOLLOW_DECEL to stop STOP_GAP behind it (FOLLOW_GAP leaves
// room to stop from CRUISE_MAX)
export const FOLLOW_GAP = 300;
export const STOP_GAP = 22;
const FOLLOW_DECEL = 14;
const PLAYER_WIDTH = 7; // half the corridor ahead the player blocks
const PLAYER_HEIGHT = 12; // ...and how far above or below the deck
// Speeding up and braking, units/s per second
const ACCEL = 9;
const BRAKE = 26;
// Brake lights come on above this much braking (0 to 1)
export const BRAKE_LIGHT = 0.15;
// Where the highway ends: slow from END_LOOK out and turn round at
// UTURN_AT, at UTURN_SPEED, on a half circle across to the same lane the
// other way
const END_LOOK = 260;
const UTURN_AT = 60;
export const UTURN_SPEED = 12;
// A bump's sideways kick fades back into the lane at this rate (per second)
const KICK_EASE = 1.5;
const KICK = 8;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Heading as the game uses it: 0 drives north (-z), PI / 2 west (-x)
export function forwardOf(heading) {
  return {x: -Math.sin(heading), z: -Math.cos(heading)};
}

// The road's direction at `along` heading `dir` (+1/-1): its unit vector in
// the world, and how far it goes per unit of `along`
const _p0 = {x: 0, z: 0};
const _p1 = {x: 0, z: 0};
function roadDir(roads, n, along, dir, out = {}) {
  roads.point(n, along - 1, roads.center(n, along - 1), _p0);
  roads.point(n, along + 1, roads.center(n, along + 1), _p1);
  const dx = (_p1.x - _p0.x) * dir;
  const dz = (_p1.z - _p0.z) * dir;
  const len = Math.hypot(dx, dz);
  out.x = dx / len;
  out.z = dz / len;
  out.stretch = len / 2;
  return out;
}

function headingOf(fx, fz) {
  return Math.atan2(-fx, -fz);
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Places a car in the world from its place on the road: x, z, heading
const _d = {x: 0, z: 0, stretch: 1};
const _c = {x: 0, z: 0};
function place(car, roads) {
  if (car.uturn) {
    // Round the half circle from this lane to the other, about the centre
    // line: f0 / r0 the way it was driving and its right at the start
    const u = car.uturn;
    const s = Math.sin(u.angle);
    const c = Math.cos(u.angle);
    car.x = u.cx + car.lane * (u.rx * c + u.fx * s);
    car.z = u.cz + car.lane * (u.rz * c + u.fz * s);
    car.heading = headingOf(u.fx * c - u.rx * s, u.fz * c - u.rz * s);
    return;
  }
  const d = roadDir(roads, car.n, car.along, car.dir, _d);
  roads.point(car.n, car.along, roads.center(car.n, car.along), _c);
  // Right of the way it's driving
  const off = car.lane + car.kick;
  car.x = _c.x - d.z * off;
  car.z = _c.z + d.x * off;
  car.heading = headingOf(d.x, d.z);
}

// The sharpest bend in the next BEND_LOOK along the road: the speed it
// allows
function bendSpeed(car, roads) {
  const a = roadDir(roads, car.n, car.along, car.dir, {});
  const h0 = headingOf(a.x, a.z);
  let limit = Infinity;
  for (let d = 50; d <= BEND_LOOK; d += 50) {
    const b = roadDir(roads, car.n, car.along + car.dir * d, car.dir, {});
    const turn = Math.abs(wrap(headingOf(b.x, b.z) - h0));
    if (turn < 0.01) continue;
    const radius = (d * a.stretch) / turn;
    limit = Math.min(limit, Math.sqrt(GRIP * radius));
  }
  return limit;
}

// The speed to keep d behind something going `speed`: no faster than lets
// it slow at FOLLOW_DECEL to that speed by STOP_GAP behind
function followSpeed(d, speed, cruise) {
  const room = Math.max(0, d - STOP_GAP);
  return Math.min(
    cruise,
    Math.max(0, speed) + Math.sqrt(2 * FOLLOW_DECEL * room)
  );
}

/**
 * A new car near the player at (px, pz), or null if no highway is near
 * enough. rng() returns [0, 1); liveryCount is how many liveries to pick
 * from; cars is the list already driving (a new one keeps clear of them).
 */
export function spawnRoadCar(rng, px, pz, roads, liveryCount, cars = []) {
  const lines = roads.near(px, pz).filter(({n, along}) => {
    const p = roads.point(n, along, roads.center(n, along), {});
    return Math.hypot(p.x - px, p.z - pz) < SPAWN_DISTANCE_MAX - 200;
  });
  if (!lines.length) return null;
  for (let tries = 0; tries < 6; tries++) {
    const {n, along: a0} = lines[Math.floor(rng() * lines.length)];
    const along =
      a0 +
      (rng() < 0.5 ? -1 : 1) *
        lerp(SPAWN_DISTANCE_MIN, SPAWN_DISTANCE_MAX, rng());
    const dir = rng() < 0.5 ? -1 : 1;
    // On the road, with road ahead of it
    if (!roads.runs(n, along) || !roads.runs(n, along + dir * END_LOOK)) {
      continue;
    }
    const cruise = lerp(CRUISE_MIN, CRUISE_MAX, rng());
    const lane = cruise > FAST ? LANE_INNER : LANE_OUTER;
    const car = {
      n,
      along,
      dir,
      lane,
      kick: 0,
      speed: cruise,
      cruise,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      pitch: 0,
      steer: 0,
      brake: 0,
      uturn: null,
      livery: Math.floor(rng() * liveryCount),
      age: 0,
    };
    place(car, roads);
    const dist = Math.hypot(car.x - px, car.z - pz);
    if (dist < SPAWN_DISTANCE_MIN || dist > SPAWN_DISTANCE_MAX) continue;
    // Not on top of another car in its lane
    if (
      cars.some(
        (o) =>
          o.n === n && o.dir === dir && Math.abs(o.along - along) < FOLLOW_GAP
      )
    ) {
      continue;
    }
    const s = roads.surface(car.x, car.z, null);
    car.y = s ? s.height : 0;
    car.grounded = !!s;
    return car;
  }
  return null;
}

// What's ahead of the car in its lane: the nearest car going its way, or
// the player on the road. Returns the speed that keeps clear of them.
function trafficSpeed(car, cars, player, cruise) {
  let limit = Infinity;
  for (const o of cars) {
    if (o === car || o.n !== car.n || o.dir !== car.dir || o.uturn) continue;
    if (o.lane !== car.lane) continue;
    const d = (o.along - car.along) * car.dir;
    if (d <= 0 || d > FOLLOW_GAP) continue;
    limit = Math.min(limit, followSpeed(d, o.speed, cruise));
  }
  if (player) {
    const f = forwardOf(car.heading);
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const ahead = dx * f.x + dz * f.z;
    const side = Math.abs(dx * -f.z + dz * f.x);
    if (
      ahead > 0 &&
      ahead < FOLLOW_GAP &&
      side < PLAYER_WIDTH &&
      Math.abs(player.y - car.y) < PLAYER_HEIGHT
    ) {
      const along = player.vx * f.x + player.vz * f.z;
      limit = Math.min(limit, followSpeed(ahead, along, cruise));
    }
  }
  return limit;
}

/**
 * Advances a car by dt seconds, in place. cars is every car driving (for
 * following); player ({x, y, z, vx, vz}, or null) is slowed for when it's
 * on the road ahead.
 */
export function stepRoadCar(car, dt, roads, cars = [], player = null) {
  car.age += dt;
  const was = car.speed;
  const prevHeading = car.heading;

  if (car.uturn) {
    // Round at walking pace, then carry on the other way
    car.speed += (UTURN_SPEED - car.speed) * Math.min(1, dt * 2);
    car.uturn.angle += (car.speed / car.lane) * dt;
    if (car.uturn.angle >= Math.PI) {
      car.dir = -car.dir;
      car.uturn = null;
    }
  } else {
    let target = Math.min(car.cruise, bendSpeed(car, roads));
    target = Math.min(target, trafficSpeed(car, cars, player, car.cruise));
    // The road ends ahead: slow to turn round, and turn at the end
    if (!roads.runs(car.n, car.along + car.dir * END_LOOK)) {
      let end = UTURN_AT;
      while (end < END_LOOK && roads.runs(car.n, car.along + car.dir * end)) {
        end += 20;
      }
      target = Math.min(
        target,
        lerp(UTURN_SPEED, car.cruise, clamp((end - UTURN_AT) / 200, 0, 1))
      );
      if (end <= UTURN_AT) {
        const f = forwardOf(car.heading);
        roads.point(car.n, car.along, roads.center(car.n, car.along), _c);
        car.uturn = {
          angle: 0,
          cx: _c.x,
          cz: _c.z,
          fx: f.x,
          fz: f.z,
          rx: -f.z,
          rz: f.x,
        };
        car.kick = 0;
      }
    }
    const rate = target < car.speed ? BRAKE : ACCEL;
    car.speed += clamp(target - car.speed, -rate * dt, rate * dt);
    if (!car.uturn) {
      const d = roadDir(roads, car.n, car.along, car.dir, _d);
      car.along += (car.dir * car.speed * dt) / d.stretch;
    }
  }
  // A bump's kick, easing back into the lane
  if (car.kick) {
    car.kick *= Math.exp(-KICK_EASE * dt);
    if (Math.abs(car.kick) < 0.05) car.kick = 0;
  }

  place(car, roads);

  // Braking: how hard it's slowing, for the brake lights (eased, and on
  // while stopped behind something)
  const decel = dt > 0 ? (was - car.speed) / dt : 0;
  const braking =
    decel > 2 || (car.speed < 1 && !car.uturn) ? clamp(decel / 12, 0.5, 1) : 0;
  car.brake += (braking - car.brake) * Math.min(1, dt * 8);
  // Front wheels follow the turn rate
  const turnRate = dt > 0 ? wrap(car.heading - prevHeading) / dt : 0;
  const steer = clamp((turnRate * 4.5) / Math.max(car.speed, 5), -0.5, 0.5);
  car.steer += (steer - car.steer) * Math.min(1, dt * 6);

  // On the deck, pitched with it
  const s = roads.surface(car.x, car.z, car.grounded ? car.y : null);
  if (s) {
    car.y = s.height;
    car.grounded = true;
    const f = forwardOf(car.heading);
    const pitch = Math.atan(s.slopeX * f.x + s.slopeZ * f.z);
    car.pitch += (pitch - car.pitch) * Math.min(1, dt * 10);
  }
  return car;
}

// A bump (bumps.js): kicked up to KICK sideways out of its lane by push's
// sideways part (push is about a unit long), and slowed
export function bumpRoadCar(car, push, keep) {
  const f = forwardOf(car.heading);
  const side = push.x * -f.z + push.z * f.x;
  car.kick = clamp(car.kick + side * KICK, -LANE_INNER, LANE_INNER);
  car.speed *= keep;
}

export function isRoadCarGone(car, px, pz) {
  return Math.hypot(car.x - px, car.z - pz) > DESPAWN_DISTANCE;
}

// Whether its brake lights are on
export function brakeLightsOn(car) {
  return car.brake > BRAKE_LIGHT;
}
