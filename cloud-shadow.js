// Cloud shadows: the cumulus seen overhead shades the land, the sea, the
// trees and the plane under it, and the shade drifts with the clouds.
// Each frame this draws the cumulus cover over a square of the cloud deck
// around the camera into a small texture (the same shape the sky draws,
// from the same noise), and every lit surface looks up the cover where its
// ray toward the sun meets the deck (CLOUD_SHADOW_GLSL in constants.js): one
// texture read per pixel instead of the cloud noise. Off with
// ?cloudShadows=0, under an overcast storm deck (which already dims
// everything evenly), with clouds hidden, and with the sun down.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {atmosphereUniforms, CLOUD_GLSL, WATER_LEVEL} from './constants.js';
import {skyUniforms} from './sky-uniforms.js';
import {renderer} from './sky.js';

const enabled = ChillFlightLogic.urlParams?.get('cloudShadows') !== '0';
// The map: SIZE texels across SPAN world units (~150 m a texel, softer
// than the clouds' own edges, as a shadow is), reaching the far terrain
// ring's edge in every direction
const SIZE = 256;
const SPAN = 40000;
// How much of the direct sunlight a thick cloud blocks
const STRENGTH = 1;

const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
  depthBuffer: false,
  generateMipmaps: false,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
});
atmosphereUniforms.uCloudShadowTex.value = target.texture;

const coverMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uNoiseTex: skyUniforms.uNoiseTex,
    uMoonDir: skyUniforms.uMoonDir,
    uMoonBright: skyUniforms.uMoonBright,
    uCloudTypes: skyUniforms.uCloudTypes,
    uCloudCover: skyUniforms.uCloudCover,
    uSnowDeck: skyUniforms.uSnowDeck,
    uCloudDensity: skyUniforms.uCloudDensity,
    uTime: skyUniforms.uTime,
    uRect: atmosphereUniforms.uCloudShadowRect,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader:
    CLOUD_GLSL +
    /* glsl */ `
    uniform float uCloudDensity;
    uniform float uTime;
    uniform vec3 uRect;
    varying vec2 vUv;
    void main() {
      vec2 deckUV = uRect.xy + (vUv - 0.5) / uRect.z;
      // As the sky's cumulus layer (sky.frag.glsl), without the fine detail
      float densityOffset = (uCloudDensity - 0.5) * 0.6;
      vec2 q;
      float n = cumulusShape((deckUV + CLOUD_WIND * uTime * 0.034) * 2.0, 0.0, q);
      float edge = 0.42 - densityOffset - uCloudCover;
      float cover = smoothstep(edge - 0.05, edge + 0.12, n) * uCloudTypes.x
                  * (1.0 - stormDeck(uCloudDensity));
      gl_FragColor = vec4(vec3(cover), 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), coverMaterial);
quad.frustumCulled = false;
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const sun = new THREE.Vector3();

// Redraws the cover map around the camera and sets how strongly it shades
export function updateCloudShadows(camPos) {
  const u = atmosphereUniforms;
  sun.copy(skyUniforms.sunDirection.value);
  const strength =
    enabled && renderer && skyUniforms.uShowClouds.value
      ? STRENGTH * THREE.MathUtils.smoothstep(sun.y, 0.03, 0.2)
      : 0;
  u.uCloudShadow.value = strength;
  if (strength <= 0) return;
  const deck = skyUniforms.uCloudHeight.value || 3000;
  u.uShadowDeck.value = deck;
  // Centred on where the camera's surroundings (at about sea level) look up
  // toward the sun through the deck, snapped to whole texels so the map
  // doesn't shimmer as the camera moves
  const rise = (deck - WATER_LEVEL) / Math.max(sun.y, 0.05);
  const texel = SPAN / deck / SIZE;
  const cx = (camPos.x + sun.x * rise) / deck;
  const cz = (camPos.z + sun.z * rise) / deck;
  u.uCloudShadowRect.value.set(
    Math.round(cx / texel) * texel,
    Math.round(cz / texel) * texel,
    deck / SPAN
  );
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(quad, quadCamera);
  renderer.setRenderTarget(prev);
}
