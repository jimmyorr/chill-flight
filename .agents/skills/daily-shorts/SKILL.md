---
name: daily-shorts
description: >-
  Scouts, choreographs, renders, and verifies vertical 9:16 (1080x1920, 30 fps)
  YouTube Shorts and TikTok videos for Chill Flight, including bit-exact
  4-landscape match-cut clips, auto-scouted arch flights, telephoto landmark
  passes, side-profile silhouettes, and window-seat views. Use this skill
  whenever the user asks to create, generate, scout, or render a YouTube Short,
  TikTok clip, vertical promo video, or daily match-cut for a given world seed.
---

# Creating daily shorts and match-cut clips

Use [scripts/shorts.js](../../../scripts/shorts.js) to render vertical `1080x1920` (30 fps) short-form videos and their companion `.txt` metadata sidecars (with ready-to-paste YouTube Shorts and TikTok titles, descriptions, timestamps, and music credits) into `promo/`.

## Variety and rotation rules

Before designing a new Short, inspect the most recent 3 to 4 entries at the bottom of [scripts/shorts.js](../../../scripts/shorts.js) and rotate all four axes so consecutive Shorts never feel repetitive:

1. **Aircraft & livery** (`plane=` + `livery=`):
   - `biplane` (nimble aerobatics: loops, clover loops, crisp rolls)
   - `seaplane` (high-wing pontoon cruiser: water skims, arches, bayous, lighthouses)
   - `twin` (wide-wingspan DC-3 transport: dual props, sweeping scenic banks; note `livery=sand` gives a midnight-navy fuselage with gold trim, while other liveries use a snow-white fuselage with colored cowlings and tail)
   - `jet` (swept-wing twin-tail fastmover: `speedMult` `1.5` to `1.8`, high-speed canyon and arch runs)
   - Valid livery names (`ChillFlightLogic.LIVERY_NAMES`): `coral`, `teal`, `sage`, `purple`, `slate`, `sand`, `rose`, `black`.
2. **Camera rig family** (do not default to standard rear-quarter `fov=65` chase cam every day; pick from the camera library below: telephoto compression, low-angle look-up, side-profile silhouette, front-above look-back, high overhead, or window-seat).
3. **Maneuver profile**:
   - Vary beyond a plain barrel roll: full vertical loop + climbing roll + dive (`loopDip: true` with `null` intermediate channels), quarter clover loop (`90` degree heading change over the top), inverted arch thread, crisp S-bank canyon slalom, low-to-high sunrise climb, or unhurried window-seat cruise.
4. **Landmarks, biomes, and visual modifiers**:
   - Avoid repeating landmarks used in the immediately preceding Short. Mix times of day (`tod=0.27` dawn, `0.48` noon, `0.68` golden hour, `0.77` twilight + `headlight=1`), cloud moods (`fair`, `mackerel`, `high`, `busy`), weather (`weather=snow`, `weather=rain`, `forceRainbow`, `flashLightning`), `trip=1` (rainbow smoke), or `style=anime`.

## Camera angle library & portrait 9:16 framing math

In portrait `9:16` (`540x960` CSS at `2x` = `1080x1920`), horizontal field of view is narrow, so wingspan clearance and sightline bearing (`atan2(ox - lx, oz - lz)`) determine what stays in frame:

- **Telephoto landmark compression rig** (`camOffset=-16,10,98&camLook=3,-4,-85&fov=34`):
  - Halving `fov` from `65` to `32..36` while doubling camera distance (`z = 92..110`) keeps the aircraft the same size on screen while making background volcanoes, pyramids, giant oaks, moons, and arches loom **2x larger** via lens compression.
- **Low-angle arch / cliff look-up rig** (`camOffset=10,-5,62&camLook=0,8,-80&fov=62`):
  - Positioned slightly _below_ the aircraft (`oy = -4..-6`) looking upward (`ly = +6..+10`). Ideal when threading rock arches, gorge bridges, or flying past towering cliffs and giant trees so the span towers overhead.
- **Pure side-profile silhouette rig** (`camOffset=82,-10,5&camLook=0,2,-4&fov=50`):
  - Studio Ghibli / Wes Anderson side-on profile (`ox = +/-75..90`, `oy = -8..-12`). Place sunset clouds, waterfalls, pyramids, or island archipelagos `600..2500` units off the opposite wing (`-ox` side) so they scroll cleanly behind the plane in parallax.
- **Front-above look-back rig** (`camOffset=10,22,-105&camLook=-4,16,55&fov=62`):
  - Positioned `95..110` units _ahead_ of the nose (`oz < 0`) and above (`oy > 0`), looking back past the banking plane (`lz > 0`) as a waterfall, volcano crater, or arch recedes dramatically in the upper frame.
- **Three-quarter front hero rig** (`camOffset=24,8,-50&camLook=-5,4,18` or left-front `camOffset=-22,6,-48&camLook=4,3,18`):
  - Shows the spinning propeller(s), cockpit, and leading edges up close while landmarks placed `350..900` units _behind_ the aircraft rise above the tail.
