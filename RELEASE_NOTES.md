# Release notes

## [0.9.42](https://v0-9-42.chill-flight.pages.dev)

- **Optimization:** Pruned Inter font imports to Latin-only subsets, removing 36 unused font files.
- **Assets:** Offloaded custom heightmaps to Cloudflare R2 on-demand storage, saving 4.6 MB in bundle size.
- **Deployment:** Integrated Cloudflare Pages preview deployments and git tagging into the release workflow.

## [0.9.41](https://v0-9-41.chill-flight.pages.dev)

- **Visuals:** The headlight shines ahead of the plane, distant terrain fades smoothly into the horizon, and the world map and minimap label the snowy north, red-rock south and alien lands.

## [0.9.40](https://v0-9-40.chill-flight.pages.dev)

- **Night:** A silver moon path on the water, moonlit clouds and a halo around the moon; the plane's headlight lights the ground from flight altitude again.
- **Nature:** Trees sway in the wind.
- **Terrain:** A real lake district in the west, rivers that widen into estuaries with tributaries, clean snow and sand, and no more stray grey needles.

## [0.9.39](https://v0-9-39.chill-flight.pages.dev)

- **Horizon:** Distant mountains and coastlines now show out to 27 km.
- **Sky:** Clouds glow after sunset, reflect in the water, and dim at night.
- **North:** Snow comes in gradually, with snow-capped peaks before the snow country; the first ranges north and south always appear.
- **Performance:** Cheaper fog on terrain and water, and fewer draw calls for village props.
- **Fixes:** Forcing an island type works again; no line where the distant terrain begins.

## [0.9.38](https://v0-9-38.chill-flight.pages.dev)

- **Water:** Reflects the sky, with a golden sun glitter path, deep blue to turquoise shallows, shore foam and smooth shorelines.
- **Sky:** Sunset colors vary around the compass, with the earth's shadow at twilight; sunset clouds glow gold and pink.
- **Performance:** Terrain chunks build from worker results within the frame budget; stuck workers time out.
- **Fixes:** Props follow the chosen world seed; distant islands stay visible longer.

## [0.9.37](https://v0-9-37.chill-flight.pages.dev)

- **Performance:** Improved tree rendering and shadow costs with tiled culling, near-plane shadow casting, and simpler distant trees.
- **Visuals:** Faded shadows in ahead of the plane and kept snow and ice shading visible in bright daylight.
- **Diagnostics:** Limited Sentry initialization to production builds.

## [0.9.35](https://v0-9-35.chill-flight.pages.dev)

- **Performance:** Fixed production terrain workers crashing on startup, which forced all terrain generation onto the main thread.
- **Architecture:** Migrated all game code to ES modules with explicit imports, shared state and no window globals.
- **Tooling & quality:** Added headless browser smoke tests for dev and production builds, plus checks for undefined globals and import order.
- **Diagnostics:** Sentry now reports errors thrown during startup.

_First release developed with Claude (ES module migration)._

## [0.9.34](https://v0-9-34.chill-flight.pages.dev)

- **Web workers:** Offloaded terrain elevation, normals, and water meshes to background workers with directional priority scheduling and job cancellation.
- **Environment:** Aligned highway canyon carving to unwarped coordinates to restore mountain pass valley cuts; fixed volcano crater tilt and lava alignment.
- **Visuals:** Resolved chunk lighting seams by aligning worker color space with Three.js; fixed instanced mesh prop culling.

## [0.9.31](https://v0-9-31.chill-flight.pages.dev)

- **Logging & diagnostics:** Added lightweight logger (`logger.js`) gating diagnostic logs behind `?debug=1`, a clean startup banner, and console guidelines.
- **Tooling & quality:** Added HTML script reference validation test, dynamic global ESLint scope analysis, and resolved all lint warnings.
- **Build system:** Suppressed classic script bundle warnings, adjusted chunk size limit, and streamlined metadata syncing.

## [0.9.29](https://v0-9-29.chill-flight.pages.dev)

- **Engine:** Upgraded three.js from 0.128.0 to 0.186.1 with modernized lighting, color management, and WebGL renderer setups.
- **Flight & controls:** Refactored throttle handling into an `applyThrottleDelta` helper.
- **Tooling & release:** Added clean-source guards for production builds and dynamic git telemetry in Vite.

