import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {scene} from './scene.js';
import {log} from './logger.js';
import {planeGroup} from './airplane.js';
import {simplex} from './noise.js';
import {updateUrlParams} from './constants.js';
import {camera, skyUniforms} from './sky.js';
import {state} from './state.js';
import {playThunder} from './sfx-events.js';
import {thunderHaptic} from './haptics.js';

let lightningLight;
let lightningFlashIntensity;
let _wasRaining;

export var manualCloudCover =
  ChillFlightLogic.START_CLOUD_COVER !== null &&
  ChillFlightLogic.START_CLOUD_COVER !== undefined
    ? ChillFlightLogic.START_CLOUD_COVER
    : null;
export var manualCloudHeight =
  typeof ChillFlightLogic.START_CLOUD_HEIGHT === 'number'
    ? ChillFlightLogic.START_CLOUD_HEIGHT
    : 3000.0;
export var manualCloudSpeed =
  typeof ChillFlightLogic.START_CLOUD_SPEED === 'number'
    ? ChillFlightLogic.START_CLOUD_SPEED
    : 1.0;
export var showCloudsEnabled = ChillFlightLogic.SHOW_CLOUDS;
// --- WEATHER SYSTEM ---
export var weatherType = ChillFlightLogic.START_WEATHER
  ? ChillFlightLogic.START_WEATHER
  : 'auto'; // 'auto', 'none', 'snow', 'rain'
export var snowParticles = null;
export var rainParticles = null;

// Scale particles based on quality
var _initPresetForWeather =
  ChillFlightLogic.GRAPHICS_PRESET ||
  localStorage.getItem('chill_flight_graphics_preset');
var _savedQualityForWeather = localStorage.getItem('chill_flight_quality');
var _isLowPresetForWeather =
  _initPresetForWeather === 'low' ||
  (!_initPresetForWeather &&
    _savedQualityForWeather &&
    parseInt(_savedQualityForWeather) <= 20);
var WEATHER_PARTICLE_COUNT = _isLowPresetForWeather ? 1500 : 5000;
var WEATHER_RANGE = 500;
// Particle opacity at full rain and full snow (the rain and snow modes)
const RAIN_FULL = 0.5;
const SNOW_FULL = 0.8;
const RAIN_EASE_SECONDS = 6;
const SNOW_EASE_SECONDS = 8;
// Eased precipitation, in particle opacity
let _rainLevel = 0;
let _snowLevel = 0;
// What is falling around the camera, 0 to 1 of full rain and full snow
// (after fading out above the clouds), for sound, turbulence and the HUD
export const precipitation = {rain: 0, snow: 0};

