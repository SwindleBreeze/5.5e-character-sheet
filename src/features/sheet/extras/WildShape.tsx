// Wild Shape (step 7.6): the forms known, picked within the limits the feature's table gives
// (any Beast with "Show every Beast"), and taking one. In a form the sheet shows the Beast's
// stat block next to the character's own numbers that stay; nothing is replaced.

import { useMemo, useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import { scaleContext } from '../../../engine/extras/extras.ts';
import {
  activeForm,
  crText,
  formIssue,
  setActiveForm,
  setWildShapeForms,
  WILD_SHAPE,
  type WildShapeRules,
} from '../../../engine/extras/wildShape.ts';
import { canPayAll } from '../../../engine/play/costs.ts';
import { toggle, type RollAmount } from '../../../engine/play/reducers.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { creatureSpeedText } from '../../../richtext/entityMeta.ts';
import { InSheetContext } from '../../../richtext/inSheet.ts';
import {
  ABILITY_NAMES,
  ABILITIES,
  crValue,
  SKILLS,
  type Ability,
  type Creature,
  type Id,
} from '../../../schema/index.ts';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import { useRoller } from '../../../ui/rollerContext.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import actions from '../actions/actions.module.css';
import { useCostPicker } from '../components/useCostPicker.tsx';
import { signed, skillName } from '../components/format.ts';
import inventory from '../inventory/inventory.module.css';
import { useLiveBindings } from '../liveBindings.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import styles from './extras.module.css';
import { StatBlock } from './StatBlock.tsx';

const byCr = (a: Creature, b: Creature) =>
  (crValue(a.cr) ?? 0) - (crValue(b.cr) ?? 0) || a.name.localeCompare(b.name);

/** `Known forms 2 of 4 · up to CR 1/4 · no Fly Speed`. */
function limitsText(rules: WildShapeRules, known: number): string {
  const parts = [`Known forms ${known}${rules.known !== undefined ? ` of ${rules.known}` : ''}`];
  if (rules.maxCr !== undefined) parts.push(`up to CR ${crText(rules.maxCr)}`);
  parts.push(rules.fly ? 'Fly Speed allowed' : 'no Fly Speed');
  return parts.join(' · ');
}

/** The character's own numbers that stay in a form, all from the sheet. */
function Keeps({ sheet }: { sheet: DerivedSheet }) {
  const dice = sheet.hitDice
    .filter((d) => d.total > 0)
    .map((d) => `${d.total - d.used}d${d.faces}`)
    .join(' + ');
  const mental: Ability[] = ['int', 'wis', 'cha'];
  const saves = ABILITIES.filter((a) => sheet.saves[a].proficiency !== 'none');
  const skills = SKILLS.filter((s) => sheet.skills[s].proficiency !== 'none');
  return (
    <dl className={styles.keeps} aria-label="Your own numbers">
      <div className={styles.line}>
        <dt>Hit Points</dt>
        <dd className="numeric">
          {sheet.hp.current} / {sheet.hp.max.value}
          {sheet.hp.temp > 0 && ` · +${sheet.hp.temp} temp`}
        </dd>
      </div>
      {dice && (
        <div className={styles.line}>
          <dt>Hit Point Dice left</dt>
          <dd className="numeric">{dice}</dd>
        </div>
      )}
      <div className={styles.line}>
        <dt>Scores</dt>
        <dd>
          {mental
            .map(
              (a) =>
                `${ABILITY_NAMES[a]} ${sheet.abilities[a].score.value} (${signed(sheet.abilities[a].mod)})`,
            )
            .join(', ')}
        </dd>
      </div>
      {saves.length > 0 && (
        <div className={styles.line}>
          <dt>Saving throws</dt>
          <dd>
            {saves
              .map((a) => `${ABILITY_NAMES[a]} ${signed(sheet.saves[a].bonus.value)}`)
              .join(', ')}
          </dd>
        </div>
      )}
      {skills.length > 0 && (
        <div className={styles.line}>
          <dt>Skills</dt>
          <dd>
            {skills.map((s) => `${skillName(s)} ${signed(sheet.skills[s].bonus.value)}`).join(', ')}
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Picking the known forms; follows changes made while it is open. */
function FormsSheet({ opened, rules }: { opened: SheetBindings; rules: WildShapeRules }) {
  const { character, apply } = useLiveBindings(opened);
  const all = useEntitiesOfKind('creature');
  const enabled = useEnabledSources(character.enabledSources);
  const [everyBeast, setEveryBeast] = useState(false);
  const [query, setQuery] = useState('');
  const beasts = useMemo(
    () =>
      availableOf(all ?? [], new Set(enabled))
        .filter((c) => c.creatureType === 'beast')
        .sort(byCr),
    [all, enabled],
  );
  if (!all) return <p className={inventory.muted}>Loading Beasts…</p>;

  const known = new Set(character.wildShapeForms ?? []);
  const q = query.trim().toLowerCase();
  const shown = beasts.filter(
    (c) =>
      (everyBeast || known.has(c.id) || !formIssue(c, rules)) &&
      (!q || c.name.toLowerCase().includes(q)),
  );
  const flip = (id: Id) =>
    apply((c) => {
      const now = new Set(c.wildShapeForms ?? []);
      if (now.has(id)) now.delete(id);
      else now.add(id);
      return setWildShapeForms(c, [...now]);
    });
  const over = rules.known !== undefined && known.size > rules.known;

  return (
    <div className={inventory.add}>
      <p className={inventory.muted}>{limitsText(rules, known.size)}</p>
      {over && <p className={inventory.warn}>More known forms than your level allows.</p>}
      <label className={inventory.check}>
        <input
          type="checkbox"
          checked={everyBeast}
          onChange={(e) => setEveryBeast(e.target.checked)}
        />
        Show every Beast (ignore the limits)
      </label>
      <input
        type="search"
        className={inventory.search}
        aria-label="Find a Beast"
        placeholder="Find a Beast"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!shown.length && (
        <p className={inventory.muted}>
          {beasts.length
            ? 'No Beasts match.'
            : 'Your sources have no Beasts. They are in the Monster Manual: turn its source on in Settings → Sources.'}
        </p>
      )}
      <ul className={inventory.results} aria-label="Beasts">
        {shown.map((c) => {
          const issue = formIssue(c, rules);
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`${inventory.result} ${styles.option}`}
                aria-pressed={known.has(c.id)}
                onClick={() => flip(c.id)}
              >
                <span className={styles.check} aria-hidden="true">
                  {known.has(c.id) ? '✓' : ''}
                </span>
                <span>
                  <span className={inventory.resultName}>{c.name}</span>{' '}
                  <span className={inventory.muted}>
                    CR {c.cr ?? '—'} · {creatureSpeedText(c)} · {c.source}
                  </span>
                  {issue && <span className={styles.issue}> · {issue}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FormStatBlock({ opened, id }: { opened: SheetBindings; id: Id }) {
  const { sheet, index } = useLiveBindings(opened);
  const form = index.get({ kind: 'creature', id });
  if (!form) return <p className={inventory.muted}>This form isn’t in your imported content.</p>;
  return (
    <InSheetContext.Provider value={true}>
      <StatBlock creature={form} ctx={scaleContext(sheet, form)} />
    </InSheetContext.Provider>
  );
}

export function WildShapeSection({
  bindings,
  rules,
}: {
  bindings: SheetBindings;
  rules: WildShapeRules;
}) {
  const { character, sheet, index, apply } = bindings;
  const ui = useSheet();
  const roller = useRoller();
  const pay = useCostPicker();
  const rollAmount: RollAmount = (expr, label) => roller.roll({ label, expr }).total;
  const t = rules.toggle;
  const ids = character.wildShapeForms ?? [];
  const forms = ids.map((id) => ({ id, form: index.get({ kind: 'creature', id }) }));
  const current = t.active ? activeForm(character) : undefined;
  const currentForm = current ? index.get({ kind: 'creature', id: current }) : undefined;
  const canPay = canPayAll(sheet, t.costs);
  const uses = sheet.resources.find((r) => r.resourceId === WILD_SHAPE);

  const chooseForms = () =>
    ui.open({
      key: 'wild-shape:forms',
      title: 'Known forms',
      render: () => <FormsSheet opened={bindings} rules={rules} />,
    });
  const read = (id: Id, name: string) =>
    ui.open({
      key: `wild-shape:form:${id}`,
      title: name,
      render: () => <FormStatBlock opened={bindings} id={id} />,
    });
  const rule = () =>
    ui.open({
      key: `wild-shape:rule`,
      title: t.sourceName,
      render: () => <EntitySheet entityRef={t.source} />,
    });
  const take = (id: Id) =>
    pay(sheet, t.costs, { title: t.name, confirm: `Turn on ${t.name}` }, (choice) =>
      apply((c) => toggle(c, sheet, WILD_SHAPE, true, { option: id, rollAmount, choice })),
    );

  return (
    <div className={actions.card}>
      <p className={inventory.muted}>
        {limitsText(rules, ids.length)}
        {uses && ` · ${uses.max.value - uses.used} of ${uses.max.value} uses left`}
      </p>
      {rules.tempHp && (
        <p className={inventory.muted}>
          Taking a form gives you {rules.tempHp} temporary HP (they don’t add to ones you have).
        </p>
      )}
      <div className={styles.buttons}>
        <Button size="sm" onClick={chooseForms}>
          Choose forms
        </Button>
        <Button size="sm" variant="ghost" onClick={rule}>
          Read {t.sourceName}
        </Button>
      </div>

      {t.active ? (
        <section aria-label="In Wild Shape" className={styles.statBlock}>
          <div className={actions.cardHead}>
            <span className={actions.title}>
              <span className={actions.on}>
                In a form{currentForm ? `: ${currentForm.name}` : ''}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => apply((c) => toggle(c, sheet, WILD_SHAPE, false))}
            >
              Leave the form
            </Button>
          </div>
          {!currentForm && (
            <label className={inventory.field}>
              <span className={inventory.fieldLabel}>Which form</span>
              <select
                value=""
                onChange={(e) => e.target.value && apply((c) => setActiveForm(c, e.target.value))}
              >
                <option value="">Choose one</option>
                {forms.map(({ id, form }) => (
                  <option key={id} value={id}>
                    {form?.name ?? id}
                  </option>
                ))}
              </select>
            </label>
          )}
          <h3 className={actions.use}>What stays yours</h3>
          <Keeps sheet={sheet} />
          {currentForm && (
            <>
              <h3 className={actions.use}>{currentForm.name}</h3>
              <StatBlock creature={currentForm} ctx={scaleContext(sheet, currentForm)} />
            </>
          )}
        </section>
      ) : forms.length ? (
        <ul className={actions.list} aria-label="Known forms">
          {forms.map(({ id, form }) => {
            const issue = form ? formIssue(form, rules) : undefined;
            return (
              <li key={id} className={styles.option}>
                <span className={styles.formText}>
                  {form ? (
                    <button
                      type="button"
                      className={actions.name}
                      onClick={() => read(id, form.name)}
                    >
                      {form.name}
                    </button>
                  ) : (
                    <span className={actions.name}>{id}</span>
                  )}
                  {form && (
                    <span className={inventory.muted}>
                      CR {form.cr ?? '—'} · AC {form.ac[0]?.value ?? '—'} · HP{' '}
                      {form.hp.average ?? '—'} · {creatureSpeedText(form)}
                      {issue && <span className={styles.issue}> · {issue}</span>}
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  aria-disabled={!canPay}
                  aria-label={`Take the form of ${form?.name ?? id}`}
                  onClick={() => canPay && take(id)}
                >
                  Take form
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={inventory.muted}>No forms known yet. Choose the Beasts you know.</p>
      )}
      {!t.active && !canPay && <p className={inventory.warn}>No uses left.</p>}
    </div>
  );
}
