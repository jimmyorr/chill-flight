// --- SCENE, CAMERA, RENDERER, LIGHTS, SKY ---
// Dependencies: THREE (CDN)

const scene = new THREE.Scene();
// Background will be handled by a Skysphere shader
scene.fog = new THREE.FogExp2(0xa0d8ef, 0.00005);

// --- SKY SHADER MATERIAL ---
const skyVertexShader = window.SKY_SHADERS.skyVert;

const skyFragmentShader = window.SKY_SHADERS.skyFrag;

// --- DYNAMIC ATMOSPHERE PALETTE GENERATOR ---
// Replaces the static ATMOSPHERE_PALETTES array

// Curated horizon colors (derived from preset palettes) grouped by complementary zenith hues
const CURATED_HORIZONS = {
  cyan: [
    {name: 'Coral', color: 0xff7e67}, // Soft, vibrant pinkish-orange
    {name: 'Peach', color: 0xffb08a}, // Light, warm pastel orange
    {name: 'Rose', color: 0xffa3af}, // Delicate, cool-toned sunset pink
  ],
  blue: [
    {name: 'Sunset', color: 0xff8260}, // Warm, natural sunset pink-orange
    {name: 'Mango', color: 0xffb347}, // Bright, clean golden yellow-orange
    {name: 'Cowneck', color: 0xff9542}, // Bold, fiery saturated orange
  ],
  purple: [
    {name: 'Tropical', color: 0xe27a5e}, // Warm, earthy terracotta sunrise
    {name: 'Lavender', color: 0xe2b6cf}, // Soft, dreamy pastel purple-pink
  ],
};

function generateDynamicPalette(rng) {
  // Helper to get random value between min and max using the seeded RNG
  const rand = (min, max) => min + rng() * (max - min);

  // --- ZENITH (Top Color) ---
  // Darker, deeper tones. We bias towards blues, purples, and deep slates.
  // HSL Hue in Three.js is 0.0 to 1.0 (0=Red, 0.33=Green, 0.66=Blue, 1.0=Red)
  // 0.5 to 0.85 covers Cyan -> Blue -> Purple -> Deep Pink
  const topHue = rand(0.5, 0.85);

  // Pick Top Names and matching horizon category based on Top Hue
  let tNames;
  let horizonCategory;
  if (topHue < 0.6) {
    // Cyan/Teal
    tNames = ['Stormy', 'Deep', 'Slate'];
    horizonCategory = 'cyan';
  } else if (topHue < 0.75) {
    // Core Blue
    tNames = ['Midnight', 'Abyssal', 'Deep', 'Abyss'];
    horizonCategory = 'blue';
  } else {
    // Purple/Indigo
    tNames = ['Twilight', 'Cosmic', 'Velvet', 'Starry'];
    horizonCategory = 'purple';
  }

  const topSat = rand(0.3, 0.7); // Medium saturation so it isn't blindingly neon
  const topLight = rand(0.1, 0.35); // Keep it dark and moody

  const topColor = new THREE.Color().setHSL(topHue, topSat, topLight);

  // --- HORIZON (Bottom Color) ---
  // We use our curated presets to guarantee vibrant, beautiful sunsets
  const horizons = CURATED_HORIZONS[horizonCategory];
  const selectedHorizon = horizons[Math.floor(rng() * horizons.length)];
  const bottomColor = selectedHorizon.color;
  const bName = selectedHorizon.name;

  // Use the RNG again to pick names from the narrowed categories
  const tName = tNames[Math.floor(rng() * tNames.length)];

  return {
    name: `${tName} ${bName}`,
    top: topColor.getHex(),
    bottom: bottomColor,
  };
}

// Standard parameters are handled by ChillFlightLogic
let selectedPalette;
let currentPaletteCycle = -1;
let isCustomPalette = false;

function applyCustomSkyColors(top, bottom) {
  isCustomPalette = true;

  // Convert hex string (from picker) or number to hex if needed
  const topHex =
    typeof top === 'string' ? parseInt(top.replace('#', ''), 16) : top;
  const bottomHex =
    typeof bottom === 'string' ? parseInt(bottom.replace('#', ''), 16) : bottom;

  selectedPalette = {
    name: 'Custom',
    top: topHex,
    bottom: bottomHex,
  };

  if (typeof skyUniforms !== 'undefined') {
    skyUniforms.topColor.value.setHex(selectedPalette.top);
    skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);
  }

  window.dispatchEvent(
    new CustomEvent('paletteChanged', {detail: selectedPalette})
  );
}

