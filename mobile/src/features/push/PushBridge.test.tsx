import { render } from '@testing-library/react-native';

import { fakePush, testServices } from '@/device/fakes';
import { inboxServices } from '@/features/inbox/testInbox';
import { ServicesProvider } from '@/services/ServicesProvider';

import { PushBridge } from './PushBridge';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

beforeEach(() => mockPush.mockClear());

async function setup() {
  const push = fakePush({ permission: 'granted' });
  const unmount = (await render(
    <ServicesProvider services={testServices({ push })}>
      <PushBridge uid="user-demo" />
    </ServicesProvider>,
  )).unmount;
  return { push, unmount };
}

describe('PushBridge tap routing', () => {
  it.each([
    [{ type: 'memoryTagged', notificationId: 'n1', memoryId: 'm1' }, '/memory/m1'],
    [{ type: 'communityInvite', notificationId: 'n1', communityId: 'c1' }, '/communities/c1'],
    [{ type: 'transferRequest', notificationId: 'n1', transferId: 't1' }, '/notifications'],
    [{ type: 'transferAccepted', notificationId: 'n1' }, '/notifications'],
    [{ type: 'somethingNew', notificationId: 'n1' }, '/notifications'],
  ])('routes %j to %s', async (data, route) => {
    const { push } = await setup();
    push.emitResponse(data);
    expect(mockPush).toHaveBeenCalledWith(route);
  });

  it('stops listening on unmount', async () => {
    const { push, unmount } = await setup();
    await unmount();
    push.emitResponse({ type: 'memoryTagged', memoryId: 'm1' });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('marks the tapped notification read and still routes', async () => {
    const push = fakePush({ permission: 'granted' });
    const { services, notifications } = await inboxServices([]);
    await render(
      <ServicesProvider services={{ ...services, push }}>
        <PushBridge uid="user-demo" />
      </ServicesProvider>,
    );
    push.emitResponse({ type: 'memoryTagged', notificationId: 'n7', memoryId: 'm1' });
    expect(notifications.markRead).toHaveBeenCalledWith('user-demo', 'n7', expect.any(Date));
    expect(mockPush).toHaveBeenCalledWith('/memory/m1');
  });

  it('routes even when marking read fails, and skips it without a notificationId', async () => {
    const push = fakePush({ permission: 'granted' });
    const { services, notifications } = await inboxServices([]);
    (notifications.markRead as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await render(
      <ServicesProvider services={{ ...services, push }}>
        <PushBridge uid="user-demo" />
      </ServicesProvider>,
    );
    push.emitResponse({ type: 'memoryTagged', notificationId: 'n8', memoryId: 'm1' });
    expect(mockPush).toHaveBeenCalledWith('/memory/m1');
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    mockPush.mockClear();
    push.emitResponse({ type: 'memoryTagged', memoryId: 'm2' });
    expect(notifications.markRead).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/memory/m2');
    warn.mockRestore();
  });
});
