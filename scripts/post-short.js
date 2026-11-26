// CLI uploader for YouTube Shorts and TikTok Studio using a persistent Chrome
// profile (~/.chill-flight-social-profile) so you only sign in once.
//
// Usage:
//   node scripts/post-short.js --login
//   node scripts/post-short.js promo/shorts/short-20261109-match-cut.mp4 [options]
//
// Options:
//   --login                        Open Chrome to sign into YouTube & TikTok once
//   --platform=all|youtube|tiktok  Which platform(s) to upload to (default: youtube)
//   --visibility=public|unlisted|private  YouTube visibility (default: public)
//   --schedule="YYYY-MM-DD HH:MM"  Schedule YouTube Short for a future local date/time
//   --related=<title|url|id|none>  YouTube Short "Related video" link
//                                  (default: "9 months of building Chill Flight")
//   --no-comment                   Skip auto-posting/pinning a YouTube comment (default)
//   --pin-comment                  Auto-post and pin the .txt "Pinned comment:" on YouTube
//   --comment=<text|none>          Custom first comment to auto-post and pin on YouTube
//   --publish                      Automatically click the final Publish/Post button (default)
//   --review                       Stop on the final Publish/Post button for manual review
//   --dry-run                      Parse and print the .txt metadata without opening Chrome

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';

export const DEFAULT_RELATED_VIDEO = '9 months of building Chill Flight';
export const DEFAULT_COMMENT_CTA =
  'Play free in your browser at chillflight.app or search "Chill Flight" on the iOS App Store!';

const PROFILE_DIR =
  process.env.SOCIAL_PROFILE_DIR ||
  path.join(os.homedir(), '.chill-flight-social-profile');

const YOUTUBE_STUDIO_URL = 'https://studio.youtube.com';
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randBetween = (min, max) =>
  Math.floor(min + Math.random() * (max - min + 1));
const humanSleep = (minMs, maxMs) => sleep(randBetween(minMs, maxMs));

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

export function extractYouTubeVideoId(text) {
  if (!text) return null;
  const s = String(text).trim();
  const urlMatch = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|studio\.youtube\.com\/video\/)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/
  );
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

export function parseRelatedVideoSpec(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || /^(none|off|false)$/i.test(trimmed)) return null;

  const videoId = extractYouTubeVideoId(trimmed);
  const strippedTitle = trimmed
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[()[\]]/g, '')
    .trim();
  const query = videoId
    ? strippedTitle && strippedTitle !== videoId
      ? strippedTitle
      : ''
    : trimmed;

  return {raw: trimmed, videoId, query};
}

