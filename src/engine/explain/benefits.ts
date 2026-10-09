// What a class, background, species, lineage or feat gives a character, in plain words (plan
// §9.3b, step 4B.2). Built from the entity's data and effects, with a line of what it means
// where a newcomer would ask; named traits (Breath Weapon, Trance) come with the first sentence
// of their own text. The explanations are this app's words; anything quoted comes from the
// imported content itself. Pure.

import {
  ABILITY_NAMES,
  type Ability,
  type Background,
  type ClassDef,
  type ContentEntity,
  type Effect,
  type Entry,
  type Feat,
  type Species,
  type SpellGrant,
} from '../../schema/index.ts';
import { firstSentence, prereqsText } from '../../richtext/entityMeta.ts';
import { stripTags } from '../../richtext/tagRegistry.ts';
import { equipmentOptionText } from '../build/equipment.ts';
import { primaryText } from '../build/scores.ts';
import { readable } from '../choices/options.ts';
import { creationLanguageEffects } from '../collect/collect.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { SIZE_NAMES } from '../items/items.ts';
import { cantripCount, maxSpellLevel, preparedCount } from '../spells/casters.ts';

export { firstSentence };

export interface Benefit {
  /** What it is: `Hit points`, `Darkvision`, `Breath Weapon`. */
  label: string;
  text: string;
  /** What it means for the character, where a newcomer would ask. */
  why?: string;
  /** A named trait from the entity's text (listed apart, under "Traits"). */
  trait?: boolean;
  /** A trait's full text: `text` is its first sentence. */
  entries?: Entry[];
}

const WHY = {
  hp: 'Hit points are how much harm you can take; at 0 you fall unconscious.',
  primary: 'Put your highest score here: your main attacks or spells use it.',
  saves:
    'Saving throws resist danger (a poison, a spell). Proficient ones add your proficiency bonus (+2 at level 1).',
  skills: 'Proficient skills add your proficiency bonus to checks with them.',
  armor:
    'Armor you are trained with protects you without penalty; untrained armor gives Disadvantage on Strength and Dexterity rolls and stops spellcasting.',
  weapons: 'Proficient weapons add your proficiency bonus to their attack rolls.',
  tools: 'Proficient tools add your proficiency bonus to checks made with them.',
  darkvision:
    'You see in dim light as if it were bright, and in darkness as if it were dim light (in shades of gray).',
  resistance: 'You take half damage of that type.',
  immunity: 'You take no damage of that type.',
  cantrip: 'Cantrips can be cast at will, as often as you like.',
  slots:
    'Spells of level 1 and higher use a spell slot of their level or higher; slots come back after a Long Rest.',
  originFeat: 'A feat is a special talent. Origin feats are the ones you can take at level 1.',
  languages: 'You can speak, read and write them.',
  equipment: 'What you start with; or take the gold to buy your own.',
  size: 'Your size changes how much you carry and some rules about space.',
};

/** `a`, `a and b`, `a, b and c`. */
function andList(values: readonly string[]): string {
  if (values.length <= 2) return values.join(' and ');
  return `${values.slice(0, -1).join(', ')} and ${values.at(-1)}`;
}

function orList(values: readonly string[]): string {
  if (values.length <= 2) return values.join(' or ');
  return `${values.slice(0, -1).join(', ')} or ${values.at(-1)}`;
}

const abilities = (list: readonly Ability[]) => list.map((a) => ABILITY_NAMES[a]);

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const ARMOR: Record<string, string> = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  shield: 'Shields',
};

function trainingText(
  values: readonly string[],
  kind: 'armor' | 'weapon' | 'tool',
  index: ContentIndex,
): string {
  if (!values.length) return 'None';
  return andList(
    values.map((v) => {
      if (v.includes('|')) return nameOf(index, 'item', v);
      if (kind === 'armor') return ARMOR[v] ?? sentence(v);
      if (kind === 'weapon' && (v === 'simple' || v === 'martial')) return `${sentence(v)} weapons`;
      return sentence(v);
    }),
  );
}

