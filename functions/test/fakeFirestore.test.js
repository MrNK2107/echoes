const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const { createFakeFirestore } = require("./fakes/firestore");

const ids = (snap) => snap.docs.map((d) => d.id);

test("range operators only match values of the same type", async () => {
  const db = createFakeFirestore({
    "c/num": { v: 5 },
    "c/str": { v: "5" },
    "c/ts": { v: Timestamp.fromMillis(5000) },
    "c/none": {},
  });
  assert.deepEqual(ids(await db.collection("c").where("v", ">", 1).get()), ["num"]);
  assert.deepEqual(ids(await db.collection("c").where("v", "<=", "9").get()), ["str"]);
  assert.deepEqual(ids(await db.collection("c").where("v", ">=", Timestamp.fromMillis(1000)).get()), ["ts"]);
  assert.deepEqual(ids(await db.collection("c").where("v", "<", new Date(9000)).get()), ["ts"]);
});

test("!= and == compare Timestamps by instant", async () => {
  const db = createFakeFirestore({
    "c/a": { v: Timestamp.fromMillis(5000) },
    "c/b": { v: Timestamp.fromMillis(6000) },
  });
  assert.deepEqual(ids(await db.collection("c").where("v", "!=", Timestamp.fromMillis(5000)).get()), ["b"]);
  assert.deepEqual(ids(await db.collection("c").where("v", "==", new Date(5000)).get()), ["a"]);
});

test("count() aggregates the matching docs of a collection or query", async () => {
  const db = createFakeFirestore({
    "c/a": { n: 1 },
    "c/b": { n: 2 },
    "c/b/sub/x": { n: 1 },
    "c/c": { n: 2 },
  });
  assert.equal((await db.collection("c").count().get()).data().count, 3);
  assert.equal((await db.collection("c").where("n", "==", 2).count().get()).data().count, 2);
  assert.equal((await db.collection("c/b/sub").count().get()).data().count, 1);
  assert.equal((await db.collection("nothing").count().get()).data().count, 0);
});

test("startAfter(snapshot) uses the snapshot's values with the path as tie-break", async () => {
  const db = createFakeFirestore({
    "c/a": { n: 1 },
    "c/b": { n: 1 },
    "c/c": { n: 1 },
    "c/d": { n: 2 },
  });
  const q = () => db.collection("c").orderBy("n");
  const first = await q().limit(2).get();
  assert.deepEqual(ids(first), ["a", "b"]);
  assert.deepEqual(ids(await q().startAfter(first.docs[1]).get()), ["c", "d"]);
  // The cursor doc no longer matches the query (and may be gone): the cursor still works.
  const cursor = first.docs[1];
  await db.doc("c/b").delete();
  assert.deepEqual(ids(await q().startAfter(cursor).get()), ["c", "d"]);
  await db.doc("c/a").update({ n: 99 });
  assert.deepEqual(ids(await q().startAfter(cursor).get()), ["c", "d", "a"]);
});
