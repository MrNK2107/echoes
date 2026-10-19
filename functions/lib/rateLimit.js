const { HttpsError } = require("firebase-functions/v2/https");
const { Timestamp } = require("firebase-admin/firestore");

const DAY_MS = 24 * 60 * 60 * 1000;

// One counter doc per (user, action, UTC day); server-only (rules deny all client access).
// Consumes `amount` units atomically; denies the whole call when they would exceed perDay.
async function incrementRateLimit(db, uid, action, perDay, now = new Date(), amount = 1) {
  const day = now.toISOString().slice(0, 10);
  const ref = db.doc(`rateLimits/${uid}_${action}_${day}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count + amount > perDay) {
      throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
    }
    // TTL-ready: enable a Firestore TTL policy on collection group `rateLimits`, field `expireAt`.
    const expireAt = Timestamp.fromDate(new Date(Date.parse(`${day}T00:00:00.000Z`) + 2 * DAY_MS));
    tx.set(ref, { uid, action, day, count: count + amount, updatedAt: now.toISOString(), expireAt });
  });
}

// For triggers, which cannot throw to a caller: consumes one unit and returns false (instead of
// throwing) when the daily budget is exhausted.
async function tryConsumeRateLimit(db, uid, action, perDay, now = new Date(), amount = 1) {
  try {
    await incrementRateLimit(db, uid, action, perDay, now, amount);
    return true;
  } catch (error) {
    if (error instanceof HttpsError && error.code === "resource-exhausted") return false;
    throw error;
  }
}

module.exports = { incrementRateLimit, tryConsumeRateLimit };
