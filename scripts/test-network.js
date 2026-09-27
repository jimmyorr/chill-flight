#!/usr/bin/env node
/**
 * scripts/test-network.js
 *
 * Checks the timeout helpers in network.js against a local server that
 * behaves like a packet-dropping network: one route never answers, another
 * sends headers and then stalls mid-body.
 */

import http from 'http';
import {TimeoutError, fetchWithTimeout, withTimeout} from '../network.js';

console.log('Testing network timeout helpers...');

const server = http.createServer((req, res) => {
  if (req.url === '/ok') {
    res.end('hello');
  } else if (req.url === '/stall-body') {
    res.writeHead(200, {'Content-Length': '1000'});
    res.write('partial'); // ...and never finish
  }
  // '/hang': never respond at all
});
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${server.address().port}`;

let failed = false;
async function expect(name, fn) {
  const start = Date.now();
  try {
    await fn();
    console.log(`  Passed: ${name} (${Date.now() - start}ms)`);
  } catch (err) {
    failed = true;
    console.error(`FAIL: ${name}: ${err.message}`);
  }
}
async function expectTimeout(promise, maxMs) {
  const start = Date.now();
  try {
    await promise;
  } catch (err) {
    const elapsed = Date.now() - start;
    if (elapsed > maxMs) throw new Error(`took ${elapsed}ms`, {cause: err});
    return err;
  }
  throw new Error('expected a timeout');
}

await expect('fetchWithTimeout returns a normal response', async () => {
  const res = await fetchWithTimeout(`${base}/ok`, {}, 1000);
  if ((await res.text()) !== 'hello') throw new Error('wrong body');
});

await expect('fetchWithTimeout times out when nothing answers', async () => {
  const err = await expectTimeout(
    fetchWithTimeout(`${base}/hang`, {}, 300),
    1500
  );
  if (!(err instanceof TimeoutError)) throw new Error(`got ${err.name}`);
});

await expect(
  'fetchWithTimeout times out while reading a stalled body',
  async () => {
    const res = await fetchWithTimeout(`${base}/stall-body`, {}, 300);
    await expectTimeout(res.arrayBuffer(), 1500);
  }
);

await expect('withTimeout rejects a promise that never settles', async () => {
  const err = await expectTimeout(
    withTimeout(new Promise(() => {}), 300, 'Download'),
    1500
  );
  if (!(err instanceof TimeoutError)) throw new Error(`got ${err.name}`);
});

await expect('withTimeout passes through a fast result', async () => {
  if ((await withTimeout(Promise.resolve(42), 300)) !== 42) {
    throw new Error('wrong value');
  }
});

server.closeAllConnections();
server.close();
if (failed) process.exit(1);
console.log('All network helper tests passed.');
