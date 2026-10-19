const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const { createFakeFirestore } = require("./fakes/firestore");
const backfill = require("../tools/backfill");

const snapshot = (db) => JSON.stringify([...db._store.entries()].sort());

function seed() {
  return createFakeFirestore({
    "memories/m1": { text: "legacy" },
    "memories/m2": { text: "hidden", moderation: "hidden" },
    "memories/m3": { text: "ok", moderation: null },
    "memories/r1": { moderation: null, releaseDate: "2027-01-02T03:04:05.000Z" },
    "memories/r2": { moderation: null, releaseDate: "not a date" },
    "memories/r3": { moderation: null, releaseDate: Timestamp.fromDate(new Date("2027-01-01T00:00:00Z")) },
    "communities/c1/members/u1": { role: "member" },
    "communities/c1/members/u2": { userId: "u2", role: "member" },
    "communities/c2/members/u3": { role: "guardian", joinedAt: "x" },
    "institutions/i1": { name: "A", adminUserIds: ["a1", "a2"] },
    "institutions/i1/admins/a1": { userId: "a1", since: "2026-01-01T00:00:00.000Z" },
    "institutions/i2": { name: "B", adminUserIds: [] },
    "institutions/i3": { name: "C" },
    "notificationRequests/n1": { recipientUserId: "u1" },
    "notificationRequests/n2": { recipientUserId: "u2" },
  });
}

const TASKS = [
  ["backfillModeration", { scanned: 6, changed: 1 }],
  ["backfillReleaseDates", { scanned: 6, changed: 1 }],
  ["backfillMemberUserIds", { scanned: 3, changed: 2 }],
  ["migrateInstitutionAdmins", { scanned: 3, changed: 2 }],
  ["deleteLegacyNotificationRequests", { scanned: 2, changed: 2 }],
];

for (const [name, expected] of TASKS) {
  test(`${name} is idempotent and dry-run writes nothing`, async () => {
    const db = seed();
    const before = snapshot(db);
    const dry = await backfill[name](db, {});
    assert.equal(dry.scanned, expected.scanned);
    assert.equal(dry.changed, expected.changed);
    assert.equal(snapshot(db), before, "dry run must not write");

    const first = await backfill[name](db, { apply: true });
    assert.equal(first.changed, expected.changed);
    assert.notEqual(snapshot(db), before);
    const afterFirst = snapshot(db);
    const second = await backfill[name](db, { apply: true });
    assert.equal(second.changed, 0);
    assert.equal(snapshot(db), afterFirst);
  });

  test(`${name} pages with a tiny page size and still visits everything`, async () => {
    const db = seed();
    const r = await backfill[name](db, { apply: true, pageSize: 1 });
    assert.equal(r.scanned, expected.scanned);
    assert.equal(r.changed, expected.changed);
  });
}

test("backfillModeration never overwrites an existing moderation value", async () => {
  const db = seed();
  await backfill.backfillModeration(db, { apply: true });
  assert.equal(db._get("memories/m1").moderation, null);
  assert.equal(db._get("memories/m2").moderation, "hidden");
  assert.equal(db._get("memories/m3").moderation, null);
});

test("backfillReleaseDates converts ISO strings and leaves unparsable ones alone", async () => {
  const db = seed();
  const r = await backfill.backfillReleaseDates(db, { apply: true });
  const converted = db._get("memories/r1").releaseDate;
  assert.ok(converted instanceof Timestamp);
  assert.equal(converted.toDate().toISOString(), "2027-01-02T03:04:05.000Z");
  assert.equal(db._get("memories/r2").releaseDate, "not a date");
  assert.ok(db._get("memories/r3").releaseDate instanceof Timestamp);
  assert.equal(r.invalid, 1);
});

