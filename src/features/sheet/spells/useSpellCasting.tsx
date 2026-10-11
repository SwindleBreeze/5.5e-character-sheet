// Casting a spell from a row (plan step 4C.5): the row, a quick Cast button, and a sheet with
// every way to cast it. Shared by the Spells tab and, for spells by casting time, the Actions
// tab.

import { castWays, isConcentration, type CastWay } from '../../../engine/play/casting.ts';
import { castSpellAs, restoreResource, spendFreeCast } from '../../../engine/play/reducers.ts';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import { useRoller } from '../../../ui/rollerContext.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import { SpellRow } from './SpellRow.tsx';
import { nameOf, type SheetBindings } from '../sheetBindings.ts';
import { CastSheet } from './CastSheet.tsx';
import type { SpellEntry } from './entries.ts';
import { castNotice, whereFrom } from './spellText.ts';

/** Why a spell can't be cast right now. */
function whyNot(e: SpellEntry): string {
  const s = e.spell!;
  if (e.from.caster?.status === 'spellbook') {
    return 'Prepare it to cast it. From the spellbook you can only cast a spell with the Ritual tag, as a Ritual.';
  }
  if (e.from.granted?.resourceKey) return `No uses of ${e.sourceName} are left for it.`;
  return `No spell slot of level ${s.level} or higher is left.`;
}

/** Casting spells from the sheet: a spell's row, its sheet, and the cast itself. */
export function useSpellCasting({ character, sheet, index, apply }: SheetBindings) {
  const ui = useSheet();
  const roller = useRoller();
  const sc = sheet.spellcasting;
  const armorUntrained = sheet.issues.some((i) => i.code === 'armorUntrained');

  const cast = (e: SpellEntry, way: CastWay) => {
    const s = e.spell;
    if (!s) return;
    const was = character.state.concentration;
    const ended =
      isConcentration(s) && was && !(was.kind === 'spell' && was.id === s.id)
        ? ` · Concentration on ${nameOf(index, was.kind, was.id)} ends`
        : '';
    roller.notify({
      label: `Cast ${s.name}`,
      detail: `${castNotice(way, s, e.sourceName)}${isConcentration(s) ? ' · Concentrating' : ''}${ended}`,
    });
    apply((c) =>
      castSpellAs(
        c,
        sheet,
        {
          ref: { kind: 'spell', id: s.id },
          concentration: isConcentration(s),
          ...(e.from.granted ? { granted: e.from.granted } : {}),
        },
        way,
      ),
    );
  };

  const openSpell = (e: SpellEntry) => {
    const s = e.spell;
    if (!s) return;
    const ways = castWays(sheet, s, e.from);
    const caster = sc.casters.find((c) => c.key === e.from.caster?.key);
    ui.open({
      key: `cast:${e.key}`,
      title: s.name,
      render: () => (
        <CastSheet
          spell={s}
          ways={ways}
          {...(armorUntrained ? { armorUntrained: true } : {})}
          character={character}
          index={index}
          why={whyNot(e)}
          from={whereFrom(e, s, sheet)}
          attack={caster?.attack ?? e.from.granted?.attack}
          dc={caster?.dc.value ?? e.from.granted?.dc}
          onCast={(way: CastWay) => {
            ui.close();
            cast(e, way);
          }}
        />
      ),
    });
  };

  /** A spell's row; `many` when there are several sources of spells to tell apart. */
  const row = (e: SpellEntry, many = sc.casters.length > 1 || !!sc.granted.length) => (
    <SpellRow
      key={e.key}
      entry={e}
      name={nameOf(index, 'spell', e.id)}
      character={character}
      sheet={sheet}
      many={many}
      onOpen={() => openSpell(e)}
      quick={!armorUntrained && e.spell ? quickWay(sheet, e) : undefined}
      ritual={!armorUntrained && e.spell ? ritualWay(sheet, e) : undefined}
      onCast={(way) => cast(e, way)}
      onFreeUses={(left) =>
        apply((c) => {
          const g = e.from.granted!;
          const now = g.usesMax! - (g.usesUsed ?? 0);
          return left < now
            ? spendFreeCast(c, sheet, g)
            : restoreResource(c, g.usesKey!, left - now);
        })
      }
    />
  );

  return { cast, openSpell, row };
}

/**
 * The way a tap on a row's Cast button uses (plan step 4C.5): a free use first, else the lowest
 * slot; a ritual only when nothing else is left. The spell's sheet has every way.
 */
function quickWay(sheet: DerivedSheet, e: SpellEntry): CastWay | undefined {
  const ways = castWays(sheet, e.spell!, e.from);
  return ways.find((w) => w.kind !== 'ritual') ?? ways[0];
}

/** Casting it as a Ritual, when that is a second way next to the quick one (no slot spent). */
function ritualWay(sheet: DerivedSheet, e: SpellEntry): CastWay | undefined {
  const ways = castWays(sheet, e.spell!, e.from);
  const ritual = ways.find((w) => w.kind === 'ritual');
  return ritual && ways[0] !== ritual ? ritual : undefined;
}

/** `Cast`, `Cast · L1`, `Cast · Pact`, `Cast · free`, `Ritual`. */
