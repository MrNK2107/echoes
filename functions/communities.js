// ADR-0007: community membership changes only through these callables (Admin SDK); clients
// have read-only rules on communities and members. Member docs are { userId, role, joinedAt }
// (userId backs the collection-group query used on account deletion). Invariant:
// communities/{id}.memberCount == number of members/* docs.
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { callable, ID_PATTERN, idField } = require("./lib/callable");
const { notify } = require("./lib/notify");

const MAX_INVITES = 20;

const communityRef = (db, id) => db.collection("communities").doc(id);
const memberRef = (db, id, uid) => communityRef(db, id).collection("members").doc(uid);
const userRef = (db, uid) => db.collection("users").doc(uid);

// Joining adds the id to users/{uid}.communityIds and clears it from leftCommunityIds; leaving
// does the reverse. leftCommunityIds (server-written; not in the rules' owner allowlist) makes
// leaving sticky: onMemoryWritten's year auto-join skips those ids (R26). Runs inside a
// transaction after every tx.get, and never recreates a missing users doc as a fragment.
function linkUser(tx, userSnap, communityId, joined) {
  if (!userSnap.exists) return;
  const add = FieldValue.arrayUnion(communityId);
  const remove = FieldValue.arrayRemove(communityId);
  tx.update(userSnap.ref, {
    communityIds: joined ? add : remove,
    leftCommunityIds: joined ? remove : add,
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
    // R27: counts invitees (unique ids), not calls.
    rateLimit: { action: "inviteToCommunity", perDay: 200, cost: (data) => new Set(data.userIds).size },
    handler: inviteToCommunity,
  },
};

// Account deletion (R24, R25). No transactions: this runs in an async auth trigger, and an open
// transaction makes the Firestore emulator's reset fail between contract tests. Every step is a
// batch whose delete requires the member doc to exist, so a retried run or a concurrent leave
// never decrements twice.
// - Memberships in other people's communities: delete + decrement memberCount.
// - Owned communities: ownership passes to the earliest-joined remaining member (community
//   ownerId, their member role), and the old owner's membership is removed. Only a community
//   with no other member is deleted. Auto communities are owned by "system" (R25), so they are
//   never owned by a user here. Applies to every type a user can own (thematic today).
async function cleanupUserCommunities(db, uid) {
  const owned = await db.collection("communities").where("ownerId", "==", uid).get();
  const ownedIds = new Set(owned.docs.map((d) => d.id));

  const memberships = await db.collectionGroup("members").where("userId", "==", uid).get();
  for (const doc of memberships.docs) {
    const community = doc.ref.parent.parent;
    if (ownedIds.has(community.id)) continue;
    await removeMembership(db, doc.ref, community, {});
  }

  for (const c of owned.docs) {
    const members = await c.ref.collection("members").orderBy("joinedAt", "asc").get();
    const heir = members.docs.find((m) => m.id !== uid && m.data().userId !== uid);
    if (!heir) {
      await db.recursiveDelete(c.ref);
      continue;
    }
    const at = new Date().toISOString();
    await removeMembership(db, c.ref.collection("members").doc(uid), c.ref, {
      ownerId: heir.id,
      updatedAt: at,
      extra: (batch) => batch.update(heir.ref, { role: "owner" }),
    });
  }
}

// One atomic batch: delete the member doc (must exist) and decrement the count, plus optional
// community fields / extra writes. If the member doc is already gone, apply only the extras.
async function removeMembership(db, member, community, { extra, ...fields }) {
  const batch = db.batch();
  batch.delete(member, { exists: true });
  batch.update(community, { ...fields, memberCount: FieldValue.increment(-1) });
  if (extra) extra(batch);
  try {
    await batch.commit();
    return;
  } catch (error) {
    if (error?.code !== 5) throw error; // NOT_FOUND
  }
  // The membership or the community is already gone.
  await member.delete();
  if (Object.keys(fields).length || extra) {
    const rest = db.batch();
    if (Object.keys(fields).length) rest.update(community, fields);
    if (extra) extra(rest);
    try {
      await rest.commit();
    } catch (error) {
      if (error?.code !== 5) throw error;
    }
  }
}

module.exports = {
  definitions,
  cleanupUserCommunities,
  linkUser,
  newCommunity,
  member,
  createCommunity: callable("createCommunity", definitions.createCommunity, createCommunity),
  joinCommunity: callable("joinCommunity", definitions.joinCommunity, joinCommunity),
  leaveCommunity: callable("leaveCommunity", definitions.leaveCommunity, leaveCommunity),
  inviteToCommunity: callable("inviteToCommunity", definitions.inviteToCommunity, inviteToCommunity),
};
