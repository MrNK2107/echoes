// ADR-0007: custodianship transfers change only through these callables (Admin SDK); clients
// have read-only rules on transfers and cannot update places. Transfer docs (spec "Plan 3
// decisions"): { placeId, fromUserId, toUserId, status, createdAt, respondedAt, revokeUntil,
// recipientWasCustodian } with ISO-string times; revokeTransfer also sets revokedAt.
// status: pending -> accepted | rejected | revoked | expired; accepted -> revoked.
// Invariant: at most one pending transfer per (placeId, toUserId). Custodians are additive
// (the sender stays a custodian).
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { FieldValue } = require("firebase-admin/firestore");
const { callable, idField } = require("./lib/callable");
const { assertNotBlocked } = require("./lib/blocks");
const { notify } = require("./lib/notify");

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 7 * DAY_MS;
const EXPIRE_BATCH_SIZE = 500;
const EXPIRE_CONCURRENCY = 20;
const TIMEOUT_SECONDS = 540;
const EXPIRE_BUDGET_MS = 480 * 1000;

const transferRef = (db, id) => db.collection("transfers").doc(id);
const placeRef = (db, id) => db.collection("places").doc(id);
const custodiansOf = (snap) => (snap.exists && Array.isArray(snap.data().custodianIds) ? snap.data().custodianIds : []);
const placeName = (snap) => (snap.exists && typeof snap.data().name === "string" ? snap.data().name : "a place");
const isPastWindow = (t, now) => now.getTime() > Date.parse(t.revokeUntil);
const blockRef = (db, owner, other) => db.collection("users").doc(owner).collection("blocks").doc(other);

// Notifications are best effort: a failure is logged and never fails a committed transfer.
async function notifySafely(db, args) {
  try {
    await notify(db, args);
  } catch (error) {
    logger.error("transfer notification failed", { type: args.type, to: args.to, error });
  }
}

// Errors: invalid-argument (self-transfer / bad input), not-found (place or recipient profile),
// permission-denied (caller not a custodian, or blocked either way), failed-precondition
// (recipient already a custodian), already-exists (pending request for the same place and
// recipient), resource-exhausted (20/day).
async function initiateTransfer({ uid, data: { placeId, toUserId }, db }) {
  if (toUserId === uid) throw new HttpsError("invalid-argument", "You can't transfer to yourself.");
  await assertNotBlocked(db, uid, toUserId);

  const ref = db.collection("transfers").doc();
  const now = new Date();
  const name = await db.runTransaction(async (tx) => {
    const [place, profile, existing] = await Promise.all([
      tx.get(placeRef(db, placeId)),
      tx.get(db.collection("publicProfiles").doc(toUserId)),
      tx.get(
        db
          .collection("transfers")
          .where("placeId", "==", placeId)
          .where("toUserId", "==", toUserId)
          .where("status", "==", "pending")
          .limit(1),
      ),
    ]);
    if (!place.exists) throw new HttpsError("not-found", "Place not found.");
    const custodians = custodiansOf(place);
    if (!custodians.includes(uid)) throw new HttpsError("permission-denied", "Only custodians can transfer.");
    if (!profile.exists) throw new HttpsError("not-found", "User not found.");
    if (custodians.includes(toUserId)) {
      throw new HttpsError("failed-precondition", "This person is already a custodian.");
    }
    if (!existing.empty) {
      throw new HttpsError("already-exists", "A request to this person is already pending.");
    }
    tx.set(ref, {
      placeId,
      fromUserId: uid,
      toUserId,
      status: "pending",
      createdAt: now.toISOString(),
      respondedAt: null,
      revokeUntil: new Date(now.getTime() + WINDOW_MS).toISOString(),
      recipientWasCustodian: null,
    });
    return placeName(place);
  });

  await notifySafely(db, {
    to: toUserId,
    type: "transferRequest",
    actorId: uid,
    params: { place: name },
    data: { transferId: ref.id, placeId },
    id: `transferRequest_${ref.id}`,
  });
  return { id: ref.id };
}

// Errors: not-found (transfer), permission-denied (caller is not the recipient, or - on
// accept - either user has since blocked the other), failed-precondition (not pending, past
// revokeUntil, or - on accept - the place is gone or the sender is no longer a custodian).
// Repeating the same answer (accept twice, decline twice) is a no-op returning the status.
async function respondToTransfer({ uid, data: { transferId, accept }, db }) {
  const status = accept ? "accepted" : "rejected";
  const now = new Date();
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(transferRef(db, transferId));
    if (!snap.exists) throw new HttpsError("not-found", "Transfer not found.");
    const t = snap.data();
    if (t.toUserId !== uid) throw new HttpsError("permission-denied", "This request isn't yours.");
    if (t.status === status) return { changed: false };
    if (t.status !== "pending") throw new HttpsError("failed-precondition", "This request is no longer open.");
    if (isPastWindow(t, now)) throw new HttpsError("failed-precondition", "This request has expired.");

    const [place, blockedByMe, blockedMe] = await Promise.all([
      tx.get(placeRef(db, t.placeId)),
      ...(accept ? [tx.get(blockRef(db, uid, t.fromUserId)), tx.get(blockRef(db, t.fromUserId, uid))] : []),
    ]);
    const at = now.toISOString();
    if (accept) {
      if (blockedByMe.exists || blockedMe.exists) {
        throw new HttpsError("permission-denied", "This action is not available.");
      }
      if (!place.exists) throw new HttpsError("failed-precondition", "This place no longer exists.");
      // The sender must still look after the place (e.g. A revoked A->B, then C accepts B->C).
      if (!custodiansOf(place).includes(t.fromUserId)) {
        throw new HttpsError("failed-precondition", "The sender is no longer a custodian.");
      }
      tx.update(place.ref, { custodianIds: FieldValue.arrayUnion(uid), updatedAt: at });
      tx.update(snap.ref, {
        status,
        respondedAt: at,
        recipientWasCustodian: custodiansOf(place).includes(uid),
      });
    } else {
      tx.update(snap.ref, { status, respondedAt: at });
    }
    return { changed: true, transfer: t, name: placeName(place) };
  });

  if (result.changed) {
    const type = accept ? "transferAccepted" : "transferRejected";
    await notifySafely(db, {
      to: result.transfer.fromUserId,
      type,
      actorId: uid,
      params: { place: result.name },
      data: { transferId, placeId: result.transfer.placeId },
      id: `${type}_${transferId}`,
    });
  }
  return { status };
}

