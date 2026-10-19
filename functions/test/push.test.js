const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { sendPushForNotification, PUSH_BODIES, receiptsHandler, checkPushReceipts, createOnPushTokenCreated } = require("../push");

const doc = {
  type: "memoryTagged",
  title: "Tagged",
  body: "Someone tagged you in a memory.",
  data: { memoryId: "m1" },
  createdAt: "2026-10-19T00:00:00.000Z",
  readAt: null,
  expireAt: new Date(0),
};

const seedTokens = (db, n, uid = "u1") => {
  for (let i = 0; i < n; i++) {
    db._put(`users/${uid}/pushTokens/t${i}`, {
      token: `ExponentPushToken[${i}]`,
      platform: "ios",
      createdAt: "2026-10-01T00:00:00.000Z",
      lastSeenAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString(),
    });
  }
};

const okFetch = (calls) => async (url, init) => {
  const messages = JSON.parse(init.body);
  calls.push({ url, init, messages });
  return { ok: true, status: 200, json: async () => ({ data: messages.map(() => ({ status: "ok" })) }) };
};

test("no tokens means no fetch", async () => {
  const db = createFakeFirestore();
  const calls = [];
  await sendPushForNotification(db, "u1", "n1", doc, { fetch: okFetch(calls) });
  assert.equal(calls.length, 0);
});

test("builds the message without expireAt/readAt", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  const calls = [];
  await sendPushForNotification(db, "u1", "n1", doc, { fetch: okFetch(calls), env: {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://exp.host/--/api/v2/push/send");
  assert.deepEqual(calls[0].messages, [
    {
      to: "ExponentPushToken[0]",
      title: "Tagged",
      body: "Someone tagged you in a memory.",
      data: { type: "memoryTagged", notificationId: "n1", memoryId: "m1" },
      sound: "default",
      channelId: "default",
    },
  ]);
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test("adds a bearer header when EXPO_ACCESS_TOKEN is set", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  const calls = [];
  await sendPushForNotification(db, "u1", "n1", doc, {
    fetch: okFetch(calls),
    env: { EXPO_ACCESS_TOKEN: "secret" },
  });
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret");
});

test("sends only the 10 most recently seen tokens, in chunks of 100", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 230);
  const calls = [];
  await sendPushForNotification(db, "u1", "n1", doc, { fetch: okFetch(calls) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].messages.length, 10);
  assert.equal(calls[0].messages[0].to, "ExponentPushToken[229]");

  const many = [];
  await sendPushForNotification(db, "u1", "n1", doc, { fetch: okFetch(many), maxTokens: 230 });
  assert.deepEqual(many.map((c) => c.messages.length), [100, 100, 30]);
});

test("removes tokens reported DeviceNotRegistered", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 3);
  const fetch = async (url, init) => {
    const messages = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: messages.map((m) =>
          m.to === "ExponentPushToken[1]"
            ? { status: "error", details: { error: "DeviceNotRegistered" } }
            : m.to === "ExponentPushToken[2]"
              ? { status: "error", details: { error: "MessageRateExceeded" } }
              : { status: "ok" },
        ),
      }),
    };
  };
  await sendPushForNotification(db, "u1", "n1", doc, { fetch });
  assert.equal(db._get("users/u1/pushTokens/t1"), undefined);
  assert.ok(db._get("users/u1/pushTokens/t0"));
  assert.ok(db._get("users/u1/pushTokens/t2"));
});

test("a fetch failure is logged and does not throw", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 2);
  const logs = [];
  const logger = { error: (...a) => logs.push(a), warn: (...a) => logs.push(a), info() {} };
  await sendPushForNotification(db, "u1", "n1", doc, {
    fetch: async () => { throw new Error("network down"); },
    logger,
  });
  await sendPushForNotification(db, "u1", "n1", doc, {
    fetch: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    logger,
  });
  assert.equal(logs.length, 2);
  assert.ok(db._get("users/u1/pushTokens/t0"));
});

