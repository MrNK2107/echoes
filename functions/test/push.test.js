const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { sendPushForNotification } = require("../push");

const doc = {
  type: "memoryTagged",
  title: "Tagged",
  body: "Someone tagged you",
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
      body: "Someone tagged you",
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
