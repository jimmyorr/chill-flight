# Architecture & Modularity Audit

## 1. Monolith Decomposition
The `game.js` (~220KB) and `terrain.js` (~229KB) files have grown into "god objects". They tightly couple the rendering loop, input state (`mouseX`, `mouseY`, touch/joystick states), procedural generation, and UI updates.

**Issue (game.js):** Global state for controls and camera are entangled with initialization and the render loop.
**Penalty:** High maintainability penalty. Hard to test flight physics without spinning up the entire Three.js context.
**Fix (Decouple Input State):**
Extract the `// --- INPUT ---` block and control states into an `input-manager.js` class.

*Before (game.js):*
```javascript
let mouseX = 0;
let mouseY = 0;
let joystickActive = false;
window.addEventListener('mousemove', (e) => { ... updateInputPosition(e.clientX, e.clientY); });
```
*After (input-manager.js):*
```javascript
export class InputManager {
  constructor() {
    this.state = { mouseX: 0, mouseY: 0, joystickActive: false };
    this._bindEvents();
  }
  _bindEvents() {
    window.addEventListener('mousemove', (e) => {
       // logic here, outputting normalized values
    });
  }
  getSteering() { return { x: this.state.mouseX, y: this.state.mouseY }; }
}
```

## 2. Subsystem Boundaries
Currently, `game.js` directly modifies `targetPitch` and `targetRoll`. We should establish a strict boundary between Input, Flight Physics, and Rendering.

- **Game Loop (`main.js` or `engine.js`)**: Orchestrates subsystems.
- **Flight Model (`flight-physics.js`)**: Pure math, taking input and returning new plane transforms.
- **Terrain Manager (`terrain-manager.js`)**: Handles chunk lifecycle, isolating it from Three.js scene setup.

## 3. State Management & Data Flow
Global variables like `lifetimeDistanceTravelled` and `sessionDistanceTravelled` are mixed with rendering logic.
We should introduce a `PlayerState` module that handles persistence and progression.

## 4. Target Architecture Tree
```text
src/
  ├── core/
  │   ├── engine.js         # Main loop (requestAnimationFrame)
  │   └── state.js          # Player progression & session data
  ├── input/
  │   ├── input-manager.js  # Unifies mouse, touch, gamepad
  │   └── native-events.js  # Capacitor/Tauri bridge
  ├── physics/
  │   └── flight-model.js   # Pure math for plane aerodynamics
  ├── world/
  │   ├── terrain.js        # Chunk generation logic
  │   └── streaming.js      # Chunk caching and LOD management
  └── render/
      ├── renderer.js       # Three.js setup
      ├── camera.js         # Camera transition logic
      └── shaders/          # Custom WebGL shaders
```
