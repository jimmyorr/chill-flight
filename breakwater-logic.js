// --- BREAKWATERS AS GROUND ---
// The rock breakwaters (terrain-gen.js findBreakwater) can't be knocked
// apart: the buggy drives up onto them and along them, and the plane keeps
// clear of them as it does the ground. This is the top of their rubble as
// a smooth mound, matching the drawn rocks (terrain-geometry.js
// breakwaterRockGeos and breakwaterHeadGeo) closely enough to drive on.

// Each piece is BREAKWATER_STRIDE numbers in a flat list: world x, z, the
// waterline's height, its turn about y, its stretch across and along, and 1
// for the round head under the beacon (0 for a 9 unit stretch)
export const BREAKWATER_STRIDE = 7;
// A stretch runs this far each way along its local z (before stretching)
const HALF_LENGTH = 4.7;
// The mound's top across it (local units from the middle, height above
// the waterline): the crown's boulders, the flank rows at the waterline,
// then down the slopes to the sea floor
const PROFILE = [
  [0, 2.6],
  [5.6, 1.7],
  [8.6, 0.2],
  [11, -1.6],
  [14.5, -4.5],
];
const REACH = PROFILE[PROFILE.length - 1][0];

function profileAt(d) {
  if (d >= REACH) return -Infinity;
  for (let i = 1; i < PROFILE.length; i++) {
    const [x1, y1] = PROFILE[i];
    if (d <= x1) {
      const [x0, y0] = PROFILE[i - 1];
      return y0 + ((d - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return -Infinity;
}

/**
 * The highest breakwater top over (x, z) in a flat list of pieces, or
 * -Infinity where there's none.
 */
export function breakwaterTopIn(pieces, x, z) {
  let top = -Infinity;
  for (
    let i = 0;
    i + BREAKWATER_STRIDE <= pieces.length;
    i += BREAKWATER_STRIDE
  ) {
    const dx = x - pieces[i];
    const dz = z - pieces[i + 1];
    // Quick reject: no piece reaches 30 units from its middle
    if (dx * dx + dz * dz > 900) continue;
    const y = pieces[i + 2];
    let d;
    if (pieces[i + 6]) {
      d = Math.sqrt(dx * dx + dz * dz);
    } else {
      // Into the stretch's own frame (composeMatrix's turn about y)
      const c = Math.cos(pieces[i + 3]);
      const s = Math.sin(pieces[i + 3]);
      const lx = (dx * c - dz * s) / pieces[i + 4];
      const lz = (dx * s + dz * c) / pieces[i + 5];
      if (Math.abs(lz) > HALF_LENGTH) continue;
      d = Math.abs(lx);
    }
    const h = profileAt(d);
    if (h > -Infinity) top = Math.max(top, y + h);
  }
  return top;
}
