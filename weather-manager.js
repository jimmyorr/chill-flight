import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {scene} from './scene.js';
import {log} from './logger.js';
import {planeGroup} from './airplane.js';
import {simplex} from './noise.js';
import {roadSnowUniforms, updateUrlParams} from './constants.js';
import {camera, skyUniforms} from './sky.js';
import {state} from './state.js';
import {WIND_DIR_X, WIND_DIR_Z} from './terrain-gen.js';
import {playThunder} from './sfx-events.js';
import {thunderHaptic} from './haptics.js';
import {lightningBrightness, lightningTimeline} from './lightning-logic.js';

export let lightningLight;
// The flash in progress: its timeline (lightning-logic.js), age in seconds,
// peak light and where it is (a unit vector from the camera)
let _flash = null;
const _flashDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _reduceMotion =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
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
// Start a lightning flash: distance 0..1 (overhead to far off), angle its
// compass direction in radians. Also handy from the console for testing.
export function flashLightning(
  distance = Math.random(),
  angle = Math.random() * Math.PI * 2
) {
  if (!lightningLight) return;
  // Near strikes light the sky from high up, far ones from low down
  _flashDir
    .set(Math.cos(angle), 0.9 - distance * 0.7, Math.sin(angle))
    .normalize();
  _flash = {
    timeline: lightningTimeline(Math.random, !!_reduceMotion?.matches),
    age: 0,
    peak: (1.5 + Math.random()) * (1 - distance * 0.5),
    sky: 1 - distance * 0.5,
  };
  lightningLight.position.copy(_flashDir);
  lightningLight.color.setHSL(0.6, 0.2, 0.8 + Math.random() * 0.2); // Cool white/blue
  skyUniforms.uFlash.value.set(_flashDir.x, _flashDir.y, _flashDir.z, 0);
  // Thunder from the side the flash is on
  _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  playThunder(distance, false, _camRight.dot(_flashDir));
  thunderHaptic(distance);
}

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
  points.material.uniforms.uOpacity.value =
    fullOpacity * k * points.userData.strength;
  points.geometry.instanceCount = Math.ceil(points.userData.count * k);
  // Hide when completely transparent to save the draw
  points.visible = amount >= 0.002;
}

// Rain and snow are one draw call each: every drop or flake is a small quad
// (an instance) whose fall, wrap around the camera, flutter and motion streak
// are all worked out in the vertex shader, so the CPU only moves a clock.
//
// Each quad is drawn as a capsule from where the drop is to where it was a
// moment ago as the camera saw it (its fall minus the camera's own motion),
// so rain slants toward you in flight and stands straight when parked, and
// snow smears a little at speed. Widths are in world units but never thinner
// than about a pixel (thinner ones fade instead, so far drops don't
// shimmer) and flakes never grow past a few pixels right by the camera.
const weatherUniforms = {
  cameraPos: {value: new THREE.Vector3()},
  cameraVel: {value: new THREE.Vector3()},
  range: {value: WEATHER_RANGE},
  resolution: {value: new THREE.Vector2(1, 1)},
  // Drawing-buffer pixels per CSS pixel
  pxScale: {value: 1},
  light: {value: 1},
};
const _lastCamPos = new THREE.Vector3();
let _haveLastCamPos = false;
const _camVelRaw = new THREE.Vector3();
const _bufferSize = new THREE.Vector2();
const _windDir = new THREE.Vector2(WIND_DIR_X, WIND_DIR_Z).normalize();

