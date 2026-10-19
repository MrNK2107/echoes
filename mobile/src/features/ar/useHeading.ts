import { useEffect, useState } from 'react';

import { smoothHeading } from '@/domain/arScene';
import { useServices } from '@/services/ServicesProvider';

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
    service
      .subscribe((raw) => {
        if (!active || !Number.isFinite(raw)) return;
        smoothed = smoothHeading(smoothed, raw);
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