export function pickBestRelatedCardIndex(cards, spec, excludeVideoId = null) {
  if (!spec || !Array.isArray(cards) || cards.length === 0) return -1;
  const eligible = cards.map((card, index) => ({
    index,
    videoId: card?.videoId || null,
    title: String(card?.title || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase(),
    text: String(card?.text || card?.title || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase(),
  }));

  const isAllowed = (item) =>
    !excludeVideoId || !item.videoId || item.videoId !== excludeVideoId;

  if (spec.videoId) {
    const idHit = eligible.find(
      (item) => isAllowed(item) && item.videoId === spec.videoId
    );
    if (idHit) return idHit.index;
    if (!spec.query) return -1;
  }

  const q = String(spec.query || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!q) return -1;

  const prefixHit = eligible.find(
    (item) => isAllowed(item) && item.title.startsWith(q)
  );
  if (prefixHit) return prefixHit.index;

  const titleHit = eligible.find(
    (item) => isAllowed(item) && item.title.includes(q)
  );
  if (titleHit) return titleHit.index;

  const textHit = eligible.find(
    (item) => isAllowed(item) && item.text.includes(q)
  );
  return textHit ? textHit.index : -1;
}

export function buildDefaultPinnedComment({question, tiktokQuestion} = {}) {
  const rawHook =
    question !== undefined && question !== null
      ? String(question).trim()
      : tiktokQuestion !== undefined && tiktokQuestion !== null
        ? String(tiktokQuestion).trim()
        : 'Which spot would you fly to first?';
  return rawHook
    ? `${rawHook} ✈️ ${DEFAULT_COMMENT_CTA}`
    : `✈️ ${DEFAULT_COMMENT_CTA}`;
}

export function pickPinMenuItemIndex(items) {
  if (!Array.isArray(items)) return -1;
  for (let i = 0; i < items.length; i++) {
    const raw = String(items[i]?.text || items[i]?.aria || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^pin(\s+comment)?$/i.test(raw)) return i;
  }
  return -1;
}

export function parseShortMetadataFile(txtPath) {
  const raw = fs.readFileSync(txtPath, 'utf8').replace(/\r\n/g, '\n');
  const [ytSectionRaw, ttSection = ''] = raw.split(/^===\s*TikTok\s*===$/m);

  const descSplit = ytSectionRaw.match(
    /^([\s\S]*?)\n+Description:[ \t]*\n([\s\S]*)$/
  );
  if (!descSplit) {
    throw new Error(`Could not parse Title/Description in ${txtPath}`);
  }
  const headerPart = descSplit[1];
  const youtubeDescription = descSplit[2].trim();

  const headerMatches = [
    ...headerPart.matchAll(/^(Title|Related video|Pinned comment):[ \t]*$/gm),
  ];
  let youtubeTitle = '';
  let relatedVideo = null;
  let pinnedComment = null;
  for (let i = 0; i < headerMatches.length; i++) {
    const key = headerMatches[i][1].toLowerCase();
    const valStart = headerMatches[i].index + headerMatches[i][0].length;
    const valEnd =
      i + 1 < headerMatches.length
        ? headerMatches[i + 1].index
        : headerPart.length;
    const val = headerPart.slice(valStart, valEnd).trim();
    if (key === 'title') youtubeTitle = val;
    else if (key === 'related video') relatedVideo = val || null;
    else if (key === 'pinned comment') pinnedComment = val || null;
  }
  if (!youtubeTitle) {
    throw new Error(`Could not parse Title in ${txtPath}`);
  }

  const captionMatch = ttSection.match(/^Caption:\n([\s\S]*)$/m);
  const cleanTitle = youtubeTitle
    .replace(/\s*\(Play free:\s*chillflight\.app\)\s*/i, '')
    .replace(/\s*#shorts$/i, '')
    .trim();
  const tiktokCaption = captionMatch
    ? captionMatch[1].trim()
    : `${cleanTitle} Play free at chillflight.app (or "Chill Flight" on App Store)\n\n#chillflight #cozygames #indiegame #lofi #flightsim`;

  return {
    youtube: {
      title: youtubeTitle,
      description: youtubeDescription,
      relatedVideo,
      pinnedComment,
    },
    tiktok: {
      caption: tiktokCaption,
    },
  };
}

export function resolveRelatedVideo(
  opts = {},
  meta = null,
  envRelated = process.env.YOUTUBE_RELATED_VIDEO
) {
  const chosen =
    opts.related !== undefined
      ? opts.related
      : envRelated !== undefined && envRelated !== ''
        ? envRelated
        : meta?.youtube?.relatedVideo !== null &&
            meta?.youtube?.relatedVideo !== undefined
          ? meta.youtube.relatedVideo
          : DEFAULT_RELATED_VIDEO;
  return parseRelatedVideoSpec(chosen);
}

export function resolvePinnedComment(
  opts = {},
  meta = null,
  envComment = process.env.YOUTUBE_PINNED_COMMENT
) {
  const normalize = (val) => {
    const trimmed = String(val ?? '').trim();
    if (!trimmed || /^(none|off|false)$/i.test(trimmed)) return null;
    return trimmed;
  };
  if (opts.comment !== undefined) return normalize(opts.comment);
  if (envComment !== undefined && envComment !== '') {
    return normalize(envComment);
  }
  if (
    meta?.youtube?.pinnedComment !== null &&
    meta?.youtube?.pinnedComment !== undefined
  ) {
    return normalize(meta.youtube.pinnedComment);
  }
  const ttLines = String(meta?.tiktok?.caption || '')
    .split('\n')
    .slice(1)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s &&
        !s.startsWith('#') &&
        !s.startsWith('Music:') &&
        !/^\d+:\d{2}\b/.test(s)
    );
  const legacyQuestion = ttLines.find((s) => s.endsWith('?'));
  return buildDefaultPinnedComment({
    question: legacyQuestion || 'Which spot would you fly to first?',
  });
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function parseScheduleSpec(raw, {allowPast = false} = {}) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) {
    throw new Error(
      `Invalid --schedule "${raw}". Expected "YYYY-MM-DD HH:MM" (24-hour local time).`
    );
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour24 = Number(m[4]);
  const minute = Number(m[5]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Out-of-range date/time in --schedule "${raw}".`);
  }
  const check = new Date(year, month - 1, day, hour24, minute);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day ||
    check.getHours() !== hour24
  ) {
    throw new Error(`Invalid local date/time in --schedule "${raw}".`);
  }
  // YouTube Studio schedules in 15-minute increments (:00, :15, :30, :45).
  const snappedMin = Math.round(minute / 15) * 15;
  const dt = new Date(year, month - 1, day, hour24, snappedMin);
  if (!allowPast && dt.getTime() < Date.now() + 5 * 60 * 1000) {
    throw new Error(
      `--schedule "${raw}" must be at least 5 minutes in the future.`
    );
  }
  const h24 = dt.getHours();
  const min = dt.getMinutes();
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(min).padStart(2, '0');
  const dateText = `${MONTH_SHORT[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
  const timeText = `${h12}:${mm} ${ampm}`;
  const isoLocal =
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-` +
    `${String(dt.getDate()).padStart(2, '0')} ` +
    `${String(h24).padStart(2, '0')}:${mm}`;
  return {
    raw: trimmed,
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    monthShort: MONTH_SHORT[dt.getMonth()],
    day: dt.getDate(),
    hour24: h24,
    minute: min,
    dateText,
    timeText,
    isoLocal,
  };
}

function parseArgs(argv) {
  const opts = {
    login: false,
    dryRun: false,
    publish: true,
    platform: 'youtube',
    visibility: 'public',
    schedule: null,
    related: undefined,
    comment: 'none',
    videoPath: null,
  };
  for (const arg of argv) {
    if (arg === '--login') opts.login = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--publish') opts.publish = true;
    else if (arg === '--review') opts.publish = false;
    else if (arg.startsWith('--platform=')) {
      opts.platform = arg.slice('--platform='.length).toLowerCase();
    } else if (arg.startsWith('--visibility=')) {
      opts.visibility = arg.slice('--visibility='.length).toLowerCase();
    } else if (arg.startsWith('--schedule=')) {
      opts.schedule = parseScheduleSpec(arg.slice('--schedule='.length));
    } else if (arg.startsWith('--related=')) {
      opts.related = arg.slice('--related='.length);
    } else if (arg === '--no-related') {
      opts.related = 'none';
    } else if (arg === '--pin-comment') {
      opts.comment = undefined;
    } else if (arg.startsWith('--comment=')) {
      opts.comment = arg.slice('--comment='.length);
    } else if (arg === '--no-comment') {
      opts.comment = 'none';
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (!arg.startsWith('-')) {
      opts.videoPath = arg;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return opts;
}

function printUsage() {
  console.log(
    [
      'Usage:',
      '  node scripts/post-short.js --login',
      '  node scripts/post-short.js <path/to/short.mp4> [options]',
      '',
      'Options:',
      '  --login                        Open Chrome to sign into YouTube Studio once',
      '  --platform=youtube|tiktok|all  Which platform(s) to upload to (default: youtube)',
      '  --visibility=public|unlisted|private  YouTube visibility (default: public)',
      '  --schedule="YYYY-MM-DD HH:MM"  Schedule YouTube Short for a future local date/time',
      `  --related=<title|url|id|none>  YouTube Short Related video (default: "${DEFAULT_RELATED_VIDEO}")`,
      '  --no-comment                   Skip auto-posting/pinning a YouTube comment (default)',
      '  --pin-comment                  Auto-post and pin the .txt Pinned comment on YouTube',
      '  --comment=<text|none>          Auto-post and pin custom first YouTube comment',
      '  --publish                      Automatically click the final Publish/Schedule button (default)',
      '  --review                       Fill everything and pause on final Publish/Schedule button',
      '  --dry-run                      Print parsed metadata without launching Chrome',
    ].join('\n')
  );
}

async function launchPersistentBrowser() {
  fs.mkdirSync(PROFILE_DIR, {recursive: true});
  const activePortFile = path.join(PROFILE_DIR, 'DevToolsActivePort');
  if (fs.existsSync(activePortFile)) {
    try {
      const lines = fs.readFileSync(activePortFile, 'utf8').trim().split('\n');
      const ws = `ws://127.0.0.1:${lines[0]}${lines[1]}`;
      return await puppeteer.connect({
        browserWSEndpoint: ws,
        defaultViewport: null,
      });
    } catch {
      // Stale DevToolsActivePort; fall through to launch
    }
  }
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: false,
    defaultViewport: null,
    userDataDir: PROFILE_DIR,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--hide-crash-restore-bubble',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

async function findFirstVisibleHandle(root, selector) {
  const handles = await root.$$(selector);
  for (const handle of handles) {
    const visible = await handle
      .evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      })
      .catch(() => false);
    if (visible) return handle;
  }
  return null;
}

async function humanClickHandle(page, handle) {
  await handle
    .evaluate((el) => el.scrollIntoView({block: 'center', inline: 'nearest'}))
    .catch(() => {});
  await humanSleep(280, 520);
  const box = await handle.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) {
    await handle.click();
    return;
  }
  const jitterX = (Math.random() - 0.5) * Math.min(box.width * 0.36, 28);
  const jitterY = (Math.random() - 0.5) * Math.min(box.height * 0.28, 8);
  const targetX = box.x + box.width / 2 + jitterX;
  const baseY = box.height > 80 ? box.y + 24 : box.y + box.height / 2;
  const targetY = baseY + jitterY;
  await page.mouse.move(targetX, targetY, {steps: randBetween(10, 20)});
  await humanSleep(70, 175);
  await page.mouse.down();
  await humanSleep(45, 105);
  await page.mouse.up();
}

async function humanClickSelector(page, selector, timeout = 30000) {
  const handle = await page.waitForSelector(selector, {
    visible: true,
    timeout,
  });
  await humanClickHandle(page, handle);
  return handle;
}

async function selectAllAndClear(page, selector) {
  await humanClickSelector(page, selector, 60000);
  await humanSleep(260, 480);

  const cdp = await page.createCDPSession();
  try {
    const modifiers = process.platform === 'darwin' ? 4 : 2;
    for (let pass = 0; pass < 3; pass++) {
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        modifiers,
        commands: ['selectAll'],
      });
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
      });
      await humanSleep(90, 180);
      await page.keyboard.press('Backspace');
      await humanSleep(180, 320);

      const remaining = await page.evaluate(
        (sel) => (document.querySelector(sel)?.textContent || '').length,
        selector
      );
      if (remaining === 0) break;
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
}

