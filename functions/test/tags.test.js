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
const memory = (taggedUserIds) => ({ userId: "alice", placeId: "p1", taggedUserIds });

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
