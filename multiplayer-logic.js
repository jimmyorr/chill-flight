// --- FLY TOGETHER: LOGIC ---
// The parts of flying together that don't touch the page (multiplayer.js has
// those): room codes, invite links, what goes in a position update, and
// smoothing other players' planes between updates. Pure, for Node tests
// (scripts/test-multiplayer.js).
//
// Smoothing: each player sends where they are ten times a second, stamped
// with their own clock. Their plane is drawn RENDER_DELAY_MS behind, on a
// curve through the updates either side of that moment (using each update's
// velocity and turn rate, so fast turns stay round), with a critically damped
// blend whenever a late update reshapes the curve. The delay covers late and
// bunched-up updates; past the last update it carries on for a moment, then
// waits.
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
  tooFast: 4029,
};

// How often a position update goes out (ms): 10 a second while flying, 1 a
// second while paused
export const SEND_INTERVAL_MS = 100;
export const PAUSED_SEND_INTERVAL_MS = 1000;
// How far behind other players are drawn (ms), so there's an update after
// the moment shown even when one is late
export const RENDER_DELAY_MS = 400;
// How long a plane carries on past its last update before it waits (ms)
const EXTRAPOLATE_MS = 1000;
// Faster than this between two updates is a warp, not flight (units/s; the
// jet's 800 kts is ~800)
const WARP_SPEED = 3000;
const BUFFER_SIZE = 24;
// Time constant (s) for blending out any curve shift from a late update
const BLEND_TAU = 0.12;

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
    angVel: new THREE.Vector3(),
  };
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _oldPos = new THREE.Vector3();
const _newPos = new THREE.Vector3();
const _oldVel = new THREE.Vector3();
const _newVel = new THREE.Vector3();
const _oldQuat = new THREE.Quaternion();
const _newQuat = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _identityQuat = new THREE.Quaternion();

// Rotation vector (axis * angle, radians) from unit quaternion q0 to q1
function quatLog(q0, q1, out) {
  _dq.copy(q0).conjugate().multiply(q1);
  if (_dq.w < 0) _dq.set(-_dq.x, -_dq.y, -_dq.z, -_dq.w);
  const sinHalf = Math.hypot(_dq.x, _dq.y, _dq.z);
  const scale =
    sinHalf > 1e-6 ? (2 * Math.acos(Math.min(1, _dq.w))) / sinHalf : 2;
  return out.set(_dq.x * scale, _dq.y * scale, _dq.z * scale);
}

// Unit quaternion from rotation vector (axis * angle, radians)
function quatExp(vec, out) {
  const angle = vec.length();
  const half = angle * 0.5;
  const s = angle > 1e-6 ? Math.sin(half) / angle : 0.5;
  return out.set(vec.x * s, vec.y * s, vec.z * s, Math.cos(half));
}

/**
 * One other player's plane: their updates, and where to draw it now.
 * Times are ms; `localNow` is this device's clock (performance.now() or
 * Date.now(), the same one every call).
 */
export class PeerTrack {
  constructor() {
    this.buffer = [];
    // This device's clock minus theirs, plus the trip: targetOffset tracks the
    // smallest seen (creeping up slowly so a drifting clock is followed), and
    // offset slews smoothly toward it during sample() so playback never jumps
    this.offset = null;
    this.targetOffset = null;
    this.lastLocalNow = null;
    this.lastT = null;
    this.hasSampled = false;
    // Critically damped error offsets that absorb any curve change when an
    // update arrives late
    this.posOffset = new THREE.Vector3();
    this.velOffset = new THREE.Vector3();
    this.quatOffset = new THREE.Quaternion();
  }

