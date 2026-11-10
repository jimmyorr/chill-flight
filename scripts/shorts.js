// Prototype YouTube Shorts generator (1080x1920 vertical, 30 fps).
// Renders daily Short templates (each with a companion .txt description):
//   1. short-1-match-cut.mp4         - 12s biplane clover-loop match-cut across 4 landscapes
//   2. short-2-daily-postcard.mp4    - 12s auto-scouted arch flight for a daily seed
//   3. short-3-wing-cam.mp4          - 12s over-the-wing "window seat" sunset flight
//   4. short-4-landmark-cut.mp4      - 12s swept-wing jet roll match-cut across 4 landmarks
//   5. short-20261109-match-cut.mp4  - 12s gold twin-prop barrel-roll match-cut (seed 20261109)
//   6. short-5-seaplane-cut.mp4      - 12s teal seaplane roll match-cut (seed 20261109)
//
// Usage:
//   node scripts/shorts.js [match-cut | daily-match-cut | seaplane-cut | daily-postcard | wing-cam | landmark-cut | meta]

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer-core';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {archSites} from '../arches-logic.js';
import {attitudeAt} from '../promo-script.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'promo');
const CACHE_DIR = path.join(OUT, 'music-cache');
const BUNDLED_MUSIC = path.join(
  ROOT,
  'public/assets/purrple-cat-birds-of-a-feather.mp3'
);
const R2_BASE =
  'https://pub-7309646d23c349d2894c38aad1291bf8.r2.dev/music/purrplecat';

const BASE_URL = process.env.GAME_URL || 'http://localhost:5173/';
const FPS = 30;
const PREROLL = 1.5;
const SETTLE_MS = 2000;
const VIEWPORT = {width: 540, height: 960, scale: 2, mobile: true}; // 1080x1920
const PIXEL_W = VIEWPORT.width * VIEWPORT.scale;
const PIXEL_H = VIEWPORT.height * VIEWPORT.scale;

const COMMON =
  'start=1&ui=0&music=0&preset=ultra&timeSpeed=0' +
  '&clock=1790000000000&cloudTime=500&fps=0&adaptive=0&traffic=0';

const H264 = [
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '17',
  '-pix_fmt',
  'yuv420p',
  '-r',
  String(FPS),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  const found = candidates.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('Chrome not found; set CHROME_PATH');
  return found;
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  });
}

