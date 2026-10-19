const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler } = require("../lib/callable");
const { definitions, expireStale, expireTransfers, EXPIRE_BATCH_SIZE } = require("../transfers");

const DAY_MS = 24 * 60 * 60 * 1000;

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
    "users/alice": {},
    "users/bob": {},
    "users/carol": {},
    "publicProfiles/alice": { displayName: "Alice" },
    "publicProfiles/bob": { displayName: "Bob" },
    "publicProfiles/carol": { displayName: "Carol" },
    "places/p1": { name: "Old Mill", custodianIds: ["alice"] },
    ...extra,
  });
const inbox = (db, uid) => db._list(`users/${uid}/notifications/`).map((p) => ({ id: p.split("/").pop(), ...db._get(p) }));
const transfers = (db) => db._list("transfers/").map((p) => ({ id: p.split("/").pop(), ...db._get(p) }));

const initiate = (db, uid = "alice", data = { placeId: "p1", toUserId: "bob" }) =>
  call(db, "initiateTransfer", uid, data);

// --- initiateTransfer ---

test("initiateTransfer creates a pending transfer and notifies the recipient", async () => {
  const db = seed();
  const before = Date.now();
  const { id } = await initiate(db);
  const t = db._get(`transfers/${id}`);
  assert.equal(t.placeId, "p1");
  assert.equal(t.fromUserId, "alice");
  assert.equal(t.toUserId, "bob");
  assert.equal(t.status, "pending");
  assert.equal(t.respondedAt, null);
  assert.equal(t.recipientWasCustodian, null);
  const created = Date.parse(t.createdAt);
  assert.ok(created >= before && created <= Date.now());
  assert.equal(Date.parse(t.revokeUntil) - created, 7 * DAY_MS);

  const [n] = inbox(db, "bob");
  assert.equal(n.id, `transferRequest_${id}`);
  assert.equal(n.type, "transferRequest");
  assert.equal(n.title, "Custodianship request");
  assert.equal(n.body, "Alice wants you to become a custodian of Old Mill.");
  assert.deepEqual(n.data, { transferId: id, placeId: "p1" });
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
});

test("initiateTransfer refuses a self-transfer", async () => {
  const db = seed();
  assert.equal(await codeOf(initiate(db, "alice", { placeId: "p1", toUserId: "alice" })), "invalid-argument");
  assert.equal(transfers(db).length, 0);
});

test("initiateTransfer requires the caller to be a custodian of an existing place", async () => {
  const db = seed();
  assert.equal(await codeOf(initiate(db, "carol", { placeId: "p1", toUserId: "bob" })), "permission-denied");
  assert.equal(await codeOf(initiate(db, "alice", { placeId: "nope", toUserId: "bob" })), "not-found");
  assert.equal(await codeOf(initiate(db, null)), "unauthenticated");
  assert.equal(await codeOf(initiate(db, "alice", { placeId: "p1" })), "invalid-argument");
  assert.equal(await codeOf(initiate(db, "alice", { placeId: "a/b", toUserId: "bob" })), "invalid-argument");
  assert.equal(transfers(db).length, 0);
});

test("initiateTransfer requires the recipient to have a public profile", async () => {
  const db = seed();
  assert.equal(await codeOf(initiate(db, "alice", { placeId: "p1", toUserId: "ghost" })), "not-found");
  assert.equal(transfers(db).length, 0);
});

test("initiateTransfer refuses a recipient who is already a custodian", async () => {
  const db = seed({ "places/p1": { name: "Old Mill", custodianIds: ["alice", "bob"] } });
  assert.equal(await codeOf(initiate(db)), "failed-precondition");
  assert.equal(transfers(db).length, 0);
});

test("a duplicate pending transfer for the same place and recipient is already-exists", async () => {
  const db = seed({ "places/p1": { name: "Old Mill", custodianIds: ["alice", "carol"] } });
  const { id } = await initiate(db);
  assert.equal(await codeOf(initiate(db)), "already-exists");
  // Another custodian sending to the same recipient is the same (place, recipient) pair.
  assert.equal(await codeOf(initiate(db, "carol")), "already-exists");
  assert.equal(transfers(db).length, 1);
  // Once the first is answered, a new request is allowed.
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: false });
  await initiate(db);
  assert.equal(transfers(db).length, 2);
});

