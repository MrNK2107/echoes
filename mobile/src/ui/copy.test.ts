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
      INVITE_CAP_ERROR: 'You can invite up to 20 people at a time.',
      REMOVE_INVITED_LABEL: 'Remove invited person',
      REMOVE_PERSON_LABEL: 'Remove person',
      REMOVE_TAGGED_LABEL: 'Remove tagged person',
      FEED_LOAD_ERROR: "Couldn't load memories.",
      INBOX_LOAD_ERROR: "Couldn't load notifications.",
    });
  });
});
