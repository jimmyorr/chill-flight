// Entry point for debug/debug-models.html: only what the model viewer needs, so it
// doesn't start the game's renderer or terrain workers.
import '../storage-polyfill.js';
import './sentry.js';
import '../logger.js';
import '../chill-flight-logic.js';
import '../state.js';
import '../constants.js';
import '../biplane.js';
import '../twin.js';
import '../buggy-model.js';
import '../airplane.js';
import '../low-poly.js';
import '../tree-models.js';
import '../terrain-geometry.js';

import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {
  farCanopy,
  farTrunk,
  fitToBounds,
  shadowBox,
  shadowCone,
  shadowCylinder,
  shadowGable,
  towerFarGeo,
} from '../low-poly.js';
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {destructibleTypes, startDestruction} from '../debug/destruction.js';
import {createMaterial} from '../constants.js';
import {createBiplaneModel} from '../biplane.js';
import {createJetModel} from '../jet.js';
import {
  createAirportSign,
  createControlTower,
  createHangar,
  createWindsock,
} from '../airports.js';
import {createWaterfall} from '../waterfalls.js';
import {
  ROAD_VEHICLES,
  ROAD_VEHICLE_SCALE,
  buildRoadVehicle,
} from '../road-vehicles.js';
import {basaltGate, canyonBridge, seaArch} from '../arches-logic.js';
import {archGeometry} from '../arches.js';
import {boatMat, buildSmallBoatGeos} from '../boat-models.js';
import {buildXmasGeos, xmasGlowMat} from '../xmas-models.js';
import {buildTractorGeos} from '../farm-models.js';
import {buildSwampGeos} from '../swamp-models.js';
import {
  buildLandmarkGeos,
  buildingMat,
  DINO_SKULL_COLORWAYS,
  DINO_SKULL_SPECIES,
  dinoSkullGeo,
  DRAGON_COLORWAYS,
  dragonSkeletonGeo,
  LANDMARK_HOUSES,
  LANDMARK_SMALL,
  buildTentGeos,
} from '../building-models.js';
import {createTwinModel, setGearExtension} from '../twin.js';
import {createBuggyModel, setBuggyHoverFold} from '../buggy-model.js';
import {
  createSeaplaneModel,
  planeMat,
  planeWhiteMat,
  poseGear,
} from '../airplane.js';
import {
  ModelAssembler,
  animationUniforms,
  barnBodyGeo,
  barnMat,
  barnRoofGeo,
  barnSiloBodyGeo,
  barnSiloRoofGeo,
  hayBarnBodyGeo,
  hayBarnRoofGeo,
  houseChimneyGeo,
  houseDoorGeo,
  houseWindowGeo,
  monasteryBodyGeo,
  monasteryRoofGeo,
  strawHutBodyGeo,
  strawHutRoofGeo,
  timberBarnBodyGeo,
  timberBarnRoofGeo,
  twoStoryChimneyGeo,
  windmillBaseGeo,
  bridgeDeckGeo,
  bridgeDeckMat,
  bridgeGirderGeo,
  bridgeGirderMat,
  bridgePierCapGeo,
  bridgePierFootingGeo,
  bridgePierShaftGeo,
  bridgePilingMat,
  bridgeRailGeo,
  bushGeo,
  cactusGeo,
  cactusMat,
  joshuaGeos,
  joshuaTrunkMat,
  hayBaleGeo,
  hayBaleMat,
  fallenLogGeo,
  stumpGeo,
  fallenLogMat,
  sealGeo,
  sealMat,
  createDolphinModel,
  buoyGeos,
  buoyTopMat,
  mastGeometry,
  sheepGeos,
  goatGeos,
  deerGeos,
  sheepDarkMat,
  iceHutGeos,
  iceHutRoofMat,
  appleTreeGeos,
  birchGeos,
  broadleafOakGeos,
  castleRuinsGeo,
  castleRuinsMat,
  cherryBlossomGeos,
  createRockArchGeometries,
  deadCottonwoodGeo,
  deadTreeGeo,
  deadTreeMat,
  deciduousGeos,
  fruitTreeGeos,
  japaneseMapleGeos,
  lilyPadGeo,
  lilyPadMat,
  magnoliaGeos,
  mountainRowanGeos,
  mushroomGeos,
  mushroomStalkMat,
  crystalClusterGeo,
  crystalMat,
  oakGeos,
  orchardAppleGeos,
  palmGeos,
  pierDeckGeo,
  pierDeckLGeo,
  pierDeckMat,
  plumTreeGeos,
  rockGeo,
  rockMat,
  sculptedPineGeos,
  snowSpruceGeos,
  snowmanGeo,
  snowmanMat,
  tallDeciduousGeos,
  tentGeos,
  tentMat,
  treeLeavesGeo,
  treeTrunkGeo,
  treeTrunkMat,
  twistedDeadOakGeo,
  waterUniforms,
  woodMat,
} from '../terrain-geometry.js';
import {
  JOSHUA_LEAF_COLOR,
  ICE_HUT_COLORS,
  SHEEP_WOOL_COLORS,
  GOAT_COLORS,
  DEER_COLORS,
} from '../terrain-gen.js';

// Setup Viewer
const container = document.getElementById('viewer');
const viewScene = new THREE.Scene();
window.viewScene = viewScene;
viewScene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  45,
  container.clientWidth / container.clientHeight,
  0.1,
  1000
);
camera.position.set(20, 20, 20);

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({antialias: true});
} catch {
  try {
    renderer = new THREE.WebGLRenderer({antialias: false});
  } catch {
    // Failed
  }
}

if (!renderer) {
  container.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-family:sans-serif;text-align:center;padding:20px;">WebGL 2 is not supported or context creation failed.</div>';
} else {
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
}

const controls = renderer
  ? new OrbitControls(camera, renderer.domElement)
  : null;
if (controls) controls.enableDamping = true;

// Lights - Synchronized with game settings for consistent colors
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
viewScene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfff0dd, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
viewScene.add(dirLight);

// Grid
const grid = new THREE.GridHelper(100, 20, 0x475569, 0x1e293b);
viewScene.add(grid);

window.currentModel = null;
window.currentColorSeed = 0;
window.currentModelType = null;
let isDestroyed = false;
let activeDestruction = null;

