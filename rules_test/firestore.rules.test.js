const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  deleteDoc,
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
/** The bucket scripts/build-rules.js pins in the committed firestore.rules. */
const BUCKET = "demo-echoes.appspot.com";

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
    where("moderation", "==", null),
  );
  // Without the moderation filter the rules cannot prove hidden memories are excluded.
  const publicUnmoderated = query(
    collection(strangerDb, "memories"),
    where("placeId", "==", "place-1"),
    where("isDeleted", "==", false),
    where("privacy", "==", "public"),
  );

  await assertFails(getDocs(placeMemories));
  await assertSucceeds(getDocs(publicPlaceMemories));
  await assertFails(getDocs(publicUnmoderated));
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
      audioUrl: "http://localhost:9199/v0/b/demo-echoes.appspot.com/o/memory-audio%2Fcreator%2Fok2.m4a?alt=media&token=t",
    }),
  );
  // R18: production rules pin the bucket and accept only loopback emulator hosts. Private-LAN
  // and 10.0.2.2 hosts are accepted only by the generated firestore.lan.rules.
  await assertFails(
    create("lan1", {
      audioUrl: "http://192.168.1.5:9199/v0/b/demo-echoes.appspot.com/o/memory-audio%2Fcreator%2Fa.m4a?alt=media&token=t",
    }),
  );
  await assertFails(
    create("lan2", {
      imageUrl: "http://10.0.2.2:9199/v0/b/demo-echoes.appspot.com/o/memory-images%2Fcreator%2Fa.jpg?alt=media&token=t",
    }),
  );
  await assertFails(
    create("bucket1", {
      imageUrl: "https://firebasestorage.googleapis.com/v0/b/someone-else.appspot.com/o/memory-images%2Fcreator%2Fa.jpg?alt=media&token=t",
    }),
  );
  await assertFails(
    create("bucket2", {
      imageUrl: "https://firebasestorage.googleapis.com/v0/b/demo-echoesXappspot.com/o/memory-images%2Fcreator%2Fa.jpg?alt=media&token=t",
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

test("user docs (which hold emails) are readable only by their owner", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/creator"), {
      displayName: "Creator",
      email: "creator@example.com",
    });
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(creatorDb, "users/creator")));
  await assertFails(getDoc(doc(strangerDb, "users/creator")));
  await assertFails(getDoc(doc(unauthenticatedDb, "users/creator")));
  await assertFails(getDocs(collection(strangerDb, "users")));
});

test("author write identical to stored doc (empty diff) is allowed", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  await assertSucceeds(
    setDoc(doc(creatorDb, "memories/private-memory"), memoryDoc({ privacy: "private" })),
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

// ---------------------------------------------------------------------------------------------
// Plan 3: public profiles, inbox, blocks, read-only social collections, moderation, places.
// ---------------------------------------------------------------------------------------------

const ISO = "2026-10-19T00:00:00.000Z";

function profileDoc(fields = {}) {
  return { displayName: "Asha Rao", displayNameLower: "asha rao", updatedAt: ISO, ...fields };
}

test("public profiles are readable by any signed-in user", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicProfiles/creator"), profileDoc());
  });
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(strangerDb, "publicProfiles/creator")));
  await assertSucceeds(
    getDocs(
      query(
        collection(strangerDb, "publicProfiles"),
        where("displayNameLower", ">=", "as"),
        where("displayNameLower", "<", "as"),
      ),
    ),
  );
  await assertFails(getDoc(doc(unauthenticatedDb, "publicProfiles/creator")));
});

