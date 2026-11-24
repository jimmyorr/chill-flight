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
  'start=1&ui=0&music=0&hints=0&seed=20260101&preset=ultra&timeSpeed=0' +
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
  // Meta Quest Browser New Tab Page / Horizon cover art: 2560x1440 (16:9) and
  // 1440x1440 (1:1) 24-bit RGB PNGs rendered natively at 2x scale.
  'meta-landscape': {
    shot: 'islands-sunset',
    width: 1280,
    height: 720,
    scale: 2,
    logo: true,
    png: true,
  },
  'meta-square': {
    shot: 'islands-sunset',
    width: 720,
    height: 720,
    scale: 2,
    query: 'camOffset=52,6,34&camLook=-10,-2,-40',
    logo: true,
    png: true,
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
  'clover-loop',
  'canyon-jet',
  'islands-sunset',
  'fireworks',
];

export const TARGETS = {
  // iPhone with Dynamic Island, medium display (6.3"): the size App Store
  // Connect requires; it doesn't take the larger iPhone's screenshots
  iphone: {width: 402, height: 874, scale: 3, mobile: true}, // 1206x2622
  ipad: {width: 1032, height: 1376, scale: 2, mobile: true}, // 2064x2752
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
      'lat=0.14S&long=1.08W&heading=-105&tod=0.265&livery=coral&ui=1' +
      '&cloudMood=busy',
    seconds: 4,
    stillTime: 1.1,
    moves: [
      [0, 0, 2],
      [1.5, -16, 4],
      [4, 10, 2],
    ],
  },
  'falls-pass': {
    // South away from the falls (X = 0, Z = -4500: 0.9 North) in warm golden
    // sunrise light, three-quarter front view with the fall pouring behind the
    // banking plane
    query:
      'x=25&y=295&z=-4320&heading=180&speed=1&tod=0.26&livery=coral' +
      '&camOffset=44,22,-66&camLook=-8,14,45&cloudMood=fair',
    seconds: 4,
    stillTime: 2.05,
    portrait: 'camOffset=44,22,-96&camLook=-18,14,20',
    moves: [
      [0, 0, 0],
      [1.2, 26, 2],
      [3, 22, 4],
      [4, 15, 4],
    ],
  },
  'clover-loop': {
    // Three-quarter front view over the island bays (X = 9200, Z = 4200:
    // 1.84 East, 0.84 South) with airshow smoke on, pulling up into a quarter
    // clover loop
    query:
      'x=9200&y=340&z=4200&heading=145&speed=1.15&tod=0.58&plane=biplane' +
      '&livery=coral&smoke=1&camOffset=34,8,-36&camLook=-6,4,18&cloudMood=fair',
    seconds: 5.5,
    stillTime: 3.2,
    portrait: 'camOffset=30,8,-62&camLook=-2,4,18',
    moves: [
      [0, 0, 0, 0],
      [0.25, 0, 0, 0],
      [0.9, 18, null, 0],
      [1.6, 52, null, 45],
      [2.3, 0, null, 90],
      [3.7, 0, 360, 90],
      [5.5, 0, 360, 90],
    ],
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
    stillTime: 1.7,
    portrait: 'camOffset=-8,12,52&camLook=2,-2,-90',
    moves: [
      [0, -24, 0],
      [0.7, 26, 0],
      [2.0, 26, 0],
      [3.0, -18, 1],
      [4, 14, 3],
    ],
    wingmen: [
      {
        plane: 'jet',
        livery: 'teal',
        frame: 'yaw',
        offset: [8, 4, -55],
        offsetMoves: [
          [0, 6, 3, -55, -20, 0, 0],
          [0.5, 8, 4, -55, 24, 0, 0],
          [1.8, 10, 4, -55, 24, 0, 0],
          [2.8, 6, 3, -55, -16, 1, 0],
          [4, 8, 3, -55, 14, 2, 0],
        ],
        smoke: false,
      },
    ],
  },
  'islands-sunset': {
    // Three-quarter rear chase banking into the golden sunset over the island
    // archipelago and coastal mountain peak (0.25 South, 2.2 East)
    query:
      'lat=0.25S&long=2.2E&heading=65&tod=0.74&plane=biplane&livery=coral' +
      '&camOffset=42,6,28&camLook=-10,-2,-40&cloudMood=busy',
    seconds: 4,
    stillTime: 1.0,
    iphone: 'camOffset=58,7,38&camLook=2,0,-24',
    moves: [
      [0, 12, 1],
      [1.5, 15, 1],
      [4, 6, 0.5],
    ],
  },
  'buggy-bridge': {
    // Driving across the snowy northern alpine fjord bridge (X = -13829,
    // Z = -16100: 2.77 West, 3.22 North) in pink alpenglow, 3/4 side view
    query:
      'x=-13829&y=60&z=-16100&heading=-2.7&plane=buggy&livery=coral' +
      '&autopilot=1&waypoint=3.46N,2.89W&traffic=1&speed=1.6&tod=0.76' +
      '&headlight=1&camOffset=15,4.5,13&camLook=-2,0.8,-10&cloudMood=high',
    seconds: 4,
    stillTime: 1.2,
    iphone: 'camOffset=19,5,17&camLook=-1,0.8,-8',
  },
  lighthouse: {
    // Banking past Montauk Lighthouse (X = 7500, Z = 3000: 1.5 East, 0.6 South)
    // at dusk with the striped tower on the left, crescent moon centered above
    // its water reflection, and teal biplane on the right
    query:
      'x=7920&y=112&z=3150&heading=70&speed=1&tod=0.782&headlight=1' +
      '&plane=biplane&livery=teal&camOffset=-82,2,46&camLook=6,8,-34' +
      '&cloudMood=high&clouds=0.1',
    seconds: 5.5,
    stillTime: 0.55,
    iphone: 'camOffset=-106,2,58&camLook=14,8,-56',
    moves: [
      [0, 12, 1],
      [1.5, 20, 2],
      [4, -10, 2],
      [5.5, -10, 1],
    ],
  },
  'aurora-snow': {
    // Gold biplane gliding through falling snow over an alpine lake (X = -1360,
    // Z = -14400: 0.27 West, 2.88 North) under the moon and northern lights
    query:
      'x=-1360&y=310&z=-14400&heading=8&clock=1789934782500&timeSpeed=1' +
      '&weather=snow&clouds=0.05&fireworks=0&plane=biplane&livery=gold' +
      '&camOffset=18,-4,44&camLook=-3,16,-115&cloudMood=fair',
    preroll: 5.5,
    seconds: 5,
    stillTime: 0.8,
    iphone: 'camOffset=20,-4,48&camLook=-10,16,-115&fov=72',
    moves: [
      [0, -12, 1],
      [2.2, -10, 1.5],
      [5, 8, 1],
    ],
  },
  fireworks: {
    // Approaching Lagoon Bay's Grand Finale fireworks (X = 5450, Z = 4350:
    // 1.09 East, 0.87 South) under a starry sky and crescent moon
    query:
      'x=5450&y=215&z=6250&heading=0&clock=1789999939500&timeSpeed=1' +
      '&weather=clear&clouds=0.05&fireworks=1&plane=biplane&livery=coral' +
      '&camOffset=12,-4,42&camLook=-2,18,-120&cloudMood=fair',
    preroll: 2.5,
    seconds: 7.5,
    stillTime: 2.85,
    iphone: 'camOffset=12,-4,56&camLook=8,18,-120',
    moves: [
      [0, 0, 0.5],
      [1.5, 4, 0.8],
      [3.5, -4, 0.8],
      [5.5, 0, 0.5],
      [7.5, 0, 0.5],
    ],
  },
};
