const { Timestamp } = require("firebase-admin/firestore");
const { isBlocked } = require("./blocks");

const NOTIFICATION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

// gRPC status Firestore uses when create() targets an existing document.
const ALREADY_EXISTS = 6;

// Single source of notification copy (spec "Plan 3 decisions"). `pref` is the key in
// users/{uid}.notificationPrefs; a missing pref means enabled.
const TEMPLATES = {
  memoryTagged: {
    pref: "tags",
    title: "Tagged in a memory",
    body: ({ name }) => `${name} tagged you in a memory.`,
  },
  transferRequest: {
    pref: "transfers",
    title: "Custodianship request",
    body: ({ name, place }) => `${name} wants you to become a custodian of ${place}.`,
  },
  transferAccepted: {
    pref: "transfers",
    title: "Custodianship accepted",
    body: ({ name, place }) => `${name} accepted custodianship of ${place}.`,
  },
  transferRejected: {
    pref: "transfers",
    title: "Custodianship declined",
    body: ({ name, place }) => `${name} declined custodianship of ${place}.`,
  },
  communityInvite: {
    pref: "communityInvites",
    title: "Community invitation",
    body: ({ name, community }) => `${name} invited you to join ${community}.`,
  },
};

async function displayNameOf(db, uid) {
  if (!uid) return "Someone";
  const snap = await db.doc(`publicProfiles/${uid}`).get();
  const name = snap.exists ? snap.data().displayName : undefined;
  return typeof name === "string" && name.trim() ? name : "Someone";
}

// Dry run of notify's skip checks: the reason a notification would not be sent, or null.
async function skipReason(db, { to, type, actorId }) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown notification type: ${type}`);
  if (to === actorId) return "self";
  if (actorId && (await isBlocked(db, to, actorId))) return "blocked";
  const user = await db.doc(`users/${to}`).get();
  const prefs = (user.exists && user.data().notificationPrefs) || {};
  if (prefs[template.pref] === false) return "pref";
  return null;
}

// notify(db, { to, type, actorId, params: { place?, community? }, data?, id? })
// -> { sent: true, id } or { sent: false, reason: "self" | "blocked" | "pref" | "duplicate" }
// With a deterministic `id` the write is a create(), so a retried trigger never duplicates.
async function notify(db, { to, type, actorId, params = {}, data = {}, id }) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown notification type: ${type}`);
  if (to === actorId) return { sent: false, reason: "self" };
  if (actorId && (await isBlocked(db, to, actorId))) return { sent: false, reason: "blocked" };

  const user = await db.doc(`users/${to}`).get();
  const prefs = (user.exists && user.data().notificationPrefs) || {};
  if (prefs[template.pref] === false) return { sent: false, reason: "pref" };

  const name = await displayNameOf(db, actorId);
  const notifications = db.collection(`users/${to}/notifications`);
  const ref = id ? notifications.doc(id) : notifications.doc();
  const createdAt = new Date();
  const doc = {
    type,
    // Who caused it (null for system notifications): account deletion removes these.
    actorId: actorId ?? null,
    title: template.title,
    body: template.body({ ...params, name }),
    data,
    createdAt: createdAt.toISOString(),
    readAt: null,
    // TTL-ready: enable a Firestore TTL policy on collection group `notifications`, field `expireAt`.
    expireAt: Timestamp.fromDate(new Date(createdAt.getTime() + NOTIFICATION_TTL_MS)),
  };
  if (!id) {
    await ref.set(doc);
    return { sent: true, id: ref.id };
  }
  try {
    await ref.create(doc);
  } catch (error) {
    if (error?.code === ALREADY_EXISTS) return { sent: false, reason: "duplicate" };
    throw error;
  }
  return { sent: true, id: ref.id };
}

module.exports = { notify, skipReason, TEMPLATES };
