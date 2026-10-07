// The level-up flow's steps (plan §9.4, step 5.2).

import { useId, useState } from 'react';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import type { ClassOption, LevelUpPlan } from '../../engine/build/levelUp.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';
import { EntityView } from '../../richtext/EntitySheet.tsx';
import type { HpGain, Ref } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useRoller } from '../../ui/rollerContext.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import choices from '../choices/choices.module.css';
import { signed } from '../sheet/components/format.ts';
import { EntityCards } from '../wizard/EntityCards.tsx';
import { AboutFlavor, ReadSheet } from '../wizard/Explain.tsx';
import wizard from '../wizard/wizard.module.css';
import type { LevelUpBindings } from './bindings.ts';
import styles from './levelUp.module.css';

function useRead(index: ContentIndex) {
  const ui = useSheet();
  return (ref: Ref) =>
    ui.open({
      key: `levelup:${ref.kind}:${ref.id}`,
      title: index.get(ref)?.name ?? ref.id,
      render: () => <ReadSheet entityRef={ref} index={index} />,
    });
}

/** The class this level goes to: the character's own, or a new one (multiclassing). */
export function ClassStep({
  b,
  options,
  index,
}: {
  b: LevelUpBindings;
  options: ClassOption[];
  index: ContentIndex;
}) {
  const read = useRead(index);
  const selected = b.plan?.classId;
  return (
    <>
      <EntityCards
        label="Classes"
        grouped
        items={options.map((o) => {
          const cls = index.get({ kind: 'class', id: o.classId });
          return {
            id: o.classId,
            name: `${o.name} ${o.classLevel}`,
            group: o.multiclass ? 'A new class (multiclassing)' : 'Your classes',
            ...(o.prereq && !o.prereq.met ? { detail: `Needs ${o.prereq.unmet.join('; ')}` } : {}),
            ...(o.prereq?.met ? { suggested: 'Requirement met' } : {}),
            chips: cls ? [`d${cls.hitDie} hit die`] : [],
          };
        })}
        selected={selected}
        onSelect={(id) => b.chooseClass({ kind: 'class', id })}
        onRead={(id) => read({ kind: 'class', id })}
        expanded={b.plan && <FeaturesList plan={b.plan} index={index} compact />}
      />
      {b.plan?.multiclass && b.plan.prereq && !b.plan.prereq.met && (
        <p className={wizard.notice}>
          The 2024 rules ask for 13 or more in the primary ability of the new class and of every
          class you have: {b.plan.prereq.unmet.join('; ')}. Your DM may allow it anyway.
        </p>
      )}
    </>
  );
}

/** Hit points: the fixed value, a roll of the Hit Die, or a roll typed in. */
export function HpStep({ plan, onHp }: { plan: LevelUpPlan; onHp: (hp: HpGain) => void }) {
  const roller = useRoller();
  const id = useId();
  const con = plan.sheet.abilities.con.mod;
  const value = plan.hp.mode === 'roll' ? plan.hp.value : plan.hpAverage;
  const gain = Math.max(1, value + con);
  const rollDie = () => {
    const r = roller.roll({
      label: `Hit points, level ${plan.charLevel}`,
      expr: `1d${plan.hitDie}`,
    });
    onHp({ mode: 'roll', value: r.total });
  };
  return (
    <section className={choices.choice} aria-label="Hit points">
      <p className={choices.help}>
        Your Hit Die is a d{plan.hitDie}. Take {plan.hpAverage} (half the die, plus one), or roll
        it; then add your Constitution modifier ({signed(con)}). Most tables take the fixed value.
      </p>
      <ul className={choices.options} aria-label="How">
        <li className={choices.option}>
          <label className={choices.check}>
            <input
              type="radio"
              name={id}
              checked={plan.hp.mode !== 'roll'}
              onChange={() => onHp({ mode: 'avg' })}
            />
            <span className={choices.label}>Fixed: {plan.hpAverage}</span>
          </label>
        </li>
        <li className={choices.option}>
          <label className={choices.check}>
            <input type="radio" name={id} checked={plan.hp.mode === 'roll'} onChange={rollDie} />
            <span className={choices.label}>Roll a d{plan.hitDie}</span>
          </label>
          {plan.hp.mode === 'roll' && (
            <span className={styles.rollRow}>
              <RollInput
                die={plan.hitDie}
                value={plan.hp.value}
                onValue={(v) => onHp({ mode: 'roll', value: v })}
              />
              <Button size="sm" onClick={rollDie}>
                Roll again
              </Button>
            </span>
          )}
        </li>
      </ul>
      <p className={styles.gain} aria-live="polite">
        <strong>+{gain}</strong> hit points ({value} {signed(con)} Constitution) · new maximum{' '}
        <strong>{plan.sheet.hp.max.value}</strong>
      </p>
    </section>
  );
}

