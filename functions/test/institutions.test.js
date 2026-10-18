const test = require("node:test");
const assert = require("node:assert/strict");
const { createFakeFirestore } = require("./fakes/firestore");
const { buildHandler } = require("../lib/callable");
const { definitions } = require("../institutions");

// token: custom claims / email fields as they appear on request.auth.token.
const call = (db, name, uid, data, token = {}) => {
  const def = definitions[name];
  return buildHandler({ name, ...def }, def.handler, () => db)({
    auth: uid ? { uid, token } : undefined,
    data,
  });
};

async function codeOf(p) {
  try {
    await p;
  } catch (e) {
    return e.code;
  }
  return "none";
}

const STAFF = { staff: true };
const verified = (email) => ({ email, email_verified: true });
const seed = () =>
  createFakeFirestore({
    "users/staffer": { communityIds: [] },
    "users/alice": { communityIds: [] },
    "users/bob": { communityIds: [] },
  });

async function institution(
  db,
  data = { name: "  Riverside School ", allowedEmailDomains: [" Riverside.EDU ", "staff.riverside.org"] },
) {
  const { id } = await call(db, "createInstitution", "staffer", data, STAFF);
  return id;
}

// --- createInstitution ---

test("createInstitution is staff-only", async () => {
  const db = seed();
  const data = { name: "School", allowedEmailDomains: ["school.edu"] };
  assert.equal(await codeOf(call(db, "createInstitution", "alice", data, {})), "permission-denied");
  assert.equal(await codeOf(call(db, "createInstitution", "alice", data, { staff: "true" })), "permission-denied");
  assert.equal(await codeOf(call(db, "createInstitution", null, data)), "unauthenticated");
  assert.equal(db._list("institutions/").length, 0);
  assert.equal(db._list("communities/").length, 0);
});

test("createInstitution stores normalized domains and a system-owned institution community", async () => {
  const db = seed();
  const id = await institution(db);
  const inst = db._get(`institutions/${id}`);
  assert.equal(inst.name, "Riverside School");
  assert.deepEqual(inst.allowedEmailDomains, ["riverside.edu", "staff.riverside.org"]);
  assert.deepEqual(inst.adminUserIds, []);
  assert.deepEqual(inst.subZones, []);
  assert.equal(inst.communityId, `inst-${id}`);
  assert.equal(typeof inst.createdAt, "string");
  const c = db._get(`communities/inst-${id}`);
  assert.equal(c.type, "institution");
  assert.equal(c.ownerId, "system");
  assert.equal(c.institutionId, id);
  assert.equal(c.placeId, null);
  assert.equal(c.name, "Riverside School");
  assert.equal(c.memberCount, 0);
  // R25: the staff creator is neither owner nor auto-joined.
  assert.equal(db._get(`communities/inst-${id}/members/staffer`), undefined);
  assert.deepEqual(db._get("users/staffer").communityIds, []);
});

test("createInstitution validates name and 1-10 hostname domains", async () => {
  const db = seed();
  const bad = [
    { name: "   ", allowedEmailDomains: ["a.edu"] },
    { name: "School", allowedEmailDomains: [] },
    { name: "School", allowedEmailDomains: Array.from({ length: 11 }, (_, i) => `d${i}.edu`) },
    { name: "School", allowedEmailDomains: ["localhost"] },
    { name: "School", allowedEmailDomains: ["bad_domain.edu"] },
    { name: "School", allowedEmailDomains: ["-bad.edu"] },
    { name: "School", allowedEmailDomains: ["a..edu"] },
    { name: "School", allowedEmailDomains: ["user@school.edu"] },
    { name: "School", allowedEmailDomains: ["school.123"] },
    { name: "School", allowedEmailDomains: [42] },
    { name: "School", allowedEmailDomains: ["a.edu"], extra: 1 },
  ];
  for (const data of bad) {
    assert.equal(
      await codeOf(call(db, "createInstitution", "staffer", data, STAFF)),
      "invalid-argument",
      JSON.stringify(data),
    );
  }
  assert.equal(db._list("institutions/").length, 0);
  const id = await institution(db, { name: "X", allowedEmailDomains: ["A.edu", "a.edu", "xn--bcher-kva.example"] });
  assert.deepEqual(db._get(`institutions/${id}`).allowedEmailDomains, ["a.edu", "xn--bcher-kva.example"]);
});

// --- claimInstitutionAdmin ---

test("rejects subdomain and unverified email", async () => {
  const db = seed();
  const id = await institution(db);
  const claim = (token) => codeOf(call(db, "claimInstitutionAdmin", "alice", { institutionId: id }, token));
  assert.equal(await claim({ email: "alice@riverside.edu", email_verified: false }), "failed-precondition");
  assert.equal(await claim({ email: "alice@riverside.edu" }), "failed-precondition");
  assert.equal(await claim(verified("alice@mail.riverside.edu")), "permission-denied");
  assert.equal(await claim(verified("alice@riverside.edu.evil.com")), "permission-denied");
  assert.equal(await claim(verified("alice@notriverside.edu")), "permission-denied");
  assert.equal(await claim(verified("alice@riverside.org")), "permission-denied");
  assert.equal(await claim({ email_verified: true }), "permission-denied");
  assert.deepEqual(db._get(`institutions/${id}`).adminUserIds, []);
  assert.equal(db._get(`communities/inst-${id}`).memberCount, 0);
  assert.equal(db._get(`communities/inst-${id}/members/alice`), undefined);
});

