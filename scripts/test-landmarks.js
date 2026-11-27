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
  TOWN_COLOR,
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
const townNames = new Set(ChillFlightLogic.TOWN_NAMES);
check(
  'airports, crossroads towns, and landmarks each have their own distinct pin color',
  AIRPORT_COLOR !== LANDMARK_COLOR &&
    TOWN_COLOR !== LANDMARK_COLOR &&
    TOWN_COLOR !== AIRPORT_COLOR &&
    LANDMARKS.every(
      (l) =>
        l.color ===
        (airportNames.has(l.name)
          ? AIRPORT_COLOR
          : townNames.has(l.name)
            ? TOWN_COLOR
            : LANDMARK_COLOR)
    ) &&
    LANDMARKS.filter((l) => townNames.has(l.name)).every(
      (l) => l.symbol === '⌂' && l.town === true
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

// The alien portals: east in Xen and west in Westworld for every world and
// continent shape, pinned on the map, and crossing one warps out of the other
{
  const {simplex} = await import('../noise.js');
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 200};
  const eastPin = LANDMARKS.find((l) => l.name === 'East portal');
  const westPin = LANDMARKS.find((l) => l.name === 'West portal');
  const bad = [];
  for (const continent of ChillFlightLogic.CONTINENT_NAMES) {
    ChillFlightLogic.CONTINENT = continent;
    for (const seed of [20260101, 20261025, 42]) {
      simplex.seed(seed);
      ChillFlightLogic.WORLD_SEED = seed;
      const sites = ChillFlightLogic.portalSites(simplex, constants);
      if (!sites?.east || !sites?.west) {
        bad.push(`${continent}/${seed}: missing portal site`);
        continue;
      }
      if (sites.east.x < 50000 || sites.west.x > -50000) {
        bad.push(
          `${continent}/${seed}: not in alien lands (${sites.east.x}, ${sites.west.x})`
        );
      }
      for (const p of [sites.east, sites.west]) {
        const ground = ChillFlightLogic.getElevation(
          p.x,
          p.z,
          simplex,
          constants
        );
        if (Math.abs(ground - p.base) > 1) {
          bad.push(
            `${continent}/${seed} ${p.name}: ground ${ground} != ${p.base}`
          );
        }
      }
    }
  }
  ChillFlightLogic.CONTINENT = null;
  simplex.seed(20260101);
  ChillFlightLogic.WORLD_SEED = 20260101;
  const sites = ChillFlightLogic.portalSites(simplex, constants);
  const e = sites.east;
  const w = sites.west;
  const ec = Math.cos(e.yaw);
  const es = Math.sin(e.yaw);
  // Fly through the East portal at lateral offset u = 10, height h = 75, from v = -12 to v = +8
  const prev = {
    x: e.x + 10 * ec - 12 * es,
    y: e.base + 75,
    z: e.z - 10 * es - 12 * ec,
  };
  const next = {
    x: e.x + 10 * ec + 8 * es,
    y: e.base + 75,
    z: e.z - 10 * es + 8 * ec,
  };
  const warp = ChillFlightLogic.checkPortalCrossing(prev, next, sites);
  const wc = Math.cos(w.yaw);
  const ws = Math.sin(w.yaw);
  const outU = (warp.x - w.x) * wc - (warp.z - w.z) * ws;
  const outV = (warp.x - w.x) * ws + (warp.z - w.z) * wc;
  check(
    'the alien portals stand in Xen and Westworld in every world, pinned on the map, and warp between each other',
    !!eastPin &&
      !!westPin &&
      bad.length === 0 &&
      !!warp &&
      warp.from === e &&
      warp.to === w &&
      near(outU, 10, 1e-6) &&
      outV > 20 &&
      near(warp.y, w.base + 75, 1e-6) &&
      near(warp.turn, w.yaw - e.yaw, 1e-6),
    bad.join('; ')
  );
}

// Daily scenic spawns: first-time play always starts at (0, 445.5, 0) by the
// Falls; returning players rotate through all eight scenic corridors on
// consecutive days with safe clearance ahead.
{
  const {simplex} = await import('../noise.js');
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 200};
  const firstPlay = ChillFlightLogic.dailySpawn(simplex, constants, {
    playedBefore: false,
    seed: 20261114,
  });
  check(
    'first-time play always spawns at (0, 445.5, 0) facing the Falls corridor',
    firstPlay.name === 'Falls' &&
      firstPlay.x === 0 &&
      firstPlay.y === 445.5 &&
      firstPlay.z === 0 &&
      near(firstPlay.yaw, ChillFlightLogic.SPAWN_YAW)
  );

  const eightDays = [
    20261127, 20261128, 20261129, 20261130, 20261201, 20261202, 20261203,
    20261204,
  ];
  const seen = new Set();
  let adjacentRepeat = false;
  let prevName = null;
  for (const seed of eightDays) {
    ChillFlightLogic.WORLD_SEED = seed;
    simplex.seed(seed);
    const sp = ChillFlightLogic.dailySpawn(simplex, constants, {
      playedBefore: true,
      seed,
    });
    if (sp.name === prevName) adjacentRepeat = true;
    prevName = sp.name;
    seen.add(sp.name);
  }
  check(
    'returning players cycle through all 8 scenic spawns across 8 consecutive days (including month rollover)',
    seen.size === ChillFlightLogic.SCENIC_SPAWNS.length && !adjacentRepeat,
    `seen=${[...seen].join(',')} repeat=${adjacentRepeat}`
  );

  const clearanceProblems = [];
  for (const seed of [20260101, 20261114, 42]) {
    ChillFlightLogic.WORLD_SEED = seed;
    simplex.seed(seed);
    for (const name of ChillFlightLogic.SCENIC_SPAWNS) {
      const sp = ChillFlightLogic.scenicSpawnAt(name, simplex, constants);
      const fx = -Math.sin(sp.yaw);
      const fz = -Math.cos(sp.yaw);
      for (let d = 0; d <= 2000; d += 100) {
        const h = Math.max(
          40,
          ChillFlightLogic.getElevation(
            sp.x + fx * d,
            sp.z + fz * d,
            simplex,
            constants
          )
        );
        if (sp.y - h < 120) {
          clearanceProblems.push(
            `${seed}/${name} d=${d}: y=${sp.y} ground=${h.toFixed(0)}`
          );
          break;
        }
      }
    }
  }
  ChillFlightLogic.WORLD_SEED = 20260101;
  simplex.seed(20260101);
  check(
    'every scenic spawn has safe vertical clearance along its flight corridor',
    clearanceProblems.length === 0,
    clearanceProblems.join('; ')
  );
}

