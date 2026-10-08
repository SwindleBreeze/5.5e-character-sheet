// Higher levels (plan §9.4, step 5.4): for a character that starts above level 1, one card per
// level, as if levelled up: its class (multiclassing allowed, its requirement shown), hit points,
// subclass when due, and its picks. Each level is made automatically first; anything can be
// changed, and "Fill the rest automatically" makes whatever is still open.

import { setSubclass } from '../../../engine/build/build.ts';
import {
  changeLevelClass,
  fillHigherLevels,
  multiclassCheck,
  setLevelHp,
} from '../../../engine/build/levelUp.ts';
import { featureEffects } from '../../../engine/featureEffects/index.ts';
import { setPick } from '../../../engine/play/features.ts';
import { decodeChoiceKey, refKey } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import page from '../../../app/Page.module.css';
import choices from '../../choices/choices.module.css';
import { FeatureChoices } from '../../choices/FeatureChoices.tsx';
import { Glance } from '../../sheet/features/Glance.tsx';
import { glanceResources } from '../../sheet/features/glanceResources.ts';
import { RollInput } from '../../levelup/steps.tsx';
import inventory from '../../sheet/inventory/inventory.module.css';
import { choiceContext, type WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

export function LevelsStep(b: WizardBindings) {
  const { character, content, sheet, apply, todos } = b;
  if (!sheet) return null;
  const deps = { index: content.index, catalog: content.catalog, registry: featureEffects() };
  const ctx = choiceContext(b, sheet);
  const classes = content.catalog.of('class');
  const all = sheet.features;
  const underPick = (f: (typeof all)[number]) => {
    if (!f.pickedIn) return false;
    const by = all.find((x) => refKey(x.ref) === refKey(f.pickedIn!.ref));
    return !!by?.choices.some((c) => c.values.includes(f.ref.id));
  };
  const open = todos.some((t) => t.step === 'levels');

  return (
    <>
      <p className={choices.help}>
        Every level above 1 is filled in for you: the class, the fixed hit points and the choices.
        Open a level to change any of it.
      </p>
      {open && (
        <div className={inventory.actions}>
          <Button onClick={() => apply((c) => fillHigherLevels(c, deps))}>
            Fill the rest automatically
          </Button>
        </div>
      )}
      <ol className={styles.levelCards} aria-label="Levels">
        {character.log.slice(1).map((entry, k) => {
          const i = k + 1;
          const cls = content.index.get({ kind: 'class', id: entry.classRef.id });
          const isNew = !character.log.slice(0, i).some((e) => e.classRef.id === entry.classRef.id);
          const prereq = isNew && cls ? multiclassCheck(cls, sheet, content.index) : undefined;
          const subclassDue = !!cls && entry.classLevel === cls.subclassLevel;
          const subclasses = subclassDue
            ? content.catalog.of('subclass').filter((s) => s.classId === cls.id)
            : [];
          const gained = all.filter(
            (f) =>
              f.entryIndex === i &&
              (f.ref.kind === 'classFeature' || f.ref.kind === 'subclassFeature') &&
              f.level === entry.classLevel,
          );
          const only = (c: { entryIndex: number }) => c.entryIndex === i;
          const withPicks = all.filter((f) => !underPick(f) && f.choices.some(only));
          const left = withPicks.some((f) =>
            f.choices.some((c) => only(c) && c.values.length < c.count),
          );
          const die = cls?.hitDie ?? 8;
          const fixed = Math.floor(die / 2) + 1;
          return (
            <li key={i} className={page.card} aria-label={`Level ${entry.charLevel}`}>
              <details open={left}>
                <summary className={styles.levelSummary}>
                  <strong>Level {entry.charLevel}</strong> · {cls?.name ?? entry.classRef.id}{' '}
                  {entry.classLevel}
                  {left && <span className={styles.levelTodo}>choices left</span>}
                  {gained.length > 0 && (
                    <span className={styles.levelGains}>
                      {gained.map((f) => f.name).join(', ')}
                    </span>
                  )}
                </summary>
                <div className={styles.levelBody}>
                  {gained.length > 0 && (
                    <ul className={styles.levelFeatures} aria-label="New features">
                      {gained.map((f) => (
                        <li key={refKey(f.ref)}>
                          <strong>{f.name}</strong>
                          <Glance
                            entries={content.index.get(f.ref)?.entries ?? []}
                            resources={glanceResources(f, sheet)}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className={styles.menu}>
                    <span className={inventory.fieldLabel}>Class</span>
                    <select
                      value={entry.classRef.id}
                      onChange={(e) =>
                        apply((c) =>
                          changeLevelClass(c, i, { kind: 'class', id: e.target.value }, deps),
                        )
                      }
                    >
                      {classes.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {prereq && !prereq.met && (
                    <p className={styles.notice}>
                      Multiclassing asks for {prereq.unmet.join('; ')}. Your DM may allow it anyway.
                    </p>
                  )}
                  <div className={styles.levelHp}>
                    <label className={styles.menu}>
                      <span className={inventory.fieldLabel}>Hit points (d{die})</span>
                      <select
                        value={entry.hp.mode === 'roll' ? 'roll' : 'avg'}
                        onChange={(e) =>
                          apply((c) =>
                            setLevelHp(
                              c,
                              e.target.value === 'roll'
                                ? { mode: 'roll', value: fixed }
                                : { mode: 'avg' },
                              i,
                            ),
                          )
                        }
                      >
                        <option value="avg">Fixed: {fixed}</option>
                        <option value="roll">Rolled</option>
                      </select>
                    </label>
                    {entry.hp.mode === 'roll' && (
                      <RollInput
                        die={die}
                        value={entry.hp.value}
                        onValue={(v) => apply((c) => setLevelHp(c, { mode: 'roll', value: v }, i))}
                      />
                    )}
                  </div>
                  {subclassDue && cls && (
                    <label className={styles.menu}>
                      <span className={inventory.fieldLabel}>{cls.subclassTitle}</span>
                      <select
                        value={entry.subclassRef?.id ?? ''}
                        data-missing={!entry.subclassRef}
                        onChange={(e) =>
                          apply((c) =>
                            setSubclass(c, cls, { kind: 'subclass', id: e.target.value }),
                          )
                        }
                      >
                        <option value="" disabled>
                          Choose…
                        </option>
                        {subclasses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {withPicks.length > 0 && (
                    <FeatureChoices
                      features={withPicks}
                      ctx={ctx}
                      only={only}
                      named
                      onPick={(c, _f, pick) =>
                        apply((ch) =>
                          setPick(ch, decodeChoiceKey(c.key), {
                            ...pick,
                            entryIndex: c.entryIndex,
                            via: 'levelUp',
                          }),
                        )
                      }
                    />
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}