## [0.9.23](https://v0-9-23.chill-flight.pages.dev)

- **Aircraft:** Added Twin engine transport model (DC-3 style) with twin radial nacelles, lofted fuselage, accent livery, and spinning 3-blade props. Added Glider and Biplane models with full livery support.
- **Controls:** `V` hotkey cycles aircraft; pause menu aircraft selector; `?plane=` URL parameter support.
- **Gameplay:** Vehicle-specific speed limits (glider caps at 300 km/h).
- **Debug:** Removed obsolete sky debug page.

## [0.9.22](https://v0-9-22.chill-flight.pages.dev)

- **Islands & shorelines:** Added Karst limestone towers, calderas, and coral atolls, plus soft water edge blending and wet sand.
- **World map:** Added an interactive fullscreen map overlay with pinch-to-zoom, pan gestures, and landmark icons.
- **Performance & LOD:** Tuned DRS thresholds, optimized graphics presets, and exempted watercraft from prop LOD popping.
- **Achievements & debug:** Added Limbo and Cartographer achievements, cloud controls, and a two-column debug panel.

## [0.9.17](https://v0-9-17.chill-flight.pages.dev)

- **Environment:** Overhauled dynamic mountains with alpine peaks, cirques, and snowcaps. Redesigned viaducts, smoothed highways, and resolved coastline and ice shelf z-fighting.
- **Performance:** Added dynamic resolution scaling (DRS), shadow throttling, adaptive chunk budgets, and prop LOD scaling.
- **Controls & debug:** Added telemetry for FPS, DRS, and LOD, real-time URL syncing, and benchmark mode.

## [0.9.15](https://v0-9-15.chill-flight.pages.dev)

- **Visuals & lighting:** Extended visual sunrise duration, fixed water reflection jumps, and smoothed day-to-night transitions. Replaced regional sky calculations with palette-driven sky colors.
- **Performance & graphics:** Optimized graphics presets with extended draw distances and dynamic prop LOD scaling.
- **System:** Added custom day sky color configuration and updated web icons.

## [0.9.11](https://v0-9-11.chill-flight.pages.dev)

- **Performance:** Optimized terrain rendering with global instancing and LOD scaling. Reduced boot loading delays.
- **Flight & camera:** Decoupled aerodynamic logic for smooth frame-independent flight. Added camera inertia for flight momentum and fixed throttle key conflict.
- **UI & visuals:** Prevented loading screen layout shifts, refined telemetry layout, and ensured rainbows reliably appear after rain clears.

## [0.9.9](https://v0-9-9.chill-flight.pages.dev)

- **Environment:** Added world origin shifting to support infinite terrain expansion and eliminate floating-point precision issues.
- **Performance:** Implemented chunk geometry pooling to recycle terrain buffers and pre-allocated vector scratch objects to eliminate garbage collection stutter.
- **Architecture:** Extracted input handling into a dedicated input manager.

## [0.9.8](https://v0-9-8.chill-flight.pages.dev)

- **Achievements:** Implemented a full achievements system with a progress tracking UI overlay. Added session and lifetime distance tracking, persistent storage, and 18 unique unlockable achievements based on flight maneuvers, exploration, and events.

## [0.9.7](https://v0-9-7.chill-flight.pages.dev)

- **Environment:** Upgraded road generation to feature multi-lane highways and smoother surface alignment. Added procedural streetlights with time-of-day brightness scaling, light-pooling decals, and adaptive frequency.
- **Visuals:** Fixed shadow rendering and chunk loading to correctly anchor to the camera during free cam mode.
- **UI & Controls:** HUD telemetry now accurately reflects the free cam position and heading. Fixed the manual time slider to properly handle reversing time.

## [0.9.6](https://v0-9-6.chill-flight.pages.dev)

- **Environment:** Expanded map and implemented an alien biome at the far extremes featuring distorted terrain and glowing neon seas. Added a frozen north biome with jagged pack ice shelves and deep frozen oceans.
- **Models:** Scaled the Rock Arch landmark, thickened its geometry, and randomized its position based on the world seed. Fixed volcano lava generating inside carved rivers.
- **System:** Added latitude/longitude grid lines and coordinate labels to the debug map view.

## [0.9.5](https://v0-9-5.chill-flight.pages.dev)

