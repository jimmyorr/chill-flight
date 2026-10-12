// --- COFFEE RUN ---
// An opt-in errand loop for Ray's roastery (coffee-logic.js has the rules):
// the Coffee run switch in the pause menu turns it on, the waypoint points to
// the next field, and landing there (rolling on the runway, slowed to a
// stop) picks up beans, has Ray roast them, or delivers them. Ray talks in a dialog
// box along the bottom of the screen with a pixel-art face. The run is saved
// between visits.
import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {planeGroup} from './airplane.js';
import {getElevation} from './terrain-geometry.js';
import {Achievements} from './achievements.js';
import {isOnWheels} from './flight-physics.js';
import {setWaypoint} from './waypoint.js';
import {BASE_FLIGHT_SPEED} from './constants.js';
import {
  cargoLabel,
  destination,
  land,
  startRun,
  validRun,
} from './coffee-logic.js';

const ENABLED_KEY = 'chill_flight_coffee';
const RUN_KEY = 'chill_flight_coffee_run';
// Slower than this (knots) on the wheels counts as stopped
const STOPPED_KTS = 20;
// Characters typed per second in the dialog
const TYPE_RATE = 45;

const checkbox = document.getElementById('coffee-toggle-input');
const hud = document.getElementById('coffee-hud');
const hudCount = document.getElementById('coffee-hud-count');
const hudCargo = document.getElementById('coffee-hud-cargo');
const dialog = document.getElementById('coffee-dialog');
const portrait = document.getElementById('coffee-portrait');
const dialogText = document.getElementById('coffee-dialog-text');

let enabled = false;
let run = null;
// The field the plane last stopped at, so one stop counts once
let stoppedAt = null;

try {
  enabled = localStorage.getItem(ENABLED_KEY) === 'true';
  run = validRun(JSON.parse(localStorage.getItem(RUN_KEY)));
} catch {
  /* nothing saved */
}

function save() {
  try {
    localStorage.setItem(ENABLED_KEY, String(enabled));
    if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* storage unavailable: it lasts this visit */
  }
}

// --- RAY'S FACE ---
// 32 by 32 pixels, one character per pixel ('.' is clear), drawn after the
// real Ray: a cap on backwards, long wavy hair, a beard and a big grin. While
// he talks, his mouth closes now and then (MOUTH_CLOSED's rows).
const RAY = [
  '................................',
  '...............kk...............',
  '............kkkCCkkk............',
  '..........kkcccccccckk..........',
  '.........kchhhhhhhcccck.........',
  '........kcchhhhhhhccccck........',
  '.......kcccchhhhhccccccck.......',
  '.......kcccccccccccccccck.......',
  '.......kCCCCCrrggrrCCCCCk.......',
  '.......kCCCCCCrrrrCCCCCCk.......',
  '.......krrrlllllsssssrrrk.......',
  '.......krrlvvvvllvvvvsrrk.......',
  '......krrrlllllllsssssrrrk......',
  '......krrrleellllsseesrrrk......',
  '.....krrrrsdellddssessrrrrk.....',
  '.....krrrssssssddssssssrrrk.....',
  '.....krdrsssssddddsssssrdrk.....',
  '.....krdrssssssddssssssrdrk.....',
  '......krrbssbbbbbbbbssbrrk......',
  '.....kkrrbbbbbbbbbbbbbbrrk......',
  '....krrrrbbbbwwwwwwbbBbrrk......',
  '...krrrrrrbbbmmmmmmbbbrrrrk.....',
  '...krrrrrrbbbbbmmbbbbbrrrrrk....',
  '...krrrrrrrbbbbbbbbbbrrrrrrrk...',
  '....krrrrrrrbbbbbbbbrrrrrrrrk...',
  '.....kkrrrtrrbbbbbbrrtttrrrk....',
  '....kkttrtttttnnnntttttttrtk....',
  '...kttttttttttnnnnttttttttttk...',
  '..ktttttttttttnnnntttttttttttk..',
  '..kttttttttttttnnttttttttttttk..',
  '..ktttttttttttttTttttttttttttk..',
  '.ktttttttttttttnntttttttttttttk.',
];
const MOUTH_CLOSED = {
  20: '....krrrrbbbbmmmmmmbbBbrrk......',
  21: '...krrrrrrbbbbbbbbbbbbrrrrk.....',
  22: '...krrrrrrbbbbbbbbbbbbrrrrrk....',
};
const PALETTE = {
  k: '#2a1c14', // outline
  c: '#969276', // cap
  C: '#76725a', // cap band
  h: '#b0ac92', // cap highlight
  g: '#aaaaa0', // cap buckle
  r: '#3b2418', // hair
  v: '#342218', // brows
  s: '#e2b28e', // skin
  l: '#f0ccaa', // skin highlight
  d: '#c08e6a', // nose and shadow
  e: '#2a1a10', // eyes
  b: '#3a2a20', // beard
  B: '#6e6054', // grey in the beard
  w: '#f4efe6', // teeth
  m: '#6a2e24', // mouth
  n: '#eeeeea', // undershirt and buttons
  t: '#6f7a86', // henley
  T: '#57616c', // henley placket
};
const FACE_SIZE = RAY.length;

