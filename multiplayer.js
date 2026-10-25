// --- FLY TOGETHER ---
// Flying with up to three friends: the 👥 button on the pause menu starts a
// room and shares a link (or a 4-character code, for the apps), and friends
// who open it fly the same world and see each other's planes, names and
// smoke. Everyone's smoke takes their livery's colour while in a room.
// Friends out of view show at the screen's edge and on the maps; H (or the
// quick menu's 👋) waggles your wings at them; and the panel starts a game
// of tag. Empty seats can be filled with bots (bot-logic.js): the player
// who turns them on flies them on their device, and sends them along with
// their own updates, so to everyone else they're players like any other.
//
// A small relay passes messages between the players in a room
// (relay/README.md); it knows nothing about the game. Each player sends
// where they are ten times a second, and draws everyone else a moment
// behind, smoothed between updates (multiplayer-logic.js). If the relay
// can't be reached, the game carries on solo. Messages:
//   {t: 'hello', name, plane, livery, tag}  who you are; on joining and on
//                                            change (tag: the game so far)
//   {t: 's', ts, p, q, v, fl}          where you are (packState)
//   {t: 'waggle'}                      a wave
//   {t: 'tag', it, n}                  who's it (multiplayer-logic.js)
// A player's bots have ids "<their id>~<k>". {t: 'bot', k, hello} (as a
// hello's name, plane, livery), {t: 'bot', k, waggle: true} and {t: 'bot',
// k, bye: true} speak for one; their positions ride along in the player's
// own update as `b: [{k, p, q, v, fl}]`; and {t: 'bots', on: false} asks
// whoever brought them to take them away. (Their own message type, so an
// older game in the room just doesn't see them.)
// and from the relay: welcome, joined, left (relay/src/index.js).
import * as THREE from 'three';
import {log} from './logger.js';
import {withTimeout} from './network.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {BASE_FLIGHT_SPEED, PLANE_HANDLING, WATER_LEVEL} from './constants.js';
import {scene} from './scene.js';
import {camera} from './sky.js';
import {setGearExtension} from './twin.js';
import {setBuggyHoverFold} from './buggy-model.js';
import {PROP_SPIN, newPropSpin, stepPropSpin} from './prop-spin-logic.js';
import {inputManager} from './game-input-bindings.js';
import {formatDistance, screenPlacement} from './waypoint.js';
import {
  activePlaneType,
  getMaxFlightSpeedMult,
  planeGroup,
  planeHandling,
  setLockedPlane,
} from './airplane.js';
import {getElevation, sampleGround} from './terrain-geometry.js';
import {sampleRoad} from './terrain-chunks.js';
import {PLANE_BUILDERS, buildPlaneModel} from './plane-models.js';
import {Achievements} from './achievements.js';
import {isSmokeOn, setSmokeTint, smokeColor, trailSmoke} from './particles.js';
import {
  BOT_PLANES,
  REJOIN_DISTANCE,
  fanSpot,
  newBot,
  rejoin as rejoinBot,
  stepBot,
} from './bot-logic.js';
import {
  CLOSE,
  FLAGS,
  MAX_PLAYERS,
  NO_TAG,
  PAUSED_SEND_INTERVAL_MS,
  PeerTrack,
  QUIET_MS,
  RENDER_DELAY_MS,
  SEND_INTERVAL_MS,
  TAG_GRACE_MS,
  TAG_SPEED_BOOST,
  TagClock,
  WAGGLE_MS,
  cleanName,
  formatTagTime,
  inviteUrl,
  isNewerTag,
  makeRoomCode,
  nextIt,
  packState,
  parseRoomCode,
  CALLSIGNS,
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
} from './multiplayer-logic.js';

// The relay (relay/README.md); empty hides flying together. ?relay= uses
// another one, e.g. ws://localhost:8787 for a local `wrangler dev`.
const DEFAULT_RELAY = 'wss://chill-flight-relay.jimmyorr.workers.dev';
const RELAY = ChillFlightLogic.RELAY_PARAM || DEFAULT_RELAY;
// Invite links from the apps point at the website
const WEB_URL = 'https://chillflight.app/';
const CONNECT_TIMEOUT_MS = 6000;
// Waits before trying to get back into the room after the connection drops
const RECONNECT_DELAYS_MS = [1000, 3000, 8000];
// Hidden this long (another app, a locked phone), the connection is closed,
// and opened again on coming back
const HIDDEN_DISCONNECT_MS = 60 * 1000;
// Paused this long, the same, so a game left paused doesn't keep the room
// awake (and using up the relay's free allowance); flying on reconnects
const PAUSED_DISCONNECT_MS = 15 * 60 * 1000;
const NAME_KEY = 'chill_flight_name';
const defaultCallsign = randomCallsign();

const overlay = document.getElementById('fly-overlay');
const openBtn = document.getElementById('fly-together-btn');
const counter = document.getElementById('fly-together-counter');
const nameInput = document.getElementById('fly-name');
const codeInput = document.getElementById('fly-code');
const inviteBtn = document.getElementById('fly-invite-btn');
const joinBtn = document.getElementById('fly-join-btn');
const shareBtn = document.getElementById('fly-share-btn');
const leaveBtn = document.getElementById('fly-leave-btn');
const soloSection = document.getElementById('fly-solo');
const roomSection = document.getElementById('fly-room');
const roomCodeText = document.getElementById('fly-room-code');
const playersList = document.getElementById('fly-players');
const statusText = document.getElementById('fly-status');
const tagBtn = document.getElementById('fly-tag-btn');
const tagChip = document.getElementById('tag-chip');
const tagHint = document.getElementById('fly-tag-hint');
const botsInput = document.getElementById('fly-bots-input');
const botsBtn = document.getElementById('fly-bots-btn');
const markersEl = document.getElementById('friend-markers');
const waveBtn = document.getElementById('mobile-wave-btn');

let socket = null;
// {code, id, seed, host} while in a room
let room = null;
const peers = new Map();
let busy = false;
let leaving = false;
let reconnectTry = 0;
let reconnectTimer = null;
let hiddenTimer = null;
let suspended = false;
let pausedSince = null;
// Fly to a friend as soon as one is seen (after joining their flight)
let arriveOnJoin = false;
let sendTimer = null;
let lastSendAt = 0;
// Monotonic clock advancing by smoothed frame delta while flying, so sent
// timestamps and sampled positions match the local plane's physics step
let smoothNow = null;
let sentProfile = '';
// When your own last waggle started (performance.now())
let waggleAt = -Infinity;
// The game of tag ({it, plane, n, by, times}), and when its "it" became it
let tag = NO_TAG;
let tagSince = 0;
// Time as it, stopped while whoever's it is paused
const tagClock = new TagClock();
let gatherToId = null;
// Bots this player brought, by k ('1' to '3'): {bot (bot-logic.js), peer,
// name, livery, plane (out of games)}; and whether they want them
const myBots = new Map();
let botsWanted = false;
// A game of tag just started: this player's bots are to gather for it
let gatherBotsPending = false;
// Who was it before whoever's it now (a bot doesn't tag them straight back)
let tagBefore = null;

function myName() {
  try {
    return cleanName(localStorage.getItem(NAME_KEY)) || defaultCallsign;
  } catch {
    return defaultCallsign;
  }
}

