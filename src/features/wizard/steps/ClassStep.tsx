// Step 1: the class (plan §9.3 step 4.4, §9.3b steps 4B.3 and 4B.5). Each class with its hit die
// and primary ability at a glance; the chosen one opens in place with its flavor text, the picks
// it asks for now (skills, tools, starting equipment), and, folded, everything it gives and its
// table.

import { chooseClass } from '../../../engine/build/wizard.ts';
import { setPick } from '../../../engine/play/features.ts';
import { decodeChoiceKey } from '../../../schema/index.ts';
import { useSources } from '../../../content/hooks.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import page from '../../../app/Page.module.css';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import { choiceContext, stepOf, type WizardBindings } from '../bindings.ts';
import { ClassTable } from '../ClassDetails.tsx';
import { EntityCards } from '../EntityCards.tsx';
import { AboutFlavor, ReadSheet, WhatYouGet } from '../Explain.tsx';
import { groupBySource } from '../sources.ts';
import { classChips } from '../text.ts';
import styles from '../wizard.module.css';
import { EquipmentChoice } from './EquipmentChoice.tsx';

export function ClassStep(b: WizardBindings) {
  const { character, content, sheet, change, apply } = b;
  const ui = useSheet();
  const sources = useSources();
  const groups = groupBySource(content.catalog.of('class'), sources);
  const selectedId = character.log[0]?.classRef.id;
  const selected = selectedId ? content.index.get({ kind: 'class', id: selectedId }) : undefined;
  const owner = sheet?.features.find((f) => f.ref.kind === 'class' && f.ref.id === selectedId);

  const read = (id: string) => {
    const cls = content.index.get({ kind: 'class', id });
    if (!cls) return;
    ui.open({
      key: `wizard:class:${id}`,
      title: cls.name,
      render: () => (
        <>
          <ReadSheet entityRef={{ kind: 'class', id }} index={content.index} />
          <div className={page.content}>
            <ClassTable cls={cls} index={content.index} />
          </div>
        </>
      ),
    });
  };

  const expanded = selected && (
    <>
      <AboutFlavor entity={selected} />
      {owner && sheet && (
        <FeatureChoices
          features={[owner]}
          ctx={choiceContext(b, sheet)}
          only={(c) => stepOf(c.offer, sheet) === 'class'}
          onPick={(c, _f, pick) =>
            apply((ch) =>
              setPick(ch, decodeChoiceKey(c.key), {
                ...pick,
                entryIndex: c.entryIndex,
                via: 'creation',
              }),
            )
          }
        />
      )}
      <EquipmentChoice b={b} owner={{ kind: 'class', id: selected.id }} />
      <WhatYouGet entity={selected} index={content.index} folded omit={['Equipment']} />
      <details className={styles.gives}>
        <summary>The {selected.name} table, levels 1–20</summary>
        <ClassTable cls={selected} index={content.index} />
      </details>
    </>
  );

  return (
    <EntityCards
      label="Classes"
      items={groups.flatMap((g) =>
        g.items.map((c) => ({ id: c.id, name: c.name, group: g.label, chips: classChips(c) })),
      )}
      selected={selectedId}
      onSelect={(id) => change((c) => chooseClass(c, { kind: 'class', id }, content.index))}
      onRead={read}
      expanded={expanded}
    />
  );
}
