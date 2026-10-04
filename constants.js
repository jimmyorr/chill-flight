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
// GLSL: the sky's color looking in direction d (normalized): the palette's
// horizon-to-zenith gradient plus the sun's glow, halo and (scaled by
// coreAmount) hot core. The sky dome, the directional fog and water
// reflections all use this, so distant terrain fades into exactly the sky
// behind it and the water mirrors the same sky.
export const SKY_COLOR_GLSL = `
// The sky's color along d is built from three parts, so that fog can compute
// the smooth ones per vertex and only the sun's narrow hot core per pixel
// (see FOG_SKY_VERTEX_GLSL): skyColorAt(d) = combineSky(skyBaseAt(d), skyGlowAt(d),
// sunCoreAt(d) * coreAmount).
vec3 skyBaseAt(vec3 d, vec3 topCol, vec3 bottomCol, vec3 sunDir) {
  float h = d.y;

  // Around sunrise and sunset the sky varies around the compass, not just
  // with height: warm and bright toward the sun, cooler away from it, with
  // the earth's shadow (a darker blue band) and the pink "belt of Venus"
  // just above it on the opposite side.
  float dusk = (1.0 - smoothstep(0.02, 0.3, abs(sunDir.y))) * smoothstep(-0.3, -0.02, sunDir.y);
  vec3 col;
  // dusk depends only on the sun, so every pixel takes the same branch; the
  // compass-dependent work is skipped for most of the day and night.
  if (dusk <= 0.0) {
    col = h < 0.0 ? bottomCol : mix(bottomCol, topCol, pow(h, 0.6));
  } else {
    vec2 sunH = length(sunDir.xz) > 0.001 ? normalize(sunDir.xz) : vec2(1.0, 0.0);
    vec2 dirH = length(d.xz) > 0.001 ? normalize(d.xz) : sunH;
    float toward = dot(dirH, sunH) * 0.5 + 0.5; // 1 toward the sun, 0 away
    // A slightly richer zenith at dusk keeps the sky overhead from going grey.
    float topLum = dot(topCol, vec3(0.299, 0.587, 0.114));
    topCol = clamp(mix(vec3(topLum), topCol, 1.0 + 0.5 * dusk), 0.0, 1.0);
    vec3 warmSide = mix(bottomCol, vec3(1.0, 0.72, 0.42), 0.25) * 1.08;
    vec3 coolSide = mix(topCol, bottomCol, 0.3);
    vec3 horizonCol = mix(bottomCol, mix(coolSide, warmSide, smoothstep(0.1, 0.9, toward)), dusk);
    // Warm colors climb higher on the sun's side; blue comes lower opposite.
    float gradientPow = mix(0.6, mix(0.45, 1.0, toward), dusk);
    col = h < 0.0 ? horizonCol : mix(horizonCol, topCol, pow(h, gradientPow));
    // The earth's shadow and the belt of Venus only appear with the sun right
    // at the horizon (about 3 degrees above to 9 below), strongest just after
    // sunset and just before sunrise.
    float twilight = smoothstep(-0.16, -0.07, sunDir.y) * (1.0 - smoothstep(0.0, 0.055, sunDir.y));
    float away = (1.0 - smoothstep(0.0, 0.35, toward)) * twilight;
    vec3 shadowBlue = mix(clamp(mix(vec3(topLum), topCol, 1.6), 0.0, 1.0), vec3(0.3, 0.42, 0.66), 0.4) * 0.9;
    float shadowBand = 1.0 - smoothstep(0.0, 0.05, max(h, 0.0));
    float belt = smoothstep(0.03, 0.07, h) * (1.0 - smoothstep(0.09, 0.2, h));
    vec3 beltPink = mix(vec3(1.0, 0.72, 0.78), bottomCol, 0.35);
    col = mix(col, shadowBlue, shadowBand * away * 0.55);
    col = mix(col, beltPink, belt * away * 0.45);
  }
  return col;
}

// Soft fade below the horizon so there's never a sharp cut across the sun
float sunGlowFade(vec3 d) {
  return smoothstep(-0.12, 0.04, d.y);
}

// The wide glow around the sun: scattering that warms the horizon during
// twilight, and a warm halo around the disc.
vec3 skyGlowAt(vec3 d, vec3 bottomCol, vec3 sunDir) {
  float baseSunInt = max(0.0, dot(d, sunDir));
  float sunFade = smoothstep(-0.25, 0.0, sunDir.y);
  vec3 ambientSunGlow = bottomCol * pow(baseSunInt, 6.0) * 0.6 * (1.0 - max(d.y, 0.0)) * sunFade;
  vec3 warmHalo = vec3(1.0, 0.6, 0.15) * pow(baseSunInt, 24.0) * 0.8
    * smoothstep(-0.03, 0.06, sunDir.y);
  return (ambientSunGlow + warmHalo) * sunGlowFade(d);
}

// Hot core: golden-amber at the horizon, brilliant white higher up
vec3 sunCoreAt(vec3 d, vec3 sunDir) {
  float horizonExtinction = smoothstep(-0.01, 0.12, sunDir.y);
  vec3 coreColor = mix(vec3(1.0, 0.65, 0.25), vec3(1.0, 0.95, 0.8), horizonExtinction);
  float coreStrength = mix(0.8, 2.5, horizonExtinction) * smoothstep(-0.01, 0.05, sunDir.y);
  return coreColor * pow(max(0.0, dot(d, sunDir)), 512.0) * coreStrength * sunGlowFade(d);
}

vec3 combineSky(vec3 base, vec3 glow, vec3 core) {
  return base + (glow + core) * (vec3(1.0) - base);
}

vec3 skyColorAt(vec3 d, vec3 topCol, vec3 bottomCol, vec3 sunDir, float coreAmount) {
  return combineSky(skyBaseAt(d, topCol, bottomCol, sunDir),
                    skyGlowAt(d, bottomCol, sunDir),
                    sunCoreAt(d, sunDir) * coreAmount);
}
`;

