const admin = require("firebase-admin");
// The modular import works under the functions emulator, whose proxied `admin.firestore`
// lacks the FieldValue namespace.
const { FieldValue } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const functionsV1 = require("firebase-functions/v1");
const { onMemoryWritten } = require("./onMemoryWritten");
const { onPublicProfileWritten } = require("./onPublicProfileWritten");
const communities = require("./communities");
const transfers = require("./transfers");
const institutions = require("./institutions");
const safety = require("./safety");
const { cleanupUserSocialData, deleteNotificationsFrom } = require("./accountCleanup");
const { onMemoryCreatedTags, notifyReleasedTags } = require("./tags");
const { createOnNotificationCreated, createOnPushTokenCreated } = require("./push");
const {
  purgeDeletedMemories,
  __private__: { purgeExpired },
} = require("./purgeDeletedMemories");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

exports.onMemoryWritten = onMemoryWritten;
exports.onPublicProfileWritten = onPublicProfileWritten;
exports.purgeDeletedMemories = purgeDeletedMemories;
exports.onMemoryCreatedTags = onMemoryCreatedTags;
exports.notifyReleasedTags = notifyReleasedTags;
exports.onNotificationCreated = createOnNotificationCreated(() => db);
exports.onPushTokenCreated = createOnPushTokenCreated(() => db);
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

exports.dispatchNotificationRequest = onDocumentCreated(
  "notificationRequests/{requestId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      return;
    }

    const request = snapshot.data();
    const recipientUserId = request.recipientUserId;
    if (typeof recipientUserId !== "string" || recipientUserId.length === 0) {
      await snapshot.ref.update({
        status: "failed",
        error: "Missing recipientUserId",
        processedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const tokenSnapshots = await db
      .collection("users")
      .doc(recipientUserId)
      .collection("notificationTokens")
      .get();
    const tokens = tokenSnapshots.docs
      .map((doc) => doc.id)
      .filter((token) => token.length > 0);

    if (tokens.length === 0) {
      await snapshot.ref.update({
        status: "skipped",
        skippedReason: "No notification tokens",
        processedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const response = await messaging.sendEachForMulticast(
      buildMulticastMessage(request, tokens),
    );

    await snapshot.ref.update({
      status: response.failureCount > 0 ? "partial" : "sent",
      successCount: response.successCount,
      failureCount: response.failureCount,
      processedAt: FieldValue.serverTimestamp(),
    });

    await pruneInvalidTokens({
      recipientUserId,
      tokens,
      responses: response.responses,
    });
  },
);

// Authentication deletion is the authoritative account-removal event. Keeping
// cleanup server-side prevents a client from selectively leaving personal data
// behind and also covers deletions initiated from the Firebase console.
// Retries on failure (failurePolicy) with the maximum 540s timeout. Safe to retry: every step is
// a query-driven delete, an idempotent membership cleanup, or a recursiveDelete, so a re-run
// after a partial failure just finishes the remainder.
exports.cleanupDeletedUser = functionsV1
  .runWith({ timeoutSeconds: 540, failurePolicy: true })
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

function buildMulticastMessage(request, tokens) {
  return {
    tokens,
    notification: {
      title: safeString(request.title),
      body: safeString(request.body),
    },
    data: stringifyData(request.data),
  };
}

function stringifyData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, safeString(value)]),
  );
}

function safeString(value) {
  return value == null ? "" : String(value);
}

async function pruneInvalidTokens({ recipientUserId, tokens, responses }) {
  const invalidCodes = new Set([
    "messaging/invalid-registration-token",
    "messaging/registration-token-not-registered",
  ]);
  const deletions = responses
    .map((response, index) => ({ response, token: tokens[index] }))
    .filter(({ response }) => invalidCodes.has(response.error?.code))
    .map(({ token }) =>
      db
        .collection("users")
        .doc(recipientUserId)
        .collection("notificationTokens")
        .doc(token)
        .delete(),
    );

  if (deletions.length > 0) {
    logger.info("Pruning invalid notification tokens", {
      recipientUserId,
      count: deletions.length,
    });
    await Promise.all(deletions);
  }
}

exports.__private__ = {
  buildMulticastMessage,
  stringifyData,
  purgeExpired,
};