test("backfillReleaseDates accepts strict ISO only and keeps millisecond precision", async () => {
  const db = createFakeFirestore({
    "memories/a": { releaseDate: "1" },
    "memories/b": { releaseDate: "March 7" },
    "memories/c": { releaseDate: "2027-01-02T03:04:05" },
    "memories/d": { releaseDate: "2027-01-02T03:04:05.123456Z" },
    "memories/e": { releaseDate: "2027-01-02T05:04:05+02:00" },
    "memories/f": { releaseDate: "2027-02-30T03:04:05Z" },
    "memories/g": { releaseDate: "2027-01-02" },
  });
  const r = await backfill.backfillReleaseDates(db, { apply: true });
  assert.equal(r.invalid, 5);
  assert.equal(r.changed, 2);
  for (const id of ["a", "b", "c", "f", "g"]) assert.equal(typeof db._get(`memories/${id}`).releaseDate, "string");
  assert.equal(db._get("memories/d").releaseDate.toMillis(), Date.parse("2027-01-02T03:04:05.123Z"));
  assert.equal(db._get("memories/e").releaseDate.toMillis(), Date.parse("2027-01-02T03:04:05.000Z"));
});

test("resumeAfter must belong to the task collection", async () => {
  const db = seed();
  await assert.rejects(backfill.backfillMemberUserIds(db, { resumeAfter: "memories/m1" }), /resume/i);
  await assert.rejects(backfill.backfillModeration(db, { resumeAfter: "communities/c1/members/u1" }), /resume/i);
  await assert.rejects(backfill.migrateInstitutionAdmins(db, { resumeAfter: "institutions/i1/admins/a1" }), /resume/i);
  await assert.rejects(backfill.deleteLegacyNotificationRequests(db, { resumeAfter: "memories/m1" }), /resume/i);
  await backfill.backfillMemberUserIds(db, { resumeAfter: "communities/c1/members/u1" });
});

test("migrateInstitutionAdmins commits one batch per institution; a concurrent change fails only that one and a re-run retries it", async () => {
  const db = seed();
  const realBatch = db.batch.bind(db);
  let raced = false;
  db.batch = () => {
    const b = realBatch();
    const commit = b.commit;
    b.commit = async () => {
      if (!raced) {
        raced = true;
        await db.doc("institutions/i1").update({ name: "A2" });
      }
      return commit();
    };
    return b;
  };
  const r = await backfill.migrateInstitutionAdmins(db, { apply: true });
  assert.equal(r.failed, 1);
  assert.equal(r.changed, 1);
  assert.deepEqual(db._get("institutions/i1").adminUserIds, ["a1", "a2"]);
  assert.equal(db._get("institutions/i1/admins/a2"), undefined);
  assert.ok(!("adminUserIds" in db._get("institutions/i2")));
  db.batch = realBatch;
  const again = await backfill.migrateInstitutionAdmins(db, { apply: true });
  assert.equal(again.failed, 0);
  assert.equal(again.changed, 1);
  assert.equal(db._get("institutions/i1/admins/a2").userId, "a2");
  assert.ok(!("adminUserIds" in db._get("institutions/i1")));
});

test("backfillMemberUserIds sets userId from the member doc id", async () => {
  const db = seed();
  await backfill.backfillMemberUserIds(db, { apply: true });
  assert.equal(db._get("communities/c1/members/u1").userId, "u1");
  assert.equal(db._get("communities/c2/members/u3").userId, "u3");
  assert.equal(db._get("communities/c2/members/u3").role, "guardian");
});

test("migrateInstitutionAdmins copies admins, keeps existing admin docs and deletes the field", async () => {
  const db = seed();
  await backfill.migrateInstitutionAdmins(db, { apply: true });
  assert.equal(db._get("institutions/i1/admins/a1").since, "2026-01-01T00:00:00.000Z");
  const a2 = db._get("institutions/i1/admins/a2");
  assert.equal(a2.userId, "a2");
  assert.equal(typeof a2.since, "string");
  assert.ok(!Number.isNaN(Date.parse(a2.since)));
  assert.ok(!("adminUserIds" in db._get("institutions/i1")));
  assert.ok(!("adminUserIds" in db._get("institutions/i2")));
  assert.equal(db._get("institutions/i1").name, "A");
});

test("deleteLegacyNotificationRequests removes only notificationRequests", async () => {
  const db = seed();
  await backfill.deleteLegacyNotificationRequests(db, { apply: true });
  assert.equal(db._list("notificationRequests/").length, 0);
  assert.ok(db._get("memories/m1"));
});

