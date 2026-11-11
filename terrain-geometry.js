// --- PROCEDURAL TERRAIN & CHUNKS ---
// chunkQueue and _enableObjects live in state.js (terrain-chunks.js writes them).
import * as THREE from 'three';
import {mergeGeometries as mergeBufferGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  HOUSE_BODY_COLORS,
  HOUSE_ROOF_COLORS,
  HOUSE_WINDOW_POOLS,
  WIND_DIR_X,
  WIND_DIR_Z,
  WINDMILL_ROT_Y,
} from './terrain-gen.js';
import {ART_PAINTED, ART_POST} from './art-style.js';
import * as polyforkLighthouse from './third-party/polyfork/old-lighthouse-48ca6c.mjs';
import * as polyforkCottage from './third-party/polyfork/porch-front-cottage-620c29.mjs';
import {createAsset as createPolyforkDolphin} from './third-party/polyfork/dolphin-base.mjs';
import {
  buildChapelGeos,
  buildPierGeo,
  buildTentGeos,
  buildingMat,
} from './building-models.js';
import {
  PIRATE_SHIP_LOOKS,
  buildPirateShipGeos,
  foamRing,
  withFoam,
} from './boat-models.js';
import {
  buildBarnGeos,
  buildSiloGeos,
  buildWindmillGeos,
} from './farm-models.js';
import {
  buildAppleTreeGeos,
  buildBirchGeos,
  buildBroadleafOakGeos,
  buildCherryBlossomGeos,
  buildDeadCottonwoodGeo,
  buildFruitTreeGeos,
  buildJapaneseMapleGeos,
  buildMagnoliaGeos,
  buildMountainRowanGeos,
  buildOakGeos,
  buildOrchardAppleGeos,
  buildPalmGeos,
  buildPlumTreeGeos,
  buildSculptedPineGeos,
  buildSnowSpruceGeos,
  buildStumpGeo,
  buildTwistedDeadOakGeo,
  paintGeometry,
} from './tree-models.js';
import {
  CHUNK_SIZE,
  CLOUD_GLSL,
  moonlightUniforms,
  LIGHTHOUSE_BEAM_OPACITY_MAX,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  MOUNTAIN_LEVEL,
  FAR_SEA_GLSL,
  FOG_SKY_FRAGMENT_GLSL,
  FOG_SKY_VERTEX_GLSL,
  SKY_COLOR_GLSL,
  WATER_LEVEL,
  addHeadlightPool,
  addRoadSnow,
  createMaterial,
  terrainUniforms,
} from './constants.js';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {log} from './logger.js';
import {simplex} from './noise.js';
import {state} from './state.js';

export var yAxis = new THREE.Vector3(0, 1, 0);

export var chunks = new Map();
// Registry of active terrain chunks that contain animated watercraft (sailboats, pirate ships).
// Allows animate() in game.js to skip iterating dozens of dry land chunks every frame.
export var watercraftChunks = new Set();
export var birdChunks = new Set();
// Loaded chunks with a headland lighthouse (its beam to sweep)
export var headlandLighthouseChunks = new Set();
// Geese that have outlived their chunk: a flock flies far from where it
// spawned, so when its chunk unloads it moves here and keeps flying until
// it's too far away to see (terrain-chunks.js, flight-camera.js)
export var strayBirds = new THREE.Group();
strayBirds.userData.birds = [];
export var _terrainGeometryPool = [];
export var _waterGeometryPool = [];

var _instancedMeshPool = new Map();

// Shadow depth materials for instanced meshes. By default three.js renders
// every shadow caster with one shared depth material, which then keeps
// switching shader variants between instanced and regular meshes (and
// instanced meshes with and without per-instance colors), re-deriving its
// program ~30 times per frame. One material per variant keeps each stable.
const _instancedDepthMat = new THREE.MeshDepthMaterial();
const _instancedColorDepthMat = new THREE.MeshDepthMaterial();

export function useInstancedDepthMaterial(mesh) {
  let override;
  Object.defineProperty(mesh, 'customDepthMaterial', {
    get() {
      if (override) return override;
      return this.instanceColor ? _instancedColorDepthMat : _instancedDepthMat;
    },
    // A mesh can still set its own (e.g. the windmill blades).
    set(material) {
      override = material;
    },
    configurable: true,
  });
}

export function getInstancedMesh(geometry, material, count) {
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
  useInstancedDepthMaterial(mesh);
  mesh.frustumCulled = false;
  mesh.count = count;
  return mesh;
}

export function releaseInstancedMesh(mesh) {
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

export var chunkQueueSet = new Set();

// The geometry side of clearing the queue; see clearChunkQueue() in
// terrain-chunks.js, which also cancels pending worker jobs.
export function resetChunkQueue() {
  state.chunkQueue = [];
  chunkQueueSet.clear();
}

// GPU water uniform - shared globally so game.js animate() can update uTime
export const waterUniforms = {
  uTime: {value: 0.0},
  // Defaults only; each water chunk's material has its own (terrain-chunks.js)
  uDepthTex: {value: null},
  uDepthGridSize: {value: 31},
  uSpecularDir: {value: new THREE.Vector3(0, 1, 0)},
  uSunColor: {value: new THREE.Color(0xffffff)},
  // 1 when the glitter path is the sun's (gold when it's low), 0 for the moon's
  uGlitterWarm: {value: 1},
  // How whipped up the open sea is, 0 calm to 1 storm: whitecaps on the
  // swell's crests (set from the weather in game-loop.js)
  uWhitecaps: {value: 0},
};

var _initPresetForTerrain =
  ChillFlightLogic.GRAPHICS_PRESET ||
  localStorage.getItem('chill_flight_graphics_preset');
var _legacyQualityForTerrain = localStorage.getItem('chill_flight_quality');
var _isLowQualityInitial =
  _initPresetForTerrain === 'low' ||
  (!_initPresetForTerrain &&
    _legacyQualityForTerrain &&
    parseInt(_legacyQualityForTerrain) <= 20);

// Volcano center - single source of truth for all coloring and landmark placement
export var VOLCANO_X = -5000;
export var VOLCANO_Z = 5000;

// Tall grass (grass.js; off with ?grass=0). Its gusts: bands that roll downwind
// across the land, shared by the grass blades (how far they lean) and the
// terrain (a sheen on green ground where a gust passes, seen from the air).
export const GRASS_ON = !!ChillFlightLogic.GRASS;
export const GRASS_WAVE_GLSL = `
  #define GRASS_WIND_DIR normalize(vec2(${WIND_DIR_X.toFixed(2)}, ${WIND_DIR_Z.toFixed(2)}))
  float grassGust(vec2 p, float time) {
    vec2 wd = GRASS_WIND_DIR;
    float along = dot(p, wd);
    float across = dot(p, vec2(-wd.y, wd.x));
    float w = sin(along * 0.03 - time * 0.75 + sin(across * 0.006) * 2.5 + sin(across * 0.017 + along * 0.004) * 1.2);
    float g = 0.5 + 0.5 * w;
    return g * g * (0.55 + 0.45 * sin(along * 0.0023 + across * 0.0031 - time * 0.11));
  }
`;

// Materials for terrain
export var terrainMaterial = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.8,
});

export var waterMaterial = createMaterial({
  vertexColors: true,
  transparent: !_isLowQualityInitial,
  opacity: _isLowQualityInitial ? 1.0 : 0.85,
  metalness: 0.1,
  // Rough enough that three.js's own sun highlight doesn't draw a hard
  // streak; the water shader adds its own sun glitter path.
  roughness: 0.7,
  flatShading: true,
  depthWrite: false,
});
// The art styles' post pass needs to know where the water is (it leaves its
// glints and swell uninked): see-through water blends its
// color as usual but zeroes the target's alpha, which everything else leaves
// at 1
if (ART_POST) {
  waterMaterial.blending = THREE.CustomBlending;
  waterMaterial.blendSrc = THREE.SrcAlphaFactor;
  waterMaterial.blendDst = THREE.OneMinusSrcAlphaFactor;
  waterMaterial.blendSrcAlpha = THREE.ZeroFactor;
  waterMaterial.blendDstAlpha = THREE.ZeroFactor;
}

terrainMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uCameraPosXZ = terrainUniforms.uCameraPosXZ;
  shader.uniforms.uRenderRadius = terrainUniforms.uRenderRadius;
  shader.uniforms.uNearEdgeFade = terrainUniforms.uNearEdgeFade;
  shader.uniforms.uSunDirection = terrainUniforms.uSunDirection;
  shader.uniforms.uTopColor = terrainUniforms.uTopColor;
  shader.uniforms.uBottomColor = terrainUniforms.uBottomColor;
  shader.uniforms.uSnowExposure = terrainUniforms.uSnowExposure;
  shader.uniforms.uOzone = terrainUniforms.uOzone;

  shader.vertexShader =
    `
    uniform vec2 uCameraPosXZ;
    uniform float uRenderRadius;
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uNearEdgeFade;
    attribute float morphY;
    varying float vDistanceXZ;
    varying vec3 vWorldPosition;
  ` +
    SKY_COLOR_GLSL +
    FOG_SKY_VERTEX_GLSL +
    shader.vertexShader;

  // Toward the draw distance, ease the ground onto the distant terrain
  // ring's coarser shape (morphY, see terrain-gen.js), so where the ring
  // takes over nothing jumps, and flying closer grows the detail in
  // gradually instead of popping it in a chunk at a time (#81). Only while
  // the ring is there to continue the land (uNearEdgeFade 0).
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    `#include <begin_vertex>
     float morphDist = length((modelMatrix * vec4(transformed, 1.0)).xz - uCameraPosXZ);
     float morph = smoothstep(uRenderRadius * 0.55, uRenderRadius * 0.9, morphDist) * (1.0 - uNearEdgeFade);
     transformed.y = mix(transformed.y, morphY, morph);`
  );

  shader.vertexShader = shader.vertexShader.replace(
    `#include <worldpos_vertex>`,
    `#include <worldpos_vertex>
     vec4 customWorldPosition = modelMatrix * vec4( transformed, 1.0 );
     vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);
     vWorldPosition = customWorldPosition.xyz;
     #ifdef USE_FOG
       fogSkyVertex(vWorldPosition);
     #endif`
  );

  if (GRASS_ON) {
    shader.uniforms.uTime = animationUniforms.uTime;
    shader.fragmentShader =
      `#define GRASS_SHEEN
      uniform float uTime;
      ${GRASS_WAVE_GLSL}
    ` + shader.fragmentShader;
  }

  shader.fragmentShader =
    `
    uniform float uRenderRadius;
    uniform float uNearEdgeFade;
    varying float vDistanceXZ;
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform vec3 uSnowExposure;
    varying vec3 vWorldPosition;
  ` +
    SKY_COLOR_GLSL +
    FOG_SKY_FRAGMENT_GLSL +
    shader.fragmentShader;

  // Near-white terrain (snow, ice) is dimmed in bright light so its shading
  // stays visible instead of clipping to flat white (#74).
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <color_fragment>`,
    `#include <color_fragment>
     float snowWhiteness = smoothstep(0.55, 0.85, min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)));
     diffuseColor.rgb *= mix(vec3(1.0), uSnowExposure, snowWhiteness);
     #ifdef GRASS_SHEEN
     {
       // Grass (green) and wheat fields (yellow, as in grass.js)
       vec3 sc = diffuseColor.rgb;
       float sheenRatio = sc.g / max(sc.r, 1e-3);
       float sheenGreen = max(
         smoothstep(0.015, 0.06, sc.g - max(sc.r, sc.b)),
         smoothstep(0.22, 0.32, min(sc.r, sc.g) - sc.b) * smoothstep(0.75, 0.82, sheenRatio) * smoothstep(1.16, 1.1, sheenRatio));
       float sheenFade = 1.0 - smoothstep(2500.0, 6000.0, vDistanceXZ);
       diffuseColor.rgb *= 1.0 + 0.12 * grassGust(vWorldPosition.xz, uTime) * sheenGreen * sheenFade;
     }
     #endif
     #ifdef ANIME_TERRAIN
       animeTerrainColor(diffuseColor.rgb);
     #endif`
  );

  // Anime style: painterly variation in the greens
  if (ART_PAINTED) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `#define ANIME_TERRAIN
      float animeHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float animeNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(animeHash(i), animeHash(i + vec2(1.0, 0.0)), f.x),
                   mix(animeHash(i + vec2(0.0, 1.0)), animeHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      // Greens drift between warm yellow-green and cool blue-green in broad
      // washes, with smaller lighter and darker patches like uneven paint.
      // Only vegetation (green-dominant colors) changes, and the variation
      // fades out with distance before the distant terrain ring.
      void animeTerrainColor(inout vec3 c) {
        vec2 wp = vWorldPosition.xz;
        float fade = 1.0 - smoothstep(3000.0, 7000.0, vDistanceXZ);
        float green = smoothstep(0.02, 0.1, c.g - max(c.r, c.b)) * fade;
        float wash = animeNoise(wp / 900.0) * 0.65 + animeNoise(wp / 330.0 + 7.3) * 0.35;
        vec3 warm = c * vec3(1.2, 1.1, 0.68);
        vec3 cool = c * vec3(0.8, 0.97, 1.15);
        c = mix(c, mix(cool, warm, smoothstep(0.25, 0.75, wash)), green * 0.85);
        c *= mix(1.0, mix(0.88, 1.1, animeNoise(wp / 180.0 + 31.7)), green);
      }
      void main() {`
    );
    // Rock planes: the facets' own directions shade bare rock on top of the
    // smooth stepped lighting, continuously, so ridges and gullies read in
    // sun and in shade alike (smooth shading alone made mountains blobs);
    // sunlit rock a touch warm, shaded rock a touch cool
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        vec3 faceN = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
        if (faceN.y < 0.0) faceN = -faceN;
        // Bare rock only: steep, and neither vegetation (green-dominant)
        // nor snow (near-white)
        vec3 albedo = diffuseColor.rgb;
        float green = smoothstep(0.02, 0.1, albedo.g - max(albedo.r, albedo.b));
        float white = smoothstep(0.55, 0.8, min(albedo.r, min(albedo.g, albedo.b)));
        float rock = (1.0 - smoothstep(0.72, 0.86, faceN.y)) * (1.0 - green) * (1.0 - white);
        float sunFace = dot(faceN, uSunDirection);
        float lit = 0.72 + 0.4 * smoothstep(-0.3, 0.7, sunFace);
        float sky = 0.7 + 0.45 * smoothstep(-0.2, 0.8, faceN.y * 0.6 + sunFace * 0.4);
        reflectedLight.directDiffuse *= mix(vec3(1.0), vec3(1.1, 1.02, 0.88) * lit, rock);
        reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(0.92, 0.94, 1.1) * sky, rock);
      }`
    );
  }

  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `
     #ifdef USE_FOG
       vec3 fogSkyColor = fogSkyColorAt(vWorldPosition);
       
       #ifdef FOG_EXP2
           float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
       #else
           float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
       #endif
       
       float distRatio = vDistanceXZ / uRenderRadius;
       float xzFogFactor = smoothstep(0.9, 0.99, distRatio) * uNearEdgeFade;
       
       float finalFogFactor = max(fogFactor, xzFogFactor);
       
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
     #endif
    `
  );
};

addHeadlightPool(terrainMaterial);

// The water's swell (GLSL), shared with the foam in particles.js so it
// rides the same waves
export const WATER_SWELL_GLSL = `
  // Swell: three waves in different directions with wavelengths that
  // don't line up, so the surface doesn't read as regular stripes.
  // Returns (height, dh/dx, dh/dz), scaled by a slow large-scale
  // variation so different stretches of water differ.
  vec3 swell(vec2 p, float t) {
    float amp = 0.8 + sin(p.x * 0.0002) * cos(p.y * 0.00025) * 0.4;
    vec3 h = vec3(0.0);
    // direction (normalized), wavenumber, speed, amplitude
    vec2 d1 = vec2(0.944, 0.33);  float k1 = 0.018; float a1 = 0.8;
    vec2 d2 = vec2(-0.371, 0.928); float k2 = 0.013; float a2 = 0.6;
    vec2 d3 = vec2(0.664, -0.747); float k3 = 0.031; float a3 = 0.35;
    float p1 = dot(p, d1) * k1 + t;
    float p2 = dot(p, d2) * k2 + t * 0.8;
    float p3 = dot(p, d3) * k3 + t * 1.3;
    h.x = a1 * sin(p1) + a2 * sin(p2) + a3 * sin(p3);
    vec2 grad = a1 * k1 * cos(p1) * d1 + a2 * k2 * cos(p2) * d2 + a3 * k3 * cos(p3) * d3;
    h.yz = grad;
    return h * amp;
  }
