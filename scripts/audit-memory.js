// Where the memory goes for a view: instanced-mesh buffers (shadow meshes,
// per-tile meshes, others), geometry buffers and the JS heap, in MB.
// Usage: npm run audit:memory  env: VIEWS=land,swamp PRESET=mid W=844 H=390
// QUERY=... (views in scripts/views.js; GAME_URL points at another dev server)
import {launch, openGame} from './dev-browser.js';
import {auditQuery} from './views.js';

const names = (process.env.VIEWS || 'land').split(',');
const preset = process.env.PRESET || 'mid';
const W = +(process.env.W || 844);
const H = +(process.env.H || 390);

const browser = await launch();
const out = {};
for (const name of names) {
  const page = await openGame(
    browser,
    auditQuery(name, {preset, extra: process.env.QUERY || ''}),
    {width: W, height: H, scale: 1, settleMs: 6000}
  );
  out[name] = await page.evaluate(async () => {
    const {scene} = await window.gameModule('scene.js');
    const tc = await window.gameModule('terrain-chunks.js');
    const shadowMeshes = new Set(
      [...tc.globalInstancer.types.values()]
        .map((t) => t.shadowMesh)
        .filter(Boolean)
    );
    const inst = {shadow: 0, tiles: 0, other: 0};
    const geometries = new Set();
    const arrays = new Set();
    let geoBytes = 0;
    const addArray = (arr) => {
      if (!arr || arrays.has(arr)) return;
      arrays.add(arr);
      geoBytes += arr.byteLength;
    };
    scene.traverse((o) => {
      if (o.isInstancedMesh) {
        const bytes =
          o.instanceMatrix.array.byteLength +
          (o.instanceColor ? o.instanceColor.array.byteLength : 0);
        if (shadowMeshes.has(o)) inst.shadow += bytes;
        else if (o.parent === tc.globalInstancer.group) inst.tiles += bytes;
        else inst.other += bytes;
      }
      if (o.geometry && !geometries.has(o.geometry)) {
        geometries.add(o.geometry);
        for (const a of Object.values(o.geometry.attributes)) {
          addArray(a.array || a.data?.array);
        }
        addArray(o.geometry.index?.array);
      }
    });
    const mb = (x) => Math.round(x / 1e6);
    return {
      instShadowMB: mb(inst.shadow),
      instTilesMB: mb(inst.tiles),
      instOtherMB: mb(inst.other),
      geometryMB: mb(geoBytes),
      geometries: geometries.size,
      heapMB: performance.memory ? mb(performance.memory.usedJSHeapSize) : null,
    };
  });
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
