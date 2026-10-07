// Step 3: the species (plan §9.3 step 4.4, §9.3b steps 4B.3 and 4B.5). A menu of species, then,
// for one that comes in lineages, ancestries or legacies, a second menu for that; below, the
// chosen one's flavor text, what it gives, and what it asks for.

import { useId } from 'react';
import { chooseSpecies } from '../../../engine/build/wizard.ts';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import page from '../../../app/Page.module.css';
import choices from '../../choices/choices.module.css';
import inventory from '../../sheet/inventory/inventory.module.css';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import { AboutFlavor, ReadSheet, WhatYouGet } from '../Explain.tsx';
import { variantLabel, variantsOf } from '../progress.ts';
import { speciesLine, variantName } from '../text.ts';
import styles from '../wizard.module.css';
import { OriginChoices } from './BackgroundStep.tsx';

export function SpeciesStep(b: WizardBindings) {
  const { character, content, sheet, change } = b;
  const ui = useSheet();
  const id = useId();
  const all = content.catalog.of('species');
  const ids = new Set(all.map((s) => s.id));
  const bases = all.filter((s) => !s.variantOf || !ids.has(s.variantOf));
  const selectedId = character.log[0]?.origin?.speciesRef?.id;
  const selected = selectedId ? content.index.get({ kind: 'species', id: selectedId }) : undefined;
  const base =
    selected?.variantOf && ids.has(selected.variantOf)
      ? content.index.get({ kind: 'species', id: selected.variantOf })
      : selected;
  const ctx = sheet ? choiceContext(b, sheet) : undefined;
  const variants = ctx ? variantsOf(base, ctx) : [];
  const label = variantLabel(variants);
  const needsVariant = variants.length > 0 && selected?.id === base?.id;
  const owner = sheet?.features.find((f) => f.ref.kind === 'species' && f.ref.id === selectedId);
  const choose = (speciesId: string) =>
    change((c) => chooseSpecies(c, { kind: 'species', id: speciesId }));
  const read = (speciesId: string) =>
    ui.open({
      key: `wizard:species:${speciesId}`,
      title: content.index.get({ kind: 'species', id: speciesId })?.name ?? 'Species',
      render: () => (
        <ReadSheet entityRef={{ kind: 'species', id: speciesId }} index={content.index} />
      ),
    });

  if (!bases.length)
    return (
      <p className={styles.notice}>
        Nothing to choose from. Import content, or check Settings → Sources.
      </p>
    );

  return (
    <div className={styles.speciesStep}>
      <div className={styles.menus}>
        <label className={styles.menu} htmlFor={`${id}-species`}>
          <span className={inventory.fieldLabel}>Species</span>
          <select
            id={`${id}-species`}
            value={base?.id ?? ''}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="" disabled>
              Choose a species…
            </option>
            {bases.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {variants.length > 0 && (
          <label className={styles.menu} htmlFor={`${id}-variant`}>
            <span className={inventory.fieldLabel}>{label}</span>
            <select
              id={`${id}-variant`}
              value={needsVariant ? '' : (selected?.id ?? '')}
              data-missing={needsVariant}
              onChange={(e) => choose(e.target.value)}
            >
              <option value="" disabled>
                Choose a {label.toLowerCase()}…
              </option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {variantName(v)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {selected && (
        <section
          className={`${page.card} ${styles.chosen}`}
          aria-label={`${selected.name} choices`}
        >
          <div className={styles.chosenHead}>
            <div>
              <h2 className={page.cardTitle}>{selected.name}</h2>
              <p className={styles.pickDetail}>{speciesLine(selected)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => read(selected.id)}>
              Read
            </Button>
          </div>
          <AboutFlavor entity={selected} />
          {needsVariant ? (
            <p className={choices.help}>
              Every {selected.name} has the traits below. Choose a {label.toLowerCase()} above: it
              adds its own.
            </p>
          ) : (
            owner && owner.choices.length > 0 && <OriginChoices b={b} owner={owner} />
          )}
          <WhatYouGet entity={selected} index={content.index} />
        </section>
      )}
    </div>
  );
}
