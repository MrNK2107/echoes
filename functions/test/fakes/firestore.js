// In-memory Firestore stand-in for unit tests: doc get/set/update/delete, collection and
// collection-group queries (where/orderBy/limit/startAfter, Timestamp-aware ordering), ref.parent, recursiveDelete, transactions,
// batches (atomic) and the FieldValue transforms. Docs live in one Map keyed by full path
// ("users/u1/blocks/u2").
const { Timestamp } = require("firebase-admin/firestore");

// Deep copy that keeps Timestamps real (structuredClone would strip the class), as the Admin SDK
// returns them. Other class instances (FieldValue transforms, Dates) go through structuredClone.
function clone(v) {
  if (v === undefined) return v;
  if (v instanceof Timestamp) return new Timestamp(v.seconds, v.nanoseconds);
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)]));
  }
  return structuredClone(v);
}
// Marks a field removed by FieldValue.delete(); never stored.
const DELETE = Symbol("delete");
const name = (v) => v?.constructor?.name;

// Timestamps (live or structuredClone'd to {_seconds,_nanoseconds}) and Dates compare by their
// instant, like Firestore; every other value compares as itself.
function sortable(v) {
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object") {
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v._seconds === "number") return v._seconds * 1000 + (v._nanoseconds ?? 0) / 1e6;
  }
  return v;
}
// Firestore range filters match only values of the same type (a number never satisfies a string
// bound); Dates and Timestamps are one type.
const kind = (v) => (v instanceof Date || (v && typeof v === "object" && (typeof v.toMillis === "function" || typeof v._seconds === "number")) ? "time" : typeof v);
const sameKind = (a, b) => a !== undefined && a !== null && kind(a) === kind(b);
const compare = (a, b) => {
  const x = sortable(a);
  const y = sortable(b);
  return x < y ? -1 : x > y ? 1 : 0;
};

function applyTransform(current, value, now) {
  switch (name(value)) {
    case "NumericIncrementTransform":
      return (typeof current === "number" ? current : 0) + value.operand;
    case "ArrayUnionTransform": {
      const arr = Array.isArray(current) ? [...current] : [];
      for (const e of value.elements) if (!arr.some((x) => eq(x, e))) arr.push(e);
      return arr;
    }
    case "ArrayRemoveTransform":
      return (Array.isArray(current) ? current : []).filter(
        (x) => !value.elements.some((e) => eq(x, e)),
      );
    case "ServerTimestampTransform":
      return now();
    default:
      return value;
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (typeof o[k] !== "object" || o[k] === null) o[k] = {};
    o = o[k];
  }
  const last = keys[keys.length - 1];
  if (value === DELETE) delete o[last];
  else o[last] = value;
}

