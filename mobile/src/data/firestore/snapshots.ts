import {
  onSnapshot,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from '../types';

/**
 * Listens to several queries at once and emits the union of their documents (de-duplicated by
 * id) once every query has delivered its first snapshot, then again on every change.
 * Errors from any query are reported once; listeners stay attached until unsubscribed.
 */
export function subscribeUnion(
  queries: Query<DocumentData>[],
  onDocs: (docs: QueryDocumentSnapshot<DocumentData>[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const results: (QueryDocumentSnapshot<DocumentData>[] | null)[] = queries.map(() => null);
  let failed = false;

  const emit = () => {
    if (failed || results.some((r) => r === null)) return;
    const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    for (const docs of results) for (const d of docs ?? []) byId.set(d.id, d);
    onDocs([...byId.values()]);
  };

  if (queries.length === 0) {
    onDocs([]);
    return () => {};
  }

  const unsubs = queries.map((q, i) =>
    onSnapshot(
      q,
      (snap) => {
        results[i] = snap.docs;
        emit();
      },
      (e) => {
        if (failed) return;
        failed = true;
        onError?.(e);
      },
    ),
  );
  return () => {
    for (const u of unsubs) u();
  };
}
