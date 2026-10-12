// --- COFFEE RUN ---
// Ray's roastery errands (coffee-logic.js has the rules). Land at Meadow
// Field and Ray offers an errand, which you take or turn down; on an errand,
// the waypoint points to the next field, and landing there (rolling on the
// runway, slowed to a stop) picks up beans, has Ray roast them, or delivers
// them. The errand's waypoint stays until you land there. Clearing it on the
// map cancels the errand (minimap.js calls cancelErrand); another waypoint is
// a detour, and once it's reached or cleared the errand's comes back. Ray
// talks in a dialog box along the bottom of the screen with a pixel-art face.
// The run is saved between visits.
import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {planeGroup} from './airplane.js';
import {getElevation} from './terrain-geometry.js';
import {Achievements} from './achievements.js';
import {isOnWheels} from './flight-physics.js';
import {clearWaypoint, getWaypoint, setWaypoint} from './waypoint.js';
import {BASE_FLIGHT_SPEED} from './constants.js';
import {
  PEOPLE,
  accept,
  cancel,
  cargoLabel,
  decline,
  destination,
  land,
  newRun,
  validRun,
} from './coffee-logic.js';

const RUN_KEY = 'chill_flight_coffee_run';
// Slower than this (knots) on the wheels counts as stopped
const STOPPED_KTS = 20;
// Characters typed per second in the dialog
const TYPE_RATE = 35;
// Ray's mouth closes and opens again every this many seconds as he talks
const MOUTH_SECONDS = 0.18;

const hud = document.getElementById('coffee-hud');
const hudCount = document.getElementById('coffee-hud-count');
const hudCargo = document.getElementById('coffee-hud-cargo');
const hudAuto = document.getElementById('coffee-hud-auto');
// The cockpit's CHILL-FLIGHT / AUTOPILOT line, which the coffee row replaces
const statusPanel = document.getElementById('cockpit-status-panel');
const dialog = document.getElementById('coffee-dialog');
const portrait = document.getElementById('coffee-portrait');
const dialogName = document.getElementById('coffee-dialog-name');
const dialogText = document.getElementById('coffee-dialog-text');
const choices = document.getElementById('coffee-dialog-choices');

let run = newRun();
// The field the plane last stopped at, so one stop counts once
let stoppedAt = null;

try {
  // ?coffee=reset starts over, as if Ray had never met you (for testing his
  // lines)
  if (ChillFlightLogic.urlParams?.get('coffee') !== 'reset') {
    run = validRun(JSON.parse(localStorage.getItem(RUN_KEY))) || run;
  }
} catch {
  /* nothing saved */
}

function save() {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
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
// Lines one at a time, typed out. A tap, click or Enter shows the whole line,
// then the next one, then closes it. A question waits on its last line for
// Sure thing (Enter or Y) or Not right now (N).
let lines = [];
let lineIndex = 0;
let typing = null;
let onAnswer = null;

function stopTyping() {
  if (typing) clearInterval(typing);
  typing = null;
  drawFace(false);
  if (onAnswer && lineIndex === lines.length - 1) {
    choices.hidden = false;
    dialog.classList.add('asking');
  }
}

function showLine() {
  stopTyping();
  choices.hidden = true;
  dialog.classList.remove('asking');
  const line = lines[lineIndex];
  const started = performance.now();
  dialogText.textContent = '';
  typing = setInterval(() => {
    const elapsed = (performance.now() - started) / 1000;
    const shown = Math.min(line.length, Math.floor(elapsed * TYPE_RATE));
    dialogText.textContent = line.slice(0, shown);
    drawFace(Math.floor(elapsed / MOUTH_SECONDS) % 2 === 1);
    if (shown >= line.length) stopTyping();
  }, 1000 / TYPE_RATE);
}

// answer(yes) is called when a question is answered
function openDialog(name, newLines, answer = null) {
  if (!dialog || !newLines?.length) return;
  dialogName.textContent = name;
  lines = newLines;
  lineIndex = 0;
  onAnswer = answer;
  dialog.hidden = false;
  showLine();
}

function closeDialog() {
  onAnswer = null;
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
  // The question waits for an answer
  if (onAnswer && lineIndex === lines.length - 1) return;
  lineIndex++;
  if (lineIndex < lines.length) showLine();
  else closeDialog();
}

function answer(yes) {
  const respond = onAnswer;
  if (!respond || !choices || choices.hidden) return;
  onAnswer = null;
  respond(yes);
}

if (dialog) {
  dialog.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const choice = e.target.closest('[data-choice]');
    if (choice) answer(choice.dataset.choice === 'yes');
    else advanceDialog();
  });
}
window.addEventListener('keydown', (e) => {
  if (state.isPaused || !lines.length) return;
  const key = e.key.toLowerCase();
  if (onAnswer && choices && !choices.hidden) {
    if (key === 'enter' || key === 'y') answer(true);
    else if (key === 'n') answer(false);
  } else if (key === 'enter') {
    advanceDialog();
  }
});

