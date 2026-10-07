// Step 7: every other pick (plan §9.3, step 4.4): class skills and tools, Expertise, Weapon
// Mastery, a Fighting Style, languages, and what a class feature offers. Picks made on the
// background, species and spells steps aren't repeated here; a pick's own picks (a Fighting
// Style feat's) open under it.

import { setPick } from '../../../engine/play/features.ts';
import type { DerivedFeature } from '../../../engine/derive/types.ts';
import { decodeChoiceKey, refKey } from '../../../schema/index.ts';
import page from '../../../app/Page.module.css';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import inventory from '../../sheet/inventory/inventory.module.css';
import { choiceContext, isSpellOffer, rootOf, type WizardBindings } from '../bindings.ts';

export function ChoicesStep(b: WizardBindings) {
  const { sheet, apply } = b;
  if (!sheet) return <p className={inventory.muted}>Choose a class first.</p>;
  const ctx = choiceContext(b, sheet);
  const all = sheet.features;
  const onPick: Parameters<typeof FeatureChoices>[0]['onPick'] = (c, f, pick) =>
    apply((ch) =>
      setPick(ch, decodeChoiceKey(c.key), { ...pick, entryIndex: f.entryIndex, via: 'creation' }),
    );
  const only = (c: { offer: Parameters<typeof isSpellOffer>[0] }) => !isSpellOffer(c.offer);
  /** Shown under the pick that chose it. */
  const nestedUnderPick = (f: DerivedFeature) => {
    if (!f.pickedIn) return false;
    const by = all.find((x) => refKey(x.ref) === refKey(f.pickedIn!.ref));
    return !!by?.choices.some((c) => c.values.includes(f.ref.id));
  };
  const shown = all.filter((f) => {
    const root = rootOf(f, all).ref.kind;
    return (
      root !== 'species' && root !== 'background' && !nestedUnderPick(f) && f.choices.some(only)
    );
  });

  return (
    <>
      {!shown.length && <p className={inventory.muted}>Nothing else to choose.</p>}
      {shown.map((f) => (
        <section key={refKey(f.ref)} className={page.card} aria-label={f.name}>
          <h2 className={page.cardTitle}>{f.name}</h2>
          <FeatureChoices features={[f]} ctx={ctx} onPick={onPick} only={only} />
        </section>
      ))}
    </>
  );
}