test("a blocked pair cannot transfer (either direction)", async () => {
  const db = seed({ "users/bob/blocks/alice": { createdAt: "2026-01-01T00:00:00.000Z" } });
  assert.equal(await codeOf(initiate(db)), "permission-denied");
  const db2 = seed({ "users/alice/blocks/bob": { createdAt: "2026-01-01T00:00:00.000Z" } });
  assert.equal(await codeOf(initiate(db2)), "permission-denied");
  assert.equal(transfers(db).length + transfers(db2).length, 0);
  assert.equal(inbox(db, "bob").length, 0);
});

test("initiateTransfer is rate limited to 20 per day", async () => {
  const extra = {};
  for (let i = 0; i < 21; i++) extra[`publicProfiles/u${i}`] = { displayName: `U${i}` };
  const db = seed(extra);
  for (let i = 0; i < 20; i++) await initiate(db, "alice", { placeId: "p1", toUserId: `u${i}` });
  assert.equal(
    await codeOf(initiate(db, "alice", { placeId: "p1", toUserId: "u20" })),
    "resource-exhausted",
  );
});

// --- respondToTransfer ---

test("accepting adds the recipient as a custodian and notifies the sender", async () => {
  const db = seed();
  const { id } = await initiate(db);
  const res = await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  assert.deepEqual(res, { status: "accepted" });
  const t = db._get(`transfers/${id}`);
  assert.equal(t.status, "accepted");
  assert.equal(typeof t.respondedAt, "string");
  assert.equal(t.recipientWasCustodian, false);
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice", "bob"]);
  assert.equal(typeof db._get("places/p1").updatedAt, "string");
  const [n] = inbox(db, "alice");
  assert.equal(n.id, `transferAccepted_${id}`);
  assert.equal(n.body, "Bob accepted custodianship of Old Mill.");
  assert.deepEqual(n.data, { transferId: id, placeId: "p1" });
});

test("rejecting leaves the place alone and notifies the sender", async () => {
  const db = seed();
  const { id } = await initiate(db);
  const res = await call(db, "respondToTransfer", "bob", { transferId: id, accept: false });
  assert.deepEqual(res, { status: "rejected" });
  const t = db._get(`transfers/${id}`);
  assert.equal(t.status, "rejected");
  assert.equal(typeof t.respondedAt, "string");
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
  const [n] = inbox(db, "alice");
  assert.equal(n.id, `transferRejected_${id}`);
  assert.equal(n.body, "Bob declined custodianship of Old Mill.");
});

test("accept after place deleted fails cleanly", async () => {
  const db = seed();
  const { id } = await initiate(db);
  db._store.delete("places/p1");
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: true })),
    "failed-precondition",
  );
  assert.equal(db._get(`transfers/${id}`).status, "pending");
  assert.equal(db._get("places/p1"), undefined);
  assert.equal(inbox(db, "alice").length, 0);
});

test("accept is idempotent", async () => {
  const db = seed();
  const { id } = await initiate(db);
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  const res = await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  assert.deepEqual(res, { status: "accepted" });
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice", "bob"]);
  assert.equal(inbox(db, "alice").length, 1);
  // Declining after accepting is not allowed.
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: false })),
    "failed-precondition",
  );
});

test("accept records recipientWasCustodian when they became one in the meantime", async () => {
  const db = seed();
  const { id } = await initiate(db);
  db._put("places/p1", { name: "Old Mill", custodianIds: ["alice", "bob"] });
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  assert.equal(db._get(`transfers/${id}`).recipientWasCustodian, true);
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice", "bob"]);
});

