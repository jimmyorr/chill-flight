// Helpers for scripted looks at the running dev server (npm run dev, port
// 5173) in headless Chrome: screenshots (scripts/shot.js) and render
// benchmarks (scripts/bench-render.js).
//
// Pages open with ?start=1&ui=0&music=0 unless the query says otherwise: no
// Begin button, no HUD, panels or tips over the view, and no music downloads.
import puppeteer from 'puppeteer-core';

export const BASE = process.env.GAME_URL || 'http://localhost:5173/';
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    protocolTimeout: 900000,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
}

// The game URL for a query string ("x=0&z=-5000&tod=0.5"), with the scripted
// defaults added unless the query sets them.
export function gameUrl(query = '') {
  const params = new URLSearchParams(query.replace(/^\?/, ''));
  for (const [k, v] of [
    ['start', '1'],
    ['ui', '0'],
    ['music', '0'],
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
