// --- CONSTANTS ---
// Settings that change at runtime (SEGMENTS, RENDER_DISTANCE, flight speed...)
// live in state.js instead.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';

// Terrain parameters
export const CHUNK_SIZE = 1500;
export const WATER_LEVEL = 40;
export const MOUNTAIN_LEVEL = 180;
export const CLOUD_OPACITY = 0.55;

// Lighthouse parameters
export const LIGHTHOUSE_CHUNK_X = 5;
export const LIGHTHOUSE_CHUNK_Z = 2;
export const LIGHTHOUSE_CHUNK_KEY = `${LIGHTHOUSE_CHUNK_X},${LIGHTHOUSE_CHUNK_Z}`;
// three.js r155+ uses physical light units (candela) for spotlights.
// Converted from the legacy-tuned 3.5 to preserve illuminance at the ~600 m
// beam target distance. Verify visually on a night flight.
export const LIGHTHOUSE_LIGHT_INTENSITY = 800000;
export const LIGHTHOUSE_BEAM_OPACITY_MIN = 0.08;
export const LIGHTHOUSE_BEAM_OPACITY_MAX = 0.25;

// Custom Map Parameters
export const MAP_WORLD_SIZE = 10000 * ChillFlightLogic.SCALE;
export const MAP_HEIGHT_SCALE = 400;

// Flight parameters
export const BASE_FLIGHT_SPEED = 2.5;
export const MAX_AIRPLANE_SPEED_KTS = 500;
export const MAX_FLIGHT_SPEED_MULT =
  MAX_AIRPLANE_SPEED_KTS / (BASE_FLIGHT_SPEED * 60);
export const TURN_SPEED = 0.03;

// Feature Flags
export const ENABLE_PAGODAS = false;
export const ENABLE_BARNS = true;
export const ENABLE_MONASTERIES = true;
export const ENABLE_CASTLE_RUINS = true;
export const ENABLE_LIGHTHOUSES = false;

export const THEME = ChillFlightLogic.THEME;

// Shared by every material's injected directional-fog shader code; the game
// loop updates the values each frame.
export const terrainUniforms = {
  uCameraPosXZ: {value: new THREE.Vector2(0, 0)},
  uRenderRadius: {value: state.RENDER_DISTANCE * CHUNK_SIZE},
  uSunDirection: {value: new THREE.Vector3(0, 1, 0)},
  uTopColor: {value: new THREE.Color()},
  uBottomColor: {value: new THREE.Color()},
  // Dims near-white terrain (snow, ice) so full daylight doesn't clip it to
  // flat white; 1 when the light is weak enough (see game-loop.js).
  uSnowExposure: {value: new THREE.Vector3(1, 1, 1)},
};

export function createMaterial(params) {
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
    shader.uniforms.uCameraPosXZ = terrainUniforms.uCameraPosXZ;
    shader.uniforms.uRenderRadius = terrainUniforms.uRenderRadius;
    shader.uniforms.uSunDirection = terrainUniforms.uSunDirection;
    shader.uniforms.uTopColor = terrainUniforms.uTopColor;
    shader.uniforms.uBottomColor = terrainUniforms.uBottomColor;

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
             float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
         #else
             float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
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

// DOM caching & utilities
const _domCache = new Map();

export function getCachedElement(id) {
  let el = _domCache.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (el) _domCache.set(id, el);
  }
  return el;
}

/**
 * Throttles DOM updates by only writing if the value has changed.
 * Accepts either an HTMLElement or an element ID string (cached automatically).
 */
export function updateDOM(elementOrId, newValue) {
  const element =
    typeof elementOrId === 'string'
      ? getCachedElement(elementOrId)
      : elementOrId;
  if (!element) return;
  const strValue = String(newValue); // Cast to string for accurate comparison
  if (element.textContent !== strValue) {
    element.textContent = strValue;
  }
}

// Mirror debug settings into the URL (only while the debug menu is open) so
// the current view can be shared.
export function updateUrlParams(updates = {}, removals = []) {
  try {
    const debugMenu = getCachedElement('debug-menu');
    const isDebugActive = debugMenu && debugMenu.style.display === 'block';

    if (!isDebugActive) {
      return;
    }

    const url = new URL(window.location.href);
    if (!removals.includes('debug') && !url.searchParams.has('debug')) {
      url.searchParams.set('debug', 'true');
    }
    removals.forEach((key) => url.searchParams.delete(key));
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, val);
      }
    });
    window.history.replaceState(null, '', url.toString());
  } catch (err) {
    console.error('Failed to update URL parameters:', err);
  }
}
