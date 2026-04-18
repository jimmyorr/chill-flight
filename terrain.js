// --- PROCEDURAL TERRAIN & CHUNKS ---
// Dependencies: THREE, simplex, CHUNK_SIZE, SEGMENTS, WATER_LEVEL, MOUNTAIN_LEVEL, scene

const chunks = new Map();

// GPU water uniform — shared globally so game.js animate() can update uTime
window.waterUniforms = { uTime: { value: 0.0 } };

const _initQualityForTerrain = localStorage.getItem('chill_flight_quality');
const _isLowQualityInitial = _initQualityForTerrain && parseInt(_initQualityForTerrain) <= 20;

const _enableBlockClouds = ChillFlightLogic.SHOW_CLOUDS;
let _enableObjects = ChillFlightLogic.SHOW_OBJECTS;


// Materials for terrain
const terrainMaterial = createMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.8
});

const waterMaterial = createMaterial({
    vertexColors: true,
    transparent: !_isLowQualityInitial,
    opacity: _isLowQualityInitial ? 1.0 : 0.6,
    metalness: 0.1,
    roughness: 0.05,
    flatShading: true
});

// Inject GPU wave math into the water material's vertex shader.
// This replaces the CPU-side per-vertex loop and computeVertexNormals().
waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = window.waterUniforms.uTime;

    // Add time uniform declaration to the top of the vertex shader
    shader.vertexShader = `
        uniform float uTime;
    ` + shader.vertexShader;

    // Inject analytical normal calculation (replaces computeVertexNormals)
    shader.vertexShader = shader.vertexShader.replace(
        `#include <beginnormal_vertex>`,
        `
        // Get world position for seamless tiling across chunks
        vec4 worldPos = modelMatrix * vec4(position, 1.0);

        // Analytical derivatives of the wave functions for correct lighting
        float dx = 0.8 * 0.02 * cos(uTime + worldPos.x * 0.02);
        float dz = -0.8 * 0.015 * sin(uTime * 0.8 + worldPos.z * 0.015);

        // Perpendicular vector for light reflection
        vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
        `
    );

    // Inject wave height displacement (replaces the CPU position array modification)
    shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        vec3 transformed = vec3(position);

        // Wave math running in parallel on the GPU
        float wave1 = sin(uTime + worldPos.x * 0.02) * 0.8;
        float wave2 = cos(uTime * 0.8 + worldPos.z * 0.015) * 0.8;

        transformed.y += wave1 + wave2;
        `
    );
};

// --- CLOUD GLOBALS ---
const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
const cloudMat = createMaterial({
    color: 0xffffff,
    transparent: !_isLowQualityInitial,
    opacity: _isLowQualityInitial ? 1.0 : 0.85,
    flatShading: true,
    roughness: 1.0
});

cloudMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = window.waterUniforms.uTime;
    shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
        `#include <project_vertex>`,
        `
        vec4 mvPosition = vec4( transformed, 1.0 );
        
        float drift = mod(uTime * 2.64, 2000.0);
        
        #ifdef USE_INSTANCING
            mat4 modInstanceMatrix = instanceMatrix;
            modInstanceMatrix[3].x = mod(modInstanceMatrix[3].x + drift + 1000.0, 2000.0) - 1000.0;
            mvPosition = modInstanceMatrix * mvPosition;
        #else
            mvPosition.x = mod(mvPosition.x + drift + 1000.0, 2000.0) - 1000.0;
        #endif

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `
    );
};

// Reusable tree geometries for forest instances
const treeTrunkGeo = new THREE.CylinderGeometry(1.5, 2.5, 12, 5);
treeTrunkGeo.translate(0, 6, 0);

function createPineGeometry() {
    const c1 = new THREE.ConeGeometry(9, 14, 5);
    c1.translate(0, 12, 0);
    const c2 = new THREE.ConeGeometry(7, 12, 5);
    c2.translate(0, 20, 0);
    const c3 = new THREE.ConeGeometry(5, 10, 5);
    c3.translate(0, 27, 0);

    const geometries = [c1, c2, c3];
    const pos = [], norm = [], uvs = [], idx = [];
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
    if (uvs.length > 0) geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(idx);
    return geom;
}
const treeLeavesGeo = createPineGeometry();

function createDeciduousGeometry() {
    const trunk = new THREE.CylinderGeometry(1.2, 1.8, 10, 5);
    trunk.translate(0, 5, 0);

    const leaf1 = new THREE.SphereGeometry(6, 6, 5);
    leaf1.translate(0, 10, 0);
    const leaf2 = new THREE.SphereGeometry(4.5, 6, 5);
    leaf2.translate(3, 8, 2);
    const leaf3 = new THREE.SphereGeometry(4.5, 6, 5);
    leaf3.translate(-3, 8, -2);

    const geometries = [leaf1, leaf2, leaf3];
    const pos = [], norm = [], idx = [];
    let offset = 0;

    for (const g of geometries) {
        pos.push(...g.attributes.position.array);
        norm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) idx.push(g.index.array[i] + offset);
        offset += g.attributes.position.count;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geom.setIndex(idx);
    return { trunk, leaves: geom };
}
const deciduousGeos = createDeciduousGeometry();

function createPalmGeometry() {
    const trunkSegments = 6;
    const trunkHeights = [];
    const geometries = [];

    // Curved trunk parts
    for (let i = 0; i < trunkSegments; i++) {
        const h = 3;
        const g = new THREE.CylinderGeometry(1.2 - i * 0.1, 1.3 - i * 0.1, h, 6);
        const angle = i * 0.15;
        g.rotateZ(angle);
        g.translate(Math.sin(angle) * i * 2, i * h + h / 2, 0);
        geometries.push(g);
    }

    const leafShape = new THREE.BoxGeometry(12, 0.2, 2.5);
    leafShape.translate(6, 0, 0);

    const leafGeos = [];
    for (let i = 0; i < 6; i++) {
        const lg = leafShape.clone();
        lg.rotateY((i * Math.PI * 2) / 6);
        lg.rotateZ(-0.4);
        const lastAngle = (trunkSegments - 1) * 0.15;
        lg.translate(Math.sin(lastAngle) * (trunkSegments - 1) * 2, trunkSegments * 3, 0);
        leafGeos.push(lg);
    }

    const combinedTrunkPos = [], combinedTrunkNorm = [], combinedTrunkIdx = [];
    let trunkOffset = 0;
    for (const g of geometries) {
        combinedTrunkPos.push(...g.attributes.position.array);
        combinedTrunkNorm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) combinedTrunkIdx.push(g.index.array[i] + trunkOffset);
        trunkOffset += g.attributes.position.count;
    }
    const trunkGeom = new THREE.BufferGeometry();
    trunkGeom.setAttribute('position', new THREE.Float32BufferAttribute(combinedTrunkPos, 3));
    trunkGeom.setAttribute('normal', new THREE.Float32BufferAttribute(combinedTrunkNorm, 3));
    trunkGeom.setIndex(combinedTrunkIdx);

    const combinedLeafPos = [], combinedLeafNorm = [], combinedLeafIdx = [];
    let leafOffset = 0;
    for (const g of leafGeos) {
        combinedLeafPos.push(...g.attributes.position.array);
        combinedLeafNorm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) combinedLeafIdx.push(g.index.array[i] + leafOffset);
        leafOffset += g.attributes.position.count;
    }
    const leafGeom = new THREE.BufferGeometry();
    leafGeom.setAttribute('position', new THREE.Float32BufferAttribute(combinedLeafPos, 3));
    leafGeom.setAttribute('normal', new THREE.Float32BufferAttribute(combinedLeafNorm, 3));
    leafGeom.setIndex(combinedLeafIdx);

    return { trunk: trunkGeom, leaves: leafGeom };
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
    const pos = [], norm = [], idx = [];
    let offset = 0;
    for (const g of geometries) {
        pos.push(...g.attributes.position.array);
        norm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) idx.push(g.index.array[i] + offset);
        offset += g.attributes.position.count;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geom.setIndex(idx);
    return geom;
}
const deadTreeGeo = createDeadTreeGeometry();