test("account deletion's recursiveDelete of users/{uid} removes pushTokens", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 2);
  seedTokens(db, 1, "u2");
  await db.recursiveDelete(db.collection("users").doc("u1"));
  assert.deepEqual(db._list("users/u1/pushTokens"), []);
  assert.equal(db._list("users/u2/pushTokens").length, 1);
});

test("doc.data cannot override type or notificationId", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  const calls = [];
  await sendPushForNotification(
    db, "u1", "n1",
    { ...doc, data: { type: "evil", notificationId: "evil", memoryId: "m1" } },
    { fetch: okFetch(calls) },
  );
  assert.deepEqual(calls[0].messages[0].data, { memoryId: "m1", type: "memoryTagged", notificationId: "n1" });
});

test("a notification with a missing title or an unknown type is skipped and logged", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  const calls = [];
  const logs = [];
  const logger = { error: (...a) => logs.push(a), warn: (...a) => logs.push(a), info() {} };
  await sendPushForNotification(db, "u1", "n1", { ...doc, title: undefined }, { fetch: okFetch(calls), logger });
  await sendPushForNotification(db, "u1", "n1", { ...doc, type: "somethingNew" }, { fetch: okFetch(calls), logger });
  assert.equal(calls.length, 0);
  assert.equal(logs.length, 2);
});

test("push bodies are the generic spec copy per type", () => {
  assert.deepEqual(PUSH_BODIES, {
    memoryTagged: "Someone tagged you in a memory.",
    transferRequest: "You have a new custodianship request.",
    transferAccepted: "Your custodianship request was accepted.",
    transferRejected: "Your custodianship request was declined.",
    communityInvite: "You have a new community invitation.",
  });
});

test("the push body for communityInvite is generic and contains no community name", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  const calls = [];
  await sendPushForNotification(
    db, "u1", "n1",
    { ...doc, type: "communityInvite", title: "Community invitation", body: "Ana invited you to Secret Club", data: { communityId: "c1" } },
    { fetch: okFetch(calls) },
  );
  assert.equal(calls[0].messages[0].body, "You have a new community invitation.");
  assert.equal(calls[0].messages[0].title, "Community invitation");
  assert.ok(!JSON.stringify(calls[0].messages).includes("Secret Club"));
});

const asMs = (v) => (v?.toDate ? v.toDate() : new Date(v)).getTime();

test("ok tickets write pushReceipts with uid, tokenId, createdAt and expireAt (+1 day)", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 2);
  const now = new Date("2026-10-19T12:00:00.000Z");
  const fetch = async (url, init) => ({
    ok: true, status: 200,
    json: async () => ({
      data: JSON.parse(init.body).map((m, i) =>
        i === 0 ? { status: "ok", id: "tk-a" } : { status: "error", details: { error: "MessageRateExceeded" } }),
    }),
  });
  await sendPushForNotification(db, "u1", "n1", doc, { fetch, now: () => now });
  const receipt = db._get("pushReceipts/tk-a");
  assert.equal(receipt.uid, "u1");
  assert.equal(receipt.tokenId, "t1");
  assert.equal(asMs(receipt.createdAt), now.getTime());
  assert.equal(asMs(receipt.expireAt), now.getTime() + 86_400_000);
  assert.equal(db._list("pushReceipts").length, 1);
});

test("malformed JSON in the response is logged and does not throw", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  const logs = [];
  const logger = { error: (...a) => logs.push(a), warn: (...a) => logs.push(a), info() {} };
  await sendPushForNotification(db, "u1", "n1", doc, {
    fetch: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } }),
    logger,
  });
  assert.equal(logs.length, 1);
  assert.ok(db._get("users/u1/pushTokens/t0"));
});

test("a DeviceNotRegistered ticket in the second chunk deletes the right token", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 150);
  // most recent first: index 149 is first; the 101st message (second chunk, index 0) is token 49.
  const fetch = async (url, init) => {
    const messages = JSON.parse(init.body);
    return {
      ok: true, status: 200,
      json: async () => ({
        data: messages.map((m) =>
          m.to === "ExponentPushToken[48]"
            ? { status: "error", details: { error: "DeviceNotRegistered" } }
            : { status: "ok" }),
      }),
    };
  };
  await sendPushForNotification(db, "u1", "n1", doc, { fetch, maxTokens: 150 });
  assert.equal(db._get("users/u1/pushTokens/t48"), undefined);
  assert.equal(db._list("users/u1/pushTokens/").length, 149);
});

