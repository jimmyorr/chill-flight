// --- OUTLINE PASS ---
// The anime art style's painted finish: the scene renders into an offscreen
// target with a depth texture, then one full-screen pass
// - softens detail into daubs of paint (a Kuwahara filter; not on low),
// - darkens pixels on the near side of depth breaks into ink outlines
//   (silhouettes, ridges against what's behind). Breaks are found in
//   1/depth, which is linear across any plane in screen space, so slopes
//   seen at a grazing angle don't draw lines; ?outline=0 turns them off,
// - and lays a watercolor-paper grain over the frame.
// The classic style (and VR) renders straight to the screen as before.
import * as THREE from 'three';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {ART_STYLE} from './art-style.js';
import {terrainUniforms} from './constants.js';
import {renderer} from './sky.js';
import {state} from './state.js';

const enabled = ART_STYLE === 'anime';
const outlines = ChillFlightLogic.urlParams.get('outline') !== '0';

let target = null;
let quad = null;
// Smoothing jagged edges (FXAA) needs the finished frame, so with it the
// pass renders to this target first. High and ultra only: it costs ~1.4 ms a
// frame on an M1 MacBook Air at mid.
let inkTarget = null;
let fxaaQuad = null;
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
    uPixelRatio: {value: 1},
    uOutline: {value: outlines},
    uKuwahara: {value: false},
    uHorizonColor: terrainUniforms.uBottomColor,
  },
  // How far toward the horizon's color distant land fades (aerial
  // perspective)
  defines: {HAZE_STRENGTH: '0.35'},
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
    uniform float uPixelRatio;
    uniform bool uOutline;
    uniform bool uKuwahara;
    uniform vec3 uHorizonColor;
    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
                 mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    // Kuwahara: the mean of whichever of the four quadrants around the pixel
    // varies least, which flattens detail into daubs but keeps edges
    vec3 kuwahara(vec2 uv) {
      // A 5x5 grid 1.5 pixels apart, shared by the four quadrants: about the
      // footprint of 4x4 quadrants one pixel apart, in 25 reads, not 64
      const int R = 2;
      const float STEP = 1.5;
      vec3 sum[4];
      vec3 sum2[4];
      for (int q = 0; q < 4; q++) {
        sum[q] = vec3(0.0);
        sum2[q] = vec3(0.0);
      }
      for (int j = -R; j <= R; j++) {
        for (int i = -R; i <= R; i++) {
          vec3 c = texture2D(tColor, uv + vec2(float(i), float(j)) * STEP * uTexel).rgb;
          vec3 c2 = c * c;
          if (i <= 0 && j <= 0) { sum[0] += c; sum2[0] += c2; }
          if (i >= 0 && j <= 0) { sum[1] += c; sum2[1] += c2; }
          if (i <= 0 && j >= 0) { sum[2] += c; sum2[2] += c2; }
          if (i >= 0 && j >= 0) { sum[3] += c; sum2[3] += c2; }
        }
      }
      float n = float((R + 1) * (R + 1));
      vec3 bestMean = vec3(0.0);
      float bestVar = 1e9;
      for (int q = 0; q < 4; q++) {
        vec3 mean = sum[q] / n;
        vec3 v = sum2[q] / n - mean * mean;
        float variance = v.r + v.g + v.b;
        if (variance < bestVar) {
          bestVar = variance;
          bestMean = mean;
        }
      }
      return bestMean;
    }

    // 1 / view distance, from the depth buffer of a perspective camera
    float invDepth(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return (uFar - d * (uFar - uNear)) / (uNear * uFar);
    }

    void main() {
      // Screen position in CSS pixels, for textures that keep their size
      vec2 p = gl_FragCoord.xy / uPixelRatio;
      vec2 uv = vUv;
      vec3 color = uKuwahara ? kuwahara(uv) : texture2D(tColor, uv).rgb;
      float c = invDepth(uv);
      float l = invDepth(uv - vec2(uTexel.x, 0.0));
      float r = invDepth(uv + vec2(uTexel.x, 0.0));
      float d = invDepth(uv - vec2(0.0, uTexel.y));
      float u = invDepth(uv + vec2(0.0, uTexel.y));
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
      if (uOutline) color = mix(color, ink, edge);
      // Aerial perspective: distant land fades into soft layers of the
      // horizon's color, nudged toward lavender (not the sky itself, whose
      // depth is the far plane)
      if (c > 1.0 / (uFar * 0.99)) {
        vec3 haze = mix(uHorizonColor, vec3(0.78, 0.8, 0.95) * dot(uHorizonColor, vec3(0.333)) * 1.1, 0.3);
        color = mix(color, haze, smoothstep(1200.0, 11000.0, dist) * HAZE_STRENGTH);
      }
      // Watercolor paper: broad blotches, a finer tooth and fibers
      float paper = vnoise(p * 0.012) * 0.5 + vnoise(p * 0.08) * 0.3 + vnoise(p * 0.7) * 0.2;
      color *= mix(vec3(0.93, 0.92, 0.95), vec3(1.03, 1.02, 1.0), paper);
      gl_FragColor = vec4(color, 1.0);
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
    if (inkTarget) inkTarget.setSize(size.x, size.y);
  }
}

function ensureFxaa() {
  if (!inkTarget) {
    inkTarget = new THREE.WebGLRenderTarget(size.x, size.y);
    fxaaQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        ...FXAAShader,
        uniforms: THREE.UniformsUtils.clone(FXAAShader.uniforms),
        depthTest: false,
        depthWrite: false,
      })
    );
    fxaaQuad.frustumCulled = false;
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
  u.uPixelRatio.value = px;
  // The brushstroke filter costs ~1.5 ms a frame on an M1 MacBook Air at mid;
  // the low preset (for slow devices) skips it
  u.uKuwahara.value = state.graphicsPreset !== 'low';
  u.uFogDensity.value = scene.fog ? scene.fog.density || 0 : 0;
  u.uNear.value = camera.near;
  u.uFar.value = camera.far;
  const fxaa =
    state.graphicsPreset === 'high' || state.graphicsPreset === 'ultra';
  if (!fxaa) {
    renderer.render(quad, quadCamera);
    return;
  }
  ensureFxaa();
  renderer.setRenderTarget(inkTarget);
  renderer.render(quad, quadCamera);
  renderer.setRenderTarget(null);
  const f = fxaaQuad.material.uniforms;
  f.tDiffuse.value = inkTarget.texture;
  f.resolution.value.set(1 / size.x, 1 / size.y);
  renderer.render(fxaaQuad, quadCamera);
}
