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
  try {
    const snapshot = await db.collection("users").doc(uid).collection("pushTokens").get();
    const tokens = snapshot.docs
      .map((d) => ({ ref: d.ref, ...d.data() }))
      .filter((t) => typeof t.token === "string" && t.token.length > 0)
      .sort((a, b) => String(b.lastSeenAt ?? "").localeCompare(String(a.lastSeenAt ?? "")))
      .slice(0, maxTokens);
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
        data: { type: doc.type, notificationId, ...(doc.data ?? {}) },
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
            if (ticket?.details?.error === "DeviceNotRegistered" && group[index]) {
              await group[index].ref.delete();
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

module.exports = { sendPushForNotification, createOnNotificationCreated };
