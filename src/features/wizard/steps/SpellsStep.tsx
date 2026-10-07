// Step 6: spells, when something gives them (plan §9.3, step 4.4): a class's cantrips, the
// level 1 spells of a class that learns them (Bard, Sorcerer, Warlock) or a Wizard's spellbook,
// the spells a class prepares (Cleric, Druid, Paladin, Ranger, Wizard: changeable after each
// Long Rest), and the spells of a species or feat.

import { setPick } from '../../../engine/play/features.ts';
import type { DerivedCaster } from '../../../engine/derive/types.ts';
import { decodeChoiceKey, refKey, type Character, type Id } from '../../../schema/index.ts';
import page from '../../../app/Page.module.css';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import { PrepareSheet } from '../../sheet/spells/PrepareSheet.tsx';
import inventory from '../../sheet/inventory/inventory.module.css';
import { choiceContext, isSpellOffer, type WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

/** Prepared spells while creating: not a change after a Long Rest, so no swap is counted. */
function prepare(c: Character, casterKey: string, ids: readonly Id[]): Character {
  return {
    ...c,
    state: { ...c.state, prepared: { ...c.state.prepared, [casterKey]: [...new Set(ids)] } },
  };
}

export function SpellsStep(b: WizardBindings) {
  const { character, sheet, apply } = b;
  if (!sheet) return <p className={inventory.muted}>Choose a class first.</p>;
  const ctx = choiceContext(b, sheet);
  const onPick: Parameters<typeof FeatureChoices>[0]['onPick'] = (c, f, pick) =>
    apply((ch) =>
      setPick(ch, decodeChoiceKey(c.key), { ...pick, entryIndex: f.entryIndex, via: 'creation' }),
    );
  const spellPicks = (c: { offer: Parameters<typeof isSpellOffer>[0] }) => isSpellOffer(c.offer);
  const classes = sheet.features.filter((f) => f.ref.kind === 'class' || f.ref.kind === 'subclass');
  const others = sheet.features.filter(
    (f) => f.ref.kind !== 'class' && f.ref.kind !== 'subclass' && f.choices.some(spellPicks),
  );
  const preparers = sheet.spellcasting.casters.filter(
    (c) => c.preparedChange === 'restLong' && c.preparedMax > 0,
  );

  const prepared = (caster: DerivedCaster) => (
    <section key={caster.key} className={page.card} aria-label={`${caster.name} prepared spells`}>
      <h2 className={page.cardTitle}>{caster.name}: prepared spells</h2>
      <p className={styles.intro}>
        Prepare up to {caster.preparedMax} spells of level {caster.maxSpellLevel} or lower
        {caster.spellbook ? ' from your spellbook' : ' from your class’s list'}. You can change them
        after each Long Rest
        {caster.swapLimit ? ` (a ${caster.name} changes ${caster.swapLimit})` : ''}.
      </p>
      {caster.spellbook && !caster.spellbook.length ? (
        <p className={inventory.muted}>Choose the spells in your spellbook first.</p>
      ) : (
        <PrepareSheet
          caster={caster}
          sources={character.enabledSources}
          current={character.state.prepared[caster.key] ?? []}
          onSave={(ids) => apply((c) => prepare(c, caster.key, ids))}
        />
      )}
    </section>
  );

  return (
    <>
      <p className={styles.intro}>
        Cantrips can be cast at will. Level 1 spells use a spell slot each; you regain slots after a
        Long Rest. Tap Read to see what a spell does.
      </p>
      {classes.map((f) =>
        f.choices.some(spellPicks) ? (
          <section key={refKey(f.ref)} className={page.card} aria-label={`${f.name} spells`}>
            <h2 className={page.cardTitle}>{f.name}</h2>
            <FeatureChoices features={[f]} ctx={ctx} onPick={onPick} only={spellPicks} />
          </section>
        ) : null,
      )}
      {preparers.map(prepared)}
      {others.map((f) => (
        <section key={refKey(f.ref)} className={page.card} aria-label={`${f.name} spells`}>
          <h2 className={page.cardTitle}>{f.name}</h2>
          <FeatureChoices features={[f]} ctx={ctx} onPick={onPick} only={spellPicks} />
        </section>
      ))}
    </>
  );
}
