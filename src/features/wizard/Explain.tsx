// How the wizard explains a class, background, species, lineage or feat (plan §9.3b, steps 4B.3
// and 4B.5): its flavor text (from the imported content) and what it gives the character.

import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { benefitsOf, type Benefit } from '../../engine/explain/benefits.ts';
import type { ContentEntity, Entry, Ref } from '../../schema/index.ts';
import { Entries } from '../../richtext/Entries.tsx';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import styles from './wizard.module.css';

/**
 * What it gives: plain lines (label, value), then its named traits in full, each under its name
 * (a trait's text can run long, so it takes the whole width).
 */
export function BenefitList({ benefits, label }: { benefits: readonly Benefit[]; label: string }) {
  const plain = benefits.filter((b) => !b.trait);
  const traits = benefits.filter((b) => b.trait);
  const list = (items: readonly Benefit[], name: string) => (
    <dl className={styles.benefits} aria-label={name}>
      {items.map((b) => (
        <div
          key={`${b.label}|${b.text}`}
          className={b.entries ? `${styles.benefit} ${styles.trait}` : styles.benefit}
        >
          <dt>{b.label}</dt>
          <dd>
            {b.entries ? <Entries entries={b.entries} /> : b.text}
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

/** Flavor text, if the content has it. */
export function AboutFlavor({ entity }: { entity: ContentEntity }) {
  return <Flavor entries={entity.fluff} name={entity.name} />;
}

/**
 * What it gives. `folded`: behind "Everything the … gives", for when its choices come first.
 * `omit`: lines chosen right there (its equipment), by label prefix.
 */
export function WhatYouGet({
  entity,
  index,
  folded,
  omit = [],
}: {
  entity: ContentEntity;
  index: ContentIndex;
  folded?: boolean;
  omit?: readonly string[];
}) {
  const benefits = benefitsOf(entity, index).filter(
    (b) => !omit.some((prefix) => b.label.startsWith(prefix)),
  );
  const parent =
    entity.kind === 'species' && entity.variantOf
      ? index.get({ kind: 'species', id: entity.variantOf })
      : undefined;
  if (!benefits.length && !parent) return null;
  const title = parent ? `What the ${entity.name} adds` : `Everything the ${entity.name} gives`;
  // A lineage or ancestry: what it adds, then, as plainly, what every one of the species has.
  const body = (
    <>
      <BenefitList benefits={benefits} label={title} />
      {parent && (
        <section className={styles.gives} aria-label={`What every ${parent.name} has`}>
          <h3 className={styles.subTitle}>What every {parent.name} has</h3>
          <BenefitList
            benefits={benefitsOf(parent, index).filter(
              (b) => !b.trait || !benefits.some((own) => own.trait && own.label === b.label),
            )}
            label={parent.name}
          />
        </section>
      )}
    </>
  );
  return folded ? (
    <details className={styles.gives} aria-label={title}>
      <summary>{title}</summary>
      {body}
    </details>
  ) : (
    <section className={styles.gives} aria-label={title}>
      <h3 className={styles.subTitle}>{title}</h3>
      {body}
    </section>
  );
}

/** Flavor text, then what it gives. */
export function AboutEntity({ entity, index }: { entity: ContentEntity; index: ContentIndex }) {
  return (
    <div className={styles.about}>
      <AboutFlavor entity={entity} />
      <WhatYouGet entity={entity} index={index} />
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
