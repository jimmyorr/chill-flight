// --- UI ACCESSIBILITY, MODAL INERT STACK, BACK NAVIGATION, & KEYBOARD ---
// Keeps background layers inert whenever a dialog/overlay is open, restores
// keyboard focus when dialogs close, traps Tab cycling inside active dialogs,
// drives WAI-ARIA roving tabindex + Arrow/Home/End navigation, provides the
// unified LIFO Back stack shared by @capacitor/app backButton and Escape, and
// keeps Pause inputs unobstructed above mobile software keyboards.
import {state} from './state.js';
import {hooks} from './hooks.js';
import {togglePause} from './game-state.js';
import {disarmAchievementsReset} from './game-hud.js';
import {collapseQuickMenu, isQuickMenuExpanded} from './game-ui.js';
import {closeDialog, isDialogOpen} from './dialog.js';

const MODAL_IDS = [
  'loading-overlay',
  'pause-overlay',
  'achievements-overlay',
  'people-overlay',
  'help-overlay',
  'language-overlay',
  'fullscreen-map-overlay',
];

const SUB_SHEET_IDS = [
  'achievements-overlay',
  'people-overlay',
  'help-overlay',
];

const SUB_CLOSE_BTN_IDS = {
  'achievements-overlay': 'achievements-close-btn',
  'people-overlay': 'people-close-btn',
  'help-overlay': 'help-close-btn',
};

const SUB_MODAL_IDS = ['language-overlay', ...SUB_SHEET_IDS];

const FLIGHT_CHROME_IDS = [
  'cockpit-ui',
  'mobile-controls',
  'minimap-container',
];

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

const TEXT_INPUT_SELECTOR =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]), textarea';

let lastInputWasKeyboard = false;
let currentTopModal = null;
const returnFocusMap = new Map();
const subSheetStack = [];
let isSyncingRoving = false;

function isElementVisible(el) {
  if (!el || el.hidden) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
}

function isInsideInert(el) {
  for (let cur = el; cur && cur !== document.body; cur = cur.parentElement) {
    if (cur.inert || cur.hidden || getComputedStyle(cur).display === 'none') {
      return true;
    }
  }
  return false;
}

function getFocusableElements(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => isElementVisible(el) && !isInsideInert(el)
  );
}

function syncSubSheetStack() {
  for (let i = subSheetStack.length - 1; i >= 0; i--) {
    const el = document.getElementById(subSheetStack[i]);
    if (!isElementVisible(el)) {
      subSheetStack.splice(i, 1);
    }
  }
  for (const id of SUB_SHEET_IDS) {
    const el = document.getElementById(id);
    if (isElementVisible(el) && !subSheetStack.includes(id)) {
      subSheetStack.push(id);
    }
  }
}

function getTopSubSheetId() {
  syncSubSheetStack();
  return subSheetStack.length ? subSheetStack[subSheetStack.length - 1] : null;
}

function isSplashActive() {
  const loading = document.getElementById('loading-overlay');
  return Boolean(
    loading &&
    isElementVisible(loading) &&
    getComputedStyle(loading).pointerEvents !== 'none'
  );
}

function resolveTopModal() {
  if (isSplashActive()) {
    return document.getElementById('loading-overlay');
  }
  const langOverlay = document.getElementById('language-overlay');
  if (langOverlay && isElementVisible(langOverlay)) return langOverlay;

  const topSubId = getTopSubSheetId();
  if (topSubId) return document.getElementById(topSubId);

  const mapOverlay = document.getElementById('fullscreen-map-overlay');
  if (mapOverlay && isElementVisible(mapOverlay)) return mapOverlay;

  const pauseOverlay = document.getElementById('pause-overlay');
  if (
    pauseOverlay &&
    isElementVisible(pauseOverlay) &&
    !pauseOverlay.classList.contains('under-map')
  ) {
    return pauseOverlay;
  }
  return null;
}

