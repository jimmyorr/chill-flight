// --- COFFEE RUN: LOGIC ---
// The coffee run's errands (coffee-run.js plays them). Ray roasts coffee at
// Meadow Field. Land there with nothing on and he offers an errand, which you
// can take or turn down: fly to a farm for a crate of green beans, bring it
// back for him to roast, then fly the roasted bags to a cafe. Landing at the
// field you're headed for moves the errand on; other landings do nothing.
// Clearing the waypoint on the map cancels it. There's no money yet: the run
// counts the deliveries.
// No DOM or three.js, so scripts/test-coffee.js can run it in Node.

export const ROASTERY = 'Meadow Field';
// Who you talk to when you land at each field with nothing on
export const PEOPLE = {[ROASTERY]: 'Ray'};
// The farms (by airport name) and what grows there
export const FARMS = {
  'Lagoon Field': {bean: 'island beans'},
  'Mesa Field': {bean: 'mesa beans'},
};

// The cafes that buy roasted bags (by airport name)
export const CAFES = {
  'Pinewood Field': 'the cabin cafe',
  'Lagoon Field': 'the beach shack',
  'Mesa Field': 'the canyon diner',
};

// Ray's lines. {bean}, {farm}, {cafe}, {buyer} and {delivered} are
// filled in from the errand.
const ERRAND_LINES = [
  ["Bud, we're almost out of {bean}.", 'Could you grab a crate from {farm}?'],
  [
    'I have a hankering to roast some {bean}.',
    '{farm} should have a crate ready. Want to fly over and get it?',
  ],
  [
    '{cafe} at {buyer} keeps asking for {bean}.',
    "Pick up a crate at {farm}? I'll roast them for the cafe.",
  ],
];
const ROAST_LINES = [
  [
    'Oh, these smell great, bud. Give me a minute...',
    'Done! Fly these bags to {cafe} at {buyer}.',
  ],
  [
    'Nice crate. A medium roast, I think.',
    'Roasted and bagged. {cafe} at {buyer} is expecting you.',
  ],
  [
    'Perfect timing, the roaster is hot.',
    'All set. Take them to {cafe} at {buyer}.',
  ],
];
// Back after a delivery
const THANKS_LINES = [
  ['{cafe} loved them? Of course they did.'],
  ["Welcome back, buddy! That's {delivered} delivered so far."],
  ['Another happy cafe. You make a good courier, bud.'],
];
// Dropping by again
const HELLO_LINES = [
  ['Hey, bud! Good to see you.'],
  ['Buddy! Pull up a chair.'],
  ["Look who's here! Coffee?"],
];
// The first time you land at the roastery
const WELCOME_LINES = [
  "Hey buddy, it's Ray! Welcome to the roastery.",
  'I roast, you fly. Land and roll to a stop on a runway to pick up or drop off.',
];
const ACCEPT_LINES = [
  ['Thanks, bud!'],
  ["You're the best, buddy."],
  ["Great! I'll be here."],
];
// Said after the first errand is taken, so cancelling is easy to find
const FIRST_ACCEPT_LINES = [
  'Thanks, bud! The waypoint will show you the way.',
  'If something comes up, just clear the waypoint on the map.',
];
const DECLINE_LINES = [
  ['No worries, bud. Come by anytime.'],
  ["All good. I'll be here, buddy."],
];

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