`;

// Inject GPU wave math into the water material's vertex shader.
// This replaces the CPU-side per-vertex loop and computeVertexNormals().
waterMaterial.userData.isWater = true;
// A regular function: `this` is the material being compiled. Each water chunk
// has its own clone carrying its depth texture (see attachWaterDepthTexture).
waterMaterial.onBeforeCompile = function (shader) {
  shader.uniforms.uTime = waterUniforms.uTime;
  // The sky's cloud layers, reflected on the water
  shader.uniforms.uNoiseTex = skyUniforms.uNoiseTex;
  shader.uniforms.uSkyTime = skyUniforms.uTime;
  shader.uniforms.uCloudDensity = skyUniforms.uCloudDensity;
  shader.uniforms.uCloudHeight = skyUniforms.uCloudHeight;
  shader.uniforms.uShowClouds = skyUniforms.uShowClouds;
  shader.uniforms.uCloudTypes = skyUniforms.uCloudTypes;
  shader.uniforms.uCloudCover = skyUniforms.uCloudCover;
  shader.uniforms.uSnowDeck = skyUniforms.uSnowDeck;
  shader.uniforms.uMoonDir = moonlightUniforms.uMoonDir;
  shader.uniforms.uMoonBright = moonlightUniforms.uMoonBright;
  shader.uniforms.uGlitterWarm = waterUniforms.uGlitterWarm;
  shader.uniforms.uWhitecaps = waterUniforms.uWhitecaps;
  const depth = this.userData.depthUniforms || waterUniforms;
  shader.uniforms.uDepthTex = depth.uDepthTex;
  shader.uniforms.uDepthGridSize = depth.uDepthGridSize;
  shader.uniforms.uCameraPosXZ = terrainUniforms.uCameraPosXZ;
  shader.uniforms.uRenderRadius = terrainUniforms.uRenderRadius;
  shader.uniforms.uNearEdgeFade = terrainUniforms.uNearEdgeFade;

  shader.uniforms.uSunDirection = terrainUniforms.uSunDirection;
  shader.uniforms.uSpecularDir = waterUniforms.uSpecularDir;
  shader.uniforms.uSunColor = waterUniforms.uSunColor;
  shader.uniforms.uTopColor = terrainUniforms.uTopColor;
  shader.uniforms.uBottomColor = terrainUniforms.uBottomColor;
  shader.uniforms.uOzone = terrainUniforms.uOzone;

  // Add time uniform declaration to the top of the vertex shader
  shader.vertexShader =
    `
        uniform float uDepthGridSize;
        uniform sampler2D uDepthTex;
        varying vec2 vDepthUV;
        uniform vec2 uCameraPosXZ;
        uniform float uRenderRadius;
        varying float vDistanceXZ;
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
        // Which way a river runs here, scaled by how much it's in the
        // channel (getRiverFlow; zero on the sea and lakes), then how swampy
        // the water is, 0 to 1 (terrain-gen.js)
        attribute vec3 flow;
        varying vec2 vFlow;
        varying float vSwamp;

        ${WATER_SWELL_GLSL}
    ` +
    SKY_COLOR_GLSL +
    FOG_SKY_VERTEX_GLSL +
    shader.vertexShader;

  // Inject analytical normal calculation (replaces computeVertexNormals)
  shader.vertexShader = shader.vertexShader.replace(
    `#include <beginnormal_vertex>`,
    `
        // Get world position for seamless tiling across chunks
        vec4 worldPosN = modelMatrix * vec4(position, 1.0);

        // Texel centers of the chunk's height grid (vertices span the chunk)
        vec2 gridT = position.xz / ${CHUNK_SIZE.toFixed(1)} + 0.5;
        vDepthUV = (gridT * (uDepthGridSize - 1.0) + 0.5) / uDepthGridSize;
        // Calm the swell in shallow water, so it doesn't rise above low-lying
        // land in thin slivers along the shore.
        float swellCalm = smoothstep(1.0, 6.0, texture2D(uDepthTex, vDepthUV).g * 40.0 - 30.0);

        // Analytical normal from the swell's slope, for correct lighting
        vec3 swellN = swell(worldPosN.xz, uTime) * swellCalm;
        vec3 objectNormal = normalize(vec3(-swellN.y, 1.0, -swellN.z));
        vSmoothNormal = normalize(mat3(modelMatrix) * objectNormal);
        `
  );

  // Inject wave height displacement (replaces the CPU position array modification)
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    `
        vec3 transformed = vec3(position);
        // (Same vertex as the normal above: reuse its swell)
        transformed.y += swellN.x;
        vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vDistanceXZ = length(vWorldPosition.xz - uCameraPosXZ);
        vFlow = flow.xy;
        vSwamp = flow.z;
        #ifdef USE_FOG
          fogSkyVertex(vWorldPosition);
        #endif
        `
  );

  shader.fragmentShader =
    `
        varying vec2 vDepthUV;
        varying vec2 vFlow;
        varying float vSwamp;
        uniform sampler2D uDepthTex;
        uniform float uTime;
        uniform vec3 uSunDirection;
        uniform vec3 uSpecularDir;
        uniform vec3 uSunColor;
        uniform float uGlitterWarm;
        uniform float uWhitecaps;
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec3 vWorldPosition;
        varying vec3 vSmoothNormal;
        uniform float uRenderRadius;
        uniform float uNearEdgeFade;
        varying float vDistanceXZ;
        uniform float uSkyTime;
        uniform float uCloudDensity;
        uniform float uCloudHeight;
        uniform bool uShowClouds;
    ` +
    SKY_COLOR_GLSL +
    FAR_SEA_GLSL +
    FOG_SKY_FRAGMENT_GLSL +
    CLOUD_GLSL +
    `
        // Glints: finer, faster ripples that break the sun's path into
        // bright sparkles near the camera
        float waterGlint(vec2 p, float gt, vec3 n, vec3 halfVector) {
          vec2 gp = p * 0.45;
          vec3 glintNormal = normalize(n + vec3(
            sin(dot(gp, vec2(0.7, 0.7)) + gt) + sin(dot(gp, vec2(-0.9, 0.3)) + gt * 1.7),
            0.0,
            sin(dot(gp, vec2(0.2, -0.95)) + gt * 1.3) + sin(dot(gp, vec2(0.6, -0.5)) + gt * 0.9)
          ) * 0.06);
          return pow(max(dot(glintNormal, halfVector), 0.0), 900.0);
        }
        // Flecks of foam on a river, drawn out into short streaks along the
        // current (dir) by sampling the noise a few times upstream
        float flowFlecks(vec2 p, vec2 dir) {
          float s = 0.0;
          for (int i = 0; i < 6; i++) {
            s += noise((p - dir * float(i) * 1.6) * 0.22);
          }
          return smoothstep(0.68, 0.8, s / 6.0);
        }
    ` +
    shader.fragmentShader;

  // Inject sky reflection, depth color, the sun's glitter path and foam.
  // Runs before the fog (the fog_fragment marker is kept for the fog
  // injection below), so distant water fades into the haze like the land.
  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        // Depth below the surface, per pixel from the terrain height grid:
        // exact (foam) and softened over ~200 units (color, transparency).
        vec2 depthSample = texture2D(uDepthTex, vDepthUV).rg * 40.0 - 30.0;
        float vWaterDepth = depthSample.x;
        float softDepth = depthSample.y;

        // Fade opacity near shore based on water depth
        float depthOpacity = smoothstep(0.0, 4.0, softDepth);
        gl_FragColor.a *= depthOpacity;
        // Keep water visibly tinted right up to the true waterline (where
        // the foam is), so the shallows don't vanish and leave the foam line
        // floating on what looks like dry sand.
        gl_FragColor.a = max(gl_FragColor.a, smoothstep(0.05, 1.2, vWaterDepth) * 0.45);

        // Deep water (open ocean is ~10 units deep) is opaque and deeper blue;
        // the shallows stay clear turquoise.
        float deep = smoothstep(2.0, 9.0, softDepth);
        float shallow = smoothstep(0.3, 1.5, softDepth) * (1.0 - deep);
        vec3 waterLit = gl_FragColor.rgb;
        gl_FragColor.rgb = mix(waterLit, waterLit * vec3(0.24, 0.46, 0.82), deep * 0.7);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, waterLit * vec3(0.55, 1.05, 0.9), shallow * 0.6);
        gl_FragColor.a = mix(gl_FragColor.a, 1.0, deep * 0.9);
        // Swamp water is still and murky: nearly opaque however shallow, and
        // no shore foam. Eased in over the same width as its tea colour, so
        // clear water fades into the swamp rather than meeting it in a line
        float swampWater = smoothstep(0.0, 1.0, vSwamp);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, waterLit, swampWater);
        gl_FragColor.a = mix(gl_FragColor.a, 0.93, swampWater);
        // Coral reefs in the warm shallows (terrain-gen.js reefWeights): as
        // seen from the air, broad soft blotches of dark blue-green under the
        // bright shallow water, mottled inside, a little bluer where
        // the reef weight says so. Colours come from the water's own lit
        // colour so they follow the time of day.
        vec2 reef = texture2D(uDepthTex, vDepthUV).ba;
        // Shallow water out to ~10 deep. Exact depth, not the softened one:
        // that is softened per chunk and steps at chunk edges
        float reefAmount = (reef.x + reef.y)
          * smoothstep(0.0, 0.3, vWaterDepth) * (1.0 - smoothstep(4.0, 10.0, vWaterDepth));
        if (reefAmount > 0.004) {
          vec2 rp = vWorldPosition.xz;
          // Blotches a few hundred units across (smaller read as speckle
          // from the air), their edges wavy
          vec2 warp = vec2(noise(rp * 0.002 + 3.1), noise(rp * 0.002 - 7.4)) * 160.0;
          float n = noise((rp + warp) * 0.006) * 0.68
                  + noise((rp - warp) * 0.022) * 0.32;
          // Separate soft blotches, never a carpet: at most about a third
          // of the shallows even where the reef weight is full
          // (A fixed threshold: one from the reef weight steps with the
          // depth texture's texels and gives the blotches blocky edges)
          const float edge = 0.5;
          float blot = smoothstep(edge, edge + 0.2, n) * smoothstep(0.0, 0.5, reefAmount);
          float core = smoothstep(edge + 0.08, edge + 0.32, n);
          // A darker, deeper shade of the water's own colour (a fixed navy
          // greyed out over green shallows)
          vec3 shallowTint = waterLit * vec3(0.72, 0.86, 0.92);
          vec3 deepTint = waterLit * mix(vec3(0.42, 0.6, 0.7), vec3(0.5, 0.52, 0.72), smoothstep(0.45, 0.75, reef.y / max(reef.x + reef.y, 0.004)));
          vec3 reefColor = mix(shallowTint, deepTint, core);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, reefColor, blot * 0.7);
          gl_FragColor.a = max(gl_FragColor.a, blot * 0.6);
        }

        // Add macro-scale spatial variation to break up monotony across different water bodies
        float macro = sin(vWorldPosition.x * 0.0002) * cos(vWorldPosition.z * 0.00025);
        // Constant ripple frequency: varying it across space bunches the
        // ripple phases into visible bands. Only their strength varies.
        const float rippleScale = 0.1;
        const float timeScale = 1.5;
        float perturbStrength = 0.05 + macro * 0.03; // 0.02 to 0.08

        // Distance fade for high-frequency normal perturbations to reduce aliasing
        float nearFade = 1.0 - smoothstep(0.0, 1500.0, vDistanceXZ);

        // Organic high-frequency ripples for shimmering specular
        vec2 pos = vWorldPosition.xz * rippleScale;
        float t = uTime * timeScale;

        // 3 non-axis-aligned waves to break the grid interference pattern
        float dx = sin(dot(pos, vec2(0.8, 0.6)) + t) * 0.8
                 + sin(dot(pos, vec2(-0.6, 0.8)) + t * 1.3) * -0.6
                 + sin(dot(pos, vec2(0.9, -0.4)) + t * 0.7) * 0.9;
        float dz = sin(dot(pos, vec2(0.8, 0.6)) + t) * 0.6
                 + sin(dot(pos, vec2(-0.6, 0.8)) + t * 1.3) * 0.8
                 + sin(dot(pos, vec2(0.9, -0.4)) + t * 0.7) * -0.4;
        // Fade ripples where a pixel covers too much of a ripple (~60 units
        // long) to draw it cleanly; otherwise they alias into stripes.
        float footprint = length(fwidth(vWorldPosition.xz));
        float rippleAA = 1.0 - smoothstep(3.0, 12.0, footprint);
        vec3 rippleNormal = vec3(dx, 0.0, dz) * perturbStrength * nearFade * rippleAA;
        vec3 n = normalize(vSmoothNormal + rippleNormal);

        // Sky reflection (Fresnel): looking down you see the water's color;
        // toward the horizon it mirrors the sky, so the sea takes on the
        // sunset's colors.
        // The large vertex waves have a regular period; tilting the reflection
        // by their full slope shows up as stripes, so they count for less here.
        vec3 reflNormal = normalize(mix(vec3(0.0, 1.0, 0.0), vSmoothNormal, 0.35) + rippleNormal * 0.5);
        vec3 reflDir = reflect(-viewDir, reflNormal);
        reflDir.y = abs(reflDir.y);
        // Ripples too small to see still tilt the surface toward the
        // viewer at grazing angles, so the far sea never turns into a
        // perfect mirror of the sky and the horizon line stays readable
        // (after NeuralSpecOcean's roughness-limited Fresnel)
        float cosTheta = max(dot(viewDir, n), 0.07);
        float skyFresnel = 0.04 + 0.96 * pow(1.0 - cosTheta, 5.0);
        vec3 reflected = skyColorAt(reflDir, uTopColor, uBottomColor, uSunDirection, 0.0);
        // Only where the reflection is strong enough to show clouds
        if (uShowClouds && skyFresnel > 0.08) {
          vec4 reflClouds = cloudsAlong(vWorldPosition, reflDir, uCloudHeight, uCloudDensity, uSkyTime,
                                        uSunDirection, uTopColor, uBottomColor);
          reflected = mix(reflected, reflClouds.rgb, reflClouds.a);
        }
        gl_FragColor.rgb = mix(gl_FragColor.rgb, reflected, skyFresnel * 0.85);
        gl_FragColor.a = max(gl_FragColor.a, skyFresnel * depthOpacity);

        // Sun glitter path. Waves tilt small facets of the surface in every
        // direction; the path is where some of them are tilted just right to
        // reflect the sun at the camera. A Beckmann slope distribution gives
        // that fraction, producing the tall path from the horizon toward the
        // viewer (a single highlight lobe collapses into a thin line).
        vec3 halfVector = normalize(uSpecularDir + viewDir);
        float cosT = clamp(dot(halfVector, n), 0.001, 1.0);
        float cosT2 = cosT * cosT;
        // Mean squared wave slope. Ripples faded out with distance (or too
        // fine for the pixel) still roughen the surface, so their slope
        // moves into the path's spread and the path keeps its width out to
        // the horizon instead of thinning (NeuralSpecOcean does the same)
        float slopeVar = 0.035 + 0.012 * (1.0 - nearFade * rippleAA);
        float beckmann = exp(-(1.0 - cosT2) / (cosT2 * slopeVar)) / (slopeVar * cosT2 * cosT2);

        // Glints: finer, faster ripples break the path into bright sparkles
        // near the camera (faded out before they'd alias).
        float glintFade = 1.0 - smoothstep(200.0, 2500.0, vDistanceXZ);
        float gt = uTime * 2.3;
        // On a river the glints drift downstream with the current (see
        // flowLayers below)
        float flowAmt = length(vFlow);
        float glint;
        vec2 flowOff0 = vec2(0.0), flowOff1 = vec2(0.0);
        float flowW0 = 1.0;
        if (flowAmt > 0.02) {
          // A flow map: two copies of a pattern, each sliding downstream for
          // a while and then jumping back, cross-faded so neither jump shows
          // (sliding forever would smear the pattern where the river bends)
          float ph = fract(uTime * 0.12);
          flowOff0 = vFlow * ph * 45.0;
          flowOff1 = vFlow * fract(ph + 0.5) * 45.0 + vec2(37.0, 91.0);
          flowW0 = 1.0 - abs(1.0 - 2.0 * ph);
          glint = mix(waterGlint(vWorldPosition.xz - flowOff1, gt, n, halfVector),
                      waterGlint(vWorldPosition.xz - flowOff0, gt, n, halfVector), flowW0);
        } else {
          glint = waterGlint(vWorldPosition.xz, gt, n, halfVector);
        }
        float sparkle = mix(1.0, 0.35 + glint * 8.0, glintFade);

        float pathFresnel = 0.02 + 0.98 * pow(1.0 - max(dot(viewDir, halfVector), 0.0), 5.0);
        float glitter = beckmann * pathFresnel * sparkle * 0.02;
        // Low sun: the path glows gold rather than white.
        float lowSun = (1.0 - smoothstep(0.04, 0.35, uSpecularDir.y)) * uGlitterWarm;
        vec3 glitterColor = uSunColor * mix(vec3(1.0), vec3(1.0, 0.72, 0.38), lowSun);
        gl_FragColor.rgb += glitterColor * min(glitter, 3.0);

        // Whitecaps (after NeuralSpecOcean's offshore foam): when the
        // weather whips the sea up, small patches of foam break on the
        // swell's crests out on the open sea, broken up by noise and
        // drifting, more and bigger the rougher it is. Faded out before
        // they'd shimmer in the distance.
        if (uWhitecaps > 0.01 && vDistanceXZ < 4500.0) {
          // Each patch of foam stays where it broke, drifting slowly
          // downwind, flares up in about a second and then shrinks away
          // over several more, on its own clock (the start time varies
          // smoothly across the sea, so neighbours break at different
          // moments). Not tied to the swell's crests: they travel far too
          // fast to carry foam that reads as foam.
          vec2 wp = vWorldPosition.xz - vec2(0.944, 0.33) * (uTime * 2.0);
          float capN = noise(wp * 0.05) * 0.45 + noise(wp * 0.2) * 0.55;
          float life = fract(uTime / 12.0 + noise(wp * 0.008 + 17.3) * 3.0);
          float bloom = smoothstep(0.0, 0.08, life) * (1.0 - smoothstep(0.2, 0.95, life));
          float capEdge = 0.83 - uWhitecaps * 0.1 + (1.0 - bloom) * 0.1;
          float cap = smoothstep(capEdge, capEdge + 0.06, capN) * bloom * deep * (1.0 - swampWater)
                    * (1.0 - smoothstep(1500.0, 4500.0, vDistanceXZ));
          float capLight = clamp(dot(waterLit, vec3(0.333)) / max(dot(vColor.rgb, vec3(0.333)), 0.05), 0.0, 1.2);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.94, 0.97, 1.0) * capLight, cap * 0.75);
        }

        // River current: flecks of foam drifting downstream, faded out
        // before they'd shimmer in the distance
        if (flowAmt > 0.02) {
          vec2 dir = vFlow / flowAmt;
          float flecks = mix(flowFlecks(vWorldPosition.xz - flowOff1, dir),
                             flowFlecks(vWorldPosition.xz - flowOff0, dir), flowW0);
          float fleckFade = (1.0 - smoothstep(250.0, 1600.0, vDistanceXZ)) * smoothstep(0.02, 0.5, flowAmt);
          float fleckLight = clamp(dot(waterLit, vec3(0.333)) / max(dot(vColor.rgb, vec3(0.333)), 0.05), 0.0, 1.2);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.92, 0.96, 1.0) * fleckLight, flecks * fleckFade * 0.4);
        }

        #ifdef ANIME_WATER
        // Painted wave strokes: short light dashes along the crests of the
        // main swell, broken up by noise and drifting with the waves, faded
        // out before they'd shimmer in the distance. Open sea only: the
        // strokes fade in with depth (the open ocean is ~10 units deep;
        // rivers, ponds and most of a lake are shallower), so calm inland
        // water stays calm.
        {
          vec2 swellDir = vec2(0.944, 0.33);
          vec2 crestDir = vec2(-0.33, 0.944);
          vec2 wp = vWorldPosition.xz;
          float phase = dot(wp, swellDir) * 0.018 + uTime;
          float strokeFade = (1.0 - smoothstep(600.0, 2800.0, vDistanceXZ))
                           * smoothstep(8.0, 9.5, softDepth);
          vec2 sp = vec2(dot(wp, crestDir) / 22.0, dot(wp, swellDir) / 3.0 - uTime * 0.15);
          float crest = smoothstep(0.35, 0.9, sin(phase));
          float lightStroke = smoothstep(0.66, 0.71, noise(sp)) * crest * strokeFade;
          float strokeLight = clamp(dot(waterLit, vec3(0.333)) / max(dot(vColor.rgb, vec3(0.333)), 0.05), 0.0, 1.2);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.9, 0.95, 1.0) * strokeLight, lightStroke * 0.45);
        }
        #endif

        // Shore foam: a white band in the shallowest water that pulses toward
        // the shore, lit like the water so it dims at night. Applied last:
        // foam sits on the surface and doesn't reflect the sky.
        float lightLevel = clamp(dot(waterLit, vec3(0.333)) / max(dot(vColor.rgb, vec3(0.333)), 0.05), 0.0, 1.2);
        float foamNoise = sin(vWorldPosition.x * 0.09 + vWorldPosition.z * 0.07) * 0.5
                        + sin(vWorldPosition.x * -0.05 + vWorldPosition.z * 0.11 + uTime * 0.7) * 0.5;
        // Distance to shore from depth and how fast depth changes across the
        // surface, so foam hugs every shoreline at the same width whether the
        // bottom drops steeply (islands) or gently (lakes).
        float depthSlope = length(vec2(dFdx(vWaterDepth), dFdy(vWaterDepth)))
                         / max(length(vec2(length(dFdx(vWorldPosition.xz)), length(dFdy(vWorldPosition.xz)))), 0.001);
        float shoreDist = max(vWaterDepth, 0.0) / max(depthSlope, 0.02);
        // Rings of foam that move toward the shore (phase rises with distance).
        float foamRings = smoothstep(0.35, 0.8, 0.5 + 0.5 * sin(uTime * 1.3 + shoreDist * 0.3 + foamNoise * 1.5));
        float foamEdge = 1.0 - smoothstep(3.0, 8.0, shoreDist); // solid at the waterline
        float foam = (1.0 - smoothstep(12.0, 28.0, shoreDist)) * smoothstep(0.0, 0.05, vWaterDepth)
                   * max(foamRings * 0.8, foamEdge) * (1.0 - swampWater);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.95, 0.97, 1.0) * lightLevel, foam * 0.9);
        gl_FragColor.a = max(gl_FragColor.a, foam * 0.9);

        // Where the terrain is right at the surface, the swell pokes the water
        // just above the ground in thin slivers; fade them out so they don't
        // draw lines along the water-level contour across the land.
        gl_FragColor.a *= smoothstep(0.05, 0.6, vWaterDepth);

        // Approaching the draw distance, blend into the distant ring's sea so
        // there's no line where it takes over.
        float farSeaBlend = smoothstep(uRenderRadius * 0.8, uRenderRadius * 0.97, vDistanceXZ) * (1.0 - uNearEdgeFade);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, farSeaColor(viewDir, uTopColor, uBottomColor, uSunDirection), farSeaBlend);
        gl_FragColor.a = mix(gl_FragColor.a, 1.0, farSeaBlend * smoothstep(0.05, 0.6, vWaterDepth));

        #include <fog_fragment>
        `
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `
     #ifdef USE_FOG
       vec3 fogSkyColor = fogSkyColorAt(vWorldPosition);
       
       #ifdef FOG_EXP2
           float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
       #else
           float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
       #endif
       
       float distRatio = vDistanceXZ / uRenderRadius;
       float xzFogFactor = smoothstep(0.9, 0.99, distRatio) * uNearEdgeFade;
       
       float finalFogFactor = max(fogFactor, xzFogFactor);
       
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
     #endif
    `
  );

  // Anime style: painted wave strokes
  if (ART_PAINTED) {
    shader.fragmentShader = '#define ANIME_WATER\n' + shader.fragmentShader;
  }
};

// Reusable tree geometries for forest instances
export var treeTrunkGeo = paintGeometry(
  new THREE.CylinderGeometry(1.5, 2.5, 14, 6),
  0x5d4037
);
treeTrunkGeo.translate(0, 7, 0);

// Pine tier: a cone whose skirt alternates drooping branch tips
// and notches pulled in and up between them, so each tier reads as a brushy
// fringe rather than a smooth cone
function createPineTier(radius, height, segs, y) {
  const cone = new THREE.ConeGeometry(radius, height, segs);
  const pos = cone.attributes.position;
  const step = (Math.PI * 2) / segs;
  for (let i = 0; i < pos.count; i++) {
    const vy = pos.getY(i);
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    if (vy > -height / 2 + 1e-4 || vx * vx + vz * vz < 1e-6) continue;
    const k = Math.round(Math.atan2(vz, vx) / step);
    if (Math.abs(k) % 2 === 1) {
      pos.setXYZ(i, vx * 0.62, vy + height * 0.22, vz * 0.62);
    } else {
      pos.setXYZ(i, vx * 1.15, vy - height * 0.12, vz * 1.15);
    }
  }
  cone.computeVertexNormals();
  cone.translate(0, y, 0);
  return cone;
}

function createPineGeometry() {
  // 4 tiers whose skirts end in drooping branch tips (createPineTier), each
  // sinking into the one below so no gaps show; widest at the bottom
  const segs = 8;
  const tiers = [
    [10.5, 12, 14],
    [8.2, 11, 19],
    [6, 10, 24],
    [3.6, 8, 28.5],
  ];
  const parts = tiers.map(([r, h, y]) => createPineTier(r, h, segs, y));
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of parts) {
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
  return paintGeometry(geom);
}
export var treeLeavesGeo = createPineGeometry();

// Broadleaf canopy: a core plus smaller lumps spread over a dome, like the
// cloud-shaped trees in Ghibli backgrounds. Each lump keeps its own smooth
// normals, so it catches light and shadow on its own. center and radii (x, y,
// z) describe the dome; lumps of about lumpR sit on its surface, more toward
// the top.
function createLumpCanopy(center, radii, count, lumpR) {
  const parts = [];
  // Few segments: trees are drawn by the thousand (~150 triangles a canopy)
  const core = new THREE.SphereGeometry(1, 6, 3);
  core.scale(radii.x * 0.78, radii.y * 0.78, radii.z * 0.78);
  core.translate(center.x, center.y, center.z);
  parts.push(core);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    // Spread over most of the dome (golden spiral), down its sides so the
    // canopy hangs low around the trunk
    const t = (i + 0.5) / count;
    const y = 1 - t * 1.7;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * golden;
    // Lumps vary a little in size, bigger near the crown
    const r = lumpR * (0.85 + 0.3 * ((i * 0.618) % 1)) * (1.1 - t * 0.25);
    const lump = new THREE.SphereGeometry(r, 4, 3);
    lump.translate(
      center.x + Math.cos(a) * ring * radii.x * 0.82,
      center.y + y * radii.y * 0.82,
      center.z + Math.sin(a) * ring * radii.z * 0.82
    );
    parts.push(lump);
  }
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const g of parts) {
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
  return paintGeometry(geom);
}

function createDeciduousGeometry() {
  const trunk = paintGeometry(
    new THREE.CylinderGeometry(1.2, 1.8, 12, 6),
    0x5d4037
  );
  trunk.translate(0, 6, 0);

  return {
    trunk,
    leaves: createLumpCanopy(
      new THREE.Vector3(0, 12.5, 0),
      new THREE.Vector3(7, 6.2, 7),
      8,
      3.4
    ),
  };
}
export var deciduousGeos = createDeciduousGeometry();

function createTallDeciduousGeometry() {
  const trunk = paintGeometry(
    new THREE.CylinderGeometry(1.5, 2.2, 16, 6),
    0x5d4037
  );
  trunk.translate(0, 8, 0);

  return {
    trunk,
    leaves: createLumpCanopy(
      new THREE.Vector3(0, 19, 0),
      new THREE.Vector3(5.2, 10.5, 5.2),
      8,
      3.3
    ),
  };
}
export var tallDeciduousGeos = createTallDeciduousGeometry();

export var japaneseMapleGeos = buildJapaneseMapleGeos();
export var cherryBlossomGeos = buildCherryBlossomGeos();
export var sculptedPineGeos = buildSculptedPineGeos();
export var birchGeos = buildBirchGeos();
export var broadleafOakGeos = buildBroadleafOakGeos();
export var oakGeos = buildOakGeos();
export var magnoliaGeos = buildMagnoliaGeos();
export var appleTreeGeos = buildAppleTreeGeos();
export var orchardAppleGeos = buildOrchardAppleGeos();
export var plumTreeGeos = buildPlumTreeGeos();
export var fruitTreeGeos = buildFruitTreeGeos();
export var snowSpruceGeos = buildSnowSpruceGeos();
export var mountainRowanGeos = buildMountainRowanGeos();
export var deadCottonwoodGeo = buildDeadCottonwoodGeo();
export var twistedDeadOakGeo = buildTwistedDeadOakGeo();
const _palmGeos = buildPalmGeos();
export var palmGeos = {
  trunk: _palmGeos.trunk,
  leaves: _palmGeos.leaves,
  fullTrunk: _palmGeos.fullTrunk,
  fullLeaves: _palmGeos.fullLeaves,
};
export var palmSimpleLeavesGeo = _palmGeos.simpleLeaves;

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
export var deadTreeGeo = createDeadTreeGeometry();

// Joshua tree (the desert): a shaggy trunk forking into a few crooked arms,
// each ending in a spiky tuft of leaves. Trunk and tufts are separate
// geometries so the tufts take the per-instance leaf colour.
function createJoshuaTreeGeometry() {
  const wood = [];
  const tufts = [];
  // A spiky tuft: two octahedra a quarter turn apart, so its points stick
  // out all round like a ball of dagger leaves
  const tuftAt = (x, y, z, r) => {
    for (const turn of [0, Math.PI / 4]) {
      const t = new THREE.OctahedronGeometry(r, 0);
      t.rotateY(turn);
      t.rotateX(turn * 0.6);
      t.translate(x, y, z);
      tufts.push(t);
    }
  };
  const trunk = new THREE.CylinderGeometry(1.1, 1.6, 8, 5);
  trunk.translate(0, 4, 0);
  wood.push(trunk);
  // [lean from upright, direction, length, fork]
  const arms = [
    [1.05, 0.4, 9, true],
    [1.2, 2.5, 7.5, false],
    [0.8, 4.3, 10, true],
  ];
  const tipOf = (lean, dir, len) => [
    Math.sin(lean) * Math.cos(dir) * len,
    Math.cos(lean) * len,
    -Math.sin(lean) * Math.sin(dir) * len,
  ];
  const branch = (x, y, z, lean, dir, len, r0, r1) => {
    const g = new THREE.CylinderGeometry(r1, r0, len, 5);
    g.translate(0, len / 2, 0);
    g.rotateZ(-lean);
    g.rotateY(dir);
    g.translate(x, y, z);
    wood.push(g);
    const [tx, ty, tz] = tipOf(lean, dir, len);
    return [x + tx, y + ty, z + tz];
  };
  for (const [lean, dir, len, fork] of arms) {
    // Each arm crooks upward halfway along
    const mid = branch(0, 7.5, 0, lean, dir, len * 0.55, 0.8, 0.65);
    const end = branch(...mid, lean * 0.25, dir, len * 0.45, 0.65, 0.55);
    tuftAt(end[0], end[1] + 1.2, end[2], 2);
    if (fork) {
      const f = branch(...mid, 0.75, dir + 1.4, 4.5, 0.5, 0.45);
      tuftAt(f[0], f[1] + 1, f[2], 1.7);
    }
  }
  return {
    trunk: mergeGeometries(wood),
    leaves: paintGeometry(mergeGeometries(tufts)),
  };
}

export var treeTrunkMat = createMaterial({
  color: 0xffffff,
  vertexColors: true,
  flatShading: true,
});
// Leaf materials use WHITE as the base color so per-instance colors control the actual appearance
// (Three.js multiplies instance color × material color, so white = identity / no tint)
export var treeLeavesBaseMat = createMaterial({
  color: 0xffffff,
  vertexColors: true,
  flatShading: true,
  foliage: true,
});
export var deadTreeMat = createMaterial({color: 0x8d6e63, flatShading: true});

// Rock geometries and materials
export var rockGeo = new THREE.DodecahedronGeometry(3, 0); // Base flat shaded rock
export var rockMat = createMaterial({color: 0x888888, flatShading: true});
export var snowRockMat = createMaterial({color: 0xdddddd, flatShading: true});
export var desertRockMat = createMaterial({color: 0xd2b48c, flatShading: true});

// Cactus geometries and materials
// `simple`: 4-sided, without the rounded caps and elbows, for its shadow
function createCactusGeometry(simple = false) {
  const sides = simple ? 4 : 8;
  const geometries = [];

  // Main trunk
  const mainRadius = 1.4;
  const mainHeight = 14;
  const trunk = new THREE.CylinderGeometry(
    mainRadius * 0.9,
    mainRadius,
    mainHeight,
    sides
  );
  trunk.translate(0, mainHeight / 2, 0);
  geometries.push(trunk);

  // Trunk top cap (hemisphere)
  if (!simple) {
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
  }

  // Helper function to create an arm
  function createArm(direction, startY, horizontalLen, verticalHeight) {
    const armRadius = 1.0;

    // Horizontal connecting piece
    const hPiece = new THREE.CylinderGeometry(
      armRadius,
      armRadius,
      horizontalLen,
      sides
    );
    hPiece.rotateZ(Math.PI / 2);
    const hCenterX = direction * (mainRadius + horizontalLen / 2 - 0.5);
    hPiece.translate(hCenterX, startY, 0);
    geometries.push(hPiece);

    // Elbow sphere to round the joint
    const elbowX = direction * (mainRadius + horizontalLen - 0.5);
    if (!simple) {
      const elbow = new THREE.SphereGeometry(armRadius, 8, 4);
      elbow.translate(elbowX, startY, 0);
      geometries.push(elbow);
    }

    // Vertical piece
    const vPiece = new THREE.CylinderGeometry(
      armRadius * 0.9,
      armRadius,
      verticalHeight,
      sides
    );
    vPiece.translate(elbowX, startY + verticalHeight / 2, 0);
    geometries.push(vPiece);

    // Top cap
    if (simple) return;
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
export var cactusGeo = createCactusGeometry();
export var cactusShadowGeo = createCactusGeometry(true);
export var cactusMat = createMaterial({color: 0x4caf50, flatShading: true});

// Round hay bale, lying on its side (its axis along x), 5.2 units across
export var hayBaleGeo = (() => {
  const g = new THREE.CylinderGeometry(2.6, 2.6, 3.4, 10);
  g.rotateZ(Math.PI / 2);
  g.translate(0, 2.4, 0);
  return g;
})();
export var hayBaleMat = createMaterial({color: 0xead283, flatShading: true});

// Fallen log, lying along x with a broken branch stub, and a tree stump.
// One bark material for both
export var fallenLogGeo = (() => {
  const log = new THREE.CylinderGeometry(1.1, 1.4, 16, 6);
  log.rotateZ(Math.PI / 2);
  log.translate(0, 1.1, 0);
  const stub = new THREE.CylinderGeometry(0.25, 0.45, 3.2, 4);
  stub.rotateX(-0.9);
  stub.translate(2.5, 2.4, 1);
  return mergeGeometries([log.toNonIndexed(), stub.toNonIndexed()]);
})();
export var stumpGeo = buildStumpGeo();
export var fallenLogMat = createMaterial({color: 0x6e5841, flatShading: true});

// Seal hauled out on an ice floe: a plump body lying along z, its head
// raised at the front (+z) and its hind flippers splayed behind, about 6.5
// units long
export var sealGeo = (() => {
  const body = new THREE.SphereGeometry(1, 8, 5);
  body.scale(1.25, 0.95, 2.9);
  body.translate(0, 0.9, 0);
  const head = new THREE.SphereGeometry(0.75, 7, 5);
  head.scale(1, 0.95, 1.15);
  head.translate(0, 1.75, 2.75);
  const flippers = new THREE.ConeGeometry(0.9, 1.6, 4);
  flippers.scale(1.4, 1, 0.35);
  flippers.rotateX(-Math.PI / 2);
  flippers.translate(0, 0.55, -3.3);
  return mergeGeometries([
    body.toNonIndexed(),
    head.toNonIndexed(),
    flippers.toNonIndexed(),
  ]);
})();
export var sealMat = createMaterial({color: 0x878a8d, flatShading: true});

// A radio mast on a summit (beacons.js): slim, tapering, in red and white
// bands, its foot sunk a little into the rock
export const MAST_HEIGHT = 70;
export function mastGeometry() {
  const bands = 7;
  const geo = new THREE.CylinderGeometry(
    0.35,
    1.8,
    MAST_HEIGHT,
    3,
    bands,
    true
  );
  geo.translate(0, MAST_HEIGHT / 2 - 3, 0);
  const g = geo.toNonIndexed();
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  // As written (not converted from sRGB; see sky.js colour management)
  const red = new THREE.Color().setHex(0xc23a2e, THREE.LinearSRGBColorSpace);
  const white = new THREE.Color().setHex(0xe8e4dc, THREE.LinearSRGBColorSpace);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3 + 3;
    const c = Math.floor((y / MAST_HEIGHT) * bands) % 2 ? white : red;
    for (let j = 0; j < 3; j++) c.toArray(col, (i + j) * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// Channel buoy: a round float riding low in the water and a tapering
// lattice tower on it (tinted per buoy), with a dark lamp cap on top
export var buoyGeos = (() => {
  const float = new THREE.CylinderGeometry(1.5, 1.2, 2.2, 8);
  const tower = new THREE.CylinderGeometry(0.35, 1.05, 3.6, 4);
  tower.rotateY(Math.PI / 4);
  tower.translate(0, 2.9, 0);
  const cap = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 6);
  cap.translate(0, 5, 0);
  return {
    body: mergeGeometries([float.toNonIndexed(), tower.toNonIndexed()]),
    top: cap,
  };
})();
export var buoyTopMat = createMaterial({color: 0x2d3033, flatShading: true});

// Vertex colour a rubble part (one shade a triangle, a little darker where
// wet; under water the rocks keep their own colour and the clear water
// tints them) and add it to parts
function paintRubble(parts, geo, hex) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  // As written (not converted from sRGB; see sky.js colour management)
  const c = new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const wet = y < 0.1 ? 0.84 : y < 0.8 ? 0.92 : 1;
    for (let j = 0; j < 3; j++) {
      col[(i + j) * 3] = c.r * wet * 0.95;
      col[(i + j) * 3 + 1] = c.g * wet;
      col[(i + j) * 3 + 2] = c.b * wet * 0.93;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.deleteAttribute('uv');
  parts.push(geo);
}
const RUBBLE_PALETTE = [
  0x9b958b, 0xaba395, 0x8a857c, 0xb3a893, 0x7f7a71, 0xa09482,
];
const RUBBLE_CORE = 0x857f75;
// A seeded random function for a rubble variant
function rubbleRand(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}
// One boulder of radius about `size` at (x, y, z), squashed and turned
function rubbleBoulder(parts, rand, size, x, y, z) {
  const r = size * (0.8 + rand() * 0.45);
  const b = new THREE.IcosahedronGeometry(r, 0);
  b.deleteAttribute('normal');
  b.scale(1 + rand() * 0.4, 0.6 + rand() * 0.3, 1 + rand() * 0.4);
  b.rotateY(rand() * Math.PI);
  b.rotateX((rand() - 0.5) * 0.5);
  b.translate(x, y, z);
  paintRubble(
    parts,
    b,
    RUBBLE_PALETTE[Math.floor(rand() * RUBBLE_PALETTE.length)]
  );
}
// Rubble rows: [across, height, jitter, radius]: a crown row, a flank row
// each side at the waterline, a row half under water, then two rows each
// side down the slope toward the sea floor
const RUBBLE_ROWS = [
  [0, 1.8, 0.6, 2.4],
  [5.6, 0.6, 0.7, 2.2],
  [8.6, -0.6, 0.6, 1.8],
  [10.8, -3.2, 0.6, 2.3],
  [14.2, -6, 0.6, 2.6],
];
// Breakwater rubble (terrain-gen.js findBreakwater): one stretch of the
// mound, 9 units of it along +z with its waterline at y = 0. A rough
// trapezoid core down to the sea floor and 23 boulders piled on its
// crown, along its flanks at the waterline and down its slopes, vertex
// coloured grey and brown, a little darker where wet. Three variants so the
// stretches don't repeat. About 470 triangles a stretch, 20 or so units wide
// at the waterline and 34 at the foot.
export var breakwaterRockGeos = (() => {
  const variants = [];
  const counts = [3, 3, 2, 3, 2];
  for (let v = 0; v < 3; v++) {
    const rand = rubbleRand(97 + v * 131);
    const parts = [];
    // Core: a mound down to the sea floor, base 34 wide 10 down, crown 8
    // wide 1.4 up (inside the boulders, so no straight edge shows through
    // clear water; deeper than 10 the water hides it anyway)
    const core = new THREE.BoxGeometry(1, 1, 9.4, 1, 1, 1);
    const cp = core.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const top = cp.getY(i) > 0;
      cp.setX(i, cp.getX(i) * (top ? 8 : 34));
      cp.setY(i, top ? 1.4 : -10);
    }
    core.deleteAttribute('normal');
    paintRubble(parts, core, RUBBLE_CORE);
    RUBBLE_ROWS.forEach(([x0, y0, jit, size], row) => {
      for (const side of x0 ? [-1, 1] : [1]) {
        const count = counts[row];
        for (let k = 0; k < count; k++) {
          rubbleBoulder(
            parts,
            rand,
            size,
            side * x0 + (rand() - 0.5) * 2 * jit * 2,
            y0 + (rand() - 0.5) * jit,
            -4.5 + (k + 0.5) * (9 / count) + (rand() - 0.5) * 1.2
          );
        }
      }
    });
    const geo = mergeBufferGeometries(parts);
    geo.computeVertexNormals();
    variants.push(geo);
  }
  return variants;
})();
// The round end of a breakwater, under its beacon: a cone of core and the
// same rows of boulders in rings, so the mound rounds off past the last
// stretch down to the sea floor instead of ending in a flat face.
// About 700 triangles, one a breakwater.
export var breakwaterHeadGeo = (() => {
  const rand = rubbleRand(4211);
  const parts = [];
  const core = new THREE.CylinderGeometry(4, 19, 11.4, 12, 1, true);
  core.translate(0, -4.3, 0);
  core.deleteAttribute('normal');
  paintRubble(parts, core, RUBBLE_CORE);
  const ringCounts = [0, 6, 8, 10, 12];
  RUBBLE_ROWS.forEach(([r0, y0, jit, size], row) => {
    const count = ringCounts[row];
    for (let k = 0; k < count; k++) {
      const a = ((k + rand() * 0.5) / count) * Math.PI * 2;
      const r = r0 + (rand() - 0.5) * jit * 2;
      rubbleBoulder(
        parts,
        rand,
        size,
        Math.sin(a) * r,
        y0 + (rand() - 0.5) * jit,
        Math.cos(a) * r
      );
    }
  });
  const geo = mergeBufferGeometries(parts);
  geo.computeVertexNormals();
  return geo;
})();
// Surf along both flanks of a rubble stretch, where the rocks meet the
// water, so the mound sits in the sea: thin broken strips like the boats'
// foam rings, starting under the waterline boulders (which break up the
// inner edge) with a ragged outer edge and a gap here and there
export var breakwaterSurfGeo = (() => {
  const foam = [];
  const N = 8;
  for (const side of [-1, 1]) {
    const edge = [];
    for (let k = 0; k <= N; k++) {
      edge.push(9.2 + 1.6 * Math.abs(Math.sin(k * 2.9 + side)));
    }
    for (let k = 0; k < N; k++) {
      if (Math.sin(k * 1.9 + side * 2.2) > 0.8) continue;
      const z0 = -4.7 + (k / N) * 9.4;
      const z1 = -4.7 + ((k + 1) / N) * 9.4;
      const a0 = [side * 7, 0.3, z0];
      const a1 = [side * 7, 0.3, z1];
      const b0 = [side * edge[k], 0.3, z0];
      const b1 = [side * edge[k + 1], 0.3, z1];
      const tris =
        side > 0 ? [a0, a1, b1, a0, b1, b0] : [a0, b1, a1, a0, b0, b1];
      for (const v of tris) foam.push(...v);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(foam, 3));
  geo.computeVertexNormals();
  return geo;
})();
// Breakwater surf: the boats' foam white, drawn after the water (which writes no depth when
// see-through) so the swell, interpolated across the water's coarse grid,
// never hides it; riding the swell itself so it moves with the waves. Each
// instance's colour red channel carries how much the swell is calmed where
// it stands (as the water shader calms it in the shallows); it doesn't tint.
export var breakwaterSurfMat = createMaterial({
  color: 0xffffff,
  // Transparent only to be drawn after the water; fully opaque, so the
  // stretches' overlapping strips don't stack up brighter
  transparent: true,
  opacity: 1,
  depthWrite: false,
  flatShading: true,
  roughness: 0.9,
});
{
  const base = breakwaterSurfMat.onBeforeCompile;
  breakwaterSurfMat.onBeforeCompile = (shader) => {
    base.call(breakwaterSurfMat, shader);
    shader.uniforms.uWaterTime = waterUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `uniform float uWaterTime;
        ${WATER_SWELL_GLSL}
        void main() {`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
          vec4 surfWorld = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
          transformed.y += swell(surfWorld.xz, uWaterTime).x * instanceColor.r;
        #endif`
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
          vColor.xyz = vec3(0.8, 0.9, 0.93);
        #endif`
      );
  };
  breakwaterSurfMat.customProgramCacheKey = () => 'breakwaterSurf';
}
// The beacon at a breakwater's head: a concrete footing and a post (tinted
// red or green per breakwater), with a dark lamp on top
export var breakwaterBeaconGeos = (() => {
  const foot = new THREE.CylinderGeometry(2.6, 3.2, 2.2, 8);
  foot.translate(0, 2.6, 0);
  const post = new THREE.CylinderGeometry(0.8, 1.1, 10, 6);
  post.translate(0, 8.7, 0);
  const lamp = new THREE.CylinderGeometry(1.0, 1.0, 1.6, 6);
  lamp.translate(0, 14.5, 0);
  // Surf round the head (the rubble's own surf runs along its sides only)
  const foam = [];
  const N = 14;
  const outer = [];
  for (let k = 0; k <= N; k++)
    outer.push(10.6 + 2 * Math.abs(Math.sin(k * 2.3)));
  for (let k = 0; k < N; k++) {
    if (Math.sin(k * 1.7 + 0.4) > 0.6) continue;
    const a0 = (k / N) * Math.PI * 2;
    const a1 = ((k + 1) / N) * Math.PI * 2;
    const p = (r, a) => [Math.sin(a) * r, 0.3, Math.cos(a) * r];
    for (const v of [
      p(9, a0),
      p(outer[k], a0),
      p(outer[k + 1], a1),
      p(9, a0),
      p(outer[k + 1], a1),
      p(9, a1),
    ]) {
      foam.push(...v);
    }
  }
  const surf = new THREE.BufferGeometry();
  surf.setAttribute('position', new THREE.Float32BufferAttribute(foam, 3));
  surf.computeVertexNormals();
  return {
    body: mergeGeometries([foot.toNonIndexed(), post.toNonIndexed()]),
    lamp,
    surf,
  };
})();

