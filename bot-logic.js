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

// Driving (a round of tag in buggies): beside the leader, turning no faster
// than TURN (rad/s). Ground steeper than MAX_GRADE (rise over run) along
// the way ahead is steered around; at WALL_GRADE it stops a buggy dead.
// Held up for STUCK_AFTER seconds, a bot turns toward the most open ground
// for ESCAPE_FOR seconds; having got less than RESCUE_DISTANCE in
// RESCUE_AFTER seconds of trying, it asks to be put back beside its leader
// (needsRescue)
export const DRIVE_SLOTS = [
  {side: -24, back: 14},
  {side: 24, back: 14},
  {side: -12, back: 45},
];
export const DRIVE = {
  TURN: 1.1,
  MAX_GRADE: 0.7,
  WALL_GRADE: 1.2,
  PROBES: [30, 70, 120],
  STEP: 0.35,
  STUCK_SPEED: 10,
  STUCK_AFTER: 2,
  ESCAPE_FOR: 2.5,
  RESCUE_AFTER: 8,
  RESCUE_DISTANCE: 250,
  PARK_RADIUS: 30,
};

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

// The bot's spot beside its leader when driving, on the ground
export function driveSpot(leader, slot) {
  const s = DRIVE_SLOTS[slot % DRIVE_SLOTS.length];
  const f = forwardOf(leader.heading);
  return {
    x: leader.x - f.z * s.side - f.x * s.back,
    y: leader.y,
    z: leader.z + f.x * s.side - f.z * s.back,
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
    stuckFor: 0,
    escapeFor: 0,
    escapeHeading: 0,
    needsRescue: false,
    mistakeAt: MISTAKE_EVERY * (0.6 + 0.4 * slot),
  };
}