function downloadTrack(slug) {
  fs.mkdirSync(CACHE_DIR, {recursive: true});
  const file = path.join(CACHE_DIR, `${slug}.mp3`);
  if (fs.existsSync(file) && fs.statSync(file).size > 100000) {
    return Promise.resolve(file);
  }
  const url = `${R2_BASE}/${slug}.mp3`;
  return new Promise((resolve) => {
    const req = https.get(url, {timeout: 12000}, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
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

// Same virtual clock as scripts/promo.js: performance.now creeps by 1us per
// call so time-budgeted chunk/arch loops complete while real setTimeout stays
// intact for worker & arch scheduling during load.
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

const step = (page, dt = 1000 / FPS) =>
  page.evaluate((d) => window.__promoStep(d), dt);

async function openWorld(browser, query, preroll = PREROLL) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.evaluateOnNewDocument(installVirtualClock);

  const loadShrink = 0.5;
  await page.setViewport({
    width: Math.round(VIEWPORT.width * loadShrink),
    height: Math.round(VIEWPORT.height * loadShrink),
    deviceScaleFactor: 1,
    isMobile: VIEWPORT.mobile,
    hasTouch: VIEWPORT.mobile,
  });
  await page.goto(`${BASE_URL}?${COMMON}&${query}`, {
    waitUntil: 'load',
    timeout: 120000,
  });

  // Settle on near-frozen frames (0.001ms) so terrain workers, far terrain, and
  // arches finish building without moving the plane away from its start point
  const started = Date.now();
  let loadedAt = 0;
  while (!loadedAt || Date.now() - loadedAt < SETTLE_MS) {
    if (Date.now() - started > 120000) {
      throw new Error('Timed out waiting for world to load');
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

  await page.setViewport({
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.scale,
    isMobile: VIEWPORT.mobile,
    hasTouch: VIEWPORT.mobile,
  });
  const prerollFrames = Math.round(preroll * FPS);
  for (let i = 0; i < prerollFrames; i++) {
    await step(page, 1000 / FPS);
  }
  page.close = async () => context.close();
  return page;
}

async function addPostcardBadge(page, topLine, subLine) {
  await page.evaluate(
    ({topLine, subLine}) => {
      if (!document.getElementById('short-postcard-style')) {
        const style = document.createElement('style');
        style.id = 'short-postcard-style';
        style.textContent = `
          #short-postcard-badge, #short-postcard-badge * {
            visibility: visible !important;
          }
        `;
        document.head.appendChild(style);
      }
      let badge = document.getElementById('short-postcard-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'short-postcard-badge';
        badge.style.cssText = `
          position: fixed;
          top: 42px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 9px 18px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.56);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
          font-family: Inter, -apple-system, sans-serif;
          color: #fff;
          text-align: center;
          white-space: nowrap;
        `;
        document.body.appendChild(badge);
      }
      badge.innerHTML = `
        <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255, 255, 255, 0.75);">${topLine}</div>
        <div style="font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: #fff;">${subLine}</div>
      `;
    },
    {topLine, subLine}
  );
}

function muxWithMusic(rawMp4, outMp4, musicFile, startSec, durationSec) {
  const fadeOut = Math.max(0, durationSec - 1.2).toFixed(2);
  ffmpeg([
    '-i',
    rawMp4,
    '-ss',
    String(startSec),
    '-i',
    musicFile,
    '-filter_complex',
    `[1:a]afade=t=in:st=0:d=0.6,afade=t=out:st=${fadeOut}:d=1.2,volume=0.85[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-t',
    String(durationSec),
    '-movflags',
    '+faststart',
    outMp4,
  ]);
}

function writeShortMetadata(outMp4, {title, tiktokHook, stops, trackTitle}) {
  const txtPath = outMp4.replace(/\.mp4$/, '.txt');
  const stopBlock = stops.length ? ['', ...stops] : [];
  const cleanTitle = title.replace(/\s*#shorts$/i, '');
  const body = [
    '=== YouTube Shorts ===',
    'Title:',
    title,
    '',
    'Description:',
    'A casual flight simulator set in a vast, ever-changing world.',
    '',
    'Play in browser: https://chillflight.app',
    'iOS: https://apps.apple.com/us/app/chill-flight/id6779847377',
    'Android (early access): https://chillflight.app/about',
    ...stopBlock,
    '',
    'Drift along to lofi beats as you explore diverse landscapes featuring dynamic weather, day-night cycles, and biomes that shift with each journey.',
    '',
    `Music by Purrple Cat ("${trackTitle}").`,
    '',
    'Have a chill flight.',
    '',
    '#chillflight #cozygames #indiegame #lofi #flightsimulator #shorts',
    '',
    '=== TikTok ===',
    'Caption:',
    tiktokHook || cleanTitle,
    '',
    'Play free in browser or on iOS at chillflight.app',
    ...stopBlock,
    '',
    `Music: "${trackTitle}" by Purrple Cat`,
    '',
    '#chillflight #cozygames #indiegame #lofi #flightsim',
  ].join('\n');
  fs.writeFileSync(txtPath, `${body}\n`);
  console.log(txtPath);
}

// Computes the starting (x, y, z) so that after `preroll` seconds of level
// flight plus `targetFrame` frames of `moves`, the plane arrives at (tx, ty, tz)
function startCoordsForFrame(
  tx,
  ty,
  tz,
  headingDeg,
  speedMult,
  moves,
  targetFrame
) {
  const dt = 1 / FPS;
  const stepDist = speedMult * 3.0 * (dt * 60);
  const baseYaw = (headingDeg * Math.PI) / 180;
  let dx = 0;
  let dy = 0;
  let dz = 0;
  // Preroll is level flight at baseYaw
  const prerollSteps = Math.round(PREROLL * FPS);
  dx += -Math.sin(baseYaw) * stepDist * prerollSteps;
  dz += -Math.cos(baseYaw) * stepDist * prerollSteps;
  // Scripted frames 0 .. targetFrame - 1
  for (let i = 0; i < targetFrame; i++) {
    const att = attitudeAt(moves, ((i + 1) * 1000) / FPS / 1000);
    const yaw = baseYaw + att.yaw;
    const pitch = att.pitch;
    dx += -Math.sin(yaw) * Math.cos(pitch) * stepDist;
    dy += Math.sin(pitch) * stepDist;
    dz += -Math.cos(yaw) * Math.cos(pitch) * stepDist;
  }
  return {
    x: Math.round(tx - dx),
    y: Math.round(ty - dy),
    z: Math.round(tz - dz),
  };
}

// ---------------------------------------------------------------------------
// Prototype 1: Biplane Clover-Loop Match-Cut (12s, 4 landscapes x 3s, loops to 0s)
// ---------------------------------------------------------------------------
async function renderMatchCutShort(browser) {
  console.log('=== Rendering Prototype 1: Biplane Clover-Loop Match-Cut ===');
  const frameDir = path.join(OUT, 'frames-short-match-cut');
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const speedMult = 1.15;
  const cam =
    `plane=biplane&livery=coral&smoke=1&speed=${speedMult}` +
    '&camOffset=24,8,-48&camLook=-5,4,18';
  // Starts at [0, 0, 0, 0] and settles back to level flight (roll=0, pitch=360,
  // constant yaw=52 from 9.6s..12.0s) so frame 360 loops seamlessly into frame 0
  const moves = [
    [0, 0, 0, 0],
    [1.1, 26, 3, -8],
    [2.4, -24, 2, -16],
    [3.0, -8, 6, -12],
    [3.8, 18, null, -12],
    [4.7, 52, null, 33],
    [5.5, 0, null, 78],
    [7.2, 0, 360, 78],
    [8.3, 26, 362, 64],
    [9.6, -20, 361, 52],
    [11.0, 6, 360, 52],
    [11.5, 0, 360, 52],
    [12.0, 0, 360, 52],
  ];

  const rawSegments = [
    {
      label: 'Sunrise Lakes · 0.1°S, 1.3°W',
      tx: -6500,
      ty: 320,
      tz: -500,
      heading: -80,
      extra: 'tod=0.265&cloudMood=busy',
      startFrame: 0,
      endFrame: 90,
    },
    {
      label: 'Coral Islands · 0.8°S, 1.8°E',
      tx: 9200,
      ty: 320,
      tz: 4200,
      heading: 145,
      extra: 'tod=0.55&cloudMood=fair',
      startFrame: 90,
      endFrame: 180,
    },
    {
      label: 'Alpine Snowfall · 2.9°N, 0.3°W',
      tx: -1360,
      ty: 540,
      tz: -14680,
      heading: 198,
      extra: 'tod=0.42&weather=snow&cloudMood=high',
      startFrame: 180,
      endFrame: 270,
    },
    {
      label: 'Sunset Islands · 0.2°S, 2.4°E',
      tx: 12000,
      ty: 220,
      tz: 1000,
      heading: 45,
      extra: 'tod=0.745&cloudMood=busy',
      startFrame: 270,
      endFrame: 360,
    },
  ];

  for (const seg of rawSegments) {
    const start = startCoordsForFrame(
      seg.tx,
      seg.ty,
      seg.tz,
      seg.heading,
      speedMult,
      moves,
      seg.startFrame
    );
    const query =
      `seed=20260101&x=${start.x}&y=${start.y}&z=${start.z}` +
      `&heading=${seg.heading}&${seg.extra}&${cam}`;
    const page = await openWorld(browser, query, PREROLL);
    await addPostcardBadge(page, 'CHILL FLIGHT · chillflight.app', seg.label);
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, moves);
    for (let i = 0; i < seg.endFrame; i++) {
      await step(page);
      if (i >= seg.startFrame) {
        const framePath = path.join(
          frameDir,
          `${String(i).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
        if ((i - seg.startFrame) % FPS === 0) {
          console.log(`  match-cut [${seg.label}]: frame ${i}/360`);
        }
      }
    }
    await page.close();
  }

  const rawMp4 = path.join(OUT, 'short-1-match-cut-raw.mp4');
  const outMp4 = path.join(OUT, 'short-1-match-cut.mp4');
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    path.join(frameDir, '%05d.jpg'),
    '-vf',
    `scale=${PIXEL_W}:${PIXEL_H}`,
    ...H264,
    rawMp4,
  ]);
  fs.rmSync(frameDir, {recursive: true, force: true});

  const music = await downloadTrack('purrple-cat-sky-lake');
  muxWithMusic(rawMp4, outMp4, music, 24, 12);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, {
    title: 'One loop across 4 landscapes ✈️ #shorts',
    tiktokHook:
      'One loop across 4 landscapes ✈️ Which one would you fly in first?',
    stops: [
      '0:00 Sunrise Lakes (0.1°S, 1.3°W)',
      '0:03 Coral Islands (0.8°S, 1.8°E)',
      '0:06 Alpine Snowfall (2.9°N, 0.3°W)',
      '0:09 Sunset Islands (0.2°S, 2.4°E)',
    ],
    trackTitle: 'Sky Lake',
  });
}

// ---------------------------------------------------------------------------
// Prototype 2: Auto-Scouted Daily Postcard (Seed 20261108, 12s, same biplane)
// ---------------------------------------------------------------------------
function scoutArchPass(seed, kind, index = 0) {
  ChillFlightLogic.WORLD_SEED = seed;
  simplex.seed(seed);
  const elevOpts = {WATER_LEVEL: 40};
  const sites = archSites(simplex, elevOpts).filter((s) => s.kind === kind);
  const arch = sites[index] || sites[0];
  let maxUnder = -Infinity;
  let bestIdx = Math.floor(arch.under.length / 2);
  for (let i = 0; i < arch.under.length; i++) {
    if (arch.under[i] > maxUnder) {
      maxUnder = arch.under[i];
      bestIdx = i;
    }
  }
  const u = arch.uMin + bestIdx * 6;
  const cx = arch.x + arch.ux * u;
  const cz = arch.z + arch.uz * u;
  const ground = ChillFlightLogic.getElevation(cx, cz, simplex, elevOpts);
  const flyY = Math.round(
    Math.max(ground + 45, ground + (maxUnder - ground) * 0.55)
  );

  // Pick the direction through the arch that exits toward lower terrain
  let best = null;
  for (const sign of [1, -1]) {
    const dx = -arch.uz * sign;
    const dz = arch.ux * sign;
    let maxOut = 0;
    let outLeft = 0;
    let outRight = 0;
    for (let d = 80; d <= 850; d += 50) {
      maxOut = Math.max(
        maxOut,
        ChillFlightLogic.getElevation(
          cx + dx * d,
          cz + dz * d,
          simplex,
          elevOpts
        )
      );
      outLeft = Math.max(
        outLeft,
        ChillFlightLogic.getElevation(
          cx + dx * d + dz * 220,
          cz + dz * d - dx * 220,
          simplex,
          elevOpts
        )
      );
      outRight = Math.max(
        outRight,
        ChillFlightLogic.getElevation(
          cx + dx * d - dz * 220,
          cz + dz * d + dx * 220,
          simplex,
          elevOpts
        )
      );
    }
    if (!best || maxOut < best.maxOut) {
      best = {dx, dz, maxOut, outLeft, outRight};
    }
  }
  // Start 520 units before the arch so after 1.5s preroll (270 units) the plane
  // threads the arch at t ~ 1.4s and then banks toward the more open side
  const startDist = 520;
  const sx = Math.round(cx - best.dx * startDist);
  const sz = Math.round(cz - best.dz * startDist);
  const heading = Math.round((Math.atan2(-best.dx, -best.dz) * 180) / Math.PI);
  const bankSign = best.outLeft <= best.outRight ? 1 : -1;
  const latDeg = Math.abs(cz / 5000).toFixed(2);
  const latDir = cz <= 0 ? 'N' : 'S';
  const lonDeg = Math.abs(cx / 5000).toFixed(2);
  const lonDir = cx >= 0 ? 'E' : 'W';
  return {
    sx,
    sz,
    flyY,
    heading,
    bankSign,
    coordLabel: `${latDeg}°${latDir}, ${lonDeg}°${lonDir}`,
  };
}

async function renderDailyPostcardShort(browser, seed = 20261108) {
  console.log(`=== Rendering Prototype 2: Daily Postcard (Seed ${seed}) ===`);
  const gorge = scoutArchPass(seed, 'gorge', 1);
  const sea = scoutArchPass(seed, 'sea', 1);
  console.log('  Auto-scouted gorge bridge:', gorge);
  console.log('  Auto-scouted sea arch:', sea);

  const shots = [
    {
      name: 'gorge',
      seconds: 6,
      topLine: 'CHILL FLIGHT · chillflight.app',
      subLine: `Mountain Gorge Bridge · ${gorge.coordLabel}`,
      query:
        `seed=${seed}&x=${gorge.sx}&y=${gorge.flyY}&z=${gorge.sz}` +
        `&heading=${gorge.heading}&speed=1&tod=0.33&plane=biplane&livery=coral` +
        `&camOffset=12,-3,56&camLook=0,4,-80&cloudMood=fair`,
      moves: [
        [0, 0, 0],
        [1.6, 0, 2],
        [3.5, -12, 6],
        [6.0, 8, 4],
      ],
    },
    {
      name: 'sea',
      seconds: 6,
      topLine: 'CHILL FLIGHT · chillflight.app',
      subLine: `Coral Sea Arch · ${sea.coordLabel}`,
      query:
        `seed=${seed}&x=${sea.sx}&y=${sea.flyY}&z=${sea.sz}` +
        `&heading=${sea.heading}&speed=1&tod=0.73&plane=biplane&livery=coral` +
        `&camOffset=-10,-3,64&camLook=0,6,-80&cloudMood=busy`,
      moves: [
        [0, 0, 0],
        [1.5, 0, 0],
        [3.4, sea.bankSign * 22, 2],
        [6.0, -sea.bankSign * 12, 2],
      ],
    },
  ];

  const partMp4s = [];
  for (const s of shots) {
    const frameDir = path.join(OUT, `frames-short-postcard-${s.name}`);
    fs.rmSync(frameDir, {recursive: true, force: true});
    fs.mkdirSync(frameDir, {recursive: true});
    const page = await openWorld(browser, s.query, PREROLL);
    await addPostcardBadge(page, s.topLine, s.subLine);
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, s.moves);
    const totalFrames = Math.round(s.seconds * FPS);
    for (let i = 0; i < totalFrames; i++) {
      await step(page);
      const framePath = path.join(
        frameDir,
        `${String(i).padStart(5, '0')}.jpg`
      );
      await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
      if (i % FPS === 0) {
        console.log(`  daily-postcard [${s.name}]: ${i}/${totalFrames} frames`);
      }
    }
    await page.close();
    const clipMp4 = path.join(OUT, `short-postcard-${s.name}.mp4`);
    ffmpeg([
      '-framerate',
      String(FPS),
      '-i',
      path.join(frameDir, '%05d.jpg'),
      '-vf',
      `scale=${PIXEL_W}:${PIXEL_H}`,
      ...H264,
      clipMp4,
    ]);
    fs.rmSync(frameDir, {recursive: true, force: true});
    partMp4s.push(clipMp4);
  }

  const rawMp4 = path.join(OUT, 'short-2-daily-postcard-raw.mp4');
  const outMp4 = path.join(OUT, 'short-2-daily-postcard.mp4');
  ffmpeg([
    '-i',
    partMp4s[0],
    '-i',
    partMp4s[1],
    '-filter_complex',
    '[0:v][1:v]xfade=transition=fade:duration=0.5:offset=5.5[v]',
    '-map',
    '[v]',
    ...H264,
    rawMp4,
  ]);
  for (const p of partMp4s) fs.rmSync(p, {force: true});

  const music = await downloadTrack('purrple-cat-exploration');
  muxWithMusic(rawMp4, outMp4, music, 22, 11.5);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, {
    title: 'Threading two natural rock arches ✈️ #shorts',
    tiktokHook: 'Threading two natural rock arches ✈️ Gorge or sea arch?',
    stops: [
      `0:00 Mountain Gorge Bridge (${gorge.coordLabel})`,
      `0:06 Coral Sea Arch (${sea.coordLabel})`,
    ],
    trackTitle: 'Exploration',
  });
}

