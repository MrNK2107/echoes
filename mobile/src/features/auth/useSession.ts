import { useEffect, useState } from 'react';

import type { AuthRepository } from '@/data/types';
import type { AuthSession } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';

export type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: AuthSession | null;
};

const toState = (session: AuthSession | null): SessionState =>
  session ? { status: 'signedIn', session } : { status: 'signedOut', session: null };

interface Shared {
  listeners: Set<(state: SessionState) => void>;
  last: SessionState | null;
  off: (() => void) | null;
}

/** One auth subscription per repository, however many components read the session (listener budgets). */
const shared = new WeakMap<AuthRepository, Shared>();

function subscribeShared(auth: AuthRepository, cb: (state: SessionState) => void): () => void {
  let entry = shared.get(auth);
  if (!entry) {
    entry = { listeners: new Set(), last: null, off: null };
    shared.set(auth, entry);
  }
  const e = entry;
  e.listeners.add(cb);
  if (e.off === null) {
    e.off = auth.subscribe((session) => {
      e.last = toState(session);
      for (const l of [...e.listeners]) l(e.last);
    });
  } else if (e.last) {
    cb(e.last);
  }
  return () => {
    e.listeners.delete(cb);
    if (e.listeners.size === 0) {
      e.off?.();
      e.off = null;
      e.last = null;
    }
  };
}

export function useSession(): SessionState {
  const { repos } = useServices();
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => subscribeShared(repos.auth, setState), [repos.auth]);

  return state;
}
