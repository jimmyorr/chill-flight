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
  {
    billboard = false,
    vertexHeader = '',
    vertexBody = '',
    fragmentHeader = '',
    crestColor = null,
  } = {}
) {
  const mat = createMaterial({
    color,
    emissive,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.userData.noShadow = true;
  const uCrestColor = crestColor ? {value: new THREE.Color(crestColor)} : null;
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer);
    shader.uniforms.uTime = waterUniforms.uTime;
    if (uCrestColor) shader.uniforms.uCrestColor = uCrestColor;
    if (billboard) {
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `varying vec2 vFallUv;\nattribute vec3 aPuffCenter;\nattribute float aPuffScale;\n${vertexHeader}\nvoid main() {`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>\nvFallUv = uv;\n${vertexBody}`
        )
        .replace(
          '#include <project_vertex>',
          `vec3 worldCenter = (modelMatrix * vec4(aPuffCenter, 1.0)).xyz;
          vWorldPosition = worldCenter;
          vec4 mvPosition = viewMatrix * vec4(worldCenter, 1.0);
          mvPosition.xy += position.xy * aPuffScale;
          gl_Position = projectionMatrix * mvPosition;`
        );
    } else {
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          `varying vec2 vFallUv;\n${vertexHeader}\nvoid main() {`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>\nvFallUv = uv;\n${vertexBody}`
        );
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uTime;
        varying vec2 vFallUv;
        ${fragmentHeader}
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
  mat.customProgramCacheKey = () =>
    pattern + (billboard ? '_bb' : '') + vertexHeader;
  return mat;
}

// The falling water: u across (0 to 1), v down the fall in world units.
// Two layers of streaks pour down at different speeds; the edges are ragged
// and the top fades in over the frothing end of the stream before the brink,
// carrying ragged tongues of stream-colored water over the lip before breaking
// into white spray.
const FALL_PATTERN = `
  // Seconds after leaving the lip that the water is v units down
  const float V0 = 15.0;
  const float G = 9.8;
  const float VMAX = 50.0;
  const float FREE = (VMAX * VMAX - V0 * V0) / (2.0 * G);
  float u = vFallUv.x;
  float v = vFallUv.y;
  float t = (sqrt(V0 * V0 + 2.0 * G * min(v, FREE)) - V0) / G
          + max(v - FREE, 0.0) / VMAX;
  // uTime runs 1.5 times as fast as seconds
  float now = uTime / 1.5;
  float s1 = fallNoise(vec2(u * 9.0, (t - now) * 1.4));
  float s2 = fallNoise(vec2(u * 17.0 + 3.0, (t - now * 1.15) * 2.0));
  float streak = s1 * 0.6 + s2 * 0.4;
  float rag = fallNoise(vec2((t - now * 0.8) * 0.9, u * 2.0)) * 0.11;
  float edge = smoothstep(rag, 0.18 + rag, u) * (1.0 - smoothstep(0.82 - rag, 1.0 - rag, u));

  // Carry streaky tongues of the stream's blue/turquoise water over the
  // rounded brink before gravity breaks the jet into white spray
  float centerCore = smoothstep(0.08, 0.34, min(u, 1.0 - u));
  float crestTongue = (1.0 - smoothstep(5.0, 27.0, v + (1.0 - streak) * 14.0)) * centerCore;
  diffuseColor.rgb = mix(diffuseColor.rgb, uCrestColor, crestTongue * 0.72);

  shade = mix(0.86, 1.12, streak);
  float brinkSolid = 1.0 - smoothstep(12.0, 34.0, v);
  float density = mix(mix(0.76, 1.0, streak), mix(0.90, 1.0, streak), brinkSolid);
  alpha = edge * smoothstep(0.0, 11.0, v + (streak - 0.5) * 4.0) * density;
`;
const fallMat = fallMaterial(FALL_PATTERN, 0xe8f6fc, 0x5d7380, {
  fragmentHeader: 'uniform vec3 uCrestColor;',
  crestColor: 0x3a9be0,
});
const oasisFallMat = fallMaterial(FALL_PATTERN, 0xe8f6fc, 0x5d7380, {
  fragmentHeader: 'uniform vec3 uCrestColor;',
  crestColor: 0x1db2c4,
});

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

// The stream feeding the fall (and its spring pool head when there is no
// separate enclosed tarn): u across, v downstream in world units, and
// aStreamMeta = (toLip, headAlpha, poolMix). Calm ripples in the spring pool
// give way to drifting flecks in the channel, then churn into ragged tongues
// of white foam and fade out as the fall takes over at the brink.
const STREAM_PATTERN = `
  float u = vFallUv.x;
  float v = vFallUv.y;
  float toLip = vStreamMeta.x;
  float headAlpha = vStreamMeta.y;
  float poolMix = vStreamMeta.z;

  vec2 poolUv = vec2((u - 0.5) * 2.2, v * 0.05);
  float poolRipple = fallNoise(poolUv * 5.5 + vec2(uTime * 0.14, -uTime * 0.10)) * 0.65
                   + fallNoise(poolUv * 11.0 - vec2(uTime * 0.09, uTime * 0.15)) * 0.35;
  float streamFleck = fallNoise(vec2(u * 5.0, v * 0.09 - uTime * 0.9)) * 0.6
                    + fallNoise(vec2(u * 9.0 + 5.0, v * 0.16 - uTime * 1.3)) * 0.4;
  float tex = mix(streamFleck, poolRipple, poolMix);

  float bank = min(u, 1.0 - u);
  float edgeW = mix(0.13, 0.16, poolMix);
  float edge = smoothstep(0.0, edgeW, u) * (1.0 - smoothstep(1.0 - edgeW, 1.0, u));

  // Slightly lighter in the shallows along the banks, with bright current flecks
  shade = mix(0.94, 1.14, 1.0 - smoothstep(0.08, 0.30, bank));
  shade = mix(shade, mix(1.85, 1.24, poolMix), smoothstep(0.65, 0.88, tex));

  // Break into longitudinal streaks of white foam rather than a straight cutoff
  float lipStreak = toLip + (streamFleck - 0.5) * 10.0;
  float lipRush = 1.0 - smoothstep(2.0, 18.0, lipStreak);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.98, 1.0), lipRush * 0.95);
  shade = mix(shade, 1.32, lipRush * 0.9);

  float lipFade = smoothstep(-1.5, 9.0, lipStreak);
  alpha = edge * headAlpha * lipFade * 0.94;
`;
const STREAM_SHADER_OPTS = {
  vertexHeader: 'attribute vec3 aStreamMeta;\nvarying vec3 vStreamMeta;',
  vertexBody: 'vStreamMeta = aStreamMeta;',
  fragmentHeader: 'varying vec3 vStreamMeta;',
};
const streamMat = fallMaterial(
  STREAM_PATTERN,
  0x2b8fdb,
  0x0a1c2a,
  STREAM_SHADER_OPTS
);
const oasisStreamMat = fallMaterial(
  STREAM_PATTERN,
  0x18a3b5,
  0x082228,
  STREAM_SHADER_OPTS
);

// An enclosed tarn at the stream's source: vFallUv is world-scaled around the
// middle so ripples stay uniform even in an oval hollow, and aPondShore runs
// from 0 in the middle to 1 at the shore.
const POND_PATTERN = `
  float shore = vPondShore;
  float ripple = fallNoise(vFallUv * 7.5 + vec2(uTime * 0.14, -uTime * 0.10)) * 0.65
               + fallNoise(vFallUv * 15.0 - vec2(uTime * 0.08, uTime * 0.13)) * 0.35;
  shade = mix(0.92, 1.06, ripple) * mix(1.0, 1.15, smoothstep(0.58, 0.90, shore));
  alpha = (1.0 - smoothstep(0.88, 1.0, shore)) * 0.94;
`;
const POND_SHADER_OPTS = {
  vertexHeader: 'attribute float aPondShore;\nvarying float vPondShore;',
  vertexBody: 'vPondShore = aPondShore;',
  fragmentHeader: 'varying float vPondShore;',
};
const pondMat = fallMaterial(
  POND_PATTERN,
  0x2b8fdb,
  0x0a1c2a,
  POND_SHADER_OPTS
);
const oasisPondMat = fallMaterial(
  POND_PATTERN,
  0x18a3b5,
  0x082228,
  POND_SHADER_OPTS
);

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
  {billboard: true}
);

// Batches all 5 mist puffs of a waterfall into one 10-triangle billboard mesh
function createMistPlume(bx, bz, mistSize, spread, pointsLen) {
  const specs = [[bx, WATER_LEVEL + mistSize * 0.35, bz, mistSize * 0.85]];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + pointsLen;
    const r = mistSize * (0.6 + (0.25 * ((i * 37) % 10)) / 10);
    specs.push([
      bx + Math.cos(a) * spread,
      WATER_LEVEL + r * 0.35,
      bz + Math.sin(a) * spread,
      r,
    ]);
  }
  const n = specs.length;
  const pos = new Float32Array(n * 4 * 3);
  const normals = new Float32Array(n * 4 * 3);
  const uvs = new Float32Array(n * 4 * 2);
  const centers = new Float32Array(n * 4 * 3);
  const scales = new Float32Array(n * 4);
  const idx = new Uint16Array(n * 6);
  const corners = [
    [-0.5, 0.5, 0, 1],
    [0.5, 0.5, 1, 1],
    [-0.5, -0.5, 0, 0],
    [0.5, -0.5, 1, 0],
  ];
  for (let p = 0; p < n; p++) {
    const [cx, cy, cz, s] = specs[p];
    for (let k = 0; k < 4; k++) {
      const v = p * 4 + k;
      pos[v * 3] = corners[k][0];
      pos[v * 3 + 1] = corners[k][1];
      pos[v * 3 + 2] = 0;
      normals[v * 3 + 2] = 1;
      uvs[v * 2] = corners[k][2];
      uvs[v * 2 + 1] = corners[k][3];
      centers[v * 3] = cx;
      centers[v * 3 + 1] = cy;
      centers[v * 3 + 2] = cz;
      scales[v] = s;
    }
    const base = p * 4;
    idx.set([base, base + 2, base + 1, base + 2, base + 3, base + 1], p * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('aPuffCenter', new THREE.BufferAttribute(centers, 3));
  geo.setAttribute('aPuffScale', new THREE.BufferAttribute(scales, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(bx, WATER_LEVEL + mistSize * 0.35, bz),
    spread + mistSize
  );
  geo.userData.unique = true;
  const mesh = new THREE.Mesh(geo, mistMat);
  mesh.renderOrder = 2;
  return mesh;
}

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
// Half the width of a procedural fall, embracing the stream at the brink and
// widening toward the splash pool
const FALL_HALF = [10.4, 18];
// How far the middle of a fall bows out, for its half width
const BOW = 0.5;

// How high the stream's middle lies above the ground, its steps across, and
// how wide it is along its channel and where it meets the fall
const STREAM_LIFT = 0.85;
const STREAM_BANK_LIFT = 0.18;
const STREAM_ACROSS = 12;
const STREAM_HALF = [5, 9];
// Spring pool dimensions when the source lies on a slope rather than in a bowl
const SPRING_POOL_BACK = 13;
const SPRING_POOL_LEN = 46;
const SPRING_POOL_HALF = 13.5;
// How far an enclosed tarn can reach from the stream's source, and how wide
// on average it has to be to draw a level pond
const POND_RADIUS = 70;
const POND_MIN_RADIUS = 15;
const POND_DEPTHS = [4, 3, 2.2];

// Clamps half-width on one side (`dirSign` = -1 or +1) so the stream or spring
// pool never overhangs a cliff break where the ground drops sharply away.
function safeBankHalf(
  ground,
  px,
  pz,
  sideX,
  sideZ,
  dirSign,
  targetHalf,
  gMid,
  nearLip
) {
  let allowed = targetHalf;
  const checks = 5;
  for (let c = 1; c <= checks; c++) {
    const s = (c / checks) * targetHalf;
    const g = groundAt(
      ground,
      px + sideX * dirSign * s,
      pz + sideZ * dirSign * s
    );
    const maxDrop = nearLip ? 2.2 : Math.max(2.6, s * 0.42);
    if (g === null || g < gMid - maxDrop) {
      allowed = ((c - 1) / checks) * targetHalf;
      break;
    }
  }
  return Math.max(1.2, allowed);
}

// The stream along `points` (local [x, y, z], source to lip), hugging the
// ground, as a single continuous mesh. When `pond` is null (a hillside source
// with no enclosed hollow), the head widens into a ground-hugging spring pool
// that funnels seamlessly into the channel; when `pond` is present, the stream
// starts inside the tarn's outlet at `pond.level` and funnels smoothly out.
function createStream(points, ground, pond, leap, material, streamSegments) {
  const ctrl = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  if (!pond && ctrl.length >= 2) {
    const headDir = ctrl[1].clone().sub(ctrl[0]);
    headDir.y = 0;
    if (headDir.lengthSq() > 1e-6) {
      headDir.normalize();
      const g0 = groundAt(ground, ctrl[0].x, ctrl[0].z) ?? ctrl[0].y;
      let back = 0;
      for (let s = 2; s <= SPRING_POOL_BACK; s += 2) {
        const bx = ctrl[0].x - headDir.x * s;
        const bz = ctrl[0].z - headDir.z * s;
        const bg = groundAt(ground, bx, bz);
        if (bg === null || bg < g0 - 1.5 || bg > g0 + s * 0.65 + 2.5) break;
        back = s;
      }
      if (back >= 4) {
        const bx = ctrl[0].x - headDir.x * back;
        const bz = ctrl[0].z - headDir.z * back;
        const bg = groundAt(ground, bx, bz) ?? g0;
        ctrl.unshift(new THREE.Vector3(bx, bg, bz));
      }
    }
  }

  const curve = new THREE.CatmullRomCurve3(ctrl);
  const fullLen = curve.getLength();
  if (fullLen < 4) return null;

  // Stop procedural streams slightly back from the sharp cliff edge so banks
  // fade out on solid plateau rock while the waterfall crest takes over
  const endLen = leap ? fullLen : Math.max(6, fullLen - 2.0);
  const startLen = pond ? Math.max(0, pond.outletRadius - 14) : 0;
  if (endLen - startLen < 4) return null;

  // Finer steps through the rounded spring pool head, ~3.5 units downstream
  const sampleTs = [];
  const poolZone = pond ? 0 : Math.min(SPRING_POOL_LEN + 4, endLen * 0.6);
  let distCursor = startLen;
  while (distCursor < endLen) {
    sampleTs.push(distCursor / fullLen);
    const stepLen = !pond && distCursor < poolZone ? 1.8 : 3.5;
    distCursor += stepLen;
  }
  sampleTs.push(endLen / fullLen);

  // Precompute exact chord distances so `toLip` reaches 0.0 at the final row
  const rowPts = sampleTs.map((t) => curve.getPoint(t));
  const rowAlongs = [startLen];
  for (let i = 1; i < rowPts.length; i++) {
    rowAlongs.push(rowAlongs[i - 1] + rowPts[i].distanceTo(rowPts[i - 1]));
  }
  const finalAlong = rowAlongs[rowAlongs.length - 1];

  const positions = [];
  const uvs = [];
  const metas = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const seedPhase =
    Math.sin(points[0][0] * 0.071 + points[0][2] * 0.113) * Math.PI;
  const poolLen = Math.min(SPRING_POOL_LEN, (finalAlong - startLen) * 0.55);
  const poolPeak = poolLen * 0.32;
  const rowCenters = [];

  for (let i = 0; i < sampleTs.length; i++) {
    const tCurve = sampleTs[i];
    const p = rowPts[i];
    const along = rowAlongs[i];
    const toLip = Math.max(0, finalAlong - along);
    curve.getTangent(tCurve, tangent);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();

    const channelFrac = THREE.MathUtils.clamp(along / finalAlong, 0, 1);
    const channelHalf = THREE.MathUtils.lerp(
      STREAM_HALF[0],
      STREAM_HALF[1],
      channelFrac
    );
    let half = channelHalf;
    let headAlpha;
    let poolMix = 0;

    if (pond) {
      const outR = pond.outletRadius;
      const funnel =
        1 - THREE.MathUtils.smoothstep(along, outR - 10, outR + 24);
      half = channelHalf + funnel * Math.min(11, outR * 0.34);
      headAlpha = THREE.MathUtils.smoothstep(along, outR - 12, outR - 1);
      poolMix = funnel * 0.55;
    } else if (poolLen >= 10 && along < poolLen) {
      const wobble =
        1 +
        0.09 * Math.sin(along * 0.22 + seedPhase) +
        0.05 * Math.cos(along * 0.43 - seedPhase * 0.7);
      const maxPoolHalf = SPRING_POOL_HALF * wobble;
      if (along < poolPeak) {
        const uCap = along / Math.max(1e-3, poolPeak);
        const arc = Math.sqrt(Math.max(0.03, 1 - (1 - uCap) * (1 - uCap)));
        half = Math.max(1.6, maxPoolHalf * arc);
      } else {
        const funnelT = THREE.MathUtils.smoothstep(along, poolPeak, poolLen);
        half = THREE.MathUtils.lerp(maxPoolHalf, channelHalf, funnelT);
      }
      headAlpha = THREE.MathUtils.smoothstep(along, 0, 3.8);
      poolMix = 1 - THREE.MathUtils.smoothstep(along, poolPeak * 0.85, poolLen);
    } else {
      headAlpha = THREE.MathUtils.smoothstep(along - startLen, 0, 6);
    }

    // Natural weir contraction approaching the lip so the waterfall sheet
    // completely embraces the stream without blue shoulders sticking out
    if (!leap) {
      half *= THREE.MathUtils.lerp(
        0.78,
        1.0,
        THREE.MathUtils.smoothstep(toLip, 0, 14)
      );
    }

    const gMid = groundAt(ground, p.x, p.z) ?? p.y;
    const prevP = i > 0 ? rowPts[i - 1] : p;
    const gBetween =
      i > 0
        ? (groundAt(ground, (p.x + prevP.x) * 0.5, (p.z + prevP.z) * 0.5) ??
          gMid)
        : gMid;
    const gEnvelope = Math.max(gMid, gBetween);

    const nearLip = !leap && toLip < 28;
    const halfL = safeBankHalf(
      ground,
      p.x,
      p.z,
      side.x,
      side.z,
      -1,
      half,
      gMid,
      nearLip
    );
    const halfR = safeBankHalf(
      ground,
      p.x,
      p.z,
      side.x,
      side.z,
      1,
      half,
      gMid,
      nearLip
    );
    rowCenters.push({x: p.x, z: p.z, hw: Math.max(halfL, halfR)});

    const pondBlend = pond
      ? 1 -
        THREE.MathUtils.smoothstep(
          along,
          pond.outletRadius - 2,
          pond.outletRadius + 16
        )
      : 0;
    const lipLock = leap ? 0 : 1 - THREE.MathUtils.smoothstep(toLip, 10, 28);

    for (let k = 0; k <= STREAM_ACROSS; k++) {
      const u = k / STREAM_ACROSS;
      const signed = u * 2 - 1;
      const offset = signed < 0 ? signed * halfL : signed * halfR;
      const x = p.x + side.x * offset;
      const z = p.z + side.z * offset;
      const gk = groundAt(ground, x, z) ?? gMid;
      const acrossProfile = 1 - signed * signed;
      const lift =
        STREAM_BANK_LIFT + (STREAM_LIFT - STREAM_BANK_LIFT) * acrossProfile;
      const gkSlope = Math.max(gk, gMid - Math.abs(offset) * 0.45);
      const ySlope = gkSlope + Math.max(0, gEnvelope - gMid) * 0.6 + lift;
      const gSafeLip = Math.max(gk, gEnvelope - 0.55);
      const yLip = THREE.MathUtils.lerp(gEnvelope, gSafeLip, 0.55) + lift;
      const yGround = THREE.MathUtils.lerp(ySlope, yLip, lipLock);
      const y =
        pondBlend > 0
          ? THREE.MathUtils.lerp(
              yGround,
              Math.max(pond.level, yGround - 0.25),
              pondBlend
            )
          : yGround;
      positions.push(x, y, z);
      uvs.push(u, along);
      metas.push(toLip, headAlpha, poolMix);
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

  // Coarse segments along the stream & spring pool so grass.js keeps blades
  // out of the water channel
  if (streamSegments && rowCenters.length >= 2) {
    const stride = Math.max(1, Math.ceil(rowCenters.length / 7));
    for (let i = 0; i < rowCenters.length - 1; i += stride) {
      const j = Math.min(rowCenters.length - 1, i + stride);
      let maxHw = 0;
      for (let m = i; m <= j; m++) maxHw = Math.max(maxHw, rowCenters[m].hw);
      streamSegments.push({
        x0: rowCenters[i].x,
        z0: rowCenters[i].z,
        x1: rowCenters[j].x,
        z1: rowCenters[j].z,
        hw: maxHw,
      });
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aStreamMeta', new THREE.Float32BufferAttribute(metas, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.unique = true;
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 2;
  return mesh;
}

// An enclosed tarn at the stream's source (local x0, z0), built only when the
// surrounding ground forms a genuine basin around the water table rather than
// an open hillside (where a rigid horizontal plane would cantilever into air).
function createPond(x0, z0, outX, outZ, ground, material, streamSegments) {
  const g0 = groundAt(ground, x0, z0);
  if (g0 === null) return null;
  const ANGLES = 48;
  let chosen = null;

  for (const depth of POND_DEPTHS) {
    const level = g0 + depth;
    const radii = [];
    let enclosedCount = 0;
    let valid = true;

    for (let a = 0; a < ANGLES; a++) {
      const ang = (a / ANGLES) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const alignOut = dx * outX + dz * outZ;
      const floorDrop = alignOut >= 0.5 ? 1.6 : 0.6;
      let r = 0;
      let hitShore = false;
      for (let s = 2; s <= POND_RADIUS; s += 2) {
        const g = groundAt(ground, x0 + dx * s, z0 + dz * s);
        if (g === null || g < g0 - floorDrop) break;
        r = s;
        if (g >= level) {
          r = s + 2.5;
          hitShore = true;
          break;
        }
      }
      if (hitShore) {
        enclosedCount++;
      } else {
        const gEnd = groundAt(ground, x0 + dx * r, z0 + dz * r);
        if (alignOut < 0.5 || r < 10 || gEnd === null || level - gEnd > 2.2) {
          valid = false;
          break;
        }
      }
      radii.push(r);
    }

    if (!valid || enclosedCount < Math.ceil(ANGLES * 0.78)) continue;

    for (let pass = 0; pass < 2; pass++) {
      const was = radii.slice();
      for (let a = 0; a < ANGLES; a++) {
        let sum = 0;
        for (let j = -3; j <= 3; j++) sum += was[(a + j + ANGLES) % ANGLES];
        radii[a] = Math.min(was[a], sum / 7);
      }
    }

    const minR = Math.min(...radii);
    const avgR = radii.reduce((t, r) => t + r, 0) / ANGLES;
    if (minR < 10 || avgR < POND_MIN_RADIUS) continue;

    chosen = {level, radii, avgR};
    break;
  }

  if (!chosen) return null;

  const {level, radii, avgR} = chosen;
  if (streamSegments) {
    streamSegments.push({
      x0: x0 - outX * 4,
      z0: z0 - outZ * 4,
      x1: x0 + outX * 4,
      z1: z0 + outZ * 4,
      hw: avgR * 0.92,
    });
  }

  const outAng =
    ((Math.atan2(outZ, outX) / (Math.PI * 2)) * ANGLES + ANGLES) % ANGLES;
  const a0 = Math.floor(outAng) % ANGLES;
  const a1 = (a0 + 1) % ANGLES;
  const frac = outAng - Math.floor(outAng);
  const outletRadius = radii[a0] * (1 - frac) + radii[a1] * frac;

  const UV_SCALE = 1 / 55;
  const INNER_FRAC = 0.76;
  const positions = [x0, level, z0];
  const uvs = [0, 0];
  const shores = [0];
  const indices = [];

  for (let a = 0; a < ANGLES; a++) {
    const ang = (a / ANGLES) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const rInner = radii[a] * INNER_FRAC;
    positions.push(x0 + dx * rInner, level, z0 + dz * rInner);
    uvs.push(dx * rInner * UV_SCALE, dz * rInner * UV_SCALE);
    shores.push(INNER_FRAC);
  }
  for (let a = 0; a < ANGLES; a++) {
    const ang = (a / ANGLES) * Math.PI * 2;
    const dx = Math.cos(ang);
    const dz = Math.sin(ang);
    const rOuter = radii[a];
    positions.push(x0 + dx * rOuter, level, z0 + dz * rOuter);
    uvs.push(dx * rOuter * UV_SCALE, dz * rOuter * UV_SCALE);
    shores.push(1);
  }

  for (let a = 0; a < ANGLES; a++) {
    const next = (a + 1) % ANGLES;
    const iInner0 = 1 + a;
    const iInner1 = 1 + next;
    const iOuter0 = 1 + ANGLES + a;
    const iOuter1 = 1 + ANGLES + next;
    indices.push(0, iInner1, iInner0);
    indices.push(iInner0, iInner1, iOuter0);
    indices.push(iInner1, iOuter1, iOuter0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('aPondShore', new THREE.Float32BufferAttribute(shores, 1));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.userData.unique = true;
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 2;
  return {mesh, level, outletRadius};
}

// The waterfall down `course` (local [x, y, z] points, top to bottom, in the
// chunk's frame) over `ground` (the patch of height grid around it; without
// it, the fall follows the course's heights), as a group to add to the chunk.
// Each row across the fall is level, starting flush over the frothing end of
// the stream and curving over the brink; where rock either side stands higher
// down a gully, the curtain eases forward so it clears the rock cleanly.
export function createWaterfall({
  course: points,
  stream,
  ground,
  leap,
  desert = 0,
}) {
  const group = new THREE.Group();
  const isOasis = desert > 0.35;
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  );
  const groundOr = (x, z, fallback) =>
    (ground ? groundAt(ground, x, z) : null) ?? fallback;
  const curveLen = curve.getLength();
  // About every 4 units along the fall, so it follows the crest and folds smoothly
  const samples = Math.max(12, Math.ceil(curveLen / 4));
  const rows = [];
  const tangent = new THREE.Vector3();
  let out = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const approxAlong = t * curveLen;
    const p = curve.getPoint(t);
    curve.getTangent(t, tangent);
    // Downhill and across, both level
    if (tangent.x * tangent.x + tangent.z * tangent.z > 1e-6) {
      out = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();
    }
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const half = leap
      ? THREE.MathUtils.lerp(...LEAP_HALF, t)
      : THREE.MathUtils.lerp(...FALL_HALF, t);
    const rowLift = leap
      ? LIFT
      : THREE.MathUtils.lerp(
          STREAM_LIFT + 0.15,
          LIFT,
          THREE.MathUtils.smoothstep(approxAlong, 0, 16)
        );
    // Follow the parabolic crest trajectory while clearing the drawn rock below
    const y = Math.max(
      Math.max(p.y, groundOr(p.x, p.z, -Infinity) + rowLift),
      WATER_LEVEL + 0.5
    );
    // How far out the row has to move to clear gully walls either side (eased
    // in only past the stream overlap at the top)
    let need = 0;
    const checkGully = !leap && approxAlong > 8;
    for (; checkGully && need < MAX_OUT; need += 2) {
      let clear = true;
      for (let k = 0; k <= ACROSS && clear; k++) {
        const s = (k / ACROSS - 0.5) * 2 * half;
        const g = groundOr(
          p.x + side.x * s + out.x * need,
          p.z + side.z * s + out.z * need,
          -Infinity
        );
        clear = g + rowLift <= y + 1;
      }
      if (clear) break;
    }
    rows.push({p, out, side, half, y, need, rowLift});
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
  const ribbon = [];
  let along = 0;
  rows.forEach(({p, out: o, side, half, y, rowLift}, i) => {
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
    // Keep row 0 locked to the stream centerline, easing outward past the brink
    const d = (sum / n) * THREE.MathUtils.smoothstep(along, 4, 22);
    mid.set(p.x + o.x * d, y, p.z + o.z * d);
    if (i > 0) along += mid.distanceTo(prev);
    prev.copy(mid);
    ribbon.push({
      x: mid.x,
      y: mid.y,
      z: mid.z,
      half,
      sideX: side.x,
      sideZ: side.z,
    });
    for (let k = 0; k <= ACROSS; k++) {
      const u = (k / ACROSS - 0.5) * 2;
      const s = u * half;
      // Bowed out in the middle, so it has some depth seen edge on, easing
      // in from the lip so the top still meets the stream
      const bow =
        BOW * half * (1 - u * u) * THREE.MathUtils.smoothstep(along, 4, 32);
      const x = mid.x + side.x * s + o.x * bow;
      const z = mid.z + side.z * s + o.z * bow;
      // Clear minor rock bumps under the sheet without spiking up sheer side walls
      const gh = groundOr(x, z, -Infinity) + rowLift;
      const vy = gh <= y + 6 ? Math.max(y, gh) : y;
      positions.push(x, vy, z);
    }
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
  const fall = new THREE.Mesh(geo, isOasis ? oasisFallMat : fallMat);
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
  group.add(createMistPlume(bx, bz, mistSize, spread, points.length));

  const streamSegments = [];
  // The stream feeding it, with an enclosed tarn where a natural basin holds
  // one or a ground-hugging spring pool where the source sits on a slope
  if (stream && stream.length > 1 && ground) {
    const outVec = new THREE.Vector2(
      stream[1][0] - stream[0][0],
      stream[1][2] - stream[0][2]
    );
    if (outVec.lengthSq() > 1e-6) outVec.normalize();
    else outVec.set(0, 1);

    const pond = createPond(
      stream[0][0],
      stream[0][2],
      outVec.x,
      outVec.y,
      ground,
      isOasis ? oasisPondMat : pondMat,
      streamSegments
    );
    if (pond) group.add(pond.mesh);

    const streamMesh = createStream(
      stream,
      ground,
      pond,
      !!leap,
      isOasis ? oasisStreamMat : streamMat,
      streamSegments
    );
    if (streamMesh) group.add(streamMesh);
  }

  // For the drifting mist (particles.js), haptics (haptics.js), and grass clearance
  group.userData.foot = {
    x: bx,
    z: bz,
    half: footHalf,
    size: mistSize,
    top: points[0][1],
    ribbon,
    leap: !!leap,
    streamSegments,
  };

  // Churning foam, a little wider than the fall's foot
  const foamGeo = new THREE.CircleGeometry(Math.max(24, footHalf * 1.4), 32);
  foamGeo.rotateX(-Math.PI / 2);
  foamGeo.userData.unique = true;
  const foam = new THREE.Mesh(foamGeo, foamMat);
  foam.position.set(bx, WATER_LEVEL + 0.3, bz);
  foam.renderOrder = 2;
  group.add(foam);

  return group;
}
