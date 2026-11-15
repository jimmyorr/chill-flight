// Renders the 3:19 (1920x1080, 30 fps) Chill Flight evolution video from
// commit 88d428c4 (Feb 25, 2026) through v1.2.10, set to Purrple Cat's
// "Going with the Flow" (see scripts/evolution-shots.js).
//
// Usage:
//   node scripts/evolution.js sheet [shot ...]           640x360 contact sheet
//                                                        in promo/evolution/sheet.jpg
//   node scripts/evolution.js clips [shot ...] [--force] individual 1920x1080 clips
//                                                        in promo/evolution/clip-*.mp4
//   node scripts/evolution.js thumb [--variant=name]     1920x1080 YouTube thumbnail
//                                                        in promo/chill-flight-evolution-thumb.jpg
//   node scripts/evolution.js stitch                     cards + xfade/cut edit + music
//                                                        into promo/chill-flight-evolution.mp4
//   node scripts/evolution.js video [shot ...] [--force] clips, stitch, and thumb

import {execFileSync, execSync} from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch, requireGpu, serveDir} from './dev-browser.js';
import {
  EVOLUTION_CHAPTERS,
  EVOLUTION_END_CARD,
  EVOLUTION_FADE_SEC,
  EVOLUTION_MUSIC,
  EVOLUTION_SHOTS,
  EVOLUTION_THUMBNAILS,
  EVOLUTION_TITLE_CARD,
} from './evolution-shots.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version: VERSION} = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
);

const PROMO_DIR = path.resolve(process.env.OUT || path.join(ROOT, 'promo'));
const EVO_DIR = path.join(PROMO_DIR, 'evolution');
const CACHE_DIR = path.join(PROMO_DIR, 'music-cache');
const BUNDLED_MUSIC = path.join(
  ROOT,
  'public/assets/purrple-cat-birds-of-a-feather.mp3'
);
const R2_BASE =
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = Number(process.env.FPS || 30);
const DEFAULT_PREROLL = Number(process.env.PREROLL || 1.5);
const SETTLE_MS = Number(process.env.SETTLE_MS || 1800);
const SHOT_TIMEOUT_MS = 90000;

const USAGE =
  'Usage: node scripts/evolution.js sheet|clips|video [shot ...] [--force]\n' +
  '       node scripts/evolution.js thumb [--variant=lighthouse|falls] [--out=path]\n' +
  '       node scripts/evolution.js stitch';

const rawArgs = process.argv.slice(2);
const FORCE = rawArgs.includes('--force');
const variantArg = rawArgs
  .find((a) => a.startsWith('--variant='))
  ?.slice('--variant='.length);
const outArg = rawArgs
  .find((a) => a.startsWith('--out='))
  ?.slice('--out='.length);
const THUMB_VARIANT = variantArg || 'lighthouse';
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const [mode, ...shotArgs] = positional;

if (!['sheet', 'clips', 'thumb', 'stitch', 'video'].includes(mode)) {
  console.error(USAGE);
  process.exit(1);
}
if (!EVOLUTION_THUMBNAILS[THUMB_VARIANT]) {
  console.error(
    `Unknown thumbnail variant "${THUMB_VARIANT}". Choices: ${Object.keys(EVOLUTION_THUMBNAILS).join(', ')}`
  );
  process.exit(1);
}

const shotsById = new Map(EVOLUTION_SHOTS.map((s) => [s.id, s]));
for (const id of shotArgs) {
  if (!shotsById.has(id)) {
    console.error(
      `Unknown shot "${id}". Choices:\n  ${EVOLUTION_SHOTS.map((s) => s.id).join('\n  ')}`
    );
    process.exit(1);
  }
}
const selectedShots = shotArgs.length
  ? shotArgs.map((id) => shotsById.get(id))
  : EVOLUTION_SHOTS;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H264 = [
  '-c:v',
  'libx264',
  '-preset',
  'medium',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
  '-r',
  String(FPS),
];

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: 'inherit'});
}

function probeDurationSec(mp4Path) {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        mp4Path,
      ],
      {encoding: 'utf8'}
    ).trim();
    return Number(out) || 0;
  } catch {
    return 0;
  }
}

function downloadTrack(slug) {
  fs.mkdirSync(CACHE_DIR, {recursive: true});
  const file = path.join(CACHE_DIR, `purrple-cat-${slug}.mp3`);
  if (fs.existsSync(file) && fs.statSync(file).size > 100000) {
    return Promise.resolve(file);
  }
  const url = `${R2_BASE}/purrple-cat-${slug}.mp3`;
  console.log(`Downloading ${url} ...`);
  return new Promise((resolve) => {
    const req = https.get(url, {timeout: 12000}, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        console.warn(
          `Warning: ${url} returned ${res.statusCode}; falling back to bundled track`
        );
        resolve(BUNDLED_MUSIC);
        return;
      }
      const out = fs.createWriteStream(file);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(file)));
      out.on('error', () => resolve(BUNDLED_MUSIC));
    });
    req.on('error', () => resolve(BUNDLED_MUSIC));
    req.on('timeout', () => {
      req.destroy();
      resolve(BUNDLED_MUSIC);
    });
  });
}

