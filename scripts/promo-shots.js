// Shot list for scripts/promo.js: each shot is a set of game URL parameters
// (see the README). To change one, open it with `node scripts/promo.js urls`
// (links to the dev server with the debug menu), adjust the view and copy it
// with the debug menu's copy URL buttons, then paste the whole link as the
// shot's query. Locations are for seed 20260101 (the rock arch's latitude
// depends on the seed).

// Shared by every shot: no title screen, interface or music; one world
// and one clock, so the moon, weather, sky palette and clouds repeat, and
// no Christmas (seed 20260101 is Jan 1, inside the season). Each
// shot sets its own cloudMood (fair, mixed, mackerel, high or busy), so the
// set shows off the different skies.
export const COMMON =
  'start=1&ui=0&music=0&seed=20260101&preset=ultra&timeSpeed=0' +
  '&clock=1790000000000&cloudTime=500&fps=0&adaptive=0&traffic=0&xmas=off';

// Title and end cards: the app icon and name, an optional tagline, and lines
// of smaller text (the music credit, the web address); `version` adds the
// game's version in the lower right
const TITLE = {title: 'CHILL FLIGHT'};
const SIGN_OFF = {title: 'CHILL FLIGHT', lines: ['Music by Purrple Cat']};

// Single images for other placements, each a shot at its own size: the
// YouTube thumbnail (with the app icon and name over it), and the App Store's
// product page header and search results asset (no text: the store shows the
// icon and name beside them; keep the subject near the center, as the edges
// can be cropped). `query` adds parameters to the shot's; `png` saves a PNG
// (RGB, no alpha) instead of a JPEG.
export const ARTWORK = {
  thumbnail: {shot: 'islands-sunset', width: 1280, height: 720, logo: true},
  // The link preview (Open Graph and Twitter cards) for the website: copy it
  // to public/og-image.jpg
  'og-image': {shot: 'islands-sunset', width: 1200, height: 630, logo: true},
  // 3840x1646. App Store Connect takes the header only as a PNG (it calls a
  // JPEG's dimensions invalid), though it takes the search results as a JPEG
  'appstore-header': {
    shot: 'islands-sunset',
    width: 1920,
    height: 823,
    scale: 2,
    png: true,
  },
  // 3840x2560
  'appstore-search': {
    shot: 'sunrise-lakes',
    width: 1920,
    height: 1280,
    scale: 2,
  },
  // itch.io project cover: minimum 315x250, recommended 630x500 (aspect ratio 63:50).
  // Rendered at 1260x1000 (2x) so the 3D scene renders natively in high resolution for Retina displays.
  'itch-cover': {
    shot: 'islands-sunset',
    width: 1260,
    height: 1000,
    logo: true,
  },
};

// Output targets: CSS size, pixel density (scale), touch device (mobile, for
// the game's touch layout) and, for videos, an optional title card before
// the clips and end card after them. App Store sizes: iPhone 6.9" and 6.3"
// screenshots, iPhone previews (one size for both), and iPad 13" screenshots
// and previews (portrait).
const PREVIEW_SHOTS = [
  'sunrise-lakes',
  'falls-pass',
  'arch',
  'snow-biplane',
  'clover-loop',
  'canyon-jet',
  'islands-sunset',
  'airport-dusk',
];

export const TARGETS = {
  iphone: {width: 440, height: 956, scale: 3, mobile: true}, // 1320x2868
  // iPhone with Dynamic Island, medium display (6.3"): the size App Store
  // Connect requires; it doesn't take the larger iPhone's screenshots
  'iphone-medium': {width: 402, height: 874, scale: 3, mobile: true}, // 1206x2622
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
    shots: PREVIEW_SHOTS,
    endCard: {...SIGN_OFF, seconds: 2.5},
  },
  'ipad-preview': {
    width: 900,
    height: 1200,
    scale: 4 / 3, // 1200x1600
    mobile: true,
    video: true,
    shots: PREVIEW_SHOTS,
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
      lines: [...SIGN_OFF.lines, 'chillflight.app'],
      version: true,
      seconds: 3.5,
    },
  },
};

