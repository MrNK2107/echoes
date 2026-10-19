import { render } from '@testing-library/react-native';

import { fakePush, testServices } from '@/device/fakes';
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
});
