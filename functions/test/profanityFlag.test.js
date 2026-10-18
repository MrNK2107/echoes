const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { handleMemoryWrite } = require("../onMemoryWritten");

const now = new Date("2026-10-19T09:00:00.000Z");
// No placeId: keeps these tests to the create-time hooks.
const memory = (over = {}) => ({
  userId: "author",
  privacy: "public",
  isDeleted: false,
  textContent: "A lovely day",
  createdAt: "2026-10-19T08:00:00.000Z",
  ...over,
});

function seed(m) {
  return createFakeFirestore({ "users/author": { communityIds: [] }, "memories/m1": m });
}

test("the profanity flag is set on create when the text contains profanity", async () => {
  const after = memory({ textContent: "what the fuck" });
  const db = seed(after);
  await handleMemoryWrite(db, { memoryId: "m1", before: null, after }, now);
  assert.deepEqual(db._get("memories/m1").flags, { profanity: true });
  assert.equal(db._get("memories/m1").textContent, "what the fuck");
});

test("clean text gets no flags write", async () => {
  const after = memory();
  const db = seed(after);
  await handleMemoryWrite(db, { memoryId: "m1", before: null, after }, now);
  assert.equal("flags" in db._get("memories/m1"), false);
});

test("the profanity flag is idempotent and keeps other flags", async () => {
  const after = memory({ textContent: "sh1t", flags: { other: true } });
  const db = seed(after);
  await handleMemoryWrite(db, { memoryId: "m1", before: null, after }, now);
  await handleMemoryWrite(db, { memoryId: "m1", before: null, after: db._get("memories/m1") }, now);
  assert.deepEqual(db._get("memories/m1").flags, { other: true, profanity: true });
});

test("an edit that introduces profanity is flagged too", async () => {
  const before = memory();
  const after = memory({ textContent: "you asshole" });
  const db = seed(after);
  await handleMemoryWrite(db, { memoryId: "m1", before, after }, now);
  assert.deepEqual(db._get("memories/m1").flags, { profanity: true });
});

test("an already-flagged memory gets no further write", async () => {
  const flagged = memory({ textContent: "you asshole", flags: { profanity: true } });
  const db = seed(flagged);
  let updates = 0;
  const realDoc = db.doc;
  db.doc = (p) => {
    const ref = realDoc(p);
    return { ...ref, update: async (d) => (updates++, ref.update(d)) };
  };
  const realCollection = db.collection;
  db.collection = (p) => {
    const col = realCollection(p);
    if (p !== "memories") return col;
    return { ...col, doc: (id) => db.doc(`memories/${id}`) };
  };
  await handleMemoryWrite(db, { memoryId: "m1", before: flagged, after: { ...flagged, privacy: "private" } }, now);
  assert.equal(updates, 0);
});

test("a memory deleted before the flag lands is not recreated", async () => {
  const after = memory({ textContent: "fuck" });
  const db = createFakeFirestore({ "users/author": { communityIds: [] } });
  await handleMemoryWrite(db, { memoryId: "m1", before: null, after }, now);
  assert.equal(db._get("memories/m1"), undefined);
});
