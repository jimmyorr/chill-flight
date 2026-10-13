// --- LANDMARKS ---
// The named places shown on the minimap and the map (minimap.js), and the
// stops on the autopilot's sightseeing tour (autopilot.js). A tap on the map
// near one picks it (nearestLandmark).
import {ChillFlightLogic} from './chill-flight-logic.js';

export const LANDMARKS = [
  {
    name: 'Volcano',
    x: -5000,
    z: 5000,
    color: '#e74c3c', // vibrant red-orange
    symbol: '▲',
  },
  {
    // The middle of terrain chunk 5,2, where terrain-gen.js always builds it
    name: 'Lighthouse',
    x: 7500,
    z: 3000,
    color: '#3498db', // vibrant blue beacon
    symbol: '☤',
  },
  {
    name: 'Rock Arch',
    x: 3000,
    z: ChillFlightLogic.WORLD_SEED
      ? ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED)() * 10000 -
        5000
      : 0,
    color: '#2ecc71', // lush emerald green
    symbol: '∩',
  },
  {
    name: 'Falls',
    x: ChillFlightLogic.FALLS_X,
    z: ChillFlightLogic.FALLS_Z,
    color: '#7fd8f0', // falling-water blue
    symbol: '≋',
  },
  {
    // Halfway down the canyon (chill-flight-logic.js)
    name: 'Canyon',
    x: ChillFlightLogic.CANYON_PATH[2][0] * 5000,
    z: -ChillFlightLogic.CANYON_PATH[2][1] * 5000,
    color: '#d2693c', // canyon-rock rust
    symbol: '⩔',
  },
  // The airports (chill-flight-logic.js)
  ...ChillFlightLogic.AIRPORTS.map((a) => ({
    name: a.name,
    x: a.x,
    z: a.z,
    color: '#f1c40f', // runway-light amber
    symbol: '✈',
  })),
];

// The landmark nearest (x, z) within maxDist (world units), or null
export function nearestLandmark(x, z, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const lm of LANDMARKS) {
    const dist = Math.hypot(lm.x - x, lm.z - z);
    if (dist <= bestDist) {
      best = lm;
      bestDist = dist;
    }
  }
  return best;
}
