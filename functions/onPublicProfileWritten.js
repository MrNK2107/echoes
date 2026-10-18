const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { normalizeName } = require("./lib/domain");

// Keeps displayNameLower (the search key) server-computed. Writes only on a mismatch, so the
// echo write it triggers sees equal values and stops.
async function syncDisplayNameLower(db, event) {
  const after = event.data && event.data.after;
  if (!after || !after.exists) return false;
  const profile = after.data();
  if (typeof profile.displayName !== "string") return false;
  const lower = normalizeName(profile.displayName);
  if (profile.displayNameLower === lower) return false;
  await db.doc(`publicProfiles/${event.params.uid}`).update({ displayNameLower: lower });
  return true;
}

const onPublicProfileWritten = onDocumentWritten("publicProfiles/{uid}", (event) =>
  syncDisplayNameLower(require("firebase-admin").firestore(), event),
);

module.exports = { onPublicProfileWritten, syncDisplayNameLower };
