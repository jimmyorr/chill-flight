// Promotional screenshots and video (issue #92) from the shot list in
// scripts/promo-shots.js. Each shot is a game URL (see the README's URL
// parameters: the debug menu's copy URL buttons write them), so the assets
// can be re-rendered after visual changes.
//
// Usage:
//   node scripts/promo.js sheet [shot ...]           small renders and a
//                                                    contact sheet, for scouting
//   node scripts/promo.js stills [shot ...]          each shot for each still
//                                                    target (STILLS=iphone,web)
//   node scripts/promo.js video <target> [shot ...]  the clips, then the edited
//                                                    video (e.g. iphone-preview)
//   node scripts/promo.js urls [shot ...]            a link to each shot on the
//                                                    dev server, to adjust it
//   node scripts/promo.js view                       rewrites promo/index.html,
//                                                    a page for browsing the
//                                                    stills (stills does too),
//                                                    and opens it
//
// Each mode is also an npm script: npm run promo:stills [-- shot ...]
//
// Targets (sizes, device, cards) are in promo-shots.js. By default it renders
// a production build written to a temp dir (never docs/); GAME_URL (e.g.
// http://localhost:5173/) uses the dev server instead. Output goes to promo/
// (OUT=dir). Options (env): SHEET (a target for the contact sheet, shrunk;
// default web), SETTLE_MS (extra wait after the game loads, before a still or
// a clip; default 1000), FPS (30), MUSIC (an audio file for the video; default the
// bundled Purrple Cat track, `none` for silence). Needs ffmpeg.
//
// Every shot runs on a virtual clock: the page's requestAnimationFrame,
// performance.now and Date.now are replaced and the script steps the frames.
// While the scene loads and settles, frames pass almost no time, so a flying
// plane holds its starting position however slowly the frames render; then
// PREROLL seconds (1.5) play so the chase camera settles, and a still or a
// clip starts. Clips advance exactly 1/FPS of a second per frame.
import {execFileSync, execSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath} from 'url';
import {launch, serveDir} from './dev-browser.js';
import {COMMON, SHOTS, TARGETS} from './promo-shots.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE =
  'Usage: node scripts/promo.js sheet|stills|urls|view [shot ...]\n' +
  '       node scripts/promo.js video <target> [shot ...]';
const [mode, ...args] = process.argv.slice(2);
if (!['sheet', 'stills', 'video', 'urls', 'view'].includes(mode)) {
  console.error(USAGE);
  process.exit(1);
}
const videoTargetName = mode === 'video' ? args.shift() : null;
const videoTarget = videoTargetName && TARGETS[videoTargetName];
if (mode === 'video' && !videoTarget?.video) {
  const videoTargets = Object.keys(TARGETS).filter((t) => TARGETS[t].video);
  console.error(`${USAGE}\nVideo targets: ${videoTargets.join(', ')}`);
  process.exit(1);
}
const OUT = path.resolve(process.env.OUT || path.join(ROOT, 'promo'));
const SETTLE_MS = Number(process.env.SETTLE_MS || 1000);
const FPS = Number(process.env.FPS || 30);
const PREROLL = Number(process.env.PREROLL || 1.5);
const MUSIC =
  process.env.MUSIC ||
  path.join(ROOT, 'public/assets/purrple-cat-birds-of-a-feather.mp3');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;

const selected = args.length ? args : Object.keys(SHOTS);
for (const name of selected) {
  if (!SHOTS[name]) {
    console.error(`Unknown shot "${name}". Shots: ${Object.keys(SHOTS)}`);
    process.exit(1);
  }
}

// A shot's URL for a target: the shared defaults, the shot's parameters, then
// its portrait ones on a portrait target (e.g. another camera position)
function shotUrl(shot, target, gameBase) {
  const params = new URLSearchParams(COMMON);
  const portrait = target.height > target.width;
  const queries = [shot.query, portrait ? shot.portrait : shot.landscape];
  for (const query of queries) {
    // A whole copied link works too: only its parameters count
    const search = (query || '').replace(/^[^?]*\?/, '');
    for (const [k, v] of new URLSearchParams(search)) params.set(k, v);
  }
  return gameBase + '?' + params.toString();
}

