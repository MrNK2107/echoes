const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} = require("firebase/firestore");
const {
  collection,
  getDocs,
  query,
  where,
  writeBatch,
} = require("firebase/firestore");

const projectId = "echoes-rules-test";
const rules = fs.readFileSync(
  path.join(__dirname, "..", "firestore.rules"),
  "utf8",
);

const DAY_MS = 24 * 60 * 60 * 1000;

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

test("list queries must constrain results to visible memories", async () => {
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  const placeMemories = query(
    collection(strangerDb, "memories"),
    where("placeId", "==", "place-1"),
    where("isDeleted", "==", false),
  );
  const unauthenticatedPlaceMemories = query(
    collection(unauthenticatedDb, "memories"),
    where("placeId", "==", "place-1"),
    where("isDeleted", "==", false),
  );
  const publicPlaceMemories = query(
    collection(strangerDb, "memories"),
    where("placeId", "==", "place-1"),
    where("isDeleted", "==", false),
    where("privacy", "==", "public"),
  );

  await assertFails(getDocs(placeMemories));
  await assertSucceeds(getDocs(publicPlaceMemories));
  await assertFails(getDocs(unauthenticatedPlaceMemories));
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

test("memory image url can be attached after upload", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();

  await assertSucceeds(
    setDoc(
      doc(creatorDb, "memories/private-memory"),
      {
        imageUrl: storageUrl("images", "creator", "private-memory.jpg"),
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    ),
  );
});

async function seedDeletedMemory() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "memories/deleted-memory"), {
      ...memoryDoc({ privacy: "public" }),
      isDeleted: true,
      deletedAt: Timestamp.now(),
    });
  });
}

test("authors can get and list their own deleted memories", async () => {
  await seedDeletedMemory();
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(getDoc(doc(creatorDb, "memories/deleted-memory")));
  await assertFails(getDoc(doc(strangerDb, "memories/deleted-memory")));
  await assertSucceeds(
    getDocs(
      query(
        collection(creatorDb, "memories"),
        where("userId", "==", "creator"),
        where("isDeleted", "==", true),
      ),
    ),
  );
  await assertFails(
    getDocs(
      query(
        collection(strangerDb, "memories"),
        where("placeId", "==", "place-1"),
        where("isDeleted", "==", true),
      ),
    ),
  );
});

test("audioUrl is attachable by the author only; placeId stays immutable", async () => {
  // changedKeys() only reports keys present on both sides, so audioUrl must
  // already exist on the stored doc for the allowlist to be exercised.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    for (const id of ["private-memory", "public-memory"]) {
      await setDoc(
        doc(context.firestore(), `memories/${id}`),
        { audioUrl: "https://example.test/old.m4a" },
        { merge: true },
      );
    }
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(
    setDoc(
      doc(creatorDb, "memories/private-memory"),
      { audioUrl: storageUrl("audio", "creator", "private-memory.m4a"), updatedAt: Timestamp.now() },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(creatorDb, "memories/private-memory"),
      { placeId: "place-2", updatedAt: Timestamp.now() },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(strangerDb, "memories/public-memory"),
      { audioUrl: storageUrl("audio", "stranger", "public-memory.m4a"), updatedAt: Timestamp.now() },
      { merge: true },
    ),
  );
});

test("author may update sentiment alongside text; a non-author may not", async () => {
  const sentiment = { compound: -0.5, positive: 0, neutral: 0.5, negative: 0.5 };
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "memories/sentiment-memory"), memoryDoc());
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  await assertFails(
    updateDoc(doc(strangerDb, "memories/sentiment-memory"), {
      textContent: "hijack",
      sentiment,
      updatedAt: Timestamp.now(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(creatorDb, "memories/sentiment-memory"), {
      textContent: "edited",
      sentiment,
      updatedAt: Timestamp.now(),
    }),
  );
});

