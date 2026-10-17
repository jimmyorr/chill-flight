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
//   outfit    Optional: which of their outfits in faces.js they wear while
//             offering it and thanking you (otherwise their usual face).
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
      "Hey buddy, it's Ray! If my hands are shaking, it's just excitement. And four espressos.",
      'I roast, you fly. Just land and roll to a stop on any runway to pick up or drop off!',
    ],
    hello: [
      ["Hey, buddy! I saved you a cup. It's strong enough to de-ice a wing."],
      ['Buddy! Pull up a chair. Tell me about the clouds!'],
      ["Look who's here! Want a pour-over? I timed it with a stopwatch!"],
    ],
    accept: [
      ["You're a legend, buddy! May your tailwinds smell like hazelnut."],
      ["Awesome, buddy! You're the best."],
      ["Great! I'll be here, keeping the roaster humming."],
    ],
    decline: [
      [
        "No rush, bud! I'll just be here, staring lovingly at the espresso machine.",
      ],
      ['No worries, bud. Come by anytime!'],
      ["All good, buddy. The kettle's always on."],
    ],
    jobs: [
      {
        id: 'fresh-beans',
        kind: 'round trip',
        to: ['Lagoon Field', 'Mesa Field', 'Dune Field', 'Sagebrush Field'],
        cargo: 'Green beans',
        offer: [
          [
            "Code Brown, buddy—we're down to our last twelve coffee beans!",
            'Could you zip over to {to} and rescue a crate of green beans?',
          ],
          [
            "I've got the roaster pre-heated to perfection and zero beans to put in it.",
            '{to} has a crate waiting. Want to go snag it for me?',
          ],
          [
            'Bonnie says my aura is "jittery," which means I need to roast a new batch.',
            'Could you fly out to {to} and grab a crate of green beans?',
          ],
        ],
        thanks: [
          [
            'Oh, look at the sheen on these beans! Into the roaster you go, little buddies!',
          ],
          ["Fresh crop! Stand back, it's about to smell incredible in here."],
          ["You saved the morning! I'm naming this roast after your landing."],
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
          [
            'Fresh batch, still warm! Your cockpit is going to smell like heaven.',
            'Could you fly these bags over to {to}?',
          ],
          [
            'The folks at {to} are yawning so loud I can hear them from here.',
            'Mind flying a fresh batch of roast over to wake them up?',
          ],
          [
            'Got an emergency dark roast boxed and ready for {to}.',
            'Could you drop these off for them before they fall asleep?',
          ],
        ],
        thanks: [
          [
            "They're already brewing pot number one! Morale at {to} is up 400%.",
          ],
          ["Another happy, wide-awake airport! That's {done} for me, buddy!"],
          ["They loved the roast! You're an honorary barista now, buddy."],
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
      ['You missed karaoke night! I hit a high note that scared a cactus.'],
      ["Look who's back! Careful, the fryer is bubbling with pure joy."],
      ['Hey! Pull up! Want your fries regular-cheesy or irresponsible-cheesy?'],
    ],
    accept: [
      ["Awesome! I'll be here practicing my power ballads into a spatula."],
      ["You're a lifesaver! Keep the skies cheesy."],
      ["Sweet! I'll keep the fryer humming."],
    ],
    decline: [
      ["All good! More time for me to snack on the 'test fries.'"],
      ['No worries! Come by for karaoke sometime.'],
      ["Take your time! The cheddar isn't going anywhere."],
    ],
    jobs: [
      {
        id: 'cheese',
        kind: 'round trip',
        to: ['Meadow Field', 'Pinewood Field', 'Sagebrush Field'],
        cargo: 'Cheese',
        offer: [
          [
            'Sound the alarm: we have a Category 5 Cheese Shortage.',
            'Could you grab an emergency wheel from {to}?',
          ],
          [
            'Cheese fries without cheese are just...fries.',
            '{to} has a giant cheddar wheel for me. Want to fly over and get it?',
          ],
          [
            'I got carried away with a triple-cheese order and used my last block!',
            'Think you could fetch a fresh wheel from {to}?',
          ],
        ],
        thanks: [
          [
            "Now THAT is a majestic wheel of cheese. Next basket's on the house!",
          ],
          ['Order up! You just saved the desert from dry potatoes.'],
          [
            'Saved the day! The cheese sauce is back in action and sounding glorious.',
          ],
        ],
      },
      {
        id: 'cheese-fries',
        kind: 'one way',
        to: ['Meadow Field', 'Lagoon Field', 'Dune Field', 'Coral Field'],
        cargo: 'Cheese fries',
        offer: [
          [
            'VIP order for {to}—extra crispy, maximum melt.',
            'Can you fly these over while the cheese still has that epic pull?',
          ],
          [
            'Hot delivery headed to {to}! Try not to eat them mid-loop.',
            'Mind flying this basket over before they cool off?',
          ],
          [
            'Fresh order to go for {to}!',
            'Could you fly it over while the fries are at peak crunch?',
          ],
        ],
        thanks: [
          [
            "Delivered piping hot! I'm dedicating my next karaoke encore to you.",
          ],
          [
            'Five stars from {to}! Not a single fry survived more than thirty seconds.',
          ],
          ["They loved them! That's {done} for me now."],
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
      ["Hi! Oh, your airplane's aura is sparkling today!"],
      ['Good to see you! The moonwater is crisp and the vibes are immaculate.'],
      [
        "Look who floated in! Mercury isn't even in retrograde—it's a great day to fly!",
      ],
    ],
    accept: [
      ["You're a star! Literally, in a past life, I'm pretty sure."],
      ['Thank you! May the tailwinds be gentle and harmonious.'],
      ['Wonderful! May the moon light your way.'],
    ],
    decline: [
      ['No worries at all! Follow the breeze wherever it takes you.'],
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
            "Tonight's moonbeams are going to be prime vintage, and I'm out of jars!",
            'Could you grab a crate of glass bottles from {to}?',
          ],
          [
            'Ray accidentally used my last mason jar for iced cold brew.',
            '{to} has a fresh box of jars ready. Want to fly over and get it?',
          ],
          [
            'A new lunar cycle is starting!',
            'Could you bring back a batch of glass jars from {to}?',
          ],
        ],
        thanks: [
          [
            "Ooh, listen to them clink—that's an A-sharp! The moon is going to love these.",
          ],
          [
            'Sparkling clean! Time to set them out and let the stars do their thing.',
          ],
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
            'Freshly charged under a waxing gibbous! Zero calories, 100% cosmic.',
            'Could you fly a case of moonwater out to {to}?',
          ],
          [
            'Someone at {to} has a fern that needs a little spiritual pep talk.',
            'Could you take this bottle of moonwater over for their garden?',
          ],
          [
            'Charged with pure moonlight and good intentions.',
            'Mind delivering this batch to {to}?',
          ],
        ],
        thanks: [
          [
            "They said the fern perked right up! That's {done} for me now, friend!",
          ],
          ["Delivered with pure starlight! You're a natural-born sky wizard."],
          ['Another happy soul. Thanks for the lift, friend!'],
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
      ['Hey, you! Grab a cookie—peer-reviewed for maximum chewiness!'],
      ['Oh hi! Doug and I were just harmonizing by the centrifuge.'],
      [
        'Perfect timing! My proteins are behaving and the chocolate chips are melty.',
      ],
    ],
    accept: [
      ["Groovy! You're my favorite co-author on this adventure."],
      ["Thanks, friend. You're the best!"],
      ['Oh, you rock. Fly safe out there.'],
    ],
    decline: [
      ["No stress! I've got a very dramatic amino acid to supervise anyway."],
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
            "I'm out of buffer solution, and proteins get super cranky without it.",
            'Could you pick up a bottle from {to}?',
          ],
          [
            'My experiment is going so well I used up all my pipettes! Classic.',
            '{to} has a box of lab supplies with my name on it. Want to bring it back?',
          ],
          [
            'I ran out of reagents mid-experiment. Oops.',
            'Could you grab a box from {to}?',
          ],
        ],
        thanks: [
          [
            "Ooh, fresh reagents! Stand back, I'm about to do some high-fructose science!",
          ],
          [
            "You're a lifesaver! The proteins are folding like tiny origami champions.",
          ],
          ["Perfect, that's exactly what I needed. Science thanks you!"],
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
            'Baking is just delicious chemistry! Careful, the chocolate is still molten.',
            'Could you take a tin of cookies over to {to}?',
          ],
          [
            'My data shows that {to} is experiencing a critical snickerdoodle deficit.',
            'Mind delivering a warm tin for me?',
          ],
          [
            'Someone at {to} could use a cookie break.',
            'Mind delivering a tin for me?',
          ],
        ],
        thanks: [
          [
            "Hypothesis confirmed: everyone at {to} loves warm cookies! That's {done} for me.",
          ],
          ['Tin delivered, serotonin levels at maximum. Science wins again!'],
          ['Another tin delivered, another happy friend. Thanks!'],
        ],
      },
    ],
  },
  {
    name: 'Tim',
    airport: 'Lagoon Field',
    intro: [
      "Hey, I'm Tim! Welcome to Lagoon Field.",
      "If I'm not working, I'm out on the green. Land and roll to a stop on a runway to pick up or drop off.",
    ],
    hello: [
      [
        'Hey! Check out this practice swing—only divoted the lawn a little bit!',
      ],
      [
        'Good to see you! My 9-iron is polished and my optimism is dangerously high.',
      ],
      ['Back already? Hop in, the fairways are calling our names!'],
    ],
    accept: [
      ["You're a legend! Fore! ...Wait, do pilots yell 'Fore'?"],
      ['Awesome! Let me grab my clubs.'],
      ["Sweet! Let's get out there before my tee time."],
    ],
    decline: [
      ["No worries! I'll stay here and negotiate with the putting green."],
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
            'Heard the wind at {to} adds thirty yards to your drive—or puts it in a lake.',
            'Can I hitch a ride over to play 18 holes?',
          ],
          [
            'I promised myself I would birdie every par-3 on the map!',
            'Could you drop me and my clubs off at {to}?',
          ],
          [
            'Got a tee time booked at {to}.',
            'Could you give me and my clubs a one-way lift?',
          ],
          [
            'The greens at {to} are supposed to be pristine.',
            'Mind flying me over for a round?',
          ],
          [
            "There's a fun scramble tournament happening at {to}.",
            'Think you could fly me over with my clubs?',
          ],
          [
            'I need a new course to conquer.',
            'Could you drop me and my clubs off at {to}?',
          ],
        ],
        thanks: [
          [
            'Buttery smooth landing! Way straighter than my tee shots. Thanks a million!',
          ],
          [
            "Made it with time to hit the driving range! You're a tour-level pilot!",
          ],
          ['Time to hit the fairways. Thanks for the lift!'],
          ["Perfect, I'll have time to warm up. Thanks a million!"],
          ["Great flight! Now let's see if my slice behaves. Thanks!"],
          ["Another course checked off the bucket list! That's {done} for me."],
        ],
      },
    ],
  },
  {
    name: 'Erin',
    airport: 'Sagebrush Field',
    intro: [
      "Hi, I'm Erin! Welcome to Sagebrush Field. I play tennis and I knit, so my hands are always holding something pointy or something bouncy.",
      'Land and roll to a stop on a runway to pick up or drop off. Love-love!',
    ],
    hello: [
      ['Hey, you! I just aced a tumbleweed. It did not return the serve.'],
      [
        "Welcome back! I'm knitting a little cozy for my racquet. It has a pom-pom.",
      ],
      [
        "Oh good, you're here! I just tried to serve a ball of yarn. It unraveled mid-air.",
      ],
    ],
    accept: [
      ["Yes! You're my favorite doubles partner."],
      ["Thank you! I'll be here, warming up my serve and my needles."],
      ['Game, set, match! Fly safe out there.'],
    ],
    decline: [
      ['No problem! I have about forty rows to knit anyway.'],
      ["Totally fine. I'll go practice my backhand on the hangar door."],
      ["No worries! I'll be here, rallying with the wind."],
    ],
    jobs: [
      {
        id: 'tennis-balls',
        kind: 'round trip',
        outfit: 'tennis',
        to: [
          'Meadow Field',
          'Lagoon Field',
          'Pinewood Field',
          'Dune Field',
          'Frost Field',
        ],
        cargo: 'Tennis balls',
        offer: [
          [
            'Disaster! A coyote ran off with my last can of tennis balls.',
            '{to} has a fresh can for me. Could you go get it, before he starts a league?',
          ],
          [
            "I've been hitting the same ball for a week and it's starting to get dizzy.",
            'Could you fly to {to} and bring me a new can?',
          ],
          [
            'My serve is so strong, half my tennis balls landed in the next county.',
            'Mind grabbing a can from {to}?',
          ],
        ],
        thanks: [
          ['Fuzzy and fresh! Listen to that pop. Beautiful.'],
          ["You're a legend! I'm dedicating my next ace to you."],
          [
            "Fresh, fuzzy and bouncy! They practically serve themselves. That's {done} for me!",
          ],
        ],
      },
      {
        id: 'knit-hats',
        kind: 'one way',
        to: [
          'Frost Field',
          'Pinewood Field',
          'Meadow Field',
          'Mesa Field',
          'Dune Field',
        ],
        cargo: 'Knitted hats',
        offer: [
          [
            'I knit twelve hats in one sitting. They all have pom-poms. They are all enormous.',
            'Could you take a bundle over to {to}?',
          ],
          [
            "I'm told that people at {to} have cold ears and no sense of style.",
            'Could you fly them a box of hats for me?',
          ],
          [
            'These hats are extra warm and extra fluffy.',
            'Could you drop a batch off at {to}?',
          ],
        ],
        thanks: [
          ['Pom-poms everywhere! {to} has never looked so fluffy.'],
          [
            'They are wearing them already! Even the ones that were meant for scarves.',
          ],
          ['Cozy heads all around. That makes {done} for me!'],
        ],
      },
    ],
  },
  {
    name: 'Lauren',
    airport: 'Sagebrush Field',
    intro: [
      "Hi, I'm Lauren! I knit, I volley, and I talk to my yarn. It listens better than people.",
      'Land and roll to a stop on a runway to pick up or drop off. Easy peasy.',
    ],
    hello: [
      ['Oh hi! I knit a scarf so long it has its own zip code.'],
      ["Look who flew in! I'm on row 4,000. Or maybe 400. I lost count."],
      [
        "Hi hi! Sit down, I'll finish this row. Eventually. Possibly next week.",
      ],
    ],
    accept: [
      ["You're the best! I'll hold the fort and the knitting needles."],
      ['Thank you! Soft landings and warm socks to you.'],
      ["Yay! I'll be here, making things that nobody asked for."],
    ],
    decline: [
      ["That's okay! I have eleven projects to start anyway."],
      ["No worries. I'll just tangle myself in yarn for a while."],
      ['All good! The yarn and I will be right here.'],
    ],
    jobs: [
      {
        id: 'yarn',
        kind: 'round trip',
        to: [
          'Lagoon Field',
          'Mesa Field',
          'Dune Field',
          'Coral Field',
          'Pinewood Field',
        ],
        cargo: 'Yarn',
        offer: [
          [
            'I have run out of yarn, which has never happened, and I will never speak of it again.',
            '{to} has a basket for me. Could you bring it back?',
          ],
          [
            "I'm halfway through a sweater for a very large llama.",
            'Could you fly to {to} and bring back more yarn?',
          ],
          [
            'A sheep at {to} just got a fresh haircut and has wool to spare.',
            'Could you go pick it up?',
          ],
        ],
        thanks: [
          ['Squishy! So much squish! Thank you, thank you, thank you.'],
          ['The llama will be so warm. Possibly too warm. Worth it!'],
          ["Now I can finish the sleeve. That's {done} for me!"],
        ],
      },
      {
        id: 'racquets',
        kind: 'one way',
        outfit: 'tennis',
        to: [
          'Meadow Field',
          'Lagoon Field',
          'Mesa Field',
          'Frost Field',
          'Coral Field',
        ],
        cargo: 'Tennis racquets',
        offer: [
          [
            'Someone at {to} has been playing tennis with a frying pan.',
            'Could you fly them some real racquets?',
          ],
          [
            'Erin made me promise to spread the sport.',
            'Could you take this bag of racquets to {to}?',
          ],
          [
            "I'm wearing my tennis visor, so this is official business.",
            'Could you drop these racquets off at {to}?',
          ],
        ],
        thanks: [
          ["They're already swinging at everything! Even the clouds."],
          ["Tennis has spread to {to}! That's {done} for me. Thank you!"],
          ['Perfect landing! The racquets thank you. So do I!'],
        ],
      },
    ],
  },
];
