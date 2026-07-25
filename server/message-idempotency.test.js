import assert from "node:assert/strict";
import test from "node:test";
import { MessageIdempotency, trimSetToRecent } from "./message-idempotency.js";

test("skips a message for 24 hours only after successful processing", async () => {
  let now = 1000;
  let calls = 0;
  const store = new MessageIdempotency({ now: () => now });

  const first = await store.run("message-1", async () => ++calls);
  const duplicate = await store.run("message-1", async () => ++calls);
  assert.equal(first.skipped, false);
  assert.equal(duplicate.skipped, true);
  assert.equal(duplicate.status, "success");
  assert.equal(calls, 1);

  now += 24 * 60 * 60 * 1000 + 1;
  const afterExpiry = await store.run("message-1", async () => ++calls);
  assert.equal(afterExpiry.skipped, false);
  assert.equal(calls, 2);
});

test("releases the message immediately after a failed handler", async () => {
  let attempts = 0;
  const store = new MessageIdempotency();
  await assert.rejects(
    store.run("message-failed", async () => {
      attempts += 1;
      throw new Error("temporary failure");
    }),
    /temporary failure/,
  );

  const retry = await store.run("message-failed", async () => ++attempts);
  assert.equal(retry.skipped, false);
  assert.equal(attempts, 2);
});

test("blocks a simultaneous duplicate while the first message is processing", async () => {
  let release;
  let markStarted;
  let calls = 0;
  const store = new MessageIdempotency();
  const started = new Promise((resolve) => { markStarted = resolve; });
  const first = store.run("message-processing", async () => {
    calls += 1;
    markStarted();
    await new Promise((resolve) => { release = resolve; });
  });
  await started;

  const duplicate = await store.run("message-processing", async () => {
    calls += 1;
  });
  assert.equal(duplicate.skipped, true);
  assert.equal(duplicate.status, "processing");
  assert.equal(calls, 1);
  release();
  await first;
});

test("treats a manually resent message with a new ID as a new operation", async () => {
  let calls = 0;
  const store = new MessageIdempotency();
  await store.run("message-original", async () => ++calls);
  await store.run("message-resent", async () => ++calls);
  assert.equal(calls, 2);
});

test("trims an insertion-ordered set to its most recent values", () => {
  const values = new Set(["old-1", "old-2", "recent-1", "recent-2"]);
  trimSetToRecent(values, 2);
  assert.deepEqual([...values], ["recent-1", "recent-2"]);
});
