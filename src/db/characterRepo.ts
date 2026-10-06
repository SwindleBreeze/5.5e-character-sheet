import { CHARACTER_SCHEMA_VERSION, type Character } from '../schema/index.ts';
import { getDb, type AppDb } from './db.ts';

export function newId(): string {
  return crypto.randomUUID();
}

/** A blank character with no build yet. The creation wizard fills in `log[0]`. */
export function newCharacter(name = 'New character', now = Date.now()): Character {
  return {
    id: newId(),
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    name,
    enabledSources: null,
    baseScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    scoreMethod: 'standard',
    log: [],
    inventory: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    state: {
      damage: 0,
      tempHp: 0,
      deathSaves: { successes: 0, failures: 0 },
      hitDiceUsed: {},
      slotsUsed: [],
      pactSlotsUsed: 0,
      resourcesUsed: {},
      conditions: [],
      exhaustion: 0,
      heroicInspiration: false,
      concentration: null,
      activeToggles: {},
      prepared: {},
    },
    overrides: {},
    details: {},
    notes: '',
    sessionLog: [],
    snapshots: {},
    ui: {},
  };
}

export function createCharacterRepo(db: AppDb = getDb()) {
  return {
    async list(): Promise<Character[]> {
      return db.characters.orderBy('updatedAt').reverse().toArray();
    },

    async get(id: string): Promise<Character | undefined> {
      return db.characters.get(id);
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

    /** Copy a character (and its portrait) under a new id. */
    async duplicate(id: string, now = Date.now()): Promise<Character | undefined> {
      return db.transaction('rw', db.characters, db.portraits, async () => {
        const source = await db.characters.get(id);
        if (!source) return undefined;
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
