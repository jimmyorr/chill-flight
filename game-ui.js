import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {
  clearInputState,
  isPauseClickSuppressed,
  togglePause,
} from './game-state.js';
import {
  HEADLIGHT_GLOW_INTENSITY,
  HEADLIGHT_INTENSITY,
  activePlaneType,
  getMaxFlightSpeedMult,
  headlight,
  headlightGlow,
  planeHandling,
} from './airplane.js';
import {hdgtSub, inputManager} from './game-input-bindings.js';
import {
  _currentLookTarget,
  _introCameraPosStart,
  _introLookTargetStart,
  _virtualCameraPos,
  _virtualLookTarget,
} from './game.js';
import {camera, clock, renderer} from './sky.js';
import {scene} from './scene.js';
import {musicEnabled, setMusicEnabled} from './audio.js';
import {initAudioContext, setSfxEnabled} from './sfx.js';
import {state} from './state.js';
import {BASE_FLIGHT_SPEED, updateDOM, updateUrlParams} from './constants.js';
import {hooks} from './hooks.js';
import {Achievements} from './achievements.js';
import {getChunkLoadingProgress} from './terrain-chunks.js';
import {resetAutopilot} from './autopilot.js';
import {isSmokeOn, toggleSmoke} from './particles.js';

/* --- MOBILE ACTION MENU --- */
const menuContainer = document.getElementById('mobile-action-menu');
const menuTrigger = document.getElementById('mobile-menu-trigger');
const pauseTrigger = document.getElementById('mobile-pause-trigger');
const camToggle = document.getElementById('mobile-cam-toggle');
const mapBtn = document.getElementById('mobile-map-btn');

const autoToggle = document.getElementById('mobile-auto-toggle');

export function toggleAutopilot(forceState) {
  if (forceState !== undefined) {
    state.autopilotEnabled = !!forceState;
  } else {
    state.autopilotEnabled = !state.autopilotEnabled;
  }
  if (!state.autopilotEnabled) resetAutopilot();
  const msg = state.autopilotEnabled
    ? 'AUTOPILOT ENABLED'
    : 'AUTOPILOT DISABLED';
  log.info(msg);

  const autoToggle = document.getElementById('mobile-auto-toggle');
  if (autoToggle) {
    if (state.autopilotEnabled) {
      autoToggle.classList.add('active');
    } else {
      autoToggle.classList.remove('active');
    }
  }

  if (state.autopilotEnabled) {
    Achievements.unlock('otto');
  }

  const flightStatusEl = document.getElementById('flight-status');
  if (flightStatusEl) {
    if (state.autopilotEnabled) {
      flightStatusEl.textContent = 'A U T O P I L O T';
      flightStatusEl.style.color = '#e74c3c';
    } else {
      flightStatusEl.textContent = 'C H I L L - F L I G H T';
      flightStatusEl.style.color = ''; // Reset to default CSS color
    }
  }

  const centerMsg =
    document.getElementById('debug-fps') || document.querySelector('.title');
  if (centerMsg) {
    const oldText = centerMsg.textContent;
    centerMsg.textContent = msg;
    setTimeout(() => {
      if (centerMsg.textContent === msg) centerMsg.textContent = oldText;
    }, 2000);
  }

  if (state.autopilotEnabled) {
    updateUrlParams({autopilot: 'true'}, ['auto', 'autoPilot']);
  } else {
    updateUrlParams({}, ['autopilot', 'auto', 'autoPilot']);
  }
}

if (ChillFlightLogic.START_AUTOPILOT && !state.isFreeCamera) {
  toggleAutopilot(true);
}

if (menuTrigger && menuContainer) {
  menuTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // The map's close button sits over this one: don't let the click its tap
    // sends after closing the map open the menu
    if (isPauseClickSuppressed()) return;
    menuContainer.classList.toggle('expanded');
  });
}

if (pauseTrigger) {
  pauseTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    togglePause();
    menuContainer.classList.remove('expanded');
  });
}

