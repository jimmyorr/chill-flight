// --- WATERFALLS ---
// A waterfall down a course the terrain worker finds where the land drops
// steeply into water (findWaterfall in terrain-gen.js): a ribbon of falling
// water a little above the slope, with streaks pouring down it, widening
// toward the bottom, and a ring of churning foam where it lands. Both are
// see-through and don't write depth, so the anime outlines leave them alone.
import * as THREE from 'three';
import {WATER_LEVEL, createMaterial} from './constants.js';
import {waterUniforms} from './terrain-geometry.js';

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
// (falling water by default: white, and bright even on the shaded side of a
// cliff)
function fallMaterial(
  pattern,
  color = 0xe8f6fc,
  emissive = 0x5d7380,
  billboard = false
) {
  const mat = createMaterial({
    color,
    emissive,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.uTime = waterUniforms.uTime;
    if (billboard) {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec2 vFallUv;\nvoid main() {')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFallUv = uv;')
        .replace(
          '#include <project_vertex>',
          `vec3 worldCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vWorldPosition = worldCenter;
          vec4 mvPosition = viewMatrix * vec4(worldCenter, 1.0);
          vec2 bbScale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
          mvPosition.xy += position.xy * bbScale;
          gl_Position = projectionMatrix * mvPosition;`
        );
    } else {
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec2 vFallUv;\nvoid main() {')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvFallUv = uv;');
    }
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
  // three.js shares one compiled program between materials whose
  // onBeforeCompile reads the same, as all of these do, so tell them apart
  mat.customProgramCacheKey = () => pattern + (billboard ? '_bb' : '');
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

// The foam where it lands: radiating ripples and churning boil spreading outward
// and thinning gracefully at the edges (uv centered on the landing point)
const foamMat = fallMaterial(`
  vec2 c = vFallUv - 0.5;
  float r = length(c) * 2.0;
  float a = atan(c.y, c.x);

  // Concentric radiating ripples expanding outward from the splash impact
  float ripples = sin(r * 15.0 - uTime * 3.0) * 0.5 + 0.5;

  // Turbulent swirling churn
  float n1 = fallNoise(vec2(a * 4.0, r * 5.0 - uTime * 1.0));
  float n2 = fallNoise(vec2(a * 9.0 + 5.0, r * 9.0 - uTime * 1.6));
  float churn = n1 * 0.6 + n2 * 0.4;

  // Foam pattern combining impact boil, turbulent foam streaks, and expanding ripples
  float boil = smoothstep(0.4, 0.05, r);
  float streaks = smoothstep(0.32, 0.62, churn + ripples * 0.22);
  float edgeFade = 1.0 - smoothstep(0.35, 0.98, r);

  shade = mix(0.92, 1.12, churn);
  alpha = edgeFade * (boil * 0.72 + streaks * 0.62) * 0.82;
`);

// The stream feeding the fall: u across, v downstream in world units.
// Flecks drift downstream; it fades in at its source and at its edges.
const streamMat = fallMaterial(
  `
  float u = vFallUv.x;
  float v = vFallUv.y;
  float fleck = fallNoise(vec2(u * 5.0, v * 0.09 - uTime * 0.9)) * 0.6
              + fallNoise(vec2(u * 9.0 + 5.0, v * 0.16 - uTime * 1.3)) * 0.4;
  float edge = smoothstep(0.0, 0.12, u) * (1.0 - smoothstep(0.88, 1.0, u));
  // Lighter in the shallows along the banks, with white flecks
  shade = mix(1.0, 1.35, 1.0 - smoothstep(0.1, 0.3, min(u, 1.0 - u)));
  shade = mix(shade, 2.2, smoothstep(0.62, 0.85, fleck));
  alpha = edge * smoothstep(0.0, 15.0, v) * 0.95;
`,
  0x2a86d0,
  0x000000
);

// The pond at the stream's source: uv runs from its middle (0.5, 0.5) to its
// edge (length 0.5); slow ripples, and it fades out at the edge
const pondMat = fallMaterial(
  `
  vec2 c = vFallUv - 0.5;
  float r = length(c) * 2.0;
  float ripple = fallNoise(c * 9.0 + vec2(uTime * 0.15, -uTime * 0.1));
  // Deep blue in the middle, lighter in the shallows toward the shore
  shade = mix(0.9, 1.05, ripple) * mix(1.0, 1.45, smoothstep(0.55, 0.92, r));
  alpha = (1.0 - smoothstep(0.92, 1.0, r)) * 0.95;
`,
  0x2a86d0,
  0x000000
);

// The mist: soft procedural billowing spray that drifts and dissolves seamlessly
const mistGeo = new THREE.PlaneGeometry(1, 1);

const mistMat = fallMaterial(
  `
  vec2 c = vFallUv - 0.5;
  float r = length(c) * 2.0;
  if (r >= 1.0) discard;

  // Soft quadratic falloff to exactly zero at the outer circumference
  float soft = 1.0 - r * r;

  // Two octaves of swirling animated billow noise rising upward
  float n1 = fallNoise(vec2(vFallUv.x * 3.5, vFallUv.y * 2.0 - uTime * 0.85));
  float n2 = fallNoise(vec2(vFallUv.x * 7.5 + 3.1, vFallUv.y * 4.5 - uTime * 1.45));
  float noise = n1 * 0.65 + n2 * 0.35;

  // Billowy cloud contours with soft feathering
  float billow = smoothstep(0.2, 0.72, noise + 0.25 * (1.0 - r));

  shade = mix(0.94, 1.14, noise);
  alpha = soft * soft * billow * 0.55;
`,
  0xf0f8ff,
  0x22303a,
  true
);

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

// Steps across the fall
const ACROSS = 16;
// How high the fall lies above the ground
const LIFT = 3;
// The furthest the fall stands out from the rock, and over how many rows
// either side that is smoothed (rows are about 4 units apart)
const MAX_OUT = 50;
const SMOOTH = 6;
// Half the width of a leaping fall (the falls landmark's), top and bottom
const LEAP_HALF = [20, 45];
// How far the middle of a fall bows out, for its half width
const BOW = 0.5;

// How high the stream lies above the ground, its steps across, and how wide
// it is at its source and where it meets the fall
const STREAM_LIFT = 1.5;
const STREAM_ACROSS = 8;
const STREAM_HALF = [4, 9];
// How far a pond can reach from the stream's source, and how wide on average
// it has to be to be worth drawing
const POND_RADIUS = 70;
const POND_MIN_RADIUS = 15;
// How far its water stands above the ground at the source, filling the hollow
const POND_DEPTH = 4;

// The stream along `points` (local [x, y, z], source to lip), lying on the
// ground, as a mesh
function createStream(points, ground) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  const samples = Math.max(4, Math.ceil(curve.getLength() / 4));
  const positions = [];
  const uvs = [];
  const indices = [];
  const p = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  let along = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const before = p.clone();
    curve.getPoint(t, p);
    if (i > 0) along += p.distanceTo(before);
    curve.getTangent(t, tangent);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const half = THREE.MathUtils.lerp(STREAM_HALF[0], STREAM_HALF[1], t);
    for (let k = 0; k <= STREAM_ACROSS; k++) {
      const u = k / STREAM_ACROSS;
      const x = p.x + side.x * (u - 0.5) * 2 * half;
      const z = p.z + side.z * (u - 0.5) * 2 * half;
      const g = groundAt(ground, x, z) ?? p.y;
      positions.push(x, g + STREAM_LIFT, z);
      uvs.push(u, along);
    }
    if (i > 0) {
      const r0 = (i - 1) * (STREAM_ACROSS + 1);
      const r1 = i * (STREAM_ACROSS + 1);
      for (let k = 0; k < STREAM_ACROSS; k++) {
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
  const mesh = new THREE.Mesh(geo, streamMat);
  mesh.renderOrder = 2;
  return mesh;
}

// A pond at the stream's source (local x, z), a little above the ground
// there: out from the source in each direction until the ground rises above
// it (its shore, where the terrain hides the rest) or drops away (where it
// stops, so it doesn't hang over a slope). Null where there's no room for
// one, as on a slope or a peak.
function createPond(x0, z0, ground) {
  const g0 = groundAt(ground, x0, z0);
  if (g0 === null) return null;
  const level = g0 + POND_DEPTH;
  const ANGLES = 32;
  const radii = [];
  for (let a = 0; a < ANGLES; a++) {
    const ang = (a / ANGLES) * Math.PI * 2;
    let r = 0;
    for (let s = 2; s <= POND_RADIUS; s += 2) {
      const g = groundAt(
        ground,
        x0 + Math.cos(ang) * s,
        z0 + Math.sin(ang) * s
      );
      if (g === null || g < level - POND_DEPTH - 2) break;
      r = s;
      // Tuck the edge under the shore
      if (g > level) {
        r = s + 3;
        break;
      }
    }
    radii.push(r);
  }
  // Round it off: no direction reaching much further than those around it,
  // so it doesn't run out in long spikes along the valley
  for (let pass = 0; pass < 2; pass++) {
    const was = radii.slice();
    for (let a = 0; a < ANGLES; a++) {
      let sum = 0;
      for (let j = -4; j <= 4; j++) sum += was[(a + j + ANGLES) % ANGLES];
      radii[a] = Math.min(was[a], sum / 9);
    }
  }
  if (radii.reduce((t, r) => t + r, 0) / ANGLES < POND_MIN_RADIUS) return null;
  const positions = [x0, level, z0];
  const uvs = [0.5, 0.5];
  const indices = [];
  for (let a = 0; a < ANGLES; a++) {
    const ang = (a / ANGLES) * Math.PI * 2;
    positions.push(
      x0 + Math.cos(ang) * radii[a],
      level,
      z0 + Math.sin(ang) * radii[a]
    );
    uvs.push(0.5 + Math.cos(ang) * 0.5, 0.5 + Math.sin(ang) * 0.5);
    indices.push(0, 1 + ((a + 1) % ANGLES), 1 + a);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.unique = true;
  const mesh = new THREE.Mesh(geo, pondMat);
  mesh.renderOrder = 2;
  return mesh;
}

// The waterfall down `course` (local [x, y, z] points, top to bottom, in the
// chunk's frame) over `ground` (the patch of height grid around it; without
// it, the fall follows the course's heights), as a group to add to the chunk.
// Each row across the fall is level, at the height of the ground under its
// middle; where the rock either side stands higher (a gully), the row moves
// out, downhill, until it clears it, so the water hangs in front of the
// gully like a curtain instead of lining it.
export function createWaterfall({course: points, stream, ground, leap}) {
  const group = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  const groundOr = (x, z, fallback) =>
    (ground ? groundAt(ground, x, z) : null) ?? fallback;
  // About every 4 units along the ground, so it follows every fold
  const samples = Math.max(10, Math.ceil(curve.getLength() / 4));
  const rows = [];
  const tangent = new THREE.Vector3();
  let out = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPoint(t);
    curve.getTangent(t, tangent);
    // Downhill and across, both level
    if (tangent.x * tangent.x + tangent.z * tangent.z > 1e-6) {
      out = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
    }
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const half = leap
      ? THREE.MathUtils.lerp(...LEAP_HALF, t)
      : THREE.MathUtils.lerp(9, 17, t);
    // A leaping fall keeps to its course, through the air
    const y = Math.max(
      leap
        ? Math.max(p.y, groundOr(p.x, p.z, -Infinity) + LIFT)
        : groundOr(p.x, p.z, p.y) + LIFT,
      WATER_LEVEL + 0.5
    );
    // How far out the row has to move to clear the rock either side
    let need = 0;
    for (; !leap && need < MAX_OUT; need += 2) {
      let clear = true;
      for (let k = 0; k <= ACROSS && clear; k++) {
        const s = (k / ACROSS - 0.5) * 2 * half;
        const g = groundOr(
          p.x + side.x * s + out.x * need,
          p.z + side.z * s + out.z * need,
          -Infinity
        );
        clear = g + LIFT <= y + 1;
      }
      if (clear) break;
    }
    rows.push({p, out, side, half, y, need});
  }
  // Smooth how far out, never less than a row needs: the largest need
  // nearby, then averaged
  const most = rows.map((_, i) => {
    let m = 0;
    for (
      let j = Math.max(0, i - SMOOTH);
      j <= Math.min(samples, i + SMOOTH);
      j++
    ) {
      m = Math.max(m, rows[j].need);
    }
    return m;
  });
  const positions = [];
  const uvs = [];
  const indices = [];
  const prev = new THREE.Vector3();
  const mid = new THREE.Vector3();
  let along = 0;
  rows.forEach(({p, out: o, side, half, y}, i) => {
    let sum = 0;
    let n = 0;
    for (
      let j = Math.max(0, i - SMOOTH);
      j <= Math.min(samples, i + SMOOTH);
      j++
    ) {
      sum += most[j];
      n++;
    }
    const d = sum / n;
    mid.set(p.x + o.x * d, y, p.z + o.z * d);
    for (let k = 0; k <= ACROSS; k++) {
      const u = (k / ACROSS - 0.5) * 2;
      const s = u * half;
      // Bowed out in the middle, so it has some depth seen edge on, easing
      // in from the lip so the top still meets the stream
      const bow =
        BOW * half * (1 - u * u) * THREE.MathUtils.smoothstep(along, 0, 30);
      const x = mid.x + side.x * s + o.x * bow;
      const z = mid.z + side.z * s + o.z * bow;
      // Never under the rock, wherever the smoothing left it
      positions.push(x, Math.max(y, groundOr(x, z, -Infinity) + LIFT), z);
    }
    // Distance down the fall, for the streaks
    if (i > 0) along += mid.distanceTo(prev);
    prev.copy(mid);
    for (let k = 0; k <= ACROSS; k++) uvs.push(k / ACROSS, along);
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
  });
  // Where it lands, for the mist and foam
  const [bx, bz] = [prev.x, prev.z];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.unique = true;
  const fall = new THREE.Mesh(geo, fallMat);
  fall.renderOrder = 2;
  group.add(fall);

  // Mist rising where it lands: soft puffs, bigger for a taller fall, and
  // spread across the whole of a wide fall's foot
  const drop = points[0][1] - WATER_LEVEL;
  const footHalf = rows[rows.length - 1].half;
  const mistSize = Math.max(
    THREE.MathUtils.clamp(drop * 0.3, 30, 90),
    footHalf * 2.4
  );
  // Mist rising where it lands: soft 3D billowy plumes that churn and billow upward
  const spread = Math.max(mistSize * 0.22, footHalf * 0.8);

  // Central rising spray plume
  const coreMist = new THREE.Mesh(mistGeo, mistMat);
  coreMist.scale.set(mistSize * 0.85, mistSize * 0.85, 1);
  coreMist.position.set(bx, WATER_LEVEL + mistSize * 0.35, bz);
  coreMist.renderOrder = 2;
  group.add(coreMist);

  // Surrounding asymmetrical billow puffs
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(mistGeo, mistMat);
    const a = (i / 4) * Math.PI * 2 + points.length;
    const r = mistSize * (0.6 + (0.25 * ((i * 37) % 10)) / 10);
    puff.scale.set(r, r, 1);
    puff.position.set(
      bx + Math.cos(a) * spread,
      WATER_LEVEL + r * 0.35,
      bz + Math.sin(a) * spread
    );
    puff.renderOrder = 2;
    group.add(puff);
  }

  // For the drifting mist (particles.js)
  group.userData.foot = {x: bx, z: bz, half: footHalf, size: mistSize};

  // Churning foam, a little wider than the fall's foot
  const foamGeo = new THREE.CircleGeometry(Math.max(24, footHalf * 1.4), 32);
  foamGeo.rotateX(-Math.PI / 2);
  foamGeo.userData.unique = true;
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.set(bx, WATER_LEVEL + 0.3, bz);
  foam.renderOrder = 2;
  group.add(foam);

  // The stream feeding it, and a pond at its source where there's room
  if (stream && stream.length > 1 && ground) {
    group.add(createStream(stream, ground));
    const pond = createPond(stream[0][0], stream[0][2], ground);
    if (pond) group.add(pond);
  }
  return group;
}