// Links for adjusting shots in a browser: the dev server (or GAME_URL) with
// the debug menu, the interface and music as the game normally has them
if (mode === 'urls') {
  const devBase = process.env.GAME_URL || 'http://localhost:5173/';
  for (const name of selected) {
    for (const [targetName, target] of [
      ['landscape', TARGETS.web],
      ['portrait', TARGETS.iphone],
    ]) {
      const shot = SHOTS[name];
      if (targetName === 'portrait' && !shot.portrait) continue;
      const url = new URL(shotUrl(shot, target, devBase));
      for (const k of ['ui', 'music', 'tips']) url.searchParams.delete(k);
      url.searchParams.set('debug', '1');
      console.log(
        `${name}${shot.portrait ? ` (${targetName})` : ''}:\n  ${url}`
      );
    }
  }
  process.exit(0);
}

fs.mkdirSync(OUT, {recursive: true});

// A page for browsing the stills in OUT, by device or by shot
function writeViewer() {
  const devices = Object.keys(TARGETS).filter((t) => !TARGETS[t].video);
  const stills = [];
  for (const shot of Object.keys(SHOTS)) {
    for (const device of devices) {
      const file = `${shot}-${device}.jpg`;
      if (fs.existsSync(path.join(OUT, file)))
        stills.push({shot, device, file});
    }
  }
  const sizes = Object.fromEntries(
    devices.map((d) => {
      const t = TARGETS[d];
      const scale = t.scale || 1;
      return [
        d,
        `${Math.round(t.width * scale)}x${Math.round(t.height * scale)}`,
      ];
    })
  );
  const data = JSON.stringify({stills, devices, sizes});
  const file = path.join(OUT, 'index.html');
  fs.writeFileSync(
    file,
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chill Flight promo stills</title>
<style>
  :root { color-scheme: dark; --bg: #0f0f1a; --panel: #1a1a2e; --text: #e8e8f0;
    --muted: #8a8aa0; --accent: #ffd34d; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.4 -apple-system, system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 1; background: var(--panel);
    padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 8px 16px;
    align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  h1 { margin: 0; font-size: 16px; font-weight: 600; }
  .group { display: flex; flex-wrap: wrap; gap: 6px; }
  button { font: inherit; color: var(--text); background: #2a2a44;
    border: 1px solid #3a3a5a; border-radius: 999px; padding: 4px 12px;
    cursor: pointer; }
  button[aria-pressed="true"] { background: var(--accent); color: #111;
    border-color: var(--accent); }
  .divider { width: 1px; align-self: stretch; background: #3a3a5a; }
  main { padding: 16px; display: flex; flex-wrap: wrap; gap: 16px;
    align-items: flex-start; }
  figure { margin: 0; }
  figure a { display: block; }
  figure img { display: block; width: auto; height: auto; max-height: var(--h);
    max-width: calc(100vw - 32px); border-radius: 6px; background: #000; }
  figcaption { color: var(--muted); padding-top: 4px; }
  .empty { color: var(--muted); }
</style></head>
<body>
<header>
  <h1>Promo stills</h1>
  <div class="group" id="modes"></div>
  <div class="divider"></div>
  <div class="group" id="picks"></div>
</header>
<main id="grid"></main>
<script>
const {stills, devices, sizes} = ${data};
const shots = [...new Set(stills.map((s) => s.shot))];
const state = {mode: 'device', pick: devices[0]};
try {
  const [mode, pick] = decodeURIComponent(location.hash.slice(1)).split('/');
  if (mode === 'device' || mode === 'shot') Object.assign(state, {mode, pick});
} catch {}
function button(label, pressed, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.setAttribute('aria-pressed', pressed);
  b.onclick = onClick;
  return b;
}
function render() {
  const options = state.mode === 'device' ? devices : shots;
  if (!options.includes(state.pick)) state.pick = options[0];
  history.replaceState(null, '', '#' + state.mode + '/' + state.pick);
  const modes = document.getElementById('modes');
  modes.replaceChildren(
    button('By device', state.mode === 'device', () => { state.mode = 'device'; render(); }),
    button('By shot', state.mode === 'shot', () => { state.mode = 'shot'; render(); })
  );
  document.getElementById('picks').replaceChildren(
    ...options.map((o) => button(o, o === state.pick, () => { state.pick = o; render(); }))
  );
  const grid = document.getElementById('grid');
  const shown = stills.filter((s) => s[state.mode] === state.pick);
  // Portrait devices get taller tiles; in one shot's row every device gets the same height
  const height = (d) => state.mode === 'shot' ? '360px'
    : ['iphone', 'ipad'].includes(d) ? '520px' : '300px';
  grid.replaceChildren(...shown.map((s) => {
    const fig = document.createElement('figure');
    fig.style.setProperty('--h', height(s.device));
    const a = document.createElement('a');
    a.href = s.file;
    a.target = '_blank';
    const img = document.createElement('img');
    img.src = s.file;
    img.alt = s.shot + ' on ' + s.device;
    img.loading = 'lazy';
    a.append(img);
    const cap = document.createElement('figcaption');
    cap.textContent = (state.mode === 'device' ? s.shot : s.device) + ' · ' + sizes[s.device];
    fig.append(a, cap);
    return fig;
  }));
  if (!shown.length) {
    grid.innerHTML = '<p class="empty">No stills yet. Run node scripts/promo.js stills.</p>';
  }
}
render();
</script>
</body></html>
`
  );
  return file;
}

if (mode === 'view') {
  const page = writeViewer();
  console.log(page);
  if (process.platform === 'darwin') execFileSync('open', [page]);
  process.exit(0);
}

// --- The game: a build in a temp dir, or GAME_URL ---
let base = process.env.GAME_URL;
let server = null;
let buildDir = null;
if (!base) {
  buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chill-flight-promo-'));
  console.log(`Building to ${buildDir} ...`);
  execSync(`npx vite build --outDir "${buildDir}" --emptyOutDir`, {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  server = await serveDir(buildDir);
  base = `http://localhost:${server.address().port}/`;
}
const origin = new URL(base).origin;

// Installed before the game loads. performance.now creeps by a microsecond per
// call within a frame, so time-budgeted loops (chunk building) still finish.
function installVirtualClock() {
  const clock = {t: performance.now(), calls: 0, pending: []};
  const dateOffset = Date.now() - clock.t;
  performance.now = () => clock.t + clock.calls++ * 0.001;
  Date.now = () => Math.round(dateOffset + clock.t);
  window.requestAnimationFrame = (cb) => clock.pending.push(cb);
  // Advances dt ms and runs one frame's callbacks
  window.__promoStep = (dt) => {
    clock.t += dt;
    clock.calls = 0;
    clock.pending.splice(0).forEach((cb) => cb(clock.t));
  };
}

const step = (page, dt) => page.evaluate((d) => window.__promoStep(d), dt);

// Opens a shot in a fresh profile (saved settings like Zen or the livery don't
// carry over), emulating a phone or tablet for mobile targets so the game uses
// its touch layout, and waits for the scene to settle.
async function openShot(browser, shot, target) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  // Keep renders out of analytics
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
  await page.evaluateOnNewDocument(installVirtualClock);
  // Load at a small size of the same shape (frames are cheap, so terrain
  // loads quickly), then render at full size
  const viewport = (shrink) => ({
    width: Math.round(target.width * shrink),
    height: Math.round(target.height * shrink),
    deviceScaleFactor: shrink < 1 ? 1 : target.scale || 1,
    isMobile: !!target.mobile,
    hasTouch: !!target.mobile,
  });
  const loadShrink = Math.min(1, 480 / Math.max(target.width, target.height));
  await page.setViewport(viewport(loadShrink));
  await page.goto(shotUrl(shot, target, base), {
    waitUntil: 'load',
    timeout: 120000,
  });
  // Load and settle on near-frozen frames: terrain, the distant ring, shadows
  // and the sky's easing toward the set cloud cover. The title screen goes
  // away on its own (start=1).
  const started = Date.now();
  let loaded = false;
  while (!loaded || Date.now() - started < SETTLE_MS) {
    if (Date.now() - started > SETTLE_MS + 600000) {
      throw new Error('The game did not finish loading');
    }
    await step(page, 0.001);
    loaded ||= await page.evaluate(
      () =>
        getComputedStyle(document.getElementById('loading-overlay')).display ===
        'none'
    );
    await sleep(20);
  }
  // Then full size and real time, so the chase camera and the plane's motion
  // settle (and the renderer and shadows catch up with the new size)
  await page.setViewport(viewport(1));
  for (let i = 0; i < Math.round(PREROLL * FPS); i++) {
    await step(page, 1000 / FPS);
  }
  page.close = async () => context.close();
  return page;
}

function reportErrors(name, page) {
  if (page.errors.length) {
    console.error(`  ${name} errors:\n  ${page.errors.join('\n  ')}`);
    failed = true;
  }
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit'});
}

// A title or end card: centered text on the title screen's dark gradient, in
// the game's Inter, scaled to the frame's shorter side: the name, then a
// tagline and any smaller lines under it
function cardHtml({title, lines = []}) {
  const font = (weight) =>
    'file://' +
    path.join(
      ROOT,
      `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`
    );
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: Inter; font-weight: 300; src: url(${font(300)}); }
    @font-face { font-family: Inter; font-weight: 500; src: url(${font(500)}); }
    html, body { margin: 0; height: 100%; }
    body { display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 2.5vmin; font-family: Inter, sans-serif;
      color: #fff; background: radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%); }
    h1 { margin: 0; font-weight: 300; font-size: 7vmin; letter-spacing: 0.6em;
      margin-right: -0.6em; text-align: center; }
    p { margin: 0; font-weight: 500; font-size: 2.8vmin; letter-spacing: 0.25em;
      color: rgba(255, 255, 255, 0.6); text-align: center; }
    /* The first line is the tagline; any after it (a web address) are smaller */
    p:first-of-type { font-weight: 300; font-size: 4vmin; letter-spacing: 0.12em;
      color: rgba(255, 255, 255, 0.9); }
    /* Portrait: the spaced-out title would overflow the width, and the lines
       would be too small to read on a phone */
    @media (orientation: portrait) {
      h1 { font-size: 6vmin; }
      p { font-size: 3.6vmin; }
      p:first-of-type { font-size: 5.5vmin; }
    }
  </style><h1>${title}</h1>${lines.map((line) => `<p>${line}</p>`).join('')}`;
}

async function renderCard(browser, card, target, file) {
  const page = await browser.newPage();
  await page.setViewport({
    width: target.width,
    height: target.height,
    deviceScaleFactor: target.scale || 1,
  });
  const html = path.join(OUT, 'card.html');
  fs.writeFileSync(html, cardHtml(card));
  await page.goto('file://' + html, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: file});
  await page.close();
  fs.rmSync(html);
}

const H264 = ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p'];

const browser = await launch();
try {
  if (mode === 'sheet') {
    // The sheet target, shrunk to about 640 px across its longer side
    const full = TARGETS[process.env.SHEET || 'web'];
    const shrink = 640 / Math.max(full.width, full.height);
    const target = {
      ...full,
      width: Math.round(full.width * shrink),
      height: Math.round(full.height * shrink),
      scale: 1,
    };
    const files = [];
    for (const name of selected) {
      const page = await openShot(browser, SHOTS[name], target);
      const file = path.join(OUT, `sheet-${name}.jpg`);
      // Labelled here rather than by ffmpeg, whose drawtext filter isn't in
      // Homebrew's ffmpeg
      await page.evaluate((text) => {
        const label = document.createElement('div');
        label.textContent = text;
        label.style.cssText =
          'position:fixed;left:8px;bottom:8px;z-index:2147483647;' +
          'padding:2px 6px;font:500 14px Inter,sans-serif;color:#fff;' +
          'background:rgba(0,0,0,0.5);' +
          // Over ui=0's hiding of everything but the canvas
          'visibility:visible !important';
        document.body.append(label);
      }, name);
      await page.screenshot({path: file, type: 'jpeg', quality: 85});
      reportErrors(name, page);
      await page.close();
      files.push(file);
      console.log(file);
    }
    // Tiles two across for landscape and four for portrait
    const cols = Math.min(target.height > target.width ? 4 : 2, files.length);
    const layout = files
      .map(
        (_, i) =>
          `${(i % cols) * target.width}_${Math.floor(i / cols) * target.height}`
      )
      .join('|');
    const sheet = path.join(OUT, 'sheet.jpg');
    ffmpeg([
      ...files.flatMap((f) => ['-i', f]),
      ...(files.length > 1
        ? [
            '-filter_complex',
            `xstack=inputs=${files.length}:layout=${layout}:fill=black`,
          ]
        : []),
      ...['-frames:v', '1', sheet],
    ]);
    console.log(sheet);
  }

  if (mode === 'stills') {
    const stillTargets = (
      process.env.STILLS ||
      Object.keys(TARGETS)
        .filter((t) => !TARGETS[t].video)
        .join(',')
    ).split(',');
    for (const name of selected) {
      if (SHOTS[name].still === false) continue;
      for (const targetName of stillTargets) {
        const page = await openShot(browser, SHOTS[name], TARGETS[targetName]);
        const file = path.join(OUT, `${name}-${targetName}.jpg`);
        await page.screenshot({path: file, type: 'jpeg', quality: 92});
        reportErrors(name, page);
        await page.close();
        console.log(file);
      }
    }
    console.log(writeViewer());
  }

  if (mode === 'video') {
    const target = videoTarget;
    const pixelW = Math.round(target.width * (target.scale || 1));
    const pixelH = Math.round(target.height * (target.scale || 1));
    const parts = [];
    const addCard = async (card, i) => {
      const png = path.join(OUT, `${videoTargetName}-card-${i}.png`);
      const mp4 = png.replace(/\.png$/, '.mp4');
      await renderCard(browser, card, target, png);
      ffmpeg([
        ...['-loop', '1', '-framerate', String(FPS), '-i', png],
        ...['-t', String(card.seconds), ...H264, mp4],
      ]);
      fs.rmSync(png);
      return {mp4, seconds: card.seconds};
    };
    const {titleCard, endCard} = target;
    if (titleCard) parts.push(await addCard(titleCard, 0));

    for (const name of selected) {
      const shot = SHOTS[name];
      if (!shot.seconds) continue;
      const frameDir = path.join(OUT, `frames-${name}`);
      fs.rmSync(frameDir, {recursive: true, force: true});
      fs.mkdirSync(frameDir, {recursive: true});
      const page = await openShot(browser, shot, target);
      const frames = Math.round(shot.seconds * FPS);
      for (let i = 0; i < frames; i++) {
        await step(page, 1000 / FPS);
        await page.screenshot({
          path: path.join(frameDir, `${String(i).padStart(5, '0')}.jpg`),
          type: 'jpeg',
          quality: 95,
        });
        if (i % FPS === 0) console.log(`  ${name}: ${i}/${frames} frames`);
      }
      reportErrors(name, page);
      await page.close();
      const mp4 = path.join(OUT, `${videoTargetName}-clip-${name}.mp4`);
      ffmpeg([
        ...['-framerate', String(FPS), '-i', path.join(frameDir, '%05d.jpg')],
        ...['-vf', `scale=${pixelW}:${pixelH}`, ...H264, mp4],
      ]);
      fs.rmSync(frameDir, {recursive: true, force: true});
      parts.push({mp4, seconds: shot.seconds});
      console.log(mp4);
    }
    if (endCard) parts.push(await addCard(endCard, 1));

    // Edit: the parts joined by short crossfades, with music faded in and out
    const FADE = 0.6;
    let filter = '';
    let offset = 0;
    let last = '[0:v]';
    parts.slice(1).forEach((part, i) => {
      offset += parts[i].seconds - FADE;
      filter += `${last}[${i + 1}:v]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(3)}[x${i}];`;
      last = `[x${i}]`;
    });
    const total =
      parts.reduce((sum, p) => sum + p.seconds, 0) - FADE * (parts.length - 1);
    const withMusic = MUSIC !== 'none';
    if (withMusic) {
      filter += `[${parts.length}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=1,afade=t=out:st=${(total - 2).toFixed(3)}:d=2[a];`;
    }
    const video = path.join(OUT, `chill-flight-${videoTargetName}.mp4`);
    ffmpeg([
      ...parts.flatMap((p) => ['-i', p.mp4]),
      ...(withMusic ? ['-i', MUSIC] : []),
      ...['-filter_complex', filter.replace(/;$/, '')],
      ...['-map', parts.length > 1 ? last : '0:v'],
      ...(withMusic ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '192k'] : []),
      ...H264,
      ...['-r', String(FPS), '-movflags', '+faststart', video],
    ]);
    console.log(`${video} (${total.toFixed(1)} s)`);
  }
} finally {
  await browser.close();
  if (server) server.close();
  if (buildDir) fs.rmSync(buildDir, {recursive: true, force: true});
}
process.exit(failed ? 1 : 0);
