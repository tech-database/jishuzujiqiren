export class MemoryCache {
  constructor({ maxEntries = 200, now = () => Date.now() } = {}) {
    this.entries = new Map();
    this.maxEntries = maxEntries;
    this.now = now;
    this.metrics = {
      hits: 0,
      misses: 0,
      sharedLoads: 0,
      loads: 0,
      invalidations: 0,
    };
  }

  pruneExpired() {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (!entry.promise && entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  enforceLimit() {
    this.pruneExpired();
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  async get(key, { ttlMs, loader }) {
    const existing = this.entries.get(key);
    const now = this.now();
    if (existing?.value !== undefined && existing.expiresAt > now) {
      this.metrics.hits += 1;
      return existing.value;
    }
    if (existing?.promise) {
      this.metrics.sharedLoads += 1;
      return existing.promise;
    }

    this.metrics.misses += 1;
    this.metrics.loads += 1;
    this.enforceLimit();

    let promise;
    promise = (async () => {
      try {
        const value = await loader();
        const current = this.entries.get(key);
        if (current?.promise === promise) {
          this.entries.delete(key);
          this.entries.set(key, {
            value,
            expiresAt: this.now() + Math.max(0, Number(ttlMs) || 0),
            promise: null,
          });
        }
        return value;
      } catch (error) {
        if (this.entries.get(key)?.promise === promise) this.entries.delete(key);
        throw error;
      }
    })();

    this.entries.set(key, { value: undefined, expiresAt: 0, promise });
    return promise;
  }

  invalidatePrefix(prefix) {
    let removed = 0;
    for (const key of [...this.entries.keys()]) {
      if (!key.startsWith(prefix)) continue;
      this.entries.delete(key);
      removed += 1;
    }
    if (removed > 0) this.metrics.invalidations += removed;
    return removed;
  }

  clear() {
    const removed = this.entries.size;
    this.entries.clear();
    if (removed > 0) this.metrics.invalidations += removed;
    return removed;
  }

  snapshot() {
    this.pruneExpired();
    return {
      entries: this.entries.size,
      ...this.metrics,
    };
  }
}

export const feishuCache = new MemoryCache();

export const feishuCacheTtl = Object.freeze({
  token: 90 * 60 * 1000,
  fields: 10 * 60 * 1000,
  records: 5 * 1000,
});
