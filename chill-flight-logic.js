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
  const SHOW_CLOUDS = getParam('cloud', null) !== 'none';

  const ENABLE_MP = getParam('enableMp', 'false') === 'true';
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
  const SCALE = parseFloat(getParam('scale', '1.0'));
  const ENABLE_V = getParam('enableV', 'false') === 'true';
  const START_FREE_CAM =
    getParam('freecam', 'false') === 'true' ||
    getParam('freeCamera', 'false') === 'true';

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

  const _todParam = getParam('tod', null);
  const START_TOD =
    _todParam !== null && _todParam !== '' ? parseFloat(_todParam) : null;

  const _timeSpeedParam = getParam('timeSpeed', null);
  const START_TIME_SPEED =
    _timeSpeedParam !== null && _timeSpeedParam !== ''
      ? parseFloat(_timeSpeedParam)
      : null;

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
  // which order chunks are loaded—critical for multiplayer consistency.
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
    const eastCoastFactor = Math.max(0, Math.min(1, x / 3000));
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
    if (n < WATER_LEVEL - 1) {
      n = WATER_LEVEL - 1;
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

        // 1. Broad base "mass" (Gaussian)
        const baseRadius = 2500;
        const baseDistSq = dz * dz;
        const baseFalloff = Math.exp(
          -baseDistSq / (2 * baseRadius * baseRadius)
        );

        if (baseFalloff > 0.01) {
          // 2. Sharper peaks (Power function)
          const peakRadius = 1800;
          const peakDist = Math.min(peakRadius, dist);
          // Increased exponent to 2.8 for steeper ascent curves
          const peakShape = Math.pow(1.0 - peakDist / peakRadius, 2.8);

          // 3. Ridged Multi-Fractal ruggedness (Sharp Peaks)
          // Math.abs creates valleys, 1.0 - Math.abs flips them into sharp ridges
          let ridge1 = 1.0 - Math.abs(simplex.noise2D(x * 0.002, z * 0.002));
          let ridge2 = 1.0 - Math.abs(simplex.noise2D(x * 0.006, z * 0.006));

          // Squaring the ridges sharpens the drop-off even further
          ridge1 *= ridge1;
          ridge2 *= ridge2;

          const ruggedness = ridge1 * 0.8 + ridge2 * 0.4 + 0.1;

          // Combine: Peaks rise out of the broad base mass
          const baseHeight = 300 * baseFalloff; // Smooth foothold
          // Use presenceMod to make some peaks much higher than others
          const peakHeight =
            maxHeight * peakShape * ruggedness * (0.4 + 0.6 * presenceMod);

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

      if (maxRiverFactor > 0) {
        // Carve down to just below water level, overriding any mountain/volcano additions
        n = _lerp(n, WATER_LEVEL - 2, maxRiverFactor);
      }
    }

    // --- HIGHWAY TRENCH CARVING LOGIC ---
    if (!options.ignoreRoads) {
      const roadCenterX = getRoadCenterX(z);
      const distToRoad = Math.abs(x - roadCenterX);

      const CANYON_FLOOR_WIDTH = 50; // Flat area at the bottom for the road to sit in
      const CANYON_WALL_WIDTH = 250; // How far the walls smoothly slope out

      if (distToRoad < CANYON_FLOOR_WIDTH + CANYON_WALL_WIDTH) {
        // Find the intended natural height of the road center
        // We MUST ignore roads and rivers here to avoid recursion and hitting trenches
        const centerNaturalH = exports.getElevation(
          roadCenterX,
          z,
          simplex,
          constants,
          _lerp,
          {ignoreRivers: true, ignoreRoads: true}
        );

        const MIN_ROAD_HEIGHT = WATER_LEVEL + 60;
        let roadY = Math.max(centerNaturalH + 2, MIN_ROAD_HEIGHT);
        roadY = Math.min(roadY, exports.MAX_HIGHWAY_HEIGHT);

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
            // roadY - 1 avoids z-fighting with the road deck
            n = _lerp(n, roadY - 1, carveFactor);
          }
        }
      }
    }

    // --- EASTERN ALIEN BIOME (Beyond 10 degrees East) ---
    // Swirling domain-warped ridges and alien sea basins
    const extremeEdge = 50000;
    if (x > extremeEdge) {
      const extremeFactor = Math.min(1.0, (x - extremeEdge) / 15000);
      const ef = extremeFactor * extremeFactor * (3 - 2 * extremeFactor);

      const warpStrength = ef * 3000;
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
      const xw = x + wx1 + wx2;
      const zw = z + wz1 + wz2;

      const broadBase = simplex.noise2D(xw * 0.0003, zw * 0.0003);

      if (broadBase > 0) {
        const ridge1 =
          1.0 - Math.abs(simplex.noise2D(xw * 0.0006, zw * 0.0006));
        const ridge2 =
          1.0 - Math.abs(simplex.noise2D(xw * 0.0012, zw * 0.0012));
        const ridgeVal = ridge1 * 0.6 + ridge2 * 0.25 + broadBase * 0.15;
        n += ridgeVal * 600 * ef;
      } else {
        const basinDepth = Math.min(1, -broadBase * 2.5);
        const basinSmooth = basinDepth * basinDepth * (3 - 2 * basinDepth);
        n = n + (WATER_LEVEL - 5 - n) * basinSmooth * ef;
      }

      if (n < WATER_LEVEL - 4) n = WATER_LEVEL - 4;
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

      if (n < WATER_LEVEL - 1) n = WATER_LEVEL - 1;
    }

    // Final water level clamp
    if (n < WATER_LEVEL - 1) {
      n = WATER_LEVEL - 1;
    }

    // --- FROZEN NORTH ICE SHELF ---
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
        let blendedIce = _lerp(n, targetIceLevel, freezeFactor);

        // Pack ice has a distinct edge. If it's barely above water, snap it up to avoid Z-fighting.
        if (blendedIce > WATER_LEVEL && blendedIce < WATER_LEVEL + 2.5) {
          blendedIce = WATER_LEVEL + 2.5;
        }

        if (n < blendedIce) {
          n = blendedIce;
        }
      }
    }

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
  const ROAD_WIDTH = 30; // Half-width of the paved road surface
  const ROAD_SHOULDER = 10; // Width of the shoulder/blend zone on each side
  const MAX_HIGHWAY_HEIGHT = 40 + 400; // Maximum altitude before carving a trench (WATER_LEVEL + 400)

  function getRoadCenterX(z) {
    // Layer 1: Large sweeping curves (wavelength ~10,000 units)
    // Amplified to 2500 so it swings between -2500 (0.5W) and -7500 (1.5W)
    const sweep = simplex.noise2D(z * 0.0001, 777) * 2500;
    // Layer 2: Medium detail curves (wavelength ~3,000 units)
    const detail = simplex.noise2D(z * 0.0003, 888) * 500;
    // Layer 3: Small wobbles (wavelength ~1,000 units)
    const wobble = simplex.noise2D(z * 0.001, 999) * 100;

    let x = ROAD_BASE_X + sweep + detail + wobble;

    // --- VOLCANO AVOIDANCE (REPULSION FIELD) ---
    // The volcano is located exactly at X = -5000, Z = 5000.
    const VOLCANO_X = -5000;
    const VOLCANO_Z = 5000;
    const VOLCANO_AVOID_RADIUS = 2500; // Pushes road up to 2500 units away from center

    const dxV = x - VOLCANO_X;
    const dzV = z - VOLCANO_Z;
    const distSqV = dxV * dxV + dzV * dzV;

    if (distSqV < VOLCANO_AVOID_RADIUS * VOLCANO_AVOID_RADIUS) {
      const dist = Math.sqrt(distSqV);
      // We are inside the danger zone! Calculate a smooth push factor.
      const t = (VOLCANO_AVOID_RADIUS - dist) / VOLCANO_AVOID_RADIUS;
      const smoothFactor = t * t * (3 - 2 * t); // Smoothstep for seamless blend
      const pushAmount = smoothFactor * VOLCANO_AVOID_RADIUS;

      // Push east or west depending on which side of the center it's naturally on
      if (dxV <= 0) {
        x -= pushAmount;
      } else {
        x += pushAmount;
      }
    }

    // --- LAKE AVOIDANCE (DOMAIN WARPING) ---
    // Repel the road away from deep lakes using the gradient of the lake noise
    if (x < -3000) {
      const lakeRegion = simplex.noise2D(x * 0.0001 + 200, z * 0.0001 + 200);

      // Start avoiding when getting near a lake region
      if (lakeRegion > 0.0) {
        const lakeShape = simplex.noise2D(x * 0.0003 + 300, z * 0.0003 + 300);

        if (lakeShape > -0.2) {
          // Calculate the gradient (slope) of the lake shape along the X axis
          const dx = 50;
          const shapeLeft = simplex.noise2D(
            (x - dx) * 0.0003 + 300,
            z * 0.0003 + 300
          );
          const shapeRight = simplex.noise2D(
            (x + dx) * 0.0003 + 300,
            z * 0.0003 + 300
          );

          // Positive gradient means the lake gets deeper to the East (right)
          const gradX = (shapeRight - shapeLeft) / (2 * dx);

          // Calculate how intense the lake is at the original base X position
          const intensity =
            Math.max(0, lakeRegion) * Math.max(0, lakeShape + 0.2);

          // Push X smoothly down the gradient (away from the lake center).
          x -= gradX * intensity * 400000;
        }
      }
    }

    return x;
  }

  // Returns a [0, 1] factor indicating how much a point is on the road.
  // 1.0 = fully on road, 0.0 = outside road + shoulder.
  function getRoadFactor(x, z) {
    const centerX = getRoadCenterX(z);
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
  exports.ROAD_WIDTH = ROAD_WIDTH;
  exports.ROAD_SHOULDER = ROAD_SHOULDER;
  exports.MAX_HIGHWAY_HEIGHT = MAX_HIGHWAY_HEIGHT;
  exports.lerpAngle = lerpAngle;

  // Export centralized URL parameters
  exports.urlParams = urlParams;
  exports.THEME = THEME;
  exports.SHOW_CLOUDS = SHOW_CLOUDS;

  exports.ENABLE_MP = ENABLE_MP;
  exports.SHOW_OBJECTS = SHOW_OBJECTS;
  exports.setShowObjects = (val) => {
    exports.SHOW_OBJECTS = val;
  };
  exports.MAP_NAME = MAP_NAME;
  exports.PALETTE_INDEX = PALETTE_INDEX;
  exports.SCALE = SCALE;
  exports.ENABLE_V = ENABLE_V;
  exports.parsedLat = parsedLat;
  exports.parsedLon = parsedLon;
  exports.parsedAlt = validAlt;
  exports.START_FREE_CAM = START_FREE_CAM;
  exports.START_X = START_X;
  exports.START_Y = START_Y;
  exports.START_Z = START_Z;
  exports.START_HEADING = START_HEADING;
  exports.START_PITCH = START_PITCH;
  exports.START_TOD = START_TOD;
  exports.START_TIME_SPEED = START_TIME_SPEED;
})(
  typeof module !== 'undefined'
    ? module.exports
    : (window.ChillFlightLogic = {})
);
