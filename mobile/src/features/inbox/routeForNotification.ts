type Data = Record<string, string | undefined>;

/** Where an inbox row leads; null when it stays in the inbox (transfer requests are answered there). */
export function inboxDestination(type: string, data: Data): string | null {
  switch (type) {
    case 'memoryTagged':
      return data.memoryId ? `/memory/${data.memoryId}` : null;
    case 'communityInvite':
      return data.communityId ? `/communities/${data.communityId}` : null;
    default:
      return null;
  }
}

/** Where tapping a push notification leads; the payload is `{ type, notificationId, ...data }`. */
export function routeForNotification(payload: Data): string {
  return inboxDestination(payload.type ?? '', payload) ?? '/notifications';
}