  /** Adds an update (from unpackState) received at `localNow`. */
  push(s, localNow) {
    if (!s.angVel) s.angVel = new THREE.Vector3();
    const sample = localNow - s.ts;
    if (this.targetOffset === null) {
      this.targetOffset = sample;
      this.offset = sample;
    } else if (sample < this.targetOffset) {
      this.targetOffset = sample;
      if (!this.hasSampled) this.offset = sample;
    } else {
      this.targetOffset += (sample - this.targetOffset) * 0.01;
      if (!this.hasSampled) this.offset = this.targetOffset;
    }

    const last = this.buffer[this.buffer.length - 1];
    if (last) {
      if (s.ts <= last.ts) return; // late or repeated
      const dt = (s.ts - last.ts) / 1000;
      if (s.pos.distanceTo(last.pos) / dt > WARP_SPEED) {
        this.buffer.length = 0;
        this.posOffset.set(0, 0, 0);
        this.velOffset.set(0, 0, 0);
        this.quatOffset.identity();
        this.hasSampled = false;
      } else if (last.quat.dot(s.quat) < 0) {
        s.quat.set(-s.quat.x, -s.quat.y, -s.quat.z, -s.quat.w);
      }
    }

    const preserve = this.hasSampled && this.buffer.length > 0;
    if (preserve) {
      this.evalAt(this.lastT, _oldPos, _oldQuat, _oldVel);
      _oldPos.add(this.posOffset);
      _oldVel.add(this.velOffset);
      _oldQuat.multiply(this.quatOffset).normalize();
    }

    this.buffer.push(s);
    if (this.buffer.length > BUFFER_SIZE) this.buffer.shift();
    this.updateVelocities();

    if (preserve) {
      this.evalAt(this.lastT, _newPos, _newQuat, _newVel);
      this.posOffset.subVectors(_oldPos, _newPos);
      this.velOffset.subVectors(_oldVel, _newVel);
      this.quatOffset.copy(_newQuat).conjugate().multiply(_oldQuat).normalize();
      if (this.quatOffset.w < 0) {
        this.quatOffset.set(
          -this.quatOffset.x,
          -this.quatOffset.y,
          -this.quatOffset.z,
          -this.quatOffset.w
        );
      }
    }
  }

