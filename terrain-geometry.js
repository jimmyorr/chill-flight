// --- PROCEDURAL TERRAIN & CHUNKS ---
var yAxis = new THREE.Vector3(0, 1, 0);
// Dependencies: THREE, simplex, CHUNK_SIZE, SEGMENTS, WATER_LEVEL, MOUNTAIN_LEVEL, scene

var chunks = new Map();
// Registry of active terrain chunks that contain animated watercraft (sailboats, pirate ships).
// Allows animate() in game.js to skip iterating dozens of dry land chunks every frame.
var watercraftChunks = new Set();
window.watercraftChunks = watercraftChunks;
var birdChunks = new Set();
window.birdChunks = birdChunks;
var _terrainGeometryPool = [];
var _waterGeometryPool = [];
window._terrainGeometryPool = _terrainGeometryPool;
window._waterGeometryPool = _waterGeometryPool;

var _instancedMeshPool = new Map();

function getInstancedMesh(geometry, material, count) {
  const key =
    geometry.uuid +
    '_' +
    (Array.isArray(material)
      ? material.map((m) => m.uuid).join()
      : material.uuid);

  if (!_instancedMeshPool.has(key)) {
    _instancedMeshPool.set(key, []);
  }
  const pool = _instancedMeshPool.get(key);

  // Find a pooled mesh with sufficient capacity
  for (let i = pool.length - 1; i >= 0; i--) {
    if (pool[i].instanceMatrix.count >= count) {
      const mesh = pool.splice(i, 1)[0];
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      return mesh;
    }
  }

  // Allocate with extra capacity to prevent frequent resizing
  const allocCount = Math.max(count, 16);
  const mesh = new THREE.InstancedMesh(geometry, material, allocCount);
  mesh.frustumCulled = false;
  mesh.count = count;
  return mesh;
}

function releaseInstancedMesh(mesh) {
  if (!mesh.geometry || !mesh.material) {
    if (mesh.dispose) mesh.dispose();
    return;
  }
  const key =
    mesh.geometry.uuid +
    '_' +
    (Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.uuid).join()
      : mesh.material.uuid);
  if (!_instancedMeshPool.has(key)) {
    _instancedMeshPool.set(key, []);
  }

  mesh.userData = {};
  if (mesh.parent) mesh.parent.remove(mesh);

  const pool = _instancedMeshPool.get(key);
  if (!pool.includes(mesh)) {
    pool.push(mesh);
  }
}

var chunkQueue = [];
var chunkQueueSet = new Set();

window.clearChunkQueue = function () {
  chunkQueue = [];
  chunkQueueSet.clear();
};

// GPU water uniform — shared globally so game.js animate() can update uTime
window.waterUniforms = {
  uTime: {value: 0.0},
  uSpecularDir: {value: new THREE.Vector3(0, 1, 0)},
  uSunColor: {value: new THREE.Color(0xffffff)},
};

var _initPresetForTerrain =
  (typeof ChillFlightLogic !== 'undefined' &&
    ChillFlightLogic.GRAPHICS_PRESET) ||
  localStorage.getItem('chill_flight_graphics_preset');
var _legacyQualityForTerrain = localStorage.getItem('chill_flight_quality');
var _isLowQualityInitial =
  _initPresetForTerrain === 'low' ||
  (!_initPresetForTerrain &&
    _legacyQualityForTerrain &&
    parseInt(_legacyQualityForTerrain) <= 20);

var _enableObjects = ChillFlightLogic.SHOW_OBJECTS;
// Flag removed to fix issue #25

// Volcano center — single source of truth for all coloring and landmark placement
var VOLCANO_X = -5000;
var VOLCANO_Z = 5000;

// Materials for terrain
var terrainMaterial = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.8,
});

var waterMaterial = createMaterial({
  vertexColors: true,
  transparent: !_isLowQualityInitial,
  opacity: _isLowQualityInitial ? 1.0 : 0.85,
  metalness: 0.1,
  roughness: 0.05,
  flatShading: true,
  depthWrite: false,
});

window.terrainUniforms = {
  uCameraPosXZ: {value: new THREE.Vector2(0, 0)},
  uRenderRadius: {value: RENDER_DISTANCE * CHUNK_SIZE},
  uSunDirection: {value: new THREE.Vector3(0, 1, 0)},
  uTopColor: {value: new THREE.Color()},
  uBottomColor: {value: new THREE.Color()},
};

terrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uCameraPosXZ = window.terrainUniforms.uCameraPosXZ;
  shader.uniforms.uRenderRadius = window.terrainUniforms.uRenderRadius;
  shader.uniforms.uSunDirection = window.terrainUniforms.uSunDirection;
  shader.uniforms.uTopColor = window.terrainUniforms.uTopColor;
  shader.uniforms.uBottomColor = window.terrainUniforms.uBottomColor;

  shader.vertexShader =
    `
    uniform vec2 uCameraPosXZ;
    uniform float uRenderRadius;
    varying float vDistanceXZ;
    varying vec3 vWorldPosition;
  ` + shader.vertexShader;

  shader.vertexShader = shader.vertexShader.replace(
    `#include <worldpos_vertex>`,
    `#include <worldpos_vertex>
     vec4 customWorldPosition = modelMatrix * vec4( transformed, 1.0 );
     vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);
     vWorldPosition = customWorldPosition.xyz;`
  );

  shader.fragmentShader =
    `
    uniform float uRenderRadius;
    varying float vDistanceXZ;
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    varying vec3 vWorldPosition;
  ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `
     #ifdef USE_FOG
       vec3 viewDirFog = normalize(vWorldPosition - cameraPosition);
       vec3 skyDir = normalize(viewDirFog + vec3(0.0, 33.0 / 10000.0, 0.0));
       float hFog = skyDir.y;
       float baseSunInt = max(0.0, dot(skyDir, uSunDirection));
       float sunFade = smoothstep(-0.25, 0.0, uSunDirection.y);
       float g = pow(baseSunInt * sunFade, 2.0);
       vec3 effBottom = uBottomColor;
       vec3 fogSkyColor = mix(effBottom, uTopColor, max(pow(max(hFog, 0.0), 0.6), 0.0));
       if (hFog < 0.0) fogSkyColor = effBottom;
       
       float sunElev = uSunDirection.y;
       float horizonExtinction = smoothstep(-0.01, 0.12, sunElev);
       vec3 wideGlow = uBottomColor * pow(baseSunInt, 6.0) * 0.6 * (1.0 - max(hFog, 0.0));
       vec3 ambientSunGlow = wideGlow * sunFade;
       float haloFade = smoothstep(-0.03, 0.06, sunElev);
       vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunInt, 24.0) * 0.8 * haloFade;
       vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
       float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunElev);
       vec3 hotCore = coreColor * pow(baseSunInt, 512.0) * coreStrength;
       vec3 totalGlow = (ambientSunGlow + warmHalo + hotCore) * smoothstep(-0.12, 0.04, hFog);
       fogSkyColor = fogSkyColor + totalGlow * (vec3(1.0) - fogSkyColor);
       
       #ifdef FOG_EXP2
           float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
       #else
           float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
       #endif
       
       float distRatio = vDistanceXZ / uRenderRadius;
       float xzFogFactor = smoothstep(0.75, 0.95, distRatio);
       
       float finalFogFactor = max(fogFactor, xzFogFactor);
       
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
     #endif
    `
  );
};

// Inject GPU wave math into the water material's vertex shader.
// This replaces the CPU-side per-vertex loop and computeVertexNormals().
waterMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = window.waterUniforms.uTime;
  shader.uniforms.uCameraPosXZ = window.terrainUniforms.uCameraPosXZ;
  shader.uniforms.uRenderRadius = window.terrainUniforms.uRenderRadius;

  shader.uniforms.uSunDirection = window.terrainUniforms.uSunDirection;
  shader.uniforms.uSpecularDir = window.waterUniforms.uSpecularDir;
  shader.uniforms.uSunColor = window.waterUniforms.uSunColor;
  shader.uniforms.uTopColor = window.terrainUniforms.uTopColor;
  shader.uniforms.uBottomColor = window.terrainUniforms.uBottomColor;

  // Add time uniform declaration to the top of the vertex shader
  shader.vertexShader =
    `
        attribute float aWaterDepth;
        varying float vWaterDepth;
        uniform vec2 uCameraPosXZ;
        uniform float uRenderRadius;
        varying float vDistanceXZ;
        uniform float uTime;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
    ` + shader.vertexShader;

  // Inject analytical normal calculation (replaces computeVertexNormals)
  shader.vertexShader = shader.vertexShader.replace(
    `#include <beginnormal_vertex>`,
    `
        // Get world position for seamless tiling across chunks
        vec4 worldPosN = modelMatrix * vec4(position, 1.0);

        float macroWaveN = sin(worldPosN.x * 0.0002) * cos(worldPosN.z * 0.00025);
        float waveAmpN = 0.8 + macroWaveN * 0.4;

        // Analytical derivatives of the wave functions for correct lighting
        float dx = waveAmpN * 0.02 * cos(uTime + worldPosN.x * 0.02);
        float dz = -waveAmpN * 0.015 * sin(uTime * 0.8 + worldPosN.z * 0.015);

        // Perpendicular vector for light reflection
        vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
        vSmoothNormal = normalize(mat3(modelMatrix) * objectNormal);
        `
  );

  // Inject wave height displacement (replaces the CPU position array modification)
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    `
        vWaterDepth = aWaterDepth;
        vec3 transformed = vec3(position);
        vec4 worldPosV = modelMatrix * vec4(position, 1.0);

        float macroWave = sin(worldPosV.x * 0.0002) * cos(worldPosV.z * 0.00025);
        float waveAmp = 0.8 + macroWave * 0.4;

        // Wave math running in parallel on the GPU
        float wave1 = sin(uTime + worldPosV.x * 0.02) * waveAmp;
        float wave2 = cos(uTime * 0.8 + worldPosV.z * 0.015) * waveAmp;

        transformed.y += wave1 + wave2;
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vDistanceXZ = length(vWorldPosition.xz - uCameraPosXZ);
        `
  );

  shader.fragmentShader =
    `
        varying float vWaterDepth;
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uSpecularDir;
        uniform vec3 uSunColor;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
        uniform float uRenderRadius;
        varying float vDistanceXZ;
    ` + shader.fragmentShader;

  // Inject custom specular
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <dithering_fragment>`,
    `
        #include <dithering_fragment>

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 sunReflNormal = normalize(vSmoothNormal);
        
        // Fade opacity near shore based on water depth
        float depthOpacity = smoothstep(0.0, 4.0, vWaterDepth);
        gl_FragColor.a *= depthOpacity;
        
        // Add macro-scale spatial variation to break up monotony across different water bodies
        float macro = sin(vWorldPosition.x * 0.0002) * cos(vWorldPosition.z * 0.00025);
        float rippleScale = 0.1 + macro * 0.05; // 0.05 to 0.15
        float timeScale = 1.5 + macro * 0.5; // 1.0 to 2.0
        float perturbStrength = 0.05 + macro * 0.03; // 0.02 to 0.08
        
        // Distance fade for high-frequency normal perturbations to reduce aliasing
        float distanceFade = smoothstep(1500.0, 0.0, vDistanceXZ);
        perturbStrength *= distanceFade;
        
        // Organic high-frequency ripples for shimmering specular
        vec2 pos = vWorldPosition.xz * rippleScale; // Scale of ripples
        float t = uTime * timeScale;
        
        // 3 non-axis-aligned waves to break the grid interference pattern
        float dx = sin(dot(pos, vec2(0.8, 0.6)) + t) * 0.8
                 + sin(dot(pos, vec2(-0.6, 0.8)) + t * 1.3) * -0.6
                 + sin(dot(pos, vec2(0.9, -0.4)) + t * 0.7) * 0.9;
                 
        float dz = sin(dot(pos, vec2(0.8, 0.6)) + t) * 0.6
                 + sin(dot(pos, vec2(-0.6, 0.8)) + t * 1.3) * 0.8
                 + sin(dot(pos, vec2(0.9, -0.4)) + t * 0.7) * -0.4;
        
        vec3 rippleNormal = vec3(dx * perturbStrength, 0.0, dz * perturbStrength); // Perturbation strength
        
        sunReflNormal = normalize(sunReflNormal + rippleNormal);

        vec3 halfVector = normalize(uSpecularDir + viewDir);
        float dotNormalHalf = max(dot(sunReflNormal, halfVector), 0.0);
        
        // Specular intensity
        float specularIntensity = pow(dotNormalHalf, 200.0); // Softer, broader organic glints
        float fresnel = 1.0 - max(dot(viewDir, sunReflNormal), 0.0);
        fresnel = pow(fresnel, 3.0);
        
        // Tone down spec during overcast/night
        float lightIntensity = max(0.1, length(uSunColor));
        specularIntensity *= lightIntensity;
        
        gl_FragColor.rgb += uSunColor * specularIntensity * (0.3 + fresnel * 0.7);
        `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `
     #ifdef USE_FOG
       vec3 viewDirFog = normalize(vWorldPosition - cameraPosition);
       vec3 skyDir = normalize(viewDirFog + vec3(0.0, 33.0 / 10000.0, 0.0));
       float hFog = skyDir.y;
       float baseSunInt = max(0.0, dot(skyDir, uSunDirection));
       float sunFade = smoothstep(-0.25, 0.0, uSunDirection.y);
       float g = pow(baseSunInt * sunFade, 2.0);
       vec3 effBottom = uBottomColor;
       vec3 fogSkyColor = mix(effBottom, uTopColor, max(pow(max(hFog, 0.0), 0.6), 0.0));
       if (hFog < 0.0) fogSkyColor = effBottom;
       
       float sunElev = uSunDirection.y;
       float horizonExtinction = smoothstep(-0.01, 0.12, sunElev);
       vec3 wideGlow = uBottomColor * pow(baseSunInt, 6.0) * 0.6 * (1.0 - max(hFog, 0.0));
       vec3 ambientSunGlow = wideGlow * sunFade;
       float haloFade = smoothstep(-0.03, 0.06, sunElev);
       vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunInt, 24.0) * 0.8 * haloFade;
       vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
       float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunElev);
       vec3 hotCore = coreColor * pow(baseSunInt, 512.0) * coreStrength;
       vec3 totalGlow = (ambientSunGlow + warmHalo + hotCore) * smoothstep(-0.12, 0.04, hFog);
       fogSkyColor = fogSkyColor + totalGlow * (vec3(1.0) - fogSkyColor);
       
       #ifdef FOG_EXP2
           float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
       #else
           float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
       #endif
       
       float distRatio = vDistanceXZ / uRenderRadius;
       float xzFogFactor = smoothstep(0.75, 0.95, distRatio);
       
       float finalFogFactor = max(fogFactor, xzFogFactor);
       
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
     #endif
    `
  );
};

// Reusable tree geometries for forest instances
var treeTrunkGeo = new THREE.CylinderGeometry(1.5, 2.5, 14, 6);
treeTrunkGeo.translate(0, 7, 0);

function createPineGeometry() {
  // 4 overlapping conical tiers — each sinks into the one below so no gaps show.
  // Widest at the bottom, narrowest at the top, giving a classic conifer silhouette.
  const segs = 6;
  const c1 = new THREE.ConeGeometry(10, 12, segs);
  c1.translate(0, 14, 0); // base of bottom tier sits at y=8
  const c2 = new THREE.ConeGeometry(8, 11, segs);
  c2.translate(0, 19, 0); // overlaps ~3 units into c1
  const c3 = new THREE.ConeGeometry(6, 10, segs);
  c3.translate(0, 24, 0); // overlaps ~3 units into c2
  const c4 = new THREE.ConeGeometry(3.5, 8, segs);
  c4.translate(0, 28.5, 0); // top spire

  const geometries = [c1, c2, c3, c4];
  const pos = [],
    norm = [],
    uvs = [],
    idx = [];
  let offset = 0;

  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    if (g.attributes.uv) uvs.push(...g.attributes.uv.array);
    for (let i = 0; i < g.index.array.length; i++) {
      idx.push(g.index.array[i] + offset);
    }
    offset += g.attributes.position.count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uvs.length > 0)
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(idx);
  return geom;
}
var treeLeavesGeo = createPineGeometry();

function createDeciduousGeometry() {
  const trunk = new THREE.CylinderGeometry(1.2, 1.8, 12, 6);
  trunk.translate(0, 6, 0);

  // 5 overlapping spheres form a full, round canopy
  const leaf1 = new THREE.SphereGeometry(6, 7, 5); // Main center mass
  leaf1.translate(0, 14, 0);
  const leaf2 = new THREE.SphereGeometry(4.5, 7, 5); // Lower-right cluster
  leaf2.translate(3.5, 11, 2.5);
  const leaf3 = new THREE.SphereGeometry(4.5, 7, 5); // Lower-left cluster
  leaf3.translate(-3.5, 11, -2.5);
  const leaf4 = new THREE.SphereGeometry(4, 7, 5); // Back fill
  leaf4.translate(-1, 12, 3.5);
  const leaf5 = new THREE.SphereGeometry(3.5, 7, 5); // Top crown
  leaf5.translate(0.5, 17, -0.5);

  const geometries = [leaf1, leaf2, leaf3, leaf4, leaf5];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;

  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return {trunk, leaves: geom};
}
var deciduousGeos = createDeciduousGeometry();

function createTallDeciduousGeometry() {
  const trunk = new THREE.CylinderGeometry(1.5, 2.2, 16, 6);
  trunk.translate(0, 8, 0);

  // Tall canopy, vase/oval shape
  const leaf1 = new THREE.SphereGeometry(6, 7, 5); // Main lower mass
  leaf1.scale(1, 1.2, 1);
  leaf1.translate(0, 16, 0);

  const leaf2 = new THREE.SphereGeometry(5.5, 7, 5); // Mid mass
  leaf2.scale(1, 1.3, 1);
  leaf2.translate(0, 22, 0);

  const leaf3 = new THREE.SphereGeometry(4.5, 7, 5); // Top crown
  leaf3.scale(1, 1.2, 1);
  leaf3.translate(0, 28, 0);

  const leaf4 = new THREE.SphereGeometry(4, 7, 5); // Side cluster 1
  leaf4.scale(1, 1.1, 1);
  leaf4.translate(3.5, 18, 2);

  const leaf5 = new THREE.SphereGeometry(4, 7, 5); // Side cluster 2
  leaf5.scale(1, 1.1, 1);
  leaf5.translate(-3.5, 19, -2);

  const geometries = [leaf1, leaf2, leaf3, leaf4, leaf5];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;

  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return {trunk, leaves: geom};
}
var tallDeciduousGeos = createTallDeciduousGeometry();

function createJapaneseMapleGeometry() {
  const trunk = new THREE.CylinderGeometry(0.8, 1.4, 11, 6);
  trunk.translate(0, 5.5, 0);

  // Cloud-pruned Niwaki canopy — gently squashed spheres at staggered heights
  const segs = 7;
  const hSegs = 5;

  // Main central canopy pad
  const leaf1 = new THREE.SphereGeometry(4.5, segs, hSegs);
  leaf1.scale(1.4, 0.6, 1.4);
  leaf1.translate(0, 12, 0);

  // Lower side pads — asymmetric placement for organic feel
  const leaf2 = new THREE.SphereGeometry(3.5, segs, hSegs);
  leaf2.scale(1.3, 0.6, 1.3);
  leaf2.translate(4, 10, 2);

  const leaf3 = new THREE.SphereGeometry(3.5, segs, hSegs);
  leaf3.scale(1.3, 0.6, 1.3);
  leaf3.translate(-4, 10.5, -2);

  // Upper crown pad — slightly offset
  const leaf4 = new THREE.SphereGeometry(3, segs, hSegs);
  leaf4.scale(1.2, 0.6, 1.2);
  leaf4.translate(1, 14, -1.5);

  // Small accent pad — rear fill
  const leaf5 = new THREE.SphereGeometry(2.5, segs, hSegs);
  leaf5.scale(1.2, 0.55, 1.2);
  leaf5.translate(-2, 11, 3);

  // Drooping lower accent
  const leaf6 = new THREE.SphereGeometry(2, segs, hSegs);
  leaf6.scale(1.3, 0.55, 1.3);
  leaf6.translate(2.5, 8.5, -3);

  const geometries = [leaf1, leaf2, leaf3, leaf4, leaf5, leaf6];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;

  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return {trunk, leaves: geom};
}
var japaneseMapleGeos = createJapaneseMapleGeometry();

function createPalmGeometry() {
  // Stacked, flared trunk segments to create a bumpy, ridged bark texture
  const trunkSegments = 6;
  const segHeight = 3.5;
  const trunkHeight = trunkSegments * segHeight;
  const trunkGeos = [];

  for (let j = 0; j < trunkSegments; j++) {
    const tBottom = j / trunkSegments;

    // Bottom flare is wider than the top of the previous segment
    const rBottom = 2.2 * (1.0 - tBottom * 0.45);
    const rTop = rBottom * 0.85;

    const segGeo = new THREE.CylinderGeometry(rTop, rBottom, segHeight, 6);
    // Move to correct height
    segGeo.translate(0, j * segHeight + segHeight / 2, 0);

    // Apply lean on X axis
    const pos = segGeo.attributes.position.array;
    for (let idx = 0; idx < pos.length; idx += 3) {
      const y = pos[idx + 1];
      const lean = Math.pow(y / trunkHeight, 2) * 2.5;
      pos[idx] += lean;
    }
    segGeo.computeVertexNormals();
    trunkGeos.push(segGeo);
  }

  // Crown knob where fronds emerge at top
  const crown = new THREE.SphereGeometry(
    1.8,
    6,
    4,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  crown.translate(2.5, trunkHeight, 0);
  trunkGeos.push(crown);

  // Fronds — V-creased leaves with jagged cutouts/notches along the edges
  const frondCount = 9;
  const leafGeos = [];

  for (let i = 0; i < frondCount; i++) {
    // Steps defining X along length and leaf width (w)
    // Duplicate X values create sharp, stylized cutouts (notches)
    const steps = [
      {x: 0, w: 0.4},
      {x: 3.5, w: 2.8},
      {x: 3.5, w: 0.8}, // Notch 1
      {x: 7.5, w: 3.2},
      {x: 7.5, w: 1.0}, // Notch 2
      {x: 11.5, w: 2.4},
      {x: 11.5, w: 0.6}, // Notch 3
      {x: 15, w: 0.0},
    ];

    const bendFactor = 0.045 + (i % 3) * 0.012; // Varying droop
    const verts = [];
    const indices = [];

    for (let k = 0; k < steps.length; k++) {
      const {x, w} = steps[k];
      const y = x * 0.42 - x * x * bendFactor;

      // Creased V-shape (Center is raised, Left/Right are lowered)
      verts.push(x, y - 0.25, -w / 2); // Left
      verts.push(x, y + 0.25, 0); // Center
      verts.push(x, y - 0.25, w / 2); // Right
    }

    for (let k = 0; k < steps.length - 1; k++) {
      const idx_L = k * 3;
      const idx_C = k * 3 + 1;
      const idx_R = k * 3 + 2;

      const idx_L_next = (k + 1) * 3;
      const idx_C_next = (k + 1) * 3 + 1;
      const idx_R_next = (k + 1) * 3 + 2;

      // Front faces
      indices.push(idx_L, idx_L_next, idx_C_next);
      indices.push(idx_L, idx_C_next, idx_C);
      indices.push(idx_C, idx_C_next, idx_R_next);
      indices.push(idx_C, idx_R_next, idx_R);

      // Back faces
      indices.push(idx_L, idx_C_next, idx_L_next);
      indices.push(idx_L, idx_C, idx_C_next);
      indices.push(idx_C, idx_R_next, idx_C_next);
      indices.push(idx_C, idx_R, idx_R_next);
    }

    const frondGeo = new THREE.BufferGeometry();
    frondGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(verts), 3)
    );
    frondGeo.setIndex(indices);
    frondGeo.computeVertexNormals();

    // Slight roll around the leaf's central axis (X)
    const roll = 0.15 * Math.sin(i * 1.7);
    frondGeo.rotateX(roll);

    // Rotate around Y to spread evenly
    const yAngle = (i * Math.PI * 2) / frondCount + (i % 2 === 0 ? 0.1 : -0.08);
    frondGeo.rotateY(yAngle);

    // Position at trunk top (shifted for lean)
    frondGeo.translate(2.5, trunkHeight + 0.5 + (i % 3) * 0.25, 0);
    leafGeos.push(frondGeo);
  }

  // Combine trunk geometries
  const combinedTrunkPos = [],
    combinedTrunkNorm = [],
    combinedTrunkIdx = [];
  let trunkOffset = 0;
  for (const g of trunkGeos) {
    combinedTrunkPos.push(...g.attributes.position.array);
    combinedTrunkNorm.push(...g.attributes.normal.array);
    const gIdx = g.index ? g.index.array : [];
    for (let i = 0; i < gIdx.length; i++)
      combinedTrunkIdx.push(gIdx[i] + trunkOffset);
    trunkOffset += g.attributes.position.count;
  }
  const trunkGeom = new THREE.BufferGeometry();
  trunkGeom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(combinedTrunkPos, 3)
  );
  trunkGeom.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(combinedTrunkNorm, 3)
  );
  trunkGeom.setIndex(combinedTrunkIdx);

  // Combine leaf geometries
  const combinedLeafPos = [],
    combinedLeafNorm = [],
    combinedLeafIdx = [];
  let leafOffset = 0;
  for (const g of leafGeos) {
    combinedLeafPos.push(...g.attributes.position.array);
    combinedLeafNorm.push(...g.attributes.normal.array);
    const gIdx = g.index ? g.index.array : [];
    for (let i = 0; i < gIdx.length; i++)
      combinedLeafIdx.push(gIdx[i] + leafOffset);
    leafOffset += g.attributes.position.count;
  }
  const leafGeom = new THREE.BufferGeometry();
  leafGeom.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(combinedLeafPos, 3)
  );
  leafGeom.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(combinedLeafNorm, 3)
  );
  leafGeom.setIndex(combinedLeafIdx);

  return {trunk: trunkGeom, leaves: leafGeom};
}
var palmGeos = createPalmGeometry();

function createDeadTreeGeometry() {
  const trunk = new THREE.CylinderGeometry(0.5, 1.8, 14, 5);
  trunk.translate(0, 7, 0);

  const b1 = new THREE.CylinderGeometry(0.3, 0.6, 8, 4);
  b1.rotateZ(0.8);
  b1.translate(3, 10, 0);

  const b2 = new THREE.CylinderGeometry(0.3, 0.5, 6, 4);
  b2.rotateZ(-1.1);
  b2.translate(-2, 8, 1);

  const geometries = [trunk, b1, b2];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
var deadTreeGeo = createDeadTreeGeometry();

var treeTrunkMat = createMaterial({color: 0x5d4037, flatShading: true});
// Leaf materials use WHITE as the base color so per-instance colors control the actual appearance
// (Three.js multiplies instance color × material color, so white = identity / no tint)
var treeLeavesBaseMat = createMaterial({color: 0xffffff, flatShading: true});
var deadTreeMat = createMaterial({color: 0x8d6e63, flatShading: true});

// Rock geometries and materials
var rockGeo = new THREE.DodecahedronGeometry(3, 0); // Base flat shaded rock
var rockMat = createMaterial({color: 0x888888, flatShading: true});
var snowRockMat = createMaterial({color: 0xdddddd, flatShading: true});
var desertRockMat = createMaterial({color: 0xd2b48c, flatShading: true});

// Cactus geometries and materials
function createCactusGeometry() {
  const geometries = [];

  // Main trunk
  const mainRadius = 1.4;
  const mainHeight = 14;
  const trunk = new THREE.CylinderGeometry(
    mainRadius * 0.9,
    mainRadius,
    mainHeight,
    8
  );
  trunk.translate(0, mainHeight / 2, 0);
  geometries.push(trunk);

  // Trunk top cap (hemisphere)
  const trunkCap = new THREE.SphereGeometry(
    mainRadius * 0.9,
    8,
    4,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  trunkCap.translate(0, mainHeight, 0);
  geometries.push(trunkCap);

  // Helper function to create an arm
  function createArm(direction, startY, horizontalLen, verticalHeight) {
    const armRadius = 1.0;

    // Horizontal connecting piece
    const hPiece = new THREE.CylinderGeometry(
      armRadius,
      armRadius,
      horizontalLen,
      8
    );
    hPiece.rotateZ(Math.PI / 2);
    const hCenterX = direction * (mainRadius + horizontalLen / 2 - 0.5);
    hPiece.translate(hCenterX, startY, 0);
    geometries.push(hPiece);

    // Elbow sphere to round the joint
    const elbow = new THREE.SphereGeometry(armRadius, 8, 4);
    const elbowX = direction * (mainRadius + horizontalLen - 0.5);
    elbow.translate(elbowX, startY, 0);
    geometries.push(elbow);

    // Vertical piece
    const vPiece = new THREE.CylinderGeometry(
      armRadius * 0.9,
      armRadius,
      verticalHeight,
      8
    );
    vPiece.translate(elbowX, startY + verticalHeight / 2, 0);
    geometries.push(vPiece);

    // Top cap
    const cap = new THREE.SphereGeometry(
      armRadius * 0.9,
      8,
      4,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    cap.translate(elbowX, startY + verticalHeight, 0);
    geometries.push(cap);
  }

  // Right arm (lower, longer)
  createArm(1, 6, 3, 6);

  // Left arm (higher, shorter)
  createArm(-1, 9, 2.5, 4);

  let pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) {
      norm.push(...g.attributes.normal.array);
    }
    const count = g.attributes.position.count;
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++) {
        idx.push(g.index.array[i] + offset);
      }
    } else {
      for (let i = 0; i < count; i++) idx.push(i + offset);
    }
    offset += count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length) {
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  } else {
    geom.computeVertexNormals();
  }
  geom.setIndex(idx);
  return geom;
}
var cactusGeo = createCactusGeometry();
var cactusMat = createMaterial({color: 0x4caf50, flatShading: true});

// Mushroom geometry and materials
function createMushroomGeometry() {
  const stalk = new THREE.CylinderGeometry(1.2, 1.8, 12, 8);
  stalk.translate(0, 6, 0);

  const cap = new THREE.SphereGeometry(
    7,
    12,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2
  );
  cap.scale(1, 0.6, 1);
  cap.translate(0, 12, 0);

  return {trunk: stalk, leaves: cap};
}
var mushroomGeos = createMushroomGeometry();
var mushroomStalkMat = createMaterial({color: 0xdddddd, flatShading: true});
var ALIEN_MUSHROOM_CAP_COLORS = [
  0x9c27b0, // Vibrant purple
  0xab47bc, // Magenta violet
  0x7b1fa2, // Deep purple
  0xba68c8, // Orchid
  0x8e24aa, // Dark violet
  0x00bcd4, // Luminescent cyan
  0x26a69a, // Bioluminescent teal
];

// Lily pad geometry and material
function createLilyPadGeometry() {
  // A flat cylinder with a slice removed (pacman shape)
  const padGeo = new THREE.CylinderGeometry(
    1.5,
    1.5,
    0.2,
    8,
    1,
    false,
    0,
    Math.PI * 1.8
  );
  return padGeo;
}
var lilyPadGeo = createLilyPadGeometry();
var lilyPadMat = createMaterial({color: 0x4caf50, flatShading: true});

// Bush geometry and material
function createBushGeometry() {
  const geometries = [];

  // A lush, organic low-poly cluster
  const clumps = [
    {r: 1.6, x: 0, y: 1.4, z: 0},
    {r: 1.2, x: 1.1, y: 1.0, z: 0.8},
    {r: 1.3, x: -1.0, y: 0.9, z: 0.9},
    {r: 1.1, x: 0.8, y: 0.8, z: -1.0},
    {r: 1.2, x: -0.9, y: 1.1, z: -0.8},
    {r: 0.9, x: 0.2, y: 2.2, z: 0.3},
  ];

  for (const c of clumps) {
    const geo = new THREE.IcosahedronGeometry(c.r, 1);
    // Add varying rotations to catch the light beautifully
    geo.rotateX(c.x * 2.5);
    geo.rotateY(c.y * 2.5);
    geo.rotateZ(c.z * 2.5);
    // Squish it slightly on the Y axis to look softer and bush-like
    geo.scale(1, 0.8, 1);
    geo.translate(c.x, c.y, c.z);
    geometries.push(geo);
  }

  let pos = [],
    norm = [],
    idx = [];
  let offset = 0;

  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) {
      norm.push(...g.attributes.normal.array);
    }
    const count = g.attributes.position.count;
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++) {
        idx.push(g.index.array[i] + offset);
      }
    } else {
      for (let i = 0; i < count; i++) {
        idx.push(i + offset);
      }
    }
    offset += count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length) {
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  } else {
    geom.computeVertexNormals();
  }
  geom.setIndex(idx);
  return geom;
}
var bushGeo = createBushGeometry();
var bushMat = createMaterial({color: 0x558b2f, flatShading: true}); // Darker green
var bushBaseMat = createMaterial({color: 0xffffff, flatShading: true}); // For instance coloring

// Snowman geometries and materials
function createSnowmanGeometry() {
  const baseGeo = new THREE.SphereGeometry(3, 8, 8);
  baseGeo.translate(0, 2.5, 0);
  const midGeo = new THREE.SphereGeometry(2, 8, 8);
  midGeo.translate(0, 6.5, 0);
  const headGeo = new THREE.SphereGeometry(1.5, 8, 8);
  headGeo.translate(0, 9.5, 0);

  // Nose
  const noseGeo = new THREE.ConeGeometry(0.3, 1.5, 4);
  noseGeo.rotateX(Math.PI / 2);
  noseGeo.translate(0, 9.5, 1.5);

  const geometries = [baseGeo, midGeo, headGeo];
  let pos = [],
    norm = [],
    idx = [];
  let offset = 0;

  // White body parts
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++) {
      idx.push(g.index.array[i] + offset);
    }
    offset += g.attributes.position.count;
  }

  const bodyGeom = new THREE.BufferGeometry();
  bodyGeom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bodyGeom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  bodyGeom.setIndex(idx);

  return {body: bodyGeom, nose: noseGeo};
}
var snowmanGeos = createSnowmanGeometry();
var snowmanBodyMat = createMaterial({color: 0xffffff, flatShading: true});
var snowmanNoseMat = createMaterial({color: 0xff8c00, flatShading: true});

// Autumn & Cherry Blossom materials
var autumnLeavesMat1 = createMaterial({color: 0xd35400, flatShading: true}); // Burnt Orange
var autumnLeavesMat2 = createMaterial({color: 0xf39c12, flatShading: true}); // Orange
var autumnLeavesMat3 = createMaterial({color: 0xc0392b, flatShading: true}); // Strong Red
var cherryBlossomMat = createMaterial({color: 0xf8bbd0, flatShading: true}); // Pink

// Reusable house geometries
var houseBodyGeo = new THREE.BoxGeometry(10, 8, 10);
houseBodyGeo.translate(0, 4, 0);
var houseRoofGeo = new THREE.ConeGeometry(8.5, 6, 4);
houseRoofGeo.rotateY(Math.PI / 4);
houseRoofGeo.translate(0, 11, 0);
var houseWindowGeo = new THREE.BoxGeometry(2, 2.5, 0.5);

var houseDoorGeo = new THREE.BoxGeometry(2.5, 4.5, 0.5);
var houseChimneyGeo = new THREE.BoxGeometry(1.5, 5, 1.5);
houseChimneyGeo.translate(0, 11, 0);

var houseDoorMat = createMaterial({color: 0x5c4033, flatShading: true});
var houseChimneyMat = createMaterial({color: 0x8b3a3a, flatShading: true});

// Two story house geometries
var twoStoryBodyGeo = new THREE.BoxGeometry(10, 14, 10);
twoStoryBodyGeo.translate(0, 7, 0);
var twoStoryRoofGeo = new THREE.ConeGeometry(8.5, 7, 4);
twoStoryRoofGeo.rotateY(Math.PI / 4);
twoStoryRoofGeo.translate(0, 17.5, 0);
var twoStoryChimneyGeo = new THREE.BoxGeometry(1.5, 5, 1.5);
twoStoryChimneyGeo.translate(0, 17.5, 0);

// Straw hut geometries
var strawHutBodyGeo = new THREE.CylinderGeometry(4, 4, 6, 8);
strawHutBodyGeo.translate(0, 3, 0);
var strawHutRoofGeo = new THREE.ConeGeometry(5.5, 5, 8);
strawHutRoofGeo.translate(0, 8.5, 0);
var strawHutMat = createMaterial({color: 0xe6c280, flatShading: true}); // Straw color

// Iceberg & Ice floe geometries & materials
var icebergMainGeo = new THREE.CylinderGeometry(8, 16, 20, 6, 2);
icebergMainGeo.translate(0, 10, 0);
var posMain = icebergMainGeo.attributes.position.array;
for (let i = 0; i < posMain.length; i += 3) {
  const px = posMain[i];
  const pz = posMain[i + 2];
  const angle = Math.atan2(pz, px);
  posMain[i] += Math.cos(angle * 3) * 2.0;
  posMain[i + 2] += Math.sin(angle * 3) * 2.0;
  posMain[i + 1] += Math.sin(px * 0.5) * 1.5;
}
icebergMainGeo.computeVertexNormals();

var iceFloeMainGeo = new THREE.CylinderGeometry(15, 18, 4, 7, 1);
iceFloeMainGeo.translate(0, 2, 0);
var posFloe = iceFloeMainGeo.attributes.position.array;
for (let i = 0; i < posFloe.length; i += 3) {
  const px = posFloe[i];
  const pz = posFloe[i + 2];
  const angle = Math.atan2(pz, px);
  posFloe[i] += Math.cos(angle * 4) * 1.5;
  posFloe[i + 2] += Math.sin(angle * 4) * 1.5;
  posFloe[i + 1] += Math.sin(px * 0.3) * 0.3;
}
iceFloeMainGeo.computeVertexNormals();

var icebergMat = createMaterial({
  color: 0xd0f0f5,
  emissive: 0x0a1c28,
  roughness: 0.15,
  metalness: 0.05,
  flatShading: true,
});

// Penguin geometries & materials
var penguinBodyGeo = new THREE.CylinderGeometry(1.1, 1.3, 3.2, 6);
penguinBodyGeo.translate(0, 1.6, 0);

var penguinBellyGeo = new THREE.BoxGeometry(1.4, 2.4, 0.3);
penguinBellyGeo.translate(0, 1.5, 1.2);

var penguinHeadGeo = new THREE.SphereGeometry(1.0, 6, 6);
penguinHeadGeo.translate(0, 3.8, 0.2);

var penguinBeakGeo = new THREE.ConeGeometry(0.3, 0.9, 4);
penguinBeakGeo.rotateX(Math.PI / 2);
penguinBeakGeo.translate(0, 3.8, 1.5);

var penguinWingGeo = new THREE.BoxGeometry(0.25, 2.0, 0.8);
var penguinWingLGeo = penguinWingGeo.clone();
penguinWingLGeo.rotateZ(-0.15);
penguinWingLGeo.translate(-1.4, 1.8, 0.2);

var penguinWingRGeo = penguinWingGeo.clone();
penguinWingRGeo.rotateZ(0.15);
penguinWingRGeo.translate(1.4, 1.8, 0.2);

var penguinFootGeo = new THREE.BoxGeometry(0.7, 0.2, 1.3);
var penguinFootLGeo = penguinFootGeo.clone();
penguinFootLGeo.translate(-0.6, 0.1, 0.4);

var penguinFootRGeo = penguinFootGeo.clone();
penguinFootRGeo.translate(0.6, 0.1, 0.4);

var penguinBlackMat = createMaterial({color: 0x222222, flatShading: true});
var penguinWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
var penguinOrangeMat = createMaterial({color: 0xffa500, flatShading: true});

// Waddling shader animation
var penguinShaderInject = (shader) => {
  shader.uniforms.uTime = window.animationUniforms.uTime;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\nuniform float uTime;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
        float phase = instanceMatrix[3][0] + instanceMatrix[3][2];
        #else
        float phase = 0.0;
        #endif
        // Waddling flag (e.g., 60% waddle, 40% stand still)
        float isWaddling = step(0.4, fract(phase * 1.543));
        
        // Waddling animation: sway side to side (rotation around Z axis)
        float waddleCycle = uTime * 4.0 + phase;
        float sway = sin(waddleCycle) * 0.15 * isWaddling;
        float bob = abs(cos(waddleCycle)) * 0.2 * isWaddling;
        
        // Calculate circular walk path
        float walkAngle = uTime * 0.8 + phase * 2.5;
        float walkRadius = 2.5; // Walk in a small 2.5-unit circle
        
        // Walk rotation around Y-axis (tangent to circle: walkAngle + PI/2)
        float ry = (walkAngle + 1.5708) * isWaddling;
        float cy = cos(ry);
        float sy = sin(ry);
        mat3 rotY = mat3(
          cy,  0.0, sy,
          0.0, 1.0, 0.0,
          -sy, 0.0, cy
        );
        
        // Apply waddle sway (Z rotation)
        float cz = cos(sway);
        float sz = sin(sway);
        mat3 rotZ = mat3(
          cz, -sz, 0.0,
          sz,  cz, 0.0,
          0.0, 0.0, 1.0
        );
        
        // Apply local rotations
        transformed = rotY * rotZ * transformed;
        
        // Add vertical bobbing and circular XZ translation
        transformed.y += bob;
        transformed.x += cos(walkAngle) * walkRadius * isWaddling;
        transformed.z += sin(walkAngle) * walkRadius * isWaddling;
    `
  );
};
penguinBlackMat.onBeforeCompile = penguinShaderInject;
penguinWhiteMat.onBeforeCompile = penguinShaderInject;
penguinOrangeMat.onBeforeCompile = penguinShaderInject;