// ---------------------------------------------------------------------------
// Prototype 3: Window Seat / Wing-Cam Sunset Flight (12s continuous)
// ---------------------------------------------------------------------------
async function renderWingCamShort(browser) {
  console.log('=== Rendering Prototype 3: Window Seat / Wing-Cam ===');
  const frameDir = path.join(OUT, 'frames-short-wing-cam');
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  // Mounted right beside the cockpit between the upper (y=2.85) and lower
  // (y=-1.0) right wings at z=-3.2, looking outward and forward through the
  // N-struts toward the headland lighthouse and sunset islands
  const query =
    'seed=20260101&x=8600&y=135&z=3550&heading=65&speed=1&tod=0.755' +
    '&headlight=1&plane=biplane&livery=coral' +
    '&camOffset=4.2,1.1,-3.2&camLook=18,-0.8,-22&fov=62&cloudMood=busy';
  const moves = [
    [0, 6, 0],
    [2.5, 14, 1],
    [5.5, -12, 1],
    [8.5, 12, 1],
    [12.0, 0, 0],
  ];

  const page = await openWorld(browser, query, PREROLL);
  await addPostcardBadge(
    page,
    'CHILL FLIGHT · chillflight.app',
    'Headland Lighthouse · 0.6°S, 1.5°E'
  );
  await page.evaluate((m) => {
    window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
  }, moves);

  const totalFrames = 12 * FPS;
  for (let i = 0; i < totalFrames; i++) {
    await step(page);
    const framePath = path.join(frameDir, `${String(i).padStart(5, '0')}.jpg`);
    await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
    if (i % FPS === 0) {
      console.log(`  wing-cam: ${i}/${totalFrames} frames`);
    }
  }
  await page.close();

  const rawMp4 = path.join(OUT, 'short-3-wing-cam-raw.mp4');
  const outMp4 = path.join(OUT, 'short-3-wing-cam.mp4');
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    path.join(frameDir, '%05d.jpg'),
    '-vf',
    `scale=${PIXEL_W}:${PIXEL_H}`,
    ...H264,
    rawMp4,
  ]);
  fs.rmSync(frameDir, {recursive: true, force: true});

  const music = await downloadTrack('purrple-cat-sundae-sunset');
  muxWithMusic(rawMp4, outMp4, music, 24, 12);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, {
    title: 'Sunset window seat past the lighthouse ✈️ #shorts',
    tiktokHook: 'Sunset window seat past the headland lighthouse ✈️',
    stops: ['Headland Lighthouse (0.6°S, 1.5°E)'],
    trackTitle: 'Sundae Sunset',
  });
}

