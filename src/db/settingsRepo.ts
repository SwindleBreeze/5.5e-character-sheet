import type { SourceCode } from '../schema/index.ts';
import { getDb, type AppDb } from './db.ts';

/** App-wide settings on this device, with their defaults. */
export interface Settings {
  enabledSources: SourceCode[];
  lastBackupAt: number | null;
  /** Last time any character changed; drives the backup reminder. */
  lastCharacterChangeAt: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  enabledSources: ['XPHB', 'XDMG'],
  lastBackupAt: null,
  lastCharacterChangeAt: null,
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