/** A roll typed in: kept as typed, taken when it is a face of the die. */
export function RollInput({
  die,
  value,
  onValue,
}: {
  die: number;
  value: number;
  onValue: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [shown, setShown] = useState(value);
  // A new roll from the button replaces what was typed.
  if (shown !== value && Number(text) !== value) {
    setShown(value);
    setText(String(value));
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={die}
      aria-label="Rolled"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (Number.isInteger(v) && v >= 1 && v <= die) {
          setShown(v);
          onValue(v);
        }
      }}
    />
  );
}

/** The subclass, when this level is where it is chosen. */
export function SubclassStep({
  plan,
  index,
  onPick,
}: {
  plan: LevelUpPlan;
  index: ContentIndex;
  onPick: (ref: Ref) => void;
}) {
  const read = useRead(index);
  const selected = plan.subclassRef?.id;
  const chosen = selected ? index.get({ kind: 'subclass', id: selected }) : undefined;
  return (
    <EntityCards
      label={plan.cls?.subclassTitle ?? 'Subclasses'}
      items={plan.subclasses.map((s) => ({ id: s.id, name: s.name }))}
      selected={selected}
      onSelect={(id) => onPick({ kind: 'subclass', id })}
      onRead={(id) => read({ kind: 'subclass', id })}
      expanded={
        chosen && (
          <>
            <AboutFlavor entity={chosen} />
            <FeaturesList plan={plan} index={index} only="subclassFeature" />
          </>
        )
      }
    />
  );
}

/** What this level brings, with each feature's text. */
export function FeaturesList({
  plan,
  index,
  compact,
  only,
}: {
  plan: LevelUpPlan;
  index: ContentIndex;
  /** Names only. */
  compact?: boolean;
  only?: 'classFeature' | 'subclassFeature';
}) {
  const features = plan.features.filter((f) => !only || f.ref.kind === only);
  if (!features.length)
    return compact ? (
      <p className={choices.help}>No new features at this level.</p>
    ) : (
      <p className={wizard.notice}>This level brings no new features of its own.</p>
    );
  if (compact)
    return (
      <p className={choices.help}>
        <strong>At this level:</strong> {features.map((f) => f.name).join(', ')}
      </p>
    );
  return (
    <section className={styles.features} aria-label="New features">
      {features.map((f) => {
        const entity = index.get(f.ref);
        return (
          <article key={f.ref.id} className={styles.feature} aria-label={f.name}>
            <h3 className={choices.choiceTitle}>{f.name}</h3>
            {entity && <EntityView entity={entity} bare />}
          </article>
        );
      })}
    </section>
  );
}

/** The level at a glance before it is applied. */
export function ReviewStep({
  plan,
  before,
  todos,
}: {
  plan: LevelUpPlan;
  before: DerivedSheet;
  todos: { text: string }[];
}) {
  const picks = plan.sheet.features
    .flatMap((f) => f.choices)
    .filter((c) => plan.choiceKeys.has(c.key) && c.labels.length);
  const subclass = plan.subclassRef
    ? plan.subclasses.find((s) => s.id === plan.subclassRef!.id)?.name
    : undefined;
  return (
    <section className={choices.choice} aria-label="Summary">
      <dl className={wizard.facts}>
        <dt>Level</dt>
        <dd>
          {plan.charLevel}: {plan.cls?.name ?? plan.classId} {plan.classLevel}
          {plan.multiclass ? ' (new class)' : ''}
        </dd>
        <dt>Hit points</dt>
        <dd>
          {before.hp.max.value} → {plan.sheet.hp.max.value}
        </dd>
        <dt>Proficiency bonus</dt>
        <dd>
          {signed(before.pb.value)}
          {plan.sheet.pb.value !== before.pb.value ? ` → ${signed(plan.sheet.pb.value)}` : ''}
        </dd>
        {subclass && (
          <>
            <dt>Subclass</dt>
            <dd>{subclass}</dd>
          </>
        )}
        <dt>Features</dt>
        <dd>{plan.features.map((f) => f.name).join(', ') || 'None'}</dd>
        {picks.map((c) => (
          <PickRow key={c.key} name={c.offer.source.name} values={c.labels} />
        ))}
      </dl>
      {todos.length > 0 && (
        <p className={wizard.notice}>
          Still to choose: {todos.map((t) => t.text).join(' · ')}. Make these first; then apply the
          level.
        </p>
      )}
    </section>
  );
}

function PickRow({ name, values }: { name: string; values: string[] }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{values.join(', ')}</dd>
    </>
  );
}