function showParticles(points, amount, fullOpacity) {
  const k = Math.sqrt(Math.min(1, amount));
  points.material.opacity = fullOpacity * k;
  points.geometry.setDrawRange(0, Math.ceil(WEATHER_PARTICLE_COUNT * k));
  // Hide when completely transparent to save the draw
  points.visible = amount >= 0.002;
}

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
      log.info(`Weather changed to: ${weatherType}`);
    });
  }

  // Bind Clouds UI
  const debugCloudsToggle = document.getElementById('debug-clouds-toggle');
  if (debugCloudsToggle) {
    debugCloudsToggle.checked = showCloudsEnabled;
    debugCloudsToggle.addEventListener('change', (e) => {
      showCloudsEnabled = e.target.checked;
      if (skyUniforms) {
        skyUniforms.uShowClouds.value =
          showCloudsEnabled &&
          (typeof state.SEGMENTS === 'undefined' || state.SEGMENTS > 20);
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

  // Cloud mood: force one of the moods, or step the cloud day to preview
  // other days' moods (and, in the anime style, their horizon towers)
  const debugCloudMoodSelect = document.getElementById(
    'debug-cloud-mood-select'
  );
  if (debugCloudMoodSelect) {
    for (const name of ChillFlightLogic.CLOUD_MOOD_NAMES) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name[0].toUpperCase() + name.slice(1);
      debugCloudMoodSelect.append(option);
    }
    debugCloudMoodSelect.value = state.cloudMoodOverride ?? 'auto';
    debugCloudMoodSelect.addEventListener('change', (e) => {
      const mood = e.target.value === 'auto' ? null : e.target.value;
      state.cloudMoodOverride = mood;
      updateUrlParams({cloudMood: mood});
    });
  }
  for (const [id, step] of [
    ['debug-cloud-day-prev', -1],
    ['debug-cloud-day-next', 1],
  ]) {
    document.getElementById(id)?.addEventListener('click', () => {
      state.cloudDayOffset += step;
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
      if (skyUniforms && skyUniforms.uCloudHeight) {
        skyUniforms.uCloudHeight.value = manualCloudHeight;
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

export function cycleWeather() {
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
  log.info(`Weather cycled to: ${weatherType}`);
}

export function updateWeather(delta) {
  if (!snowParticles || !rainParticles) return;

  // Optimization: Skip entire weather simulation and hide particles on Low graphics
  if (state.SEGMENTS <= 20) {
    snowParticles.visible = false;
    rainParticles.visible = false;
    snowParticles.material.opacity = 0;
    rainParticles.material.opacity = 0;
    precipitation.rain = 0;
    precipitation.snow = 0;
    return;
  }

  let targetSnowOpacity = 0;
  let targetRainOpacity = 0;

  // Determine target opacities based on active mode
  if (weatherType === 'snow') {
    targetSnowOpacity = SNOW_FULL;
  } else if (weatherType === 'rain') {
    targetRainOpacity = RAIN_FULL;
  } else if (weatherType === 'auto') {
    const weather = ChillFlightLogic.weatherAt(
      planeGroup.position.x,
      planeGroup.position.z,
      state.worldClockNow || performance.now(),
      simplex
    );
    targetSnowOpacity = weather.snow;
    targetRainOpacity = weather.rain;

    // Expose debug data
    state._weatherDebug = {
      stormNoise: weather.stormNoise,
      latVal: weather.lat,
      zone: weather.zone,
    };
  }

  // Ease toward the targets: rain builds and clears over about
  // RAIN_EASE_SECONDS, snow a little more gently
  _rainLevel = THREE.MathUtils.lerp(
    _rainLevel,
    targetRainOpacity,
    1 - Math.exp(-delta / RAIN_EASE_SECONDS)
  );
  _snowLevel = THREE.MathUtils.lerp(
    _snowLevel,
    targetSnowOpacity,
    1 - Math.exp(-delta / SNOW_EASE_SECONDS)
  );
  // Clamp very small values to 0 to enable clean reset detection next time
  if (_rainLevel < 0.001) _rainLevel = 0;
  if (_snowLevel < 0.001) _snowLevel = 0;

  // Initialize lightning light if it doesn't exist
  if (!lightningLight) {
    lightningLight = new THREE.DirectionalLight(0xe0e0ff, 0);
    scene.add(lightningLight);
    lightningFlashIntensity = 0;
  }

  // Lightning logic
  if (lightningFlashIntensity > 0) {
    // Rapidly decay the flash
    lightningFlashIntensity = Math.max(
      0,
      lightningFlashIntensity - delta * 4.0
    );
    if (lightningLight) {
      // Randomly turn it off to create a flickering strobe effect
      lightningLight.intensity =
        Math.random() < 0.3 ? 0 : lightningFlashIntensity;
    }
  } else if (_rainLevel > 0.2 && Math.random() < _rainLevel * 0.0025) {
    // Trigger a new lightning strike during heavy rain
    lightningFlashIntensity = 1.5 + Math.random() * 1.0;
    if (lightningLight) {
      // Set a random overhead angle for the strike
      lightningLight.position
        .set((Math.random() - 0.5) * 2, 1, (Math.random() - 0.5) * 2)
        .normalize();
      lightningLight.color.setHSL(0.6, 0.2, 0.8 + Math.random() * 0.2); // Cool white/blue
    }
    const distance = Math.random();
    playThunder(distance);
    thunderHaptic(distance);
  }

  // Store unfaded opacities to drive cloud density even when above clouds
  state._unfadedSnowOpacity = _snowLevel;
  state._unfadedRainOpacity = _rainLevel;

  // Fade out precipitation when flying above the cloud layer
  let rainShown = _rainLevel / RAIN_FULL;
  let snowShown = _snowLevel / SNOW_FULL;
  const cloudCeiling =
    typeof manualCloudHeight === 'number' ? manualCloudHeight : 3000.0;
  const fadeStart = cloudCeiling - 100.0; // Start fading 100 units below the clouds
  if (camera.position.y > fadeStart) {
    const fadeFactor = Math.max(
      0,
      1.0 - (camera.position.y - fadeStart) / 100.0
    );
    rainShown *= fadeFactor;
    snowShown *= fadeFactor;
  }
  precipitation.rain = rainShown;
  precipitation.snow = snowShown;

  // Light precipitation is fewer drops, not just fainter ones: the drop
  // count and the opacity each follow the square root of the amount, so a
  // drizzle or the first flakes are sparse but visible
  showParticles(rainParticles, rainShown, RAIN_FULL);
  showParticles(snowParticles, snowShown, SNOW_FULL);

  // Natural rainbow trigger
  // Trigger when the target opacity hits 0 (weather is clearing), but only if it was recently raining heavily
  const isRainClearing = targetRainOpacity === 0;

  if (isRainClearing && !state.wasRainClearing) {
    if (_wasRaining) {
      state.forceRainbow = true;
      _wasRaining = false;
    }
  }
  state.wasRainClearing = isRainClearing;

  // Track if we are currently in a rainstorm (even a light one)
  // Anything above a tenth of full rain counts as rain for a rainbow.
  if (precipitation.rain > 0.1) {
    _wasRaining = true;
  }

  if (!snowParticles.visible && !rainParticles.visible) return;

  // Optimization: Weather particle physics and wrapping run entirely on the GPU.
  // We only need to sync the camera position and advance the uniform simulation time for visible precipitation.
  const camPos = camera.position;
  weatherUniforms.cameraPos.value.copy(camPos);

  if (snowParticles.visible) {
    snowParticles.position.copy(camPos);
    // Snow speed varies subtly: base speed is 0.8x, speeding up to 1.0x in heavy snow
    const snowSpeed = 0.8 + Math.min(1, snowShown / 0.5) * 0.2;
    weatherUniforms.snowTime.value += delta * snowSpeed;
  }

  if (rainParticles.visible) {
    rainParticles.position.copy(camPos);
    weatherUniforms.rainTime.value += delta;
  }
}

// Initialize immediately
initWeather();
