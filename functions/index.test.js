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
