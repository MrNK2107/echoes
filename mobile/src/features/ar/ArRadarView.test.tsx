import { render, screen } from '@testing-library/react-native';

import { ArRadarView } from './ArRadarView';

const mockDims = { width: 390 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockDims.width, height: 800, scale: 2, fontScale: 1 }),
}));

const radar = () => <ArRadarView places={[]} heading={0} onPressPlace={() => {}} onPressOrb={() => {}} />;

describe('ArRadarView ring labels', () => {
  it('shows ring labels on normal widths', async () => {
    mockDims.width = 390;
    await render(radar());
    expect(screen.getByText('250 m')).toBeOnTheScreen();
  });

  it('hides ring labels under 280px', async () => {
    mockDims.width = 270;
    await render(radar());
    expect(screen.queryByText('250 m')).toBeNull();
  });
});
