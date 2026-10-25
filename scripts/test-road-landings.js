#!/usr/bin/env node
/**
 * scripts/test-road-landings.js
 *
 * Lands each plane on the highways and checks the ride (issue #154): on open
 * road, on a viaduct high over a valley, on the cross-country highway, at a
 * junction, rolling across a highway from the field beside it, and at a
 * highway's end. Also warps away while parked. Runs the game's own flight
 * physics in the dev server (npm run dev), paused and stepped a frame at a
 * time, and fails on:
 * - a jump: the plane's height changing more than MAX_STEP in one frame
 *   while on its wheels or just after (a pop, or a drop through the deck)
 * - a bounce: the wheels leaving the ground more than MAX_BOUNCES times
 * - not ending up stopped on its wheels
 * - a warp from the ground not arriving at the height it was sent to
 *
 * Usage: npm run dev, then npm run test:road-landings
 * (PLANES=jet,biplane to pick planes; CHROME_PATH as for scripts/shot.js)
 */
import {launch, openGame} from './dev-browser.js';

const SEED = 20261025;
const PLANES = (process.env.PLANES || 'biplane,seaplane,twin,jet').split(',');
const MAX_STEP = 3; // units a frame (about 1.5 m)
const MAX_BOUNCES = 2;

console.log('Testing road landings...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    console.error(`  FAILED: ${name}${detail ? `: ${detail}` : ''}`);
    failed = true;
  }
}

