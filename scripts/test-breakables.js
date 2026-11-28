#!/usr/bin/env node
/**
 * scripts/test-breakables.js
 *
 * Checks knocking props over: the terrain generator lists each chunk's trees
 * and houses with the instances that draw them (InstanceCollector.breakables
 * in terrain-gen.js), and the maths in breakables-logic.js (the hit test, a
 * tree's fall and the speed lost).
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {BREAKABLE, generateChunkData} from '../terrain-gen.js';
import {
  BREAK,
  restAngle,
  shouldScareSheep,
  speedKept,
  stepFlying,
  stepFold,
  stepScatter,
  stepSheepPunt,
  stepSink,
  stepTopple,
  sweptFerrisHit,
  sweptHit,
  sweptWallHit,
  toppleSpin,
  wingSweptHit,
} from '../breakables-logic.js';
import {
  TRIP,
  createTripState,
  endTripState,
  isTripIdle,
  isTripTrailActive,
  startTripState,
  stepTripState,
} from '../mushroom-trip-logic.js';

console.log('Testing breakable props...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

ChillFlightLogic.WORLD_SEED = 20260101;
simplex.seed(20260101);

function chunk(cx, cz) {
  return generateChunkData({
    chunkX: cx,
    chunkZ: cz,
    chunkSize: 1500,
    segments: 30,
    elevParams: {
      WATER_LEVEL: 40,
      MOUNTAIN_LEVEL: 180,
      MAP_WORLD_SIZE: 10000,
      MAP_HEIGHT_SCALE: 400,
    },
    worldSeed: 20260101,
    enableObjects: true,
  }).result;
}

// --- The generator's list ---
let trees = 0;
let houses = 0;
// Other buildings (huts, barns, castles...), by their first part
const buildings = new Set();
let boulders = 0;
let consistent = true;
let detail = '';
for (let cx = -2; cx <= 2; cx++) {
  for (let cz = -2; cz <= 2; cz++) {
    const {breakables: b, instanceData} = chunk(cx, cz);
    for (let i = 0; i < b.kinds.length; i++) {
      const start = b.propStarts[i];
      const end = b.propStarts[i + 1];
      const types = [];
      for (let j = start; j < end; j++) {
        const type = b.types[b.partTypes[j]];
        types.push(type);
        const data = instanceData[type];
        if (!data || b.partIndices[j] >= data.count) {
          consistent = false;
          detail = `prop ${i} part ${type} out of range`;
        }
      }
      // Every part of a prop stands on the same spot (a house's door and
      // windows are on its walls, within a few units)
      const first = instanceData[types[0]].matrices;
      const fo = b.partIndices[start] * 16;
      for (let j = start; j < end; j++) {
        const m = instanceData[b.types[b.partTypes[j]]].matrices;
        const o = b.partIndices[j] * 16;
        const d = Math.hypot(
          m[o + 12] - first[fo + 12],
          m[o + 14] - first[fo + 14]
        );
        if (d > 20) {
          consistent = false;
          detail = `prop ${i} part ${j - start} is ${d.toFixed(0)} units away`;
        }
      }
      if (b.kinds[i] === BREAKABLE.HOUSE) {
        if (/^(house|twoStory)(Adobe)?Body$/.test(types[0])) houses++;
        else if (
          /^(rock|snowRock|desertRock|granite|stoneWall|stoneWallRuined|stoneWallSnow|stoneWallSnowRuined)$/.test(
            types[0]
          )
        )
          boulders++;
        else buildings.add(types[0]);
        // Walls that fold down first, and a roof (or sails) to throw off; a
        // castle ruin has none, and a boulder or dry-stone wall bay is one stone part
        const boulder =
          /^(rock|snowRock|desertRock|granite|stoneWall|stoneWallRuined|stoneWallSnow|stoneWallSnowRuined)$/.test(
            types[0]
          );
        if (
          boulder
            ? types.length !== 1
            : !/Body$|^castleRuins$|^windmillBase$/.test(types[0]) ||
              (types[0] !== 'castleRuins' &&
                !types.some((t) => t.endsWith('Roof') || t.endsWith('Blades')))
        ) {
          consistent = false;
          detail = `house ${i} is ${types.join(' ')}`;
        }
      } else if (b.kinds[i] === BREAKABLE.TREE) {
        trees++;
      }
    }
  }
}
check('chunks list breakable trees', trees > 100, `${trees} trees`);
check('chunks list breakable houses', houses > 5, `${houses} houses`);
check('chunks list breakable boulders', boulders > 10, `${boulders}`);
check(
  'chunks list other breakable buildings',
  buildings.size >= 2,
  [...buildings].join(' ')
);
check("each prop's parts are its own instances", consistent, detail);

// Up north, icebergs and floes break (one model each), and penguins, which
// scatter, are one prop of eight parts each
let ice = 0;
let penguins = 0;
let iceOk = true;
for (const [cx, cz] of [
  [-4, -36],
  [-2, -36],
  [-6, -34],
  [-4, -32],
]) {
  const {breakables: b} = chunk(cx, cz);
  for (let i = 0; i < b.kinds.length; i++) {
    const types = [];
    for (let j = b.propStarts[i]; j < b.propStarts[i + 1]; j++) {
      types.push(b.types[b.partTypes[j]]);
    }
    if (/^ice/.test(types[0])) {
      ice++;
      if (b.kinds[i] !== BREAKABLE.HOUSE || types.length !== 1) iceOk = false;
    } else if (types[0] === 'penguin') {
      penguins++;
      if (b.kinds[i] !== BREAKABLE.CRITTER || types.length !== 1) {
        iceOk = false;
      }
    }
  }
}
check('icebergs and floes are breakable', ice > 10, `${ice}`);
check('penguins are listed to scatter', penguins > 5, `${penguins}`);
check('ice and penguin props hold their own models', iceOk);

// The same chunk lists the same props every time, so friends (and a chunk
// loaded again) break the same ones
const again = chunk(0, 0).breakables;
const first = chunk(0, 0).breakables;
check(
  'a chunk lists the same props each time',
  again.kinds.length === first.kinds.length &&
    again.partIndices.every((v, i) => v === first.partIndices[i])
);

// --- Hits ---
const a = {x: -50, y: 10, z: 0};
const b = {x: 50, y: 10, z: 0};
check('passing through a tree hits it', sweptHit(a, b, 3, 0, 2, 4, 0, 30));
check('passing beside a tree misses it', !sweptHit(a, b, 3, 0, 9, 4, 0, 30));
check(
  'flying over a tree misses it',
  !sweptHit({...a, y: 40}, {...b, y: 40}, 6, 0, 0, 4, 0, 30)
);
check(
  'a fast frame still hits what it passed (swept, not just the end point)',
  sweptHit({x: -400, y: 10, z: 0}, {x: 400, y: 10, z: 0}, 3, 120, 0, 3, 0, 30)
);

// --- A falling tree ---
const flat = () => 0;
check(
  'on flat ground a tree lies down',
  Math.abs(restAngle(30, 3, flat) - Math.PI / 2) < 0.15
);
const uphill = (d) => d * 0.5;
check('falling uphill it stops short', restAngle(30, 3, uphill) < 1.3);
const s = {angle: 0, spin: toppleSpin(100), rest: Math.PI / 2, done: false};
let t = 0;
let bounced = false;
while (!s.done && t < 10) {
  stepTopple(s, 1 / 60);
  if (s.spin < 0) bounced = true;
  t += 1 / 60;
}
check(
  'a tree falls in about a second',
  t > 0.5 && t < 2.5,
  `${t.toFixed(2)} s`
);
check('it bounces before lying still', bounced && s.angle === s.rest);
check('a harder hit tips it faster', toppleSpin(300) > toppleSpin(50));

// --- Flying bits ---
const p = {
  x: 0,
  y: 10,
  z: 0,
  vx: 10,
  vy: 5,
  vz: 0,
  angle: 0,
  spin: 2,
  rest: 0,
  done: false,
};
for (let i = 0; i < 600 && !p.done; i++) stepFlying(p, 1 / 60, -40);
check('a piece thrown off lands on the ground', p.done && p.y === 0 && p.x > 5);

// --- Folding building ---
const fold = {t: 0, done: false};
for (let i = 0; i < 120 && !fold.done; i++) stepFold(fold, 1 / 60);
check(
  'a building folds down and leans over COLLAPSE_TIME',
  fold.done &&
    Math.abs(fold.squash - BREAK.COLLAPSE_HEIGHT) < 0.01 &&
    Math.abs(fold.lean - BREAK.COLLAPSE_LEAN) < 0.01
);

// --- Sinking boat ---
const boat = {t: 0, done: false};
for (let i = 0; i < 600 && !boat.done; i++) stepSink(boat, 1 / 60);
check(
  'a sinking boat rolls and drops before gone',
  boat.done && Math.abs(boat.roll - BREAK.SINK_ROLL) < 0.01 && boat.drop > 40
);

// --- Scattering penguin ---
const penguin = {t: 0, done: false};
for (let i = 0; i < 300 && !penguin.done; i++) stepScatter(penguin, 1 / 60);
check(
  'a scattering penguin hops and dives',
  penguin.done && penguin.along > 10 && penguin.up < -5
);

// --- Sheep reacting to the buggy ---
check(
  'a sheep beside the buggy path jumps out of the way when the buggy gets close',
  shouldScareSheep(
    {x: 0, y: 12, z: -22},
    {x: 0, y: 12, z: -20},
    BREAK.BUGGY_RADIUS,
    0,
    1,
    12,
    10,
    0,
    true
  ) &&
    !shouldScareSheep(
      {x: 0, y: 12, z: -80},
      {x: 0, y: 12, z: -78},
      BREAK.BUGGY_RADIUS,
      0,
      1,
      12,
      10,
      0,
      true
    )
);
const punted = {
  x: 0,
  y: 20,
  z: 0,
  vx: 45,
  vy: 28,
  vz: 0,
  angle: 0,
  spin: BREAK.PUNT_SPIN,
  bounces: 0,
  done: false,
};
let peakY = punted.y;
for (let i = 0; i < 300 && !punted.done; i++) {
  stepSheepPunt(punted, 1 / 60, (x) => 20 + x * 0.05);
  if (punted.y > peakY) peakY = punted.y;
}
check(
  'a sheep hit by the buggy gets punted high in the air, bounces, and lands on the slope',
  punted.done &&
    peakY > 28 &&
    punted.bounces === 1 &&
    punted.x > 40 &&
    Math.abs(punted.y - (20 + punted.x * 0.05)) < 0.01 &&
    punted.angle === 0
);

// --- Dry-stone wall narrowphase segment hit (#184) ---
// Wall bay running along Z from z = -6.75 (y = 100) to z = +6.75 (y = 104) at x = 0
const wallMatrix = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 4, 13.5, 0, 0, 102, 0, 1,
]);
check(
  'sweptWallHit catches buggy crossing middle or end of a sloped dry-stone wall bay',
  sweptWallHit(
    {x: -5, y: 102, z: 0},
    {x: 5, y: 102, z: 0},
    BREAK.BUGGY_RADIUS,
    wallMatrix,
    1.18,
    3.45
  ) &&
    sweptWallHit(
      {x: -5, y: 105, z: 6.2},
      {x: 5, y: 105, z: 6.2},
      BREAK.BUGGY_RADIUS,
      wallMatrix,
      1.18,
      3.45
    )
);
check(
  'sweptWallHit ignores buggy driving parallel beside wall or plane flying clear overhead',
  !sweptWallHit(
    {x: 4.6, y: 102, z: -6},
    {x: 4.6, y: 102, z: 6},
    BREAK.BUGGY_RADIUS,
    wallMatrix,
    1.18,
    3.45
  ) &&
    !sweptWallHit(
      {x: -6, y: 113, z: 0},
      {x: 6, y: 113, z: 0},
      BREAK.PLANE_RADIUS,
      wallMatrix,
      1.18,
      3.45
    )
);

// --- A wing against a streetlight ---
// Pole at the origin, 25 up; its arm reaches 17 out along +x at y 24. The
// plane flies north (-z) past it at height 15, wings level along x.
const pole = [
  {x: 0, y: 0, z: 0},
  {x: 0, y: 25, z: 0},
];
const arm = [
  {x: 0, y: 24, z: 0},
  {x: 17, y: 24, z: 0},
];
const level = {x: 1, y: 0, z: 0};
const reach = 0.8 + BREAK.WING_THICK;
const past = (x, y) => [
  {x, y, z: 20},
  {x, y, z: -20},
];
check(
  'a wingtip 10 units off the pole knocks it, though the ball misses',
  wingSweptHit(...past(10, 15), level, 14.5, ...pole, reach) &&
    !sweptHit(...past(10, 15), BREAK.PLANE_RADIUS, 0, 0, 0.44, 0, 25)
);
check(
  'a wingtip 17 units off the pole misses it',
  !wingSweptHit(...past(17, 15), level, 14.5, ...pole, reach)
);
check(
  'banked 90°, the wing points down and misses a pole 10 units off',
  !wingSweptHit(...past(10, 15), {x: 0, y: 1, z: 0}, 14.5, ...pole, reach)
);
check(
  'flying down the road under the arm misses it, through it hits',
  !wingSweptHit(...past(8, 18), level, 14.5, ...arm, 0.5 + BREAK.WING_THICK) &&
    wingSweptHit(...past(8, 24), level, 14.5, ...arm, 0.5 + BREAK.WING_THICK)
);
check(
  'a fast frame (300 units) still catches the pole',
  wingSweptHit(
    {x: 12, y: 15, z: 150},
    {x: 12, y: 15, z: -150},
    level,
    14.5,
    ...pole,
    reach
  )
);

// --- Speed lost ---
check(
  'a house slows you more than a tree, the buggy more than a plane',
  speedKept('house', false) < speedKept('tree', false) &&
    speedKept('tree', true) < speedKept('tree', false) &&
    speedKept('house', true) < speedKept('house', false)
);
check(
  'the plane never stops dead',
  speedKept('house', false) > 0.5 && BREAK.KEEP.house.buggy > 0.3
);

// --- Crossroads Ferris wheel narrowphase hit ---
{
  const ferris = {x: 1000, z: -500, base: 150, yaw: Math.PI / 3};
  const c = Math.cos(ferris.yaw);
  const s = Math.sin(ferris.yaw);
  const worldPt = (lx, ly, lz) => ({
    x: ferris.x + lx * c + lz * s,
    y: ferris.base + ly,
    z: ferris.z - lx * s + lz * c,
  });
  const localRight = {x: c, y: 0, z: -s};

  check(
    'sweptFerrisHit catches impacts on wheel rim, fast disc slice, A-frame leg, and boarding deck',
    sweptFerrisHit(
      worldPt(38, 53.3, -25),
      worldPt(38, 53.3, 25),
      BREAK.PLANE_RADIUS,
      ferris
    ) &&
      sweptFerrisHit(
        worldPt(0, 75, -130),
        worldPt(0, 75, 130),
        BREAK.PLANE_RADIUS,
        ferris
      ) &&
      sweptFerrisHit(
        worldPt(-26, 8, -20),
        worldPt(-26, 8, 20),
        BREAK.BUGGY_RADIUS,
        ferris
      ) &&
      sweptFerrisHit(
        worldPt(0, 4, 24),
        worldPt(0, 4, 15),
        BREAK.BUGGY_RADIUS,
        ferris
      )
  );
  check(
    'sweptFerrisHit catches a wingtip clipping the wheel rim while fuselage passes clear',
    sweptFerrisHit(
      worldPt(52, 53.3, -20),
      worldPt(52, 53.3, 20),
      BREAK.PLANE_RADIUS,
      ferris,
      {right: localRight, halfSpan: 14.5}
    ) &&
      !sweptFerrisHit(
        worldPt(52, 53.3, -20),
        worldPt(52, 53.3, 20),
        BREAK.PLANE_RADIUS,
        ferris
      )
  );
  check(
    'sweptFerrisHit ignores planes flying parallel beside the wheel face, past upper corners, or buggies on the outer pad',
    !sweptFerrisHit(
      worldPt(-40, 60, 22),
      worldPt(40, 60, 22),
      BREAK.PLANE_RADIUS,
      ferris
    ) &&
      !sweptFerrisHit(
        worldPt(36, 90, -20),
        worldPt(36, 90, 20),
        BREAK.PLANE_RADIUS,
        ferris
      ) &&
      !sweptFerrisHit(
        worldPt(28, 2, 17),
        worldPt(22, 2, 17),
        BREAK.BUGGY_RADIUS,
        ferris
      )
  );
}

// --- Eastern alien mushroom trip & immediate water reset ---
{
  const t = createTripState();
  check(
    'mushroom trip starts idle with no trail',
    isTripIdle(t) && !isTripTrailActive(t)
  );

  // Small mushroom: ramps sky faster than moon, holds, and eventually fades out
  startTripState(t, 0, 50000);
  check(
    'knocking a mushroom starts sky and moon ramp-in and lights smoke trail',
    !isTripIdle(t) &&
      isTripTrailActive(t) &&
      Math.abs(t.peak - TRIP.PEAK_SMALL) < 1e-9 &&
      Math.abs(t.activeLeft - TRIP.ACTIVE_SMALL) < 1e-9
  );
  for (let i = 0; i < 20 * 60; i++) stepTripState(t, 1 / 60, false);
  check(
    'after 20 s on dry land/air, sky is near peak while moon is still swelling',
    t.sky.val > 0.6 &&
      t.moon.val > 0.25 &&
      t.moon.val < t.sky.val &&
      isTripTrailActive(t)
  );

  // Stacking another mushroom mid-trip raises peak smoothly toward 1
  const beforePeak = t.peak;
  startTripState(t, 0.5, 70000);
  check(
    'hitting another mushroom stacks peak and refreshes active timer',
    t.peak > beforePeak && t.peak <= 1 && t.activeLeft > TRIP.ACTIVE_SMALL
  );

  // Touching the water during ramp/hold immediately ends the trip in one frame
  const driftOnWater = stepTripState(t, 1 / 60, true);
  check(
    'touching the water immediately ends an active mushroom trip',
    driftOnWater === 0 &&
      isTripIdle(t) &&
      !isTripTrailActive(t) &&
      t.sky.val === 0 &&
      t.moon.val === 0 &&
      t.peak === 0 &&
      t.activeLeft === 0
  );

  // Hitting a giant mushroom after water reset starts a clean fresh trip from 0
  startTripState(t, 1, 120000);
  check(
    'after water ends a trip, knocking a giant mushroom starts cleanly from zero',
    !isTripIdle(t) &&
      t.sky.val === 0 &&
      t.moon.val === 0 &&
      t.peak === 1 &&
      t.activeLeft === TRIP.ACTIVE_GIANT &&
      t.clock === 0
  );

  // Advance past active hold into the slow fade-out, then touch water mid-fade
  for (let i = 0; i < (TRIP.ACTIVE_GIANT + 5) * 10; i++) {
    stepTripState(t, 0.1, false);
  }
  check(
    'past active window without water, channels enter gradual fade-out',
    t.sky.mode === 'fade' &&
      t.moon.mode === 'fade' &&
      t.sky.val > 0.5 &&
      t.moon.val > 0.5
  );
  stepTripState(t, 1 / 60, true);
  check(
    'touching the water mid-fade-out also ends the trip immediately',
    isTripIdle(t) &&
      !isTripTrailActive(t) &&
      t.sky.val === 0 &&
      t.moon.val === 0
  );

  // Direct endTripState (e.g. splashing into water on a steep dive crash)
  startTripState(t, 0.8, 0);
  for (let i = 0; i < 60; i++) stepTripState(t, 0.5, false);
  endTripState(t);
  check(
    'endTripState immediately clears sky, moon, peak, and trail',
    isTripIdle(t) &&
      !isTripTrailActive(t) &&
      t.sky.val === 0 &&
      t.moon.val === 0
  );

  // Without touching water, a full trip fades naturally all the way back to idle
  startTripState(t, 0, 0);
  for (let i = 0; i < 1200; i++) stepTripState(t, 0.1, false);
  check(
    'without touching water, trip fades gently back to idle after ~100 s',
    isTripIdle(t) &&
      !isTripTrailActive(t) &&
      t.sky.val === 0 &&
      t.moon.val === 0
  );
}

if (failed) {
  console.log('Breakable prop tests FAILED.');
  process.exit(1);
}
console.log('All breakable prop tests passed.');