if (mapBtn) {
  mapBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuContainer.classList.remove('expanded');
    hooks.fullscreenMap?.open();
  });
}

if (camToggle) {
  camToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    inputManager.onCameraToggle();
  });
}

if (hdgtSub) {
  hdgtSub.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (headlight.intensity === 0) {
      headlight.intensity = HEADLIGHT_INTENSITY;
      headlightGlow.intensity = HEADLIGHT_GLOW_INTENSITY;
      hdgtSub.classList.add('active');

      Achievements.unlock('night_vision');
    } else {
      headlight.intensity = 0;
      headlightGlow.intensity = 0;
      hdgtSub.classList.remove('active');
    }
  });
}

// Airshow smoke: X, or the smoke button in the quick menu
const smokeToggle = document.getElementById('mobile-smoke-toggle');
function syncSmokeUI() {
  if (!smokeToggle) return;
  smokeToggle.classList.toggle('active', isSmokeOn());
  smokeToggle.disabled = !!state.mpForceSmoke;
}
function toggleSmokeTrail() {
  if (state.mpForceSmoke) return;
  toggleSmoke();
  syncSmokeUI();
}
hooks.syncSmokeUI = syncSmokeUI;
inputManager.onSmokeToggle = toggleSmokeTrail;
if (smokeToggle) {
  smokeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSmokeTrail();
  });
}

if (autoToggle) {
  autoToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAutopilot();
  });
}

// --- INPUT SAFETY GUARD ---
export function resetSteering() {
  state.mouseX = 0;
  state.mouseY = 0;
  state.mouseControlActive = false;
  if (inputManager.resetMouseSteering) {
    inputManager.resetMouseSteering();
  }
}

document
  .querySelectorAll(
    '.mobile-btn, #throttle, .sub-btn, #debug-menu, #debug-telemetry, #cockpit-ui, #npc-dialog, #mobile-action-menu, #pause-overlay, #achievements-overlay, #people-overlay, #fullscreen-map-overlay, #minimap-container, button, input, select, a'
  )
  .forEach((btn) => {
    btn.addEventListener('mouseenter', resetSteering);
    btn.addEventListener(
      'touchstart',
      () => {
        resetSteering();
      },
      {passive: true}
    );
  });

document.addEventListener('mouseover', (e) => {
  if (
    e.target.closest(
      '.mobile-btn, #throttle, .sub-btn, #debug-menu, #debug-telemetry, #cockpit-ui, #npc-dialog, #mobile-action-menu, #pause-overlay, #achievements-overlay, #people-overlay, #fullscreen-map-overlay, #minimap-container, button, input, select, a'
    )
  ) {
    resetSteering();
  }
});

/* --- THROTTLE --- */
// Dragging anywhere on the throttle sets the target speed from where the
// finger is; keys, gamepad and the scroll wheel move the knob through
// updateThrottle(), which reads the same target each frame.
const throttleEl = document.getElementById('throttle');
const throttleKts = document.getElementById('throttle-kts');
const throttleBoost = throttleEl?.querySelector('.throttle-boost');

function setThrottleFromPointer(e) {
  const rect = throttleEl.getBoundingClientRect();
  const style = getComputedStyle(throttleEl);
  const knobW = parseFloat(style.getPropertyValue('--knob-w')) || 68;
  const pad = parseFloat(style.getPropertyValue('--pad')) || 6;
  const span = rect.width - knobW - 2 * pad;
  if (span <= 0) return;
  const frac = Math.min(
    1,
    Math.max(0, (e.clientX - rect.left - pad - knobW / 2) / span)
  );
  const target = frac * getMaxFlightSpeedMult();
  // Snap to a stop near rest, like the other throttle inputs
  state.targetFlightSpeed = target < 0.05 ? 0 : target;
}

