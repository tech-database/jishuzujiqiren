export const messageIdempotencyTtl = Object.freeze({
  processing: 2 * 60 * 1000,
  success: 24 * 60 * 60 * 1000,
});

export function trimSetToRecent(values, limit) {
  const maximum = Math.max(0, Number(limit) || 0);
  let excess = values.size - maximum;
  if (excess <= 0) return values;
  for (const value of values) {
    values.delete(value);
    excess -= 1;
    if (excess <= 0) break;
  }
  return values;
}

export class MessageIdempotency {
  constructor({
    now = () => Date.now(),
    onChange = async () => {},
    onPersistError = () => {},
    processingTtlMs = messageIdempotencyTtl.processing,
    successTtlMs = messageIdempotencyTtl.success,
  } = {}) {
    this.now = now;
    this.onChange = onChange;
    this.onPersistError = onPersistError;
    this.processingTtlMs = processingTtlMs;
    this.successTtlMs = successTtlMs;
    this.states = new Map();
    this.persistQueue = Promise.resolve();
  }

  restore(entries = []) {
    this.states.clear();
    const now = this.now();
    for (const entry of entries) {
      const id = String(entry?.id || "").trim();
      const status = entry?.status === "success" ? "success" : "processing";
      const expiresAt = Number(entry?.expiresAt || 0);
      if (id && expiresAt > now) this.states.set(id, { status, expiresAt });
    }
  }

  prune() {
    const now = this.now();
    for (const [id, state] of this.states) {
      if (state.expiresAt <= now) this.states.delete(id);
    }
  }

  snapshot() {
    this.prune();
    return [...this.states.entries()].map(([id, state]) => ({ id, ...state }));
  }

  async persist() {
    this.persistQueue = this.persistQueue
      .catch(() => {})
      .then(() => this.onChange(this.snapshot()))
      .catch((error) => {
        this.onPersistError(error);
      });
    await this.persistQueue;
  }

  async run(messageId, handler) {
    const id = String(messageId || "").trim();
    if (!id) return { skipped: false, status: "untracked", result: await handler() };

    this.prune();
    const existing = this.states.get(id);
    if (existing) return { skipped: true, status: existing.status };

    this.states.set(id, {
      status: "processing",
      expiresAt: this.now() + this.processingTtlMs,
    });
    await this.persist();

    try {
      const result = await handler();
      this.states.set(id, {
        status: "success",
        expiresAt: this.now() + this.successTtlMs,
      });
      await this.persist();
      return { skipped: false, status: "success", result };
    } catch (error) {
      this.states.delete(id);
      await this.persist();
      throw error;
    }
  }
}
