// Adding an effect of your own to a feature (plan step 7.5): for a homebrew feature, or one the
// app shows only as text. One effect at a time; each says "added by you" where it counts.

import { useState } from 'react';
import { ABILITIES, ABILITY_NAMES, SKILLS, type Effect } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import { RECHARGE_TEXT } from '../actions/labels.ts';
import { skillName, titleCase } from '../components/format.ts';
import inventory from '../inventory/inventory.module.css';
import {
  ARMOR_VALUES,
  BONUS_TARGETS,
  buildCustomEffect,
  DAMAGE_TYPES,
  PROFICIENCY_KINDS,
  RECHARGES,
  WEAPON_VALUES,
  type BonusTarget,
  type CustomFields,
  type CustomKind,
} from './customEffects.ts';

const KINDS: { value: CustomKind; label: string; help: string }[] = [
  { value: 'counter', label: 'Counter', help: 'Uses you spend and get back on a rest.' },
  { value: 'bonus', label: 'Bonus', help: 'A number added to one the sheet shows.' },
  { value: 'resistance', label: 'Resistance', help: 'Resistance to a damage type.' },
  { value: 'proficiency', label: 'Proficiency', help: 'A skill, save, tool, language or gear.' },
];

export function CustomEffectSheet({
  featureName,
  uid,
  onAdd,
}: {
  featureName: string;
  uid: string;
  onAdd: (effect: Effect) => void;
}) {
  const [f, setF] = useState<CustomFields>({
    kind: 'counter',
    name: featureName,
    uses: 1,
    recharge: 'long',
    target: 'ac',
    amount: 1,
    damageType: 'fire',
    category: 'skill',
    value: SKILLS[0]!,
  });
  const set = (patch: Partial<CustomFields>) => setF({ ...f, ...patch });
  const built = buildCustomEffect(f, uid);
  const kind = KINDS.find((k) => k.value === f.kind)!;

  return (
    <div className={inventory.form}>
      <p className={inventory.muted}>
        For what the app doesn’t apply by itself. It counts wherever it applies, marked “added by
        you”, and goes with your backups.
      </p>
      <fieldset className={inventory.field}>
        <legend className={inventory.fieldLabel}>Kind</legend>
        {KINDS.map((k) => (
          <label key={k.value} className={inventory.check}>
            <input
              type="radio"
              name="custom-kind"
              checked={f.kind === k.value}
              onChange={() => set({ kind: k.value })}
            />
            {k.label}
          </label>
        ))}
        <span className={inventory.help}>{kind.help}</span>
      </fieldset>

      {f.kind === 'counter' && (
        <>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>Name</span>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>Uses</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={f.uses}
              onChange={(e) => set({ uses: Number(e.target.value) })}
            />
          </label>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>Recharge</span>
            <select
              value={f.recharge}
              onChange={(e) => set({ recharge: e.target.value as CustomFields['recharge'] })}
            >
              {RECHARGES.map((r) => (
                <option key={r} value={r}>
                  {titleCase(RECHARGE_TEXT[r])}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {f.kind === 'bonus' && (
        <>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>To</span>
            <select
              value={f.target}
              onChange={(e) => set({ target: e.target.value as BonusTarget })}
            >
              {BONUS_TARGETS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>Amount</span>
            <input
              type="number"
              inputMode="numeric"
              value={f.amount}
              onChange={(e) => set({ amount: Number(e.target.value) })}
            />
          </label>
        </>
      )}

      {f.kind === 'resistance' && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Damage type</span>
          <select value={f.damageType} onChange={(e) => set({ damageType: e.target.value })}>
            {DAMAGE_TYPES.map((d) => (
              <option key={d} value={d}>
                {titleCase(d)}
              </option>
            ))}
          </select>
        </label>
      )}

      {f.kind === 'proficiency' && (
        <>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>In</span>
            <select
              value={f.category}
              onChange={(e) => {
                const category = e.target.value as CustomFields['category'];
                set({ category, value: firstValue(category) });
              }}
            >
              {PROFICIENCY_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>Which</span>
            {f.category === 'tool' || f.category === 'language' ? (
              <input
                value={f.value}
                placeholder={f.category === 'tool' ? 'Thieves’ Tools' : 'Sylvan'}
                onChange={(e) => set({ value: e.target.value })}
              />
            ) : (
              <select value={f.value} onChange={(e) => set({ value: e.target.value })}>
                {valuesOf(f.category).map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
          </label>
        </>
      )}

      {'problem' in built && <p className={inventory.warn}>{built.problem}</p>}
      <div className={inventory.actions}>
        <Button
          variant="primary"
          aria-disabled={'problem' in built}
          onClick={() => 'effect' in built && onAdd(built.effect)}
        >
          Add to {featureName}
        </Button>
      </div>
    </div>
  );
}

function valuesOf(category: CustomFields['category']): { value: string; label: string }[] {
  switch (category) {
    case 'skill':
      return SKILLS.map((s) => ({ value: s, label: skillName(s) }));
    case 'save':
      return ABILITIES.map((a) => ({ value: a, label: ABILITY_NAMES[a] }));
    case 'armor':
      return ARMOR_VALUES.map((v) => ({ value: v, label: titleCase(v) }));
    case 'weapon':
      return WEAPON_VALUES.map((v) => ({ value: v, label: `${titleCase(v)} weapons` }));
    default:
      return [];
  }
}

function firstValue(category: CustomFields['category']): string {
  return valuesOf(category)[0]?.value ?? '';
}
