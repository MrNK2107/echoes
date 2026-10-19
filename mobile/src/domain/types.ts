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
  /** Server-written: reportMemory sets 'hidden' after 3 distinct reporters (ADR-0008). */
  moderation: 'hidden' | null;
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
  notificationPrefs: NotificationPrefs;
  acceptedTermsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
/** users/{uid}.notificationPrefs; a missing pref means enabled. */
export interface NotificationPrefs { transfers: boolean; tags: boolean; communityInvites: boolean }
/** publicProfiles/{uid}: the only user data other people can read. */
export interface PublicProfile { id: string; displayName: string }
export type NotificationType =
  | 'memoryTagged'
  | 'transferRequest'
  | 'transferAccepted'
  | 'transferRejected'
  | 'communityInvite';
/** users/{uid}/notifications/{id}, written by the server (functions/lib/notify.js). */
export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Who caused it; null for system notifications and docs older than Plan 5. */
  actorId: string | null;
  title: string;
  body: string;
  /** Ids only (memoryId, placeId, transferId, communityId…). */
  data: Record<string, string>;
  createdAt: Date;
  readAt: Date | null;
}
/** The reportMemory callable's reasons (functions/safety.js REASONS). */
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'other';
export interface AuthSession { userId: string; email: string; displayName: string | null }
export type CommunityType = 'geographic' | 'thematic' | 'timeBased' | 'institution';
export type CommunityRole = 'owner' | 'guardian' | 'member';
/**
 * communities/{id}, written only by callables and onMemoryWritten (ADR-0007). Auto communities
 * (time-, era-, geo-, inst-) are owned by 'system' (R25).
 */
export interface Community {
  id: string;
  name: string;
  description: string;
  type: CommunityType;
  ownerId: string;
  placeId: string | null;
  institutionId: string | null;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}
/** communities/{id}/members/{uid}. */
export interface CommunityMembership { role: CommunityRole; joinedAt: Date }
export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'revoked' | 'expired';
/** transfers/{id}: a custodianship request (functions/transfers.js). */
export interface Transfer {
  id: string;
  placeId: string;
  fromUserId: string;
  toUserId: string;
  status: TransferStatus;
  createdAt: Date;
  respondedAt: Date | null;
  /** createdAt + 7 days: the sender may revoke until then. */
  revokeUntil: Date;
}
export interface SubZone { id: string; name: string; latitude: number; longitude: number; radiusMeters: number }
/** institutions/{id} (functions/institutions.js). */
export interface Institution {
  id: string;
  name: string;
  allowedEmailDomains: string[];
  subZones: SubZone[];
  communityId: string | null;
}
/** places/{id}/auraHistory/{entryId}, appended on every aggregate recompute. */
export interface AuraHistoryEntry { id: string; aura: AuraZone; recordedAt: Date }
/** The signed-in account as the server sees it (ID token claims). */
export interface AccountStatus { email: string; emailVerified: boolean; staff: boolean }
