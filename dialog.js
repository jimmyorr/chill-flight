// --- DIALOG ---
// People talk in a box along the bottom of the screen (jobs.js opens it):
// their pixel face (faces.js), their name and their words, one line at a
// time, typed out while their mouth moves. A tap, click or Enter shows the
// whole line, then the next one, then closes it. A question waits on its
// last line for Sure thing (Enter or Y) or Not right now (N).
import {state} from './state.js';
import {MOUTH_SECONDS, drawFace} from './faces.js';

// Characters typed per second
const TYPE_RATE = 35;

const dialog = document.getElementById('npc-dialog');
const portrait = document.getElementById('npc-portrait');
const dialogName = document.getElementById('npc-dialog-name');
const dialogText = document.getElementById('npc-dialog-text');
const choices = document.getElementById('npc-dialog-choices');

let face = null;
let lines = [];
let lineIndex = 0;
let typing = null;
let onAnswer = null;

function stopTyping() {
  if (typing) clearInterval(typing);
  typing = null;
  drawFace(portrait, face);
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
    drawFace(portrait, face, {
      mouthClosed: Math.floor(elapsed / MOUTH_SECONDS) % 2 === 1,
    });
    if (shown >= line.length) stopTyping();
  }, 1000 / TYPE_RATE);
}

// person ({name, face}) says newLines. With answer, the last line is a
// question, and answer(yes) is called with the reply.
export function openDialog(person, newLines, answer = null) {
  if (!dialog || !newLines?.length) return;
  dialogName.textContent = person.name;
  face = person.face;
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