function myLivery() {
  return Math.max(0, ChillFlightLogic.PLANE_COLORS.indexOf(state.planeColor));
}

function isNativeApp() {
  return (
    (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) ||
    window.__TAURI__ !== undefined
  );
}

function toast(title) {
  Achievements.toast({emoji: '👥', label: 'FLY TOGETHER', title});
}

function setStatus(text) {
  if (statusText) statusText.textContent = text;
}

function send(msg) {
  if (socket?.readyState !== WebSocket.OPEN) return;
  // A connection that has stalled: skip rather than queue up old positions
  if (socket.bufferedAmount > 16 * 1024) return;
  socket.send(JSON.stringify(msg));
}

function sendHello() {
  const hello = {
    t: 'hello',
    name: myName(),
    plane: activePlaneType,
    livery: myLivery(),
  };
  if (tag.n > 0) {
    hello.tag = tag.it ? {...tag, ...tagTotals()} : tag;
  }
  sentProfile = `${hello.name}|${hello.plane}|${hello.livery}`;
  send(hello);
}

// --- OTHER PLAYERS' PLANES ---

function hexColor(livery) {
  const c = ChillFlightLogic.PLANE_COLORS[livery] ?? 0xffffff;
  return `#${c.toString(16).padStart(6, '0')}`;
}

function disposeGroup(group) {
  scene.remove(group);
  group.traverse((child) => {
    child.geometry?.dispose();
    const mat = child.material;
    if (mat) {
      mat.map?.dispose();
      mat.dispose();
    }
  });
}

// (Re)builds a player's plane for their plane type, livery and name
function buildPeer(peer) {
  if (peer.group) disposeGroup(peer.group);
  const type = PLANE_BUILDERS[peer.plane] ? peer.plane : 'biplane';
  const group = new THREE.Group();
  const model = buildPlaneModel(type, peer.livery);
  peer.materials = [];
  model.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      peer.materials.push(child.material);
    }
  });
  group.add(model);
  group.visible = false;
  scene.add(group);
  peer.group = group;
  peer.model = model;
  peer.opacity = 1;
  peer.css = hexColor(peer.livery);
  if (peer.marker) peer.marker.style.setProperty('--friend-color', peer.css);
  peer.props = model.propGroups || [model.propGroup];
  peer.smokeLast = new THREE.Vector3();
  peer.smokeColor = smokeColor(ChillFlightLogic.PLANE_COLORS[peer.livery]);
  peer.gear = 0;
  peer.hoverFold = 0;
}

// A friend's marker: at the screen's edge when they're out of view
function addMarker(peer) {
  if (!markersEl) return;
  const marker = document.createElement('div');
  marker.className = 'friend-marker';
  marker.hidden = true;
  const mark = document.createElement('div');
  mark.className = 'friend-mark';
  const text = document.createElement('div');
  text.className = 'friend-text';
  marker.append(mark, text);
  markersEl.append(marker);
  peer.marker = marker;
  peer.markerText = text;
  peer.markerKey = '';
}

function addPeer(id) {
  if (peers.has(id)) return peers.get(id);
  const peer = {
    id,
    name: '',
    plane: null,
    livery: 0,
    track: new PeerTrack(),
    group: null,
    marker: null,
    // When their waggle shows (performance.now(), after RENDER_DELAY_MS)
    waggleAt: -Infinity,
    // When they arrived (performance.now()), for their time in a game of tag
    joinedAt: performance.now(),
  };
  addMarker(peer);
  peers.set(id, peer);
  return peer;
}

function removePeer(id) {
  const peer = peers.get(id);
  if (!peer) return;
  if (peer.group) disposeGroup(peer.group);
  peer.marker?.remove();
  peers.delete(id);
}

function onHello(peer, msg) {
  const name = cleanName(msg.name) || defaultCallsign;
  const plane = typeof msg.plane === 'string' ? msg.plane : 'biplane';
  const livery =
    Number.isInteger(msg.livery) &&
    msg.livery >= 0 &&
    msg.livery < ChillFlightLogic.PLANE_COLORS.length
      ? msg.livery
      : 0;
  const isNew = !peer.name;
  if (peer.name !== name || peer.plane !== plane || peer.livery !== livery) {
    Object.assign(peer, {name, plane, livery});
    buildPeer(peer);
  }
  if (isNew && peer.announce) toast(`${name} joined`);
  applyTag(readTag(msg.tag));
  renderPanel();
}

function onMessage(event) {
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }
  if (!msg || typeof msg.f !== 'string' || msg.f === room?.id) return;
  if (msg.t === 'joined') {
    addPeer(msg.f).announce = true;
    sendHello();
    // Someone's here: a bot makes room for them
    syncBots();
    for (const k of myBots.keys()) sendBotHello(k);
  } else if (msg.t === 'left') {
    const gone = [
      msg.f,
      ...[...peers.keys()].filter((id) => ownerOf(id) === msg.f),
    ];
    const name = peers.get(msg.f)?.name;
    for (const id of gone) removePeer(id);
    if (name) toast(`${name} left`);
    for (const id of gone) tagAfterLeaving(id);
    syncBots();
    renderPanel();
  } else if (msg.t === 'hello') {
    onHello(addPeer(msg.f), msg);
    syncBots();
  } else if (msg.t === 's') {
    // Stamped on arrival with the real clock: smoothNow stands still while
    // paused or hidden, and arrivals stamped with it then would put the
    // plane up to a second ahead for half a minute after
    const heardAt = performance.now();
    const s = unpackState(msg);
    if (s) {
      const peer = addPeer(msg.f);
      peer.heardAt = heardAt;
      peer.track.push(s, peer.heardAt);
    }
    // Their bots, at the same moment
    if (Array.isArray(msg.b)) {
      for (const b of msg.b.slice(0, MAX_PLAYERS)) {
        if (typeof b?.k !== 'string') continue;
        const bs = unpackState({...b, t: 's', ts: msg.ts});
        if (!bs) continue;
        const peer = addPeer(botId(msg.f, b.k));
        peer.isBot = true;
        peer.heardAt = heardAt;
        peer.track.push(bs, heardAt);
      }
    }
  } else if (msg.t === 'waggle') {
    // Shown when their plane, drawn a moment behind, gets there
    addPeer(msg.f).waggleAt = performance.now() + RENDER_DELAY_MS;
    botsWaveBack(msg.f);
  } else if (msg.t === 'bot') {
    if (typeof msg.k !== 'string' || !msg.k) return;
    const id = botId(msg.f, msg.k);
    if (msg.bye) {
      botGone(id);
    } else if (msg.waggle) {
      addPeer(id).waggleAt = performance.now() + RENDER_DELAY_MS;
      botsWaveBack(id);
    } else if (msg.hello) {
      const peer = addPeer(id);
      peer.isBot = true;
      onHello(peer, {...msg.hello, tag: undefined});
      syncBots();
    }
  } else if (msg.t === 'bots') {
    if (msg.on === false && botsWanted) {
      botsWanted = false;
      syncBots();
    }
    renderPanel();
  } else if (msg.t === 'tag') {
    applyTag(readTag({...msg, by: msg.f}));
  }
}

// --- TAG ---

function nameOf(id) {
  return peers.get(id)?.name || 'A friend';
}

