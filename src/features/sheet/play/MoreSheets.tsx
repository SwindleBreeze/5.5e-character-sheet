// The sheet's "More" menu (plan §9.2, step 3.22): rests, the dice roller, level up, this
// character's sources and overrides; and what concentrating means, from the header's chip.

import { useState } from 'react';
import { Link } from 'react-router';
import { useEnabledSources } from '../../../content/hooks.ts';
import { setSources } from '../../../engine/play/details.ts';
import type { SourceCode } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import { SourceToggles } from '../../sources/SourceToggles.tsx';
import inventory from '../inventory/inventory.module.css';
import { nameOf, type SheetBindings } from '../sheetBindings.ts';
import { AttentionSheet } from '../attention/AttentionSheet.tsx';
import { DiceSheet } from './DiceSheet.tsx';
import { OverridesSheet } from './OverridesSheet.tsx';
import styles from './play.module.css';
import { LongRestSheet, ShortRestSheet } from './RestSheets.tsx';

export function SourcesSheet({ bindings }: { bindings: SheetBindings }) {
  const { character, apply } = bindings;
  const global = useEnabledSources();
  // The sheet shows the character as it was when opened: the choice is tracked here.
  const [own, setOwn] = useState<SourceCode[] | null>(character.enabledSources);
  const change = (next: SourceCode[] | null) => {
    setOwn(next);
    apply((c) => setSources(c, next));
  };
  return (
    <div className={inventory.form}>
      <p className={inventory.muted}>
        Which books this character’s pickers offer: items, spells, feats, gifts and gods. What the
        character already has stays, whatever is switched off.
      </p>
      <label className={inventory.check}>
        <input type="radio" name="sources" checked={!own} onChange={() => change(null)} />
        Use the app’s sources (Settings)
      </label>
      <label className={inventory.check}>
        <input type="radio" name="sources" checked={!!own} onChange={() => change(global)} />
        Choose for this character
      </label>
      {own && <SourceToggles value={own} onChange={change} />}
    </div>
  );
}

export function ConcentrationStatus({
  bindings,
  onEnd,
}: {
  bindings: SheetBindings;
  onEnd: () => void;
}) {
  const { character, index } = bindings;
  const effect = character.state.concentration;
  if (!effect) return null;
  return (
    <div className={inventory.form}>
      <p>
        You are concentrating on <strong>{nameOf(index, effect.kind, effect.id)}</strong>.
      </p>
      <ul className={styles.summary}>
        <li>
          Taking damage: a Constitution saving throw, DC 10 or half the damage, whichever is higher
          (up to 30). The sheet asks when you take damage.
        </li>
        <li>Casting another Concentration spell ends it.</li>
        <li>It ends if you are Incapacitated or die, or whenever you choose.</li>
      </ul>
      <div className={inventory.actions}>
        <Button variant="danger" onClick={onEnd}>
          End Concentration
        </Button>
      </div>
    </div>
  );
}

export function MoreMenu({ bindings }: { bindings: SheetBindings }) {
  const ui = useSheet();
  const { character } = bindings;
  const overrides = Object.keys(character.overrides).length;
  const ignored = character.ui.ignoredAttention?.length ?? 0;
  const page = (key: string, title: string, render: () => React.ReactNode) => () =>
    ui.push({ key: `more:${key}`, title, render });
  const items: { label: string; hint: string; open: () => void }[] = [
    {
      label: 'Short Rest',
      hint: 'An hour: spend Hit Dice, get Short Rest features back',
      open: page('short', 'Short Rest', () => (
        <ShortRestSheet bindings={bindings} onClose={ui.close} />
      )),
    },
    {
      label: 'Long Rest',
      hint: '8 hours: Hit Points, Hit Dice, slots and features back',
      open: page('long', 'Long Rest', () => (
        <LongRestSheet bindings={bindings} onClose={ui.close} />
      )),
    },
    {
      label: 'Dice roller',
      hint: 'For when there are no dice at hand',
      open: page('dice', 'Dice roller', () => <DiceSheet />),
    },
    {
      label: 'Sources',
      hint: character.enabledSources ? 'This character’s own' : 'The app’s',
      open: page('sources', 'Sources', () => <SourcesSheet bindings={bindings} />),
    },
    {
      label: 'Needs attention',
      hint: ignored ? `Choices, picks and rules; ${ignored} ignored` : 'Choices, picks and rules',
      open: page('attention', 'Needs attention', () => <AttentionSheet bindings={bindings} />),
    },
    {
      label: 'Overrides',
      hint: overrides ? `${overrides} set by hand` : 'None',
      open: page('overrides', 'Overrides', () => <OverridesSheet bindings={bindings} />),
    },
  ];
  return (
    <ul className={styles.menu} aria-label="More">
      {items.map((item) => (
        <li key={item.label}>
          <button type="button" className={inventory.result} onClick={item.open}>
            <span className={inventory.resultName}>{item.label}</span>
            <span className={inventory.muted}>{item.hint}</span>
          </button>
        </li>
      ))}
      <li>
        <Link className={inventory.result} to={`/c/${character.id}/level-up`} onClick={ui.close}>
          <span className={inventory.resultName}>Level up</span>
          <span className={inventory.muted}>Gain a level (coming with phase 5)</span>
        </Link>
      </li>
    </ul>
  );
}
