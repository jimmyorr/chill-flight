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

if (BUILD_MODE) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chill-flight-build-'));
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
    canvas: !!document.querySelector('canvas'),
    paused:
      getComputedStyle(document.getElementById('pause-overlay')).display !==
      'none',
  }));
  if (!state.canvas) {
    errors.push(`[${tag}] no <canvas> found: renderer never started`);
  }
  if (state.paused) errors.push(`[${tag}] still paused after pressing START`);
  await page.close();
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
}

if (errors.length) {
  console.error(`\nSmoke test FAILED with ${errors.length} error(s):`);
  for (const e of [...new Set(errors)]) console.error(`  ${e}`);
  process.exit(1);
}
console.log('Smoke test passed: no JS errors.');
