// terrain-worker.js
// Terrain web worker: generates chunks off the main thread (see terrain-gen.js).

import {generateChunkData} from './terrain-gen.js';
import {ChillFlightLogic} from './chill-flight-logic.js';

self.onmessage = function (e) {
  // A custom heightmap (?map= or a dropped image), for the chunks after it
  if (e.data.type === 'customMap') {
    ChillFlightLogic.customMap = e.data.customMap;
    return;
  }
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
