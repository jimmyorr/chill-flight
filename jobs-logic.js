// --- JOBS: LOGIC ---
// The rules for the jobs people offer (people.js has the people, jobs.js
// plays it). Land at an airport with no job on and someone there offers one,
// which you take or turn down. A round trip sends you to an airport to pick
// something up and back to them; a one-way job ends when you land where it
// sends you. A sightseeing job sends you past a landmark (a sight) and back
// to them: flying (or driving) within its pass zone counts, no landing.
// Landing anywhere else on the way does nothing. Dropping a job
// (clearing its waypoint) cancels it. Progress is who you've met, how many
// jobs you've done for each and the job you're on.
// No DOM or three.js, so scripts/test-jobs.js can run it in Node.
import {PEOPLE} from './people.js';
import {t} from './i18n.js';

export const KINDS = ['round trip', 'one way', 'sightseeing'];

// How close (world units, across the ground) counts as passing a sight,
// by its name in landmarks.js: wider for the big ones
export const SIGHT_RADIUS = {
  Volcano: 1300,
  Canyon: 1100,
  Pyramids: 800,
  Skeleton: 700,
  Falls: 700,
  'Rock Arch': 550,
  Lighthouse: 500,
};
const DEFAULT_SIGHT_RADIUS = 600;
export function sightRadius(name) {
  return SIGHT_RADIUS[name] || DEFAULT_SIGHT_RADIUS;
}

// Said after the first job you ever take, so dropping one is easy to find
const FIRST_JOB_TIP =
  'If something comes up, just clear the waypoint on the map.';
// (translated where it's said, as are people's lines: people.js has English)

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// A list of lines, or one of a list of choices (see people.js)
function lines(field, rng) {
  if (!field?.length) return [];
  return Array.isArray(field[0]) ? pick(field, rng) : field;
}