function clearViewer() {
  activeDestruction = null;
  if (window.currentModel) {
    viewScene.remove(window.currentModel);
    window.currentModel = null;
  }
}

// Twin only: preview the landing gear folded away (kept across color cycles)
window.gearUp = false;
function toggleGear() {
  window.gearUp = !window.gearUp;
  if (window.currentModelType) {
    viewModel(window.currentModelType, null, window.currentColorSeed);
  }
}

function cycleColors() {
  window.currentColorSeed++;
  if (window.currentModelType) {
    viewModel(window.currentModelType, null, window.currentColorSeed);
  }
}

// Models with 3 distance LOD bands (<0.5 km full Polyfork, 0.5-3 km low-poly,
// >3 km shared far shapes) vs. 2 distance LOD bands (<3 km base, >3 km far)
const THREE_BAND_LOD_TYPES = new Set([
  'cherry_blossom',
  'japanese_maple',
  'sculpted_pine',
  'birch',
  'broadleaf_oak',
  'oak',
  'magnolia',
  'snow_spruce',
  'mountain_rowan',
  'palm',
  'fruit_trees',
]);
const TWO_BAND_LOD_TYPES = new Set([
  'pine',
  'deciduous',
  'tall_deciduous',
  'yellow_cortez',
  'joshua_tree',
  'mushroom',
  'dead_tree',
  'swamp_trees',
  'bush',
  'cactus',
  'house',
  'two_story_house',
  'straw_hut',
  'barn',
  'north_barns',
  'monastery',
  'castle',
  'windmill',
  'landmark_towers',
]);

function lodModesFor(type) {
  if (THREE_BAND_LOD_TYPES.has(type)) return ['near', 'mid', 'far', 'all'];
  if (TWO_BAND_LOD_TYPES.has(type)) return ['near', 'far', 'all'];
  return null;
}

window.currentLod = 'near';
function cycleLod() {
  const modes = lodModesFor(window.currentModelType);
  if (!modes) return;
  const cur = modes.includes(window.currentLod) ? window.currentLod : 'near';
  window.currentLod = modes[(modes.indexOf(cur) + 1) % modes.length];
  viewModel(window.currentModelType, null, window.currentColorSeed);
}

const farHouseWindowGeo = new THREE.PlaneGeometry(2, 2.5).translate(0, 0, 0.25);
const pineFarLeavesGeo = fitToBounds(
  new THREE.ConeGeometry(1, 2, 6, 1, true),
  treeLeavesGeo
);
const palmFarTrunkGeo = fitToBounds(
  new THREE.CylinderGeometry(0.6, 1, 2, 6, 1, true),
  palmGeos.trunk
);
const cactusFarGeo = fitToBounds(new THREE.BoxGeometry(2, 2, 2), cactusGeo);
const farGeoCache = new WeakMap();
function cachedFar(fn, geo) {
  let map = farGeoCache.get(fn);
  if (!map) {
    map = new WeakMap();
    farGeoCache.set(fn, map);
  }
  if (!map.has(geo)) map.set(geo, fn(geo));
  return map.get(geo);
}

