// export-map-worker.js
// Renders a band of rows of the map export page (debug-export-map.html):
// heights from getElevation, then colours from map-palette.js.

import {ChillFlightLogic} from '../chill-flight-logic.js';
import {SimplexNoise} from '../noise.js';
import {mapColor, mapShade} from '../map-palette.js';

const CONSTANTS = {
  WATER_LEVEL: 40,
  MOUNTAIN_LEVEL: 180,
  MAP_HEIGHT_SCALE: 400,
  MAP_WORLD_SIZE: 10000,
};

let simplex = null;
let simplexSeed = null;

self.onmessage = function (e) {
  const {id, seed, continent, x0, z0, upp, width, rowStart, rowEnd, mode} =
    e.data;
  ChillFlightLogic.CONTINENT = continent;
  if (seed !== simplexSeed) {
    ChillFlightLogic.WORLD_SEED = seed;
    simplex = SimplexNoise();
    simplexSeed = seed;
  }

  // Heights for the band plus a row either side, for the hillshade
  const rows = rowEnd - rowStart + 2;
  const heights = new Float32Array(width * rows);
  for (let r = 0; r < rows; r++) {
    const wz = z0 + (rowStart - 1 + r + 0.5) * upp;
    for (let px = 0; px < width; px++) {
      const wx = x0 + (px + 0.5) * upp;
      heights[r * width + px] = ChillFlightLogic.getElevation(
        wx,
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
    for (let px = 0; px < width; px++) {
      const idx = r * width + px;
      const h = heights[idx];
      const out = ((r - 1) * width + px) * 4;
      if (mode === 'gray') {
        // The original export: -100 to 700 as black to white
        const v = ((h + 100) / 800) * 255;
        pixels[out] = pixels[out + 1] = pixels[out + 2] = v;
      } else {
        const wx = x0 + (px + 0.5) * upp;
        const shade = mapShade(heights, idx, width, rows);
        mapColor(h, wx, wz, simplex, color);
        pixels[out] = color[0] + shade;
        pixels[out + 1] = color[1] + shade;
        pixels[out + 2] = color[2] + shade;
      }
      pixels[out + 3] = 255;
    }
  }
  self.postMessage({id, rowStart, rowEnd, pixels}, [pixels.buffer]);
};