// House color palettes
var houseBodyPalette = [
  createMaterial({color: 0xf5e6c8, flatShading: true}), // Cream
  createMaterial({color: 0xd9b99b, flatShading: true}), // Sandy tan
  createMaterial({color: 0xb0c4a0, flatShading: true}), // Sage green
  createMaterial({color: 0xc8d8e8, flatShading: true}), // Pale blue
  createMaterial({color: 0xe8c8b0, flatShading: true}), // Terracotta peach
  createMaterial({color: 0xccbbcc, flatShading: true}), // Dusty mauve
];
var houseRoofPalette = [
  createMaterial({color: 0x5d4037, flatShading: true}), // Dark brown
  createMaterial({color: 0x7b3f2a, flatShading: true}), // Brick red
  createMaterial({color: 0x546e7a, flatShading: true}), // Slate blue-grey
  createMaterial({color: 0x4a4a3a, flatShading: true}), // Charcoal
];

// Window Materials (5 variations for staggered lighting)
var houseWindowMats = [];
for (let i = 0; i < 5; i++) {
  houseWindowMats.push(
    createMaterial({
      color: 0x4a6a8a, // Soft glassy blue instead of black
      emissive: 0xffd54f,
      emissiveIntensity: 0.0,
      roughness: 0.2, // Slightly rough instead of perfectly smooth for better lighting capture
    })
  );
}

