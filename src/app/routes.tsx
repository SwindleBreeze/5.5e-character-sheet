import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Route, Routes } from 'react-router';
import { CharactersPage } from '../features/characters/CharactersPage.tsx';
import { Placeholder } from '../features/Placeholder.tsx';
import { AppShell } from './AppShell.tsx';
import page from './Page.module.css';

// The characters list comes with the first load; the rest of the app, the sheet and its rules
// engine included, is loaded when first opened (plan step 7.9), so a phone starts faster.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const SheetPage = named(() => import('../features/sheet/SheetPage.tsx'), 'SheetPage');
const WizardPage = named(() => import('../features/wizard/WizardPage.tsx'), 'WizardPage');
const LevelUpPage = named(() => import('../features/levelup/LevelUpPage.tsx'), 'LevelUpPage');
const LibraryPage = named(() => import('../features/library/LibraryPage.tsx'), 'LibraryPage');
const ImportPage = named(() => import('../features/import/ImportPage.tsx'), 'ImportPage');
const SettingsPage = named(() => import('../features/settings/SettingsPage.tsx'), 'SettingsPage');
const DesignGallery = named(() => import('../features/dev/DesignGallery.tsx'), 'DesignGallery');
const QuickBuilder = named(() => import('../features/dev/QuickBuilder.tsx'), 'QuickBuilder');
const CoverageScreen = named(() => import('../features/dev/CoverageScreen.tsx'), 'CoverageScreen');

// The sheet is what's opened next nearly every time: fetched once the list is up.
if (typeof window !== 'undefined') {
  const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1000));
  idle(() => void import('../features/sheet/SheetPage.tsx'));
}

function Later({ page: Page }: { page: LazyExoticComponent<ComponentType> }) {
  return (
    <Suspense fallback={<div className={page.empty}>Loading…</div>}>
      <Page />
    </Suspense>
  );
}

/** All app routes (plan §7). Rendered inside a HashRouter in the app, a MemoryRouter in tests. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<CharactersPage />} />
        <Route path="c/:id/level-up" element={<Later page={LevelUpPage} />} />
        <Route path="c/:id/:tab?" element={<Later page={SheetPage} />} />
        <Route path="new/:draftId/:step?" element={<Later page={WizardPage} />} />
        <Route path="library" element={<Later page={LibraryPage} />} />
        <Route path="library/import" element={<Later page={ImportPage} />} />
        <Route path="settings" element={<Later page={SettingsPage} />} />
        <Route path="dev/design" element={<Later page={DesignGallery} />} />
        <Route path="dev/build" element={<Later page={QuickBuilder} />} />
        <Route path="dev/coverage" element={<Later page={CoverageScreen} />} />
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
