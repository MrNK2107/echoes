#!/usr/bin/env node
// Legacy-data backfill for the Expo launch (spec "Plan 5 decisions"). Run order is documented in
// docs/release-readiness.md. Every task is dry-run by default (`apply: false` / no `--apply`),
// idempotent, paged with startAfter(snapshot) (no orderBy: Firestore orders by document path) and
// resumable (re-run, or pass `--resume-after <doc path>`). Writes are committed in batches of at
// most 500. Unlike a delete-and-requery loop, the cursor works for dry runs, where nothing changes.
//
// Member counts need no backfill: the rollup sets memberCount from a count() of `members`
// (ruling R5-1, option C4(b)).
//
// CLI: node functions/tools/backfill.js <task|all> [--apply] [--project <id>] [--page-size n]
//        [--resume-after <doc path>]
// Needs an explicit project id (--project or FIREBASE_PROJECT); it never guesses one, and
// GOOGLE_CLOUD_PROJECT is deliberately ignored (it is often set ambiently). Uses Application Default Credentials, or the emulator when FIRESTORE_EMULATOR_HOST
// is set.

const MAX_BATCH = 500;
const DEFAULT_PAGE_SIZE = 400;

// Reads `makeQuery(db)` page by page. `visit(doc)` returns the writes for one doc (an array of
// { type: "update" | "set" | "delete", ref, data }), or null/[] when it needs none; it may be async
// and may bump `stats.invalid`. A doc is "changed" when it yields writes.
// `resumePattern` restricts --resume-after to a doc path of the task collection.
// `atomic`: each doc writes commit as their own batch (failures are counted, not thrown), so one
// concurrent change fails only that doc; a re-run retries it.
async function run(db, makeQuery, { apply = false, pageSize = DEFAULT_PAGE_SIZE, resumeAfter } = {}, visit, { resumePattern, atomic = false } = {}) {
  if (resumeAfter && !(resumePattern && resumePattern.test(resumeAfter))) {
    throw new Error(`Invalid resumeAfter "${resumeAfter}": it must be a document path in the task collection.`);
  }
  const stats = { scanned: 0, changed: 0 };
  const commit = async (writes) => {
    const batch = db.batch();
    for (const w of writes) {
      if (w.type === "delete") batch.delete(w.ref);
      else if (w.type === "set") batch.set(w.ref, w.data);
      else if (w.precondition) batch.update(w.ref, w.data, w.precondition);
      else batch.update(w.ref, w.data);
    }
    await batch.commit();
  };
  let pending = [];
  const flush = async () => {
    if (!pending.length) return;
    const writes = pending;
    pending = [];
    await commit(writes);
  };

  let cursor = null;
  if (resumeAfter) {
    cursor = await db.doc(resumeAfter).get();
  }
  for (;;) {
    let q = makeQuery(db).limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    for (const doc of page.docs) {
      stats.scanned += 1;
      const writes = (await visit(doc, stats)) ?? [];
      if (!writes.length) continue;
      if (!apply) {
        stats.changed += 1;
        continue;
      }
      if (atomic) {
        try {
          await commit(writes);
          stats.changed += 1;
        } catch (error) {
          stats.failed = (stats.failed ?? 0) + 1;
          stats.errors = [...(stats.errors ?? []), `${doc.ref.path}: ${error.message}`];
        }
        continue;
      }
      stats.changed += 1;
      for (const w of writes) {
        if (pending.length >= MAX_BATCH) await flush();
        pending.push(w);
      }
    }
    await flush();
    cursor = page.docs[page.docs.length - 1];
    if (page.docs.length < pageSize) break;
  }
  return stats;
}

const MEMORY_PATH = /^memories\/[^/]+$/;
const MEMBER_PATH = /^communities\/[^/]+\/members\/[^/]+$/;
const INSTITUTION_PATH = /^institutions\/[^/]+$/;
const REQUEST_PATH = /^notificationRequests\/[^/]+$/;