const { removeTokenFromOtherUsers } = require("../push");

test("a token registered by a new user is removed from the previous user", async () => {
  const db = createFakeFirestore();
  const tokenDoc = (token) => ({ token, platform: "ios", createdAt: "x", lastSeenAt: "x" });
  db._put("users/A/pushTokens/h1", tokenDoc("ExponentPushToken[T]"));
  db._put("users/A/pushTokens/other", tokenDoc("ExponentPushToken[A-other]"));
  db._put("users/B/pushTokens/h1", tokenDoc("ExponentPushToken[T]"));
  await removeTokenFromOtherUsers(db, "B", "ExponentPushToken[T]");
  assert.equal((await db.doc("users/A/pushTokens/h1").get()).exists, false);
  assert.equal((await db.doc("users/A/pushTokens/other").get()).exists, true);
  assert.equal((await db.doc("users/B/pushTokens/h1").get()).exists, true);
});

test("removeTokenFromOtherUsers never throws", async () => {
  const logged = [];
  const db = { collectionGroup: () => ({ where: () => ({ limit: () => ({ get: async () => { throw new Error("boom"); } }) }) }) };
  await removeTokenFromOtherUsers(db, "B", "t", { logger: { error: (m) => logged.push(m) } });
  assert.equal(logged.length, 1);
});

const { trimUserTokens } = require("../push");

test("reads tokens with a bounded orderBy+limit query, never an unbounded get", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 12);
  const real = db.collection.bind(db);
  const guardRef = (ref) => new Proxy(ref, {
    get: (t, p) => {
      if (p === "get") return () => { throw new Error("unbounded read"); };
      const v = t[p];
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
  db.collection = (name) => {
    const col = real(name);
    return {
      doc: (id) => {
        const d = col.doc(id);
        return { collection: (sub) => guardRef(d.collection(sub)) };
      },
    };
  };
  const calls = [];
  await sendPushForNotification(db, "u1", "n1", doc, { fetch: okFetch(calls) });
  assert.equal(calls[0].messages.length, 10);
  assert.equal(calls[0].messages[0].to, "ExponentPushToken[11]");
  assert.equal(calls[0].messages[9].to, "ExponentPushToken[2]");
});

test("trimUserTokens keeps only the 10 most recent tokens of that user", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 12);
  seedTokens(db, 12, "u2");
  await trimUserTokens(db, "u1");
  const left = db._list("users/u1/pushTokens").length;
  assert.equal(left, 10);
  assert.equal(db._get("users/u1/pushTokens/t0"), undefined);
  assert.equal(db._get("users/u1/pushTokens/t1"), undefined);
  assert.ok(db._get("users/u1/pushTokens/t11"));
  assert.equal(db._list("users/u2/pushTokens").length, 12);
});

test("trimUserTokens never throws", async () => {
  const logged = [];
  const db = { collection: () => { throw new Error("boom"); } };
  await trimUserTokens(db, "u1", { logger: { error: (m) => logged.push(m) } });
  assert.equal(logged.length, 1);
});

test("ticket errors other than DeviceNotRegistered are logged without token values", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 2);
  const warns = [];
  const logger = { error() {}, info() {}, warn: (...a) => warns.push(a) };
  await sendPushForNotification(db, "u1", "n1", doc, {
    logger,
    fetch: async (url, init) => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: JSON.parse(init.body).map((m, i) =>
          i === 0
            ? { status: "error", message: `bad ${m.to}`, details: { error: "MessageRateExceeded" } }
            : { status: "error", details: { error: "DeviceNotRegistered" } },
        ),
      }),
    }),
  });
  assert.equal(warns.length, 1);
  const text = JSON.stringify(warns);
  assert.ok(text.includes("MessageRateExceeded"));
  assert.ok(!text.includes("ExponentPushToken"));
});

