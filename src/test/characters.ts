// Hand-built characters on the fixture content, for engine tests (plan §9.2). Phase 3's build
// helpers (step 3.10) make characters from offers; these spell out the log directly so a test
// shows exactly what it is about.

import { newCharacter } from '../db/characterRepo.ts';
import type {
  Ability,
  Character,
  ChoiceRecord,
  EntityKind,
  Id,
  InventoryItem,
  LevelEntry,
  Ref,
} from '../schema/index.ts';

export interface TestClass {
  classId: Id;
  levels: number;
  subclassId?: Id;
  /** Class level at which the subclass is picked. Default 3. */
  subclassAt?: number;
}

export interface TestChoice {
  owner: Ref;
  slot: string;
  values: string[];
  valueKinds?: EntityKind[];
  n?: number;
  /** Character level whose log entry holds the record. Default 1. */
  atLevel?: number;
  via?: ChoiceRecord['via'];
}

export interface TestCharacterSpec {
  name?: string;
  /** Classes in the order their levels were taken: every level of the first, then the next. */
  classes: TestClass[];
  speciesId?: Id;
  backgroundId?: Id;
  scores?: Partial<Record<Ability, number>>;
  choices?: TestChoice[];
  inventory?: Partial<InventoryItem>[];
  /** Rolled HP per character level above 1 (index 0 = level 2); average when absent. */
  hpRolls?: number[];
}

export function choiceRecord(c: TestChoice): ChoiceRecord {
  const record: ChoiceRecord = {
    key:
      c.n === undefined
        ? { owner: c.owner, slot: c.slot }
        : { owner: c.owner, slot: c.slot, n: c.n },
    values: c.values,
    labels: c.values,
    madeAt: 0,
    via: c.via ?? 'creation',
  };
  if (c.valueKinds) record.valueKinds = c.valueKinds;
  return record;
}

export function testCharacter(spec: TestCharacterSpec): Character {
  const character = newCharacter(spec.name ?? 'Test', 0);
  character.baseScores = { ...character.baseScores, ...spec.scores };
  const log: LevelEntry[] = [];
  for (const cls of spec.classes) {
    for (let classLevel = 1; classLevel <= cls.levels; classLevel++) {
      const charLevel = log.length + 1;
      const roll = spec.hpRolls?.[charLevel - 2];
      const entry: LevelEntry = {
        charLevel,
        classRef: { kind: 'class', id: cls.classId },
        classLevel,
        hp:
          charLevel === 1
            ? { mode: 'max' }
            : roll === undefined
              ? { mode: 'avg' }
              : { mode: 'roll', value: roll },
        choices: [],
      };
      if (cls.subclassId && classLevel === (cls.subclassAt ?? 3)) {
        entry.subclassRef = { kind: 'subclass', id: cls.subclassId };
      }
      log.push(entry);
    }
  }
  const first = log[0];
  if (first && spec.speciesId && spec.backgroundId) {
    first.origin = {
      speciesRef: { kind: 'species', id: spec.speciesId },
      backgroundRef: { kind: 'background', id: spec.backgroundId },
    };
  }
  for (const c of spec.choices ?? []) {
    const entry = log[(c.atLevel ?? 1) - 1];
    if (!entry) throw new Error(`No log entry for level ${c.atLevel}`);
    entry.choices.push(choiceRecord(c));
  }
  character.log = log;
  character.inventory = (spec.inventory ?? []).map((item, i) => ({
    uid: `item-${i}`,
    name: item.name ?? item.itemRef?.id ?? 'Item',
    quantity: 1,
    attuned: false,
    ...item,
  }));
  return character;
}
