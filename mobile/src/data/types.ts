import type {
  AppNotification,
  AppUser,
  AuthSession,
  LatLng,
  Memory,
  NotificationPrefs,
  Place,
  PrivacyType,
  PublicProfile,
  ReportReason,
  SentimentResult,
} from '@/domain/types';

export type { AppNotification, NotificationPrefs, PublicProfile, ReportReason } from '@/domain/types';

export type Unsubscribe = () => void;

export interface PlaceRepository {
  subscribeNearby(
    q: { center: LatLng; radiusMeters: number },
    cb: (places: Place[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  findById(id: string): Promise<Place | null>;
  findNearest(q: { center: LatLng; radiusMeters: number }): Promise<Place | null>;
  create(place: Place): Promise<void>;
}

export interface MemoryRepository {
  /** Newest first by createdAt, at most 50. */
  subscribeVisibleForPlace(
    q: { placeId: string; viewerId: string; viewerCommunityIds: string[]; now: Date },
    cb: (memories: Memory[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  create(memory: Memory): Promise<void>;
  /** The author can read their own deleted memories; everyone else only sees visible ones. */
  findById(id: string): Promise<Memory | null>;
  /** The user's memories that are not deleted, newest first, at most 50. */
  subscribeForUser(userId: string, cb: (memories: Memory[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /** The user's deleted memories, newest `deletedAt` first, at most 50. */
  subscribeDeletedForUser(
    userId: string,
    cb: (memories: Memory[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  update(
    id: string,
    patch: {
      textContent: string;
      privacy: PrivacyType;
      taggedUserIds: string[];
      releaseDate: Date | null;
      communityId: string | null;
      sentiment: SentimentResult;
    },
    updatedAt: Date,
  ): Promise<void>;
  attachMedia(id: string, media: { imageUrl?: string; audioUrl?: string }, updatedAt: Date): Promise<void>;
  /**
   * `at` is the deletion time for the in-memory backend; Firestore stamps the server time instead
   * (ruling R13) and ignores it.
   */
  softDelete(id: string, at: Date): Promise<void>;
  /** Rejects with Error(RESTORE_EXPIRED) (see ./errors) outside the restore window. */
  restore(id: string, at: Date): Promise<void>;
}

export interface UserRepository {
  get(id: string): Promise<AppUser | null>;
  create(user: AppUser): Promise<void>;
  updateDefaultPrivacy(userId: string, privacy: 'public' | 'private', at: Date): Promise<void>;
  updateNotificationPrefs(userId: string, prefs: NotificationPrefs, at: Date): Promise<void>;
}

export interface AuthRepository {
  subscribe(cb: (s: AuthSession | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<AuthSession>;
  /**
   * Creates the account, its users doc (`acceptedTermsAt`, default notification prefs) and its
   * public profile. Rejects with Error(DISPLAY_NAME_ERROR) (domain/profiles) before creating
   * anything when the trimmed name is not 2 to 40 characters.
   */
  register(email: string, password: string, displayName: string, acceptedTermsAt: Date): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Rejects with Error(INCORRECT_PASSWORD) (see ./errors) when the password is wrong; the session stays. */
  deleteAccount(password: string): Promise<void>;
}

export interface MediaRepository {
  uploadMemoryImage(input: { userId: string; memoryId: string; localUri: string }): Promise<string>;
  uploadMemoryAudio(input: { userId: string; memoryId: string; localUri: string }): Promise<string>;
}

export interface ProfileRepository {
  get(uid: string): Promise<PublicProfile | null>;
  /** Profiles that exist, keyed by uid; missing uids are absent from the map. */
  getMany(uids: string[]): Promise<Map<string, PublicProfile>>;
  /**
   * Case- and diacritic-insensitive prefix search on the display name, ordered by the normalised
   * name, at most 10. Returns [] for queries under 2 characters (domain searchRange).
   */
  search(query: string, opts: { excludeUid?: string }): Promise<PublicProfile[]>;
  /** Rejects with Error(DISPLAY_NAME_ERROR) unless the trimmed name is 2 to 40 characters. */
  setDisplayName(uid: string, name: string, at: Date): Promise<void>;
}

export interface NotificationRepository {
  /** The user's inbox, newest first, at most 50. */
  subscribe(uid: string, cb: (notifications: AppNotification[]) => void, onError?: (e: Error) => void): Unsubscribe;
  markRead(uid: string, id: string, at: Date): Promise<void>;
  markAllRead(uid: string, at: Date): Promise<void>;
}

export interface SafetyRepository {
  /** Rejects with Error(GENERIC_ERROR) when blocking yourself. */
  block(uid: string, other: string, at: Date): Promise<void>;
  unblock(uid: string, other: string): Promise<void>;
  /** Uids the user has blocked, most recently blocked first. */
  subscribeBlocks(uid: string, cb: (blockedIds: string[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /**
   * The reportMemory callable. Rejects with REPORT_DUPLICATE, REPORT_RATE, TIMEOUT_ERROR or
   * GENERIC_ERROR copy (see ./callableErrors).
   */
  reportMemory(input: { memoryId: string; reason: ReportReason; note: string | null }): Promise<void>;
}

export interface Repositories {
  places: PlaceRepository;
  memories: MemoryRepository;
  users: UserRepository;
  auth: AuthRepository;
  media: MediaRepository;
  profiles: ProfileRepository;
  notifications: NotificationRepository;
  safety: SafetyRepository;
}