function fill(lines, run) {
  const words = {
    bean: FARMS[run.farm]?.bean ?? '',
    farm: run.farm ?? '',
    cafe: CAFES[run.buyer] ?? '',
    buyer: run.buyer ?? '',
    delivered: run.delivered === 1 ? 'one bag' : `${run.delivered} bags`,
  };
  return lines.map((line) => {
    const text = line.replace(/\{(\w+)\}/g, (_, key) => words[key] ?? '');
    // A line opening with a cafe's name ("the cabin cafe") starts a sentence
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
}

// A new run: nothing on yet, and Ray hasn't met you
export function newRun() {
  return {
    delivered: 0,
    met: false,
    back: false,
    step: null,
    farm: null,
    buyer: null,
    cargo: null,
  };
}

// Where the plane should fly next: null with no errand on
export function destination(run) {
  if (run.step === 'buy') return run.farm;
  if (run.step === 'roast') return ROASTERY;
  if (run.step === 'sell') return run.buyer;
  return null;
}

// What's in the hold, for the HUD: null when empty
export function cargoLabel(run) {
  const bean = FARMS[run.farm]?.bean;
  if (run.cargo === 'green') return `Green ${bean}`;
  if (run.cargo === 'roasted') return `Roasted ${bean}`;
  return null;
}

// Landed and stopped at the airport named field. Returns the run after it,
// what's said (dialog, null for nothing), whether it ends in a yes/no
// question (offer: answer it with accept or decline) and a note for a toast
// (or null).
export function land(run, field, rng = Math.random) {
  const none = {run, dialog: null, offer: false, toast: null};

  // Nothing on: whoever is here offers an errand
  if (run.step === null) {
    if (field !== ROASTERY) return none;
    const farm = pick(Object.keys(FARMS), rng);
    const buyer = pick(
      Object.keys(CAFES).filter((name) => name !== farm),
      rng
    );
    const next = {...run, farm, buyer, cargo: null};
    let greeting;
    if (!run.met) greeting = WELCOME_LINES;
    else if (run.back) greeting = fill(pick(THANKS_LINES, rng), run);
    else greeting = fill(pick(HELLO_LINES, rng), run);
    return {
      run: next,
      dialog: [...greeting, ...fill(pick(ERRAND_LINES, rng), next)],
      offer: true,
      toast: null,
    };
  }

  if (field !== destination(run)) return none;
  const bean = FARMS[run.farm].bean;

  if (run.step === 'buy') {
    return {
      run: {...run, step: 'roast', cargo: 'green'},
      dialog: null,
      offer: false,
      toast: {label: 'PICKED UP', title: `A crate of ${bean}`},
    };
  }

  if (run.step === 'roast') {
    const next = {...run, step: 'sell', cargo: 'roasted'};
    return {
      run: next,
      dialog: fill(pick(ROAST_LINES, rng), next),
      offer: false,
      toast: null,
    };
  }

  // Delivered: the errand is done, and Ray thanks you next time
  return {
    run: {
      ...run,
      step: null,
      cargo: null,
      delivered: run.delivered + 1,
      back: true,
    },
    dialog: null,
    offer: false,
    toast: {
      label: 'DELIVERED',
      title: `Roasted ${bean} to ${CAFES[run.buyer]}`,
    },
  };
}

// Yes to the errand land() offered: off to the farm
export function accept(run, rng = Math.random) {
  return {
    run: {...run, step: 'buy', met: true, back: false},
    dialog: run.met ? pick(ACCEPT_LINES, rng) : FIRST_ACCEPT_LINES,
  };
}

// Not right now: nothing on, and he'll ask again next time
export function decline(run, rng = Math.random) {
  return {
    run: {...run, met: true, farm: null, buyer: null},
    dialog: pick(DECLINE_LINES, rng),
  };
}

// The errand is dropped (the waypoint was cleared on the map)
export function cancel(run) {
  return {...run, step: null, farm: null, buyer: null, cargo: null};
}

// A saved run, if it's whole: otherwise null
export function validRun(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const onErrand = ['buy', 'roast', 'sell'].includes(saved.step);
  const ok =
    Number.isFinite(saved.delivered) &&
    typeof saved.met === 'boolean' &&
    (saved.step === null ||
      (onErrand && saved.farm in FARMS && saved.buyer in CAFES)) &&
    [null, 'green', 'roasted'].includes(saved.cargo);
  return ok ? {back: false, ...saved} : null;
}
