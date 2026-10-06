import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useEnabledSources, useEntitiesOfKind, useSources } from '../../content/hooks.ts';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import { entityMeta } from '../../richtext/entityMeta.ts';
import { refKey, type ContentEntity, type EntityKind } from '../../schema/index.ts';
import { availableOf } from '../../sources/sourceFilter.ts';
import { Badge } from '../../ui/Badge.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { VirtualList } from '../../ui/VirtualList.tsx';
import { SourceToggles } from '../sources/SourceToggles.tsx';
import {
  filterLibrary,
  filtersFor,
  isLibraryKind,
  LIBRARY_KINDS,
  optionsFor,
} from './libraryFilter.ts';
import styles from './LibraryPage.module.css';

const FILTER_PREFIX = 'f.';

function Results({
  kind,
  query,
  selected,
}: {
  kind: EntityKind;
  query: string;
  selected: Record<string, string>;
}) {
  const all = useEntitiesOfKind(kind) as ContentEntity[] | undefined;
  const enabled = useEnabledSources();
  const [, setParams] = useSearchParams();
  const sheet = useSheet();

  const available = useMemo(() => (all ? availableOf(all, new Set(enabled)) : []), [all, enabled]);
  const results = useMemo(
    () => filterLibrary(available, query, selected, kind),
    [available, query, selected, kind],
  );
  const filterDefs = filtersFor(kind);

  if (all === undefined) return null;

  const setFilter = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(FILTER_PREFIX + key, value);
        else next.delete(FILTER_PREFIX + key);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      {filterDefs.length > 0 && (
        <div className={styles.filters}>
          {filterDefs.map((def) => (
            <label key={def.key} className={styles.filter}>
              <span className="visually-hidden">{def.label}</span>
              <select
                value={selected[def.key] ?? ''}
                onChange={(e) => setFilter(def.key, e.target.value)}
              >
                <option value="">{`Any ${def.label.toLowerCase()}`}</option>
                {optionsFor(def, available).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <p className={page.muted} aria-live="polite">
        {results.length === 1 ? '1 result' : `${results.length} results`}
        {available.length < all.length &&
          ` · ${all.length - available.length} hidden by source settings`}
      </p>
      <VirtualList
        aria-label="Results"
        items={results}
        getKey={(e) => e.id}
        renderItem={(e) => (
          <button
            type="button"
            className={styles.result}
            onClick={() =>
              sheet.open({
                key: refKey(e),
                title: e.name,
                render: () => <EntitySheet entityRef={{ kind: e.kind, id: e.id }} />,
              })
            }
          >
            <span className={styles.resultText}>
              <span className={styles.resultName}>{e.name}</span>
              <span className={styles.resultMeta}>{entityMeta(e).subtitle}</span>
            </span>
            <Badge>{e.source}</Badge>
          </button>
        )}
      />
    </>
  );
}

export function LibraryPage() {
  const sources = useSources();
  const enabled = useEnabledSources();
  const [params, setParams] = useSearchParams();
  const sheet = useSheet();

  const kindParam = params.get('kind');
  const kind: EntityKind = isLibraryKind(kindParam) ? kindParam : 'spell';
  const query = params.get('q') ?? '';
  const selected = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of params)
      if (k.startsWith(FILTER_PREFIX) && v) out[k.slice(FILTER_PREFIX.length)] = v;
    return out;
  }, [params]);

  const update = (changes: Record<string, string | null>, clearFilters = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (clearFilters)
          for (const k of [...next.keys()]) if (k.startsWith(FILTER_PREFIX)) next.delete(k);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  const importedCodes = new Set(sources?.map((s) => s.code));
  const enabledCount = enabled.filter((c) => importedCodes.has(c)).length;

  const actions = (
    <>
      <Link to="/library/import" className={styles.action}>
        Import
      </Link>
      {sources && sources.length > 0 && (
        <button
          type="button"
          className={styles.action}
          onClick={() =>
            sheet.open({ key: 'sources', title: 'Sources', render: () => <SourceToggles /> })
          }
        >
          Sources ({enabledCount})
        </button>
      )}
    </>
  );

  return (
    <>
      <TopBar title="Library" actions={actions} />
      <div className={page.content}>
        {sources === undefined ? null : sources.length === 0 ? (
          <div className={page.empty}>
            <p>No content imported yet.</p>
            <p>
              <Link to="/library/import">Import your group’s pack</Link>
            </p>
          </div>
        ) : (
          <>
            <label className={styles.search}>
              <span className="visually-hidden">Search</span>
              <input
                type="search"
                placeholder="Search"
                value={query}
                onChange={(e) => update({ q: e.target.value || null })}
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
            <div className={styles.kinds} role="tablist" aria-label="Kind">
              {LIBRARY_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  role="tab"
                  aria-selected={k.kind === kind}
                  className={styles.kind}
                  onClick={() => update({ kind: k.kind }, true)}
                >
                  {k.label}
                </button>
              ))}
            </div>
            {enabledCount === 0 ? (
              <div className={page.empty}>
                <p>All sources are switched off.</p>
              </div>
            ) : (
              <Results key={kind} kind={kind} query={query} selected={selected} />
            )}
          </>
        )}
      </div>
    </>
  );
}
