const test = require("node:test");
const assert = require("node:assert/strict");
const { HttpsError } = require("firebase-functions/v2/https");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler, validate } = require("../lib/callable");
const { incrementRateLimit } = require("../lib/rateLimit");
const { assertNotBlocked, isBlocked } = require("../lib/blocks");

const schema = {
  memoryId: { type: "string", min: 1, max: 50 },
  note: { type: "string", max: 10, optional: true },
  reason: { type: "string", enum: ["spam", "other"] },
};
const good = { memoryId: "m1", reason: "spam" };

async function codeOf(p) {
  try {
    await p;
  } catch (e) {
    return e.code;
  }
  return "none";
}

test("unauthenticated request is rejected", async () => {
  const h = buildHandler({ name: "x", schema }, async () => 1, () => createFakeFirestore());
  assert.equal(await codeOf(h({ data: good })), "unauthenticated");
});

test("bad input maps to invalid-argument", async () => {
  const h = buildHandler({ name: "x", schema }, async () => 1, () => createFakeFirestore());
  for (const data of [
    {},
    { ...good, memoryId: 5 },
    { ...good, reason: "nope" },
    { ...good, note: "way too long for this" },
    { ...good, extra: 1 },
    null,
  ]) {
    assert.equal(await codeOf(h({ auth: { uid: "u1" }, data })), "invalid-argument");
  }
});

test("handler receives uid, validated data and db", async () => {
  const db = createFakeFirestore();
  const h = buildHandler(
    { name: "x", schema },
    async (ctx) => ({ uid: ctx.uid, data: ctx.data, hasDb: ctx.db === db }),
    () => db,
  );
  const out = await h({ auth: { uid: "u1" }, data: { ...good, note: "hi" } });
  assert.deepEqual(out, { uid: "u1", data: { ...good, note: "hi" }, hasDb: true });
});

test("HttpsError passes through; unexpected errors become internal", async () => {
  const db = createFakeFirestore();
  const a = buildHandler({ name: "x", schema }, async () => { throw new HttpsError("not-found", "no"); }, () => db);
  assert.equal(await codeOf(a({ auth: { uid: "u" }, data: good })), "not-found");
  const b = buildHandler({ name: "x", schema }, async () => { throw new Error("boom secret"); }, () => db);
  try {
    await b({ auth: { uid: "u" }, data: good });
    assert.fail();
  } catch (e) {
    assert.equal(e.code, "internal");
    assert.ok(!e.message.includes("secret"));
  }
});

test("the 21st report in a day is resource-exhausted", async () => {
  const db = createFakeFirestore();
  const h = buildHandler(
    { name: "reportMemory", schema, rateLimit: { action: "report", perDay: 20 } },
    async () => "ok",
    () => db,
  );
  for (let i = 0; i < 20; i++) assert.equal(await h({ auth: { uid: "u1" }, data: good }), "ok");
  assert.equal(await codeOf(h({ auth: { uid: "u1" }, data: good })), "resource-exhausted");
  assert.equal(await h({ auth: { uid: "u2" }, data: good }), "ok");
});

test("rate limit is not consumed by invalid input", async () => {
  const db = createFakeFirestore();
  const h = buildHandler({ name: "x", schema, rateLimit: { action: "a", perDay: 1 } }, async () => "ok", () => db);
  await codeOf(h({ auth: { uid: "u1" }, data: {} }));
  assert.equal(await h({ auth: { uid: "u1" }, data: good }), "ok");
});

test("incrementRateLimit resets on a new day", async () => {
  const db = createFakeFirestore();
  const d1 = new Date("2026-10-19T10:00:00Z");
  const d2 = new Date("2026-10-20T00:00:01Z");
  await incrementRateLimit(db, "u1", "report", 1, d1);
  assert.equal(await codeOf(incrementRateLimit(db, "u1", "report", 1, d1)), "resource-exhausted");
  await incrementRateLimit(db, "u1", "report", 1, d2);
});

test("validate trims strings when asked and checks numbers/arrays", () => {
  const out = validate(
    { n: { type: "string", min: 2, trim: true }, k: { type: "number", optional: true }, ids: { type: "array", max: 2, items: "string" } },
    { n: "  ab ", ids: ["a"] },
  );
  assert.deepEqual(out, { n: "ab", ids: ["a"] });
  assert.throws(() => validate({ ids: { type: "array", max: 1, items: "string" } }, { ids: ["a", "b"] }), /ids/);
  assert.throws(() => validate({ ids: { type: "array", items: "string" } }, { ids: [1] }), /ids/);
});

test("assertNotBlocked checks both directions", async () => {
  const db = createFakeFirestore({ "users/b/blocks/a": { createdAt: "x" } });
  assert.equal(await codeOf(assertNotBlocked(db, "a", "b")), "permission-denied");
  assert.equal(await codeOf(assertNotBlocked(db, "b", "a")), "permission-denied");
  assert.equal(await codeOf(assertNotBlocked(db, "a", "c")), "none");
  assert.equal(await isBlocked(db, "a", "b"), true);
  assert.equal(await isBlocked(db, "a", "c"), false);
});