function updateSkyPalette(serverNow) {
  if (isCustomPalette) return;

  const CYCLE_DURATION_MS = 300000;
  const cycleNumber = Math.floor(serverNow / CYCLE_DURATION_MS);

  if (cycleNumber !== currentPaletteCycle) {
    const isFirstLoad = currentPaletteCycle === -1;
    currentPaletteCycle = cycleNumber;

    let rng;
    if (
      isFirstLoad &&
      ChillFlightLogic.PALETTE_INDEX !== null &&
      !isNaN(parseInt(ChillFlightLogic.PALETTE_INDEX))
    ) {
      // If a user forces a specific palette index via URL, we use it as the RNG seed
      // so they get a deterministic custom palette.
      const paletteIndex = parseInt(ChillFlightLogic.PALETTE_INDEX);
      rng = ChillFlightLogic.mulberry32(paletteIndex);
    } else {
      // Seed the RNG with the world seed plus the cycle number,
      // so every cycle (in-game day) gets a synchronized random palette across the server.
      rng = ChillFlightLogic.mulberry32(
        ChillFlightLogic.WORLD_SEED + cycleNumber
      );
    }

    // Generate the colors!
    selectedPalette = generateDynamicPalette(rng);

    console.log(
      `Atmosphere Palette Updated (Cycle ${cycleNumber}): ${selectedPalette.name}`
    );

    // If uniforms already exist, update them
    if (typeof skyUniforms !== 'undefined') {
      skyUniforms.topColor.value.setHex(selectedPalette.top);
      skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);
    }

    // Dispatch an event so game.js can recalculate derived gradient colors
    window.dispatchEvent(
      new CustomEvent('paletteChanged', {detail: selectedPalette})
    );
  }
}

// --- NOISE TEXTURE GENERATOR ---
const _noiseSize = 256;
const _noiseData = new Uint8Array(_noiseSize * _noiseSize);
for (let i = 0; i < _noiseData.length; i++) {
  _noiseData[i] = Math.floor(Math.random() * 256);
}
const skyNoiseTexture = new THREE.DataTexture(
  _noiseData,
  _noiseSize,
  _noiseSize,
  THREE.RedFormat
);
skyNoiseTexture.wrapS = THREE.RepeatWrapping;
skyNoiseTexture.wrapT = THREE.RepeatWrapping;
skyNoiseTexture.minFilter = THREE.LinearFilter;
skyNoiseTexture.magFilter = THREE.LinearFilter;
skyNoiseTexture.needsUpdate = true;

// Initial object creation with dummy values; updateSkyPalette will populate them
const skyUniforms = {
  topColor: {value: new THREE.Color()},
  bottomColor: {value: new THREE.Color()},
  sunDirection: {value: new THREE.Vector3(0, 1, 0)},
  offset: {value: 33},
  exponent: {value: 0.6},
  glowPower: {value: 2.0}, // Higher = more concentrated sunset
  mieFactor: {value: 0.9}, // Higher = more aggressive muting away from sun
  uTime: {value: 0.0},
  uCloudDensity: {value: 0.5},
  uShowClouds: {value: true},
  uAuroraIntensity: {value: 0.0}, // 0 = off, 1 = full intensity; driven by latitude + night
  uNoiseTex: {value: skyNoiseTexture},
  uCameraPos: {value: new THREE.Vector3()},
};
window.skyUniforms = skyUniforms;

// Initial calculation
updateSkyPalette(Date.now() + (window.serverTimeOffset || 0));

const skyMat = new THREE.ShaderMaterial({
  vertexShader: skyVertexShader,
  fragmentShader: skyFragmentShader,
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false, // Don't block stars/celestials
  fog: false,
});

scene.fog.color.set(selectedPalette.bottom);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  1,
  30000
);

// Antialiasing is expensive; disable it on the 'Low' preset (SEGMENTS <= 20) to prioritize performance.
// Since AA belongs to the WebGL context, this won't change until the next page load.
const _initQuality = localStorage.getItem('chill_flight_quality');
const _isLowQuality = _initQuality && parseInt(_initQuality) <= 20;

// Update uniforms for initial load
skyUniforms.uShowClouds.value = ChillFlightLogic.SHOW_CLOUDS && !_isLowQuality;

