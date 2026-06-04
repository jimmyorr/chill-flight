// --- SCENE, CAMERA, RENDERER, LIGHTS, SKY ---
// Dependencies: THREE (CDN)

const scene = new THREE.Scene();
// Background will be handled by a Skysphere shader
scene.fog = new THREE.FogExp2(0xa0d8ef, 0.00005);

// --- SKY SHADER MATERIAL ---
const skyVertexShader = `
    varying vec3 vWorldPosition;
    varying vec3 vDirection;
    void main() {
        vDirection = position.xyz;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const skyFragmentShader = `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 sunDirection;
    uniform float offset;
    uniform float exponent;
    uniform float glowPower;
    uniform float mieFactor;
    uniform float uTime;
    uniform float uCloudDensity;
    uniform bool uShowClouds;
    uniform float uAuroraIntensity;
    uniform vec3 uCameraPos;
    varying vec3 vWorldPosition;
    varying vec3 vDirection;

    uniform sampler2D uNoiseTex;

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return texture2D(uNoiseTex, (i + u + 0.5) / 256.0).r;
    }

    float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(st);
            st *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        vec3 dir = normalize(vDirection + vec3(0.0, offset, 0.0));
        float h = dir.y;
        
        // Calculate sun influence (0 to 1) based on direction
        float sunIntensity = max(0.0, dot(dir, sunDirection));
        
        // Base atmospheric scattering glow
        float glow = pow(sunIntensity, glowPower);
        
        // Mute the bottom color when away from the sun for realistic horizon falloff
        vec3 effectiveBottom = mix(topColor * 0.7, bottomColor, glow * mieFactor + (1.0 - mieFactor));
        
        // Base vertical gradient
        vec3 col = mix(effectiveBottom, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        
        // --- STUNNING SUN BLOOM ---
        // 1. Wide, soft atmospheric scattering (takes on the sunset's bottomColor)
        vec3 wideGlow = bottomColor * pow(sunIntensity, 6.0) * 0.6 * (1.0 - h);
        // 2. Warm fiery mid-halo
        vec3 warmHalo = vec3(1.0, 0.6, 0.1) * pow(sunIntensity, 24.0) * 0.8;
        // 3. Intense hot core (bright golden-white, tighter)
        vec3 hotCore = vec3(1.0, 0.95, 0.8) * pow(sunIntensity, 512.0) * 2.5;
        // Screen blend the bloom so it brightens beautifully without blowing out completely
        vec3 totalGlow = wideGlow + warmHalo + hotCore;
        col = col + totalGlow * (vec3(1.0) - col);
        
        // --- VOLUMETRIC PROCEDURAL CLOUDS (DUAL LAYER PARALLAX) ---
        float cloudHeight = 3000.0;
        float distToPlane = cloudHeight - uCameraPos.y;
        
        // If below clouds (dist > 0), we look up (h > 0). If above clouds (dist < 0), we look down (h < 0).
        if (uShowClouds && (distToPlane * h) > 0.0) {
            float t = distToPlane / h;
            vec2 cloudUV = (uCameraPos.xz + dir.xz * t) / cloudHeight;
            vec2 sunDir2D = length(sunDirection.xz) > 0.001 ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
            
            // Dim the sun's influence on clouds during a storm
            float stormDimming = 1.0 - uCloudDensity * 0.8;
            float sunProximity = pow(sunIntensity, 3.0) * stormDimming;
            
            // Darken the base cloud colors during a storm
            vec3 baseShadow = mix(vec3(0.15, 0.15, 0.2), vec3(0.05, 0.06, 0.08), uCloudDensity);
            vec3 baseBright = mix(vec3(0.9, 0.9, 0.95), vec3(0.4, 0.45, 0.5), uCloudDensity);
            
            vec3 shadowColor = mix(topColor * 0.5, baseShadow, 0.5);
            vec3 brightEdgeColor = mix(baseBright, bottomColor * 2.0, sunProximity);
            
            // Widen the density range for clearer skies and thicker storms
            float densityOffset = (uCloudDensity - 0.5) * 0.6;
            float horizonFade = smoothstep(0.0, 0.15, abs(h));

            // -- Layer 1: High Altitude (Cirrus/Altocumulus) --
            // Moves slower, larger scale, slightly more sparse
            vec2 driftHigh = vec2(uTime * 0.015, uTime * 0.0075);
            float nHigh = fbm((cloudUV + driftHigh) * 3.5);
            float alphaHigh = smoothstep(0.45 - densityOffset, 0.8 - densityOffset, nHigh) * horizonFade;
            
            if (alphaHigh > 0.0) {
                float nHigh_offset = fbm((cloudUV + driftHigh + sunDir2D * 0.04) * 3.5);
                float litEdgeHigh = smoothstep(0.1, -0.1, nHigh_offset - nHigh);
                vec3 cloudColorHigh = mix(shadowColor, brightEdgeColor, litEdgeHigh);
                float sunRimHigh = pow(sunIntensity, 16.0) * litEdgeHigh * stormDimming;
                cloudColorHigh += bottomColor * sunRimHigh * 1.5;
                // Mix high altitude layer first
                col = mix(col, cloudColorHigh, alphaHigh * 0.7);
            }

            // -- Layer 2: Low Altitude (Cumulus) --
            // Moves faster, normal scale
            vec2 driftLow = vec2(uTime * 0.03, uTime * 0.015);
            float nLow = fbm((cloudUV + driftLow) * 2.0);
            float alphaLow = smoothstep(0.4 - densityOffset, 0.75 - densityOffset, nLow) * horizonFade;
            
            if (alphaLow > 0.0) {
                float nLow_offset = fbm((cloudUV + driftLow + sunDir2D * 0.06) * 2.0);
                float litEdgeLow = smoothstep(0.1, -0.1, nLow_offset - nLow);
                vec3 cloudColorLow = mix(shadowColor, brightEdgeColor, litEdgeLow);
                float sunRimLow = pow(sunIntensity, 16.0) * litEdgeLow * stormDimming;
                cloudColorLow += bottomColor * sunRimLow * 2.0;
                // Mix low altitude layer on top
                col = mix(col, cloudColorLow, alphaLow * 0.9);
            }
        }

        // --- AURORA BOREALIS ---
        // Only renders when uAuroraIntensity > 0 (night + high latitude).
        // Hybrid: one wide sine wave gives the curtain sweep; an fBm brightness
        // mask breaks the uniform stripe look into organic patches of light.
        if (uAuroraIntensity > 0.001 && h > 0.0) {
            // Project onto the upper-sky dome using the xz plane
            vec2 auv = dir.xz / (h + 0.1);

            // Speed up the animation so the aurora visibly dances and pulses in real time
            float tSlow = uTime * 0.40;
            float tMed  = uTime * 0.80;

            // Organic UV warp: gives the curtains a natural flowing twist
            float warp = fbm(auv * 0.9 + vec2(tSlow * 0.6, tSlow * 0.35));

            // Primary curtain: reduced amplitude (0.25 not 0.5) so the troughs
            // stay at ~0.37 instead of 0 — no pure-black gaps between bands
            float sweep = sin((auv.x + warp * 1.4) * 2.2 + tMed * 0.45) * 0.25 + 0.62;

            // Second harmonic: very subtle, just adds organic variation
            float sweep2 = sin((auv.x + warp * 0.9) * 3.5 - tMed * 0.3 + 2.1) * 0.12 + 0.50;

            float curtain = sweep * 0.78 + sweep2 * 0.22;

            // fBm brightness mask: some curtain patches glow brighter, others dimmer
            float brightMask = fbm(auv * 1.8 + vec2(tSlow * 0.35, tMed * 0.25 + 0.6));
            curtain *= (brightMask * 1.2 + 0.4);

            // Low smoothstep floor so the dim inter-band areas still emit a faint glow
            curtain = smoothstep(0.08, 0.88, curtain);

            // Soft vertical fade: aurora blends to zero right at the horizon (h=0)
            float vFade = smoothstep(0.0, 0.15, h) * smoothstep(0.72, 0.30, h);

            // Compress the dynamic range: this makes low intensities (like 0.08) pop beautifully
            // without letting peak storms (1.0) blow out into a blinding neon light.
            float curvedIntensity = pow(uAuroraIntensity, 0.3);
            float auroraAlpha = curtain * vFade * curvedIntensity;

            // Three-band colour gradient: green core, teal edge, purple top
            vec3 auroraGreen  = vec3(0.05, 0.90, 0.45);
            vec3 auroraTeal   = vec3(0.0,  0.75, 0.70);
            vec3 auroraViolet = vec3(0.52, 0.15, 0.75);

            // Separate fBm layer controls which hue dominates in each patch
            float hueShift = fbm(auv * 1.8 + vec2(-tSlow * 0.4, tSlow * 0.8));
            vec3 auroraColor = mix(auroraGreen, auroraTeal,   smoothstep(0.35, 0.58, hueShift));
            auroraColor      = mix(auroraColor, auroraViolet, smoothstep(0.58, 0.82, hueShift));

            // Screen blend so the aurora brightens without crushing the star field
            // A gentle 0.45 multiplier keeps the peak storms vivid but incredibly chill
            vec3 auroraContrib = auroraColor * auroraAlpha * 0.45;
            col = col + auroraContrib * (vec3(1.0) - col);
        }

        gl_FragColor = vec4(col, 1.0);
    }
