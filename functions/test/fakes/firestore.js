// In-memory Firestore stand-in for unit tests: doc get/set/update/delete, collection queries
// (where/orderBy/limit), transactions, batches and the FieldValue transforms. Docs live in one
// Map keyed by full path ("users/u1/blocks/u2").
const clone = (v) => (v === undefined ? v : structuredClone(v));
const name = (v) => v?.constructor?.name;

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
  if (name(value) === "DeleteTransform") delete o[last];
  else o[last] = value;
}

function createFakeFirestore(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, clone(v)]));
  let autoId = 0;
  const now = () => new Date().toISOString();

  const resolve = (data, existing = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = resolveValue(existing[k], v);
    return out;
  };
  const resolveValue = (current, v) => {
    if (v && typeof v === "object" && name(v)?.endsWith("Transform")) {
      return name(v) === "DeleteTransform" ? undefined : applyTransform(current, v, now);
    }
    return clone(v);
  };

  const snap = (path) => {
    const data = store.get(path);
    const id = path.split("/").pop();
    return {
      id,
      exists: data !== undefined,
      ref: docRef(path),
      data: () => clone(data),
      get: (field) => getPath(data, field),
    };
  };

  const write = {
    set(path, data, options) {
      if (options?.merge) {
        const base = clone(store.get(path)) ?? {};
        for (const [k, v] of Object.entries(data)) base[k] = resolveValue(base[k], v);
        store.set(path, base);
      } else {
        store.set(path, resolve(data));
      }
    },
    update(path, data) {
      const base = clone(store.get(path));
      if (base === undefined) {
        const e = new Error(`NOT_FOUND: ${path}`);
        e.code = 5;
        throw e;
      }
      for (const [k, v] of Object.entries(data)) setPath(base, k, resolveValue(getPath(base, k), v));
      store.set(path, base);
    },
    create(path, data) {
      if (store.has(path)) {
        const e = new Error(`ALREADY_EXISTS: ${path}`);
        e.code = 6;
        throw e;
      }
      store.set(path, resolve(data));
    },
    delete(path) {
      store.delete(path);
    },
  };

  const docRef = (path) => ({
    path,
    id: path.split("/").pop(),
    get: async () => snap(path),
    set: async (d, o) => write.set(path, d, o),
    update: async (d) => write.update(path, d),
    create: async (d) => write.create(path, d),
    delete: async () => write.delete(path),
    collection: (sub) => collectionRef(`${path}/${sub}`),
  });

  const matches = (data, { field, op, value }) => {
    const x = getPath(data, field);
    switch (op) {
      case "==": return eq(x, value);
      case "!=": return !eq(x, value);
      case "<": return x < value;
      case "<=": return x <= value;
      case ">": return x > value;
      case ">=": return x >= value;
      case "in": return value.some((v) => eq(v, x));
      case "array-contains": return Array.isArray(x) && x.some((e) => eq(e, value));
      default: throw new Error(`unsupported op ${op}`);
    }
  };

  const query = (path, filters = [], orders = [], max) => ({
    where: (field, op, value) => query(path, [...filters, { field, op, value }], orders, max),
    orderBy: (field, dir = "asc") => query(path, filters, [...orders, { field, dir }], max),
    limit: (n) => query(path, filters, orders, n),
    async get() {
      const depth = path.split("/").length + 1;
      let rows = [...store.entries()].filter(
        ([p, d]) =>
          p.startsWith(`${path}/`) &&
          p.split("/").length === depth &&
          filters.every((f) => matches(d, f)),
      );
      for (const { field, dir } of [...orders].reverse()) {
        rows.sort(([, a], [, b]) => {
          const x = getPath(a, field);
          const y = getPath(b, field);
          return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1);
        });
      }
      if (max !== undefined) rows = rows.slice(0, max);
      const docs = rows.map(([p]) => snap(p));
      return { docs, empty: docs.length === 0, size: docs.length, forEach: (f) => docs.forEach(f) };
    },
  });

  const collectionRef = (path) => ({
    ...query(path),
    path,
    doc: (id) => docRef(`${path}/${id ?? `auto-${++autoId}`}`),
    add: async (data) => {
      const ref = docRef(`${path}/auto-${++autoId}`);
      write.set(ref.path, data);
      return ref;
    },
  });

  const db = {
    collection: collectionRef,
    doc: docRef,
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        get: async (refOrQuery) => (refOrQuery.path && !refOrQuery.where ? snap(refOrQuery.path) : refOrQuery.get()),
      };
      tx.set = (r, d, o) => (pending.push(() => write.set(r.path, d, o)), tx);
      tx.update = (r, d) => (pending.push(() => write.update(r.path, d)), tx);
      tx.create = (r, d) => (pending.push(() => write.create(r.path, d)), tx);
      tx.delete = (r) => (pending.push(() => write.delete(r.path)), tx);
      const result = await fn(tx);
      pending.forEach((f) => f());
      return result;
    },
    batch() {
      const pending = [];
      const b = {
        set: (r, d, o) => (pending.push(() => write.set(r.path, d, o)), b),
        update: (r, d) => (pending.push(() => write.update(r.path, d)), b),
        create: (r, d) => (pending.push(() => write.create(r.path, d)), b),
        delete: (r) => (pending.push(() => write.delete(r.path)), b),
        commit: async () => pending.forEach((f) => f()),
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
