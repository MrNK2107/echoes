import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { expoPush } from './expoPush';
import { unavailablePush } from './unavailablePush';

jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null, executionEnvironment: 'standalone', expoConfig: {} },
  ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
}));
jest.mock('expo-notifications', () => {
  throw new Error('expo-notifications must not load when push is unavailable');
});

const constants = Constants as unknown as { appOwnership: string | null; expoConfig: unknown; executionEnvironment: string };

function configure(over: { appOwnership?: string | null; projectId?: string | null; isDevice?: boolean }) {
  constants.appOwnership = over.appOwnership ?? null;
  constants.executionEnvironment = 'standalone';
  constants.expoConfig = over.projectId === null ? {} : { extra: { eas: { projectId: over.projectId ?? 'p-1' } } };
  (Device as { isDevice: boolean }).isDevice = over.isDevice ?? true;
}

describe('expoPush availability', () => {
  it('push is unavailable in Expo Go', async () => {
    configure({ appOwnership: 'expo' });
    expect(expoPush.availability()).toBe('expo-go');
    expect(await expoPush.permission()).toBe('undetermined');
    expect(await expoPush.request()).toBe('denied');
    expect(await expoPush.token()).toBeNull();
    expect(expoPush.onResponse(() => {})).toEqual(expect.any(Function));
  });

  it('treats a missing EAS project id as unavailable', () => {
    configure({ projectId: null });
    expect(expoPush.availability()).toBe('expo-go');
  });

  it('reports a simulator', () => {
    configure({ isDevice: false });
    expect(expoPush.availability()).toBe('simulator');
  });

  it('is available on a real device in a development build', () => {
    configure({});
    expect(expoPush.availability()).toBe('available');
  });
});

describe('unavailablePush (demo mode)', () => {
  it('reports the unavailable copy state and never requests', async () => {
    expect(unavailablePush.availability()).toBe('expo-go');
    expect(await unavailablePush.token()).toBeNull();
  });
});
