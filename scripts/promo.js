// Promotional screenshots and video (issue #92) from the shot list in
// scripts/promo-shots.js. Each shot is a game URL (see the README's URL
// parameters: the debug menu's copy URL buttons write them), so the assets
// can be re-rendered after visual changes.
//
// Usage:
//   node scripts/promo.js stills [shot ...]          each shot for each still
//                                                    target (STILLS=iphone,ipad)
//   node scripts/promo.js video <target> [shot ...]  the clips, then the edited
//                                                    video (e.g. iphone-preview)
//   node scripts/promo.js urls [shot ...]            a link to each shot on the
//                                                    dev server, to adjust it
//   node scripts/promo.js artwork [name ...]         single images: the YouTube
//                                                    thumbnail and App Store
//                                                    header and search results
//                                                    asset (ARTWORK)
//   node scripts/promo.js strip <target> [shot ...]  timestamped filmstrip
//                                                    contact sheet for scouting
//                                                    stillTime and framing
//                                                    (STEP=0.4)
//
// Each mode is also an npm script: npm run promo:stills [-- shot ...]
//
// Targets (sizes, device, cards) are in promo-shots.js. By default it renders
// a production build written to a temp dir (never docs/); GAME_URL (e.g.
// http://localhost:5173/) uses the dev server instead. Output goes to promo/
// (OUT=dir). STYLE=anime renders in the anime art style, into promo/anime/
// (the default, lowpoly, is the low-poly look). Options (env): SETTLE_MS (extra
// wait after the game loads, before a still or a clip; default 1000), FPS (30),
// MUSIC (an audio file for the video; default the bundled Purrple Cat track,
// `none` for silence). Needs ffmpeg.
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
import {launch, requireGpu, serveDir} from './dev-browser.js';
import {ARTWORK, COMMON, SHOTS, TARGETS} from './promo-shots.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version: VERSION} = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
);
const USAGE =
  'Usage: node scripts/promo.js stills|urls [shot ...]\n' +
  '       node scripts/promo.js artwork [name ...]\n' +
  '       node scripts/promo.js video <target> [shot ...]\n' +
  '       node scripts/promo.js strip <target> [shot ...]';
const [mode, ...args] = process.argv.slice(2);
if (!['stills', 'artwork', 'video', 'urls', 'strip'].includes(mode)) {
  console.error(USAGE);
  process.exit(1);
}
const videoTargetName =
  mode === 'video' || mode === 'strip' ? args.shift() : null;
