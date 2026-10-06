// The quick-builder screen (plan §9.2, step 3.10): pick classes, species and background, and
// every other pick is made automatically. Shows the derived sheet and can save the character.
// Visible in development and under Settings → Developer tools.

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useAllContent } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { quickBuild } from '../../engine/build/quickBuild.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { DerivedSheet } from '../../engine/derive/types.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { MAX_LEVEL, type Character, type Id } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { DerivedView } from './DerivedView.tsx';
import styles from './Dev.module.css';

interface ClassRow {
  /** Empty: the first class in the list. */
  classId: Id;
  /** Empty: the first subclass of the class. */
  subclassId: Id;
  levels: number;
}

export function QuickBuilder() {
  const content = useAllContent();
  const navigate = useNavigate();
  const [name, setName] = useState('Quick build');
  const [rows, setRows] = useState<ClassRow[]>([{ classId: '', subclassId: '', levels: 1 }]);
  const [speciesId, setSpeciesId] = useState('');
  const [backgroundId, setBackgroundId] = useState('');
  const [result, setResult] = useState<{ character: Character; sheet: DerivedSheet } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!content) {
    return (
      <>
        <TopBar title="Quick builder" backTo="/settings" />
        <div className={page.empty}>Loading content…</div>
      </>
    );
  }

  const { index, catalog } = content;
  const classes = catalog.of('class');
  const species = catalog.of('species');
  const backgrounds = catalog.of('background');
  if (!classes.length) {
    return (
      <>
        <TopBar title="Quick builder" backTo="/settings" />
        <div className={page.empty}>
          No classes are available. Import content or enable a source.
        </div>
      </>
    );
  }

  const classOf = (row: ClassRow) => row.classId || classes[0]!.id;
  const total = rows.reduce((n, r) => n + r.levels, 0);
  const valid = total <= MAX_LEVEL && rows.every((r) => r.levels >= 1);
  const update = (i: number, patch: Partial<ClassRow>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function build() {
    setError(null);
    try {
      const character = quickBuild(
        {
          name: name.trim() || 'Quick build',
          classes: rows.map((r) => ({
            classId: classOf(r),
            levels: r.levels,
            ...(r.subclassId ? { subclassId: r.subclassId } : {}),
          })),
          speciesId: speciesId || species[0]?.id,
          backgroundId: backgroundId || backgrounds[0]?.id,
        },
        { index, catalog, registry: featureEffects() },
      );
      setResult({ character, sheet: derive(character, index, { registry: featureEffects() }) });
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function save() {
    if (!result) return;
    const saved = await repos().characters.save(result.character);
    navigate(`/c/${saved.id}/main`);
  }

  return (
    <>
      <TopBar title="Quick builder" backTo="/settings" />
      <div className={page.content}>
        <section className={page.card}>
          <p className={page.muted}>
            Builds a character with automatic picks, the standard array and average hit points. For
            trying the engine on real content.
          </p>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              build();
            }}
          >
            <label className={styles.field}>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            {rows.map((row, i) => {
              const classId = classOf(row);
              const subclasses = catalog.of('subclass').filter((s) => s.classId === classId);
              return (
                <div key={i} className={styles.classRow}>
                  <label className={styles.field}>
                    Class {rows.length > 1 ? i + 1 : ''}
                    <select
                      value={classId}
                      onChange={(e) => update(i, { classId: e.target.value, subclassId: '' })}
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.source})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Subclass
                    <select
                      value={row.subclassId}
                      onChange={(e) => update(i, { subclassId: e.target.value })}
                    >
                      <option value="">Automatic</option>
                      {subclasses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.source})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    Levels
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_LEVEL}
                      value={row.levels || ''}
                      onChange={(e) =>
                        update(i, {
                          levels: Math.min(
                            MAX_LEVEL,
                            Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                  {rows.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove class ${i + 1}`}
                      onClick={() => setRows(rows.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              );
            })}
            <div className={page.row}>
              <Button
                size="sm"
                onClick={() => setRows([...rows, { classId: '', subclassId: '', levels: 1 }])}
              >
                Add a class
              </Button>
              <span className={page.muted}>Total level {total}</span>
            </div>
            <label className={styles.field}>
              Species
              <select value={speciesId} onChange={(e) => setSpeciesId(e.target.value)}>
                {species.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.source})
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Background
              <select value={backgroundId} onChange={(e) => setBackgroundId(e.target.value)}>
                {backgrounds.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.source})
                  </option>
                ))}
              </select>
            </label>
            {total > MAX_LEVEL && (
              <p className={styles.error}>The total level can be at most {MAX_LEVEL}.</p>
            )}
            <div className={page.row}>
              <Button type="submit" variant="primary" disabled={!valid}>
                Build
              </Button>
              {result && <Button onClick={() => void save()}>Save to characters</Button>}
            </div>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
          </form>
        </section>
        {result && <DerivedView sheet={result.sheet} index={index} />}
      </div>
    </>
  );
}