// Sheep: a woolly body (tinted per sheep) on four dark legs, with a dark
// face held low as if grazing, facing +z; about 3.5 units long (drawn 15 to 45% bigger)
export var sheepGeos = (() => {
  const wool = new THREE.DodecahedronGeometry(1, 0);
  wool.scale(1.1, 0.9, 1.55);
  wool.translate(0, 1.75, 0);
  const head = new THREE.BoxGeometry(0.62, 0.7, 1.0);
  head.rotateX(0.5);
  head.translate(0, 1.45, 1.75);
  const earL = new THREE.BoxGeometry(0.5, 0.14, 0.22);
  earL.translate(0.42, 1.75, 1.45);
  const earR = earL.clone();
  earR.translate(-0.84, 0, 0);
  const parts = [head, earL, earR];
  for (const [x, z] of [
    [0.5, 0.8],
    [-0.5, 0.8],
    [0.5, -0.8],
    [-0.5, -0.8],
  ]) {
    const leg = new THREE.BoxGeometry(0.26, 1.2, 0.26);
    leg.translate(x, 0.6, z);
    parts.push(leg);
  }
  return {
    wool,
    dark: mergeGeometries(parts.map((g) => g.toNonIndexed())),
  };
})();
export var sheepDarkMat = createMaterial({color: 0x2f2a27, flatShading: true});