function createFakeFirestore(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, clone(v)]));
  let autoId = 0;
  // Per-doc write counter, exposed as snapshot.updateTime for lastUpdateTime preconditions.
  const versions = new Map();
  let tick = 0;
  const bump = (path) => versions.set(path, ++tick);
  const now = () => new Date().toISOString();

  const resolve = (data, existing = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
      out[k] = resolveValue(existing[k], v);
      if (out[k] === DELETE) throw new Error(`FieldValue.delete() can only be used with update() or set({ merge: true }): ${k}`);
    }
    return out;
  };
  const resolveValue = (current, v) => {
    if (v === undefined) throw new Error('Cannot use "undefined" as a Firestore value');
    if (v && typeof v === "object" && name(v)?.endsWith("Transform")) {
      return name(v) === "DeleteTransform" ? DELETE : applyTransform(current, v, now);
    }
    return clone(v);
  };

  const snap = (path) => {
    const data = store.get(path);
    const id = path.split("/").pop();
    return {
      id,
      exists: data !== undefined,
      updateTime: data !== undefined ? Timestamp.fromMillis(versions.get(path) ?? 0) : undefined,
      ref: docRef(path),
      data: () => clone(data),
      get: (field) => getPath(data, field),
    };
  };

  const write = {
    set(path, data, options) {
      if (options?.merge) {
        const base = clone(store.get(path)) ?? {};
        for (const [k, v] of Object.entries(data)) {
          const r = resolveValue(base[k], v);
          if (r === DELETE) delete base[k];
          else base[k] = r;
        }
        store.set(path, base);
      } else {
        store.set(path, resolve(data));
      }
      bump(path);
    },
    update(path, data, precondition) {
      const base = clone(store.get(path));
      if (base === undefined) {
        const e = new Error(`NOT_FOUND: ${path}`);
        e.code = 5;
        throw e;
      }
      if (precondition?.lastUpdateTime && precondition.lastUpdateTime.toMillis() !== (versions.get(path) ?? 0)) {
        const e = new Error(`FAILED_PRECONDITION: ${path} changed since it was read`);
        e.code = 9;
        throw e;
      }
      for (const [k, v] of Object.entries(data)) setPath(base, k, resolveValue(getPath(base, k), v));
      store.set(path, base);
      bump(path);
    },
    create(path, data) {
      if (store.has(path)) {
        const e = new Error(`ALREADY_EXISTS: ${path}`);
        e.code = 6;
        throw e;
      }
      store.set(path, resolve(data));
      bump(path);
    },
    delete(path, precondition) {
      if (precondition?.exists === true && !store.has(path)) {
        const e = new Error(`NOT_FOUND: ${path}`);
        e.code = 5;
        throw e;
      }
      store.delete(path);
      versions.delete(path);
    },
  };

  const parentPath = (path) => path.split("/").slice(0, -1).join("/");
  const docRef = (path) => ({
    path,
    id: path.split("/").pop(),
    get parent() {
      return collectionRef(parentPath(path));
    },
    get: async () => snap(path),
    set: async (d, o) => write.set(path, d, o),
    update: async (d, pre) => write.update(path, d, pre),
    create: async (d) => write.create(path, d),
    delete: async (pre) => write.delete(path, pre),
    collection: (sub) => collectionRef(`${path}/${sub}`),
  });

  const matches = (data, { field, op, value }) => {
    const x = getPath(data, field);
    switch (op) {
      case "==": return eq(sortable(x), sortable(value));
      case "!=": return !eq(sortable(x), sortable(value));
      case "<": return sameKind(x, value) && compare(x, value) < 0;
      case "<=": return sameKind(x, value) && compare(x, value) <= 0;
      case ">": return sameKind(x, value) && compare(x, value) > 0;
      case ">=": return sameKind(x, value) && compare(x, value) >= 0;
      case "in": return value.some((v) => eq(v, x));
      case "array-contains": return Array.isArray(x) && x.some((e) => eq(e, value));
      default: throw new Error(`unsupported op ${op}`);
    }
  };

  // `inScope(docPath)` decides which docs the query ranges over (one collection or a group).
  const inCollection = (path) => {
    const depth = path.split("/").length + 1;
    return (p) => p.startsWith(`${path}/`) && p.split("/").length === depth;
  };
  const inGroup = (id) => (p) => {
    const parts = p.split("/");
    return parts.length % 2 === 0 && parts[parts.length - 2] === id;
  };

  // `after`: startAfter cursor, a doc snapshot or the order-by values.
  const query = (inScope, filters = [], orders = [], max, after) => ({
    where: (field, op, value) => query(inScope, [...filters, { field, op, value }], orders, max, after),
    orderBy: (field, dir = "asc") => query(inScope, filters, [...orders, { field, dir }], max, after),
    limit: (n) => query(inScope, filters, orders, n, after),
    startAfter: (...cursor) => query(inScope, filters, orders, max, cursor),
    // Aggregate count like the Admin SDK: `.count().get()` -> snapshot.data().count.
    count: () => ({
      async get() {
        const { size } = await query(inScope, filters, orders, max, after).get();
        return { data: () => ({ count: size }) };
      },
    }),
    async get() {
      let rows = [...store.entries()].filter(
        ([p, d]) => inScope(p) && filters.every((f) => matches(d, f)),
      );
      // Firestore's implicit final order is the document path (__name__); the sorts below are
      // stable, so sorting by path first makes it the tie-break.
      rows.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      for (const { field, dir } of [...orders].reverse()) {
        rows.sort(([, a], [, b]) => {
          return compare(getPath(a, field), getPath(b, field)) * (dir === "desc" ? -1 : 1);
        });
      }
      if (after) {
        // A snapshot cursor is its values on the order-by fields plus its path (the implicit
        // __name__ tie-break), so it works even when that doc no longer matches or exists.
        const [first] = after;
        const isSnap = first && typeof first === "object" && first.ref;
        const values = isSnap ? orders.map((o) => getPath(first.data(), o.field)) : after;
        const cursorPath = isSnap ? first.ref.path : undefined;
        rows = rows.filter(([p, d]) => {
          for (let i = 0; i < orders.length && i < values.length; i++) {
            const c = compare(getPath(d, orders[i].field), values[i]) * (orders[i].dir === "desc" ? -1 : 1);
            if (c !== 0) return c > 0;
          }
          return cursorPath !== undefined && p > cursorPath;
        });
      }
      if (max !== undefined) rows = rows.slice(0, max);
      const docs = rows.map(([p]) => snap(p));
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (f) => docs.forEach(f) };
    },
  });

  const collectionRef = (path) => ({
    ...query(inCollection(path)),
    path,
    id: path.split("/").pop(),
    get parent() {
      return path.includes("/") ? docRef(parentPath(path)) : null;
    },
    doc: (id) => docRef(`${path}/${id ?? `auto-${++autoId}`}`),
    add: async (data) => {
      const ref = docRef(`${path}/auto-${++autoId}`);
      write.set(ref.path, data);
      return ref;
    },
  });

  // All-or-nothing like Firestore: a failing write (create on an existing doc, update on a
  // missing one) rolls back the earlier writes of the same batch/transaction.
  const commitAll = (pending) => {
    const backup = new Map([...store].map(([k, v]) => [k, clone(v)]));
    const versionBackup = new Map(versions);
    try {
      pending.forEach((f) => f());
    } catch (error) {
      store.clear();
      backup.forEach((v, k) => store.set(k, v));
      versions.clear();
      versionBackup.forEach((v, k) => versions.set(k, v));
      throw error;
    }
  };

  const db = {
    collection: collectionRef,
    collectionGroup: (id) => query(inGroup(id)),
    doc: docRef,
    // Deletes the doc or collection at ref.path and everything beneath it.
    async recursiveDelete(ref) {
      for (const p of [...store.keys()]) {
        if (p === ref.path || p.startsWith(`${ref.path}/`)) store.delete(p);
      }
    },
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        get: async (refOrQuery) => (refOrQuery.path && !refOrQuery.where ? snap(refOrQuery.path) : refOrQuery.get()),
      };
      tx.set = (r, d, o) => (pending.push(() => write.set(r.path, d, o)), tx);
      tx.update = (r, d, pre) => (pending.push(() => write.update(r.path, d, pre)), tx);
      tx.create = (r, d) => (pending.push(() => write.create(r.path, d)), tx);
      tx.delete = (r, pre) => (pending.push(() => write.delete(r.path, pre)), tx);
      const result = await fn(tx);
      commitAll(pending);
      return result;
    },
    batch() {
      const pending = [];
      const b = {
        set: (r, d, o) => (pending.push(() => write.set(r.path, d, o)), b),
        update: (r, d, pre) => (pending.push(() => write.update(r.path, d, pre)), b),
        create: (r, d) => (pending.push(() => write.create(r.path, d)), b),
        delete: (r, pre) => (pending.push(() => write.delete(r.path, pre)), b),
        commit: async () => commitAll(pending),
      };
      return b;
    },
    // Test helpers.
    _store: store,
    _get: (path) => clone(store.get(path)),
    _put: (path, data) => store.set(path, clone(data)),
    _list: (prefix) => [...store.keys()].filter((p) => p.startsWith(prefix)),
  };
  return db;
}

module.exports = { createFakeFirestore };
