// The Spells tab (plan §9.2, step 3.18): per caster its ability, save DC, spell attack and
// prepared count; spell slot pips to spend and restore (Pact Magic apart); Concentration;
// spells by level with their markers and free uses. A spell opens its text and the ways to
// cast it; Long Rest casters change their prepared spells; a Wizard's spellbook opens under
// its caster.

import { Fragment, useRef, useState, type ReactNode } from 'react';
import type { DerivedCaster, DerivedSlot } from '../../engine/derive/types.ts';
import {
  endTurn,
  restoreSlot,
  setConcentration,
  setPrepared,
  spendSlot,
} from '../../engine/play/reducers.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { ABILITY_NAMES } from '../../schema/index.ts';
import { RollButton } from './components/RollButton.tsx';
import { SectionHeader } from './components/stats.tsx';
import { useExplain } from './components/useExplain.tsx';
import { nameOf, type SheetBindings } from './sheetBindings.ts';
import { useSpellCasting } from './spells/useSpellCasting.tsx';
import { byLevel, spellLists, type SpellEntry } from './spells/entries.ts';
import { CantripsSheet } from './spells/CantripsSheet.tsx';
import { PrepareSheet } from './spells/PrepareSheet.tsx';
import { SpellbookSheet } from './spells/SpellbookSheet.tsx';
import { levelHeading } from './spells/spellText.ts';
import mainStyles from './MainTab.module.css';
import styles from './spells/spells.module.css';
import { characterSources } from '../../sources/sourceFilter.ts';

const SPELL_ISSUES = new Set([
  'armorUntrained',
  'overPrepared',
  'preparedLevel',
  'notOnList',
  'notInSpellbook',
  'prepSwaps',
]);

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={mainStyles.section} aria-labelledby={`spells-${id}`}>
      <SectionHeader id={`spells-${id}`} title={title} action={action} />
      {children}
    </section>
  );
}

