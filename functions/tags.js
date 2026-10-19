const admin = require("firebase-admin");
const { Timestamp } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { notify, skipReason } = require("./lib/notify");
const { tryConsumeRateLimit } = require("./lib/rateLimit");

// Rules cap taggedUserIds at 20; the server enforces the same cap for Admin/legacy writes.
const MAX_TAGS = 20;
// Per-author daily budget of tag notifications (one unit per notification), so a spammer cannot
// fan out unbounded inbox writes. Exhausted: skip silently (a trigger cannot throw to a caller).
const TAG_NOTIFY_PER_DAY = 100;

// Released time-release memories: found by the hourly job within this window (it overlaps the
// schedule, so a missed run is covered; deterministic notification ids make the overlap safe).
const RELEASE_WINDOW_MS = 2 * 60 * 60 * 1000;
const RELEASED_PAGE_SIZE = 200;
// The job times out at 540 s; no new page starts after this much time has passed. The rest is
// covered by the next run's overlapping window.
const RELEASED_TIMEOUT_SECONDS = 540;
const RELEASED_BUDGET_MS = 480 * 1000;

// releaseDate is a Timestamp; tolerate Dates and ISO strings from older docs.
function millisOf(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return Date.parse(value);
  return NaN;
}

// Privacy: a tag notification would leak a memory the tagged user cannot open, so notify only
// for memories they can read now: live, not hidden, and `public` or `tagged` (rules grant tagged
// users read on `tagged`), or `timeRelease` once `releaseDate` has passed. private / community
// never notify.
function taggedUsersCanRead(memory, now = new Date()) {
  if (memory.isDeleted === true || memory.moderation === "hidden") return false;
  if (memory.privacy === "public" || memory.privacy === "tagged") return true;
  if (memory.privacy === "timeRelease") return millisOf(memory.releaseDate) <= now.getTime();
  return false;
}

// Notifies the first MAX_TAGS unique tagged users (author excluded; notify skips blocked pairs
// and disabled prefs). Ids without a users doc are skipped so no orphan inbox is created.
// Deterministic notification ids (memoryTagged_<memoryId>_<uid>) make a retried trigger a no-op.
// `skipExisting` (the scheduled path) skips users whose notification already exists before the
// author's budget is spent, so overlapping windows do not charge it twice.
// `exhaustedAuthors` (the scheduled run's per-run Set) remembers authors whose budget is spent, so
// their later memories cost no further reads.
async function notifyTaggedUsers(
  db,
  memoryId,
  memory,
  now = new Date(),
  { skipExisting = false, exhaustedAuthors = new Set() } = {},
) {
  if (!memory || !taggedUsersCanRead(memory, now)) return;
  if (typeof memory.userId === "string" && exhaustedAuthors.has(memory.userId)) return;
  const tagged = Array.isArray(memory?.taggedUserIds) ? memory.taggedUserIds : [];
  const unique = [...new Set(tagged.filter((id) => typeof id === "string" && id && !id.includes("/")))];
  const author = memory.userId;
  for (const to of unique.slice(0, MAX_TAGS)) {
    if (to === author) continue;
    const user = await db.collection("users").doc(to).get();
    if (!user.exists) continue;
    const id = `memoryTagged_${memoryId}_${to}`;
    if (skipExisting) {
      if ((await db.doc(`users/${to}/notifications/${id}`).get()).exists) continue;
      // Blocked or pref-off recipients would be skipped by notify anyway; do not charge the
      // author's budget for them on every overlapping run.
      if (await skipReason(db, { to, type: "memoryTagged", actorId: author })) continue;
    }
    if (typeof author === "string" && author) {
      if (!(await tryConsumeRateLimit(db, author, "tagNotify", TAG_NOTIFY_PER_DAY, now))) {
        logger.warn("Tag notification budget exhausted", { author, memoryId });
        exhaustedAuthors.add(author);
        return;
      }
    }
    await notify(db, {
      to,
      type: "memoryTagged",
      actorId: author,
      data: { memoryId, placeId: memory.placeId ?? null },
      id,
    });
  }
}

const onMemoryCreatedTags = onDocumentCreated("memories/{memoryId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await notifyTaggedUsers(admin.firestore(), event.params.memoryId, data);
});

/**
 * Notifies the tagged users of `timeRelease` memories whose `releaseDate` is in (now - 2 h, now],
 * `pageSize` memories per page. No new page starts once `budgetMs` (measured with `clock`) has
 * elapsed. Returns the number of memories processed.
 */
async function releasedTagsHandler(
  db,
  now,
  { pageSize = RELEASED_PAGE_SIZE, budgetMs = RELEASED_BUDGET_MS, clock = Date.now, log = (msg, data) => logger.info(msg, data) } = {},
) {
  const from = Timestamp.fromMillis(now.getTime() - RELEASE_WINDOW_MS);
  const to = Timestamp.fromMillis(now.getTime());
  const startedAt = clock();
  let processed = 0;
  let last = null;
  const exhaustedAuthors = new Set();
  for (let page = 0; ; page += 1) {
    if (page > 0 && clock() - startedAt >= budgetMs) {
      log("Released tags time budget spent; the next run's window covers the rest", { processed });
      break;
    }
    let query = db
      .collection("memories")
      .where("privacy", "==", "timeRelease")
      .where("releaseDate", ">", from)
      .where("releaseDate", "<=", to)
      .orderBy("releaseDate");
    if (last) query = query.startAfter(last);
    const snapshot = await query.limit(pageSize).get();
    for (const doc of snapshot.docs) {
      if (processed > 0 && clock() - startedAt >= budgetMs) {
        log("Released tags time budget spent; the next run's window covers the rest", { processed });
        return processed;
      }
      await notifyTaggedUsers(db, doc.id, doc.data(), now, { skipExisting: true, exhaustedAuthors });
      processed += 1;
    }
    if (snapshot.docs.length < pageSize) break;
    last = snapshot.docs[snapshot.docs.length - 1];
  }
  return processed;
}

const notifyReleasedTags = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: RELEASED_TIMEOUT_SECONDS },
  async () => {
    const processed = await releasedTagsHandler(admin.firestore(), new Date());
    logger.info("Released time-release tags processed", { processed });
  },
);

module.exports = {
  onMemoryCreatedTags,
  notifyReleasedTags,
  releasedTagsHandler,
  notifyTaggedUsers,
  MAX_TAGS,
  TAG_NOTIFY_PER_DAY,
};
