// The sheet a spell opens (plan §9.2, step 3.18): why the character can cast it, the ways it
// can be cast now, what casting it does to Concentration and to this turn's slot, then the
// spell's text. Casting closes it.

import type { ContentIndex } from '../../../engine/content/contentIndex.ts';
import { castWayLabel, isConcentration, type CastWay } from '../../../engine/play/casting.ts';
import type { DerivedRoll } from '../../../engine/derive/types.ts';
import type { Character, Spell } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { Button } from '../../../ui/Button.tsx';
import { RollButton } from '../components/RollButton.tsx';
import { nameOf } from '../sheetBindings.ts';
import { castingTime, levelSchool, resolveText } from './spellText.ts';
import styles from './spells.module.css';

export function CastSheet({
  spell,
  ways,
  character,
  index,
  why,
  from,
  attack,
  dc,
  armorUntrained,
  onCast,
}: {
  spell: Spell;
  ways: CastWay[];
  character: Character;
  index: ContentIndex;
  /** Why there is no way to cast it now, when there isn't. */
  why: string;
  /** Why the character can cast it, and with what. */
  from: string;
  /** The caster's spell attack roll and save DC, for a spell that calls for either. */
  attack?: DerivedRoll | undefined;
  dc?: number | undefined;
  /** Wearing armor without training: no spellcasting (2024). */
  armorUntrained?: boolean;
  onCast: (way: CastWay) => void;
}) {
  const concentration = isConcentration(spell);
  const current = character.state.concentration;
  const replacing =
    concentration && current && !(current.kind === 'spell' && current.id === spell.id)
      ? nameOf(index, current.kind, current.id)
      : undefined;
  const slotSpent = !!character.state.turn.slotSpent;

  return (
    <div className={styles.cast}>
      <p className={styles.muted}>
        {levelSchool(spell)} · {castingTime(spell)}
        {spell.ritual && ' · Ritual'}
        {concentration && ' · Concentration'}
      </p>
      <p>{from}</p>
      {resolveText(spell, dc) && (
        <p className={styles.resolve}>
          <span>{resolveText(spell, dc)}</span>
          {spell.attack && attack && (
            <RollButton label={`${spell.name}: spell attack`} roll={attack} size="sm" />
          )}
        </p>
      )}
      {armorUntrained && (
        <p className={styles.warn}>
          You’re wearing armor you lack training with, so you can’t cast spells.
        </p>
      )}
      {replacing && (
        <p className={styles.warn}>Casting it ends your Concentration on {replacing}.</p>
      )}
      {slotSpent && ways.some((w) => w.kind === 'slot') && (
        <p className={styles.warn}>
          You already expended a spell slot this turn. You can expend only one per turn to cast a
          spell.
        </p>
      )}
      <div className={styles.ways} role="group" aria-label={`Cast ${spell.name}`}>
        {ways.map((way, i) => (
          <Button key={i} className={styles.way} onClick={() => onCast(way)}>
            {castWayLabel(way)}
            {'level' in way && way.level > spell.level && ` · cast at level ${way.level}`}
          </Button>
        ))}
        {!ways.length && <p className={styles.muted}>{why}</p>}
      </div>
      <EntitySheet entityRef={{ kind: 'spell', id: spell.id }} />
    </div>
  );
}
