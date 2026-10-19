import { inboxDestination, routeForNotification } from './routeForNotification';

describe('routeForNotification', () => {
  it('routes memoryTagged to the memory', () => {
    expect(routeForNotification({ type: 'memoryTagged', memoryId: 'm1' })).toBe('/memory/m1');
  });
  it('routes communityInvite to the community', () => {
    expect(routeForNotification({ type: 'communityInvite', communityId: 'c1' })).toBe('/communities/c1');
  });
  it('routes transfer types to the notifications screen', () => {
    for (const type of ['transferRequest', 'transferAccepted', 'transferDeclined', 'transferRevoked']) {
      expect(routeForNotification({ type, transferId: 't1' })).toBe('/notifications');
    }
  });
  it('routes unknown or incomplete payloads to the notifications screen', () => {
    expect(routeForNotification({ type: 'mystery' })).toBe('/notifications');
    expect(routeForNotification({})).toBe('/notifications');
    expect(routeForNotification({ type: 'memoryTagged' })).toBe('/notifications');
  });
  it('inboxDestination is null where the inbox answers in place', () => {
    expect(inboxDestination('transferRequest', { transferId: 't1' })).toBeNull();
    expect(inboxDestination('memoryTagged', { memoryId: 'm1' })).toBe('/memory/m1');
  });
});
