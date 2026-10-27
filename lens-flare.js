// --- LENS FLARE ---
// A subtle flare when looking toward the sun: a faint warm halo and a few
// pale ghosts mirrored through the middle of the screen. Based on three.js's
// Lensflare add-on: as the last thing drawn each frame it draws a small test
// quad at the sun, depth tested so terrain and planes in front block it, and
// copies those 16x16 pixels back to see how much of the sun shows. Its test
// quad here also checks the sky shader's clouds (which write no depth) along
// the sun's direction, so the flare fades behind clouds too. It fades out as
// the sun sets, toward the screen's edges, and is off in VR (a flare there
// reads as a smudge on the lens) and on the low preset. ?flare=0 turns it
// off, for comparing.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {CLOUD_GLSL} from './constants.js';
import {scene} from './scene.js';
import {skyUniforms} from './sky-uniforms.js';
import {state} from './state.js';

// How bright the flare is overall: ?flare=2 doubles it, ?flare=0 turns it
// off
const flareParam = ChillFlightLogic.urlParams.get('flare');
const FLARE_STRENGTH =
  flareParam !== null && flareParam !== '' && isFinite(flareParam)
    ? Number(flareParam)
    : 1;
const enabled = FLARE_STRENGTH > 0;

// The flare's pieces: where along the line from the sun (0) through the
// middle of the screen (0.5) to the far side (1), size as a share of the
// screen's height, color (added to the frame), and which texture
const ELEMENTS = [
  {distance: 0, size: 0.55, color: [0.16, 0.12, 0.07], map: 'halo'},
  {distance: 0.38, size: 0.05, color: [0.06, 0.07, 0.05], map: 'disc'},
  {distance: 0.62, size: 0.09, color: [0.05, 0.05, 0.08], map: 'ring'},
  {distance: 0.8, size: 0.035, color: [0.07, 0.06, 0.04], map: 'disc'},
  {distance: 1.05, size: 0.16, color: [0.04, 0.05, 0.06], map: 'ring'},
];

// A soft round texture: brightness by distance from the middle (0 to 1)
function makeTexture(profile) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const v = Math.round(255 * Math.max(0, Math.min(1, profile(r))));
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = v;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeTextures() {
  return {
    // Bright in the middle, fading out with a long tail
    halo: makeTexture((r) => Math.pow(Math.max(0, 1 - r), 2.5)),
    // A soft-edged disc, a little brighter at its rim, like a lens ghost
    disc: makeTexture(
      (r) => (0.6 + 0.4 * smooth(0.5, 0.85, r)) * smooth(1, 0.85, r)
    ),
    // A thin soft ring with a faint fill
    ring: makeTexture(
      (r) =>
        0.25 * smooth(1, 0.8, r) +
        0.75 * Math.exp(-Math.pow((r - 0.82) / 0.07, 2))
    ),
  };
}

const quadGeometry = new THREE.BufferGeometry();
quadGeometry.setAttribute(
  'position',
  new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)
);
quadGeometry.setAttribute(
  'uv',
  new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)
);
quadGeometry.setIndex([0, 1, 2, 0, 2, 3]);

const quadVertex = /* glsl */ `
  uniform vec3 screenPosition;
  uniform vec2 scale;
  varying vec2 vUV;
  void main() {
    vUV = uv;
    gl_Position = vec4(position.xy * scale + screenPosition.xy, screenPosition.z, 1.0);
  }
`;