// GLSL for fog toward the sky color, split between the stages: the smooth
// parts of the sky color vary slowly across a surface, so large surfaces
// (terrain, water, the distant ring) compute them per vertex, and only the
// sun's narrow core per pixel. Needs SKY_COLOR_GLSL and uniforms uTopColor,
// uBottomColor, uSunDirection in both stages.
// Vertex: call fogSkyVertex(worldPosition) once the world position is known.
export const FOG_SKY_VERTEX_GLSL = `
varying vec3 vFogSkyBase;
varying vec3 vFogSkyGlow;
vec3 fogSkyDir(vec3 worldPos) {
  return normalize(normalize(worldPos - cameraPosition) + vec3(0.0, 33.0 / 10000.0, 0.0));
}
void fogSkyVertex(vec3 worldPos) {
  vec3 d = fogSkyDir(worldPos);
  vFogSkyBase = skyBaseAt(d, uTopColor, uBottomColor, uSunDirection);
  vFogSkyGlow = skyGlowAt(d, uBottomColor, uSunDirection);
}
`;
// Fragment: fogSkyColorAt(worldPosition) is the sky color the fog fades to.
export const FOG_SKY_FRAGMENT_GLSL = `
varying vec3 vFogSkyBase;
varying vec3 vFogSkyGlow;
vec3 fogSkyColorAt(vec3 worldPos) {
  vec3 d = normalize(normalize(worldPos - cameraPosition) + vec3(0.0, 33.0 / 10000.0, 0.0));
  return combineSky(vFogSkyBase, vFogSkyGlow, sunCoreAt(d, uSunDirection));
}
`;

