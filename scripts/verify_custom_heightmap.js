const path = require('path');
const logic = require(path.join(__dirname, '../chill-flight-logic.js'));

// Mock simplex
const simplex = { noise2D: (x, y) => 0 };

// Mock custom map (small 2x2 for easy manual check)
// [0, 255]
// [127, 63]
const mockData = new Float32Array([0, 255, 127, 63]);
logic.customMap = {
    data: mockData,
    width: 2,
    height: 2
};

console.log("--- Verifying Custom Heightmap Logic ---");

function testElevation(x, z, constants, label) {
    const alt = logic.getElevation(x, z, simplex, constants, (a, b, t) => a + (b - a) * t);
    console.log(`${label} (x=${x}, z=${z}): ${alt.toFixed(2)}`);
    return alt;
}

const WATER_LEVEL = 40;
const constants_default = { WATER_LEVEL }; // Should default to 5000, 1000
const constants_custom = { WATER_LEVEL, MAP_WORLD_SIZE: 20000, MAP_HEIGHT_SCALE: 400 };

// 1. Center (u=0.5, v=0.5) => px=0.5, py=0.5
// Lerp between (0, 255) and (127, 63)
// r1 = 127.5, r2 = 95 => final = 111.25 / 255 = ~0.436
console.log("\nTesting Center (0, 0):");
testElevation(0, 0, constants_default, "Default (5000x1000)");
testElevation(0, 0, constants_custom, "Custom (20000x400)");

// 2. Corner (u=1.0, v=1.0) => x=2500 for default, x=10000 for custom
console.log("\nTesting Bound (Right/Bottom):");
testElevation(2500, 2500, constants_default, "Default Boundary (x=2500)");
testElevation(10000, 10000, constants_custom, "Custom Boundary (x=10000)");

// 3. Out of bounds
console.log("\nTesting Out of Bounds:");
testElevation(3000, 3000, constants_default, "Default OOB (x=3000)");
testElevation(15000, 15000, constants_custom, "Custom OOB (x=15000)");
