// --- DISTANT TERRAIN RING ---
// Coarse terrain from the edge of the draw distance out to ~27 km, so distant
// mountains and coastlines show on the horizon (silhouettes against sunsets)
// instead of the land ending in sky. Built from the same generator as the
// near chunks (terrain-gen.js, via the terrain workers) at a much coarser
// grid, without props. Near terrain draws over it; the ring skips the near
// area and fades into the sky at its outer edge.
import * as THREE from 'three';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {log} from './logger.js';
import {state} from './state.js';
import {hooks} from './hooks.js';
import {
  CHUNK_SIZE,
  MAP_HEIGHT_SCALE,
  MAP_WORLD_SIZE,
  MOUNTAIN_LEVEL,
  FAR_SEA_GLSL,
  FOG_SKY_FRAGMENT_GLSL,
  FOG_SKY_VERTEX_GLSL,
  SKY_COLOR_GLSL,
  WATER_LEVEL,
  terrainUniforms,
} from './constants.js';
import {terrainWorkerManager} from './terrain-worker-manager.js';
import {scene} from './scene.js';

const FAR_CELL = 9000; // world units per far cell
const FAR_SEGMENTS = 27; // ~333-unit grid spacing
export const FAR_RADIUS = 27000; // fully faded into the sky by here
const FAR_SINK = 12; // lowered so near terrain always draws over it
const CELL_RANGE = Math.ceil(FAR_RADIUS / FAR_CELL); // cells each way

const farUniforms = {
  uFarRadius: {value: FAR_RADIUS},
  uFarWaterY: {value: WATER_LEVEL - FAR_SINK},
};

// Smooth shading: at this grid spacing, flat facets turn peaks into lit
// pyramids.
// Lambert: at this distance physically based lighting isn't visible, and
// the cheaper shader matters for a mesh this large.
const farMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  // Pushed back in depth: where the ring overlaps the near chunks (between
  // the draw distance and the edge of the chunk grid) its coarse grid can
  // sit above the detailed terrain on peaks, and the two fought over which
  // is in front, flickering as the camera moved. The near terrain now wins.
  polygonOffset: true,
  polygonOffsetFactor: 4,
  polygonOffsetUnits: 16,
});
farMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uCameraPosXZ = terrainUniforms.uCameraPosXZ;
  shader.uniforms.uRenderRadius = terrainUniforms.uRenderRadius;
  shader.uniforms.uSunDirection = terrainUniforms.uSunDirection;
  shader.uniforms.uTopColor = terrainUniforms.uTopColor;
  shader.uniforms.uBottomColor = terrainUniforms.uBottomColor;
  shader.uniforms.uFarRadius = farUniforms.uFarRadius;
  shader.uniforms.uFarWaterY = farUniforms.uFarWaterY;

  shader.vertexShader =
    `
    uniform vec2 uCameraPosXZ;
    uniform float uRenderRadius;
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    varying float vDistanceXZ;
    varying vec3 vFarWorldPos;
  ` +
    SKY_COLOR_GLSL +
    FOG_SKY_VERTEX_GLSL +
    shader.vertexShader;
  // Inside the draw distance the near chunks cover the ring: sink it well
  // below the ground there (rather than discarding pixels, which would turn
  // off early depth rejection for the whole ring).
  shader.vertexShader = shader.vertexShader.replace(
    `#include <begin_vertex>`,
    `#include <begin_vertex>
     vec2 farXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
     float nearCover = 1.0 - smoothstep(uRenderRadius * 0.85, uRenderRadius * 0.97, length(farXZ - uCameraPosXZ));
     transformed.y -= 400.0 * nearCover;`
  );
  shader.vertexShader = shader.vertexShader.replace(
    `#include <worldpos_vertex>`,
    `#include <worldpos_vertex>
     vFarWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
     vDistanceXZ = length(vFarWorldPos.xz - uCameraPosXZ);
     #ifdef USE_FOG
       fogSkyVertex(vFarWorldPos);
     #endif`
  );

  shader.fragmentShader =
    `
    uniform float uRenderRadius;
    uniform float uFarRadius;
    uniform float uFarWaterY;
    uniform vec3 uSunDirection;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    varying float vDistanceXZ;
    varying vec3 vFarWorldPos;
  ` +
    SKY_COLOR_GLSL +
    FAR_SEA_GLSL +
    FOG_SKY_FRAGMENT_GLSL +
    shader.fragmentShader;

  shader.fragmentShader = shader.fragmentShader.replace(
    `#include <fog_fragment>`,
    `
     vec3 viewDirW = normalize(cameraPosition - vFarWorldPos);
     // Land at the water line is sea: a deep blue that mirrors the sky,
     // mostly sky this far out (grazing view).
     float isWater = 1.0 - smoothstep(uFarWaterY + 0.1, uFarWaterY + 2.0, vFarWorldPos.y);
     vec3 seaColor = farSeaColor(viewDirW, uTopColor, uBottomColor, uSunDirection);
     gl_FragColor.rgb = mix(gl_FragColor.rgb, seaColor, isWater);

     #ifdef USE_FOG
       vec3 fogSkyColor = fogSkyColorAt(vFarWorldPos);
       #ifdef FOG_EXP2
         float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
       #else
         float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
       #endif
       float edgeFade = smoothstep(0.8, 1.0, vDistanceXZ / uFarRadius);
       // Aerial perspective: distant ranges read as soft, hazy layers. Starts
       // from none at the draw distance, to match the near terrain there.
       float haze = 0.8 * smoothstep(uRenderRadius, uFarRadius, vDistanceXZ);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, fogSkyColor, max(max(fogFactor, haze), edgeFade));
     #endif`
  );
};

