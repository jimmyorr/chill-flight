// terrain-worker-manager.js
// Pool of terrain workers that generate chunk data off the main thread.
import {log} from './logger.js';

// A chunk takes tens of milliseconds; a worker that hasn't answered in this
// long is treated as dead (e.g. its script never finished loading on a bad
// network) and replaced, and the job is rejected so the caller can fall back.
const JOB_TIMEOUT_MS = 10000;

// Vite recognizes this pattern and bundles the worker in production.
const createTerrainWorker = () =>
  new Worker(new URL('./terrain-worker.js', import.meta.url), {
    type: 'module',
  });

export class TerrainWorkerManager {
  // Tests pass a fake createWorker and a short jobTimeoutMs.
  constructor(
    workerCount = null,
    {createWorker = createTerrainWorker, jobTimeoutMs = JOB_TIMEOUT_MS} = {}
  ) {
    this.createWorker = createWorker;
    this.jobTimeoutMs = jobTimeoutMs;
    // Determine number of workers based on hardware, bounded between 1 and 4
    this.poolSize =
      workerCount ||
      Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    this.workers = [];
    this.idleWorkers = [];
    this.busyWorkers = new Map(); // worker -> job
    this.jobQueue = [];
    this.activeJobs = new Map();
    this.nextJobId = 0;
    // Until some worker has answered, repeated failures mean workers can't
    // run here at all (rather than one worker having died).
    this.hasReplied = false;
    this.failedWorkers = 0;
    this.isSupported =
      createWorker !== createTerrainWorker ||
      (typeof window !== 'undefined' && window.Worker !== undefined);

    if (this.isSupported) {
      for (let i = 0; i < this.poolSize && this.isSupported; i++) {
        this._spawnWorker();
      }
    } else {
      log.warn(
        'Web Workers are not supported in this environment. Terrain generation will fall back to main thread.'
      );
    }
  }

  _spawnWorker() {
    try {
      const worker = this.createWorker();
      worker.onmessage = this._handleMessage.bind(this, worker);
      worker.onerror = this._handleError.bind(this, worker);
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    } catch (err) {
      log.error('Failed to initialize terrain worker:', err);
      this._disable();
    }
  }

  _handleMessage(worker, e) {
    const {id, status, error} = e.data;
    const job = this.activeJobs.get(id);
    this.hasReplied = true;
    if (job) {
      this._releaseWorker(worker, job);
      if (!job.cancelled) {
        if (status === 'success') {
          job.resolve(e.data);
        } else {
          job.reject(new Error(error || 'Worker job failed'));
        }
      }
    }
    this._processQueue();
  }

  _handleError(worker, err) {
    log.error('Terrain worker error:', err.message || err);
    this._failWorker(worker, new Error('Terrain worker error'));
  }

  // Rejects the worker's current job, then replaces the worker (or gives up
  // on workers entirely if none has ever answered).
  _failWorker(worker, reason) {
    const job = this.busyWorkers.get(worker);
    if (job) {
      this._releaseWorker(worker, job);
      if (!job.cancelled) job.reject(reason);
    }
    worker.terminate();
    this.workers = this.workers.filter((w) => w !== worker);
    this.idleWorkers = this.idleWorkers.filter((w) => w !== worker);
    this.failedWorkers++;
    if (!this.hasReplied && this.failedWorkers >= this.poolSize) {
      log.warn('Terrain workers never responded; generating on main thread.');
      this._disable();
      return;
    }
    this._spawnWorker();
    this._processQueue();
  }

  _releaseWorker(worker, job) {
    clearTimeout(job.timer);
    this.activeJobs.delete(job.id);
    this.busyWorkers.delete(worker);
    if (this.workers.includes(worker) && !this.idleWorkers.includes(worker)) {
      this.idleWorkers.push(worker);
    }
  }

  // Stops using workers: rejects every pending job so callers fall back.
  _disable() {
    this.isSupported = false;
    const reason = new Error('Terrain workers unavailable');
    const jobs = [...this.jobQueue, ...this.activeJobs.values()];
    this.jobQueue = [];
    this.activeJobs.clear();
    this.busyWorkers.clear();
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.idleWorkers = [];
    for (const job of jobs) {
      clearTimeout(job.timer);
      if (!job.cancelled) job.reject(reason);
    }
  }

  _processQueue() {
    while (this.jobQueue.length > 0 && this.idleWorkers.length > 0) {
      // Highest priority chunk first
      if (this.jobQueue.length > 1) {
        this.jobQueue.sort((a, b) => b.priority - a.priority);
      }

      const job = this.jobQueue.shift();
      const worker = this.idleWorkers.pop();

      this.activeJobs.set(job.id, job);
      this.busyWorkers.set(worker, job);
      job.timer = setTimeout(() => {
        log.warn('Terrain worker timed out; replacing it.');
        this._failWorker(worker, new Error('Terrain worker timed out'));
      }, this.jobTimeoutMs);
      worker.postMessage(job.payload, job.transferables);
    }
  }

  requestChunk(chunkX, chunkZ, options = {}) {
    if (!this.isSupported) {
      return Promise.reject(new Error('Web Workers not supported'));
    }

    return new Promise((resolve, reject) => {
      const jobId = this.nextJobId++;

      const payload = {
        id: jobId,
        chunkX,
        chunkZ,
        segments: options.segments !== undefined ? options.segments : 40,
        chunkSize: options.chunkSize !== undefined ? options.chunkSize : 1500,
        elevParams: options.elevParams || {
          WATER_LEVEL: 40,
          MOUNTAIN_LEVEL: 180,
          MAP_WORLD_SIZE: 10000,
          MAP_HEIGHT_SCALE: 400,
        },
        worldSeed: options.worldSeed || 1,
        enableObjects: options.enableObjects !== false,
      };

      const job = {
        id: jobId,
        // 'near' for regular chunks; 'far' for the distant terrain ring,
        // whose jobs keep their own priority and aren't cancelled with near
        // chunks that share their coordinates.
        kind: options.kind || 'near',
        priority: options.priority !== undefined ? options.priority : 0,
        payload,
        transferables: options.transferables || [],
        resolve,
        reject,
        cancelled: false,
        timer: null,
      };

      this.jobQueue.push(job);
      this._processQueue();
    });
  }

  // Update priorities of pending near-chunk jobs
  updatePriorities(scoringFn) {
    for (let i = 0; i < this.jobQueue.length; i++) {
      const job = this.jobQueue[i];
      if (job.kind !== 'near') continue;
      job.priority = scoringFn(job.payload.chunkX, job.payload.chunkZ);
    }
  }

  // Cancel pending or active requests for a specific chunk
  cancelJob(chunkX, chunkZ, kind = 'near') {
    this.cancelRequests((x, z) => x === chunkX && z === chunkZ, kind);
  }

  // Cancel pending or active requests of one kind matching a predicate
  cancelRequests(predicate, kind = 'near') {
    const matches = (job) =>
      job.kind === kind && predicate(job.payload.chunkX, job.payload.chunkZ);
    this.jobQueue = this.jobQueue.filter((job) => {
      if (matches(job)) {
        job.cancelled = true;
        return false;
      }
      return true;
    });
    for (const job of this.activeJobs.values()) {
      if (matches(job)) job.cancelled = true;
    }
  }
}

export const terrainWorkerManager = new TerrainWorkerManager();
