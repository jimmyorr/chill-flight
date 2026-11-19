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

1. **Vehicle & livery** (`plane=` + `livery=`, or per-segment `seg.plane` / `seg.livery` for evolution cuts):
   - `biplane` (nimble aerobatics: loops, clover loops, crisp rolls, rigid GoPro wingtip mounts)
   - `seaplane` (high-wing pontoon cruiser: water-wake skims with `surface: true`, arches, bayous, lighthouses)
   - `twin` (wide-wingspan DC-3 transport: dual props, sweeping scenic banks, `?gear=1` runway touch-and-gos; note `livery=sand` gives a midnight-navy fuselage with gold trim, while other liveries use a snow-white fuselage with colored cowlings and tail)
   - `jet` (swept-wing twin-tail fastmover: `speedMult` `1.5` to `1.8`, tower flybys, canyon and formation runs)
   - `buggy` (Forza-style highway bridge drifts, dune jumps, and overhead jet passes via `driveMoves` or recorded `replay`)
   - Valid livery names (`ChillFlightLogic.LIVERY_NAMES`): `coral`, `teal`, `sage`, `purple`, `slate`, `sand`, `rose`, `black`.
2. **Camera rig & motion family** (rotate across static rigs, dynamic `camMoves`, and `camFrame` modes below rather than defaulting to rear-quarter `fov=65` chase cam):
   - Keyframed 360-degree bullet-time orbits (`camMoves` sweeping `orbitYawDeg` `0 -> 360` across 4 cuts)
   - Vertigo dolly-zooms (`camMoves` narrowing `fov` `75 -> 28` while pulling `oz` `38 -> 115`)
   - Rigid airframe GoPro mounts (`camFrame: 'plane'` bolted to wingtip, N-strut, or tail fin during full loops and rolls)
   - Stationary panning tower/bridge flybys (`camFrame: 'world-track'` with `camX`/`camY`/`camZ`)
   - Telephoto compression, low-angle arch look-up, Studio Ghibli side-profile silhouette, front-above look-back, or high overhead shadow-chase.
3. **Maneuver & multi-vehicle profile**:
   - Vary beyond a plain barrel roll: full vertical loop + climbing roll + dive (`loopDip: true`), quarter clover loop, rigid wingtip under-bridge roll, stationary flyby pull-up, 4-plane or lowpoly-to-anime evolution cut, single-take **Xen -> Westworld alien wormhole** crossing, water-wake skim to runway touchdown (`surface: true` + `gear: 1`), buggy drift with overhead jet V-formation (`wingmen`), or hand-flown `Shift+R` browser replay.
4. **Landmarks, biomes, and visual modifiers**:
   - Avoid repeating landmarks used in the immediately preceding Short. Mix times of day (`tod=0.27` dawn, `0.48` noon, `0.68` golden hour, `0.77` twilight + `headlight=1`), cloud moods (`fair`, `mackerel`, `high`, `busy`), weather (`weather=snow`, `weather=rain`, `rainbow: true`, `lightningFrames`), `trip: true` (rainbow smoke), or `style: 'anime'`.

## Camera reference frames (`camFrame`) & keyframed `camMoves`

[flight-camera.js](../../../flight-camera.js) and [promo-script.js](../../../promo-script.js) support four cinematic reference frames (`?camFrame=` or `camFrame` on the clip/segment) and smoothstep camera keyframes (`camMoves`):

- **Reference frames (`camFrame`)**:
  - `'yaw'` (default): Smoothed heading-only frame with world-up `(0, 1, 0)` horizon. Needs ~`2.4s` of constant yaw at clip end if looping `12s -> 0s` without `camMoves`.
  - `'yaw-lock'`: Zero-lag heading frame (`_cinematicStableHeading` locks directly to `planeGroup.rotation.y` with `cinematicDirectLock = 1`). Eliminates the `2.4s` camera settle tail at the end of looping Shorts!
  - `'plane'`: Rigid GoPro mount locked to `state.airplaneModel.matrixWorld` (including airframe pitch, yaw, roll, and local up vector, with ground/arch Y-push disabled). When the plane loops or barrel-rolls, the wing/tail stays bolted in the foreground while the world spins 360 degrees behind it.
  - `'world-track'`: World-space tripod or drone camera placed at `?camX=...&camY=...&camZ=...` (or animated in world coordinates via `camMoves` `ox, oy, oz`) that pans smoothly every frame to track `planeGroup.matrixWorld` + airframe-local `camLook` lead offset. Near chunks, far terrain, and sun shadows automatically anchor on the camera in `world-track` mode.
