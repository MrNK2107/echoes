const test = require("node:test");
const assert = require("node:assert/strict");
const { __private__ } = require("../purgeDeletedMemories");

const { purgeExpired, PURGE_BATCH_SIZE } = __private__;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-19T00:00:00.000Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY_MS);
// The real data holds Firestore Timestamps; the fake compares via toDate() like the admin SDK.
const ts = (d) => ({ toDate: () => d });

/** A minimal in-memory stand-in for the admin Firestore API purgeExpired uses. */
function fakeDb(docs) {
  const store = new Map(Object.entries(docs));
  const stats = { batches: [], queries: 0 };
  const asDate = (v) => (v && typeof v.toDate === "function" ? v.toDate() : v);
  const compare = (a, op, b) => {
    const x = asDate(a);
    const y = asDate(b);
    if (op === "==") return x === y;
    if (op === "<") return x instanceof Date && y instanceof Date && x.getTime() < y.getTime();
    throw new Error(`unsupported op ${op}`);
  };
  const makeQuery = (filters, order, max) => ({
    where: (field, op, value) => makeQuery([...filters, { field, op, value }], order, max),
    orderBy: (field, dir = "asc") => makeQuery(filters, { field, dir }, max),
    limit: (n) => makeQuery(filters, order, n),
    async get() {
      stats.queries += 1;
      let rows = [...store.entries()].filter(([, data]) =>
        filters.every((f) => compare(data[f.field], f.op, f.value)),
      );
      if (order) {
        rows.sort(
          ([, a], [, b]) => asDate(a[order.field]).getTime() - asDate(b[order.field]).getTime(),
        );
      }
      if (max !== undefined) rows = rows.slice(0, max);
      return {
        size: rows.length,
        empty: rows.length === 0,
        docs: rows.map(([id, data]) => ({ id, ref: { id }, data: () => data })),
      };
    },
  });
  return {
    store,
    stats,
    collection(name) {
      assert.equal(name, "memories");
      return makeQuery([], null, undefined);
    },
    batch() {
      const ops = [];
      return {
        delete(ref) { ops.push(ref.id); },
        async commit() {
          assert.ok(ops.length <= 500, `batch too large: ${ops.length}`);
          stats.batches.push(ops.length);
          for (const id of ops) store.delete(id);
        },
      };
    },
  };
}

/** Fake bucket: deleting a missing file rejects with code 404 like @google-cloud/storage. */
function fakeBucket(existing) {
  const files = new Set(existing);
  const deleted = [];
  return {
    files,
    deleted,
    file(path) {
      return {
        async delete() {
          if (!files.has(path)) {
            const e = new Error(`No such object: ${path}`);
            e.code = 404;
            throw e;
          }
          files.delete(path);
          deleted.push(path);
        },
      };
    },
  };
}

const memory = (userId, over = {}) => ({
  userId,
  placeId: "p",
  isDeleted: false,
  deletedAt: null,
  ...over,
});

test("purges memories deleted more than 30 days ago with their files, keeps the rest", async () => {
  const db = fakeDb({
    old: memory("u1", { isDeleted: true, deletedAt: ts(daysAgo(31)) }),
    recent: memory("u1", { isDeleted: true, deletedAt: ts(daysAgo(29)) }),
    live: memory("u2"),
  });
  const bucket = fakeBucket([
    "memory-images/u1/old.jpg",
    "memory-audio/u1/old.m4a",
    "memory-images/u1/recent.jpg",
    "memory-images/u2/live.jpg",
  ]);

  const purged = await purgeExpired(db, bucket, NOW);

  assert.equal(purged, 1);
  assert.deepEqual([...db.store.keys()].sort(), ["live", "recent"]);
  assert.deepEqual(bucket.deleted.sort(), ["memory-audio/u1/old.m4a", "memory-images/u1/old.jpg"]);
  assert.deepEqual([...bucket.files].sort(), ["memory-images/u1/recent.jpg", "memory-images/u2/live.jpg"]);
});

test("tolerates memories without stored files", async () => {
  const db = fakeDb({ old: memory("u1", { isDeleted: true, deletedAt: ts(daysAgo(40)) }) });
  const bucket = fakeBucket([]);
  assert.equal(await purgeExpired(db, bucket, NOW), 1);
  assert.equal(db.store.size, 0);
});

test("rethrows storage errors other than 404 and keeps the memory", async () => {
  const db = fakeDb({ old: memory("u1", { isDeleted: true, deletedAt: ts(daysAgo(40)) }) });
  const bucket = {
    file: () => ({
      async delete() {
        const e = new Error("boom");
        e.code = 500;
        throw e;
      },
    }),
  };
  await assert.rejects(purgeExpired(db, bucket, NOW), /boom/);
  assert.equal(db.store.size, 1);
});

test("paginates in batches of at most 500", async () => {
  assert.equal(PURGE_BATCH_SIZE, 500);
  const docs = {};
  for (let i = 0; i < 1203; i += 1) {
    docs[`m${i}`] = memory("u", { isDeleted: true, deletedAt: ts(daysAgo(31 + (i % 5))) });
  }
  const db = fakeDb(docs);
  const purged = await purgeExpired(db, fakeBucket([]), NOW);
  assert.equal(purged, 1203);
  assert.equal(db.store.size, 0);
  assert.deepEqual(db.stats.batches, [500, 500, 203]);
});

test("does nothing when nothing has expired", async () => {
  const db = fakeDb({ live: memory("u"), recent: memory("u", { isDeleted: true, deletedAt: ts(daysAgo(1)) }) });
  assert.equal(await purgeExpired(db, fakeBucket([]), NOW), 0);
  assert.equal(db.store.size, 2);
  assert.deepEqual(db.stats.batches, []);
});
