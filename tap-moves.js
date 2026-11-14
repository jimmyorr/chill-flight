// --- TAP MOVES ---
// The double- and triple-tap moves on the screen edges (or arrow keys), as
// one list for the help that teaches them: the hints in the sky and the Help
// screen (tap-help.js) and the how-to line on locked achievements
// (achievements.js). Also remembers which moves the player has done, so a
// hint never teaches a move they already know.
//
// Each move: id, vehicle ('plane' or 'buggy'), zone ('up', 'down' or 'side':
// up and down are pitch, so with Invert y axis on they swap for the planes),
// taps (2 or 3), hold (the move needs the last tap held), achievement (the
// one that already says it's been done, if any) and name().
import {t} from './i18n.js';

export const MOVES = [
  {
    id: 'climb',
    vehicle: 'plane',
    zone: 'up',
    taps: 2,
    hold: true,
    achievement: 'to_the_moon',
    name: () => t('Steep climb'),
  },
  {
    id: 'roll',
    vehicle: 'plane',
    zone: 'side',
    taps: 3,
    hold: true,
    achievement: 'barrel_roll',
    name: () => t('Barrel roll'),
  },
  {
    id: 'sharp',
    vehicle: 'plane',
    zone: 'side',
    taps: 2,
    hold: true,
    achievement: null,
    name: () => t('Sharp turn'),
  },
  {
    id: 'loop',
    vehicle: 'plane',
    zone: 'up',
    taps: 3,
    hold: true,
    achievement: 'froot_loops',
    name: () => t('Loop'),
  },
  {
    id: 'dive',
    vehicle: 'plane',
    zone: 'down',
    taps: 2,
    hold: true,
    achievement: 'nose_dive',
    name: () => t('Steep dive'),
  },
  {
    id: 'immelmann',
    vehicle: 'plane',
    zone: 'down',
    taps: 3,
    hold: false,
    achievement: 'u_turn',
    name: () => t('U-turn'),
  },
  {
    id: 'hop',
    vehicle: 'buggy',
    zone: 'up',
    taps: 2,
    hold: false,
    achievement: 'bunny_hop',
    name: () => t('Hop'),
  },
  {
    id: 'slide',
    vehicle: 'buggy',
    zone: 'side',
    taps: 2,
    hold: true,
    achievement: 'tokyo_drift',
    name: () => t('Power slide'),
  },
  {
    id: 'brake',
    vehicle: 'buggy',
    zone: 'down',
    taps: 2,
    hold: true,
    achievement: null,
    name: () => t('Hard brake'),
  },
];

export const moveById = (id) => MOVES.find((m) => m.id === id);
export const moveForAchievement = (id) =>
  MOVES.find((m) => m.achievement === id);

// Where on the screen (or which key) a move is: 'top', 'bottom' or 'side'.
// Pitch moves swap with Invert y axis; the buggy's never do.
export function placeOf(move, invert) {
  if (move.zone === 'side') return 'side';
  const up = move.zone === 'up';
  const flip = invert && move.vehicle === 'plane';
  return up !== flip ? 'top' : 'bottom';
}

const KEY = {top: '↑', bottom: '↓', side: '← →'};

// How to do it, in words: on a touch screen the screen edge, otherwise the
// arrow key
export function howTo(move, {touch, invert}) {
  const place = placeOf(move, invert);
  if (!touch) {
    const key = KEY[place];
    if (move.taps === 3) {
      return move.hold
        ? t('Triple-tap {key} and hold', {key})
        : t('Triple-tap {key}', {key});
    }
    return move.hold
      ? t('Double-tap {key} and hold', {key})
      : t('Double-tap {key}', {key});
  }
  if (move.taps === 3) {
    if (place === 'side') return t('Triple-tap left or right and hold');
    if (place === 'top') {
      return move.hold
        ? t('Triple-tap the top and hold')
        : t('Triple-tap the top');
    }
    return move.hold
      ? t('Triple-tap the bottom and hold')
      : t('Triple-tap the bottom');
  }
  if (place === 'side') return t('Double-tap left or right and hold');
  if (place === 'top') {
    return move.hold
      ? t('Double-tap the top and hold')
      : t('Double-tap the top');
  }
  return t('Double-tap the bottom and hold');
}

// Touch screens (phones and tablets) use the screen edges
export const isTouch = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(any-pointer: coarse)').matches;

// --- WHAT THE PLAYER HAS DONE ---
const DONE_KEY = 'chill_flight_moves_done';
let done = {};
try {
  done = JSON.parse(localStorage.getItem(DONE_KEY) || '{}') || {};
} catch {
  done = {};
}
const listeners = new Set();

// Called every frame a move is happening (game-loop.js, buggy.js), so
// it's cheap when there's nothing new
export function noteMove(id) {
  if (!done[id]) {
    done[id] = true;
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(done));
    } catch {
      // Storage full or unavailable
    }
  }
  for (const fn of listeners) fn(id);
}

export const movesDone = () => ({...done});
export function onMove(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
