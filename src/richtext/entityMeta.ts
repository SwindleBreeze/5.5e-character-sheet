// Short facts shown above an entity's text in the rule sheet and as list subtitles in the
// library. Pure formatting; values stay tagged strings where they come from content.

import {
  ABILITY_NAMES,
  type Ability,
  type ContentEntity,
  type FacilityHirelings,
  type Prereq,
  type Prereqs,
  type Spell,
} from '../schema/index.ts';

export interface EntityMeta {
  subtitle: string;
  facts: { label: string; value: string }[];
}

const ORDINAL = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

/** `sorcerer|xphb` → `Sorcerer`; `net|gladiator|tst|tst` → `Net`. */
export function nameFromId(id: string): string {
  const raw = (id.split('/').pop() ?? id).split('|')[0] ?? id;
  return raw.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatCoins(cp: number): string {
  if (cp % 100 === 0) return `${(cp / 100).toLocaleString('en')} GP`;
  if (cp % 10 === 0) return `${cp / 10} SP`;
  return `${cp} CP`;
}

const TIME_UNITS: Record<string, string> = { bonus: 'bonus action' };

function spellTime(spell: Spell): string {
  return spell.time
    .map((t) => {
      const unit = TIME_UNITS[t.unit] ?? t.unit;
      const base = `${t.amount} ${unit}${t.amount !== 1 ? 's' : ''}`;
      return t.condition ? `${base}, ${t.condition}` : base;
    })
    .join(' or ');
}

function spellRange(spell: Spell): string {
  const { type, distance } = spell.range;
  const dist =
    distance?.amount !== undefined
      ? `${distance.amount} ${distance.type === 'feet' && distance.amount === 1 ? 'foot' : distance.type}`
      : distance
        ? cap(distance.type)
        : cap(type);
  if (type === 'point' || !distance) return dist;
  return `Self (${dist} ${type})`;
}

function spellComponents(spell: Spell): string {
  const c = spell.components;
  const parts: string[] = [];
  if (c.v) parts.push('V');
  if (c.s) parts.push('S');
  if (c.m) parts.push(c.m.text ? `M (${c.m.text})` : 'M');
  return parts.join(', ');
}

function spellDuration(spell: Spell): string {
  return spell.duration
    .map((d) => {
      if (d.type === 'instant') return 'Instantaneous';
      if (d.type === 'permanent') return 'Until dispelled';
      if (d.type === 'timed' && d.amount !== undefined && d.unit) {
        const span = `${d.amount} ${d.unit}${d.amount !== 1 ? 's' : ''}`;
        return d.concentration ? `Concentration, up to ${span}` : span;
      }
      return cap(d.type);
    })
    .join(' or ');
}

function abilityList(abilities: Ability[]): string {
  return abilities.map((a) => ABILITY_NAMES[a]).join(', ');
}

export function prereqText(p: Prereq): string {
  switch (p.type) {
    case 'level':
      return p.classId ? `Level ${p.level} ${nameFromId(p.classId)}` : `Level ${p.level}+`;
    case 'ability':
      return p.anyOf
        .map((o) =>
          Object.entries(o)
            .map(([a, n]) => `${ABILITY_NAMES[a as Ability] ?? a} ${n}+`)
            .join(' and '),
        )
        .join(' or ');
    case 'proficiency':
      return `${cap(p.value)} ${p.category} proficiency`;
    case 'spellcasting':
      return 'Spellcasting or Pact Magic';
    case 'feature':
    case 'feat':
      return nameFromId(p.ref.id);
    case 'other':
      return p.text;
  }
}

export function prereqsText(prereqs: Prereqs): string {
  return prereqs.map((group) => group.map(prereqText).join(', ')).join('; or ');
}

const FEAT_CATEGORIES: Record<string, string> = {
  origin: 'Origin feat',
  general: 'General feat',
  fightingStyle: 'Fighting Style feat',
  epicBoon: 'Epic Boon feat',
};

const RULE_KINDS: Record<string, string> = {
  variantrule: 'Rule',
  action: 'Action',
  sense: 'Sense',
  skill: 'Skill',
  language: 'Language',
  status: 'Status',
  itemProperty: 'Weapon property',
  condition: 'Condition',
  disease: 'Disease',
  mastery: 'Weapon mastery property',
};

const ALIGNMENT_WORDS: Record<string, string> = {
  L: 'lawful',
  N: 'neutral',
  C: 'chaotic',
  G: 'good',
  E: 'evil',
  U: 'unaligned',
  A: 'any alignment',
};

/** `['L', 'G']` → `Lawful good`; `['N']` → `Neutral`. */
export function alignmentText(codes: string[]): string {
  return cap(codes.map((c) => ALIGNMENT_WORDS[c] ?? c).join(' '));
}

function hirelingsText(list: FacilityHirelings[]): string {
  return list
    .map((h) => {
      const n = h.exact !== undefined ? String(h.exact) : h.min !== undefined ? `${h.min}+` : '';
      return h.space ? `${n} (${h.space})` : n;
    })
    .filter(Boolean)
    .join(', ');
}

export const CHAR_OPTION_TYPES: Record<string, string> = {
  SG: 'Supernatural Gift',
  DG: 'Dark Gift',
  CS: 'Character Secret',
  'RF:B': 'Replacement background feature',
};

export function entityMeta(e: ContentEntity): EntityMeta {
  const facts: EntityMeta['facts'] = [];
  const fact = (label: string, value: string | undefined) => {
    if (value) facts.push({ label, value });
  };

  switch (e.kind) {
    case 'spell': {
      const level =
        e.level === 0 ? `${cap(e.school)} cantrip` : `${ORDINAL[e.level]}-level ${e.school}`;
      fact('Casting time', spellTime(e) + (e.ritual ? ' or ritual' : ''));
      fact('Range', spellRange(e));
      fact('Components', spellComponents(e));
      fact('Duration', spellDuration(e));
      fact('Classes', e.classIds.map(nameFromId).join(', '));
      return { subtitle: e.ritual ? `${level} (ritual)` : level, facts };
    }
    case 'item': {
      const kind = e.itemKind === 'variant' ? 'Magic item template' : cap(e.itemKind);
      const rarity = e.rarity ? `, ${e.rarity}` : '';
      const attune = e.attunement
        ? ` (requires attunement${typeof e.attunement === 'string' ? ` ${e.attunement}` : ''})`
        : '';
      if (e.weapon) {
        const w = e.weapon;
        fact(
          'Damage',
          `${w.damage} ${w.damageType}${w.versatile ? ` (versatile ${w.versatile})` : ''}`,
        );
        fact('Properties', w.properties.map(nameFromId).join(', '));
        fact('Mastery', w.masteryId ? nameFromId(w.masteryId) : undefined);
        fact('Range', w.range ? `${w.range[0]}/${w.range[1]} ft.` : undefined);
      }
      if (e.armor)
        fact(
          'Armor class',
          `${e.armor.ac}${e.armor.category === 'light' ? ' + Dex' : e.armor.category === 'medium' ? ' + Dex (max 2)' : ''}`,
        );
      if (e.shieldAc) fact('Armor class', `+${e.shieldAc}`);
      fact('Weight', e.weightLb !== undefined ? `${e.weightLb} lb.` : undefined);
      fact('Cost', e.valueCp !== undefined ? formatCoins(e.valueCp) : undefined);
      return { subtitle: kind + rarity + attune, facts };
    }
    case 'feat':
      fact('Prerequisite', prereqsText(e.prerequisites));
      return { subtitle: FEAT_CATEGORIES[e.category] ?? 'Feat', facts };
    case 'optionalFeature':
      fact('Prerequisite', prereqsText(e.prerequisites));
      return { subtitle: e.featureTypes.join(', '), facts };
    case 'class':
      fact('Hit die', `d${e.hitDie}`);
      fact('Primary ability', e.primaryAbility.map(abilityList).join(' or '));
      fact('Saving throws', abilityList(e.saves));
      return { subtitle: 'Class', facts };
    case 'subclass':
      return { subtitle: `${nameFromId(e.classId)} subclass`, facts };
    case 'classFeature':
      return { subtitle: `Level ${e.level} ${nameFromId(e.classId)} feature`, facts };
    case 'subclassFeature':
      return { subtitle: `Level ${e.level} ${nameFromId(e.subclassId)} feature`, facts };
    case 'species':
      fact('Size', e.size.join(' or '));
      fact(
        'Speed',
        Object.entries(e.speed)
          .map(([mode, ft]) => (mode === 'walk' ? `${ft} ft.` : `${mode} ${ft} ft.`))
          .join(', '),
      );
      fact('Creature type', cap(e.creatureType));
      return { subtitle: 'Species', facts };
    case 'background':
      fact(
        'Ability scores',
        [...new Set(e.abilityOptions.flatMap((o) => o.from))]
          .map((a) => ABILITY_NAMES[a])
          .join(', '),
      );
      fact('Feat', e.featId ? nameFromId(e.featId) : undefined);
      return { subtitle: 'Background', facts };
    case 'rule':
      return { subtitle: RULE_KINDS[e.ruleKind] ?? 'Rule', facts };
    case 'deity':
      fact('Pantheon', e.category ? `${e.pantheon} (${e.category})` : e.pantheon);
      fact('Alignment', alignmentText(e.alignment));
      fact('Domains', e.domains.join(', '));
      fact('Province', e.province);
      fact('Symbol', e.symbol);
      fact('Also called', e.altNames?.join(', '));
      return { subtitle: e.title ? cap(e.title) : `${e.pantheon} deity`, facts };
    case 'reward':
      fact('Bastion facility', e.facilityIds?.map(nameFromId).join(', '));
      return { subtitle: e.rarity ? `${e.rewardType}, ${e.rarity}` : e.rewardType, facts };
    case 'facility':
      fact('Prerequisite', prereqsText(e.prerequisites));
      fact('Space', e.space.map(cap).join(', '));
      fact('Hirelings', hirelingsText(e.hirelings));
      fact('Orders', e.orders.map(cap).join(', '));
      return {
        subtitle:
          e.facilityType === 'basic'
            ? 'Basic facility'
            : `Special facility${e.level ? `, level ${e.level}` : ''}`,
        facts,
      };
    case 'charOption':
      fact('Prerequisite', prereqsText(e.prerequisites));
      return {
        subtitle: e.optionTypes.map((t) => CHAR_OPTION_TYPES[t] ?? t).join(', '),
        facts,
      };
  }
}
