import { screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { testServices } from '@/device/fakes';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { renderWithServices } from '../../../test/renderWithServices';

import { MapScreen } from './MapScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const mockDims = { width: 390, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 800, scale: 2, fontScale: mockDims.fontScale }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

async function setup() {
  await renderWithServices(
    testServices(),
    <OutboxProvider userId="user-demo">
      <MapScreen />
    </OutboxProvider>,
  );
  await waitFor(() => expect(screen.getByLabelText('Communities')).toBeOnTheScreen());
}

describe('MapScreen layout', () => {
  beforeEach(() => {
    mockDims.width = 390;
    mockDims.fontScale = 1;
  });

  it('applies the top safe-area inset to the top row', async () => {
    await setup();
    const row = screen.getByTestId('map-top-row');
    expect(StyleSheet.flatten(row.props.style).top).toBeGreaterThanOrEqual(47);
  });

  it('shows text labels at normal width', async () => {
    await setup();
    expect(screen.getByText('Communities')).toBeOnTheScreen();
  });

  it('top row collapses at 320dp / fontScale 2', async () => {
    mockDims.width = 320;
    mockDims.fontScale = 2;
    await setup();
    expect(screen.queryByText('Communities')).toBeNull();
    expect(screen.getByLabelText('Communities')).toBeOnTheScreen();
    expect(screen.getByLabelText('Profile')).toBeOnTheScreen();
    expect(screen.getByLabelText('Notifications')).toBeOnTheScreen();
    expect(screen.getByLabelText('Explore in AR')).toBeOnTheScreen();
  });
});
