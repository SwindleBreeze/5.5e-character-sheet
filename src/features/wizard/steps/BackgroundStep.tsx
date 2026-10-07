// Step 2: the background (plan §9.3 step 4.4, §9.3b steps 4B.3 and 4B.5). Each background with
// its abilities, Origin feat and skills at a glance; the chosen one opens in place with its
// flavor text and everything it asks for: ability increases first, then languages, a tool, the
// Origin feat with its own picks, and starting equipment.

import { chooseBackground } from '../../../engine/build/wizard.ts';
import { setPick } from '../../../engine/play/features.ts';
import type { DerivedFeature } from '../../../engine/derive/types.ts';
import { decodeChoiceKey, refKey } from '../../../schema/index.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import choices from '../../choices/choices.module.css';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import { EntityCards } from '../EntityCards.tsx';
import { ReadSheet, WhatYouGet, AboutFlavor } from '../Explain.tsx';
import { backgroundChips } from '../text.ts';
import { EquipmentChoice } from './EquipmentChoice.tsx';

/**
 * The picks an origin (a background or species) asks for, and those of what it grants outright
 * (a background's Origin feat), each with a line on what it is for.
 */
export function OriginChoices({ b, owner }: { b: WizardBindings; owner: DerivedFeature }) {
  const { sheet, apply, content } = b;
  if (!sheet) return null;
  const ctx = choiceContext(b, sheet);
  const key = refKey(owner.ref);
  // Granted outright, not through one of its picks (an Origin feat).
  const granted = sheet.features.filter(
    (f) =>
      f.pickedIn &&
      refKey(f.pickedIn.ref) === key &&
      !owner.choices.some((c) => c.values.includes(f.ref.id)),
  );
  const onPick: Parameters<typeof FeatureChoices>[0]['onPick'] = (c, f, pick) =>
    apply((ch) =>
      setPick(ch, decodeChoiceKey(c.key), { ...pick, entryIndex: f.entryIndex, via: 'creation' }),
    );
  // Ability scores first: they matter most and the rest is easier once they are set.
  const ordered = {
    ...owner,
    choices: [
      ...owner.choices.filter((c) => c.offer.kind === 'backgroundAbility'),
      ...owner.choices.filter((c) => c.offer.kind !== 'backgroundAbility'),
    ],
  };
  return (
    <>
      <FeatureChoices features={[ordered]} ctx={ctx} onPick={onPick} />
      {granted.map((f) => {
        const entity = content.index.get(f.ref);
        return (
          <section key={refKey(f.ref)} className={choices.choice} aria-label={f.name}>
            <h3 className={choices.choiceTitle}>
              {f.ref.kind === 'feat' ? 'Origin feat: ' : ''}
              {f.name}
            </h3>
            <p className={choices.help}>
              A feat is a special talent; this one comes with your {owner.name} background.
              {f.choices.length ? ' Make its choices below.' : ' It has nothing to choose.'}
            </p>
            {entity && <WhatYouGet entity={entity} index={content.index} folded />}
            {f.choices.length > 0 && <FeatureChoices features={[f]} ctx={ctx} onPick={onPick} />}
          </section>
        );
      })}
    </>
  );
}

export function BackgroundStep(b: WizardBindings) {
  const { character, content, sheet, change } = b;
  const ui = useSheet();
  const backgrounds = content.catalog.of('background');
  const selectedId = character.log[0]?.origin?.backgroundRef?.id;
  const owner = sheet?.features.find((f) => f.ref.kind === 'background' && f.ref.id === selectedId);
  const selected = selectedId
    ? content.index.get({ kind: 'background', id: selectedId })
    : undefined;
  const spread = owner?.choices.find((c) => c.offer.kind === 'backgroundAbility')?.values;

  const expanded = selected && (
    <>
      <AboutFlavor entity={selected} />
      {owner && <OriginChoices b={b} owner={owner} />}
      <EquipmentChoice b={b} owner={{ kind: 'background', id: selected.id }} />
      <WhatYouGet entity={selected} index={content.index} folded omit={['Equipment']} />
    </>
  );

  return (
    <EntityCards
      label="Backgrounds"
      items={backgrounds.map((bg) => ({
        id: bg.id,
        name: bg.name,
        chips: backgroundChips(bg, content.index, bg.id === selectedId ? spread : undefined),
      }))}
      selected={selectedId}
      onSelect={(id) => change((c) => chooseBackground(c, { kind: 'background', id }))}
      onRead={(id) =>
        ui.open({
          key: `wizard:background:${id}`,
          title: content.index.get({ kind: 'background', id })?.name ?? 'Background',
          render: () => <ReadSheet entityRef={{ kind: 'background', id }} index={content.index} />,
        })
      }
      expanded={expanded}
    />
  );
}
