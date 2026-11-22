// --- WAYPOINT ---
// A spot picked on the map (minimap.js, "Set waypoint") to fly to. A small
// marker sits over it on screen, or at the screen's edge pointing the way
// when it's out of view, with the distance left (and the place's name, for
// a landmark or airport). Cleared on arrival or from
// the map, except one set to stay (a job's, which lasts until you land
// there). Saved between visits. With no waypoint, the
// marker shows the buggy autopilot's next tour stop instead (autopilot.js).
import * as THREE from 'three';
import {log} from './logger.js';
import {planeGroup} from './airplane.js';
import {scene} from './scene.js';
import {camera, getCameraWorldPosition} from './sky.js';
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {getElevation} from './terrain-geometry.js';
import {M_TO_FT, M_TO_MI, UNITS_TO_M, WATER_LEVEL} from './constants.js';
import {playChime} from './sfx-events.js';
import {IMPERIAL, t} from './i18n.js';

const STORAGE_KEY = 'chill_flight_waypoint';
// Within this many units (horizontally) counts as there
const ARRIVE_DIST = 300;
// Keep the edge marker this far (px) inside the screen, and clear of the HUD
const EDGE_MARGIN = 36;
const TOP_MARGIN = 96;
const VR_GOLD = 0xffc23d;
// Clamp distant VR beacons inside FAR_RADIUS (27000) and camera.far (30000)
// along the exact horizon bearing so cross-continent waypoints never clip.
const MAX_VR_BEACON_DIST = 26000;

// {x, y, z, stay, flyby, name}: y is the ground (or water) height there; stay
// keeps it on arrival; flyby passes straight through instead of orbiting on
// autopilot (sightseeing jobs); name is the place's, if it's a landmark or
// airport
let waypoint = null;
let tourStop = null; // The same, for the autopilot's tour: not saved

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && [saved.x, saved.y, saved.z].every(Number.isFinite)) {
    waypoint = saved;
  }
} catch {
  /* none saved */
}
// ?waypoint=<lat>,<long> sets one for this visit (not saved)
if (ChillFlightLogic.WAYPOINT) {
  const [lat, lon] = ChillFlightLogic.WAYPOINT;
  const x = lon * 5000;
  const z = -lat * 5000;
  waypoint = {x, y: Math.max(WATER_LEVEL, getElevation(x, z)), z};
}

function save() {
  try {
    if (waypoint) localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoint));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: it lasts this visit */
  }
}

export function getWaypoint() {
  return waypoint;
}

export function setWaypoint(
  x,
  y,
  z,
  {stay = false, flyby = false, name = null} = {}
) {
  waypoint = {x, y, z, stay, flyby, name};
  save();
  log.info(
    `[Waypoint] Set at ${name ? `${name}, ` : ''}X = ${x.toFixed(0)}, Z = ${z.toFixed(0)}`
  );
}

export function clearWaypoint() {
  waypoint = null;
  save();
}

export function setTourStop(spot) {
  tourStop = spot;
}

const el = document.getElementById('waypoint-indicator');
const distEl = document.getElementById('waypoint-distance');
let lastDistText = null;

const _v = new THREE.Vector3();
const _vrCamPos = new THREE.Vector3();
const _place = {sx: 0, sy: 0, angle: 0, onScreen: false};

let vrMarker = null;
let vrBeamMesh = null;
let vrDiamondGroup = null;

function ensureVRMarker() {
  if (vrMarker) return;

  const beamGeo = new THREE.CylinderGeometry(0.45, 1.0, 1, 6, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const posAttr = beamGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 4);
  for (let i = 0; i < posAttr.count; i++) {
    const fade = Math.max(0, 1 - posAttr.getY(i));
    colors[i * 4] = 1.0;
    colors[i * 4 + 1] = 0.76;
    colors[i * 4 + 2] = 0.24;
    colors[i * 4 + 3] = 0.42 * fade * fade;
  }
  beamGeo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  const beamMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  vrBeamMesh = new THREE.Mesh(beamGeo, beamMat);

  const diamondGeo = new THREE.OctahedronGeometry(1, 0);
  diamondGeo.scale(1, 1.4, 1);
  const diamondMat = new THREE.MeshBasicMaterial({
    color: VR_GOLD,
    fog: false,
  });
  const diamondCore = new THREE.Mesh(diamondGeo, diamondMat);

  const rimGeo = diamondGeo.clone();
  rimGeo.scale(1.18, 1.18, 1.18);
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0x2a1804,
    transparent: true,
    opacity: 0.7,
    side: THREE.BackSide,
    fog: false,
  });
  const diamondRim = new THREE.Mesh(rimGeo, rimMat);

  vrDiamondGroup = new THREE.Group();
  vrDiamondGroup.add(diamondRim);
  vrDiamondGroup.add(diamondCore);

  vrMarker = new THREE.Group();
  vrMarker.name = 'vrWaypointMarker';
  vrMarker.visible = false;
  vrMarker.add(vrBeamMesh);
  vrMarker.add(vrDiamondGroup);
  scene.add(vrMarker);
}