async function typeTextNaturally(page, text) {
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '\n') {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
      await humanSleep(120, 260);
    } else if (ch.charCodeAt(0) <= 0x7e) {
      await page.keyboard.type(ch, {delay: randBetween(26, 72)});
      if (ch === ' ' || ch === ',' || ch === ':' || ch === '.') {
        await humanSleep(45, 140);
      } else if (Math.random() < 0.07) {
        await humanSleep(70, 165);
      }
    } else {
      await page.keyboard.sendCharacter(ch);
      await humanSleep(45, 105);
    }
  }
}

async function insertMultilineNaturally(page, text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 0) {
      await page.keyboard.sendCharacter(line);
      await humanSleep(85, 210);
    }
    if (i < lines.length - 1) {
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
      await humanSleep(55, 130);
    }
  }
}

function normalizeMultiline(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function clearAndSetTextbox(page, selector, text, {mode = 'type'} = {}) {
  await page.waitForSelector(selector, {visible: true, timeout: 60000});

  for (let attempt = 1; attempt <= 3; attempt++) {
    await selectAllAndClear(page, selector);

    if (mode === 'paste') {
      await insertMultilineNaturally(page, text);
    } else {
      await typeTextNaturally(page, text);
    }

    await humanSleep(850, 1450);
    const actual = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el?.innerText ?? el?.textContent ?? '';
    }, selector);

    if (normalizeMultiline(actual) === normalizeMultiline(text)) {
      return normalizeMultiline(actual);
    }
    console.log(
      `  Textbox mismatch on attempt ${attempt} (got "${normalizeMultiline(actual).slice(0, 60)}"), retrying...`
    );
  }
  throw new Error(`Failed to set textbox ${selector} to expected value`);
}

async function readUploadedShortId(page) {
  const href = await page.evaluate(() => {
    const link = document.querySelector(
      'ytcp-uploads-dialog a[href*="youtube.com/shorts/"], ' +
        'ytcp-uploads-dialog a[href*="youtu.be/"], ' +
        'ytcp-video-info a[href*="youtube.com/shorts/"], ' +
        'ytcp-video-info a[href*="youtu.be/"]'
    );
    return link ? link.href : null;
  });
  return extractYouTubeVideoId(href);
}

async function dismissVideoPickerDialog(page) {
  const isOpen = await page.evaluate(() => {
    const dlg = document.querySelector(
      'ytcp-dialog.ytcp-video-pick-dialog tp-yt-paper-dialog[opened], ' +
        'ytcp-video-pick-dialog tp-yt-paper-dialog[opened]'
    );
    if (!dlg) return false;
    const rect = dlg.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!isOpen) return;

  const closeBtn = await page.$(
    'ytcp-dialog.ytcp-video-pick-dialog #close-button, ytcp-video-pick-dialog #close-button'
  );
  if (closeBtn) {
    await closeBtn.click().catch(() => {});
  } else {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await sleep(500);
}

async function readVisiblePickerCards(page) {
  const handles = await page.$$(
    'ytcp-video-pick-dialog ytcp-entity-card, ' +
      'tp-yt-paper-dialog[opened] ytcp-entity-card, ' +
      'ytcp-video-pick-dialog .entity-card, ' +
      'ytcp-video-pick-dialog ytcp-video-row'
  );
  const cards = [];
  for (const handle of handles) {
    const info = await handle
      .evaluate((el) => {
        const dlg = el.closest(
          'ytcp-video-pick-dialog, ytcp-dialog.ytcp-video-pick-dialog, tp-yt-paper-dialog[opened]'
        );
        if (!dlg) return null;
        const dr = dlg.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (dr.width <= 0 || r.width <= 0 || r.height <= 0) return null;
        const html = el.innerHTML || '';
        const thumbMatch = html.match(
          /\/vi(?:_webp)?\/([A-Za-z0-9_-]{11})\/|(?:watch\?v=|shorts\/|\/video\/)([A-Za-z0-9_-]{11})/
        );
        const videoId = thumbMatch ? thumbMatch[1] || thumbMatch[2] : null;
        const titleEl = el.querySelector(
          '.title, #video-title, .video-title, [id*="title"]'
        );
        const rawLines = (el.innerText || '')
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s && !/^\d+:\d{2}(?::\d{2})?$/.test(s));
        const title = (titleEl?.textContent || rawLines[0] || '').trim();
        return {
          videoId,
          title,
          text: (el.innerText || '').trim(),
        };
      })
      .catch(() => null);
    if (info) {
      cards.push({...info, handle});
    }
  }
  return cards;
}

async function clickVisiblePickerCardAt(page, cards, targetIndex) {
  const chosen = cards[targetIndex]?.handle;
  if (!chosen) return false;
  await humanClickHandle(page, chosen);
  return true;
}

async function typeIntoPickerSearch(page, text) {
  const searchSel =
    'ytcp-video-pick-dialog input#search-yours, ' +
    'ytcp-dialog.ytcp-video-pick-dialog input#search-yours, ' +
    'tp-yt-paper-dialog[opened] input#search-yours, ' +
    'ytcp-video-pick-dialog input, ' +
    'tp-yt-paper-dialog[opened] input[placeholder*="video" i], ' +
    'tp-yt-paper-dialog[opened] input[placeholder*="search" i]';
  const input = await findFirstVisibleHandle(page, searchSel);
  if (!input) return false;

  await humanClickHandle(page, input);
  await humanSleep(200, 420);
  await typeTextNaturally(page, text.slice(0, 50));
  await page.keyboard.press('Enter').catch(() => {});
  await humanSleep(950, 1500);
  return true;
}

async function selectRelatedVideoInPicker(page, spec, excludeVideoId) {
  const pickerSel =
    'ytcp-video-pick-dialog, ' +
    'ytcp-dialog.ytcp-video-pick-dialog tp-yt-paper-dialog[opened], ' +
    'ytcp-video-pick-dialog tp-yt-paper-dialog[opened], ' +
    'tp-yt-paper-dialog[opened] ytcp-entity-card, ' +
    'tp-yt-paper-dialog[opened] input#search-yours';

  try {
    await page.waitForSelector(pickerSel, {visible: true, timeout: 15000});
  } catch {
    return null;
  }

  // Wait for the initial channel video grid to populate and check it first
  // before touching the search box (recent long-form videos are usually
  // already visible near the top of the grid)
  await page
    .waitForSelector(
      'ytcp-video-pick-dialog ytcp-entity-card, tp-yt-paper-dialog[opened] ytcp-entity-card',
      {visible: true, timeout: 10000}
    )
    .catch(() => {});
  await humanSleep(750, 1350);

  let cards = await readVisiblePickerCards(page);
  let bestIdx = pickBestRelatedCardIndex(cards, spec, excludeVideoId);

  // Fall back to typing into #search-yours if the target video wasn't in the initial grid
  const searchTerm = spec.query || spec.videoId || '';
  if (bestIdx < 0 && searchTerm) {
    const searched = await typeIntoPickerSearch(page, searchTerm);
    if (searched) {
      for (let poll = 0; poll < 6 && bestIdx < 0; poll++) {
        cards = await readVisiblePickerCards(page);
        bestIdx = pickBestRelatedCardIndex(cards, spec, excludeVideoId);
        if (bestIdx < 0) await humanSleep(750, 1150);
      }
    }
  }

  if (bestIdx < 0) {
    await dismissVideoPickerDialog(page);
    return null;
  }

  const matchedTitle = cards[bestIdx].title || spec.raw;
  const clicked = await clickVisiblePickerCardAt(page, cards, bestIdx);
  if (!clicked) {
    await dismissVideoPickerDialog(page);
    return null;
  }

  await page
    .waitForFunction(
      () => {
        const dlg = document.querySelector(
          'ytcp-dialog.ytcp-video-pick-dialog tp-yt-paper-dialog[opened], ' +
            'ytcp-video-pick-dialog tp-yt-paper-dialog[opened]'
        );
        if (!dlg) return true;
        const r = dlg.getBoundingClientRect();
        return r.width === 0 || r.height === 0;
      },
      {timeout: 12000}
    )
    .catch(() => {});
  await humanSleep(900, 1600);
  return matchedTitle;
}

async function inspectAndClickRelatedTrigger(page, spec = null) {
  const expectedQuery = String(spec?.query || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  // 1. Dropdown trigger style (Details sidepanel or /video/<id>/edit page)
  const dropdowns = await page.$$('ytcp-dropdown-trigger');
  for (const dd of dropdowns) {
    const info = await dd
      .evaluate((el, alreadyQuery) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const fullText = (el.innerText || '').replace(/\s+/g, ' ').trim();
        const label = (
          el.querySelector('.label-text')?.textContent || fullText
        ).trim();
        if (!/related video/i.test(label) && !/related video/i.test(fullText)) {
          return null;
        }
        if (alreadyQuery && fullText.toLowerCase().includes(alreadyQuery)) {
          return 'already-set';
        }
        const disabled = Boolean(
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.closest('[disabled], [aria-disabled="true"]')
        );
        return disabled ? 'disabled' : 'ready';
      }, expectedQuery)
      .catch(() => null);
    if (info === 'already-set' || info === 'disabled') return info;
    if (info === 'ready') {
      await humanClickHandle(page, dd);
      return 'clicked';
    }
  }

  // 2. Upload wizard "Video elements" direct button
  const directBtns = await page.$$(
    '#related-video-button, [id*="related-video"] ytcp-button, [id*="related-video"] button, ytcp-button[aria-label*="related video" i], button[aria-label*="related video" i]'
  );
  for (const btn of directBtns) {
    const info = await btn
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const disabled = Boolean(
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.closest('[disabled], [aria-disabled="true"]')
        );
        return disabled ? 'disabled' : 'ready';
      })
      .catch(() => null);
    if (info === 'disabled') return 'disabled';
    if (info === 'ready') {
      await humanClickHandle(page, btn);
      return 'clicked';
    }
  }

  // 3. Fallback row scan inside Video elements step
  const rowBtns = await page.$$(
    'ytcp-uploads-video-elements ytcp-button, ytcp-uploads-video-elements button, ytcp-video-elements ytcp-button, ytcp-video-elements button'
  );
  for (const btn of rowBtns) {
    const info = await btn
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        let row = el.parentElement;
        while (row && (row.innerText || '').length < 18) {
          row = row.parentElement;
        }
        const txt = (row?.innerText || '').trim();
        if (!/related video/i.test(txt) || txt.length >= 360) return null;
        const disabled = Boolean(
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.closest('[disabled], [aria-disabled="true"]')
        );
        return disabled ? 'disabled' : 'ready';
      })
      .catch(() => null);
    if (info === 'disabled') return 'disabled';
    if (info === 'ready') {
      await humanClickHandle(page, btn);
      return 'clicked';
    }
  }

  return 'missing';
}

