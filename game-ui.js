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
  planeGroup,
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
import {camera, clock, dirLight, renderer} from './sky.js';
import {
  trackAboutClick,
  trackAppStoreClick,
  trackFlightStart,
} from './analytics.js';
import {scene} from './scene.js';
import {renderFrame} from './outline-pass.js';
import {
  MUSIC_PAUSED_VOLUME,
  musicEnabled,
  setMusicEnabled,
  setMusicVolume,
} from './audio.js';
import {
  initAudioContext,
  prebakeSfxBuffers,
  setSfxEnabled,
  sfxEnabled,
} from './sfx.js';
import {updatePauseMenuMusicInfo} from './game-audio-integration.js';
import {state} from './state.js';
import {
  BASE_FLIGHT_SPEED,
  displaySpeed,
  speedUnit,
  updateDOM,
  updateUrlParams,
} from './constants.js';
import {hooks} from './hooks.js';
import {Achievements} from './achievements.js';
import {getChunkLoadingProgress} from './terrain-chunks.js';
import {performanceMonitor} from './game-performance.js';
import {resetAutopilot} from './autopilot.js';
import {isSmokeOn, toggleSmoke} from './particles.js';
import {t} from './i18n.js';
import {refreshThemeChrome} from './ui-theme.js';
import {selectionHaptic, uiImpactHaptic} from './haptics.js';

/* --- MOBILE ACTION MENU --- */
const menuContainer = document.getElementById('mobile-action-menu');
const subMenu = document.getElementById('mobile-sub-menu');
const menuTrigger = document.getElementById('mobile-menu-trigger');
const pauseTrigger = document.getElementById('mobile-pause-trigger');
const camToggle = document.getElementById('mobile-cam-toggle');
const mapBtn = document.getElementById('mobile-map-btn');
const pauseMapBtn = document.getElementById('pause-map-btn');

const autoToggle = document.getElementById('mobile-auto-toggle');

function setQuickMenuExpanded(expanded, {haptic = false} = {}) {
  if (!menuContainer) return false;
  const wasExpanded = menuContainer.classList.contains('expanded');
  if (wasExpanded === expanded) return false;
  menuContainer.classList.toggle('expanded', expanded);
  menuTrigger?.setAttribute('aria-expanded', String(expanded));
  if (subMenu) subMenu.inert = !expanded;
  if (haptic) uiImpactHaptic('LIGHT');
  return true;
}

export function isQuickMenuExpanded() {
  return Boolean(menuContainer?.classList.contains('expanded'));
}

export function collapseQuickMenu({restoreFocus = false} = {}) {
  const changed = setQuickMenuExpanded(false, {haptic: true});
  if (changed && restoreFocus) menuTrigger?.focus();
  return changed;
}

export function toggleAutopilot(forceState) {
  const want =
    forceState !== undefined ? !!forceState : !state.autopilotEnabled;
  // Not during tag or a race: it's too easy to turn on by accident there
  // (multiplayer.js turns it off when one starts)
  if (want && hooks.inGameMode?.()) return;
  state.autopilotEnabled = want;
  if (!state.autopilotEnabled) resetAutopilot();
  const msg = state.autopilotEnabled
    ? 'AUTOPILOT ENABLED'
    : 'AUTOPILOT DISABLED';
  log.info(msg);

  const autoToggle = document.getElementById('mobile-auto-toggle');
  if (autoToggle) {
    autoToggle.classList.toggle('active', state.autopilotEnabled);
    autoToggle.setAttribute('aria-pressed', String(state.autopilotEnabled));
  }

  if (state.autopilotEnabled) {
    Achievements.unlock('otto');
  }

  const flightStatusEl = document.getElementById('flight-status');
  if (flightStatusEl) {
    if (state.autopilotEnabled) {
      flightStatusEl.textContent = t('Autopilot');
    } else {
      flightStatusEl.textContent = 'Chill-Flight';
    }
    flightStatusEl.style.color = '';
    // Phones on their side show the line only for AUTOPILOT (style.css)
    flightStatusEl.parentElement?.classList.toggle(
      'autopilot',
      state.autopilotEnabled
    );
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
    setQuickMenuExpanded(!menuContainer.classList.contains('expanded'), {
      haptic: true,
    });
  });
  document.addEventListener('pointerdown', (e) => {
    if (
      menuContainer.classList.contains('expanded') &&
      !menuContainer.contains(e.target)
    ) {
      setQuickMenuExpanded(false, {haptic: true});
    }
  });
}

