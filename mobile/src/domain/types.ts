export type PrivacyType = 'public' | 'private' | 'tagged' | 'timeRelease' | 'community';
export type SentimentCategory = 'positive' | 'peaceful' | 'neutral' | 'mixed' | 'heavy';
export interface LatLng { latitude: number; longitude: number }
export interface SentimentResult { compound: number; positive: number; neutral: number; negative: number }
export interface AuraZone {
  dominantSentiment: SentimentCategory;
  compoundScore: number;
  intensity: number;
  memoryCount: number;
  colorHex: string;
  updatedAt: Date;
}
export interface Memory {
  id: string;
  userId: string;
  placeId: string;
  imageUrl: string | null;
  audioUrl: string | null;
  textContent: string;
  latitude: number;
  longitude: number;
  geohash: string;
  sentiment: SentimentResult;
  privacy: PrivacyType;
  taggedUserIds: string[];
  communityId: string | null;
  releaseDate: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geohash: string;
  communityId: string | null;
  custodianIds: string[];
  aura: AuraZone;
  memoryCount: number;
  publicMemoryCount: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface AppUser {
  id: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  defaultPrivacy: PrivacyType;
  managedPlaceIds: string[];
  communityIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
export interface AuthSession { userId: string; email: string; displayName: string | null }
