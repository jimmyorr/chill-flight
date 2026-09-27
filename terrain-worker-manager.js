// terrain-worker-manager.js
// Phase 1: Worker Pool Manager

export class TerrainWorkerManager {
  constructor(workerCount = null) {
    // Determine number of workers based on hardware, bounded between 1 and 4
    this.poolSize =
      workerCount ||
      Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    this.workers = [];
    this.idleWorkers = [];
    this.jobQueue = [];
    this.activeJobs = new Map();
    this.nextJobId = 0;
    this.isSupported =
      typeof window !== 'undefined' && window.Worker !== undefined;

    if (this.isSupported) {
      this._initWorkers();
    } else {
      console.warn(
        'Web Workers are not supported in this environment. Terrain generation will fall back to main thread.'
      );
    }
  }

  _initWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      try {
        // Vite recognizes this pattern and bundles the worker in production.
        const worker = new Worker(
          new URL('./terrain-worker.js', import.meta.url),
          {type: 'module'}
        );
        worker.onmessage = this._handleMessage.bind(this, worker);
        worker.onerror = this._handleError.bind(this, worker);
        this.workers.push(worker);
        this.idleWorkers.push(worker);
      } catch (err) {
        console.error('Failed to initialize terrain worker:', err);
        this.isSupported = false;
        break;
      }
    }
  }

  _handleMessage(worker, e) {
    const data = e.data;
    const {id, status, error} = data;

    const job = this.activeJobs.get(id);
    if (job) {
      if (!job.cancelled) {
        if (status === 'success') {
          job.resolve(data);
        } else {
          job.reject(new Error(error || 'Worker job failed'));
        }
      }
      this.activeJobs.delete(id);
    }

    // Recycle worker
    this.idleWorkers.push(worker);
    this._processQueue();
  }

  _handleError(worker, err) {
    console.error('Terrain worker error:', err);
    // Recycle worker
    this.idleWorkers.push(worker);
    this._processQueue();
  }

  _processQueue() {
    if (this.jobQueue.length === 0 || this.idleWorkers.length === 0) {
      return;
    }

    // Sort queue by priority descending so highest priority chunk is processed first
    if (this.jobQueue.length > 1) {
      this.jobQueue.sort((a, b) => b.priority - a.priority);
    }

    const job = this.jobQueue.shift();
    const worker = this.idleWorkers.pop();

    this.activeJobs.set(job.id, job);

    // Send job to worker
    worker.postMessage(job.payload, job.transferables);
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
        waterLevel: options.waterLevel !== undefined ? options.waterLevel : 40,
        theme: options.theme || 'default',
        options: {
          enableObjects: options.enableObjects !== false,
        },
      };

      const job = {
        id: jobId,
        priority: options.priority !== undefined ? options.priority : 0,
        payload,
        transferables: options.transferables || [],
        resolve,
        reject,
        cancelled: false,
      };

      this.jobQueue.push(job);
      this._processQueue();
    });
  }

  // Update priorities of all pending jobs in the queue
  updatePriorities(scoringFn) {
    for (let i = 0; i < this.jobQueue.length; i++) {
      const job = this.jobQueue[i];
      job.priority = scoringFn(job.payload.chunkX, job.payload.chunkZ);
    }
  }

  // Cancel pending or active requests for a specific chunk
  cancelJob(chunkX, chunkZ) {
    this.jobQueue = this.jobQueue.filter((job) => {
      if (job.payload.chunkX === chunkX && job.payload.chunkZ === chunkZ) {
        job.cancelled = true;
        return false;
      }
      return true;
    });
    for (const job of this.activeJobs.values()) {
      if (job.payload.chunkX === chunkX && job.payload.chunkZ === chunkZ) {
        job.cancelled = true;
      }
    }
  }

  // Cancel pending or active requests matching a predicate
  cancelRequests(predicate) {
    this.jobQueue = this.jobQueue.filter((job) => {
      if (predicate(job.payload.chunkX, job.payload.chunkZ)) {
        job.cancelled = true;
        return false;
      }
      return true;
    });
    for (const job of this.activeJobs.values()) {
      if (predicate(job.payload.chunkX, job.payload.chunkZ)) {
        job.cancelled = true;
      }
    }
  }
}

export const terrainWorkerManager = new TerrainWorkerManager();