`;

// --- DYNAMIC ATMOSPHERE PALETTE GENERATOR ---
// Replaces the static ATMOSPHERE_PALETTES array

function generateDynamicPalette(rng) {
  // Helper to get random value between min and max using the seeded RNG
  const rand = (min, max) => min + rng() * (max - min);

  // --- ZENITH (Top Color) ---
  // Darker, deeper tones. We bias towards blues, purples, and deep slates.
  // HSL Hue in Three.js is 0.0 to 1.0 (0=Red, 0.33=Green, 0.66=Blue, 1.0=Red)
  // 0.5 to 0.85 covers Cyan -> Blue -> Purple -> Deep Pink
  const topHue = rand(0.5, 0.85);

  // Pick Top Names based on Top Hue
  let tNames;
  if (topHue < 0.6) {
    // Cyan/Teal
    tNames = ['Stormy', 'Deep', 'Slate'];
  } else if (topHue < 0.75) {
    // Core Blue
    tNames = ['Midnight', 'Abyssal', 'Deep', 'Abyss'];
  } else {
    // Purple/Indigo
    tNames = ['Twilight', 'Cosmic', 'Velvet', 'Starry'];
  }

  const topSat = rand(0.3, 0.7); // Medium saturation so it isn't blindingly neon
  const topLight = rand(0.1, 0.35); // Keep it dark and moody

  // --- HORIZON (Bottom Color) ---
  // Lighter, brighter tones (sunsets, sunrises, mist).
  let bottomHue;
  let bNames; // Name category for bottom
  const hueType = rng();

  if (hueType < 0.6) {
    // 60% chance: Warm sunset (Reds, Oranges, Yellows) -> 0.0 to 0.16
    bottomHue = rand(0.0, 0.16);
    bNames = ['Amber', 'Gold', 'Peach', 'Crimson', 'Coral'];
  } else if (hueType < 0.8) {
    // 20% chance: Dawn pastels (soft Pinks, Roses) -> 0.92 to 0.99
    bottomHue = rand(0.92, 0.99);
    bNames = ['Rose', 'Blush', 'Velvet', 'Dusty'];
  } else {
    // 20% chance: Icy/Clear morning (Light blues, cyans) -> 0.45 to 0.55
    bottomHue = rand(0.45, 0.55);
    bNames = ['Azure', 'Mist', 'Icy', 'Arctic', 'Slate'];
  }

  const bottomSat = rand(0.35, 0.65); // Moderate saturation for natural horizons
  const bottomLight = rand(0.55, 0.75); // Lighter than zenith but not washed out

  // Convert our procedural HSL values to a standard Three.js hex color
  const topColor = new THREE.Color().setHSL(topHue, topSat, topLight);
  const bottomColor = new THREE.Color().setHSL(
    bottomHue,
    bottomSat,
    bottomLight
  );

  // Use the RNG again to pick names from the narrowed categories
  const tName = tNames[Math.floor(rng() * tNames.length)];
  const bName = bNames[Math.floor(rng() * bNames.length)];

  return {
    name: `${tName} ${bName}`,
    top: topColor.getHex(),
    bottom: bottomColor.getHex(),
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
const sunMoonVertShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vObjectNormal;
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vObjectNormal = normal;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const sunFragShader = `
    uniform float uTime;
    uniform float overcast;
    uniform float dayFactor;
    uniform vec3 uSunColor;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    uniform sampler2D uNoiseTex;

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return texture2D(uNoiseTex, (i + u + 0.5) / 256.0).r;
    }

    float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(st);
            st *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        // Boiling surface
        vec2 uv = vUv * 5.0; // Larger features, less noisy
        uv.y += uTime * 0.05; // Slower movement
        float n = fbm(uv + fbm(uv + uTime * 0.1));
        
        vec3 color1 = uSunColor * 0.85; // Dynamic base color
        vec3 color2 = uSunColor;        // Dynamic hot spots
        vec3 baseColor = mix(color1, color2, n * 0.5 + 0.25); // Subtle blend
        
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        fresnel = pow(fresnel, 3.0);
        baseColor += vec3(1.0, 0.9, 0.7) * fresnel * 0.4; // Softer rim light
        
        // Fade based on overcast and dayFactor
        float alpha = clamp(1.0 - overcast, 0.0, 1.0);
        alpha *= clamp(dayFactor * 2.0, 0.0, 1.0);
        
        gl_FragColor = vec4(baseColor, alpha);
    }
