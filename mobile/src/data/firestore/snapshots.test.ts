import type { DocumentData, Query, QueryDocumentSnapshot } from 'firebase/firestore';
import { subscribeUnion } from './snapshots';

type Next = (snap: { docs: { id: string }[] }) => void;
type Fail = (e: Error) => void;
const mockListeners: { next: Next; fail: Fail; unsub: jest.Mock }[] = [];

jest.mock('firebase/firestore', () => ({
  onSnapshot: (_q: unknown, next: Next, fail: Fail) => {
    const unsub = jest.fn();
    mockListeners.push({ next, fail, unsub });
    return unsub;
  },
}));

const fakeQueries = (n: number) =>
  Array.from({ length: n }, () => ({}) as unknown as Query<DocumentData>);
const ids = (docs: QueryDocumentSnapshot<DocumentData>[]) => docs.map((d) => d.id).sort();

beforeEach(() => { mockListeners.length = 0; });

describe('subscribeUnion', () => {
  it('waits for every branch, then emits the de-duplicated union on each change', () => {
    const emitted: string[][] = [];
    subscribeUnion(fakeQueries(2), (docs) => emitted.push(ids(docs)));
    mockListeners[0]!.next({ docs: [{ id: 'a' }, { id: 'b' }] });
    expect(emitted).toEqual([]);
    mockListeners[1]!.next({ docs: [{ id: 'b' }, { id: 'c' }] });
    expect(emitted).toEqual([['a', 'b', 'c']]);
    mockListeners[0]!.next({ docs: [] });
    expect(emitted[emitted.length - 1]).toEqual(['b', 'c']);
  });

  it('an error before first snapshots resolves that branch as empty; the others still emit', () => {
    const emitted: string[][] = [];
    const errors: Error[] = [];
    subscribeUnion(fakeQueries(3), (docs) => emitted.push(ids(docs)), (e) => errors.push(e));
    mockListeners[1]!.fail(new Error('permission-denied'));
    mockListeners[0]!.next({ docs: [{ id: 'pub' }] });
    expect(emitted).toEqual([]);
    mockListeners[2]!.next({ docs: [{ id: 'own' }] });
    expect(emitted).toEqual([['own', 'pub']]);
    mockListeners[0]!.next({ docs: [{ id: 'pub' }, { id: 'pub2' }] });
    expect(emitted[emitted.length - 1]).toEqual(['own', 'pub', 'pub2']);
    expect(errors.map((e) => e.message)).toEqual(['permission-denied']);
  });

  it('an error after emitting drops only that branch and reports onError once', () => {
    const emitted: string[][] = [];
    const onError = jest.fn();
    subscribeUnion(fakeQueries(2), (docs) => emitted.push(ids(docs)), onError);
    mockListeners[0]!.next({ docs: [{ id: 'a' }] });
    mockListeners[1]!.next({ docs: [{ id: 'b' }] });
    mockListeners[1]!.fail(new Error('first'));
    expect(emitted[emitted.length - 1]).toEqual(['a']);
    mockListeners[0]!.fail(new Error('second'));
    expect(emitted[emitted.length - 1]).toEqual([]);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe detaches every listener', () => {
    const unsub = subscribeUnion(fakeQueries(3), () => {});
    mockListeners[0]!.fail(new Error('x'));
    unsub();
    for (const l of mockListeners) expect(l.unsub).toHaveBeenCalledTimes(1);
  });

  it('emits an empty list immediately for no queries', () => {
    const cb = jest.fn();
    subscribeUnion([], cb);
    expect(cb).toHaveBeenCalledWith([]);
  });
});