// Mountain goat and forest deer, built like the sheep: a coat (tinted per
// animal) and dark parts (legs, horns or antlers, nose) sharing the sheep's
// dark material, facing +z with feet at y 0. Goat ~3 units long, about 110
// triangles; deer ~3.6 long and 4.4 tall to the antler tips, about 140.
function boxAt(w, h, d, x, y, z, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g.toNonIndexed();
}
function hornAt(r, h, x, y, z, rx, rz) {
  const g = new THREE.ConeGeometry(r, h, 3, 1, true);
  g.translate(0, h / 2, 0);
  g.rotateX(rx);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g.toNonIndexed();
}
function legsAt(w, h, x, z) {
  const legs = [];
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    legs.push(boxAt(w, h, w, sx * x, h / 2, sz * z));
  }
  return legs;
}
export var goatGeos = (() => {
  const coat = mergeGeometries([
    boxAt(0.85, 0.85, 1.7, 0, 1.55, 0),
    // Neck up from the shoulders, head held up and forward
    boxAt(0.45, 0.8, 0.5, 0, 2.05, 0.8, 0.5),
    boxAt(0.42, 0.45, 0.85, 0, 2.45, 1.15, 0.35),
    // Short tail cocked up
    boxAt(0.18, 0.35, 0.15, 0, 2.0, -0.85, -0.5),
  ]);
  const dark = mergeGeometries([
    ...legsAt(0.18, 1.15, 0.28, 0.62),
    // Horns sweeping back off the crown, a beard under the chin
    hornAt(0.12, 1.0, 0.14, 2.6, 1.05, -1.05, 0.2),
    hornAt(0.12, 1.0, -0.14, 2.6, 1.05, -1.05, -0.2),
    hornAt(0.1, 0.4, 0, 2.3, 1.45, Math.PI, 0),
    boxAt(0.3, 0.2, 0.12, 0, 2.38, 1.6),
  ]);
  return {coat, dark};
})();
export var deerGeos = (() => {
  const coat = mergeGeometries([
    boxAt(0.8, 0.95, 2.0, 0, 2.15, 0),
    boxAt(0.4, 1.1, 0.45, 0, 2.85, 0.9, 0.45),
    boxAt(0.38, 0.42, 0.95, 0, 3.4, 1.3, 0.25),
    // Ears out to the sides
    boxAt(0.45, 0.12, 0.18, 0.32, 3.62, 1.05),
    boxAt(0.45, 0.12, 0.18, -0.32, 3.62, 1.05),
  ]);
  const dark = mergeGeometries([
    ...legsAt(0.15, 1.75, 0.26, 0.72),
    boxAt(0.22, 0.2, 0.12, 0, 3.3, 1.8),
    // Antlers: a beam up and back each side with a forward tine
    hornAt(0.07, 1.0, 0.18, 3.6, 1.15, -0.35, -0.45),
    hornAt(0.07, 1.0, -0.18, 3.6, 1.15, -0.35, 0.45),
    hornAt(0.05, 0.5, 0.42, 4.1, 1.0, 0.5, -0.2),
    hornAt(0.05, 0.5, -0.42, 4.1, 1.0, 0.5, 0.2),
  ]);
  return {coat, dark};
})();