async function tryAttachRelatedVideoInWizard(page, spec, excludeVideoId) {
  const started = Date.now();
  let sawDisabled = false;
  while (Date.now() - started < 15000) {
    const triggerStatus = await inspectAndClickRelatedTrigger(page, spec);
    if (triggerStatus === 'already-set') {
      console.log(`  YouTube Related video already set: ${spec.raw}`);
      return true;
    }
    if (triggerStatus === 'clicked') {
      const matched = await selectRelatedVideoInPicker(
        page,
        spec,
        excludeVideoId
      );
      if (matched) {
        console.log(`  Attached YouTube Related video: ${matched}`);
        return true;
      }
      console.warn(
        `  Could not match Related video "${spec.raw}" in YouTube Studio picker.`
      );
      return false;
    }
    if (triggerStatus === 'disabled') {
      sawDisabled = true;
    } else if (!sawDisabled && Date.now() - started > 2500) {
      // No Related video control rendered on this wizard step
      return false;
    }
    await sleep(800);
  }
  return false;
}

async function attachRelatedVideoOnEditPage(page, shortId, spec) {
  const editUrl = `${YOUTUBE_STUDIO_URL}/video/${shortId}/edit`;
  console.log(
    `  Opening Studio editor (${shortId}) to attach Related video...`
  );
  const onDialog = (d) => d.accept().catch(() => {});
  page.on('dialog', onDialog);
  try {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto(editUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        break;
      } catch (err) {
        if (!String(err.message || '').includes('interrupted') || attempt === 3)
          throw err;
        await sleep(2500);
      }
    }

    const started = Date.now();
    let clicked = false;
    while (Date.now() - started < 25000) {
      const status = await inspectAndClickRelatedTrigger(page, spec);
      if (status === 'already-set') {
        console.log(`  YouTube Related video already saved: ${spec.raw}`);
        return true;
      }
      if (status === 'clicked') {
        clicked = true;
        break;
      }
      await sleep(800);
    }
    if (!clicked) {
      console.warn(
        `  Related video field did not appear on ${editUrl}; skipping.`
      );
      return false;
    }

    const matched = await selectRelatedVideoInPicker(page, spec, shortId);
    if (!matched) {
      console.warn(
        `  Could not match Related video "${spec.raw}" in Studio editor picker.`
      );
      return false;
    }

    const saveSel = 'ytcp-button#save:not([aria-disabled="true"])';
    await page.waitForSelector(saveSel, {visible: true, timeout: 15000});
    await page.click(saveSel);
    await page.waitForFunction(
      () =>
        document
          .querySelector('ytcp-button#save')
          ?.getAttribute('aria-disabled') === 'true',
      {timeout: 30000}
    );
    await sleep(1000);
    console.log(`  Saved YouTube Related video on Short: ${matched}`);
    return true;
  } catch (err) {
    console.warn(
      `  Post-publish Related video step failed (${err.message}); Short is already published.`
    );
    return false;
  } finally {
    page.off('dialog', onDialog);
  }
}

