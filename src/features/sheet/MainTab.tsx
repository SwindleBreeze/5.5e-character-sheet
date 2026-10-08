// The Main tab (plan §9.2, step 3.15): hit points, combat numbers, abilities, saves, skills and
// the rest. One column on phones (health and combat first, the things touched most in play),
// two on tablets, three on wide screens. Every number explains itself when tapped; d20 numbers roll.

import { useRef, type ReactNode } from 'react';
import type { Derived, DerivedRoll, SourcedValue } from '../../engine/derive/types.ts';
import {
  deathSave,
  addCondition,
  removeCondition,
  setDeathSaves,
  setExhaustion,
  setHeroicInspiration,
  setHitDiceUsed,
  setOverride,
} from '../../engine/play/reducers.ts';
import {
  ABILITIES,
  ABILITY_NAMES,
  SKILLS,
  type EntityKind,
  type OverrideKey,
  type Skill,
} from '../../schema/index.ts';
import { useSkillRule } from '../../content/hooks.ts';
import { useRoller, d20Expr } from '../../ui/rollerContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import {
  extraDice,
  rollNoteLines,
  signed,
  situationalLines,
  skillName,
  titleCase,
} from './components/format.ts';
import { AbilityCard, RollRow, SectionHeader, StatPill, ValueRow } from './components/stats.tsx';
import { useExplain } from './components/useExplain.tsx';
import {
  ABILITY_ABOUT,
  checkHow,
  MODIFIER_ABOUT,
  OTHER_ABOUT,
  PASSIVE_ABOUT,
  SAVE_ABOUT,
  saveHow,
} from '../../engine/explain/stats.ts';
import { InlineText } from '../../richtext/InlineText.tsx';
import {
  ConditionChips,
  DeathSaves,
  ExhaustionStepper,
  HitDice,
  HpWidget,
  Tiles,
  type ConditionOption,
} from './components/vitals.tsx';
import { useHpActions } from './play/useHpActions.tsx';
import { nameOf, type SheetBindings } from './sheetBindings.ts';
import styles from './MainTab.module.css';

type SectionId =
  'abilities' | 'saves' | 'skills' | 'combat' | 'vitals' | 'senses' | 'defenses' | 'proficiencies';

const LAYOUTS: Record<1 | 2 | 3, SectionId[][]> = {
  1: [['vitals', 'combat', 'abilities', 'saves', 'skills', 'senses', 'defenses', 'proficiencies']],
  2: [
    ['vitals', 'combat', 'abilities', 'saves'],
    ['skills', 'senses', 'defenses', 'proficiencies'],
  ],
  3: [
    ['vitals', 'combat', 'defenses'],
    ['abilities', 'saves', 'senses'],
    ['skills', 'proficiencies'],
  ],
};

function rollNote(r: DerivedRoll): ReactNode {
  const lines = rollNoteLines(r);
  return lines.length ? lines.map((l) => <p key={l}>{l}</p>) : null;
}

/**
 * Situational lines every save has (Fey Ancestry: against being Charmed): said once under the
 * saves rather than marked on all six rows.
 */
function sharedSituational(rolls: DerivedRoll[]): string[] {
  const [first, ...rest] = rolls.map((r) => new Set(situationalLines(r)));
  return first ? [...first].filter((line) => rest.every((set) => set.has(line))) : [];
}

/** The roll as its row shows it: without the situational lines said under the section. */
function withoutShared(roll: DerivedRoll, shared: string[]): DerivedRoll {
  if (!roll.situational || !shared.length) return roll;
  const situational = roll.situational.filter(
    (_, i) => !shared.includes(situationalLines(roll)[i]!),
  );
  return { ...roll, situational };
}

/** A skill's own description, from the imported rules. */
function SkillText({ skill }: { skill: Skill }) {
  const rule = useSkillRule(skill);
  const text = rule?.entries.find((e): e is string => typeof e === 'string');
  return text ? <InlineText text={text} /> : null;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={`main-${id}`}>
      <SectionHeader id={`main-${id}`} title={title} />
      {children}
    </section>
  );
}

export interface MainTabProps extends SheetBindings {
  conditionOptions: ConditionOption[];
}

