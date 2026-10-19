const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { notifyTaggedUsers, MAX_TAGS } = require("../tags");

const seed = (extra = {}) =>
  createFakeFirestore({
    "publicProfiles/alice": { displayName: "Alice" },
    "users/alice": {},
    "users/bob": {},
    "users/carol": {},
    ...extra,
  });
const inbox = (db, uid) => db._list(`users/${uid}/notifications/`).map((p) => db._get(p));
const memory = (taggedUserIds, over = {}) => ({ userId: "alice", placeId: "p1", privacy: "public", taggedUserIds, ...over });

test("the tag trigger notifies each tagged user once and skips the author", async () => {
  const db = seed();
  await notifyTaggedUsers(db, "m1", memory(["bob", "bob", "alice", "carol"]));
  for (const uid of ["bob", "carol"]) {
    const n = inbox(db, uid);
    assert.equal(n.length, 1, uid);
    assert.equal(n[0].type, "memoryTagged");
    assert.equal(n[0].body, "Alice tagged you in a memory.");
    assert.deepEqual(n[0].data, { memoryId: "m1", placeId: "p1" });
  }
  assert.equal(inbox(db, "alice").length, 0);
});

test("blocked users cannot tag, invite or transfer (tag part)", async () => {
  for (const blk of ["users/bob/blocks/alice", "users/alice/blocks/bob"]) {
    const db = seed({ [blk]: { createdAt: "x" } });
    await notifyTaggedUsers(db, "m1", memory(["bob", "carol"]));
    assert.equal(inbox(db, "bob").length, 0, blk);
    assert.equal(inbox(db, "carol").length, 1, blk);
  }
});

test("tag notifications are capped at the first 20 unique ids", async () => {
  assert.equal(MAX_TAGS, 20);
  const ids = Array.from({ length: 25 }, (_, i) => `u${i}`);
  const db = seed(Object.fromEntries(ids.map((id) => [`users/${id}`, {}])));
  await notifyTaggedUsers(db, "m1", memory(["u0", "u0", "alice", ...ids]));
  const notified = ids.filter((id) => inbox(db, id).length > 0);
  // "alice" (the author) takes one of the 20 unique slots but is never notified.
  assert.deepEqual(notified, ids.slice(0, 19));
});

test("ignores missing, malformed and unknown tagged ids", async () => {
  const db = seed();
  await notifyTaggedUsers(db, "m1", { userId: "alice", placeId: "p1" });
  await notifyTaggedUsers(db, "m1", memory("bob"));
  await notifyTaggedUsers(db, "m1", memory([5, null, "", "ghost"]));
  assert.equal(inbox(db, "bob").length, 0);
  assert.equal(db._list("users/ghost").length, 0);
});

test("tags notify only when the tagged user can read the memory", async () => {
  for (const over of [
    { privacy: "private" },
    { privacy: "community", communityId: "c1" },
    { privacy: "timeRelease", releaseDate: "2030-01-01T00:00:00.000Z" },
    { privacy: "public", moderation: "hidden" },
    { privacy: "tagged", isDeleted: true },
  ]) {
    const db = seed();
    await notifyTaggedUsers(db, "m1", memory(["bob"], over));
    assert.equal(inbox(db, "bob").length, 0, JSON.stringify(over));
  }
  const db = seed();
  await notifyTaggedUsers(db, "m1", memory(["bob"], { privacy: "tagged" }));
  assert.equal(inbox(db, "bob").length, 1);
});

test("a retried tag trigger does not duplicate notifications", async () => {
  const db = seed();
  await notifyTaggedUsers(db, "m1", memory(["bob"]));
  await notifyTaggedUsers(db, "m1", memory(["bob"]));
  assert.deepEqual(db._list("users/bob/notifications/"), ["users/bob/notifications/memoryTagged_m1_bob"]);
});

test("tag notifications stop silently once the author's daily budget is spent", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const db = seed({ [`rateLimits/alice_tagNotify_${day}`]: { count: 100 } });
  await notifyTaggedUsers(db, "m1", memory(["bob", "carol"]));
  assert.equal(inbox(db, "bob").length, 0);
  assert.equal(inbox(db, "carol").length, 0);
});

test("each tag notification consumes one unit of the daily budget", async () => {
  const day = new Date().toISOString().slice(0, 10);
  const db = seed({ [`rateLimits/alice_tagNotify_${day}`]: { count: 99 } });
  await notifyTaggedUsers(db, "m1", memory(["bob", "carol"]));
  assert.equal(inbox(db, "bob").length + inbox(db, "carol").length, 1);
  assert.equal(db._get(`rateLimits/alice_tagNotify_${day}`).count, 100);
});