test("only the recipient may respond, and only to a live pending transfer", async () => {
  const db = seed();
  const { id } = await initiate(db);
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "alice", { transferId: id, accept: true })),
    "permission-denied",
  );
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "carol", { transferId: id, accept: true })),
    "permission-denied",
  );
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: "nope", accept: true })),
    "not-found",
  );
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: id })),
    "invalid-argument",
  );
  for (const status of ["revoked", "expired"]) {
    db._put(`transfers/${id}`, { ...db._get(`transfers/${id}`), status });
    assert.equal(
      await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: true })),
      "failed-precondition",
    );
  }
  // A pending transfer past its 7-day window (not yet swept by the expiry job).
  const old = new Date(Date.now() - 8 * DAY_MS);
  db._put(`transfers/${id}`, {
    ...db._get(`transfers/${id}`),
    status: "pending",
    createdAt: old.toISOString(),
    revokeUntil: new Date(old.getTime() + 7 * DAY_MS).toISOString(),
  });
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: true })),
    "failed-precondition",
  );
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
});

// --- revokeTransfer ---

test("revoke of a pending transfer before 7 days", async () => {
  const db = seed();
  const { id } = await initiate(db);
  const res = await call(db, "revokeTransfer", "alice", { transferId: id });
  assert.deepEqual(res, { status: "revoked" });
  const t = db._get(`transfers/${id}`);
  assert.equal(t.status, "revoked");
  assert.equal(typeof t.revokedAt, "string");
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
  // Revoking again is a no-op; the recipient can no longer respond.
  assert.deepEqual(await call(db, "revokeTransfer", "alice", { transferId: id }), { status: "revoked" });
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: true })),
    "failed-precondition",
  );
});

test("revoke after 7 days is failed-precondition", async () => {
  const old = new Date(Date.now() - 7 * DAY_MS - 1000);
  const db = seed({
    "places/p1": { name: "Old Mill", custodianIds: ["alice", "bob"] },
    "transfers/t1": {
      placeId: "p1",
      fromUserId: "alice",
      toUserId: "bob",
      status: "accepted",
      createdAt: old.toISOString(),
      respondedAt: old.toISOString(),
      revokeUntil: new Date(old.getTime() + 7 * DAY_MS).toISOString(),
      recipientWasCustodian: false,
    },
  });
  assert.equal(await codeOf(call(db, "revokeTransfer", "alice", { transferId: "t1" })), "failed-precondition");
  assert.equal(db._get("transfers/t1").status, "accepted");
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice", "bob"]);
});

test("revoke of an accepted transfer removes the custodian (sender stays)", async () => {
  const db = seed();
  const { id } = await initiate(db);
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  await call(db, "revokeTransfer", "alice", { transferId: id });
  assert.equal(db._get(`transfers/${id}`).status, "revoked");
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
});

test("revoke of an accepted transfer keeps a recipient who was already a custodian", async () => {
  const db = seed();
  const { id } = await initiate(db);
  db._put("places/p1", { name: "Old Mill", custodianIds: ["alice", "bob"] });
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  await call(db, "revokeTransfer", "alice", { transferId: id });
  assert.equal(db._get(`transfers/${id}`).status, "revoked");
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice", "bob"]);
});

test("revoke of an accepted transfer whose place is gone still revokes", async () => {
  const db = seed();
  const { id } = await initiate(db);
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: true });
  db._store.delete("places/p1");
  await call(db, "revokeTransfer", "alice", { transferId: id });
  assert.equal(db._get(`transfers/${id}`).status, "revoked");
  assert.equal(db._get("places/p1"), undefined);
});

test("only the sender may revoke, and not a rejected or expired transfer", async () => {
  const db = seed();
  const { id } = await initiate(db);
  assert.equal(await codeOf(call(db, "revokeTransfer", "bob", { transferId: id })), "permission-denied");
  assert.equal(await codeOf(call(db, "revokeTransfer", "alice", { transferId: "nope" })), "not-found");
  await call(db, "respondToTransfer", "bob", { transferId: id, accept: false });
  assert.equal(await codeOf(call(db, "revokeTransfer", "alice", { transferId: id })), "failed-precondition");
  db._put(`transfers/${id}`, { ...db._get(`transfers/${id}`), status: "expired" });
  assert.equal(await codeOf(call(db, "revokeTransfer", "alice", { transferId: id })), "failed-precondition");
});