// --- PAGODA ---
function createPagodaBodyGeometry() {
  const foundation = new THREE.BoxGeometry(12, 2, 12);
  foundation.translate(0, 1, 0);
  const tier1 = new THREE.BoxGeometry(9, 6, 9);
  tier1.translate(0, 5, 0);
  const tier2 = new THREE.BoxGeometry(6.5, 5, 6.5);
  tier2.translate(0, 11.5, 0);
  const tier3 = new THREE.BoxGeometry(4, 4, 4);
  tier3.translate(0, 17.5, 0);
  const geometries = [foundation, tier1, tier2, tier3];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
function createPagodaRoofGeometry() {
  // Wide flat square eaves per tier + top spire
  const eave1 = new THREE.CylinderGeometry(8.5, 8.5, 1.5, 4);
  eave1.rotateY(Math.PI / 4);
  eave1.translate(0, 8.5, 0);
  const eave2 = new THREE.CylinderGeometry(6, 6, 1.5, 4);
  eave2.rotateY(Math.PI / 4);
  eave2.translate(0, 14.5, 0);
  const eave3 = new THREE.CylinderGeometry(4, 4, 1.5, 4);
  eave3.rotateY(Math.PI / 4);
  eave3.translate(0, 20, 0);
  const spire = new THREE.CylinderGeometry(0.3, 0.6, 7, 6);
  spire.translate(0, 25, 0);
  const geometries = [eave1, eave2, eave3, spire];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
var pagodaBodyGeo = createPagodaBodyGeometry();
var pagodaRoofGeo = createPagodaRoofGeometry();
var pagodaBodyMat = createMaterial({color: 0x3e2723, flatShading: true}); // dark wood
var pagodaRoofMat = createMaterial({color: 0x1b5e20, flatShading: true}); // deep green eaves

// --- BARN ---
function createBarnRoofGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-10, 12);
  shape.lineTo(-10, 16);
  shape.lineTo(-4, 23);
  shape.lineTo(4, 23);
  shape.lineTo(10, 16);
  shape.lineTo(10, 12);
  shape.lineTo(-10, 12);

  const extrudeSettings = {
    depth: 30,
    bevelEnabled: false,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along Z (depth is 30, so translate by -15)
  geo.translate(0, 0, -15);
  return geo;
}
var barnBodyGeo = new THREE.BoxGeometry(18, 12, 28);
barnBodyGeo.translate(0, 6, 0);
var barnRoofGeo = createBarnRoofGeometry();

// Details
var barnDoorGeo = new THREE.BoxGeometry(8, 9, 0.5);
var barnTrimGeo = new THREE.BoxGeometry(0.5, 12.04, 0.6); // sqrt(8^2 + 9^2) = 12.04

var barnSiloBodyGeo = new THREE.CylinderGeometry(4, 4, 22, 12);
barnSiloBodyGeo.translate(0, 11, 0);
var barnSiloRoofGeo = new THREE.SphereGeometry(
  4,
  12,
  8,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2
);
barnSiloRoofGeo.translate(0, 22, 0);

var barnBodyMat = createMaterial({color: 0x9b1c1c, flatShading: true}); // classic barn red
var barnRoofMat = createMaterial({color: 0x3e2723, flatShading: true}); // dark timber
var barnWhiteMat = createMaterial({color: 0xeeeeee, flatShading: true});
var barnSiloMat = createMaterial({
  color: 0xaaaaaa,
  metalness: 0.2,
  roughness: 0.6,
  flatShading: true,
});
var barnSiloRoofMat = createMaterial({
  color: 0xc2c2c2,
  metalness: 0.3,
  roughness: 0.5,
  flatShading: true,
});
// --- MONASTERY ---
function createMonasteryBodyGeometry() {
  // Long main hall
  const hall = new THREE.BoxGeometry(30, 10, 16);
  hall.translate(0, 5, 0);
  // Side cloister wing
  const wing = new THREE.BoxGeometry(18, 6, 8);
  wing.translate(4, 3, -12);
  // Bell tower base (attached at one end of hall)
  const tower = new THREE.BoxGeometry(9, 22, 9);
  tower.translate(-16, 11, 0);
  const geometries = [hall, wing, tower];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}

function createGableRoof(width, depth, height, overhang) {
  const shape = new THREE.Shape();
  const hw = width / 2 + overhang;
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(0, height);
  shape.lineTo(-hw, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth + overhang * 2,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -(depth + overhang * 2) / 2);
  return geo;
}

function createMonasteryRoofGeometry() {
  const hallRoof = createGableRoof(16, 30, 8, 1.5);
  hallRoof.rotateY(Math.PI / 2);
  hallRoof.translate(0, 10, 0);

  const wingRoof = createGableRoof(8, 18, 5, 1.5);
  wingRoof.rotateY(Math.PI / 2);
  wingRoof.translate(4, 6, -12);

  const towerCap = new THREE.ConeGeometry(7.5, 9, 4);
  towerCap.rotateY(Math.PI / 4);
  towerCap.translate(-16, 22 + 4.5, 0);

  const geometries = [hallRoof, wingRoof, towerCap];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) {
      norm.push(...g.attributes.normal.array);
    }
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++)
        idx.push(g.index.array[i] + offset);
    } else {
      for (let i = 0; i < g.attributes.position.count; i++)
        idx.push(i + offset);
    }
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length) {
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  } else {
    geom.computeVertexNormals();
  }
  geom.setIndex(idx);
  return geom;
}

var monasteryBodyGeo = createMonasteryBodyGeometry();
var monasteryRoofGeo = createMonasteryRoofGeometry();
var monasteryBodyMat = createMaterial({color: 0x9e9e9e, flatShading: true}); // stone
var monasteryRoofMat = createMaterial({color: 0x546e7a, flatShading: true}); // slate

// --- CASTLE RUINS ---
function createRockArchGeometries(rng) {
  const rockGeos = [];
  const grassGeos = [];

  // We'll build the arch by placing blocks along a parabolic curve
  // that is thick at the base and thins out at the top.
  const numBlocks = 40;
  for (let i = 0; i < numBlocks; i++) {
    // t goes from -1 to 1 (left to right)
    const t = (i / (numBlocks - 1)) * 2 - 1;

    // Parabolic arch equation: y = h * (1 - t^2)
    // We want the base at y=0, peak at y=135
    const peakHeight = 270;
    const archWidth = 500; // Total width increased for wider opening

    const x = (t * archWidth) / 2;
    // We can make the curve a bit steeper to open up the inside more
    // y = peakHeight * (1 - t^2)
    const y = peakHeight * (1 - Math.pow(Math.abs(t), 1.8)) + 10;

    // Thickness decreases towards the top, but base thickness reduced
    const thickness = 50 + Math.pow(Math.abs(t), 2) * 60;

    // Add multiple jittered blocks at this position for volume
    const blocksPerPos = 2 + Math.floor(Math.abs(t) * 2);

    for (let j = 0; j < blocksPerPos; j++) {
      const w = thickness * (0.6 + rng() * 0.8);
      const h = thickness * (0.6 + rng() * 0.8);
      const d = thickness * (0.6 + rng() * 0.8);

      const box = new THREE.BoxGeometry(w, h, d);
      box.rotateY(rng() * Math.PI);
      box.rotateZ((rng() - 0.5) * 0.8);
      box.rotateX((rng() - 0.5) * 0.8);

      const jx = x + (rng() - 0.5) * thickness * 0.3;
      const jy = y + (rng() - 0.5) * thickness * 0.3;
      const jz = (rng() - 0.5) * 30;

      box.translate(jx, jy, jz);
      rockGeos.push(box);

      // Grass logic - only add grass on the top-facing blocks of the arch
      // We check if this block is relatively high up, or just add a grass block slightly above it
      if (jy > 60) {
        // Only top layer of grass, maybe probability based on height
        if (rng() > 0.3) {
          const grassBox = new THREE.BoxGeometry(
            w * 0.9,
            8 + rng() * 6,
            d * 0.9
          );
          grassBox.rotateY(rng() * Math.PI);
          grassBox.rotateZ((rng() - 0.5) * 0.2);
          grassBox.rotateX((rng() - 0.5) * 0.2);
          grassBox.translate(jx, jy + h / 2, jz);
          grassGeos.push(grassBox);
        }
      }
    }
  }

  function merge(geometries) {
    const pos = [],
      norm = [],
      idx = [],
      uv = [];
    let offset = 0;
    for (const g of geometries) {
      if (g.attributes.position) pos.push(...g.attributes.position.array);
      if (g.attributes.normal) norm.push(...g.attributes.normal.array);
      if (g.attributes.uv) uv.push(...g.attributes.uv.array);
      if (g.index) {
        for (let i = 0; i < g.index.array.length; i++) {
          idx.push(g.index.array[i] + offset);
        }
      } else {
        // Fallback for unindexed geometries
        for (let i = 0; i < g.attributes.position.count; i++) {
          idx.push(i + offset);
        }
      }
      offset += g.attributes.position.count;
    }
    const geom = new THREE.BufferGeometry();
    if (pos.length > 0)
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (norm.length > 0)
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    if (uv.length > 0)
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (idx.length > 0) geom.setIndex(idx);
    return geom;
  }

  const mergedRock = merge(rockGeos);
  const mergedGrass = merge(grassGeos);

  // Clean up
  rockGeos.forEach((g) => g.dispose());
  grassGeos.forEach((g) => g.dispose());

  return {rock: mergedRock, grass: mergedGrass};
}
if (typeof window !== 'undefined')
  window.createRockArchGeometries = createRockArchGeometries;

var rockArchGrassMat = createMaterial({color: 0x7cb342});

function createCastleRuinsGeometry() {
  const geometries = [];
  // Use seeded RNG for deterministic layout across sessions
  const _castleRng = ChillFlightLogic.mulberry32(91827);

  // Helper to add battlements to a circular tower
  function addCircularBattlements(radius, y, cx, cz, count) {
    for (let i = 0; i < count; i++) {
      if (_castleRng() > 0.3) {
        const angle = (i / count) * Math.PI * 2;
        const b = new THREE.BoxGeometry(2, 2.5, 2);
        b.translate(
          Math.cos(angle) * radius + cx,
          y + 1.25,
          Math.sin(angle) * radius + cz
        );
        geometries.push(b);
      }
    }
  }

  // 1. Tall main tower
  const tower1 = new THREE.CylinderGeometry(5, 6.5, 36, 8);
  tower1.translate(0, 18, 0);
  geometries.push(tower1);
  addCircularBattlements(4.8, 36, 0, 0, 8);

  // 2. Shorter broken tower
  const tower2 = new THREE.CylinderGeometry(4.5, 6, 18, 8);
  tower2.translate(24, 9, 4);
  geometries.push(tower2);

  // Broken chunks on top of tower2
  for (let i = 0; i < 5; i++) {
    const chunk = new THREE.BoxGeometry(3, _castleRng() * 4 + 1, 3);
    const angle = _castleRng() * Math.PI * 2;
    chunk.rotateY(_castleRng());
    chunk.rotateZ(_castleRng() * 0.2);
    chunk.translate(
      Math.cos(angle) * 3 + 24,
      18 + _castleRng(),
      Math.sin(angle) * 3 + 4
    );
    geometries.push(chunk);
  }

  // 3. Main Gatehouse / Keep
  const keep = new THREE.BoxGeometry(16, 22, 14);
  keep.translate(12, 11, -12);
  geometries.push(keep);

  // Archway cutout via side pillars and top block
  const gateLeft = new THREE.BoxGeometry(5, 14, 4);
  gateLeft.translate(12 - 5, 7, 2);
  geometries.push(gateLeft);

  const gateRight = new THREE.BoxGeometry(5, 14, 4);
  gateRight.translate(12 + 5, 7, 2);
  geometries.push(gateRight);

  const gateTop = new THREE.BoxGeometry(16, 6, 4);
  gateTop.translate(12, 17, 2);
  geometries.push(gateTop);

  // Battlements on Gatehouse
  for (let i = 0; i < 4; i++) {
    if (_castleRng() > 0.2) {
      const b = new THREE.BoxGeometry(2, 2.5, 4);
      b.translate(6 + i * 4, 20 + 1.25, 2);
      geometries.push(b);
    }
  }

  // 4. Connecting curtain walls
  const wall1 = new THREE.BoxGeometry(4, 12, 12);
  wall1.translate(2, 6, -6);
  geometries.push(wall1);

  const wall2 = new THREE.BoxGeometry(8, 10, 4);
  wall2.translate(20, 5, 0);
  wall2.rotateY(0.1);
  geometries.push(wall2);

  // 5. Ruined wall stubs and scattered stones
  const stub1 = new THREE.BoxGeometry(6, 4, 3);
  stub1.rotateY(0.4);
  stub1.translate(-6, 2, -10);
  geometries.push(stub1);

  const stub2 = new THREE.BoxGeometry(4, 6, 4);
  stub2.rotateY(-0.2);
  stub2.rotateZ(0.1);
  stub2.translate(28, 3, -4);
  geometries.push(stub2);

  for (let i = 0; i < 15; i++) {
    const block = new THREE.BoxGeometry(2, 2, 2);
    block.rotateX(_castleRng());
    block.rotateY(_castleRng());
    block.rotateZ(_castleRng());
    const angle = _castleRng() * Math.PI * 2;
    const r = 10 + _castleRng() * 20;
    block.translate(12 + Math.cos(angle) * r, 1, Math.sin(angle) * r);
    geometries.push(block);
  }

  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) {
      norm.push(...g.attributes.normal.array);
    }
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++)
        idx.push(g.index.array[i] + offset);
    } else {
      for (let i = 0; i < g.attributes.position.count; i++)
        idx.push(i + offset);
    }
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length) {
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  } else {
    geom.computeVertexNormals();
  }
  geom.setIndex(idx);
  return geom;
}
var castleRuinsGeo = createCastleRuinsGeometry();
var castleRuinsMat = createMaterial({color: 0x78909c, flatShading: true}); // weathered stone

// Bird geometry
// Hawk geometries
var hawkBodyGeo = new THREE.BoxGeometry(1.2, 0.8, 3.5);
var hawkBellyGeo = new THREE.BoxGeometry(1.25, 0.2, 2.5);
hawkBellyGeo.translate(0, -0.35, -0.2);
var hawkHeadGeo = new THREE.BoxGeometry(0.8, 0.8, 1.0);
hawkHeadGeo.translate(0, 0.2, -2.0);
var hawkBeakGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
hawkBeakGeo.rotateX(-Math.PI / 2);
hawkBeakGeo.translate(0, 0.1, -2.8);
var hawkTailGeo = new THREE.BoxGeometry(1.4, 0.2, 1.5);
hawkTailGeo.translate(0, 0, 2.2);
var hawkWingGeo = new THREE.BoxGeometry(5, 0.1, 2.5);
hawkWingGeo.translate(2.5, 0, 0);

var hawkBrownMat = createMaterial({color: 0x4a2e15, flatShading: true});
var hawkLightMat = createMaterial({color: 0xd2b48c, flatShading: true}); // Tan belly
var hawkBeakMat = createMaterial({color: 0xffcc00, flatShading: true}); // Yellow beak

// Seagull geometries
var seagullBodyGeo = new THREE.BoxGeometry(1.0, 0.7, 3.0);
var seagullHeadGeo = new THREE.BoxGeometry(0.7, 0.7, 0.9);
seagullHeadGeo.translate(0, 0.3, -1.8);
var seagullBeakGeo = new THREE.ConeGeometry(0.2, 0.7, 4);
seagullBeakGeo.rotateX(-Math.PI / 2);
seagullBeakGeo.translate(0, 0.2, -2.6);
var seagullTailGeo = new THREE.BoxGeometry(1.2, 0.2, 1.2);
seagullTailGeo.translate(0, 0, 1.8);
var seagullWingGeo = new THREE.BoxGeometry(4.5, 0.1, 1.8);
seagullWingGeo.translate(2.25, 0, 0);
var seagullWingTipGeo = new THREE.BoxGeometry(1.5, 0.11, 1.6);
seagullWingTipGeo.translate(4.0, 0, 0);

var seagullWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
var seagullGreyMat = createMaterial({color: 0xcccccc, flatShading: true});
var seagullBlackMat = createMaterial({color: 0x333333, flatShading: true});
var seagullBeakMat = createMaterial({color: 0xffd54f, flatShading: true});

function assembleHawk(scale) {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(hawkBodyGeo, hawkBrownMat);
  const belly = new THREE.Mesh(hawkBellyGeo, hawkLightMat);
  const head = new THREE.Mesh(hawkHeadGeo, hawkBrownMat);
  const beak = new THREE.Mesh(hawkBeakGeo, hawkBeakMat);
  const tail = new THREE.Mesh(hawkTailGeo, hawkBrownMat);
  const wingL = new THREE.Mesh(hawkWingGeo, hawkBrownMat);
  const wingR = new THREE.Mesh(hawkWingGeo, hawkBrownMat);
  wingL.rotation.y = Math.PI;
  bird.add(body, belly, head, beak, tail, wingL, wingR);
  bird.scale.set(scale, scale, scale);
  bird.userData.wings = [wingL, wingR];
  return bird;
}

