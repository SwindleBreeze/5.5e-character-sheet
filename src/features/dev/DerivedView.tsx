// A plain listing of every derived value with its contributions (plan §9.2, step 3.10), so
// quick-built characters can be checked on a phone before the styled sheet tabs exist.

import type { ReactNode } from 'react';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import type {
  Derived,
  DerivedOutcome,
  DerivedRoll,
  DerivedSheet,
  SourcedValue,
} from '../../engine/derive/types.ts';
import { ABILITIES, ABILITY_NAMES, SKILLS, type EntityKind, type Id } from '../../schema/index.ts';
import page from '../../app/Page.module.css';
import styles from './Dev.module.css';

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** A number that opens to show the parts that make it up. */
function Num({
  label,
  d,
  bonus = false,
  extra,
}: {
  label: string;
  d: Derived;
  bonus?: boolean;
  extra?: ReactNode;
}) {
  return (
    <details className={styles.num}>
      <summary>
        <span>{label}</span>
        <span className={styles.value}>
          {bonus ? signed(d.value) : d.value}
          {extra}
        </span>
      </summary>
      <ul className={styles.parts}>
        {d.parts.map((p, i) => (
          <li key={i}>
            <span>
              {p.label}
              {p.kind && p.kind !== 'bonus' ? ` (${p.kind})` : ''}
            </span>
            <span>{p.kind === 'base' || p.kind === 'set' ? p.value : signed(p.value)}</span>
          </li>
        ))}
        {!d.parts.length && <li className={page.muted}>No parts</li>}
      </ul>
    </details>
  );
}

function Roll({ label, r }: { label: string; r: DerivedRoll }) {
  const marks = [
    r.proficiency !== 'none' ? r.proficiency : '',
    r.mode !== 'normal' ? r.mode : '',
    ...r.dice.map((x) => `${x.dice} (${x.label})`),
    r.floor ? `min ${r.floor}` : '',
    ...r.advantage.map((a) => `adv: ${a}`),
    ...r.disadvantage.map((a) => `dis: ${a}`),
  ].filter(Boolean);
  return (
    <Num
      label={label}
      d={r.bonus}
      bonus
      extra={marks.length ? <small className={styles.marks}> {marks.join(', ')}</small> : null}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={page.card}>
      <h2 className={page.cardTitle}>{title}</h2>
      {children}
    </section>
  );
}

function Sourced({ label, list }: { label: string; list: SourcedValue<string>[] }) {
  if (!list.length) return null;
  return (
    <p>
      <strong>{label}:</strong> {list.map((v) => `${v.value} (${v.sources.join(', ')})`).join('; ')}
    </p>
  );
}

function outcome(o: DerivedOutcome): string {
  if ('heal' in o) return `heal ${o.heal}`;
  if ('tempHp' in o) return `temp HP ${o.tempHp}`;
  if ('toggleOn' in o) return `turns on ${o.toggleOn}`;
  if ('restore' in o) return `restore ${o.restore.amount} ${o.restore.label}`;
  return `regain a slot up to level ${o.regainSlot.maxLevel}`;
}