  // Each update's velocity (units/s) and angular velocity (rad/s) from its
  // neighbours: the curve's direction and turn rate through it
  updateVelocities() {
    const b = this.buffer;
    const n = b.length;
    for (let i = Math.max(0, n - 3); i < n; i++) {
      if (n === 1) {
        b[i].vel.set(0, 0, 0);
        b[i].angVel.set(0, 0, 0);
      } else if (i > 0 && i < n - 1) {
        const prev = b[i - 1];
        const cur = b[i];
        const next = b[i + 1];
        const dt0 = (cur.ts - prev.ts) / 1000;
        const dt1 = (next.ts - cur.ts) / 1000;
        const dt = dt0 + dt1;
        if (dt > 0 && dt0 > 0 && dt1 > 0) {
          _a.subVectors(cur.pos, prev.pos).divideScalar(dt0);
          _b.subVectors(next.pos, cur.pos).divideScalar(dt1);
          cur.vel
            .copy(_a)
            .multiplyScalar(dt1 / dt)
            .addScaledVector(_b, dt0 / dt);

          quatLog(prev.quat, cur.quat, _a).divideScalar(dt0);
          quatLog(cur.quat, next.quat, _b).divideScalar(dt1);
          cur.angVel
            .copy(_a)
            .multiplyScalar(dt1 / dt)
            .addScaledVector(_b, dt0 / dt);
        }
      } else {
        const prev = b[Math.max(0, i - 1)];
        const next = b[Math.min(n - 1, i + 1)];
        const dt = (next.ts - prev.ts) / 1000;
        if (dt > 0) {
          b[i].vel.subVectors(next.pos, prev.pos).divideScalar(dt);
          quatLog(prev.quat, next.quat, b[i].angVel).divideScalar(dt);
          if (i === n - 1 && n >= 3) {
            const speed = b[i].vel.length();
            if (speed > 0 && b[i].vel.dot(prev.vel) > 0) {
              b[i].vel.multiplyScalar(2).sub(prev.vel).setLength(speed);
            }
          }
        } else {
          b[i].vel.set(0, 0, 0);
          b[i].angVel.set(0, 0, 0);
        }
      }
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

    const dt = this.lastLocalNow === null ? 0 : localNow - this.lastLocalNow;
    this.lastLocalNow = localNow;

    if (!this.hasSampled || dt < 0 || dt > 500) {
      this.offset = this.targetOffset;
      this.lastT = localNow - this.offset - RENDER_DELAY_MS;
      this.hasSampled = true;
    } else if (dt > 0) {
      const offDiff = this.targetOffset - this.offset;
      if (Math.abs(offDiff) > 500) {
        this.offset = this.targetOffset;
      } else {
        const maxShift = dt * 0.03;
        this.offset += THREE.MathUtils.clamp(
          offDiff * 0.05,
          -maxShift,
          maxShift
        );
      }

      const dtSec = dt / 1000;
      const w = 1 / BLEND_TAU;
      const e = Math.exp(-w * dtSec);
      _a.copy(this.velOffset).addScaledVector(this.posOffset, w);
      this.posOffset.addScaledVector(_a, dtSec).multiplyScalar(e);
      this.velOffset.addScaledVector(_a, -w * dtSec).multiplyScalar(e);
      this.quatOffset.slerp(_identityQuat, 1 - e);
      this.lastT = localNow - this.offset - RENDER_DELAY_MS;
    }

    const speed = this.evalAt(this.lastT, outPos, outQuat);
    outPos.add(this.posOffset);
    outQuat.multiply(this.quatOffset).normalize();
    return speed;
  }

  evalAt(t, outPos, outQuat, outVel) {
    const b = this.buffer;
    if (t <= b[0].ts || b.length === 1) {
      const s = t <= b[0].ts ? b[0] : b[b.length - 1];
      return this.extrapolate(s, t, outPos, outQuat, outVel);
    }
    const last = b[b.length - 1];
    if (t >= last.ts) return this.extrapolate(last, t, outPos, outQuat, outVel);

    let i = b.length - 2;
    while (i > 0 && b[i].ts > t) i--;
    const s0 = b[i];
    const s1 = b[i + 1];
    const dt = (s1.ts - s0.ts) / 1000;
    const u = (t - s0.ts) / (s1.ts - s0.ts);
    // Cubic Hermite: through both updates, leaving and arriving at their
    // velocities and angular velocities
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

    if (outVel) {
      const dh00 = (6 * u2 - 6 * u) / dt;
      const dh10 = 3 * u2 - 4 * u + 1;
      const dh01 = (-6 * u2 + 6 * u) / dt;
      const dh11 = 3 * u2 - 2 * u;
      outVel
        .copy(s0.pos)
        .multiplyScalar(dh00)
        .addScaledVector(s0.vel, dh10)
        .addScaledVector(s1.pos, dh01)
        .addScaledVector(s1.vel, dh11);
    }

    quatLog(s0.quat, s1.quat, _c);
    _a.copy(_c)
      .multiplyScalar(h01)
      .addScaledVector(s0.angVel, h10 * dt)
      .addScaledVector(s1.angVel, h11 * dt);
    quatExp(_a, _dq);
    outQuat.copy(s0.quat).multiply(_dq).normalize();
    return s0.speed + (s1.speed - s0.speed) * u;
  }

  extrapolate(s, t, outPos, outQuat, outVel) {
    const rawAhead = (t - s.ts) / 1000;
    const ahead = THREE.MathUtils.clamp(rawAhead, 0, EXTRAPOLATE_MS / 1000);
    outPos.copy(s.pos).add(_a.copy(s.vel).multiplyScalar(ahead));
    if (outVel) {
      if (rawAhead >= 0 && rawAhead <= EXTRAPOLATE_MS / 1000) {
        outVel.copy(s.vel);
      } else {
        outVel.set(0, 0, 0);
      }
    }
    const rotAhead = Math.min(ahead, 0.25);
    quatExp(_a.copy(s.angVel).multiplyScalar(rotAhead), _dq);
    outQuat.copy(s.quat).multiply(_dq).normalize();
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
