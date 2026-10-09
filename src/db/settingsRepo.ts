import type { ImportSummary } from '../adapters/importJob.ts';
import type { SourceCode } from '../schema/index.ts';
import { getDb, type AppDb } from './db.ts';

/** App-wide settings on this device, with their defaults. */
export interface Settings {
  enabledSources: SourceCode[];
  lastBackupAt: number | null;
  /** Desktop Chromium: file that backups are saved to automatically (plan §6.9). */
  autoBackupHandle: FileSystemFileHandle | null;
  /** What the last content import did, shown on the import screen. */
  lastImport: ImportSummary | null;
}

export const DEFAULT_SETTINGS: Settings = {
  // The Monster Manual holds the Beasts and familiars of the Extras tab (step 7.6).
  enabledSources: ['XPHB', 'XDMG', 'XMM'],
  lastBackupAt: null,
  autoBackupHandle: null,
  lastImport: null,
};

export function createSettingsRepo(db: AppDb = getDb()) {
  return {
    async get<K extends keyof Settings>(key: K): Promise<Settings[K]> {
      const row = await db.settings.get(key);
      return row === undefined ? DEFAULT_SETTINGS[key] : (row.value as Settings[K]);
    },

    async set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
      await db.settings.put({ key, value });
    },
  };
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>;
