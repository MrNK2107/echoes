import { calculateAura } from '@/domain/aura';
import { encodeGeohash } from '@/domain/geo';
import { DEFAULT_NOTIFICATION_PREFS } from '@/domain/profiles';
import { analyzeSentiment } from '@/domain/sentiment';
import type { AppUser, LatLng, Memory, Place, PrivacyType } from '@/domain/types';
import type { Account } from './memory/store';

export const DEMO_USER = {
  email: 'demo@echoes.app',
  password: 'echoes-demo',
  displayName: 'Demo Custodian',
} as const;

const DAY_MS = 86_400_000;
const COMMUNITY_ID = 'community-cubbon-walkers';

const USER_DEMO = 'user-demo';
const USER_ASHA = 'user-asha';
const USER_ROHAN = 'user-rohan';

interface PlaceDef { id: string; name: string; dLat: number; dLng: number; communityId: string | null }

const PLACE_DEFS: PlaceDef[] = [
  { id: 'place-1', name: 'Cubbon Park', dLat: 0.0047, dLng: -0.0017, communityId: COMMUNITY_ID },
  { id: 'place-2', name: 'Vidhana Soudha', dLat: 0.008, dLng: -0.004, communityId: null },
  { id: 'place-3', name: 'MG Road Metro Station', dLat: 0.0043, dLng: 0.0104, communityId: null },
  { id: 'place-4', name: 'UB City', dLat: 0.0003, dLng: 0.0017, communityId: null },
  { id: 'place-5', name: "St. Mark's Cathedral", dLat: 0.001, dLng: 0.0047, communityId: null },
  { id: 'place-6', name: 'Freedom Park', dLat: 0.0055, dLng: -0.0075, communityId: null },
  { id: 'place-7', name: 'Sree Kanteerava Stadium', dLat: -0.0013, dLng: -0.002, communityId: null },
];

interface MemDef {
  place: number; // 1-based place index
  user: string;
  text: string;
  privacy: PrivacyType;
  ageDays: number;
  tagged?: string[];
  community?: boolean;
  releaseInDays?: number;
}

const MEMORY_DEFS: MemDef[] = [
  // Cubbon Park: positive
  { place: 1, user: USER_ASHA, privacy: 'public', ageDays: 40, text: 'I love this park! The morning walks here make me so happy and grateful.' },
  { place: 1, user: USER_DEMO, privacy: 'public', ageDays: 12, text: 'What a wonderful, beautiful Sunday under these old trees. Pure joy.' },
  { place: 1, user: USER_ROHAN, privacy: 'public', ageDays: 3, text: 'Amazing day, laughing with friends on the lawn. I feel so happy and blessed.' },
  { place: 1, user: USER_DEMO, privacy: 'community', ageDays: 6, community: true, text: 'Our walkers group met at the bandstand today. Great energy, lovely people.' },
  // Vidhana Soudha: peaceful / mildly positive
  { place: 2, user: USER_DEMO, privacy: 'public', ageDays: 20, text: 'A calm, peaceful, pleasant evening on the lawns, but I felt tired and a bit lost.' },
  { place: 2, user: USER_ASHA, privacy: 'public', ageDays: 9, text: 'Nice light and a good, calm breeze, though I was tired and worried about work.' },
  { place: 2, user: USER_DEMO, privacy: 'private', ageDays: 2, text: 'Sat on the steps and thought about the year ahead.' },
  // MG Road Metro: mixed
  { place: 3, user: USER_ROHAN, privacy: 'public', ageDays: 15, text: 'I love the energy of this place, it makes me happy, but the crowd is awful and exhausting.' },
  { place: 3, user: USER_ASHA, privacy: 'public', ageDays: 7, text: 'Wonderful street food nearby, but the traffic is terrible and I hate the noise.' },
  { place: 3, user: USER_ASHA, privacy: 'tagged', ageDays: 5, tagged: [USER_DEMO], text: 'Remember our first coffee here? Such a great and happy afternoon.' },
  // UB City: neutral
  { place: 4, user: USER_DEMO, privacy: 'public', ageDays: 25, text: 'Walked past the mall on the way to the office.' },
  { place: 4, user: USER_ROHAN, privacy: 'public', ageDays: 10, text: 'Waited here for a cab. The building has a glass front.' },
  { place: 4, user: USER_ROHAN, privacy: 'private', ageDays: 4, text: 'Meeting at three. Need to remember the documents.' },
  // St. Mark's Cathedral: heavy
  { place: 5, user: USER_ASHA, privacy: 'public', ageDays: 30, text: 'I felt so sad and lonely here today. Everything seems hopeless.' },
  { place: 5, user: USER_DEMO, privacy: 'public', ageDays: 8, text: 'A terrible, painful memory. I miss them so much and I am heartbroken.' },
  { place: 5, user: USER_ASHA, privacy: 'private', ageDays: 1, text: 'Came here to cry in peace. It was an awful week.' },
  { place: 5, user: USER_DEMO, privacy: 'timeRelease', ageDays: 1, releaseInDays: 30, text: 'A note for my future self: you got through this, and I am proud of you.' },
  // Freedom Park: peaceful
  { place: 6, user: USER_DEMO, privacy: 'public', ageDays: 18, text: 'A lovely, calm afternoon with a good book, but I was tired and worried about tomorrow.' },
  { place: 6, user: USER_ROHAN, privacy: 'public', ageDays: 6, text: 'A good, nice spot to relax, though a difficult week left me tired.' },
  { place: 6, user: USER_ASHA, privacy: 'tagged', ageDays: 3, tagged: [USER_DEMO, USER_ROHAN], text: 'The three of us had a lovely picnic here. A good, peaceful day.' },
  // Kanteerava Stadium: neutral
  { place: 7, user: USER_ROHAN, privacy: 'public', ageDays: 14, text: 'The stadium gates open at six. There is a queue near the ticket counter.' },
  { place: 7, user: USER_DEMO, privacy: 'public', ageDays: 5, text: 'Passed by on the road. A match is scheduled for the weekend.' },
  { place: 7, user: USER_ASHA, privacy: 'private', ageDays: 2, text: 'Parked the scooter near gate two.' },
];

