const path = require('path');
const logic = require(path.join(__dirname, '../chill-flight-logic.js'));

// We need a real simplex implementation to verify noise-based logic accurately.
// Looking at the codebase, there's likely a simplex implementation in noise.js or similar.
// But for a standalone script, let's use a simple deterministic implementation or just a better mock.
// Re-reading terrain.js, it uses 'simplex' which is passed in.
// Let's create a more "noisy" mock.
const simplex = {
    noise2D: (x, y) => {
        // Deterministically return -0.8 (valley trigger) for specific ranges
        // val = (valleyNoise + 0.5) * 5.0
        // if valleyNoise = -0.8, val = (-0.3) * 5 = -1.5 => clamped to 0.
        
        const cycle = Math.abs((x % 40000) / 40000);
        if (cycle > 0.45 && cycle < 0.55) return -0.8; // Deep valley
        return 1.0; // High ground for peaks
    }
};

const constants = {
    WATER_LEVEL: 20,
    MOUNTAIN_LEVEL: 180
};

const lerp = (a, b, t) => a + (b - a) * t;

console.log("Verifying Valleys in Northern Range...");

let foundValley = false;
let foundPeak = false;

let maxLocalAlt = 0;
// Mountain range meanders, so we sample multiple Zs
for (let deltaZ = -2000; deltaZ <= 2000; deltaZ += 1000) {
    const currentZ = 10000 + deltaZ;
    for (let x = -5000; x > -60000; x -= 2000) {
        const alt = logic.getElevation(x, currentZ, simplex, constants, lerp);
        if (alt > 300) foundPeak = true;
        if (alt > maxLocalAlt) maxLocalAlt = alt;

        // If we are in a peak zone but altitude is low, it's a valley
        if (foundPeak && alt < 100) {
            console.log(`Found Valley at x: ${Math.round(x)}, z: ${currentZ}, alt: ${Math.round(alt)}`);
            foundValley = true;
        }
    }
}

if (foundPeak && foundValley) {
    console.log("SUCCESS: Found both peaks and valleys in the mountain range.");
} else {
    console.log("FAILURE: Could not find peaks and valleys. Peaks found: " + foundPeak + ", Valleys found: " + foundValley);
    process.exit(1);
}
