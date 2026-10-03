import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {clearInputState, togglePause} from './game-state.js';
import {
  HEADLIGHT_GLOW_INTENSITY,
  HEADLIGHT_INTENSITY,
  getMaxFlightSpeedMult,
  headlight,
  headlightGlow,
} from './airplane.js';
import {
  STEER_HOLD_THRESHOLD,
  doubleTap,
  hdgtSub,
  inputManager,
  keyPressStartTime,
  keys,
} from './game-input-bindings.js';
import {
  _currentLookTarget,
  _introCameraPosStart,
  _introLookTargetStart,
  _virtualCameraPos,
  _virtualLookTarget,
  btnDown,
  btnUp,
} from './game.js';
import {camera, clock, renderer} from './sky.js';
import {scene} from './scene.js';
import {musicEnabled, setMusicEnabled} from './audio.js';
import {state} from './state.js';
import {updateUrlParams} from './constants.js';
import {hooks} from './hooks.js';
import {Achievements} from './achievements.js';
import {getChunkLoadingProgress} from './terrain-chunks.js';

/* --- MOBILE ACTION MENU --- */
const menuContainer = document.getElementById('mobile-action-menu');
const menuTrigger = document.getElementById('mobile-menu-trigger');
const pauseTrigger = document.getElementById('mobile-pause-trigger');
const camToggle = document.getElementById('mobile-cam-toggle');

const autoToggle = document.getElementById('mobile-auto-toggle');

export function toggleAutopilot(forceState) {
  if (forceState !== undefined) {
    state.autopilotEnabled = !!forceState;
  } else {
    state.autopilotEnabled = !state.autopilotEnabled;
  }
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

if (camToggle) {
  camToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state.cameraMode === 'follow') {
      state.cameraMode = 'first-person';
    } else if (state.cameraMode === 'first-person') {
      state.cameraMode = 'birds-eye-close';
    } else if (state.cameraMode === 'birds-eye-close') {
      state.cameraMode = 'birds-eye-far';
    } else if (state.cameraMode === 'birds-eye-far') {
      state.cameraMode = 'cinematic';
    } else {
      state.cameraMode = 'follow';
      state.cameraTransitionProgress = 0; // Reset progress to avoid bounce
    }

    Achievements.unlock('directors_cut');
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
    '.mobile-btn, .sub-btn, #debug-menu, #debug-telemetry, #cockpit-ui, #mobile-action-menu, #pause-overlay, #achievements-overlay, #fullscreen-map-overlay, #minimap-container, button, input, select, a'
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
      '.mobile-btn, .sub-btn, #debug-menu, #debug-telemetry, #cockpit-ui, #mobile-action-menu, #pause-overlay, #achievements-overlay, #fullscreen-map-overlay, #minimap-container, button, input, select, a'
    )
  ) {
    resetSteering();
  }
});

if (btnUp) {
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    resetSteering();
    keys.Shift = true;
    keys.ArrowUp = true;
    keyPressStartTime.ArrowUp = performance.now();
  };
  const up = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const nowTime = performance.now();
    if (
      keyPressStartTime.ArrowUp > 0 &&
      nowTime - keyPressStartTime.ArrowUp < STEER_HOLD_THRESHOLD
    ) {
      state.targetFlightSpeed += 0.1;
      state.targetFlightSpeed = Math.min(
        getMaxFlightSpeedMult(),
        state.targetFlightSpeed
      );
    }
    keys.Shift = false;
    keys.ArrowUp = false;
    keyPressStartTime.ArrowUp = 0;
    doubleTap.ArrowUp = false;
  };
  btnUp.addEventListener('pointerdown', down);
  btnUp.addEventListener('pointerup', up);
  btnUp.addEventListener('pointercancel', up);
  btnUp.addEventListener('pointerleave', up);
  btnUp.addEventListener('touchstart', down);
  btnUp.addEventListener('touchend', up);
  btnUp.addEventListener('contextmenu', (e) => e.preventDefault());
}
if (btnDown) {
  const down = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    resetSteering();
    keys.Shift = true;
    keys.ArrowDown = true;
    keys.ArrowUp = false;
    keyPressStartTime.ArrowDown = performance.now();
  };
  const up = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const nowTime = performance.now();
    if (
      keyPressStartTime.ArrowDown > 0 &&
      nowTime - keyPressStartTime.ArrowDown < 250
    ) {
      state.targetFlightSpeed = Math.max(0, state.targetFlightSpeed - 0.1);
    }
    keys.Shift = false;
    keys.ArrowDown = false;
    keyPressStartTime.ArrowDown = 0;
    doubleTap.ArrowDown = false;
  };
  btnDown.addEventListener('pointerdown', down);
  btnDown.addEventListener('pointerup', up);
  btnDown.addEventListener('pointercancel', up);
  btnDown.addEventListener('pointerleave', up);
  btnDown.addEventListener('touchstart', down);
  btnDown.addEventListener('touchend', up);
  btnDown.addEventListener('contextmenu', (e) => e.preventDefault());
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

