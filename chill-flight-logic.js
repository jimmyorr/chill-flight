// --- CHILL FLIGHT LOGIC ---
// Pure, side-effect-free functions extracted for testability.
// ES module shared by the game, the terrain worker, and Node tests.

export const ChillFlightLogic = {};

(function (exports) {
  // --- WORLD SEED ---
  // Controls all procedural world generation. Can be overridden via ?seed=N URL param.
  // Defaults to current date in YYYYMMDD format.
  const getTodaySeed = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return parseInt(year + month + day, 10);
  };

  const urlParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null;

  // Helper to get parameters safely in both Browser and Node (for tests)
  const getParam = (key, defaultValue) => {
    if (!urlParams) return defaultValue;
    const val = urlParams.get(key);
    return val === null ? defaultValue : val;
  };

  // Parse a coordinate parameter which can be a number (e.g. 1.5, -2) or string (e.g. 1S, 2E, 1.5N, 2.3W)
  function parseCoordinate(val, isLatitude) {
    if (val === null || val === undefined || val === '') return null;
    const cleaned = val.trim();
    // Match number and optional direction suffix (N, S, E, W, n, s, e, w)
    const match = cleaned.match(
      /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*([NnSsEeWw][a-zA-Z]*)?$/
    );
    if (!match) {
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }
    const num = parseFloat(match[1]);
    const suffix = match[2] ? match[2].charAt(0).toUpperCase() : null;
    if (isNaN(num)) return null;
    if (suffix) {
      if (isLatitude) {
        if (suffix === 'S') return -Math.abs(num);
        if (suffix === 'N') return Math.abs(num);
      } else {
        if (suffix === 'W') return -Math.abs(num);
        if (suffix === 'E') return Math.abs(num);
      }
    }
    return num;
  }

  const parsedLat = parseCoordinate(getParam('lat', null), true);
  const parsedLon = parseCoordinate(
    getParam('long', getParam('lon', null)),
    false
  );

  const altParamVal = getParam('alt', null);
  const parsedAlt =
    altParamVal !== null && altParamVal !== '' ? parseFloat(altParamVal) : null;
  const validAlt = parsedAlt !== null && !isNaN(parsedAlt) ? parsedAlt : null;

  const WORLD_SEED = parseInt(getParam('seed', getTodaySeed()), 10);
  const THEME = getParam('theme', 'standard');

  const rawCloudParam = getParam(
    'cloud',
    getParam('clouds', getParam('cloudCover', getParam('overcast', null)))
  );
  let SHOW_CLOUDS = true;
  let START_CLOUD_COVER = null; // null = auto / procedural noise

  if (rawCloudParam !== null && rawCloudParam !== '') {
    const cloudStr = rawCloudParam.trim().toLowerCase();
    if (['none', 'false', 'off'].includes(cloudStr)) {
      SHOW_CLOUDS = false;
      START_CLOUD_COVER = 0.0;
    } else if (cloudStr === 'auto') {
      SHOW_CLOUDS = true;
      START_CLOUD_COVER = null;
    } else if (cloudStr === 'clear') {
      SHOW_CLOUDS = true;
      START_CLOUD_COVER = 0.0;
    } else if (cloudStr === 'scattered') {
      SHOW_CLOUDS = true;
      START_CLOUD_COVER = 0.3;
    } else if (cloudStr === 'broken') {
      SHOW_CLOUDS = true;
      START_CLOUD_COVER = 0.6;
    } else if (cloudStr === 'overcast') {
      SHOW_CLOUDS = true;
      START_CLOUD_COVER = 1.0;
    } else {
      const parsedDensity = parseFloat(cloudStr);
      if (!isNaN(parsedDensity)) {
        SHOW_CLOUDS = true;
        START_CLOUD_COVER = Math.max(0, Math.min(1, parsedDensity));
      }
    }
  }

  const rawCloudHeight = getParam(
    'cloudHeight',
    getParam('cloudAlt', getParam('cloudCeiling', null))
  );
  const parsedCloudHeight =
    rawCloudHeight !== null && rawCloudHeight !== ''
      ? parseFloat(rawCloudHeight)
      : null;
  const START_CLOUD_HEIGHT =
    parsedCloudHeight !== null && !isNaN(parsedCloudHeight)
      ? Math.max(500, Math.min(10000, parsedCloudHeight))
      : 3000.0;

  const rawCloudSpeed = getParam('cloudSpeed', null);
  const parsedCloudSpeed =
    rawCloudSpeed !== null && rawCloudSpeed !== ''
      ? parseFloat(rawCloudSpeed)
      : null;
  const START_CLOUD_SPEED =
    parsedCloudSpeed !== null && !isNaN(parsedCloudSpeed)
      ? Math.max(0, Math.min(20, parsedCloudSpeed))
      : 1.0;

  let SHOW_OBJECTS = true;
  const objectsParam = getParam('objects', null);
  if (objectsParam === 'none') {
    SHOW_OBJECTS = false;
  } else if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem('chill_flight_show_objects');
    if (saved !== null) {
      SHOW_OBJECTS = saved === 'true';
    }
  }

  const MAP_NAME = getParam('map', null);
  const PALETTE_INDEX = getParam('palette', null);
  const ZENITH_COLOR = getParam('zenith', null);
  const HORIZON_COLOR = getParam('horizon', null);
  const DAY_COLOR = getParam(
    'day',
    getParam(
      'dayBlue',
      getParam('dayblue', getParam('day_blue', getParam('dayColor', null)))
    )
  );
  const SCALE = parseFloat(getParam('scale', '1.0'));
  const START_FREE_CAM =
    getParam('freecam', 'false') === 'true' ||
    getParam('freeCamera', 'false') === 'true';
  // On/off switches: "0", "false" or "off" is off; anything else (including
  // a bare ?name) is on; null when the parameter isn't there.
  // An on/off URL switch: null when absent; ?x, ?x=1 or ?x=true are on,
  // ?x=0, ?x=false or ?x=off are off
  const parseSwitch = (v) =>
    v === null ? null : !['0', 'false', 'off'].includes(v.trim().toLowerCase());
  exports.parseSwitch = parseSwitch;
  const getSwitchParam = (name) => parseSwitch(getParam(name, null));
  // Mostly for scripted screenshots and benchmarks (see README): ?start=1
  // skips the title screen, ?ui=0 hides all interface, ?music=0/1 sets music
  // for this visit only, and ?tips=0 skips the first-time tips.
  const START_NOW = getSwitchParam('start') === true;
  const SHOW_UI = getSwitchParam('ui') !== false;
  // ?adaptive=0: hold the preset's full quality instead of lowering detail and
  // resolution when frames run slow (for renders, whose frames are stepped)
  const ADAPTIVE_QUALITY = getSwitchParam('adaptive') !== false;
  // ?traffic=0/1: other planes off or on for this visit (traffic.js)
  const TRAFFIC_PARAM = getSwitchParam('traffic');
  // Flying together (multiplayer.js): ?room= a room code to join (an invite
  // link), ?relay= a relay to use instead of the game's own (local testing)
  const ROOM_PARAM = getParam('room', null);
  const RELAY_PARAM = getParam('relay', null);
  const MUSIC_PARAM = getSwitchParam('music');
  const SFX_PARAM = getSwitchParam('sfx');
  const SHOW_TIPS = getSwitchParam('tips') !== false && SHOW_UI;
  const _debugParam = getParam('debug', null);
  const START_DEBUG =
    _debugParam === '' ||
    _debugParam === '1' ||
    (_debugParam !== null && _debugParam.trim().toLowerCase() === 'true');

  const _autopilotParam = getParam(
    'autopilot',
    getParam('autoPilot', getParam('auto', null))
  );
  const START_AUTOPILOT =
    _autopilotParam === '' ||
    _autopilotParam === '1' ||
    (_autopilotParam !== null &&
      ['true', 'yes', 'on', '1'].includes(
        _autopilotParam.trim().toLowerCase()
      ));

  const _minimapParam = getParam(
    'minimap',
    getParam('miniMap', getParam('mapOverlay', null))
  );
  const START_MINIMAP =
    _minimapParam === '' ||
    _minimapParam === '1' ||
    (_minimapParam !== null &&
      ['true', 'yes', 'on', '1'].includes(_minimapParam.trim().toLowerCase()));

  const _fullscreenMapParam = getParam(
    'fullscreenmap',
    getParam(
      'fullscreenMap',
      getParam(
        'fullscreen-map',
        getParam('worldmap', getParam('worldMap', getParam('world-map', null)))
      )
    )
  );
  const _mapParamVal = getParam('map', null);
  const _mapLatParam = getParam('mapLat', getParam('maplat', null));
  const parsedMapLat = parseCoordinate(_mapLatParam, true);

  const _mapLonParam = getParam(
    'mapLon',
    getParam('maplon', getParam('mapLong', getParam('maplong', null)))
  );
  const parsedMapLon = parseCoordinate(_mapLonParam, false);

  // ?waypoint=<lat>,<long> sets a waypoint (waypoint.js), e.g. 4S,1E
  const _waypointParam = getParam('waypoint', null);
  const waypointParts = _waypointParam ? _waypointParam.split(',') : [];
  const parsedWaypoint =
    waypointParts.length === 2
      ? [
          parseCoordinate(waypointParts[0], true),
          parseCoordinate(waypointParts[1], false),
        ]
      : null;

  const _mapXParam = getParam('mapX', getParam('mapx', null));
  const START_MAP_X =
    _mapXParam !== null && _mapXParam !== '' ? parseFloat(_mapXParam) : null;

  const _mapZParam = getParam('mapZ', getParam('mapz', null));
  const START_MAP_Z =
    _mapZParam !== null && _mapZParam !== '' ? parseFloat(_mapZParam) : null;

  const _mapZoomParam = getParam(
    'mapZoom',
    getParam('mapzoom', getParam('zoom', getParam('mapRadius', null)))
  );
  const parsedMapZoomVal =
    _mapZoomParam !== null && _mapZoomParam !== ''
      ? parseFloat(_mapZoomParam)
      : null;
  const START_MAP_ZOOM =
    parsedMapZoomVal !== null &&
    !isNaN(parsedMapZoomVal) &&
    parsedMapZoomVal > 0
      ? parsedMapZoomVal
      : null;

  const hasMapUrlParams =
    parsedMapLat !== null ||
    parsedMapLon !== null ||
    (START_MAP_X !== null && !isNaN(START_MAP_X)) ||
    (START_MAP_Z !== null && !isNaN(START_MAP_Z)) ||
    START_MAP_ZOOM !== null;

  const isFullscreenMapExplicitlyDisabled =
    _fullscreenMapParam !== null &&
    ['false', 'off', '0', 'no'].includes(
      _fullscreenMapParam.trim().toLowerCase()
    );

  const START_FULLSCREEN_MAP =
    (!isFullscreenMapExplicitlyDisabled && hasMapUrlParams) ||
    _fullscreenMapParam === '' ||
    _fullscreenMapParam === '1' ||
    (_fullscreenMapParam !== null &&
      ['true', 'yes', 'on', '1'].includes(
        _fullscreenMapParam.trim().toLowerCase()
      )) ||
    (_mapParamVal !== null &&
      ['fullscreen', 'full', 'world'].includes(
        _mapParamVal.trim().toLowerCase()
      ));

  const _xParam = getParam('x', null);
  const START_X =
    _xParam !== null && _xParam !== '' ? parseFloat(_xParam) : null;
  const _yParam = getParam('y', null);
  const START_Y =
    _yParam !== null && _yParam !== '' ? parseFloat(_yParam) : null;
  const _zParam = getParam('z', null);
  const START_Z =
    _zParam !== null && _zParam !== '' ? parseFloat(_zParam) : null;

  const _headingParam = getParam('heading', null);
  const START_HEADING =
    _headingParam !== null && _headingParam !== ''
      ? parseFloat(_headingParam)
      : null;
  const _pitchParam = getParam('pitch', null);
  const START_PITCH =
    _pitchParam !== null && _pitchParam !== '' ? parseFloat(_pitchParam) : null;

  const _speedParam = getParam('speed', null);
  const START_SPEED =
    _speedParam !== null && _speedParam !== '' ? parseFloat(_speedParam) : null;

  // --- Shot parameters (camera, lights and clocks), for reproducible views:
  // the debug menu's "copy URL" buttons write them (see README).
  const parseNumberParam = (name) => {
    const v = getParam(name, null);
    if (v === null || v === '') return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
  };
  // "x,y,z" -> [x, y, z], or null
  const parseVec3Param = (name) => {
    const v = getParam(name, null);
    if (v === null) return null;
    const parts = v.split(',').map((p) => parseFloat(p));
    return parts.length === 3 && parts.every((n) => !isNaN(n)) ? parts : null;
  };
  const CAMERA_MODES = [
    'follow',
    'first-person',
    'birds-eye-close',
    'birds-eye-far',
    'cinematic',
  ];
  const _cameraParam = (getParam('camera', '') || '').trim().toLowerCase();
  // A chase offset relative to the plane (right, up, behind) is a custom
  // cinematic view; camLook is the point it looks at, also relative.
  const START_CAM_OFFSET = parseVec3Param('camOffset');
  const START_CAM_LOOK = parseVec3Param('camLook');
  const START_CAMERA = START_CAM_OFFSET
    ? 'cinematic'
    : CAMERA_MODES.includes(_cameraParam)
      ? _cameraParam
      : null;
  // Which of the cinematic mode's preset angles (game.js CINEMATIC_CONFIGS)
  const _angleParam = parseNumberParam('angle');
  const START_CAM_ANGLE =
    _angleParam !== null && _angleParam >= 0 ? Math.floor(_angleParam) : null;
  const START_FOV = parseNumberParam('fov');
  const START_HEADLIGHT = getSwitchParam('headlight');
  // The plane's bank, in degrees (holds while the free camera freezes the
  // plane; in flight the flight model takes over)
  const START_ROLL = parseNumberParam('roll');
  // With the free camera, camX/camY/camZ/camHeading/camPitch place the camera
  // and x/y/z/heading/pitch/roll the plane. Without them x/y/z/heading/pitch
  // place the free camera, as before.
  const START_CAM_X = parseNumberParam('camX');
  const START_CAM_Y = parseNumberParam('camY');
  const START_CAM_Z = parseNumberParam('camZ');
  const START_CAM_HEADING = parseNumberParam('camHeading');
  const START_CAM_PITCH = parseNumberParam('camPitch');
  const HAS_CAM_PLACEMENT = [
    START_CAM_X,
    START_CAM_Y,
    START_CAM_Z,
    START_CAM_HEADING,
    START_CAM_PITCH,
  ].some((v) => v !== null);
  // The world clock (ms since 1970) sets the moon phase, aurora, procedural
  // weather and the day's sky palette; cloudTime (seconds) is how far the
  // clouds have drifted. With timeSpeed=0 both stay put.
  const START_CLOCK = parseNumberParam('clock');
  const START_CLOUD_TIME = parseNumberParam('cloudTime');
  // Forces the day's cloud mood (see cloudMoodForDay)
  const START_CLOUD_MOOD = getParam('cloudMood', null) || null;

  const _todParam = getParam('tod', null);
  const START_TOD =
    _todParam !== null && _todParam !== '' ? parseFloat(_todParam) : null;

  const _timeSpeedParam = getParam('timeSpeed', null);
  const START_TIME_SPEED =
    _timeSpeedParam !== null && _timeSpeedParam !== ''
      ? parseFloat(_timeSpeedParam)
      : null;

  const _weatherParam = getParam('weather', null);
  let START_WEATHER = null;
  if (_weatherParam !== null && _weatherParam !== '') {
    const norm = _weatherParam.trim().toLowerCase();
    if (norm === 'clear') {
      START_WEATHER = 'none';
    } else if (['auto', 'none', 'snow', 'rain'].includes(norm)) {
      START_WEATHER = norm;
    }
  }

  const _propLodParam = getParam('propLod', getParam('lod', null));
  const START_PROP_LOD =
    _propLodParam !== null && _propLodParam !== ''
      ? parseFloat(_propLodParam)
      : null;

  const _benchmarkParam = getParam('benchmark', null);
  const START_BENCHMARK =
    _benchmarkParam !== null && _benchmarkParam !== ''
      ? parseFloat(_benchmarkParam)
      : null;

  const _presetParam = getParam('preset', getParam('graphics', null));
  const GRAPHICS_PRESET =
    _presetParam !== null && _presetParam !== ''
      ? _presetParam.toLowerCase()
      : null;

  // Frame rate cap; 0 lifts it (null: the preset's)
  const _fpsParam = parseFloat(getParam('fps', ''));
  const MAX_FPS = _fpsParam >= 0 ? _fpsParam : null;

  const _islandTypeParam = getParam('islandType', getParam('island', null));
  let START_ISLAND_TYPE = 'auto';
  if (_islandTypeParam !== null && _islandTypeParam !== '') {
    const norm = _islandTypeParam.trim().toLowerCase();
    if (['auto', 'karst', 'caldera', 'atoll'].includes(norm)) {
      START_ISLAND_TYPE = norm;
    }
  }

  // The buggy is offered by default (disable with ?buggy=0)
  const PLANE_TYPES = ['biplane', 'seaplane', 'twin', 'jet'];
  const buggyDisabled = getSwitchParam('buggy') === false;
  if (!buggyDisabled) PLANE_TYPES.push('buggy');
  // A plane type from a URL or saved setting, or null if it isn't one.
  // "classic" was the seaplane's old name, so old links and saves still work.
  function normalizePlaneType(type) {
    if (!type) return null;
    const norm = String(type).trim().toLowerCase();
    if (norm === 'classic') return 'seaplane';
    return PLANE_TYPES.includes(norm) ? norm : null;
  }
  const START_PLANE = normalizePlaneType(
    getParam('plane', getParam('vehicle', null))
  );
  // Reads exports.FORCE_ISLAND_TYPE, which the debug UI changes at runtime and
  // terrain workers set from each job (they can't see the page URL).
  function getIslandArchetype(x, z, simplexInstance) {
    const forced = exports.FORCE_ISLAND_TYPE;
    if (forced && forced !== 'auto') {
      return forced;
    }
    if (x <= 3000) return 'none';
    if (!simplexInstance) return 'standard';
    const noise = simplexInstance.noise2D(
      x * 0.00004 + 8191,
      z * 0.00004 + 8191
    );
    if (noise < -0.15) return 'karst';
    if (noise > 0.15) return 'atoll';
    return 'caldera';
  }

  // --- SEEDED PRNG: Mulberry32 ---
  // Returns a closure that produces deterministic floats in [0, 1).
  // Usage: const rng = mulberry32(seed); rng(); // next value
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- CLOUD MOODS ---
  // Each in-game day picks a mix of the sky's cloud types (puffy cumulus,
  // cirrus streaks, mackerel sky), seeded by the world seed and the day, so a
  // given clock always shows the same sky. On some days the mackerel and
  // cirrus build up around sunrise and sunset (duskBoost), giving the low
  // sun more cloud to light. The weather still sets overcast on top.
  const CLOUD_MOODS = [
    // [name, weight, cumulus, cirrus, mackerel, cover]: amounts as [min, max]
    // ranges; cover is extra cumulus cover on top of the weather's
    ['fair', 0.25, [0.9, 1.0], [0.0, 0.15], [0.0, 0.1], 0],
    ['mixed', 0.25, [0.8, 1.0], [0.3, 0.5], [0.15, 0.35], 0.03],
    ['mackerel', 0.15, [0.3, 0.5], [0.1, 0.3], [0.8, 1.0], -0.05],
    ['high', 0.15, [0.15, 0.35], [0.5, 0.7], [0.0, 0.2], -0.12],
    ['busy', 0.2, [0.9, 1.0], [0.35, 0.55], [0.5, 0.7], 0.12],
  ];
  const CLOUD_MOOD_NAMES = CLOUD_MOODS.map((m) => m[0]);

  function cloudMoodForDay(worldSeed, day, forcedName = null) {
    const rng = mulberry32((worldSeed * 7919 + day * 104729 + 31337) | 0);
    let mood = CLOUD_MOODS.find((m) => m[0] === forcedName);
    let pick = rng();
    if (!mood) {
      mood = CLOUD_MOODS[CLOUD_MOODS.length - 1];
      for (const m of CLOUD_MOODS) {
        if (pick < m[1]) {
          mood = m;
          break;
        }
        pick -= m[1];
      }
    }
    const inRange = ([min, max]) => min + (max - min) * rng();
    return {
      name: mood[0],
      cumulus: inRange(mood[2]),
      cirrus: inRange(mood[3]),
      mackerel: inRange(mood[4]),
      cover: mood[5],
      duskBoost: rng() < 0.6 ? 0.35 + 0.25 * rng() : 0,
    };
  }

  // Per-chunk seeded PRNG. Derives a unique seed from (WORLD_SEED, chunkX, chunkZ) so
  // each chunk's detail generation (trees, clouds, birds) is identical regardless of
  // which order chunks are loaded—critical for world consistency.
  // Reads exports.WORLD_SEED, not the local constant: terrain workers can't
  // see the page URL's ?seed=, so they set the seed they're given there.
  function chunkRng(chunkX, chunkZ) {
    const s =
      (exports.WORLD_SEED * 1000003) ^
      (chunkX * 374761393 + chunkZ * 1234567891);
    return mulberry32(s);
  }

  // --- PLANE COLOR ---
  // Deterministic color picker based on a hash of the user's UID.
  const PLANE_COLORS = [
    0xd16d6a, // Sunset Coral
    0x47949b, // Chill Teal
    0x7a9e7e, // Muted Sage
    0x8675a9, // Lofi Purple
    0x5c8092, // Ocean Slate
    0xe8c382, // Soft Sand
    0xa75a7a, // Deep Rose
    0x333333, // Charcoal Black
  ];

  function getPlaneColor(uid) {
    if (!uid) return PLANE_COLORS[0];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = uid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PLANE_COLORS.length;
    return PLANE_COLORS[index];
  }

  // ?livery= an index (0-7) or name, for this visit only (not saved)
  const LIVERY_NAMES = [
    'coral',
    'teal',
    'sage',
    'purple',
    'slate',
    'sand',
    'rose',
    'black',
  ];
  const _liveryParam = (getParam('livery', '') || '').trim().toLowerCase();
  const _liveryIndex = /^\d+$/.test(_liveryParam)
    ? parseInt(_liveryParam, 10)
    : LIVERY_NAMES.indexOf(_liveryParam);
  const START_LIVERY =
    _liveryParam !== '' &&
    _liveryIndex >= 0 &&
    _liveryIndex < PLANE_COLORS.length
      ? PLANE_COLORS[_liveryIndex]
      : null;

  // --- DAY / NIGHT WARP ---
  // Maps raw cycle progress [0,1) to a warped time of day [0,1) (0 midnight,
  // 0.5 noon), so the 6-minute (360 s) day spends its time where the sky is
  // most beautiful. The day is split into phases by sun height (sunY, the sine
  // of its elevation; see flight-camera.js), each given a share of real time:
  //   night            sunY < -0.5        23 s each side of midnight
  //   twilight glow    -0.5 to -0.1       40 s at dawn, 40 s at dusk
  //   peak color       -0.1 to 0.1        45 s each (gold and pink sky,
  //                                       belt of Venus, cloud afterglow)
  //   golden light     0.1 to 0.4         40 s each
  //   full day         above 0.4          65 s
  // Within a phase the sun moves at a constant speed. Linear segments avoid
  // the phantom pauses an S-curve has at its knots. The phase edges are
  // computed for the equator (where sunrise is at 6:00) and shift by a few
  // minutes of clock time across the map's latitudes.
  const DAY_PHASE_SECONDS = [22.5, 40, 45, 40, 65];
  const DAY_PHASE_SUN_Y = [-0.5, -0.1, 0.1, 0.4];
  const SUN_DECLINATION = 0.409; // flight-camera.js
  const DAY_WARP_KNOTS = (() => {
    // The time of day (0-0.5, morning) at which the sun reaches height y
    const timeAtSunY = (y) =>
      Math.acos(-y / Math.cos(SUN_DECLINATION)) / (2 * Math.PI);
    const knots = [[0, 0]];
    let seconds = 0;
    DAY_PHASE_SUN_Y.forEach((y, i) => {
      seconds += DAY_PHASE_SECONDS[i];
      knots.push([seconds / 360, timeAtSunY(y)]);
    });
    knots.push([0.5, 0.5]);
    // The afternoon mirrors the morning
    for (let i = knots.length - 2; i >= 0; i--) {
      knots.push([1 - knots[i][0], 1 - knots[i][1]]);
    }
    return knots;
  })();

  function computeTimeOfDay(secondsInCycle) {
    const CYCLE_DURATION_S = 360;
    const p = (secondsInCycle % CYCLE_DURATION_S) / CYCLE_DURATION_S;
    for (let i = 0; i < DAY_WARP_KNOTS.length - 1; i++) {
      const [p0, w0] = DAY_WARP_KNOTS[i];
      const [p1, w1] = DAY_WARP_KNOTS[i + 1];
      if (p >= p0 && p <= p1) {
        return w0 + ((p - p0) / (p1 - p0)) * (w1 - w0);
      }
    }
    return p; // fallback (should never reach here)
  }

  // --- INPUT NORMALIZATION ---
  // Maps client pixel coordinates to a normalized range:
  //   x: [-1 (left), +1 (right)]
  //   y: [+1 (top),  -1 (bottom)]
  function computeInputPosition(clientX, clientY, width, height) {
    return {
      x: (clientX / width) * 2 - 1,
      y: -(clientY / height) * 2 + 1,
    };
  }

  // --- COMPASS HEADING ---
  // Converts a plane's Y-rotation (radians) to one of 8 compass direction strings.
  function computeHeadingDirection(rotationY) {
    const dirs = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
    let heading = rotationY % (Math.PI * 2);
    if (heading < 0) heading += Math.PI * 2;
    const deg = heading * (180 / Math.PI);
    const sector = Math.floor(((deg + 22.5) % 360) / 45);
    return dirs[sector];
  }

  const MAP_WIDTH = 120000;
  const wrapRadius = MAP_WIDTH / (Math.PI * 2);

  // Cylinder-wrapped 3D noise: maps the X-axis onto a cylinder so that
  // x = 0 and x = MAP_WIDTH sample the same noise, eliminating the wrap seam.
  // The callback receives (nx, ny) — the cylinder-surface coordinates — and
  // should return a simplex.noise3D(...) call that uses them in place of raw x.
  function cylNoise(x, fn) {
    const angle = (x / MAP_WIDTH) * Math.PI * 2;
    const nx = Math.cos(angle) * wrapRadius;
    const ny = Math.sin(angle) * wrapRadius;
    return fn(nx, ny);
  }

  // --- SNOW COVER ---
  // How snowy the north is, 0 to 1: none south of SNOW_START_LAT, full north
  // of SNOW_FULL_LAT, rising smoothly between (degrees north, 5000 units
  // each). Ground, water ice, trees and snowfall all use this, so they agree
  // where the snow starts. noiseShift (from snowNoiseShift) wobbles the edge.
  const SNOW_START_LAT = 1.5;
  const SNOW_FULL_LAT = 2.5;
  function snowFactorAt(z, noiseShift) {
    const lat = -z / 5000 + noiseShift;
    const t = Math.max(
      0,
      Math.min(1, (lat - SNOW_START_LAT) / (SNOW_FULL_LAT - SNOW_START_LAT))
    );
    return t * t * (3 - 2 * t);
  }
  // Fall color as you head north, like driving from Long Island up to the
  // Adirondacks in October. fallTurnAt is how far the broadleaf trees have
  // turned, 0 to 1: none south of FALL_START_LAT, all by FALL_FULL_LAT.
  // fallBareAt is how many have dropped their leaves: none south of
  // FALL_BARE_LAT, all by SNOW_START_LAT, where the snow takes over. Higher
  // ground turns a little earlier, and a slow wobble keeps the front from
  // being a straight line.
  const FALL_START_LAT = 0.2;
  const FALL_FULL_LAT = 1.0;
  const FALL_BARE_LAT = 1.3;
  function fallLat(x, z, height, simplex) {
    return (
      -z / 5000 +
      simplex.noise2D(x * 0.00015 + 300, z * 0.00015 - 300) * 0.12 +
      (Math.max(0, height - 40) / 150) * 0.15
    );
  }
  function smoothRamp(v, from, to) {
    const t = Math.max(0, Math.min(1, (v - from) / (to - from)));
    return t * t * (3 - 2 * t);
  }
  function fallTurnAt(x, z, height, simplex) {
    return smoothRamp(
      fallLat(x, z, height, simplex),
      FALL_START_LAT,
      FALL_FULL_LAT
    );
  }
  function fallBareAt(x, z, height, simplex) {
    return smoothRamp(
      fallLat(x, z, height, simplex),
      FALL_BARE_LAT,
      SNOW_START_LAT
    );
  }

  // --- REGION EDGES ---
  // Where the snow, the desert, the main continent's east coast and the
  // alien lands begin wanders in long, lazy curves (about a degree either
  // way, k picking the noise), so no region follows a line of latitude or
  // longitude.
  function regionWobble(x, z, simplex, k) {
    return (
      simplex.noise2D(x * 0.00004 + k * 31, z * 0.00004 - k * 17) * 0.75 +
      simplex.noise2D(x * 0.0001 - k * 13, z * 0.0001 + k * 7) * 0.25
    );
  }
  // The snow line and the desert's edge hold still near spawn's longitudes
  // (so the falls stay clear of the snow), wandering from 2.5 degrees
  // either side of 1 West
  function climateFade(x) {
    const t = Math.max(0, Math.min(1, (Math.abs(x + 5000) - 12500) / 10000));
    return t * t * (3 - 2 * t);
  }
  // How far (degrees) the snow line is pushed south at (x, z)
  function snowWobble(x, z, simplex) {
    return regionWobble(x, z, simplex, 1) * 0.9 * climateFade(x);
  }
  // How far (degrees) the desert is pushed north at (x, z)
  function desertShift(x, z, simplex) {
    return regionWobble(x, z, simplex, 2) * 0.9 * climateFade(x);
  }
  // How far (units) the main continent's east coast (around 0 longitude) is
  // pushed east at latitude z; it holds still in the heartland
  function eastCoastShift(z, simplex) {
    return regionWobble(0, z, simplex, 3) * 6000 * heartlandFade(0, z);
  }
  // Where the western alien land begins: a longitude (units, negative)
  // around 10 West that wanders with latitude
  function westAlienEdge(z, simplex) {
    return -(10 + regionWobble(-50000, z, simplex, 4) * 1.4) * 5000;
  }
  // How alien (x, z) is, 0 to 1: rising over 15000 units past where the
  // eastern land (eastLandLon) or the western alien land begins
  function alienAt(x, z, simplex) {
    const past =
      x > 0
        ? x - eastLandLon(-z / 5000, simplex) * 5000
        : westAlienEdge(z, simplex) - x;
    const t = Math.max(0, Math.min(1, past / 15000));
    return t * t * (3 - 2 * t);
  }

  // The terrain generator computes the first two noise values anyway and
  // passes their sum, plus snowWobble, straight to snowFactorAt; this is for
  // everything else.
  function snowNoiseShift(x, z, simplex) {
    return (
      simplex.noise2D(x * 0.0001, z * 0.0001) * 0.05 +
      simplex.noise2D(x * 0.0005, z * 0.0005) * 0.1 +
      snowWobble(x, z, simplex)
    );
  }

  // --- BIOME ---
  // Returns a biome value in [-1, 1] for a given world (x, z) position.
  // Requires a simplex noise object with a noise2D(x, y) method.
  function getBiome(x, z, simplex) {
    let noise =
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(
          nx * 0.00005 + 1000,
          z * 0.00005 + 1000,
          ny * 0.00005 + 1000
        )
      ) * 0.5;
    const mapScale = 10000;
    let biomeBase = 0;
    // The east coast wanders with latitude (see eastCoastShift); everything
    // east-west below measures from it
    const westX = x;
    x -= eastCoastShift(z, simplex);

    if (x > 0) biomeBase -= Math.min(1, x / mapScale);

    if (z > 0) {
      let mtnInf = Math.min(1, z / mapScale);
      if (x < 0) {
        const westDamp = Math.max(0, Math.min(1, 1 + westX / 5000));
        mtnInf *= westDamp;
      } else if (x > 0) {
        // South-East transition zone starts much further south (Z > 8000)
        const zFade = Math.max(0, Math.min(1, (z - 8000) / 4000)); // Fades in from Z=8000 to Z=12000

        // Montauk Peninsula bulge: peaks at Z=3000, pushes coast out to X=8000
        const montaukDistZ = Math.abs(z - 3000);
        const montaukBulge = Math.max(0, 1 - montaukDistZ / 2500); // 1 at Z=3000, 0 at Z=500 and 5500

        // The land extends to 5,000 normally, stretches to 30,000 in the deep South-East, and bulges to 8,000 for Montauk
        const landExtent = 5000 + zFade * 25000 + montaukBulge * 3000;
        let eastDamp = Math.max(0, Math.min(1, 1 - x / landExtent));

        // Fracture noise only applies in the extended South-East zone
        const xFade = Math.min(1, x / 5000);
        const fractureNoise =
          cylNoise(x, (nx, ny) =>
            simplex.noise3D(nx * 0.00015, z * 0.00015, ny * 0.00015)
          ) *
          0.5 *
          xFade *
          zFade;

        eastDamp = Math.max(0, Math.min(1, eastDamp + fractureNoise));

        mtnInf *= eastDamp;
      }
      biomeBase += mtnInf;
    }

    return Math.max(-1, Math.min(1, biomeBase + noise));
  }

  const MAX_HIGHWAY_HEIGHT = 40 + 400; // Maximum altitude before carving a trench (WATER_LEVEL + 400)

  // --- ELEVATION ---
  // Returns the terrain height (always >= WATER_LEVEL) for a given world (x, z) position.
  // Requires a simplex noise object and a constants object { WATER_LEVEL, MOUNTAIN_LEVEL }.
  // --- AIRPORTS ---
  // A few fixed airfields, rare landmarks like the volcano and the
  // lighthouse (marked on the map). Each is a runway along \`angle\`
  // (radians from +X toward +Z) with the tower and hangar to its +v side.
  // `access` (-1 west, 1 east) gives it a road to the nearest highway
  // (ACCESS_ROADS), on a side where the road leaves the apron away from the
  // runway. Meadow Field's road is the cross-country highway's east end
  // (`crossCountry`); the other eastern airports have no highway to reach.
  const AIRPORTS = [
    {
      name: 'Meadow Field',
      x: 1500,
      z: 2400,
      angle: 0,
      access: -1,
      crossCountry: true,
    },
    {name: 'Mesa Field', x: -4800, z: 16200, angle: Math.PI / 4, access: -1},
    {name: 'Pinewood Field', x: -4000, z: -17200, angle: 0, access: -1},
    {name: 'Lagoon Field', x: 5000, z: 4800, angle: (3 * Math.PI) / 4},
    {name: 'Dune Field', x: 10000, z: 25000, angle: Math.PI / 2},
    {
      name: 'Sagebrush Field',
      x: -25000,
      z: 10000,
      angle: -Math.PI / 4,
      access: 1,
    },
    {name: 'Frost Field', x: -22500, z: -20000, angle: 0, access: -1},
    {name: 'Coral Field', x: 17500, z: 15000, angle: Math.PI / 4},
  ];
  const RUNWAY_LENGTH = 800;
  const RUNWAY_WIDTH = 40;
  // The flat field around the runway (half sizes along and across it)
  const AIRFIELD_HALF_LENGTH = 470;
  const AIRFIELD_HALF_WIDTH = 120;
  const AIRPORT_FALLOFF = 380;
  // Clearance corridors along runway approach and departure headings (#137)
  const CORRIDOR_LENGTH = 3000;
  const CORRIDOR_BASE_WIDTH = 100;
  const CORRIDOR_EXPANSION = 0.08;
  const CORRIDOR_FALLOFF = 160;
  const CORRIDOR_SLOPE = 0.06;

  // How far (x, z) is outside an airport's flat field (0 inside), and its
  // position in the airport's frame: u along the runway, v across it
  function airportLocal(a, x, z) {
    const dx = x - a.x;
    const dz = z - a.z;
    const c = Math.cos(a.angle);
    const sn = Math.sin(a.angle);
    return {u: dx * c + dz * sn, v: -dx * sn + dz * c};
  }
  function airportDistance(a, x, z) {
    if (Math.abs(x - a.x) > 1200 || Math.abs(z - a.z) > 1200) return 1e9;
    const {u, v} = airportLocal(a, x, z);
    const du = Math.max(0, Math.abs(u) - AIRFIELD_HALF_LENGTH);
    const dv = Math.max(0, Math.abs(v) - AIRFIELD_HALF_WIDTH);
    return Math.sqrt(du * du + dv * dv);
  }
  // The airfield's height: the natural ground at its center, kept above the
  // water and below the high hills. Cached per noise, keyed by a sample of
  // it (reseeding changes the same noise object). null while it's being
  // worked out: getElevation calls itself (the highway's centerline), and
  // those calls skip the airports instead of recursing.
  const _airportHeights = new WeakMap();
  function airportFieldHeight(i, simplex, constants, lerp) {
    const signature = simplex.noise2D(0.123, 0.456);
    let cache = _airportHeights.get(simplex);
    if (!cache || cache.signature !== signature) {
      cache = {signature, heights: []};
      _airportHeights.set(simplex, cache);
    }
    const heights = cache.heights;
    if (heights[i] === undefined) {
      heights[i] = null;
      const a = AIRPORTS[i];
      const natural = getElevation(a.x, a.z, simplex, constants, lerp, {
        ignoreAirports: true,
      });
      const water = constants.WATER_LEVEL || 40;
      heights[i] = Math.min(220, Math.max(water + 15, natural));
    }
    return heights[i];
  }
  // Whether (x, z) is on an airfield, plus margin: props stay off it
  function isOnAirport(x, z, margin = 0) {
    for (let i = 0; i < AIRPORTS.length; i++) {
      if (airportDistance(AIRPORTS[i], x, z) <= margin) return true;
    }
    return false;
  }

  // --- LANDFORMS ---
  // How much (x, z) is open plain and how much plateau, each 0 to 1, from
  // one slow field: low values are plains, high ones plateaus (with a
  // steep, wandering edge, the escarpment)
  const PLAINS_FLOOR = 85;
  const PLATEAU_RISE = 170;
  function landformAt(x, z, simplex) {
    const f = cylNoise(x, (nx, ny) =>
      simplex.noise3D(nx * 0.00006 + 311, z * 0.00006 - 207, ny * 0.00006 + 311)
    );
    const edge =
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0008 - 51, z * 0.0008 + 19, ny * 0.0008 - 51)
      ) * 0.04;
    return {
      plains: smoothRamp(-f, 0.18, 0.38),
      plateau: smoothRamp(f + edge, 0.3, 0.315),
    };
  }

  // --- DOMAIN WARPING ---
  // getElevation samples the land at warped coordinates, which makes
  // coastlines and rivers organic. Each returns the offset to add to x or z
  // (both from the unwarped x and z). The fine layers (hills, crags, the
  // mountains' spurs, the coast's islets) take only DETAIL_WARP of it: the
  // full warp stretches them into streaks and fingerprint whorls.
  const DETAIL_WARP = 0.25;
  function domainWarpX(x, z, simplex) {
    return (
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0002, z * 0.0002, ny * 0.0002)
      ) * 1000
    );
  }
  function domainWarpZ(x, z, simplex) {
    return (
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0002, z * 0.0002 + 123.4, ny * 0.0002)
      ) * 1000
    );
  }

  // --- PROCEDURAL TERRAIN TYPE ---
  // What runs along latitude band latIndex (1 lat = 5000 units): a
  // mountain range, a major or minor river, or nothing (buffer)
  function proceduralTerrainType(latIndex, simplex, terrainFrequency = 0.8) {
    if (latIndex === 0) return 'major_river'; // Equator override
    // The first ranges north and south (1 North, 1 South) are always there,
    // so every flight meets mountains early (#76). Later ones vary by seed.
    if (latIndex === 1 || latIndex === -1) return 'mountain';
    // Use a non-zero Y coordinate so we don't sample along an axis (which can be 0)
    // Multiply by 1.5 to stretch the Simplex noise output closer to the [-1.0, 1.0] range
    const tNoise = simplex.noise2D(latIndex * terrainFrequency, 1234.5) * 1.5;
    if (tNoise > 0.4) return 'mountain';
    if (tNoise < -0.4) return 'minor_river';
    return 'buffer';
  }

  // --- RIVER CHANNELS ---
  // How strongly the rivers and their tributaries carve the land at warped
  // (x, z) (origX: unwarped): river and tributary, 0 to 1 (1 in the channel,
  // easing out across the banks). `offset` gives the strongest channel's
  // signed distance across it at any warped point, and `downstream` which
  // way its water runs (see getRiverFlow). Shared by getElevation's carving
  // and the flow.
  function riverChannelAt(x, z, origX, simplex, terrainFrequency = 0.8) {
    const latScale = 5000;
    const currentLat = Math.round(z / latScale);
    const _lerp = (a, b, t) => a + (b - a) * t;
    const getProceduralTerrainType = (latIndex, freq) =>
      proceduralTerrainType(latIndex, simplex, freq);
    let maxRiverFactor = 0;
    let maxTributaryFactor = 0;
    // The strongest river and tributary, for getRiverFlow
    let riverChannel = null;
    let tribChannel = null;
    // Estuaries: rivers widen over the last 6 km before the east coast
    // (1.0 West to 0.2 East), up to 4.5x at the mouth.
    const estuary = Math.min(1, Math.max(0, (origX + 5000) / 6000));
    const estuaryWiden = estuary * estuary * (3 - 2 * estuary);

    // Check adjacent latitudes to find any nearby rivers (since they meander up to 5000 units)
    for (let l = currentLat - 1; l <= currentLat + 1; l++) {
      const type = getProceduralTerrainType(l, terrainFrequency);
      if (type === 'major_river' || type === 'minor_river') {
        const riverCenterZ = exports.getRiverCenterZ
          ? exports.getRiverCenterZ(x, z, simplex, l)
          : l * latScale; // Fallback

        const distToRiver = Math.abs(z - riverCenterZ);

        let riverWidth, riverBankWidth;
        if (type === 'major_river') {
          const widthNoise = cylNoise(x, (nx, ny) =>
            simplex.noise3D(nx * 0.0005, 200, ny * 0.0005)
          );
          const widthVariation = (widthNoise + 1) * 0.5; // Map from [-1, 1] to [0, 1]
          riverWidth = 120 + widthVariation * 180; // Min 120, max 300
          riverBankWidth = 100 + widthVariation * 100;
        } else {
          // Smaller rivers
          const widthNoise = cylNoise(x, (nx, ny) =>
            simplex.noise3D(nx * 0.0008, l * 10.0, ny * 0.0008)
          );
          const widthVariation = (widthNoise + 1) * 0.5;
          riverWidth = 100 + widthVariation * 100; // Min 100, max 200
          riverBankWidth = 60 + widthVariation * 40;
        }
        riverWidth *= 1 + 3.5 * estuaryWiden;
        riverBankWidth *= 1 + 1.5 * estuaryWiden;

        // Tributaries: side streams joining the river from the north or
        // south at irregular spots (up to one per 7 km of river), running
        // 2.5 to 5 km, meandering and narrowing toward their source. Only
        // inland: near the sea they would braid the estuary.
        if (estuary < 0.3) {
          const tribSpacing = 7000;
          const k0 = Math.round(x / tribSpacing);
          const k1 = x > k0 * tribSpacing ? k0 + 1 : k0 - 1;
          for (const k of [k0, k1]) {
            const presence = simplex.noise2D(k * 0.731 + l * 17.3, 911.1);
            if (Math.abs(presence) < 0.15) continue; // some spots have none
            const side = presence > 0 ? 1 : -1;
            const baseX =
              k * tribSpacing +
              simplex.noise2D(k * 0.577 + l * 7.9, 222.2) * 2000;
            const length =
              2500 + (simplex.noise2D(k * 0.419 + l * 3.3, 333.3) + 1) * 1250;
            const along =
              (z - exports.getRiverCenterZ(baseX, z, simplex, l)) * side;
            if (along < 0 || along > length) continue;
            const t = along / length;
            const centerX =
              baseX +
              simplex.noise2D(along * 0.0006 + k * 5.1, l * 9.7 + 444) *
                450 *
                Math.min(1, along / 400);
            const tribWidth = _lerp(riverWidth * 0.45, 18, t);
            const tribBank = _lerp(riverBankWidth * 0.6, 30, t);
            const d = Math.abs(x - centerX);
            let f = 0;
            if (d <= tribWidth) {
              f = 1;
            } else if (d < tribWidth + tribBank) {
              const u = (d - tribWidth) / tribBank;
              f = 1 - u * u * (3 - 2 * u);
            }
            f *= Math.min(1, (1 - t) / 0.15); // taper out at the source
            if (f > maxTributaryFactor) {
              maxTributaryFactor = f;
              tribChannel = {l, k, side, baseX};
            }
          }
        }

        let riverFactor = 0;
        if (distToRiver <= riverWidth) {
          riverFactor = 1.0;
        } else if (distToRiver < riverWidth + riverBankWidth) {
          // Smooth transition zone
          const t = (distToRiver - riverWidth) / riverBankWidth;
          // Smoothstep curve for natural banks
          riverFactor = 1.0 - t * t * (3 - 2 * t);
        }

        if (riverFactor > maxRiverFactor) {
          maxRiverFactor = riverFactor;
          riverChannel = {l};
        }
      }
    }

    return {
      river: maxRiverFactor,
      tributary: maxTributaryFactor,
      riverChannel,
      tribChannel,
      estuary: estuaryWiden,
    };
  }

  // A channel's signed distance across it at warped (x, z): north/south of a
  // river's centerline, east/west of a tributary's
  function channelOffset(channel, x, z, simplex) {
    const {l} = channel;
    if (channel.k === undefined) {
      return z - getRiverCenterZ(x, z, simplex, l);
    }
    const {k, side, baseX} = channel;
    const along = (z - getRiverCenterZ(baseX, z, simplex, l)) * side;
    const centerX =
      baseX +
      simplex.noise2D(along * 0.0006 + k * 5.1, l * 9.7 + 444) *
        450 *
        Math.min(1, along / 400);
    return x - centerX;
  }

  // --- RIVER FLOW ---
  // Which way the water runs at (x, z), scaled by how much it's in a
  // channel: [x, z] up to unit length, or null off the rivers. Rivers run
  // east to the sea (slowing through the estuaries), tributaries toward the
  // river they join. The direction follows the channel through the domain
  // warp: along the lines of equal distance across it.
  function getRiverFlow(x, z, simplex) {
    const warped = (px, pz) => [
      px + domainWarpX(px, pz, simplex),
      pz + domainWarpZ(px, pz, simplex),
    ];
    const [wx, wz] = warped(x, z);
    const c = riverChannelAt(wx, wz, x, simplex);
    const trib = c.tributary > c.river;
    let strength = trib ? c.tributary : c.river * (1 - 0.6 * c.estuary);
    if (strength <= 0) return null;
    const channel = trib ? c.tribChannel : c.riverChannel;
    const offsetAt = (px, pz) =>
      channelOffset(channel, ...warped(px, pz), simplex);
    const e = 2;
    const o = offsetAt(x, z);
    const gx = (offsetAt(x + e, z) - o) / e;
    const gz = (offsetAt(x, z + e) - o) / e;
    const len = Math.hypot(gx, gz);
    if (len < 1e-6) return null;
    let fx = -gz / len;
    let fz = gx / len;
    // Rivers run east; tributaries back toward their river
    if (trib ? fz * channel.side > 0 : fx < 0) {
      fx = -fx;
      fz = -fz;
    }
    return [fx * strength, fz * strength];
  }

  // --- COAST DETAIL ---
  // A rugged, intricate coast: coves and spits (domain warping), broad bights
  // and promontories, fjords, island chains, barrier islands and lagoons.
  // Returns the ground height at (x, z) across a coast, where t runs from 0
  // (the land's edge of the coast) to 1 (open sea). `o` holds noise offsets,
  // so each coast differs, and macroAmp how far the broad shape moves the
  // shore. Every coast of the continent's outline uses it.
  const COAST_OUTLINE = {
    warpX: 88,
    warpZ: -44,
    macro: 0,
    fjord: 200,
    region: 555,
    island: 111,
    barrier: 333,
    rough: 0,
  };
  function coastDetail(x, z, t, o, simplex, waterLevel, macroAmp = 80) {
    // Intense domain warping for micro edges (coves, spits, tombolos)
    const dwScale = 800;
    const qx =
      x +
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(
          nx * 0.0006 + o.warpX,
          z * 0.0006 + o.warpX,
          ny * 0.0006 + o.warpX
        )
      ) *
        dwScale;
    const qz =
      z +
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(
          nx * 0.0006 + o.warpZ,
          z * 0.0006 + o.warpZ,
          ny * 0.0006 + o.warpZ
        )
      ) *
        dwScale;
    // The islets and roughness take only part of the warp (DETAIL_WARP)
    const fx = x + (qx - x) * DETAIL_WARP;
    const fz = z + (qz - z) * DETAIL_WARP;

    // How broken this stretch of coast is: slow noise turns the fjords and
    // island chains down to smooth shores in places (0.15 to 1)
    const r = Math.max(
      0,
      Math.min(
        1,
        (simplex.noise2D(x * 0.00005 + 70, z * 0.00005 - 40) + 0.2) / 0.6
      )
    );
    const rugged = 0.15 + 0.85 * r * r * (3 - 2 * r);

    // Macro shape (bights and promontories)
    const macroNoise = cylNoise(qx, (nx, ny) =>
      simplex.noise3D(
        nx * 0.0001 + o.macro,
        qz * 0.0001 + o.macro,
        ny * 0.0001 + o.macro
      )
    );

    // Base elevation drops off into the deep ocean
    let h = 120 - t * 160 + macroNoise * macroAmp;

    // Fjords (rias): deep, narrow cuts into the land
    const fjordNoise =
      1.0 -
      Math.abs(
        cylNoise(qx, (nx, ny) =>
          simplex.noise3D(
            nx * 0.0003 + o.fjord,
            qz * 0.0003 + o.fjord,
            ny * 0.0003 + o.fjord
          )
        )
      );
    if (fjordNoise > 0.7) {
      const carveT = (fjordNoise - 0.7) / 0.3;
      h -= Math.pow(carveT, 2.0) * 200 * rugged; // Deep steep trenches
    }

    // Archipelagos: island clusters breaking off from the land
    const islandRegion = cylNoise(x, (nx, ny) =>
      simplex.noise3D(
        nx * 0.0002 + o.region,
        z * 0.0002 + o.region,
        ny * 0.0002 + o.region
      )
    );
    if (islandRegion > 0.3) {
      const islandNoise = cylNoise(fx, (nx, ny) =>
        simplex.noise3D(
          nx * 0.0015 + o.island,
          fz * 0.0015 + o.island,
          ny * 0.0015 + o.island
        )
      );
      if (islandNoise > 0.3) {
        h += Math.pow((islandNoise - 0.3) / 0.7, 1.5) * 300 * rugged;
      }
    }

    // Transitional geometries: barrier islands and lagoons / tidal flats
    const distToSeaLevel = Math.abs(h - waterLevel);
    if (distToSeaLevel < 15) {
      const flatT = 1.0 - distToSeaLevel / 15;
      const flatSmooth = flatT * flatT * (3 - 2 * flatT);
      h += (waterLevel - 2 - h) * flatSmooth * 0.6;

      const barrierNoise =
        1.0 -
        Math.abs(
          cylNoise(qx, (nx, ny) =>
            simplex.noise3D(
              nx * 0.001 + o.barrier,
              qz * 0.001 + o.barrier,
              ny * 0.001 + o.barrier
            )
          )
        );
      if (barrierNoise > 0.85) {
        h += Math.pow((barrierNoise - 0.85) / 0.15, 2.0) * 12 * flatSmooth;
      }
    }

    // Surface roughness
    if (h > waterLevel - 5) {
      h +=
        cylNoise(fx, (nx, ny) =>
          simplex.noise3D(
            nx * 0.004 + o.rough,
            fz * 0.004 + o.rough,
            ny * 0.004 + o.rough
          )
        ) * 30;
    }
    return h;
  }

  // --- THE CONTINENT'S OUTLINE ---
  // The land ends in sea on every side. Each outline is a few overlapping,
  // tilted ellipses, [lon, lat, lon radius, lat radius, degrees turned
  // counter-clockwise] in degrees: `main` for the main continent, `east` for
  // the eastern land. Every outline also keeps the island sea (ISLAND_SEA):
  // coasts only cut into land, never build it, so its islands survive. The
  // world seed picks one (or ?continent=<name>).
  const CONTINENTS = [
    {
      // The body tilts from north-west to south-east, with a long peninsula
      // running south-west and a cape in the north.
      name: 'leaning',
      main: [
        [-6, 0, 10.5, 4.6, -14],
        [-14.5, -6.5, 5.5, 1.7, 55],
        [-2.5, 4.8, 3.2, 1.4, 70],
      ],
      east: [[15, 0, 4.6, 7.5, 18]],
    },
    {
      // Wide in the north, narrowing south to a point (like Africa or South
      // America).
      name: 'taper',
      main: [
        [-7.5, 1.5, 10.5, 4.2, 4],
        [-6.5, -3.5, 6, 3.6, -18],
        [-5, -7.5, 3, 3.2, -25],
      ],
      east: [[14.5, 1, 4, 6.5, -15]],
    },
    {
      // A western arm curves south and hooks round toward the east, sheltering
      // a bay.
      name: 'crescent',
      main: [
        [-5.5, 0.5, 9, 4.2, 3],
        [-15, -2.5, 3.5, 2.2, 65],
        [-13.5, -7.5, 3.4, 1.6, 25],
        [-8.5, -9.8, 3.2, 1.4, -5],
      ],
      east: [[15, -1, 4.5, 6, 0]],
    },
    {
      // Two big lobes on a diagonal, a high north-west and a low south-east,
      // joined at the waist.
      name: 'lobes',
      main: [
        [-13, 2.5, 6.5, 4.2, 28],
        [-3.5, -2.5, 7.5, 4.4, 28],
        [-7.5, 0, 4, 3.6, 0],
      ],
      east: [[15.5, -2, 5, 5.5, -30]],
    },
    {
      // A long leg runs south-east from the west, ending in a toe and a heel,
      // with a deep gulf inside it.
      name: 'boot',
      main: [
        [-7, 1, 9.5, 4.2, 0],
        [-11, -6, 6.5, 1.9, -48],
        [-6.2, -10.6, 2.3, 1.1, 20],
        [-9.5, -10, 1.6, 1.4, 0],
      ],
      east: [[15, 0, 4.4, 7, 10]],
    },
  ];
  const ISLAND_SEA = [5, -1, 7.5, 7, 0];
  // Each outline's ellipses, ready to measure: centre, radii and rotation
  for (const c of CONTINENTS) {
    c.ellipses = [...c.main, ...c.east, ISLAND_SEA].map(
      ([lon, lat, rLon, rLat, turn]) => ({
        lon,
        lat,
        rLon,
        rLat,
        cos: Math.cos((turn * Math.PI) / 180),
        sin: Math.sin((turn * Math.PI) / 180),
      })
    );
  }
  // The eastern land rises out of the island sea over this many units
  const EAST_LAND_RISE = 6000;

  // --- BASALT HONEYCOMB (the eastern alien land) ---
  // How much land the eastern land has at (x, z), from swirling,
  // domain-warped noise: above 0.05 is land (the higher, the taller the
  // columns), below is sea.
  function eastLandBase(x, z, simplex) {
    const eastEdge = eastLandLon(-z / 5000, simplex) * 5000;
    const t = Math.max(0, Math.min(1, (x - eastEdge) / EAST_LAND_RISE));
    const warpStrength = Math.max(0.3, t * t * (3 - 2 * t)) * 3000;
    const warp = (ox, oz, f, wx = 0, wz = 0) =>
      cylNoise(x + wx, (nx, ny) =>
        simplex.noise3D(nx * f + ox, (z + wz) * f + oz, ny * f + ox)
      );
    const wx1 = warp(0, 77.3, 0.0002) * warpStrength;
    const wz1 = warp(33.1, 0, 0.0002) * warpStrength;
    const wx2 = warp(0, 11.5, 0.00015, wx1, wz1) * warpStrength * 0.5;
    const wz2 = warp(55.2, 0, 0.00015, wx1, wz1) * warpStrength * 0.5;
    const xw = x + wx1 + wx2;
    const zw = z + wz1 + wz2;
    return cylNoise(xw, (nx, ny) =>
      simplex.noise3D(nx * 0.0003, zw * 0.0003, ny * 0.0003)
    );
  }
  // Columns sit on a hexagonal grid this far apart, nudged off it a little
  const BASALT_CELL = 1000;
  // How far an organ pipe rises above its ledge, at most (deep in the land)
  const BASALT_SPIRE = 2000;
  // An organ pipe stands this far in from its column's edge, on a ledge
  const SPIRE_INSET = 220;
  const BASALT_ROW = (BASALT_CELL * Math.sqrt(3)) / 2;
  // A hash of a column (0 to 1), different for each world seed (salt)
  function basaltHash(col, row, salt) {
    let h =
      Math.imul(col, 374761393) ^
      Math.imul(row, 668265263) ^
      Math.imul(salt, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  // Each column's land base and top height, per noise instance (world seed)
  const basaltCache = new WeakMap();
  function basaltColumn(col, row, salt, simplex) {
    let cache = basaltCache.get(simplex);
    if (!cache || cache.size > 20000) {
      cache = new Map();
      basaltCache.set(simplex, cache);
    }
    const key = col * 100003 + row;
    let cell = cache.get(key);
    if (!cell) {
      const jx = (basaltHash(col, row, salt) - 0.5) * BASALT_CELL * 0.3;
      const jz = (basaltHash(row, col, salt + 1) - 0.5) * BASALT_CELL * 0.3;
      const cx = (col + (row & 1) * 0.5) * BASALT_CELL + jx;
      const cz = row * BASALT_ROW + jz;
      const base = eastLandBase(cx, cz, simplex);
      const eastEdge = eastLandLon(-cz / 5000, simplex) * 5000;
      const rise = Math.min(1, Math.max(0, (cx - eastEdge) / EAST_LAND_RISE));
      // Land columns: taller toward the middle of the land, and each its
      // own height, so neighbors step up and down; tops lean a little
      let top = 0;
      if (base > 0.05) {
        const inland = Math.min(1, (base - 0.05) * 4);
        const tall = 220 + 340 * rise;
        top =
          30 +
          (0.25 + 0.75 * inland) *
            (0.2 + 0.8 * basaltHash(col + 7, row - 3, salt)) *
            tall;
      }
      // Organ pipes: in scattered clusters (a slow noise field), some land
      // columns shoot up far above the rest from a ledge at their usual
      // height, so there are towers to fly between and see from afar
      let spire = 0;
      if (top > 0) {
        const clump = simplex.noise2D(cx * 0.00015 + 91.7, cz * 0.00015 - 23.4);
        if (basaltHash(col - 13, row + 17, salt) < (clump - 0.3) * 1.5) {
          spire =
            (0.35 + 0.65 * basaltHash(col + 19, row - 7, salt)) *
            BASALT_SPIRE *
            rise;
        }
      }
      cell = {
        cx,
        cz,
        top,
        spire,
        // Picks the colour of its top and whether mushrooms crowd it (see
        // basaltColumnAt)
        tint: basaltHash(col + 23, row + 29, salt),
        tiltX: (basaltHash(col - 5, row + 9, salt) - 0.5) * 0.12,
        tiltZ: (basaltHash(col + 11, row + 2, salt) - 0.5) * 0.12,
      };
      cache.set(key, cell);
    }
    return cell;
  }
  // The honeycomb at (x, z): the column it's on (h1 is its top there, 0 for
  // sea) and the ground height h, which drops into a
  // ravine near the column's edge. A ravine's floor is set by the lower of
  // the two columns either side, so low ground floods into channels and the
  // coast falls straight into the sea.
  const RAVINE_FLOOR = 35;
  const RAVINE_TOP = 90;
  function basaltAt(x, z, simplex, waterLevel) {
    const salt = Math.floor((simplex.noise2D(12.34, 56.78) + 1) * 1e6);
    const row0 = Math.round(z / BASALT_ROW);
    let c1 = null;
    let c2 = null;
    let d1 = Infinity;
    let d2 = Infinity;
    for (let row = row0 - 1; row <= row0 + 1; row++) {
      const col0 = Math.round(x / BASALT_CELL - (row & 1) * 0.5);
      for (let col = col0 - 1; col <= col0 + 1; col++) {
        const c = basaltColumn(col, row, salt, simplex);
        const d = (x - c.cx) ** 2 + (z - c.cz) ** 2;
        if (d < d1) {
          d2 = d1;
          c2 = c1;
          d1 = d;
          c1 = c;
        } else if (d < d2) {
          d2 = d;
          c2 = c;
        }
      }
    }
    // Distance to the edge shared with the next nearest column
    const gap = Math.hypot(c2.cx - c1.cx, c2.cz - c1.cz);
    const edge = (d2 - d1) / (2 * gap);
    const tilt = (c) => (x - c.cx) * c.tiltX + (z - c.cz) * c.tiltZ;
    const h1 = c1.top > 0 ? waterLevel + c1.top + tilt(c1) : 0;
    const h2 = c2.top > 0 ? waterLevel + c2.top + tilt(c2) : 0;
    const floor = Math.max(waterLevel - 10, Math.min(h1, h2) * 0.45);
    const t = Math.max(
      0,
      Math.min(1, (edge - RAVINE_FLOOR) / (RAVINE_TOP - RAVINE_FLOOR))
    );
    let h = h1 > 0 ? floor + (h1 - floor) * t * t * (3 - 2 * t) : 0;
    if (c1.spire > 0) {
      const s = Math.max(0, Math.min(1, (edge - SPIRE_INSET) / 50));
      h += c1.spire * s * s * (3 - 2 * s);
    }
    return {h, h1};
  }
  // The column nearest (x, z) in the eastern land's honeycomb, for its top's
  // colour and props: {top (0 for sea), spire, tint (0 to 1)}
  function basaltColumnAt(x, z, simplex) {
    const salt = Math.floor((simplex.noise2D(12.34, 56.78) + 1) * 1e6);
    const row0 = Math.round(z / BASALT_ROW);
    let best = null;
    let bestD = Infinity;
    for (let row = row0 - 1; row <= row0 + 1; row++) {
      const col0 = Math.round(x / BASALT_CELL - (row & 1) * 0.5);
      for (let col = col0 - 1; col <= col0 + 1; col++) {
        const c = basaltColumn(col, row, salt, simplex);
        const d = (x - c.cx) ** 2 + (z - c.cz) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    return best;
  }
  let continent = CONTINENTS[0];
  // ?continent=<name> forces an outline; otherwise the world seed picks one.
  // Workers can't see the URL, so it travels with each chunk job.
  exports.CONTINENT = getParam('continent', null);
  let continentSeed = null;
  let continentForced = null;
  // Sets `continent` for the current seed (and forced name), when they change
  function pickContinent() {
    if (
      continentSeed === exports.WORLD_SEED &&
      continentForced === exports.CONTINENT
    ) {
      return;
    }
    continentSeed = exports.WORLD_SEED;
    continentForced = exports.CONTINENT;
    const forced = CONTINENTS.find((c) => c.name === continentForced);
    const pick = Math.floor(
      mulberry32(continentSeed ^ 0x51ed27)() * CONTINENTS.length
    );
    continent = forced || CONTINENTS[pick];
  }
  // How much the nearest coast to the last point continentPast measured
  // faces south (the warm south coast), 0 to 1
  let coastSouthness = 0;
  // How far past the coast (x, z) lies, seaward, in units (negative inland):
  // a smooth union of the outline's ellipses (rounded where they meet),
  // warped at the 1-3 degree scale so no edge stays a clean curve, and
  // roughened so the shore isn't smooth either.
  const CONTINENT_BLEND = 1.2; // degrees
  const _ellipseDist = new Float64Array(16);
  function continentPast(x, z, simplex) {
    const lon =
      x / 5000 +
      simplex.noise2D(x * 0.000044 + 300, -z * 0.000044) * 1.1 +
      simplex.noise2D(x * 0.00012 + 310, -z * 0.00012) * 0.45;
    const lat =
      -z / 5000 +
      simplex.noise2D(x * 0.000044 - 300, -z * 0.000044 + 9) * 1.1 +
      simplex.noise2D(x * 0.00012 - 310, -z * 0.00012 + 9) * 0.45;
    // Distance outside each ellipse (degrees, roughly), then a smooth min
    const ellipses = continent.ellipses;
    let m = Infinity;
    for (let i = 0; i < ellipses.length; i++) {
      const e = ellipses[i];
      const dx = lon - e.lon;
      const dy = lat - e.lat;
      const u = (dx * e.cos + dy * e.sin) / e.rLon;
      const v = (-dx * e.sin + dy * e.cos) / e.rLat;
      const d = (Math.hypot(u, v) - 1) * Math.min(e.rLon, e.rLat);
      _ellipseDist[i] = d;
      if (d < m) m = d;
    }
    let sum = 0;
    for (let i = 0; i < ellipses.length; i++) {
      sum += Math.exp(-(_ellipseDist[i] - m) / CONTINENT_BLEND);
    }
    const past = (m - CONTINENT_BLEND * Math.log(sum)) * 5000;
    coastSouthness = Math.max(0, Math.min(1, (-lat - 2.5) / 2.5));
    return (
      past +
      simplex.noise2D(x * 0.00035, z * 0.00035) * 1400 +
      simplex.noise2D(x * 0.0012, z * 0.0012) * 450
    );
  }
  // Where the eastern land rises out of the island sea: a longitude
  // (degrees) around 10 East that wanders with latitude, with a cape at 1.5
  // North and a bay at 4.5 South
  const bump = (v, centre, width) => Math.exp(-(((v - centre) / width) ** 2));
  function eastLandLon(lat, simplex) {
    return (
      10.3 -
      bump(lat, 1.5, 1.8) * 1.6 +
      bump(lat, -4.5, 1.5) * 1.4 +
      (simplex.noise2D(lat * 0.22 + 250, 65.5) * 0.7 +
        simplex.noise2D(lat * 0.7 + 350, 18.5) * 0.3) *
        0.8
    );
  }
  // The coast (coastDetail) spans this many units across the outline,
  // centred on it, and blends in from the land over COAST_BLEND more
  const COAST_BAND = 10000;
  const COAST_BLEND = 2500;
  // The heartland around spawn, the falls, the volcano and the nearest
  // airports: no coast touches it, whatever the outline, within
  // HEARTLAND_INNER units of (1 West, 0), and coasts fade in out to
  // HEARTLAND_OUTER
  const HEARTLAND_X = -5000;
  const HEARTLAND_INNER = 12500;
  const HEARTLAND_OUTER = 20000;
  // How much coasts may shape (x, z), 0 in the heartland to 1 beyond it
  function heartlandFade(x, z) {
    const d = Math.hypot(x - HEARTLAND_X, z);
    const t = Math.max(
      0,
      Math.min(1, (d - HEARTLAND_INNER) / (HEARTLAND_OUTER - HEARTLAND_INNER))
    );
    return t * t * (3 - 2 * t);
  }
  // How far past the coast (x, z) lies, as continentPast, but -Infinity in
  // the heartland, which no coast touches, to skip the work there
  function continentPastFar(x, z, simplex) {
    if (Math.hypot(x - HEARTLAND_X, z) < HEARTLAND_INNER) {
      coastSouthness = 0;
      return -Infinity;
    }
    return continentPast(x, z, simplex);
  }
  // The warm south coast: where it drowns land, the sea floor is a shallow
  // sandy shelf (turquoise water) instead of deep, out to about this far past
  // the outline, with reefs just under the surface and low sand cays
  const SOUTH_SHELF = 5000;
  function southShelfFloor(x, z, simplex, waterLevel) {
    // Sandy floor 2 to 4.5 units down, rippled
    let h =
      waterLevel - 3.2 + simplex.noise2D(x * 0.0007 + 31, z * 0.0007) * 1.3;
    // Reefs: ridged lines just under the surface
    const reef = 1 - Math.abs(simplex.noise2D(x * 0.0011 - 7, z * 0.0011 + 5));
    if (reef > 0.8) h = Math.max(h, waterLevel - 1.6 + (reef - 0.8) * 4);
    // Sand cays, a few units high
    const cay = simplex.noise2D(x * 0.0008 + 91, z * 0.0008 - 17);
    if (cay > 0.72) h = Math.max(h, waterLevel - 1 + (cay - 0.72) * 30);
    return h;
  }

  // Whether the northern sea at (x, z), coastPast units out from the coast,
  // is frozen. Open water runs along the shore in a lane that wanders from
  // nothing (ice frozen to the shore, in among the islands) to about 9000
  // units (open bays), with a ragged edge. Past it lies a band of floes that
  // grow larger and closer together over ICE_FLOE_BAND units, until they
  // join into solid pack.
  const ICE_FLOE_BAND = 12500;
  function seaIceAt(x, z, coastPast, simplex) {
    const lane = Math.max(
      0,
      Math.min(
        9000,
        3500 + simplex.noise2D(x * 0.00006 + 17, z * 0.00006 - 5) * 7000
      )
    );
    const ragged = simplex.noise2D(x * 0.0007 + 3, z * 0.0007 + 9) * 1200;
    const into = (coastPast - lane - ragged) / ICE_FLOE_BAND;
    if (into <= 0) return false;
    if (into >= 1) return true;
    const floe =
      simplex.noise2D(x * 0.0011 + 41, z * 0.0011 - 23) * 0.6 +
      simplex.noise2D(x * 0.003 - 7, z * 0.003 + 11) * 0.4;
    return floe > 0.9 - into * 1.9;
  }

  // --- THE CANYON (landmark, south-east of spawn) ---
  // A Grand Canyon: a deep, meandering gorge cut into a raised desert
  // plateau, its walls stepped in tiers of cliffs and benches, buttes
  // standing inside it and side canyons scalloping its rims, with a river at
  // the bottom that opens into the island sea. It runs south from about 1.2
  // East, 2.3 South and turns east to its mouth near 2.8 East, 5.4 South:
  // land in every continent outline, clear of the airports and highways.
  // Points are [lon, lat] in degrees.
  const CANYON_PATH = [
    [1.0, -2.3],
    [1.4, -3.4],
    [1.0, -4.4],
    [1.6, -5.1],
    [2.6, -5.4],
    // The river runs on out to open water, past the plateau's end
    [3.8, -5.6],
  ];
  // Where along the path the plateau ends (the rest is the river's mouth)
  const CANYON_PLATEAU_END = 4;
  const CANYON_PLATEAU = 300; // Rim height
  const CANYON_TIERS = 5; // Cliff-and-bench steps from river to rim
  const _canyonPts = CANYON_PATH.map(([lon, lat]) => [lon * 5000, -lat * 5000]);
  const _canyonLen = [0];
  for (let i = 1; i < _canyonPts.length; i++) {
    _canyonLen.push(
      _canyonLen[i - 1] +
        Math.hypot(
          _canyonPts[i][0] - _canyonPts[i - 1][0],
          _canyonPts[i][1] - _canyonPts[i - 1][1]
        )
    );
  }
  const CANYON_LENGTH = _canyonLen[CANYON_PLATEAU_END];
  const CANYON_RIVER_END = _canyonLen[_canyonLen.length - 1];
  // Its bounding box, padded by the plateau's reach, to skip the work
  // everywhere else
  const CANYON_REACH = 6000;
  const _canyonBox = [
    Math.min(..._canyonPts.map((p) => p[0])) - CANYON_REACH,
    Math.max(..._canyonPts.map((p) => p[0])) + CANYON_REACH,
    Math.min(..._canyonPts.map((p) => p[1])) - CANYON_REACH,
    Math.max(..._canyonPts.map((p) => p[1])) + CANYON_REACH,
  ];
  // How strongly (x, z) is part of the canyon's landform, 0 to 1 (for its
  // rock colours), and its ground height there. Returns null outside it.
  const _canyonOut = {weight: 0, height: 0};
  function canyonAt(x, z, simplex, waterLevel) {
    if (
      x < _canyonBox[0] ||
      x > _canyonBox[1] ||
      z < _canyonBox[2] ||
      z > _canyonBox[3]
    ) {
      return null;
    }
    // Meanders: the course bends back and forth around the path
    const qx = x + simplex.noise2D(x * 0.00035 + 61, z * 0.00035) * 900;
    const qz = z + simplex.noise2D(x * 0.00035 - 61, z * 0.00035 + 4) * 900;
    // Nearest point on the path: distance across, and how far along
    let d = Infinity;
    let along = 0;
    for (let i = 1; i < _canyonPts.length; i++) {
      const [ax, az] = _canyonPts[i - 1];
      const [bx, bz] = _canyonPts[i];
      const sx = bx - ax;
      const sz = bz - az;
      const len2 = sx * sx + sz * sz;
      const t = Math.max(
        0,
        Math.min(1, ((qx - ax) * sx + (qz - az) * sz) / len2)
      );
      const dist = Math.hypot(qx - ax - sx * t, qz - az - sz * t);
      if (dist < d) {
        d = dist;
        along = _canyonLen[i - 1] + t * Math.sqrt(len2);
      }
    }
    // Half width at the rim, scalloped by side canyons
    const halfWidth =
      1500 +
      simplex.noise2D(along * 0.0005 + 13, 2.5) * 450 +
      Math.abs(simplex.noise2D(x * 0.0011 - 33, z * 0.0011 + 8)) * 650;
    // The plateau: solid around the canyon, then easing back into the
    // desert over what land is already there (landWeight), so it doesn't
    // fill in the coast's inlets and islands
    const plateauReach = halfWidth + 1200;
    const pw = Math.max(0, Math.min(1, 1 - (d - plateauReach) / 2000));
    // ... and lowering toward the mouth, where it meets the sea
    const mouth = Math.max(0, Math.min(1, (CANYON_LENGTH - along) / 5000));
    const core = d < plateauReach ? 1 : 0;
    const weight = pw * pw * (3 - 2 * pw) * mouth;
    // Past the plateau's end only the river's channel remains
    const channel = Math.max(0, 1 - d / 320);
    if (weight <= 0 && channel <= 0) return null;
    const rim =
      waterLevel +
      (CANYON_PLATEAU - waterLevel) * (0.35 + 0.65 * mouth) +
      simplex.noise2D(x * 0.0004 + 9, z * 0.0004 - 9) * 25;
    // The gorge, shallow at its head and full depth further down
    const head = Math.max(0, Math.min(1, along / 4000));
    let h = rim;
    // How much (x, z) is inside the gorge (for its rock colours), easing out
    // just past the rim
    const gorgeIn =
      Math.max(0, Math.min(1, (halfWidth + 150 - d) / 300)) * head;
    if (d < halfWidth) {
      const river = waterLevel - 4;
      // Inner gorge: the river, then a narrow floor
      const inner = 260;
      let gorge;
      if (d < inner) {
        const f = d / inner;
        gorge = river + (waterLevel + 14 - river) * f * f;
      } else {
        // Tiers of cliffs and benches up to the rim; noise wobbles the tier
        // lines so the cliffs aren't neat contours
        const u = Math.max(
          0,
          Math.min(
            1,
            (d - inner) / (halfWidth - inner) +
              simplex.noise2D(x * 0.0018 + 5, z * 0.0018 - 5) * 0.06
          )
        );
        const tier = Math.min(CANYON_TIERS - 1, Math.floor(u * CANYON_TIERS));
        const f = u * CANYON_TIERS - tier;
        const cliff = Math.min(1, f / 0.35);
        const step = (tier + cliff * cliff * (3 - 2 * cliff)) / CANYON_TIERS;
        gorge = waterLevel + 14 + (rim - waterLevel - 14) * step;
        // Buttes: flat-topped towers left standing inside the canyon
        const butte = simplex.noise2D(x * 0.0013 + 77, z * 0.0013 - 31);
        if (butte > 0.55 && d > inner + 200) {
          const top = rim - 30 - (1 - u) * 60;
          const b = Math.min(1, (butte - 0.55) / 0.08);
          gorge = Math.max(gorge, gorge + (top - gorge) * b);
        }
      }
      h = rim + (gorge - rim) * head;
    }
    // The river's channel, down to the sea past the plateau's end
    if (along > CANYON_LENGTH - 2500 && along < CANYON_RIVER_END) {
      const ch = waterLevel - 4 + (d / 320) ** 2 * 20;
      if (weight <= 0) {
        h = ch;
      } else {
        h = Math.min(h, ch);
      }
    }
    _canyonOut.weight = Math.max(
      weight,
      channel * (along > CANYON_LENGTH - 2500 ? 1 : 0)
    );
    _canyonOut.core = core;
    _canyonOut.gorge = gorgeIn * mouth;
    _canyonOut.height = h;
    return _canyonOut;
  }
  // How much (x, z) is inside the canyon's gorge, 0 to 1 (its rock colours)
  function canyonRockAt(x, z, simplex) {
    const c = canyonAt(x, z, simplex, 40);
    return c ? c.gorge : 0;
  }
  // The height of each tier of the gorge's walls, river to rim
  const CANYON_TIER_HEIGHT = (CANYON_PLATEAU - 40 - 14) / CANYON_TIERS;

  // --- THE FALLS (landmark, north of spawn) ---
  // A table mountain standing in a lake, its sheer walls about 380 units
  // tall. A stream runs south down a winding valley across the top, from a
  // pond in a hollow, and falls from the back of a round bay cut into the
  // south wall (facing spawn) into the lake, with room to fly between the
  // falling water and the rock. terrain-gen.js draws the fall, stream and pond at these points.
  // fallsAt returns [height, weight] for a point in unwarped world
  // coordinates; weight 0 leaves the terrain as it was.
  const FALLS_X = 0;
  const FALLS_Z = -4750;
  // The plane starts at spawn turned this far (radians) north-west, so the
  // Falls pass about 1200 units off the right wing instead of dead ahead
  // (unless the URL sets a position; heading still sets the turn)
  const SPAWN_YAW = (15 * Math.PI) / 180;
  function spawnYaw() {
    const placed = [parsedLat, parsedLon, START_X, START_Z].some(
      (v) => v !== null && v !== undefined
    );
    return placed ? 0 : SPAWN_YAW;
  }
  const FALLS_RADIUS = 420; // to the top of the walls
  const FALLS_LIP = 420; // height of the valley floor where it falls off
  const FALLS_BAY = 200; // the bay's radius
  const FALLS_BAY_DEPTH = 170; // how far it cuts into the wall
  const FALLS_LIP_Z = FALLS_Z + FALLS_RADIUS - FALLS_BAY_DEPTH;
  const FALLS_POND = 260; // how far north of the lip the pond is
  const FALLS_POND_RADIUS = 60;
  // How far east of the lip the valley floor is, s units north of the lip:
  // an S-bend, back in line at the lip and at the pond, and running straight
  // out to the lip
  function fallsValleyX(s) {
    const bend = Math.sin((Math.PI * Math.min(s, FALLS_POND)) / 130);
    return 40 * bend * Math.min(1, s / 60);
  }
  // The crags on the top: rock outcrops standing up to about 40 units out
  // of the grass, kept clear of the stream's valley and the pond. Sets
  // _fallsTop (see fallsSiteAt).
  const _fallsTop = {crag: 0, valley: 0};
  const FALLS_CRAG = 42; // a crag's height
  function fallsTopShape(x, z, simplex) {
    const dx = x - FALLS_X;
    const s = FALLS_LIP_Z - z; // distance north of the lip
    const across = dx - fallsValleyX(s);
    // The top: the valley floor climbs gently north from the lip, levelling
    // off around the pond, and the ground rises gently away from it on
    // either side
    let top = FALLS_LIP + 0.1 * Math.min(s, 180);
    top += 0.01 * Math.min(160, Math.max(0, s - 180));
    top += 0.1 * Math.max(0, s - 340) + 0.04 * Math.abs(across);
    // Low rolls away from the valley
    const valley = Math.exp(-(across * across) / (2 * 90 * 90));
    top +=
      10 *
      (simplex.noise2D(x * 0.006 + 13, z * 0.006 + 13) * 0.5 + 0.5) *
      (1 - valley);
    // The pond's hollow
    const fromPond = Math.hypot(across, s - FALLS_POND) / FALLS_POND_RADIUS;
    if (fromPond < 1) top -= 4 * (1 - fromPond * fromPond);
    // Crags: steep-sided knobs where the noise is high, taller where a
    // second, slower noise says so
    const clear =
      smoothRamp(Math.abs(across), 80, 140) * smoothRamp(fromPond, 1.5, 2.5);
    const knob = simplex.noise2D(x * 0.0055 + 211, z * 0.0055 - 87);
    const crag =
      smoothRamp(knob, 0.15, 0.4) *
      clear *
      (0.6 + 0.4 * simplex.noise2D(x * 0.002 - 5, z * 0.002 + 9));
    _fallsTop.crag = crag;
    _fallsTop.valley = valley;
    return top + FALLS_CRAG * crag;
  }
  // How far out from the mountain's walls (x, z) is (negative on the top),
  // around the outside and into the bay, and how much of a shelf the wall
  // has there (0 to 1, see fallsAt)
  let _fallsShelf = 0;
  function fallsOut(x, z, simplex) {
    const dx = x - FALLS_X;
    const dz = z - FALLS_Z;
    const dist = Math.hypot(dx, dz);
    // Wobble the outline, except on the south side where the fall is: a
    // few broad lobes and a finer wobble
    const ang = Math.atan2(dz, dx);
    const south = Math.max(0, Math.sin(ang));
    const keep = 1 - south * south * south * south;
    const wobble =
      (simplex.noise2D(Math.cos(ang) * 0.6 + 31, Math.sin(ang) * 0.6 + 31) *
        0.12 +
        simplex.noise2D(Math.cos(ang) * 2.2 + 43, Math.sin(ang) * 2.2 + 43) *
          0.07) *
      keep;
    // Buttresses and gullies down the walls, but not beside the fall
    const flutes =
      simplex.noise2D(Math.cos(ang) * 14 + 57, Math.sin(ang) * 14 + 57) *
      0.09 *
      (1 - south * Math.exp(-(dx * dx) / (2 * 50 * 50)));
    const d = dist / (FALLS_RADIUS * (1 + wobble + flutes));
    // A shelf partway down the walls along about half the outline, never
    // on the south side by the fall and its bay
    _fallsShelf =
      smoothRamp(
        simplex.noise2D(Math.cos(ang) * 1.1 + 71, Math.sin(ang) * 1.1 + 71),
        -0.1,
        0.25
      ) *
      (1 - south * south);
    return Math.max(
      (d - 1) * FALLS_RADIUS,
      FALLS_BAY - Math.hypot(dx, z - (FALLS_LIP_Z + FALLS_BAY))
    );
  }
  function fallsAt(x, z, simplex, waterLevel) {
    const dist = Math.hypot(x - FALLS_X, z - FALLS_Z);
    if (dist >= FALLS_RADIUS * 1.8) return [0, 0];
    const top = fallsTopShape(x, z, simplex);
    const out = fallsOut(x, z, simplex);
    const shelf = _fallsShelf;
    // The walls: sheer from the top down to near the water, then a short
    // apron of rock into the lake, which eases back into the land around.
    // Where the wall has a shelf, it steps out partway down onto a ledge
    // (up to 100 units wide, tipping a little outward) and drops again.
    const base = waterLevel + 30;
    const floor = waterLevel - 15;
    const ledge = base + (top - FALLS_CRAG * _fallsTop.crag - base) * 0.45;
    const wide = 100 * shelf;
    let h;
    if (out < 0) h = top;
    else if (out < 12) h = top + (ledge - top) * (out / 12);
    else if (out < 12 + wide) h = ledge - 12 * ((out - 12) / 100);
    else if (out < 30 + wide)
      h =
        ledge -
        12 * shelf +
        (base - ledge + 12 * shelf) * ((out - 12 - wide) / 18);
    else if (out < 90 + wide)
      h = base + (floor - base) * ((out - 30 - wide) / 60);
    else h = floor;
    const t = Math.min(1, Math.max(0, (1.8 - dist / FALLS_RADIUS) / 0.45));
    return [h, t * t * (3 - 2 * t)];
  }
  // For terrain-gen.js's colours and props, near the mountain (unwarped
  // world coordinates): how far out from the walls (x, z) is (negative on
  // the top), and on the top, how much crag is there (0 to 1) and how
  // close the stream's valley is (1 on the stream); null away from the
  // mountain
  const _fallsSite = {out: 0, crag: 0, valley: 0};
  function fallsSiteAt(x, z, simplex) {
    if (Math.hypot(x - FALLS_X, z - FALLS_Z) > FALLS_RADIUS * 1.6) return null;
    _fallsSite.out = fallsOut(x, z, simplex);
    fallsTopShape(x, z, simplex);
    const onTop = _fallsSite.out < 0;
    _fallsSite.crag = onTop ? _fallsTop.crag : 0;
    _fallsSite.valley = onTop ? _fallsTop.valley : 0;
    return _fallsSite;
  }
  // The spur: a ridge running west-north-west from the mountain's shoulder
  // toward where the first northern range begins, so the mountain reads as
  // the end of a line of hills rather than a block dropped on the plain. It
  // leaves the wall about halfway up, dips to a saddle and rises again
  // before fading into the land, staying well below the plane's height at
  // spawn (it crosses the plane's path about 1300 units west of the
  // mountain). Its height at (x, z), unwarped; taken as a floor under the
  // land (0 away from it).
  const FALLS_SPUR_ANGLE = (12 * Math.PI) / 180; // north of west
  const FALLS_SPUR_LENGTH = 2800;
  function fallsSpurAt(x, z, simplex) {
    const dx = x - FALLS_X;
    const dz = z - FALLS_Z;
    const ca = Math.cos(FALLS_SPUR_ANGLE);
    const sa = Math.sin(FALLS_SPUR_ANGLE);
    const u = -dx * ca - dz * sa;
    if (u < 0 || u > FALLS_SPUR_LENGTH) return 0;
    // Across the spur, from a crest line that wanders once clear of the wall
    const v =
      dx * sa -
      dz * ca -
      160 *
        simplex.noise2D(u * 0.0011 + 301, 17) *
        smoothRamp(u, FALLS_RADIUS, FALLS_RADIUS + 600);
    if (Math.abs(v) > 600) return 0;
    let crest =
      150 +
      130 * Math.exp(-((u - FALLS_RADIUS) ** 2) / (2 * 300 * 300)) +
      70 * smoothRamp(u, 1500, 2300) +
      40 * simplex.noise2D(u * 0.004 + 77, 3);
    crest *= 1 - smoothRamp(u, FALLS_SPUR_LENGTH - 600, FALLS_SPUR_LENGTH);
    // Rounded along the top, then sides of about 30 degrees, steeper and
    // shallower in turn
    const slope = 0.6 + 0.2 * simplex.noise2D(u * 0.003 - 41, v * 0.003);
    return crest + 20 - slope * Math.hypot(v, 35);
  }

  // --- THE DESERT LOWLAND ---
  // How deep in the desert (x, z) is, 0 to 1: from about 2.2 South (where
  // the sand has taken over) to full by 3.2 South, following the desert's
  // wandering edge (desertShift)
  function desertLowlandAt(x, z, simplex) {
    return smoothRamp(z / 5000 + desertShift(x, z, simplex), 2.2, 3.2);
  }
  // Dunes: long ridges across the prevailing wind (from the west-south-west),
  // with a gentle windward slope and a steep lee face, in dune fields that
  // cover most of the desert. Height above the ground, 0 to about 44.
  // Salt pans sit this far above the water
  const SALT_PAN_RISE = 0.8;
  // And the frozen lakes of the far north
  const LAKE_ICE_RISE = 0.6;
  const DUNE_WIND = 0.35;
  const DUNE_SPACING = 400;
  // How much of a dune field the last duneAt call was in, 0 to 1
  let _duneField = 0;
  function duneAt(x, z, simplex) {
    const field = smoothRamp(
      simplex.noise2D(x * 0.00025 + 610, z * 0.00025 - 240),
      -0.35,
      0.05
    );
    _duneField = field;
    if (field <= 0) return 0;
    const cos = Math.cos(DUNE_WIND);
    const sin = Math.sin(DUNE_WIND);
    const u = x * cos + z * sin;
    const v = -x * sin + z * cos;
    // Crests wander, split and rejoin along their length
    const phase =
      u / DUNE_SPACING + simplex.noise2D(v * 0.0007 + 7.7, u * 0.0002) * 0.6;
    const p = phase - Math.floor(phase);
    const s = p < 0.7 ? p / 0.7 : (1 - p) / 0.3;
    const amp = 30 + 14 * simplex.noise2D(x * 0.001 - 33, z * 0.001 + 91);
    return s * s * (3 - 2 * s) * amp * field;
  }
  // Mesas and buttes standing alone out on the flats: one in most 2.5 km
  // cells, with a flat top at a fixed height, sheer walls with a wobbly
  // outline and a talus skirt, some with a smaller butte on top. Not near
  // the airfields or the canyon. mesaAt fills _mesa (wall and skirt 0 to 1,
  // top and skirt height in units) and returns whether there's one here.
  const MESA_CELL = 2500;
  const _mesa = {wall: 0, skirt: 0, top: 0, skirtHeight: 0};
  function mesaHash(a, b, c) {
    let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ c;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function mesaAt(x, z, simplex) {
    const ci = Math.floor(x / MESA_CELL);
    const cj = Math.floor(z / MESA_CELL);
    if (mesaHash(ci, cj, 1) > 0.65) return false;
    const cx = (ci + 0.3 + 0.4 * mesaHash(ci, cj, 2)) * MESA_CELL;
    const cz = (cj + 0.3 + 0.4 * mesaHash(ci, cj, 3)) * MESA_CELL;
    const dx = x - cx;
    const dz = z - cz;
    const radius = 160 + 340 * mesaHash(ci, cj, 4);
    if (dx * dx + dz * dz > radius * radius * 2.6) return false;
    if (isOnAirport(cx, cz, 2500)) return false;
    if (
      cx > _canyonBox[0] &&
      cx < _canyonBox[1] &&
      cz > _canyonBox[2] &&
      cz < _canyonBox[3]
    ) {
      return false;
    }
    const ang = Math.atan2(dz, dx);
    const r =
      radius *
      (1 +
        0.16 *
          simplex.noise2D(
            Math.cos(ang) * 0.8 + ci * 7.1,
            Math.sin(ang) * 0.8 + cj * 5.3
          ));
    const d = Math.sqrt(dx * dx + dz * dz) / r;
    const height = 80 + 140 * mesaHash(ci, cj, 5);
    const cap = mesaHash(ci, cj, 6) < 0.4 ? 1 - smoothRamp(d, 0.4, 0.5) : 0;
    _mesa.wall = 1 - smoothRamp(d, 0.88, 1);
    _mesa.skirt = 1 - smoothRamp(d, 0.9, 1.5);
    _mesa.top = 110 + height + cap * height * 0.4;
    _mesa.skirtHeight = height * 0.18;
    return true;
  }

  // Tors in the far north: steep, lumpy rock knobs 45 to 115 units high and
  // 70 to 190 across, one in most 900-unit cells of the districts that
  // have them. Height above the ground.
  const TOR_CELL = 900;
  function torAt(x, z, simplex) {
    const district = smoothRamp(
      simplex.noise2D(x * 0.0004 - 55, z * 0.0004 + 12),
      -0.1,
      0.3
    );
    if (district <= 0) return 0;
    const ci = Math.floor(x / TOR_CELL);
    const cj = Math.floor(z / TOR_CELL);
    if (mesaHash(ci, cj, 11) > 0.7) return 0;
    const cx = (ci + 0.25 + 0.5 * mesaHash(ci, cj, 12)) * TOR_CELL;
    const cz = (cj + 0.25 + 0.5 * mesaHash(ci, cj, 13)) * TOR_CELL;
    const dx = x - cx;
    const dz = z - cz;
    const size = mesaHash(ci, cj, 14);
    const radius = 70 + 120 * size;
    if (dx * dx + dz * dz > radius * radius * 1.7) return 0;
    const ang = Math.atan2(dz, dx);
    const r =
      radius *
      (1 +
        0.25 *
          simplex.noise2D(
            Math.cos(ang) * 1.2 + ci * 3.7,
            Math.sin(ang) * 1.2 + cj * 2.9
          ));
    const d = Math.sqrt(dx * dx + dz * dz) / r;
    const body = 1 - smoothRamp(d, 0.5, 1);
    const lumps = 0.8 + 0.2 * simplex.noise2D(x * 0.02 + ci, z * 0.02 + cj);
    return (45 + 70 * size) * body * lumps * district;
  }

  // 0 on and beside the highway, rising to 1 by 400 units out, so dunes,
  // mesas and tors don't bury it
  function roadClear(x, z) {
    let clear = 1;
    const i = Math.round((x - ROAD_BASE_X) / ROAD_SPACING);
    if (i >= 0 && i <= ROAD_LAST) {
      clear = smoothRamp(Math.abs(x - getRoadCenterX(z, i)), 150, 400);
    }
    if (x > ROAD_EW_WEST && x < ROAD_EW_EAST) {
      clear = Math.min(
        clear,
        smoothRamp(Math.abs(z - getRoadCenterZ(x)), 150, 400)
      );
    }
    return clear;
  }

  // Height h at a point `across` from road n's line at `along` (see
  // roadPoint), cut down into a trench where the land rises above the road
  function carveRoadTrench(h, n, along, across, simplex, constants, lerp) {
    const WATER_LEVEL = constants.WATER_LEVEL || 40;
    const center = roadCenter(n, along);
    const distToRoad = Math.abs(across - center);

    const CANYON_FLOOR_WIDTH = 50; // Flat area at the bottom for the road to sit in

    // Conservative check to avoid computing center elevation for far away points
    const MAX_POSSIBLE_WALL_WIDTH = 3500;
    if (distToRoad >= CANYON_FLOOR_WIDTH + MAX_POSSIBLE_WALL_WIDTH) return h;

    // Find the intended natural height of the road center
    // We MUST ignore roads and rivers here to avoid recursion and hitting trenches
    roadPoint(n, along, center, _roadXZ);
    const centerNaturalH = getElevation(
      _roadXZ.x,
      _roadXZ.z,
      simplex,
      constants,
      lerp,
      {ignoreRivers: true, ignoreRoads: true, forRoad: true}
    );

    const roadY = highwayHeight(centerNaturalH, WATER_LEVEL);

    // Dynamically scale wall width based on depth of the cut to maintain a smooth slope
    const canyonDepth = Math.max(0, centerNaturalH - roadY);
    const CANYON_WALL_WIDTH = 250 + canyonDepth * 1.5;

    // If the terrain is higher than the road, carve a canyon
    if (distToRoad >= CANYON_FLOOR_WIDTH + CANYON_WALL_WIDTH || h <= roadY) {
      return h;
    }
    let carveFactor;
    if (distToRoad <= CANYON_FLOOR_WIDTH) {
      carveFactor = 1.0;
    } else {
      // Smoothly slope the canyon walls up to the natural terrain
      const t = (distToRoad - CANYON_FLOOR_WIDTH) / CANYON_WALL_WIDTH;
      carveFactor = 1.0 - t * t * (3 - 2 * t);
    }
    // roadY - 2.5 avoids clipping and z-fighting with the road deck
    return carveFactor > 0 ? lerp(h, roadY - 2.5, carveFactor) : h;
  }

  function getElevation(x, z, simplex, constants, lerp, options = {}) {
    const WATER_LEVEL = constants.WATER_LEVEL || 40;

    const getProceduralTerrainType = (latIndex, terrainFrequency) =>
      proceduralTerrainType(latIndex, simplex, terrainFrequency);

    const {MAP_WORLD_SIZE = 5000} = constants;
    const _lerp =
      lerp ||
      function (a, b, t) {
        return a + (b - a) * t;
      };

    // --- CUSTOM MAP INGESTION ---
    if (exports.customMap) {
      const {data, width, height} = exports.customMap;

      // u, v should map from world coords (-worldWidth/2 to +worldWidth/2)
      // to image coords (0 to 1)
      const mapWidth = exports.customMap.worldWidth || MAP_WORLD_SIZE;
      const mapHeight = exports.customMap.worldHeight || MAP_WORLD_SIZE;

      const u = x / mapWidth + 0.5;
      const v = z / mapHeight + 0.5;

      if (u < 0 || u > 1 || v < 0 || v > 1) {
        // Out of bounds is deep ocean (well below WATER_LEVEL=40)
        // to avoid Z-fighting and "patchwork" effects.
        return 30.0;
      }

      // For a 1024x1024 image, max index is 1023
      const px = u * (width - 1);
      const py = v * (height - 1);

      let x1 = Math.floor(px);
      let x2 = Math.min(x1 + 1, width - 1);
      let y1 = Math.floor(py);
      let y2 = Math.min(y1 + 1, height - 1);

      // Saftey clamp if math precision errors push us slightly out of bounds
      x1 = Math.max(0, Math.min(x1, width - 1));
      x2 = Math.max(0, Math.min(x2, width - 1));
      y1 = Math.max(0, Math.min(y1, height - 1));
      y2 = Math.max(0, Math.min(y2, height - 1));

      const dx = px - x1;
      const dy = py - y1;

      // Float32Array is row-major: index = (y * width) + x
      const h11 = data[y1 * width + x1];
      const h21 = data[y1 * width + x2];
      const h12 = data[y2 * width + x1];
      const h22 = data[y2 * width + x2];

      // Handle undefined cases gracefully if somehow OOB
      if (
        h11 === undefined ||
        h21 === undefined ||
        h12 === undefined ||
        h22 === undefined
      ) {
        return WATER_LEVEL;
      }

      const r1 = _lerp(h11, h21, dx);
      const r2 = _lerp(h12, h22, dx);

      const normalizedHeight = _lerp(r1, r2, dy) / 255.0;
      // --- ALTITUDE-BASED MAPPING ---
      // Map 0-255 luminance to a world Y range of 38.0 -> 125.5.
      // Starting at 38.0 ensures that luminance 0 is slightly underwater (WATER_LEVEL=40).
      return 38.0 + normalizedHeight * 87.5;
    }

    // =========================================================================
    // CRITICAL ARCHITECTURE RULE: NEVER EARLY-RETURN FROM getElevation()
    // Procedural terrain generation is an accumulative sequential pipeline.
    // Any intermediate `return n;` aborts all subsequent feature passes (e.g.
    // alien biomes, frozen north pack ice shelf, continental beaches), causing
    // massive world-scale tears and horizontal/vertical striping artifacts.
    // Always skip feature blocks using conditional checks instead of returning early.
    // =========================================================================

    pickContinent();

    // --- DOMAIN WARPING ---
    // Warp coordinates for terrain noise sampling — creates organic coastlines
    // and natural-looking terrain by distorting the noise grid.
    const origX = x;
    const origZ = z;
    x += domainWarpX(x, z, simplex);
    z += domainWarpZ(origX, z, simplex);
    // Where the fine noise layers sample (see DETAIL_WARP)
    const dx = origX + (x - origX) * DETAIL_WARP;
    const dz = origZ + (z - origZ) * DETAIL_WARP;

    const biome = getBiome(x, z, simplex);

    let heightScale = 150;
    let offset = 60;
    let roughness = 50;
    let rockiness = 10;

    const westFactor = Math.max(0, Math.min(1, -x / 4500));

    // Noise damping for Ocean Biomes (biome < -0.1)
    // This makes the water perfectly flat by reducing the amplitude of terrain noise.
    let oceanDamping = 1.0;
    if (biome < -0.1) {
      oceanDamping = Math.max(0, 1.0 - (-0.1 - biome) * 4);
      oceanDamping = Math.pow(oceanDamping, 2); // Sharper transition
    }

    // East coast beach flattening
    const eastCoastFactor = Math.max(0, Math.min(1, (x + 2000) / 2000));
    if (eastCoastFactor > 0) {
      if (biome < 0.1 && biome > -0.3) {
        // Peek flattening around biome = -0.1 (the shoreline)
        const shoreDist = 1.0 - Math.abs(biome + 0.1) / 0.2;
        const beachDamping = 1.0 - shoreDist * 0.8 * eastCoastFactor;
        heightScale *= beachDamping;
        roughness *= beachDamping;
        rockiness *= beachDamping;
      }
    }

    if (biome < -0.2) {
      const t = Math.min(1, (-0.2 - biome) * 3);
      offset = _lerp(60, -55, t);
      heightScale = _lerp(150, 100, t);
      roughness = _lerp(50, 20, t);
    } else if (biome > 0.2) {
      const t = Math.min(1, (biome - 0.2) * 3);
      offset = _lerp(60, 20, t);
      heightScale = _lerp(150, 250, t);
      roughness = _lerp(50, 100, t);
      rockiness = _lerp(10, 30, t);
    }

    if (x < 0) {
      // 1. Reduce the dampening of the main height scale to retain more verticality
      heightScale *= 1 - westFactor * 0.4; // Was 0.8

      // 2. Increase the base altitude in the west (was 65, now 120)
      offset = _lerp(offset, 120, westFactor);

      // 3. Inject new, low-frequency noise specifically for broad rolling hills
      const rollingHills =
        cylNoise(x, (nx, ny) =>
          simplex.noise3D(nx * 0.0003, z * 0.0003, ny * 0.0003)
        ) * 140;
      offset += rollingHills * westFactor;

      // 4. Heavily dampen roughness and rockiness so the hills are smooth, not jagged
      roughness *= 1 - westFactor * 0.85; // Was 0.7
      rockiness *= 1 - westFactor * 0.95; // Was 0.9
    }

    let n =
      cylNoise(dx, (nx, ny) =>
        simplex.noise3D(nx * 0.001, dz * 0.001, ny * 0.001)
      ) *
      heightScale *
      oceanDamping;

    if (biome > 0.2) {
      const t = Math.min(1, (biome - 0.2) * 3);
      let ridge =
        1.0 -
        Math.abs(
          cylNoise(dx, (nx, ny) =>
            simplex.noise3D(nx * 0.0008, dz * 0.0008, ny * 0.0008)
          )
        );
      n += (ridge * 220 - 100) * t * (1 - westFactor);
    }

    n +=
      cylNoise(dx, (nx, ny) =>
        simplex.noise3D(nx * 0.003, dz * 0.003, ny * 0.003)
      ) *
      roughness *
      oceanDamping;
    n +=
      cylNoise(dx, (nx, ny) =>
        simplex.noise3D(nx * 0.01, dz * 0.01, ny * 0.01)
      ) *
      rockiness *
      oceanDamping;

    if (biome < -0.4) {
      const clusterChance = cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0002, z * 0.0002, ny * 0.0002)
      );
      if (clusterChance > 0.4) {
        const islandNoise = cylNoise(x, (nx, ny) =>
          simplex.noise3D(nx * 0.005, z * 0.005, ny * 0.005)
        );
        if (islandNoise > 0) {
          n += islandNoise * 80 * (clusterChance - 0.4) * 2 * oceanDamping;
        }
      }
    }

    n += offset;

    // --- LANDFORMS ---
    // A slow field (tens of km across) gives the land broad character
    // between the mountains: open plains, where the hills settle into
    // gentle lowland, and plateaus, raised tablelands behind escarpments.
    // Elsewhere it stays the rolling hills. Land only (not the sea).
    const landform = landformAt(x, z, simplex);
    const onLand = smoothRamp(biome, -0.1, 0.05);
    if (onLand > 0 && (landform.plains > 0 || landform.plateau > 0)) {
      const plains = landform.plains * onLand;
      const plateau = landform.plateau * onLand;
      let shaped = offset + (n - offset) * (1 - 0.75 * plains);
      shaped += plains * Math.max(0, PLAINS_FLOOR - offset);
      shaped = _lerp(
        shaped,
        offset + PLATEAU_RISE + (shaped - offset) * 0.2,
        plateau
      );
      n = shaped;
    }

    // --- LARGE ISLANDS LOGIC (East) ---
    if (x > 3000) {
      // Smoothly fade in the islands as the biome becomes more ocean-like
      // 0 at biome >= 0.0, 1 at biome <= -0.2
      const biomeFade = Math.max(0, Math.min(1, -biome * 5));

      // Suppress large islands near the Montauk lighthouse (X=7500, Z=3000)
      const distToLighthouseSq =
        (x - 7500) * (x - 7500) + (z - 3000) * (z - 3000);
      const suppressionRadius = 4000; // Keep a 4000 unit radius clear
      let suppressionFactor = 1.0;
      if (distToLighthouseSq < suppressionRadius * suppressionRadius) {
        // Use smoothstep for a softer suppression transition
        const dist = Math.sqrt(distToLighthouseSq);
        const t = dist / suppressionRadius;
        suppressionFactor = t * t * (3 - 2 * t);
      }
      const finalFade = biomeFade * suppressionFactor;

      if (finalFade > 0) {
        const regionAt = (o) =>
          cylNoise(x, (nx, ny) =>
            simplex.noise3D(nx * 0.0001 + o, z * 0.0001 + o, ny * 0.0001 + o)
          );
        let islandRegion = regionAt(500);
        // Mid-sea (about 2.5 to 9.5 East) a second, independent field of
        // clusters fills the gaps, so the crossing to the alien land isn't
        // long empty water on some seeds
        const midSea =
          Math.max(0, Math.min(1, (x - 12500) / 5000)) *
          Math.max(0, Math.min(1, (47500 - x) / 5000));
        if (midSea > 0) {
          islandRegion = Math.max(islandRegion, regionAt(900) * midSea);
        }
        // 0.1 keeps plenty of open ocean, but increases cluster frequency
        if (islandRegion > 0.1) {
          // Domain warping to create organic, jagged coastlines instead of round blobs
          const warpX =
            cylNoise(x, (nx, ny) =>
              simplex.noise3D(nx * 0.0005, z * 0.0005, ny * 0.0005)
            ) * 500;
          const warpZ =
            cylNoise(x, (nx, ny) =>
              simplex.noise3D(
                nx * 0.0005 + 100,
                z * 0.0005 + 100,
                ny * 0.0005 + 100
              )
            ) * 500;

          const islandShape = cylNoise(x, (nx, ny) =>
            simplex.noise3D(
              (nx + warpX) * 0.0003 + 1000,
              (z + warpZ) * 0.0003 + 1000,
              (ny + warpX) * 0.0003 + 1000
            )
          );

          // -0.2 makes the islands slightly larger within their clusters
          if (islandShape > -0.2) {
            const eastIntensity = Math.min(1, (x - 3000) / 7000);
            const shapeFactor = Math.max(0, islandShape + 0.2);
            const baseFactor =
              shapeFactor * (islandRegion - 0.1) * eastIntensity * finalFade;
            // Mid-sea, the faintest rises are lifted out of the water too
            // (up to 0.15), without making the tall islands any taller
            const heightFactor = Math.min(
              baseFactor * (1 + 2 * midSea),
              Math.max(baseFactor, 0.15)
            );

            // Islands are steep
            if (heightFactor > 0) {
              const archetype = getIslandArchetype(x, z, simplex);

              if (archetype === 'karst') {
                // --- 1. KARST LIMESTONE TOWERS (Halong Bay style) ---
                // Low-lying coastal shelf and beach foundation
                const baseShelf =
                  Math.min(1.0, shapeFactor * 3.0) * 50 * heightFactor;

                // Domain warping for organic, jagged tower contours
                const kWarpX =
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(nx * 0.0012, z * 0.0012, ny * 0.0012)
                  ) * 160;
                const kWarpZ =
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(
                      nx * 0.0012 + 45.6,
                      z * 0.0012 + 45.6,
                      ny * 0.0012 + 45.6
                    )
                  ) * 160;

                // Tower noise defines the locations of individual monolithic pillars
                const towerNoise = cylNoise(x, (nx, ny) =>
                  simplex.noise3D(
                    (nx + kWarpX) * 0.00075 + 300,
                    (z + kWarpZ) * 0.00075 + 300,
                    (ny + kWarpX) * 0.00075 + 300
                  )
                );

                let towerHeight = 0;
                if (towerNoise > 0.02) {
                  // Normalize [0.02, 1.0] -> [0, 1]
                  const tNorm = Math.min(1.0, (towerNoise - 0.02) / 0.98);

                  // Steep rise for sheer vertical cliff walls
                  const cliffProfile = Math.pow(tNorm, 0.42);

                  // Domed summit cap: plateau/rounded crest instead of sharp cone
                  const domeCap =
                    1.0 -
                    Math.pow(Math.max(0, tNorm - 0.65) / 0.35, 2.0) * 0.28;

                  towerHeight = cliffProfile * domeCap * 1250 * heightFactor;

                  // Horizontal stratified rock ridges along cliff faces
                  const strata =
                    Math.sin(towerHeight * 0.05) * 14 * (1.0 - tNorm);
                  towerHeight += strata;
                }

                // Secondary solitary sea stacks in the nearby water
                const stackNoise = cylNoise(x, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.002 + 777,
                    z * 0.002 + 777,
                    ny * 0.002 + 777
                  )
                );
                if (stackNoise > 0.42) {
                  const stackNorm = (stackNoise - 0.42) / 0.58;
                  towerHeight +=
                    Math.pow(stackNorm, 0.35) *
                    380 *
                    heightFactor *
                    Math.max(0, islandRegion - 0.05) *
                    4;
                }

                // Fine surface crag & jungle canopy roughness
                const canopy =
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(nx * 0.0035, z * 0.0035, ny * 0.0035)
                  ) *
                  45 *
                  heightFactor;

                n += baseShelf + towerHeight + canopy;
              } else if (archetype === 'caldera') {
                // --- 2. MASSIVE VOLCANIC CALDERAS ---
                // Imposing volcanic island with broad flanks rising to an undulating crater rim,
                // plunging inside into a sunken caldera lagoon with a central resurgent cone.
                const rimCenter = 0.46;
                const maxRimElevation = 950 * heightFactor;

                // Volcanic radial erosion fluting
                const gullyNoise =
                  1.0 -
                  Math.abs(
                    cylNoise(x, (nx, ny) =>
                      simplex.noise3D(nx * 0.0014, z * 0.0014, ny * 0.0014)
                    )
                  );
                const gully = gullyNoise * gullyNoise * 140 * heightFactor;

                // Organic rim variation
                const rimWobble =
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(
                      nx * 0.00075 + 111,
                      z * 0.00075 + 111,
                      ny * 0.00075 + 111
                    )
                  ) *
                  110 *
                  heightFactor;

                // Natural sea breach on one side
                const breachNoise = cylNoise(x, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.00045 + 500,
                    z * 0.00045 + 500,
                    ny * 0.00045 + 500
                  )
                );
                const breachDip =
                  Math.max(0, breachNoise - 0.28) * 350 * heightFactor;

                // Base mountain volume: ensures the volcano has solid, wide land flanks
                const mountainBase =
                  Math.min(1.0, shapeFactor * 2.2) * 220 * heightFactor;

                let calderaHeight;
                if (shapeFactor <= rimCenter) {
                  // Outer volcanic slopes: smooth power rise up to the rim crest
                  const flankNorm = shapeFactor / rimCenter;
                  const flankProfile = Math.pow(flankNorm, 1.25);
                  calderaHeight =
                    flankProfile * (maxRimElevation + rimWobble) +
                    gully * flankNorm -
                    breachDip * flankNorm;
                } else {
                  // Inside the caldera: steep inner cliff walls plunging down into the caldera bowl
                  const innerNorm = Math.min(
                    1.0,
                    (shapeFactor - rimCenter) / (0.85 - rimCenter)
                  );
                  const peakHeight = maxRimElevation + rimWobble - breachDip;

                  // Carve down to the caldera floor (so it forms a deep bowl dipping slightly into sea level)
                  const craterFloorTarget = -30 * heightFactor;
                  const totalDrop = peakHeight - craterFloorTarget;

                  // Steep inner cliff walls that flatten out onto the caldera floor
                  const dropProfile = Math.pow(innerNorm, 1.15);
                  calderaHeight = peakHeight - dropProfile * totalDrop;

                  // Central resurgent volcanic cone in the heart of the caldera
                  if (innerNorm > 0.55) {
                    const coneNorm = (innerNorm - 0.55) / 0.45;
                    const resurgentPeak =
                      Math.pow(coneNorm, 1.8) * 180 * heightFactor;
                    calderaHeight += resurgentPeak;
                  }
                }

                const ashDetail =
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(nx * 0.003, z * 0.003, ny * 0.003)
                  ) *
                  35 *
                  heightFactor;
                n += mountainBase + calderaHeight + ashDetail;
              } else if (archetype === 'atoll') {
                // --- 3. SUNKEN ATOLLS / BARRIER RINGS ---
                // Low-lying coral barrier reef and sand motus (islets) surrounding a shallow turquoise lagoon.
                // Low profile: sand beaches, palm trees, dune crests (elevation 10-35m above sea level).

                // Outer reef platform foundation: smoothly lifts the deep ocean floor (-55)
                // up to the shallow reef flat (~36-38, just 2-4 units below water level 40).
                const platformEdge = Math.min(1.0, shapeFactor / 0.16);
                const platformSmooth =
                  platformEdge * platformEdge * (3 - 2 * platformEdge);
                const clusterIntensity =
                  (islandRegion - 0.1) * eastIntensity * finalFade;
                const depthBelowReef = Math.max(0, WATER_LEVEL - 2.0 - n);
                const reefPlatform =
                  platformSmooth *
                  depthBelowReef *
                  Math.min(1.0, clusterIntensity * 3.0);

                // Barrier ring: defined around shapeFactor ~ 0.40 - 0.45
                const ringCenter = 0.42;
                const ringWidth = 0.35;
                const distFromRing = Math.abs(shapeFactor - ringCenter);
                const ringT = Math.max(0, 1.0 - distFromRing / ringWidth);
                const ringMask = ringT * ringT * (3 - 2 * ringT);

                // Tidal passes / channels breaking the ring into distinct tropical motus (islets)
                const passNoise = cylNoise(x, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.0018 + 444,
                    z * 0.0018 + 444,
                    ny * 0.0018 + 444
                  )
                );
                const motuFactor = Math.max(0, passNoise + 0.15);

                // Motu dry land elevation: base shelf bringing land above water
                const motuElevation =
                  ringMask *
                  (10 + motuFactor * 24) *
                  Math.min(1.0, clusterIntensity * 2.5);

                // Interior motu ridge: rugged jungle spine scaled by heightFactor (same
                // approach as karst/caldera) so it actually reaches green-zone elevations.
                // Uses ridged noise (1 - |n|) for steep sheer sides.
                const ridgeRaw = cylNoise(x, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.0032 + 222,
                    z * 0.0032 + 222,
                    ny * 0.0032 + 222
                  )
                );
                const ridgeNoise = 1.0 - Math.abs(ridgeRaw);
                const ridgeSharp = Math.pow(
                  Math.max(0, ridgeNoise - 0.22) / 0.78,
                  1.2
                );
                const motuRidge =
                  ridgeSharp *
                  ringMask *
                  Math.max(0, motuFactor - 0.05) *
                  650 *
                  heightFactor;

                // Remnant volcanic peak: the drowned original volcano at the atoll center
                // (Bora Bora / Moorea style — Mt. Otemanu rising from inside the lagoon).
                // Only appears at high shapeFactor (deep inside the ring) with ridged noise.
                let volcanicPeak = 0;
                if (shapeFactor > 0.54) {
                  const peakNorm = Math.min(1.0, (shapeFactor - 0.54) / 0.38);
                  const peakRaw = cylNoise(x, (nx, ny) =>
                    simplex.noise3D(
                      nx * 0.003 + 555,
                      z * 0.003 + 555,
                      ny * 0.003 + 555
                    )
                  );
                  const peakNoise = 1.0 - Math.abs(peakRaw);
                  if (peakNoise > 0.28) {
                    const peakSharp = Math.pow((peakNoise - 0.28) / 0.72, 0.7);
                    volcanicPeak =
                      peakSharp *
                      Math.pow(peakNorm, 0.75) *
                      1150 *
                      heightFactor;
                  }
                }

                // Lagoon: broad, shallow protected waters inside the barrier ring (shapeFactor > ringCenter)
                let lagoonCarve = 0;
                if (shapeFactor > ringCenter) {
                  const innerLagoon = Math.min(
                    1.0,
                    (shapeFactor - ringCenter) / 0.15
                  );
                  // Carves down by 5-6 units so the lagoon bed sits at elevation 31-33 (shallow turquoise water)
                  // Suppress carve wherever the volcanic peak erupts through
                  const peakSuppression = Math.min(1.0, volcanicPeak / 80);
                  lagoonCarve =
                    innerLagoon * innerLagoon * 5.5 * (1.0 - peakSuppression);

                  // Isolated sandbanks or small coral pinnacles (bommies) in the center of the lagoon
                  if (shapeFactor > 0.65) {
                    const pinnacleNoise = cylNoise(x, (nx, ny) =>
                      simplex.noise3D(
                        nx * 0.0025 + 888,
                        z * 0.0025 + 888,
                        ny * 0.0025 + 888
                      )
                    );
                    if (pinnacleNoise > 0.25) {
                      lagoonCarve -=
                        Math.pow((pinnacleNoise - 0.25) / 0.75, 1.5) * 11;
                    }
                  }
                }

                // Fine sand dunes and beach berms
                const sandDunes =
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(nx * 0.006, z * 0.006, ny * 0.006)
                  ) *
                  3.0 *
                  ringMask;

                n +=
                  reefPlatform +
                  motuElevation +
                  motuRidge +
                  volcanicPeak -
                  lagoonCarve +
                  sandDunes;
              } else {
                // Standard ridged mountain islands (fallback until Caldera & Atoll are implemented)
                // Add ridged noise for jagged peaks
                const ridgeNoise =
                  1.0 -
                  Math.abs(
                    cylNoise(x, (nx, ny) =>
                      simplex.noise3D(nx * 0.001, z * 0.001, ny * 0.001)
                    )
                  );
                const ruggedness = ridgeNoise * ridgeNoise; // Sharpen ridges

                // Base height + mountain peaks
                let islandHeight = heightFactor * 600; // Base land
                islandHeight += ruggedness * 1200 * heightFactor; // Sharp peaks

                // Small scale surface roughness
                islandHeight +=
                  cylNoise(x, (nx, ny) =>
                    simplex.noise3D(nx * 0.003, z * 0.003, ny * 0.003)
                  ) *
                  150 *
                  heightFactor;

                n += islandHeight;
              }
            }
          }
        }
      }
    }

    // --- LARGE LAKES LOGIC (West) ---
    if (x < -3000) {
      const lakeRegion = cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0001 + 200, z * 0.0001 + 200, ny * 0.0001 + 200)
      );
      if (lakeRegion > 0.2) {
        const lakeShape = cylNoise(x, (nx, ny) =>
          simplex.noise3D(
            nx * 0.0003 + 300,
            z * 0.0003 + 300,
            ny * 0.0003 + 300
          )
        );
        if (lakeShape > -0.1) {
          const westIntensity = Math.min(1, (-x - 3000) / 7000);
          const shapeFactor = Math.max(0, lakeShape + 0.1);
          let depthFactor = shapeFactor * (lakeRegion - 0.2) * westIntensity;
          if (depthFactor > 0) {
            let carveAmount = depthFactor * 800;

            // --- ISLAND LOGIC ---
            // Only potential islands in deeper parts of the lake (towards the middle)
            if (depthFactor > 0.1) {
              // Not all large lakes have them
              const islandRegion = cylNoise(x, (nx, ny) =>
                simplex.noise3D(
                  nx * 0.0001 + 500,
                  z * 0.0001 + 500,
                  ny * 0.0001 + 500
                )
              );
              if (islandRegion > 0.2) {
                const islandNoise = cylNoise(x, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.002 + 600,
                    z * 0.002 + 600,
                    ny * 0.002 + 600
                  )
                );
                if (islandNoise > 0.5) {
                  // Pull the terrain up to form an island, back to at most the
                  // land around the lake: uncapped, these rose up to 2,000
                  // units as thin grey needles all over the west.
                  const islandHeight = Math.min(
                    (islandNoise - 0.5) * 4000,
                    carveAmount
                  );
                  carveAmount -= islandHeight;
                }
              }
            }

            n -= carveAmount; // Carve down
          }
        }
      }
    }

    // Strict water level clamping
    if (n < WATER_LEVEL - 10) {
      n = WATER_LEVEL - 10;
    }

    // Apply Massive Mountain Range - Procedural
    const latScale = 5000;
    const currentLat = Math.round(z / latScale);
    const terrainFrequency = 0.8; // Tunable variable for feature density

    // Check center latitude and adjacent ones to handle meander overlap
    for (let l = currentLat - 1; l <= currentLat + 1; l++) {
      if (getProceduralTerrainType(l, terrainFrequency) !== 'mountain')
        continue;

      const xStart = -2500;
      const zCenterBase = l * latScale;
      const rangeLat = l;
      const maxHeight = 1600;

      if (x < xStart) {
        // Low-frequency meandering for the range center
        const ridgeMeander = cylNoise(x, (nx, ny) =>
          simplex.noise3D(
            nx * 0.0001 + rangeLat * 100,
            123,
            ny * 0.0001 + rangeLat * 100
          )
        );
        const currentZCenter = zCenterBase + ridgeMeander * 2000;

        // Vary mountain presence - some areas have peaks, others are just foothills
        const presenceMod =
          0.5 +
          cylNoise(x, (nx, ny) =>
            simplex.noise3D(
              nx * 0.0002 + rangeLat * 50,
              789,
              ny * 0.0002 + rangeLat * 50
            )
          ) *
            0.5; // [0, 1]

        const dxRange = xStart - x;
        const fadeIn = Math.min(1, dxRange / 5000);

        const dz = z - currentZCenter;
        const dist = Math.abs(dz);

        // 1. Broad base "mass" with lateral branching spurs and cirque bowls
        const side = dz >= 0 ? 1 : -1;
        // Angled spur coordinate branches out at ~37 degrees from the central spine
        const spurCoord = dx * 0.8 + side * dist * 0.6;
        const spurFreq = 0.0009;
        const spurRidge =
          1.0 -
          Math.abs(
            cylNoise(spurCoord, (nx, ny) =>
              simplex.noise3D(
                nx * spurFreq + rangeLat * 23.7,
                dist * 0.0004 + 127.3,
                ny * spurFreq + rangeLat * 23.7
              )
            )
          );
        const spurStrength = Math.pow(spurRidge, 1.4);

        // Lateral reach: spurs push peaks outward into buttresses, while hollows pull inward into cirques
        const spurReach = options.forRoad
          ? 0
          : (spurStrength - 0.45) * 650 * Math.min(1, dist / 800);
        const effectiveDist = Math.max(0, dist - spurReach);

        // Gaussian base mass using effective distance
        const baseRadius = 2600;
        const baseFalloff = Math.exp(
          -(effectiveDist * effectiveDist) / (2 * baseRadius * baseRadius)
        );

        if (baseFalloff > 0.01) {
          // 2. Sharper alpine peaks with natural taper
          const peakRadius = 2200;
          const peakDist = Math.min(peakRadius, effectiveDist);
          const peakShape = Math.pow(1.0 - peakDist / peakRadius, 1.7);

          // 3. Glacial cirque bowls: concave basins hollowed between lateral spurs
          let cirqueScoop = 0;
          if (!options.forRoad && dist > 600 && dist < 2200) {
            const cirqueMask = Math.sin(((dist - 600) / 1600) * Math.PI);
            const valleyHollow = Math.max(0, 0.45 - spurStrength) * 2.2;
            cirqueScoop = cirqueMask * valleyHollow * 160;
          }

          // 4. Lateral spur ridge elevation (buttresses jutting down the flanks)
          let spurElev = 0;
          if (!options.forRoad && dist > 400 && dist < 2500) {
            const flankEnvelope = Math.sin(((dist - 400) / 2100) * Math.PI);
            spurElev = spurStrength * 200 * flankEnvelope;
          }

          // 5. Rolling foothills bridging the mountain massif into surrounding plains
          let foothillHeight = 0;
          if (dist > 1000 && dist < 3800) {
            const foothillT = (3800 - dist) / 2800;
            const foothillEnvelope =
              foothillT * foothillT * (3 - 2 * foothillT);
            const foothillNoise =
              cylNoise(dx, (nx, ny) =>
                simplex.noise3D(
                  nx * 0.0008 + rangeLat * 31.2,
                  dz * 0.0008 + rangeLat * 54.1,
                  ny * 0.0008 + rangeLat * 31.2
                )
              ) *
                0.65 +
              cylNoise(dx, (nx, ny) =>
                simplex.noise3D(
                  nx * 0.0018 + 73.1,
                  dz * 0.0018 + 89.2,
                  ny * 0.0018 + 73.1
                )
              ) *
                0.35;
            foothillHeight =
              Math.max(0, foothillNoise + 0.15) * 150 * foothillEnvelope;
          }

          // 6. Ridged Multi-Fractal ruggedness (Pyramidal Alpine Horns & Arêtes)
          let ruggedness;
          if (options.forRoad) {
            // Smooth mountain pass grade for highway without knife-edge crag spikes
            ruggedness = 0.25;
          } else {
            // Domain warping curves ridges into natural serpentine mountain crests
            const warpX =
              cylNoise(x, (nx, ny) =>
                simplex.noise3D(
                  nx * 0.0004 + rangeLat * 12.3,
                  z * 0.0004,
                  ny * 0.0004 + rangeLat * 12.3
                )
              ) * 120;
            const warpZ =
              cylNoise(x, (nx, ny) =>
                simplex.noise3D(
                  nx * 0.0004,
                  z * 0.0004 + rangeLat * 34.5,
                  ny * 0.0004
                )
              ) * 120;
            const qx = dx + warpX;
            const qz = dz + warpZ;

            // 3-octave ridged multifractal: broad massifs -> arêtes -> crags
            let r1 =
              1.0 -
              Math.abs(
                cylNoise(qx, (nx, ny) =>
                  simplex.noise3D(nx * 0.0007, qz * 0.0007, ny * 0.0007)
                )
              );
            r1 = Math.pow(r1, 1.3);

            let r2 =
              1.0 -
              Math.abs(
                cylNoise(qx, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.0016 + 127.1,
                    qz * 0.0016 + 311.7,
                    ny * 0.0016 + 127.1
                  )
                )
              );
            r2 = Math.pow(r2, 1.4);

            let r3 =
              1.0 -
              Math.abs(
                cylNoise(qx, (nx, ny) =>
                  simplex.noise3D(
                    nx * 0.0035 + 241.3,
                    qz * 0.0035 + 189.5,
                    ny * 0.0035 + 241.3
                  )
                )
              );

            // Multifractal modulation: fine arête gullies crest along the main peaks
            ruggedness =
              r1 * 0.6 + r2 * 0.28 * r1 + r3 * 0.12 * (r1 * 0.5 + 0.5);
          }

          // Combine: Foothills and base mass supporting alpine peaks and buttresses
          const baseHeight = 240 * baseFalloff + foothillHeight;
          const peakHeight = Math.max(
            0,
            maxHeight * peakShape * ruggedness * (0.4 + 0.6 * presenceMod) +
              spurElev -
              cirqueScoop
          );

          let totalContribution = (baseHeight + peakHeight) * fadeIn;

          // Land/Water Protection
          const landFactor = Math.min(1, Math.max(0, n - WATER_LEVEL) / 15);

          // --- VALLEY LOGIC ---
          // Introduced occasional valleys using low-frequency noise.
          const valleyNoise = cylNoise(x, (nx, ny) =>
            simplex.noise3D(
              nx * 0.00012 + rangeLat * 77,
              z * 0.00012 + rangeLat * 88,
              ny * 0.00012 + rangeLat * 77
            )
          );
          // Map noise [-1, 1] to a factor where most of the noise (above -0.5) is 1.0 (mountain present),
          // and values below -0.5 dip into valleys (mountain absent).
          const valleyFactor = Math.max(
            0,
            Math.min(1, (valleyNoise + 0.5) * 5.0)
          );

          if (landFactor > 0.3 || totalContribution > 25) {
            n += totalContribution * valleyFactor;
          }
        }
      }
    }

    // --- VOLCANO INJECTION (Volcano at 1W, 1S) ---
    const vX = -5000;
    const vZ = 5000;
    const dxV = origX - vX;
    const dzV = origZ - vZ;
    const distSqV = dxV * dxV + dzV * dzV;
    const vRadius = 1200; // Increased radius for check area

    if (distSqV < vRadius * vRadius * 4) {
      // Check wide area
      const distV = Math.sqrt(distSqV);

      // Add noise to the distance to make the shape irregular (domain warping)
      const warpNoise =
        cylNoise(origX, (nx, ny) =>
          simplex.noise3D(nx * 0.0005, origZ * 0.0005, ny * 0.0005)
        ) * 200;
      const warpedDistSq = Math.pow(distV + warpNoise, 2);

      // Main Peak (Gaussian) - Wider base (sigma = 700 instead of 500)
      let vHeight = 1400 * Math.exp(-warpedDistSq / (2 * 700 * 700));

      // Add ridged noise for the gullies/ridges on the sides
      // Based on angle from center to create vertical ridges
      const angle = Math.atan2(dzV, dxV);
      const ridgeNoise =
        1.0 -
        Math.abs(simplex.noise2D(Math.cos(angle) * 5, Math.sin(angle) * 5));

      // Apply ridges more strongly on the slopes (scaled with sigma)
      const slopeFactor =
        Math.exp(-warpedDistSq / (2 * 560 * 560)) *
        (1.0 - Math.exp(-warpedDistSq / (2 * 140 * 140)));
      vHeight += ridgeNoise * 150 * slopeFactor;

      // Crater Subtraction (Sharper Gaussian)
      const vCrater = 400 * Math.exp(-distSqV / (2 * 80 * 80));

      // Flatten the base terrain near the peak so the crater isn't tilted sideways.
      // This ensures the lava surface can sit level inside the rim.
      const flattenFactor = Math.exp(-distSqV / (2 * 120 * 120));
      n = _lerp(n, 0, flattenFactor);

      n += vHeight - vCrater;

      // Fix glitchy water by preventing extremely shallow shelves at the volcano base.
      if (n > WATER_LEVEL && n < WATER_LEVEL + 1.5) {
        n = WATER_LEVEL;
      }
    }

    // --- VALLEY LAKES (the lake district, west) ---
    // Floods the valley floors of the temperate west, so lakes take the shape
    // of the valleys: long lakes fingering between the hills and ranges, like
    // the English Lake District. Land up to a flood level goes under water
    // and the bank above it eases down to a gentle shore. The flood level
    // varies slowly, so there are lake-filled districts and dry ones. Runs
    // after the mountains and volcano (so the valleys are final) and before
    // the rivers and highway, which still carve their way through.
    if (origX < -3500 && origX > -48000) {
      const westIn = Math.min(1, (-origX - 3500) / 4000);
      const westOut = Math.min(1, (origX + 48000) / 6000);
      const absZ = Math.abs(origZ);
      const band = 1 - Math.min(1, Math.max(0, (absZ - 9000) / 4000));
      const district = cylNoise(origX, (nx, ny) =>
        simplex.noise3D(
          nx * 0.00008 + 4100,
          origZ * 0.00008 + 4100,
          ny * 0.00008 + 4100
        )
      );
      const strength = Math.min(1, Math.max(0, (district + 0.15) / 0.5));
      const floodRise = 150 * westIn * westOut * band * strength;
      if (floodRise > 1) {
        const floodLevel = WATER_LEVEL + floodRise;
        const bank = 60;
        if (n < floodLevel) {
          n = WATER_LEVEL - (floodLevel - n) * 0.6;
        } else if (n < floodLevel + bank) {
          const t = (n - floodLevel) / bank;
          n = WATER_LEVEL + (n - WATER_LEVEL) * t * t * (3 - 2 * t);
        }
      }
    }

    // --- THE DESERT'S SALT PANS ---
    // The desert's inland lakes dry to salt pans (just above the water, dead
    // flat; terrain-gen.js colours them). Away from the sea (biome) the lake
    // floors rise to the pan, so where a lake reaches toward the coast it
    // keeps water at its seaward end, with a smooth shore between. Before
    // the rivers and highway, which still cut through.
    const desert = desertLowlandAt(origX, origZ, simplex);
    if (desert > 0.4) {
      const dry = smoothRamp(biome, -0.08, 0.06) * smoothRamp(desert, 0.4, 0.8);
      if (dry > 0 && n < WATER_LEVEL + SALT_PAN_RISE) {
        n = _lerp(n, WATER_LEVEL + SALT_PAN_RISE, dry);
      }
    }

    // --- RIVER CARVING LOGIC ---
    // Runs after all additive terrain passes (mountains, volcano) so it always wins.
    if (!options.ignoreRivers) {
      const channel = riverChannelAt(x, z, origX, simplex, terrainFrequency);
      let maxRiverFactor = channel.river;
      let maxTributaryFactor = channel.tributary;

      // Tributaries stop at the foot of mountains rather than cutting canyons.
      maxTributaryFactor *= 1 - Math.min(1, Math.max(0, (n - 250) / 200));
      maxRiverFactor = Math.max(maxRiverFactor, maxTributaryFactor);

      if (maxRiverFactor > 0 && n > WATER_LEVEL - 5) {
        // Carve down to well below wave troughs (WATER_LEVEL - 5), but never raise existing seabed
        const riverBed = WATER_LEVEL - 5;
        n = Math.min(n, _lerp(n, riverBed, maxRiverFactor));
      }
    }

    // --- HIGHWAY TRENCH CARVING LOGIC ---
    // GEOGRAPHIC GUARD: the north-south highways only exist on the West
    // Coast (X < 0), and the cross-country one only between ROAD_EW_WEST and
    // ROAD_EW_EAST, so no phantom road canyons are carved elsewhere.
    if (!options.ignoreRoads) {
      if (origX < 0) {
        // The closest north-south highway, found mathematically
        const highwayIndex = Math.min(
          ROAD_LAST,
          Math.max(0, Math.round((origX - ROAD_BASE_X) / ROAD_SPACING))
        );
        if (getRoadCenterX(origZ, highwayIndex) < 0) {
          n = carveRoadTrench(
            n,
            highwayIndex,
            origZ,
            origX,
            simplex,
            constants,
            _lerp
          );
        }
      }
      if (origX > ROAD_EW_WEST && origX < ROAD_EW_EAST) {
        n = carveRoadTrench(
          n,
          ROAD_EW,
          origX,
          origZ,
          simplex,
          constants,
          _lerp
        );
      }
    }

    // --- EASTERN ALIEN BIOME (the eastern land, from about 10 East) ---
    // Basalt honeycomb columns on swirling, domain-warped islands. It rises
    // out of the island sea along the outline's eastLand line (which
    // wanders, with bays and capes), out to the outline's east coast.
    const eastEdge = eastLandLon(-z / 5000, simplex) * 5000;
    if (x > eastEdge) {
      const extremeFactor = Math.min(1.0, (x - eastEdge) / EAST_LAND_RISE);
      const ef = extremeFactor * extremeFactor * (3 - 2 * extremeFactor);

      // Basalt honeycomb: the land is hexagonal columns of different
      // heights, flat-topped, with sheer sides and ravines between them
      // (basaltAt). Whole columns are land or sea, so the swirling coasts
      // (eastLandBase) are stepped out of hexagons.
      const c = basaltAt(x, z, simplex, WATER_LEVEL);
      n = _lerp(n, c.h1 > 0 ? c.h : WATER_LEVEL - 10, ef);

      if (n < WATER_LEVEL - 10) n = WATER_LEVEL - 10;
    }
    // --- WESTERN ALIEN BIOME (from about 10 West, to the west coast) ---
    // Massive geometric stepped plateaus, jagged crystal spires, and deep
    // fractured chasms, from a wandering edge (westAlienEdge) out to the
    // continent's west coast
    else if (x < westAlienEdge(z, simplex)) {
      const extremeFactor = Math.min(
        1.0,
        (westAlienEdge(z, simplex) - x) / 15000
      );
      const ef = extremeFactor * extremeFactor * (3 - 2 * extremeFactor);

      // 1. Stepped Plateaus (Terracing)
      // We quantize the terrain height to create flat tiers
      const terraceHeight = 120;
      let terracedN = Math.floor(n / terraceHeight) * terraceHeight;
      // Smooth the edges of the steps slightly
      const stepAlpha = Math.min(
        1,
        Math.max(0, (n % terraceHeight) / (terraceHeight * 0.1))
      );
      terracedN += stepAlpha * terraceHeight;

      n = _lerp(n, terracedN, ef * 0.8);

      // 2. Giant Crystalline Spires (High-frequency, sharp, tall)
      const spireNoise = cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0015, z * 0.0015, ny * 0.0015)
      );
      if (spireNoise > 0.5) {
        // Square the noise to make the peaks very narrow and sharp
        const spikeHeight = Math.pow((spireNoise - 0.5) * 2.0, 3) * 3000;
        n += spikeHeight * ef;
      }

      // 3. Endless Chasms (Deep, narrow fractures intersecting)
      const chasm1 = Math.abs(
        cylNoise(x, (nx, ny) =>
          simplex.noise3D(nx * 0.0008, z * 0.0008, ny * 0.0008)
        )
      );
      const chasm2 = Math.abs(
        cylNoise(x, (nx, ny) =>
          simplex.noise3D(
            nx * 0.0008 + 100,
            z * 0.0008 + 100,
            ny * 0.0008 + 100
          )
        )
      );
      const minChasm = Math.min(chasm1, chasm2);

      if (minChasm < 0.05) {
        const depth = Math.pow(1.0 - minChasm / 0.05, 3) * 800;
        n -= depth * ef;
      }

      if (n < WATER_LEVEL - 10) n = WATER_LEVEL - 10;
    }

    // Final water level clamp
    if (n < WATER_LEVEL - 10) {
      n = WATER_LEVEL - 10;
    }

    // --- THE CONTINENT'S COASTS ---
    // Across the outline the land gives way to coast (coastDetail), then
    // deep sea (before the ice shelf, which freezes that sea in the north)
    const coastPast = continentPastFar(origX, origZ, simplex);
    const coastIn = coastPast + COAST_BAND / 2 + COAST_BLEND;
    if (coastIn > 0) {
      const t = Math.min(1, (coastPast + COAST_BAND / 2) / COAST_BAND);
      let coastHeight = coastDetail(
        origX,
        origZ,
        Math.max(0, t),
        COAST_OUTLINE,
        simplex,
        WATER_LEVEL,
        40
      );
      // Open sea past the coast
      const deep = Math.min(1, (coastPast - COAST_BAND / 2) / 10000);
      if (deep > 0) coastHeight = _lerp(coastHeight, WATER_LEVEL - 10, deep);
      const b = Math.min(1, coastIn / COAST_BLEND);
      // The coast only cuts into the land, never raises any: where the
      // outline crosses open sea (the island sea), it stays sea
      let coastTarget = Math.min(n, coastHeight);
      // Drowned land on the south coast becomes a shallow shelf
      if (coastSouthness > 0 && n > WATER_LEVEL - 4) {
        const out = (coastPast - SOUTH_SHELF) / 2500;
        const shelf = coastSouthness * Math.max(0, Math.min(1, 1 - out));
        if (shelf > 0) {
          const floor = southShelfFloor(origX, origZ, simplex, WATER_LEVEL);
          coastTarget = _lerp(
            coastTarget,
            Math.max(coastTarget, Math.min(n, floor)),
            shelf * shelf * (3 - 2 * shelf)
          );
        }
      }
      const fade = heartlandFade(origX, origZ);
      n = _lerp(n, coastTarget, b * b * (3 - 2 * b) * fade);
      if (n < WATER_LEVEL - 10) n = WATER_LEVEL - 10;
    }

    // --- THE DESERT LOWLAND ---
    // Dune fields and lone mesas on the desert flats. After the coasts (whose
    // coastal terrain would otherwise replace them across the south), kept
    // off the rivers by the height gates and off the highway.
    if (desert > 0) {
      const road = roadClear(origX, origZ);
      const flats =
        Math.max(0, Math.min(1, (n - WATER_LEVEL - 2) / 10)) *
        Math.max(0, Math.min(1, (220 - n) / 80)) *
        road;
      if (flats > 0) {
        // Dune fields: the hills under them flatten out into a sand sea
        const dunes = duneAt(origX, origZ, simplex);
        if (dunes > 0 && n > WATER_LEVEL + 8) {
          const sea = _duneField * flats * desert;
          n = WATER_LEVEL + 8 + (n - WATER_LEVEL - 8) * (1 - 0.6 * sea);
        }
        n += dunes * flats * desert;
      }
      if (
        desert > 0.5 &&
        road > 0 &&
        n > WATER_LEVEL - 5 &&
        n < 260 &&
        mesaAt(origX, origZ, simplex)
      ) {
        n += _mesa.skirt * _mesa.skirtHeight * road;
        n = Math.max(n, _lerp(n, _mesa.top, _mesa.wall * road));
      }
    }

    // --- THE FAR NORTH'S OUTCROPS ---
    // From about 3 North, tors (steep rock knobs) break through the snow of
    // the low ground, in scattered districts (torAt; terrain-gen.js bares
    // their rock). After the coasts, like the desert's dunes, and kept off
    // the highway.
    const farNorth = smoothRamp(-origZ / 5000, 3, 4);
    if (farNorth > 0 && n > WATER_LEVEL + 3 && n < 260) {
      const tor = torAt(origX, origZ, simplex);
      if (tor > 0) {
        const land = Math.min(1, (n - WATER_LEVEL - 3) / 12);
        n += tor * farNorth * land * roadClear(origX, origZ);
      }
    }

    // --- THE CANYON ---
    // After the coasts, so it stands the same in every continent outline
    const canyon = canyonAt(origX, origZ, simplex, WATER_LEVEL);
    if (canyon) {
      // Outside its core, the plateau only builds on land, and the river's
      // channel only cuts
      const land = Math.max(0, Math.min(1, (n - WATER_LEVEL) / 15));
      const w = canyon.core ? canyon.weight : canyon.weight * land;
      const target =
        canyon.height < n ? canyon.height : _lerp(n, canyon.height, w);
      n = canyon.height < n ? _lerp(n, target, canyon.weight) : target;
    }

    // --- FROZEN NORTH ICE SHELF ---
    let isIceShelf = false;
    // Start freezing around 4°N (Z=-20000), fully frozen ~5000 units later
    const freezeBoundaryZ =
      -20000 +
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.0002, z * 0.0002, ny * 0.0002)
      ) *
        2000;
    // Only the sea past the north coast freezes (seaIceAt), not the land's
    // lakes. Highways see it as sea (forRoad), so they end at the coast.
    if (
      !options.forRoad &&
      z < freezeBoundaryZ &&
      coastPast > 0 &&
      seaIceAt(origX, origZ, coastPast, simplex)
    ) {
      const freezeFactor = Math.min(1, (freezeBoundaryZ - z) / 3000);
      if (freezeFactor > 0) {
        // Create an ice shelf that is strictly above water (WATER_LEVEL + 3 to WATER_LEVEL + 7)
        const targetIceLevel =
          WATER_LEVEL +
          3 +
          Math.abs(
            cylNoise(x, (nx, ny) =>
              simplex.noise3D(nx * 0.0005, z * 0.0005, ny * 0.0005)
            )
          ) *
            4;

        // Instead of lerping the height (which creates a gentle slope that z-fights with waves),
        // we use a noise threshold to create an organic, sharp ice cliff.
        // We use a low-frequency noise (0.0005) so the boundary doesn't alias/flicker on low-LOD chunks.
        const edgeNoise =
          cylNoise(x, (nx, ny) =>
            simplex.noise3D(nx * 0.0005, z * 0.0005, ny * 0.0005)
          ) *
            0.5 +
          0.5; // 0 to 1

        if (freezeFactor > edgeNoise) {
          if (n < targetIceLevel) {
            n = targetIceLevel;
            isIceShelf = true;

            // Arctic pack ice terrain relief: pressure ridges, hummocks, and sastrugi
            // Gives the vast frozen northern shelf natural texture and height variation instead of being flat
            const hummock =
              Math.abs(
                cylNoise(x, (nx, ny) =>
                  simplex.noise3D(nx * 0.0012, z * 0.0012, ny * 0.0012)
                )
              ) * 6.0;
            const ridgeRaw = cylNoise(x, (nx, ny) =>
              simplex.noise3D(
                nx * 0.0028 + 314,
                z * 0.0028 + 159,
                ny * 0.0028 + 314
              )
            );
            const pressureRidge =
              Math.pow(
                Math.max(0, 1.0 - Math.abs(ridgeRaw) - 0.25) / 0.75,
                1.4
              ) * 14.0;
            const sastrugi =
              cylNoise(x, (nx, ny) =>
                simplex.noise3D(nx * 0.006, z * 0.006, ny * 0.006)
              ) * 2.0;

            n += (hummock + pressureRidge + sastrugi) * freezeFactor;
          }
        }
      }
    }

    // East coast beach widening: stretch the slope near the water level to create wider beaches on the continent's coast
    // Restrict to the main continental coastline (x <= 8000, biome >= -0.2) and bypass if ice shelf
    if (
      !isIceShelf &&
      x <= 8000 &&
      biome >= -0.2 &&
      eastCoastFactor > 0 &&
      n > WATER_LEVEL &&
      n < WATER_LEVEL + 15.0
    ) {
      const t = (n - WATER_LEVEL) / 15.0;
      const easedT = Math.pow(t, 1.3);
      n = WATER_LEVEL + easedT * 15.0;
    }

    // Shoreline steepening removed

    // Montauk lighthouse island at chunk 5,2 (world 7500, 3000): raise the
    // terrain to at least WATER_LEVEL + 20 in the center, with an irregular edge.
    // Uses the unwarped coordinates (x and z are domain-warped above).
    const islandDx = origX - 7500;
    const islandDz = origZ - 3000;
    const islandDistSq = islandDx * islandDx + islandDz * islandDz;
    const islandRadius = 400;
    if (islandDistSq < islandRadius * islandRadius) {
      const factor = 1.0 - Math.sqrt(islandDistSq) / islandRadius;
      const sFactor = factor * factor * (3 - 2 * factor); // Smoothstep
      const noise = simplex.noise2D(origX * 0.002, origZ * 0.002) * 0.5 + 0.5; // [0, 1]
      const irregularFactor = sFactor * (0.7 + noise * 0.3);
      n = Math.max(n, WATER_LEVEL + 20 * irregularFactor);
    }

    // Frozen lakes and rivers: north of about 4.4 North (wandering a little),
    // the land's lakes and rivers freeze over, a flat sheet of ice just
    // above the water (terrain-gen.js colours it as ice). Toward open water
    // the ice slopes down under it, so the edge is a smooth, ragged line
    // rather than a step on the terrain grid. Highways still see the water,
    // so their bridges stay.
    if (!options.forRoad && n < WATER_LEVEL + LAKE_ICE_RISE) {
      const lat =
        -origZ / 5000 +
        regionWobble(origX, origZ, simplex, 5) * 0.3 +
        simplex.noise2D(origX * 0.0008 - 21, origZ * 0.0008 + 44) * 0.12;
      const inland =
        (simplex.noise2D(origX * 0.002 + 5, origZ * 0.002) - 0.2) * 800 -
        coastPast;
      const ice = smoothRamp(lat, 4.4, 4.45) * smoothRamp(inland, 0, 250);
      if (ice > 0) n = _lerp(n, WATER_LEVEL + LAKE_ICE_RISE, ice);
    }

    // The falls: after the rivers and the island passes, so nothing cuts
    // into the table mountain
    const [fallsH, fallsW] = fallsAt(origX, origZ, simplex, WATER_LEVEL);
    if (fallsW > 0) n = _lerp(n, fallsH, fallsW);
    n = Math.max(n, fallsSpurAt(origX, origZ, simplex));

    // Airports: the ground inside each airfield is flat at its field height,
    // easing into the surrounding land over AIRPORT_FALLOFF (an island
    // where the field is over water, a plateau where it cuts into hills).
    // Last, so no other pass undoes it.
    if (!options.ignoreAirports) {
      // First their access roads, at their own height across the falloff
      // and on to the highway, in a cutting or on an embankment with sides
      // as wide as it is deep. Not for the highway's own samples (forRoad):
      // its height where the road meets it is where the road ends up.
      if (!options.forRoad) {
        for (let i = 0; i < ACCESS_ROADS.length; i++) {
          const r = ACCESS_ROADS[i];
          const dist = accessRoadDistance(r, origX, origZ);
          if (dist < ACCESS_ROAD_CORE + ACCESS_ROAD_MAX_WALL) {
            const ends = accessRoadEnds(i, simplex, constants, _lerp);
            if (ends && ends.built) {
              const wall = accessRoadWall(r, ends, origX);
              const k =
                1 - smoothRamp(dist, ACCESS_ROAD_CORE, ACCESS_ROAD_CORE + wall);
              if (k > 0) n = _lerp(n, accessRoadGround(r, ends, origX), k);
            }
          }
        }
      }
      for (let i = 0; i < AIRPORTS.length; i++) {
        const a = AIRPORTS[i];
        if (Math.abs(origX - a.x) > 3600 || Math.abs(origZ - a.z) > 3600) {
          continue;
        }
        const dist = airportDistance(a, origX, origZ);
        const h = airportFieldHeight(i, simplex, constants, _lerp);
        if (h !== null) {
          if (dist < AIRPORT_FALLOFF) {
            const t = 1 - dist / AIRPORT_FALLOFF;
            n = _lerp(n, h, t * t * (3 - 2 * t));
          }
          // Clearance corridors extending past the runway ends
          const {u, v} = airportLocal(a, origX, origZ);
          const absU = Math.abs(u);
          if (
            absU > RUNWAY_LENGTH / 2 &&
            absU < RUNWAY_LENGTH / 2 + CORRIDOR_LENGTH
          ) {
            const d = absU - RUNWAY_LENGTH / 2;
            const ceiling = h + d * CORRIDOR_SLOPE;
            if (n > ceiling) {
              const halfWidth = CORRIDOR_BASE_WIDTH + d * CORRIDOR_EXPANSION;
              const absV = Math.abs(v);
              if (absV < halfWidth + CORRIDOR_FALLOFF) {
                const latFactor =
                  1 - smoothRamp(absV, halfWidth, halfWidth + CORRIDOR_FALLOFF);
                const longFactor =
                  1 - smoothRamp(d, CORRIDOR_LENGTH - 500, CORRIDOR_LENGTH);
                n -= (n - ceiling) * latFactor * longFactor;
              }
            }
          }
        }
      }
    }

    return n;
  }

  // --- EXPORTS ---
  exports.customMap = null;
  exports.WORLD_SEED = WORLD_SEED;
  exports.PLANE_TYPES = PLANE_TYPES;
  exports.normalizePlaneType = normalizePlaneType;
  exports.mulberry32 = mulberry32;
  exports.FALLS_X = FALLS_X;
  exports.SPAWN_YAW = SPAWN_YAW;
  exports.spawnYaw = spawnYaw;
  exports.CANYON_PATH = CANYON_PATH;
  exports.canyonRockAt = canyonRockAt;
  exports.CANYON_TIER_HEIGHT = CANYON_TIER_HEIGHT;
  exports.FALLS_Z = FALLS_Z;
  exports.FALLS_LIP_Z = FALLS_LIP_Z;
  exports.FALLS_POND = FALLS_POND;
  exports.fallsValleyX = fallsValleyX;
  exports.fallsSiteAt = fallsSiteAt;
  exports.chunkRng = chunkRng;
  exports.PLANE_COLORS = PLANE_COLORS;
  exports.LIVERY_NAMES = LIVERY_NAMES;
  exports.getPlaneColor = getPlaneColor;
  exports.computeTimeOfDay = computeTimeOfDay;
  exports.computeInputPosition = computeInputPosition;
  exports.computeHeadingDirection = computeHeadingDirection;
  // --- RIVER CENTER ---
  // Returns the absolute Z coordinate of the center of the river at a given X.
  // Updated to take Z and return the center of the nearest river.
  function getRiverCenterZ(x, z, simplex, latIndex = null) {
    const latScale = 5000;
    const l = latIndex !== null ? latIndex : Math.round(z / latScale);
    let baseRiverZ = l * latScale;

    const noiseOffset = l * 12.34;

    // Macro-meander: Massive, slow north/south shifting to break horizontal lines
    // Frequency 0.00002 means a wavelength of 50,000 units. Very smooth.
    const macroMeander =
      cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.00002, noiseOffset + 50, ny * 0.00002)
      ) * 5000;
    baseRiverZ += macroMeander;

    // Squiggle intensity factor: Changes slowly over 20,000 units
    const squiggleFactor =
      (cylNoise(x, (nx, ny) =>
        simplex.noise3D(nx * 0.00005, noiseOffset + 100, ny * 0.00005)
      ) +
        1) *
      0.5; // [0, 1]

    if (l === 0) {
      // Equator river (massive main river)
      const freq1 = 0.0001;
      const amp1 = 1500 + squiggleFactor * 2500; // Large sweeping curves

      const freq2 = 0.0002;
      const amp2 = 500 + squiggleFactor * 800; // Medium detail

      return (
        baseRiverZ +
        cylNoise(x, (nx, ny) => simplex.noise3D(nx * freq1, 0, ny * freq1)) *
          amp1 +
        cylNoise(x, (nx, ny) => simplex.noise3D(nx * freq2, 100, ny * freq2)) *
          amp2
      );
    } else {
      // Additional rivers
      const freq1 = 0.00015;
      const amp1 = 1000 + squiggleFactor * 2000;

      const freq2 = 0.0003;
      const amp2 = 300 + squiggleFactor * 600;

      return (
        baseRiverZ +
        cylNoise(x, (nx, ny) =>
          simplex.noise3D(nx * freq1, noiseOffset, ny * freq1)
        ) *
          amp1 +
        cylNoise(x, (nx, ny) =>
          simplex.noise3D(nx * freq2, noiseOffset + 50, ny * freq2)
        ) *
          amp2
      );
    }
  }

  // --- ANGLE INTERPOLATION ---
  function lerpAngle(a, b, t) {
    let diff = (b - a) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return a + diff * t;
  }

  // --- WEST COAST HIGHWAY ---
  // Returns the X coordinate of the road center for a given Z position.
  // The road winds along the west coast using layered simplex noise.
  const ROAD_BASE_X = -5000; // Base X position (center of 0.5W and 1.5W)
  const ROAD_SPACING = -10000; // 2 degrees West
  // The westmost highway (n = 7, 15W). Past it the west coast breaks up into
  // archipelago and open ocean, where a highway would be a bridge to nowhere.
  const ROAD_LAST = 7;
  // Highways bridge water up to this long between land along them, so they
  // cross lakes and inlets but end at an open-sea coast (highwayRunsAt)
  const ROAD_MAX_BRIDGE = 6000;
  // and skip stretches with less land than this, so a few islets out at sea
  // don't get a road of their own
  const ROAD_MIN_LAND = 3000;
  const ROAD_WIDTH = 30; // Half-width of the paved road surface
  const ROAD_SHOULDER = 10; // Width of the shoulder/blend zone on each side

  // Highways always follow the default world noise, even when getElevation()
  // is given another noise instance (e.g. the map export page's custom seed).
  // noise.js registers it via setRoadNoise() when it loads, since it can't be
  // imported here without a cycle.
  let roadNoise = null;
  exports.setRoadNoise = (noise) => {
    roadNoise = noise;
  };

  function getRoadSweepOffset(z, n = 0) {
    // --- VOLCANO AVOIDANCE (CONTINUOUS DOMAIN WARPING) ---
    // The volcano is located exactly at X = -5000, Z = 5000.
    // Instead of a radial repulsion field (which creates a massive teleportation discontinuity if the road crosses X=-5000),
    // we smoothly warp the base sweep noise to steer the road predictably East (X = -2500) as it approaches Z = 5000.
    const VOLCANO_Z = 5000;
    const AVOID_Z_RADIUS = 3000; // Start veering 3000 units north/south of the volcano

    // Offset Z significantly based on highway index 'n' to ensure each highway is totally unique
    const zNoise = z + n * 99999;

    let baseSweep = roadNoise.noise2D(zNoise * 0.0001, 777);
    let detailAmplitude = 500;

    // Only apply volcano avoidance to highway n = 0
    if (n === 0) {
      const distZ = Math.abs(z - VOLCANO_Z);
      if (distZ < AVOID_Z_RADIUS) {
        const t = 1.0 - distZ / AVOID_Z_RADIUS;
        const avoidFactor = t * t * (3 - 2 * t); // Smoothstep

        // Force the base sweep towards +1.0 (East) using the smooth factor
        baseSweep = (1 - avoidFactor) * baseSweep + avoidFactor * 1.0;

        // Suppress medium wobbles near the volcano so they don't accidentally swing the road back in
        detailAmplitude = (1 - avoidFactor) * 500 + avoidFactor * 100;
      }
    }

    // Layer 1: Large sweeping curves
    // Amplified to 2500 so it swings +/- 2500
    const sweep = baseSweep * 2500;

    // Layer 2: Medium detail curves (wavelength ~3,000 units)
    const detail = roadNoise.noise2D(zNoise * 0.0003, 888) * detailAmplitude;

    // Layer 3: Small wobbles (wavelength ~1,000 units)
    const wobble = roadNoise.noise2D(zNoise * 0.001, 999) * 100;

    return sweep + detail + wobble;
  }

  function getRoadCenterX(z, n = 0) {
    const x = ROAD_BASE_X + n * ROAD_SPACING + getRoadSweepOffset(z, n);
    // Past an airport's access road, the highway runs straight north-south
    // through the road's end, bending back to its own course further out
    for (let i = 0; i < ACCESS_ROADS.length; i++) {
      const r = ACCESS_ROADS[i];
      if (r.n !== n) continue;
      const dz = Math.abs(z - r.z);
      if (dz < ACCESS_ROAD_STRAIGHT + ACCESS_ROAD_BEND) {
        const t = smoothRamp(
          dz,
          ACCESS_ROAD_STRAIGHT,
          ACCESS_ROAD_STRAIGHT + ACCESS_ROAD_BEND
        );
        return r.x1 + (x - r.x1) * t;
      }
    }
    return x;
  }

  // --- THE CROSS-COUNTRY HIGHWAY ---
  // Highway ROAD_EW runs east-west across the continent, crossing all the
  // north-south ones: the same winding course as theirs with x and z
  // swapped, about ROAD_EW_BASE_Z (0.3° S), between ROAD_EW_WEST and
  // ROAD_EW_EAST, where it meets Meadow Field's access road (where it runs
  // inside that is up to highwayRunsAt)
  const ROAD_EW = ROAD_LAST + 1;
  const ROAD_EW_BASE_Z = 1500;
  const ROAD_EW_WEST = ROAD_BASE_X + ROAD_LAST * ROAD_SPACING - 5000;

  // Places the road keeps clear of: the volcano (X -5000, Z 5000) and the
  // airports near its line. Within 2,500 units (in x) of one, the road keeps
  // at least `clear` north or south of it (whichever side its line is on),
  // easing in from 7,000 units out rather than turning sharply.
  const ROAD_EW_OBSTACLES = [
    {x: -5000, z: 5000, clear: 2700},
    ...AIRPORTS.filter(
      (a) => !a.crossCountry && Math.abs(a.z - ROAD_EW_BASE_Z) < 6000
    ).map((a) => ({x: a.x, z: a.z, clear: 1300})),
  ];

  function getRoadCenterZ(x) {
    let z = ROAD_EW_BASE_Z + getRoadSweepOffset(x, ROAD_EW);
    for (const o of ROAD_EW_OBSTACLES) {
      const near = 1 - smoothRamp(Math.abs(x - o.x), 2500, 7000);
      if (near === 0) continue;
      // How far past the limit, smoothed so the bend has no corner
      const side = o.z > ROAD_EW_BASE_Z ? 1 : -1;
      const over = (z - o.z) * side + o.clear;
      const excess = 0.5 * (over + Math.sqrt(over * over + 500 * 500));
      z -= excess * near * side;
    }
    // Toward its east end it runs straight into Meadow Field's access road,
    // the way the north-south ones run past theirs
    const t = smoothRamp(
      ROAD_EW_EAST - x,
      ACCESS_ROAD_STRAIGHT,
      ACCESS_ROAD_STRAIGHT + ACCESS_ROAD_BEND
    );
    return MEADOW_ROAD.z + (z - MEADOW_ROAD.z) * t;
  }

  // A highway's line, for code that handles them all alike: `along` is the
  // coordinate it runs along (z for the north-south ones, x for ROAD_EW) and
  // roadCenter gives the other one, `across`, at its centre
  function roadCenter(n, along) {
    return n === ROAD_EW ? getRoadCenterZ(along) : getRoadCenterX(along, n);
  }

  // The world point (out.x, out.z) at `along`, `across` on road n
  function roadPoint(n, along, across, out = {}) {
    out.x = n === ROAD_EW ? along : across;
    out.z = n === ROAD_EW ? across : along;
    return out;
  }
  const _roadXZ = {x: 0, z: 0};

  // --- WHERE THE HIGHWAYS RUN ---
  // Land or water along highway n on a 500-unit grid fixed in its `along`, so
  // every chunk and map tile agrees; cached per seed
  const ROUTE_STEP = 500;
  const routeLand = new Map();
  const routeOn = new Map();
  let routeSeed = null;

  function routeLandAt(n, k, simplex, constants) {
    const key = n * 1e7 + k;
    let land = routeLand.get(key);
    if (land === undefined) {
      const along = k * ROUTE_STEP;
      const p = roadPoint(n, along, roadCenter(n, along));
      land =
        (n !== ROAD_EW || (along > ROAD_EW_WEST && along < ROAD_EW_EAST)) &&
        getElevation(p.x, p.z, simplex, constants, null, {
          ignoreRivers: true,
          ignoreRoads: true,
          forRoad: true,
        }) > constants.WATER_LEVEL;
      routeLand.set(key, land);
    }
    return land;
  }

  // Is grid point k on highway n's route: on land, or on a bridge of at most
  // ROAD_MAX_BRIDGE between land, with at least ROAD_MIN_LAND of land along
  // the stretch it belongs to?
  function routeOnAt(n, k, simplex, constants) {
    const key = n * 1e7 + k;
    let on = routeOn.get(key);
    if (on !== undefined) return on;
    const land = (j) => routeLandAt(n, j, simplex, constants);
    const maxWater = ROAD_MAX_BRIDGE / ROUTE_STEP;
    const minLand = ROAD_MIN_LAND / ROUTE_STEP;
    // Water samples between land north and south, counting k itself
    let water = 0;
    if (!land(k)) {
      water = 1;
      for (const dir of [-1, 1]) {
        let j = k + dir;
        while (!land(j) && water <= maxWater) {
          water++;
          j += dir;
        }
      }
    }
    on = water <= maxWater;
    if (on) {
      // Count land out along the stretch both ways, as far as it's bridged
      let count = land(k) ? 1 : 0;
      for (const dir of [-1, 1]) {
        let run = 0;
        for (let j = k + dir; count < minLand && run <= maxWater; j += dir) {
          if (land(j)) {
            count++;
            run = 0;
          } else {
            run++;
          }
        }
      }
      on = count >= minLand;
    }
    if (routeOn.size > 200000) routeOn.clear();
    routeOn.set(key, on);
    return on;
  }

  // Does highway n run at `along` (see roadCenter)? Out to the grid point
  // past the last on the route, so it ends just past the shore; but the
  // cross-country one stops at ROAD_EW_END, where Meadow Field's access road
  // carries on.
  function highwayRunsAt(n, along, simplex, constants) {
    if (n === ROAD_EW && along > ROAD_EW_END) return false;
    if (routeSeed !== exports.WORLD_SEED || routeLand.size > 200000) {
      routeLand.clear();
      routeOn.clear();
      routeSeed = exports.WORLD_SEED;
    }
    const k = Math.floor(along / ROUTE_STEP);
    return (
      routeOnAt(n, k, simplex, constants) ||
      routeOnAt(n, k + 1, simplex, constants)
    );
  }

  // The highway deck's height over ground of natural height naturalH: a
  // gentler version of the land, kept above the water and below the peaks
  // (where it cuts a trench)
  function highwayHeight(naturalH, waterLevel) {
    const low = waterLevel + 60;
    const y = low + (naturalH - low) * 0.35;
    return Math.min(MAX_HIGHWAY_HEIGHT, Math.max(low, y));
  }

  // --- AIRPORT ACCESS ROADS ---
  // From the end of the apron (airports.js), straight along x to the
  // nearest highway, which runs straight past its end (getRoadCenterX) clear
  // of the airfield. The road is flat at the field height across the field,
  // then climbs or falls evenly to the highway's height, the ground cut and
  // filled to it (getElevation).
  const ACCESS_ROAD_WIDTH = 8; // Half-width of the paved road
  const ACCESS_ROAD_CORE = 60; // The ground is at the road's height out to here
  // Then eases back to the land over 200, plus 1.5 per unit of cut or fill
  const ACCESS_ROAD_MAX_WALL = 1000;
  // How far it climbs or falls to the highway, past the airfield's falloff
  // (which keeps the highway this far clear of it, too)
  const ACCESS_ROAD_GRADE = 600;
  // The highway is straight this far north and south of the road, and bends
  // back to its course over the next ACCESS_ROAD_BEND
  const ACCESS_ROAD_STRAIGHT = 1000;
  const ACCESS_ROAD_BEND = 7000;
  // Where the road starts: the apron's end and middle, in the airport frame
  const APRON_END_U = 85;
  const APRON_MID_V = 48;
  const ACCESS_ROADS = [];
  AIRPORTS.forEach((a, index) => {
    if (!a.access) return;
    const c = Math.cos(a.angle);
    const s = Math.sin(a.angle);
    const u = APRON_END_U * (a.access * c < 0 ? -1 : 1);
    const x0 = a.x + u * c - APRON_MID_V * s;
    const z = a.z + u * s + APRON_MID_V * c;
    // Where the road leaves the flat field, and its falloff (where the road
    // starts to climb or fall to the highway: the falloff only eases the
    // ground toward the field height, so a road falling away from the field
    // would end up under it)
    let xEdge = x0;
    while (airportDistance(a, xEdge, z) === 0) xEdge += a.access;
    let xGrade = xEdge;
    while (airportDistance(a, xGrade, z) < AIRPORT_FALLOFF) {
      xGrade += a.access;
    }
    const x1 = xGrade + a.access * ACCESS_ROAD_GRADE;
    ACCESS_ROADS.push({
      index,
      crossCountry: !!a.crossCountry,
      n: a.crossCountry
        ? ROAD_EW
        : Math.min(
            ROAD_LAST,
            Math.max(0, Math.round((x1 - ROAD_BASE_X) / ROAD_SPACING))
          ),
      z,
      x0,
      x1,
      xEdge,
      xGrade,
      minX: Math.min(x0, x1),
      maxX: Math.max(x0, x1),
    });
  });

  const MEADOW_ROAD = ACCESS_ROADS.find((r) => r.n === ROAD_EW);
  const ROAD_EW_EAST = MEADOW_ROAD.x1;
  // Where its deck ends, at the start of Meadow Field's access road
  // (airports.js createAccessRoad)
  const ROAD_EW_END = ROAD_EW_EAST + ROAD_WIDTH + 1;

  // How far (x, z) is from an access road's centre line
  function accessRoadDistance(r, x, z) {
    const dz = Math.abs(z - r.z);
    if (dz >= ACCESS_ROAD_CORE + ACCESS_ROAD_MAX_WALL) return Infinity;
    const dx = x < r.minX ? r.minX - x : x > r.maxX ? x - r.maxX : 0;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // Whether (x, z) is on a built access road, plus margin: props stay off it
  function isOnAccessRoad(x, z, margin, simplex, constants) {
    for (let i = 0; i < ACCESS_ROADS.length; i++) {
      const dist = accessRoadDistance(ACCESS_ROADS[i], x, z);
      if (
        dist <= ACCESS_ROAD_WIDTH + margin &&
        accessRoadEnds(i, simplex, constants)?.built
      ) {
        return true;
      }
    }
    return false;
  }

  // An access road's heights at each end: the airfield's, and the highway
  // deck's where it meets the road; whether it's built (not where it would
  // cross open water: an island airfield keeps to itself, except Meadow
  // Field, the cross-country highway's end); and how deep it
  // cuts into or stands over the land, every ACCESS_ROAD_SAMPLE along it.
  // Cached like airportFieldHeight, and null while being worked out.
  const ACCESS_ROAD_SAMPLE = 20;
  const _accessRoadEnds = new WeakMap();
  function accessRoadEnds(i, simplex, constants, lerp) {
    const signature = simplex.noise2D(0.123, 0.456);
    let cache = _accessRoadEnds.get(simplex);
    if (!cache || cache.signature !== signature) {
      cache = {signature, ends: []};
      _accessRoadEnds.set(simplex, cache);
    }
    const ends = cache.ends;
    if (ends[i] === undefined) {
      ends[i] = null;
      const r = ACCESS_ROADS[i];
      const field = airportFieldHeight(r.index, simplex, constants, lerp);
      if (field === null) {
        ends[i] = undefined;
        return null;
      }
      const natural = getElevation(r.x1, r.z, simplex, constants, lerp, {
        ignoreRivers: true,
        ignoreRoads: true,
        forRoad: true,
      });
      const water = constants.WATER_LEVEL || 40;
      const e = {field, highway: highwayHeight(natural, water), built: true};
      const count = Math.ceil((r.maxX - r.minX) / ACCESS_ROAD_SAMPLE) + 1;
      e.depth = new Float32Array(count);
      for (let k = 0; k < count; k++) {
        const x = r.minX + k * ACCESS_ROAD_SAMPLE;
        const land = getElevation(x, r.z, simplex, constants, lerp, {
          ignoreRivers: true,
          ignoreRoads: true,
          forRoad: true,
        });
        const outside = (x - r.xEdge) * Math.sign(r.x1 - r.x0) > 0;
        // Meadow Field's road is the cross-country highway's end, so it's
        // always built, on a causeway where it crosses water
        if (outside && land < water + 1 && !r.crossCountry) e.built = false;
        e.depth[k] = Math.abs(land - accessRoadGround(r, e, x));
      }
      ends[i] = e;
    }
    return ends[i];
  }

  // How wide an access road's cutting or embankment sides are at x
  function accessRoadWall(r, ends, x) {
    const k = Math.round((x - r.minX) / ACCESS_ROAD_SAMPLE);
    const depth = ends.depth[Math.max(0, Math.min(ends.depth.length - 1, k))];
    return Math.min(ACCESS_ROAD_MAX_WALL, 200 + depth * 1.5);
  }

  // The access road's line at x: the field height across the field and its
  // falloff, then an even grade to the highway's height at its edge
  function accessRoadLine(r, ends, x) {
    const edge = r.x1 - Math.sign(r.x1 - r.x0) * (ROAD_WIDTH + 2);
    const t = Math.max(0, Math.min(1, (x - r.xGrade) / (edge - r.xGrade)));
    return ends.field + (ends.highway - ends.field) * t;
  }

  // The ground under it: past the field, it sinks 1.5 below the line over
  // 60 units, so the terrain mesh (straight between its vertices, up to 75
  // apart) stays under the deck where the grade bends, and the highway
  // isn't lifted where it crosses (as on its own trench floor)
  function accessRoadGround(r, ends, x) {
    const past = (x - r.xEdge) * Math.sign(r.x1 - r.x0);
    return accessRoadLine(r, ends, x) - 1.5 * smoothRamp(past, 0, 60);
  }

  // The top of its deck: just above the line, rising a little more over
  // its last 60 units to meet the top of the highway's deck at its edge
  function accessRoadDeck(r, ends, x) {
    const beforeHighway = Math.abs(r.x1 - x) - ROAD_WIDTH - 2;
    return (
      accessRoadLine(r, ends, x) +
      0.75 -
      0.35 * smoothRamp(beforeHighway, 0, 60)
    );
  }

  function sampleRoadSegment(
    seg,
    x,
    z,
    out,
    vehicleY = null,
    sampleState = null
  ) {
    const dx = seg.x1 - seg.x0;
    const dz = seg.z1 - seg.z0;
    const lengthSq = dx * dx + dz * dz;
    const length = Math.sqrt(lengthSq);
    const halfWidth = ROAD_WIDTH + 2;
    const along = ((x - seg.x0) * dx + (z - seg.z0) * dz) / lengthSq;
    const pad = halfWidth / length;
    if (along < -pad || along > 1 + pad) return false;
    const t = Math.min(1, Math.max(0, along));
    const across = Math.hypot(x - (seg.x0 + dx * t), z - (seg.z0 + dz * t));
    if (across > halfWidth) return false;

    const grade = (seg.y1 - seg.y0) / length;
    const height =
      seg.y0 + (seg.y1 - seg.y0) * t + 0.75 * Math.sqrt(1 + grade * grade);
    const slopeX = (grade * dx) / length;
    const slopeZ = (grade * dz) / length;
    const isInside = along >= 0 && along <= 1;

    if (vehicleY !== null && sampleState) {
      const dist = Math.abs(height - vehicleY);
      if (sampleState.found) {
        if (
          !sampleState.bestInside &&
          isInside &&
          dist < sampleState.bestDist + 5
        ) {
          // Upgrade to interior segment match
        } else if (
          sampleState.bestInside &&
          !isInside &&
          sampleState.bestDist < dist + 5
        ) {
          return false;
        } else if (dist >= sampleState.bestDist) {
          return false;
        }
      }
      sampleState.bestDist = dist;
      sampleState.bestInside = isInside;
    } else if (sampleState && sampleState.found && height <= out.height) {
      return false;
    }

    out.height = height;
    out.slopeX = slopeX;
    out.slopeZ = slopeZ;
    // Which side of the centre line, and the way across the road (unit
    // normal), for keeping the buggy inside a bridge's railings
    out.normalX = -dz / length;
    out.normalZ = dx / length;
    out.across =
      (x - (seg.x0 + dx * t)) * out.normalX +
      (z - (seg.z0 + dz * t)) * out.normalZ;
    out.rails = !!seg.rails;
    if (sampleState) sampleState.found = true;
    return true;
  }

  // Distance from (x, z) to the nearest highway's centre line, measured
  // square to the road (getRoadFactor measures straight along x or z, which
  // reads too far wherever the road runs at an angle), capped at 150: plenty
  // for keeping things off the road. The roads turn up to about 70° off
  // their axis (a slope of 2.5), so 400 along the axis is always past that.
  function highwayDistance(x, z) {
    let dist = 150;
    const n = Math.round((x - ROAD_BASE_X) / ROAD_SPACING);
    // The neighbouring highways too: one can swing past the halfway line
    for (let m = n - 1; m <= n + 1; m++) {
      if (m < 0 || m > ROAD_LAST) continue;
      const off = Math.abs(x - getRoadCenterX(z, m));
      if (off >= 400) continue;
      const slope = (getRoadCenterX(z + 2, m) - getRoadCenterX(z - 2, m)) / 4;
      dist = Math.min(dist, off / Math.hypot(1, slope));
    }
    if (x > ROAD_EW_WEST && x < ROAD_EW_EAST) {
      const off = Math.abs(z - getRoadCenterZ(x));
      if (off < 400) {
        const slope = (getRoadCenterZ(x + 2) - getRoadCenterZ(x - 2)) / 4;
        dist = Math.min(dist, off / Math.hypot(1, slope));
      }
    }
    return dist;
  }

  // Returns a [0, 1] factor indicating how much a point is on the road.
  // 1.0 = fully on road, 0.0 = outside road + shoulder.
  function getRoadFactor(x, z) {
    // Determine the closest highway index `n` mathematically.
    // The road is at ROAD_BASE_X + n * ROAD_SPACING + sweep.
    // We can estimate `n` by ignoring the sweep first (which is max +/- 3000).
    const n = Math.round((x - ROAD_BASE_X) / ROAD_SPACING);
    let dist = Infinity;
    // Now get the exact center X of the closest highway
    if (n >= 0 && n <= ROAD_LAST) dist = Math.abs(x - getRoadCenterX(z, n));
    // And the cross-country one
    if (x > ROAD_EW_WEST && x < ROAD_EW_EAST) {
      dist = Math.min(dist, Math.abs(z - getRoadCenterZ(x)));
    }

    if (dist <= ROAD_WIDTH) {
      return 1.0;
    } else if (dist <= ROAD_WIDTH + ROAD_SHOULDER) {
      // Smooth shoulder falloff
      const t = (dist - ROAD_WIDTH) / ROAD_SHOULDER;
      return 1.0 - t * t * (3 - 2 * t); // Smoothstep
    }
    return 0.0;
  }

  exports.getBiome = getBiome;
  exports.SNOW_START_LAT = SNOW_START_LAT;
  exports.SNOW_FULL_LAT = SNOW_FULL_LAT;
  exports.FALL_START_LAT = FALL_START_LAT;
  exports.FALL_FULL_LAT = FALL_FULL_LAT;
  exports.FALL_BARE_LAT = FALL_BARE_LAT;
  exports.fallTurnAt = fallTurnAt;
  exports.fallBareAt = fallBareAt;
  exports.snowFactorAt = snowFactorAt;
  exports.CONTINENT_NAMES = CONTINENTS.map((c) => c.name);
  exports.snowNoiseShift = snowNoiseShift;
  exports.snowWobble = snowWobble;
  exports.desertShift = desertShift;
  exports.SALT_PAN_RISE = SALT_PAN_RISE;
  exports.LAKE_ICE_RISE = LAKE_ICE_RISE;
  exports.alienAt = alienAt;
  exports.basaltColumnAt = basaltColumnAt;
  exports.MAP_WIDTH = MAP_WIDTH;
  exports.getElevation = getElevation;
  exports.getRiverCenterZ = getRiverCenterZ;
  exports.getRiverFlow = getRiverFlow;
  exports.getRoadCenterX = getRoadCenterX;
  exports.getRoadCenterZ = getRoadCenterZ;
  exports.roadCenter = roadCenter;
  exports.roadPoint = roadPoint;
  exports.ROAD_EW = ROAD_EW;
  exports.ROAD_EW_BASE_Z = ROAD_EW_BASE_Z;
  exports.ROAD_EW_WEST = ROAD_EW_WEST;
  exports.ROAD_EW_EAST = ROAD_EW_EAST;
  exports.ROAD_EW_END = ROAD_EW_END;
  exports.AIRPORTS = AIRPORTS;
  exports.RUNWAY_LENGTH = RUNWAY_LENGTH;
  exports.RUNWAY_WIDTH = RUNWAY_WIDTH;
  exports.airportLocal = airportLocal;
  exports.isOnAirport = isOnAirport;
  exports.airportDistance = airportDistance;
  exports.getRoadFactor = getRoadFactor;
  exports.highwayDistance = highwayDistance;
  exports.highwayHeight = highwayHeight;
  exports.ACCESS_ROADS = ACCESS_ROADS;
  exports.ACCESS_ROAD_WIDTH = ACCESS_ROAD_WIDTH;
  exports.isOnAccessRoad = isOnAccessRoad;
  exports.accessRoadEnds = accessRoadEnds;
  exports.accessRoadDeck = accessRoadDeck;
  exports.sampleRoadSegment = sampleRoadSegment;
  exports.ROAD_BASE_X = ROAD_BASE_X;
  exports.ROAD_SPACING = ROAD_SPACING;
  exports.ROAD_LAST = ROAD_LAST;
  exports.highwayRunsAt = highwayRunsAt;
  exports.ROAD_WIDTH = ROAD_WIDTH;
  exports.ROAD_SHOULDER = ROAD_SHOULDER;
  exports.lerpAngle = lerpAngle;

  // Export centralized URL parameters
  exports.urlParams = urlParams;
  exports.THEME = THEME;
  exports.SHOW_CLOUDS = SHOW_CLOUDS;
  exports.START_CLOUD_COVER = START_CLOUD_COVER;
  exports.START_CLOUD_HEIGHT = START_CLOUD_HEIGHT;
  exports.START_CLOUD_SPEED = START_CLOUD_SPEED;

  exports.SHOW_OBJECTS = SHOW_OBJECTS;
  exports.setShowObjects = (val) => {
    exports.SHOW_OBJECTS = val;
  };
  exports.MAP_NAME = MAP_NAME;
  exports.PALETTE_INDEX = PALETTE_INDEX;
  exports.SCALE = SCALE;
  exports.parsedLat = parsedLat;
  exports.parsedLon = parsedLon;
  exports.parsedAlt = validAlt;
  exports.START_FREE_CAM = START_FREE_CAM;
  exports.START_X = START_X;
  exports.START_Y = START_Y;
  exports.START_Z = START_Z;
  exports.START_HEADING = START_HEADING;
  exports.START_PITCH = START_PITCH;
  exports.START_SPEED = START_SPEED;
  exports.START_TOD = START_TOD;
  exports.START_TIME_SPEED = START_TIME_SPEED;
  exports.START_WEATHER = START_WEATHER;
  exports.START_PROP_LOD = START_PROP_LOD;
  exports.START_DEBUG = START_DEBUG;
  exports.START_AUTOPILOT = START_AUTOPILOT;
  exports.START_MINIMAP = START_MINIMAP;
  exports.START_FULLSCREEN_MAP = START_FULLSCREEN_MAP;
  exports.parsedMapLat = parsedMapLat;
  exports.parsedMapLon = parsedMapLon;
  // [lat, long] in degrees from ?waypoint=, or null
  exports.WAYPOINT =
    parsedWaypoint && parsedWaypoint.every(Number.isFinite)
      ? parsedWaypoint
      : null;
  exports.START_MAP_X = START_MAP_X;
  exports.START_MAP_Z = START_MAP_Z;
  exports.START_MAP_ZOOM = START_MAP_ZOOM;
  exports.START_BENCHMARK = START_BENCHMARK;
  exports.ADAPTIVE_QUALITY = ADAPTIVE_QUALITY;
  exports.TRAFFIC_PARAM = TRAFFIC_PARAM;
  exports.ROOM_PARAM = ROOM_PARAM;
  exports.RELAY_PARAM = RELAY_PARAM;
  exports.GRAPHICS_PRESET = GRAPHICS_PRESET;
  exports.MAX_FPS = MAX_FPS;
  exports.ZENITH_COLOR = ZENITH_COLOR;
  exports.HORIZON_COLOR = HORIZON_COLOR;
  exports.DAY_COLOR = DAY_COLOR;
  exports.START_NOW = START_NOW;
  exports.SHOW_UI = SHOW_UI;
  exports.MUSIC_PARAM = MUSIC_PARAM;
  exports.SFX_PARAM = SFX_PARAM;
  exports.SHOW_TIPS = SHOW_TIPS;
  exports.START_ISLAND_TYPE = START_ISLAND_TYPE;
  exports.FORCE_ISLAND_TYPE = START_ISLAND_TYPE;
  exports.getIslandArchetype = getIslandArchetype;
  exports.START_PLANE = START_PLANE;
  exports.START_CAMERA = START_CAMERA;
  exports.START_CAM_OFFSET = START_CAM_OFFSET;
  exports.START_CAM_LOOK = START_CAM_LOOK;
  exports.START_CAM_ANGLE = START_CAM_ANGLE;
  exports.START_FOV = START_FOV;
  exports.START_HEADLIGHT = START_HEADLIGHT;
  exports.START_ROLL = START_ROLL;
  exports.START_CAM_X = START_CAM_X;
  exports.START_CAM_Y = START_CAM_Y;
  exports.START_CAM_Z = START_CAM_Z;
  exports.START_CAM_HEADING = START_CAM_HEADING;
  exports.START_CAM_PITCH = START_CAM_PITCH;
  exports.HAS_CAM_PLACEMENT = HAS_CAM_PLACEMENT;
  exports.START_CLOCK = START_CLOCK;
  exports.START_CLOUD_TIME = START_CLOUD_TIME;
  exports.START_CLOUD_MOOD = START_CLOUD_MOOD;
  exports.CLOUD_MOOD_NAMES = CLOUD_MOOD_NAMES;
  exports.cloudMoodForDay = cloudMoodForDay;
  exports.START_LIVERY = START_LIVERY;
  exports.PLANE_TYPES = PLANE_TYPES;
  const MAX_DIVE_ANGLE = -(75 * Math.PI) / 180;
  const MAX_CLIMB_ANGLE = (75 * Math.PI) / 180;
  exports.MAX_DIVE_ANGLE = MAX_DIVE_ANGLE;
  exports.MAX_CLIMB_ANGLE = MAX_CLIMB_ANGLE;

  // --- FLIGHT AERODYNAMICS ---
  // Calculates the updated pitch, roll, and yaw for the airplane.
  // Uses frame-rate independent exponential smoothing.
  function computeFlightRotation({
    currentPitch,
    currentRoll,
    currentYaw,
    targetPitch,
    targetRoll,
    turningRoll,
    isBarrelRolling,
    isLooping,
    isClampedRoll,
    turnSpeed,
    delta,
    yawMultiplier = 1.0,
    manualYaw = 0,
    minPitch = MAX_DIVE_ANGLE,
    maxPitch = MAX_CLIMB_ANGLE,
  }) {
    let newPitch = currentPitch;
    let newRoll = currentRoll;
    let newYaw = currentYaw;

    // Helper: Wrap angle to [-PI, PI] range
    const wrapAngle = (angle, target) => {
      let wrapped = angle;
      while (wrapped > target + Math.PI) wrapped -= 2 * Math.PI;
      while (wrapped < target - Math.PI) wrapped += 2 * Math.PI;
      return wrapped;
    };

    // Frame-rate independent exponential decay: 1 - exp(-k * dt)
    // TURN_SPEED in game.js is historically applied at 60fps, so we multiply delta by 60
    const smoothingFactor = 1.0 - Math.exp(-turnSpeed * 60 * delta);

    if (!isLooping) {
      newPitch = wrapAngle(newPitch, targetPitch);
      newPitch = newPitch + (targetPitch - newPitch) * smoothingFactor;
      if (minPitch !== undefined) newPitch = Math.max(minPitch, newPitch);
      if (maxPitch !== undefined) newPitch = Math.min(maxPitch, newPitch);
    }

    if (!isBarrelRolling) {
      newRoll = wrapAngle(newRoll, targetRoll);
      newRoll = newRoll + (targetRoll - newRoll) * smoothingFactor;
    }

    // Yaw logic
    let safeTurningRoll = turningRoll;
    if (isBarrelRolling && !isClampedRoll) {
      safeTurningRoll = 0;
    }
    // Prevent wildly sharp yawing when the plane is upside down
    safeTurningRoll = Math.max(-Math.PI, Math.min(Math.PI, safeTurningRoll));

    const turnFactor = 0.025;
    newYaw +=
      (safeTurningRoll * yawMultiplier + manualYaw) * turnFactor * delta * 60;

    return {pitch: newPitch, roll: newRoll, yaw: newYaw};
  }

  exports.computeFlightRotation = computeFlightRotation;

  // --- FOG DENSITY ---
  // Exponential-squared fog density for the current conditions (issue #72).
  // Each condition sets a floor and the thickest one wins, so e.g. an
  // overcast morning isn't doubly foggy. Tuned from in-game screenshots:
  // clear noon 0.00005, clear 07:00 0.00011, overcast (0.8) 0.00015, rain
  // 0.0002.
  const FOG = {
    CLEAR: 0.00005, // clear sky, midday
    MORNING_EXTRA: 0.00006, // morning fog added on top of CLEAR
    OVERCAST: 0.000175, // full cloud cover
    PRECIP: 0.0002, // full rain or snow
    AFTER_RAIN: 0.00016, // mist right after precipitation stops
    AFTER_RAIN_FADE_SECONDS: 40, // mist time constant (~gone after 2 min)
    // Morning fog (hours, 0-24): builds from START to FULL, holds until
    // BURN_OFF, and is gone by CLEAR_BY.
    MORNING_START: 4,
    MORNING_FULL: 5.5,
    MORNING_BURN_OFF: 7.5,
    MORNING_CLEAR_BY: 10,
  };

  function smoothstep01(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  // 0..1: how much morning fog there is at `hour` (0-24).
  function morningFogFactor(hour) {
    const rise = smoothstep01(FOG.MORNING_START, FOG.MORNING_FULL, hour);
    const burn = smoothstep01(FOG.MORNING_BURN_OFF, FOG.MORNING_CLEAR_BY, hour);
    return rise * (1 - burn);
  }

  // conditions: {overcast 0..1, precipIntensity 0..1, hour 0-24,
  // afterRain 0..1 (lingering mist, 1 = rain just stopped), clearDensity
  // (optional override for FOG.CLEAR, e.g. from the debug fog slider)}
  function computeFogDensity({
    overcast = 0,
    precipIntensity = 0,
    hour = 12,
    afterRain = 0,
    clearDensity = FOG.CLEAR,
  }) {
    const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
    const morning = clearDensity + FOG.MORNING_EXTRA * morningFogFactor(hour);
    const clouds = lerp(clearDensity, FOG.OVERCAST, overcast);
    const precip = lerp(clearDensity, FOG.PRECIP, precipIntensity);
    const mist = lerp(clearDensity, FOG.AFTER_RAIN, afterRain);
    return Math.max(clearDensity, morning, clouds, precip, mist);
  }

  exports.FOG = FOG;
  exports.morningFogFactor = morningFogFactor;
  exports.computeFogDensity = computeFogDensity;

  // --- WEATHER ---
  // Clouds and precipitation at (x, z) at world clock time clockMs. Three
  // noise fields drift over the world. The cloud field is small and quick:
  // patches of cloud come and go every minute or two. The storm field is
  // bigger and slower, so a storm is a system you fly into: the sky clouds
  // over first, rain builds from a drizzle, lasts about a minute (rarely
  // over two), and eases off (3 or 4 storms an hour at cruise, raining
  // about 6% of the time and thickly overcast about 12%, against 6% for the
  // cloud patches alone; see scripts/test-weather.js). In the north the
  // storms bring snow, and the snow field, bigger and slower still, brings
  // the light, frequent snow that makes the snow country peaceful to fly
  // in, in spells of a few minutes. Amounts are particle opacities (rain up
  // to RAIN_FULL, snow up to SNOW_STORM); weather-manager.js eases toward
  // them.
  const WEATHER = {
    CLOUD_SCALE: 15000, // units per noise unit (about 4 km patches)
    CLOUD_DRIFT_MS: 100000, // world clock ms per noise unit of drift
    STORM_SCALE: 35000, // units per noise unit (systems about 10 km wide)
    STORM_DRIFT_MS: 500000,
    // The snow country's light snow follows a bigger, slower field, so its
    // spells last a few minutes
    SNOW_SCALE: 60000,
    SNOW_DRIFT_MS: 900000,
    // Storm noise (0 to 1) where each thing starts and is full
    STORM_CLOUD: [0.78, 0.85], // overcast, ahead of the rain
    STORM_PRECIP: [0.8, 0.92], // drizzle to downpour
    LIGHT_SNOW: [0.52, 0.64], // in the snow field (0 to 1)
    LIGHT_SNOW_CLOUD: [0.47, 0.6],
    SNOW_CLOUD_HEADSTART: 0.15, // cloud patches build sooner over the snow
    RAIN_FULL: 0.5,
    SNOW_STORM: 0.45,
    LIGHT_SNOW_EDGE: 0.15, // light snow where the snow cover is full
    LIGHT_SNOW_DEEP: 0.25, // and 1.5 degrees farther north
  };

  function weatherAt(x, z, clockMs, simplex) {
    // Latitude as the climate sees it: the snow line wanders (snowWobble)
    const lat = -z / 5000 + snowWobble(x, z, simplex);
    const cloudT = clockMs / WEATHER.CLOUD_DRIFT_MS;
    const cloudNoise =
      (simplex.noise2D(
        x / WEATHER.CLOUD_SCALE + 500 + cloudT,
        z / WEATHER.CLOUD_SCALE + cloudT
      ) +
        1) /
      2;
    const stormT = clockMs / WEATHER.STORM_DRIFT_MS;
    const stormNoise =
      (simplex.noise2D(
        x / WEATHER.STORM_SCALE - 300 + stormT,
        z / WEATHER.STORM_SCALE + 700 - stormT * 0.6
      ) +
        1) /
      2;
    const snowT = clockMs / WEATHER.SNOW_DRIFT_MS;
    const snowNoise =
      (simplex.noise2D(
        x / WEATHER.SNOW_SCALE + 900 - snowT * 0.7,
        z / WEATHER.SNOW_SCALE - 400 + snowT
      ) +
        1) /
      2;
    const ramp = (v, [from, to]) => smoothRamp(v, from, to);
    const snowZone = smoothRamp(lat, SNOW_START_LAT, SNOW_FULL_LAT);
    const storm = ramp(stormNoise, WEATHER.STORM_PRECIP);

    // Cloud cover: the cloud patches (clear below about 0.65), the storms'
    // overcast, and over the snow the light snow's cloud (reaching a little
    // south of the snow, so the first flakes fall from cloud too)
    const snowCloudZone = smoothRamp(
      lat,
      SNOW_START_LAT - 0.3,
      SNOW_START_LAT + 0.2
    );
    const cloud = Math.max(
      smoothRamp(cloudNoise, 0.65 - WEATHER.SNOW_CLOUD_HEADSTART * snowZone, 1),
      ramp(stormNoise, WEATHER.STORM_CLOUD),
      0.75 * snowCloudZone * ramp(snowNoise, WEATHER.LIGHT_SNOW_CLOUD)
    );

    // Light snow from where the snow cover starts, heavier farther north
    const lightSnow =
      ramp(snowNoise, WEATHER.LIGHT_SNOW) *
      (snowZone * WEATHER.LIGHT_SNOW_EDGE +
        smoothRamp(lat, SNOW_FULL_LAT, SNOW_FULL_LAT + 1.5) *
          (WEATHER.LIGHT_SNOW_DEEP - WEATHER.LIGHT_SNOW_EDGE));
    // Storms bring rain in the south, snow in the north, and sleet between;
    // the rain dries up toward the desert
    const dry = smoothRamp(z / 5000 + desertShift(x, z, simplex), 2.0, 3.0);
    const rain = storm * WEATHER.RAIN_FULL * (1 - snowZone) * (1 - dry);
    const snow = Math.max(lightSnow, storm * WEATHER.SNOW_STORM * snowZone);
    const zone =
      snowZone >= 1
        ? 'Snow'
        : snowZone > 0
          ? 'Sleet'
          : dry >= 1
            ? 'Desert'
            : dry > 0
              ? 'Dry edge'
              : 'Rain';
    return {cloud, rain, snow, cloudNoise, stormNoise, lat, zone};
  }

  exports.WEATHER = WEATHER;
  exports.weatherAt = weatherAt;

  // --- BUGGY VERTICAL PHYSICS & INCLINE LAUNCH ---
  // A buggy climbing an incline at speed develops upward momentum
  // (velX * slopeX + velZ * slopeZ). When the terrain levels out, crests,
  // or drops off, this upward momentum carries the buggy off the ground
  // into a natural ballistic flight.
  const BUGGY_AIR = {
    GRAVITY: 40,
    // Minimum upward velocity (units/s) needed to launch off a crest
    MIN_LAUNCH_VEL: 6.0,
    // How fast (units/s) the wheels must be rising away from the ground
    // before they leave it: 0.25 units over a 60 fps frame. Rates rather
    // than distances per frame, so crests launch the same at any frame rate.
    SEPARATION_RATE: 15,
    // How fast (units/s) the ground may fall away under the wheels before
    // it's a ledge to drive off: 1.2 units over a 60 fps frame
    LEDGE_DROP_RATE: 72,
    // The fastest the ground can throw it upward (units/s): a 30 m jump at
    // most. Hitting a steep bank flat out otherwise fired it hundreds of
    // metres up.
    MAX_RAMP_VEL: 80,
  };

  /**
   * Updates buggy vertical position, vertical velocity and airborne state.
   *
   * @param {Object} p
   * @param {number} p.y - Current vertical position
   * @param {number} p.velY - Current vertical velocity
   * @param {boolean} p.airborne - Whether currently in the air
   * @param {number} p.surfaceHeight - Ground / road elevation under vehicle
   * @param {number} p.groundVelY - Vertical rate of terrain change (velX * slopeX + velZ * slopeZ)
   * @param {boolean} p.onWater - Whether vehicle is on water
   * @param {boolean} [p.hop] - Double-tapped up: hop off the ground or water
   * @param {boolean} [p.float] - Holding up after a hop: lighter on the way up
   * @param {number} p.dt - Timestep in seconds
   * @returns {{y: number, velY: number, airborne: boolean, impact: number}}
   */
  function stepBuggyVertical({
    y,
    velY,
    airborne,
    surfaceHeight,
    groundVelY,
    onWater,
    hop = false,
    float = false,
    dt,
  }) {
    let impact = 0;
    if (hop) {
      // A hop: up off the ground, as off a crest (or just after leaving it,
      // over a bump)
      velY = Math.max(velY, BUGGY_MOVES.HOP_VEL);
      return {y: y + velY * dt, velY, airborne: true, impact: 0};
    }
    // Floating; jumping in from the bank falls the rest of the way below
    if (onWater && !airborne) {
      return {y: surfaceHeight, velY: 0, airborne: false, impact: 0};
    }

    const rampVelY = Math.min(groundVelY, BUGGY_AIR.MAX_RAMP_VEL);
    if (!airborne) {
      // While wheels are in contact with the ground:
      // Terrain pushes upward when climbing
      if (rampVelY > velY) {
        velY = rampVelY;
      } else {
        // Cresting or slope flattening: gravity pulls downward
        velY -= BUGGY_AIR.GRAVITY * dt;
      }

      const candidateY = y + velY * dt;
      // Launch off crest when ballistic trajectory carries wheels above ground,
      // or when driving off a sudden cliff / drop-off
      if (
        (candidateY - surfaceHeight > BUGGY_AIR.SEPARATION_RATE * dt &&
          velY > BUGGY_AIR.MIN_LAUNCH_VEL) ||
        y - surfaceHeight > BUGGY_AIR.LEDGE_DROP_RATE * dt
      ) {
        airborne = true;
        y = candidateY;
      } else {
        y = surfaceHeight;
        velY = rampVelY;
      }
    } else {
      // Free ballistic trajectory under gravity, lighter rising from a hop
      // with up held
      const g =
        float && velY > 0
          ? BUGGY_AIR.GRAVITY * BUGGY_MOVES.HOP_FLOAT_GRAVITY
          : BUGGY_AIR.GRAVITY;
      velY = Math.max(-400, velY - g * dt);
      y += velY * dt;
      if (y <= surfaceHeight) {
        airborne = false;
        impact = Math.max(0, groundVelY - velY);
        y = surfaceHeight;
        velY = rampVelY;
      }
    }

    return {y, velY, airborne, impact};
  }

  exports.BUGGY_AIR = BUGGY_AIR;
  exports.stepBuggyVertical = stepBuggyVertical;

  // --- BUGGY AND BRIDGE RAILINGS ---
  // A raised bridge's railings (terrain-chunks.js) stand ROAD_WIDTH + 1.4
  // either side of the centre line, 1.2 thick and 2.6 above the deck. The
  // buggy's body reaches 3.35 either side (the rear tyres' outer faces) and
  // 4.6 ahead and behind (the tyres' front and back)
  const BUGGY_RAIL = {
    INNER: ROAD_WIDTH + 0.8,
    TOP: 2.6,
    HALF_WIDTH: 3.35,
    HALF_LENGTH: 4.6,
    // Of the speed into the rail, how much it bounces back with
    BOUNCE: 0.2,
    // Of the speed along the rail, how much a hit scrubs off per unit of
    // speed into it
    SCRUB: 0.003,
  };

  // Keeps the buggy (car: x, z, velX, velZ, y; yaw) inside a railed deck's
  // railings (road: rails, across, normalX, normalZ, height, as
  // sampleRoadSegment fills it). Its reach across the road grows as it turns
  // toward the rail, so the nose stops at the rail too. Above the rails' top
  // it flies over. Changes car in place; returns the speed it hit with (0
  // when it didn't touch).
  function stepBuggyRails(car, road, yaw) {
    if (!road.rails || car.y > road.height + BUGGY_RAIL.TOP) return 0;
    // The buggy's forward and the road's normal: cos of the angle between
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const cosToNormal = Math.abs(fx * road.normalX + fz * road.normalZ);
    const sinToNormal = Math.sqrt(Math.max(0, 1 - cosToNormal * cosToNormal));
    const reach =
      BUGGY_RAIL.HALF_WIDTH * sinToNormal +
      BUGGY_RAIL.HALF_LENGTH * cosToNormal;
    const limit = BUGGY_RAIL.INNER - reach;
    const over = Math.abs(road.across) - limit;
    if (over <= 0) return 0;
    // Outward along the normal
    const side = Math.sign(road.across);
    const nx = road.normalX * side;
    const nz = road.normalZ * side;
    car.x -= nx * over;
    car.z -= nz * over;
    const into = car.velX * nx + car.velZ * nz;
    if (into <= 0) return 0;
    car.velX -= nx * into * (1 + BUGGY_RAIL.BOUNCE);
    car.velZ -= nz * into * (1 + BUGGY_RAIL.BOUNCE);
    const keep = Math.max(0.5, 1 - into * BUGGY_RAIL.SCRUB);
    car.velX *= keep;
    car.velZ *= keep;
    return into;
  }

  exports.BUGGY_RAIL = BUGGY_RAIL;

  // --- BUGGY RESTING ON ALL FOUR WHEELS ---
  // How far a bump under the middle can rise into the gap under the body
  // before it lifts the buggy
  const BUGGY_BELLY_CLEARANCE = 1.0;

  // The ground as the four tyres feel it: h holds the surface heights under
  // the front left, front right, rear left and rear right tyres, axles their
  // places (front and rear z, negative ahead, and halfTrack either side),
  // and centre the height under the middle. Fits a plane through the four
  // and lifts it until no tyre is below its ground, so on a lumpy or creased
  // bank (the terrain's triangles), a road's edge or a kerb, the wheels stay
  // on top. Returns, at the buggy's origin, the height and the rise per unit
  // forward (along) and to the right (across).
  function buggyWheelContact(h, axles, centre, out = {}) {
    const fwd = [-axles.front, -axles.front, -axles.rear, -axles.rear];
    const right = [
      -axles.halfTrack,
      axles.halfTrack,
      -axles.halfTrack,
      axles.halfTrack,
    ];
    const along = (h[0] + h[1] - h[2] - h[3]) / 2 / (fwd[0] - fwd[2]);
    const across = (h[1] + h[3] - h[0] - h[2]) / 2 / (2 * axles.halfTrack);
    const meanFwd = (fwd[0] + fwd[2]) / 2;
    let height = (h[0] + h[1] + h[2] + h[3]) / 4 - along * meanFwd;
    let lift = 0;
    for (let i = 0; i < 4; i++) {
      lift = Math.max(
        lift,
        h[i] - (height + along * fwd[i] + across * right[i])
      );
    }
    height = Math.max(height + lift, centre - BUGGY_BELLY_CLEARANCE);
    out.height = height;
    out.along = along;
    out.across = across;
    return out;
  }

  exports.BUGGY_BELLY_CLEARANCE = BUGGY_BELLY_CLEARANCE;
  exports.buggyWheelContact = buggyWheelContact;
  exports.stepBuggyRails = stepBuggyRails;

  // --- BUGGY STEERING & DRIVING ---
  // Speeds in units per second, which read as knots; accelerations in units
  // per second squared (buggy.js)
  // Double-tap moves, like the planes' (a double-tap and hold is a stronger
  // version of the same input). Up: a hop, and holding on floats it and
  // carves the path in the air. Left or right, held: a power slide. Down,
  // held: a hard brake to a halt (steering too swings the tail round).
  const BUGGY_MOVES = {
    // Leaving the ground at this (units/s): about a 6 m hop, 1.5 s up and
    // down
    HOP_VEL: 31,
    // Holding up after the hop: gravity on the way up, as a share (it rises
    // higher, to about 9 m), and for how long at most (seconds)
    HOP_FLOAT_GRAVITY: 0.6,
    HOP_FLOAT_SECONDS: 1.2,
    // Holding up after the hop: the stick turns it this much faster in the
    // air, and the path follows where it points at this rate (per second)
    HOP_AIR_YAW: 2.2,
    HOP_CARVE_RATE: 2.5,
    // Over bumpy ground the wheels are often just off it: a double-tap up
    // waits this long for them to touch (seconds), and still hops this
    // soon after they've left it
    HOP_BUFFER_SECONDS: 0.35,
    HOP_COYOTE_SECONDS: 0.25,
    // Power slide: fully on from SLIDE_FULL_SPEED (from nothing at
    // SLIDE_MIN_SPEED), building over SLIDE_SECONDS, swinging this much
    // wider than leaning in (0.15 is 15% more)
    SLIDE_MIN_SPEED: 30,
    SLIDE_FULL_SPEED: 70,
    SLIDE_SECONDS: 0.1,
    SLIDE_EXTRA: 0.15,
    // and the tyres let go: their grip falls by this share
    SLIDE_LOOSEN: 0.5,
    // Hard brake (units/s²): twice the ordinary brakes
    HARD_BRAKE_DECEL: 90,
  };

  /**
   * Whether the buggy hops this frame. timer ({buffer, airTime}, updated
   * in place) remembers a double-tap up for a moment and how long the
   * wheels have been off the ground, so a tap over bumps still hops.
   *
   * @param {Object} timer
   * @param {Object} p
   * @param {boolean} p.tapped - Double-tapped up this frame
   * @param {boolean} p.airborne
   * @param {boolean} p.hopping - Already in the air from a hop
   * @param {number} p.dt
   * @returns {boolean}
   */
  function stepBuggyHop(timer, {tapped, airborne, hopping, dt}) {
    const M = BUGGY_MOVES;
    if (tapped) timer.buffer = M.HOP_BUFFER_SECONDS;
    timer.airTime = airborne ? timer.airTime + dt : 0;
    if (timer.buffer > 0 && !hopping && timer.airTime <= M.HOP_COYOTE_SECONDS) {
      timer.buffer = 0;
      return true;
    }
    timer.buffer = Math.max(0, timer.buffer - dt);
    return false;
  }

  exports.stepBuggyHop = stepBuggyHop;

  const BUGGY_DRIVE = {
    REVERSE_TOP: 20,
    // About 0 to 60 knots in 2.5 seconds, 100 in 5
    ENGINE_ACCEL: 45,
    REVERSE_ACCEL: 14,
    BRAKE_DECEL: 45,
    // Rolling resistance, and drag growing with the square of the speed
    ROLL_DRAG: 3,
    AIR_DRAG: 0.0007,
    // Front wheel lock, and the yaw rate and sideways grip that cap it at speed
    MAX_STEER: 0.5,
    MAX_YAW_RATE: 1.15,
    MAX_CORNERING: 115,
  };

  // The front wheel angle allowed at a forward speed: full lock for parking,
  // opening up with speed so the turn radius grows with the square of the
  // speed on the highway (grip-limited)
  function buggySteerLimit(forward, wheelbase) {
    const v = Math.max(0.1, Math.abs(forward));
    return Math.atan(
      Math.min(
        Math.tan(BUGGY_DRIVE.MAX_STEER),
        (wheelbase * BUGGY_DRIVE.MAX_YAW_RATE) / Math.max(5.8, v),
        (wheelbase * BUGGY_DRIVE.MAX_CORNERING) / (v * v)
      )
    );
  }

  // Stick to steering, -1 to 1: a deadzone, then a curve that keeps small
  // thumb motions gentle for lane keeping. The virtual joystick's full throw
  // is 0.5; a mouse's or gyro's is 1.
  function buggySteerAxis(value, isJoystick) {
    const maxRange = isJoystick ? 0.5 : 1.0;
    const deadzone = isJoystick ? 0.06 : 0.12;
    const abs = Math.abs(value);
    if (abs <= deadzone) return 0;
    const norm = Math.min(1, (abs - deadzone) / (maxRange - deadzone));
    return Math.sign(value) * norm * norm;
  }

  // Stick to throttle, -1 to 1 (up boosts, down brakes then reverses): a
  // deadzone, then linear
  function buggyThrottleAxis(value, isJoystick) {
    const maxRange = isJoystick ? 0.5 : 1.0;
    const deadzone = isJoystick ? 0.08 : 0.15;
    const abs = Math.abs(value);
    if (abs <= deadzone) return 0;
    return (
      Math.sign(value) * Math.min(1, (abs - deadzone) / (maxRange - deadzone))
    );
  }

  // The engine's or brakes' pull along the buggy (units/s²) on the ground.
  // forward: speed along the buggy (negative reversing); joyY: throttle axis;
  // cruise: the throttle slider's set speed; top: top speed here; drag: the
  // rolling and air drag at this speed, which holding a speed makes up for.
  // hardBrake: double-tap down and hold, braking harder to a halt and
  // holding it there, never reversing.
  function buggyDriveAccel({forward, joyY, cruise, top, drag, hardBrake}) {
    const D = BUGGY_DRIVE;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (hardBrake) {
      const stop = BUGGY_MOVES.HARD_BRAKE_DECEL;
      return clamp(-forward * 8, -stop, stop);
    }
    const engine = (v, max, accel) =>
      v >= max ? 0 : accel * (1 - (v / max) ** 2) + drag;
    if (joyY > 0.05) {
      // Pushing up: a boost above cruise, up to top speed
      const boostTarget = cruise + (top - cruise) * joyY;
      return clamp(
        (boostTarget - forward) * 2.0 + drag,
        -D.BRAKE_DECEL * 0.3,
        engine(Math.max(0, forward), top, D.ENGINE_ACCEL)
      );
    }
    if (joyY < -0.05) {
      // Pulling down: brakes to a halt, then holding on reverses
      const down = -joyY;
      if (forward > 0.5) return -D.BRAKE_DECEL * down;
      return clamp(
        (-D.REVERSE_TOP * down - forward) * 2.0 - drag,
        -engine(Math.max(0, -forward), D.REVERSE_TOP, D.REVERSE_ACCEL),
        D.BRAKE_DECEL * 0.5
      );
    }
    if (cruise > 0.5) {
      // Stick at rest: holds the set speed, braking out of reverse first
      if (forward < -0.5) return D.BRAKE_DECEL;
      return clamp(
        (cruise - forward) * 1.5 + drag,
        -D.BRAKE_DECEL * 0.3,
        engine(Math.max(0, forward), top, D.ENGINE_ACCEL)
      );
    }
    // No cruise and the stick at rest: coasts to a stop
    return forward > 0.5 ? -D.ROLL_DRAG : forward < -0.5 ? D.ROLL_DRAG : 0;
  }

  // On water the buggy turns into a hovercraft: its wheels fold flat like
  // pontoons and it carries on at land speeds, sliding a little wider in
  // the turns. Driving out onto land folds the wheels back down.
  const BUGGY_HOVER = {
    // Sideways grip (per second; tyres on the ground have 18)
    GRIP: 7,
    // Seconds for the wheels to fold flat, or back down
    FOLD_SECONDS: 0.5,
    // How far its origin sits below the water's surface as it hovers, so
    // the folded wheels skim it
    FLOAT_DEPTH: 0.3,
  };

  // Whether the buggy hovers at a spot: the ground as drawn (groundHeight)
  // is under the water's surface, or the terrain (elevation) counts it as
  // sea. Shallows off a beach can count as land yet be drawn several units
  // under the water: judged by elevation alone, the water's surface beside
  // them stood up as a wall and tipped the buggy onto its side.
  function buggyOverWater(groundHeight, elevation, waterLevel) {
    return (
      groundHeight < waterLevel - BUGGY_HOVER.FLOAT_DEPTH ||
      elevation <= waterLevel + 0.1
    );
  }

  // The drag slowing the buggy (units/s²) at a forward speed: rolling
  // resistance and air drag, the same on water as on land
  function buggyDrag(forward) {
    return BUGGY_DRIVE.ROLL_DRAG + BUGGY_DRIVE.AIR_DRAG * forward * forward;
  }

  // Moves the wheels' fold (0 down, 1 flat) toward flat over water and down
  // over land
  function stepBuggyHoverFold(fold, overWater, dt) {
    const target = overWater ? 1 : 0;
    const step = dt / BUGGY_HOVER.FOLD_SECONDS;
    return fold + Math.min(step, Math.max(-step, target - fold));
  }

  // --- BUGGY TURNING, GRIP & LEAN-IN DRIFT ---
  // The tyres turn the buggy's path toward where it points, up to a limit
  // (MAX_GRIP, units/s² across it). Ordinary steering stays inside it
  // (buggySteerLimit keeps the cornering under MAX_CORNERING), so the buggy
  // tracks on rails. Holding a hard turn at speed leans in: the tail kicks
  // out to a drift angle, the path tightens a little and the slide scrubs
  // speed. Easing off the stick lets it straighten, more slowly the faster
  // it goes, so drifting at top speed takes some catching.
  const BUGGY_TURN = {
    // Quick grip for small slides (per second), and the most it can turn
    // the path
    GRIP_RATE: {road: 25, ground: 18, water: BUGGY_HOVER.GRIP},
    MAX_GRIP: {road: 150, ground: 125, water: 90},
    // Leaning in: the stick past LEAN_STEER, held, above LEAN_MIN_SPEED
    // (fully from LEAN_FULL_SPEED), builds over LEAN_SECONDS and lets go
    // over LEAN_RELEASE_SECONDS
    LEAN_STEER: 0.75,
    LEAN_MIN_SPEED: 90,
    LEAN_FULL_SPEED: 150,
    LEAN_SECONDS: 0.35,
    LEAN_RELEASE_SECONDS: 0.2,
    // Leaning in fully: the drift angle (radians), and how much more the
    // grip and the front wheels turn it (0.35 is 35% more)
    DRIFT_ANGLE: {road: 0.38, ground: 0.52, water: 0.6},
    LEAN_EXTRA: 0.35,
    // Past WILD_SPEED the drift swings wider, up to WILD_EXTRA more at top
    // speed
    WILD_SPEED: 180,
    WILD_EXTRA: 0.5,
    // How quickly the tail swings toward the drift angle, or back in line
    // (per second), slowing to KICK_RATE / (1 + KICK_FADE) at top speed
    KICK_RATE: 5,
    KICK_FADE: 3,
    // Speed lost to the sideways scrub, as a share of the grip at work
    SCRUB: 0.5,
    // How fast the front wheels turn toward the stick, and back to centre
    // (radians per second)
    STEER_RATE: 2.8,
    STEER_RETURN_RATE: 5.0,
    // In the air the stick turns the buggy (radians per second) to line up
    // the landing, though it carries on the way it was going
    AIR_YAW_RATE: 0.6,
    AIR_YAW_SECONDS: 0.3,
  };

  /**
   * One step of the buggy's steering, turning and grip. Updates car in
   * place: velX/velZ (world, units/s), yaw, yawRate, steer (front wheel
   * angle) and lean (0 to 1, leaning into a hard turn). forward and side
   * are its velocity along and across the buggy after the engine, brakes
   * and slope have acted.
   *
   * @param {Object} car
   * @param {Object} p
   * @param {number} p.forward
   * @param {number} p.side
   * @param {number} p.steerIn - Stick, -1 (right) to 1 (left)
   * @param {string} p.kind - 'road', 'ground' or 'water'
   * @param {boolean} [p.slide] - Power sliding (double-tap left or right
   *   and hold, or hard braking while steering)
   * @param {boolean} [p.hopHeld] - Holding up after a hop: more air control
   * @param {boolean} p.airborne
   * @param {number} p.wheelbase
   * @param {number} p.topSpeed
   * @param {number} p.dt
   * @returns {number} How far it's sliding: the angle between where it
   *   points and where it's going (radians; positive with the nose left of
   *   its path, as in a drift to the left)
   */
  function stepBuggyHandling(
    car,
    {
      forward,
      side,
      steerIn,
      kind,
      slide = false,
      hopHeld = false,
      airborne,
      wheelbase,
      topSpeed,
      dt,
    }
  ) {
    const T = BUGGY_TURN;
    const M = BUGGY_MOVES;
    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const speed = Math.hypot(forward, side);
    const slipNow =
      speed < 1 || forward < 0 ? 0 : Math.atan2(side, Math.abs(forward));

    // Leaning in builds while a hard turn is held at speed
    const hard =
      !airborne &&
      Math.abs(steerIn) >= T.LEAN_STEER &&
      forward > T.LEAN_MIN_SPEED;
    const leanRate = hard ? 1 / T.LEAN_SECONDS : -1 / T.LEAN_RELEASE_SECONDS;
    car.lean = clamp01(car.lean + leanRate * dt);
    // A power slide kicks the tail out almost at once, from lower speeds
    const sliding = slide && !airborne && forward > M.SLIDE_MIN_SPEED;
    const slideRate = sliding
      ? 1 / M.SLIDE_SECONDS
      : -1 / T.LEAN_RELEASE_SECONDS;
    car.slide = clamp01((car.slide || 0) + slideRate * dt);
    const slideDrift =
      car.slide *
      clamp01(
        (forward - M.SLIDE_MIN_SPEED) / (M.SLIDE_FULL_SPEED - M.SLIDE_MIN_SPEED)
      );
    const drift = Math.max(
      slideDrift,
      car.lean *
        clamp01(
          (forward - T.LEAN_MIN_SPEED) / (T.LEAN_FULL_SPEED - T.LEAN_MIN_SPEED)
        )
    );
    const boost = 1 + T.LEAN_EXTRA * drift;

    // The front wheels turn toward the stick, up to the grip-limited lock
    // for its speed (more of it leaning in). By its whole speed, not just
    // along it, so a slide doesn't free up more lock.
    const limit = Math.min(
      BUGGY_DRIVE.MAX_STEER,
      Math.atan(Math.tan(buggySteerLimit(speed, wheelbase)) * boost)
    );
    const target = steerIn * limit;
    const returning =
      target === 0 || Math.sign(target) !== Math.sign(car.steer);
    const rate = returning ? T.STEER_RETURN_RATE : T.STEER_RATE;
    car.steer += Math.min(rate * dt, Math.max(-rate * dt, target - car.steer));

    if (!airborne && speed >= 1) {
      // Grip turns the path toward where it points (quickly for small
      // slides, limited for big ones), keeping the speed but for a scrub
      const loose = 1 - M.SLIDE_LOOSEN * car.slide;
      const quick =
        Math.abs(side) * (1 - Math.exp(-T.GRIP_RATE[kind] * loose * dt));
      const lateral = Math.min(quick, T.MAX_GRIP[kind] * boost * loose * dt);
      const along = forward < 0 ? -1 : 1;
      let slip = Math.atan2(side, Math.abs(forward));
      slip -= Math.sign(slip) * Math.min(Math.abs(slip), lateral / speed);
      const scrubbed = Math.max(
        0,
        speed - T.SCRUB * lateral * Math.abs(Math.sin(slip))
      );
      forward = along * scrubbed * Math.cos(slip);
      side = scrubbed * Math.sin(slip);

      // Turning follows the front wheels, and the tail swings toward the
      // drift angle (or back in line)
      const kick = T.KICK_RATE / (1 + T.KICK_FADE * (speed / topSpeed) ** 2);
      const wild =
        1 +
        T.WILD_EXTRA *
          clamp01((speed - T.WILD_SPEED) / (topSpeed - T.WILD_SPEED));
      const wantSlip =
        Math.sign(steerIn) *
        T.DRIFT_ANGLE[kind] *
        wild *
        (1 + M.SLIDE_EXTRA * car.slide) *
        drift;
      const want =
        (forward * Math.tan(car.steer)) / wheelbase +
        (forward > 0 ? kick * (wantSlip - slipNow) : 0);
      const ease = 0.08 + 0.06 * Math.min(1, Math.abs(forward) / topSpeed);
      car.yawRate += (want - car.yawRate) * (1 - Math.exp(-dt / ease));
    } else if (airborne) {
      // In the air the stick turns it, and the spin dies away without it.
      // Holding up after a hop it turns faster, and carves its path round.
      const want = steerIn * T.AIR_YAW_RATE * (hopHeld ? M.HOP_AIR_YAW : 1);
      car.yawRate +=
        (want - car.yawRate) * (1 - Math.exp(-dt / T.AIR_YAW_SECONDS));
      if (hopHeld && forward > 1) {
        // The path's angle off the nose, closing
        const off = Math.atan2(side, forward);
        const turn = off * (1 - Math.exp(-M.HOP_CARVE_RATE * dt));
        const f2 = forward * Math.cos(turn) + side * Math.sin(turn);
        const s2 = side * Math.cos(turn) - forward * Math.sin(turn);
        forward = f2;
        side = s2;
      }
    } else {
      car.yawRate = 0;
    }

    const fx = -Math.sin(car.yaw);
    const fz = -Math.cos(car.yaw);
    const rx = Math.cos(car.yaw);
    const rz = -Math.sin(car.yaw);
    car.velX = fx * forward + rx * side;
    car.velZ = fz * forward + rz * side;
    car.yaw += car.yawRate * dt;
    const nf = -Math.sin(car.yaw) * car.velX - Math.cos(car.yaw) * car.velZ;
    const ns = Math.cos(car.yaw) * car.velX - Math.sin(car.yaw) * car.velZ;
    return Math.hypot(nf, ns) < 1 || nf < 0 ? 0 : Math.atan2(ns, nf);
  }

  exports.BUGGY_TURN = BUGGY_TURN;
  exports.stepBuggyHandling = stepBuggyHandling;
  exports.BUGGY_DRIVE = BUGGY_DRIVE;
  exports.BUGGY_MOVES = BUGGY_MOVES;
  exports.BUGGY_HOVER = BUGGY_HOVER;
  exports.buggyOverWater = buggyOverWater;
  exports.buggyDrag = buggyDrag;
  exports.stepBuggyHoverFold = stepBuggyHoverFold;
  exports.buggySteerLimit = buggySteerLimit;
  exports.buggySteerAxis = buggySteerAxis;
  exports.buggyThrottleAxis = buggyThrottleAxis;
  exports.buggyDriveAccel = buggyDriveAccel;
})(ChillFlightLogic);
