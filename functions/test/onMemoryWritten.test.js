const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPlaceAggregate, memoryFromData, toDate } = require("../onMemoryWritten");

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

/** A place that vanishes between the existence check and the write (e.g. a reset). */
function vanishingPlaceDb() {
  const writes = [];
  const notFound = Object.assign(new Error("NOT_FOUND"), { code: 5 });
  const placeRef = {
    async get() { return { exists: true }; },
    async set(data, opts) { writes.push({ op: "set", data, opts }); },
    async update() { throw notFound; },
    collection: () => ({ add: async (d) => { writes.push({ op: "history", d }); } }),
  };
  return {
    writes,
    collection(name) {
      if (name === "places") return { doc: () => placeRef };
      return { where: () => ({ get: async () => ({ docs: [] }) }) };
    },
  };
}

test("recomputePlace never recreates a place that disappeared mid-recompute", async () => {
  const { recomputePlace } = require("../onMemoryWritten");
  const db = vanishingPlaceDb();
  await recomputePlace(db, "gone", now);
  assert.deepEqual(db.writes, []);
});

test("memoryFromData clamps compound sentiment to [-1, 1]", () => {
  const compound = (value) => memoryFromData({ sentiment: { compound: value } }).sentiment.compound;
  assert.equal(compound(1e9), 1);
  assert.equal(compound(-1e9), -1);
  assert.equal(compound(0.4), 0.4);
});

test("memoryFromData maps non-numeric sentiment to 0", () => {
  const compound = (value) => memoryFromData({ sentiment: { compound: value } }).sentiment.compound;
  assert.equal(compound(NaN), 0);
  assert.equal(compound("abc"), 0);
  assert.equal(compound(undefined), 0);
  assert.equal(memoryFromData({}).sentiment.compound, 0);
});

test("one out-of-range memory cannot dominate the aura", () => {
  const r = buildPlaceAggregate(
    [
      memoryFromData({ privacy: "public", sentiment: { compound: -1e9 }, createdAt: now }),
      memoryFromData({ privacy: "public", sentiment: { compound: 0.9 }, createdAt: now }),
      memoryFromData({ privacy: "public", sentiment: { compound: 0.9 }, createdAt: now }),
    ],
    now,
  );
  assert.ok(r.aura.compoundScore >= -1 && r.aura.compoundScore <= 1);
  assert.ok(r.aura.compoundScore > 0);
});