// Local font & Three.js r128 buffers served via Puppeteer request interception
// so early Feb-Mar commits need no external CDN and every era renders the exact
// same Inter badge typography.
const INTER_500_BUF = fs.readFileSync(
  path.join(
    ROOT,
    'node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2'
  )
);
const INTER_700_BUF = fs.readFileSync(
  path.join(
    ROOT,
    'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2'
  )
);
let threeR128Buf = null;
function getThreeR128Buf() {
  if (!threeR128Buf) {
    threeR128Buf = execFileSync('git', ['show', 'v0.8.0:vendor/three.min.js'], {
      cwd: ROOT,
      maxBuffer: 10 * 1024 * 1024,
    });
  }
  return threeR128Buf;
}

// Installed before page scripts execute: virtualizes requestAnimationFrame,
// performance.now, and Date.now, silences live audio/WebAudio, and optionally
// seeds Math.random for pre-2026-03-05 commits.
function installEraEnvironment({epochMs, seedRandom}) {
  const startPerf = performance.now();
  const baseDate = epochMs || 1790000000000;
  const clock = {t: startPerf, calls: 0, pending: []};
  performance.now = () => clock.t + clock.calls++ * 0.001;
  Date.now = () => Math.round(baseDate + (clock.t - startPerf));
  window.requestAnimationFrame = (cb) => clock.pending.push(cb);
  window.__evoStep = (dt) => {
    clock.t += dt;
    clock.calls = 0;
    const cbs = clock.pending.splice(0);
    for (const cb of cbs) cb(clock.t);
  };

  if (typeof seedRandom === 'number') {
    let a = seedRandom >>> 0;
    Math.random = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  try {
    localStorage.setItem('chill_flight_music_enabled', 'false');
    localStorage.setItem('chill_flight_graphics_preset', 'high');
    localStorage.removeItem('chill_flight_show_objects');
  } catch {
    // Storage unavailable on opaque origins.
  }

  // Silence HTML5 audio elements so historical builds never emit sound or
  // reject autoplay promises during headless capture.
  HTMLMediaElement.prototype.play = function () {
    return Promise.resolve();
  };

  // Helper to find ES module instances in modern Vite builds (v0.9.35+).
  window.gameModule = (name) =>
    import(
      performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .find((u) => new URL(u).pathname === '/' + name) || '/' + name
    );
}

// Steps two 60 Hz sub-ticks (2 x 16.667 ms = 33.333 ms) per 30 fps frame so
// pre-April-2026 commits (whose physics stepped once per rAF assuming 60 Hz)
// and modern delta-timed builds both fly at exact 1x real-time speed.
// Passing forceLightning = true pins Math.random near zero for one sub-tick so
// weather-manager.js triggers a natural ground-strike flash even in bundled builds.
async function stepFrame30(page, forceLightning = false) {
  await page.evaluate((flash) => {
    if (flash) {
      const orig = Math.random;
      Math.random = () => 0.00001;
      try {
        window.__evoStep(1000 / 60);
      } finally {
        Math.random = orig;
      }
      window.__evoStep(1000 / 60);
      return;
    }
    window.__evoStep(1000 / 60);
    window.__evoStep(1000 / 60);
  }, forceLightning);
}

async function addEvolutionBadge(page, {badgeTop, badgeSub, badgePos, showUi}) {
  await page.evaluate(
    async ({topText, subText, pos, keepUi}) => {
      let style = document.getElementById('evo-overlay-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'evo-overlay-style';
        style.textContent = `
          @font-face {
            font-family: 'EvoInter';
            font-weight: 500;
            src: url('https://evo-local.invalid/inter-500.woff2') format('woff2');
          }
          @font-face {
            font-family: 'EvoInter';
            font-weight: 700;
            src: url('https://evo-local.invalid/inter-700.woff2') format('woff2');
          }
          body.evo-ui-hidden * {
            visibility: hidden !important;
          }
          body.evo-ui-hidden > canvas,
          #evo-badge,
          #evo-badge * {
            visibility: visible !important;
          }
          #loading-overlay,
          #pause-overlay,
          #mobile-controls,
          #start-plane-tooltip,
          #yt-container {
            display: none !important;
            visibility: hidden !important;
          }
        `;
        document.head.appendChild(style);
      }

      if (!keepUi) {
        document.body.classList.add('evo-ui-hidden');
      } else {
        document.body.classList.remove('evo-ui-hidden');
      }

      let badge = document.getElementById('evo-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'evo-badge';
        document.body.appendChild(badge);
      }

      const cornerCss =
        pos === 'top-left'
          ? 'top: 38px; left: 44px;'
          : pos === 'bottom-right'
            ? 'bottom: 40px; right: 44px;'
            : 'bottom: 40px; left: 44px;';

      badge.style.cssText = `
        position: fixed;
        ${cornerCss}
        z-index: 2147483647;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 14px 22px 15px;
        border-radius: 16px;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.22);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.38);
        font-family: 'EvoInter', Inter, -apple-system, sans-serif;
        color: #fff;
      `;

      badge.innerHTML = `
        <div style="font-size: 14px; font-weight: 700; letter-spacing: 0.11em; color: #7dd3fc;">${topText}</div>
        <div style="font-size: 19px; font-weight: 500; letter-spacing: 0.01em; color: rgba(255, 255, 255, 0.96);">${subText}</div>
      `;

      try {
        await document.fonts.ready;
      } catch {
        // Ignore font readiness errors.
      }
    },
    {
      topText: badgeTop,
      subText: badgeSub,
      pos: badgePos || 'bottom-left',
      keepUi: Boolean(showUi),
    }
  );
}

// Title and end card HTML matching promo.js's lockup over a blurred gameplay frame.
function cardHtml({title, tagline, lines = [], version}, backgroundUrl) {
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
      background: url(${backgroundUrl}) center / cover;
      filter: blur(5vmin) brightness(0.45) saturate(1.2); }
    img { width: 22vmin; height: 22vmin; border-radius: 22.5%;
      box-shadow: 0 2vmin 6vmin rgba(0, 0, 0, 0.5); }
    h1 { margin: 4.5vmin -0.35em 0 0; font-weight: 500; font-size: 5vmin;
      letter-spacing: 0.35em; }
    p { margin: 2.5vmin 0 0; font-weight: 300; font-size: 3.6vmin;
      letter-spacing: 0.04em; color: rgba(255, 255, 255, 0.84); }
    p.small { margin-top: 2.6vmin; font-weight: 500; font-size: 2.5vmin;
      letter-spacing: 0.14em; color: rgba(255, 255, 255, 0.62); }
    h1 + p.small { margin-top: 4vmin; }
    .version { position: fixed; right: 4vmin; bottom: 3.5vmin;
      font-weight: 300; font-size: 2.4vmin; letter-spacing: 0.06em;
      color: rgba(255, 255, 255, 0.45); }
  </style><img src="${file('public/icon-512.png')}" alt=""><h1>${title}</h1>${
    tagline ? `<p>${tagline}</p>` : ''
  }${lines.map((line) => `<p class="small">${line}</p>`).join('')}${
    version ? `<div class="version">v${VERSION}</div>` : ''
  }`;
}

async function renderCardClip(browser, card, backgroundImg, outMp4) {
  const page = await browser.newPage();
  await page.setViewport({width: WIDTH, height: HEIGHT, deviceScaleFactor: 1});
  const htmlPath = outMp4.replace(/\.mp4$/, '.html');
  const pngPath = outMp4.replace(/\.mp4$/, '.png');
  fs.writeFileSync(htmlPath, cardHtml(card, 'file://' + backgroundImg));
  await page.goto('file://' + htmlPath, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: pngPath, type: 'png'});
  await page.close();
  fs.rmSync(htmlPath, {force: true});
  ffmpeg([
    '-loop',
    '1',
    '-framerate',
    String(FPS),
    '-i',
    pngPath,
    '-t',
    String(card.seconds),
    ...H264,
    outMp4,
  ]);
  fs.rmSync(pngPath, {force: true});
}

function thumbHtml(preset, leftImgPath, rightImgPath) {
  const file = (rel) => 'file://' + path.join(ROOT, rel);
  const font = (weight) =>
    file(
      `node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`
    );
  const leftLabel = preset.left.labelVersion
    ? `v${VERSION}`
    : preset.left.label;
  const rightLabel = preset.right.labelVersion
    ? `v${VERSION}`
    : preset.right.label;

  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: Inter; font-weight: 500; src: url(${font(500)}); }
    @font-face { font-family: Inter; font-weight: 700; src: url(${font(700)}); }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      background: #0b1120;
      font-family: Inter, -apple-system, sans-serif;
    }
    .half {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .half.left {
      clip-path: polygon(0 0, 52.5% 0, 47.5% 100%, 0 100%);
    }
    .half.right {
      clip-path: polygon(52.5% 0, 100% 0, 100% 100%, 47.5% 100%);
    }
    .half img {
      position: absolute;
      left: 0;
      top: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      transform-origin: 0 0;
      filter: contrast(1.04) saturate(1.06);
    }
    .divider {
      position: absolute;
      inset: 0;
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      pointer-events: none;
      z-index: 5;
    }
    .pill {
      position: absolute;
      top: 40px;
      z-index: 10;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 26px 16px;
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.86);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1.5px solid rgba(255, 255, 255, 0.28);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.44);
      color: #fff;
    }
    .pill.left {
      left: 44px;
      align-items: flex-start;
    }
    .pill.right {
      right: 44px;
      align-items: flex-end;
      text-align: right;
    }
    .eyebrow {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: #7dd3fc;
      line-height: 1.1;
    }
    .headline {
      font-size: 42px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #fff;
      line-height: 1.05;
    }
  </style>
  <div class="half left">
    <img src="file://${leftImgPath}" alt="" style="transform: translate(${preset.left.tx}px, ${preset.left.ty}px) scale(${preset.left.scale});">
  </div>
  <div class="half right">
    <img src="file://${rightImgPath}" alt="" style="transform: translate(${preset.right.tx}px, ${preset.right.ty}px) scale(${preset.right.scale});">
  </div>
  <svg class="divider" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none">
    <defs>
      <filter id="seam-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="rgba(0,0,0,0.65)"/>
      </filter>
    </defs>
    <line x1="${WIDTH * 0.525}" y1="-12" x2="${WIDTH * 0.475}" y2="${HEIGHT + 12}"
      stroke="#ffffff" stroke-width="6" filter="url(#seam-shadow)"/>
  </svg>
  <div class="pill left">
    <div class="eyebrow">${preset.left.eyebrow}</div>
    <div class="headline">${leftLabel}</div>
  </div>
  <div class="pill right">
    <div class="eyebrow">${preset.right.eyebrow}</div>
    <div class="headline">${rightLabel}</div>
  </div>`;
}

