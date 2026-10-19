const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler } = require("../lib/callable");
const { definitions } = require("../communities");
const { handleMemoryWrite } = require("../onMemoryWritten");
const {
  isShardedCommunity,
  SHARDS,
  LOOKBACK_MS,
  incrementMemberCount,
  rollupHandler,
} = require("../memberCounts");

const now = new Date("2026-10-19T09:00:00.000Z");
const minutesAgo = (m) => new Date(now.getTime() - m * 60 * 1000);

const call = (db, name, uid, data) => {
  const def = definitions[name];
  return buildHandler({ name, ...def }, def.handler, () => db)({ auth: { uid }, data });
};

const seed = (extra = {}) =>
  createFakeFirestore({
    "users/alice": { communityIds: [] },
    "users/bob": { communityIds: [] },
    "users/carol": { communityIds: [] },
    ...extra,
  });

const shards = (db, id) => db._list(`communities/${id}/counterShards/`).map((p) => db._get(p));
const shardTotal = (db, id) => shards(db, id).reduce((s, d) => s + d.count, 0);

test("isShardedCommunity matches only time-* and era-* ids", () => {
  assert.equal(SHARDS, 10);
  assert.equal(isShardedCommunity("time-2026"), true);
  assert.equal(isShardedCommunity("era-2020s"), true);
  for (const id of ["geo-p1", "inst-x", "abc", "times-1", "xtime-1", ""]) {
    assert.equal(isShardedCommunity(id), false, id);
  }
});

test("incrementMemberCount writes shard floor(rand*10) for sharded ids and never the community doc", async () => {
  const db = seed({ "communities/time-2026": { memberCount: 5 } });
  const batch = db.batch();
  incrementMemberCount(batch, db.doc("communities/time-2026"), 1, () => 0.37);
  incrementMemberCount(batch, db.doc("communities/time-2026"), 1, () => 0.39);
  incrementMemberCount(batch, db.doc("communities/time-2026"), -1, () => 0.999);
  await batch.commit();
  assert.equal(db._get("communities/time-2026").memberCount, 5);
  assert.equal(db._get("communities/time-2026/counterShards/3").count, 2);
  assert.equal(db._get("communities/time-2026/counterShards/9").count, -1);
  assert.ok(db._get("communities/time-2026/counterShards/3").updatedAt instanceof Date);
});

test("incrementMemberCount increments memberCount directly for other communities, in a transaction too", async () => {
  const db = seed({ "communities/walk": { memberCount: 1 } });
  await db.runTransaction(async (tx) => {
    incrementMemberCount(tx, db.doc("communities/walk"), 1);
  });
  assert.equal(db._get("communities/walk").memberCount, 2);
  assert.equal(db._list("communities/walk/counterShards/").length, 0);
});

test("the year-community auto-join writes a shard, not the community doc", async () => {
  const db = seed();
  const after = {
    userId: "alice", placeId: null, privacy: "public", isDeleted: false,
    sentiment: { compound: 0 }, createdAt: "2024-05-01T10:00:00.000Z",
  };
  db._put("memories/m1", after);
  await handleMemoryWrite(db, { memoryId: "m1", before: null, after }, now);
  assert.equal(db._get("communities/time-2024").memberCount, 0);
  assert.equal(shardTotal(db, "time-2024"), 1);
  assert.ok(db._get("communities/time-2024/members/alice"));
});

test("join and leave on time-2026 use shards; on a thematic community they increment directly", async () => {
  const db = seed({
    "communities/time-2026": { name: "2026", ownerId: "system", memberCount: 4 },
  });
  await call(db, "joinCommunity", "bob", { communityId: "time-2026" });
  assert.equal(db._get("communities/time-2026").memberCount, 4);
  assert.equal(shardTotal(db, "time-2026"), 1);
  await call(db, "leaveCommunity", "bob", { communityId: "time-2026" });
  assert.equal(db._get("communities/time-2026").memberCount, 4);
  assert.equal(shardTotal(db, "time-2026"), 0);
  assert.ok(shards(db, "time-2026").length >= 1);

  const { id } = await call(db, "createCommunity", "alice", { name: "Walkers", description: "Walk" });
  await call(db, "joinCommunity", "bob", { communityId: id });
  assert.equal(db._get(`communities/${id}`).memberCount, 2);
  assert.equal(db._list(`communities/${id}/counterShards/`).length, 0);
  await call(db, "leaveCommunity", "bob", { communityId: id });
  assert.equal(db._get(`communities/${id}`).memberCount, 1);
});

test("account-deletion cleanup of a sharded membership writes a shard, not memberCount", async () => {
  const { cleanupUserCommunities } = require("../communities");
  const db = seed({ "communities/time-2026": { name: "2026", ownerId: "system", memberCount: 4 } });
  await call(db, "joinCommunity", "bob", { communityId: "time-2026" });
  await cleanupUserCommunities(db, "bob");
  assert.equal(db._get("communities/time-2026/members/bob"), undefined);
  assert.equal(db._get("communities/time-2026").memberCount, 4);
  assert.equal(shardTotal(db, "time-2026"), 0);
  await rollupHandler(db, new Date());
  assert.equal(db._get("communities/time-2026").memberCount, 0);
});

