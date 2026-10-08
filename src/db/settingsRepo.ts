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
  /** The install card was put away on the Characters screen (it stays in Settings). */
  installCardDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabledSources: ['XPHB', 'XDMG'],
  lastBackupAt: null,
  autoBackupHandle: null,
  lastImport: null,
  installCardDismissed: false,
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
