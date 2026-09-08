// --- CONSTANTS ---
// Terrain parameters
const CHUNK_SIZE = 1500;
let SEGMENTS = 40;
const WATER_LEVEL = 40;
const MOUNTAIN_LEVEL = 180;
let RENDER_DISTANCE = 2;
const CLOUD_OPACITY = 0.55;
const PROP_LOD_DISTANCE = 4200;
window.PROP_LOD_DISTANCE = PROP_LOD_DISTANCE;

// Lighthouse parameters
const LIGHTHOUSE_LIGHT_INTENSITY = 3.5;
const LIGHTHOUSE_BEAM_OPACITY_MIN = 0.08;
const LIGHTHOUSE_BEAM_OPACITY_MAX = 0.25;

// Custom Map Parameters
const MAP_WORLD_SIZE = 10000 * ChillFlightLogic.SCALE;
const MAP_HEIGHT_SCALE = 400;

// Flight parameters
const BASE_FLIGHT_SPEED = 2.5;
const MAX_AIRPLANE_SPEED_KTS = 500;
const MAX_FLIGHT_SPEED_MULT = MAX_AIRPLANE_SPEED_KTS / (BASE_FLIGHT_SPEED * 60);
window.MAX_AIRPLANE_SPEED_KTS = MAX_AIRPLANE_SPEED_KTS;
window.MAX_FLIGHT_SPEED_MULT = MAX_FLIGHT_SPEED_MULT;
const TURN_SPEED = 0.03;
let flightSpeedMultiplier = 1.0;

// Feature Flags
const ENABLE_PAGODAS = false;
const ENABLE_BARNS = true;
const ENABLE_MONASTERIES = true;
const ENABLE_CASTLE_RUINS = true;
const ENABLE_LIGHTHOUSES = false;

const THEME = ChillFlightLogic.THEME;

function createMaterial(params) {
  // Make a copy of params to avoid mutating the original
  const newParams = {...params};

  let mat;
  switch (THEME) {
    case 'toon':
      delete newParams.roughness;
      delete newParams.metalness;
      delete newParams.envMap;
      delete newParams.envMapIntensity;
      mat = new THREE.MeshToonMaterial(newParams);
      break;
    case 'basic':
      delete newParams.roughness;
      delete newParams.metalness;
      mat = new THREE.MeshBasicMaterial(newParams);
      break;
    case 'phong':
      delete newParams.roughness;
      delete newParams.metalness;
      newParams.shininess = 60;
      mat = new THREE.MeshPhongMaterial(newParams);
      break;
    case 'lambert':
      delete newParams.roughness;
      delete newParams.metalness;
      mat = new THREE.MeshLambertMaterial(newParams);
      break;
    case 'normal':
      mat = new THREE.MeshNormalMaterial({flatShading: params.flatShading});
      break;
    case 'wireframe':
      newParams.wireframe = true;
      mat = new THREE.MeshBasicMaterial(newParams);
      break;
    case 'standard':
    default:
      mat = new THREE.MeshStandardMaterial(newParams);
      break;
  }

  // Inject universal directional fog into all generated materials
  mat.onBeforeCompile = (shader) => {
    if (window.terrainUniforms) {
      shader.uniforms.uCameraPosXZ = window.terrainUniforms.uCameraPosXZ;
      shader.uniforms.uRenderRadius = window.terrainUniforms.uRenderRadius;
      shader.uniforms.uSunDirection = window.terrainUniforms.uSunDirection;
      shader.uniforms.uTopColor = window.terrainUniforms.uTopColor;
      shader.uniforms.uBottomColor = window.terrainUniforms.uBottomColor;
    }

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
       vec4 customWorldPosition = vec4( transformed, 1.0 );
       #ifdef USE_INSTANCING
         customWorldPosition = instanceMatrix * customWorldPosition;
       #endif
       customWorldPosition = modelMatrix * customWorldPosition;
       #ifdef USE_FOG
         vDistanceXZ = length(customWorldPosition.xz - uCameraPosXZ);
         vWorldPosition = customWorldPosition.xyz;
       #endif`
    );

    shader.fragmentShader =
      `
      uniform vec3 uSunDirection;
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform float uRenderRadius;
      varying float vDistanceXZ;
      varying vec3 vWorldPosition;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <fog_fragment>`,
      `#ifdef USE_FOG
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
             float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
         #else
             float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
         #endif
         
         float finalFogFactor = fogFactor;
         if (uRenderRadius > 0.0) {
             float distRatio = vDistanceXZ / uRenderRadius;
             float xzFogFactor = smoothstep(0.75, 0.95, distRatio);
             finalFogFactor = max(fogFactor, xzFogFactor);
         }
         
         gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, finalFogFactor);
       #endif`
    );
  };

  return mat;
}

// Variables shared between airplane.js and game.js that need early declaration to avoid TDZ errors in the production bundle
let targetFlightSpeed = flightSpeedMultiplier;
let verticalVelocity = 0;
