const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

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
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
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
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await pruneInvalidTokens({
      recipientUserId,
      tokens,
      responses: response.responses,
    });
  },
);

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
};
