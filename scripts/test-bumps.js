/**
 * Bumps between planes and buggies (bumps-logic.js): the swept hit test,
 * which way each is pushed, the wobble, the push fading, and bots keeping
 * clear of each other (bot-logic.js with ctx.others).
 */
import {
  AVOID,
  BUMP,
  avoidStep,
  bumpRadius,
  bumpRoll,
  closestApproach,
  fadePush,
  pushAway,
  touched,
} from '../bumps-logic.js';
import {newBot, stepBot} from '../bot-logic.js';

console.log('Testing bumps...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const P = bumpRadius('plane');
const at = (x, y, z) => ({x, y, z});

{
  // Two planes crossing head on in one fast frame still touch
  const hit = touched(
    at(0, 100, -20),
    at(0, 100, 20),
    P,
    at(3, 100, 20),
    at(3, 100, -20),
    P
  );
  check('Planes passing head on within a frame bump', hit);
  const c = closestApproach(
    at(0, 0, -20),
    at(0, 0, 20),
    at(3, 0, 20),
    at(3, 0, -20)
  );
  check(
    'Closest halfway through the frame',
    Math.abs(c.t - 0.5) < 1e-6 && Math.abs(c.distSq - 9) < 1e-6
  );
  check(
    'Planes a wingspan apart side by side pass',
    !touched(
      at(0, 100, 0),
      at(0, 100, -5),
      P,
      at(2.2 * P, 100, 0),
      at(2.2 * P, 100, -5),
      P
    )
  );
  check(
    'Planes stacked well apart pass',
    !touched(at(0, 100, 0), at(0, 100, -5), P, at(0, 130, 0), at(0, 130, -5), P)
  );
  const B = bumpRadius('buggy');
  check('A buggy is smaller than a plane', B < P);
  check(
    'A warp is never a bump',
    !touched(at(0, 0, 0), at(0, 0, 0), P, at(-5000, 0, 0), at(5000, 0, 0), P)
  );
}

{
  // Pushed apart: away from the other, mostly sideways
  const me = at(2, 100, 0);
  const push = pushAway(me, at(0, 100, 0), 0);
  check('Pushed away from the other', push.x > 0.99 && Math.abs(push.z) < 1e-6);
  const theirs = pushAway(at(0, 100, 0), me, 0);
  check('The other is pushed the other way', theirs.x < -0.99);
  const above = pushAway(at(1, 140, 0), at(0, 100, 0), 0);
  check(
    'Mostly sideways, even one well above',
    above.y > 0 && above.y <= BUMP.LIFT + 1e-9 && above.x > 0.9
  );
  const dead = pushAway(at(0, 100, 0), at(0, 100, 0), 0);
  check('Right on top of each other: off to the right', dead.x > 0.99);
  check(
    'Unit length',
    [push, above, dead].every(
      (p) => Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-9
    )
  );
  // Heading north (0), right is +x: pushed right rolls right (negative z
  // rotation in three.js), as the game's banks do
  check(
    'Rolls toward the side pushed',
    bumpRoll({x: 1, y: 0, z: 0}, 0) === -BUMP.ROLL
  );
  check('...either side', bumpRoll({x: -1, y: 0, z: 0}, 0) === BUMP.ROLL);
  let v = BUMP.PUSH;
  let moved = 0;
  for (let i = 0; i < 300; i++) {
    moved += v / 60;
    v = fadePush(v, 1 / 60);
  }
  check(
    'A push moves about PUSH / FADE off line, then fades out',
    Math.abs(moved - BUMP.PUSH / BUMP.FADE) < 1 && v < 1,
    `(${moved.toFixed(1)} units, ${v.toFixed(2)} left)`
  );
}

{
  // Keeping clear
  const me = {x: 0, y: 100, z: 0, vx: 0, vz: -250};
  check(
    'Nothing near: no sidestep',
    avoidStep(me, [{x: 500, y: 100, z: 0}]) === null
  );
  const left = avoidStep(me, [{x: -20, y: 100, z: -40, vx: 0, vz: -250}]);
  check('Steps away from one off to the left', left && left.x > 0);
  check(
    'Ignores one well above',
    avoidStep(me, [{x: 0, y: 100 + AVOID.HEIGHT + 5, z: -10}]) === null
  );
  const oncoming = avoidStep(me, [{x: 5, y: 100, z: -300, vx: 0, vz: 250}]);
  check('Steps aside from one coming head on', oncoming && oncoming.x < 0);
}

{
  // Two bots flying the same line don't fly through each other
  const leader = {x: 0, y: 300, z: 0, heading: 0, speed: 250};
  const a = newBot(0, leader, 'biplane');
  const b = newBot(1, leader, 'biplane');
  for (const [bot, x] of [
    [a, -3],
    [b, 3],
  ]) {
    Object.assign(bot, {x, y: 300, z: 0, heading: 0, speed: 250, vs: 0});
  }
  const ctx = (self, other) => {
    const f = {x: -Math.sin(other.heading), z: -Math.cos(other.heading)};
    return {
      elevationAt: () => 0,
      waterLevel: 0,
      leader: {...leader, z: self.z - 5000},
      topSpeed: 280,
      tag: null,
      race: {
        hold: false,
        holdSpeed: 80,
        gate: {x: 0, y: 300, z: -20000, heading: 0},
        road: null,
        speed: 0.92,
      },
      others: [
        {
          x: other.x,
          y: other.y,
          z: other.z,
          vx: f.x * other.speed,
          vz: f.z * other.speed,
        },
      ],
    };
  };
  let closest = Infinity;
  for (let i = 0; i < 60 * 8; i++) {
    stepBot(a, 1 / 60, ctx(a, b));
    stepBot(b, 1 / 60, ctx(b, a));
    if (i > 60)
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
  }
  check(
    'Bots racing to the same ring keep a wingspan apart',
    closest > 2 * P,
    `(closest ${closest.toFixed(1)})`
  );
}

if (failed) {
  console.error('Bump tests failed.');
  process.exit(1);
}
console.log('All bump tests passed.');
