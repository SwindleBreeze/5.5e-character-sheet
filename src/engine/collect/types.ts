// What effect collection produces (plan §9.2, step 3.3).

import type {
  ChoiceKey,
  ChoiceRecord,
  ClassDef,
  Effect,
  Formula,
  Id,
  OptionQuery,
  Ref,
  Retrain,
  Subclass,
} from '../../schema/index.ts';

/** Where an effect came from: its formula context and the label of its contributions. */
export interface EffectSource {
  /** The entity that carries the effect (a feature, a feat, an item…). */
  ref: Ref;
  name: string;
  /** For class and subclass content: the class whose table and level formulas read. */
  classId?: Id;
  subclassId?: Id;
  /** Instance number of a feat taken more than once (plan §4.4). */
  n?: number;
  /** The content is missing, so its effects came from the character's snapshot. */
  fromSnapshot?: boolean;
}

export interface AppliedEffect {
  effect: Effect;
  source: EffectSource;
}

export type OfferKind =
  | 'ability'
  | 'backgroundAbility'
  | 'proficiency'
  | 'expertise'
  | 'resistance'
  | 'option'
  | 'feat'
  | 'optionalFeature'
  | 'featureOptions'
  | 'spell'
  | 'spellAbility'
  | 'weaponMastery'
  | 'equipment';

/** A choice the character's content offers (plan §4.4): keyed, counted, with its options. */
export interface Offer {
  key: ChoiceKey;
  kind: OfferKind;
  /** Picks to make; evaluated against the character when shown or checked. */
  count: Formula;
  from: string[] | 'any' | { query: OptionQuery };
  /** The effect that offers it, for picker details (categories, filters); none if built in. */
  effect?: Effect;
  /** Display labels for `from`, when it has them (option choices). */
  labels?: string[];
  retrain?: Retrain;
  source: EffectSource;
}

export interface RecordAt {
  record: ChoiceRecord;
  /** Index of the log entry holding it. */
  entryIndex: number;
}

export interface ClassLevel {
  classId: Id;
  level: number;
  /** The character's first class (saves, starting proficiencies and equipment). */
  isFirst: boolean;
  /** Missing when the class content is not loaded. */
  cls?: ClassDef;
  subclassId?: Id;
  subclass?: Subclass;
}

export interface Collected {
  effects: AppliedEffect[];
  offers: Offer[];
  /** Each entity whose effects applied, in order. */
  owners: EffectSource[];
  classes: ClassLevel[];
  charLevel: number;
  /** Every choice record in the log by encoded key; a later record wins. */
  records: Map<string, RecordAt>;
  /** Refs of owners that are neither loaded nor snapshotted: their effects are lost. */
  missing: Ref[];
}
