// Shot list for scripts/promo.js: each shot is a set of game URL parameters
// (see the README). To change one, open it with `node scripts/promo.js urls`
// (links to the dev server with the debug menu), adjust the view and copy it
// with the debug menu's copy URL buttons, then paste the whole link as the
// shot's query. Locations are for seed 20260101 (the rock arch's latitude
// depends on the seed).

// Shared by every shot: no title screen, interface, tips or music; one world
// and one clock, so the moon, weather, sky palette and clouds repeat. Each
// shot sets its own cloudMood (fair, mixed, mackerel, high or busy), so the
// set shows off the different skies.
export const COMMON =
  'start=1&ui=0&music=0&tips=0&seed=20260101&preset=ultra&timeSpeed=0' +
  '&clock=1790000000000&cloudTime=500&fps=0';

const TITLE = {title: 'CHILL FLIGHT', subtitle: 'An endless, relaxing flight'};

// Output targets: CSS size, pixel density (scale), touch device (mobile, for
// the game's touch layout) and, for videos, title and end cards. App Store
// sizes: iPhone 6.9" screenshots and previews, iPad 13" screenshots and
// previews (portrait).
export const TARGETS = {
  iphone: {width: 440, height: 956, scale: 3, mobile: true}, // 1320x2868
  ipad: {width: 1032, height: 1376, scale: 2, mobile: true}, // 2064x2752
  web: {width: 1920, height: 1080},
  social: {width: 1200, height: 630},
  // App Store previews: 15-30 s, in-app footage, no web address
  'iphone-preview': {
    width: 443,
    height: 960,
    scale: 2, // 886x1920
    mobile: true,
    video: true,
    cards: [{...TITLE, seconds: 2.5}],
  },
  'ipad-preview': {
    width: 900,
    height: 1200,
    scale: 4 / 3, // 1200x1600
    mobile: true,
    video: true,
    cards: [{...TITLE, seconds: 2.5}],
  },
  // The website, YouTube and Google Play
  trailer: {
    width: 1920,
    height: 1080,
    video: true,
    cards: [
      {...TITLE, seconds: 2.5},
      {title: 'CHILL FLIGHT', subtitle: 'chill-flight.cowneck.com', seconds: 3},
    ],
  },
};

