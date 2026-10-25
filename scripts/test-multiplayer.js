#!/usr/bin/env node
/**
 * scripts/test-multiplayer.js
 *
 * Checks flying together without a network: the relay's rules
 * (relay/src/rules.js: who may join, which pages may connect, what's passed
 * on) and the game's side (multiplayer-logic.js): room codes and links,
 * position updates, and smoothing other planes between updates, including
 * late, bunched-up and lost updates, a clock that's minutes off, a jet in a
 * tight turn, a loop and a warp.
 */
import * as THREE from 'three';
import * as rules from '../relay/src/rules.js';
import {
  CALLSIGNS,
  CLOSE,
  FLAGS,
  MAX_PLAYERS,
  NO_TAG,
  PeerTrack,
  RENDER_DELAY_MS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SEND_INTERVAL_MS,
  TAG_RADIUS,
  TAG_SPEED_BOOST,
  TagClock,
  WAGGLE_MS,
  formatTagTime,
  inviteUrl,
  isNewerTag,
  makeRoomCode,
  nextIt,
  packState,
  parseRoomCode,
  randomCallsign,
  readTag,
  roomSocketUrl,
  tagPlane,
  tagTarget,
  tagTimeOf,
  tagWinner,
  unpackState,
  waggleRoll,
  withTagPresence,
  withTagTime,
} from '../multiplayer-logic.js';

