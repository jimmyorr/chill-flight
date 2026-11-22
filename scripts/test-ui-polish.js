// Headless Chrome UI polish & native Capacitor shell regression suite.
// Runs in a single browser instance across two sequential isolated contexts
// (one web tab, then one native-bridged tab) so software WebGL memory stays
// bounded on 2-vCPU CI/cloud machines.
//
// Usage:
//   npm run test:ui  (requires `npm run dev` on port 5173, or GAME_URL=...)
import assert from 'node:assert/strict';
import {BASE, GL_ARGS, launch} from './dev-browser.js';

const TEST_SEED = '20260101';
const LOAD_TIMEOUT_MS = 150000;
const origin = new URL(BASE).origin;

for (let attempt = 1; ; attempt++) {
  try {
    await fetch(BASE);
    break;
  } catch {
    if (attempt === 10) {
      console.error(
        `Dev server not reachable at ${BASE}. Run \`npm run dev\`.`
      );
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function interceptThirdParty(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (
      !u.startsWith(origin) &&
      /google-analytics|analytics\.google|googletagmanager|firebaseinstallations|firebaselogging|r2\.dev/.test(
        u
      )
    ) {
      req.abort('blockedbyclient').catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
}

async function settleAnimations(page) {
  await page.evaluate(async () => {
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    );
    await Promise.all(
      document
        .getAnimations()
        .filter((a) =>
          Number.isFinite(a.effect?.getComputedTiming?.().iterations)
        )
        .map((a) => a.finished.catch(() => {}))
    );
  });
  await wait(40);
}

async function runWebPolishPass(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
      errors.push(`console.error: ${text}`);
    }
  });

  try {
    await interceptThirdParty(page);
    await page.setViewport({width: 640, height: 480});
    await page.goto(
      `${BASE}?preset=low&seed=${TEST_SEED}&xmas=off&start=1&music=0&hints=0`,
      {waitUntil: 'domcontentloaded', timeout: 45000}
    );
    await page.waitForFunction(
      () => {
        const el = document.getElementById('loading-overlay');
        return Boolean(el && getComputedStyle(el).display === 'none');
      },
      {timeout: LOAD_TIMEOUT_MS, polling: 200}
    );
    await wait(250);

    // 1. WCAG AA contrast tokens in both Dark and Light themes
    await page.keyboard.press('Escape');
    await settleAnimations(page);

    for (const theme of ['dark', 'light']) {
      const ratios = await page.evaluate((mode) => {
        document.querySelector('.pause-tab[data-tab="settings"]').click();
        document
          .querySelector(`#appearance-group [data-appearance="${mode}"]`)
          .click();

        const parseColor = (raw) => {
          const s = raw.trim();
          if (s.startsWith('#')) {
            const hex =
              s.length === 4
                ? s
                    .slice(1)
                    .split('')
                    .map((c) => c + c)
                    .join('')
                : s.slice(1);
            return [
              parseInt(hex.slice(0, 2), 16),
              parseInt(hex.slice(2, 4), 16),
              parseInt(hex.slice(4, 6), 16),
              1,
            ];
          }
          const m = s.match(/rgba?\(([^)]+)\)/);
          if (!m) throw new Error(`Cannot parse color: ${raw}`);
          const parts = m[1].split(',').map((x) => parseFloat(x.trim()));
          return [parts[0], parts[1], parts[2], parts[3] ?? 1];
        };

        const blend = (fg, bg) => {
          const a = fg[3];
          return [
            fg[0] * a + bg[0] * (1 - a),
            fg[1] * a + bg[1] * (1 - a),
            fg[2] * a + bg[2] * (1 - a),
            1,
          ];
        };

        const lum = ([r, g, b]) => {
          const ch = (v) => {
            const n = v / 255;
            return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
        };

        const contrast = (c1, c2) => {
          const l1 = lum(c1);
          const l2 = lum(c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };

        const cs = getComputedStyle(document.documentElement);
        const token = (name) => parseColor(cs.getPropertyValue(name));
        const appBg = token('--app-bg');
        const cardBg = blend(token('--surface-card'), appBg);
        const elevBg = blend(token('--surface-elevated'), cardBg);
        const accentSoftBg = blend(token('--accent-soft-bg'), elevBg);
        const dangerBg = blend(token('--danger-bg'), cardBg);
        const hudIdleA = token('--hud-bg-idle-a');
        const hudIdleB = token('--hud-bg-idle-b');
        const hudIdleAlpha = (hudIdleA[3] + hudIdleB[3]) / 2;
        const hudIdleGlass = [
          (hudIdleA[0] + hudIdleB[0]) / 2,
          (hudIdleA[1] + hudIdleB[1]) / 2,
          (hudIdleA[2] + hudIdleB[2]) / 2,
          hudIdleAlpha,
        ];
        const brightDaySky = [175, 218, 244, 1];
        const hudDayPanel = blend(hudIdleGlass, brightDaySky);
        const hudLabel = token('--hud-label-fg');
        const hudIdleTextOpacity =
          parseFloat(cs.getPropertyValue('--hud-idle-text-opacity')) || 1;
        const hudIdleLabel = [
          hudLabel[0],
          hudLabel[1],
          hudLabel[2],
          hudLabel[3] * hudIdleTextOpacity,
        ];
        const cockpitGridShadow = getComputedStyle(
          document.querySelector('.cockpit-grid')
        ).textShadow;

        return {
          resolved: document.documentElement.dataset.theme,
          hudIdleAlpha,
          hudIdleLabelOnDaySky: contrast(
            blend(hudIdleLabel, hudDayPanel),
            hudDayPanel
          ),
          hasCockpitTextShadow: Boolean(
            cockpitGridShadow && cockpitGridShadow !== 'none'
          ),
          primaryOnCard: contrast(
            blend(token('--text-primary'), cardBg),
            cardBg
          ),
          secondaryOnCard: contrast(
            blend(token('--text-secondary'), cardBg),
            cardBg
          ),
          mutedOnCard: contrast(blend(token('--text-muted'), cardBg), cardBg),
          accentOnTab: contrast(
            blend(token('--accent-fg'), accentSoftBg),
            accentSoftBg
          ),
          linkOnCard: contrast(blend(token('--link-fg'), cardBg), cardBg),
          dangerOnBtn: contrast(
            blend(token('--danger-fg'), dangerBg),
            dangerBg
          ),
          borderOnCard: contrast(
            blend(token('--border-control'), cardBg),
            cardBg
          ),
        };
      }, theme);

      assert.equal(ratios.resolved, theme);
      assert.ok(
        ratios.primaryOnCard >= 4.5,
        `[${theme}] --text-primary contrast ${ratios.primaryOnCard.toFixed(2)} < 4.5`
      );
      assert.ok(
        ratios.secondaryOnCard >= 4.5,
        `[${theme}] --text-secondary contrast ${ratios.secondaryOnCard.toFixed(2)} < 4.5`
      );
      assert.ok(
        ratios.mutedOnCard >= 4.5,
        `[${theme}] --text-muted contrast ${ratios.mutedOnCard.toFixed(2)} < 4.5`
      );
      assert.ok(
        ratios.accentOnTab >= 4.5,
        `[${theme}] --accent-fg contrast ${ratios.accentOnTab.toFixed(2)} < 4.5`
      );
      assert.ok(
        ratios.linkOnCard >= 4.5,
        `[${theme}] --link-fg contrast ${ratios.linkOnCard.toFixed(2)} < 4.5`
      );
      assert.ok(
        ratios.dangerOnBtn >= 4.5,
        `[${theme}] --danger-fg contrast ${ratios.dangerOnBtn.toFixed(2)} < 4.5`
      );
      assert.ok(
        ratios.borderOnCard >= 3.0,
        `[${theme}] --border-control contrast ${ratios.borderOnCard.toFixed(2)} < 3.0`
      );
      assert.ok(
        ratios.hudIdleAlpha >= 0.4 && ratios.hudIdleAlpha <= 0.65,
        `[${theme}] idle HUD glass alpha ${ratios.hudIdleAlpha.toFixed(2)} outside translucent [0.40, 0.65] range`
      );
      assert.ok(
        ratios.hudIdleLabelOnDaySky >= 2.4,
        `[${theme}] idle HUD label daylight contrast ${ratios.hudIdleLabelOnDaySky.toFixed(2)} < 2.4`
      );
      assert.equal(ratios.hasCockpitTextShadow, true);
    }

    await page.evaluate(() =>
      document
        .querySelector('#appearance-group [data-appearance="dark"]')
        .click()
    );

    // 2. Multi-viewport fit + fixed Pause height across tabs & Music toggle
    for (const vp of [
      {label: 'desktop-tall', width: 1440, height: 900},
      {label: 'desktop-720p', width: 1280, height: 720},
      {label: 'mobile-portrait', width: 375, height: 667},
      {label: 'mobile-compact', width: 320, height: 568},
      {label: 'mobile-landscape', width: 667, height: 375},
    ]) {
      await page.setViewport({width: vp.width, height: vp.height});
      await settleAnimations(page);

      const layout = await page.evaluate(async () => {
        const box = document.querySelector('#pause-overlay .customization-box');
        const snap = () => {
          const r = box.getBoundingClientRect();
          return {
            top: Math.round(r.top * 10) / 10,
            height: Math.round(r.height * 10) / 10,
            left: Math.round(r.left * 10) / 10,
            right: Math.round(r.right * 10) / 10,
            bottom: Math.round(r.bottom * 10) / 10,
          };
        };

        document.querySelector('.pause-tab[data-tab="flight"]').click();
        await new Promise((r) => requestAnimationFrame(r));
        const music = document.getElementById('music-toggle-input');
        if (music.checked) music.click();
        await new Promise((r) => requestAnimationFrame(r));
        const flightOff = snap();

        music.click();
        await new Promise((r) => requestAnimationFrame(r));
        const flightOn = snap();

        document.querySelector('.pause-tab[data-tab="settings"]').click();
        const settingsPanel = document.getElementById('pause-panel-settings');
        settingsPanel.scrollTop = 0;
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r))
        );
        const settingsOn = snap();
        const wrap = document.querySelector('#pause-overlay .pause-panels');
        const settingsOverflows =
          settingsPanel.scrollHeight - settingsPanel.clientHeight > 6;
        const cueAtTop = wrap.dataset.canScrollDown ?? null;
        let cueAtBottom = null;
        if (settingsOverflows) {
          settingsPanel.scrollTop = settingsPanel.scrollHeight;
          settingsPanel.dispatchEvent(new Event('scroll'));
          await new Promise((r) => requestAnimationFrame(r));
          cueAtBottom = wrap.dataset.canScrollDown ?? null;
          settingsPanel.scrollTop = 0;
          settingsPanel.dispatchEvent(new Event('scroll'));
        }

        music.click();
        await new Promise((r) => requestAnimationFrame(r));
        const settingsOff = snap();

        document.getElementById('fly-tab').click();
        await new Promise((r) => requestAnimationFrame(r));
        const together = snap();

        return {
          vw: window.innerWidth,
          vh: window.innerHeight,
          docScrollW: document.documentElement.scrollWidth,
          flightOff,
          flightOn,
          settingsOn,
          settingsOff,
          together,
          settingsOverflows,
          cueAtTop,
          cueAtBottom,
          inert: {
            flight: document.getElementById('pause-panel-flight').inert,
            settings: document.getElementById('pause-panel-settings').inert,
            together: document.getElementById('pause-panel-together').inert,
          },
        };
      });

      assert.ok(
        layout.docScrollW <= layout.vw + 1,
        `[${vp.label}] horizontal overflow ${layout.docScrollW} > ${layout.vw}`
      );
      assert.ok(
        layout.flightOff.left >= -0.5 &&
          layout.flightOff.right <= layout.vw + 0.5 &&
          layout.flightOff.top >= 0 &&
          layout.flightOff.bottom <= layout.vh + 0.5,
        `[${vp.label}] pause box out of viewport: ${JSON.stringify(layout.flightOff)}`
      );
      assert.deepEqual(
        layout.flightOn,
        layout.flightOff,
        `[${vp.label}] Music toggle bounced Flight tab`
      );
      assert.deepEqual(
        layout.settingsOn,
        layout.settingsOff,
        `[${vp.label}] Music toggle bounced Settings tab`
      );
      assert.equal(
        layout.flightOff.height,
        layout.settingsOff.height,
        `[${vp.label}] Flight vs Settings height changed (${layout.flightOff.height} vs ${layout.settingsOff.height})`
      );
      assert.equal(
        layout.settingsOff.height,
        layout.together.height,
        `[${vp.label}] Settings vs Together height changed (${layout.settingsOff.height} vs ${layout.together.height})`
      );
      assert.deepEqual(layout.inert, {
        flight: true,
        settings: true,
        together: false,
      });
      if (
        vp.label === 'desktop-tall' ||
        vp.label === 'desktop-720p' ||
        vp.label === 'mobile-portrait'
      ) {
        assert.equal(
          layout.settingsOverflows,
          false,
          `[${vp.label}] Settings should fit without scrolling`
        );
        assert.equal(layout.cueAtTop, null);
      }
      if (layout.settingsOverflows) {
        assert.equal(
          layout.cueAtTop,
          'true',
          `[${vp.label}] overflowing Settings must show scroll cue at top`
        );
        assert.equal(
          layout.cueAtBottom,
          null,
          `[${vp.label}] scroll cue must clear when scrolled to bottom`
        );
      }
    }

    // 3. Mobile portrait bottom-sheet physics & zero-latency [data-pressed]
    await page.setViewport({width: 375, height: 667});
    await settleAnimations(page);

    const sheetPhysics = await page.evaluate(async () => {
      document.querySelector('.pause-tab[data-tab="flight"]').click();
      const resumeBtn = document.getElementById('resume-btn');
      const tabsEl = document.querySelector('#pause-overlay .pause-tabs');
      const resumeRect = resumeBtn.getBoundingClientRect();
      const tabsRect = tabsEl.getBoundingClientRect();

      resumeBtn.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          button: 0,
          pointerType: 'mouse',
          clientX: resumeRect.left + resumeRect.width / 2,
          clientY: resumeRect.top + resumeRect.height / 2,
          bubbles: true,
        })
      );
      const pressedDuringDown = resumeBtn.dataset.pressed;
      resumeBtn.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 1,
          button: 0,
          pointerType: 'mouse',
          bubbles: true,
        })
      );
      const pressedAfterUp = resumeBtn.dataset.pressed ?? null;

      // Upward or downward swipe on Pause body (.pause-panels) must NOT move
      // customization-box, and must clear [data-pressed] once past 10px slop
      const pauseBox = document.querySelector(
        '#pause-overlay .customization-box'
      );
      const zenRow = document.querySelector('label[for="zen-toggle-input"]');
      const zr = zenRow.getBoundingClientRect();
      const zx = zr.left + zr.width / 2;
      const zy = zr.top + zr.height / 2;
      zenRow.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 4,
          button: 0,
          pointerType: 'mouse',
          clientX: zx,
          clientY: zy,
          bubbles: true,
        })
      );
      const rowPressedInitially = zenRow.dataset.pressed;
      zenRow.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 4,
          button: 0,
          pointerType: 'mouse',
          clientX: zx,
          clientY: zy - 80,
          bubbles: true,
          cancelable: true,
        })
      );
      const pauseTransformOnUpSwipe = pauseBox.style.transform;
      const rowPressedAfterUpSwipe = zenRow.dataset.pressed ?? null;
      zenRow.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 4,
          button: 0,
          pointerType: 'mouse',
          clientX: zx,
          clientY: zy - 80,
          bubbles: true,
        })
      );

      // Downward touch drag on .pause-panels body must also leave Pause sheet untouched
      const touchObj = (y) =>
        new Touch({
          identifier: 11,
          target: zenRow,
          clientX: zx,
          clientY: y,
        });
      zenRow.dispatchEvent(
        new TouchEvent('touchstart', {
          touches: [touchObj(zy)],
          changedTouches: [touchObj(zy)],
          bubbles: true,
        })
      );
      zenRow.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [touchObj(zy + 90)],
          changedTouches: [touchObj(zy + 90)],
          bubbles: true,
          cancelable: true,
        })
      );
      const pauseTransformOnBodyDownSwipe = pauseBox.style.transform;
      zenRow.dispatchEvent(
        new TouchEvent('touchend', {
          touches: [],
          changedTouches: [touchObj(zy + 90)],
          bubbles: true,
          cancelable: true,
        })
      );

      document.querySelector('.pause-tab[data-tab="settings"]').click();
      document.getElementById('language-picker-btn').click();
      return {
        pressedDuringDown,
        pressedAfterUp,
        closeInlineWithTabs:
          resumeRect.left >= tabsRect.right - 1 &&
          Math.abs(resumeRect.top - tabsRect.top) <= 2,
        closeSizeMatch: Math.abs(resumeRect.height - tabsRect.height) <= 2,
        closeHeight: resumeRect.height,
        rowPressedInitially,
        rowPressedAfterUpSwipe,
        pauseTransformOnUpSwipe,
        pauseTransformOnBodyDownSwipe,
      };
    });
    assert.equal(sheetPhysics.pressedDuringDown, 'true');
    assert.equal(sheetPhysics.pressedAfterUp, null);
    assert.equal(
      sheetPhysics.closeInlineWithTabs,
      true,
      'expected top-right #resume-btn (X) inline beside .pause-tabs'
    );
    assert.equal(
      sheetPhysics.closeSizeMatch,
      true,
      'expected #resume-btn height to match .pause-tabs'
    );
    assert.ok(
      sheetPhysics.closeHeight >= 38,
      `expected #resume-btn height >= 38px, got ${sheetPhysics.closeHeight}`
    );
    assert.equal(sheetPhysics.rowPressedInitially, 'true');
    assert.equal(
      sheetPhysics.rowPressedAfterUpSwipe,
      null,
      'expected [data-pressed] to clear once finger moves > 10px'
    );
    assert.equal(
      sheetPhysics.pauseTransformOnUpSwipe,
      '',
      'upward swipe on Pause menu body must not lift customization-box'
    );
    assert.equal(
      sheetPhysics.pauseTransformOnBodyDownSwipe,
      '',
      'downward swipe on Pause menu controls body must not drag customization-box'
    );

    await settleAnimations(page);

    const dragResult = await page.evaluate(async () => {
      const grabber = document.querySelector(
        '#language-overlay .sheet-grabber'
      );
      const sheet = document.querySelector(
        '#language-overlay .achievements-content'
      );
      const r = grabber.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      // Upward drag on grabber also keeps bottom-anchored sheet planted at 0px
      grabber.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 2,
          button: 0,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy,
          bubbles: true,
        })
      );
      grabber.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 2,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy - 5,
          bubbles: true,
          cancelable: true,
        })
      );
      grabber.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 2,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy - 95,
          bubbles: true,
          cancelable: true,
        })
      );
      const upwardGrabberTransform = sheet.style.transform;
      grabber.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 2,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy - 95,
          bubbles: true,
        })
      );
      await new Promise((res) => setTimeout(res, 120));
      const stillOpenAfterUpward =
        getComputedStyle(document.getElementById('language-overlay'))
          .display !== 'none';

      // Fast downward flick -> velocity dismiss
      grabber.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 3,
          button: 0,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy,
          bubbles: true,
        })
      );
      grabber.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 3,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy + 6,
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise((res) => setTimeout(res, 24));
      grabber.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 3,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy + 70,
          bubbles: true,
          cancelable: true,
        })
      );
      grabber.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 3,
          pointerType: 'mouse',
          clientX: cx,
          clientY: cy + 70,
          bubbles: true,
        })
      );
      await new Promise((res) => setTimeout(res, 280));
      const closedAfterFlick =
        getComputedStyle(document.getElementById('language-overlay'))
          .display === 'none';

      // Downward flick on Pause sheet grabber dismisses Pause and resumes flight
      const pauseGrabber = document.querySelector(
        '#pause-overlay .sheet-grabber'
      );
      const pr = pauseGrabber.getBoundingClientRect();
      const px = pr.left + pr.width / 2;
      const py = pr.top + pr.height / 2;
      pauseGrabber.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 5,
          button: 0,
          pointerType: 'mouse',
          clientX: px,
          clientY: py,
          bubbles: true,
        })
      );
      pauseGrabber.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 5,
          pointerType: 'mouse',
          clientX: px,
          clientY: py + 8,
          bubbles: true,
          cancelable: true,
        })
      );
      await new Promise((res) => setTimeout(res, 24));
      pauseGrabber.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 5,
          pointerType: 'mouse',
          clientX: px,
          clientY: py + 80,
          bubbles: true,
          cancelable: true,
        })
      );
      pauseGrabber.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 5,
          pointerType: 'mouse',
          clientX: px,
          clientY: py + 80,
          bubbles: true,
        })
      );
      await new Promise((res) => setTimeout(res, 280));
      const pauseClosedAfterFlick =
        getComputedStyle(document.getElementById('pause-overlay')).display ===
        'none';

      return {
        upwardGrabberTransform,
        stillOpenAfterUpward,
        closedAfterFlick,
        pauseClosedAfterFlick,
      };
    });

    assert.equal(dragResult.upwardGrabberTransform, '');
    assert.equal(dragResult.stillOpenAfterUpward, true);
    assert.equal(dragResult.closedAfterFlick, true);
    assert.equal(dragResult.pauseClosedAfterFlick, true);

    // Reopen Pause for subsequent ARIA checks
    await page.keyboard.press('Escape');
    await settleAnimations(page);

    // 4. WAI-ARIA roving tabindex, modal inert stack, Tab trap, & focus return
    await page.evaluate(() => {
      const flightTab = document.getElementById('pause-tab-flight');
      flightTab.click();
      flightTab.focus();
    });
    await page.keyboard.press('ArrowRight');
    const afterArrowRight = await page.evaluate(() => ({
      activeId: document.activeElement?.id,
      settingsSelected: document
        .getElementById('pause-tab-settings')
        .getAttribute('aria-selected'),
      flightTabIndex: document.getElementById('pause-tab-flight').tabIndex,
      settingsTabIndex: document.getElementById('pause-tab-settings').tabIndex,
      cockpitInert: document.getElementById('cockpit-ui').inert,
    }));
    assert.equal(afterArrowRight.activeId, 'pause-tab-settings');
    assert.equal(afterArrowRight.settingsSelected, 'true');
    assert.equal(afterArrowRight.flightTabIndex, -1);
    assert.equal(afterArrowRight.settingsTabIndex, 0);
    assert.equal(afterArrowRight.cockpitInert, true);

    await page.keyboard.press('Home');
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'pause-tab-flight'
    );

    // Open Achievements via keyboard -> verify Pause becomes inert, Tab wraps, Escape restores focus
    await page.evaluate(() =>
      document.getElementById('achievements-btn').focus()
    );
    await page.keyboard.press('Enter');
    await settleAnimations(page);

    const modalStackState = await page.evaluate(() => ({
      pauseInert: document.getElementById('pause-overlay').inert,
      achInert: document.getElementById('achievements-overlay').inert,
      focusedInAch: document
        .getElementById('achievements-overlay')
        .contains(document.activeElement),
    }));
    assert.equal(modalStackState.pauseInert, true);
    assert.equal(modalStackState.achInert, false);
    assert.equal(modalStackState.focusedInAch, true);

    await page.evaluate(() =>
      document.getElementById('achievements-reset-btn').focus()
    );
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'achievements-close-btn',
      'Tab at end of Achievements dialog should wrap to close button'
    );

    await page.keyboard.press('Escape');
    await wait(60);
    assert.equal(
      await page.evaluate(() => document.activeElement?.id),
      'achievements-btn',
      'Closing Achievements via Escape should return focus to #achievements-btn'
    );

    // Desktop Escape on Settings tab closes Pause directly in a single press
    await page.evaluate(() =>
      document.getElementById('pause-tab-settings').click()
    );
    await page.keyboard.press('Escape');
    await wait(60);
    assert.equal(
      await page.evaluate(
        () =>
          getComputedStyle(document.getElementById('pause-overlay')).display ===
          'none'
      ),
      true,
      'Desktop Escape on Settings tab should close Pause directly'
    );
    await page.keyboard.press('Escape');
    await settleAnimations(page);

    // 5. Strict prefers-reduced-motion: reduce
    await page.emulateMediaFeatures([
      {name: 'prefers-reduced-motion', value: 'reduce'},
    ]);
    const reducedMotion = await page.evaluate(() => {
      const tab = document.getElementById('pause-tab-flight');
      const dur = parseFloat(getComputedStyle(tab).transitionDuration) || 0;
      tab.dataset.pressed = 'true';
      const pressedScale = getComputedStyle(tab).scale;
      delete tab.dataset.pressed;
      return {dur, pressedScale};
    });
    assert.ok(
      reducedMotion.dur <= 0.001,
      `expected reduced-motion transitionDuration <= 0.001s, got ${reducedMotion.dur}`
    );
    assert.equal(reducedMotion.pressedScale, '1');

    // 6. Standalone PWA metadata & mobile full-height canvas / HUD safe-area bounds
    const pwaLayout = await page.evaluate(async () => {
      const statusBarMeta = document.querySelector(
        'meta[name="apple-mobile-web-app-status-bar-style"]'
      );
      const legacyCapableMeta = document.querySelector(
        'meta[name="apple-mobile-web-app-capable"]'
      );
      const viewportMeta =
        document
          .querySelector('meta[name="viewport"]')
          ?.getAttribute('content') || '';
      const manifestLinks = document.querySelectorAll('link[rel="manifest"]');
      const manifestRes = await fetch(
        manifestLinks[0]?.href || 'manifest.json'
      );
      const manifest = await manifestRes.json();
      const canvasRect = document
        .querySelector('body > canvas')
        .getBoundingClientRect();
      const hudEl = document.getElementById('cockpit-ui');
      const hudRect = hudEl.getBoundingClientRect();
      const hudStyle = getComputedStyle(hudEl);
      const controlsRect = document
        .getElementById('mobile-controls')
        .getBoundingClientRect();
      const pauseVersionText =
        document.querySelector('.pause-footer .version-tag')?.textContent || '';
      return {
        hasTranslucentStatusBarMeta: Boolean(statusBarMeta),
        hasLegacyAppleCapableMeta: Boolean(legacyCapableMeta),
        viewportFitCover: viewportMeta.includes('viewport-fit=cover'),
        hasUserScalableNo: viewportMeta.includes('user-scalable=no'),
        manifestCount: manifestLinks.length,
        manifestDisplay: manifest.display,
        manifestThemeColor: manifest.theme_color,
        manifestBgColor: manifest.background_color,
        vw: window.innerWidth,
        vh: window.innerHeight,
        canvasTop: canvasRect.top,
        canvasBottom: canvasRect.bottom,
        canvasWidth: canvasRect.width,
        hudTop: hudRect.top,
        hudPadTop: parseFloat(hudStyle.paddingTop),
        hudPadBottom: parseFloat(hudStyle.paddingBottom),
        controlsBottomGap: Math.round(window.innerHeight - controlsRect.bottom),
        pauseVersionText,
        expectedHash: window.__COMMIT_HASH__ || '',
        expectedDirty: Boolean(window.__IS_DIRTY__),
      };
    });
    assert.equal(
      pwaLayout.hasTranslucentStatusBarMeta,
      false,
      'apple-mobile-web-app-status-bar-style must stay omitted (WebKit Bug 301994)'
    );
    assert.equal(
      pwaLayout.hasLegacyAppleCapableMeta,
      false,
      'legacy apple-mobile-web-app-capable must stay omitted so manifest standalone applies cleanly'
    );
    assert.equal(pwaLayout.viewportFitCover, true);
    assert.equal(pwaLayout.hasUserScalableNo, false);
    assert.equal(pwaLayout.manifestCount, 1);
    assert.equal(pwaLayout.manifestDisplay, 'standalone');
    assert.equal(pwaLayout.manifestThemeColor, '#0b0f19');
    assert.equal(pwaLayout.manifestBgColor, '#0b0f19');
    assert.equal(pwaLayout.canvasTop, 0);
    assert.equal(pwaLayout.canvasBottom, pwaLayout.vh);
    assert.equal(pwaLayout.canvasWidth, pwaLayout.vw);
    assert.equal(pwaLayout.hudTop, 0);
    assert.equal(pwaLayout.hudPadTop, pwaLayout.hudPadBottom);
    assert.equal(pwaLayout.controlsBottomGap, 16);
    if (pwaLayout.expectedHash && pwaLayout.expectedHash !== 'unknown') {
      const expectedSuffix = `(${pwaLayout.expectedHash}${pwaLayout.expectedDirty ? '*' : ''})`;
      assert.ok(
        pwaLayout.pauseVersionText.includes(expectedSuffix),
        `expected Pause version "${pwaLayout.pauseVersionText}" to include "${expectedSuffix}"`
      );
    }

    assert.deepEqual(errors, []);
    console.log(
      '  ui-polish (web): contrast, viewports, fixed-height tabs, sheets, ARIA, PWA layout ok'
    );
  } finally {
    await context.close();
  }
}