function refreshTag() {
  const inTag = !!room && !!tag.it;
  const amIt = inTag && tag.it === room.id;
  const prevMax = getMaxFlightSpeedMult();
  const wasAtMax = state.targetFlightSpeed >= prevMax - 0.02;
  setLockedPlane(inTag ? tag.plane : null);
  state.mpSpeedBoost = amIt ? TAG_SPEED_BOOST : 1;
  const newMax = getMaxFlightSpeedMult();
  if (wasAtMax && inTag) {
    state.targetFlightSpeed = newMax;
  } else if (state.targetFlightSpeed > newMax) {
    state.targetFlightSpeed = newMax;
  }
  state.mpForceSmoke = inTag && !amIt;
  hooks.syncSmokeUI?.();

  for (const peer of peers.values()) {
    peer.markerKey = '';
  }
  if (tagChip) {
    tagChip.hidden = !inTag;
    tagChip.classList.toggle('mine', amIt);
    if (inTag) {
      tagChip.textContent = amIt
        ? "You're it · tag a friend"
        : `${nameOf(tag.it)} is it`;
    }
  }
  renderPanel();
}

// How long whoever's it has been it (ms), not counting time paused
function itElapsed() {
  return tag.it ? tagClock.elapsed(performance.now()) : 0;
}

// The game's times as it and times in it, with the current stint folded in.
// Someone who arrived during the stint is only counted from when they did.
function tagTotals() {
  const elapsed = itElapsed();
  const now = performance.now();
  const stints = {};
  if (tag.it && room) {
    stints[room.id] = Math.min(elapsed, now - room.joinedAt);
    for (const peer of peers.values()) {
      stints[peer.id] = Math.min(elapsed, now - peer.joinedAt);
    }
  }
  return {
    times: withTagTime(tag, elapsed),
    present: withTagPresence(tag, stints),
  };
}

// A friend whose updates have stopped (a stalled connection), or who has
// paused: drawn as a ghost, and can't be tagged
function isAway(peer, now) {
  if (peer.track.latest?.flags & FLAGS.paused) return true;
  return now - (peer.heardAt ?? now) > QUIET_MS;
}

// Stops the clock on time as it while whoever's it is paused or away
function noteItPaused(now) {
  if (!tag.it || !room) return;
  const peer = peers.get(tag.it);
  const paused =
    tag.it === room.id ? !!state.isPaused : !!peer && isAway(peer, now);
  tagClock.note(paused, now);
}

function setTag(next) {
  const was = tag.it;
  if (next.it !== was) tagBefore = was;
  tag = next;
  tagSince = performance.now();
  tagClock.reset(tagSince);
  if (!was && tag.it && tag.it !== room?.id && tag.by === tag.it) {
    gatherToId = tag.it;
  } else if (!tag.it) {
    gatherToId = null;
  }
  gatherBotsPending = !was && !!tag.it && tag.by === tag.it;
  if (tag.it !== was) {
    if (!tag.it) {
      const win = room
        ? tagWinner(tag.times, [room.id, ...peers.keys()], tag.present)
        : null;
      if (win?.ids.length > 1) {
        const names = win.ids.map((id) =>
          id === room.id ? 'You' : nameOf(id)
        );
        const who = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
        toast(`Tag is over · ${who} share the win`);
      } else if (win) {
        const who = win.id === room.id ? 'You' : nameOf(win.id);
        toast(`Tag is over · ${who} won (${formatTagTime(win.ms)} as it)`);
      } else {
        toast('Tag is over');
      }
    } else if (tag.it === room?.id) toast("You're it");
    else if (was === room?.id) toast(`You tagged ${nameOf(tag.it)}`);
    else toast(`${nameOf(tag.it)} is it`);
  }
  refreshTag();
  if (gatherToId && !state.isIntroTransitionActive) gatherForTag();
}

// A game of tag as someone else sent it: kept if it's newer than ours
function applyTag(next) {
  if (!next || !room || !isNewerTag(next, tag)) return;
  if (next.it && next.it !== room.id && !peers.has(next.it)) {
    // It's someone who's already gone
    setTag({
      it: nextIt([room.id, ...peers.keys()]),
      plane: next.plane,
      n: next.n + 1,
      by: '~',
      times: next.times,
      present: next.present,
    });
    return;
  }
  setTag(next);
}

// Says who's it now (null ends the game)
function sendTag(it) {
  if (!room) return;
  const starting = !tag.it && !!it;
  const {times, present} = starting ? {times: {}, present: {}} : tagTotals();
  const plane = it
    ? starting
      ? tagPlane(activePlaneType)
      : tag.plane || tagPlane(activePlaneType)
    : null;
  const next = {it, plane, n: tag.n + 1, by: room.id, times, present};
  setTag(next);
  send({t: 'tag', ...next});
}

// Someone left: if they were it, the lowest id still here is (worked out
// the same on every screen); alone, the game's over
function tagAfterLeaving(id) {
  if (!tag.it) return;
  const {times, present} = tagTotals();
  if (peers.size === 0) {
    setTag({it: null, plane: null, n: tag.n + 1, by: '~', times, present});
  } else if (tag.it === id) {
    setTag({
      it: nextIt([room.id, ...peers.keys()]),
      plane: tag.plane,
      n: tag.n + 1,
      by: '~',
      times,
      present,
    });
  }
}

// --- WAVING ---

function wave() {
  if (!room || state.isPaused) return;
  if (state.isOnGround || state.isOnWater) return;
  const now = performance.now();
  if (now - waggleAt < WAGGLE_MS) return;
  waggleAt = now;
  send({t: 'waggle'});
  botsWaveBack(room.id);
}

// --- BOTS ---

const BOT_MARK = ' 🤖';
// Bots wave back at a waggle within this distance, after a moment
const WAVE_BACK_DISTANCE = 1500;
// A buggy steps up onto a road's deck from this far below it (buggy.js)
const ROAD_STEP_UP = 12;

const _road = {};
const _ground = {};
// Whether the last surfaceAt was the water
let surfaceIsWater = false;

// Where a buggy at height y rests at (x, z), as buggy.js has it: a road's
// deck it's on, the drawn ground, or the water it hovers on
function surfaceAt(x, z, y) {
  surfaceIsWater = false;
  if (sampleRoad(x, z, _road, y) && y >= _road.height - ROAD_STEP_UP) {
    return _road.height;
  }
  sampleGround(x, z, _ground);
  if (
    ChillFlightLogic.buggyOverWater(
      _ground.height,
      getElevation(x, z),
      WATER_LEVEL
    )
  ) {
    surfaceIsWater = true;
    return Math.max(
      _ground.height,
      WATER_LEVEL - ChillFlightLogic.BUGGY_HOVER.FLOAT_DEPTH
    );
  }
  return _ground.height;
}

function botId(owner, k) {
  return `${owner}~${k}`;
}

// Who brought a bot (null for a player)
function ownerOf(id) {
  const i = id.indexOf('~');
  return i > 0 ? id.slice(0, i) : null;
}

// The player's own plane as a bot follows it: {x, y, z, heading, speed}
// (speed in units a second)
function leaderNow() {
  planeGroup.getWorldQuaternion(_botQuat);
  _botEuler.setFromQuaternion(_botQuat, 'YXZ');
  const p = planeGroup.position;
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    heading: _botEuler.y,
    speed: (state.flightSpeedMultiplier || 0) * BASE_FLIGHT_SPEED * 60,
  };
}

