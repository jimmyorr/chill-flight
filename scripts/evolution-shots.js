// Chronological shot list for scripts/evolution.js: 44 milestones from the
// first 493-line cowneck prototype on February 25, 2026 (88d428c4) through
// v1.2.10, paced to the full 3:19 (199.20 s) runtime of Purrple Cat's
// "Going with the Flow".
//
// World coordinates are reported in both in-game units (X, Z) and lat/long
// (1 deg = 5000 units; -Z is North, +Z is South, +X is East, -X is West).

export const EVOLUTION_MUSIC = {
  slug: 'going-with-the-flow',
  title: 'Going with the Flow',
  artist: 'Purrple Cat',
  durationSec: 199.2,
};

export const EVOLUTION_FADE_SEC = 0.5;

export const EVOLUTION_TITLE_CARD = {
  title: 'CHILL FLIGHT',
  lines: ['February - November 2026'],
  seconds: 3.5,
};

export const EVOLUTION_END_CARD = {
  title: 'CHILL FLIGHT',
  tagline: 'Have a chill flight.',
  lines: ['Music: "Going with the Flow" by Purrple Cat', 'chillflight.app'],
  version: true,
  seconds: 5.0,
};

// Base epoch aligned to a 300,000 ms (5-minute) cycle boundary for builds
// between Feb 27 and May 31, 2026 that derive timeOfDay from Date.now().
// Adding phase * 300000 ms selects the time of day deterministically:
//   ~0.24 = sunrise, ~0.50 = midday, ~0.74 = golden sunset, ~0.92 = night.
const EPOCH_BASE = 1772400000000;
const cycleEpoch = (phase) => EPOCH_BASE + Math.round(phase * 300000);

// Shared query defaults for modern builds (v0.9.38+ / v1.0.0+).
const MODERN_COMMON =
  'seed=20260101&start=1&music=0&hints=0&preset=ultra&timeSpeed=0' +
  '&clock=1790000000000&cloudTime=500&fps=0&adaptive=0&traffic=0&xmas=off';

export const EVOLUTION_ACTS = [
  {act: 1, title: 'First prototype & early biomes (Feb - Mar 2026)'},
  {act: 2, title: 'Weather, shaders & shadows (Mar - Apr 2026)'},
  {act: 3, title: 'Cinematic skies, islands & fleet (v0.8 - v0.9)'},
  {act: 4, title: 'Airfields, jet, buggy & living world (v1.0 - v1.2.10)'},
  {act: 5, title: 'Day 1 to today'},
];