// A line starting with a {word} gets a capital letter ("{to} has a
// crate"); others keep theirs (Purrple Cat's "meow...")
function fill(text, words) {
  const filled = text.replace(/\{(\w+)\}/g, (_, key) => words[key] ?? '');
  if (!text.startsWith('{')) return filled;
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

// What a person says, in the player's language, with {to}, {name} and
// {done} filled in
function say(person, field, progress, to, rng) {
  const n = doneFor(progress, person.name);
  const words = {
    to: t(to),
    name: t(person.name),
    done: n === 1 ? t('1 job') : t('{n} jobs', {n}),
  };
  return lines(field, rng).map((line) => fill(t(line), words));
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
  // (a sightseeing job's cargo rides along both ways)
  return spec?.cargo || null;
}

// The sight a sightseeing job is heading for, while it's on the way out:
// otherwise null
export function sightAhead(progress, people = PEOPLE) {
  const job = progress.job;
  if (!job || job.step === 'back') return null;
  const spec = jobOf(personNamed(job.person, people), job.id);
  return spec?.kind === 'sightseeing' ? job.to : null;
}

// Where a job can send you from `field`: never there, and for sightseeing
// only sights this world has (sights: their names, or null for any)
function places(job, field, sights) {
  return job.to.filter(
    (a) =>
      a !== field &&
      (job.kind !== 'sightseeing' || !sights || sights.includes(a))
  );
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

// Someone at field with no jobs to offer says hello (their intro the first
// time), and that's them met. null when there's nobody like that there.
function greet(progress, field, people, rng) {
  const person = people.find((p) => p.airport === field && !p.jobs?.length);
  if (!person) return null;
  const greeting = progress.met[person.name] ? person.hello : person.intro;
  return {
    progress: {...progress, met: {...progress.met, [person.name]: true}},
    person,
    dialog: say(person, greeting, progress, null, rng),
    offer: null,
    outfit: null,
    toast: null,
  };
}

// Landed and stopped at the airport named field. Returns the progress after
// it, who's talking (person, or null), what they say (dialog, or null), a
// job they offer (offer: answer it with accept or decline), the outfit they
// wear for that job (or null) and a note for a toast (or null).
// sights: the sights this world has (null for any), for sightseeing jobs.
export function land(
  progress,
  field,
  rng = Math.random,
  people = PEOPLE,
  sights = null
) {
  const none = {
    progress,
    person: null,
    dialog: null,
    offer: null,
    outfit: null,
    toast: null,
  };

  // No job on: someone here offers one
  if (!progress.job) {
    const person = asker(progress, field, people, rng);
    if (!person) return greet(progress, field, people, rng) || none;
    const open = person.jobs.filter((j) => places(j, field, sights).length);
    if (!open.length) return none;
    const job = pick(open, rng);
    const to = pick(places(job, field, sights), rng);
    const greeting = progress.met[person.name] ? person.hello : person.intro;
    return {
      progress,
      person,
      dialog: [
        ...say(person, greeting, progress, to, rng),
        ...say(person, job.offer, progress, to, rng),
      ],
      offer: {person: person.name, id: job.id, to},
      outfit: job.outfit || null,
      toast: null,
    };
  }

  if (field !== destination(progress, people)) {
    return greet(progress, field, people, rng) || none;
  }
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
      outfit: null,
      toast: {
        label: t('PICKED UP'),
        title: spec.cargo
          ? t(spec.cargo)
          : t('For {name}', {name: t(person.name)}),
      },
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
    outfit: spec.outfit || null,
    toast: {
      label: t('JOB DONE'),
      title: t('For {name}', {name: t(person.name)}),
    },
  };
}

// Flew (or drove) past `sight` (within sightRadius of it). On a sightseeing
// job headed there, it's seen: back to them. Returns the progress after it
// and a note for a toast, or null when it isn't the job's sight.
export function passSight(progress, sight, people = PEOPLE) {
  if (!sight || sightAhead(progress, people) !== sight) return null;
  return {
    progress: {...progress, job: {...progress.job, step: 'back'}},
    toast: {label: t('SIGHT SEEN'), title: t(sight)},
  };
}

// Yes to the job land() offered
export function accept(progress, offer, rng = Math.random, people = PEOPLE) {
  const person = personNamed(offer.person, people);
  const dialog = say(person, person.accept, progress, offer.to, rng);
  if (!progress.tipped) dialog.push(t(FIRST_JOB_TIP));
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

// A visit to an airport lasts from stopping on its field until you're
// LEAVE_MARGIN (world units) past its edge, so taxiing about and stopping
// again doesn't start another, and touching down and stopping outside it
// does. visiting is the airport you're visiting (or null), away how far past
// its field you are, stoppedOn the airport whose field you're stopped on (or
// null). Says who you're visiting now, and the airport you arrived at or
// left this time, if any.
export const LEAVE_MARGIN = 200;
export function visit(visiting, away, stoppedOn) {
  if (visiting && away > LEAVE_MARGIN) return {visiting: null, left: visiting};
  if (!visiting && stoppedOn) return {visiting: stoppedOn, arrived: stoppedOn};
  return {visiting};
}

// The job is dropped (its waypoint was cleared on the map)
export function cancel(progress) {
  return {...progress, job: null};
}

const isCounts = (o) =>
  o && typeof o === 'object' && Object.values(o).every(Number.isFinite);

// Saved progress, if it's whole: otherwise null. A job whose person or job
// is gone from people.js, or whose sight this world doesn't have (sights:
// their names, or null for any), is dropped.
export function validProgress(saved, people = PEOPLE, sights = null) {
  if (!saved || typeof saved !== 'object') return null;
  if (!isCounts(saved.done) || !saved.met || typeof saved.met !== 'object') {
    return null;
  }
  let job = saved.job || null;
  if (job) {
    const spec = jobOf(personNamed(job.person, people), job.id);
    const ok =
      spec &&
      spec.to.includes(job.to) &&
      ['out', 'back'].includes(job.step) &&
      (spec.kind !== 'sightseeing' || !sights || sights.includes(job.to));
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
// (sights: the landmark names a sightseeing job can send you past)
export function checkPeople(people, airports, sights = []) {
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
    // (someone with no jobs just says hello: no accept or decline)
    const offers = p.jobs?.length > 0;
    for (const what of ['intro', 'hello', 'accept', 'decline']) {
      checkLines(
        who,
        what,
        p[what],
        offers || what === 'intro' || what === 'hello'
      );
    }
    if (!Array.isArray(p.jobs)) problems.push(`${who}: no jobs list`);
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
      const known = j.kind === 'sightseeing' ? sights : airports;
      for (const a of j.to || []) {
        if (!known.includes(a)) problems.push(`${job}: unknown place ${a}`);
      }
      checkLines(job, 'offer', j.offer, true);
      checkLines(job, 'thanks', j.thanks, true);
    }
  }
  return problems;
}
