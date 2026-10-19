const NAME_MAX = 15;

export function orbLabel(orb: { text: string; media: 'photo' | 'voice note' | null }): string {
  const text = orb.text.trim();
  if (text) return `Memory: ${text.slice(0, 40)}`;
  return orb.media ? `Memory: ${orb.media}` : 'Memory';
}

export function truncateName(name: string): string {
  return name.length > NAME_MAX ? `${name.slice(0, NAME_MAX).trimEnd()}…` : name;
}
