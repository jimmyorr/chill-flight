// Prototype YouTube Shorts generator (1080x1920 vertical, 30 fps).
// Renders daily Short templates (each with a companion .txt description):
//   1. short-1-match-cut.mp4         - 12s biplane clover-loop match-cut across 4 landscapes
//   2. short-2-daily-postcard.mp4    - 12s auto-scouted arch flight for a daily seed
//   3. short-3-wing-cam.mp4          - 12s over-the-wing "window seat" sunset flight
//   4. short-4-landmark-cut.mp4      - 12s swept-wing jet roll match-cut across 4 landmarks
//   5. short-20261109-match-cut.mp4  - 12s gold twin-prop barrel-roll match-cut (seed 20261109)
//   6. short-5-seaplane-cut.mp4      - 12s teal seaplane roll match-cut (seed 20261109)
//   7. short-20261110-weather-cut.mp4 - 12s teal biplane weather-effects match-cut (seed 20261110)
//   8. short-20261111-jet-cut.mp4    - 12s coral swept-wing jet landmark match-cut (seed 20261111)
//   9. short-20261112-aerobatic-cut.mp4 - 12s rose biplane loop, climbing roll & dive across 4 biomes (seed 20261112)
//
// Usage:
//   node scripts/shorts.js [match-cut | daily-match-cut | seaplane-cut | weather-cut | jet-cut | aerobatic-cut | daily-postcard | wing-cam | landmark-cut | meta] [--preview]

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launch, openPromoWorld, stepPromoFrame} from './dev-browser.js';
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
const PREVIEW = process.argv.includes('--preview');
const VIEWPORT = {width: 540, height: 960, scale: 2, mobile: true}; // 1080x1920
const PIXEL_W = VIEWPORT.width * VIEWPORT.scale;
const PIXEL_H = VIEWPORT.height * VIEWPORT.scale;

// Christmas off: flight paths are scouted in Node, where the season is
// always off, so the browser must draw the same ground (a Short can add
// xmas=full to its own query for a seasonal one)
const COMMON =
  'start=1&ui=0&music=0&preset=ultra&timeSpeed=0' +
  '&clock=1790000000000&cloudTime=500&fps=0&adaptive=0&traffic=0&xmas=off';

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

const step = (page, dt = 1000 / FPS) => stepPromoFrame(page, dt);

function openWorld(browser, query, preroll = PREROLL) {
  return openPromoWorld(browser, `${BASE_URL}?${COMMON}&${query}`, {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    scale: PREVIEW ? 1 : VIEWPORT.scale,
    mobile: VIEWPORT.mobile,
    settleMs: PREVIEW ? 800 : SETTLE_MS,
    prerollSec: preroll,
    fps: FPS,
  });
}

