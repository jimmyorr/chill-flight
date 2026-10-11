// --- WATERFALLS ---
// A waterfall down a course the terrain worker finds where the land drops
// steeply into water (findWaterfall in terrain-gen.js): a ribbon of falling
// water a little above the slope, with streaks pouring down it, widening
// toward the bottom, and a ring of churning foam where it lands. Both are
// see-through and don't write depth, so the anime outlines leave them alone.
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import {waterUniforms} from './terrain-geometry.js';

const WATER_LEVEL = 40;

// Value noise for the streaks and foam
const NOISE_GLSL = `
  float fallHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float fallNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(fallHash(i), fallHash(i + vec2(1.0, 0.0)), u.x),
               mix(fallHash(i + vec2(0.0, 1.0)), fallHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

// A see-through water material whose color and opacity come from `pattern`
// (GLSL that sets float shade and float alpha from vec2 vFallUv and uTime),
// on top of the game's usual lighting and fog
function fallMaterial(pattern) {
  const mat = createMaterial({
    color: 0xe8f6fc,
    // Falling water is bright even on the shaded side of a cliff
    emissive: 0x5d7380,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec2 vFallUv;\nvoid main() {')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFallUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uTime;
        varying vec2 vFallUv;
        ${NOISE_GLSL}
        void main() {`
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        {
          float shade = 1.0;
          float alpha = 1.0;
          ${pattern}
          diffuseColor.rgb *= shade;
          diffuseColor.a *= alpha;
        }`
      );
  };
  return mat;
}

// The falling water: u across (0 to 1), v down the fall in world units.
// Two layers of streaks pour down at different speeds; the edges are ragged
// and the top fades in where the stream leaves the rock.
const fallMat = fallMaterial(`
  float u = vFallUv.x;
  float v = vFallUv.y;
  float s1 = fallNoise(vec2(u * 9.0, v * 0.07 - uTime * 1.1));
  float s2 = fallNoise(vec2(u * 17.0 + 3.0, v * 0.12 - uTime * 1.6));
  float streak = s1 * 0.6 + s2 * 0.4;
  float rag = fallNoise(vec2(v * 0.05 - uTime * 0.6, u * 2.0)) * 0.12;
  float edge = smoothstep(rag, 0.22 + rag, u) * (1.0 - smoothstep(0.78 - rag, 1.0 - rag, u));
  shade = mix(0.85, 1.12, streak);
  alpha = edge * smoothstep(0.0, 10.0, v) * mix(0.72, 1.0, streak);
`);

// The foam where it lands: rings of churned water spreading outward and
// thinning at the edge (uv centered on the landing point)
const foamMat = fallMaterial(`
  vec2 c = vFallUv - 0.5;
  float r = length(c) * 2.0;
  float a = atan(c.y, c.x);
  float foam = fallNoise(vec2(a * 5.0, r * 6.0 - uTime * 0.9))
             * 0.6 + fallNoise(vec2(a * 11.0 + 7.0, r * 11.0 - uTime * 1.4)) * 0.4;
  shade = mix(0.9, 1.08, foam);
  alpha = (1.0 - smoothstep(0.35, 1.0, r)) * smoothstep(0.35, 0.65, foam + 0.3 * (1.0 - r));
