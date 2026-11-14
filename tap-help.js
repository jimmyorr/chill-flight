// --- TAP HELP ---
// Teaches the double- and triple-tap moves (tap-moves.js) without getting in
// the way of the start:
// - Hints: after a few minutes of calm flying, a quiet line in the sky names
//   one move the player hasn't done yet and how to do it, with tap ripples on
//   the screen edge to use. A move that's been done is never hinted again,
//   one that's been hinted a few times stops too, and the line fades by
//   itself. Off with the Disable hints setting, and for the visit with
//   ?hints=0 or ?ui=0 (scripted runs).
// - Help: the ❔ button on the pause menu opens the moves for the plane and
//   the buggy, with the screen zones on touch screens and a Try button that
//   goes back to flying with the hint showing until the move is done.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {Achievements} from './achievements.js';
import {hooks} from './hooks.js';
import {state} from './state.js';
import {t} from './i18n.js';
import {trackScreen} from './analytics.js';
import {togglePause} from './game-state.js';
import {
  MOVES,
  howTo,
  isTouch,
  moveById,
  movesDone,
  onMove,
  placeOf,
} from './tap-moves.js';

// Seconds of calm play before the first hint of a visit, between hints, and
// of calm needed right before one
const FIRST_HINT_S = 150;
const HINT_GAP_S = 300;
const CALM_S = 15;
const HINTS_PER_VISIT = 3;
// A move hinted this many times without being done isn't hinted again
const SHOWS_PER_MOVE = 3;
// How long a hint shows (its CSS animation) and a practice waits
const HINT_MS = 7000;
const PRACTICE_MS = 45000;
// The ripples' rhythm: a ring per tap, then the held dot (style.css)
const RIPPLE_REPEAT_MS = 2600;

const OFF_KEY = 'chill_flight_hints_off';
const SHOWN_KEY = 'chill_flight_hints_shown';

const hintEl = document.getElementById('move-hint');
const ripplesEl = document.getElementById('move-ripples');
const offInput = document.getElementById('hints-off-input');
const overlay = document.getElementById('help-overlay');
const openBtn = document.getElementById('help-btn');
const closeBtn = document.getElementById('help-close-btn');
const vehicleGroup = document.getElementById('help-vehicle');
const zonesEl = document.getElementById('help-zones');
const listEl = document.getElementById('help-moves');
const dialogEl = document.getElementById('npc-dialog');

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable
  }
};

let hintsOff = load(OFF_KEY, false) === true;
const shown = load(SHOWN_KEY, {});

const isDone = (move) =>
  !!movesDone()[move.id] ||
  (move.achievement && Achievements.isUnlocked(move.achievement));

const vehicleNow = () =>
  state.airplaneModel?.isBuggy || state.planeType === 'buggy'
    ? 'buggy'
    : 'plane';

// --- THE HINT AND ITS RIPPLES ---
let current = null; // {move, practice, until}
let hideTimer = null;
let rippleTimer = null;

// Where the ripples go, as a share of the screen: the middle of the zone,
// kept clear of the HUD at the top and the throttle at the bottom
function ripplePoints(move) {
  const zones =
    move.vehicle === 'buggy'
      ? ChillFlightLogic.BUGGY_TOUCH_ZONES
      : {UP_ABOVE: 0.33, DOWN_BELOW: 0.66};
  const place = placeOf(move, state.invertYAxis);
  if (place === 'side') {
    return [
      [0.12, 0.5],
      [0.88, 0.5],
    ];
  }
  if (place === 'top') return [[0.5, zones.UP_ABOVE - 0.08]];
  return [[0.5, zones.DOWN_BELOW + 0.06]];
}

function playRipples(move) {
  if (!ripplesEl) return;
  ripplesEl.replaceChildren();
  if (!isTouch()) return;
  for (const [x, y] of ripplePoints(move)) {
    const spot = document.createElement('div');
    spot.className = 'move-ripple' + (move.hold ? ' hold' : '');
    spot.style.left = `${x * 100}%`;
    spot.style.top = `${y * 100}%`;
    for (let i = 0; i < move.taps; i++) {
      const ring = document.createElement('i');
      ring.style.animationDelay = `${i * 0.18}s`;
      spot.appendChild(ring);
    }
    if (move.hold) {
      const dot = document.createElement('b');
      dot.style.animationDelay = `${(move.taps - 1) * 0.18}s`;
      spot.appendChild(dot);
    }
    ripplesEl.appendChild(spot);
  }
}

