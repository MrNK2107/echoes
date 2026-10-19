import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';

import { InboxBell } from './InboxBell';
import { renderWithServices } from '../../../test/renderWithServices';
import { inboxServices, note } from './testInbox';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

async function setup(unread: number, read = 0) {
  const list = Array.from({ length: unread + read }, (_, i) =>
    note({ id: `n${i}`, readAt: i < unread ? null : new Date() }),
  );
  const s = await inboxServices(list);
  await render(
    <ServicesProvider services={s.services}>
      <BlocksProvider>
        <InboxBell />
      </BlocksProvider>
    </ServicesProvider>,
  );
  return s;
}

describe('InboxBell', () => {
  beforeEach(() => mockPush.mockClear());

  it('shows no badge when nothing is unread', async () => {
    await setup(0, 2);
    expect(await screen.findByLabelText('Notifications')).toBeOnTheScreen();
    expect(screen.queryByTestId('inbox-badge')).toBeNull();
  });

  it('shows the unread count', async () => {
    await setup(3, 2);
    expect(await screen.findByText('3')).toBeOnTheScreen();
  });

  it('caps the badge at 9+', async () => {
    await setup(12);
    expect(await screen.findByText('9+')).toBeOnTheScreen();
  });

  it('announces the unread count', async () => {
    await setup(3);
    expect((await screen.findByLabelText('Notifications')).props.accessibilityValue).toEqual({ text: '3 unread' });
  });

  it('announces 9+ unread past the cap and nothing when all read', async () => {
    await setup(12);
    expect((await screen.findByLabelText('Notifications')).props.accessibilityValue).toEqual({ text: '9+ unread' });
  });

  it('has no accessibility value when nothing is unread', async () => {
    await setup(0, 1);
    expect((await screen.findByLabelText('Notifications')).props.accessibilityValue?.text).toBeUndefined();
  });

  it('opens the inbox', async () => {
    await setup(1);
    await act(async () => {
      fireEvent.press(await screen.findByLabelText('Notifications'));
    });
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('does not count a blocked actor unread items', async () => {
    const s = await inboxServices([
      note({ id: 'a', actorId: 'user-asha' }),
      note({ id: 'b', actorId: 'user-asha' }),
      note({ id: 'c', actorId: null }),
    ]);
    await s.services.repos.safety.block('user-demo', 'user-asha', s.services.now());
    await render(
      <ServicesProvider services={s.services}>
        <BlocksProvider>
          <InboxBell />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByText('1')).toBeOnTheScreen();
    expect((await screen.findByLabelText('Notifications')).props.accessibilityValue).toEqual({ text: '1 unread' });
  });


  it('shows no badge until the block list is ready, and none when it fails', async () => {
    const s = await inboxServices([note({ id: 'a', actorId: 'user-asha' })]);
    jest.spyOn(s.services.repos.safety, 'subscribeBlocks').mockImplementation(() => () => {});
    await renderWithServices(s.services, <InboxBell />);
    expect(await screen.findByLabelText('Notifications')).toBeOnTheScreen();
    expect(screen.queryByTestId('inbox-badge')).toBeNull();
  });
});
