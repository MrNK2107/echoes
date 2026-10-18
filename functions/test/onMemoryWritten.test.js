const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPlaceAggregate, toDate } = require("../onMemoryWritten");

const now = new Date("2026-10-18T09:00:00.000Z");
const mem = (over = {}) => ({
  privacy: "public",
  isDeleted: false,
  sentiment: { compound: 0.8 },
  createdAt: now,
  ...over,
});

test("buildPlaceAggregate counts live and live-public memories", () => {
  const r = buildPlaceAggregate(
    [
      mem(),
      mem({ privacy: "private" }),
      mem({ isDeleted: true }),
      mem({ privacy: "private", isDeleted: true }),
    ],
    now,
  );
  assert.equal(r.memoryCount, 2);
  assert.equal(r.publicMemoryCount, 1);
  assert.equal(r.updatedAt, now.toISOString());
});

test("aura uses only non-deleted public memories", () => {
  const r = buildPlaceAggregate(
    [mem({ sentiment: { compound: 0.8 } }), mem({ privacy: "private", sentiment: { compound: -0.9 } })],
    now,
  );
  assert.equal(r.aura.memoryCount, 1);
  assert.equal(r.aura.dominantSentiment, "positive");
});

test("empty place yields neutral aura", () => {
  const r = buildPlaceAggregate([], now);
  assert.equal(r.aura.dominantSentiment, "neutral");
  assert.equal(r.memoryCount, 0);
});

test("toDate handles Timestamp-like, ISO string, Date", () => {
  assert.equal(toDate(now).getTime(), now.getTime());
  assert.equal(toDate(now.toISOString()).getTime(), now.getTime());
  assert.equal(toDate({ toDate: () => now }).getTime(), now.getTime());
});
