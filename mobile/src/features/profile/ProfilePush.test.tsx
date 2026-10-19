import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus, Text } from 'react-native';

import { GENERIC_ERROR } from '@/data/errors';

import { DEMO_USER } from '@/data/seed';
import { fakePush, testServices, type FakePush } from '@/device/fakes';
import { useSession } from '@/features/auth/useSession';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { PushBridge } from '@/features/push/PushBridge';
import { registerDevice } from '@/features/push/pushDevice';

import { ProfileScreen } from './ProfileScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }) }));
jest.mock('@/features/memories/compressImage', () => ({ compressImage: async (u: string) => u }));

function SessionProbe() {
  const { status } = useSession();
  return status === 'signedOut' ? <Text>signed-out-probe</Text> : null;
}

async function setup(push: FakePush, over: Partial<Services> = {}, bridge = true) {
  const services = testServices({ push, ...over });
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <BlocksProvider>
        <SessionProbe />
        {bridge ? <PushBridge uid="user-demo" /> : null}
        <ProfileScreen />
      </BlocksProvider>
    </ServicesProvider>,
  );
  return services;
}

const ENABLE = 'Turn on push notifications';

describe('Profile push settings', () => {
  it('push is unavailable in Expo Go', async () => {
    const push = fakePush({ availability: 'expo-go' });
    await setup(push);
    expect(await screen.findByText('Push notifications need the ECHOES app build.')).toBeOnTheScreen();
    expect(screen.queryByText(ENABLE)).toBeNull();
    expect(push.calls).not.toContain('request');
  });

  it('push is unavailable on a simulator', async () => {
    await setup(fakePush({ availability: 'simulator' }));
    expect(await screen.findByText('Push notifications need the ECHOES app build.')).toBeOnTheScreen();
  });

  it('granting registers this device and shows the on state', async () => {
    const push = fakePush({ permission: 'undetermined', grant: 'granted', token: 'ExponentPushToken[abc]' });
    const services = await setup(push);
    await fireEvent.press(await screen.findByText(ENABLE));
    expect(await screen.findByText('Push notifications are on')).toBeOnTheScreen();
    const stored = await services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]');
    expect(stored?.lastSeenAt).toEqual(services.now());
  });

  it('shows the on state without prompting when permission is already granted, and registers', async () => {
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const services = await setup(push);
    expect(await screen.findByText('Push notifications are on')).toBeOnTheScreen();
    expect(push.calls).not.toContain('request');
    await waitFor(async () =>
      expect(await services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]')).not.toBeNull(),
    );
  });

  it('denying shows the blocked copy and Open settings opens system settings', async () => {
    const push = fakePush({ permission: 'undetermined', grant: 'denied' });
    await setup(push);
    await fireEvent.press(await screen.findByText(ENABLE));
    expect(await screen.findByText('Push notifications are blocked in system settings.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Open settings'));
    expect(push.calls).toContain('openSettings');
  });

  it('shows the blocked copy when permission was denied earlier', async () => {
    await setup(fakePush({ permission: 'denied' }));
    expect(await screen.findByText('Push notifications are blocked in system settings.')).toBeOnTheScreen();
  });

  it('sign-out unregisters the device token', async () => {
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const services = await setup(push);
    await screen.findByText('Push notifications are on');
    await waitFor(async () =>
      expect(await services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]')).not.toBeNull(),
    );
    await fireEvent.press(screen.getByText('Sign out'));
    expect(await screen.findByText('signed-out-probe')).toBeOnTheScreen();
    expect(await services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]')).toBeNull();
  });

  it('sign-out still happens when unregistering fails', async () => {
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const base = testServices();
    const repos = {
      ...base.repos,
      pushTokens: { ...base.repos.pushTokens, unregister: jest.fn().mockRejectedValue(new Error('offline')) },
    };
    await setup(push, { repos });
    await screen.findByText('Push notifications are on');
    await fireEvent.press(screen.getByText('Sign out'));
    expect(await screen.findByText('signed-out-probe')).toBeOnTheScreen();
    expect(repos.pushTokens.unregister).toHaveBeenCalled();
  });

  it('sign-out unregisters the device token after a relaunch', async () => {
    // The token is already stored and nothing registered it in this process (no bridge, empty cache).
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const base = testServices();
    await base.repos.pushTokens.register('user-demo', 'ExponentPushToken[abc]', 'android', base.now());
    const services = await setup(push, { repos: base.repos }, false);
    await screen.findByText('Push notifications are on');
    await fireEvent.press(screen.getByText('Sign out'));
    expect(await screen.findByText('signed-out-probe')).toBeOnTheScreen();
    expect(await services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]')).toBeNull();
  });

  it('pressing Turn on push notifications twice asks once', async () => {
    const push = fakePush({ permission: 'undetermined', grant: 'granted' });
    let answer: (r: 'granted' | 'denied') => void = () => {};
    let asked = 0;
    push.request = () => {
      asked += 1;
      return new Promise((r) => (answer = r));
    };
    await setup(push);
    const button = await screen.findByText(ENABLE);
    await fireEvent.press(button);
    await fireEvent.press(button);
    expect(asked).toBe(1);
    await act(async () => {
      answer('granted');
    });
    expect(await screen.findByText('Push notifications are on')).toBeOnTheScreen();
  });

  it('shows the generic error when registering fails after granting', async () => {
    const push = fakePush({ permission: 'undetermined', grant: 'granted' });
    const base = testServices();
    const repos = {
      ...base.repos,
      pushTokens: { ...base.repos.pushTokens, register: jest.fn().mockRejectedValue(new Error('nope')) },
    };
    await setup(push, { repos });
    await fireEvent.press(await screen.findByText(ENABLE));
    expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
  });

  it('re-checks permission when the app becomes active and registers once granted in settings', async () => {
    let onChange: ((s: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as (s: AppStateStatus) => void;
      return { remove: jest.fn() };
    });
    const push = fakePush({ permission: 'denied', token: 'ExponentPushToken[abc]' });
    const services = await setup(push, {}, false);
    expect(await screen.findByText('Push notifications are blocked in system settings.')).toBeOnTheScreen();
    push.setPermission('granted');
    await act(async () => {
      onChange?.('active');
    });
    expect(await screen.findByText('Push notifications are on')).toBeOnTheScreen();
    await waitFor(async () =>
      expect(await services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]')).not.toBeNull(),
    );
  });
});

