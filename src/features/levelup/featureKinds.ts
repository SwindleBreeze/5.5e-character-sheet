// What a new feature adds, in a word or two (plan §9.4): badges on the level-up's feature list,
// read from the derived sheet, so a player sees "Spells", "Bonus Action", "Uses" before reading.

import type { DerivedFeature, DerivedSheet } from '../../engine/derive/types.ts';
import { refKey, type Ref } from '../../schema/index.ts';

const ACTION_WORDS = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction' } as const;

export function featureKinds(feature: DerivedFeature | undefined, sheet: DerivedSheet): string[] {
  if (!feature) return [];
  const key = refKey(feature.ref);
  const mine = (source: Ref | undefined) => !!source && refKey(source) === key;
  const out: string[] = [];
  if (/spellcasting|pact magic/i.test(feature.name)) out.push('Spellcasting');
  if (sheet.spellcasting.granted.some((g) => mine(g.source))) out.push('Spells');
  for (const a of sheet.actions) {
    if (!mine(a.source) || a.actionType === 'other') continue;
    const word = ACTION_WORDS[a.actionType];
    if (!out.includes(word)) out.push(word);
  }
  if (sheet.toggles.some((t) => mine(t.source))) out.push('On/off');
  if (feature.resourceKeys.length) out.push('Uses');
  if (feature.choices.some((c) => c.offer.kind === 'spell')) out.push('Spell choice');
  else if (feature.choices.length) out.push('Choice');
  return out;
}
