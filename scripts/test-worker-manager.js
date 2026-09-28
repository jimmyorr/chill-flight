#!/usr/bin/env node
/**
 * scripts/test-worker-manager.js
 *
 * Checks that the terrain worker pool never leaves a chunk request hanging:
 * dead or erroring workers get their jobs rejected (so the game can build the
 * chunk itself) and are replaced, and a pool where no worker ever answers
 * gives up on workers entirely.
 */

// Keep the manager's expected warnings out of the test output (including the
// one its shared instance prints on import, since Node has no workers).
console.warn = () => {};
console.error = () => {};
const {TerrainWorkerManager} = await import('../terrain-worker-manager.js');

console.log('Testing terrain worker manager...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

// A fake worker: 'ok' answers each job, 'dead' never answers, 'error' fires
// onerror when it gets a job. Workers past the listed ones (replacements)
// behave like `rest`.
function makeFactory(behaviors, rest = 'ok') {
  const made = [];
  const factory = () => {
    const behavior = behaviors[made.length] || rest;
    const worker = {
      behavior,
      terminated: false,
      jobs: 0,
      postMessage(payload) {
        this.jobs++;
        if (behavior === 'ok') {
          setTimeout(() =>
            this.onmessage({data: {id: payload.id, status: 'success'}})
          );
        } else if (behavior === 'error') {
          setTimeout(() => this.onerror({message: 'boom'}));
        }
      },
      terminate() {
        this.terminated = true;
      },
    };
    made.push(worker);
    return worker;
  };
  return {factory, made};
}

const settle = (promise) =>
  promise.then(
    () => 'resolved',
    (err) => `rejected: ${err.message}`
  );

// 1. Healthy pool: every request resolves.
{
  const {factory} = makeFactory(['ok', 'ok']);
  const m = new TerrainWorkerManager(2, {
    createWorker: factory,
    jobTimeoutMs: 50,
  });
  const results = await Promise.all(
    [0, 1, 2, 3, 4].map((i) => settle(m.requestChunk(i, 0)))
  );
  check(
    'healthy workers resolve every request',
    results.every((r) => r === 'resolved'),
    JSON.stringify(results)
  );
}

// 2. One dead worker: its job times out and is rejected, the worker is
// replaced, and later requests still resolve.
{
  const {factory, made} = makeFactory(['dead', 'ok']);
  const m = new TerrainWorkerManager(2, {
    createWorker: factory,
    jobTimeoutMs: 50,
  });
  const first = await Promise.all([
    settle(m.requestChunk(0, 0)),
    settle(m.requestChunk(1, 0)),
  ]);
  check(
    'a dead worker’s job is rejected instead of hanging',
    first.filter((r) => r.startsWith('rejected')).length === 1,
    JSON.stringify(first)
  );
  check(
    'the dead worker is terminated and replaced',
    made[0].terminated && m.workers.length === 2 && m.isSupported
  );
  const later = await Promise.all(
    [2, 3, 4].map((i) => settle(m.requestChunk(i, 0)))
  );
  check(
    'requests after a replacement resolve',
    later.every((r) => r === 'resolved'),
    JSON.stringify(later)
  );
  check(
    'no worker is listed idle twice',
    new Set(m.idleWorkers).size === m.idleWorkers.length
  );
}

// 3. A worker error rejects that worker's job.
{
  const {factory} = makeFactory(['error']);
  const m = new TerrainWorkerManager(1, {
    createWorker: factory,
    jobTimeoutMs: 1000,
  });
  const r = await settle(m.requestChunk(0, 0));
  check('a worker error rejects its job', r.startsWith('rejected'), r);
}

// 4. No worker ever answers: give up on workers so the game falls back.
{
  const {factory} = makeFactory(['dead', 'dead'], 'dead');
  const m = new TerrainWorkerManager(2, {
    createWorker: factory,
    jobTimeoutMs: 50,
  });
  const results = await Promise.all(
    [0, 1, 2].map((i) => settle(m.requestChunk(i, 0)))
  );
  check(
    'a pool that never answers disables workers',
    !m.isSupported && results.every((r) => r.startsWith('rejected')),
    JSON.stringify(results)
  );
  check(
    'requests after disabling are rejected immediately',
    (await settle(m.requestChunk(9, 9))).startsWith('rejected')
  );
}

if (failed) process.exit(1);
console.log('All terrain worker manager tests passed.');
