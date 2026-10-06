// Optional features (invocations, maneuvers, metamagic…) and rule entries (conditions,
// actions, senses, skills, languages, item properties, weapon masteries, variant rules).

import {
  ABILITIES,
  nameSourceId,
  ruleId,
  type Ability,
  type OptionalFeature,
  type Rule,
  type RuleKind,
} from '../../../schema/index.ts';
import {
  effectsFromData,
  featProgressions,
  optionalFeatureProgressions,
  progressionEffects,
} from '../effectsFromData.ts';
import { asArray, isObject, strArray, type RawEntity } from '../raw.ts';
import { uidToId } from '../uid.ts';
import { baseFields, consumesOf, type ConvertContext } from './common.ts';
import { prerequisites } from './origin.ts';

export function convertOptionalFeature(raw: RawEntity, ctx: ConvertContext): OptionalFeature {
  const feature: OptionalFeature = {
    ...baseFields(raw, 'optionalFeature', nameSourceId(String(raw.name), String(raw.source)), ctx, {
      reprintId: (uid) => uidToId.nameSource(uid, 'PHB'),
    }),
    featureTypes: strArray(raw.featureType),
    prerequisites: prerequisites(raw),
  };
  const consumes = consumesOf(raw);
  if (consumes) feature.consumes = consumes;
  feature.effects = [
    ...effectsFromData(raw),
    ...progressionEffects(featProgressions(raw), optionalFeatureProgressions(raw)),
  ];
  return feature;
}

/** 5etools record type → rule kind. */
export const RULE_KIND_BY_PROP: Record<string, RuleKind> = {
  condition: 'condition',
  disease: 'disease',
  status: 'status',
  variantrule: 'variantrule',
  action: 'action',
  sense: 'sense',
  skill: 'skill',
  language: 'language',
  itemProperty: 'itemProperty',
  itemMastery: 'mastery',
};

const DEFAULT_SOURCE: Partial<Record<RuleKind, string>> = {
  disease: 'DMG',
  variantrule: 'DMG',
  mastery: 'XPHB',
};

/** Item properties have no name of their own; it is the name of their first entry. */
function itemPropertyName(raw: RawEntity): string {
  if (typeof raw.name === 'string') return raw.name;
  const first = asArray(raw.entries)[0];
  if (isObject(first) && typeof first.name === 'string') return first.name;
  return String(raw.abbreviation ?? '');
}

export function convertRule(raw: RawEntity, ruleKind: RuleKind, ctx: ConvertContext): Rule {
  const source = String(raw.source ?? DEFAULT_SOURCE[ruleKind] ?? 'PHB');
  const isProperty = ruleKind === 'itemProperty';
  const name = isProperty ? itemPropertyName(raw) : String(raw.name);
  const idName = isProperty ? String(raw.abbreviation ?? name) : name;
  const rule: Rule = {
    ...baseFields({ ...raw, name, source }, 'rule', ruleId(ruleKind, idName, source), ctx, {
      reprintId: (uid) => {
        const [n = '', s = source] = uid.split('|');
        return ruleId(ruleKind, n, s || source);
      },
    }),
    ruleKind,
  };
  if (isProperty && typeof raw.abbreviation === 'string') rule.abbreviation = raw.abbreviation;
  if (ruleKind === 'skill' && ABILITIES.includes(raw.ability as Ability)) {
    rule.ability = raw.ability as Ability;
  }
  if (ruleKind === 'language' && typeof raw.type === 'string') rule.languageType = raw.type;
  return rule;
}
