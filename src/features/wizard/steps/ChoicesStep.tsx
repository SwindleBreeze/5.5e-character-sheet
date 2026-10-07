// The class features step (plan §9.3 step 4.4, §9.3b step 4B.5): what the class's level 1
// features let you choose (Expertise, Weapon Mastery, a Fighting Style…). A pick's own picks (a
// Fighting Style feat's) open under it. The class's skills, tools and equipment are on the class
// step; a background's or species' picks on theirs.

import { setPick } from '../../../engine/play/features.ts';
import { decodeChoiceKey, refKey } from '../../../schema/index.ts';
import page from '../../../app/Page.module.css';
import { choiceTitle } from '../../choices/labels.ts';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import { picksOnStep } from '../progress.ts';
import styles from '../wizard.module.css';

export function ChoicesStep(b: WizardBindings) {
  const { sheet, apply } = b;
  if (!sheet) return null;
  const { features, only } = picksOnStep(sheet, 'choices');
  if (!features.length) return <p className={styles.notice}>Nothing to choose here: on you go.</p>;
  return (
    <>
      {features.map((f) => (
        <section key={refKey(f.ref)} className={page.card} aria-label={f.name}>
          {/* "Weapon Mastery" over its one pick, "Weapon Mastery": the pick's title says it. */}
          {!(
            f.choices.filter(only).length === 1 && choiceTitle(f.choices.find(only)!) === f.name
          ) && <h2 className={page.cardTitle}>{f.name}</h2>}
          <FeatureChoices
            features={[f]}
            ctx={choiceContext(b, sheet)}
            only={only}
            onPick={(c, owner, pick) =>
              apply((ch) =>
                setPick(ch, decodeChoiceKey(c.key), {
                  ...pick,
                  entryIndex: owner.entryIndex,
                  via: 'creation',
                }),
              )
            }
          />
        </section>
      ))}
    </>
  );
}
