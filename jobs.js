// --- JOBS ---
// Plays the jobs people offer (people.js has them, jobs-logic.js the rules).
// Land at an airport (rolling on the runway, slowed to a stop) and someone
// there offers a job, which you take or turn down. On a job, the waypoint
// points to the next airport and stays until you land there, and the HUD
// shows who it's for, what you're carrying and where to. Clearing the
// waypoint on the map drops the job (minimap.js calls cancelJob); another
// waypoint is a detour, and once it's reached or cleared the job's comes
// back. Progress is saved between visits.
import {log} from './logger.js';
import {ChillFlightLogic} from './chill-flight-logic.js';
import {state} from './state.js';
import {planeGroup} from './airplane.js';
import {getElevation} from './terrain-geometry.js';
import {Achievements} from './achievements.js';
import {isOnWheels} from './flight-physics.js';
import {clearWaypoint, getWaypoint, setWaypoint} from './waypoint.js';
import {BASE_FLIGHT_SPEED} from './constants.js';
import {openDialog} from './dialog.js';
import {playChime} from './sfx-events.js';
import {hooks} from './hooks.js';
import {
  accept,
  cancel,
  cargoLabel,
  decline,
  destination,
  fromCoffeeRun,
  land,
  newProgress,
  validProgress,
} from './jobs-logic.js';

const PROGRESS_KEY = 'chill_flight_jobs';
// Where the coffee run, before there were people, kept its progress
const OLD_COFFEE_KEY = 'chill_flight_coffee_run';
// Slower than this (knots) on the wheels counts as stopped
const STOPPED_KTS = 20;

const hud = document.getElementById('job-hud');
const hudPerson = document.getElementById('job-hud-person');
const hudCargo = document.getElementById('job-hud-cargo');
const hudAuto = document.getElementById('job-hud-auto');
// The cockpit's CHILL-FLIGHT / AUTOPILOT line, which the job row replaces
const statusPanel = document.getElementById('cockpit-status-panel');

export let progress = newProgress();
// The airport the plane last stopped at, so one stop counts once
let stoppedAt = null;

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null; // nothing saved, or storage unavailable
  }
}

// ?jobs=reset starts over, as if you'd never met anyone (for testing lines)
if (ChillFlightLogic.urlParams?.get('jobs') !== 'reset') {
  progress =
    validProgress(load(PROGRESS_KEY)) ||
    fromCoffeeRun(load(OLD_COFFEE_KEY)) ||
    progress;
}

function save() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable: it lasts this visit */
  }
}

// --- HUD AND WAYPOINT ---
function airportByName(name) {
  return ChillFlightLogic.AIRPORTS.find((a) => a.name === name);
}

function pointToDestination() {
  const a = airportByName(destination(progress));
  if (a) {
    setWaypoint(a.x, getElevation(a.x, a.z), a.z, {stay: true, name: a.name});
  }
}

// Whether the waypoint is the job's (not a detour)
function onJobWaypoint() {
  const w = getWaypoint();
  const a = airportByName(destination(progress));
  return !!(w && a && w.x === a.x && w.z === a.z);
}

// The row shows only on a job
function updateHud() {
  if (!hud) return;
  const field = destination(progress);
  hud.hidden = !field;
  if (statusPanel) statusPanel.style.display = hud.hidden ? 'flex' : 'none';
  if (hud.hidden) return;
  hudPerson.textContent = progress.job.person;
  hudCargo.textContent = `${cargoLabel(progress) || 'Empty'} → ${field}`;
}

function setProgress(next) {
  progress = next;
  save();
  updateHud();
  hooks.onJobProgress?.();
}

// Clearing the job's waypoint on the map drops the job (minimap.js calls
// this just before clearing it). Clearing a detour doesn't.
export function cancelJob() {
  if (!onJobWaypoint()) return;
  setProgress(cancel(progress));
  Achievements.toast({emoji: '📦', label: 'JOB DROPPED', title: 'No worries'});
  log.info('[Jobs] Job dropped');
}

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
  const result = land(progress, a.name);
  if (result.toast) {
    Achievements.toast({emoji: '📦', ...result.toast});
    playChime();
  }
  if (result.offer) {
    const {offer, person} = result;
    openDialog(person, result.dialog, (yes) => {
      const reply = yes ? accept(progress, offer) : decline(progress, offer);
      setProgress(reply.progress);
      if (yes) pointToDestination();
      openDialog(person, reply.dialog);
      log.info(
        `[Jobs] ${person.name}'s ${offer.id} ${yes ? 'taken' : 'turned down'}`
      );
    });
    return;
  }
  if (result.progress === progress) return;
  const jobWaypoint = onJobWaypoint();
  setProgress(result.progress);
  if (destination(progress)) pointToDestination();
  // Done: the job's waypoint is too
  else if (jobWaypoint) clearWaypoint();
  if (result.dialog) openDialog(result.person, result.dialog);
  log.info(`[Jobs] Landed at ${a.name}, next: ${destination(progress)}`);
}

function update() {
  requestAnimationFrame(update);
  if (!planeGroup || state.isPaused) return;
  // The row stands in for the AUTOPILOT line too
  if (hudAuto && hudAuto.hidden === state.autopilotEnabled) {
    hudAuto.hidden = !state.autopilotEnabled;
  }
  // A detour's waypoint was reached or cleared: back to the job
  if (destination(progress) && !getWaypoint()) pointToDestination();
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
