const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, Timestamp } = require("firebase/firestore");

const projectId = "echoes-rules-test";
const rules = fs.readFileSync(
  path.join(__dirname, "..", "firestore.rules"),
  "utf8",
);

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseDocuments();
});

test("memory privacy read rules allow and deny expected viewers", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const taggedDb = testEnv.authenticatedContext("tagged-user").firestore();
  const memberDb = testEnv.authenticatedContext("member").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(unauthenticatedDb, "memories/public-memory")));
  await assertSucceeds(getDoc(doc(strangerDb, "memories/public-memory")));
  await assertSucceeds(getDoc(doc(creatorDb, "memories/private-memory")));
  await assertFails(getDoc(doc(strangerDb, "memories/private-memory")));
  await assertSucceeds(getDoc(doc(taggedDb, "memories/tagged-memory")));
  await assertFails(getDoc(doc(strangerDb, "memories/tagged-memory")));
  await assertFails(getDoc(doc(strangerDb, "memories/time-release-future")));
  await assertSucceeds(getDoc(doc(strangerDb, "memories/time-release-past")));
  await assertSucceeds(getDoc(doc(memberDb, "memories/community-memory")));
  await assertFails(getDoc(doc(strangerDb, "memories/community-memory")));
});

test("memory location updates are denied", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();

  await assertFails(
    setDoc(
      doc(creatorDb, "memories/private-memory"),
      {
        ...memoryDoc({ privacy: "private" }),
        latitude: 13,
      },
      { merge: true },
    ),
  );
});

test("place custodians can soft-delete attached memories", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(
    setDoc(
      doc(creatorDb, "memories/public-memory"),
      {
        isDeleted: true,
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(strangerDb, "memories/tagged-memory"),
      {
        isDeleted: true,
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    ),
  );
});

test("transfer initiation requires place custodianship", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(
    setDoc(doc(creatorDb, "transfers/transfer-1"), transferDoc()),
  );
  await assertFails(
    setDoc(
      doc(strangerDb, "transfers/transfer-2"),
      transferDoc({ fromUserId: "stranger" }),
    ),
  );
});

test("transfer acceptance is restricted to the recipient", async () => {
  const recipientDb = testEnv.authenticatedContext("recipient").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(
    setDoc(
      doc(recipientDb, "transfers/pending-transfer"),
      {
        status: "accepted",
        acceptedAt: Timestamp.now(),
      },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(strangerDb, "transfers/pending-transfer"),
      {
        status: "accepted",
        acceptedAt: Timestamp.now(),
      },
      { merge: true },
    ),
  );
});

test("notification request creation is restricted to the sender", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const request = {
    type: "memoryTagged",
    recipientUserId: "tagged-user",
    title: "Tagged in a memory",
    body: "creator tagged you in a memory.",
    data: {
      type: "memoryTagged",
      fromUserId: "creator",
      toUserId: "tagged-user",
      memoryId: "tagged-memory",
    },
    status: "pending",
    createdAt: Timestamp.now(),
  };

  await assertSucceeds(
    setDoc(doc(creatorDb, "notificationRequests/request-1"), request),
  );
  await assertFails(
    setDoc(doc(strangerDb, "notificationRequests/request-2"), request),
  );
});

async function seedBaseDocuments() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "places/place-1"), { custodianIds: ["creator"] });
    await setDoc(doc(db, "communities/community-1"), { ownerId: "creator" });
    await setDoc(doc(db, "communities/community-1/members/member"), {
      role: "member",
    });
    await setDoc(doc(db, "transfers/pending-transfer"), transferDoc());

    await setDoc(doc(db, "memories/public-memory"), memoryDoc());
    await setDoc(
      doc(db, "memories/private-memory"),
      memoryDoc({ privacy: "private" }),
    );
    await setDoc(
      doc(db, "memories/tagged-memory"),
      memoryDoc({ privacy: "tagged", taggedUserIds: ["tagged-user"] }),
    );
    await setDoc(
      doc(db, "memories/time-release-future"),
      memoryDoc({
        privacy: "timeRelease",
        releaseDate: Timestamp.fromDate(new Date("2999-01-01T00:00:00Z")),
      }),
    );
    await setDoc(
      doc(db, "memories/time-release-past"),
      memoryDoc({
        privacy: "timeRelease",
        releaseDate: Timestamp.fromDate(new Date("2020-01-01T00:00:00Z")),
      }),
    );
    await setDoc(
      doc(db, "memories/community-memory"),
      memoryDoc({ privacy: "community", communityId: "community-1" }),
    );
  });
}

function transferDoc({
  placeId = "place-1",
  fromUserId = "creator",
  toUserId = "recipient",
  status = "pending",
} = {}) {
  const now = Timestamp.fromDate(new Date("2026-05-18T00:00:00Z"));
  return {
    placeId,
    fromUserId,
    toUserId,
    status,
    createdAt: now,
    revokeUntil: Timestamp.fromDate(new Date("2026-05-25T00:00:00Z")),
  };
}

function memoryDoc({
  userId = "creator",
  privacy = "public",
  taggedUserIds = [],
  communityId = null,
  releaseDate = null,
} = {}) {
  const now = Timestamp.fromDate(new Date("2026-05-18T00:00:00Z"));
  return {
    userId,
    placeId: "place-1",
    textContent: "A memory",
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: "tdr1v",
    sentiment: {
      compound: 0,
      positive: 0,
      neutral: 1,
      negative: 0,
    },
    privacy,
    taggedUserIds,
    communityId,
    releaseDate,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
}
