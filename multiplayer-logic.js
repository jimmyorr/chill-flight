// --- FLY TOGETHER: LOGIC ---
// The parts of flying together that don't touch the page (multiplayer.js has
// those): room codes, invite links, what goes in a position update, and
// smoothing other players' planes between updates. Pure, for Node tests
// (scripts/test-multiplayer.js).
//
// Smoothing: each player sends where they are five times a second, stamped
// with their own clock. Their plane is drawn RENDER_DELAY_MS behind, on a
// curve through the updates either side of that moment (using each update's
// speed and direction, so fast turns stay round), and turned between them
// along the shortest way. The delay covers late and bunched-up updates; past
// the last update it carries on in a straight line for a moment, then waits.
import * as THREE from 'three';

// As the relay's (relay/src/rules.js; the test checks they match)
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS = 4;
export const CLOSE = {
  full: 4001,
  notFound: 4004,
  taken: 4009,
  badRequest: 4000,
};

// How often a position update goes out (ms): 5 a second while flying, 1 a
// second while paused
export const SEND_INTERVAL_MS = 200;
export const PAUSED_SEND_INTERVAL_MS = 1000;
// How far behind other players are drawn (ms), so there's an update after
// the moment shown even when one is late
export const RENDER_DELAY_MS = 400;
// How long a plane carries on past its last update before it waits (ms)
const EXTRAPOLATE_MS = 1000;
// Faster than this between two updates is a warp, not flight (units/s; the
// jet's 800 kts is ~800)
const WARP_SPEED = 3000;
const BUFFER_SIZE = 16;

// Bits of an update's `fl` (its `f` is the relay's: who sent it)
export const FLAGS = {smoke: 1, gear: 2, ground: 4, water: 8};

/** A new room code from `rng` (Math.random or a seeded one). */
export function makeRoomCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(rng() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** A typed code tidied up (case, spaces), or null if it can't be one. */
export function parseRoomCode(text) {
  const code = String(text || '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const c of code) if (!ROOM_CODE_ALPHABET.includes(c)) return null;
  return code;
}

/** A player's name as shown over their plane: up to 16 characters. */
export function cleanName(name) {
  return String(name || '')
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, 16);
}

/** The link that brings a friend into the room, in the same world. */
export function inviteUrl(base, code, seed) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', code);
  url.searchParams.set('seed', String(seed));
  return url.toString();
}

/** The relay address for a room. */
export function roomSocketUrl(relay, code, {mode, seed, name}) {
  const url = new URL(`${relay.replace(/\/+$/, '')}/room/${code}`);
  url.searchParams.set('mode', mode);
  url.searchParams.set('seed', String(seed));
  if (name) url.searchParams.set('name', name);
  return url.toString();
}

const round = (v, places) => {
  const k = 10 ** places;
  return Math.round(v * k) / k;
};