// Everyone in the room where they are now, for the bots' games of tag:
// [{id, x, y, z, vx, vy, vz, paused}]. Others are as drawn; this player's
// own bots as flown.
function playerSpots(rawNow) {
  const spots = [];
  const units = BASE_FLIGHT_SPEED * 60;
  const add = (id, pos, quat, speed, paused) => {
    _botFwd.set(0, 0, -1).applyQuaternion(quat).multiplyScalar(speed);
    spots.push({
      id,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: _botFwd.x,
      vy: _botFwd.y,
      vz: _botFwd.z,
      paused,
    });
  };
  planeGroup.getWorldQuaternion(_botQuat);
  add(
    room.id,
    planeGroup.position,
    _botQuat,
    (state.flightSpeedMultiplier || 0) * units,
    !!state.isPaused
  );
  for (const peer of peers.values()) {
    if (ownerOf(peer.id) === room.id || !peer.group?.visible) continue;
    add(
      peer.id,
      peer.group.position,
      peer.group.quaternion,
      (peer.track.latest?.speed || 0) * units,
      isAway(peer, rawNow)
    );
  }
  for (const {bot, peer} of myBots.values()) {
    _botEuler.set(bot.pitch, bot.heading, bot.bank, 'YXZ');
    _botQuat.setFromEuler(_botEuler);
    _botPos.set(bot.x, bot.y, bot.z);
    add(peer.id, _botPos, _botQuat, bot.speed, !!state.isPaused);
  }
  return spots;
}

function sendBotHello(k) {
  const mine = myBots.get(k);
  if (!mine) return;
  const hello = {name: mine.name, plane: mine.bot.plane, livery: mine.livery};
  onHello(mine.peer, hello);
  send({t: 'bot', k, hello});
}

// A name and livery no one in the room has
function botLook() {
  const names = new Set([myName(), ...[...peers.values()].map((p) => p.name)]);
  const free = CALLSIGNS.filter(
    (c) => !names.has(c) && !names.has(c + BOT_MARK)
  );
  const callsign = free.length
    ? free[Math.floor(Math.random() * free.length)]
    : randomCallsign();
  const used = new Set([
    myLivery(),
    ...[...peers.values()].map((p) => p.livery),
  ]);
  const colours = ChillFlightLogic.PLANE_COLORS.map((_, i) => i).filter(
    (i) => !used.has(i)
  );
  const livery = colours.length
    ? colours[Math.floor(Math.random() * colours.length)]
    : Math.floor(Math.random() * ChillFlightLogic.PLANE_COLORS.length);
  return {name: callsign + BOT_MARK, livery};
}

function addBot(k) {
  const home = BOT_PLANES[Math.floor(Math.random() * BOT_PLANES.length)];
  const bot = newBot(Number(k) - 1, leaderNow(), tag.it ? tag.plane : home);
  const peer = addPeer(botId(room.id, k));
  peer.isBot = true;
  peer.announce = true;
  myBots.set(k, {bot, peer, plane: home, ...botLook()});
  sendBotHello(k);
}

// One of this player's bots flies off
function dismissBot(k) {
  const mine = myBots.get(k);
  if (!mine) return;
  send({t: 'bot', k, bye: true});
  botGone(mine.peer.id);
}

function botGone(id) {
  const peer = peers.get(id);
  if (!peer) return;
  if (ownerOf(id) === room?.id) myBots.delete(id.slice(id.indexOf('~') + 1));
  removePeer(id);
  if (peer.name) toast(`${peer.name} flew off`);
  tagAfterLeaving(id);
  renderPanel();
}

// Fills the empty seats with this player's bots when they want them, a
// bot making room whenever someone arrives. Only one player in a room
// brings bots: should two turn them on at once, the lower id keeps theirs.
function syncBots() {
  if (!room) return;
  let people = 1;
  let othersBots = 0;
  let otherOwner = null;
  for (const id of peers.keys()) {
    const owner = ownerOf(id);
    if (!owner) people++;
    else if (owner !== room.id) {
      othersBots++;
      if (!otherOwner || owner < otherOwner) otherOwner = owner;
    }
  }
  const want =
    botsWanted && !(otherOwner && otherOwner < room.id)
      ? Math.max(0, MAX_PLAYERS - people - othersBots)
      : 0;
  // Someone arrived with a bot's name: the bot takes another
  for (const [k, mine] of myBots) {
    const clash = [...peers.values()].some(
      (p) => !ownerOf(p.id) && p.name + BOT_MARK === mine.name
    );
    if (clash || myName() + BOT_MARK === mine.name) {
      mine.name = botLook().name;
      sendBotHello(k);
    }
  }
  // The newest first
  const ks = [...myBots.keys()].sort().reverse();
  while (myBots.size > want) dismissBot(ks.shift());
  for (let k = 1; myBots.size < want && k <= MAX_PLAYERS; k++) {
    if (!myBots.has(String(k))) addBot(String(k));
  }
  renderPanel();
}

// Any bots in the room, this player's or someone else's
function botsInRoom() {
  for (const id of peers.keys()) if (ownerOf(id)) return true;
  return false;
}

function setBotsWanted(on) {
  botsWanted = on;
  // Someone else's bots: ask them to go
  if (!on) send({t: 'bots', on: false});
  syncBots();
}

// This player's bots near a friend who waggled wave back, a moment later
function botsWaveBack(id) {
  if (!room || ownerOf(id) || !myBots.size) return;
  const at =
    id === room.id ? planeGroup.position : peers.get(id)?.group?.position;
  if (!at) return;
  for (const [k, {bot, peer}] of myBots) {
    if (
      Math.hypot(bot.x - at.x, bot.y - at.y, bot.z - at.z) > WAVE_BACK_DISTANCE
    ) {
      continue;
    }
    setTimeout(
      () => {
        if (myBots.get(k)?.peer !== peer) return;
        peer.waggleAt = performance.now() + RENDER_DELAY_MS;
        send({t: 'bot', k, waggle: true});
      },
      500 + Math.random() * 700
    );
  }
}

// Flies this player's bots a frame
function stepMyBots(delta, rawNow) {
  if (!room || !myBots.size) return;
  const leader = leaderNow();
  const spots = tag.it ? playerSpots(rawNow) : [];
  const itSpot = spots.find((p) => p.id === tag.it) || null;
  let centre = null;
  if (spots.length) {
    centre = {x: 0, y: 0, z: 0};
    for (const p of spots) {
      centre.x += p.x / spots.length;
      centre.y += p.y / spots.length;
      centre.z += p.z / spots.length;
    }
  }
  // Out of games, bots drive with a player who's driving
  const free = activePlaneType === 'buggy' ? 'buggy' : null;
  for (const [k, {bot, peer, plane: home}] of myBots) {
    const plane = tag.it ? tag.plane : free || home;
    if (bot.plane !== plane) {
      bot.plane = plane;
      sendBotHello(k);
    }
    const driving = plane === 'buggy';
    const away = Math.hypot(bot.x - leader.x, bot.z - leader.z);
    // Back beside the player after a warp, or when stuck in the terrain
    if ((!tag.it && away > REJOIN_DISTANCE) || bot.needsRescue) {
      rejoinBot(bot, leader, driving);
      if (driving) bot.y = surfaceAt(bot.x, bot.z, bot.y + ROAD_STEP_UP);
    }
    const isIt = tag.it === peer.id;
    const topSpeed =
      (PLANE_HANDLING[plane]?.topKts ?? 280) * (isIt ? TAG_SPEED_BOOST : 1);
    let tagCtx = null;
    if (tag.it) {
      tagCtx = isIt
        ? {
            it: true,
            targets: spots
              .filter((p) => p.id !== peer.id && !p.paused)
              .map((p) => ({
                ...p,
                bot: !!ownerOf(p.id),
                tagger: p.id === tagBefore,
              })),
          }
        : {it: false, chaser: itSpot, centre};
    }
    stepBot(bot, Math.min(delta, 0.1), {
      elevationAt: getElevation,
      waterLevel: WATER_LEVEL,
      leader,
      topSpeed,
      tag: tagCtx,
      driving,
      surfaceAt,
    });
  }
}

