// The Extras tab (plan §10.3, step 7.6): Wild Shape forms, when the character has Wild Shape,
// and the familiars, steeds, companions and summons it keeps track of, each with its stat
// block and hit points.

import { useRef, type ReactNode } from 'react';
import { addExtra } from '../../engine/extras/extras.ts';
import { wildShapeRules } from '../../engine/extras/wildShape.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import actions from './actions/actions.module.css';
import { SectionHeader } from './components/stats.tsx';
import { AddExtraSheet } from './extras/AddExtraSheet.tsx';
import { ExtraCard } from './extras/Companions.tsx';
import { WildShapeSection } from './extras/WildShape.tsx';
import inventory from './inventory/inventory.module.css';
import { usePublishBindings } from './liveBindings.ts';
import mainStyles from './MainTab.module.css';
import type { SheetBindings } from './sheetBindings.ts';

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={mainStyles.section} aria-labelledby={`extras-${id}`}>
      <SectionHeader id={`extras-${id}`} title={title} action={action} />
      {children}
    </section>
  );
}

export function ExtrasTab(bindings: SheetBindings) {
  const { character, sheet, index, apply } = bindings;
  usePublishBindings(bindings);
  const ref = useRef<HTMLDivElement>(null);
  const columns = Math.min(2, columnsFor(useContainerWidth(ref)));
  const ui = useSheet();
  const rules = wildShapeRules(sheet, index);
  const extras = character.extras ?? [];

  const add = () =>
    ui.open({
      key: 'extras:add',
      title: 'Add a companion',
      render: () => (
        <AddExtraSheet
          character={character}
          sheet={sheet}
          onAdd={(spec) => {
            ui.close();
            apply((c) => addExtra(c, spec));
          }}
        />
      ),
    });

  const wildShape = rules && (
    <Section id="wild-shape" title={rules.toggle.name}>
      <WildShapeSection bindings={bindings} rules={rules} />
    </Section>
  );
  const companions = (
    <Section
      id="companions"
      title="Companions"
      action={
        <Button size="sm" onClick={add}>
          Add
        </Button>
      }
    >
      {extras.length ? (
        <ul className={actions.list}>
          {extras.map((e) => (
            <ExtraCard key={e.uid} bindings={bindings} extra={e} />
          ))}
        </ul>
      ) : (
        <p className={inventory.muted}>
          No companions yet. Add a familiar, a steed, a companion or a summon to see its stat block
          and keep track of its hit points.
        </p>
      )}
    </Section>
  );

  return (
    <div ref={ref} className={mainStyles.main} data-columns={columns}>
      {columns === 1 || !wildShape ? (
        <div className={mainStyles.column}>
          {wildShape}
          {companions}
        </div>
      ) : (
        <>
          <div className={mainStyles.column}>{wildShape}</div>
          <div className={mainStyles.column}>{companions}</div>
        </>
      )}
    </div>
  );
}
