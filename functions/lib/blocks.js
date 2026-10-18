const { HttpsError } = require("firebase-functions/v2/https");

// True when either user has blocked the other.
async function isBlocked(db, a, b) {
  const [ab, ba] = await Promise.all([
    db.doc(`users/${a}/blocks/${b}`).get(),
    db.doc(`users/${b}/blocks/${a}`).get(),
  ]);
  return ab.exists || ba.exists;
}

async function assertNotBlocked(db, a, b) {
  if (await isBlocked(db, a, b)) {
    throw new HttpsError("permission-denied", "This action is not available.");
  }
}

module.exports = { isBlocked, assertNotBlocked };
