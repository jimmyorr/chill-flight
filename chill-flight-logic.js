// --- CHILL FLIGHT LOGIC ---
// Pure, side-effect-free functions extracted for testability.
// Works in both Node.js (CommonJS) and the browser (exposes window.ChillFlightLogic).

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
  const START_FULLSCREEN_MAP =
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

  const _islandTypeParam = getParam('islandType', getParam('island', null));
  let START_ISLAND_TYPE = 'auto';
  if (_islandTypeParam !== null && _islandTypeParam !== '') {
    const norm = _islandTypeParam.trim().toLowerCase();
    if (
      ['auto', 'temperate', 'subtropical', 'arid', 'alien', 'winter'].includes(
        norm
      )
    ) {
      START_ISLAND_TYPE = norm;
    }
  }

  const PLANE_TYPES = ['classic', 'biplane', 'glider', 'twin'];
  const _planeParam = getParam('plane', getParam('vehicle', null));
  let START_PLANE = null;
  if (_planeParam !== null && _planeParam !== '') {
    const normPlane = _planeParam.trim().toLowerCase();
    if (PLANE_TYPES.includes(normPlane)) {
      START_PLANE = normPlane;
    }
  }
  let FORCE_ISLAND_TYPE = START_ISLAND_TYPE;

  function getIslandArchetype(x, z, simplexInstance) {
    const forced =
      typeof exports !== 'undefined' && exports.FORCE_ISLAND_TYPE
        ? exports.FORCE_ISLAND_TYPE
        : typeof ChillFlightLogic !== 'undefined' &&
            ChillFlightLogic.FORCE_ISLAND_TYPE
          ? ChillFlightLogic.FORCE_ISLAND_TYPE
          : FORCE_ISLAND_TYPE;
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

  // Per-chunk seeded PRNG. Derives a unique seed from (WORLD_SEED, chunkX, chunkZ) so
  // each chunk's detail generation (trees, clouds, birds) is identical regardless of
  // which order chunks are loaded—critical for world consistency.
  function chunkRng(chunkX, chunkZ) {
    const s =
      (WORLD_SEED * 1000003) ^ (chunkX * 374761393 + chunkZ * 1234567891);
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

  // --- DAY / NIGHT WARP ---
  // Maps raw cycle progress (unwarped_p) [0,1) to a warped time-of-day (warped_p) [0,1).
  // This causes the sun to linger during sunrise/sunset and rush through the night.
  //
  // Knot table format: [unwarped_p, warped_p]
  // Time acceleration/deceleration is determined by the mathematical slope (dw / dp):
  //   slope > 1.0 → sun moves FASTER than real-time (e.g., night passes quickly)
  //   slope < 1.0 → sun moves SLOWER than real-time (e.g., lingers during golden hour)
  //
  // Visual horizon crossing occurs at warped_p 0.25 (6:00 AM) and 0.75 (6:00 PM).
  // We configure the "horizon zones" to have a gentle slope (0.50x) so the sunset
  // is fully enjoyed before the speedup occurs.
  //
  // How the 6-minute (360s) cycle breaks down in real-time:
  //   - Sunset Lingering Horizon (4:00pm - 8:30pm): Lasts exactly 120s (2 minutes).
  //   - Ultra-fast Night (8:30pm - 3:30am): Sprints through the night in exactly 30s.
  //   - Sunrise Lingering Horizon (3:30am - 8:00am): Lasts exactly 120s (2 minutes).
  //   - Daylight (8:00am - 4:00pm): Sails through midday in exactly 90s.
  //
  function computeTimeOfDay(secondsInCycle, latInRadians = 0.71) {
    const CYCLE_DURATION_S = 360;
    const p = (secondsInCycle % CYCLE_DURATION_S) / CYCLE_DURATION_S;

    // [unwarped_p, warped_p] — edit warped_p to tune feel.
    // warped_p maps strictly to a 24-hour clock (e.g., 0.5 = 12:00 PM, 0.7 = 4:48 PM)
    const knots = [
      // midnight
      [0.0, 0.0],
      // end of night        →  3:30 AM  (Slope 3.50x)  [Lasts 15.0s]
      [0.0417, 0.1458],
      // horizon zone ends   →  8:00 AM  (Slope 0.56x)  [Lasts 120.0s]
      [0.375, 0.3333],
      // solar noon          → 12:00 PM  (Slope 1.33x)  [Lasts 45.0s]
      [0.5, 0.5],
      // horizon zone starts →  4:00 PM  (Slope 1.33x)  [Lasts 45.0s]
      [0.625, 0.6667],
      // night begins        →  8:30 PM  (Slope 0.56x)  [Lasts 120.0s]
      [0.9583, 0.8542],
      // midnight            → 12:00 AM  (Slope 3.50x)  [Lasts 15.0s]
      [1.0, 1.0],
    ];

    for (let i = 0; i < knots.length - 1; i++) {
      const [p0, w0] = knots[i];
      const [p1, w1] = knots[i + 1];
      if (p >= p0 && p <= p1) {
        const t = (p - p0) / (p1 - p0);
        // Linear interpolation: constant velocity within each segment.
        // Avoids the S-curve double-zero-velocity at knot boundaries
        // that caused phantom pauses (e.g. at 14:30 and 00:00).
        return w0 + t * (w1 - w0);
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

  // --- BIOME ---
  // Returns a biome value in [-1, 1] for a given world (x, z) position.
  // Requires a simplex noise object with a noise2D(x, y) method.
  function getBiome(x, z, simplex) {
    let noise = simplex.noise2D(x * 0.00005 + 1000, z * 0.00005 + 1000) * 0.5;
    const mapScale = 10000;
    let biomeBase = 0;

    if (x > 0) biomeBase -= Math.min(1, x / mapScale);

    if (z > 0) {
      let mtnInf = Math.min(1, z / mapScale);
      if (x < 0) {
        const westDamp = Math.max(0, Math.min(1, 1 + x / 5000));
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
          simplex.noise2D(x * 0.00015, z * 0.00015) * 0.5 * xFade * zFade;

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
  function getElevation(x, z, simplex, constants, lerp, options = {}) {
    const WATER_LEVEL = constants.WATER_LEVEL || 40;

    // --- PROCEDURAL TERRAIN HELPER ---
    // Unified grid where 1 lat = 5000 units.
    function getProceduralTerrainType(latIndex, terrainFrequency = 0.8) {
      if (latIndex === 0) return 'major_river'; // Equator override
      // Use a non-zero Y coordinate so we don't sample along an axis (which can be 0)
      // Multiply by 1.5 to stretch the Simplex noise output closer to the [-1.0, 1.0] range
      const tNoise = simplex.noise2D(latIndex * terrainFrequency, 1234.5) * 1.5;
      if (tNoise > 0.4) return 'mountain';
      if (tNoise < -0.4) return 'minor_river';
      return 'buffer';
    }

    const {MAP_WORLD_SIZE = 5000, MAP_HEIGHT_SCALE = 1000} = constants;
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
      // In-game altitude 2000ft is approximately 125.5 world units.
      // Starting at 38.0 ensures that luminance 0 is slightly underwater (WATER_LEVEL=40).
      return 38.0 + normalizedHeight * 87.5;
    }

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
      const rollingHills = simplex.noise2D(x * 0.0003, z * 0.0003) * 140;
      offset += rollingHills * westFactor;

      // 4. Heavily dampen roughness and rockiness so the hills are smooth, not jagged
      roughness *= 1 - westFactor * 0.85; // Was 0.7
      rockiness *= 1 - westFactor * 0.95; // Was 0.9
    }

    let n = simplex.noise2D(x * 0.001, z * 0.001) * heightScale * oceanDamping;

    if (biome > 0.2) {
      const t = Math.min(1, (biome - 0.2) * 3);
      let ridge = 1.0 - Math.abs(simplex.noise2D(x * 0.0008, z * 0.0008));
      n += (ridge * 220 - 100) * t * (1 - westFactor);
    }

    n += simplex.noise2D(x * 0.003, z * 0.003) * roughness * oceanDamping;
    n += simplex.noise2D(x * 0.01, z * 0.01) * rockiness * oceanDamping;

    if (biome < -0.4) {
      const clusterChance = simplex.noise2D(x * 0.0002, z * 0.0002);
      if (clusterChance > 0.4) {
        const islandNoise = simplex.noise2D(x * 0.005, z * 0.005);
        if (islandNoise > 0) {
          n += islandNoise * 80 * (clusterChance - 0.4) * 2 * oceanDamping;
        }
      }
    }

    n += offset;

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
        const islandRegion = simplex.noise2D(
          x * 0.0001 + 500,
          z * 0.0001 + 500
        );
        // 0.1 keeps plenty of open ocean, but increases cluster frequency
        if (islandRegion > 0.1) {
          // Domain warping to create organic, jagged coastlines instead of round blobs
          const warpX = simplex.noise2D(x * 0.0005, z * 0.0005) * 500;
          const warpZ =
            simplex.noise2D(x * 0.0005 + 100, z * 0.0005 + 100) * 500;

          const islandShape = simplex.noise2D(
            (x + warpX) * 0.0003 + 1000,
            (z + warpZ) * 0.0003 + 1000
          );

          // -0.2 makes the islands slightly larger within their clusters
          if (islandShape > -0.2) {
            const eastIntensity = Math.min(1, (x - 3000) / 7000);
            const shapeFactor = Math.max(0, islandShape + 0.2);
            const heightFactor =
              shapeFactor * (islandRegion - 0.1) * eastIntensity * finalFade;

            // Islands are steep
            if (heightFactor > 0) {
              const archetype = getIslandArchetype(x, z, simplex);

              if (archetype === 'karst') {
                // --- 1. KARST LIMESTONE TOWERS (Halong Bay style) ---
                // Low-lying coastal shelf and beach foundation
                const baseShelf =
                  Math.min(1.0, shapeFactor * 3.0) * 50 * heightFactor;

                // Domain warping for organic, jagged tower contours
                const kWarpX = simplex.noise2D(x * 0.0012, z * 0.0012) * 160;
                const kWarpZ =
                  simplex.noise2D(x * 0.0012 + 45.6, z * 0.0012 + 45.6) * 160;

                // Tower noise defines the locations of individual monolithic pillars
                const towerNoise = simplex.noise2D(
                  (x + kWarpX) * 0.00075 + 300,
                  (z + kWarpZ) * 0.00075 + 300
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
                const stackNoise = simplex.noise2D(
                  x * 0.002 + 777,
                  z * 0.002 + 777
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
                  simplex.noise2D(x * 0.0035, z * 0.0035) * 45 * heightFactor;

                n += baseShelf + towerHeight + canopy;
              } else if (archetype === 'caldera') {
                // --- 2. MASSIVE VOLCANIC CALDERAS ---
                // Imposing volcanic island with broad flanks rising to an undulating crater rim,
                // plunging inside into a sunken caldera lagoon with a central resurgent cone.
                const rimCenter = 0.46;
                const maxRimElevation = 950 * heightFactor;

                // Volcanic radial erosion fluting
                const gullyNoise =
                  1.0 - Math.abs(simplex.noise2D(x * 0.0014, z * 0.0014));
                const gully = gullyNoise * gullyNoise * 140 * heightFactor;

                // Organic rim variation
                const rimWobble =
                  simplex.noise2D(x * 0.00075 + 111, z * 0.00075 + 111) *
                  110 *
                  heightFactor;

                // Natural sea breach on one side
                const breachNoise = simplex.noise2D(
                  x * 0.00045 + 500,
                  z * 0.00045 + 500
                );
                const breachDip =
                  Math.max(0, breachNoise - 0.28) * 350 * heightFactor;

                // Base mountain volume: ensures the volcano has solid, wide land flanks
                const mountainBase =
                  Math.min(1.0, shapeFactor * 2.2) * 220 * heightFactor;

                let calderaHeight = 0;
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
                  simplex.noise2D(x * 0.003, z * 0.003) * 35 * heightFactor;
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
                const passNoise = simplex.noise2D(
                  x * 0.0018 + 444,
                  z * 0.0018 + 444
                );
                const motuFactor = Math.max(0, passNoise + 0.15);

                // Motu dry land elevation: rises to elevation 46 - 72 (6 - 32m above water level 40)
                const motuElevation =
                  ringMask *
                  (10 + motuFactor * 24) *
                  Math.min(1.0, clusterIntensity * 2.5);

                // Lagoon: broad, shallow protected waters inside the barrier ring (shapeFactor > ringCenter)
                let lagoonCarve = 0;
                if (shapeFactor > ringCenter) {
                  const innerLagoon = Math.min(
                    1.0,
                    (shapeFactor - ringCenter) / 0.15
                  );
                  // Carves down by 5-6 units so the lagoon bed sits at elevation 31-33 (shallow turquoise water)
                  lagoonCarve = innerLagoon * innerLagoon * 5.5;

                  // Isolated sandbanks or small coral pinnacles (bommies) in the center of the lagoon
                  if (shapeFactor > 0.65) {
                    const pinnacleNoise = simplex.noise2D(
                      x * 0.0025 + 888,
                      z * 0.0025 + 888
                    );
                    if (pinnacleNoise > 0.25) {
                      lagoonCarve -=
                        Math.pow((pinnacleNoise - 0.25) / 0.75, 1.5) * 11;
                    }
                  }
                }

                // Fine sand dunes and beach berms
                const sandDunes =
                  simplex.noise2D(x * 0.006, z * 0.006) * 3.0 * ringMask;

                n += reefPlatform + motuElevation - lagoonCarve + sandDunes;
              } else {
                // Standard ridged mountain islands (fallback until Caldera & Atoll are implemented)
                // Add ridged noise for jagged peaks
                const ridgeNoise =
                  1.0 - Math.abs(simplex.noise2D(x * 0.001, z * 0.001));
                const ruggedness = ridgeNoise * ridgeNoise; // Sharpen ridges

                // Base height + mountain peaks
                let islandHeight = heightFactor * 600; // Base land
                islandHeight += ruggedness * 1200 * heightFactor; // Sharp peaks

                // Small scale surface roughness
                islandHeight +=
                  simplex.noise2D(x * 0.003, z * 0.003) * 150 * heightFactor;

                n += islandHeight;
              }
            }
          }
        }
      }
    }

    // --- LARGE LAKES LOGIC (West) ---
    if (x < -3000) {
      const lakeRegion = simplex.noise2D(x * 0.0001 + 200, z * 0.0001 + 200);
      if (lakeRegion > 0.2) {
        const lakeShape = simplex.noise2D(x * 0.0003 + 300, z * 0.0003 + 300);
        if (lakeShape > -0.1) {
          const westIntensity = Math.min(1, (-x - 3000) / 7000);
          const shapeFactor = Math.max(0, lakeShape + 0.1);
          let depthFactor = shapeFactor * (lakeRegion - 0.2) * westIntensity;
          if (depthFactor > 0) {
            n -= depthFactor * 800; // Carve down
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
        const ridgeMeander = simplex.noise2D(x * 0.0001 + rangeLat * 100, 123);
        const currentZCenter = zCenterBase + ridgeMeander * 2000;

        // Vary mountain presence - some areas have peaks, others are just foothills
        const presenceMod =
          0.5 + simplex.noise2D(x * 0.0002 + rangeLat * 50, 789) * 0.5; // [0, 1]

        const dxRange = xStart - x;
        const fadeIn = Math.min(1, dxRange / 5000);

        const dz = z - currentZCenter;
        const dist = Math.abs(dz);

        // 1. Broad base "mass" with lateral branching spurs and cirque bowls
        const side = dz >= 0 ? 1 : -1;
        // Angled spur coordinate branches out at ~37 degrees from the central spine
        const spurCoord = x * 0.8 + side * dist * 0.6;
        const spurFreq = 0.0009;
        const spurRidge =
          1.0 -
          Math.abs(
            simplex.noise2D(
              spurCoord * spurFreq + rangeLat * 23.7,
              dist * 0.0004 + 127.3
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
              simplex.noise2D(
                x * 0.0008 + rangeLat * 31.2,
                z * 0.0008 + rangeLat * 54.1
              ) *
                0.65 +
              simplex.noise2D(x * 0.0018 + 73.1, z * 0.0018 + 89.2) * 0.35;
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
              simplex.noise2D(x * 0.0004 + rangeLat * 12.3, z * 0.0004) * 350;
            const warpZ =
              simplex.noise2D(x * 0.0004, z * 0.0004 + rangeLat * 34.5) * 350;
            const qx = x + warpX;
            const qz = z + warpZ;

            // 3-octave ridged multifractal: broad massifs -> arêtes -> crags
            let r1 = 1.0 - Math.abs(simplex.noise2D(qx * 0.0007, qz * 0.0007));
            r1 = Math.pow(r1, 1.3);

            let r2 =
              1.0 -
              Math.abs(
                simplex.noise2D(qx * 0.0016 + 127.1, qz * 0.0016 + 311.7)
              );
            r2 = Math.pow(r2, 1.4);

            let r3 =
              1.0 -
              Math.abs(
                simplex.noise2D(qx * 0.0035 + 241.3, qz * 0.0035 + 189.5)
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
          const valleyNoise = simplex.noise2D(
            x * 0.00012 + rangeLat * 77,
            z * 0.00012 + rangeLat * 88
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
    const dxV = x - vX;
    const dzV = z - vZ;
    const distSqV = dxV * dxV + dzV * dzV;
    const vRadius = 1200; // Increased radius for check area

    if (distSqV < vRadius * vRadius * 4) {
      // Check wide area
      const distV = Math.sqrt(distSqV);

      // Add noise to the distance to make the shape irregular (domain warping)
      const warpNoise = simplex.noise2D(x * 0.0005, z * 0.0005) * 200;
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

      n += vHeight - vCrater;

      // Fix glitchy water by preventing extremely shallow shelves at the volcano base.
      if (n > WATER_LEVEL && n < WATER_LEVEL + 1.5) {
        n = WATER_LEVEL;
      }
    }

    // --- RIVER CARVING LOGIC ---
    // Runs after all additive terrain passes (mountains, volcano) so it always wins.
    if (!options.ignoreRivers) {
      let maxRiverFactor = 0;

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
            const widthNoise = simplex.noise2D(x * 0.0005, 200);
            const widthVariation = (widthNoise + 1) * 0.5; // Map from [-1, 1] to [0, 1]
            riverWidth = 120 + widthVariation * 180; // Min 120, max 300
            riverBankWidth = 100 + widthVariation * 100;
          } else {
            // Smaller rivers
            const widthNoise = simplex.noise2D(x * 0.0008, l * 10.0);
            const widthVariation = (widthNoise + 1) * 0.5;
            riverWidth = 100 + widthVariation * 100; // Min 100, max 200
            riverBankWidth = 60 + widthVariation * 40;
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
          }
        }
      }

      if (maxRiverFactor > 0 && n > WATER_LEVEL - 5) {
        // Carve down to well below wave troughs (WATER_LEVEL - 5), but never raise existing seabed
        const riverBed = WATER_LEVEL - 5;
        n = Math.min(n, _lerp(n, riverBed, maxRiverFactor));
      }
    }

    // --- HIGHWAY TRENCH CARVING LOGIC ---
    if (!options.ignoreRoads) {
      // Find the closest highway index mathematically
      const highwayIndex = Math.round((x - ROAD_BASE_X) / ROAD_SPACING);
      const roadCenterX = getRoadCenterX(z, highwayIndex);
      const distToRoad = Math.abs(x - roadCenterX);

      const CANYON_FLOOR_WIDTH = 50; // Flat area at the bottom for the road to sit in

      // Conservative check to avoid computing center elevation for far away points
      const MAX_POSSIBLE_WALL_WIDTH = 3500;

      if (distToRoad < CANYON_FLOOR_WIDTH + MAX_POSSIBLE_WALL_WIDTH) {
        // Find the intended natural height of the road center
        // We MUST ignore roads and rivers here to avoid recursion and hitting trenches
        const centerNaturalH = getElevation(
          roadCenterX,
          z,
          simplex,
          constants,
          _lerp,
          {ignoreRivers: true, ignoreRoads: true, forRoad: true}
        );

        if (roadCenterX >= 0) {
          return n;
        }

        const MIN_ROAD_HEIGHT = WATER_LEVEL + 60;
        let roadY = MIN_ROAD_HEIGHT + (centerNaturalH - MIN_ROAD_HEIGHT) * 0.85;
        roadY = Math.max(roadY, MIN_ROAD_HEIGHT);
        roadY = Math.min(roadY, MAX_HIGHWAY_HEIGHT);

        // Dynamically scale wall width based on depth of the cut to maintain a smooth slope
        const canyonDepth = Math.max(0, centerNaturalH - roadY);
        const CANYON_WALL_WIDTH = 250 + canyonDepth * 1.5;

        if (distToRoad < CANYON_FLOOR_WIDTH + CANYON_WALL_WIDTH) {
          // If the terrain is higher than the road, carve a canyon
          if (n > roadY) {
            let carveFactor = 0;
            if (distToRoad <= CANYON_FLOOR_WIDTH) {
              carveFactor = 1.0;
            } else {
              // Smoothly slope the canyon walls up to the natural terrain
              const t = (distToRoad - CANYON_FLOOR_WIDTH) / CANYON_WALL_WIDTH;
              carveFactor = 1.0 - t * t * (3 - 2 * t);
            }

            if (carveFactor > 0) {
              // roadY - 2.5 avoids clipping and z-fighting with the road deck
              n = _lerp(n, roadY - 2.5, carveFactor);
            }
          }
        }
      }
    }

    // --- EASTERN ALIEN BIOME (Beyond 10 degrees East) ---
    // Swirling domain-warped ridges, organic shorelines, and alien sea basins
    const extremeEdge = 50000;
    if (x > extremeEdge) {
      const extremeFactor = Math.min(1.0, (x - extremeEdge) / 3000);
      const ef = extremeFactor * extremeFactor * (3 - 2 * extremeFactor);

      const warpStrength = Math.max(0.3, ef) * 3000;
      const wx1 = simplex.noise2D(x * 0.0002, z * 0.0002 + 77.3) * warpStrength;
      const wz1 = simplex.noise2D(x * 0.0002 + 33.1, z * 0.0002) * warpStrength;
      const wx2 =
        simplex.noise2D((x + wx1) * 0.00015, (z + wz1) * 0.00015 + 11.5) *
        warpStrength *
        0.5;
      const wz2 =
        simplex.noise2D((x + wx1) * 0.00015 + 55.2, (z + wz1) * 0.00015) *
        warpStrength *
        0.5;
      // Medium-frequency organic coastal warp to break up grid alignment
      const wx3 =
        simplex.noise2D((x + wx1) * 0.0008, (z + wz1) * 0.0008 + 91.2) * 500;
      const wz3 =
        simplex.noise2D((x + wx1) * 0.0008 + 41.8, (z + wz1) * 0.0008) * 500;
      const xw = x + wx1 + wx2 + wx3;
      const zw = z + wz1 + wz2 + wz3;

      const broadBase = simplex.noise2D(xw * 0.0003, zw * 0.0003);

      if (broadBase > 0.05) {
        const shapeFactor = Math.min(1.0, (broadBase - 0.05) * 4.0);
        const ridge1 =
          1.0 - Math.abs(simplex.noise2D(xw * 0.0006, zw * 0.0006));
        const ridge2 =
          1.0 - Math.abs(simplex.noise2D(xw * 0.0012, zw * 0.0012));
        const ridgeVal = ridge1 * 0.6 + ridge2 * 0.25 + broadBase * 0.15;
        // Surface roughness at 0.003 frequency to give organic low-poly detail
        const roughness =
          simplex.noise2D(xw * 0.003, zw * 0.003) * 40 * shapeFactor;
        const heightScale = _lerp(260, 600, ef);
        n += (ridgeVal * heightScale + roughness + 25) * shapeFactor * ef;
      } else {
        const basinDepth = Math.min(1, -broadBase * 2.5);
        const basinSmooth = basinDepth * basinDepth * (3 - 2 * basinDepth);
        if (n > WATER_LEVEL - 10) {
          n = Math.max(
            WATER_LEVEL - 10,
            n + (WATER_LEVEL - 10 - n) * basinSmooth * ef
          );
        }
      }

      if (n < WATER_LEVEL - 10) n = WATER_LEVEL - 10;
    }
    // --- WESTERN ALIEN BIOME (Beyond 10 degrees West) ---
    // Massive geometric stepped plateaus, jagged crystal spires, and deep fractured chasms
    else if (x < -extremeEdge) {
      const extremeFactor = Math.min(1.0, (-x - extremeEdge) / 15000);
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
      const spireNoise = simplex.noise2D(x * 0.0015, z * 0.0015);
      if (spireNoise > 0.5) {
        // Square the noise to make the peaks very narrow and sharp
        const spikeHeight = Math.pow((spireNoise - 0.5) * 2.0, 3) * 3000;
        n += spikeHeight * ef;
      }

      // 3. Endless Chasms (Deep, narrow fractures intersecting)
      const chasm1 = Math.abs(simplex.noise2D(x * 0.0008, z * 0.0008));
      const chasm2 = Math.abs(
        simplex.noise2D(x * 0.0008 + 100, z * 0.0008 + 100)
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

    // --- FROZEN NORTH ICE SHELF ---
    let isIceShelf = false;
    // Start freezing around 4°N (Z=-20000), fully frozen ~5000 units later
    const freezeBoundaryZ =
      -20000 + simplex.noise2D(x * 0.0002, z * 0.0002) * 2000;
    if (z < freezeBoundaryZ) {
      const freezeFactor = Math.min(1, (freezeBoundaryZ - z) / 5000);
      if (freezeFactor > 0) {
        // Create an ice shelf that is strictly above water (WATER_LEVEL + 3 to WATER_LEVEL + 7)
        const targetIceLevel =
          WATER_LEVEL +
          3 +
          Math.abs(simplex.noise2D(x * 0.0005, z * 0.0005)) * 4;

        // Instead of lerping the height (which creates a gentle slope that z-fights with waves),
        // we use a noise threshold to create an organic, sharp ice cliff.
        // We use a low-frequency noise (0.0005) so the boundary doesn't alias/flicker on low-LOD chunks.
        const edgeNoise = simplex.noise2D(x * 0.0005, z * 0.0005) * 0.5 + 0.5; // 0 to 1

        if (freezeFactor > edgeNoise) {
          if (n < targetIceLevel) {
            n = targetIceLevel;
            isIceShelf = true;
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

    return n;
  }

  // --- EXPORTS ---
  exports.customMap = null;
  exports.WORLD_SEED = WORLD_SEED;
  exports.mulberry32 = mulberry32;
  exports.chunkRng = chunkRng;
  exports.PLANE_COLORS = PLANE_COLORS;
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
    const macroMeander = simplex.noise2D(x * 0.00002, noiseOffset + 50) * 5000;
    baseRiverZ += macroMeander;

    // Squiggle intensity factor: Changes slowly over 20,000 units
    const squiggleFactor =
      (simplex.noise2D(x * 0.00005, noiseOffset + 100) + 1) * 0.5; // [0, 1]

    if (l === 0) {
      // Equator river (massive main river)
      const freq1 = 0.0001;
      const amp1 = 1500 + squiggleFactor * 2500; // Large sweeping curves

      const freq2 = 0.0002;
      const amp2 = 500 + squiggleFactor * 800; // Medium detail

      return (
        baseRiverZ +
        simplex.noise2D(x * freq1, 0) * amp1 +
        simplex.noise2D(x * freq2, 100) * amp2
      );
    } else {
      // Additional rivers
      const freq1 = 0.00015;
      const amp1 = 1000 + squiggleFactor * 2000;

      const freq2 = 0.0003;
      const amp2 = 300 + squiggleFactor * 600;

      return (
        baseRiverZ +
        simplex.noise2D(x * freq1, noiseOffset) * amp1 +
        simplex.noise2D(x * freq2, noiseOffset + 50) * amp2
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
  const ROAD_WIDTH = 30; // Half-width of the paved road surface
  const ROAD_SHOULDER = 10; // Width of the shoulder/blend zone on each side

  function getRoadSweepOffset(z, n = 0) {
    // --- VOLCANO AVOIDANCE (CONTINUOUS DOMAIN WARPING) ---
    // The volcano is located exactly at X = -5000, Z = 5000.
    // Instead of a radial repulsion field (which creates a massive teleportation discontinuity if the road crosses X=-5000),
    // we smoothly warp the base sweep noise to steer the road predictably East (X = -2500) as it approaches Z = 5000.
    const VOLCANO_Z = 5000;
    const AVOID_Z_RADIUS = 3000; // Start veering 3000 units north/south of the volcano

    // Offset Z significantly based on highway index 'n' to ensure each highway is totally unique
    const zNoise = z + n * 99999;

    let baseSweep = simplex.noise2D(zNoise * 0.0001, 777);
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
    const detail = simplex.noise2D(zNoise * 0.0003, 888) * detailAmplitude;

    // Layer 3: Small wobbles (wavelength ~1,000 units)
    const wobble = simplex.noise2D(zNoise * 0.001, 999) * 100;

    return sweep + detail + wobble;
  }

  function getRoadCenterX(z, n = 0) {
    return ROAD_BASE_X + n * ROAD_SPACING + getRoadSweepOffset(z, n);
  }

  // Returns a [0, 1] factor indicating how much a point is on the road.
  // 1.0 = fully on road, 0.0 = outside road + shoulder.
  function getRoadFactor(x, z) {
    // Determine the closest highway index `n` mathematically.
    // The road is at ROAD_BASE_X + n * ROAD_SPACING + sweep.
    // We can estimate `n` by ignoring the sweep first (which is max +/- 3000).
    const n = Math.round((x - ROAD_BASE_X) / ROAD_SPACING);

    // Now get the exact center X of the closest highway
    const centerX = getRoadCenterX(z, n);
    const dist = Math.abs(x - centerX);

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
  exports.getElevation = getElevation;
  exports.getRiverCenterZ = getRiverCenterZ;
  exports.getRoadCenterX = getRoadCenterX;
  exports.getRoadFactor = getRoadFactor;
  exports.ROAD_BASE_X = ROAD_BASE_X;
  exports.ROAD_SPACING = ROAD_SPACING;
  exports.ROAD_WIDTH = ROAD_WIDTH;
  exports.ROAD_SHOULDER = ROAD_SHOULDER;
  exports.MAX_HIGHWAY_HEIGHT = MAX_HIGHWAY_HEIGHT;
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
  exports.START_BENCHMARK = START_BENCHMARK;
  exports.GRAPHICS_PRESET = GRAPHICS_PRESET;
  exports.ZENITH_COLOR = ZENITH_COLOR;
  exports.HORIZON_COLOR = HORIZON_COLOR;
  exports.DAY_COLOR = DAY_COLOR;
  exports.START_ISLAND_TYPE = START_ISLAND_TYPE;
  exports.FORCE_ISLAND_TYPE = FORCE_ISLAND_TYPE;
  exports.getIslandArchetype = getIslandArchetype;
  exports.START_PLANE = START_PLANE;
  exports.PLANE_TYPES = PLANE_TYPES;
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
    newYaw += safeTurningRoll * turnFactor * delta * 60;

    return {pitch: newPitch, roll: newRoll, yaw: newYaw};
  }

  exports.computeFlightRotation = computeFlightRotation;
})(
  typeof module !== 'undefined'
    ? module.exports
    : (window.ChillFlightLogic = {})
);
