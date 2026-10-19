const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { cleanupUserSocialData, deleteNotificationsFrom } = require("../accountCleanup");

const seed = () => {
  const docs = {
    "publicProfiles/alice": { displayName: "Alice", displayNameLower: "alice" },
    "publicProfiles/bob": { displayName: "Bob", displayNameLower: "bob" },
    "institutions/i1": { name: "Uni", adminUserIds: ["alice", "bob"] },
    "institutions/i1/admins/alice": { userId: "alice", since: "2026-10-01" },
    "institutions/i1/admins/bob": { userId: "bob", since: "2026-10-01" },
    "institutions/i2/admins/alice": { userId: "alice", since: "2026-10-01" },
    "institutions/i3/admins/bob": { userId: "bob", since: "2026-10-01" },
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
  assert.deepEqual(db._list("institutions/i1/admins/"), ["institutions/i1/admins/bob"]);
  assert.deepEqual(db._list("institutions/i2/admins/"), []);
  assert.deepEqual(db._list("institutions/i3/admins/"), ["institutions/i3/admins/bob"]);
  assert.deepEqual(db._list("reports/"), ["reports/byBob"]);
});

test("a failing admins collection-group query is logged, the rest of the cleanup still runs, then it is rethrown", async () => {
  const db = seed();
  const real = db.collectionGroup.bind(db);
  db.collectionGroup = (id) => {
    if (id === "admins") throw new Error("FAILED_PRECONDITION: index not ready");
    return real(id);
  };
  const logged = [];
  const orig = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await assert.rejects(cleanupUserSocialData(db, "alice", { batchSize: 2 }), /index not ready/);
  } finally {
    console.error = orig;
  }
  assert.ok(logged.some((l) => l.includes("admins")));
  assert.equal(db._get("publicProfiles/alice"), undefined);
  assert.deepEqual(db._get("institutions/i1").adminUserIds, ["bob"]);
  assert.deepEqual(db._get("institutions/i2").adminUserIds, []);
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

test("deleteNotificationsFrom deletes other users' notifications from the deleted user, and keeps those without an actorId", async () => {
  const db = createFakeFirestore({
    "users/bob/notifications/fromAlice": { type: "memoryTagged", actorId: "alice" },
    "users/bob/notifications/fromCarol": { type: "memoryTagged", actorId: "carol" },
    "users/bob/notifications/legacy": { type: "memoryTagged" },
    "users/bob/notifications/system": { type: "memoryTagged", actorId: null },
    "users/carol/notifications/fromAlice": { type: "communityInvite", actorId: "alice" },
  });
  await deleteNotificationsFrom(db, "alice", { batchSize: 1 });
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

test("a failing admins query is rethrown after the legacy and report cleanup so the trigger retries", async () => {
  const db = seed();
  const real = db.collectionGroup.bind(db);
  db.collectionGroup = (id) => {
    if (id === "admins") throw new Error("FAILED_PRECONDITION: index not ready");
    return real(id);
  };
  const orig = console.error;
  console.error = () => {};
  try {
    await assert.rejects(cleanupUserSocialData(db, "alice", { batchSize: 2 }), /index not ready/);
  } finally {
    console.error = orig;
  }
  assert.equal(db._get("publicProfiles/alice"), undefined);
  assert.deepEqual(db._get("institutions/i1").adminUserIds, ["bob"]);
  assert.deepEqual(db._list("reports/"), ["reports/byBob"]);
});
