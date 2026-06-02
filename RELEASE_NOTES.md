# Release notes

## 0.8.22

- **Camera & UI:** Enhanced the free camera with click-and-drag rotation. Relocated the version identifier to the main start screen card and pause menu footer.
- **Debug tooling:** Added shareable URLs for camera position, pitch, heading, and time configurations. Debug settings (like free camera and manual time) now persist after hiding the debug menu.

## 0.8.21

- **Cinematic sky overhaul:** Introduced stunning volumetric sun bloom, procedural clouds, and dynamic regional day sky colors that shift based on your biome.
- **Aurora borealis enhancement:** Smoothed the intensity curve to prevent blow-outs and significantly increased animation speed for real-time dancing.
- **Debug tooling:** Added auto-pause and resume features to the manual time slider, and a new real-time day blue color swatch.

## 0.8.20

- **Controls:** Added dynamic flight throttle via mouse wheel, and an Immelmann turn maneuver triggered by a triple-tap down input.
- **Environment:** Enhanced procedural island generation with domain warping and mountainous ridges. Added dynamic moon phases and softened lighthouse beam effects.

## 0.8.19

- **Controls:** Added a sensitivity multiplier to virtual joystick movement for smoother handling.

## 0.8.18

- **UI & controls:** Introduced a premium floating virtual joystick and a new control scheme selector for mobile. Consolidated graphics settings into simplified presets.
- **Camera:** Added a cinematic camera intro transition and fixed virtual camera jerk issues.

## 0.8.17

- **Animations:** Added procedural drifting and bobbing to sailboats. Animated hawks to dynamically transition between flapping and soaring.
- **Controls:** Decoupled pitch-inversion logic from throttle, lift, and translation inputs.

## 0.8.16

- **UX improvements:** Added onboarding tooltips for restarting the plane and opening the mobile menu. Improved checkbox accessibility and prevented touch gestures from interfering with steering.

## 0.8.14 - 0.8.15

- **Android prep:** Added initial splash screen assets, audio resources, and UI layout configuration. Removed AD_ID permissions from the manifest.

## 0.8.11 - 0.8.13

- **Map & UI:** Implemented an interactive procedural minimap with zoom controls and landmark support. Added starting position support via URL parameters.
- **Mobile & assets:** Added gyro sensor integration, upgraded Capacitor dependencies, added a privacy policy page, and updated the application icon with a new sunset gradient.

## 0.8.8 - 0.8.10

- **Environment:** Implemented smooth weather transitions for rain and snow. Refined terrain generation by carving rivers cleanly and restricting pine trees in the southern desert.

## 0.8.4 - 0.8.7

- **Environment:** Added Japanese maple trees with zen garden pagodas. Improved smoke rendering with fanning directions and smooth fades.
- **UI & tooling:** Enhanced HUD interactivity, configured Tauri desktop builds, and automated versioning pipelines.

## 0.8.3

- **Environment:** Introduced a procedural volcano landmark with basalt texturing. Added the aurora borealis shader with dynamic intensity.
- **Debug tooling:** Added a manual time of day slider to the debug menu.

## 0.8.2

- **Camera & UI:** Added a free camera mode, updated autopilot UI toggle logic, and improved visibility by reducing base fog density. Added fog controls to the debug menu.

## 0.8.1

- **Graphics:** Added dynamic water shading, an atmospheric sun glow, and organic ripples to terrain speculars. Synced moon position with the sun cycle.
- **System & mobile:** Implemented TV client detection, disabled unintended iOS gestures, integrated Sentry and Firebase, and added local filesystem caching for offline audio.
