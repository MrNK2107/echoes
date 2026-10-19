import { useEffect, useState } from 'react';

import { smoothHeading } from '@/domain/arScene';
import { useServices } from '@/services/ServicesProvider';

const MIN_STEP_DEGREES = 1;
/** A compass that accepts the subscription but never reports is treated as unavailable. */
const FIRST_SAMPLE_TIMEOUT_MS = 4000;

export function useHeading(): { heading: number; unavailable: boolean; ready: boolean } {
  const { heading: service } = useServices();
  const [state, setState] = useState<{ heading: number; unavailable: boolean; ready: boolean }>({
    heading: 0,
    unavailable: false,
    ready: false,
  });

  useEffect(() => {
    let active = true;
    let off: (() => void) | null = null;
    let smoothed: number | null = null;
    let emitted: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timer = null;
      if (active) setState({ heading: 0, unavailable: true, ready: false });
    }, FIRST_SAMPLE_TIMEOUT_MS);
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    service
      .subscribe((raw) => {
        if (!active || !Number.isFinite(raw)) return;
        clearTimer();
        smoothed = smoothHeading(smoothed, raw);
        // Sub-degree jitter is not worth a re-render (shortest arc, so 359.9 -> 0.1 counts as 0.2).
        if (emitted !== null && Math.abs(((((smoothed - emitted) % 360) + 540) % 360) - 180) < MIN_STEP_DEGREES) return;
        emitted = smoothed;
        setState({ heading: smoothed, unavailable: false, ready: true });
      })
      .then((unsubscribe) => {
        if (!unsubscribe) {
          clearTimer();
          if (active) setState({ heading: 0, unavailable: true, ready: false });
          return;
        }
        if (active) off = unsubscribe;
        else unsubscribe();
      })
      .catch(() => {
        clearTimer();
        if (active) setState({ heading: 0, unavailable: true, ready: false });
      });
    return () => {
      active = false;
      clearTimer();
      off?.();
    };
  }, [service]);

  return state;
}