function updateVRMarker(target) {
  ensureVRMarker();
  const camPos = getCameraWorldPosition(_vrCamPos);
  const dx = target.x - camPos.x;
  const dy = target.y - camPos.y;
  const dz = target.z - camPos.z;
  const camDist = Math.hypot(dx, dy, dz) || 1;

  let renderDist = camDist;
  if (camDist > MAX_VR_BEACON_DIST) {
    const k = MAX_VR_BEACON_DIST / camDist;
    vrMarker.position.set(
      camPos.x + dx * k,
      camPos.y + dy * k,
      camPos.z + dz * k
    );
    renderDist = MAX_VR_BEACON_DIST;
  } else {
    vrMarker.position.set(target.x, target.y, target.z);
  }

  const s = Math.max(10, renderDist * 0.0085);
  const nowS = performance.now() * 0.001;
  vrDiamondGroup.scale.setScalar(s);
  vrDiamondGroup.position.y = s * 3.2 + Math.sin(nowS * 2.0) * s * 0.2;
  vrDiamondGroup.rotation.y = nowS * 0.9;
  vrBeamMesh.scale.set(s * 0.25, Math.max(420, s * 22), s * 0.25);
  vrMarker.visible = true;
}

/**
 * Where a marker for a world point goes on screen: over it when it's in
 * view, otherwise at the screen's edge in its direction (clear of the HUD),
 * with `angle` pointing the way. Also friends flying with you
 * (multiplayer.js). Returns a shared object, overwritten by the next call.
 */
export function screenPlacement(x, y, z) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.updateMatrixWorld();
  // Where it is relative to the camera (looking down -Z)
  _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  const vx = _v.x;
  const vy = _v.y;
  const inFront = _v.z < 0;
  let sx = 0;
  let sy = 0;
  let onScreen = false;
  if (inFront) {
    _v.applyMatrix4(camera.projectionMatrix);
    sx = ((_v.x + 1) / 2) * w;
    sy = ((1 - _v.y) / 2) * h;
    onScreen =
      sx > EDGE_MARGIN &&
      sx < w - EDGE_MARGIN &&
      sy > TOP_MARGIN &&
      sy < h - EDGE_MARGIN;
  }

  let angle = 0;
  if (!onScreen) {
    // Out from the center toward it, clamped to the edge. Behind the
    // camera, its left/right still says which way to turn.
    let dx = vx;
    let dy = -vy;
    if (!inFront && Math.abs(dx) < 1e-3) dx = 1e-3;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const cx = w / 2;
    const cy = (h + TOP_MARGIN - EDGE_MARGIN) / 2;
    const halfW = w / 2 - EDGE_MARGIN;
    const halfH = (h - TOP_MARGIN - EDGE_MARGIN) / 2;
    const t = Math.min(
      halfW / Math.max(Math.abs(dx), 1e-6),
      halfH / Math.max(Math.abs(dy), 1e-6)
    );
    sx = cx + dx * t;
    sy = cy + dy * t;
    angle = Math.atan2(dy, dx);
  }

  _place.sx = sx;
  _place.sy = sy;
  _place.angle = angle;
  _place.onScreen = onScreen;
  return _place;
}

// "850 m" (in 50 m steps) under a kilometer, "2.4 km" under 10, then "34 km";
// in English (US), "600 ft" (in 100 ft steps) under 1,000 ft, "2.4 mi" under 10, then "21 mi"
export function formatDistance(units, imperial = IMPERIAL) {
  const m = units * UNITS_TO_M;
  if (imperial) {
    const ft = Math.max(100, Math.round((m * M_TO_FT) / 100) * 100);
    if (ft < 1000) return `${ft} ft`;
    const mi = m * M_TO_MI;
    if (mi < 10) return `${mi.toFixed(1)} mi`;
    return `${Math.round(mi)} mi`;
  }
  const near = Math.max(50, Math.round(m / 50) * 50);
  if (near < 1000) return `${near} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

export function updateWaypoint() {
  if (!el) return;
  const target = waypoint || tourStop;
  if (!target || !planeGroup) {
    el.hidden = true;
    if (vrMarker) vrMarker.visible = false;
    return;
  }

  const dist = Math.hypot(
    target.x - planeGroup.position.x,
    target.z - planeGroup.position.z
  );
  if (dist < ARRIVE_DIST) {
    if (waypoint && !waypoint.stay) {
      clearWaypoint();
      playChime();
    }
    el.hidden = true;
    if (vrMarker) vrMarker.visible = false;
    return;
  }

  if (state.isVRPresenting) {
    el.hidden = true;
    updateVRMarker(target);
    return;
  }

  if (vrMarker) vrMarker.visible = false;

  const {sx, sy, angle, onScreen} = screenPlacement(
    target.x,
    target.y,
    target.z
  );
  el.hidden = false;
  el.classList.toggle('offscreen', !onScreen);
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  el.style.setProperty('--waypoint-angle', `${angle.toFixed(3)}rad`);
  const distText = target.name
    ? `${t(target.name)} · ${formatDistance(dist)}`
    : formatDistance(dist);
  if (distText !== lastDistText) {
    lastDistText = distText;
    if (distEl) distEl.textContent = distText;
  }
}
