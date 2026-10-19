// Spec "Plan 5 decisions": member counts of the huge auto communities (time-*, era-*) must not
// hot-spot one document. Joins and leaves write to one of SHARDS counter shards
// (communities/{id}/counterShards/{0..9}: { count, updatedAt }), which here are only CHANGE
// MARKERS. The scheduled rollup finds communities whose shards changed recently and sets their
// memberCount to the count() aggregate of the members subcollection. The members docs stay the
// source of truth, so the rollup is idempotent, never collapses a pre-existing count, and never
// loses a decrement. Other communities keep their direct, exact increments.
const { FieldValue } = require("firebase-admin/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions");

const SHARDS = 10;
const SHARDED_ID = /^(time|era)-/;
// A missed or failed run is covered by the next ones: the rollup is idempotent, so the look-back
// only costs a few extra shard reads.
const LOOKBACK_MS = 60 * 60 * 1000;
const PAGE_SIZE = 500;
// Scheduled function timeout and the point after which no new page starts.
const TIMEOUT_SECONDS = 540;
const ROLLUP_BUDGET_MS = 480 * 1000;
const NOT_FOUND = 5;

const isShardedCommunity = (id) => typeof id === "string" && SHARDED_ID.test(id);

// `writer` is a Transaction or WriteBatch (both have set/update).
function incrementMemberCount(writer, communityRef, delta, rand = Math.random, now = new Date()) {
  if (!isShardedCommunity(communityRef.id)) {
    writer.update(communityRef, { memberCount: FieldValue.increment(delta) });
    return;
  }
  const shard = communityRef.collection("counterShards").doc(String(Math.floor(rand() * SHARDS)));
  writer.set(shard, { count: FieldValue.increment(delta), updatedAt: now }, { merge: true });
}

// Recounts every community with a shard written in the look-back window. Returns how many
// distinct communities it recounted.
async function rollupHandler(
  db,
  now,
  { pageSize = PAGE_SIZE, budgetMs = ROLLUP_BUDGET_MS, clock = Date.now } = {},
) {
  const since = new Date(now.getTime() - LOOKBACK_MS);
  const startedAt = clock();
  const seen = new Set();
  let cursor;
  for (;;) {
    let q = db
      .collectionGroup("counterShards")
      .where("updatedAt", ">=", since)
      .orderBy("updatedAt", "asc")
      .limit(pageSize);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    const ids = [];
    for (const shard of page.docs) {
      const community = shard.ref.parent.parent;
      if (!community || !isShardedCommunity(community.id) || seen.has(community.id)) continue;
      seen.add(community.id);
      ids.push(community);
    }
    for (const community of ids) {
      const { count } = (await community.collection("members").count().get()).data();
      try {
        await community.update({ memberCount: count });
      } catch (error) {
        if (error?.code !== NOT_FOUND) throw error; // deleted meanwhile
      }
    }
    if (page.docs.length < pageSize) break;
    cursor = page.docs[page.docs.length - 1];
    if (clock() - startedAt >= budgetMs) {
      logger.warn("Member count rollup budget spent; the next run continues", { recounted: seen.size });
      break;
    }
  }
  return { communities: seen.size };
}

const rollupMemberCounts = onSchedule(
  { schedule: "every 10 minutes", timeoutSeconds: TIMEOUT_SECONDS },
  async () => {
    const result = await rollupHandler(admin.firestore(), new Date());
    logger.info("Rolled up member counts", result);
  },
);

module.exports = {
  isShardedCommunity,
  SHARDS,
  LOOKBACK_MS,
  incrementMemberCount,
  rollupHandler,
  rollupMemberCounts,
};
