var manualCloudCover =
  typeof ChillFlightLogic !== 'undefined' &&
  ChillFlightLogic.START_CLOUD_COVER !== null &&
  ChillFlightLogic.START_CLOUD_COVER !== undefined
    ? ChillFlightLogic.START_CLOUD_COVER
    : null;
var manualCloudHeight =
  typeof ChillFlightLogic !== 'undefined' &&
  typeof ChillFlightLogic.START_CLOUD_HEIGHT === 'number'
    ? ChillFlightLogic.START_CLOUD_HEIGHT
    : 3000.0;
var manualCloudSpeed =
  typeof ChillFlightLogic !== 'undefined' &&
  typeof ChillFlightLogic.START_CLOUD_SPEED === 'number'
    ? ChillFlightLogic.START_CLOUD_SPEED
    : 1.0;
var showCloudsEnabled =
  typeof ChillFlightLogic !== 'undefined' ? ChillFlightLogic.SHOW_CLOUDS : true;
// --- WEATHER SYSTEM ---
var weatherType =
  typeof ChillFlightLogic !== 'undefined' && ChillFlightLogic.START_WEATHER
    ? ChillFlightLogic.START_WEATHER
    : 'auto'; // 'auto', 'none', 'snow', 'rain'
var snowParticles = null;
var rainParticles = null;

// Scale particles based on quality
var _savedQualityForWeather = localStorage.getItem('chill_flight_quality');
var _isLowPresetForWeather =
  (typeof initialPreset !== 'undefined' && initialPreset === 'low') ||
  (_savedQualityForWeather && parseInt(_savedQualityForWeather) <= 20);
var WEATHER_PARTICLE_COUNT = _isLowPresetForWeather ? 1500 : 5000;
var WEATHER_RANGE = 500;

// Optimization: Weather particle GPU simulation uniforms.
// Rather than updating 5,000 particle positions (15,000 floats) on the CPU and streaming
// them across the PCIe bus every frame via needsUpdate=true, particle velocities and bounds
// wrapping are computed entirely on the GPU via custom onBeforeCompile vertex shaders.
var weatherUniforms = {
  snowTime: {value: 0},
  rainTime: {value: 0},
  cameraPos: {value: new THREE.Vector3()},
  range: {value: WEATHER_RANGE},
};

// Generate a soft, glowing circle for snow
function createSnowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// Generate a motion-blurred streak for rain
function createRainTexture() {
  const canvas = document.createElement('canvas');
  // The canvas MUST be square for PointsMaterial to prevent stretching
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Vertical gradient to simulate motion blur
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)'); // Brighter core
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = grad;
  // Draw a thin streak directly down the middle (X=31, Y=0, Width=2, Height=64)
  ctx.fillRect(31, 0, 2, 64);

  return new THREE.CanvasTexture(canvas);
}

