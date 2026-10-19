const assert = require("node:assert/strict");
const test = require("node:test");

test("the legacy dispatchNotificationRequest push function is gone", () => {
  const index = require("./index");
  assert.equal(index.dispatchNotificationRequest, undefined, "dispatchNotificationRequest is not exported");
  assert.equal(index.__private__.buildMulticastMessage, undefined);
  assert.equal(index.__private__.stringifyData, undefined);
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
  assert.equal(require("./index").checkPushReceipts.__endpoint.scheduleTrigger.schedule, "every 30 minutes");
});

test("global options cap every function at 50 instances and the rollup is exported", () => {
  const index = require("./index");
  assert.equal(index.joinCommunity.__endpoint.maxInstances, 50);
  assert.equal(index.purgeDeletedMemories.__endpoint.maxInstances, 50);
  assert.ok(index.rollupMemberCounts, "rollupMemberCounts is exported");
  assert.equal(index.rollupMemberCounts.__endpoint.maxInstances, 50);
  assert.equal(
    index.rollupMemberCounts.__endpoint.scheduleTrigger.schedule,
    "every 10 minutes",
  );
  const src = require("node:fs").readFileSync(require.resolve("./index"), "utf8");
  assert.match(src.split("\n")[0], /require\("\.\/globalOptions"\)/);
});