/** Named blocks of an entity's text (a species' traits, a feat's benefits). */
export function namedTraits(entries: readonly Entry[]): Benefit[] {
  const out: Benefit[] = [];
  for (const e of entries) {
    if (typeof e !== 'object' || !('entries' in e) || !('name' in e) || !e.name) continue;
    const text = firstSentence(e.entries as Entry[]);
    if (text)
      out.push({ label: stripTags(e.name), text, trait: true, entries: e.entries as Entry[] });
  }
  return out;
}

function nameOf(index: ContentIndex, kind: 'spell' | 'feat' | 'item', id: string): string {
  return index.get({ kind, id })?.name ?? readable(id.split('|')[0] ?? id);
}

function profValue(category: string, value: string, index: ContentIndex): string {
  if (category === 'tool' && value.includes('|')) return nameOf(index, 'item', value);
  return readable(value);
}

const CATEGORY_WORDS: Record<string, [string, string]> = {
  skill: ['skill', 'skills'],
  tool: ['tool', 'tools'],
  language: ['language', 'languages'],
  weapon: ['weapon', 'weapons'],
  armor: ['armor', 'armor'],
  save: ['saving throw', 'saving throws'],
};

function spellGrantText(g: SpellGrant, index: ContentIndex): string {
  const spell = g.spell;
  const what =
    'id' in spell
      ? nameOf(index, 'spell', spell.id)
      : 'all' in spell
        ? `every ${spellFilterWords(spell.all)}`
        : `${spell.count} of your choice${spell.choose ? ` (${spellFilterWords(spell.choose)})` : ''}`;
  const uses =
    g.uses === 'atWill'
      ? ', at will'
      : g.uses === 'ritual'
        ? ', as a ritual'
        : typeof g.uses === 'object' && 'count' in g.uses
          ? `, ${g.uses.count === 1 ? 'once' : `${g.uses.count} times`} per ${g.uses.recharge === 'short' ? 'Short or Long Rest' : 'Long Rest'} without a slot`
          : '';
  const mode =
    g.mode === 'alwaysPrepared'
      ? ' (always prepared)'
      : g.mode === 'expanded'
        ? ' (added to your spell list)'
        : g.mode === 'spellbook'
          ? ' (in your spellbook)'
          : '';
  return `${what}${mode}${uses}`;
}

/** `level=0|class=Wizard` → `Wizard cantrips`; `level=1|class=Cleric` → `level 1 Cleric`. */
function spellFilterWords(filter: string): string {
  const parts = Object.fromEntries(
    filter.split('|').map((p) => {
      const [k = '', v = ''] = p.split('=');
      return [k.trim().toLowerCase(), v.split(';')];
    }),
  ) as Record<string, string[]>;
  // A homebrew `list=` names its classes as `class:<name>`.
  const listed = parts.list?.filter((v) => v.startsWith('class:')).map((v) => v.slice(6));
  const cls =
    parts.class?.join(' or ') ?? parts.subclass?.join(' or ') ?? listed?.join(' or ') ?? '';
  const levels = parts.level ?? [];
  if (levels.length === 1 && levels[0] === '0') return `${cls} cantrips`.trim();
  const lvl = levels.length ? `level ${levels.join(' or ')} ` : '';
  return `${lvl}${cls} spells`.trim();
}

const atLevelText = (level: number) => (level > 1 ? ` (from level ${level})` : '');

