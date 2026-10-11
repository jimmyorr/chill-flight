// map-palette.js
// Map colours for a height: the minimap, the fullscreen map and the map
// export page (debug/debug-export-map.html) all draw with these.
//
// PALETTE SYNC RULE: Whenever adding elevation passes or regional biomes to
// ChillFlightLogic.getElevation(), ensure corresponding coordinate/altitude
// colour mapping is added here (e.g. frozen north pack ice vs beach sand).
import {ChillFlightLogic} from './chill-flight-logic.js';

// The frozen north pack ice shelf (chill-flight-logic.js) draws as ice, not land
function isPackIce(elev, wz) {
  return wz < -20000 && elev <= 72;
}

// Region colours over the height colours, for land: the snowy north, the
// red-rock south and the alien lands from about 10 degrees East and West.
// Uses the terrain's own noise and region edges (snowFactorAt, snowWobble,
// desertShift and alienAt in chill-flight-logic.js), so the map matches the
// ground.
function tintForRegion(out, wx, wz, elev, simplex) {
  let [r, g, b] = out;
  const noisePath = simplex.noise2D(wx * 0.0001, wz * 0.0001);
  const biomeNoise = simplex.noise2D(wx * 0.0005, wz * 0.0005) * 0.1;

  const snow = ChillFlightLogic.snowFactorAt(
    wz,
    noisePath * 0.05 + biomeNoise + ChillFlightLogic.snowWobble(wx, wz, simplex)
  );
  if (snow > 0) {
    const k = snow * 0.8;
    r += (238 - r) * k;
    g += (242 - g) * k;
    b += (246 - b) * k;
  }

  const desertRaw = Math.max(
    0,
    Math.min(
      1,
      Math.max(0, wz / 5000) +
        ChillFlightLogic.desertShift(wx, wz, simplex) +
        noisePath * 0.05 -
        biomeNoise -
        2.0
    )
  );
  const desert = desertRaw * desertRaw * (3 - 2 * desertRaw);
  if (desert > 0) {
    // Sand on the flats, red rock up high
    const rock = Math.max(0, Math.min(1, (elev - 150) / 250));
    const k = desert * 0.75;
    r += (226 - 50 * rock - r) * k;
    g += (168 - 76 * rock - g) * k;
    b += (110 - 48 * rock - b) * k;
  }

  const alien = ChillFlightLogic.alienAt(wx, wz, simplex);
  if (alien > 0) {
    const k = alien * 0.6;
    const east = wx > 0;
    r += ((east ? 70 : 200) - r) * k;
    g += ((east ? 200 : 90) - g) * k;
    b += ((east ? 210 : 190) - b) * k;
  }

  out[0] = r;
  out[1] = g;
  out[2] = b;
}

// The map colour for ground at height elev at (wx, wz), written to out as
// [r, g, b] (0-255, not rounded once tinted). Returns out.
export function mapColor(elev, wx, wz, simplex, out = [0, 0, 0]) {
  if (elev <= 40) {
    // Bathymetry depth variation for crisp, clean coastlines
    const depth = Math.min(1.0, (40 - elev) / 12);
    out[0] = Math.round(34 - depth * 12);
    out[1] = Math.round(66 - depth * 22);
    out[2] = Math.round(120 - depth * 32);
    return out;
  }
  if (isPackIce(elev, wz)) {
    // Frozen north pack ice shelf (slate-blue to crisp snow white)
    const t = Math.min(1.0, (elev - 40) / 32);
    out[0] = Math.round(180 + t * 65);
    out[1] = Math.round(196 + t * 52);
    out[2] = Math.round(212 + t * 40);
    return out;
  }
  if (elev <= 44) {
    // Sand beach
    out[0] = 223;
    out[1] = 204;
    out[2] = 173;
  } else if (elev <= 120) {
    const t = (elev - 44) / 76;
    out[0] = Math.round(223 - t * 133);
    out[1] = Math.round(204 - t * 66);
    out[2] = Math.round(173 - t * 77);
  } else if (elev <= 250) {
    const t = (elev - 120) / 130;
    out[0] = Math.round(90 + t * 49);
    out[1] = Math.round(138 - t * 10);
    out[2] = Math.round(96 + t * 5);
  } else if (elev <= 500) {
    const t = (elev - 250) / 250;
    out[0] = Math.round(139 - t * 47);
    out[1] = Math.round(128 - t * 43);
    out[2] = Math.round(101 - t * 27);
  } else {
    const t = Math.min(1.0, (elev - 500) / 300);
    out[0] = Math.round(92 + t * 148);
    out[1] = Math.round(85 + t * 158);
    out[2] = Math.round(74 + t * 171);
  }
  tintForRegion(out, wx, wz, elev, simplex);
  return out;
}

// Northwest hillshade for land at idx in a gridW-wide height grid whose
// samples are `spacing` world units apart: a brightness offset (-32 to 32)
// from the slope, so it looks the same at every zoom; 0 on water and the
// grid's edge
const SHADE_PER_SLOPE = 57;
export function mapShade(heights, idx, gridW, gridH, spacing) {
  const gx = idx % gridW;
  const gz = (idx - gx) / gridW;
  if (heights[idx] <= 40 || gx === 0 || gz === 0) return 0;
  if (gx === gridW - 1 || gz === gridH - 1) return 0;
  const dz = heights[idx + gridW] - heights[idx - gridW];
  const dx = heights[idx + 1] - heights[idx - 1];
  const slope = (-dx - dz) / (2 * spacing);
  return Math.max(-32, Math.min(32, slope * SHADE_PER_SLOPE));
}
