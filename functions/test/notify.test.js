const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { notify, TEMPLATES } = require("../lib/notify");

const base = () =>
  createFakeFirestore({
    "publicProfiles/alice": { displayName: "Alice" },
    "users/bob": { notificationPrefs: { transfers: true, tags: true, communityInvites: true } },
  });
const inbox = (db, uid) => db._list(`users/${uid}/notifications/`).map((p) => db._get(p));

test("writes a tagged notification with names filled in", async () => {
  const db = base();
  const r = await notify(db, { to: "bob", type: "memoryTagged", actorId: "alice", data: { memoryId: "m1" } });
  assert.equal(r.sent, true);
  const [n] = inbox(db, "bob");
  assert.equal(n.type, "memoryTagged");
  assert.equal(n.title, "Tagged in a memory");
  assert.equal(n.body, "Alice tagged you in a memory.");
  assert.deepEqual(n.data, { memoryId: "m1" });
  assert.equal(n.readAt, null);
  assert.equal(typeof n.createdAt, "string");
  assert.ok(!Number.isNaN(Date.parse(n.createdAt)));
});

test("copy table matches the spec exactly", () => {
  const p = { name: "N", place: "P", community: "C" };
  assert.deepEqual(
    Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, [t.title, t.body(p)]])),
    {
      memoryTagged: ["Tagged in a memory", "N tagged you in a memory."],
      transferRequest: ["Custodianship request", "N wants you to become a custodian of P."],
      transferAccepted: ["Custodianship accepted", "N accepted custodianship of P."],
      transferRejected: ["Custodianship declined", "N declined custodianship of P."],
      communityInvite: ["Community invitation", "N invited you to join C."],
    },
  );
});

test("params fill place and community; missing profile falls back to Someone", async () => {
  const db = base();
  await notify(db, { to: "bob", type: "transferRequest", actorId: "ghost", params: { place: "Old Mill" } });
  await notify(db, { to: "bob", type: "communityInvite", actorId: "alice", params: { community: "Walkers" } });
  const bodies = inbox(db, "bob").map((n) => n.body).sort();
  assert.deepEqual(bodies, ["Alice invited you to join Walkers.", "Someone wants you to become a custodian of Old Mill."]);
});

test("skips self", async () => {
  const db = base();
  const r = await notify(db, { to: "alice", type: "memoryTagged", actorId: "alice" });
  assert.deepEqual(r, { sent: false, reason: "self" });
  assert.equal(inbox(db, "alice").length, 0);
});

test("skips when either side blocked the other", async () => {
  for (const blk of ["users/bob/blocks/alice", "users/alice/blocks/bob"]) {
    const db = base();
    db._put(blk, { createdAt: "x" });
    const r = await notify(db, { to: "bob", type: "memoryTagged", actorId: "alice" });
    assert.equal(r.reason, "blocked");
    assert.equal(inbox(db, "bob").length, 0);
  }
});

test("pref mapping: disabled prefs skip, missing prefs allow", async () => {
  const cases = [
    ["memoryTagged", "tags"],
    ["transferRequest", "transfers"],
    ["transferAccepted", "transfers"],
    ["transferRejected", "transfers"],
    ["communityInvite", "communityInvites"],
  ];
  for (const [type, pref] of cases) {
    const off = base();
    off._put("users/bob", { notificationPrefs: { [pref]: false } });
    const r = await notify(off, { to: "bob", type, actorId: "alice", params: { place: "p", community: "c" } });
    assert.equal(r.reason, "pref", type);
    assert.equal(inbox(off, "bob").length, 0);

    for (const userDoc of [undefined, {}]) {
      const on = createFakeFirestore(userDoc ? { "users/bob": userDoc } : {});
      const r2 = await notify(on, { to: "bob", type, actorId: "alice", params: { place: "p", community: "c" } });
      assert.equal(r2.sent, true, type);
    }
  }
});

test("a disabled pref does not block other types", async () => {
  const db = base();
  db._put("users/bob", { notificationPrefs: { tags: false } });
  const r = await notify(db, { to: "bob", type: "communityInvite", actorId: "alice", params: { community: "c" } });
  assert.equal(r.sent, true);
});

test("unknown type throws", async () => {
  await assert.rejects(notify(base(), { to: "bob", type: "nope", actorId: "alice" }), /Unknown notification type/);
});

test("a deterministic id makes notify idempotent", async () => {
  const db = base();
  const a = await notify(db, { to: "bob", type: "memoryTagged", actorId: "alice", id: "memoryTagged_m1_bob" });
  const b = await notify(db, { to: "bob", type: "memoryTagged", actorId: "alice", id: "memoryTagged_m1_bob" });
  assert.deepEqual(a, { sent: true, id: "memoryTagged_m1_bob" });
  assert.deepEqual(b, { sent: false, reason: "duplicate" });
  assert.deepEqual(db._list("users/bob/notifications/"), ["users/bob/notifications/memoryTagged_m1_bob"]);
});
