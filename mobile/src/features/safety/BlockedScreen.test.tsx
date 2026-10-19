import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GENERIC_ERROR, TIMEOUT_ERROR } from '@/data/errors';
import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { SUBMIT_TIMEOUT_MS } from '@/features/memories/submitMemory';
import { PlaceScreen } from '@/features/places/PlaceScreen';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { BlockedScreen } from './BlockedScreen';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

async function signInAndBlock(services: Services, ids: string[]) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    // Blocked one after another, so the most recent (last) is listed first.
    for (const [i, id] of ids.entries()) {
      await services.repos.safety.block('user-demo', id, new Date(services.now().getTime() + i * 1000));
    }
  });
}

beforeEach(() => {
  jest.restoreAllMocks();
  mockBack.mockClear();
});

describe('BlockedScreen', () => {
  it('lists blocked people, most recent first, each with Unblock', async () => {
    const services = testServices();
    await signInAndBlock(services, ['user-asha', 'user-rohan']);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByRole('header', { name: 'Blocked people' })).toBeOnTheScreen();
    expect(await screen.findByText('Asha Rao')).toBeOnTheScreen();
    const names = screen.getAllByTestId(/^blocked-/).map((r) => r.props.testID);
    expect(names).toEqual(['blocked-user-rohan', 'blocked-user-asha']);
    expect(screen.getByRole('button', { name: 'Unblock Rohan Mehta' })).toHaveTextContent('Unblock');
    expect(screen.getByRole('button', { name: 'Unblock Asha Rao' })).toBeOnTheScreen();
  });

  it('shows empty copy when nobody is blocked', async () => {
    const services = testServices();
    await signInAndBlock(services, []);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByText("You haven't blocked anyone.")).toBeOnTheScreen();
  });

  it('unblocking removes the person and restores their memories immediately', async () => {
    const services = testServices();
    const unblock = jest.spyOn(services.repos.safety, 'unblock');
    await signInAndBlock(services, ['user-asha']);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <PlaceScreen placeId="place-2" />
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(await screen.findByTestId('memory-memory-7')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-6')).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: 'Unblock Asha Rao' }));
    expect(unblock).toHaveBeenCalledWith('user-demo', 'user-asha');
    expect(await screen.findByTestId('memory-memory-6')).toBeOnTheScreen();
    expect(await screen.findByText("You haven't blocked anyone.")).toBeOnTheScreen();
  });

  it('shows generic copy when unblocking fails', async () => {
    const services = testServices();
    jest.spyOn(services.repos.safety, 'unblock').mockRejectedValue(new Error('offline'));
    await signInAndBlock(services, ['user-asha']);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Unblock Asha Rao' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(GENERIC_ERROR);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Unblock Asha Rao' })).toBeEnabled());
  });

  it('shows timeout copy and re-enables Unblock when the server does not answer', async () => {
    const services = testServices();
    jest.spyOn(services.repos.safety, 'unblock').mockImplementation(() => new Promise(() => {}));
    await signInAndBlock(services, ['user-asha']);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    const button = await screen.findByRole('button', { name: 'Unblock Asha Rao' });
    jest.useFakeTimers();
    try {
      await fireEvent.press(button);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SUBMIT_TIMEOUT_MS);
      });
      expect(screen.getByRole('alert')).toHaveTextContent(TIMEOUT_ERROR);
      expect(screen.getByRole('button', { name: 'Unblock Asha Rao' })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a second Unblock in the same tick', async () => {
    const services = testServices();
    let release!: () => void;
    const unblock = jest
      .spyOn(services.repos.safety, 'unblock')
      .mockImplementation(() => new Promise<void>((r) => (release = r)));
    await signInAndBlock(services, ['user-asha']);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    const button = await screen.findByRole('button', { name: 'Unblock Asha Rao' });
    await act(async () => {
      (button.props.onClick as () => void)();
      (button.props.onClick as () => void)();
    });
    expect(unblock).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it('Back goes back', async () => {
    const services = testServices();
    await signInAndBlock(services, []);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <BlockedScreen />
        </BlocksProvider>
      </ServicesProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(mockBack).toHaveBeenCalled();
  });
});
