import { nameSourceId, type Ability, type Spell } from '../../../schema/index.ts';
import { normalizeEntries } from '../entries.ts';
import { asArray, isObject, num, strArray, type RawEntity } from '../raw.ts';
import { uidToId } from '../uid.ts';
import { baseFields, type ConvertContext } from './common.ts';

const SCHOOLS: Record<string, string> = {
  A: 'abjuration',
  C: 'conjuration',
  D: 'divination',
  E: 'enchantment',
  V: 'evocation',
  I: 'illusion',
  N: 'necromancy',
  T: 'transmutation',
  P: 'psionic',
};

const SAVE_ABILITY: Record<string, Ability> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
};

function components(raw: unknown): Spell['components'] {
  if (!isObject(raw)) return {};
  const out: Spell['components'] = {};
  if (raw.v === true) out.v = true;
  if (raw.s === true) out.s = true;
  const m = raw.m;
  if (typeof m === 'string') out.m = { text: m };
  else if (isObject(m) && typeof m.text === 'string') {
    out.m = { text: m.text };
    const cost = num(m.cost);
    if (cost !== undefined) out.m.costCp = cost;
    if (m.consume === true) out.m.consumed = true;
  } else if (m === true) out.m = { text: '' };
  return out;
}

function duration(raw: unknown): Spell['duration'] {
  return asArray(raw)
    .filter(isObject)
    .map((d) => {
      const out: Spell['duration'][number] = { type: String(d.type ?? 'special') };
      if (isObject(d.duration)) {
        const amount = num(d.duration.amount);
        if (amount !== undefined) out.amount = amount;
        if (typeof d.duration.type === 'string') out.unit = d.duration.type;
      }
      if (d.concentration === true) out.concentration = true;
      return out;
    });
}

export function convertSpell(raw: RawEntity, ctx: ConvertContext): Spell {
  const level = num(raw.level) ?? 0;
  const spell: Spell = {
    ...baseFields(raw, 'spell', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: (uid) => uidToId.nameSource(uid, 'PHB'),
    }),
    level: Math.max(0, Math.min(9, level)) as Spell['level'],
    school: SCHOOLS[String(raw.school)] ?? String(raw.school ?? ''),
    time: asArray(raw.time)
      .filter(isObject)
      .map((t) => {
        const out: Spell['time'][number] = {
          amount: num(t.number) ?? 1,
          unit: String(t.unit ?? ''),
        };
        if (typeof t.condition === 'string') out.condition = t.condition;
        return out;
      }),
    range: { type: 'special' },
    components: components(raw.components),
    duration: duration(raw.duration),
    ritual: isObject(raw.meta) && raw.meta.ritual === true,
    classIds: [],
    subclassIds: [],
  };

  if (isObject(raw.range)) {
    spell.range = { type: String(raw.range.type ?? 'special') };
    if (isObject(raw.range.distance)) {
      const d: { type: string; amount?: number } = { type: String(raw.range.distance.type ?? '') };
      const amount = num(raw.range.distance.amount);
      if (amount !== undefined) d.amount = amount;
      spell.range.distance = d;
    }
  }
  const higher = normalizeEntries(raw.entriesHigherLevel);
  if (higher.length) spell.higherLevel = higher;
  const damage = strArray(raw.damageInflict);
  if (damage.length) spell.damageTypes = damage;
  const saves = strArray(raw.savingThrow)
    .map((s) => SAVE_ABILITY[s])
    .filter((s): s is Ability => s !== undefined);
  if (saves.length) spell.saves = saves;
  const attack = strArray(raw.spellAttack)[0];
  if (attack === 'M') spell.attack = 'melee';
  else if (attack === 'R') spell.attack = 'ranged';
  return spell;
}
