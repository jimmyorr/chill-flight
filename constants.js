// --- CONSTANTS ---
// Terrain parameters
const CHUNK_SIZE = 1500;
let SEGMENTS = 40;
const WATER_LEVEL = 40;
const MOUNTAIN_LEVEL = 180;
let RENDER_DISTANCE = 2;
const CLOUD_OPACITY = 0.55;

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
const MAX_BANK_BOAT = (30 * Math.PI) / 180;
const MAX_BANK_HELI = (45 * Math.PI) / 180;
// Initial vehicle-aware speed calculation
const savedInitVehicle =
  localStorage.getItem('chill_flight_vehicle') || 'airplane';
const INITIAL_SPEED =
  savedInitVehicle === 'helicopter'
    ? 100 / 150
    : savedInitVehicle === 'boat'
      ? 25 / 150
      : 1;

let flightSpeedMultiplier = INITIAL_SPEED;

// Feature Flags
const ENABLE_PAGODAS = false;
const ENABLE_BARNS = true;
const ENABLE_MONASTERIES = true;
const ENABLE_CASTLE_RUINS = true;
const ENABLE_LIGHTHOUSES = false;
const ENABLE_VEHICLE_SWITCH = ChillFlightLogic.ENABLE_V;

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
       #if !defined( USE_ENVMAP ) && !defined( DISTANCE ) && !defined ( USE_SHADOWMAP ) && !defined ( USE_TRANSMISSION )
         vec4 worldPosition = vec4( transformed, 1.0 );
         #ifdef USE_INSTANCING
           worldPosition = instanceMatrix * worldPosition;
         #endif
         worldPosition = modelMatrix * worldPosition;
       #endif
       #ifdef USE_FOG
         vDistanceXZ = length(worldPosition.xz - uCameraPosXZ);
         vWorldPosition = worldPosition.xyz;
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
         vec3 effBottom = mix(uTopColor * 0.7, uBottomColor, g * 0.9 + 0.1);
         vec3 fogSkyColor = mix(effBottom, uTopColor, max(pow(max(hFog, 0.0), 0.6), 0.0));
         if (hFog < 0.0) fogSkyColor = effBottom;
         
         vec3 wideGlow = uBottomColor * pow(baseSunInt, 6.0) * 0.6 * (1.0 - hFog);
         vec3 warmHalo = vec3(1.0, 0.6, 0.1) * pow(baseSunInt, 24.0) * 0.8;
         vec3 hotCore = vec3(1.0, 0.95, 0.8) * pow(baseSunInt, 512.0) * 2.5;
         vec3 totalGlow = (wideGlow + warmHalo + hotCore) * sunFade * clamp(hFog * 10.0 + 1.0, 0.0, 1.0);
         fogSkyColor = fogSkyColor + totalGlow * (vec3(1.0) - fogSkyColor);
         
         #ifdef FOG_EXP2
             float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );
         #else
             float fogFactor = smoothstep( fogNear, fogFar, fogDepth );
         #endif
         
         float finalFogFactor = fogFactor;
         if (uRenderRadius > 0.0) {
             float distRatio = vDistanceXZ / uRenderRadius;
             float xzFogFactor = smoothstep(0.8, 1.0, distRatio);
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
