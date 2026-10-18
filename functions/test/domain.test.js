const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const f = require(path.resolve(__dirname, "../../fixtures/domain/communities.json"));
const d = require("../lib/domain");

for (const c of f.normalizeName) {
  test(`normalizeName ${JSON.stringify(c.input)}`, () => {
    assert.equal(d.normalizeName(c.input), c.expected);
  });
}
for (const c of f.searchRange) {
  test(`searchRange ${JSON.stringify(c.input)}`, () => {
    assert.deepEqual(d.searchRange(c.input), c.expected);
  });
}
for (const c of f.yearCommunity) {
  test(`yearCommunity ${c.input}`, () => {
    assert.deepEqual(d.yearCommunity(new Date(c.input)), c.expected);
  });
}
for (const c of f.eraCommunity) {
  test(`eraCommunity ${c.input}`, () => {
    assert.deepEqual(d.eraCommunity(new Date(c.input)), c.expected);
  });
}
for (const c of f.geoCommunity) {
  test(`geoCommunity ${c.input.id}`, () => {
    assert.deepEqual(d.geoCommunity(c.input), c.expected);
  });
}
test("GEO_THRESHOLD is 5", () => assert.equal(d.GEO_THRESHOLD, 5));
