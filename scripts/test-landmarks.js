#!/usr/bin/env node
/**
 * scripts/test-landmarks.js
 *
 * Checks the map's places (landmarks.js): a tap near a landmark or airport
 * picks the nearest one in reach, and warping to one arrives in view of it.
 * At an airport that's lined up on final approach to the end planes land
 * from, low and slow; at another landmark it's back from it on the side
 * you're coming from, facing it and clear of the ground; anywhere else it's
 * above the spot with the heading and speed kept.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';

// The Rock Arch's place comes from the seed when landmarks.js loads
ChillFlightLogic.WORLD_SEED = 20260101;
const {
  AIRPORT_COLOR,
  APPROACH_DISTANCE,
  APPROACH_HEIGHT,
  APPROACH_SPEED,
  LANDMARK_COLOR,
  LANDMARKS,
  VIEW_CLEARANCE,
  VIEW_DISTANCE,
  WARP_HEIGHT,
  BUGGY_PARK_SLOPE,
  BUGGY_RUNWAY_IN,
  BUGGY_VIEW,
  arrivalAt,
  buggyArrivalAt,
  nearestLandmark,
} = await import('../landmarks.js');

console.log('Testing map places...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
    failed = true;
  }
}

// Made-up rolling hills with a ridge, so the checks don't depend on the
// terrain generator
const groundAt = (x, z) =>
  60 +
  80 * Math.sin(x / 700) * Math.cos(z / 900) +
  (Math.abs(x) < 300 ? 500 : 0);
const highest = (x0, z0, x1, z1) => {
  let high = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    high = Math.max(high, groundAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t));
  }
  return high;
};
const forward = (yaw) => ({x: -Math.sin(yaw), z: -Math.cos(yaw)});
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

const meadow = LANDMARKS.find((l) => l.name === 'Meadow Field');
check(
  'a tap near a pin picks that place',
  nearestLandmark(meadow.x + 100, meadow.z - 50, 200) === meadow
);
check(
  'a tap out of reach picks nothing',
  nearestLandmark(meadow.x + 300, meadow.z, 200) === null
);
check(
  'a tap by any place picks it, not another',
  LANDMARKS.every((l) => nearestLandmark(l.x + 10, l.z - 10, 1e9) === l)
);
const airportNames = new Set(ChillFlightLogic.AIRPORTS.map((a) => a.name));
check(
  'airports share one pin color and landmarks share another',
  AIRPORT_COLOR !== LANDMARK_COLOR &&
    LANDMARKS.every(
      (l) =>
        l.color === (airportNames.has(l.name) ? AIRPORT_COLOR : LANDMARK_COLOR)
    )
);

const problems = [];
for (const airport of ChillFlightLogic.AIRPORTS) {
  const at = arrivalAt({...airport}, 0, 0, groundAt);
  const along = {x: Math.cos(airport.angle), z: Math.sin(airport.angle)};
  const end = ChillFlightLogic.RUNWAY_LENGTH / 2;
  const toField = {x: airport.x - at.x, z: airport.z - at.z};
  const dist = Math.hypot(toField.x, toField.z);
  const f = forward(at.yaw);
  if (!near(dist, end + APPROACH_DISTANCE, 1e-3)) {
    problems.push(`${airport.name}: ${dist.toFixed(0)} from the field`);
  }
  // Short of the -X end, so flying on crosses the runway along +X
  if (!near((toField.x * along.x + toField.z * along.z) / dist, 1, 1e-9)) {
    problems.push(`${airport.name}: not short of the landing end`);
  }
  if (!near(f.x, along.x, 1e-9) || !near(f.z, along.z, 1e-9)) {
    problems.push(`${airport.name}: not lined up with the runway`);
  }
  if (at.y < groundAt(airport.x, airport.z) + APPROACH_HEIGHT - 1e-9) {
    problems.push(`${airport.name}: below the approach height`);
  }
  const ground = highest(
    at.x,
    at.z,
    airport.x - along.x * end,
    airport.z - along.z * end
  );
  if (at.y < ground + 30) problems.push(`${airport.name}: into the ground`);
  if (at.speed !== APPROACH_SPEED) problems.push(`${airport.name}: not slowed`);
}
check(
  'an airport: on final approach to the landing end, low and slow',
  !problems.length,
  problems.join('; ')
);

const volcano = LANDMARKS.find((l) => l.name === 'Volcano');
const from = {x: volcano.x + 8000, z: volcano.z - 6000};
const view = arrivalAt(volcano, from.x, from.z, groundAt);
const back = {x: view.x - volcano.x, z: view.z - volcano.z};
const fromDir = {x: from.x - volcano.x, z: from.z - volcano.z};
const facing = forward(view.yaw);
check(
  'a landmark: back from it, on the side you came from',
  near(Math.hypot(back.x, back.z), VIEW_DISTANCE, 1e-6) &&
    near(back.x * fromDir.z - back.z * fromDir.x, 0, 1e-3) &&
    back.x * fromDir.x + back.z * fromDir.z > 0
);
check(
  'a landmark: facing it',
  near((facing.x * -back.x + facing.z * -back.z) / VIEW_DISTANCE, 1, 1e-9)
);
const ridge = arrivalAt(
  {x: 4000, z: 0, name: 'Ridge test'},
  -9000,
  0,
  groundAt
);
check(
  'a landmark: clear of the ground in between',
  ridge.y >= highest(ridge.x, ridge.z, 4000, 0) + VIEW_CLEARANCE - 20,
  `at ${ridge.y.toFixed(0)}, ridge ${highest(ridge.x, ridge.z, 4000, 0).toFixed(0)}`
);
check('a landmark keeps the speed', view.speed === undefined);
const over = arrivalAt(volcano, volcano.x, volcano.z, groundAt);
check(
  'right over a landmark: still back from it',
  near(Math.hypot(over.x - volcano.x, over.z - volcano.z), VIEW_DISTANCE, 1e-6)
);

const spot = arrivalAt({x: 1234, z: -5678}, 0, 0, groundAt);
check(
  'a plain spot: above it, heading and speed kept',
  spot.x === 1234 &&
    spot.z === -5678 &&
    near(spot.y, groundAt(1234, -5678) + WARP_HEIGHT) &&
    spot.yaw === undefined &&
    spot.speed === undefined
);

// A buggy parks close by, stopped, facing the place
{
  const bad = [];
  for (const airport of ChillFlightLogic.AIRPORTS) {
    const at = buggyArrivalAt({...airport}, 0, 0, 1, groundAt);
    const along = {x: Math.cos(airport.angle), z: Math.sin(airport.angle)};
    const u = (at.x - airport.x) * along.x + (at.z - airport.z) * along.z;
    const f = forward(at.yaw);
    if (!near(u, -(ChillFlightLogic.RUNWAY_LENGTH / 2 - BUGGY_RUNWAY_IN), 1e-6))
      bad.push(`${airport.name}: ${u.toFixed(0)} along the runway`);
    if (!near(f.x, along.x, 1e-9) || !near(f.z, along.z, 1e-9))
      bad.push(`${airport.name}: not facing down the runway`);
    if (at.speed !== 0 || at.y !== groundAt(at.x, at.z))
      bad.push(`${airport.name}: not parked on the ground`);
  }
  check(
    'a buggy at an airport: on the runway by the landing end, facing down it',
    !bad.length,
    bad.join('; ')
  );
  const flat = () => 100;
  const lm = {x: 0, z: 0, name: 'Lighthouse'};
  const at = buggyArrivalAt(lm, 0, 5000, 1, flat);
  const f = forward(at.yaw);
  check(
    'a buggy at a landmark: parked back from it on your side, facing it',
    near(at.x, 0, 1e-6) &&
      near(at.z, BUGGY_VIEW.Lighthouse, 1e-6) &&
      near(f.z, -1, 1e-9) &&
      at.speed === 0
  );
  // A wall on the side you come from: it goes round to level ground
  const wall = (x, z) => (z > 0 ? 100 + x * x * 0.01 : 100);
  const round = buggyArrivalAt(lm, 0, 5000, 1, wall);
  const s = 8;
  const slope =
    Math.max(
      Math.abs(wall(round.x + s, round.z) - wall(round.x - s, round.z)),
      Math.abs(wall(round.x, round.z + s) - wall(round.x, round.z - s))
    ) /
    (2 * s);
  check(
    'a buggy at a landmark: round to level ground when it is steep',
    slope <= BUGGY_PARK_SLOPE &&
      near(Math.hypot(round.x, round.z), BUGGY_VIEW.Lighthouse, 1e-6),
    `slope ${slope.toFixed(2)} at ${round.x.toFixed(0)}, ${round.z.toFixed(0)}`
  );
  // Sea on your side: dry land round from it first
  const coast = (x) => (x > 0 ? 40 : 60);
  const dry = buggyArrivalAt(lm, 5000, 0, 1, coast);
  check('a buggy at a landmark: dry land before water', dry.x < 0);
  const pin = buggyArrivalAt({x: 1234, z: -5678}, 0, 0, 0.7, flat);
  check(
    'a buggy at a plain spot: on it, heading kept, stopped',
    pin.x === 1234 && pin.z === -5678 && pin.yaw === 0.7 && pin.speed === 0
  );
}

// The pyramids: a desert site found for every world, standing on dry land
// clear of the highways, with the great one's tip the right height
{
  const {simplex} = await import('../noise.js');
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 200};
  const pin = LANDMARKS.find((l) => l.name === 'Pyramids');
  const bad = [];
  for (const seed of [20260101, 20261025, 42, 7, 3]) {
    simplex.seed(seed);
    ChillFlightLogic.WORLD_SEED = seed;
    const site = ChillFlightLogic.pyramidSite(simplex, constants);
    if (!site) {
      bad.push(`${seed}: no site`);
      continue;
    }
    const [great] = ChillFlightLogic.PYRAMIDS;
    const tip = ChillFlightLogic.getElevation(
      site.x + great.dx,
      site.z + great.dz,
      simplex,
      constants
    );
    const want = site.base + great.half * ChillFlightLogic.PYRAMID_SLOPE;
    if (Math.abs(tip - want) > 5) bad.push(`${seed}: tip ${tip} not ${want}`);
    const road = Math.round(
      (site.x - ChillFlightLogic.ROAD_BASE_X) / ChillFlightLogic.ROAD_SPACING
    );
    const fromRoad = Math.abs(
      site.x - ChillFlightLogic.getRoadCenterX(site.z, road)
    );
    if (fromRoad < 1500) bad.push(`${seed}: ${fromRoad} from a highway`);
    if (site.base <= 40) bad.push(`${seed}: plaza under water`);
  }
  check(
    'the pyramids stand in the desert in every world, pinned on the map',
    !!pin && pin.z > 10000 && bad.length === 0,
    bad.join('; ')
  );
}

// The dragon skeleton: a tundra site found in the far north for every world
// and continent shape, standing on dry land clear of the highways
{
  const {simplex} = await import('../noise.js');
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 200};
  const pin = LANDMARKS.find((l) => l.name === 'Skeleton');
  const bad = [];
  for (const continent of ChillFlightLogic.CONTINENT_NAMES) {
    ChillFlightLogic.CONTINENT = continent;
    for (const seed of [20260101, 20261025, 42, 7, 3]) {
      simplex.seed(seed);
      ChillFlightLogic.WORLD_SEED = seed;
      const site = ChillFlightLogic.dragonSite(simplex, constants);
      if (!site) {
        bad.push(`${continent}/${seed}: no site`);
        continue;
      }
      const ground = ChillFlightLogic.getElevation(
        site.x,
        site.z,
        simplex,
        constants
      );
      if (Math.abs(ground - site.base) > 1) {
        bad.push(`${continent}/${seed}: ground ${ground} not ${site.base}`);
      }
      if (site.base <= 40) bad.push(`${continent}/${seed}: hollow under water`);
      const road = Math.round(
        (site.x - ChillFlightLogic.ROAD_BASE_X) / ChillFlightLogic.ROAD_SPACING
      );
      const fromRoad = Math.abs(
        site.x - ChillFlightLogic.getRoadCenterX(site.z, road)
      );
      if (fromRoad < 400) {
        bad.push(`${continent}/${seed}: ${fromRoad} from a highway`);
      }
    }
  }
  ChillFlightLogic.CONTINENT = null;
  simplex.seed(20260101);
  ChillFlightLogic.WORLD_SEED = 20260101;
  check(
    'the dragon skeleton lies in the northern tundra in every world, pinned on the map',
    !!pin && pin.z < -12000 && bad.length === 0,
    bad.join('; ')
  );
}

if (failed) {
  console.error('Map place tests failed.');
  process.exit(1);
}
console.log('Map place tests passed.');
