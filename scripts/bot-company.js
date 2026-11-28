#!/usr/bin/env node
/**
 * scripts/bot-company.js
 *
 * Flies three wingman bots (bot-logic.js) with a virtual player
 * (scripts/pilot-sim.js, the real flight controls and physics) through a
 * set of flights: cruising, S-turns, hard and sharp turns, rolls, loops,
 * climbs and dives, throttle chops and random jinking. Bumps are as in
 * bumps.js (touch within both radii, pushed apart, then pass through for
 * GHOST seconds). For each flight it reports how often a bot touched the
 * player or another bot, how long one was in the way (closer than
 * IN_THE_WAY), how near they stayed (company), and how smoothly they flew.
 *
 *   node scripts/bot-company.js            # table
 *   node scripts/bot-company.js --json     # numbers for a page
 *   node scripts/bot-company.js --tracks   # plus every bot's path
 */
import {BASE_FLIGHT_SPEED, PLANE_HANDLING} from '../constants.js';
import {forwardOf} from '../traffic-logic.js';
import {newBot, stepBot} from '../bot-logic.js';
import {BUMP, bumpRadius, pushAway, touched} from '../bumps-logic.js';
import {simulatePilotTrajectory} from './pilot-sim.js';

const FPS = 30;
const DT = 1 / FPS;
const SECONDS = 60;
const UNITS = BASE_FLIGHT_SPEED * 60;
// Closer than this (units, centre to centre) a bot is in the player's way
export const IN_THE_WAY = 30;
// Within this a bot shows as company in the chase camera
export const COMPANY = 300;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jinks(seed) {
  const r = mulberry(seed);
  const stick = [];
  const stunts = [];
  for (let t = 0; t < SECONDS; t += 1.2 + r() * 1.5) {
    stick.push([t, (r() * 2 - 1) * (r() < 0.5 ? 1 : 0.5), (r() * 2 - 1) * 0.6]);
    if (r() < 0.12) {
      const kind = ['sharp-left', 'sharp-right', 'roll-left', 'roll-right'][
        Math.floor(r() * 4)
      ];
      stunts.push([t, t + 1 + r() * 2, kind]);
    }
  }
  return {stick, stunts};
}

const alternate = (period, kinds, len) => {
  const out = [];
  for (let t = 3, i = 0; t < SECONDS - 3; t += period, i++) {
    out.push([t, t + len, kinds[i % kinds.length]]);
  }
  return out;
};

export const FLIGHTS = [
  {id: 'cruise', name: 'Cruising straight', moves: {stick: [[0, 0, 0]]}},
  {
    id: 's-turns',
    name: 'Gentle S-turns',
    moves: {
      stick: Array.from({length: 16}, (_, i) => [i * 4, i % 2 ? 0.5 : -0.5]),
    },
  },
  {
    id: 'hard-turns',
    name: 'Hard turns, 20 s each way',
    moves: {
      stick: [
        [0, -1],
        [19.5, -1],
        [20.5, 1],
        [39.5, 1],
        [40.5, -1],
      ],
    },
  },
  {
    id: 'sharp',
    name: 'Sharp turns (double-tap hold)',
    moves: {
      stick: [[0, 0]],
      stunts: alternate(5, ['sharp-left', 'sharp-right'], 3),
    },
  },
  {
    id: 'reversal',
    name: 'Turn reversals into the wing',
    moves: {
      stick: [
        [0, 0],
        [2, -1],
        [6, -1],
        [6.6, 1],
        [11, 1],
        [11.6, -1],
        [16, -1],
        [16.6, 1],
        [21, 1],
        [21.6, -1],
        [26, -1],
        [26.6, 1],
        [31, 1],
        [31.6, -1],
        [36, -1],
        [36.6, 1],
        [41, 1],
        [41.6, -1],
        [46, -1],
        [46.6, 1],
        [51, 1],
        [51.6, 0],
      ],
    },
  },
  {
    id: 'rolls',
    name: 'Barrel rolls',
    moves: {
      stick: [[0, 0]],
      stunts: alternate(6, ['roll-left', 'roll-right'], 3),
    },
  },
  {
    id: 'loops',
    name: 'Loops and Immelmanns',
    moves: {stick: [[0, 0]], stunts: alternate(9, ['loop', 'immelmann'], 4)},
  },
  {
    id: 'climb-dive',
    name: 'Climbs and dives',
    moves: {
      stick: [[0, 0]],
      stunts: alternate(6, ['steep-climb', 'steep-dive', 'climb', 'dive'], 3),
    },
  },
  {
    id: 'throttle',
    name: 'Throttle chops',
    moves: {
      stick: [
        [0, 0, 0, 1.6],
        [8, 0.3, 0, 0.5],
        [18, 0, 0, 1.8],
        [28, -0.4, 0, 0.45],
        [38, 0, 0, 1.8],
        [48, 0, 0, 0.5],
      ],
    },
  },
  {id: 'jinks-1', name: 'Random jinking A', moves: jinks(7)},
  {id: 'jinks-2', name: 'Random jinking B', moves: jinks(99)},
];

