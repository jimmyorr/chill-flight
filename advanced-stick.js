// --- ADVANCED JOYSTICK ---
// The "Advanced" touch scheme for the planes (Settings, Controls): the same
// floating joystick, but sideways it rolls the plane and leaves the bank
// where it is (so it can be held on its side, or rolled right round), and
// up and down it pulls the nose toward the plane's own top. The flight model
// is advanced-stick-logic.js and the stick comes from input-manager.js; this
// applies it to the plane (from game-loop.js) and draws the bank arc. The
// buggy keeps the usual joystick.
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {planeGroup, planeHandling} from './airplane.js';
import {tickHaptic} from './haptics.js';
import {Achievements} from './achievements.js';
import {inputManager} from './game-input-bindings.js';
import {
  attitudeOf,
  newAdvancedStickState,
  stepAdvancedStickAttitude,
  axisResponse,
} from './advanced-stick-logic.js';

const SCHEME_KEY = 'chill_flight_control_scheme';
const ROLL_KEY = 'chill_flight_advanced_roll';
// The bank arc shows from this bank (radians)
const ARC_FROM = (20 * Math.PI) / 180;

function saved(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; still applies this session
  }
}

// The two-thumb scheme it replaced, if saved, is this one now
if (saved(SCHEME_KEY) === 'twothumbs') save(SCHEME_KEY, 'advanced');
// ?controls=advanced flies the scheme for this visit without saving it
// (?controls=twothumbs too, from before)
if (
  ['advanced', 'twothumbs'].includes(ChillFlightLogic.CONTROLS_PARAM) ||
  state.currentControlScheme === 'twothumbs'
) {
  state.currentControlScheme = 'advanced';
  inputManager.state.controlScheme = 'advanced';
}

// The stick keeps the bank when let go, or (spring) the bank follows the
// stick and springs level: ?roll=spring / ?roll=hold, or the debug panel's
// switch, which is saved
let springRoll =
  ChillFlightLogic.ROLL_PARAM === 'spring' ||
  (ChillFlightLogic.ROLL_PARAM !== 'hold' && saved(ROLL_KEY) === 'spring');

export function isSpringRoll() {
  return springRoll;
}

export function setSpringRoll(on) {
  springRoll = !!on;
  save(ROLL_KEY, springRoll ? 'spring' : 'hold');
}

const springToggle = document.getElementById('debug-spring-roll-toggle');
if (springToggle) {
  springToggle.checked = springRoll;
  springToggle.addEventListener('change', () =>
    setSpringRoll(springToggle.checked)
  );
}

// Whether the advanced joystick is flying the vehicle
export function advancedStickFlying() {
  return (
    state.currentControlScheme === 'advanced' && !state.airplaneModel?.isBuggy
  );
}

const flight = newAdvancedStickState();
const _quat = [0, 0, 0, 1];
let hadNotch = false;

// The stick (or arrow keys) this frame, with Invert y axis applied: each
// axis counts as held while it is out of the middle, so letting it back to
// the middle sideways keeps the bank (and catches a notch), and up and down
// lets the nose ease back to the horizon
export function advancedStickInput() {
  const input = inputManager.getAdvancedStick();
  if (state.invertYAxis) input.pull = -input.pull;
  input.rollHeld = axisResponse(input.roll) !== 0;
  input.pullHeld = axisResponse(input.pull) !== 0;
  return input;
}

/**
 * One frame of advanced joystick flight: turns the plane by the stick.
 *   kts         the plane's speed
 *   climbLimit  the steepest climb allowed now (radians), or Infinity
 *   turnScale   the speed-dependent turn rate
 */
export function updateAdvancedStickFlight(delta, {kts, climbLimit, turnScale}) {
  const input = advancedStickInput();
  const levelTap = inputManager.state.advancedStick.levelTap;
  inputManager.state.advancedStick.levelTap = false;
  const q = planeGroup.quaternion;
  _quat[0] = q.x;
  _quat[1] = q.y;
  _quat[2] = q.z;
  _quat[3] = q.w;
  const out = stepAdvancedStickAttitude(flight, {
    quat: _quat,
    roll: input.roll,
    pull: input.pull,
    rollHeld: input.rollHeld,
    pullHeld: input.pullHeld,
    active: input.active,
    levelTap,
    spring: springRoll,
    handling: planeHandling(),
    kts,
    climbLimit,
    turnScale,
    grounded: state.isOnGround || state.isOnWater,
    dt: delta,
  });
  // (Setting the quaternion updates the plane's rotation, order YXZ)
  q.set(out.quat[0], out.quat[1], out.quat[2], out.quat[3]);
  state._nextYaw = planeGroup.rotation.y;
  state.targetPitch = planeGroup.rotation.x;
  state.targetRoll = planeGroup.rotation.z;
  // A loop by hand is flown as the tap loop is: the camera follows the
  // plane over the top, and the plane doesn't sink through it
  state.isLooping = flight.looping;

  // A tick as the bank clicks onto a notch
  const notched = flight.notch !== null;
  if (hadNotch && !notched && !input.rollHeld) tickHaptic();
  hadNotch = notched;

  if (out.rolled) Achievements.unlock('barrel_roll');
  if (out.looped) Achievements.unlock('froot_loops');
}

// Starts the flight model afresh (leaving the scheme, a crash, a warp)
export function resetAdvancedStickFlight() {
  Object.assign(flight, newAdvancedStickState());
  hadNotch = false;
}

// --- The bank arc ---
let arc = null;
let arcShown = false;
let lastDegrees = null;

function buildArc() {
  const el = document.createElement('div');
  el.id = 'bank-arc';
  el.innerHTML =
    '<svg viewBox="-60 -66 120 72" aria-hidden="true">' +
    '<path d="M -48 0 A 48 48 0 0 1 48 0" class="bank-arc-line"/>' +
    '<path d="M -48 0 h 8 M 48 0 h -8 M 0 -48 v 8 ' +
    'M -33.9 -33.9 l 5.7 5.7 M 33.9 -33.9 l -5.7 5.7" class="bank-arc-ticks"/>' +
    '<polygon points="0,-50 -5,-61 5,-61" class="bank-arc-pointer"/>' +
    '</svg><b></b>';
  document.body.appendChild(el);
  return {
    el,
    pointer: el.querySelector('.bank-arc-pointer'),
    degrees: el.querySelector('b'),
  };
}

// Every frame (game-loop.js): the bank arc, while banked past ARC_FROM
export function updateAdvancedStickHud() {
  const on =
    advancedStickFlying() &&
    !state.isPaused &&
    !state.isFreeCamera &&
    ChillFlightLogic.SHOW_UI;
  if (!on && !arc) return;
  if (!arc) arc = buildArc();
  const q = planeGroup.quaternion;
  const bank = on ? attitudeOf([q.x, q.y, q.z, q.w]).roll : 0;
  const show = on && Math.abs(bank) > (arcShown ? ARC_FROM * 0.7 : ARC_FROM);
  if (show !== arcShown) {
    arc.el.classList.toggle('shown', show);
    arcShown = show;
  }
  if (!show) return;
  // The pointer leans the way the plane does (a right bank is negative)
  const degrees = Math.round((-bank * 180) / Math.PI);
  if (degrees !== lastDegrees) {
    lastDegrees = degrees;
    arc.pointer.setAttribute('transform', `rotate(${degrees})`);
    arc.degrees.textContent = `${Math.abs(degrees)}°`;
  }
}
