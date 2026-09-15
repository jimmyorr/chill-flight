# Rendering & Performance Audit

## 1. Garbage Collection & Memory Churn

The animation loop in `game.js` creates excessive temporary objects, leading to frequent Garbage Collection (GC) spikes, causing micro-stutters.

**Issue (game.js / terrain.js):** Inline vector instantiation in hot loops.
**Penalty:** Severe stuttering on mobile devices due to frequent GC pauses.
**Fix (Vector Pooling):**
Allocate temporary variables once outside the loop.

_Before (terrain.js / game.js):_

```javascript
function update() {
  const currentPos = new THREE.Vector3(
    plane.position.x,
    plane.position.y,
    plane.position.z
  );
  const distance = currentPos.distanceTo(lastUpdatePos);
}
```

_After (terrain.js / game.js):_

```javascript
const _currentPos = new THREE.Vector3(); // Module-level allocation
function update() {
  _currentPos.copy(plane.position);
  const distance = _currentPos.distanceTo(lastUpdatePos);
}
```

## 2. Three.js Draw Calls & Geometry

The terrain currently generates a high volume of individual meshes or complex geometries per chunk.
**Optimization:** Use `InstancedMesh` for repeated objects (e.g., trees, clouds) and `BufferGeometry` for the terrain chunks. Implement a pooling system for chunk geometries to avoid creating/destroying buffers as the plane moves.

## 3. Shader, Sky, and Fog Optimization

Custom sky gradients and fog often recalculate per vertex or use expensive fragments.
Ensure `fog` in `scene.fog` uses `THREE.Fog` (linear) instead of `THREE.FogExp2` if performance is bottlenecked on mobile, or bake the sky gradient into a static texture map (`sky-palette.svg`) mapped to a skydome rather than calculating it procedurally in fragment shaders on low-end devices.

## 4. Frame Pacing & Thermals

Mobile devices (Capacitor iOS/Android) overheat when rendering at uncapped framerates.
**Fix:**
Ensure the physics step uses a fixed delta time (`fixedUpdate`), while the render loop uses standard `requestAnimationFrame` with interpolation.

_Before:_

```javascript
function animate() {
  requestAnimationFrame(animate);
  updatePhysics(Date.now() - lastTime);
  renderer.render(scene, camera);
}
```

_After:_

```javascript
const FIXED_STEP = 1000 / 60;
function animate(time) {
  requestAnimationFrame(animate);
  let dt = time - lastTime;
  while (accumulator >= FIXED_STEP) {
    updatePhysics(FIXED_STEP); // Fixed step for stability
    accumulator -= FIXED_STEP;
  }
  renderer.render(scene, camera);
}
```
