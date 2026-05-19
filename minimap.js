/* global WATER_LEVEL, MAP_WORLD_SIZE, MAP_HEIGHT_SCALE, simplex, ChillFlightLogic, planeGroup, otherPlayers */
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

    // Create UI elements
    minimapContainer = document.createElement('div');
    minimapContainer.id = 'minimap-container';
    minimapContainer.className = 'desktop-only';
    minimapContainer.style.display = 'none'; // Hidden by default!

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

    controls.appendChild(zoomInBtn);
    controls.appendChild(zoomOutBtn);
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
  }

  // Toggle minimap with the M shortcut key
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
    ) {
      return;
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

    // Draw other multiplayer players
    if (typeof otherPlayers !== 'undefined' && otherPlayers) {
      otherPlayers.forEach((player) => {
        if (!player.mesh) return;
        const ox = player.mesh.position.x;
        const oz = player.mesh.position.z;
        const dx = ox - px;
        const dz = oz - pz;

        if (Math.abs(dx) <= viewRadius && Math.abs(dz) <= viewRadius) {
          const cx = 90 + (dx / viewRadius) * 90;
          const cy = 90 + (dz / viewRadius) * 90;

          ctx.save();
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 3;

          // Draw other player dot
          ctx.fillStyle = '#00f2fe'; // bright multiplayer teal
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.75;
          ctx.stroke();

          // Draw their name (Sentence case for UI labels)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 8px "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(player.name || 'Player', cx, cy - 6);
          ctx.restore();
        }
      });
    }

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

  // Wait for the DOM and standard game scripts to be loaded before initializing
  if (document.readyState === 'complete') {
    initMinimap();
  } else {
    window.addEventListener('load', initMinimap);
  }
})();
