// Helpers for scripted looks at the running dev server (npm run dev, port
// 5173) in headless Chrome: screenshots (scripts/shot.js) and render
// benchmarks (scripts/bench-render.js).
//
// Pages open with ?start=1&ui=0&music=0 unless the query says otherwise: no
// Begin button, no HUD or panels over the view, and no music downloads.
import puppeteer from 'puppeteer-core';
import {execFileSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

export const BASE = process.env.GAME_URL || 'http://localhost:5173/';
const DEFAULT_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/lib/chromium/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
export const CHROME =
  process.env.CHROME_PATH ||
  DEFAULT_CHROME_PATHS.find((p) => fs.existsSync(p)) ||
  DEFAULT_CHROME_PATHS[0];

export function autoCloseOnExit(browser, onCleanup) {
  let closing = false;

  const killSync = () => {
    try {
      onCleanup?.();
    } catch {
      // Ignore errors during emergency cleanup.
    }
    try {
      const proc = browser.process();
      if (proc && proc.exitCode === null) {
        proc.kill('SIGKILL');
      }
    } catch {
      // Process may already be terminated.
    }
  };

  const handleSignal = async (signal) => {
    if (closing) {
      killSync();
      process.exit(1);
    }
    closing = true;
    try {
      try {
        onCleanup?.();
      } catch {
        // Ignore errors during emergency cleanup.
      }
      await Promise.race([
        browser.close(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } catch {
      // Ignore errors during emergency cleanup.
    } finally {
      killSync();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    }
  };

  const onSigInt = () => handleSignal('SIGINT');
  const onSigTerm = () => handleSignal('SIGTERM');
  const onSigHup = () => handleSignal('SIGHUP');
  const onExit = () => killSync();

  process.on('SIGINT', onSigInt);
  process.on('SIGTERM', onSigTerm);
  process.on('SIGHUP', onSigHup);
  process.once('exit', onExit);

  browser.once('disconnected', () => {
    process.removeListener('SIGINT', onSigInt);
    process.removeListener('SIGTERM', onSigTerm);
    process.removeListener('SIGHUP', onSigHup);
    process.removeListener('exit', onExit);
  });
}

// WebGL backend: the Mac's GPU through Metal, software SwiftShader elsewhere
// (cloud and CI have no GPU, and containers lack user namespaces for Chrome's
// sandbox). SwiftShader on a Mac keeps 3-4 cores busy.
export const GL_ARGS =
  process.platform === 'darwin'
    ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
    : [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ];

export function requireGpu(what) {
  if (process.platform !== 'darwin' && !process.env.ALLOW_SOFTWARE_GL) {
    console.error(
      `${what} needs a hardware GPU (macOS Metal). Run on a Mac, or set ALLOW_SOFTWARE_GL=1 to force software WebGL.`
    );
    process.exit(1);
  }
}

// Kill headless Chrome left running by an earlier run that was killed before
// it could close its browser (its Node parent is gone, so it now belongs to
// pid 1). Puppeteer gives every browser it launches a temporary profile
// named puppeteer_dev_chrome_profile-*, so a browser someone opened by hand,
// or one another run is still using, is never touched.
export function killOrphanedChrome() {
  if (process.platform === 'win32') return;
  let rows;
  try {
    rows = execFileSync('ps', ['-Ao', 'pid=,ppid=,command='], {
      encoding: 'utf8',
    });
  } catch {
    return;
  }
  let killed = 0;
  for (const row of rows.split('\n')) {
    const m = row.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (!m || m[2] !== '1' || !m[3].includes('puppeteer_dev_chrome_profile-'))
      continue;
    try {
      process.kill(Number(m[1]), 'SIGKILL');
      killed++;
    } catch {
      // Already gone.
    }
  }
  if (killed)
    console.log(`Closed ${killed} leftover headless Chrome process(es)`);
}

const DEFAULT_LOCK_FILE = path.join(os.tmpdir(), 'chill-flight-puppeteer.lock');
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM';
  }
}

// Serialize headless Chrome launches across processes so overlapping scripts or
// subagents cannot stack multiple WebGL + terrain-worker pools in RAM at once.
export async function acquireBrowserLock(
  lockFile = process.env.CHILL_FLIGHT_BROWSER_LOCK || DEFAULT_LOCK_FILE
) {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = `${process.pid} ${token}\n`;
  const started = Date.now();
  let loggedWait = false;

  for (;;) {
    try {
      fs.writeFileSync(lockFile, payload, {flag: 'wx'});
      let released = false;
      return () => {
        if (released) return;
        released = true;
        try {
          if (fs.readFileSync(lockFile, 'utf8') === payload) {
            fs.unlinkSync(lockFile);
          }
        } catch {
          // Lock file was already removed.
        }
      };
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
    }

    let holderPid = 0;
    let freshEmpty = false;
    try {
      const raw = fs.readFileSync(lockFile, 'utf8').trim();
      if (raw) {
        holderPid = Number(raw.split(/\s+/)[0]);
      } else {
        const stat = fs.statSync(lockFile);
        freshEmpty = Date.now() - stat.mtimeMs < 1000;
      }
    } catch {
      continue;
    }

    if (!freshEmpty && !isPidAlive(holderPid)) {
      try {
        fs.unlinkSync(lockFile);
      } catch {
        // Another waiter already cleared the stale lock.
      }
      continue;
    }

    if (Date.now() - started > LOCK_TIMEOUT_MS) {
      throw new Error(
        `Timed out waiting for headless Chrome lock (${lockFile}, held by PID ${holderPid})`
      );
    }

    if (!loggedWait && holderPid) {
      loggedWait = true;
      console.log(
        `Waiting for active headless Chrome run (PID ${holderPid}) to finish...`
      );
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

export async function launch({onCleanup, ...opts} = {}) {
  const releaseLock = await acquireBrowserLock();
  killOrphanedChrome();
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      pipe: true,
      protocolTimeout: 900000,
      args: GL_ARGS,
      ...opts,
    });
  } catch (err) {
    releaseLock();
    throw err;
  }
  browser.once('disconnected', releaseLock);
  autoCloseOnExit(browser, () => {
    releaseLock();
    onCleanup?.();
  });
  return browser;
}

// The game URL for a query string ("x=0&z=-5000&tod=0.5"), with the scripted
// defaults added unless the query sets them.
export function gameUrl(query = '') {
  const params = new URLSearchParams(query.replace(/^\?/, ''));
  for (const [k, v] of [
    ['start', '1'],
    ['ui', '0'],
    ['music', '0'],
    // Christmas off (pinned dated seeds can fall in Nov 1 to Jan 6), so
    // shots and audits compare across the year; pass xmas=full to see it
    ['xmas', 'off'],
  ]) {
    if (!params.has(k)) params.set(k, v);
  }
  return BASE + '?' + params.toString();
}

// Opens the game and waits until the terrain around the camera has loaded
// (the chunk queue is empty) plus `settleMs` for the distant terrain ring and
// shadows. Inside page.evaluate, reach the game's modules with
// `await window.gameModule('sky.js')` (see below). Page errors are collected
// in page.errors.
export async function openGame(
  browser,
  query,
  {width = 1600, height = 900, scale = 1, settleMs = 4000} = {}
) {
  const page = await browser.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') page.errors.push(m.text());
  });
  await page.setViewport({width, height, deviceScaleFactor: scale});
  // gameModule('state.js') imports the game's own instance of a module: after
  // a hot update Vite serves modules under versioned URLs (?t=...), and a
  // plain import('/state.js') would load a second, separate copy.
  await page.evaluateOnNewDocument(() => {
    window.gameModule = (name) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((url) => new URL(url).pathname === '/' + name) || '/' + name
      );
  });
  await page.goto(gameUrl(query), {waitUntil: 'load', timeout: 90000});
  const started = Date.now();
  // Loading dismisses itself with start=1; give chunks up to 60 s to load.
  while (Date.now() - started < 60000) {
    const ready = await page
      .evaluate(async () => {
        const {state} = await window.gameModule('state.js');
        return !state.isPaused && state.chunkQueue.length === 0;
      })
      .catch(() => false);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, settleMs));
  return page;
}