// Strict ISO 8601 with an explicit zone; anything else (numbers, "March 7", zone-less, date-only)
// is invalid. Returns epoch milliseconds (sub-millisecond digits are truncated) or null.
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;
function parseIso(value) {
  const m = ISO.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = m.slice(1, 7).map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth || h > 23 || mi > 59 || sec > 59) return null;
  let offsetMin = 0;
  if (m[8] !== "Z") {
    const [oh, om] = m[8].slice(1).split(":").map(Number);
    if (oh > 23 || om > 59) return null;
    offsetMin = (m[8][0] === "-" ? -1 : 1) * (oh * 60 + om);
  }
  const ms = Number((m[7] ?? "").padEnd(3, "0").slice(0, 3));
  const utc = Date.UTC(y, mo - 1, d, h, mi, sec, ms) - offsetMin * 60000;
  return Number.isNaN(utc) ? null : utc;
}

const update = (ref, data) => [{ type: "update", ref, data }];

/** Memories without `moderation` get `moderation: null` (a missing field hides them; ADR-0008). */
const backfillModeration = (db, options = {}) =>
  run(
    db,
    (d) => d.collection("memories"),
    options,
    (doc) => {
      if (doc.data().moderation !== undefined) return null;
      return update(doc.ref, { moderation: null });
    },
    { resumePattern: MEMORY_PATH },
  );

/** String `releaseDate` (strict ISO 8601 with zone) becomes a Timestamp. Other strings are counted as `invalid` and left. */
const backfillReleaseDates = async (db, options = {}) => {
  const { Timestamp } = require("firebase-admin/firestore");
  const result = await run(
    db,
    (d) => d.collection("memories"),
    options,
    (doc, stats) => {
      const value = doc.data().releaseDate;
      if (typeof value !== "string") return null;
      const ms = parseIso(value);
      if (ms === null) {
        stats.invalid = (stats.invalid ?? 0) + 1;
        return null;
      }
      return update(doc.ref, { releaseDate: Timestamp.fromMillis(ms) });
    },
    { resumePattern: MEMORY_PATH },
  );
  return { invalid: 0, ...result };
};

/** Flutter-era community member docs lack `userId`; the member doc id is the uid. */
const backfillMemberUserIds = (db, options = {}) =>
  run(
    db,
    (d) => d.collectionGroup("members"),
    options,
    (doc) => {
      if (!MEMBER_PATH.test(doc.ref.path)) return null;
      if (typeof doc.data().userId === "string" && doc.data().userId !== "") return null;
      return update(doc.ref, { userId: doc.id });
    },
    { resumePattern: MEMBER_PATH },
  );

/**
 * institutions/{id}.adminUserIds[] becomes institutions/{id}/admins/{uid} = { userId, since }
 * (the shape claimInstitutionAdmin writes; existing admin docs are kept), then the field is
 * deleted. One batch per institution; the field delete is preconditioned on the updateTime read
 * here, so a concurrent change fails only that institution (`failed`, with `errors`) and a re-run
 * retries it. An institution with more than 499 admins exceeds one batch and is reported failed.
 */
const migrateInstitutionAdmins = async (db, options = {}) => {
  const { FieldValue } = require("firebase-admin/firestore");
  const result = await run(db, (d) => d.collection("institutions"), options, async (doc) => {
    const data = doc.data();
    const lastUpdateTime = doc.updateTime;
    if (!("adminUserIds" in data)) return null;
    const ids = Array.isArray(data.adminUserIds)
      ? [...new Set(data.adminUserIds.filter((u) => typeof u === "string" && u !== ""))]
      : [];
    const existing = new Set((await doc.ref.collection("admins").get()).docs.map((a) => a.id));
    const since = new Date().toISOString();
    const writes = ids
      .filter((uid) => !existing.has(uid))
      .map((uid) => ({
        type: "set",
        ref: doc.ref.collection("admins").doc(uid),
        data: { userId: uid, since },
      }));
    writes.push({ type: "update", ref: doc.ref, data: { adminUserIds: FieldValue.delete() }, precondition: { lastUpdateTime } });
    return writes;
  }, { resumePattern: INSTITUTION_PATH, atomic: true });
  return { failed: 0, ...result };
};

/** The legacy client-written queue (rules deny it now) is deleted outright. */
const deleteLegacyNotificationRequests = (db, options = {}) =>
  run(db, (d) => d.collection("notificationRequests"), options, (doc) => [{ type: "delete", ref: doc.ref }], {
    resumePattern: REQUEST_PATH,
  });