function stopHint() {
  clearTimeout(hideTimer);
  clearInterval(rippleTimer);
  hideTimer = rippleTimer = null;
  current = null;
  hintEl?.classList.remove('show', 'practice', 'low');
  ripplesEl?.replaceChildren();
}

function showText(lines, {practice = false, low = false} = {}) {
  if (!hintEl) return;
  const [title, how] = lines;
  const b = document.createElement('b');
  b.textContent = title;
  hintEl.replaceChildren(b);
  if (how) {
    const span = document.createElement('span');
    span.textContent = how;
    hintEl.append(span);
  }
  hintEl.classList.remove('show', 'practice', 'low');
  void hintEl.offsetWidth; // restart the animation
  hintEl.classList.toggle('practice', practice);
  hintEl.classList.toggle('low', low);
  hintEl.classList.add('show');
}

function showHint(move, practice) {
  stopHint();
  current = {move, practice};
  const touch = isTouch();
  // A hint about the top of the screen sits lower, away from its ripples
  const low = touch && placeOf(move, state.invertYAxis) === 'top';
  showText([move.name(), howTo(move, {touch, invert: state.invertYAxis})], {
    practice,
    low,
  });
  playRipples(move);
  rippleTimer = setInterval(() => playRipples(move), RIPPLE_REPEAT_MS);
  hideTimer = setTimeout(stopHint, practice ? PRACTICE_MS : HINT_MS);
}

// The move just happened: a hint for it goes, and a practice says well done
onMove((id) => {
  if (current?.move.id !== id) return;
  const practice = current.practice;
  stopHint();
  if (practice) {
    showText([t('Nice!')]);
    hideTimer = setTimeout(stopHint, 2500);
  }
});

// --- WHEN A HINT MAY SHOW ---
const hintsAllowed = () =>
  !hintsOff &&
  ChillFlightLogic.HINTS_PARAM !== false &&
  ChillFlightLogic.SHOW_UI &&
  !state.isVRPresenting;

// Flying along with nothing else going on
function calm() {
  if (
    state.isPaused ||
    document.hidden ||
    state.isIntroTransitionActive ||
    state.isFreeCamera ||
    state.isCrashed ||
    state.autopilotEnabled ||
    state.scriptedFlight ||
    hooks.isZen?.() ||
    hooks.inGameMode?.() ||
    hooks.fullscreenMap?.isOpen() ||
    (dialogEl && !dialogEl.hidden)
  ) {
    return false;
  }
  if (vehicleNow() === 'buggy') return true;
  return (
    !state.isOnGround &&
    !state.isOnWater &&
    state.flightSpeedMultiplier > 0 &&
    !state.isLooping &&
    !state.isBarrelRolling &&
    !state.isDoingImmelmann
  );
}

function nextMove() {
  const vehicle = vehicleNow();
  return MOVES.find(
    (m) =>
      m.vehicle === vehicle &&
      !isDone(m) &&
      (shown[m.id] || 0) < SHOWS_PER_MOVE &&
      !hintedThisVisit.has(m.id)
  );
}

let playSeconds = 0;
let calmSeconds = 0;
let nextHintAt = FIRST_HINT_S;
const hintedThisVisit = new Set();
let practiceWaiting = null;

const TICK_S = 0.5;
setInterval(() => {
  // A practice starts once flying again, and ends if the game pauses
  if (practiceWaiting && !state.isPaused) {
    showHint(practiceWaiting, true);
    practiceWaiting = null;
    return;
  }
  if (current?.practice && state.isPaused) stopHint();
  if (state.isPaused || document.hidden) return;
  playSeconds += TICK_S;
  calmSeconds = calm() ? calmSeconds + TICK_S : 0;
  if (
    current ||
    !hintsAllowed() ||
    hintedThisVisit.size >= HINTS_PER_VISIT ||
    playSeconds < nextHintAt ||
    calmSeconds < CALM_S
  ) {
    return;
  }
  const move = nextMove();
  if (!move) return;
  hintedThisVisit.add(move.id);
  shown[move.id] = (shown[move.id] || 0) + 1;
  save(SHOWN_KEY, shown);
  nextHintAt = playSeconds + HINT_GAP_S;
  showHint(move, false);
}, TICK_S * 1000);

// --- SETTING ---
if (offInput) {
  offInput.checked = hintsOff;
  offInput.addEventListener('change', () => {
    hintsOff = offInput.checked;
    save(OFF_KEY, hintsOff);
    if (hintsOff && current && !current.practice) stopHint();
  });
}

