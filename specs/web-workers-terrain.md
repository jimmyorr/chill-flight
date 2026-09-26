# Web workers terrain generation architecture

This document details the multi-threaded Web Worker architecture used to generate procedural terrain, surface colors, water geometry, and object placements asynchronously off the main animation thread.

---

## 1. Motivation and background

Prior to this architecture, procedural terrain generation executed entirely on the main JavaScript thread within cooperative generator time slices (`generateChunk()` using `checkYield()`). Generating each chunk required:

- Sampling procedural noise across $1,681$ terrain vertices ($40 \times 40$ segments).
- Multi-octave domain warping, biome blending, and feature injections (volcano, canyons, ice shelves).
- Computing surface colors, slope gradients, and underwater vertex depths.
- Evaluating candidate positions and matrix transforms for trees, rocks, cacti, buildings, watercraft, and props.

Even with cooperative budgeting, this computation created micro-stutters and frame drops during high-speed flight or rapid camera rotations.

By offloading all mathematical modeling and candidate evaluations to background Web Workers transferring zero-copy binary `ArrayBuffer` objects, the main thread render loop (60/90 FPS) is fully decoupled from terrain generation.

---

## 2. System architecture

```
+-----------------------------------------------------------------------------+
|                         Main Thread (Render Loop)                           |
|                                                                             |
|  [Airplane Movement] -> [updateChunks()] -> [Directional Priority Queue]   |
|                                                     |                       |
|                                           terrainWorkerManager              |
|                                                     | (postMessage)         |
+-----------------------------------------------------+-----------------------+
                                                      |
                                    +-----------------+-----------------+
                                    | Transferable                      | Transferable
                                    | Request                           | Request
                                    v                                   v
+---------------------------------------+   +---------------------------------------+
|        Worker 1 (chunk A)             |   |        Worker 2 (chunk B)             |
|                                       |   |                                       |
| - ChillFlightLogic.getElevation()     |   | - ChillFlightLogic.getElevation()     |
| - Slope, Biome & Vertex Colors        |   | - Slope, Biome & Vertex Colors        |
| - Water Mesh & Depth Buffers          |   | - Water Mesh & Depth Buffers          |
| - 16-Float Instance Matrices & Colors |   | - 16-Float Instance Matrices & Colors |
| - Chunk-Local Props & Bird Paths      |   | - Chunk-Local Props & Bird Paths      |
+---------------------------------------+   +---------------------------------------+
                    |                                           |
                    +-----------------+-------------------------+
                                      | Transferable ArrayBuffers
                                      | (Zero-Copy Transfer: ~0.01ms)
                                      v
+-----------------------------------------------------------------------------+
|                       Main Thread (Assembly & Render)                       |
|                                                                             |
|  [processChunkQueue()] -> Binds Float32Arrays directly to BufferAttributes  |
|  [GlobalInstanceManager] -> Copies instanced matrix slices into GPU buffers |
|  [Three.js Scene Graph] -> Renders chunk meshes without computational lag   |
+-----------------------------------------------------------------------------+
```

---

## 3. Core components

### 3.1 Worker script ([`terrain-worker.js`](file:///Users/jimmyorr/chill-flight-repo/terrain-worker.js))

- Loaded as a standard background worker via `importScripts('./noise.js', './chill-flight-logic.js')`.
- Pure mathematical computation with **zero DOM or Three.js dependencies**.
- Features an optimized internal `_Color` helper operating strictly in linear sRGB space matching Three.js shader outputs.
- Returns a flat payload of transferable binary buffers for terrain, water, and prop instances.

### 3.2 Worker pool manager ([`terrain-worker-manager.js`](file:///Users/jimmyorr/chill-flight-repo/terrain-worker-manager.js))

- Manages a pool of $N$ workers (bounded between 1 and 4 based on `navigator.hardwareConcurrency`).
- Provides a promise-based dispatch interface: `requestChunk(chunkX, chunkZ, options)`.
- Maintains a priority-sorted job queue.
- Handles job cancellation and active worker tracking.

### 3.3 Chunk streaming integration ([`terrain-chunks.js`](file:///Users/jimmyorr/chill-flight-repo/terrain-chunks.js))

- `updateChunks()` calculates forward-flight directional priorities and dispatches background worker requests.
- `processChunkQueue()` consumes completed worker payloads, immediately binding pre-computed `Float32Array` buffers to Three.js `BufferGeometry` attributes without blocking the frame.

---

## 4. Binary payload specification

To eliminate serialization overhead and memory duplication, all vertex coordinates, colors, and transformation matrices are transferred across threads as zero-copy `ArrayBuffer` transferables:

```typescript
interface ChunkWorkerResponse {
  chunkX: number;
  chunkZ: number;
  buffers: {
    terrainPositions: Float32Array; // Transferable
    terrainColors: Float32Array; // Transferable
    terrainWaterDepth: Float32Array; // Transferable
    waterPositions?: Float32Array; // Transferable (when chunk has water)
    waterColors?: Float32Array; // Transferable (when chunk has water)
    waterDepths?: Float32Array; // Transferable (when chunk has water)
  };
  instanceData: {
    [propType: string]: {
      count: number;
      matrices: Float32Array; // Transferable (count * 16 floats)
      colors?: Float32Array; // Transferable (count * 3 floats)
    };
  };
  chunkLocalProps: Array<{
    type: string;
    matrix: number[];
    extra?: any;
  }>;
  birds: Array<{
    origin: [number, number, number];
    radius: number;
    speed: number;
    phase: number;
    height: number;
  }>;
}
```

---

## 5. Directional prioritization and cancellation

### 5.1 Directional priority scoring

Missing chunks are scored dynamically every frame based on their distance and alignment with the aircraft's horizontal heading vector:

$$\text{priority} = -\text{distance} \times 10 + (\vec{d} \cdot \vec{f}) \times 25$$

Where $\vec{d}$ is the normalized direction vector to the chunk and $\vec{f}$ is the aircraft forward heading vector. Chunks directly in front of the aircraft receive the highest priority, ensuring the flight path remains fully populated without pop-in.

### 5.2 Dynamic queue re-scoring & cancellation

- As the player turns or banks, `terrainWorkerManager.updatePriorities()` recalculates priorities across all queued jobs.
- When chunks move outside the render distance or when a teleport occurs (`clearChunkQueue()`), `cancelJob()` and `cancelRequests()` prune the queue and flag active jobs so obsolete worker results are discarded immediately.

---

## 6. Graceful fallback

If Web Workers are unavailable or restricted by browser security policies (e.g. legacy WebViews or strict sandbox environments):

- `terrainWorkerManager.isSupported` evaluates to `false`.
- `generateChunk()` automatically falls back to the synchronous main-thread generator using the cooperative `checkYield()` time budget.
- Full procedural consistency and visual parity are preserved across both modes.
