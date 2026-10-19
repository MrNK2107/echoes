export const PLACE_HIT = 44;
/** Orb hit boxes are smaller than 44pt so neighbours and the place target never overlap. */
export const ORB_HIT = 24;
export const ORB_DOT = 16;
const NAME_MAX = 15;

/**
 * Orbs sit on a ring around the place. The ring is wide enough that no two square hit boxes
 * overlap (centres at least hit*sqrt2 apart) and none touches the place's own box.
 */
export function orbLayout(
  auraPx: number,
  count: number,
): { ring: number; hit: number; orbs: { dx: number; dy: number }[] } {
  const hit = ORB_HIT;
  const fromPlace = ((PLACE_HIT + hit) / 2) * Math.SQRT2;
  const fromNeighbour = count > 1 ? (hit * Math.SQRT2) / 2 / Math.sin(Math.PI / count) : 0;
  const ring = Math.ceil(Math.max(auraPx + 14, 44, fromPlace, fromNeighbour)) + 1;
  const orbs = Array.from({ length: count }, (_, i) => {
    const a = (2 * Math.PI * i) / count;
    return { dx: ring * Math.sin(a), dy: -ring * Math.cos(a) };
  });
  return { ring, hit, orbs };
}

export function orbLabel(orb: { text: string; media: 'photo' | 'voice note' | null }): string {
  const text = orb.text.trim();
  if (text) return `Memory: ${text.slice(0, 40)}`;
  return orb.media ? `Memory: ${orb.media}` : 'Memory';
}

export function truncateName(name: string): string {
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX).trimEnd()}…` : name;
}
