#!/usr/bin/env node
/**
 * scripts/test-bots.js
 *
 * Checks the bots' flying (bot-logic.js): out of games they settle on their
 * leader's wing, keep clear of hills, rejoin after a warp and circle over a
 * parked leader; in tag a bot that's it catches a player flying straight
 * and gives up a hopeless chase for someone else, and a bot running can be
 * caught.
 */
import {TAG_RADIUS, TAG_SPEED_BOOST} from '../multiplayer-logic.js';
import {forwardOf, headingToward} from '../traffic-logic.js';
import {
  CHASE_GIVE_UP,
  MIN_CLEARANCE,
  ORBIT_RADIUS,
  REJOIN_DISTANCE,
  newBot,
  rejoin,
  stepBot,
  wingSpot,
  wrapAngle,
} from '../bot-logic.js';

console.log('Testing bots...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  Passed: ${name}`);
  } else {
    failed = true;
    console.log(`FAIL: ${name} ${detail}`);
  }
}

const DT = 1 / 60;
const WATER = 40;
const flat = () => 100;
// Rolling hills up to ~700 high
const hills = (x, z) =>
  100 +
  300 * (1 + Math.sin(x / 1300) * Math.cos(z / 1700)) +
  100 * Math.sin(x / 450 + z / 600);

