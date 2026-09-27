// --- NETWORK HELPERS ---
// fetch() and native downloads have no timeout by default. On a "connected"
// network that drops every packet (subway, captive portal), navigator.onLine
// is still true and a request can hang for minutes, so every network call
// should go through one of these and treat "too slow" the same as "offline".

export class TimeoutError extends Error {
  constructor(label, ms) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

// Rejects with TimeoutError if `promise` hasn't settled within `ms`. Use for
// calls that can't be aborted (e.g. native plugin downloads); the underlying
// work may still finish in the background.
export function withTimeout(promise, ms, label = 'Operation') {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// fetch() with a deadline of `ms` for the whole request, including reading
// the body: the timer keeps running after the headers arrive, so a body that
// stalls mid-download is aborted too (aborting after it's done is a no-op).
export async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) throw new TimeoutError(`fetch ${url}`, ms);
    throw err;
  }
}