// `query`: the shot's parameters; `portrait` / `landscape`: extra ones for
// those targets (e.g. another camera position). `seconds`: a video clip of
// that length (in list order). `still: false` leaves it out of the stills.
// `preroll`: seconds to fly before filming, for things that build up slowly
// (default PREROLL, 1.5 s). `moves`: scripted flying for a clip, as keyframes
// [t, rollDeg, pitchDeg]: t in seconds from the start of filming (after the
// preroll), roll positive to the left (left wing down), pitch positive nose
// up. Values ease between keyframes and hold after the last one. The flight
// model turns the plane from the roll and climbs it from the pitch. Stills
// ignore moves.
// Shots from straight behind the plane use the game's own chase camera with
// the interface on (ui=1), as players see it. The others each have their own
// angle, so the set shows the planes from all around.
export const SHOTS = {
  // --- Flying: stills, and the video's clips in order (through one day,
  // sunrise to dusk) ---
  'sunrise-lakes': {
    query:
      'lat=0.1S&long=1.3W&heading=-80&tod=0.265&livery=coral&ui=1' +
      '&cloudMood=busy',
    seconds: 4,
    moves: [
      [0, 0, 0],
      [1.5, -18, 2],
      [4, 12, 0],
    ],
  },
  'falls-pass': {
    // South away from the falls (X = 0, Z = -4500: 0.9 North) in warm morning
    // light, from ahead and above, the fall pouring from its bay behind the
    // banking plane
    query:
      'x=25&y=295&z=-4320&heading=180&speed=1&tod=0.285&livery=coral' +
      '&camOffset=16,28,-78&camLook=-4,16,55&cloudMood=fair',
    seconds: 4,
    stillTime: 1.5,
    portrait: 'camOffset=10,22,-105',
    moves: [
      [0, 0, 0],
      [1.2, 26, 2],
      [3, 22, 4],
      [4, 15, 4],
    ],
  },
  arch: {
    // Flying through the grand natural sea arch (X = 8711, Z = 7660: 1.74 East,
    // 1.53 South) over turquoise coral reef shallows toward the karst islands
    query:
      'x=8420&y=115&z=8160&heading=-30&speed=1&tod=0.36&plane=twin&livery=teal' +
      '&camOffset=12,-4,48&camLook=0,6,-80&cloudMood=fair',
    seconds: 4,
    stillTime: 0.9,
    portrait: 'camOffset=9,-4,68&camLook=0,6,-80',
    moves: [
      [0, 0, 0],
      [1.2, 0, 0],
      [2.5, -16, 2],
      [4, -8, 2],
    ],
  },
  'snow-biplane': {
    // From high above, gliding over a snowy alpine lake shore and pine woods
    // (X = -1360, Z = -14680: 0.27 West, 2.94 North) in falling snow
    query:
      'x=-1360&y=420&z=-14680&heading=198&tod=0.42&plane=biplane&livery=coral' +
      '&camOffset=0,60,25&camLook=0,0,-10&cloudMood=high&weather=snow',
    seconds: 4,
  },
  'clover-loop': {
    // Three-quarter front view over the island bays (X = 9200, Z = 4200:
    // 1.84 East, 0.84 South) with airshow smoke on, pulling up into a quarter
    // clover loop
    query:
      'x=9200&y=340&z=4200&heading=145&speed=1.15&tod=0.58&plane=biplane' +
      '&livery=coral&smoke=1&camOffset=34,8,-36&camLook=-6,4,18&cloudMood=fair',
    seconds: 4,
    stillTime: 3.55,
    portrait: 'camOffset=26,8,-52&camLook=-6,4,18',
    moves: [
      [0, 0, 0, 0],
      [0.25, 0, 0, 0],
      [0.9, 18, null, 0],
      [1.6, 52, null, 45],
      [2.3, 0, null, 90],
      [3.7, 0, 360, 90],
      [4, 0, 360, 90],
    ],
  },
  'buggy-bridge': {
    // Driving the dune buggy across the cross-country lake bridge (X = -2480,
    // Z = 2216: 0.50 West, 0.44 South) with sailboats and mountains beyond
    query:
      'x=-2650&y=48&z=2186&heading=-103.5&plane=buggy&livery=coral' +
      '&autopilot=1&waypoint=0.5S,0.3E&traffic=1&speed=1.6&tod=0.66' +
      '&camOffset=7,7.5,15&camLook=-2,-1,-30&cloudMood=fair',
    seconds: 4,
    portrait: 'camOffset=5,8,20&camLook=-2,-1,-30',
  },
  'canyon-jet': {
    // Swept-wing jet carving at high speed through the winding red-rock canyon
    // and under a natural rock bridge (X = 3061, Z = 14413: 0.61 East,
    // 2.88 South) at golden hour
    query:
      'x=3150&y=108&z=16050&heading=-11&speed=2.2&tod=0.69&plane=jet' +
      '&livery=coral&camOffset=-10,10,36&camLook=2,-2,-90&cloudMood=high',
    preroll: 1.2,
    seconds: 4,
    stillTime: 1.5,
    portrait: 'camOffset=-8,12,52&camLook=2,-2,-90',
    moves: [
      [0, -24, 0],
      [0.7, 26, 0],
      [2.0, 26, 0],
      [3.0, -18, 1],
      [4, 14, 3],
    ],
  },
  pyramids: {
    // Past the three Great Pyramids in the southwestern desert (X = -9750,
    // Z = 21000: 1.95 West, 4.20 South) in low golden-hour sun
    query:
      'x=-7950&y=460&z=21650&heading=72&speed=1&tod=0.71&plane=biplane' +
      '&livery=gold&camOffset=-32,12,42&camLook=18,-18,-80&cloudMood=high',
    stillTime: 1.2,
    portrait: 'camOffset=-24,14,62&camLook=16,-18,-80',
    moves: [
      [0, -10, 0],
      [1.5, -24, 2],
      [4, -12, 3],
    ],
  },
  volcano: {
    // Over the volcano (X = -5000, Z = 5000: 1.0 West, 1.0 South) at sunset,
    // with the smoking crater ahead and the desert pyramids on the horizon
    query:
      'x=-3250&y=2420&z=2900&heading=140&tod=0.745&livery=rose&ui=1' +
      '&cloudMood=busy',
    stillTime: 1.0,
    moves: [
      [0, -14, 0],
      [2.5, 16, 2],
      [4, 10, 0],
    ],
  },
  'islands-sunset': {
    // North-west over the islands, side-on against the sunset
    query:
      'lat=0.2S&long=2.4E&heading=45&tod=0.745&plane=biplane&livery=teal' +
      '&camOffset=60,-8,5&cloudMood=busy',
    seconds: 4,
    portrait: 'camOffset=85,-12,5',
  },
  lighthouse: {
    // Banking past the headland lighthouse (X = 7500, Z = 3000: 1.5 East,
    // 0.6 South) at dusk with its rotating warm beam and crescent moon
    query:
      'x=7960&y=105&z=3210&heading=75&speed=1&tod=0.785&headlight=1' +
      '&plane=biplane&livery=teal&camOffset=-48,-4,28&camLook=8,8,-50' +
      '&cloudMood=mackerel',
    seconds: 4,
    stillTime: 1.65,
    portrait: 'camOffset=-65,-4,38&camLook=8,8,-50',
    moves: [
      [0, 8, 0],
      [1.5, 22, 2],
      [4, -12, 2],
    ],
  },
  'airport-dusk': {
    // Rolling on the wheels down Meadow Field's lit runway (X = 1500, Z = 2400:
    // 0.3 East, 0.5 South) at dusk and lifting off past the control tower,
    // hangar and parked planes
    query:
      'x=1100&y=56&z=2400&heading=-90&speed=1&tod=0.8&headlight=1' +
      '&plane=biplane&livery=slate&camOffset=-14,2,36&camLook=6,4,-80' +
      '&cloudMood=mackerel',
    preroll: 0.8,
    seconds: 4,
    stillTime: 1.9,
    portrait: 'camOffset=-10,4,52&camLook=6,4,-80',
    moves: [
      [0, 0, 0],
      [1.4, 0, 0],
      [2.4, -12, 15],
      [3.5, -14, 12],
      [4, -8, 8],
    ],
  },
  alien: {
    // Emerging through a basalt hex gate (X = 73316, Z = -12234: 14.66 East,
    // 2.45 North) into a wide alien mushroom grove while trailing rainbow smoke
    query:
      'x=73344&y=215&z=-11800&heading=2&speed=1&tod=0.53&plane=seaplane' +
      '&livery=gold&trip=1&camOffset=-10,10,42&camLook=2,-4,-70&cloudMood=busy',
    preroll: 1.2,
    seconds: 4,
    stillTime: 2.2,
    portrait: 'camOffset=-8,12,58&camLook=2,-4,-70',
    moves: [
      [0, 0, 0],
      [1.2, 0, 0],
      [2.4, -10, 1],
      [3.5, 12, 2],
      [4, 6, 3],
    ],
  },

  // --- Stills only ---
  map: {
    // The whole-world map with a waypoint set on the canyon, over the
    // islands at midday
    query:
      'lat=0.2S&long=2.4E&heading=180&tod=0.5&ui=1&fullscreenmap=1' +
      '&mapLat=3S&mapLong=-3&mapZoom=60000&waypoint=4S,1E&cloudMood=fair',
  },
};
