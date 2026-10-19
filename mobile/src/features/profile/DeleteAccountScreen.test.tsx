import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { OutboxProvider } from '@/features/outbox/useOutbox';
import { outboxDraft } from '@/features/outbox/fixtures';
import { Outbox } from '@/features/outbox/outbox';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { DeleteAccountScreen } from './DeleteAccountScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

function currentSession(services: Services) {
  const box: { value: { userId: string } | null } = { value: null };
  services.repos.auth.subscribe((sess) => {
    box.value = sess;
  })();
  return box.value;
}

async function setup(services: Services = testServices()) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
  });
  await render(
    <ServicesProvider services={services}>
      <OutboxProvider userId="user-demo">
        <DeleteAccountScreen />
      </OutboxProvider>
    </ServicesProvider>,
  );
  return services;
}

beforeEach(() => {
  mockBack.mockClear();
  jest.restoreAllMocks();
});

describe('DeleteAccountScreen', () => {
  it('shows the warning copy and disables delete until a password is typed', async () => {
    await setup();
    expect(screen.getByText('Delete account')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'This permanently deletes your account, your profile, and every memory, photo and voice note you created. This cannot be undone.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
    await fireEvent.changeText(screen.getByPlaceholderText('Confirm your password'), 'x');
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeEnabled();
  });

  it('has the shared Back control, which goes back', async () => {
    await setup();
    await fireEvent.press(screen.getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('Cancel goes back', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockBack).toHaveBeenCalled();
  });

  it('wrong password keeps the account', async () => {
    const services = await setup();
    await fireEvent.changeText(screen.getByPlaceholderText('Confirm your password'), 'not-it');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect password.');
    expect(currentSession(services)?.userId).toBe('user-demo');
  });

  it('shows generic copy for unknown errors', async () => {
    const services = await setup();
    jest.spyOn(services.repos.auth, 'deleteAccount').mockRejectedValue(new Error('boom internal'));
    await fireEvent.changeText(screen.getByPlaceholderText('Confirm your password'), 'x');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete permanently' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByText(/boom/)).toBeNull();
  });

  it('success signs out, removes the memories and clears the outbox', async () => {
    const services = testServices();
    const removed: string[] = [];
    services.files.remove = async (u) => {
      removed.push(u);
    };
    await setup(services);
    const outbox = new Outbox(services.keyValue, services.files, 'user-demo');
    await outbox.add(outboxDraft({ memoryId: 'queued', imageUri: 'file:///q.jpg' }));
    await fireEvent.changeText(screen.getByPlaceholderText('Confirm your password'), DEMO_USER.password);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete permanently' }));
    await act(async () => {});
    expect(currentSession(services)).toBeNull();
    expect(await outbox.list()).toEqual([]);
    expect(removed).toEqual(['persisted://queued.jpg']);
    const mine = await services.repos.memories.findById('memory-2');
    expect(mine).toBeNull();
  });
});