console.log('Testing flying together...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

// Seeded so failures reproduce
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- The game and the relay agree ---
check(
  'Game and relay use the same room codes and close codes',
  ROOM_CODE_ALPHABET === rules.ROOM_CODE_ALPHABET &&
    ROOM_CODE_LENGTH === rules.ROOM_CODE_LENGTH &&
    MAX_PLAYERS === rules.MAX_PLAYERS &&
    JSON.stringify(CLOSE) === JSON.stringify(rules.CLOSE)
);

// --- Room codes ---
{
  const rng = mulberry32(1);
  const codes = Array.from({length: 2000}, () => makeRoomCode(rng));
  check(
    'Room codes are valid',
    codes.every((c) => rules.isRoomCode(c) && parseRoomCode(c) === c)
  );
  check('Room codes vary', new Set(codes).size > 1990);
  check(
    'Typed codes are tidied up',
    parseRoomCode(' ab 7k ') === 'AB7K' && parseRoomCode('ab-7k') === 'AB7K'
  );
  check(
    'Look-alikes and wrong lengths are refused',
    parseRoomCode('AB0K') === null &&
      parseRoomCode('ABIK') === null &&
      parseRoomCode('ABC') === null &&
      parseRoomCode('ABCDE') === null &&
      !rules.isRoomCode('abcd')
  );
}

// --- Links ---
{
  const link = new URL(
    inviteUrl('https://chill-flight.cowneck.com/?plane=jet#x', 'AB7K', 20261020)
  );
  check(
    'Invite link carries the room and the world, nothing else',
    link.origin === 'https://chill-flight.cowneck.com' &&
      link.searchParams.get('room') === 'AB7K' &&
      link.searchParams.get('seed') === '20261020' &&
      !link.searchParams.has('plane') &&
      link.hash === ''
  );
  const ws = new URL(
    roomSocketUrl('wss://relay.example/', 'AB7K', {
      mode: 'create',
      seed: 5,
      name: 'Erin',
    })
  );
  check(
    'Relay address names the room, mode, seed and host',
    ws.pathname === '/room/AB7K' &&
      ws.searchParams.get('mode') === 'create' &&
      ws.searchParams.get('seed') === '5' &&
      ws.searchParams.get('name') === 'Erin'
  );
}

// --- Which pages may connect ---
{
  const allowed =
    'https://chill-flight.cowneck.com,https://*.chill-flight.pages.dev,capacitor://localhost,tauri://localhost';
  const ok = (o) => rules.isAllowedOrigin(o, allowed);
  check(
    'The site, its previews, the apps and local testing may connect',
    ok('https://chill-flight.cowneck.com') &&
      ok('https://v1-1-2.chill-flight.pages.dev') &&
      ok('capacitor://localhost') &&
      ok('tauri://localhost') &&
      ok('http://localhost:5173') &&
      ok('http://127.0.0.1:8787')
  );
  check(
    'Other pages may not',
    !ok('https://evil.example') &&
      !ok('https://chill-flight.cowneck.com.evil.example') &&
      !ok('https://chill-flight.pages.dev.evil.example') &&
      !ok('http://chill-flight.cowneck.com') &&
      !ok(null) &&
      !ok('not a url')
  );
}

// --- Who may join ---
{
  const now = 1e12;
  const info = {seed: 7, host: 'Erin', emptySince: null};
  const a = (o) => rules.admit({now, seed: '7', host: 'Erin', ...o});
  const created = a({mode: 'create', players: 0, info: null});
  check(
    'Creating a new room keeps its world and host',
    created.ok && created.info.seed === 7 && created.info.host === 'Erin'
  );
  check(
    'Creating a room that is in use is refused',
    a({mode: 'create', players: 1, info}).code === rules.CLOSE.taken
  );
  check(
    'Joining a room with people in it works',
    a({mode: 'join', players: 2, info}).ok
  );
  check(
    'Joining a room that never existed is refused',
    a({mode: 'join', players: 0, info: null}).code === rules.CLOSE.notFound
  );
  check(
    'The fifth player is refused',
    a({mode: 'join', players: 4, info}).code === rules.CLOSE.full
  );
  const empty = {...info, emptySince: now - 60 * 1000};
  const stale = {...info, emptySince: now - rules.EMPTY_ROOM_MS - 1};
  check(
    'An empty room can be come back to for a while, then it has ended',
    a({mode: 'join', players: 0, info: empty}).ok &&
      a({mode: 'join', players: 0, info: stale}).code ===
        rules.CLOSE.notFound &&
      a({mode: 'create', players: 0, info: stale}).ok
  );
  check(
    'Only creating starts a room, so a made-up code finds nothing',
    a({mode: 'join', players: 0, info: null}).code === rules.CLOSE.notFound &&
      a({mode: 'rejoin', players: 0, info: stale}).code ===
        rules.CLOSE.badRequest
  );
  check(
    'Coming back to a live room keeps its world',
    a({mode: 'join', players: 1, info, seed: '9'}).info.seed === 7
  );
  {
    const bucket = {tokens: rules.RATE_BURST, at: 0};
    let sent = 0;
    // The game's 10 a second for a minute: never cut off
    for (let t = 0; t < 60000; t += SEND_INTERVAL_MS)
      if (rules.takeMessage(bucket, t)) sent++;
    const flood = {tokens: rules.RATE_BURST, at: 0};
    let flooded = 0;
    // 100 a second: cut off within a second
    for (let t = 0; t < 1000; t += 10)
      if (rules.takeMessage(flood, t)) flooded++;
    check(
      'Players are cut off only for flooding the room',
      sent === 60000 / SEND_INTERVAL_MS && flooded < 70,
      `${sent} ${flooded}`
    );
  }
  check(
    'A bad seed or mode is refused',
    a({mode: 'create', players: 0, info: null, seed: 'x'}).code ===
      rules.CLOSE.badRequest &&
      a({mode: 'spy', players: 1, info}).code === rules.CLOSE.badRequest
  );
  const rng = mulberry32(2);
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(rules.newPlayerId(ids, rng));
  check('Player ids are unique in a room', new Set(ids).size === 4);
}

// --- What's passed on ---
{
  const out = JSON.parse(rules.relayed('{"t":"s","f":"fake","v":1}', 'abc'));
  check(
    'Messages are passed on tagged with their real sender',
    out.t === 's' && out.f === 'abc' && out.v === 1
  );
  check(
    'Junk and oversized messages are dropped',
    rules.relayed('nope', 'a') === null &&
      rules.relayed('[1,2]', 'a') === null &&
      rules.relayed('null', 'a') === null &&
      rules.relayed(
        JSON.stringify({t: 'x', pad: 'x'.repeat(rules.MAX_MESSAGE_BYTES)}),
        'a'
      ) === null
  );
  check(
    'Names are trimmed to 16 characters',
    rules.cleanName('  A very long pilot name\n') === 'A very long pilo'
  );
  check(
    'Default callsigns list has 22 bird names',
    CALLSIGNS.length === 22 &&
      CALLSIGNS[0] === 'Crane' &&
      CALLSIGNS[CALLSIGNS.length - 1] === 'Wren'
  );
  check(
    'randomCallsign picks predictably with an rng',
    randomCallsign(() => 0) === 'Crane' &&
      randomCallsign(() => 0.999) === 'Wren' &&
      CALLSIGNS.includes(randomCallsign())
  );
}

// --- Position updates ---
{
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 1, -0.5));
  const msg = packState(1234.5, {x: 1.234567, y: 2, z: -3}, q, 1.23456, 3);
  // Through the relay, which tags it with who sent it
  const text = rules.relayed(JSON.stringify(msg), 'abc');
  check('A position update is small', text.length < 140, `${text.length}`);
  const s = unpackState(JSON.parse(text));
  check(
    'A position update survives the trip',
    s &&
      s.pos.distanceTo(new THREE.Vector3(1.234567, 2, -3)) < 0.01 &&
      s.quat.angleTo(q) < 0.001 &&
      Math.abs(s.speed - 1.23456) < 0.001 &&
      s.flags === 3
  );
  check(
    'Broken updates are ignored',
    unpackState({t: 's', ts: 1, p: [1, 2], q: [0, 0, 0, 1], v: 1}) === null &&
      unpackState({t: 's', ts: 1, p: [1, 2, 3], q: [0, 0, 0, 0], v: 1}) ===
        null &&
      unpackState({t: 's', ts: 1, p: [1, NaN, 3], q: [0, 0, 0, 1], v: 1}) ===
        null &&
      unpackState({t: 'hello'}) === null
  );
}