- **Keyframed camera track (`camMoves`)**:
  - Format: `[t, ox, oy, oz, lx, ly, lz, fov, orbitYawDeg, orbitPitchDeg]`.
  - Any channel can be `null` or omitted to leave that value untouched or ease across surrounding keyframes (`camMoves` automatically locks `cinematicDirectLock = 1` so orbits and dolly-zooms have zero chase lag, and is pre-armed before `PREROLL` so `camMoves[0]` holds cleanly at frame `0`).
  - **360 Bullet-Time Orbit**: `[[0, 0, 8, 52, 0, 2, 0, 58, 0, 0], [12, 0, 8, 52, 0, 2, 0, 58, 360, 0]]`.
  - **Vertigo Dolly-Zoom**: `[[0, -10, 6, 38, 2, -2, -65, 74], [3, -10, 11, 112, 2, -4, -90, 28]]`.

## Camera angle library & portrait 9:16 framing math

In portrait `9:16` (`540x960` CSS at `2x` = `1080x1920`), horizontal field of view is narrow, so wingspan clearance and sightline bearing (`atan2(ox - lx, oz - lz)`) determine what stays in frame:

- **Rigid wingtip / tail-fin GoPro rigs (`camFrame: 'plane'`)**:
  - Biplane upper wingtip looking inward & ahead: `camFrame=plane&camOffset=12.5,3.4,-0.8&camLook=-6,0.5,-16&fov=72`
  - Tail-fin mount looking forward over cockpit: `camFrame=plane&camOffset=0,4.8,9.2&camLook=0,0.6,-28&fov=68`
- **Stationary tower / bridge flyby rig (`camFrame: 'world-track'`)**:
  - Plant camera `18..35` units off the flight line on a lighthouse gallery, gorge bridge parapet, or control tower (`camX`, `camY`, `camZ`) with `camLook=0,0,-8` (slight nose lead) and `fov=55..65`.
- **Telephoto landmark compression rig** (`camOffset=-16,10,98&camLook=3,-4,-85&fov=34`):
  - Halving `fov` from `65` to `32..36` while doubling camera distance (`z = 92..110`) keeps the aircraft the same size on screen while making background volcanoes, pyramids, giant oaks, moons, and arches loom **2x larger** via lens compression.
- **Low-angle arch / cliff look-up rig** (`camOffset=10,-5,62&camLook=0,8,-80&fov=62`):
  - Positioned slightly _below_ the aircraft (`oy = -4..-6`) looking upward (`ly = +6..+10`) so rock arches and gorge bridges tower overhead.
- **Pure side-profile silhouette rig** (`camOffset=82,-10,5&camLook=0,2,-4&fov=50`):
  - Studio Ghibli / Wes Anderson side-on profile (`ox = +/-75..90`, `oy = -8..-12`) with landmarks `600..2500` units off the opposite wing (`-ox` side).
- **Front-above look-back rig** (`camOffset=10,22,-105&camLook=-4,16,55&fov=62`):
  - Positioned `95..110` units _ahead_ of the nose (`oz < 0`) and above (`oy > 0`), looking back (`lz > 0`) as waterfalls, craters, or arches recede in the upper frame.
- **Three-quarter front hero rig** (`camOffset=24,8,-50&camLook=-5,4,18` or left-front `camOffset=-22,6,-48&camLook=4,3,18`):
  - Shows spinning propeller(s) and cockpit up close while landmarks `350..900` units behind rise above the tail.
- **High overhead shadow-chase rig** (`camOffset=0,68,25&camLook=0,-10,-25&fov=60`):
  - Steep top-down view showcasing canyon rivers, turquoise reefs, dragon bones, cloverleafs, or dune shadows.
- **Wing-strut / window-seat rig** (`camOffset=4.2,1.1,-3.2&camLook=18,-0.8,-22&fov=62` on biplane):
  - Intimate cockpit-side view looking out across the wing/struts toward coastal lighthouses, mountain ridges, or sunset clouds (pair with `camFrame=plane` when banking hard, looping, or rolling so the struts stay locked in frame).
- **Standard rear-quarter chase rig** (`camOffset=-8,10,52&camLook=0,-5,-66`):
  - Keep `z >= 50` for wide-wingspan planes (`twin`, `jet`) at `fov=65` so wingtips never clip the `9:16` edges (`z = 42..46` works for `biplane` and `seaplane`).

## Declarative segment overrides, wingmen, surface skims, buggy drifts & replay

`renderMatchCutClip` in [scripts/shorts.js](../../../scripts/shorts.js) and [promo-director.js](../../../promo-director.js) support rich declarative choreography:

