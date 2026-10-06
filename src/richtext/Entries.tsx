import type { ReactNode } from 'react';
import { useEntity } from '../content/hooks.ts';
import type { Entry, EntryBlock, Ref } from '../schema/index.ts';
import { nameFromId } from './entityMeta.ts';
import { InlineText } from './InlineText.tsx';
import styles from './richtext.module.css';

/** Heading level for a named block at this depth: h3, h4, then bold run-in names. */
function Heading({ depth, children }: { depth: number; children: ReactNode }) {
  if (depth === 0) return <h3 className={styles.h3}>{children}</h3>;
  if (depth === 1) return <h4 className={styles.h4}>{children}</h4>;
  return <h5 className={styles.h5}>{children}</h5>;
}

/** A referenced feature, shown inline with its own text (plan §6.4). */
function FeatureRef({ entityRef, depth }: { entityRef: Ref; depth: number }) {
  const entity = useEntity(entityRef);
  if (entity === undefined) return null;
  if (entity === null) {
    return (
      <p className={styles.missing}>
        {nameFromId(entityRef.id)} <span className={styles.note}>(not imported)</span>
      </p>
    );
  }
  return (
    <section className={styles.block}>
      <Heading depth={depth}>{entity.name}</Heading>
      <EntryList entries={entity.entries} depth={depth + 1} />
    </section>
  );
}

function Block({ entry, depth }: { entry: EntryBlock; depth: number }) {
  switch (entry.type) {
    case 'entries':
    case 'section':
      return (
        <section className={styles.block}>
          {entry.name && <Heading depth={depth}>{entry.name}</Heading>}
          <EntryList entries={entry.entries} depth={entry.name ? depth + 1 : depth} />
        </section>
      );
    case 'inset':
      return (
        <aside className={styles.inset}>
          {entry.name && <Heading depth={Math.max(depth, 1)}>{entry.name}</Heading>}
          <EntryList entries={entry.entries} depth={depth + 1} />
        </aside>
      );
    case 'list':
      return (
        <ul className={entry.style === 'none' ? styles.plainList : styles.list}>
          {entry.items.map((item, i) => (
            <li key={i}>
              <EntryView entry={item} depth={depth} inline />
            </li>
          ))}
        </ul>
      );
    case 'item':
      return (
        <div className={styles.item}>
          <strong>
            <InlineText text={entry.name} />
          </strong>{' '}
          {entry.entries.map((e, i) => (
            <EntryView key={i} entry={e} depth={depth + 1} inline />
          ))}
        </div>
      );
    case 'table':
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            {entry.caption && (
              <caption>
                <InlineText text={entry.caption} />
              </caption>
            )}
            {entry.colLabels.length > 0 && (
              <thead>
                <tr>
                  {entry.colLabels.map((l, i) => (
                    <th key={i} scope="col">
                      <InlineText text={l} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {entry.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <EntryView entry={cell} depth={depth + 1} inline />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'quote':
      return (
        <blockquote className={styles.quote}>
          <EntryList entries={entry.entries} depth={depth + 1} />
          {entry.by && <footer>— {entry.by}</footer>}
        </blockquote>
      );
    case 'options':
      return (
        <div className={styles.options}>
          {entry.count !== undefined && entry.count > 1 && (
            <p className={styles.note}>Choose {entry.count}:</p>
          )}
          <EntryList entries={entry.entries} depth={depth} />
        </div>
      );
    case 'ref':
      return <FeatureRef entityRef={entry.ref} depth={depth} />;
    case 'unknown':
      return null;
  }
}

function EntryView({
  entry,
  depth,
  inline = false,
}: {
  entry: Entry;
  depth: number;
  inline?: boolean;
}) {
  if (typeof entry === 'string') {
    return inline ? (
      <InlineText text={entry} />
    ) : (
      <p className={styles.p}>
        <InlineText text={entry} />
      </p>
    );
  }
  return <Block entry={entry} depth={depth} />;
}

function EntryList({ entries, depth }: { entries: Entry[]; depth: number }) {
  return (
    <>
      {entries.map((e, i) => (
        <EntryView key={i} entry={e} depth={depth} />
      ))}
    </>
  );
}

/** Renders an entry tree: rules text with headings, lists, tables and inline features. */
export function Entries({ entries }: { entries: Entry[] }) {
  return (
    <div className={styles.entries}>
      <EntryList entries={entries} depth={0} />
    </div>
  );
}