// --- Smoothing ---

// A flight path: position and orientation at time t (seconds)
function circle(speed, radius) {
  return (t) => {
    const a = (speed / radius) * t;
    const pos = new THREE.Vector3(
      Math.cos(a) * radius,
      500,
      Math.sin(a) * radius
    );
    const heading = -a; // facing along the circle
    const quat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, heading, 0.6, 'YXZ')
    );
    return {pos, quat};
  };
}

// Sends `path` five times a second from a clock `skew` ms off this one,
// delivering each update after `delay(i)` ms (or dropping it when that's
// null), and samples the track every frame. Returns the worst position and
// angle error against the true path RENDER_DELAY_MS ago, and the biggest
// jump between frames beyond the plane's own motion.
function fly(path, {seconds = 10, skew = 0, delay = () => 60} = {}) {
  const track = new PeerTrack();
  const sends = [];
  for (let i = 0; i * SEND_INTERVAL_MS <= seconds * 1000; i++) {
    const t = i * SEND_INTERVAL_MS;
    const d = delay(i);
    if (d === null) continue;
    const {pos, quat} = path(t / 1000);
    sends.push({
      at: t + d,
      msg: JSON.parse(JSON.stringify(packState(t + skew, pos, quat, 2, 0))),
    });
  }
  sends.sort((a, b) => a.at - b.at);
  let next = 0;
  let worstPos = 0;
  let worstAngle = 0;
  let worstJump = 0;
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const prev = new THREE.Vector3();
  let prevTrue = null;
  // Skip the first two seconds while the clock offset settles
  for (let now = 0; now <= seconds * 1000; now += 1000 / 60) {
    while (next < sends.length && sends[next].at <= now) {
      track.push(unpackState(sends[next].msg), now);
      next++;
    }
    if (!track.ready) continue;
    track.sample(now, pos, quat);
    const shownAt = (now - track.offset - RENDER_DELAY_MS - skew) / 1000;
    const truth = path(shownAt);
    if (now > 2000 && shownAt < seconds - 0.5) {
      worstPos = Math.max(worstPos, pos.distanceTo(truth.pos));
      worstAngle = Math.max(worstAngle, quat.angleTo(truth.quat));
      if (prevTrue) {
        const own = truth.pos.distanceTo(prevTrue);
        worstJump = Math.max(worstJump, Math.abs(pos.distanceTo(prev) - own));
      }
    }
    prev.copy(pos);
    prevTrue = truth.pos.clone();
  }
  return {worstPos, worstAngle, worstJump, track};
}

