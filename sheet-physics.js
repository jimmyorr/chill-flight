// --- BOTTOM-SHEET PHYSICS & ZERO-LATENCY PRESS FEEDBACK ---
// Provides native-feel bottom-sheet drag, velocity flick-to-dismiss,
// pull-down from body at scrollTop === 0, and damped upward rubber-banding on
// mobile portrait viewports, plus immediate pointerdown [data-pressed]
// feedback across interactive controls.
import {hooks} from './hooks.js';

const SHEET_MEDIA_QUERY =
  '(max-width: 500px), (max-width: 600px) and (min-height: 501px)';

const PRESS_SELECTOR = [
  'button:not(:disabled)',
  'label.pause-row',
  '.language-option',
  '.fly-game',
  '.help-try',
  '.mobile-btn',
  '.sub-btn',
  '.color-swatch',
  'a[href]',
].join(', ');

const FLICK_VELOCITY_PX_PER_MS = 0.45;
const FLICK_MIN_OFFSET_PX = 22;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}

function isSheetViewport() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.(SHEET_MEDIA_QUERY).matches)
  );
}

function isVisibleOverlay(el) {
  if (!el || el.hidden) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden';
}

function computeSheetOffset(rawDy) {
  return rawDy > 0 ? rawDy : 0;
}

