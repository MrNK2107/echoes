const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const firebaseLogger = require("firebase-functions").logger;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;
const MAX_TOKENS_PER_USER = 10;

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// Forwards one inbox notification to the user's most recently seen Expo push tokens.
// Never throws: push is best-effort, the inbox document is the source of truth. `fetch`,
// `logger` and `env` are injectable for tests. Receipt polling is out of scope.
async function sendPushForNotification(
  db,
  uid,
  notificationId,
  doc,
  {
    fetch: fetchImpl = globalThis.fetch,
    logger = firebaseLogger,
    env = process.env,
    maxTokens = MAX_TOKENS_PER_USER,
  } = {},
) {
  if (typeof doc?.title !== "string" || typeof doc?.body !== "string") {
    logger.warn("Skipping push for notification without string title/body", { uid, notificationId });
    return;
  }
  try {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("pushTokens")
      .orderBy("lastSeenAt", "desc")
      .limit(maxTokens)
      .get();
    const tokens = snapshot.docs
      .map((d) => ({ ref: d.ref, ...d.data() }))
      .filter((t) => typeof t.token === "string" && t.token.length > 0);
    if (tokens.length === 0) return;

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;

    for (const group of chunk(tokens, CHUNK_SIZE)) {
      const messages = group.map((t) => ({
        to: t.token,
        title: doc.title,
        body: doc.body,
        data: { ...(doc.data ?? {}), type: doc.type, notificationId },
        sound: "default",
        channelId: "default",
      }));
      try {
        const response = await fetchImpl(EXPO_PUSH_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(messages),
        });
        if (!response.ok) {
          logger.error("Expo push request failed", { uid, notificationId, status: response.status });
          continue;
        }
        const body = await response.json();
        const tickets = Array.isArray(body?.data) ? body.data : [];
        await Promise.all(
          tickets.map(async (ticket, index) => {
            const code = ticket?.details?.error;
            if (code === "DeviceNotRegistered" && group[index]) {
              await group[index].ref.delete();
            } else if (ticket?.status === "error") {
              logger.warn("Expo push ticket error", { uid, notificationId, error: code ?? "unknown" });
            }
          }),
        );
      } catch (error) {
        logger.error("Expo push request errored", { uid, notificationId, error: String(error) });
      }
    }
  } catch (error) {
    logger.error("Push delivery failed", { uid, notificationId, error: String(error) });
  }
}

function createOnNotificationCreated(getDb) {
  return onDocumentCreated("users/{uid}/notifications/{id}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;
    await sendPushForNotification(getDb(), event.params.uid, event.params.id, snapshot.data());
  });
}

// A token belongs to one device, and a device to one signed-in user: when user B registers a token
// that user A also holds (shared phone, sign-out not completed), A's copy is removed so A no longer
// receives B's notifications. Never throws.
async function removeTokenFromOtherUsers(db, uid, token, { logger = firebaseLogger } = {}) {
  try {
    const snapshot = await db.collectionGroup("pushTokens").where("token", "==", token).get();
    await Promise.all(
      snapshot.docs
        .filter((d) => d.ref.path.split("/")[1] !== uid)
        .map((d) => d.ref.delete()),
    );
  } catch (error) {
    logger.error("Could not remove a push token from other users", { uid, error: String(error) });
  }
}

// Keeps a user's token set bounded: deletes everything beyond the newest `max` by lastSeenAt.
// Reads at most 100 docs (steady state is max+1 since every create trims). Never throws.
async function trimUserTokens(db, uid, { max = MAX_TOKENS_PER_USER, logger = firebaseLogger } = {}) {
  try {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("pushTokens")
      .orderBy("lastSeenAt", "desc")
      .limit(100)
      .get();
    await Promise.all(snapshot.docs.slice(max).map((d) => d.ref.delete()));
  } catch (error) {
    logger.error("Could not trim push tokens", { uid, error: String(error) });
  }
}

function createOnPushTokenCreated(getDb) {
  return onDocumentCreated("users/{uid}/pushTokens/{tokenId}", async (event) => {
    const token = event.data?.data()?.token;
    if (typeof token !== "string" || token.length === 0) return;
    await removeTokenFromOtherUsers(getDb(), event.params.uid, token);
    await trimUserTokens(getDb(), event.params.uid);
  });
}

module.exports = {
  sendPushForNotification,
  createOnNotificationCreated,
  removeTokenFromOtherUsers,
  trimUserTokens,
  createOnPushTokenCreated,
};