// --- expireTransfers ---

const pending = (createdAt, status = "pending") => ({
  placeId: "p1",
  fromUserId: "alice",
  toUserId: "bob",
  status,
  createdAt: createdAt.toISOString(),
  respondedAt: null,
  revokeUntil: new Date(createdAt.getTime() + 7 * DAY_MS).toISOString(),
  recipientWasCustodian: null,
});

test("expiry job marks pending transfers older than 7 days expired", async () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  const ago = (d) => new Date(now.getTime() - d * DAY_MS);
  const db = seed({
    "transfers/old": pending(ago(8)),
    "transfers/edge": pending(new Date(ago(7).getTime() + 1000)),
    "transfers/fresh": pending(ago(1)),
    "transfers/oldAccepted": pending(ago(30), "accepted"),
    "transfers/oldRejected": pending(ago(30), "rejected"),
  });
  const expired = await expireStale(db, now);
  assert.equal(expired, 1);
  assert.equal(db._get("transfers/old").status, "expired");
  assert.equal(db._get("transfers/edge").status, "pending");
  assert.equal(db._get("transfers/fresh").status, "pending");
  assert.equal(db._get("transfers/oldAccepted").status, "accepted");
  assert.equal(db._get("transfers/oldRejected").status, "rejected");
});

test("expiry job pages through results and stops when the time budget is spent", async () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  const docs = {};
  for (let i = 0; i < 5; i++) docs[`transfers/t${i}`] = pending(new Date(now.getTime() - (10 + i) * DAY_MS));
  const db = seed(docs);
  assert.equal(await expireStale(db, now, { batchSize: 2 }), 5);
  assert.equal(transfers(db).filter((t) => t.status === "expired").length, 5);

  const db2 = seed(docs);
  let t = 0;
  const clock = () => (t += 100);
  const logs = [];
  const n = await expireStale(db2, now, { batchSize: 2, budgetMs: 100, clock, log: (m) => logs.push(m) });
  assert.equal(n, 2);
  assert.equal(logs.length, 1);
  assert.equal(transfers(db2).filter((x) => x.status === "expired").length, 2);
});

test("expireTransfers is a daily schedule with a 540 s timeout", () => {
  assert.ok(expireTransfers);
  assert.equal(EXPIRE_BATCH_SIZE, 500);
  const endpoint = expireTransfers.__endpoint;
  assert.equal(endpoint.timeoutSeconds, 540);
  assert.equal(endpoint.scheduleTrigger.schedule, "every 24 hours");
});

// --- Fix round 1 ---

test("accept fails when the sender is no longer a custodian", async () => {
  const db = seed();
  const { id } = await initiate(db);
  db._put("places/p1", { name: "Old Mill", custodianIds: ["carol"] });
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: true })),
    "failed-precondition",
  );
  assert.equal(db._get(`transfers/${id}`).status, "pending");
  assert.deepEqual(db._get("places/p1").custodianIds, ["carol"]);
});

test("A->B accepted, B->C pending; A revokes B: B->C is revoked and C's accept fails", async () => {
  const db = seed({
    "places/p2": { name: "Pier", custodianIds: ["bob"] },
  });
  const { id: ab } = await initiate(db);
  await call(db, "respondToTransfer", "bob", { transferId: ab, accept: true });
  const { id: bc } = await initiate(db, "bob", { placeId: "p1", toUserId: "carol" });
  // B's pending transfer for another place is untouched.
  const { id: other } = await initiate(db, "bob", { placeId: "p2", toUserId: "carol" });

  await call(db, "revokeTransfer", "alice", { transferId: ab });
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
  const t = db._get(`transfers/${bc}`);
  assert.equal(t.status, "revoked");
  assert.equal(typeof t.revokedAt, "string");
  assert.equal(db._get(`transfers/${other}`).status, "pending");
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "carol", { transferId: bc, accept: true })),
    "failed-precondition",
  );
  assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
});

