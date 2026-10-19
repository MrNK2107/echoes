import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

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
});
