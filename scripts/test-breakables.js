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
  speedKept,
  stepFlying,
  stepFold,
  stepScatter,
  stepSink,
  stepTopple,
  sweptHit,
  toppleSpin,
} from '../breakables-logic.js';

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
        if (types[0] === 'houseBody' || types[0] === 'twoStoryBody') houses++;
        else if (/^(rock|snowRock|desertRock)$/.test(types[0])) boulders++;
        else buildings.add(types[0]);
        // Walls that fold down first, and a roof (or sails) to throw off; a
        // castle ruin has none, and a boulder is one rock
        const boulder = /^(rock|snowRock|desertRock)$/.test(types[0]);
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
    } else if (types[0] === 'penguinBody') {
      penguins++;
      if (b.kinds[i] !== BREAKABLE.CRITTER || types.length !== 8) {
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

if (failed) {
  console.log('Breakable prop tests FAILED.');
  process.exit(1);
}
console.log('All breakable prop tests passed.');
