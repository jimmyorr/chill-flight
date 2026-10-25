// --- BOTS: FLIGHT LOGIC ---
// Pure math for the bots that fill empty seats when flying together
// (multiplayer.js runs them): a loose wingman out of games, and a beatable
// chaser or runner in tag. No three.js or DOM, so scripts/test-bots.js can
// run it in Node.
//
// A bot is {x, y, z, heading, pitch, bank, speed, vs, ...}: heading as the
// game uses it (0 flies north, -z), speed in units a second (a unit a second
// reads as a knot). Drawn with rotation (pitch, heading, bank) in 'YXZ'
// order, like the traffic planes.
import {forwardOf, headingToward} from './traffic-logic.js';

export const BOT_PLANES = ['biplane', 'seaplane', 'twin', 'jet'];

// Where each bot flies off its leader's wing: units to the right, behind
// and above
// (close enough to show in the chase camera's view)
export const WING_SLOTS = [
  {side: -70, back: 15, up: 6},
  {side: 70, back: 15, up: 6},
  {side: -140, back: 45, up: 15},
];
// Further than this from the leader, a bot is put back on their wing (a
// warp, a reconnect); within it, it catches up at full speed
export const REJOIN_DISTANCE = 6000;
// The leader slower than this (parked, taxiing): bots circle overhead
export const PARKED_SPEED = 30;
export const ORBIT_RADIUS = 380;
export const ORBIT_HEIGHT = 160;

// Never closer to the ground (or water) than this, and keep this much
// clearance along the way ahead
export const MIN_CLEARANCE = 20;
const WING_CLEARANCE = 45;
const CHASE_CLEARANCE = 35;
const DUCK_CLEARANCE = 55;
const LOOK_AHEAD = 1800;
const SCAN_STEP = 150;
const CLIMB_SLOPE = 0.2;
// Seconds between looks ahead at the ground
const SCAN_INTERVAL = 0.2;

// Handling: turn rates (rad/s) a little under a player's (about 1 rad/s in
// a firm bank), so a player can always out-turn a bot
const WING_TURN = 0.9;
export const CHASE_TURN = 0.5;
const RUN_TURN = 0.6;
// The chaser reacts to where its target is going with this much lag (s)
const CHASE_REACTION = 0.7;
const MAX_BANK = 0.75;
const MAX_CLIMB = 60;
const MAX_SINK = 45;
const ACCEL = 45; // units/s²
const MIN_SPEED = 90;

// In tag, as fractions of the bot's top speed (whoever's it is 15% faster
// on top, multiplayer-logic.js): a bot runner can be caught, and a bot
// chaser a little slower than a player who's it
export const CHASE_SPEED = 0.93;
export const RUN_SPEED = 0.88;
// Other bots count as this many times further off when picking who to
// chase, so bots go after people
const BOT_TARGET_WEIGHT = 3;
// A chase that hasn't got any closer for this long switches to someone else
export const CHASE_GIVE_UP = 30;
// The chaser within this: run (ducking low); further: drift back toward
// the others so the game stays together
export const FLEE_DISTANCE = 1800;
const REGROUP_DISTANCE = 1500;
// Every MISTAKE_EVERY seconds or so a runner dawdles for MISTAKE_FOR
const MISTAKE_EVERY = 25;
const MISTAKE_FOR = 3;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// The bot's spot on its leader's wing, in the world
export function wingSpot(leader, slot) {
  const s = WING_SLOTS[slot % WING_SLOTS.length];
  const f = forwardOf(leader.heading);
  // To the right of the leader's heading
  const rx = -f.z;
  const rz = f.x;
  return {
    x: leader.x + rx * s.side - f.x * s.back,
    y: leader.y + s.up,
    z: leader.z + rz * s.side - f.z * s.back,
  };
}

/**
 * Where a runner waits when a game of tag starts: fanned out ahead of
 * whoever's it (as players are, multiplayer.js flyTo), slot 0 to the left,
 * 1 to the right, 2 further out in the middle.
 */
