// The "any …" entries of starting equipment (plan §9.3 step 4.4): 5etools `equipmentType` codes,
// which the adapter keeps as `Any <code>` (`Any instrumentMusical`), in words and as item tests.

import type { EquipmentItemGrant, Item } from '../../schema/index.ts';

export interface EquipmentType {
  /** `any musical instrument`. */
  label: string;
  /** Weapons are the mundane weapon kinds; others any mundane item that matches. */
  weapon?: boolean;
  matches: (item: Item) => boolean;
}

const scf = (type: string) => (i: Item) => i.variantBase?.scfType === type;
const weaponOf =
  (category: 'simple' | 'martial', melee?: boolean) =>
  (i: Item): boolean =>
    i.weapon?.category === category && (melee === undefined || melee === !i.weapon.ranged);

/** 5etools `equipmentType` codes, as the adapter keeps them (`Any instrumentMusical`). */
export const EQUIPMENT_TYPES: Readonly<Record<string, EquipmentType>> = {
  weaponSimple: { label: 'simple weapon', weapon: true, matches: weaponOf('simple') },
  weaponSimpleMelee: {
    label: 'simple melee weapon',
    weapon: true,
    matches: weaponOf('simple', true),
  },
  weaponMartial: { label: 'martial weapon', weapon: true, matches: weaponOf('martial') },
  weaponMartialMelee: {
    label: 'martial melee weapon',
    weapon: true,
    matches: weaponOf('martial', true),
  },
  instrumentMusical: { label: 'musical instrument', matches: (i) => i.toolType === 'instrument' },
  toolArtisan: { label: 'artisan’s tools', matches: (i) => i.toolType === 'artisan' },
  setGaming: { label: 'gaming set', matches: (i) => i.toolType === 'gamingSet' },
  focusSpellcastingArcane: { label: 'arcane focus', matches: scf('arcane') },
  focusSpellcastingDruidic: { label: 'druidic focus', matches: scf('druid') },
  focusSpellcastingHoly: { label: 'holy symbol', matches: scf('holy') },
};

/** The equipment type of an "any …" entry, or undefined for a fixed item. */
export function anyEquipmentType(grant: EquipmentItemGrant): string | undefined {
  if (grant.itemId) return undefined;
  const code = /^Any (\w+)$/.exec(grant.special ?? '')?.[1];
  return code && EQUIPMENT_TYPES[code] ? code : undefined;
}
