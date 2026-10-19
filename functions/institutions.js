// Institutions (spec "Plan 3 decisions", ADR-0007): server-only writes; clients read
// institutions/{id} = { name, allowedEmailDomains[], subZones[], communityId, createdAt, updatedAt }.
// Admins are private (spec "Plan 5 decisions"): institutions/{id}/admins/{uid} = { userId, since },
// readable only by that user. Legacy institutions may still carry adminUserIds[] until
// functions/tools/backfill.js migrateInstitutionAdmins runs, so permission checks accept both. Each institution has a system-owned community `inst-<id>` (R25):
// no user owns it; admins join it as `guardian`.
// Errors: createInstitution: permission-denied (caller lacks the `staff` claim),
// invalid-argument. claimInstitutionAdmin: failed-precondition (email not verified),
// not-found (institution), permission-denied (email domain not exactly an allowed domain).
// addInstitutionSubZone: not-found, permission-denied (caller not an admin),
// failed-precondition (sub-zone cap), invalid-argument.
const crypto = require("node:crypto");
const { HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const { callable, idField } = require("./lib/callable");
const { linkUser, newCommunity, member } = require("./communities");
const { SYSTEM_OWNER } = require("./lib/domain");

const MAX_DOMAINS = 10;
const MAX_SUB_ZONES = 100;
const DEFAULT_RADIUS_METERS = 60;
// Lowercase hostname with at least two labels; each label 1-63 chars of [a-z0-9-] without a
// leading or trailing hyphen; the TLD is not all digits.
const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOSTNAME = new RegExp(`^(?=.{1,253}$)(?:${LABEL}\\.)+(?=[a-z0-9-]*[a-z])${LABEL}$`);

const institutionRef = (db, id) => db.collection("institutions").doc(id);
const communityRef = (db, id) => db.collection("communities").doc(id);
const adminRef = (db, institutionId, uid) => institutionRef(db, institutionId).collection("admins").doc(uid);

function normalizeDomains(domains) {
  const out = [];
  for (const raw of domains) {
    const domain = raw.trim().toLowerCase();
    if (!HOSTNAME.test(domain)) {
      throw new HttpsError("invalid-argument", "Invalid allowedEmailDomains: bad format.");
    }
    if (!out.includes(domain)) out.push(domain);
  }
  return out;
}

async function createInstitution({ data: { name, allowedEmailDomains }, db, request }) {
  if (request.auth.token?.staff !== true) {
    throw new HttpsError("permission-denied", "Only staff can register institutions.");
  }
  const domains = normalizeDomains(allowedEmailDomains);
  const ref = db.collection("institutions").doc();
  const communityId = `inst-${ref.id}`;
  const at = new Date().toISOString();
  const batch = db.batch();
  batch.create(ref, {
    name,
    allowedEmailDomains: domains,
    subZones: [],
    communityId,
    createdAt: at,
    updatedAt: at,
  });
  batch.create(
    communityRef(db, communityId),
    newCommunity({
      name,
      description: `Memories shared at ${name}.`,
      type: "institution",
      ownerId: SYSTEM_OWNER,
      institutionId: ref.id,
      memberCount: 0,
      at,
    }),
  );
  await batch.commit();
  return { id: ref.id };
}

// The part after the last "@", lowercased; null when there is no usable email.
function emailDomain(email) {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).trim().toLowerCase() : null;
}

async function claimInstitutionAdmin({ uid, data: { institutionId }, db, request }) {
  const token = request.auth.token || {};
  if (token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verify your email address first.");
  }
  const domain = emailDomain(token.email);
  return db.runTransaction(async (tx) => {
    const institution = await tx.get(institutionRef(db, institutionId));
    if (!institution.exists) throw new HttpsError("not-found", "Institution not found.");
    const data = institution.data();
    const allowed = Array.isArray(data.allowedEmailDomains) ? data.allowedEmailDomains : [];
    // Exact match only: a subdomain of an allowed domain is not allowed.
    if (!domain || !allowed.some((d) => typeof d === "string" && d.toLowerCase() === domain)) {
      throw new HttpsError("permission-denied", "Your email domain isn't approved for this institution.");
    }
    const communityId = data.communityId || `inst-${institutionId}`;
    const [community, existing, user] = await Promise.all([
      tx.get(communityRef(db, communityId)),
      tx.get(communityRef(db, communityId).collection("members").doc(uid)),
      tx.get(db.collection("users").doc(uid)),
    ]);
    const at = new Date().toISOString();
    tx.set(adminRef(db, institutionId, uid), { userId: uid, since: at });
    tx.update(institution.ref, { updatedAt: at });
    if (community.exists) {
      if (!existing.exists) {
        tx.set(existing.ref, member(uid, "guardian", at));
        tx.update(community.ref, { memberCount: FieldValue.increment(1) });
      } else if (existing.data().role !== "guardian") {
        tx.update(existing.ref, { role: "guardian" });
      }
      linkUser(tx, user, communityId, true);
    }
    return { name: data.name };
  });
}

async function addInstitutionSubZone({ uid, data, db }) {
  const { institutionId, name, latitude, longitude } = data;
  const zone = {
    id: crypto.randomUUID(),
    name,
    latitude,
    longitude,
    radiusMeters: data.radiusMeters ?? DEFAULT_RADIUS_METERS,
  };
  await db.runTransaction(async (tx) => {
    const institution = await tx.get(institutionRef(db, institutionId));
    if (!institution.exists) throw new HttpsError("not-found", "Institution not found.");
    const { adminUserIds, subZones } = institution.data();
    const adminDoc = await tx.get(adminRef(db, institutionId, uid));
    const legacyAdmin = Array.isArray(adminUserIds) && adminUserIds.includes(uid);
    if (!adminDoc.exists && !legacyAdmin) {
      throw new HttpsError("permission-denied", "Only institution admins can add sub-zones.");
    }
    if (Array.isArray(subZones) && subZones.length >= MAX_SUB_ZONES) {
      throw new HttpsError("failed-precondition", "This institution has too many sub-zones.");
    }
    tx.update(institution.ref, { subZones: FieldValue.arrayUnion(zone), updatedAt: new Date().toISOString() });
  });
  return { id: zone.id };
}

const definitions = {
  createInstitution: {
    schema: {
      name: { type: "string", trim: true, min: 1, max: 100 },
      allowedEmailDomains: { type: "array", min: 1, max: MAX_DOMAINS, items: "string" },
    },
    handler: createInstitution,
  },
  claimInstitutionAdmin: { schema: { institutionId: idField }, handler: claimInstitutionAdmin },
  addInstitutionSubZone: {
    schema: {
      institutionId: idField,
      name: { type: "string", trim: true, min: 1, max: 60 },
      latitude: { type: "number", min: -90, max: 90 },
      longitude: { type: "number", min: -180, max: 180 },
      radiusMeters: { type: "number", optional: true, min: 10, max: 5000 },
    },
    handler: addInstitutionSubZone,
  },
};

module.exports = {
  definitions,
  createInstitution: callable("createInstitution", definitions.createInstitution, createInstitution),
  claimInstitutionAdmin: callable("claimInstitutionAdmin", definitions.claimInstitutionAdmin, claimInstitutionAdmin),
  addInstitutionSubZone: callable("addInstitutionSubZone", definitions.addInstitutionSubZone, addInstitutionSubZone),
};
