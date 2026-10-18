import type { AppUser, AuthSession, LatLng, Memory, Place } from '@/domain/types';

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
}

export interface UserRepository {
  get(id: string): Promise<AppUser | null>;
  create(user: AppUser): Promise<void>;
}

export interface AuthRepository {
  subscribe(cb: (s: AuthSession | null) => void): Unsubscribe;
  signIn(email: string, password: string): Promise<AuthSession>;
  register(email: string, password: string, displayName: string): Promise<AuthSession>;
  signOut(): Promise<void>;
}

export interface MediaRepository {
  uploadMemoryImage(input: { userId: string; memoryId: string; localUri: string }): Promise<string>;
}

export interface Repositories {
  places: PlaceRepository;
  memories: MemoryRepository;
  users: UserRepository;
  auth: AuthRepository;
  media: MediaRepository;
}
