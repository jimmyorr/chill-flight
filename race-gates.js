// --- RACE GATES ---
// The gates of a race in the world (race-logic.js has the rules): rings for
// planes and arches over the road for buggies. Only the next gate shows,
// glowing gold and seen from any distance, with the one after it faint
// behind; the finish is chequered. A marker at the screen's edge points
// to the next gate when it's out of view, with how far it is.
import * as THREE from 'three';
import {scene} from './scene.js';
import {formatDistance, screenPlacement} from './waypoint.js';
import {ARCH_HALF, ARCH_HEIGHT, RING_RADIUS} from './race-logic.js';

const GOLD = 0xffc23d;
const FAINT = 0xffffff;

// Black and white squares, for the finish
function chequerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(i * 8, j * 8, 8, 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 3.5, 10, 56);
const postGeo = new THREE.CylinderGeometry(2.5, 3, ARCH_HEIGHT + 30, 10);
const bannerGeo = new THREE.BoxGeometry(ARCH_HALF * 2 + 6, 10, 1.5);
let chequer = null;

// The next gate shows through fog, so it can be seen from far off
function gateMaterial(next, finish) {
  if (finish) {
    chequer ??= chequerTexture();
    const map = chequer.clone();
    map.needsUpdate = true;
    map.repeat.set(6, 1);
    return new THREE.MeshBasicMaterial({
      map,
      color: next ? 0xffffff : 0xdddddd,
      fog: !next,
      transparent: !next,
      opacity: next ? 1 : 0.45,
    });
  }
  return new THREE.MeshBasicMaterial({
    color: next ? GOLD : FAINT,
    fog: !next,
    transparent: !next,
    opacity: next ? 1 : 0.4,
  });
}

// A ring, or an arch: posts either side of the road and a banner across
function buildGate(kind, material) {
  const group = new THREE.Group();
  if (kind === 'air') {
    group.add(new THREE.Mesh(ringGeo, material));
  } else {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, material);
      post.position.set(side * ARCH_HALF, (ARCH_HEIGHT - 30) / 2, 0);
      group.add(post);
    }
    const banner = new THREE.Mesh(bannerGeo, material);
    banner.position.y = ARCH_HEIGHT;
    group.add(banner);
  }
  group.visible = false;
  scene.add(group);
  return group;
}

// The course showing: {course, slots: [{group, i}], next}
let shown = null;
let marker = null;
let markerText = null;
let markerKey = '';

function ensureMarker() {
  if (marker) return;
  const parent = document.getElementById('friend-markers');
  if (!parent) return;
  marker = document.createElement('div');
  marker.className = 'friend-marker race-marker';
  marker.hidden = true;
  const mark = document.createElement('div');
  mark.className = 'friend-mark';
  markerText = document.createElement('div');
  markerText.className = 'friend-text';
  marker.append(mark, markerText);
  marker.style.setProperty('--friend-color', '#ffc23d');
  parent.append(marker);
}

function disposeGate(group) {
  scene.remove(group);
  group.traverse((child) => {
    if (child.isMesh) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  });
}

/** Shows a race's course (race-logic.js), from its first gate. */
export function showCourse(course) {
  hideCourse();
  shown = {course, next: -1, slots: []};
  ensureMarker();
  setNextGate(0);
}

/** Takes the course away. */
export function hideCourse() {
  if (shown) for (const s of shown.slots) disposeGate(s.group);
  shown = null;
  if (marker) marker.hidden = true;
  markerKey = '';
}

/**
 * Shows gate i as the next, and the one after it faintly; i past the last
 * (finished) shows none.
 */
export function setNextGate(i) {
  if (!shown || shown.next === i) return;
  shown.next = i;
  for (const s of shown.slots) disposeGate(s.group);
  shown.slots = [];
  const {course} = shown;
  const last = course.gates.length - 1;
  for (const [k, next] of [
    [i, true],
    [i + 1, false],
  ]) {
    if (k > last) continue;
    const group = buildGate(course.kind, gateMaterial(next, k === last));
    shown.slots.push({group, i: k, next});
  }
  markerKey = '';
}

const _pos = new THREE.Vector3();

/**
 * Places the gates showing and the marker, each frame. heightAt(x, z) is
 * the ground an arch stands on; `from` is the player, for the distance;
 * timeS (seconds) swells the next gate a little in and out.
 */
export function updateGates(from, heightAt, timeS) {
  if (!shown) return;
  const {course} = shown;
  let nextGate = null;
  for (const s of shown.slots) {
    const g = course.gates[s.i];
    const y = course.kind === 'air' ? g.y : heightAt(g.x, g.z);
    s.group.position.set(g.x, y, g.z);
    s.group.rotation.y = g.heading;
    s.group.visible = true;
    if (s.next) {
      const swell = 1 + 0.04 * Math.sin(timeS * 4);
      s.group.scale.setScalar(swell);
      nextGate = {
        x: g.x,
        y: course.kind === 'air' ? y : y + ARCH_HEIGHT,
        z: g.z,
        i: s.i,
      };
    }
  }
  if (!marker) return;
  if (!nextGate) {
    marker.hidden = true;
    return;
  }
  const place = screenPlacement(nextGate.x, nextGate.y, nextGate.z);
  marker.hidden = false;
  marker.classList.toggle('offscreen', !place.onScreen);
  marker.style.transform = `translate(${place.sx.toFixed(1)}px, ${place.sy.toFixed(1)}px)`;
  if (!place.onScreen) {
    marker.style.setProperty('--friend-angle', `${place.angle.toFixed(3)}rad`);
  }
  const w = window.innerWidth;
  const along = THREE.MathUtils.clamp((place.sx - 80) / (w - 160), 0, 1);
  marker.style.setProperty('--friend-shift', `${(-100 * along).toFixed(0)}%`);
  _pos.set(nextGate.x, nextGate.y, nextGate.z);
  const dist = formatDistance(from.distanceTo(_pos));
  const last = nextGate.i === course.gates.length - 1;
  const name = last ? 'Finish' : `Gate ${nextGate.i + 1}`;
  const key = `${name}|${dist}`;
  if (key === markerKey) return;
  markerKey = key;
  markerText.textContent = `${name} · ${dist}`;
}

/** Hides the marker (paused, or in VR), keeping the gates. */
export function hideGateMarker() {
  if (marker) marker.hidden = true;
}
