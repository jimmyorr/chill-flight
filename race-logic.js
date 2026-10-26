// --- RACE: COURSES AND RULES ---
// Pure logic for a race when flying together (multiplayer.js runs it):
// everyone races the starter's vehicle through a line of gates, rings in
// the sky for planes and arches over a highway for buggies, about two
// minutes of racing whatever the vehicle. No three.js or DOM, so
// scripts/test-race.js can run it in Node.
//
// Headings are as the game uses them (0 is north, -z; forwardOf). A gate is
// {x, y, z, heading}: passed going along its heading. A course is
//   {kind: 'air' | 'road', start: {x, y, z, heading}, gates: [...]}
// with the last gate the finish; a road course also has road: {n, a, d},
// the highway it follows (n), where it starts along it (a) and which way
// (d: +1 or -1 along), for the bots to drive along.
//
// Messages (multiplayer.js):
//   {t: 'race', n, by, plane, course, grid, go}  a race starting: grid is
//     who's racing, go the ms until the start (from when it was sent)
//   {t: 'race', n, by, end: true, results}  it's over: results is
//     {id: [gates passed, finish ms or null]}
// Each racer times their own run from the start, and sends how many gates
// they've passed (rg) and their finish time (rf) with their position.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {forwardOf} from './traffic-logic.js';

// Rings to fly through or arches to drive under, the last one the finish
export const RACE_GATES = 9;
// A race lasts about this long, flown at RACE_PACE of top speed (a unit a
// second reads as a knot, so the course is that many units long)
export const RACE_SECONDS = 120;
export const RACE_PACE = 0.85;
// After the race is sent, a moment to settle on the grid, then 3, 2, 1
export const RACE_SETTLE_MS = 2000;
export const RACE_COUNT_MS = 3000;
// Once someone's finished, the others have this long (ms); and no race
// runs past RACE_MAX_MS from the start
export const RACE_LINGER_MS = 45 * 1000;
export const RACE_MAX_MS = 5 * 60 * 1000;
// Rings: drawn this big (radius, units: about 46 m across) and passed
// within RING_PASS of the middle; hung RING_CLEAR over the highest ground
// near them, so the bottom is about 20 m up
export const RING_RADIUS = 45;
export const RING_PASS = 55;
export const RING_CLEAR = 85;
// Arches: across the road and its shoulders (half-width, and height)
export const ARCH_HALF = 60;
export const ARCH_HEIGHT = 70;
// A plane course starts this far ahead of the starter
export const START_AHEAD = 600;
// This far past a gate (along its heading) without passing it: missed
export const MISSED_AFTER = 250;
// Turns between gates on a plane course, at most (rad)
const MAX_WANDER = 0.7;
// Slipstream: right behind another racer (within RANGE, inside CONE of
// straight ahead, and going much the same way), a tow of BOOST on top
// speed, held HOLD seconds after dropping out of it
export const SLIP = {RANGE: 320, CONE: 0.3, HEADING: 0.7, UP: 90, BOOST: 1.1};
export const SLIP_HOLD = 0.8;
// Racing bots: this much of top speed, a little different for each
export const BOT_RACE_SPEED = 0.92;
const BOT_JITTER = [0.97, 1.02, 1.0];