function formatTimestamp(sec) {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function writeMetadataSidecar(outMp4, chapterLines) {
  const txtPath = outMp4.replace(/\.mp4$/, '.txt');
  const body = [
    '=== YouTube ===',
    'Title:',
    `9 months of building Chill Flight: from prototype to v${VERSION}`,
    '',
    'Description:',
    `A chronological look back at 9 months of building Chill Flight, from the earliest prototype on February 25, 2026 to v${VERSION}.`,
    '',
    'Browser (free, no install): https://chillflight.app',
    'iOS App Store: https://apps.apple.com/us/app/chill-flight/id6779847377',
    'Android (early access): https://chillflight.app/about',
    'Release archive & playable versions: https://github.com/jimmyorr/chill-flight/blob/main/RELEASE_NOTES.md',
    '',
    'Chapters:',
    ...chapterLines,
    '',
    `Music by ${EVOLUTION_MUSIC.artist} ("${EVOLUTION_MUSIC.title}", https://purrplecat.com, CC BY 4.0 / freelofi).`,
    '',
    'Have a chill flight.',
    '',
    '#chillflight #indiedev #gamedev #threejs #webgl #cozygames #lofi #flightsimulator',
  ].join('\n');
  fs.writeFileSync(txtPath, `${body}\n`);
  console.log(txtPath);
}

requireGpu(`evolution.js ${mode}`);
fs.mkdirSync(EVO_DIR, {recursive: true});

// Ephemeral workspace root for extracted git commits and current build.
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'chill-flight-evo-'));
const gitServers = new Map();
let currentBuildServer = null;
let currentBuildBase = null;

