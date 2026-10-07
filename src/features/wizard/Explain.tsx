// How the wizard explains things (plan §9.3b, step 4B.3): the guide at the top of each step,
// and for a class, background, species, lineage or feat its flavor text (from the imported
// content) and what it gives the character.

import { useState } from 'react';
import type { WizardStep } from '../../engine/build/wizard.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { benefitsOf, type Benefit } from '../../engine/explain/benefits.ts';
import type { ContentEntity, Entry, Ref } from '../../schema/index.ts';
import { Entries } from '../../richtext/Entries.tsx';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import { guideOpen, setGuideOpen, STEP_GUIDES } from './guide.ts';
import styles from './wizard.module.css';

export function StepGuideCard({ step }: { step: WizardStep }) {
  const [open, setOpen] = useState(guideOpen);
  const guide = STEP_GUIDES[step];
  return (
    <details
      className={styles.guide}
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setOpen(next);
        setGuideOpen(next);
      }}
    >
      <summary>Guide: {guide.where}</summary>
      <ul>
        {guide.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </details>
  );
}

export function BenefitList({ benefits, label }: { benefits: readonly Benefit[]; label: string }) {
  const plain = benefits.filter((b) => !b.trait);
  const traits = benefits.filter((b) => b.trait);
  const list = (items: readonly Benefit[], name: string) => (
    <dl className={styles.benefits} aria-label={name}>
      {items.map((b) => (
        <div key={`${b.label}|${b.text}`} className={styles.benefit}>
          <dt>{b.label}</dt>
          <dd>
            {b.text}
            {b.why && <span className={styles.why}>{b.why}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
  if (!benefits.length) return null;
  return (
    <>
      {plain.length > 0 && list(plain, label)}
      {traits.length > 0 && (
        <>
          <h4 className={styles.subTitle}>Traits</h4>
          {list(traits, `${label}: traits`)}
        </>
      )}
    </>
  );
}

/** A one-section text unwrapped to its paragraphs. */
function paragraphs(entries: readonly Entry[]): Entry[] {
  const only = entries.length === 1 ? entries[0] : undefined;
  if (only && typeof only === 'object' && 'entries' in only && !('name' in only && only.name))
    return paragraphs(only.entries as Entry[]);
  return [...entries];
}

/** Flavor text: its first paragraph, the rest folded (some run to a page). */
function Flavor({ entries, name }: { entries: readonly Entry[] | undefined; name: string }) {
  if (!entries?.length) return null;
  const [first, ...rest] = paragraphs(entries);
  return (
    <div className={styles.flavor} aria-label={`About ${name}`}>
      <Entries entries={[first!]} />
      {rest.length > 0 && (
        <details>
          <summary>Read more</summary>
          <Entries entries={rest} />
        </details>
      )}
    </div>
  );
}

/** Flavor text, if the content has it, then what it gives. */
export function AboutEntity({
  entity,
  index,
  title = 'What you get',
}: {
  entity: ContentEntity;
  index: ContentIndex;
  title?: string;
}) {
  const benefits = benefitsOf(entity, index);
  const parent =
    entity.kind === 'species' && entity.variantOf
      ? index.get({ kind: 'species', id: entity.variantOf })
      : undefined;
  return (
    <div className={styles.about}>
      <Flavor entries={entity.fluff} name={entity.name} />
      {benefits.length > 0 && (
        <section aria-label={`${title}: ${entity.name}`}>
          <h3 className={styles.subTitle}>{parent ? `What the ${entity.name} adds` : title}</h3>
          <BenefitList benefits={benefits} label={title} />
        </section>
      )}
      {parent && (
        <details>
          <summary>What every {parent.name} has</summary>
          <BenefitList benefits={benefitsOf(parent, index)} label={`${parent.name}`} />
        </details>
      )}
    </div>
  );
}

/** A Read sheet in the wizard: about it, then its rules in full. */
export function ReadSheet({ entityRef, index }: { entityRef: Ref; index: ContentIndex }) {
  const entity = index.get(entityRef);
  return (
    <div className={styles.readSheet}>
      {entity && <AboutEntity entity={entity} index={index} />}
      <details>
        <summary>Full rules text</summary>
        <EntitySheet entityRef={entityRef} />
      </details>
    </div>
  );
}
