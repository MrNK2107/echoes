const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { getBytes, getMetadata, ref, uploadBytes } = require("firebase/storage");

// Needs the Storage emulator: run with
//   npx firebase emulators:exec --only firestore,storage "npm test --prefix rules_test"
const projectId = "echoes-rules-test";
const rules = fs.readFileSync(
  path.join(__dirname, "..", "storage.rules"),
  "utf8",
);

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);
const M4A = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);

const FILES = [
  { path: "memory-images/owner/m1.jpg", bytes: JPEG, contentType: "image/jpeg" },
  { path: "memory-audio/owner/m1.m4a", bytes: M4A, contentType: "audio/mp4" },
];

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    storage: { rules },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const f of FILES) {
      await uploadBytes(ref(context.storage(), f.path), f.bytes, { contentType: f.contentType });
    }
  });
});

test("memory files are readable only by their owner", async () => {
  const owner = testEnv.authenticatedContext("owner").storage();
  const stranger = testEnv.authenticatedContext("stranger").storage();
  const anonymous = testEnv.unauthenticatedContext().storage();

  for (const f of FILES) {
    await assertSucceeds(getMetadata(ref(owner, f.path)));
    await assertSucceeds(getBytes(ref(owner, f.path)));
    await assertFails(getMetadata(ref(stranger, f.path)));
    await assertFails(getBytes(ref(stranger, f.path)));
    await assertFails(getMetadata(ref(anonymous, f.path)));
  }
});

test("memory files are writable only by their owner, within type and size limits", async () => {
  const owner = testEnv.authenticatedContext("owner").storage();
  const stranger = testEnv.authenticatedContext("stranger").storage();

  await assertSucceeds(
    uploadBytes(ref(owner, "memory-images/owner/m2.jpg"), JPEG, { contentType: "image/jpeg" }),
  );
  await assertSucceeds(
    uploadBytes(ref(owner, "memory-audio/owner/m2.m4a"), M4A, { contentType: "audio/mp4" }),
  );
  await assertFails(
    uploadBytes(ref(stranger, "memory-images/owner/m3.jpg"), JPEG, { contentType: "image/jpeg" }),
  );
  await assertFails(
    uploadBytes(ref(owner, "memory-images/owner/m4.jpg"), JPEG, { contentType: "text/html" }),
  );
  await assertFails(
    uploadBytes(ref(owner, "memory-audio/owner/m4.m4a"), M4A, { contentType: "image/jpeg" }),
  );
  await assertFails(
    uploadBytes(ref(owner, "memory-images/owner/big.jpg"), new Uint8Array(1024 * 1024 + 1), {
      contentType: "image/jpeg",
    }),
  );
});