// `query`: the shot's parameters; `portrait` / `landscape`: extra ones for
// those targets (e.g. another camera position). `seconds`: a video clip of
// that length (in list order). `still: false` leaves it out of the stills.
export const SHOTS = {
  // --- Stills: a frozen plane at the landmarks (free camera) ---
  // The rock arch (X = 3000, Z = -2441: 0.6 East, 0.5 North), from the water
  // to its east, the plane flying out toward the camera
  arch: {
    query:
      'freecam=true&x=3120&y=88&z=-2441&heading=-90&pitch=2&roll=10' +
      '&camX=3260&camY=55&camZ=-2441&camHeading=90&camPitch=8' +
      '&tod=0.36&livery=coral&cloudMood=fair',
    portrait: 'x=3330&y=85&camX=3480&camY=60&camPitch=12',
  },
  // The lighthouse (X = 7500, Z = 3000: 1.5 East, 0.6 South) at dusk
  lighthouse: {
    query:
      'freecam=true&x=7812&y=60&z=3345&heading=-40&roll=10' +
      '&camX=7900&camY=45&camZ=3380&camHeading=50&camPitch=6' +
      '&tod=0.785&headlight=1&livery=teal&cloudMood=mackerel',
    portrait: 'x=7856&y=70&z=3324',
  },
  // Over the volcano (X = -5000, Z = 5000: 1.0 West, 1.0 South) at sunset
  volcano: {
    query:
      'freecam=true&x=-3050&y=2486&z=3050&heading=135&pitch=-6&roll=-12' +
      '&camX=-3000&camY=2500&camZ=3000&camHeading=135&camPitch=-12' +
      '&tod=0.745&livery=rose&cloudMood=busy',
  },
  // Under the west coast highway where it crosses water (X = -6337,
  // Z = 1770: 1.3 West, 0.35 South)
  highway: {
    query:
      'freecam=true&x=-6560&y=72&z=1818&heading=-92&roll=8' +
      '&camX=-6650&camY=66&camZ=1810&camHeading=-95&camPitch=5' +
      '&tod=0.4&livery=slate&cloudMood=mixed',
  },

  // --- Chase shots of a flying plane: stills, and the video's clips in
  // order (sunrise to night) ---
  'sunrise-lakes': {
    query:
      'lat=0.1S&long=1.3W&heading=-80&tod=0.265&livery=coral&camOffset=0,8,40' +
      '&cloudMood=busy',
    seconds: 4,
    portrait: 'camOffset=0,6,30',
  },
  'arch-flythrough': {
    // East to west through the arch in early light, from behind and below
    query:
      'x=3530&y=88&z=-2441&heading=90&speed=1&tod=0.285&livery=coral' +
      '&camOffset=-6,-2,36&camLook=0,6,-40&cloudMood=fair',
    seconds: 4,
    still: false,
  },
  'islands-sunset': {
    // South-west over the islands, into the sunset
    query:
      'lat=0.2S&long=2.4E&heading=135&tod=0.745&plane=twin&livery=teal' +
      '&camOffset=-20,10,44&cloudMood=busy',
    seconds: 4,
  },
  'hud-islands': {
    // The game as players see it: the interface on, on a touch device
    query:
      'lat=0.2S&long=2.4E&heading=60&tod=0.5&plane=twin&livery=teal&ui=1' +
      '&cloudMood=fair',
    seconds: 4,
    still: false,
  },
  'snow-biplane': {
    query:
      'lat=3.0N&long=0.3W&heading=200&tod=0.42&plane=biplane&livery=coral' +
      '&camOffset=-22,6,34&cloudMood=high',
    seconds: 4,
    portrait: 'camOffset=-10,6,42',
  },
  'volcano-sunset': {
    // Toward the volcano's caldera at sunset, from behind
    query:
      'x=-3300&y=2420&z=3300&heading=135&speed=1&tod=0.745&livery=rose' +
      '&camOffset=0,10,40&cloudMood=mackerel',
    seconds: 4,
    still: false,
  },
  'lighthouse-dusk': {
    // Past the lighthouse at dusk, from the side
    query:
      'x=7900&y=95&z=3150&heading=90&speed=1&tod=0.785&headlight=1' +
      '&livery=teal&camOffset=-70,10,40&cloudMood=mixed',
    seconds: 4,
    still: false,
  },
  'night-sea': {
    query:
      'lat=0.1N&long=1.2E&heading=-90&tod=0.93&headlight=1&livery=slate' +
      '&camOffset=12,6,36&cloudMood=mixed',
    seconds: 4,
  },

  // --- More stills ---
  'islands-sunrise': {
    // East over the islands, toward the sunrise
    query:
      'lat=0.2S&long=2.4E&heading=-90&tod=0.27&plane=twin&livery=teal' +
      '&camOffset=20,10,44&cloudMood=mackerel',
  },
  islands: {
    query:
      'lat=0.2S&long=2.4E&heading=60&tod=0.5&plane=twin&livery=teal' +
      '&camOffset=-26,14,46&cloudMood=fair',
  },
  desert: {
    query:
      'lat=2.7S&long=0.4W&heading=110&tod=0.6&plane=glider&livery=sand' +
      '&camOffset=18,10,42&cloudMood=high',
    portrait: 'camOffset=8,10,52',
  },
  alien: {
    query:
      'lat=0.2N&long=12E&heading=-90&tod=0.55&livery=purple&camOffset=20,8,40' +
      '&cloudMood=busy',
  },
};
