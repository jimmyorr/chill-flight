// --- CHILL FLIGHT RELAY ---
// A Cloudflare Worker with one Durable Object per room, for flying together.
// It knows nothing about the game: whatever a player sends is passed on to
// everyone else in their room, tagged with who sent it, so new game features
// never need the relay redeployed. Rooms hibernate between messages, and
// the free Workers plan stops rather than bills when it runs out.
//
// Connect: wss://<relay>/room/<CODE>?mode=create|join&seed=<n>&name=<host>
// The relay sends {t: 'welcome', id, seed, host, peers}, then {t: 'joined',
// f} and {t: 'left', f} as players come and go. A refused join is closed
// with one of the codes in rules.js (CLOSE).
import {DurableObject} from 'cloudflare:workers';
import {
  EMPTY_ROOM_MS,
  MAX_FAILED_JOINS,
  RATE_BURST,
  CLOSE,
  admit,
  isAllowedOrigin,
  isRoomCode,
  newPlayerId,
  relayed,
  takeMessage,
} from './rules.js';

// Each connection's message allowance (takeMessage). In memory only: a room
// waking from hibernation starts everyone afresh, which is fine
const buckets = new WeakMap();

// Failed joins per address, for this Worker instance only (a rough brake on
// guessing codes, not an exact count)
const failures = new Map();

function failedTooOften(ip, now) {
  const f = failures.get(ip);
  if (!f || now > f.resetAt) return false;
  return f.count >= MAX_FAILED_JOINS;
}

function noteFailure(ip, now) {
  const f = failures.get(ip);
  if (!f || now > f.resetAt) {
    failures.set(ip, {count: 1, resetAt: now + 60 * 1000});
  } else {
    f.count++;
  }
  if (failures.size > 10000) failures.clear();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!match) return new Response('Chill Flight relay', {status: 404});
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', {status: 426});
    }
    if (!isAllowedOrigin(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
      return new Response('Forbidden', {status: 403});
    }
    const code = match[1].toUpperCase();
    if (!isRoomCode(code)) return new Response('Bad room', {status: 400});
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const now = Date.now();
    if (failedTooOften(ip, now)) {
      return new Response('Too many tries', {status: 429});
    }
    const room = env.ROOMS.get(env.ROOMS.idFromName(code));
    const response = await room.fetch(request);
    if (response.headers.get('X-Relay-Refused')) noteFailure(ip, now);
    return response;
  },
};

export class Room extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const sockets = this.ctx.getWebSockets();
    const decision = admit({
      mode: url.searchParams.get('mode') || 'join',
      players: sockets.length,
      info: (await this.ctx.storage.get('info')) || null,
      now: Date.now(),
      seed: url.searchParams.get('seed'),
      host: url.searchParams.get('name'),
    });
    const [client, server] = Object.values(new WebSocketPair());
    if (!decision.ok) {
      // Accepted only to say why (a WebSocket can't read an HTTP status)
      server.accept();
      server.close(decision.code, decision.reason);
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {'X-Relay-Refused': decision.reason},
      });
    }

    await this.ctx.storage.put('info', decision.info);
    await this.ctx.storage.deleteAlarm();
    const peers = sockets.map((ws) => ws.deserializeAttachment().id);
    const id = newPlayerId(peers);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({id});
    server.send(
      JSON.stringify({
        t: 'welcome',
        id,
        seed: decision.info.seed,
        host: decision.info.host,
        peers,
      })
    );
    this.broadcast(JSON.stringify({t: 'joined', f: id}), server);
    return new Response(null, {status: 101, webSocket: client});
  }

  broadcast(text, except) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(text);
      } catch {
        /* closing */
      }
    }
  }

  async webSocketMessage(ws, message) {
    let bucket = buckets.get(ws);
    if (!bucket) {
      bucket = {tokens: RATE_BURST, at: Date.now()};
      buckets.set(ws, bucket);
    }
    if (!takeMessage(bucket, Date.now())) {
      ws.close(CLOSE.tooFast, 'too fast');
      await this.playerLeft(ws, CLOSE.tooFast);
      return;
    }
    const text = relayed(message, ws.deserializeAttachment().id);
    if (text) this.broadcast(text, ws);
  }

  async webSocketClose(ws, code) {
    await this.playerLeft(ws, code);
  }

  async webSocketError(ws) {
    await this.playerLeft(ws, 1011);
  }

  async playerLeft(ws, code) {
    try {
      ws.close(code >= 1000 && code < 5000 && code !== 1005 ? code : 1000);
    } catch {
      /* already closed */
    }
    this.broadcast(
      JSON.stringify({t: 'left', f: ws.deserializeAttachment().id}),
      ws
    );
    const others = this.ctx.getWebSockets().filter((s) => s !== ws);
    if (others.length > 0) return;
    // Keep the room a while for anyone coming back, then forget it
    const info = await this.ctx.storage.get('info');
    if (info) {
      await this.ctx.storage.put('info', {...info, emptySince: Date.now()});
    }
    await this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_MS + 1000);
  }

  async alarm() {
    if (this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
    }
  }
}
