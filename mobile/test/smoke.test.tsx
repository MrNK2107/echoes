import { render, screen } from '@testing-library/react-native';

import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import Home from '../app/(app)/index';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('smoke', () => {
  it('renders the map home screen', async () => {
    await render(
      <ServicesProvider services={testServices()}>
        <Home />
      </ServicesProvider>,
    );
    expect(await screen.findByTestId('map')).toBeOnTheScreen();
  });
});
