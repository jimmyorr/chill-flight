#!/usr/bin/env node
/**
 * scripts/test-storage-polyfill.js
 *
 * Verifies the safe in-memory storage polyfill used when localStorage or
 * sessionStorage is blocked (e.g. sandboxed or cross-origin iframes).
 */

import {createMemoryStorage, installStorageShim} from '../storage-polyfill.js';

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

// 2. Headless / SSR environment test (window is undefined)
{
  const result = installStorageShim('localStorage');
  assert(
    'installStorageShim handles undefined window gracefully',
    result.native === false && result.shimmed === false
  );
}

// 3. Mock environment tests (simulating SecurityError)
{
  const mockWindow = {};
  const throwSecurityError = () => {
    const err = new Error(
      "Failed to read the 'localStorage' property from 'Window': Access is denied for this document."
    );
    err.name = 'SecurityError';
    throw err;
  };

  Object.defineProperty(mockWindow, 'localStorage', {
    get: throwSecurityError,
    configurable: true,
  });
  Object.defineProperty(mockWindow, 'sessionStorage', {
    get: throwSecurityError,
    configurable: true,
  });

  // Temporarily mount mockWindow on global
  const origWindow = global.window;
  global.window = mockWindow;

  const localRes = installStorageShim('localStorage');
  assert(
    'installStorageShim detects blocked localStorage and shims',
    localRes.shimmed === true && localRes.native === false
  );

  const sessionRes = installStorageShim('sessionStorage');
  assert(
    'installStorageShim detects blocked sessionStorage and shims',
    sessionRes.shimmed === true && sessionRes.native === false
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

    mockWindow.sessionStorage.setItem('chill_flight_session', 'active');
    assert(
      'mocked window.sessionStorage.getItem works',
      mockWindow.sessionStorage.getItem('chill_flight_session') === 'active'
    );
  } catch (err) {
    threw = true;
    console.error('Unexpected throw during mock storage operations:', err);
  }
  assert('no SecurityError thrown during storage operations', !threw);

  // 4. Healthy storage environment test
  const healthyStorage = createMemoryStorage();
  mockWindow.localStorage = healthyStorage;
  const healthyRes = installStorageShim('localStorage');
  assert(
    'installStorageShim recognizes healthy working storage',
    healthyRes.native === true && healthyRes.shimmed === false
  );

  // Restore global
  global.window = origWindow;
}

if (failed) {
  process.exit(1);
}