// The test quad: where it passes the depth test, red and blue for how
// clear of clouds the sun is (green stays 0, so leftover scene pixels
// rarely read as clear)
const testMaterial = new THREE.ShaderMaterial({
  uniforms: {
    scale: {value: new THREE.Vector2()},
    screenPosition: {value: new THREE.Vector3()},
    sunDirection: skyUniforms.sunDirection,
    uCameraPos: skyUniforms.uCameraPos,
    uCloudHeight: skyUniforms.uCloudHeight,
    uCloudDensity: skyUniforms.uCloudDensity,
    uShowClouds: skyUniforms.uShowClouds,
    uTime: skyUniforms.uTime,
    topColor: skyUniforms.topColor,
    bottomColor: skyUniforms.bottomColor,
    uNoiseTex: skyUniforms.uNoiseTex,
    uMoonDir: skyUniforms.uMoonDir,
    uMoonBright: skyUniforms.uMoonBright,
    uCloudTypes: skyUniforms.uCloudTypes,
    uCloudCover: skyUniforms.uCloudCover,
    uSnowDeck: skyUniforms.uSnowDeck,
  },
  vertexShader: quadVertex,
  fragmentShader:
    CLOUD_GLSL +
    /* glsl */ `
    uniform vec3 sunDirection;
    uniform vec3 uCameraPos;
    uniform float uCloudHeight;
    uniform float uCloudDensity;
    uniform bool uShowClouds;
    uniform float uTime;
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    void main() {
      float clouds = 0.0;
      if (uShowClouds) {
        float h = uCloudHeight > 0.0 ? uCloudHeight : 3000.0;
        clouds = cloudsAlong(uCameraPos, sunDirection, h, uCloudDensity, uTime,
                             sunDirection, topColor, bottomColor).a;
      }
      float clear = 1.0 - clouds;
      gl_FragColor = vec4(clear, 0.0, clear, 1.0);
    }
  `,
  depthTest: true,
  depthWrite: false,
});

