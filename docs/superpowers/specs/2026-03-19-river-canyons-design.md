# Design Spec: River Canyons (Westward Rise)

## 1. Objective
Enhance the procedural terrain generation to include dramatic **River Canyons** that form as the player flies West. This feature will transition the current surface-level river into a deep chasm with steep, mountainous walls, providing challenging low-altitude flight paths and increased visual drama.

## 2. Technical Approach: Westward Rise (Distance-Based Attenuation)

We will implement a distance-driven multiplier that affects both the terrain's base elevation and the river's carving steepness.

### 2.1. Canyon Intensity Factor (`canyonFactor`)
A normalized factor [0, 1] derived from the world X-coordinate:
- `x >= 0`: `canyonFactor = 0.0`
- `x < -5000`: `canyonFactor = 1.0` (fully formed canyon)
- Between `0` and `-5000`: Linear or smoothstep interpolation.

### 2.2. Base Elevation Lift
We will lift the base terrain offset as the player heads West:
- `baseOffset = originalOffset + (canyonFactor * 800)`
- This creates the high-altitude terrain that the river chasm will be cut into.

### 2.3. Steep Wall Carving
We will modify the existing `riverFactor` calculation in `chill-flight-logic.js`.
- Current: Smoothstep bank transition.
- New: A power function driven by `canyonFactor`:
  ```javascript
  const steepness = _lerp(1.5, 10.0, canyonFactor); // 1.5 = smooth banks, 10.0 = vertical walls
  riverFactor = Math.pow(1.0 - distToRiverNormalized, steepness);
  ```
- This "compresses" the transition zone toward the river's edge, creating near-vertical cliffs when `canyonFactor` is high.

### 2.4. Mountainous Topography
To achieve the "Mountainous Walls" choice:
- We will increase the amplitude of the high-frequency mountain noise in areas where `canyonFactor > 0`.
- Jagged peaks will rise up around the canyon's rim, providing a more dramatic and less "flat" look than a plateau.

## 3. Implementation Plan

1. **Update `chill-flight-logic.js`**:
   - Refactor `getElevation` to calculate `canyonFactor`.
   - Apply the elevation lift West of `x = 0`.
   - Update `riverFactor` to use the dynamic power-based carving.
2. **Visual Verification**:
   - Test the transition at `x = 0` to ensure there are no visible "seams" or pops in the terrain chunks.
   - Verify the river floor remains at `WATER_LEVEL`.

## 4. Success Criteria
- [ ] A seamless transition from a surface river to a deep canyon as the player flies West.
- [ ] Near-vertical canyon walls in the high-intensity regions.
- [ ] Jagged, mountainous terrain around the canyon rim.
- [ ] No regressions in existing biomes or the Eastern (starting) area.
