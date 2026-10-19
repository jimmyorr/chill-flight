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
  if (mode !== 'gray' && !ChillFlightLogic.customMap) {
    drawRoads(pixels, simplex, x0, z0, upp, width, rowStart, rowEnd);
  }
  return pixels;
}

// --- ROADS ---
// The highways and the airports' access roads, painted over the land as
// dark lines at least a pixel and a half wide, so they still show (fainter)
// zoomed out. A highway runs where ChillFlightLogic.highwayRunsAt says, as
// terrain-chunks.js builds it.
const ROAD_COLOR = [64, 64, 68];

// Blends the road colour into pixels from x = left to right (world units)
// on one row
function paintSpan(pixels, row, width, x0, upp, left, right, alpha) {
  const c0 = Math.max(0, Math.floor((left - x0) / upp));
  const c1 = Math.min(width - 1, Math.floor((right - x0) / upp));
  for (let c = c0; c <= c1; c++) {
    // Partial coverage at the span's ends, for smooth edges
    const px0 = x0 + c * upp;
    const cover = Math.max(
      0,
      Math.min(1, (Math.min(right, px0 + upp) - Math.max(left, px0)) / upp)
    );
    const a = alpha * cover;
    const out = (row * width + c) * 4;
    for (let i = 0; i < 3; i++) {
      pixels[out + i] += (ROAD_COLOR[i] - pixels[out + i]) * a;
    }
  }
}

function drawRoads(pixels, simplex, x0, z0, upp, width, rowStart, rowEnd) {
  // At least a pixel and a half wide, fading as it gets thinner than that
  const minHalf = upp * 0.75;
  const x1 = x0 + width * upp;
  const roadHalf = ChillFlightLogic.ROAD_WIDTH + 2;
  const highwayAlpha = Math.min(1, (roadHalf / minHalf) ** 0.5 + 0.35);
  const accessHalf = ChillFlightLogic.ACCESS_ROAD_WIDTH;
  const accessAlpha = Math.min(1, (accessHalf / minHalf) ** 0.5 + 0.2);
  for (let r = rowStart; r < rowEnd; r++) {
    const row = r - rowStart;
    const zTop = z0 + r * upp;
    const zMid = zTop + upp / 2;
    for (let n = 0; n <= ChillFlightLogic.ROAD_LAST; n++) {
      // Highways keep within about 5000 units of their base line
      const base =
        ChillFlightLogic.ROAD_BASE_X + n * ChillFlightLogic.ROAD_SPACING;
      if (base + 6000 < x0 || base - 6000 > x1) continue;
      // The road's centre across the row, top to bottom, so steep bends
      // stay joined up
      const a = ChillFlightLogic.getRoadCenterX(zTop, n);
      const b = ChillFlightLogic.getRoadCenterX(zTop + upp, n);
      if (Math.max(a, b) >= 0) continue;
      if (Math.max(a, b) + roadHalf < x0 || Math.min(a, b) - roadHalf > x1) {
        continue;
      }
      if (!ChillFlightLogic.highwayRunsAt(n, zMid, simplex, CONSTANTS)) {
        continue;
      }
      const slope = (b - a) / upp;
      const half = Math.max(minHalf, roadHalf * Math.sqrt(1 + slope * slope));
      paintSpan(
        pixels,
        row,
        width,
        x0,
        upp,
        Math.min(a, b) - half,
        Math.max(a, b) + half,
        highwayAlpha
      );
    }
    ChillFlightLogic.ACCESS_ROADS.forEach((road, i) => {
      // The row the road runs along (or, zoomed in, every row it covers)
      const half = Math.max(minHalf, accessHalf);
      if (road.z + half < zTop || road.z - half >= zTop + upp) return;
      if (road.maxX < x0 || road.minX > x1) return;
      if (!ChillFlightLogic.accessRoadEnds(i, simplex, CONSTANTS)?.built) {
        return;
      }
      paintSpan(pixels, row, width, x0, upp, road.minX, road.maxX, accessAlpha);
    });
  }
}