const WEATHER_VERTEX = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aVel;
  uniform float uTime;
  uniform vec3 uCamPos;
  uniform vec3 uCamVel;
  uniform float uRange;
  uniform vec2 uResolution;
  uniform float uPxScale;
  // Seconds of motion a streak shows
  uniform float uExposure;
  // World width, and the narrowest and widest it's drawn, in CSS pixels
  uniform float uWidth;
  uniform float uMinPx;
  uniform float uMaxPx;
  // Longest streak, as a fraction of the screen height
  uniform float uMaxLen;
  // Flutter, in world units
  uniform float uSway;
  // Fade in from the camera between these distances
  uniform vec2 uNear;
  varying vec2 vLocal;
  varying float vLen;
  varying float vR;
  varying float vAlpha;
  void main() {
    float seed = aVel.w;
    vec3 p = aPos + aVel.xyz * uTime;
    vec3 swayVel = vec3(0.0);
    if (uSway > 0.0) {
      float a = uTime * (0.9 + seed * 0.8) + seed * 40.0;
      float b = uTime * (0.7 + seed * 0.6) + seed * 17.0;
      p.x += uSway * sin(a);
      p.z += uSway * cos(b);
      swayVel = vec3(
        uSway * cos(a) * (0.9 + seed * 0.8),
        0.0,
        -uSway * sin(b) * (0.7 + seed * 0.6)
      );
    }
    vec3 halfBox = vec3(uRange * 0.5);
    vec3 rel = mod(p - uCamPos + halfBox, uRange) - halfBox;
    vec3 world = uCamPos + rel;
    vec3 seen = aVel.xyz + swayVel - uCamVel;

    vec4 head = projectionMatrix * viewMatrix * vec4(world, 1.0);
    vec4 tail = projectionMatrix * viewMatrix * vec4(world - seen * uExposure, 1.0);
    if (head.w < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      return;
    }
    if (tail.w < 0.5) tail = head;

    vec2 halfRes = 0.5 * uResolution;
    vec2 sH = head.xy / head.w * halfRes;
    vec2 sT = tail.xy / tail.w * halfRes;
    vec2 d = sH - sT;
    float len = length(d);
    float maxLen = uMaxLen * uResolution.y;
    if (len > maxLen) {
      sT = sH - d / len * maxLen;
      len = maxLen;
    }
    vec2 n = len > 0.001 ? d / len : vec2(0.0, 1.0);
    vec2 side = vec2(-n.y, n.x);

    // Width on screen, flakes a little varied in size
    float size = uWidth * (0.6 + 0.8 * fract(seed * 7.13));
    float px = size * projectionMatrix[1][1] * halfRes.y / head.w;
    float minPx = max(uMinPx * uPxScale, 1.0);
    float w = clamp(px, minPx, uMaxPx * uPxScale);
    float r = 0.5 * w;

    // position.xy: x across (-0.5..0.5), y along (-0.5 tail .. 0.5 head)
    float along = position.y + 0.5;
    vec2 s = mix(sT - n * r, sH + n * r, along) + side * position.x * 2.0 * r;
    gl_Position = vec4(s / halfRes * head.w, head.z, head.w);

    vLocal = vec2(position.x * 2.0 * r, along * (len + 2.0 * r) - r);
    vLen = len;
    vR = r;
    float dist = length(rel);
    vAlpha = min(1.0, px / minPx) *
      smoothstep(uNear.x, uNear.y, head.w) *
      (1.0 - smoothstep(0.38 * uRange, 0.5 * uRange, dist));
  }
`;

const WEATHER_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uLight;
  // 0: a soft dot (snow); 1: brighter toward the falling end (rain)
  uniform float uHeadBias;
  varying vec2 vLocal;
  varying float vLen;
  varying float vR;
  varying float vAlpha;
  void main() {
    float beyond = max(0.0, max(-vLocal.y, vLocal.y - vLen));
    float d = length(vec2(beyond, vLocal.x)) / max(vR, 0.001);
    if (d >= 1.0) discard;
    float soft = 1.0 - d * d;
    float t = clamp(vLocal.y / max(vLen, 0.001), 0.0, 1.0);
    float body = mix(1.0, 0.25 + 0.75 * t, uHeadBias);
    gl_FragColor = vec4(uColor * uLight, uOpacity * vAlpha * soft * body);
  }
`;

function buildPrecipitation(count, makeVelocity, look) {
  const geometry = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * WEATHER_RANGE;
    pos[i * 3 + 1] = (Math.random() - 0.5) * WEATHER_RANGE;
    pos[i * 3 + 2] = (Math.random() - 0.5) * WEATHER_RANGE;
    makeVelocity(v);
    // Blown along the same wind the trees lean in
    v.x += _windDir.x * look.wind;
    v.z += _windDir.y * look.wind;
    vel[i * 4] = v.x;
    vel[i * 4 + 1] = v.y;
    vel[i * 4 + 2] = v.z;
    vel[i * 4 + 3] = Math.random();
  }
  geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  geometry.setAttribute('aVel', new THREE.InstancedBufferAttribute(vel, 4));
  geometry.instanceCount = count;

  const uniforms = {
    uTime: {value: 0},
    uCamPos: weatherUniforms.cameraPos,
    uCamVel: weatherUniforms.cameraVel,
    uRange: weatherUniforms.range,
    uResolution: weatherUniforms.resolution,
    uPxScale: weatherUniforms.pxScale,
    uLight: weatherUniforms.light,
    uOpacity: {value: 0},
    uColor: {value: new THREE.Color(look.color)},
    uExposure: {value: look.exposure},
    uWidth: {value: look.width},
    uMinPx: {value: look.minPx},
    uMaxPx: {value: look.maxPx},
    uMaxLen: {value: look.maxLen},
    uSway: {value: look.sway},
    uNear: {value: new THREE.Vector2(look.near[0], look.near[1])},
    uHeadBias: {value: look.headBias},
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WEATHER_VERTEX,
    fragmentShader: WEATHER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    // The quad's winding follows the streak's direction on screen
    side: THREE.DoubleSide,
  });
  material.opacity = 0;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 3;
  mesh.userData.count = count;
  // Opacity at full rain or snow is RAIN_FULL or SNOW_FULL times this
  mesh.userData.strength = look.strength;
  mesh.onBeforeRender = (renderer) => {
    renderer.getDrawingBufferSize(_bufferSize);
    weatherUniforms.resolution.value.copy(_bufferSize);
    weatherUniforms.pxScale.value = renderer.getPixelRatio();
  };
  scene.add(mesh);
  return mesh;
}

