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

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

    // Helper to get parameters safely in both Browser and Node (for tests)
    const getParam = (key, defaultValue) => {
        if (!urlParams) return defaultValue;
        const val = urlParams.get(key);
        return val === null ? defaultValue : val;
    };

    const WORLD_SEED = parseInt(getParam('seed', getTodaySeed()), 10);
    const THEME = getParam('theme', 'standard');
    const SHOW_CLOUDS = getParam('cloud', null) !== 'none';
    let SHOW_OBJECTS = true;
    const objectsParam = getParam('objects', null);
    if (objectsParam === 'none') {
        SHOW_OBJECTS = false;
    } else if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('chill_flight_show_objects');
        if (saved !== null) {
            SHOW_OBJECTS = (saved === 'true');
        }
    }

    const MAP_NAME = getParam('map', null);
    const PALETTE_INDEX = getParam('palette', null);
    const SCALE = parseFloat(getParam('scale', '1.0'));

    // --- SEEDED PRNG: Mulberry32 ---
    // Returns a closure that produces deterministic floats in [0, 1).
    // Usage: const rng = mulberry32(seed); rng(); // next value
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = seed + 0x6D2B79F5 | 0;
            var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // Per-chunk seeded PRNG. Derives a unique seed from (WORLD_SEED, chunkX, chunkZ) so
    // each chunk's detail generation (trees, clouds, birds) is identical regardless of
    // which order chunks are loaded—critical for multiplayer consistency.
    function chunkRng(chunkX, chunkZ) {
        const s = (WORLD_SEED * 1000003) ^ (chunkX * 374761393 + chunkZ * 1234567891);
        return mulberry32(s);
    }

    // --- PLANE COLOR ---
    // Deterministic color picker based on a hash of the user's UID.
    const PLANE_COLORS = [
        0xe74c3c, // Sunset Red
        0x3498db, // Sky Blue
        0x2ecc71, // Emerald
        0xf1c40f, // Amber
        0x9b59b6, // Amethyst
        0x34495e, // Slate
        0xe67e22, // Orange
        0x1abc9c, // Turquoise
        0xd35400, // Pumpkin
        0xc0392b  // Dark Red
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
    // Maps raw cycle progress [0,1) to a warped time-of-day [0,1) that
    // lingers during sunrise/sunset and rushes through night and midday.
    //
    // Knot table: [unwarped_p, warped_p]
    // The SLOPE of each segment (dw/dp) is the sun's visual speed multiplier:
    //   slope > 1 → sun moves faster than real-time (night, midday)
    //   slope < 1 → sun moves slower than real-time (golden hour near horizon)
    //
    // Visual horizon crossing = warpedP 0.25 (sunrise) and 0.75 (sunset).
    // The "horizon zone" segment is centered on those values and has slope 0.40
    // so the sun crawls visibly slowly near the horizon.
    //
    // Segment slopes (dw/dp):
    //   Night       p [0.00–0.10]: slope 2.00x  → night passes quickly
    //   Horizon zone p [0.10–0.35]: slope 0.40x  → sun crawls near horizon ✓
    //   Midday climb p [0.35–0.50]: slope 1.33x  → sun rises/sets at moderate speed
    //   [Symmetric for second half]
    //
    // Phase durations (5-min cycle): ~1m night, ~2.5m horizon glow, ~1.5m midday
    function computeTimeOfDay(secondsInCycle, latInRadians = 0.71) {
        const CYCLE_DURATION_S = 300;
        const p = (secondsInCycle % CYCLE_DURATION_S) / CYCLE_DURATION_S;

        // [unwarped_p, warped_p] — edit warped_p to tune feel.
        const knots = [
            [0.000, 0.000],  // midnight
            [0.100, 0.200],  // end of night      → slope 2.00x (fast night)
            [0.350, 0.300],  // horizon zone ends  → slope 0.40x (slow sun near horizon)
            [0.500, 0.500],  // solar noon         → slope 1.33x (moderate climb)
            [0.650, 0.700],  // horizon zone starts (symmetric)
            [0.900, 0.800],  // night begins       (symmetric)
            [1.000, 1.000],  // midnight
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
            y: -(clientY / height) * 2 + 1
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
            }
            biomeBase += mtnInf;
        }

        return Math.max(-1, Math.min(1, biomeBase + noise));
    }

    // --- ELEVATION ---
    // Returns the terrain height (always >= WATER_LEVEL) for a given world (x, z) position.
    // Requires a simplex noise object and a constants object { WATER_LEVEL, MOUNTAIN_LEVEL }.
    // The lerp argument defaults to a simple linear interpolation if not provided.
    function getElevation(x, z, simplex, constants, lerp) {
        const { WATER_LEVEL, MAP_WORLD_SIZE = 5000, MAP_HEIGHT_SCALE = 1000 } = constants;
        const _lerp = lerp || function (a, b, t) { return a + (b - a) * t; };

        // --- MASSIVE MOUNTAIN LOGIC ---
        // deterministic center between -2 and 2 lat/long
        // latScale is 5000 (from game.js)
        // latVal = -z / 5000 => z = -latVal * 5000
        // lonVal = x / 5000 => x = lonVal * 5000
        const latScale = 5000;
        const mtLat = -1; // 1 South
        const mtLon = -1; // 1 West
        const mtMaxHeight = 1600;
        const xStart = mtLon * latScale; // -5000
        const zCenterBase = -mtLat * latScale; // 5000

        // --- CUSTOM MAP INGESTION ---
        if (exports.customMap) {
            const { data, width, height } = exports.customMap;

            // u, v should map from world coords (-worldWidth/2 to +worldWidth/2)
            // to image coords (0 to 1)
            const mapWidth = exports.customMap.worldWidth || MAP_WORLD_SIZE;
            const mapHeight = exports.customMap.worldHeight || MAP_WORLD_SIZE;

            const u = (x / mapWidth) + 0.5;
            const v = (z / mapHeight) + 0.5;

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
            const h11 = data[(y1 * width) + x1];
            const h21 = data[(y1 * width) + x2];
            const h12 = data[(y2 * width) + x1];
            const h22 = data[(y2 * width) + x2];

            // Handle undefined cases gracefully if somehow OOB
            if (h11 === undefined || h21 === undefined || h12 === undefined || h22 === undefined) {
                return WATER_LEVEL;
            }

            const r1 = _lerp(h11, h21, dx);
            const r2 = _lerp(h12, h22, dx);

            const normalizedHeight = _lerp(r1, r2, dy) / 255.0;
            // --- ALTITUDE-BASED MAPPING ---
            // Map 0-255 luminance to a world Y range of 38.0 -> 125.5.
            // In-game altitude 2000ft is approximately 125.5 world units.
            // Starting at 38.0 ensures that luminance 0 is slightly underwater (WATER_LEVEL=40).
            return 38.0 + (normalizedHeight * 87.5);
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
            oceanDamping = Math.max(0, 1.0 - ((-0.1 - biome) * 4));
            oceanDamping = Math.pow(oceanDamping, 2); // Sharper transition
        }

        // East coast beach flattening
        const eastCoastFactor = Math.max(0, Math.min(1, x / 3000));
        if (eastCoastFactor > 0) {
            if (biome < 0.1 && biome > -0.3) {
                // Peek flattening around biome = -0.1 (the shoreline)
                const shoreDist = 1.0 - Math.abs(biome + 0.1) / 0.2;
                const beachDamping = 1.0 - (shoreDist * 0.8 * eastCoastFactor);
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
            heightScale *= (1 - westFactor * 0.4); // Was 0.8
            
            // 2. Increase the base altitude in the west (was 65, now 120)
            offset = _lerp(offset, 120, westFactor); 
            
            // 3. Inject new, low-frequency noise specifically for broad rolling hills
            const rollingHills = simplex.noise2D(x * 0.0003, z * 0.0003) * 140;
            offset += rollingHills * westFactor;
            
            // 4. Heavily dampen roughness and rockiness so the hills are smooth, not jagged
            roughness *= (1 - westFactor * 0.85); // Was 0.7
            rockiness *= (1 - westFactor * 0.95); // Was 0.9
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
        if (x > 3000 && biome < -0.1) {
            const islandRegion = simplex.noise2D(x * 0.0001 + 500, z * 0.0001 + 500);
            if (islandRegion > 0.2) {
                const islandShape = simplex.noise2D(x * 0.0003 + 1000, z * 0.0003 + 1000);
                if (islandShape > -0.1) {
                    const eastIntensity = Math.min(1, (x - 3000) / 7000);
                    const shapeFactor = Math.max(0, islandShape + 0.1);
                    const heightFactor = shapeFactor * (islandRegion - 0.2) * eastIntensity;
                    if (heightFactor > 0) {
                        let islandHeight = heightFactor * 800;
                        islandHeight += simplex.noise2D(x * 0.002, z * 0.002) * 80 * heightFactor;
                        n += islandHeight;
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

        // --- RIVER CARVING LOGIC ---
        // Define a meandering path running East-West around the equator (Z = 0)
        // Use multiple frequencies of noise for more natural, unpredictable bends
        const riverCenterZ = exports.getRiverCenterZ ? exports.getRiverCenterZ(x, simplex) :
            (simplex.noise2D(x * 0.0003, 0) * 800 + simplex.noise2D(x * 0.001, 100) * 200);

        const distToRiver = Math.abs(z - riverCenterZ);

        // Vary the width of the river to break up uniformity
        const widthNoise = simplex.noise2D(x * 0.0005, 200);
        const widthVariation = (widthNoise + 1) * 0.5; // Map from [-1, 1] to [0, 1]

        const riverWidth = 80 + (widthVariation * 220); // River width fluctuates between 80 and 300
        const riverBankWidth = 100 + (widthVariation * 100); // Bank width also fluctuates


        // Calculate river factor
        let riverFactor = 0;
        if (distToRiver <= riverWidth) {
            riverFactor = 1.0;
        } else if (distToRiver < riverWidth + riverBankWidth) {
            // Smooth transition zone
            const t = (distToRiver - riverWidth) / riverBankWidth;
            // Smoothstep curve for natural banks
            riverFactor = 1.0 - (t * t * (3 - 2 * t));
        }

        if (riverFactor > 0) {
            // Carve down to just below water level
            n = _lerp(n, WATER_LEVEL - 2, riverFactor);
        }

        // Strict water level clamping
        if (n < WATER_LEVEL) {
            n = WATER_LEVEL;
        }

        // Apply Massive Mountain Range
        const mountainRanges = [
            { lat: 2, lonStart: -1, maxHeight: 1600 },  // Northern snowy range
            { lat: -2, lonStart: -1, maxHeight: 1600 }  // Southern Arizona range
        ];

        // Process each range
        for (const range of mountainRanges) {
            const xStart = range.lonStart * latScale;
            const zCenterBase = -range.lat * latScale;

            if (x < xStart) {
                // Low-frequency meandering for the range center
                const ridgeMeander = simplex.noise2D(x * 0.0001 + (range.lat * 100), 123);
                const currentZCenter = zCenterBase + ridgeMeander * 2000;

                // Vary mountain presence - some areas have peaks, others are just foothills
                const presenceMod = 0.5 + simplex.noise2D(x * 0.0002 + (range.lat * 50), 789) * 0.5; // [0, 1]

                const dxRange = xStart - x;
                const fadeIn = Math.min(1, dxRange / 5000);

                const dz = z - currentZCenter;
                const dist = Math.abs(dz);

                // 1. Broad base "mass" (Gaussian)
                const baseRadius = 2500;
                const baseDistSq = dz * dz;
                const baseFalloff = Math.exp(-baseDistSq / (2 * baseRadius * baseRadius));

                if (baseFalloff > 0.01) {
                    // 2. Sharper peaks (Power function)
                    const peakRadius = 1800;
                    const peakDist = Math.min(peakRadius, dist);
                    // Increased exponent to 2.8 for steeper ascent curves
                    const peakShape = Math.pow(1.0 - (peakDist / peakRadius), 2.8);

                    // 3. Ridged Multi-Fractal ruggedness (Sharp Peaks)
                    // Math.abs creates valleys, 1.0 - Math.abs flips them into sharp ridges
                    let ridge1 = 1.0 - Math.abs(simplex.noise2D(x * 0.002, z * 0.002));
                    let ridge2 = 1.0 - Math.abs(simplex.noise2D(x * 0.006, z * 0.006));

                    // Squaring the ridges sharpens the drop-off even further
                    ridge1 *= ridge1;
                    ridge2 *= ridge2;

                    const ruggedness = (ridge1 * 0.8 + ridge2 * 0.4 + 0.1);

                    // Combine: Peaks rise out of the broad base mass
                    const baseHeight = 300 * baseFalloff; // Smooth foothold
                    // Use presenceMod to make some peaks much higher than others
                    const peakHeight = range.maxHeight * peakShape * ruggedness * (0.4 + 0.6 * presenceMod);

                    let totalContribution = (baseHeight + peakHeight) * fadeIn;

                    // Land/Water Protection
                    const landFactor = Math.min(1, Math.max(0, n - WATER_LEVEL) / 15);

                    // --- VALLEY LOGIC ---
                    // Introduced occasional valleys using low-frequency noise.
                    const valleyNoise = simplex.noise2D(x * 0.00012 + (range.lat * 77), z * 0.00012 + (range.lat * 88));
                    // Map noise [-1, 1] to a factor where most of the noise (above -0.5) is 1.0 (mountain present),
                    // and values below -0.5 dip into valleys (mountain absent).
                    const valleyFactor = Math.max(0, Math.min(1, (valleyNoise + 0.5) * 5.0));

                    if (landFactor > 0.3 || totalContribution > 25) {
                        n += totalContribution * valleyFactor;
                    }
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
    function getRiverCenterZ(x, simplex) {
        return (simplex.noise2D(x * 0.0003, 0) * 800) + (simplex.noise2D(x * 0.001, 100) * 200);
    }

    // --- ANGLE INTERPOLATION ---
    function lerpAngle(a, b, t) {
        let diff = (b - a) % (Math.PI * 2);
        if (diff < -Math.PI) diff += Math.PI * 2;
        if (diff > Math.PI) diff -= Math.PI * 2;
        return a + diff * t;
    }

    exports.getBiome = getBiome;
    exports.getElevation = getElevation;
    exports.getRiverCenterZ = getRiverCenterZ;
    exports.lerpAngle = lerpAngle;

    // Export centralized URL parameters
    exports.urlParams = urlParams;
    exports.THEME = THEME;
    exports.SHOW_CLOUDS = SHOW_CLOUDS;
    exports.SHOW_OBJECTS = SHOW_OBJECTS;
    exports.setShowObjects = (val) => {
        exports.SHOW_OBJECTS = val;
    };
    exports.MAP_NAME = MAP_NAME;
    exports.PALETTE_INDEX = PALETTE_INDEX;
    exports.SCALE = SCALE;

}(typeof module !== 'undefined' ? module.exports : (window.ChillFlightLogic = {})));
