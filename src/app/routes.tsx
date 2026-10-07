import { Route, Routes } from 'react-router';
import { CharactersPage } from '../features/characters/CharactersPage.tsx';
import { CoverageScreen } from '../features/dev/CoverageScreen.tsx';
import { DesignGallery } from '../features/dev/DesignGallery.tsx';
import { QuickBuilder } from '../features/dev/QuickBuilder.tsx';
import { ImportPage } from '../features/import/ImportPage.tsx';
import { LevelUpPage } from '../features/levelup/LevelUpPage.tsx';
import { LibraryPage } from '../features/library/LibraryPage.tsx';
import { Placeholder } from '../features/Placeholder.tsx';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { SheetPage } from '../features/sheet/SheetPage.tsx';
import { WizardPage } from '../features/wizard/WizardPage.tsx';
import { AppShell } from './AppShell.tsx';

/** All app routes (plan §7). Rendered inside a HashRouter in the app, a MemoryRouter in tests. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CharactersPage />} />
        <Route path="c/:id/level-up" element={<LevelUpPage />} />
        <Route path="c/:id/:tab?" element={<SheetPage />} />
        <Route path="new/:draftId/:step?" element={<WizardPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="library/import" element={<ImportPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="dev/design" element={<DesignGallery />} />
        <Route path="dev/build" element={<QuickBuilder />} />
        <Route path="dev/coverage" element={<CoverageScreen />} />
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
