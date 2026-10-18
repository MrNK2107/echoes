import { useEffect, useState } from 'react';

import type { AuthSession } from '@/domain/types';
import { useServices } from '@/services/ServicesProvider';

export type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: AuthSession | null;
};

export function useSession(): SessionState {
  const { repos } = useServices();
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(
    () =>
      repos.auth.subscribe((session) =>
        setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null }),
      ),
    [repos.auth],
  );

  return state;
}
