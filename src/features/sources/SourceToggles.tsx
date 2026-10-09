import { useEnabledSources, useSources } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import type { SourceCode } from '../../schema/index.ts';
import {
  groupSources,
  isHomebrew,
  isSelectable,
  presetSources,
  type Preset,
} from '../../sources/sourceFilter.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { HomebrewActions, HomebrewMeta } from './HomebrewActions.tsx';
import styles from './SourceToggles.module.css';

function total(counts: Record<string, number | undefined>): number {
  return Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);
}

/**
 * Switch imported sources on and off (plan §6.7): for the whole app, or with `value` and
 * `onChange` for one character. With `manage` (Settings), homebrew can also be removed and
 * shared (plan step 7.3).
 */
export function SourceToggles({
  value,
  onChange,
  manage = false,
}: {
  value?: SourceCode[];
  onChange?: (codes: SourceCode[]) => void;
  /** Settings: homebrew can be removed and shared from here. */
  manage?: boolean;
} = {}) {
  const sources = useSources();
  const global = useEnabledSources();
  const enabled = value ?? global;

  if (sources === undefined) return null;
  if (sources.length === 0) {
    return <p className={styles.muted}>No content imported yet.</p>;
  }

  const on = new Set(enabled);
  const save = async (codes: Iterable<SourceCode>) => {
    const list = [...new Set(codes)].sort();
    if (onChange) onChange(list);
    else await repos().settings.set('enabledSources', list);
  };
  // Presets are about the books: homebrew that is on stays on.
  const preset = (p: Preset) =>
    void save([
      ...presetSources(sources, p),
      ...sources.filter((s) => isHomebrew(s) && on.has(s.code)).map((s) => s.code),
    ]);
  const toggle = (code: SourceCode, value: boolean) => {
    const next = new Set(on);
    if (value) next.add(code);
    else next.delete(code);
    void save(next);
  };

  return (
    <div className={styles.root}>
      <div className={styles.presets}>
        <Button size="sm" onClick={() => preset('core2024')}>
          2024 core
        </Button>
        <Button size="sm" onClick={() => preset('all2024')}>
          All 2024
        </Button>
      </div>
      {groupSources(sources).map((group) => (
        <fieldset key={group.group} className={styles.group}>
          <legend className={styles.legend}>{group.title}</legend>
          {group.sources.map((s) => {
            const selectable = isSelectable(s);
            const row = (
              <label key={s.code} className={styles.row} data-disabled={!selectable || undefined}>
                <input
                  type="checkbox"
                  checked={selectable && on.has(s.code)}
                  disabled={!selectable}
                  onChange={(e) => toggle(s.code, e.target.checked)}
                />
                <span className={styles.name}>{s.name}</span>
                <Badge>{s.homebrew?.abbreviation ?? s.code}</Badge>
                <span className={styles.count}>
                  {selectable ? total(s.counts) : '2014 · later'}
                </span>
              </label>
            );
            if (!isHomebrew(s)) return row;
            return (
              <div key={s.code} className={styles.brew}>
                {row}
                <HomebrewMeta source={s} manage={manage} />
              </div>
            );
          })}
          {group.group === 'homebrew' && manage && <HomebrewActions sources={group.sources} />}
        </fieldset>
      ))}
    </div>
  );
}