// When a game of tag starts, this player's bots fan out ahead of whoever's
// it with everyone else (gatherForTag); true once done
function gatherBots() {
  if (!room || !tag.it) return true;
  if (!myBots.size) return true;
  let it;
  if (tag.it === room.id) {
    it = leaderNow();
  } else {
    const peer = peers.get(tag.it);
    if (!peer?.group?.visible) return false;
    _botEuler.setFromQuaternion(peer.group.quaternion, 'YXZ');
    const {x, y, z} = peer.group.position;
    it = {x, y, z, heading: _botEuler.y};
  }
  const runners = [room.id, ...peers.keys()]
    .filter((id) => id !== tag.it)
    .sort();
  for (const {bot, peer} of myBots.values()) {
    const spot = fanSpot(it, Math.max(0, runners.indexOf(peer.id)));
    if (tag.plane === 'buggy') spot.y = surfaceAt(spot.x, spot.z, Infinity);
    Object.assign(bot, spot, {heading: it.heading, vs: 0, aim: null});
  }
  return true;
}

// This player's bots' positions, to go out with their own update; and
// drawn here like everyone else's
function packMyBots(now) {
  const out = [];
  const heardAt = performance.now();
  const units = BASE_FLIGHT_SPEED * 60;
  for (const [k, {bot, peer}] of myBots) {
    let flags = 0;
    if (tag.it && tag.it !== peer.id) flags |= FLAGS.smoke;
    if (bot.plane === 'buggy') {
      flags |= FLAGS.ground;
      surfaceAt(bot.x, bot.z, bot.y + 1);
      if (surfaceIsWater) flags |= FLAGS.water;
    }
    if (state.isPaused) flags |= FLAGS.paused;
    _botEuler.set(bot.pitch, bot.heading, bot.bank, 'YXZ');
    _botQuat.setFromEuler(_botEuler);
    _botPos.set(bot.x, bot.y, bot.z);
    const packed = packState(now, _botPos, _botQuat, bot.speed / units, flags);
    const s = unpackState(packed);
    if (s) {
      peer.heardAt = heardAt;
      peer.track.push(s, heardAt);
    }
    out.push({k, p: packed.p, q: packed.q, v: packed.v, fl: packed.fl});
  }
  return out;
}

// One of this player's bots that's it tags anyone in its reach
function botTags(rawNow) {
  if (!tag.it || ownerOf(tag.it) !== room.id || state.isPaused) return;
  if (rawNow - tagSince <= TAG_GRACE_MS) return;
  const mine = [...myBots.values()].find((m) => m.peer.id === tag.it);
  if (!mine) return;
  let spots = playerSpots(rawNow).filter((p) => p.id !== tag.it);
  // No tag-backs from a bot (as it chases, bot-logic.js)
  if (spots.some((p) => p.id !== tagBefore)) {
    spots = spots.filter((p) => p.id !== tagBefore);
  }
  const others = spots.map((p) => ({
    id: p.id,
    pos: new THREE.Vector3(p.x, p.y, p.z),
    paused: p.paused,
  }));
  _botPos.set(mine.bot.x, mine.bot.y, mine.bot.z);
  const target = tagTarget(_botPos, others);
  if (target) sendTag(target);
}

const _botQuat = new THREE.Quaternion();
const _botEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _botPos = new THREE.Vector3();
const _botFwd = new THREE.Vector3();

// --- CONNECTING ---

// Opens the room: resolves with {ws, welcome}, or rejects with an error
// carrying the relay's close code (CLOSE) or a TimeoutError
function openRoom(code, mode) {
  const ws = new WebSocket(
    roomSocketUrl(RELAY, code, {
      mode,
      seed: ChillFlightLogic.WORLD_SEED,
      name: myName(),
    })
  );
  const opened = new Promise((resolve, reject) => {
    ws.onmessage = (event) => {
      try {
        const welcome = JSON.parse(event.data);
        if (welcome.t === 'welcome') resolve({ws, welcome});
      } catch {
        /* not the welcome */
      }
    };
    ws.onclose = (event) => {
      reject(Object.assign(new Error('closed'), {code: event.code}));
    };
  });
  return withTimeout(opened, CONNECT_TIMEOUT_MS, 'Joining a flight').catch(
    (err) => {
      ws.onclose = null;
      ws.close();
      throw err;
    }
  );
}

function enterRoom(ws, welcome, code) {
  socket = ws;
  room = {
    code,
    id: welcome.id,
    seed: welcome.seed,
    host: welcome.host,
    joinedAt: performance.now(),
  };
  reconnectTry = 0;
  for (const id of welcome.peers || []) addPeer(id);
  // Back after a dropped connection (with a new id): the others' hellos
  // bring any game of tag
  tag = NO_TAG;
  refreshTag();
  ws.onmessage = onMessage;
  ws.onclose = onDropped;
  sendHello();
  setSmokeTint(state.planeColor);
  if (!sendTimer) sendTimer = setInterval(sendState, SEND_INTERVAL_MS);
  // Reloading the page comes back to the room, in its world
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('room', code);
    url.searchParams.set('seed', String(room.seed));
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* not on the page's own URL */
  }
  log.info(`[Fly together] In room ${code} as ${welcome.id}`);
  // Back after a dropped connection: bots again, under the new id
  syncBots();
  renderPanel();
}

function clearRoom() {
  for (const id of [...peers.keys()]) removePeer(id);
  myBots.clear();
  botsWanted = false;
  gatherBotsPending = false;
  socket = null;
  room = null;
  arriveOnJoin = false;
  gatherToId = null;
  pausedSince = null;
  tag = NO_TAG;
  refreshTag();
  waggleAt = -Infinity;
  state.waggleRoll = 0;
  lastSendAt = 0;
  smoothNow = null;
  clearInterval(sendTimer);
  sendTimer = null;
  clearTimeout(reconnectTimer);
  setSmokeTint(null);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* not on the page's own URL */
  }
  renderPanel();
}

function leaveRoom() {
  // Their bots go with them
  for (const k of [...myBots.keys()]) send({t: 'bot', k, bye: true});
  if (socket) {
    leaving = true;
    socket.onclose = null;
    socket.close(1000);
    leaving = false;
  }
  suspended = false;
  clearRoom();
  setStatus('');
}

