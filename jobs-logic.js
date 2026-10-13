// --- JOBS: LOGIC ---
// The rules for the jobs people offer (people.js has the people, jobs.js
// plays it). Land at an airport with no job on and someone there offers one,
// which you take or turn down. A round trip sends you to an airport to pick
// something up and back to them; a one-way job ends when you land where it
// sends you. Landing anywhere else on the way does nothing. Dropping a job
// (clearing its waypoint) cancels it. Progress is who you've met, how many
// jobs you've done for each and the job you're on.
// No DOM or three.js, so scripts/test-jobs.js can run it in Node.
import {PEOPLE} from './people.js';

export const KINDS = ['round trip', 'one way'];

// Said after the first job you ever take, so dropping one is easy to find
const FIRST_JOB_TIP =
  'If something comes up, just clear the waypoint on the map.';

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// A list of lines, or one of a list of choices (see people.js)
function lines(field, rng) {
  if (!field?.length) return [];
  return Array.isArray(field[0]) ? pick(field, rng) : field;
}

function fill(text, words) {
  const filled = text.replace(/\{(\w+)\}/g, (_, key) => words[key] ?? '');
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}

export function personNamed(name, people = PEOPLE) {
  return people.find((p) => p.name === name) || null;
}

function jobOf(person, id) {
  return person?.jobs.find((j) => j.id === id) || null;
}

// Nothing done yet, nobody met
export function newProgress() {
  return {met: {}, done: {}, job: null, tipped: false};
}

export function doneFor(progress, name) {
  return progress.done[name] || 0;
}

// What a person says, with {to}, {name} and {done} filled in
function say(person, field, progress, to, rng) {
  const n = doneFor(progress, person.name);
  const words = {to, name: person.name, done: n === 1 ? '1 job' : `${n} jobs`};
  return lines(field, rng).map((line) => fill(line, words));
}

// Where to fly next: null with no job on
export function destination(progress, people = PEOPLE) {
  const job = progress.job;
  if (!job) return null;
  if (job.step === 'back') return personNamed(job.person, people)?.airport;
  return job.to;
}

// What's in the hold, for the HUD: null when empty
export function cargoLabel(progress, people = PEOPLE) {
  const job = progress.job;
  if (!job) return null;
  const spec = jobOf(personNamed(job.person, people), job.id);
  if (spec?.kind === 'round trip' && job.step !== 'back') return null;
  return spec?.cargo || null;
}

// The person at `field` who asks first: the one you've helped least
function asker(progress, field, people, rng) {
  const here = people.filter((p) => p.airport === field && p.jobs.length);
  if (!here.length) return null;
  const least = Math.min(...here.map((p) => doneFor(progress, p.name)));
  return pick(
    here.filter((p) => doneFor(progress, p.name) === least),
    rng
  );
}

// Landed and stopped at the airport named field. Returns the progress after
// it, who's talking (person, or null), what they say (dialog, or null), a
// job they offer (offer: answer it with accept or decline) and a note for a
// toast (or null).
export function land(progress, field, rng = Math.random, people = PEOPLE) {
  const none = {progress, person: null, dialog: null, offer: null, toast: null};

  // No job on: someone here offers one
  if (!progress.job) {
    const person = asker(progress, field, people, rng);
    if (!person) return none;
    const job = pick(person.jobs, rng);
    const to = pick(
      job.to.filter((a) => a !== field),
      rng
    );
    if (!to) return none;
    const greeting = progress.met[person.name] ? person.hello : person.intro;
    return {
      progress,
      person,
      dialog: [
        ...say(person, greeting, progress, to, rng),
        ...say(person, job.offer, progress, to, rng),
      ],
      offer: {person: person.name, id: job.id, to},
      toast: null,
    };
  }

  if (field !== destination(progress, people)) return none;
  const {job} = progress;
  const person = personNamed(job.person, people);
  const spec = jobOf(person, job.id);

  // Picked up: back to them
  if (spec.kind === 'round trip' && job.step !== 'back') {
    return {
      progress: {...progress, job: {...job, step: 'back'}},
      person: null,
      dialog: null,
      offer: null,
      toast: {label: 'PICKED UP', title: spec.cargo || `For ${person.name}`},
    };
  }

  // Done
  const next = {
    ...progress,
    done: {...progress.done, [person.name]: doneFor(progress, person.name) + 1},
    job: null,
  };
  return {
    progress: next,
    person,
    dialog: say(person, spec.thanks, next, job.to, rng),
    offer: null,
    toast: {label: 'JOB DONE', title: `For ${person.name}`},
  };
}