- **Environment:** Added seagulls to coastal regions. Implemented procedural color variations for trees and bushes. Added the Rock Arch landmark.
- **Controls:** Autopilot now automatically disables upon detecting manual steering input.
- **System:** Implemented dynamic module loading for entry points. Enabled native Firebase Analytics. Fixed windmill shadows, moon reflections on water, and prevented shadow projection flipping during sunsets.

## [0.9.4](https://v0-9-4.chill-flight.pages.dev)

- **Environment:** Overhauled stars with varying sizes, colors, and a twinkling effect. Added icebergs, ice floes, and animated penguins to deep north waters.
- **Environment:** Updated moon position, phase math, and cloud occlusion. Increased render distances to reveal distant landmarks.
- **Controls:** Stabilized mobile steering with improved touch tracking. Updated autopilot to treat target altitude as a minimum. Fixed hawk flight orientation.

## [0.9.3](https://v0-9-3.chill-flight.pages.dev)

- **Environment:** Added procedural distant horizon clouds. Enhanced sky gradients and implemented a universal directional fog for seamless blending across all objects.
- **Environment:** Smoothed aurora borealis transitions. Guaranteed rainbows to spawn when heavy rain clears and reduced overall rain frequency.
- **System:** Extracted GLSL shaders to dedicated files and restructured the debug UI with dedicated testing pages.

## [0.9.2](https://v0-9-2.chill-flight.pages.dev)

- **Environment:** Extended the day-night cycle to 6 minutes, lingering on sunrise and sunset for 2 minutes each.
- **Environment:** Implemented a hybrid dynamic sky that pairs the procedural zenith with curated, vibrant horizon color palettes.

## [0.9.1](https://v0-9-1.chill-flight.pages.dev)

- **Controls:** Fixed an issue where iPad gyroscope controls could be inverted in landscape mode.

## [0.9.0](https://v0-9-0.chill-flight.pages.dev)

- **Models:** Rebuilt airplane geometry with dynamic colors. Enhanced bushes with squished icosahedrons and cacti with procedural arms.
- **Environment:** Redesigned castle ruins, windmills, and monasteries. Added a two-story house and upgraded buildings with doors, silos, and chimneys.
- **Gameplay:** Scaled airplane turbulence intensity based on rain and increased base amplitude.
- **System:** Added CapacitorDevice dependency to SPM configuration.

## [0.8.27](https://v0-8-27.chill-flight.pages.dev)

- **Controls:** Completely rewrote gyro orientation math using quaternions to permanently fix axis confusion when starting at an angle, and restored original landscape pitch polarity.
- **Controls:** Added a "GYRO RESET" button to the mobile pause menu to instantly recalibrate device orientation center point.
- **Gameplay:** Adjusted airplane flight speed initialization and vehicle-specific constants.

## [0.8.26](https://v0-8-26.chill-flight.pages.dev)

- **Models:** Added a new Canada goose model. Enhanced the sailboat with a detailed hollow hull, rim, deck, and boom. Replaced the basic tent with a detailed A-frame body, inset entrance, and structural crossing poles.
- **Environment:** Flocks of geese now occasionally spawn across the terrain. Birds now sleep and disappear at night, resuming their flight in the morning.

## [0.8.24](https://v0-8-24.chill-flight.pages.dev) – [0.8.25](https://v0-8-25.chill-flight.pages.dev)

- **Environment:** Added dynamic shooting stars and rainbow weather effects. Fixed muddy sunset colors in the procedural sky.
- **Controls:** Reduced global flight throttle acceleration rates. Fixed mobile speed button sensitivity and double-trigger bugs.
- **System:** Added automatic graphics preset detection using device hardware capabilities. Consolidated core game logic into `game-bundle.js`.

## [0.8.23](https://v0-8-23.chill-flight.pages.dev)

- **Cinematic sky overhaul:** Upgraded procedural clouds with dual-layer parallax and hardware texture sampling. Clouds are now physically anchored to the 3D world.
- **Environment:** Added the ability to fly above the cloud layer and dynamically disabled precipitation at high altitudes. Defaulted blocky object clouds to off.
- **System & mobile:** Upgraded capacitor-swift-pm to 8.3.4 and initialized iOS project structures for native builds.

## [0.8.22](https://v0-8-22.chill-flight.pages.dev)

