import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { GENERIC_ERROR, TIMEOUT_ERROR } from '@/data/errors';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { CommunitiesScreen } from './CommunitiesScreen';
import { ERA, joinTimeCommunities, signIn, WALKERS, YEAR } from './testCommunities';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }));

async function setup(services: Services = testServices(), prepare?: (s: Services) => Promise<void>) {
  await signIn(services);
  await prepare?.(services);
  await render(
    <ServicesProvider services={services}>
      <CommunitiesScreen />
    </ServicesProvider>,
  );
  return services;
}

const rowIds = () => screen.queryAllByTestId(/^community-row-/).map((n) => n.props.testID as string);

beforeEach(() => {
  jest.restoreAllMocks();
  mockPush.mockClear();
  mockBack.mockClear();
});

describe('CommunitiesScreen', () => {
  it('lists my communities by name with type and member count', async () => {
    await setup(testServices(), joinTimeCommunities);
    expect(screen.getByRole('header', { name: 'Communities' })).toBeOnTheScreen();
    await waitFor(() => expect(rowIds()).toEqual([`community-row-${YEAR}`, `community-row-${WALKERS}`]));
    expect(screen.getByText('Cubbon Park Walkers')).toBeOnTheScreen();
    expect(screen.getByText('2026 Memories')).toBeOnTheScreen();
    expect(screen.getAllByText('1 member')).toHaveLength(2);
    expect(screen.getByLabelText('Cubbon Park Walkers, Interest, 1 member')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mine', selected: true })).toBeOnTheScreen();
  });

  it('Discover lists every community, largest first, including ones I have not joined', async () => {
    await setup(testServices(), joinTimeCommunities);
    await fireEvent.press(screen.getByRole('button', { name: 'Discover' }));
    expect(screen.getByRole('button', { name: 'Discover', selected: true })).toBeOnTheScreen();
    await waitFor(() => expect(rowIds()).toContain(`community-row-${ERA}`));
    expect(rowIds()).toEqual([`community-row-${YEAR}`, `community-row-${WALKERS}`, `community-row-${ERA}`]);
    expect(screen.getByText('0 members')).toBeOnTheScreen();
  });

  it('opens a community', async () => {
    await setup();
    await fireEvent.press(await screen.findByText('Cubbon Park Walkers'));
    expect(mockPush).toHaveBeenCalledWith(`/communities/${WALKERS}`);
  });

  it('shows empty copy when I have no communities', async () => {
    const services = testServices();
    jest.spyOn(services.repos.communities, 'subscribeMine').mockImplementation((_uid, cb) => {
      cb([]);
      return () => {};
    });
    await setup(services);
    expect(await screen.findByText("You haven't joined a community yet.")).toBeOnTheScreen();
  });

  it('shows error copy when the list fails to load', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const services = testServices();
    jest.spyOn(services.repos.communities, 'subscribeMine').mockImplementation((_uid, _cb, onError) => {
      onError?.(new Error('denied'));
      return () => {};
    });
    await setup(services);
    expect(await screen.findByText("Couldn't load communities.")).toBeOnTheScreen();
    warn.mockRestore();
  });

  it('Back goes back', async () => {
    await setup();
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });

  describe('Create community', () => {
    it('requires a name and a description', async () => {
      const services = testServices();
      const create = jest.spyOn(services.repos.communities, 'create');
      await setup(services);
      await fireEvent.press(screen.getByRole('button', { name: 'Create community' }));
      await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
      await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
      expect(screen.getByText('Name is required')).toBeOnTheScreen();
      expect(screen.getByText('Description is required')).toBeOnTheScreen();
      expect(create).not.toHaveBeenCalled();
      await fireEvent.changeText(screen.getByLabelText('Name'), 'Bird watchers');
      expect(screen.queryByText('Name is required')).toBeNull();
      expect(screen.getByText('Description is required')).toBeOnTheScreen();
    });

    it('creates the community with trimmed fields and opens it', async () => {
      const services = testServices();
      const create = jest.spyOn(services.repos.communities, 'create');
      await setup(services);
      await fireEvent.press(screen.getByRole('button', { name: 'Create community' }));
      await fireEvent.changeText(screen.getByLabelText('Name'), '  Bird watchers ');
      await fireEvent.changeText(screen.getByLabelText('Description'), ' Early mornings in the park. ');
      await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
      await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
      expect(create).toHaveBeenCalledWith({ name: 'Bird watchers', description: 'Early mornings in the park.' });
      const id = await create.mock.results[0]!.value;
      expect(mockPush).toHaveBeenCalledWith(`/communities/${id}`);
      expect(screen.queryByLabelText('Name')).toBeNull();
      expect(await screen.findByText('Bird watchers')).toBeOnTheScreen();
    });

    it('shows the timeout copy when offline and keeps the form', async () => {
      const services = testServices();
      jest.spyOn(services.repos.communities, 'create').mockRejectedValue(new Error(TIMEOUT_ERROR));
      await setup(services);
      await fireEvent.press(screen.getByRole('button', { name: 'Create community' }));
      await fireEvent.changeText(screen.getByLabelText('Name'), 'Bird watchers');
      await fireEvent.changeText(screen.getByLabelText('Description'), 'Early mornings.');
      await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
      expect(await screen.findByText(TIMEOUT_ERROR)).toBeOnTheScreen();
      expect(screen.getByLabelText('Name').props.value).toBe('Bird watchers');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('shows generic copy for an unexpected failure', async () => {
      const services = testServices();
      jest.spyOn(services.repos.communities, 'create').mockRejectedValue('boom');
      await setup(services);
      await fireEvent.press(screen.getByRole('button', { name: 'Create community' }));
      await fireEvent.changeText(screen.getByLabelText('Name'), 'Bird watchers');
      await fireEvent.changeText(screen.getByLabelText('Description'), 'Early mornings.');
      await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
      expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
    });

    it('creates only once on a double press', async () => {
      const services = testServices();
      let resolve!: (id: string) => void;
      const create = jest
        .spyOn(services.repos.communities, 'create')
        .mockImplementation(() => new Promise((r) => (resolve = r)));
      await setup(services);
      await fireEvent.press(screen.getByRole('button', { name: 'Create community' }));
      await fireEvent.changeText(screen.getByLabelText('Name'), 'Bird watchers');
      await fireEvent.changeText(screen.getByLabelText('Description'), 'Early mornings.');
      await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Create' }));
      expect(create).toHaveBeenCalledTimes(1);
      await act(async () => resolve('community-x'));
      expect(mockPush).toHaveBeenCalledWith('/communities/community-x');
    });

    it('Cancel closes the sheet without creating', async () => {
      const services = testServices();
      const create = jest.spyOn(services.repos.communities, 'create');
      await setup(services);
      await fireEvent.press(screen.getByRole('button', { name: 'Create community' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByLabelText('Name')).toBeNull();
      expect(create).not.toHaveBeenCalled();
    });
  });
});
