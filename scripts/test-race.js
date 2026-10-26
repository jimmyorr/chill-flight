#!/usr/bin/env node
/**
 * scripts/test-race.js
 *
 * Checks races when flying together (race-logic.js): ring courses run
 * their length and hang every ring clear of the ground; highway courses
 * follow a highway that runs the whole way, from the nearest one, and
 * there's none far out at sea; gates count only when passed through the
 * right way; results go by time, then gates; and a race sent comes back
 * the same.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {forwardOf} from '../traffic-logic.js';
import {
  ARCH_HALF,
  RACE_GATES,
  RING_CLEAR,
  RING_PASS,
  courseLength,
  formatRaceTime,
  gridSpot,
  inSlipstream,
  isNewerRace,
  missedGate,
  packCourse,
  packResults,
  passesGate,
  placeText,
  planeCourse,
  raceOver,
  raceStandings,
  readRace,
  roadCourse,
} from '../race-logic.js';

console.log('Testing races...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const SEED = 20260101;
ChillFlightLogic.WORLD_SEED = SEED;
simplex.seed(SEED);
const CONSTANTS = {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180};
const elevationAt = (x, z) =>
  ChillFlightLogic.getElevation(x, z, simplex, CONSTANTS);
const runsAt = (n, along) =>
  ChillFlightLogic.highwayRunsAt(n, along, simplex, CONSTANTS);

// --- RING COURSES ---
{
  const from = {x: 2000, z: 10000, heading: 0.4};
  const course = planeCourse(from, 280, 7, elevationAt, 40);
  const leg = courseLength(280) / RACE_GATES;
  check('A ring course has every gate', course.gates.length === RACE_GATES);
  let prev = course.start;
  let spacing = true;
  let clear = true;
  for (const g of course.gates) {
    const d = Math.hypot(g.x - prev.x, g.z - prev.z);
    if (Math.abs(d - leg) > 600) spacing = false;
    const ground = Math.max(elevationAt(g.x, g.z), 40);
    if (g.y - ground < RING_CLEAR - 1) clear = false;
    prev = g;
  }
  check('Rings are a leg apart', spacing);
  check('Rings hang clear of the ground', clear);
  const again = planeCourse(from, 280, 7, elevationAt, 40);
  check(
    'The same seed lays the same course',
    JSON.stringify(again) === JSON.stringify(course)
  );
  const twin = planeCourse(from, 500, 7, elevationAt, 40);
  const span = (c) =>
    Math.hypot(c.gates[0].x - c.start.x, c.gates[0].z - c.start.z);
  check('A faster plane gets a longer course', span(twin) > span(course) * 1.6);
}

// --- HIGHWAY COURSES ---
{
  const z0 = 10000;
  const x0 = ChillFlightLogic.getRoadCenterX(z0, 0) + 300;
  const course = roadCourse({x: x0, z: z0, heading: 0}, 240, runsAt);
  check('A highway course is found near highway 0', !!course);
  if (course) {
    check('It follows highway 0', course.road.n === 0);
    check('Heading north first', course.road.d === -1);
    check('It has every gate', course.gates.length === RACE_GATES);
    let onRoad = true;
    let runs = true;
    for (const g of course.gates) {
      if (Math.abs(g.x - ChillFlightLogic.getRoadCenterX(g.z, 0)) > 1) {
        onRoad = false;
      }
      if (!runsAt(0, g.z)) runs = false;
    }
    check('Its arches stand on the highway', onRoad);
    check('The highway runs to every arch', runs);
    // Arc length along the road is the course's length
    let arc = 0;
    let p = course.start;
    for (let z = course.start.z; z >= course.gates.at(-1).z; z -= 10) {
      const x = ChillFlightLogic.getRoadCenterX(z, 0);
      arc += Math.hypot(x - p.x, z - p.z);
      p = {x, z};
    }
    check(
      'It runs about a race long',
      Math.abs(arc - courseLength(240)) < 300,
      `(${arc.toFixed(0)} vs ${courseLength(240).toFixed(0)})`
    );
    const spot = gridSpot(course, 3, 0, 0);
    const f = forwardOf(course.start.heading);
    const behind =
      (course.start.x - spot.x) * f.x + (course.start.z - spot.z) * f.z;
    check('Buggies line up behind the start', behind > 0 && behind < 120);
  }
  check(
    'No highway course far out at sea',
    roadCourse({x: 60000, z: -200000, heading: 0}, 240, runsAt) === null
  );
}

// --- GATES ---
{
  const gate = {x: 0, y: 200, z: 0, heading: 0};
  // Heading 0 is north (-z): through it is from +z to -z
  const a = {x: 10, y: 210, z: 20};
  const b = {x: 10, y: 210, z: -20};
  check('Through a ring counts', passesGate(gate, 'air', a, b));
  check('The wrong way does not', !passesGate(gate, 'air', b, a));
  check(
    'Past the edge does not',
    !passesGate(gate, 'air', {...a, x: RING_PASS + 5}, {...b, x: RING_PASS + 5})
  );
  check(
    'Under an arch counts at any height',
    passesGate(gate, 'road', {...a, y: 900}, {...b, y: 900})
  );
  check(
    'Beside an arch does not',
    !passesGate(
      gate,
      'road',
      {...a, x: ARCH_HALF + 5},
      {...b, x: ARCH_HALF + 5}
    )
  );
  check('Well past a gate is a miss', missedGate(gate, 0, -400));
  check('Short of it is not', !missedGate(gate, 0, 100));
}

// --- SLIPSTREAM ---
{
  const me = {x: 0, y: 100, z: 0, heading: 0};
  check(
    'Right behind someone tows',
    inSlipstream(me, [{x: 5, y: 110, z: -150, heading: 0.1}])
  );
  check(
    'Off to the side does not',
    !inSlipstream(me, [{x: 200, y: 100, z: -150, heading: 0}])
  );
  check(
    'Head on does not',
    !inSlipstream(me, [{x: 0, y: 100, z: -150, heading: Math.PI}])
  );
}

// --- RESULTS ---
{
  const standings = raceStandings([
    {id: 'c', gates: 4, finish: null},
    {id: 'a', gates: 9, finish: 118000},
    {id: 'd', gates: 6, finish: null},
    {id: 'b', gates: 9, finish: 112500},
  ]);
  check(
    'Finishers by time, then the rest by gates',
    standings.map((r) => r.id).join('') === 'badc'
  );
  check(
    'Over once everyone has finished',
    raceOver(
      [
        {gates: 9, finish: 1000},
        {gates: 9, finish: 2000},
      ],
      3000
    )
  );
  check(
    'Not over while someone races, soon after the first finish',
    !raceOver(
      [
        {gates: 9, finish: 100000},
        {gates: 5, finish: null},
      ],
      110000
    )
  );
  check(
    'Over a while after the first finish',
    raceOver(
      [
        {gates: 9, finish: 100000},
        {gates: 5, finish: null},
      ],
      146000
    )
  );
  check(
    'Places read 1st to 4th',
    [1, 2, 3, 4, 11].map(placeText).join(' ') === '1st 2nd 3rd 4th 11th'
  );
  check('Times read m:ss.t', formatRaceTime(112345) === '1:52.3');
}

// --- MESSAGES ---
{
  const course = roadCourse(
    {x: ChillFlightLogic.getRoadCenterX(10000, 0), z: 10000, heading: 0},
    240,
    runsAt
  );
  const msg = JSON.parse(
    JSON.stringify({
      t: 'race',
      n: 3,
      plane: 'buggy',
      course: packCourse(course),
      grid: ['a', 'b'],
      go: 5000,
    })
  );
  const race = readRace({...msg, by: 'a'});
  check(
    'A race comes back as sent',
    race &&
      race.plane === 'buggy' &&
      race.course.road.n === course.road.n &&
      race.course.gates.length === RACE_GATES &&
      Math.abs(race.course.gates[4].x - course.gates[4].x) < 0.1 &&
      race.grid.length === 2 &&
      race.go === 5000
  );
  const end = readRace({
    t: 'race',
    n: 4,
    by: 'b',
    end: true,
    results: packResults([
      {id: 'a', gates: 9, finish: 1234},
      {id: 'b', gates: 3, finish: null},
    ]),
  });
  check(
    'Results come back as sent',
    end &&
      !end.course &&
      end.results.a.finish === 1234 &&
      end.results.b.finish === null &&
      end.results.b.gates === 3
  );
  check(
    'Junk is not a race',
    readRace({n: 1, course: {kind: 'boat'}}) === null
  );
  check('A later race replaces an earlier one', isNewerRace(end, race));
}

if (failed) process.exit(1);
console.log('All race checks passed');
