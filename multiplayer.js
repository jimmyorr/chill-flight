// --- FLY TOGETHER ---
// Flying with up to three friends: the Together tab on the pause menu starts a
// room and shares a link (or a 4-character code, for the apps), and friends
// who open it fly the same world and see each other's planes, names and
// smoke. Everyone's smoke takes their livery's colour while in a room.
// Friends out of view show at the screen's edge and on the maps; H (or the
// quick menu's 👋) waggles your wings at them; and the panel starts a game
// of tag or a race. Empty seats can be filled with bots (bot-logic.js): the player
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
//   {t: 's', ts, p, q, v, fl, pt}      where you are (packState), and in
//                                      a game of tag, your points
//   {t: 'waggle'}                      a wave
//   {t: 'tag', it, n, left, points}    who's it (multiplayer-logic.js)
//   {t: 'race', n, plane, course, grid, go}  a race (race-logic.js); with
//                                      rg and rf (gates passed, finish ms)
//                                      in 's' while it's on
// A player's bots have ids "<their id>~<k>". {t: 'bot', k, hello} (as a
// hello's name, plane, livery), {t: 'bot', k, waggle: true} and {t: 'bot',
// k, bye: true} speak for one; their positions ride along in the player's
// own update as `b: [{k, p, q, v, fl, pt}]`; and {t: 'bots', on: false} asks
// whoever brought them to take them away. (Their own message type, so an
// older game in the room just doesn't see them.)
// and from the relay: welcome, joined, left (relay/src/index.js).
import * as THREE from 'three';
import {log} from './logger.js';
import {withTimeout} from './network.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {
  BASE_FLIGHT_SPEED,
  MOUNTAIN_LEVEL,
  PLANE_HANDLING,
  WATER_LEVEL,
} from './constants.js';
import {simplex} from './noise.js';
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
import {isPlaneWrecked, triggerPeerCrash} from './crash.js';
import {playChime, playRaceBeep} from './sfx-events.js';
import {forEachTrafficPlane} from './traffic.js';
import {forwardOf} from './traffic-logic.js';
import {
  NO_RACE,
  RACE_COUNT_MS,
  RACE_GATES,
  RACE_SETTLE_MS,
  SLIP,
  SLIP_HOLD,
  botRaceSpeed,
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
} from './race-logic.js';
import {
  hideCourse,
  hideGateMarker,
  setNextGate,
  showCourse,
  updateGates,
} from './race-gates.js';
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
  PING,
  PONG,
  PeerTrack,
  QUIET_MS,
  RENDER_DELAY_MS,
  SEND_INTERVAL_MS,
  TAG_END_LATE_MS,
  TAG_END_MS,
  TAG_GRACE_MS,
  TAG_ROUND_MS,
  TAG_SPEED_BOOST,
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
  tagPointsRate,
  tagTarget,
  tagWinner,
  unpackState,
  waggleRoll,
} from './multiplayer-logic.js';

// The relay (relay/README.md); empty hides flying together. ?relay= uses
// another one, e.g. ws://localhost:8787 for a local `wrangler dev`.
const DEFAULT_RELAY = 'wss://chill-flight-relay.jimmyorr.workers.dev';
const RELAY = ChillFlightLogic.RELAY_PARAM || DEFAULT_RELAY;
// Invite links from the apps point at the website
const WEB_URL = 'https://chillflight.app/';
const CONNECT_TIMEOUT_MS = 6000;
// Waits before trying to get back into the room after the connection drops,
// about two minutes in all (time offline doesn't count: that waits for the
// connection to come back, however long, as the room may still be there)
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000, 30000];
// A ping goes to the relay this often, and a connection that's heard
// nothing back (not even the pong) for STALL_MS has stalled: a subway
// tunnel, or wifi that's gone without closing the socket
const PING_MS = 4000;
const STALL_MS = 12000;
// Back after a drop at least this long: say so
const BACK_TOAST_AFTER_MS = 5000;
// Hidden this long (another app, a locked phone), the connection is closed,
// and opened again on coming back
const HIDDEN_DISCONNECT_MS = 60 * 1000;
// Paused this long, the same, so a game left paused doesn't keep the room
// awake (and using up the relay's free allowance); flying on reconnects
const PAUSED_DISCONNECT_MS = 15 * 60 * 1000;
const NAME_KEY = 'chill_flight_name';
const defaultCallsign = randomCallsign();

// The pause menu's Together tab, and its panel
const tabBtn = document.getElementById('fly-tab');
const tabDot = document.getElementById('fly-tab-dot');
const panel = document.querySelector('.pause-panel[data-panel="together"]');
const nameInput = document.getElementById('fly-name');
const selfRow = document.getElementById('fly-self');
const selfDot = document.getElementById('fly-self-dot');
const selfName = document.getElementById('fly-self-name');
const selfNote = document.getElementById('fly-self-note');
const roomChip = document.getElementById('room-chip');
const roomChipDots = document.getElementById('room-chip-dots');
const roomChipCode = document.getElementById('room-chip-code');
const codeInput = document.getElementById('fly-code');
const inviteBtn = document.getElementById('fly-invite-btn');
const joinBtn = document.getElementById('fly-join-btn');
const shareBtn = document.getElementById('fly-share-btn');
const leaveBtn = document.getElementById('fly-leave-btn');
const soloSection = document.getElementById('fly-solo');
const roomSection = document.getElementById('fly-room');
const roomCodeText = document.getElementById('fly-room-code');
const roomLabel = document.getElementById('fly-room-label');
const botsRow = document.getElementById('fly-bots-row');
const playersList = document.getElementById('fly-players');
const statusText = document.getElementById('fly-status');
const tagBtn = document.getElementById('fly-tag-btn');
const gamesPicker = document.getElementById('fly-games');
const gameTagBtn = document.getElementById('fly-game-tag');
const gameRaceBtn = document.getElementById('fly-game-race');
const raceCount = document.getElementById('race-count');
const tagChip = document.getElementById('tag-chip');
const tagGlow = document.getElementById('tag-glow');
const botsInput = document.getElementById('fly-bots-input');
const botsBtn = document.getElementById('fly-bots-btn');
const markersEl = document.getElementById('friend-markers');
const waveBtn = document.getElementById('mobile-wave-btn');

let socket = null;
// {code, id, seed, host} while in a room; or {local: true, id, seed} for a
// flight with bots on this device alone, which needs no connection and
// sends nothing until friends are invited
let room = null;
const peers = new Map();
let busy = false;
let leaving = false;
let reconnectTry = 0;
let reconnectTimer = null;
let linkTimer = null;
// When anything last came in, and the last ping went out (performance.now());
// whether this relay answers pings (an older one doesn't, so a quiet room
// can't be told from a stalled one there)
let heardAt = 0;
let pingedAt = 0;
let relayPongs = false;
// When the connection dropped (performance.now()), while getting back in
let droppedAt = null;
// This player's ids from before the connection dropped: the relay can
// still pass on what the old connection had sent, which isn't someone else
const oldIds = new Set();
let hiddenTimer = null;
let suspended = false;
let pausedSince = null;
// The Fly to button's icon: a small plane heading right
const PLANE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
  '<path fill="currentColor" transform="rotate(90 12 12)" d="M21 16v-2l-8-5V3.5' +
  'c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 ' +
  '3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>';
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
// The game of tag ({it, plane, n, by, left, points}), when its "it" became
// it, and when the round ends (performance.now())
let tag = NO_TAG;
let tagSince = 0;
let tagEndsAt = 0;
// This player's points in the round, counted here (everyone else's come
// with their updates, as peer.points)
let myPoints = 0;
// Points a second being scored right now (for the glow), and the chip's text
let scoringRate = 0;
let chipText = '';
// When points were last added (performance.now()): they go by the clock,
// not the frame, so a slow device scores the same
let scoredAt = 0;
let gatherToId = null;
// Bots this player brought, by k ('1' to '3'): {bot (bot-logic.js), peer,
// name, livery, plane (out of games)}; and whether they want them
const myBots = new Map();
let botsWanted = false;
// A game of tag just started: this player's bots are to gather for it
let gatherBotsPending = false;
// Who was it before whoever's it now (a bot doesn't tag them straight back)
let tagBefore = null;
// The race ({n, by, plane, course, grid, go, results}, race-logic.js),
// and when it starts (performance.now())
let race = NO_RACE;
let raceGoAt = 0;
// This player's run: gates passed and finish time (ms from the start, or
// null); and where they were last frame, to see them pass through a gate
let myRace = {gates: 0, finish: null};
const racePrev = new THREE.Vector3();
let racePrevSet = false;
// The race has just started: everyone to the grid
let lineUpPending = false;
// When the race first looked over here (performance.now())
let raceOverSince = null;
// In someone's slipstream until then (performance.now())
let slipUntil = 0;
// The game picker is open (Play a game)
let pickerOpen = false;
let countShown = '';

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
  Achievements.toast({emoji: '👋', label: 'FLY TOGETHER', title});
}

