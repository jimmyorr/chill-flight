// --- COFFEE RUN: LOGIC ---
// The coffee run's errands (coffee-run.js plays them): Ray roasts coffee at
// Meadow Field. He sends you to a farm for a crate of green beans, you bring
// it back for him to roast, fly the roasted bags to a cafe, and come home for
// the next errand. Landing at the field you're headed for moves it on; every
// other landing does nothing. There's no money yet: the run counts the
// deliveries.
// No DOM or three.js, so scripts/test-coffee.js can run it in Node.

export const ROASTERY = 'Meadow Field';
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
    'Morning, buddy! I have a hankering to roast some {bean}.',
    "{farm} should have a crate ready. I'll get the roaster warmed up.",
  ],
  [
    '{cafe} at {buyer} keeps asking for {bean}.',
    "Pick up a crate at {farm} and I'll roast them.",
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
const RETURN_LINES = [
  ['{cafe} loved them? Of course they did.'],
  ["Welcome back, buddy! That's {delivered} delivered so far."],
  ['Another happy cafe. You make a good courier, bud.'],
];

// When the run starts, wherever you are: come and meet him
const INTRO_LINES = [
  "Hey buddy, it's Ray! Thanks for helping out at the roastery.",
  "Come find me at Meadow Field and I'll show you the ropes.",
];
// Landing at the roastery the first time, before the first errand
const WELCOME_LINES = [
  'Welcome to the roastery!',
  'I roast, you fly. Land and roll to a stop on the runway to pick up or drop off.',
];

function pick(list, rng) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

function fill(lines, run) {
  const farm = FARMS[run.farm];
  const words = {
    bean: farm?.bean ?? '',
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

// A fresh errand: a farm to buy from, and a cafe (not that farm) to sell to
function newErrand(run, rng) {
  const farm = pick(Object.keys(FARMS), rng);
  const buyer = pick(
    Object.keys(CAFES).filter((name) => name !== farm),
    rng
  );
  return {...run, step: 'buy', farm, buyer, cargo: null};
}

// A new run: Ray says hi and asks you to come to the roastery, where he has
// the first errand
export function startRun(rng = Math.random) {
  const run = {...newErrand({delivered: 0, met: false}, rng), step: 'return'};
  return {run, dialog: INTRO_LINES};
}

// Where the plane should fly next
export function destination(run) {
  if (run.step === 'buy') return run.farm;
  if (run.step === 'sell') return run.buyer;
  return ROASTERY;
}

// What's in the hold, for the HUD: null when empty
export function cargoLabel(run) {
  const bean = FARMS[run.farm]?.bean;
  if (run.cargo === 'green') return `Green ${bean}`;
  if (run.cargo === 'roasted') return `Roasted ${bean}`;
  return null;
}

// Landed and stopped at the airport named field. Returns the run after it,
// with Ray's lines (dialog) and a note for a toast, either null when there's
// nothing to say. A field that isn't the destination changes nothing.
export function land(run, field, rng = Math.random) {
  if (field !== destination(run)) return {run, dialog: null, toast: null};
  const farm = FARMS[run.farm];

  if (run.step === 'buy') {
    return {
      run: {...run, step: 'roast', cargo: 'green'},
      dialog: null,
      toast: {label: 'PICKED UP', title: `A crate of ${farm.bean}`},
    };
  }

  if (run.step === 'roast') {
    const next = {...run, step: 'sell', cargo: 'roasted'};
    return {run: next, dialog: fill(pick(ROAST_LINES, rng), next), toast: null};
  }

  if (run.step === 'sell') {
    return {
      run: {...run, step: 'return', cargo: null, delivered: run.delivered + 1},
      dialog: null,
      toast: {
        label: 'DELIVERED',
        title: `Roasted ${farm.bean} to ${CAFES[run.buyer]}`,
      },
    };
  }

  // Home with an empty hold: Ray has the next errand (and the first time,
  // a welcome instead of asking how the last one went)
  const next = newErrand({...run, met: true}, rng);
  const greeting =
    run.met === false ? WELCOME_LINES : fill(pick(RETURN_LINES, rng), run);
  return {
    run: next,
    dialog: [...greeting, ...fill(pick(ERRAND_LINES, rng), next)],
    toast: null,
  };
}

// A saved run, if it's whole: otherwise null
export function validRun(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const ok =
    Number.isFinite(saved.delivered) &&
    ['buy', 'roast', 'sell', 'return'].includes(saved.step) &&
    saved.farm in FARMS &&
    saved.buyer in CAFES &&
    [null, 'green', 'roasted'].includes(saved.cargo);
  return ok ? saved : null;
}