const PLANES = ['biplane', 'seaplane', 'twin'];

function flat() {
  return 0;
}

// One flight: [{t, player: {x,y,z}, bots: [{x,y,z}]}] plus the scores
export function flyFlight(flight, {tracks = false} = {}) {
  const samples = simulatePilotTrajectory({
    planeType: 'biplane',
    x: 0,
    y: 900,
    z: 0,
    speedMult: 1.4,
    pilotMoves: flight.moves,
    endFrame: SECONDS * FPS,
    prerollSec: 0,
    fps: FPS,
  });
  const first = samples[0];
  const leader0 = {
    x: first.x,
    y: first.y,
    z: first.z,
    heading: first.yaw,
    speed: first.speed * UNITS,
  };
  const bots = PLANES.map((plane, slot) => newBot(slot, leader0, plane));
  const ghost = new Map();
  const stats = {
    touchesPlayer: 0,
    touchesBots: 0,
    inTheWay: 0,
    minGap: Infinity,
    company: 0,
    meanGap: 0,
    bankRate: 0,
    turnJerk: 0,
    nudge: 0,
  };
  const track = [];
  let prevPlayer = {x: first.x, y: first.y, z: first.z};
  const prevBank = bots.map((b) => b.bank);
  const prevRate = bots.map(() => 0);
  const prevHeading = bots.map((b) => b.heading);
  let n = 0;
  let turn = 0;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    let dyaw = s.yaw - samples[i - 1].yaw;
    dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    // As multiplayer.js: smoothed over about 0.15 s
    turn += (dyaw / DT - turn) * Math.min(1, DT / 0.15);
    const pitch = s.pitch;
    const speed = s.speed * UNITS;
    const f = forwardOf(s.yaw);
    const player = {
      id: 'me',
      x: s.x,
      y: s.y,
      z: s.z,
      vx: f.x * Math.cos(pitch) * speed,
      vy: Math.sin(pitch) * speed,
      vz: f.z * Math.cos(pitch) * speed,
      turn,
    };
    const leader = {x: s.x, y: s.y, z: s.z, heading: s.yaw, speed, turn, pitch};
    const before = bots.map((b) => ({x: b.x, y: b.y, z: b.z}));
    bots.forEach((bot, k) => {
      const others = [player];
      bots.forEach((o, j) => {
        if (j === k) return;
        const g = forwardOf(o.heading);
        others.push({
          id: j,
          x: o.x,
          y: o.y,
          z: o.z,
          vx: g.x * Math.cos(o.pitch) * o.speed,
          vy: Math.sin(o.pitch) * o.speed,
          vz: g.z * Math.cos(o.pitch) * o.speed,
          turn: o.turn || 0,
        });
      });
      const x0 = bot.x;
      const z0 = bot.z;
      stepBot(bot, DT, {
        elevationAt: flat,
        waterLevel: -50,
        leader,
        topSpeed: PLANE_HANDLING[bot.plane].topKts,
        tag: null,
        race: null,
        driving: false,
        surfaceAt: flat,
        others,
      });
      // Sideways movement the heading doesn't explain (nudges, shoves)
      const g = forwardOf(bot.heading);
      const side = (bot.x - x0) * -g.z + (bot.z - z0) * g.x;
      stats.nudge += Math.abs(side) / DT;
    });
    // Bumps, as bumps.js: player vs bots, bots vs bots
    const pair = (a0, a1, ra, b0, b1, rb, key) => {
      const until = ghost.get(key) || 0;
      if (s.t < until) return false;
      if (!touched(a0, a1, ra, b0, b1, rb)) return false;
      ghost.set(key, s.t + BUMP.GHOST);
      return true;
    };
    const pr = bumpRadius('plane');
    bots.forEach((bot, k) => {
      if (pair(prevPlayer, player, pr, before[k], bot, pr, `p${k}`)) {
        stats.touchesPlayer++;
        const push = pushAway(bot, player, bot.heading);
        bot.push = {
          x: push.x * BUMP.PUSH,
          y: push.y * BUMP.PUSH,
          z: push.z * BUMP.PUSH,
        };
      }
      for (let j = k + 1; j < bots.length; j++) {
        if (pair(before[k], bot, pr, before[j], bots[j], pr, `b${k}${j}`)) {
          stats.touchesBots++;
        }
      }
    });
    // Scores
    bots.forEach((bot, k) => {
      const gap = Math.hypot(bot.x - s.x, bot.y - s.y, bot.z - s.z);
      stats.minGap = Math.min(stats.minGap, gap);
      if (gap < IN_THE_WAY) stats.inTheWay += DT;
      if (gap < COMPANY) stats.company += 1;
      stats.meanGap += gap;
      const bankRate = (bot.bank - prevBank[k]) / DT;
      stats.bankRate += bankRate * bankRate;
      prevBank[k] = bot.bank;
      let dh = bot.heading - prevHeading[k];
      if (dh > Math.PI) dh -= 2 * Math.PI;
      if (dh < -Math.PI) dh += 2 * Math.PI;
      const rate = dh / DT;
      const jerk = (rate - prevRate[k]) / DT;
      stats.turnJerk += jerk * jerk;
      prevRate[k] = rate;
      prevHeading[k] = bot.heading;
      n++;
    });
    if (tracks && i % 6 === 0) {
      track.push({
        t: +s.t.toFixed(2),
        p: [
          Math.round(s.x),
          Math.round(s.y),
          Math.round(s.z),
          +s.yaw.toFixed(3),
        ],
        b: bots.map((b) => [Math.round(b.x), Math.round(b.y), Math.round(b.z)]),
      });
    }
    prevPlayer = player;
  }
  return {
    id: flight.id,
    name: flight.name,
    touchesPlayer: stats.touchesPlayer,
    touchesBots: stats.touchesBots,
    inTheWay: +stats.inTheWay.toFixed(2),
    minGap: Math.round(stats.minGap),
    meanGap: Math.round(stats.meanGap / n),
    company: Math.round((100 * stats.company) / n),
    bankRate: +Math.sqrt(stats.bankRate / n).toFixed(3),
    turnJerk: +Math.sqrt(stats.turnJerk / n).toFixed(2),
    nudge: +(stats.nudge / n).toFixed(2),
    track: tracks ? track : undefined,
  };
}

export function flyAll(opts) {
  return FLIGHTS.map((f) => flyFlight(f, opts));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const json = process.argv.includes('--json');
  const tracks = process.argv.includes('--tracks');
  const rows = flyAll({tracks});
  if (json || tracks) {
    console.log(JSON.stringify(rows));
  } else {
    const cols = [
      'touchesPlayer',
      'touchesBots',
      'inTheWay',
      'minGap',
      'meanGap',
      'company',
      'bankRate',
      'turnJerk',
      'nudge',
    ];
    console.log(
      ['flight'.padEnd(32), ...cols.map((c) => c.padStart(9))].join('')
    );
    for (const r of rows) {
      console.log(
        [r.name.padEnd(32), ...cols.map((c) => String(r[c]).padStart(9))].join(
          ''
        )
      );
    }
    const sum = (c) => rows.reduce((a, r) => a + r[c], 0);
    console.log(
      `Total: ${sum('touchesPlayer')} touches with the player, ` +
        `${sum('touchesBots')} between bots, ${sum('inTheWay').toFixed(1)} s in the way`
    );
  }
}
