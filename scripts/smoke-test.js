// Browser smoke test: loads the game and debug pages in headless Chrome,
// starts a flight, and fails if any JS errors or failed requests occur.
// Usage:
//   npm run test:browser  - against the dev server (`npm run dev` on port 5173)
//   npm run test:build    - builds to a temp dir (not docs/) and tests that
import puppeteer from 'puppeteer-core';
import {execSync} from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const BUILD_MODE = process.argv.includes('--build');
let BASE = process.env.SMOKE_URL || 'http://localhost:5173/';
let staticServer = null;
let outDir = null;

if (BUILD_MODE) {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chill-flight-build-'));
  console.log(`Building to ${outDir} ...`);
  execSync(`npx vite build --outDir "${outDir}" --emptyOutDir`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  staticServer = await serveDir(outDir);
  BASE = `http://localhost:${staticServer.address().port}/`;
}
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FLIGHT_MS = 8000;
const DEBUG_PAGE_MS = 3000;

// The game gets a full flight; debug pages only need to load cleanly.
const PAGES = [
  {path: '', fly: true},
  {path: 'debug-models.html'},
  // Not a Vite build input, so it only exists on the dev server.
  {path: 'debug-export-map.html', devOnly: true},
];

const origin = new URL(BASE).origin;
const errors = [];

// Minimal static file server for the built output; lives only for this test.
function serveDir(dir) {
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
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

// Retry briefly: Vite restarts the dev server whenever vite.config.js changes.
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

async function checkPage(browser, {path, fly}) {
  const url = new URL(path, BASE).href;
  const tag = path || 'index.html';
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 800});

  // Keep test runs out of analytics; only first-party requests matter here.
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (
      !u.startsWith(origin) &&
      /google-analytics|analytics\.google|googletagmanager|firebaseinstallations|firebaselogging/.test(
        u
      )
    ) {
      req.abort('blockedbyclient').catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });

  page.on('pageerror', (err) =>
    errors.push(`[${tag}] pageerror: ${err.message}`)
  );
  page.on('console', (msg) => {
    // Ignore the noise from our own analytics blocking above.
    if (
      msg.type() === 'error' &&
      !msg.text().includes('ERR_BLOCKED_BY_CLIENT')
    ) {
      errors.push(`[${tag}] console.error: ${msg.text()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (req.url().startsWith(origin)) {
      errors.push(
        `[${tag}] requestfailed: ${req.url()} (${req.failure()?.errorText})`
      );
    }
  });
  page.on('workercreated', (worker) => {
    worker.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`[${tag}] worker error: ${msg.text()}`);
      }
    });
  });

  // Count worker replies, so a silent fallback to main-thread terrain
  // generation (workers crashing on load) fails the test.
  await page.evaluateOnNewDocument(() => {
    window.__smokeWorkerMessages = 0;
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', () => window.__smokeWorkerMessages++);
      }
    };
  });

  console.log(`Loading ${url} ...`);
  await page.goto(url, {waitUntil: 'load', timeout: 30000});

  if (!fly) {
    await new Promise((r) => setTimeout(r, DEBUG_PAGE_MS));
    await page.close();
    return;
  }

  // Press START so the game loop, physics, and terrain generation all run.
  try {
    await page.waitForSelector('#begin-btn', {visible: true, timeout: 30000});
    await page.click('#begin-btn');
  } catch (err) {
    errors.push(`[${tag}] could not press START: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, FLIGHT_MS));

  const state = await page.evaluate(() => ({
    workerMessages: window.__smokeWorkerMessages,
    canvas: !!document.querySelector('canvas'),
    paused:
      getComputedStyle(document.getElementById('pause-overlay')).display !==
      'none',
  }));
  if (!state.canvas) {
    errors.push(`[${tag}] no <canvas> found: renderer never started`);
  }
  if (state.paused) errors.push(`[${tag}] still paused after pressing START`);
  if (!state.workerMessages) {
    errors.push(`[${tag}] terrain workers never replied`);
  }
  console.log(`  terrain worker replies: ${state.workerMessages}`);
  await exerciseControls(page, tag);
  await page.close();
}

// Drive the game through the keyboard and check its effects through the DOM
// (HUD and debug panel), so this keeps working however the code is organized.
async function exerciseControls(page, tag) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fail = (msg) => errors.push(`[${tag}] ${msg}`);
  const readDebug = () =>
    page.evaluate(() => {
      const num = (id) => parseFloat(document.getElementById(id)?.textContent);
      return {
        x: num('debug-world-x'),
        y: num('debug-world-y'),
        z: num('debug-world-z'),
        target: num('debug-target-speed'),
        heading: num('debug-camera-heading'),
        camX: num('debug-camera-x'),
        camY: num('debug-camera-y'),
        camZ: num('debug-camera-z'),
      };
    });
  const hold = async (key, ms) => {
    await page.keyboard.down(key);
    await wait(ms);
    await page.keyboard.up(key);
  };
  const shifted = async (key) => {
    await page.keyboard.down('Shift');
    await page.keyboard.press(key);
    await page.keyboard.up('Shift');
  };
  const isPaused = () => isVisible('#pause-overlay');
  const isVisible = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      const cs = getComputedStyle(el);
      return (
        cs.display !== 'none' &&
        cs.visibility !== 'hidden' &&
        !el.classList.contains('hidden') &&
        el.getClientRects().length > 0
      );
    }, sel);
  const clickAndCheck = async (sel, target, expectVisible, what) => {
    await page.click(sel).catch((err) => fail(`${what}: ${err.message}`));
    await wait(800);
    if ((await isVisible(target)) !== expectVisible) fail(`${what} failed`);
  };

  // Debug panel (Shift+D) exposes live flight values in the DOM.
  await shifted('D');
  await wait(500);
  const a = await readDebug();
  await wait(1500);
  const b = await readDebug();
  if (!(Math.hypot(b.x - a.x, b.z - a.z) > 1)) {
    fail(`plane is not moving (${JSON.stringify(a)} -> ${JSON.stringify(b)})`);
  }

  await page.keyboard.down('Shift'); // Shift+Up: throttle up
  await hold('ArrowUp', 1000);
  await page.keyboard.up('Shift');
  await wait(300);
  const c = await readDebug();
  if (!(c.target > b.target)) {
    fail(`throttle up did not raise target speed (${b.target} -> ${c.target})`);
  }

  await hold('ArrowLeft', 1500); // bank left
  await wait(1000);
  const d = await readDebug();
  if (d.heading === c.heading) fail(`steering did not change heading`);

  await page.keyboard.press('c'); // camera mode
  await wait(2500);
  const e = await readDebug();
  const camOffset = (s) => Math.hypot(s.camX - s.x, s.camY - s.y, s.camZ - s.z);
  if (Math.abs(camOffset(e) - camOffset(d)) < 0.5) {
    fail(`camera toggle did not move the camera relative to the plane`);
  }

  // Toggles without a simple DOM readout: these just need to not throw.
  for (const key of ['g', 'v', 'l']) {
    await page.keyboard.press(key);
    await wait(700);
  }
  await shifted('S'); // shooting star
  await shifted('U'); // rainbow
  await wait(1500);

  const minimapBefore = await isVisible('#minimap-container');
  await page.keyboard.press('m');
  await wait(800);
  if ((await isVisible('#minimap-container')) === minimapBefore) {
    fail('m did not toggle the minimap');
  }

  await page.keyboard.press('Escape');
  await wait(500);
  if (!(await isPaused())) fail('Escape did not pause the game');
  await clickAndCheck(
    '#achievements-btn',
    '#achievements-overlay',
    true,
    'open achievements'
  );
  await clickAndCheck(
    '#achievements-close-btn',
    '#achievements-overlay',
    false,
    'close achievements'
  );
  await clickAndCheck(
    '#pause-map-btn',
    '#fullscreen-map-overlay',
    true,
    'open map from pause menu'
  );
  await clickAndCheck(
    '#fullscreen-map-close-btn',
    '#fullscreen-map-overlay',
    false,
    'close fullscreen map'
  );
  await page
    .click('#resume-btn')
    .catch((err) => fail(`resume: ${err.message}`));
  await wait(800);
  if (await isPaused()) fail('resume button did not unpause the game');
  console.log(
    '  controls: move, throttle, steer, camera, toggles, minimap, pause menu ok'
  );
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  for (const p of PAGES) {
    if (!(BUILD_MODE && p.devOnly)) await checkPage(browser, p);
  }
} finally {
  await browser.close();
  staticServer?.close();
  if (outDir) fs.rmSync(outDir, {recursive: true, force: true});
}

if (errors.length) {
  console.error(`\nSmoke test FAILED with ${errors.length} error(s):`);
  for (const e of [...new Set(errors)]) console.error(`  ${e}`);
  process.exit(1);
}
console.log('Smoke test passed: no JS errors.');
