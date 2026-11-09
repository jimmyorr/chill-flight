// --- RADIO MASTS ON THE PEAKS ---
// After the Nightscape demo (github.com/WeebLabs/Nightscape): thin red and
// white masts stand on some of the high summits, each with a red aircraft
// warning light on top that flashes every two seconds (each mast out of step
// with the others) and a dimmer steady light halfway up. At night they mark
// the mountains from far off.
//
// The world is split into square cells; the first time a cell comes within
// range, its highest point is found from the terrain (a coarse grid, then a
// short climb uphill), one cell per frame, and kept. A cell gets a mast if
// that point is a real summit, high enough, and the cell's hash says so.
// Not in the alien lands. Two draw calls: the masts and their lights.
import * as THREE from 'three';
import {scene} from './scene.js';
import {state} from './state.js';
import {createMaterial} from './constants.js';
import {getElevation, MAST_HEIGHT, mastGeometry} from './terrain-geometry.js';
import {camera, renderer} from './sky.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';

const CELL = 3000;
// Cells this many out from the camera's cell, each way, are looked at
const RANGE = 3;
const MAX_MASTS = 64;
// A summit must be this high, and this much higher than the ground this far
// round it, to get a mast; and only some cells have one
const PEAK_MIN = 450;
const PROMINENCE_REACH = 400;
const PROMINENCE_RISE = 50;
const MAST_CHANCE = 0.7;
const FLASH_PERIOD = 2.0;
// Terrain heights looked up a frame while searching a cell (each is a few
// microseconds), so a cell takes a few frames and no frame stalls
const SAMPLES_PER_FRAME = 32;

// Each cell's mast spot ({x, y, z, phase}) or null, once looked at
const cells = new Map();

function cellHash(cx, cz, salt) {
  let h = (cx * 374761393 + cz * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// The cell's highest point, or null if it shouldn't have a mast. A
// generator that yields after each height it looks up, so the search is
// spread over frames (SAMPLES_PER_FRAME); its return value is the result.
function* findMast(cx, cz) {
  if (cellHash(cx, cz, 17) > MAST_CHANCE) return null;
  const x0 = cx * CELL;
  const z0 = cz * CELL;
  const mid = ChillFlightLogic.alienAt?.(x0 + CELL / 2, z0 + CELL / 2, simplex);
  if (mid > 0.2) return null;
  let bx = 0;
  let bz = 0;
  let by = -Infinity;
  const n = 7;
  const step = CELL / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = x0 + (i + 0.5) * step;
      const z = z0 + (j + 0.5) * step;
      const y = getElevation(x, z);
      if (y > by) [bx, bz, by] = [x, z, y];
      yield;
    }
  }
  if (by < PEAK_MIN - 150) return null;
  // Climb to the top
  for (let s = step / 2; s >= 20; s /= 2) {
    let moved = true;
    for (let tries = 0; moved && tries < 8; tries++) {
      moved = false;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const x = bx + Math.cos(a) * s;
        const z = bz + Math.sin(a) * s;
        const y = getElevation(x, z);
        yield;
        if (y > by) {
          [bx, bz, by] = [x, z, y];
          moved = true;
        }
      }
    }
  }
  if (by < PEAK_MIN) return null;
  // A real summit, not a high plateau or a slope running out of the cell
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const y = getElevation(
      bx + Math.cos(a) * PROMINENCE_REACH,
      bz + Math.sin(a) * PROMINENCE_REACH
    );
    if (y > by - PROMINENCE_RISE) return null;
    yield;
  }
  return {x: bx, y: by, z: bz, phase: cellHash(cx, cz, 29) * FLASH_PERIOD};
}

const mastMat = createMaterial({vertexColors: true, flatShading: true});
mastMat.side = THREE.DoubleSide;
const masts = new THREE.InstancedMesh(mastGeometry(), mastMat, MAX_MASTS);
masts.count = 0;
masts.frustumCulled = false;
masts.castShadow = false;
scene.add(masts);

