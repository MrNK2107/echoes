import { fireEvent, render, screen } from '@testing-library/react-native';

import { fakeConnectivity, testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import { outboxDraft } from './fixtures';
import { Outbox } from './outbox';
import { OutboxBanner } from './OutboxBanner';
import { OutboxProcessor } from './processor';
import { OutboxProvider } from './useOutbox';

async function setup(pending: number) {
  // Offline so the processor leaves the drafts alone.
  const services = testServices({ connectivity: fakeConnectivity(false) });
  const seed = new Outbox(services.keyValue, services.files, 'user-demo');
  for (let i = 0; i < pending; i++) await seed.add(outboxDraft({ memoryId: `m${i}` }));
  await render(
    <ServicesProvider services={services}>
      <OutboxProvider userId="user-demo">
        <OutboxBanner />
      </OutboxProvider>
    </ServicesProvider>,
  );
}

describe('OutboxBanner', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is hidden when nothing is pending', async () => {
    await setup(0);
    expect(screen.queryByText(/waiting to upload/)).toBeNull();
  });

  it('uses the singular for one draft', async () => {
    await setup(1);
    expect(await screen.findByText('1 memory waiting to upload')).toBeOnTheScreen();
  });

  it('uses the plural for several drafts', async () => {
    await setup(3);
    expect(await screen.findByText('3 memories waiting to upload')).toBeOnTheScreen();
  });

  it('Retry calls retryNow', async () => {
    const retryNow = jest.spyOn(OutboxProcessor.prototype, 'retryNow');
    await setup(2);
    await screen.findByText('2 memories waiting to upload');
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(retryNow).toHaveBeenCalledTimes(1);
  });
});
