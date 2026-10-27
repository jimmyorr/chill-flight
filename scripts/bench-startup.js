// Hitches at cold start and the first map open, in a phone-sized window:
//   load:   page load to the START button
//   start:  time inside the START click handler, then frames in the first
//           6 s of flight (the intro camera swoop)
//   flight: frames in a later 6 s of steady flight, for comparison
//   map1/2: time inside the map's open call, frames in the next 4 s, and
//           how long until the map is fully drawn; map2 is a second open
//           after closing it
// start and flight also count shaders compiled and canvas resizes since
// START. For frames: worst (ms), how many took over 50 and 100 ms, "jank"
// (the time frames spent beyond 50 ms each, summed), and "busy" (main thread
// time in tasks over 50 ms) with the longest task. Headless Chrome on Linux
// renders with SwiftShader (the CPU), so compare runs on the same machine
// rather than reading the numbers as a phone's.
// Usage: npm run bench:startup [-- label]
//   env: RUNS=3  PRESET=mid  DPR=2  QUERY=a=1&b=2
import {launch, BASE} from './dev-browser.js';

const label = process.argv[2] || 'startup';
const RUNS = parseInt(process.env.RUNS || '3', 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await launch();

async function run() {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: parseFloat(process.env.DPR || '2'),
    isMobile: true,
    hasTouch: true,
  });
  await page.evaluateOnNewDocument(() => {
    window.gameModule = (name) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((url) => new URL(url).pathname === '/' + name) || '/' + name
      );
    window.__frames = [];
    const tick = (t) => {
      window.__frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__longTasks.push([e.startTime, e.duration]);
      }
    }).observe({type: 'longtask', buffered: true});
  });
  const query = `seed=20260928&preset=${process.env.PRESET || 'mid'}${process.env.QUERY ? `&${process.env.QUERY}` : ''}`;
  const t0 = Date.now();
  await page.goto(`${BASE}?${query}`, {waitUntil: 'load', timeout: 90000});
  await page.waitForSelector('#begin-btn', {visible: true, timeout: 120000});
  const load = Date.now() - t0;
  // A moment on the title screen, as a player would take
  await sleep(2000);

  // Frame stats between two performance.now() times
  const frames = (from, to) =>
    page.evaluate(
      (from, to) => {
        const f = window.__frames.filter((t) => t >= from && t <= to);
        const d = [];
        for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
        const sorted = [...d].sort((a, b) => a - b);
        const tasks = window.__longTasks
          .filter(([t]) => t >= from && t <= to)
          .map(([, ms]) => ms);
        return {
          // Main thread time in tasks over 50 ms, and the longest
          busy: Math.round(tasks.reduce((a, b) => a + b, 0)),
          longest: Math.round(Math.max(0, ...tasks)),
          n: d.length,
          median: Math.round(sorted[sorted.length >> 1] || 0),
          worst: Math.round(sorted[sorted.length - 1] || 0),
          over50: d.filter((x) => x > 50).length,
          over100: d.filter((x) => x > 100).length,
          jank: Math.round(d.reduce((s, x) => s + Math.max(0, x - 50), 0)),
        };
      },
      from,
      to
    );
  const now = () => page.evaluate(() => performance.now());

  // START: time the click handler itself, then the frames after it. Also
  // counts shaders compiled and canvas resizes from then on
  await page.evaluate(async () => {
    const {renderer} = await window.gameModule('sky.js');
    window.__programs = renderer.info.programs.length;
    window.__resizes = 0;
    const setSize = renderer.setSize.bind(renderer);
    renderer.setSize = (...args) => {
      window.__resizes++;
      return setSize(...args);
    };
  });
  const startAt = await now();
  const clickMs = await page.evaluate(() => {
    const t = performance.now();
    document.getElementById('begin-btn').click();
    return performance.now() - t;
  });
  await sleep(6000);
  const counts = () =>
    page.evaluate(async () => {
      const {renderer} = await window.gameModule('sky.js');
      return {
        shaders: renderer.info.programs.length - window.__programs,
        resizes: window.__resizes,
      };
    });
  const start = {
    clickMs: Math.round(clickMs),
    ...(await counts()),
    ...(await frames(startAt, startAt + 6000)),
  };

  await sleep(6000);
  const flightAt = await now();
  await sleep(6000);
  const flight = {
    ...(await frames(flightAt, flightAt + 6000)),
    ...(await counts()),
  };

  // The map: open, time the call, watch the canvas fill in
  const openMap = async () => {
    const at = await now();
    const openMs = await page.evaluate(async () => {
      const {hooks} = await window.gameModule('hooks.js');
      const t = performance.now();
      hooks.fullscreenMap.open();
      return performance.now() - t;
    });
    // Filled: every point of a grid over the canvas differs from the empty
    // background (#090e17)
    const filledMs = await page.evaluate(async (at) => {
      const canvas = document.getElementById('fullscreen-map-canvas');
      const ctx = canvas.getContext('2d');
      while (performance.now() - at < 15000) {
        const {width, height} = canvas;
        const img = ctx.getImageData(0, 0, width, height).data;
        let empty = 0;
        for (let gy = 1; gy < 10; gy++) {
          for (let gx = 1; gx < 10; gx++) {
            const i =
              (Math.floor((gy / 10) * height) * width +
                Math.floor((gx / 10) * width)) *
              4;
            if (img[i] === 9 && img[i + 1] === 14 && img[i + 2] === 23) {
              empty++;
            }
          }
        }
        if (empty === 0) return performance.now() - at;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    }, at);
    await sleep(Math.max(0, 4000 - (filledMs || 0)));
    const stats = await frames(at, at + 4000);
    await page.evaluate(async () => {
      const {hooks} = await window.gameModule('hooks.js');
      hooks.fullscreenMap.close();
    });
    return {
      openMs: Math.round(openMs),
      filledMs: filledMs === null ? null : Math.round(filledMs),
      ...stats,
    };
  };
  const map1 = await openMap();
  await sleep(3000);
  const map2 = await openMap();

  await page.close();
  return {load, start, flight, map1, map2, errors};
}

const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = await run();
  results.push(r);
  console.log(`${label} run ${i + 1}: ${JSON.stringify(r)}`);
}

// Medians across runs, per number
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const summary = {};
for (const key of ['start', 'flight', 'map1', 'map2']) {
  summary[key] = {};
  for (const k of Object.keys(results[0][key])) {
    const vals = results.map((r) => r[key][k]).filter((v) => v !== null);
    summary[key][k] = vals.length ? median(vals) : null;
  }
}
summary.load = median(results.map((r) => r.load));
console.log(`${label} median: ${JSON.stringify(summary)}`);
await browser.close();
