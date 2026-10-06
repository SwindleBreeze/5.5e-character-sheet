// A blank character (plan §4.4). Pure, so the engine and the database layer can both use it.

import { CHARACTER_SCHEMA_VERSION, type Character } from '../../schema/index.ts';

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
      wardHp: 0,
      turn: { ridersUsed: [] },
    },
    overrides: {},
    details: {},
    notes: '',
    sessionLog: [],
    snapshots: {},
    ui: {},
  };
}
