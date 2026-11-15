// PROTOTYPE (?aboveClouds=sheet): the cloud deck seen from above. The sky
// paints the clouds only looking up, so above the deck they vanish; this is
// one big flat sheet at the deck's height, under the camera, drawing the same
// cumulus pattern the sky does (CLOUD_GLSL's cloudsAlong), lit from above and
// fading into the horizon far off.
import * as THREE from 'three';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {CLOUD_GLSL} from './constants.js';
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
    void main() {
      // The cloud straight above a point just under the deck: the same
      // pattern the sky shows from below
      vec4 c = cloudsAlong(vec3(vWorld.x, uDeckHeight - 1.0, vWorld.z),
                           vec3(0.0, 1.0, 0.0), uDeckHeight, uCloudDensity,
                           uTime, sunDirection, topColor, bottomColor);
      // Sunlit tops: brighter and whiter than the undersides
      vec3 col = mix(c.rgb, vec3(1.0, 0.99, 0.97), 0.75) * uDeckLight;
      float far = length(vWorld.xz - uDeckCenter) / ${RADIUS.toFixed(1)};
      col = mix(col, bottomColor, smoothstep(0.25, 0.95, far));
      // Solid where the sky would show thick cloud, so no ground shows through
      float a = smoothstep(0.0, 0.7, c.a) * (1.0 - smoothstep(0.85, 1.0, far));
      gl_FragColor = vec4(col, a);
    }
  `,
  transparent: true,
  depthWrite: false,
  fog: false,
  side: THREE.DoubleSide,
});

const geometry = new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2, 1, 1);
geometry.rotateX(-Math.PI / 2);
const deck = new THREE.Mesh(geometry, material);
deck.frustumCulled = false;
deck.visible = false;
deck.renderOrder = 1;
if (ABOVE_CLOUDS === 'sheet') scene.add(deck);

export function updateCloudDeck(camPos) {
  if (ABOVE_CLOUDS !== 'sheet') return;
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

export function updateCloudVeil(fogColor) {
  if (!ABOVE_CLOUDS) return;
  const amount = Math.min(0.92, (state.inCloud || 0) * 1.1);
  veil.visible = amount > 0.01;
  veilMaterial.uniforms.uAmount.value = amount;
  veilMaterial.uniforms.uColor.value.copy(fogColor);
}
