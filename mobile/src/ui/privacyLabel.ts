import type { Memory } from '@/domain/types';

const LABELS: Partial<Record<Memory['privacy'], string>> = {
  private: 'Private',
  tagged: 'Tagged',
  timeRelease: 'Time release',
  community: 'Community',
};

/** Badge text for a memory's privacy; public memories get no badge. */
export function privacyLabel(memory: Pick<Memory, 'privacy'>): string | null {
  return LABELS[memory.privacy] ?? null;
}
