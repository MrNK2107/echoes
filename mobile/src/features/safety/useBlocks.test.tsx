import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';

import { useBlocks, useBlocksState, withoutBlocked } from './useBlocks';

function Blocked() {
  return <Text testID="blocked">{[...useBlocks()].sort().join(',')}</Text>;
}

describe('useBlocks', () => {
  it('follows the signed-in user’s block list live', async () => {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <Blocked />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByTestId('blocked')).toHaveTextContent('');
    await act(async () => {
      await services.repos.safety.block('user-demo', 'user-asha', services.now());
    });
    expect(screen.getByTestId('blocked')).toHaveTextContent('user-asha');
    await act(async () => {
      await services.repos.safety.unblock('user-demo', 'user-asha');
    });
    expect(screen.getByTestId('blocked')).toHaveTextContent('');
  });

  it('is empty when signed out', async () => {
    await render(
      <ServicesProvider services={testServices()}>
        <BlocksProvider>
          <Blocked />
        </BlocksProvider>
      </ServicesProvider>,
    );
    expect(screen.getByTestId('blocked')).toHaveTextContent('');
  });
});

function State() {
  const { ready, error, blocked } = useBlocksState();
  return <Text testID="state">{`${ready}|${error}|${[...blocked].join(',')}`}</Text>;
}

describe('useBlocksState', () => {
  async function renderWith(subscribe: jest.Mock) {
    const services = testServices();
    await act(async () => {
      await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    });
    jest.spyOn(services.repos.safety, 'subscribeBlocks').mockImplementation(subscribe);
    await render(
      <ServicesProvider services={services}>
        <BlocksProvider>
          <State />
        </BlocksProvider>
      </ServicesProvider>,
    );
  }

  it('is not ready until the first snapshot arrives', async () => {
    let emit!: (ids: string[]) => void;
    await renderWith(
      jest.fn((_uid: string, cb: (ids: string[]) => void) => {
        emit = cb;
        return () => {};
      }),
    );
    expect(screen.getByTestId('state')).toHaveTextContent('false|false|');
    await act(async () => emit(['user-asha']));
    expect(screen.getByTestId('state')).toHaveTextContent('true|false|user-asha');
  });

  it('stays not ready, with an error, when the subscription fails before any snapshot', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let fail!: (e: Error) => void;
    await renderWith(
      jest.fn((_uid: string, _cb: unknown, onError: (e: Error) => void) => {
        fail = onError;
        return () => {};
      }),
    );
    await act(async () => fail(new Error('denied')));
    expect(screen.getByTestId('state')).toHaveTextContent('false|true|');
    warn.mockRestore();
  });

  it('keeps the last list ready when a later error arrives', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let emit!: (ids: string[]) => void;
    let fail!: (e: Error) => void;
    await renderWith(
      jest.fn((_uid: string, cb: (ids: string[]) => void, onError: (e: Error) => void) => {
        emit = cb;
        fail = onError;
        return () => {};
      }),
    );
    await act(async () => emit(['user-asha']));
    await act(async () => fail(new Error('later')));
    expect(screen.getByTestId('state')).toHaveTextContent('true|false|user-asha');
    warn.mockRestore();
  });
});

describe('withoutBlocked', () => {
  it('drops memories by blocked authors and keeps the same array when nothing is blocked', () => {
    const list = [{ userId: 'a' }, { userId: 'b' }];
    expect(withoutBlocked(list, new Set(['a']))).toEqual([{ userId: 'b' }]);
    expect(withoutBlocked(list, new Set())).toBe(list);
  });
});