// The connection dropped without leaving: try to get back in
function onDropped() {
  if (leaving || !room) return;
  socket = null;
  for (const id of [...peers.keys()]) removePeer(id);
  myBots.clear();
  if (suspended) return;
  if (reconnectTry >= RECONNECT_DELAYS_MS.length) {
    toast('Lost the flight, flying solo');
    clearRoom();
    return;
  }
  reconnectTimer = setTimeout(rejoin, RECONNECT_DELAYS_MS[reconnectTry++]);
}

async function rejoin() {
  if (!room || socket) return;
  const {code} = room;
  try {
    const {ws, welcome} = await openRoom(code, 'join');
    if (!room || room.code !== code) {
      ws.close(1000);
      return;
    }
    enterRoom(ws, welcome, code);
  } catch (err) {
    log.warn(`[Fly together] Rejoining ${code} failed: ${err.message}`);
    if (err.code === CLOSE.full) {
      toast('The flight is full now, flying solo');
      clearRoom();
    } else if (err.code === CLOSE.notFound) {
      toast('The flight has ended, flying solo');
      clearRoom();
    } else {
      onDropped();
    }
  }
}

function refusal(err) {
  if (err.code === CLOSE.notFound) return 'No flight with that code';
  if (err.code === CLOSE.full) return `That flight is full (${MAX_PLAYERS})`;
  return "Couldn't reach the flight, try again in a moment";
}

async function invite() {
  if (busy || room) return;
  busy = true;
  setStatus('Starting a flight…');
  renderPanel();
  try {
    // A new code is very rarely in use; pick another if so
    for (let tries = 0; ; tries++) {
      const code = makeRoomCode();
      try {
        const {ws, welcome} = await openRoom(code, 'create');
        enterRoom(ws, welcome, code);
        setStatus('Share the link or the code with friends');
        break;
      } catch (err) {
        if (err.code !== CLOSE.taken || tries >= 3) throw err;
      }
    }
  } catch (err) {
    log.warn(`[Fly together] Starting a flight failed: ${err.message}`);
    setStatus(refusal(err));
  } finally {
    busy = false;
    renderPanel();
  }
}

// Joins a room by code (typed, or from an invite link). A friend flying a
// different world (another day's, or another time zone's) means reloading
// into theirs.
async function join(code, fromLink = false) {
  if (busy || room) return;
  busy = true;
  setStatus('Joining…');
  renderPanel();
  try {
    const {ws, welcome} = await openRoom(code, 'join');
    if (welcome.seed !== ChillFlightLogic.WORLD_SEED) {
      ws.close(1000);
      setStatus('Loading their world…');
      // Keeps this visit's other parameters (?relay=, ?plane=)
      const url = new URL(window.location.href);
      url.searchParams.set('room', code);
      url.searchParams.set('seed', String(welcome.seed));
      window.location.href = url.toString();
      return;
    }
    enterRoom(ws, welcome, code);
    arriveOnJoin = true;
    toast(
      welcome.host ? `Joined ${welcome.host}'s flight` : 'Joined the flight'
    );
    setStatus('');
    if (!fromLink) closePanel(true);
  } catch (err) {
    log.warn(`[Fly together] Joining ${code} failed: ${err.message}`);
    setStatus(refusal(err));
    if (fromLink)
      toast(
        err.code === CLOSE.notFound ? 'That flight has ended' : refusal(err)
      );
  } finally {
    busy = false;
    renderPanel();
  }
}

function linkToShare() {
  return inviteUrl(
    isNativeApp() ? WEB_URL : window.location.href,
    room.code,
    room.seed
  );
}