// --- notifyReleasedTags (scheduled) ---

const { Timestamp } = require("firebase-admin/firestore");
const { releasedTagsHandler } = require("../tags");

const NOW = new Date("2026-10-19T12:00:00Z");
const HOUR = 3600 * 1000;
const at = (offsetMs) => Timestamp.fromDate(new Date(NOW.getTime() + offsetMs));
const released = (offsetMs, over = {}) => ({
  userId: "alice", placeId: "p1", privacy: "timeRelease", taggedUserIds: ["bob"], releaseDate: at(offsetMs), ...over,
});

test("a released time-release memory notifies its tagged users once", async () => {
  const db = seed({ "memories/m1": released(-30 * 60 * 1000) });
  await releasedTagsHandler(db, NOW);
  assert.equal(inbox(db, "bob").length, 1);
  assert.equal(inbox(db, "bob")[0].actorId, "alice");
  assert.deepEqual(db._list("users/bob/notifications/"), ["users/bob/notifications/memoryTagged_m1_bob"]);
});

test("overlapping windows notify once and do not spend the budget twice", async () => {
  const day = NOW.toISOString().slice(0, 10);
  const db = seed({ "memories/m1": released(-30 * 60 * 1000) });
  await releasedTagsHandler(db, NOW);
  await releasedTagsHandler(db, new Date(NOW.getTime() + HOUR));
  assert.equal(inbox(db, "bob").length, 1);
  assert.equal(db._get(`rateLimits/alice_tagNotify_${day}`).count, 1);
});

test("unreleased, out-of-window, hidden, deleted and non-timeRelease memories are skipped", async () => {
  const db = seed({
    "memories/future": released(HOUR),
    "memories/old": released(-3 * HOUR),
    "memories/hidden": released(-HOUR / 2, { moderation: "hidden" }),
    "memories/deleted": released(-HOUR / 2, { isDeleted: true }),
    "memories/public": released(-HOUR / 2, { privacy: "public" }),
  });
  await releasedTagsHandler(db, NOW);
  assert.equal(inbox(db, "bob").length, 0);
});

test("the window is (now - 2h, now]: the upper bound is inclusive, the lower exclusive", async () => {
  const db = seed({
    "memories/edgeNow": released(0),
    "memories/edgeOld": released(-2 * HOUR, { taggedUserIds: ["carol"] }),
  });
  await releasedTagsHandler(db, NOW);
  assert.equal(inbox(db, "bob").length, 1);
  assert.equal(inbox(db, "carol").length, 0);
});

test("pages through every released memory", async () => {
  const docs = {};
  for (let i = 0; i < 5; i++) docs[`memories/m${i}`] = released(-(i + 1) * 60 * 1000, { taggedUserIds: [`t${i}`] });
  for (let i = 0; i < 5; i++) docs[`users/t${i}`] = {};
  const db = seed(docs);
  const count = await releasedTagsHandler(db, NOW, { pageSize: 2 });
  assert.equal(count, 5);
  for (let i = 0; i < 5; i++) assert.equal(inbox(db, `t${i}`).length, 1, `t${i}`);
});

test("stops after the budget", async () => {
  const docs = {};
  for (let i = 0; i < 4; i++) docs[`memories/m${i}`] = released(-(i + 1) * 60 * 1000, { taggedUserIds: [`t${i}`] });
  for (let i = 0; i < 4; i++) docs[`users/t${i}`] = {};
  const db = seed(docs);
  let t = 0;
  const logs = [];
  const count = await releasedTagsHandler(db, NOW, {
    pageSize: 2,
    budgetMs: 1000,
    clock: () => (t += 1500),
    log: (msg, data) => logs.push([msg, data]),
  });
  assert.equal(count, 2);
  assert.equal(logs.length, 1);
  assert.match(logs[0][0], /budget/);
});

test("the notify scheduler is a job exported from index", () => {
  assert.ok(require("../index").notifyReleasedTags);
});

test("a timeRelease memory notifies only once released when run through notifyTaggedUsers", async () => {
  const db = seed();
  await notifyTaggedUsers(db, "m1", memory(["bob"], { privacy: "timeRelease", releaseDate: at(HOUR) }), NOW);
  assert.equal(inbox(db, "bob").length, 0);
  await notifyTaggedUsers(db, "m1", memory(["bob"], { privacy: "timeRelease", releaseDate: at(-HOUR) }), NOW);
  assert.equal(inbox(db, "bob").length, 1);
});
