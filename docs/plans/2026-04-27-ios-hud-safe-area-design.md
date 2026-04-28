# Design: Integrated iOS HUD Safe Area

## Goal
Extend the HUD background to the top of the screen on native iOS to eliminate the "sky gap" visible above the HUD when it respects the safe area inset.

## Background
On iOS devices with notches or dynamic islands, the HUD currently shifts down using `env(safe-area-inset-top)`. While this keeps the content visible, it leaves the game world (sky) visible in the top margin, which looks unpolished for a native app.

## Design
The design moves the HUD element to the very top of the screen (`top: 0`) and uses internal padding to maintain the safe distance for content.

### Components

#### HUD Styling (`style.css`)
- **Positioning**: Update `#cockpit-ui` in the mobile media query (`max-width: 1024px`) to use `top: 0`.
- **Padding**: Adjust `padding-top` to `calc(env(safe-area-inset-top, 0px) + 5px)`.
- **Consistency**: Ensure the background opacity and blur cover the newly extended area.

## Trade-offs
- **Pros**: 
    - Seamless, premium native look.
    - Consistency across all iOS device types (notch vs. non-notch).
- **Cons**: 
    - HUD is no longer a "floating pill" on mobile, but a top-anchored bar (this is already the case for the width, so it matches existing mobile design intent).

## Verification Plan
1. **Manual Verification**: Verify on iOS device/simulator that the dark HUD background extends to the very top of the screen.
2. **Visual Check**: Ensure text remains centered and below the notch area.
