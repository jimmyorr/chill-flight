// Render cost on fixed views, at pixel ratio 1.5 in a 1440x900 window (the
// mid and high presets on a MacBook Air), with the shadow map updated every
// frame like the game at full speed:
//   gpu: median GPU time per frame (timer queries), the most precise number
//   ms:  median wall time per frame, forced to finish with a 1-pixel readback
//        (an empty scene costs ~3 ms of this: clear, resolve, readback)
//   cpu: median time in renderer.render() (JavaScript and GL calls)
// Measure on a quiet machine (other GPU work skews it), and alternate runs of
// the versions you compare: results drift by ~0.5 ms over minutes.
// Usage: npm run bench [-- label]   env: VIEWS=land,sunset  PRESET=mid  QUERY=a=1&b=2
import {launch, openGame, requireGpu} from './dev-browser.js';
import {auditQuery, settleAuditView} from './views.js';

requireGpu('npm run bench');

const label = process.argv[2] || 'bench';
const DEFAULT_VIEWS = ['land', 'sunset', 'mtn', 'forest'];
const names = process.env.VIEWS ? process.env.VIEWS.split(',') : DEFAULT_VIEWS;
const preset = process.env.PRESET || 'mid';

const browser = await launch();
const results = {};
for (const name of names) {
  const page = await openGame(
    browser,
    auditQuery(name, {preset, extra: process.env.QUERY || ''}),
    {width: 1440, height: 900, scale: 2, settleMs: 2000}
  );
  await settleAuditView(page);
  results[name] = await page.evaluate(async () => {
    const {state} = await window.gameModule('state.js');
    const {scene} = await window.gameModule('scene.js');
    const {renderer, camera} = await window.gameModule('sky.js');
    const {renderFrame} = await window.gameModule('outline-pass.js');
    state.isPaused = true;
    await new Promise((r) => setTimeout(r, 300));
    renderer.setPixelRatio(1.5);
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
    const cpu = [];
    const total = [];
    for (let i = 0; i < 170; i++) {
      renderer.shadowMap.needsUpdate = true;
      const t0 = performance.now();
      renderFrame(scene, camera);
      const t1 = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const t2 = performance.now();
      if (i >= 20) {
        cpu.push(t1 - t0);
        total.push(t2 - t0);
      }
    }
    // GPU time: timer queries around frames paced by requestAnimationFrame.
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    let gpu = null;
    if (ext) {
      const queries = [];
      for (let i = 0; i < 80; i++) {
        renderer.shadowMap.needsUpdate = true;
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
        renderFrame(scene, camera);
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        if (i >= 10) queries.push(q);
        await new Promise((r) => requestAnimationFrame(r));
      }
      await new Promise((r) => setTimeout(r, 300));
      const times = queries
        .filter((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))
        .map((q) => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      if (times.length) gpu = +median(times).toFixed(2);
    }
    return {
      gpu,
      ms: +median(total).toFixed(2),
      cpu: +median(cpu).toFixed(2),
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
    };
  });
  if (page.errors.length) console.error(name, page.errors);
  await page.close();
}
console.log(label, JSON.stringify(results));
await browser.close();
