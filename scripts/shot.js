// Screenshots of the game from the dev server, for checking visual changes.
// Usage:
//   node scripts/shot.js out.jpg "x=0&y=413&z=0&heading=45&tod=0.61"
//   node scripts/shot.js out.jpg "<query>" "<query 2>" ...  (out-1.jpg, ...)
// Queries take the game's URL parameters (see README). freecam=true is added
// so the camera stays where x/y/z/heading/pitch put it; timeSpeed=0 freezes
// the time of day. Options (env): SIZE=1600x900, SCALE=1, SETTLE_MS=4000.
import {launch, openGame} from './dev-browser.js';

const [out, ...queries] = process.argv.slice(2);
if (!out || queries.length === 0) {
  console.error('Usage: node scripts/shot.js out.jpg "<query>" [...]');
  process.exit(1);
}
const [width, height] = (process.env.SIZE || '1600x900').split('x').map(Number);
const scale = Number(process.env.SCALE || 1);
const settleMs = Number(process.env.SETTLE_MS || 4000);

const browser = await launch();
let failed = false;
for (const [i, query] of queries.entries()) {
  const q = new URLSearchParams(query);
  if (!q.has('freecam')) q.set('freecam', 'true');
  if (!q.has('timeSpeed')) q.set('timeSpeed', '0');
  const page = await openGame(browser, q.toString(), {
    width,
    height,
    scale,
    settleMs,
  });
  const file =
    queries.length === 1 ? out : out.replace(/(\.\w+)$/, `-${i + 1}$1`);
  await page.screenshot({
    path: file,
    ...(file.endsWith('.jpg') ? {type: 'jpeg', quality: 85} : {}),
  });
  console.log(file);
  if (page.errors.length) {
    failed = true;
    console.error(`  errors:\n  ${page.errors.join('\n  ')}`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