// ?ui=0: nothing on screen but the game view (see .ui-hidden in style.css).
if (!ChillFlightLogic.SHOW_UI) document.body.classList.add('ui-hidden');

// --- DISMISS LOADING SCREEN ---
const overlay = document.getElementById('loading-overlay');
if (overlay) {
  const beginBtn = document.getElementById('begin-btn');
  // Whether START begins with music. The title screen's music toggle changes
  // it; nothing plays or is saved until the game starts.
  let startWithMusic = musicEnabled;

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

    // Start music (or not, per the title screen's music toggle)
    setMusicEnabled(startWithMusic);
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
}

export function showStartPlaneTooltip() {
  if (
    state.startPlaneTooltipShown ||
    !ChillFlightLogic.SHOW_TIPS ||
    document.body.classList.contains('zen')
  ) {
    return;
  }
  state.startPlaneTooltipShown = true;
  localStorage.setItem('chill_flight_stopped_tooltip_shown', 'true');

  const tooltip = document.getElementById('start-plane-tooltip');
  const dismissBtn = document.getElementById('start-plane-dismiss-btn');
  const spdUpBtn = document.getElementById('mobile-spd-up');

  if (!tooltip || !spdUpBtn) return;

  // Show onboarding tooltip and apply pulsating glow to + trigger
  tooltip.classList.remove('hidden');
  tooltip.classList.add('visible');
  spdUpBtn.classList.add('onboarding-glow');

  const dismissStartPlaneTooltip = () => {
    tooltip.classList.remove('visible');
    tooltip.classList.add('hidden');
    spdUpBtn.classList.remove('onboarding-glow');

    // Clean up listeners
    if (dismissBtn) {
      dismissBtn.removeEventListener('click', handleDismiss);
    }
    spdUpBtn.removeEventListener('pointerdown', handleSpdUpInteraction);
    spdUpBtn.removeEventListener('touchstart', handleSpdUpInteraction);
    window.removeEventListener('keydown', handleKeyInteraction);
  };

  state.dismissStartPlaneTooltipFunc = dismissStartPlaneTooltip;

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissStartPlaneTooltip();
    state.dismissStartPlaneTooltipFunc = null;
  };

  const handleSpdUpInteraction = () => {
    dismissStartPlaneTooltip();
    state.dismissStartPlaneTooltipFunc = null;
  };

  const handleKeyInteraction = (e) => {
    const key = e.key.toLowerCase();
    // Dismiss on any keyboard interaction that increases speed
    if (
      e.key === '+' ||
      e.key === '=' ||
      e.key === 'Shift' ||
      key === 'arrowup' ||
      key === 'w'
    ) {
      dismissStartPlaneTooltip();
      state.dismissStartPlaneTooltipFunc = null;
    }
  };

  if (dismissBtn) {
    dismissBtn.addEventListener('click', handleDismiss);
  }
  spdUpBtn.addEventListener('pointerdown', handleSpdUpInteraction);
  spdUpBtn.addEventListener('touchstart', handleSpdUpInteraction);
  window.addEventListener('keydown', handleKeyInteraction);
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