const treeTrunkMat = createMaterial({ color: 0x5D4037, flatShading: true });
// Leaf materials use WHITE as the base color so per-instance colors control the actual appearance
// (Three.js multiplies instance color × material color, so white = identity / no tint)
const treeLeavesBaseMat = createMaterial({ color: 0xFFFFFF, flatShading: true });
const deadTreeMat = createMaterial({ color: 0x8D6E63, flatShading: true });

// Rock geometries and materials
const rockGeo = new THREE.DodecahedronGeometry(3, 0); // Base flat shaded rock
const rockMat = createMaterial({ color: 0x888888, flatShading: true });
const snowRockMat = createMaterial({ color: 0xDDDDDD, flatShading: true });
const desertRockMat = createMaterial({ color: 0xD2B48C, flatShading: true });

// Cactus geometries and materials
function createCactusGeometry() {
    const mainGeo = new THREE.CylinderGeometry(1.5, 1.5, 12, 6);
    mainGeo.translate(0, 6, 0);
    const armGeo1 = new THREE.CylinderGeometry(1, 1, 5, 5);
    armGeo1.translate(2.5, 6, 0);
    const armGeo2 = new THREE.CylinderGeometry(1, 1, 6, 5);
    armGeo2.translate(-2.5, 4, 0);
    const geometries = [mainGeo, armGeo1, armGeo2];
    const pos = [], norm = [], idx = [];
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
const cactusMat = createMaterial({ color: 0x4CAF50, flatShading: true });

// Lily pad geometry and material
function createLilyPadGeometry() {
    // A flat cylinder with a slice removed (pacman shape)
    const padGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 8, 1, false, 0, Math.PI * 1.8);
    return padGeo;
}
const lilyPadGeo = createLilyPadGeometry();
const lilyPadMat = createMaterial({ color: 0x4CAF50, flatShading: true });

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
    let pos = [], norm = [], idx = [];
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
const bushMat = createMaterial({ color: 0x558B2F, flatShading: true }); // Darker green

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
    let pos = [], norm = [], idx = [];
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

    return { body: bodyGeom, nose: noseGeo };
}
const snowmanGeos = createSnowmanGeometry();
const snowmanBodyMat = createMaterial({ color: 0xFFFFFF, flatShading: true });
const snowmanNoseMat = createMaterial({ color: 0xFF8C00, flatShading: true });

// Autumn & Cherry Blossom materials
const autumnLeavesMat1 = createMaterial({ color: 0xD35400, flatShading: true }); // Burnt Orange
const autumnLeavesMat2 = createMaterial({ color: 0xF39C12, flatShading: true }); // Orange
const autumnLeavesMat3 = createMaterial({ color: 0xC0392B, flatShading: true }); // Strong Red
const cherryBlossomMat = createMaterial({ color: 0xF8BBD0, flatShading: true }); // Pink

// Reusable house geometries
const houseBodyGeo = new THREE.BoxGeometry(10, 8, 10);
houseBodyGeo.translate(0, 4, 0);
const houseRoofGeo = new THREE.ConeGeometry(8.5, 6, 4);
houseRoofGeo.rotateY(Math.PI / 4);
houseRoofGeo.translate(0, 11, 0);
const houseWindowGeo = new THREE.BoxGeometry(2.5, 3.5, 0.5);

// House color palettes
const houseBodyPalette = [
    createMaterial({ color: 0xF5E6C8, flatShading: true }), // Cream
    createMaterial({ color: 0xD9B99B, flatShading: true }), // Sandy tan
    createMaterial({ color: 0xB0C4A0, flatShading: true }), // Sage green
    createMaterial({ color: 0xC8D8E8, flatShading: true }), // Pale blue
    createMaterial({ color: 0xE8C8B0, flatShading: true }), // Terracotta peach
    createMaterial({ color: 0xCCBBCC, flatShading: true }), // Dusty mauve
];
const houseRoofPalette = [
    createMaterial({ color: 0x5D4037, flatShading: true }), // Dark brown
    createMaterial({ color: 0x7B3F2A, flatShading: true }), // Brick red
    createMaterial({ color: 0x546E7A, flatShading: true }), // Slate blue-grey
    createMaterial({ color: 0x4A4A3A, flatShading: true }), // Charcoal
];

