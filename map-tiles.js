// map-tiles.js
// The in-game map's picture, in square tiles rendered off the main thread
// (map-worker.js) and cached, so panning reuses what's already drawn and
// every zoom stays sharp. Levels double in scale: level 0 is BASE_UPP world
// units per tile pixel, level 1 twice that, and so on.
import {ChillFlightLogic} from './chill-flight-logic.js';
import {simplex} from './noise.js';
import {renderMapRows} from './map-render.js';
import {log} from './logger.js';

export const TILE_PX = 256;
const BASE_UPP = 2;
export const MAX_LEVEL = 8;
// About 40 MB of 256x256 tiles
const MAX_TILES = 160;

const createMapWorker = () =>
  new Worker(new URL('./map-worker.js', import.meta.url), {type: 'module'});

export class MapTiles {
  constructor() {
    // key -> canvas, oldest first (a hit moves it to the end)
    this.cache = new Map();
    // Tiles to render next, most wanted first: [level, tx, tz]
    this.queue = [];
    this.inFlight = new Set();
    this.workers = null;
    this.idle = [];
    this.nextId = 0;
    this.jobs = new Map(); // id -> {key, level, tx, tz}
    // What the cached tiles were drawn for (seed, outline, custom map)
    this.worldKey = null;
    this.sentCustomMap = null;
    this.mainThreadTimer = null;
  }

  // World units per tile pixel at a level
  static upp(level) {
    return BASE_UPP * 2 ** level;
  }

  // The finest level whose pixels are no bigger than the screen's (at
  // unitsPerScreenPixel), so the map is never stretched
  static levelFor(unitsPerScreenPixel) {
    const level = Math.floor(Math.log2(unitsPerScreenPixel / BASE_UPP));
    return Math.max(0, Math.min(MAX_LEVEL, level));
  }

  // The cached tile, if drawn (and marks it recently used)
  get(level, tx, tz) {
    this.checkWorld();
    const key = `${level}:${tx}:${tz}`;
    const tile = this.cache.get(key);
    if (tile) {
      this.cache.delete(key);
      this.cache.set(key, tile);
    }
    return tile;
  }

  // Replaces the queue with these tiles ([level, tx, tz], most wanted
  // first), skipping any already cached or being drawn
  want(tiles) {
    this.queue = tiles.filter(([level, tx, tz]) => {
      const key = `${level}:${tx}:${tz}`;
      return !this.cache.has(key) && !this.inFlight.has(key);
    });
    this.pump();
  }

  // Drops the cache when the world it was drawn for changes
  checkWorld() {
    const key = `${ChillFlightLogic.WORLD_SEED}:${ChillFlightLogic.CONTINENT}:${ChillFlightLogic.customMap ? ChillFlightLogic.customMap.width : 0}`;
    if (key !== this.worldKey) {
      this.worldKey = key;
      this.cache.clear();
    }
  }

  startWorkers() {
    if (this.workers) return;
    this.workers = [];
    const count = Math.max(
      1,
      Math.min(4, (navigator.hardwareConcurrency || 4) - 1)
    );
    try {
      for (let i = 0; i < count; i++) {
        const worker = createMapWorker();
        worker.onmessage = (e) => this.onResult(worker, e.data);
        worker.onerror = (e) => {
          log.warn('Map worker failed; drawing the map on the main thread', e);
          this.workers = [];
          this.idle = [];
          for (const job of this.jobs.values()) this.inFlight.delete(job.key);
          this.jobs.clear();
          this.pump();
        };
        this.workers.push(worker);
        this.idle.push(worker);
      }
    } catch (e) {
      log.warn('Map workers unavailable; drawing on the main thread', e);
      this.workers = [];
      this.idle = [];
    }
  }

  // Hands queued tiles to idle workers (or, without workers, draws one at a
  // time on the main thread)
  pump() {
    this.startWorkers();
    const customMap = ChillFlightLogic.customMap || null;
    if (customMap !== this.sentCustomMap) {
      this.sentCustomMap = customMap;
      for (const worker of this.workers) {
        worker.postMessage({type: 'customMap', customMap});
      }
    }
    if (this.workers.length === 0) {
      this.pumpMainThread();
      return;
    }
    while (this.idle.length > 0 && this.queue.length > 0) {
      const [level, tx, tz] = this.queue.shift();
      const key = `${level}:${tx}:${tz}`;
      const id = this.nextId++;
      this.inFlight.add(key);
      this.jobs.set(id, {key});
      this.idle.pop().postMessage(this.jobFor(id, level, tx, tz));
    }
  }

  pumpMainThread() {
    if (this.mainThreadTimer || this.queue.length === 0) return;
    this.mainThreadTimer = setTimeout(() => {
      this.mainThreadTimer = null;
      const next = this.queue.shift();
      if (!next) return;
      const [level, tx, tz] = next;
      const job = this.jobFor(0, level, tx, tz);
      job.simplex = simplex;
      this.store(`${level}:${tx}:${tz}`, renderMapRows(job));
      this.pumpMainThread();
    }, 0);
  }

  jobFor(id, level, tx, tz) {
    const upp = MapTiles.upp(level);
    const size = TILE_PX * upp;
    return {
      id,
      seed: ChillFlightLogic.WORLD_SEED,
      continent: ChillFlightLogic.CONTINENT,
      x0: tx * size,
      z0: tz * size,
      upp,
      width: TILE_PX,
      rowStart: 0,
      rowEnd: TILE_PX,
    };
  }

  onResult(worker, {id, pixels}) {
    const job = this.jobs.get(id);
    this.jobs.delete(id);
    this.idle.push(worker);
    if (job) {
      this.inFlight.delete(job.key);
      this.store(job.key, pixels);
    }
    this.pump();
  }

  store(key, pixels) {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    canvas
      .getContext('2d')
      .putImageData(new ImageData(pixels, TILE_PX, TILE_PX), 0, 0);
    this.cache.set(key, canvas);
    while (this.cache.size > MAX_TILES) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }
}
