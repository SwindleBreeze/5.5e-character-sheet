// Familiars, steeds, companions and summons (step 7.6): one card each with its Armor Class,
// hit points (tap to change them) and speed, the spell level a summon was cast at, what it can
// do (its actions, bonus actions and reactions, with their rolls), and its whole stat block a
// tap away.

import {
  damageExtra,
  extraHp,
  healExtra,
  removeExtra,
  resetExtra,
  scaleContext,
  setExtraHpMax,
  setExtraSpellLevel,
  setExtraTempHp,
} from '../../../engine/extras/extras.ts';
import { scaleEntries, scaledAc } from '../../../engine/extras/scaling.ts';
import { creatureSpeedText, creatureSubtitle } from '../../../richtext/entityMeta.ts';
import { Entries } from '../../../richtext/Entries.tsx';
import { InSheetContext } from '../../../richtext/inSheet.ts';
import type { Creature, Entry, Extra } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import actions from '../actions/actions.module.css';
import { HpKeypad } from '../components/vitals.tsx';
import inventory from '../inventory/inventory.module.css';
import { useLiveBindings } from '../liveBindings.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import styles from './extras.module.css';
import { StatBlock } from './StatBlock.tsx';

const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The stat block's sections shown on the card: what the creature does on its turn. */
const CARD_SECTIONS = new Set(['Actions', 'Bonus Actions', 'Reactions']);

function cardSections(entries: readonly Entry[]): Entry[] {
  return entries.filter(
    (e) => typeof e === 'object' && e.type === 'entries' && CARD_SECTIONS.has(e.name ?? ''),
  );
}

/** The stat block in the bottom sheet; follows changes made while it is open. */
function ExtraStatBlock({ opened, uid }: { opened: SheetBindings; uid: string }) {
  const { character, sheet, index } = useLiveBindings(opened);
  const extra = character.extras?.find((e) => e.uid === uid);
  const creature = extra?.creatureRef
    ? index.get({ kind: 'creature', id: extra.creatureRef.id })
    : undefined;
  if (!extra) return null;
  if (!creature)
    return <p className={inventory.muted}>“{extra.name}” isn’t in your imported content.</p>;
  return (
    <InSheetContext.Provider value={true}>
      <StatBlock creature={creature} ctx={scaleContext(sheet, creature, extra)} />
    </InSheetContext.Provider>
  );
}

export function ExtraCard({ bindings, extra }: { bindings: SheetBindings; extra: Extra }) {
  const { sheet, index, apply } = bindings;
  const ui = useSheet();
  const creature: Creature | undefined = extra.creatureRef
    ? index.get({ kind: 'creature', id: extra.creatureRef.id })
    : undefined;
  const ctx = scaleContext(sheet, creature, extra);
  const hp = extraHp(extra, creature, ctx);
  const ac = creature ? scaledAc(creature, ctx).value : undefined;
  const minLevel = creature?.summon?.spellId ? (creature.summon.spellLevel ?? 1) : undefined;
  const moves = creature ? cardSections(scaleEntries(creature.entries, ctx)) : [];

  const openStatBlock = () =>
    ui.open({
      key: `extra:${extra.uid}`,
      title: extra.name,
      render: () => <ExtraStatBlock opened={bindings} uid={extra.uid} />,
    });
  const openHp = () =>
    ui.open({
      key: `extra-hp:${extra.uid}`,
      title: `${extra.name}: hit points`,
      render: () => (
        <HpKeypad
          current={hp.current}
          max={hp.max}
          temp={hp.temp}
          onDamage={(n) => (ui.close(), apply((c) => damageExtra(c, extra.uid, n, hp.max)))}
          onHeal={(n) => (ui.close(), apply((c) => healExtra(c, extra.uid, n)))}
          onTempHp={(n) => (ui.close(), apply((c) => setExtraTempHp(c, extra.uid, n)))}
        />
      ),
    });

  return (
    <li className={actions.card} aria-label={extra.name}>
      <div className={actions.cardHead}>
        <span className={actions.title}>
          {creature ? (
            <button type="button" className={actions.name} onClick={openStatBlock}>
              {extra.name}
            </button>
          ) : (
            <span className={actions.name}>{extra.name}</span>
          )}
        </span>
        {creature && <span className={actions.use}>{creatureSubtitle(creature)}</span>}
      </div>
      {extra.creatureRef && !creature && (
        <p className={inventory.muted}>Its stat block isn’t in your imported content.</p>
      )}
      <dl className={styles.numbers}>
        {ac !== undefined && (
          <div className={styles.number}>
            <dt>AC</dt>
            <dd>{ac}</dd>
          </div>
        )}
        <div className={styles.number}>
          <dt>HP</dt>
          <dd>
            {hp.maxFrom === 'unknown' ? (
              <span className={inventory.muted}>set a maximum below</span>
            ) : (
              <button
                type="button"
                className={styles.hp}
                data-down={hp.current === 0}
                onClick={openHp}
                aria-label={`${extra.name} hit points ${hp.current} of ${hp.max}${hp.temp ? `, ${hp.temp} temporary` : ''}. Change`}
              >
                {hp.current} / {hp.max}
                {hp.temp > 0 && ` · +${hp.temp} temp`}
              </button>
            )}
          </dd>
        </div>
        {creature && creatureSpeedText(creature) && (
          <div className={styles.number}>
            <dt>Speed</dt>
            <dd>{creatureSpeedText(creature)}</dd>
          </div>
        )}
      </dl>
      {moves.length > 0 && (
        <div className={styles.moves}>
          <InSheetContext.Provider value={true}>
            <Entries entries={moves} />
          </InSheetContext.Provider>
        </div>
      )}
      {minLevel !== undefined && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Spell level</span>
          <select
            value={extra.spellLevel ?? minLevel}
            onChange={(e) => apply((c) => setExtraSpellLevel(c, extra.uid, Number(e.target.value)))}
          >
            {SPELL_LEVELS.filter((l) => l >= minLevel).map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </label>
      )}
      {(hp.maxFrom !== 'statBlock' || !creature) && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>HP maximum</span>
          <input
            inputMode="numeric"
            value={extra.hpMax ?? ''}
            onChange={(e) => {
              const n = Math.floor(Number(e.target.value));
              apply((c) =>
                setExtraHpMax(c, extra.uid, e.target.value.trim() && n > 0 ? n : undefined),
              );
            }}
          />
        </label>
      )}
      <div className={styles.buttons}>
        {creature && (
          <Button size="sm" variant="ghost" onClick={openStatBlock}>
            Stat block
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => apply((c) => resetExtra(c, extra.uid))}>
          Full HP
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => apply((c) => removeExtra(c, extra.uid))}
          aria-label={`Remove ${extra.name}`}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