test("only the owner writes their public profile, with exactly the allowed keys", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const ref = (db) => doc(db, "publicProfiles/creator");

  // a stranger writing someone else's profile
  await assertFails(setDoc(ref(strangerDb), profileDoc()));
  // shape violations
  await assertFails(setDoc(ref(creatorDb), { ...profileDoc(), email: "x@example.com" }));
  await assertFails(setDoc(ref(creatorDb), { displayName: "Asha", displayNameLower: "asha" }));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayName: "A" })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayName: "A".repeat(41) })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayName: " Asha" })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayName: 42 })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayNameLower: null })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ updatedAt: Timestamp.now() })));

  await assertSucceeds(setDoc(ref(creatorDb), profileDoc({ displayName: "Al" })));
  await assertSucceeds(setDoc(ref(creatorDb), profileDoc({ displayName: "A".repeat(40) })));
  // the client counts code points (validateDisplayName); 40 emoji must be accepted
  await assertSucceeds(setDoc(ref(creatorDb), profileDoc({ displayName: "\u{1F600}".repeat(40) })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayName: "\u{1F600}".repeat(41) })));
  await assertSucceeds(setDoc(ref(creatorDb), profileDoc({ displayName: "Zoë Ångström" })));
  await assertFails(setDoc(ref(creatorDb), profileDoc({ displayName: "Asha\nRao" })));
  await assertSucceeds(setDoc(ref(creatorDb), profileDoc()));
  await assertSucceeds(
    updateDoc(ref(creatorDb), { displayName: "Asha R", displayNameLower: "asha r", updatedAt: ISO }),
  );
  await assertFails(updateDoc(ref(creatorDb), { bogus: true }));
  await assertFails(updateDoc(ref(strangerDb), { displayName: "Hijack", displayNameLower: "hijack" }));
  await assertFails(deleteDoc(ref(creatorDb)));
});

test("owner may write notificationPrefs and acceptedTermsAt; user doc keys are allowlisted", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const ref = (db) => doc(db, "users/creator");
  const user = {
    displayName: "Creator",
    email: "creator@example.com",
    photoUrl: null,
    defaultPrivacy: "public",
    managedPlaceIds: [],
    communityIds: [],
    createdAt: ISO,
    updatedAt: ISO,
  };
  const prefs = { transfers: true, tags: false, communityInvites: true };

  await assertFails(setDoc(ref(creatorDb), { ...user, staff: true }));
  await assertFails(setDoc(ref(strangerDb), user));
  await assertSucceeds(setDoc(ref(creatorDb), { ...user, acceptedTermsAt: ISO, notificationPrefs: prefs }));

  await assertSucceeds(updateDoc(ref(creatorDb), { notificationPrefs: { ...prefs, tags: true }, updatedAt: ISO }));
  await assertSucceeds(updateDoc(ref(creatorDb), { acceptedTermsAt: ISO }));
  await assertSucceeds(updateDoc(ref(creatorDb), { defaultPrivacy: "private", updatedAt: ISO }));
  await assertFails(updateDoc(ref(creatorDb), { notificationPrefs: { ...prefs, tags: "no" } }));
  await assertFails(updateDoc(ref(creatorDb), { notificationPrefs: { transfers: true, tags: true } }));
  await assertFails(updateDoc(ref(creatorDb), { notificationPrefs: { ...prefs, marketing: true } }));
  await assertFails(updateDoc(ref(creatorDb), { notificationPrefs: true }));
  await assertFails(updateDoc(ref(creatorDb), { acceptedTermsAt: 1 }));
  await assertFails(updateDoc(ref(creatorDb), { role: "admin" }));
  await assertFails(updateDoc(ref(strangerDb), { notificationPrefs: prefs }));
});

async function seedNotification() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/creator/notifications/n1"), {
      type: "memoryTagged",
      title: "Tagged in a memory",
      body: "Someone tagged you in a memory.",
      data: { memoryId: "tagged-memory" },
      createdAt: ISO,
      readAt: null,
    });
  });
}

test("notifications are owner-read and the owner may only set readAt", async () => {
  await seedNotification();
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const ref = (db) => doc(db, "users/creator/notifications/n1");
  const fresh = { type: "memoryTagged", title: "t", body: "b", data: {}, createdAt: ISO, readAt: null };

  await assertSucceeds(getDoc(ref(creatorDb)));
  await assertSucceeds(getDocs(collection(creatorDb, "users/creator/notifications")));
  await assertFails(getDoc(ref(strangerDb)));
  await assertFails(getDocs(collection(strangerDb, "users/creator/notifications")));

  // marking read is allowed; changing the title (alone or alongside readAt) is not
  await assertSucceeds(updateDoc(ref(creatorDb), { readAt: ISO }));
  await assertFails(updateDoc(ref(creatorDb), { title: "Free money" }));
  await assertFails(updateDoc(ref(creatorDb), { readAt: ISO, title: "Free money" }));
  await assertFails(updateDoc(ref(creatorDb), { readAt: 5 }));
  await assertFails(updateDoc(ref(strangerDb), { readAt: ISO }));

  // only the server creates and deletes notifications
  await assertFails(setDoc(doc(creatorDb, "users/creator/notifications/n2"), fresh));
  await assertFails(setDoc(doc(strangerDb, "users/creator/notifications/n3"), fresh));
  await assertFails(deleteDoc(ref(creatorDb)));
});

