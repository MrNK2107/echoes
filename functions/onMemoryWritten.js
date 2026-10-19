const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { calculateAura } = require("./aura");
const { incrementMemberCount } = require("./memberCounts");
const {
  GEO_THRESHOLD,
  yearCommunity,
  eraCommunity,
  geoCommunity,
  containsProfanity,
  SYSTEM_OWNER,
} = require("./lib/domain");

// Memory dates are Firestore Timestamps; legacy docs may hold ISO strings. Returns null when the
// value cannot be parsed.
function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// Aura input: unparseable dates count as the epoch (maximally decayed).
function toDate(value) {
  return parseDate(value) ?? new Date(0);
}

// gRPC status code Firestore uses when an update targets a missing document.
const NOT_FOUND = 5;

function buildPlaceAggregate(memories, now) {
  // Hidden (staff-moderated) memories are excluded from every count and the aura.
  const live = memories.filter((m) => !m.isDeleted && !m.hidden);
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
    hidden: data.moderation === "hidden",
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
  // History records the aura only, so append only when the aura score, dominant sentiment or its
  // memory count changed, so no-op recomputes add no entries.
  const prev = place.data();
  const changed =
    prev.aura?.compoundScore !== aggregate.aura.compoundScore ||
    prev.aura?.dominantSentiment !== aggregate.aura.dominantSentiment ||
    prev.aura?.memoryCount !== aggregate.aura.memoryCount;
  if (changed) {
    await placeRef.collection("auraHistory").add({
      placeId,
      aura: aggregate.aura,
      recordedAt: now.toISOString(),
    });
  }
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

const MIN_COMMUNITY_YEAR = 1900;

// Spec "Plan 3 decisions": a created memory ensures `time-<y>` and `era-<d>s` and joins its
// author to the year community as a member, unless they left it before (R26:
// users/{uid}.leftCommunityIds).
// No transactions here on purpose: this trigger runs asynchronously, and an open transaction
// makes the Firestore emulator's reset fail (409) between contract tests. Instead the
// membership, its count and the user's communityIds go in one atomic batch whose create()
// fails if the member already exists, so each member is counted once.
async function ensureTimeCommunities(db, authorId, createdAt, now) {
  if (typeof authorId !== "string" || !authorId) return;
  // Ignore implausible years (client clocks, legacy data) rather than minting time-0001 style
  // communities. The aggregate path is unaffected.
  const y = createdAt.getUTCFullYear();
  if (y < MIN_COMMUNITY_YEAR || y > now.getUTCFullYear()) return;
  const at = now.toISOString();
  const year = yearCommunity(createdAt);
  const era = eraCommunity(createdAt);
  const communities = db.collection("communities");
  const yearRef = communities.doc(year.id);
  const memberRef = yearRef.collection("members").doc(authorId);
  const userRef = db.collection("users").doc(authorId);

  const timeBased = { type: "timeBased", ownerId: SYSTEM_OWNER, memberCount: 0 };
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
  const left = userSnap.exists ? userSnap.data().leftCommunityIds : undefined;
  if (Array.isArray(left) && left.includes(year.id)) return;
  const batch = db.batch();
  batch.create(memberRef, { userId: authorId, role: "member", joinedAt: at });
  incrementMemberCount(batch, yearRef, 1); // a shard: the rollup recounts the members
  // Lets the author pick the year community for community privacy; never recreates a
  // deleted users doc.
  if (userSnap.exists) batch.update(userRef, { communityIds: FieldValue.arrayUnion(year.id) });
  try {
    await batch.commit();
  } catch (error) {
    if (error?.code === ALREADY_EXISTS) return; // a concurrent delivery joined them first
    if (error?.code === NOT_FOUND) return; // the community or users doc vanished: nothing to join
    throw error;
  }
  // The shard write has no precondition on the community doc: if it was deleted meanwhile the
  // join committed as an orphan. Best-effort cleanup of the membership and the user's link.
  if (!(await yearRef.get()).exists) {
    logger.warn("Year community vanished mid-join; removing the orphan membership", {
      communityId: year.id,
      userId: authorId,
    });
    try {
      await memberRef.delete();
      if (userSnap.exists) await userRef.update({ communityIds: FieldValue.arrayRemove(year.id) });
    } catch (error) {
      if (error?.code !== NOT_FOUND) logger.error("Orphan join cleanup failed", { error });
    }
  }
}

// Creates `geo-<placeId>` (owner "system", R25) once the place has GEO_THRESHOLD public
// memories and links it from place.communityId. Idempotent: an existing community is never
// rewritten, only relinked; a link to a missing community gets the community recreated.
async function ensureGeoCommunity(db, placeId, now) {
  const placeRef = db.collection("places").doc(placeId);
  const place = await placeRef.get();
  if (!place.exists) return;
  const data = place.data();
  if ((data.publicMemoryCount ?? 0) < GEO_THRESHOLD) return;
  const geo = geoCommunity({ id: placeId, name: data.name ?? "Unnamed place" });
  const geoRef = db.collection("communities").doc(geo.id);
  // A read is cheaper than a failing create() on every later write to a busy place.
  if (!(await geoRef.get()).exists) {
    const description = `Memories shared at ${data.name ?? "this place"}.`;
    const fields = { type: "geographic", ownerId: SYSTEM_OWNER, placeId, memberCount: 0, description };
    await createIfMissing(geoRef, autoCommunity(geo, fields, now.toISOString()));
  }
  if (data.communityId === geo.id) return;
  try {
    await placeRef.update({ communityId: geo.id });
  } catch (error) {
    if (error?.code !== NOT_FOUND) throw error;
  }
}

// ADR-0008: memories whose text contains profanity get flags.profanity = true so staff can
// find them; they are not hidden. Only writes when the flag is missing: no write for clean text,
// and the re-trigger caused by this update skips it (the place recompute does run again, once).
// Edits are covered too, so
// text changed after creation cannot dodge the flag. update() never recreates a deleted doc.
async function flagProfanity(db, memoryId, after) {
  if (typeof memoryId !== "string" || !memoryId) return;
  if (typeof after.textContent !== "string" || after.flags?.profanity === true) return;
  if (!containsProfanity(after.textContent)) return;
  try {
    await db.collection("memories").doc(memoryId).update({ "flags.profanity": true });
  } catch (error) {
    if (error?.code !== NOT_FOUND) throw error;
  }
}

// The exact memory fields buildPlaceAggregate / ensureGeoCommunity / ensureTimeCommunities read:
// placeId (which place), privacy + isDeleted + moderation=="hidden" (which memories count),
// clamped sentiment.compound and createdAt (aura weighting). Sentiment is computed client-side
// (rules validate it), so textContent is NOT an input. flags, text edits, tags etc. are ignored.
function aggregateKey(data) {
  const m = memoryFromData(data);
  return JSON.stringify([
    data.placeId ?? null,
    m.privacy ?? null,
    m.isDeleted,
    m.hidden,
    m.sentiment.compound,
    parseDate(data.createdAt)?.getTime() ?? null,
  ]);
}

// Testable core of the trigger. `before`/`after` are memory data or null.
async function handleMemoryWrite(db, { memoryId, before, after }, now) {
  if (after) await flagProfanity(db, memoryId, after);
  // Updates that change no aggregate input (e.g. the profanity-flag echo) skip the recompute.
  const aggregateUnchanged = before && after && aggregateKey(before) === aggregateKey(after);
  const placeIds = new Set(
    aggregateUnchanged
      ? []
      : [after?.placeId, before?.placeId].filter((id) => typeof id === "string" && id.length > 0),
  );
  for (const placeId of placeIds) {
    try {
      const aggregate = await recomputePlace(db, placeId, now);
      // Checked on every write, not only creates: the >= threshold + communityId guard keeps it
      // idempotent, and a memory made public by an edit can also tip a place over.
      if (aggregate && aggregate.publicMemoryCount >= GEO_THRESHOLD) {
        await ensureGeoCommunity(db, placeId, now);
      }
    } catch (error) {
      logger.error("Failed to recompute place aggregate", { placeId, error });
      throw error;
    }
  }
  const createdAt = after ? parseDate(after.createdAt) : null;
  // Unparseable dates would otherwise land everything in 1970 communities.
  if (!before && after && after.isDeleted !== true && createdAt) {
    try {
      await ensureTimeCommunities(db, after.userId, createdAt, now);
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
  flagProfanity,
  ensureTimeCommunities,
  ensureGeoCommunity,
  buildPlaceAggregate,
  memoryFromData,
  recomputePlace,
  parseDate,
  toDate,
};