/** One effect, or a group of nested ones, in words. */
export function effectBenefits(
  effects: readonly Effect[],
  index: ContentIndex,
  level = 1,
): Benefit[] {
  const out: Benefit[] = [];
  const at = atLevelText(level);
  for (const e of effects) {
    switch (e.type) {
      case 'abilityBonus':
        if (typeof e.ability === 'string')
          out.push({
            label: 'Ability score',
            text: `+${e.value} ${ABILITY_NAMES[e.ability]}${at}`,
          });
        break;
      case 'abilityChoice': {
        const from = Array.isArray(e.choice.from) ? abilities(e.choice.from) : ['any ability'];
        out.push({
          label: 'Ability score',
          text: `+${e.value} to ${e.choice.count === 1 ? 'one' : e.choice.count} of ${orList(from)}${at}`,
          why: `No score can go above ${e.max ?? 20}.`,
        });
        break;
      }
      case 'proficiency': {
        if (typeof e.value !== 'string') break;
        const [one] = CATEGORY_WORDS[e.category] ?? [e.category, e.category];
        out.push({
          label: `${readable(one)} proficiency`,
          text: `${profValue(e.category, e.value, index)}${at}`,
          ...(e.category === 'skill' ? { why: WHY.skills } : {}),
        });
        break;
      }
      case 'proficiencyChoice': {
        const cats = Array.isArray(e.category) ? e.category : [e.category];
        const n = e.choice.count;
        const noun = cats
          .map((c) => (CATEGORY_WORDS[c] ?? [c, c])[Number(n) === 1 ? 0 : 1])
          .join(' or ');
        const kind = e.filter ? `${e.filter.split('|').map(readable).join(' or ')} ` : '';
        const from = Array.isArray(e.choice.from)
          ? `: ${orList(e.choice.from.map((v) => profValue(cats[0] ?? 'skill', v, index)))}`
          : '';
        out.push({
          label: `${readable((CATEGORY_WORDS[cats[0] ?? 'skill'] ?? ['', 'Proficiencies'])[1])}`,
          text: `Choose ${n} ${kind}${noun}${from}${at}`,
          ...(cats.includes('skill') ? { why: WHY.skills } : {}),
        });
        break;
      }
      case 'expertise':
        if (typeof e.skill === 'string')
          out.push({
            label: 'Expertise',
            text: `${readable(e.skill)}${at}`,
            why: 'Double your proficiency bonus with it.',
          });
        break;
      case 'expertiseChoice':
        out.push({
          label: 'Expertise',
          text: `Choose ${e.choice.count} skill${e.choice.count === 1 ? '' : 's'} you are proficient in${at}`,
          why: 'Double your proficiency bonus with them.',
        });
        break;
      case 'sense':
        out.push({
          label: readable(e.sense),
          text: `${e.range} ft.${at}`,
          ...(e.sense === 'darkvision' ? { why: WHY.darkvision } : {}),
        });
        break;
      case 'speed':
        if (e.value !== 'walk' && typeof e.value === 'number')
          out.push({
            label: e.mode === 'walk' ? 'Speed' : `${readable(e.mode)} speed`,
            text: `${e.value} ft.${at}`,
          });
        else if (e.value === 'walk')
          out.push({ label: `${readable(e.mode)} speed`, text: `Equal to your Speed${at}` });
        break;
      case 'speedBonus':
        if (typeof e.value === 'number') out.push({ label: 'Speed', text: `+${e.value} ft.${at}` });
        break;
      case 'resistance':
      case 'immunity':
      case 'conditionImmunity':
        if (typeof e.value === 'string')
          out.push({
            label: e.type === 'resistance' ? 'Resistance' : 'Immunity',
            text: `${readable(e.value)}${e.type === 'conditionImmunity' ? ' (condition)' : ' damage'}${at}`,
            why:
              e.type === 'resistance'
                ? WHY.resistance
                : e.type === 'immunity'
                  ? WHY.immunity
                  : undefined,
          } as Benefit);
        break;
      case 'resistanceChoice':
        out.push({
          label: 'Resistance',
          text: `Choose ${e.choice.count}: ${orList(
            (Array.isArray(e.choice.from) ? e.choice.from : []).map(readable),
          )}${at}`,
          why: WHY.resistance,
        });
        break;
      case 'grantSpells':
        for (const g of e.spells) {
          const l = g.atLevel ?? level;
          out.push({
            label: 'Spell',
            text: `${spellGrantText(g, index)}${atLevelText(l)}`,
          });
        }
        break;
      case 'grantFeat':
        out.push({ label: 'Feat', text: nameOf(index, 'feat', e.feat.id), why: WHY.originFeat });
        break;
      case 'featChoice':
        out.push({
          label: 'Feat',
          text: `Choose ${e.count ?? 1} ${e.categories.length ? `${e.categories.map(readable).join(' or ')} ` : ''}feat${at}`,
          why: WHY.originFeat,
        });
        break;
      case 'optionChoice':
        out.push({
          label: 'Choice',
          text: `Choose ${e.choice.count === 1 ? 'one' : e.choice.count}: ${orList(
            e.labels.map((l) => SIZE_NAMES[l as keyof typeof SIZE_NAMES] ?? l),
          )}${at}`,
        });
        break;
      case 'hpBonus':
        out.push({
          label: 'Hit points',
          text: [
            e.flat !== undefined ? `+${e.flat}` : '',
            e.perLevel !== undefined ? `+${e.perLevel} per level` : '',
          ]
            .filter(Boolean)
            .join(', '),
        });
        break;
      case 'initiativeBonus':
        out.push({ label: 'Initiative', text: `+${e.value}` });
        break;
      case 'carrySize':
        out.push({
          label: 'Carrying',
          text: `Count as ${e.steps === 1 ? 'one size' : `${e.steps} sizes`} larger for what you can carry`,
        });
        break;
      case 'resource':
        out.push({
          label: e.name,
          text: `${e.max} use${e.max === 1 ? '' : 's'}, back after a ${e.recharge === 'short' ? 'Short or Long Rest' : 'Long Rest'}`,
        });
        break;
      case 'atLevel':
        out.push(...effectBenefits(e.effects, index, e.level));
        break;
      default:
        break;
    }
  }
  return out;
}

