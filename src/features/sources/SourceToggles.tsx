import { useEnabledSources, useSources } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import type { SourceCode } from '../../schema/index.ts';
import { groupSources, isSelectable, presetSources } from '../../sources/sourceFilter.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import styles from './SourceToggles.module.css';

function total(counts: Record<string, number | undefined>): number {
  return Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0);
}

/**
 * Switch imported sources on and off (plan §6.7): for the whole app, or with `value` and
 * `onChange` for one character.
 */
export function SourceToggles({
  value,
  onChange,
}: {
  value?: SourceCode[];
  onChange?: (codes: SourceCode[]) => void;
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
  const toggle = (code: SourceCode, value: boolean) => {
    const next = new Set(on);
    if (value) next.add(code);
    else next.delete(code);
    void save(next);
  };

  return (
    <div className={styles.root}>
      <div className={styles.presets}>
        <Button size="sm" onClick={() => void save(presetSources(sources, 'core2024'))}>
          2024 core
        </Button>
        <Button size="sm" onClick={() => void save(presetSources(sources, 'all2024'))}>
          All 2024
        </Button>
      </div>
      {groupSources(sources).map((group) => (
        <fieldset key={group.group} className={styles.group}>
          <legend className={styles.legend}>{group.title}</legend>
          {group.sources.map((s) => {
            const selectable = isSelectable(s);
            return (
              <label key={s.code} className={styles.row} data-disabled={!selectable || undefined}>
                <input
                  type="checkbox"
                  checked={selectable && on.has(s.code)}
                  disabled={!selectable}
                  onChange={(e) => toggle(s.code, e.target.checked)}
                />
                <span className={styles.name}>{s.name}</span>
                <Badge>{s.code}</Badge>
                <span className={styles.count}>
                  {selectable ? total(s.counts) : '2014 · later'}
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
