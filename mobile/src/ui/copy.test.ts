import * as copy from './copy';

describe('shared UI copy', () => {
  it('keeps the strings several screens share', () => {
    expect(copy).toEqual({
      NAME_REQUIRED: 'Name is required',
      HIDDEN_BADGE: 'Hidden after reports',
      LOCATION_FAILED: 'Could not get your location. Try again.',
      PROFANITY_WARNING: 'This memory may contain offensive language. Save anyway?',
      REPORT_COMMUNITY_LABEL: 'Report community',
      reportProfileLabel: expect.any(Function),
      MEMBERSHIP_ERROR: "Couldn't check your membership.",
      RETRY_LABEL: 'Retry',
      REPORT_THANKS: "Thanks — we'll review it.",
      SOMEONE: 'Someone',
      THIS_PERSON: 'this person',
      INVITE_CAP_ERROR: 'You can invite up to 20 people at a time.',
      REMOVE_INVITED_LABEL: 'Remove invited person',
      REMOVE_PERSON_LABEL: 'Remove person',
      REMOVE_TAGGED_LABEL: 'Remove tagged person',
      FEED_LOAD_ERROR: "Couldn't load memories.",
      INBOX_LOAD_ERROR: "Couldn't load notifications.",
      PUSH_ENABLE_LABEL: 'Turn on push notifications',
      PUSH_ON: 'Push notifications are on',
      PUSH_BLOCKED: 'Push notifications are blocked in system settings.',
      PUSH_OPEN_SETTINGS: 'Open settings',
      PUSH_UNAVAILABLE: 'Push notifications need the ECHOES app build.',
      AR_EMPTY: 'No memory places within 1 km.',
      AR_CAMERA_DENIED: 'Camera access is needed for AR. Showing radar instead.',
      AR_UNSUPPORTED: "AR isn't available on this device. Showing radar instead.",
      AR_HEADING_UNAVAILABLE: "Compass unavailable — the radar won't rotate.",
      AR_RADAR_VIEW: 'Radar view',
      AR_CAMERA_VIEW: 'Camera view',
      AR_BUTTON: 'AR',
      AR_BUTTON_LABEL: 'Explore in AR',
      AR_LOADING: 'Finding memories around you...',
      AR_TRACKING_ERROR: 'AR tracking was lost. Showing radar instead.',
      CHART_AXIS_OLDEST: 'Oldest',
      CHART_AXIS_LATEST: 'Latest',
      BACK_LABEL: 'Back',
      BACK_TEXT: '< Back',
    });
  });
});