// GLSL: the open sea as the distant terrain ring draws it, a deep blue that
// mirrors the sky toward the horizon. The near water blends into this just
// inside the draw distance, so there's no seam where the ring takes over.
// Needs SKY_COLOR_GLSL. viewDirW points from the surface to the camera.
export const FAR_SEA_GLSL = `
vec3 farSeaColor(vec3 viewDirW, vec3 topCol, vec3 bottomCol, vec3 sunDir) {
  vec3 reflDir = reflect(-viewDirW, vec3(0.0, 1.0, 0.0));
  reflDir.y = abs(reflDir.y);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(viewDirW.y, 0.0), 5.0);
  return mix(vec3(0.08, 0.22, 0.4), skyColorAt(reflDir, topCol, bottomCol, sunDir, 0.0), fresnel * 0.85);
}
`;

// The moon's direction and how strongly it lights the night (0 by day,
// rising with the phase), set each frame by the game loop. Shared by the
// sky, the clouds (and their reflections) and the water's glitter path.
export const moonlightUniforms = {
  uMoonDir: {value: new THREE.Vector3(0, 0.2, -1).normalize()},
  uMoonBright: {value: 0},
};

// GLSL: the cloud layers' noise and lighting, shared by the sky dome and the
// water's reflection of it, so reflected clouds line up with and match the
// real ones. Declares uNoiseTex (the sky's noise texture) and moonlightUniforms.
export const CLOUD_GLSL = `
uniform sampler2D uNoiseTex;
uniform vec3 uMoonDir;
uniform float uMoonBright;
// How much of each cloud type the sky has: x puffy cumulus, y cirrus streaks,
// z mackerel sky (rows of small puffs)
uniform vec3 uCloudTypes;
// The day's extra cumulus cover on top of the weather's (negative for less)
uniform float uCloudCover;

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

float fbmMacro(vec2 st) {
  float value = 0.0;
  float amplitude = 0.65;
  for (int i = 0; i < 2; i++) {
    value += amplitude * noise(st);
    st *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// The cloud layers drift with the wind along this direction
const vec2 CLOUD_WIND = vec2(0.894, 0.447);

// Cloud plane coordinates turned to the wind: x along it, y across
vec2 windAligned(vec2 uv) {
  return vec2(dot(uv, CLOUD_WIND), dot(uv, vec2(-CLOUD_WIND.y, CLOUD_WIND.x)));
}

// Puffy cumulus: fbm with its coordinates warped by a coarser noise, so the
// edges curl into billows, and (with detail > 0) finer noise breaking up the
// edges. Returns the density; q is the warped position, for lighting.
float cumulusShape(vec2 uv, float detail, out vec2 q) {
  vec2 w = vec2(fbmMacro(uv * 0.6 + vec2(3.1, 7.7)),
                fbmMacro(uv * 0.6 + vec2(8.3, 1.9))) - 0.48;
  q = uv + w * 0.9;
  float n = fbm(q);
  if (detail > 0.0) n += (noise(q * 9.0) - 0.5) * 0.12 * detail;
  return n;
}

// Cirrus: wispy streaks stretched along the wind, in patches
float cirrusShape(vec2 uv) {
  vec2 a = windAligned(uv);
  a.y += (fbmMacro(a * vec2(0.3, 0.7) + 2.7) - 0.48) * 1.2;
  float streaks = fbm(a * vec2(0.6, 2.8));
  float patches = smoothstep(0.38, 0.62, fbmMacro(uv * 0.45 + 9.1));
  return streaks * patches;
}

// Seen along the wind, cirrus streaks converge in perspective into broad
// fans of grey sheets, so they fade out in those directions
float cirrusViewFade(vec3 dir) {
  vec2 dirH = length(dir.xz) > 0.001 ? normalize(dir.xz) : CLOUD_WIND;
  float along = abs(dot(dirH, CLOUD_WIND));
  return 1.0 - smoothstep(0.55, 0.95, along) * 0.85;
}

// Mackerel sky: rows of small puffs across the wind, in patches
float mackerelShape(vec2 uv) {
  vec2 a = windAligned(uv);
  float warp = noise(uv * 1.1 + 5.1);
  float rows = sin(a.y * 11.0 + warp * 5.0) * 0.5 + 0.5;
  float puffs = noise(uv * 7.0 + warp * 2.0);
  // More mackerel means bigger patches, not just thicker ones
  float patchEdge = 0.58 - 0.2 * uCloudTypes.z;
  float patches = smoothstep(patchEdge, patchEdge + 0.14, fbmMacro(uv * 0.5 + 4.3));
  return (puffs * 0.55 + rows * 0.45) * patches;
}

// Cloud lighting through the day. As the sun gets low it lights the clouds
// from below: gold in the golden hour, fiery orange as it reaches the
// horizon, then crimson and magenta in the afterglow once it has set, while
// the clouds' shaded bodies darken to plum and slate so the lit undersides
// stand out. Toward the sun is hottest and brightest; opposite it the clouds
// catch pink. Then they dim to a moonlit grey-blue for the night. The colors
// stay below 1.0 per channel: there is no tone mapping, so brighter values
// would clip to pale cream.
float duskCloudLight(vec3 dir, vec2 sunDir2D, float stormDimming, vec3 sunDir,
                     vec3 topCol, vec3 bottomCol,
                     inout vec3 brightEdgeColor, inout vec3 shadowColor) {
  float sy = sunDir.y;
  float dusk = (1.0 - smoothstep(0.05, 0.3, sy)) * smoothstep(-0.2, 0.0, sy);
  vec2 dirH = length(dir.xz) > 0.001 ? normalize(dir.xz) : sunDir2D;
  float toward = dot(dirH, sunDir2D) * 0.5 + 0.5;
  float sunward = smoothstep(0.2, 0.95, toward);
  // 0 in the golden hour, 1 with the sun on the horizon
  float low = 1.0 - smoothstep(0.0, 0.2, sy);
  // Storms mute the color but keep some of it
  float vivid = mix(1.0, stormDimming, 0.6);

  vec3 hot = mix(vec3(1.0, 0.82, 0.5), vec3(1.0, 0.6, 0.3), low);
  vec3 far = mix(vec3(1.0, 0.76, 0.7), vec3(0.97, 0.62, 0.68), low);
  vec3 duskLit = mix(far, hot, sunward);
  // A touch of the day's palette so sunsets differ from day to day
  duskLit = mix(duskLit, min(bottomCol * 1.15, vec3(1.0)), 0.18);
  duskLit *= mix(0.92, 1.0, sunward);
  brightEdgeColor = mix(brightEdgeColor, duskLit, dusk * vivid);
  // Backlit cloud bodies toward the sun go dusky plum; away, slate violet
  vec3 duskShadow = mix(vec3(0.6, 0.52, 0.66), vec3(0.62, 0.45, 0.48), sunward);
  duskShadow = mix(duskShadow, topCol, 0.2);
  shadowColor = mix(shadowColor, duskShadow, dusk * mix(0.45, 0.7, low));

  // After sunset the sun lights only their undersides, from below the
  // horizon: crimson toward it, magenta opposite, fading as it sinks
  float afterglow = (1.0 - smoothstep(-0.03, 0.02, sy)) * smoothstep(-0.16, -0.05, sy);
  vec3 emberLit = mix(vec3(0.86, 0.46, 0.6), vec3(1.0, 0.42, 0.26), sunward);
  emberLit *= mix(0.75, 1.0, smoothstep(-0.12, -0.02, sy));
  brightEdgeColor = mix(brightEdgeColor, emberLit, afterglow * mix(0.8, 0.95, sunward) * vivid);
  shadowColor = mix(shadowColor, vec3(0.4, 0.3, 0.44), afterglow * 0.6);

  // Night: once the afterglow has faded, clouds are only moonlit, silver
  // near the moon and a dim grey-blue elsewhere.
  float daylight = smoothstep(-0.22, -0.1, sunDir.y);
  float nearMoon = pow(max(dot(dir, uMoonDir), 0.0), 6.0);
  vec3 moonlit = mix(vec3(0.2, 0.22, 0.28), vec3(0.6, 0.66, 0.78),
                     uMoonBright * (0.25 + 0.75 * nearMoon));
  brightEdgeColor = mix(moonlit, brightEdgeColor, daylight);
  shadowColor = mix(vec3(0.07, 0.08, 0.12), shadowColor, daylight);
  return dusk;
}

// Clouds seen from p along dir (for reflections): the same layers the sky
// draws, at the same world positions, with simpler shading (no per-puff
// lighting) and no fine detail (ripples blur a reflection anyway).
// Returns (color, alpha).
vec4 cloudsAlong(vec3 p, vec3 dir, float cloudHeight, float density, float time,
                 vec3 sunDir, vec3 topCol, vec3 bottomCol) {
  float dist = cloudHeight - p.y;
  if (dir.y <= 0.001 || dist <= 0.0) return vec4(0.0);
  vec2 cloudUV = (p.xz + dir.xz * (dist / dir.y)) / cloudHeight;
  float densityOffset = (density - 0.5) * 0.6;
  float horizonFade = smoothstep(0.0, 0.15, dir.y);
  vec2 q;
  float aCirrus = smoothstep(0.3, 0.55, cirrusShape((cloudUV + CLOUD_WIND * time * 0.012) * 2.0))
                * horizonFade * 0.55 * uCloudTypes.y * cirrusViewFade(dir);
  float aMackerel = smoothstep(0.46, 0.6, mackerelShape((cloudUV + CLOUD_WIND * time * 0.02) * 2.5))
                  * smoothstep(0.08, 0.35, dir.y) * 0.75 * uCloudTypes.z;
  float aCumulus = smoothstep(0.42 - densityOffset - uCloudCover, 0.58 - densityOffset - uCloudCover,
                              cumulusShape((cloudUV + CLOUD_WIND * time * 0.034) * 2.0, 0.0, q))
                 * horizonFade * 0.92 * uCloudTypes.x;
  float alpha = 1.0 - (1.0 - aCirrus) * (1.0 - aMackerel) * (1.0 - aCumulus);
  if (alpha <= 0.0) return vec4(0.0);

  float stormDimming = 1.0 - density * 0.6;
  vec3 bright = mix(vec3(0.95, 0.96, 0.98), vec3(0.72, 0.75, 0.8), density * 0.6);
  vec3 shadow = mix(vec3(0.55, 0.58, 0.64), vec3(0.42, 0.45, 0.5), density * 0.5);
  shadow = mix(shadow, mix(bottomCol, topCol, 0.35) * 1.1, 0.25);
  vec2 sunDir2D = length(sunDir.xz) > 0.001 ? normalize(sunDir.xz) : vec2(1.0, 0.0);
  duskCloudLight(dir, sunDir2D, stormDimming, sunDir, topCol, bottomCol, bright, shadow);
  return vec4(mix(shadow, bright, 0.65), alpha);
}
`;

