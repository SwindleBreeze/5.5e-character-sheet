// Character schema migrations (plan §9.1). Stored characters and backups may be from any older
// schema version; every read upgrades them step by step to CHARACTER_SCHEMA_VERSION. A newer
// version is refused, since this app could not keep what it does not understand.

import { CHARACTER_SCHEMA_VERSION, type Character } from '../schema/index.ts';

export class CharacterVersionError extends Error {}

type Raw = Record<string, unknown>;

/** Each step takes a character at version `n` and returns it at `n + 1`. */
const STEPS: Record<number, (c: Raw) => Raw> = {
  // 1 → 2: ward HP, once-per-turn reminders (plan §9.1). The other v2 fields are optional.
  1: (c) => {
    const state = (c.state ?? {}) as Raw;
    return {
      ...c,
      state: { ...state, wardHp: state.wardHp ?? 0, turn: state.turn ?? { ridersUsed: [] } },
    };
  },
};

export function isNewerCharacter(c: { schemaVersion: number }): boolean {
  return c.schemaVersion > CHARACTER_SCHEMA_VERSION;
}

/** Upgrade a stored character to the current schema. Returns the same object when current. */
export function migrateCharacter(character: Character): Character {
  let version = character.schemaVersion;
  if (version === CHARACTER_SCHEMA_VERSION) return character;
  if (version > CHARACTER_SCHEMA_VERSION) {
    throw new CharacterVersionError(
      `“${character.name}” was saved by a newer version of the app. Update the app first.`,
    );
  }
  let c = structuredClone(character) as unknown as Raw;
  while (version < CHARACTER_SCHEMA_VERSION) {
    const step = STEPS[version];
    if (!step) throw new CharacterVersionError(`No upgrade from character version ${version}.`);
    c = step(c);
    version++;
  }
  return { ...(c as unknown as Character), schemaVersion: CHARACTER_SCHEMA_VERSION };
}