function preferredInitialFocus(modal) {
  if (!modal) return null;
  if (modal.id === 'language-overlay') {
    return (
      modal.querySelector('.language-option.active') ||
      modal.querySelector('#language-close-btn')
    );
  }
  if (modal.id === 'fullscreen-map-overlay') {
    return document.getElementById('fullscreen-map-canvas');
  }
  if (modal.id === 'pause-overlay') {
    return modal.querySelector('.pause-tab.active');
  }
  return (
    modal.querySelector('.achievements-close-btn') ||
    getFocusableElements(modal)[0] ||
    null
  );
}

export function syncModalInertState() {
  if (typeof document === 'undefined') return;
  syncSubSheetStack();
  const nextTop = resolveTopModal();
  const prevTop = currentTopModal;
  const activeBefore = document.activeElement;

  for (const id of MODAL_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.inert = el !== nextTop;
  }

  const flightInert = nextTop !== null;
  for (const id of FLIGHT_CHROME_IDS) {
    const el = document.getElementById(id);
    if (el) el.inert = flightInert;
  }

  if (nextTop === prevTop) return;
  currentTopModal = nextTop;

  const returningToParentModal =
    prevTop &&
    (SUB_MODAL_IDS.includes(prevTop.id) ||
      prevTop.id === 'fullscreen-map-overlay') &&
    nextTop?.id === 'pause-overlay';

  if (nextTop && !returningToParentModal) {
    if (
      activeBefore &&
      activeBefore !== document.body &&
      !nextTop.contains(activeBefore)
    ) {
      returnFocusMap.set(nextTop, activeBefore);
    }
  }

  if (prevTop) {
    const saved = returnFocusMap.get(prevTop);
    returnFocusMap.delete(prevTop);
    const focusWasTrappedInClosed =
      activeBefore && prevTop.contains(activeBefore);
    if (
      (lastInputWasKeyboard || focusWasTrappedInClosed) &&
      saved &&
      saved.isConnected &&
      isElementVisible(saved) &&
      !isInsideInert(saved)
    ) {
      saved.focus({preventScroll: true});
      return;
    }
  }

  if (
    nextTop &&
    lastInputWasKeyboard &&
    (!activeBefore || !nextTop.contains(activeBefore))
  ) {
    const target = preferredInitialFocus(nextTop);
    if (target && isElementVisible(target) && !isInsideInert(target)) {
      target.focus({preventScroll: true});
    }
  }
}

// Unified LIFO Back navigation shared by Android @capacitor/app backButton and
// Escape. Returns 'handled', 'exit' (native splash screen), or false.
export function handleBackNavigation({source = 'escape'} = {}) {
  if (typeof document === 'undefined') return false;
  if (state.isVRPresenting) return false;

  const restoreKeyboardFocus = source === 'escape' && lastInputWasKeyboard;

  // 0. Initial title / loading screen: native Back exits app; Escape is no-op
  if (isSplashActive()) {
    return source === 'native' ? 'exit' : false;
  }

  // 1. Language picker bottom sheet
  const langOverlay = document.getElementById('language-overlay');
  if (langOverlay && isElementVisible(langOverlay)) {
    const closeBtn = document.getElementById('language-close-btn');
    if (closeBtn) closeBtn.click();
    else langOverlay.style.display = 'none';
    return 'handled';
  }

  // 2 & 3. Sub-sheets in LIFO open order (disarming CONFIRM RESET? first if
  // Achievements is topmost)
  const topSubId = getTopSubSheetId();
  if (topSubId) {
    if (topSubId === 'achievements-overlay' && disarmAchievementsReset()) {
      return 'handled';
    }
    const closeBtnId = SUB_CLOSE_BTN_IDS[topSubId];
    const closeBtn = closeBtnId ? document.getElementById(closeBtnId) : null;
    if (closeBtn) {
      closeBtn.click();
    } else {
      const el = document.getElementById(topSubId);
      if (el) el.style.display = 'none';
    }
    return 'handled';
  }

  // 4. Fullscreen map: clear active warp pin first, else close map (returning
  // to #pause-overlay if opened from Pause, or resuming flight otherwise)
  if (hooks.fullscreenMap?.isOpen()) {
    if (hooks.fullscreenMap.clearPin?.({restoreFocus: restoreKeyboardFocus})) {
      return 'handled';
    }
    hooks.fullscreenMap.close({returnToPause: true});
    return 'handled';
  }

  // 5, 6 & 7. Pause overlay: collapse Together games picker -> return from
  // secondary tab to Flight tab -> close Pause back to flight
  const pauseOverlay = document.getElementById('pause-overlay');
  if (
    pauseOverlay &&
    isElementVisible(pauseOverlay) &&
    !pauseOverlay.classList.contains('under-map')
  ) {
    const activeTab = pauseOverlay.querySelector('.pause-tab.active');
    const tabName = activeTab?.dataset.tab || 'flight';

    if (source === 'native' && tabName !== 'flight') {
      const flightTab = pauseOverlay.querySelector(
        '.pause-tab[data-tab="flight"]'
      );
      if (flightTab) {
        flightTab.click();
        if (restoreKeyboardFocus) {
          flightTab.focus({preventScroll: true});
        }
        return 'handled';
      }
    }

    if (state.vrOnlyFlow && !state.isVRPresenting) {
      return source === 'native' ? 'exit' : false;
    }
    togglePause();
    return 'handled';
  }

  // 8. Transient in-flight chrome: quick menu, then NPC dialog
  if (isQuickMenuExpanded()) {
    collapseQuickMenu({restoreFocus: source === 'escape'});
    return 'handled';
  }

  if (isDialogOpen()) {
    closeDialog();
    return 'handled';
  }

  // 9. Root flight view: open Pause (prevents accidental Android edge-swipes
  // while touch-steering from quitting the flight)
  togglePause();
  return 'handled';
}