function initWeather() {
  // Snow: gentle drift and slow fall, small soft flakes that flutter
  snowParticles = buildPrecipitation(
    WEATHER_PARTICLE_COUNT,
    (v) =>
      v.set(
        (Math.random() - 0.5) * 15,
        -(Math.random() * 25 + 30),
        (Math.random() - 0.5) * 15
      ),
    {
      color: 0xf4f7ff,
      strength: 1.2,
      wind: 10,
      exposure: 0.003,
      width: 1.4,
      minPx: 1.4,
      maxPx: 7,
      maxLen: 0.01,
      sway: 1.6,
      near: [1.5, 6],
      headBias: 0,
    }
  );
  // Rain: fast fall, minimal horizontal drift, thin streaks
  rainParticles = buildPrecipitation(
    WEATHER_PARTICLE_COUNT,
    (v) =>
      v.set(
        (Math.random() - 0.5) * 5,
        -(Math.random() * 200 + 250),
        (Math.random() - 0.5) * 5
      ),
    {
      color: 0xdde6f0,
      strength: 1.3,
      wind: 55,
      exposure: 0.04,
      width: 0.3,
      minPx: 1,
      maxPx: 1.8,
      maxLen: 0.12,
      sway: 0,
      near: [6, 20],
      headBias: 1,
    }
  );

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
    roadSnowUniforms.uRoadSnow.value = 0;
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
  }

  // Lightning: each flash plays a timeline of strokes (lightning-logic.js),
  // the same at any frame rate. It lights the land from the strike's
  // direction and the sky around it (uFlash in sky.frag.glsl).
  if (_flash) {
    _flash.age += delta;
    const b = lightningBrightness(_flash.timeline, _flash.age, delta);
    lightningLight.intensity = b * _flash.peak;
    skyUniforms.uFlash.value.w = Math.min(b, 1.2) * _flash.sky;
    if (_flash.age >= _flash.timeline.dur) {
      _flash = null;
      lightningLight.intensity = 0;
      skyUniforms.uFlash.value.w = 0;
    }
  } else if (_rainLevel > 0.2 && Math.random() < _rainLevel * 0.15 * delta) {
    // A new strike during heavy rain (about one every 13 s in a downpour,
    // at any frame rate), somewhere around the camera
    flashLightning();
  }

  // Store unfaded opacities to drive cloud density even when above clouds
  state._unfadedSnowOpacity = _snowLevel;
  state._unfadedRainOpacity = _rainLevel;
  // Snow still settles below while you fly above the clouds
  roadSnowUniforms.uRoadSnow.value = ChillFlightLogic.settleRoadSnow(
    roadSnowUniforms.uRoadSnow.value,
    _snowLevel / SNOW_FULL,
    delta
  );

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

  // The camera's own motion, smoothed, so the streaks slant with it
  const camPos = camera.position;
  weatherUniforms.cameraPos.value.copy(camPos);
  if (_haveLastCamPos && delta > 0) {
    _camVelRaw.subVectors(camPos, _lastCamPos).divideScalar(delta);
    // A jump (respawn, teleport) isn't motion
    if (_camVelRaw.lengthSq() > 1500 * 1500) _camVelRaw.set(0, 0, 0);
    weatherUniforms.cameraVel.value.lerp(
      _camVelRaw,
      1 - Math.exp(-delta / 0.15)
    );
  }
  _lastCamPos.copy(camPos);
  _haveLastCamPos = true;
  // Dimmer at night, but still catching what light there is
  weatherUniforms.light.value =
    0.6 + 0.4 * THREE.MathUtils.clamp(state.dayFactor, 0, 1);

  if (snowParticles.visible) {
    // Snow speed varies subtly: base speed is 0.8x, speeding up to 1.0x in heavy snow
    const snowSpeed = 0.8 + Math.min(1, snowShown / 0.5) * 0.2;
    snowParticles.material.uniforms.uTime.value += delta * snowSpeed;
  }

  if (rainParticles.visible) {
    rainParticles.material.uniforms.uTime.value += delta;
  }
}

// Initialize immediately
initWeather();
