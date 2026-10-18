const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler } = require("../lib/callable");
const { definitions, cleanupUserCommunities } = require("../communities");

const call = (db, name, uid, data) => {
  const def = definitions[name];
  return buildHandler({ name, ...def }, def.handler, () => db)({ auth: uid ? { uid } : undefined, data });
};

async function codeOf(p) {
  try {
    await p;
  } catch (e) {
    return e.code;
  }
  return "none";
}

const seed = (extra = {}) =>
  createFakeFirestore({
    "users/alice": { communityIds: [] },
    "users/bob": { communityIds: [] },
    "users/carol": { communityIds: [] },
    "publicProfiles/alice": { displayName: "Alice" },
    ...extra,
  });
const inbox = (db, uid) => db._list(`users/${uid}/notifications/`).map((p) => db._get(p));

async function created(db, uid = "alice", data = { name: "  Walkers  ", description: " Long walks " }) {
  const { id } = await call(db, "createCommunity", uid, data);
  return id;
}

// --- createCommunity ---

test("createCommunity creates a thematic community with an owner membership", async () => {
  const db = seed();
  const id = await created(db);
  assert.equal(typeof id, "string");
  const c = db._get(`communities/${id}`);
  assert.equal(c.name, "Walkers");
  assert.equal(c.description, "Long walks");
  assert.equal(c.type, "thematic");
  assert.equal(c.ownerId, "alice");
  assert.equal(c.placeId, null);
  assert.equal(c.institutionId, null);
  assert.equal(c.memberCount, 1);
  assert.equal(typeof c.createdAt, "string");
  assert.equal(c.updatedAt, c.createdAt);
  const m = db._get(`communities/${id}/members/alice`);
  assert.equal(m.userId, "alice");
  assert.equal(m.role, "owner");
  assert.equal(typeof m.joinedAt, "string");
  assert.deepEqual(db._get("users/alice").communityIds, [id]);
});

test("createCommunity validates name 1-60 and description 1-500 after trim", async () => {
  const db = seed();
  for (const data of [
    { name: "   ", description: "x" },
    { name: "x", description: "   " },
    { name: "x".repeat(61), description: "x" },
    { name: "x", description: "x".repeat(501) },
    { name: "x" },
    { name: "x", description: "x", type: "geographic" },
  ]) {
    assert.equal(await codeOf(call(db, "createCommunity", "alice", data)), "invalid-argument");
  }
  assert.equal(await codeOf(call(db, "createCommunity", null, { name: "x", description: "x" })), "unauthenticated");
  assert.equal(db._list("communities/").length, 0);
  await created(db, "alice", { name: "x".repeat(60), description: "x".repeat(500) });
});

test("createCommunity is rate limited to 10 per day", async () => {
  const db = seed();
  for (let i = 0; i < 10; i++) await created(db);
  assert.equal(
    await codeOf(call(db, "createCommunity", "alice", { name: "x", description: "y" })),
    "resource-exhausted",
  );
});

// --- joinCommunity ---

test("joinCommunity adds a member, bumps the count and the user's communityIds", async () => {
  const db = seed();
  const id = await created(db);
  await call(db, "joinCommunity", "bob", { communityId: id });
  const m = db._get(`communities/${id}/members/bob`);
  assert.equal(m.userId, "bob");
  assert.equal(m.role, "member");
  assert.equal(typeof m.joinedAt, "string");
  assert.equal(db._get(`communities/${id}`).memberCount, 2);
  assert.deepEqual(db._get("users/bob").communityIds, [id]);
});

test("join twice counts once", async () => {
  const db = seed();
  const id = await created(db);
  await call(db, "joinCommunity", "bob", { communityId: id });
  await call(db, "joinCommunity", "bob", { communityId: id });
  await call(db, "joinCommunity", "alice", { communityId: id });
  assert.equal(db._get(`communities/${id}`).memberCount, 2);
  assert.equal(db._get(`communities/${id}/members/alice`).role, "owner");
  assert.deepEqual(db._get("users/bob").communityIds, [id]);
});

test("joinCommunity on a missing community is not-found", async () => {
  const db = seed();
  assert.equal(await codeOf(call(db, "joinCommunity", "bob", { communityId: "nope" })), "not-found");
  assert.equal(await codeOf(call(db, "joinCommunity", "bob", {})), "invalid-argument");
  assert.equal(await codeOf(call(db, "joinCommunity", "bob", { communityId: "a/b" })), "invalid-argument");
});

// --- leaveCommunity ---

test("leaveCommunity removes the member, decrements and arrayRemoves; idempotent", async () => {
  const db = seed();
  const id = await created(db);
  await call(db, "joinCommunity", "bob", { communityId: id });
  await call(db, "leaveCommunity", "bob", { communityId: id });
  assert.equal(db._get(`communities/${id}/members/bob`), undefined);
  assert.equal(db._get(`communities/${id}`).memberCount, 1);
  assert.deepEqual(db._get("users/bob").communityIds, []);
  await call(db, "leaveCommunity", "bob", { communityId: id });
  assert.equal(db._get(`communities/${id}`).memberCount, 1);
});

test("owner leave is failed-precondition", async () => {
  const db = seed();
  const id = await created(db);
  assert.equal(await codeOf(call(db, "leaveCommunity", "alice", { communityId: id })), "failed-precondition");
  assert.equal(db._get(`communities/${id}`).memberCount, 1);
  assert.ok(db._get(`communities/${id}/members/alice`));
});