// What the panel says while the connection is down, getting back in
function linkNote() {
  if (!room || room.local || socket || suspended) return '';
  return navigator.onLine ? 'Reconnecting…' : 'Offline, waiting to reconnect…';
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
    hello.tag = tag.it
      ? {...tag, left: timeLeft(), points: currentPoints()}
      : tag;
  }
  if (race.n > 0) hello.race = raceMessage();
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
    // Their points in a game of tag (as they last said)
    points: 0,
  };
  addMarker(peer);
  peers.set(id, peer);
  // Flying with someone, friend or bot
  Achievements.unlock('squadron');
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
  if (msg.race) applyRace(readRace(msg.race));
  if (isNew && !ownerOf(peer.id)) syncBots();
  renderPanel();
}

function onMessage(event) {
  heardAt = performance.now();
  if (event.data === PONG) {
    relayPongs = true;
    return;
  }
  let msg;
  try {
    msg = JSON.parse(event.data);
  } catch {
    return;
  }
  if (!msg || typeof msg.f !== 'string' || msg.f === room?.id) return;
  if (oldIds.has(msg.f)) return;
  if (msg.t === 'joined') {
    addPeer(msg.f).announce = true;
    sendHello();
    // Someone's here: the bots say hello to them (and one makes room for
    // them once they've said theirs)
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
      if (tag.it) peer.points = readPt(msg.pt, peer.points);
      if (race.course) readProgress(peer, msg);
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
        if (tag.it) peer.points = readPt(b.pt, peer.points);
        if (race.course) readProgress(peer, b);
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
  } else if (msg.t === 'race') {
    applyRace(readRace({...msg, by: msg.f}));
  }
}

// --- TAG ---

function nameOf(id) {
  return peers.get(id)?.name || 'A friend';
}

// The vehicle locked in for a game, as last set (applyBoost)
let appliedPlane = null;
// The last game's vehicle: after it, everyone stays in it (bots too)
// until this player picks another
let lastGamePlane = null;

// The vehicle everyone's in for the game on (null: none)
function gamePlane() {
  if (!room) return null;
  return tag.it ? tag.plane : race.course ? race.plane : null;
}

// The top-speed boost now: whoever's it in tag, a racer in a slipstream;
// and on the grid before a race, held to a slow formation (planes) or
// standing still (buggies)
function speedBoost() {
  if (!room) return 1;
  if (tag.it) return tag.it === room.id ? TAG_SPEED_BOOST : 1;
  if (!race.course || !race.grid.includes(room.id)) return 1;
  if (myRace.finish !== null) return 1;
  const now = performance.now();
  if (now < raceGoAt) {
    const top = PLANE_HANDLING[race.plane]?.topKts ?? 280;
    return Math.max(0.001, holdKts(race.plane) / top);
  }
  return now < slipUntil ? SLIP.BOOST : 1;
}

// Sets the boost (and the vehicle), keeping a full throttle full
function applyBoost() {
  const boost = speedBoost();
  const plane = gamePlane();
  if (boost === state.mpSpeedBoost && plane === appliedPlane) return;
  appliedPlane = plane;
  if (plane) lastGamePlane = plane;
  const prevMax = getMaxFlightSpeedMult();
  const wasAtMax = state.targetFlightSpeed >= prevMax - 0.02;
  setLockedPlane(plane);
  state.mpSpeedBoost = boost;
  const newMax = getMaxFlightSpeedMult();
  if (wasAtMax && plane) {
    state.targetFlightSpeed = newMax;
  } else if (state.targetFlightSpeed > newMax) {
    state.targetFlightSpeed = newMax;
  }
}

function refreshTag() {
  const inTag = !!room && !!tag.it;
  const amIt = inTag && tag.it === room.id;
  appliedPlane = undefined;
  applyBoost();
  state.mpForceSmoke = inTag && !amIt;
  hooks.syncSmokeUI?.();

  for (const peer of peers.values()) {
    peer.markerKey = '';
  }
  if (!inTag) {
    scoringRate = 0;
    showGlow();
  }
  renderTagChip();
  renderPanel();
}

// The chip under the HUD in a game of tag: who's it, your points and the
// time left
function renderTagChip() {
  if (!tagChip) return;
  if (room && race.course) {
    renderRaceChip();
    return;
  }
  const inTag = !!room && !!tag.it;
  const amIt = inTag && tag.it === room.id;
  tagChip.hidden = !inTag;
  tagChip.classList.toggle('mine', amIt);
  if (!inTag) {
    chipText = '';
    return;
  }
  const left = timeLeft();
  const who = amIt ? "You're it" : `${nameOf(tag.it)} is it`;
  const text =
    left > 0
      ? `${who} · ${pointsText(Math.floor(myPoints))} · ${formatTagTime(left)}`
      : `Time's up · ${pointsText(Math.floor(myPoints))}`;
  if (text === chipText) return;
  chipText = text;
  tagChip.textContent = text;
}

function pointsText(n) {
  return n === 1 ? '1 point' : `${n} points`;
}

// The round's time to go (ms)
function timeLeft() {
  return tag.it ? Math.max(0, tagEndsAt - performance.now()) : 0;
}

// A player's points as they sent them, or what we had
function readPt(pt, had) {
  return typeof pt === 'number' && pt >= 0 && Number.isFinite(pt)
    ? Math.floor(pt)
    : had;
}

// Everyone's points as this player knows them: {id: points}
function currentPoints() {
  const points = {};
  if (!room) return points;
  points[room.id] = Math.floor(myPoints);
  for (const peer of peers.values()) {
    if (peer.name) points[peer.id] = Math.floor(peer.points || 0);
  }
  return points;
}

// A friend whose updates have stopped (a stalled connection), or who has
// paused: drawn as a ghost, and can't be tagged
function isAway(peer, now) {
  if (peer.track.latest?.flags & FLAGS.paused) return true;
  return now - (peer.heardAt ?? now) > QUIET_MS;
}