test("writes are committed in batches of at most 500", async () => {
  const initial = {};
  for (let i = 0; i < 1203; i++) initial[`memories/x${i}`] = { text: "t" };
  const db = createFakeFirestore(initial);
  const sizes = [];
  const realBatch = db.batch.bind(db);
  db.batch = () => {
    const b = realBatch();
    let n = 0;
    for (const k of ["set", "update", "delete", "create"]) {
      const orig = b[k];
      b[k] = (...a) => (n++, orig(...a));
    }
    const commit = b.commit;
    b.commit = () => (sizes.push(n), commit());
    return b;
  };
  const r = await backfill.backfillModeration(db, { apply: true, pageSize: 1000 });
  assert.equal(r.changed, 1203);
  assert.ok(sizes.length >= 3);
  assert.ok(sizes.every((s) => s <= 500), sizes.join(","));
  assert.equal(sizes.reduce((a, b) => a + b, 0), 1203);
});

test("resumeAfter skips documents up to the given path", async () => {
  const db = seed();
  const r = await backfill.backfillModeration(db, { apply: true, resumeAfter: "memories/m1" });
  assert.equal(db._get("memories/m1").moderation, undefined);
  assert.equal(r.changed, 0);
});

// ---- CLI ----
function cli(argv, env = {}) {
  const out = [];
  const db = seed();
  let initialised = 0;
  const run = backfill.main(argv, env, {
    log: (...a) => out.push(a.join(" ")),
    getDb: async (project) => {
      initialised += 1;
      db.project = project;
      return db;
    },
  });
  return run.then((code) => ({ code, out: out.join("\n"), db, initialised }));
}

test("cli rejects --resume-after for all, GOOGLE_CLOUD_PROJECT alone, and missing option values", async () => {
  const p = ["--project", "demo-echoes"];
  const all = await cli(["all", "--resume-after", "memories/m1", ...p]);
  assert.notEqual(all.code, 0);
  assert.match(all.out, /resume-after/);
  assert.equal(all.initialised, 0);
  const gcp = await cli(["backfillModeration"], { GOOGLE_CLOUD_PROJECT: "real-prod" });
  assert.notEqual(gcp.code, 0);
  assert.equal(gcp.initialised, 0);
  for (const argv of [["backfillModeration", "--project"], ["backfillModeration", "--project", "--apply"], ["backfillModeration", "--page-size", "--apply", ...p], ["backfillModeration", "--resume-after", ...p.slice(0, 0)]]) {
    const r = await cli(argv, { FIREBASE_PROJECT: "demo-echoes" });
    assert.notEqual(r.code, 0, argv.join(" "));
    assert.equal(r.initialised, 0);
    assert.equal(r.db._get("memories/m1").moderation, undefined);
  }
});

test("cli --help lists tasks without initialising firebase", async () => {
  const r = await cli(["--help"]);
  assert.equal(r.code, 0);
  for (const t of Object.keys(backfill.TASKS)) assert.match(r.out, new RegExp(t));
  assert.equal(r.initialised, 0);
});

test("cli refuses to run without an explicit project id", async () => {
  const r = await cli(["backfillModeration"]);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /project/i);
  assert.equal(r.initialised, 0);
});

test("cli is a dry run by default and --apply writes", async () => {
  const dry = await cli(["backfillModeration", "--project", "demo-echoes"]);
  assert.equal(dry.code, 0);
  assert.match(dry.out, /dry run/i);
  assert.match(dry.out, /scanned=6/);
  assert.equal(dry.db._get("memories/m1").moderation, undefined);
  const applied = await cli(["backfillModeration", "--apply"], { FIREBASE_PROJECT: "demo-echoes" });
  assert.equal(applied.code, 0);
  assert.equal(applied.db._get("memories/m1").moderation, null);
  assert.equal(applied.db.project, "demo-echoes");
});

test("cli 'all' runs the three data backfills only; unknown task fails", async () => {
  const all = await cli(["all", "--apply", "--project", "demo-echoes"]);
  assert.equal(all.code, 0);
  for (const t of ["backfillModeration", "backfillReleaseDates", "backfillMemberUserIds"]) {
    assert.match(all.out, new RegExp(`${t}: scanned=`));
  }
  assert.doesNotMatch(all.out, /migrateInstitutionAdmins: scanned/);
  assert.ok(all.db._get("institutions/i1").adminUserIds, "all must not run the admin migration");
  assert.equal(all.db._list("notificationRequests/").length, 2);
  const bad = await cli(["nope", "--project", "demo-echoes"]);
  assert.notEqual(bad.code, 0);
});
