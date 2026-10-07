// One feature on the Features tab (plan §9.2, step 3.20): its name and where it comes from, its
// counters and picks at a glance, and when opened, its text. Features written inside its text
// (`refSubclassFeature`) are part of it: their counters and picks show here too. The controls
// render in the tab, not in a bottom sheet, so they always show the live character.

import { useId, useState } from 'react';
import { readable, spreadLabel } from '../../../engine/choices/options.ts';
import type { DerivedFeature, DerivedFeatureChoice } from '../../../engine/derive/types.ts';
import { restoreResource, spendResource } from '../../../engine/play/reducers.ts';
import { valueKind } from '../../../engine/content/refs.ts';
import { ABILITY_NAMES, refKey, type Ability } from '../../../schema/index.ts';
import { Entries } from '../../../richtext/Entries.tsx';
import { Badge } from '../../../ui/Badge.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Counter } from '../../../ui/Counter.tsx';
import { RECHARGE_TEXT } from '../actions/labels.ts';
import { nameOf, type SheetBindings } from '../sheetBindings.ts';
import inventory from '../inventory/inventory.module.css';
import styles from './features.module.css';
import { choiceTitle } from './labels.ts';

/** The picks, readable. */
function choiceValues(c: DerivedFeatureChoice, bindings: SheetBindings): string[] {
  if (c.offer.kind === 'backgroundAbility') return c.values.length ? [spreadLabel(c.values)] : [];
  return c.values.map((v, i) => {
    if (c.offer.kind === 'ability' || c.offer.kind === 'spellAbility')
      return ABILITY_NAMES[v as Ability] ?? v;
    const kind = valueKind(c.valueKinds, i);
    if (kind) return nameOf(bindings.index, kind, v);
    const label = c.labels[i];
    return label && label !== v ? label : readable(v);
  });
}

export function FeatureRow({
  feature,
  nested,
  bindings,
  open,
  onToggle,
  onChoose,
  onRemove,
}: {
  feature: DerivedFeature;
  /** Features written inside its text. */
  nested: DerivedFeature[];
  bindings: SheetBindings;
  open: boolean;
  onToggle: () => void;
  onChoose: (choice: DerivedFeatureChoice, feature: DerivedFeature) => void;
  /** Gifts only. */
  onRemove?: () => void;
}) {
  const { character, sheet, index, apply } = bindings;
  const detailsId = useId();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const all = [feature, ...nested];
  // A caster's own cantrips and spells are picked and read on the Spells tab.
  const choices = all.flatMap((f) =>
    f.choices
      .filter(
        (c) => !(c.offer.kind === 'spell' && (f.ref.kind === 'class' || f.ref.kind === 'subclass')),
      )
      .map((c) => ({ c, f })),
  );
  const resources = all
    .flatMap((f) => f.resourceKeys)
    .map((k) => sheet.resources.find((r) => r.key === k))
    .filter((r) => r !== undefined);
  const toChoose = choices.reduce((n, { c }) => n + Math.max(0, c.count - c.values.length), 0);
  const usedUp =
    !!onRemove && resources.length > 0 && resources.every((r) => r.used >= r.max.value);
  const entity = index.get(feature.ref);
  const entries = entity?.entries ?? character.snapshots[refKey(feature.ref)]?.entries ?? [];
  const meta = [
    feature.level !== undefined && feature.ref.kind !== 'class' ? `Level ${feature.level}` : '',
    entity?.kind === 'reward' ? entity.rewardType : '',
    feature.pickedIn
      ? `from ${feature.pickedIn.name}${feature.pickedIn.progression ? ` (${feature.pickedIn.progression})` : ''}`
      : '',
  ].filter(Boolean);

  return (
    <li className={inventory.item} aria-label={feature.name}>
      <div className={inventory.summary}>
        <button
          type="button"
          className={inventory.itemName}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={onToggle}
        >
          {feature.name}
        </button>
        <span className={inventory.badges}>
          {toChoose > 0 && <Badge variant="warning">{toChoose} to choose</Badge>}
          {usedUp && <Badge variant="warning">Used up</Badge>}
          {feature.fromSnapshot && <Badge>Content not loaded</Badge>}
        </span>
        {meta.length > 0 && <span className={inventory.muted}>{meta.join(' · ')}</span>}
      </div>

      {resources.length > 0 && (
        <div className={styles.counters}>
          {resources.map((r) => {
            const left = r.max.value - r.used;
            return (
              <div key={r.key} className={styles.counter}>
                <span className={styles.counterName}>
                  {r.name}
                  {r.die && ` (${r.die})`}
                </span>
                <Counter
                  label={`${r.name} left`}
                  value={left}
                  max={r.max.value}
                  onChange={(next) =>
                    apply((c) =>
                      next < left
                        ? spendResource(c, sheet, r.key, left - next)
                        : restoreResource(c, r.key, next - left),
                    )
                  }
                />
                <span className={inventory.help}>Recharge: {RECHARGE_TEXT[r.recharge]}</span>
              </div>
            );
          })}
        </div>
      )}

      {choices.length > 0 && (
        <ul className={styles.picks} aria-label={`${feature.name} choices`}>
          {choices.map(({ c, f }) => {
            const shown = choiceValues(c, bindings);
            const missing = c.count - c.values.length;
            return (
              <li key={c.key} className={styles.pick}>
                <span className={styles.pickTitle}>{choiceTitle(c)}</span>
                <span className={styles.pickValues}>
                  {shown.join(', ')}
                  {missing > 0 && (
                    <span className={inventory.warn}>
                      {shown.length ? ' · ' : ''}
                      {missing} to choose
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant={missing > 0 ? 'primary' : 'ghost'}
                  aria-label={`${missing > 0 ? 'Choose' : 'Change'} ${choiceTitle(c)} (${feature.name})`}
                  onClick={() => onChoose(c, f)}
                >
                  {missing > 0 ? 'Choose' : 'Change'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <div id={detailsId} className={inventory.details}>
          {entries.length ? (
            <Entries entries={entries} />
          ) : (
            <p className={inventory.muted}>No text for this one.</p>
          )}
          {usedUp && (
            <p className={inventory.muted}>All its uses are spent. Remove it once it fades.</p>
          )}
          {onRemove &&
            (confirmRemove ? (
              <div className={inventory.actions}>
                <Button variant="danger" onClick={onRemove}>
                  Remove {feature.name}
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <div className={inventory.actions}>
                <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
                  Remove
                </Button>
              </div>
            ))}
        </div>
      )}
    </li>
  );
}