function assembleSeagull(scale) {
  const bird = new THREE.Group();
  const body = new THREE.Mesh(seagullBodyGeo, seagullWhiteMat);
  const head = new THREE.Mesh(seagullHeadGeo, seagullWhiteMat);
  const beak = new THREE.Mesh(seagullBeakGeo, seagullBeakMat);
  const tail = new THREE.Mesh(seagullTailGeo, seagullWhiteMat);

  const wingL = new THREE.Group();
  const wingBaseL = new THREE.Mesh(seagullWingGeo, seagullGreyMat);
  const wingTipL = new THREE.Mesh(seagullWingTipGeo, seagullBlackMat);
  wingL.add(wingBaseL, wingTipL);
  wingL.rotation.y = Math.PI; // flip for left

  const wingR = new THREE.Group();
  const wingBaseR = new THREE.Mesh(seagullWingGeo, seagullGreyMat);
  const wingTipR = new THREE.Mesh(seagullWingTipGeo, seagullBlackMat);
  wingR.add(wingBaseR, wingTipR);

  bird.add(body, head, beak, tail, wingL, wingR);
  bird.scale.set(scale, scale, scale);
  bird.userData.wings = [wingL, wingR];
  return bird;
}

// Canada Goose geometries
var gooseBodyGeo = new THREE.BoxGeometry(1.2, 0.9, 3.5);
var gooseNeckGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6);
gooseNeckGeo.rotateX(Math.PI / 2);
gooseNeckGeo.translate(0, 0.5, -2.5);
var gooseHeadGeo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
gooseHeadGeo.translate(0, 0.5, -4.0);
var gooseBeakGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
gooseBeakGeo.rotateX(-Math.PI / 2);
gooseBeakGeo.translate(0, 0.5, -4.8);
var gooseCheekGeo = new THREE.BoxGeometry(0.65, 0.3, 0.5);
gooseCheekGeo.translate(0, 0.4, -4.0);
var gooseTailGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
gooseTailGeo.translate(0, 0.2, 2.0);
var gooseWhiteTailGeo = new THREE.BoxGeometry(1.0, 0.5, 1.0);
gooseWhiteTailGeo.translate(0, -0.1, 1.5);

var gooseBrownMat = createMaterial({color: 0x8b7355, flatShading: true});
var gooseBlackMat = createMaterial({color: 0x222222, flatShading: true});
var gooseWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
var gooseWingGeo = new THREE.BoxGeometry(6, 0.1, 2);
gooseWingGeo.translate(3, 0, 0);

// Windmill geometries
function createWindmillBaseGeometry() {
  const geometries = [];

  // 1. Tapered white stone base
  const base = new THREE.CylinderGeometry(4, 9, 30, 8);
  base.translate(0, 15, 0);
  geometries.push({geo: base, color: new THREE.Color(0xeeeeee)});

  // 2. Small dark windows/doors on the sides
  for (let i = 0; i < 3; i++) {
    const windowGeo = new THREE.BoxGeometry(2, 2.5, 2);
    // Position windows on the front side (+Z) going up
    windowGeo.translate(0, 8 + i * 6, 3.5 - i * 0.5);
    geometries.push({geo: windowGeo, color: new THREE.Color(0x222222)});
  }

  // 3. Dark octagonal/conical roof cap
  const roof = new THREE.CylinderGeometry(0.5, 4.5, 8, 8);
  roof.translate(0, 34, 0);
  geometries.push({geo: roof, color: new THREE.Color(0x3a404d)});

  // 4. Wooden hub sticking out the front (+Z) for the blades
  const hub = new THREE.CylinderGeometry(0.8, 1.2, 10, 8);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, 30, 6);
  geometries.push({geo: hub, color: new THREE.Color(0x5c4033)});

  const pos = [],
    norm = [],
    col = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.geo.attributes.position.array);
    if (g.geo.attributes.normal) norm.push(...g.geo.attributes.normal.array);
    const colorCount = g.geo.attributes.position.count;
    for (let i = 0; i < colorCount; i++)
      col.push(g.color.r, g.color.g, g.color.b);
    if (g.geo.index) {
      for (let i = 0; i < g.geo.index.array.length; i++)
        idx.push(g.geo.index.array[i] + offset);
    } else {
      for (let i = 0; i < colorCount; i++) idx.push(i + offset);
    }
    offset += colorCount;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length)
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  else geom.computeVertexNormals();
  geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geom.setIndex(idx);
  return geom;
}

function createWindmillBladesGeometry() {
  const geometries = [];

  // Main central spine (wooden pole)
  const spine = new THREE.BoxGeometry(0.6, 26, 0.4);
  spine.translate(0, 15, 0); // Rotate around Y=0 at the bottom
  geometries.push(spine);

  // Lattice crossbars
  // We'll place the lattice on one side of the spine (e.g., +X)
  const numBars = 14;
  for (let i = 0; i < numBars; i++) {
    const bar = new THREE.BoxGeometry(4.5, 0.3, 0.2);
    // Shift slightly to the right of the spine
    bar.translate(2.25, 7 + i * 1.5, 0);
    geometries.push(bar);
  }

  // Outer frame for the lattice
  const outerFrame = new THREE.BoxGeometry(0.3, numBars * 1.5, 0.2);
  outerFrame.translate(4.5, 7 + (numBars - 1) * 0.75, 0);
  geometries.push(outerFrame);

  const innerFrame = new THREE.BoxGeometry(0.3, numBars * 1.5, 0.2);
  innerFrame.translate(0.5, 7 + (numBars - 1) * 0.75, 0);
  geometries.push(innerFrame);

  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) norm.push(...g.attributes.normal.array);
    const count = g.attributes.position.count;
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++)
        idx.push(g.index.array[i] + offset);
    } else {
      for (let i = 0; i < count; i++) idx.push(i + offset);
    }
    offset += count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length)
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  else geom.computeVertexNormals();
  geom.setIndex(idx);
  return geom;
}

var windmillBaseGeo = createWindmillBaseGeometry();
var windmillBladesGeo = createWindmillBladesGeometry();
var windmillBaseMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
});
var windmillBladesMat = createMaterial({
  color: 0x5c4033,
  flatShading: true,
  roughness: 0.9,
});
var windmillBladesDepthMat = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
});

// Lighthouse geometries
var lighthouseTowerBottomGeo = new THREE.CylinderGeometry(8, 9, 20, 8);
var lighthouseTowerMidGeo = new THREE.CylinderGeometry(7, 8, 20, 8);
var lighthouseTowerTopGeo = new THREE.CylinderGeometry(6, 7, 20, 8);
var lighthouseLanternGeo = new THREE.CylinderGeometry(5.5, 5.5, 6, 8);
var lighthouseInnerLightGeo = new THREE.CylinderGeometry(3, 3, 5, 8);
var lighthouseDomeGeo = new THREE.SphereGeometry(
  5.5,
  8,
  8,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2
);

var flagpoleGeo = new THREE.CylinderGeometry(0.2, 0.2, 20, 4);
var flagGeo = new THREE.BoxGeometry(4, 3, 0.1);

var lighthouseRedMat = createMaterial({color: 0xc62828, flatShading: true});
var lighthouseWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
var lighthouseBandMat = createMaterial({color: 0x7b3f2a, flatShading: true}); // Reddish-brown
var lighthouseBlackMat = createMaterial({color: 0x212121, flatShading: true}); // Dark grey/black
var lighthouseGlassMat = createMaterial({
  color: 0x212121,
  flatShading: true,
  transparent: true,
  opacity: 0.4,
});
var lighthouseGlowMat = createMaterial({
  color: 0xffffaa,
  emissive: 0xffffaa,
  emissiveIntensity: 1.0,
});

// Pier geometries
function createPierDeckGeometry() {
  const geometries = [];

  // Main support beams (lengthwise)
  const beam1 = new THREE.BoxGeometry(1.5, 1.5, 30);
  beam1.translate(-5, 0.75, 15);
  const beam2 = new THREE.BoxGeometry(1.5, 1.5, 30);
  beam2.translate(5, 0.75, 15);
  geometries.push(beam1, beam2);

  // Planks across
  for (let i = 0; i < 15; i++) {
    const plank = new THREE.BoxGeometry(16, 0.5, 1.8);
    plank.translate(0, 1.75, 1 + i * 2);
    geometries.push(plank);
  }

  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) {
      norm.push(...g.attributes.normal.array);
    }
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++)
        idx.push(g.index.array[i] + offset);
    } else {
      for (let i = 0; i < g.attributes.position.count; i++)
        idx.push(i + offset);
    }
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length === pos.length) {
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  } else {
    geom.computeVertexNormals();
  }
  geom.setIndex(idx);
  return geom;
}
var pierDeckGeo = createPierDeckGeometry();
var pierPostGeo = new THREE.CylinderGeometry(1, 1, 10, 6);
var woodMat = createMaterial({color: 0x5d4037, flatShading: true});

// Bridge geometries (for West Coast Highway elevated viaducts)
var BRIDGE_SEGMENT_LENGTH = 30; // Z-length of each road/bridge segment
var BRIDGE_DECK_HEIGHT = 8;

// 1. Road deck: thin 1.5-unit slab (used for all road segments, keeping ground roads paper-thin)
var bridgeDeckGeo = new THREE.BoxGeometry(
  ChillFlightLogic.ROAD_WIDTH * 2 + 4,
  1.5, // Deck thickness
  BRIDGE_SEGMENT_LENGTH
);

// 2. Box girder: trapezoidal underside attached ONLY under elevated bridge spans
function createBridgeGirderGeometry() {
  const shape = new THREE.Shape();
  const wTop = ChillFlightLogic.ROAD_WIDTH + 1.5; // 31.5 -> total width 63
  const wBot = ChillFlightLogic.ROAD_WIDTH - 9; // 21 -> total width 42
  const yTop = -0.75; // Flush against bottom of deck
  const yBot = -4.75; // Depth of 4.0 units
  shape.moveTo(-wTop, yTop);
  shape.lineTo(wTop, yTop);
  shape.lineTo(wBot, yBot);
  shape.lineTo(-wBot, yBot);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: BRIDGE_SEGMENT_LENGTH,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -BRIDGE_SEGMENT_LENGTH / 2);
  geo.computeVertexNormals();
  return geo;
}
var bridgeGirderGeo = createBridgeGirderGeometry();

// 3. Modern parapet railings for bridge spans
var bridgeRailGeo = new THREE.BoxGeometry(1.2, 2.6, BRIDGE_SEGMENT_LENGTH);

// 4. Hammerhead pier cap (sculpted concrete bracket supporting the deck)
function createBridgePierCapGeometry() {
  const shape = new THREE.Shape();
  const wTop = ChillFlightLogic.ROAD_WIDTH - 2; // 28 -> spans 56 units under the deck
  const wSeat = 6.5; // Shaft seat width 13 units
  const yTop = -0.75; // Flush with deck bottom
  const yTip = -2.2; // Tapered outer cantilever wings
  const ySeat = -7.0; // Seat for pylon shaft
  shape.moveTo(-wTop, yTop);
  shape.lineTo(wTop, yTop);
  shape.lineTo(wTop, yTip);
  shape.lineTo(wSeat, ySeat);
  shape.lineTo(-wSeat, ySeat);
  shape.lineTo(-wTop, yTip);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 8,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -4);
  geo.computeVertexNormals();
  return geo;
}
var bridgePierCapGeo = createBridgePierCapGeometry();

// 5. Faceted octagonal pylon shaft (scalable Y)
function createBridgePierShaftGeometry() {
  // Octagonal column, width 10, depth 8, height 1.0 (from Y=0 down to Y=-1)
  const geo = new THREE.CylinderGeometry(1, 1, 1, 8);
  geo.scale(5.0, 1, 4.0);
  geo.translate(0, -0.5, 0); // Origin at top so scaling Y stretches downward
  geo.computeVertexNormals();
  return geo;
}
var bridgePierShaftGeo = createBridgePierShaftGeometry();

// 6. Foundation caisson footing (anchors pier into terrain/water)
function createBridgePierFootingGeometry() {
  const geo = new THREE.CylinderGeometry(1, 1, 4.5, 8);
  geo.scale(7.5, 1, 6.5); // Width 15, depth 13, height 4.5
  geo.computeVertexNormals();
  return geo;
}
var bridgePierFootingGeo = createBridgePierFootingGeometry();

// Expose geometries for debug model viewer and global access
if (typeof window !== 'undefined') {
  window.bridgeGirderGeo = bridgeGirderGeo;
  window.bridgePierCapGeo = bridgePierCapGeo;
  window.bridgePierShaftGeo = bridgePierShaftGeo;
  window.bridgePierFootingGeo = bridgePierFootingGeo;
}

var bridgeDeckMat = createMaterial({color: 0x4a4a4a, flatShading: true}); // Asphalt gray
var bridgePilingMat = createMaterial({color: 0x626262, flatShading: true}); // Concrete gray
var bridgeGirderMat = createMaterial({color: 0x555555, flatShading: true}); // Girder concrete gray
if (typeof window !== 'undefined') {
  window.bridgeGirderMat = bridgeGirderMat;
}

// Streetlight geometries
var streetlightPoleGeo = new THREE.CylinderGeometry(0.5, 0.8, 25, 6);
streetlightPoleGeo.translate(0, 12.5, 0); // Origin at base
var streetlightArmGeo = new THREE.CylinderGeometry(0.3, 0.5, 18, 6);
streetlightArmGeo.rotateZ(Math.PI / 2);
streetlightArmGeo.translate(8.5, 24, 0);
var streetlightBulbGeo = new THREE.BoxGeometry(1.5, 0.5, 1);
streetlightBulbGeo.translate(17, 23.8, 0);

var streetlightPoleMat = createMaterial({
  color: 0x222222,
  flatShading: true,
});
window.streetlightBulbMat = createMaterial({
  color: 0xffffff,
  emissive: 0xffeebb,
  emissiveIntensity: 2.0,
  flatShading: true,
});

