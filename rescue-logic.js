// --- GETTING A STUCK BUGGY OUT ---
// Pure maths for buggy.js (and Node tests, scripts/test-rescue.js): when a
// buggy that's trying to go has hardly moved for a while (in a pit, wedged
// against a wall, fallen off a road into a chasm), it's put back on the
// nearest highway, facing the way along it nearest where it was heading.
// Away from any highway, it goes back to the last place it was driving
// well (lastGood).
import {ChillFlightLogic as L} from './chill-flight-logic.js';

export const STUCK = {
  // Trying to go (stick or cruise) but within MIN_MOVE units of where it
  // was AFTER seconds ago
  AFTER: 5,
  MIN_MOVE: 40,
  // Cruise above this (kts) counts as trying to go
  CRUISE_KTS: 20,
  // How far along a highway to look for solid ground off a bridge (units),
  // and how far off a highway counts as near one
  ALONG: 3000,
  NEAR: 12000,
};

/** A fresh watch for stepStuck. */
export function newStuckWatch() {
  return {x: 0, z: 0, t: 0, set: false};
}

/**
 * Advances `w` by dt seconds for a buggy at (x, z), `trying` to go; true
 * once it's been stuck STUCK.AFTER seconds (then starts over).
 */
export function stepStuck(w, dt, x, z, trying) {
  if (!trying || !w.set || Math.hypot(x - w.x, z - w.z) > STUCK.MIN_MOVE) {
    w.x = x;
    w.z = z;
    w.t = 0;
    w.set = trying;
    return false;
  }
  w.t += dt;
  if (w.t < STUCK.AFTER) return false;
  w.t = 0;
  w.set = false;
  return true;
}

// The highways that run near (x, z): [{n, along}], nearest line first
function highwaysNear(x, z) {
  const out = [];
  const n0 = Math.round((x - L.ROAD_BASE_X) / L.ROAD_SPACING);
  for (let n = n0 - 1; n <= n0 + 1; n++) {
    if (n < 0 || n > L.ROAD_LAST) continue;
    if (L.roadCenter(n, z) >= 0) continue;
    out.push({n, along: z, off: Math.abs(x - L.roadCenter(n, z))});
  }
  if (x > L.ROAD_EW_WEST && x < L.ROAD_EW_EAST) {
    out.push({
      n: L.ROAD_EW,
      along: x,
      off: Math.abs(z - L.roadCenter(L.ROAD_EW, x)),
    });
  }
  return out.sort((a, b) => a.off - b.off);
}

/**
 * The nearest spot on a highway to (x, z) where it runs on the ground (not
 * a bridge), within STUCK.NEAR: {x, y, z, heading} facing along the road
 * the way nearest `heading` (0 is -z), y the road's height; null if none.
 * `simplex` and `constants` as for ChillFlightLogic.getElevation.
 */
export function nearestRoadSpot(x, z, heading, simplex, constants) {
  const water = constants.WATER_LEVEL ?? 40;
  for (const {n, along, off} of highwaysNear(x, z)) {
    if (off > STUCK.NEAR) continue;
    for (let d = 0; d <= STUCK.ALONG; d += 100) {
      for (const a of d ? [along + d, along - d] : [along]) {
        if (!L.highwayRunsAt(n, a, simplex, constants)) continue;
        const p = L.roadPoint(n, a, L.roadCenter(n, a));
        const natural = L.getElevation(p.x, p.z, simplex, constants, null, {
          ignoreRivers: true,
          ignoreRoads: true,
          forRoad: true,
        });
        const y = L.highwayHeight(natural, water);
        const ground = L.getElevation(p.x, p.z, simplex, constants, null);
        if (y - ground > 10) continue; // a bridge
        const q = L.roadPoint(n, a + 10, L.roadCenter(n, a + 10));
        let h = Math.atan2(-(q.x - p.x), -(q.z - p.z));
        const turn = Math.abs(wrap(h - heading));
        if (turn > Math.PI / 2) h = wrap(h + Math.PI);
        return {x: p.x, y: Math.max(y, ground + 1), z: p.z, heading: h};
      }
    }
  }
  return null;
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