{
  // The biplane at a gentle 100 kts (~100 units/s) in a wide turn
  const r = fly(circle(100, 2000));
  check(
    'A gentle turn is drawn on its path',
    r.worstPos < 0.5 && r.worstAngle < 0.01,
    `${r.worstPos.toFixed(2)} units, ${r.worstAngle.toFixed(4)} rad`
  );

  // The jet at 800 kts in a tight turn: 160 units between updates
  const jet = fly(circle(800, 1500));
  check(
    'A jet in a tight turn stays on the curve (not cutting corners)',
    jet.worstPos < 2,
    `${jet.worstPos.toFixed(2)} units`
  );

  // A clock minutes off doesn't matter
  const skewed = fly(circle(100, 2000), {skew: -3 * 60 * 1000});
  check(
    "A friend's clock being minutes off doesn't matter",
    skewed.worstPos < 0.5,
    `${skewed.worstPos.toFixed(2)} units`
  );

  // Updates arriving 40-250 ms late, out of order and bunched up
  const rng = mulberry32(3);
  const jittery = fly(circle(300, 2000), {delay: () => 40 + rng() * 210});
  check(
    'Late and bunched-up updates still give a smooth path',
    jittery.worstPos < 1 && jittery.worstJump < 1,
    `${jittery.worstPos.toFixed(2)} off, ${jittery.worstJump.toFixed(2)} jump`
  );

  // One in five updates lost
  const lossy = fly(circle(300, 2000), {
    delay: (i) => (i % 5 === 3 ? null : 60),
  });
  check(
    'Lost updates leave no gap',
    lossy.worstPos < 2 && lossy.worstJump < 1,
    `${lossy.worstPos.toFixed(2)} off, ${lossy.worstJump.toFixed(2)} jump`
  );

  // A loop: pitch all the way round (angles would flip at the top)
  const loop = (t) => {
    const a = t * 0.8;
    const quat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      a
    );
    const pos = new THREE.Vector3(
      0,
      500 + Math.sin(a) * 250,
      -Math.cos(a) * 250
    );
    return {pos, quat};
  };
  const looped = fly(loop);
  check(
    'A loop turns the plane the short way round all the way',
    looped.worstAngle < 0.01,
    `${looped.worstAngle.toFixed(4)} rad`
  );

  // A severe lag spike past RENDER_DELAY_MS blends back in without snapping
  const spiked = fly(circle(300, 1500), {
    delay: (i) => (i >= 40 && i <= 44 ? 550 : 60),
  });
  check(
    'A lag spike past the buffer blends back in without snapping',
    spiked.worstJump < 0.8,
    `${spiked.worstJump.toFixed(2)} jump`
  );
}

{
  // Stops sending: carries on briefly, then waits where it was heading
  const track = new PeerTrack();
  const path = (t) => ({
    pos: new THREE.Vector3(t * 100, 500, 0),
    quat: new THREE.Quaternion(),
  });
  let now = 0;
  const steps = Math.round(2000 / SEND_INTERVAL_MS);
  for (let i = 0; i <= steps; i++) {
    now = i * SEND_INTERVAL_MS + 50;
    const {pos, quat} = path((i * SEND_INTERVAL_MS) / 1000);
    track.push(
      unpackState(packState(i * SEND_INTERVAL_MS, pos, quat, 1, 0)),
      now
    );
  }
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  track.sample(now + 600, pos, quat);
  const a = pos.x;
  track.sample(now + 5000, pos, quat);
  const b = pos.x;
  track.sample(now + 9000, pos, quat);
  check(
    'A plane that stops sending carries on a moment, then waits',
    a > 200 && b > a && b <= 200 + 100 * 1.01 && pos.x === b,
    `${a.toFixed(1)} ${b.toFixed(1)} ${pos.x.toFixed(1)}`
  );

  // A warp: the plane jumps there instead of streaking across the map
  const warp = new PeerTrack();
  for (let i = 0; i < 6; i++) {
    const x = i < 3 ? i * 20 : 50000 + i * 20;
    warp.push(
      unpackState(
        packState(
          i * SEND_INTERVAL_MS,
          {x, y: 500, z: 0},
          new THREE.Quaternion(),
          1,
          0
        )
      ),
      i * SEND_INTERVAL_MS + 50
    );
  }
  let streaked = false;
  for (let now2 = 0; now2 < 3000; now2 += 16) {
    warp.sample(now2, pos, quat);
    if (pos.x > 100 && pos.x < 49000) streaked = true;
  }
  check('A warp jumps instead of streaking across the map', !streaked);
}