export function classBenefits(cls: ClassDef, index: ContentIndex): Benefit[] {
  const start = cls.startingProficiencies;
  const avg = cls.hitDie / 2 + 1;
  const out: Benefit[] = [
    {
      label: 'Hit points',
      text: `${cls.hitDie} + your Constitution modifier at level 1; then ${avg} (or 1d${cls.hitDie}) + your Constitution modifier each level`,
      why: WHY.hp,
    },
    { label: 'Primary ability', text: primaryText(cls), why: WHY.primary },
    { label: 'Saving throws', text: andList(abilities(cls.saves)), why: WHY.saves },
  ];
  const skills = start.skills;
  if (skills) {
    const from = Array.isArray(skills.from) ? `: ${orList(skills.from.map(readable))}` : ' (any)';
    out.push({ label: 'Skills', text: `Choose ${skills.count}${from}`, why: WHY.skills });
  }
  out.push({
    label: 'Armor training',
    text: trainingText(start.armor, 'armor', index),
    why: WHY.armor,
  });
  out.push({
    label: 'Weapons',
    text: trainingText(start.weapons, 'weapon', index),
    why: WHY.weapons,
  });
  if (start.tools.length)
    out.push({ label: 'Tools', text: trainingText(start.tools, 'tool', index), why: WHY.tools });
  const sc = cls.spellcasting;
  if (sc) {
    const cantrips = cantripCount(sc, cls, 1);
    const prepared = preparedCount(sc, cls, 1);
    const top = maxSpellLevel(sc, cls, 1);
    const parts = [
      `uses ${ABILITY_NAMES[sc.ability]}`,
      cantrips ? `${cantrips} cantrips` : '',
      prepared && top
        ? `${prepared} level 1 spells ${sc.preparedChange === 'level' ? 'known (changed when you gain a level)' : 'prepared (changed after a Long Rest)'}`
        : '',
      sc.spellbookByLevel?.length ? 'a spellbook to prepare from' : '',
    ].filter(Boolean);
    out.push({
      label: sc.progression === 'pact' ? 'Pact Magic' : 'Spellcasting',
      text: parts.join(', '),
      why: `${cantrips ? `${WHY.cantrip} ` : ''}${WHY.slots}`,
    });
  }
  const first = cls.features
    .filter((f) => f.level === 1)
    .map((f) => index.get({ kind: 'classFeature', id: f.featureId }))
    .filter((f) => f !== undefined);
  if (first.length)
    out.push({
      label: 'Level 1 features',
      text: andList(first.map((f) => f.name)),
    });
  cls.startingEquipment.forEach((o) =>
    out.push({
      label: `Equipment ${o.key}`,
      text: equipmentOptionText(o, index),
      ...(o.key === 'A' ? { why: WHY.equipment } : {}),
    }),
  );
  if (cls.subclassLevel > 1)
    out.push({
      label: cls.subclassTitle || 'Subclass',
      text: `Chosen at level ${cls.subclassLevel}`,
    });
  return out;
}

