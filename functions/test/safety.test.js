const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler } = require("../lib/callable");
const { definitions } = require("../safety");

const call = (db, uid, data) => {
  const def = definitions.reportMemory;
  return buildHandler({ name: "reportMemory", ...def }, def.handler, () => db)({
    auth: uid ? { uid, token: {} } : undefined,
    data,
  });
};

async function codeOf(p) {
  try {
    await p;
  } catch (e) {
    return e.code;
  }
  return "none";
}

const memory = (over = {}) => ({
  userId: "author",
  placeId: "p1",
  privacy: "public",
  taggedUserIds: [],
  releaseDate: null,
  communityId: null,
  isDeleted: false,
  moderation: null,
  textContent: "hello",
  ...over,
});

const seed = (memories = { m1: memory() }) =>
  createFakeFirestore(Object.fromEntries(Object.entries(memories).map(([id, m]) => [`memories/${id}`, m])));

const reportsOf = (db) => db._list("reports/").map((p) => db._get(p));

test("reportMemory stores one report per reporter with a deterministic id", async () => {
  const db = seed();
  const res = await call(db, "r1", { memoryId: "m1", reason: "spam", note: "  buy stuff  " });
  assert.deepEqual(res, {});
  const r = db._get("reports/m1_r1");
  assert.equal(r.memoryId, "m1");
  assert.equal(r.reporterId, "r1");
  assert.equal(r.reason, "spam");
  assert.equal(r.note, "buy stuff");
  assert.equal(typeof r.createdAt, "string");
  await call(db, "r2", { memoryId: "m1", reason: "other" });
  assert.equal(db._get("reports/m1_r2").note, null);
  assert.equal(db._get("memories/m1").moderation, null);
});

test("reportMemory validates reason and note", async () => {
  const db = seed();
  for (const data of [
    { memoryId: "m1" },
    { memoryId: "m1", reason: "rude" },
    { memoryId: "m1", reason: "spam", note: "x".repeat(281) },
    { memoryId: "m1", reason: "spam", note: 5 },
    { memoryId: "a/b", reason: "spam" },
    { memoryId: "m1", reason: "spam", extra: true },
  ]) {
    assert.equal(await codeOf(call(db, "r1", data)), "invalid-argument", JSON.stringify(data));
  }
  assert.equal(await codeOf(call(db, null, { memoryId: "m1", reason: "spam" })), "unauthenticated");
  for (const reason of ["spam", "harassment", "hate", "sexual", "violence", "other"]) {
    await call(createFakeFirestore({ "memories/m1": memory() }), "r1", { memoryId: "m1", reason });
  }
  assert.deepEqual(reportsOf(db), []);
});

test("three distinct reporters hide once", async () => {
  const db = seed();
  await call(db, "r1", { memoryId: "m1", reason: "spam" });
  await call(db, "r2", { memoryId: "m1", reason: "hate" });
  assert.equal(db._get("memories/m1").moderation, null);
  await call(db, "r3", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, "hidden");
  assert.equal(reportsOf(db).length, 3);
  // Staff restore by clearing the field; later reports (the memory is visible again) do not
  // re-hide it: the hide happens exactly at the third distinct reporter.
  db._put("memories/m1", { ...db._get("memories/m1"), moderation: null });
  await call(db, "r4", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, null);
  assert.equal(reportsOf(db).length, 4);
});

test("duplicate reporter does not count", async () => {
  const db = seed();
  await call(db, "r1", { memoryId: "m1", reason: "spam" });
  assert.equal(await codeOf(call(db, "r1", { memoryId: "m1", reason: "hate" })), "already-exists");
  assert.equal(await codeOf(call(db, "r1", { memoryId: "m1", reason: "spam" })), "already-exists");
  await call(db, "r2", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, null);
  assert.equal(reportsOf(db).length, 2);
  assert.equal(db._get("reports/m1_r1").reason, "spam");
  await call(db, "r3", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, "hidden");
});

test("reports on other memories do not count toward this one", async () => {
  const db = seed({ m1: memory(), m2: memory() });
  await call(db, "r1", { memoryId: "m2", reason: "spam" });
  await call(db, "r2", { memoryId: "m2", reason: "spam" });
  await call(db, "r3", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, null);
  assert.equal(db._get("memories/m2").moderation, null);
});

test("a reporter can't report their own memory", async () => {
  const db = seed();
  assert.equal(await codeOf(call(db, "author", { memoryId: "m1", reason: "spam" })), "failed-precondition");
  assert.deepEqual(reportsOf(db), []);
});

test("a reporter can't report a memory not visible to them", async () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const db = seed({
    priv: memory({ privacy: "private" }),
    tagged: memory({ privacy: "tagged", taggedUserIds: ["friend"] }),
    later: memory({ privacy: "timeRelease", releaseDate: future }),
    comm: memory({ privacy: "community", communityId: "c1" }),
    gone: memory({ isDeleted: true }),
    hidden: memory({ moderation: "hidden" }),
  });
  db._put("communities/c1/members/member", { userId: "member", role: "member" });
  for (const memoryId of ["priv", "tagged", "later", "comm", "gone", "hidden", "missing"]) {
    assert.equal(await codeOf(call(db, "r1", { memoryId, reason: "spam" })), "failed-precondition", memoryId);
  }
  assert.deepEqual(reportsOf(db), []);
  // The same memories are reportable by viewers who can see them.
  await call(db, "friend", { memoryId: "tagged", reason: "spam" });
  await call(db, "member", { memoryId: "comm", reason: "spam" });
  assert.equal(reportsOf(db).length, 2);
});

test("reportMemory is rate limited to 20 per day", async () => {
  const memories = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`m${i}`, memory()]));
  const db = seed(memories);
  for (let i = 0; i < 20; i++) await call(db, "r1", { memoryId: `m${i}`, reason: "spam" });
  assert.equal(await codeOf(call(db, "r1", { memoryId: "m20", reason: "spam" })), "resource-exhausted");
  assert.equal(reportsOf(db).length, 20);
});
