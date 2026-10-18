// ADR-0007: community membership changes only through these callables (Admin SDK); clients
// have read-only rules on communities and members. Member docs are { userId, role, joinedAt }
// (userId backs the collection-group query used on account deletion). Invariant:
// communities/{id}.memberCount == number of members/* docs.
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { callable } = require("./lib/callable");
const { notify } = require("./lib/notify");

// Firestore ids: no slashes, not "." / "..", at most 1500 bytes; we keep them short.
const ID_PATTERN = /^(?!\.\.?$)[^/]{1,128}$/;
const idField = { type: "string", min: 1, max: 128, pattern: ID_PATTERN };
const MAX_INVITES = 20;

const communityRef = (db, id) => db.collection("communities").doc(id);
const memberRef = (db, id, uid) => communityRef(db, id).collection("members").doc(uid);
const userRef = (db, uid) => db.collection("users").doc(uid);

// Adds/removes a community id on users/{uid}.communityIds inside a transaction, but never
// recreates a missing users doc as a fragment. Call only after every tx.get.
function linkUser(tx, userSnap, communityId, add) {
  if (!userSnap.exists) return;
  tx.update(userSnap.ref, {
    communityIds: add ? FieldValue.arrayUnion(communityId) : FieldValue.arrayRemove(communityId),
  });
}

function newCommunity({ name, description, type, ownerId, placeId = null, institutionId = null, memberCount, at }) {
  return { name, description, type, ownerId, placeId, institutionId, memberCount, createdAt: at, updatedAt: at };
}

const member = (userId, role, at) => ({ userId, role, joinedAt: at });

async function createCommunity({ uid, data, db }) {
  const ref = db.collection("communities").doc();
  const at = new Date().toISOString();
  await db.runTransaction(async (tx) => {
    const user = await tx.get(userRef(db, uid));
    tx.set(ref, newCommunity({ ...data, type: "thematic", ownerId: uid, memberCount: 1, at }));
    tx.set(memberRef(db, ref.id, uid), member(uid, "owner", at));
    linkUser(tx, user, ref.id, true);
  });
  return { id: ref.id };
}

async function joinCommunity({ uid, data: { communityId }, db }) {
  await db.runTransaction(async (tx) => {
    const [community, existing, user] = await Promise.all([
      tx.get(communityRef(db, communityId)),
      tx.get(memberRef(db, communityId, uid)),
      tx.get(userRef(db, uid)),
    ]);
    if (!community.exists) throw new HttpsError("not-found", "Community not found.");
    if (!existing.exists) {
      // An auto community's owner (e.g. an era community's first author) joins as owner.
      const role = community.data().ownerId === uid ? "owner" : "member";
      tx.set(memberRef(db, communityId, uid), member(uid, role, new Date().toISOString()));
      tx.update(community.ref, { memberCount: FieldValue.increment(1) });
    }
    linkUser(tx, user, communityId, true);
  });
  return {};
}

async function leaveCommunity({ uid, data: { communityId }, db }) {
  await db.runTransaction(async (tx) => {
    const [community, existing, user] = await Promise.all([
      tx.get(communityRef(db, communityId)),
      tx.get(memberRef(db, communityId, uid)),
      tx.get(userRef(db, uid)),
    ]);
    const isOwner =
      (community.exists && community.data().ownerId === uid) ||
      (existing.exists && existing.data().role === "owner");
    if (isOwner) throw new HttpsError("failed-precondition", "Owners can't leave their community.");
    if (existing.exists) {
      tx.delete(existing.ref);
      if (community.exists) tx.update(community.ref, { memberCount: FieldValue.increment(-1) });
    }
    linkUser(tx, user, communityId, false);
  });
  return {};
}

