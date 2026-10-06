import { createCharacterRepo, type CharacterRepo } from './characterRepo.ts';
import { createContentRepo, type ContentRepo } from './contentRepo.ts';
import { getDb, type AppDb } from './db.ts';
import { createSettingsRepo, type SettingsRepo } from './settingsRepo.ts';

export interface Repos {
  characters: CharacterRepo;
  content: ContentRepo;
  settings: SettingsRepo;
}

let cached: { db: AppDb; repos: Repos } | null = null;

/** Repos bound to the current app database (re-created if tests swap the database). */
export function repos(): Repos {
  const db = getDb();
  if (cached?.db !== db) {
    cached = {
      db,
      repos: {
        characters: createCharacterRepo(db),
        content: createContentRepo(db),
        settings: createSettingsRepo(db),
      },
    };
  }
  return cached.repos;
}
