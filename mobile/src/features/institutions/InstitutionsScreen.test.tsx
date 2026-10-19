import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { InstitutionsScreen } from './InstitutionsScreen';
import { DEMO_UID, registerInstitution, servicesWithAdmin, signIn } from './testInstitutions';

const mockPush = jest.fn();
const mockBack = jest.fn();
let mockFocus: (() => void) | undefined;
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: mockBack }),
    // Runs on mount like a first focus; tests call mockFocus() to simulate coming back to the screen.
    useFocusEffect: (cb: () => void) => {
      mockFocus = cb;
      React.useEffect(() => cb(), [cb]);
    },
  };
});

async function renderScreen(services: Services) {
  await render(
    <ServicesProvider services={services}>
      <InstitutionsScreen />
    </ServicesProvider>,
  );
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockBack.mockClear();
  mockFocus = undefined;
});

describe('InstitutionsScreen', () => {
  it('lists institutions by name and opens one', async () => {
    const { services, admin } = servicesWithAdmin();
    await signIn(services);
    const zeta = await registerInstitution(services, admin, { name: 'Zeta College', allowedEmailDomains: ['zeta.edu'] });
    await registerInstitution(services, admin, { name: 'Alpha University', allowedEmailDomains: ['alpha.edu'] });
    await renderScreen(services);
    expect(screen.getByRole('header', { name: 'Institutions' })).toBeOnTheScreen();
    const rows = await screen.findAllByTestId(/^institution-row-/);
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual(['Alpha University', 'Zeta College']);
    await fireEvent.press(screen.getByRole('button', { name: 'Zeta College' }));
    expect(mockPush).toHaveBeenCalledWith(`/institutions/${zeta}`);
  });

  it('shows empty copy when there are no institutions', async () => {
    const { services } = servicesWithAdmin();
    await signIn(services);
    await renderScreen(services);
    expect(await screen.findByText('No institutions yet.')).toBeOnTheScreen();
  });

  it('hides Register institution from non-staff', async () => {
    const { services } = servicesWithAdmin();
    const refresh = jest.spyOn(services.repos.auth, 'refreshUser');
    await signIn(services);
    await renderScreen(services);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await screen.findByText('No institutions yet.');
    expect(screen.queryByRole('button', { name: 'Register institution' })).toBeNull();
  });

  it('shows Register institution to staff (refreshUser().staff)', async () => {
    const { services, admin } = servicesWithAdmin();
    await signIn(services);
    admin.updateAccount(DEMO_UID, { staff: true });
    await renderScreen(services);
    expect(await screen.findByRole('button', { name: 'Register institution' })).toBeOnTheScreen();
  });

  it('re-checks the staff claim when the screen regains focus', async () => {
    const { services, admin } = servicesWithAdmin();
    await signIn(services);
    await renderScreen(services);
    await screen.findByText('No institutions yet.');
    expect(screen.queryByRole('button', { name: 'Register institution' })).toBeNull();
    admin.updateAccount(DEMO_UID, { staff: true });
    await act(async () => mockFocus?.());
    expect(await screen.findByRole('button', { name: 'Register institution' })).toBeOnTheScreen();
  });

  it('registers an institution with trimmed, comma-separated domains and opens it', async () => {
    const { services, admin } = servicesWithAdmin();
    const create = jest.spyOn(services.repos.institutions, 'create');
    await signIn(services);
    admin.updateAccount(DEMO_UID, { staff: true });
    await renderScreen(services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Register institution' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), '  Echo University ');
    await fireEvent.changeText(screen.getByLabelText('Email domains'), 'echoes.app, , uni.edu ');
    await fireEvent.press(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({ name: 'Echo University', allowedEmailDomains: ['echoes.app', 'uni.edu'] });
    const id = (mockPush.mock.calls[0]![0] as string).replace('/institutions/', '');
    expect((await services.repos.institutions.findById(id))?.name).toBe('Echo University');
  });

  it('validates the register form before calling the server', async () => {
    const { services, admin } = servicesWithAdmin();
    const create = jest.spyOn(services.repos.institutions, 'create');
    await signIn(services);
    admin.updateAccount(DEMO_UID, { staff: true });
    await renderScreen(services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Register institution' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByText('Name is required')).toBeOnTheScreen();
    expect(screen.getByText('Add at least one email domain.')).toBeOnTheScreen();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the mapped error when registering fails', async () => {
    const { services, admin } = servicesWithAdmin();
    await signIn(services);
    admin.updateAccount(DEMO_UID, { staff: true });
    await renderScreen(services);
    await fireEvent.press(await screen.findByRole('button', { name: 'Register institution' }));
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Bad Domains');
    await fireEvent.changeText(screen.getByLabelText('Email domains'), 'not a domain');
    await fireEvent.press(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