`;

const moonFragShader = `
    uniform float uTime;
    uniform float overcast;
    uniform float dayFactor;
    uniform float moonPhase;
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vObjectNormal;

    vec2 random2(vec2 p) {
        return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
    }

    float voronoi(vec2 x) {
        vec2 n = floor(x);
        vec2 f = fract(x);
        float res = 8.0;
        for(int j=-1; j<=1; j++)
        for(int i=-1; i<=1; i++) {
            vec2 g = vec2(float(i),float(j));
            vec2 o = random2(n + g);
            o = 0.5 + 0.5*sin(uTime * 0.01 + 6.2831 * o);
            vec2 r = g + o - f;
            float d = dot(r,r);
            res = min(res, d);
        }
        return sqrt(res);
    }

    void main() {
        vec2 uv = vUv * 6.0;
        float v1 = voronoi(uv);
        float v2 = voronoi(uv * 2.0 + uTime * 0.004);
        float n = v1 * 0.7 + v2 * 0.3;
        
        vec3 baseCol = vec3(0.85, 0.85, 0.95);
        vec3 darkCol = vec3(0.8, 0.8, 0.9);
        vec3 color = mix(darkCol, baseCol, smoothstep(0.3, 0.7, n));
        
        vec3 normal = normalize(vNormal);
        vec3 objNormal = normalize(vObjectNormal);
        
        float phaseAngle = moonPhase * 6.283185307;
        vec3 lightDir = normalize(vec3(sin(phaseAngle), 0.0, cos(phaseAngle)));
        
        float illum = dot(objNormal, lightDir);
        float phaseMask = smoothstep(-0.05, 0.05, illum);
        
        // Earthshine is basically invisible, just a tiny bit of opacity
        float baseAlpha = mix(0.02, 1.0, phaseMask);
        
        // Fresnel rim glow only on the lit portion
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
        fresnel = pow(fresnel, 3.0);
        color += vec3(0.95, 0.95, 1.0) * fresnel * 0.15 * phaseMask;
        
        // Final alpha includes the phase mask (so the dark side is transparent)
        float alpha = baseAlpha * clamp(1.0 - overcast, 0.0, 1.0);
        
        gl_FragColor = vec4(color, alpha);
    }
