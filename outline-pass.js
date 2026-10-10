// --- OUTLINE PASS ---
// Ink outlines for the anime art style: the scene renders into an offscreen
// target with a depth texture, then one full-screen pass darkens pixels on
// the near side of depth breaks (silhouettes, ridges against what's behind).
// Breaks are found in 1/depth, which is linear across any plane in screen
// space, so slopes seen at a grazing angle don't draw lines. The classic
// style (and VR) renders straight to the screen as before.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {ART_STYLE} from './art-style.js';
import {renderer} from './sky.js';

const enabled =
  ART_STYLE === 'anime' && ChillFlightLogic.urlParams.get('outline') !== '0';

let target = null;
let quad = null;
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const size = new THREE.Vector2();

const outlineMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tColor: {value: null},
    tDepth: {value: null},
    uTexel: {value: new THREE.Vector2()},
    uNear: {value: 1},
    uFar: {value: 30000},
    uFogDensity: {value: 0},
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear;
    uniform float uFar;
    uniform float uFogDensity;
    varying vec2 vUv;

    // 1 / view distance, from the depth buffer of a perspective camera
    float invDepth(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return (uFar - d * (uFar - uNear)) / (uNear * uFar);
    }

    void main() {
      vec3 color = texture2D(tColor, vUv).rgb;
      float c = invDepth(vUv);
      float l = invDepth(vUv - vec2(uTexel.x, 0.0));
      float r = invDepth(vUv + vec2(uTexel.x, 0.0));
      float d = invDepth(vUv - vec2(0.0, uTexel.y));
      float u = invDepth(vUv + vec2(0.0, uTexel.y));
      // How far this pixel stands in front of its neighbors, relative to its
      // own depth (positive only on the near side of a break)
      float bulge = max(c - 0.5 * (l + r), 0.0) + max(c - 0.5 * (d + u), 0.0);
      float edge = smoothstep(0.04, 0.12, bulge / c);
      // Lines thin out with distance so far terrain doesn't turn to scribble
      float dist = 1.0 / c;
      edge *= mix(1.0, 0.35, smoothstep(1500.0, 9000.0, dist));
      // ...and fade out with the scene's fog, like the surfaces they ink
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      edge *= (1.0 - fog) * (1.0 - fog);
      vec3 ink = color * vec3(0.32, 0.27, 0.36);
      gl_FragColor = vec4(mix(color, ink, edge), 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

function ensureTarget() {
  renderer.getDrawingBufferSize(size);
  if (!target) {
    target = new THREE.WebGLRenderTarget(size.x, size.y, {
      // No antialiasing: multisampling this target (and resolving its depth)
      // cost ~3 ms a frame on an M1 MacBook Air at mid, for little gain at
      // Retina density
      depthTexture: new THREE.DepthTexture(size.x, size.y),
    });
    quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlineMaterial);
    quad.frustumCulled = false;
  } else if (target.width !== size.x || target.height !== size.y) {
    target.setSize(size.x, size.y);
  }
}

// Renders one frame of the game, with outlines when the art style has them.
export function renderFrame(scene, camera) {
  if (!enabled || renderer.xr.isPresenting) {
    renderer.render(scene, camera);
    return;
  }
  ensureTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  const u = outlineMaterial.uniforms;
  u.tColor.value = target.texture;
  u.tDepth.value = target.depthTexture;
  // One CSS pixel wide
  const px = renderer.getPixelRatio();
  u.uTexel.value.set(px / size.x, px / size.y);
  u.uFogDensity.value = scene.fog ? scene.fog.density || 0 : 0;
  u.uNear.value = camera.near;
  u.uFar.value = camera.far;
  renderer.render(quad, quadCamera);
}
