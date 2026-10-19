import { act, render, screen, waitFor } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { PlaceScreen } from './PlaceScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }));

async function setup(id: string, services: Services = testServices()) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <PlaceScreen placeId={id} />
    </ServicesProvider>,
  );
  return services;
}

describe('PlaceScreen', () => {
  it('shows public and own private memories newest first with a Private badge', async () => {
    await setup('place-2');
    expect(await screen.findByText('Vidhana Soudha')).toBeOnTheScreen();
    expect(screen.getByText('3 memories')).toBeOnTheScreen();
    expect(screen.getByTestId('memory-memory-7')).toBeOnTheScreen();
    expect(screen.getByTestId('memory-memory-6')).toBeOnTheScreen();
    expect(screen.getByTestId('memory-memory-5')).toBeOnTheScreen();
    expect(screen.getAllByText('Private').length).toBe(1);
    expect(screen.getByText('Sat on the steps and thought about the year ahead.')).toBeOnTheScreen();
    const ids = screen.getAllByTestId(/^memory-/).map((n) => n.props.testID);
    expect(ids).toEqual(['memory-memory-7', 'memory-memory-6', 'memory-memory-5']);
  });

  it("hides another user's private memory", async () => {
    await setup('place-7');
    expect(await screen.findByText('Sree Kanteerava Stadium')).toBeOnTheScreen();
    expect(screen.getByTestId('memory-memory-22')).toBeOnTheScreen();
    expect(screen.getByTestId('memory-memory-21')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-23')).toBeNull();
    expect(screen.queryByText('Private')).toBeNull();
    expect(screen.getByText('2 memories')).toBeOnTheScreen();
  });

  it('shows author display names on the cards', async () => {
    await setup('place-2');
    expect(await screen.findByText('Asha Rao')).toBeOnTheScreen();
    expect(screen.getAllByText('Demo Custodian')).toHaveLength(2);
  });

  it('hides memories by people you blocked', async () => {
    const services = testServices();
    await services.repos.safety.block('user-demo', 'user-asha', services.now());
    await setup('place-2', services);
    expect(await screen.findByTestId('memory-memory-7')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-6')).toBeNull();
    expect(screen.getByText('2 memories')).toBeOnTheScreen();
  });

  it('shows the aura chip and community badge', async () => {
    await setup('place-1');
    expect(await screen.findByText('Cubbon Park')).toBeOnTheScreen();
    expect(screen.getByText('Community')).toBeOnTheScreen();
    expect(screen.getByTestId('aura-chip')).toBeOnTheScreen();
  });

  it('shows not-found copy for an unknown id', async () => {
    await setup('nope');
    expect(await screen.findByText('This place no longer exists.')).toBeOnTheScreen();
  });

  it('shows empty copy when there are no visible memories', async () => {
    const services = testServices();
    jest.spyOn(services.repos.memories, 'subscribeVisibleForPlace').mockImplementation((_q, cb) => {
      cb([]);
      return () => {};
    });
    await setup('place-2', services);
    expect(await screen.findByText('No memories here yet.')).toBeOnTheScreen();
  });

  it('shows error copy when the subscription fails', async () => {
    const services = testServices();
    jest.spyOn(services.repos.memories, 'subscribeVisibleForPlace').mockImplementation((_q, _cb, onError) => {
      onError?.(new Error('x'));
      return () => {};
    });
    await setup('place-2', services);
    await waitFor(() => expect(screen.getByText("Couldn't load memories.")).toBeOnTheScreen());
  });
});
