// Step 4: ability scores (plan §9.3, step 4.4; 2024 Player's Handbook, Generate Your Scores).
// The standard array assigned by tap, point buy (27 points, 8 to 15), scores typed in (3–18),
// or 4d6 dropping the lowest die, rerolled at will. The background's increases are shown
// applied (no score above 20), with the class's primary abilities marked.

import { STANDARD_ARRAY } from '../../../engine/build/build.ts';
import {
  assignFromSet,
  dropLowest,
  MANUAL_MAX,
  MANUAL_MIN,
  POINT_BUY_BUDGET,
  POINT_BUY_COST,
  POINT_BUY_MAX,
  POINT_BUY_MIN,
  pointBuyCost,
  primaryOrder,
  primaryText,
  rollScores,
  startingScores,
} from '../../../engine/build/scores.ts';
import { signed } from '../../sheet/components/format.ts';
import {
  ABILITIES,
  ABILITY_NAMES,
  type Ability,
  type Character,
  type ScoreMethod,
} from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import page from '../../../app/Page.module.css';
import inventory from '../../sheet/inventory/inventory.module.css';
import type { WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

const METHODS: { id: ScoreMethod; label: string; help: string }[] = [
  {
    id: 'standard',
    label: 'Standard array',
    help: 'Give each of 15, 14, 13, 12, 10 and 8 to one ability.',
  },
  {
    id: 'pointBuy',
    label: 'Point buy',
    help: `Spend ${POINT_BUY_BUDGET} points: every score starts at 8; 15 is the most before your background.`,
  },
  {
    id: 'rolled',
    label: 'Roll',
    help: 'Roll four d6 for each score and drop the lowest, then give each total to an ability.',
  },
  {
    id: 'manual',
    label: 'Type in',
    help: `Type the scores your DM agreed (${MANUAL_MIN}–${MANUAL_MAX}).`,
  },
];

const totals = (rolls: readonly number[][] | undefined) => (rolls ?? []).map(dropLowest);

export function AbilitiesStep(b: WizardBindings) {
  const { character, content, sheet, apply } = b;
  const cls = character.log[0]
    ? content.index.get({ kind: 'class', id: character.log[0].classRef.id })
    : undefined;
  const primary = new Set<Ability>(cls?.primaryAbility.flat() ?? []);
  const method = character.scoreMethod;
  const scores = character.baseScores;
  const rolls = character.draft?.rolls;
  const set = method === 'rolled' ? totals(rolls) : [...STANDARD_ARRAY];

  const setMethod = (m: ScoreMethod) =>
    apply((c) => {
      const next: Character = {
        ...c,
        scoreMethod: m,
        baseScores: startingScores(m, primaryOrder(cls), totals(c.draft?.rolls)),
      };
      return next;
    });

  const roll = () =>
    apply((c) => {
      const dice = rollScores();
      return {
        ...c,
        scoreMethod: 'rolled',
        draft: { step: 'abilities', ...c.draft, rolls: dice },
        baseScores: startingScores('rolled', primaryOrder(cls), totals(dice)),
      };
    });

  const setScore = (a: Ability, value: number) =>
    apply((c) => ({ ...c, baseScores: { ...c.baseScores, [a]: value } }));

  const spent = pointBuyCost(scores);
  const left = POINT_BUY_BUDGET - spent;

  const control = (a: Ability) => {
    switch (method) {
      case 'standard':
      case 'rolled':
        return (
          <select
            aria-label={`${ABILITY_NAMES[a]} score`}
            value={scores[a]}
            onChange={(e) =>
              apply((c) => ({
                ...c,
                baseScores: assignFromSet(c.baseScores, a, Number(e.target.value)),
              }))
            }
          >
            {[...new Set(set)]
              .sort((x, y) => y - x)
              .map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
          </select>
        );
      case 'pointBuy':
        return (
          <select
            aria-label={`${ABILITY_NAMES[a]} score`}
            value={scores[a]}
            onChange={(e) => setScore(a, Number(e.target.value))}
          >
            {Array.from(
              { length: POINT_BUY_MAX - POINT_BUY_MIN + 1 },
              (_, i) => POINT_BUY_MIN + i,
            ).map((v) => (
              <option
                key={v}
                value={v}
                disabled={(POINT_BUY_COST[v] ?? 0) - (POINT_BUY_COST[scores[a]] ?? 0) > left}
              >
                {v} ({POINT_BUY_COST[v]} pt)
              </option>
            ))}
          </select>
        );
      case 'manual':
        return (
          <input
            type="number"
            inputMode="numeric"
            min={MANUAL_MIN}
            max={MANUAL_MAX}
            aria-label={`${ABILITY_NAMES[a]} score`}
            value={scores[a]}
            onChange={(e) => {
              const v = Math.round(Number(e.target.value));
              if (Number.isFinite(v)) setScore(a, Math.min(30, Math.max(1, v)));
            }}
          />
        );
    }
  };

  const outOfRange =
    method === 'manual' && ABILITIES.some((a) => scores[a] < MANUAL_MIN || scores[a] > MANUAL_MAX);

  return (
    <>
      <p className={styles.intro}>
        Six scores describe your character. Each gives a modifier (score − 10, halved, rounded down)
        that you add to rolls with that ability.
        {cls && ` A ${cls.name} relies most on ${primaryText(cls)}: put your best scores there.`}
      </p>
      <div className={styles.methods} role="group" aria-label="Method">
        {METHODS.map((m) => (
          <Button
            key={m.id}
            size="sm"
            variant={method === m.id ? 'primary' : 'secondary'}
            aria-pressed={method === m.id}
            onClick={() => (m.id === 'rolled' && !rolls?.length ? roll() : setMethod(m.id))}
          >
            {m.label}
          </Button>
        ))}
      </div>
      <p className={inventory.help}>{METHODS.find((m) => m.id === method)?.help}</p>

      {method === 'rolled' && (
        <section className={page.card} aria-label="Rolls">
          {rolls?.length ? (
            <ul className={styles.dice} aria-label="Rolled scores">
              {rolls.map((dice, i) => {
                const low = dice.indexOf(Math.min(...dice));
                return (
                  <li key={i} aria-label={`Total ${dropLowest(dice)}`}>
                    {dice.map((d, j) => (
                      <span key={j} className={j === low ? styles.dropped : undefined}>
                        {d}
                        {j < dice.length - 1 ? ' ' : ''}
                      </span>
                    ))}{' '}
                    = <strong>{dropLowest(dice)}</strong>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className={page.row}>
            <Button size="sm" onClick={roll}>
              {rolls?.length ? 'Roll again' : 'Roll'}
            </Button>
          </div>
        </section>
      )}

      {method === 'pointBuy' && (
        <p aria-live="polite" className={left < 0 ? inventory.warn : undefined}>
          <strong>{left}</strong> of {POINT_BUY_BUDGET} points left
        </p>
      )}
      {outOfRange && (
        <p className={inventory.warn}>
          Scores are usually {MANUAL_MIN} to {MANUAL_MAX} at creation.
        </p>
      )}

      <table className={styles.scores} aria-label="Ability scores">
        <thead>
          <tr>
            <th>Ability</th>
            <th>Base</th>
            <th>Bonus</th>
            <th>Score</th>
            <th>Mod</th>
          </tr>
        </thead>
        <tbody>
          {ABILITIES.map((a) => {
            const final = sheet?.abilities[a].score.value ?? scores[a];
            const mod = sheet?.abilities[a].mod ?? Math.floor((final - 10) / 2);
            const bonus = final - scores[a];
            return (
              <tr key={a}>
                <th scope="row">
                  {ABILITY_NAMES[a]}
                  {primary.has(a) && (
                    <>
                      {' '}
                      <span className={styles.primary}>Primary</span>
                    </>
                  )}
                </th>
                <td>{control(a)}</td>
                <td>{bonus ? signed(bonus) : '—'}</td>
                <td className={styles.final}>{final}</td>
                <td>{signed(mod)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!character.log[0]?.origin?.backgroundRef && (
        <p className={inventory.help}>
          Your background’s increases show here once you choose it and its ability scores.
        </p>
      )}
    </>
  );
}