// Streetlight Decal
var streetlightDecalGeo = new THREE.PlaneGeometry(40, 40);
streetlightDecalGeo.rotateX(-Math.PI / 2);
var decalCanvas = document.createElement('canvas');
decalCanvas.width = 128;
decalCanvas.height = 128;
var decalCtx = decalCanvas.getContext('2d');
var decalGradient = decalCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
decalGradient.addColorStop(0, 'rgba(120, 110, 60, 0.4)');
decalGradient.addColorStop(0.2, 'rgba(100, 90, 45, 0.25)');
decalGradient.addColorStop(0.5, 'rgba(60, 50, 25, 0.1)');
decalGradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
decalCtx.fillStyle = decalGradient;
decalCtx.fillRect(0, 0, 128, 128);
var decalTex = new THREE.CanvasTexture(decalCanvas);
window.streetlightDecalMat = new THREE.MeshBasicMaterial({
  map: decalTex,
  transparent: true,
  opacity: 1.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
window.streetlightDecalMat.onBeforeCompile = (shader) => {
  if (window.terrainUniforms) {
    shader.uniforms.uCameraPosXZ = window.terrainUniforms.uCameraPosXZ;
    shader.uniforms.uRenderRadius = window.terrainUniforms.uRenderRadius;
  }
  shader.vertexShader =
    `
    uniform vec2 uCameraPosXZ;
    varying float vDistanceXZ;
  ` + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    `#include <worldpos_vertex>`,
    `#include <worldpos_vertex>
     vec4 customWorldPosition = vec4( transformed, 1.0 );
     #ifdef USE_INSTANCING
       customWorldPosition = instanceMatrix * customWorldPosition;
     #endif
     customWorldPosition = modelMatrix * customWorldPosition;
     vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);`
  );
  shader.fragmentShader =
    `
    uniform float uRenderRadius;
    varying float vDistanceXZ;
  ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `#include <fog_fragment>
     if (uRenderRadius > 0.0) {
       float distRatio = vDistanceXZ / uRenderRadius;
       gl_FragColor.a *= (1.0 - smoothstep(0.75, 0.95, distRatio));
     }`
  );
};

// Tent geometries
function createTentBodyGeometry() {
  const geom = new THREE.BoxGeometry(8, 6, 10);
  geom.translate(0, 3, 0); // Base at Y=0
  const pos = geom.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] > 5) {
      // Top vertices
      pos[i] = 0; // Pinch X to 0 (ridge)
    }
  }
  geom.computeVertexNormals();
  return geom;
}
var tentGeo = createTentBodyGeometry();

function createTentEntranceGeometry() {
  const geom = new THREE.BoxGeometry(4, 4, 0.2);
  geom.translate(0, 2, 5.05); // Front of the tent
  const pos = geom.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] > 3) {
      // Top vertices
      pos[i] = 0; // Pinch to triangle
    }
  }
  geom.computeVertexNormals();
  return geom;
}
var tentEntranceGeo = createTentEntranceGeometry();

function createTentPolesGeometry() {
  const poleLength = Math.sqrt(4 * 4 + 6 * 6); // ~7.211
  const poleBase = new THREE.CylinderGeometry(0.2, 0.2, poleLength, 4);
  const angle = Math.atan2(4, 6); // Matches tent slope

  const poleF1 = poleBase.clone();
  poleF1.rotateZ(angle);
  poleF1.translate(2, 3, 5.2);

  const poleF2 = poleBase.clone();
  poleF2.rotateZ(-angle);
  poleF2.translate(-2, 3, 5.2);

  const poleB1 = poleBase.clone();
  poleB1.rotateZ(angle);
  poleB1.translate(2, 3, -5.2);

  const poleB2 = poleBase.clone();
  poleB2.rotateZ(-angle);
  poleB2.translate(-2, 3, -5.2);

  const ridgePole = new THREE.CylinderGeometry(0.2, 0.2, 11, 4);
  ridgePole.rotateX(Math.PI / 2);
  ridgePole.translate(0, 6.1, 0);

  const geos = [poleF1, poleF2, poleB1, poleB2, ridgePole];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geos) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++)
      idx.push(g.index.array[i] + offset);
    offset += g.attributes.position.count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
var tentPolesGeo = createTentPolesGeometry();
var tentEntranceMat = createMaterial({color: 0x111111, flatShading: true});
// Tent color palettes
var tentPalette = [
  createMaterial({color: 0xd2b48c, flatShading: true}), // Tan color
  createMaterial({color: 0x485c3f, flatShading: true}), // Army green
  createMaterial({color: 0x1d3557, flatShading: true}), // Navy blue
];
var tentMat = tentPalette[0];
window.tentPalette = tentPalette;

// Campfire geometries
var fireLogGeo = new THREE.CylinderGeometry(0.8, 0.8, 6, 6);
fireLogGeo.rotateZ(Math.PI / 2);
var fireCoreGeo = new THREE.SphereGeometry(2, 8, 8);
var fireMat = createMaterial({
  color: 0xff4500,
  emissive: 0xff4500,
  emissiveIntensity: 2.0,
});

// Smoke geometry and material community
var smokeGeo = new THREE.BoxGeometry(2, 2, 2);
var smokeMat = createMaterial({
  color: 0x888888,
  transparent: true,
  opacity: 0.4,
  flatShading: true,
});

var whiteSmokeMat = createMaterial({
  color: 0xdddddd,
  transparent: true,
  opacity: 0.6,
  flatShading: true,
});

window.fireMat = fireMat;
window.smokeMat = smokeMat;
window.whiteSmokeMat = whiteSmokeMat;

// --- GPU ANIMATION SHADER INJECTIONS ---
if (!window.animationUniforms) window.animationUniforms = {uTime: {value: 0}};

windmillBladesMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = window.animationUniforms.uTime;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\nuniform float uTime;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>
        float c = cos(uTime * 1.5);
        float s = sin(uTime * 1.5);
        mat3 rotZ = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
        transformed = rotZ * transformed;
    `
  );
};
windmillBladesDepthMat.onBeforeCompile = windmillBladesMat.onBeforeCompile;

fireMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = window.animationUniforms.uTime;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\nuniform float uTime;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
        float phase = instanceMatrix[3][0] + instanceMatrix[3][2];
        #else
        float phase = 0.0;
        #endif
        float pulse = 1.0 + sin(uTime * 10.0 + phase) * 0.2;
        transformed *= pulse;
    `
  );
};

var smokeShaderInject = (shader, isChimney) => {
  shader.uniforms.uTime = window.animationUniforms.uTime;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\nuniform float uTime;\nvarying float vFade;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `
        #include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
        float particleIndex = instanceColor.r * 10.0;
        float phase = instanceColor.g * 10.0;
        #else
        float particleIndex = 0.0;
        float phase = 0.0;
        #endif
        
        float maxLifetime = ${isChimney ? '2.4' : '2.0'};
        float offsetTime = mod(uTime * 0.5 + particleIndex * ${isChimney ? '0.6' : '0.4'} + phase, maxLifetime);
        float age = offsetTime / maxLifetime;
        
        // Emitter angle combines phase-based unique direction with slow global sway
        float emitterAngle = phase * 1.34 + sin(uTime * 0.2 + phase) * 0.5;
        
        // Dynamic fanning out / cone-spread per particle
        float particleAngle = emitterAngle + (particleIndex - ${isChimney ? '1.5' : '2.0'}) * 0.35;
        
        // Turbulence sways that grow larger as the particle rises
        float turbulence = offsetTime * 0.5;
        float swayX = sin(uTime * 1.2 + particleIndex * 2.3 + phase) * turbulence * 3.5;
        float swayZ = cos(uTime * 1.0 + particleIndex * 1.7 + phase * 1.3) * turbulence * 3.5;
        
        float rise = offsetTime * ${isChimney ? '45.0' : '60.0'};
        float driftX = cos(particleAngle) * offsetTime * ${isChimney ? '12.0' : '15.0'} + swayX;
        float driftZ = sin(particleAngle) * offsetTime * ${isChimney ? '12.0' : '15.0'} + swayZ;
        
        float smokeScale = (${isChimney ? '0.8' : '1.0'} + particleIndex * ${isChimney ? '0.3' : '0.5'}) * (1.0 + offsetTime * ${isChimney ? '0.6' : '0.5'});
        
        float st = sin(offsetTime * ${isChimney ? '0.5' : '1.0'});
        float ct = cos(offsetTime * ${isChimney ? '0.5' : '1.0'});
        mat3 rotY = mat3(ct, 0.0, st, 0.0, 1.0, 0.0, -st, 0.0, ct);
        mat3 rotZ = mat3(ct, -st, 0.0, st, ct, 0.0, 0.0, 0.0, 1.0);
        
        transformed = rotY * rotZ * transformed * smokeScale;
        transformed.x += driftX;
        transformed.y += rise;
        transformed.z += driftZ;
        
        // Smoothstep fade in at start and fade out at end
        float fadeIn = smoothstep(0.0, 0.15, age);
        float fadeOut = 1.0 - smoothstep(0.4, 1.0, age);
        vFade = fadeIn * fadeOut;
    `
  );

  shader.fragmentShader = `varying float vFade;\n` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>\ndiffuseColor.a *= vFade;`
  );
};

smokeMat.onBeforeCompile = (shader) => smokeShaderInject(shader, false);
whiteSmokeMat.onBeforeCompile = (shader) => smokeShaderInject(shader, true);

// Sailboat geometries
// Sailboat geometries
function createBoatHullBaseGeometry() {
  const main = new THREE.BoxGeometry(3.6, 2, 8);

  const prow = new THREE.BoxGeometry(3.6, 2, 4);
  prow.translate(0, 0, -6); // from -4 to -8
  const prowPos = prow.attributes.position.array;
  for (let i = 0; i < prowPos.length; i += 3) {
    if (prowPos[i + 2] < -5) {
      // front face at -8
      prowPos[i] = 0; // pinch X to 0
    }
  }
  prow.computeVertexNormals();

  const pos = [
    ...main.attributes.position.array,
    ...prow.attributes.position.array,
  ];
  const norm = [
    ...main.attributes.normal.array,
    ...prow.attributes.normal.array,
  ];
  const idx = [...main.index.array];
  let offset = main.attributes.position.count;
  for (let i = 0; i < prow.index.array.length; i++)
    idx.push(prow.index.array[i] + offset);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
var boatHullGeo = createBoatHullBaseGeometry();
boatHullGeo.translate(0, 0.5, 0);

function createBoatRimGeometry() {
  const main = new THREE.BoxGeometry(4.0, 0.4, 8.2);

  const prow = new THREE.BoxGeometry(4.0, 0.4, 4.2);
  prow.translate(0, 0, -6.2); // from -4.1 to -8.3
  const prowPos = prow.attributes.position.array;
  for (let i = 0; i < prowPos.length; i += 3) {
    if (prowPos[i + 2] < -5.2) {
      // front face at -8.3
      prowPos[i] = 0; // pinch X to 0
    }
  }
  prow.computeVertexNormals();

  const pos = [
    ...main.attributes.position.array,
    ...prow.attributes.position.array,
  ];
  const norm = [
    ...main.attributes.normal.array,
    ...prow.attributes.normal.array,
  ];
  const idx = [...main.index.array];
  let offset = main.attributes.position.count;
  for (let i = 0; i < prow.index.array.length; i++)
    idx.push(prow.index.array[i] + offset);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
var boatRimGeo = createBoatRimGeometry();
boatRimGeo.translate(0, 1.7, 0);

function createBoatDeckGeometry() {
  const main = new THREE.BoxGeometry(3.2, 0.2, 7.8);

  const prow = new THREE.BoxGeometry(3.2, 0.2, 4.0);
  prow.translate(0, 0, -5.9); // from -3.9 to -7.9
  const prowPos = prow.attributes.position.array;
  for (let i = 0; i < prowPos.length; i += 3) {
    if (prowPos[i + 2] < -4.9) {
      prowPos[i] = 0;
    }
  }
  prow.computeVertexNormals();

  const pos = [
    ...main.attributes.position.array,
    ...prow.attributes.position.array,
  ];
  const norm = [
    ...main.attributes.normal.array,
    ...prow.attributes.normal.array,
  ];
  const idx = [...main.index.array];
  let offset = main.attributes.position.count;
  for (let i = 0; i < prow.index.array.length; i++)
    idx.push(prow.index.array[i] + offset);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
var boatDeckGeo = createBoatDeckGeometry();
boatDeckGeo.translate(0, 1.91, 0); // slightly above the white rim (1.7 + 0.2)

var boatMastGeo = new THREE.CylinderGeometry(0.15, 0.15, 12, 4);
boatMastGeo.translate(0, 6, -1);
var boatBoomGeo = new THREE.CylinderGeometry(0.1, 0.1, 7, 4);
boatBoomGeo.rotateX(Math.PI / 2);
boatBoomGeo.translate(0, 2.5, 2.5);

var boatSailGeo = new THREE.BufferGeometry();
var sailVertices = new Float32Array([0, 2.5, -0.9, 0, 11, -0.9, 0, 2.5, 5.5]);
boatSailGeo.setAttribute(
  'position',
  new THREE.BufferAttribute(sailVertices, 3)
);
boatSailGeo.computeVertexNormals();

var boatHullPalette = [
  createMaterial({color: 0xaa0000, flatShading: true}), // Dark Red
  createMaterial({color: 0x004400, flatShading: true}), // Dark Green
  createMaterial({color: 0x000055, flatShading: true}), // Dark Blue
];
var boatHullMat = boatHullPalette[0];
var boatRimMat = createMaterial({color: 0xffffff, flatShading: true});
var boatDeckMat = createMaterial({color: 0xd2b48c, flatShading: true});
var boatSailMat = createMaterial({
  color: 0xffffff,
  flatShading: true,
  side: THREE.DoubleSide,
});

function mergeGeometries(geos) {
  let pos = [];
  let norm = [];
  let idx = [];
  let offset = 0;
  for (const g of geos) {
    pos.push(...g.attributes.position.array);
    if (g.attributes.normal) norm.push(...g.attributes.normal.array);
    if (g.index) {
      for (let i = 0; i < g.index.array.length; i++) {
        idx.push(g.index.array[i] + offset);
      }
    } else {
      const count = g.attributes.position.count;
      for (let i = 0; i < count; i++) {
        idx.push(i + offset);
      }
    }
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (norm.length > 0)
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}

function createPirateHullGeometry() {
  const main = new THREE.BoxGeometry(6, 4, 16);
  const prow = new THREE.BoxGeometry(6, 4, 6);
  prow.translate(0, 0, -11);
  const prowPos = prow.attributes.position.array;
  for (let i = 0; i < prowPos.length; i += 3) {
    if (prowPos[i + 2] < -10) prowPos[i] *= 0.2; // Pinch X
  }
  prow.computeVertexNormals();

  const stern = new THREE.BoxGeometry(6, 6, 6);
  stern.translate(0, 1, 11);

  const merged = mergeGeometries([main, prow, stern]);
  const pos = merged.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] < 0) {
      pos[i] *= 0.6; // Pinch bottom X for a boat shape
    }
  }
  merged.computeVertexNormals();
  return merged;
}
var pirateHullGeo = createPirateHullGeometry();
pirateHullGeo.translate(0, 1, 0); // lift above water

function createPirateRimGeometry() {
  const main = new THREE.BoxGeometry(6.4, 0.4, 16.4);
  const prow = new THREE.BoxGeometry(6.4, 0.4, 6.4);
  prow.translate(0, 0, -11.4);
  const prowPos = prow.attributes.position.array;
  for (let i = 0; i < prowPos.length; i += 3) {
    if (prowPos[i + 2] < -10.4) prowPos[i] *= 0.2;
  }
  prow.computeVertexNormals();

  const stern = new THREE.BoxGeometry(6.4, 0.4, 6.4);
  stern.translate(0, 1, 11.4);

  return mergeGeometries([main, prow, stern]);
}
var pirateRimGeo = createPirateRimGeometry();
pirateRimGeo.translate(0, 3, 0);

function createPirateDeckGeometry() {
  const main = new THREE.BoxGeometry(5.8, 0.2, 15.8);
  const prow = new THREE.BoxGeometry(5.8, 0.2, 5.8);
  prow.translate(0, 0, -10.8);
  const prowPos = prow.attributes.position.array;
  for (let i = 0; i < prowPos.length; i += 3) {
    if (prowPos[i + 2] < -9.8) prowPos[i] *= 0.2;
  }
  prow.computeVertexNormals();

  const stern = new THREE.BoxGeometry(5.8, 0.2, 5.8);
  stern.translate(0, 1, 10.8);

  return mergeGeometries([main, prow, stern]);
}
var pirateDeckGeo = createPirateDeckGeometry();
pirateDeckGeo.translate(0, 3.2, 0);

function createPirateMastGeometry() {
  const mainmast = new THREE.CylinderGeometry(0.3, 0.3, 24, 6);
  mainmast.translate(0, 14, 0);
  const foremast = new THREE.CylinderGeometry(0.25, 0.25, 20, 6);
  foremast.translate(0, 12, -7);
  const mizzenmast = new THREE.CylinderGeometry(0.2, 0.2, 16, 6);
  mizzenmast.translate(0, 11, 8);
  const bowsprit = new THREE.CylinderGeometry(0.15, 0.15, 10, 6);
  bowsprit.rotateX(-Math.PI / 3); // point UP and forward
  bowsprit.translate(0, 5, -12); // lower so it connects to the prow

  // Yardarms (horizontal poles holding the sails)
  const yards = [];
  const addYard = (width, y, z) => {
    const yard = new THREE.CylinderGeometry(0.1, 0.1, width, 6);
    yard.rotateZ(Math.PI / 2);
    yard.translate(0, y, z);
    yards.push(yard);
  };

  // Mainmast yards
  addYard(10.5, 15, -0.2);
  addYard(8.5, 20.5, -0.2);
  addYard(5.5, 25, -0.2);

  // Foremast yards
  addYard(8.5, 12.5, -7.2);
  addYard(6.5, 17, -7.2);

  // Mizzenmast yards
  addYard(6.5, 12.5, 7.8);

  return mergeGeometries([mainmast, foremast, mizzenmast, bowsprit, ...yards]);
}
var pirateMastGeo = createPirateMastGeometry();

function createPirateSailGeometry() {
  const sails = [];
  const createSail = (w, h, yOffset, zOffset) => {
    const sail = new THREE.BoxGeometry(w, h, 0.2, 4, 2);
    const pos = sail.attributes.position.array;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1]; // Local Y goes from -h/2 to h/2

      // We want billow to be 0 at the top (attached to yard), max at bottom.
      const factor = (h / 2 - y) / h;

      // Forward is negative Z.
      // 1. Pull edges back (positive Z)
      pos[i + 2] += x * x * 0.05 * factor;
      // 2. Push center forward (negative Z)
      pos[i + 2] -= factor * 1.5;
    }
    sail.computeVertexNormals();
    sail.translate(0, yOffset, zOffset);
    sails.push(sail);
  };

  // Mainmast sails
  createSail(10, 6, 12, -0.2);
  createSail(8, 5, 18, -0.2);
  createSail(5, 4, 23, -0.2);

  // Foremast sails
  createSail(8, 5, 10, -7.2);
  createSail(6, 4, 15, -7.2);

  // Mizzenmast sails
  createSail(6, 5, 10, 7.8);

  return mergeGeometries(sails);
}
var pirateSailGeo = createPirateSailGeometry();

