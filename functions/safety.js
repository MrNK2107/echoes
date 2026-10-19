// ADR-0008 reporting and auto-hide. reports/{memoryId}_{reporterId} =
// { memoryId, reporterId, reporterVerified, reason, note, createdAt } (server-only; rules deny
// clients). The deterministic id makes one report per (memory, reporter); the third distinct
// VERIFIED reporter (ID token email_verified === true) sets memories/{id}.moderation = 'hidden'
// (exactly once: later reports never re-hide a memory staff restored by clearing the field).
// Unverified reports, and legacy docs without reporterVerified, are stored but never count.
// reportContent reports a community or a profile into reports/{targetType}_{targetId}_{uid} =
// { targetType, targetId, reporterId, reporterVerified, reason, note, createdAt }; it never
// auto-hides (staff act) and shares the reportMemory daily budget.
// Errors: invalid-argument, failed-precondition (own memory, or missing / not visible to the
// caller — the same answer, so existence of private memories is not revealed), already-exists
// (already reported), resource-exhausted (20/day).
const { HttpsError } = require("firebase-functions/v2/https");
const { callable, idField } = require("./lib/callable");
const { canViewMemory } = require("./lib/visibility");

const HIDE_AT = 3;
const REASONS = ["spam", "harassment", "hate", "sexual", "violence", "other"];

async function reportMemory({ uid, data: { memoryId, reason, note }, db, request }) {
  const reporterVerified = request?.auth?.token?.email_verified === true;
  const memoryRef = db.collection("memories").doc(memoryId);
  const reportRef = db.collection("reports").doc(`${memoryId}_${uid}`);
  const now = new Date();

  // Visibility needs a membership read for community memories; checked before the transaction,
  // and the transaction re-reads the memory so a hide is never applied to a missing doc.
  const memory = await memoryRef.get();
  if (memory.exists && memory.data().userId === uid) {
    throw new HttpsError("failed-precondition", "You can't report your own memory.");
  }
  if (!memory.exists || !(await canViewMemory(db, memory.data(), uid, now))) {
    throw new HttpsError("failed-precondition", "This memory isn't available.");
  }

  await db.runTransaction(async (tx) => {
    const [existing, current] = await Promise.all([tx.get(reportRef), tx.get(memoryRef)]);
    if (existing.exists) throw new HttpsError("already-exists", "You already reported this memory.");
    if (!current.exists) throw new HttpsError("failed-precondition", "This memory isn't available.");
    tx.create(reportRef, {
      memoryId,
      reporterId: uid,
      reporterVerified,
      reason,
      note: note ? note : null,
      createdAt: now.toISOString(),
    });
    // Only a verified report on a not-yet-hidden memory can hide it, so only then count. One doc
    // per reporter, so the count of verified reports is the count of distinct reporters (legacy
    // docs without the field never count). HIDE_AT - 1 earlier ones are all that matter: more
    // can only mean the memory was restored, and a larger count never equals HIDE_AT again.
    // Needs the (memoryId, reporterVerified) composite index.
    if (!reporterVerified || current.data().moderation === "hidden") return;
    const earlier = await tx.get(
      db.collection("reports").where("memoryId", "==", memoryId).where("reporterVerified", "==", true).limit(HIDE_AT),
    );
    const distinct = new Set(earlier.docs.map((d) => d.data().reporterId));
    distinct.add(uid);
    if (distinct.size === HIDE_AT) tx.update(memoryRef, { moderation: "hidden" });
  });
  return {};
}

const TARGET_TYPES = ["community", "profile"];

async function reportContent({ uid, data: { targetType, targetId, reason, note }, db, request }) {
  if (targetType === "profile" && targetId === uid) {
    throw new HttpsError("failed-precondition", "You can't report yourself.");
  }
  const targetRef = db.collection(targetType === "community" ? "communities" : "publicProfiles").doc(targetId);
  const reportRef = db.collection("reports").doc(`${targetType}_${targetId}_${uid}`);
  const reporterVerified = request?.auth?.token?.email_verified === true;
  await db.runTransaction(async (tx) => {
    const [target, existing] = await Promise.all([tx.get(targetRef), tx.get(reportRef)]);
    if (!target.exists) throw new HttpsError("failed-precondition", "This isn't available.");
    if (existing.exists) throw new HttpsError("already-exists", "You already reported this.");
    tx.create(reportRef, {
      targetType,
      targetId,
      reporterId: uid,
      reporterVerified,
      reason,
      note: note ? note : null,
      createdAt: new Date().toISOString(),
    });
  });
  return {};
}

const definitions = {
  reportMemory: {
    schema: {
      memoryId: idField,
      reason: { type: "string", enum: REASONS },
      note: { type: "string", optional: true, trim: true, max: 280 },
    },
    rateLimit: { action: "reportMemory", perDay: 20 },
    handler: reportMemory,
  },
  reportContent: {
    schema: {
      targetType: { type: "string", enum: TARGET_TYPES },
      targetId: idField,
      reason: { type: "string", enum: REASONS },
      note: { type: "string", optional: true, trim: true, max: 280 },
    },
    // Same action as reportMemory: one shared 20/day budget.
    rateLimit: { action: "reportMemory", perDay: 20 },
    handler: reportContent,
  },
};

module.exports = {
  definitions,
  REASONS,
  reportMemory: callable("reportMemory", definitions.reportMemory, reportMemory),
  reportContent: callable("reportContent", definitions.reportContent, reportContent),
};
