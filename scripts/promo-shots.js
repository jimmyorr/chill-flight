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

// Title and end cards: the app icon and name, an optional tagline, and lines
// of smaller text (the music credit, the web address)
const TITLE = {title: 'CHILL FLIGHT'};
const SIGN_OFF = {title: 'CHILL FLIGHT', lines: ['Music by Purrple Cat']};

// The YouTube thumbnail (1280x720): a shot with the app icon and name over it
export const THUMBNAIL = {shot: 'islands-sunset', width: 1280, height: 720};

// Output targets: CSS size, pixel density (scale), touch device (mobile, for
// the game's touch layout) and, for videos, an optional title card before
// the clips and end card after them. App Store
// sizes: iPhone 6.9" screenshots and previews, iPad 13" screenshots and
// previews (portrait).
export const TARGETS = {
  iphone: {width: 440, height: 956, scale: 3, mobile: true}, // 1320x2868
  ipad: {width: 1032, height: 1376, scale: 2, mobile: true}, // 2064x2752
  web: {width: 1920, height: 1080},
  social: {width: 1200, height: 630},
  // App Store previews: 15-30 s, in-app footage, no web address. They open
  // straight on gameplay (they autoplay muted in search results, and the
  // app's name and icon are already beside them)
  'iphone-preview': {
    width: 443,
    height: 960,
    scale: 2, // 886x1920
    mobile: true,
    video: true,
    endCard: {...SIGN_OFF, seconds: 2.5},
  },
  'ipad-preview': {
    width: 900,
    height: 1200,
    scale: 4 / 3, // 1200x1600
    mobile: true,
    video: true,
    endCard: {...SIGN_OFF, seconds: 2.5},
  },
  // The website, YouTube and Google Play
  trailer: {
    width: 1920,
    height: 1080,
    video: true,
    titleCard: {...TITLE, seconds: 2.5},
    endCard: {
      ...SIGN_OFF,
      lines: [...SIGN_OFF.lines, 'chill-flight.cowneck.com'],
      seconds: 3.5,
    },
  },
};