var pirateFlagGeo = new THREE.PlaneGeometry(3, 2, 4, 2);
pirateFlagGeo.rotateY(Math.PI / 2); // align with Z axis
pirateFlagGeo.translate(0, 25, 1.5); // attach to mast at Z=0
var flagPos = pirateFlagGeo.attributes.position.array;
for (let i = 0; i < flagPos.length; i += 3) {
  const z = flagPos[i + 2];
  flagPos[i] += Math.sin(z * 2) * 0.3; // Wavy
}
pirateFlagGeo.computeVertexNormals();

var skull = new THREE.BoxGeometry(0.2, 0.4, 0.5);
skull.translate(0, 25.2, 1.5);
var bone1 = new THREE.BoxGeometry(0.2, 0.8, 0.15);
bone1.rotateX(Math.PI / 4);
bone1.translate(0, 24.6, 1.5);
var bone2 = new THREE.BoxGeometry(0.2, 0.8, 0.15);
bone2.rotateX(-Math.PI / 4);
bone2.translate(0, 24.6, 1.5);

var pirateJollyRogerGeo = mergeGeometries([skull, bone1, bone2]);
var jrPos = pirateJollyRogerGeo.attributes.position.array;
for (let i = 0; i < jrPos.length; i += 3) {
  const z = jrPos[i + 2];
  jrPos[i] += Math.sin(z * 2) * 0.3; // Match flag wave
}
pirateJollyRogerGeo.computeVertexNormals();

var pirateHullMat = createMaterial({color: 0x3d2314, flatShading: true}); // Dark brown wood
var pirateRimMat = createMaterial({color: 0x8b0000, flatShading: true}); // Dark red trim
var pirateFlagMat = createMaterial({
  color: 0x050505,
  flatShading: true,
  side: THREE.DoubleSide,
}); // Pitch black flag
var pirateJollyRogerMat = createMaterial({
  color: 0xeeeeee,
  flatShading: true,
}); // White skull & bones

// Sail color variants
var pirateSailPalette = [
  createMaterial({color: 0x111111, flatShading: true, side: THREE.DoubleSide}), // Black
  createMaterial({color: 0xffffff, flatShading: true, side: THREE.DoubleSide}), // White
  createMaterial({color: 0xd2c4a7, flatShading: true, side: THREE.DoubleSide}), // Dirty canvas
  createMaterial({color: 0x660000, flatShading: true, side: THREE.DoubleSide}), // Dark red
];

var reflectionMat = new THREE.MeshBasicMaterial({
  color: 0x07151e,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
});

var sailboatReflectionGeo = mergeGeometries([
  boatHullGeo,
  boatRimGeo,
  boatDeckGeo,
  boatMastGeo,
  boatBoomGeo,
  boatSailGeo,
]);

var pirateShipReflectionGeo = mergeGeometries([
  pirateHullGeo,
  pirateRimGeo,
  pirateDeckGeo,
  pirateMastGeo,
  pirateSailGeo,
  pirateFlagGeo,
  pirateJollyRogerGeo,
]);

// Lighthouse Beam geometry - wider and longer
var lighthouseBeamGeo = new THREE.CylinderGeometry(40, 2, 500, 16, 1, true);
lighthouseBeamGeo.rotateX(Math.PI / 2);
lighthouseBeamGeo.translate(0, 0, 250);

// Add vertex colors for a volumetric fade out
var count = lighthouseBeamGeo.attributes.position.count;
var colors = new Float32Array(count * 3);
var posArray = lighthouseBeamGeo.attributes.position.array;
var baseColor = new THREE.Color(0xffffaa);

for (let i = 0; i < count; i++) {
  const z = posArray[i * 3 + 2]; // Z goes from 0 to 500
  // Non-linear fade: keeps core bright, fades tail out smoothly
  const intensity = Math.pow(Math.max(0, 1.0 - z / 500), 1.5);
  colors[i * 3] = baseColor.r * intensity;
  colors[i * 3 + 1] = baseColor.g * intensity;
  colors[i * 3 + 2] = baseColor.b * intensity;
}
lighthouseBeamGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

var lighthouseBeamMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: LIGHTHOUSE_BEAM_OPACITY_MAX,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});

var persistentLighthouseLight = null;
var persistentLighthouseBeam = null;

window.initLighthouse = function () {
  if (persistentLighthouseLight) return; // Already initialized

  // Create spotlight
  persistentLighthouseLight = new THREE.SpotLight(
    0xffffaa,
    0,
    3000,
    Math.PI / 6,
    0.8,
    2
  );
  scene.add(persistentLighthouseLight);
  scene.add(persistentLighthouseLight.target);

  // Create beam
  persistentLighthouseBeam = new THREE.Mesh(
    lighthouseBeamGeo,
    lighthouseBeamMat
  );
  persistentLighthouseBeam.visible = false;
  scene.add(persistentLighthouseBeam);

  log.info('[Lighthouse] Persistent light and beam initialized.');
};

// --- VOLCANO ACTIVE ELEMENTS (pre-allocated, shared via ModelAssembler) ---
var volcanoLavaGeo = new THREE.CylinderGeometry(280, 280, 40, 16);
var volcanoLavaMat = new THREE.MeshBasicMaterial({color: 0xff4500});