describe('Profile push re-grant within the throttle window', () => {
  /** Keeps every 'change' handler (PushBridge and ProfileScreen both listen), like the real AppState. */
  const hook = () => {
    const handlers: ((s: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, h) => {
      if (type === 'change') handlers.push(h as (s: AppStateStatus) => void);
      return { remove: jest.fn() };
    });
    return (s: AppStateStatus) => act(async () => handlers.forEach((h) => h(s)));
  };

  it('enabling after the permission was reset registers again', async () => {
    const emit = hook();
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const services = await setup(push, {}, false);
    await screen.findByText('Push notifications are on');
    await registerDevice(services, 'user-demo');
    const register = jest.spyOn(services.repos.pushTokens, 'register');
    push.setPermission('undetermined');
    await emit('active');
    await fireEvent.press(await screen.findByText(ENABLE));
    await screen.findByText('Push notifications are on');
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  });

  it('a permission re-granted in settings registers again within the window', async () => {
    const emit = hook();
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const services = await setup(push, {}, false);
    await registerDevice(services, 'user-demo');
    const register = jest.spyOn(services.repos.pushTokens, 'register');
    push.setPermission('denied');
    await emit('active');
    await screen.findByText('Push notifications are blocked in system settings.');
    push.setPermission('granted');
    await emit('active');
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  });

  it('with PushBridge and ProfileScreen both listening, the forced re-grant still registers', async () => {
    const emit = hook();
    const push = fakePush({ permission: 'granted', token: 'ExponentPushToken[abc]' });
    const services = await setup(push, {}, true);
    await waitFor(() => expect(services.repos.pushTokens.get('user-demo', 'ExponentPushToken[abc]')).resolves.not.toBeNull());
    await screen.findByText('Push notifications are on');
    const register = jest.spyOn(services.repos.pushTokens, 'register');
    push.setPermission('denied');
    await emit('active');
    await screen.findByText('Push notifications are blocked in system settings.');
    push.setPermission('granted');
    await emit('active');
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
  });
});
