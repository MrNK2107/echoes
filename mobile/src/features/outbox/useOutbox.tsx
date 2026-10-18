import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useServices } from '@/services/ServicesProvider';

import { Outbox, type OutboxCounts } from './outbox';
import { OutboxProcessor } from './processor';

type OutboxContextValue = { outbox: Outbox; processor: OutboxProcessor };

const OutboxContext = createContext<OutboxContextValue | null>(null);

/** Owns the signed-in user's outbox and runs its processor while mounted. */
export function OutboxProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const services = useServices();
  const value = useMemo(() => {
    const outbox = new Outbox(services.keyValue, services.files, userId);
    return { outbox, processor: new OutboxProcessor(services, outbox) };
  }, [services, userId]);
  useEffect(() => value.processor.start(), [value]);
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutboxContext(): OutboxContextValue {
  const v = useContext(OutboxContext);
  if (!v) throw new Error('useOutboxContext must be used inside OutboxProvider');
  return v;
}

export function useOutbox(): { pending: number; failed: number; retry(): void; discardFailed(): void } {
  const { outbox, processor } = useOutboxContext();
  const [counts, setCounts] = useState<OutboxCounts>({ pending: 0, failed: 0 });
  useEffect(
    () =>
      outbox.subscribe((next) =>
        setCounts((prev) => (prev.pending === next.pending && prev.failed === next.failed ? prev : next)),
      ),
    [outbox],
  );
  const retry = useCallback(() => {
    void processor.retryNow();
  }, [processor]);
  const discardFailed = useCallback(() => {
    void outbox.discardFailed();
  }, [outbox]);
  return { pending: counts.pending, failed: counts.failed, retry, discardFailed };
}
