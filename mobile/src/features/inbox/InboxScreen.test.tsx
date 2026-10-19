import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ServicesProvider } from '@/services/ServicesProvider';

import { InboxScreen } from './InboxScreen';
import { inboxServices, note } from './testInbox';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

async function setup(list: Parameters<typeof inboxServices>[0]) {
  const s = await inboxServices(list);
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
});
