import { act, screen } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import type { Repositories } from '@/data/types';
import { testServices } from '@/device/fakes';
import { ArScreen } from '@/features/ar/ArScreen';
import { CommunityScreen } from '@/features/communities/CommunityScreen';
import { WALKERS } from '@/features/communities/testCommunities';
import { MapScreen } from '@/features/map/MapScreen';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { PlaceScreen } from '@/features/places/PlaceScreen';
import type { Services } from '@/services/services';

import { renderWithServices } from './renderWithServices';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

/**
 * Wraps every `subscribe*` method of every repository and counts the unsubscribes not yet called.
 * Each screen is rendered through renderWithServices, so the BlocksProvider's one subscribeBlocks
 * subscription counts inside every budget (the map also counts InboxBell's notifications subscription;
 * PushBridge lives in the (app) layout and is not rendered).
 */
export function countingRepos(repos: Repositories): { repos: Repositories; open(): number } {
  let open = 0;
  const wrapped: Record<string, unknown> = {};
  for (const [name, repo] of Object.entries(repos)) {
    const copy: Record<string, unknown> = { ...(repo as object) };
    for (const [key, fn] of Object.entries(copy)) {
      if (!key.startsWith('subscribe') || typeof fn !== 'function') continue;
      copy[key] = (...args: unknown[]) => {
        open += 1;
        const unsub = (fn as (...a: unknown[]) => () => void).apply(repo, args);
        let done = false;
        return () => {
          if (!done) {
            done = true;
            open -= 1;
          }
          unsub();
        };
      };
    }
    wrapped[name] = copy;
  }
  return { repos: wrapped as unknown as Repositories, open: () => open };
}

async function seeded(): Promise<{ services: Services; counter: ReturnType<typeof countingRepos> }> {
  const base = testServices();
  await act(async () => {
    await base.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  const counter = countingRepos(base.repos);
  return { services: { ...base, repos: counter.repos }, counter };
}

function firstPlaceId(services: Services): string {
  let id = '';
  services.repos.places.subscribeNearby(
    { center: { latitude: 12.9716, longitude: 77.5946 }, radiusMeters: 1500 },
    (p) => (id = p[0]!.id),
  )();
  return id;
}

const settle = () => act(async () => {});

describe('countingRepos', () => {
  it('counts subscriptions until each unsubscribe is called once', async () => {
    const { services, counter } = await seeded();
    const a = services.repos.notifications.subscribe('u', () => {});
    const b = services.repos.safety.subscribeBlocks('u', () => {});
    expect(counter.open()).toBe(2);
    a();
    a();
    expect(counter.open()).toBe(1);
    b();
    expect(counter.open()).toBe(0);
  });
});

describe('listener budgets (memory backend)', () => {
  it('Map <= 4 and 0 open after unmount', async () => {
    const { services, counter } = await seeded();
    const view = await renderWithServices(
      services,
      <OutboxProvider userId="user-demo">
        <MapScreen />
      </OutboxProvider>,
    );
    await settle();
    expect(counter.open()).toBeGreaterThan(0);
    expect(counter.open()).toBeLessThanOrEqual(4);
    await view.unmount();
    expect(counter.open()).toBe(0);
  });

  it('Place <= 4 and 0 open after unmount', async () => {
    const { services, counter } = await seeded();
    const view = await renderWithServices(services, <PlaceScreen placeId={firstPlaceId(services)} />);
    await settle();
    expect(counter.open()).toBeGreaterThan(0);
    expect(counter.open()).toBeLessThanOrEqual(4);
    await view.unmount();
    expect(counter.open()).toBe(0);
  });

  it('Community <= 4 and 0 open after unmount', async () => {
    const { services, counter } = await seeded();
    const view = await renderWithServices(services, <CommunityScreen communityId={WALKERS} />);
    expect(await screen.findByRole('header', { name: 'Cubbon Park Walkers' })).toBeOnTheScreen();
    expect(counter.open()).toBeGreaterThan(0);
    expect(counter.open()).toBeLessThanOrEqual(4);
    await view.unmount();
    expect(counter.open()).toBe(0);
  });

  it('AR <= 7 and 0 open after unmount', async () => {
    const { services, counter } = await seeded();
    const view = await renderWithServices(services, <ArScreen />);
    await settle();
    expect(counter.open()).toBeGreaterThan(0);
    expect(counter.open()).toBeLessThanOrEqual(7);
    await view.unmount();
    expect(counter.open()).toBe(0);
  });
});
