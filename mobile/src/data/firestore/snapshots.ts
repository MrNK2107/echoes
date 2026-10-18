import {
  onSnapshot,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from '../types';

/**
 * Listens to several queries at once and emits the union of their documents (de-duplicated by
 * id) once every query has resolved, then again on every change.
 *
 * Failure is per branch: a query that errors (e.g. a permission denial) counts as resolved with
 * no documents, `onError` is reported once, and the remaining queries keep emitting.
 * The returned function detaches every listener.
 */
export function subscribeUnion(
  queries: Query<DocumentData>[],
  onDocs: (docs: QueryDocumentSnapshot<DocumentData>[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const results: (QueryDocumentSnapshot<DocumentData>[] | null)[] = queries.map(() => null);
  let reportedError = false;

  const emit = () => {
    if (results.some((r) => r === null)) return;
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
        // Firestore detaches a listener after an error, so this branch stays empty.
        results[i] = [];
        if (!reportedError) {
          reportedError = true;
          onError?.(e);
        }
        emit();
      },
    ),
  );
  return () => {
    for (const u of unsubs) u();
  };
}