/** Centre of the demo neighbourhood (Bengaluru) that the seed is laid out around. */
export const DEMO_CENTER: LatLng = { latitude: 12.9716, longitude: 77.5946 };

export function buildSeed(
  now: Date,
  center: LatLng = DEMO_CENTER,
): { places: Place[]; memories: Memory[]; users: AppUser[]; credentials: Account[] } {
  const basePlaces = PLACE_DEFS.map((def) => ({
    def,
    latitude: center.latitude + def.dLat,
    longitude: center.longitude + def.dLng,
  }));

  const memories: Memory[] = MEMORY_DEFS.map((d, i) => {
    const bp = basePlaces[d.place - 1];
    const createdAt = new Date(now.getTime() - d.ageDays * DAY_MS);
    return {
      id: `memory-${i + 1}`,
      userId: d.user,
      placeId: bp.def.id,
      imageUrl: null,
      audioUrl: null,
      textContent: d.text,
      latitude: bp.latitude,
      longitude: bp.longitude,
      geohash: encodeGeohash(bp.latitude, bp.longitude),
      sentiment: analyzeSentiment(d.text),
      privacy: d.privacy,
      taggedUserIds: d.tagged ?? [],
      communityId: d.community ? COMMUNITY_ID : null,
      releaseDate: d.releaseInDays ? new Date(now.getTime() + d.releaseInDays * DAY_MS) : null,
      isDeleted: false,
      deletedAt: null,
      moderation: null,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const places: Place[] = basePlaces.map(({ def, latitude, longitude }) => {
    const mine = memories.filter((m) => m.placeId === def.id);
    const pub = mine.filter((m) => m.privacy === 'public');
    const first = [...mine].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    return {
      id: def.id,
      name: def.name,
      latitude,
      longitude,
      geohash: encodeGeohash(latitude, longitude),
      communityId: def.communityId,
      custodianIds: first ? [first.userId] : [],
      aura: calculateAura(pub, now),
      memoryCount: mine.length,
      publicMemoryCount: pub.length,
      createdAt: first?.createdAt ?? now,
      updatedAt: now,
    };
  });

  const joined = new Date(now.getTime() - 60 * DAY_MS);
  const user = (id: string, displayName: string, email: string, extra: Partial<AppUser> = {}): AppUser => ({
    id,
    displayName,
    email,
    photoUrl: null,
    defaultPrivacy: 'public',
    managedPlaceIds: [],
    communityIds: [],
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
    acceptedTermsAt: joined,
    createdAt: joined,
    updatedAt: joined,
    ...extra,
  });
  const managed = (uid: string) => places.filter((p) => p.custodianIds.includes(uid)).map((p) => p.id);

  const users: AppUser[] = [
    user(USER_DEMO, DEMO_USER.displayName, DEMO_USER.email, {
      managedPlaceIds: managed(USER_DEMO),
      communityIds: [COMMUNITY_ID],
    }),
    user(USER_ASHA, 'Asha Rao', 'asha@echoes.app', { managedPlaceIds: managed(USER_ASHA) }),
    user(USER_ROHAN, 'Rohan Mehta', 'rohan@echoes.app', { managedPlaceIds: managed(USER_ROHAN) }),
  ];

  const credentials: Account[] = [
    { userId: USER_DEMO, email: DEMO_USER.email, password: DEMO_USER.password, displayName: DEMO_USER.displayName },
  ];

  return { places, memories, users, credentials };
}
