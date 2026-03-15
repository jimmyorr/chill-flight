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
    const seedParam = urlParams ? urlParams.get('seed') : null;
    const WORLD_SEED = seedParam ? parseInt(seedParam, 10) : getTodaySeed();

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
    // Maps a position within a 330-second cycle to a normalized progress value [0, 1).
    // Segments (in seconds):
    //   0   –  60 → day     (progress 0.25 – 0.50)  [60s]
    //   60  – 180 → sunset  (progress 0.50 – 0.75) [120s]
    //   180 – 210 → night   (progress 0.75 – 1.00)  [30s]
    //   210 – 330 → sunrise (progress 0.00 – 0.25) [120s]
    function computeTimeOfDay(secondsInCycle) {
        const CYCLE_DURATION_S = 300;
        const linearProgress = (secondsInCycle % CYCLE_DURATION_S) / CYCLE_DURATION_S;
        const warpAmplitude = 0.07;
        // Progress 0.0 = Midnight (6 hours before Sunrise at 0.25)
        const currentWarpedProgress = linearProgress + warpAmplitude * Math.sin(4 * Math.PI * linearProgress);
        return currentWarpedProgress;
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

            // u, v should map from world coords (-MAP_WORLD_SIZE/2 to +MAP_WORLD_SIZE/2)
            // to image coords (0 to 1)
            const u = (x / MAP_WORLD_SIZE) + 0.5;
            const v = (z / MAP_WORLD_SIZE) + 0.5;

            if (u < 0 || u > 1 || v < 0 || v > 1) {
                return WATER_LEVEL;
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
            return WATER_LEVEL + (normalizedHeight * MAP_HEIGHT_SCALE);
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
            heightScale *= (1 - westFactor * 0.8);
            offset = _lerp(offset, 65, westFactor);
            roughness *= (1 - westFactor * 0.7);
            rockiness *= (1 - westFactor * 0.9);
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
            { lat: -1, lonStart: -1, maxHeight: 1600 }  // Southern Arizona range
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
                    if (landFactor > 0.3 || totalContribution > 25) {
                        n += totalContribution;
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

}(typeof module !== 'undefined' ? module.exports : (window.ChillFlightLogic = {})));