const renderer = new THREE.WebGLRenderer({antialias: !_isLowQuality});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(
  _isLowQuality ? 1 : Math.min(window.devicePixelRatio, 2)
);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 500, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff0dd, 0.8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 10;
dirLight.shadow.camera.far = 8000; // Increased so distant shadows aren't clipped
dirLight.shadow.camera.left = -2048; // Massively expanded coverage
dirLight.shadow.camera.right = 2048;
dirLight.shadow.camera.top = 2048;
dirLight.shadow.camera.bottom = -2048;
dirLight.shadow.bias = -0.0007;
dirLight.shadow.normalBias = 0.005;
scene.add(dirLight);
scene.add(dirLight.target);

const moonLight = new THREE.DirectionalLight(0xbad2ff, 0.3); // Cool moonlight
scene.add(moonLight);

// --- DAY / NIGHT CYCLE SETUP ---
// timeOfDay goes from 0 to 2PI (0 = midnight, PI/2 = 6am, PI = noon, 3PI/2 = 6pm)
let timeOfDay = Math.PI * (5.5 / 12); // Start at 05:30 to catch the heart of the sunrise transition
const BASE_DAY_SPEED = 0.02;
let daySpeedMultiplier =
  typeof ChillFlightLogic !== 'undefined' &&
  ChillFlightLogic.START_TIME_SPEED !== null
    ? ChillFlightLogic.START_TIME_SPEED
    : 1;

// Sky Objects Group (follows player, hosts celestial bodies)
const skyGroup = new THREE.Group();
scene.add(skyGroup);

// Skysphere (Backdrop)
const skySphereGeo = new THREE.SphereGeometry(25000, 32, 12);
const skySphereMesh = new THREE.Mesh(skySphereGeo, skyMat);
skyGroup.add(skySphereMesh);

// --- CELESTIAL SHADERS ---
const sunMoonVertShader = window.SKY_SHADERS.sunMoonVert;

const sunFragShader = window.SKY_SHADERS.sunFrag;

const moonFragShader = window.SKY_SHADERS.moonFrag;

const sunUniforms = {
  uTime: {value: 0.0},
  overcast: {value: 0.0},
  dayFactor: {value: 1.0},
  uSunColor: {value: new THREE.Color(0xffffff)},
  uNoiseTex: {value: skyNoiseTexture},
};

const moonUniforms = {
  uTime: {value: 0.0},
  overcast: {value: 0.0},
  dayFactor: {value: 1.0},
  uSunDirectionWorld: {value: new THREE.Vector3(1, 0, 0)},
  uMoonRotMat: {value: new THREE.Matrix3()},
  uNoiseTex: {value: skyNoiseTexture},
  uCloudDensity: {value: 0.5},
  uMoonSkyDir: {value: new THREE.Vector3(0, 0.2, -1)},
  uCameraPos: {value: new THREE.Vector3()},
};
window.sunUniforms = sunUniforms;
window.moonUniforms = moonUniforms;

const sunGlowVertShader = window.SKY_SHADERS.sunGlowVert;

const sunGlowFragShader = window.SKY_SHADERS.sunGlowFrag;

// Note: The physical sun mesh and glow plane geometries/materials have been removed
// because the sky relies completely on the stunning volumetric shader bloom.
// sunMesh is preserved as a dummy Group to maintain compatibility with animation references.
const sunMesh = new THREE.Group();
skyGroup.add(sunMesh);

// Moon
const moonGeo = new THREE.SphereGeometry(120, 32, 32);
const moonMat = new THREE.ShaderMaterial({
  vertexShader: sunMoonVertShader,
  fragmentShader: moonFragShader,
  uniforms: moonUniforms,
  transparent: true,
  fog: false,
});
const moonMesh = new THREE.Mesh(moonGeo, moonMat);
skyGroup.add(moonMesh);

