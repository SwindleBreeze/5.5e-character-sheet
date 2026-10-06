import { describe, expect, it } from 'vitest';
import { CHARACTER_SCHEMA_VERSION, type Character } from '../schema/index.ts';
import { CharacterVersionError, migrateCharacter } from './characterMigrations.ts';
import { newCharacter } from './characterRepo.ts';

/** A character as phase 2 stored it (schema 1): no ward or turn state. */
function v1(): Character {
  const c = newCharacter('Old', 0);
  const state = { ...c.state } as Partial<Character['state']>;
  delete state.wardHp;
  delete state.turn;
  return { ...c, schemaVersion: 1, state: state as Character['state'] };
}

describe('migrateCharacter', () => {
  it('upgrades a version 1 character', () => {
    const old = v1();
    const upgraded = migrateCharacter(old);
    expect(upgraded.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION);
    expect(upgraded.state.wardHp).toBe(0);
    expect(upgraded.state.turn).toEqual({ ridersUsed: [] });
    expect(upgraded.state.damage).toBe(0);
    // The stored object is left alone.
    expect(old.schemaVersion).toBe(1);
    expect(old.state.wardHp).toBeUndefined();
  });

  it('returns a current character unchanged', () => {
    const c = newCharacter('Now', 0);
    expect(migrateCharacter(c)).toBe(c);
  });

  it('refuses a character from a newer app', () => {
    const c = { ...newCharacter('Future', 0), schemaVersion: CHARACTER_SCHEMA_VERSION + 1 };
    expect(() => migrateCharacter(c)).toThrow(CharacterVersionError);
  });

  it('refuses a version it has no upgrade for', () => {
    const c = { ...newCharacter('Ancient', 0), schemaVersion: 0 };
    expect(() => migrateCharacter(c)).toThrow(/No upgrade/);
  });
});
