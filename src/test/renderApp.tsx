import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { AppRoutes } from '../app/routes.tsx';
import { SheetProvider } from '../ui/BottomSheet.tsx';

/** Render the app's routes at `path`, as the real app does but with an in-memory router. */
export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SheetProvider>
        <AppRoutes />
      </SheetProvider>
    </MemoryRouter>,
  );
}
