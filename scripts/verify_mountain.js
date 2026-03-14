const path = require('path');
// Use absolute path but relative to this file's location for portability
const logic = require(path.join(__dirname, '../chill-flight-logic.js'));

// Mock objects that getElevation expects
const simplex = {
    noise2D: (x, y) => 0
};
const constants = {
    WATER_LEVEL: 20,
    MOUNTAIN_LEVEL: 180
};

function testRange(lat, lon, label) {
    const latScale = 5000;
    const x = lon * latScale - 2000; 
    const z = -lat * latScale;
    
    // getElevation(x, z, simplex, constants, lerp)
    const alt = logic.getElevation(x, z, simplex, constants, (a, b, t) => a + (b - a) * t);
    
    // Actual game display logic:
    // controlBaseAlt = planeGroup.position.y - 45.5
    // controlAlt = Math.round(controlBaseAlt * 25)
    // planeGroup.position.y = terrainHeight + 35 (resting)
    const terrainHeight = alt;
    const planeY = terrainHeight + 35;
    const controlAlt = Math.round((planeY - 45.5) * 25);
    
    console.log(`${label} (Lat ${lat}, Lon ${lon}): ${controlAlt} ft`);
    return controlAlt;
}

console.log("Checking Dual Mountain Ranges...");
const altNorth = testRange(2, -2, "Northern Range");
const altSouth = testRange(-1, -2, "Southern Range");

if (altNorth > 15000 && altSouth > 15000) {
    console.log("SUCCESS: Both ranges are present and reaching high altitudes.");
} else {
    console.log("FAILURE: One or both ranges are missing or too low.");
}
