// --- OUTLINE PASS ---
// The art styles' finish: the scene renders into an offscreen target with a
// depth texture, then one full-screen pass
// - (anime) softens distant detail into daubs of paint (a Kuwahara filter,
//   faded in with distance so nearby things stay crisp; not on low),
// - darkens pixels on the near side of depth breaks into ink outlines
//   (silhouettes, ridges against what's behind), a little bolder close to
//   the camera, so the plane reads like a drawn character. Breaks are found
//   in 1/depth, which is linear across any plane in screen space, so slopes
//   seen at a grazing angle don't draw lines; ?outline=0 turns them off,
// - (comic) inks color edges too, flattens the light into a few bands and
//   hatches the shadows,
// - fades distant land into the horizon's color (?haze=0 turns it off),
// - and (anime) lets bright pixels glow softly into their neighbors.
// ?brush=0 turns off the Kuwahara filter, and ?fxaa=1 or ?fxaa=0 turns edge
// smoothing on or off whatever the preset, for comparing.
// The classic style (and VR) renders straight to the screen as before.
import * as THREE from 'three';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {ART_POST, ART_STYLE} from './art-style.js';
import {terrainUniforms} from './constants.js';
import {renderer} from './sky.js';
import {state} from './state.js';

const enabled = ART_POST;
const params = ChillFlightLogic.urlParams;
const outlines = params.get('outline') !== '0';
const brush = params.get('brush') !== '0';
const fxaaParam = params.get('fxaa');

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
    uHaze: {value: params.get('haze') !== '0'},
    uHorizonColor: terrainUniforms.uBottomColor,
    uSunDirection: terrainUniforms.uSunDirection,
  },
  defines: {
    // How far toward the horizon's color distant land fades (aerial
    // perspective)
    HAZE_STRENGTH: '0.35',
    // ANIME or COMIC: the art style's own steps
    [ART_STYLE.toUpperCase()]: '',
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
    uniform float uPixelRatio;
    uniform bool uOutline;
    uniform bool uKuwahara;
    uniform bool uHaze;
    uniform vec3 uHorizonColor;
    uniform vec3 uSunDirection;
    varying vec2 vUv;

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
        vec3 v = max(sum2[q] / n - mean * mean, vec3(0.0));
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

    float luma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      // Screen position in CSS pixels, for textures that keep their size
      vec2 p = gl_FragCoord.xy / uPixelRatio;
      vec2 uv = vUv;
      // Neighbors for the outlines: one CSS pixel away
      vec2 nb = uTexel;
      float c = invDepth(uv);
      float dist = 1.0 / c;
      bool sky = c <= 1.0 / (uFar * 0.99);
      vec3 color = texture2D(tColor, uv).rgb;
    #ifdef ANIME
      // Brushwork fades in with distance: nearby trees, houses and roads stay
      // crisp, distant land softens into daubs like a painted backdrop (only
      // partway, so far hills keep their shapes)
      float brushAmt = smoothstep(600.0, 4000.0, dist) * 0.55;
      if (uKuwahara && brushAmt > 0.0) color = mix(color, kuwahara(uv), brushAmt);
    #endif
      // Close to the camera (the plane, nearby buildings) lines get a little
      // bolder
      float near = 1.0 - smoothstep(60.0, 400.0, dist);
      nb *= 1.0 + 0.75 * near;
      float l = invDepth(uv - vec2(nb.x, 0.0));
      float r = invDepth(uv + vec2(nb.x, 0.0));
      float d = invDepth(uv - vec2(0.0, nb.y));
      float u = invDepth(uv + vec2(0.0, nb.y));
      // How far this pixel stands in front of its neighbors, relative to its
      // own depth (positive only on the near side of a break)
      float bulge = max(c - 0.5 * (l + r), 0.0) + max(c - 0.5 * (d + u), 0.0);
      // (near breaks ink more easily)
      float edge = smoothstep(mix(0.04, 0.03, near), mix(0.12, 0.08, near), bulge / c);
      // Lines thin out with distance so far terrain doesn't turn to scribble
      edge *= mix(1.0, 0.35, smoothstep(1500.0, 9000.0, dist));
      // ...and fade out with the scene's fog, like the surfaces they ink
      float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      edge *= (1.0 - fog) * (1.0 - fog);
      // Ink: the surface's own color darkened, leaning toward indigo close up
      vec3 ink = mix(color * vec3(0.32, 0.27, 0.36), vec3(0.16, 0.13, 0.24), 0.4 * near);
    #ifdef COMIC
      {
        // Water (which zeroes the target's alpha) keeps its swell and glints
        // smooth: no ink, bands or hatching, or the glints turn to scribble
        float water = sky ? 0.0 : 1.0 - texture2D(tColor, uv).a;
        // Color edges are inked too (where the light or the paint changes)
        vec2 tx = vec2(uTexel.x, 0.0);
        vec2 ty = vec2(0.0, uTexel.y);
        float gx = luma(texture2D(tColor, uv + tx).rgb) - luma(texture2D(tColor, uv - tx).rgb);
        float gy = luma(texture2D(tColor, uv + ty).rgb) - luma(texture2D(tColor, uv - ty).rgb);
        float colorEdge = smoothstep(0.1, 0.22, length(vec2(gx, gy)))
                        * (1.0 - smoothstep(800.0, 4000.0, dist));
        edge = max(smoothstep(0.02, 0.06, bulge / c) * (1.0 - fog), colorEdge) * (1.0 - water);
        // (softer on the plane and other things close up)
        ink = mix(vec3(0.12, 0.1, 0.14), color * vec3(0.4, 0.36, 0.44), 0.5 * near);
        // Flat fills: the light in four bands, keeping the hue (the sky stays
        // smooth, or its gradient would break into stripes)
        float lc = luma(color);
        if (!sky) {
          vec3 banded = clamp(color / max(lc, 0.02) * (floor(lc * 4.0) + 0.6) / 4.0, 0.0, 1.0);
          color = mix(color, banded, 0.85 * (1.0 - water));
        }
        // Pastel: a little less saturated, lifted
        color = mix(vec3(luma(color)), color, 0.85) * 0.9 + 0.1;
        // Hatching in the shadows, crossed in the deepest ones; at night,
        // when nearly everything is dark, only a trace of it
        if (!sky) {
          float daylight = mix(0.15, 1.0, smoothstep(0.0, 0.35, uSunDirection.y));
          float hatch = step(0.5, fract((p.x + p.y) / 5.0));
          float crossed = step(0.5, fract((p.x - p.y) / 5.0));
          float shade = 1.0 - smoothstep(0.28, 0.42, lc);
          float deep = 1.0 - smoothstep(0.15, 0.25, lc);
          color = mix(color, ink, ((1.0 - hatch) * shade * 0.55 + (1.0 - crossed) * deep * 0.45) * (1.0 - water) * daylight);
        }
      }
    #endif
      if (uOutline) color = mix(color, ink, edge);
      // Aerial perspective: distant land fades into soft layers of the
      // horizon's color, nudged toward lavender (not the sky itself, whose
      // depth is the far plane)
      if (uHaze && !sky) {
        vec3 haze = mix(uHorizonColor, vec3(0.78, 0.8, 0.95) * dot(uHorizonColor, vec3(0.333)) * 1.1, 0.3);
        color = mix(color, haze, smoothstep(1200.0, 11000.0, dist) * HAZE_STRENGTH);
      }
    #ifdef ANIME
      {
        // Soft glow: the brightest parts (sunlit cloud tops, white paint,
        // glints) bleed a little warm light into their neighbors
        vec3 glow = vec3(0.0);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398;
          vec3 s = texture2D(tColor, uv + vec2(cos(a), sin(a)) * 6.0 * uTexel).rgb;
          glow += max(s - 0.85, 0.0);
        }
        color += glow / 8.0 * vec3(1.0, 0.92, 0.8) * 0.9;
      }
    #endif
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

function ensureTarget() {
  if (!renderer) return;
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
  if (!renderer) return;
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
  u.uKuwahara.value =
    ART_STYLE === 'anime' && brush && state.graphicsPreset !== 'low';
  u.uFogDensity.value = scene.fog ? scene.fog.density || 0 : 0;
  u.uNear.value = camera.near;
  u.uFar.value = camera.far;
  const fxaa = fxaaParam
    ? fxaaParam !== '0'
    : state.graphicsPreset === 'high' || state.graphicsPreset === 'ultra';
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
