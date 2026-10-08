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
];

/** The 2024 books with subclasses (and the Artificer) whose content is mapped (step 6.16). */
export const SUPPLEMENT_SOURCES: readonly string[] = ['EFA', 'FRHoF', 'RHW', 'AU'];