// --- HELP SCREEN ---
let helpVehicle = 'plane';

const tapDots = (move) => '●'.repeat(move.taps);

// The screen as the player holds it, cut into its tap zones, each listing
// what its taps do
function renderZones() {
  if (!zonesEl) return;
  const touch = isTouch();
  // (Desktops have keys, not zones)
  zonesEl.style.display = touch ? '' : 'none';
  if (!touch) return;
  const zones =
    helpVehicle === 'buggy'
      ? ChillFlightLogic.BUGGY_TOUCH_ZONES
      : {UP_ABOVE: 0.33, DOWN_BELOW: 0.66};
  const aspect = Math.min(
    2.2,
    Math.max(0.5, window.innerWidth / window.innerHeight)
  );
  // As wide as fits, but no taller than about half the screen
  zonesEl.style.aspectRatio = String(aspect);
  zonesEl.style.width = `min(100%, 420px, ${(46 * aspect).toFixed(1)}vh)`;
  const row = (share) => `minmax(0, ${share.toFixed(2)}fr)`;
  zonesEl.style.gridTemplateRows = [
    zones.UP_ABOVE,
    zones.DOWN_BELOW - zones.UP_ABOVE,
    1 - zones.DOWN_BELOW,
  ]
    .map(row)
    .join(' ');
  const cells = {
    side: [],
    top: [],
    bottom: [],
  };
  for (const move of MOVES) {
    if (move.vehicle !== helpVehicle) continue;
    cells[placeOf(move, state.invertYAxis)].push(move);
  }
  // Double-taps above triple-taps in every zone
  for (const list of Object.values(cells)) list.sort((a, b) => a.taps - b.taps);
  const zone = (cls, moves) => {
    const el = document.createElement('div');
    el.className = `help-zone ${cls}`;
    for (const move of moves) {
      const line = document.createElement('div');
      const dots = document.createElement('small');
      dots.textContent = tapDots(move);
      line.append(dots, document.createTextNode(move.name()));
      el.appendChild(line);
    }
    return el;
  };
  zonesEl.replaceChildren(
    zone('left', cells.side),
    zone('top', cells.top),
    zone('middle', []),
    zone('bottom', cells.bottom),
    zone('right', cells.side)
  );
}

function renderList() {
  if (!listEl) return;
  const touch = isTouch();
  const here = helpVehicle === vehicleNow();
  listEl.replaceChildren(
    ...MOVES.filter((m) => m.vehicle === helpVehicle).map((move) => {
      const row = document.createElement('div');
      row.className = 'help-move';
      const text = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'help-move-name';
      name.textContent = move.name();
      if (isDone(move)) {
        const tick = document.createElement('span');
        tick.className = 'help-move-done';
        tick.textContent = '✓';
        name.appendChild(tick);
      }
      const how = document.createElement('div');
      how.className = 'help-move-how';
      how.textContent = howTo(move, {touch, invert: state.invertYAxis});
      text.append(name, how);
      row.appendChild(text);
      // Practice: back to flying with the hint up until it's done
      if (here) {
        const tryBtn = document.createElement('button');
        tryBtn.className = 'help-try-btn';
        tryBtn.textContent = t('Try');
        tryBtn.addEventListener('click', () => practice(move.id));
        row.appendChild(tryBtn);
      }
      return row;
    })
  );
}

function render() {
  for (const btn of vehicleGroup?.querySelectorAll('[data-vehicle]') || []) {
    btn.classList.toggle('active', btn.dataset.vehicle === helpVehicle);
  }
  renderZones();
  renderList();
}

function closeHelp() {
  if (overlay) overlay.style.display = 'none';
  trackScreen(state.isPaused ? 'pause' : 'flight');
}

function practice(id) {
  const move = moveById(id);
  if (!move) return;
  closeHelp();
  stopHint();
  practiceWaiting = move;
  if (state.isPaused) togglePause();
}

openBtn?.addEventListener('click', () => {
  helpVehicle = vehicleNow();
  render();
  trackScreen('help');
  if (overlay) overlay.style.display = 'flex';
});
closeBtn?.addEventListener('click', closeHelp);
overlay?.addEventListener('click', (e) => {
  if (e.target === overlay) closeHelp();
});
vehicleGroup?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-vehicle]');
  if (!btn) return;
  helpVehicle = btn.dataset.vehicle;
  render();
});