test("blocks are owner-only {createdAt: string} docs and cannot target yourself", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const ref = (db, other = "stranger") => doc(db, `users/creator/blocks/${other}`);

  await assertFails(setDoc(ref(creatorDb), { createdAt: Timestamp.now() }));
  await assertFails(setDoc(ref(creatorDb), { createdAt: ISO, note: "x" }));
  await assertFails(setDoc(ref(creatorDb), {}));
  await assertFails(setDoc(ref(creatorDb, "creator"), { createdAt: ISO }));
  await assertFails(setDoc(ref(strangerDb), { createdAt: ISO }));
  await assertSucceeds(setDoc(ref(creatorDb), { createdAt: ISO }));

  await assertSucceeds(getDoc(ref(creatorDb)));
  await assertSucceeds(getDocs(collection(creatorDb, "users/creator/blocks")));
  await assertFails(getDoc(ref(strangerDb)));
  await assertFails(getDocs(collection(strangerDb, "users/creator/blocks")));
  await assertFails(deleteDoc(ref(strangerDb)));
  await assertSucceeds(deleteDoc(ref(creatorDb)));
});

test("communities and members are read-only for clients", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const memberDb = testEnv.authenticatedContext("member").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();
  const community = {
    ownerId: "creator", name: "N", description: "D", type: "thematic",
    memberCount: 1, createdAt: ISO, updatedAt: ISO,
  };

  await assertSucceeds(getDoc(doc(strangerDb, "communities/community-1")));
  await assertSucceeds(getDocs(collection(strangerDb, "communities")));
  await assertFails(getDoc(doc(unauthenticatedDb, "communities/community-1")));

  // members: readable by members of that community and by the member themself
  await assertSucceeds(getDoc(doc(memberDb, "communities/community-1/members/member")));
  await assertSucceeds(getDocs(collection(memberDb, "communities/community-1/members")));
  await assertFails(getDoc(doc(strangerDb, "communities/community-1/members/member")));
  await assertFails(getDocs(collection(strangerDb, "communities/community-1/members")));
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "communities/community-2/members/stranger"), { role: "member", joinedAt: ISO });
  });
  await assertSucceeds(getDoc(doc(strangerDb, "communities/community-2/members/stranger")));

  // no client writes: create, update, join (member doc), owner-added member, role change, leave
  await assertFails(setDoc(doc(creatorDb, "communities/new-community"), community));
  await assertFails(updateDoc(doc(memberDb, "communities/community-1"), { memberCount: 99 }));
  await assertFails(updateDoc(doc(creatorDb, "communities/community-1"), { name: "Renamed" }));
  await assertFails(
    setDoc(doc(strangerDb, "communities/community-1/members/stranger"), { role: "member", joinedAt: ISO }),
  );
  await assertFails(
    setDoc(doc(creatorDb, "communities/community-1/members/someone"), { role: "member", joinedAt: ISO }),
  );
  await assertFails(updateDoc(doc(creatorDb, "communities/community-1/members/member"), { role: "guardian" }));
  await assertFails(deleteDoc(doc(memberDb, "communities/community-1/members/member")));
  await assertFails(deleteDoc(doc(creatorDb, "communities/community-1")));
});

