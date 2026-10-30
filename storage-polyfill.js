/**
 * storage-polyfill.js
 *
 * Safe in-memory fallback for web storage (localStorage and sessionStorage).
 *
 * When the game is embedded in cross-origin iframes with restricted storage,
 * opaque parent origins, or privacy-hardened browsers with strict cookie
 * policies, evaluating `window.localStorage` throws a DOMException `SecurityError`.
 *
 * This polyfill tests storage access on startup; if reading or writing fails,
 * it transparently replaces window.localStorage / window.sessionStorage with
 * an in-memory Storage implementation so game code does not crash.
 */

export function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, val) => {
      store.set(String(key), String(val));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

export function installStorageShim(storageName = 'localStorage') {
  if (typeof window === 'undefined') return {native: false, shimmed: false};
  try {
    const testKey = '__storage_test__';
    const storage = window[storageName];
    if (!storage) throw new Error('Missing storage');
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return {native: true, shimmed: false};
  } catch {
    try {
      const shim = createMemoryStorage();
      Object.defineProperty(window, storageName, {
        value: shim,
        configurable: true,
        writable: true,
      });
      return {native: false, shimmed: true};
    } catch {
      return {native: false, shimmed: false};
    }
  }
}

// Auto-install on module load
installStorageShim('localStorage');
installStorageShim('sessionStorage');