function setTag(next) {
  const was = tag.it;
  if (next.it !== was) tagBefore = was;
  const starting = !was && !!next.it;
  tag = next;
  tagSince = performance.now();
  if (tag.it) tagEndsAt = tagSince + tag.left;
  if (starting) {
    myPoints = 0;
    for (const peer of peers.values()) peer.points = 0;
    // Any race gives way (and its results go)
    if (race.n > 0) clearRace();
  }
  // Whoever we hadn't heard from yet (arriving mid-game) starts from the
  // message's count
  if (tag.it) {
    for (const peer of peers.values()) {
      peer.points = Math.max(peer.points || 0, tag.points[peer.id] || 0);
    }
    if (room) myPoints = Math.max(myPoints, tag.points[room.id] || 0);
  }
  if (!was && tag.it && tag.it !== room?.id && tag.by === tag.it) {
    gatherToId = tag.it;
  } else if (!tag.it) {
    gatherToId = null;
  }
  gatherBotsPending = starting && tag.by === tag.it;
  if (tag.it !== was) {
    if (!tag.it) {
      const win = room
        ? tagWinner(tag.points, [room.id, ...peers.keys()])
        : null;
      if (win?.ids.length > 1) {
        const names = win.ids.map((id) =>
          id === room.id ? 'You' : nameOf(id)
        );
        const who = `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
        toast(`Tag is over · ${who} share the win`);
      } else if (win) {
        const who = win.id === room.id ? 'You' : nameOf(win.id);
        toast(`Tag is over · ${who} won with ${pointsText(win.points)}`);
      } else {
        toast('Tag is over');
      }
    } else if (tag.it === room?.id) toast("You're it");
    else if (was === room?.id) {
      toast(`You tagged ${nameOf(tag.it)}`);
      Achievements.unlock('tag_youre_it');
    } else toast(`${nameOf(tag.it)} is it`);
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
      ...next,
      it: nextIt([room.id, ...peers.keys()]),
      n: next.n + 1,
      by: '~',
    });
    return;
  }
  setTag(next);
}

// Says who's it now (null ends the game)
function sendTag(it) {
  if (!room) return;
  const starting = !tag.it && !!it;
  const plane = it
    ? starting
      ? tagPlane(activePlaneType)
      : tag.plane || tagPlane(activePlaneType)
    : null;
  const next = {
    it,
    plane,
    n: tag.n + 1,
    by: room.id,
    left: starting ? TAG_ROUND_MS : it ? Math.round(timeLeft()) : 0,
    points: starting ? {} : currentPoints(),
  };
  setTag(next);
  send({t: 'tag', ...next});
}

// Someone left: if they were it, the lowest id still here is (worked out
// the same on every screen); alone, the game's over
function tagAfterLeaving(id) {
  if (!tag.it) return;
  const points = currentPoints();
  if (peers.size === 0) {
    setTag({it: null, plane: null, n: tag.n + 1, by: '~', left: 0, points});
  } else if (tag.it === id) {
    setTag({
      it: nextIt([room.id, ...peers.keys()]),
      plane: tag.plane,
      n: tag.n + 1,
      by: '~',
      left: Math.round(timeLeft()),
      points,
    });
  }
}

// Scores a frame of the round: this player's points and their bots', for
// being near whoever's it (and not it, or away); and the glow round the
// screen while scoring. Once time's up, whoever's it ends the round, or
// anyone, should they not.
function scoreTag(rawNow) {
  scoringRate = 0;
  if (!room || !tag.it) {
    showGlow();
    return;
  }
  // Not across a pause, or past the end of the round
  const to = Math.min(rawNow, tagEndsAt);
  const dt = Math.min(1, Math.max(0, to - Math.max(scoredAt, tagSince)) / 1000);
  scoredAt = rawNow;
  if (rawNow < tagEndsAt) {
    let itPos = null;
    const mineIt = [...myBots.values()].find((m) => m.peer.id === tag.it);
    if (mineIt) {
      itPos = _scorePos.set(mineIt.bot.x, mineIt.bot.y, mineIt.bot.z);
    } else if (tag.it === room.id) {
      if (!state.isPaused && !state.isCrashed) itPos = planeGroup.position;
    } else {
      const peer = peers.get(tag.it);
      if (peer?.group?.visible && !peer.crashed && !isAway(peer, rawNow)) {
        itPos = peer.group.position;
      }
    }
    if (itPos) {
      if (tag.it !== room.id && !state.isPaused && !state.isCrashed) {
        scoringRate = tagPointsRate(planeGroup.position.distanceTo(itPos));
        myPoints += scoringRate * dt;
      }
      for (const {bot, peer} of myBots.values()) {
        if (peer.id === tag.it) continue;
        const d = Math.hypot(bot.x - itPos.x, bot.y - itPos.y, bot.z - itPos.z);
        peer.points = (peer.points || 0) + tagPointsRate(d) * dt;
      }
    }
  } else {
    const late = rawNow - tagEndsAt;
    const mine = tag.it === room.id || ownerOf(tag.it) === room.id;
    if (late > (mine ? TAG_END_MS : TAG_END_LATE_MS)) sendTag(null);
  }
  showGlow();
  renderTagChip();
}

// The soft glow round the screen's edge while scoring: brighter when close
function showGlow() {
  if (!tagGlow) return;
  const level = scoringRate > 1 ? 'near' : scoringRate > 0 ? 'far' : '';
  if (tagGlow.dataset.level !== level) tagGlow.dataset.level = level;
}

// --- RACE ---

// A plane holds its level speed on the grid; a buggy waits
function holdKts(plane) {
  return plane === 'buggy' ? 0 : (PLANE_HANDLING[plane]?.levelKts ?? 80);
}

function highwayRuns(n, along) {
  return ChillFlightLogic.highwayRunsAt(n, along, simplex, {
    WATER_LEVEL,
    MOUNTAIN_LEVEL,
  });
}

// Whether highway n is on the ground at `along`, not a bridge (its planned
// deck within 10 of the ground there, as terrain-chunks.js decides), so a
// road race doesn't start on one
function highwayOnGround(n, along) {
  const p = ChillFlightLogic.roadPoint(
    n,
    along,
    ChillFlightLogic.roadCenter(n, along)
  );
  return highwayDeckY(p.x, p.z) - 0.75 - getElevation(p.x, p.z) <= 10;
}

// The top of a highway's deck at (x, z) where it's on the ground, worked
// out from the road's plan, so it's right before its chunk has loaded
function highwayDeckY(x, z) {
  return (
    ChillFlightLogic.highwayY(
      x,
      z,
      simplex,
      {WATER_LEVEL, MOUNTAIN_LEVEL},
      null
    ) + 0.75
  );
}

// Where an arch stands: the road's deck, or the ground or water there
function gateHeight(x, z) {
  return surfaceAt(x, z, Infinity);
}

// The race as a message (for a hello, or starting it)
function raceMessage() {
  if (!race.course) {
    return {
      n: race.n,
      by: race.by,
      end: true,
      results: packResults(
        Object.entries(race.results || {}).map(([id, r]) => ({id, ...r}))
      ),
    };
  }
  return {
    n: race.n,
    by: race.by,
    plane: race.plane,
    course: packCourse(race.course),
    grid: race.grid,
    go: Math.round(raceGoAt - performance.now()),
  };
}

// A racer's gates and finish as they sent them
function readProgress(peer, msg) {
  if (typeof msg.rg === 'number' && msg.rg >= 0 && Number.isFinite(msg.rg)) {
    peer.raceGates = Math.max(peer.raceGates || 0, Math.floor(msg.rg));
  }
  if (typeof msg.rf === 'number' && msg.rf >= 0 && Number.isFinite(msg.rf)) {
    peer.raceFinish = Math.round(msg.rf);
  }
}

// Everyone on the grid who's still here: [{id, gates, finish}]
function racers() {
  const out = [];
  for (const id of race.grid) {
    if (id === room.id) {
      out.push({id, gates: myRace.gates, finish: myRace.finish});
    } else if (peers.has(id)) {
      const peer = peers.get(id);
      out.push({
        id,
        gates: peer.raceGates || 0,
        finish: peer.raceFinish ?? null,
      });
    }
  }
  return out;
}

// No race, and no results either (a game of tag starting, leaving)
function clearRace() {
  race = {...NO_RACE, n: race.n};
  hideCourse();
  lineUpPending = false;
  raceOverSince = null;
  showCount('');
}

function setRace(next) {
  const was = race;
  race = next;
  raceOverSince = null;
  if (race.course) {
    raceGoAt = performance.now() + race.go;
    // Any game of tag gives way
    if (tag.it || tag.n) tag = {...NO_TAG, n: tag.n};
    myRace = {gates: 0, finish: null};
    racePrevSet = false;
    slipUntil = 0;
    for (const peer of peers.values()) {
      peer.raceGates = 0;
      peer.raceFinish = null;
    }
    showCourse(race.course);
    const racing = race.grid.includes(room.id);
    lineUpPending = racing && race.go > 0;
    if (!racing) toast('A race is on · join the next one');
    else if (race.by === room.id) toast('Race! Get ready');
    else toast(`${nameOf(race.by)} started a race`);
  } else {
    hideCourse();
    lineUpPending = false;
    showCount('');
    if (was.course) {
      const standings = raceStandings(
        Object.entries(race.results || {}).map(([id, r]) => ({id, ...r}))
      );
      const win = standings[0];
      if (win?.finish != null) {
        const who = win.id === room.id ? 'You' : nameOf(win.id);
        toast(`Race over · ${who} won in ${formatRaceTime(win.finish)}`);
      } else {
        toast('Race over');
      }
    }
  }
  refreshTag();
}

// A race as someone else sent it: kept if it's newer than ours
function applyRace(next) {
  if (!next || !room || !isNewerRace(next, race)) return;
  setRace(next);
}

// Starts a race from here: everyone in the vehicle you're in, through a
// course ahead of you (rings), or along the nearest highway (buggies)
function startRace() {
  if (!room) return;
  const plane = tagPlane(activePlaneType);
  const topKts = PLANE_HANDLING[plane]?.topKts ?? 280;
  const lead = leaderNow();
  const course =
    plane === 'buggy'
      ? roadCourse(lead, topKts, highwayRuns, undefined, highwayOnGround)
      : planeCourse(
          lead,
          topKts,
          Math.floor(Math.random() * 2 ** 31),
          getElevation,
          WATER_LEVEL
        );
  if (!course) {
    toast('No highway near enough to race on');
    return;
  }
  if (tag.it) sendTag(null);
  const grid = [room.id];
  for (const peer of peers.values()) if (peer.name) grid.push(peer.id);
  grid.sort();
  setRace({
    n: race.n + 1,
    by: room.id,
    plane,
    course,
    grid,
    go: RACE_SETTLE_MS + RACE_COUNT_MS,
    results: null,
  });
  send({t: 'race', ...raceMessage()});
}

// Over: everyone's results as this player has them
function endRace() {
  if (!room || !race.course) return;
  const results = packResults(racers());
  const next = readRace({n: race.n + 1, by: room.id, end: true, results});
  setRace(next);
  send({t: 'race', n: next.n, end: true, results});
}

// Everyone onto the grid: this player and their bots, each in their slot
// (race.grid's order), far enough back to reach the start line at the
// start
function lineUp() {
  lineUpPending = false;
  if (!room || !race.course) return;
  const holdMs = Math.max(0, raceGoAt - performance.now());
  const kts = holdKts(race.plane);
  const units = BASE_FLIGHT_SPEED * 60;
  const place = (id) => {
    const slot = race.grid.indexOf(id);
    if (slot < 0) return null;
    const spot = gridSpot(race.course, slot, kts, holdMs);
    // On the road's deck, even if its chunk hasn't loaded yet here (a
    // buggy put on the ground under it would stay under it)
    if (race.plane === 'buggy') {
      spot.y = Math.max(
        surfaceAt(spot.x, spot.z, Infinity),
        highwayDeckY(spot.x, spot.z)
      );
    }
    return spot;
  };
  const me = place(room.id);
  if (me && hooks.movePlane) {
    hooks.movePlane(me.x, me.y, me.z, me.heading, kts / units);
    racePrevSet = false;
  }
  for (const {bot, peer} of myBots.values()) {
    const spot = place(peer.id);
    if (!spot) continue;
    Object.assign(bot, spot, {
      plane: race.plane,
      speed: kts,
      vs: 0,
      aim: null,
      pitch: 0,
      bank: 0,
      stuckFor: 0,
      escapeFor: 0,
      needsRescue: false,
      window: null,
      racePrev: null,
    });
  }
}

// Whether going from a to b passed through the next gate: counts it, and
// on the last, the finish time. `progress` is {gates, finish}
function checkGate(progress, a, b, sinceGo) {
  const gates = race.course.gates;
  if (progress.finish !== null || progress.gates >= gates.length) return false;
  if (!passesGate(gates[progress.gates], race.course.kind, a, b)) return false;
  progress.gates++;
  if (progress.gates >= gates.length) progress.finish = Math.round(sinceGo);
  return true;
}

// Everyone else racing, where they are: [{x, y, z, heading}] (for the
// slipstream); spots from playerSpots
function slipOthers(spots, id) {
  return spots
    .filter((p) => p.id !== id && !p.paused)
    .map((p) => ({...p, heading: Math.atan2(-p.vx, -p.vz)}));
}

// A frame of the race: the countdown, this player's gates, the
// slipstream, and once it's over, ending it
function stepRace(rawNow) {
  if (!room || !race.course) return;
  const sinceGo = rawNow - raceGoAt;
  const racing = race.grid.includes(room.id);
  const pos = planeGroup.position;
  if (racing && sinceGo >= 0 && myRace.finish === null && racePrevSet) {
    if (checkGate(myRace, racePrev, pos, sinceGo)) {
      setNextGate(myRace.gates);
      playChime();
      if (myRace.finish !== null) {
        const place =
          1 +
          racers().filter(
            (r) =>
              r.id !== room.id && r.finish !== null && r.finish < myRace.finish
          ).length;
        toast(
          `Finished ${placeText(place)} · ${formatRaceTime(myRace.finish)}`
        );
        if (place === 1 && racers().length > 1) {
          Achievements.unlock('checkered_flag');
        }
      }
    }
  }
  racePrev.copy(pos);
  racePrevSet = true;
  // Close behind another racer: a tow
  if (racing && sinceGo >= 0 && myRace.finish === null && !state.isPaused) {
    const me = leaderNow();
    if (inSlipstream(me, slipOthers(playerSpots(rawNow), room.id))) {
      slipUntil = rawNow + SLIP_HOLD * 1000;
    }
  }
  applyBoost();
  // 3, 2, 1, Go!
  if (!racing) showCount('');
  else if (sinceGo < -RACE_COUNT_MS) showCount('Get ready');
  else if (sinceGo < 0) showCount(String(Math.ceil(-sinceGo / 1000)));
  else if (sinceGo < 900) showCount('Go!');
  else showCount('');
  updateGates(pos, gateHeight, rawNow / 1000);
  if (state.isVRPresenting) hideGateMarker();
  // Over: whoever started it ends it, or anyone should they not
  if (sinceGo >= 0 && raceOver(racers(), sinceGo)) {
    raceOverSince ??= rawNow;
    const late = rawNow - raceOverSince;
    const delay =
      race.by === room.id || !peers.has(race.by) ? TAG_END_MS : TAG_END_LATE_MS;
    if (late > delay) endRace();
  } else {
    raceOverSince = null;
  }
  renderTagChip();
}

function showCount(text) {
  if (!raceCount || text === countShown) return;
  countShown = text;
  if (/^[123]$/.test(text)) playRaceBeep(false);
  else if (text === 'Go!') playRaceBeep(true);
  raceCount.textContent = text;
  raceCount.hidden = !text;
  raceCount.classList.toggle('race-go', text === 'Go!');
  // Restarts the pop for each new number
  raceCount.classList.remove('race-pop');
  void raceCount.offsetWidth;
  if (text) raceCount.classList.add('race-pop');
}

// The chip in a race: the next gate and the time; your place at the end
function renderRaceChip() {
  const n = race.course.gates.length;
  const sinceGo = performance.now() - raceGoAt;
  let text;
  if (!race.grid.includes(room.id)) {
    text = 'Race on · join the next one';
  } else if (sinceGo < 0) {
    text = `Race · ${n - 1} gates and the finish`;
  } else if (myRace.finish !== null) {
    const place =
      1 +
      racers().filter(
        (r) => r.id !== room.id && r.finish !== null && r.finish < myRace.finish
      ).length;
    text = `Finished ${placeText(place)} · ${formatRaceTime(myRace.finish)}`;
  } else {
    const gate = race.course.gates[myRace.gates];
    const what =
      myRace.gates === n - 1 ? 'Finish' : `Gate ${myRace.gates + 1}/${n - 1}`;
    text = missedGate(gate, planeGroup.position.x, planeGroup.position.z)
      ? `Missed ${what.toLowerCase().replace(/\/.*/, '')} · turn back`
      : `${what} · ${formatRaceTime(sinceGo, true)}`;
  }
  tagChip.hidden = false;
  tagChip.classList.remove('mine');
  if (text === chipText) return;
  chipText = text;
  tagChip.textContent = text;
}

const _scorePos = new THREE.Vector3();

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
    !!state.isPaused || !!state.isCrashed
  );
  for (const peer of peers.values()) {
    if (ownerOf(peer.id) === room.id || !peer.group?.visible) continue;
    add(
      peer.id,
      peer.group.position,
      peer.group.quaternion,
      (peer.track.latest?.speed || 0) * units,
      isAway(peer, rawNow) || !!peer.crashed
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
  for (const [id, peer] of peers) {
    const owner = ownerOf(id);
    // Someone counts once they've said hello: after a dropped connection
    // the room can briefly hold this player's old connection, or a try at
    // getting back in that timed out, and those never do
    if (!owner) {
      if (peer.name) people++;
    } else if (owner !== room.id) {
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
  const spots = tag.it || race.course ? playerSpots(rawNow) : [];
  const sinceGo = rawNow - raceGoAt;
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
  const others = bodiesAround();
  // Out of games, bots stay in the last game's vehicle while this player
  // does, and drive with a player who's driving
  const kept = activePlaneType === lastGamePlane ? lastGamePlane : null;
  const free = activePlaneType === 'buggy' ? 'buggy' : null;
  for (const [k, {bot, peer, plane: home}] of myBots) {
    const plane = gamePlane() || kept || free || home;
    if (bot.plane !== plane) {
      bot.plane = plane;
      sendBotHello(k);
    }
    const driving = plane === 'buggy';
    const away = Math.hypot(bot.x - leader.x, bot.z - leader.z);
    const racing = !!race.course && race.grid.includes(peer.id);
    // Back beside the player after a warp, or when stuck in the terrain;
    // stuck in a race, back at the last gate it passed
    if (racing && bot.needsRescue) {
      backOnCourse(bot, peer);
    } else if (
      (!tag.it && !racing && away > REJOIN_DISTANCE) ||
      bot.needsRescue
    ) {
      rejoinBot(bot, leader, driving);
      if (driving) bot.y = surfaceAt(bot.x, bot.z, bot.y + ROAD_STEP_UP);
    }
    const isIt = tag.it === peer.id;
    let topSpeed =
      (PLANE_HANDLING[plane]?.topKts ?? 280) * (isIt ? TAG_SPEED_BOOST : 1);
    let raceCtx = null;
    if (racing) {
      const progress = {
        gates: peer.raceGates || 0,
        finish: peer.raceFinish ?? null,
      };
      const gate =
        progress.finish === null ? race.course.gates[progress.gates] : null;
      raceCtx = {
        hold: sinceGo < 0,
        holdSpeed: holdKts(plane),
        gate,
        road: race.course.road || null,
        speed: botRaceSpeed(bot.slot),
      };
      if (sinceGo >= 0 && gate) {
        const me = {x: bot.x, y: bot.y, z: bot.z, heading: bot.heading};
        if (inSlipstream(me, slipOthers(spots, peer.id))) {
          bot.slipUntil = rawNow + SLIP_HOLD * 1000;
        }
        if (rawNow < (bot.slipUntil || 0)) topSpeed *= SLIP.BOOST;
      }
    }
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
    const prev = racing ? {x: bot.x, y: bot.y, z: bot.z} : null;
    stepBot(bot, Math.min(delta, 0.1), {
      elevationAt: getElevation,
      waterLevel: WATER_LEVEL,
      leader,
      topSpeed,
      tag: raceCtx ? null : tagCtx,
      race: raceCtx,
      driving,
      surfaceAt,
      others: others.filter((o) => o.id !== peer.id),
    });
    // Through a gate
    if (racing && sinceGo >= 0) {
      const progress = {
        gates: peer.raceGates || 0,
        finish: peer.raceFinish ?? null,
      };
      if (checkGate(progress, prev, bot, sinceGo)) {
        peer.raceGates = progress.gates;
        peer.raceFinish = progress.finish;
      }
    }
  }
}

// Everything flying or driving about, for bots to keep clear of (and not
// pass through, bumps.js): [{id, x, y, z, vx, vz}]
function bodiesAround() {
  const out = [];
  const units = BASE_FLIGHT_SPEED * 60;
  if (!state.isFreeCamera && !state.isCrashed) {
    planeGroup.getWorldQuaternion(_botQuat);
    _botFwd.set(0, 0, -1).applyQuaternion(_botQuat);
    const speed = (state.flightSpeedMultiplier || 0) * units;
    const {x, y, z} = planeGroup.position;
    out.push({
      id: room.id,
      x,
      y,
      z,
      vx: _botFwd.x * speed,
      vz: _botFwd.z * speed,
    });
  }
  for (const peer of peers.values()) {
    const bot = ownBot(peer);
    if (bot) {
      const f = forwardOf(bot.heading);
      out.push({
        id: peer.id,
        x: bot.x,
        y: bot.y,
        z: bot.z,
        vx: f.x * bot.speed,
        vz: f.z * bot.speed,
      });
    } else if (peer.group?.visible && !peer.crashed && peer.track.latest) {
      _botFwd.set(0, 0, -1).applyQuaternion(peer.group.quaternion);
      const speed = (peer.track.latest.speed || 0) * units;
      const {x, y, z} = peer.group.position;
      out.push({
        id: peer.id,
        x,
        y,
        z,
        vx: _botFwd.x * speed,
        vz: _botFwd.z * speed,
      });
    }
  }
  forEachTrafficPlane((p) => {
    const f = forwardOf(p.heading);
    out.push({
      id: null,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: f.x * p.speed,
      vz: f.z * p.speed,
    });
  });
  return out;
}

// Everyone else's plane or buggy shown this frame, for bumps (bumps.js):
// fn(id, position, isBuggy, bot), bot being this player's own bot there
// (to push about), else null. Anyone away (drawn faded) is left out
export function forEachBumpable(fn) {
  if (!room) return;
  for (const peer of peers.values()) {
    if (!peer.group?.visible || peer.crashed || peer.opacity < 0.99) continue;
    fn(peer.id, peer.group.position, !!peer.model?.isBuggy, ownBot(peer));
  }
}

// A racing bot stuck in the terrain: back at the last gate it passed (or
// the start), facing the next
function backOnCourse(bot, peer) {
  const {course} = race;
  const passed = peer.raceGates || 0;
  const from = passed > 0 ? course.gates[passed - 1] : course.start;
  const to = course.gates[Math.min(passed, course.gates.length - 1)];
  const heading = Math.atan2(-(to.x - from.x), -(to.z - from.z));
  Object.assign(bot, {
    x: from.x,
    z: from.z,
    y: race.plane === 'buggy' ? surfaceAt(from.x, from.z, Infinity) : from.y,
    heading,
    speed: 0,
    vs: 0,
    stuckFor: 0,
    escapeFor: 0,
    needsRescue: false,
    window: null,
  });
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

// The bot that `peer` is, if it's one of this player's own
function ownBot(peer) {
  if (!peer.isBot) return null;
  for (const entry of myBots.values()) {
    if (entry.peer === peer) return entry.bot;
  }
  return null;
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
    const entry = {k, p: packed.p, q: packed.q, v: packed.v, fl: packed.fl};
    if (tag.it) entry.pt = Math.floor(peer.points || 0);
    if (race.course && race.grid.includes(peer.id)) {
      entry.rg = peer.raceGates || 0;
      if (peer.raceFinish != null) entry.rf = peer.raceFinish;
    }
    out.push(entry);
  }
  return out;
}

// One of this player's bots that's it tags anyone in its reach
function botTags(rawNow) {
  if (!tag.it || ownerOf(tag.it) !== room.id || state.isPaused) return;
  if (rawNow - tagSince <= TAG_GRACE_MS || rawNow >= tagEndsAt) return;
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
  if (room?.code === code) oldIds.add(room.id);
  socket = ws;
  room = {
    code,
    id: welcome.id,
    seed: welcome.seed,
    host: welcome.host,
  };
  reconnectTry = 0;
  heardAt = performance.now();
  pingedAt = 0;
  if (droppedAt !== null) {
    if (heardAt - droppedAt > BACK_TOAST_AFTER_MS) toast('Back in the flight');
    droppedAt = null;
    setStatus('');
  }
  // This player's bots kept flying while the connection was down: they
  // take the new id
  for (const [k, mine] of myBots) {
    peers.delete(mine.peer.id);
    mine.peer.id = botId(welcome.id, k);
    peers.set(mine.peer.id, mine.peer);
  }
  for (const id of welcome.peers || []) if (!oldIds.has(id)) addPeer(id);
  // Back after a dropped connection (with a new id): the others' hellos
  // bring any game of tag, or race
  tag = NO_TAG;
  race = NO_RACE;
  clearRace();
  refreshTag();
  ws.onmessage = onMessage;
  ws.onclose = onDropped;
  sendHello();
  setSmokeTint(state.planeColor);
  if (!sendTimer) sendTimer = setInterval(sendState, SEND_INTERVAL_MS);
  clearInterval(linkTimer);
  linkTimer = setInterval(checkLink, 1000);
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
  for (const k of myBots.keys()) sendBotHello(k);
  syncBots();
  renderPanel();
}

// Anyone in the room besides this player and their bots
function hasOthers() {
  for (const id of peers.keys()) if (ownerOf(id) !== room?.id) return true;
  return false;
}

// Pings the relay, and drops a connection that has stalled
function checkLink() {
  if (socket?.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  if (now - pingedAt >= PING_MS) {
    pingedAt = now;
    try {
      socket.send(PING);
    } catch {
      /* closing */
    }
  }
  if (relayPongs && now - heardAt > STALL_MS) {
    log.warn('[Fly together] The connection stalled');
    dropSocket();
  }
}

// Closes this end of a connection that has stopped working, and tries to
// get back in
function dropSocket() {
  if (!socket) return;
  socket.onclose = null;
  try {
    socket.close();
  } catch {
    /* already closed */
  }
  onDropped();
}

// Everyone else goes when the connection does; this player's bots keep
// flying here
function dropOthers() {
  for (const id of [...peers.keys()]) {
    if (ownerOf(id) !== room?.id) removePeer(id);
  }
}

// A flight with bots on this device alone: no relay, nothing sent, and it
// works offline. Invite friends turns it into a room (invite above).
function flyWithBots() {
  if (busy || room) return;
  room = {local: true, id: 'solo', seed: ChillFlightLogic.WORLD_SEED};
  tag = NO_TAG;
  race = NO_RACE;
  clearRace();
  refreshTag();
  setSmokeTint(state.planeColor);
  if (!sendTimer) sendTimer = setInterval(sendState, SEND_INTERVAL_MS);
  setStatus('');
  botsWanted = true;
  syncBots();
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
  race = NO_RACE;
  clearRace();
  refreshTag();
  waggleAt = -Infinity;
  state.waggleRoll = 0;
  lastSendAt = 0;
  smoothNow = null;
  clearInterval(sendTimer);
  sendTimer = null;
  clearTimeout(reconnectTimer);
  clearInterval(linkTimer);
  linkTimer = null;
  droppedAt = null;
  oldIds.clear();
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
  clearTimeout(reconnectTimer);
  droppedAt ??= performance.now();
  dropOthers();
  // Out of a game: whoever was it may not be back
  tag = NO_TAG;
  race = NO_RACE;
  clearRace();
  refreshTag();
  if (suspended) return;
  if (!navigator.onLine) {
    // No connection at all: wait for it ('online' rejoins), however long
    setStatus(linkNote());
    renderPanel();
    return;
  }
  if (reconnectTry >= RECONNECT_DELAYS_MS.length) {
    toast('Lost the flight, flying solo');
    leaveRoom();
    return;
  }
  setStatus(linkNote());
  renderPanel();
  reconnectTimer = setTimeout(rejoin, RECONNECT_DELAYS_MS[reconnectTry++]);
}

async function rejoin() {
  if (!room || room.local || socket || busy) return;
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
      leaveRoom();
    } else if (err.code === CLOSE.notFound) {
      toast('The flight has ended, flying solo');
      leaveRoom();
    } else {
      onDropped();
    }
  }
}

function refusal(err) {
  if (!navigator.onLine) return 'Offline. Try again when connected.';
  if (err.code === CLOSE.notFound) return 'No flight with that code';
  if (err.code === CLOSE.full) return `That flight is full (${MAX_PLAYERS})`;
  return "Couldn't reach the flight, try again in a moment";
}

async function invite() {
  if (busy || (room && !room.local)) return;
  if (!navigator.onLine) {
    setStatus(refusal({}));
    return;
  }
  busy = true;
  setStatus('Starting a flight…');
  renderPanel();
  try {
    // A new code is very rarely in use; pick another if so
    for (let tries = 0; ; tries++) {
      const code = makeRoomCode();
      try {
        const {ws, welcome} = await openRoom(code, 'create');
        // From a flight with bots, they come along into the room
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
  if (!navigator.onLine) {
    setStatus(refusal({}));
    if (fromLink) toast("You're offline, so you can't join the flight");
    return;
  }
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
    if (!fromLink) closePanel();
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
  dropOthers();
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
  // Set even when nothing goes out, so this player's own bots are drawn
  // from updates as far apart as anyone else's. Fed every frame, the 24
  // kept would span less than RENDER_DELAY_MS and the bots would judder
  lastSendAt = now;
  // This player's bots are drawn here even while the connection is down
  const bots = myBots.size ? packMyBots(now) : null;
  // Kept fresh, connected or not: the chip's colours, and while showing,
  // tag points or race places, who's paused and who's ready to fly to
  if (((tag.it || race.course) && panelShown()) || rawNow - renderedAt > 1000) {
    renderPanel();
  }
  if (socket?.readyState !== WebSocket.OPEN) return;
  // Nobody else here to see it (the bots are this player's own): send
  // nothing. Someone arriving gets a hello straight away, then updates.
  if (!hasOthers()) return;
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
  if (isPlaneWrecked()) flags |= FLAGS.crashed;
  planeGroup.getWorldQuaternion(_quat);
  const update = packState(
    now,
    planeGroup.position,
    _quat,
    state.flightSpeedMultiplier || 0,
    flags
  );
  if (bots) update.b = bots;
  if (tag.it) update.pt = Math.floor(myPoints);
  if (race.course && race.grid.includes(room.id)) {
    update.rg = myRace.gates;
    if (myRace.finish !== null) update.rf = myRace.finish;
  }
  send(update);
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
 * The race on (for tests and the maps): {course, plane, grid, goAt, gates,
 * finish} with this player's gates passed and finish time; null with none.
 */
export function raceNow() {
  if (!room || !race.course) return null;
  return {
    course: race.course,
    plane: race.plane,
    grid: race.grid,
    goAt: raceGoAt,
    gates: myRace.gates,
    finish: myRace.finish,
  };
}

/**
 * Whether a game (tag or a race) is on in this room. Warping is off while it is, since
 * it would skip the game (minimap.js); the game's own gathering still warps.
 */
export function inGameMode() {
  return !!room && (!!tag.it || !!race.course);
}
hooks.inGameMode = inGameMode;

// --- EACH FRAME ---

/** Called once per frame while flying (not while paused). */
// Each friend's plane or buggy shown this frame, for knocking props over
// (breakables.js): fn(id, position, isBuggy)
export function forEachPeerVehicle(fn) {
  if (!room) return;
  for (const peer of peers.values()) {
    if (peer.group?.visible && !peer.crashed)
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
  // No autopilot or zen during tag or a race
  if (inGameMode()) {
    if (state.autopilotEnabled) hooks.toggleAutopilot?.(false);
    if (hooks.isZen?.()) hooks.setZen?.(false);
  }
  stepMyBots(delta, rawNow);
  sendState(now);
  state.waggleRoll = waggleRoll(rawNow - waggleAt);
  for (const peer of peers.values()) {
    let speed = peer.group ? peer.track.sample(now, _pos, _quat) : null;
    // This player's own bots are drawn where they really are, not
    // RENDER_DELAY_MS behind like everyone else: a race is timed where
    // they are, so a bot drawn behind could beat a player who saw it trail
    const own = speed === null ? null : ownBot(peer);
    if (own) {
      _botEuler.set(own.pitch, own.heading, own.bank, 'YXZ');
      _quat.setFromEuler(_botEuler);
      _pos.set(own.x, own.y, own.z);
      speed = own.speed / (BASE_FLIGHT_SPEED * 60);
    }
    if (speed === null) {
      if (peer.marker) peer.marker.hidden = true;
      continue;
    }
    const g = peer.group;
    g.visible = true;
    g.position.copy(_pos);
    g.quaternion.copy(_quat);
    const flags = own ? peer.track.latest.flags : peer.track.sampledFlags;
    const isCrashed = !!(flags & FLAGS.crashed);
    if (isCrashed && !peer.crashed && !peer.model.isBuggy) {
      g.updateMatrixWorld(true);
      triggerPeerCrash(peer.model, g);
    }
    peer.crashed = isCrashed;
    peer.model.visible = !isCrashed;
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
    const spinTarget =
      isPaused || isCrashed ? 0 : speed * BASE_FLIGHT_SPEED * 60 * 0.15;
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
    if (flags & FLAGS.smoke && !isPaused && !isCrashed) {
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
    !state.isCrashed &&
    rawNow - tagSince > TAG_GRACE_MS &&
    rawNow < tagEndsAt
  ) {
    const others = [];
    for (const peer of peers.values()) {
      if (peer.group?.visible)
        others.push({
          id: peer.id,
          pos: peer.group.position,
          paused: isAway(peer, rawNow) || !!peer.crashed,
        });
    }
    const target = tagTarget(planeGroup.position, others);
    if (target) sendTag(target);
  }
  botTags(rawNow);
  scoreTag(rawNow);
  if (lineUpPending && !state.isIntroTransitionActive) lineUp();
  stepRace(rawNow);
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

// Whether the Together tab is showing
function panelShown() {
  return !!state.isPaused && !!panel?.classList.contains('active');
}

// The room chip under the HUD: a dot per plane, and the code
function renderChip() {
  if (!roomChip) return;
  roomChip.hidden = !room;
  if (!room) return;
  // Getting back in after the connection dropped: dimmed, and says so
  const down = !room.local && !socket && !suspended;
  roomChip.classList.toggle('room-chip-down', down);
  roomChipCode.textContent = room.local
    ? ''
    : down
      ? 'Reconnecting'
      : room.code;
  const liveries = [myLivery()];
  for (const peer of peers.values()) if (peer.name) liveries.push(peer.livery);
  roomChipDots.replaceChildren(
    ...liveries.map((livery) => {
      const dot = document.createElement('span');
      dot.style.background = hexColor(livery);
      return dot;
    })
  );
  roomChip.setAttribute(
    'aria-label',
    room.local
      ? 'Flying with bots'
      : down
        ? `Room ${room.code}, reconnecting`
        : `Room ${room.code}, ${liveries.length} flying`
  );
}

let renderedAt = 0;

function renderPanel() {
  renderedAt = performance.now();
  if (waveBtn) waveBtn.hidden = !room;
  if (tabDot) tabDot.hidden = !room;
  renderChip();
  if (!panel) return;
  soloSection.hidden = !!room;
  roomSection.hidden = !room;
  inviteBtn.disabled = joinBtn.disabled = busy;
  if (botsBtn) botsBtn.disabled = busy;
  if (!room) return;
  if (botsInput) botsInput.checked = botsWanted || botsInRoom();
  // A flight with bots has no code yet: Invite friends makes one
  roomCodeText.hidden = !!room.local;
  roomCodeText.textContent = room.code || '';
  if (roomLabel)
    roomLabel.textContent = room.local ? 'Flying with bots' : 'Room';
  shareBtn.textContent = room.local ? 'Invite friends' : 'Share link';
  shareBtn.disabled = busy;
  if (botsRow) botsRow.hidden = !!room.local;
  const gameOn = !!tag.it || !!race.course;
  if (tagBtn) {
    tagBtn.hidden = peers.size === 0 && !gameOn;
    // Nobody to play with while the connection is down
    tagBtn.disabled = !socket && !room.local;
    tagBtn.textContent = tag.it
      ? 'Stop tag'
      : race.course
        ? 'Stop race'
        : 'Play a game';
    tagBtn.classList.toggle('open', pickerOpen && !gameOn);
  }
  // Choosing a game takes the list's place a moment
  if (gamesPicker) {
    gamesPicker.hidden = !pickerOpen || gameOn || tagBtn.hidden;
    playersList.parentElement.hidden = !gamesPicker.hidden;
  }
  // In a game, live points or race places; after one, how it ended
  const raceRows = raceListing();
  const showPoints =
    !raceRows && (!!tag.it || Object.keys(tag.points).length > 0);
  const live = tag.it ? currentPoints() : tag.points;
  const row = ({name, note, livery, peer, points}) => {
    const el = document.createElement('div');
    el.className = 'fly-player';
    const dot = document.createElement('span');
    dot.className = 'fly-player-dot';
    dot.style.background = hexColor(livery);
    // The name, with "it, paused" in small grey under it, so a narrow
    // phone row still has room for the whole name
    const text = document.createElement('span');
    text.className = 'fly-player-text';
    const label = document.createElement('span');
    label.className = 'fly-player-name';
    label.textContent = name;
    text.append(label);
    if (note) {
      const noteEl = document.createElement('span');
      noteEl.className = 'fly-player-note';
      noteEl.textContent = note;
      text.append(noteEl);
    }
    el.append(dot, text);
    if (showPoints || raceRows) {
      const score = document.createElement('span');
      score.className = 'fly-player-time';
      score.textContent = raceRows ? points : `${points} pts`;
      el.append(score);
    }
    // Your own row gets an invisible stand-in for Fly to, so every score
    // lines up in one column
    if (!peer && !gameOn && (showPoints || raceRows)) {
      const spacer = document.createElement('span');
      spacer.className = 'fly-btn fly-btn-icon fly-btn-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      el.append(spacer);
    }
    if (peer && !gameOn) {
      const btn = document.createElement('button');
      btn.className = 'fly-btn fly-btn-icon';
      btn.innerHTML = PLANE_ICON;
      btn.title = 'Fly to';
      btn.setAttribute('aria-label', `Fly to ${name}`);
      btn.disabled = !peer.track.ready;
      btn.addEventListener('click', () => {
        if (flyTo(peer)) closePanel();
      });
      el.append(btn);
    }
    return el;
  };
  // The small grey words under a name: "you, it" or "it, paused". You're
  // always paused while this menu shows, so your row doesn't say it
  const noteOf = (id, p) =>
    [
      !p && 'you',
      tag.it === id && 'it',
      p?.track?.latest?.flags & FLAGS.paused && 'paused',
    ]
      .filter(Boolean)
      .join(', ');
  // Out of tag games you're your own row at the top, with your name to tap
  // and change; in one, the list is sorted by points, you included
  selfRow.hidden = showPoints || !!raceRows;
  selfDot.style.background = hexColor(myLivery());
  if (document.activeElement !== selfName) selfName.value = myName();
  selfName.placeholder = defaultCallsign;
  selfNote.textContent = noteOf(room.id, null);
  const entries = showPoints
    ? [
        {
          name: myName(),
          note: noteOf(room.id, null),
          livery: myLivery(),
          peer: null,
          points: live[room.id] || 0,
        },
      ]
    : [];
  for (const peer of peers.values()) {
    if (peer.name) {
      entries.push({
        name: peer.name,
        note: noteOf(peer.id, peer),
        livery: peer.livery,
        peer,
        points: live[peer.id] || 0,
      });
    }
  }
  if (showPoints) entries.sort((a, b) => b.points - a.points);
  playersList.replaceChildren(...(raceRows || entries).map(row));
}

// The room list in a race, or after one: everyone in finishing order,
// with their time (or how far they got), then anyone who wasn't racing.
// Null with no race to show.
function raceListing() {
  if (!room || (!race.course && !race.results)) return null;
  const list = race.course
    ? racers()
    : Object.entries(race.results).map(([id, r]) => ({id, ...r}));
  const gates = race.course?.gates.length ?? RACE_GATES;
  const rows = [];
  const seen = new Set();
  const look = (id) =>
    id === room.id
      ? {name: myName(), livery: myLivery(), peer: null}
      : peers.has(id)
        ? {
            name: peers.get(id).name,
            livery: peers.get(id).livery,
            peer: peers.get(id),
          }
        : null;
  raceStandings(list).forEach((r, i) => {
    const who = look(r.id);
    if (!who?.name) return;
    seen.add(r.id);
    const finished = r.finish !== null;
    rows.push({
      ...who,
      note: [who.peer ? '' : 'you', finished ? placeText(i + 1) : '']
        .filter(Boolean)
        .join(', '),
      points: finished
        ? formatRaceTime(r.finish)
        : `${Math.min(r.gates, gates - 1)}/${gates - 1}`,
    });
  });
  for (const id of [room.id, ...peers.keys()]) {
    const who = look(id);
    if (seen.has(id) || !who?.name) continue;
    rows.push({
      ...who,
      note: who.peer ? 'watching' : 'you, watching',
      points: '',
    });
  }
  return rows;
}

// The Together tab coming into view
function openPanel() {
  try {
    nameInput.value = localStorage.getItem(NAME_KEY) || '';
  } catch {
    nameInput.value = '';
  }
  nameInput.placeholder = defaultCallsign;
  if (!busy) setStatus(linkNote());
  renderPanel();
}

// Pauses onto the Together tab (from the room chip)
function showPanel() {
  if (!state.isPaused) hooks.togglePause?.();
  tabBtn.click();
}

// Back to flying
function closePanel() {
  if (state.isPaused) hooks.togglePause?.();
}

if (RELAY && tabBtn && panel) {
  tabBtn.hidden = false;
  openPanel();
  // After game-ui.js's own listener has switched the panel over
  tabBtn.addEventListener('click', openPanel);
  roomChip?.addEventListener('click', (e) => {
    e.stopPropagation();
    showPanel();
  });
  // Typing a name or code mustn't fly the plane (or toggle the smoke)
  for (const input of [nameInput, selfName, codeInput]) {
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') input.blur();
    });
    input.addEventListener('keyup', (e) => e.stopPropagation());
  }
  for (const input of [nameInput, selfName]) {
    input.addEventListener('change', () => {
      try {
        localStorage.setItem(NAME_KEY, cleanName(input.value));
      } catch {
        /* not saved */
      }
      if (room) sendHello();
      renderPanel();
    });
  }
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
  shareBtn.addEventListener('click', async () => {
    if (room?.local) await invite();
    if (room && !room.local) share();
  });
  botsInput?.addEventListener('change', () => {
    if (room) setBotsWanted(botsInput.checked);
  });
  // A flight of your own, with bots in the other seats, on this device
  // alone (Invite friends opens it up)
  botsBtn?.addEventListener('click', () => {
    flyWithBots();
    if (room) closePanel();
  });
  // Play a game opens the picker; in a game, it stops it
  tagBtn?.addEventListener('click', () => {
    if (!room) return;
    if (tag.it) {
      sendTag(null);
    } else if (race.course) {
      endRace();
    } else {
      pickerOpen = !pickerOpen;
    }
    renderPanel();
  });
  gameTagBtn?.addEventListener('click', () => {
    if (!room) return;
    pickerOpen = false;
    // Whoever starts the game is it
    sendTag(room.id);
    closePanel();
  });
  gameRaceBtn?.addEventListener('click', () => {
    if (!room) return;
    pickerOpen = false;
    startRace();
    if (race.course) closePanel();
    else renderPanel();
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

  // The connection going and coming back (a subway, a flight): drop the
  // socket straight away rather than wait for it to time out, and get back
  // in as soon as there's a connection again
  window.addEventListener('offline', () => {
    if (socket) dropSocket();
  });
  window.addEventListener('online', () => {
    if (!room || socket || suspended) return;
    reconnectTry = 0;
    clearTimeout(reconnectTimer);
    setStatus(linkNote());
    rejoin();
  });

  // An invite link: join that room (the link's seed already chose its world)
  const linkCode = parseRoomCode(ChillFlightLogic.ROOM_PARAM);
  if (linkCode) join(linkCode, true);
}
