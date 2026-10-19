import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { USER_EXISTS } from '@/data/errors';
import { testServices } from '@/device/fakes';
import { DISPLAY_NAME_ERROR } from '@/domain/profiles';
import type { AuthSession } from '@/domain/types';
import { NAME_REQUIRED } from '@/ui/copy';

import { renderWithServices } from '../../../test/renderWithServices';
import { FinishSetupScreen } from './FinishSetupScreen';
import { TERMS_REQUIRED } from './SignInScreen';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));

const SESSION: AuthSession = { userId: 'user-new', email: 'new@echoes.app', displayName: null };

beforeEach(() => mockReplace.mockClear());

describe('FinishSetupScreen', () => {
  it('shows the title, Name field and Continue', async () => {
    await renderWithServices(testServices(), <FinishSetupScreen session={SESSION} />);
    expect(await screen.findByText('Finish setting up')).toBeOnTheScreen();
    expect(screen.getByLabelText('Name')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeOnTheScreen();
  });

  it('Continue without the terms box shows the terms error and writes nothing', async () => {
    const services = testServices();
    await renderWithServices(services, <FinishSetupScreen session={SESSION} />);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Asha');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(TERMS_REQUIRED)).toBeOnTheScreen();
    expect(await services.repos.users.get('user-new')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('validates the name', async () => {
    await renderWithServices(testServices(), <FinishSetupScreen session={SESSION} />);
    await fireEvent.press(await screen.findByTestId('terms-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(NAME_REQUIRED)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Name'), 'A');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(DISPLAY_NAME_ERROR)).toBeOnTheScreen();
  });

  it('with the box and a name creates the doc and goes to the map', async () => {
    const services = testServices();
    const done = jest.fn();
    await renderWithServices(services, <FinishSetupScreen session={SESSION} onDone={done} />);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Asha');
    await fireEvent.press(screen.getByTestId('terms-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(done).toHaveBeenCalled();
    expect((await services.repos.users.get('user-new'))?.acceptedTermsAt).toEqual(services.now());
  });

  it('shows a generic notice when the write fails', async () => {
    const services = testServices();
    jest.spyOn(services.repos.users, 'create').mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await renderWithServices(services, <FinishSetupScreen session={SESSION} />);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Asha');
    await fireEvent.press(screen.getByTestId('terms-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('alert')).toBeOnTheScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('an already-set-up account is sent home without overwriting', async () => {
    const services = testServices();
    jest.spyOn(services.repos.users, 'create').mockRejectedValue(new Error(USER_EXISTS));
    const done = jest.fn();
    await renderWithServices(services, <FinishSetupScreen session={SESSION} onDone={done} />);
    await fireEvent.changeText(await screen.findByLabelText('Name'), 'Asha');
    await fireEvent.press(screen.getByTestId('terms-checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(done).toHaveBeenCalled();
  });

  it('Sign out failures are logged, not thrown', async () => {
    const services = testServices();
    jest.spyOn(services.repos.auth, 'signOut').mockRejectedValue(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await renderWithServices(services, <FinishSetupScreen session={SESSION} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
