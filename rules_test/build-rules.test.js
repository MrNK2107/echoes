const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// No emulator needed: checks that the committed, generated rules match firestore.rules.template
// (ruling R18). Regenerate with `node scripts/build-rules.js`.
const root = path.join(__dirname, "..");
// Checkouts may use CRLF (core.autocrlf); the generator writes LF.
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
const { DEFAULT_BUCKET, render } = require(path.join(root, "scripts", "build-rules.js"));
const bucket = process.env.FIREBASE_STORAGE_BUCKET || DEFAULT_BUCKET;
const template = read("firestore.rules.template");

test("firestore.rules and firestore.lan.rules are up to date with the template", () => {
  assert.equal(read("firestore.rules"), render(template, { bucket, lan: false }));
  assert.equal(read("firestore.lan.rules"), render(template, { bucket, lan: true }));
});

test("the generated files differ only inside storageUrlPrefix()", () => {
  // Blank out the function body (from its header to the closing brace) in both files.
  const strip = (s) => {
    const start = s.indexOf("    function storageUrlPrefix() {");
    assert.ok(start >= 0, "storageUrlPrefix() not found");
    const end = s.indexOf("\n    }\n", start);
    assert.ok(end > start);
    return s.slice(0, start) + "<storageUrlPrefix>" + s.slice(end + "\n    }\n".length);
  };
  const prod = read("firestore.rules");
  const lan = read("firestore.lan.rules");
  assert.notEqual(prod, lan);
  assert.equal(strip(prod), strip(lan));
});

test("the production prefix pins the bucket and accepts only loopback emulator hosts", () => {
  const prod = render(template, { bucket: "echoes-prod.appspot.com", lan: false });
  assert.match(prod, /echoes-prod\[\.\]appspot\[\.\]com/);
  assert.doesNotMatch(prod, /192\[\.\]168|10\[\.\]0\[\.\]2\[\.\]2/);
  assert.match(prod, /127\[\.\]0\[\.\]0\[\.\]1\|localhost/);
  const lan = render(template, { bucket: "echoes-prod.appspot.com", lan: true });
  assert.match(lan, /192\[\.\]168/);
  assert.match(lan, /10\[\.\]0\[\.\]2\[\.\]2/);
});

test("render refuses bucket names that are not plain bucket ids", () => {
  for (const bad of ["", "a/b", "x'.y", "bucket|evil", "UPPER.appspot.com", "a b"]) {
    assert.throws(() => render(template, { bucket: bad, lan: false }), /bucket/i);
  }
});

test("--prod writes only firestore.rules, with no loopback hosts, and needs a bucket", () => {
  const { execFileSync, spawnSync } = require("node:child_process");
  const script = path.join(root, "scripts", "build-rules.js");
  const fakeRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "rules-prod-"));
  try {
    fs.writeFileSync(path.join(fakeRoot, "firestore.rules.template"), fs.readFileSync(path.join(root, "firestore.rules.template")));
    const env = { ...process.env };
    delete env.ECHOES_RULES_ROOT;
    delete env.NODE_ENV;
    const rootArgs = ["--root", fakeRoot];
    delete env.FIREBASE_STORAGE_BUCKET;
    const noBucket = spawnSync(process.execPath, [script, "--prod", ...rootArgs], { env, encoding: "utf8" });
    assert.notEqual(noBucket.status, 0);
    assert.match(noBucket.stderr, /FIREBASE_STORAGE_BUCKET/);
    assert.deepEqual(fs.readdirSync(fakeRoot), ["firestore.rules.template"]);

    const stdout = execFileSync(process.execPath, [script, "--prod", ...rootArgs], {
      env: { ...env, FIREBASE_STORAGE_BUCKET: "echoes-prod.appspot.com" },
      encoding: "utf8",
    });
    assert.ok(stdout.includes(path.join(fakeRoot, "firestore.rules")), "prints the resolved output path");
    assert.deepEqual(fs.readdirSync(fakeRoot).sort(), ["firestore.rules", "firestore.rules.template"]);
    const out = fs.readFileSync(path.join(fakeRoot, "firestore.rules"), "utf8");
    assert.ok(out.includes("echoes-prod[.]appspot[.]com"));
    assert.doesNotMatch(out, /127|localhost|9199/);
  } finally {
    fs.rmSync(fakeRoot, { recursive: true, force: true });
  }
});

test("render in prod mode emits only the googleapis host", () => {
  const prod = render(template, { bucket: "echoes-prod.appspot.com", lan: false, prod: true });
  assert.match(prod, /firebasestorage[.]googleapis/);
  assert.doesNotMatch(prod, /127|localhost|9199/);
});

test("ECHOES_RULES_ROOT is honoured only under NODE_ENV=test", () => {
  const { spawnSync } = require("node:child_process");
  const script = path.join(root, "scripts", "build-rules.js");
  const fakeRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "rules-env-"));
  try {
    fs.writeFileSync(path.join(fakeRoot, "firestore.rules.template"), fs.readFileSync(path.join(root, "firestore.rules.template")));
    const env = { ...process.env, ECHOES_RULES_ROOT: fakeRoot, FIREBASE_STORAGE_BUCKET: "echoes-prod.appspot.com" };
    // Without NODE_ENV=test the variable is ignored: the script reads the repo template and
    // would write into the repo, so only the NODE_ENV=test case actually runs it.
    const ok = spawnSync(process.execPath, [script, "--prod"], { env: { ...env, NODE_ENV: "test" }, encoding: "utf8" });
    assert.equal(ok.status, 0);
    assert.deepEqual(fs.readdirSync(fakeRoot).sort(), ["firestore.rules", "firestore.rules.template"]);
  } finally {
    fs.rmSync(fakeRoot, { recursive: true, force: true });
  }
  const src = fs.readFileSync(script, "utf8");
  assert.match(src, /NODE_ENV === "test"/);
});