1. **Bit-exact match-cut continuity & per-segment overrides (`buildSegmentQuery`)**:
   - Every segment in a match-cut video dispatches the same 12-second `moves` array at `t = 0` after `PREROLL` (`1.5s`) and steps the virtual clock from frame `0` up to `seg.endFrame`, saving frames only in `[seg.startFrame, seg.endFrame)`. Deterministic direct-attitude mode activates when `moves` has `|pitchDeg| > 75`, `|yawDeg| > 0`, or `direct: true` (pass `loopDip: true` when `moves` triggers loop speed dip).
   - For a seamless `12s -> 0s` loop, start `moves` at `[0, 0, 0, 0]` and ease `roll` and `pitch` back to exact multiples of `360` by `11.2s .. 12.0s`. Use `camFrame: 'yaw-lock'` or `camMoves` to lock camera heading with zero chase lag (or hold `yaw` constant for the final `2.4s+` in default `'yaw'` mode).
   - Any segment in `segments` can override `plane`, `livery`, `style` (`'lowpoly'` or `'anime'`), `seed`, `speed`, `moves`, `cam`, `camFrame`, `camMoves`, `camOffset`, `camLook`, `fov`, `gear`, `smoke`, `forza`, `trip`, `xmas`, and `badges: [[frameIdx, 'New Subline · ...'], ...]` cleanly via `URLSearchParams`.
2. **Built-in `hitFrame` + `landmark` coordinate back-solver**:
   - Specify `hitFrame: 138` (for example `1.6s` into segment `[90..180)`) alongside `(tx, ty, tz)` or `landmark: {kind: 'arch', archType: 'gorge', index: 0}` / `{kind: 'portal', side: 'east'}` / `'volcano'` / `'falls'` / `'lighthouse'` / `'swamp-oak'` / `'pyramids'` / `'dragon'` / `'xmas'`. `planSegment` automatically back-solves the exact spawn `(x, y, z)` across `PREROLL` + `moves` (including 5th-channel speed ramps and `loopDip`) so the plane threads the target at `hitFrame`.
   - Single-take alien portal crossings (`portalCross: true`, enabled automatically by `landmark: {kind: 'portal'}`) automatically pause virtual time via `waitForPromoChunks` on the exact frame the plane warps across `125,000` units so destination chunks and far terrain are 100% loaded with zero pop-in.
3. **Scripted wingmen & overhead flybys (`wingmen`)**:
   - **Portrait `9:16` taste rule**: Never weld 2 or 3 planes in rigid lockstep (`frame: 'plane'` with static `offset`); identical simultaneous banking looks robotic and cramped in narrow `9:16` framing. Prefer either a solo hero aircraft or a **loose staggered 2-ship** (`1` wingman using `frame: 'yaw'` + `offsetMoves` `[t, ox, oy, oz, dRoll, dPitch, dYaw]` staggered `24..36` units behind, banking `0.35..0.55s` _after_ the lead plane with independent drift/cross-under so both pilots feel alive).
   - Pass `wingmen: [...]` at the clip or segment level (pre-armed before `PREROLL` so every wingman already has a `1.5s` `trailSmoke` ribbon at frame `0`):
     - **Formation wingman**: `{plane: 'jet', livery: 'teal', smoke: 'livery' | 'white' | 'rainbow' | false, frame: 'plane' | 'yaw', offset: [-18, -2, 16], offsetMoves: [[t, ox, oy, oz, dRoll, dPitch, dYaw], ...]}`.
     - **Independent spline flyby**: `{plane: 'jet', livery: 'coral', smoke: 'white', tx, ty, tz, hitFrame: 45, heading: 90, speed: 1.7, moves: [[0, 0, 0, 0], [2, -35, 18, 0]]}` (back-solved automatically so the jet streaks overhead at `hitFrame`).
4. **5th-channel throttle, water skims, buggy drifts & `Shift+R` pose replay**:
   - **Throttle channel**: Optional 5th element in `moves` (`[t, rollDeg, pitchDeg, yawDeg, speedMult]`) smoothly ramps airspeed (and is integrated accurately by `solveStartCoords`).
   - **Water-wake skims & runway touch-and-gos**: Set `surface: true` (plus `gear: true` for wheeled aircraft on runways/highways) so `planeGroup` rides low enough to carve dual pontoon water wakes, spray, and tire smoke without triggering crash respawns or ground-level attitude clamping.
   - **Scripted buggy driving (`driveMoves`)**: With `plane: 'buggy'`, pass `driveMoves: [[t, steer, throttle, slide, hop], ...]` (`steer` in `[-1, 1]`, `throttle` in `[-1, 1]`, `slide` `0|1`, `hop` `0|1`) for deterministic highway drifts and jumps.
   - **Browser pose recorder (`?debug=1` or `?record=1`)**: Hand-fly any skim, landing, or buggy drift at `http://localhost:5173/?debug=1`, press `Shift+R` (or click **Record take**) to start/stop 30 Hz recording (automatically copied to clipboard and stored on `state.lastRecordedReplay`), and pass `replay: <json>` on a segment to replay the exact trajectory, attitude, water/ground wakes, buggy drift slip, and gear extension deterministically at `1080x1920`.

