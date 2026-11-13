# Christmas village: a seasonal proposal for November to early January

## Summary

From **Nov 1 to Jan 6**, a small Christmas village stands in the snow beside **Pinewood Field** (`X = -4000`, `Z = -17200` / `0.8 West`, `3.44 North`). It's built from Polyfork's [Christmas Village kit](https://polyfork.dev/kit/christmas-village-fbc27a), the same kit our snowman comes from. You can fly over it, land at Pinewood and drive the buggy around it, and after dark its lights come on with the streetlights. November is the setting-up month: a Christmas tree lot, garlanded lamp posts, the cocoa stand open. In December it fills in: string lights on the roofs, presents, and Santa's sleigh parked in the square, with a few more houses lighting up each day of Advent. Everything stays up through Twelfth Night.

The northern villages get Christmas too: decorated firs in front gardens and string lights along the eaves of some houses, so the whole snowy north feels like the holidays, with the village at Pinewood as the centrepiece.

The world has no people, and that stays true. Santa is the one exception.

## Decisions

| Question      | Decision                                                               |
| ------------- | ---------------------------------------------------------------------- |
| Dates         | Nov 1 to Jan 6                                                         |
| Location      | Fixed, beside Pinewood Field                                           |
| Hero building | A giant gingerbread house                                              |
| Characters    | None, except Santa                                                     |
| Jobs          | Not in scope                                                           |
| Elsewhere     | Christmas touches in the northern villages as well as the main village |

## Goals and non-goals

**Goals**

- Something worth a detour that you can visit in a short session and that rewards landing, not just flying past.
- Christmas in the whole snowy north, not just at one site.
- Turns on and off by itself from the date, with no manual release step on Nov 1 or Jan 7.
- Deterministic and testable like the rest of the world (pinned seeds, no wall-clock reads in the worker).
- Within the instanced prop budget: no new per-frame systems, and nothing drawn past about 3 km except the village's far markers.

**Non-goals**

- People. The kit's Mrs Claus, elves, carolers, kid and parent aren't used. Santa is the only figure (section 4).
- Seasonal jobs, people or achievements.
- The kit's 25,000 triangle terrain block. Our procedural ground plus a flattened "village bed" does the job.
- Christmas decorations south of the snow line, Christmas music or a menu theme.
- Southern-hemisphere or other holidays (the date helper leaves room for them later).

## 1. When it's on

### 1.1 Season from the world seed, not the clock

The world seed is already today's date (`getTodaySeed()` in `chill-flight-logic.js`, `YYYYMMDD`), and the main thread, the terrain worker and Node tests all share it. Season is worked out from it:

```js
// chill-flight-logic.js
exports.seasonOf = (seed) => {
  const month = Math.floor(seed / 100) % 100; // 0 for non-date seeds
  const day = seed % 100;
  if (month === 11) return {xmas: 'setup', day};
  if (month === 12) return {xmas: 'full', day};
  // Twelfth Night: everything stays up and lit through Jan 6
  if (month === 1 && day <= 6) return {xmas: 'full', day: 31};
  return {xmas: null, day};
};
```

- **Deterministic:** a test pins `?seed=20261215` and gets the full village, and `?seed=1` or any summer date gets none. One catch: `20260101` is the usual pinned seed (in `smoke-test.js`, `test-landmarks.js`, `test-breakables.js`, `test-bots.js`, `test-fall.js`, `test-arches.js`, `flight-sim.js`, `promo-shots.js`, `shorts.js` and more), and it falls inside the window. Rather than re-pin all of them (which would move every landmark and baseline they check), the season gets its own switch: `ChillFlightLogic.XMAS` defaults to `seasonOf(WORLD_SEED)` in the browser and to off in Node, and `?xmas=` overrides it. Node tests that cover the season turn it on themselves. Promo and Shorts renders on `20260101` would show Christmas, so they pass `xmas=off` unless we want it.
- **Worker-safe:** `terrain-gen.js` reads it from the seed it already has, so chunk clearing and props stay consistent with the main thread.
- **Midnight rollover** follows the world, which already reshuffles every day at local midnight.
- **Jan 1 to 6** counts as day 31 of December, so the Advent ramp (2.3) stays fully lit.
- **Override:** `?xmas=off|setup|full` (and `&xmasDay=N` for the Advent ramp) for testing, promos and anyone who wants it in July. Add it to the README's URL parameter table.

## 2. The village

### 2.1 Where

A fixed site next to Pinewood Field. Players learn where it is, the runway gives a natural place to land and drive in, and Pinewood is well inside full snow cover (snow is complete by `Z = -12500` / `2.5 North`).

Follows the dragon skeleton's pattern:

- `xmasVillageSite(simplex, ...)` in `chill-flight-logic.js`: picks the flattest clear patch, about 300 to 400 units across, within about 1.2 km of the Pinewood apron, off the runway and highway, and memoized per seed (like `dragonSite`).
- `xmasBedAt(x, z)`: eases the ground there flat (like `dragonBedAt`) so the props and houses sit level. Only active when `seasonOf(seed).xmas`.
- `terrain-gen.js`: clears trees, rocks, random houses and snowmen inside the bed when the season is on.
- A map marker (a small ✦ or 🎄 glyph in the minimap and world map) and its label "Christmas village", through `t()` with an entry in all 10 locale tables.

### 2.2 Layout (about 30 placements, one village)

A main lane runs from the apron side into a little square:

| Area              | Contents (kit part, scale)                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrance          | North Pole sign post ("village"), candy cane path markers along the lane                                                                                                                                                                                  |
| Lane              | 6 to 8 of our existing northern houses (grey-green farmhouse look, log cabins) facing the lane, each with a roofline string light run along the eaves; garland lamp posts between them                                                                    |
| Square            | One big front-yard fir (3.5 m look, `lights: multicolour`, drawn about 3x so it reads from the air), giant lawn ornament balls, wrapped present piles, light-up wireframe reindeer (standing and grazing)                                                 |
| Square edge       | Hot cocoa stand, North Pole treat table, letters-to-Santa mailbox                                                                                                                                                                                         |
| Side yard         | Kids' snow fort, snowmen (our model), a snow shovel stuck in a drift                                                                                                                                                                                      |
| Tree lot          | A-frame cut tree rack and cut firs in buckets                                                                                                                                                                                                             |
| Behind the square | Santa's sleigh (`load: heaped`) with a sack of toys, and Santa beside it (December and early January; section 4)                                                                                                                                          |
| Landmark          | A **giant gingerbread house** (the kit's 0.5 m tabletop model drawn about 25x, about 40 units tall), in the spirit of the oversized mushroom cottages. It works as the hero building and as a map-scale beacon, with its sugar-glass windows lit at night |

All props go through `mergeAsset()` (`boat-models.js`) into one vertex-coloured geometry each and are instanced like the other landmarks (`buildLandmarkGeos`-style registration in `terrain-chunks.js`), with box or cylinder shadows. They're breakable like the other small props (`BREAKABLE.SMALL`, the houses as houses), and that's half the fun with the buggy.

**Scale:** kit parts are life size (0.5 to 4 m). At `POLYFORK_SCALE` (3.5) they read well from the buggy and on a low pass. Only the big fir, the gingerbread house and the sign get extra scale so the village is recognisable from cruising height.

### 2.3 November vs December

|                                                                                    | November (`setup`)              | Dec 1 to Jan 6 (`full`)         |
| ---------------------------------------------------------------------------------- | ------------------------------- | ------------------------------- |
| Tree lot, cocoa stand, lamp posts with garland, sign, snow fort, gingerbread house | yes                             | yes                             |
| Big fir in the square                                                              | yes, `decorations: none`, unlit | `full`, multicolour lights      |
| Roofline lights on the lane houses                                                 | 2 or 3 houses                   | ramps up through Advent (below) |
| Presents, reindeer, ornament balls, mailbox                                        | no                              | yes                             |
| Santa's sleigh with toys, and Santa                                                | no                              | yes                             |
| Northern villages (section 3)                                                      | first lights                    | full                            |

**Advent ramp:** on December day `d`, `min(houses, 2 + ceil(d * houses / 24))` of the lane houses have lit roofline lights, chosen in a fixed order, so the village is fully lit by Christmas Eve and stays that way through Jan 6. It's deterministic from the seed's day and costs nothing at runtime. It gives a reason to come back without any save state.

### 2.4 Night lights

Several kit parts export a `night` table (lamp panes, C9 bulbs, gingerbread sugar-glass windows, cocoa stand lanterns, reindeer bulbs, tree bulbs). For each part, split those colour zones into a separate "glow" geometry (as `splitPolyforkAsset` already does for the lighthouse and keeper's cottage windows) drawn with one shared emissive material:

- One `xmasGlowMat` with `vertexColors: true`, its `emissiveIntensity` driven by the same value as `streetlightBulbMat` in `game-loop.js`. So it fades with the streetlights at dusk and needs no extra per-frame work.
- Multicolour bulbs keep their own vertex colours (red, green, blue, gold) with one draw call for all of them.
- No real lights: the existing headlight-pool trick isn't needed. A soft additive glow sprite on the big fir only, if it looks flat at night.

## 3. Christmas in the northern villages

The snowy villages up north (`snowFactor > 0.6`, roughly north of `Z = -12500` / `2.5 North`, wandering with `snowWobble`) get dressed for the season. That covers the grid villages, the hamlets and the road villages along the north highways. Everything is placed in `terrain-gen.js` alongside the houses, by a hash of the house (not `rng()`, so the props after them stay where they were), and shares the village's kit geometries and `xmasGlowMat`.

| Touch                                                                              | Where                                                                                                   | November     | Dec 1 to Jan 6    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ | ----------------- |
| Roofline string lights along the front eaves, warm white or multicolour by village | on a house's own eave line, so no clearing                                                              | 1 house in 8 | 1 house in 3      |
| Front-yard fir (2.5 m, `decorations: baubles`, warm-white lights)                  | in the front garden, placed like the garden sheds (`GARDEN_SHED_*`): after the houses, cleared of trees | none         | 1 house in 4      |
| Garland lamp post at the end of a village row                                      | where there's room, beside the lane                                                                     | none         | 1 per village row |
| Wireframe reindeer or a giant ornament ball on a lawn                              | front garden                                                                                            | none         | 1 house in 12     |

- **Roofline lights** need the eave line of each house type: a length and offset per house shape, taken from `houseBodyGeo` and the gabled roof's overhang (`createHouseRoof`) and the Polyfork farmhouse, cottage and cabin roofs. The kit's run is a 4 m section, so a house gets 2 or 3 sections end to end (instanced, so the cost is per section).
- **Lit at night only**, on the shared glow material, like the village. By day the bulbs and fir decorations still read as Christmas.
- **Taverns and farmhouses** count as houses. Barns, sheds and ice fishing huts don't get decorations.
- The existing chimney smoke and lit windows already do a lot of the cosy work. These touches add to them rather than adding new effects.

## 4. Santa

The one figure in the world. The kit's Santa is a roughly 3,800 triangle skinned rig.

- **v1 (December and early January): Santa by his sleigh in the village square.** Frozen in one pose (posed through the rig's bones once at load, then merged into static vertex-coloured geometry like the rest), facing the lane, maybe with a hand raised as if waving. Drawn only within about 600 units (buggy and low-pass range). Knocking Santa flat would be bad form, so he isn't breakable: give him a collider that bumps you instead of toppling.
- **Stretch: Christmas Eve flyover.** On Dec 24 between dusk and dawn, Santa's sleigh crosses the sky once in a while, high over the north, with Santa in it, pulled by the kit's **light-up wireframe reindeer** in a line. Their bulbs glow, and it looks like a constellation rather than a pretend real reindeer team. Uses the ghost ship's timing pattern (`GHOST_SHIP_*` in `flight-camera.js`) and the traffic spawn bubble. Sleigh bells via `sfx.js` when close. While he's flying, the sleigh in the square is empty.

## Performance budget

| Item                                 | Triangles (each)      | Count                      | Notes                                                                                                               |
| ------------------------------------ | --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Village kit props                    | 550 to 2,900          | about 30                   | about 30k total; drawn within 2,000 units, no far LOD                                                               |
| Gingerbread house                    | about 900             | 1                          | far proxy (box plus roof) so it shows out to tower range                                                            |
| Big fir                              | about 900             | 1                          | far proxy cone                                                                                                      |
| Santa                                | about 3,800           | 1                          | within 600 units only                                                                                               |
| Roofline light runs (north villages) | about 730 per 4 m run | 2 or 3 per lit house       | worth simplifying: a version with fewer bulbs and no clips, or drop the wire and keep the bulbs, if counts get high |
| Front-yard firs (north villages)     | about 900             | about 1 per 4 snowy houses | same rules as garden sheds, no far LOD                                                                              |
| Glow parts                           | a few hundred         | per lit part               | one shared material, one draw call per type                                                                         |

The northern village touches are the part that scales with the world, so they're the ones to watch. Draw them within about 1,500 units, and if a road village has many houses in view, the light runs will dominate. Run the `perf-audit` skill against a pinned `?seed=20261215` view of the village and of a dense northern road village, by day and by night, before shipping.

## Testing

- `scripts/test-season.js` (into `npm test`): `seasonOf` for Oct 31, Nov 1, Nov 30, Dec 1, Dec 24, Jan 1, Jan 6, Jan 7, a non-date seed, and the Advent ramp counts.
- A terrain-gen test: with `seed=20261215` the village bed is flat, cleared, and the expected types appear, and a northern village chunk has its firs and light runs; with `seed=20260701` none of them appear and the chunk output is byte-identical to before (guards against leaks into other dates).
- Tests pinned to `20260101` keep passing unchanged, since the season is off in Node by default (section 1.1); `smoke-test.js` loads the game with `xmas=off` on that seed.
- `npm run test:browser`: add one load at `?seed=20261215&x=...&z=...` near the village for JS errors.
- Every new model on `debug/debug-models.html` (a "Christmas village" group), per the geometry rule.
- `node scripts/shot.js` views of the village and a northern village by day and by night for review (named views in `scripts/views.js`, e.g. `xmas` and `xmasNorth`).

## Phasing

| Phase | Scope                                                                                                    | Ships by                                                 |
| ----- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 0     | `seasonOf`, `ChillFlightLogic.XMAS` and the `?xmas=` override, tests, README                             | first, small                                             |
| 1     | Village at Pinewood: site and bed, props, gingerbread house, big fir, night glow, map marker, debug page | late November, so it's there while "setup" still applies |
| 2     | Northern villages: roofline lights, front-yard firs, lamp posts and lawn decorations                     | with phase 1 or just after                               |
| 3     | December additions: Advent ramp, presents, sleigh, reindeer, Santa by the sleigh                         | Dec 1                                                    |
| 4     | Christmas Eve sleigh flyover                                                                             | stretch, Dec 24                                          |

Today is Nov 13, so phases 0 to 3 in a release around Nov 25 to 30 would catch most of the season (the December content switches on by itself from the date).