- **High overhead shadow-chase rig** (`camOffset=0,68,25&camLook=0,-10,-25&fov=60`):
  - Steep top-down view showcasing ground patterns: winding canyon rivers, turquoise reefs, dragon skeleton bones, highway cloverleafs, or aircraft shadows over sand dunes.
- **Wing-strut / window-seat rig** (`camOffset=4.2,1.1,-3.2&camLook=18,-0.8,-22&fov=62` on biplane):
  - Intimate cockpit-side view looking out across the wing/struts toward coastal lighthouses, mountain ridges, or sunset clouds (best with gentle banks rather than full 360 rolls, since `?camOffset` uses a yaw-stabilized world-up frame).
- **Standard rear-quarter chase rig** (`camOffset=-8,10,52&camLook=0,-5,-66`):
  - Keep `z >= 50` for wide-wingspan planes (`twin`, `jet`) at `fov=65` so wingtips never clip the left/right edges of the `9:16` frame (`z = 42..46` works for `biplane` and `seaplane`).

## Core technical rules for match-cut shorts

1. **Bit-exact continuity across cuts (`startCoordsForFrame`)**:
   - Every segment in a match-cut video dispatches the **exact same 12-second `moves` array** at `t = 0` after `PREROLL` (`1.5s`) and steps the virtual clock from frame `0` up to `seg.endFrame`, saving frames only in `[seg.startFrame, seg.endFrame)`.
   - Note how [promo-script.js](../../../promo-script.js) works: deterministic direct-attitude mode (`scripted.loop = true`) activates only when `moves` has at least one keyframe with `|pitchDeg| > 75` or `|yawDeg| > 0`. Always include explicit `yawDeg` values when using `startCoordsForFrame`, and pass `loopDip: true` whenever `moves` triggers loop speed dip (`|pitch| > 75` or non-zero `yaw` in `game-loop.js` line 1444).
2. **Back-solving `(tx, ty, tz)` for an exact interior hit frame**:
   - `renderMatchCutClip` passes `seg.startFrame` (`0`, `90`, `180`, `270`) to `startCoordsForFrame`, so `(seg.tx, seg.ty, seg.tz)` is where the plane sits at the **start** of the segment.
   - When threading an arch or passing abeam a landmark at an interior frame `hitFrame` (for example `f = 138` or `f = 216`, `1.2s..1.6s` after the cut so viewers see the landmark ahead before passing through it), back-solve `(tx, ty, tz)` at `seg.startFrame` in Node by subtracting the `startFrame -> hitFrame` displacement from the landmark coordinates.
3. **Seamless `12s -> 0s` loop**:
   - Start `moves` at `[0, 0, 0, 0]`.
   - Hold `yaw` constant for the final `2.4s+` (`t = 9.0s .. 12.0s`) and ease `roll` and `pitch` to exact multiples of `360` (`0`, `360`, or `-360`) by `t = 11.2s .. 12.0s` so `state._cinematicStableHeading` and the 3D smoke ribbon converge before frame `359` loops into frame `0`.
4. **On-screen pill badge & copy**:
   - Top line: `CHILL FLIGHT · Play free at chillflight.app`
   - Bottom line: `<Place Name> · <lat>, <long>`
   - Never call biomes "worlds" (it is one continuous world; say "biomes", "landscapes", "landmarks", or "places"), and never use em dashes anywhere.

## Step-by-step workflow for a new daily short

### Step 1: Scout the target seed (`YYYYMMDD`) & verify full corridors

Run a synchronous Node check (`process.exit(0)`) to discover all procedural landmarks on the seed AND verify that every frame from `-preroll` (`f = -45`) through `seg.endFrame` clears terrain, water, pyramid slopes, and arch ceilings/legs by at least `50` units (including `+/- 25` units laterally and camera height `y + camOffset.y` under arches):

```bash
node -e '
import("./chill-flight-logic.js").then(async ({ChillFlightLogic}) => {
  const {simplex} = await import("./noise.js");
  const {archSites} = await import("./arches-logic.js");
  const seed = 20261116;
  ChillFlightLogic.WORLD_SEED = seed;
  simplex.seed(seed);
  const opts = {WATER_LEVEL: 40};
  console.log("Pyramids:", ChillFlightLogic.pyramidSite(simplex, opts));
  console.log("Dragon:", ChillFlightLogic.dragonSite(simplex, opts));
  console.log("Swamp Oak:", ChillFlightLogic.giantSwampOak());
  console.log("Portals:", ChillFlightLogic.portalSites(simplex, opts));
  console.log("Xmas:", ChillFlightLogic.xmasVillageSite?.(simplex, opts));
  for (const a of archSites(simplex, opts)) {
    const lat = (Math.abs(a.z) / 5000).toFixed(1) + "°" + (a.z <= 0 ? "N" : "S");
    const lon = (Math.abs(a.x) / 5000).toFixed(1) + "°" + (a.x >= 0 ? "E" : "W");
    console.log("Arch:", a.kind, "x=" + Math.round(a.x), "z=" + Math.round(a.z), lat + ", " + lon);
  }
  process.exit(0);
});
'
```

