import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AppState, Text, type AppStateStatus } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import AppLayout from '../app/(app)/_layout';
import FinishSetup from '../app/(app)/finish-setup';
import SignIn from '../app/sign-in';

describe('auth gate', () => {
  it('lands on sign-in when signed out', async () => {
    const services = testServices();
    await renderRouter(
      {
        '(app)/_layout': AppLayout,
        '(app)/index': () => <Text>HOME</Text>,
        'sign-in': SignIn,
      },
      {
        initialUrl: '/',
        wrapper: ({ children }) => <ServicesProvider services={services}>{children}</ServicesProvider>,
      },
    );
    expect(await screen.findByTestId('submit-button')).toBeOnTheScreen();
    expect(screen.queryByText('HOME')).toBeNull();
  });

  it('repairs a missing public profile when a session starts', async () => {
    const services = testServices();
    jest.spyOn(services.repos.profiles, 'get').mockResolvedValue(null);
    const set = jest.spyOn(services.repos.profiles, 'setDisplayName');
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await renderRouter(
      {
        '(app)/_layout': AppLayout,
        '(app)/index': () => <Text>HOME</Text>,
        'sign-in': SignIn,
      },
      {
        initialUrl: '/',
        wrapper: ({ children }) => <ServicesProvider services={services}>{children}</ServicesProvider>,
      },
    );
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    await waitFor(() => expect(set).toHaveBeenCalledWith('user-demo', DEMO_USER.displayName, services.now()));
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('routes a session without a users doc to /finish-setup, then to the map once completed', async () => {
    const services = testServices();
    const real = services.repos.users.get.bind(services.repos.users);
    let created = false;
    jest.spyOn(services.repos.users, 'get').mockImplementation(async (id) => (created ? real(id) : null));
    jest.spyOn(services.repos.users, 'create').mockImplementation(async (u) => {
      created = true;
      expect(u.acceptedTermsAt).toEqual(services.now());
    });
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await renderRouter(
      {
        '(app)/_layout': AppLayout,
        '(app)/index': () => <Text>HOME</Text>,
        '(app)/finish-setup': FinishSetup,
        'sign-in': SignIn,
      },
      {
        initialUrl: '/',
        wrapper: ({ children }) => <ServicesProvider services={services}>{children}</ServicesProvider>,
      },
    );
    expect(await screen.findByText('Finish setting up')).toBeOnTheScreen();
    expect(screen.queryByText('HOME')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Asha');
    await fireEvent.press(screen.getByTestId('terms-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
  });

  async function renderGate(services: ReturnType<typeof testServices>, initialUrl = '/') {
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await renderRouter(
      {
        '(app)/_layout': AppLayout,
        '(app)/index': () => <Text>HOME</Text>,
        '(app)/finish-setup': FinishSetup,
        'sign-in': SignIn,
      },
      {
        initialUrl,
        wrapper: ({ children }) => <ServicesProvider services={services}>{children}</ServicesProvider>,
      },
    );
  }

  it('redirects an account that already has a users doc away from /finish-setup, unchanged', async () => {
    const services = testServices();
    const before = await services.repos.users.get('user-demo');
    const create = jest.spyOn(services.repos.users, 'create');
    await renderGate(services, '/finish-setup');
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    expect(screen.queryByText('Finish setting up')).toBeNull();
    expect(create).not.toHaveBeenCalled();
    expect(await services.repos.users.get('user-demo')).toEqual(before);
  });

  it('opens the app without waiting on the users read, then redirects once a missing doc is confirmed', async () => {
    const services = testServices();
    let resolveGet: (v: null) => void = () => {};
    jest.spyOn(services.repos.users, 'get').mockImplementation(() => new Promise((r) => (resolveGet = r)));
    await renderGate(services);
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    await act(async () => resolveGet(null));
    expect(await screen.findByText('Finish setting up')).toBeOnTheScreen();
  });

  it('retries a failed repair check once when the app becomes active', async () => {
    const handlers = new Set<(s: AppStateStatus) => void>();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
      const h = handler as (s: AppStateStatus) => void;
      if (type === 'change') handlers.add(h);
      return { remove: () => handlers.delete(h) };
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const services = testServices();
    const get = jest.spyOn(services.repos.users, 'get').mockRejectedValueOnce(new Error('offline'));
    get.mockResolvedValue(null);
    await renderGate(services);
    expect(await screen.findByText('HOME')).toBeOnTheScreen();
    await waitFor(() => expect(warn).toHaveBeenCalledWith('Could not check the account', expect.any(Error)));
    await act(async () => [...handlers].forEach((h) => h('active')));
    expect(await screen.findByText('Finish setting up')).toBeOnTheScreen();
    expect(get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
