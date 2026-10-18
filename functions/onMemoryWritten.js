const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { calculateAura } = require("./aura");
const { GEO_THRESHOLD, yearCommunity, eraCommunity, geoCommunity } = require("./lib/domain");

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
  if (!place.exists) return null;

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
    if (error?.code === NOT_FOUND) return null;
    throw error;
  }
  await placeRef.collection("auraHistory").add({
    placeId,
    aura: aggregate.aura,
    recordedAt: now.toISOString(),
  });
  return aggregate;
}

const autoCommunity = ({ name }, { description, type, ownerId, placeId = null, memberCount }, at) => ({
  name,
  description,
  type,
  ownerId,
  placeId,
  institutionId: null,
  memberCount,
  createdAt: at,
  updatedAt: at,
});

// gRPC status Firestore uses when create() targets an existing document.
const ALREADY_EXISTS = 6;

// create() is the idempotency guard: retried or concurrent triggers create a doc once. Returns
// whether this call created it.
async function createIfMissing(ref, data) {
  try {
    await ref.create(data);
    return true;
  } catch (error) {
    if (error?.code === ALREADY_EXISTS) return false;
    throw error;
  }
}

// Spec "Plan 3 decisions": a created memory ensures `time-<y>` and `era-<d>s` (owner = the
// first author to need them) and joins its author to the year community.
// No transactions here on purpose: this trigger runs asynchronously, and an open transaction
// makes the Firestore emulator's reset fail (409) between contract tests. Instead the
// membership, its count and the user's communityIds go in one atomic batch whose create()
// fails if the member already exists, so each member is counted once.
async function ensureTimeCommunities(db, authorId, createdAt, now) {
  if (typeof authorId !== "string" || !authorId) return;
  const at = now.toISOString();
  const year = yearCommunity(createdAt);
  const era = eraCommunity(createdAt);
  const communities = db.collection("communities");
  const yearRef = communities.doc(year.id);
  const memberRef = yearRef.collection("members").doc(authorId);
  const userRef = db.collection("users").doc(authorId);

  const timeBased = { type: "timeBased", ownerId: authorId, memberCount: 0 };
  await createIfMissing(
    communities.doc(era.id),
    autoCommunity(era, { ...timeBased, description: `Memories from the ${era.id.slice(4)}.` }, at),
  );
  await createIfMissing(
    yearRef,
    autoCommunity(year, { ...timeBased, description: `Memories from ${year.id.slice(5)}.` }, at),
  );

  const [yearSnap, memberSnap, userSnap] = await Promise.all([
    yearRef.get(),
    memberRef.get(),
    userRef.get(),
  ]);
  if (memberSnap.exists || !yearSnap.exists) return;
  const role = yearSnap.data().ownerId === authorId ? "owner" : "member";
  const batch = db.batch();
  batch.create(memberRef, { userId: authorId, role, joinedAt: at });
  batch.update(yearRef, { memberCount: FieldValue.increment(1) });
  // Lets the author pick the year community for community privacy; never recreates a
  // deleted users doc.
  if (userSnap.exists) batch.update(userRef, { communityIds: FieldValue.arrayUnion(year.id) });
  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === ALREADY_EXISTS) return; // a concurrent delivery joined them first
    throw error;
  }
}

// Creates `geo-<placeId>` once the place has GEO_THRESHOLD public memories (owner = first
// custodian, else the triggering author) and links it from place.communityId. Idempotent: an
// existing community is never rewritten, only relinked.
async function ensureGeoCommunity(db, placeId, fallbackOwnerId, now) {
  const placeRef = db.collection("places").doc(placeId);
  const place = await placeRef.get();
  if (!place.exists) return;
  const data = place.data();
  if ((data.publicMemoryCount ?? 0) < GEO_THRESHOLD) return;
  const geo = geoCommunity({ id: placeId, name: data.name ?? "Unnamed place" });
  if (data.communityId === geo.id) return;

  const custodians = Array.isArray(data.custodianIds) ? data.custodianIds : [];
  await createIfMissing(
    db.collection("communities").doc(geo.id),
    autoCommunity(
      geo,
      {
        type: "geographic",
        ownerId: custodians[0] ?? fallbackOwnerId ?? null,
        placeId,
        memberCount: 0,
        description: `Memories shared at ${data.name ?? "this place"}.`,
      },
      now.toISOString(),
    ),
  );
  try {
    await placeRef.update({ communityId: geo.id });
  } catch (error) {
    if (error?.code !== NOT_FOUND) throw error;
  }
}

// Testable core of the trigger. `before`/`after` are memory data or null.
async function handleMemoryWrite(db, { before, after }, now) {
  const placeIds = new Set(
    [after?.placeId, before?.placeId].filter(
      (id) => typeof id === "string" && id.length > 0,
    ),
  );
  for (const placeId of placeIds) {
    try {
      const aggregate = await recomputePlace(db, placeId, now);
      // Checked on every write, not only creates: the >= threshold + communityId guard keeps it
      // idempotent, and a memory made public by an edit can also tip a place over.
      if (aggregate && aggregate.publicMemoryCount >= GEO_THRESHOLD) {
        await ensureGeoCommunity(db, placeId, after?.userId ?? before?.userId, now);
      }
    } catch (error) {
      logger.error("Failed to recompute place aggregate", { placeId, error });
      throw error;
    }
  }
  if (!before && after && after.isDeleted !== true) {
    try {
      await ensureTimeCommunities(db, after.userId, toDate(after.createdAt), now);
    } catch (error) {
      logger.error("Failed to ensure time communities", { userId: after.userId, error });
      throw error;
    }
  }
}

const onMemoryWritten = onDocumentWritten("memories/{memoryId}", async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null;
  const after = event.data?.after?.exists ? event.data.after.data() : null;
  await handleMemoryWrite(admin.firestore(), { memoryId: event.params?.memoryId, before, after }, new Date());
});

module.exports = {
  onMemoryWritten,
  handleMemoryWrite,
  ensureTimeCommunities,
  ensureGeoCommunity,
  buildPlaceAggregate,
  memoryFromData,
  recomputePlace,
  toDate,
};