if (pauseTrigger) {
  pauseTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickMenuExpanded(false);
    togglePause();
  });
}

if (mapBtn) {
  mapBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickMenuExpanded(false);
    hooks.fullscreenMap?.open();
  });
}

if (pauseMapBtn) {
  pauseMapBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
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
      hdgtSub.setAttribute('aria-pressed', 'true');

      Achievements.unlock('night_vision');
    } else {
      headlight.intensity = 0;
      headlightGlow.intensity = 0;
      hdgtSub.classList.remove('active');
      hdgtSub.setAttribute('aria-pressed', 'false');
    }
  });
}

// Airshow smoke: X, or the smoke button in the quick menu
const smokeToggle = document.getElementById('mobile-smoke-toggle');
function syncSmokeUI() {
  if (!smokeToggle) return;
  const on = isSmokeOn();
  smokeToggle.classList.toggle('active', on);
  smokeToggle.setAttribute('aria-pressed', String(on));
  smokeToggle.disabled = !!state.mpForceSmoke;
}
function toggleSmokeTrail() {
  if (state.mpForceSmoke) return;
  if (toggleSmoke()) Achievements.unlock('smoke_show');
  syncSmokeUI();
}
hooks.syncSmokeUI = syncSmokeUI;
hooks.toggleAutopilot = toggleAutopilot;
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
    '.mobile-btn, #throttle, .sub-btn, #debug-menu, #cockpit-ui, #npc-dialog, #mobile-action-menu, #pause-overlay, #achievements-overlay, #people-overlay, #help-overlay, #language-overlay, #fullscreen-map-overlay, #minimap-container, button, input, select, a'
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
      '.mobile-btn, #throttle, .sub-btn, #debug-menu, #cockpit-ui, #npc-dialog, #mobile-action-menu, #pause-overlay, #achievements-overlay, #people-overlay, #help-overlay, #language-overlay, #fullscreen-map-overlay, #minimap-container, button, input, select, a'
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
const throttleUnit = document.getElementById('throttle-unit');
const throttleBoost = throttleEl?.querySelector('.throttle-boost');

