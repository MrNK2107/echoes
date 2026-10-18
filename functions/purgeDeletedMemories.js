const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

// Soft-deleted memories stay restorable for this long (RESTORE_WINDOW_DAYS on the client and
// `restoreOnly` in firestore.rules); after that they are hard-deleted with their files.
const RESTORE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Firestore allows at most 500 writes per batch.
const PURGE_BATCH_SIZE = 500;
// Storage deletes in flight at once, so a full page does not open 1000 requests together.
const FILE_DELETE_CHUNK = 50;
// The function times out at 540 s; no new page starts after this much time has passed. Whatever
// is left is picked up by the next daily run.
const TIMEOUT_SECONDS = 540;
const PURGE_BUDGET_MS = 480 * 1000;

function isNotFound(error) {
  return error?.code === 404 || error?.code === "404";
}

async function deleteFileIfPresent(bucket, path) {
  try {
    await bucket.file(path).delete();
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

async function deleteFilesInChunks(bucket, paths) {
  for (let i = 0; i < paths.length; i += FILE_DELETE_CHUNK) {
    await Promise.all(
      paths.slice(i, i + FILE_DELETE_CHUNK).map((path) => deleteFileIfPresent(bucket, path)),
    );
  }
}

function storagePaths(memoryId, data) {
  const userId = data.userId;
  if (typeof userId !== "string" || userId.length === 0) return [];
  return [`memory-images/${userId}/${memoryId}.jpg`, `memory-audio/${userId}/${memoryId}.m4a`];
}

/**
 * Hard-deletes memories with `isDeleted == true` and `deletedAt` older than the restore window,
 * plus their Storage files (missing files are fine), deleting files FILE_DELETE_CHUNK at a time.
 * Files go first so a storage failure leaves the memory in place for the next run. Each page is
 * re-queried after its batch commits, so the loop ends once a page comes back short, or before a
 * new page once `budgetMs` (measured with `clock`) has elapsed. Returns the number deleted.
 */
async function purgeExpired(
  db,
  bucket,
  now,
  { budgetMs = PURGE_BUDGET_MS, clock = Date.now, log = (msg, data) => logger.info(msg, data) } = {},
) {
  const cutoff = new Date(now.getTime() - RESTORE_WINDOW_DAYS * DAY_MS);
  const startedAt = clock();
  let purged = 0;
  for (let page = 0; ; page += 1) {
    if (page > 0 && clock() - startedAt >= budgetMs) {
      log("Purge time budget spent; resuming next run", { purged });
      break;
    }
    const snapshot = await db
      .collection("memories")
      .where("isDeleted", "==", true)
      .where("deletedAt", "<", cutoff)
      .orderBy("deletedAt")
      .limit(PURGE_BATCH_SIZE)
      .get();
    if (snapshot.docs.length === 0) break;

    await deleteFilesInChunks(
      bucket,
      snapshot.docs.flatMap((doc) => storagePaths(doc.id, doc.data())),
    );
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    purged += snapshot.docs.length;

    if (snapshot.docs.length < PURGE_BATCH_SIZE) break;
  }
  return purged;
}

// Hard deletes fire `onMemoryWritten`, which recomputes the affected places.
const purgeDeletedMemories = onSchedule(
  { schedule: "every 24 hours", timeoutSeconds: TIMEOUT_SECONDS },
  async () => {
    const purged = await purgeExpired(admin.firestore(), admin.storage().bucket(), new Date());
    logger.info("Purged expired deleted memories", { purged });
  },
);

module.exports = {
  purgeDeletedMemories,
  __private__: { purgeExpired, PURGE_BATCH_SIZE, FILE_DELETE_CHUNK, PURGE_BUDGET_MS },
};
