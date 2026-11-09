// The ?debug=true panel's readouts (index.html #debug-menu): a line with the
// frame rate that stays when the panel is folded, and four tabs, Live (where
// you are and the weather), Perf, Things (what's drawn) and Settings
// (debug-ui.js). Four times a second, and only the open tab, so the panel
// costs little while measuring the frame rate.
import * as THREE from 'three';
import {camera, currentPaletteSeed, isCustomPalette, renderer} from './sky.js';
import {selectedPalette, skyUniforms} from './sky.js';
import {ART_STYLE} from './art-style.js';
import {
  BASE_FLIGHT_SPEED,
  CHUNK_SIZE,
  WATER_LEVEL,
  displaySpeed,
  getCachedElement,
  speedUnit,
  updateDOM,
} from './constants.js';
import {activePlaneType, planeGroup} from './airplane.js';
import {chunks, sampleGround} from './terrain-geometry.js';
import {performanceMonitor} from './game-performance.js';
import {sharePerfReport} from './perf-hud.js';
import {globalInstancer} from './terrain-chunks.js';
import {
  manualCloudCover,
  precipitation,
  weatherType,
} from './weather-manager.js';
import {trafficCount} from './traffic.js';
import {roadCarCount} from './road-traffic.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';
import {state} from './state.js';

const REFRESH_MS = 250;
const STORAGE_KEY = 'chill_flight_debug_panel';
const TABS = ['live', 'perf', 'things', 'settings'];
const TOP_DRAWN = 10;

const panel =
  typeof document !== 'undefined' ? getCachedElement('debug-menu') : null;
let activeTab = 'live';
let folded = false;
let lastRefresh = 0;
// Summed over the frames since the last refresh
let frames = 0;
let cpuSum = 0;
let callsSum = 0;
let trisSum = 0;
let lastHeapMb;
let lastGcMb;
let shareLabelTimer = 0;
const camEuler = new THREE.Euler();
const ground = {height: 0, slopeX: 0, slopeZ: 0};

function loadPanelState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (TABS.includes(saved.tab)) activeTab = saved.tab;
    folded = saved.folded === true;
  } catch {
    // Defaults
  }
}

function savePanelState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({tab: activeTab, folded}));
  } catch {
    // Not kept
  }
}

function showPanelState() {
  if (!panel) return;
  panel.classList.toggle('folded', folded);
  const fold = getCachedElement('debug-fold');
  if (fold) {
    fold.textContent = folded ? '+' : '−';
    fold.setAttribute(
      'aria-label',
      folded ? 'Open the debug panel' : 'Fold the debug panel'
    );
  }
  panel.querySelectorAll('.dbg-tab').forEach((tab) => {
    tab.setAttribute('aria-selected', String(tab.dataset.tab === activeTab));
  });
  panel.querySelectorAll('.dbg-body').forEach((body) => {
    body.classList.toggle('active', body.dataset.tab === activeTab);
  });
  lastRefresh = 0; // fill the newly shown tab straight away
}

function initPanel() {
  if (!panel) return;
  loadPanelState();
  panel.querySelectorAll('.dbg-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      folded = false;
      showPanelState();
      savePanelState();
    });
  });
  // The folded panel is just its fps line: tapping anywhere on it opens it
  getCachedElement('debug-fold')?.addEventListener('click', (e) => {
    e.stopPropagation();
    folded = !folded;
    showPanelState();
    savePanelState();
  });
  panel.querySelector('.dbg-head')?.addEventListener('click', () => {
    if (!folded) return;
    folded = false;
    showPanelState();
    savePanelState();
  });
  const share = getCachedElement('debug-share-perf');
  share?.addEventListener('click', async () => {
    const done = await sharePerfReport();
    if (!done) return;
    share.textContent = `${done} perf report`;
    clearTimeout(shareLabelTimer);
    shareLabelTimer = setTimeout(() => {
      share.textContent = 'Share perf report';
    }, 1500);
  });
  showPanelState();
}
initPanel();

// '' (normal), yellow or red as `val` passes warn and crit
function perfColor(val, warn, crit) {
  if (val >= crit) return '#ff6b6b';
  if (val >= warn) return '#ffd54a';
  return '';
}

function setColored(id, text, color) {
  const el = getCachedElement(id);
  if (!el) return;
  updateDOM(el, text);
  if (el.style.color !== color) el.style.color = color;
}

