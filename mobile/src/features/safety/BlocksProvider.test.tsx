import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Pressable, Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import { BlocksProvider } from './BlocksProvider';
import { useBlocks, useBlocksState } from './useBlocks';

function Probe({ id }: { id: string }) {
  const { ready, blocked } = useBlocksState();
  return <Text testID={id}>{`${ready}|${[...blocked].join(',')}`}</Text>;
}

function Hook() {
  return <Text testID="hook">{[...useBlocks()].join(',')}</Text>;
}

describe('BlocksProvider', () => {
  it('throws when a consumer renders outside the provider', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      render(
        <ServicesProvider services={testServices()}>
          <Probe id="x" />
        </ServicesProvider>,
      ),
    ).rejects.toThrow('BlocksProvider');
    error.mockRestore();
  });

  it('opens one subscription for every screen below it and follows the list live', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    const subscribe = jest.spyOn(services.repos.safety, 'subscribeBlocks');
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <Probe id="a" />
          <Probe id="b" />
          <Hook />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(subscribe).toHaveBeenCalledTimes(1);
    await act(async () => {
      await services.repos.safety.block('user-demo', 'user-asha', services.now());
    });
    expect(screen.getByTestId('a')).toHaveTextContent('true|user-asha');
    expect(screen.getByTestId('b')).toHaveTextContent('true|user-asha');
    expect(screen.getByTestId('hook')).toHaveTextContent('user-asha');
    expect(subscribe).toHaveBeenCalledTimes(1);
  });

  it('retries after an error and recovers', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    const real = services.repos.safety.subscribeBlocks.bind(services.repos.safety);
    let failing = true;
    const subscribe = jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((uid, cb, onError) => {
      if (failing) {
        onError?.(new Error('denied'));
        return () => {};
      }
      return real(uid, cb, onError);
    });
    function Retrier() {
      return <Pressable testID="retry" onPress={useBlocksState().retry} />;
    }
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <Probe id="a" />
          <Retrier />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByTestId('a')).toHaveTextContent('false|');
    failing = false;
    await act(async () => {
      fireEvent.press(screen.getByTestId('retry'));
    });
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('a')).toHaveTextContent('true|');
    warn.mockRestore();
  });

  it('resubscribes when the app becomes active while errored', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let handler: ((s: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_t: string, h: (s: string) => void) => {
      handler = h;
      return { remove: () => {} };
    }) as never);
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    const subscribe = jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation((_u, _cb, onError) => {
      onError?.(new Error('denied'));
      return () => {};
    });
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <Probe id="a" />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(subscribe).toHaveBeenCalledTimes(1);
    await act(async () => handler?.('active'));
    expect(subscribe).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('resubscribes for a new uid and does not expose the old list', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
      await services.repos.safety.block('user-demo', 'user-asha', services.now());
    });
    const subscribe = jest.spyOn(services.repos.safety, 'subscribeBlocks');
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <Probe id="a" />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByTestId('a')).toHaveTextContent('true|user-asha');
    await act(async () => {
      await services.repos.auth.signOut();
    });
    expect(screen.getByTestId('a')).toHaveTextContent('false|');
    let second = '';
    await act(async () => {
      second = (await services.repos.auth.register('new@example.com', 'secret-pass-1', 'New Person', services.now())).userId;
    });
    expect(subscribe.mock.calls.map((c) => c[0])).toEqual(['user-demo', second]);
    expect(screen.getByTestId('a')).toHaveTextContent('true|');
  });
});