// Yes to the job land() offered
export function accept(progress, offer, rng = Math.random, people = PEOPLE) {
  const person = personNamed(offer.person, people);
  const dialog = say(person, person.accept, progress, offer.to, rng);
  if (!progress.tipped) dialog.push(FIRST_JOB_TIP);
  return {
    progress: {
      ...progress,
      met: {...progress.met, [person.name]: true},
      job: {person: offer.person, id: offer.id, to: offer.to, step: 'out'},
      tipped: true,
    },
    dialog,
  };
}

// Not right now: they'll ask again next time
export function decline(progress, offer, rng = Math.random, people = PEOPLE) {
  const person = personNamed(offer.person, people);
  return {
    progress: {...progress, met: {...progress.met, [person.name]: true}},
    dialog: say(person, person.decline, progress, offer.to, rng),
  };
}

// The job is dropped (its waypoint was cleared on the map)
export function cancel(progress) {
  return {...progress, job: null};
}

const isCounts = (o) =>
  o && typeof o === 'object' && Object.values(o).every(Number.isFinite);

// Saved progress, if it's whole: otherwise null. A job whose person or job
// is gone from people.js is dropped.
export function validProgress(saved, people = PEOPLE) {
  if (!saved || typeof saved !== 'object') return null;
  if (!isCounts(saved.done) || !saved.met || typeof saved.met !== 'object') {
    return null;
  }
  let job = saved.job || null;
  if (job) {
    const spec = jobOf(personNamed(job.person, people), job.id);
    const ok =
      spec && spec.to.includes(job.to) && ['out', 'back'].includes(job.step);
    if (!ok) job = null;
  }
  return {tipped: false, ...saved, job};
}

// The coffee run's save, from before there were people: Ray's deliveries
// count as jobs done for him
export function fromCoffeeRun(saved) {
  if (!saved || !Number.isFinite(saved.delivered)) return null;
  return {
    ...newProgress(),
    met: saved.met ? {Ray: true} : {},
    done: saved.delivered ? {Ray: saved.delivered} : {},
    tipped: !!saved.met,
  };
}

// Problems with people.js, for scripts/test-jobs.js: [] when it's all good
export function checkPeople(people, airports) {
  const problems = [];
  const names = new Set();
  const lineSets = (field) =>
    !field?.length ? [] : Array.isArray(field[0]) ? field : [field];
  const checkLines = (who, what, field, required) => {
    const sets = lineSets(field);
    if (required && !sets.length) problems.push(`${who}: no ${what} lines`);
    for (const set of sets) {
      if (!set.length || !set.every((l) => typeof l === 'string' && l)) {
        problems.push(`${who}: ${what} has an empty or non-text line`);
      }
      for (const l of set) {
        for (const [, key] of String(l).matchAll(/\{(\w+)\}/g)) {
          if (!['to', 'name', 'done'].includes(key)) {
            problems.push(`${who}: ${what} uses unknown {${key}}`);
          }
        }
      }
    }
  };
  for (const p of people) {
    const who = p.name || '(no name)';
    if (!p.name) problems.push('a person has no name');
    if (names.has(p.name)) problems.push(`${who}: name used twice`);
    names.add(p.name);
    if (!airports.includes(p.airport)) {
      problems.push(`${who}: unknown airport ${p.airport}`);
    }
    for (const what of ['intro', 'hello', 'accept', 'decline']) {
      checkLines(who, what, p[what], true);
    }
    if (!p.jobs?.length) problems.push(`${who}: no jobs`);
    const ids = new Set();
    for (const j of p.jobs || []) {
      const job = `${who}'s ${j.id || '(no id)'}`;
      if (!j.id || ids.has(j.id))
        problems.push(`${job}: missing or repeated id`);
      ids.add(j.id);
      if (!KINDS.includes(j.kind))
        problems.push(`${job}: unknown kind ${j.kind}`);
      const to = (j.to || []).filter((a) => a !== p.airport);
      if (!to.length) problems.push(`${job}: nowhere to go`);
      for (const a of j.to || []) {
        if (!airports.includes(a))
          problems.push(`${job}: unknown airport ${a}`);
      }
      checkLines(job, 'offer', j.offer, true);
      checkLines(job, 'thanks', j.thanks, true);
    }
  }
  return problems;
}
