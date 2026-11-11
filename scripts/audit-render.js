// Per-category triangles and draw calls, main pass vs shadow pass.
// Usage: npm run audit:render  env: PRESET=mid VIEWS=a,b W=844 H=390 QUERY=...
// (views in scripts/views.js; GAME_URL points at another dev server)
import {launch, openGame} from './dev-browser.js';
import {VIEWS, auditQuery, settleAuditView} from './views.js';

const names = process.env.VIEWS
  ? process.env.VIEWS.split(',')
  : Object.keys(VIEWS);
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
    const {renderer, camera, dirLight} = await window.gameModule('sky.js');
    const {renderFrame} = await window.gameModule('outline-pass.js');
    const tc = await window.gameModule('terrain-chunks.js');
    const tg = await window.gameModule('terrain-geometry.js');
    state.isPaused = true;
    await new Promise((r) => setTimeout(r, 300));

    // Label instancer meshes
    const label = new Map();
    for (const [type, info] of tc.globalInstancer.types) {
      if (info.shadowMesh)
        label.set(info.shadowMesh, ['inst-shadowOnly', type]);
      for (const [key, m] of info.tiles)
        label.set(m, [key.endsWith('|far') ? 'inst-far' : 'inst-near', type]);
    }
    const chunkSet = new Set(tg.chunks.values());
    const classify = (obj) => {
      if (label.has(obj)) return label.get(obj);
      let o = obj;
      let inObjects = false;
      while (o) {
        if (o.isLOD && o.parent && chunkSet.has(o.parent)) inObjects = true;
        if (chunkSet.has(o)) {
          if (inObjects)
            return [
              'chunk-props',
              obj.material?.name || obj.geometry?.type || '',
            ];
          if (obj.material === tg.terrainMaterial) return ['terrain-near', ''];
          if (obj.material === tg.waterMaterial) return ['water-near', ''];
          const _d = Math.hypot(
            o.userData.chunkX * 1500 - camera.position.x,
            o.userData.chunkZ * 1500 - camera.position.z
          );
          return [
            'chunk-other',
            (_d > 4000 ? 'FAR ' : 'near ') +
              (obj.parent?.name || '') +
              (obj.isInstancedMesh ? 'I:' : 'M:') +
              (obj.name || obj.geometry?.type || '') +
              ':' +
              (obj.material?.type || '') +
              ':' +
              (o.children.indexOf(obj) >= 0
                ? 'direct'
                : obj.parent?.name || obj.parent?.type),
          ];
        }
        if (o.parent === scene) {
          if (o.isLOD && o.name) return ['airport', o.name];
          return ['top:' + (o.name || o.type), obj.name || ''];
        }
        o = o.parent;
      }
      return ['detached', ''];
    };

    const orig = renderer.renderBufferDirect.bind(renderer);
    let acc = null;
    renderer.renderBufferDirect = function (cam, sc, geo, mat, obj, group) {
      const t0 = renderer.info.render.triangles;
      orig(cam, sc, geo, mat, obj, group);
      if (!acc) return;
      const tris = renderer.info.render.triangles - t0;
      const pass = cam === dirLight.shadow.camera ? 'shadow' : 'main';
      const [cat, sub] = classify(obj);
      const k = pass + '|' + cat;
      acc.cats[k] ??= {calls: 0, tris: 0};
      acc.cats[k].calls++;
      acc.cats[k].tris += tris;
      if (
        cat.startsWith('inst') ||
        cat.startsWith('chunk') ||
        cat === 'airport' ||
        cat.startsWith('top')
      ) {
        const k2 = pass + '|' + cat + '|' + sub;
        acc.subs[k2] ??= {calls: 0, tris: 0};
        acc.subs[k2].calls++;
        acc.subs[k2].tris += tris;
      }
    };
    renderer.info.autoReset = false;
    renderer.info.reset();
    acc = {cats: {}, subs: {}};
    renderer.shadowMap.needsUpdate = true;
    renderFrame(scene, camera);
    const res = acc;
    acc = null;
    renderer.renderBufferDirect = orig;
    renderer.info.autoReset = true;
    const tot = {main: {calls: 0, tris: 0}, shadow: {calls: 0, tris: 0}};
    for (const [k, v] of Object.entries(res.cats)) {
      const p = k.split('|')[0];
      tot[p].calls += v.calls;
      tot[p].tris += v.tris;
    }
    // Prop-chunk counts
    let lodVisible = 0;
    let lodTotal = 0;
    tg.chunks.forEach((c) => {
      const l = c.userData.objectsGroup;
      if (l) {
        lodTotal++;
        if (l.levels[0].object.visible) lodVisible++;
      }
    });
    return {
      chunks: tg.chunks.size,
      lodVisible,
      lodTotal,
      renderDist: state.RENDER_DISTANCE,
      propLod: state.PROP_LOD_DISTANCE,
      tot,
      cats: res.cats,
      subs: res.subs,
    };
  });
  if (page.errors.length) console.error(name, page.errors.slice(0, 3));
  await page.close();
  console.error('done', name);
}
console.log(JSON.stringify(out));
await browser.close();