// Two lights a mast: the flashing one on top (kind 1) and the steady one
// halfway up (kind 0)
const lightPos = new Float32Array(MAX_MASTS * 2 * 3);
const lightInfo = new Float32Array(MAX_MASTS * 2 * 2);
const lightGeo = new THREE.BufferGeometry();
lightGeo.setAttribute('position', new THREE.BufferAttribute(lightPos, 3));
lightGeo.setAttribute('info', new THREE.BufferAttribute(lightInfo, 2));
const lightUniforms = {
  uTime: {value: 0},
  uNight: {value: 0},
  uScale: {value: 1},
};
const lightMat = new THREE.ShaderMaterial({
  uniforms: lightUniforms,
  vertexShader: `
    uniform float uTime;
    uniform float uNight;
    uniform float uScale;
    attribute vec2 info; // x: kind (1 flashing, 0 steady), y: phase (s)
    varying float vGlow;
    void main() {
      float t = mod(uTime + info.y, ${FLASH_PERIOD.toFixed(1)});
      // On for a third of a second, with a quick rise and fall
      float flash = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.25, 0.4, t));
      vGlow = uNight * (info.x > 0.5 ? flash : 0.5);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      // A few pixels near, still a point of light far off
      float size = (info.x > 0.5 ? 7.0 : 4.0) * uScale;
      gl_PointSize = vGlow > 0.003 ? max(size * 0.5, size * 900.0 / -mv.z) : 0.0;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    varying float vGlow;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
      if (d > 1.0) discard;
      float a = pow(1.0 - d, 2.0);
      gl_FragColor = vec4(vec3(1.0, 0.16, 0.08) * vGlow * (a + step(d, 0.3)), 1.0);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  fog: false,
});
const lights = new THREE.Points(lightGeo, lightMat);
lights.frustumCulled = false;
scene.add(lights);

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
let lastKey = '';
// The cell being searched: {key, it}
let search = null;

function rebuild(ccx, ccz) {
  let n = 0;
  for (let dx = -RANGE; dx <= RANGE && n < MAX_MASTS; dx++) {
    for (let dz = -RANGE; dz <= RANGE && n < MAX_MASTS; dz++) {
      const m = cells.get(`${ccx + dx},${ccz + dz}`);
      if (!m) continue;
      _q.setFromAxisAngle(_up, m.phase * 3);
      _m.compose(_p.set(m.x, m.y, m.z), _q, _s);
      masts.setMatrixAt(n, _m);
      lightPos.set([m.x, m.y + MAST_HEIGHT - 2.5, m.z], n * 6);
      lightPos.set([m.x, m.y + MAST_HEIGHT * 0.5, m.z], n * 6 + 3);
      lightInfo.set([1, m.phase, 0, m.phase], n * 4);
      n++;
    }
  }
  masts.count = n;
  masts.instanceMatrix.needsUpdate = true;
  lightGeo.setDrawRange(0, n * 2);
  lightGeo.attributes.position.needsUpdate = true;
  lightGeo.attributes.info.needsUpdate = true;
}

// Every frame, from game-loop.js
export function updateBeacons() {
  // Low has no props
  const show = state.SEGMENTS > 20;
  masts.visible = lights.visible = show;
  if (!show) return;
  camera.getWorldPosition(_p);
  const ccx = Math.floor(_p.x / CELL);
  const ccz = Math.floor(_p.z / CELL);
  // Search the nearest cell not yet looked at, a little each frame
  let dirty = false;
  if (!search) {
    outer: for (let r = 0; r <= RANGE; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const key = `${ccx + dx},${ccz + dz}`;
          if (cells.has(key)) continue;
          search = {key, it: findMast(ccx + dx, ccz + dz)};
          break outer;
        }
      }
    }
  }
  if (search) {
    for (let i = 0; i < SAMPLES_PER_FRAME; i++) {
      const r = search.it.next();
      if (r.done) {
        cells.set(search.key, r.value);
        search = null;
        dirty = true;
        break;
      }
    }
  }
  const key = `${ccx},${ccz}`;
  if (dirty || key !== lastKey) {
    lastKey = key;
    rebuild(ccx, ccz);
  }
  lightUniforms.uTime.value = (performance.now() / 1000) % 1000;
  lightUniforms.uNight.value =
    1 - THREE.MathUtils.smoothstep(state.dayFactor, 0.3, 0.8);
  lightUniforms.uScale.value = renderer.getPixelRatio();
}