test("memory updates cannot add unknown fields", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(
      doc(db, "memories/others-memory"),
      memoryDoc({ userId: "other" }),
    );
    await setDoc(doc(db, "memories/deleted-by-author"), {
      ...memoryDoc(),
      isDeleted: true,
      deletedAt: Timestamp.now(),
    });
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const now = () => Timestamp.now();

  // author edit + bogus
  await assertFails(
    updateDoc(doc(creatorDb, "memories/private-memory"), {
      textContent: "edited",
      bogus: true,
      updatedAt: now(),
    }),
  );
  // author soft-delete + bogus
  await assertFails(
    updateDoc(doc(creatorDb, "memories/public-memory"), {
      isDeleted: true,
      deletedAt: now(),
      updatedAt: now(),
      bogus: true,
    }),
  );
  // custodian (non-author) soft-delete + bogus
  await assertFails(
    updateDoc(doc(creatorDb, "memories/others-memory"), {
      isDeleted: true,
      deletedAt: now(),
      updatedAt: now(),
      bogus: true,
    }),
  );
  // author restore + bogus
  await assertFails(
    updateDoc(doc(creatorDb, "memories/deleted-by-author"), {
      isDeleted: false,
      updatedAt: now(),
      bogus: true,
    }),
  );
  // sanity: the same custodian soft-delete without bogus is allowed
  await assertSucceeds(
    updateDoc(doc(creatorDb, "memories/others-memory"), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
});

test("soft-delete timestamps must be the server's request time", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "memories/others-memory"),
      memoryDoc({ userId: "other" }),
    );
  });
  // creator is the custodian of place-1, which holds others-memory.
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const backdated = Timestamp.fromDate(new Date(Date.now() - 40 * DAY_MS));
  const future = Timestamp.fromDate(new Date("2999-01-01T00:00:00Z"));

  // author with a client clock timestamp
  await assertFails(
    updateDoc(doc(creatorDb, "memories/public-memory"), {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }),
  );
  // custodian backdating another user's memory past the restore window
  await assertFails(
    updateDoc(doc(creatorDb, "memories/others-memory"), {
      isDeleted: true,
      deletedAt: backdated,
      updatedAt: serverTimestamp(),
    }),
  );
  // custodian future-dating it so it is never purged
  await assertFails(
    updateDoc(doc(creatorDb, "memories/others-memory"), {
      isDeleted: true,
      deletedAt: future,
      updatedAt: serverTimestamp(),
    }),
  );
  // updatedAt must be pinned as well
  await assertFails(
    updateDoc(doc(creatorDb, "memories/others-memory"), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: backdated,
    }),
  );
  await assertSucceeds(
    updateDoc(doc(creatorDb, "memories/public-memory"), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(creatorDb, "memories/others-memory"), {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
});

test("restore is judged against the stored deletion time and must clear it", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "memories/expired-deleted"), {
      ...memoryDoc(),
      isDeleted: true,
      deletedAt: Timestamp.fromDate(new Date(Date.now() - 31 * DAY_MS)),
    });
    await setDoc(doc(db, "memories/recent-deleted"), {
      ...memoryDoc(),
      isDeleted: true,
      deletedAt: Timestamp.fromDate(new Date(Date.now() - DAY_MS)),
    });
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const restore = { isDeleted: false, deletedAt: null, updatedAt: serverTimestamp() };

  await assertFails(updateDoc(doc(creatorDb, "memories/expired-deleted"), restore));
  // leaving deletedAt in place (or replacing it) is not a restore
  await assertFails(
    updateDoc(doc(creatorDb, "memories/recent-deleted"), {
      isDeleted: false,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(creatorDb, "memories/recent-deleted"), {
      isDeleted: false,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(updateDoc(doc(creatorDb, "memories/recent-deleted"), restore));
});

test("author can read their own deleted private memory; others cannot", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "memories/deleted-private"), {
      ...memoryDoc({ privacy: "private" }),
      isDeleted: true,
      deletedAt: Timestamp.now(),
    });
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(getDoc(doc(creatorDb, "memories/deleted-private")));
  await assertFails(getDoc(doc(strangerDb, "memories/deleted-private")));
});

test("sentiment must be numbers in range on create and edit", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const withSentiment = (sentiment) => ({ ...memoryDoc(), sentiment });
  const ok = { compound: 0.5, positive: 0.5, neutral: 0.5, negative: 0 };

  await assertFails(
    setDoc(doc(creatorDb, "memories/s-huge"), withSentiment({ ...ok, compound: 1e9 })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-low"), withSentiment({ ...ok, compound: -1.5 })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-nan"), withSentiment({ ...ok, compound: NaN })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-str"), withSentiment({ ...ok, compound: "1" })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-pos"), withSentiment({ ...ok, positive: 2 })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-neu"), withSentiment({ ...ok, neutral: -0.1 })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-neg"), withSentiment({ ...ok, negative: 1.1 })),
  );
  await assertFails(
    setDoc(doc(creatorDb, "memories/s-missing"), withSentiment({ compound: 0.5 })),
  );
  await assertSucceeds(setDoc(doc(creatorDb, "memories/s-ok"), withSentiment(ok)));
  await assertSucceeds(
    setDoc(doc(creatorDb, "memories/s-edge"), withSentiment({ compound: -1, positive: 0, neutral: 1, negative: 1 })),
  );

  await assertFails(
    updateDoc(doc(creatorDb, "memories/private-memory"), {
      textContent: "edited",
      sentiment: { ...ok, compound: 1e9 },
      updatedAt: Timestamp.now(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(creatorDb, "memories/private-memory"), {
      textContent: "edited",
      sentiment: ok,
      updatedAt: Timestamp.now(),
    }),
  );
});