- **Camera & UI:** Enhanced the free camera with click-and-drag rotation. Relocated the version identifier to the main start screen card and pause menu footer.
- **Debug tooling:** Added shareable URLs for camera position, pitch, heading, and time configurations. Debug settings (like free camera and manual time) now persist after hiding the debug menu.

## [0.8.21](https://v0-8-21.chill-flight.pages.dev)

- **Cinematic sky overhaul:** Introduced stunning volumetric sun bloom, procedural clouds, and dynamic regional day sky colors that shift based on your biome.
- **Aurora borealis enhancement:** Smoothed the intensity curve to prevent blow-outs and significantly increased animation speed for real-time dancing.
- **Debug tooling:** Added auto-pause and resume features to the manual time slider, and a new real-time day blue color swatch.

## [0.8.20](https://v0-8-20.chill-flight.pages.dev)

- **Controls:** Added dynamic flight throttle via mouse wheel, and an Immelmann turn maneuver triggered by a triple-tap down input.
- **Environment:** Enhanced procedural island generation with domain warping and mountainous ridges. Added dynamic moon phases and softened lighthouse beam effects.

## [0.8.19](https://v0-8-19.chill-flight.pages.dev)

- **Controls:** Added a sensitivity multiplier to virtual joystick movement for smoother handling.

## [0.8.18](https://v0-8-18.chill-flight.pages.dev)

- **UI & controls:** Introduced a premium floating virtual joystick and a new control scheme selector for mobile. Consolidated graphics settings into simplified presets.
- **Camera:** Added a cinematic camera intro transition and fixed virtual camera jerk issues.

## [0.8.17](https://v0-8-17.chill-flight.pages.dev)

- **Animations:** Added procedural drifting and bobbing to sailboats. Animated hawks to dynamically transition between flapping and soaring.
- **Controls:** Decoupled pitch-inversion logic from throttle, lift, and translation inputs.

## [0.8.16](https://v0-8-16.chill-flight.pages.dev)

- **UX improvements:** Added onboarding tooltips for restarting the plane and opening the mobile menu. Improved checkbox accessibility and prevented touch gestures from interfering with steering.

## [0.8.14](https://v0-8-14.chill-flight.pages.dev) – [0.8.15](https://v0-8-15.chill-flight.pages.dev)

- **Android prep:** Added initial splash screen assets, audio resources, and UI layout configuration. Removed AD_ID permissions from the manifest.

## [0.8.11](https://v0-8-11.chill-flight.pages.dev) – [0.8.13](https://v0-8-13.chill-flight.pages.dev)

- **Map & UI:** Implemented an interactive procedural minimap with zoom controls and landmark support. Added starting position support via URL parameters.
- **Mobile & assets:** Added gyro sensor integration, upgraded Capacitor dependencies, added a privacy policy page, and updated the application icon with a new sunset gradient.

## [0.8.8](https://v0-8-8.chill-flight.pages.dev) – [0.8.10](https://v0-8-10.chill-flight.pages.dev)

- **Environment:** Implemented smooth weather transitions for rain and snow. Refined terrain generation by carving rivers cleanly and restricting pine trees in the southern desert.

## [0.8.4](https://v0-8-4.chill-flight.pages.dev) – [0.8.7](https://v0-8-7.chill-flight.pages.dev)

- **Environment:** Added Japanese maple trees with zen garden pagodas. Improved smoke rendering with fanning directions and smooth fades.
- **UI & tooling:** Enhanced HUD interactivity, configured Tauri desktop builds, and automated versioning pipelines.

## [0.8.3](https://v0-8-3.chill-flight.pages.dev)

- **Environment:** Introduced a procedural volcano landmark with basalt texturing. Added the aurora borealis shader with dynamic intensity.
- **Debug tooling:** Added a manual time of day slider to the debug menu.

## [0.8.2](https://v0-8-2.chill-flight.pages.dev)

- **Camera & UI:** Added a free camera mode, updated autopilot UI toggle logic, and improved visibility by reducing base fog density. Added fog controls to the debug menu.

## [0.8.1](https://v0-8-1.chill-flight.pages.dev)

- **Graphics:** Added dynamic water shading, an atmospheric sun glow, and organic ripples to terrain speculars. Synced moon position with the sun cycle.
- **System & mobile:** Implemented TV client detection, disabled unintended iOS gestures, integrated Sentry and Firebase, and added local filesystem caching for offline audio.
