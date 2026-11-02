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
import {mergeAsset} from './boat-models.js';

// How much bigger than real life (a 2.8 m tractor comes out 7 units long,
// a little longer than the buggy)
export const TRACTOR_SCALE = 2.5;

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