async function postAndPinYouTubeComment(page, shortId, commentText) {
  const shortUrl = `https://www.youtube.com/shorts/${shortId}`;
  const watchUrl = `https://www.youtube.com/watch?v=${shortId}`;
  console.log(`\n=== Posting & Pinning YouTube Comment (${shortId}) ===`);

  const muteVideos = () =>
    page
      .evaluate(() => {
        for (const v of document.querySelectorAll('video')) {
          v.muted = true;
          v.pause();
        }
      })
      .catch(() => {});

  let posted = false;
  try {
    let commentBoxReady = false;
    for (const targetUrl of [shortUrl, watchUrl]) {
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await sleep(2500);
      await muteVideos();

      const waitStart = Date.now();
      let clickedOpenComments = false;
      while (Date.now() - waitStart < 18000) {
        await muteVideos();

        const placeholder = await findFirstVisibleHandle(
          page,
          '#placeholder-area, #simplebox-placeholder, ytd-commentbox #contenteditable-root[contenteditable="true"]'
        );
        if (placeholder) {
          commentBoxReady = true;
          break;
        }

        if (page.url().includes('/shorts/')) {
          if (!clickedOpenComments) {
            const commentBtns = await page.$$(
              'ytd-reel-video-renderer[is-active] #comments-button button, ' +
                '#comments-button button, ' +
                'ytd-reel-player-overlay-renderer button[aria-label*="comment" i], ' +
                'button[aria-label*="View comments" i]'
            );
            for (const btn of commentBtns) {
              const ok = await btn
                .evaluate((el) => {
                  const rect = el.getBoundingClientRect();
                  const aria = (el.getAttribute('aria-label') || '').trim();
                  return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    !/turn off|disable|sort/i.test(aria)
                  );
                })
                .catch(() => false);
              if (ok) {
                await btn.click();
                clickedOpenComments = true;
                await sleep(1200);
                break;
              }
            }
          }
        } else {
          await page
            .evaluate(() => {
              const comments = document.querySelector('ytd-comments#comments');
              if (comments) comments.scrollIntoView({block: 'center'});
              else window.scrollBy(0, 500);
            })
            .catch(() => {});
        }
        await sleep(900);
      }

      if (commentBoxReady) break;
    }

    if (!commentBoxReady) {
      throw new Error('YouTube comment box did not become visible');
    }

    const placeholderHandle = await findFirstVisibleHandle(
      page,
      '#placeholder-area, #simplebox-placeholder'
    );
    if (placeholderHandle) {
      await placeholderHandle.click();
      await sleep(700);
    }

    const editorSel =
      'ytd-commentbox #contenteditable-root[contenteditable="true"], ' +
      '#contenteditable-root[contenteditable="true"][aria-label*="comment" i]';
    const editorStart = Date.now();
    let editorHandle = null;
    while (Date.now() - editorStart < 15000) {
      editorHandle = await findFirstVisibleHandle(page, editorSel);
      if (editorHandle) break;
      await sleep(400);
    }
    if (!editorHandle) {
      throw new Error('Comment text editor did not open');
    }

    await muteVideos();
    await editorHandle.click();
    await sleep(250);

    const insertedState = await editorHandle.evaluate((el, value) => {
      el.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('delete', false, null);
      const inserted = document.execCommand('insertText', false, value);
      if (!inserted || !(el.textContent || '').trim()) {
        const dt = new DataTransfer();
        dt.setData('text/plain', value);
        el.dispatchEvent(
          new ClipboardEvent('paste', {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          })
        );
      }
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: value,
        })
      );
      return {
        text: (el.textContent || '').trim(),
        focused:
          document.activeElement === el || el.contains(document.activeElement),
      };
    }, commentText);

    if (!insertedState.text && insertedState.focused) {
      await page.keyboard.type(commentText, {delay: 8});
    } else if (insertedState.focused) {
      // Nudge Polymer's observer in case execCommand didn't enable #submit-button
      await page.keyboard.press('End');
      await page.keyboard.press('Space');
      await page.keyboard.press('Backspace');
    }
    await sleep(500);

    const submitSel =
      'ytd-commentbox #submit-button button:not([disabled]):not([aria-disabled="true"]), ' +
      'ytd-commentbox #submit-button:not([disabled]):not([aria-disabled="true"]) button';
    const submitStart = Date.now();
    let submitBtn = null;
    while (Date.now() - submitStart < 10000) {
      submitBtn = await findFirstVisibleHandle(page, submitSel);
      if (submitBtn) break;
      await sleep(300);
    }
    if (!submitBtn) {
      throw new Error('Comment submit button remained disabled');
    }

    await submitBtn.click();

    const needle = commentText
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32)
      .toLowerCase();
    const threadStart = Date.now();
    let matchedThread = null;
    while (Date.now() - threadStart < 20000) {
      const threads = await page.$$('ytd-comment-thread-renderer');
      for (const thread of threads) {
        const match = await thread
          .evaluate((el, q) => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const body = (
              el.querySelector('#content-text')?.innerText ||
              el.innerText ||
              ''
            )
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
            return body.includes(q);
          }, needle)
          .catch(() => false);
        if (match) {
          matchedThread = thread;
          break;
        }
      }
      if (matchedThread) break;
      await sleep(600);
    }

    if (!matchedThread) {
      throw new Error('Posted comment thread did not appear in list');
    }
    posted = true;
    console.log('  Posted first comment on YouTube Short.');

    await matchedThread.hover().catch(() => {});
    await sleep(300);

    const actionMenuBtn = await findFirstVisibleHandle(
      matchedThread,
      '#action-menu button, ytd-menu-renderer button, button[aria-label*="Action menu" i], button[aria-label*="More actions" i]'
    );
    if (!actionMenuBtn) {
      throw new Error('Could not find 3-dot action menu on posted comment');
    }
    await actionMenuBtn.click();
    await sleep(700);

    const rawMenuHandles = await page.$$(
      'ytd-menu-popup-renderer ytd-menu-service-item-renderer, ' +
        'ytd-menu-popup-renderer tp-yt-paper-item, ' +
        'tp-yt-iron-dropdown:not([aria-hidden="true"]) ytd-menu-service-item-renderer, ' +
        'tp-yt-iron-dropdown:not([aria-hidden="true"]) [role="menuitem"]'
    );
    const visibleMenuHandles = [];
    const menuItems = [];
    for (const handle of rawMenuHandles) {
      const info = await handle
        .evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return {
            visible: rect.width > 0 && rect.height > 0,
            text: (el.innerText || el.textContent || '').trim(),
            aria: (el.getAttribute('aria-label') || '').trim(),
          };
        })
        .catch(() => ({visible: false, text: '', aria: ''}));
      if (info.visible) {
        visibleMenuHandles.push(handle);
        menuItems.push({text: info.text, aria: info.aria});
      }
    }

    const pinIdx = pickPinMenuItemIndex(menuItems);
    if (pinIdx < 0) {
      throw new Error(
        `Pin option not found in comment menu (${menuItems.map((m) => m.text).join(', ') || 'empty'})`
      );
    }
    await visibleMenuHandles[pinIdx].click();
    await sleep(700);

    // Confirm the "Pin this comment?" dialog
    const confirmStart = Date.now();
    let confirmed = false;
    while (Date.now() - confirmStart < 10000) {
      const confirmBtns = await page.$$(
        'yt-confirm-dialog-renderer #confirm-button button, ' +
          'yt-confirm-dialog-renderer #confirm-button, ' +
          'tp-yt-paper-dialog[opened] #confirm-button button, ' +
          'tp-yt-paper-dialog[opened] button, ' +
          '[role="dialog"] #confirm-button button, ' +
          '[role="dialog"] button'
      );
      for (const btn of confirmBtns) {
        const ok = await btn
          .evaluate((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            const text = (el.innerText || el.textContent || '').trim();
            const aria = (el.getAttribute('aria-label') || '').trim();
            const inConfirmSlot = Boolean(el.closest('#confirm-button'));
            return (
              /^pin$/i.test(text) ||
              /^pin$/i.test(aria) ||
              (inConfirmSlot && !/cancel/i.test(`${text} ${aria}`))
            );
          })
          .catch(() => false);
        if (ok) {
          await btn.click();
          confirmed = true;
          break;
        }
      }
      if (confirmed) break;
      await sleep(350);
    }

    if (!confirmed) {
      throw new Error('Pin confirmation dialog button was not found');
    }
    await sleep(1200);
    console.log('  Pinned comment on YouTube Short!');
    return true;
  } catch (err) {
    if (posted) {
      console.warn(
        `  Comment was posted, but auto-pin did not complete (${err.message}). Pin it at ${shortUrl}`
      );
    } else {
      console.warn(
        `  Auto-comment/pin skipped (${err.message}); Short is already published at ${shortUrl}`
      );
      console.warn(`  Ready-to-paste comment: ${commentText}`);
    }
    return false;
  }
}

