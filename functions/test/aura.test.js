const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const cases = require(path.resolve(__dirname, "../../fixtures/domain/aura.json"));
const { calculateAura } = require("../aura");

for (const c of cases) {
  test(`calculateAura golden: ${c.name}`, () => {
    const now = new Date(c.now);
    const aura = calculateAura(
      c.memories.map((m) => ({
        sentiment: { compound: m.compound },
        createdAt: new Date(m.createdAt),
        isDeleted: m.isDeleted,
      })),
      now,
    );
    assert.equal(aura.dominantSentiment, c.expected.dominantSentiment);
    assert.equal(aura.colorHex, c.expected.colorHex);
    assert.equal(aura.memoryCount, c.expected.memoryCount);
    assert.ok(Math.abs(aura.compoundScore - c.expected.compoundScore) < 1e-10);
    assert.ok(Math.abs(aura.intensity - c.expected.intensity) < 1e-10);
    assert.equal(aura.updatedAt, now.toISOString());
  });
}