export function MainTab({ character, sheet, index, apply, conditionOptions }: MainTabProps) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = columnsFor(useContainerWidth(ref));
  const explain = useExplain();
  const roller = useRoller();
  const hpActions = useHpActions({ character, sheet, index, apply });

  const override = (key: OverrideKey) => (value: number | undefined) =>
    apply((c) => setOverride(c, key, value));
  const explainNumber = (
    key: OverrideKey,
    title: string,
    derived: Derived,
    opts: { bonus?: boolean; note?: ReactNode; about?: ReactNode } = {},
  ) => explain({ key, title, derived, ...opts, onOverride: override(key) });
  const explainRoll = (key: OverrideKey, title: string, r: DerivedRoll, about?: ReactNode) =>
    explainNumber(key, title, r.bonus, { bonus: true, note: rollNote(r), about });
  const paragraphs = (...lines: (ReactNode | undefined)[]) =>
    lines.filter(Boolean).map((l, i) => <p key={i}>{l}</p>);

  const names = (kind: EntityKind, list: SourcedValue[]) =>
    list.map((v) => (v.value.includes('|') ? nameOf(index, kind, v.value) : titleCase(v.value)));

  const hp = sheet.hp;
  const conditionName = (id: string) =>
    conditionOptions.find((o) => o.id === id)?.name ?? nameOf(index, 'rule', id);
  const ds = character.state.deathSaves;
  const speedModes = Object.entries(sheet.speed).filter(([mode]) => mode !== 'walk');
  const sharedSaves = sharedSituational(ABILITIES.map((a) => sheet.saves[a]));

  const sections: Record<SectionId, ReactNode> = {
    abilities: (
      <Section id="abilities" title="Abilities">
        <div className={styles.abilities}>
          {ABILITIES.map((a) => (
            <AbilityCard
              key={a}
              ability={a}
              name={ABILITY_NAMES[a]}
              score={sheet.abilities[a].score}
              check={sheet.checks[a]}
              onExplain={() =>
                explainNumber(`score.${a}`, ABILITY_NAMES[a], sheet.abilities[a].score, {
                  note: <p>Modifier {signed(sheet.abilities[a].mod)}</p>,
                  about: paragraphs(ABILITY_ABOUT[a], MODIFIER_ABOUT),
                })
              }
            />
          ))}
        </div>
      </Section>
    ),
    saves: (
      <Section id="saves" title="Saving throws">
        <ul className={styles.rows}>
          {ABILITIES.map((a) => (
            <RollRow
              key={a}
              label={ABILITY_NAMES[a]}
              rollLabel={`${ABILITY_NAMES[a]} save`}
              roll={withoutShared(sheet.saves[a], sharedSaves)}
              onExplain={() =>
                explainRoll(
                  `save.${a}`,
                  `${ABILITY_NAMES[a]} save`,
                  sheet.saves[a],
                  paragraphs(SAVE_ABOUT[a], saveHow(a)),
                )
              }
            />
          ))}
        </ul>
        {sharedSaves.map((line) => (
          <p key={line} className={styles.sectionNote}>
            {line}
          </p>
        ))}
      </Section>
    ),
    skills: (
      <Section id="skills" title="Skills">
        <ul className={styles.rows}>
          {SKILLS.map((s) => (
            <RollRow
              key={s}
              label={skillName(s)}
              ability={sheet.skills[s].ability}
              roll={sheet.skills[s]}
              onExplain={() =>
                explainRoll(
                  `skill.${s}`,
                  skillName(s),
                  sheet.skills[s],
                  paragraphs(
                    <SkillText skill={s} />,
                    checkHow(sheet.skills[s].ability, skillName(s)),
                  ),
                )
              }
            />
          ))}
        </ul>
      </Section>
    ),
    combat: (
      <Section id="combat" title="Combat">
        <div className={styles.pills}>
          <StatPill
            label="Armor Class"
            value={sheet.ac.value}
            sub={sheet.ac.calculation}
            derived={sheet.ac}
            onExplain={() =>
              explainNumber('ac', 'Armor Class', sheet.ac, {
                note: <p>{sheet.ac.calculation}</p>,
                about: paragraphs(OTHER_ABOUT.ac),
              })
            }
          />
          <StatPill
            label="Initiative"
            roll={sheet.initiative}
            derived={sheet.initiative.bonus}
            onExplain={() =>
              explainRoll(
                'initiative',
                'Initiative',
                sheet.initiative,
                paragraphs(OTHER_ABOUT.initiative),
              )
            }
          />
          {sheet.speed.walk && (
            <StatPill
              label="Speed"
              value={sheet.speed.walk.value}
              sub={
                speedModes.length ? speedModes.map(([m, d]) => `${m} ${d.value}`).join(', ') : 'ft.'
              }
              derived={sheet.speed.walk}
              onExplain={() =>
                explainNumber('speed.walk', 'Speed', sheet.speed.walk!, {
                  about: paragraphs(OTHER_ABOUT.speed),
                })
              }
            />
          )}
          <StatPill
            label="Proficiency"
            value={signed(sheet.pb.value)}
            derived={sheet.pb}
            onExplain={() =>
              explainNumber('pb', 'Proficiency bonus', sheet.pb, {
                bonus: true,
                about: paragraphs(OTHER_ABOUT.pb),
              })
            }
          />
          <StatPill
            label="Inspiration"
            value={character.state.heroicInspiration ? '★' : '☆'}
            sub="Heroic"
            pressed={character.state.heroicInspiration}
            onToggle={() => apply((c) => setHeroicInspiration(c, !c.state.heroicInspiration))}
          />
        </div>
        {sheet.attacksPerAction.value > 1 && (
          <p className={styles.muted}>{sheet.attacksPerAction.value} attacks per Attack action</p>
        )}
      </Section>
    ),
    vitals: (
      <Section id="vitals" title="Health">
        <Tiles>
          <HpWidget
            values={{
              current: hp.current,
              max: hp.max.value,
              temp: hp.temp,
              ward: hp.ward && {
                name: hp.ward.name,
                current: hp.ward.current,
                max: hp.ward.max.value,
              },
            }}
            actions={hpActions}
            onExplainMax={() =>
              explainNumber('hpMax', 'Hit point maximum', hp.max, {
                about: paragraphs(OTHER_ABOUT.hpMax),
              })
            }
          />
          <HitDice
            dice={sheet.hitDice}
            onChange={(faces, used) => apply((c) => setHitDiceUsed(c, sheet, faces, used))}
          />
          <ExhaustionStepper
            level={sheet.exhaustion}
            onChange={(n) => apply((c) => setExhaustion(c, n))}
          />
        </Tiles>
        {(hp.current === 0 || ds.successes > 0 || ds.failures > 0) && (
          <div className={styles.block}>
            <h3 className={styles.subTitle}>Death saves</h3>
            <DeathSaves
              successes={ds.successes}
              failures={ds.failures}
              onChange={(saves) => apply((c) => setDeathSaves(c, saves))}
              onRoll={() => {
                const r = roller.roll({
                  label: 'Death save',
                  expr: d20Expr(sheet.deathSave.bonus.value) + extraDice(sheet.deathSave),
                  mode: sheet.deathSave.mode,
                });
                const natural = r.natural === 1 || r.natural === 20 ? r.natural : r.total;
                apply((c) => deathSave(c, sheet, natural));
              }}
            />
          </div>
        )}
        <ConditionChips
          active={sheet.conditions.map((id) => ({ id, name: conditionName(id) }))}
          available={conditionOptions}
          onAdd={(id) => apply((c) => addCondition(c, id))}
          onRemove={(id) => apply((c) => removeCondition(c, id))}
        />
      </Section>
    ),
    senses: (
      <Section id="senses" title="Senses">
        <ul className={styles.rows}>
          {(['perception', 'insight', 'investigation'] as const).map((p) => (
            <ValueRow
              key={p}
              label={`Passive ${titleCase(p)}`}
              derived={sheet.passives[p]}
              onExplain={() =>
                explainNumber(`passive.${p}`, `Passive ${titleCase(p)}`, sheet.passives[p], {
                  about: paragraphs(PASSIVE_ABOUT[p]),
                })
              }
            />
          ))}
        </ul>
        {sheet.senses.length > 0 && (
          <p className={styles.list}>
            {sheet.senses.map((s) => `${titleCase(s.value.sense)} ${s.value.range} ft.`).join(', ')}
          </p>
        )}
      </Section>
    ),
    defenses: (
      <Section id="defenses" title="Defenses">
        <dl className={styles.facts}>
          <Fact label="Resistances" values={names('rule', sheet.defenses.resistances)} />
          <Fact label="Immunities" values={names('rule', sheet.defenses.immunities)} />
          <Fact
            label="Condition immunities"
            values={sheet.defenses.conditionImmunities.map((v) => nameOf(index, 'rule', v.value))}
          />
        </dl>
        {!sheet.defenses.resistances.length &&
          !sheet.defenses.immunities.length &&
          !sheet.defenses.conditionImmunities.length && <p className={styles.muted}>None</p>}
      </Section>
    ),
    proficiencies: (
      <Section id="proficiencies" title="Proficiencies">
        <dl className={styles.facts}>
          <Fact label="Armor" values={names('item', sheet.proficiencies.armor)} always />
          <Fact label="Weapons" values={names('item', sheet.proficiencies.weapons)} always />
          <Fact label="Tools" values={names('item', sheet.proficiencies.tools)} always />
          <Fact label="Languages" values={names('rule', sheet.proficiencies.languages)} always />
          {sheet.masteries.length > 0 && (
            <Fact label="Weapon mastery" values={names('item', sheet.masteries)} />
          )}
        </dl>
      </Section>
    ),
  };

  return (
    <div ref={ref} className={styles.main} data-columns={columns}>
      {LAYOUTS[columns].map((column, i) => (
        <div key={i} className={styles.column}>
          {column.map((id) => (
            <div key={id}>{sections[id]}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Fact({ label, values, always }: { label: string; values: string[]; always?: boolean }) {
  if (!values.length && !always) return null;
  return (
    <div className={styles.fact}>
      <dt>{label}</dt>
      <dd>{values.length ? values.join(', ') : '–'}</dd>
    </div>
  );
}
