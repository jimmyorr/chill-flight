const ChillFlightLogic = require('../chill-flight-logic.js');

// Mock constants
const constants = {
    WATER_LEVEL: 40,
    MAP_WORLD_SIZE: 10000,
    MAP_HEIGHT_SCALE: 400
};

// Mock simplex
const simplex = {
    noise2D: () => 0
};

// 1. Test Square Map (Legacy behavior)
console.log("Testing Square Map...");
ChillFlightLogic.customMap = {
    data: new Float32Array(100 * 100).fill(128),
    width: 100,
    height: 100,
    worldWidth: 10000,
    worldHeight: 10000
};

// Center should be roughly 128/255 * 400 + 40
let h = ChillFlightLogic.getElevation(0, 0, simplex, constants);
console.log(`Square Center Height: ${h.toFixed(2)} (Expected ~240.78)`);
if (Math.abs(h - 240.78) > 1) throw new Error("Square map center height mismatch");

// Edge should be WATER_LEVEL
h = ChillFlightLogic.getElevation(5001, 0, simplex, constants);
console.log(`Square Edge Height: ${h.toFixed(2)} (Expected 40.00)`);
if (h !== 40) throw new Error("Square map edge height mismatch");

// 2. Test Non-Square Map (2:1 aspect ratio)
console.log("\nTesting 2:1 Rectangle Map...");
ChillFlightLogic.customMap = {
    data: new Float32Array(200 * 100).fill(255), // Max height
    width: 200,
    height: 100,
    worldWidth: 10000,
    worldHeight: 5000
};

// Center (0, 0)
h = ChillFlightLogic.getElevation(0, 0, simplex, constants);
console.log(`Rect Center Height: ${h.toFixed(2)} (Expected 440.00)`);
if (h !== 440) throw new Error("Rect map center height mismatch");

// X Edge (+5000) should be on the edge of the image
h = ChillFlightLogic.getElevation(4999, 0, simplex, constants);
console.log(`Rect X Edge Height: ${h.toFixed(2)} (Expected 440.00)`);
if (h !== 440) throw new Error("Rect map X edge height mismatch");

h = ChillFlightLogic.getElevation(5001, 0, simplex, constants);
console.log(`Rect X Outer Height: ${h.toFixed(2)} (Expected 40.00)`);
if (h !== 40) throw new Error("Rect map X outer height mismatch");

// Z Edge (+2500) should be on the edge of the image
h = ChillFlightLogic.getElevation(0, 2499, simplex, constants);
console.log(`Rect Z Edge Height: ${h.toFixed(2)} (Expected 440.00)`);
if (h !== 440) throw new Error("Rect map Z edge height mismatch");

h = ChillFlightLogic.getElevation(0, 2501, simplex, constants);
console.log(`Rect Z Outer Height: ${h.toFixed(2)} (Expected 40.00)`);
if (h !== 40) throw new Error("Rect map Z outer height mismatch");

console.log("\nAll tests passed successfully!");
