// Triangles per instanced prop type: the close-up model (near), the usual
// one (base), the far one and the shadow proxy (null where a type has none),
// biggest first, from the model viewer page, so a new model's budget can be
// checked before it's placed in the world.
// Usage: npm run audit:models  env: TYPES=pine,barn (names containing these)
// (GAME_URL points at another dev server)
import {BASE, launch} from './dev-browser.js';

const browser = await launch();
const page = await browser.newPage();
await page.goto(new URL('debug/debug-models.html', BASE).href, {
  waitUntil: 'load',
  timeout: 120000,
});
const out = await page.evaluate(async () => {
  const tc = await import('/terrain-chunks.js');
  const tris = (g) =>
    g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : null;
  const rows = {};
  for (const [type, info] of tc.globalInstancer.types) {
    rows[type] = {
      near: tris(info.nearGeo),
      base: tris(info.geo),
      far: tris(info.farGeo),
      shadow: tris(info.shadowMesh?.geometry),
    };
  }
  return rows;
});
const only = process.env.TYPES ? process.env.TYPES.split(',') : null;
const rows = Object.entries(out)
  .filter(([type]) => !only || only.some((t) => type.includes(t)))
  .sort(
    (a, b) => (b[1].near ?? b[1].base ?? 0) - (a[1].near ?? a[1].base ?? 0)
  );
console.table(Object.fromEntries(rows));
await browser.close();