const fmtTris = (n) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)} M`
    : n >= 1e3
      ? `${Math.round(n / 1e3)} k`
      : String(n);

// The kind of land under (x, z), as the terrain generator sees it
function regionAt(x, z) {
  const w = ChillFlightLogic.roadWeatherAt(x, z, simplex);
  if (w.alien > 0.5) return x > 0 ? 'east alien' : 'west alien';
  if (ChillFlightLogic.swampFactorAt(x, z, simplex) > 0.5) return 'swamp';
  if (w.dust > 0.5) return 'desert';
  if (w.snow > 0.5) return 'snow';
  return 'temperate';
}

const CLIMATE = {
  Rain: 'rain belt',
  Sleet: 'sleet belt',
  Snow: 'snow belt',
  'Dry edge': 'desert edge',
  Desert: 'desert (storms dry up)',
};

function updateLive({overcast, cloudMood}) {
  const pos = state.isFreeCamera ? camera.position : planeGroup.position;
  const unitsPerSec =
    BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  const name =
    activePlaneType.charAt(0).toUpperCase() + activePlaneType.slice(1);
  updateDOM(
    'debug-vehicle',
    `${name} · ${displaySpeed(unitsPerSec, activePlaneType)} ` +
      `${speedUnit(activePlaneType).toLowerCase()}` +
      (state.isFreeCamera ? ' · free cam' : '')
  );
  updateDOM(
    'debug-position',
    `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)} m`
  );
  sampleGround(pos.x, pos.z, ground);
  const floor = Math.max(ground.height, WATER_LEVEL);
  updateDOM(
    'debug-agl',
    `${Math.round(pos.y - floor)} m` +
      (ground.height < WATER_LEVEL ? ' (water)' : '')
  );
  updateDOM('debug-region', regionAt(pos.x, pos.z));
  const archetype = ChillFlightLogic.getIslandArchetype(pos.x, pos.z, simplex);
  updateDOM(
    'debug-island-type',
    ChillFlightLogic.FORCE_ISLAND_TYPE &&
      ChillFlightLogic.FORCE_ISLAND_TYPE !== 'auto'
      ? `${archetype} (forced)`
      : archetype
  );
  const deg = (r) => Math.round(THREE.MathUtils.radToDeg(r));
  updateDOM('debug-pitch', `${deg(planeGroup.rotation.x)}°`);
  camEuler.setFromQuaternion(camera.quaternion, 'YXZ');
  updateDOM(
    'debug-camera',
    `${state.cameraMode} · ${deg(camEuler.x)}° @ ${deg(camEuler.y)}° · fov ${Math.round(camera.fov)}`
  );

  // Weather: the storm field's value against where clouds, rain and a full
  // storm start (ChillFlightLogic.WEATHER), unless it's forced or off
  const W = ChillFlightLogic.WEATHER;
  const off = state.SEGMENTS <= 20;
  const auto = weatherType === 'auto' && !off;
  updateDOM(
    'debug-weather-title',
    off
      ? 'Weather (off on Low)'
      : auto
        ? 'Weather'
        : `Weather (forced: ${weatherType})`
  );
  const autoRows = getCachedElement('debug-weather-auto');
  if (autoRows) autoRows.hidden = !auto;
  const wd = state._weatherDebug;
  if (auto && wd) {
    const s = wd.stormNoise;
    const stage =
      s >= W.STORM_PRECIP[1]
        ? 'full storm'
        : s >= W.STORM_PRECIP[0]
          ? 'storm'
          : s >= W.STORM_CLOUD[0]
            ? 'clouding over'
            : 'clear';
    updateDOM('debug-storm', `${s.toFixed(2)} · ${stage}`);
    const fill = getCachedElement('debug-storm-fill');
    if (fill) fill.style.width = `${(s * 100).toFixed(1)}%`;
    const mark = (id, v) => {
      const el = getCachedElement(id);
      if (el) el.style.left = `${v * 100}%`;
    };
    mark('debug-storm-cloud-mark', W.STORM_CLOUD[0]);
    mark('debug-storm-rain-mark', W.STORM_PRECIP[0]);
    mark('debug-storm-full-mark', W.STORM_PRECIP[1]);
    updateDOM(
      'debug-storm-ticks',
      `clouds ${W.STORM_CLOUD[0].toFixed(2)} · storm ${W.STORM_PRECIP[0].toFixed(2)} · full ${W.STORM_PRECIP[1].toFixed(2)}`
    );
    updateDOM(
      'debug-climate',
      (CLIMATE[wd.zone] || wd.zone) +
        (wd.skeleton > 0.01 ? ` · skeleton snow ${wd.skeleton.toFixed(2)}` : '')
    );
  }
  updateDOM(
    'debug-cloud-cover',
    `${(overcast || 0).toFixed(2)}` +
      (manualCloudCover !== null ? ' (manual)' : '') +
      (cloudMood ? ` · ${cloudMood.name}` : '')
  );
  const {rain, snow} = precipitation;
  updateDOM(
    'debug-falling',
    rain > 0.01 && snow > 0.01
      ? `sleet ${Math.max(rain, snow).toFixed(2)}`
      : snow > 0.01
        ? `snow ${snow.toFixed(2)}`
        : rain > 0.01
          ? `rain ${rain.toFixed(2)}`
          : 'nothing'
  );
  const aurora = skyUniforms ? skyUniforms.uAuroraIntensity.value : 0;
  updateDOM(
    'debug-aurora',
    aurora < 0.01
      ? 'none'
      : `${aurora < 0.03 ? 'faint' : aurora < 0.06 ? 'moderate' : 'active'} (${aurora.toFixed(3)})`
  );
  updateDOM(
    'debug-rainbow',
    state.rainbowIntensity > 0
      ? `${Math.round(state.rainbowIntensity * 100)}%`
      : 'none'
  );
}

// Chunks loaded and how many are within the prop range
function chunkRange() {
  const pos = state.isFreeCamera ? camera.position : planeGroup.position;
  const lod =
    state.manualPropLOD !== undefined
      ? state.manualPropLOD
      : Math.min(
          state.RENDER_DISTANCE * CHUNK_SIZE - CHUNK_SIZE / 2,
          state.PROP_LOD_DISTANCE ?? 4200
        );
  const lodSq = lod * lod;
  let total = 0;
  let near = 0;
  const landmarks = {
    castles: [0, 0],
    windmills: [0, 0],
    piers: [0, 0],
    lighthouses: [0, 0],
    boats: [0, 0],
  };
  chunks.forEach((cg) => {
    const counts = cg.userData.counts;
    if (!counts) return;
    total++;
    const at = cg.userData.worldPosition || cg.position;
    const isNear = at.distanceToSquared(pos) <= lodSq;
    if (isNear) near++;
    for (const key in landmarks) {
      const n = counts[key] || 0;
      landmarks[key][1] += n;
      if (isNear) landmarks[key][0] += n;
    }
  });
  return {lod, total, near, landmarks};
}

function updatePerf(avgCalls, avgTris, avgCpu) {
  const fps = Math.round(performanceMonitor.getAvgFPS());
  const low = Math.round(performanceMonitor.get1PercentLowFPS());
  setColored(
    'debug-fps',
    `${fps} avg · 1% low ${low}`,
    perfColor(60 - low, 30, 40)
  );
  setColored(
    'debug-frame-ms',
    `${performanceMonitor.getSmoothedFrameTime().toFixed(1)} ms · cpu ${avgCpu.toFixed(1)} ms`,
    perfColor(avgCpu, 24, 32)
  );
  setColored(
    'debug-draw-calls',
    String(avgCalls),
    perfColor(avgCalls, 800, 1200)
  );
  setColored(
    'debug-triangles',
    fmtTris(avgTris),
    perfColor(avgTris, 2.5e6, 4e6)
  );
  const canvas = renderer.domElement;
  updateDOM(
    'debug-resolution',
    `${canvas.width}×${canvas.height} · ×${renderer.getPixelRatio().toFixed(2)}` +
      ` (adaptive ×${performanceMonitor.pixelRatioMultiplier.toFixed(2)})`
  );
  const cadence = performanceMonitor.shadowCadence;
  updateDOM(
    'debug-shadow-cadence',
    cadence === 0
      ? 'off'
      : cadence === 1
        ? 'every frame'
        : `every ${cadence} frames`
  );
  const range = chunkRange();
  updateDOM(
    'debug-lod-chunks',
    `${range.total} loaded · ${range.near} in prop range`
  );
  updateDOM('debug-prop-lod-base', `${Math.round(range.lod)} m`);
  updateDOM(
    'debug-chunk-budget',
    `${performanceMonitor.getChunkBudget().toFixed(1)} ms`
  );
  const mem = renderer.info.memory;
  setColored(
    'debug-gpu-objects',
    `${mem.geometries} geometries · ${mem.textures} textures`,
    perfColor(mem.geometries, 400, 600)
  );
  // Heap: Chrome only (Safari has no performance.memory)
  const heap = performance.memory;
  panel.querySelectorAll('.dbg-heap').forEach((el) => {
    el.hidden = !heap;
  });
  if (heap) {
    const mb = heap.usedJSHeapSize / 1048576;
    if (lastHeapMb !== undefined && lastHeapMb - mb > 2)
      lastGcMb = lastHeapMb - mb;
    lastHeapMb = mb;
    setColored(
      'debug-heap',
      `${mb.toFixed(1)} MB` +
        (lastGcMb ? ` · last GC −${lastGcMb.toFixed(1)}` : ''),
      perfColor(mb, 150, 250)
    );
  }
  updateDOM(
    'debug-preset',
    `${state.graphicsPreset} · ${ART_STYLE === 'anime' ? 'anime' : 'low poly'}`
  );
}

function updateThings() {
  // The instanced props on screen, by part (a pine is a trunk and a top),
  // heaviest first by triangles
  const drawn = [];
  let totalCount = 0;
  let totalTris = 0;
  for (const [type, info] of globalInstancer.types) {
    let count = 0;
    let tris = 0;
    for (const mesh of info.tiles.values()) {
      if (!mesh.visible || !mesh.count) continue;
      const geo = mesh.geometry;
      const perInstance =
        (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      count += mesh.count;
      tris += mesh.count * perInstance;
    }
    if (!count) continue;
    totalCount += count;
    totalTris += tris;
    drawn.push([type, count, tris]);
  }
  drawn.sort((a, b) => b[2] - a[2]);
  const rows = drawn
    .slice(0, TOP_DRAWN)
    .map(
      ([type, count, tris]) =>
        `<dt>${type}</dt><dd>${count} · ${fmtTris(tris)}</dd>`
    );
  rows.push(
    `<dt>All ${drawn.length} parts</dt><dd>${totalCount} · ${fmtTris(totalTris)}</dd>`
  );
  const list = getCachedElement('debug-drawn');
  const html = rows.join('');
  if (list && list._html !== html) {
    list.innerHTML = html;
    list._html = html;
  }
  updateDOM('debug-traffic', String(trafficCount()));
  updateDOM('debug-road-cars', String(roadCarCount()));
  const {landmarks} = chunkRange();
  const marks = getCachedElement('debug-landmarks');
  const markHtml = Object.entries(landmarks)
    .map(([key, [near, total]]) => `<dt>${key}</dt><dd>${near} / ${total}</dd>`)
    .join('');
  if (marks && marks._html !== markHtml) {
    marks.innerHTML = markHtml;
    marks._html = markHtml;
  }
}

function updateSettings() {
  const palette = isCustomPalette
    ? 'Custom'
    : currentPaletteSeed !== undefined
      ? `${selectedPalette.name} (#${currentPaletteSeed})`
      : selectedPalette.name;
  updateDOM('debug-palette', palette);
}

// Every frame while the panel is open (game-loop.js); `frame` has
// frameStartTime, overcast and cloudMood
export function updateDebugTelemetry(frame) {
  if (!panel || panel.style.display !== 'block') return;
  const now = performance.now();
  frames++;
  cpuSum += now - frame.frameStartTime;
  callsSum += renderer.info.render.calls;
  trisSum += renderer.info.render.triangles;
  if (now - lastRefresh < REFRESH_MS) return;
  lastRefresh = now;
  const avgCalls = Math.round(callsSum / frames);
  const avgTris = Math.round(trisSum / frames);
  const avgCpu = cpuSum / frames;
  frames = 0;
  cpuSum = 0;
  callsSum = 0;
  trisSum = 0;

  updateDOM(
    'debug-head-fps',
    `${Math.round(performanceMonitor.getAvgFPS())} fps`
  );
  updateDOM(
    'debug-head-sub',
    `${performanceMonitor.getSmoothedFrameTime().toFixed(1)} ms · ${avgCalls} calls`
  );
  if (folded) return;
  if (activeTab === 'live') updateLive(frame);
  else if (activeTab === 'perf') updatePerf(avgCalls, avgTris, avgCpu);
  else if (activeTab === 'things') updateThings();
  else updateSettings();
}
