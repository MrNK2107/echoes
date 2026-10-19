import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { DEMO_USER } from '@/data/seed';
import { testServices } from '@/device/fakes';
import { MAX_TAGS, TAG_CAP_ERROR } from '@/domain/privacy';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { UserSearchField } from './UserSearchField';

const onChangeSpy = jest.fn();

function Harness({ initial }: { initial: string[] }) {
  const [ids, setIds] = useState(initial);
  return (
    <UserSearchField
      selectedIds={ids}
      onChange={(next) => {
        onChangeSpy(next);
        setIds(next);
      }}
    />
  );
}

async function setup(initial: string[] = [], prepare?: (s: Services) => Promise<void>) {
  const services = testServices();
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    await prepare?.(services);
  });
  const search = jest.spyOn(services.repos.profiles, 'search');
  await render(
    <ServicesProvider services={services}>
      <Harness initial={initial} />
    </ServicesProvider>,
  );
  return { services, search };
}

const typeQuery = (text: string) =>
  act(async () => {
    fireEvent.changeText(screen.getByLabelText('Search people'), text);
  });
const wait = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

beforeEach(() => {
  onChangeSpy.mockClear();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('UserSearchField', () => {
  it('requires two characters', async () => {
    const { search } = await setup();
    expect(screen.getByPlaceholderText('Search people')).toBeOnTheScreen();
    await typeQuery('A');
    await wait(500);
    expect(screen.getByText('Type at least 2 letters.')).toBeOnTheScreen();
    expect(search).not.toHaveBeenCalled();
  });

  it('debounces the search by 300 ms', async () => {
    const { search } = await setup();
    await typeQuery('As');
    await wait(150);
    await typeQuery('Ash');
    await wait(299);
    expect(search).not.toHaveBeenCalled();
    await wait(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Ash', { excludeUid: 'user-demo' });
    expect(screen.getByText('Asha Rao')).toBeOnTheScreen();
    expect(screen.queryByText('Type at least 2 letters.')).toBeNull();
  });

  it('shows the empty copy when nobody matches', async () => {
    await setup();
    await typeQuery('zz');
    await wait(300);
    expect(screen.getByText('No people found.')).toBeOnTheScreen();
  });

  it('never offers yourself', async () => {
    await setup();
    await typeQuery('Demo');
    await wait(300);
    expect(screen.queryByText(DEMO_USER.displayName)).toBeNull();
    expect(screen.getByText('No people found.')).toBeOnTheScreen();
  });

  it('excludes people you blocked', async () => {
    await setup([], async (s) => {
      await s.repos.safety.block('user-demo', 'user-asha', s.now());
    });
    await typeQuery('As');
    await wait(300);
    expect(screen.queryByText('Asha Rao')).toBeNull();
    expect(screen.getByText('No people found.')).toBeOnTheScreen();
  });

  it('picking adds a removable chip with the display name', async () => {
    await setup();
    await typeQuery('Ro');
    await wait(300);
    await act(async () => {
      fireEvent.press(screen.getByText('Rohan Mehta'));
    });
    expect(onChangeSpy).toHaveBeenLastCalledWith(['user-rohan']);
    expect(screen.getByTestId('chip-user-rohan')).toHaveTextContent(/Rohan Mehta/);
    // The query clears after a pick, so the result row is gone and only the chip remains.
    expect(screen.getAllByText('Rohan Mehta')).toHaveLength(1);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Remove Rohan Mehta'));
    });
    expect(onChangeSpy).toHaveBeenLastCalledWith([]);
    expect(screen.queryByTestId('chip-user-rohan')).toBeNull();
  });

  it('shows chips for already selected ids by their display names', async () => {
    await setup(['user-asha']);
    await wait(0);
    expect(screen.getByTestId('chip-user-asha')).toHaveTextContent(/Asha Rao/);
  });

  it('labels the remove button generically when the name is unknown', async () => {
    await setup(['nobody']);
    await wait(0);
    expect(screen.getByLabelText('Remove tagged person')).toBeOnTheScreen();
  });

  it('does not offer people who are already selected', async () => {
    await setup(['user-asha']);
    await typeQuery('As');
    await wait(300);
    expect(screen.getAllByText('Asha Rao')).toHaveLength(1);
    expect(screen.getByText('No people found.')).toBeOnTheScreen();
  });

  it(`refuses a pick past ${MAX_TAGS} people`, async () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `u${i}`);
    await setup(full);
    await typeQuery('Ro');
    await wait(300);
    await act(async () => {
      fireEvent.press(screen.getByText('Rohan Mehta'));
    });
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(screen.getByText('You can tag up to 20 people.')).toBeOnTheScreen();
    expect(TAG_CAP_ERROR).toBe('You can tag up to 20 people.');
  });
});
