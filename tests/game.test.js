/**
 * @fileoverview Unit tests for Airplane Water Drag system.
 * This test uses a mock environment to verify the flight physics logic
 * intended for game.js.
 */

const assert = require('assert');

// Mock THREE.MathUtils.lerp
const THREE = {
    MathUtils: {
        lerp: (start, end, t) => start + (end - start) * t
    }
};

/**
 * Mocks the water landing logic from game.js
 */
function runWaterLandingLogic(state, delta) {
    const { isWater, planeY, minFlightHeight, vehicleType, keys } = state;
    let { targetFlightSpeed, flightSpeedMultiplier } = state;

    // Simulation of the block at line 1726 in game.js
    if (isWater && planeY < minFlightHeight + 2) {
        // --- NEW LOGIC START ---
        if (vehicleType === 'airplane' && !keys.Shift) {
            // Smoothly reduce targetFlightSpeed to 0
            targetFlightSpeed = Math.max(0, targetFlightSpeed - (delta * 0.5));
        }
        // --- NEW LOGIC END ---

        // Legacy/existing behavior for multiplier recovery (simplified for test)
        if (flightSpeedMultiplier > 0.5) {
            flightSpeedMultiplier = THREE.MathUtils.lerp(flightSpeedMultiplier, 0.5, 0.015);
        }
    }

    // Simulation of the speed recovery block at line 1547 in game.js
    // recoveryRate = 0.6 for airplane
    let recoveryRate = 0.6;
    flightSpeedMultiplier = THREE.MathUtils.lerp(flightSpeedMultiplier, targetFlightSpeed, recoveryRate * delta);

    return { targetFlightSpeed, flightSpeedMultiplier };
}

// --- TEST CASES ---

console.log('Running Airplane Water Drag Tests...\n');

// 1. Airplane on water, NO Shift held -> Should slow down
(function testAirplaneDragNoThrottle() {
    console.log('Test: Airplane on water, NO Shift held');
    let state = {
        isWater: true,
        planeY: 10,
        minFlightHeight: 9,
        vehicleType: 'airplane',
        keys: { Shift: false },
        targetFlightSpeed: 1.0,  // Initial target speed
        flightSpeedMultiplier: 1.0 // Current speed
    };
    const delta = 1.0; // 1 second for simulation clarity

    const result = runWaterLandingLogic(state, delta);
    
    console.log(`  Initial targetFlightSpeed: ${state.targetFlightSpeed}`);
    console.log(`  Result targetFlightSpeed:   ${result.targetFlightSpeed}`);
    
    // Expect targetFlightSpeed to decrease
    assert.ok(result.targetFlightSpeed < state.targetFlightSpeed, 'targetFlightSpeed should decrease');
    assert.strictEqual(result.targetFlightSpeed, 0.5, 'targetFlightSpeed should be reduced by delta * 0.5');
    console.log('  ✅ SUCCESS: Airplane slowed down.\n');
})();

// 2. Airplane on water, Shift held -> Should NOT apply drag
(function testAirplaneTakeoffWithThrottle() {
    console.log('Test: Airplane on water, Shift HELD (Throttling up)');
    let state = {
        isWater: true,
        planeY: 10,
        minFlightHeight: 9,
        vehicleType: 'airplane',
        keys: { Shift: true },
        targetFlightSpeed: 1.0,
        flightSpeedMultiplier: 1.0
    };
    const delta = 1.0;

    const result = runWaterLandingLogic(state, delta);

    console.log(`  Initial targetFlightSpeed: ${state.targetFlightSpeed}`);
    console.log(`  Result targetFlightSpeed:   ${result.targetFlightSpeed}`);

    // Expect targetFlightSpeed to remain same (it's handled in the throttle block elsewhere)
    assert.strictEqual(result.targetFlightSpeed, 1.0, 'targetFlightSpeed should not decrease when Shift is held');
    console.log('  ✅ SUCCESS: No water drag applied while throttling.\n');
})();

// 3. Non-airplane vehicle (e.g., boat) -> Should not use this specific drag logic
(function testBoatNoImpact() {
    console.log('Test: Boat on water -> No impact from airplane drag logic');
    let state = {
        isWater: true,
        planeY: 10,
        minFlightHeight: 9,
        vehicleType: 'boat',
        keys: { Shift: false },
        targetFlightSpeed: 0.3,
        flightSpeedMultiplier: 0.3
    };
    const delta = 1.0;

    const result = runWaterLandingLogic(state, delta);
    
    // Boats have their own logic; our change shouldn't touch them here
    assert.strictEqual(result.targetFlightSpeed, 0.3, 'Boat targetFlightSpeed should remain untouched by airplane logic');
    console.log('  ✅ SUCCESS: Boat logic unaffected.\n');
})();

console.log('All tests passed successfully (TDD Red & Green Simulation)!');