Landmarks available to mix and match:

- **Procedural per-seed**:
  - **Sea Arches (`kind === 'sea'`)**: Tropical turquoise/red-rock arches in the south-east (`Z > 0`), or **Arctic snow-dusted sea arches** surrounded by icebergs when `Z < -15000` (`> 3.0°N`).
  - **Mountain Gorge Bridges (`kind === 'gorge'`)**: Massive stone spans (`maxUnder` up to `500+`, often crossing directly over mountain highways!).
  - **Canyon Natural Bridges (`kind === 'canyon'`)**: Banded sandstone spans across narrow Grand Canyon narrows (present on seeds with deep canyons).
  - **Alien Basalt Gates (`kind === 'basalt'`)**: Fallen hexagonal columns spanning bioluminescent mushroom ravines in the eastern alien honeycomb (`X > 55000`).
  - **Giant Swamp Oak (`giantSwampOak()`)**: Unmarked ~272-unit-tall twisted mossy oak in the western misty bayou (`1.0°W .. 3.0°W`).
  - **Paired Alien Wormhole Portals (`portalSites()`)**: Glowing violet portal arches in eastern Xen and western Westworld (`|X| > 50000`).
  - **Great Pyramids (`pyramidSite()`)**: Three stepped desert pyramids (`~4.0°S, 2.0°W`; note `getElevation` includes their solid `~650`-unit apex, so fly `800..1500` units away for panoramic framing).
  - **Colossal Dragon Skeleton (`dragonSite()`)**: 290-unit ivory skeleton in perpetual snowfall (`~3.6°N, 2.7°W`).
  - **Christmas Village (`xmasVillageSite()`, enable with `&xmas=full`)**: Festive lit village beside Pinewood Field (`~3.4°N, 0.8°W`).
- **Fixed on every seed**:
  - **Twin Falls**: `X = 0, Z = -4500` (`0.9°N, 0.0°E`), cliff lip `Y = 420`, plunge pool south of `Z = -4400` at `Y = 40`.
  - **Volcano Caldera**: `X = -5000, Z = 5000` (`1.0°S, 1.0°W`), rim `Y ~ 1700`, smoking crater floor `Y ~ 1002` (fly around `Y = 2000..2100` to see down into the cauldron).
  - **Headland Lighthouse**: `X = 7525, Z = 3000` (`0.6°S, 1.5°E`), rotating golden spotlight beam visible at dusk/night (`tod >= 0.74`).
  - **Grand Canyon**: `X = 2000..3600, Z = 11500..22000` (check `getElevation` on each seed to confirm river depth vs. continent outline).

### Step 2: Fast `--preview` check & full `1080x1920` render

Ensure the local Vite dev server is listening on `http://localhost:5173/` (do not start a second server on macOS if port `5173` is already up, and never run more than one headless Chrome instance at a time).

- **Never write custom virtual-clock scratch scripts**. Add the Short to [scripts/shorts.js](../../../scripts/shorts.js) (which uses `openPromoWorld` from [scripts/dev-browser.js](../../../scripts/dev-browser.js) with a mandatory timeout and `#loading-overlay` + `farReady` check) and run `--preview` first (~55s for a 12-tile contact sheet):

```bash
node scripts/shorts.js <short-id> --preview
```

Inspect `promo/preview-<outBaseName>.jpg` with `read_file`, refine framing/timing until all 4 landmarks and wingtips sit cleanly inside the `9:16` frame, delete `promo/preview-*.jpg`, and render the full `1080x1920` video:

```bash
node scripts/shorts.js <short-id>
```

Confirm music track slugs against `RAW_TRACKS` in [music-logic.js](../../../music-logic.js) before rendering so R2 downloads (`purrple-cat-<slug>.mp3`) never fall back unintentionally to the default track.

### Step 3: Empirical visual verification (required)

Extract a 12-frame `1 fps` contact strip and an 8-frame cut-boundary strip (`frames 0, 89, 90, 179, 180, 269, 270, 359`), inspect both images and the `.txt` sidecar with `read_file`, and delete the temporary `.jpg` strips afterward:

```bash
ffmpeg -y -loglevel error -i promo/<outBaseName>.mp4 \
  -vf "fps=1,scale=270:480,tile=6x2" -frames:v 1 -update 1 -q:v 3 promo/strip-verify-12.jpg
ffmpeg -y -loglevel error -i promo/<outBaseName>.mp4 \
  -vf "select='eq(n\,0)+eq(n\,89)+eq(n\,90)+eq(n\,179)+eq(n\,180)+eq(n\,269)+eq(n\,270)+eq(n\,359)',scale=270:480,tile=4x2" \
  -fps_mode passthrough -frames:v 1 -update 1 -q:v 3 promo/strip-verify-cuts.jpg
```

### Step 4: Publish to YouTube Shorts

Use [scripts/post-short.js](../../../scripts/post-short.js) to upload, verify the exact read-back YouTube Title (`<= 100` chars), confirm any `"Publish anyway"` dialog, and publish to YouTube Shorts:

```bash
node scripts/post-short.js promo/<outBaseName>.mp4
```
