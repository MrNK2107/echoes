import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { EMAIL_DOMAIN_NOT_APPROVED, GENERIC_ERROR, VERIFY_EMAIL_FIRST } from '@/data/errors';
import { DEMO_USER } from '@/data/seed';
import { fakeLocation } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { InstitutionScreen } from './InstitutionScreen';
import { DEMO_UID, registerInstitution, servicesWithAdmin, signIn } from './testInstitutions';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockFocus: (() => void) | undefined;
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useFocusEffect: (cb: () => void) => {
      mockFocus = cb;
      React.useEffect(() => cb(), [cb]);
    },
  };
});

const NAME = 'Echo University';
const ZONE_AT = { latitude: 12.9763, longitude: 77.5929 };

async function setup(
  opts: { domains?: string[]; emailVerified?: boolean; adminAlready?: boolean; overrides?: Partial<Services> } = {},
) {
  const { services, admin } = servicesWithAdmin(opts.overrides);
  await signIn(services);
  const id = await registerInstitution(services, admin, { name: NAME, allowedEmailDomains: opts.domains ?? ['echoes.app'] });
  admin.updateAccount(DEMO_UID, { emailVerified: opts.emailVerified ?? false });
  if (opts.adminAlready) {
    await act(async () => {
      admin.updateAccount(DEMO_UID, { emailVerified: true });
      await services.repos.institutions.claimAdmin(id);
    });
  }
  const view = await render(
    <ServicesProvider services={services}>
      <InstitutionScreen institutionId={id} />
    </ServicesProvider>,
  );
  return { services, admin, id, view };
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockBack.mockClear();
  mockFocus = undefined;
});