if (throttleEl) {
  throttleEl.addEventListener('pointerdown', (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    resetSteering();
    throttleEl.setPointerCapture(e.pointerId);
    setThrottleFromPointer(e);
  });
  throttleEl.addEventListener('pointermove', (e) => {
    if (!throttleEl.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    setThrottleFromPointer(e);
  });
  // Keep touches on the throttle from steering the plane
  throttleEl.addEventListener('touchstart', (e) => e.stopPropagation(), {
    passive: true,
  });
  throttleEl.addEventListener('contextmenu', (e) => e.preventDefault());
}

// The knob warns of slow flight: red where the plane falls out of the sky
// (from 5 knots under its stall speed), amber where it sinks (under its level
// speed). Left alone for a while, the throttle fades back.
const THROTTLE_IDLE_MS = 4000;

let lastThrottleTarget = -1;
let lastThrottleMax = -1;
let lastThrottleZone = '';
let throttleActiveAt = 0;
let throttleIdle = false;
let lastThrottleBoost = 1;
let boostChangeTimer = null;

function wakeThrottle(now) {
  throttleActiveAt = now;
  if (throttleIdle) {
    throttleIdle = false;
    throttleEl.classList.remove('idle');
  }
}

if (throttleEl) {
  throttleEl.addEventListener('pointerdown', () =>
    wakeThrottle(performance.now())
  );
}

export function updateThrottle(now) {
  if (!throttleEl) return;
  const max = getMaxFlightSpeedMult();
  const target = state.targetFlightSpeed;
  if (target === lastThrottleTarget && max === lastThrottleMax) {
    if (!throttleIdle && now - throttleActiveAt > THROTTLE_IDLE_MS) {
      throttleIdle = true;
      throttleEl.classList.add('idle');
    }
    return;
  }
  lastThrottleTarget = target;
  lastThrottleMax = max;
  wakeThrottle(now);
  // Tag's speed boost (multiplayer.js): a gold stretch past the usual top
  // speed, which the knob glides into at full throttle
  const boost = state.mpSpeedBoost || 1;
  if (boost !== lastThrottleBoost) {
    lastThrottleBoost = boost;
    throttleEl.classList.toggle('boosted', boost > 1);
    if (boost > 1) {
      throttleBoost?.style.setProperty('--boost-from', (1 / boost).toFixed(4));
    }
    throttleEl.classList.add('boost-change');
    clearTimeout(boostChangeTimer);
    boostChangeTimer = setTimeout(
      () => throttleEl.classList.remove('boost-change'),
      800
    );
  }
  throttleEl.classList.toggle(
    'in-boost',
    boost > 1 && target > max / boost + 1e-6
  );
  const ktsPerMult = BASE_FLIGHT_SPEED * 60;
  const kts = Math.round(target * ktsPerMult);
  const {stallKts, levelKts} = planeHandling();
  throttleEl.style.setProperty('--thr', Math.min(1, target / max).toFixed(4));
  // The buggy can't stall: no stall mark or warning colours for it
  const stalls = activePlaneType !== 'buggy';
  throttleEl.classList.toggle('no-stall', !stalls);
  throttleEl.style.setProperty(
    '--stall',
    (stallKts / (max * ktsPerMult)).toFixed(4)
  );
  throttleEl.setAttribute('aria-valuemax', Math.round(max * ktsPerMult));
  throttleEl.setAttribute('aria-valuenow', kts);
  updateDOM(throttleKts, kts);
  const zone = !stalls
    ? ''
    : kts < stallKts - 5
      ? 'red'
      : kts < levelKts
        ? 'amber'
        : '';
  if (zone !== lastThrottleZone) {
    if (lastThrottleZone) throttleEl.classList.remove(lastThrottleZone);
    if (zone) throttleEl.classList.add(zone);
    lastThrottleZone = zone;
  }
}

window.addEventListener('blur', () => {
  state.windowJustFocused = false;
  clearInputState();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInputState();
  }
});

window.addEventListener('focus', () => {
  state.windowJustFocused = true;

  clock.update(); // This "consumes" the time passed while the tab was hidden
});

