const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { calculateAura } = require("./aura");

// Memory dates are Firestore Timestamps; legacy docs may hold ISO strings.
function toDate(value) {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date(0);
}

function buildPlaceAggregate(memories, now) {
  const live = memories.filter((m) => !m.isDeleted);
  const livePublic = live.filter((m) => m.privacy === "public");
  return {
    aura: calculateAura(livePublic, now),
    memoryCount: live.length,
    publicMemoryCount: livePublic.length,
    updatedAt: now.toISOString(),
  };
}

function memoryFromData(data) {
  return {
    privacy: data.privacy,
    isDeleted: data.isDeleted === true,
    sentiment: { compound: Number(data.sentiment?.compound ?? 0) },
    createdAt: toDate(data.createdAt),
  };
}

async function recomputePlace(db, placeId, now) {
  const placeRef = db.collection("places").doc(placeId);
  const place = await placeRef.get();
  if (!place.exists) return;

  const snapshot = await db
    .collection("memories")
    .where("placeId", "==", placeId)
    .get();
  const aggregate = buildPlaceAggregate(
    snapshot.docs.map((d) => memoryFromData(d.data())),
    now,
  );

  await placeRef.set(aggregate, { merge: true });
  await placeRef.collection("auraHistory").add({
    placeId,
    aura: aggregate.aura,
    recordedAt: now.toISOString(),
  });
}

const onMemoryWritten = onDocumentWritten("memories/{memoryId}", async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  const placeIds = new Set(
    [after?.placeId, before?.placeId].filter(
      (id) => typeof id === "string" && id.length > 0,
    ),
  );
  if (placeIds.size === 0) return;

  const db = admin.firestore();
  const now = new Date();
  for (const placeId of placeIds) {
    try {
      await recomputePlace(db, placeId, now);
    } catch (error) {
      logger.error("Failed to recompute place aggregate", { placeId, error });
      throw error;
    }
  }
});

module.exports = { onMemoryWritten, buildPlaceAggregate, toDate };
