const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { handleMemoryWrite } = require("../onMemoryWritten");
const { GEO_THRESHOLD } = require("../lib/domain");

const now = new Date("2026-10-19T09:00:00.000Z");
const memCreatedAt = "2024-05-01T10:00:00.000Z";

const seed = (extra = {}) =>
  createFakeFirestore({
    "users/alice": { communityIds: [] },
    "users/bob": { communityIds: [] },
    "places/p1": { name: "Old Mill", custodianIds: ["carol", "dave"] },
    ...extra,
  });

let n = 0;
const memory = (over = {}) => ({
  userId: "alice",
  placeId: "p1",
  privacy: "public",
  isDeleted: false,
  sentiment: { compound: 0.5 },
  createdAt: memCreatedAt,
  ...over,
});

// Writes a memory doc and runs the trigger core like a create event would.
async function createMemory(db, over = {}) {
  const id = `m${++n}`;
  const after = memory(over);
  db._put(`memories/${id}`, after);
  await handleMemoryWrite(db, { memoryId: id, before: null, after }, now);
  return { id, after };
}

test("a created memory ensures its year and era communities and joins the author to the year", async () => {
  const db = seed();
  await createMemory(db);
  const year = db._get("communities/time-2024");
  assert.equal(year.name, "2024 Memories");
  assert.equal(year.type, "timeBased");
  assert.equal(year.ownerId, "alice");
  assert.equal(year.placeId, null);
  assert.equal(year.institutionId, null);
  assert.equal(year.memberCount, 1);
  assert.equal(typeof year.description, "string");
  assert.equal(year.createdAt, now.toISOString());
  const era = db._get("communities/era-2020s");
  assert.equal(era.name, "2020s Era");
  assert.equal(era.type, "timeBased");
  assert.equal(era.ownerId, "alice");
  assert.equal(era.memberCount, 0);
  const m = db._get("communities/time-2024/members/alice");
  assert.deepEqual(m, { userId: "alice", role: "owner", joinedAt: now.toISOString() });
  assert.deepEqual(db._get("users/alice").communityIds, ["time-2024"]);
  assert.equal(db._list("communities/era-2020s/members/").length, 0);
});

test("auto communities are created once over repeated triggers", async () => {
  const db = seed();
  const { id, after } = await createMemory(db);
  await handleMemoryWrite(db, { memoryId: id, before: null, after }, now); // retried delivery
  await createMemory(db);
  await createMemory(db, { userId: "bob" });
  await createMemory(db, { userId: "bob" });
  const year = db._get("communities/time-2024");
  assert.equal(year.ownerId, "alice");
  assert.equal(year.memberCount, 2);
  assert.equal(db._get("communities/time-2024/members/bob").role, "member");
  assert.equal(db._get("communities/era-2020s").ownerId, "alice");
  assert.deepEqual(db._get("users/alice").communityIds, ["time-2024"]);
  assert.deepEqual(db._get("users/bob").communityIds, ["time-2024"]);
  assert.deepEqual(
    db._list("communities/").filter((p) => p.split("/").length === 2).sort(),
    ["communities/era-2020s", "communities/time-2024"],
  );
});

test("updates and deletes do not create time communities", async () => {
  const db = seed();
  const after = memory();
  db._put("memories/m-upd", after);
  await handleMemoryWrite(db, { memoryId: "m-upd", before: after, after: { ...after, title: "x" } }, now);
  await handleMemoryWrite(db, { memoryId: "m-upd", before: after, after: null }, now);
  assert.equal(db._get("communities/time-2024"), undefined);
});

test("a missing author profile doc is not recreated by the auto-join", async () => {
  const db = seed();
  await createMemory(db, { userId: "zed" });
  assert.equal(db._get("users/zed"), undefined);
  assert.equal(db._get("communities/time-2024/members/zed").role, "owner");
});

test("geo community is created at exactly GEO_THRESHOLD public memories, once", async () => {
  assert.equal(GEO_THRESHOLD, 5);
  const db = seed();
  for (let i = 0; i < 4; i++) await createMemory(db);
  await createMemory(db, { privacy: "private" });
  assert.equal(db._get("places/p1").publicMemoryCount, 4);
  assert.equal(db._get("communities/geo-p1"), undefined);
  assert.equal(db._get("places/p1").communityId, undefined);

  await createMemory(db);
  assert.equal(db._get("places/p1").publicMemoryCount, 5);
  const geo = db._get("communities/geo-p1");
  assert.equal(geo.name, "Old Mill Circle");
  assert.equal(geo.type, "geographic");
  assert.equal(geo.ownerId, "carol");
  assert.equal(geo.placeId, "p1");
  assert.equal(geo.institutionId, null);
  assert.equal(geo.memberCount, 0);
  assert.equal(db._get("places/p1").communityId, "geo-p1");

  db._put("communities/geo-p1", { ...geo, memberCount: 7 }); // later activity
  await createMemory(db);
  assert.equal(db._get("communities/geo-p1").memberCount, 7);
  assert.equal(db._get("communities/geo-p1").createdAt, geo.createdAt);
});

test("geo community falls back to the author when the place has no custodian", async () => {
  const db = seed({ "places/p1": { name: "Old Mill", custodianIds: [] } });
  for (let i = 0; i < GEO_THRESHOLD; i++) await createMemory(db);
  assert.equal(db._get("communities/geo-p1").ownerId, "alice");
});

test("an existing geo community is relinked to its place without being rewritten", async () => {
  const db = seed({ "communities/geo-p1": { name: "Renamed", memberCount: 3 } });
  for (let i = 0; i < GEO_THRESHOLD; i++) await createMemory(db);
  assert.deepEqual(db._get("communities/geo-p1"), { name: "Renamed", memberCount: 3 });
  assert.equal(db._get("places/p1").communityId, "geo-p1");
});

test("fake batches are atomic: a failed create rolls back the batch", async () => {
  const db = createFakeFirestore({ "a/1": { v: 1 } });
  const b = db.batch();
  b.set(db.doc("a/2"), { v: 2 });
  b.create(db.doc("a/1"), { v: 9 });
  await assert.rejects(b.commit(), (e) => e.code === 6);
  assert.equal(db._get("a/2"), undefined);
  assert.deepEqual(db._get("a/1"), { v: 1 });
});

test("time communities are ensured without transactions (emulator resets abort on open ones)", async () => {
  const db = seed();
  db.runTransaction = async () => {
    throw new Error("transactions not allowed in the memory trigger");
  };
  await createMemory(db);
  for (let i = 0; i < GEO_THRESHOLD; i++) await createMemory(db, { userId: "bob" });
  assert.equal(db._get("communities/time-2024").memberCount, 2);
  assert.equal(db._get("places/p1").communityId, "geo-p1");
});

test("the era owner joining their own era community gets role owner", async () => {
  const { definitions } = require("../communities");
  const { buildHandler } = require("../lib/callable");
  const db = seed();
  await createMemory(db);
  const def = definitions.joinCommunity;
  await buildHandler({ name: "joinCommunity", ...def }, def.handler, () => db)({
    auth: { uid: "alice" },
    data: { communityId: "era-2020s" },
  });
  assert.equal(db._get("communities/era-2020s/members/alice").role, "owner");
  assert.equal(db._get("communities/era-2020s").memberCount, 1);
});