// Each shot entry:
// - id: filename slug (promo/evolution/clip-<id>.mp4)
// - act: 1..5 (used for YouTube chapters)
// - source:
//     {type: 'git', ref, entry?} -> extracted from git archive (never docs/)
//     {type: 'pages', version}   -> https://vX-Y-Z.chill-flight.pages.dev/
//     {type: 'current'}          -> temporary vite build of current HEAD
// - badgeTop / badgeSub: two-line frosted-glass milestone overlay
// - badgePos: 'bottom-left' (default) or 'top-left' / 'bottom-right'
// - seconds: clip length before crossfade overlap
// - transition: 'fade' (0.5 s xfade) or 'cut' (0.0 s hard match-cut to next)
// - showUi: true keeps the era's authentic HUD visible; false hides non-canvas UI
// - seedRandom: seeds Math.random before load (for pre-2026-03-05 commits)
// - epochMs: virtual Date.now() start value
// - query: URL query parameters (for eras with URL param support)
// - stageCode: optional JS snippet run in the page's global lexical scope
//              before and after chunk settle
// - afterSettleCode: optional JS snippet run once after chunks settle, before preroll
// - timedActions: optional [{atSec, code}] executed at specific clip timestamps
// - mouseNorm: optional [nx, ny] in [-1..1] dispatched as mousemove after preroll
// - moves: optional promo-script keyframes (v1.2.1+)
export const EVOLUTION_SHOTS = [
  // =========================================================================
  // ACT 1: Genesis in cowneck & the first two weeks (Feb 25 - Mar 14, 2026)
  // =========================================================================
  {
    // Spawn corridor: X = 0, Z = 0 (0.00 North, 0.00 East)
    id: '01-genesis',
    act: 1,
    source: {type: 'git', ref: '88d428c4', entry: 'games/chill-flight.html'},
    badgeTop: 'PROTOTYPE · FEB 25, 2026',
    badgeSub: 'First 493 lines: procedural hills, cone pines & boxy plane',
    seconds: 4.6,
    showUi: true,
    seedRandom: 20260225,
    epochMs: cycleEpoch(0.5),
    stageCode: `
      planeGroup.position.set(0, 195, 0);
      planeGroup.rotation.set(0, 0, 0);
      updateChunks();
      camera.position.set(0, 210, 45);
      camera.lookAt(0, 195, -20);
    `,
    mouseNorm: [0.18, -0.02],
  },
  {
    // Central hills: X = 0, Z = -1200 (0.24 North, 0.00 East)
    id: '02-first-sunset',
    act: 1,
    source: {type: 'git', ref: 'f2f05443', entry: 'games/chill-flight.html'},
    badgeTop: 'PROTOTYPE · FEB 25, 2026',
    badgeSub: 'First day-night cycle, blocky clouds & glowing sun sphere',
    seconds: 4.6,
    showUi: false,
    seedRandom: 20260226,
    epochMs: cycleEpoch(0.25),
    stageCode: `
      timeOfDay = Math.PI * 0.535;
      planeGroup.position.set(0, 210, -1200);
      planeGroup.rotation.set(0, -Math.PI / 2, 0);
      updateChunks();
      camera.position.set(-45, 225, -1200);
      camera.lookAt(20, 210, -1200);
    `,
    mouseNorm: [-0.14, 0.02],
  },
  {
    // Southern archipelago sea channel: X = 400, Z = 2600 (0.52 South, 0.08 East)
    id: '03-cockpit-pontoons',
    act: 1,
    source: {type: 'git', ref: 'f5737a48', entry: 'games/chill-flight.html'},
    badgeTop: 'PROTOTYPE · FEB 26, 2026',
    badgeSub: 'Early cockpit radio bar & retractable water pontoons',
    seconds: 4.6,
    showUi: true,
    seedRandom: 20260228,
    epochMs: cycleEpoch(0.52),
    stageCode: `
      timeOfDay = Math.PI * 0.72;
      pontoonGroup.visible = true;
      isDeployingPontoons = true;
      isRetractingPontoons = false;
      pontoonDeploymentProgress = 1;
      pontoonL.rotation.z = 0;
      pontoonR.rotation.z = 0;
      hingeLF.rotation.z = 0;
      hingeLB.rotation.z = 0;
      hingeRF.rotation.z = 0;
      hingeRB.rotation.z = 0;
      pontoonL.position.y = -4.5;
      pontoonR.position.y = -4.5;
      planeGroup.position.set(220, 142, 2600);
      planeGroup.rotation.set(0, 0.08, 0);
      updateChunks();
      camera.position.set(224, 157, 2645);
      camera.lookAt(218, 142, 2580);
    `,
    mouseNorm: [-0.1, -0.01],
  },
  {
    // Cherry-blossom hills & coastal village across bay: X = 75, Z = -1860 (0.37 North, 0.02 East)
    id: '04-villages-biomes',
    act: 1,
    source: {type: 'git', ref: 'f16cae6c'},
    badgeTop: 'PROTOTYPE · FEB 28, 2026',
    badgeSub: 'Cherry-blossom & autumn hills, houses, windmills & lighthouses',
    seconds: 4.6,
    showUi: false,
    seedRandom: 20260101,
    epochMs: cycleEpoch(0.58),
    stageCode: `
      planeGroup.position.set(75, 225, -1860);
      planeGroup.rotation.set(0, 0.35, 0);
      updateChunks();
      camera.position.set(90, 242, -1815);
    `,
    mouseNorm: [0.16, -0.02],
  },
  {
    // Earliest 3-cylinder island lighthouse in chunk (5, 2): X = 7125, Z = 3637.5 (0.73 South, 1.43 East),
    // approached WSW from X = 7825, Z = 3350 (0.67 South, 1.57 East) toward coastal hills & sunset sun
    id: '04b-first-lighthouse',
    act: 1,
    source: {type: 'git', ref: '0ecbee0e'},
    badgeTop: 'PROTOTYPE · FEB 28, 2026',
    badgeSub: 'First stacked-cylinder lighthouse, island coast & rotating beam',
    seconds: 4.8,
    preroll: 1.0,
    sheetSec: 2.8,
    showUi: false,
    seedRandom: 20260101,
    epochMs: cycleEpoch(0.74),
    stageCode: `
      SEGMENTS = 40;
      RENDER_DISTANCE = 4;
      timeOfDay = Math.PI * 1.48;
      const yaw = 1.93;
      planeGroup.position.set(7825, 106, 3350);
      planeGroup.rotation.set(0, yaw, 0);
      updateChunks();
      const lhChunk = chunks.get('5,2');
      if (lhChunk && lhChunk.userData && lhChunk.userData.lighthouseBeam) {
        lhChunk.userData.lighthouseBeam.rotation.y = 1.15;
      }
      camera.position.set(
        7825 + Math.sin(yaw) * 41,
        118,
        3350 + Math.cos(yaw) * 41
      );
      camera.lookAt(7125, 96, 3638);
    `,
    mouseNorm: [-0.06, 0.0],
  },
  {
    // River valley: X = 1200, Z = 150 (0.03 South, 0.24 East)
    id: '05-rivers-sailboats',
    act: 1,
    source: {type: 'git', ref: 'c821520d'},
    badgeTop: 'PROTOTYPE · MAR 3, 2026',
    badgeSub: 'Meandering carved rivers, campfires & drifting sailboats',
    seconds: 4.5,
    showUi: false,
    seedRandom: 20260101,
    epochMs: cycleEpoch(0.68),
    stageCode: `
      const rz = typeof ChillFlightLogic !== 'undefined' && ChillFlightLogic.getRiverCenterZ
        ? ChillFlightLogic.getRiverCenterZ(1200, simplex)
        : 150;
      planeGroup.position.set(1200, 145, rz + 40);
      planeGroup.rotation.set(0, Math.PI / 2, 0);
      updateChunks();
      camera.position.set(1245, 162, rz + 40);
    `,
    mouseNorm: [-0.12, -0.02],
  },
  {
    // Southern desert bay & mesas: X = -800, Z = 4800 (0.96 South, 0.16 West)
    id: '06-landmarks-structures',
    act: 1,
    source: {type: 'git', ref: 'c5f4c94b'},
    badgeTop: 'PROTOTYPE · MAR 6, 2026',
    badgeSub: 'Pagodas, barns, monasteries, castle ruins & desert cacti',
    seconds: 4.5,
    showUi: false,
    epochMs: cycleEpoch(0.64),
    query: 'seed=20260101',
    stageCode: `
      const yaw = Math.PI * 0.85;
      planeGroup.position.set(-800, 345, 4800);
      planeGroup.rotation.set(0, yaw, 0);
      updateChunks();
      camera.position.set(
        -800 + Math.sin(yaw) * 45,
        362,
        4800 + Math.cos(yaw) * 45
      );
    `,
    mouseNorm: [0.15, -0.02],
  },
  {
    // Northern alpine range: X = -1500, Z = -9500 (1.90 North, 0.30 West)
    id: '07-shader-sky-peaks',
    act: 1,
    source: {type: 'git', ref: '4025e405'},
    badgeTop: 'PROTOTYPE · MAR 14, 2026',
    badgeSub: 'Custom sky-sphere shader & ridged alpine mountain ranges',
    seconds: 4.6,
    showUi: false,
    epochMs: cycleEpoch(0.73),
    query: 'seed=20260101',
    stageCode: `
      const h = ChillFlightLogic.getElevation(-1500, -9500, simplex, {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180});
      planeGroup.position.set(-1500, Math.max(520, h + 180), -9500);
      planeGroup.rotation.set(0, 0.35, 0);
      updateChunks();
    `,
    mouseNorm: [-0.16, 0.0],
  },

  // =========================================================================
  // ACT 2: Weather, shadows & finding the vibe (Mar 22 - Apr 29, 2026)
  // =========================================================================
  {
    // Coastal bay shoreline: X = 950, Z = 450 (0.09 South, 0.19 East)
    id: '08-experimental-craft',
    act: 2,
    source: {type: 'git', ref: '4278b7b8'},
    badgeTop: 'PROTOTYPE · MAR 22, 2026',
    badgeSub: 'Spring experiments: playable helicopters & boats over the bay',
    seconds: 4.5,
    showUi: false,
    epochMs: cycleEpoch(0.58),
    query: 'seed=20260101',
    stageCode: `
      if (typeof setVehicle === 'function') setVehicle('helicopter');
      const h = ChillFlightLogic.getElevation(950, 450, simplex, {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180});
      planeGroup.position.set(950, Math.max(155, h + 95), 450);
      planeGroup.rotation.set(0, 0.72, 0);
      if (typeof currentFlightSpeed !== 'undefined') currentFlightSpeed = 1.0;
      if (typeof flightSpeedMultiplier !== 'undefined') flightSpeedMultiplier = 1.2;
      updateChunks();
    `,
    mouseNorm: [0.18, 0.0],
  },
  {
    // Western lakes: X = -4500, Z = -2000 (0.40 North, 0.90 West)
    id: '09-weather-particles',
    act: 2,
    source: {type: 'git', ref: '66e6016d'},
    badgeTop: 'PROTOTYPE · MAR 25, 2026',
    badgeSub: 'Overcast storm skies, falling rain & GPU water waves',
    seconds: 4.6,
    showUi: false,
    epochMs: cycleEpoch(0.48),
    query: 'seed=20260101',
    stageCode: `
      if (typeof weatherType !== 'undefined') weatherType = 'rain';
      if (typeof rainParticles !== 'undefined' && rainParticles) {
        rainParticles.visible = true;
        rainParticles.material.opacity = 0.5;
      }
      const h = ChillFlightLogic.getElevation(-4500, -2000, simplex, {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180});
      planeGroup.position.set(-4500, Math.max(190, h + 120), -2000);
      planeGroup.rotation.set(0, 0.5, 0);
      updateChunks();
    `,
    mouseNorm: [-0.15, 0.0],
  },
  {
    // Mountain pass: X = -2200, Z = -8800 (1.76 North, 0.44 West)
    id: '10-shadows-fbm-clouds',
    act: 2,
    source: {type: 'git', ref: '2b19d443'},
    badgeTop: 'PROTOTYPE · MAR 28, 2026',
    badgeSub: 'Dynamic terrain shadows, FBM sky clouds & moon phases',
    seconds: 4.6,
    showUi: false,
    epochMs: cycleEpoch(0.63),
    query: 'seed=20260101',
    stageCode: `
      const h = ChillFlightLogic.getElevation(-2200, -8800, simplex, {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180});
      planeGroup.position.set(-2200, Math.max(460, h + 160), -8800);
      planeGroup.rotation.set(0, -0.45, 0);
      updateChunks();
    `,
    mouseNorm: [0.16, 0.0],
  },
  {
    // Foaming coastal bay shoreline: X = 2850, Z = 2100 (0.42 South, 0.57 East)
    id: '11-shore-foam-orbits',
    act: 2,
    source: {type: 'git', ref: '9160b199'},
    badgeTop: 'PROTOTYPE · APR 18, 2026',
    badgeSub: 'Shoreline water foam & realistic solar-lunar orbits',
    seconds: 4.5,
    showUi: false,
    epochMs: cycleEpoch(0.68),
    query: 'seed=20260101',
    stageCode: `
      const yaw = 0.55;
      planeGroup.position.set(2850, 220, 2100);
      planeGroup.rotation.set(0, yaw, 0);
      updateChunks();
      if (typeof camera !== 'undefined') {
        camera.position.set(
          2850 + Math.sin(yaw) * 45,
          236,
          2100 + Math.cos(yaw) * 45
        );
      }
    `,
    mouseNorm: [-0.12, 0.0],
  },
  {
    // Central river spawn: X = 0, Z = -800 (0.16 North, 0.00 East)
    id: '12-v080-purrple-cat',
    act: 2,
    source: {type: 'git', ref: '3c04986e'},
    badgeTop: 'V0.8.0 · APR 29, 2026',
    badgeSub: 'Purrple Cat lofi soundtrack & redesigned HUD',
    seconds: 4.8,
    showUi: true,
    epochMs: cycleEpoch(0.27),
    query: 'seed=20260101',
    stageCode: `
      const h = ChillFlightLogic.getElevation(0, -800, simplex, {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180});
      planeGroup.position.set(0, Math.max(220, h + 140), -800);
      planeGroup.rotation.set(0, 0.15, 0);
      updateChunks();
    `,
    mouseNorm: [0.14, 0.0],
  },

  // =========================================================================
  // ACT 3: The 0.8 and 0.9 leaps - sky, horizons & fleet (May 4 - Oct 8, 2026)
  // =========================================================================
  {
    // Southeastern headland bay: X = 4850, Z = 3450 (0.69 South, 0.97 East)
    id: '13-v081-water-fuselage',
    act: 3,
    source: {type: 'pages', version: '0.8.1'},
    badgeTop: 'V0.8.1 · MAY 4, 2026',
    badgeSub: 'Rounded fuselage, wing struts & dynamic water speculars',
    seconds: 4.5,
    showUi: false,
    epochMs: cycleEpoch(0.72),
    query: 'seed=20260101&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const h = ChillFlightLogic.getElevation(4850, 3450, simplex, {WATER_LEVEL: 40, MOUNTAIN_LEVEL: 180});
        planeGroup.position.set(4850, Math.max(165, h + 105), 3450);
        planeGroup.rotation.set(0, 0.78, 0);
        if (typeof updateChunks === 'function') updateChunks();
      }
    `,
    mouseNorm: [-0.16, 0.0],
  },
  {
    // Volcano approach: X = -3050, Z = 3450 (0.69 South, 0.61 West) toward
    // Volcano crater at X = -5000, Z = 5000 (1.00 South, 1.00 West)
    id: '14-v083-volcano-aurora',
    act: 3,
    source: {type: 'pages', version: '0.8.3'},
    badgeTop: 'V0.8.3 · MAY 10, 2026',
    badgeSub: 'Procedural basalt volcano landmark & aurora borealis shader',
    seconds: 4.7,
    showUi: false,
    epochMs: cycleEpoch(0.75),
    query: 'seed=20260101&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        planeGroup.position.set(-3050, 1340, 3450);
        planeGroup.rotation.set(-0.06, Math.PI * 0.68, 0);
        if (typeof updateChunks === 'function') updateChunks();
      }
      if (typeof skyUniforms !== 'undefined' && skyUniforms.uAuroraIntensity) {
        skyUniforms.uAuroraIntensity.value = 0.06;
      }
    `,
    mouseNorm: [0.12, 0.0],
  },
  {
    // Headland lighthouse coast: X = 5600, Z = 2800 (0.56 South, 1.12 East)
    id: '15-v0813-minimap',
    act: 3,
    source: {type: 'pages', version: '0.8.13'},
    badgeTop: 'V0.8.13 · MAY 24, 2026',
    badgeSub: 'Interactive procedural minimap & zen maple pagodas',
    seconds: 4.6,
    showUi: true,
    epochMs: cycleEpoch(0.58),
    query: 'seed=20260101&lat=0.56S&long=1.12E&alt=3400&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        planeGroup.rotation.y = -2.15;
      }
      if (!window.__evoMinimapShown) {
        window.__evoMinimapShown = true;
        window.dispatchEvent(new KeyboardEvent('keydown', {key: 'm', bubbles: true}));
      }
    `,
    mouseNorm: [-0.12, 0.0],
  },
  {
    // Sunset lakes under dual-layer 3D cloud deck: X = 2000, Z = -3000 (0.60 North, 0.40 East)
    id: '16-v0823-cinematic-clouds',
    act: 3,
    source: {type: 'pages', version: '0.8.23'},
    badgeTop: 'V0.8.23 · JUN 2, 2026',
    badgeSub: 'Volumetric sun bloom & dual-layer 3D sky clouds',
    seconds: 4.6,
    preroll: 3.5,
    showUi: false,
    epochMs: cycleEpoch(0.73),
    query:
      'seed=20260101&lat=0.60N&long=0.40E&alt=7500&tod=0.735&timeSpeed=0&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = 1.45;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
      if (typeof skyUniforms !== 'undefined') {
        if (skyUniforms.uShowClouds) skyUniforms.uShowClouds.value = true;
        if (skyUniforms.uCloudDensity) skyUniforms.uCloudDensity.value = 0.72;
      }
    `,
    mouseNorm: [0.12, 0.18],
  },
  {
    // Western lake district facing anti-solar East rainbow: X = -5500, Z = -500 (0.10 North, 1.10 West)
    id: '17-v0826-rainbows-geese',
    act: 3,
    source: {type: 'pages', version: '0.8.26'},
    badgeTop: 'V0.8.26 · JUN 4, 2026',
    badgeSub: 'Post-rain rainbows, Canada goose flocks & hollow sailboats',
    seconds: 4.6,
    preroll: 3.5,
    showUi: false,
    epochMs: cycleEpoch(0.68),
    query:
      'seed=20260101&lat=0.10N&long=1.10W&alt=9500&tod=0.69&timeSpeed=0&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = -Math.PI / 2;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
      if (typeof forceRainbow !== 'undefined') forceRainbow = true;
      if (typeof rainbowIntensity !== 'undefined') rainbowIntensity = 1.0;
    `,
    mouseNorm: [-0.08, 0.04],
  },
  {
    // Meadow hills: X = 1800, Z = 2200 (0.44 South, 0.36 East)
    id: '18-v090-rebuilt-models',
    act: 3,
    source: {type: 'pages', version: '0.9.0'},
    badgeTop: 'V0.9.0 · JUN 12, 2026',
    badgeSub: 'Rebuilt low-poly plane, farm silos, monasteries & castle ruins',
    seconds: 4.5,
    preroll: 3.5,
    showUi: false,
    epochMs: cycleEpoch(0.62),
    query:
      'seed=20260101&lat=0.44S&long=0.36E&alt=3600&tod=0.62&timeSpeed=0&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = 0.4;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
    `,
    mouseNorm: [0.16, 0.0],
  },
  {
    // Northern Arctic pack-ice sea channel: X = 650, Z = -20550 (4.11 North, 0.13 East)
    id: '19-v096-pack-ice-penguins',
    act: 3,
    source: {type: 'pages', version: '0.9.6'},
    badgeTop: 'V0.9.6 · JUL 7, 2026',
    badgeSub: 'Frozen pack-ice shelves, icebergs, penguins & northern aurora',
    seconds: 4.6,
    preroll: 3.5,
    showUi: false,
    epochMs: cycleEpoch(0.84),
    query:
      'seed=20260101&lat=4.11N&long=0.13E&alt=3600&tod=0.83&timeSpeed=0&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = -0.25;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
      if (typeof skyUniforms !== 'undefined' && skyUniforms.uAuroraIntensity) {
        skyUniforms.uAuroraIntensity.value = 0.085;
      }
    `,
    mouseNorm: [-0.14, 0.0],
  },
  {
    // Multi-lane highway bridge at dusk: X = -6650, Z = 450 (0.09 South, 1.33 West)
    id: '20-v098-highways-night',
    act: 3,
    source: {type: 'pages', version: '0.9.8'},
    badgeTop: 'V0.9.8 · JUL 19, 2026',
    badgeSub: 'Multi-lane highways with glowing streetlights & achievements',
    seconds: 4.6,
    preroll: 3.5,
    showUi: true,
    epochMs: cycleEpoch(0.81),
    query:
      'seed=20260101&lat=0.09S&long=1.33W&alt=2200&tod=0.815&timeSpeed=0&enableMp=false',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = -1.92;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
    `,
    mouseNorm: [-0.08, -0.03],
  },
  {
    // Alpine cirques & snowcaps: X = -3200, Z = -10200 (2.04 North, 0.64 West)
    id: '21-v0917-alpine-viaducts',
    act: 3,
    source: {type: 'pages', version: '0.9.17'},
    badgeTop: 'V0.9.17 · SEP 13, 2026',
    badgeSub: 'Overhauled alpine cirques, snowcaps & highway viaduct bridges',
    seconds: 4.6,
    preroll: 3.5,
    showUi: false,
    epochMs: cycleEpoch(0.32),
    query:
      'seed=20260101&lat=2.04N&long=0.64W&alt=11000&tod=0.31&timeSpeed=0&preset=ultra',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = 0.55;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
    `,
    mouseNorm: [-0.16, 0.0],
  },
  {
    // Towering karst limestone lagoon ring & Glider: X = 12600, Z = 7100 (1.42 South, 2.52 East)
    // approaching 527-unit karst spires around X = 14800, Z = 5500 (1.10 South, 2.96 East)
    id: '22-v0923-new-aircraft',
    act: 3,
    source: {type: 'pages', version: '0.9.23'},
    badgeTop: 'V0.9.23 · SEP 20, 2026',
    badgeSub:
      'Karst towers, coral atolls, world map & Biplane, Glider and Twin',
    seconds: 4.7,
    preroll: 3.5,
    showUi: false,
    epochMs: cycleEpoch(0.55),
    query:
      'seed=20260101&lat=1.42S&long=2.52E&alt=7200&tod=0.58&timeSpeed=0&plane=glider&preset=ultra',
    stageCode: `
      if (typeof planeGroup !== 'undefined') {
        const yaw = -0.88;
        planeGroup.rotation.set(0, yaw, 0);
        if (typeof camera !== 'undefined') {
          camera.position.set(
            planeGroup.position.x + Math.sin(yaw) * 45,
            planeGroup.position.y + 15,
            planeGroup.position.z + Math.cos(yaw) * 45
          );
        }
      }
    `,
    mouseNorm: [0.16, -0.02],
  },
  {
    // Sunset islands & reflective water: X = 12000, Z = 1000 (0.20 South, 2.40 East)
    id: '23-v0939-water-horizon',
    act: 3,
    source: {type: 'pages', version: '0.9.39'},
    badgeTop: 'V0.9.39 · SEP 28, 2026',
    badgeSub: 'Sky-reflecting turquoise water, sun glitter & 27 km horizon',
    seconds: 4.6,
    preroll: 3.0,
    showUi: false,
    query:
      'seed=20260101&start=1&ui=0&music=0&lat=0.20S&long=2.40E&alt=4200' +
      '&tod=0.745&timeSpeed=0&plane=biplane&preset=ultra',
    mouseNorm: [0.22, 0.0],
  },
  {
    // Sunrise western lakes with NPC traffic: X = -6500, Z = 500 (0.10 South, 1.30 West)
    id: '24-v0945-clouds-traffic',
    act: 3,
    source: {type: 'pages', version: '0.9.45'},
    badgeTop: 'V0.9.45 · OCT 8, 2026',
    badgeSub: 'Cumulus & mackerel skies, autumn woods & NPC air traffic',
    seconds: 4.6,
    preroll: 3.0,
    showUi: false,
    query:
      'seed=20260101&start=1&ui=0&music=0&lat=0.10S&long=1.30W&heading=-80' +
      '&tod=0.265&timeSpeed=0&livery=coral&cloudMood=busy&traffic=1&preset=ultra' +
      '&clock=1790000000000&cloudTime=500&adaptive=0',
    mouseNorm: [-0.15, 0.0],
  },

  // =========================================================================
  // ACT 4: 1.0 to 1.2.10 - a living world (Oct 14 - Nov 14, 2026)
  // =========================================================================
  {
    // Twin Falls pass: X = 0, Z = -4500 (0.90 North, 0.00 East) on seed=20269089 (clean sheer basalt cliff)
    id: '25-v100-airports-falls',
    act: 4,
    source: {type: 'pages', version: '1.0.0'},
    badgeTop: 'V1.0.0 · OCT 14, 2026',
    badgeSub: 'Twin Falls, deep canyons, 8 airfields & island resident jobs',
    seconds: 4.7,
    showUi: false,
    query:
      `${MODERN_COMMON.replace('seed=20260101', 'seed=20269089')}&ui=0&x=25&y=315&z=-4320&heading=180&speed=1&tod=0.285` +
      '&livery=coral&camOffset=16,28,-78&camLook=-4,16,55&cloudMood=busy',
    mouseNorm: [-0.18, 0.02],
  },
  {
    // Meadow Field approach in painted anime style: X = 1500, Z = 2400 (0.48 South, 0.30 East)
    id: '26-v100-anime-style',
    act: 4,
    source: {type: 'pages', version: '1.0.0'},
    badgeTop: 'V1.0.0 · OCT 14, 2026',
    badgeSub: 'Painted anime art style toggle & lit airfield runways',
    seconds: 4.7,
    showUi: true,
    query:
      `${MODERN_COMMON}&ui=1&style=anime&x=2150&y=155&z=2400&heading=90` +
      '&speed=0.95&tod=0.735&plane=biplane&livery=teal&cloudMood=mackerel',
    mouseNorm: [0.08, -0.02],
  },
  {
    // Red-Rock Canyon river S-bend jet run: X = 6265, Z = 15836 (3.17 South, 1.25 East)
    // carving along the turquoise river bend to X = 7513, Z = 16663 (3.33 South, 1.50 East)
    id: '27-v111-canyon-jet',
    act: 4,
    source: {type: 'pages', version: '1.1.1'},
    badgeTop: 'V1.1.1 · OCT 19, 2026',
    badgeSub: 'Swept-wing jet, highway towns, sound effects & spray wakes',
    seconds: 4.8,
    sheetSec: 2.2,
    showUi: false,
    preroll: 2.5,
    query:
      `${MODERN_COMMON}&ui=0&x=6265&y=175&z=14968&heading=180&speed=2.3` +
      '&tod=0.69&plane=jet&livery=coral&camOffset=0,25,54&camLook=0,-18,-130&cloudMood=high',
    timedActions: [
      {
        atSec: 0.0,
        code: `
          window.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true}));
          window.dispatchEvent(new KeyboardEvent('keyup', {code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true}));
        `,
      },
      {
        atSec: 0.04,
        code: `window.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true}));`,
      },
      {
        atSec: 0.94,
        code: `window.dispatchEvent(new KeyboardEvent('keyup', {code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true}));`,
      },
      {
        atSec: 1.4,
        code: `window.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowRight', key: 'ArrowRight', bubbles: true}));`,
      },
      {
        atSec: 3.0,
        code: `window.dispatchEvent(new KeyboardEvent('keyup', {code: 'ArrowRight', key: 'ArrowRight', bubbles: true}));`,
      },
      {
        atSec: 4.1,
        code: `window.dispatchEvent(new KeyboardEvent('keydown', {code: 'ArrowRight', key: 'ArrowRight', bubbles: true}));`,
      },
    ],
  },
  {
    // Three Great Pyramids & southwestern desert dunes: X = -9750, Z = 21000 (4.20 South, 1.95 West)
    id: '28-v121-pyramids-desert',
    act: 4,
    source: {type: 'pages', version: '1.2.1'},
    badgeTop: 'V1.2.1 · OCT 25, 2026',
    badgeSub: 'Three Great Pyramids, desert dunes, mesas & dune buggy',
    seconds: 4.8,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=-7950&y=460&z=21650&heading=72&speed=1&tod=0.71` +
      '&plane=biplane&livery=gold&camOffset=-32,12,42&camLook=18,-18,-80&cloudMood=high',
    moves: [
      [0, -10, 0],
      [1.5, -24, 2],
      [4.8, -12, 3],
    ],
  },
  {
    // Multiplayer with bot pilots & aerial ring races over island bays: X = 7200, Z = 3600 (0.72 South, 1.44 East)
    id: '28b-v122-bots-ring-race',
    act: 4,
    source: {type: 'pages', version: '1.2.2'},
    badgeTop: 'V1.2.2 · OCT 27, 2026',
    badgeSub: 'Multiplayer with bot pilots, livery smoke & aerial ring races',
    seconds: 5.4,
    preroll: 3.9,
    sheetSec: 1.5,
    showUi: true,
    query:
      `${MODERN_COMMON}&ui=1&x=7200&y=280&z=3600&heading=140&speed=1.1` +
      '&tod=0.62&plane=biplane&livery=coral&smoke=1&cloudMood=fair',
    afterSettleCode: `
      document.getElementById('fly-bots-btn')?.click();
      document.getElementById('fly-tag-btn')?.click();
      document.getElementById('fly-game-race')?.click();
    `,
    moves: [
      [0, 0, 0],
      [1.8, -8, 1],
      [3.8, 10, 1],
      [5.4, 0, 0],
    ],
  },
  {
    // Dune buggy smashing straight through a row of market-town houses with roofs & chimneys popping off,
    // then powersliding onto the multi-lane highway: X = -5403, Z = 769 (0.15 South, 1.08 West)
    id: '29-v123-roof-smash',
    act: 4,
    source: {type: 'pages', version: '1.2.3'},
    badgeTop: 'V1.2.3 · OCT 28, 2026',
    badgeSub: 'Destructible buildings & trees: roofs pop right off on impact',
    seconds: 5.2,
    preroll: 2.0,
    sheetSec: 0.9,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=-5688&y=158&z=503&heading=-133&plane=buggy` +
      '&livery=coral&speed=1.1&tod=0.60&camOffset=-8,9,28&camLook=2,4,-28&cloudMood=fair',
    timedActions: [
      {
        // Hold full throttle as the buggy charges across the grass onto the 4-lane highway.
        atSec: 2.2,
        code: `
          window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowUp', code: 'ArrowUp', bubbles: true}));
        `,
      },
      {
        // Once squarely on the 4-lane asphalt, double-tap + hold ArrowLeft to powerslide onto the highway heading.
        atSec: 3.16,
        code: `
          window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true}));
        `,
      },
      {
        atSec: 3.22,
        code: `
          window.dispatchEvent(new KeyboardEvent('keyup', {key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true}));
        `,
      },
      {
        atSec: 3.28,
        code: `
          window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true}));
        `,
      },
      {
        // Release drift and snap a brief counter-steer so the buggy stays dead-center on the 4-lane main highway.
        atSec: 3.5,
        code: `
          window.dispatchEvent(new KeyboardEvent('keyup', {key: 'ArrowLeft', code: 'ArrowLeft', bubbles: true}));
          window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', code: 'ArrowRight', bubbles: true}));
        `,
      },
      {
        atSec: 3.66,
        code: `
          window.dispatchEvent(new KeyboardEvent('keyup', {key: 'ArrowRight', code: 'ArrowRight', bubbles: true}));
        `,
      },
    ],
  },
  {
    // Grand sea arch pass: X = 8711, Z = 7660 (1.53 South, 1.74 East)
    id: '30-v124-arches-races',
    act: 4,
    source: {type: 'pages', version: '1.2.4'},
    badgeTop: 'V1.2.4 · OCT 30, 2026',
    badgeSub: 'Natural sea arches, canyon bridges, ring races & crash physics',
    seconds: 4.8,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=8420&y=115&z=8160&heading=-30&speed=1&tod=0.36` +
      '&plane=twin&livery=teal&camOffset=12,-4,48&camLook=0,6,-80&cloudMood=fair',
    moves: [
      [0, 0, 0],
      [1.4, 0, 0],
      [3.0, -18, 2],
      [6.0, -6, 2],
    ],
  },
  {
    // NPC resident Ray offering a coffee delivery job at Meadow Field: X = 1615, Z = 2400 (0.48 South, 0.32 East)
    id: '30c-v124-airport-jobs',
    act: 4,
    source: {type: 'pages', version: '1.2.4'},
    badgeTop: 'V1.2.4 · OCT 30, 2026',
    badgeSub: 'Island residents at airfields offering delivery jobs',
    seconds: 5.6,
    preroll: 1.2,
    sheetSec: 2.2,
    showUi: true,
    query:
      `${MODERN_COMMON}&ui=1&jobs=reset&x=1615&y=55&z=2400&heading=90&speed=0` +
      '&tod=0.64&plane=biplane&livery=coral&camOffset=16,10,38&camLook=-24,4,-65&cloudMood=fair',
    timedActions: [
      {
        // Skip the two intro greeting boxes straight onto Ray's coffee-bean job offer.
        atSec: 0.03,
        code: `
          const dlg = document.getElementById('npc-dialog');
          if (dlg && !dlg.hidden) {
            dlg.click();
            dlg.click();
            dlg.click();
            dlg.click();
          }
        `,
      },
      {
        // Finish typing the offer question so [Sure thing] / [Not right now] show clearly.
        atSec: 1.5,
        code: `
          const dlg = document.getElementById('npc-dialog');
          const choices = document.getElementById('npc-dialog-choices');
          if (dlg && !dlg.hidden && choices && choices.hidden) {
            for (let k = 0; k < 4 && choices.hidden; k++) dlg.click();
          }
        `,
      },
      {
        // Accept the job so Ray celebrates and the golden waypoint + cargo HUD appear.
        atSec: 3.3,
        code: `
          document.querySelector('[data-choice="yes"]')?.click();
        `,
      },
    ],
  },
  {
    // Meadow village, swaying grass, farmsteads & headland coast: X = 1785, Z = 1950 (0.39 South, 0.36 East)
    id: '31-v126-wildlife-grass',
    act: 4,
    source: {type: 'pages', version: '1.2.6'},
    badgeTop: 'V1.2.6 · NOV 3, 2026',
    badgeSub: 'Whales, dolphins, ghost galleon, swaying grass & 8 languages',
    seconds: 4.8,
    settleMs: 4500,
    preroll: 4.5,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=1785&y=114&z=1950&heading=46&speed=0.95&tod=0.68` +
      '&plane=biplane&livery=teal&camOffset=-16,10,38&camLook=2,-4,-60&cloudMood=mackerel',
    moves: [
      [0, 4, 0],
      [2.4, 8, 2],
      [4.8, -6, 2],
    ],
  },
  {
    // Modern Headland Lighthouse at dusk with rotating beam & crescent moon: X = 7500, Z = 3000 (0.60 South, 1.50 East)
    id: '31b-v126-latest-lighthouse',
    act: 4,
    source: {type: 'pages', version: '1.2.6'},
    badgeTop: 'V1.2.6 · NOV 3, 2026',
    badgeSub: 'Rebuilt headland lighthouse, rotating warm beam & crescent moon',
    seconds: 5.2,
    settleMs: 2500,
    preroll: 1.5,
    sheetSec: 1.4,
    showUi: false,
    query:
      'seed=20260101&start=1&ui=0&music=0&hints=0&preset=ultra&timeSpeed=0' +
      '&clock=1790000000000&cloudTime=500&fps=0&adaptive=0&traffic=1&xmas=off' +
      '&x=7960&y=105&z=3210&heading=75&speed=1&tod=0.785&headlight=1' +
      '&plane=biplane&livery=teal&camOffset=-48,-4,28&camLook=8,8,-50&cloudMood=mackerel',
    moves: [
      [0, 8, 0],
      [1.5, 22, 2],
      [5.2, -12, 2],
    ],
  },
  {
    // South-central bayou swamp & 272-unit Giant Silver Ghost Oak: X = -10146, Z = 8878 (1.78 South, 2.03 West)
    id: '32a-v128-swamp-bayou',
    act: 4,
    source: {type: 'pages', version: '1.2.8'},
    badgeTop: 'V1.2.8 · NOV 8, 2026',
    badgeSub: 'Bayou swamp channels, Spanish moss, mist, fireflies & ghost oak',
    seconds: 5.0,
    settleMs: 2500,
    preroll: 1.5,
    sheetSec: 1.5,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=-9760&y=205&z=9220&heading=15&speed=0.9&tod=0.755` +
      '&plane=seaplane&livery=gold&camOffset=30,14,40&camLook=-45,-12,-60&cloudMood=mixed',
    moves: [
      [0, -8, 0],
      [2.5, -14, 2],
      [5.0, 4, 2],
    ],
  },
  {
    // Northern tundra Dragon Skeleton landmark & hollow snow: X = -12000, Z = -16500 (3.30 North, 2.40 West)
    id: '32b-v128-dragon-skeleton',
    act: 4,
    source: {type: 'pages', version: '1.2.8'},
    badgeTop: 'V1.2.8 · NOV 8, 2026',
    badgeSub: 'Northern tundra dragon skeleton landmark & steady hollow snow',
    seconds: 4.8,
    settleMs: 2500,
    preroll: 1.5,
    sheetSec: 1.4,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=-11520&y=335&z=-16080&heading=28&speed=0.9&tod=0.36` +
      '&plane=twin&livery=coral&camOffset=28,22,46&camLook=-38,-26,-70&cloudMood=high',
    moves: [
      [0, -6, 1],
      [2.4, -10, 1],
      [4.8, 0, 1],
    ],
  },
  {
    // Eastern alien basalt honeycomb plateaus & mushroom groves: X = 73520, Z = -11420 (2.28 North, 14.70 East)
    id: '32-v128-alien-mushrooms',
    act: 4,
    source: {type: 'pages', version: '1.2.8'},
    badgeTop: 'V1.2.8 · NOV 8, 2026',
    badgeSub:
      'Eastern basalt honeycomb plateaus, mushroom groves & rainbow trip',
    seconds: 4.8,
    settleMs: 3500,
    showUi: false,
    preroll: 4.2,
    sheetSec: 2.0,
    query:
      `${MODERN_COMMON}&ui=0&x=73520&y=715&z=-11420&heading=25&speed=1.05&tod=0.53` +
      '&plane=seaplane&livery=gold&trip=1&camOffset=30,22,78&camLook=-6,-10,-22&cloudMood=busy',
    afterSettleCode: `
      const press = (type, key) =>
        window.dispatchEvent(new KeyboardEvent(type, {key, code: key, bubbles: true}));
      const t0 = performance.now();
      let phase = -1;
      const weave = () => {
        const sec = (performance.now() - t0) / 1000;
        const next = sec < 2.0 ? 0 : sec < 4.2 ? 1 : sec < 6.4 ? 2 : sec < 8.4 ? 3 : 4;
        if (next !== phase) {
          phase = next;
          press('keyup', 'ArrowLeft');
          press('keyup', 'ArrowRight');
          if (phase === 0 || phase === 2) press('keydown', 'ArrowLeft');
          else if (phase === 1 || phase === 3) press('keydown', 'ArrowRight');
        }
        if (sec < 9.2) requestAnimationFrame(weave);
      };
      requestAnimationFrame(weave);
    `,
  },
  {
    // Western alien neon-magenta spires & crystal fields: X = -61050, Z = 200 (0.04 South, 12.21 West)
    id: '32c-v128-crystal-rush',
    act: 4,
    source: {type: 'pages', version: '1.2.8'},
    badgeTop: 'V1.2.8 · NOV 8, 2026',
    badgeSub:
      'Western alien neon-magenta crystal spires & glowing crystal fields',
    seconds: 5.2,
    settleMs: 8000,
    preroll: 2.0,
    sheetSec: 1.4,
    showUi: false,
    query:
      `${MODERN_COMMON}&ui=0&x=-61050&y=760&z=200&heading=90&speed=0.70&tod=0.58` +
      '&plane=biplane&livery=gold&smoke=1&camOffset=-28,16,44&camLook=24,-22,-75&cloudMood=busy',
    moves: [
      [0, -4, 1],
      [2.5, 4, 1],
      [5.2, 0, 1],
    ],
  },
  {
    // Fullscreen interactive world map zooming smoothly from whole world into central island:
    // X = 750, Z = 1250 (0.25 South, 0.15 East)
    id: '32d-v128-world-map',
    act: 4,
    source: {type: 'pages', version: '1.2.8'},
    badgeTop: 'V1.2.8 · NOV 8, 2026',
    badgeSub:
      'World map with continent shapes, 8 airfields, landmarks & waypoints',
    seconds: 4.6,
    settleMs: 6000,
    preroll: 1.0,
    sheetSec: 2.3,
    showUi: true,
    query:
      `${MODERN_COMMON}&ui=1&lat=0.20S&long=2.40E&heading=180&tod=0.52` +
      '&fullscreenmap=1&mapLat=0.25S&mapLong=0.15E&mapZoom=56000&waypoint=4.20S,1.95W&cloudMood=fair',
    timedActions: [
      {
        atSec: 0.03,
        code: `
          const cv = document.getElementById('fullscreen-map-canvas') || document.querySelector('canvas#world-map');
          if (cv) {
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            const startSpan = 40;
            const zoomFactor = 9.5;
            cv.dispatchEvent(new PointerEvent('pointerdown', {
              pointerId: 1, clientX: cx - startSpan, clientY: cy, pointerType: 'touch', bubbles: true,
            }));
            cv.dispatchEvent(new PointerEvent('pointerdown', {
              pointerId: 2, clientX: cx + startSpan, clientY: cy, pointerType: 'touch', bubbles: true,
            }));
            const t0 = performance.now();
            const stepZoom = () => {
              const elapsed = performance.now() - t0;
              const u = Math.min(1, Math.max(0, (elapsed - 250) / 4000));
              const ease = 0.5 - 0.5 * Math.cos(Math.PI * u);
              const span = startSpan * Math.pow(zoomFactor, ease);
              cv.dispatchEvent(new PointerEvent('pointermove', {
                pointerId: 1, clientX: cx - span, clientY: cy, pointerType: 'touch', bubbles: true,
              }));
              cv.dispatchEvent(new PointerEvent('pointermove', {
                pointerId: 2, clientX: cx + span, clientY: cy, pointerType: 'touch', bubbles: true,
              }));
              if (elapsed < 4500) requestAnimationFrame(stepZoom);
            };
            requestAnimationFrame(stepZoom);
          }
        `,
      },
    ],
  },
  {
    // Stormy archipelago & ocean whitecaps: X = 8200, Z = 4600 (0.92 South, 1.64 East)
    id: '33-v129-storm-lightning',
    act: 4,
    source: {type: 'pages', version: '1.2.9'},
    badgeTop: 'V1.2.9 · NOV 12, 2026',
    badgeSub: 'Forked lightning, breaking ocean whitecaps, radio masts & VR',
    seconds: 5.4,
    preroll: 3.8,
    showUi: false,
    hasFarReady: true,
    lightningFrames: [24, 105],
    query:
      `${MODERN_COMMON}&ui=0&x=8200&y=245&z=4600&heading=155&speed=1.15` +
      '&tod=0.755&weather=rain&cloud=overcast&plane=jet&livery=slate' +
      '&camOffset=-14,10,40&camLook=2,-2,-80',
    moves: [
      [0, -14, 0],
      [2.5, 18, 2],
      [6.0, -8, 1],
    ],
  },
  {
    // Christmas village beside Pinewood Field: X = -4750, Z = -17950 (3.59 North, 0.95 West)
    id: '34-v1210-xmas-village',
    act: 4,
    source: {type: 'current'},
    badgeTop: 'V1.2.10 · NOV 14, 2026',
    badgeSub: 'Christmas village beside Pinewood Field & 31 Purrple Cat albums',
    seconds: 5.4,
    showUi: true,
    hasFarReady: true,
    query:
      'seed=20260101&start=1&ui=1&music=0&hints=0&preset=ultra&timeSpeed=0' +
      '&clock=1790000000000&cloudTime=500&fps=0&adaptive=0&traffic=0' +
      '&xmas=full&xmasDay=25&x=-4320&y=195&z=-17520&heading=45&speed=0.85' +
      '&tod=0.795&headlight=1&plane=biplane&livery=coral&cloudMood=high',
    moves: [
      [0, 6, -2],
      [2.5, 14, 0],
      [6.2, -8, 2],
    ],
  },

  // =========================================================================
  // ACT 5: Full-circle Day 1 -> Today hard match-cut (5.0 s + 7.5 s)
  // =========================================================================
  {
    // Day 1 reprise: X = 0, Z = 0 (0.00 North, 0.00 East), banking +18 deg left
    // on the original (0, 15, 45) -> (0, 0, -20) chase camera, then hard-cutting
    // straight into v1.2.10 at the exact same camera offset and bank angle.
    id: '35-callback-day1',
    act: 5,
    source: {type: 'git', ref: '88d428c4', entry: 'games/chill-flight.html'},
    badgeTop: 'DAY 1 · FEB 25, 2026',
    badgeSub: 'Where the flight began',
    seconds: 5.0,
    transition: 'cut',
    showUi: false,
    seedRandom: 20260225,
    epochMs: cycleEpoch(0.5),
    stageCode: `
      planeGroup.position.set(0, 195, 0);
      planeGroup.rotation.set(0, 0, 0);
      updateChunks();
      camera.position.set(0, 210, 45);
      camera.lookAt(0, 195, -20);
    `,
    mouseNorm: [-0.3, 0.0],
  },
  {
    // Matched v1.2.10 sunrise over Twin Falls & central river:
    // X = 140, Z = -3550 (0.71 North, 0.03 East) approaching X = 0, Z = -4500
    // (0.90 North, 0.00 East) with camOffset=0,15,45&camLook=0,0,-20 and +18 deg
    // initial bank so the plane matches Shot 35's screen pose across the cut.
    id: '36-callback-today',
    act: 5,
    source: {type: 'current'},
    badgeTop: 'TODAY · V1.2.10 · NOV 2026',
    badgeSub: '2,360+ commits later - have a chill flight',
    seconds: 7.5,
    showUi: false,
    hasFarReady: true,
    query:
      `${MODERN_COMMON}&ui=0&x=140&y=330&z=-3550&heading=8&speed=1.05` +
      '&tod=0.275&livery=coral&camOffset=0,15,45&camLook=0,0,-20&cloudMood=busy',
    moves: [
      [0, 18, 0],
      [1.8, 16, 2],
      [4.5, -18, 3],
      [7.0, 6, 2],
      [7.5, 0, 2],
    ],
  },
];
