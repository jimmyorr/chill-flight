// The cloud deck seen from above (?aboveClouds, ABOVE_CLOUDS in
// flight-physics-logic.js). The sky paints its clouds looking up, so above
// the deck they'd vanish; this is one big flat sheet at the deck's height
// under the camera, drawing the same cumulus the sky shows from below (so
// the gaps match), lit from above: sunny sides bright, shadow sides soft
// and sky-tinted, fading into the horizon far off. Only drawn above the deck.
import * as THREE from 'three';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {CLOUD_GLSL} from './constants.js';
import {ART_POST} from './art-style.js';
import {state} from './state.js';
import {ABOVE_CLOUDS} from './flight-physics-logic.js';

const RADIUS = 26000;
const deckUniforms = {
  sunDirection: skyUniforms.sunDirection,
  uCloudDensity: skyUniforms.uCloudDensity,
  uTime: skyUniforms.uTime,
  topColor: skyUniforms.topColor,
  bottomColor: skyUniforms.bottomColor,
  uNoiseTex: skyUniforms.uNoiseTex,
  uMoonDir: skyUniforms.uMoonDir,
  uMoonBright: skyUniforms.uMoonBright,
  uCloudCover: skyUniforms.uCloudCover,
  uSnowDeck: skyUniforms.uSnowDeck,
  // Cumulus only: the high cirrus and mackerel aren't in the deck
  uCloudTypes: {value: new THREE.Vector3(1, 0, 0)},
  uDeckHeight: {value: 3000},
  uDeckLight: {value: 1},
  uDeckCenter: {value: new THREE.Vector2()},
};

const material = new THREE.ShaderMaterial({
  uniforms: deckUniforms,
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader:
    CLOUD_GLSL +
    /* glsl */ `
    uniform vec3 sunDirection;
    uniform float uCloudDensity;
    uniform float uTime;
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float uDeckHeight;
    uniform float uDeckLight;
    uniform vec2 uDeckCenter;
    varying vec3 vWorld;

    // The sky's cumulus noise (cloudsAlong in CLOUD_GLSL) at deck
    // position uv, with the fine detail on: the cloud's thickness
    float cumulusNoise(vec2 uv) {
      vec2 q;
      return cumulusShape((uv + CLOUD_WIND * uTime * 0.034) * 2.0, 1.0, q);
    }

    void main() {
      float far = length(vWorld.xz - uDeckCenter) / ${RADIUS.toFixed(1)};
      float edge = 0.42 - (uCloudDensity - 0.5) * 0.6 - uCloudCover;
      vec2 uv = vWorld.xz / uDeckHeight;
      float n = cumulusNoise(uv);
      float here = smoothstep(edge, edge + 0.16, n) * 0.92 * uCloudTypes.x;
      if (here < 0.004) discard;
      // The noise as the height of the tops, well past where the cloud
      // turns solid: a slope down toward the sun faces it, one up toward it
      // is in shadow, so billows show all across the deck, not just at
      // its edges; the hollows between billows are darker too
      vec2 sun2D = length(sunDirection.xz) > 0.001
        ? normalize(sunDirection.xz) : vec2(1.0, 0.0);
      float towardSun = cumulusNoise(uv + sun2D * 0.008);
      float lit = clamp(0.6 + (n - towardSun) * 14.0, 0.0, 1.0);
      float hollow = smoothstep(edge, edge + 0.45, n);
      // Low sun: longer shadows and a warm light
      float lowSun = 1.0 - smoothstep(0.05, 0.5, sunDirection.y);
      lit = mix(lit, lit * lit, lowSun * 0.3);
      vec3 sunlit = mix(vec3(1.0, 0.99, 0.97), bottomColor * 1.6, lowSun * 0.35);
      vec3 shade = mix(vec3(0.74, 0.77, 0.84), topColor, 0.25);
      vec3 col = mix(shade, sunlit, lit);
      // Thin edges and hollows are greyer (from above, even a storm deck's
      // top is in the sun)
      col *= mix(0.84, 1.0, hollow);
      col *= uDeckLight;
      col = mix(col, bottomColor, smoothstep(0.25, 0.95, far));
      // Solid where the sky would show thick cloud, so no ground shows through
      float a = smoothstep(0.0, 0.7, here) * (1.0 - smoothstep(0.85, 1.0, far));
      gl_FragColor = vec4(col, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  fog: false,
  side: THREE.DoubleSide,
  forceSinglePass: true,
});

const geometry = new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2, 1, 1);
geometry.rotateX(-Math.PI / 2);
const deck = new THREE.Mesh(geometry, material);
deck.frustumCulled = false;
deck.visible = false;
deck.renderOrder = 1;
if (ABOVE_CLOUDS) scene.add(deck);

export function updateCloudDeck(camPos) {
  if (!ABOVE_CLOUDS) return;
  const h = skyUniforms.uCloudHeight.value;
  deck.visible = skyUniforms.uShowClouds.value && camPos.y > h + 5;
  if (!deck.visible) return;
  deck.position.set(camPos.x, h, camPos.z);
  deckUniforms.uDeckHeight.value = h;
  deckUniforms.uDeckCenter.value.set(camPos.x, camPos.z);
  deckUniforms.uCloudTypes.value.set(skyUniforms.uCloudTypes.value.x, 0, 0);
  deckUniforms.uDeckLight.value = 0.3 + 0.7 * Math.min(1, state.dayFactor);
}

// Inside the deck: a whiteout over the whole view (the fog alone doesn't
// reach the sky), in the fog's colour, as thick as state.inCloud
const veilMaterial = new THREE.ShaderMaterial({
  uniforms: {uColor: {value: new THREE.Color()}, uAmount: {value: 0}},
  vertexShader: /* glsl */ `
    void main() { gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uAmount;
    void main() { gl_FragColor = vec4(uColor, uAmount); }
  `,
  transparent: true,
  depthTest: false,
  depthWrite: false,
  fog: false,
});
const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMaterial);
veil.frustumCulled = false;
veil.renderOrder = 1000;
veil.visible = false;
if (ABOVE_CLOUDS) scene.add(veil);

// With the art style's post pass, attenuate the target's alpha where the
// cloud sheet or veil covers the view so ridge and plane ink don't bleed
// through thick cloud, while gaps between clouds keep their ink
if (ART_POST) {
  for (const mat of [material, veilMaterial]) {
    mat.blending = THREE.CustomBlending;
    mat.blendSrc = THREE.SrcAlphaFactor;
    mat.blendDst = THREE.OneMinusSrcAlphaFactor;
    mat.blendSrcAlpha = THREE.ZeroFactor;
    mat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  }
}

export function updateCloudVeil(fogColor) {
  if (!ABOVE_CLOUDS) return;
  const amount = Math.min(0.92, (state.inCloud || 0) * 1.1);
  veil.visible = amount > 0.01;
  veilMaterial.uniforms.uAmount.value = amount;
  veilMaterial.uniforms.uColor.value.copy(fogColor);
}