// --- Waggle and tag ---
{
  let widest = 0;
  for (let ms = 0; ms < WAGGLE_MS; ms += 10) {
    widest = Math.max(widest, Math.abs(waggleRoll(ms)));
  }
  check(
    'A waggle rocks the wings and settles',
    widest > 0.3 &&
      widest < 0.6 &&
      waggleRoll(-100) === 0 &&
      waggleRoll(WAGGLE_MS) === 0 &&
      Math.abs(waggleRoll(5)) < 0.05,
    widest.toFixed(3)
  );

  check(
    'A tag message is read, and junk is not',
    readTag({it: 'abc', plane: 'seaplane', n: 2, by: 'x', times: {abc: 1500}})
      ?.plane === 'seaplane' &&
      readTag({it: 'abc', n: 2, by: 'x', times: {abc: 1500, bad: -5}})?.times
        .abc === 1500 &&
      readTag({it: 'abc', n: 2, by: 'x', times: {bad: -5}})?.times.bad ===
        undefined &&
      readTag({it: null, plane: 'jet', n: 3})?.plane === null &&
      readTag({it: null, n: 3})?.by === '' &&
      readTag({it: 5, n: 1}) === null &&
      readTag({it: 'a', n: -1}) === null &&
      readTag({it: 'a', n: 1.5}) === null &&
      readTag(undefined) === null &&
      TAG_SPEED_BOOST === 1.15
  );

  {
    const t0 = readTag({
      it: 'a',
      plane: 'biplane',
      n: 1,
      by: 'a',
      times: {b: 4000},
    });
    const times1 = withTagTime(t0, 2500);
    const t1 = {...t0, it: 'b', times: times1};
    check(
      'Tag times fold in each stint, format as m:ss, and pick the lowest-time winner',
      tagTimeOf(t0, 'a', 2500) === 2500 &&
        tagTimeOf(t0, 'b', 2500) === 4000 &&
        times1.a === 2500 &&
        times1.b === 4000 &&
        tagTimeOf(t1, 'b', 3000) === 7000 &&
        formatTagTime(0) === '0:00' &&
        formatTagTime(9400) === '0:09' &&
        formatTagTime(75000) === '1:15' &&
        tagWinner(times1, ['a', 'b'])?.id === 'a' &&
        tagWinner(times1, ['a', 'b', 'c'])?.id === 'c' &&
        tagWinner(times1, ['a']) === null &&
        tagWinner({a: 200}, ['a', 'b']) === null
    );
  }

  {
    // a and b played 10 minutes; c arrived for the last 20 seconds
    const times = {a: 240000, b: 360000};
    const present = withTagPresence(
      {present: {a: 580000, b: 580000}},
      {a: 20000, b: 20000, c: 20000, gone: 0}
    );
    check(
      'Tag presence folds in, and a late joiner cannot win by arriving',
      present.a === 600000 &&
        present.c === 20000 &&
        !('gone' in present) &&
        tagWinner(times, ['a', 'b', 'c'], present)?.id === 'a' &&
        // Ranked by share of time in the game, not total time as it
        tagWinner({a: 200000, b: 150000}, ['a', 'b'], {a: 600000, b: 400000})
          ?.id === 'a' &&
        // Even shares share the win
        tagWinner({a: 0, b: 0, c: 5000}, ['b', 'a', 'c'], {
          a: 9000,
          b: 9000,
          c: 9000,
        })?.ids.join() === 'a,b' &&
        // Someone never counted in the game can't win
        tagWinner({a: 3000, b: 2000}, ['a', 'b', 'c'], {a: 9000, b: 9000})
          ?.id === 'b' &&
        // Older games without presence: lowest time as it, as before
        tagWinner({a: 3000, b: 2000}, ['a', 'b', 'c'], {})?.id === 'c' &&
        readTag({it: 'a', n: 1, present: {a: 5, b: -1}})?.present.a === 5 &&
        readTag({it: 'a', n: 1, present: {a: 5, b: -1}})?.present.b ===
          undefined &&
        readTag({it: 'a', n: 1})?.present !== undefined
    );
  }

  const a = {it: 'b', n: 1, by: 'a'};
  const b = {it: 'a', n: 1, by: 'b'};
  check(
    'Newer tags win, and two at once settle the same everywhere',
    isNewerTag(a, NO_TAG) &&
      isNewerTag({it: null, n: 2, by: 'z'}, a) &&
      !isNewerTag(NO_TAG, a) &&
      isNewerTag(a, b) &&
      !isNewerTag(b, a) &&
      !isNewerTag(a, a)
  );
  check(
    'A reassigned "it" (after someone leaves) gives way to a real tag',
    isNewerTag({it: 'c', n: 4, by: 'c'}, {it: 'a', n: 4, by: '~'})
  );
  check(
    'The next "it" is the same on every screen',
    nextIt(['k2p', '0az', 'm11']) === '0az' &&
      nextIt(new Set(['m11', '0az'])) === '0az' &&
      nextIt([]) === null
  );

  const me = new THREE.Vector3(0, 500, 0);
  const near = TAG_RADIUS - 1;
  check(
    'Tagging picks the nearest friend in reach and ignores paused friends',
    tagTarget(me, [
      {id: 'far', pos: new THREE.Vector3(TAG_RADIUS + 5, 500, 0)},
      {id: 'near', pos: new THREE.Vector3(0, 500 + near, 0)},
      {id: 'nearer', pos: new THREE.Vector3(near / 2, 500, 0)},
    ]) === 'nearer' &&
      tagTarget(me, [
        {id: 'paused', pos: new THREE.Vector3(10, 500, 0), paused: true},
        {id: 'active', pos: new THREE.Vector3(20, 500, 0), paused: false},
      ]) === 'active' &&
      tagTarget(me, [{id: 'x', pos: new THREE.Vector3(0, 0, 0)}]) === null &&
      tagTarget(me, []) === null &&
      FLAGS.paused === 16
  );
}

