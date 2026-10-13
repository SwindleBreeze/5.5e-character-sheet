// The fight numbers the Main tab and the Combat tab share: Initiative (tap to roll), Speed, and
// the death saves at 0 Hit Points. One place, so both tabs read and act the same.

import { OTHER_ABOUT } from '../../../engine/explain/stats.ts';
import { deathSave, setDeathSaves } from '../../../engine/play/reducers.ts';
import { d20Expr, useRoller } from '../../../ui/rollerContext.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import { extraDice } from './format.ts';
import { StatPill } from './stats.tsx';
import { paragraphs, useStatExplain } from './useStatExplain.tsx';
import { DeathSaves } from './vitals.tsx';
import styles from './vitals.module.css';

type Bindings = Pick<SheetBindings, 'character' | 'sheet' | 'apply'>;

export function InitiativePill({ sheet, apply }: Omit<Bindings, 'character'>) {
  const { explainRoll } = useStatExplain(apply);
  return (
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
  );
}

/** Speed modes other than walking, as the Speed's line shows them: `fly 30, swim 30`. */
function otherSpeeds(sheet: SheetBindings['sheet']) {
  return Object.entries(sheet.speed).filter(([mode]) => mode !== 'walk');
}

export function SpeedPill({ sheet, apply }: Omit<Bindings, 'character'>) {
  const { explainNumber } = useStatExplain(apply);
  const walk = sheet.speed.walk;
  if (!walk) return null;
  const modes = otherSpeeds(sheet);
  // Weight slows the character: said under the Speed, with the reason in its explanation.
  const overloaded = sheet.issues.some(
    (i) => i.code === 'overCapacity' || i.code === 'overDragLimit',
  );
  return (
    <StatPill
      label="Speed"
      value={walk.value}
      sub={
        overloaded
          ? 'carrying too much'
          : modes.length
            ? modes.map(([m, d]) => `${m} ${d!.value}`).join(', ')
            : 'ft.'
      }
      derived={walk}
      onExplain={() =>
        explainNumber('speed.walk', 'Speed', walk, { about: paragraphs(OTHER_ABOUT.speed) })
      }
    />
  );
}

/** Death saves, shown at 0 Hit Points or while any are marked. */
export function DeathSavesBlock({ character, sheet, apply }: Bindings) {
  const roller = useRoller();
  const ds = character.state.deathSaves;
  if (sheet.hp.current > 0 && !ds.successes && !ds.failures) return null;
  return (
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
  );
}
