import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { OWNER_CANNOT_LEAVE, TIMEOUT_ERROR } from '@/data/errors';
import { testServices } from '@/device/fakes';
import type { Memory } from '@/domain/types';
import { PlaceScreen } from '@/features/places/PlaceScreen';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { CommunityScreen } from './CommunityScreen';
import { ERA, joinTimeCommunities, signIn, WALKERS, YEAR } from './testCommunities';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

const FEED_EMPTY = 'No memories shared with this community yet.';
const WALKERS_MEMORY = 'Our walkers group met at the bandstand today. Great energy, lovely people.';

async function setup(id: string, services: Services = testServices(), prepare?: (s: Services) => Promise<void>) {
  await signIn(services);
  await prepare?.(services);
  await render(
    <ServicesProvider services={services}>
      <BlocksProvider>
        <CommunityScreen communityId={id} />
      </BlocksProvider>
    </ServicesProvider>,
  );
  return services;
}

/** A community memory by Asha next to the demo user's own one (memory-4). */
async function feedWithAsha(services: Services): Promise<Memory[]> {
  const own = (await services.repos.memories.findById('memory-4'))!;
  const asha: Memory = { ...own, id: 'memory-asha', userId: 'user-asha', textContent: 'Asha at the bandstand.' };
  return [asha, own];
}

