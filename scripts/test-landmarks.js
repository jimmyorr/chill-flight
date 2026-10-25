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
  APPROACH_DISTANCE,
  APPROACH_HEIGHT,
  APPROACH_SPEED,
  LANDMARKS,
  VIEW_CLEARANCE,
  VIEW_DISTANCE,
  WARP_HEIGHT,
  arrivalAt,
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

if (failed) {
  console.error('Map place tests failed.');
  process.exit(1);
}
console.log('Map place tests passed.');