// Ice fishing hut (the far north's frozen lakes): a little painted shed with
// a pitched roof and a stovepipe, its walls tinted per hut
function createIceHutGeometries() {
  const body = new THREE.BoxGeometry(6, 4.5, 8);
  body.translate(0, 2.25, 0);
  const roof = new THREE.CylinderGeometry(4.2, 4.2, 8.6, 3, 1);
  // A triangular prism along the hut, ridge up, eaves overhanging
  roof.rotateX(-Math.PI / 2);
  roof.scale(1, 0.55, 1);
  roof.translate(0, 4.5 + 4.2 * 0.55 * 0.5, 0);
  const pipe = new THREE.CylinderGeometry(0.35, 0.35, 3, 5);
  pipe.translate(1.6, 6.8, -2.2);
  return {body, roof: mergeGeometries([roof, pipe])};
}
export var iceHutGeos = createIceHutGeometries();
export var iceHutRoofMat = createMaterial({color: 0xe4ebf0, flatShading: true});
export var joshuaGeos = createJoshuaTreeGeometry();
export var joshuaTrunkMat = createMaterial({
  color: 0x9c8669,
  flatShading: true,
});

// Mushroom geometry and materials, shaped like the cap on Polyfork's
// Mushroom Cottage (building-models.js): a stout stalk that swells at the
// foot, a round domed cap whose rim curls under, and pale spots and gills.
// The spots and gills go with the stalk (its own pale colour); the cap
// alone takes each mushroom's colour.
const lathe = (pts, segs) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segs
  ).toNonIndexed();
// The cap's outline, rim to crown ([distance out, height]), and its
// spots ([distance out, angle around, size])
const CAP_OUTLINE = [
  [6.4, 10.9],
  [7.1, 11.6],
  [7.2, 12.6],
  [6.6, 14.0],
  [5.4, 15.4],
  [3.6, 16.5],
  [1.6, 17.0],
  [0, 17.1],
];
const CAP_SPOTS = [
  [0.4, 0, 1.1],
  [3.2, 0.4, 0.9],
  [3.0, 2.4, 0.85],
  [3.4, 4.3, 0.9],
  [5.4, 1.3, 0.75],
  [5.6, 3.3, 0.7],
  [5.3, 5.3, 0.75],
  [6.4, 0.2, 0.6],
  [6.3, 2.3, 0.6],
  [6.5, 4.4, 0.6],
];
function createMushroomGeometry() {
  const stalk = lathe(
    [
      [0, 0],
      [2.1, 0],
      [2.0, 1.2],
      [1.5, 3.5],
      [1.3, 7],
      [1.45, 10.5],
      [1.7, 11.8],
      [0, 11.8],
    ],
    8
  );
  // The gills: the cap's underside, from the stalk out to the rim
  const gills = lathe(
    [
      [6.7, 11.0],
      [4.5, 11.5],
      [1.6, 11.8],
    ],
    12
  );
  // Pale spots set into the dome, each at its height on the cap's
  // outline (by its distance out from the middle, and around)
  const dome = CAP_OUTLINE.slice(3).reverse();
  const domeY = (d) => {
    for (let i = 1; i < dome.length; i++) {
      const [r0, y0] = dome[i - 1];
      const [r1, y1] = dome[i];
      if (d <= r1) return y0 + ((d - r0) / (r1 - r0)) * (y1 - y0);
    }
    return dome[dome.length - 1][1];
  };
  const spots = [];
  for (const [d, a, r] of CAP_SPOTS) {
    const spot = new THREE.OctahedronGeometry(r * 1.35, 0);
    spot.scale(1, 0.4, 1);
    const y = domeY(d);
    // Tilted to lie along the dome
    const slope = (domeY(d - 0.3) - domeY(d + 0.3)) / 0.6;
    const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const n = out.clone().multiplyScalar(slope).setY(1).normalize();
    spot.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
    );
    spot.translate(out.x * d, y - 0.05, out.z * d);
    spots.push(spot.toNonIndexed());
  }
  const cap = lathe(CAP_OUTLINE, 12);
  return {
    trunk: mergeGeometries([stalk, gills, ...spots]),
    leaves: paintGeometry(cap),
  };
}
export var mushroomGeos = createMushroomGeometry();
export var mushroomStalkMat = createMaterial({
  color: 0xfff7e6,
  flatShading: true,
});

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
export var lilyPadGeo = createLilyPadGeometry();
export var lilyPadMat = createMaterial({color: 0x4caf50, flatShading: true});

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
    // 20 triangles a clump (bushes are drawn by the hundred)
    const geo = new THREE.IcosahedronGeometry(c.r, 0);
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
export var bushGeo = createBushGeometry();
export var bushBaseMat = createMaterial({
  color: 0xffffff,
  flatShading: true,
  foliage: true,
}); // For instance coloring

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
export var snowmanGeos = createSnowmanGeometry();
export var snowmanBodyMat = createMaterial({
  color: 0xffffff,
  flatShading: true,
});
export var snowmanNoseMat = createMaterial({
  color: 0xff8c00,
  flatShading: true,
});

// Reusable house geometries
export var houseBodyGeo = new THREE.BoxGeometry(10, 8, 10);
houseBodyGeo.translate(0, 4, 0);
// Gabled roofs (createGableRoof, also used for the monastery): the ridge
// runs across the front (the door's side, +Z), with eaves overhanging the
// 10 x 10 walls on every side
function createHouseRoof(height, baseY) {
  const roof = createGableRoof(10, 10, height, 1.1);
  roof.rotateY(Math.PI / 2);
  roof.translate(0, baseY, 0);
  return roof;
}
export var houseRoofGeo = createHouseRoof(7, 8);
export var houseWindowGeo = new THREE.BoxGeometry(2, 2.5, 0.5);

export var houseDoorGeo = new THREE.BoxGeometry(2.5, 4.5, 0.5);
export var houseChimneyGeo = new THREE.BoxGeometry(1.5, 5, 1.5);
houseChimneyGeo.translate(0, 11, 0);

export var houseDoorMat = createMaterial({color: 0x5c4033, flatShading: true});
export var houseChimneyMat = createMaterial({
  color: 0x8b3a3a,
  flatShading: true,
});

// Two story house geometries
export var twoStoryBodyGeo = new THREE.BoxGeometry(10, 14, 10);
twoStoryBodyGeo.translate(0, 7, 0);
export var twoStoryRoofGeo = createHouseRoof(8, 14);
export var twoStoryChimneyGeo = new THREE.BoxGeometry(1.5, 5, 1.5);
twoStoryChimneyGeo.translate(0, 17.5, 0);

