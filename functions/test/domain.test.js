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

// R21: functions/lib/profanity.json is a byte-for-byte copy of the shared fixture list.
const fs = require("node:fs");
test("lib/profanity.json equals fixtures/domain/profanity.json", () => {
  const copy = fs.readFileSync(path.resolve(__dirname, "../lib/profanity.json"), "utf8");
  const fixture = fs.readFileSync(path.resolve(__dirname, "../../fixtures/domain/profanity.json"), "utf8");
  // Line endings may differ with core.autocrlf; the content must not.
  const lf = (s) => s.replace(/\r\n/g, "\n");
  assert.equal(lf(copy), lf(fixture));
});
for (const c of f.containsProfanity) {
  test(`containsProfanity ${JSON.stringify(c.input)}`, () => {
    assert.equal(d.containsProfanity(c.input), c.expected);
  });
}
test("containsProfanity matches every listed word and leet variants", () => {
  for (const w of require("../../fixtures/domain/profanity.json")) {
    assert.equal(d.containsProfanity(`well ${w.toUpperCase()}!`), true, w);
  }
  assert.equal(d.containsProfanity("b1tch"), true);
  assert.equal(d.containsProfanity("$hit"), true);
});
