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

  // Next frame's yaw, computed in game-loop.js and applied by flight-physics.js
  _nextYaw: undefined,

  // Terrain chunk loading
  chunkQueue: [],
  _enableObjects: ChillFlightLogic.SHOW_OBJECTS, // procedural props toggle

  // Flight dynamics
  flightSpeedMultiplier: initialFlightSpeed,
  targetFlightSpeed: initialFlightSpeed,
  verticalVelocity: 0,

  // Input and flight controls (game-input-bindings.js)
  dismissLoadingScreen: undefined, // Hoisted for early XR events
  mouseX: 0,
  mouseY: 0,
  mouseControlActive: false, // becomes true once the mouse moves; cleared by arrow-key presses
  windowJustFocused: false, // absorbs the first mousemove after returning to the tab
  currentControlScheme: undefined, // set in game-input-bindings.js
  joystickActive: false,
  joystickTouchId: null,
  startPlaneTooltipShown: undefined, // set in game-input-bindings.js
  dismissStartPlaneTooltipFunc: null,
  stoppedStartTime: null,
  targetPitch: 0,
  targetRoll: 0,
  smoothedManeuverFactor: 0, // Ensures smooth cinematic transitions
  manualPitch: 0,
  cameraMode: 'follow', // 'follow', 'first-person', 'birds-eye-close', 'birds-eye-far', or 'cinematic'
  cameraTransitionProgress: 0, // 0 = follow/cinematic, 1 = bird's eye
  currentBirdEyeHeight: 2000,
  _cinematicStableHeading: 0,
  isDoingImmelmann: false,
  immelmannProgress: 0,
  wasLooping: false,
  wasDoingFullLoop: false,
  wasBarrelRolling: false,
  wasDoingFullBarrelRoll: false,
  wasDoingImmelmann: false,

  // Pause state (game-state.js)
  isPaused: true,
  justResumed: false, // one-frame guard to suppress any input that bled through from the pause menu

  // Game session, flight, sky, and effects (game.js)
  isVRPresenting: false,
  latScale: 5000,
  currentLatDeg: 0,
  currentLatRad: 0,
  sunX: 0,
  sunY: 0,
  sunZ: 0,
  moonX: 0,
  moonY: 0,
  moonZ: 0,
  dayFactor: 0,
  passedServerNow: 0,
  secondsInCycle: 0,
  currentWarpedProgress: 0,
  isBarrelRolling: false,
  isDoingFullBarrelRoll: false,
  isClampedRoll: false,
  isLooping: false,
  isDoingFullLoop: false,
  manualRollSpeed: 4.0,
  manualLoopSpeed: 2.5,
  sessionDistanceTravelled: 0,
  previousPosition: null,
  lifetimeDistanceTravelled: undefined, // set in game.js
  distanceSinceLastSave: 0,
  isIntroTransitionActive: false,
  introTransitionStartTime: 0,
  freeCamDeltaX: 0,
  freeCamDeltaY: 0,
  lastY: 250, // track for ascent/descent detection
  _deltaRingIndex: 0,
  _deltaRingCount: 0,
  _deltaRingSum: 0,
  smoothedDelta: undefined, // set in game.js
  gyroEnabled: undefined, // set in game.js
  gyroBasePitch: null,
  gyroBaseRoll: null,
  maxFPS: 60,
  frameMinDelay: undefined, // set in game.js
  lastFrameTime: 0,
  _auroraSessionMax: 0, // tracks highest aurora intensity seen this session
  isShootingStarActive: false,
  forceShootingStar: false,
  shootingStarProgress: 0,
  shootingStarDuration: 1.0,
  forceRainbow: false,
  rainbowTimer: 0,
  rainbowIntensity: 0,
  wasRainClearing: true,

  // Values previously stored directly on window
  _basePixelRatio: undefined,
  _gameServerNow: undefined,
  _unfadedRainOpacity: undefined,
  _unfadedSnowOpacity: undefined,
  _weatherDebug: undefined,
  airplaneModel: undefined,
  propGroup: undefined,
  propGroups: undefined,
  autopilotEnabled: undefined,
  manualBaseFogDensity: undefined,
  manualPropLOD: undefined,
  manualTimeOfDay: undefined,
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