// --- MODEL ASSEMBLER: SINGLE SOURCE OF TRUTH ---
// This object defines how complex multi-part models are constructed.
// Both terrain.js (during world gen) and debug.html (during preview)
// use this to ensure they stay in perfect sync.
window.ModelAssembler = {
  getStructure: function (id, rotY = 0, opts = {}) {
    switch (id) {
      case 'streetlight': {
        return [
          {
            geo: streetlightPoleGeo,
            mat: streetlightPoleMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: streetlightArmGeo,
            mat: streetlightPoleMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: streetlightBulbGeo,
            mat: window.streetlightBulbMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'house': {
        const bodyId = (opts.bodyId || 0) % houseBodyPalette.length;
        const roofId = (opts.roofId || 0) % houseRoofPalette.length;
        const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
          yAxis,
          rotY
        );
        return [
          {
            geo: houseBodyGeo,
            mat: houseBodyPalette[bodyId],
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: houseRoofGeo,
            mat: houseRoofPalette[roofId],
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: houseDoorGeo,
            mat: houseDoorMat,
            pos: [doorOffset.x, doorOffset.y, doorOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseChimneyGeo,
            mat: houseChimneyMat,
            pos: [chimneyOffset.x, chimneyOffset.y, chimneyOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[0],
            pos: [winF1Offset.x, winF1Offset.y, winF1Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[1],
            pos: [winF2Offset.x, winF2Offset.y, winF2Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[2],
            pos: [winBOffset.x, winBOffset.y, winBOffset.z],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'two_story_house': {
        const bodyId = (opts.bodyId || 0) % houseBodyPalette.length;
        const roofId = (opts.roofId || 0) % houseRoofPalette.length;
        const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF3Offset = new THREE.Vector3(0, 10, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF4Offset = new THREE.Vector3(-3.0, 10, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winF5Offset = new THREE.Vector3(3.0, 10, 5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winB2Offset = new THREE.Vector3(-3.0, 10, -5.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const winB3Offset = new THREE.Vector3(3.0, 10, -5.1).applyAxisAngle(
          yAxis,
          rotY
        );

        const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
          yAxis,
          rotY
        );
        return [
          {
            geo: twoStoryBodyGeo,
            mat: houseBodyPalette[bodyId],
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: twoStoryRoofGeo,
            mat: houseRoofPalette[roofId],
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: houseDoorGeo,
            mat: houseDoorMat,
            pos: [doorOffset.x, doorOffset.y, doorOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: twoStoryChimneyGeo,
            mat: houseChimneyMat,
            pos: [chimneyOffset.x, chimneyOffset.y, chimneyOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[0],
            pos: [winF1Offset.x, winF1Offset.y, winF1Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[1],
            pos: [winF2Offset.x, winF2Offset.y, winF2Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[2],
            pos: [winBOffset.x, winBOffset.y, winBOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[0],
            pos: [winF3Offset.x, winF3Offset.y, winF3Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[1],
            pos: [winF4Offset.x, winF4Offset.y, winF4Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[2],
            pos: [winF5Offset.x, winF5Offset.y, winF5Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[3],
            pos: [winB2Offset.x, winB2Offset.y, winB2Offset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseWindowGeo,
            mat: houseWindowMats[4],
            pos: [winB3Offset.x, winB3Offset.y, winB3Offset.z],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'straw_hut':
        return [
          {
            geo: strawHutBodyGeo,
            mat: strawHutMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: strawHutRoofGeo,
            mat: strawHutMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      case 'pagoda':
        return [
          {
            geo: pagodaBodyGeo,
            mat: pagodaBodyMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: pagodaRoofGeo,
            mat: pagodaRoofMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      case 'barn': {
        const doorFOffset = new THREE.Vector3(0, 4.5, 14.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const doorBOffset = new THREE.Vector3(0, 4.5, -14.1).applyAxisAngle(
          yAxis,
          rotY
        );
        const siloOffset = new THREE.Vector3(12, 0, 0).applyAxisAngle(
          yAxis,
          rotY
        );

        return [
          {
            geo: barnBodyGeo,
            mat: barnBodyMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: barnRoofGeo,
            mat: barnRoofMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          // Front Door
          {
            geo: barnDoorGeo,
            mat: barnWhiteMat,
            pos: [doorFOffset.x, doorFOffset.y, doorFOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: barnTrimGeo,
            mat: barnBodyMat,
            pos: [doorFOffset.x, doorFOffset.y, doorFOffset.z],
            rot: [0, rotY, Math.atan2(8, 9)],
          },
          {
            geo: barnTrimGeo,
            mat: barnBodyMat,
            pos: [doorFOffset.x, doorFOffset.y, doorFOffset.z],
            rot: [0, rotY, -Math.atan2(8, 9)],
          },
          // Back Door
          {
            geo: barnDoorGeo,
            mat: barnWhiteMat,
            pos: [doorBOffset.x, doorBOffset.y, doorBOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: barnTrimGeo,
            mat: barnBodyMat,
            pos: [doorBOffset.x, doorBOffset.y, doorBOffset.z],
            rot: [0, rotY, Math.atan2(8, 9)],
          },
          {
            geo: barnTrimGeo,
            mat: barnBodyMat,
            pos: [doorBOffset.x, doorBOffset.y, doorBOffset.z],
            rot: [0, rotY, -Math.atan2(8, 9)],
          },
          // Silo
          {
            geo: barnSiloBodyGeo,
            mat: barnSiloMat,
            pos: [siloOffset.x, siloOffset.y, siloOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: barnSiloRoofGeo,
            mat: barnSiloRoofMat,
            pos: [siloOffset.x, siloOffset.y, siloOffset.z],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'monastery':
        return [
          {
            geo: monasteryBodyGeo,
            mat: monasteryBodyMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: monasteryRoofGeo,
            mat: monasteryRoofMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      case 'windmill': {
        const hubOffset = new THREE.Vector3(0, 0, 16.5).applyAxisAngle(
          yAxis,
          rotY
        );
        return [
          {
            geo: windmillBaseGeo,
            mat: windmillBaseMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
            scale: [1.5, 1.5, 1.5],
          },
          {
            geo: windmillBladesGeo,
            mat: windmillBladesMat,
            pos: [hubOffset.x, 45, hubOffset.z],
            rot: [0, rotY, 0],
            scale: [1.5, 1.5, 1.5],
          },
          {
            geo: windmillBladesGeo,
            mat: windmillBladesMat,
            pos: [hubOffset.x, 45, hubOffset.z],
            rot: [0, rotY, Math.PI / 2],
            scale: [1.5, 1.5, 1.5],
          },
          {
            geo: windmillBladesGeo,
            mat: windmillBladesMat,
            pos: [hubOffset.x, 45, hubOffset.z],
            rot: [0, rotY, Math.PI],
            scale: [1.5, 1.5, 1.5],
          },
          {
            geo: windmillBladesGeo,
            mat: windmillBladesMat,
            pos: [hubOffset.x, 45, hubOffset.z],
            rot: [0, rotY, (3 * Math.PI) / 2],
            scale: [1.5, 1.5, 1.5],
          },
        ];
      }
      case 'lighthouse': {
        const houseOffset = new THREE.Vector3(16, 0, 0).applyAxisAngle(
          yAxis,
          rotY
        );
        const flagpoleOffset = new THREE.Vector3(-15, 0, 10).applyAxisAngle(
          yAxis,
          rotY
        );
        return [
          {
            geo: lighthouseTowerBottomGeo,
            mat: lighthouseWhiteMat,
            pos: [0, 10, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: lighthouseTowerMidGeo,
            mat: lighthouseBandMat,
            pos: [0, 30, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: lighthouseTowerTopGeo,
            mat: lighthouseWhiteMat,
            pos: [0, 50, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: lighthouseLanternGeo,
            mat: lighthouseGlassMat,
            pos: [0, 63, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: lighthouseInnerLightGeo,
            mat: lighthouseGlowMat,
            pos: [0, 63, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: lighthouseDomeGeo,
            mat: lighthouseBlackMat,
            pos: [0, 66, 0],
            rot: [0, rotY, 0],
          },
          // House
          {
            geo: houseBodyGeo,
            mat: lighthouseWhiteMat,
            pos: [houseOffset.x, 0, houseOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: houseRoofGeo,
            mat: lighthouseRedMat,
            pos: [houseOffset.x, 0, houseOffset.z],
            rot: [0, rotY, 0],
          },
          // Flagpole
          {
            geo: flagpoleGeo,
            mat: woodMat,
            pos: [flagpoleOffset.x, 10, flagpoleOffset.z],
            rot: [0, rotY, 0],
          },
          {
            geo: flagGeo,
            mat: lighthouseRedMat,
            pos: [flagpoleOffset.x, 20, flagpoleOffset.z],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'campfire':
        return [
          {
            geo: fireLogGeo,
            mat: woodMat,
            pos: [0, 1, 0],
            rot: [0, rotY, 0.5],
            order: 'YXZ',
          },
          {
            geo: fireLogGeo,
            mat: woodMat,
            pos: [0, 1, 0],
            rot: [0, rotY + (2 * Math.PI) / 3, 0.5],
            order: 'YXZ',
          },
          {
            geo: fireLogGeo,
            mat: woodMat,
            pos: [0, 1, 0],
            rot: [0, rotY + (4 * Math.PI) / 3, 0.5],
            order: 'YXZ',
          },
          {geo: fireCoreGeo, mat: fireMat, pos: [0, 2, 0], rot: [0, rotY, 0]},
        ];
      case 'hawk':
        return [
          {
            geo: hawkBodyGeo,
            mat: hawkBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: hawkBellyGeo,
            mat: hawkLightMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: hawkHeadGeo,
            mat: hawkBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: hawkBeakGeo,
            mat: hawkBeakMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: hawkTailGeo,
            mat: hawkBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: hawkWingGeo,
            mat: hawkBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: hawkWingGeo,
            mat: hawkBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
            scale: [-1, 1, 1],
          },
        ];
      case 'seagull':
        return [
          {
            geo: seagullBodyGeo,
            mat: seagullWhiteMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: seagullHeadGeo,
            mat: seagullWhiteMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: seagullBeakGeo,
            mat: seagullBeakMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: seagullTailGeo,
            mat: seagullWhiteMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: seagullWingGeo,
            mat: seagullGreyMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: seagullWingTipGeo,
            mat: seagullBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: seagullWingGeo,
            mat: seagullGreyMat,
            pos: [0, 0, 0],
            rot: [0, rotY + Math.PI, 0],
          },
          {
            geo: seagullWingTipGeo,
            mat: seagullBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY + Math.PI, 0],
          },
        ];
      case 'goose':
        return [
          {
            geo: gooseBodyGeo,
            mat: gooseBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseNeckGeo,
            mat: gooseBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseHeadGeo,
            mat: gooseBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseBeakGeo,
            mat: gooseBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseCheekGeo,
            mat: gooseWhiteMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseWhiteTailGeo,
            mat: gooseWhiteMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseTailGeo,
            mat: gooseBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseWingGeo,
            mat: gooseBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: gooseWingGeo,
            mat: gooseBrownMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
            scale: [-1, 1, 1],
          },
        ];
      case 'sailboat': {
        const bodyId = (opts.bodyId || 0) % boatHullPalette.length;
        return [
          {
            geo: boatHullGeo,
            mat: boatHullPalette[bodyId],
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {geo: boatRimGeo, mat: boatRimMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
          {
            geo: boatDeckGeo,
            mat: boatDeckMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {geo: boatMastGeo, mat: woodMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
          {geo: boatBoomGeo, mat: woodMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
          {
            geo: boatSailGeo,
            mat: boatSailMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'pirateship': {
        const sailId = (opts.bodyId || 0) % pirateSailPalette.length;
        return [
          {
            geo: pirateHullGeo,
            mat: pirateHullMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: pirateRimGeo,
            mat: pirateRimMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {geo: pirateDeckGeo, mat: woodMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
          {geo: pirateMastGeo, mat: woodMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
          {
            geo: pirateSailGeo,
            mat: pirateSailPalette[sailId],
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: pirateFlagGeo,
            mat: pirateFlagMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: pirateJollyRogerGeo,
            mat: pirateJollyRogerMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      }
      case 'volcano_active_elements':
        return [
          {
            geo: volcanoLavaGeo,
            mat: volcanoLavaMat,
            pos: [0, 980, 0],
            rot: [0, rotY, 0],
          },
        ];
      case 'iceberg':
        return [
          {
            geo: icebergMainGeo,
            mat: icebergMat,
            pos: [0, -4, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: icebergMainGeo,
            mat: icebergMat,
            pos: [14, -8, 6],
            rot: [0, rotY + 1.2, 0],
            scale: [0.5, 0.4, 0.5],
          },
          {
            geo: icebergMainGeo,
            mat: icebergMat,
            pos: [-12, -9, -8],
            rot: [0, rotY - 0.8, 0],
            scale: [0.4, 0.3, 0.4],
          },
        ];
      case 'iceFloe':
        return [
          {
            geo: iceFloeMainGeo,
            mat: icebergMat,
            pos: [0, -1, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: iceFloeMainGeo,
            mat: icebergMat,
            pos: [16, -1.8, 4],
            rot: [0, rotY + 0.5, 0],
            scale: [0.5, 0.6, 0.5],
          },
          {
            geo: iceFloeMainGeo,
            mat: icebergMat,
            pos: [-15, -2, -6],
            rot: [0, rotY - 0.5, 0],
            scale: [0.4, 0.5, 0.4],
          },
        ];
      case 'penguin':
        return [
          {
            geo: penguinBodyGeo,
            mat: penguinBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinBellyGeo,
            mat: penguinWhiteMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinHeadGeo,
            mat: penguinBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinBeakGeo,
            mat: penguinOrangeMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinWingLGeo,
            mat: penguinBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinWingRGeo,
            mat: penguinBlackMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinFootLGeo,
            mat: penguinOrangeMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
          {
            geo: penguinFootRGeo,
            mat: penguinOrangeMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      default:
        return null;
    }
  },
};

function getBiome(x, z) {
  return ChillFlightLogic.getBiome(x, z, simplex);
}

// Performance optimization: Direct-mapped typed array cache for procedural elevation queries.
// Quantizes coordinates to 0.5 units (~18 inches) to memoize redundant procedural noise calculations
// from flight collision, camera ground clearance, and geese flocking within and across frames.
// Uses pre-allocated typed arrays and integer bitwise hashing to eliminate GC allocations entirely.
var _ELEV_CACHE_SIZE = 512;
var _ELEV_CACHE_MASK = _ELEV_CACHE_SIZE - 1;
var _elevCacheKeyX = new Float32Array(_ELEV_CACHE_SIZE);
var _elevCacheKeyZ = new Float32Array(_ELEV_CACHE_SIZE);
var _elevCacheVal = new Float32Array(_ELEV_CACHE_SIZE);
var _elevCacheValid = new Uint8Array(_ELEV_CACHE_SIZE);

window.clearElevationCache = function () {
  _elevCacheValid.fill(0);
};

var _ELEV_PARAMS = {
  WATER_LEVEL,
  MOUNTAIN_LEVEL,
  MAP_WORLD_SIZE,
  MAP_HEIGHT_SCALE,
};

function getElevation(x, z) {
  // Quantize coordinates to 0.5 units for spatial memoization
  const ix = Math.round(x * 2);
  const iz = Math.round(z * 2);
  const qx = ix * 0.5;
  const qz = iz * 0.5;

  const slot = (((ix * 73856093) ^ (iz * 19349663)) >>> 0) & _ELEV_CACHE_MASK;

  if (
    _elevCacheValid[slot] &&
    _elevCacheKeyX[slot] === qx &&
    _elevCacheKeyZ[slot] === qz
  ) {
    return _elevCacheVal[slot];
  }

  let n = ChillFlightLogic.getElevation(
    x,
    z,
    simplex,
    _ELEV_PARAMS,
    THREE.MathUtils.lerp
  );

  // Add a large island for the Montauk lighthouse at chunk 5,2 (world 7500, 3000)
  const dx = x - 7500;
  const dz = z - 3000;
  const distSq = dx * dx + dz * dz;
  const islandRadius = 400; // Big island
  if (distSq < islandRadius * islandRadius) {
    const dist = Math.sqrt(distSq);
    const factor = 1.0 - dist / islandRadius;
    const sFactor = factor * factor * (3 - 2 * factor); // Smoothstep

    // Add noise to make it irregular
    const noise = simplex.noise2D(x * 0.002, z * 0.002) * 0.5 + 0.5; // [0, 1]
    const irregularFactor = sFactor * (0.7 + noise * 0.3);

    // Raise terrain to at least WATER_LEVEL + 20 in the center
    n = Math.max(n, WATER_LEVEL + 20 * irregularFactor);
  }

  _elevCacheKeyX[slot] = qx;
  _elevCacheKeyZ[slot] = qz;
  _elevCacheVal[slot] = n;
  _elevCacheValid[slot] = 1;

  return n;
}

// Optimization: Pre-allocate colors used in chunk generation loop to prevent GC stalling
var _colorPlains = new THREE.Color(0x7cb342);
var _colorForest = new THREE.Color(0x388e3c);
var _colorSnow = new THREE.Color(0xfafafa); // Crisp alpine snow white
var _colorPackIce = new THREE.Color(0xa2b4bc); // Slate pack ice shelf
var _colorSand = new THREE.Color(0xe0e0a8);
var _colorWetSand = new THREE.Color(0xb09d6b);
var _colorDesertSand = new THREE.Color(0xf4a460);
var _colorDesertWetSand = new THREE.Color(0xc47e3c);
var _colorWater = new THREE.Color(0x40c4ff);
var _colorIcyWater = new THREE.Color(0x88ccff);
var _colorDesertWater = new THREE.Color(0x00ced1);
var _colorFoam = new THREE.Color(0xeeeeee);
var _colorSandSnowTint = new THREE.Color(0x999999);
var _colorUpperSandSnowTint = new THREE.Color(0xdddddd);
var _colorForestSnowTint = new THREE.Color(0x8ba192);
var _colorForestDesertTint = new THREE.Color(0xa0522d);
var _colorPlainsSnowTint = new THREE.Color(0xfafafa);
var _colorMountainDesertTint = new THREE.Color(0xcd853f);
var _colorMountainTint = new THREE.Color(0x7f8c8d);
var _colorAlpineRockDark = new THREE.Color(0x424a54); // Deep slate granite cliff
var _colorAlpineRockLight = new THREE.Color(0x9ba2a8); // High ridge granite
var _colorScree = new THREE.Color(0x736960); // Earthy scree / talus gravel
var _colorDesertMountainRock = new THREE.Color(0xc24b2b); // Red sandstone
var _colorIce = new THREE.Color(0x6ca6a8); // Frosty cyan ice
var _colorAutumnForestTint = new THREE.Color(0x5d4037);
var _colorAutumnPlainsTint = new THREE.Color(0x8d6e63);
var _colorCherryForestTint = new THREE.Color(0xf8bbd0);
var _colorCherryPlainsTint = new THREE.Color(0xfce4ec);
// Mottling & detail colors (promoted from hot loop to avoid per-vertex GC allocations)
var _colorBlack = new THREE.Color(0x000000);
var _colorSandMottleHigh = new THREE.Color(0xd2b48c);
var _colorSandMottleLow = new THREE.Color(0xdeb887);
var _colorArizonaDark = new THREE.Color(0x8b0000);
var _colorDesertMottle = new THREE.Color(0xdaa520);
var _colorForestDark = new THREE.Color(0x006400);
var _colorForestDeep = new THREE.Color(0x004d00);
var _colorForestLight = new THREE.Color(0x6b8e23);
var _colorPlainsDark = new THREE.Color(0x556b2f);
var _colorPlainsBright = new THREE.Color(0xbdb76b);
var _colorCliffSouth = new THREE.Color(0x8b3a3a);
var _colorVolcanoBasaltHi = new THREE.Color(0x5c5c5c);
var _colorVolcanoBasaltLo = new THREE.Color(0x3a3a3a);
// Eastern Alien Biome (Swirling, organic, neon)
var _colorEasternLowland = new THREE.Color(0x1a4d3a); // Deep teal (bioluminescent jungle floor)
var _colorEasternRock = new THREE.Color(0x1a0a2e); // Obsidian purple-black
var _colorEasternPeak = new THREE.Color(0xc8f000); // Acid yellow-green peak
var _colorEasternCliff = new THREE.Color(0x4b0082); // Deep indigo cliff face
var _colorEasternWater = new THREE.Color(0x00ffe7); // Neon cyan water

// Western Alien Biome (Crystalline, geometric, fiery/magenta)
var _colorWesternLowland = new THREE.Color(0x400020); // Deep maroon/magenta dust
var _colorWesternRock = new THREE.Color(0x200000); // Dark crimson rock
var _colorWesternPeak = new THREE.Color(0xffffff); // Blinding white crystal peak
var _colorWesternCliff = new THREE.Color(0xff4500); // Glowing orange-red fiery faults
var _colorWesternWater = new THREE.Color(0xff00ff); // Hot pink/magenta liquid

// East coast road
var _colorRoad = new THREE.Color(0x3a3a3a); // Dark asphalt
var _colorRoadCenterLine = new THREE.Color(0xccaa00); // Dashed yellow center line
var _colorRoadShoulder = new THREE.Color(0x555555); // Lighter edge
