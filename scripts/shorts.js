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
//  10. short-20261114-bayou-cut.mp4  - 12s coral seaplane roll through 2 rock arches across 4 biomes (seed 20261114)
//  11. short-20261116-twin-cut.mp4   - 12s purple twin-prop roll across volcano, pyramids, arctic arch & alien pillars (seed 20261116)
//  12. short-20261117-orbit-cut.mp4  - 12s staggered 2-jet 360-degree orbit & wormhole warp across 4 biomes (seed 20261117)
//  13. short-20261118-wingtip-cut.mp4 - 12s sage biplane wingtip-boom GoPro inverted arch & canyon cut (seed 20261118)
//
// Usage:
//   node scripts/shorts.js [short-id | meta | check] [--preview] [--check]

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  launch,
  openPromoWorld,
  stepPromoFrame,
  waitForPromoChunks,
} from './dev-browser.js';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {ARCH, archBlocks, archCeiling, archSites} from '../arches-logic.js';
import {solveStartCoords, traceScriptedTrajectory} from '../promo-script.js';
import {
  DEFAULT_RELATED_VIDEO,
  buildDefaultPinnedComment,
} from './post-short.js';

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
const CHECK_ONLY = process.argv.includes('--check');
const WATER_LEVEL = 40;
const VIEWPORT = {width: 540, height: 960, scale: 2, mobile: true}; // 1080x1920
export const SHORT_BADGE_TOP_PX = 140; // ~14.6% of 960px CSS height (280px on 1080x1920), inside Shorts safe zone
const PIXEL_W = VIEWPORT.width * VIEWPORT.scale;
const PIXEL_H = VIEWPORT.height * VIEWPORT.scale;

let checkFailures = 0;

// Christmas off: flight paths are scouted in Node, where the season is
// always off, so the browser must draw the same ground (a Short can add
// xmas=full to its own query for a seasonal one)
const COMMON =
  'start=1&ui=0&music=0&hints=0&preset=ultra&timeSpeed=0' +
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

