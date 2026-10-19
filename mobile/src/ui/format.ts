export const formatCount = (n: number) => (n === 1 ? '1 memory' : `${n} memories`);

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
