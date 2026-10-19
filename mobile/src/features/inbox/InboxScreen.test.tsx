import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { INBOX_LOAD_ERROR } from '@/ui/copy';
import type { Transfer } from '@/data/types';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { InboxScreen } from './InboxScreen';
import { inboxServices, note } from './testInbox';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

async function setup(list: Parameters<typeof inboxServices>[0], prepare?: (s: Services) => void) {
  const s = await inboxServices(list);
  prepare?.(s.services);
  await render(
    <ServicesProvider services={s.services}>
      <InboxScreen />
    </ServicesProvider>,
  );
  return s;
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('InboxScreen', () => {
  it('lists notifications in the given (newest first) order with stored copy', async () => {
    await setup([
      note({ id: 'a', title: 'First title', body: 'First body' }),
      note({ id: 'b', title: 'Second title', body: 'Second body', readAt: new Date() }),
    ]);
    expect(screen.getByText('Notifications')).toBeOnTheScreen();
    const rows = await screen.findAllByTestId(/^notification-/);
    expect(rows.map((r) => r.props.testID)).toEqual(['notification-a', 'notification-b']);
    expect(screen.getByText('First body')).toBeOnTheScreen();
    expect(screen.getByText('Second title')).toBeOnTheScreen();
  });

  it('exposes unread state in the row label', async () => {
    await setup([
      note({ id: 'a', title: 'T1', body: 'B1' }),
      note({ id: 'b', title: 'T2', body: 'B2', readAt: new Date() }),
    ]);
    expect(await screen.findByLabelText('Unread. T1. B1')).toBeOnTheScreen();
    expect(screen.getByLabelText('T2. B2')).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await setup([]);
    expect(await screen.findByText("You're all caught up.")).toBeOnTheScreen();
  });

  it('marks a tagged notification read and opens the memory', async () => {
    const { notifications } = await setup([note({ id: 'a', type: 'memoryTagged', data: { memoryId: 'm1' } })]);
    await act(async () => {
      fireEvent.press(await screen.findByTestId('notification-a'));
    });
    expect(notifications.markRead).toHaveBeenCalledWith(expect.any(String), 'a', expect.any(Date));
    expect(mockPush).toHaveBeenCalledWith('/memory/m1');
  });

  it('opens the community for an invitation', async () => {
    await setup([note({ id: 'a', type: 'communityInvite', data: { communityId: 'c1' } })]);
    await act(async () => {
      fireEvent.press(await screen.findByTestId('notification-a'));
    });
    expect(mockPush).toHaveBeenCalledWith('/communities/c1');
  });

  it('marks transfer notifications read without navigating', async () => {
    const { notifications } = await setup([note({ id: 't', type: 'transferRequest', data: { transferId: 'x' } })]);
    await act(async () => {
      fireEvent.press(await screen.findByTestId('notification-t'));
    });
    expect(notifications.markRead).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not mark an already-read row again', async () => {
    const { notifications } = await setup([
      note({ id: 'a', type: 'memoryTagged', data: { memoryId: 'm1' }, readAt: new Date() }),
    ]);
    await act(async () => {
      fireEvent.press(await screen.findByTestId('notification-a'));
    });
    expect(notifications.markRead).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/memory/m1');
  });

  it('still navigates when marking read fails', async () => {
    const { notifications } = await setup([note({ id: 'a', type: 'memoryTagged', data: { memoryId: 'm1' } })]);
    (notifications.markRead as jest.Mock).mockRejectedValueOnce(new Error('x'));
    await act(async () => {
      fireEvent.press(await screen.findByTestId('notification-a'));
    });
    expect(mockPush).toHaveBeenCalledWith('/memory/m1');
  });

  it('marks all read', async () => {
    const { notifications } = await setup([note({ id: 'a' }), note({ id: 'b' })]);
    await act(async () => {
      fireEvent.press(await screen.findByText('Mark all read'));
    });
    expect(notifications.markAllRead).toHaveBeenCalled();
  });

  it('shows the generic error when mark all read fails', async () => {
    const { notifications } = await setup([note({ id: 'a' })]);
    (notifications.markAllRead as jest.Mock).mockRejectedValueOnce(new Error('x'));
    await act(async () => {
      fireEvent.press(await screen.findByText('Mark all read'));
    });
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
  });

  it('shows a load error (not the empty state) when the inbox fails to load', async () => {
    const s = await inboxServices([]);
    s.services.repos.notifications.subscribe = jest.fn((_u, _cb, onError) => {
      onError?.(new Error('denied'));
      return () => {};
    });
    await render(
      <ServicesProvider services={s.services}>
        <InboxScreen />
      </ServicesProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(INBOX_LOAD_ERROR);
    expect(screen.queryByText("You're all caught up.")).toBeNull();
  });

  it('shows a spinner until the first snapshot arrives', async () => {
    const s = await inboxServices([]);
    s.services.repos.notifications.subscribe = jest.fn(() => () => {});
    await render(
      <ServicesProvider services={s.services}>
        <InboxScreen />
      </ServicesProvider>,
    );
    expect(screen.getByTestId('inbox-loading')).toBeOnTheScreen();
    expect(screen.queryByText("You're all caught up.")).toBeNull();
  });

  it('runs Mark all read once and disables it while running', async () => {
    const { notifications } = await setup([note({ id: 'a' })]);
    let release!: () => void;
    (notifications.markAllRead as jest.Mock).mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const button = await screen.findByRole('button', { name: 'Mark all read' });
    await act(async () => {
      (button.props.onClick as () => void)();
      (button.props.onClick as () => void)();
    });
    expect(notifications.markAllRead).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled();
    await act(async () => release());
  });

  describe('custodianship requests', () => {
    const transfer = (id: string): Transfer => ({
      id,
      placeId: 'place-1',
      fromUserId: 'user-asha',
      toUserId: 'user-demo',
      status: 'pending',
      createdAt: new Date('2026-10-17T00:00:00Z'),
      respondedAt: null,
      revokeUntil: new Date('2026-10-24T00:00:00Z'),
    });
    const request = (over: { id: string; transferId: string }) =>
      note({
        id: over.id,
        type: 'transferRequest',
        title: 'Custodianship request',
        body: 'Asha Rao wants you to become a custodian of Cubbon Park.',
        data: { transferId: over.transferId, placeId: 'place-1' },
      });

    /** Pending incoming transfers the test controls; respond answers and drops the transfer. */
    function fakeTransfers(initial: Transfer[]) {
      let pending = initial;
      const listeners = new Set<() => void>();
      const respond = jest.fn(async (id: string, _accept: boolean) => {
        pending = pending.filter((t) => t.id !== id);
        listeners.forEach((l) => l());
      });
      const prepare = (services: Services) => {
        jest.spyOn(services.repos.transfers, 'subscribeIncoming').mockImplementation((_uid, cb) => {
          const l = () => cb(pending);
          listeners.add(l);
          l();
          return () => {
            listeners.delete(l);
          };
        });
        jest.spyOn(services.repos.transfers, 'respond').mockImplementation(respond);
      };
      return { prepare, respond };
    }

    it('accepts a pending request inline and marks it read', async () => {
      const fake = fakeTransfers([transfer('t1')]);
      const { notifications } = await setup([request({ id: 'n1', transferId: 't1' })], fake.prepare);
      await act(async () => {
        fireEvent.press(await screen.findByRole('button', { name: 'Accept' }));
      });
      expect(fake.respond).toHaveBeenCalledWith('t1', true);
      expect(notifications.markRead).toHaveBeenCalledWith(expect.any(String), 'n1', expect.any(Date));
      expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('declines a pending request inline', async () => {
      const fake = fakeTransfers([transfer('t1')]);
      await setup([request({ id: 'n1', transferId: 't1' })], fake.prepare);
      await act(async () => {
        fireEvent.press(await screen.findByRole('button', { name: 'Decline' }));
      });
      expect(fake.respond).toHaveBeenCalledWith('t1', false);
      expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
    });

    it('answers once however often the button is pressed', async () => {
      const fake = fakeTransfers([transfer('t1')]);
      let finish!: () => void;
      fake.respond.mockImplementationOnce(() => new Promise<void>((r) => (finish = r)));
      await setup([request({ id: 'n1', transferId: 't1' })], fake.prepare);
      const accept = await screen.findByRole('button', { name: 'Accept' });
      await act(async () => {
        fireEvent.press(accept);
        fireEvent.press(accept);
        fireEvent.press(screen.getByRole('button', { name: 'Decline' }));
      });
      expect(fake.respond).toHaveBeenCalledTimes(1);
      await act(async () => finish());
    });

    it('offers no actions once the request is no longer pending', async () => {
      const fake = fakeTransfers([]);
      await setup([request({ id: 'n1', transferId: 't1' })], fake.prepare);
      expect(await screen.findByText('Custodianship request')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    });

    it('shows the generic copy when the request was already answered or expired', async () => {
      const fake = fakeTransfers([transfer('t1')]);
      fake.respond.mockRejectedValueOnce(new Error(GENERIC_ERROR));
      await setup([request({ id: 'n1', transferId: 't1' })], fake.prepare);
      await act(async () => {
        fireEvent.press(await screen.findByRole('button', { name: 'Accept' }));
      });
      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
    });
  });
});