// Errors: not-found (transfer), permission-denied (caller is not the sender),
// failed-precondition (past revokeUntil, or rejected/expired). Revoking twice is a no-op.
// When the recipient loses custodianship, their own pending transfers for the same place are
// revoked too (respondToTransfer also refuses a sender who is no longer a custodian).
async function revokeTransfer({ uid, data: { transferId }, db }) {
  const now = new Date();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(transferRef(db, transferId));
    if (!snap.exists) throw new HttpsError("not-found", "Transfer not found.");
    const t = snap.data();
    if (t.fromUserId !== uid) throw new HttpsError("permission-denied", "Only the sender can revoke.");
    if (t.status === "revoked") return;
    if (t.status !== "pending" && t.status !== "accepted") {
      throw new HttpsError("failed-precondition", "This transfer can't be revoked.");
    }
    if (isPastWindow(t, now)) throw new HttpsError("failed-precondition", "The revoke window has passed.");

    const at = now.toISOString();
    if (t.status === "accepted" && t.recipientWasCustodian !== true) {
      const [place, onward] = await Promise.all([
        tx.get(placeRef(db, t.placeId)),
        tx.get(
          db
            .collection("transfers")
            .where("fromUserId", "==", t.toUserId)
            .where("placeId", "==", t.placeId)
            .where("status", "==", "pending"),
        ),
      ]);
      if (place.exists) {
        tx.update(place.ref, { custodianIds: FieldValue.arrayRemove(t.toUserId), updatedAt: at });
      }
      onward.docs.forEach((doc) => tx.update(doc.ref, { status: "revoked", revokedAt: at }));
    }
    tx.update(snap.ref, { status: "revoked", revokedAt: at });
  });
  return { status: "revoked" };
}

// Expires one transfer only if it is still pending and stale when the transaction reads it, so
// a transfer accepted/revoked after the page query is never overwritten. Returns true if expired.
async function expireOne(db, ref, cutoff) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const t = snap.data();
    if (t.status !== "pending" || !(t.createdAt < cutoff)) return false;
    tx.update(ref, { status: "expired" });
    return true;
  });
}

/**
 * Marks pending transfers created more than 7 days before `now` as expired, a page of
 * `batchSize` at a time (each doc in its own small transaction, EXPIRE_CONCURRENCY at once;
 * each page re-queried after its writes). Stops when a page comes
 * back short, or before a new page once `budgetMs` (measured with `clock`) has elapsed; the
 * rest is picked up by the next run. Returns the number expired.
 */
async function expireStale(
  db,
  now,
  {
    batchSize = EXPIRE_BATCH_SIZE,
    budgetMs = EXPIRE_BUDGET_MS,
    clock = Date.now,
    log = (msg, data) => logger.info(msg, data),
  } = {},
) {
  const cutoff = new Date(now.getTime() - WINDOW_MS).toISOString();
  const startedAt = clock();
  let expired = 0;
  for (let page = 0; ; page += 1) {
    if (page > 0 && clock() - startedAt >= budgetMs) {
      log("Transfer expiry time budget spent; resuming next run", { expired });
      break;
    }
    const snapshot = await db
      .collection("transfers")
      .where("status", "==", "pending")
      .where("createdAt", "<", cutoff)
      .orderBy("createdAt")
      .limit(batchSize)
      .get();
    if (snapshot.docs.length === 0) break;
    for (let i = 0; i < snapshot.docs.length; i += EXPIRE_CONCURRENCY) {
      const results = await Promise.all(
        snapshot.docs.slice(i, i + EXPIRE_CONCURRENCY).map((doc) => expireOne(db, doc.ref, cutoff)),
      );
      expired += results.filter(Boolean).length;
    }
    if (snapshot.docs.length < batchSize) break;
  }
  return expired;
}

const expireTransfers = onSchedule(
  { schedule: "every 24 hours", timeoutSeconds: TIMEOUT_SECONDS },
  async () => {
    const expired = await expireStale(admin.firestore(), new Date());
    logger.info("Expired pending transfers", { expired });
  },
);

const definitions = {
  initiateTransfer: {
    schema: { placeId: idField, toUserId: idField },
    rateLimit: { action: "initiateTransfer", perDay: 20 },
    handler: initiateTransfer,
  },
  respondToTransfer: {
    schema: { transferId: idField, accept: { type: "boolean" } },
    handler: respondToTransfer,
  },
  revokeTransfer: { schema: { transferId: idField }, handler: revokeTransfer },
};

module.exports = {
  definitions,
  expireStale,
  expireTransfers,
  EXPIRE_BATCH_SIZE,
  initiateTransfer: callable("initiateTransfer", definitions.initiateTransfer, initiateTransfer),
  respondToTransfer: callable("respondToTransfer", definitions.respondToTransfer, respondToTransfer),
  revokeTransfer: callable("revokeTransfer", definitions.revokeTransfer, revokeTransfer),
};
