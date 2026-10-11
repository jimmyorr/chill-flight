// map-render.js
// Renders rows of a map image: heights from getElevation, colours and
// hillshade from map-palette.js. The in-game map's tile workers
// (map-worker.js, or the main thread if workers can't run) and the map
// export page (debug/debug-export-map.html) draw with it.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {SimplexNoise} from './noise.js';
import {mapColor, mapShade} from './map-palette.js';

const CONSTANTS = {
  WATER_LEVEL: 40,
  MOUNTAIN_LEVEL: 180,
  MAP_HEIGHT_SCALE: 400,
  MAP_WORLD_SIZE: 10000,
};

// Workers build their own noise for the seed they're given
let workerSimplex = null;
let workerSeed = null;
function simplexFor(seed) {
  if (seed !== workerSeed) {
    ChillFlightLogic.WORLD_SEED = seed;
    workerSimplex = SimplexNoise();
    ChillFlightLogic.setRoadNoise(workerSimplex);
    workerSeed = seed;
  }
  return workerSimplex;
}

// RGBA pixels for rows rowStart to rowEnd of an image `width` pixels wide,
// whose top-left pixel's corner is world (x0, z0), `upp` units per pixel.
// Pixels sample their centres. mode 'gray' gives the plain heightmap (-100
// to 700 as black to white). Pass `simplex` to use that noise as it is (the
// main thread's); otherwise one is made for `seed`, and `continent` sets the
// forced outline, as a worker has neither.
export function renderMapRows({
  seed,
  continent = null,
  x0,
  z0,
  upp,
  width,
  rowStart,
  rowEnd,
  mode = 'color',
  simplex = null,
}) {
  if (!simplex) {
    ChillFlightLogic.CONTINENT = continent;
    simplex = simplexFor(seed);
  }

  // Heights with a one-pixel border all round, for the hillshade, so
  // neighbouring tiles and bands shade seamlessly
  const w = width + 2;
  const rows = rowEnd - rowStart + 2;
  const heights = new Float32Array(w * rows);
  for (let r = 0; r < rows; r++) {
    const wz = z0 + (rowStart - 1 + r + 0.5) * upp;
    for (let c = 0; c < w; c++) {
      heights[r * w + c] = ChillFlightLogic.getElevation(
        x0 + (c - 1 + 0.5) * upp,
        wz,
        simplex,
        CONSTANTS,
        null
      );
    }
  }

  const pixels = new Uint8ClampedArray(width * (rows - 2) * 4);
  const color = [0, 0, 0];
  for (let r = 1; r < rows - 1; r++) {
    const wz = z0 + (rowStart - 1 + r + 0.5) * upp;
    for (let c = 1; c < w - 1; c++) {
      const idx = r * w + c;
      const h = heights[idx];
      const out = ((r - 1) * width + (c - 1)) * 4;
      if (mode === 'gray') {
        const v = ((h + 100) / 800) * 255;
        pixels[out] = pixels[out + 1] = pixels[out + 2] = v;
      } else {
        const shade = mapShade(heights, idx, w, rows, upp);
        mapColor(h, x0 + (c - 1 + 0.5) * upp, wz, simplex, color);
        pixels[out] = color[0] + shade;
        pixels[out + 1] = color[1] + shade;
        pixels[out + 2] = color[2] + shade;
      }
      pixels[out + 3] = 255;
    }
  }
  return pixels;
}