describe('InstitutionScreen', () => {
  it('shows the institution, its approved domains and Verify as admin to non-admins', async () => {
    await setup({ domains: ['echoes.app', 'uni.edu'] });
    expect(await screen.findByRole('header', { name: NAME })).toBeOnTheScreen();
    expect(screen.getByText('echoes.app, uni.edu')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Verify as admin' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add sub-zone here' })).toBeNull();
  });

  it('follows subscribeIsAdmin for the signed-in user (admin lists are private)', async () => {
    const { services } = servicesWithAdmin();
    await signIn(services);
    let push: (isAdmin: boolean) => void = () => {};
    const sub = jest.spyOn(services.repos.institutions, 'subscribeIsAdmin').mockImplementation((_id, _uid, cb) => {
      push = cb;
      cb(false);
      return () => {};
    });
    await render(
      <ServicesProvider services={services}>
        <InstitutionScreen institutionId="nope" />
      </ServicesProvider>,
    );
    expect(sub).toHaveBeenCalledWith('nope', DEMO_UID, expect.any(Function), expect.any(Function));
    expect(push).toBeDefined();
  });

  it('shows not-found copy for an unknown id', async () => {
    const { services } = servicesWithAdmin();
    await signIn(services);
    await render(
      <ServicesProvider services={services}>
        <InstitutionScreen institutionId="nope" />
      </ServicesProvider>,
    );
    expect(await screen.findByText('This institution no longer exists.')).toBeOnTheScreen();
  });

  it('unverified email: asks to verify, sends the email, and re-checks on focus', async () => {
    const { services } = await setup({ emailVerified: false });
    const send = jest.spyOn(services.repos.auth, 'sendEmailVerification');
    await fireEvent.press(await screen.findByRole('button', { name: 'Verify as admin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(VERIFY_EMAIL_FIRST);
    await fireEvent.press(screen.getByRole('button', { name: 'Send verification email' }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(`Verification email sent to ${DEMO_USER.email}.`)).toBeOnTheScreen();
    // The demo backend verifies on send; coming back to the screen re-checks and clears the prompt.
    await act(async () => mockFocus?.());
    await waitFor(() => expect(screen.queryByText(VERIFY_EMAIL_FIRST)).toBeNull());
    expect(screen.queryByRole('button', { name: 'Send verification email' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Verify as admin' }));
    expect(await screen.findByText(`You're now an admin of ${NAME}.`)).toBeOnTheScreen();
  });

  it('re-checks verification when the app returns to the foreground (e.g. from the mail app)', async () => {
    let onAppState: ((s: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'change') onAppState = handler as (s: AppStateStatus) => void;
      return { remove };
    });
    const { services, admin, view } = await setup({ emailVerified: false });
    const refresh = jest.spyOn(services.repos.auth, 'refreshUser');
    await fireEvent.press(await screen.findByRole('button', { name: 'Verify as admin' }));
    await screen.findByText(VERIFY_EMAIL_FIRST);
    expect(onAppState).toBeDefined();
    await act(async () => onAppState?.('background'));
    expect(refresh).not.toHaveBeenCalled();
    // The user taps the link in the mail app, then comes back.
    admin.updateAccount(DEMO_UID, { emailVerified: true });
    await act(async () => onAppState?.('active'));
    expect(refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText(VERIFY_EMAIL_FIRST)).toBeNull());
    expect(screen.queryByRole('button', { name: 'Send verification email' })).toBeNull();
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('keeps the verify prompt when the focus re-check says still unverified', async () => {
    const { services } = await setup({ emailVerified: false });
    jest.spyOn(services.repos.auth, 'sendEmailVerification').mockResolvedValue(undefined);
    await fireEvent.press(await screen.findByRole('button', { name: 'Verify as admin' }));
    await screen.findByText(VERIFY_EMAIL_FIRST);
    await act(async () => mockFocus?.());
    expect(screen.getByText(VERIFY_EMAIL_FIRST)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send verification email' })).toBeOnTheScreen();
  });

  it('shows generic copy when the verification email cannot be sent', async () => {
    const { services } = await setup({ emailVerified: false });
    jest.spyOn(services.repos.auth, 'sendEmailVerification').mockRejectedValue(new Error('auth/too-many-requests'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Verify as admin' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Send verification email' }));
    expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
  });

  it('domain mismatch: shows the not-approved copy', async () => {
    await setup({ domains: ['uni.edu'], emailVerified: true });
    await fireEvent.press(await screen.findByRole('button', { name: 'Verify as admin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(EMAIL_DOMAIN_NOT_APPROVED);
    expect(screen.queryByRole('button', { name: 'Send verification email' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Verify as admin' })).toBeOnTheScreen();
  });

  it('success: makes you an admin and offers sub-zones', async () => {
    const { services, id } = await setup({ emailVerified: true });
    const claim = jest.spyOn(services.repos.institutions, 'claimAdmin');
    await fireEvent.press(await screen.findByRole('button', { name: 'Verify as admin' }));
    expect(await screen.findByText(`You're now an admin of ${NAME}.`)).toBeOnTheScreen();
    expect(claim).toHaveBeenCalledWith(id);
    expect(screen.queryByRole('button', { name: 'Verify as admin' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add sub-zone here' })).toBeOnTheScreen();
  });

  it('adds a sub-zone at the current location', async () => {
    const { services, id } = await setup({
      adminAlready: true,
      overrides: { location: fakeLocation({ position: ZONE_AT }) },
    });
    const add = jest.spyOn(services.repos.institutions, 'addSubZone');
    await fireEvent.changeText(await screen.findByLabelText('Name'), '  Library lawn ');
    await fireEvent.press(screen.getByRole('button', { name: 'Add sub-zone here' }));
    expect(await screen.findByText('Sub-zone added.')).toBeOnTheScreen();
    expect(add).toHaveBeenCalledWith(id, { name: 'Library lawn', ...ZONE_AT });
    expect(await screen.findByText('Library lawn')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name').props.value).toBe('');
  });

  it('requires a sub-zone name', async () => {
    const { services } = await setup({ adminAlready: true });
    const add = jest.spyOn(services.repos.institutions, 'addSubZone');
    await fireEvent.press(await screen.findByRole('button', { name: 'Add sub-zone here' }));
    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(add).not.toHaveBeenCalled();
  });

  it('explains a denied location permission', async () => {
    const { services } = await setup({
      adminAlready: true,
      overrides: { location: fakeLocation({ permission: 'denied' }) },
    });
    const add = jest.spyOn(services.repos.institutions, 'addSubZone');
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Gate');
    await fireEvent.press(screen.getByRole('button', { name: 'Add sub-zone here' }));
    expect(await screen.findByText('Location permission is needed to add a sub-zone here.')).toBeOnTheScreen();
    expect(add).not.toHaveBeenCalled();
  });
});
