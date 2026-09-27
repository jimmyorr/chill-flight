// Browser smoke test: loads the game from the running dev server in headless
// Chrome, starts a flight, and fails if any JS errors or failed requests occur.
// Usage: npm run test:browser  (requires `npm run dev` on port 5173)
import puppeteer from 'puppeteer-core';

const URL = process.env.SMOKE_URL || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FLIGHT_MS = 8000;

const errors = [];

try {
  await fetch(URL);
} catch {
  console.error(`Dev server not reachable at ${URL}. Run \`npm run dev\`.`);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 800});

  // Keep test runs out of analytics; only first-party requests matter here.
  const origin = new globalThis.URL(URL).origin;
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

  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    // Ignore the noise from our own analytics blocking above.
    if (
      msg.type() === 'error' &&
      !msg.text().includes('ERR_BLOCKED_BY_CLIENT')
    ) {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  page.on('requestfailed', (req) => {
    if (req.url().startsWith(origin)) {
      errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText})`);
    }
  });
  page.on('workercreated', (worker) => {
    worker.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`worker error: ${msg.text()}`);
    });
  });

  console.log(`Loading ${URL} ...`);
  await page.goto(URL, {waitUntil: 'load', timeout: 30000});

  // Start flying so the game loop, physics, and terrain generation all run.
  const resume = await page.$('#resume-btn');
  if (resume) {
    await resume.click().catch(() => {});
  } else {
    errors.push('missing #resume-btn: page may not have rendered');
  }
  await new Promise((r) => setTimeout(r, FLIGHT_MS));

  const state = await page.evaluate(() => ({
    canvas: !!document.querySelector('canvas'),
    paused:
      getComputedStyle(document.getElementById('pause-overlay')).display !==
      'none',
  }));
  if (!state.canvas) errors.push('no <canvas> found: renderer never started');
  if (state.paused) errors.push('still paused after clicking resume');
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(`\nSmoke test FAILED with ${errors.length} error(s):`);
  for (const e of [...new Set(errors)]) console.error(`  ${e}`);
  process.exit(1);
}
console.log('Smoke test passed: no JS errors.');
