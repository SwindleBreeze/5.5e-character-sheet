// A pick made in a bottom sheet (the Features tab, "Needs attention", the Description tab's
// size; plan §9.3 step 4.3). It follows the sheet as it changes (`useLiveBindings`): after Save,
// the picks the new choice brings with it (a feat's spells) open below, inline; when there are
// none, the sheet closes.

import { useEffect, useState } from 'react';
import { useAllContent } from '../../content/hooks.ts';
import type { DerivedFeature, DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { setPick } from '../../engine/play/features.ts';
import { decodeChoiceKey } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import inventory from '../sheet/inventory/inventory.module.css';
import { useLiveBindings } from '../sheet/liveBindings.ts';
import type { SheetBindings } from '../sheet/sheetBindings.ts';
import { ChoicePicker } from './ChoicePicker.tsx';
import { FeatureChoices } from './FeatureChoices.tsx';
import styles from './choices.module.css';
import { pickedFeatures, type PickSave } from './picks.ts';

const sameValues = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function LiveChoiceSheet({
  bindings: opened,
  choiceKey,
  onClose,
}: {
  /** The sheet when this page opened; the tabs' later bindings take over. */
  bindings: SheetBindings;
  choiceKey: string;
  onClose: () => void;
}) {
  const { character, sheet, apply } = useLiveBindings(opened);
  const content = useAllContent(character.enabledSources);
  // What was saved, until the sheet shows it.
  const [saved, setSaved] = useState<string[] | null>(null);

  const found = sheet.features
    .flatMap((f) => f.choices.map((c) => ({ c, f })))
    .find((x) => x.c.key === choiceKey);
  const nested = found
    ? pickedFeatures(found.c, found.f, sheet.features).filter((f) => f.choices.length)
    : [];
  const landed = !!found && saved !== null && sameValues(found.c.values, saved);

  useEffect(() => {
    if (landed && !nested.length) onClose();
  }, [landed, nested.length, onClose]);

  if (!content) return <p className={inventory.muted}>Loading…</p>;
  if (!found) return <p className={inventory.muted}>This choice isn’t offered any more.</p>;

  // Names and options from everything imported: a pick may be content the character lacks yet.
  const ctx = { character, sheet, catalog: content.catalog, index: content.index };
  const pick = (c: DerivedFeatureChoice, f: DerivedFeature, spec: PickSave) =>
    apply((ch) => setPick(ch, decodeChoiceKey(c.key), { ...spec, entryIndex: f.entryIndex }));

  if (saved !== null) {
    return (
      <div className={inventory.form}>
        {landed && nested.length > 0 ? (
          <>
            <p className={styles.hint}>Saved. What you picked comes with choices of its own:</p>
            {nested.map((n) => (
              <div key={n.name} className={styles.nested}>
                <h4 className={styles.nestedTitle}>{n.name}</h4>
                <FeatureChoices features={[n]} ctx={ctx} onPick={pick} />
              </div>
            ))}
            <div className={inventory.actions}>
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <p className={inventory.muted}>Saving…</p>
        )}
      </div>
    );
  }

  return (
    <ChoicePicker
      choice={found.c}
      ctx={ctx}
      showRetrain
      onSave={(spec) => {
        pick(found.c, found.f, spec);
        setSaved(spec.values);
      }}
    />
  );
}
