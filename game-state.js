// --- GAME STATE & PAUSE LOGIC ---
var isPaused = true;
var justResumed = false; // one-frame guard to suppress any input that bled through from the pause menu

function clearInputState() {
  if (typeof mouseX !== 'undefined') mouseX = 0;
  if (typeof mouseY !== 'undefined') mouseY = 0;
  if (typeof mouseControlActive !== 'undefined') mouseControlActive = false;
  if (typeof inputManager !== 'undefined') {
    inputManager.handleBlur();
  }
  if (typeof gyroBasePitch !== 'undefined') {
    gyroBasePitch = null;
    gyroBaseRoll = null;
  }
  const _joystickBase = document.getElementById('virtual-joystick-base');
  if (_joystickBase) {
    _joystickBase.classList.remove('joystick-visible');
    _joystickBase.classList.add('joystick-hidden');
  }
  const _joystickStick = document.getElementById('virtual-joystick-stick');
  if (_joystickStick) {
    _joystickStick.style.transform = 'translate(-50%, -50%)';
  }
}

var pauseOverlay = document.getElementById('pause-overlay');

function togglePause() {
  isPaused = !isPaused;
  if (isPaused) {
    if (pauseOverlay) pauseOverlay.style.display = 'flex';
    clearInputState();

    if (typeof setMusicVolume === 'function') {
      setMusicVolume(0.15);
    }

    if (typeof updatePauseMenuMusicInfo === 'function')
      updatePauseMenuMusicInfo();

    if (
      typeof checkVRPresenting === 'function' &&
      checkVRPresenting() &&
      typeof openVRPauseMenu === 'function'
    ) {
      openVRPauseMenu();
    }
  } else {
    if (pauseOverlay) pauseOverlay.style.display = 'none';
    if (typeof closeVRPauseMenu === 'function') {
      closeVRPauseMenu();
    }
    // Also close achievements overlay if it was open
    const _achOverlay = document.getElementById('achievements-overlay');
    if (_achOverlay) _achOverlay.style.display = 'none';
    if (
      typeof window !== 'undefined' &&
      window.FullscreenMap &&
      window.FullscreenMap.isOpen()
    ) {
      window.FullscreenMap.close();
    }

    if (typeof setMusicVolume === 'function') {
      setMusicVolume(1.0);
    }

    if (typeof clock !== 'undefined' && clock.update) clock.update(); // clear accumulated time so plane doesn't skip
    clearInputState(); // wipe any input that bled through from the pause overlay
    justResumed = true; // suppress the first animate frame's input application
  }
}

window.addEventListener(
  'wheel',
  (e) => {
    if (isPaused || (typeof isFreeCamera !== 'undefined' && isFreeCamera))
      return;

    // Use e.deltaY to scale the throttle change.
    // This handles both fast trackpad scrolls (many small deltas)
    // and standard mouse wheels (few large deltas, e.g. 100 per notch).
    // e.deltaY > 0 -> scrolling down -> throttle down
    // e.deltaY < 0 -> scrolling up -> throttle up
    const throttleDelta = -e.deltaY * 0.005;

    if (typeof applyThrottleDelta === 'function') {
      applyThrottleDelta(throttleDelta);
    }
  },
  {passive: true}
);

var resumeBtn = document.getElementById('resume-btn');
if (resumeBtn) {
  resumeBtn.addEventListener('click', () => {
    togglePause();
  });
}

var suppressPauseClickUntil = 0;
function suppressPauseClick(durationMs = 500) {
  suppressPauseClickUntil = Date.now() + durationMs;
}
window.suppressPauseClick = suppressPauseClick;

if (pauseOverlay) {
  pauseOverlay.addEventListener('click', (e) => {
    if (Date.now() < suppressPauseClickUntil) return;
    if (e.target === pauseOverlay) {
      togglePause();
    }
  });
}

var cockpitUI = document.getElementById('cockpit-ui');
if (cockpitUI) {
  cockpitUI.addEventListener('click', () => {
    togglePause();
  });
}