## Step-by-step workflow for a new daily short

### Step 1: Scout the target seed (`YYYYMMDD`) & run `--check` in Node (`<50ms`)

Scout procedural landmarks on the target seed with a synchronous Node snippet (`process.exit(0)`), always reporting locations in both coordinate units (`X = ..., Z = ...`) and lat/long (`... North/South, ... East/West`):

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
    const lat = (Math.abs(a.z) / 5000).toFixed(2) + " " + (a.z <= 0 ? "North" : "South");
    const lon = (Math.abs(a.x) / 5000).toFixed(2) + " " + (a.x >= 0 ? "East" : "West");
    console.log("Arch:", a.kind, "X =", Math.round(a.x), "Z =", Math.round(a.z), "(" + lon + ", " + lat + ")");
  }
  process.exit(0);
});
'
```

Landmarks available to mix and match:

- **Procedural per-seed**:
  - **Sea Arches (`kind === 'sea'`)**: Tropical turquoise/red-rock arches in the south-east (`Z > 0`), or **Arctic snow-dusted sea arches** surrounded by icebergs when `Z < -15000` (`> 3.0 North`).
  - **Mountain Gorge Bridges (`kind === 'gorge'`)**: Massive stone spans (`maxUnder` up to `500+`, often crossing directly over mountain highways).
  - **Canyon Natural Bridges (`kind === 'canyon'`)**: Banded sandstone spans across narrow Grand Canyon narrows (present on seeds with deep canyons).
  - **Alien Basalt Gates (`kind === 'basalt'`)**: Fallen hexagonal columns spanning bioluminescent mushroom ravines in the eastern alien honeycomb (`X > 55000`, `> 11.0 East`).
  - **Giant Swamp Oak (`giantSwampOak()`)**: Unmarked ~272-unit-tall twisted mossy oak in the western misty bayou (`X = -15000 .. -5000`, `1.0 West .. 3.0 West`).
  - **Paired Alien Wormhole Portals (`portalSites()`)**: Glowing violet portal arches in eastern Xen and western Westworld (`|X| > 50000`, `> 10.0 East/West`).
  - **Great Pyramids (`pyramidSite()`)**: Three stepped desert pyramids (`Z ~ 20000, X ~ -10000`, `~4.0 South, 2.0 West`; `getElevation` includes their solid `~650`-unit apex, so fly `800..1500` units away for panoramic framing).
  - **Colossal Dragon Skeleton (`dragonSite()`)**: 290-unit ivory skeleton in perpetual snowfall (`Z ~ -18000, X ~ -13500`, `~3.6 North, 2.7 West`).
  - **Christmas Village (`xmasVillageSite()`, enable with `&xmas=full`)**: Festive lit village beside Pinewood Field (`Z ~ -17000, X ~ -4000`, `~3.4 North, 0.8 West`).
- **Fixed on every seed**:
  - **Twin Falls**: `X = 0, Z = -4500` (`0.9 North, 0.0 East`), cliff lip `Y = 420`, plunge pool south of `Z = -4400` at `Y = 40`.
  - **Volcano Caldera**: `X = -5000, Z = 5000` (`1.0 South, 1.0 West`), rim `Y ~ 1700`, smoking crater floor `Y ~ 1002` (fly around `Y = 2000..2100` to see down into the cauldron).
  - **Headland Lighthouse**: `X = 7525, Z = 3000` (`0.6 South, 1.5 East`), rotating golden spotlight beam visible at dusk/night (`tod >= 0.74`).
  - **Grand Canyon**: `X = 2000..3600, Z = 11500..22000` (`2.3 South .. 4.4 South, 0.4 East .. 0.7 East`; check `getElevation` on each seed to confirm river depth vs. continent outline).

Add your Short to [scripts/shorts.js](../../../scripts/shorts.js) and run the built-in Node corridor verifier (`--check`) before launching Chrome (`renderMatchCutClip` also runs this automatically before rendering):

```bash
node scripts/shorts.js --check <short-id>
```

`--check` traces every frame from `-preroll` (`f = -45`) through `seg.endFrame` (including wingmen and portal crossings) against terrain, water, and solid arch ceilings/legs in milliseconds.

### Step 2: Fast `--preview` check & full `1080x1920` render

Ensure the local Vite dev server is listening on `http://localhost:5173/` (do not start a second server on macOS if port `5173` is already up, never run `promo` / `shorts` full renders in a Linux cloud container without hardware GPU, and never run more than one headless Chrome instance at a time).

