const { ID_PATTERN } = require("./callable");

// Server-side mirror of firestore.rules `isVisibleMemory` (the rules are the source of truth):
// not deleted, not hidden by moderation, and one of: public; the viewer is the author; tagged and
// the viewer is in taggedUserIds; timeRelease and released (releaseDate <= now); community and
// the viewer is a member. Also agrees with the client's isMemoryVisibleTo on
// fixtures/domain/visibility.json (which has no moderation field).

function toMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "string") return Date.parse(value);
  return NaN;
}

// viewer: { viewerId, viewerIsCommunityMember, now: Date }
function isVisibleMemory(memory, { viewerId, viewerIsCommunityMember, now }) {
  if (!memory || memory.isDeleted !== false) return false;
  if (memory.moderation === "hidden") return false;
  if (memory.privacy === "public") return true;
  if (typeof viewerId === "string" && memory.userId === viewerId) return true;
  switch (memory.privacy) {
    case "tagged":
      return Array.isArray(memory.taggedUserIds) && memory.taggedUserIds.includes(viewerId);
    case "timeRelease": {
      const release = toMillis(memory.releaseDate);
      return Number.isFinite(release) && release <= now.getTime();
    }
    case "community":
      return viewerIsCommunityMember === true;
    default:
      return false;
  }
}

// Resolves community membership (communities/{communityId}/members/{viewerId}, as the rules'
// isCommunityMember does) only when it matters.
async function canViewMemory(db, memory, viewerId, now = new Date()) {
  let viewerIsCommunityMember = false;
  if (memory?.privacy === "community" && typeof memory.communityId === "string" && ID_PATTERN.test(memory.communityId)) {
    const member = await db.collection("communities").doc(memory.communityId).collection("members").doc(viewerId).get();
    viewerIsCommunityMember = member.exists;
  }
  return isVisibleMemory(memory, { viewerId, viewerIsCommunityMember, now });
}

// What the rules' read lets the viewer see: the author always (even hidden or deleted), otherwise
// isVisibleMemory. Pinned to fixtures/domain/visibility.json by test/visibility.test.js.
function canReadMemory(memory, viewer) {
  if (memory && typeof viewer.viewerId === "string" && memory.userId === viewer.viewerId) return true;
  return isVisibleMemory(memory, viewer);
}

module.exports = { isVisibleMemory, canViewMemory, canReadMemory };
