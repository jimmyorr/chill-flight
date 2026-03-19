# Specification: Fix High-Severity XSS in Player List

## Overview
A high-severity Cross-Site Scripting (XSS) vulnerability was identified in the `updatePlayerList` function within `game.js`. The function currently uses `innerHTML` to render untrusted player names, allowing for arbitrary script execution.

## Functional Requirements
- **Secure Rendering**: Refactor the `updatePlayerList` function to eliminate the use of `innerHTML` for rendering user-supplied data.
- **DOM Manipulation**: Utilize `document.createElement`, `appendChild`, and `textContent` to build the player list UI.
- **Visual Consistency**: Ensure the updated DOM manipulation logic produces a UI that is visually identical to the current implementation.
- **Firebase Integration**: The fix must not interfere with the existing real-time synchronization logic with Firebase.

## Non-Functional Requirements
- **Security**: The implementation MUST prevent the execution of any HTML/JavaScript injected via the player name field.
- **Performance**: DOM construction should be performant and not introduce lag into the game loop.

## Acceptance Criteria
- **Reproduction**: A standalone reproduction script/test case is created that successfully demonstrates the XSS vulnerability by executing a benign payload (e.g., `console.log`).
- **Mitigation**: After applying the fix, the reproduction script no longer results in script execution.
- **Functionality**: The player list displays self and other players correctly with accurate distances and direction arrows.

## Out of Scope
- A comprehensive project-wide XSS audit (this track is strictly focused on the identified player list vulnerability).
- UI/UX enhancements to the player list.
