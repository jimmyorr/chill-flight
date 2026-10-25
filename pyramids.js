// --- THE PYRAMIDS ---
// The three pyramids out in the southern desert (chill-flight-logic.js puts
// them in the ground, for landing on and crashing into). The terrain's grid
// can't draw their edges straight, so they're drawn here as well, a little
// outside that ground: four faces each, in courses of sandstone, with a pale
// cap on the great one. They use the terrain's material, so they light,
// fog and fade into the distance with the land.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {WATER_LEVEL} from './constants.js';
import {simplex} from './noise.js';
import {scene} from './scene.js';
import {terrainMaterial} from './terrain-geometry.js';

// Each course of stone is this tall (units), every other one a shade
// darker; the great one's cap is pale limestone above this height
const COURSE = 12;
const CAP_HEIGHT = 690;
const STONE = new THREE.Color(0xd8b07a);
const CAP = new THREE.Color(0xf0e6cc);

// The four faces of a pyramid with its base's middle at (x, base, z), in
// horizontal bands one course tall: positions, colours and the terrain
// material's morphY (its own height, so it never morphs)
function addPyramid(out, x, base, z, half, slope) {
  const height = half * slope;
  const courses = Math.ceil(height / COURSE);
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const color = new THREE.Color();
  const point = (corner, t) => {
    // t: 0 at the base, 1 at the tip
    const [cx, cz] = corner;
    const h = Math.min(1, t);
    return [
      x + cx * half * (1 - h),
      base + height * h,
      z + cz * half * (1 - h),
    ];
  };
  for (let f = 0; f < 4; f++) {
    // Wound so the face looks outward
    const a = corners[(f + 1) % 4];
    const b = corners[f];
    for (let c = 0; c < courses; c++) {
      const t0 = (c * COURSE) / height;
      const t1 = ((c + 1) * COURSE) / height;
      const quad = [point(a, t0), point(b, t0), point(b, t1), point(a, t1)];
      color.copy(c * COURSE >= CAP_HEIGHT ? CAP : STONE);
      if (c % 2) color.multiplyScalar(0.93);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        out.positions.push(...quad[i]);
        out.colors.push(color.r, color.g, color.b);
        out.morphY.push(quad[i][1]);
      }
    }
  }
}

const site = ChillFlightLogic.pyramidSite(simplex, {WATER_LEVEL});
if (site && ChillFlightLogic.SHOW_OBJECTS !== false) {
  const out = {positions: [], colors: [], morphY: []};
  for (const p of ChillFlightLogic.PYRAMIDS) {
    addPyramid(
      out,
      site.x + p.dx,
      site.base,
      site.z + p.dz,
      p.half,
      ChillFlightLogic.PYRAMID_SLOPE
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(out.positions, 3)
  );
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(out.colors, 3)
  );
  geometry.setAttribute(
    'morphY',
    new THREE.Float32BufferAttribute(out.morphY, 1)
  );
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, terrainMaterial);
  mesh.name = 'pyramids';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}
