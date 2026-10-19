import { Timestamp, type DocumentData } from 'firebase/firestore';
import { normalizeName } from '../domain/communities';
import { DEFAULT_NOTIFICATION_PREFS } from '../domain/profiles';
import type {
  AppNotification,
  AppUser,
  AuraHistoryEntry,
  AuraZone,
  Community,
  CommunityMembership,
  CommunityRole,
  CommunityType,
  Institution,
  Memory,
  NotificationPrefs,
  NotificationType,
  Place,
  PrivacyType,
  PublicProfile,
  SentimentCategory,
  SentimentResult,
  SubZone,
  Transfer,
  TransferStatus,
} from '../domain/types';

export function toDate(v: Timestamp | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return new Date(v);
  return v.toDate();
}

function requiredDate(v: unknown, field: string): Date {
  const d = toDate(v as Timestamp | string | null | undefined);
  if (d === null) throw new Error(`Missing Firestore date: ${field}`);
  return d;
}

function optStr(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function ts(d: Date | null): Timestamp | null {
  return d === null ? null : Timestamp.fromDate(d);
}

function sentimentFromDoc(d: DocumentData): SentimentResult {
  return {
    compound: Number(d.compound),
    positive: Number(d.positive),
    neutral: Number(d.neutral),
    negative: Number(d.negative),
  };
}

export function memoryToDoc(m: Memory): DocumentData {
  return {
    userId: m.userId,
    placeId: m.placeId,
    imageUrl: m.imageUrl,
    audioUrl: m.audioUrl,
    textContent: m.textContent,
    latitude: m.latitude,
    longitude: m.longitude,
    geohash: m.geohash,
    sentiment: {
      compound: m.sentiment.compound,
      positive: m.sentiment.positive,
      neutral: m.sentiment.neutral,
      negative: m.sentiment.negative,
    },
    privacy: m.privacy,
    taggedUserIds: m.taggedUserIds,
    communityId: m.communityId,
    releaseDate: ts(m.releaseDate),
    isDeleted: m.isDeleted,
    deletedAt: ts(m.deletedAt),
    // Server-written (reportMemory sets 'hidden'); firestore.rules requires null on create, which
    // is the only write this mapper is used for.
    moderation: null,
    createdAt: Timestamp.fromDate(m.createdAt),
    updatedAt: Timestamp.fromDate(m.updatedAt),
  };
}

export function memoryFromDoc(id: string, d: DocumentData): Memory {
  return {
    id,
    userId: d.userId as string,
    placeId: d.placeId as string,
    imageUrl: optStr(d.imageUrl),
    audioUrl: optStr(d.audioUrl),
    textContent: d.textContent as string,
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
    geohash: d.geohash as string,
    sentiment: sentimentFromDoc(d.sentiment as DocumentData),
    privacy: d.privacy as PrivacyType,
    taggedUserIds: [...((d.taggedUserIds as string[] | undefined) ?? [])],
    communityId: optStr(d.communityId),
    releaseDate: toDate(d.releaseDate as Timestamp | string | null | undefined),
    isDeleted: d.isDeleted as boolean,
    deletedAt: toDate(d.deletedAt as Timestamp | string | null | undefined),
    moderation: d.moderation === 'hidden' ? 'hidden' : null,
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    updatedAt: requiredDate(d.updatedAt, 'updatedAt'),
  };
}

function auraToDoc(a: AuraZone): DocumentData {
  return {
    dominantSentiment: a.dominantSentiment,
    compoundScore: a.compoundScore,
    intensity: a.intensity,
    memoryCount: a.memoryCount,
    colorHex: a.colorHex,
    updatedAt: a.updatedAt.toISOString(),
  };
}

function auraFromDoc(d: DocumentData): AuraZone {
  return {
    dominantSentiment: d.dominantSentiment as SentimentCategory,
    compoundScore: Number(d.compoundScore),
    intensity: Number(d.intensity),
    memoryCount: Number(d.memoryCount),
    colorHex: d.colorHex as string,
    updatedAt: requiredDate(d.updatedAt, 'aura.updatedAt'),
  };
}

export function placeToDoc(p: Place): DocumentData {
  return {
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    geohash: p.geohash,
    communityId: p.communityId,
    custodianIds: p.custodianIds,
    aura: auraToDoc(p.aura),
    memoryCount: p.memoryCount,
    publicMemoryCount: p.publicMemoryCount,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function placeFromDoc(id: string, d: DocumentData): Place {
  return {
    id,
    name: d.name as string,
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
    geohash: d.geohash as string,
    communityId: optStr(d.communityId),
    custodianIds: [...((d.custodianIds as string[] | undefined) ?? [])],
    aura: auraFromDoc(d.aura as DocumentData),
    memoryCount: Number(d.memoryCount),
    publicMemoryCount: Number(d.publicMemoryCount),
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    updatedAt: requiredDate(d.updatedAt, 'updatedAt'),
  };
}

export function notificationPrefsToDoc(p: NotificationPrefs): DocumentData {
  return { transfers: p.transfers, tags: p.tags, communityInvites: p.communityInvites };
}

function notificationPrefsFromDoc(d: unknown): NotificationPrefs {
  const p = (typeof d === 'object' && d !== null ? d : {}) as Record<string, unknown>;
  // A missing pref means enabled (functions/lib/notify.js only skips on an explicit false).
  const on = (k: keyof NotificationPrefs) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : DEFAULT_NOTIFICATION_PREFS[k]);
  return { transfers: on('transfers'), tags: on('tags'), communityInvites: on('communityInvites') };
}

export function userToDoc(u: AppUser): DocumentData {
  const doc: DocumentData = {
    displayName: u.displayName,
    email: u.email,
    photoUrl: u.photoUrl,
    defaultPrivacy: u.defaultPrivacy,
    managedPlaceIds: u.managedPlaceIds,
    communityIds: u.communityIds,
    notificationPrefs: notificationPrefsToDoc(u.notificationPrefs),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
  // The rules accept acceptedTermsAt only as a string, so an unknown value is left out.
  if (u.acceptedTermsAt !== null) doc.acceptedTermsAt = u.acceptedTermsAt.toISOString();
  return doc;
}

export function userFromDoc(id: string, d: DocumentData): AppUser {
  return {
    id,
    displayName: optStr(d.displayName),
    email: optStr(d.email),
    photoUrl: optStr(d.photoUrl),
    defaultPrivacy: d.defaultPrivacy as PrivacyType,
    managedPlaceIds: [...((d.managedPlaceIds as string[] | undefined) ?? [])],
    communityIds: [...((d.communityIds as string[] | undefined) ?? [])],
    notificationPrefs: notificationPrefsFromDoc(d.notificationPrefs),
    acceptedTermsAt: toDate(d.acceptedTermsAt as Timestamp | string | null | undefined),
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    updatedAt: requiredDate(d.updatedAt, 'updatedAt'),
  };
}

/**
 * publicProfiles/{uid}. `displayNameLower` is the search key; onPublicProfileWritten recomputes
 * it server-side, so this value only has to be right for the client's own immediate reads.
 */
export function profileToDoc(displayName: string, at: Date): DocumentData {
  const name = displayName.trim();
  return { displayName: name, displayNameLower: normalizeName(name), updatedAt: at.toISOString() };
}

export function profileFromDoc(id: string, d: DocumentData): PublicProfile {
  return { id, displayName: String(d.displayName) };
}

export function notificationFromDoc(id: string, d: DocumentData): AppNotification {
  const raw = (typeof d.data === 'object' && d.data !== null ? d.data : {}) as Record<string, unknown>;
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === 'string') data[k] = v;
  return {
    id,
    type: d.type as NotificationType,
    actorId: typeof d.actorId === 'string' ? d.actorId : null,
    title: String(d.title),
    body: String(d.body),
    data,
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    readAt: toDate(d.readAt as Timestamp | string | null | undefined),
  };
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** communities/{id}; server-written with ISO dates (functions/communities.js newCommunity). */
export function communityFromDoc(id: string, d: DocumentData): Community {
  return {
    id,
    name: String(d.name),
    description: String(d.description ?? ''),
    type: d.type as CommunityType,
    ownerId: String(d.ownerId),
    placeId: optStr(d.placeId),
    institutionId: optStr(d.institutionId),
    memberCount: Number(d.memberCount ?? 0),
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    updatedAt: requiredDate(d.updatedAt, 'updatedAt'),
  };
}

/** communities/{id}/members/{uid}: { userId, role, joinedAt }. */
export function membershipFromDoc(d: DocumentData): CommunityMembership {
  return { role: d.role as CommunityRole, joinedAt: requiredDate(d.joinedAt, 'joinedAt') };
}

/** transfers/{id}; `recipientWasCustodian` and `revokedAt` are server bookkeeping, not mapped. */
export function transferFromDoc(id: string, d: DocumentData): Transfer {
  return {
    id,
    placeId: String(d.placeId),
    fromUserId: String(d.fromUserId),
    toUserId: String(d.toUserId),
    status: d.status as TransferStatus,
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    respondedAt: toDate(d.respondedAt as string | null | undefined),
    revokeUntil: requiredDate(d.revokeUntil, 'revokeUntil'),
  };
}

function subZoneFromDoc(d: DocumentData): SubZone {
  return {
    id: String(d.id),
    name: String(d.name),
    latitude: Number(d.latitude),
    longitude: Number(d.longitude),
    radiusMeters: Number(d.radiusMeters),
  };
}

/** institutions/{id} (functions/institutions.js). */
export function institutionFromDoc(id: string, d: DocumentData): Institution {
  const zones: unknown[] = Array.isArray(d.subZones) ? d.subZones : [];
  return {
    id,
    name: String(d.name),
    allowedEmailDomains: strings(d.allowedEmailDomains),
    adminUserIds: strings(d.adminUserIds),
    subZones: zones
      .filter((z): z is DocumentData => typeof z === 'object' && z !== null)
      .map(subZoneFromDoc),
    communityId: optStr(d.communityId),
  };
}

/** places/{id}/auraHistory/{entryId}: { placeId, aura, recordedAt } (onMemoryWritten). */
export function auraHistoryFromDoc(id: string, d: DocumentData): AuraHistoryEntry {
  return {
    id,
    aura: auraFromDoc(d.aura as DocumentData),
    recordedAt: requiredDate(d.recordedAt, 'recordedAt'),
  };
}
