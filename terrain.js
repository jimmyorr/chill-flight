// --- PROCEDURAL TERRAIN & CHUNKS ---
// Dependencies: THREE, simplex, CHUNK_SIZE, SEGMENTS, WATER_LEVEL, MOUNTAIN_LEVEL, scene

const chunks = new Map();

// GPU water uniform — shared globally so game.js animate() can update uTime
window.waterUniforms = {
  uTime: {value: 0.0},
  uSunDirection: {value: new THREE.Vector3(0, 1, 0)},
  uSunColor: {value: new THREE.Color(0xffffff)},
};

const _initQualityForTerrain = localStorage.getItem('chill_flight_quality');
const _isLowQualityInitial =
  _initQualityForTerrain && parseInt(_initQualityForTerrain) <= 20;

const _enableBlockClouds = ChillFlightLogic.SHOW_BLOCK_CLOUDS;
let _enableObjects = ChillFlightLogic.SHOW_OBJECTS;
// Flag removed to fix issue #25

// Volcano center — single source of truth for all coloring and landmark placement
const VOLCANO_X = -5000;
const VOLCANO_Z = 5000;

// Materials for terrain
const terrainMaterial = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.8,
});

const waterMaterial = createMaterial({
  vertexColors: true,
  transparent: !_isLowQualityInitial,
  opacity: _isLowQualityInitial ? 1.0 : 0.85,
  metalness: 0.1,
  roughness: 0.05,
  flatShading: true,
});

// Inject GPU wave math into the water material's vertex shader.
// This replaces the CPU-side per-vertex loop and computeVertexNormals().
waterMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = window.waterUniforms.uTime;

  shader.uniforms.uSunDirection = window.waterUniforms.uSunDirection;
  shader.uniforms.uSunColor = window.waterUniforms.uSunColor;

  // Add time uniform declaration to the top of the vertex shader
  shader.vertexShader =
    `
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
        vec3 transformed = vec3(position);
        vec4 worldPosV = modelMatrix * vec4(position, 1.0);

        float macroWave = sin(worldPosV.x * 0.0002) * cos(worldPosV.z * 0.00025);
        float waveAmp = 0.8 + macroWave * 0.4;

        // Wave math running in parallel on the GPU
        float wave1 = sin(uTime + worldPosV.x * 0.02) * waveAmp;
        float wave2 = cos(uTime * 0.8 + worldPosV.z * 0.015) * waveAmp;

        transformed.y += wave1 + wave2;
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
  );

  shader.fragmentShader =
    `
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
    ` + shader.fragmentShader;

  // Inject custom specular
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <dithering_fragment>`,
    `
        #include <dithering_fragment>

        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 sunReflNormal = normalize(vSmoothNormal);
        
        // Add macro-scale spatial variation to break up monotony across different water bodies
        float macro = sin(vWorldPosition.x * 0.0002) * cos(vWorldPosition.z * 0.00025);
        float rippleScale = 0.1 + macro * 0.05; // 0.05 to 0.15
        float timeScale = 1.5 + macro * 0.5; // 1.0 to 2.0
        float perturbStrength = 0.05 + macro * 0.03; // 0.02 to 0.08
        
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

        vec3 halfVector = normalize(uSunDirection + viewDir);
        float dotNormalHalf = max(dot(sunReflNormal, halfVector), 0.0);
        
        // Specular intensity
        float specularIntensity = pow(dotNormalHalf, 200.0); // Softer, broader organic glints
        float fresnel = 1.0 - max(dot(viewDir, sunReflNormal), 0.0);
        fresnel = pow(fresnel, 3.0);
        
        vec3 sunHighlight = uSunColor * specularIntensity * (0.3 + fresnel * 0.7);
        gl_FragColor.rgb += sunHighlight;
        `
  );
};

// --- CLOUD GLOBALS ---
const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
const cloudMat = createMaterial({
  color: 0xffffff,
  transparent: !_isLowQualityInitial,
  opacity: _isLowQualityInitial ? 1.0 : CLOUD_OPACITY,
  flatShading: true,
  roughness: 1.0,
});

cloudMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = window.waterUniforms.uTime;
  shader.uniforms.uSunDirection = window.waterUniforms.uSunDirection;
  shader.uniforms.uSunColor = window.waterUniforms.uSunColor;

  shader.vertexShader =
    `
        uniform float uTime;
        varying float vLocalY;
        varying vec3 vWorldNormal;
    ` + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    `#include <project_vertex>`,
    `
        vLocalY = position.y;
        vec4 mvPosition = vec4( transformed, 1.0 );
        
        float drift = mod(uTime * 2.64, 2000.0);
        
        #ifdef USE_INSTANCING
            mat4 modInstanceMatrix = instanceMatrix;
            modInstanceMatrix[3].x = mod(modInstanceMatrix[3].x + drift + 1000.0, 2000.0) - 1000.0;
            mvPosition = modInstanceMatrix * mvPosition;
            vWorldNormal = normalize((modInstanceMatrix * vec4(normal, 0.0)).xyz);
        #else
            mvPosition.x = mod(mvPosition.x + drift + 1000.0, 2000.0) - 1000.0;
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        #endif

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `
  );

  shader.fragmentShader =
    `
        uniform vec3 uSunDirection;
        uniform vec3 uSunColor;
        varying float vLocalY;
        varying vec3 vWorldNormal;
    ` + shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <color_fragment>`,
    `
        #include <color_fragment>
        
        float cloudYNorm = clamp(vLocalY + 0.5, 0.0, 1.0);
        
        // 1. Ambient Sky Light (Blueish shadow core)
        vec3 aoColor = vec3(0.55, 0.65, 0.85); 
        vec3 baseAmbient = mix(aoColor, vec3(1.0), cloudYNorm);
        
        // 2. Sun Directional Light
        // How much is the face pointing towards the sun?
        float sunIncidence = max(0.0, dot(vWorldNormal, normalize(uSunDirection)));
        
        // 3. Subsurface Scattering / Under-lighting
        // Sun hits the bottom and bleeds through. Very intense during sunset.
        float sunElevation = max(0.0, uSunDirection.y);
        float sunsetFactor = pow(1.0 - sunElevation, 3.0); // 1.0 at sunset, 0.0 at noon
        
        // The bottom gets a HUGE boost of sun color during sunset
        float underLight = (1.0 - cloudYNorm) * sunsetFactor;
        
        // Combine lighting
        vec3 finalLight = baseAmbient;
        finalLight += uSunColor * sunIncidence * 0.8; // Direct sunlight
        finalLight += uSunColor * underLight * 1.5;   // Sunset underglow
        
        diffuseColor.rgb *= finalLight;
        
        #ifndef OPAQUE
        diffuseColor.a = opacity;
        #endif
        `
  );
};

// Reusable tree geometries for forest instances
const treeTrunkGeo = new THREE.CylinderGeometry(1.5, 2.5, 14, 6);
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
const treeLeavesGeo = createPineGeometry();

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
const deciduousGeos = createDeciduousGeometry();

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
const japaneseMapleGeos = createJapaneseMapleGeometry();

function createPalmGeometry() {
  // Stacked, flared trunk segments to create a bumpy, ridged bark texture
  const trunkSegments = 6;
  const segHeight = 3.5;
  const trunkHeight = trunkSegments * segHeight;
  const trunkGeos = [];

  for (let j = 0; j < trunkSegments; j++) {
    const tBottom = j / trunkSegments;
    const tTop = (j + 1) / trunkSegments;

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
  const frondLength = 15;
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
const palmGeos = createPalmGeometry();

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
const deadTreeGeo = createDeadTreeGeometry();

const treeTrunkMat = createMaterial({color: 0x5d4037, flatShading: true});
// Leaf materials use WHITE as the base color so per-instance colors control the actual appearance
// (Three.js multiplies instance color × material color, so white = identity / no tint)
const treeLeavesBaseMat = createMaterial({color: 0xffffff, flatShading: true});
const deadTreeMat = createMaterial({color: 0x8d6e63, flatShading: true});

// Rock geometries and materials
const rockGeo = new THREE.DodecahedronGeometry(3, 0); // Base flat shaded rock
const rockMat = createMaterial({color: 0x888888, flatShading: true});
const snowRockMat = createMaterial({color: 0xdddddd, flatShading: true});
const desertRockMat = createMaterial({color: 0xd2b48c, flatShading: true});

// Cactus geometries and materials
function createCactusGeometry() {
  const mainGeo = new THREE.CylinderGeometry(1.5, 1.5, 12, 6);
  mainGeo.translate(0, 6, 0);
  const armGeo1 = new THREE.CylinderGeometry(1, 1, 5, 5);
  armGeo1.translate(2.5, 6, 0);
  const armGeo2 = new THREE.CylinderGeometry(1, 1, 6, 5);
  armGeo2.translate(-2.5, 4, 0);
  const geometries = [mainGeo, armGeo1, armGeo2];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++) {
      idx.push(g.index.array[i] + offset);
    }
    offset += g.attributes.position.count;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
const cactusGeo = createCactusGeometry();
const cactusMat = createMaterial({color: 0x4caf50, flatShading: true});

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
const lilyPadGeo = createLilyPadGeometry();
const lilyPadMat = createMaterial({color: 0x4caf50, flatShading: true});

// Bush geometry and material
function createBushGeometry() {
  // Clustered spheres for a bushy look
  const b1 = new THREE.SphereGeometry(1.5, 6, 6);
  b1.translate(0, 1.5, 0);
  const b2 = new THREE.SphereGeometry(1.2, 6, 6);
  b2.translate(1, 1, 0.5);
  const b3 = new THREE.SphereGeometry(1.3, 6, 6);
  b3.translate(-0.8, 1.2, -0.8);

  const geometries = [b1, b2, b3];
  let pos = [],
    norm = [],
    idx = [];
  let offset = 0;

  for (const g of geometries) {
    pos.push(...g.attributes.position.array);
    norm.push(...g.attributes.normal.array);
    for (let i = 0; i < g.index.array.length; i++) {
      idx.push(g.index.array[i] + offset);
    }
    offset += g.attributes.position.count;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);

  return geom;
}
const bushGeo = createBushGeometry();
const bushMat = createMaterial({color: 0x558b2f, flatShading: true}); // Darker green

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
const snowmanGeos = createSnowmanGeometry();
const snowmanBodyMat = createMaterial({color: 0xffffff, flatShading: true});
const snowmanNoseMat = createMaterial({color: 0xff8c00, flatShading: true});

// Autumn & Cherry Blossom materials
const autumnLeavesMat1 = createMaterial({color: 0xd35400, flatShading: true}); // Burnt Orange
const autumnLeavesMat2 = createMaterial({color: 0xf39c12, flatShading: true}); // Orange
const autumnLeavesMat3 = createMaterial({color: 0xc0392b, flatShading: true}); // Strong Red
const cherryBlossomMat = createMaterial({color: 0xf8bbd0, flatShading: true}); // Pink

// Reusable house geometries
const houseBodyGeo = new THREE.BoxGeometry(10, 8, 10);
houseBodyGeo.translate(0, 4, 0);
const houseRoofGeo = new THREE.ConeGeometry(8.5, 6, 4);
houseRoofGeo.rotateY(Math.PI / 4);
houseRoofGeo.translate(0, 11, 0);
const houseWindowGeo = new THREE.BoxGeometry(2, 2.5, 0.5);

const houseDoorGeo = new THREE.BoxGeometry(2.5, 4.5, 0.5);
const houseChimneyGeo = new THREE.BoxGeometry(1.5, 5, 1.5);
houseChimneyGeo.translate(0, 11, 0);

const houseDoorMat = createMaterial({color: 0x5c4033, flatShading: true});
const houseChimneyMat = createMaterial({color: 0x8b3a3a, flatShading: true});

// Two story house geometries
const twoStoryBodyGeo = new THREE.BoxGeometry(10, 14, 10);
twoStoryBodyGeo.translate(0, 7, 0);
const twoStoryRoofGeo = new THREE.ConeGeometry(8.5, 7, 4);
twoStoryRoofGeo.rotateY(Math.PI / 4);
twoStoryRoofGeo.translate(0, 17.5, 0);
const twoStoryChimneyGeo = new THREE.BoxGeometry(1.5, 5, 1.5);
twoStoryChimneyGeo.translate(0, 17.5, 0);

// Straw hut geometries
const strawHutBodyGeo = new THREE.CylinderGeometry(4, 4, 6, 8);
strawHutBodyGeo.translate(0, 3, 0);
const strawHutRoofGeo = new THREE.ConeGeometry(5.5, 5, 8);
strawHutRoofGeo.translate(0, 8.5, 0);
const strawHutMat = createMaterial({color: 0xe6c280, flatShading: true}); // Straw color

// House color palettes
const houseBodyPalette = [
  createMaterial({color: 0xf5e6c8, flatShading: true}), // Cream
  createMaterial({color: 0xd9b99b, flatShading: true}), // Sandy tan
  createMaterial({color: 0xb0c4a0, flatShading: true}), // Sage green
  createMaterial({color: 0xc8d8e8, flatShading: true}), // Pale blue
  createMaterial({color: 0xe8c8b0, flatShading: true}), // Terracotta peach
  createMaterial({color: 0xccbbcc, flatShading: true}), // Dusty mauve
];
const houseRoofPalette = [
  createMaterial({color: 0x5d4037, flatShading: true}), // Dark brown
  createMaterial({color: 0x7b3f2a, flatShading: true}), // Brick red
  createMaterial({color: 0x546e7a, flatShading: true}), // Slate blue-grey
  createMaterial({color: 0x4a4a3a, flatShading: true}), // Charcoal
];

// Window Materials (5 variations for staggered lighting)
const houseWindowMats = [];
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
const pagodaBodyGeo = createPagodaBodyGeometry();
const pagodaRoofGeo = createPagodaRoofGeometry();
const pagodaBodyMat = createMaterial({color: 0x3e2723, flatShading: true}); // dark wood
const pagodaRoofMat = createMaterial({color: 0x1b5e20, flatShading: true}); // deep green eaves

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
const barnBodyGeo = new THREE.BoxGeometry(18, 12, 28);
barnBodyGeo.translate(0, 6, 0);
const barnRoofGeo = createBarnRoofGeometry();

// Details
const barnDoorGeo = new THREE.BoxGeometry(8, 9, 0.5);
const barnTrimGeo = new THREE.BoxGeometry(0.5, 12.04, 0.6); // sqrt(8^2 + 9^2) = 12.04

const barnSiloBodyGeo = new THREE.CylinderGeometry(4, 4, 22, 12);
barnSiloBodyGeo.translate(0, 11, 0);
const barnSiloRoofGeo = new THREE.SphereGeometry(4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
barnSiloRoofGeo.translate(0, 22, 0);

const barnBodyMat = createMaterial({color: 0x9b1c1c, flatShading: true}); // classic barn red
const barnRoofMat = createMaterial({color: 0x3e2723, flatShading: true}); // dark timber
const barnWhiteMat = createMaterial({color: 0xeeeeee, flatShading: true});
const barnSiloMat = createMaterial({color: 0xaaaaaa, metalness: 0.2, roughness: 0.6, flatShading: true});
const barnSiloRoofMat = createMaterial({color: 0xc2c2c2, metalness: 0.3, roughness: 0.5, flatShading: true});
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
  const geo = new THREE.ExtrudeGeometry(shape, {depth: depth + overhang * 2, bevelEnabled: false});
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

const monasteryBodyGeo = createMonasteryBodyGeometry();
const monasteryRoofGeo = createMonasteryRoofGeometry();
const monasteryBodyMat = createMaterial({color: 0x9e9e9e, flatShading: true}); // stone
const monasteryRoofMat = createMaterial({color: 0x546e7a, flatShading: true}); // slate

// --- CASTLE RUINS ---
function createCastleRuinsGeometry() {
  const geometries = [];

  // Helper to add battlements to a circular tower
  function addCircularBattlements(radius, y, cx, cz, count) {
    for (let i = 0; i < count; i++) {
      if (Math.random() > 0.3) {
        const angle = (i / count) * Math.PI * 2;
        const b = new THREE.BoxGeometry(2, 2.5, 2);
        b.translate(Math.cos(angle) * radius + cx, y + 1.25, Math.sin(angle) * radius + cz);
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
    const chunk = new THREE.BoxGeometry(3, Math.random() * 4 + 1, 3);
    const angle = Math.random() * Math.PI * 2;
    chunk.rotateY(Math.random());
    chunk.rotateZ(Math.random() * 0.2);
    chunk.translate(Math.cos(angle) * 3 + 24, 18 + Math.random(), Math.sin(angle) * 3 + 4);
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
     if (Math.random() > 0.2) {
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
    block.rotateX(Math.random());
    block.rotateY(Math.random());
    block.rotateZ(Math.random());
    const angle = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 20;
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
const castleRuinsGeo = createCastleRuinsGeometry();
const castleRuinsMat = createMaterial({color: 0x78909c, flatShading: true}); // weathered stone

// Bird geometry
// Hawk geometries
const hawkBodyGeo = new THREE.BoxGeometry(1.2, 0.8, 3.5);
const hawkBellyGeo = new THREE.BoxGeometry(1.25, 0.2, 2.5);
hawkBellyGeo.translate(0, -0.35, -0.2);
const hawkHeadGeo = new THREE.BoxGeometry(0.8, 0.8, 1.0);
hawkHeadGeo.translate(0, 0.2, -2.0);
const hawkBeakGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
hawkBeakGeo.rotateX(-Math.PI / 2);
hawkBeakGeo.translate(0, 0.1, -2.8);
const hawkTailGeo = new THREE.BoxGeometry(1.4, 0.2, 1.5);
hawkTailGeo.translate(0, 0, 2.2);
const hawkWingGeo = new THREE.BoxGeometry(5, 0.1, 2.5);
hawkWingGeo.translate(2.5, 0, 0);

const hawkBrownMat = createMaterial({color: 0x4a2e15, flatShading: true});
const hawkLightMat = createMaterial({color: 0xd2b48c, flatShading: true}); // Tan belly
const hawkBeakMat = createMaterial({color: 0xffcc00, flatShading: true}); // Yellow beak

// Canada Goose geometries
const gooseBodyGeo = new THREE.BoxGeometry(1.2, 0.9, 3.5);
const gooseNeckGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6);
gooseNeckGeo.rotateX(Math.PI / 2);
gooseNeckGeo.translate(0, 0.5, -2.5);
const gooseHeadGeo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
gooseHeadGeo.translate(0, 0.5, -4.0);
const gooseBeakGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
gooseBeakGeo.rotateX(-Math.PI / 2);
gooseBeakGeo.translate(0, 0.5, -4.8);
const gooseCheekGeo = new THREE.BoxGeometry(0.65, 0.3, 0.5);
gooseCheekGeo.translate(0, 0.4, -4.0);
const gooseTailGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
gooseTailGeo.translate(0, 0.2, 2.0);
const gooseWhiteTailGeo = new THREE.BoxGeometry(1.0, 0.5, 1.0);
gooseWhiteTailGeo.translate(0, -0.1, 1.5);

const gooseBrownMat = createMaterial({color: 0x8b7355, flatShading: true});
const gooseBlackMat = createMaterial({color: 0x222222, flatShading: true});
const gooseWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
const gooseWingGeo = new THREE.BoxGeometry(6, 0.1, 2);
gooseWingGeo.translate(3, 0, 0);

// Windmill geometries
const windmillBaseGeo = new THREE.CylinderGeometry(5, 8, 30, 6);
windmillBaseGeo.translate(0, 15, 0);
const windmillBladesGeo = new THREE.BoxGeometry(2, 30, 0.5);
windmillBladesGeo.translate(0, 15, 0); // Rotate around bottom center
const windmillBaseMat = createMaterial({color: 0x8d6e63, flatShading: true});
const windmillBladesMat = createMaterial({color: 0xeeeeee, flatShading: true});

// Lighthouse geometries
const lighthouseTowerBottomGeo = new THREE.CylinderGeometry(8, 9, 20, 8);
const lighthouseTowerMidGeo = new THREE.CylinderGeometry(7, 8, 20, 8);
const lighthouseTowerTopGeo = new THREE.CylinderGeometry(6, 7, 20, 8);
const lighthouseLanternGeo = new THREE.CylinderGeometry(5.5, 5.5, 6, 8);
const lighthouseInnerLightGeo = new THREE.CylinderGeometry(3, 3, 5, 8);
const lighthouseDomeGeo = new THREE.SphereGeometry(
  5.5,
  8,
  8,
  0,
  Math.PI * 2,
  0,
  Math.PI / 2
);

const flagpoleGeo = new THREE.CylinderGeometry(0.2, 0.2, 20, 4);
const flagGeo = new THREE.BoxGeometry(4, 3, 0.1);

const lighthouseRedMat = createMaterial({color: 0xc62828, flatShading: true});
const lighthouseWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
const lighthouseBandMat = createMaterial({color: 0x7b3f2a, flatShading: true}); // Reddish-brown
const lighthouseBlackMat = createMaterial({color: 0x212121, flatShading: true}); // Dark grey/black
const lighthouseGlassMat = createMaterial({
  color: 0x212121,
  flatShading: true,
  transparent: true,
  opacity: 0.4,
});
const lighthouseGlowMat = createMaterial({
  color: 0xffffaa,
  emissive: 0xffffaa,
  emissiveIntensity: 1.0,
});

// Pier geometries
const pierDeckGeo = new THREE.BoxGeometry(15, 2, 30);
pierDeckGeo.translate(0, 1, 15); // Extend from shore
const pierPostGeo = new THREE.CylinderGeometry(1, 1, 10, 6);
const woodMat = createMaterial({color: 0x5d4037, flatShading: true});

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
const tentGeo = createTentBodyGeometry();

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
const tentEntranceGeo = createTentEntranceGeometry();

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
const tentPolesGeo = createTentPolesGeometry();
const tentEntranceMat = createMaterial({color: 0x111111, flatShading: true});
// Tent color palettes
const tentPalette = [
  createMaterial({color: 0xd2b48c, flatShading: true}), // Tan color
  createMaterial({color: 0x485c3f, flatShading: true}), // Army green
  createMaterial({color: 0x1d3557, flatShading: true}), // Navy blue
];
const tentMat = tentPalette[0];

// Campfire geometries
const fireLogGeo = new THREE.CylinderGeometry(0.8, 0.8, 6, 6);
fireLogGeo.rotateZ(Math.PI / 2);
const fireCoreGeo = new THREE.SphereGeometry(2, 8, 8);
const fireMat = createMaterial({
  color: 0xff4500,
  emissive: 0xff4500,
  emissiveIntensity: 2.0,
});

// Smoke geometry and material community
const smokeGeo = new THREE.BoxGeometry(2, 2, 2);
const smokeMat = createMaterial({
  color: 0x888888,
  transparent: true,
  opacity: 0.4,
  flatShading: true,
});

const whiteSmokeMat = createMaterial({
  color: 0xdddddd,
  transparent: true,
  opacity: 0.6,
  flatShading: true,
});

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

const smokeShaderInject = (shader, isChimney) => {
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
const boatHullGeo = createBoatHullBaseGeometry();
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
const boatRimGeo = createBoatRimGeometry();
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
const boatDeckGeo = createBoatDeckGeometry();
boatDeckGeo.translate(0, 1.91, 0); // slightly above the white rim (1.7 + 0.2)

const boatMastGeo = new THREE.CylinderGeometry(0.15, 0.15, 12, 4);
boatMastGeo.translate(0, 6, -1);
const boatBoomGeo = new THREE.CylinderGeometry(0.1, 0.1, 7, 4);
boatBoomGeo.rotateX(Math.PI / 2);
boatBoomGeo.translate(0, 2.5, 2.5);

const boatSailGeo = new THREE.BufferGeometry();
const sailVertices = new Float32Array([0, 2.5, -0.9, 0, 11, -0.9, 0, 2.5, 5.5]);
boatSailGeo.setAttribute(
  'position',
  new THREE.BufferAttribute(sailVertices, 3)
);
boatSailGeo.computeVertexNormals();

const boatHullPalette = [
  createMaterial({color: 0xaa0000, flatShading: true}), // Dark Red
  createMaterial({color: 0x004400, flatShading: true}), // Dark Green
  createMaterial({color: 0x000055, flatShading: true}), // Dark Blue
];
const boatHullMat = boatHullPalette[0];
const boatRimMat = createMaterial({color: 0xffffff, flatShading: true});
const boatDeckMat = createMaterial({color: 0xd2b48c, flatShading: true});
const boatSailMat = createMaterial({
  color: 0xffffff,
  flatShading: true,
  side: THREE.DoubleSide,
});

// Lighthouse Beam geometry - wider and longer
const lighthouseBeamGeo = new THREE.CylinderGeometry(40, 2, 500, 16, 1, true);
lighthouseBeamGeo.rotateX(Math.PI / 2);
lighthouseBeamGeo.translate(0, 0, 250);

// Add vertex colors for a volumetric fade out
const count = lighthouseBeamGeo.attributes.position.count;
const colors = new Float32Array(count * 3);
const posArray = lighthouseBeamGeo.attributes.position.array;
const baseColor = new THREE.Color(0xffffaa);

for (let i = 0; i < count; i++) {
  const z = posArray[i * 3 + 2]; // Z goes from 0 to 500
  // Non-linear fade: keeps core bright, fades tail out smoothly
  const intensity = Math.pow(Math.max(0, 1.0 - z / 500), 1.5);
  colors[i * 3] = baseColor.r * intensity;
  colors[i * 3 + 1] = baseColor.g * intensity;
  colors[i * 3 + 2] = baseColor.b * intensity;
}
lighthouseBeamGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const lighthouseBeamMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: LIGHTHOUSE_BEAM_OPACITY_MAX,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});

let persistentLighthouseLight = null;
let persistentLighthouseBeam = null;

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

  console.log('[Lighthouse] Persistent light and beam initialized.');
};

// --- VOLCANO ACTIVE ELEMENTS (pre-allocated, shared via ModelAssembler) ---
const volcanoLavaGeo = new THREE.SphereGeometry(300, 16, 16);
const volcanoLavaMat = new THREE.MeshBasicMaterial({color: 0xff4500});

// --- MODEL ASSEMBLER: SINGLE SOURCE OF TRUTH ---
// This object defines how complex multi-part models are constructed.
// Both terrain.js (during world gen) and debug.html (during preview)
// use this to ensure they stay in perfect sync.
window.ModelAssembler = {
  getStructure: function (id, rotY = 0, opts = {}) {
    switch (id) {
      case 'house': {
        const bodyId = (opts.bodyId || 0) % houseBodyPalette.length;
        const roofId = (opts.roofId || 0) % houseRoofPalette.length;
        const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rotY
        );
        const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rotY
        );
        const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rotY
        );
        const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rotY
        );
        const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
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
        const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winF3Offset = new THREE.Vector3(0, 10, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winF4Offset = new THREE.Vector3(-3.0, 10, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winF5Offset = new THREE.Vector3(3.0, 10, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winB2Offset = new THREE.Vector3(-3.0, 10, -5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const winB3Offset = new THREE.Vector3(3.0, 10, -5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

        const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        return [
          { geo: twoStoryBodyGeo, mat: houseBodyPalette[bodyId], pos: [0, 0, 0], rot: [0, rotY, 0] },
          { geo: twoStoryRoofGeo, mat: houseRoofPalette[roofId], pos: [0, 0, 0], rot: [0, rotY, 0] },
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
        const doorFOffset = new THREE.Vector3(0, 4.5, 14.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const doorBOffset = new THREE.Vector3(0, 4.5, -14.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
        const siloOffset = new THREE.Vector3(12, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

        return [
          { geo: barnBodyGeo, mat: barnBodyMat, pos: [0, 0, 0], rot: [0, rotY, 0] },
          { geo: barnRoofGeo, mat: barnRoofMat, pos: [0, 0, 0], rot: [0, rotY, 0] },
          // Front Door
          { geo: barnDoorGeo, mat: barnWhiteMat, pos: [doorFOffset.x, doorFOffset.y, doorFOffset.z], rot: [0, rotY, 0] },
          { geo: barnTrimGeo, mat: barnBodyMat, pos: [doorFOffset.x, doorFOffset.y, doorFOffset.z], rot: [0, rotY, Math.atan2(8, 9)] },
          { geo: barnTrimGeo, mat: barnBodyMat, pos: [doorFOffset.x, doorFOffset.y, doorFOffset.z], rot: [0, rotY, -Math.atan2(8, 9)] },
          // Back Door
          { geo: barnDoorGeo, mat: barnWhiteMat, pos: [doorBOffset.x, doorBOffset.y, doorBOffset.z], rot: [0, rotY, 0] },
          { geo: barnTrimGeo, mat: barnBodyMat, pos: [doorBOffset.x, doorBOffset.y, doorBOffset.z], rot: [0, rotY, Math.atan2(8, 9)] },
          { geo: barnTrimGeo, mat: barnBodyMat, pos: [doorBOffset.x, doorBOffset.y, doorBOffset.z], rot: [0, rotY, -Math.atan2(8, 9)] },
          // Silo
          { geo: barnSiloBodyGeo, mat: barnSiloMat, pos: [siloOffset.x, siloOffset.y, siloOffset.z], rot: [0, rotY, 0] },
          { geo: barnSiloRoofGeo, mat: barnSiloRoofMat, pos: [siloOffset.x, siloOffset.y, siloOffset.z], rot: [0, rotY, 0] }
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
      case 'windmill':
        const hubOffset = new THREE.Vector3(0, 0, 8.5).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
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
      case 'lighthouse':
        const houseOffset = new THREE.Vector3(16, 0, 0).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          rotY
        );
        const flagpoleOffset = new THREE.Vector3(-15, 0, 10).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
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
      case 'bird':
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
      case 'volcano_active_elements':
        return [
          {
            geo: volcanoLavaGeo,
            mat: volcanoLavaMat,
            pos: [0, 890, 0],
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

function getElevation(x, z) {
  let n = ChillFlightLogic.getElevation(
    x,
    z,
    simplex,
    {WATER_LEVEL, MOUNTAIN_LEVEL, MAP_WORLD_SIZE, MAP_HEIGHT_SCALE},
    THREE.MathUtils.lerp
  );

  // Add a large island for the Montauk lighthouse at chunk 4,2 (world 6000, 3000)
  const dx = x - 6000;
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

  return n;
}

// Optimization: Pre-allocate colors used in chunk generation loop to prevent GC stalling
const _colorPlains = new THREE.Color(0x7cb342);
const _colorForest = new THREE.Color(0x388e3c);
const _colorSnow = new THREE.Color(0xffffff);
const _colorSand = new THREE.Color(0xe0e0a8);
const _colorDesertSand = new THREE.Color(0xf4a460);
const _colorWater = new THREE.Color(0x40c4ff);
const _colorIcyWater = new THREE.Color(0x88ccff);
const _colorDesertWater = new THREE.Color(0x00ced1);
const _colorFoam = new THREE.Color(0xeeeeee);
const _colorSandSnowTint = new THREE.Color(0x999999);
const _colorUpperSandSnowTint = new THREE.Color(0xdddddd);
const _colorForestSnowTint = new THREE.Color(0x8ba192);
const _colorForestDesertTint = new THREE.Color(0xa0522d);
const _colorPlainsSnowTint = new THREE.Color(0xfafafa);
const _colorMountainDesertTint = new THREE.Color(0xcd853f);
const _colorMountainTint = new THREE.Color(0x7f8c8d);
const _colorAutumnForestTint = new THREE.Color(0x5d4037);
const _colorAutumnPlainsTint = new THREE.Color(0x8d6e63);
const _colorCherryForestTint = new THREE.Color(0xf8bbd0);
const _colorCherryPlainsTint = new THREE.Color(0xfce4ec);
// Mottling & detail colors (promoted from hot loop to avoid per-vertex GC allocations)
const _colorBlack = new THREE.Color(0x000000);
const _colorSandMottleHigh = new THREE.Color(0xd2b48c);
const _colorSandMottleLow = new THREE.Color(0xdeb887);
const _colorArizonaDark = new THREE.Color(0x8b0000);
const _colorDesertMottle = new THREE.Color(0xdaa520);
const _colorForestDark = new THREE.Color(0x006400);
const _colorForestDeep = new THREE.Color(0x004d00);
const _colorForestLight = new THREE.Color(0x6b8e23);
const _colorPlainsDark = new THREE.Color(0x556b2f);
const _colorPlainsBright = new THREE.Color(0xbdb76b);
const _colorCliffSouth = new THREE.Color(0x8b3a3a);
const _colorVolcanoBasaltHi = new THREE.Color(0x5c5c5c);
const _colorVolcanoBasaltLo = new THREE.Color(0x3a3a3a);
// Eastern Alien Biome (Swirling, organic, neon)
const _colorEasternLowland = new THREE.Color(0x1a4d3a); // Deep teal (bioluminescent jungle floor)
const _colorEasternRock = new THREE.Color(0x1a0a2e); // Obsidian purple-black
const _colorEasternPeak = new THREE.Color(0xc8f000); // Acid yellow-green peak
const _colorEasternCliff = new THREE.Color(0x4b0082); // Deep indigo cliff face
const _colorEasternWater = new THREE.Color(0x00ffe7); // Neon cyan water

// Western Alien Biome (Crystalline, geometric, fiery/magenta)
const _colorWesternLowland = new THREE.Color(0x400020); // Deep maroon/magenta dust
const _colorWesternRock = new THREE.Color(0x200000); // Dark crimson rock
const _colorWesternPeak = new THREE.Color(0xffffff); // Blinding white crystal peak
const _colorWesternCliff = new THREE.Color(0xff4500); // Glowing orange-red fiery faults
const _colorWesternWater = new THREE.Color(0xff00ff); // Hot pink/magenta liquid

function generateChunk(chunkX, chunkZ) {
  const group = new THREE.Group();
  group.userData.worldPosition = new THREE.Vector3(
    chunkX * CHUNK_SIZE,
    0,
    chunkZ * CHUNK_SIZE
  );
  scene.add(group);

  // Start background generation in the next macro-task so the chunk map registers it first
  setTimeout(buildChunk, 0);
  return group;

  async function buildChunk() {
    const rng = ChillFlightLogic.chunkRng(chunkX, chunkZ);
    const isCustom = !!ChillFlightLogic.customMap;

    const elevationCache = new Map();
    function getCachedElevation(x, z) {
      // Round to 1 decimal place for the key to handle slight floating point variances
      const key = Math.round(x * 10) + '_' + Math.round(z * 10);
      if (elevationCache.has(key)) return elevationCache.get(key);
      const h = getElevation(x, z);
      elevationCache.set(key, h);
      return h;
    }

    // 1. Generate Terrain Mesh
    const geometry = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      SEGMENTS,
      SEGMENTS
    );
    geometry.userData = {unique: true};
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position.array;
    const colors = [];
    const _tempColorObj = new THREE.Color();

    const worldOffsetX = chunkX * CHUNK_SIZE;
    const worldOffsetZ = chunkZ * CHUNK_SIZE;

    const treePositions = []; // Pines (Snow/Mountain)
    const deciduousTreePositions = []; // Standard green oak
    const palmTreePositions = []; // Tropical
    const deadTreePositions = []; // Desert
    const snowTreePositions = [];
    const autumnTree1Positions = [];
    const autumnTree2Positions = [];
    const autumnTree3Positions = [];
    const cherryTreePositions = [];
    const yellowCortezTreePositions = [];
    const japaneseMapleTreePositions = [];
    const housePositions = [];
    const twoStoryHousePositions = [];
    const strawHutPositions = [];
    const windmillPositions = [];
    let lighthousePos = null;
    const isMontaukChunk = chunkX === 4 && chunkZ === 2;
    let bestMontaukPos = null;
    let fallbackMontaukPos = null;
    const pierPositions = [];
    const campfirePositions = [];
    const chimneySmokePositions = [];
    const sailboatPositions = [];
    const rockPositions = [];
    const snowRockPositions = [];
    const desertRockPositions = [];
    const cactusPositions = [];
    const snowmanPositions = [];
    const lilyPadPositions = [];
    const bushPositions = [];
    const pagodaPositions = [];
    const barnPositions = [];
    const monasteryPositions = [];
    const castleRuinsPositions = [];
    let hasWater = false;

    // Normalize density so higher SEGMENTS doesn't mean more trees/houses/etc
    const densityFactor = 40 / SEGMENTS;
    const densityScale = densityFactor * densityFactor;
    let maxChunkHeight = WATER_LEVEL;

    for (let i = 0; i < positions.length; i += 3) {
      if (i > 0 && i % 1500 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const localX = positions[i];
      const localZ = positions[i + 2];
      const worldX = worldOffsetX + localX;
      const worldZ = worldOffsetZ + localZ;
      const isAlienLand = Math.abs(worldX) > 25000;

      const height = getCachedElevation(worldX, worldZ);
      positions[i + 1] = height;
      if (height > maxChunkHeight) maxChunkHeight = height;

      // --- ORGANIC TEXTURING & SLOPE LOGIC ---
      // 1. Calculate local slope (quick approximation)
      const sampleOffset = 4.0;
      const hRight = getCachedElevation(worldX + sampleOffset, worldZ);
      const hDown = getCachedElevation(worldX, worldZ + sampleOffset);
      const slopeX = (hRight - height) / sampleOffset;
      const slopeZ = (hDown - height) / sampleOffset;
      const slope = Math.sqrt(slopeX * slopeX + slopeZ * slopeZ);
      const slopeFactor = Math.min(1, slope * 0.5); // [0, 1] — steeper means higher factor

      // 2. Procedural Mottling (Multi-octave patches)
      const mottle1 = simplex.noise2D(worldX * 0.002, worldZ * 0.002);
      const mottle2 = simplex.noise2D(worldX * 0.01, worldZ * 0.01) * 0.3;
      const mottle = (mottle1 + mottle2 + 0.5) * 0.5; // Shifted [0, 1] range approx

      // 3. High-frequency micro-grain
      const grain = simplex.noise2D(worldX * 0.2, worldZ * 0.2) * 0.05;

      // --- EXTREME ZONE FACTOR (East/West beyond 5 degrees) ---
      const extremeEdgeWorld = 25000;
      const absWorldX = Math.abs(worldX);
      const extremeZoneFactor = Math.max(
        0,
        Math.min(1, (absWorldX - extremeEdgeWorld) / 10000)
      );
      // Smoothstep for a less abrupt transition
      const extremeBlend =
        extremeZoneFactor * extremeZoneFactor * (3 - 2 * extremeZoneFactor);

      // --- BIOME FACTORS ---
      const northInfluence = Math.max(0, -worldZ / 4500);
      // Add more noise to biome transitions to avoid smooth boring circles
      const noisePath = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
      const biomeNoise =
        simplex.noise2D(worldX * 0.0005, worldZ * 0.0005) * 0.1;

      const snowRaw = Math.max(
        0,
        Math.min(
          1,
          (northInfluence + noisePath * 0.05 + biomeNoise - 0.7) * 1.5
        )
      );
      const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);

      const southInfluence = Math.max(0, worldZ / 4500);
      const desertRaw = Math.max(
        0,
        Math.min(
          1,
          (southInfluence + noisePath * 0.05 - biomeNoise - 0.7) * 1.5
        )
      );
      const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

      const temperature = noisePath - northInfluence * 1.5;
      const isSnowBiome = snowFactor > 0.5;

      // East code beachfront
      const eastCoastFactor = Math.max(0, Math.min(1, worldX / 3000));
      const sandMaxHeight = WATER_LEVEL + 2 + eastCoastFactor * 8;

      const isForest =
        simplex.noise2D(worldX * 0.005 + 100, worldZ * 0.005) > 0.2;
      const autumnNoise = simplex.noise2D(
        worldX * 0.0003 + 500,
        worldZ * 0.0003 + 500
      );
      const cherryNoise = simplex.noise2D(
        worldX * 0.0005 + 1000,
        worldZ * 0.0005 + 1000
      );

      // --- COLOR ASSIGNMENT & FEATURE SPAWNING ---
      if (isCustom) {
        let finalHeight = height;
        // Altitude mapping (38.0 -> 125.5 range)
        if (height <= WATER_LEVEL + 5.0) {
          hasWater = true;
          _tempColorObj.copy(_colorSand);

          // Smooth dip from 5 units deep at water level to 0 at +5 units elevation
          // This ensures that shallow land stays underwater and avoids Z-fighting.
          const t = Math.max(0, Math.min(1, (height - WATER_LEVEL) / 5.0));
          const dip = 5.0 * (1.0 - t);
          finalHeight = height - dip;
        } else if (height > 105.0) {
          _tempColorObj.copy(_colorMountainTint);
        } else {
          _tempColorObj.copy(isForest ? _colorForest : _colorPlains);
          // Apply subtle mottling for custom maps too
          _tempColorObj.lerp(_colorBlack, mottle * 0.1);
        }
        positions[i + 1] = finalHeight;
      } else {
        if (height <= sandMaxHeight) {
          if (height <= WATER_LEVEL) {
            hasWater = true;
            if (_enableObjects) {
              if (rng() < 0.0005 * densityScale) {
                // Very rare sailboat
                sailboatPositions.push({
                  x: localX,
                  y: WATER_LEVEL,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                });
              }
              if (
                snowFactor < 0.1 &&
                desertFactor < 0.1 &&
                getBiome(worldX, worldZ) > -0.15 &&
                rng() < 0.015 * densityScale
              ) {
                lilyPadPositions.push({
                  x: localX,
                  y: WATER_LEVEL,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                });
              }
            }
            positions[i + 1] = height - 5;
            _tempColorObj.copy(_colorSand);
            if (snowFactor > 0)
              _tempColorObj.lerp(_colorSandSnowTint, snowFactor);
            if (desertFactor > 0)
              _tempColorObj.lerp(_colorDesertSand, desertFactor);
          } else if (height <= WATER_LEVEL + 0.5) {
            _tempColorObj.copy(_colorFoam);
            if (snowFactor > 0) _tempColorObj.lerp(_colorSnow, snowFactor);
          } else {
            _tempColorObj.copy(_colorSand);
            if (snowFactor > 0)
              _tempColorObj.lerp(_colorUpperSandSnowTint, snowFactor);
            if (desertFactor > 0)
              _tempColorObj.lerp(_colorDesertSand, desertFactor);

            // Mottling for sand (adding some dark/light patches)
            if (!isCustom && mottle > 0.6)
              _tempColorObj.lerp(_colorSandMottleHigh, (mottle - 0.6) * 0.5);
            if (!isCustom && mottle < 0.4)
              _tempColorObj.lerp(_colorSandMottleLow, (0.4 - mottle) * 0.5);
          }
        } else if (
          height > MOUNTAIN_LEVEL ||
          (snowFactor > 0.5 && height > MOUNTAIN_LEVEL - 50)
        ) {
          // Massive sierra gets highly refined, patchy-to-solid snow OR Arizona desert rock
          const sierraSnowNoise1 = simplex.noise2D(
            worldX * 0.003,
            worldZ * 0.003
          );
          const sierraSnowNoise2 =
            simplex.noise2D(worldX * 0.012, worldZ * 0.012) * 0.5;
          const organicNoise = sierraSnowNoise1 + sierraSnowNoise2;

          const isSouth = worldZ > 0;
          const canHaveSnow = !isSouth;

          if (height > 600) {
            const baseThreshold = 1450 + organicNoise * 400;
            if (
              canHaveSnow &&
              (height > baseThreshold || (height > 2000 && organicNoise > -0.5))
            ) {
              _tempColorObj.copy(_colorSnow);
            } else {
              if (isSouth) {
                _tempColorObj.setHex(0xc24b2b); // Reddish mountain rock
                if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, 0.4);
                // Arizona mottling: subtle dark red patches
                if (mottle > 0.7) _tempColorObj.lerp(_colorArizonaDark, 0.2);
              } else {
                _tempColorObj.copy(
                  desertFactor > 0.5
                    ? _colorMountainDesertTint
                    : _colorMountainTint
                );
              }
            }
          } else {
            const rockStartHeight = MOUNTAIN_LEVEL + 500 + organicNoise * 100;
            if (
              canHaveSnow &&
              height > MOUNTAIN_LEVEL + 50 + organicNoise * 60
            ) {
              _tempColorObj.copy(_colorSnow);
            } else if (height > rockStartHeight) {
              if (isSouth) {
                _tempColorObj.setHex(0xc24b2b);
                if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, 0.4);
                if (mottle > 0.7) _tempColorObj.lerp(_colorArizonaDark, 0.2);
              } else {
                _tempColorObj.copy(
                  desertFactor > 0.5
                    ? _colorMountainDesertTint
                    : _colorMountainTint
                );
              }
            } else {
              if (desertFactor > 0.3) {
                _tempColorObj.copy(_colorDesertSand);
                if (height > WATER_LEVEL + 5)
                  _tempColorObj.lerp(_colorSandMottleHigh, 0.3);
                // Desert mottling
                _tempColorObj.lerp(_colorDesertMottle, mottle * 0.2);
              } else if (snowFactor > 0.4) {
                _tempColorObj.copy(_colorForestSnowTint);
              } else {
                _tempColorObj.copy(_colorForest);
                // Forest mottling: darker green patches
                if (!isCustom)
                  _tempColorObj.lerp(_colorForestDark, mottle * 0.3);
              }
            }
          }
        } else {
          // --- STANDARD LAND COLORING (Plains/Forest) ---
          if (isForest) {
            _tempColorObj.copy(_colorForest);
            if (snowFactor > 0)
              _tempColorObj.lerp(_colorForestSnowTint, snowFactor);
            if (desertFactor > 0)
              _tempColorObj.lerp(_colorForestDesertTint, desertFactor);

            // Mottling for Forest: Mix in some darker evergreens and lighter mossy patches
            _tempColorObj.lerp(_colorForestDeep, mottle * 0.4);
            if (mottle < 0.3) _tempColorObj.lerp(_colorForestLight, 0.2);
          } else {
            _tempColorObj.copy(_colorPlains);
            if (snowFactor > 0)
              _tempColorObj.lerp(_colorPlainsSnowTint, snowFactor);
            if (desertFactor > 0)
              _tempColorObj.lerp(_colorDesertSand, desertFactor);

            // Mottling for Plains: Dry grass vs lush grass
            _tempColorObj.lerp(_colorPlainsDark, mottle * 0.4);
            if (mottle > 0.8) _tempColorObj.lerp(_colorPlainsBright, 0.3);
          }
        }
      }

      // --- EXTREME ZONE COLOR BLEND ---
      // Gradually paint alien colors over whatever biome is underneath,
      // so the transition feels organic rather than a hard cut.
      if (extremeBlend > 0) {
        const isEast = worldX > 0;
        const colorWater = isEast ? _colorEasternWater : _colorWesternWater;
        const colorCliff = isEast ? _colorEasternCliff : _colorWesternCliff;
        const colorPeak = isEast ? _colorEasternPeak : _colorWesternPeak;
        const colorRock = isEast ? _colorEasternRock : _colorWesternRock;
        const colorLowland = isEast
          ? _colorEasternLowland
          : _colorWesternLowland;

        if (height <= WATER_LEVEL) {
          // Neon cyan alien ocean / Magenta liquid
          _tempColorObj.lerp(colorWater, extremeBlend * 0.85);
        } else if (height > MOUNTAIN_LEVEL) {
          // Acid yellow / indigo cliffs / White crystal / Fiery faults
          const peakFrac = Math.min(1, (height - MOUNTAIN_LEVEL) / 400);
          _tempColorObj.lerp(colorCliff, extremeBlend * 0.7);
          _tempColorObj.lerp(colorPeak, extremeBlend * peakFrac * 0.9);
        } else {
          // Mid-elevation: obsidian rock on slopes, teal lowland flat areas
          _tempColorObj.lerp(
            slopeFactor > 0.4 ? colorRock : colorLowland,
            extremeBlend * 0.75
          );
        }
      }

      // --- LAND TYPE CLASSIFICATION ---
      const isStandardLand =
        !isCustom &&
        height > sandMaxHeight &&
        height <= MOUNTAIN_LEVEL + (snowFactor > 0.5 ? -50 : 0);
      const isCustomLand =
        isCustom && height > WATER_LEVEL + 5.0 && height < 105.0;

      // --- BIOME TINTING (Autumn/Cherry) ---
      if ((isStandardLand || isCustomLand) && snowFactor < 0.2) {
        if (autumnNoise > 0.35) {
          const factor = Math.min(1, (autumnNoise - 0.35) / 0.1);
          const tint = isForest
            ? _colorAutumnForestTint
            : _colorAutumnPlainsTint;
          _tempColorObj.lerp(tint, factor * (isForest ? 0.65 : 0.45));
        } else if (cherryNoise > 0.55) {
          const factor = Math.min(1, (cherryNoise - 0.55) / 0.1);
          const tint = isForest
            ? _colorCherryForestTint
            : _colorCherryPlainsTint;
          _tempColorObj.lerp(tint, factor * (isForest ? 0.45 : 0.3));
        }
      }

      const distToVolcano = Math.sqrt(
        (worldX - VOLCANO_X) ** 2 + (worldZ - VOLCANO_Z) ** 2
      );

      if (_enableObjects && (isStandardLand || isCustomLand)) {
        if (isForest) {
          const treeRoll = rng();
          if (treeRoll < (desertFactor > 0.5 ? 0.05 : 0.15) * densityScale) {
            const isIsland = worldX > 3000 && getBiome(worldX, worldZ) < -0.1;
            const isSouthOf1N = worldZ > -5000;

            if (distToVolcano < 3000 && rng() < 0.7) {
              yellowCortezTreePositions.push({x: localX, y: height, z: localZ});
            } else if (isIsland && isSouthOf1N) {
              palmTreePositions.push({x: localX, y: height, z: localZ});
            } else if (
              snowFactor > 0.4 ||
              (height > MOUNTAIN_LEVEL - 100 && desertFactor < 0.3)
            ) {
              snowTreePositions.push({x: localX, y: height, z: localZ});
            } else if (desertFactor > 0.6) {
              deadTreePositions.push({x: localX, y: height, z: localZ});
            } else if (
              eastCoastFactor > 0.7 &&
              height < WATER_LEVEL + 40 &&
              !isIsland
            ) {
              palmTreePositions.push({x: localX, y: height, z: localZ});
            } else {
              if (cherryNoise > 0.65) {
                if (rng() < 0.35) {
                  japaneseMapleTreePositions.push({
                    x: localX,
                    y: height,
                    z: localZ,
                  });
                } else {
                  cherryTreePositions.push({x: localX, y: height, z: localZ});
                }
              } else if (autumnNoise > 0.45) {
                const variety = rng();
                if (variety < 0.12)
                  japaneseMapleTreePositions.push({
                    x: localX,
                    y: height,
                    z: localZ,
                  });
                else if (variety < 0.41)
                  autumnTree1Positions.push({x: localX, y: height, z: localZ});
                else if (variety < 0.7)
                  autumnTree2Positions.push({x: localX, y: height, z: localZ});
                else
                  autumnTree3Positions.push({x: localX, y: height, z: localZ});
              } else {
                deciduousTreePositions.push({x: localX, y: height, z: localZ});
              }
            }
          } else if (
            !isAlienLand &&
            treeRoll < (desertFactor > 0.5 ? 0.0505 : 0.151) * densityScale
          ) {
            const offX = (rng() - 0.5) * 15;
            const offZ = (rng() - 0.5) * 15;
            const h = getCachedElevation(worldX + offX, worldZ + offZ);
            campfirePositions.push({x: localX + offX, y: h, z: localZ + offZ});
          }
        } else {
          const houseThreshold =
            (desertFactor > 0.5 ? 0.002 : 0.005) * densityScale;
          const barnThreshold = houseThreshold + 0.002 * densityScale;
          const monasteryThreshold = houseThreshold + 0.0023 * densityScale;
          const castleThreshold = houseThreshold + 0.0024 * densityScale;
          const windmillThreshold = houseThreshold + 0.0008 * densityScale;

          const plainsRoll = rng();
          if (plainsRoll < houseThreshold) {
            const isIsland = worldX > 3000 && getBiome(worldX, worldZ) < -0.1;
            const isBeyond5DegNorth = worldZ < -25000;
            const isBeyond1DegNorth = worldZ < -5000;

            if (!isAlienLand && !isBeyond5DegNorth) {
              if (isIsland && !isBeyond1DegNorth) {
                strawHutPositions.push({
                  x: localX,
                  y: height,
                  z: localZ,
                  rotY: rng() * Math.PI * 2,
                });
              } else if (!isIsland) {
                if (rng() > 0.85) {
                  twoStoryHousePositions.push({
                    x: localX,
                    y: height,
                    z: localZ,
                    rotY: rng() * Math.PI * 2,
                  });
                } else {
                  housePositions.push({
                    x: localX,
                    y: height,
                    z: localZ,
                    rotY: rng() * Math.PI * 2,
                  });
                }
                // Chimney smoke for houses in snowy areas
                if (snowFactor > 0.3) {
                  chimneySmokePositions.push({
                    x: localX,
                    y: height + 10,
                    z: localZ,
                  });
                }
              }
            }
          } else if (
            !isAlienLand &&
            ENABLE_BARNS &&
            plainsRoll < barnThreshold &&
            snowFactor < 0.4 &&
            desertFactor < 0.3 &&
            height > WATER_LEVEL + 15 &&
            height < MOUNTAIN_LEVEL - 100
          ) {
            barnPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            !isAlienLand &&
            ENABLE_MONASTERIES &&
            plainsRoll < monasteryThreshold &&
            snowFactor < 0.2 &&
            desertFactor < 0.2 &&
            height > WATER_LEVEL + 50 &&
            height < MOUNTAIN_LEVEL - 50
          ) {
            monasteryPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            !isAlienLand &&
            plainsRoll < castleThreshold &&
            snowFactor < 0.5 &&
            desertFactor < 0.3 &&
            height > WATER_LEVEL + 40 &&
            height < MOUNTAIN_LEVEL - 30
          ) {
            castleRuinsPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            !isAlienLand &&
            plainsRoll < windmillThreshold &&
            height > WATER_LEVEL + 5 &&
            height < MOUNTAIN_LEVEL - 100 &&
            desertFactor < 0.3 &&
            snowFactor < 0.3
          ) {
            windmillPositions.push({
              x: localX,
              y: height,
              z: localZ,
              rotY: rng() * Math.PI * 2,
            });
          } else if (
            ENABLE_LIGHTHOUSES &&
            !isMontaukChunk &&
            !lighthousePos &&
            rng() < 0.0004 * densityScale &&
            height < sandMaxHeight + 15
          ) {
            const hN = getCachedElevation(worldX, worldZ - 50);
            const hS = getCachedElevation(worldX, worldZ + 50);
            const hE = getCachedElevation(worldX + 50, worldZ);
            const hW = getCachedElevation(worldX - 50, worldZ);
            if (
              hN <= WATER_LEVEL ||
              hS <= WATER_LEVEL ||
              hE <= WATER_LEVEL ||
              hW <= WATER_LEVEL
            ) {
              lighthousePos = {
                x: localX,
                y: height,
                z: localZ,
                rotY: rng() * Math.PI * 2,
              };
            }
          }

          if (
            height > WATER_LEVEL + 0.5 &&
            height < WATER_LEVEL + 3 &&
            rng() < 0.15 * densityScale
          ) {
            const hN = getCachedElevation(worldX, worldZ - 20);
            const hS = getCachedElevation(worldX, worldZ + 20);
            const hE = getCachedElevation(worldX + 20, worldZ);
            const hW = getCachedElevation(worldX - 20, worldZ);
            let angleToWater = -1;
            if (hN <= WATER_LEVEL) angleToWater = Math.PI;
            else if (hS <= WATER_LEVEL) angleToWater = 0;
            else if (hE <= WATER_LEVEL) angleToWater = -Math.PI / 2;
            else if (hW <= WATER_LEVEL) angleToWater = Math.PI / 2;
            if (angleToWater !== -1) {
              pierPositions.push({
                x: localX,
                y: height,
                z: localZ,
                rotY: angleToWater,
              });
            }
          }
        }

        if (
          ENABLE_PAGODAS &&
          cherryNoise > 0.65 &&
          snowFactor < 0.2 &&
          desertFactor < 0.2 &&
          height > WATER_LEVEL + 5 &&
          height < MOUNTAIN_LEVEL - 80 &&
          rng() < 0.0003 * densityScale
        ) {
          pagodaPositions.push({
            x: localX,
            y: height,
            z: localZ,
            rotY: rng() * Math.PI * 2,
          });
          // Decorate pagoda with Japanese maples to create a beautiful zen garden
          const offset1X = -12;
          const offset1Z = 12;
          const h1 = getCachedElevation(worldX + offset1X, worldZ + offset1Z);
          japaneseMapleTreePositions.push({
            x: localX + offset1X,
            y: h1,
            z: localZ + offset1Z,
          });

          const offset2X = 12;
          const offset2Z = -12;
          const h2 = getCachedElevation(worldX + offset2X, worldZ + offset2Z);
          japaneseMapleTreePositions.push({
            x: localX + offset2X,
            y: h2,
            z: localZ + offset2Z,
          });
        }

        if (rng() < 0.015 * densityScale) {
          if (snowFactor > 0.4)
            snowRockPositions.push({x: localX, y: height, z: localZ});
          else if (desertFactor > 0.4)
            desertRockPositions.push({x: localX, y: height, z: localZ});
          else rockPositions.push({x: localX, y: height, z: localZ});
        }

        if (
          desertFactor > 0.4 &&
          rng() < 0.04 * densityScale &&
          height > WATER_LEVEL + 5 &&
          height < MOUNTAIN_LEVEL - 50
        ) {
          cactusPositions.push({x: localX, y: height, z: localZ});
        }
        if (
          snowFactor > 0.6 &&
          rng() < 0.002 * densityScale &&
          height > WATER_LEVEL + 5 &&
          height < MOUNTAIN_LEVEL - 50
        ) {
          snowmanPositions.push({
            x: localX,
            y: height,
            z: localZ,
            rotY: rng() * Math.PI * 2,
          });
        }
        if (
          desertFactor < 0.2 &&
          snowFactor < 0.3 &&
          height > WATER_LEVEL + 3 &&
          height < MOUNTAIN_LEVEL - 100 &&
          rng() < 0.08 * densityScale
        ) {
          bushPositions.push({
            x: localX,
            y: height,
            z: localZ,
            rotY: rng() * Math.PI * 2,
          });
        }
      }

      // --- FINAL DETAIL PASS ---
      if (slopeFactor > 0.45 && height > WATER_LEVEL + 5) {
        const cliffBlend = Math.min(1, (slopeFactor - 0.45) * 5.0);
        const isSouthBiome = !isCustom && desertFactor > 0.3;
        const rockColor = isSouthBiome ? _colorCliffSouth : _colorMountainTint;
        _tempColorObj.lerp(rockColor, cliffBlend);
        _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.15);
      } else if (slopeFactor > 0.1) {
        _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.3);
      }

      if (!isCustom) {
        _tempColorObj.multiplyScalar(1.0 + grain);
      }

      // --- VOLCANO TEXTURING ---
      if (distToVolcano < 2000) {
        const vFactor = Math.max(0, Math.min(1, (2000 - distToVolcano) / 1000));
        const basaltColor = _colorVolcanoBasaltHi
          .clone()
          .lerp(_colorVolcanoBasaltLo, height / 1400);
        _tempColorObj.lerp(basaltColor, vFactor);
      }

      colors.push(_tempColorObj.r, _tempColorObj.g, _tempColorObj.b);
    }

    if (isMontaukChunk) {
      lighthousePos = {
        x: 0,
        y: getElevation(6000, 3000),
        z: 0,
        rotY: rng() * Math.PI * 2,
      };
      console.log(
        `[Lighthouse] Placed Montauk lighthouse at fixed position (0, ${lighthousePos.y}, 0)`
      );
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    // 2.99 Volcano Landmark Details
    // Must run BEFORE the early-exit guard to avoid the async race where the chunk
    // gets evicted while building, which would prevent these from ever being added.
    // Added directly to `scene` (not the chunk group) so they survive chunk reloads.
    {
      const vX = VOLCANO_X;
      const vZ = VOLCANO_Z;
      const isVolcanoChunk =
        Math.abs(vX - worldOffsetX) <= CHUNK_SIZE / 2 &&
        Math.abs(vZ - worldOffsetZ) <= CHUNK_SIZE / 2;

      if (isVolcanoChunk) {
        const craterBottom = getElevation(vX, vZ);

        // Lava disk
        const vElements = ModelAssembler.getStructure(
          'volcano_active_elements'
        );
        vElements.forEach((part) => {
          const mesh = new THREE.Mesh(part.geo, part.mat);
          // Position relative to crater bottom. Yesterday's seed gave height ~1070.
          // Hardcoded 890 was ~180 below crater bottom. We preserve that offset.
          mesh.position.set(
            vX + part.pos[0],
            craterBottom - 180,
            vZ + part.pos[2]
          );
          mesh.rotation.set(...part.rot);
          if (part.scale) mesh.scale.set(...part.scale);
          group.add(mesh);
        });

        // Spot light pointing up to cast a glow on the underside of passing planes
        const sLight = new THREE.SpotLight(
          0xff4500,
          30.0,
          3000,
          Math.PI / 6,
          0.5,
          1
        );
        // Place spotlight slightly above crater bottom to avoid being buried
        sLight.position.set(vX, craterBottom + 10, vZ);
        const sTarget = new THREE.Object3D();
        sTarget.position.set(vX, 2000, vZ);
        group.add(sTarget);
        sLight.target = sTarget;
        group.add(sLight);
      }
    }

    const chunkKey = `${chunkX},${chunkZ}`;
    if (!chunks.has(chunkKey)) {
      // The chunk was deleted by updateChunks while we were building it. Abort.
      geometry.dispose();
      return;
    }

    const mesh = new THREE.Mesh(geometry, terrainMaterial);
    mesh.position.set(worldOffsetX, 0, worldOffsetZ);
    group.add(mesh);

    // 1.5 Generate Water Plane
    if (hasWater) {
      const wSegments = Math.max(1, Math.floor(SEGMENTS / 4));
      const waterGeo = new THREE.PlaneGeometry(
        CHUNK_SIZE,
        CHUNK_SIZE,
        wSegments,
        wSegments
      );
      waterGeo.userData = {unique: true};
      waterGeo.rotateX(-Math.PI / 2);
      const wPositions = waterGeo.attributes.position.array;
      const wColors = [];
      const _tempWColorObj = new THREE.Color();
      for (let i = 0; i < wPositions.length; i += 3) {
        const worldX = worldOffsetX + wPositions[i];
        const worldZ = worldOffsetZ + wPositions[i + 2];

        wPositions[i + 1] = WATER_LEVEL;

        const tempNoise = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
        const northInfluence = Math.max(0, -worldZ / 4500);
        const southInfluence = Math.max(0, worldZ / 4500);
        const snowRaw = Math.max(
          0,
          Math.min(1, (northInfluence + tempNoise * 0.05 - 0.7) * 1.5)
        );
        const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);
        const desertRaw = Math.max(
          0,
          Math.min(1, (southInfluence + tempNoise * 0.05 - 0.7) * 1.5)
        );
        const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

        _tempWColorObj.copy(_colorWater);
        if (snowFactor > 0) _tempWColorObj.lerp(_colorIcyWater, snowFactor);
        if (desertFactor > 0)
          _tempWColorObj.lerp(_colorDesertWater, desertFactor);

        const terrainHeight = getCachedElevation(worldX, worldZ);
        const inlandHeight = terrainHeight - WATER_LEVEL;
        if (inlandHeight > 0) {
          // Only apply foam to water vertices that intersect or are under the land.
          // The interpolation between the land vertex and the deep ocean vertex creates the foam line.
          const foamFactor = Math.min(1.0, inlandHeight / 2.0);
          _tempWColorObj.lerp(_colorFoam, foamFactor);
        }

        wColors.push(_tempWColorObj.r, _tempWColorObj.g, _tempWColorObj.b);
      }
      waterGeo.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(wColors, 3)
      );
      const waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
      waterMesh.position.set(worldOffsetX, 0, worldOffsetZ);
      group.add(waterMesh);
      group.userData.water = waterMesh; // accessible for animation!
    }

    // 1.6 Dedicated group for procedural objects (trees, houses, etc.)
    // This allows for bulk toggling visibility via the debug menu.
    const objectsGroup = new THREE.Group();
    objectsGroup.visible = _enableObjects;
    group.add(objectsGroup);
    group.userData.objectsGroup = objectsGroup;

    // 2. Generate Trees
    const dummy = new THREE.Object3D();

    // Helper for rendering instanced trees with latitude-based snow coloring
    const _tempColor = new THREE.Color();
    const _snowColor = new THREE.Color(0xe0f7fa);

    const renderTrees = (
      positions,
      trunkGeo,
      leavesGeo,
      trunkMat,
      baseLeafColor
    ) => {
      if (positions.length === 0) return;
      const trunkInst = new THREE.InstancedMesh(
        trunkGeo,
        trunkMat,
        positions.length
      );
      // Use white base material — instance colors will define the actual leaf color
      const leavesInst = new THREE.InstancedMesh(
        leavesGeo,
        treeLeavesBaseMat,
        positions.length
      );

      positions.forEach((pos, index) => {
        const worldZ = worldOffsetZ + pos.z;
        // northInfluence reaches 1.0 at worldZ = -4000; frost starts around -1800
        const northInfluence = Math.max(0, -worldZ / 4000);

        const tempNoise = simplex.noise2D(
          (worldOffsetX + pos.x) * 0.0001,
          worldZ * 0.0001
        );
        // Threshold 0.78 means frost only appears deep in the snowy biome (worldZ < -3100 approx)
        const snowRaw = Math.max(
          0,
          Math.min(1, (northInfluence + tempNoise * 0.05 - 0.78) * 3.5)
        );
        const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);

        const baseScale = 0.6 + Math.min(0.6, northInfluence * 0.5);
        const scale = baseScale + rng() * (0.4 + rng() * 0.5);
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.y = rng() * Math.PI * 2;
        dummy.updateMatrix();
        trunkInst.setMatrixAt(index, dummy.matrix);
        leavesInst.setMatrixAt(index, dummy.matrix);

        // Set leaf color: base leaf color lerped toward snow-white based on snowFactor
        _tempColor.set(baseLeafColor);
        if (snowFactor > 0) {
          _tempColor.lerp(_snowColor, snowFactor);
        }
        leavesInst.setColorAt(index, _tempColor);
      });

      if (leavesInst.instanceColor) leavesInst.instanceColor.needsUpdate = true;

      trunkInst.position.set(worldOffsetX, 0, worldOffsetZ);
      leavesInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(trunkInst);
      objectsGroup.add(leavesInst);
    };

    // Render variations — pass hex color so gradient lerps correctly from green → white
    renderTrees(
      treePositions,
      treeTrunkGeo,
      treeLeavesGeo,
      treeTrunkMat,
      0x1b5e20
    );
    renderTrees(
      snowTreePositions,
      treeTrunkGeo,
      treeLeavesGeo,
      treeTrunkMat,
      0x1b5e20
    );
    renderTrees(
      deciduousTreePositions,
      deciduousGeos.trunk,
      deciduousGeos.leaves,
      treeTrunkMat,
      0x1b5e20
    );
    renderTrees(
      palmTreePositions,
      palmGeos.trunk,
      palmGeos.leaves,
      treeTrunkMat,
      0x689f38
    );
    renderTrees(
      cherryTreePositions,
      deciduousGeos.trunk,
      deciduousGeos.leaves,
      treeTrunkMat,
      0xf8bbd0
    );
    renderTrees(
      autumnTree1Positions,
      deciduousGeos.trunk,
      deciduousGeos.leaves,
      treeTrunkMat,
      0xd35400
    );
    renderTrees(
      autumnTree2Positions,
      deciduousGeos.trunk,
      deciduousGeos.leaves,
      treeTrunkMat,
      0xf39c12
    );
    renderTrees(
      autumnTree3Positions,
      deciduousGeos.trunk,
      deciduousGeos.leaves,
      treeTrunkMat,
      0xc0392b
    );
    renderTrees(
      yellowCortezTreePositions,
      deciduousGeos.trunk,
      deciduousGeos.leaves,
      treeTrunkMat,
      0xffeb3b
    ); // Yellow Cortez
    renderTrees(
      japaneseMapleTreePositions,
      japaneseMapleGeos.trunk,
      japaneseMapleGeos.leaves,
      treeTrunkMat,
      0xa31515
    ); // Japanese Maple

    if (deadTreePositions.length > 0) {
      const deadInst = new THREE.InstancedMesh(
        deadTreeGeo,
        deadTreeMat,
        deadTreePositions.length
      );
      deadTreePositions.forEach((pos, index) => {
        const scale = 0.8 + rng() * 0.8;
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.y = rng() * Math.PI * 2;
        dummy.updateMatrix();
        deadInst.setMatrixAt(index, dummy.matrix);
      });
      deadInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(deadInst);
    }

    // 2.3 Generate Rocks
    const rockVariations = [
      {pos: rockPositions, mat: rockMat},
      {pos: snowRockPositions, mat: snowRockMat},
      {pos: desertRockPositions, mat: desertRockMat},
    ];

    rockVariations.forEach((variation) => {
      if (variation.pos.length > 0) {
        const rockInst = new THREE.InstancedMesh(
          rockGeo,
          variation.mat,
          variation.pos.length
        );

        variation.pos.forEach((pos, index) => {
          // Random scale between 0.5 and 2.5 on each axis for uniquely shaped boulders
          const sx = 0.5 + rng() * 2.0;
          const sy = 0.5 + rng() * 2.0;
          const sz = 0.5 + rng() * 2.0;

          // Random rotation
          dummy.position.set(pos.x, pos.y, pos.z);
          dummy.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
          dummy.scale.set(sx, sy, sz);
          dummy.updateMatrix();

          rockInst.setMatrixAt(index, dummy.matrix);
        });

        rockInst.position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(rockInst);
      }
    });

    // 2.4 Generate Cactuses
    if (cactusPositions.length > 0) {
      const cactusInst = new THREE.InstancedMesh(
        cactusGeo,
        cactusMat,
        cactusPositions.length
      );
      cactusPositions.forEach((pos, index) => {
        const scale = 0.8 + rng() * 0.6;
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, rng() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        cactusInst.setMatrixAt(index, dummy.matrix);
      });
      cactusInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(cactusInst);
    }

    // 2.45 Generate Snowmen
    if (snowmanPositions.length > 0) {
      const bodyInst = new THREE.InstancedMesh(
        snowmanGeos.body,
        snowmanBodyMat,
        snowmanPositions.length
      );
      const noseInst = new THREE.InstancedMesh(
        snowmanGeos.nose,
        snowmanNoseMat,
        snowmanPositions.length
      );

      snowmanPositions.forEach((pos, index) => {
        const scale = 0.8 + rng() * 0.4;
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        bodyInst.setMatrixAt(index, dummy.matrix);
        noseInst.setMatrixAt(index, dummy.matrix);
      });

      bodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      noseInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(bodyInst);
      objectsGroup.add(noseInst);
    }

    // 2.47 Generate Lily Pads
    if (lilyPadPositions.length > 0) {
      const padInst = new THREE.InstancedMesh(
        lilyPadGeo,
        lilyPadMat,
        lilyPadPositions.length
      );

      lilyPadPositions.forEach((pos, index) => {
        const scale = 0.6 + rng() * 0.8;
        dummy.position.set(pos.x, pos.y + 0.15, pos.z); // Slightly above water to prevent Z-fighting
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        padInst.setMatrixAt(index, dummy.matrix);
      });

      padInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(padInst);
    }

    // 2.48 Generate Bushes
    if (bushPositions.length > 0) {
      const bushInst = new THREE.InstancedMesh(
        bushGeo,
        bushMat,
        bushPositions.length
      );
      bushPositions.forEach((pos, index) => {
        const scale = 0.5 + rng() * 1.5; // High variance in bush sizes
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        bushInst.setMatrixAt(index, dummy.matrix);
      });
      bushInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(bushInst);
    }

    // 2.5 Generate Houses
    if (housePositions.length > 0) {
      const numBodyColors = houseBodyPalette.length;
      const numRoofColors = houseRoofPalette.length;

      // Count houses per (body, roof) combo
      const comboCounts = {};
      const houseCombo = [];
      housePositions.forEach((pos, idx) => {
        const bodyId = Math.floor(rng() * numBodyColors);
        const roofId = Math.floor(rng() * numRoofColors);
        const key = `${bodyId}_${roofId}`;
        houseCombo[idx] = {bodyId, roofId, key};
        comboCounts[key] = (comboCounts[key] || 0) + 1;
      });

      // Build one InstancedMesh pair per combo that actually appears
      const bodyInsts = {};
      const roofInsts = {};
      const comboIndices = {};
      for (const key of Object.keys(comboCounts)) {
        const [bodyId, roofId] = key.split('_').map(Number);
        bodyInsts[key] = new THREE.InstancedMesh(
          houseBodyGeo,
          houseBodyPalette[bodyId],
          comboCounts[key]
        );
        roofInsts[key] = new THREE.InstancedMesh(
          houseRoofGeo,
          houseRoofPalette[roofId],
          comboCounts[key]
        );
        bodyInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
        roofInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(bodyInsts[key]);
        objectsGroup.add(roofInsts[key]);
        comboIndices[key] = 0;
      }

      const windowPools = [];
      const poolCounts = [0, 0, 0, 0, 0];
      const houseToPool = [];

      housePositions.forEach((pos, idx) => {
        const poolId = Math.floor(rng() * 5);
        houseToPool[idx] = poolId;
        poolCounts[poolId]++;
      });

      for (let i = 0; i < 5; i++) {
        if (poolCounts[i] > 0) {
          windowPools[i] = new THREE.InstancedMesh(
            houseWindowGeo,
            houseWindowMats[i],
            poolCounts[i] * 3
          );
          windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
          objectsGroup.add(windowPools[i]);
        }
      }

      const doorInst = new THREE.InstancedMesh(
        houseDoorGeo,
        houseDoorMat,
        housePositions.length
      );
      const chimneyInst = new THREE.InstancedMesh(
        houseChimneyGeo,
        houseChimneyMat,
        housePositions.length
      );
      doorInst.position.set(worldOffsetX, 0, worldOffsetZ);
      chimneyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(doorInst);
      objectsGroup.add(chimneyInst);

      const poolIndices = [0, 0, 0, 0, 0];

      housePositions.forEach((pos, index) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        const {key} = houseCombo[index];
        const ci = comboIndices[key];
        bodyInsts[key].setMatrixAt(ci, dummy.matrix);
        roofInsts[key].setMatrixAt(ci, dummy.matrix);
        comboIndices[key]++;

        const poolId = houseToPool[index];
        const pIdx = poolIndices[poolId];

        const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );
        dummy.position.set(
          pos.x + doorOffset.x,
          pos.y + doorOffset.y,
          pos.z + doorOffset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        doorInst.setMatrixAt(index, dummy.matrix);

        const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );
        dummy.position.set(
          pos.x + chimneyOffset.x,
          pos.y + chimneyOffset.y,
          pos.z + chimneyOffset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        chimneyInst.setMatrixAt(index, dummy.matrix);

        const winF1Offset = new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );
        const winF2Offset = new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );
        const winBOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );

        dummy.position.set(
          pos.x + winF1Offset.x,
          pos.y + winF1Offset.y,
          pos.z + winF1Offset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        windowPools[poolId].setMatrixAt(pIdx * 3, dummy.matrix);

        dummy.position.set(
          pos.x + winF2Offset.x,
          pos.y + winF2Offset.y,
          pos.z + winF2Offset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        windowPools[poolId].setMatrixAt(pIdx * 3 + 1, dummy.matrix);

        dummy.position.set(
          pos.x + winBOffset.x,
          pos.y + winBOffset.y,
          pos.z + winBOffset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        windowPools[poolId].setMatrixAt(pIdx * 3 + 2, dummy.matrix);

        poolIndices[poolId]++;
      });
    }

    // 2.52 Generate Two Story Houses
    if (twoStoryHousePositions.length > 0) {
      const numBodyColors = houseBodyPalette.length;
      const numRoofColors = houseRoofPalette.length;

      const comboCounts = {};
      const houseCombo = [];
      twoStoryHousePositions.forEach((pos, idx) => {
        const bodyId = Math.floor(rng() * numBodyColors);
        const roofId = Math.floor(rng() * numRoofColors);
        const key = `${bodyId}_${roofId}`;
        houseCombo[idx] = {bodyId, roofId, key};
        comboCounts[key] = (comboCounts[key] || 0) + 1;
      });

      const bodyInsts = {};
      const roofInsts = {};
      const comboIndices = {};
      for (const key of Object.keys(comboCounts)) {
        const [bodyId, roofId] = key.split('_').map(Number);
        bodyInsts[key] = new THREE.InstancedMesh(
          twoStoryBodyGeo,
          houseBodyPalette[bodyId],
          comboCounts[key]
        );
        roofInsts[key] = new THREE.InstancedMesh(
          twoStoryRoofGeo,
          houseRoofPalette[roofId],
          comboCounts[key]
        );
        bodyInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
        roofInsts[key].position.set(worldOffsetX, 0, worldOffsetZ);
        objectsGroup.add(bodyInsts[key]);
        objectsGroup.add(roofInsts[key]);
        comboIndices[key] = 0;
      }

      const windowPools = [];
      const poolCounts = [0, 0, 0, 0, 0];
      const houseToPool = [];

      twoStoryHousePositions.forEach((pos, idx) => {
        const poolId = Math.floor(rng() * 5);
        houseToPool[idx] = poolId;
        poolCounts[poolId]++;
      });

      for (let i = 0; i < 5; i++) {
        if (poolCounts[i] > 0) {
          windowPools[i] = new THREE.InstancedMesh(
            houseWindowGeo,
            houseWindowMats[i],
            poolCounts[i] * 8
          );
          windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
          objectsGroup.add(windowPools[i]);
        }
      }

      const doorInst = new THREE.InstancedMesh(
        houseDoorGeo,
        houseDoorMat,
        twoStoryHousePositions.length
      );
      const chimneyInst = new THREE.InstancedMesh(
        twoStoryChimneyGeo,
        houseChimneyMat,
        twoStoryHousePositions.length
      );
      doorInst.position.set(worldOffsetX, 0, worldOffsetZ);
      chimneyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(doorInst);
      objectsGroup.add(chimneyInst);

      const poolIndices = [0, 0, 0, 0, 0];

      twoStoryHousePositions.forEach((pos, index) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        const {key} = houseCombo[index];
        const ci = comboIndices[key];
        bodyInsts[key].setMatrixAt(ci, dummy.matrix);
        roofInsts[key].setMatrixAt(ci, dummy.matrix);
        comboIndices[key]++;

        const poolId = houseToPool[index];
        const pIdx = poolIndices[poolId];

        const doorOffset = new THREE.Vector3(0, 2.25, 5.1).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );
        dummy.position.set(
          pos.x + doorOffset.x,
          pos.y + doorOffset.y,
          pos.z + doorOffset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        doorInst.setMatrixAt(index, dummy.matrix);

        const chimneyOffset = new THREE.Vector3(2.5, 0, -2.5).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pos.rotY
        );
        dummy.position.set(
          pos.x + chimneyOffset.x,
          pos.y + chimneyOffset.y,
          pos.z + chimneyOffset.z
        );
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        chimneyInst.setMatrixAt(index, dummy.matrix);

        const offsets = [
          new THREE.Vector3(-3.0, 4, 5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(3.0, 4, 5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(0, 4, -5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(0, 10, 5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(-3.0, 10, 5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(3.0, 10, 5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(-3.0, 10, -5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
          new THREE.Vector3(3.0, 10, -5.1).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          ),
        ];

        offsets.forEach((offset, i) => {
          dummy.position.set(
            pos.x + offset.x,
            pos.y + offset.y,
            pos.z + offset.z
          );
          dummy.rotation.set(0, pos.rotY, 0);
          dummy.updateMatrix();
          windowPools[poolId].setMatrixAt(pIdx * 8 + i, dummy.matrix);
        });

        poolIndices[poolId]++;
      });
    }

    // 2.55 Generate Straw Huts (islands)
    if (strawHutPositions.length > 0) {
      const strawHutBodyInst = new THREE.InstancedMesh(
        strawHutBodyGeo,
        strawHutMat,
        strawHutPositions.length
      );
      const strawHutRoofInst = new THREE.InstancedMesh(
        strawHutRoofGeo,
        strawHutMat,
        strawHutPositions.length
      );
      strawHutPositions.forEach((pos, i) => {
        const scale = 0.9 + rng() * 0.3;
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        strawHutBodyInst.setMatrixAt(i, dummy.matrix);
        strawHutRoofInst.setMatrixAt(i, dummy.matrix);
      });
      strawHutBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      strawHutRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(strawHutBodyInst);
      objectsGroup.add(strawHutRoofInst);
    }

    // 2.6 Generate Pagodas (rare, cherry blossom zones)
    if (pagodaPositions.length > 0) {
      const pagodaBodyInst = new THREE.InstancedMesh(
        pagodaBodyGeo,
        pagodaBodyMat,
        pagodaPositions.length
      );
      const pagodaRoofInst = new THREE.InstancedMesh(
        pagodaRoofGeo,
        pagodaRoofMat,
        pagodaPositions.length
      );
      pagodaPositions.forEach((pos, i) => {
        const scale = 0.9 + rng() * 0.3;
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        pagodaBodyInst.setMatrixAt(i, dummy.matrix);
        pagodaRoofInst.setMatrixAt(i, dummy.matrix);
      });
      pagodaBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      pagodaRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(pagodaBodyInst);
      objectsGroup.add(pagodaRoofInst);
    }

    // 2.61 Generate Barns (temperate plains)
    if (barnPositions.length > 0) {
      const barnBodyInst = new THREE.InstancedMesh(barnBodyGeo, barnBodyMat, barnPositions.length);
      const barnRoofInst = new THREE.InstancedMesh(barnRoofGeo, barnRoofMat, barnPositions.length);
      const barnDoorInst = new THREE.InstancedMesh(barnDoorGeo, barnWhiteMat, barnPositions.length * 2);
      const barnTrimInst = new THREE.InstancedMesh(barnTrimGeo, barnBodyMat, barnPositions.length * 4);
      const barnSiloBodyInst = new THREE.InstancedMesh(barnSiloBodyGeo, barnSiloMat, barnPositions.length);
      const barnSiloRoofInst = new THREE.InstancedMesh(barnSiloRoofGeo, barnSiloRoofMat, barnPositions.length);

      barnPositions.forEach((pos, i) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        barnBodyInst.setMatrixAt(i, dummy.matrix);
        barnRoofInst.setMatrixAt(i, dummy.matrix);

        const doorFOffset = new THREE.Vector3(0, 4.5, 14.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);
        const doorBOffset = new THREE.Vector3(0, 4.5, -14.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);
        const siloOffset = new THREE.Vector3(12, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);

        // Front Door
        dummy.position.set(pos.x + doorFOffset.x, pos.y + doorFOffset.y, pos.z + doorFOffset.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        barnDoorInst.setMatrixAt(i * 2, dummy.matrix);

        dummy.rotation.set(0, pos.rotY, Math.atan2(8, 9));
        dummy.updateMatrix();
        barnTrimInst.setMatrixAt(i * 4, dummy.matrix);

        dummy.rotation.set(0, pos.rotY, -Math.atan2(8, 9));
        dummy.updateMatrix();
        barnTrimInst.setMatrixAt(i * 4 + 1, dummy.matrix);

        // Back Door
        dummy.position.set(pos.x + doorBOffset.x, pos.y + doorBOffset.y, pos.z + doorBOffset.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        barnDoorInst.setMatrixAt(i * 2 + 1, dummy.matrix);

        dummy.rotation.set(0, pos.rotY, Math.atan2(8, 9));
        dummy.updateMatrix();
        barnTrimInst.setMatrixAt(i * 4 + 2, dummy.matrix);

        dummy.rotation.set(0, pos.rotY, -Math.atan2(8, 9));
        dummy.updateMatrix();
        barnTrimInst.setMatrixAt(i * 4 + 3, dummy.matrix);

        // Silo
        dummy.position.set(pos.x + siloOffset.x, pos.y + siloOffset.y, pos.z + siloOffset.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        barnSiloBodyInst.setMatrixAt(i, dummy.matrix);
        barnSiloRoofInst.setMatrixAt(i, dummy.matrix);
      });

      barnBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      barnRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
      barnDoorInst.position.set(worldOffsetX, 0, worldOffsetZ);
      barnTrimInst.position.set(worldOffsetX, 0, worldOffsetZ);
      barnSiloBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      barnSiloRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);

      objectsGroup.add(barnBodyInst);
      objectsGroup.add(barnRoofInst);
      objectsGroup.add(barnDoorInst);
      objectsGroup.add(barnTrimInst);
      objectsGroup.add(barnSiloBodyInst);
      objectsGroup.add(barnSiloRoofInst);
    }

    // 2.62 Generate Monasteries (rare, temperate highlands)
    if (monasteryPositions.length > 0) {
      const monasteryBodyInst = new THREE.InstancedMesh(
        monasteryBodyGeo,
        monasteryBodyMat,
        monasteryPositions.length
      );
      const monasteryRoofInst = new THREE.InstancedMesh(
        monasteryRoofGeo,
        monasteryRoofMat,
        monasteryPositions.length
      );
      monasteryPositions.forEach((pos, i) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        monasteryBodyInst.setMatrixAt(i, dummy.matrix);
        monasteryRoofInst.setMatrixAt(i, dummy.matrix);
      });
      monasteryBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
      monasteryRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(monasteryBodyInst);
      objectsGroup.add(monasteryRoofInst);
    }

    // 2.63 Generate Castle Ruins (very rare, elevated terrain)
    if (castleRuinsPositions.length > 0) {
      const castleInst = new THREE.InstancedMesh(
        castleRuinsGeo,
        castleRuinsMat,
        castleRuinsPositions.length
      );
      castleRuinsPositions.forEach((pos, i) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        castleInst.setMatrixAt(i, dummy.matrix);
      });
      castleInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(castleInst);
    }

    // 2.7 Generate Windmills
    if (windmillPositions.length > 0) {
      const baseInst = new THREE.InstancedMesh(
        windmillBaseGeo,
        windmillBaseMat,
        windmillPositions.length
      );
      const bladesInst = new THREE.InstancedMesh(
        windmillBladesGeo,
        windmillBladesMat,
        windmillPositions.length * 4
      );

      windmillPositions.forEach((pos, index) => {
        const structure = ModelAssembler.getStructure('windmill', pos.rotY);
        structure.forEach((part, pIdx) => {
          dummy.position.set(
            pos.x + part.pos[0],
            pos.y + part.pos[1],
            pos.z + part.pos[2]
          );
          dummy.rotation.order = part.order || 'XYZ';
          dummy.rotation.set(...part.rot);
          dummy.scale.set(...part.scale);
          dummy.updateMatrix();

          if (pIdx === 0) {
            baseInst.setMatrixAt(index, dummy.matrix);
          } else {
            bladesInst.setMatrixAt(index * 4 + (pIdx - 1), dummy.matrix);
          }
        });
      });

      baseInst.position.set(worldOffsetX, 0, worldOffsetZ);
      bladesInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(baseInst);
      objectsGroup.add(bladesInst);
    }

    // 2.9 Generate Lighthouse
    if (lighthousePos) {
      const pos = lighthousePos;
      const structure = ModelAssembler.getStructure(
        'lighthouse',
        pos.rotY || 0
      );
      const lighthouseGroup = new THREE.Group();

      structure.forEach((part) => {
        const mesh = new THREE.Mesh(part.geo, part.mat);
        mesh.position.set(...part.pos);
        mesh.rotation.set(...part.rot);
        if (part.scale) mesh.scale.set(...part.scale);
        lighthouseGroup.add(mesh);
      });

      lighthouseGroup.scale.set(2, 2, 2); // Scale lighthouse by 100% bigger (double size)
      lighthouseGroup.position.set(
        pos.x + worldOffsetX,
        pos.y,
        pos.z + worldOffsetZ
      );
      objectsGroup.add(lighthouseGroup);

      // Use persistent beam and light
      const beamHeight = 126; // Middle of lantern (63 * 2)

      if (persistentLighthouseBeam) {
        persistentLighthouseBeam.position.set(
          pos.x + worldOffsetX,
          pos.y + beamHeight,
          pos.z + worldOffsetZ
        );
        persistentLighthouseBeam.rotation.y = pos.rotY;
        persistentLighthouseBeam.rotation.x = 0.15; // Tilt slightly downward
        persistentLighthouseBeam.scale.set(2, 2, 2); // Scale beam to match
        persistentLighthouseBeam.visible = true;

        // Store in userData for game.js to animate!
        group.userData.lighthouseBeam = persistentLighthouseBeam;
      }

      if (persistentLighthouseLight) {
        persistentLighthouseLight.position.set(
          pos.x + worldOffsetX,
          pos.y + beamHeight,
          pos.z + worldOffsetZ
        );
        persistentLighthouseLight.target.position.set(
          pos.x + worldOffsetX + Math.sin(pos.rotY) * 200,
          pos.y + beamHeight - 30,
          pos.z + worldOffsetZ + Math.cos(pos.rotY) * 200
        );
        persistentLighthouseLight.intensity = LIGHTHOUSE_LIGHT_INTENSITY;

        // Store in userData for game.js to animate!
        group.userData.lighthouseLight = persistentLighthouseLight;
        group.userData.lighthouseTarget = persistentLighthouseLight.target;
      }
    }

    // 2.95 Generate Piers
    if (pierPositions.length > 0) {
      const deckInst = new THREE.InstancedMesh(
        pierDeckGeo,
        woodMat,
        pierPositions.length
      );
      const postInst = new THREE.InstancedMesh(
        pierPostGeo,
        woodMat,
        pierPositions.length * 4
      );

      pierPositions.forEach((pos, index) => {
        dummy.position.set(pos.x, pos.y - 1, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.updateMatrix();
        deckInst.setMatrixAt(index, dummy.matrix);

        // Posts
        const offsets = [
          [-6, 10],
          [6, 10],
          [-6, 25],
          [6, 25],
        ];
        offsets.forEach((off, i) => {
          const p = new THREE.Vector3(off[0], -5, off[1]).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            pos.rotY
          );
          dummy.position.set(pos.x + p.x, pos.y + p.y, pos.z + p.z);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          postInst.setMatrixAt(index * 4 + i, dummy.matrix);
        });
      });

      deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
      postInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(deckInst);
      objectsGroup.add(postInst);
    }

    // 2.96 Generate Campfires
    if (campfirePositions.length > 0) {
      const logInst = new THREE.InstancedMesh(
        fireLogGeo,
        woodMat,
        campfirePositions.length * 3
      );
      const coreInst = new THREE.InstancedMesh(
        fireCoreGeo,
        fireMat,
        campfirePositions.length
      );
      const smokeInst = new THREE.InstancedMesh(
        smokeGeo,
        smokeMat,
        campfirePositions.length * 5
      ); // 5 particles per fire community
      const numTentColors = tentPalette.length;
      const tentCounts = Array(numTentColors).fill(0);
      const tentColorIndices = []; // Maps index to colorIndex

      campfirePositions.forEach((pos, index) => {
        // Deterministic color selection using seed-based RNG
        const colorIdx = Math.floor(rng() * numTentColors);
        tentColorIndices[index] = colorIdx;
        tentCounts[colorIdx]++;
      });

      const tentInsts = [];
      const tentPolesInst = new THREE.InstancedMesh(
        tentPolesGeo,
        woodMat,
        campfirePositions.length
      );
      const tentEntranceInst = new THREE.InstancedMesh(
        tentEntranceGeo,
        tentEntranceMat,
        campfirePositions.length
      );
      const currentComboIndices = Array(numTentColors).fill(0);

      for (let i = 0; i < numTentColors; i++) {
        if (tentCounts[i] > 0) {
          tentInsts[i] = new THREE.InstancedMesh(
            tentGeo,
            tentPalette[i],
            tentCounts[i]
          );
          tentInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
          objectsGroup.add(tentInsts[i]);
        }
      }

      tentPolesInst.position.set(worldOffsetX, 0, worldOffsetZ);
      tentEntranceInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(tentPolesInst, tentEntranceInst);

      campfirePositions.forEach((pos, index) => {
        const structure = ModelAssembler.getStructure(
          'campfire',
          pos.rotY || 0
        );
        structure.forEach((part, pIdx) => {
          dummy.position.set(
            pos.x + part.pos[0],
            pos.y + part.pos[1],
            pos.z + part.pos[2]
          );
          dummy.rotation.order = part.order || 'XYZ';
          dummy.rotation.set(...part.rot);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();

          if (part.geo === fireLogGeo) {
            logInst.setMatrixAt(index * 3 + pIdx, dummy.matrix);
          } else if (part.geo === fireCoreGeo) {
            coreInst.setMatrixAt(index, dummy.matrix);
          }
        });

        // Smoke community
        for (let i = 0; i < 5; i++) {
          dummy.position.set(pos.x, pos.y + 5, pos.z);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          const smokeIdx = index * 5 + i;
          smokeInst.setMatrixAt(smokeIdx, dummy.matrix);

          const phase = ((pos.x + pos.z) % 10.0) / 10.0;
          smokeInst.setColorAt(smokeIdx, new THREE.Color(i / 10.0, phase, 0));
        }

        // Tent community
        const angle = rng() * Math.PI * 2;
        const dist = 12 + rng() * 4;
        const tentX = pos.x + Math.cos(angle) * dist;
        const tentZ = pos.z + Math.sin(angle) * dist;
        const tentY = getCachedElevation(
          worldOffsetX + tentX,
          worldOffsetZ + tentZ
        );

        dummy.position.set(tentX, tentY, tentZ);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        const colorIdx = tentColorIndices[index];
        const instIdx = currentComboIndices[colorIdx]++;
        tentInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

        tentPolesInst.setMatrixAt(index, dummy.matrix);
        tentEntranceInst.setMatrixAt(index, dummy.matrix);
      });

      logInst.position.set(worldOffsetX, 0, worldOffsetZ);
      coreInst.position.set(worldOffsetX, 0, worldOffsetZ);
      smokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(logInst);
      objectsGroup.add(coreInst);
      objectsGroup.add(smokeInst);

      group.userData.campfires = coreInst;
      group.userData.campfireSmoke = smokeInst;
    }

    // 2.97 Generate Chimney Smoke
    if (chimneySmokePositions.length > 0) {
      const chimneySmokeInst = new THREE.InstancedMesh(
        smokeGeo,
        whiteSmokeMat,
        chimneySmokePositions.length * 4
      );

      chimneySmokePositions.forEach((pos, index) => {
        for (let i = 0; i < 4; i++) {
          dummy.position.set(pos.x, pos.y, pos.z);
          dummy.scale.set(1, 1, 1);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          const smokeIdx = index * 4 + i;
          chimneySmokeInst.setMatrixAt(smokeIdx, dummy.matrix);

          const phase = ((pos.x + pos.z) % 10.0) / 10.0;
          chimneySmokeInst.setColorAt(
            smokeIdx,
            new THREE.Color(i / 10.0, phase, 0)
          );
        }
      });

      chimneySmokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(chimneySmokeInst);

      group.userData.chimneySmoke = chimneySmokeInst;
    }

    // 2.98 Generate Sailboats
    if (sailboatPositions.length > 0) {
      const numBoatColors = boatHullPalette.length;
      const boatCounts = Array(numBoatColors).fill(0);
      const boatColorIndices = [];

      sailboatPositions.forEach((pos, index) => {
        const colorIdx = Math.floor(rng() * numBoatColors);
        boatColorIndices[index] = colorIdx;
        boatCounts[colorIdx]++;
      });

      const hullInsts = [];
      const currentComboIndices = Array(numBoatColors).fill(0);
      const boatInstIndices = [];

      for (let i = 0; i < numBoatColors; i++) {
        if (boatCounts[i] > 0) {
          hullInsts[i] = new THREE.InstancedMesh(
            boatHullGeo,
            boatHullPalette[i],
            boatCounts[i]
          );
          hullInsts[i].position.set(worldOffsetX, 0, worldOffsetZ);
          objectsGroup.add(hullInsts[i]);
        }
      }

      const rimInst = new THREE.InstancedMesh(
        boatRimGeo,
        boatRimMat,
        sailboatPositions.length
      );
      const deckInst = new THREE.InstancedMesh(
        boatDeckGeo,
        boatDeckMat,
        sailboatPositions.length
      );
      const mastInst = new THREE.InstancedMesh(
        boatMastGeo,
        woodMat,
        sailboatPositions.length
      );
      const boomInst = new THREE.InstancedMesh(
        boatBoomGeo,
        woodMat,
        sailboatPositions.length
      );
      const sailInst = new THREE.InstancedMesh(
        boatSailGeo,
        boatSailMat,
        sailboatPositions.length
      );

      sailboatPositions.forEach((pos, index) => {
        dummy.position.set(pos.x, pos.y, pos.z);
        dummy.rotation.set(0, pos.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();

        const colorIdx = boatColorIndices[index];
        const instIdx = currentComboIndices[colorIdx]++;
        boatInstIndices[index] = instIdx;
        hullInsts[colorIdx].setMatrixAt(instIdx, dummy.matrix);

        rimInst.setMatrixAt(index, dummy.matrix);
        deckInst.setMatrixAt(index, dummy.matrix);
        mastInst.setMatrixAt(index, dummy.matrix);
        boomInst.setMatrixAt(index, dummy.matrix);
        sailInst.setMatrixAt(index, dummy.matrix);
      });

      rimInst.position.set(worldOffsetX, 0, worldOffsetZ);
      deckInst.position.set(worldOffsetX, 0, worldOffsetZ);
      mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
      boomInst.position.set(worldOffsetX, 0, worldOffsetZ);
      sailInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(rimInst, deckInst, mastInst, boomInst, sailInst);

      group.userData.sailboatPositions = sailboatPositions;
      group.userData.boatHulls = hullInsts;
      group.userData.boatColorIndices = boatColorIndices;
      group.userData.boatInstIndices = boatInstIndices;
      group.userData.boatMasts = mastInst;
      group.userData.boatSails = sailInst;
      group.userData.boatRims = rimInst;
      group.userData.boatDecks = deckInst;
      group.userData.boatBooms = boomInst;
    }

    // 3. Generate Clouds
    let cloudiness =
      (simplex.noise2D(chunkX * 0.1 + 500, chunkZ * 0.1) + 1) / 2;
    const cloudThreshold = 0.5;
    if (!_enableBlockClouds || isCustom || cloudiness < cloudThreshold) {
      cloudiness = 0;
    } else {
      cloudiness = (cloudiness - cloudThreshold) / (1 - cloudThreshold);
    }

    const numClouds = Math.floor(cloudiness * 40);

    // Boost clouds as they approach mountains based on the highest point in this chunk
    // This ensures all clouds in a mountainous chunk rise consistently.
    const elevationBoost = Math.max(0, maxChunkHeight - 100) * 1.5;

    // 3b. Generate clouds (InstancedMesh)
    let totalCloudParts = 0;
    const cloudData = [];

    for (let i = 0; i < numClouds; i++) {
      const cx = (rng() - 0.5) * CHUNK_SIZE;
      const cz = (rng() - 0.5) * CHUNK_SIZE;
      const baseHeight = 550 + rng() * 150;
      const cy = baseHeight + elevationBoost;

      const parts = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < parts; p++) {
        cloudData.push({
          x: cx + (rng() - 0.5) * 50,
          y: cy + (rng() - 0.5) * 20,
          z: cz + (rng() - 0.5) * 50,
          sx: 40 + rng() * 60,
          sy: 20 + rng() * 30,
          sz: 40 + rng() * 60,
          rotY: rng() * Math.PI,
        });
      }
    }

    if (cloudData.length > 0) {
      const cloudInst = new THREE.InstancedMesh(
        cloudGeo,
        cloudMat,
        cloudData.length
      );
      cloudInst.frustumCulled = false;
      cloudData.forEach((data, index) => {
        dummy.position.set(data.x, data.y, data.z);
        dummy.scale.set(data.sx, data.sy, data.sz);
        dummy.rotation.set(0, data.rotY, 0);
        dummy.updateMatrix();
        cloudInst.setMatrixAt(index, dummy.matrix);
      });
      cloudInst.position.set(worldOffsetX, 0, worldOffsetZ);
      objectsGroup.add(cloudInst);

      // Save data for the animate loop to drift them
      group.userData.cloudInst = cloudInst;
      group.userData.cloudData = cloudData;
    }

    // 4. Generate Birds
    group.userData.birds = [];
    const isAlienChunk = Math.abs(worldOffsetX) > 25000;
    if (!isCustom && !isAlienChunk && rng() < 0.2) {
      const baseX = worldOffsetX + (rng() - 0.5) * CHUNK_SIZE;
      const baseZ = worldOffsetZ + (rng() - 0.5) * CHUNK_SIZE;
      let baseY = getCachedElevation(baseX, baseZ) + 150 + rng() * 200;
      if (baseY > 400) baseY = 400;

      const baseRotationY = rng() * Math.PI * 2;

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

      const hawk = assembleHawk(4.0);
      hawk.position.set(baseX, baseY, baseZ);
      hawk.rotation.y = baseRotationY;

      hawk.userData.type = 'hawk';
      hawk.userData.speed = 0.4;
      hawk.userData.circleSpeed = 0.3 + rng() * 0.2;
      hawk.userData.circleRadius = 150 + rng() * 100;
      hawk.userData.circleCenter = new THREE.Vector3(baseX, baseY, baseZ);
      hawk.userData.angle = rng() * Math.PI * 2;
      hawk.userData.flapPhase = rng() * Math.PI * 2;
      hawk.userData.flapSpeed = 8.0 + rng() * 4.0;
      hawk.userData.flapDuration = 3.0 + rng() * 3.0;
      hawk.userData.soarDuration = 4.0 + rng() * 4.0;

      objectsGroup.add(hawk);
      group.userData.birds.push(hawk);
    }

    if (!isCustom && !isAlienChunk && rng() < 0.04) {
      const flockSize = 7 + Math.floor(rng() * 6); // 7 to 12 geese
      const baseX = worldOffsetX + (rng() - 0.5) * CHUNK_SIZE;
      const baseZ = worldOffsetZ + (rng() - 0.5) * CHUNK_SIZE;
      let baseY = getCachedElevation(baseX, baseZ) + 400 + rng() * 600;
      if (baseY > 1200) baseY = 1200;

      const baseRotationY = rng() * Math.PI * 2;
      const speed = 0.5 + rng() * 0.2;

      for (let i = 0; i < flockSize; i++) {
        const goose = new THREE.Group();
        const body = new THREE.Mesh(gooseBodyGeo, gooseBrownMat);
        const neck = new THREE.Mesh(gooseNeckGeo, gooseBlackMat);
        const head = new THREE.Mesh(gooseHeadGeo, gooseBlackMat);
        const beak = new THREE.Mesh(gooseBeakGeo, gooseBlackMat);
        const cheek = new THREE.Mesh(gooseCheekGeo, gooseWhiteMat);
        const tailWhite = new THREE.Mesh(gooseWhiteTailGeo, gooseWhiteMat);
        const tailBlack = new THREE.Mesh(gooseTailGeo, gooseBlackMat);
        const wingL = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
        const wingR = new THREE.Mesh(gooseWingGeo, gooseBrownMat);
        wingL.rotation.y = Math.PI;
        goose.add(
          body,
          neck,
          head,
          beak,
          cheek,
          tailWhite,
          tailBlack,
          wingL,
          wingR
        );
        goose.scale.set(3.5, 3.5, 3.5);
        goose.userData.wings = [wingL, wingR];

        let offsetX = 0;
        let offsetZ = 0;
        if (i > 0) {
          const row = Math.floor((i + 1) / 2);
          const side = i % 2 === 0 ? 1 : -1;
          offsetX = side * row * 35;
          offsetZ = row * 35;
        }

        const localPos = new THREE.Vector3(offsetX, 0, offsetZ);
        localPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), baseRotationY);

        goose.position.set(baseX + localPos.x, baseY, baseZ + localPos.z);
        goose.rotation.y = baseRotationY;

        goose.userData.type = 'goose';
        goose.userData.speed = speed;
        goose.userData.flapPhase = rng() * Math.PI * 2;
        goose.userData.flapSpeed = 3.0 + rng() * 1.0;
        goose.userData.flapDuration = 1000.0;
        goose.userData.soarDuration = 0.0;

        objectsGroup.add(goose);
        group.userData.birds.push(goose);
      }
    }

    group.traverse((child) => {
      if (child.isMesh || child.isInstancedMesh) {
        if (
          child.material !== waterMaterial &&
          child.material !== cloudMat &&
          child.material !== smokeMat &&
          child.material !== lighthouseBeamMat
        ) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      }
    });

    group.userData.counts = {
      trees_pine: treePositions.length + snowTreePositions.length,
      trees_decid: deciduousTreePositions.length,
      trees_palm: palmTreePositions.length,
      trees_dead: deadTreePositions.length,
      trees_autumn:
        autumnTree1Positions.length +
        autumnTree2Positions.length +
        autumnTree3Positions.length,
      trees_cherry: cherryTreePositions.length,
      trees_yellow_cortez: yellowCortezTreePositions.length,
      houses:
        housePositions.length +
        pagodaPositions.length +
        barnPositions.length +
        monasteryPositions.length +
        castleRuinsPositions.length,
      clouds: numClouds,
      rocks:
        rockPositions.length +
        snowRockPositions.length +
        desertRockPositions.length,
      bushes: bushPositions.length,
      snowmen: snowmanPositions.length,
      cactus: cactusPositions.length,
      lighthouses: lighthousePos ? 1 : 0,
      castles: castleRuinsPositions.length,
      windmills: windmillPositions.length,
      campfires: campfirePositions.length,
      boats: sailboatPositions.length,
      lily_pads: lilyPadPositions.length,
      piers: pierPositions.length,
      birds: group.userData.birds.length,
      chimneys: chimneySmokePositions.length,
    };
  }
}

function updateChunks() {
  const currentChunkX = Math.round(planeGroup.position.x / CHUNK_SIZE);
  const currentChunkZ = Math.round(planeGroup.position.z / CHUNK_SIZE);
  const renderDistance = RENDER_DISTANCE;

  for (let x = -renderDistance; x <= renderDistance; x++) {
    for (let z = -renderDistance; z <= renderDistance; z++) {
      const cx = currentChunkX + x;
      const cz = currentChunkZ + z;
      const key = `${cx},${cz}`;
      if (!chunks.has(key)) {
        chunks.set(key, generateChunk(cx, cz));
      }
    }
  }

  chunks.forEach((group, key) => {
    const [cx, cz] = key.split(',').map(Number);
    if (
      Math.abs(cx - currentChunkX) > renderDistance + 1 ||
      Math.abs(cz - currentChunkZ) > renderDistance + 1
    ) {
      group.traverse((child) => {
        if (child.isMesh || child.isInstancedMesh) {
          if (child.geometry && child.geometry.userData.unique) {
            child.geometry.dispose();
          }
        }
      });
      scene.remove(group);
      chunks.delete(key);
      if (key === '4,2') {
        if (persistentLighthouseLight) persistentLighthouseLight.intensity = 0;
        if (persistentLighthouseBeam) persistentLighthouseBeam.visible = false;
      }
    }
  });
}
function toggleProceduralObjects(enabled) {
  _enableObjects = enabled;
  ChillFlightLogic.setShowObjects(enabled);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('chill_flight_show_objects', enabled);
  }

  // Update all existing chunks
  chunks.forEach((group) => {
    if (group.userData.objectsGroup) {
      group.userData.objectsGroup.visible = enabled;
    }
  });

  // Update debug menu UI if it exists
  const toggle = document.getElementById('debug-objects-toggle');
  if (toggle) toggle.checked = enabled;
}

// Global expose
window.toggleProceduralObjects = toggleProceduralObjects;
