import { newId } from '../engine/build/newCharacter.ts';
import type { Character } from '../schema/index.ts';
import { isNewerCharacter, migrateCharacter } from './characterMigrations.ts';
import { getDb, type AppDb } from './db.ts';

export { newCharacter, newId } from '../engine/build/newCharacter.ts';

/** Upgrade on read; a character from a newer app is left as stored (the sheet refuses it). */
function upgrade(c: Character): Character {
  return isNewerCharacter(c) ? c : migrateCharacter(c);
}

export function createCharacterRepo(db: AppDb = getDb()) {
  return {
    async list(): Promise<Character[]> {
      return (await db.characters.orderBy('updatedAt').reverse().toArray()).map(upgrade);
    },

    async get(id: string): Promise<Character | undefined> {
      const c = await db.characters.get(id);
      return c && upgrade(c);
    },

    /** Insert or update; stamps `updatedAt`. Returns the saved character. */
    async save(character: Character, now = Date.now()): Promise<Character> {
      const saved = { ...character, updatedAt: now };
      await db.characters.put(saved);
      return saved;
    },

    /** Delete a character and its portrait. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', db.characters, db.portraits, async () => {
        const existing = await db.characters.get(id);
        await db.characters.delete(id);
        if (existing?.portraitId) await db.portraits.delete(existing.portraitId);
      });
    },

    async portrait(id: string): Promise<Blob | undefined> {
      return (await db.portraits.get(id))?.blob;
    },

    /** Store a portrait under a new id, removing the one it replaces. Returns the new id. */
    async putPortrait(blob: Blob, replaces?: string, now = Date.now()): Promise<string> {
      const id = newId();
      await db.transaction('rw', db.portraits, async () => {
        await db.portraits.put({ id, blob, updatedAt: now });
        if (replaces) await db.portraits.delete(replaces);
      });
      return id;
    },

    async removePortrait(id: string): Promise<void> {
      await db.portraits.delete(id);
    },

    /** Copy a character (and its portrait) under a new id. */
    async duplicate(id: string, now = Date.now()): Promise<Character | undefined> {
      return db.transaction('rw', db.characters, db.portraits, async () => {
        const stored = await db.characters.get(id);
        if (!stored) return undefined;
        const source = upgrade(stored);
        const copy: Character = {
          ...structuredClone(source),
          id: newId(),
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        };
        delete copy.portraitId;
        if (source.portraitId) {
          const portrait = await db.portraits.get(source.portraitId);
          if (portrait) {
            copy.portraitId = newId();
            await db.portraits.put({ ...portrait, id: copy.portraitId, updatedAt: now });
          }
        }
        await db.characters.put(copy);
        return copy;
      });
    },
  };
}

export type CharacterRepo = ReturnType<typeof createCharacterRepo>;