async function waitForUploadAndChecks(page) {
  console.log('  Waiting naturally for YouTube upload & Checks to finish...');
  await humanSleep(3200, 5200);
  const started = Date.now();
  while (Date.now() - started < 28000) {
    const status = await page
      .evaluate(() => {
        const dlg = document.querySelector('ytcp-uploads-dialog');
        if (!dlg) return {done: true, summary: 'dialog closed'};
        const txt = (dlg.innerText || '').replace(/\s+/g, ' ');
        const uploading = /uploading\s+\d+%/i.test(txt);
        const checking =
          /checking\s+\d+%|checks running|still checking|processing\s+up\s+to\s+hd.*\d+\s*(seconds?|minutes?)\s+left/i.test(
            txt
          );
        const checksComplete = /checks complete|no issues found/i.test(txt);
        return {
          done: !uploading && (checksComplete || !checking),
          uploading,
          checking,
          checksComplete,
        };
      })
      .catch(() => ({done: false}));
    if (status.done) {
      if (status.checksComplete) {
        console.log('  YouTube Checks completed cleanly.');
      }
      await humanSleep(1200, 2200);
      return;
    }
    await humanSleep(2200, 3400);
  }
  console.log('  Proceeding to Visibility after waiting on Checks...');
}

async function uploadToYouTube(
  browser,
  mp4Path,
  meta,
  opts,
  relatedSpec,
  pinnedComment
) {
  console.log('\n=== Uploading to YouTube Studio ===');
  const page = await browser.newPage();
  await page.goto(YOUTUBE_STUDIO_URL, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  let isGoogleSignInHost = false;
  try {
    isGoogleSignInHost = new URL(page.url()).hostname === 'accounts.google.com';
  } catch {
    // Ignore unparseable URL
  }
  if (isGoogleSignInHost) {
    console.log(
      '  Not signed into YouTube Studio yet. Please sign in in the opened Chrome window...'
    );
    await page.waitForFunction(
      () => location.hostname === 'studio.youtube.com',
      {timeout: 300000}
    );
    await humanSleep(2800, 4200);
  } else {
    await humanSleep(1800, 3200);
  }

  // Click "Create" -> "Upload videos" if input[type=file] isn't already on page
  let fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    const createBtnSel =
      'button[aria-label="Create"], button[aria-label="Upload videos"], #upload-icon';
    await humanClickSelector(page, createBtnSel, 30000);
    await humanSleep(700, 1300);

    const uploadItem = await findFirstVisibleHandle(
      page,
      'tp-yt-paper-item#text-item-0'
    );
    if (uploadItem) {
      await humanClickHandle(page, uploadItem);
      await humanSleep(850, 1500);
    }
    fileInput = await page.waitForSelector('input[type="file"]', {
      timeout: 60000,
    });
  }

  await humanSleep(600, 1200);
  console.log(`  Selecting file: ${path.basename(mp4Path)}`);
  await fileInput.uploadFile(mp4Path);

  // Wait for Title & Description fields in the upload modal, and wait until
  // YouTube Studio finishes pre-filling the default filename into Title so its
  // async hydration doesn't clobber our custom title a moment later
  const titleSel =
    '#title-textarea #textbox[contenteditable="true"], #textbox[contenteditable="true"][aria-label*="title" i]';
  const descSel =
    '#description-textarea #textbox[contenteditable="true"], #textbox[contenteditable="true"][aria-label*="tell viewers" i]';

  await page.waitForSelector(titleSel, {visible: true, timeout: 60000});
  await page
    .waitForFunction(
      (sel) =>
        (document.querySelector(sel)?.textContent || '').trim().length > 0,
      {timeout: 15000},
      titleSel
    )
    .catch(() => {});
  await humanSleep(1500, 2600);

  console.log('  Typing YouTube Title naturally...');
  const verifiedTitle = await clearAndSetTextbox(page, titleSel, meta.title, {
    mode: 'type',
  });
  console.log(`  Verified YouTube Title: ${verifiedTitle}`);
  await humanSleep(900, 1700);

  console.log('  Pasting YouTube Description...');
  await clearAndSetTextbox(page, descSel, meta.description, {mode: 'paste'});
  await humanSleep(1200, 2200);

  // Re-verify Title right after Description in case focus change triggered hydration
  const titleCheck = await page.evaluate(
    (sel) => (document.querySelector(sel)?.textContent || '').trim(),
    titleSel
  );
  if (titleCheck !== meta.title.trim()) {
    await clearAndSetTextbox(page, titleSel, meta.title, {mode: 'type'});
  }

  // Scroll down the Details pane naturally and select "No, it's not made for kids"
  await page.mouse.wheel({deltaY: randBetween(240, 380)}).catch(() => {});
  await humanSleep(750, 1400);
  const notForKidsSel =
    'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]';
  await humanClickSelector(page, notForKidsSel, 30000);
  await humanSleep(1100, 1900);

  let shortId = await readUploadedShortId(page);
  let relatedAttached = false;

  // Click Next 3 times (Details -> Video elements -> Checks -> Visibility),
  // attaching Related video on Step 2 and waiting on Step 3 until Checks finish
  for (let step = 0; step < 3; step++) {
    await humanClickSelector(page, '#next-button', 30000);
    await humanSleep(1500, 2600);

    if (step === 0) {
      shortId = shortId || (await readUploadedShortId(page));
      if (relatedSpec && !relatedAttached) {
        relatedAttached = await tryAttachRelatedVideoInWizard(
          page,
          relatedSpec,
          shortId
        );
        await humanSleep(900, 1600);
      }
    } else if (step === 1) {
      await waitForUploadAndChecks(page);
    }
  }

  // Select visibility or Schedule radio button
  if (opts.schedule) {
    console.log(
      `  Scheduling on YouTube for ${opts.schedule.dateText} at ${opts.schedule.timeText}...`
    );
    const pickerAlreadyOpen = await findFirstVisibleHandle(
      page,
      '#datepicker-trigger'
    );
    if (!pickerAlreadyOpen) {
      const schedToggle = await findFirstVisibleHandle(
        page,
        '#second-container-expand-button, tp-yt-paper-radio-button#schedule-radio-button'
      );
      if (schedToggle) {
        await humanClickHandle(page, schedToggle);
      } else {
        await humanClickSelector(
          page,
          'tp-yt-paper-radio-button#schedule-radio-button, #second-container-expand-button',
          30000
        );
      }
      await humanSleep(1000, 1800);
    }

    // Helper: select all via native .select() + Backspace (reliable on macOS Chromium)
    const replaceInput = async (handle, value) => {
      await humanClickHandle(page, handle);
      await humanSleep(250, 450);
      await handle.evaluate((el) => {
        el.focus();
        if (typeof el.select === 'function') el.select();
      });
      await page.keyboard.press('Backspace');
      await humanSleep(150, 300);
      await page.keyboard.type(value, {delay: randBetween(45, 85)});
      await page.keyboard.press('Enter');
      await humanSleep(750, 1250);
    };

    // Date picker: click trigger, replace date text, press Enter
    await humanClickSelector(page, '#datepicker-trigger', 20000);
    await humanSleep(700, 1200);
    const dateInput = await page.waitForSelector(
      'ytcp-date-picker input, tp-yt-paper-dialog[opened] ytcp-date-picker input',
      {visible: true, timeout: 15000}
    );
    await replaceInput(dateInput, opts.schedule.dateText);

    // Time picker: click time input, replace time text, press Enter + Tab
    const timeInput = await page.waitForSelector(
      '#time-of-day-container input, ytcp-datetime-picker #time-of-day-container input',
      {visible: true, timeout: 15000}
    );
    await replaceInput(timeInput, opts.schedule.timeText);
    await page.keyboard.press('Tab');
    await humanSleep(600, 1000);

    const readBack = await page.evaluate(() => {
      const dateEl = document.querySelector('#datepicker-trigger');
      const timeEl = document.querySelector('#time-of-day-container input');
      const doneEl =
        document.querySelector('ytcp-uploads-dialog #done-button') ||
        document.querySelector('#done-button');
      return {
        date: (dateEl?.innerText || dateEl?.textContent || '')
          .replace(/\s+/g, ' ')
          .trim(),
        time: (timeEl?.value || '').replace(/\s+/g, ' ').trim(),
        doneText: (doneEl?.innerText || doneEl?.textContent || '').trim(),
      };
    });
    console.log(
      `  Verified YouTube Schedule: ${readBack.date || '(unknown date)'} @ ${readBack.time || '(unknown time)'} (button: "${readBack.doneText}")`
    );
    const normTime = (s) => s.toUpperCase().replace(/\s+/g, '');
    if (
      !readBack.date.includes(opts.schedule.monthShort) ||
      !readBack.date.includes(String(opts.schedule.day)) ||
      !readBack.date.includes(String(opts.schedule.year)) ||
      normTime(readBack.time) !== normTime(opts.schedule.timeText)
    ) {
      throw new Error(
        `YouTube schedule mismatch: expected "${opts.schedule.dateText} @ ${opts.schedule.timeText}", read "${readBack.date} @ ${readBack.time}"`
      );
    }
    if (!/schedule/i.test(readBack.doneText)) {
      throw new Error(
        `Expected YouTube submit button to read "Schedule", got "${readBack.doneText}"`
      );
    }
  } else {
    const visName = opts.visibility.toUpperCase(); // PUBLIC, UNLISTED, PRIVATE
    const visSel = `tp-yt-paper-radio-button[name="${visName}"]`;
    await humanClickSelector(page, visSel, 30000);
    await humanSleep(1400, 2400);
  }

  shortId = shortId || (await readUploadedShortId(page));

  if (opts.publish) {
    console.log(
      opts.schedule
        ? '  Clicking Schedule on YouTube...'
        : '  Clicking Publish on YouTube...'
    );
    const doneSel =
      'ytcp-uploads-dialog #done-button:not([disabled]):not([aria-disabled="true"])';
    await page.waitForSelector(doneSel, {
      visible: true,
      timeout: 120000,
    });
    await humanSleep(500, 900);
    const doneHandle = await findFirstVisibleHandle(page, doneSel);
    if (doneHandle) {
      await doneHandle.click();
    } else {
      await page.click(doneSel);
    }

    // Poll for up to 90s: if YouTube prompts "Publish/Schedule anyway" or
    // "We're still checking your content" ("Got it"), confirm it; then wait
    // until `ytcp-video-share-dialog` opens or `ytcp-uploads-dialog` closes.
    const publishStart = Date.now();
    let clickedPublishAnyway = false;
    let retriedDoneButton = false;
    let scheduleConfirmed = false;
    let publishedUrl = null;
    while (Date.now() - publishStart < 90000) {
      await humanSleep(900, 1400);

      if (!clickedPublishAnyway) {
        const dialogButtons = await page.$$(
          'ytcp-confirmation-dialog ytcp-button, ' +
            'ytcp-confirmation-dialog button, ' +
            'tp-yt-paper-dialog[opened] ytcp-button, ' +
            'tp-yt-paper-dialog[opened] button, ' +
            '[role="dialog"] ytcp-button, ' +
            '[role="dialog"] button'
        );
        for (const btn of dialogButtons) {
          const info = await btn.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const dlg = el.closest(
              'ytcp-confirmation-dialog, tp-yt-paper-dialog[opened], [role="dialog"]'
            );
            return {
              text: (el.innerText || el.textContent || '').trim(),
              aria: (el.getAttribute('aria-label') || '').trim(),
              dlgText: (dlg?.innerText || '').replace(/\s+/g, ' ').trim(),
              visible: rect.width > 0 && rect.height > 0,
            };
          });
          const isAnyway =
            /(publish|schedule) anyway/i.test(info.text) ||
            /(publish|schedule) anyway/i.test(info.aria);
          const isStillCheckingGotIt =
            /^got it$/i.test(info.text) &&
            /still checking your (content|video)/i.test(info.dlgText);
          if (info.visible && (isAnyway || isStillCheckingGotIt)) {
            console.log(
              isStillCheckingGotIt
                ? '  Confirming "Still checking your content (Got it)" dialog on YouTube...'
                : '  Confirming "Publish/Schedule anyway" dialog on YouTube...'
            );
            await humanSleep(700, 1300);
            await btn.click();
            clickedPublishAnyway = true;
            await humanSleep(2000, 3000);
            if (isStillCheckingGotIt) {
              scheduleConfirmed = true;
              break;
            }
            break;
          }
        }
        if (scheduleConfirmed) break;
      }

      if (
        !retriedDoneButton &&
        !clickedPublishAnyway &&
        Date.now() - publishStart > 6500
      ) {
        const canRetryDone = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const hit = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2
          );
          return Boolean(hit && el.contains(hit));
        }, doneSel);
        if (canRetryDone) {
          retriedDoneButton = true;
          await page.click(doneSel).catch(() => {});
        }
      }

      const shareState = await page.evaluate(() => {
        const shareDialog = [
          ...document.querySelectorAll(
            'ytcp-video-share-dialog, ytcp-uploads-still-processing-dialog'
          ),
        ].find((d) => {
          const rect = d.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (shareDialog) {
          const link = shareDialog.querySelector(
            'a[href*="youtube.com/shorts/"], a[href*="youtu.be/"]'
          );
          return {
            kind: 'dialog',
            text: (shareDialog.innerText || '').slice(0, 200),
            href: link ? link.href : null,
          };
        }
        const uploadPaperDialog = document.querySelector(
          'ytcp-uploads-dialog tp-yt-paper-dialog[opened]'
        );
        if (
          !uploadPaperDialog ||
          uploadPaperDialog.getBoundingClientRect().width === 0
        ) {
          return {kind: 'closed', text: '', href: null};
        }
        return null;
      });
      if (shareState) {
        publishedUrl = shareState.href;
        if (shareState.kind === 'dialog') {
          await humanSleep(1800, 2800);
          const closeBtns = await page.$$(
            'ytcp-video-share-dialog #close-button, ytcp-uploads-still-processing-dialog #close-button'
          );
          for (const closeBtn of closeBtns) {
            const vis = await closeBtn.evaluate(
              (el) => el.getBoundingClientRect().width > 0
            );
            if (vis) {
              await closeBtn.click().catch(() => {});
              break;
            }
          }
          await humanSleep(1500, 2400);
        } else {
          await humanSleep(1200, 2000);
        }
        scheduleConfirmed = true;
        break;
      }
    }

    if (publishedUrl) {
      shortId = shortId || extractYouTubeVideoId(publishedUrl);
      console.log(
        opts.schedule
          ? `  YouTube Short scheduled: ${publishedUrl}`
          : `  YouTube Short published: ${publishedUrl}`
      );
    } else if (opts.schedule && !scheduleConfirmed) {
      throw new Error(
        'YouTube upload dialog remained open after clicking Schedule; the video may still be a Draft.'
      );
    } else {
      console.log(
        opts.schedule
          ? '  YouTube Short scheduled cleanly.'
          : '  YouTube Short publish flow completed.'
      );
    }

    if (relatedSpec && !relatedAttached && shortId) {
      await attachRelatedVideoOnEditPage(page, shortId, relatedSpec);
    }

    if (pinnedComment) {
      if (opts.schedule) {
        console.log(
          '  Skipping auto-comment/pin because YouTube Short is scheduled for future publish.'
        );
      } else if (opts.visibility === 'private') {
        console.log(
          '  Skipping auto-comment/pin because YouTube visibility is private.'
        );
      } else if (!shortId) {
        console.warn(
          '  Could not determine Short video ID; skipping auto-comment/pin.'
        );
      } else {
        await postAndPinYouTubeComment(page, shortId, pinnedComment);
      }
    }
  } else {
    if (relatedSpec && !relatedAttached) {
      console.log(
        `  Note: Related video "${relatedSpec.raw}" was not yet selectable on Video elements; verify it in Chrome before or after publishing.`
      );
    }
    if (pinnedComment) {
      console.log(
        `  Pinned comment to post after publishing: ${pinnedComment}`
      );
    }
    console.log(
      '  YouTube Studio is ready on the final Visibility screen (click "Publish" in Chrome).'
    );
  }
}

