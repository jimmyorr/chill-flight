# River Canyons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a westward-rising canyon feature that transforms the existing surface river into a deep chasm with steep, mountainous walls as the player flies west.

**Architecture:** We will use a distance-based `canyonFactor` to lerp the terrain base elevation (offset) and the river carving's steepness (using a power function). This ensures a seamless transition from the eastern starting area to the western canyon biome.

**Tech Stack:** JavaScript (ChillFlightLogic), Three.js (for lerp utility).

---

### Task 1: Create Verification Script for Canyons

**Files:**
- Create: `scripts/verify_canyons.js`

- [ ] **Step 1: Write the verification script**
Create a script that checks elevation at `x = 0` (no canyon) and `x = -5000` (full canyon) both in the river and on the banks.

```javascript
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

// Expected current: Banks are roughly similar (60-65ish)
// Expected after: West banks are significantly higher (800+ higher)
```

- [ ] **Step 2: Run the script to verify current baseline**
Run: `node scripts/verify_canyons.js`
Expected: East and West banks should be similar (around 60-80). River floor should be at WATER_LEVEL (20).

- [ ] **Step 3: Commit**
```bash
git add scripts/verify_canyons.js
git commit -m "test: add verification script for canyons baseline"
```

### Task 2: Implement Westward Rise (Base Elevation Lift)

**Files:**
- Modify: `chill-flight-logic.js`

- [ ] **Step 1: Calculate `canyonFactor` and apply base lift**
In `getElevation`, calculate `canyonFactor` based on `x < 0`.

```javascript
// Around line 220 in chill-flight-logic.js
const westFactor = Math.max(0, Math.min(1, -x / 4500));
const canyonFactor = Math.max(0, Math.min(1, -x / 5000)); // New factor

// ... later in the offset calculation ...
if (x < 0) {
    heightScale *= (1 - westFactor * 0.8);
    offset = _lerp(offset, 65, westFactor);
    // Add lift:
    offset += canyonFactor * 800; 
    roughness *= (1 - westFactor * 0.7);
    rockiness *= (1 - westFactor * 0.9);
}
```

- [ ] **Step 2: Run verification script**
Run: `node scripts/verify_canyons.js`
Expected: West Bank Height should now be ~800+ units higher than East. River Floor might still be lifted (this is expected until Task 3).

- [ ] **Step 3: Commit**
```bash
git add chill-flight-logic.js
git commit -m "feat: implement westward elevation lift for canyons"
```

### Task 3: Implement Steep Wall Carving

**Files:**
- Modify: `chill-flight-logic.js`

- [ ] **Step 1: Refactor River Carving to use `canyonFactor` and power function**
Modify the river carving logic to transition from smoothstep to a steep power function.

```javascript
// Around line 320 in chill-flight-logic.js
let riverFactor = 0;
const distToRiverNormalized = distToRiver / (riverWidth + riverBankWidth);

if (distToRiver <= riverWidth) {
    riverFactor = 1.0;
} else if (distToRiver < riverWidth + riverBankWidth) {
    const t = (distToRiver - riverWidth) / riverBankWidth;
    // Blend between smoothstep and sharp power function
    const smooth = 1.0 - (t * t * (3 - 2 * t));
    const sharp = Math.pow(1.0 - t, 10.0);
    riverFactor = _lerp(smooth, sharp, canyonFactor);
}
```

- [ ] **Step 2: Run verification script**
Run: `node scripts/verify_canyons.js`
Expected: West River Floor should be back down to WATER_LEVEL (20), but West Bank remains high. This confirms the "deep carving".

- [ ] **Step 3: Commit**
```bash
git add chill-flight-logic.js
git commit -m "feat: implement steep wall carving using canyonFactor"
```

### Task 4: Add Mountainous Topography for Canyons

**Files:**
- Modify: `chill-flight-logic.js`

- [ ] **Step 1: Boost mountain noise based on `canyonFactor`**
Modify the mountain noise section to increase amplitude and ruggedness in canyon regions.

```javascript
// Around line 260 in chill-flight-logic.js
if (biome > 0.2) {
    const t = Math.min(1, (biome - 0.2) * 3);
    let ridge = 1.0 - Math.abs(simplex.noise2D(x * 0.0008, z * 0.0008));
    // Boost ridge height in canyon regions
    const canyonBoost = 1.0 + canyonFactor * 1.5;
    n += (ridge * 220 * canyonBoost - 100) * t * (1 - westFactor * 0.5);
}
```

- [ ] **Step 2: Run verification script**
Run: `node scripts/verify_canyons.js`
Expected: Values should be consistent, but bank heights in hilly regions (noise > 0) should show more variation.

- [ ] **Step 3: Commit**
```bash
git add chill-flight-logic.js
git commit -m "feat: enhance canyon rim with mountainous topography"
```

### Task 5: Cleanup and Final Check

- [ ] **Step 1: Remove verification script**
Run: `rm scripts/verify_canyons.js`

- [ ] **Step 2: Final commit**
```bash
git commit -m "chore: cleanup verification scripts"
```
