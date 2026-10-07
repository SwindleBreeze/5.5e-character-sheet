// Making or changing a pick from the Features tab (plan §9.2, step 3.20): the options the
// choice allows, how many to pick, and when the rules let it change. Rules guide, never block
// (plan §9.1): "Ignore rules" lifts the count and lets a value the character already has be
// picked again.

import { useState } from 'react';
import { useAllContent } from '../../../content/hooks.ts';
import { offerOptions } from '../../../engine/choices/options.ts';
import type { DerivedFeatureChoice, DerivedSheet } from '../../../engine/derive/types.ts';
import type { PickSpec } from '../../../engine/play/features.ts';
import type { Character, Retrain } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { Button } from '../../../ui/Button.tsx';
import inventory from '../inventory/inventory.module.css';
import styles from './features.module.css';

const RETRAIN_TEXT: Record<Retrain | 'never', string> = {
  longRest: 'You can change this whenever you finish a Long Rest.',
  shortRest: 'You can change this whenever you finish a Short or Long Rest.',
  levelUp: 'You can change this when you gain a level; the feature’s text says how much.',
  never:
    'The rules don’t let you change this later. Change it to fix a mistake, or when your DM agrees.',
};

/** When the rules let a pick change (plan §9.4, step 5.7: shown, not enforced). */
function retrainText(choice: DerivedFeatureChoice): string {
  return RETRAIN_TEXT[choice.offer.retrain ?? 'never'];
}

const SEARCH_FROM = 12;

export function ChoiceSheet({
  choice,
  character,
  sheet,
  onSave,
}: {
  choice: DerivedFeatureChoice;
  character: Character;
  sheet: DerivedSheet;
  onSave: (spec: Omit<PickSpec, 'entryIndex'>) => void;
}) {
  const content = useAllContent(character.enabledSources);
  const [ignore, setIgnore] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[] | null>(null);
  // Read in place: a page pushed on the sheet would replace this one and lose the picks.
  const [reading, setReading] = useState<string | null>(null);
  if (!content) return <p className={inventory.muted}>Loading…</p>;

  const { options, valueKind, joined } = offerOptions(
    choice.offer,
    { character, sheet, catalog: content.catalog, index: content.index },
    choice.values,
  );
  const picks =
    selected ?? (joined ? (choice.values.length ? [choice.values.join()] : []) : choice.values);
  const count = joined ? 1 : choice.count;
  const single = joined || (count === 1 && !ignore);
  const full = !ignore && picks.length >= count;
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const ready = picks.length > 0 && (ignore || picks.length <= count);

  const flip = (value: string) => {
    if (picks.includes(value)) setSelected(picks.filter((v) => v !== value));
    else if (single) setSelected([value]);
    else if (!full) setSelected([...picks, value]);
  };

  const save = () => {
    if (!ready) return;
    const values = joined ? picks[0]!.split(',') : picks;
    const labels = joined
      ? values
      : picks.map((v) => options.find((o) => o.value === v)?.label ?? v);
    onSave({ values, labels, ...(valueKind ? { valueKinds: [valueKind] } : {}) });
  };

  return (
    <div className={inventory.form}>
      <p className={inventory.muted}>
        {retrainText(choice)}
        {valueKind && choice.values.length > 0
          ? ' Choices you made for what you replace are removed with it.'
          : ''}
      </p>
      <p aria-live="polite">
        <strong>{joined ? 'Choose one' : `${picks.length} of ${count} chosen`}</strong>
      </p>
      {options.length > SEARCH_FROM && (
        <input
          type="search"
          className={inventory.search}
          aria-label="Find an option"
          placeholder="Find an option"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {!options.length && (
        <p className={inventory.warn}>
          Nothing from your sources fits this choice. Check Settings → Sources, or import the source
          it comes from.
        </p>
      )}
      <ul className={styles.options} aria-label="Options">
        {shown.map((o) => {
          const on = picks.includes(o.value);
          const blocked = !on && ((!!o.taken && !ignore) || (full && !single));
          return (
            <li key={o.value} className={styles.option}>
              <label className={inventory.check}>
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name="choice"
                  checked={on}
                  aria-disabled={blocked}
                  onChange={() => {
                    if (!blocked) flip(o.value);
                  }}
                />
                <span>
                  {o.label}
                  {o.taken && <span className={inventory.muted}> · you have it already</span>}
                </span>
              </label>
              {valueKind && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Read ${o.label}`}
                  aria-expanded={reading === o.value}
                  onClick={() => setReading(reading === o.value ? null : o.value)}
                >
                  Read
                </Button>
              )}
              {valueKind && reading === o.value && (
                <div className={styles.reading}>
                  <EntitySheet entityRef={{ kind: valueKind, id: o.value }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <label className={inventory.check}>
        <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
        Ignore rules (any number, and things you already have)
      </label>
      <div className={inventory.actions}>
        <Button variant="primary" aria-disabled={!ready} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