test("leaving a community that no longer exists clears the stale id", async () => {
  const db = seed({ "users/bob": { communityIds: ["gone"] } });
  await call(db, "leaveCommunity", "bob", { communityId: "gone" });
  assert.deepEqual(db._get("users/bob").communityIds, []);
  assert.equal(db._get("communities/gone"), undefined);
});

// --- inviteToCommunity ---

test("inviteToCommunity notifies each invitee once with the community name", async () => {
  const db = seed();
  const id = await created(db);
  await call(db, "inviteToCommunity", "alice", { communityId: id, userIds: ["bob", "bob", "carol", "alice"] });
  for (const uid of ["bob", "carol"]) {
    const n = inbox(db, uid);
    assert.equal(n.length, 1);
    assert.equal(n[0].type, "communityInvite");
    assert.equal(n[0].body, "Alice invited you to join Walkers.");
    assert.deepEqual(n[0].data, { communityId: id });
  }
  assert.equal(inbox(db, "alice").length, 0);
});

test("inviteToCommunity skips existing members and unknown users", async () => {
  const db = seed();
  const id = await created(db);
  await call(db, "joinCommunity", "bob", { communityId: id });
  await call(db, "inviteToCommunity", "alice", { communityId: id, userIds: ["bob", "ghost"] });
  assert.equal(inbox(db, "bob").length, 0);
  assert.equal(db._list("users/ghost").length, 0);
});

test("inviteToCommunity errors: non-member, missing community, too many ids", async () => {
  const db = seed();
  const id = await created(db);
  assert.equal(
    await codeOf(call(db, "inviteToCommunity", "bob", { communityId: id, userIds: ["carol"] })),
    "permission-denied",
  );
  assert.equal(
    await codeOf(call(db, "inviteToCommunity", "alice", { communityId: "nope", userIds: ["bob"] })),
    "not-found",
  );
  const many = Array.from({ length: 21 }, (_, i) => `u${i}`);
  for (const userIds of [many, [], [5], [""]]) {
    assert.equal(
      await codeOf(call(db, "inviteToCommunity", "alice", { communityId: id, userIds })),
      "invalid-argument",
    );
  }
  assert.equal(inbox(db, "carol").length, 0);
});

test("inviteToCommunity is rate limited to 50 per day", async () => {
  const db = seed();
  const id = await created(db);
  for (let i = 0; i < 50; i++) {
    await call(db, "inviteToCommunity", "alice", { communityId: id, userIds: ["bob"] });
  }
  assert.equal(
    await codeOf(call(db, "inviteToCommunity", "alice", { communityId: id, userIds: ["bob"] })),
    "resource-exhausted",
  );
});

test("blocked users cannot tag, invite or transfer (invite part)", async () => {
  for (const blk of ["users/bob/blocks/alice", "users/alice/blocks/bob"]) {
    const db = seed({ [blk]: { createdAt: "x" } });
    const id = await created(db);
    await call(db, "inviteToCommunity", "alice", { communityId: id, userIds: ["bob", "carol"] });
    assert.equal(inbox(db, "bob").length, 0, blk);
    assert.equal(inbox(db, "carol").length, 1, blk);
  }
});

// --- account deletion (R24) ---

test("cleanupUserCommunities removes memberships, decrements counts and unlinks owned communities", async () => {
  const db = seed();
  const mine = await created(db, "alice");
  const theirs = await created(db, "bob");
  await call(db, "joinCommunity", "alice", { communityId: theirs });
  await call(db, "joinCommunity", "carol", { communityId: theirs });
  await call(db, "joinCommunity", "bob", { communityId: mine });
  await call(db, "joinCommunity", "carol", { communityId: mine });
  assert.equal(db._get(`communities/${theirs}`).memberCount, 3);

  await cleanupUserCommunities(db, "alice");

  assert.equal(db._get(`communities/${theirs}/members/alice`), undefined);
  assert.equal(db._get(`communities/${theirs}`).memberCount, 2);
  assert.equal(db._list(`communities/${mine}`).length, 0);
  assert.deepEqual(db._get("users/bob").communityIds, [theirs]);
  assert.deepEqual(db._get("users/carol").communityIds, [theirs]);

  // Re-running (function retry) changes nothing further.
  await cleanupUserCommunities(db, "alice");
  assert.equal(db._get(`communities/${theirs}`).memberCount, 2);
});

test("cleanupUserCommunities uses no transactions (async trigger; emulator resets abort on open ones)", async () => {
  const db = seed();
  const theirs = await created(db, "bob");
  await call(db, "joinCommunity", "alice", { communityId: theirs });
  db.runTransaction = async () => {
    throw new Error("no transactions in cleanup");
  };
  await cleanupUserCommunities(db, "alice");
  assert.equal(db._get(`communities/${theirs}`).memberCount, 1);
});

test("a membership deleted concurrently is not decremented twice", async () => {
  const db = seed();
  const theirs = await created(db, "bob");
  await call(db, "joinCommunity", "alice", { communityId: theirs });
  const realGet = db.collectionGroup;
  db.collectionGroup = (id) => {
    const q = realGet(id);
    return {
      where: (...a) => ({
        async get() {
          const r = await q.where(...a).get();
          await call(db, "leaveCommunity", "alice", { communityId: theirs }); // races the cleanup
          return r;
        },
      }),
    };
  };
  await cleanupUserCommunities(db, "alice");
  assert.equal(db._get(`communities/${theirs}`).memberCount, 1);
});
