const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { syncDisplayNameLower } = require("../onPublicProfileWritten");

const event = (db, after) => ({
  params: { uid: "u1" },
  data: { after: after === undefined ? { exists: false } : { exists: true, data: () => after } },
});

test("recomputes displayNameLower when it differs", async () => {
  const db = createFakeFirestore({ "publicProfiles/u1": { displayName: "Zoë  Ng", displayNameLower: "wrong", updatedAt: "t" } });
  assert.equal(await syncDisplayNameLower(db, event(db, db._get("publicProfiles/u1"))), true);
  assert.equal(db._get("publicProfiles/u1").displayNameLower, "zoe ng");
  assert.equal(db._get("publicProfiles/u1").updatedAt, "t");
});

test("does not write when already equal (no loop)", async () => {
  const db = createFakeFirestore({ "publicProfiles/u1": { displayName: "Alice", displayNameLower: "alice" } });
  assert.equal(await syncDisplayNameLower(db, event(db, db._get("publicProfiles/u1"))), false);
});

test("ignores deletes and non-string names", async () => {
  const db = createFakeFirestore();
  assert.equal(await syncDisplayNameLower(db, event(db, undefined)), false);
  assert.equal(await syncDisplayNameLower(db, event(db, { displayName: 5 })), false);
});
