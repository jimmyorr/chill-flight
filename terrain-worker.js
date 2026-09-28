// terrain-worker.js
// Terrain web worker: generates chunks off the main thread (see terrain-gen.js).

import {generateChunkData} from './terrain-gen.js';

self.onmessage = function (e) {
  const {id, chunkX, chunkZ} = e.data;
  try {
    const {result, transferables} = generateChunkData(e.data);
    self.postMessage(
      {id, chunkX, chunkZ, status: 'success', ...result},
      transferables
    );
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
