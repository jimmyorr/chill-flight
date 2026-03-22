# Specification: Support for Other Vehicles (Helicopter)

## 1. Overview
The goal of this track is to introduce support for multiple vehicle types in Chill Flight, starting with a helicopter. The system will be designed to easily accommodate future vehicles such as a jeep and a boat.

## 2. Functional Requirements
- **Helicopter Addition**: Implement a helicopter vehicle with arcade/simplified controls (easy hovering, straightforward directional movement).
- **In-Game Switching**: Players must be able to switch between the airplane and the helicopter dynamically while in-game.
- **Multiplayer Synchronization**: The multiplayer system must sync the vehicle type (so others see the correct model) and its position/rotation. Complex unique animations (like rotor spinning) are excluded for now.
- **Simple Switch Logic**: Implement the vehicle handling using a straightforward switch-case or conditional logic based on a `vehicleType` state, rather than a complex OOP or component-based architecture.

## 3. Non-Functional Requirements
- **Performance**: The low-poly aesthetic and strict performance targets for mobile devices must be maintained.
- **Maintainability**: The `vehicleType` logic should be clean enough to easily add "jeep" and "boat" in subsequent updates.

## 4. Acceptance Criteria
- [ ] A helicopter model can be controlled by the player with simple, arcade-style physics.
- [ ] An in-game UI button allows swapping between the airplane and helicopter instantly.
- [ ] Multiplayer clients correctly render other players as either an airplane or a helicopter based on their current state.
- [ ] Player position and rotation sync correctly regardless of the chosen vehicle.

## 5. Out of Scope
- Implementation of the jeep or boat (these are planned for future tracks).
- Realistic or complex helicopter physics.
- Synchronization of complex vehicle-specific animations over multiplayer.