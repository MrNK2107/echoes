const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const cases = require(path.resolve(__dirname, "../../fixtures/domain/visibility.json"));
const { isVisibleMemory, canViewMemory } = require("../lib/visibility");
const { createFakeFirestore } = require("./fakes/firestore");

// Same cases the client's isMemoryVisibleTo is tested against.
for (const c of cases) {
  test(`visibility fixture: ${c.name}`, () => {
    const memory = { ...c.memory, releaseDate: c.memory.releaseDate };
    const visible = isVisibleMemory(memory, {
      viewerId: c.viewerId,
      viewerIsCommunityMember: c.viewerIsCommunityMember,
      now: new Date(c.now),
    });
    assert.equal(visible, c.visible);
  });
}

const now = new Date("2026-10-18T09:00:00.000Z");
const base = { userId: "author", privacy: "public", taggedUserIds: [], releaseDate: null, isDeleted: false };
const viewer = (viewerId, viewerIsCommunityMember = false) => ({ viewerId, viewerIsCommunityMember, now });

test("hidden memories are invisible to everyone, like the rules' isVisibleMemory", () => {
  const hidden = { ...base, moderation: "hidden" };
  assert.equal(isVisibleMemory(hidden, viewer("stranger")), false);
  assert.equal(isVisibleMemory(hidden, viewer("author")), false);
  assert.equal(isVisibleMemory({ ...base, moderation: null }, viewer("stranger")), true);
});

test("a memory without isDeleted == false is not visible (rules require it)", () => {
  const { isDeleted, ...noFlag } = base;
  assert.equal(isVisibleMemory(noFlag, viewer("stranger")), false);
});

test("releaseDate may be a Firestore Timestamp", () => {
  const ts = (iso) => ({ toDate: () => new Date(iso) });
  const m = { ...base, privacy: "timeRelease" };
  assert.equal(isVisibleMemory({ ...m, releaseDate: ts("2026-10-18T08:00:00Z") }, viewer("s")), true);
  assert.equal(isVisibleMemory({ ...m, releaseDate: ts("2026-10-18T10:00:00Z") }, viewer("s")), false);
});

test("tagged needs an array that contains the viewer", () => {
  const m = { ...base, privacy: "tagged" };
  assert.equal(isVisibleMemory({ ...m, taggedUserIds: undefined }, viewer("friend")), false);
  assert.equal(isVisibleMemory({ ...m, taggedUserIds: ["friend"] }, viewer("friend")), true);
});

test("canViewMemory looks up community membership only for community memories", async () => {
  const db = createFakeFirestore({ "communities/c1/members/member": { userId: "member", role: "member" } });
  const m = { ...base, privacy: "community", communityId: "c1" };
  assert.equal(await canViewMemory(db, m, "member", now), true);
  assert.equal(await canViewMemory(db, m, "stranger", now), false);
  assert.equal(await canViewMemory(db, { ...m, communityId: null }, "member", now), false);
  assert.equal(await canViewMemory(db, { ...m, privacy: "public" }, "stranger", now), true);
});
