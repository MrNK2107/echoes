const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// No emulator needed. `firebase deploy` rejects single-field composite indexes ("this index is
// not necessary, configure using single field index controls"); those belong in fieldOverrides.
const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "firestore.indexes.json"), "utf8"),
);

test("every composite index has at least two fields", () => {
  const single = config.indexes.filter((i) => i.fields.length < 2);
  assert.deepEqual(
    single.map((i) => `${i.collectionGroup}: ${i.fields.map((f) => f.fieldPath).join(", ")}`),
    [],
  );
});

test("composite indexes are not duplicated", () => {
  const keys = config.indexes.map((i) => JSON.stringify([i.collectionGroup, i.queryScope, i.fields]));
  assert.equal(new Set(keys).size, keys.length);
});

test("members.userId has a collection-group index (ruling R24)", () => {
  const override = config.fieldOverrides.find(
    (o) => o.collectionGroup === "members" && o.fieldPath === "userId",
  );
  assert.ok(override, "fieldOverrides entry for members.userId");
  assert.ok(
    override.indexes.some((i) => i.queryScope === "COLLECTION_GROUP" && i.order === "ASCENDING"),
  );
});

test("indexes the Plan 3 queries need are present", () => {
  const has = (collectionGroup, fields) =>
    config.indexes.some(
      (i) =>
        i.collectionGroup === collectionGroup &&
        JSON.stringify(i.fields.map((f) => [f.fieldPath, f.order ?? f.arrayConfig])) ===
          JSON.stringify(fields),
    );
  const A = "ASCENDING";
  const D = "DESCENDING";
  const expected = [
    ["memories", [["communityId", A], ["isDeleted", A], ["privacy", A], ["moderation", A], ["createdAt", D]]],
    ["transfers", [["toUserId", A], ["createdAt", D]]],
    ["transfers", [["toUserId", A], ["status", A], ["createdAt", D]]],
    ["transfers", [["fromUserId", A], ["createdAt", D]]],
    ["transfers", [["placeId", A], ["toUserId", A], ["status", A]]],
    ["transfers", [["status", A], ["createdAt", A]]],
    ["notifications", [["readAt", A], ["createdAt", D]]],
  ];
  for (const [group, fields] of expected) {
    assert.ok(has(group, fields), `${group}: ${JSON.stringify(fields)}`);
  }
});