function writePreviewStrip(frameDir, outMp4, cols = 6, rows = 2) {
  const baseName = path.basename(outMp4, '.mp4');
  const previewPath = path.join(OUT, `preview-${baseName}.jpg`);
  ffmpeg([
    '-framerate',
    '1',
    '-i',
    path.join(frameDir, '%05d.jpg'),
    '-vf',
    `scale=270:480,tile=${cols}x${rows}:padding=4:color=black`,
    '-frames:v',
    '1',
    '-update',
    '1',
    '-q:v',
    '3',
    previewPath,
  ]);
  fs.rmSync(frameDir, {recursive: true, force: true});
  console.log(previewPath);
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
          top: 68px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 20px 11px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.68);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
          font-family: Inter, -apple-system, sans-serif;
          color: #fff;
          text-align: center;
          white-space: nowrap;
        `;
        document.body.appendChild(badge);
      }
      badge.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: #7dd3fc;">${topLine}</div>
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

function writeShortMetadata(
  outMp4,
  {title, tiktokQuestion, stops, trackTitle}
) {
  const txtPath = outMp4.replace(/\.mp4$/, '.txt');
  const stopBlock = stops.length ? ['', ...stops] : [];
  const cleanTitle = title
    .replace(/\s*\(Play free:\s*chillflight\.app\)\s*/i, '')
    .replace(/\s*#shorts$/i, '')
    .trim();
  const youtubeTitle = `${cleanTitle} (Play free: chillflight.app)`;
  const tiktokFirstLine = `${cleanTitle} Play free at chillflight.app (or "Chill Flight" on App Store)`;
  const tiktokBlock = tiktokQuestion
    ? [tiktokFirstLine, tiktokQuestion]
    : [tiktokFirstLine];
  const body = [
    '=== YouTube Shorts ===',
    'Title:',
    youtubeTitle,
    '',
    'Description:',
    'Play Chill Flight free in your browser at chillflight.app or search "Chill Flight" on the iOS App Store!',
    '',
    'Browser (free, no install): https://chillflight.app',
    'iOS App Store: https://apps.apple.com/us/app/chill-flight/id6779847377',
    'Android (early access): https://chillflight.app/about',
    ...stopBlock,
    '',
    'Chill Flight is a casual flight simulator set in a vast, ever-changing world. Drift along to lofi beats as you explore diverse landscapes featuring dynamic weather, day-night cycles, and biomes that shift with each journey.',
    '',
    `Music by Purrple Cat ("${trackTitle}").`,
    '',
    'Have a chill flight.',
    '',
    '#chillflight #cozygames #indiegame #lofi #flightsimulator #shorts',
    '',
    '=== TikTok ===',
    'Caption:',
    ...tiktokBlock,
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
  targetFrame,
  loopDip = false
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
    const effStep = loopDip
      ? stepDist * (1 - (0.15 * (1 - Math.cos(pitch))) / 2)
      : stepDist;
    dx += -Math.sin(yaw) * Math.cos(pitch) * effStep;
    dy += Math.sin(pitch) * effStep;
    dz += -Math.cos(yaw) * Math.cos(pitch) * effStep;
  }
  return {
    x: Math.round(tx - dx),
    y: Math.round(ty - dy),
    z: Math.round(tz - dz),
  };
}

async function renderMatchCutClip(
  browser,
  {
    id,
    banner,
    seed,
    speedMult,
    cam,
    moves,
    loopDip = false,
    segments,
    outBaseName,
    trackSlug,
    musicStart,
    durationSec = 12,
    meta,
  }
) {
  console.log(`=== Rendering ${banner}${PREVIEW ? ' [PREVIEW]' : ''} ===`);
  const frameDir = path.join(OUT, `frames-${outBaseName}`);
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  let previewIdx = 0;
  for (const seg of segments) {
    const start = startCoordsForFrame(
      seg.tx,
      seg.ty,
      seg.tz,
      seg.heading,
      speedMult,
      moves,
      seg.startFrame,
      loopDip
    );
    const query =
      `seed=${seed}&x=${start.x}&y=${start.y}&z=${start.z}` +
      `&heading=${seg.heading}&${seg.extra}&${cam}`;
    const page = await openWorld(browser, query, PREROLL);
    await addPostcardBadge(
      page,
      'CHILL FLIGHT · Play free at chillflight.app',
      seg.label
    );
    if (seg.rainbow) {
      await page.evaluate(async () => {
        const {state} = await window.gameModule('state.js');
        state.forceRainbow = true;
        state.rainbowIntensity = 1.0;
      });
    }
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, moves);

    const midFrame = Math.floor((seg.startFrame + seg.endFrame) / 2);
    const previewFrames = new Set([seg.startFrame, midFrame, seg.endFrame - 1]);

    for (let i = 0; i < seg.endFrame; i++) {
      if (seg.lightningFrames && seg.lightningFrames.includes(i)) {
        await page.evaluate(async () => {
          const {flashLightning} =
            await window.gameModule('weather-manager.js');
          flashLightning(0.05, -Math.PI * 0.78);
        });
      }
      await step(page);
      if (PREVIEW) {
        if (previewFrames.has(i)) {
          const framePath = path.join(
            frameDir,
            `${String(previewIdx++).padStart(5, '0')}.jpg`
          );
          await page.screenshot({path: framePath, type: 'jpeg', quality: 85});
          console.log(`  ${id} preview [${seg.label}]: frame ${i}/360`);
        }
      } else if (i >= seg.startFrame) {
        const framePath = path.join(
          frameDir,
          `${String(i).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
        if ((i - seg.startFrame) % FPS === 0) {
          console.log(`  ${id} [${seg.label}]: frame ${i}/360`);
        }
      }
    }
    await page.close();
  }

  const outMp4 = path.join(OUT, `${outBaseName}.mp4`);
  if (PREVIEW) {
    writePreviewStrip(frameDir, outMp4, 6, 2);
    return;
  }

  const rawMp4 = path.join(OUT, `${outBaseName}-raw.mp4`);
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

  const music = await downloadTrack(trackSlug);
  muxWithMusic(rawMp4, outMp4, music, musicStart, durationSec);
  fs.rmSync(rawMp4, {force: true});
  console.log(outMp4);
  writeShortMetadata(outMp4, meta);
}

