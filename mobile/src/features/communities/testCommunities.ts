import { act } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import type { Services } from '@/services/services';

export const WALKERS = 'community-cubbon-walkers';
/** Auto communities (owner 'system', R25) created by joinTimeCommunities below. */
export const YEAR = 'time-2026';
export const ERA = 'era-2020s';

export async function signIn(services: Services) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
}

/**
 * Creates a memory by the demo user, so onMemoryWritten (emulated) creates `era-2020s` and
 * `time-2026` and joins them to the year community as a plain member.
 */
export async function joinTimeCommunities(services: Services) {
  await act(async () => {
    const seed = await services.repos.memories.findById('memory-2');
    await services.repos.memories.create({ ...seed!, id: 'memory-new', createdAt: services.now() });
  });
}
