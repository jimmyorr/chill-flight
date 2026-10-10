// --- ART STYLE ---
// Opt-in anime / painterly look (?style=anime). Patches three.js's shared
// lighting shader chunks once at load, so every lit material picks it up:
// smooth shading, sun and moon light in three soft steps, lavender (not grey)
// shadows, no near-black colors, fewer plastic highlights and a gentle color
// grade. The classic look is untouched.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';

const STORAGE_KEY = 'chill_flight_art_style';

// The Settings choice, unless ?style= overrides it
function loadStyle() {
  const param = ChillFlightLogic.urlParams.get('style');
  if (param) return param === 'anime' ? 'anime' : 'classic';
  try {
    return localStorage.getItem(STORAGE_KEY) === 'anime' ? 'anime' : 'classic';
  } catch {
    return 'classic';
  }
}

export const ART_STYLE = loadStyle();

// Settings' art style select. The style is applied as the game loads, so a
// change saves the choice and reloads (dropping ?style=, which would
// override it).
const select = document.getElementById('art-style-select');
if (select) {
  select.value = ART_STYLE;
  select.addEventListener('change', () => {
    let saved = true;
    try {
      localStorage.setItem(STORAGE_KEY, select.value);
    } catch {
      saved = false;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('style');
    // Without storage, carry the choice in the URL instead
    if (!saved && select.value === 'anime')
      url.searchParams.set('style', 'anime');
    window.location.assign(url.toString());
  });
}

// Smooth shading for materials that would otherwise be flat-shaded
export const ART_SMOOTH = ART_STYLE === 'anime';

// Anime clouds (bigger, rounder, crisp-edged and two-toned; constants.js and
// sky.frag.glsl), unless ?cloudStyle=classic keeps the classic clouds
export const ART_CLOUDS =
  ART_STYLE === 'anime' &&
  ChillFlightLogic.urlParams.get('cloudStyle') !== 'classic';

function patch(chunkName, from, to) {
  const chunk = THREE.ShaderChunk[chunkName];
  if (!chunk.includes(from)) {
    throw new Error(`art-style: ${chunkName} has no "${from}"`);
  }
  THREE.ShaderChunk[chunkName] = chunk.replace(from, to);
}

if (ART_STYLE === 'anime') {
  THREE.ShaderChunk.common += `
    // Three light levels: shadow, half lit and lit, with soft edges
    float animeStep(float d) {
      return 0.35 * smoothstep(-0.05, 0.05, d) + 0.65 * smoothstep(0.32, 0.42, d);
    }
    // A little more saturation, with blacks lifted toward lavender
    vec3 animeGrade(vec3 c) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.12);
      return c + vec3(0.03, 0.02, 0.04) * (1.0 - c);
    }
  `;
  // Stepped sun and moon light (MeshStandardMaterial and MeshLambertMaterial)
  const dotNL =
    'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
  const stepped =
    'float dotNL = animeStep( dot( geometryNormal, directLight.direction ) );';
  patch('lights_physical_pars_fragment', dotNL, stepped);
  patch('lights_lambert_pars_fragment', dotNL, stepped);
  // Brighter lavender shadows, warmer light, fewer plastic highlights
  THREE.ShaderChunk.lights_fragment_end += `
    reflectedLight.indirectDiffuse *= vec3(0.86, 0.8, 1.12) * 1.4;
    reflectedLight.directDiffuse *= vec3(1.05, 1.0, 0.92);
    reflectedLight.directSpecular *= 0.15;
  `;
  // No near-black surfaces: dark colors lift toward lavender grey
  THREE.ShaderChunk.color_fragment += `
    diffuseColor.rgb += 0.15 * vec3(0.9, 0.9, 1.1)
      * (1.0 - diffuseColor.rgb) * (1.0 - diffuseColor.rgb);
  `;
  patch(
    'opaque_fragment',
    'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
    'gl_FragColor = vec4( animeGrade( outgoingLight ), diffuseColor.a );'
  );
}
