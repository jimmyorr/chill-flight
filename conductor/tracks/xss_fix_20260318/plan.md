# Implementation Plan: Fix High-Severity XSS in Player List

This plan follows the TDD approach to reproduce the XSS vulnerability and then implement a secure DOM-based rendering fix.

## Phase 1: Reproduction (Red Phase)
- [ ] Task: Create a standalone reproduction script for the XSS.
    - [ ] Create `scripts/reproduce_xss.js` (or a similar tool) that simulates the `updatePlayerList` logic with a malicious payload in `playerName`.
    - [ ] Verify that the payload executes (e.g., `console.log('XSS Success')` is triggered).
- [ ] Task: Conductor - User Manual Verification 'Reproduction' (Protocol in workflow.md)

## Phase 2: Implementation (Green Phase)
- [ ] Task: Refactor `updatePlayerList` in `game.js`.
    - [ ] Locate the `updatePlayerList` function (around L1783).
    - [ ] Replace the `innerHTML` string template logic with safe DOM manipulation using `document.createElement`.
    - [ ] Use `element.textContent` for the player name, distance, and direction arrow.
    - [ ] Ensure the `.player-self` class and `data-uid` attribute are correctly applied.
- [ ] Task: Verify fix with reproduction script.
    - [ ] Run the reproduction logic and confirm the malicious payload is rendered as literal text and NOT executed.
- [ ] Task: Conductor - User Manual Verification 'Implementation' (Protocol in workflow.md)

## Phase 3: Final Integration Testing
- [ ] Task: Manually verify full player list functionality in the game.
    - [ ] Confirm that self and other players (if any) are rendered correctly.
    - [ ] Verify that distances and direction arrows update correctly as the plane moves.
- [ ] Task: Conductor - User Manual Verification 'Final Integration' (Protocol in workflow.md)