export const terrainUniforms = {
  uCameraPosXZ: {value: new THREE.Vector2(0, 0)},
  uRenderRadius: {value: state.RENDER_DISTANCE * CHUNK_SIZE},
  uSunDirection: {value: new THREE.Vector3(0, 1, 0)},
  uTopColor: {value: new THREE.Color()},
  uBottomColor: {value: new THREE.Color()},
  // 1: terrain and water fade to the sky near the draw distance. 0 when the
  // distant terrain ring (far-terrain.js) continues the land beyond it.
  uNearEdgeFade: {value: 1},
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
    ` +
      SKY_COLOR_GLSL +
      shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <fog_fragment>`,
      `#ifdef USE_FOG
         vec3 viewDirFog = normalize(vWorldPosition - cameraPosition);
         vec3 skyDir = normalize(viewDirFog + vec3(0.0, 33.0 / 10000.0, 0.0));
         vec3 fogSkyColor = skyColorAt(skyDir, uTopColor, uBottomColor, uSunDirection, 1.0);
         
         #ifdef FOG_EXP2
             float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
         #else
             float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
         #endif
         
         float finalFogFactor = fogFactor;
         if (uRenderRadius > 0.0) {
             float distRatio = vDistanceXZ / uRenderRadius;
             float xzFogFactor = smoothstep(0.9, 0.99, distRatio);
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
