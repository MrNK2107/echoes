import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';

import { useBlocks, withoutBlocked } from './useBlocks';

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
        <Blocked />
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
        <Blocked />
      </ServicesProvider>,
    );
    expect(screen.getByTestId('blocked')).toHaveTextContent('');
  });
});

describe('withoutBlocked', () => {
  it('drops memories by blocked authors and keeps the same array when nothing is blocked', () => {
    const list = [{ userId: 'a' }, { userId: 'b' }];
    expect(withoutBlocked(list, new Set(['a']))).toEqual([{ userId: 'b' }]);
    expect(withoutBlocked(list, new Set())).toBe(list);
  });
});