async function uploadToTikTok(browser, mp4Path, meta, opts) {
  console.log('\n=== Uploading to TikTok Studio ===');
  const page = await browser.newPage();
  await page.goto(TIKTOK_UPLOAD_URL, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });

  if (page.url().includes('/login')) {
    console.log(
      '  Not signed into TikTok yet. Please sign in in the opened Chrome window...'
    );
    await page.waitForFunction(() => !location.pathname.includes('/login'), {
      timeout: 300000,
    });
    await sleep(3000);
  }

  console.log(`  Selecting file: ${path.basename(mp4Path)}`);
  const fileInput = await page.waitForSelector('input[type="file"]', {
    timeout: 60000,
  });
  await fileInput.uploadFile(mp4Path);

  console.log('  Waiting for TikTok video file upload to reach 100%...');
  await page.waitForFunction(() => /Uploaded/i.test(document.body.innerText), {
    timeout: 120000,
  });

  const captionSel =
    '.public-DraftEditor-content[contenteditable="true"], [contenteditable="true"][role="combobox"], .caption-editor [contenteditable="true"]';
  console.log('  Waiting for TikTok caption editor...');
  await page.waitForSelector(captionSel, {visible: true, timeout: 60000});
  await sleep(1000);

  // Clear default filename caption via DOM Range + Backspace, then paste via
  // ClipboardEvent so Draft.js parses multi-line blocks without crashing React
  await page.click(captionSel);
  await sleep(150);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.focus();
    const selObj = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selObj.removeAllRanges();
    selObj.addRange(range);
  }, captionSel);
  await page.keyboard.press('Backspace');
  await sleep(200);

  await page.evaluate(
    ({sel, value}) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', value);
      const evt = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      el.dispatchEvent(evt);
    },
    {sel: captionSel, value: meta.caption}
  );
  await sleep(600);
  // Dismiss any hashtag autocomplete popover
  await page.keyboard.press('Escape');

  const postBtnSel =
    'button[data-e2e="post_video_button"]:not([disabled]):not([aria-disabled="true"])';
  console.log('  Waiting for TikTok Post button to become enabled...');
  await page.waitForSelector(postBtnSel, {timeout: 120000});
  await page.evaluate((sel) => {
    document.querySelector(sel)?.scrollIntoView({block: 'center'});
  }, postBtnSel);

  if (opts.publish) {
    console.log('  Clicking Post on TikTok...');
    await sleep(500);
    await page.click(postBtnSel);

    // Wait up to 30s for either redirect to /tiktokstudio/content or the
    // "Continue to post? ... Post now" modal (must use a trusted Puppeteer
    // ElementHandle.click() so TikTok fires /tiktok/web/project/post/v1/)
    const started = Date.now();
    while (Date.now() - started < 30000) {
      if (page.url().includes('/content')) break;
      const modalBtns = await page.$$(
        '.TUXModal button, [role="dialog"] button'
      );
      for (const btn of modalBtns) {
        const txt = await btn.evaluate((el) => el.innerText.trim());
        if (/^post now$/i.test(txt)) {
          console.log('  Confirming "Post now" modal on TikTok...');
          await btn.click();
          await sleep(2000);
          break;
        }
      }
      await sleep(1000);
    }
    await sleep(4000);
    console.log('  TikTok video posted!');
  } else {
    console.log(
      '  TikTok Studio is ready on the final screen (click "Post" in Chrome).'
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.login && !opts.videoPath)) {
    printUsage();
    process.exit(opts.help ? 0 : 1);
  }

  if (opts.login) {
    console.log(`Opening persistent Chrome profile at: ${PROFILE_DIR}`);
    console.log(
      'Sign into YouTube Studio and TikTok in the two tabs, then close the browser window when done.'
    );
    const browser = await launchPersistentBrowser();
    const [ytPage] = await browser.pages();
    await ytPage.goto(YOUTUBE_STUDIO_URL);
    const ttPage = await browser.newPage();
    await ttPage.goto(TIKTOK_UPLOAD_URL);
    await new Promise((resolve) => browser.on('disconnected', resolve));
    console.log('Login session saved.');
    return;
  }

  const resolvedInput = path.resolve(opts.videoPath);
  const mp4Path = resolvedInput.replace(/\.txt$/, '.mp4');
  const txtPath = resolvedInput.replace(/\.mp4$/, '.txt');

  if (!fs.existsSync(mp4Path)) {
    throw new Error(`Video file not found: ${mp4Path}`);
  }
  if (!fs.existsSync(txtPath)) {
    throw new Error(`Companion metadata file not found: ${txtPath}`);
  }

  const meta = parseShortMetadataFile(txtPath);
  const relatedSpec = resolveRelatedVideo(opts, meta);
  const pinnedComment = resolvePinnedComment(opts, meta);
  console.log(`Loaded metadata from ${path.basename(txtPath)}:`);
  console.log(`  YouTube Title:    ${meta.youtube.title}`);
  if (opts.schedule) {
    console.log(
      `  YouTube Schedule: ${opts.schedule.dateText} at ${opts.schedule.timeText} (${opts.schedule.isoLocal})`
    );
  }
  console.log(
    `  YouTube Related:  ${relatedSpec ? relatedSpec.raw : '(none)'}`
  );
  console.log(`  YouTube Comment:  ${pinnedComment || '(none)'}`);
  console.log(`  TikTok Hook:      ${meta.tiktok.caption.split('\n')[0]}`);

  if (opts.dryRun) {
    if (pinnedComment) {
      console.log('\n--- YouTube Pinned Comment ---\n' + pinnedComment);
    }
    console.log('\n--- YouTube Description ---\n' + meta.youtube.description);
    console.log('\n--- TikTok Caption ---\n' + meta.tiktok.caption);
    return;
  }

  const browser = await launchPersistentBrowser();
  try {
    if (opts.platform === 'all' || opts.platform === 'youtube') {
      await uploadToYouTube(
        browser,
        mp4Path,
        meta.youtube,
        opts,
        relatedSpec,
        pinnedComment
      );
    }
    if (opts.platform === 'all' || opts.platform === 'tiktok') {
      if (opts.schedule) {
        console.warn(
          '  Skipping TikTok upload because --schedule is currently YouTube-only.'
        );
      } else {
        await uploadToTikTok(browser, mp4Path, meta.tiktok, opts);
      }
    }
    if (opts.publish) {
      await browser.close();
    } else {
      console.log(
        '\nReview mode active: inspect the upload tab(s) in Chrome and click Publish / Post when ready.'
      );
      await new Promise((resolve) => browser.on('disconnected', resolve));
    }
  } catch (err) {
    console.error('\nUpload script encountered an error:', err.message);
    if (!opts.publish) {
      console.error(
        'Leaving Chrome open so you can finish or inspect the page state.'
      );
      await new Promise((resolve) => browser.on('disconnected', resolve));
    } else {
      await browser.close().catch(() => {});
      process.exit(1);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main();
}
