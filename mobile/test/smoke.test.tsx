import { render, screen } from '@testing-library/react-native';

import { testServices } from '@/device/fakes';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { ServicesProvider } from '@/services/ServicesProvider';

import Home from '../app/(app)/index';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('smoke', () => {
  it('renders the map home screen', async () => {
    await render(
      <ServicesProvider services={testServices()}>
        <OutboxProvider userId="user-demo">
          <Home />
        </OutboxProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByTestId('map')).toBeOnTheScreen();
  });
});