const videoTarget = videoTargetName && TARGETS[videoTargetName];
if (mode === 'video' && !videoTarget?.video) {
  const videoTargets = Object.keys(TARGETS).filter((t) => TARGETS[t].video);
  console.error(`${USAGE}\nVideo targets: ${videoTargets.join(', ')}`);
  process.exit(1);
}
if (mode === 'strip' && !videoTarget) {
  console.error(`${USAGE}\nTargets: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(1);
}
// STYLE=anime renders everything in the anime art style, into promo/anime/
// unless OUT says otherwise; the default is the low-poly look, into promo/
const STYLE = process.env.STYLE || 'lowpoly';
const OUT = path.resolve(
  process.env.OUT ||
    path.join(ROOT, 'promo', ...(STYLE === 'lowpoly' ? [] : [STYLE]))
);
const SETTLE_MS = Number(process.env.SETTLE_MS || 1000);
const FPS = Number(process.env.FPS || 30);
const PREROLL = Number(process.env.PREROLL || 1.5);
const MUSIC =
  process.env.MUSIC ||
  path.join(ROOT, 'public/assets/purrple-cat-birds-of-a-feather.mp3');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;

// Shots, or for artwork the ARTWORK names
const choices = mode === 'artwork' ? ARTWORK : SHOTS;
const selected = args.length ? args : Object.keys(choices);
for (const name of selected) {
  if (!choices[name]) {
    console.error(`Unknown name "${name}". Choices: ${Object.keys(choices)}`);
    process.exit(1);
  }
}

// A shot's URL for a target: the shared defaults, the shot's parameters, then
// its portrait/landscape ones and any per-target override (e.g. `iphone`)
function shotUrl(shot, target, gameBase, targetName) {
  const params = new URLSearchParams(COMMON);
  params.set('style', STYLE);
  const portrait = target.height > target.width;
  const queries = [
    shot.query,
    portrait ? shot.portrait : shot.landscape,
    targetName ? shot[targetName] : null,
  ];
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
      ['landscape', TARGETS.trailer],
      ['portrait', TARGETS.iphone],
    ]) {
      const shot = SHOTS[name];
      if (targetName === 'portrait' && !shot.portrait) continue;
      const url = new URL(shotUrl(shot, target, devBase));
      for (const k of ['ui', 'music']) url.searchParams.delete(k);
      url.searchParams.set('debug', '1');
      console.log(
        `${name}${shot.portrait ? ` (${targetName})` : ''}:\n  ${url}`
      );
    }
  }
  process.exit(0);
}

fs.mkdirSync(OUT, {recursive: true});

const STILL_SHOTS = Object.keys(SHOTS).filter((s) => SHOTS[s].still !== false);
function stillFile(shot, device) {
  const num = String(STILL_SHOTS.indexOf(shot) + 1).padStart(2, '0');
  return `${device}-${num}-${shot}.jpg`;
}

requireGpu(`promo.js ${mode}`);

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

function shotScriptDetail(shot) {
  if (
    shot.direct !== undefined ||
    shot.surface !== undefined ||
    shot.driveMoves ||
    shot.replay
  ) {
    return {
      moves: shot.moves,
      direct: shot.direct,
      surface: shot.surface,
      driveMoves: shot.driveMoves,
      replay: shot.replay,
    };
  }
  return shot.moves || null;
}

// Opens a shot in a fresh profile (saved settings like Zen or the livery don't
// carry over), emulating a phone or tablet for mobile targets so the game uses
// its touch layout, and waits for the scene to settle.
async function openShot(browser, shot, target, targetName) {
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
  await page.goto(shotUrl(shot, target, base, targetName), {
    waitUntil: 'load',
    timeout: 120000,
  });
  // Load and settle on near-frozen frames: terrain, the distant ring, shadows
  // and the sky's easing toward the set cloud cover. The title screen goes
  // away on its own (start=1).
  const started = Date.now();
  let loadedAt = 0;
  while (!loadedAt || Date.now() - loadedAt < SETTLE_MS) {
    if (Date.now() - started > SETTLE_MS + 600000) {
      throw new Error('The game did not finish loading');
    }
    await step(page, 0.001);
    const ready = await page.evaluate(
      () =>
        getComputedStyle(document.getElementById('loading-overlay')).display ===
          'none' && document.body.dataset.farReady === '1'
    );
    if (ready && !loadedAt) loadedAt = Date.now();
    await sleep(20);
  }
  // Then full size and real time, so the chase camera and the plane's motion
  // settle (and the renderer and shadows catch up with the new size)
  await page.setViewport(viewport(1));
  const prerollSec = shot.preroll ?? PREROLL;
  if (shot.camMoves || shot.camFrame || shot.wingmen) {
    await page.evaluate(
      ({camMoves, camFrame, wingmen, startOffsetMs}) => {
        if (camMoves || camFrame) {
          window.dispatchEvent(
            new CustomEvent('promo-camera', {
              detail: {camMoves, camFrame, startOffsetMs},
            })
          );
        }
        if (wingmen) {
          window.dispatchEvent(
            new CustomEvent('promo-wingmen', {
              detail: {wingmen, startOffsetMs},
            })
          );
        }
      },
      {
        camMoves: shot.camMoves || null,
        camFrame: shot.camFrame || null,
        wingmen: shot.wingmen || null,
        startOffsetMs: prerollSec * 1000,
      }
    );
  }
  for (let i = 0; i < Math.round(prerollSec * FPS); i++) {
    await step(page, 1000 / FPS);
  }
  const detail = shotScriptDetail(shot);
  if (mode !== 'video' && mode !== 'strip' && shot.stillTime) {
    if (detail) {
      await page.evaluate((d) => {
        window.dispatchEvent(new CustomEvent('promo-script', {detail: d}));
      }, detail);
    }
    for (let i = 0; i < Math.round(shot.stillTime * FPS); i++) {
      await step(page, 1000 / FPS);
    }
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

// A title or end card: the app icon over the name, then an optional tagline
// and any smaller lines (a credit, a web address), in the game's Inter, sized to the frame's
// shorter side. The background is a frame of the next or previous clip,
// blurred and darkened, so the video fades into the card rather than cutting
// to a flat one. `version` adds the game's version (package.json) small in
// the lower right corner.
function cardHtml({title, tagline, lines = [], version}, background) {
  const file = (rel) => 'file://' + path.join(ROOT, rel);
  const font = (weight) =>
    file(
      `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`
    );
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: Inter; font-weight: 300; src: url(${font(300)}); }
    @font-face { font-family: Inter; font-weight: 500; src: url(${font(500)}); }
    html, body { margin: 0; height: 100%; overflow: hidden; }
    body { display: flex; flex-direction: column; align-items: center;
      justify-content: center; font-family: Inter, sans-serif; color: #fff;
      text-align: center; background: #0f0f1a; }
    body::before { content: ''; position: fixed; inset: -8%; z-index: -1;
      background: url(${background}) center / cover;
      filter: blur(5vmin) brightness(0.45) saturate(1.2); }
    img { width: 30vmin; height: 30vmin; border-radius: 22.5%;
      box-shadow: 0 2vmin 6vmin rgba(0, 0, 0, 0.5); }
    h1 { margin: 6vmin -0.35em 0 0; font-weight: 500; font-size: 6vmin;
      letter-spacing: 0.35em; }
    p { margin: 2.5vmin 0 0; font-weight: 300; font-size: 4.6vmin;
      letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.8); }
    p.small { margin-top: 3vmin; font-weight: 500; font-size: 3.4vmin;
      letter-spacing: 0.15em; color: rgba(255, 255, 255, 0.6); }
    h1 + p.small { margin-top: 4vmin; }
    .version { position: fixed; right: 4vmin; bottom: 3.5vmin;
      font-weight: 300; font-size: 2.4vmin; letter-spacing: 0.06em;
      color: rgba(255, 255, 255, 0.45); }
    /* Landscape has room to spare across, so the lockup is a little smaller */
    @media (orientation: landscape) {
      img { width: 22vmin; height: 22vmin; }
      h1 { margin-top: 4.5vmin; font-size: 5vmin; }
      p { font-size: 3.6vmin; }
      p.small { font-size: 2.6vmin; }
    }
  </style><img src="${file('public/icon-512.png')}" alt=""><h1>${title}</h1>${
    tagline ? `<p>${tagline}</p>` : ''
  }${lines.map((line) => `<p class="small">${line}</p>`).join('')}${
    version ? `<div class="version">v${VERSION}</div>` : ''
  }`;
}

async function renderCard(browser, card, background, target, file) {
  const page = await browser.newPage();
  await page.setViewport({
    width: target.width,
    height: target.height,
    deviceScaleFactor: target.scale || 1,
  });
  const html = path.join(OUT, 'card.html');
  fs.writeFileSync(html, cardHtml(card, 'file://' + background));
  await page.goto('file://' + html, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: file});
  await page.close();
  fs.rmSync(html);
}

