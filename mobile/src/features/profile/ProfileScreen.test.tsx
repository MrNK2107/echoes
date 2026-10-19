import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import type { Memory } from '@/domain/types';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { AddMemoryScreen } from '@/features/memories/AddMemoryScreen';
import { useSession } from '@/features/auth/useSession';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { ProfileScreen } from './ProfileScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }) }));
jest.mock('@/features/memories/compressImage', () => ({ compressImage: async (u: string) => u }));

function SessionProbe() {
  const { status } = useSession();
  return status === 'signedOut' ? <Text>signed-out-probe</Text> : null;
}

async function setup(services: Services = testServices()) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <SessionProbe />
      <ProfileScreen />
    </ServicesProvider>,
  );
  return services;
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('ProfileScreen', () => {
  it('shows name, email, live memory count and only own memories', async () => {
    const services = await setup();
    expect(screen.getByText('Profile')).toBeOnTheScreen();
    expect(await screen.findByText(DEMO_USER.displayName)).toBeOnTheScreen();
    expect(screen.getByText(DEMO_USER.email)).toBeOnTheScreen();
    let own: Memory[] = [];
    services.repos.memories.subscribeForUser('user-demo', (m) => (own = m))();
    expect(own.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(String(own.length))).toBeOnTheScreen());
    expect(screen.getByText('Memories')).toBeOnTheScreen();
    expect(screen.getByText('Your memories')).toBeOnTheScreen();
    for (const m of own) expect(screen.getByTestId(`memory-${m.id}`)).toBeOnTheScreen();
  });

  it('falls back to ECHOES custodian when there is no display name', async () => {
    const services = testServices();
    const get = services.repos.users.get.bind(services.repos.users);
    jest.spyOn(services.repos.users, 'get').mockImplementation(async (id) => {
      const u = await get(id);
      return u && { ...u, displayName: null };
    });
    await setup(services);
    expect(await screen.findByText('ECHOES custodian')).toBeOnTheScreen();
  });

  it('shows ECHOES custodian for an empty display name', async () => {
    const services = testServices();
    const get = services.repos.users.get.bind(services.repos.users);
    jest.spyOn(services.repos.users, 'get').mockImplementation(async (id) => {
      const u = await get(id);
      return u && { ...u, displayName: '' };
    });
    await setup(services);
    expect(await screen.findByText('ECHOES custodian')).toBeOnTheScreen();
  });

  it('disables the default privacy control until the user has loaded', async () => {
    const services = testServices();
    jest.spyOn(services.repos.users, 'get').mockReturnValue(new Promise(() => {}));
    await setup(services);
    expect(screen.getByTestId('default-privacy-private').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows 50+ at the limit', async () => {
    const services = testServices();
    const sub = services.repos.memories.subscribeForUser.bind(services.repos.memories);
    jest.spyOn(services.repos.memories, 'subscribeForUser').mockImplementation((uid, cb, e) =>
      sub(uid, (ms) => cb(Array.from({ length: 50 }, (_, i) => ({ ...ms[0]!, id: `m${i}` }))), e),
    );
    await setup(services);
    expect(await screen.findByText('50+')).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    const services = testServices();
    jest.spyOn(services.repos.memories, 'subscribeForUser').mockImplementation((_u, cb) => {
      cb([]);
      return () => {};
    });
    await setup(services);
    expect(await screen.findByText('No memories yet.')).toBeOnTheScreen();
    expect(screen.getByText('Memories you leave will appear here.')).toBeOnTheScreen();
  });

  it('persists default privacy and AddMemoryScreen opens with Private selected', async () => {
    const services = await setup();
    await fireEvent.press(await screen.findByTestId('default-privacy-private'));
    await waitFor(async () => expect((await services.repos.users.get('user-demo'))?.defaultPrivacy).toBe('private'));
    expect(screen.getByTestId('default-privacy-private').props.accessibilityState).toMatchObject({ selected: true });
    await render(
      <ServicesProvider services={services}>
        <OutboxProvider userId="user-demo">
          <AddMemoryScreen />
        </OutboxProvider>
      </ServicesProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('privacy-private').props.accessibilityState).toMatchObject({ selected: true }),
    );
  });

  it('signs out', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Sign out'));
    expect(await screen.findByText('signed-out-probe')).toBeOnTheScreen();
  });

  it('navigates to recently deleted and delete account', async () => {
    await setup();
    await fireEvent.press(screen.getByText('Recently deleted'));
    expect(mockPush).toHaveBeenCalledWith('/recently-deleted');
    await fireEvent.press(screen.getByText('Delete account'));
    expect(mockPush).toHaveBeenCalledWith('/delete-account');
  });

  it('opens communities', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Communities' }));
    expect(mockPush).toHaveBeenCalledWith('/communities');
  });

  it('Back goes back', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  describe('display name', () => {
    it('prefills the public profile name', async () => {
      await setup();
      expect(screen.getByText('Display name')).toBeOnTheScreen();
      expect(await screen.findByDisplayValue(DEMO_USER.displayName)).toBeOnTheScreen();
    });

    it('rejects names outside 2 to 40 characters without saving', async () => {
      const services = testServices();
      const set = jest.spyOn(services.repos.profiles, 'setDisplayName');
      await setup(services);
      const input = await screen.findByDisplayValue(DEMO_USER.displayName);
      await fireEvent.changeText(input, ' A ');
      await fireEvent.press(screen.getByText('Save name'));
      expect(await screen.findByText('Use 2 to 40 characters.')).toBeOnTheScreen();
      await fireEvent.changeText(input, 'x'.repeat(41));
      await fireEvent.press(screen.getByText('Save name'));
      expect(screen.getByText('Use 2 to 40 characters.')).toBeOnTheScreen();
      expect(set).not.toHaveBeenCalled();
    });

    it('saves a trimmed name and shows it as the profile name', async () => {
      const services = await setup();
      const input = await screen.findByDisplayValue(DEMO_USER.displayName);
      await fireEvent.changeText(input, '  Kavya N  ');
      await fireEvent.press(screen.getByText('Save name'));
      expect(await screen.findByText('Kavya N')).toBeOnTheScreen();
      expect(await services.repos.profiles.get('user-demo')).toEqual({ id: 'user-demo', displayName: 'Kavya N' });
      expect(screen.queryByText('Use 2 to 40 characters.')).toBeNull();
    });

    it('shows generic copy when saving fails', async () => {
      const services = testServices();
      jest.spyOn(services.repos.profiles, 'setDisplayName').mockRejectedValue(new Error('boom'));
      await setup(services);
      await fireEvent.changeText(await screen.findByDisplayValue(DEMO_USER.displayName), 'Kavya');
      await fireEvent.press(screen.getByText('Save name'));
      expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
    });
  });

  describe('notification preferences', () => {
    it('shows the three toggles on by default', async () => {
      await setup();
      expect(screen.getByText('Notifications')).toBeOnTheScreen();
      for (const label of ['Custodianship requests', 'Tags', 'Community invitations']) {
        const sw = await screen.findByLabelText(label);
        await waitFor(() => expect(screen.getByLabelText(label).props.value).toBe(true));
        expect(sw).toBeOnTheScreen();
      }
    });

    it('persists a toggled preference and keeps the others', async () => {
      const services = await setup();
      await waitFor(() => expect(screen.getByLabelText('Tags').props.disabled).toBeFalsy());
      await fireEvent(screen.getByLabelText('Tags'), 'valueChange', false);
      await waitFor(async () =>
        expect((await services.repos.users.get('user-demo'))?.notificationPrefs).toEqual({
          transfers: true,
          tags: false,
          communityInvites: true,
        }),
      );
      expect(screen.getByLabelText('Tags').props.value).toBe(false);
    });

    it('rolls back only the failed toggle when two toggles are flipped quickly', async () => {
      const services = testServices();
      jest
        .spyOn(services.repos.users, 'updateNotificationPrefs')
        .mockRejectedValueOnce(new Error('x'))
        .mockResolvedValue(undefined);
      await setup(services);
      await waitFor(() => expect(screen.getByLabelText('Tags').props.disabled).toBeFalsy());
      await act(async () => {
        fireEvent(screen.getByLabelText('Tags'), 'valueChange', false);
        fireEvent(screen.getByLabelText('Custodianship requests'), 'valueChange', false);
      });
      await waitFor(() => expect(screen.getByLabelText('Tags').props.value).toBe(true));
      expect(screen.getByLabelText('Custodianship requests').props.value).toBe(false);
    });

    it('reverts and shows the generic error when saving fails', async () => {
      const services = testServices();
      jest.spyOn(services.repos.users, 'updateNotificationPrefs').mockRejectedValue(new Error('x'));
      await setup(services);
      await waitFor(() => expect(screen.getByLabelText('Community invitations').props.disabled).toBeFalsy());
      await fireEvent(screen.getByLabelText('Community invitations'), 'valueChange', false);
      expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
      expect(screen.getByLabelText('Community invitations').props.value).toBe(true);
    });
  });
});