test("removeTokenFromOtherUsers reads at most 20 docs", async () => {
  const db = createFakeFirestore();
  for (let i = 0; i < 30; i++) {
    db._put(`users/other${i}/pushTokens/h`, { token: "ExponentPushToken[T]", platform: "ios", createdAt: "x", lastSeenAt: "x" });
  }
  await removeTokenFromOtherUsers(db, "B", "ExponentPushToken[T]");
  const left = Array.from({ length: 30 }, (_, i) => db._get(`users/other${i}/pushTokens/h`)).filter(Boolean).length;
  assert.equal(left, 10);
});

test("onPushTokenCreated relays (uid, token) to the dedupe and then trims the user's tokens", async () => {
  const db = createFakeFirestore();
  const tokenDoc = (token, i) => ({ token, platform: "ios", createdAt: "x", lastSeenAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)).toISOString() });
  db._put("users/A/pushTokens/h1", tokenDoc("ExponentPushToken[T]", 0));
  for (let i = 0; i < 11; i++) {
    db._put(`users/B/pushTokens/b${i}`, tokenDoc(i === 10 ? "ExponentPushToken[T]" : `ExponentPushToken[b${i}]`, i + 1));
  }
  const fn = createOnPushTokenCreated(() => db);
  await fn.run({ params: { uid: "B", tokenId: "b10" }, data: { data: () => ({ token: "ExponentPushToken[T]" }) } });
  assert.equal(db._get("users/A/pushTokens/h1"), undefined);
  assert.equal(db._list("users/B/pushTokens").length, 10);
  assert.equal(db._get("users/B/pushTokens/b0"), undefined);
  await fn.run({ params: { uid: "B", tokenId: "x" }, data: { data: () => ({}) } });
  assert.equal(db._list("users/B/pushTokens").length, 10);
});

// ---- receipts ----
const NOW = new Date("2026-10-19T12:00:00.000Z");
const minutesAgo = (m) => new Date(NOW.getTime() - m * 60_000);
const putReceipt = (db, id, ageMin, extra = {}) =>
  db._put(`pushReceipts/${id}`, { uid: "u1", tokenId: "t0", createdAt: minutesAgo(ageMin), expireAt: new Date(NOW.getTime() + 86_400_000), ...extra });
const receiptFetch = (calls, statusFor = () => ({ status: "ok" })) => async (url, init) => {
  const { ids } = JSON.parse(init.body);
  calls.push({ url, init, ids });
  return { ok: true, status: 200, json: async () => ({ data: Object.fromEntries(ids.map((id) => [id, statusFor(id)])) }) };
};

test("receipts: DeviceNotRegistered deletes the token and the receipt doc; ok deletes the receipt", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 2);
  putReceipt(db, "r-bad", 20, { tokenId: "t1" });
  putReceipt(db, "r-ok", 20, { tokenId: "t0" });
  const calls = [];
  await receiptsHandler(
    db,
    receiptFetch(calls, (id) => (id === "r-bad" ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" })),
    () => NOW,
    { env: { EXPO_ACCESS_TOKEN: "s" } },
  );
  assert.equal(calls[0].url, "https://exp.host/--/api/v2/push/getReceipts");
  assert.equal(calls[0].init.headers.Authorization, "Bearer s");
  assert.equal(db._get("users/u1/pushTokens/t1"), undefined);
  assert.ok(db._get("users/u1/pushTokens/t0"));
  assert.equal(db._get("pushReceipts/r-bad"), undefined);
  assert.equal(db._get("pushReceipts/r-ok"), undefined);
});

test("receipts: a receipt younger than 15 minutes is left alone", async () => {
  const db = createFakeFirestore();
  putReceipt(db, "old", 16);
  putReceipt(db, "fresh", 5);
  const calls = [];
  await receiptsHandler(db, receiptFetch(calls), () => NOW);
  assert.deepEqual(calls.flatMap((c) => c.ids), ["old"]);
  assert.ok(db._get("pushReceipts/fresh"));
  assert.equal(db._get("pushReceipts/old"), undefined);
});

