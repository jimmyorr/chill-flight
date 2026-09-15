# Eastern islands diversity improvements

## Proposed geographic features

Since the terrain engine relies on a heightmap (which means we can't do true 3D overhangs or caves), we will use math to create extreme, breathtaking verticality and varied island archetypes.

We will dynamically categorize the Eastern Islands into three completely distinct "types" based on low-frequency noise (so the type smoothly changes as you fly further east or north/south):

### 1. Karst limestone towers (Halong Bay style)

- **Concept:** Instead of standard cone mountains, these are sheer, vertical pillars of rock that burst dramatically out of the ocean and the jungle canopy.
- **Math:** We'll use a heavily squared threshold noise to create sheer cliffs that abruptly transition to flat, slightly domed tops.

### 2. Massive volcanic calderas

- **Concept:** Huge, steep-sided islands with a massive, perfectly bowl-shaped crater in the center. Some craters might dip below sea level, creating a hidden lagoon in the center of the island.
- **Math:** We'll use radial distance from a local noise peak to carve out the center mathematically.

### 3. Sunken atolls / barrier rings

- **Concept:** Very low-lying, flat rings of land surrounding shallow lagoons.
- **Math:** We'll flatten the base island height and use a ring-shaped elevation mask to create the narrow strips of land.

## Proposed changes

### `chill-flight-logic.js`

- Overhaul the Eastern Islands logic block.
- Introduce a `biomeSelector` noise variable that cleanly blends between the three island archetypes (Karst, Caldera, Atoll).
- Replace the basic `islandHeight` calculation with the specialized math for the selected archetype.
- Maintain coastal transitions while avoiding water wave z-fighting.

## Verification plan

### Manual verification

1. Fly far to the East (`x > 20000`).
2. Verify that the three different island archetypes look distinct and visually impressive without z-fighting.
