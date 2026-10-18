const admin = require("firebase-admin");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");

// Soft-deleted memories stay restorable for this long (RESTORE_WINDOW_DAYS on the client and
// `restoreOnly` in firestore.rules); after that they are hard-deleted with their files.
const RESTORE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Firestore allows at most 500 writes per batch.
const PURGE_BATCH_SIZE = 500;

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

function storagePaths(memoryId, data) {
  const userId = data.userId;
  if (typeof userId !== "string" || userId.length === 0) return [];
  return [`memory-images/${userId}/${memoryId}.jpg`, `memory-audio/${userId}/${memoryId}.m4a`];
}

/**
 * Hard-deletes memories with `isDeleted == true` and `deletedAt` older than the restore window,
 * plus their Storage files (missing files are fine). Files go first so a storage failure leaves
 * the memory in place for the next run. Each page is re-queried after its batch commits, so the
 * loop ends once a page comes back short. Returns the number of memories deleted.
 */
async function purgeExpired(db, bucket, now) {
  const cutoff = new Date(now.getTime() - RESTORE_WINDOW_DAYS * DAY_MS);
  let purged = 0;
  for (;;) {
    const snapshot = await db
      .collection("memories")
      .where("isDeleted", "==", true)
      .where("deletedAt", "<", cutoff)
      .orderBy("deletedAt")
      .limit(PURGE_BATCH_SIZE)
      .get();
    if (snapshot.docs.length === 0) break;

    await Promise.all(
      snapshot.docs.flatMap((doc) =>
        storagePaths(doc.id, doc.data()).map((path) => deleteFileIfPresent(bucket, path)),
      ),
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
const purgeDeletedMemories = onSchedule("every 24 hours", async () => {
  const purged = await purgeExpired(admin.firestore(), admin.storage().bucket(), new Date());
  logger.info("Purged expired deleted memories", { purged });
});

module.exports = {
  purgeDeletedMemories,
  __private__: { purgeExpired, PURGE_BATCH_SIZE },
};
