import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { TRANSFER_DUPLICATE } from '@/data/errors';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { SEARCH_DEBOUNCE_MS } from '@/features/people/UserSearchField';

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

  it('shows no memories until the block list has loaded', async () => {
    const services = testServices();
    let emit!: (ids: string[]) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, cb) => {
      emit = cb;
      return () => {};
    });
    await setup('place-2', services);
    expect(await screen.findByText('Vidhana Soudha')).toBeOnTheScreen();
    expect(screen.queryByTestId(/^memory-/)).toBeNull();
    expect(screen.queryByText('No memories here yet.')).toBeNull();
    await act(async () => emit(['user-asha']));
    expect(screen.getByTestId('memory-memory-7')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory-memory-6')).toBeNull();
  });

  it('keeps memories hidden and shows error copy when blocks fail before loading', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const services = testServices();
    let fail!: (e: Error) => void;
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_uid, _cb, onError) => {
      fail = onError!;
      return () => {};
    });
    await setup('place-2', services);
    expect(await screen.findByText('Vidhana Soudha')).toBeOnTheScreen();
    await act(async () => fail(new Error('denied')));
    expect(screen.queryByTestId(/^memory-/)).toBeNull();
    expect(screen.getByText("Couldn't load memories.")).toBeOnTheScreen();
    warn.mockRestore();
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

  describe('custodianship transfer', () => {
    async function search(query: string) {
      await act(async () => {
        fireEvent.changeText(screen.getByLabelText('Search people'), query);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
      });
    }

    async function pickPerson(query: string, uid: string) {
      await search(query);
      await act(async () => {
        fireEvent.press(await screen.findByTestId(`person-${uid}`));
      });
    }

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('offers no transfer action to a non-custodian', async () => {
      await setup('place-7');
      expect(await screen.findByText('Sree Kanteerava Stadium')).toBeOnTheScreen();
      expect(screen.queryByText('Transfer custodianship')).toBeNull();
    });

    it('sends a request to the chosen person and confirms it', async () => {
      const services = await setup('place-2');
      const initiate = jest.spyOn(services.repos.transfers, 'initiate');
      await act(async () => {
        fireEvent.press(await screen.findByText('Transfer custodianship'));
      });
      expect(screen.getByText('Choose the new custodian')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Send request' })).toBeDisabled();
      await pickPerson('Asha', 'user-asha');
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
      });
      expect(initiate).toHaveBeenCalledTimes(1);
      expect(initiate).toHaveBeenCalledWith({ placeId: 'place-2', toUserId: 'user-asha' });
      expect(await screen.findByText('Request sent.')).toBeOnTheScreen();
      expect(screen.queryByText('Choose the new custodian')).toBeNull();
      let pending: string[] = [];
      services.repos.transfers.subscribeHistory('user-demo', (ts) => (pending = ts.map((t) => `${t.toUserId}:${t.status}`)))();
      expect(pending).toEqual(['user-asha:pending']);
    });

    it('shows the duplicate copy when a request to that person is pending', async () => {
      const services = await setup('place-2');
      await act(async () => {
        await services.repos.transfers.initiate({ placeId: 'place-2', toUserId: 'user-asha' });
      });
      await act(async () => {
        fireEvent.press(await screen.findByText('Transfer custodianship'));
      });
      await pickPerson('Asha', 'user-asha');
      await act(async () => {
        fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
      });
      expect(await screen.findByText(TRANSFER_DUPLICATE)).toBeOnTheScreen();
      expect(screen.getByText('Choose the new custodian')).toBeOnTheScreen();
      expect(screen.queryByText('Request sent.')).toBeNull();
    });

    it('does not send twice while a request is in flight', async () => {
      const services = await setup('place-2');
      let finish!: () => void;
      const initiate = jest
        .spyOn(services.repos.transfers, 'initiate')
        .mockImplementation(() => new Promise<void>((r) => (finish = r)));
      await act(async () => {
        fireEvent.press(await screen.findByText('Transfer custodianship'));
      });
      await pickPerson('Asha', 'user-asha');
      const send = screen.getByRole('button', { name: 'Send request' });
      await act(async () => {
        fireEvent.press(send);
        fireEvent.press(send);
      });
      expect(initiate).toHaveBeenCalledTimes(1);
      await act(async () => finish());
      expect(await screen.findByText('Request sent.')).toBeOnTheScreen();
    });

    it('never offers existing custodians as the new custodian', async () => {
      const services = testServices();
      const real = services.repos.places.findById.bind(services.repos.places);
      jest.spyOn(services.repos.places, 'findById').mockImplementation(async (id) => {
        const p = await real(id);
        return p && { ...p, custodianIds: [...p.custodianIds, 'user-asha'] };
      });
      await setup('place-2', services);
      await act(async () => {
        fireEvent.press(await screen.findByText('Transfer custodianship'));
      });
      await search('Asha');
      expect(await screen.findByText('No people found.')).toBeOnTheScreen();
      expect(screen.queryByTestId('person-user-asha')).toBeNull();
    });
  });
});
