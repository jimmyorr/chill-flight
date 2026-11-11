// What one globalInstancer.rebuildAll() costs (it runs after every chunk load
// or unload), the render right after it and a plain render, as medians of 12,
// plus how many instanced meshes and instances it uploads.
// Usage: npm run audit:rebuild  env: VIEWS=land PRESET=mid W=844 H=390
// QUERY=... (views in scripts/views.js; GAME_URL points at another dev server)
// CPU timings only: SwiftShader's render times are not a phone's.
import {launch, openGame} from './dev-browser.js';
import {auditQuery, settleAuditView} from './views.js';

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
    {width: W, height: H, scale: 1, settleMs: 2000}
  );
  await settleAuditView(page);
  out[name] = await page.evaluate(async () => {
    const {state} = await window.gameModule('state.js');
    const {scene} = await window.gameModule('scene.js');
    const {renderer, camera} = await window.gameModule('sky.js');
    const {renderFrame} = await window.gameModule('outline-pass.js');
    const tc = await window.gameModule('terrain-chunks.js');
    const tg = await window.gameModule('terrain-geometry.js');
    state.isPaused = true;
    await new Promise((r) => setTimeout(r, 300));
    const gi = tc.globalInstancer;
    const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    // readPixels waits for the GPU, so the time covers the whole render
    const timedRender = () => {
      const t0 = performance.now();
      renderFrame(scene, camera);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return performance.now() - t0;
    };
    const rebuild = [];
    const afterRebuild = [];
    const plain = [];
    for (let i = 0; i < 12; i++) {
      gi._dirty = true;
      const t0 = performance.now();
      gi.rebuildAll();
      rebuild.push(performance.now() - t0);
      afterRebuild.push(timedRender());
      plain.push(timedRender());
    }
    let meshes = 0;
    let instances = 0;
    for (const [, info] of gi.types) {
      for (const [, m] of info.tiles) {
        meshes++;
        instances += m.count;
      }
      if (info.shadowMesh && info.shadowMesh.count) {
        meshes++;
        instances += info.shadowMesh.count;
      }
    }
    let chunks = 0;
    let typesPerChunk = 0;
    tg.chunks.forEach((c) => {
      const d = c.userData.instanceData;
      if (!d) return;
      chunks++;
      typesPerChunk += Object.keys(d).length;
    });
    const round = (x, d = 1) => Number(x.toFixed(d));
    return {
      rebuildMs: round(median(rebuild)),
      renderAfterRebuildMs: round(median(afterRebuild)),
      renderMs: round(median(plain)),
      meshes,
      instances,
      uploadMB: round((instances * 64) / 1e6),
      chunks: tg.chunks.size,
      avgTypesPerChunk: chunks ? round(typesPerChunk / chunks) : 0,
    };
  });
  await page.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
