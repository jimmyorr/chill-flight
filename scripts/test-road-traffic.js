#!/usr/bin/env node
/**
 * scripts/test-road-traffic.js
 *
 * Checks the buggies driving the highways (road-traffic-logic.js): they
 * appear near the player in the right-hand lane, slow for bends, the car
 * ahead and the player on the road (with brake lights), turn round where a
 * highway ends, ease back into their lane after a bump and are removed once
 * they're well behind. Runs on made-up roads, not the real world.
 */
import {
  DESPAWN_DISTANCE,
  FAST,
  LANE_INNER,
  LANE_OUTER,
  SPAWN_DISTANCE_MAX,
  SPAWN_DISTANCE_MIN,
  STOP_GAP,
  brakeLightsOn,
  bumpRoadCar,
  forwardOf,
  isRoadCarGone,
  spawnRoadCar,
  stepRoadCar,
} from '../road-traffic-logic.js';

console.log('Testing road traffic...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One north-south highway (n 0) along z, its centre at x = line(z), built
// between zMin and zMax, with a flat deck at height 50
function makeRoads(line, zMin = -1e6, zMax = 1e6) {
  return {
    near: () => [{n: 0, along: 0}],
    center: (n, along) => line(along),
    point: (n, along, across, out = {}) => {
      out.x = across;
      out.z = along;
      return out;
    },
    runs: (n, along) => along >= zMin && along <= zMax,
    surface: () => ({height: 50, slopeX: 0, slopeZ: 0}),
  };
}
const straight = makeRoads(() => 0);

// Distance from the centre line to the right of the way it's driving
function laneOffset(car, roads) {
  const f = forwardOf(car.heading);
  return (car.x - roads.center(0, car.z)) * -f.z;
}

function run(car, roads, seconds, cars = [car], player = null, each) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    for (const c of cars) stepRoadCar(c, dt, roads, cars, player);
    each?.(t);
  }
}

// Spawning
const rng = mulberry32(3);
const spawned = [];
for (let i = 0; i < 200; i++) {
  const c = spawnRoadCar(rng, 300, 0, straight, 8);
  if (c) spawned.push(c);
}
check('cars spawn on a nearby highway', spawned.length > 150);
const dists = spawned.map((c) => Math.hypot(c.x - 300, c.z));
check(
  'cars appear between the spawn distances',
  dists.every((d) => d >= SPAWN_DISTANCE_MIN && d <= SPAWN_DISTANCE_MAX),
  `${Math.min(...dists)}..${Math.max(...dists)}`
);
check(
  'cars drive both ways',
  spawned.some((c) => c.dir > 0) && spawned.some((c) => c.dir < 0)
);
check(
  'cars keep to the right-hand lane',
  spawned.every((c) => Math.abs(laneOffset(c, straight) - c.lane) < 0.01)
);
check(
  'slower cars keep to the outside lane, faster ones the inside',
  spawned.every(
    (c) => c.lane === (c.cruise > FAST ? LANE_INNER : LANE_OUTER)
  ) &&
    spawned.some((c) => c.lane === LANE_INNER) &&
    spawned.some((c) => c.lane === LANE_OUTER)
);
check(
  'no car when no highway is near',
  spawnRoadCar(rng, 300, 0, {...straight, near: () => []}, 8) === null
);
check(
  'no car on a highway too far off',
  spawnRoadCar(rng, 5000, 0, straight, 8) === null
);

// Cruising on a straight road
{
  const car = spawnRoadCar(mulberry32(5), 0, 0, straight, 8);
  const z0 = car.z;
  run(car, straight, 5);
  check(
    'a car cruises along its lane',
    Math.abs(Math.abs(car.z - z0) - car.cruise * 5) < 1 &&
      Math.abs(laneOffset(car, straight) - car.lane) < 0.01,
    `moved ${Math.abs(car.z - z0)}`
  );
  check('no brake lights cruising', !brakeLightsOn(car));
  const f = forwardOf(car.heading);
  check('it faces the way it drives', Math.sign(f.z) === car.dir);
}

// A tight bend
{
  const bendy = makeRoads((z) => 200 * Math.sin(z / 150));
  const car = spawnRoadCar(mulberry32(7), 0, 0, bendy, 8);
  let slowest = Infinity;
  let braked = false;
  let worstLane = 0;
  run(car, bendy, 30, [car], null, () => {
    slowest = Math.min(slowest, car.speed);
    braked ||= brakeLightsOn(car);
    worstLane = Math.max(
      worstLane,
      Math.abs(laneOffset(car, bendy) - car.lane)
    );
  });
  check(
    'a car slows for a tight bend, with brake lights',
    slowest < car.cruise - 10 && braked,
    `slowest ${slowest.toFixed(1)} of ${car.cruise.toFixed(1)}`
  );
  check(
    'and keeps near its lane round it',
    worstLane < 3,
    worstLane.toFixed(2)
  );
}

