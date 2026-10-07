// Step 2: the background (plan §9.3, step 4.4): its ability increases (+2/+1 or +1/+1/+1 among
// its three abilities), and its Origin feat with that feat's own choices.

import { chooseBackground } from '../../../engine/build/wizard.ts';
import { setPick } from '../../../engine/play/features.ts';
import type { DerivedFeature } from '../../../engine/derive/types.ts';
import { decodeChoiceKey, refKey } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import page from '../../../app/Page.module.css';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import { EntityCards } from '../EntityCards.tsx';
import { AboutEntity, ReadSheet } from '../Explain.tsx';
import { backgroundLine } from '../text.ts';
import styles from '../wizard.module.css';

/** The picks an origin entity offers, and those of what it grants outright (a feat). */
export function OriginChoices({
  b,
  owner,
}: {
  b: WizardBindings;
  owner: DerivedFeature | undefined;
}) {
  const { sheet, apply } = b;
  if (!sheet || !owner) return null;
  const ctx = choiceContext(b, sheet);
  const key = refKey(owner.ref);
  // Granted outright, not through one of its picks (an Origin feat).
  const granted = sheet.features.filter(
    (f) =>
      f.pickedIn &&
      refKey(f.pickedIn.ref) === key &&
      !owner.choices.some((c) => c.values.includes(f.ref.id)),
  );
  const entityOf = (f: DerivedFeature) => b.content.index.get(f.ref);
  const onPick: Parameters<typeof FeatureChoices>[0]['onPick'] = (c, f, pick) =>
    apply((ch) =>
      setPick(ch, decodeChoiceKey(c.key), { ...pick, entryIndex: f.entryIndex, via: 'creation' }),
    );
  return (
    <>
      <FeatureChoices
        features={[
          // Ability scores first, as the guide tells it.
          {
            ...owner,
            choices: [
              ...owner.choices.filter((c) => c.offer.kind === 'backgroundAbility'),
              ...owner.choices.filter((c) => c.offer.kind !== 'backgroundAbility'),
            ],
          },
        ]}
        ctx={ctx}
        onPick={onPick}
      />
      {granted.map((f) => (
        <section key={refKey(f.ref)} className={page.card} aria-label={f.name}>
          <h2 className={page.cardTitle}>
            {f.ref.kind === 'feat' ? 'Feat: ' : ''}
            {f.name}
          </h2>
          {entityOf(f) && <AboutEntity entity={entityOf(f)!} index={b.content.index} />}
          <details>
            <summary>Full rules text</summary>
            <EntitySheet entityRef={f.ref} />
          </details>
          {f.choices.length ? (
            <FeatureChoices features={[f]} ctx={ctx} onPick={onPick} />
          ) : (
            <p className={styles.intro}>Nothing to choose.</p>
          )}
        </section>
      ))}
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

  return (
    <>
      <EntityCards
        label="Backgrounds"
        items={backgrounds.map((bg) => ({
          id: bg.id,
          name: bg.name,
          detail: backgroundLine(bg, content.index),
        }))}
        selected={selectedId}
        onSelect={(id) => change((c) => chooseBackground(c, { kind: 'background', id }))}
        onRead={(id) =>
          ui.open({
            key: `wizard:background:${id}`,
            title: content.index.get({ kind: 'background', id })?.name ?? 'Background',
            render: () => (
              <ReadSheet entityRef={{ kind: 'background', id }} index={content.index} />
            ),
          })
        }
      />
      {owner && (
        <section className={page.card} aria-label={`${owner.name} choices`}>
          <h2 className={page.cardTitle}>{owner.name}</h2>
          {selected && <AboutEntity entity={selected} index={content.index} />}
          <h3 className={styles.subTitle}>Your choices</h3>
          <OriginChoices b={b} owner={owner} />
        </section>
      )}
    </>
  );
}