hooks.navigateBack = handleBackNavigation;

function syncRovingGroup(group) {
  if (!group || isSyncingRoving) return;
  const role = group.getAttribute('role');
  const itemSelector =
    role === 'tablist'
      ? '[role="tab"]'
      : role === 'radiogroup'
        ? '[role="radio"]'
        : null;
  if (!itemSelector) return;

  const allItems = [...group.querySelectorAll(itemSelector)];
  if (!allItems.length) return;
  const visible = allItems.filter(
    (el) =>
      !el.disabled && !el.hidden && getComputedStyle(el).display !== 'none'
  );
  if (!visible.length) return;

  const attr = role === 'tablist' ? 'aria-selected' : 'aria-checked';
  const activeItem =
    visible.find((el) => el.classList.contains('active')) ||
    visible.find((el) => el.getAttribute(attr) === 'true') ||
    visible[0];

  isSyncingRoving = true;
  try {
    for (const item of allItems) {
      const isChecked =
        item.classList.contains('active') ||
        (!visible.some((v) => v.classList.contains('active')) &&
          item === activeItem);
      if (item.getAttribute(attr) !== String(isChecked)) {
        item.setAttribute(attr, String(isChecked));
      }
      const wantTab = item === activeItem ? 0 : -1;
      if (item.tabIndex !== wantTab) {
        item.tabIndex = wantTab;
      }
    }
  } finally {
    isSyncingRoving = false;
  }
}

function syncAllRovingGroups() {
  for (const group of document.querySelectorAll(
    '[role="tablist"], [role="radiogroup"]'
  )) {
    syncRovingGroup(group);
  }
}

function handleRovingKeyDown(e) {
  const target = e.target;
  if (!(target instanceof HTMLElement)) return false;
  const itemRole = target.getAttribute('role');
  if (itemRole !== 'tab' && itemRole !== 'radio') return false;

  const groupRole = itemRole === 'tab' ? 'tablist' : 'radiogroup';
  const group = target.closest(`[role="${groupRole}"]`);
  if (!group) return false;

  const items = [...group.querySelectorAll(`[role="${itemRole}"]`)].filter(
    (el) => !el.disabled && isElementVisible(el)
  );
  if (items.length < 2) return false;

  const idx = items.indexOf(target);
  if (idx === -1) return false;

  let nextIdx = -1;
  if (
    e.key === 'ArrowRight' ||
    (itemRole === 'radio' && e.key === 'ArrowDown')
  ) {
    nextIdx = (idx + 1) % items.length;
  } else if (
    e.key === 'ArrowLeft' ||
    (itemRole === 'radio' && e.key === 'ArrowUp')
  ) {
    nextIdx = (idx - 1 + items.length) % items.length;
  } else if (e.key === 'Home') {
    nextIdx = 0;
  } else if (e.key === 'End') {
    nextIdx = items.length - 1;
  }

  if (nextIdx === -1) return false;
  e.preventDefault();
  e.stopPropagation();

  const nextItem = items[nextIdx];
  if (group.dataset.manualActivate === 'true') {
    isSyncingRoving = true;
    try {
      for (const item of items) {
        item.tabIndex = item === nextItem ? 0 : -1;
      }
    } finally {
      isSyncingRoving = false;
    }
    nextItem.focus();
    nextItem.scrollIntoView?.({block: 'nearest'});
  } else {
    nextItem.focus();
    nextItem.click();
  }
  return true;
}

