// --- ZEN ---
// Hides the HUD and buttons for an unobstructed view (the `zen` class on the
// body; see style.css), and the other planes (traffic.js). Toggled by the Zen
// checkbox in the pause menu or Z, and turned off by double-tapping the center
// of the screen. Saved between visits. Each time it turns on in flight the HUD
// fades away and a line in the sky says how to get it back, then fades too.
import {inputManager} from './game-input-bindings.js';
import {hooks} from './hooks.js';
import {state} from './state.js';
import {setTrafficEnabled} from './traffic.js';

const STORAGE_KEY = 'chill_flight_zen';
// How long the HUD takes to fade, including its stagger (style.css)
const FADE_MS = 1900;

const checkbox = document.getElementById('zen-toggle-input');
const hint = document.getElementById('zen-hint');

let zenEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
let fadeTimer = null;
// Turned on while paused (or before the game starts): the fade and the hint
// wait for flight
let waiting = false;

function showHint() {
  if (!hint) return;
  const isTouch = window.matchMedia('(any-pointer: coarse)').matches;
  hint.innerHTML = isTouch
    ? 'Double-tap center to exit zen'
    : 'Press <b>Z</b> to exit zen';
  // Restart the animation
  hint.classList.remove('show');
  void hint.offsetWidth;
  hint.classList.add('show');
}

function hideHint() {
  if (hint) hint.classList.remove('show');
}

// The HUD fades out, then is hidden
function fadeOut() {
  document.body.classList.add('zen-fading');
  fadeTimer = setTimeout(() => {
    fadeTimer = null;
    document.body.classList.add('zen');
    document.body.classList.remove('zen-fading');
  }, FADE_MS);
  showHint();
}

function setZen(enabled, {instant = false} = {}) {
  // Not during tag or a race (multiplayer.js turns it off when one starts)
  if (enabled && hooks.inGameMode?.()) enabled = false;
  zenEnabled = enabled;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  setTrafficEnabled(!enabled);
  if (checkbox) checkbox.checked = enabled;
  clearTimeout(fadeTimer);
  fadeTimer = null;
  document.body.classList.remove('zen-fading');
  waiting = false;
  if (!enabled) {
    document.body.classList.remove('zen');
    hideHint();
  } else if (instant) {
    // Already on from last visit: nothing on screen to fade yet
    document.body.classList.add('zen');
    waiting = true;
  } else if (state.isPaused) {
    waiting = true;
  } else {
    fadeOut();
  }
}

setZen(zenEnabled, {instant: true});

if (checkbox) {
  checkbox.addEventListener('change', () => setZen(checkbox.checked));
}

inputManager.onZenToggle = () => setZen(!zenEnabled);
hooks.setZen = (on) => setZen(on);
hooks.isZen = () => zenEnabled;
inputManager.onCenterDoubleTap = () => {
  if (zenEnabled) setZen(false);
};
// Flight starting or resuming from the pause menu
hooks.onResume = () => {
  if (!zenEnabled || !waiting) return;
  waiting = false;
  if (document.body.classList.contains('zen')) showHint();
  else fadeOut();
};