test("transfers are readable by their parties and never written by clients", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const recipientDb = testEnv.authenticatedContext("recipient").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();

  await assertSucceeds(getDoc(doc(creatorDb, "transfers/pending-transfer")));
  await assertSucceeds(getDoc(doc(recipientDb, "transfers/pending-transfer")));
  await assertSucceeds(
    getDocs(query(collection(recipientDb, "transfers"), where("toUserId", "==", "recipient"))),
  );
  await assertSucceeds(
    getDocs(query(collection(creatorDb, "transfers"), where("fromUserId", "==", "creator"))),
  );
  await assertFails(getDoc(doc(strangerDb, "transfers/pending-transfer")));
  await assertFails(getDocs(collection(strangerDb, "transfers")));

  // a custodian initiating, the recipient accepting, the sender revoking
  await assertFails(setDoc(doc(creatorDb, "transfers/transfer-1"), transferDoc()));
  await assertFails(
    updateDoc(doc(recipientDb, "transfers/pending-transfer"), { status: "accepted", respondedAt: ISO }),
  );
  await assertFails(updateDoc(doc(creatorDb, "transfers/pending-transfer"), { status: "revoked" }));
  await assertFails(deleteDoc(doc(creatorDb, "transfers/pending-transfer")));
});

test("institutions are readable by signed-in users and never written by clients", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "institutions/inst-1"), {
      name: "College", allowedEmailDomains: ["college.edu"], adminUserIds: ["creator"],
      subZones: [], communityId: "inst-inst-1",
    });
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const unauthenticatedDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(getDoc(doc(strangerDb, "institutions/inst-1")));
  await assertFails(getDoc(doc(unauthenticatedDb, "institutions/inst-1")));
  await assertFails(
    setDoc(doc(strangerDb, "institutions/inst-2"), {
      name: "Mine", allowedEmailDomains: ["x.edu"], adminUserIds: ["stranger"], verifiedAdminUserIds: ["stranger"],
    }),
  );
  await assertFails(updateDoc(doc(creatorDb, "institutions/inst-1"), { adminUserIds: ["creator", "stranger"] }));
  await assertFails(updateDoc(doc(strangerDb, "institutions/inst-1"), { adminUserIds: ["stranger"] }));
});

test("reports, rateLimits and notificationRequests are closed to clients", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "reports/public-memory_creator"), { memoryId: "public-memory", reporterId: "creator" });
    await setDoc(doc(db, "rateLimits/creator"), { count: 1 });
    await setDoc(doc(db, "notificationRequests/r1"), { recipientUserId: "creator" });
  });
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const request = {
    type: "memoryTagged",
    recipientUserId: "tagged-user",
    title: "Tagged in a memory",
    body: "creator tagged you in a memory.",
    data: { type: "memoryTagged", fromUserId: "creator", toUserId: "tagged-user", memoryId: "tagged-memory" },
    status: "pending",
    createdAt: Timestamp.now(),
  };

  await assertFails(setDoc(doc(creatorDb, "notificationRequests/request-1"), request));
  await assertFails(getDoc(doc(creatorDb, "notificationRequests/r1")));
  await assertFails(
    setDoc(doc(creatorDb, "reports/public-memory_creator2"), {
      memoryId: "public-memory", reporterId: "creator", reason: "spam", note: null, createdAt: ISO,
    }),
  );
  await assertFails(getDoc(doc(creatorDb, "reports/public-memory_creator")));
  await assertFails(getDocs(collection(creatorDb, "reports")));
  await assertFails(setDoc(doc(creatorDb, "rateLimits/creator"), { count: 0 }));
  await assertFails(getDoc(doc(creatorDb, "rateLimits/creator")));
});

async function seedHiddenMemory() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "memories/hidden-memory"), {
      ...memoryDoc(),
      moderation: "hidden",
    });
  });
}

