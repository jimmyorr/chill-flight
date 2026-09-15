# Shoreline and water improvements plan

## Overview

This specification addresses visual shortcomings along the shorelines, beaches, and water bodies across the procedural world. While recent coastline fixes successfully eliminated z-fighting and plane submersion, the current presentation has an opaque, flat water surface, harsh polygonal shoreline intersections, invisible seabed gradients, missing coastal surf lines, and no wet sand transitions.

The goal is to achieve a lush, vibrant, low-poly coastal aesthetic with translucent turquoise shallows, visible sandy ocean floors, animated shoreline foam, smooth beach transitions, and damp sand tide lines—all while maintaining optimal frame rates and zero z-fighting.

---

## 1. Identified issues and technical root causes

### 1.1 Flat, opaque water slab without depth gradient

- **Root cause:** `waterMaterial` has a fixed opacity (`0.85`) and a single uniform vertex color (`_colorWater = 0x40c4ff`). Furthermore, `terrain.js` (line 4324) forcibly drops underwater vertices by an additional 5 units (`positions[i + 1] = height - 5`), plunging the seabed down to `Y = 25`–`30`. At `0.85` opacity, this creates an impenetrable dark void beneath the surface, completely hiding the seabed.
- **Goal:** Translucent, sunlit turquoise water near shorelines that smoothly deepens to rich ocean blue offshore, with the sandy ocean floor clearly visible in the shallows.

### 1.2 Harsh, jagged "knife-edge" shoreline intersections

- **Root cause:** Low-poly terrain vertices spaced ~37.5 units apart intersect the flat water plane (`Y = 40`) at sharp diagonal angles. Additionally, beach widening logic in `chill-flight-logic.js` was historically restricted to the East Coast (`eastCoastFactor > 0`), leaving western lakes, island atolls, and northern shores with steep polygonal drops into the water.
- **Goal:** Gentle, natural beach slopes that ease into the water across all landmasses, softening the geometric intersection.

### 1.3 Missing or smeared shoreline foam

- **Root cause:** Water mesh geometry is generated at a coarse 150-unit quad resolution (`wSegments = 10`), whereas terrain quads are 37.5 units wide. Water vertex foam coloring (`_colorFoam`) is applied to water vertices that fall inland under solid terrain, where they are invisible. Offshore vertices remain blue. The resulting color interpolation spans 150 units and is largely swallowed under the terrain. Meanwhile, the terrain-side foam threshold in `terrain.js` is only 0.5 units tall (`height <= WATER_LEVEL + 0.5`), which is too narrow for a 37.5-unit grid to reliably sample.
- **Goal:** Crisp, animated surf lines and wave crests generated in the water shader and anchored to the shore distance, complemented by a reliable coastal foam band on the beach mesh.

### 1.4 No wet sand transition band

- **Root cause:** Terrain colors jump directly from underwater sand / foam to dry pale yellow sand (`_colorSand = 0xe0e0a8`). In real coastal environments, the tidal and wave wash zone creates a distinct band of darker, saturated damp sand.
- **Goal:** A natural damp sand transition band (`_colorWetSand`) along the waterline that darkens the beach right where waves lap against the shore.

---

## 2. Proposed technical changes

### 2.1 Water shader and material enhancements (`terrain.js`)

1. **Depth-aware vertex attribute (`waterDepth`):**
   - Calculate water depth per water vertex: `depth = Math.max(0.0, WATER_LEVEL - terrainHeight)`.
   - Pass as attribute `aWaterDepth` with varying `vWaterDepth` to the fragment shader.

2. **Dual-tone water color and dynamic opacity gradient:**
   - Interpolate between shallow turquoise (`#48cae4` / `#5eead4`) and deep marine blue (`#0077b6` / `#023e8a`) based on `vWaterDepth`.
   - Modulate water opacity dynamically: `~0.65` in shallow water (revealing sand) ramping up to `~0.90` in deep ocean water.

