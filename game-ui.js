/* --- MOBILE ACTION MENU --- */
const menuContainer = document.getElementById('mobile-action-menu');
const menuTrigger = document.getElementById('mobile-menu-trigger');
const pauseTrigger = document.getElementById('mobile-pause-trigger');
const camToggle = document.getElementById('mobile-cam-toggle');

const hdgtSub = document.getElementById('mobile-hdgt-sub');
const autoToggle = document.getElementById('mobile-auto-toggle');

function toggleAutopilot(forceState) {
  if (forceState !== undefined) {
    window.autopilotEnabled = !!forceState;
  } else {
    window.autopilotEnabled = !window.autopilotEnabled;
  }
  const msg = window.autopilotEnabled
    ? 'AUTOPILOT ENABLED'
    : 'AUTOPILOT DISABLED';
  console.log(msg);

  const autoToggle = document.getElementById('mobile-auto-toggle');
  if (autoToggle) {
    if (window.autopilotEnabled) {
      autoToggle.classList.add('active');
    } else {
      autoToggle.classList.remove('active');
    }
  }

  if (window.autopilotEnabled && typeof Achievements !== 'undefined') {
    Achievements.unlock('otto');
  }

  const flightStatusEl = document.getElementById('flight-status');
  if (flightStatusEl) {
    if (window.autopilotEnabled) {
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

  if (typeof updateUrlParams === 'function') {
    if (window.autopilotEnabled) {
      updateUrlParams({autopilot: 'true'}, ['auto', 'autoPilot']);
    } else {
      updateUrlParams({}, ['autopilot', 'auto', 'autoPilot']);
    }
  }
}
window.toggleAutopilot = toggleAutopilot;

if (
  typeof ChillFlightLogic !== 'undefined' &&
  ChillFlightLogic.START_AUTOPILOT &&
  !isFreeCamera
) {
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
    if (cameraMode === 'follow') {
      cameraMode = 'first-person';
    } else if (cameraMode === 'first-person') {
      cameraMode = 'birds-eye-close';
    } else if (cameraMode === 'birds-eye-close') {
      cameraMode = 'birds-eye-far';
    } else if (cameraMode === 'birds-eye-far') {
      cameraMode = 'cinematic';
    } else {
      cameraMode = 'follow';
      cameraTransitionProgress = 0; // Reset progress to avoid bounce
    }
    if (typeof Achievements !== 'undefined') {
      Achievements.unlock('directors_cut');
    }
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
      if (typeof Achievements !== 'undefined') {
        Achievements.unlock('night_vision');
      }
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
function resetSteering() {
  mouseX = 0;
  mouseY = 0;
  mouseControlActive = false;
  if (typeof inputManager !== 'undefined' && inputManager.resetMouseSteering) {
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
      targetFlightSpeed += 0.1;
      targetFlightSpeed = Math.min(
        typeof window.getMaxFlightSpeedMult === 'function'
          ? window.getMaxFlightSpeedMult()
          : 3.3333333333333335,
        targetFlightSpeed
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
      targetFlightSpeed = Math.max(0, targetFlightSpeed - 0.1);
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
  windowJustFocused = false;
  clearInputState();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInputState();
  }
});

window.addEventListener('focus', () => {
  windowJustFocused = true;
  if (typeof clock !== 'undefined') {
    clock.update(); // This "consumes" the time passed while the tab was hidden
  }
});

// Debug menu speed buttons
const speedBtns = document.querySelectorAll('.speed-btn');
speedBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    speedBtns.forEach((b) => b.classList.remove('active'));
    e.target.classList.add('active');
    daySpeedMultiplier = parseFloat(e.target.getAttribute('data-speed'));
    updateUrlParams({timeSpeed: daySpeedMultiplier});
  });
});