// Straw hut geometries (vertex-colored adobe walls + doorway + tiered thatch roof)
function buildVertexColoredGeo(parts) {
  const pos = [],
    norm = [],
    col = [],
    idx = [];
  let offset = 0;
  for (const {geo, color} of parts) {
    const c = new THREE.Color(color);
    pos.push(...geo.attributes.position.array);
    if (geo.attributes.normal) norm.push(...geo.attributes.normal.array);
    const count = geo.attributes.position.count;
    for (let i = 0; i < count; i++) col.push(c.r, c.g, c.b);
    if (geo.index) {
      for (let i = 0; i < geo.index.array.length; i++)
        idx.push(geo.index.array[i] + offset);
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
  geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geom.setIndex(idx);
  return geom;
}

function createStrawHutBodyGeometry() {
  const wall = new THREE.CylinderGeometry(3.85, 4.1, 6.0, 8);
  wall.translate(0, 3.0, 0);
  const plinth = new THREE.CylinderGeometry(4.25, 4.35, 0.7, 8);
  plinth.translate(0, 0.35, 0);
  const door = new THREE.BoxGeometry(1.7, 3.6, 0.4);
  door.translate(0, 1.8, 3.78);
  const postL = new THREE.BoxGeometry(0.32, 3.8, 0.55);
  postL.translate(-0.95, 1.9, 3.82);
  const postR = new THREE.BoxGeometry(0.32, 3.8, 0.55);
  postR.translate(0.95, 1.9, 3.82);
  const lintel = new THREE.BoxGeometry(2.4, 0.38, 0.62);
  lintel.translate(0, 3.75, 3.85);
  return buildVertexColoredGeo([
    {geo: plinth, color: 0x7d6b57},
    {geo: wall, color: 0xc99e67},
    {geo: door, color: 0x1e140d},
    {geo: postL, color: 0x5c3d24},
    {geo: postR, color: 0x5c3d24},
    {geo: lintel, color: 0x5c3d24},
  ]);
}

function createStrawHutRoofGeometry() {
  const lowerEave = new THREE.CylinderGeometry(3.3, 5.7, 2.2, 8);
  lowerEave.translate(0, 6.9, 0);
  const upperCone = new THREE.ConeGeometry(3.55, 3.2, 8);
  upperCone.translate(0, 9.4, 0);
  const finial = new THREE.CylinderGeometry(0.28, 0.55, 1.1, 6);
  finial.translate(0, 11.1, 0);
  return buildVertexColoredGeo([
    {geo: lowerEave, color: 0xd9b36c},
    {geo: upperCone, color: 0xe6c280},
    {geo: finial, color: 0x5c3d24},
  ]);
}

export var strawHutBodyGeo = createStrawHutBodyGeometry();
export var strawHutRoofGeo = createStrawHutRoofGeometry();
export var strawHutMat = createMaterial({
  vertexColors: true,
  flatShading: true,
});

// Iceberg & Ice floe geometries & materials
export var icebergMainGeo = new THREE.CylinderGeometry(8, 16, 20, 6, 2);
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

export var iceFloeMainGeo = new THREE.CylinderGeometry(15, 18, 4, 7, 1);
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

export var icebergMat = createMaterial({
  color: 0xd0f0f5,
  emissive: 0x0a1c28,
  roughness: 0.15,
  metalness: 0.05,
  flatShading: true,
});

// Penguin geometries & materials
export var penguinBodyGeo = new THREE.CylinderGeometry(1.05, 1.32, 3.2, 8);
penguinBodyGeo.translate(0, 1.6, 0);

// Sculpted front chest patch that conforms to the tapered round torso
export var penguinBellyGeo = new THREE.CylinderGeometry(0.95, 1.18, 2.55, 8);
penguinBellyGeo.scale(0.82, 1.0, 0.72);
penguinBellyGeo.translate(0, 1.52, 0.56);

export var penguinHeadGeo = new THREE.SphereGeometry(1.0, 8, 6);
penguinHeadGeo.translate(0, 3.75, 0.15);

export var penguinBeakGeo = new THREE.ConeGeometry(0.28, 0.95, 4);
penguinBeakGeo.rotateX(Math.PI / 2);
penguinBeakGeo.translate(0, 3.72, 1.42);

var penguinWingGeo = new THREE.BoxGeometry(0.22, 2.05, 0.72);
// Taper flipper tips
var pwPos = penguinWingGeo.attributes.position;
for (let i = 0; i < pwPos.count; i++) {
  if (pwPos.getY(i) < 0) {
    pwPos.setZ(i, pwPos.getZ(i) * 0.55 - 0.08);
  }
}
penguinWingGeo.computeVertexNormals();
export var penguinWingLGeo = penguinWingGeo.clone();
penguinWingLGeo.rotateZ(-0.18);
penguinWingLGeo.translate(-1.32, 1.82, 0.12);

export var penguinWingRGeo = penguinWingGeo.clone();
penguinWingRGeo.rotateZ(0.18);
penguinWingRGeo.translate(1.32, 1.82, 0.12);

var penguinFootGeo = new THREE.BoxGeometry(0.7, 0.2, 1.3);
export var penguinFootLGeo = penguinFootGeo.clone();
penguinFootLGeo.translate(-0.6, 0.1, 0.4);

export var penguinFootRGeo = penguinFootGeo.clone();
penguinFootRGeo.translate(0.6, 0.1, 0.4);

// All of a penguin in one mesh, its parts coloured per vertex: one draw call
// a tile instead of eight
export var penguinGeo = mergeBufferGeometries(
  [
    [penguinBodyGeo, 0x222222],
    [penguinBellyGeo, 0xffffff],
    [penguinHeadGeo, 0x222222],
    [penguinBeakGeo, 0xffa500],
    [penguinWingLGeo, 0x222222],
    [penguinWingRGeo, 0x222222],
    [penguinFootLGeo, 0xffa500],
    [penguinFootRGeo, 0xffa500],
  ].map(([geo, hex]) => paintGeometry(geo.clone().toNonIndexed(), hex))
);
export var penguinMat = createMaterial({
  color: 0xffffff,
  vertexColors: true,
  flatShading: true,
});

// Waddling shader animation
var penguinShaderInject = (shader) => {
  shader.uniforms.uTime = animationUniforms.uTime;
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
penguinMat.onBeforeCompile = penguinShaderInject;
// The same, without the waddle: for penguins scared off their floe
// (breakables.js), which move by their own matrices. The waddle is worked
// out from where each penguin stands, so on one that's moving it would jump
// about every frame.
export var penguinStillMats = new Map([
  [
    penguinMat,
    createMaterial({color: 0xffffff, vertexColors: true, flatShading: true}),
  ],
]);

// Where the waddle above has a penguin standing at (x, z) at time t: its
// step off its spot and turn, into `target` (in its own space), and its
// sway (rad, about its own z). In float32 like the shader, which it follows.
export function penguinWaddlePose(x, z, t, target) {
  const f = Math.fround;
  const fract = (v) => v - Math.floor(v);
  const phase = f(f(x) + f(z));
  const waddling = fract(f(phase * 1.543)) >= 0.4 ? 1 : 0;
  const cycle = f(f(t * 4) + phase);
  const sway = Math.sin(cycle) * 0.15 * waddling;
  const bob = Math.abs(Math.cos(cycle)) * 0.2 * waddling;
  const walk = f(f(t * 0.8) + f(phase * 2.5));
  const ry = (walk + 1.5708) * waddling;
  // The shader's rotY turns the other way from three's
  target.makeRotationY(-ry);
  target.setPosition(
    Math.cos(walk) * 2.5 * waddling,
    bob,
    Math.sin(walk) * 2.5 * waddling
  );
  return sway;
}

// House color palettes, for the model debug page; the game tints one white
// material per house instead (houseTintMat)
export var houseBodyPalette = HOUSE_BODY_COLORS.map((color) =>
  createMaterial({color, flatShading: true})
);
export var houseRoofPalette = HOUSE_ROOF_COLORS.map((color) =>
  createMaterial({color, flatShading: true})
);
export var houseTintMat = createMaterial({color: 0xffffff, flatShading: true});

// Window Materials (variations for staggered lighting)
export var houseWindowMats = [];
for (let i = 0; i < HOUSE_WINDOW_POOLS; i++) {
  houseWindowMats.push(
    createMaterial({
      color: 0x4a6a8a, // Soft glassy blue instead of black
      emissive: 0xffd54f,
      emissiveIntensity: 0.0,
      roughness: 0.2, // Slightly rough instead of perfectly smooth for better lighting capture
    })
  );
}

// Every house window in one instanced mesh (one draw a tile, not eight):
// each instance's colour carries its pool (red = pool / 7, set in
// terrain-gen.js), whose glow is uHouseWindowGlow[pool] (game-loop.js). The
// instance colour isn't painted on, the glass stays houseWindowMats' blue.
export var houseWindowGlow = {value: new Array(HOUSE_WINDOW_POOLS).fill(0)};
export var houseWindowMat = createMaterial({
  color: 0x4a6a8a,
  emissive: 0xffd54f,
  emissiveIntensity: 1.0,
  roughness: 0.2,
});
{
  const base = houseWindowMat.onBeforeCompile;
  houseWindowMat.onBeforeCompile = (shader, renderer) => {
    base?.(shader, renderer);
    shader.uniforms.uHouseWindowGlow = houseWindowGlow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uHouseWindowGlow[${HOUSE_WINDOW_POOLS}];
        varying float vWindowGlow;`
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        #ifdef USE_INSTANCING_COLOR
        vWindowGlow = uHouseWindowGlow[int(instanceColor.r * ${(HOUSE_WINDOW_POOLS - 1).toFixed(1)} + 0.5)];
        #else
        vWindowGlow = uHouseWindowGlow[0];
        #endif`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vWindowGlow;`
      )
      .replace('#include <color_fragment>', '')
      .replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vWindowGlow;'
      );
  };
}

// --- BARN ---
// Polyfork barns (farm-models.js), walls and roof: the red barn (barn...),
// and up north the timber barn and the alpine hay barn
var barnGeos = buildBarnGeos();
export var barnBodyGeo = barnGeos.barnBody;
export var barnRoofGeo = barnGeos.barnRoof;
export var timberBarnBodyGeo = barnGeos.timberBarnBody;
export var timberBarnRoofGeo = barnGeos.timberBarnRoof;
export var hayBarnBodyGeo = barnGeos.hayBarnBody;
export var hayBarnRoofGeo = barnGeos.hayBarnRoof;

// The red barns' silo (farm-models.js), drum and cap
var siloGeos = buildSiloGeos();
export var barnSiloBodyGeo = siloGeos.body;
export var barnSiloRoofGeo = siloGeos.roof;
// Painted in vertex colours, walls and roof alike
export var barnMat = createMaterial({vertexColors: true, flatShading: true});
export var barnSiloMat = barnMat;
export var barnSiloRoofMat = barnMat;

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

// Polyfork's stone chapel stands where the monasteries were
// (building-models.js), walls and roof
const chapelGeos = buildChapelGeos();
export var monasteryBodyGeo = chapelGeos.body;
export var monasteryRoofGeo = chapelGeos.roof;
export var monasteryBodyMat = buildingMat;
export var monasteryRoofMat = buildingMat;

// --- CASTLE RUINS ---
export function createRockArchGeometries(rng) {
  const rockGeos = [];
  const grassGeos = [];
  // Each block's middle and size, in the arch's own space, for knocking it
  // down (breakables.js): [x, y, z, size, grass (0 or 1)]
  const blocks = [];

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
      blocks.push([jx, jy, jz, (w + h + d) / 3, 0]);

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
          blocks.push([jx, jy + h / 2, jz, w * 0.9, 1]);
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

  return {rock: mergedRock, grass: mergedGrass, blocks};
}
if (typeof window !== 'undefined')
  window.createRockArchGeometries = createRockArchGeometries;

export var rockArchGrassMat = createMaterial({color: 0x7cb342});

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
export var castleRuinsGeo = createCastleRuinsGeometry();
export var castleRuinsMat = createMaterial({
  color: 0x78909c,
  flatShading: true,
}); // weathered stone

function taperWingGeometry(geo, startX, endX, taperFactor, sweepFactor = 0) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const fraction = Math.max(0, Math.min(1, (x - startX) / (endX - startX)));
    const z = pos.getZ(i);
    // Taper the wing width (Z) and add sweep back (translating Z by fraction * sweepFactor)
    // We adjust Z based on its sign to taper towards the center line
    const sign = Math.sign(z) || 1;
    const absZ = Math.abs(z);
    const newAbsZ = absZ * (1 - fraction * taperFactor);
    // Sweep back: pushing the whole section back along Z
    // Assuming +Z is backward (tail direction). We add to Z directly.
    pos.setZ(i, newAbsZ * sign + fraction * sweepFactor);
  }
  geo.computeVertexNormals();
}

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
taperWingGeometry(hawkWingGeo, 0, 5, 0.5, 0.8);

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
taperWingGeometry(seagullWingGeo, 0, 4.75, 0.5, 0.6);
var seagullWingTipGeo = new THREE.BoxGeometry(1.5, 0.11, 1.6);
seagullWingTipGeo.translate(4.0, 0, 0);
taperWingGeometry(seagullWingTipGeo, 0, 4.75, 0.5, 0.6);

var seagullWhiteMat = createMaterial({color: 0xffffff, flatShading: true});
var seagullGreyMat = createMaterial({color: 0xcccccc, flatShading: true});
var seagullBlackMat = createMaterial({color: 0x333333, flatShading: true});
var seagullBeakMat = createMaterial({color: 0xffd54f, flatShading: true});

export function assembleHawk(scale) {
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

export function assembleSeagull(scale) {
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
export var gooseBodyGeo = new THREE.BoxGeometry(1.2, 0.9, 3.5);
export var gooseNeckGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.5, 6);
gooseNeckGeo.rotateX(Math.PI / 2);
gooseNeckGeo.translate(0, 0.5, -2.5);
export var gooseHeadGeo = new THREE.BoxGeometry(0.6, 0.6, 1.2);
gooseHeadGeo.translate(0, 0.5, -4.0);
export var gooseBeakGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
gooseBeakGeo.rotateX(-Math.PI / 2);
gooseBeakGeo.translate(0, 0.5, -4.8);
export var gooseCheekGeo = new THREE.BoxGeometry(0.65, 0.3, 0.5);
gooseCheekGeo.translate(0, 0.4, -4.0);
export var gooseTailGeo = new THREE.BoxGeometry(0.8, 0.4, 1.5);
gooseTailGeo.translate(0, 0.2, 2.0);
export var gooseWhiteTailGeo = new THREE.BoxGeometry(1.0, 0.5, 1.0);
gooseWhiteTailGeo.translate(0, -0.1, 1.5);

export var gooseBrownMat = createMaterial({color: 0x8b7355, flatShading: true});
export var gooseWingGeo = new THREE.BoxGeometry(6, 0.1, 2);
gooseWingGeo.translate(3, 0, 0);
taperWingGeometry(gooseWingGeo, 0, 6, 0.6, 1.0);
// Everything but the wings in one mesh, its parts coloured per vertex: a goose
// is drawn with 3 meshes instead of 9, and flocks fly kilometres away
export var gooseStaticGeo = mergeBufferGeometries(
  [
    [gooseBodyGeo, 0x8b7355],
    [gooseNeckGeo, 0x222222],
    [gooseHeadGeo, 0x222222],
    [gooseBeakGeo, 0x222222],
    [gooseCheekGeo, 0xffffff],
    [gooseWhiteTailGeo, 0xffffff],
    [gooseTailGeo, 0x222222],
  ].map(([geo, hex]) => paintGeometry(geo.clone(), hex))
);
export var gooseStaticMat = createMaterial({
  color: 0xffffff,
  vertexColors: true,
  flatShading: true,
});

// Windmill geometries
// Windmills: Polyfork's Windmill (farm-models.js), the tower and its sails
// about their hub, drawn at 1.5 times these sizes
var windmillGeos = buildWindmillGeos();
export var windmillBaseGeo = windmillGeos.base;
export var windmillBladesGeo = windmillGeos.blades;
// The hub's place on the tower (units, at full size)
export var windmillHub = windmillGeos.hub;
export var windmillBaseMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
});
export var windmillBladesMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
});
// The same, still: for sails knocked off (breakables.js)
export var windmillBladesStillMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.9,
});
export var windmillBladesDepthMat = new THREE.MeshDepthMaterial({
  depthPacking: THREE.RGBADepthPacking,
});

// Lighthouse: Polyfork's Old Lighthouse (polyfork.dev, free licence; the
// model's source is vendored unchanged in third-party/polyfork). Built once at
// load and split by paint into the parts the game treats differently: the
// rock islet stays put when the tower is knocked down, the lantern panes glow
// like our old lamp and the small windows light up with the houses'.
var lighthouseVertexMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
});
// Pale frosted glass by day; game-loop.js lights it up at dusk with the
// streetlights
export var lighthouseLampMat = createMaterial({
  color: 0xd2cfbc,
  emissive: 0xffd98a,
  emissiveIntensity: 0.0,
});
// Lantern centre height in the model's own frame, matched to our old tower
// (the beam and spotlight hang at 63 before the chunk's 2x scale)
const LIGHTHOUSE_LANTERN_Y = 63;
var lighthouseParts = buildPolyforkLighthouse();

// Splits a Polyfork asset's triangles into zones by their exact vertex colour
// (zones: name -> THREE.Color; anything else goes to `rest`), in the asset's
// own frame. Returns arrays of x, y, z, r, g, b per vertex.
function splitPolyforkAsset(asset, zones, rest) {
  asset.updateMatrixWorld(true);
  const key = (c) => c.getHexString();
  const buckets = {[rest]: []};
  const zoneOf = new Map();
  for (const [name, color] of Object.entries(zones)) {
    buckets[name] = [];
    zoneOf.set(key(color), name);
  }
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  asset.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const pos = g.attributes.position;
    const col = g.attributes.color;
    for (let t = 0; t < pos.count; t += 3) {
      c.fromBufferAttribute(col, t);
      const zone = zoneOf.get(key(c)) || rest;
      for (let i = t; i < t + 3; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(col, i);
        buckets[zone].push(v.x, v.y, v.z, c.r, c.g, c.b);
      }
    }
  });
  return buckets;
}

// A zone's arrays as a vertex-coloured geometry, scaled
function polyforkZoneGeo(arr, scale) {
  const n = arr.length / 6;
  const p = new Float32Array(n * 3);
  const cc = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      p[i * 3 + k] = arr[i * 6 + k] * scale;
      cc[i * 3 + k] = arr[i * 6 + 3 + k];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// A Polyfork colour option as resolved by its createAsset (an explicit
// option, else the colourway preset's, else the default)
function polyforkColor(module, S, name) {
  return new THREE.Color(
    S[name] ?? module.presets[S.colorway]?.[name] ?? module.params[name].default
  );
}

function buildPolyforkLighthouse() {
  const S = {
    colorway: 'harbour-red',
    bands: 5,
    jetty: false,
    antenna: false,
  };
  const pick = (name) => polyforkColor(polyforkLighthouse, S, name);
  const buckets = splitPolyforkAsset(
    polyforkLighthouse.createAsset(S),
    {glass: pick('glass'), window: pick('window'), rock: pick('rock')},
    'tower'
  );
  // Scale so the lantern sits where our old one did
  let gy0 = Infinity;
  let gy1 = -Infinity;
  for (let i = 1; i < buckets.glass.length; i += 6) {
    gy0 = Math.min(gy0, buckets.glass[i]);
    gy1 = Math.max(gy1, buckets.glass[i]);
  }
  const scale = LIGHTHOUSE_LANTERN_Y / ((gy0 + gy1) / 2);
  return {
    tower: polyforkZoneGeo(buckets.tower, scale),
    glass: polyforkZoneGeo(buckets.glass, scale),
    window: polyforkZoneGeo(buckets.window, scale),
    rock: polyforkZoneGeo(buckets.rock, scale),
  };
}

// The keeper's cottage: Polyfork's Porch-Front Cottage, white boards and a
// slate roof, about the size of our old 10 x 10 keeper's house. Its windows
// light up with the village houses'.
const KEEPER_COTTAGE_SCALE = 1.6;
var keeperCottageParts = buildKeeperCottage();

function buildKeeperCottage() {
  const S = {colorway: 'slate-white', windows: 2};
  const buckets = splitPolyforkAsset(
    polyforkCottage.createAsset(S),
    {pane: polyforkColor(polyforkCottage, S, 'pane')},
    'body'
  );
  return {
    body: polyforkZoneGeo(buckets.body, KEEPER_COTTAGE_SCALE),
    pane: polyforkZoneGeo(buckets.pane, KEEPER_COTTAGE_SCALE),
  };
}

// A dolphin: Polyfork's Dolphin, a skinned mesh (about 2.5 m long, head
// toward +z, belly at y = 0) with spine bones for swimming. Each call builds
// its own skeleton; `variant` (0 to 1) varies its length and shading a little.
// No shadow: from a leap it made big soft blots on the water.
var dolphinMat = createMaterial({vertexColors: true, flatShading: true});
export function createDolphinModel(variant = 0.5) {
  const asset = createPolyforkDolphin({
    length: 2.3 + variant * 0.5,
    build: 0.3 + variant * 0.4,
    pale: 0.9 + variant * 0.25,
  });
  const bones = {};
  asset.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.material = dolphinMat;
      o.castShadow = false;
    }
    if (o.isBone) bones[o.name] = o;
  });
  return {group: asset, bones};
}

// How many of the lighthouse structure's first parts make up the tower (they
// topple together); the rest are the rock, the keeper's house and the
// flagpole
export const LIGHTHOUSE_TOWER_PARTS = 3;

var flagpoleGeo = new THREE.CylinderGeometry(0.2, 0.2, 20, 4);
var flagGeo = new THREE.BoxGeometry(4, 3, 0.1);

var lighthouseRedMat = createMaterial({color: 0xc62828, flatShading: true});

// Polyfork's pier deck sections (building-models.js), in buildingMat
export var pierDeckGeo = buildPierGeo();
export var pierDeckLGeo = buildPierGeo(true);
export var pierDeckMat = buildingMat;
export var pierPostGeo = new THREE.CylinderGeometry(1, 1, 10, 6);
export var woodMat = createMaterial({color: 0x5d4037, flatShading: true});

// Bridge geometries (for West Coast Highway elevated viaducts)
export var BRIDGE_SEGMENT_LENGTH = 30; // Z-length of each road/bridge segment

// 1. Road deck: thin 1.5-unit slab (used for all road segments, keeping ground roads paper-thin)
export var bridgeDeckGeo = new THREE.BoxGeometry(
  ChillFlightLogic.ROAD_WIDTH * 2 + 4,
  1.5, // Deck thickness
  BRIDGE_SEGMENT_LENGTH
);

// Lane markings, laid just above the deck's top and stretched with it.
// Heartland highways get white edge lines, dashed lane lines (two lanes
// each way) and a double yellow centre line; further out, only a dashed
// yellow centre line (terrain-chunks.js picks by latitude).
function roadStripes(stripes) {
  return mergeGeometries(
    stripes.map(([x, width, length]) => {
      const g = new THREE.PlaneGeometry(width, length);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0.8, 0);
      return g;
    })
  );
}
const LANE_LINE_X = ChillFlightLogic.ROAD_WIDTH / 2;
// The edge lines are one stripe down the middle, set out to each edge by
// terrain-chunks.js, which leaves one out where a slip road joins
export const ROAD_EDGE_LINE_X = ChillFlightLogic.ROAD_WIDTH - 1.5;
export var roadEdgeLineGeo = roadStripes([[0, 0.7, BRIDGE_SEGMENT_LENGTH]]);
export var roadLaneDashesGeo = roadStripes([
  [-LANE_LINE_X, 0.5, 12],
  [LANE_LINE_X, 0.5, 12],
]);
export var roadCentreLinesGeo = roadStripes([
  [-0.6, 0.45, BRIDGE_SEGMENT_LENGTH],
  [0.6, 0.45, BRIDGE_SEGMENT_LENGTH],
]);
export var roadCentreDashGeo = roadStripes([[0, 0.5, 12]]);
// A slip road's white edge lines, set out the same way (terrain-chunks.js
// scales its deck down from the highway's, but not these)
export const SLIP_EDGE_LINE_X = ChillFlightLogic.SLIP.HALF - 1.2;
export var roadSlipLineGeo = roadStripes([[0, 0.6, BRIDGE_SEGMENT_LENGTH]]);
const markingParams = {
  color: 0xffffff,
  flatShading: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
};
// White, coloured per piece (ROAD_PAINT) so markings weather with the road
// and fade smoothly into the deck where they end (and buried by settling
// snow along with the decks: addRoadSnow)
export var roadWhiteMat = addRoadSnow(
  addHeadlightPool(createMaterial(markingParams), 2.2)
);
export var roadYellowMat = roadWhiteMat;
export var ROAD_PAINT = {
  white: new THREE.Color(0xf2f0e6),
  yellow: new THREE.Color(0xe8c24a),
};

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
export var bridgeGirderGeo = createBridgeGirderGeometry();

// 3. Modern parapet railings for bridge spans
export var bridgeRailGeo = new THREE.BoxGeometry(
  1.2,
  2.6,
  BRIDGE_SEGMENT_LENGTH
);

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
export var bridgePierCapGeo = createBridgePierCapGeometry();

// 5. Faceted octagonal pylon shaft (scalable Y)
function createBridgePierShaftGeometry() {
  // Octagonal column, width 10, depth 8, height 1.0 (from Y=0 down to Y=-1)
  const geo = new THREE.CylinderGeometry(1, 1, 1, 8);
  geo.scale(5.0, 1, 4.0);
  geo.translate(0, -0.5, 0); // Origin at top so scaling Y stretches downward
  geo.computeVertexNormals();
  return geo;
}
export var bridgePierShaftGeo = createBridgePierShaftGeometry();

// 6. Foundation caisson footing (anchors pier into terrain/water)
function createBridgePierFootingGeometry() {
  const geo = new THREE.CylinderGeometry(1, 1, 4.5, 8);
  geo.scale(7.5, 1, 6.5); // Width 15, depth 13, height 4.5
  geo.computeVertexNormals();
  return geo;
}
export var bridgePierFootingGeo = createBridgePierFootingGeometry();

// Expose geometries for debug model viewer and global access
if (typeof window !== 'undefined') {
  window.bridgeGirderGeo = bridgeGirderGeo;
  window.bridgePierCapGeo = bridgePierCapGeo;
  window.bridgePierShaftGeo = bridgePierShaftGeo;
  window.bridgePierFootingGeo = bridgePierFootingGeo;
}

export var bridgeDeckMat = addRoadSnow(
  addHeadlightPool(createMaterial({color: 0x4a4a4a, flatShading: true}), 2.2)
); // Asphalt gray
// The highways' and slip roads' decks: white, so each segment's instance
// colour sets its asphalt, weathered by the biome (terrain-chunks.js)
// (and snow settles on them while it snows: addRoadSnow)
export var highwayDeckMat = addRoadSnow(
  addHeadlightPool(createMaterial({color: 0xffffff, flatShading: true}), 2.2)
);
// (Colours made while the module loads are converted from sRGB, as the
// heartland asphalt's is; the much lighter dusty and snowy ones are taken
// as they are, the way the prototypes looked)
export var ROAD_ASPHALT = {
  base: new THREE.Color(0x4a4a4a),
  dust: new THREE.Color().setHex(0x6f665a, THREE.LinearSRGBColorSpace), // Sun-bleached, sand-dusted
  snow: new THREE.Color().setHex(0x8d939b, THREE.LinearSRGBColorSpace), // Snow-dusted pale grey
  alien: new THREE.Color(0x504658), // A faint purple-grey
  dirt: new THREE.Color().setHex(0xa88c64, THREE.LinearSRGBColorSpace), // Packed desert dirt
};
// The highways' railings: white, coloured per piece like the decks. Grey
// concrete, sun-bleached to sandstone in the desert and frosted in the north.
export var highwayRailMat = createMaterial({
  color: 0xffffff,
  flatShading: true,
});
export var ROAD_RAIL = {
  base: new THREE.Color(0x626262),
  dust: new THREE.Color().setHex(0xb39d7c, THREE.LinearSRGBColorSpace),
  snow: new THREE.Color().setHex(0xa3a8ae, THREE.LinearSRGBColorSpace),
  alien: new THREE.Color(0x665a70),
};
// A town street's slab of asphalt (a unit box, scaled to each piece)
export var townStreetGeo = new THREE.BoxGeometry(1, 1, 1);
export var bridgePilingMat = createMaterial({
  color: 0x626262,
  flatShading: true,
}); // Concrete gray
export var bridgeGirderMat = createMaterial({
  color: 0x555555,
  flatShading: true,
}); // Girder concrete gray
if (typeof window !== 'undefined') {
  window.bridgeGirderMat = bridgeGirderMat;
}

// Streetlight geometries
export var streetlightPoleGeo = new THREE.CylinderGeometry(0.5, 0.8, 25, 6);
streetlightPoleGeo.translate(0, 12.5, 0); // Origin at base
export var streetlightArmGeo = new THREE.CylinderGeometry(0.3, 0.5, 18, 6);
streetlightArmGeo.rotateZ(Math.PI / 2);
streetlightArmGeo.translate(8.5, 24, 0);
export var streetlightBulbGeo = new THREE.BoxGeometry(1.5, 0.5, 1);
streetlightBulbGeo.translate(17, 23.8, 0);

export var streetlightPoleMat = createMaterial({
  color: 0x222222,
  flatShading: true,
});
export const streetlightBulbMat = createMaterial({
  color: 0xffffff,
  emissive: 0xffeebb,
  emissiveIntensity: 2.0,
  flatShading: true,
});

// Streetlight Decal
export var streetlightDecalGeo = new THREE.PlaneGeometry(40, 40);
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
export const streetlightDecalMat = new THREE.MeshBasicMaterial({
  map: decalTex,
  transparent: true,
  opacity: 1.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
// Pools of light on the ground fade out near the edge of the render radius.
// flicker: the pool breathes like firelight, each at its own phase.
function decalFade(shader, flicker) {
  if (terrainUniforms) {
    shader.uniforms.uCameraPosXZ = terrainUniforms.uCameraPosXZ;
    shader.uniforms.uRenderRadius = terrainUniforms.uRenderRadius;
  }
  shader.vertexShader =
    `
    uniform vec2 uCameraPosXZ;
    varying float vDistanceXZ;
  ` + shader.vertexShader;
  if (flicker) {
    shader.uniforms.uTime = animationUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       varying float vFlicker;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
       float phase = instanceMatrix[3][0] + instanceMatrix[3][2];
       #else
       float phase = 0.0;
       #endif
       vFlicker = 0.85 + 0.1 * sin(uTime * 7.0 + phase)
         + 0.05 * sin(uTime * 17.0 + phase * 1.7);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying float vFlicker;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <fog_fragment>',
      `#include <fog_fragment>
       gl_FragColor.rgb *= vFlicker;`
    );
  }
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
       gl_FragColor.a *= (1.0 - smoothstep(0.9, 0.99, distRatio));
     }`
  );
}
streetlightDecalMat.onBeforeCompile = (shader) => decalFade(shader, false);

// Tents (Polyfork's Camp Tent, building-models.js): one vertex-coloured
// geometry per colour, all drawn in buildingMat
export var tentGeos = buildTentGeos();
export var tentMat = buildingMat;

// Campfire geometries (crossed logs + faceted multi-tongue flame cluster)
export var fireLogGeo = new THREE.CylinderGeometry(0.68, 0.72, 6, 6);
fireLogGeo.rotateZ(Math.PI / 2);

function createCampfireCoreGeometry() {
  const flames = [
    // [radius, height, x, y, z, rx, rz]
    [1.15, 2.9, 0.0, 0.85, 0.0, 0.06, -0.05],
    [0.88, 2.2, -0.62, 0.55, 0.38, -0.18, 0.24],
    [0.85, 2.1, 0.65, 0.52, 0.32, -0.15, -0.25],
    [0.82, 2.0, 0.05, 0.5, -0.62, 0.24, 0.08],
  ];
  const pos = [],
    norm = [],
    idx = [];
  let offset = 0;
  for (const [r, h, x, y, z, rx, rz] of flames) {
    const g = new THREE.ConeGeometry(r, h, 5);
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(x, y, z);
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
export var fireCoreGeo = createCampfireCoreGeometry();
export var fireMat = createMaterial({
  color: 0xff4500,
  emissive: 0xff4500,
  emissiveIntensity: 2.0,
});
// At night a campfire throws a warm, flickering pool of light on the ground
// around it: a soft decal added over the ground (no real light, so it costs
// one draw per chunk with campfires). The game loop fades it in after dusk.
var fireGlowCanvas = document.createElement('canvas');
fireGlowCanvas.width = 128;
fireGlowCanvas.height = 128;
var fireGlowCtx = fireGlowCanvas.getContext('2d');
var fireGlowGradient = fireGlowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
fireGlowGradient.addColorStop(0, 'rgba(255, 150, 60, 0.7)');
fireGlowGradient.addColorStop(0.25, 'rgba(220, 100, 35, 0.4)');
fireGlowGradient.addColorStop(0.6, 'rgba(120, 50, 15, 0.14)');
fireGlowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
fireGlowCtx.fillStyle = fireGlowGradient;
fireGlowCtx.fillRect(0, 0, 128, 128);
export const fireGlowMat = new THREE.MeshBasicMaterial({
  map: new THREE.CanvasTexture(fireGlowCanvas),
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
fireGlowMat.onBeforeCompile = (shader) => decalFade(shader, true);

// Smoke geometry and material community
export var smokeGeo = new THREE.BoxGeometry(2, 2, 2);
export var smokeMat = createMaterial({
  color: 0x888888,
  transparent: true,
  opacity: 0.4,
  flatShading: true,
});

export var whiteSmokeMat = createMaterial({
  color: 0xdddddd,
  transparent: true,
  opacity: 0.6,
  flatShading: true,
});

// --- GPU ANIMATION SHADER INJECTIONS ---
export const animationUniforms = {uTime: {value: 0}};

// Trees sway in the wind: canopies lean downwind in slow, uneven gusts, more
// in overcast weather (uWindStrength, set by the game loop). The sway grows
// with height above the trunk top, so trunks stay put, and each tree has its
// own phase. The wind blows one way across the world: the offset is turned
// into each instance's rotated, scaled space. Shadows don't sway.
export const windUniforms = {uWindStrength: {value: 1}};
// The direction the wind blows toward (WIND_DIR_X, WIND_DIR_Z in
// terrain-gen.js, which also turns the windmills into it)
export const WIND_DIR_GLSL = `normalize(vec3(${WIND_DIR_X.toFixed(1)}, 0.0, ${WIND_DIR_Z.toFixed(1)}))`;
export {WINDMILL_ROT_Y};

function addWindSway(material, {bendStart, bendPerUnit}) {
  const base = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.uTime = animationUniforms.uTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uTime;
       uniform float uWindStrength;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
         mat3 treeBasis = mat3(instanceMatrix);
         vec2 treePos = instanceMatrix[3].xz;
       #else
         mat3 treeBasis = mat3(1.0);
         vec2 treePos = vec2(0.0);
       #endif
       float swayPhase = dot(treePos, vec2(0.013, 0.017));
       float gust = 0.55 + 0.45 * sin(uTime * 0.31 + treePos.x * 0.0021 + treePos.y * 0.0013);
       float sway = (0.6 + sin(uTime * 1.25 + swayPhase) + 0.3 * sin(uTime * 2.7 + swayPhase * 1.7))
                  * gust * uWindStrength;
       float bend = max(transformed.y - ${bendStart.toFixed(1)}, 0.0) * ${bendPerUnit.toFixed(4)};
       // World-space offset, in this instance's space (rotation and uniform scale).
       vec3 swayWorld = ${WIND_DIR_GLSL} * sway * bend;
       transformed += transpose(treeBasis) * swayWorld / max(dot(treeBasis[0], treeBasis[0]), 1e-4);`
    );
  };
  material.customProgramCacheKey = () => 'windSway';
}

// Canopies start ~4 units up (pines lower, but their trunks are short).
addWindSway(treeLeavesBaseMat, {bendStart: 4, bendPerUnit: 0.08});

windmillBladesMat.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = animationUniforms.uTime;
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
  shader.uniforms.uTime = animationUniforms.uTime;
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
  shader.uniforms.uTime = animationUniforms.uTime;
  shader.uniforms.uWindStrength = windUniforms.uWindStrength;
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>\nuniform float uTime;\nuniform float uWindStrength;\nvarying float vFade;`
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
        // A little wander of its own, but mostly carried downwind, the
        // same way as the trees lean and the clouds drift
        float driftX = cos(particleAngle) * offsetTime * ${isChimney ? '4.0' : '5.0'} + swayX;
        float driftZ = sin(particleAngle) * offsetTime * ${isChimney ? '4.0' : '5.0'} + swayZ;
        #ifdef USE_INSTANCING
          mat3 smokeBasis = mat3(instanceMatrix);
        #else
          mat3 smokeBasis = mat3(1.0);
        #endif
        vec3 smokeWind = transpose(smokeBasis) * (${WIND_DIR_GLSL} *
          offsetTime * ${isChimney ? '13.0' : '15.0'} * uWindStrength) /
          max(dot(smokeBasis[0], smokeBasis[0]), 1e-4);
        driftX += smokeWind.x;
        driftZ += smokeWind.z;
        
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
    // Puffs fade out right by the camera: flying or looking through one
    // would otherwise fill the screen with a flat see-through box
    `#include <color_fragment>
    diffuseColor.a *= vFade * smoothstep(6.0, 30.0, length(vViewPosition));`
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
export var boatHullGeo = createBoatHullBaseGeometry();
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
export var boatRimGeo = createBoatRimGeometry();
boatRimGeo.translate(0, 1.7, 0);
// The rim with a ring of foam merged in round the hull (3.6 wide, z -8 to
// 4) where it meets the water, both white, so the boat sits in the water
// rather than over its shadow in clear shallows. Drawn in the rim's mesh,
// so it bobs with the boat (boat units, 1.8 times smaller than the world).
export var boatRimFoamGeo = (() => {
  const rim = boatRimGeo.toNonIndexed();
  const pos = Array.from(rim.attributes.position.array).concat(
    foamRing(1.8, -8, 4, 0.07, 0.5)
  );
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
})();

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

  // Low cabin trunk / coaming ahead of the cockpit
  const cabin = new THREE.BoxGeometry(1.9, 0.55, 3.2);
  cabin.translate(0, 0.28, -1.8);
  const cabPos = cabin.attributes.position.array;
  for (let i = 0; i < cabPos.length; i += 3) {
    if (cabPos[i + 2] < -2.5) cabPos[i] *= 0.65;
  }
  cabin.computeVertexNormals();

  const geos = [main, prow, cabin];
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
export var boatDeckGeo = createBoatDeckGeometry();
boatDeckGeo.translate(0, 1.91, 0); // slightly above the white rim (1.7 + 0.2)

export var boatMastGeo = new THREE.CylinderGeometry(0.14, 0.18, 12.6, 6);
boatMastGeo.translate(0, 6.3, -1);
export var boatBoomGeo = new THREE.CylinderGeometry(0.1, 0.1, 6.6, 6);
boatBoomGeo.rotateX(Math.PI / 2);
boatBoomGeo.translate(0, 2.7, 2.3);

function createBoatSailGeometry() {
  // Billowed triangular mainsail (behind mast) + forward jib sail (ahead of mast)
  const buildTriSail = (zLuff, zFoot, yFoot, yHead, billowX) => {
    const rows = 5;
    const cols = 4;
    const pos = [];
    const idx = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows; // 0 at foot, 1 at head
      const y = yFoot + v * (yHead - yFoot);
      const zEnd = zLuff + (1 - v) * (zFoot - zLuff);
      for (let c = 0; c <= cols; c++) {
        const u = c / cols; // 0 at luff, 1 at leech
        const z = zLuff + u * (zEnd - zLuff);
        const camber =
          Math.sin(u * Math.PI) * Math.sin((1 - v * 0.65) * Math.PI) * billowX;
        pos.push(camber, y, z);
      }
    }
    const stride = cols + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i0 = r * stride + c;
        const i1 = i0 + 1;
        const i2 = i0 + stride;
        const i3 = i2 + 1;
        idx.push(i0, i1, i2, i1, i3, i2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  const mainSail = buildTriSail(-0.85, 5.4, 2.8, 12.1, 0.65);
  const jibSail = buildTriSail(-1.25, -7.4, 2.4, 10.6, 0.48);

  const pos = [
    ...mainSail.attributes.position.array,
    ...jibSail.attributes.position.array,
  ];
  const norm = [
    ...mainSail.attributes.normal.array,
    ...jibSail.attributes.normal.array,
  ];
  const idx = [...mainSail.index.array];
  const offset = mainSail.attributes.position.count;
  for (let i = 0; i < jibSail.index.array.length; i++) {
    idx.push(jibSail.index.array[i] + offset);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  geom.setIndex(idx);
  return geom;
}
export var boatSailGeo = createBoatSailGeometry();

// A steady hash of a boat's index in its chunk, so its drift and look stay
// the same frame to frame (flight-camera.js animates boats with it)
export function boatHash(index, seed) {
  const val = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return val - Math.floor(val);
}

// About one sailboat in five is moored: it never drifts, and its sails are
// down, flaked along the boom (#163). Picked by where the boat is in the
// world (x, z), since a boat's index in its chunk is rarely above 2.
export function sailboatMoored(x, z) {
  return boatHash(Math.round(x) * 0.0731 + Math.round(z) * 0.0419, 3) >= 0.8;
}

// The sails of a moored boat, multiplied after the boat's matrix: squashed
// flat down to just above the boom (y 2.7) and drawn in toward it along the
// boat, so the jib bundles onto the cabin roof instead of reaching the bow
const SAIL_FURL_Y = 2.75;
const SAIL_FURL_Z = 2.3;
export const SAIL_FURL = new THREE.Matrix4()
  .makeTranslation(0, SAIL_FURL_Y, SAIL_FURL_Z)
  .multiply(new THREE.Matrix4().makeScale(0.6, 0.06, 0.55))
  .multiply(new THREE.Matrix4().makeTranslation(0, -SAIL_FURL_Y, -SAIL_FURL_Z));

export var boatHullPalette = [
  createMaterial({color: 0xaa0000, flatShading: true}), // Dark Red
  createMaterial({color: 0x004400, flatShading: true}), // Dark Green
  createMaterial({color: 0x000055, flatShading: true}), // Dark Blue
];
export var boatRimMat = createMaterial({color: 0xffffff, flatShading: true});
export var boatDeckMat = createMaterial({color: 0xd2b48c, flatShading: true});
export var boatSailMat = createMaterial({
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

// Crystal cluster (western alien land): six-sided prisms with pointed tips,
// a tall one in the middle and shorter ones leaning out around it
// The spires of a crystal cluster: [height, radius, lean (radians),
// direction (radians), offset out from the middle]
export const CRYSTAL_SPIRES = [
  [20, 2.2, 0, 0, 0],
  [13, 1.6, 0.45, 0.3, 2.2],
  [10, 1.4, 0.55, 2.2, 2.0],
  [15, 1.8, 0.35, 4.1, 2.4],
  [7, 1.1, 0.7, 5.3, 2.6],
];
// One spire (prism and tip) where it stands in the cluster
function createCrystalSpireGeometry([h, r, lean, dir, off]) {
  const prism = new THREE.CylinderGeometry(r, r * 1.15, h, 6);
  prism.translate(0, h / 2, 0);
  const tip = new THREE.ConeGeometry(r, r * 2.4, 6);
  tip.translate(0, h + r * 1.2, 0);
  const g = mergeGeometries([prism, tip]);
  g.rotateZ(-lean);
  g.rotateY(dir);
  g.translate(Math.cos(dir) * off, 0, -Math.sin(dir) * off);
  return g;
}
// Each spire by itself, for a cluster shattering (breakables.js)
export var crystalSpireGeos = CRYSTAL_SPIRES.map(createCrystalSpireGeometry);
function createCrystalClusterGeometry() {
  return mergeGeometries(crystalSpireGeos);
}
export var crystalClusterGeo = createCrystalClusterGeometry();
// White, so each cluster's instance colour shows; a faint glow keeps the
// shaded sides from going dark
export var crystalMat = createMaterial({
  color: 0xffffff,
  emissive: 0x2a0a24,
  flatShading: true,
});
// A shard of a shattered crystal: a long thin diamond, unlit so it glows
// its cluster's colour (instance colour), day or night
export var crystalShardGeo = new THREE.OctahedronGeometry(1, 0).scale(
  0.45,
  1.4,
  0.45
);
export var crystalShardMat = new THREE.MeshBasicMaterial({color: 0xffffff});

// Pirate ships: Polyfork's ghost galleon, one geometry per look
// (boat-models.js), indexed by a ship's bodyId, each with a
// ring of foam at its waterline. Their water reflections are the same
// geometries without the foam, flipped, in reflectionMat.
const GHOST_SHIP_GLOW = 0x6fe3cf;
export var pirateShipReflectionGeos = buildPirateShipGeos();
export var pirateShipGeos = pirateShipReflectionGeos.map((geo) =>
  withFoam(geo, 0.8)
);
// Its own copy of the boats' material, glowing a faint sea green after
// dark (flight-camera.js turns the glow up with the night)
export var pirateShipMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
  emissive: GHOST_SHIP_GLOW,
  emissiveIntensity: 0,
});

export var reflectionMat = new THREE.MeshBasicMaterial({
  color: 0x07151e,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  // Without this, three.js draws transparent double-sided meshes in two
  // passes and flags the material changed before each, re-deriving its shader
  // program on every draw (~100x per frame here). One flat color blends the
  // same in any order, so a single pass looks identical.
  forceSinglePass: true,
  // The art styles' post pass inks depth breaks; a see-through
  // reflection shouldn't draw them
  depthWrite: !ART_POST,
});

export var sailboatReflectionGeo = mergeGeometries([
  boatHullGeo,
  boatRimGeo,
  boatDeckGeo,
  boatMastGeo,
  boatBoomGeo,
  boatSailGeo,
]);

// The same for a moored boat, sails down
export var sailboatMooredReflectionGeo = mergeGeometries([
  boatHullGeo,
  boatRimGeo,
  boatDeckGeo,
  boatMastGeo,
  boatBoomGeo,
  boatSailGeo.clone().applyMatrix4(SAIL_FURL),
]);

// Lighthouse Beam geometry - wider and longer
export var lighthouseBeamGeo = new THREE.CylinderGeometry(
  40,
  2,
  500,
  16,
  1,
  true
);
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

export var lighthouseBeamMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  opacity: LIGHTHOUSE_BEAM_OPACITY_MAX,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  depthWrite: false,
});

// The headland lighthouses' beams (Montauk's has the persistent one and the
// spotlight): their own material, faded by flight-camera.js
export var lighthouseHeadlandBeamMat = lighthouseBeamMat.clone();

export var persistentLighthouseLight = null;
export var persistentLighthouseBeam = null;

export function initLighthouse() {
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
}

// --- VOLCANO ACTIVE ELEMENTS (pre-allocated, shared via ModelAssembler) ---
var volcanoLavaGeo = new THREE.CylinderGeometry(60, 60, 15, 16);
var volcanoLavaMat = new THREE.MeshBasicMaterial({color: 0xff4500});

// --- MODEL ASSEMBLER: SINGLE SOURCE OF TRUTH ---
// This object defines how complex multi-part models are constructed.
// Both terrain.js (during world gen) and debug/debug-models.html (during preview)
// use this to ensure they stay in perfect sync.
export const ModelAssembler = {
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
            mat: streetlightBulbMat,
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
      case 'barn': {
        const siloOffset = new THREE.Vector3(12, 0, 0).applyAxisAngle(
          yAxis,
          rotY
        );

        return [
          {geo: barnBodyGeo, mat: barnMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
          {geo: barnRoofGeo, mat: barnMat, pos: [0, 0, 0], rot: [0, rotY, 0]},
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
        const hub = windmillHub.clone().applyAxisAngle(yAxis, rotY);
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
            pos: [hub.x, hub.y, hub.z],
            rot: [0, rotY, 0],
            scale: [1.5, 1.5, 1.5],
          },
        ];
      }
      case 'lighthouse': {
        // Keeper's house and flagpole stand clear of the rock islet
        const houseOffset = new THREE.Vector3(26, 0, 0).applyAxisAngle(
          yAxis,
          rotY
        );
        const flagpoleOffset = new THREE.Vector3(-20, 0, 16).applyAxisAngle(
          yAxis,
          rotY
        );
        const at = [0, 0, 0];
        const rot = [0, rotY, 0];
        return [
          // Tower (LIGHTHOUSE_TOWER_PARTS)
          {geo: lighthouseParts.tower, mat: lighthouseVertexMat, pos: at, rot},
          {geo: lighthouseParts.glass, mat: lighthouseLampMat, pos: at, rot},
          {geo: lighthouseParts.window, mat: houseWindowMats[0], pos: at, rot},
          // Rock islet
          {geo: lighthouseParts.rock, mat: lighthouseVertexMat, pos: at, rot},
          // Keeper's cottage, door toward the tower
          {
            geo: keeperCottageParts.body,
            mat: lighthouseVertexMat,
            pos: [houseOffset.x, 0, houseOffset.z],
            rot: [0, rotY - Math.PI / 2, 0],
          },
          {
            geo: keeperCottageParts.pane,
            mat: houseWindowMats[1],
            pos: [houseOffset.x, 0, houseOffset.z],
            rot: [0, rotY - Math.PI / 2, 0],
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
            geo: gooseStaticGeo,
            mat: gooseStaticMat,
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
      case 'pirateship':
        return [
          {
            geo: pirateShipGeos[(opts.bodyId || 0) % PIRATE_SHIP_LOOKS],
            mat: pirateShipMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      case 'volcano_active_elements':
        return [
          {
            geo: volcanoLavaGeo,
            mat: volcanoLavaMat,
            pos: [0, 0, 0],
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
            geo: penguinGeo,
            mat: penguinMat,
            pos: [0, 0, 0],
            rot: [0, rotY, 0],
          },
        ];
      default:
        return null;
    }
  },
};

export function getBiome(x, z) {
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

export function clearElevationCache() {
  _elevCacheValid.fill(0);
}

var _ELEV_PARAMS = {
  WATER_LEVEL,
  MOUNTAIN_LEVEL,
  MAP_WORLD_SIZE,
  MAP_HEIGHT_SCALE,
};

export function getElevation(x, z) {
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

  const n = ChillFlightLogic.getElevation(
    x,
    z,
    simplex,
    _ELEV_PARAMS,
    THREE.MathUtils.lerp
  );

  _elevCacheKeyX[slot] = qx;
  _elevCacheKeyZ[slot] = qz;
  _elevCacheVal[slot] = n;
  _elevCacheValid[slot] = 1;

  return n;
}

// The ground as drawn, rather than the elevation noise it's built from: the
// terrain mesh is a PlaneGeometry grid of getElevation samples (CHUNK_SIZE /
// state.SEGMENTS apart) split into triangles along the same diagonal, and
// between samples the noise can be several units off the flat triangles. For
// planes landing on their wheels (flight-physics.js). Fills out.height and
// out.slopeX / out.slopeZ (rise per unit along x and z).
export function sampleGround(x, z, out) {
  const step = CHUNK_SIZE / state.SEGMENTS;
  const half = CHUNK_SIZE / 2;
  const gx = (x + half) / step;
  const gz = (z + half) / step;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const u = gx - ix;
  const v = gz - iz;
  const x0 = ix * step - half;
  const z0 = iz * step - half;
  // Corners: a (x0, z0), b (x0, z1), c (x1, z1), d (x1, z0); triangles abd
  // and bcd, split along b-d
  const a = getElevation(x0, z0);
  const b = getElevation(x0, z0 + step);
  const c = getElevation(x0 + step, z0 + step);
  const d = getElevation(x0 + step, z0);
  if (u + v <= 1) {
    out.height = a + (d - a) * u + (b - a) * v;
    out.slopeX = (d - a) / step;
    out.slopeZ = (b - a) / step;
  } else {
    out.height = c + (b - c) * (1 - u) + (d - c) * (1 - v);
    out.slopeX = (c - b) / step;
    out.slopeZ = (c - d) / step;
  }
  return out;
}
