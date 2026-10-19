require("./globalOptions"); // first: global options apply to every function defined below
const admin = require("firebase-admin");
// The modular import works under the functions emulator, whose proxied `admin.firestore`
// lacks the FieldValue namespace.
const { FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const functionsV1 = require("firebase-functions/v1");
const { onMemoryWritten } = require("./onMemoryWritten");
const { rollupMemberCounts } = require("./memberCounts");
const { onPublicProfileWritten } = require("./onPublicProfileWritten");
const communities = require("./communities");
const transfers = require("./transfers");
const institutions = require("./institutions");
const safety = require("./safety");
const { cleanupUserSocialData, deleteNotificationsFrom } = require("./accountCleanup");
const { onMemoryCreatedTags, notifyReleasedTags } = require("./tags");
const { createOnNotificationCreated, createOnPushTokenCreated, checkPushReceipts } = require("./push");
const {
  purgeDeletedMemories,
  __private__: { purgeExpired },
} = require("./purgeDeletedMemories");

admin.initializeApp();

const db = admin.firestore();

exports.onMemoryWritten = onMemoryWritten;
exports.onPublicProfileWritten = onPublicProfileWritten;
exports.rollupMemberCounts = rollupMemberCounts;
exports.purgeDeletedMemories = purgeDeletedMemories;
exports.onMemoryCreatedTags = onMemoryCreatedTags;
exports.notifyReleasedTags = notifyReleasedTags;
exports.onNotificationCreated = createOnNotificationCreated(() => db);
exports.onPushTokenCreated = createOnPushTokenCreated(() => db);
exports.checkPushReceipts = checkPushReceipts;
exports.createCommunity = communities.createCommunity;
exports.joinCommunity = communities.joinCommunity;
exports.leaveCommunity = communities.leaveCommunity;
exports.inviteToCommunity = communities.inviteToCommunity;
exports.initiateTransfer = transfers.initiateTransfer;
exports.respondToTransfer = transfers.respondToTransfer;
exports.revokeTransfer = transfers.revokeTransfer;
exports.expireTransfers = transfers.expireTransfers;
exports.createInstitution = institutions.createInstitution;
exports.claimInstitutionAdmin = institutions.claimInstitutionAdmin;
exports.addInstitutionSubZone = institutions.addInstitutionSubZone;
exports.reportMemory = safety.reportMemory;
exports.reportContent = safety.reportContent;

// Authentication deletion is the authoritative account-removal event. Keeping
// cleanup server-side prevents a client from selectively leaving personal data
// behind and also covers deletions initiated from the Firebase console.
// Retries on failure (failurePolicy) with the maximum 540s timeout. Safe to retry: every step is
// a query-driven delete, an idempotent membership cleanup, or a recursiveDelete, so a re-run
// after a partial failure just finishes the remainder.
exports.cleanupDeletedUser = functionsV1
  .runWith({ timeoutSeconds: 540, failurePolicy: true, maxInstances: 50 })
  .auth.user()
  .onDelete(async (user) => {
  const userId = user.uid;
  const writer = db.bulkWriter();

  const deleteQueries = [
    db.collection("memories").where("userId", "==", userId),
    db.collection("transfers").where("fromUserId", "==", userId),
    db.collection("transfers").where("toUserId", "==", userId),
    db.collection("notificationRequests").where("recipientUserId", "==", userId),
    db.collection("notificationRequests").where("data.fromUserId", "==", userId),
  ];

  for (const query of deleteQueries) {
    const snapshot = await query.get();
    snapshot.docs.forEach((doc) => writer.delete(doc.ref));
  }

  const places = await db
    .collection("places")
    .where("custodianIds", "array-contains", userId)
    .get();
  places.docs.forEach((doc) => {
    writer.update(doc.ref, {
      custodianIds: FieldValue.arrayRemove(userId),
      updatedAt: new Date().toISOString(),
    });
  });

  // Memberships elsewhere are removed with their memberCount decremented; owned communities
  // pass to their earliest-joined member, or are deleted when no one else is left (R24, R25).
  await communities.cleanupUserCommunities(db, userId);
  // Public profile, institution admin roles and reports the user filed.
  await cleanupUserSocialData(db, userId);

  await writer.close();
  // After the writer closes: the deleted user's own memories are gone first, so no notification
  // trigger or retry can re-create a notification from this user once these are removed.
  await deleteNotificationsFrom(db, userId);
  await db.recursiveDelete(db.collection("users").doc(userId));

  const bucket = admin.storage().bucket();
  await Promise.all([
    bucket.deleteFiles({ prefix: `memory-images/${userId}/` }),
    bucket.deleteFiles({ prefix: `memory-audio/${userId}/` }),
  ]);

  logger.info("Deleted account data", { userId });
});

exports.__private__ = {
  purgeExpired,
};