// Stars
const starsGeo = new THREE.BufferGeometry();
const starsCount = 4000;
const starsPos = new Float32Array(starsCount * 3);
const starsColors = new Float32Array(starsCount * 3);
const starsSizes = new Float32Array(starsCount);
const starsPhases = new Float32Array(starsCount);
const _starsRng = ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED + 1);
for (let i = 0; i < starsCount; i++) {
  const i3 = i * 3;
  const u = _starsRng();
  const v = _starsRng();
  const theta = u * 2.0 * Math.PI;
  const phi = Math.acos(2.0 * v - 1.0);
  const r = 20000 + _starsRng() * 4000;
  starsPos[i3] = r * Math.sin(phi) * Math.cos(theta);
  starsPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starsPos[i3 + 2] = r * Math.cos(phi);

  const sizeRand = _starsRng();
  if (sizeRand < 0.8) starsSizes[i] = 1.0 + _starsRng() * 1.5;
  else if (sizeRand < 0.98) starsSizes[i] = 3.0 + _starsRng() * 2.0;
  else starsSizes[i] = 6.0 + _starsRng() * 4.0;

  const colorType = _starsRng();
  let rC = 1,
    gC = 1,
    bC = 1;
  if (colorType < 0.6) {
    rC = 1;
    gC = 1;
    bC = 1;
  } else if (colorType < 0.8) {
    rC = 0.8;
    gC = 0.9;
    bC = 1;
  } else if (colorType < 0.95) {
    rC = 1;
    gC = 0.9;
    bC = 0.8;
  } else {
    rC = 1;
    gC = 0.8;
    bC = 0.8;
  }

  const brightness = 0.5 + _starsRng() * 0.5;
  starsColors[i3] = rC * brightness;
  starsColors[i3 + 1] = gC * brightness;
  starsColors[i3 + 2] = bC * brightness;

  starsPhases[i] = _starsRng() * Math.PI * 2.0;
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
starsGeo.setAttribute('color', new THREE.BufferAttribute(starsColors, 3));
starsGeo.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));
starsGeo.setAttribute('phase', new THREE.BufferAttribute(starsPhases, 1));

const starsMat = new THREE.ShaderMaterial({
  uniforms: {
    uOpacity: {value: 1.0},
    uTime: skyUniforms.uTime,
  },
  vertexShader: `
    attribute float size;
    attribute vec3 color;
    attribute float phase;
    varying vec3 vColor;
    varying float vPhase;
    void main() {
      vColor = color;
      vPhase = phase;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    uniform float uTime;
    varying vec3 vColor;
    varying float vPhase;
    void main() {
      float dist = length(gl_PointCoord - vec2(0.5));
      if (dist > 0.5) discard;
      float alpha = pow((0.5 - dist) * 2.0, 1.5);
      
      // Twinkle effect (slow)
      float twinkle = 0.85 + 0.15 * sin(uTime * 1.5 + vPhase);
      
      gl_FragColor = vec4(vColor, alpha * uOpacity * twinkle);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
});
Object.defineProperty(starsMat, 'opacity', {
  get: function () {
    return this.uniforms.uOpacity.value;
  },
  set: function (v) {
    this.uniforms.uOpacity.value = v;
  },
});
const starsMesh = new THREE.Points(starsGeo, starsMat);
skyGroup.add(starsMesh);

// Shooting Star
const shootingStarGeo = new THREE.BufferGeometry();
const shootingStarPos = new Float32Array([0, 0, 0, 0, 0, 0]); // Start with a zero-length line
shootingStarGeo.setAttribute(
  'position',
  new THREE.BufferAttribute(shootingStarPos, 3)
);
// Use vertex colors for the fading tail
const shootingStarColors = new Float32Array([1, 1, 1, 1, 1, 1]);
shootingStarGeo.setAttribute(
  'color',
  new THREE.BufferAttribute(shootingStarColors, 3)
);

const shootingStarMat = new THREE.LineBasicMaterial({
  color: 0xe0ffff, // Light cyan/white
  vertexColors: true,
  transparent: true,
  linewidth: 2, // Note: WebGL standard limits linewidth to 1 on most platforms, but it still works
  fog: false,
  depthWrite: false,
});
const shootingStarMesh = new THREE.Line(shootingStarGeo, shootingStarMat);
shootingStarMesh.name = 'shootingStar';
shootingStarMesh.visible = false;
shootingStarMesh.frustumCulled = false; // Prevent it from being culled since we update vertices dynamically
skyGroup.add(shootingStarMesh);

// Rainbow
const rainbowVertShader = window.SKY_SHADERS.rainbowVert;

const rainbowFragShader = window.SKY_SHADERS.rainbowFrag;

const rainbowUniforms = {
  uAlpha: {value: 0.0},
};

const rainbowGeo = new THREE.RingGeometry(11000, 13000, 128, 1, 0, Math.PI * 2);
const rainbowMat = new THREE.ShaderMaterial({
  vertexShader: rainbowVertShader,
  fragmentShader: rainbowFragShader,
  uniforms: rainbowUniforms,
  transparent: true,
  blending: THREE.NormalBlending,
  depthWrite: false,
  depthTest: true,
  fog: false,
  side: THREE.DoubleSide,
});

const rainbowMesh = new THREE.Mesh(rainbowGeo, rainbowMat);
rainbowMesh.name = 'rainbow';
rainbowMesh.visible = false;
rainbowMesh.frustumCulled = false;
skyGroup.add(rainbowMesh);
