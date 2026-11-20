// --- JOBS ---
// Plays the jobs people offer (people.js has them, jobs-logic.js the rules).
// Land at an airport (rolling on the runway, slowed to a stop) and someone
// there offers a job, which you take or turn down. That's once a visit:
// stopping again before you leave the airport says nothing, and leaving
// mid-conversation ends it (an offer left unanswered comes up next time).
// On a job, the waypoint points to the next airport (or, sightseeing, the
// sight to pass) and stays until you land there (or pass it), and the HUD
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
import {openDialog, closeDialog, changeOutfit} from './dialog.js';
import {playChime} from './sfx-events.js';
import {notificationHaptic} from './haptics.js';
import {hooks} from './hooks.js';
import {PEOPLE} from './people.js';
import {AIRPORT_COLOR, LANDMARKS} from './landmarks.js';
import {
  accept,
  cancel,
  cargoLabel,
  decline,
  destination,
  fromCoffeeRun,
  land,
  newProgress,
  passSight,
  sightAhead,
  sightRadius,
  validProgress,
  visit,
} from './jobs-logic.js';
import {t} from './i18n.js';

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

// The landmarks (not airports) this world has, which sightseeing jobs can
// send you past
const SIGHTS = LANDMARKS.filter((lm) => lm.color !== AIRPORT_COLOR);
const SIGHT_NAMES = SIGHTS.map((lm) => lm.name);

export let progress = newProgress();
// The airport you're visiting (see visit in jobs-logic.js), so a visit
// gets one greeting
let visiting = null;

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
    validProgress(load(PROGRESS_KEY), PEOPLE, SIGHT_NAMES) ||
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
// An airport, or a sight
function placeByName(name) {
  return (
    ChillFlightLogic.AIRPORTS.find((a) => a.name === name) ||
    SIGHTS.find((lm) => lm.name === name)
  );
}

function pointToDestination() {
  const a = placeByName(destination(progress));
  if (a) {
    setWaypoint(a.x, getElevation(a.x, a.z), a.z, {
      stay: true,
      flyby: Boolean(sightAhead(progress)),
      name: a.name,
    });
  }
}

// Whether the waypoint is the job's (not a detour)
function onJobWaypoint() {
  const w = getWaypoint();
  const a = placeByName(destination(progress));
  return !!(w && a && w.x === a.x && w.z === a.z);
}

// The row shows only on a job
function updateHud() {
  if (!hud) return;
  const field = destination(progress);
  hud.hidden = !field;
  if (statusPanel) statusPanel.style.display = hud.hidden ? 'flex' : 'none';
  if (hud.hidden) return;
  hudPerson.textContent = t(progress.job.person);
  const cargo = cargoLabel(progress);
  hudCargo.textContent = `${cargo ? t(cargo) : t('Empty')} → ${t(field)}`;
}

// Odd jobs (a job done for anyone) and meeting everyone
function jobAchievements(p) {
  if (Object.values(p.done).some((n) => n > 0)) {
    Achievements.unlock('odd_jobs');
  }
  if (PEOPLE.every((person) => p.met[person.name])) {
    Achievements.unlock('everybody_knows');
  }
}

function setProgress(next) {
  progress = next;
  save();
  updateHud();
  jobAchievements(progress);
  hooks.onJobProgress?.();
}

// Clearing the job's waypoint on the map drops the job (minimap.js calls
// this just before clearing it). Clearing a detour doesn't.
export function cancelJob() {
  if (!onJobWaypoint()) return;
  setProgress(cancel(progress));
  Achievements.toast({
    emoji: '📦',
    label: t('JOB DROPPED'),
    title: t('No worries'),
  });
  log.info('[Jobs] Job dropped');
}

updateHud();
if (onJobWaypoint()) pointToDestination();
// Earned before these achievements existed
jobAchievements(progress);

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
  const result = land(progress, a.name, Math.random, PEOPLE, SIGHT_NAMES);
  if (result.offer && state.isVRPresenting) {
    visiting = null;
    return;
  }
  if (result.person) changeOutfit(result.person.name, result.outfit);
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
  const wasOnJob = Boolean(progress.job);
  const jobWaypoint = onJobWaypoint();
  setProgress(result.progress);
  if (wasOnJob && !result.progress.job) {
    notificationHaptic('SUCCESS');
  }
  if (destination(progress)) pointToDestination();
  // Done: the job's waypoint is too
  else if (jobWaypoint) clearWaypoint();
  if (result.dialog && !state.isVRPresenting) {
    openDialog(result.person, result.dialog);
  }
  log.info(`[Jobs] Landed at ${a.name}, next: ${destination(progress)}`);
}

// Passed the sightseeing job's sight: on to home
function checkSight(x, z) {
  const name = sightAhead(progress);
  const sight = name && placeByName(name);
  if (!sight) return;
  if (Math.hypot(sight.x - x, sight.z - z) > sightRadius(name)) return;
  const result = passSight(progress, name);
  if (!result) return;
  setProgress(result.progress);
  pointToDestination();
  Achievements.toast({emoji: '📸', ...result.toast});
  playChime();
  log.info(`[Jobs] Passed ${name}, next: ${destination(progress)}`);
}

let wasVRPresenting = false;

export function updateJobs() {
  if (!planeGroup || state.isPaused) return;
  if (state.isVRPresenting && !wasVRPresenting) {
    closeDialog();
    if (!progress.job) visiting = null;
  }
  wasVRPresenting = state.isVRPresenting;
  // The row stands in for the AUTOPILOT line too
  if (hudAuto && hudAuto.hidden === state.autopilotEnabled) {
    hudAuto.hidden = !state.autopilotEnabled;
  }
  // A detour's waypoint was reached or cleared: back to the job
  if (destination(progress) && !getWaypoint()) pointToDestination();
  const {x, z} = planeGroup.position;
  checkSight(x, z);
  const kts = BASE_FLIGHT_SPEED * Math.abs(state.flightSpeedMultiplier) * 60;
  // Suppress unsolicited 2D NPC offers while in VR so stopping on a runway does
  // not play invisible dialog blips; active jobs still advance and chime.
  const suppressOfferInVR = state.isVRPresenting && !progress.job;
  const stopped = !suppressOfferInVR && isOnWheels() && kts <= STOPPED_KTS;
  const away = visiting
    ? ChillFlightLogic.airportDistance(visiting, x, z)
    : Infinity;
  const step = visit(visiting, away, stopped ? airportAt(x, z) : null);
  visiting = step.visiting;
  if (step.left) {
    closeDialog();
    log.info(`[Jobs] Left ${step.left.name}`);
  }
  if (step.arrived) landedAt(step.arrived);
}
