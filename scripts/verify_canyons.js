const path = require('path');
const logic = require(path.join(__dirname, '../chill-flight-logic.js'));

const simplex = { noise2D: (x, y) => 0 }; // Flat noise for baseline check
const constants = { WATER_LEVEL: 20, MOUNTAIN_LEVEL: 180 };
const lerp = (a, b, t) => a + (b - a) * t;

console.log("--- Verifying River Canyons ---");

function check(x, label) {
    const riverZ = logic.getRiverCenterZ(x, simplex);
    const hRiver = logic.getElevation(x, riverZ, simplex, constants, lerp);
    const hBank = logic.getElevation(x, riverZ + 1000, simplex, constants, lerp);
    console.log(`${label} (x=${x}):`);
    console.log(`  River Floor: ${hRiver.toFixed(2)}`);
    console.log(`  Bank Height: ${hBank.toFixed(2)}`);
    return { hRiver, hBank };
}

const east = check(0, "East (Start)");
const west = check(-5000, "West (Canyon)");