// Tag started from the buggy is flown in biplanes
check(
  'Tag from the buggy locks everyone to the biplane',
  tagPlane('buggy') === 'biplane' &&
    tagPlane('jet') === 'jet' &&
    readTag({it: 'abc', plane: 'buggy', n: 1})?.plane === 'biplane'
);

// Time as it stops while whoever's it is paused
{
  const clock = new TagClock(1000);
  clock.note(false, 3000);
  clock.note(true, 4000);
  const whilePaused = clock.elapsed(9000);
  clock.note(true, 9000);
  clock.note(false, 10000);
  const after = clock.elapsed(12000);
  clock.reset(20000);
  check(
    'Tag clock stops while paused and starts afresh on reset',
    whilePaused === 3000 && after === 5000 && clock.elapsed(20500) === 500,
    `${whilePaused} ${after} ${clock.elapsed(20500)}`
  );
}

// The relay's per-address limits on failed joins and new rooms
{
  const limit = new rules.PerMinute(3);
  for (let i = 0; i < 3; i++) limit.add('1.2.3.4', 1000);
  check(
    'Relay per-minute limit trips at its cap and resets after a minute',
    limit.over('1.2.3.4', 2000) &&
      !limit.over('5.6.7.8', 2000) &&
      !limit.over('1.2.3.4', 1000 + 61 * 1000) &&
      rules.MAX_ROOMS_STARTED > 0
  );
}

if (failed) {
  console.error('Flying together tests failed.');
  process.exit(1);
}
console.log('All flying together tests passed.');
