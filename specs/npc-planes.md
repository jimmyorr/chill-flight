# NPC implementation plan: Chill Flight

## Overview

This document outlines the design and implementation strategy for introducing Non-Player Character (NPC) aircraft into `chill-flight`. In alignment with the project's core identity—a relaxing, meditative procedural flight simulator—NPCs should enhance the sense of a living world without introducing stress, aggressive combat, or punitive mechanics.

---

## 1. Key design decisions and scope

### 1.1 Movement logic

- **Ambient Cruising & Waypoints:**
  - NPCs spawn at high altitudes within an active bubble around the player (e.g., within 2000–6000 units).
  - NPCs fly smooth splines or waypoint paths between landmarks (e.g., circling lighthouses, monasteries, mountain peaks, or following coastal corridors).
  - Altitude is clamped safely above local terrain height using `ChillFlightLogic.getElevation(x, z, simplex, ...)` to prevent clipping into hills.
- **Cozy Formation / Escort Behavior:**
  - When the player flies alongside an NPC within a certain proximity (e.g., 100–300 units), the NPC can gently match speed and bank slightly, creating a "wingman" experience.
  - If the player banks away or accelerates, the NPC resumes its cruising path.

### 1.2 Player interaction rules

- **No Destructive Combat:** Keeping with the "chill" theme, there are no weapons or hostile encounters.
- **Proximity & Near-Miss Effects:**
  - Passing close to an NPC plays a subtle slipstream / prop wash sound effect (`audio.js`).
  - Visual propeller/wingtip vapor trails or subtle camera turbulence when flying through an NPC's slipstream.
  - Triggers peaceful achievements (e.g., "Formation Flyer" or "Mid-air Wave").
- **Collision Behavior:**
  - Non-lethal soft deflection/nudge or safe separation bubble, with a subtle audio thump and slight camera jolt rather than an explosive crash.

### 1.3 Visual assets and procedural variants

- **Modular Geometry Factory:**
  - Refactor `airplane.js` to extract a reusable `createAirplaneMesh({ bodyColor, accentColor, variant })` function.
  - Retain `airplaneModel` and `planeGroup` references for the player plane to avoid breaking existing code.
- **Visual Diversity:**
  - **Color Palettes:** Utilize existing `ChillFlightLogic.PLANE_COLORS` plus new liveries (retro vintage, pastel, bi-tone).
  - **Procedural Variants:** Support standard monoplane, a biplane (dual wings and struts), and a glider/seaplane configuration using pure Three.js procedural geometry (no heavy external assets required).
- **Propeller Animation:** Propeller sub-groups will spin dynamically in the render loop based on NPC flight speed.
- **Debug Viewer:** Add NPC models and variants to `debug-models.html` per project guidelines.

---

## 2. Architecture and file breakdown

```
chill-flight-repo/
├── constants.js          # NPC config constants, tuning variables, feature flags
├── chill-flight-logic.js # Pure math/steering functions for NPC navigation & collision
├── airplane.js           # Reusable airplane model generator (player + NPCs)
├── game.js               # NPC lifecycle management, spatial partitioning, game loop
├── debug-models.html     # Model preview for NPC variations
└── achievements.js       # Optional achievements for discovering/escorting NPCs
```

### 2.1 `constants.js`

- Add feature flag `ENABLE_NPCS = true;`.
- Define NPC parameters:
  - `MAX_NPC_COUNT`: Target active NPC count (e.g., 3–6 active planes around the player).
  - `NPC_SPAWN_RADIUS`: Distance range for spawning/despawning (e.g., 3000–7000 units).
  - `NPC_SPEED_RANGE`: Minimum and maximum cruising speed.
  - `NPC_FORMATION_DISTANCE`: Proximity threshold to trigger formation flying.

### 2.2 `chill-flight-logic.js`

- Pure, testable functions:
  - `calculateNPCPosition(npcState, delta, terrainElevation)`
  - `getSteeringVector(npcPos, targetPos, currentHeading, turnSpeed)`
  - `checkProximity(playerPos, npcPos, threshold)`
  - `generateNPCWaypoint(seed, currentPos, worldBounds)`

### 2.3 `airplane.js`

- Extract `createAirplaneMesh(options)` returning a `THREE.Group` with:
  - Fuselage, wings, tail, rudder, propeller, and optional pontoons/biplane wings.
  - Unique materials instanced or shared cleanly based on theme (`createMaterial`).
  - Propeller reference stored on the instance (`mesh.userData.propeller = propGroup`).
- Keep existing player setup seamlessly delegating to `createAirplaneMesh`.

### 2.4 `game.js`

- Manage an array `activeNPCs = []`.
- In `animate()`:
  - Update NPC positions, headings, and propeller rotations.
  - Check distance to player for LOD culling and despawn/respawn.
  - Update proximity interactions and sound cues.

### 2.5 `debug-models.html`

- Register new NPC mesh variations (Biplane, Glider, Alternate Liveries) in the debug menu.

---

## 3. Phased implementation roadmap

1. **Phase 1: Plane model factory refactoring (`airplane.js` & `debug-models.html`)**
   - Convert hardcoded player mesh into a parameterized `createAirplaneMesh()` function.
   - Verify player controls, colors, and camera remain identical.
   - Add model preview entries in `debug-models.html`.

2. **Phase 2: Core NPC steering logic (`chill-flight-logic.js`)**
   - Implement pure functions for waypoint following, altitude clearance, and smooth banking.
   - Add unit tests for NPC trajectory calculations.

3. **Phase 3: NPC manager and scene integration (`game.js` & `constants.js`)**
   - Add spawn/despawn loop relative to player position.
   - Animate NPC movement, pitch/roll banking along trajectory, and propeller spinning.

4. **Phase 4: Player interaction and polish (`audio.js`, `achievements.js`)**
   - Proximity audio effects (prop wash / engine hum).
   - Soft collision / slipstream drift response.
   - Formation flying behavior.

---

## 4. Verification plan

- **Automated Testing:** Run `npm test` to ensure pure logic functions in `chill-flight-logic.js` pass.
- **Visual & Model Inspection:** Open `debug-models.html` on `http://localhost:5173/debug-models.html` to inspect NPC model variants.
- **Gameplay Verification:** Open `http://localhost:5173/` and verify:
  - NPCs spawn smoothly and navigate without terrain clipping.
  - Player flight performance (60 FPS) remains unaffected.
  - Formation flying and near-miss effects behave gently and consistently.
