/**
 * @fileoverview Unit tests for objects toggle URL parameter.
 * Validates that ChillFlightLogic.SHOW_OBJECTS correctly interprets the URL.
 */

const assert = require('assert');

// Mock window and URLSearchParams for Node.js environment
global.URLSearchParams = require('url').URLSearchParams;

function testToggle(searchString, expected) {
    console.log(`Testing with URL search: "${searchString}"`);
    
    // Clear and reset the require cache so we can re-evaluate the IIFE with new global state
    delete require.cache[require.resolve('../chill-flight-logic.js')];
    
    global.window = {
        location: {
            search: searchString
        }
    };
    
    // Re-load the logic module
    const ChillFlightLogic = require('../chill-flight-logic.js');
    
    console.log(`  ChillFlightLogic.SHOW_OBJECTS: ${ChillFlightLogic.SHOW_OBJECTS}`);
    assert.strictEqual(ChillFlightLogic.SHOW_OBJECTS, expected, 
        `Expected SHOW_OBJECTS to be ${expected} for ${searchString}`);
}

console.log('Running Objects Toggle TDD Tests (RED PHASE)...\n');

try {
    // 1. Default should be true
    testToggle('', true);
    console.log('  ✅ SUCCESS: Default is true.\n');

    // 2. ?objects=none should be false
    testToggle('?objects=none', false);
    console.log('  ✅ SUCCESS: ?objects=none is false.\n');

} catch (err) {
    console.error('  ❌ TEST FAILED:');
    console.error(`     ${err.message}`);
    process.exit(1);
}