async function resolveShotUrl(shot) {
  const {source, query} = shot;
  const suffix = query ? `?${query}` : '';

  if (source.type === 'pages') {
    const slug = source.version.replace(/\./g, '-');
    return `https://v${slug}.chill-flight.pages.dev/${suffix}`;
  }

  if (source.type === 'current') {
    if (!currentBuildBase) {
      if (process.env.GAME_URL) {
        currentBuildBase = process.env.GAME_URL.replace(/\/?$/, '/');
      } else {
        const buildDir = path.join(tempRoot, 'current-build');
        console.log(`Building current HEAD to ${buildDir} ...`);
        execSync(`npx vite build --outDir "${buildDir}" --emptyOutDir`, {
          cwd: ROOT,
          stdio: ['ignore', 'ignore', 'inherit'],
        });
        currentBuildServer = await serveDir(buildDir);
        currentBuildBase = `http://localhost:${currentBuildServer.address().port}/`;
      }
    }
    return `${currentBuildBase}${suffix}`;
  }

  if (source.type === 'git') {
    let entry = gitServers.get(source.ref);
    if (!entry) {
      const dir = path.join(tempRoot, `git-${source.ref}`);
      fs.mkdirSync(dir, {recursive: true});
      // Extract historical tree excluding docs/ so compiled bundles are never read or unpacked.
      execSync(
        `git archive "${source.ref}" | tar -x --exclude="docs" --exclude="docs/*" -C "${dir}"`,
        {cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit']}
      );
      const srv = await serveDir(dir);
      entry = {
        dir,
        server: srv,
        base: `http://localhost:${srv.address().port}/`,
      };
      gitServers.set(source.ref, entry);
    }
    const pagePath = source.entry || '';
    return `${entry.base}${pagePath}${suffix}`;
  }

  throw new Error(`Unsupported source type: ${source.type}`);
}

async function openEraShot(browser, shot) {
  const url = await resolveShotUrl(shot);
  const targetOrigin = new URL(url).origin;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (err) => {
    const msg = err?.message || String(err);
    if (/firebase|youtube|YT|Sentry|Failed to fetch/i.test(msg)) return;
    page.errors.push(msg);
  });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = req.url();
    if (u === 'https://evo-local.invalid/inter-500.woff2') {
      req
        .respond({
          status: 200,
          headers: {'Access-Control-Allow-Origin': '*'},
          contentType: 'font/woff2',
          body: INTER_500_BUF,
        })
        .catch(() => {});
      return;
    }
    if (u === 'https://evo-local.invalid/inter-700.woff2') {
      req
        .respond({
          status: 200,
          headers: {'Access-Control-Allow-Origin': '*'},
          contentType: 'font/woff2',
          body: INTER_700_BUF,
        })
        .catch(() => {});
      return;
    }
    if (
      u.includes('cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
    ) {
      req
        .respond({
          status: 200,
          contentType: 'application/javascript',
          body: getThreeR128Buf(),
        })
        .catch(() => {});
      return;
    }
    if (/youtube\.com\/iframe_api|googletagmanager\.com\/gtag\/js/.test(u)) {
      req
        .respond({
          status: 200,
          contentType: 'application/javascript',
          body: '/* stubbed for offline deterministic capture */',
        })
        .catch(() => {});
      return;
    }
    if (
      !u.startsWith(targetOrigin) &&
      /google-analytics|analytics\.google|firebase|gstatic\.com\/firebasejs|googleapis\.com|sentry\.io/.test(
        u
      )
    ) {
      req.abort('blockedbyclient').catch(() => {});
      return;
    }
    req.continue().catch(() => {});
  });

  await page.evaluateOnNewDocument(installEraEnvironment, {
    epochMs: shot.epochMs || null,
    seedRandom: shot.seedRandom ?? null,
  });

  await page.setViewport({width: WIDTH, height: HEIGHT, deviceScaleFactor: 1});

  const hasAutoStart = /[?&]start=1(?:&|$)/.test(url);

  try {
    await page.goto(url, {waitUntil: 'load', timeout: SHOT_TIMEOUT_MS});

    // Dismiss early calibration/start screens and unpause before staging.
    // On modern ?start=1 builds, let the game hide #loading-overlay itself
    // once its Web Worker terrain chunk queue finishes building around spawn.
    await page.evaluate((autoStart) => {
      const runGlobal = new Function(`
        if (typeof finishCalibration === 'function') {
          try { finishCalibration(); } catch {}
        }
        if (typeof isPaused !== 'undefined') {
          isPaused = false;
        }
        if (typeof maxFPS !== 'undefined') {
          maxFPS = 0;
        }
        if (typeof frameMinDelay !== 'undefined') {
          frameMinDelay = 0;
        }
      `);
      runGlobal();
      if (!autoStart) {
        const beginBtn = document.getElementById('begin-btn');
        if (beginBtn && getComputedStyle(beginBtn).display !== 'none') {
          beginBtn.click();
        }
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
      }
    }, hasAutoStart);

    // Apply era-specific staging (plane position, heading, weather, vehicle)
    // in the page's global lexical scope so chunks generate at the target site.
    if (shot.stageCode) {
      await page.evaluate((code) => {
        const fn = new Function(code);
        fn();
      }, shot.stageCode);
    }

    // Settle on near-frozen virtual frames (dt = 0.001 ms) while async chunk
    // builders, web workers, and far terrain finish populating meshes.
    const shotSettleMs = shot.settleMs ?? SETTLE_MS;
    const started = Date.now();
    let readySince = 0;
    while (!readySince || Date.now() - readySince < shotSettleMs) {
      if (Date.now() - started > SHOT_TIMEOUT_MS) {
        throw new Error(`Timed out settling shot ${shot.id} (${url})`);
      }
      await page.evaluate(() => window.__evoStep(0.001));
      const isReady = await page.evaluate(
        ({needsFar, autoStart}) => {
          const runCheck = new Function(`
            if (typeof isPaused !== 'undefined' && isPaused) isPaused = false;
            if (typeof maxFPS !== 'undefined' && maxFPS > 0) maxFPS = 0;
            if (typeof frameMinDelay !== 'undefined' && frameMinDelay > 0) frameMinDelay = 0;
            if (typeof chunks !== 'undefined' && chunks.size === 0) return false;
            return true;
          `);
          if (!runCheck()) return false;
          if (autoStart) {
            const overlay = document.getElementById('loading-overlay');
            if (overlay && getComputedStyle(overlay).display !== 'none') {
              return false;
            }
          }
          if (needsFar && document.body.dataset.farReady !== '1') return false;
          return true;
        },
        {needsFar: Boolean(shot.hasFarReady), autoStart: hasAutoStart}
      );

      if (isReady && !readySince) readySince = Date.now();
      await sleep(25);
    }

    // Re-apply stageCode once chunks have settled so any elevation lookup or
    // camera placement starts cleanly right before preroll.
    if (shot.stageCode) {
      await page.evaluate((code) => {
        const fn = new Function(code);
        fn();
      }, shot.stageCode);
    }

    // Run one-time post-settle actions (e.g. starting local bot rooms or races)
    // right before preroll.
    if (shot.afterSettleCode) {
      await page.evaluate((code) => {
        const fn = new Function(code);
        fn();
      }, shot.afterSettleCode);
    }

    await addEvolutionBadge(page, shot);

    const prerollSec = shot.preroll ?? DEFAULT_PREROLL;
    const prerollFrames = Math.round(prerollSec * FPS);
    for (let i = 0; i < prerollFrames; i++) {
      await stepFrame30(page);
    }

    if (shot.mouseNorm) {
      const [nx, ny] = shot.mouseNorm;
      const clientX = Math.round((nx + 1) * 0.5 * WIDTH);
      const clientY = Math.round((1 - ny) * 0.5 * HEIGHT);
      await page.mouse.move(clientX, clientY);
    }

    if (shot.moves) {
      await page.evaluate((moves) => {
        window.dispatchEvent(new CustomEvent('promo-script', {detail: moves}));
      }, shot.moves);
    }
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }

  page.close = async () => context.close();
  return page;
}

