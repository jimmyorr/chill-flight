// Wall scrapes (wall-scrape-logic.js): which touches count as a wall, which
// way the plane is pushed off, and which way it glances off nose first.
import {
  SCRAPE,
  forwardOf,
  glanceHeading,
  headingOf,
  isHeadOn,
  scrapeRoll,
  stepOut,
  turnToward,
  wallContact,
} from '../wall-scrape-logic.js';

console.log('Testing wall scrapes...');
let failed = false;
function check(ok, msg) {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    failed = true;
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const WATER = 40;
// A wall rising toward +x (slope 5): it faces -x
const wall = {height: 200, slopeX: 5, slopeZ: 0};

// --- 1. Touching ---
check(wallContact(205, wall, WATER) === null, 'clear of the wall touches');
const c = wallContact(195, wall, WATER);
check(c !== null, 'a wingtip inside the wall does not touch');
check(near(c.depth, 5 + SCRAPE.MARGIN), `depth ${c.depth}`);
check(near(c.nx, -1) && near(c.nz, 0), `wall faces (${c.nx}, ${c.nz})`);
check(
  wallContact(100, {height: 120, slopeX: 0.3, slopeZ: 0}, WATER) === null,
  'gentle ground counts as a wall (the cushion lifts off it)'
);
check(
  wallContact(30, {height: WATER, slopeX: 5, slopeZ: 0}, WATER) === null,
  'water counts as a wall'
);
console.log('  Passed: steep ground touches, gentle ground and water do not');

// --- 2. Stepping out ---
check(near(stepOut(5, 5), 1), 'a step out clears the wall');
check(stepOut(100, 1) === SCRAPE.MAX_STEP, 'a step out is not capped');
console.log('  Passed: steps out of the wall, at most MAX_STEP a frame');

// --- 3. Head-on or a graze ---
// Heading +x (into the wall): forwardOf(h) = (1, 0)
const intoWall = headingOf(1, 0);
check(
  near(forwardOf(intoWall).x, 1) && near(forwardOf(intoWall).z, 0),
  'headingOf and forwardOf disagree'
);
check(isHeadOn(intoWall, -1, 0), 'nose first into the wall is not head-on');
const along = headingOf(0, -1);
check(!isHeadOn(along, -1, 0), 'flying along the wall is head-on');
check(
  !isHeadOn(headingOf(Math.sin(0.3), -Math.cos(0.3)), -1, 0),
  'a shallow graze is head-on'
);
console.log('  Passed: nose first is head-on, along the wall is a graze');

// --- 4. Glancing off ---
// 30° off head-on, drifting toward -z: glances off toward -z along the wall
const angled = headingOf(Math.cos(0.5), -Math.sin(0.5));
const g = forwardOf(glanceHeading(angled, -1, 0));
check(near(g.x, 0) && near(g.z, -1), `glanced off along (${g.x}, ${g.z})`);
const g2 = forwardOf(glanceHeading(headingOf(Math.cos(0.5), 0.48), -1, 0));
check(near(g2.z, 1), 'the other side does not glance the other way');
// Dead on, banked left (roll > 0) glances left: left of +x is -z
const left = forwardOf(glanceHeading(intoWall, -1, 0, 0.4));
check(near(left.z, -1), `dead on banked left went (${left.x}, ${left.z})`);
const right = forwardOf(glanceHeading(intoWall, -1, 0, -0.4));
check(near(right.z, 1), `dead on banked right went (${right.x}, ${right.z})`);
check(near(turnToward(0, 1, 0.25), 0.25), 'turnToward overshoots');
check(near(turnToward(3, -3, 1), 3 + (2 * Math.PI - 6)), 'not the short way');
console.log('  Passed: glances off along the wall, the way nearer the heading');

// --- 5. The wobble ---
// Flying -z with the wall on the left (facing +x): pushed right, the left
// wing lifts, a bank to the right (negative roll)
check(scrapeRoll(along, 1, 0) < 0, 'wall on the left rolls left');
check(scrapeRoll(along, -1, 0) > 0, 'wall on the right rolls right');
console.log('  Passed: the wing on the wall side lifts away from it');

if (failed) process.exit(1);
console.log('Wall scrape tests passed.');
