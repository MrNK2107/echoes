import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { testServices } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { rememberName, useAuthorNames } from './useAuthorNames';

function Names({ ids }: { ids: string[] }) {
  const names = useAuthorNames(ids);
  return <Text testID="names">{ids.map((id) => names.get(id) ?? '?').join(',')}</Text>;
}

async function renderNames(services: Services, ids: string[]) {
  const view = await render(
    <ServicesProvider services={services}>
      <Names ids={ids} />
    </ServicesProvider>,
  );
  await act(async () => {});
  return view;
}

describe('useAuthorNames', () => {
  it('resolves display names in one batched getMany', async () => {
    const services = testServices();
    const getMany = jest.spyOn(services.repos.profiles, 'getMany');
    await renderNames(services, ['user-asha', 'user-rohan', 'user-asha', 'nobody']);
    expect(screen.getByTestId('names')).toHaveTextContent('Asha Rao,Rohan Mehta,Asha Rao,?');
    expect(getMany).toHaveBeenCalledTimes(1);
    expect([...getMany.mock.calls[0]![0]].sort()).toEqual(['nobody', 'user-asha', 'user-rohan']);
  });

  it('caches names for the session, including missing profiles', async () => {
    const services = testServices();
    const getMany = jest.spyOn(services.repos.profiles, 'getMany');
    const first = await renderNames(services, ['user-asha', 'nobody']);
    await first.unmount();
    await renderNames(services, ['nobody', 'user-asha']);
    expect(screen.getByTestId('names')).toHaveTextContent('?,Asha Rao');
    expect(getMany).toHaveBeenCalledTimes(1);
  });

  it('asks only for ids it has not seen', async () => {
    const services = testServices();
    const getMany = jest.spyOn(services.repos.profiles, 'getMany');
    const first = await renderNames(services, ['user-asha']);
    await first.unmount();
    await renderNames(services, ['user-asha', 'user-rohan']);
    expect(getMany).toHaveBeenLastCalledWith(['user-rohan']);
    expect(screen.getByTestId('names')).toHaveTextContent('Asha Rao,Rohan Mehta');
  });

  it('rememberName updates the cache', async () => {
    const services = testServices();
    rememberName(services.repos.profiles, 'user-asha', 'Asha R');
    const getMany = jest.spyOn(services.repos.profiles, 'getMany');
    await renderNames(services, ['user-asha']);
    expect(screen.getByTestId('names')).toHaveTextContent('Asha R');
    expect(getMany).not.toHaveBeenCalled();
  });

  it('retries after a failed lookup instead of caching the failure', async () => {
    const services = testServices();
    const getMany = jest.spyOn(services.repos.profiles, 'getMany').mockRejectedValueOnce(new Error('offline'));
    const first = await renderNames(services, ['user-asha']);
    expect(screen.getByTestId('names')).toHaveTextContent('?');
    await first.unmount();
    await renderNames(services, ['user-asha']);
    expect(screen.getByTestId('names')).toHaveTextContent('Asha Rao');
    expect(getMany).toHaveBeenCalledTimes(2);
  });
});
