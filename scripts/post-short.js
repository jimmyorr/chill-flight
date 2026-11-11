// CLI uploader for YouTube Shorts and TikTok Studio using a persistent Chrome
// profile (~/.chill-flight-social-profile) so you only sign in once.
//
// Usage:
//   node scripts/post-short.js --login
//   node scripts/post-short.js promo/short-20261109-match-cut.mp4 [options]
//
// Options:
//   --login                        Open Chrome to sign into YouTube & TikTok once
//   --platform=all|youtube|tiktok  Which platform(s) to upload to (default: all)
//   --visibility=public|unlisted|private  YouTube visibility (default: public)
//   --publish                      Automatically click the final Publish/Post button (default)
//   --review                       Stop on the final Publish/Post button for manual review
//   --dry-run                      Parse and print the .txt metadata without opening Chrome

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const PROFILE_DIR =
  process.env.SOCIAL_PROFILE_DIR ||
  path.join(os.homedir(), '.chill-flight-social-profile');

const YOUTUBE_STUDIO_URL = 'https://studio.youtube.com';
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/tiktokstudio/upload';

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

export function parseShortMetadataFile(txtPath) {
  const raw = fs.readFileSync(txtPath, 'utf8').replace(/\r\n/g, '\n');
  const [ytSection, ttSection = ''] = raw.split(/^===\s*TikTok\s*===$/m);

  const titleMatch = ytSection.match(
    /^Title:\n([\s\S]*?)\n\nDescription:\n([\s\S]*)$/m
  );
  if (!titleMatch) {
    throw new Error(`Could not parse Title/Description in ${txtPath}`);
  }
  const youtubeTitle = titleMatch[1].trim();
  const youtubeDescription = titleMatch[2].trim();

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
    },
    tiktok: {
      caption: tiktokCaption,
    },
  };
}

function parseArgs(argv) {
  const opts = {
    login: false,
    dryRun: false,
    publish: true,
    platform: 'youtube',
    visibility: 'public',
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
      '  --publish                      Automatically click the final Publish button (default)',
      '  --review                       Fill everything and pause on final Publish button',
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
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
}

async function setContentEditableText(page, selector, text) {
  await page.waitForSelector(selector, {visible: true, timeout: 60000});
  await page.click(selector);
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
  }, selector);
  await page.keyboard.press('Backspace');
  await sleep(150);
  // Insert text directly via execCommand so newlines and emojis stay intact
  // without triggering hashtag autocomplete popups mid-word
  await page.evaluate(
    ({sel, value}) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.focus();
      document.execCommand('insertText', false, value);
      el.dispatchEvent(new Event('input', {bubbles: true}));
    },
    {sel: selector, value: text}
  );
}

async function uploadToYouTube(browser, mp4Path, meta, opts) {
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
    await sleep(3000);
  }

  // Click "Create" -> "Upload videos" if input[type=file] isn't already on page
  let fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    const createBtnSel =
      'button[aria-label="Create"], button[aria-label="Upload videos"], #upload-icon';
    const createBtn = await page.waitForSelector(createBtnSel, {
      visible: true,
      timeout: 30000,
    });
    await createBtn.click();
    await sleep(800);

    const uploadItem = await page.$('tp-yt-paper-item#text-item-0');
    if (uploadItem) {
      await uploadItem.click();
      await sleep(800);
    }
    fileInput = await page.waitForSelector('input[type="file"]', {
      timeout: 60000,
    });
  }

  console.log(`  Selecting file: ${path.basename(mp4Path)}`);
  await fileInput.uploadFile(mp4Path);

  // Wait for Title & Description fields in the upload modal
  const titleSel =
    'ytcp-social-suggestions-textbox#title-textarea #textbox[contenteditable="true"], #title-textarea #textbox[contenteditable="true"]';
  const descSel =
    'ytcp-social-suggestions-textbox#description-textarea #textbox[contenteditable="true"], #description-textarea #textbox[contenteditable="true"]';

  console.log('  Filling YouTube Title and Description...');
  await setContentEditableText(page, titleSel, meta.title);
  await sleep(400);
  await setContentEditableText(page, descSel, meta.description);
  await sleep(400);

  // Select "No, it's not made for kids"
  const notForKidsSel =
    'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]';
  await page.waitForSelector(notForKidsSel, {timeout: 30000});
  await page.click(notForKidsSel);
  await sleep(500);

  // Click Next 3 times (Details -> Video elements -> Checks -> Visibility)
  for (let step = 0; step < 3; step++) {
    await page.waitForSelector('#next-button', {visible: true, timeout: 30000});
    await page.click('#next-button');
    await sleep(800);
  }

  // Select visibility radio button
  const visName = opts.visibility.toUpperCase(); // PUBLIC, UNLISTED, PRIVATE
  const visSel = `tp-yt-paper-radio-button[name="${visName}"]`;
  await page.waitForSelector(visSel, {visible: true, timeout: 30000});
  await page.click(visSel);
  await sleep(600);

  if (opts.publish) {
    console.log('  Clicking Publish on YouTube...');
    await page.waitForSelector('#done-button:not([disabled])', {
      visible: true,
      timeout: 120000,
    });
    await page.click('#done-button');
    await sleep(5000);
    console.log('  YouTube Short published!');
  } else {
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
  console.log(`Loaded metadata from ${path.basename(txtPath)}:`);
  console.log(`  YouTube Title: ${meta.youtube.title}`);
  console.log(`  TikTok Hook:   ${meta.tiktok.caption.split('\n')[0]}`);

  if (opts.dryRun) {
    console.log('\n--- YouTube Description ---\n' + meta.youtube.description);
    console.log('\n--- TikTok Caption ---\n' + meta.tiktok.caption);
    return;
  }

  const browser = await launchPersistentBrowser();
  try {
    if (opts.platform === 'all' || opts.platform === 'youtube') {
      await uploadToYouTube(browser, mp4Path, meta.youtube, opts);
    }
    if (opts.platform === 'all' || opts.platform === 'tiktok') {
      await uploadToTikTok(browser, mp4Path, meta.tiktok, opts);
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
    console.error(
      'Leaving Chrome open so you can finish or inspect the page state.'
    );
    await new Promise((resolve) => browser.on('disconnected', resolve));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