export function SpellsTab({ character, sheet, index, apply }: SheetBindings) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = columnsFor(useContainerWidth(ref));
  const ui = useSheet();
  const explain = useExplain();
  const [openBooks, setOpenBooks] = useState<string[]>([]);
  const sc = sheet.spellcasting;
  const { ready, spellbooks } = spellLists(sheet, index);
  const issues = sheet.issues.filter((i) => SPELL_ISSUES.has(i.code));
  const concentration = character.state.concentration;
  const casting = useSpellCasting({ character, sheet, index, apply });

  if (!sc.casters.length && !ready.length) {
    return <p className={mainStyles.muted}>This character has no spells.</p>;
  }

  const openPrepare = (caster: DerivedCaster) =>
    ui.open({
      key: `prepare:${caster.key}`,
      title: `${caster.name}: prepared spells`,
      render: () => (
        <PrepareSheet
          caster={caster}
          sources={characterSources(character)}
          current={character.state.prepared[caster.key] ?? []}
          onSave={(ids) => {
            ui.close();
            apply((c) => setPrepared(c, caster.key, ids));
          }}
        />
      ),
    });

  const lists = (entries: SpellEntry[], label: string) =>
    byLevel(entries).map(([level, list]) => (
      <div key={`${label}:${level}`}>
        <h3 className={styles.levelTitle}>{level < 0 ? 'Not imported' : levelHeading(level)}</h3>
        <ul
          className={styles.rows}
          aria-label={`${label}: ${level < 0 ? 'not imported' : levelHeading(level)}`}
        >
          {list.map((e) => casting.row(e))}
        </ul>
      </div>
    ));

  const casterBlock = (
    <>
      {issues.length > 0 && (
        <ul className={styles.issues} aria-label="Spell warnings">
          {issues.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      )}
      {concentration && (
        <div className={styles.banner} role="status" aria-label="Concentration">
          <span className={styles.bannerText}>
            Concentrating on <strong>{nameOf(index, concentration.kind, concentration.id)}</strong>
            <br />
            <span className={styles.muted}>
              Taking damage: Constitution save, DC 10 or half the damage (up to 30).
            </span>
          </span>
          <RollButton label="Concentration save" roll={sheet.concentration} />
          <Button size="sm" onClick={() => apply((c) => setConcentration(c, null))}>
            End
          </Button>
        </div>
      )}
      {character.state.turn.slotSpent && (
        <div className={styles.banner} role="status" aria-label="This turn">
          <span className={styles.bannerText}>
            You expended a spell slot this turn; only one per turn can cast a spell.
          </span>
          <Button size="sm" onClick={() => apply(endTurn)}>
            End turn
          </Button>
        </div>
      )}
      {sc.casters.map((c) => (
        <Fragment key={c.key}>
          <CasterCard
            caster={c}
            bookOpen={openBooks.includes(c.key)}
            onExplainDc={() =>
              explain({
                key: `spells.${c.key}.dc`,
                title: `${c.name}: spell save DC`,
                derived: c.dc,
                note: 'When one of your spells calls for a saving throw, the target rolls against this number.',
              })
            }
            onExplainAttack={() =>
              explain({
                key: `spells.${c.key}.attack`,
                title: `${c.name}: spell attack`,
                derived: c.attack.bonus,
                bonus: true,
                note: 'When one of your spells calls for a spell attack, roll a d20 and add this bonus. It hits when the total equals or exceeds the target’s Armor Class.',
              })
            }
            onPrepare={() => openPrepare(c)}
            onAddToBook={() =>
              ui.open({
                key: `spellbook:${c.key}`,
                title: `${c.name}: add to spellbook`,
                render: () => (
                  <SpellbookSheet bindings={{ character, sheet, index, apply }} caster={c} />
                ),
              })
            }
            onCantrips={() =>
              ui.open({
                key: `cantrips:${c.key}`,
                title: `${c.name}: cantrips`,
                render: () => (
                  <CantripsSheet bindings={{ character, sheet, index, apply }} caster={c} />
                ),
              })
            }
            onBook={() =>
              setOpenBooks(
                openBooks.includes(c.key)
                  ? openBooks.filter((k) => k !== c.key)
                  : [...openBooks, c.key],
              )
            }
          />
          {c.spellbook && openBooks.includes(c.key) && (
            <Section id={`book-${c.key}`} title={`${c.name} spellbook`}>
              <p className={styles.muted}>
                A spell that isn’t prepared can’t be cast, except one with the Ritual tag: as a
                Ritual, reading from the book.
              </p>
              <div className={styles.levels}>
                {lists(spellbooks[c.key] ?? [], `${c.name} spellbook`)}
              </div>
            </Section>
          )}
        </Fragment>
      ))}
      {(sc.slots.length > 0 || sc.pact) && (
        <Section id="slots" title="Spell slots">
          <div className={styles.card}>
            {sc.slots.map((s) => (
              <SlotRow
                key={s.level}
                name={`Level ${s.level}`}
                slot={s}
                onSpend={() => apply((c) => spendSlot(c, sheet, { level: s.level }))}
                onRestore={() => apply((c) => restoreSlot(c, { level: s.level }))}
              />
            ))}
            {sc.pact && (
              <SlotRow
                name={`Pact Magic, level ${sc.pact.level}`}
                slot={sc.pact}
                note="Back on a Short or Long Rest"
                onSpend={() =>
                  apply((c) => spendSlot(c, sheet, { level: sc.pact!.level, pact: true }))
                }
                onRestore={() =>
                  apply((c) => restoreSlot(c, { level: sc.pact!.level, pact: true }))
                }
              />
            )}
          </div>
        </Section>
      )}
    </>
  );

  const spellBlock = (
    <Section id="list" title="Spells">
      <div className={styles.levels}>{lists(ready, 'Spells')}</div>
    </Section>
  );

  return (
    <div ref={ref} className={mainStyles.main} data-columns={columns}>
      {columns === 1 ? (
        <div className={mainStyles.column}>
          {casterBlock}
          {spellBlock}
        </div>
      ) : (
        <>
          <div className={mainStyles.column}>{casterBlock}</div>
          <div className={mainStyles.column}>{spellBlock}</div>
        </>
      )}
    </div>
  );
}