let failed = false;
function reportErrors(id, page) {
  if (page.errors.length) {
    console.error(`  ${id} page errors:\n    ${page.errors.join('\n    ')}`);
    failed = true;
  }
}

async function runSheet(browser) {
  const tileW = 640;
  const tileH = 360;
  const tileFiles = [];

  for (const shot of selectedShots) {
    const smallTile = path.join(EVO_DIR, `sheet-${shot.id}.jpg`);
    if (!FORCE && !shotArgs.length && fs.existsSync(smallTile)) {
      console.log(`[sheet] Using cached ${shot.id}`);
      tileFiles.push(smallTile);
      continue;
    }
    console.log(`[sheet] ${shot.id} (${shot.badgeTop}) ...`);
    const page = await openEraShot(browser, shot);
    // Advance into the shot so moves, smoke, banking, or collisions show clearly.
    const midSteps = Math.round((shot.sheetSec ?? 1.2) * FPS);
    for (let i = 0; i < midSteps; i++) {
      if (shot.timedActions) {
        for (const act of shot.timedActions) {
          if (Math.round(act.atSec * FPS) === i) {
            await page.evaluate((code) => {
              const fn = new Function(code);
              fn();
            }, act.code);
          }
        }
      }
      await stepFrame30(
        page,
        Boolean(shot.lightningFrames && i === midSteps - 4)
      );
    }

    // Small shot ID tag in top-right for quick reference on the contact sheet.
    await page.evaluate((idText) => {
      const tag = document.createElement('div');
      tag.textContent = idText;
      tag.style.cssText =
        'position:fixed;top:16px;right:20px;z-index:2147483647;' +
        'padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.65);' +
        'color:#ffd34d;font:700 16px EvoInter,monospace;visibility:visible !important';
      document.body.appendChild(tag);
    }, shot.id);

    const fullTile = path.join(EVO_DIR, `sheet-raw-${shot.id}.jpg`);
    await page.screenshot({path: fullTile, type: 'jpeg', quality: 88});
    reportErrors(shot.id, page);
    await page.close();

    ffmpeg([
      '-i',
      fullTile,
      '-vf',
      `scale=${tileW}:${tileH}`,
      '-q:v',
      '3',
      smallTile,
    ]);
    fs.rmSync(fullTile, {force: true});
    tileFiles.push(smallTile);
  }

  const cols = Math.min(6, tileFiles.length);
  const layout = tileFiles
    .map((_, i) => `${(i % cols) * tileW}_${Math.floor(i / cols) * tileH}`)
    .join('|');
  const sheetPath = path.join(EVO_DIR, 'sheet.jpg');
  if (tileFiles.length === 1) {
    fs.copyFileSync(tileFiles[0], sheetPath);
  } else {
    ffmpeg([
      ...tileFiles.flatMap((f) => ['-i', f]),
      '-filter_complex',
      `xstack=inputs=${tileFiles.length}:layout=${layout}:fill=black`,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      sheetPath,
    ]);
  }
  console.log(`Contact sheet written to ${sheetPath}`);
}

