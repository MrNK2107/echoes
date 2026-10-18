import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { fakeLocation, testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { MapScreen } from './MapScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

async function setup(services: Services = testServices()) {
  await render(
    <ServicesProvider services={services}>
      <MapScreen />
    </ServicesProvider>,
  );
  return services;
}

describe('MapScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it('renders a row and a marker per seeded place and navigates on row press', async () => {
    const services = await setup();
    let places: { id: string; aura: { colorHex: string }; name: string }[] = [];
    services.repos.places.subscribeNearby(
      { center: { latitude: 12.9716, longitude: 77.5946 }, radiusMeters: 1500 },
      (p) => (places = p),
    )();
    expect(places.length).toBe(7);
    await waitFor(() => expect(screen.getByTestId(`place-row-${places[0]!.id}`)).toBeOnTheScreen());
    for (const p of places) {
      expect(screen.getByTestId(`place-row-${p.id}`)).toBeOnTheScreen();
      const marker = screen.getByTestId(`marker-${p.id}`);
      expect(marker.props.pinColor).toBe(p.aura.colorHex);
      expect(marker.props.title).toBe(p.name);
    }
    await act(async () => {
      fireEvent.press(screen.getByTestId(`place-row-${places[0]!.id}`));
    });
    expect(mockPush).toHaveBeenCalledWith(`/place/${places[0]!.id}`);
    await act(async () => {
      fireEvent.press(screen.getByTestId(`marker-${places[1]!.id}`));
    });
    expect(mockPush).toHaveBeenCalledWith(`/place/${places[1]!.id}`);
  });

  it('formats memory counts and distances', async () => {
    await setup();
    await waitFor(() => expect(screen.getAllByText(/ m$| km$/).length).toBeGreaterThan(0));
    expect(screen.queryAllByText(/^\d+ memories$|^1 memory$/).length).toBeGreaterThan(0);
  });

  it('shows 1 memory singular', async () => {
    const services = testServices();
    const sub = services.repos.places.subscribeNearby;
    jest.spyOn(services.repos.places, 'subscribeNearby').mockImplementation((q, cb, e) =>
      sub(q, (ps) => cb(ps.map((p) => ({ ...p, memoryCount: 1 }))), e),
    );
    await setup(services);
    await waitFor(() => expect(screen.getAllByText('1 memory').length).toBe(7));
  });

  it('shows denied state', async () => {
    await setup(testServices({ location: fakeLocation({ permission: 'denied' }) }));
    expect(await screen.findByText('Location permission is needed to find memories near you.')).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
  });

  it('shows error state', async () => {
    await setup(testServices({ location: fakeLocation({ error: new Error('x') }) }));
    expect(await screen.findByText("Couldn't get your location.")).toBeOnTheScreen();
    expect(screen.getByText('Try again')).toBeOnTheScreen();
  });

  it('shows empty state', async () => {
    const services = testServices();
    jest.spyOn(services.repos.places, 'subscribeNearby').mockImplementation((_q, cb) => {
      cb([]);
      return () => {};
    });
    await setup(services);
    expect(await screen.findByText('No memories within 1.5 km yet. Be the first to leave one.')).toBeOnTheScreen();
  });

  it('Add memory navigates', async () => {
    await setup();
    await waitFor(() => expect(screen.getByText('Add memory')).toBeOnTheScreen());
    await act(async () => {
      fireEvent.press(screen.getByText('Add memory'));
    });
    expect(mockPush).toHaveBeenCalledWith('/add-memory');
  });
});
