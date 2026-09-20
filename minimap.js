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
      z: 0,
      color: '#2ecc71', // lush emerald green
      symbol: '∩',
    },
  ];

  // Sentence case for UI labels per rules
  function getColorForHeight(h) {
    if (h <= 40) {
      return '#203c70'; // rich deep water blue
    } else if (h <= 44) {
      return '#dfccad'; // soft warm sand beach
    } else if (h <= 120) {
      const t = (h - 44) / 76;
      const r = Math.round(223 - t * (223 - 90));
      const g = Math.round(204 - t * (204 - 138));
      const b = Math.round(173 - t * (173 - 96));
      return `rgb(${r},${g},${b})`; // smooth gradient sand to green land
    } else if (h <= 250) {
      const t = (h - 120) / 130;
      const r = Math.round(90 + t * (139 - 90));
      const g = Math.round(138 - t * (138 - 128));
      const b = Math.round(96 + t * (101 - 96));
      return `rgb(${r},${g},${b})`; // green land to highlands olive
    } else if (h <= 500) {
      const t = (h - 250) / 250;
      const r = Math.round(139 - t * (139 - 92));
      const g = Math.round(128 - t * (128 - 85));
      const b = Math.round(101 - t * (101 - 74));
      return `rgb(${r},${g},${b})`; // olive to rocky gray-brown
    } else {
      const t = Math.min(1.0, (h - 500) / 300);
      const r = Math.round(92 + t * (240 - 92));
      const g = Math.round(85 + t * (243 - 85));
      const b = Math.round(74 + t * (245 - 74));
      return `rgb(${r},${g},${b})`; // rocky to snow peak white
    }
  }

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
      if (typeof resetSteering === 'function') {
        resetSteering();
      } else if (
        typeof inputManager !== 'undefined' &&
        inputManager.resetMouseSteering
      ) {
        inputManager.resetMouseSteering();
      }
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

    console.log('🗺️ Minimap successfully loaded and initialized.');

    // Start game loop updater
    updateLoop();

    // Check if minimap should start enabled from URL parameter
    if (
      typeof ChillFlightLogic !== 'undefined' &&
      ChillFlightLogic.START_MINIMAP
    ) {
      toggleMinimap(true);
    }
  }

  function forceRedraw() {
    lastUpdateX = Infinity;
    lastUpdateZ = Infinity;
  }

  function drawBackgroundHeightmap(px, pz) {
    // Re-read constants if they exist in environment
    if (typeof WATER_LEVEL !== 'undefined') constants.WATER_LEVEL = WATER_LEVEL;
    if (typeof MAP_WORLD_SIZE !== 'undefined')
      constants.MAP_WORLD_SIZE = MAP_WORLD_SIZE;
    if (typeof MAP_HEIGHT_SCALE !== 'undefined')
      constants.MAP_HEIGHT_SCALE = MAP_HEIGHT_SCALE;

    const imgData = bgCtx.createImageData(gridSize, gridSize);
    const data = imgData.data;

    const simplexInstance = typeof simplex !== 'undefined' ? simplex : null;
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

        // Convert height to color string
        const colorStr = getColorForHeight(h);

        // Parse color string (either rgb or hex)
        let r = 0,
          g = 0,
          b = 0;
        if (colorStr.startsWith('rgb')) {
          const parts = colorStr.match(/\d+/g);
          if (parts) {
            r = parseInt(parts[0]);
            g = parseInt(parts[1]);
            b = parseInt(parts[2]);
          }
        } else if (colorStr.startsWith('#')) {
          r = parseInt(colorStr.substring(1, 3), 16);
          g = parseInt(colorStr.substring(3, 5), 16);
          b = parseInt(colorStr.substring(5, 7), 16);
        }

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

    if (typeof updateUrlParams === 'function') {
      if (minimapVisible) {
        updateUrlParams({minimap: 'true'}, ['miniMap', 'mapOverlay']);
      } else {
        updateUrlParams({}, ['minimap', 'miniMap', 'mapOverlay']);
      }
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
        generateFsBgCanvas();
        renderFullscreenMap();
        return;
      }
      if (e.key === '-' || e.key === '_') {
        fsViewRadius = Math.min(FS_MAX_RADIUS, fsViewRadius * 1.25);
        updateCoordsDisplay();
        generateFsBgCanvas();
        renderFullscreenMap();
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
    if (typeof planeGroup === 'undefined' || !planeGroup) return;

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

  let fsBgCanvas = null;
  let fsBgCtx = null;

  let fsVisible = false;
  let fsViewCenterX = 0;
  let fsViewCenterZ = 0;
  let fsViewRadius = 7500;
  const FS_MIN_RADIUS = 1000;
  const FS_MAX_RADIUS = 35000;

  let fsCachedMinX = 0;
  let fsCachedMinZ = 0;
  let fsCachedWorldW = 0;
  let fsCachedWorldH = 0;

  let fsAnimFrameId = null;
  let fsRedrawTimer = null;

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

  let fsElevBuffer = null;
  let lastBgGenTime = 0;

  function generateFsBgCanvas() {
    if (!fsCanvas) return;
    if (typeof WATER_LEVEL !== 'undefined') constants.WATER_LEVEL = WATER_LEVEL;
    if (typeof MAP_WORLD_SIZE !== 'undefined')
      constants.MAP_WORLD_SIZE = MAP_WORLD_SIZE;
    if (typeof MAP_HEIGHT_SCALE !== 'undefined')
      constants.MAP_HEIGHT_SCALE = MAP_HEIGHT_SCALE;

    const simplexInstance = typeof simplex !== 'undefined' ? simplex : null;
    if (!simplexInstance) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    // Adaptive high-resolution grid based on zoom level (denser buffer at close zoom for ultra-crisp detail)
    const isCloseZoom = fsViewRadius < 3500;
    const paddingMult = isCloseZoom ? 1.2 : 1.4;

    let gridH = isCloseZoom ? 380 : 300;
    let gridW = Math.round(gridH * aspect);
    if (aspect < 1) {
      gridW = isCloseZoom ? 320 : 260;
      gridH = Math.round(gridW / aspect);
    }
    gridW = Math.min(760, Math.max(200, gridW));
    gridH = Math.min(500, Math.max(200, gridH));

    if (!fsBgCanvas) {
      fsBgCanvas = document.createElement('canvas');
      fsBgCtx = fsBgCanvas.getContext('2d');
    }
    if (fsBgCanvas.width !== gridW || fsBgCanvas.height !== gridH) {
      fsBgCanvas.width = gridW;
      fsBgCanvas.height = gridH;
    }

    const minDim = Math.min(w, h);
    const worldUnitsPerPixel = (fsViewRadius * 2) / minDim;
    const worldW = w * worldUnitsPerPixel * paddingMult;
    const worldH = h * worldUnitsPerPixel * paddingMult;

    const minX = fsViewCenterX - worldW / 2;
    const minZ = fsViewCenterZ - worldH / 2;

    const totalPoints = gridW * gridH;
    if (!fsElevBuffer || fsElevBuffer.length !== totalPoints) {
      fsElevBuffer = new Float32Array(totalPoints);
    }

    for (let gz = 0; gz < gridH; gz++) {
      const wz = minZ + (gz / (gridH - 1)) * worldH;
      const rowOffset = gz * gridW;
      for (let gx = 0; gx < gridW; gx++) {
        const wx = minX + (gx / (gridW - 1)) * worldW;
        try {
          fsElevBuffer[rowOffset + gx] = ChillFlightLogic.getElevation(
            wx,
            wz,
            simplexInstance,
            constants
          );
        } catch {
          fsElevBuffer[rowOffset + gx] = 40;
        }
      }
    }

    const imgData = fsBgCtx.createImageData(gridW, gridH);
    const data = imgData.data;

    for (let gz = 0; gz < gridH; gz++) {
      const rowOffset = gz * gridW;
      const prevRow = (gz - 1) * gridW;
      const nextRow = (gz + 1) * gridW;

      for (let gx = 0; gx < gridW; gx++) {
        const idx = rowOffset + gx;
        const elev = fsElevBuffer[idx];

        // Northwest directional hillshade for land above water (gives mountains and hills crisp 3D definition)
        let shade = 0;
        if (elev > 40 && gx > 0 && gx < gridW - 1 && gz > 0 && gz < gridH - 1) {
          const dz = fsElevBuffer[nextRow + gx] - fsElevBuffer[prevRow + gx];
          const dx = fsElevBuffer[idx + 1] - fsElevBuffer[idx - 1];
          shade = (-dx - dz) * 0.45;
          if (shade < -32) shade = -32;
          else if (shade > 32) shade = 32;
        }

        // Color computation
        let r, g, b;
        if (elev <= 40) {
          // Bathymetry depth variation for crisp, clean coastlines
          const depth = Math.min(1.0, (40 - elev) / 12);
          r = Math.round(34 - depth * 12);
          g = Math.round(66 - depth * 22);
          b = Math.round(120 - depth * 32);
        } else if (elev <= 44) {
          r = 223;
          g = 204;
          b = 173; // Sand beach
        } else if (elev <= 120) {
          const t = (elev - 44) / 76;
          r = Math.round(223 - t * 133);
          g = Math.round(204 - t * 66);
          b = Math.round(173 - t * 77);
        } else if (elev <= 250) {
          const t = (elev - 120) / 130;
          r = Math.round(90 + t * 49);
          g = Math.round(138 - t * 10);
          b = Math.round(96 + t * 5);
        } else if (elev <= 500) {
          const t = (elev - 250) / 250;
          r = Math.round(139 - t * 47);
          g = Math.round(128 - t * 43);
          b = Math.round(101 - t * 27);
        } else {
          const t = Math.min(1.0, (elev - 500) / 300);
          r = Math.round(92 + t * 148);
          g = Math.round(85 + t * 158);
          b = Math.round(74 + t * 171);
        }

        if (shade !== 0) {
          r += shade;
          g += shade;
          b += shade;
          if (r < 0) r = 0;
          else if (r > 255) r = 255;
          if (g < 0) g = 0;
          else if (g > 255) g = 255;
          if (b < 0) b = 0;
          else if (b > 255) b = 255;
        }

        const pIdx = idx * 4;
        data[pIdx] = r;
        data[pIdx + 1] = g;
        data[pIdx + 2] = b;
        data[pIdx + 3] = 255;
      }
    }

    fsBgCtx.putImageData(imgData, 0, 0);

    fsCachedMinX = minX;
    fsCachedMinZ = minZ;
    fsCachedWorldW = worldW;
    fsCachedWorldH = worldH;
    lastBgGenTime = Date.now();
  }

  function scheduleFsBgRedraw(delay = 80) {
    if (fsRedrawTimer) clearTimeout(fsRedrawTimer);
    fsRedrawTimer = setTimeout(() => {
      if (fsVisible) {
        generateFsBgCanvas();
        renderFullscreenMap();
      }
    }, delay);
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

    // 1. Draw cached heightmap background transformed to current view
    if (fsBgCanvas && fsCachedWorldW > 0) {
      const srcScreenX = (fsCachedMinX - vMinX) / worldUnitsPerPixel;
      const srcScreenY = (fsCachedMinZ - vMinZ) / worldUnitsPerPixel;
      const srcScreenW = fsCachedWorldW / worldUnitsPerPixel;
      const srcScreenH = fsCachedWorldH / worldUnitsPerPixel;

      fsCtx.imageSmoothingEnabled = true;
      fsCtx.imageSmoothingQuality = 'high';
      fsCtx.drawImage(
        fsBgCanvas,
        srcScreenX,
        srcScreenY,
        srcScreenW,
        srcScreenH
      );
    }

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

    // 4. Player Plane Indicator
    if (typeof planeGroup !== 'undefined' && planeGroup) {
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

  let fsHasCenteredOnPlane = false;

  function fsAnimationLoop() {
    if (!fsVisible) return;
    if (
      !fsHasCenteredOnPlane &&
      typeof planeGroup !== 'undefined' &&
      planeGroup
    ) {
      fsViewCenterX = planeGroup.position.x;
      fsViewCenterZ = planeGroup.position.z;
      fsHasCenteredOnPlane = true;
      updateCoordsDisplay();
      generateFsBgCanvas();
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
    if (typeof planeGroup !== 'undefined' && planeGroup) {
      fsViewCenterX = planeGroup.position.x;
      fsViewCenterZ = planeGroup.position.z;
      fsHasCenteredOnPlane = true;
    } else {
      fsHasCenteredOnPlane = false;
    }
    updateCoordsDisplay();
    resizeFsCanvas();
    generateFsBgCanvas();
    renderFullscreenMap();
    if (fsAnimFrameId) cancelAnimationFrame(fsAnimFrameId);
    fsAnimFrameId = requestAnimationFrame(fsAnimationLoop);

    if (typeof updateUrlParams === 'function') {
      updateUrlParams({fullscreenmap: 'true'}, [
        'fullscreenMap',
        'worldmap',
        'worldMap',
        'fullscreen-map',
        'world-map',
      ]);
    }

    if (typeof Achievements !== 'undefined') {
      Achievements.unlock('cartographer');
    }
  }

  function closeFullscreenMap() {
    if (!fsVisible) return;
    if (typeof window.suppressPauseClick === 'function') {
      window.suppressPauseClick(500);
    }
    fsVisible = false;
    if (fsOverlay) {
      fsOverlay.style.display = 'none';
    }
    if (fsAnimFrameId) {
      cancelAnimationFrame(fsAnimFrameId);
      fsAnimFrameId = null;
    }
    activePointers.clear();
    isDragging = false;
    prevPinchDist = null;

    if (typeof updateUrlParams === 'function') {
      updateUrlParams({}, [
        'fullscreenmap',
        'fullscreenMap',
        'worldmap',
        'worldMap',
        'fullscreen-map',
        'world-map',
      ]);
    }
  }

  let fsInitialized = false;
  function initFullscreenMap() {
    if (fsInitialized) return;
    fsOverlay = document.getElementById('fullscreen-map-overlay');
    fsCanvas = document.getElementById('fullscreen-map-canvas');
    fsCoordsEl = document.getElementById('fullscreen-map-coords');
    if (!fsOverlay || !fsCanvas) return;

    fsCtx = fsCanvas.getContext('2d');
    fsBgCanvas = document.createElement('canvas');
    fsBgCtx = fsBgCanvas.getContext('2d');

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

    const recenterBtn = document.getElementById('fullscreen-map-recenter-btn');
    attachButtonAction(recenterBtn, () => {
      if (typeof planeGroup !== 'undefined' && planeGroup) {
        fsViewCenterX = planeGroup.position.x;
        fsViewCenterZ = planeGroup.position.z;
        updateCoordsDisplay();
        generateFsBgCanvas();
        renderFullscreenMap();
      }
    });

    const zoomInBtn = document.getElementById('fullscreen-map-zoom-in');
    attachButtonAction(zoomInBtn, () => {
      fsViewRadius = Math.max(FS_MIN_RADIUS, fsViewRadius / 1.3);
      updateCoordsDisplay();
      generateFsBgCanvas();
      renderFullscreenMap();
    });

    const zoomOutBtn = document.getElementById('fullscreen-map-zoom-out');
    attachButtonAction(zoomOutBtn, () => {
      fsViewRadius = Math.min(FS_MAX_RADIUS, fsViewRadius * 1.3);
      updateCoordsDisplay();
      generateFsBgCanvas();
      renderFullscreenMap();
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
      const visibleWorldW = screenW * worldUnitsPerPixel;
      const visibleWorldH = screenH * worldUnitsPerPixel;

      if (activePointers.size === 1 && isDragging) {
        const dx = e.clientX - prevPanX;
        const dy = e.clientY - prevPanY;
        prevPanX = e.clientX;
        prevPanY = e.clientY;

        fsViewCenterX -= dx * worldUnitsPerPixel;
        fsViewCenterZ -= dy * worldUnitsPerPixel;

        updateCoordsDisplay();

        const cacheCenterWorldX = fsCachedMinX + fsCachedWorldW / 2;
        const cacheCenterWorldZ = fsCachedMinZ + fsCachedWorldH / 2;
        if (
          Math.abs(fsViewCenterX - cacheCenterWorldX) > visibleWorldW * 0.25 ||
          Math.abs(fsViewCenterZ - cacheCenterWorldZ) > visibleWorldH * 0.25
        ) {
          if (Date.now() - lastBgGenTime > 250) {
            generateFsBgCanvas();
          }
        }

        scheduleFsBgRedraw(80);
        renderFullscreenMap();
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
        scheduleFsBgRedraw(80);
        renderFullscreenMap();
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
        generateFsBgCanvas();
        renderFullscreenMap();
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
        scheduleFsBgRedraw(80);
        renderFullscreenMap();
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
      generateFsBgCanvas();
      renderFullscreenMap();
    });

    window.addEventListener('resize', () => {
      if (fsVisible) {
        resizeFsCanvas();
        generateFsBgCanvas();
        renderFullscreenMap();
      }
    });

    fsInitialized = true;
  }

  // Global APIs
  window.FullscreenMap = {
    open: openFullscreenMap,
    close: closeFullscreenMap,
    toggle: function () {
      if (fsVisible) closeFullscreenMap();
      else openFullscreenMap();
    },
    isOpen: function () {
      return fsVisible;
    },
  };

  window.Minimap = {
    toggle: toggleMinimap,
    isVisible: function () {
      return minimapVisible;
    },
  };

  // Wait for the DOM and standard game scripts to be loaded before initializing
  function startInit() {
    initMinimap();
    initFullscreenMap();
    if (
      typeof ChillFlightLogic !== 'undefined' &&
      ChillFlightLogic.START_FULLSCREEN_MAP
    ) {
      openFullscreenMap();
    }
  }

  if (document.readyState === 'complete') {
    startInit();
  } else {
    window.addEventListener('load', startInit);
  }
})();
