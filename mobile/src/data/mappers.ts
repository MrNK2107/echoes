import { Timestamp, type DocumentData } from 'firebase/firestore';
import type {
  AppUser,
  AuraZone,
  Memory,
  Place,
  PrivacyType,
  SentimentCategory,
  SentimentResult,
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
    // Server-written (reportMemory sets 'hidden'); firestore.rules requires null on create.
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

export function userToDoc(u: AppUser): DocumentData {
  return {
    displayName: u.displayName,
    email: u.email,
    photoUrl: u.photoUrl,
    defaultPrivacy: u.defaultPrivacy,
    managedPlaceIds: u.managedPlaceIds,
    communityIds: u.communityIds,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
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
    createdAt: requiredDate(d.createdAt, 'createdAt'),
    updatedAt: requiredDate(d.updatedAt, 'updatedAt'),
  };
}
