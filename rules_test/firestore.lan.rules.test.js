const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc, Timestamp } = require("firebase/firestore");

// firestore.lan.rules is what `firebase --config firebase.lan.json` loads for testing on a
// physical phone or the Android emulator. It differs from firestore.rules only in also accepting
// Storage emulator URLs on private-LAN hosts (ruling R18). A separate project id keeps its rules
// apart from firestore.rules.test.js in the same emulator.
const projectId = "echoes-rules-test-lan";
const rules = fs.readFileSync(
  path.join(__dirname, "..", "firestore.lan.rules"),
  "utf8",
);

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({ projectId, firestore: { rules } });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

const url = (host, folder, uid, bucket = "demo-echoes.appspot.com") =>
  `http://${host}:9199/v0/b/${bucket}/o/${folder}%2F${uid}%2Fa.bin?alt=media&token=t`;

function memoryDoc(fields) {
  const now = Timestamp.fromDate(new Date("2026-05-18T00:00:00Z"));
  return {
    userId: "creator",
    placeId: "place-1",
    textContent: "A memory",
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: "tdr1v",
    sentiment: { compound: 0, positive: 0, neutral: 1, negative: 0 },
    privacy: "public",
    taggedUserIds: [],
    communityId: null,
    releaseDate: null,
    isDeleted: false,
    moderation: null,
    createdAt: now,
    updatedAt: now,
    ...fields,
  };
}

test("LAN rules accept Storage emulator urls on private-LAN hosts", async () => {
  const db = testEnv.authenticatedContext("creator").firestore();
  const create = (id, fields) => setDoc(doc(db, `memories/${id}`), memoryDoc(fields));

  for (const [i, host] of ["127.0.0.1", "localhost", "10.0.2.2", "10.1.2.3", "192.168.1.5", "172.16.0.9", "172.31.255.1"].entries()) {
    await assertSucceeds(
      create(`ok${i}`, {
        imageUrl: url(host, "memory-images", "creator"),
        audioUrl: url(host, "memory-audio", "creator"),
      }),
    );
  }
  await assertSucceeds(
    create("prod", {
      imageUrl:
        "https://firebasestorage.googleapis.com/v0/b/demo-echoes.appspot.com/o/memory-images%2Fcreator%2Fa.jpg?alt=media&token=t",
    }),
  );
});

test("LAN rules still refuse public hosts, other buckets and other users' folders", async () => {
  const db = testEnv.authenticatedContext("creator").firestore();
  const create = (id, fields) => setDoc(doc(db, `memories/${id}`), memoryDoc(fields));

  await assertFails(create("pub1", { imageUrl: url("8.8.8.8", "memory-images", "creator") }));
  await assertFails(create("pub2", { imageUrl: url("172.32.0.1", "memory-images", "creator") }));
  await assertFails(create("pub3", { imageUrl: url("tracker.example", "memory-images", "creator") }));
  await assertFails(create("pub4", { imageUrl: url("192.168.1.5.evil.example", "memory-images", "creator") }));
  await assertFails(create("bucket", { imageUrl: url("192.168.1.5", "memory-images", "creator", "other.appspot.com") }));
  await assertFails(create("other", { imageUrl: url("192.168.1.5", "memory-images", "someone-else") }));
  await assertFails(create("port", { imageUrl: "http://192.168.1.5:8080/v0/b/demo-echoes.appspot.com/o/memory-images%2Fcreator%2Fa.jpg" }));
});
