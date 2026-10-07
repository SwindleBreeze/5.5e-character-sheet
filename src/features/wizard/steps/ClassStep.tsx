// Step 1: the class (plan §9.3 step 4.4, §9.3b step 4B.3). Every class the enabled sources offer,
// each with its hit die and primary ability; the chosen one with its flavor text, what it gives
// in plain words, and its table.

import { chooseClass } from '../../../engine/build/wizard.ts';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import page from '../../../app/Page.module.css';
import type { WizardBindings } from '../bindings.ts';
import { ClassTable } from '../ClassDetails.tsx';
import { EntityCards } from '../EntityCards.tsx';
import { AboutEntity, ReadSheet } from '../Explain.tsx';
import { classLine } from '../text.ts';

export function ClassStep(b: WizardBindings) {
  const { character, content, change } = b;
  const ui = useSheet();
  const classes = content.catalog.of('class');
  const selectedId = character.log[0]?.classRef.id;
  const selected = selectedId ? content.index.get({ kind: 'class', id: selectedId }) : undefined;

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

  return (
    <>
      <EntityCards
        label="Classes"
        items={classes.map((c) => ({ id: c.id, name: c.name, detail: classLine(c) }))}
        selected={selectedId}
        onSelect={(id) => change((c) => chooseClass(c, { kind: 'class', id }, content.index))}
        onRead={read}
      />
      {selected && (
        <section className={page.card} aria-label={`About the ${selected.name}`}>
          <h2 className={page.cardTitle}>{selected.name}</h2>
          <AboutEntity entity={selected} index={content.index} />
          <details>
            <summary>Class table</summary>
            <ClassTable cls={selected} index={content.index} />
          </details>
          <div className={page.row}>
            <Button size="sm" onClick={() => read(selected.id)}>
              Read the {selected.name}
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