test("exact-domain claim (case-insensitive) makes an admin and a guardian member", async () => {
  const db = seed();
  const id = await institution(db);
  const res = await call(db, "claimInstitutionAdmin", "alice", { institutionId: id }, verified("Alice@RIVERSIDE.edu"));
  assert.deepEqual(res, { name: "Riverside School" });
  assert.deepEqual(db._get(`institutions/${id}`).adminUserIds, ["alice"]);
  const m = db._get(`communities/inst-${id}/members/alice`);
  assert.equal(m.userId, "alice");
  assert.equal(m.role, "guardian");
  assert.equal(typeof m.joinedAt, "string");
  assert.equal(db._get(`communities/inst-${id}`).memberCount, 1);
  assert.deepEqual(db._get("users/alice").communityIds, [`inst-${id}`]);
  // The second allowed domain works too; a repeat claim counts once.
  await call(db, "claimInstitutionAdmin", "bob", { institutionId: id }, verified("bob@staff.riverside.org"));
  await call(db, "claimInstitutionAdmin", "alice", { institutionId: id }, verified("alice@riverside.edu"));
  assert.deepEqual(db._get(`institutions/${id}`).adminUserIds, ["alice", "bob"]);
  assert.equal(db._get(`communities/inst-${id}`).memberCount, 2);
  assert.deepEqual(db._get("users/alice").communityIds, [`inst-${id}`]);
});

test("claim upgrades an existing plain membership to guardian without recounting", async () => {
  const db = seed();
  const id = await institution(db);
  db._put(`communities/inst-${id}/members/alice`, { userId: "alice", role: "member", joinedAt: "2026-01-01T00:00:00.000Z" });
  db._put(`communities/inst-${id}`, { ...db._get(`communities/inst-${id}`), memberCount: 1 });
  await call(db, "claimInstitutionAdmin", "alice", { institutionId: id }, verified("alice@riverside.edu"));
  const m = db._get(`communities/inst-${id}/members/alice`);
  assert.equal(m.role, "guardian");
  assert.equal(m.joinedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(db._get(`communities/inst-${id}`).memberCount, 1);
});

test("claim on a missing institution is not-found", async () => {
  const db = seed();
  assert.equal(
    await codeOf(call(db, "claimInstitutionAdmin", "alice", { institutionId: "nope" }, verified("a@b.edu"))),
    "not-found",
  );
});

// --- addInstitutionSubZone ---

test("sub-zone by a non-admin is denied", async () => {
  const db = seed();
  const id = await institution(db);
  const data = { institutionId: id, name: "Library", latitude: 51.5, longitude: -0.12 };
  assert.equal(await codeOf(call(db, "addInstitutionSubZone", "bob", data)), "permission-denied");
  assert.equal(await codeOf(call(db, "addInstitutionSubZone", "staffer", data, STAFF)), "permission-denied");
  assert.equal(await codeOf(call(db, "addInstitutionSubZone", "bob", { ...data, institutionId: "nope" })), "not-found");
  assert.deepEqual(db._get(`institutions/${id}`).subZones, []);
});

test("an admin appends sub-zones with a default 60 m radius", async () => {
  const db = seed();
  const id = await institution(db);
  await call(db, "claimInstitutionAdmin", "alice", { institutionId: id }, verified("alice@riverside.edu"));
  const a = await call(db, "addInstitutionSubZone", "alice", {
    institutionId: id,
    name: " Library ",
    latitude: 51.5,
    longitude: -0.12,
  });
  const b = await call(db, "addInstitutionSubZone", "alice", {
    institutionId: id,
    name: "Gym",
    latitude: -90,
    longitude: 180,
    radiusMeters: 250,
  });
  assert.equal(typeof a.id, "string");
  assert.notEqual(a.id, b.id);
  assert.deepEqual(db._get(`institutions/${id}`).subZones, [
    { id: a.id, name: "Library", latitude: 51.5, longitude: -0.12, radiusMeters: 60 },
    { id: b.id, name: "Gym", latitude: -90, longitude: 180, radiusMeters: 250 },
  ]);
});

test("addInstitutionSubZone validates ranges", async () => {
  const db = seed();
  const id = await institution(db);
  await call(db, "claimInstitutionAdmin", "alice", { institutionId: id }, verified("alice@riverside.edu"));
  const ok = { institutionId: id, name: "Hall", latitude: 0, longitude: 0 };
  for (const over of [
    { latitude: 90.1 },
    { latitude: -91 },
    { longitude: 180.5 },
    { longitude: -181 },
    { radiusMeters: 5 },
    { radiusMeters: 5001 },
    { name: "  " },
    { name: "x".repeat(61) },
    { latitude: "1" },
  ]) {
    assert.equal(
      await codeOf(call(db, "addInstitutionSubZone", "alice", { ...ok, ...over })),
      "invalid-argument",
      JSON.stringify(over),
    );
  }
  assert.deepEqual(db._get(`institutions/${id}`).subZones, []);
});

test("an institution keeps at most 100 sub-zones", async () => {
  const db = seed();
  const id = await institution(db);
  const zones = Array.from({ length: 100 }, (_, i) => ({ id: `z${i}`, name: "Z", latitude: 0, longitude: 0, radiusMeters: 60 }));
  db._put(`institutions/${id}`, { ...db._get(`institutions/${id}`), adminUserIds: ["alice"], subZones: zones });
  assert.equal(
    await codeOf(call(db, "addInstitutionSubZone", "alice", { institutionId: id, name: "One more", latitude: 0, longitude: 0 })),
    "failed-precondition",
  );
});