// ---------------------------------------------------------------------------
// Prototype 4: Swept-Wing Jet Landmark Match-Cut (12s, 4 landmarks x 3s, same jet)
// ---------------------------------------------------------------------------
async function renderLandmarkCutShort(browser) {
  console.log(
    '=== Rendering Prototype 4: Swept-Wing Jet Landmark Match-Cut ==='
  );
  const frameDir = path.join(OUT, 'frames-short-landmark-cut');
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const speedMult = 1.6;
  const cam =
    `plane=jet&livery=coral&smoke=1&speed=${speedMult}` +
    '&camOffset=-14,6,44&camLook=4,-1,-70';
  // One continuous 12s maneuver with the same coral jet:
  //   0..3s:  Carves past the waterfall and initiates a crisp right roll
  //   3..6s:  Match-cuts mid-roll into the red-rock canyon and completes a 360° roll
  //   6..9s:  Match-cuts banking past the Great Pyramids in golden-hour light
  //   9..12s: Match-cuts past the dusk lighthouse and levels out at [11.4..12.0]
  //           so frame 360 loops seamlessly back into frame 0
  const moves = [
    [0, 0, 0, 0],
    [1.3, 24, 2, -6],
    [2.3, 10, 3, -10],
    [3.0, -45, 4, -10],
    [4.4, -360, 2, -10],
    [5.2, -338, 1, -16],
    [6.0, -342, 2, -20],
    [7.4, -382, 2, -14],
    [9.0, -346, 2, -18],
    [10.2, -368, 1, -18],
    [11.3, -360, 0, -18],
    [12.0, -360, 0, -18],
  ];

  const rawSegments = [
    {
      label: 'Twin Falls · 0.9°N, 0.0°E',
      tx: 220,
      ty: 235,
      tz: -3550,
      heading: 18,
      extra: 'tod=0.30&cloudMood=fair',
      startFrame: 0,
      endFrame: 90,
    },
    {
      label: 'Red-Rock Canyon · 2.9°S, 0.6°E',
      tx: 3260,
      ty: 145,
      tz: 15550,
      heading: 8,
      extra: 'tod=0.67&cloudMood=high',
      startFrame: 90,
      endFrame: 180,
    },
    {
      label: 'Great Pyramids · 4.2°S, 2.0°W',
      tx: -7600,
      ty: 490,
      tz: 21900,
      heading: 76,
      extra: 'tod=0.71&cloudMood=high',
      startFrame: 180,
      endFrame: 270,
    },
    {
      label: 'Headland Lighthouse · 0.6°S, 1.5°E',
      tx: 7920,
      ty: 125,
      tz: 3280,
      heading: 68,
      extra: 'tod=0.78&headlight=1&cloudMood=mackerel',
      startFrame: 270,
      endFrame: 360,
    },
  ];

  for (const seg of rawSegments) {
    const start = startCoordsForFrame(
      seg.tx,
      seg.ty,
      seg.tz,
      seg.heading,
      speedMult,
      moves,
      seg.startFrame
    );
    const query =
      `seed=20260101&x=${start.x}&y=${start.y}&z=${start.z}` +
      `&heading=${seg.heading}&${seg.extra}&${cam}`;
    const page = await openWorld(browser, query, PREROLL);
    await addPostcardBadge(page, 'CHILL FLIGHT · chillflight.app', seg.label);
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, moves);
    for (let i = 0; i < seg.endFrame; i++) {
      await step(page);
      if (i >= seg.startFrame) {
        const framePath = path.join(
          frameDir,
          `${String(i).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
        if ((i - seg.startFrame) % FPS === 0) {
          console.log(`  landmark-cut [${seg.label}]: frame ${i}/360`);
        }
      }
    }
    await page.close();
  }

  const rawMp4 = path.join(OUT, 'short-4-landmark-cut-raw.mp4');
  const outMp4 = path.join(OUT, 'short-4-landmark-cut.mp4');
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    path.join(frameDir, '%05d.jpg'),
    '-vf',
    `scale=${PIXEL_W}:${PIXEL_H}`,
    ...H264,
    rawMp4,
  ]);
  fs.rmSync(frameDir, {recursive: true, force: true});

  const music = await downloadTrack('purrple-cat-wish-you-were-here');
  muxWithMusic(rawMp4, outMp4, music, 20, 12);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, {
    title: 'One roll across 4 landmarks ✈️ #shorts',
    tiktokHook: 'One roll across 4 landmarks ✈️ Which spot is your favorite?',
    stops: [
      '0:00 Twin Falls (0.9°N, 0.0°E)',
      '0:03 Red-Rock Canyon (2.9°S, 0.6°E)',
      '0:06 Great Pyramids (4.2°S, 2.0°W)',
      '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
    ],
    trackTitle: 'Wish You Were Here',
  });
}

// ---------------------------------------------------------------------------
// Prototype 5: Daily Match-Cut for Seed 20261109 (Gold Twin-Prop Barrel-Roll)
// ---------------------------------------------------------------------------
async function renderDailyMatchCutShort(browser, seed = 20261109) {
  console.log(
    `=== Rendering Daily Match-Cut (Seed ${seed}: Gold Twin-Prop) ===`
  );
  const frameDir = path.join(OUT, `frames-short-${seed}-match-cut`);
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const speedMult = 1.2;
  // Front-left three-quarter angle (opposite side from short-1), looking back
  // at the gold twin-prop and its smoke ribbon
  const cam =
    `plane=twin&livery=gold&smoke=1&speed=${speedMult}` +
    '&camOffset=-22,6,-46&camLook=4,3,18';
  // Unbroken 12s maneuver that loops seamlessly from frame 360 back to frame 0:
  //   0..3s:  Carves into a left bank, then pitches up into a right roll
  //   3..6s:  Match-cuts mid-roll into a full 360° corkscrew barrel roll
  //   6..9s:  Match-cuts into a sweeping S-turn through the rainstorm
  //   9..12s: Match-cuts into sunset and settles to level (roll=360, pitch=0,
  //           constant yaw=-22 from 9.0s..12.0s) so frame 360 matches frame 0
  const moves = [
    [0, 0, 0, 0],
    [1.2, -26, 4, 10],
    [2.3, 18, 12, 16],
    [3.0, 68, 18, 12],
    [4.4, 240, -6, 2],
    [5.5, 360, 2, -10],
    [6.0, 382, 4, -14],
    [7.3, 334, -3, -24],
    [8.4, 376, 3, -20],
    [9.0, 344, 2, -22],
    [10.3, 368, 1, -22],
    [11.3, 360, 0, -22],
    [12.0, 360, 0, -22],
  ];

  const rawSegments = [
    {
      label: 'Twin Falls · 0.9°N, 0.0°E',
      tx: 45,
      ty: 290,
      tz: -4220,
      heading: 160,
      extra: 'tod=0.29&cloudMood=fair',
      startFrame: 0,
      endFrame: 90,
    },
    {
      label: 'Lake Cloverleaf · 0.7°S, 0.8°W',
      tx: -3750,
      ty: 1750,
      tz: 3750,
      heading: -155,
      extra: 'tod=0.46&cloudMood=mackerel',
      startFrame: 90,
      endFrame: 180,
    },
    {
      label: 'Stormy Lighthouse · 0.6°S, 1.5°E',
      tx: 7220,
      ty: 165,
      tz: 2760,
      heading: 25,
      extra: 'tod=0.63&weather=rain&headlight=1&cloudMood=busy',
      startFrame: 180,
      endFrame: 270,
    },
    {
      label: 'Desert Pyramids · 3.8°S, 2.1°W',
      tx: -10150,
      ty: 435,
      tz: 19150,
      heading: -45,
      extra: 'tod=0.75&headlight=1&cloudMood=high',
      startFrame: 270,
      endFrame: 360,
    },
  ];

  for (const seg of rawSegments) {
    const start = startCoordsForFrame(
      seg.tx,
      seg.ty,
      seg.tz,
      seg.heading,
      speedMult,
      moves,
      seg.startFrame
    );
    const query =
      `seed=${seed}&x=${start.x}&y=${start.y}&z=${start.z}` +
      `&heading=${seg.heading}&${seg.extra}&${cam}`;
    const page = await openWorld(browser, query, PREROLL);
    await addPostcardBadge(page, 'CHILL FLIGHT · chillflight.app', seg.label);
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, moves);
    for (let i = 0; i < seg.endFrame; i++) {
      await step(page);
      if (i >= seg.startFrame) {
        const framePath = path.join(
          frameDir,
          `${String(i).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
        if ((i - seg.startFrame) % FPS === 0) {
          console.log(`  daily-match-cut [${seg.label}]: frame ${i}/360`);
        }
      }
    }
    await page.close();
  }

  const rawMp4 = path.join(OUT, `short-${seed}-match-cut-raw.mp4`);
  const outMp4 = path.join(OUT, `short-${seed}-match-cut.mp4`);
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    path.join(frameDir, '%05d.jpg'),
    '-vf',
    `scale=${PIXEL_W}:${PIXEL_H}`,
    ...H264,
    rawMp4,
  ]);
  fs.rmSync(frameDir, {recursive: true, force: true});

  const music = await downloadTrack('purrple-cat-flourish');
  muxWithMusic(rawMp4, outMp4, music, 18, 12);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, {
    title: 'One barrel roll across 4 landscapes ✈️ #shorts',
    tiktokHook:
      'One barrel roll across 4 landscapes ✈️ Which weather vibe is your favorite?',
    stops: [
      '0:00 Twin Falls (0.9°N, 0.0°E)',
      '0:03 Lake Cloverleaf (0.7°S, 0.8°W)',
      '0:06 Stormy Lighthouse (0.6°S, 1.5°E)',
      '0:09 Desert Pyramids (3.8°S, 2.1°W)',
    ],
    trackTitle: 'Flourish',
  });
}