function addStructureBand(group, structure, band, xOffset = 0) {
  for (const part of structure) {
    let geo = part.geo;
    let mat = part.mat;
    if (band === 'far') {
      if (
        geo === houseDoorGeo ||
        geo === houseChimneyGeo ||
        geo === twoStoryChimneyGeo
      ) {
        continue;
      } else if (geo === houseWindowGeo) {
        geo = farHouseWindowGeo;
      } else if (geo === strawHutBodyGeo || geo === barnSiloBodyGeo) {
        geo = cachedFar(shadowCylinder, geo);
      } else if (geo === strawHutRoofGeo || geo === barnSiloRoofGeo) {
        geo = cachedFar(shadowCone, geo);
      } else if (geo === barnBodyGeo || geo === monasteryBodyGeo) {
        geo = cachedFar(shadowBox, geo);
      } else if (geo === barnRoofGeo || geo === monasteryRoofGeo) {
        geo = cachedFar(shadowGable, geo);
      } else if (geo === windmillBaseGeo) {
        geo = towerFarGeo('windmillBase', geo);
        mat = buildingMat;
      }
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(part.pos[0] + xOffset, part.pos[1], part.pos[2]);
    mesh.rotation.set(...part.rot);
    if (part.order) mesh.rotation.order = part.order;
    if (part.scale) mesh.scale.set(...part.scale);
    mesh.userData.lodBand = band;
    group.add(mesh);
  }
}

function toggleDestruction() {
  const btn = document.getElementById('destroy-toggle');
  if (isDestroyed) {
    isDestroyed = false;
    activeDestruction = null;
    if (btn) btn.textContent = 'Destroy';
    viewModel(window.currentModelType, null, window.currentColorSeed);
  } else {
    isDestroyed = true;
    if (btn) btn.textContent = 'Reset';
    activeDestruction = startDestruction(
      window.currentModelType,
      window.currentModel,
      {rockMat, woodMat}
    );
  }
}

function viewModel(type, e, colorSeed = 0) {
  const keepCamera = !e && window.currentModelType === type;
  clearViewer();

  if (e || (colorSeed === 0 && !keepCamera)) {
    window.currentColorSeed = 0;
  }
  window.currentModelType = type;
  isDestroyed = false;
  activeDestruction = null;

  const supportsColors = [
    'house',
    'two_story_house',
    'tent',
    'sailboat',
    'pirateship',
    'airplane',
    'biplane',
    'twin',
    'twin-engine',
    'jet',
    'buggy',
    'mushroom',
    'crystal',
    'road_vehicles',
    'dragon_skeleton',
    'dinosaur_skull',
    'birch',
    'broadleaf_oak',
    'oak',
  ].includes(type);

  const lodToggle = document.getElementById('lod-toggle');
  const lodModes = lodModesFor(type);
  const lod = lodModes
    ? lodModes.includes(window.currentLod)
      ? window.currentLod
      : 'near'
    : 'near';
  if (lodToggle) {
    lodToggle.style.display = lodModes ? 'block' : 'none';
    if (lodModes) {
      const labels = {
        near: THREE_BAND_LOD_TYPES.has(type)
          ? 'LOD: Near (<0.5 km)'
          : 'LOD: Near (<3 km)',
        mid: 'LOD: Mid (0.5-3 km)',
        far: 'LOD: Far (>3 km)',
        all: 'LOD: All bands',
      };
      lodToggle.textContent = labels[lod];
    }
  }

  const colorBtn = document.getElementById('cycle-colors-btn');
  if (colorBtn) colorBtn.style.display = supportsColors ? 'block' : 'none';

  const gearToggle = document.getElementById('gear-toggle');
  const supportsGear = [
    'airplane',
    'jet',
    'twin',
    'twin-engine',
    'twin_engine',
    'buggy',
  ].includes(type);
  gearToggle.style.display = supportsGear ? 'block' : 'none';
  if (type === 'airplane') {
    gearToggle.textContent = window.gearUp ? 'Floats down' : 'Floats up';
  } else if (type === 'buggy') {
    gearToggle.textContent = window.gearUp ? 'Wheels down' : 'Hover mode';
  } else {
    gearToggle.textContent = window.gearUp ? 'Gear down' : 'Gear up';
  }

  const destroyToggle = document.getElementById('destroy-toggle');
  const supportsDestruction = destructibleTypes.has(type);
  if (destroyToggle) {
    destroyToggle.style.display = supportsDestruction ? 'block' : 'none';
    destroyToggle.textContent = 'Destroy';
  }

  const visibleButtons = [
    lodToggle,
    colorBtn,
    gearToggle,
    destroyToggle,
  ].filter((btn) => btn && btn.style.display !== 'none');
  visibleButtons.forEach((btn, idx) => {
    btn.style.marginTop = idx === 0 ? '0' : '8px';
  });

  document.getElementById('color-options').style.display =
    visibleButtons.length > 0 ? 'block' : 'none';

  // Update UI
  document.querySelectorAll('.model-btn').forEach((btn) => {
    btn.classList.remove('active');
    // If this was triggered via hash, we need to find the right button
    const clickAttr = btn.getAttribute('onclick') || '';
    if (
      clickAttr.includes(`'${type}'`) ||
      (type === 'twin-engine' && clickAttr.includes("'twin'"))
    ) {
      btn.classList.add('active');
      document.getElementById('model-name').innerText = btn.innerText;
    }
  });

  // Update URL hash
  if (window.location.hash !== `#${type}`) {
    try {
      history.pushState(null, null, `#${type}`);
    } catch {
      // Ignore in restricted iframe contexts
    }
  }

  const previewGroup = new THREE.Group();

  // 1. Try assembling via shared ModelAssembler first
  const structure = ModelAssembler
    ? ModelAssembler.getStructure(type, 0, {
        bodyId: colorSeed,
        roofId: colorSeed,
      })
    : null;

  if (structure) {
    if (lod === 'all' && lodModes) {
      const span = type === 'windmill' || type === 'barn' ? 18 : 12;
      addStructureBand(previewGroup, structure, 'near', -span);
      addStructureBand(previewGroup, structure, 'far', span);
    } else {
      addStructureBand(previewGroup, structure, lod, 0);
    }
  } else {
    // 2. Fallback for simple or unique models
    switch (type) {
      case 'airplane': {
        // Always the seaplane: state.airplaneModel is whichever plane
        // the game last built (the saved choice)
        const ap = createSeaplaneModel();

        if (ChillFlightLogic && ChillFlightLogic.PLANE_COLORS) {
          const colors = ChillFlightLogic.PLANE_COLORS;
          const newColor = colors[colorSeed % colors.length];
          const newAccentMat = planeMat.clone();
          newAccentMat.color.setHex(newColor);
          const newBodyMat = planeWhiteMat.clone();
          newBodyMat.color.setHex(newColor === 0xe8c382 ? 0x1c3144 : 0xffffff);

          ap.traverse((child) => {
            if (child.isMesh && child.material) {
              if (child.material === planeMat) {
                child.material = newAccentMat;
              } else if (child.material === planeWhiteMat) {
                child.material = newBodyMat;
              }
            }
          });
        }

        poseGear(window.gearUp ? 0 : 1);
        ap.visible = true;
        previewGroup.add(ap);
        break;
      }

      case 'control_tower':
        previewGroup.add(createControlTower());
        break;
      case 'hangar':
        previewGroup.add(createHangar());
        break;
      case 'windsock':
        previewGroup.add(createWindsock());
        break;
      case 'airport_sign':
        previewGroup.add(createAirportSign('Mesa Field', 1));
        break;
      case 'waterfall': {
        // A sample: a stream across a flat top from a pond, then a
        // fall down a steep slope into water (at y = 40, the game's
        // water level), lowered to the preview's ground. The ground
        // patch stands in for the terrain worker's height grid.
        const groundHeight = (z) =>
          z <= -30 ? 110 : Math.max(30, 110 - (z + 30) * 2.2);
        const cols = 17;
        const rows = 21;
        const heights = new Float32Array(cols * rows);
        for (let r = 0; r < rows; r++) {
          heights.fill(groundHeight(-160 + r * 10), r * cols, (r + 1) * cols);
        }
        const fall = createWaterfall({
          course: [
            [0, 110, -30],
            [0, 85, -19],
            [0, 60, -8],
            [0, 42, 0],
            [0, 37, 6],
          ],
          stream: [
            [0, 110, -110],
            [0, 110, -70],
            [0, 110, -30],
          ],
          ground: {x: -80, z: -160, step: 10, cols, rows, heights},
        });
        fall.position.y = -40;
        previewGroup.add(fall);
        break;
      }

      case 'biplane': {
        const colors =
          ChillFlightLogic && ChillFlightLogic.PLANE_COLORS
            ? ChillFlightLogic.PLANE_COLORS
            : [0x4794db];
        const newColor = colors[colorSeed % colors.length];
        const bp = createBiplaneModel({planeColor: newColor});

        bp.visible = true;
        previewGroup.add(bp);
        break;
      }

      case 'jet': {
        const colors =
          ChillFlightLogic && ChillFlightLogic.PLANE_COLORS
            ? ChillFlightLogic.PLANE_COLORS
            : [0x4794db];
        const newColor = colors[colorSeed % colors.length];
        const jet = createJetModel({planeColor: newColor});
        setGearExtension(jet, window.gearUp ? 0 : 1);

        jet.visible = true;
        previewGroup.add(jet);
        break;
      }

      case 'twin':
      case 'twin-engine':
      case 'twin_engine': {
        const colors =
          ChillFlightLogic && ChillFlightLogic.PLANE_COLORS
            ? ChillFlightLogic.PLANE_COLORS
            : [0xe0564c];
        const newColor = colors[colorSeed % colors.length];
        const tw = createTwinModel({planeColor: newColor});
        setGearExtension(tw, window.gearUp ? 0 : 1);

        tw.visible = true;
        previewGroup.add(tw);
        break;
      }

      case 'buggy': {
        const colors =
          ChillFlightLogic && ChillFlightLogic.PLANE_COLORS
            ? ChillFlightLogic.PLANE_COLORS
            : [0xe0564c];
        const newColor = colors[colorSeed % colors.length];
        const buggy = createBuggyModel({planeColor: newColor});
        setBuggyHoverFold(buggy, window.gearUp ? 1 : 0);
        previewGroup.add(buggy);
        break;
      }

      // NATURE
      case 'pine':
      case 'deciduous':
      case 'tall_deciduous':
      case 'yellow_cortez':
      case 'cherry_blossom':
      case 'japanese_maple':
      case 'sculpted_pine':
      case 'birch':
      case 'broadleaf_oak':
      case 'oak':
      case 'magnolia':
      case 'snow_spruce':
      case 'mountain_rowan':
      case 'palm': {
        const treeGeosMap = {
          pine: {trunk: treeTrunkGeo, leaves: treeLeavesGeo, hex: 0x1b5e20},
          deciduous: {...deciduousGeos, hex: 0x1b5e20},
          tall_deciduous: {...tallDeciduousGeos, hex: 0x1a451d},
          yellow_cortez: {...deciduousGeos, hex: 0xffeb3b},
          cherry_blossom: {...cherryBlossomGeos, hex: 0xf7c9d6},
          japanese_maple: {...japaneseMapleGeos, hex: 0xb5433a},
          sculpted_pine: {...sculptedPineGeos, hex: 0x7fa95c},
          birch: {
            ...birchGeos,
            hex: colorSeed % 2 === 1 ? 0xf39c12 : 0xb3d47f,
          },
          broadleaf_oak: {
            ...broadleafOakGeos,
            hex: colorSeed % 2 === 1 ? 0xd35400 : 0x77b258,
          },
          oak: {
            ...oakGeos,
            hex: colorSeed % 2 === 1 ? 0xc0392b : 0x7d8a5a,
          },
          magnolia: {...magnoliaGeos, hex: 0xf2f2f2},
          snow_spruce: {...snowSpruceGeos, hex: 0xf2f2f2},
          mountain_rowan: {...mountainRowanGeos, hex: 0xf2f2f2},
          palm: {...palmGeos, hex: 0x8fbf5a},
        };
        const geos = treeGeosMap[type];
        const bands =
          lod === 'all'
            ? THREE_BAND_LOD_TYPES.has(type)
              ? [
                  ['near', -16, 0],
                  ['mid', 0, 0],
                  ['far', 16, 0],
                ]
              : [
                  ['near', -12, 0],
                  ['far', 12, 0],
                ]
            : [
                [lod, -15, -0.05],
                [lod, 0, 0],
                [lod, 15, 0.05],
              ];
        bands.forEach(([band, xOffset, v]) => {
          const trunkGeo =
            band === 'far'
              ? type === 'palm'
                ? palmFarTrunkGeo
                : cachedFar(farTrunk, geos.trunk)
              : band === 'near' && geos.fullTrunk
                ? geos.fullTrunk
                : geos.trunk;
          const leavesGeo =
            band === 'far'
              ? type === 'pine'
                ? pineFarLeavesGeo
                : cachedFar(farCanopy, geos.leaves)
              : band === 'near' && geos.fullLeaves
                ? geos.fullLeaves
                : geos.leaves;
          const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
          const colorObj = new THREE.Color(geos.hex);
          colorObj.r = Math.max(0, Math.min(1, colorObj.r + v));
          colorObj.g = Math.max(0, Math.min(1, colorObj.g + v));
          colorObj.b = Math.max(0, Math.min(1, colorObj.b + v));
          const leaves = new THREE.Mesh(
            leavesGeo,
            createMaterial({
              color: colorObj.getHex(),
              vertexColors: true,
              flatShading: true,
              foliage: true,
            })
          );
          trunk.position.x = xOffset;
          leaves.position.x = xOffset;
          trunk.userData.lodBand = band;
          leaves.userData.lodBand = band;
          previewGroup.add(trunk, leaves);
        });
        break;
      }
      case 'fruit_trees': {
        const fruitVarieties = [
          appleTreeGeos,
          orchardAppleGeos,
          plumTreeGeos,
          fruitTreeGeos,
        ];
        const rows =
          lod === 'all'
            ? [
                ['near', 14],
                ['mid', 0],
                ['far', -14],
              ]
            : [[lod, 0]];
        rows.forEach(([band, zOffset]) => {
          fruitVarieties.forEach((geos, i) => {
            const xOffset = (i - (fruitVarieties.length - 1) / 2) * 14;
            const trunkGeo =
              band === 'far'
                ? cachedFar(farTrunk, geos.trunk)
                : band === 'near' && geos.fullTrunk
                  ? geos.fullTrunk
                  : geos.trunk;
            const leavesGeo =
              band === 'far'
                ? cachedFar(farCanopy, geos.leaves)
                : band === 'near' && geos.fullLeaves
                  ? geos.fullLeaves
                  : geos.leaves;
            const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
            const leaves = new THREE.Mesh(
              leavesGeo,
              createMaterial({
                color: 0xf2f2f2,
                vertexColors: true,
                flatShading: true,
                foliage: true,
              })
            );
            trunk.position.set(xOffset, 0, zOffset);
            leaves.position.set(xOffset, 0, zOffset);
            trunk.userData.lodBand = band;
            leaves.userData.lodBand = band;
            previewGroup.add(trunk, leaves);
          });
        });
        break;
      }
      case 'dead_tree': {
        const rows =
          lod === 'all'
            ? [
                ['near', 12],
                ['far', -12],
              ]
            : [[lod, 0]];
        rows.forEach(([band, zOffset]) => {
          [
            [deadTreeGeo, deadTreeMat, -18],
            [deadCottonwoodGeo, treeTrunkMat, 0],
            [twistedDeadOakGeo, treeTrunkMat, 18],
          ].forEach(([geo, mat, xOffset]) => {
            const m = new THREE.Mesh(
              band === 'far' ? cachedFar(farTrunk, geo) : geo,
              mat
            );
            m.position.set(xOffset, 0, zOffset);
            m.userData.lodBand = band;
            previewGroup.add(m);
          });
        });
        break;
      }
      case 'swamp_trees': {
        const geos = buildSwampGeos();
        const mat = createMaterial({
          color: 0xffffff,
          vertexColors: true,
          flatShading: true,
        });
        const keys = [
          'swampCypress',
          'swampCypressMoss',
          'swampTupelo',
          'swampDeadOak',
          'swampSnag',
        ];
        const rows =
          lod === 'all'
            ? [
                ['near', 14],
                ['far', -14],
              ]
            : [[lod, 0]];
        rows.forEach(([band, zOffset]) => {
          keys.forEach((key, i) => {
            const base = geos[key];
            const isDead = key === 'swampDeadOak' || key === 'swampSnag';
            const geo =
              band === 'far'
                ? isDead
                  ? cachedFar(farTrunk, base)
                  : cachedFar(farCanopy, base)
                : base;
            const m = new THREE.Mesh(geo, mat);
            m.position.set((i - (keys.length - 1) / 2) * 18, 0, zOffset);
            m.userData.lodBand = band;
            previewGroup.add(m);
          });
        });
        break;
      }
      case 'swamp_flora': {
        const geos = buildSwampGeos();
        const mat = createMaterial({
          color: 0xffffff,
          vertexColors: true,
          flatShading: true,
        });
        const keys = [
          'swampReeds',
          'swampCattails',
          'swampLilyPads',
          'swampLog',
          'swampStump',
        ];
        keys.forEach((key, i) => {
          const m = new THREE.Mesh(geos[key], mat);
          m.position.x = (i - (keys.length - 1) / 2) * 8;
          previewGroup.add(m);
        });
        break;
      }
      case 'cactus': {
        const bands =
          lod === 'all'
            ? [
                ['near', -6],
                ['far', 6],
              ]
            : [[lod, 0]];
        bands.forEach(([band, xOffset]) => {
          const m = new THREE.Mesh(
            band === 'far' ? cactusFarGeo : cactusGeo,
            cactusMat
          );
          m.position.x = xOffset;
          m.userData.lodBand = band;
          previewGroup.add(m);
        });
        break;
      }
      case 'ice_hut':
        ICE_HUT_COLORS.forEach((color, i) => {
          const body = new THREE.Mesh(iceHutGeos.body, createMaterial({color}));
          const roof = new THREE.Mesh(iceHutGeos.roof, iceHutRoofMat);
          body.position.x = roof.position.x = (i - 2) * 10;
          previewGroup.add(body, roof);
        });
        break;
      case 'sheep':
        SHEEP_WOOL_COLORS.forEach((color, i) => {
          const wool = new THREE.Mesh(
            sheepGeos.wool,
            createMaterial({color, flatShading: true})
          );
          const dark = new THREE.Mesh(sheepGeos.dark, sheepDarkMat);
          wool.position.x = dark.position.x = i * 4 - 6;
          wool.rotation.y = dark.rotation.y = i * 0.6;
          previewGroup.add(wool, dark);
        });
        break;
      case 'goats_deer':
        [
          [goatGeos, GOAT_COLORS, -4],
          [deerGeos, DEER_COLORS, 4],
        ].forEach(([geos, colors, z]) => {
          colors.forEach((color, i) => {
            const coat = new THREE.Mesh(
              geos.coat,
              createMaterial({color, flatShading: true})
            );
            const dark = new THREE.Mesh(geos.dark, sheepDarkMat);
            coat.position.set(i * 3.5 - 7, 0, z);
            dark.position.copy(coat.position);
            coat.rotation.y = dark.rotation.y = 1.2 + i * 0.3;
            previewGroup.add(coat, dark);
          });
        });
        break;
      case 'buoy':
        [0xc8372d, 0x2f8a52].forEach((color, i) => {
          const body = new THREE.Mesh(
            buoyGeos.body,
            createMaterial({color, flatShading: true})
          );
          const top = new THREE.Mesh(buoyGeos.top, buoyTopMat);
          body.position.x = top.position.x = i * 6 - 3;
          previewGroup.add(body, top);
        });
        break;
      case 'mast': {
        // The radio mast on the peaks (beacons.js), drawn smaller
        const mast = new THREE.Mesh(
          mastGeometry(),
          createMaterial({vertexColors: true, flatShading: true})
        );
        mast.material.side = THREE.DoubleSide;
        mast.scale.setScalar(0.25);
        previewGroup.add(mast);
        break;
      }
      case 'seal':
        previewGroup.add(new THREE.Mesh(sealGeo, sealMat));
        break;
      case 'north_barns': {
        // The timber barn and the alpine hay barn, walls and roof
        // (farm-models.js)
        const rows =
          lod === 'all'
            ? [
                ['near', 12],
                ['far', -12],
              ]
            : [[lod, 0]];
        rows.forEach(([band, zOffset]) => {
          [
            [timberBarnBodyGeo, timberBarnRoofGeo, -11],
            [hayBarnBodyGeo, hayBarnRoofGeo, 11],
          ].forEach(([body, roof, x]) => {
            const bGeo = band === 'far' ? cachedFar(shadowBox, body) : body;
            const rGeo = band === 'far' ? cachedFar(shadowGable, roof) : roof;
            for (const geo of [bGeo, rGeo]) {
              const m = new THREE.Mesh(geo, barnMat);
              m.position.set(x, 0, zOffset);
              m.userData.lodBand = band;
              previewGroup.add(m);
            }
          });
        });
        break;
      }
      case 'tractors': {
        // Each paint scheme, side by side at the game's scale
        // (farm-models.js)
        const geos = Object.values(buildTractorGeos());
        geos.forEach((geo, i) => {
          const m = new THREE.Mesh(geo, boatMat);
          m.position.x = (i - (geos.length - 1) / 2) * 6;
          previewGroup.add(m);
        });
        break;
      }
      case 'landmark_towers': {
        // Fire lookout, water tower and windpump side by side at the
        // game's scale (building-models.js)
        const towerTypes = ['fireLookout', 'waterTower', 'windpump'];
        const geos = buildLandmarkGeos(towerTypes);
        const rows =
          lod === 'all'
            ? [
                ['near', 16],
                ['far', -16],
              ]
            : [[lod, 0]];
        rows.forEach(([band, zOffset]) => {
          towerTypes.forEach((t, i) => {
            const base = geos[t];
            const m = new THREE.Mesh(
              band === 'far' ? towerFarGeo(t, base) : base,
              buildingMat
            );
            m.position.set((i - (towerTypes.length - 1) / 2) * 20, 0, zOffset);
            m.userData.lodBand = band;
            previewGroup.add(m);
          });
        });
        break;
      }
      case 'dinosaur_skull': {
        // Rex, Triceratops and Sauropod skulls side by side at the
        // game's scale (colour button cycles their bone schemes)
        const colorway =
          DINO_SKULL_COLORWAYS[colorSeed % DINO_SKULL_COLORWAYS.length];
        DINO_SKULL_SPECIES.forEach((species, i) => {
          const m = new THREE.Mesh(
            dinoSkullGeo(species, colorway),
            buildingMat
          );
          m.position.x = (i - (DINO_SKULL_SPECIES.length - 1) / 2) * 20;
          previewGroup.add(m);
        });
        break;
      }
      case 'camp_trailers': {
        // The campers' trailers side by side, with a tent for scale
        const geos = Object.values(buildLandmarkGeos(LANDMARK_SMALL));
        geos.push(buildTentGeos()[0]);
        geos.forEach((geo, i) => {
          const m = new THREE.Mesh(geo, buildingMat);
          m.position.x = (i - (geos.length - 1) / 2) * 14;
          previewGroup.add(m);
        });
        break;
      }
      case 'mill_taverns': {
        // Water mill, village tavern and cove tavern, walls and roof,
        // side by side at the game's scale (a farmhouse for scale)
        const types = [
          'waterMill',
          'villageTavern',
          'coveTavern',
          'farmhouse0',
        ];
        const geos = buildLandmarkGeos(types);
        types.forEach((type, i) => {
          for (const part of ['Body', 'Roof']) {
            const m = new THREE.Mesh(geos[type + part], buildingMat);
            m.position.x = (i - (types.length - 1) / 2) * 40;
            previewGroup.add(m);
          }
        });
        break;
      }
      case 'cabins_cottages': {
        // Log cabins and cottages, walls and roof, side by side at the
        // game's scale (a farmhouse for scale)
        const types = [
          'logCabin0',
          'logCabin1',
          'thatchedCottage',
          'roadCottage',
          'farmhouse0',
        ];
        const geos = buildLandmarkGeos(types);
        types.forEach((type, i) => {
          for (const part of ['Body', 'Roof']) {
            const m = new THREE.Mesh(geos[type + part], buildingMat);
            m.position.x = (i - (types.length - 1) / 2) * 34;
            previewGroup.add(m);
          }
        });
        break;
      }
      case 'landmark_houses': {
        // Walls and roof of each, side by side at the game's scale
        // (building-models.js)
        const geos = buildLandmarkGeos(LANDMARK_HOUSES);
        LANDMARK_HOUSES.forEach((type, i) => {
          for (const part of ['Body', 'Roof']) {
            const m = new THREE.Mesh(geos[type + part], buildingMat);
            m.position.x = (i - (LANDMARK_HOUSES.length - 1) / 2) * 24;
            previewGroup.add(m);
          }
        });
        break;
      }
      case 'small_boats': {
        // Rowboats, fishing boats (two schemes each) and
        // the sunken one, side by side at the game's scale, waterline
        // at y = 0 (boat-models.js)
        const geos = Object.values(buildSmallBoatGeos());
        geos.forEach((geo, i) => {
          const m = new THREE.Mesh(geo, boatMat);
          m.position.x = (i - (geos.length - 1) / 2) * 8;
          previewGroup.add(m);
        });
        break;
      }
      case 'christmas_village': {
        // The Christmas village's props (xmas-models.js) in rows at the
        // game's scale, each with its roof and lights, the lights lit
        const geos = buildXmasGeos();
        const props = new Map();
        for (const [type, geo] of Object.entries(geos)) {
          const name = type.replace(/(Body|Roof|Glow)$/, '');
          if (!props.has(name)) props.set(name, []);
          props.get(name).push([type, geo]);
        }
        xmasGlowMat.emissiveIntensity = 1;
        const perRow = 6;
        let i = 0;
        for (const parts of props.values()) {
          const x = ((i % perRow) - (perRow - 1) / 2) * 50;
          const z = Math.floor(i / perRow) * 50;
          for (const [type, geo] of parts) {
            const m = new THREE.Mesh(
              geo,
              type.endsWith('Glow') ? xmasGlowMat : buildingMat
            );
            m.position.set(x, 0, z);
            previewGroup.add(m);
          }
          i++;
        }
        break;
      }
      case 'road_vehicles':
        // Every kind the road traffic drives, side by side at the
        // game's scale (colour button cycles their paint schemes)
        ROAD_VEHICLES.forEach((kind, i) => {
          const scheme = kind.colorways[colorSeed % kind.colorways.length];
          const {asset} = buildRoadVehicle(kind, scheme);
          asset.scale.setScalar(ROAD_VEHICLE_SCALE);
          asset.position.x = (i - (ROAD_VEHICLES.length - 1) / 2) * 7;
          previewGroup.add(asset);
        });
        break;
      case 'dolphin': {
        // Drawn at the game's scale (dolphins.js)
        const {group} = createDolphinModel();
        group.scale.setScalar(2.6);
        previewGroup.add(group);
        break;
      }
      case 'fallen_log': {
        const log = new THREE.Mesh(fallenLogGeo, fallenLogMat);
        const stump = new THREE.Mesh(stumpGeo, buildingMat);
        stump.position.set(4, 0, 7);
        previewGroup.add(log, stump);
        break;
      }
      case 'hay_bale':
        for (const [x, z, r] of [
          [0, 0, 0],
          [6, 1, 0.2],
          [2, 7, 1.4],
        ]) {
          const m = new THREE.Mesh(hayBaleGeo, hayBaleMat);
          m.position.set(x, 0, z);
          m.rotation.y = r;
          previewGroup.add(m);
        }
        break;
      case 'joshua_tree': {
        const bands =
          lod === 'all'
            ? [
                ['near', -9],
                ['far', 9],
              ]
            : [[lod, 0]];
        bands.forEach(([band, xOffset]) => {
          const trunk = new THREE.Mesh(
            band === 'far'
              ? cachedFar(farTrunk, joshuaGeos.trunk)
              : joshuaGeos.trunk,
            joshuaTrunkMat
          );
          const leaves = new THREE.Mesh(
            band === 'far'
              ? cachedFar(farCanopy, joshuaGeos.leaves)
              : joshuaGeos.leaves,
            createMaterial({color: JOSHUA_LEAF_COLOR})
          );
          trunk.position.x = xOffset;
          leaves.position.x = xOffset;
          trunk.userData.lodBand = band;
          leaves.userData.lodBand = band;
          previewGroup.add(trunk, leaves);
        });
        break;
      }
      case 'bush': {
        const bands =
          lod === 'all'
            ? [
                ['near', -7, 0],
                ['far', 7, 0],
              ]
            : [
                [lod, -10, -0.075],
                [lod, 0, 0],
                [lod, 10, 0.075],
              ];
        bands.forEach(([band, xOffset, v]) => {
          const colorObj = new THREE.Color(0x558b2f);
          colorObj.r = Math.max(0, Math.min(1, colorObj.r + v));
          colorObj.g = Math.max(0, Math.min(1, colorObj.g + v));
          colorObj.b = Math.max(0, Math.min(1, colorObj.b + v));
          const bMesh = new THREE.Mesh(
            band === 'far' ? cachedFar(farCanopy, bushGeo) : bushGeo,
            createMaterial({color: colorObj.getHex()})
          );
          bMesh.position.x = xOffset;
          bMesh.userData.lodBand = band;
          previewGroup.add(bMesh);
        });
        break;
      }
      case 'mushroom': {
        const bands =
          lod === 'all'
            ? [
                ['near', -10, 0, 1.2],
                ['far', 10, 0, 1.2],
              ]
            : [
                [lod, -15, -0.08, 0.8],
                [lod, 0, 0, 1.2],
                [lod, 15, 0.08, 1.8],
              ];
        bands.forEach(([band, xOffset, v, scale]) => {
          const stalk = new THREE.Mesh(
            band === 'far'
              ? cachedFar(farTrunk, mushroomGeos.trunk)
              : mushroomGeos.trunk,
            mushroomStalkMat
          );
          const capPalettes = [
            0x9c27b0, 0xab47bc, 0x7b1fa2, 0x00bcd4, 0x26a69a, 0xe91e63,
          ];
          const baseHex = capPalettes[colorSeed % capPalettes.length];
          const colorObj = new THREE.Color(baseHex);
          colorObj.r = Math.max(0, Math.min(1, colorObj.r + v));
          colorObj.g = Math.max(0, Math.min(1, colorObj.g + v));
          colorObj.b = Math.max(0, Math.min(1, colorObj.b + v));

          const cap = new THREE.Mesh(
            band === 'far'
              ? cachedFar(farCanopy, mushroomGeos.leaves)
              : mushroomGeos.leaves,
            createMaterial({color: colorObj.getHex()})
          );

          stalk.scale.set(scale, scale, scale);
          cap.scale.set(scale, scale, scale);

          stalk.position.x = xOffset;
          cap.position.x = xOffset;
          stalk.userData.lodBand = band;
          cap.userData.lodBand = band;
          previewGroup.add(stalk, cap);
        });
        break;
      }
      case 'crystal': {
        const palette = [0xff4fd8, 0xff7a3d, 0xffb8ec, 0xc04dff, 0xff2e7e];
        [-30, 0, 30].forEach((xOffset, i) => {
          const mat = crystalMat.clone();
          mat.color.setHex(palette[(colorSeed + i) % palette.length]);
          const cluster = new THREE.Mesh(crystalClusterGeo, mat);
          const scale = [0.8, 1.4, 2.2][i];
          cluster.scale.set(scale, scale, scale);
          cluster.position.x = xOffset;
          previewGroup.add(cluster);
        });
        break;
      }
      case 'rock':
        previewGroup.add(new THREE.Mesh(rockGeo, rockMat));
        break;
      case 'rock_arch': {
        const geos = createRockArchGeometries(ChillFlightLogic.mulberry32(42));
        previewGroup.userData.blocks = geos.blocks;
        previewGroup.add(new THREE.Mesh(geos.rock, rockMat));
        break;
      }
      // The arches to fly under (arches.js), on flat ground at 0
      case 'sea_arch':
      case 'sea_arch_snow':
      case 'canyon_bridge':
      case 'gorge_bridge':
      case 'basalt_gate': {
        const rand = ChillFlightLogic.mulberry32(7);
        const arch =
          type === 'sea_arch' || type === 'sea_arch_snow'
            ? seaArch(0, 0, 0, 0, rand)
            : type === 'canyon_bridge'
              ? canyonBridge(0, 0, 0, -160, 160, 0, 150, rand)
              : type === 'gorge_bridge'
                ? canyonBridge(0, 0, 0, -180, 180, 0, 200, rand, 'gorge')
                : basaltGate(0, 0, 0, -190, 190, 0, 10, 62, 0.4);
        if (type === 'sea_arch_snow') arch.snow = 1;
        previewGroup.add(
          new THREE.Mesh(
            archGeometry(arch, () => 0),
            createMaterial({vertexColors: true, flatShading: true})
          )
        );
        break;
      }
      case 'rock_arch_grass': {
        const geos = createRockArchGeometries(ChillFlightLogic.mulberry32(42));
        previewGroup.userData.blocks = geos.blocks;
        previewGroup.add(new THREE.Mesh(geos.rock, rockMat));
        previewGroup.add(
          new THREE.Mesh(geos.grass, createMaterial({color: 0x7cb342}))
        );
        break;
      }
      case 'lily_pad':
        previewGroup.add(new THREE.Mesh(lilyPadGeo, lilyPadMat));
        break;
      case 'snowman':
        previewGroup.add(new THREE.Mesh(snowmanGeo, snowmanMat));
        break;
      case 'castle': {
        const bands =
          lod === 'all'
            ? [
                ['near', -26],
                ['far', 26],
              ]
            : [[lod, 0]];
        bands.forEach(([band, xOffset]) => {
          const m = new THREE.Mesh(
            band === 'far'
              ? towerFarGeo('castleRuins', castleRuinsGeo)
              : castleRuinsGeo,
            castleRuinsMat
          );
          m.position.x = xOffset;
          m.userData.lodBand = band;
          previewGroup.add(m);
        });
        break;
      }
      case 'dragon_skeleton': {
        const colorway = DRAGON_COLORWAYS[colorSeed % DRAGON_COLORWAYS.length];
        previewGroup.add(
          new THREE.Mesh(dragonSkeletonGeo(colorway), buildingMat)
        );
        break;
      }
      case 'pier':
        previewGroup.add(new THREE.Mesh(pierDeckGeo, pierDeckMat));
        break;
      case 'pier_l':
        previewGroup.add(new THREE.Mesh(pierDeckLGeo, pierDeckMat));
        break;
      case 'bridge': {
        previewGroup.add(new THREE.Mesh(bridgeDeckGeo, bridgeDeckMat));
        if (bridgeGirderGeo) {
          previewGroup.add(
            new THREE.Mesh(bridgeGirderGeo, bridgeGirderMat || bridgePilingMat)
          );
        }

        const halfRoadW = ChillFlightLogic.ROAD_WIDTH + 1.4;
        [-halfRoadW, halfRoadW].forEach((xOff) => {
          const rail = new THREE.Mesh(bridgeRailGeo, bridgePilingMat);
          rail.position.set(xOff, 2.05, 0);
          previewGroup.add(rail);
        });

        if (bridgePierCapGeo) {
          const cap = new THREE.Mesh(bridgePierCapGeo, bridgePilingMat);
          cap.position.set(0, 0, 0);
          previewGroup.add(cap);
        }

        if (bridgePierShaftGeo) {
          const shaft = new THREE.Mesh(bridgePierShaftGeo, bridgePilingMat);
          shaft.position.set(0, -7.0, 0);
          shaft.scale.set(1, 20, 1);
          previewGroup.add(shaft);
        }

        if (bridgePierFootingGeo) {
          const footing = new THREE.Mesh(bridgePierFootingGeo, bridgePilingMat);
          footing.position.set(0, -27.0 + 1.5, 0);
          previewGroup.add(footing);
        }
        break;
      }
      case 'tent': {
        // Polyfork camp tent, its colour by the seed
        previewGroup.add(
          new THREE.Mesh(tentGeos[colorSeed % tentGeos.length], tentMat)
        );
        break;
      }
    }
  }

  previewGroup.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Center and scale
  const box = new THREE.Box3().setFromObject(previewGroup);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0 ? 15 / maxDim : 1;

  previewGroup.scale.setScalar(scale);

  // Re-calculate box after scale to get accurate offset
  const scaledBox = new THREE.Box3().setFromObject(previewGroup);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  previewGroup.position.sub(scaledCenter);
  previewGroup.position.y += (size.y * scale) / 2; // Sit on grid

  window.currentModel = previewGroup;
  viewScene.add(window.currentModel);

  // Update stats
  let vertices = 0;
  let triangles = 0;
  const bandTris = {near: 0, mid: 0, far: 0};
  previewGroup.traverse((child) => {
    if (child.isMesh) {
      vertices += child.geometry.attributes.position.count;
      const t = child.geometry.index
        ? child.geometry.index.count / 3
        : child.geometry.attributes.position.count / 3;
      triangles += t;
      if (child.userData.lodBand) {
        bandTris[child.userData.lodBand] += t;
      }
    }
  });
  if (lod === 'all' && lodModes) {
    const parts = [
      `Near: ${Math.round(bandTris.near)} tris`,
      ...(THREE_BAND_LOD_TYPES.has(type)
        ? [`Mid: ${Math.round(bandTris.mid)} tris`]
        : []),
      `Far: ${Math.round(bandTris.far)} tris`,
    ];
    document.getElementById('model-stats').innerText = parts.join(' | ');
  } else {
    document.getElementById('model-stats').innerText =
      `${Math.round(vertices)} vertices | ${Math.round(triangles)} triangles`;
  }

  // Adjust camera to fit
  const finalBox = new THREE.Box3().setFromObject(previewGroup);
  const finalCenter = new THREE.Vector3();
  finalBox.getCenter(finalCenter);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);

  const frontFacingTypes = [
    'airplane',
    'biplane',
    'jet',
    'twin',
    'twin-engine',
    'twin_engine',
    'buggy',
    'sailboat',
    'pirateship',
    'hawk',
    'seagull',
    'goose',
  ];
  const isFrontFacing = frontFacingTypes.includes(type);
  const maxDimension = Math.max(finalSize.x, finalSize.y, finalSize.z);
  const distanceMultiplier = isFrontFacing ? 1.2 : 1.5;
  const distance = maxDimension * distanceMultiplier;

  if (!keepCamera && controls) {
    controls.reset();
    controls.target.copy(finalCenter);
    if (isFrontFacing) {
      camera.position.set(distance * 0.92, distance * 0.58, -distance * 0.82);
    } else {
      camera.position.set(distance, distance, distance);
    }
    controls.update();
  }
}

let lastAnimTime = performance.now();
function animate() {
  if (!renderer) return;
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min(0.1, (now - lastAnimTime) * 0.001);
  lastAnimTime = now;

  const time = now * 0.001;
  animationUniforms.uTime.value = time;
  waterUniforms.uTime.value = time;

  if (activeDestruction) {
    activeDestruction.update(delta);
  }

  controls?.update();
  renderer.render(viewScene, camera);
}

window.addEventListener('resize', () => {
  if (!renderer) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.substring(1);
  if (hash) viewModel(hash);
});

// Expose globally before initial load
window.viewModel = viewModel;
window.cycleLod = cycleLod;
window.cycleColors = cycleColors;
window.toggleGear = toggleGear;
window.toggleDestruction = toggleDestruction;

// Start
animate();

// Initial load
setTimeout(() => {
  const hash = window.location.hash.substring(1);
  if (hash) {
    viewModel(hash);
  } else {
    // Default to airplane
    const firstBtn = document.querySelector('.model-btn');
    if (firstBtn) firstBtn.click();
  }
}, 100);
