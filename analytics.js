// analytics.js
// Central telemetry and event tracking across web (GA4) and native (Firebase Analytics).
import {log} from './logger.js';
import {hooks} from './hooks.js';
import {state} from './state.js';
import {ChillFlightLogic} from './chill-flight-logic.js';

let currentScreen = 'splash';
let flightStartTime = null;
let flightStartDistance = 0;
let flightCrashCount = 0;
let flightSessionActive = false;
let milestoneTimers = [];

const visitedLandmarks = new Set();

/**
 * Dispatches an event to Google Analytics (web) and Firebase Analytics (native).
 * Safe to call in any environment; no-op if gtag is not available or analytics is disabled.
 */
export function trackEvent(name, params = {}) {
  try {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  } catch (err) {
    log.warn('[Analytics] Failed to send event:', name, err);
  }
}

/**
 * Updates the active screen name.
 * On native, this maps to Firebase setCurrentScreen to prevent raw
 * UIViewController/MainActivity class names from overtaking screen metrics.
 */
export function trackScreen(screenName) {
  if (!screenName || screenName === currentScreen) return;
  currentScreen = screenName;
  trackEvent('screen_view', {
    screen_name: screenName,
    screen_class: screenName,
  });
}

function clearMilestones() {
  for (const timer of milestoneTimers) {
    clearTimeout(timer);
  }
  milestoneTimers = [];
}

function scheduleMilestones() {
  clearMilestones();
  const intervals = [
    {label: '30s', sec: 30},
    {label: '2m', sec: 120},
    {label: '5m', sec: 300},
    {label: '10m', sec: 600},
  ];
  for (const {label, sec} of intervals) {
    const id = setTimeout(() => {
      if (flightSessionActive) {
        trackEvent('flight_milestone', {
          milestone: label,
          duration_sec: sec,
        });
      }
    }, sec * 1000);
    milestoneTimers.push(id);
  }
}

/**
 * Triggered when the player leaves the splash screen and begins flying.
 */
export function trackFlightStart(extraParams = {}) {
  flightStartTime = performance.now();
  flightStartDistance = state.lifetimeDistanceTravelled || 0;
  flightCrashCount = 0;
  flightSessionActive = true;

  const planeType = state.planeType || 'biplane';
  const artStyle = ChillFlightLogic.ART_STYLE || 'classic';
  const preset =
    localStorage.getItem('chill_flight_graphics_preset') ||
    ChillFlightLogic.GRAPHICS_PRESET ||
    'auto';
  const controlScheme = state.currentControlScheme || 'joystick';

  trackScreen('flight');
  trackEvent('flight_start', {
    plane_type: planeType,
    art_style: artStyle,
    graphics_preset: preset,
    control_scheme: controlScheme,
    ...extraParams,
  });

  scheduleMilestones();
}

/**
 * Triggered when a flight concludes (e.g. unload, backgrounding, crash, or pause).
 */
export function trackFlightEnd(reason = 'unload') {
  if (!flightSessionActive || flightStartTime === null) return;

  const durationSec = Math.max(
    0,
    Math.round((performance.now() - flightStartTime) / 1000)
  );
  const currentLifetime = state.lifetimeDistanceTravelled || 0;
  const sessionDistance = state.sessionDistanceTravelled || 0;
  const deltaDistance = Math.max(
    0,
    currentLifetime > flightStartDistance
      ? currentLifetime - flightStartDistance
      : sessionDistance
  );
  const distanceKm = Math.round((deltaDistance / 1000) * 10) / 10;

  trackEvent('flight_end', {
    reason,
    duration_sec: durationSec,
    distance_km: distanceKm,
    crash_count: flightCrashCount,
    transport_type: 'beacon',
  });

  clearMilestones();
  flightSessionActive = false;
  flightStartTime = null;
}

/**
 * Tracks a crash event and increments the session crash counter.
 */
export function trackFlightCrash(details = {}) {
  flightCrashCount++;
  trackEvent('plane_crash', {
    crash_number: flightCrashCount,
    ...details,
  });
}

/**
 * Standard GA4 recommended event for achievements: unlock_achievement.
 */
export function trackAchievement(achievementId, title) {
  trackEvent('unlock_achievement', {
    achievement_id: achievementId,
    achievement_name: title,
  });
}

/**
 * Tracks vehicle/plane switching.
 */
export function trackVehicleSelect(vehicleType) {
  trackEvent('select_vehicle', {
    vehicle_type: vehicleType,
  });
}

/**
 * Tracks clicks on the App Store badge or download links on web.
 */
export function trackAppStoreClick(placement = 'settings_footer') {
  trackEvent('app_store_click', {
    placement,
    destination: 'ios_app_store',
  });
}

/**
 * Tracks social/multiplayer sharing actions.
 */
export function trackShare(method, contentType = 'multiplayer_invite') {
  trackEvent('share', {
    method,
    content_type: contentType,
  });
}

/**
 * Tracks landmark discovery once per session per landmark.
 */
export function trackLandmarkVisited(landmarkName) {
  if (!landmarkName || visitedLandmarks.has(landmarkName)) return;
  visitedLandmarks.add(landmarkName);
  trackEvent('discover_landmark', {
    landmark_name: landmarkName,
  });
}

// Hook for native backgrounding from native-adapter.js
hooks.onBackground = () => {
  trackFlightEnd('backgrounded');
};

// Global lifecycle listeners for session end on web
if (typeof window !== 'undefined') {
  const handleUnload = () => {
    trackFlightEnd('pagehide');
  };
  window.addEventListener('pagehide', handleUnload);
  window.addEventListener('beforeunload', handleUnload);
}
