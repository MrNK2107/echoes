const { FieldValue } = require("firebase-admin/firestore");

// Firestore allows at most 500 writes per batch.
const BATCH_SIZE = 500;

// Deletes every notification (in any inbox) whose actorId is `uid`, so the deleted user's name
// leaves other people's inboxes. Docs without an actorId (older than Plan 5) are kept and age out
// through the 90-day TTL. Paged: each page is re-queried after its deletes commit.
async function deleteNotificationsFrom(db, uid, { batchSize = BATCH_SIZE } = {}) {
  for (;;) {
    const page = await db.collectionGroup("notifications").where("actorId", "==", uid).limit(batchSize).get();
    if (page.empty) break;
    const batch = db.batch();
    page.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (page.docs.length < batchSize) break;
  }
}

// Account deletion, social/safety data (Plan 3): the public profile, institution admin roles,
// and reports the user filed. Reports *about* the user's memories are left alone (the memories
// themselves are deleted by cleanupDeletedUser). No transactions: this runs in an async auth
// trigger (see cleanupUserCommunities). Idempotent, so a retried run is safe.
async function cleanupUserSocialData(db, uid, { batchSize = BATCH_SIZE } = {}) {
  await db.collection("publicProfiles").doc(uid).delete();

  // Private admin docs (institutions/{id}/admins/{uid}), found through the collection group.
  for (;;) {
    const admins = await db.collectionGroup("admins").where("userId", "==", uid).limit(batchSize).get();
    if (admins.empty) break;
    const batch = db.batch();
    admins.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (admins.docs.length < batchSize) break;
  }

  // Legacy adminUserIds[] on institutions not yet migrated (migrateInstitutionAdmins).
  const institutions = await db.collection("institutions").where("adminUserIds", "array-contains", uid).get();
  for (let i = 0; i < institutions.docs.length; i += batchSize) {
    const batch = db.batch();
    institutions.docs
      .slice(i, i + batchSize)
      .forEach((doc) => batch.update(doc.ref, { adminUserIds: FieldValue.arrayRemove(uid) }));
    await batch.commit();
  }

  // Paged: each page is re-queried after its deletes commit.
  for (;;) {
    const reports = await db.collection("reports").where("reporterId", "==", uid).limit(batchSize).get();
    if (reports.empty) break;
    const batch = db.batch();
    reports.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (reports.docs.length < batchSize) break;
  }
}

module.exports = { cleanupUserSocialData, deleteNotificationsFrom };