async function inviteToCommunity({ uid, data: { communityId, userIds }, db }) {
  if (userIds.some((id) => !ID_PATTERN.test(id))) {
    throw new HttpsError("invalid-argument", "Invalid userIds: bad format.");
  }
  const [community, self] = await Promise.all([
    communityRef(db, communityId).get(),
    memberRef(db, communityId, uid).get(),
  ]);
  if (!community.exists) throw new HttpsError("not-found", "Community not found.");
  if (!self.exists) throw new HttpsError("permission-denied", "Only members can invite.");

  const name = community.data().name;
  for (const to of new Set(userIds)) {
    if (to === uid) continue;
    const [user, already] = await Promise.all([
      userRef(db, to).get(),
      memberRef(db, communityId, to).get(),
    ]);
    if (!user.exists || already.exists) continue;
    // notify skips blocked pairs (either direction) and disabled prefs silently, so the
    // response never reveals who blocked whom.
    await notify(db, {
      to,
      type: "communityInvite",
      actorId: uid,
      params: { community: name },
      data: { communityId },
    });
  }
  return {};
}

const definitions = {
  createCommunity: {
    schema: {
      name: { type: "string", trim: true, min: 1, max: 60 },
      description: { type: "string", trim: true, min: 1, max: 500 },
    },
    rateLimit: { action: "createCommunity", perDay: 10 },
    handler: createCommunity,
  },
  joinCommunity: { schema: { communityId: idField }, handler: joinCommunity },
  leaveCommunity: { schema: { communityId: idField }, handler: leaveCommunity },
  inviteToCommunity: {
    schema: {
      communityId: idField,
      userIds: { type: "array", min: 1, max: MAX_INVITES, items: "string" },
    },
    rateLimit: { action: "inviteToCommunity", perDay: 50 },
    handler: inviteToCommunity,
  },
};

// Account deletion (R24). Memberships in other people's communities are removed and their
// counts decremented. No transactions: this runs in an async auth trigger, and an open
// transaction makes the Firestore emulator's reset fail between contract tests. Each membership
// goes in its own atomic batch whose delete requires the doc to exist, so a retried run or a
// concurrent leave never decrements twice. Communities the
// user owns are deleted with their members; each remaining member's users/{x}.communityIds is
// unlinked first so the privacy picker never offers a deleted community. Memories already shared
// with a deleted community keep their communityId and become visible to nobody but the author.
async function cleanupUserCommunities(db, uid) {
  const owned = await db.collection("communities").where("ownerId", "==", uid).get();
  const ownedIds = new Set(owned.docs.map((d) => d.id));

  const memberships = await db.collectionGroup("members").where("userId", "==", uid).get();
  for (const doc of memberships.docs) {
    const community = doc.ref.parent.parent;
    if (ownedIds.has(community.id)) continue;
    const batch = db.batch();
    batch.delete(doc.ref, { exists: true });
    batch.update(community, { memberCount: FieldValue.increment(-1) });
    try {
      await batch.commit();
    } catch (error) {
      // NOT_FOUND: the membership (or an orphaned member's community) is already gone.
      if (error?.code !== 5) throw error;
      await doc.ref.delete();
    }
  }

  for (const c of owned.docs) {
    const members = await c.ref.collection("members").get();
    await Promise.all(
      members.docs
        .map((m) => m.id)
        .filter((memberId) => memberId !== uid)
        .map((memberId) =>
          userRef(db, memberId)
            .update({ communityIds: FieldValue.arrayRemove(c.id) })
            .catch((error) => {
              // A member whose users doc is already gone has nothing to unlink.
              if (error?.code !== 5) logger.warn("Failed to unlink community", { memberId, error });
            }),
        ),
    );
    await db.recursiveDelete(c.ref);
  }
}

module.exports = {
  definitions,
  cleanupUserCommunities,
  createCommunity: callable("createCommunity", definitions.createCommunity, createCommunity),
  joinCommunity: callable("joinCommunity", definitions.joinCommunity, joinCommunity),
  leaveCommunity: callable("leaveCommunity", definitions.leaveCommunity, leaveCommunity),
  inviteToCommunity: callable("inviteToCommunity", definitions.inviteToCommunity, inviteToCommunity),
};