async function runClips(browser) {
  for (const shot of selectedShots) {
    const clipMp4 = path.join(EVO_DIR, `clip-${shot.id}.mp4`);
    if (
      !FORCE &&
      !shotArgs.length &&
      fs.existsSync(clipMp4) &&
      probeDurationSec(clipMp4) >= shot.seconds - 0.04
    ) {
      console.log(
        `[clips] Skipping existing ${shot.id} (use --force to re-render)`
      );
      continue;
    }

    console.log(`[clips] Rendering ${shot.id} (${shot.seconds}s) ...`);
    const frameDir = path.join(EVO_DIR, `frames-${shot.id}`);
    fs.rmSync(frameDir, {recursive: true, force: true});
    fs.mkdirSync(frameDir, {recursive: true});

    const page = await openEraShot(browser, shot);
    const totalFrames = Math.round(shot.seconds * FPS);

    for (let i = 0; i < totalFrames; i++) {
      if (shot.timedActions) {
        for (const act of shot.timedActions) {
          if (Math.round(act.atSec * FPS) === i) {
            await page.evaluate((code) => {
              const fn = new Function(code);
              fn();
            }, act.code);
          }
        }
      }
      const forceFlash = Boolean(
        shot.lightningFrames && shot.lightningFrames.includes(i)
      );
      await stepFrame30(page, forceFlash);
      const framePath = path.join(
        frameDir,
        `${String(i).padStart(5, '0')}.jpg`
      );
      await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
      if (i % FPS === 0) {
        console.log(`  ${shot.id}: ${i}/${totalFrames} frames`);
      }
    }

    reportErrors(shot.id, page);
    await page.close();

    ffmpeg([
      '-framerate',
      String(FPS),
      '-i',
      path.join(frameDir, '%05d.jpg'),
      '-vf',
      `scale=${WIDTH}:${HEIGHT}`,
      ...H264,
      clipMp4,
    ]);
    fs.rmSync(frameDir, {recursive: true, force: true});
    console.log(`  -> ${clipMp4}`);
  }
}