`);

// The mist: a soft round puff, white and see-through
function mistTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
const mistMat = new THREE.SpriteMaterial({
  map: typeof document !== 'undefined' ? mistTexture() : null,
  color: 0xf4fbff,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  fog: true,
});

// The terrain's height at local (x, z) as drawn: the triangles of the
// chunk's terrain mesh (a PlaneGeometry, split along each cell's
// (x, z + 1) to (x + 1, z) diagonal) over the patch of height grid the worker
// sent. Null outside the patch.
function groundAt(ground, x, z) {
  const fx = (x - ground.x) / ground.step;
  const fz = (z - ground.z) / ground.step;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= ground.cols - 1 || iz >= ground.rows - 1) {
    return null;
  }
  const tx = fx - ix;
  const tz = fz - iz;
  const h = ground.heights;
  const i = iz * ground.cols + ix;
  const a = h[i];
  const b = h[i + ground.cols];
  const c = h[i + ground.cols + 1];
  const d = h[i + 1];
  return tx + tz <= 1
    ? a + (d - a) * tx + (b - a) * tz
    : c + (b - c) * (1 - tx) + (d - c) * (1 - tz);
}

// Steps across the fall, so it can bend over a slope that also leans sideways
const ACROSS = 16;
// How high the fall lies above the ground
const LIFT = 3;

// The waterfall down `course` (local [x, y, z] points, top to bottom, in the
// chunk's frame), lying on `ground` (the patch of height grid around it;
// without it, the fall follows the course's heights), as a group to add to
// the chunk
export function createWaterfall({course: points, ground}) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  // About every 4 units along the ground, so it follows every fold
  const samples = Math.max(10, Math.ceil(curve.getLength() / 4));
  const positions = [];
  const uvs = [];
  const indices = [];
  const p = new THREE.Vector3();
  const prev = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  let along = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    curve.getPoint(t, p);
    curve.getTangent(t, tangent);
    // Across the fall, level
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const half = THREE.MathUtils.lerp(9, 17, t);
    let mid = p.y;
    for (let k = 0; k <= ACROSS; k++) {
      const u = k / ACROSS;
      const x = p.x + side.x * (u - 0.5) * 2 * half;
      const z = p.z + side.z * (u - 0.5) * 2 * half;
      const g = ground ? groundAt(ground, x, z) : null;
      const y = Math.max((g ?? p.y) + LIFT, WATER_LEVEL + 0.5);
      if (k === ACROSS / 2) mid = y;
      positions.push(x, y, z);
      uvs.push(u, 0);
    }
    // Distance down the fall, measured on the ground, for the streaks
    p.y = mid;
    if (i > 0) along += p.distanceTo(prev);
    prev.copy(p);
    for (let k = 0; k <= ACROSS; k++) {
      uvs[(i * (ACROSS + 1) + k) * 2 + 1] = along;
    }
    if (i > 0) {
      const r0 = (i - 1) * (ACROSS + 1);
      const r1 = i * (ACROSS + 1);
      for (let k = 0; k < ACROSS; k++) {
        indices.push(
          r0 + k,
          r0 + k + 1,
          r1 + k,
          r0 + k + 1,
          r1 + k + 1,
          r1 + k
        );
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.unique = true;
  const fall = new THREE.Mesh(geo, fallMat);
  fall.renderOrder = 2;
  group.add(fall);

  // Mist rising where it lands: soft puffs, bigger for a taller fall
  const drop = points[0][1] - WATER_LEVEL;
  const mistSize = THREE.MathUtils.clamp(drop * 0.3, 30, 90);
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Sprite(mistMat);
    const a = (i / 4) * Math.PI * 2 + points.length;
    const size = mistSize * (0.7 + (0.3 * ((i * 37) % 10)) / 10);
    puff.scale.set(size, size * 0.8, 1);
    const [mx, , mz] = points[points.length - 1];
    puff.position.set(
      mx + Math.cos(a) * mistSize * 0.25,
      WATER_LEVEL + size * 0.3,
      mz + Math.sin(a) * mistSize * 0.25
    );
    group.add(puff);
  }

  const foamGeo = new THREE.CircleGeometry(24, 32);
  foamGeo.rotateX(-Math.PI / 2);
  foamGeo.userData.unique = true;
  const foam = new THREE.Mesh(foamGeo, foamMat);
  const [bx, , bz] = points[points.length - 1];
  foam.position.set(bx, WATER_LEVEL + 0.6, bz);
  foam.renderOrder = 2;
  group.add(foam);
  return group;
}
