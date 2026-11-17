// Array/String/TypedArray .at() (iOS 15.4+). The app supports iOS 15.0, where
// a missing .at() would throw while the world loads and the game never starts.
// Imported first by src/main.js and the workers.
function at(n) {
  n = Math.trunc(n) || 0;
  if (n < 0) n += this.length;
  if (n < 0 || n >= this.length) return undefined;
  return this[n];
}

const TypedArray = Object.getPrototypeOf(Int8Array);
for (const C of [Array, String, TypedArray]) {
  if (!C.prototype.at) {
    Object.defineProperty(C.prototype, 'at', {
      value: at,
      writable: true,
      configurable: true,
    });
  }
}
