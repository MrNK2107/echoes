const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const firebaseLogger = require("firebase-functions").logger;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;
const MAX_TOKENS_PER_USER = 10;
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const RECEIPT_CHUNK_SIZE = 300;
const MAX_RECEIPTS_PER_RUN = 1000;
const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;
const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEDUPE_DOCS = 20;

// Lock-screen text never contains user-generated strings: bodies are generic per type and the
// inbox document keeps the full body. Titles come from the notification doc.
const PUSH_BODIES = {
  memoryTagged: "Someone tagged you in a memory.",
  transferRequest: "You have a new custodianship request.",
  transferAccepted: "Your custodianship request was accepted.",
  transferRejected: "Your custodianship request was declined.",
  communityInvite: "You have a new community invitation.",
};

const chunk = (items, size) => {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

// Forwards one inbox notification to the user's most recently seen Expo push tokens.
// Never throws: push is best-effort, the inbox document is the source of truth. `fetch`,
// `logger`, `env` and `now` are injectable for tests. Ok tickets are stored as receipts for checkPushReceipts.
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
    now = () => new Date(),
  } = {},
) {
  if (typeof doc?.title !== "string") {
    logger.warn("Skipping push for notification without a string title", { uid, notificationId });
    return;
  }
  const body = Object.hasOwn(PUSH_BODIES, doc.type) ? PUSH_BODIES[doc.type] : undefined;
  if (body === undefined) {
    logger.warn("Skipping push for notification of unknown type", { uid, notificationId, type: String(doc.type) });
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
        body,
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
        const result = await response.json();
        const tickets = Array.isArray(result?.data) ? result.data : [];
        // Each ticket is handled on its own: one failed write must not skip the others.
        await Promise.all(
          tickets.map(async (ticket, index) => {
            const code = ticket?.details?.error;
            try {
              if (ticket?.status === "ok" && typeof ticket.id === "string" && ticket.id && group[index]) {
                const createdAt = now();
                await db.collection("pushReceipts").doc(ticket.id).set({
                  uid,
                  tokenId: group[index].ref.id,
                  createdAt,
                  expireAt: new Date(createdAt.getTime() + RECEIPT_TTL_MS),
                });
              } else if (code === "DeviceNotRegistered" && group[index]) {
                await group[index].ref.delete();
              } else if (ticket?.status === "error") {
                logger.warn("Expo push ticket error", { uid, notificationId, error: code ?? "unknown" });
              }
            } catch (error) {
              logger.error(
                ticket?.status === "ok" ? "Could not store a push receipt" : "Could not prune a push token",
                { uid, notificationId, error: String(error) },
              );
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
    const snapshot = await db.collectionGroup("pushTokens").where("token", "==", token).limit(MAX_DEDUPE_DOCS).get();
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

// Polls Expo for the delivery receipts of tickets older than 15 minutes (receipts are not ready
// sooner), at most 1000 per run in chunks of 300. DeviceNotRegistered removes the token; a receipt
// doc is deleted once its status is known. Receipts Expo does not know yet stay until they are 24 h old, then are given up.
// A failed fetch keeps every doc for the next run. Never throws.
async function receiptsHandler(
  db,
  fetchImpl,
  now,
  { logger = firebaseLogger, env = process.env } = {},
) {
  const summary = { checked: 0, removedTokens: 0, deletedReceipts: 0, expiredReceipts: 0 };
  try {
    const cutoff = new Date(now().getTime() - RECEIPT_MIN_AGE_MS);
    const snapshot = await db
      .collection("pushReceipts")
      .where("createdAt", "<=", cutoff)
      .orderBy("createdAt")
      .limit(MAX_RECEIPTS_PER_RUN)
      .get();
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;

    for (const group of chunk(snapshot.docs, RECEIPT_CHUNK_SIZE)) {
      summary.checked += group.length;
      try {
        const response = await fetchImpl(EXPO_RECEIPTS_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({ ids: group.map((d) => d.id) }),
        });
        if (!response.ok) {
          logger.error("Expo receipts request failed", { status: response.status });
          continue;
        }
        const result = await response.json();
        const receipts = result?.data && typeof result.data === "object" ? result.data : {};
        await Promise.all(
          group.map(async (d) => {
            const receipt = receipts[d.id];
            if (!receipt) {
              // Expo no longer knows this id: give up on it once it is older than the receipt TTL.
              const createdAt = d.data()?.createdAt;
              const ms = createdAt?.toDate ? createdAt.toDate().getTime() : new Date(createdAt).getTime();
              if (ms < now().getTime() - RECEIPT_TTL_MS) {
                await d.ref.delete();
                summary.expiredReceipts += 1;
              }
              return;
            }
            const code = receipt.details?.error;
            if (receipt.status === "error") {
              const { uid, tokenId } = d.data();
              if (code === "DeviceNotRegistered" && typeof uid === "string" && typeof tokenId === "string") {
                await db.collection("users").doc(uid).collection("pushTokens").doc(tokenId).delete();
                summary.removedTokens += 1;
              } else {
                logger.warn("Expo push receipt error", { error: code ?? "unknown" });
              }
            }
            await d.ref.delete();
            summary.deletedReceipts += 1;
          }),
        );
      } catch (error) {
        logger.error("Expo receipts request errored", { error: String(error) });
      }
    }
  } catch (error) {
    logger.error("Push receipt check failed", { error: String(error) });
  }
  return summary;
}

const checkPushReceipts = onSchedule(
  { schedule: "every 30 minutes", timeoutSeconds: 120 },
  async () => {
    const admin = require("firebase-admin");
    const result = await receiptsHandler(admin.firestore(), globalThis.fetch, () => new Date());
    firebaseLogger.info("Checked push receipts", result);
  },
);

module.exports = {
  PUSH_BODIES,
  receiptsHandler,
  checkPushReceipts,
  sendPushForNotification,
  createOnNotificationCreated,
  removeTokenFromOtherUsers,
  trimUserTokens,
  createOnPushTokenCreated,
};