// Puts back the pixels the test quad drew over
const restoreMaterial = new THREE.ShaderMaterial({
  uniforms: {
    map: {value: null},
    scale: {value: new THREE.Vector2()},
    screenPosition: {value: new THREE.Vector3()},
  },
  vertexShader: quadVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    varying vec2 vUV;
    void main() {
      gl_FragColor = texture2D(map, vUV);
    }
  `,
  depthTest: false,
  depthWrite: false,
});

const elementMaterial = new THREE.ShaderMaterial({
  uniforms: {
    map: {value: null},
    occlusionMap: {value: null},
    color: {value: new THREE.Color()},
    scale: {value: new THREE.Vector2()},
    screenPosition: {value: new THREE.Vector3()},
  },
  vertexShader: /* glsl */ `
    uniform vec3 screenPosition;
    uniform vec2 scale;
    uniform sampler2D occlusionMap;
    varying vec2 vUV;
    varying float vVisibility;
    void main() {
      vUV = uv;
      vec4 v = texture2D(occlusionMap, vec2(0.1, 0.1));
      v += texture2D(occlusionMap, vec2(0.5, 0.1));
      v += texture2D(occlusionMap, vec2(0.9, 0.1));
      v += texture2D(occlusionMap, vec2(0.9, 0.5));
      v += texture2D(occlusionMap, vec2(0.9, 0.9));
      v += texture2D(occlusionMap, vec2(0.5, 0.9));
      v += texture2D(occlusionMap, vec2(0.1, 0.9));
      v += texture2D(occlusionMap, vec2(0.1, 0.5));
      v += texture2D(occlusionMap, vec2(0.5, 0.5));
      v /= 9.0;
      vVisibility = v.r * (1.0 - v.g) * v.b;
      gl_Position = vec4(position.xy * scale + screenPosition.xy, screenPosition.z, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform vec3 color;
    varying vec2 vUV;
    varying float vVisibility;
    void main() {
      gl_FragColor = vec4(color * texture2D(map, vUV).a * vVisibility, 1.0);
    }
  `,
  // Added to the color, leaving the target's alpha alone: the art styles'
  // post pass reads alpha 0 as water (see waterMaterial), and additive
  // blending's alpha turned each ghost's square into land there
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
  transparent: true,
  depthTest: false,
  depthWrite: false,
});

const _viewport = new THREE.Vector4();
const _sunPoint = new THREE.Vector3();
const _screen = new THREE.Vector3();
const _corner = new THREE.Vector2();
const _camPos = new THREE.Vector3();

function createFlare() {
  const textures = makeTextures();
  let tempMap = new THREE.FramebufferTexture(16, 16);
  let occlusionMap = new THREE.FramebufferTexture(16, 16);
  let mapType = THREE.UnsignedByteType;
  const testMesh = new THREE.Mesh(quadGeometry, testMaterial);
  const elementMesh = new THREE.Mesh(quadGeometry, elementMaterial);

  // Drawn last; the flare does its drawing in onBeforeRender, so the mesh
  // itself draws nothing
  const flare = new THREE.Mesh(
    quadGeometry,
    new THREE.MeshBasicMaterial({
      opacity: 0,
      transparent: true,
      depthWrite: false,
    })
  );
  flare.frustumCulled = false;
  flare.renderOrder = Infinity;

  flare.onBeforeRender = (renderer, _scene, camera) => {
    if (renderer.xr.isPresenting || state.graphicsPreset === 'low') return;
    const sun = skyUniforms.sunDirection.value;
    // Gone once the sun is down, fading in as it rises
    const sunUp = smooth(-0.01, 0.05, sun.y);
    if (sunUp <= 0) return;

    // The sun as a point just inside the far plane, on screen
    camera.getWorldPosition(_camPos);
    _sunPoint
      .copy(sun)
      .multiplyScalar(camera.far * 0.95)
      .add(_camPos);
    _screen.copy(_sunPoint).applyMatrix4(camera.matrixWorldInverse);
    if (_screen.z > 0) return;
    _screen.applyMatrix4(camera.projectionMatrix);
    // Fading toward the screen's edges rather than vanishing there
    const edge = Math.max(Math.abs(_screen.x), Math.abs(_screen.y));
    const fade = sunUp * smooth(1, 0.8, edge) * FLARE_STRENGTH;
    if (fade <= 0) return;

    renderer.getCurrentViewport(_viewport);
    const target = renderer.getRenderTarget();
    const type = target ? target.texture.type : THREE.UnsignedByteType;
    if (type !== mapType) {
      tempMap.dispose();
      occlusionMap.dispose();
      tempMap = new THREE.FramebufferTexture(16, 16);
      occlusionMap = new THREE.FramebufferTexture(16, 16);
      tempMap.type = occlusionMap.type = type;
      mapType = type;
    }
    const w = _viewport.z;
    const h = _viewport.w;
    _corner.set(
      Math.round(_viewport.x + (_screen.x * 0.5 + 0.5) * w - 8),
      Math.round(_viewport.y + (_screen.y * 0.5 + 0.5) * h - 8)
    );
    if (
      _corner.x < _viewport.x ||
      _corner.y < _viewport.y ||
      _corner.x > _viewport.x + w - 16 ||
      _corner.y > _viewport.y + h - 16
    ) {
      return;
    }

    // Test how much of the sun shows, then put the pixels back
    const testScale = testMaterial.uniforms.scale.value.set(16 / w, 16 / h);
    testMaterial.uniforms.screenPosition.value.copy(_screen);
    renderer.copyFramebufferToTexture(tempMap, _corner);
    renderer.renderBufferDirect(
      camera,
      null,
      quadGeometry,
      testMaterial,
      testMesh,
      null
    );
    renderer.copyFramebufferToTexture(occlusionMap, _corner);
    restoreMaterial.uniforms.map.value = tempMap;
    restoreMaterial.uniforms.scale.value.copy(testScale);
    restoreMaterial.uniforms.screenPosition.value.copy(_screen);
    renderer.renderBufferDirect(
      camera,
      null,
      quadGeometry,
      restoreMaterial,
      testMesh,
      null
    );

    const u = elementMaterial.uniforms;
    u.occlusionMap.value = occlusionMap;
    for (const el of ELEMENTS) {
      u.map.value = textures[el.map];
      u.color.value
        .setRGB(el.color[0], el.color[1], el.color[2])
        .multiplyScalar(fade);
      // Along the line from the sun through the middle of the screen
      u.screenPosition.value.set(
        _screen.x * (1 - 2 * el.distance),
        _screen.y * (1 - 2 * el.distance),
        _screen.z
      );
      u.scale.value.set((el.size * h) / w, el.size);
      elementMaterial.uniformsNeedUpdate = true;
      renderer.renderBufferDirect(
        camera,
        null,
        quadGeometry,
        elementMaterial,
        elementMesh,
        null
      );
    }
  };
  return flare;
}

if (enabled) scene.add(createFlare());
