// --- UI ACCESSIBILITY, MODAL INERT STACK, & KEYBOARD NAVIGATION ---
// Keeps background layers inert whenever a dialog/overlay is open, restores
// keyboard focus when dialogs close, traps Tab cycling inside active dialogs,
// and drives WAI-ARIA roving tabindex + Arrow/Home/End navigation across all
// [role="tablist"] and [role="radiogroup"] controls.

const MODAL_IDS = [
  'loading-overlay',
  'pause-overlay',
  'achievements-overlay',
  'people-overlay',
  'help-overlay',
  'language-overlay',
  'fullscreen-map-overlay',
];

const SUB_MODAL_IDS = [
  'language-overlay',
  'achievements-overlay',
  'people-overlay',
  'help-overlay',
];

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

let lastInputWasKeyboard = false;
let currentTopModal = null;
const returnFocusMap = new Map();
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

function resolveTopModal() {
  const loading = document.getElementById('loading-overlay');
  if (
    loading &&
    isElementVisible(loading) &&
    getComputedStyle(loading).pointerEvents !== 'none'
  ) {
    return loading;
  }
  for (const id of SUB_MODAL_IDS) {
    const el = document.getElementById(id);
    if (el && isElementVisible(el)) return el;
  }
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
    SUB_MODAL_IDS.includes(prevTop.id) &&
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
  const visible = allItems.filter((el) => !el.disabled && isElementVisible(el));
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

  syncAllRovingGroups();
  syncModalInertState();

  const modalObserver = new MutationObserver(() => {
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
