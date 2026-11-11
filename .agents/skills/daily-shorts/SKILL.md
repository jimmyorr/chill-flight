---
name: daily-shorts
description: >-
  Scouts, choreographs, renders, and verifies vertical 9:16 (1080x1920, 30 fps)
  YouTube Shorts and TikTok videos for Chill Flight, including bit-exact
  4-landscape match-cut clips, auto-scouted arch flights, and window-seat views.
  Use this skill whenever the user asks to create, generate, scout, or render a
  YouTube Short, TikTok clip, vertical promo video, or daily match-cut for a
  given world seed.
---

# Creating daily shorts and match-cut clips

Use [scripts/shorts.js](../../../scripts/shorts.js) to render vertical `1080x1920` (30 fps) short-form videos and their companion `.txt` metadata sidecars (with ready-to-paste YouTube Shorts and TikTok titles, descriptions, timestamps, and music credits) into `promo/`.

## Core principles for match-cut shorts

1. **Keep the same plane across all 4 cuts in a video**:
   - A match-cut video uses one aircraft and livery (with `smoke=1` enabled) across all four 3-second segments (`0..90`, `90..180`, `180..270`, `270..360` frames), while the landscape, landmark, weather, and time of day change on each cut.
   - Alternate aircraft across different videos:
     - `plane=biplane` (e.g., `livery=coral` or `livery=teal`)
     - `plane=twin` (e.g., `livery=gold` or `livery=teal`)
     - `plane=seaplane` (e.g., `livery=coral` or `livery=rose`)
     - `plane=jet` (e.g., `livery=coral` or `livery=slate`, higher `speedMult` around `1.5` to `1.7`)
2. **Bit-exact continuity across cuts (`startCoordsForFrame`)**:
   - Every segment in a match-cut video dispatches the **exact same 12-second `moves` array** at `t = 0` after `PREROLL` (`1.5s`) and steps the virtual clock from frame `0` up to `seg.endFrame`, saving frames only in `[seg.startFrame, seg.endFrame)`.
   - Because `planeGroup.rotation`, `state._cinematicStableHeading`, propeller phase, and the 3D smoke ribbon history evolve identically from `t = 0`, frame `89 -> 90`, `179 -> 180`, and `269 -> 270` match bit-for-bit on screen.
   - Use `startCoordsForFrame(tx, ty, tz, heading, speedMult, moves, seg.startFrame)` so the aircraft arrives at the target landmark/vista `(tx, ty, tz)` right on `seg.startFrame`.
3. **Seamless 12s -> 0s loop**:
   - Start `moves` at `[0, 0, 0, 0]` (`roll = 0, pitch = 0, yaw = 0`).
   - Hold `yaw` constant for the final `2.0s+` (`t = 9.6s .. 12.0s`) and ease `roll` and `pitch` back to multiples of `360` (`0`, `360`, or `-360`) by `t = 11.3s .. 12.0s`.
   - Holding `yaw` constant for the last 2+ seconds lets `state._cinematicStableHeading` (which eases at `0.05 * delta * 60` per frame in `flight-camera.js`) and the trailing smoke ribbon converge to straight-and-level, so frame `359` loops into frame `0` without a jump.
4. **On-screen pill badge**:
   - Always use `CHILL FLIGHT · Play free at chillflight.app` as the top line of `addPostcardBadge` and `<Place Name> · <lat>, <long>` as the second line.
   - Avoid calling biomes "worlds" (use "landscapes", "landmarks", or "places" instead, since the entire game takes place in one continuous world).

## Camera angles and landmark sightlines

- **Three-quarter front-right camera** (`camOffset=24,8,-48&camLook=-5,4,18`):
  - Positioned ahead of the nose (`z = -48`) and off the right wing (`x = +24`), looking back toward the tail along `(-29, -4, +66)`.
  - Landmarks placed `300` to `900` units behind the plane along that sightline (slightly left of the tail) appear in the upper frame behind the aircraft.
- **Three-quarter front-left camera** (`camOffset=-22,6,-46&camLook=4,3,18`):
  - Positioned ahead of the nose (`z = -46`) and off the left wing (`x = -22`), looking back toward the tail along `(+26, -3, +64)`.
  - Landmarks placed `300` to `900` units behind the plane (slightly right of the tail) appear in the upper frame behind the aircraft.
- **Chase / rear-quarter camera** (`camOffset=-14,6,44&camLook=4,-1,-70`):
  - Positioned behind the tail (`z = +44`), looking forward along the flight path (`z = -70`).
  - Place `(tx, ty, tz)` `350` to `800` units _before_ the landmark along `heading` so the aircraft flies toward and past the landmark during the 3-second segment.