export function DerivedView({ sheet, index }: { sheet: DerivedSheet; index?: ContentIndex }) {
  const name = (kind: EntityKind, id: Id) => index?.get({ kind, id })?.name ?? id;
  const spells = (ids: Id[]) => (ids.length ? ids.map((id) => name('spell', id)).join(', ') : '–');
  const sc = sheet.spellcasting;

  return (
    <div className={styles.derived}>
      <Section title="Summary">
        <p>
          Level {sheet.charLevel}:{' '}
          {sheet.classes
            .map((c) => `${c.name} ${c.level}${c.subclassName ? ` (${c.subclassName})` : ''}`)
            .join(' / ')}
          . Size {sheet.size}.
        </p>
        <Num label="Proficiency bonus" d={sheet.pb} bonus />
        <Num label="Armor Class" d={sheet.ac} extra={<small> {sheet.ac.calculation}</small>} />
        <Num label="Hit point maximum" d={sheet.hp.max} />
        {sheet.hp.ward && <Num label={sheet.hp.ward.name} d={sheet.hp.ward.max} />}
        <p>
          Hit dice:{' '}
          {sheet.hitDice.map((h) => `${h.total - h.used}/${h.total} d${h.faces}`).join(', ')}
        </p>
        {Object.entries(sheet.speed).map(([mode, d]) => (
          <Num key={mode} label={`Speed (${mode})`} d={d} />
        ))}
        <Roll label="Initiative" r={sheet.initiative} />
        <Roll label="Concentration" r={sheet.concentration} />
        <Roll label="Death saves" r={sheet.deathSave} />
        <Num label="Attacks per Attack action" d={sheet.attacksPerAction} />
      </Section>

      <Section title="Abilities">
        {ABILITIES.map((a) => (
          <Num
            key={a}
            label={ABILITY_NAMES[a]}
            d={sheet.abilities[a].score}
            extra={<small> ({signed(sheet.abilities[a].mod)})</small>}
          />
        ))}
      </Section>

      <Section title="Saving throws and checks">
        {ABILITIES.map((a) => (
          <Roll key={a} label={`${ABILITY_NAMES[a]} save`} r={sheet.saves[a]} />
        ))}
        {ABILITIES.map((a) => (
          <Roll key={a} label={`${ABILITY_NAMES[a]} check`} r={sheet.checks[a]} />
        ))}
      </Section>

      <Section title="Skills">
        {SKILLS.map((s) => (
          <Roll key={s} label={`${s} (${sheet.skills[s].ability})`} r={sheet.skills[s]} />
        ))}
        <Num label="Passive Perception" d={sheet.passives.perception} />
        <Num label="Passive Insight" d={sheet.passives.insight} />
        <Num label="Passive Investigation" d={sheet.passives.investigation} />
      </Section>

      <Section title="Proficiencies and defenses">
        <Sourced label="Armor" list={sheet.proficiencies.armor} />
        <Sourced label="Weapons" list={sheet.proficiencies.weapons} />
        <Sourced label="Tools" list={sheet.proficiencies.tools} />
        <Sourced label="Languages" list={sheet.proficiencies.languages} />
        <Sourced label="Weapon mastery" list={sheet.masteries} />
        <Sourced label="Resistances" list={sheet.defenses.resistances} />
        <Sourced label="Immunities" list={sheet.defenses.immunities} />
        <Sourced label="Condition immunities" list={sheet.defenses.conditionImmunities} />
        {sheet.senses.map((s) => (
          <p key={s.value.sense}>
            <strong>{s.value.sense}:</strong> {s.value.range} ft. ({s.sources.join(', ')})
          </p>
        ))}
      </Section>

      <Section title="Attacks">
        {sheet.attacks.map((a) => (
          <div key={a.id} className={styles.block}>
            <strong>
              {a.name}
              {a.ready ? '' : ' (stowed)'}
            </strong>
            <small className={page.muted}>
              {a.range} {a.distance}, {ABILITY_NAMES[a.ability]}
              {a.proficient ? ', proficient' : ''}, crit {a.critRange}–20
              {a.mastery ? `, mastery ${a.mastery.name}` : ''}
            </small>
            {a.toHit && <Roll label="To hit" r={a.toHit} />}
            {a.save && <Num label={`${ABILITY_NAMES[a.save.ability]} save DC`} d={a.save.dc} />}
            <Num
              label={`Damage ${a.damageDice || '–'}${a.versatileDice ? ` (${a.versatileDice} two-handed)` : ''} ${a.damageType}`}
              d={a.damageBonus}
              bonus
            />
            {a.riders.map((r) => (
              <small key={r.id}>
                Rider: {r.name} {r.dice} {r.damageType ?? ''}
                {r.optIn ? ' (opt-in)' : ''}
                {r.oncePerTurn ? ', once per turn' : ''}
                {r.cost ? `, costs ${r.cost.label}` : ''}
              </small>
            ))}
            {a.notes.length > 0 && <small className={page.muted}>{a.notes.join(', ')}</small>}
          </div>
        ))}
      </Section>

      {(sc.casters.length > 0 || sc.granted.length > 0) && (
        <Section title="Spellcasting">
          {sc.casters.map((c) => (
            <div key={c.key} className={styles.block}>
              <strong>
                {c.name} {c.level} ({c.progression}, {ABILITY_NAMES[c.ability]}, up to level{' '}
                {c.maxSpellLevel})
              </strong>
              <Num label="Spell save DC" d={c.dc} />
              <Roll label="Spell attack" r={c.attack} />
              <small>
                Cantrips {c.cantrips.length}/{c.cantripsMax}: {spells(c.cantrips)}
              </small>
              <small>
                Prepared {c.prepared.length}/{c.preparedMax}: {spells(c.prepared)}
              </small>
              {c.alwaysPrepared.length > 0 && (
                <small>Always prepared: {spells(c.alwaysPrepared)}</small>
              )}
              {c.spellbook && (
                <small>
                  Spellbook ({c.spellbook.length}): {spells(c.spellbook)}
                </small>
              )}
            </div>
          ))}
          {sc.slots.length > 0 && (
            <p>Slots: {sc.slots.map((s) => `L${s.level} ${s.max - s.used}/${s.max}`).join(', ')}</p>
          )}
          {sc.pact && (
            <p>
              Pact slots: {sc.pact.max - sc.pact.used}/{sc.pact.max} at level {sc.pact.level}
            </p>
          )}
          {sc.granted.map((g, i) => (
            <small key={i}>
              {name('spell', g.spellId)} ({g.mode}, {g.sourceName}
              {g.usesMax !== undefined ? `, ${g.usesMax - (g.usesUsed ?? 0)}/${g.usesMax}` : ''})
            </small>
          ))}
        </Section>
      )}

      {sheet.resources.length > 0 && (
        <Section title="Resources">
          {sheet.resources.map((r) => (
            <Num
              key={r.key}
              label={`${r.name} (${r.sourceName})`}
              d={r.max}
              extra={
                <small>
                  {' '}
                  max, {r.used} used, {r.recharge}
                  {r.die ? `, ${r.die}` : ''}
                  {r.pool ? ', pool' : ''}
                </small>
              }
            />
          ))}
        </Section>
      )}

      {(sheet.actions.length > 0 || sheet.toggles.length > 0) && (
        <Section title="Actions and toggles">
          {sheet.actions.map((a) => (
            <small key={a.id}>
              <strong>{a.name}</strong> ({a.actionType}, {a.sourceName})
              {a.costs.length ? `; costs ${a.costs.map((c) => c.label).join(', ')}` : ''}
              {a.outcomes.length ? `; ${a.outcomes.map(outcome).join(', ')}` : ''}
              {a.roll ? `; roll ${a.roll}` : ''}
              {a.saveDc !== undefined ? `; DC ${a.saveDc}` : ''}
            </small>
          ))}
          {sheet.toggles.map((t) => (
            <small key={t.toggleId}>
              <strong>{t.name}</strong> (toggle, {t.active ? 'on' : 'off'}, {t.sourceName})
              {t.options.length ? `; options ${t.options.map((o) => o.name).join(', ')}` : ''}
              {t.costs.length ? `; costs ${t.costs.map((c) => c.label).join(', ')}` : ''}
            </small>
          ))}
        </Section>
      )}

      <Section title="Choices and issues">
        {sheet.choices.pending.map((p) => (
          <small key={`${p.offer.key.owner.id}#${p.offer.key.slot}@${p.offer.key.n ?? ''}`}>
            Pending: {p.offer.source.name} – {p.offer.key.slot} ({p.have}/{p.count})
          </small>
        ))}
        {sheet.choices.attention.map((r) => (
          <small key={r.key}>
            Needs attention: {r.key} ({r.status})
          </small>
        ))}
        {sheet.issues.map((i, n) => (
          <small key={n}>
            {i.severity === 'warn' ? 'Warning' : 'Note'}: {i.message}
          </small>
        ))}
        {!sheet.choices.pending.length &&
          !sheet.choices.attention.length &&
          !sheet.issues.length && <p className={page.muted}>Nothing pending, nothing to fix.</p>}
      </Section>
    </div>
  );
}