// ---------------------------------------------------------------------------
// Prototype 1: Biplane Clover-Loop Match-Cut (12s, 4 landscapes x 3s, loops to 0s)
// ---------------------------------------------------------------------------
async function renderMatchCutShort(browser) {
  const speedMult = 1.15;
  await renderMatchCutClip(browser, {
    id: 'match-cut',
    banner: 'Prototype 1: Biplane Clover-Loop Match-Cut',
    seed: 20260101,
    speedMult,
    cam:
      `plane=biplane&livery=coral&smoke=1&speed=${speedMult}` +
      '&camOffset=24,8,-48&camLook=-5,4,18',
    // Starts at [0, 0, 0, 0] and settles back to level flight (roll=0, pitch=360,
    // constant yaw=52 from 9.6s..12.0s) so frame 360 loops seamlessly into frame 0
    moves: [
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
    ],
    segments: [
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
    ],
    outBaseName: 'short-1-match-cut',
    trackSlug: 'purrple-cat-sky-lake',
    musicStart: 24,
    meta: {
      title: 'One loop across 4 landscapes ✈️',
      tiktokQuestion: 'Which one would you fly in first?',
      stops: [
        '0:00 Sunrise Lakes (0.1°S, 1.3°W)',
        '0:03 Coral Islands (0.8°S, 1.8°E)',
        '0:06 Alpine Snowfall (2.9°N, 0.3°W)',
        '0:09 Sunset Islands (0.2°S, 2.4°E)',
      ],
      trackTitle: 'Sky Lake',
    },
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
      topLine: 'CHILL FLIGHT · Play free at chillflight.app',
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
      topLine: 'CHILL FLIGHT · Play free at chillflight.app',
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

  const outMp4 = path.join(OUT, 'short-2-daily-postcard.mp4');
  const previewDir = path.join(OUT, 'frames-short-postcard-preview');
  if (PREVIEW) {
    fs.rmSync(previewDir, {recursive: true, force: true});
    fs.mkdirSync(previewDir, {recursive: true});
  }
  let previewIdx = 0;

  const partMp4s = [];
  for (const s of shots) {
    const frameDir = path.join(OUT, `frames-short-postcard-${s.name}`);
    if (!PREVIEW) {
      fs.rmSync(frameDir, {recursive: true, force: true});
      fs.mkdirSync(frameDir, {recursive: true});
    }
    const page = await openWorld(browser, s.query, PREROLL);
    await addPostcardBadge(page, s.topLine, s.subLine);
    await page.evaluate((m) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
    }, s.moves);
    const totalFrames = Math.round(s.seconds * FPS);
    for (let i = 0; i < totalFrames; i++) {
      await step(page);
      if (PREVIEW) {
        if (i % FPS === 0) {
          const framePath = path.join(
            previewDir,
            `${String(previewIdx++).padStart(5, '0')}.jpg`
          );
          await page.screenshot({path: framePath, type: 'jpeg', quality: 85});
          console.log(
            `  daily-postcard preview [${s.name}]: ${i}/${totalFrames}`
          );
        }
      } else {
        const framePath = path.join(
          frameDir,
          `${String(i).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
        if (i % FPS === 0) {
          console.log(
            `  daily-postcard [${s.name}]: ${i}/${totalFrames} frames`
          );
        }
      }
    }
    await page.close();
    if (!PREVIEW) {
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
  }

  if (PREVIEW) {
    writePreviewStrip(previewDir, outMp4, 6, 2);
    return;
  }

  const rawMp4 = path.join(OUT, 'short-2-daily-postcard-raw.mp4');
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
    title: 'Threading two natural rock arches ✈️',
    tiktokQuestion: 'Gorge or sea arch?',
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
    'CHILL FLIGHT · Play free at chillflight.app',
    'Headland Lighthouse · 0.6°S, 1.5°E'
  );
  await page.evaluate((m) => {
    window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
  }, moves);

  const totalFrames = 12 * FPS;
  let previewIdx = 0;
  for (let i = 0; i < totalFrames; i++) {
    await step(page);
    if (PREVIEW) {
      if (i % FPS === 0) {
        const framePath = path.join(
          frameDir,
          `${String(previewIdx++).padStart(5, '0')}.jpg`
        );
        await page.screenshot({path: framePath, type: 'jpeg', quality: 85});
        console.log(`  wing-cam preview: ${i}/${totalFrames}`);
      }
    } else {
      const framePath = path.join(
        frameDir,
        `${String(i).padStart(5, '0')}.jpg`
      );
      await page.screenshot({path: framePath, type: 'jpeg', quality: 95});
      if (i % FPS === 0) {
        console.log(`  wing-cam: ${i}/${totalFrames} frames`);
      }
    }
  }
  await page.close();

  const outMp4 = path.join(OUT, 'short-3-wing-cam.mp4');
  if (PREVIEW) {
    writePreviewStrip(frameDir, outMp4, 6, 2);
    return;
  }

  const rawMp4 = path.join(OUT, 'short-3-wing-cam-raw.mp4');
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
    title: 'Sunset window seat past the lighthouse ✈️',
    stops: ['Headland Lighthouse (0.6°S, 1.5°E)'],
    trackTitle: 'Sundae Sunset',
  });
}

// ---------------------------------------------------------------------------
// Prototype 4: Swept-Wing Jet Landmark Match-Cut (12s, 4 landmarks x 3s, same jet)
// ---------------------------------------------------------------------------
async function renderLandmarkCutShort(browser) {
  const speedMult = 1.6;
  await renderMatchCutClip(browser, {
    id: 'landmark-cut',
    banner: 'Prototype 4: Swept-Wing Jet Landmark Match-Cut',
    seed: 20260101,
    speedMult,
    cam:
      `plane=jet&livery=coral&smoke=1&speed=${speedMult}` +
      '&camOffset=-14,6,44&camLook=4,-1,-70',
    moves: [
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
    ],
    segments: [
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
    ],
    outBaseName: 'short-4-landmark-cut',
    trackSlug: 'purrple-cat-wish-you-were-here',
    musicStart: 20,
    meta: {
      title: 'One roll across 4 landmarks ✈️',
      tiktokQuestion: 'Which spot is your favorite?',
      stops: [
        '0:00 Twin Falls (0.9°N, 0.0°E)',
        '0:03 Red-Rock Canyon (2.9°S, 0.6°E)',
        '0:06 Great Pyramids (4.2°S, 2.0°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Wish You Were Here',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 5: Daily Match-Cut for Seed 20261109 (Gold Twin-Prop Barrel-Roll)
// ---------------------------------------------------------------------------
async function renderDailyMatchCutShort(browser, seed = 20261109) {
  const speedMult = 1.2;
  await renderMatchCutClip(browser, {
    id: 'daily-match-cut',
    banner: `Daily Match-Cut (Seed ${seed}: Gold Twin-Prop)`,
    seed,
    speedMult,
    cam:
      `plane=twin&livery=gold&smoke=1&speed=${speedMult}` +
      '&camOffset=-22,6,-46&camLook=4,3,18',
    moves: [
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
    ],
    segments: [
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
    ],
    outBaseName: `short-${seed}-match-cut`,
    trackSlug: 'purrple-cat-flourish',
    musicStart: 18,
    meta: {
      title: 'One barrel roll across 4 landscapes ✈️',
      tiktokQuestion: 'Which weather vibe is your favorite?',
      stops: [
        '0:00 Twin Falls (0.9°N, 0.0°E)',
        '0:03 Lake Cloverleaf (0.7°S, 0.8°W)',
        '0:06 Stormy Lighthouse (0.6°S, 1.5°E)',
        '0:09 Desert Pyramids (3.8°S, 2.1°W)',
      ],
      trackTitle: 'Flourish',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 6: Teal Seaplane Match-Cut for Seed 20261109 (4 Arches & Peaks)
// ---------------------------------------------------------------------------
async function renderSeaplaneCutShort(browser, seed = 20261109) {
  const speedMult = 1.18;
  await renderMatchCutClip(browser, {
    id: 'seaplane-cut',
    banner: `Seaplane Match-Cut (Seed ${seed}: Teal Seaplane)`,
    seed,
    speedMult,
    cam:
      `plane=seaplane&livery=teal&smoke=1&speed=${speedMult}` +
      '&camOffset=16,6,42&camLook=-3,0,-65',
    moves: [
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
    ],
    segments: [
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
    ],
    outBaseName: 'short-5-seaplane-cut',
    trackSlug: 'purrple-cat-calm-waters',
    musicStart: 20,
    meta: {
      title: 'Seaplane roll across 4 landscapes ✈️',
      tiktokQuestion: 'Which biome is your favorite?',
      stops: [
        '0:00 Turquoise Sea Arch (0.8°N, 6.1°E)',
        '0:03 Red-Rock Canyon (3.5°S, 0.7°E)',
        '0:06 Dragon Peaks (3.9°N, 2.4°W)',
        '0:09 Alien Basalt Arch (1.0°S, 17.4°E)',
      ],
      trackTitle: 'Calm Waters',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 7: Weather Effects Match-Cut for Seed 20261110 (Teal Biplane)
// ---------------------------------------------------------------------------
async function renderWeatherCutShort(browser, seed = 20261110) {
  const speedMult = 1.18;
  await renderMatchCutClip(browser, {
    id: 'weather-cut',
    banner: `Weather Effects Match-Cut (Seed ${seed}: Teal Biplane)`,
    seed,
    speedMult,
    cam:
      `plane=biplane&livery=teal&smoke=1&speed=${speedMult}` +
      '&camOffset=-15,5,44&camLook=3,2,-68',
    moves: [
      [0, 0, 0, 0],
      [1.2, -24, 4, 8],
      [2.3, 16, 10, 14],
      [3.0, 68, 14, 12],
      [4.4, 245, -4, 14],
      [5.5, 360, 2, 18],
      [6.0, 384, 4, 20],
      [7.3, 332, -2, 14],
      [8.4, 374, 3, 18],
      [9.0, 346, 2, 18],
      [10.2, 368, 1, 18],
      [11.3, 360, 0, 18],
      [12.0, 360, 0, 18],
    ],
    segments: [
      {
        label: 'Sunrise Mist · 0.9°N, 0.0°E',
        tx: 210,
        ty: 195,
        tz: -3350,
        heading: 14,
        extra: 'tod=0.272&cloudCover=0.25&cloudMood=fair',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Morning Rainbow · 1.6°S, 9.1°E',
        tx: 45800,
        ty: 245,
        tz: 7950,
        heading: 58,
        extra: 'tod=0.39&weather=none&cloudCover=0.18&cloudMood=fair',
        rainbow: true,
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Lightning Storm · 0.6°S, 1.5°E',
        tx: 7906,
        ty: 175,
        tz: 3109,
        heading: 55,
        extra:
          'tod=0.68&weather=rain&cloudCover=0.92&headlight=1&cloudMood=busy',
        lightningFrames: [190, 232],
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Alpine Blizzard · 4.4°N, 1.7°W',
        tx: -7876,
        ty: 260,
        tz: -21559,
        heading: 45,
        extra: 'tod=0.44&weather=snow&cloudCover=0.82&cloudMood=high',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-weather-cut`,
    trackSlug: 'purrple-cat-crescent-moon',
    musicStart: 22,
    meta: {
      title: 'One roll through 4 weather moods ✈️',
      tiktokQuestion: 'Sunrise mist, rainbow, thunderstorm, or blizzard?',
      stops: [
        '0:00 Sunrise Mist (0.9°N, 0.0°E)',
        '0:03 Morning Rainbow (1.6°S, 9.1°E)',
        '0:06 Lightning Storm (0.6°S, 1.5°E)',
        '0:09 Alpine Blizzard (4.4°N, 1.7°W)',
      ],
      trackTitle: 'Crescent Moon',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 8: Swept-Wing Jet Match-Cut for Seed 20261111 (Coral Jet)
// ---------------------------------------------------------------------------
async function renderJetWondersCutShort(browser, seed = 20261111) {
  const speedMult = 1.55;
  await renderMatchCutClip(browser, {
    id: 'jet-cut',
    banner: `Jet Landmarks Match-Cut (Seed ${seed}: Coral Jet)`,
    seed,
    speedMult,
    cam:
      `plane=jet&livery=coral&smoke=1&speed=${speedMult}` +
      '&camOffset=-14,12,44&camLook=3,-7,-68',
    moves: [
      [0, 0, 0, 0],
      [1.3, 28, 2, -6],
      [2.3, -12, 6, -12],
      [3.0, -58, 8, -10],
      [4.4, -360, -2, -12],
      [5.4, -342, 2, -16],
      [6.0, -376, 3, -18],
      [7.4, -334, -2, -12],
      [8.4, -372, 2, -18],
      [9.0, -346, 2, -18],
      [10.2, -368, 1, -18],
      [11.3, -360, 0, -18],
      [12.0, -360, 0, -18],
    ],
    segments: [
      {
        label: 'Volcano Caldera · 1.0°S, 1.0°W',
        tx: -4920,
        ty: 1940,
        tz: 4550,
        heading: 174,
        extra: 'tod=0.28&cloudMood=fair',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Coral Sea Arch · 3.3°S, 8.7°E',
        tx: 44150,
        ty: 235,
        tz: 16544,
        heading: 104,
        extra: 'tod=0.50&cloudMood=fair',
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Great Pyramids · 3.5°S, 2.0°W',
        tx: -8850,
        ty: 520,
        tz: 18250,
        heading: 42,
        extra: 'tod=0.71&cloudMood=high',
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Alien Basalt Arch · 3.5°S, 15.9°E',
        tx: 79420,
        ty: 740,
        tz: 18580,
        heading: 20,
        extra: 'tod=0.775&headlight=1&cloudMood=mackerel',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-jet-cut`,
    trackSlug: 'purrple-cat-discovery',
    musicStart: 20,
    meta: {
      title: 'Jet roll across 4 landmarks ✈️',
      tiktokQuestion: 'Volcano, sea arch, pyramids, or alien lands?',
      stops: [
        '0:00 Volcano Caldera (1.0°S, 1.0°W)',
        '0:03 Coral Sea Arch (3.3°S, 8.7°E)',
        '0:06 Great Pyramids (3.5°S, 2.0°W)',
        '0:09 Alien Basalt Arch (3.5°S, 15.9°E)',
      ],
      trackTitle: 'Discovery',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 9: Aerobatic Loop + Climbing Roll + Dive Match-Cut (Seed 20261112)
// ---------------------------------------------------------------------------
async function renderAerobaticCutShort(browser, seed = 20261112) {
  const speedMult = 1.18;
  await renderMatchCutClip(browser, {
    id: 'aerobatic-cut',
    banner: `Aerobatic Biomes Match-Cut (Seed ${seed}: Rose Biplane)`,
    seed,
    speedMult,
    cam:
      `plane=biplane&livery=rose&smoke=1&speed=${speedMult}` +
      '&camOffset=20,6,44&camLook=-4,1,-58',
    loopDip: true,
    moves: [
      [0.0, 0, 0, 0],
      [0.55, 0, 0, 0],
      [3.65, 0, null, 0],
      [3.8, null, 405, 0],
      [6.5, 360, 405, 0],
      [7.4, 360, 360, 0],
      [7.8, 360, 360, 0],
      [9.1, 360, 312, 0],
      [9.6, 360, 312, 0],
      [11.15, 360, 360, 0],
      [12.0, 360, 360, 0],
    ],
    segments: [
      {
        label: 'Twin Falls Valley · 0.7°N, 0.0°E',
        tx: 220,
        ty: 205,
        tz: -3420,
        heading: 0,
        extra: 'tod=0.29&cloudMood=fair',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Coral Sea Arch · 0.4°N, 6.7°E',
        tx: 32720,
        ty: 185,
        tz: -1880,
        heading: -88,
        extra: 'tod=0.49&cloudMood=fair',
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Snowy Dragon Peaks · 3.0°N, 2.6°W',
        tx: -12980,
        ty: 780,
        tz: -14580,
        heading: 10,
        extra: 'tod=0.41&weather=snow&cloudMood=high',
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Great Pyramids · 3.9°S, 2.0°W',
        tx: -8720,
        ty: 680,
        tz: 20320,
        heading: 38,
        extra: 'tod=0.72&cloudMood=busy',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-aerobatic-cut`,
    trackSlug: 'purrple-cat-beautiful-day',
    musicStart: 18,
    meta: {
      title: 'Biplane loop, climb roll, and dive across 4 biomes ✈️',
      tiktokQuestion:
        'Forest valley, coral arch, snowy peaks, or desert pyramids?',
      stops: [
        '0:00 Twin Falls Valley (0.7°N, 0.0°E)',
        '0:03 Coral Sea Arch (0.4°N, 6.7°E)',
        '0:06 Snowy Dragon Peaks (3.0°N, 2.6°W)',
        '0:09 Great Pyramids (3.9°S, 2.0°W)',
      ],
      trackTitle: 'Beautiful Day',
    },
  });
}

async function main() {
  fs.mkdirSync(OUT, {recursive: true});
  const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const filter = cliArgs[0];
  if (filter === 'meta') {
    const gorge = scoutArchPass(20261108, 'gorge', 1);
    const sea = scoutArchPass(20261108, 'sea', 1);
    writeShortMetadata(path.join(OUT, 'short-1-match-cut.mp4'), {
      title: 'One loop across 4 landscapes ✈️',
      tiktokQuestion: 'Which one would you fly in first?',
      stops: [
        '0:00 Sunrise Lakes (0.1°S, 1.3°W)',
        '0:03 Coral Islands (0.8°S, 1.8°E)',
        '0:06 Alpine Snowfall (2.9°N, 0.3°W)',
        '0:09 Sunset Islands (0.2°S, 2.4°E)',
      ],
      trackTitle: 'Sky Lake',
    });
    writeShortMetadata(path.join(OUT, 'short-2-daily-postcard.mp4'), {
      title: 'Threading two natural rock arches ✈️',
      tiktokQuestion: 'Gorge or sea arch?',
      stops: [
        `0:00 Mountain Gorge Bridge (${gorge.coordLabel})`,
        `0:06 Coral Sea Arch (${sea.coordLabel})`,
      ],
      trackTitle: 'Exploration',
    });
    writeShortMetadata(path.join(OUT, 'short-3-wing-cam.mp4'), {
      title: 'Sunset window seat past the lighthouse ✈️',
      stops: ['Headland Lighthouse (0.6°S, 1.5°E)'],
      trackTitle: 'Sundae Sunset',
    });
    writeShortMetadata(path.join(OUT, 'short-4-landmark-cut.mp4'), {
      title: 'One roll across 4 landmarks ✈️',
      tiktokQuestion: 'Which spot is your favorite?',
      stops: [
        '0:00 Twin Falls (0.9°N, 0.0°E)',
        '0:03 Red-Rock Canyon (2.9°S, 0.6°E)',
        '0:06 Great Pyramids (4.2°S, 2.0°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Wish You Were Here',
    });
    writeShortMetadata(path.join(OUT, 'short-20261109-match-cut.mp4'), {
      title: 'One barrel roll across 4 landscapes ✈️',
      tiktokQuestion: 'Which weather vibe is your favorite?',
      stops: [
        '0:00 Twin Falls (0.9°N, 0.0°E)',
        '0:03 Lake Cloverleaf (0.7°S, 0.8°W)',
        '0:06 Stormy Lighthouse (0.6°S, 1.5°E)',
        '0:09 Desert Pyramids (3.8°S, 2.1°W)',
      ],
      trackTitle: 'Flourish',
    });
    writeShortMetadata(path.join(OUT, 'short-5-seaplane-cut.mp4'), {
      title: 'Seaplane roll across 4 landscapes ✈️',
      tiktokQuestion: 'Which biome is your favorite?',
      stops: [
        '0:00 Turquoise Sea Arch (0.8°N, 6.1°E)',
        '0:03 Red-Rock Canyon (3.5°S, 0.7°E)',
        '0:06 Dragon Peaks (3.9°N, 2.4°W)',
        '0:09 Alien Basalt Arch (1.0°S, 17.4°E)',
      ],
      trackTitle: 'Calm Waters',
    });
    writeShortMetadata(path.join(OUT, 'short-20261110-weather-cut.mp4'), {
      title: 'One roll through 4 weather moods ✈️',
      tiktokQuestion: 'Sunrise mist, rainbow, thunderstorm, or blizzard?',
      stops: [
        '0:00 Sunrise Mist (0.9°N, 0.0°E)',
        '0:03 Morning Rainbow (1.6°S, 9.1°E)',
        '0:06 Lightning Storm (0.6°S, 1.5°E)',
        '0:09 Alpine Blizzard (4.4°N, 1.7°W)',
      ],
      trackTitle: 'Crescent Moon',
    });
    writeShortMetadata(path.join(OUT, 'short-20261111-jet-cut.mp4'), {
      title: 'Jet roll across 4 landmarks ✈️',
      tiktokQuestion: 'Volcano, sea arch, pyramids, or alien lands?',
      stops: [
        '0:00 Volcano Caldera (1.0°S, 1.0°W)',
        '0:03 Coral Sea Arch (3.3°S, 8.7°E)',
        '0:06 Great Pyramids (3.5°S, 2.0°W)',
        '0:09 Alien Basalt Arch (3.5°S, 15.9°E)',
      ],
      trackTitle: 'Discovery',
    });
    writeShortMetadata(path.join(OUT, 'short-20261112-aerobatic-cut.mp4'), {
      title: 'Biplane loop, climb roll, and dive across 4 biomes ✈️',
      tiktokQuestion:
        'Forest valley, coral arch, snowy peaks, or desert pyramids?',
      stops: [
        '0:00 Twin Falls Valley (0.7°N, 0.0°E)',
        '0:03 Coral Sea Arch (0.4°N, 6.7°E)',
        '0:06 Snowy Dragon Peaks (3.0°N, 2.6°W)',
        '0:09 Great Pyramids (3.9°S, 2.0°W)',
      ],
      trackTitle: 'Beautiful Day',
    });
    return;
  }
  const browser = await launch({
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
    if (!filter || filter === 'weather-cut') {
      await renderWeatherCutShort(browser, 20261110);
    }
    if (!filter || filter === 'jet-cut') {
      await renderJetWondersCutShort(browser, 20261111);
    }
    if (!filter || filter === 'aerobatic-cut') {
      await renderAerobaticCutShort(browser, 20261112);
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