// Crossroads market towns (#195) and Crossroads' Ferris wheel: named from east
// to west, kept out of alien lands and open lakes, with the Ferris wheel level
// and clear of highways and slip roads inside Crossroads
{
  const {simplex} = await import('../noise.js');
  const constants = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180};
  const crossroadsPin = LANDMARKS.find((l) => l.name === 'Crossroads');
  check(
    'Crossroads is on the map with the town pin color and symbol',
    Boolean(crossroadsPin) &&
      crossroadsPin.color === TOWN_COLOR &&
      crossroadsPin.symbol === '⌂' &&
      BUGGY_VIEW.Crossroads === 480
  );

  const townProblems = [];
  const ferrisProblems = [];
  for (const seed of [20260101, 20260410, 20260715, 20261126, 42, 7]) {
    ChillFlightLogic.WORLD_SEED = seed;
    simplex.seed(seed);
    ChillFlightLogic.setRoadNoise(simplex);
    const towns = ChillFlightLogic.townSites(simplex, constants);
    const first = ChillFlightLogic.townAt(0, simplex, constants);
    if (!first || first.name !== 'Crossroads' || towns[0] !== first) {
      townProblems.push(`${seed}: missing Crossroads at n=0`);
      continue;
    }
    for (const t of towns) {
      if (ChillFlightLogic.alienAt(t.x, t.z, simplex) > 0.35) {
        townProblems.push(`${seed}/${t.name}: inside alien territory`);
      }
      const c = ChillFlightLogic.highwayCrossing(t.n);
      if (!near(t.x, c.x, 1e-3) || !near(t.z, c.z, 1e-3)) {
        townProblems.push(`${seed}/${t.name}: off highway crossing`);
      }
    }

    const ferris = ChillFlightLogic.ferrisWheelSite(simplex, constants);
    if (!ferris) {
      ferrisProblems.push(`${seed}: no Ferris wheel site`);
      continue;
    }
    const distFromCenter = Math.hypot(ferris.x - first.x, ferris.z - first.z);
    if (distFromCenter < 200 || distFromCenter > first.radius) {
      ferrisProblems.push(
        `${seed}: dist ${distFromCenter.toFixed(0)} outside Crossroads`
      );
    }
    const hCenter = ChillFlightLogic.getElevation(
      ferris.x,
      ferris.z,
      simplex,
      constants
    );
    if (ferris.base < 44 || Math.abs(hCenter - ferris.base) > 1.5) {
      ferrisProblems.push(
        `${seed}: base ${ferris.base.toFixed(1)} vs ground ${hCenter.toFixed(1)}`
      );
    }
    if (
      Math.abs(ferris.x - ChillFlightLogic.getRoadCenterX(ferris.z, 0)) < 110 ||
      Math.abs(ferris.z - ChillFlightLogic.getRoadCenterZ(ferris.x)) < 110 ||
      ChillFlightLogic.isOnSlipRoad(ferris.x, ferris.z, 75, simplex, constants)
    ) {
      ferrisProblems.push(`${seed}: too close to highway or slip road`);
    }
    // Front boarding steps (+z -> sin(yaw), cos(yaw)) face toward Crossroads
    const toTownX = first.x - ferris.x;
    const toTownZ = first.z - ferris.z;
    const dot =
      (Math.sin(ferris.yaw) * toTownX + Math.cos(ferris.yaw) * toTownZ) /
      Math.hypot(toTownX, toTownZ);
    if (!near(dot, 1, 1e-6)) {
      ferrisProblems.push(`${seed}: front steps not facing Crossroads`);
    }
  }
  ChillFlightLogic.WORLD_SEED = 20260101;
  simplex.seed(20260101);
  ChillFlightLogic.setRoadNoise(simplex);
  check(
    'crossroads towns sit at dry, non-alien highway crossings across seeds',
    townProblems.length === 0,
    townProblems.join('; ')
  );
  check(
    'Crossroads Ferris wheel sits on a level town green clear of highways and slip roads',
    ferrisProblems.length === 0,
    ferrisProblems.join('; ')
  );
}

if (failed) {
  console.error('Map place tests failed.');
  process.exit(1);
}
console.log('Map place tests passed.');
