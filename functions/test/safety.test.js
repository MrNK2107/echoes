const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler } = require("../lib/callable");
const { definitions } = require("../safety");

// Reporters are verified by default (their ID token's email_verified); pass false for unverified.
const call = (db, uid, data, verified = true) => {
  const def = definitions.reportMemory;
  return buildHandler({ name: "reportMemory", ...def }, def.handler, () => db)({
    auth: uid ? { uid, token: { email_verified: verified } } : undefined,
    data,
  });
};

const callContent = (db, uid, data, verified = true) => {
  const def = definitions.reportContent;
  return buildHandler({ name: "reportContent", ...def }, def.handler, () => db)({
    auth: uid ? { uid, token: { email_verified: verified } } : undefined,
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

test("unverified reporters never hide", async () => {
  const db = seed();
  for (const r of ["u1", "u2", "u3"]) await call(db, r, { memoryId: "m1", reason: "spam" }, false);
  assert.equal(db._get("memories/m1").moderation, null);
  for (const r of ["u1", "u2", "u3"]) assert.equal(db._get(`reports/m1_${r}`).reporterVerified, false);
});

test("a missing email_verified claim counts as unverified", async () => {
  const db = seed();
  const def = definitions.reportMemory;
  const h = buildHandler({ name: "reportMemory", ...def }, def.handler, () => db);
  await h({ auth: { uid: "x1", token: {} }, data: { memoryId: "m1", reason: "spam" } });
  assert.equal(db._get("reports/m1_x1").reporterVerified, false);
});

test("2 unverified plus 3 verified reports hide on the third verified one, once", async () => {
  const db = seed();
  await call(db, "u1", { memoryId: "m1", reason: "spam" }, false);
  await call(db, "u2", { memoryId: "m1", reason: "spam" }, false);
  await call(db, "v1", { memoryId: "m1", reason: "spam" });
  await call(db, "v2", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, null);
  await call(db, "v3", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, "hidden");
  assert.equal(db._get("reports/m1_v3").reporterVerified, true);
  db._put("memories/m1", { ...db._get("memories/m1"), moderation: null });
  await call(db, "v4", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, null);
});

test("legacy report docs without reporterVerified never count", async () => {
  const db = seed();
  db._put("reports/m1_old1", { memoryId: "m1", reporterId: "old1", reason: "spam", note: null, createdAt: "x" });
  db._put("reports/m1_old2", { memoryId: "m1", reporterId: "old2", reason: "spam", note: null, createdAt: "x" });
  await call(db, "v1", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, null);
  await call(db, "v2", { memoryId: "m1", reason: "spam" });
  await call(db, "v3", { memoryId: "m1", reason: "spam" });
  assert.equal(db._get("memories/m1").moderation, "hidden");
});

const seedContent = () =>
  createFakeFirestore({
    "communities/c1": { name: "Town" },
    "publicProfiles/p1": { displayName: "Asha" },
    "publicProfiles/r1": { displayName: "Reporter" },
  });

test("reportContent writes the community and profile report shapes", async () => {
  const db = seedContent();
  assert.deepEqual(
    await callContent(db, "r1", { targetType: "community", targetId: "c1", reason: "spam", note: " bad " }),
    {},
  );
  const c = db._get("reports/community_c1_r1");
  assert.deepEqual(
    Object.keys(c).sort(),
    ["createdAt", "note", "reason", "reporterId", "reporterVerified", "targetId", "targetType"],
  );
  assert.equal(c.targetType, "community");
  assert.equal(c.targetId, "c1");
  assert.equal(c.reporterId, "r1");
  assert.equal(c.reporterVerified, true);
  assert.equal(c.reason, "spam");
  assert.equal(c.note, "bad");
  assert.equal(typeof c.createdAt, "string");
  await callContent(db, "r2", { targetType: "profile", targetId: "p1", reason: "hate" }, false);
  const p = db._get("reports/profile_p1_r2");
  assert.equal(p.targetType, "profile");
  assert.equal(p.note, null);
  assert.equal(p.reporterVerified, false);
});

test("reportContent never auto-hides and has no memoryId", async () => {
  const db = seedContent();
  for (const r of ["a", "b", "c", "d"]) {
    await callContent(db, r, { targetType: "community", targetId: "c1", reason: "spam" });
  }
  assert.equal(db._get("communities/c1").moderation, undefined);
  assert.equal(db._get("reports/community_c1_a").memoryId, undefined);
});

test("reportContent rejects duplicates, own profile, missing targets and bad input", async () => {
  const db = seedContent();
  await callContent(db, "r1", { targetType: "community", targetId: "c1", reason: "spam" });
  assert.equal(
    await codeOf(callContent(db, "r1", { targetType: "community", targetId: "c1", reason: "hate" })),
    "already-exists",
  );
  assert.equal(
    await codeOf(callContent(db, "r1", { targetType: "profile", targetId: "r1", reason: "spam" })),
    "failed-precondition",
  );
  assert.equal(
    await codeOf(callContent(db, "r1", { targetType: "community", targetId: "nope", reason: "spam" })),
    "failed-precondition",
  );
  assert.equal(
    await codeOf(callContent(db, "r1", { targetType: "profile", targetId: "nope", reason: "spam" })),
    "failed-precondition",
  );
  for (const data of [
    { targetType: "memory", targetId: "c1", reason: "spam" },
    { targetType: "community", targetId: "a/b", reason: "spam" },
    { targetType: "community", targetId: "c1", reason: "rude" },
    { targetType: "community", targetId: "c1", reason: "spam", note: "x".repeat(281) },
  ]) {
    assert.equal(await codeOf(callContent(db, "r2", data)), "invalid-argument", JSON.stringify(data));
  }
  assert.equal(
    await codeOf(callContent(db, null, { targetType: "community", targetId: "c1", reason: "spam" })),
    "unauthenticated",
  );
  assert.equal(reportsOf(db).length, 1);
});

test("reportContent shares the 20/day reportMemory budget", async () => {
  const profiles = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => [`publicProfiles/t${i}`, { displayName: "x" }]),
  );
  const db = createFakeFirestore({ ...profiles, "communities/c1": { name: "Town" }, "memories/m1": memory() });
  for (let i = 0; i < 19; i++) {
    await callContent(db, "r1", { targetType: "profile", targetId: `t${i}`, reason: "spam" });
  }
  await call(db, "r1", { memoryId: "m1", reason: "spam" });
  assert.equal(
    await codeOf(callContent(db, "r1", { targetType: "community", targetId: "c1", reason: "spam" })),
    "resource-exhausted",
  );
  assert.equal(reportsOf(db).length, 20);
});

test("the hide count reads at most HIDE_AT verified reports", async () => {
  const db = seed();
  for (let i = 0; i < 10; i++) {
    db._put(`reports/m1_old${i}`, { memoryId: "m1", reporterId: `old${i}`, reporterVerified: true, reason: "spam", note: null, createdAt: "x" });
  }
  db._put("reports/m1_unv", { memoryId: "m1", reporterId: "unv", reporterVerified: false, reason: "spam", note: null, createdAt: "x" });
  await call(db, "v1", { memoryId: "m1", reason: "spam" });
  assert.ok(db._stats.queryReads.length > 0);
  assert.ok(Math.max(...db._stats.queryReads) <= 3, `read ${Math.max(...db._stats.queryReads)} reports`);
  assert.equal(db._get("memories/m1").moderation, null);
});

test("a memory already hidden skips counting reports altogether", async () => {
  const db = seed();
  // Hidden memories are not viewable by others, so the hide lands between the visibility check
  // and the transaction's read of the report doc.
  const original = db.runTransaction.bind(db);
  db.runTransaction = (fn) =>
    original((tx) => {
      const get = tx.get;
      tx.get = (ref) => {
        if (ref.path === "reports/m1_v1") db._put("memories/m1", memory({ moderation: "hidden" }));
        return get(ref);
      };
      return fn(tx);
    });
  await call(db, "v1", { memoryId: "m1", reason: "spam" });
  assert.deepEqual(db._stats.queryReads, []);
  assert.equal(db._get("reports/m1_v1").reporterVerified, true);
});

test("an unverified report never counts reports either", async () => {
  const db = seed();
  await call(db, "u1", { memoryId: "m1", reason: "spam" }, false);
  assert.deepEqual(db._stats.queryReads, []);
});
