import type {
  AccountStatus,
  AppNotification,
  AppUser,
  AuraHistoryEntry,
  AuthSession,
  Community,
  CommunityMembership,
  Institution,
  LatLng,
  Memory,
  NotificationPrefs,
  Place,
  PrivacyType,
  PublicProfile,
  ReportReason,
  SentimentResult,
  Transfer,
} from '@/domain/types';

export type {
  AccountStatus,
  AppNotification,
  AuraHistoryEntry,
  Community,
  CommunityMembership,
  Institution,
  NotificationPrefs,
  PublicProfile,
  ReportReason,
  SubZone,
  Transfer,
} from '@/domain/types';

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
  /** Places whose custodianIds include the user, by name, at most 50. */
  subscribeCustodianOf(uid: string, cb: (places: Place[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /** The place's 14 most recent aura history entries, oldest first (chart order). */
  subscribeAuraHistory(
    placeId: string,
    cb: (entries: AuraHistoryEntry[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
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
  /** Rejects with Error(NOT_SIGNED_IN) without a session. */
  sendEmailVerification(): Promise<void>;
  /**
   * Reloads the account and forces a fresh ID token, so callables see a just-verified email or a
   * new `staff` claim. Rejects with Error(NOT_SIGNED_IN) without a session.
   */
  refreshUser(): Promise<AccountStatus>;
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
  /**
   * The reportContent callable (a community or a profile; staff review, never auto-hides). Same
   * rejections as reportMemory; reporting your own profile or a missing target is generic copy.
   */
  reportContent(input: {
    targetType: 'community' | 'profile';
    targetId: string;
    reason: ReportReason;
    note: string | null;
  }): Promise<void>;
}

/** The feed viewer; `viewerCommunityIds` is users/{uid}.communityIds. */
export interface FeedViewer { viewerId: string; viewerCommunityIds: string[]; now: Date }

/**
 * Communities change only through callables (ADR-0007). Callable failures reject with the copy
 * in ./callableErrors (COMMUNITY_LEAVE_ERRORS for leave), otherwise generic or offline copy.
 */
export interface CommunityRepository {
  /** The communities in users/{uid}.communityIds, by name. */
  subscribeMine(uid: string, cb: (communities: Community[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /** Largest first (memberCount desc), at most 50. */
  subscribeDiscover(cb: (communities: Community[]) => void, onError?: (e: Error) => void): Unsubscribe;
  findById(id: string): Promise<Community | null>;
  /** The user's membership of the community, or null. */
  subscribeMembership(
    id: string,
    uid: string,
    cb: (membership: CommunityMembership | null) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  /**
   * The community's memories, newest first, at most 50: members see its unhidden `community`
   * memories; everyone sees their own memories shared with it (hidden ones included).
   */
  subscribeFeed(
    id: string,
    viewer: FeedViewer,
    cb: (memories: Memory[]) => void,
    onError?: (e: Error) => void,
  ): Unsubscribe;
  /** Returns the new community's id; the caller becomes its owner. */
  create(input: { name: string; description: string }): Promise<string>;
  join(id: string): Promise<void>;
  /** Rejects with Error(OWNER_CANNOT_LEAVE) for the owner. */
  leave(id: string): Promise<void>;
  /** Members only; skips self, existing members and users who blocked you or turned invites off. */
  invite(id: string, userIds: string[]): Promise<void>;
}

/** Custodianship transfers (functions/transfers.js). */
export interface TransferRepository {
  /** Rejects with Error(TRANSFER_DUPLICATE) while a request to that person is pending. */
  initiate(input: { placeId: string; toUserId: string }): Promise<void>;
  respond(id: string, accept: boolean): Promise<void>;
  revoke(id: string): Promise<void>;
  /** Pending requests to the user, newest first, at most 50. */
  subscribeIncoming(uid: string, cb: (transfers: Transfer[]) => void, onError?: (e: Error) => void): Unsubscribe;
  /** Transfers the user sent or received, newest first, at most 50. */
  subscribeHistory(uid: string, cb: (transfers: Transfer[]) => void, onError?: (e: Error) => void): Unsubscribe;
}

/** Institutions (functions/institutions.js). */
export interface InstitutionRepository {
  /** By name, at most 50. */
  subscribeAll(cb: (institutions: Institution[]) => void, onError?: (e: Error) => void): Unsubscribe;
  findById(id: string): Promise<Institution | null>;
  /** Staff only (the `staff` custom claim). Returns the new institution's id. */
  create(input: { name: string; allowedEmailDomains: string[] }): Promise<string>;
  /** Rejects with Error(VERIFY_EMAIL_FIRST) or Error(EMAIL_DOMAIN_NOT_APPROVED). */
  claimAdmin(id: string): Promise<void>;
  /** Admins only; the radius is the server default (60 m). */
  addSubZone(id: string, input: { name: string; latitude: number; longitude: number }): Promise<void>;
}

export interface PushTokenRecord {
  token: string;
  platform: 'ios' | 'android';
  createdAt: Date;
  lastSeenAt: Date;
}

export interface PushTokenRepository {
  /**
   * Creates the token (createdAt = lastSeenAt = at); when it exists, refreshes lastSeenAt only, and
   * only if the stored value is more than 24 hours older than `at` (otherwise no write).
   */
  register(uid: string, token: string, platform: 'ios' | 'android', at: Date): Promise<void>;
  /** Deletes the token; a missing token is not an error. */
  unregister(uid: string, token: string): Promise<void>;
  get(uid: string, token: string): Promise<PushTokenRecord | null>;
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
  communities: CommunityRepository;
  transfers: TransferRepository;
  institutions: InstitutionRepository;
  pushTokens: PushTokenRepository;
}
