import { Route, Routes, useParams } from 'react-router';
import { CharactersPage } from '../features/characters/CharactersPage.tsx';
import { DesignGallery } from '../features/dev/DesignGallery.tsx';
import { LibraryPage } from '../features/library/LibraryPage.tsx';
import { Placeholder } from '../features/Placeholder.tsx';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { SheetPage } from '../features/sheet/SheetPage.tsx';
import { AppShell } from './AppShell.tsx';

/** All app routes (plan §7). Rendered inside a HashRouter in the app, a MemoryRouter in tests. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CharactersPage />} />
        <Route path="c/:id/level-up" element={<LevelUpPlaceholder />} />
        <Route path="c/:id/:tab?" element={<SheetPage />} />
        <Route
          path="new/:draftId/:step"
          element={
            <Placeholder title="New character" backTo="/">
              Character creation arrives in phase 4.
            </Placeholder>
          }
        />
        <Route path="library" element={<LibraryPage />} />
        <Route
          path="library/import"
          element={
            <Placeholder title="Import" backTo="/library">
              Importing arrives in phase 2.
            </Placeholder>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        {import.meta.env.DEV && <Route path="dev/design" element={<DesignGallery />} />}
        <Route
          path="*"
          element={
            <Placeholder title="Not found" backTo="/">
              This page doesn’t exist.
            </Placeholder>
          }
        />
      </Route>
    </Routes>
  );
}

function LevelUpPlaceholder() {
  const { id = '' } = useParams();
  return (
    <Placeholder title="Level up" backTo={`/c/${id}/main`}>
      Level-up arrives in phase 5.
    </Placeholder>
  );
}
