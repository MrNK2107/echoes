import { act, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import AppLayout from '../app/(app)/_layout';
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
});