function confirmWith(label: string) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.text === label)?.onPress?.();
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('CommunityScreen', () => {
  it('shows the header, type, member count, owner and the feed', async () => {
    await setup(WALKERS);
    expect(await screen.findByRole('header', { name: 'Cubbon Park Walkers' })).toBeOnTheScreen();
    expect(screen.getByText('Morning walks around Cubbon Park.')).toBeOnTheScreen();
    expect(screen.getByText('Interest')).toBeOnTheScreen();
    expect(screen.getByText('1 member')).toBeOnTheScreen();
    expect(await screen.findByText('Owned by Demo Custodian')).toBeOnTheScreen();
    expect(await screen.findByTestId('memory-memory-4')).toBeOnTheScreen();
    expect(screen.getByText(WALKERS_MEMORY)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  });

  it('owners cannot leave: no confirm, no call, owner copy', async () => {
    const services = testServices();
    const leave = jest.spyOn(services.repos.communities, 'leave');
    const alert = jest.spyOn(Alert, 'alert');
    await setup(WALKERS, services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Leave' }));
    expect(screen.getByText(OWNER_CANNOT_LEAVE)).toBeOnTheScreen();
    expect(alert).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('a system community shows no owner and any member may leave after confirming', async () => {
    const services = testServices();
    const leave = jest.spyOn(services.repos.communities, 'leave');
    const alert = confirmWith('Leave');
    await setup(YEAR, services, joinTimeCommunities);
    expect(await screen.findByRole('header', { name: '2026 Memories' })).toBeOnTheScreen();
    expect(screen.getByText('Time')).toBeOnTheScreen();
    expect(screen.queryByText(/^Owned by/)).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Leave' }));
    expect(alert).toHaveBeenCalledWith('Leave 2026 Memories?', 'You can join again any time.', [
      expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
      expect.objectContaining({ text: 'Leave', style: 'destructive' }),
    ]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join' })).toBeOnTheScreen());
    expect(leave).toHaveBeenCalledWith(YEAR);
    expect(await screen.findByText('0 members')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
  });

  it('Cancel keeps the membership', async () => {
    const services = testServices();
    const leave = jest.spyOn(services.repos.communities, 'leave');
    confirmWith('Cancel');
    await setup(YEAR, services, joinTimeCommunities);
    await fireEvent.press(await screen.findByRole('button', { name: 'Leave' }));
    expect(leave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeOnTheScreen();
  });

  it("shows the server's owner copy when leave is refused", async () => {
    const services = testServices();
    jest.spyOn(services.repos.communities, 'leave').mockRejectedValue(new Error(OWNER_CANNOT_LEAVE));
    confirmWith('Leave');
    await setup(YEAR, services, joinTimeCommunities);
    await fireEvent.press(await screen.findByRole('button', { name: 'Leave' }));
    expect(await screen.findByText(OWNER_CANNOT_LEAVE)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leave' })).toBeOnTheScreen();
  });

  it('joins a community', async () => {
    const services = testServices();
    const join = jest.spyOn(services.repos.communities, 'join');
    await setup(ERA, services, joinTimeCommunities);
    expect(await screen.findByText('0 members')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Invite' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Leave' })).toBeOnTheScreen());
    expect(join).toHaveBeenCalledWith(ERA);
    expect(await screen.findByText('1 member')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Invite' })).toBeOnTheScreen();
  });

  it('shows the timeout copy when joining offline', async () => {
    const services = testServices();
    jest.spyOn(services.repos.communities, 'join').mockRejectedValue(new Error(TIMEOUT_ERROR));
    await setup(ERA, services, joinTimeCommunities);
    await fireEvent.press(await screen.findByRole('button', { name: 'Join' }));
    expect(await screen.findByText(TIMEOUT_ERROR)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Join' })).toBeOnTheScreen();
  });

  describe('Invite', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('sends invitations to the picked people', async () => {
      const services = testServices();
      const invite = jest.spyOn(services.repos.communities, 'invite');
      await setup(WALKERS, services);
      await fireEvent.press(await screen.findByRole('button', { name: 'Invite' }));
      const send = () => screen.getByRole('button', { name: 'Send invitations' });
      expect(send()).toBeDisabled();
      await fireEvent.changeText(screen.getByLabelText('Search people'), 'As');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(400);
      });
      await fireEvent.press(screen.getByTestId('person-user-asha'));
      await fireEvent.changeText(screen.getByLabelText('Search people'), 'Ro');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(400);
      });
      await fireEvent.press(screen.getByTestId('person-user-rohan'));
      await fireEvent.press(send());
      await waitFor(() => expect(invite).toHaveBeenCalledWith(WALKERS, ['user-asha', 'user-rohan']));
      expect(await screen.findByText('Invitations sent.')).toBeOnTheScreen();
      expect(screen.queryByLabelText('Search people')).toBeNull();
    });

    it('sends once when Send is invoked twice in the same tick', async () => {
      const services = testServices();
      let release!: () => void;
      const invite = jest
        .spyOn(services.repos.communities, 'invite')
        .mockImplementation(() => new Promise<void>((r) => (release = r)));
      await setup(WALKERS, services);
      await fireEvent.press(await screen.findByRole('button', { name: 'Invite' }));
      await fireEvent.changeText(screen.getByLabelText('Search people'), 'As');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(400);
      });
      await fireEvent.press(screen.getByTestId('person-user-asha'));
      const send = screen.getByRole('button', { name: 'Send invitations' });
      await act(async () => {
        (send.props.onClick as () => void)();
        (send.props.onClick as () => void)();
      });
      expect(invite).toHaveBeenCalledTimes(1);
      await act(async () => release());
    });

    it('keeps the picks and shows the timeout copy when offline', async () => {
      const services = testServices();
      jest.spyOn(services.repos.communities, 'invite').mockRejectedValue(new Error(TIMEOUT_ERROR));
      await setup(WALKERS, services);
      await fireEvent.press(await screen.findByRole('button', { name: 'Invite' }));
      await fireEvent.changeText(screen.getByLabelText('Search people'), 'As');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(400);
      });
      await fireEvent.press(screen.getByTestId('person-user-asha'));
      await fireEvent.press(screen.getByRole('button', { name: 'Send invitations' }));
      expect(await screen.findByText(TIMEOUT_ERROR)).toBeOnTheScreen();
      expect(screen.getByTestId('chip-user-asha')).toBeOnTheScreen();
    });
  });

  it('shows the empty feed copy', async () => {
    await setup(ERA, testServices(), joinTimeCommunities);
    expect(await screen.findByText(FEED_EMPTY)).toBeOnTheScreen();
  });

  it("shows feed error copy when the feed fails", async () => {
    const services = testServices();
    jest.spyOn(services.repos.communities, 'subscribeFeed').mockImplementation((_id, _v, _cb, onError) => {
      onError?.(new Error('denied'));
      return () => {};
    });
    await setup(WALKERS, services);
    expect(await screen.findByText("Couldn't load memories.")).toBeOnTheScreen();
    expect(screen.queryByText(FEED_EMPTY)).toBeNull();
  });

  it('subscribes to the feed as a member only while a member', async () => {
    const services = testServices();
    const feed = jest.spyOn(services.repos.communities, 'subscribeFeed');
    await setup(WALKERS, services);
    await screen.findByTestId('memory-memory-4');
    expect(feed).toHaveBeenLastCalledWith(
      WALKERS,
      expect.objectContaining({ viewerId: 'user-demo', viewerCommunityIds: [WALKERS] }),
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('shows not-found copy for an unknown community', async () => {
    await setup('nope');
    expect(await screen.findByText('This community no longer exists.')).toBeOnTheScreen();
  });

  it('Back goes back', async () => {
    await setup(WALKERS);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows no feed memories until the block list has loaded', async () => {
    const services = testServices();
    let emit!: (ids: string[]) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, cb) => {
      emit = cb;
      return () => {};
    });
    await signIn(services);
    const memories = await feedWithAsha(services);
    jest.spyOn(services.repos.communities, 'subscribeFeed').mockImplementation((_id, _v, cb) => {
      cb(memories);
      return () => {};
    });
    await setup(WALKERS, services);
    expect(await screen.findByRole('header', { name: 'Cubbon Park Walkers' })).toBeOnTheScreen();
    expect(screen.queryByTestId(/^memory-/)).toBeNull();
    expect(screen.queryByText(FEED_EMPTY)).toBeNull();
    await act(async () => emit(['user-asha']));
    expect(screen.getByTestId('memory-memory-4')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-asha')).toBeNull();
  });
});

