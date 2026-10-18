// The plane's shadow on water. Over land the plane casts into the sun's
// shadow map like everything else, so its shadow drapes over trees, roofs and
// hills. On water the shadow map's few texels across the plane break into a
// flickering comb, so there the plane stops casting and its silhouette is
// drawn instead: each frame the plane is rendered from the sun into a small
// texture, and a quad on the water samples it by projecting its own pixels
// along the sun, so the outline follows banking, pitch and rolls. The blur
// grows with height like a real penumbra.
import * as THREE from 'three';
import {WATER_LEVEL} from './constants.js';
import {scene} from './scene.js';
import {renderer, dirLight, hemiLight} from './sky.js';
import {planeGroup} from './airplane.js';
import {sampleGround} from './terrain-geometry.js';
import {state} from './state.js';

const LAYER = 7;
const SIZE = 256;
// Gone once the blur swallows the plane, a bit over a kilometre up
const FADE_START = 500;
const FADE_END = 1200;
// Penumbra: a soft base plus a share of the distance along the sun ray,
// tuned so the switch at the coast matches the shadow map's blur
const BLUR_BASE = 1.6;
const BLUR_PER_METRE = 0.01;
// The water under the shadow has to be this deep before the silhouette takes
// over, and it hands back as soon as the shadow reaches land, so a shadow
// skimming along a beach doesn't flip back and forth
const COAST_BAND = 1;

const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
  minFilter: THREE.LinearMipmapLinearFilter,
  magFilter: THREE.LinearFilter,
  generateMipmaps: true,
  depthBuffer: true,
});
const shadowCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
shadowCam.layers.set(LAYER);
const coverMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  fog: false,
  side: THREE.DoubleSide,
});

const decalMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tMap: {value: target.texture},
    shadowMatrix: {value: new THREE.Matrix4()},
    blurUV: {value: 0.01},
    lod: {value: 0},
    strength: {value: 0.5},
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tMap;
    uniform mat4 shadowMatrix;
    uniform float blurUV;
    uniform float lod;
    uniform float strength;
    varying vec3 vWorld;
    const vec2 TAPS[8] = vec2[8](
      vec2(0.0, 0.0), vec2(0.71, 0.0), vec2(-0.71, 0.0), vec2(0.0, 0.71),
      vec2(0.0, -0.71), vec2(0.5, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
    void main() {
      vec4 p = shadowMatrix * vec4(vWorld, 1.0);
      vec2 uv = p.xy * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
      float cover = 0.0;
      for (int i = 0; i < 8; i++) {
        cover += textureLod(tMap, uv + TAPS[i] * blurUV, lod).r;
      }
      cover /= 8.0;
      if (cover < 0.004) discard;
      gl_FragColor = vec4(0.0, 0.0, 0.0, cover * strength);
    }
  `,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4,
});

const decal = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  decalMaterial
);
decal.frustumCulled = false;
decal.renderOrder = 10;
decal.visible = false;
scene.add(decal);

let measuredModel = null;
let halfExtent = 8;
let overWater = false;
// One of the plane's meshes, to tell whether its shadow casting still
// matches what this module last set (the graphics preset resets it)
let sampleMesh = null;
const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _sun = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _ground = {height: 0, slopeX: 0, slopeZ: 0};
const _hit = {x: 0, z: 0, terrain: 0, along: 0};
const _yAxis = new THREE.Vector3(0, 1, 0);
const _clear = new THREE.Color();

// Measures a newly loaded plane and puts it on the silhouette layer
function prepareModel() {
  const model = state.airplaneModel;
  if (!model || model === measuredModel) return;
  measuredModel = model;
  const rot = planeGroup.rotation.clone();
  planeGroup.rotation.set(0, 0, 0);
  planeGroup.updateMatrixWorld(true);
  _box.setFromObject(model).getSize(_size);
  planeGroup.rotation.copy(rot);
  halfExtent = 0.5 * Math.hypot(_size.x, _size.y, _size.z) + 0.5;
  sampleMesh = null;
  planeGroup.traverse((child) => {
    if (child.isMesh) {
      child.layers.enable(LAYER);
      sampleMesh ??= child;
    }
  });
}

function setPlaneCastsShadow(on) {
  if (!sampleMesh || sampleMesh.castShadow === on) return;
  planeGroup.traverse((child) => {
    if (child.isMesh) child.castShadow = on;
  });
}

// Follows the sun ray from the plane down to the land or water (twice, so it
// lands on slopes) and leaves where it hit in _hit
function traceToSurface(p) {
  let x = p.x;
  let z = p.z;
  let surface = 0;
  for (let i = 0; i < 3; i++) {
    sampleGround(x, z, _ground);
    surface = Math.max(_ground.height, WATER_LEVEL);
    if (i === 2) break;
    const t = Math.max(0, p.y - surface) / _sun.y;
    x = p.x - _sun.x * t;
    z = p.z - _sun.z * t;
  }
  _hit.x = x;
  _hit.z = z;
  _hit.terrain = _ground.height;
  _hit.along = Math.max(0, p.y - surface) / _sun.y;
}

// Call once a frame before the main render
export function updatePlaneShadow() {
  prepareModel();
  // The low preset turns shadows off altogether
  if (!dirLight.castShadow || !planeGroup.visible) {
    decal.visible = false;
    return;
  }
  _sun.set(state.sunX, Math.max(0.15, state.sunY), state.sunZ).normalize();
  const p = planeGroup.position;
  traceToSurface(p);
  overWater = _hit.terrain < WATER_LEVEL - (overWater ? 0 : COAST_BAND);
  setPlaneCastsShadow(!overWater);

  const fade = 1 - THREE.MathUtils.smoothstep(_hit.along, FADE_START, FADE_END);
  // The sun's share of the light on flat ground is what the shadow takes away,
  // so it fades out at night and under overcast
  const sunLight = dirLight.intensity * _sun.y;
  const strength =
    (fade * sunLight) / Math.max(1e-3, sunLight + hemiLight.intensity);
  if (!overWater || strength < 0.01) {
    decal.visible = false;
    return;
  }

  // Draw the plane's silhouette from the sun
  _right.crossVectors(_yAxis, _sun);
  if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
  _right.normalize();
  _up.crossVectors(_sun, _right).normalize();
  shadowCam.position.copy(p).addScaledVector(_sun, 300);
  shadowCam.up.copy(_up);
  shadowCam.lookAt(p);
  shadowCam.left = -halfExtent;
  shadowCam.right = halfExtent;
  shadowCam.top = halfExtent;
  shadowCam.bottom = -halfExtent;
  shadowCam.updateProjectionMatrix();
  shadowCam.updateMatrixWorld();

  const prevTarget = renderer.getRenderTarget();
  const prevBackground = scene.background;
  const prevOverride = scene.overrideMaterial;
  const prevShadows = renderer.shadowMap.enabled;
  const prevXr = renderer.xr.enabled;
  renderer.getClearColor(_clear);
  const prevAlpha = renderer.getClearAlpha();
  scene.background = null;
  scene.overrideMaterial = coverMaterial;
  renderer.shadowMap.enabled = false;
  renderer.xr.enabled = false;
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, shadowCam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(_clear, prevAlpha);
  renderer.xr.enabled = prevXr;
  renderer.shadowMap.enabled = prevShadows;
  scene.overrideMaterial = prevOverride;
  scene.background = prevBackground;

  const u = decalMaterial.uniforms;
  u.shadowMatrix.value.multiplyMatrices(
    shadowCam.projectionMatrix,
    shadowCam.matrixWorldInverse
  );
  const blurUV = (BLUR_BASE + _hit.along * BLUR_PER_METRE) / (2 * halfExtent);
  u.blurUV.value = blurUV;
  u.lod.value = Math.max(0, Math.log2(blurUV * SIZE) - 0.5);
  u.strength.value = strength;

  // A flat quad on the water, big enough for the plane's footprint along the
  // sun. Near the coast the beach hides whatever part of it reaches inland.
  decal.position.set(_hit.x, WATER_LEVEL + 0.05, _hit.z);
  const side = (2.4 * halfExtent) / _sun.y;
  decal.scale.set(side, 1, side);
  decal.visible = true;
}
