// --- ZEN ---
// Hides the HUD and buttons for an unobstructed view (the `zen` class on the
// body; see style.css). Toggled by the Zen checkbox in the pause menu or Z,
// and turned off by double-tapping the center of the screen. Saved between
// visits. The first time it's on during flight, a tip explains how to get the
// controls back.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {inputManager} from './game-input-bindings.js';
import {hooks} from './hooks.js';
import {state} from './state.js';

const STORAGE_KEY = 'chill_flight_zen';
const TIP_SHOWN_KEY = 'chill_flight_zen_tooltip_shown';

const checkbox = document.getElementById('zen-toggle-input');
const tooltip = document.getElementById('zen-tooltip');
const tooltipText = document.getElementById('zen-tooltip-text');
const dismissBtn = document.getElementById('zen-dismiss-btn');

let zenEnabled = localStorage.getItem(STORAGE_KEY) === 'true';

function hideTip() {
  if (!tooltip) return;
  tooltip.classList.remove('visible');
  tooltip.classList.add('hidden');
}

// Shown once, the first time zen is on while flying.
function maybeShowTip() {
  if (
    !tooltip ||
    !zenEnabled ||
    state.isPaused ||
    !ChillFlightLogic.SHOW_TIPS ||
    localStorage.getItem(TIP_SHOWN_KEY) === 'true'
  ) {
    return;
  }
  localStorage.setItem(TIP_SHOWN_KEY, 'true');
  const isTouch = window.matchMedia('(any-pointer: coarse)').matches;
  if (tooltipText) {
    tooltipText.textContent = isTouch
      ? 'Double-tap the center of the screen to show the controls again.'
      : 'Press Z to show the controls again, or Esc for the menu.';
  }
  tooltip.classList.remove('hidden');
  tooltip.classList.add('visible');
}

function setZen(enabled) {
  zenEnabled = enabled;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  document.body.classList.toggle('zen', enabled);
  if (checkbox) checkbox.checked = enabled;
  if (enabled) maybeShowTip();
  else hideTip();
}

setZen(zenEnabled);

if (checkbox) {
  checkbox.addEventListener('change', () => setZen(checkbox.checked));
}
if (dismissBtn) {
  dismissBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideTip();
  });
}

inputManager.onZenToggle = () => setZen(!zenEnabled);
inputManager.onCenterDoubleTap = () => {
  if (zenEnabled) setZen(false);
};
// Turned on from the pause menu: the tip waits until flight resumes.
hooks.onResume = maybeShowTip;
