#!/usr/bin/env node
/**
 * scripts/test-jobs.js
 *
 * Checks people.js (every person and job is filled in and points at real
 * airports, and everyone has a talking face of their own in faces.js) and
 * the job rules (jobs-logic.js): someone offers a job when you land at their
 * airport with nothing on, turning it down leaves nothing on,
 * a round trip goes there and back, a one-way job ends where it sends you,
 * only the destination moves a job on, the person you've helped least asks
 * first, dropping a job cancels it, and saved progress is checked before
 * it's used.
 */
import {ChillFlightLogic} from '../chill-flight-logic.js';
import {PEOPLE} from '../people.js';
import {checkFaces} from '../faces.js';
import {
  accept,
  cancel,
  cargoLabel,
  checkPeople,
  decline,
  destination,
  doneFor,
  fromCoffeeRun,
  land,
  newProgress,
  validProgress,
} from '../jobs-logic.js';

console.log('Testing people and jobs...');

let failed = false;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
    failed = true;
  }
}

// A seeded random, so failures repeat
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const AIRPORTS = ChillFlightLogic.AIRPORTS.map((a) => a.name);
const unfilled = (dialog) => dialog?.some((line) => line.includes('{'));

const problems = checkPeople(PEOPLE, AIRPORTS);
check('people.js is all filled in', !problems.length, problems.join('; '));
const faceProblems = checkFaces(PEOPLE.map((p) => p.name));
check(
  'everyone has one face of their own',
  !faceProblems.length,
  faceProblems.join('; ')
);

// Two made-up people sharing an airport, for the rules
const line = ['Hi.'];
const TEST_PEOPLE = [
  {
    name: 'Ann',
    airport: 'Meadow Field',
    intro: ['Hi, I am {name}.'],
    hello: line,
    accept: line,
    decline: line,
    jobs: [
      {
        id: 'fetch',
        kind: 'round trip',
        to: ['Lagoon Field', 'Mesa Field'],
        cargo: 'Mail',
        offer: ['Fetch the mail from {to}?'],
        thanks: ['Thanks! {done} now.'],
      },
    ],
  },
  {
    name: 'Bo',
    airport: 'Meadow Field',
    intro: line,
    hello: line,
    accept: line,
    decline: line,
    jobs: [
      {
        id: 'drop',
        kind: 'one way',
        to: ['Pinewood Field'],
        cargo: 'Pie',
        offer: ['Take this pie to {to}?'],
        thanks: ['They loved it.'],
      },
    ],
  },
];
check(
  'the made-up people check out',
  !checkPeople(TEST_PEOPLE, AIRPORTS).length
);
check(
  'a broken person is caught',
  checkPeople(
    [
      {
        ...TEST_PEOPLE[0],
        airport: 'Nowhere',
        jobs: [{id: 'x', kind: 'teleport'}],
      },
    ],
    AIRPORTS
  ).length >= 3
);

