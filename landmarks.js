// --- LANDMARKS ---
// The named places shown on the minimap and the map (minimap.js), and the
// stops on the autopilot's sightseeing tour (autopilot.js). A tap on the map
// near one picks it (nearestLandmark), and warping there arrives in view of
// it (arrivalAt).
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';

// The pyramids' and dragon skeleton's places depend on the world
// (chill-flight-logic.js)
const pyramids = ChillFlightLogic.pyramidSite(simplex, {WATER_LEVEL: 40});
const dragon = ChillFlightLogic.dragonSite(simplex, {WATER_LEVEL: 40});

// Map pin colours: orange for sightseeing landmarks, aviation blue for
// airports, leaving gold (#ffd700) for the player arrow and waypoint
export const LANDMARK_COLOR = '#f07828';
export const AIRPORT_COLOR = '#2589f5';

export const LANDMARKS = [
  {
    name: 'Volcano',
    x: -5000,
    z: 5000,
    color: LANDMARK_COLOR,
    symbol: '▲',
  },
  {
    // The middle of terrain chunk 5,2, where terrain-gen.js always builds it
    name: 'Lighthouse',
    x: 7500,
    z: 3000,
    color: LANDMARK_COLOR,
    symbol: '☤',
  },
  {
    name: 'Rock Arch',
    x: 3000,
    z: ChillFlightLogic.WORLD_SEED
      ? ChillFlightLogic.mulberry32(ChillFlightLogic.WORLD_SEED)() * 10000 -
        5000
      : 0,
    color: LANDMARK_COLOR,
    symbol: '∩',
  },
  {
    name: 'Falls',
    x: ChillFlightLogic.FALLS_X,
    z: ChillFlightLogic.FALLS_Z,
    color: LANDMARK_COLOR,
    symbol: '≋',
  },
  {
    // Halfway down the canyon (chill-flight-logic.js)
    name: 'Canyon',
    x: ChillFlightLogic.CANYON_PATH[2][0] * 5000,
    z: -ChillFlightLogic.CANYON_PATH[2][1] * 5000,
    color: LANDMARK_COLOR,
    symbol: '⩔',
  },
  ...(pyramids
    ? [
        {
          // The middle of the three
          name: 'Pyramids',
          x: pyramids.x,
          z: pyramids.z,
          color: LANDMARK_COLOR,
          symbol: '△',
        },
      ]
    : []),
  ...(dragon
    ? [
        {
          name: 'Skeleton',
          x: dragon.x,
          z: dragon.z,
          color: LANDMARK_COLOR,
          symbol: 'Ψ',
        },
      ]
    : []),
  // The airports (chill-flight-logic.js)
  ...ChillFlightLogic.AIRPORTS.map((a) => ({
    name: a.name,
    x: a.x,
    z: a.z,
    color: AIRPORT_COLOR,
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
// the runway, this high above the field, at this speed (multiplier, 90 kts
// for the seaplane; minimap.js scales it for the others)
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

// --- BUGGY ARRIVALS ---
// A buggy can't fly in, so warping one puts it down close by, parked (no
// speed, cruise off), facing the place: you look at it and drive the last
// bit. How far back (units) it parks from each landmark, sized to it: past
// the volcano's steep cone, the pyramids and the skeleton's bones, in sight
// of the others. A place not listed (a map pin) parks right on the spot.
export const BUGGY_VIEW = {
  Volcano: 2000,
  Pyramids: 900,
  Skeleton: 450,
  Lighthouse: 200,
  'Rock Arch': 300,
  Falls: 800,
  Canyon: 250,
};
// Landmarks seen best from one side, whichever way it's coming from (x, z
// of that side): the Falls pour from the south wall of their table mountain
export const BUGGY_SIDE = {Falls: [0, 1]};
// Into an airport's runway from the end planes land from (units), facing
// down it
export const BUGGY_RUNWAY_IN = 60;
// The steepest ground (rise over run) it parks on: about 10 degrees
export const BUGGY_PARK_SLOPE = 0.18;
// Ground no higher than this above the sea is water (it hovers on it); dry
// land is tried first
const SEA = 40.5;

// How steep the ground is round (x, z): the steepest rise over run from it
// out to a little more than the drawn terrain's grid (75 units apart on the
// low preset), whose flat triangles smear a nearby cliff across the spot
const SLOPE_REACH = [25, 50, 80];
function slopeAt(x, z, groundAt) {
  const h = groundAt(x, z);
  let steep = 0;
  for (const r of SLOPE_REACH) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const rise = groundAt(x + Math.cos(a) * r, z + Math.sin(a) * r) - h;
      steep = Math.max(steep, Math.abs(rise) / r);
    }
  }
  return steep;
}

// Where warping to place puts a buggy that's at (fromX, fromZ), heading
// (yaw) yaw: {x, y, z, yaw, speed: 0}, on ground level enough to park on.
// - An airport: on the runway just in from the end planes land from,
//   facing down it.
// - A landmark: BUGGY_VIEW back from it on the side it's coming from (or
//   its BUGGY_SIDE),
//   facing it. Too steep there (or water, while there's land), it tries
//   further round either way, then further back.
// - Anywhere else: on the spot, heading kept (or the nearest level ground
//   round it).
export function buggyArrivalAt(place, fromX, fromZ, yaw, groundAt) {
  const airport =
    place.name && ChillFlightLogic.AIRPORTS.find((a) => a.name === place.name);
  if (airport) {
    const dx = Math.cos(airport.angle);
    const dz = Math.sin(airport.angle);
    const back = ChillFlightLogic.RUNWAY_LENGTH / 2 - BUGGY_RUNWAY_IN;
    const x = airport.x - dx * back;
    const z = airport.z - dz * back;
    return {x, y: groundAt(x, z), z, yaw: Math.atan2(-dx, -dz), speed: 0};
  }
  const view = (place.name && BUGGY_VIEW[place.name]) ?? 0;
  let dx = fromX - place.x;
  let dz = fromZ - place.z;
  const len = Math.hypot(dx, dz);
  const side = place.name && BUGGY_SIDE[place.name];
  if (side) [dx, dz] = side;
  else if (len < 1) [dx, dz] = [0, 1];
  else [dx, dz] = [dx / len, dz / len];
  const from = Math.atan2(dz, dx);
  // Back from it, round from the side it's coming from (dry land first,
  // then water), then further back
  const level = (x, z) => slopeAt(x, z, groundAt) <= BUGGY_PARK_SLOPE;
  let pick = null;
  for (const scale of [1, 1.5, 2, 3]) {
    const r = view ? view * scale : 150 * (scale - 1);
    const turns = r ? 16 : 1;
    const ring = [];
    for (let i = 0; i < turns; i++) {
      const step = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      const a = from + (step * Math.PI * 2) / turns;
      ring.push([place.x + Math.cos(a) * r, place.z + Math.sin(a) * r]);
    }
    pick =
      ring.find(([x, z]) => groundAt(x, z) > SEA && level(x, z)) ||
      ring.find(([x, z]) => level(x, z));
    if (pick) break;
  }
  // Nowhere level: back from it as a plane would be
  pick ??= [place.x + dx * view, place.z + dz * view];
  const [x, z] = pick;
  // Facing the landmark (from the spot towards it); a pin keeps the heading
  const faceX = place.x - x;
  const faceZ = place.z - z;
  return {
    x,
    y: groundAt(x, z),
    z,
    yaw:
      view && Math.hypot(faceX, faceZ) > 1 ? Math.atan2(-faceX, -faceZ) : yaw,
    speed: 0,
  };
}
