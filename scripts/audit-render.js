// Per-category triangles and draw calls, main pass vs shadow pass.
// Usage: node scripts/audit-render.js  env: PRESET=mid VIEWS=a,b W=844 H=390
import {launch, openGame} from './dev-browser.js';

const VIEWS = {
  land: 'x=0&y=413&z=0&heading=45&pitch=-4&tod=0.614&clouds=0.2',
  landHigh: 'x=0&y=2500&z=0&heading=45&pitch=-15&tod=0.614&clouds=0.2',
  forest: 'x=-3000&y=330&z=-6000&heading=160&pitch=-8&tod=0.45&clouds=0.3',
  forestHigh:
    'x=-3000&y=2500&z=-6000&heading=160&pitch=-15&tod=0.45&clouds=0.3',
  mtn: 'x=-2000&y=600&z=-2500&heading=20&pitch=-3&tod=0.5&clouds=0.3',
  sunset: 'x=30000&y=420&z=3000&heading=-90&pitch=-3&tod=0.735&clouds=0.45',
  swamp: 'x=-9000&y=250&z=8000&heading=0&pitch=-6&tod=0.5&clouds=0.2',
  swampLow: 'x=-9000&y=60&z=8000&heading=90&pitch=-3&tod=0.5&clouds=0.2',
  down: 'x=-3000&y=1200&z=-6000&heading=160&pitch=-89&tod=0.45&clouds=0.3',
};
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
    `freecam=true&seed=20260928&timeSpeed=0&weather=none&preset=${preset}&${VIEWS[name]}${process.env.QUERY ? '&' + process.env.QUERY : ''}`,
    {width: W, height: H, scale: 1, settleMs: 6000}
  );
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
