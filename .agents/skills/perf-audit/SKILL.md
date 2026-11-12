---
name: perf-audit
description: >-
  Benchmarks and audits Chill Flight GPU/CPU frame times, startup and map-open
  hitches, draw calls, main vs. shadow triangle counts, instanced prop LOD
  budgets, chunk rebuild costs, and WebGL/JS memory usage across pinned camera
  views. Use this skill whenever the user asks to profile, benchmark, optimize,
  or audit rendering performance, frame rate, draw calls, shader/startup jank,
  geometry budgets, or memory usage.
---

# Auditing render performance and memory

Use the built-in headless Chrome audit and benchmark suite in `scripts/` rather than writing ad-hoc timing scripts. Every script uses the pinned world seed (`AUDIT_SEED = 20260928`) and deterministic camera views from [scripts/views.js](../../../scripts/views.js) (`freecam=true&timeSpeed=0&weather=none&traffic=0&adaptive=0`) so numbers and screenshots compare cleanly across commits.

## Guardrails before running any script

1. **One headless Chrome at a time**: Never run multiple benchmark, audit, or screenshot commands in parallel across background tasks or subagents. Concurrent WebGL contexts and terrain workers push macOS into swap and skew timings.
2. **Use the running dev server**: On macOS, `http://localhost:5173` is already running; do not start a second server unless pointing `GAME_URL` at an isolated comparison worktree.
3. **macOS hardware GPU vs. Linux SwiftShader**: `npm run bench` requires a hardware GPU (`process.platform === 'darwin'`). Structure/count audits (`audit:render`, `audit:memory`, `audit:models`) work anywhere, while CPU timing scripts (`bench:startup`, `audit:rebuild`) must only be compared against runs on the same machine.

## Choosing the right script

| Goal                         | Command                            | Key env vars / args                                         | What it measures                                                                                                                                                                                              |
| :--------------------------- | :--------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GPU & CPU frame time**     | `npm run bench -- <label>`         | `VIEWS=land,sunset,mtn,forest` `PRESET=mid` `QUERY=...`     | Median `gpu` (WebGL timer query), `ms` (wall time with 1px readback), and `cpu` (`renderer.render()`) over 170 frames at `1440x900` (`DPR 1.5`) with shadow updates forced every frame.                       |
| **Cold start & map hitches** | `npm run bench:startup -- <label>` | `RUNS=3` `PRESET=mid` `DPR=2` `QUERY=...`                   | Phone viewport (`390x844`): time to `START`, intro swoop (6s), steady flight (6s), and first vs. second map open (worst frame, frames `>50ms`/`>100ms`, total jank, main-thread long tasks, shader compiles). |
| **Draw calls & triangles**   | `npm run audit:render`             | `VIEWS=land,swamp` `PRESET=mid` `W=844` `H=390` `QUERY=...` | Per-category triangle counts and draw calls split between the main pass and shadow pass (`inst-near`, `inst-far`, `inst-shadowOnly`, terrain chunks, objects).                                                |
| **Memory footprint**         | `npm run audit:memory`             | `VIEWS=land,swamp` `PRESET=mid` `W=844` `H=390` `QUERY=...` | MB breakdown across `globalInstancer` shadow/tile matrices, geometry attribute buffers, and JS heap.                                                                                                          |
| **Chunk rebuild cost**       | `npm run audit:rebuild`            | `VIEWS=land` `PRESET=mid` `W=844` `H=390` `QUERY=...`       | Median cost (12 runs) of `globalInstancer.rebuildAll()`, the first render immediately following a rebuild (buffer uploads), and a steady render, plus uploaded mesh/instance counts.                          |
| **Model triangle budgets**   | `npm run audit:models`             | `TYPES=pine,barn`                                           | Loads `debug/debug-models.html` and prints a sorted table of `near`, `base`, `far`, and `shadow` triangle counts for every instanced prop type.                                                               |

## Named views in `scripts/views.js`

Pass any comma-separated subset in `VIEWS=...` (or pass the same view names to `node scripts/shot.js out.jpg <view>` to visually verify that an optimization preserves appearance):

- `land`, `landHigh`: Central island (`X = 0, Z = 0` / `0.0°N, 0.0°E`) at low (`Y = 413`) and high (`Y = 2500`) altitude.
- `forest`, `forestHigh`, `down`: Dense forest (`X = -3000, Z = -6000` / `1.2°N, 0.6°W`) at low altitude, high altitude, and straight-down nadir (`pitch=-89`).
- `mtn`: Alpine peaks (`X = -2000, Z = -2500` / `0.5°N, 0.4°W`).
- `sunset`: Low-sun ocean/island horizon (`X = 30000, Z = 3000` / `0.6°S, 6.0°E`, `tod=0.735`).
- `swamp`, `swampLow`: Wetland foliage and water (`X = -9000, Z = 8000` / `1.6°S, 1.8°W`).

## Optimization workflow

1. **Baseline**: Capture structural counts (`audit:render` / `audit:memory` / `audit:models`) and timing (`bench` or `bench:startup`) on the views affected by your change, plus a baseline `node scripts/shot.js` image if visual output could shift.
2. **Interleave A/B timing runs**: GPU thermal state drifts by ~0.5 ms over several minutes. When validating small render-time wins with `npm run bench`, alternate baseline and candidate runs (`A -> B -> A -> B`) on a quiet machine rather than trusting a single before/after pair.
3. **Verify visual parity & tests**: Compare a post-change `node scripts/shot.js` capture on the same named view, then run `npm run format && npm test` and `npm run test:browser` before staging.
