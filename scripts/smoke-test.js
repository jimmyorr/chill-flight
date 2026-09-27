// Browser smoke test: loads the game and debug pages from the running dev server
// in headless Chrome, starts a flight, and fails if any JS errors or failed
// requests occur.
// Usage: npm run test:browser  (requires `npm run dev` on port 5173)
import puppeteer from 'puppeteer-core';

const BASE = process.env.SMOKE_URL || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FLIGHT_MS = 8000;
const DEBUG_PAGE_MS = 3000;

// The game gets a full flight; debug pages only need to load cleanly.
const PAGES = [
  {path: '', fly: true},
  {path: 'debug-models.html'},
  {path: 'debug-export-map.html'},
];

const origin = new URL(BASE).origin;
const errors = [];

try {
  await fetch(BASE);
} catch {
  console.error(`Dev server not reachable at ${BASE}. Run \`npm run dev\`.`);
  process.exit(1);
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

  // Start flying so the game loop, physics, and terrain generation all run.
  const resume = await page.$('#resume-btn');
  if (resume) {
    await resume.click().catch(() => {});
  } else {
    errors.push(`[${tag}] missing #resume-btn: page may not have rendered`);
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
  if (state.paused) errors.push(`[${tag}] still paused after clicking resume`);
  await page.close();
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  for (const p of PAGES) await checkPage(browser, p);
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`\nSmoke test FAILED with ${errors.length} error(s):`);
  for (const e of [...new Set(errors)]) console.error(`  ${e}`);
  process.exit(1);
}
console.log('Smoke test passed: no JS errors.');
