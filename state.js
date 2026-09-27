// --- SHARED MUTABLE STATE ---
// Values that several files both read and write. ES modules can't reassign
// each other's exports, so shared mutable values live on this one object:
// modules import `state` and write `state.SEGMENTS = 20` directly.
import {ChillFlightLogic} from './chill-flight-logic.js';

const storedColor = localStorage.getItem('chill_flight_color');

const startSpeed = ChillFlightLogic.START_SPEED;
const initialFlightSpeed =
  startSpeed !== null && !isNaN(startSpeed)
    ? Math.max(0, Math.min(10, startSpeed))
    : 1.0;

export const state = {
  // Graphics settings (graphics presets in debug-ui.js change these)
  SEGMENTS: 40,
  RENDER_DISTANCE: 2,
  PROP_LOD_DISTANCE: 4200,

  // Day/night cycle (0..2PI: 0 = midnight, PI = noon). Starts at 05:30 to
  // catch the heart of the sunrise transition.
  timeOfDay: Math.PI * (5.5 / 12),
  daySpeedMultiplier:
    ChillFlightLogic.START_TIME_SPEED !== null
      ? ChillFlightLogic.START_TIME_SPEED
      : 1,

  // Airplane (game.js changes the color; physics/debug drive the pontoons)
  planeColor:
    storedColor !== null && !isNaN(parseInt(storedColor))
      ? parseInt(storedColor)
      : ChillFlightLogic.PLANE_COLORS[0],
  pontoonDeploymentProgress: 0,
  isDeployingPontoons: false,
  isRetractingPontoons: false,

  // Terrain chunk loading
  chunkQueue: [],
  _enableObjects: ChillFlightLogic.SHOW_OBJECTS, // procedural props toggle

  // Flight dynamics
  flightSpeedMultiplier: initialFlightSpeed,
  targetFlightSpeed: initialFlightSpeed,
  verticalVelocity: 0,
};

// Bridge for classic scripts that haven't been converted to ES modules yet:
// each key becomes a window property backed by `state`, so a classic script's
// `SEGMENTS = 20` updates state.SEGMENTS and modules see the change.
for (const key of Object.keys(state)) {
  Object.defineProperty(window, key, {
    get: () => state[key],
    set: (value) => {
      state[key] = value;
    },
    configurable: true,
  });
}
