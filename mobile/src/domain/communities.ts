export const GEO_THRESHOLD = 5;

export interface CommunityIdentity {
  id: string;
  name: string;
}

export function normalizeName(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase();
}

export function searchRange(q: string): { start: string; end: string } | null {
  const start = normalizeName(q);
  if ([...start].length < 2) return null;
  return { start, end: start + '' };
}

export function yearCommunity(createdAt: Date): CommunityIdentity {
  const y = createdAt.getUTCFullYear();
  return { id: `time-${y}`, name: `${y} Memories` };
}

export function eraCommunity(createdAt: Date): CommunityIdentity {
  const d = Math.floor(createdAt.getUTCFullYear() / 10) * 10;
  return { id: `era-${d}s`, name: `${d}s Era` };
}

export function geoCommunity(place: { id: string; name: string }): CommunityIdentity {
  return { id: `geo-${place.id}`, name: `${place.name} Circle` };
}
