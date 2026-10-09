// The picks some features offer, each with its picker (plan §9.3, step 4.3), and under a pick
// that brings in an entity with picks of its own (a feat's spells, an option's choices), those
// picks, inline. For a character shown live: the wizard's steps, and a sheet after a Save.

import type { AutoContext } from '../../engine/build/autoChoose.ts';
import type { DerivedFeature, DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { refKey } from '../../schema/index.ts';
import { ChoicePicker } from './ChoicePicker.tsx';
import { nestedPicks, type PickSave } from './picks.ts';
import styles from './choices.module.css';
import { choiceTitle } from './labels.ts';

export interface FeatureChoicesProps {
  features: readonly DerivedFeature[];
  ctx: AutoContext;
  onPick: (choice: DerivedFeatureChoice, feature: DerivedFeature, pick: PickSave) => void;
  /** Which of the features' picks to show; all by default. */
  only?: (choice: DerivedFeatureChoice, feature: DerivedFeature) => boolean;
  /** Title each pick with its feature's name too. */
  named?: boolean;
  /** Entities already shown above, so a loop of grants stops. */
  seen?: ReadonlySet<string>;
}

export function FeatureChoices({
  features,
  ctx,
  onPick,
  only,
  named,
  seen = new Set(),
}: FeatureChoicesProps) {
  const items = features.flatMap((f) =>
    f.choices.filter((c) => !only || only(c, f)).map((c) => ({ c, f })),
  );
  if (!items.length) return null;
  return (
    <div className={styles.choiceList}>
      {items.map(({ c, f }) => {
        const own = choiceTitle(c);
        // "Weapon Mastery: Weapon Mastery" says it once.
        const title = named && own !== f.name ? `${f.name}: ${own}` : own;
        // Only a picked option with picks here (Magician's cantrip is a spell pick, made with
        // the spells): an empty box under it said nothing.
        const nested = nestedPicks(c, f, ctx.sheet.features, only, seen);
        const below = new Set([...seen, refKey(f.ref), ...nested.map((n) => refKey(n.ref))]);
        const renderNested = (n: DerivedFeature) => (
          <div key={refKey(n.ref)} className={styles.nested}>
            <h4 className={styles.nestedTitle}>{n.name}</h4>
            <FeatureChoices
              features={[n]}
              ctx={ctx}
              onPick={onPick}
              seen={below}
              {...(only ? { only } : {})}
            />
          </div>
        );
        // A picked option's own picks go right under it; any other (none, usually) below.
        const values = new Set(c.values);
        return (
          <section key={c.key} className={styles.choice} aria-label={title}>
            <h3 className={styles.choiceTitle}>{title}</h3>
            <ChoicePicker
              choice={c}
              ctx={ctx}
              instant
              onSave={(pick) => onPick(c, f, pick)}
              under={(value) => nested.filter((n) => n.ref.id === value).map(renderNested)}
            />
            {nested.filter((n) => !values.has(n.ref.id)).map(renderNested)}
          </section>
        );
      })}
    </div>
  );
}
