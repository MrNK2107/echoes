// ADR-0008 reporting and auto-hide. reports/{memoryId}_{reporterId} =
// { memoryId, reporterId, reason, note, createdAt } (server-only; rules deny clients). The
// deterministic id makes one report per (memory, reporter); the third distinct reporter sets
// memories/{id}.moderation = 'hidden' (exactly once: later reports never re-hide a memory staff
// restored by clearing the field).
// Errors: invalid-argument, failed-precondition (own memory, or missing / not visible to the
// caller — the same answer, so existence of private memories is not revealed), already-exists
// (already reported), resource-exhausted (20/day).
const { HttpsError } = require("firebase-functions/v2/https");
const { callable, idField } = require("./lib/callable");
const { canViewMemory } = require("./lib/visibility");

const HIDE_AT = 3;
const REASONS = ["spam", "harassment", "hate", "sexual", "violence", "other"];

async function reportMemory({ uid, data: { memoryId, reason, note }, db }) {
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
    const [existing, current, reports] = await Promise.all([
      tx.get(reportRef),
      tx.get(memoryRef),
      tx.get(db.collection("reports").where("memoryId", "==", memoryId)),
    ]);
    if (existing.exists) throw new HttpsError("already-exists", "You already reported this memory.");
    if (!current.exists) throw new HttpsError("failed-precondition", "This memory isn't available.");
    tx.create(reportRef, {
      memoryId,
      reporterId: uid,
      reason,
      note: note ? note : null,
      createdAt: now.toISOString(),
    });
    // One doc per reporter, so the count of reports is the count of distinct reporters.
    const distinct = new Set(reports.docs.map((d) => d.data().reporterId));
    distinct.add(uid);
    if (distinct.size === HIDE_AT && current.data().moderation !== "hidden") {
      tx.update(memoryRef, { moderation: "hidden" });
    }
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
};

module.exports = {
  definitions,
  REASONS,
  reportMemory: callable("reportMemory", definitions.reportMemory, reportMemory),
};
