// --- FLY TOGETHER ---
// Flying with up to three friends: the 👥 button on the pause menu starts a
// room and shares a link (or a 4-character code, for the apps), and friends
// who open it fly the same world and see each other's planes, names and
// smoke. Everyone's smoke takes their livery's colour while in a room.
//
// A small relay passes messages between the players in a room
// (relay/README.md); it knows nothing about the game. Each player sends
// where they are five times a second, and draws everyone else a moment
// behind, smoothed between updates (multiplayer-logic.js). If the relay
// can't be reached, the game carries on solo. Messages:
//   {t: 'hello', name, plane, livery}  who you are; on joining and on change
//   {t: 's', ts, p, q, v, fl}          where you are (packState)
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
  PAUSED_SEND_INTERVAL_MS,
  PeerTrack,
  SEND_INTERVAL_MS,
  cleanName,
  inviteUrl,
  makeRoomCode,
  packState,
  parseRoomCode,
  roomSocketUrl,
  unpackState,
} from './multiplayer-logic.js';

// The relay (relay/README.md); empty hides flying together. ?relay= uses
// another one, e.g. ws://localhost:8787 for a local `wrangler dev`.
const DEFAULT_RELAY = '';
const RELAY = ChillFlightLogic.RELAY_PARAM || DEFAULT_RELAY;
// Invite links from the apps point at the website
const WEB_URL = 'https://chill-flight.cowneck.com/';
const CONNECT_TIMEOUT_MS = 6000;
// Waits before trying to get back into the room after the connection drops
const RECONNECT_DELAYS_MS = [1000, 3000, 8000];
// Hidden this long (another app, a locked phone), the connection is closed,
// and opened again on coming back
const HIDDEN_DISCONNECT_MS = 60 * 1000;
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
// Fly to a friend as soon as one is seen (after joining their flight)
let arriveOnJoin = false;
let sendTimer = null;
let lastSendAt = 0;
let sentProfile = '';

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
  sentProfile = `${hello.name}|${hello.plane}|${hello.livery}`;
  send(hello);
}

// --- OTHER PLAYERS' PLANES ---

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
  const label = labelSprite(peer.name);
  label.position.y = 12;
  group.add(label);
  group.visible = false;
  scene.add(group);
  peer.group = group;
  peer.model = model;
  peer.label = label;
  peer.props = model.propGroups || [model.propGroup];
  peer.smokeLast = new THREE.Vector3();
  peer.smokeColor = smokeColor(ChillFlightLogic.PLANE_COLORS[peer.livery]);
  peer.gear = 0;
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
  };
  peers.set(id, peer);
  return peer;
}

function removePeer(id) {
  const peer = peers.get(id);
  if (!peer) return;
  if (peer.group) disposeGroup(peer.group);
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
    renderPanel();
  } else if (msg.t === 'hello') {
    onHello(addPeer(msg.f), msg);
  } else if (msg.t === 's') {
    const s = unpackState(msg);
    if (s) addPeer(msg.f).track.push(s, performance.now());
  }
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
    const {ws, welcome} = await openRoom(code, 'rejoin');
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

function sendState() {
  if (!room || socket?.readyState !== WebSocket.OPEN) return;
  const now = performance.now();
  const interval = state.isPaused ? PAUSED_SEND_INTERVAL_MS : SEND_INTERVAL_MS;
  if (now - lastSendAt < interval - 20) return;
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
  const speed = peer.track.sample(performance.now(), _pos, _quat);
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

// --- EACH FRAME ---

/** Called once per frame while flying (not while paused). */
export function updateMultiplayer(delta) {
  if (!room) return;
  const now = performance.now();
  for (const peer of peers.values()) {
    if (!peer.group) continue;
    const speed = peer.track.sample(now, _pos, _quat);
    if (speed === null) continue;
    const g = peer.group;
    g.visible = true;
    g.position.copy(_pos);
    g.quaternion.copy(_quat);
    const flags = peer.track.latest.flags;
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
  if (!overlay || overlay.style.display !== 'flex') return;
  soloSection.hidden = !!room;
  roomSection.hidden = !room;
  inviteBtn.disabled = joinBtn.disabled = busy;
  if (!room) return;
  roomCodeText.textContent = room.code;
  const row = (name, livery, peer) => {
    const el = document.createElement('div');
    el.className = 'fly-player';
    const dot = document.createElement('span');
    dot.className = 'fly-player-dot';
    dot.style.background = `#${ChillFlightLogic.PLANE_COLORS[livery]
      .toString(16)
      .padStart(6, '0')}`;
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
  const rows = [row(`${myName()} (you)`, myLivery(), null)];
  for (const peer of peers.values()) {
    if (peer.name) rows.push(row(peer.name, peer.livery, peer));
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
  leaveBtn.addEventListener('click', () => {
    leaveRoom();
    toast('Left the flight');
  });

  // Away from the game a while: drop the connection, and come back on return
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTimer = setTimeout(() => {
        if (!room || !socket) return;
        suspended = true;
        socket.onclose = null;
        socket.close(1000);
        socket = null;
        for (const id of [...peers.keys()]) removePeer(id);
      }, HIDDEN_DISCONNECT_MS);
    } else {
      clearTimeout(hiddenTimer);
      if (suspended) {
        suspended = false;
        reconnectTry = 0;
        rejoin();
      }
    }
  });

  // An invite link: join that room (the link's seed already chose its world)
  const linkCode = parseRoomCode(ChillFlightLogic.ROOM_PARAM);
  if (linkCode) join(linkCode, true);
}