export function fanSpot(it, slot) {
  const f = forwardOf(it.heading);
  const side = [-80, 80, 0][slot % 3];
  const ahead = slot % 3 === 2 ? 320 : 260;
  return {
    x: it.x - f.z * side + f.x * ahead,
    y: it.y + 15,
    z: it.z + f.x * side + f.z * ahead,
  };
}

/** A bot on `leader`'s wing, flying their way. */
export function newBot(slot, leader, plane) {
  const spot = wingSpot(leader, slot);
  return {
    slot,
    plane,
    x: spot.x,
    y: spot.y,
    z: spot.z,
    heading: leader.heading,
    pitch: 0,
    bank: 0,
    speed: Math.max(MIN_SPEED, leader.speed || 0),
    vs: 0,
    age: 0,
    chaseId: null,
    chaseFor: 0,
    chaseBest: Infinity,
    aim: null,
    mistakeAt: MISTAKE_EVERY * (0.6 + 0.4 * slot),
  };
}

/** Puts a bot back on its leader's wing (after a warp). */
export function rejoin(bot, leader) {
  const spot = wingSpot(leader, bot.slot);
  Object.assign(bot, {
    x: spot.x,
    y: spot.y,
    z: spot.z,
    heading: leader.heading,
    speed: Math.max(MIN_SPEED, leader.speed || 0),
    vs: 0,
    aim: null,
  });
}

// The lowest height to fly at here: clear of the ground (or the water) by
// `clearance`, and of the ground ahead, at a climb it can make
export function floorAhead(bot, elevationAt, waterLevel, clearance) {
  const f = forwardOf(bot.heading);
  let floor = -Infinity;
  for (let d = 0; d <= LOOK_AHEAD; d += SCAN_STEP) {
    const ground = Math.max(
      elevationAt(bot.x + f.x * d, bot.z + f.z * d),
      waterLevel
    );
    floor = Math.max(floor, ground + clearance - d * CLIMB_SLOPE);
  }
  return floor;
}

// floorAhead, looked up every SCAN_INTERVAL
function floorFor(bot, ctx, clearance) {
  bot.floors ??= {};
  if (!(clearance in bot.floors)) {
    bot.floors[clearance] = floorAhead(
      bot,
      ctx.elevationAt,
      ctx.waterLevel,
      clearance
    );
  }
  return bot.floors[clearance];
}

// Turns toward `heading` at up to `maxTurn` rad/s, banking into it
function steer(bot, dt, heading, maxTurn) {
  const err = wrapAngle(heading - bot.heading);
  const rate = clamp(err * 1.5, -maxTurn, maxTurn);
  bot.heading = wrapAngle(bot.heading + rate * dt);
  const bank = clamp(rate * 0.9, -MAX_BANK, MAX_BANK);
  bot.bank += (bank - bot.bank) * Math.min(1, dt * 3);
}