async function runStitch(browser) {
  const missing = EVOLUTION_SHOTS.filter(
    (s) => !fs.existsSync(path.join(EVO_DIR, `clip-${s.id}.mp4`))
  );
  if (missing.length) {
    throw new Error(
      `Cannot stitch: missing ${missing.length} clip(s): ${missing.map((s) => s.id).join(', ')}`
    );
  }

  const firstClip = path.join(EVO_DIR, `clip-${EVOLUTION_SHOTS[0].id}.mp4`);
  const lastClip = path.join(EVO_DIR, `clip-${EVOLUTION_SHOTS.at(-1).id}.mp4`);
  const firstFrame = path.join(EVO_DIR, 'card-bg-first.jpg');
  const lastFrame = path.join(EVO_DIR, 'card-bg-last.jpg');
  const titleCardMp4 = path.join(EVO_DIR, 'card-title.mp4');
  const endCardMp4 = path.join(EVO_DIR, 'card-end.mp4');

  ffmpeg(['-i', firstClip, '-frames:v', '1', firstFrame]);
  ffmpeg(['-sseof', '-0.1', '-i', lastClip, '-frames:v', '1', lastFrame]);

  await renderCardClip(browser, EVOLUTION_TITLE_CARD, firstFrame, titleCardMp4);
  await renderCardClip(browser, EVOLUTION_END_CARD, lastFrame, endCardMp4);
  fs.rmSync(firstFrame, {force: true});
  fs.rmSync(lastFrame, {force: true});

  const parts = [
    {
      mp4: titleCardMp4,
      seconds: EVOLUTION_TITLE_CARD.seconds,
      transition: 'fade',
    },
    ...EVOLUTION_SHOTS.map((s) => ({
      mp4: path.join(EVO_DIR, `clip-${s.id}.mp4`),
      seconds: s.seconds,
      transition: s.transition || 'fade',
      shot: s,
    })),
    {mp4: endCardMp4, seconds: EVOLUTION_END_CARD.seconds, transition: 'fade'},
  ];

  // Build mixed xfade + concat filter graph and track exact timestamps for YouTube chapters.
  let filter = parts
    .map(
      (p, idx) =>
        `[${idx}:v]trim=0:${p.seconds.toFixed(3)},setpts=PTS-STARTPTS,settb=AVTB[v${idx}];`
    )
    .join('');
  let lastLabel = '[v0]';
  let cumDuration = parts[0].seconds;
  const shotStartSec = new Map();

  for (let i = 0; i < parts.length - 1; i++) {
    const nextPart = parts[i + 1];
    const isCut = parts[i].transition === 'cut';
    const fade = isCut ? 0 : EVOLUTION_FADE_SEC;
    const nextStart = cumDuration - fade;

    if (nextPart.shot) {
      shotStartSec.set(nextPart.shot.id, nextStart);
    }

    const outLabel = `[x${i}]`;
    if (isCut) {
      filter += `${lastLabel}[v${i + 1}]concat=n=2:v=1:a=0,settb=AVTB${outLabel};`;
      cumDuration += nextPart.seconds;
    } else {
      filter += `${lastLabel}[v${i + 1}]xfade=transition=fade:duration=${fade}:offset=${nextStart.toFixed(3)}${outLabel};`;
      cumDuration += nextPart.seconds - fade;
    }
    lastLabel = outLabel;
  }

  const musicFile = await downloadTrack(EVOLUTION_MUSIC.slug);
  const fadeOutStart = Math.max(0, cumDuration - 1.8).toFixed(3);
  filter += `[${parts.length}:a]atrim=0:${cumDuration.toFixed(3)},afade=t=in:st=0:d=1.0,afade=t=out:st=${fadeOutStart}:d=1.8[a]`;

  const outMp4 = path.join(PROMO_DIR, 'chill-flight-evolution.mp4');
  console.log(
    `Stitching ${parts.length} parts (${cumDuration.toFixed(2)}s) ...`
  );
  ffmpeg([
    ...parts.flatMap((p) => ['-i', p.mp4]),
    '-i',
    musicFile,
    '-filter_complex',
    filter,
    '-map',
    lastLabel,
    '-map',
    '[a]',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    ...H264,
    '-movflags',
    '+faststart',
    outMp4,
  ]);
  console.log(`${outMp4} (${cumDuration.toFixed(2)}s)`);

  const chapterLines = [];
  for (const {shotId, title} of EVOLUTION_CHAPTERS) {
    const t = shotId === null ? 0 : shotStartSec.get(shotId);
    if (t !== undefined) {
      chapterLines.push(`${formatTimestamp(t)} ${title}`);
    }
  }
  writeMetadataSidecar(outMp4, chapterLines);
}