async function share() {
  if (!room) return;
  const url = linkToShare();
  const text = `Fly with me in Chill Flight! Room code ${room.code}`;
  try {
    if (navigator.share) {
      await navigator.share({title: 'Chill Flight', text, url});
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Link copied');
  } catch {
    setStatus(url);
  }
}

// --- SENDING ---

const _quat = new THREE.Quaternion();

// Away (hidden or paused a while): closes the connection, keeping the room
// to come back to
function suspend() {
  if (!room || !socket) return;
  suspended = true;
  socket.onclose = null;
  socket.close(1000);
  socket = null;
  for (const id of [...peers.keys()]) removePeer(id);
  myBots.clear();
}

function resume() {
  if (!suspended) return;
  suspended = false;
  reconnectTry = 0;
  rejoin();
}

function sendState(frameClock) {
  if (!room) return;
  const rawNow = performance.now();
  noteItPaused(rawNow);
  if (state.isPaused) {
    pausedSince ??= rawNow;
    if (rawNow - pausedSince > PAUSED_DISCONNECT_MS) suspend();
  } else {
    pausedSince = null;
    if (!document.hidden) resume();
    // While actively flying, updateMultiplayer sends right after the physics
    // step so timestamps and positions stay locked to the frame
    if (typeof frameClock !== 'number' && !document.hidden) return;
  }
  const now = typeof frameClock === 'number' ? frameClock : rawNow;
  const interval = state.isPaused ? PAUSED_SEND_INTERVAL_MS : SEND_INTERVAL_MS;
  if (now - lastSendAt < interval - 5) return;
  // This player's bots are drawn here even while the connection is down
  const bots = myBots.size ? packMyBots(now) : null;
  if (socket?.readyState !== WebSocket.OPEN) return;
  lastSendAt = now;
  // Changed plane, livery or name: tell the others, and retint the smoke
  const profile = `${myName()}|${activePlaneType}|${myLivery()}`;
  if (profile !== sentProfile) {
    sendHello();
    setSmokeTint(state.planeColor);
  }
  let flags = 0;
  if (isSmokeOn()) flags |= FLAGS.smoke;
  if (state.gearExtension > 0.5) flags |= FLAGS.gear;
  if (state.isOnGround) flags |= FLAGS.ground;
  if (state.isOnWater) flags |= FLAGS.water;
  if (state.isPaused) flags |= FLAGS.paused;
  planeGroup.getWorldQuaternion(_quat);
  const update = packState(
    now,
    planeGroup.position,
    _quat,
    state.flightSpeedMultiplier || 0,
    flags
  );
  if (bots) update.b = bots;
  send(update);
  if (tag.it && overlay?.style.display === 'flex') renderPanel();
}

// --- FLYING TO A FRIEND ---

const _pos = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _side = new THREE.Vector3();

// Puts the plane just off a friend's wing, heading their way; or, when
// `gatherSlot >= 0`, fans runners out ahead of whoever started tag
function flyTo(peer, gatherSlot = -1) {
  if (!peer.track.ready || !hooks.movePlane) return false;
  const now = state.isPaused
    ? performance.now()
    : (smoothNow ?? performance.now());
  const speed = peer.track.sample(now, _pos, _quat);
  _euler.setFromQuaternion(_quat, 'YXZ');
  const yaw = _euler.y;
  _side.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const sideDist = gatherSlot >= 0 ? [-80, 80, 0][gatherSlot % 3] : 60;
  const backDist = gatherSlot >= 0 ? (gatherSlot % 3 === 2 ? -320 : -260) : 40;
  const x = _pos.x + _side.x * sideDist + back.x * backDist;
  const z = _pos.z + _side.z * sideDist + back.z * backDist;
  const latest = peer.track.latest;
  const parked = latest.flags & (FLAGS.ground | FLAGS.water);
  // A buggy is set down on the ground (or the water)
  const y =
    activePlaneType === 'buggy'
      ? surfaceAt(x, z, Infinity)
      : Math.max(_pos.y + (parked ? 150 : 15), getElevation(x, z) + 80);
  const levelSpeed = planeHandling().levelKts / (BASE_FLIGHT_SPEED * 60);
  hooks.movePlane(
    x,
    y,
    z,
    yaw,
    Math.min(getMaxFlightSpeedMult(), Math.max(speed, levelSpeed))
  );
  return true;
}

function gatherForTag() {
  if (!gatherToId || !room || tag.it !== gatherToId) {
    gatherToId = null;
    return;
  }
  const peer = peers.get(gatherToId);
  if (!peer?.track.ready) return;
  const runners = [room.id, ...peers.keys()]
    .filter((id) => id !== gatherToId)
    .sort();
  const slot = Math.max(0, runners.indexOf(room.id));
  if (flyTo(peer, slot)) gatherToId = null;
}

// --- MARKERS ---

// A friend's marker: over their plane when in view, at the screen's edge
// when they're out of view
function placeMarker(peer, dist) {
  const marker = peer.marker;
  if (!marker || state.isVRPresenting) {
    if (marker) marker.hidden = true;
    return;
  }
  const place = screenPlacement(_pos.x, _pos.y + 10, _pos.z);
  marker.hidden = false;
  marker.classList.toggle('offscreen', !place.onScreen);
  marker.style.transform = `translate(${place.sx.toFixed(1)}px, ${place.sy.toFixed(1)}px)`;
  if (!place.onScreen) {
    marker.style.setProperty('--friend-angle', `${place.angle.toFixed(3)}rad`);
  }
  // The name sits centred, sliding to one side near the screen's edges so
  // it stays on screen
  const w = window.innerWidth;
  const along = THREE.MathUtils.clamp((place.sx - 80) / (w - 160), 0, 1);
  marker.style.setProperty('--friend-shift', `${(-100 * along).toFixed(0)}%`);
  const isPaused = !!(peer.track?.latest?.flags & FLAGS.paused);
  const distText = formatDistance(dist);
  const key = `${peer.name}|${distText}|${tag.it === peer.id}|${isPaused}`;
  if (key === peer.markerKey) return;
  peer.markerKey = key;
  peer.markerText.textContent = `${peer.name} · ${distText}`;
  if (tag.it === peer.id) {
    const it = document.createElement('span');
    it.className = 'friend-it';
    it.textContent = 'it';
    peer.markerText.append(it);
  }
  if (isPaused) {
    const paused = document.createElement('span');
    paused.className = 'friend-paused';
    paused.textContent = 'paused';
    peer.markerText.append(paused);
  }
}

const _mapPos = new THREE.Vector3();
const _mapQuat = new THREE.Quaternion();
const mapFriends = [];

/**
 * Friends for the maps (minimap.js): [{x, y, z, yaw, color, name, it}],
 * where they're drawn now. Empty when flying solo.
 */
export function friendsOnMap() {
  mapFriends.length = 0;
  if (!room) return mapFriends;
  const now = state.isPaused
    ? performance.now()
    : (smoothNow ?? performance.now());
  for (const peer of peers.values()) {
    if (!peer.name || !peer.css) continue;
    if (peer.track.sample(now, _mapPos, _mapQuat) === null) continue;
    _euler.setFromQuaternion(_mapQuat, 'YXZ');
    mapFriends.push({
      x: _mapPos.x,
      y: _mapPos.y,
      z: _mapPos.z,
      yaw: _euler.y,
      color: peer.css,
      name: peer.name,
      it: tag.it === peer.id,
    });
  }
  return mapFriends;
}

/**
 * Whether a game (tag) is on in this room. Warping is off while it is, since
 * it would skip the game (minimap.js); the game's own gathering still warps.
 */
export function inGameMode() {
  return !!room && !!tag.it;
}

// --- EACH FRAME ---

/** Called once per frame while flying (not while paused). */
// Each friend's plane or buggy shown this frame, for knocking props over
// (breakables.js): fn(id, position, isBuggy)
export function forEachPeerVehicle(fn) {
  if (!room) return;
  for (const peer of peers.values()) {
    if (peer.group?.visible)
      fn(peer.id, peer.group.position, !!peer.model?.isBuggy);
  }
}

export function updateMultiplayer(delta) {
  if (!room) return;
  const rawNow = performance.now();
  const dtMs = delta * 1000;
  if (smoothNow === null || Math.abs(rawNow - smoothNow) > 500) {
    smoothNow = rawNow;
  } else {
    smoothNow += dtMs + (rawNow - (smoothNow + dtMs)) * 0.02;
  }
  const now = smoothNow;
  stepMyBots(delta, rawNow);
  sendState(now);
  state.waggleRoll = waggleRoll(rawNow - waggleAt);
  for (const peer of peers.values()) {
    const speed = peer.group ? peer.track.sample(now, _pos, _quat) : null;
    if (speed === null) {
      if (peer.marker) peer.marker.hidden = true;
      continue;
    }
    const g = peer.group;
    g.visible = true;
    g.position.copy(_pos);
    g.quaternion.copy(_quat);
    const flags = peer.track.latest.flags;
    const isPaused = isAway(peer, rawNow);

    // Fade to translucent ghost when paused
    const targetOpacity = isPaused ? 0.45 : 1.0;
    if (peer.opacity !== targetOpacity) {
      peer.opacity += THREE.MathUtils.clamp(
        targetOpacity - peer.opacity,
        -delta * 4,
        delta * 4
      );
      if (Math.abs(peer.opacity - targetOpacity) < 0.01) {
        peer.opacity = targetOpacity;
      }
      const trans = peer.opacity < 0.99;
      for (const mat of peer.materials || []) {
        mat.transparent = trans;
        mat.opacity = peer.opacity;
        mat.depthWrite = !trans || peer.opacity > 0.5;
      }
      peer.model.traverse((child) => {
        if (child.isMesh) child.castShadow = !trans;
      });
    }

    peer.model.rotation.z = waggleRoll(rawNow - peer.waggleAt);
    // Their prop coasts down and settles like the player's (prop-spin-logic.js)
    peer.propSpin ??= newPropSpin();
    const spinTarget = isPaused ? 0 : speed * BASE_FLIGHT_SPEED * 60 * 0.15;
    stepPropSpin(peer.propSpin, Math.min(PROP_SPIN.MAX, spinTarget), delta);
    for (const prop of peer.props)
      if (prop) prop.rotation.z = peer.propSpin.angle;
    if (peer.model.gearGroups) {
      const target = flags & FLAGS.gear ? 1 : 0;
      peer.gear += THREE.MathUtils.clamp(target - peer.gear, -delta, delta);
      setGearExtension(peer.model, 1 - Math.pow(1 - peer.gear, 3));
    }
    if (peer.model.isBuggy) {
      // A friend's buggy on the water hovers with its wheels folded flat
      peer.hoverFold = ChillFlightLogic.stepBuggyHoverFold(
        peer.hoverFold,
        !!(flags & FLAGS.water),
        delta
      );
      setBuggyHoverFold(peer.model, peer.hoverFold);
    }
    if (flags & FLAGS.smoke && !isPaused) {
      g.updateMatrixWorld();
      trailSmoke(g, peer.smokeLast, speed, peer.smokeColor);
    } else {
      peer.smokeLast.valid = false;
    }
    const dist = camera.position.distanceTo(_pos);
    placeMarker(peer, dist);
  }
  // Whoever's it tags anyone in reach (after a moment's grace), if neither is paused
  if (
    tag.it === room.id &&
    !state.isPaused &&
    rawNow - tagSince > TAG_GRACE_MS
  ) {
    const others = [];
    for (const peer of peers.values()) {
      if (peer.group?.visible)
        others.push({
          id: peer.id,
          pos: peer.group.position,
          paused: isAway(peer, rawNow),
        });
    }
    const target = tagTarget(planeGroup.position, others);
    if (target) sendTag(target);
  }
  botTags(rawNow);
  if (gatherBotsPending && !state.isIntroTransitionActive) {
    gatherBotsPending = !gatherBots();
  }
  if (gatherToId && !state.isIntroTransitionActive) {
    gatherForTag();
  }
  if (arriveOnJoin && !state.isIntroTransitionActive) {
    for (const peer of peers.values()) {
      if (peer.track.ready && flyTo(peer, tag.it ? 0 : -1)) {
        arriveOnJoin = false;
        gatherToId = null;
        break;
      }
    }
  }
}

// --- THE PANEL ---

function renderPanel() {
  if (counter) counter.textContent = room ? `${peers.size + 1}` : '';
  if (waveBtn) waveBtn.hidden = !room;
  if (!overlay || overlay.style.display !== 'flex') return;
  soloSection.hidden = !!room;
  roomSection.hidden = !room;
  inviteBtn.disabled = joinBtn.disabled = busy;
  if (botsBtn) botsBtn.disabled = busy;
  if (!room) return;
  if (botsInput) botsInput.checked = botsWanted || botsInRoom();
  roomCodeText.textContent = room.code;
  if (tagBtn) {
    tagBtn.hidden = peers.size === 0 && !tag.it;
    tagBtn.textContent = tag.it ? 'Stop tag' : 'Play tag';
  }
  if (tagHint) {
    tagHint.hidden = !tagBtn || tagBtn.hidden;
    tagHint.textContent = 'Least time as it wins.';
  }
  const elapsed = itElapsed();
  const showTimes = !!tag.it || Object.keys(tag.times).length > 0;
  const row = ({name, livery, peer, timeMs}) => {
    const el = document.createElement('div');
    el.className = 'fly-player';
    const dot = document.createElement('span');
    dot.className = 'fly-player-dot';
    dot.style.background = hexColor(livery);
    const label = document.createElement('span');
    label.className = 'fly-player-name';
    label.textContent = name;
    el.append(dot, label);
    if (showTimes) {
      const time = document.createElement('span');
      time.className = 'fly-player-time';
      time.textContent = formatTagTime(timeMs);
      el.append(time);
    }
    if (peer && !tag.it) {
      const btn = document.createElement('button');
      btn.className = 'fly-btn';
      btn.textContent = 'Fly to';
      btn.disabled = !peer.track.ready;
      btn.addEventListener('click', () => {
        if (flyTo(peer)) closePanel(true);
      });
      el.append(btn);
    }
    return el;
  };
  const it = (id) => (tag.it === id ? ', it' : '');
  const isPaused = (p) =>
    (p ? p.track?.latest?.flags & FLAGS.paused : state.isPaused)
      ? ', paused'
      : '';
  const entries = [
    {
      name: `${myName()} (you${it(room.id)}${isPaused(null)})`,
      livery: myLivery(),
      peer: null,
      timeMs: tagTimeOf(tag, room.id, elapsed),
    },
  ];
  for (const peer of peers.values()) {
    if (peer.name) {
      entries.push({
        name: `${peer.name}${tag.it === peer.id ? ' (it)' : ''}${isPaused(peer) ? ' (paused)' : ''}`,
        livery: peer.livery,
        peer,
        timeMs: tagTimeOf(tag, peer.id, elapsed),
      });
    }
  }
  if (tag.it) entries.sort((a, b) => a.timeMs - b.timeMs);
  playersList.replaceChildren(...entries.map(row));
}

function openPanel() {
  if (!overlay) return;
  try {
    nameInput.value = localStorage.getItem(NAME_KEY) || '';
  } catch {
    nameInput.value = '';
  }
  if (nameInput) nameInput.placeholder = defaultCallsign;
  overlay.style.display = 'flex';
  if (!busy) setStatus('');
  renderPanel();
}

// Closes the panel; `resume` also unpauses, back to flying
function closePanel(resume = false) {
  if (overlay) overlay.style.display = 'none';
  if (resume && state.isPaused) hooks.togglePause?.();
}

if (RELAY && openBtn && overlay) {
  openBtn.hidden = false;
  if (nameInput) nameInput.placeholder = defaultCallsign;
  openBtn.addEventListener('click', openPanel);
  document
    .getElementById('fly-close-btn')
    ?.addEventListener('click', () => closePanel());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePanel();
  });
  // Typing a name or code mustn't fly the plane (or toggle the smoke)
  for (const input of [nameInput, codeInput]) {
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
  }
  nameInput.addEventListener('change', () => {
    try {
      localStorage.setItem(NAME_KEY, cleanName(nameInput.value));
    } catch {
      /* not saved */
    }
    if (room) sendHello();
    renderPanel();
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinBtn.click();
  });
  inviteBtn.addEventListener('click', async () => {
    await invite();
    if (room) share();
  });
  joinBtn.addEventListener('click', () => {
    const code = parseRoomCode(codeInput.value);
    if (!code) {
      setStatus('A code is 4 letters and numbers');
      return;
    }
    join(code);
  });
  shareBtn.addEventListener('click', share);
  botsInput?.addEventListener('change', () => {
    if (room) setBotsWanted(botsInput.checked);
  });
  // A flight of your own, with bots in the other seats (friends can still
  // join with the code)
  botsBtn?.addEventListener('click', async () => {
    await invite();
    if (!room) return;
    setStatus('');
    setBotsWanted(true);
    closePanel(true);
  });
  tagBtn?.addEventListener('click', () => {
    if (!room) return;
    if (tag.it) {
      sendTag(null);
    } else {
      // Whoever starts the game is it
      sendTag(room.id);
      closePanel(true);
    }
  });
  inputManager.onWave = wave;
  waveBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wave();
  });
  leaveBtn.addEventListener('click', () => {
    leaveRoom();
    toast('Left the flight');
  });

  // Away from the game a while: drop the connection, and come back on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTimer = setTimeout(suspend, HIDDEN_DISCONNECT_MS);
    } else {
      clearTimeout(hiddenTimer);
      // Unless paused long enough to stay away (flying on reconnects)
      if (
        !pausedSince ||
        performance.now() - pausedSince <= PAUSED_DISCONNECT_MS
      ) {
        resume();
      }
    }
  });

  // An invite link: join that room (the link's seed already chose its world)
  const linkCode = parseRoomCode(ChillFlightLogic.ROOM_PARAM);
  if (linkCode) join(linkCode, true);
}