const cells = new Map(); // key -> {i, j, mesh, pending}
let generation = 0; // bumped on clear, so stale results are dropped
let lastCellX = null;
let lastCellZ = null;
let lastRadius = null;
let wantedCount = 0;
let wantedCells = []; // [i, j] pairs the ring should have, nearest first
let edgeFadeTarget = 1; // uNearEdgeFade's target (see updateFarTerrain)

// Off for custom maps: everything beyond a map's edge is open sea, and the
// ring's water there draws as a dark band on the horizon.
function isActive() {
  return (
    state.farTerrainEnabled &&
    !ChillFlightLogic.customMap &&
    terrainWorkerManager.isSupported
  );
}

function buildMesh(result) {
  const geo = new THREE.PlaneGeometry(
    FAR_CELL,
    FAR_CELL,
    FAR_SEGMENTS,
    FAR_SEGMENTS
  );
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position.array;
  pos.set(result.buffers.terrainPositions);
  // Flatten everything below the water line into a sea surface.
  for (let i = 1; i < pos.length; i += 3) {
    if (pos[i] < WATER_LEVEL) pos[i] = WATER_LEVEL;
  }
  geo.setAttribute(
    'color',
    new THREE.BufferAttribute(result.buffers.terrainColors, 3)
  );
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, farMaterial);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function disposeCell(key) {
  const cell = cells.get(key);
  if (!cell) return;
  if (cell.mesh) {
    scene.remove(cell.mesh);
    cell.mesh.geometry.dispose();
  }
  if (cell.pending) terrainWorkerManager.cancelJob(cell.i, cell.j, 'far');
  cells.delete(key);
}

export function clearFarTerrain() {
  generation++;
  for (const key of [...cells.keys()]) disposeCell(key);
  lastCellX = null;
  lastCellZ = null;
  wantedCount = 0;
  wantedCells = [];
  edgeFadeTarget = 1;
  terrainUniforms.uNearEdgeFade.value = 1;
}
hooks.clearFarTerrain = clearFarTerrain;

