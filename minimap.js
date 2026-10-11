import {ChillFlightLogic} from './chill-flight-logic.js';
import {log} from './logger.js';
import {
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  WATER_LEVEL,
  updateUrlParams,
} from './constants.js';
import {simplex} from './noise.js';
import {planeGroup} from './airplane.js';
import {suppressPauseClick} from './game-state.js';
import {hooks} from './hooks.js';
import {resetSteering} from './game-ui.js';
import {Achievements} from './achievements.js';
import {mapColor} from './map-palette.js';
import {MapTiles, MAX_LEVEL, TILE_PX} from './map-tiles.js';
import {updateChunks} from './terrain-chunks.js';
import {cameraDolly} from './game-input-bindings.js';
import {camera} from './sky.js';
import {
  _currentLookTarget,
  _virtualCameraPos,
  _virtualLookTarget,
} from './game.js';
import {state} from './state.js';

/* global WATER_LEVEL, MAP_WORLD_SIZE, MAP_HEIGHT_SCALE, simplex, ChillFlightLogic, planeGroup */
// minimap.js - Simple lightweight scrolling minimap overlay
(function () {
  let minimapContainer = null;
  let canvas = null;
  let ctx = null;

  // Offscreen canvas for cached heightmap background
  let bgCanvas = null;
  let bgCtx = null;

  let viewRadius = 2000; // in world coordinate units
  let gridSize = 60; // 60x60 grid is extremely lightweight but looks great

  let lastUpdateX = Infinity;
  let lastUpdateZ = Infinity;
  let lastUpdateZoom = 0;
  let lastUpdateTime = 0;
  let minimapVisible = false; // Hidden by default!

  const constants = {
    WATER_LEVEL: 40,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400,
  };

  // Scratch [r, g, b] for mapColor
  const _color = [0, 0, 0];

  const LANDMARKS = [
    {
      name: 'Volcano',
      x: -5000,
      z: 5000,
      color: '#e74c3c', // vibrant red-orange
      symbol: '▲',
    },
    {
      name: 'Lighthouse',
      x: 6000,
      z: 3000,
      color: '#3498db', // vibrant blue beacon
      symbol: '☤',
    },
    {
      name: 'Rock Arch',
      x: 3000,
      z: ChillFlightLogic.WORLD_SEED
        ? ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED)() * 10000 -
          5000
        : 0,
      color: '#2ecc71', // lush emerald green
      symbol: '∩',
    },
    {
      name: 'Falls',
      x: ChillFlightLogic.FALLS_X,
      z: ChillFlightLogic.FALLS_Z,
      color: '#7fd8f0', // falling-water blue
      symbol: '≋',
    },
    {
      // Halfway down the canyon (chill-flight-logic.js)
      name: 'Canyon',
      x: ChillFlightLogic.CANYON_PATH[2][0] * 5000,
      z: -ChillFlightLogic.CANYON_PATH[2][1] * 5000,
      color: '#d2693c', // canyon-rock rust
      symbol: '⩔',
    },
    // The airports (chill-flight-logic.js)
    ...ChillFlightLogic.AIRPORTS.map((a) => ({
      name: a.name,
      x: a.x,
      z: a.z,
      color: '#f1c40f', // runway-light amber
      symbol: '✈',
    })),
  ];

  function initMinimap() {
    // Create background canvas for offscreen heightmap caching
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = gridSize;
    bgCanvas.height = gridSize;
    bgCtx = bgCanvas.getContext('2d');

    minimapContainer = document.createElement('div');
    minimapContainer.id = 'minimap-container';
    minimapContainer.className = 'desktop-only';
    minimapContainer.style.display = 'none'; // Hidden by default!

    const handleMinimapEnter = () => {
      resetSteering();
    };
    minimapContainer.addEventListener('mouseenter', handleMinimapEnter);
    minimapContainer.addEventListener('touchstart', handleMinimapEnter, {
      passive: true,
    });

    const header = document.createElement('div');
    header.id = 'minimap-header';

    const title = document.createElement('span');
    title.textContent = 'Minimap'; // Sentence case!
    header.appendChild(title);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '6px';
    controls.style.pointerEvents = 'auto';

    const zoomInBtn = document.createElement('button');
    zoomInBtn.className = 'minimap-btn';
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Zoom in';
    zoomInBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (viewRadius > 1000) {
        viewRadius = Math.max(1000, viewRadius - 1000);
        forceRedraw();
      }
    });

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.className = 'minimap-btn';
    zoomOutBtn.textContent = '-';
    zoomOutBtn.title = 'Zoom out';
    zoomOutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (viewRadius < 5000) {
        viewRadius = Math.min(5000, viewRadius + 1000);
        forceRedraw();
      }
    });

    controls.appendChild(zoomOutBtn);
    controls.appendChild(zoomInBtn);
    header.appendChild(controls);
    minimapContainer.appendChild(header);

    canvas = document.createElement('canvas');
    canvas.id = 'minimap-canvas';
    canvas.width = 180;
    canvas.height = 180;
    ctx = canvas.getContext('2d');
    minimapContainer.appendChild(canvas);

    // Append to ui-layer
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) {
      uiLayer.appendChild(minimapContainer);
    } else {
      document.body.appendChild(minimapContainer);
    }

    log.info('🗺️ Minimap successfully loaded and initialized.');

    // Start game loop updater
    updateLoop();

    // Check if minimap should start enabled from URL parameter
    if (ChillFlightLogic.START_MINIMAP) {
      toggleMinimap(true);
    }
  }

  function forceRedraw() {
    lastUpdateX = Infinity;
    lastUpdateZ = Infinity;
  }

  function drawBackgroundHeightmap(px, pz) {
    // Re-read constants if they exist in environment
    constants.WATER_LEVEL = WATER_LEVEL;
    constants.MAP_WORLD_SIZE = MAP_WORLD_SIZE;
    constants.MAP_HEIGHT_SCALE = MAP_HEIGHT_SCALE;

    const imgData = bgCtx.createImageData(gridSize, gridSize);
    const data = imgData.data;

    const simplexInstance = simplex;
    if (!simplexInstance) return;

    for (let gz = 0; gz < gridSize; gz++) {
      for (let gx = 0; gx < gridSize; gx++) {
        // Map grid coordinates to world coordinates (centered around player position)
        const wx = px + (gx / (gridSize - 1) - 0.5) * viewRadius * 2;
        const wz = pz + (gz / (gridSize - 1) - 0.5) * viewRadius * 2;

        let h;
        try {
          h = ChillFlightLogic.getElevation(wx, wz, simplexInstance, constants);
        } catch {
          h = 40;
        }

        const [r, g, b] = mapColor(h, wx, wz, simplexInstance, _color);

        const idx = (gz * gridSize + gx) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255; // fully opaque
      }
    }

    bgCtx.putImageData(imgData, 0, 0);
  }

  function toggleMinimap(forceState) {
    if (typeof forceState === 'boolean') {
      minimapVisible = forceState;
    } else {
      minimapVisible = !minimapVisible;
    }

    if (minimapContainer) {
      if (minimapVisible && window.innerWidth > 1024) {
        minimapContainer.style.display = 'block';
        forceRedraw(); // Rebuild offscreen canvas immediately when shown
      } else {
        minimapContainer.style.display = 'none';
      }
    }

    if (minimapVisible) {
      updateUrlParams({minimap: 'true'}, ['miniMap', 'mapOverlay']);
    } else {
      updateUrlParams({}, ['minimap', 'miniMap', 'mapOverlay']);
    }
  }

  // Toggle minimap with the M shortcut key & handle fullscreen map keys
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      return;
    }

    if (fsVisible) {
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        e.stopPropagation();
        closeFullscreenMap();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        fsViewRadius = Math.max(FS_MIN_RADIUS, fsViewRadius / 1.25);
        updateCoordsDisplay();
        renderFullscreenMap();
        updateFsMapUrlParams(true);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        fsViewRadius = Math.min(FS_MAX_RADIUS, fsViewRadius * 1.25);
        updateCoordsDisplay();
        renderFullscreenMap();
        updateFsMapUrlParams(true);
        return;
      }
    }

    if (e.key === 'm' || e.key === 'M') {
      toggleMinimap();
    }
  });

  function updateLoop() {
    requestAnimationFrame(updateLoop);

    // If minimap is hidden, skip all calculations to save CPU
    if (!minimapVisible) return;

    // Safety check: is game running and player spawned?
    if (!planeGroup) return;

    const px = planeGroup.position.x;
    const pz = planeGroup.position.z;
    const rotY = planeGroup.rotation.y;

    const now = performance.now();
    const distSq =
      (px - lastUpdateX) * (px - lastUpdateX) +
      (pz - lastUpdateZ) * (pz - lastUpdateZ);

    // Redraw heightmap if player moved > 40 units, zoom changed, or 300ms elapsed
    if (
      distSq > 1600 ||
      viewRadius !== lastUpdateZoom ||
      now - lastUpdateTime > 300
    ) {
      drawBackgroundHeightmap(px, pz);
      lastUpdateX = px;
      lastUpdateZ = pz;
      lastUpdateZoom = viewRadius;
      lastUpdateTime = now;
    }

    // Draw on visible canvas
    ctx.clearRect(0, 0, 180, 180);

    // Draw heightmap background, scaled up with smooth styling
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bgCanvas, 0, 0, 180, 180);

    // Draw Grid Lines (subtle transparent overlay for retro-aviation style)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 30; i < 180; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 180);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(180, i);
      ctx.stroke();
    }

    // Draw landmarks if in range
    LANDMARKS.forEach((landmark) => {
      const dx = landmark.x - px;
      const dz = landmark.z - pz;
      if (Math.abs(dx) <= viewRadius && Math.abs(dz) <= viewRadius) {
        const cx = 90 + (dx / viewRadius) * 90;
        const cy = 90 + (dz / viewRadius) * 90;

        ctx.save();
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;

        // Draw symbol shape background circle
        ctx.fillStyle = landmark.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.25;
        ctx.stroke();

        // Draw symbol character inside the circle
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(landmark.symbol, cx, cy);

        // Draw name label below circle (Sentence case for UI labels)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '8px "Segoe UI", sans-serif';
        ctx.fillText(landmark.name, cx, cy - 8);
        ctx.restore();
      }
    });

    // Draw local player indicator in the center
    const canvasAngle = -rotY - Math.PI / 2;
    ctx.save();
    ctx.translate(90, 90);
    ctx.rotate(canvasAngle);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 5;

    // Stylized paper airplane/flight icon
    ctx.fillStyle = '#ffd700'; // matching gold accent theme
    ctx.beginPath();
    ctx.moveTo(9, 0); // nose
    ctx.lineTo(-7, -7); // left wing tip
    ctx.lineTo(-4, 0); // tail inner
    ctx.lineTo(-7, 7); // right wing tip
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  // FULLSCREEN WORLD MAP IMPLEMENTATION
  // ============================================================

  let fsOverlay = null;
  let fsCanvas = null;
  let fsCtx = null;
  let fsCoordsEl = null;

  let fsVisible = false;
  let fsViewCenterX = 0;
  let fsViewCenterZ = 0;
  let fsViewRadius = 7500;
  const FS_MIN_RADIUS = 1000;
  // Out to the whole world (the continent and the seas around it)
  const FS_MAX_RADIUS = 75000;

  const hasCustomMapCenter =
    ChillFlightLogic.START_MAP_X !== null ||
    ChillFlightLogic.START_MAP_Z !== null ||
    ChillFlightLogic.parsedMapLat !== null ||
    ChillFlightLogic.parsedMapLon !== null;

  const hasCustomMapZoom =
    ChillFlightLogic.START_MAP_ZOOM !== null &&
    !isNaN(ChillFlightLogic.START_MAP_ZOOM) &&
    ChillFlightLogic.START_MAP_ZOOM > 0;

  if (hasCustomMapZoom) {
    const rawZoom = ChillFlightLogic.START_MAP_ZOOM;
    if (rawZoom >= 100) {
      fsViewRadius = Math.max(FS_MIN_RADIUS, Math.min(FS_MAX_RADIUS, rawZoom));
    } else {
      fsViewRadius = Math.max(
        FS_MIN_RADIUS,
        Math.min(FS_MAX_RADIUS, 7500 / rawZoom)
      );
    }
  }

  if (hasCustomMapCenter) {
    if (
      ChillFlightLogic.START_MAP_X !== null &&
      !isNaN(ChillFlightLogic.START_MAP_X)
    ) {
      fsViewCenterX = ChillFlightLogic.START_MAP_X;
    } else if (ChillFlightLogic.parsedMapLon !== null) {
      fsViewCenterX = ChillFlightLogic.parsedMapLon * 5000;
    }

    if (
      ChillFlightLogic.START_MAP_Z !== null &&
      !isNaN(ChillFlightLogic.START_MAP_Z)
    ) {
      fsViewCenterZ = ChillFlightLogic.START_MAP_Z;
    } else if (ChillFlightLogic.parsedMapLat !== null) {
      fsViewCenterZ = -ChillFlightLogic.parsedMapLat * 5000;
    }
  }

  let fsAnimFrameId = null;
  let fsUrlUpdateTimer = null;

  function updateFsMapUrlParams(immediate = false) {
    if (!fsVisible) return;

    const performUpdate = () => {
      if (!fsVisible) return;
      const lat = -fsViewCenterZ / 5000;
      const lon = fsViewCenterX / 5000;

      const formatCoord = (val, isLatitude) => {
        const rounded = parseFloat(Math.abs(val).toFixed(3));
        if (rounded === 0) return '0';
        const dir = isLatitude ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
        return `${rounded}${dir}`;
      };

      const zoomLevel = parseFloat((7500 / fsViewRadius).toFixed(2));

      updateUrlParams(
        {
          fullscreenmap: 'true',
          mapLat: formatCoord(lat, true),
          mapLon: formatCoord(lon, false),
          mapZoom: zoomLevel.toString(),
        },
        [
          'fullscreenMap',
          'worldmap',
          'worldMap',
          'fullscreen-map',
          'world-map',
          'maplat',
          'maplon',
          'maplong',
          'mapLong',
          'mapX',
          'mapx',
          'mapZ',
          'mapz',
          'mapzoom',
          'zoom',
        ]
      );
    };

    if (immediate) {
      if (fsUrlUpdateTimer) {
        clearTimeout(fsUrlUpdateTimer);
        fsUrlUpdateTimer = null;
      }
      performUpdate();
    } else {
      if (fsUrlUpdateTimer) clearTimeout(fsUrlUpdateTimer);
      fsUrlUpdateTimer = setTimeout(() => {
        fsUrlUpdateTimer = null;
        performUpdate();
      }, 150);
    }
  }

  const activePointers = new Map();
  let prevPinchDist = null;
  let prevPanX = 0;
  let prevPanY = 0;
  let isDragging = false;

  function formatLatLon(x, z) {
    const lat = -z / 5000;
    const lon = x / 5000;
    const latStr =
      lat === 0
        ? '0.0° Lat'
        : lat > 0
          ? `${lat.toFixed(1)}° N`
          : `${Math.abs(lat).toFixed(1)}° S`;
    const lonStr =
      lon === 0
        ? '0.0° Lon'
        : lon > 0
          ? `${lon.toFixed(1)}° E`
          : `${Math.abs(lon).toFixed(1)}° W`;
    return `${latStr}, ${lonStr}`;
  }

  function updateCoordsDisplay() {
    if (!fsCoordsEl) return;
    fsCoordsEl.textContent = formatLatLon(fsViewCenterX, fsViewCenterZ);
  }

  function resizeFsCanvas() {
    if (!fsCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (
      fsCanvas.width !== Math.round(w * dpr) ||
      fsCanvas.height !== Math.round(h * dpr)
    ) {
      fsCanvas.width = Math.round(w * dpr);
      fsCanvas.height = Math.round(h * dpr);
    }
  }

  const mapTiles = new MapTiles();
  // How many levels coarser than the sharp one can stand in for a tile
  // that isn't drawn yet
  const FALLBACK_LEVELS = 4;

  // Draws the map from cached tiles: each tile of the sharp level for this
  // zoom if it's drawn, else the matching piece of the nearest coarser tile
  // that is, so the view fills at once and sharpens as tiles arrive. Asks
  // for what's missing: a quick coarse level first, then the sharp tiles
  // from the middle out.
  function drawMapTiles(vMinX, vMinZ, unitsPerPixel, screenW, screenH) {
    const level = MapTiles.levelFor(unitsPerPixel);
    const tileWorld = TILE_PX * MapTiles.upp(level);
    const centerX = vMinX + (screenW * unitsPerPixel) / 2;
    const centerZ = vMinZ + (screenH * unitsPerPixel) / 2;
    const coarse = Math.min(MAX_LEVEL, level + 2);
    const wanted = [];
    const coarseWanted = new Map();
    fsCtx.imageSmoothingEnabled = true;
    fsCtx.imageSmoothingQuality = 'low';
    const tx0 = Math.floor(vMinX / tileWorld);
    const tz0 = Math.floor(vMinZ / tileWorld);
    const tx1 = Math.floor((vMinX + screenW * unitsPerPixel) / tileWorld);
    const tz1 = Math.floor((vMinZ + screenH * unitsPerPixel) / tileWorld);
    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        // Whole screen pixels, each tile meeting the next, so no seams
        const x = Math.floor((tx * tileWorld - vMinX) / unitsPerPixel);
        const y = Math.floor((tz * tileWorld - vMinZ) / unitsPerPixel);
        const w =
          Math.floor(((tx + 1) * tileWorld - vMinX) / unitsPerPixel) - x;
        const h =
          Math.floor(((tz + 1) * tileWorld - vMinZ) / unitsPerPixel) - y;
        const tile = mapTiles.get(level, tx, tz);
        if (tile) {
          fsCtx.drawImage(tile, x, y, w, h);
          continue;
        }
        const top = Math.min(MAX_LEVEL, level + FALLBACK_LEVELS);
        for (let up = level + 1; up <= top; up++) {
          const k = 2 ** (up - level);
          const atx = Math.floor(tx / k);
          const atz = Math.floor(tz / k);
          const parent = mapTiles.get(up, atx, atz);
          if (parent) {
            const sub = TILE_PX / k;
            fsCtx.drawImage(
              parent,
              (tx - atx * k) * sub,
              (tz - atz * k) * sub,
              sub,
              sub,
              x,
              y,
              w,
              h
            );
            break;
          }
        }
        const d = Math.hypot(
          (tx + 0.5) * tileWorld - centerX,
          (tz + 0.5) * tileWorld - centerZ
        );
        wanted.push([d, level, tx, tz]);
        const k = 2 ** (coarse - level);
        const ck = `${Math.floor(tx / k)}:${Math.floor(tz / k)}`;
        if (coarse > level && !coarseWanted.has(ck)) {
          coarseWanted.set(ck, [
            coarse,
            Math.floor(tx / k),
            Math.floor(tz / k),
          ]);
        }
      }
    }
    wanted.sort((a, b) => a[0] - b[0]);
    mapTiles.want([
      ...coarseWanted.values(),
      ...wanted.map(([, lvl, tx, tz]) => [lvl, tx, tz]),
    ]);
  }

  function renderFullscreenMap() {
    if (!fsVisible || !fsCtx) return;

    resizeFsCanvas();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const minDim = Math.min(screenW, screenH);
    const worldUnitsPerPixel = (fsViewRadius * 2) / minDim;

    const visibleWorldW = screenW * worldUnitsPerPixel;
    const visibleWorldH = screenH * worldUnitsPerPixel;
    const vMinX = fsViewCenterX - visibleWorldW / 2;
    const vMinZ = fsViewCenterZ - visibleWorldH / 2;

    fsCtx.save();
    fsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fsCtx.fillStyle = '#090e17';
    fsCtx.fillRect(0, 0, screenW, screenH);

    // 1. The map itself, from cached tiles (map-tiles.js): coarser levels
    // first, then the sharp level over them, so the view fills in at once
    // and sharpens as tiles arrive
    drawMapTiles(vMinX, vMinZ, worldUnitsPerPixel, screenW, screenH);

    // 2. Coordinate Grid Lines & Lat/Long Labels with Dynamic Step Scaling
    const LAT_SCALE = 5000;
    let gridStepDeg;
    if (visibleWorldW > 60000) {
      gridStepDeg = 5.0;
    } else if (visibleWorldW > 25000) {
      gridStepDeg = 2.0;
    } else if (visibleWorldW > 10000) {
      gridStepDeg = 1.0;
    } else if (visibleWorldW > 4000) {
      gridStepDeg = 0.5;
    } else {
      gridStepDeg = 0.2;
    }

    const stepUnits = gridStepDeg * LAT_SCALE;
    const prec = gridStepDeg < 0.5 ? 2 : gridStepDeg < 1 ? 1 : 0;

    fsCtx.lineWidth = 1;
    fsCtx.font =
      '10px SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace';

    // Horizontal latitude lines
    const startLatStep = Math.floor(vMinZ / stepUnits);
    const endLatStep = Math.ceil((vMinZ + visibleWorldH) / stepUnits);

    for (let s = startLatStep; s <= endLatStep; s++) {
      const lineZ = s * stepUnits;
      const lineY = (lineZ - vMinZ) / worldUnitsPerPixel;
      const lat = -s * gridStepDeg;

      const isEquator = Math.abs(lat) < 0.0001;
      fsCtx.strokeStyle = isEquator
        ? 'rgba(255, 215, 0, 0.28)'
        : 'rgba(255, 255, 255, 0.08)';
      fsCtx.beginPath();
      fsCtx.moveTo(0, lineY);
      fsCtx.lineTo(screenW, lineY);
      fsCtx.stroke();

      const latLabel = isEquator
        ? '0.0° (Equator)'
        : lat > 0
          ? `${lat.toFixed(prec)}° N`
          : `${Math.abs(lat).toFixed(prec)}° S`;
      fsCtx.fillStyle = isEquator
        ? 'rgba(255, 215, 0, 0.65)'
        : 'rgba(255, 255, 255, 0.45)';
      fsCtx.textAlign = 'left';
      fsCtx.textBaseline = 'bottom';
      fsCtx.fillText(latLabel, 14, lineY - 4);
    }

    // Vertical longitude lines
    const startLonStep = Math.floor(vMinX / stepUnits);
    const endLonStep = Math.ceil((vMinX + visibleWorldW) / stepUnits);

    for (let s = startLonStep; s <= endLonStep; s++) {
      const lineX = s * stepUnits;
      const screenX = (lineX - vMinX) / worldUnitsPerPixel;
      const lon = s * gridStepDeg;

      const isPrime = Math.abs(lon) < 0.0001;
      fsCtx.strokeStyle = isPrime
        ? 'rgba(52, 152, 219, 0.28)'
        : 'rgba(255, 255, 255, 0.08)';
      fsCtx.beginPath();
      fsCtx.moveTo(screenX, 0);
      fsCtx.lineTo(screenX, screenH);
      fsCtx.stroke();

      const lonLabel = isPrime
        ? '0.0°'
        : lon > 0
          ? `${lon.toFixed(prec)}° E`
          : `${Math.abs(lon).toFixed(prec)}° W`;
      fsCtx.fillStyle = isPrime
        ? 'rgba(52, 152, 219, 0.65)'
        : 'rgba(255, 255, 255, 0.45)';
      fsCtx.textAlign = 'center';
      fsCtx.textBaseline = 'top';
      fsCtx.fillText(lonLabel, screenX, 72);
    }

    // 3. Landmarks (with LOD: compact pins at distance, full cards when zoomed in)
    const showFullLandmarks = visibleWorldW <= 30000;
    LANDMARKS.forEach((lm) => {
      const lx = (lm.x - vMinX) / worldUnitsPerPixel;
      const lz = (lm.z - vMinZ) / worldUnitsPerPixel;

      if (lx >= -60 && lx <= screenW + 60 && lz >= -60 && lz <= screenH + 60) {
        fsCtx.save();
        fsCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        fsCtx.shadowBlur = 6;

        const pinRadius = showFullLandmarks ? 10 : 7;
        fsCtx.fillStyle = lm.color;
        fsCtx.beginPath();
        fsCtx.arc(lx, lz, pinRadius, 0, Math.PI * 2);
        fsCtx.fill();
        fsCtx.strokeStyle = '#ffffff';
        fsCtx.lineWidth = showFullLandmarks ? 1.75 : 1.25;
        fsCtx.stroke();

        if (showFullLandmarks) {
          fsCtx.fillStyle = '#ffffff';
          fsCtx.font = 'bold 11px -apple-system, sans-serif';
          fsCtx.textAlign = 'center';
          fsCtx.textBaseline = 'middle';
          fsCtx.fillText(lm.symbol, lx, lz);

          fsCtx.fillStyle = '#ffffff';
          fsCtx.font = '600 12px Inter, -apple-system, sans-serif';
          fsCtx.fillText(lm.name, lx, lz + 18);

          const lmLat = -lm.z / 5000;
          const lmLon = lm.x / 5000;
          const lmCoordStr = `${Math.abs(lmLat).toFixed(1)}° ${lmLat >= 0 ? 'N' : 'S'}, ${Math.abs(lmLon).toFixed(1)}° ${lmLon >= 0 ? 'E' : 'W'}`;
          fsCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          fsCtx.font =
            '10px SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace';
          fsCtx.fillText(lmCoordStr, lx, lz + 32);
        }

        fsCtx.restore();
      }
    });

    // 3.5 The picked spot ("Fly here")
    if (warpPin) {
      const wx = (warpPin.x - vMinX) / worldUnitsPerPixel;
      const wz = (warpPin.z - vMinZ) / worldUnitsPerPixel;
      fsCtx.save();
      fsCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      fsCtx.shadowBlur = 6;
      fsCtx.strokeStyle = '#ffd700';
      fsCtx.lineWidth = 2.5;
      fsCtx.beginPath();
      fsCtx.arc(wx, wz, 11, 0, Math.PI * 2);
      fsCtx.stroke();
      fsCtx.beginPath();
      fsCtx.moveTo(wx - 17, wz);
      fsCtx.lineTo(wx - 5, wz);
      fsCtx.moveTo(wx + 5, wz);
      fsCtx.lineTo(wx + 17, wz);
      fsCtx.moveTo(wx, wz - 17);
      fsCtx.lineTo(wx, wz - 5);
      fsCtx.moveTo(wx, wz + 5);
      fsCtx.lineTo(wx, wz + 17);
      fsCtx.stroke();
      fsCtx.restore();
    }

    // 4. Player Plane Indicator
    if (planeGroup) {
      const px = planeGroup.position.x;
      const pz = planeGroup.position.z;
      const rotY = planeGroup.rotation.y;

      const screenPx = (px - vMinX) / worldUnitsPerPixel;
      const screenPz = (pz - vMinZ) / worldUnitsPerPixel;

      const isOnScreen =
        screenPx >= 20 &&
        screenPx <= screenW - 20 &&
        screenPz >= 20 &&
        screenPz <= screenH - 20;

      if (isOnScreen) {
        const pulseT = (Date.now() % 1600) / 1600;
        const pulseR = 14 + pulseT * 26;
        const pulseAlpha = Math.max(0, 1 - pulseT) * 0.7;

        fsCtx.save();
        fsCtx.strokeStyle = `rgba(255, 215, 0, ${pulseAlpha})`;
        fsCtx.lineWidth = 2;
        fsCtx.beginPath();
        fsCtx.arc(screenPx, screenPz, pulseR, 0, Math.PI * 2);
        fsCtx.stroke();
        fsCtx.restore();

        const canvasAngle = -rotY - Math.PI / 2;
        fsCtx.save();
        fsCtx.translate(screenPx, screenPz);
        fsCtx.rotate(canvasAngle);
        fsCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        fsCtx.shadowBlur = 8;

        fsCtx.fillStyle = '#ffd700';
        fsCtx.beginPath();
        fsCtx.moveTo(14, 0);
        fsCtx.lineTo(-11, -11);
        fsCtx.lineTo(-6, 0);
        fsCtx.lineTo(-11, 11);
        fsCtx.closePath();
        fsCtx.fill();

        fsCtx.strokeStyle = '#ffffff';
        fsCtx.lineWidth = 1.75;
        fsCtx.stroke();
        fsCtx.restore();

        fsCtx.save();
        fsCtx.font = 'bold 10px Inter, -apple-system, sans-serif';
        fsCtx.textAlign = 'center';
        fsCtx.fillStyle = '#ffd700';
        fsCtx.shadowColor = 'rgba(0,0,0,0.9)';
        fsCtx.shadowBlur = 4;
        fsCtx.fillText('YOU', screenPx, screenPz - 18);
        fsCtx.restore();
      } else {
        const dx = screenPx - screenW / 2;
        const dy = screenPz - screenH / 2;
        const angle = Math.atan2(dy, dx);
        const margin = 40;

        let edgeX = screenW / 2;
        let edgeY = screenH / 2;
        const halfW = screenW / 2 - margin;
        const halfH = screenH / 2 - margin;

        if (Math.abs(dx * halfH) > Math.abs(dy * halfW)) {
          edgeX += dx > 0 ? halfW : -halfW;
          edgeY += (dx > 0 ? halfW : -halfW) * (dy / dx);
        } else {
          edgeY += dy > 0 ? halfH : -halfH;
          edgeX += (dy > 0 ? halfH : -halfH) * (dx / dy);
        }

        fsCtx.save();
        fsCtx.translate(edgeX, edgeY);
        fsCtx.rotate(angle);

        fsCtx.fillStyle = '#ffd700';
        fsCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        fsCtx.shadowBlur = 6;
        fsCtx.beginPath();
        fsCtx.moveTo(10, 0);
        fsCtx.lineTo(-8, -7);
        fsCtx.lineTo(-4, 0);
        fsCtx.lineTo(-8, 7);
        fsCtx.closePath();
        fsCtx.fill();
        fsCtx.strokeStyle = '#ffffff';
        fsCtx.lineWidth = 1.5;
        fsCtx.stroke();
        fsCtx.restore();

        const distUnits = Math.hypot(px - fsViewCenterX, pz - fsViewCenterZ);
        const distKm = (distUnits / 1000).toFixed(1);
        fsCtx.save();
        fsCtx.font = 'bold 9px Inter, -apple-system, sans-serif';
        fsCtx.textAlign = 'center';
        fsCtx.fillStyle = '#ffd700';
        fsCtx.fillText(`${distKm} km`, edgeX, edgeY + 16);
        fsCtx.restore();
      }
    }

    fsCtx.restore();
  }

  let fsHasCenteredOnPlane = hasCustomMapCenter;

  function fsAnimationLoop() {
    if (!fsVisible) return;
    if (!fsHasCenteredOnPlane && planeGroup) {
      fsViewCenterX = planeGroup.position.x;
      fsViewCenterZ = planeGroup.position.z;
      fsHasCenteredOnPlane = true;
      updateCoordsDisplay();
      updateFsMapUrlParams(true);
    }
    renderFullscreenMap();
    fsAnimFrameId = requestAnimationFrame(fsAnimationLoop);
  }

  function openFullscreenMap() {
    if (fsVisible) return;
    initFullscreenMap();
    fsVisible = true;
    if (fsOverlay) {
      fsOverlay.style.display = 'block';
    }
    if (!hasCustomMapCenter) {
      if (planeGroup) {
        fsViewCenterX = planeGroup.position.x;
        fsViewCenterZ = planeGroup.position.z;
        fsHasCenteredOnPlane = true;
      } else {
        fsHasCenteredOnPlane = false;
      }
    } else {
      fsHasCenteredOnPlane = true;
    }
    updateCoordsDisplay();
    resizeFsCanvas();
    renderFullscreenMap();
    if (fsAnimFrameId) cancelAnimationFrame(fsAnimFrameId);
    fsAnimFrameId = requestAnimationFrame(fsAnimationLoop);

    updateFsMapUrlParams(true);

    Achievements.unlock('cartographer');
  }

  // --- WARP ("Fly here") ---
  // Tap a spot on the map to pin it, then "Fly here" moves the plane there,
  // 400 units above the ground, keeping its heading and speed.
  let warpPin = null;
  const TAP_SLOP = 6; // pixels a tap may move and still count as a tap
  const TAP_TIME = 400; // ms
  let tapStart = null;

  function setWarpPin(pin) {
    warpPin = pin;
    const panel = document.getElementById('fullscreen-map-warp');
    if (panel) panel.hidden = !pin;
    const coords = document.getElementById('fullscreen-map-warp-coords');
    if (coords && pin) coords.textContent = formatLatLon(pin.x, pin.z);
    renderFullscreenMap();
  }

  function warpTo(x, z) {
    let ground = WATER_LEVEL;
    try {
      ground = Math.max(
        WATER_LEVEL,
        ChillFlightLogic.getElevation(x, z, simplex, constants)
      );
    } catch {
      /* keep the water level */
    }
    const dx = x - planeGroup.position.x;
    const dy = ground + 400 - planeGroup.position.y;
    const dz = z - planeGroup.position.z;
    planeGroup.position.set(x, ground + 400, z);
    // Move the camera and its tracking targets with the plane, so it doesn't
    // sweep across the world to catch up
    const activeCam = state.isVRPresenting ? cameraDolly : camera;
    for (const v of [
      activeCam.position,
      _currentLookTarget,
      _virtualCameraPos,
      _virtualLookTarget,
    ]) {
      v.x += dx;
      v.y += dy;
      v.z += dz;
    }
    // The jump isn't distance flown
    if (state.previousPosition)
      state.previousPosition.copy(planeGroup.position);
    updateChunks();
    log.info(
      `[Warp] To X = ${x.toFixed(0)}, Z = ${z.toFixed(0)} (${formatLatLon(x, z)})`
    );
  }

  function closeFullscreenMap() {
    if (!fsVisible) return;

    suppressPauseClick(500);

    fsVisible = false;
    setWarpPin(null);
    if (fsOverlay) {
      fsOverlay.style.display = 'none';
    }
    if (fsAnimFrameId) {
      cancelAnimationFrame(fsAnimFrameId);
      fsAnimFrameId = null;
    }
    if (fsUrlUpdateTimer) {
      clearTimeout(fsUrlUpdateTimer);
      fsUrlUpdateTimer = null;
    }
    activePointers.clear();
    isDragging = false;
    prevPinchDist = null;

    updateUrlParams({}, [
      'fullscreenmap',
      'fullscreenMap',
      'worldmap',
      'worldMap',
      'fullscreen-map',
      'world-map',
      'mapLat',
      'maplat',
      'mapLon',
      'maplon',
      'mapLong',
      'maplong',
      'mapX',
      'mapx',
      'mapZ',
      'mapz',
      'mapZoom',
      'mapzoom',
      'zoom',
    ]);
  }

  let fsInitialized = false;
  function initFullscreenMap() {
    if (fsInitialized) return;
    fsOverlay = document.getElementById('fullscreen-map-overlay');
    fsCanvas = document.getElementById('fullscreen-map-canvas');
    fsCoordsEl = document.getElementById('fullscreen-map-coords');
    if (!fsOverlay || !fsCanvas) return;

    fsCtx = fsCanvas.getContext('2d');

    const attachButtonAction = (btn, action) => {
      if (!btn) return;
      let lastTrigger = 0;
      const handleAction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastTrigger < 350) return;
        lastTrigger = now;
        action(e);
      };
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });
      btn.addEventListener(
        'touchstart',
        (e) => {
          e.stopPropagation();
        },
        {passive: true}
      );
      btn.addEventListener('touchend', handleAction);
      btn.addEventListener('click', handleAction);
    };

    const closeBtn = document.getElementById('fullscreen-map-close-btn');
    attachButtonAction(closeBtn, () => {
      closeFullscreenMap();
    });

    attachButtonAction(
      document.getElementById('fullscreen-map-warp-btn'),
      () => {
        if (!warpPin) return;
        const {x, z} = warpPin;
        warpTo(x, z);
        closeFullscreenMap();
      }
    );
    attachButtonAction(
      document.getElementById('fullscreen-map-warp-cancel'),
      () => setWarpPin(null)
    );

    const recenterBtn = document.getElementById('fullscreen-map-recenter-btn');
    attachButtonAction(recenterBtn, () => {
      if (planeGroup) {
        fsViewCenterX = planeGroup.position.x;
        fsViewCenterZ = planeGroup.position.z;
        updateCoordsDisplay();
        renderFullscreenMap();
        updateFsMapUrlParams(true);
      }
    });

    const zoomInBtn = document.getElementById('fullscreen-map-zoom-in');
    attachButtonAction(zoomInBtn, () => {
      fsViewRadius = Math.max(FS_MIN_RADIUS, fsViewRadius / 1.3);
      updateCoordsDisplay();
      renderFullscreenMap();
      updateFsMapUrlParams(true);
    });

    const zoomOutBtn = document.getElementById('fullscreen-map-zoom-out');
    attachButtonAction(zoomOutBtn, () => {
      fsViewRadius = Math.min(FS_MAX_RADIUS, fsViewRadius * 1.3);
      updateCoordsDisplay();
      renderFullscreenMap();
      updateFsMapUrlParams(true);
    });

    // Pointer events for mobile pinch-zoom and drag-to-pan
    fsCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activePointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
      if (typeof fsCanvas.setPointerCapture === 'function') {
        try {
          fsCanvas.setPointerCapture(e.pointerId);
        } catch (err) {
          console.debug('Pointer capture not available', err);
        }
      }
      fsCanvas.classList.add('dragging');
      tapStart =
        activePointers.size === 1
          ? {x: e.clientX, y: e.clientY, t: performance.now()}
          : null;

      if (activePointers.size === 1) {
        isDragging = true;
        prevPanX = e.clientX;
        prevPanY = e.clientY;
      } else if (activePointers.size === 2) {
        isDragging = false;
        const pts = Array.from(activePointers.values());
        prevPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        prevPanX = (pts[0].x + pts[1].x) / 2;
        prevPanY = (pts[0].y + pts[1].y) / 2;
      }
    });

    const handlePointerMove = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, {x: e.clientX, y: e.clientY});

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const minDim = Math.min(screenW, screenH);
      const worldUnitsPerPixel = (fsViewRadius * 2) / minDim;

      if (activePointers.size === 1 && isDragging) {
        const dx = e.clientX - prevPanX;
        const dy = e.clientY - prevPanY;
        prevPanX = e.clientX;
        prevPanY = e.clientY;

        fsViewCenterX -= dx * worldUnitsPerPixel;
        fsViewCenterZ -= dy * worldUnitsPerPixel;

        updateCoordsDisplay();

        renderFullscreenMap();
        updateFsMapUrlParams(false);
      } else if (activePointers.size >= 2) {
        const pts = Array.from(activePointers.values());
        const currDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

        if (prevPinchDist && prevPinchDist > 0 && currDist > 0) {
          const zoomRatio = currDist / prevPinchDist;
          fsViewRadius = Math.max(
            FS_MIN_RADIUS,
            Math.min(FS_MAX_RADIUS, fsViewRadius / zoomRatio)
          );
        }
        prevPinchDist = currDist;

        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const dx = midX - prevPanX;
        const dy = midY - prevPanY;
        prevPanX = midX;
        prevPanY = midY;

        fsViewCenterX -= dx * worldUnitsPerPixel;
        fsViewCenterZ -= dy * worldUnitsPerPixel;

        updateCoordsDisplay();
        renderFullscreenMap();
        updateFsMapUrlParams(false);
      }
    };

    const handlePointerUp = (e) => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.delete(e.pointerId);
      if (typeof fsCanvas.releasePointerCapture === 'function') {
        try {
          fsCanvas.releasePointerCapture(e.pointerId);
        } catch (err) {
          console.debug('Release pointer capture not available', err);
        }
      }

      if (activePointers.size === 1) {
        const p = activePointers.values().next().value;
        prevPanX = p.x;
        prevPanY = p.y;
        isDragging = true;
        prevPinchDist = null;
      } else if (activePointers.size === 0) {
        isDragging = false;
        prevPinchDist = null;
        fsCanvas.classList.remove('dragging');
        // A tap (not a drag) pins that spot
        if (
          tapStart &&
          Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) <
            TAP_SLOP &&
          performance.now() - tapStart.t < TAP_TIME
        ) {
          const minDim = Math.min(window.innerWidth, window.innerHeight);
          const unitsPerPixel = (fsViewRadius * 2) / minDim;
          setWarpPin({
            x:
              fsViewCenterX +
              (e.clientX - window.innerWidth / 2) * unitsPerPixel,
            z:
              fsViewCenterZ +
              (e.clientY - window.innerHeight / 2) * unitsPerPixel,
          });
        }
        tapStart = null;
        renderFullscreenMap();
        updateFsMapUrlParams(true);
      }
    };

    fsCanvas.addEventListener('pointermove', handlePointerMove);
    fsCanvas.addEventListener('pointerup', handlePointerUp);
    fsCanvas.addEventListener('pointercancel', handlePointerUp);

    // Desktop mouse wheel zoom
    fsCanvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        fsViewRadius = Math.max(
          FS_MIN_RADIUS,
          Math.min(FS_MAX_RADIUS, fsViewRadius * factor)
        );
        updateCoordsDisplay();
        renderFullscreenMap();
        updateFsMapUrlParams(false);
      },
      {passive: false}
    );

    // Double-click/tap zoom in
    fsCanvas.addEventListener('dblclick', (e) => {
      e.preventDefault();
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const minDim = Math.min(screenW, screenH);
      const worldUnitsPerPixel = (fsViewRadius * 2) / minDim;

      const clickDx = e.clientX - screenW / 2;
      const clickDy = e.clientY - screenH / 2;
      fsViewCenterX += clickDx * worldUnitsPerPixel * 0.4;
      fsViewCenterZ += clickDy * worldUnitsPerPixel * 0.4;

      fsViewRadius = Math.max(FS_MIN_RADIUS, fsViewRadius / 1.5);
      updateCoordsDisplay();
      renderFullscreenMap();
      updateFsMapUrlParams(true);
    });

    window.addEventListener('resize', () => {
      if (fsVisible) {
        resizeFsCanvas();
        renderFullscreenMap();
      }
    });

    fsInitialized = true;
  }

  // APIs for modules that load earlier (see hooks.js)
  hooks.fullscreenMap = {
    open: openFullscreenMap,
    close: closeFullscreenMap,
    toggle: function () {
      if (fsVisible) closeFullscreenMap();
      else openFullscreenMap();
    },
    isOpen: function () {
      return fsVisible;
    },
    syncUrlParams: function () {
      updateFsMapUrlParams(true);
    },
  };

  hooks.minimap = {
    toggle: toggleMinimap,
    isVisible: function () {
      return minimapVisible;
    },
  };

  // Wait for the DOM and standard game scripts to be loaded before initializing
  function startInit() {
    initMinimap();
    initFullscreenMap();
    if (ChillFlightLogic.START_FULLSCREEN_MAP) {
      openFullscreenMap();
    }
  }

  if (document.readyState === 'complete') {
    startInit();
  } else {
    window.addEventListener('load', startInit);
  }
})();
