import assert from "node:assert/strict";
import test from "node:test";
import { MemoryCache } from "./feishu-cache.js";

test("reuses a cached value until its TTL expires", async () => {
  let now = 1000;
  let loads = 0;
  const cache = new MemoryCache({ now: () => now });
  const load = () => cache.get("records:board", {
    ttlMs: 50,
    loader: async () => {
      loads += 1;
      return [`load-${loads}`];
    },
  });

  assert.deepEqual(await load(), ["load-1"]);
  assert.deepEqual(await load(), ["load-1"]);
  assert.equal(loads, 1);

  now += 51;
  assert.deepEqual(await load(), ["load-2"]);
  assert.equal(loads, 2);
});

test("shares one in-flight load between concurrent callers", async () => {
  let release;
  let loads = 0;
  const cache = new MemoryCache();
  const loader = async () => {
    loads += 1;
    await new Promise((resolve) => { release = resolve; });
    return "ready";
  };

  const first = cache.get("fields:board", { ttlMs: 1000, loader });
  const second = cache.get("fields:board", { ttlMs: 1000, loader });
  release();

  assert.equal(await first, "ready");
  assert.equal(await second, "ready");
  assert.equal(loads, 1);
  assert.equal(cache.snapshot().sharedLoads, 1);
});

test("does not repopulate an entry invalidated during loading", async () => {
  let release;
  const cache = new MemoryCache();
  const pending = cache.get("records:paint", {
    ttlMs: 1000,
    loader: async () => {
      await new Promise((resolve) => { release = resolve; });
      return "stale";
    },
  });

  cache.invalidatePrefix("records:paint");
  release();
  assert.equal(await pending, "stale");
  assert.equal(cache.snapshot().entries, 0);
});

test("does not cache loader failures", async () => {
  let loads = 0;
  const cache = new MemoryCache();
  const load = () => cache.get("token", {
    ttlMs: 1000,
    loader: async () => {
      loads += 1;
      if (loads === 1) throw new Error("temporary failure");
      return "token";
    },
  });

  await assert.rejects(load, /temporary failure/);
  assert.equal(await load(), "token");
  assert.equal(loads, 2);
});