function CasterCard({
  caster: c,
  bookOpen,
  onExplainDc,
  onExplainAttack,
  onPrepare,
  onBook,
  onAddToBook,
  onCantrips,
}: {
  caster: DerivedCaster;
  bookOpen: boolean;
  onExplainDc: () => void;
  onExplainAttack: () => void;
  onPrepare: () => void;
  onBook: () => void;
  onAddToBook: () => void;
  onCantrips: () => void;
}) {
  return (
    <section className={styles.card} aria-label={c.name}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          {c.name} <span className="numeric">{c.level}</span>
        </h2>
        <span className={styles.label}>{ABILITY_NAMES[c.ability]}</span>
      </div>
      <div className={styles.stats}>
        <span className={styles.stat}>
          <button type="button" className={styles.statButton} onClick={onExplainDc}>
            Save DC
          </button>
          <span className={`${styles.dc} numeric`}>{c.dc.value}</span>
        </span>
        <span className={styles.stat}>
          <button type="button" className={styles.statButton} onClick={onExplainAttack}>
            Spell attack
          </button>
          <RollButton label={`${c.name} spell attack`} roll={c.attack} />
        </span>
      </div>
      <p className={styles.muted}>
        {c.cantripsMax > 0 && (
          <>
            Cantrips{' '}
            <span className="numeric">
              {c.cantrips.length}/{c.cantripsMax}
            </span>{' '}
            ·{' '}
          </>
        )}
        Prepared{' '}
        <span className="numeric">
          {c.prepared.length}/{c.preparedMax}
        </span>
        {c.alwaysPrepared.length > 0 && <> · {c.alwaysPrepared.length} always prepared</>} · up to
        level {c.maxSpellLevel}
      </p>
      <p className={styles.muted}>
        {c.preparedChange === 'level'
          ? 'You change one prepared spell when you gain a level.'
          : c.swapLimit !== undefined
            ? `After a Long Rest you can replace ${c.swapLimit} prepared spell (${c.swapsSinceRest} replaced since your last).`
            : 'After a Long Rest you can change any number of prepared spells.'}
      </p>
      <div className={styles.actions}>
        {c.preparedChange === 'restLong' && (
          <Button size="sm" onClick={onPrepare}>
            Change prepared
          </Button>
        )}
        {c.spellbook && (
          <Button size="sm" variant="ghost" aria-pressed={bookOpen} onClick={onBook}>
            Spellbook ({c.spellbook.length})
          </Button>
        )}
        {c.spellbook && (
          <Button size="sm" variant="ghost" onClick={onAddToBook}>
            Add to spellbook
          </Button>
        )}
        {c.cantripsMax > 0 && (
          <Button size="sm" variant="ghost" onClick={onCantrips}>
            Change cantrips
          </Button>
        )}
      </div>
    </section>
  );
}

function SlotRow({
  name,
  slot,
  note,
  onSpend,
  onRestore,
}: {
  name: string;
  slot: DerivedSlot;
  note?: string;
  onSpend: () => void;
  onRestore: () => void;
}) {
  const left = slot.max - slot.used;
  return (
    <div className={styles.slotRow} role="group" aria-label={`${name} slots`}>
      <span className={styles.slotName}>{name}</span>
      <span className={styles.pips}>
        {Array.from({ length: slot.max }, (_, i) => {
          const spent = i >= left;
          return (
            <button
              key={i}
              type="button"
              className={styles.pip}
              data-spent={spent}
              aria-label={spent ? `${name}: restore a slot` : `${name}: expend a slot`}
              onClick={spent ? onRestore : onSpend}
            />
          );
        })}
      </span>
      <span className={styles.slotLeft}>
        {left}/{slot.max} left{note ? ` · ${note}` : ''}
      </span>
    </div>
  );
}
