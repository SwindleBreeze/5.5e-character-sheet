// The level-up flow's steps (plan §9.4, step 5.2).

import { useId, useState } from 'react';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import type { ClassOption, LevelUpPlan } from '../../engine/build/levelUp.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';
import { EntityView } from '../../richtext/EntitySheet.tsx';
import { Glance } from '../sheet/features/Glance.tsx';
import { glanceResources } from '../sheet/features/glanceResources.ts';
import type { AutoContext } from '../../engine/build/autoChoose.ts';
import type { DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { ChoicePicker } from '../choices/ChoicePicker.tsx';
import { choiceTitle } from '../choices/labels.ts';
import type { PickSave } from '../choices/picks.ts';
import { isSpellOffer } from '../wizard/progress.ts';
import { refKey, type HpGain, type Id, type Ref, type SourceCode } from '../../schema/index.ts';
import { PrepareSheet } from '../sheet/spells/PrepareSheet.tsx';
import { preparingCasters } from './preparing.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { useRoller } from '../../ui/rollerContext.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import choices from '../choices/choices.module.css';
import inventory from '../sheet/inventory/inventory.module.css';
import { signed } from '../sheet/components/format.ts';
import { EntityCards } from '../wizard/EntityCards.tsx';
import { AboutFlavor, ReadSheet } from '../wizard/Explain.tsx';
import wizard from '../wizard/wizard.module.css';
import type { LevelUpBindings } from './bindings.ts';
import { featureKinds } from './featureKinds.ts';
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
  const [ignore, setIgnore] = useState(false);
  const selected = b.plan?.classId;
  const anyUnmet = options.some((o) => o.prereq && !o.prereq.met);
  return (
    <>
      {anyUnmet && (
        <div className={styles.rulesRow}>
          <p className={choices.help}>
            Multiclassing into a class takes 13 or more in its primary ability and in that of every
            class you have (2024 rules). A class you don’t qualify for can’t be taken.
          </p>
          <label className={inventory.check}>
            <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
            Ignore rules (your DM allows it)
          </label>
        </div>
      )}
      <EntityCards
        label="Classes"
        grouped
        items={options.map((o) => {
          const cls = index.get({ kind: 'class', id: o.classId });
          const unmet = o.prereq && !o.prereq.met ? o.prereq.unmet.join('; ') : undefined;
          return {
            id: o.classId,
            name: `${o.name} ${o.classLevel}`,
            group: o.multiclass ? 'A new class (multiclassing)' : 'Your classes',
            ...(unmet
              ? ignore
                ? { detail: `Needs ${unmet}` }
                : { blocked: `You can’t take this level: needs ${unmet}` }
              : {}),
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
          You don’t meet the 2024 requirement for this class: {b.plan.prereq.unmet.join('; ')}. Take
          it only if your DM allows it.
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

/** What this level brings: each feature's name, what it adds, and its text behind Read more. */
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
        const derived = plan.sheet.features.find((x) => refKey(x.ref) === refKey(f.ref));
        const kinds = featureKinds(derived, plan.sheet);
        // Name, what it adds and how it's used at a glance; the text itself folded.
        return (
          <article key={f.ref.id} className={styles.feature} aria-label={f.name}>
            <h3 className={`${choices.choiceTitle} ${styles.featureHead}`}>
              {f.name}
              {kinds.map((k) => (
                <Badge key={k} variant="accent">
                  {k}
                </Badge>
              ))}
            </h3>
            {entity && (
              <Glance entries={entity.entries} resources={glanceResources(derived, plan.sheet)} />
            )}
            {entity && (
              <details className={styles.readMore}>
                <summary>Read more</summary>
                <EntityView entity={entity} bare />
              </details>
            )}
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

/**
 * Earlier picks the rules let change when gaining a level (plan §9.4, step 5.7): known spells,
 * invocations, a Fighting Style… of the class this level is in. Each opens its picker; the
 * change is recorded as a retrain. The rules' "how many" is the feature's to say.
 */
export function RetrainSection({
  plan,
  ctx,
  spells,
  onSave,
}: {
  plan: LevelUpPlan;
  ctx: AutoContext;
  spells: boolean;
  onSave: (choice: DerivedFeatureChoice, pick: PickSave) => void;
}) {
  const earlier = plan.sheet.features
    .filter((f) => f.classId === plan.classId)
    .flatMap((f) => f.choices)
    .filter(
      (c) =>
        c.entryIndex < plan.entryIndex &&
        c.offer.retrain === 'levelUp' &&
        c.values.length > 0 &&
        !plan.choiceKeys.has(c.key) &&
        isSpellOffer(c.offer) === spells,
    );
  if (!earlier.length) return null;
  return (
    <details className={choices.choice}>
      <summary className={choices.choiceTitle}>Change an earlier choice ({earlier.length})</summary>
      <p className={choices.help}>
        Gaining a {plan.cls?.name ?? 'class'} level lets you swap some earlier picks, usually one
        each: the feature’s text says how many.
      </p>
      {earlier.map((c) => (
        <section key={c.key} className={styles.feature} aria-label={`Change ${choiceTitle(c)}`}>
          <h3 className={choices.choiceTitle}>
            {c.offer.source.name === choiceTitle(c)
              ? choiceTitle(c)
              : `${c.offer.source.name}: ${choiceTitle(c)}`}
          </h3>
          <ChoicePicker choice={c} ctx={ctx} showRetrain onSave={(pick) => onSave(c, pick)} />
        </section>
      ))}
    </details>
  );
}

/** Prepared spells after this level: what changed, and the list to prepare from, in place. */
export function PreparedSection({
  plan,
  before,
  sources,
  onPrepared,
}: {
  plan: LevelUpPlan;
  before: DerivedSheet;
  sources: SourceCode[] | null;
  onPrepared: (casterKey: string, ids: Id[]) => void;
}) {
  const casters = preparingCasters(plan, before);
  if (!casters.length) return null;
  return (
    <>
      {casters.map(({ caster, room, higher, slots }) => (
        <section
          key={caster.key}
          className={choices.choice}
          aria-label={`${caster.name}: prepared spells`}
        >
          <h3 className={choices.choiceTitle}>{caster.name}: prepared spells</h3>
          <p className={choices.help}>
            {caster.prepared.length} of {caster.preparedMax} prepared
            {room > 0 ? `: you can prepare ${room} more.` : '.'}
            {higher && ` You can now prepare spells up to level ${caster.maxSpellLevel}.`}
            {slots && ` Your spell slots: ${slots.after} (were ${slots.before || 'none'}).`} You can
            also change them after any Long Rest.
          </p>
          <PrepareSheet
            caster={caster}
            sources={sources}
            current={plan.character.state.prepared[caster.key] ?? []}
            instant
            onSave={(ids) => onPrepared(caster.key, ids)}
          />
        </section>
      ))}
    </>
  );
}