// Moves the bot along, climbing toward height `y` (but never under
// `floor`) at speed `speed`
function fly(bot, dt, ctx, y, speed, floor) {
  bot.speed += clamp(speed - bot.speed, -ACCEL * dt, ACCEL * dt);
  const f = forwardOf(bot.heading);
  bot.x += f.x * bot.speed * dt;
  bot.z += f.z * bot.speed * dt;
  const want = clamp((Math.max(y, floor) - bot.y) * 0.8, -MAX_SINK, MAX_CLIMB);
  bot.vs += (want - bot.vs) * Math.min(1, dt * 2.5);
  const ground = Math.max(ctx.elevationAt(bot.x, bot.z), ctx.waterLevel);
  bot.y = Math.max(bot.y + bot.vs * dt, ground + MIN_CLEARANCE);
  bot.pitch = Math.atan2(bot.vs, Math.max(1, bot.speed));
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Out of games: keeps its spot on the leader's wing, catching up when
// behind; over a parked leader, circles overhead
function stepWingman(bot, dt, ctx) {
  const {leader} = ctx;
  if (leader.speed < PARKED_SPEED) {
    const r = ORBIT_RADIUS + bot.slot * 90;
    const around = Math.atan2(bot.x - leader.x, bot.z - leader.z);
    // Aim a little round the circle from where it is now (anticlockwise
    // from above) and pulled in or out toward the radius
    const ahead = around + 0.5;
    const target = {
      x: leader.x + Math.sin(ahead) * r,
      z: leader.z + Math.cos(ahead) * r,
    };
    steer(bot, dt, headingToward(bot.x, bot.z, target.x, target.z), WING_TURN);
    const ground = Math.max(
      ctx.elevationAt(leader.x, leader.z),
      ctx.waterLevel
    );
    const floor = floorFor(bot, ctx, 80);
    fly(bot, dt, ctx, ground + ORBIT_HEIGHT + bot.slot * 25, 110, floor);
    return;
  }
  const spot = wingSpot(leader, bot.slot);
  const f = forwardOf(leader.heading);
  // Aim at a point ahead of the spot, so the bot settles in alongside
  // rather than circling it
  const lead = Math.max(250, leader.speed * 1.5);
  const aimX = spot.x + f.x * lead;
  const aimZ = spot.z + f.z * lead;
  steer(bot, dt, headingToward(bot.x, bot.z, aimX, aimZ), WING_TURN);
  // Behind the spot (along the leader's heading): faster; ahead: slower
  const behind = (spot.x - bot.x) * f.x + (spot.z - bot.z) * f.z;
  const far = distance2d(bot, spot) > 1500;
  const speed = far
    ? ctx.topSpeed
    : clamp(leader.speed + behind * 0.4, MIN_SPEED, ctx.topSpeed);
  const floor = floorFor(bot, ctx, WING_CLEARANCE);
  fly(bot, dt, ctx, spot.y, speed, floor);
}

// In tag, as it: after the nearest player (people before bots, and not
// whoever just tagged it), steering for where they're
// headed with a moment's lag, and giving up on a chase that's getting
// nowhere for someone else
function stepChaser(bot, dt, ctx) {
  // No tag-backs: whoever just tagged it is left alone while there's
  // anyone else
  const fair = ctx.tag.targets.filter((t) => !t.tagger);
  const targets = fair.length ? fair : ctx.tag.targets;
  if (!targets.length) {
    stepWingman(bot, dt, ctx);
    return;
  }
  bot.chaseFor += dt;
  let target = targets.find((t) => t.id === bot.chaseId);
  if (!target || (bot.chaseFor > CHASE_GIVE_UP && targets.length > 1)) {
    const others = targets.filter((t) => !target || t.id !== target.id);
    // People before other bots, unless the bots are a lot nearer
    const score = (t) => distance2d(bot, t) * (t.bot ? BOT_TARGET_WEIGHT : 1);
    others.sort((a, b) => score(a) - score(b));
    target = others[0] ?? target;
    bot.chaseId = target.id;
    bot.chaseFor = 0;
    bot.chaseBest = Infinity;
    bot.aim = null;
  }
  const gap = distance2d(bot, target);
  if (gap < bot.chaseBest - 50) {
    bot.chaseBest = gap;
    bot.chaseFor = 0;
  }
  // Where the target will be when the bot gets there, roughly, eased so the
  // bot reacts late to a turn
  const t = clamp(gap / Math.max(1, bot.speed), 0, 4);
  const ahead = {
    x: target.x + (target.vx || 0) * t,
    y: target.y + (target.vy || 0) * t,
    z: target.z + (target.vz || 0) * t,
  };
  if (!bot.aim) bot.aim = {...ahead};
  const k = 1 - Math.exp(-dt / CHASE_REACTION);
  bot.aim.x = lerp(bot.aim.x, ahead.x, k);
  bot.aim.y = lerp(bot.aim.y, ahead.y, k);
  bot.aim.z = lerp(bot.aim.z, ahead.z, k);
  steer(bot, dt, headingToward(bot.x, bot.z, bot.aim.x, bot.aim.z), CHASE_TURN);
  const floor = floorFor(bot, ctx, CHASE_CLEARANCE);
  fly(bot, dt, ctx, bot.aim.y, ctx.topSpeed * CHASE_SPEED, floor);
}

// In tag, running: away from whoever's it when they're close, weaving and
// ducking low, with the odd dawdle; otherwise drifting back toward the
// others
function stepRunner(bot, dt, ctx) {
  const {chaser, centre} = ctx.tag;
  const near = chaser && distance2d(bot, chaser) < FLEE_DISTANCE;
  bot.mistakeAt -= dt;
  if (bot.mistakeAt < -MISTAKE_FOR) {
    bot.mistakeAt = MISTAKE_EVERY * (0.7 + 0.6 * ((bot.age * 7.3) % 1));
  }
  const dawdling = bot.mistakeAt < 0;
  if (near) {
    let away = headingToward(chaser.x, chaser.z, bot.x, bot.z);
    away += Math.sin(bot.age * 0.45 + bot.slot * 2) * 0.6;
    // Not off into the distance: bend back toward the others
    if (centre && distance2d(bot, centre) > REGROUP_DISTANCE * 2) {
      const home = headingToward(bot.x, bot.z, centre.x, centre.z);
      away += wrapAngle(home - away) * 0.4;
    }
    if (!dawdling) steer(bot, dt, away, RUN_TURN);
    const ground = Math.max(ctx.elevationAt(bot.x, bot.z), ctx.waterLevel);
    const floor = floorFor(bot, ctx, DUCK_CLEARANCE);
    const speed = ctx.topSpeed * (dawdling ? 0.6 : RUN_SPEED);
    fly(bot, dt, ctx, ground + DUCK_CLEARANCE, speed, floor);
    return;
  }
  const home = centre || ctx.leader;
  if (distance2d(bot, home) > REGROUP_DISTANCE) {
    steer(bot, dt, headingToward(bot.x, bot.z, home.x, home.z), RUN_TURN);
  } else {
    steer(
      bot,
      dt,
      bot.heading + Math.sin(bot.age * 0.2 + bot.slot) * 0.4,
      RUN_TURN
    );
  }
  const floor = floorFor(bot, ctx, WING_CLEARANCE);
  fly(bot, dt, ctx, home.y ?? bot.y, ctx.topSpeed * 0.7, floor);
}

/**
 * Advances a bot by dt seconds, in place. ctx:
 * - elevationAt(x, z), waterLevel: the ground and the sea
 * - leader {x, y, z, heading, speed}: who it flies with (whoever brought it)
 * - topSpeed: its plane's top speed (units/s), with any tag boost
 * - tag: null out of games; else {it: true, targets: [{id, x, y, z, vx?,
 *   vy?, vz?}]} as whoever's it, or {it: false, chaser: {x, y, z} or
 *   null, centre: {x, y, z} or null} as a runner. A target's `bot` marks
 *   another bot, and `tagger` whoever just tagged this one
 */
export function stepBot(bot, dt, ctx) {
  bot.age += dt;
  bot.scanIn = (bot.scanIn ?? 0) - dt;
  if (bot.scanIn <= 0) {
    bot.scanIn = SCAN_INTERVAL;
    bot.floors = null;
  }
  if (!ctx.tag) {
    bot.chaseId = null;
    bot.aim = null;
    stepWingman(bot, dt, ctx);
  } else if (ctx.tag.it) {
    stepChaser(bot, dt, ctx);
  } else {
    bot.chaseId = null;
    bot.aim = null;
    stepRunner(bot, dt, ctx);
  }
  return bot;
}