function requestCell(i, j) {
  const key = `${i},${j}`;
  const cell = {i, j, mesh: null, pending: true};
  cells.set(key, cell);
  const gen = generation;
  terrainWorkerManager
    .requestChunk(i, j, {
      kind: 'far',
      priority: -1e6, // after every near chunk
      segments: FAR_SEGMENTS,
      chunkSize: FAR_CELL,
      elevParams: {
        WATER_LEVEL,
        MOUNTAIN_LEVEL,
        MAP_WORLD_SIZE,
        MAP_HEIGHT_SCALE,
      },
      worldSeed: ChillFlightLogic.WORLD_SEED,
      forceIslandType: ChillFlightLogic.FORCE_ISLAND_TYPE,
      enableObjects: false,
    })
    .then((result) => {
      if (gen !== generation || cells.get(key) !== cell) return;
      cell.pending = false;
      cell.mesh = buildMesh(result);
      cell.mesh.position.set(i * FAR_CELL, -FAR_SINK, j * FAR_CELL);
      cell.mesh.updateMatrix();
      scene.add(cell.mesh);
    })
    .catch(() => {
      if (cells.get(key) === cell) cells.delete(key); // retried on next update
    });
}

// Distance from (x, z) to the nearest and farthest points of a cell.
function cellDistances(i, j, x, z) {
  const half = FAR_CELL / 2;
  const cx = i * FAR_CELL;
  const cz = j * FAR_CELL;
  const nx = Math.max(Math.abs(x - cx) - half, 0);
  const nz = Math.max(Math.abs(z - cz) - half, 0);
  const fx = Math.abs(x - cx) + half;
  const fz = Math.abs(z - cz) + half;
  return {near: Math.hypot(nx, nz), far: Math.hypot(fx, fz)};
}

// Called every frame; only does work when the plane enters a new far cell
// or the draw distance changes.
export function updateFarTerrain(position) {
  if (!isActive()) {
    if (cells.size > 0 || terrainUniforms.uNearEdgeFade.value !== 1) {
      clearFarTerrain();
    }
    return;
  }

  const cellX = Math.round(position.x / FAR_CELL);
  const cellZ = Math.round(position.z / FAR_CELL);
  const radius = state.RENDER_DISTANCE * CHUNK_SIZE;
  if (cellX !== lastCellX || cellZ !== lastCellZ || radius !== lastRadius) {
    lastCellX = cellX;
    lastCellZ = cellZ;
    lastRadius = radius;

    const wanted = new Set();
    const nextCells = [];
    for (let di = -CELL_RANGE; di <= CELL_RANGE; di++) {
      for (let dj = -CELL_RANGE; dj <= CELL_RANGE; dj++) {
        const i = cellX + di;
        const j = cellZ + dj;
        const d = cellDistances(i, j, position.x, position.z);
        // Skip cells beyond the ring or entirely inside the near area.
        if (d.near > FAR_RADIUS || d.far < radius * 0.97) continue;
        wanted.add(`${i},${j}`);
        nextCells.push([i, j, d.near]);
      }
    }
    for (const key of [...cells.keys()]) {
      if (!wanted.has(key)) disposeCell(key);
    }
    wantedCount = wanted.size;
    wantedCells = nextCells.sort((a, b) => a[2] - b[2]);
    log.info(`[FarTerrain] ${wanted.size} cells around ${cellX},${cellZ}`);
  }

  // Near terrain loads first: only ask the workers for far cells once the
  // near chunk queue is empty, a couple per frame.
  if (state.chunkQueue.length === 0) {
    let requested = 0;
    for (const [i, j] of wantedCells) {
      if (requested >= 2) break;
      if (!cells.has(`${i},${j}`)) {
        requestCell(i, j);
        requested++;
      }
    }
  }

  // Let the near terrain run to its edge (instead of fading into the sky)
  // once most of the ring is there to continue it. With hysteresis: entering
  // a new cell leaves its new row loading for a moment, and switching the
  // fade back on then made the horizon water and island edges change color
  // briefly on every cell crossing. And eased, never switched instantly.
  let ready = 0;
  for (const cell of cells.values()) if (cell.mesh) ready++;
  if (wantedCount > 0 && ready >= wantedCount * 0.9) edgeFadeTarget = 0;
  else if (wantedCount === 0 || ready < wantedCount * 0.5) edgeFadeTarget = 1;
  const fade = terrainUniforms.uNearEdgeFade;
  fade.value += Math.max(-0.05, Math.min(0.05, edgeFadeTarget - fade.value));
}
