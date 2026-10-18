const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { incrementRateLimit } = require("./rateLimit");

// Firestore ids: no slashes, not "." / "..", at most 1500 bytes; we keep them short.
const ID_PATTERN = /^(?!\.\.?$)[^/]{1,128}$/;
const idField = { type: "string", min: 1, max: 128, pattern: ID_PATTERN };

// Schema: { field: { type: "string"|"number"|"boolean"|"array"|"object", optional, min, max,
// enum, trim, pattern, items } }. For strings min/max are code-point lengths; for numbers,
// values; for arrays, lengths. Unknown fields are rejected.
function validate(schema, data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Request data must be an object.");
  }
  const bad = (field, why) => new HttpsError("invalid-argument", `Invalid ${field}: ${why}.`);
  for (const key of Object.keys(data)) {
    if (!(key in schema)) throw bad(key, "unknown field");
  }
  const out = {};
  for (const [field, rule] of Object.entries(schema)) {
    let v = data[field];
    if (v === undefined || v === null) {
      if (rule.optional) continue;
      throw bad(field, "required");
    }
    checkType(field, rule.type, v, bad);
    if (rule.type === "string") {
      if (rule.trim) v = v.trim();
      const len = [...v].length;
      if (rule.min !== undefined && len < rule.min) throw bad(field, "too short");
      if (rule.max !== undefined && len > rule.max) throw bad(field, "too long");
      if (rule.pattern && !rule.pattern.test(v)) throw bad(field, "bad format");
    } else if (rule.type === "number") {
      if (!Number.isFinite(v)) throw bad(field, "not finite");
      if (rule.min !== undefined && v < rule.min) throw bad(field, "too small");
      if (rule.max !== undefined && v > rule.max) throw bad(field, "too large");
    } else if (rule.type === "array") {
      if (rule.min !== undefined && v.length < rule.min) throw bad(field, "too few items");
      if (rule.max !== undefined && v.length > rule.max) throw bad(field, "too many items");
      if (rule.items) v.forEach((item) => checkType(field, rule.items, item, bad));
    }
    if (rule.enum && !rule.enum.includes(v)) throw bad(field, "not allowed");
    out[field] = v;
  }
  return out;
}

function checkType(field, type, v, bad) {
  const ok =
    type === "array"
      ? Array.isArray(v)
      : type === "object"
        ? typeof v === "object" && !Array.isArray(v)
        : typeof v === type;
  if (!ok) throw bad(field, `expected ${type}`);
}

// The testable core: returns the (request) => result function onCall wraps.
function buildHandler({ name, schema, rateLimit }, handler, getDb) {
  return async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
    try {
      const data = validate(schema || {}, request.data ?? {});
      const db = getDb();
      if (rateLimit) {
        const amount = rateLimit.cost ? rateLimit.cost(data) : 1;
        await incrementRateLimit(db, uid, rateLimit.action, rateLimit.perDay, new Date(), amount);
      }
      return await handler({ uid, data, db, request });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error(`callable ${name} failed`, err);
      throw new HttpsError("internal", "Something went wrong.");
    }
  };
}

// callable(name, { schema, rateLimit?: { action, perDay, cost?: (data) => units } },
//   async ({ uid, data, db, request }) => result)
function callable(name, options, handler) {
  // Lazy so unit tests can load this module without initializing the admin app.
  const getDb = () => require("firebase-admin").firestore();
  return onCall(buildHandler({ name, ...options }, handler, getDb));
}

module.exports = { callable, buildHandler, validate, ID_PATTERN, idField };