// Window Materials (5 variations for staggered lighting)
const houseWindowMats = [];
for (let i = 0; i < 5; i++) {
    houseWindowMats.push(createMaterial({
        color: 0x111111,
        emissive: 0xFFD54F,
        emissiveIntensity: 0.0,
        roughness: 0
    }));
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
    const pos = [], norm = [], idx = [];
    let offset = 0;
    for (const g of geometries) {
        pos.push(...g.attributes.position.array);
        norm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) idx.push(g.index.array[i] + offset);
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
    const pos = [], norm = [], idx = [];
    let offset = 0;
    for (const g of geometries) {
        pos.push(...g.attributes.position.array);
        norm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) idx.push(g.index.array[i] + offset);
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
const pagodaBodyMat = createMaterial({ color: 0x3E2723, flatShading: true }); // dark wood
const pagodaRoofMat = createMaterial({ color: 0x1B5E20, flatShading: true }); // deep green eaves

// --- BARN ---
function createBarnRoofGeometry() {
    // Triangular prism gable roof
    const hw = 11.5, hl = 15, yBase = 12, yPeak = 22;
    const verts = new Float32Array([
        -hw, yBase, hl,   // 0 front-left
        hw, yBase, hl,   // 1 front-right
        0, yPeak, hl,   // 2 front-peak
        -hw, yBase, -hl,   // 3 back-left
        hw, yBase, -hl,   // 4 back-right
        0, yPeak, -hl,   // 5 back-peak
    ]);
    const indices = [
        0, 1, 2,         // front gable
        3, 5, 4,         // back gable
        0, 2, 5, 0, 5, 3, // left slope
        1, 4, 5, 1, 5, 2, // right slope
        0, 3, 4, 0, 4, 1, // bottom (under barn body)
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}
const barnBodyGeo = new THREE.BoxGeometry(18, 12, 28);
barnBodyGeo.translate(0, 6, 0);
const barnRoofGeo = createBarnRoofGeometry();
const barnBodyMat = createMaterial({ color: 0xB71C1C, flatShading: true }); // barn red
const barnRoofMat = createMaterial({ color: 0x4E342E, flatShading: true }); // dark timber

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
    const pos = [], norm = [], idx = [];
    let offset = 0;
    for (const g of geometries) {
        pos.push(...g.attributes.position.array);
        norm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) idx.push(g.index.array[i] + offset);
        offset += g.attributes.position.count;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geom.setIndex(idx);
    return geom;
}
const monasteryBodyGeo = createMonasteryBodyGeometry();
const monasteryCapGeo = new THREE.ConeGeometry(5.5, 7, 4);
monasteryCapGeo.rotateY(Math.PI / 4);
monasteryCapGeo.translate(-16, 23, 0); // sits on top of the tower
const monasteryBodyMat = createMaterial({ color: 0x9E9E9E, flatShading: true }); // stone
const monasteryCapMat = createMaterial({ color: 0x546E7A, flatShading: true });  // slate

// --- CASTLE RUINS ---
function createCastleRuinsGeometry() {
    // Tall main tower
    const tower1 = new THREE.CylinderGeometry(5, 6.5, 36, 8);
    tower1.translate(0, 18, 0);
    // Shorter broken tower
    const tower2 = new THREE.CylinderGeometry(4.5, 6, 20, 8);
    tower2.translate(26, 10, 4);
    // Connecting curtain wall
    const wall = new THREE.BoxGeometry(24, 9, 4);
    wall.translate(13, 4.5, 2);
    // Crumbled wall stub (offset, slightly rotated look via translate)
    const stub = new THREE.BoxGeometry(8, 5, 3);
    stub.translate(-7, 2.5, -10);
    const geometries = [tower1, tower2, wall, stub];
    const pos = [], norm = [], idx = [];
    let offset = 0;
    for (const g of geometries) {
        pos.push(...g.attributes.position.array);
        norm.push(...g.attributes.normal.array);
        for (let i = 0; i < g.index.array.length; i++) idx.push(g.index.array[i] + offset);
        offset += g.attributes.position.count;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    geom.setIndex(idx);
    return geom;
}
const castleRuinsGeo = createCastleRuinsGeometry();
const castleRuinsMat = createMaterial({ color: 0x78909C, flatShading: true }); // weathered stone

// Bird geometry
const birdBodyGeo = new THREE.BoxGeometry(1, 0.8, 4);
const birdWingGeo = new THREE.BoxGeometry(6, 0.1, 2);
birdWingGeo.translate(3, 0, 0);
const birdHeadGeo = new THREE.ConeGeometry(0.5, 1.5, 4);
birdHeadGeo.rotateX(-Math.PI / 2);
birdHeadGeo.translate(0, 0, -2);
const hawkMat = createMaterial({ color: 0x442200, flatShading: true });

// Windmill geometries
const windmillBaseGeo = new THREE.CylinderGeometry(5, 8, 30, 6);
windmillBaseGeo.translate(0, 15, 0);
const windmillBladesGeo = new THREE.BoxGeometry(2, 30, 0.5);
windmillBladesGeo.translate(0, 15, 0); // Rotate around bottom center
const windmillBaseMat = createMaterial({ color: 0x8D6E63, flatShading: true });
const windmillBladesMat = createMaterial({ color: 0xEEEEEE, flatShading: true });

// Lighthouse geometries
const lighthousePieceGeo = new THREE.CylinderGeometry(8, 8, 20, 8);
const lighthouseTopGeo = new THREE.SphereGeometry(10, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
lighthouseTopGeo.translate(0, 60, 0);

const lighthouseRedMat = createMaterial({ color: 0xC62828, flatShading: true });
const lighthouseWhiteMat = createMaterial({ color: 0xFFFFFF, flatShading: true });

// Pier geometries
const pierDeckGeo = new THREE.BoxGeometry(15, 2, 30);
pierDeckGeo.translate(0, 1, 15); // Extend from shore
const pierPostGeo = new THREE.CylinderGeometry(1, 1, 10, 6);
const woodMat = createMaterial({ color: 0x5D4037, flatShading: true });

// Tent geometries
const tentGeo = new THREE.ConeGeometry(8, 12, 4);
tentGeo.rotateY(Math.PI / 4);
tentGeo.translate(0, 6, 0);
const tentMat = createMaterial({ color: 0xD2B48C, flatShading: true }); // Tan color

// Campfire geometries
const fireLogGeo = new THREE.CylinderGeometry(0.8, 0.8, 6, 6);
fireLogGeo.rotateZ(Math.PI / 2);
const fireCoreGeo = new THREE.SphereGeometry(2, 8, 8);
const fireMat = createMaterial({ color: 0xFF4500, emissive: 0xFF4500, emissiveIntensity: 2.0 });

// Smoke geometry and material community
const smokeGeo = new THREE.BoxGeometry(2, 2, 2);
const smokeMat = createMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.4,
    flatShading: true
});

const whiteSmokeMat = createMaterial({
    color: 0xDDDDDD,
    transparent: true,
    opacity: 0.6,
    flatShading: true
});

// --- GPU ANIMATION SHADER INJECTIONS ---
if (!window.animationUniforms) window.animationUniforms = { uTime: { value: 0 } };

windmillBladesMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = window.animationUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float c = cos(uTime * 1.5);
        float s = sin(uTime * 1.5);
        mat3 rotZ = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
        transformed = rotZ * transformed;
    `);
};

fireMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = window.animationUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float phase = instanceMatrix[3][0] + instanceMatrix[3][2];
        float pulse = 1.0 + sin(uTime * 10.0 + phase) * 0.2;
        transformed *= pulse;
    `);
};

