#!/usr/bin/env node
/**
 * scripts/test-storage-polyfill.js
 *
 * Verifies the safe in-memory storage polyfill used when localStorage or
 * sessionStorage is blocked (e.g. sandboxed or cross-origin iframes).
 */

import {createMemoryStorage, installStorageShim} from '../storage-polyfill.js';
import {launch} from './dev-browser.js';

console.log('Testing storage polyfill...');

let failed = false;
function assert(name, condition, message = '') {
  if (condition) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.error(`FAIL: ${name}: ${message}`);
  }
}

// 1. In-memory storage interface test
const mem = createMemoryStorage();
assert('getItem returns null for unset key', mem.getItem('foo') === null);
assert('length starts at 0', mem.length === 0);

mem.setItem('foo', 'bar');
assert('getItem returns stored string', mem.getItem('foo') === 'bar');
assert('length is 1 after setItem', mem.length === 1);

mem.setItem('num', 42);
assert('setItem coerces values to strings', mem.getItem('num') === '42');
assert('length is 2', mem.length === 2);

assert('key(0) returns first key', mem.key(0) === 'foo');
assert('key(1) returns second key', mem.key(1) === 'num');
assert('key(2) returns null for out of bounds', mem.key(2) === null);

mem.removeItem('foo');
assert('removeItem removes key', mem.getItem('foo') === null);
assert('length decreases to 1 after removeItem', mem.length === 1);

mem.clear();
assert(
  'clear empties storage',
  mem.getItem('num') === null && mem.length === 0
);

// 2. Mock environment tests (simulating SecurityError)
{
  const mockWindow = {};
  Object.defineProperty(mockWindow, 'localStorage', {
    get() {
      const err = new Error(
        "Failed to read the 'localStorage' property from 'Window': Access is denied for this document."
      );
      err.name = 'SecurityError';
      throw err;
    },
    configurable: true,
  });

  // Temporarily mount mockWindow on global
  const origWindow = global.window;
  global.window = mockWindow;

  const result = installStorageShim('localStorage');
  assert(
    'installStorageShim detects blocked storage and shims',
    result.shimmed === true && result.native === false
  );

  // Operations that would previously throw SecurityError now work safely
  let threw = false;
  try {
    mockWindow.localStorage.setItem('chill_flight_plane', 'jet');
    assert(
      'mocked window.localStorage.getItem works',
      mockWindow.localStorage.getItem('chill_flight_plane') === 'jet'
    );
    assert(
      'mocked window.localStorage.length is 1',
      mockWindow.localStorage.length === 1
    );
    mockWindow.localStorage.removeItem('chill_flight_plane');
    assert(
      'mocked window.localStorage.getItem returns null after removal',
      mockWindow.localStorage.getItem('chill_flight_plane') === null
    );
  } catch (err) {
    threw = true;
    console.error('Unexpected throw during mock storage operations:', err);
  }
  assert('no SecurityError thrown during storage operations', !threw);

  // Restore global
  global.window = origWindow;
}

// 3. Browser runtime test against dev server
const browser = await launch();
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/?start=1&music=0', {
    waitUntil: 'domcontentloaded',
  });

  const liveResult = await page.evaluate(() => {
    localStorage.setItem('chill_flight_smoke_key', 'ok');
    const val = localStorage.getItem('chill_flight_smoke_key');
    localStorage.removeItem('chill_flight_smoke_key');
    return val === 'ok';
  });
  assert(
    'Live browser session evaluates localStorage successfully',
    liveResult
  );
} finally {
  await browser.close();
}

if (failed) {
  process.exit(1);
}
