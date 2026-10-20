// --- RELAY RULES ---
// The relay's decisions as plain functions, so Node tests can check them
// without Cloudflare (scripts/test-multiplayer.js). The game keeps its own
// copy of the room code alphabet and close codes in multiplayer-logic.js; the
// test checks the two match.

// Room codes: 4 characters with the look-alikes left out (0/O, 1/I/L), about
// 920,000 codes
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;
export const MAX_PLAYERS = 4;
// Bigger messages are dropped (a position update is ~120 bytes)
export const MAX_MESSAGE_BYTES = 1024;
// An empty room can still be rejoined for this long (a reload, a dropped
// connection), then it's forgotten
export const EMPTY_ROOM_MS = 10 * 60 * 1000;
// Failed joins (a wrong or ended code) allowed per address per minute
export const MAX_FAILED_JOINS = 10;
// Messages a player may send: RATE_PER_SECOND on average, in bursts of up to
// RATE_BURST (the game sends 5 a second); faster, and they're disconnected
export const RATE_PER_SECOND = 20;
export const RATE_BURST = 40;

// Why a join was refused: WebSocket close codes the game shows a message for
export const CLOSE = {
  full: 4001,
  notFound: 4004,
  taken: 4009,
  badRequest: 4000,
  tooFast: 4029,
};

export function isRoomCode(code) {
  if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) {
    return false;
  }
  for (const c of code) if (!ROOM_CODE_ALPHABET.includes(c)) return false;
  return true;
}

// `allowed` is a comma-separated list of origins; a `*.` host matches any
// subdomain, and localhost or 127.0.0.1 match on any port (local testing)
export function isAllowedOrigin(origin, allowed) {
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    if (url.protocol === 'http:' || url.protocol === 'https:') return true;
  }
  for (const entry of (allowed || '').split(',')) {
    const pattern = entry.trim();
    if (!pattern) continue;
    if (pattern === origin) return true;
    const wild = pattern.match(/^([a-z]+:\/\/)\*\.(.+)$/);
    if (
      wild &&
      `${url.protocol}//` === wild[1] &&
      url.hostname.endsWith(`.${wild[2]}`)
    ) {
      return true;
    }
  }
  return false;
}

export function cleanName(name) {
  return String(name || '')
    .replace(/\p{Cc}/gu, '')
    .trim()
    .slice(0, 16);
}

// Whether a player may come in. mode: 'create' (a new room, refused if the
// code is in use) or 'join' (refused if there's no such room, or it has
// ended; coming back after a dropped connection is a join too, so only the
// game's own random codes ever start a room). `info` is what the room stored when it was created: {seed,
// host, emptySince}. Returns {ok: true, info} with the room's info to keep,
// or {ok: false, code, reason}.
export function admit({mode, players, info, now, seed, host}) {
  const live =
    players > 0 ||
    (!!info &&
      info.emptySince !== null &&
      now - info.emptySince < EMPTY_ROOM_MS);
  const fresh = () => {
    const n = Number(seed);
    if (!Number.isSafeInteger(n)) {
      return {ok: false, code: CLOSE.badRequest, reason: 'bad seed'};
    }
    return {ok: true, info: {seed: n, host: cleanName(host), emptySince: null}};
  };
  if (players >= MAX_PLAYERS) {
    return {ok: false, code: CLOSE.full, reason: 'full'};
  }
  if (mode === 'create') {
    return live ? {ok: false, code: CLOSE.taken, reason: 'taken'} : fresh();
  }
  if (mode === 'join') {
    return live
      ? {ok: true, info: {...info, emptySince: null}}
      : {ok: false, code: CLOSE.notFound, reason: 'not found'};
  }
  return {ok: false, code: CLOSE.badRequest, reason: 'bad mode'};
}

// A player's message allowance: a token bucket {tokens, at}, refilled at
// RATE_PER_SECOND up to RATE_BURST. Takes one for a message at `now` (ms);
// returns false when there's none left.
export function takeMessage(bucket, now) {
  bucket.tokens = Math.min(
    RATE_BURST,
    bucket.tokens + ((now - bucket.at) / 1000) * RATE_PER_SECOND
  );
  bucket.at = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

// A short id for a new player, unique in the room
export function newPlayerId(taken, rng = Math.random) {
  for (;;) {
    const id = Math.floor(rng() * 36 ** 3)
      .toString(36)
      .padStart(3, '0');
    if (!taken.includes(id)) return id;
  }
}

// A player's message as passed on to the others: any JSON object, tagged
// with its sender as `f`. Returns null for anything else.
export function relayed(raw, from) {
  if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return null;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
  msg.f = from;
  return JSON.stringify(msg);
}