async function runNativePolishPass(browser) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('ERR_BLOCKED_BY_CLIENT')) {
      errors.push(`console.error: ${text}`);
    }
  });

  try {
    await interceptThirdParty(page);
    await page.evaluateOnNewDocument(() => {
      const calls = {statusBar: [], haptics: [], app: [], listeners: {}};
      window.__capCalls = calls;
      window.androidBridge = {};
      window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        PluginHeaders: [
          {
            name: 'App',
            methods: [
              {name: 'addListener'},
              {name: 'removeListener'},
              {name: 'exitApp', rtype: 'promise'},
            ],
          },
          {
            name: 'StatusBar',
            methods: [
              {name: 'setOverlaysWebView', rtype: 'promise'},
              {name: 'setBackgroundColor', rtype: 'promise'},
              {name: 'setStyle', rtype: 'promise'},
              {name: 'show', rtype: 'promise'},
              {name: 'hide', rtype: 'promise'},
            ],
          },
          {
            name: 'Haptics',
            methods: [
              {name: 'impact', rtype: 'promise'},
              {name: 'notification', rtype: 'promise'},
              {name: 'selectionStart', rtype: 'promise'},
              {name: 'selectionChanged', rtype: 'promise'},
              {name: 'selectionEnd', rtype: 'promise'},
            ],
          },
          {
            name: 'Device',
            methods: [{name: 'getInfo', rtype: 'promise'}],
          },
        ],
        nativePromise: (plugin, method, options) => {
          if (plugin === 'StatusBar') calls.statusBar.push({method, options});
          else if (plugin === 'Haptics') calls.haptics.push({method, options});
          else if (plugin === 'App') calls.app.push({method, options});
          else if (plugin === 'Device' && method === 'getInfo') {
            return Promise.resolve({platform: 'android', model: 'Pixel 8'});
          }
          return Promise.resolve({});
        },
        nativeCallback: (plugin, method, options, cb) => {
          if (method === 'addListener' && options?.eventName) {
            const key = `${plugin}:${options.eventName}`;
            calls.listeners[key] = calls.listeners[key] || [];
            calls.listeners[key].push(cb);
            return `${key}-1`;
          }
          return '0';
        },
      };
      window.__triggerNativeBack = () => {
        for (const cb of calls.listeners['App:backButton'] || []) {
          cb({canGoBack: false});
        }
      };
    });

    await page.setViewport({
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    await page.goto(
      `${BASE}?preset=low&seed=${TEST_SEED}&xmas=off&uiTheme=light&music=0&hints=0`,
      {waitUntil: 'domcontentloaded', timeout: 45000}
    );

    await page.waitForFunction(
      () => Boolean(window.__capCalls?.listeners?.['App:backButton']?.length),
      {timeout: 30000}
    );

    // 1. Launch #0b0f19 chrome, StatusBar edge-to-edge sync, & splash Back exitApp()
    const splashState = await page.evaluate(async () => {
      const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
      const metaColor = document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content');
      window.__triggerNativeBack();
      await new Promise((r) => setTimeout(r, 20));
      return {
        htmlBg,
        metaColor,
        statusBar: window.__capCalls.statusBar.slice(),
        app: window.__capCalls.app.slice(),
      };
    });

    assert.equal(splashState.htmlBg, 'rgb(11, 15, 25)');
    assert.equal(splashState.metaColor, '#0b0f19');
    assert.ok(
      splashState.statusBar.some(
        (c) => c.method === 'setOverlaysWebView' && c.options?.overlay === true
      )
    );
    assert.ok(
      splashState.statusBar.some(
        (c) =>
          c.method === 'setBackgroundColor' && c.options?.color === '#00000000'
      )
    );
    assert.equal(
      splashState.statusBar.filter((c) => c.method === 'setStyle').at(-1)
        ?.options?.style,
      'DARK'
    );
    assert.ok(splashState.app.some((c) => c.method === 'exitApp'));

    await page.waitForFunction(
      () => {
        const el = document.getElementById('loading-overlay');
        return Boolean(
          el && (el.style.opacity === '0' || el.style.display === 'none')
        );
      },
      {timeout: LOAD_TIMEOUT_MS, polling: 200}
    );
    await wait(200);

    const postSplash = await page.evaluate(() => ({
      metaColor: document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content'),
      style: window.__capCalls.statusBar
        .filter((c) => c.method === 'setStyle')
        .at(-1)?.options?.style,
    }));
    assert.equal(postSplash.metaColor, '#0b0f19');
    assert.equal(postSplash.style, 'DARK');

    // 2. Full LIFO Back stack + StatusBar theme toggle + UI notification/impact/selection haptics
    await page.evaluate(async () => {
      const flush = () => new Promise((r) => setTimeout(r, 25));
      const isVisible = (id) => {
        const el = document.getElementById(id);
        return Boolean(
          el && !el.hidden && getComputedStyle(el).display !== 'none'
        );
      };
      const activeTab = () =>
        document.querySelector('#pause-overlay .pause-tab.active')?.dataset.tab;

      const exitsBefore = window.__capCalls.app.filter(
        (c) => c.method === 'exitApp'
      ).length;
      window.__triggerNativeBack();
      if (!isVisible('pause-overlay')) {
        throw new Error('Back in flight did not open Pause');
      }
      if (
        window.__capCalls.app.filter((c) => c.method === 'exitApp').length !==
        exitsBefore
      ) {
        throw new Error('Back in flight called exitApp');
      }
      await flush();
      const pauseLightMeta = document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content');
      const pauseLightStyle = window.__capCalls.statusBar
        .filter((c) => c.method === 'setStyle')
        .at(-1)?.options?.style;
      if (pauseLightMeta !== '#f4f7fb' || pauseLightStyle !== 'LIGHT') {
        throw new Error(
          `Expected light chrome on Pause in Light Mode, got meta=${pauseLightMeta} style=${pauseLightStyle}`
        );
      }

      document.querySelector('.pause-tab[data-tab="settings"]').click();
      const hapticsInput = document.getElementById('haptics-input');
      if (!hapticsInput.checked) {
        hapticsInput.checked = true;
        hapticsInput.dispatchEvent(new Event('change', {bubbles: true}));
      }
      await flush();
      window.__capCalls.haptics.length = 0;

      document
        .querySelector('#appearance-group [data-appearance="dark"]')
        .click();
      await flush();
      const darkStyle = window.__capCalls.statusBar
        .filter((c) => c.method === 'setStyle')
        .at(-1)?.options?.style;
      if (darkStyle !== 'DARK') {
        throw new Error(`Expected DARK StatusBar style, got ${darkStyle}`);
      }
      if (
        !window.__capCalls.haptics.some((h) => h.method === 'selectionChanged')
      ) {
        throw new Error(
          'Appearance segment tap missed selectionChanged haptic'
        );
      }

      document.getElementById('language-picker-btn').click();
      if (!isVisible('language-overlay')) {
        throw new Error('Language sheet did not open');
      }
      window.__triggerNativeBack();
      if (isVisible('language-overlay') || !isVisible('pause-overlay')) {
        throw new Error('Back did not close Language sheet cleanly');
      }

      window.__triggerNativeBack();
      if (activeTab() !== 'flight') {
        throw new Error('Back on Settings did not return to Flight tab');
      }

      // Chronological LIFO sub-sheet order + armed reset disarm
      document.getElementById('people-btn').click();
      document.getElementById('achievements-btn').click();
      await flush();
      window.__capCalls.haptics.length = 0;
      document.getElementById('achievements-reset-btn').click();
      await flush();
      if (
        !window.__capCalls.haptics.some(
          (h) => h.method === 'notification' && h.options?.type === 'WARNING'
        )
      ) {
        throw new Error('Arming reset missed WARNING haptic');
      }
      window.__triggerNativeBack();
      if (
        document
          .getElementById('achievements-reset-btn')
          .classList.contains('confirming') ||
        !isVisible('achievements-overlay')
      ) {
        throw new Error('Back did not disarm CONFIRM RESET? in place');
      }
      window.__triggerNativeBack();
      if (isVisible('achievements-overlay') || !isVisible('people-overlay')) {
        throw new Error(
          'LIFO failed: expected Achievements closed, People open'
        );
      }
      window.__triggerNativeBack();
      if (isVisible('people-overlay') || !isVisible('pause-overlay')) {
        throw new Error('LIFO failed: expected People closed, Pause open');
      }

      // Pause-opened map -> Enter places pin (LIGHT haptic) -> Back clears pin -> Back returns to Pause
      document.getElementById('pause-map-btn').click();
      await flush();
      window.__capCalls.haptics.length = 0;
      const mapCanvas = document.getElementById('fullscreen-map-canvas');
      mapCanvas.focus();
      window.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Enter', bubbles: true})
      );
      await flush();
      if (document.getElementById('fullscreen-map-warp').hidden) {
        throw new Error('Enter on map canvas did not place pin');
      }
      if (
        !window.__capCalls.haptics.some(
          (h) => h.method === 'impact' && h.options?.style === 'LIGHT'
        )
      ) {
        throw new Error('Map pin missed LIGHT impact haptic');
      }
      window.__triggerNativeBack();
      if (
        !document.getElementById('fullscreen-map-warp').hidden ||
        !isVisible('fullscreen-map-overlay')
      ) {
        throw new Error('First Back on map did not clear pin in place');
      }
      window.__triggerNativeBack();
      if (isVisible('fullscreen-map-overlay') || !isVisible('pause-overlay')) {
        throw new Error(
          'Second Back on pause-opened map did not return to Pause'
        );
      }

      // Together tab: invalid code ERROR haptic; Fly with bots stays on the
      // room, with the list and the games both in view (#192)
      document.getElementById('fly-tab').click();
      await flush();
      window.__capCalls.haptics.length = 0;
      document.getElementById('fly-code').value = 'X';
      document.getElementById('fly-join-btn').click();
      await flush();
      if (
        !window.__capCalls.haptics.some(
          (h) => h.method === 'notification' && h.options?.type === 'ERROR'
        )
      ) {
        throw new Error('Invalid room code missed ERROR haptic');
      }

      document.getElementById('fly-bots-btn').click();
      if (
        !isVisible('pause-overlay') ||
        activeTab() !== 'together' ||
        document.getElementById('fly-games-block').hidden ||
        document.getElementById('fly-room').hidden
      ) {
        throw new Error('Fly with bots did not stay on the room view');
      }
      window.__triggerNativeBack();
      if (activeTab() !== 'flight') {
        throw new Error('Back on Together did not return to Flight tab');
      }
      window.__triggerNativeBack();
      if (isVisible('pause-overlay')) {
        throw new Error('Back on Flight tab did not resume flight');
      }

      // Reopen Together, leave local bot room, and focus #fly-code for keyboard test
      window.__triggerNativeBack();
      document.getElementById('fly-tab').click();
      document.getElementById('fly-leave-btn').click();
      document.getElementById('fly-code').focus();
    });

    // 3. Compact 375x667 software keyboard handling (375x380 visible viewport)
    await page.setViewport({
      width: 375,
      height: 380,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    const kbCheck = await page.evaluate(async () => {
      const panel = document.getElementById('pause-panel-together');
      const code = document.getElementById('fly-code');
      const join = document.getElementById('fly-join-btn');
      const status = document.getElementById('fly-status');
      code.value = 'AB';
      join.click();
      code.focus();
      window.dispatchEvent(new Event('resize'));
      await new Promise((r) => setTimeout(r, 200));
      const pr = panel.getBoundingClientRect();
      const cr = code.getBoundingClientRect();
      const jr = join.getBoundingClientRect();
      const sr = status.getBoundingClientRect();

      const name = document.getElementById('fly-name');
      const invite = document.getElementById('fly-invite-btn');
      name.focus();
      await new Promise((r) => setTimeout(r, 200));
      const nr = name.getBoundingClientRect();
      const ir = invite.getBoundingClientRect();

      return {
        kbOpen: document.documentElement.dataset.kbOpen,
        codeClear:
          cr.top >= pr.top - 1 &&
          jr.bottom <= window.innerHeight &&
          sr.bottom <= window.innerHeight,
        nameClear: nr.top >= pr.top - 1 && ir.bottom <= window.innerHeight,
      };
    });
    assert.equal(kbCheck.kbOpen, 'true');
    assert.equal(kbCheck.codeClear, true);
    assert.equal(kbCheck.nameClear, true);

    // 4. Throttle drag stays silent (no continuous haptics) + quick-menu LIGHT impact + unlock SUCCESS notification
    await page.setViewport({
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await page.evaluate(() => {
      document.activeElement?.blur?.();
      document.getElementById('resume-btn').click();
    });
    await wait(120);

    const flightHaptics = await page.evaluate(async () => {
      const flush = () => new Promise((r) => setTimeout(r, 25));
      await flush();
      window.__capCalls.haptics.length = 0;

      const throttle = document.getElementById('throttle');
      const rect = throttle.getBoundingClientRect();
      throttle.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 9,
          clientX: rect.left + 10,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
        })
      );
      for (let i = 1; i <= 6; i++) {
        await new Promise((r) => setTimeout(r, 25));
        throttle.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerId: 9,
            clientX: rect.left + 10 + (rect.width - 20) * (i / 6),
            clientY: rect.top + rect.height / 2,
            bubbles: true,
          })
        );
      }
      throttle.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: 9,
          bubbles: true,
        })
      );
      await flush();
      const throttleMethods = window.__capCalls.haptics.map((h) => h.method);

      window.__capCalls.haptics.length = 0;
      document.getElementById('mobile-menu-trigger').click();
      // Unlock Night vision achievement via headlight button -> SUCCESS notification haptic
      document.getElementById('mobile-hdgt-sub').click();
      window.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})
      );
      await flush();
      const lightImpacts = window.__capCalls.haptics.filter(
        (h) => h.method === 'impact' && h.options?.style === 'LIGHT'
      ).length;
      const successNotifs = window.__capCalls.haptics.filter(
        (h) => h.method === 'notification' && h.options?.type === 'SUCCESS'
      ).length;

      return {throttleMethods, lightImpacts, successNotifs};
    });

    assert.deepEqual(
      flightHaptics.throttleMethods,
      [],
      'throttle drag must not tick haptics'
    );
    assert.ok(flightHaptics.lightImpacts >= 2);
    assert.equal(flightHaptics.successNotifs, 1);
    assert.deepEqual(errors, []);

    console.log(
      '  ui-polish (native): launch chrome, StatusBar sync, LIFO Back, keyboard, haptics ok'
    );
  } finally {
    await context.close();
  }
}

const browser = await launch({
  args: [...GL_ARGS, '--autoplay-policy=no-user-gesture-required'],
  protocolTimeout: 180000,
});

try {
  await runWebPolishPass(browser);
  await runNativePolishPass(browser);
  console.log('UI polish test passed.');
} finally {
  await browser.close();
}
