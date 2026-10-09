// A creature's stat block on the sheet (step 7.6): the library's stat block lines, with the
// numbers worked out for this character where the stat block writes them in words, its six
// abilities, then its traits and actions with the summoner's attack, damage and DC in.

import { useMemo } from 'react';
import {
  scaleEntries,
  scaledAc,
  scaledHp,
  type ScaleContext,
} from '../../../engine/extras/scaling.ts';
import { creatureFacts, creatureSubtitle } from '../../../richtext/entityMeta.ts';
import { Entries } from '../../../richtext/Entries.tsx';
import { InlineText } from '../../../richtext/InlineText.tsx';
import { ABILITIES, abilityModifier, type Creature } from '../../../schema/index.ts';
import { ABILITY_ABBR, signed } from '../components/format.ts';
import styles from './extras.module.css';

/** A worked-out number with how the stat block writes it, when it writes it in words. */
function Worked({
  value,
  text,
  written,
}: {
  value?: number | undefined;
  text: string;
  written: boolean;
}) {
  if (value === undefined || !written) return <InlineText text={text} />;
  return (
    <>
      <span className="numeric">{value}</span>
      <span className={styles.written}>
        {' '}
        (<InlineText text={text} />)
      </span>
    </>
  );
}

export function StatBlock({ creature, ctx }: { creature: Creature; ctx: ScaleContext }) {
  const ac = scaledAc(creature, ctx);
  const hp = scaledHp(creature, ctx);
  const entries = useMemo(() => scaleEntries(creature.entries, ctx), [creature, ctx]);
  // The library's lines, but AC, HP and Proficiency Bonus are worked out here.
  const rest = creatureFacts(creature).filter(
    (f) => !['Armor Class', 'Hit Points', 'Proficiency Bonus'].includes(f.label),
  );
  const extraAc = creature.ac
    .slice(1)
    .map((a) => a.special ?? `${a.value ?? ''}${a.note ? ` (${a.note})` : ''}`);

  return (
    <div className={styles.statBlock}>
      <p className={styles.subtitle}>{creatureSubtitle(creature)}</p>
      <dl className={styles.lines}>
        <div className={styles.line}>
          <dt>Armor Class</dt>
          <dd>
            <Worked
              value={ac.value}
              text={ac.text}
              written={creature.ac[0]?.special !== undefined}
            />
            {extraAc.length > 0 && <>, {extraAc.join(', ')}</>}
          </dd>
        </div>
        <div className={styles.line}>
          <dt>Hit Points</dt>
          <dd>
            <Worked value={hp.value} text={hp.text} written={creature.hp.special !== undefined} />
            {hp.hitDice && creature.hp.special !== undefined && (
              <span className={styles.written}> · Hit Dice {hp.hitDice}</span>
            )}
          </dd>
        </div>
        {rest.map((f) => (
          <div key={f.label} className={styles.line}>
            <dt>{f.label}</dt>
            <dd>
              <InlineText text={f.value} />
            </dd>
          </div>
        ))}
        {creature.pbNote && (
          <div className={styles.line}>
            <dt>Proficiency Bonus</dt>
            <dd>
              <span className="numeric">{signed(ctx.pb)}</span>
              <span className={styles.written}> ({creature.pbNote})</span>
            </dd>
          </div>
        )}
      </dl>
      <ul className={styles.abilities} aria-label="Ability scores">
        {ABILITIES.map((a) => (
          <li key={a} className={styles.ability}>
            <span className={styles.abilityName}>{ABILITY_ABBR[a]}</span>
            <span className={styles.abilityValue}>
              {creature.abilities[a]} ({signed(abilityModifier(creature.abilities[a]))})
            </span>
          </li>
        ))}
      </ul>
      <Entries entries={entries} />
    </div>
  );
}
