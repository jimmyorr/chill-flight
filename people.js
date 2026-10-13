// --- PEOPLE ---
// Who you meet at the airports and the jobs they offer (jobs.js plays them,
// jobs-logic.js has the rules). Land and stop at an airport with no job on
// and someone there offers you one of their jobs: the one you've helped least
// asks first.
//
// Each person:
//   name      Shown over their words and on the People screen (unique).
//   airport   Where they are: an airport's name (AIRPORTS in
//             chill-flight-logic.js). Several people can share one.
//   intro     What they say the first time you meet.
//   hello     What they say when you drop by after that.
//   accept    When you take a job. decline: when you say not right now.
//   jobs      What they ask you to do (below).
//
// Each job:
//   id        A short name, unique for this person (saved with progress).
//   kind      'round trip': fly to one of `to`, pick up, and come back.
//             'one way': fly to one of `to`, drop off, done.
//   to        The airports it can send you to (never their own).
//   cargo     What you carry, for the HUD: on the way back for a round
//             trip, the whole way for one way.
//   offer     How they ask (the last line is the question).
//   thanks    What they say when it's done.
//
// Lines: a list of lines is said in order, one box at a time; a list of
// lists is a choice, one picked at random each time. {to} becomes the
// airport the job sends you to, {name} the person's name and {done} how
// many jobs you've done for them ("3 jobs").
//
// Everyone needs a face in faces.js, under their name.

export const PEOPLE = [
  {
    name: 'Ray',
    airport: 'Meadow Field',
    intro: [
      "Hey buddy, it's Ray! Welcome to the roastery.",
      'I roast, you fly. Land and roll to a stop on a runway to pick up or drop off.',
    ],
    hello: [
      ['Hey, bud! Good to see you.'],
      ['Buddy! Pull up a chair.'],
      ["Look who's here! Coffee?"],
    ],
    accept: [
      ['Thanks, bud!'],
      ["You're the best, buddy."],
      ["Great! I'll be here."],
    ],
    decline: [
      ['No worries, bud. Come by anytime.'],
      ["All good. I'll be here, buddy."],
    ],
    jobs: [
      {
        id: 'fresh-beans',
        kind: 'round trip',
        to: ['Lagoon Field', 'Mesa Field', 'Dune Field', 'Sagebrush Field'],
        cargo: 'Green beans',
        offer: [
          [
            "Bud, we're almost out of beans.",
            'Could you grab a crate from {to}?',
          ],
          [
            'I have a hankering to roast something new.',
            '{to} should have a crate ready. Want to fly over and get it?',
          ],
        ],
        thanks: [
          ['Oh, these smell great, bud.', "I'll get them in the roaster."],
          ['Nice crate! A medium roast, I think.'],
        ],
      },
      {
        id: 'roasted-bags',
        kind: 'one way',
        to: [
          'Pinewood Field',
          'Lagoon Field',
          'Mesa Field',
          'Frost Field',
          'Coral Field',
        ],
        cargo: 'Roasted coffee',
        offer: [
          ['Fresh batch, still warm.', 'Could you fly these bags to {to}?'],
          ['The cafe at {to} is running low.', 'Take them a few bags?'],
        ],
        thanks: [
          ['They loved it, bud! Thanks.'],
          ["Another happy cafe. That's {done} for me, buddy!"],
        ],
      },
    ],
  },
];