describe('Review focus', () => {
  it("hides blocked authors' memories on place and community feeds", async () => {
    const services = testServices();
    await signIn(services);
    await services.repos.safety.block('user-demo', 'user-asha', services.now());
    const memories = await feedWithAsha(services);
    jest.spyOn(services.repos.communities, 'subscribeFeed').mockImplementation((_id, _v, cb) => {
      cb(memories);
      return () => {};
    });

    // Place feed: memory-6 at Vidhana Soudha is Asha's.
    const place = await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <PlaceScreen placeId="place-2" />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByTestId('memory-memory-7')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-6')).toBeNull();
    await place.unmount();

    // Community feed: Asha's community memory is hidden, the viewer's own one stays.
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <CommunityScreen communityId={WALKERS} />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByTestId('memory-memory-4')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-asha')).toBeNull();
    expect(screen.queryByText('Asha at the bandstand.')).toBeNull();

    // Unblocking shows it again: the filter is the live block list, not a one-off.
    await act(async () => {
      await services.repos.safety.unblock('user-demo', 'user-asha');
    });
    expect(await screen.findByTestId('memory-memory-asha')).toBeOnTheScreen();
  });

  it('reports the community from the Report community action', async () => {
    const services = testServices();
    const report = jest.spyOn(services.repos.safety, 'reportContent');
    await setup(ERA, services, async (s) => {
      await joinTimeCommunities(s);
      const real = await s.repos.communities.findById(ERA);
      jest.spyOn(s.repos.communities, 'findById').mockResolvedValue({ ...real!, ownerId: 'user-asha', type: 'thematic' });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Report community' }));
    expect(screen.getByText('Why are you reporting this?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Spam' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText("Thanks — we'll review it.")).toBeOnTheScreen();
    expect(report).toHaveBeenCalledWith({ targetType: 'community', targetId: ERA, reason: 'spam', note: null });
  });

  it('shows a membership error with Retry and never Join, then recovers', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const services = testServices();
    const real = services.repos.communities.subscribeMembership.bind(services.repos.communities);
    let failing = true;
    const subscribe = jest
      .spyOn(services.repos.communities, 'subscribeMembership')
      .mockImplementation((id, uid, cb, onError) => {
        if (failing) {
          onError?.(new Error('denied'));
          return () => {};
        }
        return real(id, uid, cb, onError);
      });
    await setup(WALKERS, services);
    expect(await screen.findByText("Couldn't check your membership.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
    failing = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Leave' })).toBeOnTheScreen();
    expect(screen.queryByText("Couldn't check your membership.")).toBeNull();
    expect(subscribe).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });


  it('offers no Report community to the owner', async () => {
    await setup(WALKERS);
    await screen.findByRole('button', { name: 'Leave' });
    expect(screen.queryByRole('button', { name: 'Report community' })).toBeNull();
  });

  it('offers no Report community on a system-owned community', async () => {
    await setup(YEAR, testServices(), joinTimeCommunities);
    await screen.findByRole('button', { name: 'Leave' });
    expect(screen.queryByRole('button', { name: 'Report community' })).toBeNull();
  });

  it('offers no Report community on an institution community', async () => {
    const services = testServices();
    await setup(WALKERS, services, async (s) => {
      const real = await s.repos.communities.findById(WALKERS);
      jest
        .spyOn(s.repos.communities, 'findById')
        .mockResolvedValue({ ...real!, ownerId: 'user-asha', type: 'institution', institutionId: 'inst-1' });
    });
    await screen.findByRole('header', { name: 'Cubbon Park Walkers' });
    expect(screen.queryByRole('button', { name: 'Report community' })).toBeNull();
  });
});
