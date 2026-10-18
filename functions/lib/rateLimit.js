const { HttpsError } = require("firebase-functions/v2/https");

// One counter doc per (user, action, UTC day); server-only (rules deny all client access).
async function incrementRateLimit(db, uid, action, perDay, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const ref = db.doc(`rateLimits/${uid}_${action}_${day}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? snap.data().count || 0 : 0;
    if (count >= perDay) {
      throw new HttpsError("resource-exhausted", "Rate limit exceeded.");
    }
    tx.set(ref, { uid, action, day, count: count + 1, updatedAt: now.toISOString() });
  });
}

module.exports = { incrementRateLimit };