// Installed before the game loads for deterministic frame-stepped renders
// (scripts/promo.js, scripts/shorts.js). performance.now creeps by 1us per call
// within a frame so time-budgeted chunk/arch loops still finish while loading.
function installVirtualClock() {
  const clock = {t: performance.now(), calls: 0, pending: []};
  const dateOffset = Date.now() - clock.t;
  performance.now = () => clock.t + clock.calls++ * 0.001;
  Date.now = () => Math.round(dateOffset + clock.t);
  window.requestAnimationFrame = (cb) => clock.pending.push(cb);
  window.__promoStep = (dt) => {
    clock.t += dt;
    clock.calls = 0;
    clock.pending.splice(0).forEach((cb) => cb(clock.t));
  };
}

export const stepPromoFrame = (page, dt = 1000 / 30) =>
  page.evaluate((d) => window.__promoStep(d), dt);

// Opens a fresh browser context on a virtual clock, waits until both
// #loading-overlay is hidden and far terrain is ready (with a mandatory
// timeoutMs deadline so callers can never hang indefinitely), settles for
// settleMs on near-frozen frames, then advances prerollSec of flight.
export async function openPromoWorld(
  browser,
  url,
  {
    width = 540,
    height = 960,
    scale = 2,
    mobile = true,
    settleMs = 2000,
    prerollSec = 1.5,
    fps = 30,
    timeoutMs = 120000,
  } = {}
) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.evaluateOnNewDocument(installVirtualClock);
  await page.evaluateOnNewDocument(() => {
    window.gameModule = (name) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((u) => new URL(u).pathname === '/' + name) || '/' + name
      );
  });

  const loadShrink = Math.min(1, 480 / Math.max(width, height));
  await page.setViewport({
    width: Math.round(width * loadShrink),
    height: Math.round(height * loadShrink),
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });

  try {
    await page.goto(url, {waitUntil: 'load', timeout: timeoutMs});

    const started = Date.now();
    let loadedAt = 0;
    while (!loadedAt || Date.now() - loadedAt < settleMs) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for promo world (${url})`
        );
      }
      await stepPromoFrame(page, 0.001);
      const ready = await page.evaluate(() => {
        const overlay = document.getElementById('loading-overlay');
        return (
          Boolean(overlay) &&
          getComputedStyle(overlay).display === 'none' &&
          document.body.dataset.farReady === '1'
        );
      });
      if (ready && !loadedAt) loadedAt = Date.now();
      await new Promise((r) => setTimeout(r, 20));
    }

    await page.setViewport({
      width,
      height,
      deviceScaleFactor: scale,
      isMobile: mobile,
      hasTouch: mobile,
    });
    const prerollFrames = Math.round(prerollSec * fps);
    for (let i = 0; i < prerollFrames; i++) {
      await stepPromoFrame(page, 1000 / fps);
    }
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }

  page.close = async () => context.close();
  return page;
}

// Minimal static file server for a production build in a temp dir (never
// docs/); resolves to the listening server (port: server.address().port).
export function serveDir(dir) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wasm': 'application/wasm',
  };
  const server = http.createServer((req, res) => {
    let file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (file.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(dir) || !fs.existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, {'Content-Type': type});
    fs.createReadStream(file).pipe(res);
  });
  const rawClose = server.close.bind(server);
  server.close = (cb) => {
    server.closeAllConnections?.();
    return rawClose(cb);
  };
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}