// --- HUD AND WAYPOINT ---
function airportByName(name) {
  return ChillFlightLogic.AIRPORTS.find((a) => a.name === name);
}

function pointToDestination() {
  const a = airportByName(destination(run));
  if (a) setWaypoint(a.x, getElevation(a.x, a.z), a.z, true);
}

// Whether the waypoint is the errand's (not a detour)
function onErrandWaypoint() {
  const w = getWaypoint();
  const a = airportByName(destination(run));
  return !!(w && a && w.x === a.x && w.z === a.z);
}

// The row shows only on an errand
function updateHud() {
  if (!hud) return;
  const field = destination(run);
  hud.hidden = !field;
  if (statusPanel) statusPanel.style.display = hud.hidden ? 'flex' : 'none';
  if (hud.hidden) return;
  hudCount.textContent = `${run.delivered} delivered`;
  hudCargo.textContent = `${cargoLabel(run) || 'Empty'} → ${field}`;
}

function setRun(next) {
  run = next;
  save();
  updateHud();
}

// Clearing the errand's waypoint on the map drops the errand (minimap.js
// calls this just before clearing it). Clearing a detour doesn't.
export function cancelErrand() {
  if (!onErrandWaypoint()) return;
  setRun(cancel(run));
  Achievements.toast({
    emoji: '☕',
    label: 'ERRAND DROPPED',
    title: 'No worries',
  });
  log.info('[Coffee run] Errand cancelled');
}

drawFace(false);
updateHud();

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

function landedAt(a) {
  const person = PEOPLE[a.name];
  const result = land(run, a.name);
  if (result.run === run) return;
  const errandWaypoint = onErrandWaypoint();
  setRun(result.run);
  if (destination(run)) pointToDestination();
  // Delivered: the errand's waypoint is done
  else if (errandWaypoint) clearWaypoint();
  if (result.toast) Achievements.toast({emoji: '☕', ...result.toast});
  if (result.offer) {
    openDialog(person, result.dialog, (yes) => {
      const reply = yes ? accept(run) : decline(run);
      setRun(reply.run);
      if (yes) pointToDestination();
      openDialog(person, reply.dialog);
      log.info(`[Coffee run] Errand ${yes ? 'taken' : 'turned down'}`);
    });
  } else if (result.dialog) {
    openDialog(person, result.dialog);
  }
  log.info(`[Coffee run] Landed at ${a.name}, next: ${destination(run)}`);
}

function update() {
  requestAnimationFrame(update);
  if (!planeGroup || state.isPaused) return;
  // The row stands in for the AUTOPILOT line too
  if (hudAuto && hudAuto.hidden === state.autopilotEnabled) {
    hudAuto.hidden = !state.autopilotEnabled;
  }
  // A detour's waypoint was reached or cleared: back to the errand
  if (destination(run) && !getWaypoint()) pointToDestination();
  const kts = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  if (!isOnWheels() || kts > STOPPED_KTS) {
    stoppedAt = null;
    return;
  }
  const a = airportAt(planeGroup.position.x, planeGroup.position.z);
  if (!a || a === stoppedAt) return;
  stoppedAt = a;
  landedAt(a);
}

requestAnimationFrame(update);
