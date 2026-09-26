/* global importScripts */
// terrain-worker.js
// Phase 1: Worker Foundation

// Load pure math dependencies.
importScripts('./noise.js', './chill-flight-logic.js');

self.onmessage = function (e) {
  const {id, chunkX, chunkZ} = e.data;

  try {
    // For Phase 1, we just echo back a success message to verify the pipeline.
    self.postMessage({
      id,
      chunkX,
      chunkZ,
      status: 'success',
      buffers: {},
      instanceData: {},
      chunkLocalProps: [],
    });
  } catch (error) {
    self.postMessage({
      id,
      chunkX,
      chunkZ,
      status: 'error',
      error: error.message,
    });
  }
};
