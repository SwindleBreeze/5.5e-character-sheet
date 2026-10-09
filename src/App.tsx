import { useEffect } from 'react';
import { HashRouter } from 'react-router';
import { AutoBackup } from './app/AutoBackup.tsx';
import { Durability } from './app/Durability.tsx';
import { AppRoutes } from './app/routes.tsx';
import { UpdatePrompt } from './app/UpdatePrompt.tsx';
import { detectEnv, requestPersistenceIfUseful } from './db/storage.ts';
import { SheetProvider } from './ui/BottomSheet.tsx';
import { RollerProvider } from './ui/Roller.tsx';

export function App() {
  useEffect(() => {
    // Installed apps ask for persistent storage right away; others once a character is saved
    // (`Durability`).
    void requestPersistenceIfUseful(detectEnv(), { hasSavedCharacter: false });
  }, []);

  return (
    <HashRouter>
      <RollerProvider>
        <SheetProvider>
          <AppRoutes />
          <UpdatePrompt />
          <AutoBackup />
          <Durability />
        </SheetProvider>
      </RollerProvider>
    </HashRouter>
  );
}
