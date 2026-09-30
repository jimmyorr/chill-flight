// map-loader.js
import {MAP_HEIGHT_SCALE, MAP_WORLD_SIZE, WATER_LEVEL} from './constants.js';
import {log} from './logger.js';
import {chunks, clearElevationCache} from './terrain-geometry.js';
import {updateChunks} from './terrain-chunks.js';
import {scene} from './scene.js';
import {planeGroup} from './airplane.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';
import {state} from './state.js';

(function () {
  function processImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // Extract Luminance with alpha pre-multiplication (so transparent regions are correctly 0)
    const floatData = new Float32Array(canvas.width * canvas.height);
    for (let i = 0; i < floatData.length; i++) {
      const idx = i * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3] / 255.0;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) * a;
      floatData[i] = luminance; // 0-255 range
    }

    // Update the logic engine
    const maxDim = Math.max(canvas.width, canvas.height);
    const worldScale = MAP_WORLD_SIZE / maxDim;

    ChillFlightLogic.customMap = {
      data: floatData,
      width: canvas.width,
      height: canvas.height,
      worldWidth: canvas.width * worldScale,
      worldHeight: canvas.height * worldScale,
    };

    log.info(`Custom heightmap loaded: ${canvas.width}x${canvas.height}`);
    log.info(
      `World size: ${ChillFlightLogic.customMap.worldWidth.toFixed(0)}x${ChillFlightLogic.customMap.worldHeight.toFixed(0)} units (MAP_WORLD_SIZE: ${MAP_WORLD_SIZE})`
    );

    // Clear elevation cache so memoized heights do not persist from procedural terrain
    if (clearElevationCache) {
      clearElevationCache();
    }

    // Force terrain rebuild

    // Dispose all previous procedural chunks manually
    chunks.forEach((group, key) => {
      group.traverse((child) => {
        if (child.isMesh || child.isInstancedMesh) {
          if (child.geometry && child.geometry.userData.unique) {
            child.geometry.dispose();
          }
          // Water depth texture (see attachWaterDepthTexture in terrain-chunks.js)
          if (child.userData.depthTex) {
            child.userData.depthTex.dispose();
            child.material.dispose();
          }
        }
      });

      scene.remove(group);
    });
    chunks.clear();

    // Reset plane position and state

    let startX = 0;
    let startZ = 0;
    let startY = 445.5;

    const urlLatVal = ChillFlightLogic.parsedLat;
    const urlLonVal = ChillFlightLogic.parsedLon;
    const urlAltVal = ChillFlightLogic.parsedAlt;

    if (urlLatVal !== null && urlLatVal !== undefined) {
      startZ = -urlLatVal * 5000;
    }
    if (urlLonVal !== null && urlLonVal !== undefined) {
      startX = urlLonVal * 5000;
    }

    if (urlAltVal !== null && urlAltVal !== undefined) {
      startY = urlAltVal / 25 + 45.5;
    } else if (urlLatVal !== null || urlLonVal !== null) {
      try {
        const terrainHeight = ChillFlightLogic.getElevation(
          startX,
          startZ,
          simplex,
          {
            WATER_LEVEL,
            MAP_WORLD_SIZE,
            MAP_HEIGHT_SCALE,
          }
        );
        startY = terrainHeight + 400.0;
      } catch {
        startY = 445.5;
      }
    }

    planeGroup.position.set(startX, startY, startZ);
    planeGroup.rotation.set(0, 0, 0);

    try {
      if (typeof state.targetFlightSpeed !== 'undefined') {
        state.targetFlightSpeed = 1.0; // Cruise speed
        state.flightSpeedMultiplier = 1.0;
      }
    } catch {
      /* ignore */
    }

    updateChunks();
  }

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];

      // Only accept images
      if (!file.type.match('image.*')) {
        console.warn('Dropped file is not an image.');
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          processImage(img);
        };
        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    }
  });

  // Check for map parameter in URL
  const mapName = ChillFlightLogic.MAP_NAME;
  if (mapName) {
    log.info(`Loading map from URL param: ${mapName}`);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      processImage(img);
    };
    const mapSrc =
      mapName.startsWith('http://') || mapName.startsWith('https://')
        ? mapName
        : `https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/maps/${mapName}.png`;
    img.onerror = () => {
      console.error(`Failed to load map: ${mapSrc}`);
    };
    img.src = mapSrc;
  }
})();
