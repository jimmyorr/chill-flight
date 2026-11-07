// --- SWAMP MODELS ---
// Vegetation and backwater props for the southern bayou / swamp biome
// (placed in terrain-gen.js, drawn by terrain-chunks.js): Polyfork models
// (polyfork.dev, free licence; sources unchanged in third-party/polyfork),
// each merged into one vertex-coloured geometry at load via mergeAsset
// from boat-models.js.
import * as THREE from 'three';
import * as dawnRedwood from './third-party/polyfork/dawn-redwood-001c29.mjs';
import * as lakesideTree from './third-party/polyfork/lakeside-swing-tree-02c084.mjs';
import * as deadOak from './third-party/polyfork/twisted-dead-oak-49457b.mjs';
import * as deadSnag from './third-party/polyfork/dead-snag-0b1891.mjs';
import * as cattail from './third-party/polyfork/cattail-reed-6abbb3.mjs';
import * as moatReed from './third-party/polyfork/moat-reed-clump-dd6b60.mjs';
import * as lilyPads from './third-party/polyfork/lily-pads-b0c5d0.mjs';
import * as hollowLog from './third-party/polyfork/hollow-log-329fd7.mjs';
import * as mossStump from './third-party/polyfork/moss-covered-stump-7253ab.mjs';
import {mergeAsset, POLYFORK_SCALE} from './boat-models.js';

// Dawn Redwood (Metasequoia, close cousin of bald cypress with an 8-lobed
// fluted buttressed trunk and feathery sprays) is 20 m tall as built; scaled
// by 2.1 it stands ~42 units tall, matching tallDeciduous.
const CYPRESS_SCALE = 2.1;
// Extra-large twisted dead oak landmark in the swamp (~272 units tall,
// comparable to the 270-unit peak height of the rock arch).
const GIANT_SWAMP_OAK_SCALE = 39;

function buildCattailClumpAsset() {
  const group = new THREE.Group();
  const a = cattail.createAsset({
    colorway: 'summer-green',
    stage: 'mature',
    blades: 4,
    spread: 1.2,
    scale: 2.0,
  });
  const b = cattail.createAsset({
    colorway: 'autumn-sedge',
    stage: 'seeding',
    blades: 3,
    spread: 1.3,
    scale: 1.75,
  });
  b.position.set(0.35, 0, 0.25);
  b.rotation.y = 2.1;
  group.add(a, b);
  return group;
}

export function buildSwampGeos() {
  return {
    // Lush bald cypress with buttressed trunk and olive-green feathery sprays
    swampCypress: mergeAsset(
      dawnRedwood.createAsset({
        height: 20,
        climate: 'lush',
        colorway: 'old-giant',
        foliage: '#4d6330',
        bark: '#634835',
        tone: 0.6,
      }),
      0.25,
      CYPRESS_SCALE
    ),
    // Weathered cypress with bare forked limbs and drooping Spanish-moss-toned sprays
    swampCypressMoss: mergeAsset(
      dawnRedwood.createAsset({
        height: 20,
        climate: 'dry',
        colorway: 'old-giant',
        rust: '#6d7a50',
        bark: '#543f30',
        tone: 0.6,
      }),
      0.25,
      CYPRESS_SCALE * 0.95
    ),
    // Broad leaning tupelo / water oak with flared roots on y = 0
    swampTupelo: mergeAsset(
      lakesideTree.createAsset({
        colorway: 'grey-alder',
        season: 'summer',
        wear: 0.7,
        lean: 10,
        limb: false,
        spread: 1.2,
        bark: '#595043',
        foliage: '#445931',
      }),
      0.2,
      POLYFORK_SCALE
    ),
    // Gnarled bare dead swamp oak with buttressed roots and hollow knothole
    swampDeadOak: mergeAsset(
      deadOak.createAsset({
        colorway: 'ashen-oak',
        gnarl: 0.85,
        spread: 1.15,
        knothole: true,
        roots: 7,
      }),
      0.2,
      POLYFORK_SCALE
    ),
    // Extra-large twisted dead oak landmark (~272 units tall) in the heart of the swamp
    swampGiantOak: mergeAsset(
      deadOak.createAsset({
        colorway: 'storm-brown',
        gnarl: 0.9,
        spread: 1.2,
        knothole: true,
        roots: 7,
      }),
      0.12,
      GIANT_SWAMP_OAK_SCALE
    ),
    // Standing dead conifer snag with moss cushions and stub-fork ferns
    swampSnag: mergeAsset(
      deadSnag.createAsset({
        colorway: 'valley-damp',
        climate: 'lush',
        height: 8,
        tone: 0.55,
      }),
      0.2,
      POLYFORK_SCALE
    ),
    // Splayed clump of tall marsh reeds and seed heads on a dark silt base
    swampReeds: mergeAsset(
      moatReed.createAsset({
        colorway: 'silt-black',
        blades: 14,
        heads: 6,
        tallness: 1.1,
        splay: 1.15,
      }),
      0.15,
      POLYFORK_SCALE
    ),
    // Classic cattail cluster with brown cylindrical seed heads
    swampCattails: mergeAsset(buildCattailClumpAsset(), 0.15, POLYFORK_SCALE),
    // Drift of 9 notched lily pads with cream water-lily blooms
    swampLilyPads: mergeAsset(
      lilyPads.createAsset({
        colorway: 'shaded-pool',
        count: 9,
        spread: 1.15,
        blooms: 2,
        wear: 0.4,
      }),
      0,
      POLYFORK_SCALE
    ),
    // Fallen moss-and-fern-covered hollow log
    swampLog: mergeAsset(
      hollowLog.createAsset({
        colorway: 'old-umber',
        climate: 'lush',
        ragged: 0.65,
        ferns: 3,
      }),
      0.15,
      POLYFORK_SCALE
    ),
    // Flared-root mossy swamp stump with fern fronds
    swampStump: mergeAsset(
      mossStump.createAsset({
        colorway: 'deep-shade',
        climate: 'lush',
        height: 1.3,
        mossCover: 0.85,
        sprig: true,
      }),
      0.15,
      POLYFORK_SCALE
    ),
  };
}

// Low-triangle vertex-coloured proxy fitted to `geo`'s bounding box for
// distant swamp trees beyond canopyDetailRadius().
export function createSwampFarCanopy(geo, canopyHex, barkHex = '#5c4633') {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const raw = new THREE.IcosahedronGeometry(1, 0);
  const nonIdx = raw.index ? raw.toNonIndexed() : raw;
  nonIdx.scale(half.x * 0.85, half.y * 0.9, half.z * 0.85);
  nonIdx.translate(center.x, center.y, center.z);
  nonIdx.computeVertexNormals();
  nonIdx.computeBoundingSphere();

  const p = nonIdx.attributes.position;
  const col = new Float32Array(p.count * 3);
  const cTop = new THREE.Color(canopyHex);
  const cBot = new THREE.Color(barkHex);
  const splitY = box.min.y + (box.max.y - box.min.y) * 0.3;
  for (let i = 0; i < p.count; i++) {
    const c = p.getY(i) < splitY ? cBot : cTop;
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  nonIdx.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return nonIdx;
}