// The app icon and name in the lower left, sized to the frame's width (and
// shown over ui=0, which hides everything but the game view)
async function addLogo(page) {
  await page.evaluate(() => {
    const logo = document.createElement('div');
    logo.style.cssText =
      'position:fixed;left:5vw;bottom:6vw;z-index:2147483647;display:flex;' +
      'align-items:center;gap:2.5vw;visibility:visible !important';
    const icon = document.createElement('img');
    icon.src = new URL('icon-512.png', location.href).href;
    icon.style.cssText =
      'width:12vw;height:12vw;border-radius:22.5%;' +
      'box-shadow:0 1vw 3vw rgba(0,0,0,0.5);visibility:visible !important';
    const name = document.createElement('span');
    name.textContent = 'CHILL FLIGHT';
    name.style.cssText =
      'font:500 5.4vw Inter,sans-serif;letter-spacing:0.3em;color:#fff;' +
      'text-shadow:0 0.4vw 2vw rgba(0,0,0,0.6);visibility:visible !important';
    logo.append(icon, name);
    document.body.append(logo);
    return icon.decode();
  });
}

const H264 = ['-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p'];

const browser = await launch();
try {
  if (mode === 'artwork') {
    const artDir = path.join(OUT, 'artwork');
    fs.mkdirSync(artDir, {recursive: true});
    for (const name of selected) {
      const art = ARTWORK[name];
      const base = SHOTS[art.shot];
      const shot = art.query
        ? {...base, query: `${base.query}&${art.query}`}
        : base;
      const page = await openShot(browser, shot, art);
      if (art.logo) await addLogo(page);
      const file = path.join(artDir, `${name}.${art.png ? 'png' : 'jpg'}`);
      if (art.png) {
        // Browser PNGs carry an alpha channel; the App Store wants plain RGB
        const rgba = file.replace(/\.png$/, '-rgba.png');
        await page.screenshot({path: rgba, type: 'png'});
        ffmpeg(['-i', rgba, '-pix_fmt', 'rgb24', file]);
        fs.rmSync(rgba);
      } else {
        await page.screenshot({path: file, type: 'jpeg', quality: 92});
      }
      reportErrors(name, page);
      await page.close();
      console.log(file);
    }
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
        const page = await openShot(
          browser,
          SHOTS[name],
          TARGETS[targetName],
          targetName
        );
        const file = path.join(OUT, stillFile(name, targetName));
        await page.screenshot({path: file, type: 'jpeg', quality: 92});
        reportErrors(name, page);
        await page.close();
        console.log(file);
      }
    }
  }

  if (mode === 'strip') {
    const stepSec = Number(process.env.STEP || 0.4);
    const stripDir = path.join(OUT, 'strips');
    fs.mkdirSync(stripDir, {recursive: true});
    // Render at native CSS dimensions with scale=1 so HUD and aspect ratio match
    // the real target, then shrink each tile with ffmpeg when assembling the grid.
    const stripTarget = {...videoTarget, scale: 1};
    const portrait = stripTarget.height > stripTarget.width;
    const tileW = portrait ? 280 : 420;
    const tileH = Math.round((tileW * stripTarget.height) / stripTarget.width);
    const cols = portrait ? 5 : 4;
    for (const name of selected) {
      const shot = SHOTS[name];
      const dur = shot.seconds || 4;
      const frameDir = path.join(stripDir, `frames-${videoTargetName}-${name}`);
      fs.rmSync(frameDir, {recursive: true, force: true});
      fs.mkdirSync(frameDir, {recursive: true});
      const page = await openShot(browser, shot, stripTarget, videoTargetName);
      const detail = shotScriptDetail(shot);
      if (detail) {
        await page.evaluate((d) => {
          window.dispatchEvent(new CustomEvent('promo-script', {detail: d}));
        }, detail);
      }
      // Small timestamp badge in the top-left corner of each tile
      await page.evaluate(() => {
        const badge = document.createElement('div');
        badge.id = '__promo-strip-badge';
        badge.style.cssText =
          'position:fixed;left:2vw;top:2vw;z-index:2147483647;' +
          'padding:1.2vw 2.2vw;border-radius:1vw;background:rgba(0,0,0,0.78);' +
          'color:#ffd34d;font:700 5vw/1 monospace;visibility:visible !important';
        document.body.append(badge);
      });
      const totalFrames = Math.round(dur * FPS);
      const stepFrames = Math.max(1, Math.round(stepSec * FPS));
      const tiles = [];
      for (let i = 0; i <= totalFrames; i++) {
        if (i > 0) await step(page, 1000 / FPS);
        if (i % stepFrames === 0 || i === totalFrames) {
          const tSec = i / FPS;
          await page.evaluate(
            (label) => {
              document.getElementById('__promo-strip-badge').textContent =
                label;
            },
            `t=${tSec.toFixed(2)}`
          );
          const tile = path.join(
            frameDir,
            `${String(tiles.length).padStart(3, '0')}.jpg`
          );
          await page.screenshot({path: tile, type: 'jpeg', quality: 85});
          tiles.push(tile);
        }
      }
      reportErrors(name, page);
      await page.close();
      const layout = tiles
        .map((_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`)
        .join('|');
      const scaled = tiles
        .map((_, i) => `[${i}:v]scale=${tileW}:${tileH}[v${i}]`)
        .join(';');
      const inputs = tiles.map((_, i) => `[v${i}]`).join('');
      const out = path.join(stripDir, `${videoTargetName}-${name}.jpg`);
      ffmpeg([
        ...tiles.flatMap((f) => ['-i', f]),
        ...(tiles.length > 1
          ? [
              '-filter_complex',
              `${scaled};${inputs}xstack=inputs=${tiles.length}:layout=${layout}:fill=black`,
            ]
          : ['-vf', `scale=${tileW}:${tileH}`]),
        ...['-frames:v', '1', out],
      ]);
      fs.rmSync(frameDir, {recursive: true, force: true});
      console.log(out);
    }
  }

  if (mode === 'video') {
    const target = videoTarget;
    const allShots = (target.shots || Object.keys(SHOTS)).filter(
      (name) => SHOTS[name]?.seconds
    );
    const clipFile = (name) => {
      const num = String(allShots.indexOf(name) + 1).padStart(2, '0');
      return path.join(OUT, `${videoTargetName}-clip-${num}-${name}.mp4`);
    };
    const pixelW = Math.round(target.width * (target.scale || 1));
    const pixelH = Math.round(target.height * (target.scale || 1));
    const clips = [];
    // The first clip's first frame and the last clip's last frame, as the
    // title and end cards' backgrounds
    const firstFrame = path.join(OUT, `${videoTargetName}-first-frame.jpg`);
    const lastFrame = path.join(OUT, `${videoTargetName}-last-frame.jpg`);
    const addCard = async (card, i, background) => {
      const png = path.join(OUT, `${videoTargetName}-card-${i}.png`);
      const mp4 = png.replace(/\.png$/, '.mp4');
      await renderCard(browser, card, background, target, png);
      ffmpeg([
        ...['-loop', '1', '-framerate', String(FPS), '-i', png],
        ...['-t', String(card.seconds), ...H264, mp4],
      ]);
      fs.rmSync(png);
      return {mp4, seconds: card.seconds};
    };
    const videoShots = args.length ? selected : target.shots || selected;
    for (const name of videoShots) {
      const shot = SHOTS[name];
      if (!shot.seconds) continue;
      const frameDir = path.join(OUT, `frames-${name}`);
      fs.rmSync(frameDir, {recursive: true, force: true});
      fs.mkdirSync(frameDir, {recursive: true});
      const page = await openShot(browser, shot, target, videoTargetName);
      // Filming starts now: a shot's moves (scripted banks and pull ups),
      // driveMoves, or replay run from this frame on the virtual clock
      const detail = shotScriptDetail(shot);
      if (detail) {
        await page.evaluate((d) => {
          window.dispatchEvent(new CustomEvent('promo-script', {detail: d}));
        }, detail);
      }
      const frames = Math.round(shot.seconds * FPS);
      const frameFile = (i) =>
        path.join(frameDir, `${String(i).padStart(5, '0')}.jpg`);
      for (let i = 0; i < frames; i++) {
        await step(page, 1000 / FPS);
        await page.screenshot({
          path: frameFile(i),
          type: 'jpeg',
          quality: 95,
        });
        if (i % FPS === 0) console.log(`  ${name}: ${i}/${frames} frames`);
      }
      reportErrors(name, page);
      await page.close();
      const mp4 = clipFile(name);
      ffmpeg([
        ...['-framerate', String(FPS), '-i', path.join(frameDir, '%05d.jpg')],
        ...['-vf', `scale=${pixelW}:${pixelH}`, ...H264, mp4],
      ]);
      fs.rmSync(frameDir, {recursive: true, force: true});
      console.log(mp4);
    }
    for (const name of allShots) {
      const mp4 = clipFile(name);
      if (fs.existsSync(mp4)) {
        clips.push({mp4, seconds: SHOTS[name].seconds});
      }
    }
    ffmpeg(['-i', clips[0].mp4, '-frames:v', '1', firstFrame]);
    ffmpeg([
      '-sseof',
      '-0.1',
      '-i',
      clips.at(-1).mp4,
      '-frames:v',
      '1',
      lastFrame,
    ]);
    const {titleCard, endCard} = target;
    const parts = [
      ...(titleCard ? [await addCard(titleCard, 0, firstFrame)] : []),
      ...clips,
      ...(endCard ? [await addCard(endCard, 1, lastFrame)] : []),
    ];
    fs.rmSync(firstFrame, {force: true});
    fs.rmSync(lastFrame, {force: true});

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
    const video = path.join(OUT, `${videoTargetName}-full-chill-flight.mp4`);
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
