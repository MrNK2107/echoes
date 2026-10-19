import { act, render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import type { AuraHistoryEntry, SentimentCategory } from '@/domain/types';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import { AuraHistoryChart } from './AuraHistoryChart';

const entry = (id: string, s: SentimentCategory, intensity: number, colorHex: string): AuraHistoryEntry => ({
  id,
  recordedAt: new Date(0),
  aura: { dominantSentiment: s, compoundScore: 0, intensity, memoryCount: 1, colorHex, updatedAt: new Date(0) },
});

type Handlers = { cb: (e: AuraHistoryEntry[]) => void; onError?: (e: Error) => void };

async function setup() {
  const unsubscribe = jest.fn();
  const handlers: Handlers = { cb: () => {} };
  const services = testServices();
  services.repos.places.subscribeAuraHistory = (_id, cb, onError) => {
    handlers.cb = cb;
    handlers.onError = onError;
    return unsubscribe;
  };
  const view = await render(
    <ServicesProvider services={services}>
      <AuraHistoryChart placeId="p1" />
    </ServicesProvider>,
  );
  return { handlers, unsubscribe, view };
}

describe('AuraHistoryChart', () => {
  it('is hidden with fewer than two entries', async () => {
    const { handlers } = await setup();
    expect(screen.queryByText('Aura history')).toBeNull();
    await act(async () => handlers.cb([entry('a', 'peaceful', 0.5, '#111111')]));
    expect(screen.queryByText('Aura history')).toBeNull();
    expect(screen.queryAllByTestId(/^aura-bar-/)).toHaveLength(0);
  });

  it('renders one bar per entry, oldest first, scaled and coloured', async () => {
    const { handlers } = await setup();
    await act(async () =>
      handlers.cb([
        entry('a', 'peaceful', 0, '#111111'),
        entry('b', 'positive', 1, '#222222'),
        entry('c', 'heavy', 0.5, '#333333'),
      ]),
    );
    expect(screen.getByText('Aura history')).toBeOnTheScreen();
    const bars = screen.getAllByTestId(/^aura-bar-/);
    expect(bars.map((b) => b.props.testID)).toEqual(['aura-bar-0', 'aura-bar-1', 'aura-bar-2']);
    expect(bars.map((b) => b.props.fill.payload)).toEqual([processColor('#111111'), processColor('#222222'), processColor('#333333')]);
    const h = bars.map((b) => Number(b.props.height));
    expect(h[0]).toBeGreaterThan(0);
    expect(h[0]).toBeLessThan(h[2]);
    expect(h[2]).toBeLessThan(h[1]);
  });

  it('exposes an accessible summary', async () => {
    const { handlers } = await setup();
    await act(async () =>
      handlers.cb([entry('a', 'peaceful', 0.2, '#111111'), entry('b', 'positive', 0.4, '#222222'), entry('c', 'heavy', 0.6, '#333333')]),
    );
    expect(screen.getByLabelText('Aura history: Peaceful to Heavy over 3 updates')).toBeOnTheScreen();
  });

  it('hides silently on error and unsubscribes on unmount', async () => {
    const { handlers, unsubscribe, view } = await setup();
    await act(async () =>
      handlers.cb([entry('a', 'peaceful', 0.2, '#111111'), entry('b', 'positive', 0.4, '#222222')]),
    );
    await act(async () => handlers.onError?.(new Error('denied')));
    expect(screen.queryByText('Aura history')).toBeNull();
    await view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
