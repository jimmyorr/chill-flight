// --- FLY TOGETHER ---
// Flying with up to three friends: the 👥 button on the pause menu starts a
// room and shares a link (or a 4-character code, for the apps), and friends
// who open it fly the same world and see each other's planes, names and
// smoke. Everyone's smoke takes their livery's colour while in a room.
// Friends out of view show at the screen's edge and on the maps; H (or the
// quick menu's 👋) waggles your wings at them; and the panel starts a game
// of tag.
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
// and from the relay: welcome, joined, left (relay/src/index.js).
import * as THREE from 'three';
import {log} from './logger.js';
import {withTimeout} from './network.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {BASE_FLIGHT_SPEED} from './constants.js';
import {scene} from './scene.js';
import {camera} from './sky.js';
import {setGearExtension} from './twin.js';
import {inputManager} from './game-input-bindings.js';
import {formatDistance, screenPlacement} from './waypoint.js';
import {
  activePlaneType,
  getMaxFlightSpeedMult,
  planeGroup,
  planeHandling,
} from './airplane.js';
import {
  PLANE_BUILDERS,
  buildPlaneModel,
  isLiveryMaterial,
} from './plane-models.js';
import {Achievements} from './achievements.js';
import {isSmokeOn, setSmokeTint, smokeColor, trailSmoke} from './particles.js';
import {
  CLOSE,
  FLAGS,
  MAX_PLAYERS,
  NO_TAG,
  PAUSED_SEND_INTERVAL_MS,
  PeerTrack,
  RENDER_DELAY_MS,
  SEND_INTERVAL_MS,
  TAG_GRACE_MS,
  WAGGLE_MS,
  cleanName,
  inviteUrl,
  isNewerTag,
  makeRoomCode,
  nextIt,
  packState,
  parseRoomCode,
  readTag,
  roomSocketUrl,
  tagTarget,
  unpackState,
  waggleRoll,
} from './multiplayer-logic.js';

// The relay (relay/README.md); empty hides flying together. ?relay= uses
// another one, e.g. ws://localhost:8787 for a local `wrangler dev`.
const DEFAULT_RELAY = 'wss://chill-flight-relay.jimmyorr.workers.dev';
const RELAY = ChillFlightLogic.RELAY_PARAM || DEFAULT_RELAY;
// Invite links from the apps point at the website
const WEB_URL = 'https://chill-flight.cowneck.com/';
const CONNECT_TIMEOUT_MS = 6000;
// Waits before trying to get back into the room after the connection drops
const RECONNECT_DELAYS_MS = [1000, 3000, 8000];
// Hidden this long (another app, a locked phone), the connection is closed,
// and opened again on coming back
const HIDDEN_DISCONNECT_MS = 60 * 1000;
// Paused this long, the same, so a game left paused doesn't keep the room
// awake (and using up the relay's free allowance); flying on reconnects
const PAUSED_DISCONNECT_MS = 15 * 60 * 1000;
// Names show over planes nearer than this, fading out over the last part
// (units)
const LABEL_FADE_START = 2500;
const LABEL_FADE_END = 5000;
const NAME_KEY = 'chill_flight_name';

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
// The game of tag ({it, n, by}), and when its "it" became it
let tag = NO_TAG;
let tagSince = 0;

