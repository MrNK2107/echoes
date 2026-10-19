const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { handleMemoryWrite, buildPlaceAggregate } = require("../onMemoryWritten");
const { GEO_THRESHOLD } = require("../lib/domain");

const now = new Date("2026-10-19T09:00:00.000Z");
const createdAt = "2026-10-01T10:00:00.000Z";
const memory = (over = {}) => ({
  userId: "alice",
  placeId: "p1",
  privacy: "public",
  isDeleted: false,
  moderation: null,
  sentiment: { compound: 0.5 },
  createdAt,
  ...over,
});
const seed = (extra = {}) =>
  createFakeFirestore({
    "users/alice": { communityIds: [] },
    "places/p1": { name: "Old Mill", custodianIds: ["carol"] },
    ...extra,
  });
const history = (db) => db._list("places/p1/auraHistory/");
const write = (db, before, after, id = "m1") => handleMemoryWrite(db, { memoryId: id, before, after }, now);

test("hidden memories are excluded from every aggregate count", () => {
  const m = (over) => ({ privacy: "public", isDeleted: false, sentiment: { compound: 0.5 }, createdAt: now, ...over });
  const r = buildPlaceAggregate([m(), m({ hidden: true })], now);
  assert.equal(r.memoryCount, 1);
  assert.equal(r.publicMemoryCount, 1);
  assert.equal(r.aura.memoryCount, 1);
});

test("hidden memories do not count toward the geo-community threshold", async () => {
  const db = seed();
  for (let i = 0; i < GEO_THRESHOLD; i++) {
    db._put(`memories/h${i}`, memory({ moderation: i === 0 ? "hidden" : null }));
  }
  await write(db, null, memory(), "h1");
  assert.equal(db._get("places/p1").publicMemoryCount, GEO_THRESHOLD - 1);
  assert.equal(db._get(`communities/geo-p1`), undefined);
});

test("a flag-only or text-only write does not recompute the place", async () => {
  const db = seed();
  const before = memory();
  await write(db, null, before);
  const n = history(db).length;
  const updatedAt = db._get("places/p1").updatedAt;
  await write(db, before, { ...before, flags: { profanity: true } });
  await write(db, before, { ...before, textContent: "edited" });
  assert.equal(history(db).length, n);
  assert.equal(db._get("places/p1").updatedAt, updatedAt);
});

test("a moderation write recomputes once and appends no duplicate history", async () => {
  const db = seed();
  const before = memory({ privacy: "private" });
  db._put("memories/m1", before);
  await write(db, null, before);
  const n = history(db).length;
  const after = { ...before, moderation: "hidden" };
  db._put("memories/m1", after);
  await write(db, before, after);
  assert.equal(db._get("places/p1").memoryCount, 0);
  assert.equal(history(db).length, n); // aura score, dominant sentiment and count unchanged
});

test("a real aura change appends history", async () => {
  const db = seed();
  const before = memory();
  db._put("memories/m1", before);
  await write(db, null, before);
  const n = history(db).length;
  const after = { ...before, sentiment: { compound: -0.9 } };
  db._put("memories/m1", after);
  await write(db, before, after);
  assert.equal(history(db).length, n + 1);
});

test("out-of-range createdAt years create no time communities but still aggregate", async () => {
  for (const bad of ["1850-01-01T00:00:00.000Z", "2999-01-01T00:00:00.000Z"]) {
    const db = seed();
    const after = memory({ createdAt: bad });
    db._put("memories/m1", after);
    await write(db, null, after);
    assert.deepEqual(db._list("communities/"), [], bad);
    assert.equal(db._get("places/p1").memoryCount, 1);
  }
});