if (typeof daySpeedMultiplier !== 'undefined') {
  speedBtns.forEach((b) => {
    if (parseFloat(b.getAttribute('data-speed')) === daySpeedMultiplier) {
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
  if (window.manualTimeOfDay !== undefined) {
    timeSlider.value = window.manualTimeOfDay;
    if (timeSliderVal) {
      const hours = window.manualTimeOfDay * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  }

  timeSlider.addEventListener('input', (e) => {
    window.manualTimeOfDay = parseFloat(e.target.value);

    // Automatically pause time so the user can observe the time they set
    speedBtns.forEach((b) => b.classList.remove('active'));
    const zeroBtn = document.querySelector('.speed-btn[data-speed="0"]');
    if (zeroBtn) zeroBtn.classList.add('active');
    daySpeedMultiplier = 0;

    if (timeSliderVal) {
      const hours = window.manualTimeOfDay * 24;
      const hh = Math.floor(hours).toString().padStart(2, '0');
      const mm = Math.floor((hours % 1) * 60)
        .toString()
        .padStart(2, '0');
      timeSliderVal.textContent = `${hh}:${mm}`;
    }
  });

  timeSlider.addEventListener('change', () => {
    updateUrlParams({
      tod: window.manualTimeOfDay.toFixed(4),
      timeSpeed: 0,
    });
  });
}

// --- DISMISS LOADING SCREEN ---
const overlay = document.getElementById('loading-overlay');
if (overlay) {
  const beginBtn = document.getElementById('begin-btn');

  dismissLoadingScreen = (instant = false) => {
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
      if (!isFreeCamera) {
        isIntroTransitionActive = true;
        introTransitionStartTime = performance.now();
        _introCameraPosStart.copy(camera.position);
        _introLookTargetStart.copy(_currentLookTarget);
        _virtualCameraPos.copy(camera.position);
        _virtualLookTarget.copy(_currentLookTarget);
      }
    }

    // Unpause the game and clear the clock delta
    isPaused = false;
    justResumed = true;
    if (typeof clock !== 'undefined') clock.update();

    // Start music! (Will respect the musicEnabled state)
    if (typeof setMusicEnabled === 'function') {
      setMusicEnabled(musicEnabled);
    }

    // Initialize onboarding
    initOnboarding(instant ? 0 : 4000);
  };

  const initOnboarding = (delay = 4000) => {
    // If the user has already been onboarded, do nothing
    if (localStorage.getItem('chill_flight_onboarded') === 'true') {
      return;
    }

    setTimeout(() => {
      const tooltip = document.getElementById('onboarding-tooltip');
      const dismissBtn = document.getElementById('onboarding-dismiss-btn');
      const menuTrigger = document.getElementById('mobile-menu-trigger');

      if (!tooltip || !menuTrigger) return;

      // Show onboarding tooltip and apply pulsating glow to caret trigger
      tooltip.classList.remove('hidden');
      tooltip.classList.add('visible');
      menuTrigger.classList.add('onboarding-glow');

      const dismissOnboarding = () => {
        // Save onboarding status
        localStorage.setItem('chill_flight_onboarded', 'true');

        // Fade out onboarding elements
        tooltip.classList.remove('visible');
        tooltip.classList.add('hidden');
        menuTrigger.classList.remove('onboarding-glow');

        // Clean up listeners
        if (dismissBtn) {
          dismissBtn.removeEventListener('click', handleDismiss);
        }
        menuTrigger.removeEventListener('click', handleTriggerClick);
      };

      const handleDismiss = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dismissOnboarding();
      };

      const handleTriggerClick = () => {
        // Direct interaction with caret dismisses onboarding immediately
        dismissOnboarding();
      };

      if (dismissBtn) {
        dismissBtn.addEventListener('click', handleDismiss);
      }
      menuTrigger.addEventListener('click', handleTriggerClick);
    }, delay);
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

  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      dismissLoadingScreen(false);
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
      if (window.getChunkLoadingProgress) {
        progress = window.getChunkLoadingProgress();
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
          if (typeof musicEnabled !== 'undefined' && !musicEnabled) {
            // Auto-skip
            console.log('🎵 Music was paused last session. Auto-skipping.');
            dismissLoadingScreen(false);
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
    if (typeof musicEnabled !== 'undefined' && !musicEnabled) {
      dismissLoadingScreen(true);
    } else if (btnContainer) {
      btnContainer.style.visibility = 'visible';
      btnContainer.style.opacity = '1';
    }
  }
}

function showStartPlaneTooltip() {
  if (startPlaneTooltipShown) return;
  startPlaneTooltipShown = true;
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

  dismissStartPlaneTooltipFunc = dismissStartPlaneTooltip;

  const handleDismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissStartPlaneTooltip();
    dismissStartPlaneTooltipFunc = null;
  };

  const handleSpdUpInteraction = () => {
    dismissStartPlaneTooltip();
    dismissStartPlaneTooltipFunc = null;
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
      dismissStartPlaneTooltipFunc = null;
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
    if (count >= 10 && typeof Achievements !== 'undefined') {
      Achievements.unlock('frequent_flyer');
    }
  } catch (e) {
    console.error('[Achievements] Failed to track play count', e);
  }
})();
