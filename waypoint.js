// --- WAYPOINT ---
// A spot picked on the map (minimap.js, "Set waypoint") to fly to. A small
// marker sits over it on screen, or at the screen's edge pointing the way
// when it's out of view, with the distance left. Cleared on arrival or from
// the map, except one set to stay (a coffee run errand's, which lasts until
// you land there). Saved between visits. With no waypoint, the
// marker shows the autopilot's next tour stop instead (autopilot.js).
import * as THREE from 'three';
import {log} from './logger.js';
import {planeGroup} from './airplane.js';
import {camera} from './sky.js';
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {getElevation} from './terrain-geometry.js';
import {UNITS_TO_M, WATER_LEVEL} from './constants.js';

const STORAGE_KEY = 'chill_flight_waypoint';
// Within this many units (horizontally) counts as there
const ARRIVE_DIST = 300;
// Keep the edge marker this far (px) inside the screen, and clear of the HUD
const EDGE_MARGIN = 36;
const TOP_MARGIN = 96;

// {x, y, z, stay}: y is the ground (or water) height there; stay keeps it
// on arrival
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

export function setWaypoint(x, y, z, stay = false) {
  waypoint = {x, y, z, stay};
  save();
  log.info(`[Waypoint] Set at X = ${x.toFixed(0)}, Z = ${z.toFixed(0)}`);
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
const _v = new THREE.Vector3();
let lastDistText = null;

// "850 m" (in 50 m steps) under a kilometer, "2.4 km" under 10, then "34 km"
function formatDistance(units) {
  const m = units * UNITS_TO_M;
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

function update() {
  requestAnimationFrame(update);
  if (!el) return;
  const target = waypoint || tourStop;
  if (!target || !planeGroup || state.isVRPresenting) {
    el.hidden = true;
    return;
  }

  const dist = Math.hypot(
    target.x - planeGroup.position.x,
    target.z - planeGroup.position.z
  );
  if (dist < ARRIVE_DIST) {
    if (waypoint && !waypoint.stay) clearWaypoint();
    el.hidden = true;
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  // Where it is relative to the camera (looking down -Z)
  _v.set(target.x, target.y, target.z).applyMatrix4(camera.matrixWorldInverse);
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

  el.hidden = false;
  el.classList.toggle('offscreen', !onScreen);
  el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
  el.style.setProperty('--waypoint-angle', `${angle.toFixed(3)}rad`);
  const distText = formatDistance(dist);
  if (distText !== lastDistText) {
    lastDistText = distText;
    if (distEl) distEl.textContent = distText;
  }
}

requestAnimationFrame(update);
