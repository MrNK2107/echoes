import type { AppUser, AuthSession, LatLng, Memory, Place, PrivacyType, SentimentResult } from '@/domain/types';

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
  /** Rejects with Error('This memory can no longer be restored.') outside the restore window. */
  restore(id: string, at: Date): Promise<void>;
}

export interface UserRepository {
  get(id: string): Promise<AppUser | null>;
  create(user: AppUser): Promise<void>;
  updateDefaultPrivacy(userId: string, privacy: 'public' | 'private', at: Date): Promise<void>;
}

export interface AuthRepository {
  subscribe(cb: (s: AuthSession | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<AuthSession>;
  register(email: string, password: string, displayName: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Rejects with Error('Incorrect password.') when the password is wrong; the session stays. */
  deleteAccount(password: string): Promise<void>;
}

export interface MediaRepository {
  uploadMemoryImage(input: { userId: string; memoryId: string; localUri: string }): Promise<string>;
  uploadMemoryAudio(input: { userId: string; memoryId: string; localUri: string }): Promise<string>;
}

export interface Repositories {
  places: PlaceRepository;
  memories: MemoryRepository;
  users: UserRepository;
  auth: AuthRepository;
  media: MediaRepository;
}