## Step-by-step workflow for a new daily short

### Step 1: Scout the target seed (`YYYYMMDD`)

Before picking coordinates for a seed, run a quick Node one-liner to find the seed's procedural landmarks (`pyramidSite`, `dragonSite`, `archSites`) and verify terrain elevations along each segment's flight path (including the `0 .. seg.startFrame` approach path so the aircraft never clips a cliff or canyon wall before its cut begins):

```bash
node -e '
import("./chill-flight-logic.js").then(async ({ChillFlightLogic}) => {
  const {simplex} = await import("./noise.js");
  const {archSites} = await import("./arches-logic.js");
  const seed = 20261109;
  ChillFlightLogic.WORLD_SEED = seed;
  simplex.seed(seed);
  const opts = {WATER_LEVEL: 40};
  console.log("Pyramids:", ChillFlightLogic.pyramidSite(simplex, opts));
  console.log("Dragon:", ChillFlightLogic.dragonSite(simplex, opts));
  for (const a of archSites(simplex, opts)) {
    const lat = (Math.abs(a.z) / 5000).toFixed(2) + (a.z <= 0 ? "N" : "S");
    const lon = (Math.abs(a.x) / 5000).toFixed(2) + (a.x >= 0 ? "E" : "W");
    console.log("Arch:", a.kind, "x=" + Math.round(a.x), "z=" + Math.round(a.z), lat + ", " + lon);
  }
});
'
```

Fixed landmarks available on every seed:

- **Twin Falls**: `X = 0, Z = -4500` (`0.9°N, 0.0°E`), cliff top `Y = 420`, plunge pool south of `Z = -4400` at `Y = 40`.
- **Volcano**: `X = -5000, Z = 5000` (`1.0°S, 1.0°W`), crater rim around `Y = 1007`.
- **Headland Lighthouse**: `X = 7500, Z = 3000` (`0.6°S, 1.5°E`), base around `Y = 65`.
- **Red-Rock Canyon**: `X = 3260, Z = 15550` (`2.9°S, 0.6°E`, straight north-south floor channel at `Y = 50..80`, bridge at `X = 3061, Z = 14413`).

### Step 2: Render the short

Ensure the local Vite dev server is listening on `http://localhost:5173/`, then run `scripts/shorts.js`:

```bash
node scripts/shorts.js daily-match-cut
```

To regenerate only the `.txt` description sidecars without re-rendering video:

```bash
node scripts/shorts.js meta
```

### Step 3: Empirical visual verification (required)

Always extract a 12-frame 1 fps contact strip and an 8-frame cut-boundary strip (`frames 0, 89, 90, 179, 180, 269, 270, 359`), inspect both images with `read_file`, and delete the temporary `.jpg` strips afterward:

```bash
ffmpeg -y -loglevel error -i promo/short-20261109-match-cut.mp4 \
  -vf "fps=1,scale=270:480,tile=12x1" promo/strip-verify-12.jpg
ffmpeg -y -loglevel error -i promo/short-20261109-match-cut.mp4 \
  -vf "select='eq(n,0)+eq(n,89)+eq(n,90)+eq(n,179)+eq(n,180)+eq(n,269)+eq(n,270)+eq(n,359)',scale=270:480,tile=8x1" \
  -frames:v 1 promo/strip-verify-cuts.jpg
```

Verify in the strips:

1. Every cut (`89 -> 90`, `179 -> 180`, `269 -> 270`) and the loop (`359 -> 0`) has the aircraft and smoke trail in the exact same screen position and attitude.
2. Each landmark or biome is clearly visible in frame (not obscured by terrain or behind the camera), and the aircraft never crashes during `0 .. endFrame`.
3. Remove `promo/strip-verify-*.jpg` once verified.

### Step 4: Upload to YouTube Shorts and TikTok

Use [scripts/post-short.js](../../../scripts/post-short.js) to upload a rendered `.mp4` and its companion `.txt` metadata sidecar to YouTube Studio and TikTok Studio using a persistent Chrome profile (`~/.chill-flight-social-profile`):

```bash
# One-time login to save YouTube Studio and TikTok Studio cookies:
node scripts/post-short.js --login

# Preview parsed metadata without opening Chrome:
node scripts/post-short.js promo/short-20261109-match-cut.mp4 --dry-run

# Upload and fill Title/Description/Caption, pausing on final Publish/Post button:
node scripts/post-short.js promo/short-20261109-match-cut.mp4

# Hands-free publish to both platforms (or --platform=youtube / --platform=tiktok):
node scripts/post-short.js promo/short-20261109-match-cut.mp4 --publish
```