test("even without the cascade, C's accept fails once B is no longer a custodian", async () => {
  const db = seed();
  const { id: ab } = await initiate(db);
  await call(db, "respondToTransfer", "bob", { transferId: ab, accept: true });
  const { id: bc } = await initiate(db, "bob", { placeId: "p1", toUserId: "carol" });
  db._put("places/p1", { name: "Old Mill", custodianIds: ["alice"] });
  assert.equal(
    await codeOf(call(db, "respondToTransfer", "carol", { transferId: bc, accept: true })),
    "failed-precondition",
  );
});

test("accept is refused when a block appeared after the request (either direction)", async () => {
  for (const blockPath of ["users/bob/blocks/alice", "users/alice/blocks/bob"]) {
    const db = seed();
    const { id } = await initiate(db);
    db._put(blockPath, { createdAt: "2026-10-19T00:00:00.000Z" });
    assert.equal(
      await codeOf(call(db, "respondToTransfer", "bob", { transferId: id, accept: true })),
      "permission-denied",
    );
    assert.equal(db._get(`transfers/${id}`).status, "pending");
    assert.deepEqual(db._get("places/p1").custodianIds, ["alice"]);
  }
});

// Wraps the fake so the first transfers query runs `afterQuery` once its results are read.
function withRaceAfterQuery(db, afterQuery) {
  let fired = false;
  const wrap = (q) => ({
    where: (...a) => wrap(q.where(...a)),
    orderBy: (...a) => wrap(q.orderBy(...a)),
    limit: (n) => wrap(q.limit(n)),
    async get() {
      const snap = await q.get();
      if (!fired) {
        fired = true;
        afterQuery();
      }
      return snap;
    },
  });
  return { ...db, collection: (p) => (p === "transfers" ? wrap(db.collection(p)) : db.collection(p)) };
}

test("expiry does not overwrite a transfer that changed after the query", async () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  const db = seed({
    "transfers/raced": pending(new Date(now.getTime() - 9 * DAY_MS)),
    "transfers/stale": pending(new Date(now.getTime() - 8 * DAY_MS)),
  });
  const raced = withRaceAfterQuery(db, () =>
    db._put("transfers/raced", { ...db._get("transfers/raced"), status: "accepted" }),
  );
  const expired = await expireStale(raced, now);
  assert.equal(expired, 1);
  assert.equal(db._get("transfers/raced").status, "accepted");
  assert.equal(db._get("transfers/stale").status, "expired");
});

// Makes every notification write fail.
function withFailingNotifications(db) {
  return {
    ...db,
    collection: (p) =>
      p.endsWith("/notifications")
        ? {
            doc: () => ({
              create: async () => {
                throw new Error("notify boom");
              },
              set: async () => {
                throw new Error("notify boom");
              },
            }),
          }
        : db.collection(p),
  };
}

test("a notification failure never fails a committed transfer", async () => {
  const base = seed();
  const db = withFailingNotifications(base);
  const { id } = await initiate(db);
  assert.equal(base._get(`transfers/${id}`).status, "pending");
  assert.deepEqual(await call(db, "respondToTransfer", "bob", { transferId: id, accept: true }), {
    status: "accepted",
  });
  assert.equal(base._get(`transfers/${id}`).status, "accepted");
  assert.deepEqual(base._get("places/p1").custodianIds, ["alice", "bob"]);
});

test("block status cannot be probed with a place the caller does not custody", async () => {
  const db = seed({ "users/bob/blocks/carol": { createdAt: "2026-01-01T00:00:00.000Z" } });
  assert.equal(await codeOf(initiate(db, "carol", { placeId: "nope", toUserId: "bob" })), "not-found");
  await assert.rejects(initiate(db, "carol", { placeId: "p1", toUserId: "bob" }), /Only custodians/);
});
