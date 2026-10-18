import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import { SignInScreen } from './SignInScreen';
import { useSession } from './useSession';

function Status() {
  return <Text testID="status">{useSession().status}</Text>;
}

async function setup() {
  const services = testServices();
  const register = jest.spyOn(services.repos.auth, 'register');
  await render(
    <ServicesProvider services={services}>
      <SignInScreen />
      <Status />
    </ServicesProvider>,
  );
  return { register };
}

const type = (id: string, value: string) =>
  act(async () => {
    fireEvent.changeText(screen.getByTestId(id), value);
  });
const press = (id: string) =>
  act(async () => {
    fireEvent.press(screen.getByTestId(id));
  });

describe('SignInScreen', () => {
  it('shows required errors on empty submit', async () => {
    await setup();
    await press('submit-button');
    expect(screen.getByText('Email is required')).toBeOnTheScreen();
    expect(screen.getByText('Password is required')).toBeOnTheScreen();
  });

  it('requires the 13+ checkbox when registering and does not call register', async () => {
    const { register } = await setup();
    await press('mode-toggle');
    expect(screen.getByText('I already have an account')).toBeOnTheScreen();
    await type('name-input', 'Ada');
    await type('email-input', 'ada@example.com');
    await type('password-input', 'longenough');
    await press('submit-button');
    expect(screen.getByText('You must be at least 13 to create an account.')).toBeOnTheScreen();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers once the age box is checked', async () => {
    const { register } = await setup();
    await press('mode-toggle');
    await type('name-input', 'Ada');
    await type('email-input', 'ada@example.com');
    await type('password-input', 'longenough');
    await press('age-checkbox');
    expect(screen.getByTestId('age-checkbox').props.accessibilityState).toEqual({ checked: true });
    await press('submit-button');
    expect(register).toHaveBeenCalledWith('ada@example.com', 'longenough', 'Ada', expect.any(Date));
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn');
  });

  it('signs in with the demo credentials', async () => {
    await setup();
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
    await type('email-input', DEMO_USER.email);
    await type('password-input', DEMO_USER.password);
    await press('submit-button');
    expect(screen.getByTestId('status')).toHaveTextContent('signedIn');
  });

  it('shows the repository error for a wrong password', async () => {
    await setup();
    await type('email-input', DEMO_USER.email);
    await type('password-input', 'wrong-password');
    await press('submit-button');
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByTestId('status')).toHaveTextContent('signedOut');
  });

  describe('unknown backend errors', () => {
    let warn: jest.SpyInstance;
    beforeEach(() => {
      warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    const failWith = async (error: unknown) => {
      const services = testServices();
      jest.spyOn(services.repos.auth, 'signIn').mockRejectedValue(error);
      await render(
        <ServicesProvider services={services}>
          <SignInScreen />
        </ServicesProvider>,
      );
      await type('email-input', DEMO_USER.email);
      await type('password-input', 'some-password');
      await press('submit-button');
    };

    it('maps a network failure to connection copy', async () => {
      await failWith(
        Object.assign(new Error('Firebase: Error (auth/network-request-failed).'), {
          code: 'auth/network-request-failed',
        }),
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Could not reach the server. Check your connection and try again.',
      );
      expect(warn).toHaveBeenCalled();
    });

    it('maps any other unknown error to generic copy without leaking the message', async () => {
      await failWith(new Error('Firebase: Error (auth/internal-error).'));
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
      expect(screen.queryByText(/internal-error/)).toBeNull();
      expect(warn).toHaveBeenCalled();
    });

    it('passes through the known account-exists message', async () => {
      await failWith(new Error('An account already exists for that email.'));
      expect(screen.getByRole('alert')).toHaveTextContent('An account already exists for that email.');
    });
  });
});
