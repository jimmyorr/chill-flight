# Implementation Plan: Support for Other Vehicles (Helicopter)

## Phase 1: Core Vehicle Switch Logic & UI
- [ ] Task: Create UI button for vehicle switching
    - [ ] Add a prominent "Switch Vehicle" button to the in-game UI (`index.html`, `style.css`).
    - [ ] Add event listener to toggle a global `vehicleType` state between 'airplane' and 'helicopter' (`game.js` or UI handler).
- [ ] Task: Load Helicopter Model
    - [ ] Find/add a simple low-poly helicopter model or create a basic Three.js primitive representation for now (`game.js` or asset loader).
    - [ ] Update rendering logic to switch the visible player mesh based on `vehicleType`.
- [ ] Task: Conductor - User Manual Verification 'Core Vehicle Switch Logic & UI' (Protocol in workflow.md)

## Phase 2: Helicopter Physics
- [ ] Task: Implement basic helicopter movement
    - [ ] Modify the main update loop / physics logic to check `vehicleType` (`chill-flight-logic.js` or `airplane.js`).
    - [ ] If 'helicopter', apply arcade-style hovering physics (e.g., vertical lift, direct forward/backward/strafing movement) instead of airplane forward-momentum physics.
- [ ] Task: Tune helicopter controls
    - [ ] Adjust speed, lift, and turning rates to feel simple and easy to control.
- [ ] Task: Conductor - User Manual Verification 'Helicopter Physics' (Protocol in workflow.md)

## Phase 3: Multiplayer Synchronization
- [ ] Task: Sync Vehicle Type
    - [ ] Update the Firebase state payload to include the current `vehicleType` (`multiplayer.js`).
    - [ ] Broadcast `vehicleType` changes immediately when the player switches.
- [ ] Task: Render other players correctly
    - [ ] Update the `multiplayer.js` logic that creates other player meshes. It should instantiate or update their model based on their broadcasted `vehicleType`.
    - [ ] Ensure position and rotation sync still works smoothly for both model types.
- [ ] Task: Conductor - User Manual Verification 'Multiplayer Synchronization' (Protocol in workflow.md)