function setThrottleFromPointer(e) {
  const rect = throttleEl.getBoundingClientRect();
  const style = getComputedStyle(throttleEl);
  const knobW = parseFloat(style.getPropertyValue('--knob-w')) || 66;
  const pad = parseFloat(style.getPropertyValue('--pad')) || 5;
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

let throttleDragPointerId = null;
let lastDetentBucket = null;
let lastDetentBelowStall = null;
let lastDetentInBoost = null;
let lastDetentAt = -Infinity;

function readThrottleDetent() {
  const target = state.targetFlightSpeed;
  const max = getMaxFlightSpeedMult();
  const ktsPerMult = BASE_FLIGHT_SPEED * 60;
  const kts = Math.round(target * ktsPerMult);
  const bucket = target === 0 ? -1 : Math.floor(kts / 10);
  const stalls = activePlaneType !== 'buggy';
  const {stallKts} = planeHandling();
  const belowStall = Boolean(
    stalls && stallKts !== undefined && kts < stallKts
  );
  const boost = state.mpSpeedBoost || 1;
  const inBoost = Boolean(boost > 1 && target > max / boost + 1e-6);
  return {bucket, belowStall, inBoost};
}

if (throttleEl) {
  const endThrottleDrag = (e) => {
    if (throttleDragPointerId !== e.pointerId) return;
    throttleDragPointerId = null;
    selectionHaptic('end');
  };
  throttleEl.addEventListener('pointerdown', (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    resetSteering();
    throttleDragPointerId = e.pointerId;
    try {
      throttleEl.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events may not have an active browser pointer id.
    }
    const prev = readThrottleDetent();
    selectionHaptic('start');
    setThrottleFromPointer(e);
    const next = readThrottleDetent();
    lastDetentBucket = next.bucket;
    lastDetentBelowStall = next.belowStall;
    lastDetentInBoost = next.inBoost;
    if (
      next.bucket !== prev.bucket ||
      next.belowStall !== prev.belowStall ||
      next.inBoost !== prev.inBoost
    ) {
      lastDetentAt = performance.now();
      selectionHaptic('changed');
    }
  });
  throttleEl.addEventListener('pointermove', (e) => {
    if (
      !throttleEl.hasPointerCapture(e.pointerId) &&
      throttleDragPointerId !== e.pointerId
    ) {
      return;
    }
    e.stopPropagation();
    setThrottleFromPointer(e);
    const next = readThrottleDetent();
    if (
      next.bucket !== lastDetentBucket ||
      next.belowStall !== lastDetentBelowStall ||
      next.inBoost !== lastDetentInBoost
    ) {
      lastDetentBucket = next.bucket;
      lastDetentBelowStall = next.belowStall;
      lastDetentInBoost = next.inBoost;
      const now = performance.now();
      if (now - lastDetentAt >= 20) {
        lastDetentAt = now;
        selectionHaptic('changed');
      }
    }
  });
  throttleEl.addEventListener('pointerup', endThrottleDrag);
  throttleEl.addEventListener('pointercancel', endThrottleDrag);
  throttleEl.addEventListener('lostpointercapture', endThrottleDrag);
  throttleEl.addEventListener('keydown', (e) => {
    const max = getMaxFlightSpeedMult();
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = Math.min(max, state.targetFlightSpeed + max * 0.05);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = Math.max(0, state.targetFlightSpeed - max * 0.05);
    } else if (e.key === 'PageUp') {
      next = Math.min(max, state.targetFlightSpeed + max * 0.2);
    } else if (e.key === 'PageDown') {
      next = Math.max(0, state.targetFlightSpeed - max * 0.2);
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = max;
    }
    if (next !== null) {
      e.preventDefault();
      e.stopPropagation();
      state.targetFlightSpeed = next < 0.03 ? 0 : next;
      updateThrottle(performance.now());
    }
  });
  // Keep touches on the throttle from steering the plane
  throttleEl.addEventListener('touchstart', (e) => e.stopPropagation(), {
    passive: true,
  });
  throttleEl.addEventListener('contextmenu', (e) => e.preventDefault());
}

// The knob warns of slow flight: red where the plane falls out of the sky
// (from 5 knots under its stall speed), amber where it sinks (under its level
// speed). Left alone for a while, the throttle fades back (unless it's at
// zero).
const THROTTLE_IDLE_MS = 4000;

let lastThrottleTarget = -1;
let lastThrottleMax = -1;
let lastThrottlePlane = '';
let lastThrottleZone = '';
let throttleActiveAt = 0;
let throttleIdle = false;
let lastThrottleBoost = 1;
let boostChangeTimer = null;

function wakeThrottle(now) {
  throttleActiveAt = now;
  if (throttleIdle) {
    throttleIdle = false;
    throttleEl?.classList.remove('idle');
    menuTrigger?.classList.remove('idle');
  }
}

for (const el of [throttleEl, menuContainer]) {
  if (!el) continue;
  for (const evt of ['pointerdown', 'mouseenter', 'focusin']) {
    el.addEventListener(evt, () => wakeThrottle(performance.now()));
  }
}

