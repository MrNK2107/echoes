const assert = require("node:assert/strict");
const test = require("node:test");
const { __private__ } = require("./index");

test("buildMulticastMessage maps notification request fields", () => {
  const message = __private__.buildMulticastMessage(
    {
      title: "Tagged in a memory",
      body: "user-1 tagged you in a memory.",
      data: {
        type: "memoryTagged",
        memoryId: "memory-1",
        attempt: 1,
      },
    },
    ["token-1", "token-2"],
  );

  assert.deepEqual(message, {
    tokens: ["token-1", "token-2"],
    notification: {
      title: "Tagged in a memory",
      body: "user-1 tagged you in a memory.",
    },
    data: {
      type: "memoryTagged",
      memoryId: "memory-1",
      attempt: "1",
    },
  });
});

test("stringifyData ignores non-object payloads", () => {
  assert.deepEqual(__private__.stringifyData(null), {});
  assert.deepEqual(__private__.stringifyData(["not", "a", "map"]), {});
});

test("exports the daily purgeDeletedMemories job", () => {
  const index = require("./index");
  assert.ok(index.purgeDeletedMemories, "purgeDeletedMemories is exported");
  assert.ok(index.cleanupDeletedUser, "cleanupDeletedUser is still exported");
});

test("exports the transfer callables and the daily expiry job", () => {
  const index = require("./index");
  for (const name of ["initiateTransfer", "respondToTransfer", "revokeTransfer", "expireTransfers"]) {
    assert.ok(index[name], `${name} is exported`);
  }
});

test("exports the institution and safety callables", () => {
  const index = require("./index");
  for (const name of ["createInstitution", "claimInstitutionAdmin", "addInstitutionSubZone", "reportMemory", "reportContent"]) {
    assert.ok(index[name], `${name} is exported`);
  }
});

test("exports the push delivery trigger", () => {
  assert.ok(require("./index").onNotificationCreated, "onNotificationCreated is exported");
  assert.ok(require("./index").onPushTokenCreated, "onPushTokenCreated is exported");
});
