import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import { TEST_NOW, testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { RecentlyDeletedScreen } from './RecentlyDeletedScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const TEXT = 'What a wonderful, beautiful Sunday under these old trees. Pure joy.';

async function setup(deletedAgoMs: number | null, services: Services = testServices()) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    if (deletedAgoMs !== null) {
      await services.repos.memories.softDelete('memory-2', new Date(TEST_NOW.getTime() - deletedAgoMs));
    }
  });
  await render(
    <ServicesProvider services={services}>
      <RecentlyDeletedScreen />
    </ServicesProvider>,
  );
  return services;
}

beforeEach(() => {
  mockBack.mockClear();
  jest.restoreAllMocks();
});

describe('RecentlyDeletedScreen', () => {
  it('lists deleted memories with days left', async () => {
    await setup(29 * DAY + HOUR);
    expect(screen.getByText('Recently deleted')).toBeOnTheScreen();
    expect(await screen.findByText(TEXT)).toBeOnTheScreen();
    expect(screen.getByText('Restorable for 1 day')).toBeOnTheScreen();
  });

  it('pluralises days left', async () => {
    await setup(10 * DAY);
    expect(await screen.findByText('Restorable for 20 days')).toBeOnTheScreen();
  });

  it('does not show memories past the restore window', async () => {
    await setup(31 * DAY);
    expect(screen.queryByText(TEXT)).toBeNull();
    expect(await screen.findByText('Nothing here. Deleted memories stay restorable for 30 days.')).toBeOnTheScreen();
  });

  it('shows the empty state', async () => {
    await setup(null);
    expect(await screen.findByText('Nothing here. Deleted memories stay restorable for 30 days.')).toBeOnTheScreen();
  });

  it('restores a memory: row disappears and memory is visible again', async () => {
    const services = await setup(5 * DAY);
    await screen.findByText(TEXT);
    await fireEvent.press(screen.getByTestId('restore-memory-2'));
    expect(await screen.findByText('Nothing here. Deleted memories stay restorable for 30 days.')).toBeOnTheScreen();
    const m = await services.repos.memories.findById('memory-2');
    expect(m?.isDeleted).toBe(false);
  });

  it('shows expired copy when restore is rejected', async () => {
    const services = await setup(5 * DAY);
    jest
      .spyOn(services.repos.memories, 'restore')
      .mockRejectedValue(new Error('This memory can no longer be restored.'));
    await screen.findByText(TEXT);
    await fireEvent.press(screen.getByTestId('restore-memory-2'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This memory can no longer be restored.');
  });

  it('shows generic copy for other restore failures', async () => {
    const services = await setup(5 * DAY);
    jest.spyOn(services.repos.memories, 'restore').mockRejectedValue(new Error('boom'));
    await screen.findByText(TEXT);
    await fireEvent.press(screen.getByTestId('restore-memory-2'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('ignores a repeated tap: restore once', async () => {
    const services = await setup(5 * DAY);
    let release!: () => void;
    const restore = jest.spyOn(services.repos.memories, 'restore').mockImplementation(
      () =>
        new Promise<void>((r) => {
          release = r;
        }),
    );
    await screen.findByText(TEXT);
    const btn = screen.getByTestId('restore-memory-2');
    await act(async () => {
      btn.props.onClick();
      btn.props.onClick();
    });
    expect(restore).toHaveBeenCalledTimes(1);
    await act(async () => release());
  });

  it('goes back', async () => {
    await setup(null);
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalled();
  });
});
