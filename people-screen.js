// --- PEOPLE SCREEN ---
// The People screen (the 👥 button on the pause menu, by Achievements): a
// card for everyone in people.js with their face, where they are and how
// many jobs you've done for them. Someone you haven't met yet is a
// silhouette and "???", with just their airport.
import {PEOPLE} from './people.js';
import {doneFor} from './jobs-logic.js';
import {progress} from './jobs.js';
import {drawFace} from './dialog.js';
import {hooks} from './hooks.js';

const overlay = document.getElementById('people-overlay');
const openBtn = document.getElementById('people-btn');
const closeBtn = document.getElementById('people-close-btn');
const grid = document.getElementById('people-grid');
const progressText = document.getElementById('people-progress');
const counter = document.getElementById('people-counter');

function metCount() {
  return PEOPLE.filter((p) => progress.met[p.name]).length;
}

function updateCounter() {
  if (counter) counter.textContent = `${metCount()}/${PEOPLE.length}`;
}

function card(person) {
  const met = !!progress.met[person.name];
  const done = doneFor(progress, person.name);
  const el = document.createElement('div');
  el.className = `achievement-card ${met ? 'unlocked' : 'locked'}`;
  const face = document.createElement('canvas');
  face.className = 'person-card-face';
  drawFace(face, person.face, {hidden: !met});
  const title = document.createElement('div');
  title.className = 'achievement-card-title';
  title.textContent = met ? person.name : '???';
  const hint = document.createElement('div');
  hint.className = 'achievement-card-hint';
  hint.textContent = met
    ? `${person.airport} · ${done === 1 ? '1 job' : `${done} jobs`}`
    : person.airport;
  el.append(face, title, hint);
  return el;
}

function render() {
  if (!grid) return;
  grid.replaceChildren(...PEOPLE.map(card));
  const jobs = PEOPLE.reduce((n, p) => n + doneFor(progress, p.name), 0);
  if (progressText) {
    progressText.textContent = `${metCount()} of ${PEOPLE.length} met · ${jobs} ${jobs === 1 ? 'job' : 'jobs'} done`;
  }
  updateCounter();
}

function close() {
  if (overlay) overlay.style.display = 'none';
}

openBtn?.addEventListener('click', () => {
  render();
  if (overlay) overlay.style.display = 'flex';
});
closeBtn?.addEventListener('click', close);
// Click outside the cards to close
overlay?.addEventListener('click', (e) => {
  if (e.target === overlay) close();
});

hooks.onJobProgress = updateCounter;
updateCounter();
