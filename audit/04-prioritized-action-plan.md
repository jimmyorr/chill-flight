# Prioritized Action Plan

## 1. Quick Wins (< 1 hour)

- **Fix GC Churn in `game.js`:** Pre-allocate `THREE.Vector3` and `THREE.Matrix4` variables in the `animate` loop. (e.g., `_lastChunkUpdatePos`, `_virtualCameraPos`).
- **Frame-rate Independence:** Apply `deltaTime` scaling (using `Math.exp` or fixed timesteps) to camera easing and plane rotation lerping in `game.js`.
- **UI Throttling:** Validate that `updateDOM()` correctly prevents reflows; ensure it's used universally for telemetry.

## 2. Medium Refactors (1–2 days)

- **Extract Input Manager:** Pull touch, joystick, and mouse listeners out of `game.js` into an isolated `InputManager` class.
- **Flight Logic Decoupling:** Move pitch/roll/yaw logic from `game.js` into `airplane.js` or `chill-flight-logic.js`, passing only normalized control inputs (`-1` to `1`).
- **Cross-Platform Input Bridge:** Unify Capacitor touch controls and Tauri gamepad handling in `native-adapter.js`.

## 3. High-Leverage Architectural Upgrades

- [x] **`perf: Implement chunk pooling in terrain.js`** _(High Priority)_
  - **Issue:** New `THREE.BufferGeometry` and material allocations inside `terrain.js` (`generateChunk`) cause stuttering when chunks load/unload (see performance audit).
  - **Action:** Pool `THREE.PlaneGeometry` instances for both terrain and water. Update vertex colors rather than instantiating new geometries and array buffers.
- **Instanced Rendering:** Convert scattered environmental objects (trees, clouds) into `THREE.InstancedMesh` to drastically reduce draw calls.
- **Floating Origin System:** Implement an origin-shift mechanic to reset coordinates when the plane flies too far, fixing floating-point jitter.

## 4. Gameplay & Feature Roadmap

- **Dynamic Audio Filtering:** Tie Web Audio low-pass filters to camera distance and altitude for a more immersive "lo-fi" feel.
- **Cinematic Transitions:** Refine the spline interpolations for the 5 cinematic camera configs to eliminate sudden snaps.
- **Procedural Landmarks:** Add distinct, seeded landmarks (e.g., lighthouses, giant monoliths) with reporting in coordinate format (e.g., `X = -3000, Z = 5000` / `0.6 West, 1.0 South`).

---

### Implementation Checklist

- [x] `git commit -m "chore: Pre-allocate Vector3s in game loop to reduce GC"`
- [x] `git commit -m "refactor: Extract InputManager from game.js"`
- [ ] `git commit -m "refactor: Move aerodynamics to chill-flight-logic.js"`
- [x] `git commit -m "perf: Implement chunk pooling in terrain.js"`
- [ ] `git commit -m "perf: Convert static props to InstancedMesh"`
- [ ] `git commit -m "feat: Add floating origin shift for infinite flight"`