`;

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

const sunGlowVertShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        mat4 modelView = modelViewMatrix;
        
        // Extract scale from modelViewMatrix to preserve scaling
        float scaleX = length(vec3(modelView[0].x, modelView[0].y, modelView[0].z));
        float scaleY = length(vec3(modelView[1].x, modelView[1].y, modelView[1].z));
        float scaleZ = length(vec3(modelView[2].x, modelView[2].y, modelView[2].z));

        // Spherical billboarding
        modelView[0][0] = scaleX; modelView[0][1] = 0.0; modelView[0][2] = 0.0;
        modelView[1][0] = 0.0; modelView[1][1] = scaleY; modelView[1][2] = 0.0;
        modelView[2][0] = 0.0; modelView[2][1] = 0.0; modelView[2][2] = scaleZ;
        
        gl_Position = projectionMatrix * modelView * vec4(position, 1.0);
    }
`;

const sunGlowFragShader = `
    uniform float overcast;
    uniform float dayFactor;
    uniform vec3 uSunColor;
    varying vec2 vUv;

    void main() {
        float dist = distance(vUv, vec2(0.5));
        
        // Smooth, gentle falloff
        float alpha = pow(max(0.0, 1.0 - (dist * 2.0)), 2.5);
        
        // Use purely the natural sun color, no artificial white core
        vec3 color = uSunColor;
        
        // Very slight intensity boost
        color *= (1.0 + alpha * 0.2);
        
        // Lower overall opacity for maximum subtlety
        alpha *= 0.35;
        
        alpha *= clamp(1.0 - overcast, 0.0, 1.0);
        alpha *= clamp(dayFactor * 2.0, 0.0, 1.0);
        
        gl_FragColor = vec4(color, alpha);
    }
`;

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
