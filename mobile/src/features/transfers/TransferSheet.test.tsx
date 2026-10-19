import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';

import { TransferSheet } from './TransferSheet';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('TransferSheet', () => {
  it('labels the chosen recipient removal by name and clears the pick', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    const place = (await services.repos.places.findById('place-2'))!;
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <TransferSheet place={place} visible onClose={jest.fn()} onSent={jest.fn()} />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled();
    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Search people'), 'Ro');
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('Rohan Mehta'));
    });
    expect(screen.getByRole('button', { name: 'Send request' })).toBeEnabled();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Remove Rohan Mehta'));
    });
    expect(screen.queryByLabelText('Remove Rohan Mehta')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled();
  });
});
