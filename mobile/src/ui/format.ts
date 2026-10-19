export const formatCount = (n: number) => (n === 1 ? '1 memory' : `${n} memories`);

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
