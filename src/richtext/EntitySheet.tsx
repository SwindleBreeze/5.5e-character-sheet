import { useEntity } from '../content/hooks.ts';
import type { ContentEntity, Entry, Ref } from '../schema/index.ts';
import { Badge } from '../ui/Badge.tsx';
import { Entries } from './Entries.tsx';
import { entityMeta, nameFromId } from './entityMeta.ts';
import { InlineText } from './InlineText.tsx';
import { InSheetContext } from './inSheet.ts';
import styles from './richtext.module.css';

function extraEntries(entity: ContentEntity): { title: string; entries: Entry[] } | null {
  if (entity.kind === 'spell' && entity.higherLevel?.length) {
    return { title: 'At higher levels', entries: entity.higherLevel };
  }
  return null;
}

/** `bare`: without the name, for text shown under something that already names it. */
export function EntityView({ entity, bare }: { entity: ContentEntity; bare?: boolean }) {
  const meta = entityMeta(entity);
  const extra = extraEntries(entity);
  return (
    <article className={styles.entity}>
      {bare ? (
        <p className={styles.subtitle}>{meta.subtitle}</p>
      ) : (
        <header className={styles.entityHeader}>
          <h2 className={styles.entityName}>{entity.name}</h2>
          <p className={styles.subtitle}>
            {meta.subtitle}{' '}
            <Badge title={entity.page ? `Page ${entity.page}` : undefined}>{entity.source}</Badge>
          </p>
        </header>
      )}
      {meta.facts.length > 0 && (
        <dl className={styles.facts}>
          {meta.facts.map((f) => (
            <div key={f.label} className={styles.fact}>
              <dt>{f.label}</dt>
              <dd>
                <InlineText text={f.value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {entity.fluff?.length ? (
        <details className={styles.about}>
          <summary>About</summary>
          <Entries entries={entity.fluff} />
        </details>
      ) : null}
      <Entries entries={entity.entries} />
      {extra && (
        <section>
          <h3 className={styles.h3}>{extra.title}</h3>
          <Entries entries={extra.entries} />
        </section>
      )}
    </article>
  );
}

/** Content of the rule sheet for one entity. Links inside push further pages. */
export function EntitySheet({ entityRef }: { entityRef: Ref }) {
  const entity = useEntity(entityRef);
  return (
    <InSheetContext.Provider value={true}>
      {entity === undefined ? null : entity === null ? (
        <p className={styles.missing}>
          “{nameFromId(entityRef.id)}” isn’t in your imported content. Import the source it comes
          from to read it here.
        </p>
      ) : (
        <EntityView entity={entity} />
      )}
    </InSheetContext.Provider>
  );
}