test("media urls must be this project's storage urls under the author's path", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const create = (id, fields) => setDoc(doc(creatorDb, `memories/${id}`), { ...memoryDoc(), ...fields });
  const edit = (fields) =>
    updateDoc(doc(creatorDb, "memories/private-memory"), { ...fields, updatedAt: Timestamp.now() });

  // external trackers
  await assertFails(create("u1", { imageUrl: "https://tracker.example/pixel.jpg" }));
  await assertFails(create("u2", { audioUrl: "https://tracker.example/a.m4a" }));
  await assertFails(edit({ imageUrl: "https://tracker.example/pixel.jpg" }));
  await assertFails(edit({ audioUrl: "http://tracker.example:9199/v0/b/x/o/memory-audio%2Fcreator%2Fa.m4a" }));
  // look-alike hosts and paths
  await assertFails(
    create("u3", { imageUrl: "https://firebasestorage.googleapis.com.evil.example/v0/b/b/o/memory-images%2Fcreator%2Fa.jpg" }),
  );
  await assertFails(create("u4", { imageUrl: storageUrl("images", "someone-else", "a.jpg") }));
  await assertFails(create("u5", { imageUrl: storageUrl("audio", "creator", "a.jpg") }));
  await assertFails(create("u6", { audioUrl: storageUrl("images", "creator", "a.m4a") }));
  await assertFails(create("u7", { imageUrl: 42 }));

  // production and emulator download urls for the author's own files
  await assertSucceeds(
    create("ok1", {
      imageUrl: storageUrl("images", "creator", "ok1.jpg"),
      audioUrl: storageUrl("audio", "creator", "ok1.m4a"),
    }),
  );
  await assertSucceeds(
    create("ok2", {
      imageUrl: "http://127.0.0.1:9199/v0/b/demo-echoes.appspot.com/o/memory-images%2Fcreator%2Fok2.jpg?alt=media&token=t",
      audioUrl: "http://192.168.1.5:9199/v0/b/demo-echoes.appspot.com/o/memory-audio%2Fcreator%2Fok2.m4a?alt=media&token=t",
    }),
  );
  await assertSucceeds(create("ok3", { imageUrl: null, audioUrl: null }));
  await assertSucceeds(edit({ imageUrl: storageUrl("images", "creator", "private-memory.jpg") }));
});

test("deleted memories cannot be edited", async () => {
  await seedDeletedMemory();
  const creatorDb = testEnv.authenticatedContext("creator").firestore();

  await assertFails(
    updateDoc(doc(creatorDb, "memories/deleted-memory"), {
      textContent: "edited while deleted",
      updatedAt: Timestamp.now(),
    }),
  );
});

test("author write identical to stored doc (empty diff) is allowed", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  await assertSucceeds(
    setDoc(doc(creatorDb, "memories/private-memory"), memoryDoc({ privacy: "private" })),
  );
});

test("community create batch may include owner membership", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const batch = writeBatch(creatorDb);
  batch.set(doc(creatorDb, "communities/new-community"), {
    ownerId: "creator",
    name: "New Community",
    description: "A beta community",
    type: "thematic",
    memberCount: 1,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  });
  batch.set(doc(creatorDb, "communities/new-community/members/creator"), {
    role: "owner",
    joinedAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  });

  await assertSucceeds(batch.commit());
});

test("self join can update community member count in one transaction-like batch", async () => {
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const batch = writeBatch(strangerDb);
  batch.set(doc(strangerDb, "communities/community-1/members/stranger"), {
    role: "member",
    joinedAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  });
  batch.set(
    doc(strangerDb, "communities/community-1"),
    {
      memberCount: 2,
      updatedAt: "2026-05-18T00:00:00.000Z",
    },
    { merge: true },
  );

  await assertSucceeds(batch.commit());
});

test("place custodians can soft-delete attached memories", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(
    setDoc(
      doc(creatorDb, "memories/public-memory"),
      {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(strangerDb, "memories/tagged-memory"),
      {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
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

test("transfer recipient can create accepted notification request", async () => {
  const recipientDb = testEnv.authenticatedContext("recipient").firestore();
  const request = {
    type: "transferAccepted",
    recipientUserId: "creator",
    title: "Custodianship accepted",
    body: "recipient accepted your custodianship transfer.",
    data: {
      type: "transferAccepted",
      fromUserId: "creator",
      toUserId: "recipient",
      transferId: "pending-transfer",
      placeId: "place-1",
    },
    status: "pending",
    createdAt: Timestamp.now(),
  };

  await assertSucceeds(
    setDoc(doc(recipientDb, "notificationRequests/accepted-1"), request),
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

/** A Firebase Storage download URL as getDownloadURL returns it in production. */
function storageUrl(kind, userId, fileName) {
  return (
    "https://firebasestorage.googleapis.com/v0/b/echoes-rules-test.appspot.com/o/" +
    `memory-${kind}%2F${userId}%2F${fileName}?alt=media&token=00000000-0000-0000-0000-000000000000`
  );
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
