// --- LANDMARKS ---
// The named places shown on the minimap and the map (minimap.js), and the
// stops on the autopilot's sightseeing tour (autopilot.js). A tap on the map
// near one picks it (nearestLandmark), and warping there arrives in view of
// it (arrivalAt).
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

// Warping to an airport arrives on final approach: this far (units) short of
// the runway, this high above the field, at this speed (multiplier, 90 kts)
export const APPROACH_DISTANCE = 2500;
export const APPROACH_HEIGHT = 120;
export const APPROACH_SPEED = 0.6;
// Warping to another landmark arrives this far back from it, this high above
// the highest ground between
export const VIEW_DISTANCE = 3000;
export const VIEW_CLEARANCE = 300;
// Warping to a plain spot arrives this high above it
export const WARP_HEIGHT = 400;

// The highest ground (groundAt) on the way from one point to another
function highestGround(x0, z0, x1, z1, groundAt) {
  let high = -Infinity;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    high = Math.max(high, groundAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t));
  }
  return high;
}

// Where warping to place ({x, z, name}, from the map) puts a plane that's at
// (fromX, fromZ): {x, y, z}, plus yaw (its rotation.y, 0 facing -Z) when it
// should turn and speed when it should slow. groundAt(x, z) is the ground
// or water height.
// - An airport: lined up on final approach to the end planes land from (the
//   runway's -X end, where airports.js puts the green lights), low and slow.
// - Another landmark: back from it on the side the plane is coming from,
//   facing it, clear of the ground in between.
// - Anywhere else: WARP_HEIGHT above the spot, heading and speed kept.
export function arrivalAt(place, fromX, fromZ, groundAt) {
  const airport =
    place.name && ChillFlightLogic.AIRPORTS.find((a) => a.name === place.name);
  if (airport) {
    const dx = Math.cos(airport.angle);
    const dz = Math.sin(airport.angle);
    const end = ChillFlightLogic.RUNWAY_LENGTH / 2;
    const back = end + APPROACH_DISTANCE;
    const x = airport.x - dx * back;
    const z = airport.z - dz * back;
    const ground = highestGround(
      x,
      z,
      airport.x - dx * end,
      airport.z - dz * end,
      groundAt
    );
    return {
      x,
      y: Math.max(
        groundAt(airport.x, airport.z) + APPROACH_HEIGHT,
        ground + 60
      ),
      z,
      yaw: Math.atan2(-dx, -dz),
      speed: APPROACH_SPEED,
    };
  }
  if (place.name) {
    let dx = fromX - place.x;
    let dz = fromZ - place.z;
    const len = Math.hypot(dx, dz);
    // Right over it: come in from the south
    if (len < 1) [dx, dz] = [0, 1];
    else [dx, dz] = [dx / len, dz / len];
    const x = place.x + dx * VIEW_DISTANCE;
    const z = place.z + dz * VIEW_DISTANCE;
    return {
      x,
      y: highestGround(x, z, place.x, place.z, groundAt) + VIEW_CLEARANCE,
      z,
      yaw: Math.atan2(dx, dz),
    };
  }
  return {x: place.x, y: groundAt(place.x, place.z) + WARP_HEIGHT, z: place.z};
}
