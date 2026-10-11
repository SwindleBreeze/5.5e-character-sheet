// One spell's row (plan step 4C.5): its markers, free uses, a quick Cast button and where it
// comes from. Shared by the Spells tab and the Actions tab, through `useSpellCasting`.

import { castWayLabel, isConcentration, type CastWay } from '../../../engine/play/casting.ts';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import type { Character } from '../../../schema/index.ts';
import { Badge } from '../../../ui/Badge.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Counter } from '../../../ui/Counter.tsx';
import { ABILITY_ABBR } from '../components/format.ts';
import type { SpellEntry } from './entries.ts';
import { castingTime } from './spellText.ts';
import styles from './spells.module.css';

function quickLabel(way: CastWay): string {
  switch (way.kind) {
    case 'slot':
      return way.pact ? 'Cast · Pact' : `Cast · L${way.level}`;
    case 'free':
      return way.charges !== undefined
        ? `Cast · ${way.charges} ${way.charges === 1 ? 'charge' : 'charges'}`
        : 'Cast · free';
    case 'ritual':
      return 'Ritual';
    default:
      return 'Cast';
  }
}

export function SpellRow({
  entry: e,
  name,
  character,
  sheet,
  many,
  onOpen,
  onFreeUses,
  quick,
  ritual,
  onCast,
}: {
  entry: SpellEntry;
  /** Readable from the id when the spell isn't imported. */
  name: string;
  character: Character;
  sheet: DerivedSheet;
  /** Several sources of spells, so each row says where it comes from. */
  many: boolean;
  onOpen: () => void;
  onFreeUses: (left: number) => void;
  /** The way the row's Cast button uses; none when it can't be cast now. */
  quick: CastWay | undefined;
  /** A Ritual casting as well (a prepared ritual spell): a second button. */
  ritual?: CastWay | undefined;
  onCast: (way: CastWay) => void;
}) {
  const s = e.spell;
  const g = e.from.granted;
  const concentrating =
    character.state.concentration?.kind === 'spell' && character.state.concentration.id === e.id;
  const resource = g?.resourceKey
    ? sheet.resources.find((r) => r.key === g.resourceKey)
    : undefined;
  return (
    <li className={styles.row} aria-label={s?.name ?? e.id}>
      <button type="button" className={styles.spellName} onClick={onOpen} disabled={!s}>
        {s?.name ?? name}
      </button>
      <span className={styles.marks}>
        {s && isConcentration(s) && (
          <abbr className={styles.mark} title="Concentration">
            C
          </abbr>
        )}
        {s?.ritual && (
          <abbr className={styles.mark} title="Ritual">
            R
          </abbr>
        )}
        {e.from.caster?.status === 'always' && <Badge>Always prepared</Badge>}
        {e.from.caster?.status === 'spellbook' && <Badge>Not prepared</Badge>}
        {concentrating && <Badge variant="accent">Concentrating</Badge>}
        {!s && <Badge variant="warning">Not imported</Badge>}
      </span>
      {g?.usesKey && g.usesMax !== undefined && (
        <Counter
          label={`${s?.name ?? e.id} free uses left`}
          value={g.usesMax - (g.usesUsed ?? 0)}
          max={g.usesMax}
          onChange={onFreeUses}
        />
      )}
      {quick && (
        <Button
          size="sm"
          className={styles.quickCast}
          aria-label={`Cast ${s?.name ?? name}: ${castWayLabel(quick)}`}
          onClick={() => onCast(quick)}
        >
          {quickLabel(quick)}
        </Button>
      )}
      {ritual && (
        <Button
          size="sm"
          className={styles.quickCast}
          aria-label={`Cast ${s?.name ?? name}: ${castWayLabel(ritual)}`}
          onClick={() => onCast(ritual)}
        >
          Ritual
        </Button>
      )}
      <span className={styles.meta}>
        {s ? castingTime(s) : ''}
        {s?.attack && ' · spell attack'}
        {s?.saves?.[0] && ` · ${s.saves.map((a) => ABILITY_ABBR[a]).join(' or ')} save`}
        {many && ` · ${e.sourceName}`}
        {g?.uses === 'atWill' && ' · at will'}
        {resource && ` · ${g!.cost ?? 1} ${resource.name} per cast`}
      </span>
    </li>
  );
}
