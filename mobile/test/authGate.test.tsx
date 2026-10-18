import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

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
});
