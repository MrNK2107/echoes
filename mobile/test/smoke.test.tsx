import { render, screen } from '@testing-library/react-native';

import Home from '../app/(app)/index';

describe('smoke', () => {
  it('renders the ECHOES placeholder', async () => {
    await render(<Home />);
    expect(screen.getByText('ECHOES')).toBeOnTheScreen();
  });
});
