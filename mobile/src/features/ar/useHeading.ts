import { useEffect, useState } from 'react';

import { smoothHeading } from '@/domain/arScene';
import { useServices } from '@/services/ServicesProvider';

const MIN_STEP_DEGREES = 1;

export function useHeading(): { heading: number; unavailable: boolean } {
  const { heading: service } = useServices();
  const [state, setState] = useState<{ heading: number; unavailable: boolean }>({
    heading: 0,
    unavailable: false,
  });

  useEffect(() => {
    let active = true;
    let off: (() => void) | null = null;
    let smoothed: number | null = null;
    let emitted: number | null = null;
    service
      .subscribe((raw) => {
        if (!active || !Number.isFinite(raw)) return;
        smoothed = smoothHeading(smoothed, raw);
        // Sub-degree jitter is not worth a re-render (shortest arc, so 359.9 -> 0.1 counts as 0.2).
        if (emitted !== null && Math.abs(((((smoothed - emitted) % 360) + 540) % 360) - 180) < MIN_STEP_DEGREES) return;
        emitted = smoothed;
        setState({ heading: smoothed, unavailable: false });
      })
      .then((unsubscribe) => {
        if (!unsubscribe) {
          if (active) setState({ heading: 0, unavailable: true });
          return;
        }
        if (active) off = unsubscribe;
        else unsubscribe();
      })
      .catch(() => {
        if (active) setState({ heading: 0, unavailable: true });
      });
    return () => {
      active = false;
      off?.();
    };
  }, [service]);

  return state;
}
