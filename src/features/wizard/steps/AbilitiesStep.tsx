// Step 4: ability scores (plan §9.3 step 4.4, §9.3b step 4B.5; 2024 Player's Handbook, Generate
// Your Scores). The standard array assigned by tap, point buy with − and + (27 points, 8 to 15),
// scores typed in (3–18), or 4d6 dropping the lowest die, each roll its own tile. The
// background's increases are shown applied (no score above 20), primary abilities marked.

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
import { ABILITIES, ABILITY_NAMES, type Ability, type ScoreMethod } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import { StepButton } from '../../../ui/Counter.tsx';
import choices from '../../choices/choices.module.css';
import { signed } from '../../sheet/components/format.ts';
import type { WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

const METHODS: { id: ScoreMethod; label: string; help: string }[] = [
  {
    id: 'standard',
    label: 'Standard array',
    help: 'Give each of 15, 14, 13, 12, 10 and 8 to one ability. Picking a number another ability has swaps them.',
  },
  {
    id: 'pointBuy',
    label: 'Point buy',
    help: `Every score starts at 8. Spend ${POINT_BUY_BUDGET} points to raise them, up to 15; the higher a score, the more each point costs.`,
  },
  {
    id: 'rolled',
    label: 'Roll',
    help: 'Roll four six-sided dice for each score and add the highest three. Then give each total to an ability.',
  },
  {
    id: 'manual',
    label: 'Type in',
    help: `Type the scores your DM agreed to (${MANUAL_MIN}–${MANUAL_MAX}).`,
  },
];

const totals = (rolls: readonly number[][] | undefined) => (rolls ?? []).map(dropLowest);

/** Which ability each rolled total went to (equal totals go in order). */
function rollOwners(
  scores: Record<Ability, number>,
  rolled: readonly number[],
): (Ability | undefined)[] {
  const used = new Set<Ability>();
  return rolled.map((total) => {
    const a = ABILITIES.find((x) => !used.has(x) && scores[x] === total);
    if (a) used.add(a);
    return a;
  });
}

export function AbilitiesStep(b: WizardBindings) {
  const { character, content, sheet, apply } = b;
  const cls = character.log[0]
    ? content.index.get({ kind: 'class', id: character.log[0].classRef.id })
    : undefined;
  const primary = new Set<Ability>(cls?.primaryAbility.flat() ?? []);
  const method = character.scoreMethod;
  const scores = character.baseScores;
  const rolls = character.draft?.rolls;
  const rolled = totals(rolls);
  const set = method === 'rolled' ? rolled : [...STANDARD_ARRAY];

  const setMethod = (m: ScoreMethod) =>
    apply((c) => ({
      ...c,
      scoreMethod: m,
      baseScores: startingScores(m, primaryOrder(cls), totals(c.draft?.rolls)),
    }));

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

  const left = POINT_BUY_BUDGET - pointBuyCost(scores);
  const nextCost = (v: number) => (POINT_BUY_COST[v + 1] ?? Infinity) - (POINT_BUY_COST[v] ?? 0);

  const control = (a: Ability) => {
    const name = `${ABILITY_NAMES[a]} score`;
    switch (method) {
      case 'standard':
      case 'rolled':
        return (
          <select
            aria-label={name}
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
          <div className={styles.stepper} role="group" aria-label={name}>
            <StepButton
              label={`Decrease ${name}`}
              symbol="−"
              blocked={scores[a] <= POINT_BUY_MIN}
              onStep={() => setScore(a, scores[a] - 1)}
            />
            <output className={styles.stepperValue} aria-live="polite">
              {scores[a]}
            </output>
            <StepButton
              label={`Increase ${name}`}
              symbol="+"
              blocked={scores[a] >= POINT_BUY_MAX || nextCost(scores[a]) > left}
              onStep={() => setScore(a, scores[a] + 1)}
            />
          </div>
        );
      case 'manual':
        return (
          <input
            type="number"
            inputMode="numeric"
            min={MANUAL_MIN}
            max={MANUAL_MAX}
            aria-label={name}
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
  const owners = method === 'rolled' ? rollOwners(scores, rolled) : [];

  return (
    <>
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
      <p className={choices.help}>
        {METHODS.find((m) => m.id === method)?.help}
        {cls && ` A ${cls.name} relies most on ${primaryText(cls)}: put your best scores there.`}
      </p>

      {method === 'rolled' && (
        <section aria-label="Rolls" className={styles.rollArea}>
          <ul className={styles.rolls} aria-label="Rolled scores">
            {(rolls ?? []).map((dice, i) => {
              const low = dice.indexOf(Math.min(...dice));
              const owner = owners[i];
              return (
                <li key={i} className={styles.roll} aria-label={`Total ${dropLowest(dice)}`}>
                  <span className={styles.rollTotal}>{dropLowest(dice)}</span>
                  <span className={styles.rollDice} aria-hidden="true">
                    {dice.map((d, j) => (
                      <span key={j} className={j === low ? styles.dropped : styles.die}>
                        {d}
                      </span>
                    ))}
                  </span>
                  <span className={styles.rollFor}>{owner ? ABILITY_NAMES[owner] : '—'}</span>
                </li>
              );
            })}
          </ul>
          <Button size="sm" onClick={roll}>
            {rolls?.length ? 'Roll again' : 'Roll'}
          </Button>
        </section>
      )}

      {method === 'pointBuy' && (
        <div className={styles.points} aria-live="polite" data-over={left < 0}>
          <strong>{left}</strong> of {POINT_BUY_BUDGET} points left
        </div>
      )}
      {outOfRange && (
        <p className={styles.notice}>
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
                  {primary.has(a) && <span className={styles.primary}>Primary</span>}
                </th>
                <td>{control(a)}</td>
                <td>{bonus ? signed(bonus) : '—'}</td>
                <td className={styles.final}>{final}</td>
                <td className={styles.mod}>{signed(mod)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={choices.help}>
        <strong>Bonus</strong> is your background’s increases. <strong>Mod</strong> is what you add
        to rolls with that ability: 10–11 is +0, every 2 points more is +1, every 2 less is −1.
      </p>
    </>
  );
}
