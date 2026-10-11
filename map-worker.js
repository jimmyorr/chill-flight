// map-worker.js
// Renders map tiles and bands off the main thread (see map-render.js), for
// the in-game map (map-tiles.js) and the map export page.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {renderMapRows} from './map-render.js';

self.onmessage = function (e) {
  // A custom heightmap (?map= or a dropped image), for the jobs after it
  if (e.data.type === 'customMap') {
    ChillFlightLogic.customMap = e.data.customMap;
    return;
  }
  const {id, rowStart, rowEnd} = e.data;
  const pixels = renderMapRows(e.data);
  self.postMessage({id, rowStart, rowEnd, pixels}, [pixels.buffer]);
};
