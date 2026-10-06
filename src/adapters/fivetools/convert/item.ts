// Items: mundane base items, specific magic items, and generic magic variants (`+1 Weapon`),
// which are stored as templates and applied to a base item on demand (plan §1).

import {
  nameSourceId,
  ruleId,
  type Ability,
  type Effect,
  type Item,
  type ItemBonus,
  type ItemKind,
} from '../../../schema/index.ts';
import { defenseEffects } from '../effectsFromData.ts';
import { asArray, isObject, num, strArray, type RawEntity } from '../raw.ts';
import { uidToId } from '../uid.ts';
import { baseFields, type ConvertContext } from './common.ts';

const DAMAGE_TYPES: Record<string, string> = {
  A: 'acid',
  B: 'bludgeoning',
  C: 'cold',
  F: 'fire',
  O: 'force',
  L: 'lightning',
  N: 'necrotic',
  P: 'piercing',
  I: 'poison',
  Y: 'psychic',
  R: 'radiant',
  S: 'slashing',
  T: 'thunder',
};

const KIND_BY_TYPE: Record<string, ItemKind> = {
  M: 'weapon',
  R: 'weapon',
  LA: 'armor',
  MA: 'armor',
  HA: 'armor',
  S: 'shield',
  A: 'ammo',
  AF: 'ammo',
  AT: 'tool',
  T: 'tool',
  GS: 'tool',
  INS: 'tool',
  SCF: 'focus',
  G: 'gear',
  FD: 'gear',
};

const TOOL_TYPES: Record<string, NonNullable<Item['toolType']>> = {
  AT: 'artisan',
  INS: 'instrument',
  GS: 'gamingSet',
  T: 'other',
};

const ARMOR_CATEGORY: Record<string, 'light' | 'medium' | 'heavy'> = {
  LA: 'light',
  MA: 'medium',
  HA: 'heavy',
};

const BONUS_FIELDS: Record<string, ItemBonus> = {
  bonusWeapon: 'weapon',
  bonusWeaponAttack: 'weaponAttack',
  bonusWeaponDamage: 'weaponDamage',
  bonusAc: 'ac',
  bonusSpellAttack: 'spellAttack',
  bonusSpellSaveDc: 'spellSaveDc',
  bonusSavingThrow: 'savingThrow',
  bonusAbilityCheck: 'abilityCheck',
};

/** `M|XPHB` → `M`. */
export function typeCode(raw: unknown): string {
  return typeof raw === 'string' ? (raw.split('|')[0] ?? '') : '';
}

function itemKind(raw: RawEntity): ItemKind {
  const code = typeCode(raw.type);
  if (raw.weapon === true || raw.weaponCategory !== undefined) return 'weapon';
  if (code === 'G' && raw.packContents !== undefined) return 'pack';
  const byType = KIND_BY_TYPE[code];
  if (byType) return byType;
  if (raw.armor === true) return 'armor';
  if (raw.wondrous === true) return 'wondrous';
  return 'other';
}

function uidOf(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (isObject(value) && typeof value.uid === 'string') return value.uid;
  return null;
}

