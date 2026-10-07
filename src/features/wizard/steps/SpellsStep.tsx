// The spells step, when the class gives spells (plan §9.3 step 4.4, §9.3b step 4B.5): its
// cantrips, the level 1 spells of a class that learns them (Bard, Sorcerer, Warlock) or a
// Wizard's spellbook, and the spells a class prepares (Cleric, Druid, Paladin, Ranger, Wizard:
// changeable after each Long Rest). A species' or background feat's spells are picked on its
// own step.

import { setPick } from '../../../engine/play/features.ts';
import type { DerivedCaster } from '../../../engine/derive/types.ts';
import { decodeChoiceKey, refKey, type Character, type Id } from '../../../schema/index.ts';
import page from '../../../app/Page.module.css';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import { PrepareSheet } from '../../sheet/spells/PrepareSheet.tsx';
import inventory from '../../sheet/inventory/inventory.module.css';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import { picksOnStep } from '../progress.ts';
import choices from '../../choices/choices.module.css';

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
  const { features, only } = picksOnStep(sheet, 'spells');
  const preparers = sheet.spellcasting.casters.filter(
    (c) => c.preparedChange === 'restLong' && c.preparedMax > 0,
  );

  const prepared = (caster: DerivedCaster) => (
    <section key={caster.key} className={page.card} aria-label={`${caster.name} prepared spells`}>
      <h2 className={page.cardTitle}>{caster.name}: prepared spells</h2>
      <p className={choices.help}>
        Prepared spells are the ones you can cast today. Prepare up to {caster.preparedMax} spells
        of level {caster.maxSpellLevel} or lower
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
      {features.map((f) => (
        <section key={refKey(f.ref)} className={page.card} aria-label={`${f.name} spells`}>
          <h2 className={page.cardTitle}>{f.name}</h2>
          <FeatureChoices features={[f]} ctx={ctx} onPick={onPick} only={only} />
        </section>
      ))}
      {preparers.map(prepared)}
    </>
  );
}