export function updateThrottle(now) {
  if (!throttleEl) return;
  const max = getMaxFlightSpeedMult();
  const target = state.targetFlightSpeed;
  const menuExpanded = menuContainer?.classList.contains('expanded');
  if (menuExpanded && throttleIdle) {
    wakeThrottle(now);
  }
  if (
    target === lastThrottleTarget &&
    max === lastThrottleMax &&
    activePlaneType === lastThrottlePlane
  ) {
    // Never while stopped, in slow/stall warning, or with the quick menu open
    if (
      !throttleIdle &&
      target > 0 &&
      lastThrottleZone === '' &&
      !menuExpanded &&
      now - throttleActiveAt > THROTTLE_IDLE_MS
    ) {
      throttleIdle = true;
      throttleEl.classList.add('idle');
      menuTrigger?.classList.add('idle');
    }
    return;
  }
  lastThrottleTarget = target;
  lastThrottleMax = max;
  lastThrottlePlane = activePlaneType;
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
  const shownSpeed = displaySpeed(target * ktsPerMult, activePlaneType);
  const maxShownSpeed = displaySpeed(max * ktsPerMult, activePlaneType);
  const {stallKts, levelKts} = planeHandling();
  throttleEl.style.setProperty('--thr', Math.min(1, target / max).toFixed(4));
  // The buggy can't stall: no stall mark or warning colours for it
  const stalls = activePlaneType !== 'buggy';
  throttleEl.classList.toggle('no-stall', !stalls);
  throttleEl.style.setProperty(
    '--stall',
    (stallKts / (max * ktsPerMult)).toFixed(4)
  );
  const unit = speedUnit(activePlaneType);
  throttleEl.setAttribute('aria-valuemax', maxShownSpeed);
  throttleEl.setAttribute('aria-valuenow', shownSpeed);
  throttleEl.setAttribute('aria-valuetext', `${shownSpeed} ${unit}`);
  updateDOM(throttleKts, shownSpeed);
  updateDOM(throttleUnit, unit);
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

// --- PAUSE MENU TABS (Flight / Settings / Together) ---
const pauseTabs = document.querySelectorAll('.pause-tab');
const pausePanels = document.querySelectorAll('.pause-panel');
pausePanels.forEach((panel) => {
  panel.inert = !panel.classList.contains('active');
});
pauseTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    pauseTabs.forEach((t) => {
      const active = t === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
    });
    pausePanels.forEach((panel) => {
      const active = panel.dataset.panel === tab.dataset.tab;
      panel.classList.toggle('active', active);
      panel.inert = !active;
    });
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
    const reducedMotion = Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
    if (instant) {
      overlay.style.display = 'none';
      refreshThemeChrome();
    } else if (reducedMotion) {
      overlay.style.transition = 'opacity 0.15s ease';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      refreshThemeChrome();
      setTimeout(() => {
        overlay.style.display = 'none';
        refreshThemeChrome();
      }, 160);
    } else {
      overlay.style.transition = 'opacity 1.25s ease-in-out';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      refreshThemeChrome();
      setTimeout(() => {
        overlay.style.display = 'none';
        refreshThemeChrome();
      }, 1250);

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

    // Initialize sound effects audio graph (defers until first gesture if blocked)
    if (sfxEnabled) initAudioContext();

    // Telemetry: track flight start and transition active screen to flight
    trackFlightStart({start_with_music: startWithMusic});
  };

  const progressContainer = document.getElementById(
    'splash-progress-container'
  );
  const progressBar = document.getElementById('splash-progress-bar');
  const loadingAttrEl = document.getElementById('loading-music-attribution');

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
      if (state.vrOnlyFlow) {
        hooks.enterVR?.();
        return;
      }
      state.dismissLoadingScreen(false);
    });
  }

  const splashSettingsBtn = document.getElementById('splash-settings-btn');
  if (splashSettingsBtn) {
    splashSettingsBtn.addEventListener('click', () => {
      overlay.style.display = 'none';
      state.isPaused = true;
      setMusicEnabled(startWithMusic);
      if (mutedOnTitle) setSfxEnabled(false);
      setMusicVolume(MUSIC_PAUSED_VOLUME);
      if (sfxEnabled) initAudioContext();
      updatePauseMenuMusicInfo();
      const pauseOverlayEl = document.getElementById('pause-overlay');
      if (pauseOverlayEl) pauseOverlayEl.style.display = 'flex';
    });
  }

  // The loading screen's last step, so the switch to flying doesn't hitch:
  // - compiles every shader in the scene. three.js otherwise compiles one
  //   the first time something drawn with it is on screen, and START used to
  //   compile ~30 at once (props out of the intro camera's view, hidden
  //   effects). getUniforms() waits for each to finish linking, a step
  //   compileAsync doesn't wait for on browsers without parallel compiling
  // - lets the frame rate monitor start fresh, at full resolution
  // - generates the sound effects' noise loops
  // - starts drawing the map around the plane (minimap.js)
  // Compiles every shader in the scene, then waits for each to link. It
  // runs first once some terrain is in (most materials appear with the first
  // chunks), overlapping the rest of the terrain loading, then again at the
  // end for anything new. No frames meanwhile: the screen is covered, and
  // drawing them would only compete with the compiling
  const compileAll = async () => {
    const wasWarming = state.isWarmingUp;
    state.isWarmingUp = true;
    try {
      if (renderer.extensions.has('KHR_parallel_shader_compile')) {
        await renderer.compileAsync(scene, camera);
      } else {
        renderer.compile(scene, camera);
        await new Promise((r) => setTimeout(r, 10));
      }
      let sliceStart = performance.now();
      for (const program of renderer.info.programs) {
        program.getUniforms();
        if (performance.now() - sliceStart > 30) {
          await new Promise((r) => setTimeout(r, 0));
          sliceStart = performance.now();
        }
      }
    } catch (e) {
      log.warn('Shader warm-up failed', e);
    } finally {
      state.isWarmingUp = wasWarming;
    }
  };
  let earlyCompile = null;
  // Things that only appear later in flight (road cars, other planes, the
  // lens flare) set out by the plane strictly for the final warm-up pass
  // (hooks.warmUps), while CPU-only prep (hooks.earlyWarmUps) runs alongside
  // the early terrain compile so temporary props never appear mid-load
  const setUpWarmUps = async () => {
    const undos = [];
    for (const warm of hooks.warmUps) {
      try {
        const undo = await warm(planeGroup.position);
        if (undo) undos.push(undo);
      } catch (e) {
        log.warn('Warm-up step failed', e);
      }
    }
    return undos;
  };
  const warmUp = async () => {
    const t0 = performance.now();
    await earlyCompile;
    const tEarly = performance.now();
    const early = renderer.info.programs.length;
    state.isWarmingUp = true;
    let undos = [];
    try {
      undos = await setUpWarmUps();
      // Anything the later chunks added, and those
      await compileAll();
      // One frame drawn with them, shadows included: compileAll doesn't reach
      // the shadow pass's shaders, or the flare's (drawn inside its own
      // onBeforeRender). The sun's shadow box only follows the plane in
      // flight, so it's centred on the plane for this frame
      const sunPos = dirLight.position.clone();
      const sunTarget = dirLight.target.position.clone();
      try {
        // 4000 units sunward, as updateShadowSnapping (game-loop.js) puts it
        const toSun = sunPos.clone().sub(sunTarget);
        if (toSun.lengthSq() < 1e-6) toSun.set(0, 1, 0);
        dirLight.target.position.copy(planeGroup.position);
        dirLight.position
          .copy(planeGroup.position)
          .addScaledVector(toSun.normalize(), 4000);
        dirLight.updateMatrixWorld();
        dirLight.target.updateMatrixWorld();
        renderer.shadowMap.needsUpdate = true;
        renderFrame(scene, camera);
      } catch (e) {
        log.warn('Warm-up frame failed', e);
      } finally {
        dirLight.position.copy(sunPos);
        dirLight.target.position.copy(sunTarget);
        dirLight.updateMatrixWorld();
        dirLight.target.updateMatrixWorld();
      }
    } finally {
      for (const undo of undos) undo();
      state.isWarmingUp = false;
    }
    const tShaders = performance.now();
    performanceMonitor.reset();
    try {
      prebakeSfxBuffers();
    } catch (e) {
      log.warn('Sound warm-up failed', e);
    }
    hooks.warmMap?.();
    log.info(
      `Warm-up: shaders ${Math.round(tShaders - t0)} ms (${Math.round(tEarly - t0)} ms waiting for the early ${early}, ${renderer.info.programs.length} in all), sound and map ${Math.round(performance.now() - tShaders)} ms`
    );
  };

  // Always run the progress bar animation first
  if (progressContainer && progressBar) {
    progressContainer.classList.remove('hidden');
    progressContainer.classList.add('visible');

    const msgEl = document.getElementById('splash-loading-msg');
    const messages = [
      t('Generating terrain chunks...'),
      t('Reticulating splines...'),
      t('Calculating flight paths...'),
      t('Have a chill flight.'),
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

      // Terrain fills the bar to 90%, the warm-up the rest
      progressBar.style.width = `${progress * 90}%`;

      // Update messages based on progress
      if (msgEl) {
        if (progress > 0.25 && messageIndex === 0) {
          messageIndex = 1;
          msgEl.textContent = messages[messageIndex];
        } else if (progress > 0.5 && messageIndex === 1) {
          messageIndex = 2;
          msgEl.textContent = messages[messageIndex];
        }
      }

      if (progress >= 0.25 && !earlyCompile) {
        earlyCompile = Promise.all([
          compileAll(),
          ...hooks.earlyWarmUps.map((fn) =>
            fn().catch((e) => log.warn('Early warm-up step failed', e))
          ),
        ]);
      }

      if (progress >= 1.0) {
        clearInterval(loadInterval);
        warmUp().then(() => {
          progressBar.style.width = '100%';
          if (msgEl) msgEl.textContent = messages[3];
          onLoaded();
        });
      }
    }, 50);

    const onLoaded = () => {
      // Wait a tiny bit so the progress bar visually reaches 100%
      setTimeout(() => {
        if (state.vrOnlyFlow && !ChillFlightLogic.START_NOW) {
          // Draw a single static 2D backdrop frame for the paused menu, then
          // wait at zero 2D GPU cost for the player to click Enter VR.
          renderFrame(scene, camera);
          const area = document.getElementById('splash-interactive-area');
          if (area) area.classList.add('crossfading');
          progressContainer.classList.remove('visible');
          progressContainer.classList.add('hidden');
          const btnContainer = document.getElementById('splash-btn-container');
          if (btnContainer) {
            btnContainer.classList.remove('hidden');
            btnContainer.classList.add('visible');
          }
          return;
        }
        state.dismissLoadingScreen(ChillFlightLogic.START_NOW);
      }, 150);
    };
  } else {
    // Fallback if elements are missing
    state.dismissLoadingScreen(true);
  }
} else {
  state.dismissLoadingScreen = () => {};
}

inputManager.onAutopilotToggle = () => toggleAutopilot();
hooks.resetSteering = resetSteering;
hooks.updateThrottle = () => updateThrottle(performance.now());

// Track store link clicks on web
const pauseAppStoreLink = document.getElementById('pause-app-store-link');
pauseAppStoreLink?.addEventListener('click', () => {
  trackAppStoreClick('pause_footer');
});

const splashAboutLink = document.getElementById('splash-about-link');
splashAboutLink?.addEventListener('click', () => {
  trackAboutClick('splash');
});