function openWorld(browser, query, preroll = PREROLL, beforePreroll = null) {
  const merged = new URLSearchParams(COMMON);
  for (const [k, v] of new URLSearchParams(query)) merged.set(k, v);
  return openPromoWorld(browser, `${BASE_URL}?${merged.toString()}`, {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    scale: PREVIEW ? 1 : VIEWPORT.scale,
    mobile: VIEWPORT.mobile,
    settleMs: PREVIEW ? 800 : SETTLE_MS,
    prerollSec: preroll,
    fps: FPS,
    beforePreroll,
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
    ({topLine, subLine, topPx}) => {
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
          top: ${topPx}px;
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
      } else {
        badge.style.top = `${topPx}px`;
      }
      badge.innerHTML = `
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: #7dd3fc;">${topLine}</div>
        <div style="font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: #fff;">${subLine}</div>
      `;
    },
    {topLine, subLine, topPx: SHORT_BADGE_TOP_PX}
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

export function writeShortMetadata(
  outMp4,
  {
    title,
    question,
    tiktokQuestion,
    pinnedComment,
    stops = [],
    trackTitle,
    relatedVideo = DEFAULT_RELATED_VIDEO,
  }
) {
  const txtPath = outMp4.replace(/\.mp4$/, '.txt');
  const stopBlock = stops.length ? ['', ...stops] : [];
  const cleanTitle = title
    .replace(/\s*\(Play free:\s*chillflight\.app\)\s*/i, '')
    .replace(/\s*#shorts$/i, '')
    .trim();
  const youtubeTitle = cleanTitle;
  const hasRelated =
    relatedVideo !== null &&
    relatedVideo !== undefined &&
    relatedVideo !== false &&
    !/^(none|off)$/i.test(String(relatedVideo).trim()) &&
    String(relatedVideo).trim().length > 0;
  const relatedBlock = hasRelated
    ? ['', 'Related video:', String(relatedVideo).trim()]
    : [];
  const hookQuestion = question ?? tiktokQuestion;
  const commentDisabled =
    pinnedComment === false ||
    /^(none|off)$/i.test(String(pinnedComment ?? '').trim());
  const resolvedComment = commentDisabled
    ? null
    : pinnedComment !== undefined &&
        pinnedComment !== null &&
        String(pinnedComment).trim().length > 0
      ? String(pinnedComment).trim()
      : buildDefaultPinnedComment({question, tiktokQuestion});
  const commentBlock = resolvedComment
    ? ['', 'Pinned comment:', resolvedComment]
    : [];
  const tiktokFirstLine = `${cleanTitle} Play free at chillflight.app (or "Chill Flight" on App Store)`;
  const tiktokBlock = hookQuestion
    ? [tiktokFirstLine, hookQuestion]
    : [tiktokFirstLine];
  const body = [
    '=== YouTube Shorts ===',
    'Title:',
    youtubeTitle,
    ...relatedBlock,
    ...commentBlock,
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

function formatWorldLocation(x, z) {
  const lon = (Math.abs(x) / 5000).toFixed(2);
  const lat = (Math.abs(z) / 5000).toFixed(2);
  const ew = x >= 0 ? 'East' : 'West';
  const ns = z <= 0 ? 'North' : 'South';
  return `X = ${Math.round(x)}, Z = ${Math.round(z)} (${lon} ${ew}, ${lat} ${ns})`;
}

function coordBadgeLabel(x, z) {
  const latDeg = Math.abs(z / 5000).toFixed(1);
  const latDir = z <= 0 ? 'N' : 'S';
  const lonDeg = Math.abs(x / 5000).toFixed(1);
  const lonDir = x >= 0 ? 'E' : 'W';
  return `${latDeg}°${latDir}, ${lonDeg}°${lonDir}`;
}

const _seedSiteCache = new Map();
function getWorldSites(seed, xmasMode = 'off') {
  const key = `${seed}:${xmasMode}`;
  if (_seedSiteCache.has(key)) return _seedSiteCache.get(key);
  ChillFlightLogic.WORLD_SEED = seed;
  ChillFlightLogic.XMAS_SEASON = xmasMode;
  simplex.seed(seed);
  const elevOpts = {WATER_LEVEL};
  const arches = archSites(simplex, elevOpts);
  const portals = ChillFlightLogic.portalSites(simplex, elevOpts);
  const entry = {arches, portals, elevOpts};
  _seedSiteCache.set(key, entry);
  return entry;
}

// Resolves a declarative landmark target `{tx, ty, tz, heading, coordLabel, portalCross}`
// on `seed` so segments can target arches, portals, or named landmarks with `hitFrame`.
export function resolveLandmarkTarget(seed, landmark, xmasMode = 'off') {
  if (!landmark) return null;
  const spec = typeof landmark === 'string' ? {kind: landmark} : landmark;
  const {arches, portals, elevOpts} = getWorldSites(seed, xmasMode);
  const kind = spec.kind;

  if (
    kind === 'arch' ||
    kind === 'sea' ||
    kind === 'gorge' ||
    kind === 'canyon' ||
    kind === 'basalt'
  ) {
    const archType = kind === 'arch' ? spec.archType || 'sea' : kind;
    const list = arches.filter((s) => s.kind === archType);
    const arch = list[spec.index ?? 0] || list[0];
    if (!arch) {
      throw new Error(`No arch of kind "${archType}" found on seed ${seed}`);
    }
    let maxUnder = -Infinity;
    let bestIdx = Math.floor(arch.under.length / 2);
    for (let i = 0; i < arch.under.length; i++) {
      if (arch.under[i] > maxUnder) {
        maxUnder = arch.under[i];
        bestIdx = i;
      }
    }
    const u = arch.uMin + bestIdx * 6 + (spec.offsetAlong ?? 0);
    const cx = arch.x + arch.ux * u;
    const cz = arch.z + arch.uz * u;
    const ground = ChillFlightLogic.getElevation(cx, cz, simplex, elevOpts);
    const surface = Math.max(WATER_LEVEL, ground);
    const flyY = Math.round(
      Math.max(
        surface + (spec.minClear ?? 42),
        surface + (maxUnder - surface) * (spec.heightFrac ?? 0.55)
      )
    );
    let bestDir = null;
    for (const sign of [1, -1]) {
      const dx = -arch.uz * sign;
      const dz = arch.ux * sign;
      let maxOut = 0;
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
      }
      if (!bestDir || maxOut < bestDir.maxOut) {
        bestDir = {dx, dz, maxOut};
      }
    }
    const dirSign = spec.direction ?? 1;
    const dx = bestDir.dx * dirSign;
    const dz = bestDir.dz * dirSign;
    const heading = Math.round((Math.atan2(-dx, -dz) * 180) / Math.PI);
    return {
      tx: Math.round(cx),
      ty: flyY,
      tz: Math.round(cz),
      heading,
      coordLabel: coordBadgeLabel(cx, cz),
    };
  }

  if (kind === 'portal') {
    const side = spec.side === 'west' ? 'west' : 'east';
    const site = portals?.[side];
    if (!site) {
      throw new Error(`No ${side} portal found on seed ${seed}`);
    }
    const dir = spec.direction ?? 1;
    const nx = Math.sin(site.yaw) * dir;
    const nz = Math.cos(site.yaw) * dir;
    const heading = Math.round((Math.atan2(-nx, -nz) * 180) / Math.PI);
    return {
      tx: Math.round(site.x),
      ty: Math.round(site.base + (spec.heightAboveBase ?? 78)),
      tz: Math.round(site.z),
      heading,
      portalCross: spec.portalCross !== false,
      coordLabel: coordBadgeLabel(site.x, site.z),
    };
  }

  if (kind === 'volcano') {
    return {
      tx: -5000,
      ty: 2020,
      tz: 5000,
      heading: 175,
      coordLabel: coordBadgeLabel(-5000, 5000),
    };
  }
  if (kind === 'falls') {
    return {
      tx: 0,
      ty: 260,
      tz: -4350,
      heading: 15,
      coordLabel: coordBadgeLabel(0, -4500),
    };
  }
  if (kind === 'lighthouse') {
    return {
      tx: 7525,
      ty: 155,
      tz: 3000,
      heading: 65,
      coordLabel: coordBadgeLabel(7525, 3000),
    };
  }
  if (kind === 'swamp-oak') {
    const oak = ChillFlightLogic.giantSwampOak();
    const ground = ChillFlightLogic.getElevation(
      oak.x,
      oak.z,
      simplex,
      elevOpts
    );
    return {
      tx: Math.round(oak.x + (spec.offsetX ?? 320)),
      ty: Math.round(Math.max(WATER_LEVEL, ground) + (spec.clearance ?? 120)),
      tz: Math.round(oak.z + (spec.offsetZ ?? 320)),
      heading: 45,
      coordLabel: coordBadgeLabel(oak.x, oak.z),
    };
  }
  if (kind === 'pyramids') {
    const pyr = ChillFlightLogic.pyramidSite(simplex, elevOpts);
    return {
      tx: Math.round(pyr.x + (spec.offsetX ?? 950)),
      ty: Math.round(pyr.base + (spec.clearance ?? 420)),
      tz: Math.round(pyr.z + (spec.offsetZ ?? 950)),
      heading: 40,
      coordLabel: coordBadgeLabel(pyr.x, pyr.z),
    };
  }
  if (kind === 'dragon') {
    const drg = ChillFlightLogic.dragonSite(simplex, elevOpts);
    return {
      tx: Math.round(drg.x + (spec.offsetX ?? 0)),
      ty: Math.round(drg.base + (spec.clearance ?? 140)),
      tz: Math.round(drg.z + (spec.offsetZ ?? 280)),
      heading: 15,
      coordLabel: coordBadgeLabel(drg.x, drg.z),
    };
  }
  if (kind === 'xmas') {
    const xmas = ChillFlightLogic.xmasVillageSite(simplex, elevOpts);
    return {
      tx: Math.round(xmas.x),
      ty: Math.round(xmas.base + (spec.clearance ?? 95)),
      tz: Math.round(xmas.z),
      heading: 0,
      coordLabel: coordBadgeLabel(xmas.x, xmas.z),
    };
  }
  throw new Error(`Unknown landmark kind "${kind}"`);
}

// Merges clip-level `cam` and segment-level `cam`, `extra`, and shorthand
// properties (`plane`, `livery`, `style`, `camFrame`, `gear`, etc.) cleanly
// via URLSearchParams so per-segment overrides replace rather than duplicate keys.
export function buildSegmentQuery(
  clipSpec,
  seg,
  start,
  heading,
  speedMult,
  seed
) {
  const params = new URLSearchParams();
  for (const raw of [clipSpec.cam, seg.cam, seg.extra]) {
    if (!raw) continue;
    for (const [k, v] of new URLSearchParams(raw.replace(/^[^?]*\?/, ''))) {
      params.set(k, v);
    }
  }
  params.set('seed', String(seed));
  params.set('x', String(start.x));
  params.set('y', String(start.y));
  params.set('z', String(start.z));
  params.set('heading', String(heading));
  if (speedMult !== undefined && !seg.extra?.includes('speed=')) {
    params.set('speed', String(speedMult));
  }
  const overrides = [
    ['plane', seg.plane],
    ['livery', seg.livery],
    ['style', seg.style],
    ['camFrame', seg.camFrame ?? clipSpec.camFrame],
    ['gear', seg.gear === true ? 1 : seg.gear === false ? 0 : seg.gear],
    ['smoke', seg.smoke === true ? 1 : seg.smoke === false ? 0 : seg.smoke],
    ['fov', seg.fov],
    [
      'camOffset',
      Array.isArray(seg.camOffset) ? seg.camOffset.join(',') : seg.camOffset,
    ],
    [
      'camLook',
      Array.isArray(seg.camLook) ? seg.camLook.join(',') : seg.camLook,
    ],
    ['camX', seg.camX],
    ['camY', seg.camY],
    ['camZ', seg.camZ],
    ['forza', seg.forza === true ? 1 : seg.forza],
    ['trip', seg.trip === true ? 1 : seg.trip],
    ['xmas', seg.xmas],
  ];
  for (const [key, val] of overrides) {
    if (val !== undefined && val !== null) {
      params.set(key, String(val));
    }
  }
  return params.toString();
}

function resolveWingmenSpecs(
  wingmen,
  {prerollSec = PREROLL, fps = FPS, defaultSpeed = 1} = {}
) {
  if (!Array.isArray(wingmen) || wingmen.length === 0) return null;
  return wingmen.map((w) => {
    if (
      w.x === undefined &&
      w.tx !== undefined &&
      w.ty !== undefined &&
      w.tz !== undefined &&
      !Array.isArray(w.offset) &&
      !Array.isArray(w.offsetMoves)
    ) {
      const start = solveStartCoords({
        tx: w.tx,
        ty: w.ty,
        tz: w.tz,
        headingDeg: w.heading ?? 0,
        speedMult: w.speed ?? defaultSpeed,
        moves: w.moves || [[0, 0, 0, 0]],
        targetFrame: w.hitFrame ?? 0,
        prerollSec,
        fps,
        loopDip: Boolean(w.loopDip),
      });
      return {...w, x: start.x, y: start.y, z: start.z};
    }
    return w;
  });
}

// Pure Node pre-render trajectory verifier (<15ms per segment): traces every
// frame from `-preroll` through `endFrame` (including portal crossings and
// spline wingmen) and checks terrain, water, and arch rock clearance.
export function verifySegmentCorridor({
  seed,
  label = 'segment',
  x,
  y,
  z,
  headingDeg = 0,
  speedMult = 1,
  moves = [[0, 0, 0, 0]],
  startFrame = 0,
  endFrame = 90,
  prerollSec = PREROLL,
  fps = FPS,
  loopDip = false,
  surface = false,
  minClearance = 5,
  xmasMode = 'off',
  wingmen = null,
}) {
  const {arches, portals, elevOpts} = getWorldSites(seed, xmasMode);
  ChillFlightLogic.WORLD_SEED = seed;
  ChillFlightLogic.XMAS_SEASON = xmasMode;
  simplex.seed(seed);

  const rawSamples = traceScriptedTrajectory({
    x,
    y,
    z,
    headingDeg,
    speedMult,
    moves,
    endFrame,
    prerollSec,
    fps,
    loopDip,
  });

  // Apply portal warp to remaining samples if the trajectory threads a portal
  let portalCrossFrame = null;
  let offsetX = 0;
  let offsetY = 0;
  let offsetZ = 0;
  let yawTurn = 0;
  const samples = [];
  for (let i = 0; i < rawSamples.length; i++) {
    const raw = rawSamples[i];
    let sx = raw.x + offsetX;
    let sy = raw.y + offsetY;
    let sz = raw.z + offsetZ;
    if (yawTurn !== 0 && portalCrossFrame !== null) {
      const pivot = samples[portalCrossFrame];
      const dx = raw.x - rawSamples[portalCrossFrame].x;
      const dz = raw.z - rawSamples[portalCrossFrame].z;
      const c = Math.cos(yawTurn);
      const s = Math.sin(yawTurn);
      sx = pivot.x + dx * c + dz * s;
      sz = pivot.z - dx * s + dz * c;
    }
    const cur = {...raw, x: sx, y: sy, z: sz};
    if (i > 0 && portalCrossFrame === null) {
      const prev = samples[i - 1];
      const cross = ChillFlightLogic.checkPortalCrossing(prev, cur, portals);
      if (cross) {
        portalCrossFrame = i;
        offsetX = cross.x - cur.x;
        offsetY = cross.y - cur.y;
        offsetZ = cross.z - cur.z;
        yawTurn = cross.turn;
        cur.x = cross.x;
        cur.y = cross.y;
        cur.z = cross.z;
      }
    }
    samples.push(cur);
  }

  const violations = [];
  let minSurfClearance = Infinity;
  let minSurfFrame = samples[0]?.frame ?? 0;
  let minArchMargin = Infinity;

  const floorMargin = surface ? -3.0 : minClearance;
  for (const s of samples) {
    const ground = ChillFlightLogic.getElevation(s.x, s.z, simplex, elevOpts);
    const surf = Math.max(WATER_LEVEL, ground);
    const clear = s.y - surf;
    if (clear < minSurfClearance) {
      minSurfClearance = clear;
      minSurfFrame = s.frame;
    }
    if (clear < floorMargin && violations.length < 3) {
      const phase = s.frame < startFrame ? 'approach' : 'on-camera';
      violations.push(
        `[${label}] ${phase} frame ${s.frame} (${s.t.toFixed(2)}s): ` +
          `altitude Y = ${s.y.toFixed(1)} is ${clear.toFixed(1)} units above surface ` +
          `(surface = ${surf.toFixed(1)}, min = ${floorMargin}) at ${formatWorldLocation(s.x, s.z)}`
      );
    }

    const ceiling = archCeiling(arches, s.x, s.z, s.y);
    if (ceiling !== null) {
      const archMargin = ceiling - s.y;
      if (archMargin < minArchMargin) minArchMargin = archMargin;
      if (archMargin < ARCH.CEILING_MARGIN && violations.length < 3) {
        violations.push(
          `[${label}] frame ${s.frame} (${s.t.toFixed(2)}s): ` +
            `hits arch ceiling (Y = ${s.y.toFixed(1)}, underside = ${ceiling.toFixed(1)}) ` +
            `at ${formatWorldLocation(s.x, s.z)}`
        );
      }
    }
    if (archBlocks(arches, s.x, s.z, s.y - 2, 4, 2) && violations.length < 3) {
      violations.push(
        `[${label}] frame ${s.frame} (${s.t.toFixed(2)}s): ` +
          `hits solid arch rock (Y = ${s.y.toFixed(1)}) at ${formatWorldLocation(s.x, s.z)}`
      );
    }
  }

  if (Array.isArray(wingmen)) {
    wingmen.forEach((w, idx) => {
      if (
        w.x === undefined ||
        Array.isArray(w.offset) ||
        Array.isArray(w.offsetMoves)
      ) {
        return;
      }
      const wCheck = verifySegmentCorridor({
        seed,
        label: `${label} wingman#${idx + 1}`,
        x: w.x,
        y: w.y,
        z: w.z,
        headingDeg: w.heading ?? 0,
        speedMult: w.speed ?? speedMult,
        moves: w.moves || [[0, 0, 0, 0]],
        startFrame,
        endFrame,
        prerollSec,
        fps,
        loopDip: Boolean(w.loopDip),
        surface: Boolean(w.surface),
        minClearance,
        xmasMode,
      });
      violations.push(...wCheck.violations);
    });
  }

  return {
    ok: violations.length === 0,
    minClearance: minSurfClearance,
    minClearanceFrame: minSurfFrame,
    minArchMargin,
    portalCrossFrame:
      portalCrossFrame !== null ? samples[portalCrossFrame].frame : null,
    violations,
  };
}

// Computes the starting (x, y, z) so that after `preroll` seconds of level
// flight plus `targetFrame` frames of `moves`, the plane arrives at (tx, ty, tz)
export function startCoordsForFrame(
  tx,
  ty,
  tz,
  headingDeg,
  speedMult,
  moves,
  targetFrame,
  loopDip = false
) {
  return solveStartCoords({
    tx,
    ty,
    tz,
    headingDeg,
    speedMult,
    moves,
    targetFrame,
    prerollSec: PREROLL,
    fps: FPS,
    loopDip,
  });
}

function planSegment(clipSpec, seg) {
  const segSeed = seg.seed ?? clipSpec.seed;
  const segMoves = seg.moves ?? clipSpec.moves ?? [[0, 0, 0, 0]];
  const segSpeed = seg.speed ?? clipSpec.speedMult ?? 1;
  const segLoopDip = seg.loopDip ?? clipSpec.loopDip ?? false;
  const segSurface = Boolean(seg.surface ?? clipSpec.surface);
  const segDirect = seg.direct ?? clipSpec.direct;
  const segPreroll = seg.preroll ?? clipSpec.preroll ?? PREROLL;
  const segXmas =
    seg.xmas || (seg.extra?.includes('xmas=full') ? 'full' : 'off');

  const lm = seg.landmark
    ? resolveLandmarkTarget(segSeed, seg.landmark, segXmas)
    : null;
  const tx = seg.tx ?? lm?.tx ?? 0;
  const ty = seg.ty ?? lm?.ty ?? 200;
  const tz = seg.tz ?? lm?.tz ?? 0;
  const heading = seg.heading ?? lm?.heading ?? 0;
  const targetFrame = seg.hitFrame ?? seg.startFrame ?? 0;

  const start =
    seg.x !== undefined && seg.y !== undefined && seg.z !== undefined
      ? {x: seg.x, y: seg.y, z: seg.z}
      : solveStartCoords({
          tx,
          ty,
          tz,
          headingDeg: heading,
          speedMult: segSpeed,
          moves: segMoves,
          targetFrame,
          prerollSec: segPreroll,
          fps: FPS,
          loopDip: segLoopDip,
        });

  const resolvedWingmen = resolveWingmenSpecs(seg.wingmen ?? clipSpec.wingmen, {
    prerollSec: segPreroll,
    fps: FPS,
    defaultSpeed: segSpeed,
  });
  const query = buildSegmentQuery(
    clipSpec,
    seg,
    start,
    heading,
    segSpeed,
    segSeed
  );
  const camMoves = seg.camMoves ?? clipSpec.camMoves ?? null;
  const camFrame = seg.camFrame ?? clipSpec.camFrame ?? null;
  const driveMoves = seg.driveMoves ?? clipSpec.driveMoves ?? null;
  const replay = seg.replay ?? clipSpec.replay ?? null;
  const isSurfaceDriven =
    segSurface ||
    Boolean(driveMoves) ||
    Boolean(replay) ||
    new URLSearchParams(query).get('plane') === 'buggy';

  const check =
    seg.skipCheck || driveMoves || replay
      ? {
          ok: true,
          minClearance: Infinity,
          minClearanceFrame: 0,
          minArchMargin: Infinity,
          portalCrossFrame: null,
          violations: [],
        }
      : verifySegmentCorridor({
          seed: segSeed,
          label: `${clipSpec.id}:${seg.label}`,
          x: start.x,
          y: start.y,
          z: start.z,
          headingDeg: heading,
          speedMult: segSpeed,
          moves: segMoves,
          startFrame: seg.startFrame ?? 0,
          endFrame: seg.endFrame,
          prerollSec: segPreroll,
          fps: FPS,
          loopDip: segLoopDip,
          surface: isSurfaceDriven,
          minClearance: seg.minClearance ?? 5,
          xmasMode: segXmas,
          wingmen: resolvedWingmen,
        });

  return {
    segSeed,
    segMoves,
    segSpeed,
    segLoopDip,
    segSurface,
    segDirect,
    segPreroll,
    heading,
    start,
    query,
    camMoves,
    camFrame,
    driveMoves,
    replay,
    resolvedWingmen,
    portalCross: Boolean(
      seg.portalCross ?? lm?.portalCross ?? check.portalCrossFrame !== null
    ),
    check,
  };
}

async function renderMatchCutClip(browser, clipSpec) {
  const {
    id,
    banner,
    segments,
    outBaseName,
    trackSlug,
    musicStart,
    durationSec = 12,
    meta,
  } = clipSpec;

  const plans = segments.map((seg) => ({
    seg,
    plan: planSegment(clipSpec, seg),
  }));
  const allViolations = plans.flatMap(({plan}) => plan.check.violations);

  if (!browser) {
    console.log(`=== Checking ${banner} ===`);
    for (const {seg, plan} of plans) {
      const archNote = Number.isFinite(plan.check.minArchMargin)
        ? `, arch margin = ${plan.check.minArchMargin.toFixed(1)}u`
        : '';
      const portalNote =
        plan.check.portalCrossFrame !== null
          ? `, portal warp @ frame ${plan.check.portalCrossFrame}`
          : '';
      console.log(
        `  [${plan.check.ok ? 'OK' : 'FAIL'}] ${seg.label}: min clearance = ` +
          `${Number.isFinite(plan.check.minClearance) ? plan.check.minClearance.toFixed(1) + 'u' : 'skipped'} ` +
          `(spawn ${formatWorldLocation(plan.start.x, plan.start.z)}${archNote}${portalNote})`
      );
    }
    for (const v of allViolations) console.error(`  ERROR: ${v}`);
    if (allViolations.length > 0) checkFailures += allViolations.length;
    return;
  }

  if (allViolations.length > 0) {
    throw new Error(
      `Pre-render corridor check failed for ${id}:\n  ` +
        allViolations.join('\n  ')
    );
  }

  console.log(`=== Rendering ${banner}${PREVIEW ? ' [PREVIEW]' : ''} ===`);
  const frameDir = path.join(OUT, `frames-${outBaseName}`);
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const topLine = 'CHILL FLIGHT · Play free at chillflight.app';
  let previewIdx = 0;
  for (const {seg, plan} of plans) {
    const beforePreroll =
      plan.camMoves || plan.camFrame || plan.resolvedWingmen
        ? async (p) => {
            await p.evaluate(
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
                camMoves: plan.camMoves,
                camFrame: plan.camFrame,
                wingmen: plan.resolvedWingmen,
                startOffsetMs: plan.segPreroll * 1000,
              }
            );
          }
        : null;

    const page = await openWorld(
      browser,
      plan.query,
      plan.segPreroll,
      beforePreroll
    );
    await addPostcardBadge(page, topLine, seg.label);
    if (seg.rainbow) {
      await page.evaluate(async () => {
        const {state} = await window.gameModule('state.js');
        state.forceRainbow = true;
        state.rainbowIntensity = 1.0;
      });
    }

    const scriptDetail =
      plan.segDirect !== undefined ||
      plan.segSurface ||
      plan.driveMoves ||
      plan.replay
        ? {
            moves: plan.segMoves,
            direct: plan.segDirect,
            surface: plan.segSurface,
            driveMoves: plan.driveMoves,
            replay: plan.replay,
          }
        : plan.segMoves;
    await page.evaluate((detail) => {
      window.dispatchEvent(new CustomEvent('promo-script', {detail}));
    }, scriptDetail);

    const badgeMap = Array.isArray(seg.badges) ? new Map(seg.badges) : null;
    const midFrame = Math.floor((seg.startFrame + seg.endFrame) / 2);
    const previewFrames = new Set([seg.startFrame, midFrame, seg.endFrame - 1]);
    let prevPos = plan.portalCross
      ? await page.evaluate(async () => {
          const {planeGroup} = await window.gameModule('airplane.js');
          return {x: planeGroup.position.x, z: planeGroup.position.z};
        })
      : null;

    for (let i = 0; i < seg.endFrame; i++) {
      if (badgeMap && badgeMap.has(i)) {
        await addPostcardBadge(page, topLine, badgeMap.get(i));
      }
      if (seg.lightningFrames && seg.lightningFrames.includes(i)) {
        await page.evaluate(async () => {
          const {flashLightning} =
            await window.gameModule('weather-manager.js');
          flashLightning(0.05, -Math.PI * 0.78);
        });
      }
      await step(page);

      if (plan.portalCross && prevPos) {
        const curPos = await page.evaluate(async () => {
          const {planeGroup} = await window.gameModule('airplane.js');
          return {x: planeGroup.position.x, z: planeGroup.position.z};
        });
        if (Math.hypot(curPos.x - prevPos.x, curPos.z - prevPos.z) > 10000) {
          await waitForPromoChunks(page, {
            settleMs: PREVIEW ? 250 : 600,
          });
        }
        prevPos = curPos;
      }

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
  const gorge = scoutArchPass(seed, 'gorge', 1);
  const sea = scoutArchPass(seed, 'sea', 1);

  const shots = [
    {
      name: 'gorge',
      seconds: 6,
      x: gorge.sx,
      y: gorge.flyY,
      z: gorge.sz,
      heading: gorge.heading,
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
      x: sea.sx,
      y: sea.flyY,
      z: sea.sz,
      heading: sea.heading,
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

  if (!browser) {
    console.log(`=== Checking Prototype 2: Daily Postcard (Seed ${seed}) ===`);
    for (const s of shots) {
      const check = verifySegmentCorridor({
        seed,
        label: `daily-postcard:${s.name}`,
        x: s.x,
        y: s.y,
        z: s.z,
        headingDeg: s.heading,
        speedMult: 1,
        moves: s.moves,
        startFrame: 0,
        endFrame: Math.round(s.seconds * FPS),
      });
      console.log(
        `  [${check.ok ? 'OK' : 'FAIL'}] ${s.subLine}: min clearance = ${check.minClearance.toFixed(1)}u ` +
          `(spawn ${formatWorldLocation(s.x, s.z)})`
      );
      for (const v of check.violations) console.error(`  ERROR: ${v}`);
      if (!check.ok) checkFailures += check.violations.length;
    }
    return;
  }

  console.log(`=== Rendering Prototype 2: Daily Postcard (Seed ${seed}) ===`);
  console.log('  Auto-scouted gorge bridge:', gorge);
  console.log('  Auto-scouted sea arch:', sea);

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

  const totalFrames = 12 * FPS;
  if (!browser) {
    console.log('=== Checking Prototype 3: Window Seat / Wing-Cam ===');
    const check = verifySegmentCorridor({
      seed: 20260101,
      label: 'wing-cam',
      x: 8600,
      y: 135,
      z: 3550,
      headingDeg: 65,
      speedMult: 1,
      moves,
      startFrame: 0,
      endFrame: totalFrames,
    });
    console.log(
      `  [${check.ok ? 'OK' : 'FAIL'}] Headland Lighthouse · 0.6°S, 1.5°E: ` +
        `min clearance = ${check.minClearance.toFixed(1)}u (spawn ${formatWorldLocation(8600, 3550)})`
    );
    for (const v of check.violations) console.error(`  ERROR: ${v}`);
    if (!check.ok) checkFailures += check.violations.length;
    return;
  }

  console.log('=== Rendering Prototype 3: Window Seat / Wing-Cam ===');
  const frameDir = path.join(OUT, 'frames-short-wing-cam');
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const page = await openWorld(browser, query, PREROLL);
  await addPostcardBadge(
    page,
    'CHILL FLIGHT · Play free at chillflight.app',
    'Headland Lighthouse · 0.6°S, 1.5°E'
  );
  await page.evaluate((m) => {
    window.dispatchEvent(new CustomEvent('promo-script', {detail: m}));
  }, moves);
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
    tiktokQuestion: 'Where would you fly at sunset?',
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
        ty: 145,
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
        tz: -4050,
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
        ty: 448,
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
        ty: 206,
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
      title: 'Biplane loop and roll across 4 biomes ✈️',
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

// ---------------------------------------------------------------------------
// Prototype 10: Bayou Oak + Dual Arch Threading Seaplane Match-Cut (Seed 20261114)
// ---------------------------------------------------------------------------
async function renderBayouArchCutShort(browser, seed = 20261114) {
  const speedMult = 1.18;
  await renderMatchCutClip(browser, {
    id: 'bayou-cut',
    banner: `Bayou & Arches Seaplane Match-Cut (Seed ${seed}: Coral Seaplane)`,
    seed,
    speedMult,
    cam:
      `plane=seaplane&livery=coral&smoke=1&speed=${speedMult}` +
      '&camOffset=11,5,42&camLook=-2,1,-66',
    moves: [
      [0.0, 0, 0, 0],
      [1.2, 24, 3, -5],
      [2.3, -14, 6, -10],
      [3.0, -64, 4, -10],
      [4.5, -250, -2, -10],
      [5.5, -360, 1, -12],
      [6.0, -378, 2, -14],
      [7.4, -342, -1, -14],
      [8.4, -370, 2, -16],
      [9.0, -346, 2, -16],
      [10.2, -368, 1, -16],
      [11.3, -360, 0, -16],
      [12.0, -360, 0, -16],
    ],
    segments: [
      {
        label: 'Giant Swamp Oak · 1.7°S, 2.1°W',
        tx: -10029,
        ty: 118,
        tz: 8727,
        heading: 52,
        extra: 'tod=0.285&cloudMood=fair',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Coral Sea Arch · 6.1°S, 3.0°E',
        tx: 14977,
        ty: 130,
        tz: 30833,
        heading: 40,
        extra: 'tod=0.49&cloudMood=fair',
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Mountain Gorge Bridge · 0.8°S, 8.8°W',
        tx: -44057,
        ty: 392,
        tz: 3583,
        heading: 149,
        extra: 'tod=0.63&cloudMood=mackerel',
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Headland Lighthouse · 0.6°S, 1.5°E',
        tx: 8046,
        ty: 147,
        tz: 3185,
        heading: 68,
        extra: 'tod=0.765&headlight=1&cloudMood=busy',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-bayou-cut`,
    trackSlug: 'purrple-cat-somewhere-new',
    musicStart: 18,
    meta: {
      title: 'Seaplane roll through 2 rock arches ✈️',
      tiktokQuestion:
        'Swamp oak, coral arch, gorge bridge, or sunset lighthouse?',
      stops: [
        '0:00 Giant Swamp Oak (1.7°S, 2.1°W)',
        '0:03 Coral Sea Arch (6.1°S, 3.0°E)',
        '0:06 Mountain Gorge Bridge (0.8°S, 8.8°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Somewhere New',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 11: Lofi Purple Twin-Prop 4-Landmarks Match-Cut (Seed 20261116)
// ---------------------------------------------------------------------------
async function renderTwinWondersCutShort(browser, seed = 20261116) {
  const speedMult = 1.22;
  await renderMatchCutClip(browser, {
    id: 'twin-cut',
    banner: `Twin-Prop Wonders Match-Cut (Seed ${seed}: Purple Twin-Prop)`,
    seed,
    speedMult,
    cam:
      `plane=twin&livery=purple&smoke=1&speed=${speedMult}` +
      '&camOffset=-7,11,52&camLook=0,-6,-66',
    moves: [
      [0.0, 0, 0, 0],
      [1.2, -24, 2, 5],
      [2.3, 16, 6, 10],
      [3.0, 66, 4, 10],
      [4.5, 252, -2, 10],
      [5.5, 360, 1, 12],
      [6.0, 378, 2, 14],
      [7.4, 342, -1, 14],
      [8.4, 370, 2, 16],
      [9.0, 346, 2, 16],
      [10.2, 368, 1, 16],
      [11.3, 360, 0, 16],
      [12.0, 360, 0, 16],
    ],
    segments: [
      {
        label: 'Volcano Caldera · 1.0°S, 1.0°W',
        tx: -4960,
        ty: 2020,
        tz: 4560,
        heading: 176,
        extra: 'tod=0.29&cloudMood=fair',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Great Pyramids · 4.1°S, 2.0°W',
        tx: -8820,
        ty: 620,
        tz: 21350,
        heading: 32,
        extra: 'tod=0.52&cloudMood=fair',
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Arctic Sea Arch · 3.8°N, 7.3°E',
        tx: 36682,
        ty: 108,
        tz: -19178,
        heading: 106,
        extra: 'tod=0.42&weather=snow&cloudMood=high',
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Alien Basalt Arch · 1.6°S, 11.7°E',
        tx: 58788,
        ty: 512,
        tz: 8246,
        heading: 35,
        extra: 'tod=0.765&headlight=1&cloudMood=mackerel',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-twin-cut`,
    trackSlug: 'purrple-cat-wonderment',
    musicStart: 18,
    meta: {
      title: 'Twin-prop roll through an arctic arch ✈️',
      tiktokQuestion:
        'Volcano crater, desert pyramids, arctic arch, or alien pillars?',
      stops: [
        '0:00 Volcano Caldera (1.0°S, 1.0°W)',
        '0:03 Great Pyramids (4.1°S, 2.0°W)',
        '0:06 Arctic Sea Arch (3.8°N, 7.3°E)',
        '0:09 Alien Basalt Arch (1.6°S, 11.7°E)',
      ],
      trackTitle: 'Wonderment',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 12: Staggered 2-Jet 360° Orbit + Live Wormhole Warp (Seed 20261117)
// ---------------------------------------------------------------------------
async function renderOrbitFormationCutShort(browser, seed = 20261117) {
  const speedMult = 1.42;
  await renderMatchCutClip(browser, {
    id: 'orbit-cut',
    banner: `Staggered 2-Jet 360° Orbit & Wormhole Cut (Seed ${seed})`,
    seed,
    speedMult,
    direct: true,
    camFrame: 'yaw-lock',
    cam:
      `plane=jet&livery=teal&smoke=1&speed=${speedMult}` +
      '&camOffset=0,18,84&camLook=0,-1,11&fov=54',
    camMoves: [
      [0.0, 0, 18, 84, 0, -1, 11, 54, 0, 0],
      [12.0, 0, 18, 84, 0, -1, 11, 54, 360, 0],
    ],
    // Loose staggered Coral wingman in yaw-space with ~0.45s reaction lag,
    // natural spacing drift, and a mid-flight cross-under (returns to [0] pose at 12s)
    wingmen: [
      {
        plane: 'jet',
        livery: 'coral',
        smoke: 'white',
        frame: 'yaw',
        offset: [-10, 4, 22],
        offsetMoves: [
          [0.0, -10, 4, 22, 0, 0, 0],
          [1.6, -9, 5, 21, 2, 0.5, 0],
          [2.1, -12, 3, 23, -4, 1, -1],
          [3.45, -14, 1, 25, 28, 3, -2],
          [5.1, -8, -3, 22, 14, 1, -3],
          [6.55, 11, -4, 21, -25, -1, 2],
          [8.1, 14, 3, 24, -18, 2, 2],
          [9.5, 5, 5, 23, 26, 2, -2],
          [11.0, -9, 4, 22, -8, 1, 0],
          [11.6, -10, 4, 22, 0, 0, 0],
          [12.0, -10, 4, 22, 0, 0, 0],
        ],
      },
    ],
    moves: [
      [0.0, 0, 0, 0],
      [1.4, 0, 0, 0],
      [3.0, 24, 2, -6],
      [4.6, 18, 1, -12],
      [6.0, -20, 0, -10],
      [7.6, -24, 2, -6],
      [9.0, 22, 1, -8],
      [10.6, -12, 1, -10],
      [11.5, 0, 0, -10],
      [12.0, 0, 0, -10],
    ],
    segments: [
      {
        label: 'Xen Wormhole · 0.1°S, 11.4°E',
        landmark: {
          kind: 'portal',
          side: 'east',
          direction: 1,
          heightAboveBase: 76,
        },
        hitFrame: 34,
        badges: [[36, 'Westworld Portal · 0.4°S, 13.0°W']],
        extra: 'tod=0.34&weather=none&cloudMood=busy',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Twin Falls · 0.9°N, 0.0°E',
        tx: 90,
        ty: 475,
        tz: -4420,
        heading: 172,
        hitFrame: 98,
        extra: 'tod=0.31&weather=none&cloudMood=fair',
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Coral Sea Arch · 1.8°S, 9.1°E',
        tx: 45482,
        ty: 108,
        tz: 8757,
        heading: 130,
        hitFrame: 185,
        extra: 'tod=0.52&weather=none&cloudMood=fair',
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Christmas Village · 3.6°N, 1.0°W',
        tx: -4810,
        ty: 172,
        tz: -17890,
        heading: 55,
        hitFrame: 355,
        xmas: 'full',
        extra: 'tod=0.79&headlight=1&weather=snow&cloudMood=high',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-orbit-cut`,
    trackSlug: 'purrple-cat-fourth-dimension',
    musicStart: 18,
    meta: {
      title: '2 jets orbit through an alien wormhole ✈️',
      tiktokQuestion:
        'Alien wormhole, waterfall, coral arch, or snowy village?',
      stops: [
        '0:00 Xen to Westworld Wormhole (0.1°S, 11.4°E)',
        '0:03 Twin Falls (0.9°N, 0.0°E)',
        '0:06 Coral Sea Arch (1.8°S, 9.1°E)',
        '0:09 Christmas Village (3.6°N, 1.0°W)',
      ],
      trackTitle: 'Fourth Dimension',
    },
  });
}

// ---------------------------------------------------------------------------
// Prototype 13: Rigid Wingtip-to-Tail GoPro Inverted Arch Match-Cut (Seed 20261118)
// ---------------------------------------------------------------------------
async function renderWingtipInvertedCutShort(browser, seed = 20261118) {
  const speedMult = 1.24;
  await renderMatchCutClip(browser, {
    id: 'wingtip-cut',
    banner: `Wingtip Boom Inverted Arch Match-Cut (Seed ${seed}: Sage Biplane)`,
    seed,
    speedMult,
    direct: true,
    camFrame: 'plane',
    cam:
      `plane=biplane&livery=sage&smoke=1&speed=${speedMult}` +
      '&camOffset=21,6.2,16&camLook=-2,0.5,-24&fov=66',
    camMoves: [
      [0.0, 21, 6.2, 16, -2, 0.5, -24, 66],
      [2.2, 21, 6.2, 16, -2, 0.5, -24, 66],
      [3.6, 0, 8.5, 32, 0, 0.5, -36, 66],
      [5.8, 0, 8.5, 32, 0, 0.5, -36, 66],
      [7.2, -21, 6.2, 16, 2, 0.5, -24, 66],
      [9.2, -21, 6.2, 16, 2, 0.5, -24, 66],
      [10.25, 0, 10.5, 24, 0, 0.5, -30, 66],
      [11.3, 21, 6.2, 16, -2, 0.5, -24, 66],
      [12.0, 21, 6.2, 16, -2, 0.5, -24, 66],
    ],
    moves: [
      [0.0, 0, 0, 0],
      [1.35, 76, -3, -6],
      [2.5, 110, 2, -10],
      [3.6, 180, 1, -10],
      [5.4, 180, 0, -10],
      [6.8, 338, -2, -8],
      [8.3, 342, 2, -4],
      [9.0, 340, 1, -4],
      [10.3, 372, 1, -4],
      [11.4, 360, 0, -4],
      [12.0, 360, 0, -4],
    ],
    segments: [
      {
        label: 'Red-Rock Canyon · 3.5°S, 0.8°E',
        tx: 3875,
        ty: 158,
        tz: 17650,
        heading: 4,
        hitFrame: 45,
        extra: 'tod=0.34&weather=none&cloudMood=fair',
        startFrame: 0,
        endFrame: 90,
      },
      {
        label: 'Coastal Sea Arch · 3.0°N, 6.3°E',
        tx: 31464,
        ty: 128,
        tz: -15009,
        heading: -140,
        hitFrame: 138,
        extra: 'tod=0.52&weather=none&cloudMood=fair',
        startFrame: 90,
        endFrame: 180,
      },
      {
        label: 'Dragon Skeleton · 3.0°N, 4.1°W',
        tx: -20415,
        ty: 172,
        tz: -15000,
        heading: 8,
        hitFrame: 238,
        extra: 'tod=0.43&cloudMood=high',
        startFrame: 180,
        endFrame: 270,
      },
      {
        label: 'Headland Lighthouse · 0.6°S, 1.5°E',
        tx: 7582,
        ty: 142,
        tz: 2878,
        heading: 69,
        hitFrame: 348,
        extra: 'tod=0.775&headlight=1&weather=none&cloudMood=busy',
        startFrame: 270,
        endFrame: 360,
      },
    ],
    outBaseName: `short-${seed}-wingtip-cut`,
    trackSlug: 'purrple-cat-upside-down',
    musicStart: 18,
    meta: {
      title: 'Wingtip cam inverted through a sea arch ✈️',
      tiktokQuestion:
        'Red-rock canyon, inverted sea arch, dragon bones, or lighthouse?',
      stops: [
        '0:00 Red-Rock Canyon (3.5°S, 0.8°E)',
        '0:03 Coastal Sea Arch (3.0°N, 6.3°E)',
        '0:06 Dragon Skeleton (3.0°N, 4.1°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Upside Down',
    },
  });
}

async function main() {
  const cliArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const isCheck = CHECK_ONLY || cliArgs[0] === 'check';
  const filter = cliArgs[0] === 'check' ? cliArgs[1] : cliArgs[0];
  if (!isCheck) {
    fs.mkdirSync(OUT, {recursive: true});
  }
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
      tiktokQuestion: 'Where would you fly at sunset?',
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
      title: 'Biplane loop and roll across 4 biomes ✈️',
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
    writeShortMetadata(path.join(OUT, 'short-20261114-bayou-cut.mp4'), {
      title: 'Seaplane roll through 2 rock arches ✈️',
      tiktokQuestion:
        'Swamp oak, coral arch, gorge bridge, or sunset lighthouse?',
      stops: [
        '0:00 Giant Swamp Oak (1.7°S, 2.1°W)',
        '0:03 Coral Sea Arch (6.1°S, 3.0°E)',
        '0:06 Mountain Gorge Bridge (0.8°S, 8.8°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Somewhere New',
    });
    writeShortMetadata(path.join(OUT, 'short-20261116-twin-cut.mp4'), {
      title: 'Twin-prop roll through an arctic arch ✈️',
      tiktokQuestion:
        'Volcano crater, desert pyramids, arctic arch, or alien pillars?',
      stops: [
        '0:00 Volcano Caldera (1.0°S, 1.0°W)',
        '0:03 Great Pyramids (4.1°S, 2.0°W)',
        '0:06 Arctic Sea Arch (3.8°N, 7.3°E)',
        '0:09 Alien Basalt Arch (1.6°S, 11.7°E)',
      ],
      trackTitle: 'Wonderment',
    });
    writeShortMetadata(path.join(OUT, 'short-20261117-orbit-cut.mp4'), {
      title: '2 jets orbit through an alien wormhole ✈️',
      tiktokQuestion:
        'Alien wormhole, waterfall, coral arch, or snowy village?',
      stops: [
        '0:00 Xen to Westworld Wormhole (0.1°S, 11.4°E)',
        '0:03 Twin Falls (0.9°N, 0.0°E)',
        '0:06 Coral Sea Arch (1.8°S, 9.1°E)',
        '0:09 Christmas Village (3.6°N, 1.0°W)',
      ],
      trackTitle: 'Fourth Dimension',
    });
    writeShortMetadata(path.join(OUT, 'short-20261118-wingtip-cut.mp4'), {
      title: 'Wingtip cam inverted through a sea arch ✈️',
      tiktokQuestion:
        'Red-rock canyon, inverted sea arch, dragon bones, or lighthouse?',
      stops: [
        '0:00 Red-Rock Canyon (3.5°S, 0.8°E)',
        '0:03 Coastal Sea Arch (3.0°N, 6.3°E)',
        '0:06 Dragon Skeleton (3.0°N, 4.1°W)',
        '0:09 Headland Lighthouse (0.6°S, 1.5°E)',
      ],
      trackTitle: 'Upside Down',
    });
    return;
  }
  const browser = isCheck
    ? null
    : await launch({
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
    if (!filter || filter === 'bayou-cut') {
      await renderBayouArchCutShort(browser, 20261114);
    }
    if (!filter || filter === 'twin-cut') {
      await renderTwinWondersCutShort(browser, 20261116);
    }
    if (!filter || filter === 'orbit-cut') {
      await renderOrbitFormationCutShort(browser, 20261117);
    }
    if (!filter || filter === 'wingtip-cut') {
      await renderWingtipInvertedCutShort(browser, 20261118);
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
    if (browser) await browser.close();
  }
  if (isCheck) {
    if (checkFailures > 0) {
      console.error(
        `Short corridor check failed (${checkFailures} violation(s)).`
      );
      process.exit(1);
    }
    console.log('All checked Short flight corridors passed.');
    process.exit(0);
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
