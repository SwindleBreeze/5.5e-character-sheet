// Step 2: the background (plan §9.3 step 4.4, §9.3b steps 4B.3 and 4B.5). Each background with
// its abilities, Origin feat and skills at a glance; the chosen one opens in place with its
// flavor text and everything it asks for: ability increases first, then languages, a tool, the
// Origin feat with its own picks, and starting equipment.

import { grantedUnder } from '../../choices/picks.ts';
import { chooseBackground } from '../../../engine/build/wizard.ts';
import { setPick } from '../../../engine/play/features.ts';
import type { DerivedFeature } from '../../../engine/derive/types.ts';
import { decodeChoiceKey, refKey } from '../../../schema/index.ts';
import { useSources } from '../../../content/hooks.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import choices from '../../choices/choices.module.css';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import { EntityCards } from '../EntityCards.tsx';
import { ReadSheet, WhatYouGet, AboutFlavor } from '../Explain.tsx';
import { classFocus, originSuggestion } from '../../choices/suggest.ts';
import { groupBySource } from '../sources.ts';
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
  // Granted outright, not through one of its picks (an Origin feat).
  const granted = grantedUnder(owner, sheet.features);
  const onPick: Parameters<typeof FeatureChoices>[0]['onPick'] = (c, _f, pick) =>
    apply((ch) =>
      setPick(ch, decodeChoiceKey(c.key), { ...pick, entryIndex: c.entryIndex, via: 'creation' }),
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
  const sources = useSources();
  const groups = groupBySource(content.catalog.of('background'), sources);
  const selectedId = character.log[0]?.origin?.backgroundRef?.id;
  const owner = sheet?.features.find((f) => f.ref.kind === 'background' && f.ref.id === selectedId);
  const selected = selectedId
    ? content.index.get({ kind: 'background', id: selectedId })
    : undefined;
  const focus = classFocus(character, content.index);
  const spread = owner?.choices.find((c) => c.offer.kind === 'backgroundAbility')?.values;

  const expanded = selected && (
    <>
      <AboutFlavor entity={selected} />
      {selected.edition === '2014' && !selected.featId && (
        <p className={choices.help}>
          A 2014 background. A 2024 character also gets ability increases and an Origin feat from
          its background; this one lists neither, so choose them below (check with your DM).
        </p>
      )}
      {owner && <OriginChoices b={b} owner={owner} />}
      <EquipmentChoice b={b} owner={{ kind: 'background', id: selected.id }} />
      <WhatYouGet entity={selected} index={content.index} folded omit={['Equipment']} />
    </>
  );

  return (
    <EntityCards
      label="Backgrounds"
      items={groups.flatMap((g) =>
        g.items.map((bg) => ({
          id: bg.id,
          name: bg.name,
          group: g.label,
          groupKey: g.code,
          suggested: originSuggestion(bg, focus),
          chips: backgroundChips(bg, content.index, bg.id === selectedId ? spread : undefined),
        })),
      )}
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