// A player flying along: turnRate rad/s, speed units/s
function player(x, y, z, heading, speed, turnRate = 0) {
  return {x, y, z, heading, speed, turnRate, vx: 0, vy: 0, vz: 0};
}
function stepPlayer(p, dt, elevationAt = flat) {
  p.heading = wrapAngle(p.heading + p.turnRate * dt);
  const f = forwardOf(p.heading);
  p.vx = f.x * p.speed;
  p.vz = f.z * p.speed;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  const floor = elevationAt(p.x, p.z) + 150;
  if (p.y < floor) p.y = floor;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// --- Wingman ---
{
  const lead = player(0, 600, 0, 0.3, 150);
  const bots = [0, 1, 2].map((slot) => newBot(slot, lead, 'biplane'));
  // Start them off their spots
  bots[0].x -= 600;
  bots[1].z += 900;
  bots[2].heading += 1.5;
  let worst = 0;
  for (let i = 0; i < 60 * 60; i++) {
    stepPlayer(lead, DT);
    const ctx = {
      elevationAt: flat,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 280,
      tag: null,
    };
    for (const b of bots) stepBot(b, DT, ctx);
    if (i > 30 * 60) {
      for (const b of bots)
        worst = Math.max(worst, dist(b, wingSpot(lead, b.slot)));
    }
  }
  check(
    'wingmen settle on their spots flying straight',
    worst < 40,
    `worst ${worst.toFixed(1)}`
  );

  lead.turnRate = 0.25;
  worst = 0;
  for (let i = 0; i < 40 * 60; i++) {
    stepPlayer(lead, DT);
    const ctx = {
      elevationAt: flat,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 280,
      tag: null,
    };
    for (const b of bots) stepBot(b, DT, ctx);
    if (i > 10 * 60) {
      for (const b of bots)
        worst = Math.max(worst, dist(b, wingSpot(lead, b.slot)));
    }
  }
  check(
    'wingmen keep up through a steady turn',
    worst < 200,
    `worst ${worst.toFixed(1)}`
  );
  const apart = Math.min(
    dist(bots[0], bots[1]),
    dist(bots[0], bots[2]),
    dist(bots[1], bots[2])
  );
  check('wingmen keep apart', apart > 60, `closest ${apart.toFixed(1)}`);
}

// --- Hills ---
{
  const lead = player(0, 900, 0, 0, 200, 0.1);
  const bots = [0, 1, 2].map((slot) => newBot(slot, lead, 'jet'));
  let low = Infinity;
  let jump = 0;
  for (let i = 0; i < 120 * 60; i++) {
    // The leader skims the hills
    stepPlayer(lead, DT, hills);
    lead.y = hills(lead.x, lead.z) + 60;
    const ctx = {
      elevationAt: hills,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 450,
      tag: null,
    };
    for (const b of bots) {
      const y = b.y;
      stepBot(b, DT, ctx);
      low = Math.min(low, b.y - hills(b.x, b.z));
      jump = Math.max(jump, Math.abs(b.y - y));
    }
  }
  check(
    'bots stay clear of hills with a low-flying leader',
    low >= MIN_CLEARANCE - 1e-6,
    `lowest ${low.toFixed(1)}`
  );
  check(
    'bots climb over hills smoothly',
    jump < 2,
    `largest step ${jump.toFixed(2)}`
  );
}

// --- Warp and parking ---
{
  const lead = player(0, 600, 0, 0, 150);
  const bot = newBot(0, lead, 'seaplane');
  lead.x += REJOIN_DISTANCE * 2;
  rejoin(bot, lead);
  check(
    'a bot rejoins its leader after a warp',
    dist(bot, wingSpot(lead, 0)) < 1
  );

  lead.speed = 0;
  lead.y = 100;
  let out = 0;
  for (let i = 0; i < 90 * 60; i++) {
    stepBot(bot, DT, {
      elevationAt: flat,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 380,
      tag: null,
    });
    if (i > 45 * 60) {
      const r = Math.hypot(bot.x - lead.x, bot.z - lead.z);
      out = Math.max(out, Math.abs(r - ORBIT_RADIUS));
    }
  }
  check(
    'bots circle over a parked leader',
    out < 150,
    `off the circle by ${out.toFixed(0)}`
  );
}

// --- Tag: a bot that's it ---
function chase(targets, seconds, moveTargets) {
  const lead = player(0, 600, 0, 0, 150);
  const bot = newBot(0, lead, 'biplane');
  bot.x = 0;
  bot.z = 1500;
  bot.y = 600;
  bot.heading = 0;
  const caught = [];
  for (let i = 0; i < seconds * 60 && !caught.length; i++) {
    for (const t of targets) moveTargets(t, DT);
    stepBot(bot, DT, {
      elevationAt: flat,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 280 * TAG_SPEED_BOOST,
      tag: {it: true, targets},
    });
    for (const t of targets)
      if (dist(bot, t) < TAG_RADIUS) caught.push({id: t.id, at: i / 60});
  }
  return {bot, caught};
}
{
  const runner = {id: 'a', ...player(800, 600, -400, Math.PI / 2, 280)};
  const {caught} = chase([runner], 120, (t, dt) => stepPlayer(t, dt));
  check(
    'a bot that is it catches a player flying straight at full speed',
    caught.length === 1,
    'not caught in 2 min'
  );
  if (caught.length) console.log(`    (in ${caught[0].at.toFixed(0)} s)`);
}
{
  // One player outrunning it (a faster plane) can't be caught; the bot
  // gives up for another
  const circler = {id: 'a', ...player(0, 600, 0, 0, 380)};
  const cruiser = {id: 'b', ...player(3000, 600, 3000, 1, 150, 0.05)};
  const {caught, bot} = chase([circler, cruiser], 240, (t, dt) =>
    stepPlayer(t, dt)
  );
  check(
    'a bot gives up a hopeless chase for someone else',
    caught.length === 1 && caught[0].id === 'b' && caught[0].at > CHASE_GIVE_UP,
    JSON.stringify(caught) + ` chasing ${bot.chaseId}`
  );
}

{
  // People before bots, and no tag-backs
  const lead = player(0, 600, 0, 0, 150);
  const pick = (targets) => {
    const bot = newBot(0, lead, 'biplane');
    stepBot(bot, DT, {
      elevationAt: flat,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 300,
      tag: {it: true, targets},
    });
    return bot.chaseId;
  };
  const near = {id: 'bot', ...player(0, 600, -300, 0, 0), bot: true};
  const person = {id: 'you', ...player(0, 600, -700, 0, 0)};
  check(
    'a bot that is it goes after people before bots',
    pick([near, person]) === 'you'
  );
  check(
    'a bot that is it does not tag straight back',
    pick([
      {...person, tagger: true},
      {...near, id: 'b2', x: 900},
    ]) === 'b2'
  );
  check(
    'a tag-back is fine with no one else',
    pick([{...person, tagger: true}]) === 'you'
  );
}

// --- Tag: a bot running ---
{
  const lead = player(0, 600, 0, 0, 150);
  const bot = newBot(0, lead, 'biplane');
  // A player who's it, chasing straight at the bot
  const it = player(0, 600, 2000, 0, 280 * TAG_SPEED_BOOST);
  let at = null;
  for (let i = 0; i < 180 * 60 && at === null; i++) {
    it.heading = headingToward(it.x, it.z, bot.x, bot.z);
    stepPlayer(it, DT);
    it.y += Math.sign(bot.y - it.y) * Math.min(Math.abs(bot.y - it.y), 60 * DT);
    stepBot(bot, DT, {
      elevationAt: hills,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 280,
      tag: {it: false, chaser: it, centre: {x: 0, y: 600, z: 0}},
    });
    if (dist(bot, it) < TAG_RADIUS) at = i / 60;
  }
  check('a bot running can be caught', at !== null, 'not caught in 3 min');
  if (at !== null) console.log(`    (in ${at.toFixed(0)} s)`);
  check(
    "a bot running isn't caught at once",
    at === null || at > 8,
    `caught in ${at?.toFixed(1)} s`
  );

  // Left alone far from the others, it comes back
  const far = newBot(1, lead, 'biplane');
  far.x = 8000;
  for (let i = 0; i < 90 * 60; i++) {
    stepBot(far, DT, {
      elevationAt: flat,
      waterLevel: WATER,
      leader: lead,
      topSpeed: 280,
      tag: {it: false, chaser: null, centre: {x: 0, y: 600, z: 0}},
    });
  }
  const back = Math.hypot(far.x, far.z);
  check(
    'a bot running drifts back toward the others',
    back < 2500,
    `${back.toFixed(0)} away`
  );
}

if (failed) {
  console.error('Bot tests failed.');
  process.exit(1);
}
console.log('All bot tests passed.');
