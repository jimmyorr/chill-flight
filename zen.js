// --- ZEN ---
// Hides the HUD and buttons for an unobstructed view (the `zen` class on the
// body; see style.css), and the other planes (traffic.js). Toggled by the Zen
// checkbox in the pause menu or Z, and turned off by double-tapping the center
// of the screen. Saved between visits.
import {inputManager} from './game-input-bindings.js';
import {setTrafficEnabled} from './traffic.js';

const STORAGE_KEY = 'chill_flight_zen';

const checkbox = document.getElementById('zen-toggle-input');

let zenEnabled = localStorage.getItem(STORAGE_KEY) === 'true';

function setZen(enabled) {
  zenEnabled = enabled;
  localStorage.setItem(STORAGE_KEY, String(enabled));
  document.body.classList.toggle('zen', enabled);
  setTrafficEnabled(!enabled);
  if (checkbox) checkbox.checked = enabled;
}

setZen(zenEnabled);

if (checkbox) {
  checkbox.addEventListener('change', () => setZen(checkbox.checked));
}

inputManager.onZenToggle = () => setZen(!zenEnabled);
inputManager.onCenterDoubleTap = () => {
  if (zenEnabled) setZen(false);
};