function myName() {
  try {
    return cleanName(localStorage.getItem(NAME_KEY)) || 'Pilot';
  } catch {
    return 'Pilot';
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
  if (tag.n > 0) hello.tag = tag;
  sentProfile = `${hello.name}|${hello.plane}|${hello.livery}`;
  send(hello);
}

// --- OTHER PLAYERS' PLANES ---

function hexColor(livery) {
  const c = ChillFlightLogic.PLANE_COLORS[livery] ?? 0xffffff;
  return `#${c.toString(16).padStart(6, '0')}`;
}

function labelSprite(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 56px Inter, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#fff';
  ctx.fillText(name, 256, 64, 490);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: false,
      fog: false,
    })
  );
  // A fixed share of the screen: text about 3% of its height
  sprite.scale.set(0.5, 0.125, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function disposeGroup(group) {
  scene.remove(group);
  group.traverse((child) => {
    child.geometry?.dispose();
    const mat = child.material;
    if (mat && !isLiveryMaterial(mat)) {
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
  group.add(model);
  group.visible = false;
  scene.add(group);
  peer.group = group;
  peer.model = model;
  peer.label = null;
  setLabel(peer);
  peer.css = hexColor(peer.livery);
  if (peer.marker) peer.marker.style.setProperty('--friend-color', peer.css);
  peer.props = model.propGroups || [model.propGroup];
  peer.smokeLast = new THREE.Vector3();
  peer.smokeColor = smokeColor(ChillFlightLogic.PLANE_COLORS[peer.livery]);
  peer.gear = 0;
}

// The name over a player's plane, with "(it)" for whoever's it in tag
function setLabel(peer) {
  const text = tag.it === peer.id ? `${peer.name} (it)` : peer.name;
  if (peer.label && peer.labelText === text) return;
  if (peer.label) {
    peer.group.remove(peer.label);
    peer.label.material.map.dispose();
    peer.label.material.dispose();
  }
  const label = labelSprite(text);
  label.position.y = 12;
  peer.group.add(label);
  peer.label = label;
  peer.labelText = text;
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
  const name = cleanName(msg.name) || 'Pilot';
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
  } else if (msg.t === 'left') {
    const name = peers.get(msg.f)?.name;
    removePeer(msg.f);
    if (name) toast(`${name} left`);
    tagAfterLeaving(msg.f);
    renderPanel();
  } else if (msg.t === 'hello') {
    onHello(addPeer(msg.f), msg);
  } else if (msg.t === 's') {
    const s = unpackState(msg);
    if (s) addPeer(msg.f).track.push(s, smoothNow ?? performance.now());
  } else if (msg.t === 'waggle') {
    // Shown when their plane, drawn a moment behind, gets there
    addPeer(msg.f).waggleAt = performance.now() + RENDER_DELAY_MS;
  } else if (msg.t === 'tag') {
    applyTag(readTag({...msg, by: msg.f}));
  }
}

// --- TAG ---

function nameOf(id) {
  return peers.get(id)?.name || 'A friend';
}

function setTag(next) {
  const was = tag.it;
  tag = next;
  if (tag.it !== was) {
    tagSince = performance.now();
    if (!tag.it) toast('Tag is over');
    else if (tag.it === room?.id) toast("You're it");
    else if (was === room?.id) toast(`You tagged ${nameOf(tag.it)}`);
    else toast(`${nameOf(tag.it)} is it`);
  }
  refreshTag();
}

// A game of tag as someone else sent it: kept if it's newer than ours
function applyTag(next) {
  if (!next || !room || !isNewerTag(next, tag)) return;
  if (next.it && next.it !== room.id && !peers.has(next.it)) {
    // It's someone who's already gone
    setTag({it: nextIt([room.id, ...peers.keys()]), n: next.n + 1, by: '~'});
    return;
  }
  setTag(next);
}

// Says who's it now (null ends the game)
function sendTag(it) {
  if (!room) return;
  const next = {it, n: tag.n + 1, by: room.id};
  setTag(next);
  send({t: 'tag', ...next});
}

// Someone left: if they were it, the lowest id still here is (worked out
// the same on every screen); alone, the game's over
function tagAfterLeaving(id) {
  if (!tag.it) return;
  if (peers.size === 0) {
    setTag({it: null, n: tag.n + 1, by: '~'});
  } else if (tag.it === id) {
    setTag({it: nextIt([room.id, ...peers.keys()]), n: tag.n + 1, by: '~'});
  }
}

function refreshTag() {
  for (const peer of peers.values()) {
    if (peer.group) setLabel(peer);
    peer.markerKey = '';
  }
  if (tagChip) {
    tagChip.hidden = !room || !tag.it;
    tagChip.classList.toggle('mine', !!room && tag.it === room.id);
    if (room && tag.it) {
      tagChip.textContent =
        tag.it === room.id
          ? "You're it, tag a friend"
          : `${nameOf(tag.it)} is it`;
    }
  }
  renderPanel();
}

// --- WAVING ---

function wave() {
  if (!room || state.isPaused) return;
  if (state.isOnGround || state.isOnWater) return;
  const now = performance.now();
  if (now - waggleAt < WAGGLE_MS) return;
  waggleAt = now;
  send({t: 'waggle'});
}

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
  room = {code, id: welcome.id, seed: welcome.seed, host: welcome.host};
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
  renderPanel();
}

function clearRoom() {
  for (const id of [...peers.keys()]) removePeer(id);
  socket = null;
  room = null;
  arriveOnJoin = false;
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
  if (socket?.readyState !== WebSocket.OPEN) return;
  const now = typeof frameClock === 'number' ? frameClock : rawNow;
  const interval = state.isPaused ? PAUSED_SEND_INTERVAL_MS : SEND_INTERVAL_MS;
  if (now - lastSendAt < interval - 5) return;
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
  planeGroup.getWorldQuaternion(_quat);
  send(
    packState(
      now,
      planeGroup.position,
      _quat,
      state.flightSpeedMultiplier || 0,
      flags
    )
  );
}

// --- FLYING TO A FRIEND ---

const _pos = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _side = new THREE.Vector3();

// Puts the plane just off a friend's wing, heading their way
function flyTo(peer) {
  if (!peer.track.ready || !hooks.movePlane) return false;
  const now = state.isPaused
    ? performance.now()
    : (smoothNow ?? performance.now());
  const speed = peer.track.sample(now, _pos, _quat);
  _euler.setFromQuaternion(_quat, 'YXZ');
  const yaw = _euler.y;
  // 60 units to their right and 40 behind; well above them if they're
  // parked, so you arrive flying
  _side.set(Math.cos(yaw), 0, -Math.sin(yaw));
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const latest = peer.track.latest;
  const parked = latest.flags & (FLAGS.ground | FLAGS.water);
  const levelSpeed = planeHandling().levelKts / (BASE_FLIGHT_SPEED * 60);
  hooks.movePlane(
    _pos.x + _side.x * 60 + back.x * 40,
    _pos.y + (parked ? 150 : 15),
    _pos.z + _side.z * 60 + back.z * 40,
    yaw,
    Math.min(getMaxFlightSpeedMult(), Math.max(speed, levelSpeed))
  );
  return true;
}

// --- MARKERS ---

// A friend's marker: over their plane once it's too far for the name to
// show, at the screen's edge when they're out of view, hidden when near
function placeMarker(peer, dist) {
  const marker = peer.marker;
  if (!marker) return;
  const place = screenPlacement(_pos.x, _pos.y, _pos.z);
  if (state.isVRPresenting || (place.onScreen && dist < LABEL_FADE_END)) {
    marker.hidden = true;
    return;
  }
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
  const distText = formatDistance(dist);
  const key = `${peer.name}|${distText}|${tag.it === peer.id}`;
  if (key === peer.markerKey) return;
  peer.markerKey = key;
  peer.markerText.textContent = `${peer.name} · ${distText}`;
  if (tag.it === peer.id) {
    const it = document.createElement('span');
    it.className = 'friend-it';
    it.textContent = 'it';
    peer.markerText.append(it);
  }
}

const _mapPos = new THREE.Vector3();
const _mapQuat = new THREE.Quaternion();
const mapFriends = [];

/**
 * Friends for the maps (minimap.js): [{x, z, yaw, color, name, it}], where
 * they're drawn now. Empty when flying solo.
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
      z: _mapPos.z,
      yaw: _euler.y,
      color: peer.css,
      name: peer.name,
      it: tag.it === peer.id,
    });
  }
  return mapFriends;
}

// --- EACH FRAME ---

/** Called once per frame while flying (not while paused). */
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
    peer.model.rotation.z = waggleRoll(rawNow - peer.waggleAt);
    const spin = speed * BASE_FLIGHT_SPEED * 60 * delta * 0.15;
    for (const prop of peer.props) if (prop) prop.rotation.z += spin;
    if (peer.model.gearGroups) {
      const target = flags & FLAGS.gear ? 1 : 0;
      peer.gear += THREE.MathUtils.clamp(target - peer.gear, -delta, delta);
      setGearExtension(peer.model, 1 - Math.pow(1 - peer.gear, 3));
    }
    if (flags & FLAGS.smoke) {
      g.updateMatrixWorld();
      trailSmoke(g, peer.smokeLast, speed, peer.smokeColor);
    } else {
      peer.smokeLast.valid = false;
    }
    const dist = camera.position.distanceTo(_pos);
    peer.label.material.opacity =
      1 - THREE.MathUtils.smoothstep(dist, LABEL_FADE_START, LABEL_FADE_END);
    peer.label.visible = peer.label.material.opacity > 0.01;
    placeMarker(peer, dist);
  }
  // Whoever's it tags anyone in reach (after a moment's grace)
  if (tag.it === room.id && now - tagSince > TAG_GRACE_MS) {
    const others = [];
    for (const peer of peers.values()) {
      if (peer.group?.visible)
        others.push({id: peer.id, pos: peer.group.position});
    }
    const target = tagTarget(planeGroup.position, others);
    if (target) sendTag(target);
  }
  if (arriveOnJoin && !state.isIntroTransitionActive) {
    for (const peer of peers.values()) {
      if (peer.track.ready && flyTo(peer)) {
        arriveOnJoin = false;
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
  if (!room) return;
  roomCodeText.textContent = room.code;
  if (tagBtn) {
    tagBtn.hidden = peers.size === 0 && !tag.it;
    tagBtn.textContent = tag.it ? 'Stop tag' : 'Play tag';
  }
  const row = (name, livery, peer) => {
    const el = document.createElement('div');
    el.className = 'fly-player';
    const dot = document.createElement('span');
    dot.className = 'fly-player-dot';
    dot.style.background = hexColor(livery);
    const label = document.createElement('span');
    label.className = 'fly-player-name';
    label.textContent = name;
    el.append(dot, label);
    if (peer) {
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
  const rows = [row(`${myName()} (you${it(room.id)})`, myLivery(), null)];
  for (const peer of peers.values()) {
    if (peer.name) {
      rows.push(
        row(
          `${peer.name}${tag.it === peer.id ? ' (it)' : ''}`,
          peer.livery,
          peer
        )
      );
    }
  }
  playersList.replaceChildren(...rows);
}

function openPanel() {
  if (!overlay) return;
  try {
    nameInput.value = localStorage.getItem(NAME_KEY) || '';
  } catch {
    nameInput.value = '';
  }
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