/** Puts a bot back on its leader's wing (after a warp, or stuck). */
export function rejoin(bot, leader, driving = false) {
  const spot = driving
    ? driveSpot(leader, bot.slot)
    : wingSpot(leader, bot.slot);
  Object.assign(bot, {
    x: spot.x,
    y: spot.y,
    z: spot.z,
    heading: leader.heading,
    speed: Math.max(MIN_SPEED, leader.speed || 0),
    vs: 0,
    aim: null,
    stuckFor: 0,
    escapeFor: 0,
    needsRescue: false,
    window: null,
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

// Turns toward `heading` at up to `maxTurn` rad/s, banking into it. A
// buggy turns no faster than DRIVE.TURN, around ground too steep to drive,
// or off toward open ground while it frees itself (drive)
function steer(bot, ctx, dt, heading, maxTurn) {
  if (ctx.driving) {
    heading =
      bot.escapeFor > 0 ? bot.escapeHeading : clearHeading(bot, ctx, heading);
    maxTurn = Math.min(maxTurn, DRIVE.TURN);
  }
  const err = wrapAngle(heading - bot.heading);
  const rate = clamp(err * 1.5, -maxTurn, maxTurn);
  bot.heading = wrapAngle(bot.heading + rate * dt);
  const bank = ctx.driving
    ? clamp(rate * 0.08, -0.1, 0.1)
    : clamp(rate * 0.9, -MAX_BANK, MAX_BANK);
  bot.bank += (bank - bot.bank) * Math.min(1, dt * 3);
}

// Moves the bot along at speed `speed`: flying, climbing toward height `y`
// but `clearance` over the ground ahead; or driving
function move(bot, dt, ctx, y, speed, clearance) {
  if (ctx.driving) drive(bot, dt, ctx, speed);
  else fly(bot, dt, ctx, y, speed, floorFor(bot, ctx, clearance));
}

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

// The steepest rise or fall (rise over run) along `heading` over the
// probes ahead
function gradeAlong(bot, ctx, heading) {
  const f = forwardOf(heading);
  let prev = ctx.surfaceAt(bot.x, bot.z, bot.y);
  let prevD = 0;
  let worst = 0;
  for (const d of DRIVE.PROBES) {
    const h = ctx.surfaceAt(bot.x + f.x * d, bot.z + f.z * d, prev);
    worst = Math.max(worst, Math.abs(h - prev) / (d - prevD));
    prev = h;
    prevD = d;
  }
  return worst;
}

// The heading nearest `want` that's clear of steep ground, looked up every
// SCAN_INTERVAL; with none, the least steep way round
function clearHeading(bot, ctx, want) {
  const c = bot.clear;
  if (c && bot.floors && Math.abs(wrapAngle(c.want - want)) < 0.15) {
    return c.heading;
  }
  bot.floors ??= {};
  let heading = null;
  let best = Infinity;
  let bestHeading = want;
  for (let i = 0; i <= 8 && heading === null; i++) {
    for (const sign of i ? [1, -1] : [1]) {
      const h = wrapAngle(want + sign * i * DRIVE.STEP);
      const g = gradeAlong(bot, ctx, h);
      if (g <= DRIVE.MAX_GRADE) {
        heading = h;
        break;
      }
      if (g < best) {
        best = g;
        bestHeading = h;
      }
    }
  }
  bot.clear = {want, heading: heading ?? bestHeading};
  return bot.clear.heading;
}

// Drives the bot along the ground at up to `speed`, slowing uphill and
// stopped by a wall; keeps count of how long it's been held up
function drive(bot, dt, ctx, speed) {
  const f = forwardOf(bot.heading);
  const here = ctx.surfaceAt(bot.x, bot.z, bot.y);
  const ahead = ctx.surfaceAt(bot.x + f.x * 6, bot.z + f.z * 6, here);
  const grade = (ahead - here) / 6;
  const wall = grade > DRIVE.WALL_GRADE;
  const want = wall
    ? 0
    : grade > 0
      ? speed * clamp(1 - grade / DRIVE.WALL_GRADE, 0.25, 1)
      : speed;
  const brake = want < bot.speed ? ACCEL * 2 : ACCEL;
  bot.speed += clamp(want - bot.speed, -brake * dt, brake * dt);
  if (wall) bot.speed = 0;
  bot.x += f.x * bot.speed * dt;
  bot.z += f.z * bot.speed * dt;
  bot.y = ctx.surfaceAt(bot.x, bot.z, here);
  bot.vs = 0;
  bot.pitch += (Math.atan(grade) - bot.pitch) * Math.min(1, dt * 6);
  // Held up while wanting to go: turn toward open ground for a moment, and
  // in the end ask to be put back
  if (speed > 30 && bot.speed < DRIVE.STUCK_SPEED) bot.stuckFor += dt;
  else bot.stuckFor = Math.max(0, bot.stuckFor - dt * 2);
  bot.escapeFor = Math.max(0, bot.escapeFor - dt);
  if (bot.stuckFor > DRIVE.STUCK_AFTER && bot.escapeFor === 0) {
    let best = Infinity;
    for (let i = 0; i < 12; i++) {
      const h = bot.heading + Math.PI / 2 + (i * Math.PI) / 6;
      const g = gradeAlong(bot, ctx, h);
      if (g < best) {
        best = g;
        bot.escapeHeading = wrapAngle(h);
      }
    }
    bot.escapeFor = DRIVE.ESCAPE_FOR;
  }
  // Gone almost nowhere in RESCUE_AFTER seconds of trying (boxed in,
  // circling a pit): put it back
  const w = (bot.window ??= {x: bot.x, z: bot.z, t: 0, trying: 0});
  w.t += dt;
  if (speed > 30) w.trying += dt;
  if (w.t >= DRIVE.RESCUE_AFTER) {
    const moved = Math.hypot(bot.x - w.x, bot.z - w.z);
    if (w.trying > w.t * 0.8 && moved < DRIVE.RESCUE_DISTANCE) {
      bot.needsRescue = true;
    }
    bot.window = null;
  }
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// Out of games: keeps its spot on the leader's wing, catching up when
// behind; over a parked leader, circles overhead
function stepWingman(bot, dt, ctx) {
  const {leader} = ctx;
  if (ctx.driving) {
    stepDrivingWingman(bot, dt, ctx);
    return;
  }
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
    steer(
      bot,
      ctx,
      dt,
      headingToward(bot.x, bot.z, target.x, target.z),
      WING_TURN
    );
    const ground = Math.max(
      ctx.elevationAt(leader.x, leader.z),
      ctx.waterLevel
    );
    move(bot, dt, ctx, ground + ORBIT_HEIGHT + bot.slot * 25, 110, 80);
    return;
  }
  const spot = wingSpot(leader, bot.slot);
  const f = forwardOf(leader.heading);
  // Aim at a point ahead of the spot, so the bot settles in alongside
  // rather than circling it
  const lead = Math.max(250, leader.speed * 1.5);
  const aimX = spot.x + f.x * lead;
  const aimZ = spot.z + f.z * lead;
  steer(bot, ctx, dt, headingToward(bot.x, bot.z, aimX, aimZ), WING_TURN);
  // Behind the spot (along the leader's heading): faster; ahead: slower
  const behind = (spot.x - bot.x) * f.x + (spot.z - bot.z) * f.z;
  const far = distance2d(bot, spot) > 1500;
  const speed = far
    ? ctx.topSpeed
    : clamp(leader.speed + behind * 0.4, MIN_SPEED, ctx.topSpeed);
  move(bot, dt, ctx, spot.y, speed, WING_CLEARANCE);
}

// Out of games in buggies: drives alongside the leader, and parks beside
// them when they stop
function stepDrivingWingman(bot, dt, ctx) {
  const {leader} = ctx;
  const spot = driveSpot(leader, bot.slot);
  const gap = distance2d(bot, spot);
  if (leader.speed < PARKED_SPEED && gap < DRIVE.PARK_RADIUS) {
    steer(bot, ctx, dt, leader.heading, DRIVE.TURN);
    drive(bot, dt, ctx, 0);
    return;
  }
  const f = forwardOf(leader.heading);
  const lead = leader.speed < PARKED_SPEED ? 0 : Math.max(80, leader.speed);
  steer(
    bot,
    ctx,
    dt,
    headingToward(bot.x, bot.z, spot.x + f.x * lead, spot.z + f.z * lead),
    WING_TURN
  );
  const behind = (spot.x - bot.x) * f.x + (spot.z - bot.z) * f.z;
  const speed =
    leader.speed < PARKED_SPEED
      ? clamp(gap * 0.5, 0, 80)
      : gap > 600
        ? ctx.topSpeed
        : clamp(leader.speed + behind * 0.5, 0, ctx.topSpeed);
  drive(bot, dt, ctx, speed);
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
  steer(
    bot,
    ctx,
    dt,
    headingToward(bot.x, bot.z, bot.aim.x, bot.aim.z),
    CHASE_TURN
  );
  move(bot, dt, ctx, bot.aim.y, ctx.topSpeed * CHASE_SPEED, CHASE_CLEARANCE);
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
    if (!dawdling) steer(bot, ctx, dt, away, RUN_TURN);
    const ground = Math.max(ctx.elevationAt(bot.x, bot.z), ctx.waterLevel);
    const speed = ctx.topSpeed * (dawdling ? 0.6 : RUN_SPEED);
    move(bot, dt, ctx, ground + DUCK_CLEARANCE, speed, DUCK_CLEARANCE);
    return;
  }
  const home = centre || ctx.leader;
  if (distance2d(bot, home) > REGROUP_DISTANCE) {
    steer(bot, ctx, dt, headingToward(bot.x, bot.z, home.x, home.z), RUN_TURN);
  } else {
    steer(
      bot,
      ctx,
      dt,
      bot.heading + Math.sin(bot.age * 0.2 + bot.slot) * 0.4,
      RUN_TURN
    );
  }
  move(bot, dt, ctx, home.y ?? bot.y, ctx.topSpeed * 0.7, WING_CLEARANCE);
}

/**
 * Advances a bot by dt seconds, in place. ctx:
 * - elevationAt(x, z), waterLevel: the ground and the sea
 * - driving: a buggy on the ground, with surfaceAt(x, z, y) the height it
 *   rests at there (the ground, a road's deck, or the water it hovers on)
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