const browser = await launch();
for (const plane of PLANES) {
  const page = await openGame(browser, `seed=${SEED}&plane=${plane}`, {
    width: 640,
    height: 400,
    settleMs: 1000,
  });
  const results = await page.evaluate(async () => {
    const {state} = await window.gameModule('state.js');
    const {planeGroup, planeHandling} = await window.gameModule('airplane.js');
    const {updateFlightPhysics, isOnWheels} =
      await window.gameModule('flight-physics.js');
    const {sampleRoad, updateChunks} =
      await window.gameModule('terrain-chunks.js');
    const {getElevation} = await window.gameModule('terrain-geometry.js');
    const {hooks} = await window.gameModule('hooks.js');
    const {ChillFlightLogic: L} = await window.gameModule(
      'chill-flight-logic.js'
    );
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    state.isPaused = true;
    const road = {height: 0, slopeX: 0, slopeZ: 0};

    // Loads the chunks around (x, z), with their roads
    async function loadAt(x, z) {
      planeGroup.position.set(x, 2000, z);
      for (let i = 0; i < 100; i++) {
        updateChunks();
        await sleep(100);
        if (state.chunkQueue.length === 0 && i > 5) break;
      }
    }
    // The surface under (x, z): the highway deck if there's one, else the
    // ground
    const surfaceAt = (x, z) =>
      sampleRoad(x, z, road) ? road.height : getElevation(x, z);

    // One landing: from (x, z) heading along (fx, fz), 12 units over the
    // surface at a little above stall speed, for 15 s
    function land(x, z, fx, fz) {
      const kts = planeHandling().stallKts + 15;
      planeGroup.position.set(x, Math.max(40, surfaceAt(x, z)) + 12, z);
      planeGroup.rotation.set(0, Math.atan2(-fx, -fz), 0);
      state.flightSpeedMultiplier = state.targetFlightSpeed = kts / 150;
      state.verticalVelocity = 0;
      state.gearWanted = true;
      state.gearExtension = 1;
      let touched = false;
      let bounces = 0;
      let wasOn = false;
      let worst = 0;
      let lastY = planeGroup.position.y;
      for (let f = 0; f < 900; f++) {
        state._nextYaw = planeGroup.rotation.y;
        updateFlightPhysics(1 / 60, 1000 + (f * 1000) / 60);
        const on = isOnWheels();
        const y = planeGroup.position.y;
        if (on) touched = true;
        if (touched && Math.abs(y - lastY) > Math.abs(worst)) worst = y - lastY;
        if (wasOn && !on) bounces++;
        wasOn = on;
        lastY = y;
      }
      return {
        touched,
        bounces,
        worst: +worst.toFixed(2),
        stopped: isOnWheels() && state.flightSpeedMultiplier < 0.01,
      };
    }

    // Along highway n (or the cross-country one, n = 'ew') through (x, z),
    // from 500 back; `across` comes in from 300 to the side instead
    function direction(n, x, z) {
      if (n === 'ew') {
        const dz = L.getRoadCenterZ(x + 20) - L.getRoadCenterZ(x - 20);
        const len = Math.hypot(40, dz);
        return [40 / len, dz / len];
      }
      const dx = L.getRoadCenterX(z + 20, n) - L.getRoadCenterX(z - 20, n);
      const len = Math.hypot(dx, 40);
      return [dx / len, 40 / len];
    }
    async function onRoad(name, n, x, z, how = 'along') {
      let [fx, fz] = direction(n, x, z);
      if (how === 'north') [fx, fz] = [-fx, -fz];
      if (how === 'across') [fx, fz] = [fz, -fx];
      const back = how === 'across' ? 300 : 500;
      await loadAt(x, z);
      return {name, ...land(x - fx * back, z - fz * back, fx, fz)};
    }

    const out = [];
    const h0 = (z) => L.getRoadCenterX(z, 0);
    out.push(await onRoad('highway, open road', 0, h0(-12000), -12000));
    out.push(await onRoad('highway, on a viaduct', 0, h0(14000), 14000));
    const ewX = -20000;
    out.push(
      await onRoad('cross-country highway', 'ew', ewX, L.getRoadCenterZ(ewX))
    );
    const jx = h0(L.getRoadCenterZ(h0(0)));
    out.push(await onRoad('a junction', 0, jx, L.getRoadCenterZ(jx) - 600));
    out.push(
      await onRoad('across the highway', 0, h0(-12000), -12000, 'across')
    );
    out.push(await onRoad('the highway end', 0, h0(-23600), -23600, 'north'));

    // Parked at an airfield, then warped 400 up somewhere else
    const field = L.AIRPORTS.find((a) => a.name === 'Mesa Field');
    await loadAt(field.x, field.z);
    const p = planeGroup.position;
    p.set(field.x, getElevation(field.x, field.z) + 3, field.z);
    state.flightSpeedMultiplier = state.targetFlightSpeed = 0;
    for (let f = 0; f < 60; f++) updateFlightPhysics(1 / 60, f * 16);
    const parked = isOnWheels();
    const tx = field.x + 2000;
    const tz = field.z + 2000;
    const sentTo = getElevation(tx, tz) + 400;
    hooks.movePlane(tx, sentTo, tz, undefined, 0.6);
    updateFlightPhysics(1 / 60, 1000);
    const warp = {parked, drop: +(sentTo - p.y).toFixed(1)};
    return {landings: out, warp};
  });
  console.log(`${plane}:`);
  for (const r of results.landings) {
    check(
      `${plane} lands ${r.name}`,
      r.touched &&
        Math.abs(r.worst) <= MAX_STEP &&
        r.bounces <= MAX_BOUNCES &&
        r.stopped,
      `touched ${r.touched}, worst step ${r.worst}, bounces ${r.bounces}, stopped ${r.stopped}`
    );
  }
  check(
    `${plane} warps from the ground to where it was sent`,
    results.warp.parked && Math.abs(results.warp.drop) < 2,
    `parked ${results.warp.parked}, ${results.warp.drop} units short`
  );
  // Not counting resources that couldn't be fetched (offline, say)
  const errors = page.errors.filter((e) => !e.includes('Failed to load'));
  if (errors.length) {
    check(`${plane} runs without errors`, false, errors.join('; '));
  }
  await page.close();
}
await browser.close();

if (failed) {
  console.error('Road landing tests failed.');
  process.exit(1);
}
console.log('All road landing tests passed.');
