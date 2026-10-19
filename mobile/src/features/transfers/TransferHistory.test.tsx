import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { GENERIC_ERROR } from '@/data/errors';
import { DEMO_USER } from '@/data/seed';
import type { Transfer } from '@/data/types';
import { testServices, TEST_NOW } from '@/device/fakes';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

import { TransferHistory } from './TransferHistory';

const DAY_MS = 86_400_000;

async function setup(services: Services = testServices(), prepare?: (s: Services) => Promise<void> | void) {
  await act(async () => {
    await services.repos.auth.signIn(DEMO_USER.email, DEMO_USER.password);
    await prepare?.(services);
  });
  await render(
    <ServicesProvider services={services}>
      <TransferHistory />
    </ServicesProvider>,
  );
  return services;
}

function transfer(over: Partial<Transfer> & { id: string }): Transfer {
  const createdAt = new Date(TEST_NOW.getTime() - DAY_MS);
  return {
    placeId: 'place-2',
    fromUserId: 'user-demo',
    toUserId: 'user-asha',
    status: 'accepted',
    createdAt,
    respondedAt: createdAt,
    revokeUntil: new Date(createdAt.getTime() + 7 * DAY_MS),
    ...over,
  };
}

function withHistory(list: Transfer[]) {
  return (s: Services) => {
    jest.spyOn(s.repos.transfers, 'subscribeHistory').mockImplementation((_uid, cb) => {
      cb(list);
      return () => {};
    });
  };
}

beforeEach(() => jest.restoreAllMocks());

describe('TransferHistory', () => {
  it('shows the empty state', async () => {
    await setup();
    expect(screen.getByText('Transfer history')).toBeOnTheScreen();
    expect(await screen.findByText('No transfers yet.')).toBeOnTheScreen();
  });

  it('lists sent and received transfers with the place, the other person and the status', async () => {
    await setup(testServices(), withHistory([
      transfer({ id: 't2', status: 'pending' }),
      transfer({ id: 't1', placeId: 'place-1', fromUserId: 'user-rohan', toUserId: 'user-demo', status: 'rejected' }),
    ]));
    expect(await screen.findByText('Vidhana Soudha')).toBeOnTheScreen();
    expect(await screen.findByText('To Asha Rao · Pending')).toBeOnTheScreen();
    expect(await screen.findByText('Cubbon Park')).toBeOnTheScreen();
    expect(await screen.findByText('From Rohan Mehta · Declined')).toBeOnTheScreen();
    const ids = screen.getAllByTestId(/^transfer-/).map((n) => n.props.testID);
    expect(ids).toEqual(['transfer-t2', 'transfer-t1']);
  });

  it('offers Revoke only on own pending or accepted transfers until revokeUntil', async () => {
    const now = TEST_NOW.getTime();
    await setup(testServices(), withHistory([
      transfer({ id: 'open', status: 'accepted' }),
      transfer({ id: 'edge', status: 'pending', revokeUntil: new Date(now) }),
      transfer({ id: 'late', status: 'accepted', revokeUntil: new Date(now - 1) }),
      transfer({ id: 'received', fromUserId: 'user-asha', toUserId: 'user-demo', status: 'accepted' }),
      transfer({ id: 'declined', status: 'rejected' }),
      transfer({ id: 'expired', status: 'expired' }),
      transfer({ id: 'revoked', status: 'revoked' }),
    ]));
    await screen.findByTestId('transfer-open');
    expect(screen.getByTestId('revoke-open')).toBeOnTheScreen();
    expect(screen.getByTestId('revoke-edge')).toBeOnTheScreen();
    for (const id of ['late', 'received', 'declined', 'expired', 'revoked']) {
      expect(screen.queryByTestId(`revoke-${id}`)).toBeNull();
    }
  });

  it('names the place in the Revoke button label', async () => {
    await setup(testServices(), withHistory([transfer({ id: 'open', status: 'accepted' })]));
    expect(await screen.findByRole('button', { name: 'Revoke transfer of Vidhana Soudha' })).toBeOnTheScreen();
  });

  it('revokes a sent request and confirms it', async () => {
    await setup(testServices(), async (s) => {
      await s.repos.transfers.initiate({ placeId: 'place-2', toUserId: 'user-asha' });
    });
    const revoke = await screen.findByRole('button', { name: /^Revoke transfer of/ });
    await act(async () => {
      fireEvent.press(revoke);
    });
    expect(await screen.findByText('Transfer revoked.')).toBeOnTheScreen();
    expect(screen.getByText('To Asha Rao · Revoked')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Revoke transfer of/ })).toBeNull();
  });

  it('revokes once however often Revoke is pressed', async () => {
    let finish!: () => void;
    const services = await setup(testServices(), (s) => {
      withHistory([transfer({ id: 't1' })])(s);
      jest.spyOn(s.repos.transfers, 'revoke').mockImplementation(() => new Promise<void>((r) => (finish = r)));
    });
    const revoke = await screen.findByRole('button', { name: /^Revoke transfer of/ });
    await act(async () => {
      fireEvent.press(revoke);
      fireEvent.press(revoke);
    });
    expect(services.repos.transfers.revoke).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(await screen.findByText('Transfer revoked.')).toBeOnTheScreen();
  });

  it('shows the generic copy when revoking fails', async () => {
    await setup(testServices(), (s) => {
      withHistory([transfer({ id: 't1' })])(s);
      jest.spyOn(s.repos.transfers, 'revoke').mockRejectedValue(new Error(GENERIC_ERROR));
    });
    await act(async () => {
      fireEvent.press(await screen.findByRole('button', { name: /^Revoke transfer of/ }));
    });
    expect(await screen.findByText(GENERIC_ERROR)).toBeOnTheScreen();
    expect(screen.queryByText('Transfer revoked.')).toBeNull();
  });
});
