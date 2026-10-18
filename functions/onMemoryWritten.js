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

// gRPC status code Firestore uses when an update targets a missing document.
const NOT_FOUND = 5;

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

// The rules validate sentiment on write, but legacy or Admin-written docs are not covered; clamp
// so one bad value cannot swamp a place's aura. Non-numeric values (NaN) count as neutral.
function clampCompound(value) {
  return Math.max(-1, Math.min(1, Number(value) || 0));
}

function memoryFromData(data) {
  return {
    privacy: data.privacy,
    isDeleted: data.isDeleted === true,
    sentiment: { compound: clampCompound(data.sentiment?.compound) },
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

  // update (not set/merge) so a place deleted meanwhile is never recreated as a fragment
  // without name or custodianIds.
  try {
    await placeRef.update(aggregate);
  } catch (error) {
    if (error?.code === NOT_FOUND) return;
    throw error;
  }
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

module.exports = { onMemoryWritten, buildPlaceAggregate, memoryFromData, recomputePlace, toDate };