function bonuses(raw: RawEntity): Item['bonuses'] {
  const out: Partial<Record<ItemBonus, number>> = {};
  for (const [field, key] of Object.entries(BONUS_FIELDS)) {
    const n = num(raw[field]);
    if (n !== undefined) out[key] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function itemEffects(raw: RawEntity): Effect[] {
  const out = defenseEffects(raw);
  const ability = isObject(raw.ability) ? raw.ability : null;
  if (ability && isObject(ability.static)) {
    for (const [ab, v] of Object.entries(ability.static)) {
      if (typeof v === 'number') out.push({ type: 'abilitySet', ability: ab as Ability, value: v });
    }
  }
  return out;
}

function fill(item: Item, raw: RawEntity): Item {
  const weight = num(raw.weight);
  if (weight !== undefined) item.weightLb = weight;
  const value = num(raw.value);
  if (value !== undefined) item.valueCp = value;
  if (typeof raw.rarity === 'string' && raw.rarity !== 'none') item.rarity = raw.rarity;
  if (raw.reqAttune === true) item.attunement = true;
  else if (typeof raw.reqAttune === 'string') item.attunement = raw.reqAttune;

  const code = typeCode(raw.type);
  const toolType = TOOL_TYPES[code];
  if (toolType) item.toolType = toolType;
  if (item.itemKind === 'weapon' && typeof raw.dmg1 === 'string') {
    const weapon: NonNullable<Item['weapon']> = {
      category: raw.weaponCategory === 'martial' ? 'martial' : 'simple',
      damage: raw.dmg1,
      damageType: DAMAGE_TYPES[String(raw.dmgType)] ?? String(raw.dmgType ?? ''),
      properties: asArray(raw.property)
        .map(uidOf)
        .filter((u): u is string => u !== null)
        .map((u) => {
          const [abbr = '', source = 'PHB'] = u.split('|');
          return ruleId('itemProperty', abbr, source || 'PHB');
        }),
    };
    if (typeof raw.dmg2 === 'string') weapon.versatile = raw.dmg2;
    if (code === 'R') weapon.ranged = true;
    const mastery = asArray(raw.mastery)
      .map(uidOf)
      .find((u) => u !== null);
    if (mastery) {
      const [name = '', source = 'XPHB'] = mastery.split('|');
      weapon.masteryId = ruleId('mastery', name, source || 'XPHB');
    }
    if (typeof raw.range === 'string') {
      const [normal, long] = raw.range.split('/').map(Number);
      if (normal !== undefined && Number.isFinite(normal)) weapon.range = [normal, long ?? normal];
    }
    item.weapon = weapon;
  }
  const armorCategory = ARMOR_CATEGORY[code];
  if (armorCategory) {
    item.armor = { category: armorCategory, ac: num(raw.ac) ?? 10 };
    const str = num(raw.strength);
    if (str !== undefined) item.armor.strReq = str;
    if (raw.stealth === true) item.armor.stealthDis = true;
  }
  if (item.itemKind === 'shield') item.shieldAc = num(raw.ac) ?? 2;

  const pack = asArray(raw.packContents).flatMap((p) => {
    const uid =
      typeof p === 'string' ? p : isObject(p) && typeof p.item === 'string' ? p.item : null;
    if (!uid) return [];
    return [
      {
        itemId: uidToId.nameSource(uid, 'DMG'),
        quantity: isObject(p) ? (num(p.quantity) ?? 1) : 1,
      },
    ];
  });
  if (pack.length) item.packContents = pack;
  if (isObject(raw.containerCapacity)) {
    const cap = num(asArray(raw.containerCapacity.weight)[0]);
    if (cap !== undefined) item.containerCapacityLb = cap;
  }
  const b = bonuses(raw);
  if (b) item.bonuses = b;
  const charges = num(raw.charges);
  if (charges !== undefined) item.charges = charges;
  if (typeof raw.recharge === 'string') item.recharge = raw.recharge;
  if (typeof raw.baseItem === 'string') item.baseItemId = uidToId.nameSource(raw.baseItem, 'DMG');
  item.effects = itemEffects(raw);
  return item;
}

export function convertItem(raw: RawEntity, ctx: ConvertContext): Item {
  const item: Item = {
    ...baseFields(raw, 'item', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: (uid) => uidToId.nameSource(uid, 'DMG'),
      reprintTag: 'item',
    }),
    itemKind: itemKind(raw),
  };
  return fill(item, raw);
}

/**
 * An item group: a name that stands for several items, such as Arcane Focus or Artisan's Tools.
 * Its members are listed at the end of its text, unless 5etools hides them.
 */
export function convertItemGroup(raw: RawEntity, ctx: ConvertContext): Item {
  const members = strArray(raw.items);
  const listed: RawEntity =
    members.length && raw.itemsHidden !== true
      ? {
          ...raw,
          entries: [
            ...asArray(raw.entries),
            {
              type: 'entries',
              name: 'Items in this group',
              entries: [{ type: 'list', items: members.map((m) => `{@item ${m}}`) }],
            },
          ],
        }
      : raw;
  const item = convertItem(listed, ctx);
  if (members.length) item.groupItemIds = members.map((m) => uidToId.nameSource(m, 'DMG'));
  return item;
}

/** A generic variant. Its source, page and text live in `inherits`. */
export function convertMagicVariant(raw: RawEntity, ctx: ConvertContext): Item {
  const inherits = isObject(raw.inherits) ? raw.inherits : {};
  const flat: RawEntity = {
    ...raw,
    source: typeof inherits.source === 'string' ? inherits.source : raw.source,
    page: inherits.page ?? raw.page,
    entries: raw.entries ?? inherits.entries,
    reprintedAs: inherits.reprintedAs ?? raw.reprintedAs,
  };
  const item: Item = {
    ...baseFields(flat, 'item', nameSourceId(String(flat.name), String(flat.source)), ctx, {
      reprintId: (uid) => uidToId.nameSource(uid, 'DMG'),
      reprintTag: 'item',
    }),
    itemKind: 'variant',
    variant: {
      requires: asArray(raw.requires).filter(isObject),
      inherits,
    },
  };
  if (isObject(raw.excludes)) item.variant!.excludes = raw.excludes;
  if (typeof inherits.namePrefix === 'string') item.variant!.namePrefix = inherits.namePrefix;
  if (typeof inherits.nameSuffix === 'string') item.variant!.nameSuffix = inherits.nameSuffix;
  if (typeof inherits.rarity === 'string' && inherits.rarity !== 'none')
    item.rarity = inherits.rarity;
  const b = bonuses(inherits);
  if (b) item.bonuses = b;
  item.effects = itemEffects(inherits);
  return item;
}