- **Never write custom virtual-clock scratch scripts**. Run `--preview` first (~55s on macOS for a 12-tile contact sheet):

```bash
node scripts/shorts.js <short-id> --preview
```

Inspect `promo/preview-<outBaseName>.jpg` with `read_file`, refine framing/timing until all landmarks, wingmen, and wingtips sit cleanly inside the `9:16` frame, delete `promo/preview-*.jpg`, and render the full `1080x1920` video:

```bash
node scripts/shorts.js <short-id>
```

Confirm music track slugs against `RAW_TRACKS` in [music-logic.js](../../../music-logic.js) before rendering so R2 downloads (`purrple-cat-<slug>.mp3`) never fall back unintentionally to the default track. Keep the pill badge top line `CHILL FLIGHT · Play free at chillflight.app` and bottom line `<Place Name> · <lat>, <long>` (`addPostcardBadge` places `#short-postcard-badge` at `top: 140px`, ~`14.6%` down the `540x960` CSS frame so YouTube Shorts' top Search/Cast/Menu icons never cover coordinates; avoid placing tiny distant focal targets inside that `14.6%..20.6%` upper band), never call biomes "worlds", and never use em dashes anywhere.

### Step 3: Empirical visual verification (required)

Extract a 12-frame `1 fps` contact strip and an 8-frame cut-boundary strip (`frames 0, 89, 90, 179, 180, 269, 270, 359`), inspect both images and the `.txt` sidecar with `read_file`, and delete the temporary `.jpg` strips afterward:

```bash
ffmpeg -y -loglevel error -i promo/<outBaseName>.mp4 \
  -vf "fps=1,scale=270:480,tile=6x2" -frames:v 1 -update 1 -q:v 3 promo/strip-verify-12.jpg
ffmpeg -y -loglevel error -i promo/<outBaseName>.mp4 \
  -vf "select='eq(n\,0)+eq(n\,89)+eq(n\,90)+eq(n\,179)+eq(n\,180)+eq(n\,269)+eq(n\,270)+eq(n\,359)',scale=270:480,tile=4x2" \
  -fps_mode passthrough -frames:v 1 -update 1 -q:v 3 promo/strip-verify-cuts.jpg
```

### Step 4: Metadata hooks & publishing to YouTube Shorts

Use [scripts/post-short.js](../../../scripts/post-short.js) to upload, verify the exact read-back YouTube Title, attach the **Related video** link, confirm any `"Publish anyway"` dialog, publish to YouTube Shorts, and automatically post and pin the first comment:

```bash
node scripts/post-short.js promo/<outBaseName>.mp4
```

- **Short, punchy YouTube titles (`<= 48` chars, no URL suffix)**: Mobile YouTube Shorts truncates titles around ~`45-50` characters in the feed, and `chillflight.app` is already baked into `#short-postcard-badge` on-screen. `writeShortMetadata` does **not** append `(Play free: chillflight.app)` to `Title:`; keep `meta.title` crisp (`<= 48` chars) so the hook never cuts off mid-word.
- **Always attach a "Related video" link (with clickable links on lines 1-2)**: YouTube Short descriptions and comments don't render clickable URLs, whereas the **Related video** field places a clickable pill right above the Short's title. Make sure any long-form video used as a Related bridge (such as `"9 months of building Chill Flight"` from [scripts/evolution.js](../../../scripts/evolution.js) or the official trailer) puts clickable `https://chillflight.app` and iOS App Store links on **lines 1 and 2** of its description so mobile viewers see them immediately without tapping `...more`. `writeShortMetadata` writes `Related video: 9 months of building Chill Flight` by default (`--related=<title|url|id|none>` overrides per upload).
- **Auto-post and pin a visual-hook / question comment**: Always pass an engaging visual hook or question (`question` / `tiktokQuestion`, e.g., `"Spot the dragon skeleton?"` or `"Which biome should I add next?"`) or custom `pinnedComment` to `writeShortMetadata`. `writeShortMetadata` writes `Pinned comment:` combining the hook with `chillflight.app` + `"Chill Flight"` on the iOS App Store, and [scripts/post-short.js](../../../scripts/post-short.js) automatically opens the published Short, posts that first comment, and pins it (override with `--comment="<text>"` or skip with `--no-comment`).
