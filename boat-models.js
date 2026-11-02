// --- SMALL BOATS ---
// Rowboats on lakes and ponds, flat river boats on the rivers, fishing boats
// close inshore (the colourful Hanga Roa kind in the south) and the odd
// sunken one on the shallow sea floor (placed by smallBoatAt in
// terrain-gen.js, drawn by terrain-chunks.js). Polyfork models (polyfork.dev,
// free licence; sources unchanged in third-party/polyfork), each merged into
// one vertex-coloured geometry at load, drawn bigger like the rest of the
// world and sunk to its waterline (the water is at the instance's y).
import * as THREE from 'three';
import {createMaterial} from './constants.js';
import * as rowboat from './third-party/polyfork/rowboat-c42d85.mjs';
import * as woodenRowboat from './third-party/polyfork/wooden-rowboat-916981.mjs';
import * as riverBoat from './third-party/polyfork/flat-river-boat-6bac37.mjs';
import * as fishingBoat from './third-party/polyfork/small-fishing-boat-4ac0e3.mjs';
import * as islandBoat from './third-party/polyfork/hanga-roa-fishing-boat-f09534.mjs';
import * as sunkenBoat from './third-party/polyfork/sunken-fishing-boat-061c70.mjs';
import * as pirateGalleon from './third-party/polyfork/pirate-galleon-2e9aea.mjs';
import * as pirateBrigantine from './third-party/polyfork/pirate-brigantine-c29c57.mjs';
import * as pirateSloop from './third-party/polyfork/pirate-sloop-d8ead0.mjs';

// How much bigger than real life the boats are drawn (like the road
// vehicles): a 3 m rowboat comes out 7.5 units long
export const SMALL_BOAT_SCALE = 2.5;

export const boatMat = createMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 0.85,
});

// Merges every mesh of a built asset into one non-indexed geometry with
// vertex colours, turned by rotY, lowered by `draft` (metres, before scale)
// and scaled (farm-models.js uses it too). `keep(lowY)`, if given, picks the
// triangles to include by their lowest corner's height (metres, as built).
export function mergeAsset(
  asset,
  draft,
  scale = SMALL_BOAT_SCALE,
  rotY = 0,
  keep = null
) {
  if (rotY) asset.rotation.y = rotY;
  asset.updateMatrixWorld(true);
  const pos = [];
  const col = [];
  const v = new THREE.Vector3();
  asset.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = g.attributes.position;
    const c = g.attributes.color;
    for (let t = 0; t < p.count; t += 3) {
      if (keep) {
        let low = Infinity;
        for (let i = t; i < t + 3; i++)
          low = Math.min(
            low,
            v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).y
          );
        if (!keep(low)) continue;
      }
      for (let i = t; i < t + 3; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        pos.push(v.x * scale, (v.y - draft) * scale, v.z * scale);
        if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
        else col.push(1, 1, 1);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// The highest point painted in one of the model's colours: where its
// bottom paint stops is its waterline
function topOfColor(asset, hex) {
  asset.updateMatrixWorld(true);
  const want = new THREE.Color(hex).getHexString();
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  let top = 0;
  asset.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.color) return;
    const p = o.geometry.attributes.position;
    const cc = o.geometry.attributes.color;
    for (let i = 0; i < p.count; i++) {
      if (c.fromBufferAttribute(cc, i).getHexString() !== want) continue;
      top = Math.max(
        top,
        v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).y
      );
    }
  });
  return top;
}

function islandBoatGeo(colorway) {
  const asset = islandBoat.createAsset({colorway});
  const bottom =
    islandBoat.presets[colorway]?.bottom ?? islandBoat.params.bottom.default;
  return mergeAsset(asset, topOfColor(asset, bottom));
}

// Each boat type (instanced by this name in terrain-chunks.js), built in one
// paint scheme. Rowboats ride high (a hand's width of freeboard sunk); the
// small fishing boat's painted waterline is 0.35 m up its keel.
export function buildSmallBoatGeos() {
  return {
    rowboatBody: mergeAsset(
      rowboat.createAsset({colorway: 'harbour-blue'}),
      0.2
    ),
    woodenRowboatBody: mergeAsset(
      woodenRowboat.createAsset({colorway: 'weathered-oak'}),
      0.22
    ),
    riverBoatBody: mergeAsset(
      riverBoat.createAsset({colorway: 'tarred-cedar'}),
      0.2
    ),
    fishingBoatBody: mergeAsset(
      fishingBoat.createAsset({colorway: 'harbour-blue', parked: false}),
      0.35
    ),
    fishingBoat2Body: mergeAsset(
      fishingBoat.createAsset({colorway: 'salmon', parked: false}),
      0.35
    ),
    islandBoatBody: islandBoatGeo('red-and-yellow'),
    islandBoat2Body: islandBoatGeo('turquoise-and-white'),
    // On the sea floor, so not sunk any further
    sunkenBoatBody: mergeAsset(
      sunkenBoat.createAsset({colorway: 'deep-wreck'}),
      0
    ),
  };
}

// --- PIRATE SHIPS ---
// The pirate ships' four looks (a ship's bodyId, terrain-gen.js), Polyfork
// models like the small boats: the galleon, a tarred brigantine, a black
// raider sloop and a grey ghost galleon. Each is built bow toward -z (our
// old ships' way), sunk to its waterline and sized for the instance scale
// flight-camera.js and terrain-chunks.js give pirate ships (2.5), so the
// galleon comes out about 74 units long and the sloop about 41.
export const PIRATE_SHIP_INSTANCE_SCALE = 2.5;
const PIRATE_SHIPS = [
  // module, options, how many times real size, draft (m), turn to face -z
  [pirateGalleon, {colorway: 'weathered-oak'}, 2.8, 2.0, Math.PI],
  [pirateBrigantine, {colorway: 'tarred-black'}, 3.6, 1.6, -Math.PI / 2],
  [pirateSloop, {colorway: 'black-hull-raider'}, 4.2, 0.7, Math.PI],
  [pirateGalleon, {colorway: 'ghost-tide'}, 2.8, 2.0, Math.PI],
];
export const PIRATE_SHIP_LOOKS = PIRATE_SHIPS.length;

// One geometry per look, in the order of PIRATE_SHIPS
export function buildPirateShipGeos() {
  return PIRATE_SHIPS.map(([module, opts, scale, draft, rotY]) =>
    mergeAsset(
      module.createAsset(opts),
      draft,
      scale / PIRATE_SHIP_INSTANCE_SCALE,
      rotY
    )
  );
}
