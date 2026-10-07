import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../app/routes.tsx';
import type { Rng } from '../engine/dice/roll.ts';
import { SheetProvider } from '../ui/BottomSheet.tsx';
import { RollerProvider } from '../ui/Roller.tsx';

/** Render the app's routes at `path`, as the real app does but with an in-memory router. */
export function renderApp(path = '/', rng?: Rng) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RollerProvider rng={rng}>
        <SheetProvider>
          <AppRoutes />
        </SheetProvider>
      </RollerProvider>
    </MemoryRouter>,
  );
}
