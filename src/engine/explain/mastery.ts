// How a weapon's mastery property applies, in this app's own words (plan §9.1: help players
// read their character). A mastery is an extra effect on top of a normal attack; the rules
// text, imported, says what it does, and this says when it happens and who rolls. Pure.

/** When each 2024 mastery applies, by name; other masteries are left to their own text. */
const WHEN: Record<string, string> = {
  cleave: 'On a melee hit, if you choose; once per turn',
  graze: 'When the attack misses; automatic',
  nick: 'Always on, for the Light property’s extra attack',
  push: 'On a hit, if you choose',
  sap: 'On a hit; automatic',
  slow: 'On a hit that deals damage, if you choose',
  topple: 'On a hit, if you choose; the target makes a saving throw',
  vex: 'On a hit that deals damage; automatic',
};

export function masteryWhen(name: string): string | undefined {
  return WHEN[name.trim().toLowerCase()];
}

/** The mastery's text asks the target for a save against a DC worked out from the attack. */
export function masteryHasSave(text: string): boolean {
  return /saving throw/i.test(text) && /\{@dc 8\}/.test(text);
}

/** Who rolls the save and what the DC means; `dc` when it is known (the Actions tab). */
export function masterySaveNote(dc?: number): string {
  const yours =
    dc !== undefined
      ? `Your DC is ${dc} (8 + the attack’s ability modifier + your Proficiency Bonus).`
      : 'The DC (Difficulty Class) is 8 + the attack’s ability modifier + your Proficiency Bonus.';
  return `${yours} The target rolls the save, not you: if its total is lower than the DC, the effect happens.`;
}

/** What a mastery is, for the first time a player meets one. */
export const MASTERY_ABOUT =
  'A weapon mastery is an extra effect on top of a normal attack: you roll to hit and for damage as usual, and the mastery applies when it says.';
