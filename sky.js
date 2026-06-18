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
    {name: 'Arctic', color: 0x66a6ff},
    {name: 'Alpine', color: 0x8eb8e5},
    {name: 'Storm', color: 0x8f9aa1},
  ],
  blue: [
    {name: 'Golden', color: 0xcc7a3d},
    {name: 'Mojave', color: 0xdc9c76},
    {name: 'Cowneck', color: 0xff9542},
  ],
  purple: [
    {name: 'Tropical', color: 0xe27a5e},
    {name: 'Lavender', color: 0xe2b6cf},
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
  THREE.LuminanceFormat
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
  moonPhase: {value: 0.0},
};

const sunGlowVertShader = window.SKY_SHADERS.sunGlowVert;

const sunGlowFragShader = window.SKY_SHADERS.sunGlowFrag;

// Sun
const sunGeo = new THREE.SphereGeometry(200, 32, 32);
const sunMat = new THREE.ShaderMaterial({
  vertexShader: sunMoonVertShader,
  fragmentShader: sunFragShader,
  uniforms: sunUniforms,
  transparent: true,
  depthWrite: false, // Fix: Prevent the sphere from blocking the glow's depth test
  fog: false,
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.visible = false; // Hide physical sun mesh to rely completely on the stunning volumetric shader bloom
skyGroup.add(sunMesh);

const sunGlowGeo = new THREE.PlaneGeometry(800, 800);
const sunGlowMat = new THREE.ShaderMaterial({
  vertexShader: sunGlowVertShader,
  fragmentShader: sunGlowFragShader,
  uniforms: sunUniforms,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  fog: false,
});
const sunGlowMesh = new THREE.Mesh(sunGlowGeo, sunGlowMat);
sunGlowMesh.position.z = 0;
sunGlowMesh.renderOrder = 1; // Force it to render AFTER the solid sun sphere
sunMesh.add(sunGlowMesh);

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
const starsCount = 2000;
const starsPos = new Float32Array(starsCount * 3);
const _starsRng = ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED + 1);
for (let i = 0; i < starsCount * 3; i += 3) {
  const u = _starsRng();
  const v = _starsRng();
  const theta = u * 2.0 * Math.PI;
  const phi = Math.acos(2.0 * v - 1.0);
  const r = 20000 + _starsRng() * 4000;
  starsPos[i] = r * Math.sin(phi) * Math.cos(theta);
  starsPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
  starsPos[i + 2] = r * Math.cos(phi);
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 20,
  sizeAttenuation: true,
  fog: false,
  transparent: true,
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
