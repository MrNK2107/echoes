import * as copy from './copy';

describe('shared UI copy', () => {
  it('keeps the strings several screens share', () => {
    expect(copy).toEqual({
      NAME_REQUIRED: 'Name is required',
      HIDDEN_BADGE: 'Hidden after reports',
      LOCATION_FAILED: 'Could not get your location. Try again.',
      PROFANITY_WARNING: 'This memory may contain offensive language. Save anyway?',
      REPORT_THANKS: "Thanks — we'll review it.",
      SOMEONE: 'Someone',
      THIS_PERSON: 'this person',
    });
  });
});
