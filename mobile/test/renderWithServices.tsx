import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { BlocksProvider } from '@/features/safety/BlocksProvider';
import { ServicesProvider } from '@/services/ServicesProvider';
import type { Services } from '@/services/services';

/** Renders under ServicesProvider and the shared BlocksProvider, as app/(app)/_layout does. Await it. */
export function renderWithServices(services: Services, ui: ReactElement) {
  return render(
    <ServicesProvider services={services}>
      <BlocksProvider>{ui}</BlocksProvider>
    </ServicesProvider>,
  );
}