3. **Procedural shoreline foam in fragment shader:**
   - Use `vWaterDepth` and `uTime` to render a pulsing, crisp white surf line along all shores (`vWaterDepth < 3.5`).
   - Guarantees continuous animated coastal foam regardless of polygon resolution.

### 2.2 Seabed and beach slope adjustments (`terrain.js` & `chill-flight-logic.js`)

1. **Remove artificial seabed drop (`terrain.js`):**
   - Replace `positions[i + 1] = height - 5;` with a smooth slope (`height - Math.min(2.0, depth * 0.3)`).
   - Keeps shallow seabed sand at `Y = 37`–`39` near beaches, visible through shallow water while preventing z-fighting.

2. **Global beach easing (`chill-flight-logic.js`):**
   - Expand beach slope easing (`Math.pow(t, 1.4)`) beyond just the East Coast to all landmasses and lakes so shores ease into water gently.

### 2.3 Wet sand and shoreline color transitions (`terrain.js`)

1. **Wet sand color tokens:**
   - Define `_colorWetSand = new THREE.Color(0xb09d6b)` and `_colorDesertWetSand = new THREE.Color(0xc47e3c)`.

2. **Tidal wash color interpolation:**
   - Submerged sand (`height < WATER_LEVEL`): Tinted with water color blend.
   - Wet sand band (`WATER_LEVEL <= height <= WATER_LEVEL + 1.2`): Smooth blend into damp golden sand.
   - Dry sand (`height > WATER_LEVEL + 1.2`): Standard dry sand color with noise mottling.

---

## 3. Implementation checklist

- [ ] **Step 1: Expand beach slope easing in `chill-flight-logic.js`**
  - Generalize the `Math.pow(t, 1.4)` easing curve to all global coastlines and lakes.
- [ ] **Step 2: Add water depth attribute and seabed slope in `terrain.js`**
  - Compute `aWaterDepth` per water vertex and bind to `waterGeo`.
  - Replace `positions[i + 1] = height - 5` with smooth shallow seabed slope.
- [ ] **Step 3: Update water shader in `terrain.js`**
  - Add shallow/deep color uniforms and depth-based color mixing.
  - Implement dynamic opacity gradient (`0.65` shallows to `0.90` deep).
  - Add procedural animated wave/surf foam line driven by `vWaterDepth` and `uTime`.
- [ ] **Step 4: Implement wet sand tidal band in `terrain.js`**
  - Add `_colorWetSand` and `_colorDesertWetSand` color tokens.
  - Interpolate vertex colors across the `[WATER_LEVEL - 0.5, WATER_LEVEL + 1.2]` tidal zone.
- [ ] **Step 5: Format and verify**
  - Run `npm run format`.
  - Run `npm run test:syntax`.
  - Browser verification at `X = 149, Z = -3095` (`0.030° East, 0.619° North`).

---

## 4. Verification plan

### Automated and syntax tests

- Run `npm run format` to ensure code formatting consistency.
- Run `npm run test:syntax` to verify valid JavaScript syntax across all modules.

### Browser verification

Navigate to the test coordinates (`X = 149, Z = -3095` / `0.030° East, 0.619° North`):
`http://localhost:5173/?debug=true&freecam=true&seed=20260914&x=149&y=771&z=-3095&heading=33&pitch=-33&tod=0.3349&timeSpeed=0&palette=26225698&preset=mid`

Verify:

1. **Visible seabed & depth gradient:** Sand beneath shallow water is visible from the air, smoothly transitioning to deep ocean blue.
2. **Shoreline transition:** The harsh triangular knife-edge intersection is replaced by a gentle beach slope into the water.
3. **Shoreline foam:** A distinct, pulsing white wave/surf line traces the perimeter of all beaches and islands.
4. **Wet sand band:** A subtle darker golden-brown band of damp sand borders the water line.
5. **No z-fighting or performance drop:** 60 FPS is maintained with zero polygon flickering.