test("receipts: processes at most 1000 receipts per run, in chunks of 300", async () => {
  const db = createFakeFirestore();
  for (let i = 0; i < 1100; i++) putReceipt(db, `r${String(i).padStart(4, "0")}`, 60 + (1100 - i) / 100);
  const calls = [];
  await receiptsHandler(db, receiptFetch(calls), () => NOW);
  assert.deepEqual(calls.map((c) => c.ids.length), [300, 300, 300, 100]);
  const left = db._list("pushReceipts").length;
  assert.equal(left, 100);
  for (let i = 1000; i < 1100; i++) assert.ok(db._get("pushReceipts/r" + String(i).padStart(4, "0")), "newest kept");
  assert.equal(db._get("pushReceipts/r0000"), undefined);
});

test("receipts: a fetch failure keeps the receipt docs", async () => {
  const db = createFakeFirestore();
  putReceipt(db, "r1", 30);
  putReceipt(db, "r2", 30);
  const logger = { error() {}, warn() {}, info() {} };
  await receiptsHandler(db, async () => { throw new Error("down"); }, () => NOW, { logger });
  await receiptsHandler(db, async () => ({ ok: false, status: 500, json: async () => ({}) }), () => NOW, { logger });
  assert.equal(db._list("pushReceipts").length, 2);
});

test("receipts: ids Expo does not know yet are kept", async () => {
  const db = createFakeFirestore();
  putReceipt(db, "r1", 30);
  await receiptsHandler(db, async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }), () => NOW);
  assert.ok(db._get("pushReceipts/r1"));
});

test("checkPushReceipts runs every 30 minutes", () => {
  assert.equal(checkPushReceipts.__endpoint.scheduleTrigger.schedule, "every 30 minutes");
});

test("receipts: an id Expo does not know is deleted once it is older than 24 h, kept before", async () => {
  const db = createFakeFirestore();
  putReceipt(db, "stale", 25 * 60);
  putReceipt(db, "recent", 60);
  const summary = await receiptsHandler(db, async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }), () => NOW);
  assert.equal(db._get("pushReceipts/stale"), undefined);
  assert.ok(db._get("pushReceipts/recent"));
  assert.equal(summary.expiredReceipts, 1);
});

test("receipts: an error other than DeviceNotRegistered logs the code only and deletes the receipt", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 1);
  putReceipt(db, "r1", 30);
  const warns = [];
  const logger = { error() {}, info() {}, warn: (...a) => warns.push(a) };
  await receiptsHandler(
    db,
    receiptFetch([], () => ({ status: "error", message: "bad ExponentPushToken[0]", details: { error: "MessageRateExceeded" } })),
    () => NOW,
    { logger },
  );
  assert.equal(db._get("pushReceipts/r1"), undefined);
  assert.ok(db._get("users/u1/pushTokens/t0"));
  const text = JSON.stringify(warns);
  assert.equal(warns.length, 1);
  assert.ok(text.includes("MessageRateExceeded"));
  assert.ok(!text.includes("ExponentPushToken"));
});

test("a failing receipt write does not stop DeviceNotRegistered pruning, and is logged on its own", async () => {
  const db = createFakeFirestore();
  seedTokens(db, 2);
  const real = db.collection.bind(db);
  db.collection = (name) => {
    if (name === "pushReceipts") throw new Error("write failed");
    return real(name);
  };
  const logs = [];
  const logger = { error: (m) => logs.push(m), warn() {}, info() {} };
  const fetch = async (url, init) => ({
    ok: true, status: 200,
    json: async () => ({
      data: JSON.parse(init.body).map((m, i) =>
        i === 0 ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: "tk" }),
    }),
  });
  await sendPushForNotification(db, "u1", "n1", doc, { fetch, logger });
  assert.equal(db._get("users/u1/pushTokens/t1"), undefined);
  assert.deepEqual(logs, ["Could not store a push receipt"]);
});