// ---------------------------------------------------------------------------
// Prototype 6: Teal Seaplane Match-Cut for Seed 20261109 (4 Arches & Peaks)
// ---------------------------------------------------------------------------
async function renderSeaplaneCutShort(browser, seed = 20261109) {
  console.log(
    `=== Rendering Seaplane Match-Cut (Seed ${seed}: Teal Seaplane) ===`
  );
  const frameDir = path.join(OUT, 'frames-short-5-seaplane-cut');
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const speedMult = 1.18;
  // Rear-right three-quarter chase camera looking forward past the teal
  // seaplane's pontoons and struts toward each landmark ahead
  const cam =
    `plane=seaplane&livery=teal&smoke=1&speed=${speedMult}` +
    '&camOffset=16,6,42&camLook=-3,0,-65';
  // Unbroken 12s maneuver that loops seamlessly from frame 360 back to frame 0:
  //   0..3s:  Carves right toward the sea arch, then pitches up into a left roll
  //   3..6s:  Match-cuts mid-roll through the river gorge bridge (360° roll)
  //   6..9s:  Match-cuts into a sweeping S-bank over the snowy dragon peaks
  //   9..12s: Match-cuts into sunset over the alien basalt arch and settles to
  //           level (roll=-360, pitch=0, constant yaw=-18 from 9.0s..12.0s)
  const moves = [
    [0, 0, 0, 0],
    [1.2, 26, 3, -6],
    [2.3, -14, 10, -12],
    [3.0, -68, 14, -10],
    [4.4, -245, -4, -12],
    [5.5, -360, 2, -16],
    [6.0, -384, 4, -18],
    [7.3, -332, -2, -12],
    [8.4, -374, 3, -18],
    [9.0, -346, 2, -18],
    [10.2, -368, 1, -18],
    [11.3, -360, 0, -18],
    [12.0, -360, 0, -18],
  ];

  const rawSegments = [
    {
      label: 'Turquoise Sea Arch · 0.8°N, 6.1°E',
      tx: 30780,
      ty: 225,
      tz: -3820,
      heading: 30,
      extra: 'tod=0.30&cloudMood=fair',
      startFrame: 0,
      endFrame: 90,
    },
    {
      label: 'Red-Rock Canyon · 3.5°S, 0.7°E',
      tx: 3600,
      ty: 225,
      tz: 17500,
      heading: 18,
      extra: 'tod=0.56&cloudMood=mackerel',
      startFrame: 90,
      endFrame: 180,
    },
    {
      label: 'Dragon Peaks · 3.9°N, 2.4°W',
      tx: -11750,
      ty: 260,
      tz: -19100,
      heading: 35,
      extra: 'tod=0.42&weather=snow&cloudMood=high',
      startFrame: 180,
      endFrame: 270,
    },
    {
      label: 'Alien Basalt Arch · 1.0°S, 17.4°E',
      tx: 87150,
      ty: 455,
      tz: 4675,
      heading: 129,
      extra: 'tod=0.76&headlight=1&cloudMood=busy',
      startFrame: 270,
      endFrame: 360,
    },
  ];

  for (const seg of rawSegments) {
    const start = startCoordsForFrame(
      seg.tx,
      seg.ty,
      seg.tz,
      seg.heading,
      speedMult,
      moves,
      seg.startFrame
    );
    const query =
      `seed=${seed}&x=${start.x}&y=${start.y}&z=${start.z}` +
      `&heading=${seg.heading}&${seg.extra}&${cam}`;
    const page = await openWorld(browser, query, PREROLL);
    await addPostcardBadge(page, 'CHILL FLIGHT · chillflight.app', seg.label);
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, moves);
    for (let i = 0; i < seg.endFrame; i++) {
      await step(page);
      if (i >= seg.startFrame) {
        const framePath = path.join(
          frameDir,
          `${String(i).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
        if ((i - seg.startFrame) % FPS === 0) {
          console.log(`  seaplane-cut [${seg.label}]: frame ${i}/360`);
        }
      }
    }
    await page.close();
  }

  const rawMp4 = path.join(OUT, 'short-5-seaplane-cut-raw.mp4');
  const outMp4 = path.join(OUT, 'short-5-seaplane-cut.mp4');
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    path.join(frameDir, '%05d.jpg'),
    '-vf',
    `scale=${PIXEL_W}:${PIXEL_H}`,
    ...H264,
    rawMp4,
  ]);
  fs.rmSync(frameDir, {recursive: true, force: true});

  const music = await downloadTrack('purrple-cat-calm-waters');
  muxWithMusic(rawMp4, outMp4, music, 20, 12);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, {
    title: 'Seaplane roll across 4 landscapes ✈️ #shorts',
    tiktokHook:
      'Seaplane roll across 4 landscapes ✈️ Which biome is your favorite?',
    stops: [
      '0:00 Turquoise Sea Arch (0.8°N, 6.1°E)',
      '0:03 Red-Rock Canyon (3.5°S, 0.7°E)',
      '0:06 Dragon Peaks (3.9°N, 2.4°W)',
      '0:09 Alien Basalt Arch (1.0°S, 17.4°E)',
    ],
    trackTitle: 'Calm Waters',
  });
}

async function main() {
  fs.mkdirSync(OUT, {recursive: true});
  const filter = process.argv[2];
  if (filter === 'meta') {
    const gorge = scoutArchPass(20261108, 'gorge', 1);
    const sea = scoutArchPass(20261108, 'sea', 1);
    writeShortMetadata(path.join(OUT, 'short-1-match-cut.mp4'), {
      title: 'One loop across 4 landscapes ✈️ #shorts',
      tiktokHook:
        'One loop across 4 landscapes ✈️ Which one would you fly in first?',
      stops: [
        '0:00 Sunrise Lakes (0.1°S, 1.3°W)',
        '0:03 Coral Islands (0.8°S, 1.8°E)',
        '0:06 Alpine Snowfall (2.9°N, 0.3°W)',
        '0:09 Sunset Islands (0.2°S, 2.4°E)',
      ],
      trackTitle: 'Sky Lake',
    });
    writeShortMetadata(path.join(OUT, 'short-2-daily-postcard.mp4'), {
      title: 'Threading two natural rock arches ✈️ #shorts',
      tiktokHook: 'Threading two natural rock arches ✈️ Gorge or sea arch?',
      stops: [
        `0:00 Mountain Gorge Bridge (${gorge.coordLabel})`,
        `0:06 Coral Sea Arch (${sea.coordLabel})`,
      ],
      trackTitle: 'Exploration',
    });
    writeShortMetadata(path.join(OUT, 'short-3-wing-cam.mp4'), {
      title: 'Sunset window seat past the lighthouse ✈️ #shorts',
      tiktokHook: 'Sunset window seat past the headland lighthouse ✈️',
      stops: ['Headland Lighthouse (0.6°S, 1.5°E)'],
      trackTitle: 'Sundae Sunset',
    });
    writeShortMetadata(path.join(OUT, 'short-4-landmark-cut.mp4'), {
      title: 'One roll across 4 landmarks ✈️ #shorts',
      tiktokHook: 'One roll across 4 landmarks ✈️ Which spot is your favorite?',
      stops: [
        '0:00 Twin Falls (0.9°N, 0.0°E)',
        '0:03 Red-Rock Canyon (2.9°S, 0.6°E)',
        '0:06 Great Pyramids (4.2°S, 2.0°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Wish You Were Here',
    });
    writeShortMetadata(path.join(OUT, 'short-20261109-match-cut.mp4'), {
      title: 'One barrel roll across 4 landscapes ✈️ #shorts',
      tiktokHook:
        'One barrel roll across 4 landscapes ✈️ Which weather vibe is your favorite?',
      stops: [
        '0:00 Twin Falls (0.9°N, 0.0°E)',
        '0:03 Lake Cloverleaf (0.7°S, 0.8°W)',
        '0:06 Stormy Lighthouse (0.6°S, 1.5°E)',
        '0:09 Desert Pyramids (3.8°S, 2.1°W)',
      ],
      trackTitle: 'Flourish',
    });
    writeShortMetadata(path.join(OUT, 'short-5-seaplane-cut.mp4'), {
      title: 'Seaplane roll across 4 landscapes ✈️ #shorts',
      tiktokHook:
        'Seaplane roll across 4 landscapes ✈️ Which biome is your favorite?',
      stops: [
        '0:00 Turquoise Sea Arch (0.8°N, 6.1°E)',
        '0:03 Red-Rock Canyon (3.5°S, 0.7°E)',
        '0:06 Dragon Peaks (3.9°N, 2.4°W)',
        '0:09 Alien Basalt Arch (1.0°S, 17.4°E)',
      ],
      trackTitle: 'Calm Waters',
    });
    return;
  }
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });
  try {
    if (!filter || filter === 'match-cut') {
      await renderMatchCutShort(browser);
    }
    if (!filter || filter === 'daily-match-cut') {
      await renderDailyMatchCutShort(browser, 20261109);
    }
    if (!filter || filter === 'seaplane-cut') {
      await renderSeaplaneCutShort(browser, 20261109);
    }
    if (!filter || filter === 'daily-postcard') {
      await renderDailyPostcardShort(browser, 20261108);
    }
    if (!filter || filter === 'wing-cam') {
      await renderWingCamShort(browser);
    }
    if (!filter || filter === 'landmark-cut') {
      await renderLandmarkCutShort(browser);
    }
  } finally {
    await browser.close();
  }
}

main();