// Debug menu speed buttons
const speedBtns = document.querySelectorAll('.speed-btn');
speedBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    speedBtns.forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    state.daySpeedMultiplier = parseFloat(e.target.getAttribute('data-speed'));
    updateUrlParams({timeSpeed: state.daySpeedMultiplier});
  });
});

if (typeof state.daySpeedMultiplier !== 'undefined') {
  speedBtns.forEach((b) => {
    if (parseFloat(b.getAttribute('data-speed')) === state.daySpeedMultiplier) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

// Time of day slider
const timeSlider = document.getElementById('debug-time-slider');
const timeSliderVal = document.getElementById('debug-time-val');
if (timeSlider) {
  if (state.manualTimeOfDay !== undefined) {
    timeSlider.value = state.manualTimeOfDay;
    if (timeSliderVal) {
      const hours = state.manualTimeOfDay * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  }

  timeSlider.addEventListener('input', (e) => {
    state.manualTimeOfDay = parseFloat(e.target.value);

    // Automatically pause time so the user can observe the time they set
    speedBtns.forEach((b) => b.classList.remove('active'));
    const zeroBtn = document.querySelector('.speed-btn[data-speed="0"]');
    if (zeroBtn) zeroBtn.classList.add('active');
    state.daySpeedMultiplier = 0;

    if (timeSliderVal) {
      const hours = state.manualTimeOfDay * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  });

  timeSlider.addEventListener('change', () => {
    updateUrlParams({
      tod: state.manualTimeOfDay.toFixed(4),
      timeSpeed: 0,
    });
  });
}

// --- PAUSE MENU TABS (Flight / Settings) ---
const pauseTabs = document.querySelectorAll('.pause-tab');
const pausePanels = document.querySelectorAll('.pause-panel');
pauseTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    pauseTabs.forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    pausePanels.forEach((panel) =>
      panel.classList.toggle('active', panel.dataset.panel === tab.dataset.tab)
    );
  });
});

// ?ui=0: nothing on screen but the game view (see .ui-hidden in style.css).
if (!ChillFlightLogic.SHOW_UI) document.body.classList.add('ui-hidden');

// --- DISMISS LOADING SCREEN ---
const overlay = document.getElementById('loading-overlay');
if (overlay && renderer) {
  const beginBtn = document.getElementById('begin-btn');
  // Whether START begins with music. The title screen's music toggle changes
  // it; nothing plays or is saved until the game starts.
  let startWithMusic = musicEnabled;
  // Whether the player turned sound off with that toggle (not ?music=0),
  // which silences sound effects too
  let mutedOnTitle = false;

  state.dismissLoadingScreen = (instant = false) => {
    if (renderer && typeof renderer.compile === 'function') {
      renderer.compile(scene, camera);
    }
    if (instant) {
      overlay.style.display = 'none';
    } else {
      overlay.style.transition = 'opacity 1.25s ease-in-out';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      setTimeout(() => (overlay.style.display = 'none'), 1250);

      // Trigger cinematic camera transition
      if (!state.isFreeCamera) {
        state.isIntroTransitionActive = true;
        state.introTransitionStartTime = performance.now();
        _introCameraPosStart.copy(camera.position);
        _introLookTargetStart.copy(_currentLookTarget);
        _virtualCameraPos.copy(camera.position);
        _virtualLookTarget.copy(_currentLookTarget);
      }
    }

    // Unpause the game and clear the clock delta
    state.isPaused = false;
    state.justResumed = true;
    clock.update();
    hooks.onResume?.();

    // Start music (or not, per the title screen's sound toggle)
    setMusicEnabled(startWithMusic);
    if (mutedOnTitle) setSfxEnabled(false);

    // Initialize sound effects audio graph on first user start
    initAudioContext();
  };

  const progressContainer = document.getElementById(
    'splash-progress-container'
  );
  const progressBar = document.getElementById('splash-progress-bar');
  const btnContainer = document.getElementById('splash-btn-container');
  const loadingAttrEl = document.getElementById('loading-music-attribution');

  if (loadingAttrEl) {
    loadingAttrEl.style.display = musicEnabled ? 'block' : 'none';
  }

  const musicToggle = document.getElementById('splash-music-toggle');
  if (musicToggle) {
    musicToggle.addEventListener('click', () => {
      startWithMusic = !startWithMusic;
      mutedOnTitle = !startWithMusic;
      musicToggle.setAttribute('aria-pressed', String(startWithMusic));
      if (loadingAttrEl) {
        loadingAttrEl.classList.toggle('dimmed', !startWithMusic);
      }
    });
  }

  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      state.dismissLoadingScreen(false);
    });
  }

  // Always run the progress bar animation first
  if (progressContainer && progressBar) {
    progressContainer.classList.remove('hidden');
    progressContainer.classList.add('visible');

    const msgEl = document.getElementById('splash-loading-msg');
    const messages = [
      'Generating terrain chunks...',
      'Reticulating splines...',
      'Calculating flight paths...',
      'Have a chill flight.',
    ];

    let messageIndex = 0;
    if (msgEl) msgEl.textContent = messages[messageIndex];

    const loadInterval = setInterval(() => {
      let progress;
      if (getChunkLoadingProgress) {
        progress = getChunkLoadingProgress();
      } else {
        progress = 1.0; // Fallback
      }

      progressBar.style.width = `${progress * 100}%`;

      // Update messages based on progress
      if (msgEl) {
        if (progress > 0.25 && messageIndex === 0) {
          messageIndex = 1;
          msgEl.textContent = messages[messageIndex];
        } else if (progress > 0.5 && messageIndex === 1) {
          messageIndex = 2;
          msgEl.textContent = messages[messageIndex];
        } else if (progress >= 1.0 && messageIndex === 2) {
          messageIndex = 3;
          msgEl.textContent = messages[messageIndex];
        }
      }

      if (progress >= 1.0) {
        clearInterval(loadInterval);

        // Wait a tiny bit so the progress bar visually reaches 100%
        setTimeout(() => {
          if (ChillFlightLogic.START_NOW) {
            // ?start=1: straight into the flight, no intro
            state.dismissLoadingScreen(true);
          } else if (!musicEnabled) {
            // Auto-skip
            log.info('🎵 Music was paused last session. Auto-skipping.');
            state.dismissLoadingScreen(false);
          } else {
            // Start cross-fade: fade out progress, fade in button simultaneously
            const interactiveArea = document.getElementById(
              'splash-interactive-area'
            );
            if (interactiveArea) interactiveArea.classList.add('crossfading');

            progressContainer.classList.remove('visible');
            progressContainer.classList.add('hidden');

            if (btnContainer) {
              btnContainer.classList.remove('hidden');
              btnContainer.classList.add('visible');
              if (beginBtn) {
                // Focus after a short delay to allow transition to start
                setTimeout(() => beginBtn.focus(), 100);
              }
            }
          }
        }, 150);
      }
    }, 50);
  } else {
    // Fallback if elements are missing
    if (!musicEnabled || ChillFlightLogic.START_NOW) {
      state.dismissLoadingScreen(true);
    } else if (btnContainer) {
      btnContainer.style.visibility = 'visible';
      btnContainer.style.opacity = '1';
    }
  }
} else {
  state.dismissLoadingScreen = () => {};
}

// Track play count for "frequent_flyer"
(function () {
  try {
    const playCountKey = 'chill_flight_play_count';
    let count = parseInt(localStorage.getItem(playCountKey) || '0', 10);
    count++;
    localStorage.setItem(playCountKey, count.toString());
    if (count >= 10) {
      Achievements.unlock('frequent_flyer');
    }
  } catch (e) {
    console.error('[Achievements] Failed to track play count', e);
  }
})();

inputManager.onAutopilotToggle = () => toggleAutopilot();
hooks.resetSteering = resetSteering;