test("hidden memories are invisible to everyone but their author", async () => {
  await seedHiddenMemory();
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const strangerDb = testEnv.authenticatedContext("stranger").firestore();
  const memberDb = testEnv.authenticatedContext("member").firestore();
  const taggedDb = testEnv.authenticatedContext("tagged-user").firestore();

  await assertFails(getDoc(doc(strangerDb, "memories/hidden-memory")));
  await assertSucceeds(getDoc(doc(creatorDb, "memories/hidden-memory")));

  const branch = (db, ...extra) =>
    getDocs(
      query(
        collection(db, "memories"),
        where("placeId", "==", "place-1"),
        where("isDeleted", "==", false),
        ...extra,
      ),
    );
  // the author's own-memories branch needs no moderation filter and still returns hidden ones
  await assertSucceeds(branch(creatorDb, where("userId", "==", "creator")));
  // every non-own visibility branch must filter moderation == null
  await assertSucceeds(
    branch(
      taggedDb,
      where("privacy", "==", "tagged"),
      where("taggedUserIds", "array-contains", "tagged-user"),
      where("moderation", "==", null),
    ),
  );
  await assertFails(
    branch(taggedDb, where("privacy", "==", "tagged"), where("taggedUserIds", "array-contains", "tagged-user")),
  );
  await assertSucceeds(
    branch(
      strangerDb,
      where("privacy", "==", "timeRelease"),
      where("releaseDate", "<=", Timestamp.fromDate(new Date("2021-01-01T00:00:00Z"))),
      where("moderation", "==", null),
    ),
  );
  await assertFails(
    branch(
      strangerDb,
      where("privacy", "==", "timeRelease"),
      where("releaseDate", "<=", Timestamp.fromDate(new Date("2021-01-01T00:00:00Z"))),
    ),
  );
  await assertSucceeds(
    branch(
      memberDb,
      where("privacy", "==", "community"),
      where("communityId", "in", ["community-1"]),
      where("moderation", "==", null),
    ),
  );
  await assertFails(
    branch(memberDb, where("privacy", "==", "community"), where("communityId", "in", ["community-1"])),
  );
});

test("clients cannot set moderation or flags", async () => {
  await seedHiddenMemory();
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const withoutModeration = memoryDoc();
  delete withoutModeration.moderation;

  // create: moderation must be present and null; flags and unknown keys are refused
  await assertFails(setDoc(doc(creatorDb, "memories/m-missing"), withoutModeration));
  await assertFails(setDoc(doc(creatorDb, "memories/m-hidden"), { ...memoryDoc(), moderation: "hidden" }));
  await assertFails(setDoc(doc(creatorDb, "memories/m-flags"), { ...memoryDoc(), flags: { profanity: false } }));
  await assertFails(setDoc(doc(creatorDb, "memories/m-bogus"), { ...memoryDoc(), bogus: true }));
  await assertSucceeds(setDoc(doc(creatorDb, "memories/m-ok"), memoryDoc()));
  await assertSucceeds(
    setDoc(doc(creatorDb, "memories/m-full"), { ...memoryDoc(), imageUrl: null, audioUrl: null, deletedAt: null }),
  );

  // update: the author can neither hide, unhide nor flag
  await assertFails(
    updateDoc(doc(creatorDb, "memories/public-memory"), { moderation: "hidden", updatedAt: Timestamp.now() }),
  );
  await assertFails(
    updateDoc(doc(creatorDb, "memories/hidden-memory"), { moderation: null, updatedAt: Timestamp.now() }),
  );
  await assertFails(
    updateDoc(doc(creatorDb, "memories/public-memory"), { flags: { profanity: false }, updatedAt: Timestamp.now() }),
  );
  // the author may still edit the text of a hidden memory
  await assertSucceeds(
    updateDoc(doc(creatorDb, "memories/hidden-memory"), { textContent: "edited", updatedAt: Timestamp.now() }),
  );
});

function placeDoc(fields = {}) {
  return {
    name: "Memory Place",
    latitude: 12.9716,
    longitude: 77.5946,
    geohash: "tdr1v9",
    communityId: null,
    custodianIds: ["creator"],
    aura: {
      dominantSentiment: "neutral",
      compoundScore: 0,
      intensity: 0,
      memoryCount: 0,
      colorHex: "#C0C0C0",
      updatedAt: ISO,
    },
    memoryCount: 0,
    publicMemoryCount: 0,
    createdAt: ISO,
    updatedAt: ISO,
    ...fields,
  };
}

