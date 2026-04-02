// --- SCENE, CAMERA, RENDERER, LIGHTS, SKY ---
// Dependencies: THREE (CDN)

const scene = new THREE.Scene();
// Background will be handled by a Skysphere shader
scene.fog = new THREE.FogExp2(0xa0d8ef, 0.00005);

// --- SKY SHADER MATERIAL ---
const skyVertexShader = `
    varying vec3 vWorldPosition;
    void main() {
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
    varying vec3 vWorldPosition;

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
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
        vec3 dir = normalize(vWorldPosition + offset);
        float h = dir.y;
        
        // Calculate sun influence (0 to 1) based on direction
        float sunIntensity = max(0.0, dot(dir, sunDirection));
        
        // Base glow used for the general atmospheric scattering (horizon muting)
        float glow = pow(sunIntensity, glowPower);
        
        // Tighter highlight specifically for the intense sun bloom
        float sunHighlight = pow(sunIntensity, glowPower * 4.0);
        
        // Mute the bottom color when away from the sun
        // When away, the horizon looks more like the topColor or a neutral fade
        vec3 effectiveBottom = mix(topColor * 0.8, bottomColor, glow * mieFactor + (1.0 - mieFactor));
        
        // Base vertical gradient using the potentially muted bottom color
        vec3 col = mix(effectiveBottom, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        
        // Additional sun glow boost
        // We use a screen blend with the tighter sun highlight to warmly brighten the sky
        // without harsh clamping to white, preserving the palette's beautiful colors.
        vec3 glowColor = bottomColor * sunHighlight * 0.8 * (1.0 - h);
        col = col + glowColor * (vec3(1.0) - col); // Screen blend
        
        // Procedural Clouds: Expensive 4-octave fBm loop is skipped on Low graphics
        if (uShowClouds && h > 0.0) {
            vec2 cloudUV = dir.xz / (h + 0.05);
            vec2 drift = vec2(uTime * 0.1, 0.0);
            
            float n = fbm((cloudUV + drift) * 2.5);
            
            float densityOffset = (uCloudDensity - 0.5) * 0.4;
            float cloudAlpha = smoothstep(0.4 - densityOffset, 0.7 - densityOffset, n);
            
            cloudAlpha *= smoothstep(0.0, 0.15, h); // fade at horizon
            
            float cloudSunGlow = pow(sunIntensity, 2.0);
            vec3 cloudBaseColor = mix(topColor * 1.2, bottomColor * 1.5, cloudSunGlow * (1.0 - h));
            vec3 cloudColor = mix(cloudBaseColor, bottomColor * 2.0, sunHighlight * 0.8);
            
            col = mix(col, cloudColor, cloudAlpha * 0.9);
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
        tNames = ["Stormy", "Deep", "Slate"];
    } else if (topHue < 0.75) {
        // Core Blue
        tNames = ["Midnight", "Abyssal", "Deep", "Abyss"];
    } else {
        // Purple/Indigo
        tNames = ["Twilight", "Cosmic", "Velvet", "Starry"];
    }

    const topSat = rand(0.3, 0.7);   // Medium saturation so it isn't blindingly neon
    const topLight = rand(0.1, 0.35); // Keep it dark and moody

    // --- HORIZON (Bottom Color) ---
    // Lighter, brighter tones (sunsets, sunrises, mist).
    let bottomHue;
    let bNames; // Name category for bottom
    const hueType = rng();

    if (hueType < 0.6) {
        // 60% chance: Warm sunset (Reds, Oranges, Yellows) -> 0.0 to 0.16
        bottomHue = rand(0.0, 0.16);
        bNames = ["Amber", "Gold", "Peach", "Crimson", "Coral"];
    } else if (hueType < 0.8) {
        // 20% chance: Dawn pastels (soft Pinks, Roses) -> 0.92 to 0.99
        bottomHue = rand(0.92, 0.99);
        bNames = ["Rose", "Blush", "Velvet", "Dusty"];
    } else {
        // 20% chance: Icy/Clear morning (Light blues, cyans) -> 0.45 to 0.55
        bottomHue = rand(0.45, 0.55);
        bNames = ["Azure", "Mist", "Icy", "Arctic", "Slate"];
    }
    
    const bottomSat = rand(0.35, 0.65);  // Moderate saturation for natural horizons
    const bottomLight = rand(0.55, 0.75); // Lighter than zenith but not washed out

    // Convert our procedural HSL values to a standard Three.js hex color
    const topColor = new THREE.Color().setHSL(topHue, topSat, topLight);
    const bottomColor = new THREE.Color().setHSL(bottomHue, bottomSat, bottomLight);

    // Use the RNG again to pick names from the narrowed categories
    const tName = tNames[Math.floor(rng() * tNames.length)];
    const bName = bNames[Math.floor(rng() * bNames.length)];

    return {
        name: `${tName} ${bName}`,
        top: topColor.getHex(),
        bottom: bottomColor.getHex()
    };
}

// Standard parameters are handled by ChillFlightLogic
let selectedPalette;
let currentPaletteCycle = -1;
let isCustomPalette = false;

function applyCustomSkyColors(top, bottom) {
    isCustomPalette = true;

    // Convert hex string (from picker) or number to hex if needed
    const topHex = typeof top === 'string' ? parseInt(top.replace('#', ''), 16) : top;
    const bottomHex = typeof bottom === 'string' ? parseInt(bottom.replace('#', ''), 16) : bottom;

    selectedPalette = {
        name: "Custom",
        top: topHex,
        bottom: bottomHex
    };

    if (typeof skyUniforms !== 'undefined') {
        skyUniforms.topColor.value.setHex(selectedPalette.top);
        skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);
    }

    window.dispatchEvent(new CustomEvent('paletteChanged', { detail: selectedPalette }));
}

function updateSkyPalette(serverNow) {
    if (isCustomPalette) return;

    const CYCLE_DURATION_MS = 300000;
    const cycleNumber = Math.floor(serverNow / CYCLE_DURATION_MS);

    if (cycleNumber !== currentPaletteCycle) {
        const isFirstLoad = (currentPaletteCycle === -1);
        currentPaletteCycle = cycleNumber;

        let rng;
        if (isFirstLoad && ChillFlightLogic.PALETTE_INDEX !== null && !isNaN(parseInt(ChillFlightLogic.PALETTE_INDEX))) {
            // If a user forces a specific palette index via URL, we use it as the RNG seed 
            // so they get a deterministic custom palette.
            const paletteIndex = parseInt(ChillFlightLogic.PALETTE_INDEX);
            rng = ChillFlightLogic.mulberry32(paletteIndex);
        } else {
            // Seed the RNG with the world seed plus the cycle number,
            // so every cycle (in-game day) gets a synchronized random palette across the server.
            rng = ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED + cycleNumber);
        }

        // Generate the colors!
        selectedPalette = generateDynamicPalette(rng);

        console.log(`Atmosphere Palette Updated (Cycle ${cycleNumber}): ${selectedPalette.name}`);

        // If uniforms already exist, update them
        if (typeof skyUniforms !== 'undefined') {
            skyUniforms.topColor.value.setHex(selectedPalette.top);
            skyUniforms.bottomColor.value.setHex(selectedPalette.bottom);
        }

        // Dispatch an event so game.js can recalculate derived gradient colors
        window.dispatchEvent(new CustomEvent('paletteChanged', { detail: selectedPalette }));
    }
}

// Initial object creation with dummy values; updateSkyPalette will populate them
const skyUniforms = {
    topColor: { value: new THREE.Color() },
    bottomColor: { value: new THREE.Color() },
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    offset: { value: 33 },
    exponent: { value: 0.6 },
    glowPower: { value: 2.0 },  // Higher = more concentrated sunset
    mieFactor: { value: 0.9 },   // Higher = more aggressive muting away from sun
    uTime: { value: 0.0 }, // ADDED
    uCloudDensity: { value: 0.5 }, // ADDED
    uShowClouds: { value: true }
};

// Initial calculation
updateSkyPalette(Date.now() + (window.serverTimeOffset || 0));

const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false, // Don't block stars/celestials
    fog: false
});

scene.fog.color.set(selectedPalette.bottom);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 30000);

// Antialiasing is expensive; disable it on the 'Low' preset (SEGMENTS <= 20) to prioritize performance.
// Since AA belongs to the WebGL context, this won't change until the next page load.
const _initQuality = localStorage.getItem('chill_flight_quality');
const _isLowQuality = _initQuality && parseInt(_initQuality) <= 20;

// Update uniforms for initial load
skyUniforms.uShowClouds.value = ChillFlightLogic.SHOW_CLOUDS && !_isLowQuality;

const renderer = new THREE.WebGLRenderer({ antialias: !_isLowQuality });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(_isLowQuality ? 1 : Math.min(window.devicePixelRatio, 2));
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
dirLight.shadow.camera.far = 8000;      // Increased so distant shadows aren't clipped
dirLight.shadow.camera.left = -2048;    // Massively expanded coverage
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
let daySpeedMultiplier = 1;

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
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
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

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
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
        
        // Fresnel rim glow
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
            o = 0.5 + 0.5*sin(uTime*0.05 + 6.2831*o);
            vec2 r = g + o - f;
            float d = dot(r,r);
            res = min(res, d);
        }
        return sqrt(res);
    }

    void main() {
        vec2 uv = vUv * 6.0;
        float v1 = voronoi(uv);
        float v2 = voronoi(uv * 2.0 + uTime * 0.02);
        float n = v1 * 0.7 + v2 * 0.3;
        
        vec3 baseCol = vec3(0.85, 0.85, 0.95);
        vec3 darkCol = vec3(0.8, 0.8, 0.9);
        vec3 color = mix(darkCol, baseCol, smoothstep(0.3, 0.7, n));
        
        vec3 normal = normalize(vNormal);
        float phaseAngle = moonPhase * 6.283185307;
        vec3 lightDir = normalize(vec3(sin(phaseAngle), 0.0, cos(phaseAngle)));
        
        float illum = dot(normal, lightDir);
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
    uTime: { value: 0.0 },
    overcast: { value: 0.0 },
    dayFactor: { value: 1.0 },
    uSunColor: { value: new THREE.Color(0xffffff) }
};

const moonUniforms = {
    uTime: { value: 0.0 },
    overcast: { value: 0.0 },
    dayFactor: { value: 1.0 },
    moonPhase: { value: 0.0 }
};

// Sun
const sunGeo = new THREE.SphereGeometry(400, 32, 32);
const sunMat = new THREE.ShaderMaterial({
    vertexShader: sunMoonVertShader,
    fragmentShader: sunFragShader,
    uniforms: sunUniforms,
    transparent: true,
    fog: false
});
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
skyGroup.add(sunMesh);

// Moon
const moonGeo = new THREE.SphereGeometry(240, 32, 32);
const moonMat = new THREE.ShaderMaterial({
    vertexShader: sunMoonVertShader,
    fragmentShader: moonFragShader,
    uniforms: moonUniforms,
    transparent: true,
    fog: false
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
const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 20, sizeAttenuation: true, fog: false, transparent: true });
const starsMesh = new THREE.Points(starsGeo, starsMat);
skyGroup.add(starsMesh);
