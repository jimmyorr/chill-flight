# Release notes

## 0.9.3

- **Environment:** Added procedural distant horizon clouds. Enhanced sky gradients and implemented a universal directional fog for seamless blending across all objects.
- **Environment:** Smoothed aurora borealis transitions. Guaranteed rainbows to spawn when heavy rain clears and reduced overall rain frequency.
- **System:** Extracted GLSL shaders to dedicated files and restructured the debug UI with dedicated testing pages.

## 0.9.2

- **Environment:** Extended the day-night cycle to 6 minutes, lingering on sunrise and sunset for 2 minutes each.
- **Environment:** Implemented a hybrid dynamic sky that pairs the procedural zenith with curated, vibrant horizon color palettes.

## 0.9.1

- **Controls:** Fixed an issue where iPad gyroscope controls could be inverted in landscape mode.

## 0.9.0

- **Models:** Rebuilt airplane geometry with dynamic colors. Enhanced bushes with squished icosahedrons and cacti with procedural arms.
- **Environment:** Redesigned castle ruins, windmills, and monasteries. Added a two-story house and upgraded buildings with doors, silos, and chimneys.
- **Gameplay:** Scaled airplane turbulence intensity based on rain and increased base amplitude.
- **System:** Added CapacitorDevice dependency to SPM configuration.

## 0.8.27

- **Controls:** Completely rewrote gyro orientation math using quaternions to permanently fix axis confusion when starting at an angle, and restored original landscape pitch polarity.
- **Controls:** Added a "GYRO RESET" button to the mobile pause menu to instantly recalibrate device orientation center point.
- **Gameplay:** Adjusted airplane flight speed initialization and vehicle-specific constants.

## 0.8.26

- **Models:** Added a new Canada goose model. Enhanced the sailboat with a detailed hollow hull, rim, deck, and boom. Replaced the basic tent with a detailed A-frame body, inset entrance, and structural crossing poles.
- **Environment:** Flocks of geese now occasionally spawn across the terrain. Birds now sleep and disappear at night, resuming their flight in the morning.

## 0.8.24 - 0.8.25

- **Environment:** Added dynamic shooting stars and rainbow weather effects. Fixed muddy sunset colors in the procedural sky.
- **Controls:** Reduced global flight throttle acceleration rates. Fixed mobile speed button sensitivity and double-trigger bugs.
- **System:** Added automatic graphics preset detection using device hardware capabilities. Consolidated core game logic into `game-bundle.js`.

## 0.8.23

- **Cinematic sky overhaul:** Upgraded procedural clouds with dual-layer parallax and hardware texture sampling. Clouds are now physically anchored to the 3D world.
- **Environment:** Added the ability to fly above the cloud layer and dynamically disabled precipitation at high altitudes. Defaulted blocky object clouds to off.
- **System & mobile:** Upgraded capacitor-swift-pm to 8.3.4 and initialized iOS project structures for native builds.

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
