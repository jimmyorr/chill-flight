# Gameplay & Cross-Platform Audit

## 1. Procedural Generation & Math
The procedural terrain (`terrain.js` / `noise.js`) generates chunks as the plane moves. At extreme distances (e.g., `X = 50000`), floating-point precision loss causes vertex jitter.

**Issue:** Floating-point precision at world edges.
**Penalty:** Visual shaking and incorrect physics collisions far from the origin.
**Fix (Floating Origin):**
Periodically reset the player's position to `0,0,0` and offset all active chunks and world coordinates by the inverse amount.

## 2. Flight Model & Feel
The aerodynamics in `airplane.js` and `chill-flight-logic.js` currently tie roll and pitch rates directly to frame rate.
**Fix:** Ensure all rotation applied to the plane is multiplied by `deltaTime`.

*Before (airplane.js):*
```javascript
planeGroup.rotation.z += (targetRoll - planeGroup.rotation.z) * 0.05;
```
*After (airplane.js):*
```javascript
// Ensure frame-rate independence
const smoothFactor = 1.0 - Math.exp(-5.0 * deltaTime);
planeGroup.rotation.z += (targetRoll - planeGroup.rotation.z) * smoothFactor;
```

## 3. Cross-Platform Parity
`native-adapter.js` handles Capacitor and Tauri events, but the input scheme (`game.js` lines 21-32) relies on global state for `joystickTouchId`.
**Recommendation:** Implement an abstracted `Gamepad/Touch` bridge that normalizes input to `-1.0` to `1.0` axes, regardless of the underlying platform. For Capacitor, map virtual joystick axes directly into this same data structure.

## 4. Game Feel & Audio
The `audio.js` file handles Web Audio ambient synthesis. To improve the "chill" aesthetic:
- **Audio:** Add a low-pass filter to the engine noise that scales with the camera's distance (e.g., muffled engine sound in `birds-eye-far` camera mode).
- **Visuals:** Add subtle camera lag/spring dynamics when the plane maneuvers to convey weight and momentum.