function drawFace(mouthClosed) {
  const ctx = portrait?.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
  RAY.forEach((row, y) => {
    const line = (mouthClosed && MOUTH_CLOSED[y]) || row;
    for (let x = 0; x < FACE_SIZE; x++) {
      const color = PALETTE[line[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

// --- DIALOG ---
// Ray's lines one at a time, typed out. A tap, click or Enter shows the
// whole line, then the next one, then closes it.
let lines = [];
let lineIndex = 0;
let typing = null;

function stopTyping() {
  if (typing) clearInterval(typing);
  typing = null;
  drawFace(false);
}

function showLine() {
  stopTyping();
  const line = lines[lineIndex];
  const started = performance.now();
  dialogText.textContent = '';
  typing = setInterval(() => {
    const shown = Math.min(
      line.length,
      Math.floor(((performance.now() - started) / 1000) * TYPE_RATE)
    );
    dialogText.textContent = line.slice(0, shown);
    // The mouth opens and closes every couple of letters
    drawFace(shown % 4 < 2 && line[shown - 1] !== ' ');
    if (shown >= line.length) stopTyping();
  }, 1000 / TYPE_RATE);
}

function openDialog(newLines) {
  if (!dialog || !newLines?.length) return;
  lines = newLines;
  lineIndex = 0;
  dialog.hidden = false;
  showLine();
}

function closeDialog() {
  stopTyping();
  if (dialog) dialog.hidden = true;
  lines = [];
}

function advanceDialog() {
  if (!lines.length) return;
  if (typing) {
    stopTyping();
    dialogText.textContent = lines[lineIndex];
    return;
  }
  lineIndex++;
  if (lineIndex < lines.length) showLine();
  else closeDialog();
}

if (dialog) {
  dialog.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    advanceDialog();
  });
}
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !state.isPaused && lines.length) advanceDialog();
});

// --- HUD AND WAYPOINT ---
function airportByName(name) {
  return ChillFlightLogic.AIRPORTS.find((a) => a.name === name);
}

function pointToDestination() {
  const a = airportByName(destination(run));
  if (a) setWaypoint(a.x, getElevation(a.x, a.z), a.z);
}

function updateHud() {
  if (!hud) return;
  hud.hidden = !enabled || !run;
  if (hud.hidden) return;
  hudCount.textContent = `${run.delivered} delivered`;
  const cargo = cargoLabel(run);
  hudCargo.textContent = cargo
    ? `${cargo} → ${destination(run)}`
    : `Empty → ${destination(run)}`;
}

function setEnabled(on) {
  enabled = on;
  if (checkbox) checkbox.checked = on;
  if (on && !run) {
    const start = startRun();
    run = start.run;
    openDialog(start.dialog);
    log.info(`[Coffee run] Started: ${run.farm} to ${run.buyer}`);
  }
  if (on) pointToDestination();
  else closeDialog();
  save();
  updateHud();
}

if (checkbox) {
  checkbox.addEventListener('change', () => setEnabled(checkbox.checked));
}
drawFace(false);
setEnabled(enabled);

// --- LANDING ---
// The airport whose flat field (x, z) is on, if any
function airportAt(x, z) {
  if (!ChillFlightLogic.isOnAirport(x, z)) return null;
  let nearest = null;
  let best = Infinity;
  for (const a of ChillFlightLogic.AIRPORTS) {
    const d = Math.hypot(a.x - x, a.z - z);
    if (d < best) {
      best = d;
      nearest = a;
    }
  }
  return nearest;
}

function update() {
  requestAnimationFrame(update);
  if (!enabled || !run || !planeGroup || state.isPaused) return;
  const kts = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  if (!isOnWheels() || kts > STOPPED_KTS) {
    stoppedAt = null;
    return;
  }
  const a = airportAt(planeGroup.position.x, planeGroup.position.z);
  if (!a || a === stoppedAt) return;
  stoppedAt = a;
  const result = land(run, a.name);
  if (result.run === run) return;
  run = result.run;
  save();
  updateHud();
  pointToDestination();
  if (result.toast) Achievements.toast({emoji: '☕', ...result.toast});
  if (result.dialog) openDialog(result.dialog);
  log.info(`[Coffee run] Landed at ${a.name}, next: ${destination(run)}`);
}

requestAnimationFrame(update);
