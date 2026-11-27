#!/usr/bin/env node
/**
 * scripts/test-html-scripts.js
 *
 * Scans HTML files in the project to verify that all local <script src="...">
 * references point to files that actually exist on disk.
 */

import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import vm from 'node:vm';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');

// Find all HTML files to check (exclude docs/, node_modules/, etc.)
const ignoredDirs = new Set([
  'docs',
  'node_modules',
  'dist',
  '.git',
  'ios',
  'android',
  'src-tauri',
]);

function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
        results = results.concat(findHtmlFiles(path.join(dir, entry.name)));
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

const htmlFiles = findHtmlFiles(rootDir);
let hasError = false;
let totalChecked = 0;

console.log('Testing HTML script references...');

for (const htmlFile of htmlFiles) {
  const content = fs.readFileSync(htmlFile, 'utf8');
  const relativeHtmlPath = path.relative(rootDir, htmlFile);
  const htmlDir = path.dirname(htmlFile);

  // Match all <script ... src="..." ...> tags
  const scriptRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = scriptRegex.exec(content)) !== null) {
    const src = match[1].trim();

    // Skip external URLs and Vite dev /src/ paths
    if (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('//')
    ) {
      continue;
    }
    if (src.startsWith('/src/')) {
      // Check Vite module in project root
      const resolvedVitePath = path.join(rootDir, src);
      totalChecked++;
      if (!fs.existsSync(resolvedVitePath)) {
        console.error(
          `  FAIL: [${relativeHtmlPath}] Module path "${src}" not found on disk at "${resolvedVitePath}"`
        );
        hasError = true;
      }
      continue;
    }

    // Resolve relative to the HTML file directory, or rootDir if leading slash
    const resolvedPath = src.startsWith('/')
      ? path.join(rootDir, src)
      : path.join(htmlDir, src);

    totalChecked++;

    if (!fs.existsSync(resolvedPath)) {
      console.error(
        `  FAIL: [${relativeHtmlPath}] Script "${src}" does not exist on disk (looked at "${path.relative(rootDir, resolvedPath)}")`
      );
      hasError = true;
    }
  }
}

// Verify the splash loading watchdog inline script in index.html
{
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
  const watchdogMatch = [
    ...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g),
  ].find((m) => m[1].includes('splash-stuck-btn'));
  assert(watchdogMatch, 'Could not find splash-stuck watchdog in index.html');
  const watchdogCode = watchdogMatch[1];

  const runWatchdog = ({
    href = 'https://chillflight.app/',
    storage = {},
    storageThrows = false,
  } = {}) => {
    const store = new Map(Object.entries(storage));
    let intervalCb = null;
    let intervalMs = 0;
    let cleared = false;
    let reloaded = false;
    let replacedUrl = null;
    let clickCb = null;
    const elements = {
      'loading-overlay': {style: {display: 'flex'}},
      'splash-progress-container': {
        classList: {contains: (cls) => cls === 'visible'},
      },
      'splash-stuck': {hidden: true},
      'splash-stuck-btn': {
        addEventListener: (ev, cb) => {
          if (ev === 'click') clickCb = cb;
        },
      },
    };
    const parsedUrl = new URL(href);
    const context = vm.createContext({
      URL,
      URLSearchParams,
      location: {
        href: parsedUrl.href,
        search: parsedUrl.search,
        reload: () => {
          reloaded = true;
        },
        replace: (u) => {
          replacedUrl = u;
        },
      },
      localStorage: {
        getItem: (k) => {
          if (storageThrows) throw new Error('blocked');
          return store.has(k) ? store.get(k) : null;
        },
        setItem: (k, v) => {
          if (storageThrows) throw new Error('blocked');
          store.set(k, String(v));
        },
      },
      document: {
        visibilityState: 'visible',
        getElementById: (id) => elements[id] ?? null,
      },
      setInterval: (cb, ms) => {
        intervalCb = cb;
        intervalMs = ms;
        return 1;
      },
      clearInterval: () => {
        cleared = true;
      },
    });
    vm.runInContext(watchdogCode, context);
    assert.equal(intervalMs, 1000);
    return {
      tick: (seconds) => {
        for (let i = 0; i < seconds && !cleared; i++) intervalCb();
      },
      stuck: elements['splash-stuck'],
      clickRetry: () => clickCb?.(),
      store,
      didReload: () => reloaded,
      getReplacedUrl: () => replacedUrl,
    };
  };

  // Shows only after 40s when not on low graphics, and reloads cleanly
  const mid = runWatchdog({storage: {chill_flight_graphics_preset: 'mid'}});
  mid.tick(39);
  assert.equal(mid.stuck.hidden, true, 'Watchdog should stay hidden at 39s');
  mid.tick(1);
  assert.equal(mid.stuck.hidden, false, 'Watchdog should appear at 40s');
  mid.clickRetry();
  assert.equal(mid.store.get('chill_flight_graphics_preset'), 'low');
  assert.equal(mid.store.get('chill_flight_graphics_preset_manual'), '1');
  assert.equal(mid.didReload(), true);
  assert.equal(mid.getReplacedUrl(), null);

  // Stays hidden at 40s when already on low graphics (storage, URL, legacy quality)
  for (const opts of [
    {storage: {chill_flight_graphics_preset: 'low'}},
    {href: 'https://chillflight.app/?preset=low'},
    {
      href: 'https://chillflight.app/?graphics=LOW',
      storage: {chill_flight_graphics_preset: 'high'},
    },
    {storage: {chill_flight_quality: '20'}},
  ]) {
    const low = runWatchdog(opts);
    low.tick(45);
    assert.equal(low.stuck.hidden, true, 'Watchdog should skip low graphics');
  }

  // Explicit high URL preset overrides low storage, and retry rewrites URL to preset=low
  const urlHigh = runWatchdog({
    href: 'https://chillflight.app/?graphics=high&seed=20260928',
    storage: {chill_flight_graphics_preset: 'low'},
  });
  urlHigh.tick(40);
  assert.equal(urlHigh.stuck.hidden, false);
  urlHigh.clickRetry();
  assert.equal(
    urlHigh.getReplacedUrl(),
    'https://chillflight.app/?seed=20260928&preset=low'
  );
}

if (hasError) {
  console.error(
    '\n❌ HTML script validation failed. Fix missing script references above.\n'
  );
  process.exit(1);
} else {
  console.log(
    `  Passed: Verified ${totalChecked} script references across ${htmlFiles.length} HTML files and loading watchdog.`
  );
  process.exit(0);
}
