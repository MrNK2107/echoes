import { fireEvent, render, screen } from '@testing-library/react-native';

import { fakeCrashReporter } from '@/device/fakes';

import { ErrorFallback } from './ErrorFallback';

describe('ErrorFallback', () => {
  it('reports the error once and shows the generic copy', async () => {
    const reporter = fakeCrashReporter();
    const error = new Error('boom');
    const retry = jest.fn();
    await render(<ErrorFallback error={error} retry={retry} reporter={reporter} />);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeOnTheScreen();
    expect(reporter.captured).toEqual([{ error, context: { source: 'error-boundary' } }]);
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });
});
