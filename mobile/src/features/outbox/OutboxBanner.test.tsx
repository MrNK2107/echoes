import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { fakeConnectivity, testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import { outboxDraft } from './fixtures';
import { Outbox } from './outbox';
import { OutboxBanner } from './OutboxBanner';
import { OutboxProcessor } from './processor';
import { OutboxProvider } from './useOutbox';

async function setup(pending: number, failed = 0) {
  // Offline so the processor leaves the drafts alone.
  const services = testServices({ connectivity: fakeConnectivity(false) });
  const seed = new Outbox(services.keyValue, services.files, 'user-demo');
  for (let i = 0; i < pending; i++) await seed.add(outboxDraft({ memoryId: `m${i}` }));
  for (let i = 0; i < failed; i++) {
    await seed.add(outboxDraft({ memoryId: `f${i}` }));
    await seed.markFailed(`f${i}`, 'permission-denied: no');
  }
  await render(
    <ServicesProvider services={services}>
      <OutboxProvider userId="user-demo">
        <OutboxBanner />
      </OutboxProvider>
    </ServicesProvider>,
  );
  return services;
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

  it('shows failed drafts with singular and plural copy', async () => {
    await setup(0, 1);
    expect(await screen.findByText("1 memory couldn't upload")).toBeOnTheScreen();
    expect(screen.queryByText(/waiting to upload/)).toBeNull();
    screen.unmount();
    await setup(2, 3);
    expect(await screen.findByText("3 memories couldn't upload")).toBeOnTheScreen();
    expect(screen.getByText('2 memories waiting to upload')).toBeOnTheScreen();
  });

  it('Discard confirms, then removes only the failed drafts', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const services = await setup(1, 2);
    await screen.findByText("2 memories couldn't upload");
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, body, buttons] = alert.mock.calls[0]! as [string, string, AlertButton[]];
    expect(title).toBe("Discard memories that couldn't upload?");
    expect(body).toBe("They can't be recovered.");
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Discard']);
    await act(async () => {
      buttons[1]!.onPress!();
    });
    expect(screen.queryByText(/couldn't upload/)).toBeNull();
    expect(screen.getByText('1 memory waiting to upload')).toBeOnTheScreen();
    const left = await new Outbox(services.keyValue, services.files, 'user-demo').list();
    expect(left.map((d) => d.memoryId)).toEqual(['m0']);
  });

  it('Retry gives failed drafts one more attempt', async () => {
    await setup(0, 1);
    await screen.findByText("1 memory couldn't upload");
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1 memory waiting to upload')).toBeOnTheScreen();
  });
});