const badOffers = [];
const badJobs = [];
for (let seed = 1; seed <= 50; seed++) {
  const r = rng(seed);
  let p = newProgress();

  // With nothing on, only an airport with people has anything to say
  let ok = destination(p, TEST_PEOPLE) === null;
  if (land(p, 'Lagoon Field', r, TEST_PEOPLE).offer) ok = false;
  const first = land(p, 'Meadow Field', r, TEST_PEOPLE);
  if (!first.offer || unfilled(first.dialog) || first.progress !== p)
    ok = false;
  if (
    !first.dialog?.[0]?.startsWith('Hi, I am') &&
    first.person.name === 'Ann'
  ) {
    ok = false;
  }
  // Not right now: still nothing on, met, and asked again next time
  const no = decline(p, first.offer, r, TEST_PEOPLE);
  if (destination(no.progress, TEST_PEOPLE) !== null) ok = false;
  if (!no.progress.met[first.person.name]) ok = false;
  if (!land(no.progress, 'Meadow Field', r, TEST_PEOPLE).offer) ok = false;
  if (!ok) badOffers.push(seed);

  // Ten jobs: each taken, landing anywhere else changes nothing, and the
  // destination moves it on
  p = no.progress;
  for (let n = 0; n < 10 && ok; n++) {
    const {offer, person} = land(p, 'Meadow Field', r, TEST_PEOPLE);
    // The one you've helped least asks first
    const other = TEST_PEOPLE.find((q) => q.name !== person.name);
    if (doneFor(p, person.name) > doneFor(p, other.name)) ok = false;
    const yes = accept(p, offer, r, TEST_PEOPLE);
    p = yes.progress;
    if (destination(p, TEST_PEOPLE) !== offer.to) ok = false;
    const legs = person.jobs[0].kind === 'round trip' ? 2 : 1;
    for (let leg = 0; leg < legs && ok; leg++) {
      const target = destination(p, TEST_PEOPLE);
      for (const a of AIRPORTS.filter((a) => a !== target)) {
        if (land(p, a, r, TEST_PEOPLE).progress !== p) ok = false;
      }
      const result = land(p, target, r, TEST_PEOPLE);
      if (unfilled(result.dialog) || result.offer || !result.toast) ok = false;
      p = result.progress;
      if (leg < legs - 1 && cargoLabel(p, TEST_PEOPLE) !== 'Mail') ok = false;
    }
    if (p.job !== null || unfilled(yes.dialog)) ok = false;
  }
  const total = doneFor(p, 'Ann') + doneFor(p, 'Bo');
  if (!ok || total !== 10 || Math.abs(doneFor(p, 'Ann') - 5) > 1) {
    badJobs.push(seed);
  }
}
check(
  'someone offers a job, and not right now leaves nothing on',
  !badOffers.length,
  `seeds ${badOffers}`
);
check(
  'ten jobs, shared fairly, moved on only at the destination',
  !badJobs.length,
  `seeds ${badJobs}`
);

// Meadow Field's jobs play through too (Ray and Bonnie share the field)
{
  const r = rng(7);
  let p = newProgress();
  let done = 0;
  for (let n = 0; n < 6; n++) {
    const {offer} = land(p, 'Meadow Field', r);
    p = accept(p, offer, r).progress;
    for (let leg = 0; leg < 2 && p.job; leg++) {
      p = land(p, destination(p), r).progress;
    }
    if (!p.job) done++;
  }
  check(
    "Meadow Field's jobs play through",
    done === 6 && doneFor(p, 'Ray') === 3 && doneFor(p, 'Bonnie') === 3
  );
}

const r = rng(3);
const {offer} = land(newProgress(), 'Meadow Field', r, TEST_PEOPLE);
const onJob = accept(newProgress(), offer, r, TEST_PEOPLE).progress;
check(
  'the first job taken explains dropping it',
  accept(newProgress(), offer, r, TEST_PEOPLE).dialog.some((l) =>
    l.includes('waypoint')
  ) &&
    !accept(onJob, offer, r, TEST_PEOPLE).dialog.some((l) =>
      l.includes('waypoint')
    )
);
check(
  'cancelling drops the job',
  destination(cancel(onJob), TEST_PEOPLE) === null
);
check(
  'a saved job comes back',
  validProgress(onJob, TEST_PEOPLE)?.job !== null
);
check(
  "a saved job that's gone from people.js is dropped",
  validProgress({...onJob, job: {...onJob.job, id: 'gone'}}, TEST_PEOPLE)
    ?.job === null
);
check('a broken save is ignored', validProgress({done: 5}) === null);
check('nothing saved is ignored', validProgress(null) === null);
check(
  "the coffee run's deliveries count for Ray",
  doneFor(fromCoffeeRun({delivered: 4, met: true}), 'Ray') === 4
);

if (failed) {
  console.error('People and jobs tests failed.');
  process.exit(1);
}
console.log('People and jobs tests passed.');
