// --- DYNAMIC PERFORMANCE SCALING ---
class DynamicPerformanceMonitor {
  constructor() {
    this.windowSize = 30;
    this.frameTimeRing = new Float32Array(this.windowSize);
    this.ringIndex = 0;
    this.ringSum = 0;
    this.ringCount = 0;

    // Config (in ms/frame)
    this.targetFrameTime = 16.67; // 60 FPS
    this.slightlyOverloaded = 20; // 50 FPS
    this.moderatelyOverloaded = 25; // 40 FPS
    this.severelyOverloaded = 33.33; // 30 FPS

    // LOD state
    this.lodMultiplier = 1.0;
    this.cooldownFrames = 0;
    this.cooldownMax = 30; // Wait 30 frames between adjustments

    // Dynamic resolution scaling (DRS) state
    this.pixelRatioMultiplier = 1.0;
    this._minPixelRatioMult = 0.8; // Floor: never drop below 80% of base resolution

    // Shadow throttling state
    this.shadowCadence = 1; // 1 = every frame, 2 = every other, 4 = every 4th, 0 = off
    this._frameCount = 0;
    this._nightCulling = false; // True when dayFactor < 0.05

    // Chunk budget state
    this._chunkBudgetMs = 4.0; // Default 4ms per frame
  }

  update(delta) {
    const frameTimeMs = delta * 1000;
    this._frameCount++;

    if (this.ringCount < this.windowSize) {
      this.ringSum += frameTimeMs;
      this.ringCount++;
    } else {
      this.ringSum += frameTimeMs - this.frameTimeRing[this.ringIndex];
    }
    this.frameTimeRing[this.ringIndex] = frameTimeMs;
    this.ringIndex = (this.ringIndex + 1) % this.windowSize;

    if (this.cooldownFrames > 0) {
      this.cooldownFrames--;
      return;
    }

    if (this.ringCount >= this.windowSize) {
      const avgFrameTime = this.ringSum / this.ringCount;
      let changed = false;

      // --- LOD scaling ---
      if (avgFrameTime > this.severelyOverloaded) {
        if (this.lodMultiplier > 0.2) {
          this.lodMultiplier = Math.max(0.2, this.lodMultiplier - 0.2);
          changed = true;
        }
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        if (this.lodMultiplier > 0.4) {
          this.lodMultiplier = Math.max(0.4, this.lodMultiplier - 0.1);
          changed = true;
        }
      } else if (avgFrameTime > this.slightlyOverloaded) {
        if (this.lodMultiplier > 0.6) {
          this.lodMultiplier = Math.max(0.6, this.lodMultiplier - 0.1);
          changed = true;
        }
      } else if (avgFrameTime <= this.targetFrameTime * 1.05) {
        if (this.lodMultiplier < 1.0) {
          this.lodMultiplier = Math.min(1.0, this.lodMultiplier + 0.1);
          changed = true;
        }
      }

      // --- Dynamic resolution scaling (DRS) ---
      // Reserve DRS for moderate/severe load (< 40 FPS); let LOD and shadows handle slight dips.
      if (avgFrameTime > this.severelyOverloaded) {
        if (this.pixelRatioMultiplier > this._minPixelRatioMult) {
          this.pixelRatioMultiplier = Math.max(
            this._minPixelRatioMult,
            this.pixelRatioMultiplier - 0.1
          );
          changed = true;
        }
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        if (this.pixelRatioMultiplier > this._minPixelRatioMult) {
          this.pixelRatioMultiplier = Math.max(
            this._minPixelRatioMult,
            this.pixelRatioMultiplier - 0.05
          );
          changed = true;
        }
      } else if (avgFrameTime <= this.targetFrameTime * 1.05) {
        if (this.pixelRatioMultiplier < 1.0) {
          this.pixelRatioMultiplier = Math.min(
            1.0,
            this.pixelRatioMultiplier + 0.05
          );
          changed = true;
        }
      }

      // --- Shadow cadence scaling ---
      let newCadence = this.shadowCadence;
      if (this._nightCulling) {
        newCadence = 0;
      } else if (avgFrameTime > this.severelyOverloaded) {
        newCadence = 4;
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        newCadence = 3;
      } else if (avgFrameTime > this.slightlyOverloaded) {
        newCadence = 2;
      } else if (avgFrameTime <= this.targetFrameTime * 1.05) {
        newCadence = 1;
      }
      if (newCadence !== this.shadowCadence) {
        this.shadowCadence = newCadence;
        changed = true;
      }

      // --- Chunk budget scaling ---
      if (avgFrameTime > this.severelyOverloaded) {
        this._chunkBudgetMs = 1.0;
      } else if (avgFrameTime > this.moderatelyOverloaded) {
        this._chunkBudgetMs = 2.0;
      } else if (avgFrameTime > this.slightlyOverloaded) {
        this._chunkBudgetMs = 3.0;
      } else {
        this._chunkBudgetMs = 4.0;
      }

      if (changed) {
        this.applyEffectiveLOD();
        this.applyDRS();
        this.cooldownFrames = this.cooldownMax;
      }
    }
  }