// Following the car ahead
{
  const r = mulberry32(9);
  const lead = spawnRoadCar(r, 0, 0, straight, 8);
  const back = {...lead, along: lead.along - lead.dir * 200, livery: 1};
  lead.cruise = lead.speed = 40;
  back.cruise = back.speed = 80;
  let closest = Infinity;
  let braked = false;
  run(lead, straight, 30, [lead, back], null, () => {
    closest = Math.min(closest, (lead.along - back.along) * lead.dir);
    braked ||= brakeLightsOn(back);
  });
  check(
    'a faster car slows behind a slower one without hitting it',
    closest > STOP_GAP - 2 && Math.abs(back.speed - 40) < 3 && braked,
    `closest ${closest.toFixed(1)}, speed ${back.speed.toFixed(1)}`
  );
}

// The player parked on the road ahead
{
  const car = spawnRoadCar(mulberry32(11), 0, 0, straight, 8);
  const f = forwardOf(car.heading);
  const at = (ahead, side) => ({
    x: car.x + f.x * ahead - f.z * side,
    y: car.y,
    z: car.z + f.z * ahead + f.x * side,
    vx: 0,
    vz: 0,
  });
  const player = at(400, 0);
  run(car, straight, 20, [car], player);
  const gap = (player.z - car.z) * car.dir;
  check(
    'a car stops behind the player on the road',
    car.speed < 1 && gap > STOP_GAP - 2 && gap < STOP_GAP + 10,
    `speed ${car.speed.toFixed(1)}, gap ${gap.toFixed(1)}`
  );
  check('with its brake lights on while stopped', brakeLightsOn(car));

  const other = spawnRoadCar(mulberry32(11), 0, 0, straight, 8);
  const beside = at(400, -2 * car.lane);
  const start = other.z;
  run(other, straight, 10, [other], beside);
  check(
    'but drives past the player in the other lane',
    Math.abs(other.z - start) > 500
  );
  const flier = spawnRoadCar(mulberry32(11), 0, 0, straight, 8);
  const above = {...at(400, 0), y: car.y + 100};
  run(flier, straight, 10, [flier], above);
  check('and under a plane flying over', Math.abs(flier.z - start) > 500);
}

// The road ends: it turns round into the other lane
{
  const ends = makeRoads(() => 0, -3000, 3000);
  const car = spawnRoadCar(mulberry32(13), 0, 0, ends, 8);
  car.dir = 1;
  car.along = 2500;
  let furthest = 0;
  let turned = false;
  run(car, ends, 60, [car], null, () => {
    furthest = Math.max(furthest, car.z);
    turned ||= car.dir < 0;
  });
  check(
    'a car turns round where its highway ends',
    turned && car.dir < 0 && car.z < 2500,
    `dir ${car.dir}, z ${car.z.toFixed(0)}`
  );
  check(
    'without driving off the end',
    furthest <= 3000 + car.lane,
    furthest.toFixed(1)
  );
  check(
    'and carries on in the right-hand lane the other way',
    Math.abs(laneOffset(car, ends) - car.lane) < 0.01 && car.speed > 50
  );
}

// A bump knocks it out of its lane, and it eases back
{
  const car = spawnRoadCar(mulberry32(15), 0, 0, straight, 8);
  const f = forwardOf(car.heading);
  const speed = car.speed;
  bumpRoadCar(car, {x: -f.z, z: f.x}, 0.9);
  run(car, straight, 0.1);
  const out = laneOffset(car, straight) - car.lane;
  run(car, straight, 5);
  const back = laneOffset(car, straight) - car.lane;
  check(
    'a bump knocks a car sideways and slows it',
    out > 4 && car.speed <= car.cruise && speed > 0,
    out.toFixed(2)
  );
  check('then it eases back into its lane', Math.abs(back) < 0.5);
}

// Gone once well behind
{
  const car = spawnRoadCar(mulberry32(17), 0, 0, straight, 8);
  check('a car nearby stays', !isRoadCarGone(car, 0, 0));
  check(
    "a car is removed once it's well off",
    isRoadCarGone(car, car.x + DESPAWN_DISTANCE + 1, car.z)
  );
}

if (failed) {
  console.log('Road traffic tests FAILED.');
  process.exit(1);
}
console.log('All road traffic tests passed.');
