// --- TWO-THUMB FLIGHT ---
// The "Two thumbs" touch scheme for the planes (Settings, Controls): a thumb
// on the left half of the screen rolls the plane and one on the right half
// pulls its nose toward its own top, so a bank can be held, even on its
// side. The flight model is two-thumb-logic.js and the thumbs come from
// input-manager.js; this applies them to the plane (from game-loop.js) and
// draws the thumbs' pills and the bank arc. The buggy keeps the joystick.
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {planeGroup, planeHandling} from './airplane.js';
import {tickHaptic} from './haptics.js';
import {Achievements} from './achievements.js';
import {inputManager} from './game-input-bindings.js';
import {t} from './i18n.js';
import {
  attitudeOf,
  newTwoThumbState,
  stepTwoThumbAttitude,
} from './two-thumb-logic.js';

const ROLL_KEY = 'chill_flight_two_thumb_roll';
const HINT_KEY = 'chill_flight_two_thumb_hint';
// The thumbs' pills show faintly where thumbs go for this long (seconds),
// the first time the scheme is flown
const HINT_SECONDS = 10;
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

// ?controls=twothumbs flies the scheme for this visit without saving it
if (ChillFlightLogic.CONTROLS_PARAM === 'twothumbs') {
  state.currentControlScheme = 'twothumbs';
  inputManager.state.controlScheme = 'twothumbs';
}

// The roll thumb keeps the bank when it lifts, or (spring) the bank follows
// the thumb and springs level: ?roll=spring / ?roll=hold, or the debug
// panel's switch, which is saved
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

// Whether the two thumbs are flying the vehicle
export function twoThumbsFlying() {
  return (
    state.currentControlScheme === 'twothumbs' && !state.airplaneModel?.isBuggy
  );
}

const flight = newTwoThumbState();
const _quat = [0, 0, 0, 1];
let hadNotch = false;

// The thumbs (or arrow keys) this frame, with Invert y axis applied
export function twoThumbInput() {
  const input = inputManager.getTwoThumbs();
  if (state.invertYAxis) input.pull = -input.pull;
  return input;
}

/**
 * One frame of two-thumb flight: turns the plane by the thumbs.
 *   kts         the plane's speed
 *   climbLimit  the steepest climb allowed now (radians), or Infinity
 *   turnScale   the speed-dependent turn rate
 */
export function updateTwoThumbFlight(delta, {kts, climbLimit, turnScale}) {
  const input = twoThumbInput();
  const levelTap = inputManager.state.twoThumbs.levelTap;
  inputManager.state.twoThumbs.levelTap = false;
  const q = planeGroup.quaternion;
  _quat[0] = q.x;
  _quat[1] = q.y;
  _quat[2] = q.z;
  _quat[3] = q.w;
  const out = stepTwoThumbAttitude(flight, {
    quat: _quat,
    roll: input.roll,
    pull: input.pull,
    rollHeld: input.rollHeld,
    pullHeld: input.pullHeld,
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
export function resetTwoThumbFlight() {
  Object.assign(flight, newTwoThumbState());
  hadNotch = false;
}

// --- The thumbs' pills and the bank arc ---
let hud = null;
let hintLeft = 0; // seconds the first-time hint still shows

function buildHud() {
  const pill = (side, label) => {
    const el = document.createElement('div');
    el.className = `thumb-pill thumb-pill-${side}`;
    const knob = document.createElement('div');
    knob.className = 'thumb-pill-knob';
    const text = document.createElement('span');
    text.className = 'thumb-pill-label';
    text.textContent = label;
    el.append(knob, text);
    document.body.appendChild(el);
    return {el, knob, shown: false};
  };
  const arc = document.createElement('div');
  arc.id = 'bank-arc';
  arc.innerHTML =
    '<svg viewBox="-60 -66 120 72" aria-hidden="true">' +
    '<path d="M -48 0 A 48 48 0 0 1 48 0" class="bank-arc-line"/>' +
    '<path d="M -48 0 h 8 M 48 0 h -8 M 0 -48 v 8 ' +
    'M -33.9 -33.9 l 5.7 5.7 M 33.9 -33.9 l -5.7 5.7" class="bank-arc-ticks"/>' +
    '<polygon points="0,-50 -5,-61 5,-61" class="bank-arc-pointer"/>' +
    '</svg><b></b>';
  document.body.appendChild(arc);
  return {
    roll: pill('roll', t('Roll')),
    pull: pill('pull', t('Pull')),
    arc,
    pointer: arc.querySelector('.bank-arc-pointer'),
    degrees: arc.querySelector('b'),
    arcShown: false,
    lastDegrees: null,
  };
}

function showPill(p, thumb, horizontal, hintX, hintY) {
  const show = thumb.active || hintLeft > 0;
  if (show !== p.shown) {
    p.el.classList.toggle('shown', show);
    p.shown = show;
  }
  if (!show) return;
  const hinting = !thumb.active;
  p.el.classList.toggle('hint', hinting);
  const x = hinting ? window.innerWidth * hintX : thumb.startX;
  const y = hinting ? window.innerHeight * hintY : thumb.startY;
  p.el.style.left = `${x}px`;
  p.el.style.top = `${y}px`;
  const travel = thumb.value * inputManager.THUMB_TRAVEL;
  p.knob.style.transform = horizontal
    ? `translate(calc(-50% + ${travel}px), -50%)`
    : `translate(-50%, calc(-50% - ${travel}px))`;
}

// Every frame (game-loop.js): the pills under the thumbs, and the bank arc
export function updateTwoThumbHud(delta) {
  const on = twoThumbsFlying() && !state.isPaused && !state.isFreeCamera;
  if (!on && !hud) return;
  if (!hud) {
    if (!ChillFlightLogic.SHOW_UI) return;
    hud = buildHud();
    if (!saved(HINT_KEY)) {
      hintLeft = HINT_SECONDS;
      save(HINT_KEY, '1');
    }
  }
  document.body.classList.toggle('two-thumbs', twoThumbsFlying());
  if (!on) {
    for (const p of [hud.roll, hud.pull]) {
      if (p.shown) p.el.classList.remove('shown');
      p.shown = false;
    }
    if (hud.arcShown) hud.arc.classList.remove('shown');
    hud.arcShown = false;
    return;
  }
  if (hintLeft > 0 && state.flightSpeedMultiplier > 0) hintLeft -= delta;
  const thumbs = inputManager.state.twoThumbs;
  showPill(hud.roll, thumbs.roll, true, 0.2, 0.62);
  showPill(hud.pull, thumbs.pull, false, 0.8, 0.55);

  const bank = attitudeOf([
    planeGroup.quaternion.x,
    planeGroup.quaternion.y,
    planeGroup.quaternion.z,
    planeGroup.quaternion.w,
  ]).roll;
  const showArc = Math.abs(bank) > (hud.arcShown ? ARC_FROM * 0.7 : ARC_FROM);
  if (showArc !== hud.arcShown) {
    hud.arc.classList.toggle('shown', showArc);
    hud.arcShown = showArc;
  }
  if (showArc) {
    // The pointer leans the way the plane does (a right bank is negative)
    const degrees = Math.round((-bank * 180) / Math.PI);
    if (degrees !== hud.lastDegrees) {
      hud.lastDegrees = degrees;
      hud.pointer.setAttribute('transform', `rotate(${degrees})`);
      hud.degrees.textContent = `${Math.abs(degrees)}°`;
    }
  }
}
