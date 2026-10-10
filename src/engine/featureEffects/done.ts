// Classes whose features are all mapped (plan §10.2): each passes the coverage gate
// (`coverageGate`) on real data, checked by the smoke tests. A class is added here when its
// step in phase 6 is finished; with the 2024 supplements enabled, its supplement subclasses
// pass too (step 6.16).

export const DONE_CLASSES: readonly string[] = [
  'barbarian|xphb',
  'bard|xphb',
  'cleric|xphb',
  'druid|xphb',
  'fighter|xphb',
  'monk|xphb',
  'paladin|xphb',
  'ranger|xphb',
  'rogue|xphb',
  'sorcerer|xphb',
  'warlock|xphb',
  'wizard|xphb',
  // Eberron: Forge of the Artificer (step 6.16).
  'artificer|efa',
];

/** The 2024 books with subclasses (and the Artificer) whose content is mapped (step 6.16). */
export const SUPPLEMENT_SOURCES: readonly string[] = ['EFA', 'FRHoF', 'RHW', 'AU'];

/**
 * 2014 options on 2024 characters (plan step 8.3): the 2024 classes whose 2014 subclasses (those
 * without a 2024 reprint, from every book) are all mapped, and whether every 2014 species and
 * feat is. Each passes the 2014 gate in `tests/smoke/legacyCoverage.test.ts`.
 */
export const LEGACY_DONE: { classes: readonly string[]; species: boolean; feats: boolean } = {
  classes: [
    'barbarian|xphb',
    'bard|xphb',
    'cleric|xphb',
    'ranger|xphb',
    'rogue|xphb',
    'druid|xphb',
    'fighter|xphb',
    'sorcerer|xphb',
    'warlock|xphb',
    'wizard|xphb',
    'monk|xphb',
    'paladin|xphb',
  ],
  species: true,
  feats: true,
};

/**
 * Characters on 2014 rules (plan step 8.6): the 2014 classes whose own features and every
 * subclass's (2024 reprints' originals too) are mapped. Each passes the gate in
 * `tests/smoke/rules2014.test.ts`.
 */
export const RULES_2014_DONE: readonly string[] = ['sorcerer|phb', 'warlock|phb'];
