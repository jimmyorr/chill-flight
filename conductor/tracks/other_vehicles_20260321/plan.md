# Implementation Plan: Support for Other Vehicles (Helicopter)

## Phase 1: Core Vehicle Switch Logic & UI
- [x] Task: Create UI button for vehicle switching (8b59225)
    - [x] Add a prominent "Switch Vehicle" button to the in-game UI (`index.html`, `style.css`).
    - [x] Add event listener to toggle a global `vehicleType` state between 'airplane' and 'helicopter' (`game.js` or UI handler).
- [x] Task: Load Helicopter Model (8b59225)
    - [x] Find/add a simple low-poly helicopter model or create a basic Three.js primitive representation for now (`game.js` or asset loader).
    - [x] Update rendering logic to switch the visible player mesh based on `vehicleType`.
- [x] Task: Conductor - User Manual Verification 'Core Vehicle Switch Logic & UI' (Protocol in workflow.md)

## Phase 2: Helicopter Physics
- [x] Task: Implement basic helicopter movement (1de8860)
    - [x] Modify the main update loop / physics logic to check `vehicleType` (`chill-flight-logic.js` or `airplane.js`).
    - [x] If 'helicopter', apply arcade-style hovering physics (e.g., vertical lift, direct forward/backward/strafing movement) instead of airplane forward-momentum physics.
- [x] Task: Tune helicopter controls (1de8860)
    - [x] Adjust speed, lift, and turning rates to feel simple and easy to control.
- [x] Task: Conductor - User Manual Verification 'Helicopter Physics' (Protocol in workflow.md)

## Phase 3: Multiplayer Synchronization
- [x] Task: Sync Vehicle Type (8294238)
    - [x] Update the Firebase state payload to include the current `vehicleType` (`multiplayer.js`).
    - [x] Broadcast `vehicleType` changes immediately when the player switches.
- [x] Task: Render other players correctly (8294238)
    - [x] Update the `multiplayer.js` logic that creates other player meshes. It should instantiate or update their model based on their broadcasted `vehicleType`.
    - [x] Ensure position and rotation sync still works smoothly for both model types.
- [x] Task: Conductor - User Manual Verification 'Multiplayer Synchronization' (Protocol in workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions (807f056)
- [x] Task: Fix helicopter altitude rising (3104f54)