/** A position update: pos {x,y,z}, quat {x,y,z,w}, speed (multiplier). */
export function packState(ts, pos, quat, speed, flags) {
  return {
    t: 's',
    ts: Math.round(ts),
    p: [round(pos.x, 2), round(pos.y, 2), round(pos.z, 2)],
    q: [round(quat.x, 4), round(quat.y, 4), round(quat.z, 4), round(quat.w, 4)],
    v: round(speed, 3),
    fl: flags,
  };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** An update as received, or null if it isn't a well-formed one. */
export function unpackState(msg) {
  if (!msg || msg.t !== 's' || !isNum(msg.ts) || !isNum(msg.v)) return null;
  if (!Array.isArray(msg.p) || msg.p.length !== 3 || !msg.p.every(isNum)) {
    return null;
  }
  if (!Array.isArray(msg.q) || msg.q.length !== 4 || !msg.q.every(isNum)) {
    return null;
  }
  const quat = new THREE.Quaternion(...msg.q);
  if (quat.lengthSq() < 0.5) return null;
  return {
    ts: msg.ts,
    pos: new THREE.Vector3(...msg.p),
    quat: quat.normalize(),
    speed: msg.v,
    flags: isNum(msg.fl) ? msg.fl : 0,
    vel: new THREE.Vector3(),
  };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/**
 * One other player's plane: their updates, and where to draw it now.
 * Times are ms; `localNow` is this device's clock (performance.now() or
 * Date.now(), the same one every call).
 */
export class PeerTrack {
  constructor() {
    this.buffer = [];
    // This device's clock minus theirs, plus the trip: the smallest seen,
    // creeping up slowly so a clock that drifts is followed
    this.offset = null;
  }

  /** Adds an update (from unpackState) received at `localNow`. */
  push(s, localNow) {
    const sample = localNow - s.ts;
    if (this.offset === null || sample < this.offset) this.offset = sample;
    else this.offset += (sample - this.offset) * 0.02;

    const last = this.buffer[this.buffer.length - 1];
    if (last) {
      if (s.ts <= last.ts) return; // late or repeated
      const dt = (s.ts - last.ts) / 1000;
      if (s.pos.distanceTo(last.pos) / dt > WARP_SPEED) this.buffer.length = 0;
    }
    this.buffer.push(s);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
    this.updateVelocities();
  }

  // Each update's velocity (units/s) from its neighbours: the curve's
  // direction through it
  updateVelocities() {
    const b = this.buffer;
    const n = b.length;
    for (let i = Math.max(0, n - 3); i < n; i++) {
      const prev = b[Math.max(0, i - 1)];
      const next = b[Math.min(n - 1, i + 1)];
      const dt = (next.ts - prev.ts) / 1000;
      if (dt > 0) b[i].vel.subVectors(next.pos, prev.pos).divideScalar(dt);
      else b[i].vel.set(0, 0, 0);
    }
  }

  /** Whether any update has come in. */
  get ready() {
    return this.buffer.length > 0;
  }

  /** The newest update (for flags and speed). */
  get latest() {
    return this.buffer[this.buffer.length - 1] || null;
  }

  /**
   * Where the plane is at `localNow`: sets outPos and outQuat and returns
   * the speed then, or returns null before any update.
   */
  sample(localNow, outPos, outQuat) {
    const b = this.buffer;
    if (b.length === 0) return null;
    const t = localNow - this.offset - RENDER_DELAY_MS;
    if (t <= b[0].ts || b.length === 1) {
      const s = t <= b[0].ts ? b[0] : b[b.length - 1];
      return this.extrapolate(s, t, outPos, outQuat);
    }
    const last = b[b.length - 1];
    if (t >= last.ts) return this.extrapolate(last, t, outPos, outQuat);

    let i = b.length - 2;
    while (i > 0 && b[i].ts > t) i--;
    const s0 = b[i];
    const s1 = b[i + 1];
    const dt = (s1.ts - s0.ts) / 1000;
    const u = (t - s0.ts) / (s1.ts - s0.ts);
    // Cubic Hermite: through both updates, leaving and arriving at their
    // velocities
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    outPos
      .copy(s0.pos)
      .multiplyScalar(h00)
      .add(_a.copy(s0.vel).multiplyScalar(h10 * dt))
      .add(_b.copy(s1.pos).multiplyScalar(h01))
      .add(_a.copy(s1.vel).multiplyScalar(h11 * dt));
    outQuat.slerpQuaternions(s0.quat, s1.quat, u);
    return s0.speed + (s1.speed - s0.speed) * u;
  }

  extrapolate(s, t, outPos, outQuat) {
    const ahead = THREE.MathUtils.clamp(t - s.ts, 0, EXTRAPOLATE_MS) / 1000;
    outPos.copy(s.pos).add(_a.copy(s.vel).multiplyScalar(ahead));
    outQuat.copy(s.quat);
    return s.speed;
  }
}

// --- WING WAGGLE ---

// A wave to the others: the wings rock side to side a few times (H, or the
// wave button in the quick menu while in a room)
export const WAGGLE_MS = 1800;
const WAGGLE_PERIOD_MS = 600;
const WAGGLE_ROLL = 0.45; // radians at its widest

/** The waggle's roll (radians) `ms` after it started; 0 once it's over. */
export function waggleRoll(ms) {
  if (!(ms >= 0) || ms >= WAGGLE_MS) return 0;
  const swell = Math.sin((Math.PI * ms) / WAGGLE_MS);
  return WAGGLE_ROLL * swell * Math.sin((2 * Math.PI * ms) / WAGGLE_PERIOD_MS);
}

// --- TAG ---
// One player is "it" and chases the others; flying within TAG_RADIUS of one
// makes them it. Whoever is it decides the tag, on what their own screen
// shows, so nobody argues over lag. Each change counts up `n`; a message
// with a lower count is old news, and two at once (two players starting a
// game) are settled by the sender's id, the same way on every screen.
//   {t: 'tag', it, n, by}   it: who's it (null: game over); by: who sent it

// 60 m (1 unit is 0.5144 m)
export const TAG_RADIUS = 117;
// After a tag, the new "it" waits this long before they can tag (ms), so
// the one who tagged them can get away
export const TAG_GRACE_MS = 4000;

export const NO_TAG = Object.freeze({it: null, n: 0, by: ''});

/** A tag message tidied up, or null if it isn't one. */
export function readTag(msg) {
  if (!msg || !Number.isInteger(msg.n) || msg.n < 0) return null;
  if (msg.it !== null && typeof msg.it !== 'string') return null;
  return {it: msg.it, n: msg.n, by: typeof msg.by === 'string' ? msg.by : ''};
}

/** Whether tag state `next` replaces `cur`. */
export function isNewerTag(next, cur) {
  if (next.n !== cur.n) return next.n > cur.n;
  return next.by !== cur.by && next.by < cur.by;
}

/**
 * Who's it after `left` leaves while being it: the lowest id still here
 * (every screen picks the same one).
 */
export function nextIt(ids) {
  return [...ids].sort()[0] ?? null;
}

/**
 * The nearest player in reach of whoever is it, or null. `others` are
 * [{id, pos}], with `pos` as drawn on the tagger's screen.
 */
export function tagTarget(itPos, others, radius = TAG_RADIUS) {
  let best = null;
  let bestDist = radius;
  for (const o of others) {
    const d = itPos.distanceTo(o.pos);
    if (d < bestDist) {
      best = o.id;
      bestDist = d;
    }
  }
  return best;
}