  /**
   * Update night culling state. Call each frame with the current dayFactor.
   * When dayFactor < 0.05, shadows are entirely skipped (no shadow pass at all).
   */
  updateDayFactor(dayFactor) {
    this._nightCulling = dayFactor < 0.05;
    // If we just entered night, immediately disable shadows without waiting for cooldown
    if (this._nightCulling && this.shadowCadence !== 0) {
      this.shadowCadence = 0;
    }
  }

  /**
   * Returns true if the shadow map should be updated this frame.
   * When cadence is 0 (night culling), always returns false.
   */
  shouldUpdateShadows() {
    if (this.shadowCadence === 0) return false;
    return this._frameCount % this.shadowCadence === 0;
  }

  /**
   * Returns the chunk generation time budget in ms for this frame.
   * During the loading screen, the caller should use 33ms instead.
   */
  getChunkBudget() {
    return this._chunkBudgetMs;
  }

  /**
   * Apply DRS by adjusting the renderer's pixel ratio relative to the base.
   */
  applyDRS() {
    if (
      typeof renderer !== 'undefined' &&
      renderer &&
      renderer.xr &&
      renderer.xr.isPresenting
    ) {
      return; // Do not manipulate pixel ratio while WebXR manages stereo framebuffers
    }
    const baseRatio =
      typeof window._basePixelRatio !== 'undefined'
        ? window._basePixelRatio
        : 1.0;
    const effectiveRatio = baseRatio * this.pixelRatioMultiplier;
    if (typeof renderer !== 'undefined' && renderer) {
      renderer.setPixelRatio(effectiveRatio);
    }
  }

  getEffectiveLOD() {
    const baseLOD =
      window.manualPropLOD !== undefined
        ? window.manualPropLOD
        : typeof PROP_LOD_DISTANCE !== 'undefined'
          ? PROP_LOD_DISTANCE
          : 4200;
    return baseLOD * this.lodMultiplier;
  }

  getSmoothedFrameTime() {
    return this.ringCount > 0 ? this.ringSum / this.ringCount : 0;
  }

  getAvgFPS() {
    if (this.ringCount === 0) return 0;
    const avgMs = this.ringSum / this.ringCount;
    return avgMs > 0 ? Math.round(1000 / avgMs) : 0;
  }

  get1PercentLowFPS() {
    if (this.ringCount === 0) return 0;
    const count = this.ringCount;
    const slice = new Float32Array(count);
    slice.set(this.frameTimeRing.subarray(0, count));
    slice.sort();
    const p1Count = Math.max(1, Math.floor(count * 0.05));
    let sum = 0;
    for (let i = count - p1Count; i < count; i++) {
      sum += slice[i];
    }
    const worstMs = sum / p1Count;
    return worstMs > 0 ? Math.round(1000 / worstMs) : 0;
  }

  applyEffectiveLOD() {
    const newLOD = this.getEffectiveLOD();
    // Use the global chunks map from terrain.js if available
    const chunkMap =
      typeof window.chunks !== 'undefined'
        ? window.chunks
        : typeof chunks !== 'undefined'
          ? chunks
          : null;
    if (chunkMap) {
      chunkMap.forEach((chunk) => {
        if (
          chunk.userData.objectsGroup &&
          chunk.userData.objectsGroup.levels &&
          chunk.userData.objectsGroup.levels.length > 1
        ) {
          chunk.userData.objectsGroup.levels[1].distance = newLOD;
        }
      });
    }
  }
}

const performanceMonitor = new DynamicPerformanceMonitor();
window.performanceMonitor = performanceMonitor;

// Disable automatic shadow map updates; DynamicPerformanceMonitor controls the cadence
if (typeof renderer !== 'undefined' && renderer) {
  renderer.shadowMap.autoUpdate = false;
}

// Start loop