function findScrollableAncestor(target, sheetEl) {
  for (
    let cur = target instanceof HTMLElement ? target : null;
    cur && cur !== sheetEl.parentElement;
    cur = cur.parentElement
  ) {
    const cs = getComputedStyle(cur);
    if (
      (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
      cur.scrollHeight > cur.clientHeight + 1
    ) {
      return cur;
    }
    if (cur === sheetEl) break;
  }
  return null;
}

if (typeof document !== 'undefined') {
  let pressedEl = null;
  let pressedStartX = 0;
  let pressedStartY = 0;

  const clearPressed = () => {
    if (pressedEl) {
      delete pressedEl.dataset.pressed;
      pressedEl = null;
    }
  };

  document.addEventListener(
    'pointerdown',
    (e) => {
      clearPressed();
      if (e.button !== undefined && e.button !== 0) return;
      const target = e.target instanceof Element ? e.target : null;
      const hit = target?.closest(PRESS_SELECTOR);
      if (hit instanceof HTMLElement) {
        pressedEl = hit;
        pressedStartX = e.clientX;
        pressedStartY = e.clientY;
        pressedEl.dataset.pressed = 'true';
      }
    },
    {capture: true, passive: true}
  );

  document.addEventListener(
    'pointermove',
    (e) => {
      if (
        pressedEl &&
        Math.hypot(e.clientX - pressedStartX, e.clientY - pressedStartY) > 10
      ) {
        clearPressed();
      }
    },
    {capture: true, passive: true}
  );

  document.addEventListener('pointerup', clearPressed, {
    capture: true,
    passive: true,
  });
  document.addEventListener('pointercancel', clearPressed, {
    capture: true,
    passive: true,
  });
  window.addEventListener('blur', clearPressed, {passive: true});

  const SHEETS = [
    {
      id: 'language-overlay',
      getContainer: () => document.getElementById('language-overlay'),
      getSheet: () =>
        document.querySelector('#language-overlay .achievements-content'),
      isOpen: (c) => isVisibleOverlay(c),
      dismiss: () => document.getElementById('language-close-btn')?.click(),
      timer: null,
    },
    {
      id: 'achievements-overlay',
      getContainer: () => document.getElementById('achievements-overlay'),
      getSheet: () =>
        document.querySelector('#achievements-overlay .achievements-content'),
      isOpen: (c) => isVisibleOverlay(c),
      dismiss: () => document.getElementById('achievements-close-btn')?.click(),
      timer: null,
    },
    {
      id: 'people-overlay',
      getContainer: () => document.getElementById('people-overlay'),
      getSheet: () =>
        document.querySelector('#people-overlay .achievements-content'),
      isOpen: (c) => isVisibleOverlay(c),
      dismiss: () => document.getElementById('people-close-btn')?.click(),
      timer: null,
    },
    {
      id: 'help-overlay',
      getContainer: () => document.getElementById('help-overlay'),
      getSheet: () =>
        document.querySelector('#help-overlay .achievements-content'),
      isOpen: (c) => isVisibleOverlay(c),
      dismiss: () => document.getElementById('help-close-btn')?.click(),
      timer: null,
    },
    {
      id: 'fullscreen-map-warp',
      getContainer: () => document.getElementById('fullscreen-map-overlay'),
      getSheet: () => document.getElementById('fullscreen-map-warp'),
      isOpen: (c, s) => isVisibleOverlay(c) && Boolean(s) && !s.hidden,
      dismiss: () => hooks.fullscreenMap?.clearPin?.(),
      timer: null,
    },
    {
      id: 'pause-overlay',
      getContainer: () => document.getElementById('pause-overlay'),
      getSheet: () =>
        document.querySelector('#pause-overlay .customization-box'),
      isOpen: (c) =>
        isVisibleOverlay(c) &&
        !c.classList.contains('under-map') &&
        !document.getElementById('resume-btn')?.hidden,
      dismiss: () => document.getElementById('resume-btn')?.click(),
      mouseGrabberOnly: true,
      timer: null,
    },
  ];

  function resetSheetStyles(entry) {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    const sheet = entry.getSheet();
    if (!sheet) return;
    if (sheet.classList.contains('sheet-dragging')) {
      sheet.classList.remove('sheet-dragging');
    }
    if (sheet.style.transform) sheet.style.transform = '';
    if (sheet.style.transition) sheet.style.transition = '';
  }

  function resolveActiveSheetForTarget(target) {
    if (!isSheetViewport() || !(target instanceof Element)) return null;
    if (
      target.closest('input[type="range"], canvas, [data-no-sheet-drag="true"]')
    ) {
      return null;
    }
    for (const entry of SHEETS) {
      const container = entry.getContainer();
      const sheet = entry.getSheet();
      if (!container || !sheet || !entry.isOpen(container, sheet)) continue;
      if (sheet.contains(target)) return {entry, sheet};
      // Topmost modal owns input; don't fall through to sheets behind it
      if (container.contains(target) && entry.id !== 'fullscreen-map-warp') {
        return null;
      }
    }
    return null;
  }

  let gesture = null;
  let suppressClickUntil = 0;

  function beginGesture(kind, id, clientX, clientY, target) {
    if (gesture) return;
    const match = resolveActiveSheetForTarget(target);
    if (!match) return;
    const {entry, sheet} = match;
    resetSheetStyles(entry);

    const fromGrabber = Boolean(
      target instanceof Element && target.closest('.sheet-grabber')
    );
    if (kind === 'pointer' && entry.mouseGrabberOnly && !fromGrabber) {
      return;
    }
    const scrollEl = fromGrabber ? null : findScrollableAncestor(target, sheet);

    gesture = {
      kind,
      id,
      entry,
      sheet,
      scrollEl,
      fromGrabber,
      startX: clientX,
      startY: clientY,
      anchorY: clientY,
      startScrollTop: scrollEl ? scrollEl.scrollTop : 0,
      engaged: false,
      aborted: false,
      offsetY: 0,
      rawDy: 0,
      samples: [{t: performance.now(), y: 0}],
    };
  }

  function moveGesture(kind, id, clientX, clientY, rawEvent) {
    if (!gesture || gesture.kind !== kind || gesture.id !== id) return;
    if (gesture.aborted) return;

    const dx = clientX - gesture.startX;
    const dy = clientY - gesture.startY;

    if (!gesture.engaged) {
      const slop = gesture.fromGrabber ? 2 : 7;
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        gesture.aborted = true;
        return;
      }
      if (Math.abs(dy) < slop) return;
      if (!gesture.fromGrabber && Math.abs(dy) <= Math.abs(dx) * 1.15) {
        gesture.aborted = true;
        return;
      }

      if (dy < 0) {
        gesture.aborted = true;
        return;
      }

      if (gesture.scrollEl) {
        const curTop = gesture.scrollEl.scrollTop;
        if (gesture.startScrollTop > 1 || curTop > 1) {
          gesture.aborted = true;
          return;
        }
      }

      gesture.engaged = true;
      gesture.anchorY = clientY;
      gesture.samples = [{t: performance.now(), y: 0}];
      gesture.sheet.classList.add('sheet-dragging');
      clearPressed();
    }

    if (rawEvent.cancelable) rawEvent.preventDefault();

    const rawDy = clientY - gesture.anchorY;
    const offsetY = computeSheetOffset(rawDy);
    gesture.rawDy = rawDy;
    gesture.offsetY = offsetY;
    gesture.sheet.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0)`;

    const now = performance.now();
    gesture.samples.push({t: now, y: rawDy});
    while (gesture.samples.length > 2 && now - gesture.samples[0].t > 100) {
      gesture.samples.shift();
    }
  }

  function finishGesture(kind, id, cancelled = false) {
    if (!gesture || gesture.kind !== kind || gesture.id !== id) return;
    const g = gesture;
    gesture = null;

    if (!g.engaged) return;

    suppressClickUntil = performance.now() + 320;
    const {entry, sheet, offsetY, samples} = g;
    sheet.classList.remove('sheet-dragging');

    let vy = 0;
    const now = performance.now();
    const last = samples[samples.length - 1];
    if (last && now - last.t <= 140 && samples.length >= 2) {
      const first =
        samples.find((s) => last.t - s.t <= 90 && s !== last) || samples[0];
      const dt = last.t - first.t;
      if (dt >= 6) vy = (last.y - first.y) / dt;
    }

    const rectH = sheet.getBoundingClientRect().height || 300;
    const shouldDismiss =
      !cancelled &&
      ((offsetY > FLICK_MIN_OFFSET_PX && vy > FLICK_VELOCITY_PX_PER_MS) ||
        (offsetY > Math.min(110, rectH * 0.28) && vy > -0.25));

    if (shouldDismiss) {
      hooks.onSheetDismiss?.();
      if (prefersReducedMotion()) {
        resetSheetStyles(entry);
        entry.dismiss();
        return;
      }
      const remaining = Math.max(40, rectH + 40 - offsetY);
      const durationMs = Math.round(
        Math.max(150, Math.min(230, remaining / Math.max(vy, 0.9)))
      );
      sheet.style.transition = `transform ${durationMs}ms cubic-bezier(0.32, 0.72, 0, 1)`;
      sheet.style.transform = `translate3d(0, ${Math.round(rectH + 48)}px, 0)`;
      entry.timer = setTimeout(() => {
        resetSheetStyles(entry);
        entry.dismiss();
      }, durationMs + 16);
    } else {
      hooks.onSheetSnap?.();
      if (prefersReducedMotion() || Math.abs(offsetY) < 0.5) {
        resetSheetStyles(entry);
        return;
      }
      sheet.style.transition = 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = 'translate3d(0, 0px, 0)';
      entry.timer = setTimeout(() => {
        resetSheetStyles(entry);
      }, 275);
    }
  }

  // Touch events ({passive: false} on touchmove so scrollTop === 0 pull-down
  // cleanly overrides native pan-y scroll without pointercancel)
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      const t = e.changedTouches[0];
      beginGesture('touch', t.identifier, t.clientX, t.clientY, e.target);
    },
    {capture: true, passive: true}
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (pressedEl && e.changedTouches.length > 0) {
        const pt = e.changedTouches[0];
        if (
          Math.hypot(pt.clientX - pressedStartX, pt.clientY - pressedStartY) >
          10
        ) {
          clearPressed();
        }
      }
      if (!gesture || gesture.kind !== 'touch') return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === gesture.id) {
          moveGesture('touch', t.identifier, t.clientX, t.clientY, e);
          break;
        }
      }
    },
    {capture: true, passive: false}
  );

  document.addEventListener(
    'touchend',
    (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        finishGesture('touch', t.identifier, false);
      }
      if (e.isTrusted && performance.now() < suppressClickUntil) {
        if (e.cancelable) e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    {capture: true, passive: false}
  );

  document.addEventListener(
    'touchcancel',
    (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        finishGesture('touch', t.identifier, true);
      }
    },
    {capture: true, passive: true}
  );

  // Mouse / pen pointer events
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button !== 0) return;
      beginGesture('pointer', e.pointerId, e.clientX, e.clientY, e.target);
    },
    {capture: true, passive: true}
  );

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      moveGesture('pointer', e.pointerId, e.clientX, e.clientY, e);
    },
    {capture: true}
  );

  document.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'touch') return;
      finishGesture('pointer', e.pointerId, false);
    },
    {capture: true, passive: true}
  );

  document.addEventListener(
    'pointercancel',
    (e) => {
      if (e.pointerType === 'touch') return;
      finishGesture('pointer', e.pointerId, true);
    },
    {capture: true, passive: true}
  );

  // Suppress trusted ghost click after a sheet drag or flick release. A
  // keyboard click (Enter/Space, detail 0) is never a ghost, so it goes through.
  document.addEventListener(
    'click',
    (e) => {
      if (
        e.isTrusted &&
        e.detail !== 0 &&
        performance.now() < suppressClickUntil
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    {capture: true}
  );

  // Clear residual inline transforms if an overlay hides externally (e.g. Escape)
  const observer = new MutationObserver(() => {
    for (const entry of SHEETS) {
      const c = entry.getContainer();
      const s = entry.getSheet();
      if (!entry.isOpen(c, s) && !entry.timer) {
        resetSheetStyles(entry);
      }
    }
  });
  for (const entry of SHEETS) {
    const target =
      entry.id === 'fullscreen-map-warp'
        ? entry.getSheet()
        : entry.getContainer();
    if (target) {
      observer.observe(target, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
      });
    }
  }
}
