const admin = require("firebase-admin");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { notify } = require("./lib/notify");
const { tryConsumeRateLimit } = require("./lib/rateLimit");

// Rules cap taggedUserIds at 20; the server enforces the same cap for Admin/legacy writes.
const MAX_TAGS = 20;
// Per-author daily budget of tag notifications (one unit per notification), so a spammer cannot
// fan out unbounded inbox writes. Exhausted: skip silently (a trigger cannot throw to a caller).
const TAG_NOTIFY_PER_DAY = 100;

// Privacy: a tag notification would leak a memory the tagged user cannot open, so notify only
// for memories they can read now: live, not hidden, and `public` or `tagged` (rules grant tagged
// users read on `tagged`). private / community / timeRelease never notify.
function taggedUsersCanRead(memory) {
  return (
    memory.isDeleted !== true &&
    memory.moderation !== "hidden" &&
    (memory.privacy === "public" || memory.privacy === "tagged")
  );
}

// Notifies the first MAX_TAGS unique tagged users (author excluded; notify skips blocked pairs
// and disabled prefs). Ids without a users doc are skipped so no orphan inbox is created.
// Deterministic notification ids (memoryTagged_<memoryId>_<uid>) make a retried trigger a no-op.
async function notifyTaggedUsers(db, memoryId, memory, now = new Date()) {
  if (!memory || !taggedUsersCanRead(memory)) return;
  const tagged = Array.isArray(memory?.taggedUserIds) ? memory.taggedUserIds : [];
  const unique = [...new Set(tagged.filter((id) => typeof id === "string" && id && !id.includes("/")))];
  const author = memory.userId;
  for (const to of unique.slice(0, MAX_TAGS)) {
    if (to === author) continue;
    const user = await db.collection("users").doc(to).get();
    if (!user.exists) continue;
    if (typeof author === "string" && author) {
      if (!(await tryConsumeRateLimit(db, author, "tagNotify", TAG_NOTIFY_PER_DAY, now))) {
        logger.warn("Tag notification budget exhausted", { author, memoryId });
        return;
      }
    }
    await notify(db, {
      to,
      type: "memoryTagged",
      actorId: author,
      data: { memoryId, placeId: memory.placeId ?? null },
      id: `memoryTagged_${memoryId}_${to}`,
    });
  }
}

const onMemoryCreatedTags = onDocumentCreated("memories/{memoryId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  await notifyTaggedUsers(admin.firestore(), event.params.memoryId, data);
});

module.exports = { onMemoryCreatedTags, notifyTaggedUsers, MAX_TAGS, TAG_NOTIFY_PER_DAY };