test("rollup sets memberCount to the members count of communities whose shards changed", async () => {
  const db = seed({ "communities/time-2026": { memberCount: 40 } });
  for (const u of ["a", "b", "c"]) {
    db._put(`communities/time-2026/members/${u}`, { userId: u, role: "member" });
  }
  db._put("communities/time-2026/counterShards/2", { count: 1, updatedAt: minutesAgo(5) });
  await rollupHandler(db, now);
  assert.equal(db._get("communities/time-2026").memberCount, 3);
});

test("rollup keeps decrements: a leave after the last rollup is reflected, a pre-existing count is not collapsed", async () => {
  const db = seed({ "communities/time-2026": { name: "2026", ownerId: "system", memberCount: 0 } });
  for (const u of ["a", "b", "c", "d"]) {
    db._put(`communities/time-2026/members/${u}`, { userId: u, role: "member" });
  }
  await call(db, "joinCommunity", "bob", { communityId: "time-2026" });
  await rollupHandler(db, new Date());
  assert.equal(db._get("communities/time-2026").memberCount, 5);
  await call(db, "leaveCommunity", "bob", { communityId: "time-2026" });
  await rollupHandler(db, new Date());
  assert.equal(db._get("communities/time-2026").memberCount, 4);
});

test("rollup is idempotent", async () => {
  const db = seed({ "communities/era-2020s": { memberCount: 9 } });
  db._put("communities/era-2020s/members/a", { userId: "a" });
  db._put("communities/era-2020s/members/b", { userId: "b" });
  db._put("communities/era-2020s/counterShards/0", { count: 2, updatedAt: minutesAgo(1) });
  await rollupHandler(db, now);
  const first = db._get("communities/era-2020s");
  await rollupHandler(db, now);
  await rollupHandler(db, now);
  assert.deepEqual(db._get("communities/era-2020s"), first);
  assert.equal(first.memberCount, 2);
});

test("rollup ignores shards older than the look-back window (60 min) and touches nothing else", async () => {
  assert.equal(LOOKBACK_MS, 60 * 60 * 1000);
  const db = seed({
    "communities/time-2020": { memberCount: 77 },
    "communities/time-2026": { memberCount: 77 },
    "communities/walk": { memberCount: 77 },
  });
  db._put("communities/time-2020/members/a", { userId: "a" });
  db._put("communities/time-2026/members/a", { userId: "a" });
  db._put("communities/time-2020/counterShards/1", { count: 1, updatedAt: minutesAgo(61) });
  db._put("communities/time-2026/counterShards/1", { count: 1, updatedAt: minutesAgo(59) });
  await rollupHandler(db, now);
  assert.equal(db._get("communities/time-2020").memberCount, 77);
  assert.equal(db._get("communities/time-2026").memberCount, 1);
  assert.equal(db._get("communities/walk").memberCount, 77);
});

test("rollup pages through shards and skips communities deleted meanwhile", async () => {
  const db = seed();
  for (let i = 0; i < 7; i++) {
    db._put(`communities/time-${2000 + i}`, { memberCount: 0 });
    db._put(`communities/time-${2000 + i}/members/a`, { userId: "a" });
    db._put(`communities/time-${2000 + i}/counterShards/0`, { count: 1, updatedAt: minutesAgo(i + 1) });
  }
  db._put("communities/time-1999/counterShards/0", { count: 1, updatedAt: minutesAgo(2) }); // no community doc
  const result = await rollupHandler(db, now, { pageSize: 3 });
  for (let i = 0; i < 7; i++) assert.equal(db._get(`communities/time-${2000 + i}`).memberCount, 1);
  assert.equal(db._get("communities/time-1999"), undefined);
  assert.equal(result.communities, 8);
});

// A clock that returns the given readings in order, then the last one forever.
const readings = (...values) => {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
};
const budgetSeed = () => {
  const db = seed();
  for (let i = 0; i < 4; i++) {
    db._put(`communities/time-${2000 + i}`, { memberCount: 0 });
    db._put(`communities/time-${2000 + i}/members/a`, { userId: "a" });
    db._put(`communities/time-${2000 + i}/counterShards/0`, { count: 1, updatedAt: minutesAgo(i + 1) });
  }
  return db;
};

test("rollup stops starting new pages once the budget is spent", async () => {
  const db = budgetSeed();
  // start, two community checks, then the page check is over budget.
  const result = await rollupHandler(db, now, { pageSize: 2, budgetMs: 10, clock: readings(0, 0, 0, 100) });
  assert.equal(result.communities, 2);
});

test("rollup checks the budget before each community recount, not only between pages", async () => {
  const db = budgetSeed();
  const result = await rollupHandler(db, now, { pageSize: 100, budgetMs: 10, clock: readings(0, 0, 100) });
  assert.equal(result.communities, 1);
  const counts = [0, 1, 2, 3].map((i) => db._get(`communities/time-${2000 + i}`).memberCount);
  assert.equal(counts.filter((c) => c === 1).length, 1);
});