export function backgroundBenefits(bg: Background, index: ContentIndex): Benefit[] {
  const out: Benefit[] = [];
  const from = [...new Set(bg.abilityOptions.flatMap((o) => o.from))];
  if (from.length)
    out.push({
      label: 'Ability scores',
      text: `+2 to one and +1 to another, or +1 to each, of ${andList(abilities(from))}`,
      why: 'No score can go above 20.',
    });
  if (bg.featId) {
    const feat = index.get({ kind: 'feat', id: bg.featId });
    out.push({
      label: 'Origin feat',
      text: feat?.name ?? nameOf(index, 'feat', bg.featId),
      why: WHY.originFeat,
    });
  }
  out.push(
    ...tidy(
      effectBenefits(
        bg.effects.filter((e) => e.type !== 'grantFeat'),
        index,
      ),
    ),
  );
  const languages = creationLanguageEffects(bg);
  if (languages.length)
    out.push({
      label: 'Languages',
      text: 'Common, and choose 2 Standard languages',
      why: WHY.languages,
    });
  bg.equipment.forEach((o) =>
    out.push({
      label: `Equipment ${o.key}`,
      text: equipmentOptionText(o, index),
      ...(o.key === 'A' ? { why: WHY.equipment } : {}),
    }),
  );
  return out;
}

export function speciesBenefits(species: Species, index: ContentIndex): Benefit[] {
  const out: Benefit[] = [];
  if (species.creatureType)
    out.push({ label: 'Creature type', text: readable(species.creatureType) });
  out.push({
    label: 'Size',
    text: orList(species.size.map((s) => SIZE_NAMES[s] ?? s)),
    why: WHY.size,
  });
  out.push(...effectBenefits(species.effects, index));
  out.push(...namedTraits(species.entries));
  return tidy(out);
}

/** What a lineage or ancestry has that its species alone doesn't. */
export function lineageBenefits(
  lineage: Species,
  species: Species | undefined,
  index: ContentIndex,
): Benefit[] {
  const all = speciesBenefits(lineage, index);
  if (!species) return all;
  const base = new Set(speciesBenefits(species, index).map((b) => `${b.label}|${b.text}`));
  return all.filter((b) => !base.has(`${b.label}|${b.text}`));
}

export function featBenefits(feat: Feat, index: ContentIndex): Benefit[] {
  const out: Benefit[] = [];
  // Homebrew feats may have no category.
  if (feat.category) out.push({ label: 'Category', text: readable(feat.category) });
  if (feat.prerequisites.length)
    out.push({ label: 'Prerequisite', text: stripTags(prereqsText(feat.prerequisites)) });
  if (feat.repeatable) out.push({ label: 'Repeatable', text: 'You can take it more than once' });
  out.push(...effectBenefits(feat.effects, index));
  out.push(...namedTraits(feat.entries));
  return tidy(out);
}

/** The summary for any entity this module knows; empty for others. */
export function benefitsOf(entity: ContentEntity, index: ContentIndex): Benefit[] {
  switch (entity.kind) {
    case 'class':
      return classBenefits(entity, index);
    case 'background':
      return backgroundBenefits(entity, index);
    case 'species': {
      const parent = entity.variantOf
        ? index.get({ kind: 'species', id: entity.variantOf })
        : undefined;
      return parent ? lineageBenefits(entity, parent, index) : speciesBenefits(entity, index);
    }
    case 'feat':
      return featBenefits(entity, index);
    default:
      return [];
  }
}

/**
 * One line per thing: repeats dropped, single proficiencies of a kind joined (`Insight and
 * Religion`), and a named trait left out when a line of the same name already says it.
 */
function tidy(list: Benefit[]): Benefit[] {
  const out: Benefit[] = [];
  const seen = new Set<string>();
  for (const b of list) {
    const key = `${b.label}|${b.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const same = out.find(
      (o) => !o.trait && !b.trait && o.label === b.label && o.label.endsWith('proficiency'),
    );
    if (same) {
      same.text = `${same.text}, ${b.text}`;
      continue;
    }
    if (b.trait && out.some((o) => !o.trait && o.label.toLowerCase() === b.label.toLowerCase()))
      continue;
    out.push({ ...b });
  }
  return out.map((b) =>
    !b.trait && b.label.endsWith('proficiency') && b.text.includes(', ')
      ? {
          ...b,
          label: `${b.label.replace(/proficiency$/, 'proficiencies')}`,
          text: andList(b.text.split(', ')),
        }
      : b,
  );
}
