const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { cleanupUserSocialData, deleteNotificationsFrom } = require("../accountCleanup");

const seed = () => {
  const docs = {
    "publicProfiles/alice": { displayName: "Alice", displayNameLower: "alice" },
    "publicProfiles/bob": { displayName: "Bob", displayNameLower: "bob" },
    "institutions/i1": { name: "Uni", adminUserIds: ["alice", "bob"] },
    "institutions/i2": { name: "Museum", adminUserIds: ["alice"] },
    "institutions/i3": { name: "Library", adminUserIds: ["bob"] },
    "reports/byBob": { memoryId: "m-alice", reporterId: "bob", reason: "Spam", note: "", createdAt: "2026-10-01" },
  };
  for (let i = 0; i < 5; i++) {
    docs[`reports/a${i}`] = { memoryId: `m${i}`, reporterId: "alice", reason: "Spam", note: "", createdAt: "2026-10-01" };
  }
  return createFakeFirestore(docs);
};

test("cleanup deletes the public profile, admin roles and the user's own reports", async () => {
  const db = seed();
  await cleanupUserSocialData(db, "alice", { batchSize: 2 });
  assert.equal(db._get("publicProfiles/alice"), undefined);
  assert.ok(db._get("publicProfiles/bob"));
  assert.deepEqual(db._get("institutions/i1").adminUserIds, ["bob"]);
  assert.deepEqual(db._get("institutions/i2").adminUserIds, []);
  assert.deepEqual(db._get("institutions/i3").adminUserIds, ["bob"]);
  assert.deepEqual(db._list("reports/"), ["reports/byBob"]);
});

test("cleanup is safe to re-run and for a user with nothing to clean", async () => {
  const db = seed();
  await cleanupUserSocialData(db, "alice");
  await cleanupUserSocialData(db, "alice");
  await cleanupUserSocialData(db, "nobody");
  assert.deepEqual(db._list("reports/"), ["reports/byBob"]);
  assert.ok(db._get("publicProfiles/bob"));
});

test("cleanup deletes other users' notifications from the deleted user, and keeps those without an actorId", async () => {
  const db = createFakeFirestore({
    "users/bob/notifications/fromAlice": { type: "memoryTagged", actorId: "alice" },
    "users/bob/notifications/fromCarol": { type: "memoryTagged", actorId: "carol" },
    "users/bob/notifications/legacy": { type: "memoryTagged" },
    "users/bob/notifications/system": { type: "memoryTagged", actorId: null },
    "users/carol/notifications/fromAlice": { type: "communityInvite", actorId: "alice" },
  });
  await cleanupUserSocialData(db, "alice", { batchSize: 1 });
  assert.deepEqual(db._list("users/").sort(), [
    "users/bob/notifications/fromCarol",
    "users/bob/notifications/legacy",
    "users/bob/notifications/system",
  ]);
});

test("deleteNotificationsFrom pages through more than one batch", async () => {
  const docs = {};
  for (let i = 0; i < 7; i++) docs[`users/u${i}/notifications/n`] = { actorId: "alice" };
  docs["users/u0/notifications/keep"] = { actorId: "bob" };
  const db = createFakeFirestore(docs);
  await deleteNotificationsFrom(db, "alice", { batchSize: 3 });
  assert.deepEqual(db._list("users/"), ["users/u0/notifications/keep"]);
});