// `query`: the shot's parameters; `portrait` / `landscape`: extra ones for
// those targets (e.g. another camera position). `seconds`: a video clip of
// that length (in list order). `still: false` leaves it out of the stills.
// `preroll`: seconds to fly before filming, for things that build up slowly
// (default PREROLL, 1.5 s).
// Shots from straight behind the plane use the game's own chase camera with
// the interface on (ui=1), as players see it. The others each have their own
// angle, so the set shows the planes from all around.
export const SHOTS = {
  // --- Stills: a frozen plane at the landmarks (free camera) ---
  // The rock arch (X = 3000, Z = -2441: 0.6 East, 0.5 North), from the water
  // to its east, the plane flying out toward the camera (head-on)
  arch: {
    query:
      'freecam=true&x=3120&y=88&z=-2441&heading=-90&pitch=2&roll=10' +
      '&camX=3260&camY=55&camZ=-2441&camHeading=90&camPitch=8' +
      '&tod=0.36&livery=coral&cloudMood=fair',
    portrait: 'x=3330&y=85&camX=3480&camY=60&camPitch=12',
  },
  // The lighthouse (X = 7500, Z = 3000: 1.5 East, 0.6 South) at dusk, side-on
  lighthouse: {
    query:
      'freecam=true&x=7812&y=60&z=3345&heading=-40&roll=10' +
      '&camX=7900&camY=45&camZ=3380&camHeading=50&camPitch=6' +
      '&tod=0.785&headlight=1&livery=teal&cloudMood=mackerel',
    portrait: 'x=7807&y=60&z=3320',
  },

  // --- Flying: stills, and the video's clips in order (through one day,
  // sunrise to night) ---
  // Over the volcano (X = -5000, Z = 5000: 1.0 West, 1.0 South) at sunset
  volcano: {
    query:
      'x=-3050&y=2486&z=3050&heading=135&tod=0.745&livery=rose&ui=1' +
      '&cloudMood=busy',
  },
  // Under the west coast highway where it crosses water (X = -6337,
  // Z = 1770: 1.3 West, 0.35 South)
  highway: {
    query:
      'x=-6560&y=72&z=1818&heading=-92&tod=0.4&livery=slate&ui=1' +
      '&cloudMood=mixed',
  },
  'sunrise-lakes': {
    query:
      'lat=0.1S&long=1.3W&heading=-80&tod=0.265&livery=coral&ui=1' +
      '&cloudMood=busy',
    seconds: 4,
  },
  'arch-pass': {
    // North up the channel past the rock arch in early light, from behind
    // and below, with open water ahead (flying west through the arch heads
    // straight into a hill). High, and starting far enough back that a
    // pirate ship in the channel stays small in the distance
    query:
      'x=3540&y=95&z=-1450&heading=20&speed=1&tod=0.285&livery=coral' +
      '&camOffset=-6,-2,36&camLook=0,6,-40&cloudMood=fair',
    seconds: 4,
    still: false,
    portrait: 'camOffset=-3,0,62&camLook=0,8,-60',
  },
  'snow-biplane': {
    // From high above, over the snowy forest, in falling snow
    query:
      'lat=2.9N&long=0.3W&heading=200&tod=0.42&plane=biplane&livery=coral' +
      '&camOffset=0,60,25&camLook=0,0,-10&cloudMood=high&weather=snow',
    seconds: 4,
  },
  'hud-islands': {
    // The game as players see it, the interface on, among the karst islands'
    // limestone towers (X = 10000, Z = 6900: 2.0 East, 1.4 South)
    query:
      'x=10000&y=380&z=6900&heading=90&tod=0.5&plane=twin&livery=teal&ui=1' +
      '&cloudMood=fair',
    seconds: 4,
  },
  'volcano-rain': {
    // Toward the volcano in afternoon rain; the haze also hides the coarse
    // distant terrain
    query:
      'x=-2600&y=2500&z=2600&heading=135&speed=1&tod=0.62&livery=rose&ui=1' +
      '&weather=rain',
    seconds: 4,
    still: false,
  },
  'islands-sunset': {
    // North-west over the islands, side-on against the sunset
    query:
      'lat=0.2S&long=2.4E&heading=45&tod=0.745&plane=biplane&livery=teal' +
      '&camOffset=60,-8,5&cloudMood=busy',
    seconds: 4,
    portrait: 'camOffset=85,-12,5',
  },
  'lighthouse-dusk': {
    // Past the lighthouse at dusk, from the side, passing the tower late in
    // the clip so it stays in frame
    query:
      'x=8150&y=135&z=3150&heading=90&speed=1&tod=0.785&headlight=1' +
      '&livery=teal&camOffset=-70,-5,40&cloudMood=mixed',
    seconds: 4,
    still: false,
    portrait: 'x=8080&camOffset=-35,12,-85',
  },
  aurora: {
    // North under the aurora, from low behind looking up at it (it needs
    // night, a clear sky, high northern latitudes and an active clock), after
    // a long run-up while it fades in
    query:
      'lat=1.3N&long=0.3W&heading=0&tod=0.95&headlight=1&livery=slate' +
      '&camOffset=0,-3,38&camLook=0,30,-120&cloud=clear&weather=clear' +
      '&cloudMood=fair&clock=1790120480000',
    seconds: 4,
    preroll: 20,
    portrait: 'camOffset=0,-3,62&camLook=0,30,-140',
  },

  // --- More stills ---
  'islands-sunrise': {
    // West over the islands, from low ahead, the sunrise behind the plane
    query:
      'lat=0.2S&long=2.4E&heading=90&tod=0.27&plane=twin&livery=teal' +
      '&camOffset=-25,-4,-45&camLook=0,3,0&cloudMood=mackerel',
    portrait: 'camOffset=-28,-5,-75',
  },
  islands: {
    // Past a hilly island (X = 14500, Z = 6000: 2.9 East, 1.2 South), from
    // high on its far side
    query:
      'x=15600&y=220&z=6000&heading=0&tod=0.5&plane=twin&livery=teal' +
      '&camOffset=90,40,10&camLook=0,25,0&cloudMood=fair',
  },
  desert: {
    // From high ahead, over the dunes
    query:
      'lat=2.7S&long=0.4W&heading=110&tod=0.6&plane=glider&livery=sand' +
      '&camOffset=-35,15,-45&camLook=0,0,0&cloudMood=high',
  },
  alien: {
    // From below, the plane over the alien peaks
    query:
      'lat=0.2N&long=12E&heading=-90&tod=0.55&livery=purple' +
      '&camOffset=12,-10,22&camLook=0,2,-10&cloudMood=busy',
    portrait: 'camOffset=4,-10,60&camLook=0,2,-5',
  },
};
