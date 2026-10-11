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
  type SpellGrant,
} from '../../../schema/index.ts';
import { stripTags } from '../../../richtext/tagRegistry.ts';
import { defenseEffects, spellRef } from '../effectsFromData.ts';
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

/** `{@dice 1d6 + 1}` or a number → `1d6 + 1`; nothing for anything else. */
function amountText(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return undefined;
  const text = stripTags(value).trim();
  return text || undefined;
}

/** Charges, recharge and who can attune: on items, and on the `inherits` of a variant. */
function chargeFields(item: Item, raw: RawEntity) {
  if (typeof raw.charges === 'number') item.charges = raw.charges;
  else {
    const dice = amountText(raw.charges);
    if (dice) item.chargesDice = dice;
  }
  if (typeof raw.recharge === 'string') item.recharge = raw.recharge;
  const amount = amountText(raw.rechargeAmount);
  if (amount) item.rechargeAmount = amount;
  if (raw.reqAttune === true) item.attunement = true;
  else if (typeof raw.reqAttune === 'string') item.attunement = raw.reqAttune;
  const tags = asArray(raw.reqAttuneTags).filter(isObject);
  if (tags.length) item.attunementTags = tags;
}

/**
 * Spells an item casts (5etools `attachedSpells`): paid in its charges (`charges: { "1": […] }`,
 * a cost of 0 is at will), at will, or a number of times a day (`daily: { "1": […] }`, `1e` for
 * each). A plain list or `other` only names spells the text talks about; those stay text.
 */
function attachedSpellEffects(raw: RawEntity): Effect[] {
  const block = isObject(raw.attachedSpells) ? raw.attachedSpells : null;
  if (!block) return [];
  const spells: SpellGrant[] = [];
  const add = (refs: unknown, uses: SpellGrant['uses']) => {
    for (const r of asArray(refs)) {
      if (typeof r !== 'string') continue;
      const ref = spellRef(r);
      spells.push({
        mode: 'innate',
        spell: { id: ref.id },
        ...(uses !== undefined ? { uses } : {}),
        ...(ref.castAtLevel !== undefined ? { castAtLevel: ref.castAtLevel } : {}),
      });
    }
  };
  add(block.will, 'atWill');
  for (const [key, refs] of Object.entries(isObject(block.charges) ? block.charges : {})) {
    const cost = Number(key);
    if (Number.isInteger(cost)) add(refs, cost === 0 ? 'atWill' : { charges: cost });
  }
  for (const [key, refs] of Object.entries(isObject(block.daily) ? block.daily : {})) {
    const count = Number(key.replace(/e$/, ''));
    if (Number.isInteger(count) && count > 0) add(refs, { count, recharge: 'dawn' });
  }
  return spells.length ? [{ type: 'grantSpells', spells }] : [];
}

function itemEffects(raw: RawEntity): Effect[] {
  const out = [...defenseEffects(raw), ...attachedSpellEffects(raw)];
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
    if (typeof raw.ammoType === 'string') weapon.ammoType = uidToId.nameSource(raw.ammoType, 'PHB');
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
    // One weight per compartment; capacities by volume or by item count aren't weights.
    const weights = asArray(raw.containerCapacity.weight).filter(
      (w): w is number => typeof w === 'number',
    );
    if (weights.length) item.containerCapacityLb = weights.reduce((a, b) => a + b, 0);
    if (raw.containerCapacity.weightless === true) item.containerWeightless = true;
    const counts: Record<string, number> = {};
    for (const compartment of asArray(raw.containerCapacity.item).filter(isObject)) {
      for (const [uid, n] of Object.entries(compartment)) {
        if (typeof n !== 'number') continue;
        const id = uidToId.nameSource(uid, 'PHB');
        counts[id] = (counts[id] ?? 0) + n;
      }
    }
    if (Object.keys(counts).length) item.containerItems = counts;
    item.container = true;
  }
  const b = bonuses(raw);
  if (b) item.bonuses = b;
  chargeFields(item, raw);
  if (typeof raw.baseItem === 'string') item.baseItemId = uidToId.nameSource(raw.baseItem, 'DMG');
  item.effects = itemEffects(raw);
  if (typeCode(raw.type) === 'P') item.consumable = 'potion';
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

/** Raw fields of a base item that variant filters never match. */
const NOT_MATCHED = new Set([
  'entries',
  'page',
  'srd',
  'srd52',
  'basicRules',
  'basicRules2024',
  'referenceSources',
  'otherSources',
  'reprintedAs',
  'hasFluff',
  'hasFluffImages',
]);

/**
 * A base item (5etools `baseitem`), the only kind magic variants apply to. It keeps the raw
 * fields their `requires`/`excludes` filters read. Packs ("Arrows (20)") take no variants.
 */
export function convertBaseItem(raw: RawEntity, ctx: ConvertContext): Item {
  const item = convertItem(raw, ctx);
  if (raw.packContents !== undefined) return item;
  const base: NonNullable<Item['variantBase']> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (NOT_MATCHED.has(key) || key.startsWith('_')) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      base[key] = value;
    } else if (Array.isArray(value)) {
      const list = value.map(uidOf).filter((v): v is string => v !== null);
      if (list.length === value.length) base[key] = list;
    }
  }
  item.variantBase = base;
  return item;
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

const LEADING_AN = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * 5etools `{=prop/mods}` in a variant's text. The bonuses come from the variant; the base
 * item's name and damage type aren't known until it is applied, so those read generically.
 */
function variantText(text: string, inherits: RawEntity): string {
  return text.replace(/\{=(\w+)(?:\/(\w+))?\}/g, (_m, prop: string, mods: string = '') => {
    let value =
      prop === 'baseName'
        ? 'item'
        : prop === 'dmgType'
          ? 'the weapon’s damage type'
          : String(inherits[prop] ?? '');
    for (const mod of mods) {
      if (mod === 'a') value = LEADING_AN.has(value[0]?.toLowerCase() ?? '') ? 'an' : 'a';
      else if (mod === 'l') value = value.toLowerCase();
      else if (mod === 'u') value = value.toUpperCase();
      else if (mod === 't') value = value.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return value;
  });
}

function withVariantText(value: unknown, inherits: RawEntity): unknown {
  if (typeof value === 'string') return variantText(value, inherits);
  if (Array.isArray(value)) return value.map((v) => withVariantText(v, inherits));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, withVariantText(v, inherits)]),
    );
  }
  return value;
}

/** A generic variant. Its source, page and text live in `inherits`. */
export function convertMagicVariant(raw: RawEntity, ctx: ConvertContext): Item {
  const inherits = isObject(raw.inherits) ? raw.inherits : {};
  const flat: RawEntity = {
    ...raw,
    source: typeof inherits.source === 'string' ? inherits.source : raw.source,
    page: inherits.page ?? raw.page,
    entries: withVariantText(raw.entries ?? inherits.entries, inherits),
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
  if (raw.edition === 'classic' || raw.edition === 'one') item.variant!.edition = raw.edition;
  if (typeof inherits.namePrefix === 'string') item.variant!.namePrefix = inherits.namePrefix;
  if (typeof inherits.nameSuffix === 'string') item.variant!.nameSuffix = inherits.nameSuffix;
  if (typeof inherits.rarity === 'string' && inherits.rarity !== 'none')
    item.rarity = inherits.rarity;
  const b = bonuses(inherits);
  if (b) item.bonuses = b;
  chargeFields(item, inherits);
  item.effects = itemEffects(inherits);
  return item;
}
