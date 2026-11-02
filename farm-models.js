// --- FARM MODELS ---
// Tractors parked out in the crop fields (tractorSpot in terrain-gen.js,
// drawn by terrain-chunks.js): Polyfork's Compact Tractor (polyfork.dev, free
// licence; source unchanged in third-party/polyfork) in three paint schemes,
// each merged into one vertex-coloured geometry at load (boat-models.js
// mergeAsset), wheels on y = 0, front toward +z, drawn bigger like the rest
// of the world.
import * as compactTractor from './third-party/polyfork/compact-tractor-35b84b.mjs';
import * as redBarn from './third-party/polyfork/red-barn-d41683.mjs';
import * as timberBarn from './third-party/polyfork/timber-barn-90b3ce.mjs';
import * as hayBarn from './third-party/polyfork/alpine-hay-barn-3965e5.mjs';
import * as grainSilo from './third-party/polyfork/grain-silo-58ca67.mjs';
import * as stoneWindmill from './third-party/polyfork/windmill-3aad49.mjs';
import * as THREE from 'three';
import {mergeAsset, POLYFORK_SCALE} from './boat-models.js';

// How much bigger than real life (a 2.8 m tractor comes out 7 units long,
// a little longer than the buggy)
export const TRACTOR_SCALE = POLYFORK_SCALE;

// Each tractor type (instanced by this name), in the order terrain-gen.js
// numbers them
const TRACTOR_SCHEMES = {
  tractorBody: 'harvest-red',
  tractor2Body: 'orchard-green',
  tractor3Body: 'meadow-blue',
};

export function buildTractorGeos() {
  const geos = {};
  for (const [type, colorway] of Object.entries(TRACTOR_SCHEMES)) {
    geos[type] = mergeAsset(
      compactTractor.createAsset({colorway}),
      0,
      TRACTOR_SCALE
    );
  }
  return geos;
}

// --- BARNS ---
// Polyfork barns in place of our old box barn, each split at its eaves into
// walls (which fold when hit) and roof (thrown off), and sized like the old
// one (about 18 x 28 units): the classic red barn in the heartland, and up
// north a timber-framed barn or an alpine hay barn (collectStructures in
// terrain-gen.js picks by a barn's style). Doors face +z and -z along the
// ridge, like the old barn's.

const BARNS = {
  // module, options, scale, eave height (m, as built)
  barn: [redBarn, {colorway: 'classic-red', depth: 9}, 3.0, 4.5],
  timberBarn: [timberBarn, {colorway: 'oak-thatch'}, 4.2, 3.3],
  hayBarn: [
    hayBarn,
    {colorway: 'weathered-larch', length: 8, snowfall: 0},
    2.8,
    2.7,
  ],
};

// {barnBody, barnRoof, timberBarnBody, ...}: each barn's walls and roof
export function buildBarnGeos() {
  const geos = {};
  for (const [name, [module, opts, scale, eave]] of Object.entries(BARNS)) {
    const asset = module.createAsset(opts);
    geos[name + 'Body'] = mergeAsset(
      asset,
      0,
      scale,
      0,
      (y) => y < eave - 0.01
    );
    geos[name + 'Roof'] = mergeAsset(
      asset,
      0,
      scale,
      0,
      (y) => y >= eave - 0.01
    );
  }
  return geos;
}

// The silo beside each red barn: Polyfork's Grain Silo, galvanised with a
// sage cap, about 8 units across and 26 tall, split at its eave into drum
// and cap (they topple together)
const SILO_SCALE = POLYFORK_SCALE;
const SILO_EAVE = 8;
export function buildSiloGeos() {
  const asset = grainSilo.createAsset({
    colorway: 'galvanised-sage',
    bodyHeight: SILO_EAVE,
  });
  return {
    body: mergeAsset(asset, 0, SILO_SCALE, 0, (y) => y < SILO_EAVE - 0.01),
    roof: mergeAsset(asset, 0, SILO_SCALE, 0, (y) => y >= SILO_EAVE - 0.01),
  };
}

// The farm windmills: Polyfork's Windmill, cream stone with a timber cap,
// about 45 units tall and 26 across at the foot like our old one. Built for
// terrain-gen.js's instance scale (1.5): the tower, and its sails about
// their hub (turning about z in windmillBladesMat's shader). The hub's
// place on the tower, after scaling, is WINDMILL_HUB in terrain-gen.js.
const WINDMILL_SCALE = 4.7;
const WINDMILL_INSTANCE_SCALE = 1.5;
export function buildWindmillGeos() {
  const asset = stoneWindmill.createAsset({
    colorway: 'cream-stone',
    sailSpan: 1.15,
  });
  asset.updateMatrixWorld(true);
  const sails = asset.getObjectByName('sails');
  const hub = new THREE.Vector3().setFromMatrixPosition(sails.matrixWorld);
  const inSails = (o) => {
    for (let p = o; p; p = p.parent) if (p === sails) return true;
    return false;
  };
  const tower = [];
  const blades = [];
  asset.traverse((o) => {
    if (o.isMesh) (inSails(o) ? blades : tower).push(o);
  });
  const k = WINDMILL_SCALE / WINDMILL_INSTANCE_SCALE;
  const merge = (meshes, origin) => {
    const pos = [];
    const col = [];
    const v = new THREE.Vector3();
    for (const o of meshes) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const p = g.attributes.position;
      const c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).sub(origin);
        pos.push(v.x * k, v.y * k, v.z * k);
        if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
        else col.push(1, 1, 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  };
  return {
    base: merge(tower, new THREE.Vector3()),
    blades: merge(blades, hub),
    // Where the hub is, at the game's scale (units)
    hub: hub.multiplyScalar(WINDMILL_SCALE),
  };
}
