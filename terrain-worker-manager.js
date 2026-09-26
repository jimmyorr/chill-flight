// terrain-worker-manager.js
// Phase 1: Worker Pool Manager

class TerrainWorkerManager {
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
        const worker = new Worker('./terrain-worker.js');
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
      if (status === 'success') {
        job.resolve(data);
      } else {
        job.reject(new Error(error || 'Worker job failed'));
      }
      this.activeJobs.delete(id);
    }

    // Recycle worker
    this.idleWorkers.push(worker);
    this._processQueue();
  }

  _handleError(worker, err) {
    console.error('Terrain worker error:', err);
    // Try to find the job associated with this worker (difficult without ID, but we can fail all or something if needed)
    // For now, just recycle and let timeouts or next messages handle it.
  }

  _processQueue() {
    if (this.jobQueue.length === 0 || this.idleWorkers.length === 0) {
      return;
    }

    // Sort queue by priority? (Phase 5)
    // For now, FIFO
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
        segments: options.segments || 64, // Default SEGMENTS
        chunkSize: options.chunkSize || 600, // Default CHUNK_SIZE
        worldSeed: options.worldSeed || 1,
        waterLevel: options.waterLevel || 0,
        theme: options.theme || 'default',
        options: {
          enableObjects: options.enableObjects !== false,
        },
      };

      const job = {
        id: jobId,
        payload,
        transferables: options.transferables || [],
        resolve,
        reject,
      };

      this.jobQueue.push(job);
      this._processQueue();
    });
  }

  // Cancel pending requests for chunks that are no longer needed
  cancelRequests(predicate) {
    this.jobQueue = this.jobQueue.filter(
      (job) => !predicate(job.payload.chunkX, job.payload.chunkZ)
    );
    // Note: Jobs already sent to workers cannot easily be cancelled in Phase 1,
    // we just ignore their results later or implement abort signals in Phase 5.
  }
}

// Export singleton instance if in browser
if (typeof window !== 'undefined') {
  window.terrainWorkerManager = new TerrainWorkerManager();
}
