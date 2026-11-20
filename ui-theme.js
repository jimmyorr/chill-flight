// --- UI APPEARANCE THEME ---
// Resolves light or dark UI appearance from ?uiTheme= (light, dark, auto),
// saved Settings preference ('auto' | 'dark' | 'light'), and live OS
// prefers-color-scheme changes. Sets html[data-theme] and meta[name="theme-color"].
import {log} from './logger.js';

const STORAGE_KEY = 'chill_flight_ui_theme';
const VALID_PREFS = ['auto', 'dark', 'light'];
const DARK_THEME_COLOR = '#0b0f19';
const LIGHT_THEME_COLOR = '#f4f7fb';

const mediaQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: light)')
    : null;

function readUrlTheme() {
  if (typeof location === 'undefined') return null;
  const raw = new URLSearchParams(location.search)
    .get('uiTheme')
    ?.trim()
    .toLowerCase();
  return VALID_PREFS.includes(raw) ? raw : null;
}

function readStoredPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    return VALID_PREFS.includes(raw) ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

const urlOverride = readUrlTheme();
let currentPreference = urlOverride || readStoredPreference();
let resolvedTheme = 'dark';
const listeners = new Set();

function computeResolvedTheme(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return mediaQuery?.matches ? 'light' : 'dark';
}

function syncThemeMeta(theme) {
  if (typeof document === 'undefined') return;
  const overlay = document.getElementById('loading-overlay');
  const splashVisible =
    overlay &&
    overlay.style.display !== 'none' &&
    overlay.style.opacity !== '0';
  const color =
    theme === 'light' && !splashVisible ? LIGHT_THEME_COLOR : DARK_THEME_COLOR;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
}

function syncAppearanceButtons() {
  if (typeof document === 'undefined') return;
  const group = document.getElementById('appearance-group');
  if (!group) return;
  for (const btn of group.querySelectorAll('[data-appearance]')) {
    const active = btn.dataset.appearance === currentPreference;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
    btn.tabIndex = active ? 0 : -1;
  }
}

function applyTheme(notify = true) {
  const next = computeResolvedTheme(currentPreference);
  const changed = next !== resolvedTheme;
  resolvedTheme = next;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    syncThemeMeta(resolvedTheme);
    syncAppearanceButtons();
  }
  if (notify && changed) {
    for (const fn of listeners) {
      try {
        fn(resolvedTheme, currentPreference);
      } catch (err) {
        log.warn('[UI Theme] Listener error:', err);
      }
    }
  }
}

export function getThemePreference() {
  return currentPreference;
}

export function getResolvedTheme() {
  return resolvedTheme;
}

export function refreshThemeChrome() {
  syncThemeMeta(resolvedTheme);
}

export function setThemePreference(pref, {persist = true} = {}) {
  const clean = VALID_PREFS.includes(pref) ? pref : 'auto';
  const prefChanged = clean !== currentPreference;
  currentPreference = clean;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, clean);
    } catch {
      // Storage blocked; preference still applies for this session.
    }
  }
  const prevResolved = resolvedTheme;
  applyTheme(false);
  if (prefChanged || resolvedTheme !== prevResolved) {
    log.info(
      `[UI Theme] Preference: ${currentPreference} (resolved: ${resolvedTheme})`
    );
    for (const fn of listeners) {
      try {
        fn(resolvedTheme, currentPreference);
      } catch (err) {
        log.warn('[UI Theme] Listener error:', err);
      }
    }
  }
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

applyTheme(false);

if (mediaQuery) {
  const handleSystemChange = () => {
    if (currentPreference === 'auto') {
      applyTheme(true);
    }
  };
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleSystemChange);
  } else if (typeof mediaQuery.addListener === 'function') {
    mediaQuery.addListener(handleSystemChange);
  }
}

if (typeof document !== 'undefined') {
  const bindAppearanceGroup = () => {
    syncAppearanceButtons();
    const group = document.getElementById('appearance-group');
    if (!group || group.dataset.bound === '1') return;
    group.dataset.bound = '1';
    group.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-appearance]');
      if (!btn) return;
      setThemePreference(btn.dataset.appearance);
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAppearanceGroup, {
      once: true,
    });
  } else {
    bindAppearanceGroup();
  }
}