const TASKS = {
  backfillModeration,
  backfillReleaseDates,
  backfillMemberUserIds,
  migrateInstitutionAdmins,
  deleteLegacyNotificationRequests,
};
// `all` covers the safe data fixes only. Run migrateInstitutionAdmins and
// deleteLegacyNotificationRequests deliberately, in their runbook slot.
const ALL = ["backfillModeration", "backfillReleaseDates", "backfillMemberUserIds"];

const HELP = `Usage: node functions/tools/backfill.js <task|all> [--apply] [--project <id>] [--page-size <n>] [--resume-after <doc path>]

Tasks:
  backfillModeration                 memories missing "moderation" get moderation: null
  backfillReleaseDates               string releaseDate -> Timestamp (invalid strings reported, left alone)
  backfillMemberUserIds              community member docs missing userId get it from the doc id
  migrateInstitutionAdmins           adminUserIds[] -> institutions/{id}/admins/{uid}, then drop the field
  deleteLegacyNotificationRequests   delete the legacy notificationRequests queue
  all                                backfillModeration + backfillReleaseDates + backfillMemberUserIds

Dry run is the default; nothing is written without --apply. A project id is required
(--project or FIREBASE_PROJECT). Credentials: Application Default
Credentials, or the Firestore emulator when FIRESTORE_EMULATOR_HOST is set.`;

function parseArgs(argv) {
  const opts = { apply: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        opts.error = opts.error ?? `Option ${a} needs a value.`;
        return undefined;
      }
      i += 1;
      return v;
    };
    if (a === "--apply") opts.apply = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--project") opts.project = value();
    else if (a === "--page-size") opts.pageSize = Number(value());
    else if (a === "--resume-after") opts.resumeAfter = value();
    else if (a.startsWith("--")) opts.unknown = a;
    else opts.positional.push(a);
  }
  return opts;
}

async function defaultGetDb(projectId) {
  const admin = require("firebase-admin");
  admin.initializeApp({ projectId });
  return admin.firestore();
}

async function main(argv, env = process.env, { log = console.log, getDb = defaultGetDb } = {}) {
  const opts = parseArgs(argv);
  if (opts.help || (opts.positional.length === 0 && !opts.unknown)) {
    log(HELP);
    return opts.help ? 0 : 1;
  }
  if (opts.error) {
    log(`${opts.error}\n\n${HELP}`);
    return 1;
  }
  if (opts.unknown) {
    log(`Unknown option ${opts.unknown}\n\n${HELP}`);
    return 1;
  }
  const [task] = opts.positional;
  if (task !== "all" && !TASKS[task]) {
    log(`Unknown task "${task}"\n\n${HELP}`);
    return 1;
  }
  if (task === "all" && opts.resumeAfter !== undefined) {
    log("--resume-after cannot be used with all: each task scans a different collection. Run the task by name.");
    return 1;
  }
  const project = opts.project || env.FIREBASE_PROJECT;
  if (!project) {
    log("Refusing to run: no explicit project id. Pass --project <id> or set FIREBASE_PROJECT.");
    return 1;
  }
  const pageSize = opts.pageSize === undefined ? DEFAULT_PAGE_SIZE : opts.pageSize;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_BATCH) {
    log(`--page-size must be an integer from 1 to ${MAX_BATCH}.`);
    return 1;
  }

  const target = env.FIRESTORE_EMULATOR_HOST ? `emulator ${env.FIRESTORE_EMULATOR_HOST}` : "Application Default Credentials";
  log(`${opts.apply ? "APPLY" : "DRY RUN (no writes; pass --apply to write)"}: project=${project} via ${target}`);
  const db = await getDb(project);
  const names = task === "all" ? ALL : [task];
  let failures = 0;
  for (const name of names) {
    let r;
    try {
      r = await TASKS[name](db, { apply: opts.apply, pageSize, resumeAfter: opts.resumeAfter });
    } catch (error) {
      log(`${name}: ${error.message}`);
      return 1;
    }
    const extra = (r.invalid !== undefined ? ` invalid=${r.invalid}` : "") + (r.failed ? ` failed=${r.failed}` : "");
    failures += r.failed ?? 0;
    for (const e of r.errors ?? []) log(`  failed ${e}`);
    log(`${name}: scanned=${r.scanned} ${opts.apply ? "changed" : "would change"}=${r.changed}${extra}`);
  }
  return failures > 0 ? 1 : 0;
}

module.exports = { ...TASKS, TASKS, main, parseArgs };

if (require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
