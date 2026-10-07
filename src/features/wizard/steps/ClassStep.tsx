// Step 1: the class (plan §9.3, step 4.4). Every class the enabled sources offer, each with its
// hit die and primary ability; the chosen one with its training and table.

import { chooseClass } from '../../../engine/build/wizard.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import page from '../../../app/Page.module.css';
import type { WizardBindings } from '../bindings.ts';
import { ClassFacts, ClassTable } from '../ClassDetails.tsx';
import { EntityCards } from '../EntityCards.tsx';
import { classLine } from '../text.ts';
import styles from '../wizard.module.css';

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
        <div className={page.content}>
          <ClassFacts cls={cls} index={content.index} />
          <ClassTable cls={cls} index={content.index} />
          <EntitySheet entityRef={{ kind: 'class', id }} />
        </div>
      ),
    });
  };

  return (
    <>
      <p className={styles.intro}>
        Your class is your character’s training and calling: it gives most of your abilities and hit
        points. You can read each one before choosing.
      </p>
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
          <ClassFacts cls={selected} index={content.index} />
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
