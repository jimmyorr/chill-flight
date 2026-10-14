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
      ['Hey, buddy! Good to see you.'],
      ['Buddy! Pull up a chair.'],
      ["Look who's here! Coffee?"],
    ],
    accept: [
      ['Thanks, buddy!'],
      ["You're the best."],
      ["Great! I'll be here."],
    ],
    decline: [
      ['No worries, bud. Come by anytime.'],
      ["All good. I'll be here, bud."],
      ["No rush, the kettle's always on."],
    ],
    jobs: [
      {
        id: 'fresh-beans',
        kind: 'round trip',
        to: ['Lagoon Field', 'Mesa Field', 'Dune Field', 'Sagebrush Field'],
        cargo: 'Green beans',
        offer: [
          [
            "Don't panic, but we're almost out of beans.",
            'Could you grab a crate from {to}?',
          ],
          [
            'Time to roast a new batch.',
            '{to} should have a crate ready. Want to fly over and get it?',
          ],
          [
            'Running low on green beans.',
            'Could you fly out to {to} for a crate?',
          ],
        ],
        thanks: [
          ['Fresh crop! These are going right into the roaster.'],
          ["Nice looking beans! Let's get the roaster warmed up."],
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
          [
            'The cafe at {to} is running low.',
            'Mind flying a fresh batch over?',
          ],
          [
            'Got a fresh roast boxed and ready for {to}.',
            'Could you drop these off for them?',
          ],
        ],
        thanks: [
          ["They're already brewing the first pot! Thanks."],
          ['They loved the roast! Thanks.'],
          ["Another happy cafe. That's {done} for me, buddy!"],
        ],
      },
    ],
  },
  {
    name: 'Doug',
    airport: 'Mesa Field',
    intro: [
      "Hey, I'm Doug! Best cheese fries in the desert, right here at Mesa.",
      'Just land and roll to a stop on the runway to pick up or drop off orders. Easy as pie.',
    ],
    hello: [
      ['Hey! Got time for a quick dish?'],
      ['You missed karaoke night. I did three songs.'],
      ["There's my favorite pilot! Fries?"],
    ],
    accept: [
      ["You're a lifesaver."],
      ["Awesome. I'll keep the fryer hot."],
      ["Perfect. I'll be here, warming up the mic."],
    ],
    decline: [
      ['No worries! Come by for karaoke sometime.'],
      ["All good. The fries aren't going anywhere."],
      ["Take your time! The fryer's always hot."],
    ],
    jobs: [
      {
        id: 'cheese',
        kind: 'round trip',
        to: ['Meadow Field', 'Pinewood Field', 'Sagebrush Field'],
        cargo: 'Cheese',
        offer: [
          [
            "Crisis at the fryer: I'm out of cheese.",
            'Could you grab a wheel from {to}?',
          ],
          [
            'Cheese fries without cheese are just fries.',
            '{to} has a wheel for me. Want to fly over and get it?',
          ],
          [
            'Emergency: we are officially out of cheese.',
            'Think you could fetch a wheel from {to}?',
          ],
        ],
        thanks: [
          ["Now that's a lot of cheese. Thanks!"],
          ["Back in business! Next basket's on me."],
          ['Saved the day! The cheese sauce is back in action.'],
        ],
      },
      {
        id: 'cheese-fries',
        kind: 'one way',
        to: ['Meadow Field', 'Lagoon Field', 'Dune Field', 'Coral Field'],
        cargo: 'Cheese fries',
        offer: [
          [
            'Big order for {to}.',
            "Can you fly these cheese fries over while they're hot?",
          ],
          ['Fresh order to go for {to}.', 'Can you fly it over for me?'],
          [
            'Hot delivery headed to {to}.',
            'Mind flying these over before they cool off?',
          ],
        ],
        thanks: [
          ["They loved them! That's {done} for me now."],
          ['Delivered hot? I could sing about it. I might, later.'],
          ['Five stars from {to}! Best fries in the skies.'],
        ],
      },
    ],
  },
  {
    name: 'Bonnie',
    airport: 'Meadow Field',
    intro: [
      "Hi there, I'm Bonnie! Welcome to Meadow Field.",
      "Ray's got the coffee, I've got the moonwater. Land and roll to a stop on a runway to pick up or drop off.",
    ],
    hello: [
      ['Hi! Your aura looks bright today.'],
      ["Good to see you! Moonwater's fresh if you're thirsty."],
      ['Look who landed! Come sit and stay a while.'],
    ],
    accept: [
      ['Thank you! Safe flight through the skies.'],
      ["You're a gem. May the tailwinds be gentle."],
      ["Wonderful! I'll keep the jars safe until you get back."],
    ],
    decline: [
      ['No worries at all! Fly peaceful today.'],
      ["Take your time. The moon isn't going anywhere."],
      ['All good! Pop by whenever you pass through.'],
    ],
    jobs: [
      {
        id: 'glass-jars',
        kind: 'round trip',
        to: ['Lagoon Field', 'Mesa Field', 'Pinewood Field', 'Sagebrush Field'],
        cargo: 'Glass jars',
        offer: [
          [
            "The full moon is coming soon and I'm out of jars.",
            'Could you grab a crate of glass bottles from {to}?',
          ],
          [
            'I need more mason jars to catch the moonlight.',
            '{to} has a box ready. Want to fly over and get it?',
          ],
          [
            'A new lunar cycle is starting!',
            'Could you bring back a batch of glass jars from {to}?',
          ],
        ],
        thanks: [
          ['These are sparkling clean. Time to set them under the stars.'],
          ['Perfect timing! The moon is just rising.'],
          ['Thank you so much! Ray says hello, by the way.'],
        ],
      },
      {
        id: 'moonwater',
        kind: 'one way',
        to: [
          'Pinewood Field',
          'Lagoon Field',
          'Mesa Field',
          'Frost Field',
          'Coral Field',
          'Dune Field',
        ],
        cargo: 'Moonwater',
        offer: [
          [
            'Freshly charged under the full moon.',
            'Could you fly a case of moonwater out to {to}?',
          ],
          [
            'Someone at {to} requested a bottle for their garden.',
            'Could you take it over?',
          ],
          [
            'Charged with pure moonlight and good intentions.',
            'Mind delivering this batch to {to}?',
          ],
        ],
        thanks: [
          ['They said they could feel the good energy already. Thanks!'],
          ["Delivered under clear skies! That's {done} for me now."],
          ['Another happy customer. Thanks for the lift, pilot!'],
        ],
      },
    ],
  },
  {
    name: 'Esther',
    airport: 'Mesa Field',
    intro: [
      "Hi, I'm Esther! I study proteins, and I bake cookies when the experiments run long.",
      'Land and roll to a stop on a runway to pick up or drop off. Easy, right?',
    ],
    hello: [
      ['Hey, you! The cookies are warm.'],
      ['Oh hi! Was I humming again? Doug says I do that.'],
      ['Perfect timing. My protein is folding and the cookies are done.'],
    ],
    accept: [
      ["Thanks, friend. You're the best!"],
      ["Groovy. I'll be here, probably singing."],
      ['Oh, you rock. Fly safe out there.'],
    ],
    decline: [
      ['No stress at all. Come hang out anytime.'],
      ["That's cool. The cookies will keep."],
      ["All good. I've got a protein to stare at anyway."],
    ],
    jobs: [
      {
        id: 'lab-supplies',
        kind: 'round trip',
        to: ['Meadow Field', 'Pinewood Field', 'Frost Field', 'Coral Field'],
        cargo: 'Lab supplies',
        offer: [
          [
            'I ran out of reagents mid-experiment. Oops.',
            'Could you grab a box from {to}?',
          ],
          [
            "I'm out of buffer, and proteins get cranky without it.",
            'Could you pick up a bottle from {to}?',
          ],
          [
            '{to} has a box of lab supplies with my name on it.',
            'Want to fly over and bring it back?',
          ],
        ],
        thanks: [
          ["Perfect, that's exactly what I needed. Science thanks you!"],
          ["You're a lifesaver. Now the proteins can get back to work."],
          ['Ooh, this is the good stuff. Time to science!'],
        ],
      },
      {
        id: 'cookies',
        kind: 'one way',
        to: [
          'Meadow Field',
          'Lagoon Field',
          'Dune Field',
          'Coral Field',
          'Sagebrush Field',
        ],
        cargo: 'Cookies',
        offer: [
          [
            'Fresh batch of cookies, still warm.',
            'Could you fly them over to {to}?',
          ],
          [
            'Baking is just chemistry you can eat.',
            'Could you take a tin of cookies to {to}?',
          ],
          [
            'Someone at {to} could use a cookie break.',
            'Mind delivering a tin for me?',
          ],
        ],
        thanks: [
          ["They loved the cookies! That's {done} for me."],
          ["Cookies delivered, everyone's happy. Love that."],
          ['Another tin delivered, another happy friend. Thanks!'],
        ],
      },
    ],
  },
  {
    name: 'Tim',
    airport: 'Lagoon Field',
    intro: [
      "Hey! I'm Tim. If I'm not in the cockpit, I'm out on the green.",
      "I'm always looking for a ride to the next course. Land and roll to a stop on a runway to pick up or drop off.",
    ],
    hello: [
      ['Hey! Ready to hit the links?'],
      ['Perfect timing. I was just working on my swing.'],
      ['Look who landed! Got room for one more and a golf bag?'],
    ],
    accept: [
      ['Awesome! Let me grab my clubs.'],
      ["You're a legend! Wheels up."],
      ["Sweet! Let's get out there before my tee time."],
    ],
    decline: [
      ["No worries! I'll work on my putting here for a bit."],
      ['All good! Catch you next time around.'],
      ["Take your time! The course isn't going anywhere."],
    ],
    jobs: [
      {
        id: 'golf-trip',
        kind: 'one way',
        to: [
          'Meadow Field',
          'Mesa Field',
          'Pinewood Field',
          'Dune Field',
          'Sagebrush Field',
          'Frost Field',
          'Coral Field',
        ],
        cargo: 'Golf clubs',
        offer: [
          [
            'Got a tee time booked at {to}.',
            'Could you give me and my clubs a one-way lift?',
          ],
          [
            'The greens at {to} are supposed to be pristine.',
            'Mind flying me over for a round?',
          ],
          [
            'Trying to play every fairway across the map!',
            'Want to fly me out to {to}?',
          ],
          [
            "There's a fun scramble tournament happening at {to}.",
            'Think you could fly me over with my golf bag?',
          ],
          [
            'Heard the wind at {to} makes for an amazing challenge.',
            'Can I hitch a ride over to play 18 holes?',
          ],
          [
            'I need a new course to conquer.',
            'Could you drop me off at {to} for some golf?',
          ],
        ],
        thanks: [
          ['Made it right before my tee time! Thanks for the ride, pilot!'],
          ["Smooth landing! That's {done} for me now."],
          ['Time to hit the fairways. Thanks for the lift!'],
          ["Perfect, I'll have time to warm up. You're the best."],
          ["Great flight! Now let's see if my slice behaves. Thanks!"],
          ["Another course checked off the bucket list! That's {done} for me."],
        ],
      },
    ],
  },
];
