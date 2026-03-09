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
    varying vec3 vWorldPosition;
    void main() {
        vec3 dir = normalize(vWorldPosition + offset);
        float h = dir.y;
        
        // Calculate sun influence (0 to 1) based on direction
        float sunIntensity = max(0.0, dot(dir, sunDirection));
        float glow = pow(sunIntensity, glowPower);
        
        // Mute the bottom color when away from the sun
        // When away, the horizon looks more like the topColor or a neutral fade
        vec3 effectiveBottom = mix(topColor * 0.8, bottomColor, glow * mieFactor + (1.0 - mieFactor));
        
        // Base vertical gradient using the potentially muted bottom color
        vec3 col = mix(effectiveBottom, topColor, max(pow(max(h, 0.0), exponent), 0.0));
        
        // Additional sun glow boost
        col += bottomColor * glow * 0.5 * (1.0 - h);
        
        gl_FragColor = vec4(col, 1.0);
    }
`;

// --- ATMOSPHERE PALETTES ---
const ATMOSPHERE_PALETTES = [
    { name: "Classic Blue", top: 0x0077ff, bottom: 0xffffff },
    { name: "Golden Hour", top: 0x1e3c72, bottom: 0xffa500 },
    { name: "Cotton Candy", top: 0x4facfe, bottom: 0xf5b7b1 },
    { name: "Deep Dusk", top: 0x0f0c29, bottom: 0xec008c },
    { name: "Arctic Mist", top: 0x89f7fe, bottom: 0x66a6ff },
    { name: "Emerald Dream", top: 0x134e5e, bottom: 0x71b280 },
    { name: "Desert Haze", top: 0xe9d362, bottom: 0x333333 }
];

const _paletteRng = ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED + 99);
const selectedPalette = ATMOSPHERE_PALETTES[Math.floor(_paletteRng() * ATMOSPHERE_PALETTES.length)];

console.log(`Atmosphere Palette: ${selectedPalette.name}`);

const skyUniforms = {
    topColor: { value: new THREE.Color(selectedPalette.top) },
    bottomColor: { value: new THREE.Color(selectedPalette.bottom) },
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    offset: { value: 33 },
    exponent: { value: 0.6 },
    glowPower: { value: 2.0 },  // Higher = more concentrated sunset
    mieFactor: { value: 0.9 }   // Higher = more aggressive muting away from sun
};

const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false, // Don't block stars/celestials
    fog: false
});

scene.fog.color.set(selectedPalette.bottom);


const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemiLight.position.set(0, 500, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff0dd, 0.8);
scene.add(dirLight);

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
const skySphereGeo = new THREE.SphereGeometry(9500, 32, 12);
const skySphereMesh = new THREE.Mesh(skySphereGeo, skyMat);
skyGroup.add(skySphereMesh);

// Sun
const sunGeo = new THREE.SphereGeometry(400, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffddaa, fog: false });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
skyGroup.add(sunMesh);

// Moon
const moonGeo = new THREE.SphereGeometry(240, 32, 32);
const moonMat = new THREE.MeshBasicMaterial({ color: 0xddddff, fog: false });
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
    const r = 7000 + _starsRng() * 2000;
    starsPos[i] = r * Math.sin(phi) * Math.cos(theta);
    starsPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    starsPos[i + 2] = r * Math.cos(phi);
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 20, sizeAttenuation: true, fog: false, transparent: true });
const starsMesh = new THREE.Points(starsGeo, starsMat);
skyGroup.add(starsMesh);