export const NO_RACE = Object.freeze({
  n: 0,
  by: '',
  plane: null,
  course: null,
  grid: Object.freeze([]),
  go: 0,
  results: null,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A small seeded random number generator (0 to 1)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** How long (units) a course is for a vehicle with top speed topKts. */
export function courseLength(topKts) {
  return topKts * RACE_SECONDS * RACE_PACE;
}

/**
 * A ring course ahead of `from` ({x, z, heading}): RACE_GATES rings, each
 * leg turning a little, toward the lowest ground of a few ways it could
 * go, so the course runs down valleys and over water. `seed` picks the
 * turns; elevationAt(x, z) is the ground.
 */
export function planeCourse(from, topKts, seed, elevationAt, waterLevel) {
  const random = rng(seed);
  const ground = (x, z) => Math.max(elevationAt(x, z), waterLevel);
  const leg = courseLength(topKts) / RACE_GATES;
  // The highest ground along a leg from (x, z) heading h
  const highest = (x, z, h, from = 0) => {
    const f = forwardOf(h);
    let top = -Infinity;
    for (let d = from; d <= leg; d += 150) {
      top = Math.max(top, ground(x + f.x * d, z + f.z * d));
    }
    return top;
  };
  // A ring at (x, z): clear of the ground round it
  const ringY = (x, z) => {
    let top = ground(x, z);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      top = Math.max(top, ground(x + Math.sin(a) * 150, z + Math.cos(a) * 150));
    }
    return top + RING_CLEAR;
  };
  const f0 = forwardOf(from.heading);
  let x = from.x + f0.x * START_AHEAD;
  let z = from.z + f0.z * START_AHEAD;
  let heading = from.heading;
  const start = {x, y: ringY(x, z), z, heading};
  const gates = [];
  for (let i = 0; i < RACE_GATES; i++) {
    const wander = (random() * 2 - 1) * MAX_WANDER;
    let best = null;
    for (let c = -2; c <= 2; c++) {
      const h = heading + wander + c * 0.3;
      // The lower the better, but not turning much more than wandered
      const score = highest(x, z, h, 300) + Math.abs(c) * 80;
      if (!best || score < best.score) best = {h, score};
    }
    heading = wrap(best.h);
    const f = forwardOf(heading);
    x += f.x * leg;
    z += f.z * leg;
    gates.push({x, y: ringY(x, z), z, heading});
  }
  return {kind: 'air', start, gates};
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// --- ROAD COURSES ---

const L = ChillFlightLogic;

// The highways that could run near (x, z), nearest first: [{n, along, off}]
function roadsNear(x, z) {
  const out = [];
  const n0 = Math.round((x - L.ROAD_BASE_X) / L.ROAD_SPACING);
  for (let n = n0 - 1; n <= n0 + 1; n++) {
    if (n < 0 || n > L.ROAD_LAST) continue;
    out.push({n, along: z, off: Math.abs(x - L.roadCenter(n, z))});
  }
  if (x > L.ROAD_EW_WEST && x < L.ROAD_EW_EAST) {
    out.push({
      n: L.ROAD_EW,
      along: x,
      off: Math.abs(z - L.roadCenter(L.ROAD_EW, x)),
    });
  }
  return out.sort((a, b) => a.off - b.off);
}

/** The world point {x, z} on highway `road.n` at `along`, `lane` across. */
export function roadSpot(n, along, lane = 0) {
  return L.roadPoint(n, along, L.roadCenter(n, along) + lane, {});
}

// Highway n's heading at `along`, going way d
function roadHeading(n, along, d) {
  const a = roadSpot(n, along);
  const b = roadSpot(n, along + d * 20);
  return Math.atan2(-(b.x - a.x), -(b.z - a.z));
}

// From `along` on highway n, way d, while it runs: [{along, arc}] every
// STEP, up to `length` of road (arc) or where it ends
const STEP = 50;
function traceRoad(n, along, d, length, runsAt) {
  const points = [{along, arc: 0}];
  let prev = roadSpot(n, along);
  let arc = 0;
  let a = along;
  let checked = along;
  while (arc < length) {
    a += d * STEP;
    if (Math.abs(a - checked) >= 250) {
      if (!runsAt(n, a)) break;
      checked = a;
    }
    const p = roadSpot(n, a);
    arc += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = p;
    points.push({along: a, arc});
  }
  return points;
}

/**
 * A highway course from the nearest highway to `from` ({x, z, heading}):
 * from the nearest point on it where it runs, the way `from` is heading
 * (or the other way, should the road end too soon), RACE_GATES arches
 * along it, the last the finish. runsAt(n, along): whether highway n runs
 * there (ChillFlightLogic.highwayRunsAt). Gates' y is left at 0 (the
 * ground's height is the game's to find). Null with no highway near
 * enough, or none long enough.
 */
export function roadCourse(from, topKts, runsAt, reach = 20000) {
  const length = courseLength(topKts);
  const f = forwardOf(from.heading);
  let fallback = null;
  for (const r of roadsNear(from.x, from.z)) {
    if (r.off > reach) continue;
    // The nearest point along it where it runs
    let a0 = null;
    for (let k = 0; k <= 40 && a0 === null; k++) {
      for (const s of k ? [1, -1] : [1]) {
        const a = r.along + s * k * 500;
        if (runsAt(r.n, a)) {
          a0 = a;
          break;
        }
      }
    }
    if (a0 === null) continue;
    // The way the starter's heading, first
    const ew = r.n === L.ROAD_EW;
    const pref = (ew ? f.x : f.z) >= 0 ? 1 : -1;
    for (const d of [pref, -pref]) {
      const points = traceRoad(r.n, a0, d, length, runsAt);
      const got = points[points.length - 1].arc;
      if (got >= length - STEP)
        return buildRoadCourse(r.n, a0, d, points, length);
      if (!fallback || got > fallback.got) {
        fallback = {n: r.n, a0, d, points, got};
      }
    }
  }
  // Nothing as long as a race: the longest stretch there is, if it's at
  // least half as long
  if (fallback && fallback.got >= length / 2) {
    const {n, a0, d, points, got} = fallback;
    return buildRoadCourse(n, a0, d, points, got);
  }
  return null;
}

function buildRoadCourse(n, a0, d, points, length) {
  const at = (arc) => {
    let i = 1;
    while (i < points.length - 1 && points[i].arc < arc) i++;
    return points[i].along;
  };
  const gate = (along) => {
    const p = roadSpot(n, along);
    return {x: p.x, y: 0, z: p.z, heading: roadHeading(n, along, d)};
  };
  const gates = [];
  for (let i = 1; i <= RACE_GATES; i++) {
    gates.push(gate(at((length * i) / RACE_GATES)));
  }
  return {kind: 'road', road: {n, a: a0, d}, start: gate(a0), gates};
}

/**
 * Where a bot on a road course steers for: `ahead` further along the road
 * than (x, z), `lane` across it.
 */
export function roadAim(road, x, z, ahead, lane = 0) {
  const along = road.n === L.ROAD_EW ? x : z;
  return roadSpot(road.n, along + road.d * ahead, lane);
}

// --- THE GRID ---

/**
 * Where racer number `slot` waits for the start ({x, y, z, heading}; y is
 * the start line's, for planes): planes side by side, far enough behind
 * the start line to fly up to it at `holdKts` until the start; buggies two
 * by two on the road, just behind it.
 */
export function gridSpot(course, slot, holdKts, holdMs) {
  const s = course.start;
  const f = forwardOf(s.heading);
  const rx = -f.z;
  const rz = f.x;
  let side;
  let back;
  if (course.kind === 'air') {
    side = [-60, 60, -180, 180][slot % 4];
    back = (holdKts * holdMs) / 1000;
  } else {
    side = slot % 2 ? 14 : -14;
    back = 20 + Math.floor(slot / 2) * 40;
  }
  return {
    x: s.x + rx * side - f.x * back,
    y: s.y,
    z: s.z + rz * side - f.z * back,
    heading: s.heading,
  };
}

// --- GATES ---

// Along the gate's heading (+ past it) and across it, of (x, z)
function gateFrame(gate, x, z) {
  const f = forwardOf(gate.heading);
  const dx = x - gate.x;
  const dz = z - gate.z;
  return {along: dx * f.x + dz * f.z, across: -dx * f.z + dz * f.x};
}

/**
 * Whether going from a to b ({x, y, z}) passes through `gate` the right
 * way: through the ring (kind 'air'), or under the arch (any height, so a
 * buggy that jumps it still counts).
 */
export function passesGate(gate, kind, a, b) {
  const sa = gateFrame(gate, a.x, a.z).along;
  const sb = gateFrame(gate, b.x, b.z).along;
  if (!(sa < 0 && sb >= 0)) return false;
  const t = sa / (sa - sb);
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  const z = a.z + (b.z - a.z) * t;
  const {across} = gateFrame(gate, x, z);
  if (kind === 'air') return Math.hypot(across, y - gate.y) <= RING_PASS;
  return Math.abs(across) <= ARCH_HALF;
}

/** Whether (x, z) is well past `gate` without having gone through it. */
export function missedGate(gate, x, z) {
  return gateFrame(gate, x, z).along > MISSED_AFTER;
}

// --- SLIPSTREAM ---

/**
 * Whether `me` ({x, y, z, heading}) is in the slipstream of any of
 * `others`: close behind one going much the same way.
 */
export function inSlipstream(me, others) {
  const f = forwardOf(me.heading);
  for (const o of others) {
    const dx = o.x - me.x;
    const dz = o.z - me.z;
    const ahead = dx * f.x + dz * f.z;
    if (ahead <= 0 || ahead > SLIP.RANGE) continue;
    const across = Math.abs(-dx * f.z + dz * f.x);
    if (across > ahead * Math.tan(SLIP.CONE) + 15) continue;
    if (Math.abs((o.y ?? me.y) - me.y) > SLIP.UP) continue;
    if (Math.abs(wrap(o.heading - me.heading)) > SLIP.HEADING) continue;
    return true;
  }
  return false;
}

// --- RESULTS ---

/**
 * Racers in finishing order: [{id, gates, finish}] (finish in ms, or null
 * still racing), finishers by time, then the rest by gates passed.
 */
export function raceStandings(racers) {
  return [...racers].sort((a, b) => {
    const fa = a.finish ?? Infinity;
    const fb = b.finish ?? Infinity;
    if (fa !== fb) return fa - fb;
    if (a.gates !== b.gates) return b.gates - a.gates;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Whether the race is over for `racers` ({gates, finish}, those still
 * here) at `sinceGo` ms after the start: everyone's finished, it's
 * RACE_LINGER_MS since the first finish, or it's run RACE_MAX_MS.
 */
export function raceOver(racers, sinceGo) {
  if (sinceGo >= RACE_MAX_MS) return true;
  if (!racers.length) return true;
  let first = Infinity;
  let all = true;
  for (const r of racers) {
    if (r.finish === null || r.finish === undefined) all = false;
    else first = Math.min(first, r.finish);
  }
  return all || sinceGo - first >= RACE_LINGER_MS;
}

/** 1st, 2nd, 3rd, 4th... */
export function placeText(place) {
  const s = {1: 'st', 2: 'nd', 3: 'rd'}[place % 10];
  return `${place}${place % 100 >= 11 && place % 100 <= 13 ? 'th' : s || 'th'}`;
}

/** Milliseconds as m:ss.t (e.g. 1:52.3). */
export function formatRaceTime(ms) {
  const tenths = Math.max(0, Math.floor((ms || 0) / 100));
  const m = Math.floor(tenths / 600);
  const s = String(Math.floor((tenths % 600) / 10)).padStart(2, '0');
  return `${m}:${s}.${tenths % 10}`;
}

/** A racing bot's share of top speed (each a little different). */
export function botRaceSpeed(slot) {
  return BOT_RACE_SPEED * BOT_JITTER[slot % BOT_JITTER.length];
}

// --- MESSAGES ---

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (v) => Math.round(v * 10) / 10;

function packGate(g) {
  return [
    round1(g.x),
    round1(g.y),
    round1(g.z),
    Math.round(g.heading * 1000) / 1000,
  ];
}

function readGate(a) {
  if (!Array.isArray(a) || a.length !== 4 || !a.every(num)) return null;
  return {x: a[0], y: a[1], z: a[2], heading: a[3]};
}

/** A course to send. */
export function packCourse(course) {
  const out = {
    kind: course.kind,
    start: packGate(course.start),
    gates: course.gates.map(packGate),
  };
  if (course.road)
    out.road = [course.road.n, round1(course.road.a), course.road.d];
  return out;
}

/** A course as sent, tidied up; or null if it isn't one. */
export function readCourse(c) {
  if (!c || (c.kind !== 'air' && c.kind !== 'road')) return null;
  const start = readGate(c.start);
  if (!start || !Array.isArray(c.gates)) return null;
  if (c.gates.length < 1 || c.gates.length > 20) return null;
  const gates = c.gates.map(readGate);
  if (gates.some((g) => !g)) return null;
  const course = {kind: c.kind, start, gates};
  if (c.kind === 'road') {
    const r = c.road;
    if (!Array.isArray(r) || r.length !== 3 || !r.every(num)) return null;
    if (!Number.isInteger(r[0]) || (r[2] !== 1 && r[2] !== -1)) return null;
    course.road = {n: r[0], a: r[1], d: r[2]};
  }
  return course;
}

// {id: [gates, finish ms or null]}, keeping only sensible entries
function readResults(map) {
  const out = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
  for (const [id, v] of Object.entries(map)) {
    if (!Array.isArray(v) || !num(v[0]) || v[0] < 0) continue;
    out[id] = {
      gates: Math.floor(v[0]),
      finish: num(v[1]) && v[1] >= 0 ? Math.round(v[1]) : null,
    };
  }
  return out;
}

/** Results to send: {id: [gates, finish]}. */
export function packResults(racers) {
  const out = {};
  for (const r of racers) out[r.id] = [r.gates, r.finish ?? null];
  return out;
}

/**
 * A race message tidied up, or null if it isn't one: {n, by, plane,
 * course, grid, go, results}, a race on with a course, or over with
 * results (and course null).
 */
export function readRace(msg) {
  if (!msg || !Number.isInteger(msg.n) || msg.n < 0) return null;
  const by = typeof msg.by === 'string' ? msg.by : '';
  if (msg.end) {
    return {...NO_RACE, n: msg.n, by, results: readResults(msg.results)};
  }
  const course = readCourse(msg.course);
  if (!course || typeof msg.plane !== 'string' || !msg.plane) return null;
  const grid = Array.isArray(msg.grid)
    ? msg.grid.filter((id) => typeof id === 'string').slice(0, 8)
    : [];
  const go = num(msg.go)
    ? clamp(Math.round(msg.go), -RACE_MAX_MS, RACE_SETTLE_MS + RACE_COUNT_MS)
    : 0;
  return {n: msg.n, by, plane: msg.plane, course, grid, go, results: null};
}

/** Whether race state `next` replaces `cur` (as isNewerTag). */
export function isNewerRace(next, cur) {
  if (next.n !== cur.n) return next.n > cur.n;
  return next.by !== cur.by && next.by < cur.by;
}
