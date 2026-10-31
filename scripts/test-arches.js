#!/usr/bin/env node
/**
 * scripts/test-arches.js
 *
 * Checks the arches to fly under (arches-logic.js) for one world: each kind
 * is found, each opening is clear to fly through with the underside a
 * ceiling over it, the top is the ground above it, a wingtip at its side is
 * pushed off sideways (wall-scrape-logic.js), the legs stand solid in the
 * water, the canyon's bridges end in its walls and the basalt columns lie on
 * their tops.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {simplex} from '../noise.js';
import {
  ARCH,
  archCeiling,
  archGround,
  archSites,
  archTop,
  solidAt,
} from '../arches-logic.js';
import {wallContact} from '../wall-scrape-logic.js';

const SEED = 20260101;
const WATER = 40;
ChillFlightLogic.WORLD_SEED = SEED;
simplex.seed(SEED);
const E = (x, z) =>
  ChillFlightLogic.getElevation(x, z, simplex, {WATER_LEVEL: WATER});

console.log('Testing arches...');

let failed = false;
function check(ok, message) {
  if (!ok) {
    console.error(`  ✗ ${message}`);
    failed = true;
  }
}

const arches = archSites(simplex, {WATER_LEVEL: WATER});
const kinds = (kind) => arches.filter((a) => a.kind === kind);

// --- 1. Found ---
for (const kind of ['sea', 'canyon', 'basalt']) {
  check(kinds(kind).length > 0, `no ${kind} arch in world ${SEED}`);
}
check(
  archSites(simplex, {WATER_LEVEL: WATER}) === arches,
  'not worked out once'
);
for (const a of arches) {
  for (const b of arches) {
    if (a !== b && a.kind === b.kind) {
      check(
        Math.hypot(a.x - b.x, a.z - b.z) >= ARCH.SPACING,
        `two ${a.kind} arches too close at (${a.x}, ${a.z})`
      );
    }
  }
}
console.log(
  `  Passed: ${kinds('sea').length} sea arches, ${kinds('canyon').length} canyon bridges, ${kinds('basalt').length} basalt gates`
);

// A point on `arch` at (u, v) in its own space
const at = (arch, u, v) => ({
  x: arch.x + u * arch.ux - v * arch.uz,
  z: arch.z + u * arch.uz + v * arch.ux,
});
// The u with the most room under it, and its underside there
function crown(arch) {
  let best = null;
  for (let i = 0; i < arch.under.length; i++) {
    const u = arch.uMin + i * ARCH.STEP;
    const p = at(arch, u, 0);
    const room = arch.under[i] - Math.max(WATER, E(p.x, p.z));
    if (!best || room > best.room) best = {u, under: arch.under[i], room};
  }
  return best;
}

// --- 2. Through, under and over ---
const out = {};
for (const arch of arches) {
  const c = crown(arch);
  const p = at(arch, c.u, 0);
  const name = `${arch.kind} arch at (${Math.round(arch.x)}, ${Math.round(arch.z)})`;
  check(solidAt(arch, p.x, p.z, out), `${name}: not over its crown`);
  // Room to fly under it, over the ground or water
  const floor = Math.max(WATER, E(p.x, p.z));
  check(c.under - floor > 40, `${name}: only ${c.under - floor} under it`);
  // Under it, the underside is a ceiling and nothing raises the ground
  const y = c.under - 15;
  check(
    Math.abs(archCeiling(arches, p.x, p.z, y) - c.under) < 0.5,
    `${name}: no ceiling under it`
  );
  const ground = {height: floor, slopeX: 0, slopeZ: 0};
  check(!archGround(arches, p.x, p.z, y, ground), `${name}: ground under it`);
  // A little into the underside, still under it
  check(
    archCeiling(arches, p.x, p.z, c.under + ARCH.CEILING_CATCH - 1) !== null,
    `${name}: bumping the underside is not under it`
  );
  // Above, the top is the ground
  const top = archTop(arches, p.x, p.z);
  check(top > c.under, `${name}: top below the underside`);
  const above = {height: floor, slopeX: 0, slopeZ: 0};
  check(
    archGround(arches, p.x, p.z, top + 5, above) &&
      Math.abs(above.height - top) < 1e-6,
    `${name}: its top is not the ground above it`
  );
  check(
    archCeiling(arches, p.x, p.z, top + 5) === null,
    `${name}: ceiling over it`
  );
  // Clear of it, out past its side, nothing
  const off = at(arch, c.u, Math.max(...arch.depth) * 1.5 + 30);
  check(
    archTop(arches, off.x, off.z) === -Infinity,
    `${name}: rock out past its side`
  );

  // --- 3. Its side is a wall ---
  // A wingtip 2 units into the side, low on the slab, is pushed out the
  // way it came
  const mid = c.under + ARCH.CEILING_CATCH + 5;
  if (!solidAt(arch, p.x, p.z, out, mid)) continue;
  const r = {height: floor, slopeX: 0, slopeZ: 0};
  // Walk out to the side at that height and back in 2 units
  let v = 0;
  for (let q = at(arch, c.u, v); solidAt(arch, q.x, q.z, out, mid);) {
    q = at(arch, c.u, ++v);
  }
  const tip = at(arch, c.u, v - 2);
  archGround(arches, tip.x, tip.z, mid, r);
  const contact = wallContact(mid, r, WATER);
  check(
    contact !== null,
    `${name}: its side is not a wall (${JSON.stringify(r)} at ${mid})`
  );
  if (contact) {
    const outward = at(arch, c.u, 1);
    const ox = outward.x - p.x;
    const oz = outward.z - p.z;
    check(
      contact.nx * ox + contact.nz * oz > 0.9,
      `${name}: pushed into it, not off its side`
    );
  }
}
console.log(
  '  Passed: clear under each, the underside a ceiling, the top ground'
);
console.log('  Passed: a wingtip at the side is pushed off it');

// --- 4. Standing on something ---
for (const arch of kinds('sea')) {
  // Legs solid down into the water: the stack's, halfway out to where it
  // dips under, and the land end's
  for (const u of [(arch.uMin - arch.opening) / 2, arch.uMax - 10]) {
    const p = at(arch, u, 0);
    const g = {height: WATER, slopeX: 0, slopeZ: 0};
    check(
      archGround(arches, p.x, p.z, WATER + 3, g),
      `sea arch at (${Math.round(arch.x)}, ${Math.round(arch.z)}): a leg is not solid to the water`
    );
  }
  // And open water to fly through, along the coast
  const c = crown(arch);
  for (let v = -400; v <= 400; v += 40) {
    const p = at(arch, c.u, v);
    check(E(p.x, p.z) < WATER, `sea arch's way through is not water at ${v}`);
  }
}
for (const arch of kinds('canyon')) {
  // Each end goes into the canyon's walls: the ground there is up to its top
  for (const u of [arch.uMin, arch.uMax]) {
    const p = at(arch, u, 0);
    const top = archTop(arches, p.x, p.z);
    check(
      E(p.x, p.z) > top - 25,
      `canyon bridge end at ${Math.round(u)} hangs ${Math.round(top - E(p.x, p.z))} over the ground`
    );
  }
}
for (const arch of kinds('basalt')) {
  // Each end lies on a column's top
  for (const u of [arch.uMin + 5, arch.uMax - 5]) {
    const p = at(arch, u, 0);
    solidAt(arch, p.x, p.z, out);
    const gap = out.under - E(p.x, p.z);
    check(
      Math.abs(gap) < 20,
      `basalt gate end at ${Math.round(u)} is ${Math.round(gap)} off its column`
    );
  }
}
console.log(
  '  Passed: sea legs in the water, bridges in the walls, columns on tops'
);

if (failed) {
  console.error('Arch tests FAILED');
  process.exit(1);
}
console.log('All arch tests passed.');
