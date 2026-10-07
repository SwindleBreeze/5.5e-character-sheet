// Step 3: the species (plan §9.3, step 4.4). Lineages and ancestries are listed under their
// species; the chosen one's picks (size, a skill, a feat, a lineage's spellcasting ability)
// follow, with what those bring in.

import { chooseSpecies } from '../../../engine/build/wizard.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import page from '../../../app/Page.module.css';
import type { WizardBindings } from '../bindings.ts';
import { EntityCards } from '../EntityCards.tsx';
import { AboutEntity, ReadSheet } from '../Explain.tsx';
import { speciesCards } from '../text.ts';
import styles from '../wizard.module.css';
import { OriginChoices } from './BackgroundStep.tsx';

export function SpeciesStep(b: WizardBindings) {
  const { character, content, sheet, change } = b;
  const ui = useSheet();
  const selectedId = character.log[0]?.origin?.speciesRef?.id;
  const owner = sheet?.features.find((f) => f.ref.kind === 'species' && f.ref.id === selectedId);
  const selected = selectedId ? content.index.get({ kind: 'species', id: selectedId }) : undefined;

  return (
    <>
      <EntityCards
        label="Species"
        items={speciesCards(content.catalog.of('species'))}
        selected={selectedId}
        onSelect={(id) => change((c) => chooseSpecies(c, { kind: 'species', id }))}
        onRead={(id) =>
          ui.open({
            key: `wizard:species:${id}`,
            title: content.index.get({ kind: 'species', id })?.name ?? 'Species',
            render: () => <ReadSheet entityRef={{ kind: 'species', id }} index={content.index} />,
          })
        }
      />
      {owner && (
        <section className={page.card} aria-label={`${owner.name} choices`}>
          <h2 className={page.cardTitle}>{owner.name}</h2>
          {selected && <AboutEntity entity={selected} index={content.index} />}
          <h3 className={styles.subTitle}>Your choices</h3>
          {owner.choices.length ? (
            <OriginChoices b={b} owner={owner} />
          ) : (
            <p className={styles.intro}>Nothing to choose.</p>
          )}
        </section>
      )}
    </>
  );
}