test("clients create only empty places they look after, and never update places", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const create = (id, fields) => setDoc(doc(creatorDb, `places/${id}`), placeDoc(fields));
  const aura = placeDoc().aura;

  await assertFails(create("p1", { custodianIds: ["stranger"] }));
  await assertFails(create("p2", { custodianIds: ["creator", "stranger"] }));
  await assertFails(create("p3", { memoryCount: 1 }));
  await assertFails(create("p4", { publicMemoryCount: 5 }));
  await assertFails(create("p5", { aura: { ...aura, memoryCount: 3 } }));
  await assertFails(create("p6", { aura: { ...aura, intensity: 0.9 } }));
  await assertFails(create("p7", { communityId: "community-1" }));
  await assertFails(create("p8", { institutionId: "inst-1" }));
  await assertFails(create("p9", { aura: null }));
  await assertSucceeds(create("p-ok", {}));

  // custodians can no longer update a place (transfers and aggregates are server-side)
  await assertFails(updateDoc(doc(creatorDb, "places/place-1"), { custodianIds: ["creator", "stranger"] }));
  await assertFails(updateDoc(doc(creatorDb, "places/p-ok"), { name: "Renamed" }));
  await assertFails(deleteDoc(doc(creatorDb, "places/p-ok")));

  // aura history is written by onMemoryWritten only
  await assertSucceeds(getDocs(collection(creatorDb, "places/place-1/auraHistory")));
  await assertFails(
    setDoc(doc(creatorDb, "places/place-1/auraHistory/h1"), { placeId: "place-1", aura, recordedAt: ISO }),
  );
});

test("community-privacy memories require membership of that community (create and edit)", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "memories/member-memory"), memoryDoc({ userId: "member" }));
  });
  const memberDb = testEnv.authenticatedContext("member").firestore();
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const community = (userId, communityId = "community-1") =>
    memoryDoc({ userId, privacy: "community", communityId });
  const edit = (db, id, fields) =>
    updateDoc(doc(db, `memories/${id}`), {
      privacy: "community",
      taggedUserIds: [],
      releaseDate: null,
      updatedAt: Timestamp.now(),
      ...fields,
    });

  // create: "member" belongs to community-1; "creator" (its owner in the seed) has no member doc
  await assertSucceeds(setDoc(doc(memberDb, "memories/c-ok"), community("member")));
  await assertFails(setDoc(doc(creatorDb, "memories/c-outsider"), community("creator")));
  await assertFails(setDoc(doc(memberDb, "memories/c-other"), community("member", "community-2")));
  await assertFails(setDoc(doc(memberDb, "memories/c-null"), { ...community("member"), communityId: null }));

  // edit: switching a memory to a community needs membership too
  await assertSucceeds(edit(memberDb, "member-memory", { communityId: "community-1" }));
  await assertFails(edit(creatorDb, "private-memory", { communityId: "community-1" }));
  await assertFails(edit(memberDb, "member-memory", { communityId: "community-2" }));
});

test("a memory tags at most 20 people (ruling R24)", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const people = (n) => Array.from({ length: n }, (_, i) => `user-${i}`);
  const tagged = (n) => memoryDoc({ privacy: "tagged", taggedUserIds: people(n) });

  await assertSucceeds(setDoc(doc(creatorDb, "memories/t20"), tagged(20)));
  await assertFails(setDoc(doc(creatorDb, "memories/t21"), tagged(21)));
  await assertFails(setDoc(doc(creatorDb, "memories/t-str"), { ...memoryDoc(), taggedUserIds: "user-1" }));

  const edit = (ids) =>
    updateDoc(doc(creatorDb, "memories/private-memory"), {
      privacy: "tagged",
      taggedUserIds: ids,
      updatedAt: Timestamp.now(),
    });
  await assertFails(edit(people(21)));
  await assertFails(edit(null));
  await assertSucceeds(edit(people(20)));
});

test("client-created places carry only the client's default name and typed coordinates", async () => {
  const creatorDb = testEnv.authenticatedContext("creator").firestore();
  const create = (id, fields) => setDoc(doc(creatorDb, `places/${id}`), placeDoc(fields));
  const aura = placeDoc().aura;

  await assertFails(create("n1", { name: "Free crypto here" }));
  await assertFails(create("n2", { latitude: "12.97" }));
  await assertFails(create("n3", { longitude: null }));
  await assertFails(create("n4", { geohash: 42 }));
  await assertFails(create("n5", { aura: { ...aura, label: "best place" } }));
  await assertSucceeds(create("n-ok", {}));
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
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/` +
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
    moderation: null,
    createdAt: now,
    updatedAt: now,
  };
}
