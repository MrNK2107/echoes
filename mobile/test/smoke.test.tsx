import { render, screen } from '@testing-library/react-native';

import { testServices } from '@/device/fakes';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';

import Home from '../app/(app)/index';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('smoke', () => {
  it('renders the map home screen', async () => {
    await render(
      <ServicesProvider services={testServices()}>
        <BlocksProvider>
          <OutboxProvider userId="user-demo">
            <Home />
          </OutboxProvider>
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByTestId('map')).toBeOnTheScreen();
  });
});