const smokeShaderInject = (shader, isChimney) => {
    shader.uniforms.uTime = window.animationUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform float uTime;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
        float particleIndex = instanceColor.r * 10.0;
        float phase = instanceColor.g * 10.0;
        #else
        float particleIndex = 0.0;
        float phase = 0.0;
        #endif
        
        float offsetTime = mod(uTime * 0.5 + particleIndex * ${isChimney ? '0.6' : '0.4'} + phase, ${isChimney ? '2.4' : '2.0'});
        float rise = offsetTime * ${isChimney ? '45.0' : '60.0'};
        float driftX = sin(uTime * 0.5 + particleIndex) * 8.0;
        float driftZ = ${isChimney ? 'cos(uTime * 0.6 + particleIndex) * 6.0' : '0.0'};
        float smokeScale = (${isChimney ? '0.8' : '1.0'} + particleIndex * ${isChimney ? '0.3' : '0.5'}) * (1.0 + offsetTime * ${isChimney ? '0.6' : '0.5'});
        
        float st = sin(offsetTime * ${isChimney ? '0.5' : '1.0'});
        float ct = cos(offsetTime * ${isChimney ? '0.5' : '1.0'});
        mat3 rotY = mat3(ct, 0.0, st, 0.0, 1.0, 0.0, -st, 0.0, ct);
        mat3 rotZ = mat3(ct, -st, 0.0, st, ct, 0.0, 0.0, 0.0, 1.0);
        
        transformed = rotY * rotZ * transformed * smokeScale;
        transformed.x += driftX;
        transformed.y += rise;
        transformed.z += driftZ;
    `);
};

smokeMat.onBeforeCompile = (shader) => smokeShaderInject(shader, false);
whiteSmokeMat.onBeforeCompile = (shader) => smokeShaderInject(shader, true);


// Sailboat geometries
const boatHullGeo = new THREE.BoxGeometry(4, 2, 10);
boatHullGeo.translate(0, 0.5, 0); // slight lift
const boatMastGeo = new THREE.CylinderGeometry(0.2, 0.2, 12, 4);
boatMastGeo.translate(0, 6, -1);
const boatSailGeo = new THREE.BufferGeometry();
const sailVertices = new Float32Array([
    0, 2, -1,
    0, 12, -1,
    0, 2, -8
]);
boatSailGeo.setAttribute('position', new THREE.BufferAttribute(sailVertices, 3));
boatSailGeo.computeVertexNormals();
const boatHullMat = createMaterial({ color: 0x8B4513, flatShading: true });
const boatSailMat = createMaterial({ color: 0xFFFFFF, flatShading: true, side: THREE.DoubleSide });

// Lighthouse Beam geometry - wider and longer
const lighthouseBeamGeo = new THREE.CylinderGeometry(40, 2, 500, 16, 1, true);
lighthouseBeamGeo.rotateX(Math.PI / 2);
lighthouseBeamGeo.translate(0, 0, 250);

// Add vertex colors for a volumetric fade out
const count = lighthouseBeamGeo.attributes.position.count;
const colors = new Float32Array(count * 3);
const posArray = lighthouseBeamGeo.attributes.position.array;
const baseColor = new THREE.Color(0xFFFFaa);

for (let i = 0; i < count; i++) {
    const z = posArray[i * 3 + 2]; // Z goes from 0 to 500
    // Non-linear fade: keeps core bright, fades tail out smoothly
    const intensity = Math.pow(Math.max(0, 1.0 - (z / 500)), 1.5);
    colors[i * 3] = baseColor.r * intensity;
    colors[i * 3 + 1] = baseColor.g * intensity;
    colors[i * 3 + 2] = baseColor.b * intensity;
}
lighthouseBeamGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const lighthouseBeamMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false
});

function getBiome(x, z) {
    return ChillFlightLogic.getBiome(x, z, simplex);
}

function getElevation(x, z) {
    return ChillFlightLogic.getElevation(
        x, z, simplex,
        { WATER_LEVEL, MOUNTAIN_LEVEL, MAP_WORLD_SIZE, MAP_HEIGHT_SCALE },
        THREE.MathUtils.lerp
    );
}

// Optimization: Pre-allocate colors used in chunk generation loop to prevent GC stalling
const _colorPlains = new THREE.Color(0x7CB342);
const _colorForest = new THREE.Color(0x388E3C);
const _colorSnow = new THREE.Color(0xFFFFFF);
const _colorDesert = new THREE.Color(0xE2725B);
const _colorSand = new THREE.Color(0xE0E0A8);
const _colorDesertSand = new THREE.Color(0xF4A460);
const _colorWater = new THREE.Color(0x40C4FF);
const _colorIcyWater = new THREE.Color(0x88CCFF);
const _colorDesertWater = new THREE.Color(0x00CED1);
const _colorFoam = new THREE.Color(0xEEEEEE);
const _colorSandSnowTint = new THREE.Color(0x999999);
const _colorUpperSandSnowTint = new THREE.Color(0xDDDDDD);
const _colorForestSnowTint = new THREE.Color(0x8BA192);
const _colorForestDesertTint = new THREE.Color(0xA0522D);
const _colorPlainsSnowTint = new THREE.Color(0xFAFAFA);
const _colorMountainDesertTint = new THREE.Color(0xCD853F);
const _colorMountainTint = new THREE.Color(0x7F8C8D);
const _colorAutumnForestTint = new THREE.Color(0x5D4037);
const _colorAutumnPlainsTint = new THREE.Color(0x8D6E63);
const _colorCherryForestTint = new THREE.Color(0xF8BBD0);
const _colorCherryPlainsTint = new THREE.Color(0xFCE4EC);

function generateChunk(chunkX, chunkZ) {
    const group = new THREE.Group();
    group.userData.worldPosition = new THREE.Vector3(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE);
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
        const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, SEGMENTS, SEGMENTS);
        geometry.userData = { unique: true };
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
        const housePositions = [];
        const windmillPositions = [];
        let lighthousePos = null;
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
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            const localX = positions[i];
            const localZ = positions[i + 2];
            const worldX = worldOffsetX + localX;
            const worldZ = worldOffsetZ + localZ;

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

            // --- BIOME FACTORS ---
            const northInfluence = Math.max(0, -worldZ / 4500);
            // Add more noise to biome transitions to avoid smooth boring circles
            const noisePath = simplex.noise2D(worldX * 0.0001, worldZ * 0.0001);
            const biomeNoise = simplex.noise2D(worldX * 0.0005, worldZ * 0.0005) * 0.1;

            const snowRaw = Math.max(0, Math.min(1, (northInfluence + noisePath * 0.05 + biomeNoise - 0.7) * 1.5));
            const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);

            const southInfluence = Math.max(0, worldZ / 4500);
            const desertRaw = Math.max(0, Math.min(1, (southInfluence + noisePath * 0.05 - biomeNoise - 0.7) * 1.5));
            const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

            const temperature = noisePath - (northInfluence * 1.5);
            const isSnowBiome = snowFactor > 0.5;

            // East code beachfront
            const eastCoastFactor = Math.max(0, Math.min(1, worldX / 3000));
            const sandMaxHeight = WATER_LEVEL + 2 + (eastCoastFactor * 8);

            const isForest = simplex.noise2D(worldX * 0.005 + 100, worldZ * 0.005) > 0.2;
            const autumnNoise = simplex.noise2D(worldX * 0.0003 + 500, worldZ * 0.0003 + 500);
            const cherryNoise = simplex.noise2D(worldX * 0.0005 + 1000, worldZ * 0.0005 + 1000);

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
                    _tempColorObj.lerp(new THREE.Color(0x000000), mottle * 0.1);
                }
                positions[i + 1] = finalHeight;
            } else {
                if (height <= sandMaxHeight) {
                    if (height <= WATER_LEVEL) {
                        hasWater = true;
                        if (_enableObjects) {
                            if (rng() < 0.0005 * densityScale) { // Very rare sailboat
                                sailboatPositions.push({ x: localX, y: WATER_LEVEL, z: localZ, rotY: rng() * Math.PI * 2 });
                            }
                            if (snowFactor < 0.1 && desertFactor < 0.1 && getBiome(worldX, worldZ) > -0.15 && rng() < 0.015 * densityScale) {
                                lilyPadPositions.push({ x: localX, y: WATER_LEVEL, z: localZ, rotY: rng() * Math.PI * 2 });
                            }
                        }
                        positions[i + 1] = height - 5;
                        _tempColorObj.copy(_colorSand);
                        if (snowFactor > 0) _tempColorObj.lerp(_colorSandSnowTint, snowFactor);
                        if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, desertFactor);
                    } else if (height <= WATER_LEVEL + 0.5) {
                        _tempColorObj.copy(_colorFoam);
                        if (snowFactor > 0) _tempColorObj.lerp(_colorSnow, snowFactor);
                    } else {
                        _tempColorObj.copy(_colorSand);
                        if (snowFactor > 0) _tempColorObj.lerp(_colorUpperSandSnowTint, snowFactor);
                        if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, desertFactor);

                        // Mottling for sand (adding some dark/light patches)
                        if (!isCustom && mottle > 0.6) _tempColorObj.lerp(new THREE.Color(0xD2B48C), (mottle - 0.6) * 0.5);
                        if (!isCustom && mottle < 0.4) _tempColorObj.lerp(new THREE.Color(0xDEB887), (0.4 - mottle) * 0.5);
                    }
                } else if (height > MOUNTAIN_LEVEL || (snowFactor > 0.5 && height > MOUNTAIN_LEVEL - 50)) {
                    // Massive sierra gets highly refined, patchy-to-solid snow OR Arizona desert rock
                    const sierraSnowNoise1 = simplex.noise2D(worldX * 0.003, worldZ * 0.003);
                    const sierraSnowNoise2 = simplex.noise2D(worldX * 0.012, worldZ * 0.012) * 0.5;
                    const organicNoise = (sierraSnowNoise1 + sierraSnowNoise2);

                    const isSouth = worldZ > 0;
                    const canHaveSnow = !isSouth;

                    if (height > 600) {
                        const baseThreshold = 1450 + organicNoise * 400;
                        if (canHaveSnow && (height > baseThreshold || (height > 2000 && organicNoise > -0.5))) {
                            _tempColorObj.copy(_colorSnow);
                        } else {
                            if (isSouth) {
                                _tempColorObj.setHex(0xC24B2B); // Reddish mountain rock
                                if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, 0.4);
                                // Arizona mottling: subtle dark red patches
                                if (mottle > 0.7) _tempColorObj.lerp(new THREE.Color(0x8B0000), 0.2);
                            } else {
                                _tempColorObj.copy(desertFactor > 0.5 ? _colorMountainDesertTint : _colorMountainTint);
                            }
                        }
                    } else {
                        const rockStartHeight = MOUNTAIN_LEVEL + 500 + organicNoise * 100;
                        if (canHaveSnow && height > (MOUNTAIN_LEVEL + 50 + organicNoise * 60)) {
                            _tempColorObj.copy(_colorSnow);
                        } else if (height > rockStartHeight) {
                            if (isSouth) {
                                _tempColorObj.setHex(0xC24B2B);
                                if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, 0.4);
                                if (mottle > 0.7) _tempColorObj.lerp(new THREE.Color(0x8B0000), 0.2);
                            } else {
                                _tempColorObj.copy(desertFactor > 0.5 ? _colorMountainDesertTint : _colorMountainTint);
                            }
                        } else {
                            if (desertFactor > 0.3) {
                                _tempColorObj.copy(_colorDesertSand);
                                if (height > WATER_LEVEL + 5) _tempColorObj.lerp(new THREE.Color(0xD2B48C), 0.3);
                                // Desert mottling
                                _tempColorObj.lerp(new THREE.Color(0xDAA520), mottle * 0.2);
                            } else if (snowFactor > 0.4) {
                                _tempColorObj.copy(_colorForestSnowTint);
                            } else {
                                _tempColorObj.copy(_colorForest);
                                // Forest mottling: darker green patches
                                if (!isCustom) _tempColorObj.lerp(new THREE.Color(0x006400), mottle * 0.3);
                            }
                        }
                    }
                } else {
                    // --- STANDARD LAND COLORING (Plains/Forest) ---
                    if (isForest) {
                        _tempColorObj.copy(_colorForest);
                        if (snowFactor > 0) _tempColorObj.lerp(_colorForestSnowTint, snowFactor);
                        if (desertFactor > 0) _tempColorObj.lerp(_colorForestDesertTint, desertFactor);

                        // Mottling for Forest: Mix in some darker evergreens and lighter mossy patches
                        _tempColorObj.lerp(new THREE.Color(0x004d00), mottle * 0.4);
                        if (mottle < 0.3) _tempColorObj.lerp(new THREE.Color(0x6B8E23), 0.2);
                    } else {
                        _tempColorObj.copy(_colorPlains);
                        if (snowFactor > 0) _tempColorObj.lerp(_colorPlainsSnowTint, snowFactor);
                        if (desertFactor > 0) _tempColorObj.lerp(_colorDesertSand, desertFactor);

                        // Mottling for Plains: Dry grass vs lush grass
                        _tempColorObj.lerp(new THREE.Color(0x556B2F), mottle * 0.4);
                        if (mottle > 0.8) _tempColorObj.lerp(new THREE.Color(0xBDB76B), 0.3);
                    }
                }
            }

            // --- LAND TYPE CLASSIFICATION ---
            const isStandardLand = !isCustom && height > sandMaxHeight && height <= MOUNTAIN_LEVEL + (snowFactor > 0.5 ? -50 : 0);
            const isCustomLand = isCustom && height > WATER_LEVEL + 5.0 && height < 105.0;

            // --- BIOME TINTING (Autumn/Cherry) ---
            if ((isStandardLand || isCustomLand) && snowFactor < 0.2) {
                if (autumnNoise > 0.35) {
                    const factor = Math.min(1, (autumnNoise - 0.35) / 0.1);
                    const tint = isForest ? _colorAutumnForestTint : _colorAutumnPlainsTint;
                    _tempColorObj.lerp(tint, factor * (isForest ? 0.65 : 0.45));
                } else if (cherryNoise > 0.55) {
                    const factor = Math.min(1, (cherryNoise - 0.55) / 0.1);
                    const tint = isForest ? _colorCherryForestTint : _colorCherryPlainsTint;
                    _tempColorObj.lerp(tint, factor * (isForest ? 0.45 : 0.3));
                }
            }

            if (_enableObjects && (isStandardLand || isCustomLand)) {
                if (isForest) {
                    const treeRoll = rng();
                    if (treeRoll < (desertFactor > 0.5 ? 0.05 : 0.15) * densityScale) {
                        if (snowFactor > 0.4 || height > MOUNTAIN_LEVEL - 100) {
                            snowTreePositions.push({ x: localX, y: height, z: localZ });
                        } else if (desertFactor > 0.6) {
                            deadTreePositions.push({ x: localX, y: height, z: localZ });
                        } else if (eastCoastFactor > 0.7 && height < WATER_LEVEL + 40) {
                            palmTreePositions.push({ x: localX, y: height, z: localZ });
                        } else {
                            if (cherryNoise > 0.65) {
                                cherryTreePositions.push({ x: localX, y: height, z: localZ });
                            } else if (autumnNoise > 0.45) {
                                const variety = rng();
                                if (variety < 0.33) autumnTree1Positions.push({ x: localX, y: height, z: localZ });
                                else if (variety < 0.66) autumnTree2Positions.push({ x: localX, y: height, z: localZ });
                                else autumnTree3Positions.push({ x: localX, y: height, z: localZ });
                            } else {
                                deciduousTreePositions.push({ x: localX, y: height, z: localZ });
                            }
                        }
                    } else if (treeRoll < (desertFactor > 0.5 ? 0.0505 : 0.151) * densityScale) {
                        const offX = (rng() - 0.5) * 15;
                        const offZ = (rng() - 0.5) * 15;
                        const h = getCachedElevation(worldX + offX, worldZ + offZ);
                        campfirePositions.push({ x: localX + offX, y: h, z: localZ + offZ });
                    }
                } else {
                    const houseThreshold = (desertFactor > 0.5 ? 0.002 : 0.005) * densityScale;
                    const barnThreshold = houseThreshold + 0.002 * densityScale;
                    const monasteryThreshold = houseThreshold + 0.0023 * densityScale;
                    const castleThreshold = houseThreshold + 0.0024 * densityScale;
                    const windmillThreshold = houseThreshold + 0.0025 * densityScale;

                    const plainsRoll = rng();
                    if (plainsRoll < houseThreshold) {
                        housePositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                        // Chimney smoke for houses in snowy areas
                        if (snowFactor > 0.3) {
                            chimneySmokePositions.push({ x: localX, y: height + 10, z: localZ });
                        }
                    } else if (ENABLE_BARNS && plainsRoll < barnThreshold
                        && snowFactor < 0.4 && desertFactor < 0.3
                        && height > WATER_LEVEL + 3 && height < MOUNTAIN_LEVEL - 100) {
                        barnPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                    } else if (ENABLE_MONASTERIES && plainsRoll < monasteryThreshold
                        && snowFactor < 0.2 && desertFactor < 0.2
                        && height > WATER_LEVEL + 50 && height < MOUNTAIN_LEVEL - 50) {
                        monasteryPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                    } else if (ENABLE_CASTLE_RUINS && plainsRoll < castleThreshold
                        && snowFactor < 0.5 && desertFactor < 0.3
                        && height > WATER_LEVEL + 40 && height < MOUNTAIN_LEVEL - 30) {
                        castleRuinsPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                    } else if (plainsRoll < windmillThreshold
                        && height > WATER_LEVEL + 5 && height < MOUNTAIN_LEVEL - 100
                        && desertFactor < 0.3 && snowFactor < 0.3) {
                        windmillPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                    } else if (ENABLE_LIGHTHOUSES && !lighthousePos && rng() < 0.0004 * densityScale && height < sandMaxHeight + 15) {
                        const hN = getCachedElevation(worldX, worldZ - 50);
                        const hS = getCachedElevation(worldX, worldZ + 50);
                        const hE = getCachedElevation(worldX + 50, worldZ);
                        const hW = getCachedElevation(worldX - 50, worldZ);
                        if (hN <= WATER_LEVEL || hS <= WATER_LEVEL || hE <= WATER_LEVEL || hW <= WATER_LEVEL) {
                            lighthousePos = { x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 };
                        }
                    }

                    if (height > WATER_LEVEL + 0.5 && height < WATER_LEVEL + 3 && rng() < 0.15 * densityScale) {
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
                            pierPositions.push({ x: localX, y: height, z: localZ, rotY: angleToWater });
                        }
                    }
                }

                if (ENABLE_PAGODAS && cherryNoise > 0.65 && snowFactor < 0.2 && desertFactor < 0.2
                    && height > WATER_LEVEL + 5 && height < MOUNTAIN_LEVEL - 80
                    && rng() < 0.0003 * densityScale) {
                    pagodaPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                }

                if (rng() < 0.015 * densityScale) {
                    if (snowFactor > 0.4) snowRockPositions.push({ x: localX, y: height, z: localZ });
                    else if (desertFactor > 0.4) desertRockPositions.push({ x: localX, y: height, z: localZ });
                    else rockPositions.push({ x: localX, y: height, z: localZ });
                }

                if (desertFactor > 0.4 && rng() < 0.04 * densityScale && height > WATER_LEVEL + 5 && height < MOUNTAIN_LEVEL - 50) {
                    cactusPositions.push({ x: localX, y: height, z: localZ });
                }
                if (snowFactor > 0.6 && rng() < 0.002 * densityScale && height > WATER_LEVEL + 5 && height < MOUNTAIN_LEVEL - 50) {
                    snowmanPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                }
                if (desertFactor < 0.2 && snowFactor < 0.3 && height > WATER_LEVEL + 3 && height < MOUNTAIN_LEVEL - 100 && rng() < 0.08 * densityScale) {
                    bushPositions.push({ x: localX, y: height, z: localZ, rotY: rng() * Math.PI * 2 });
                }
            }

            // --- FINAL DETAIL PASS ---
            if (slopeFactor > 0.45 && height > WATER_LEVEL + 5) {
                const cliffBlend = Math.min(1, (slopeFactor - 0.45) * 5.0);
                const isSouthBiome = !isCustom && desertFactor > 0.3;
                const rockColor = isSouthBiome ? new THREE.Color(0x8B3A3A) : new THREE.Color(0x7F8C8D);
                _tempColorObj.lerp(rockColor, cliffBlend);
                _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.15);
            } else if (slopeFactor > 0.1) {
                _tempColorObj.multiplyScalar(1.0 - slopeFactor * 0.3);
            }

            if (!isCustom) {
                _tempColorObj.multiplyScalar(1.0 + grain);
            }
            colors.push(_tempColorObj.r, _tempColorObj.g, _tempColorObj.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

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
            const waterGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, wSegments, wSegments);
            waterGeo.userData = { unique: true };
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
                const snowRaw = Math.max(0, Math.min(1, (northInfluence + tempNoise * 0.05 - 0.7) * 1.5));
                const snowFactor = snowRaw * snowRaw * (3 - 2 * snowRaw);
                const desertRaw = Math.max(0, Math.min(1, (southInfluence + tempNoise * 0.05 - 0.7) * 1.5));
                const desertFactor = desertRaw * desertRaw * (3 - 2 * desertRaw);

                _tempWColorObj.copy(_colorWater);
                if (snowFactor > 0) _tempWColorObj.lerp(_colorIcyWater, snowFactor);
                if (desertFactor > 0) _tempWColorObj.lerp(_colorDesertWater, desertFactor);

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
            waterGeo.setAttribute('color', new THREE.Float32BufferAttribute(wColors, 3));
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
        const _snowColor = new THREE.Color(0xE0F7FA);

        const renderTrees = (positions, trunkGeo, leavesGeo, trunkMat, baseLeafColor) => {
            if (positions.length === 0) return;
            const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, positions.length);
            // Use white base material — instance colors will define the actual leaf color
            const leavesInst = new THREE.InstancedMesh(leavesGeo, treeLeavesBaseMat, positions.length);

            positions.forEach((pos, index) => {
                const worldZ = worldOffsetZ + pos.z;
                // northInfluence reaches 1.0 at worldZ = -4000; frost starts around -1800
                const northInfluence = Math.max(0, -worldZ / 4000);

                const tempNoise = simplex.noise2D((worldOffsetX + pos.x) * 0.0001, worldZ * 0.0001);
                // Threshold 0.78 means frost only appears deep in the snowy biome (worldZ < -3100 approx)
                const snowRaw = Math.max(0, Math.min(1, (northInfluence + tempNoise * 0.05 - 0.78) * 3.5));
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
        renderTrees(treePositions, treeTrunkGeo, treeLeavesGeo, treeTrunkMat, 0x1B5E20);
        renderTrees(snowTreePositions, treeTrunkGeo, treeLeavesGeo, treeTrunkMat, 0x1B5E20);
        renderTrees(deciduousTreePositions, deciduousGeos.trunk, deciduousGeos.leaves, treeTrunkMat, 0x1B5E20);
        renderTrees(palmTreePositions, palmGeos.trunk, palmGeos.leaves, treeTrunkMat, 0x689F38);
        renderTrees(cherryTreePositions, deciduousGeos.trunk, deciduousGeos.leaves, treeTrunkMat, 0xF8BBD0);
        renderTrees(autumnTree1Positions, deciduousGeos.trunk, deciduousGeos.leaves, treeTrunkMat, 0xD35400);
        renderTrees(autumnTree2Positions, deciduousGeos.trunk, deciduousGeos.leaves, treeTrunkMat, 0xF39C12);
        renderTrees(autumnTree3Positions, deciduousGeos.trunk, deciduousGeos.leaves, treeTrunkMat, 0xC0392B);

        if (deadTreePositions.length > 0) {
            const deadInst = new THREE.InstancedMesh(deadTreeGeo, deadTreeMat, deadTreePositions.length);
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
            { pos: rockPositions, mat: rockMat },
            { pos: snowRockPositions, mat: snowRockMat },
            { pos: desertRockPositions, mat: desertRockMat }
        ];

        rockVariations.forEach(variation => {
            if (variation.pos.length > 0) {
                const rockInst = new THREE.InstancedMesh(rockGeo, variation.mat, variation.pos.length);

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
            const cactusInst = new THREE.InstancedMesh(cactusGeo, cactusMat, cactusPositions.length);
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
            const bodyInst = new THREE.InstancedMesh(snowmanGeos.body, snowmanBodyMat, snowmanPositions.length);
            const noseInst = new THREE.InstancedMesh(snowmanGeos.nose, snowmanNoseMat, snowmanPositions.length);

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
            const padInst = new THREE.InstancedMesh(lilyPadGeo, lilyPadMat, lilyPadPositions.length);

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
            const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushPositions.length);
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
                houseCombo[idx] = { bodyId, roofId, key };
                comboCounts[key] = (comboCounts[key] || 0) + 1;
            });

            // Build one InstancedMesh pair per combo that actually appears
            const bodyInsts = {};
            const roofInsts = {};
            const comboIndices = {};
            for (const key of Object.keys(comboCounts)) {
                const [bodyId, roofId] = key.split('_').map(Number);
                bodyInsts[key] = new THREE.InstancedMesh(houseBodyGeo, houseBodyPalette[bodyId], comboCounts[key]);
                roofInsts[key] = new THREE.InstancedMesh(houseRoofGeo, houseRoofPalette[roofId], comboCounts[key]);
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
                    windowPools[i] = new THREE.InstancedMesh(houseWindowGeo, houseWindowMats[i], poolCounts[i] * 2);
                    windowPools[i].position.set(worldOffsetX, 0, worldOffsetZ);
                    objectsGroup.add(windowPools[i]);
                }
            }

            const poolIndices = [0, 0, 0, 0, 0];

            housePositions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();

                const { key } = houseCombo[index];
                const ci = comboIndices[key];
                bodyInsts[key].setMatrixAt(ci, dummy.matrix);
                roofInsts[key].setMatrixAt(ci, dummy.matrix);
                comboIndices[key]++;

                const poolId = houseToPool[index];
                const pIdx = poolIndices[poolId];

                const frontOffset = new THREE.Vector3(0, 4, 5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);
                const backOffset = new THREE.Vector3(0, 4, -5.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);

                dummy.position.set(pos.x + frontOffset.x, pos.y + frontOffset.y, pos.z + frontOffset.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.updateMatrix();
                windowPools[poolId].setMatrixAt(pIdx * 2, dummy.matrix);

                dummy.position.set(pos.x + backOffset.x, pos.y + backOffset.y, pos.z + backOffset.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.updateMatrix();
                windowPools[poolId].setMatrixAt(pIdx * 2 + 1, dummy.matrix);

                poolIndices[poolId]++;
            });
        }

        // 2.6 Generate Pagodas (rare, cherry blossom zones)
        if (pagodaPositions.length > 0) {
            const pagodaBodyInst = new THREE.InstancedMesh(pagodaBodyGeo, pagodaBodyMat, pagodaPositions.length);
            const pagodaRoofInst = new THREE.InstancedMesh(pagodaRoofGeo, pagodaRoofMat, pagodaPositions.length);
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
            barnPositions.forEach((pos, i) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                barnBodyInst.setMatrixAt(i, dummy.matrix);
                barnRoofInst.setMatrixAt(i, dummy.matrix);
            });
            barnBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
            barnRoofInst.position.set(worldOffsetX, 0, worldOffsetZ);
            objectsGroup.add(barnBodyInst);
            objectsGroup.add(barnRoofInst);
        }

        // 2.62 Generate Monasteries (rare, temperate highlands)
        if (monasteryPositions.length > 0) {
            const monasteryBodyInst = new THREE.InstancedMesh(monasteryBodyGeo, monasteryBodyMat, monasteryPositions.length);
            const monasteryCapInst = new THREE.InstancedMesh(monasteryCapGeo, monasteryCapMat, monasteryPositions.length);
            monasteryPositions.forEach((pos, i) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                monasteryBodyInst.setMatrixAt(i, dummy.matrix);
                monasteryCapInst.setMatrixAt(i, dummy.matrix);
            });
            monasteryBodyInst.position.set(worldOffsetX, 0, worldOffsetZ);
            monasteryCapInst.position.set(worldOffsetX, 0, worldOffsetZ);
            objectsGroup.add(monasteryBodyInst);
            objectsGroup.add(monasteryCapInst);
        }

        // 2.63 Generate Castle Ruins (very rare, elevated terrain)
        if (castleRuinsPositions.length > 0) {
            const castleInst = new THREE.InstancedMesh(castleRuinsGeo, castleRuinsMat, castleRuinsPositions.length);
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
            const baseInst = new THREE.InstancedMesh(windmillBaseGeo, windmillBaseMat, windmillPositions.length);
            const bladesInst = new THREE.InstancedMesh(windmillBladesGeo, windmillBladesMat, windmillPositions.length * 4);

            windmillPositions.forEach((pos, index) => {
                // Base
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.scale.set(1.5, 1.5, 1.5);
                dummy.updateMatrix();
                baseInst.setMatrixAt(index, dummy.matrix);

                // Blades (initial state, will be updated in animate)
                for (let b = 0; b < 4; b++) {
                    const bladeIdx = index * 4 + b;
                    dummy.position.set(pos.x, pos.y + 45, pos.z);
                    const hubOffset = new THREE.Vector3(0, 0, 8.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);
                    dummy.position.add(hubOffset);
                    dummy.rotation.set(0, pos.rotY, (b * Math.PI / 2));
                    dummy.scale.set(1.5, 1.5, 1.5);
                    dummy.updateMatrix();
                    bladesInst.setMatrixAt(bladeIdx, dummy.matrix);
                }
            });

            baseInst.position.set(worldOffsetX, 0, worldOffsetZ);
            bladesInst.position.set(worldOffsetX, 0, worldOffsetZ);
            objectsGroup.add(baseInst);
            objectsGroup.add(bladesInst);
        }

        // 2.9 Generate Lighthouses
        if (lighthousePos) {
            const piece1Inst = new THREE.InstancedMesh(lighthousePieceGeo, lighthouseRedMat, 1);
            const piece2Inst = new THREE.InstancedMesh(lighthousePieceGeo, lighthouseWhiteMat, 1);
            const piece3Inst = new THREE.InstancedMesh(lighthousePieceGeo, lighthouseRedMat, 1);
            const topInst = new THREE.InstancedMesh(lighthouseTopGeo, lighthouseWhiteMat, 1);

            const pos = lighthousePos;
            dummy.position.set(pos.x, pos.y + 10, pos.z);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            piece1Inst.setMatrixAt(0, dummy.matrix);

            dummy.position.set(pos.x, pos.y + 30, pos.z);
            dummy.updateMatrix();
            piece2Inst.setMatrixAt(0, dummy.matrix);

            dummy.position.set(pos.x, pos.y + 50, pos.z);
            dummy.updateMatrix();
            piece3Inst.setMatrixAt(0, dummy.matrix);

            dummy.position.set(pos.x, pos.y, pos.z);
            dummy.rotation.set(0, pos.rotY, 0);
            dummy.updateMatrix();
            topInst.setMatrixAt(0, dummy.matrix);

            const pieces = [piece1Inst, piece2Inst, piece3Inst, topInst];
            pieces.forEach(p => {
                p.position.set(worldOffsetX, 0, worldOffsetZ);
                objectsGroup.add(p);
            });

            // Beam
            const beam = new THREE.Mesh(lighthouseBeamGeo, lighthouseBeamMat);
            beam.position.set(pos.x + worldOffsetX, pos.y + 65, pos.z + worldOffsetZ);
            beam.rotation.y = pos.rotY;
            beam.rotation.x = 0.15; // Tilt slightly downward community
            objectsGroup.add(beam);
            group.userData.lighthouseBeam = beam;

            // Functional Light (SpotLight)
            const spotLight = new THREE.SpotLight(0xFFFFaa, 25, 1500, Math.PI / 6, 0.8, 1);
            spotLight.position.set(pos.x + worldOffsetX, pos.y + 65, pos.z + worldOffsetZ);
            // Initial target position matching beam rotation and tilted down community
            spotLight.target.position.set(
                pos.x + worldOffsetX + Math.sin(pos.rotY) * 100,
                pos.y + 65 - 15, // Aim lower community
                pos.z + worldOffsetZ + Math.cos(pos.rotY) * 100
            );
            objectsGroup.add(spotLight);
            objectsGroup.add(spotLight.target);
            group.userData.lighthouseLight = spotLight;
            group.userData.lighthouseTarget = spotLight.target;
        }

        // 2.95 Generate Piers
        if (pierPositions.length > 0) {
            const deckInst = new THREE.InstancedMesh(pierDeckGeo, woodMat, pierPositions.length);
            const postInst = new THREE.InstancedMesh(pierPostGeo, woodMat, pierPositions.length * 4);

            pierPositions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y - 1, pos.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.updateMatrix();
                deckInst.setMatrixAt(index, dummy.matrix);

                // Posts
                const offsets = [[-6, 10], [6, 10], [-6, 25], [6, 25]];
                offsets.forEach((off, i) => {
                    const p = new THREE.Vector3(off[0], -5, off[1]).applyAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotY);
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
            const logInst = new THREE.InstancedMesh(fireLogGeo, woodMat, campfirePositions.length * 3);
            const coreInst = new THREE.InstancedMesh(fireCoreGeo, fireMat, campfirePositions.length);
            const smokeInst = new THREE.InstancedMesh(smokeGeo, smokeMat, campfirePositions.length * 5); // 5 particles per fire community
            const tentInst = new THREE.InstancedMesh(tentGeo, tentMat, campfirePositions.length);

            campfirePositions.forEach((pos, index) => {
                // Logs in a tripod/teepee shape
                for (let i = 0; i < 3; i++) {
                    dummy.position.set(pos.x, pos.y + 1, pos.z);
                    dummy.rotation.set(0.5, (i * Math.PI * 2 / 3), 0);
                    dummy.updateMatrix();
                    logInst.setMatrixAt(index * 3 + i, dummy.matrix);
                }
                // Fire core
                dummy.position.set(pos.x, pos.y + 2, pos.z);
                dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                coreInst.setMatrixAt(index, dummy.matrix);

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
                const tentY = getCachedElevation(worldOffsetX + tentX, worldOffsetZ + tentZ);

                dummy.position.set(tentX, tentY, tentZ);
                dummy.rotation.set(0, angle, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                tentInst.setMatrixAt(index, dummy.matrix);
            });

            logInst.position.set(worldOffsetX, 0, worldOffsetZ);
            coreInst.position.set(worldOffsetX, 0, worldOffsetZ);
            smokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
            tentInst.position.set(worldOffsetX, 0, worldOffsetZ);
            objectsGroup.add(logInst);
            objectsGroup.add(coreInst);
            objectsGroup.add(smokeInst);
            objectsGroup.add(tentInst);

            group.userData.campfires = coreInst;
            group.userData.campfireSmoke = smokeInst;
        }

        // 2.97 Generate Chimney Smoke
        if (chimneySmokePositions.length > 0) {
            const chimneySmokeInst = new THREE.InstancedMesh(smokeGeo, whiteSmokeMat, chimneySmokePositions.length * 4);

            chimneySmokePositions.forEach((pos, index) => {
                for (let i = 0; i < 4; i++) {
                    dummy.position.set(pos.x, pos.y, pos.z);
                    dummy.scale.set(1, 1, 1);
                    dummy.rotation.set(0, 0, 0);
                    dummy.updateMatrix();
                    const smokeIdx = index * 4 + i;
                    chimneySmokeInst.setMatrixAt(smokeIdx, dummy.matrix);

                    const phase = ((pos.x + pos.z) % 10.0) / 10.0;
                    chimneySmokeInst.setColorAt(smokeIdx, new THREE.Color(i / 10.0, phase, 0));
                }
            });

            chimneySmokeInst.position.set(worldOffsetX, 0, worldOffsetZ);
            objectsGroup.add(chimneySmokeInst);

            group.userData.chimneySmoke = chimneySmokeInst;
        }

        // 2.98 Generate Sailboats
        if (sailboatPositions.length > 0) {
            const hullInst = new THREE.InstancedMesh(boatHullGeo, boatHullMat, sailboatPositions.length);
            const mastInst = new THREE.InstancedMesh(boatMastGeo, woodMat, sailboatPositions.length);
            const sailInst = new THREE.InstancedMesh(boatSailGeo, boatSailMat, sailboatPositions.length);

            sailboatPositions.forEach((pos, index) => {
                dummy.position.set(pos.x, pos.y, pos.z);
                dummy.rotation.set(0, pos.rotY, 0);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                hullInst.setMatrixAt(index, dummy.matrix);
                mastInst.setMatrixAt(index, dummy.matrix);
                sailInst.setMatrixAt(index, dummy.matrix);
            });

            hullInst.position.set(worldOffsetX, 0, worldOffsetZ);
            mastInst.position.set(worldOffsetX, 0, worldOffsetZ);
            sailInst.position.set(worldOffsetX, 0, worldOffsetZ);
            objectsGroup.add(hullInst);
            objectsGroup.add(mastInst);
            objectsGroup.add(sailInst);
        }

        // 3. Generate Clouds
        let cloudiness = (simplex.noise2D(chunkX * 0.1 + 500, chunkZ * 0.1) + 1) / 2;
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

        // 3. Generate Clouds (Optimized InstancedMesh)
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
                    rotY: rng() * Math.PI
                });
            }
        }

        if (cloudData.length > 0) {
            const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudData.length);
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
        if (!isCustom && rng() < 0.20) {
            const baseX = worldOffsetX + (rng() - 0.5) * CHUNK_SIZE;
            const baseZ = worldOffsetZ + (rng() - 0.5) * CHUNK_SIZE;
            let baseY = getCachedElevation(baseX, baseZ) + 150 + rng() * 200;
            if (baseY > 400) baseY = 400;

            const baseRotationY = rng() * Math.PI * 2;

            function assembleBird(mat, scale) {
                const bird = new THREE.Group();
                const body = new THREE.Mesh(birdBodyGeo, mat);
                const head = new THREE.Mesh(birdHeadGeo, mat);
                const wingL = new THREE.Mesh(birdWingGeo, mat);
                const wingR = new THREE.Mesh(birdWingGeo, mat);
                wingL.rotation.y = Math.PI;
                bird.add(body); bird.add(head); bird.add(wingL); bird.add(wingR);
                bird.scale.set(scale, scale, scale);
                bird.userData.wings = [wingL, wingR];
                return bird;
            }

            const hawk = assembleBird(hawkMat, 4.0);
            hawk.position.set(baseX, baseY, baseZ);
            hawk.rotation.y = baseRotationY;

            hawk.userData.type = 'hawk';
            hawk.userData.speed = 0.4;
            hawk.userData.circleSpeed = 0.3 + rng() * 0.2;
            hawk.userData.circleRadius = 150 + rng() * 100;
            hawk.userData.circleCenter = new THREE.Vector3(baseX, baseY, baseZ);
            hawk.userData.angle = rng() * Math.PI * 2;
            hawk.userData.flapPhase = 0;
            hawk.userData.flapSpeed = 2;

            objectsGroup.add(hawk);
            group.userData.birds.push(hawk);
        }

        group.traverse(child => {
            if (child.isMesh || child.isInstancedMesh) {
                if (child.material !== waterMaterial && child.material !== cloudMat && child.material !== smokeMat && child.material !== lighthouseBeamMat) {
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
            trees_autumn: autumnTree1Positions.length + autumnTree2Positions.length + autumnTree3Positions.length,
            trees_cherry: cherryTreePositions.length,
            houses: housePositions.length + pagodaPositions.length + barnPositions.length + monasteryPositions.length + castleRuinsPositions.length,
            clouds: numClouds,
            rocks: rockPositions.length + snowRockPositions.length + desertRockPositions.length,
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
            chimneys: chimneySmokePositions.length
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
        if (Math.abs(cx - currentChunkX) > renderDistance + 1 ||
            Math.abs(cz - currentChunkZ) > renderDistance + 1) {
            group.traverse(child => {
                if (child.isMesh || child.isInstancedMesh) {
                    if (child.geometry && child.geometry.userData.unique) {
                        child.geometry.dispose();
                    }
                }
            });
            scene.remove(group);
            chunks.delete(key);
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
    chunks.forEach(group => {
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