function handleDialogTabTrap(e) {
  if (e.key !== 'Tab' || !currentTopModal) return;
  if (currentTopModal.getAttribute('role') !== 'dialog') return;
  const focusable = getFocusableElements(currentTopModal);
  if (!focusable.length) {
    e.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (e.shiftKey) {
    if (active === first || !currentTopModal.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !currentTopModal.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

function isTextInputFocused() {
  const el = document.activeElement;
  return Boolean(el instanceof HTMLElement && el.matches(TEXT_INPUT_SELECTOR));
}

function revealFocusedPauseInput(input) {
  if (!(input instanceof HTMLElement)) return;
  const panels =
    input.closest('.pause-panel') || input.closest('.pause-panels');
  if (!panels) return;

  let anchor = input;
  if (input.id === 'fly-code') {
    anchor = input.closest('.fly-join-row') || input;
  } else if (input.id === 'fly-self-name') {
    anchor = input.closest('#fly-self') || input;
  }
  anchor.scrollIntoView?.({block: 'nearest'});

  const panelRect = panels.getBoundingClientRect();
  if (panelRect.height <= 0) return;

  // Ensure the input itself and its paired primary action button (plus any
  // non-empty #fly-status error message under #fly-code) stay clear of the
  // bottom edge of .pause-panels above the software keyboard
  const statusEl =
    input.id === 'fly-code' ? document.getElementById('fly-status') : null;
  const hasStatus = Boolean(
    statusEl && statusEl.textContent.trim() && isElementVisible(statusEl)
  );
  const companion =
    input.id === 'fly-name'
      ? document.getElementById('fly-invite-btn')
      : input.id === 'fly-code'
        ? hasStatus
          ? statusEl
          : document.getElementById('fly-join-btn')
        : null;

  const inputRect = input.getBoundingClientRect();
  if (inputRect.top < panelRect.top + 4) {
    panels.scrollTop -= panelRect.top + 4 - inputRect.top;
  } else if (inputRect.bottom > panelRect.bottom - 4) {
    panels.scrollTop += inputRect.bottom - (panelRect.bottom - 4);
  }

  if (companion && isElementVisible(companion)) {
    const afterInputRect = input.getBoundingClientRect();
    const btnRect = companion.getBoundingClientRect();
    if (btnRect.bottom > panelRect.bottom - 4) {
      const needed = btnRect.bottom - (panelRect.bottom - 4);
      const maxShiftWithoutClippingInput = Math.max(
        0,
        afterInputRect.top - (panelRect.top + 4)
      );
      panels.scrollTop += Math.min(needed, maxShiftWithoutClippingInput);
    }
  }
}

let baselineLayoutHeight =
  typeof window !== 'undefined' ? window.innerHeight || 0 : 0;
let baselineLayoutWidth =
  typeof window !== 'undefined' ? window.innerWidth || 0 : 0;

export function syncVisualViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const vv = window.visualViewport;
  const layoutW = window.innerWidth || 0;
  const layoutH = window.innerHeight || 0;
  const inputFocused = isTextInputFocused();

  if (Math.abs(layoutW - baselineLayoutWidth) > 40) {
    baselineLayoutWidth = layoutW;
    baselineLayoutHeight = layoutH;
  } else if (!inputFocused && layoutH >= baselineLayoutHeight) {
    baselineLayoutHeight = layoutH;
  } else if (!inputFocused && (!vv || Math.abs(layoutH - vv.height) < 40)) {
    baselineLayoutHeight = layoutH;
  }

  const vvh = vv ? vv.height : layoutH;
  const offsetTop = vv ? Math.max(0, vv.offsetTop) : 0;
  const kbInset = vv ? Math.max(0, layoutH - vvh - offsetTop) : 0;
  const shrunkLayout = baselineLayoutHeight - vvh;
  const kbOpen =
    kbInset > 90 || (inputFocused && (kbInset > 40 || shrunkLayout > 90));

  const root = document.documentElement;
  root.style.setProperty('--vvh', `${Math.round(vvh)}px`);
  root.style.setProperty('--kb-inset', `${Math.round(kbInset)}px`);
  root.style.setProperty('--vv-offset-top', `${Math.round(offsetTop)}px`);
  if (kbOpen) {
    root.dataset.kbOpen = 'true';
  } else {
    delete root.dataset.kbOpen;
  }

  if (offsetTop > 0 && inputFocused) {
    window.scrollTo(0, 0);
  }
  if (inputFocused) {
    revealFocusedPauseInput(document.activeElement);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    () => {
      lastInputWasKeyboard = false;
    },
    {capture: true, passive: true}
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        lastInputWasKeyboard = true;
      }
      if (handleRovingKeyDown(e)) return;
      handleDialogTabTrap(e);
    },
    {capture: true}
  );

  // Suppress accidental long-press / right-click browser context menus on
  // non-text-input UI surfaces while preserving Copy/Paste on text inputs
  document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest('#debug-menu')) return;
    if (
      target.tagName === 'TEXTAREA' ||
      (target.tagName === 'INPUT' &&
        !['checkbox', 'radio', 'button', 'range'].includes(target.type))
    ) {
      return;
    }
    if (
      target.closest(
        'canvas, #cockpit-ui, #mobile-controls, #pause-overlay, #achievements-overlay, #people-overlay, #help-overlay, #language-overlay, #fullscreen-map-overlay, #npc-dialog'
      )
    ) {
      e.preventDefault();
    }
  });

  let focusRevealTimer = null;
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches(TEXT_INPUT_SELECTOR)) return;
    syncVisualViewport();
    requestAnimationFrame(() => revealFocusedPauseInput(target));
    clearTimeout(focusRevealTimer);
    focusRevealTimer = setTimeout(() => {
      syncVisualViewport();
      revealFocusedPauseInput(target);
    }, 180);
  });

  document.addEventListener('focusout', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches(TEXT_INPUT_SELECTOR)) return;
    setTimeout(syncVisualViewport, 60);
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncVisualViewport, {passive: true});
    window.visualViewport?.addEventListener('resize', syncVisualViewport, {
      passive: true,
    });
    window.visualViewport?.addEventListener('scroll', syncVisualViewport, {
      passive: true,
    });
  }

  syncAllRovingGroups();
  syncModalInertState();
  syncVisualViewport();

  const modalObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const el = m.target instanceof HTMLElement ? m.target : null;
      const id = el?.id || '';
      if (!SUB_SHEET_IDS.includes(id)) continue;
      const existingIdx = subSheetStack.indexOf(id);
      if (isElementVisible(el)) {
        if (existingIdx === -1) subSheetStack.push(id);
      } else if (existingIdx !== -1) {
        subSheetStack.splice(existingIdx, 1);
      }
    }
    syncModalInertState();
  });
  for (const id of MODAL_IDS) {
    const el = document.getElementById(id);
    if (el) {
      modalObserver.observe(el, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
    }
  }

  const rovingObserver = new MutationObserver((mutations) => {
    if (isSyncingRoving) return;
    const touched = new Set();
    for (const m of mutations) {
      const el = m.target instanceof HTMLElement ? m.target : null;
      const group = el?.closest?.('[role="tablist"], [role="radiogroup"]');
      if (group) touched.add(group);
    }
    for (const group of touched) syncRovingGroup(group);
  });
  for (const group of document.querySelectorAll(
    '[role="tablist"], [role="radiogroup"]'
  )) {
    rovingObserver.observe(group, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'disabled'],
    });
  }
}