async function captureThumbPlate(browser, side, outPng) {
  const clipMp4 = path.join(EVO_DIR, `clip-${side.shotId}.mp4`);
  if (!FORCE && fs.existsSync(clipMp4)) {
    ffmpeg([
      '-ss',
      String(side.atSec),
      '-i',
      clipMp4,
      '-frames:v',
      '1',
      outPng,
    ]);
    return;
  }

  const shot = shotsById.get(side.shotId);
  if (!shot) {
    throw new Error(`Unknown thumbnail shot "${side.shotId}"`);
  }
  console.log(`[thumb] Rendering plate ${shot.id} @ ${side.atSec}s ...`);
  const page = await openEraShot(browser, shot);
  await page.evaluate(() => document.getElementById('evo-badge')?.remove());
  const frames = Math.round(side.atSec * FPS);
  for (let i = 0; i < frames; i++) {
    if (shot.timedActions) {
      for (const act of shot.timedActions) {
        if (Math.round(act.atSec * FPS) === i) {
          await page.evaluate((code) => {
            const fn = new Function(code);
            fn();
          }, act.code);
        }
      }
    }
    const forceFlash = Boolean(
      shot.lightningFrames && shot.lightningFrames.includes(i)
    );
    await stepFrame30(page, forceFlash);
  }
  await page.screenshot({path: outPng, type: 'png'});
  reportErrors(shot.id, page);
  await page.close();
}

async function runThumb(browser) {
  const preset = EVOLUTION_THUMBNAILS[THUMB_VARIANT];
  const leftPng = path.join(tempRoot, `thumb-left-${THUMB_VARIANT}.png`);
  const rightPng = path.join(tempRoot, `thumb-right-${THUMB_VARIANT}.png`);
  const htmlPath = path.join(tempRoot, `thumb-${THUMB_VARIANT}.html`);
  const outJpg = outArg
    ? path.resolve(outArg)
    : path.join(PROMO_DIR, 'chill-flight-evolution-thumb.jpg');

  await captureThumbPlate(browser, preset.left, leftPng);
  await captureThumbPlate(browser, preset.right, rightPng);

  fs.mkdirSync(path.dirname(outJpg), {recursive: true});
  fs.writeFileSync(htmlPath, thumbHtml(preset, leftPng, rightPng));

  const page = await browser.newPage();
  await page.setViewport({width: WIDTH, height: HEIGHT, deviceScaleFactor: 1});
  await page.goto('file://' + htmlPath, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: outJpg, type: 'jpeg', quality: 90});
  if (fs.statSync(outJpg).size >= 2_000_000) {
    await page.screenshot({path: outJpg, type: 'jpeg', quality: 82});
  }
  await page.close();

  const kb = (fs.statSync(outJpg).size / 1024).toFixed(0);
  console.log(`${outJpg} (${WIDTH}x${HEIGHT}, ${kb} KB, ${THUMB_VARIANT})`);
}

const browser = await launch({
  onCleanup: () => {
    for (const {server} of gitServers.values()) server.close();
    if (currentBuildServer) currentBuildServer.close();
    fs.rmSync(tempRoot, {recursive: true, force: true});
  },
});

try {
  if (mode === 'sheet') {
    await runSheet(browser);
  } else if (mode === 'clips') {
    await runClips(browser);
  } else if (mode === 'thumb') {
    await runThumb(browser);
  } else if (mode === 'stitch') {
    await runStitch(browser);
    await runThumb(browser);
  } else if (mode === 'video') {
    await runClips(browser);
    await runStitch(browser);
    await runThumb(browser);
  }
} finally {
  await browser.close();
  for (const {server} of gitServers.values()) server.close();
  if (currentBuildServer) currentBuildServer.close();
  fs.rmSync(tempRoot, {recursive: true, force: true});
}

process.exit(failed ? 1 : 0);