function initWeather() {
  // Geometries
  const snowGeo = new THREE.BufferGeometry();
  const rainGeo = new THREE.BufferGeometry();

  const snowPos = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const snowVel = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const rainPos = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
  const rainVel = new Float32Array(WEATHER_PARTICLE_COUNT * 3);

  for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
    // Shared random spawn positions
    const startX = (Math.random() - 0.5) * WEATHER_RANGE;
    const startY = (Math.random() - 0.5) * WEATHER_RANGE;
    const startZ = (Math.random() - 0.5) * WEATHER_RANGE;

    snowPos[i * 3] = startX;
    snowPos[i * 3 + 1] = startY;
    snowPos[i * 3 + 2] = startZ;
    rainPos[i * 3] = startX;
    rainPos[i * 3 + 1] = startY;
    rainPos[i * 3 + 2] = startZ;

    // Snow velocity: gentle drift and slow fall
    snowVel[i * 3] = (Math.random() - 0.5) * 15;
    snowVel[i * 3 + 1] = -(Math.random() * 25 + 30);
    snowVel[i * 3 + 2] = (Math.random() - 0.5) * 15;

    // Rain velocity: fast fall, minimal horizontal drift
    rainVel[i * 3] = (Math.random() - 0.5) * 5;
    rainVel[i * 3 + 1] = -(Math.random() * 200 + 250);
    rainVel[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }

  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  snowGeo.setAttribute('velocity', new THREE.BufferAttribute(snowVel, 3));

  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainGeo.setAttribute('velocity', new THREE.BufferAttribute(rainVel, 3));

  // Materials
  const snowMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2.0,
    map: createSnowTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const rainMat = new THREE.PointsMaterial({
    color: 0xaaccff,
    size: 15.0, // Increased size to compensate for the larger square canvas
    map: createRainTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Optimization: Weather particle GPU simulation and vertex shader injection.
  // Why: Evaluating particle trajectories and toroidal box wrapping on the GPU avoids updating
  // 5,000 particle positions on the CPU every frame, eliminating 60KB/frame (~35MB/min) of PCIe
  // buffer transfers and main-thread bounds calculation loops.
  const injectWeatherShader = (shader, timeUniform) => {
    shader.uniforms.uWeatherTime = timeUniform;
    shader.uniforms.uCameraPos = weatherUniforms.cameraPos;
    shader.uniforms.uRange = weatherUniforms.range;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uWeatherTime;
       uniform vec3 uCameraPos;
       uniform float uRange;
       attribute vec3 velocity;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
       // Particles move along their static velocity attribute scaled by accumulated elapsed time.
       // We compute displacement relative to the camera position and wrap modulo uRange so particles
       // remain centered in a bounding volume around the airplane.
       vec3 animatedPos = position + velocity * uWeatherTime;
       vec3 relPos = animatedPos - uCameraPos;
       vec3 halfRange = vec3(uRange * 0.5);
       vec3 transformed = mod(relPos + halfRange, uRange) - halfRange;
      `
    );
  };

  snowMat.onBeforeCompile = (shader) =>
    injectWeatherShader(shader, weatherUniforms.snowTime);
  rainMat.onBeforeCompile = (shader) =>
    injectWeatherShader(shader, weatherUniforms.rainTime);

  // Meshes
  snowParticles = new THREE.Points(snowGeo, snowMat);
  snowParticles.visible = false;
  snowParticles.frustumCulled = false;
  scene.add(snowParticles);

  rainParticles = new THREE.Points(rainGeo, rainMat);
  rainParticles.visible = false;
  rainParticles.frustumCulled = false;
  scene.add(rainParticles);

  // Bind UI
  const weatherSelect = document.getElementById('weather-select');
  if (weatherSelect) {
    weatherSelect.value = weatherType;
    weatherSelect.addEventListener('change', (e) => {
      weatherType = e.target.value;
      if (weatherType !== 'auto') {
        updateUrlParams({weather: weatherType});
      } else {
        updateUrlParams({}, ['weather']);
      }
      console.log(`Weather changed to: ${weatherType}`);
    });
  }

  // Bind Clouds UI
  const debugCloudsToggle = document.getElementById('debug-clouds-toggle');
  if (debugCloudsToggle) {
    debugCloudsToggle.checked = showCloudsEnabled;
    debugCloudsToggle.addEventListener('change', (e) => {
      showCloudsEnabled = e.target.checked;
      if (window.skyUniforms) {
        window.skyUniforms.uShowClouds.value =
          showCloudsEnabled &&
          (typeof SEGMENTS === 'undefined' || SEGMENTS > 20);
      }
    });
  }

  const debugCloudCoverSlider = document.getElementById(
    'debug-cloud-cover-slider'
  );
  const debugCloudAutoToggle = document.getElementById(
    'debug-cloud-auto-toggle'
  );
  const debugCloudCoverVal = document.getElementById('debug-cloud-cover-val');

  if (debugCloudCoverSlider) {
    if (manualCloudCover !== null) {
      debugCloudCoverSlider.value = manualCloudCover;
      if (debugCloudAutoToggle) debugCloudAutoToggle.checked = false;
      if (debugCloudCoverVal)
        debugCloudCoverVal.textContent = manualCloudCover.toFixed(2);
    } else {
      if (debugCloudAutoToggle) debugCloudAutoToggle.checked = true;
      if (debugCloudCoverVal) debugCloudCoverVal.textContent = 'Auto';
    }

    debugCloudCoverSlider.addEventListener('input', (e) => {
      manualCloudCover = parseFloat(e.target.value);
      if (debugCloudAutoToggle) debugCloudAutoToggle.checked = false;
      if (debugCloudCoverVal)
        debugCloudCoverVal.textContent = manualCloudCover.toFixed(2);
    });
  }

  if (debugCloudAutoToggle) {
    debugCloudAutoToggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        manualCloudCover = null;
        if (debugCloudCoverVal) debugCloudCoverVal.textContent = 'Auto';
      } else {
        manualCloudCover = parseFloat(
          debugCloudCoverSlider ? debugCloudCoverSlider.value : 0.5
        );
        if (debugCloudCoverVal)
          debugCloudCoverVal.textContent = manualCloudCover.toFixed(2);
      }
    });
  }

  const debugCloudHeightSlider = document.getElementById(
    'debug-cloud-height-slider'
  );
  const debugCloudHeightVal = document.getElementById('debug-cloud-height-val');
  if (debugCloudHeightSlider) {
    debugCloudHeightSlider.value = manualCloudHeight;
    if (debugCloudHeightVal)
      debugCloudHeightVal.textContent = `${Math.round(manualCloudHeight)}m`;
    debugCloudHeightSlider.addEventListener('input', (e) => {
      manualCloudHeight = parseFloat(e.target.value);
      if (debugCloudHeightVal)
        debugCloudHeightVal.textContent = `${Math.round(manualCloudHeight)}m`;
      if (window.skyUniforms && window.skyUniforms.uCloudHeight) {
        window.skyUniforms.uCloudHeight.value = manualCloudHeight;
      }
    });
  }

  const debugCloudSpeedSlider = document.getElementById(
    'debug-cloud-speed-slider'
  );
  const debugCloudSpeedVal = document.getElementById('debug-cloud-speed-val');
  if (debugCloudSpeedSlider) {
    debugCloudSpeedSlider.value = manualCloudSpeed;
    if (debugCloudSpeedVal)
      debugCloudSpeedVal.textContent = `${manualCloudSpeed.toFixed(1)}x`;
    debugCloudSpeedSlider.addEventListener('input', (e) => {
      manualCloudSpeed = parseFloat(e.target.value);
      if (debugCloudSpeedVal)
        debugCloudSpeedVal.textContent = `${manualCloudSpeed.toFixed(1)}x`;
    });
  }
}

function cycleWeather() {
  const modes = ['auto', 'none', 'rain', 'snow'];
  const nextIndex = (modes.indexOf(weatherType) + 1) % modes.length;
  weatherType = modes[nextIndex];
  const weatherSelect = document.getElementById('weather-select');
  if (weatherSelect) {
    weatherSelect.value = weatherType;
  }
  if (weatherType !== 'auto') {
    updateUrlParams({weather: weatherType});
  } else {
    updateUrlParams({}, ['weather']);
  }
  console.log(`Weather cycled to: ${weatherType}`);
}
window.cycleWeather = cycleWeather;

function updateWeather(delta) {
  if (!snowParticles || !rainParticles) return;

  // Optimization: Skip entire weather simulation and hide particles on Low graphics
  if (SEGMENTS <= 20) {
    snowParticles.visible = false;
    rainParticles.visible = false;
    snowParticles.material.opacity = 0;
    rainParticles.material.opacity = 0;
    return;
  }

  let targetSnowOpacity = 0;
  let targetRainOpacity = 0;

  // Determine target opacities based on active mode
  if (weatherType === 'snow') {
    targetSnowOpacity = 0.8;
  } else if (weatherType === 'rain') {
    targetRainOpacity = 0.5;
  } else if (weatherType === 'auto') {
    const latVal = -planeGroup.position.z / 5000;

    // Continuous snow above 0.9°N, but with occasional breaks (80% duty cycle)
    if (latVal > 0.9) {
      const timeOffset = (window._gameServerNow || performance.now()) / 100000;
      // Use a slow-moving noise wave based on time for global breaks
      const snowBreakNoise = (simplex.noise2D(timeOffset * 0.2, 999) + 1) / 2; // Value between 0 and 1

      if (snowBreakNoise > 0.2) {
        const permanentSnow = THREE.MathUtils.clamp((latVal - 1.0) / 1.0, 0, 1);
        targetSnowOpacity = Math.max(targetSnowOpacity, permanentSnow * 0.15);
      }
    }

    // 1. Sync with the global overcast/cloud noise map
    const timeOffset = (window._gameServerNow || performance.now()) / 100000;
    const chunkSize = typeof CHUNK_SIZE !== 'undefined' ? CHUNK_SIZE : 2000;

    // This math perfectly matches the cloud generation in your animate() loop
    let stormNoise =
      (simplex.noise2D(
        (planeGroup.position.x / chunkSize) * 0.1 + 500 + timeOffset,
        (planeGroup.position.z / chunkSize) * 0.1 + timeOffset
      ) +
        1) /
      2;

    // Only trigger precipitation where the clouds are very thick (> 0.82)
    if (stormNoise > 0.82) {
      // Normalize storm intensity from 0.0 (just started) to 1.0 (heavy storm)
      const stormIntensity = (stormNoise - 0.82) / 0.18;

      // 2. Distribute the storm intensity based on latitude
      if (latVal > 2.0) {
        // North: Storm intensifies the already-falling snow
        targetSnowOpacity = Math.max(targetSnowOpacity, stormIntensity * 0.4);
      } else if (latVal > 1.0) {
        // Transition Zone (1.0 to 2.0): Sleet (Mix of Rain and Snow)
        const snowRatio = (latVal - 1.0) / 1.0; // 0.0 at 1.0, 1.0 at 2.0
        targetSnowOpacity = Math.max(
          targetSnowOpacity,
          stormIntensity * 0.4 * snowRatio
        );
        targetRainOpacity = stormIntensity * 0.5 * (1.0 - snowRatio);
      } else if (latVal > -2.0) {
        // Temperate/Equator: Full Rain
        targetRainOpacity = stormIntensity * 0.5;
      } else if (latVal > -3.0) {
        // Desert Border (-2.0 to -3.0): Rain dries up quickly
        const fadeOut = 1.0 - (Math.abs(latVal) - 2.0) / 1.0;
        targetRainOpacity = stormIntensity * 0.5 * Math.max(0, fadeOut);
      }
      // If latVal <= -3.0 (Deep Desert), targets remain 0 (Dry Storm)
    }

    // Expose debug data
    window._weatherDebug = {
      stormNoise: stormNoise,
      latVal: latVal,
      zone:
        latVal > 2.0
          ? 'Snow'
          : latVal > 1.0
            ? 'Sleet'
            : latVal > -2.0
              ? 'Rain'
              : latVal > -3.0
                ? 'Dry Edge'
                : 'Desert',
    };
  }

  // Initialize lightning light if it doesn't exist
  if (!window.lightningLight && typeof scene !== 'undefined') {
    window.lightningLight = new THREE.DirectionalLight(0xe0e0ff, 0);
    scene.add(window.lightningLight);
    window.lightningFlashIntensity = 0;
  }

  // Lightning logic
  if (window.lightningFlashIntensity > 0) {
    // Rapidly decay the flash
    window.lightningFlashIntensity = Math.max(
      0,
      window.lightningFlashIntensity - delta * 4.0
    );
    if (window.lightningLight) {
      // Randomly turn it off to create a flickering strobe effect
      window.lightningLight.intensity =
        Math.random() < 0.3 ? 0 : window.lightningFlashIntensity;
    }
  } else if (
    targetRainOpacity > 0.2 &&
    Math.random() < targetRainOpacity * 0.0025
  ) {
    // Only allow lightning between 6pm and 6am
    const hours = (timeOfDay / (Math.PI * 2)) * 24;
    if (hours >= 18 || hours <= 6) {
      // Trigger a new lightning strike during heavy rain
      window.lightningFlashIntensity = 1.5 + Math.random() * 1.0;
      if (window.lightningLight) {
        // Set a random overhead angle for the strike
        window.lightningLight.position
          .set((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2)
          .normalize();
        window.lightningLight.color.setHSL(0.6, 0.2, 0.8 + Math.random() * 0.2); // Cool white/blue
      }
    }
  }

  // Store unfaded opacities to drive cloud density even when above clouds
  window._unfadedSnowOpacity = targetSnowOpacity;
  window._unfadedRainOpacity = targetRainOpacity;

  // Fade out precipitation when flying above the cloud layer
  const cloudCeiling =
    typeof manualCloudHeight === 'number' ? manualCloudHeight : 3000.0;
  const fadeStart = cloudCeiling - 100.0; // Start fading 100 units below the clouds
  if (camera.position.y > fadeStart) {
    const fadeFactor = Math.max(
      0,
      1.0 - (camera.position.y - fadeStart) / 100.0
    );
    targetRainOpacity *= fadeFactor;
    targetSnowOpacity *= fadeFactor;
  }

  // Smoothly transition the materials
  snowParticles.material.opacity = THREE.MathUtils.lerp(
    snowParticles.material.opacity,
    targetSnowOpacity,
    1 - Math.exp(-0.5 * delta)
  );
  rainParticles.material.opacity = THREE.MathUtils.lerp(
    rainParticles.material.opacity,
    targetRainOpacity,
    1 - Math.exp(-0.75 * delta)
  );

  // Clamp very small values to 0 to enable clean reset detection next time
  if (snowParticles.material.opacity < 0.001) {
    snowParticles.material.opacity = 0;
  }
  if (rainParticles.material.opacity < 0.001) {
    rainParticles.material.opacity = 0;
  }

  // Toggle visibility to save CPU when completely transparent
  snowParticles.visible = snowParticles.material.opacity >= 0.01;
  rainParticles.visible = rainParticles.material.opacity >= 0.01;

  // Natural rainbow trigger
  // Trigger when the target opacity hits 0 (weather is clearing), but only if it was recently raining heavily
  const isRainClearing = targetRainOpacity === 0;

  if (isRainClearing && !wasRainClearing) {
    if (window._wasRaining) {
      forceRainbow = true;
      window._wasRaining = false;
    }
  }
  wasRainClearing = isRainClearing;

  // Track if we are currently in a rainstorm (even a light one)
  // Max rain opacity is 0.5. Anything above 0.05 counts as rain for a rainbow.
  if (rainParticles.material.opacity > 0.05) {
    window._wasRaining = true;
  }

  if (!snowParticles.visible && !rainParticles.visible) return;

  // Optimization: Weather particle physics and wrapping run entirely on the GPU.
  // We only need to sync the camera position and advance the uniform simulation time for visible precipitation.
  const camPos = camera.position;
  weatherUniforms.cameraPos.value.copy(camPos);

  if (snowParticles.visible) {
    snowParticles.position.copy(camPos);
    // Snow speed varies subtly: base speed is 0.8x, speeding up to 1.0x during heavy storms
    const snowSpeed = 0.8 + (snowParticles.material.opacity / 0.4) * 0.2;
    weatherUniforms.snowTime.value += delta * snowSpeed;
  }

  if (rainParticles.visible) {
    rainParticles.position.copy(camPos);
    weatherUniforms.rainTime.value += delta;
  }
}

// Initialize immediately
initWeather();
