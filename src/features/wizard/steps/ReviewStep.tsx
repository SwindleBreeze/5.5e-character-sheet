// The last step: review (plan §9.3 step 4.4, §9.3b step 4B.5): the character at a glance, what it
// starts with, what is still to choose (each with a link to its step), and rule warnings. Create
// finishes it and opens the sheet; it stays closed while a required pick is left.

import { STEP_TITLES } from '../../../engine/build/wizard.ts';
import { signed, skillName, titleCase } from '../../sheet/components/format.ts';
import { nameOf } from '../../sheet/sheetBindings.ts';
import { ABILITIES, ABILITY_NAMES, SKILLS } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import page from '../../../app/Page.module.css';
import inventory from '../../sheet/inventory/inventory.module.css';
import type { WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

const SLOT_WORDS: Record<string, string> = {
  armor: 'worn',
  shield: 'shield',
  mainHand: 'in hand',
  offHand: 'in off hand',
  bothHands: 'in both hands',
  worn: 'worn',
};

export interface ReviewProps extends WizardBindings {
  onCreate: () => void;
  creating: boolean;
}

export function ReviewStep({ onCreate, creating, ...b }: ReviewProps) {
  const { character, content, sheet, go, todos } = b;
  const index = content.index;
  const first = character.log[0];
  if (!first || !sheet) {
    return (
      <p className={inventory.warn}>
        Choose a class first.{' '}
        <Button size="sm" onClick={() => go('class')}>
          Go to Class
        </Button>
      </p>
    );
  }

  const purse = (['pp', 'gp', 'ep', 'sp', 'cp'] as const)
    .filter((k) => character.currency[k] > 0)
    .map((k) => `${character.currency[k]} ${k.toUpperCase()}`)
    .join(', ');
  const warnings = sheet.issues.filter((i) => i.severity === 'warn');

  const proficient = SKILLS.filter(
    (s) => sheet.skills[s].proficiency !== 'none' && sheet.skills[s].proficiency !== 'half',
  );
  const species = first.origin?.speciesRef && nameOf(index, 'species', first.origin.speciesRef.id);
  const background =
    first.origin?.backgroundRef && nameOf(index, 'background', first.origin.backgroundRef.id);
  const spells = [
    ...new Set(
      sheet.spellcasting.casters.flatMap((c) => [
        ...c.cantrips,
        ...c.prepared,
        ...(c.spellbook ?? []),
      ]),
    ),
    ...sheet.spellcasting.granted.map((g) => g.spellId),
  ];

  return (
    <>
      <section className={page.card} aria-label="Summary">
        <h2 className={page.cardTitle}>{character.name || 'New character'}</h2>
        <p>
          Level 1 {sheet.classes.map((c) => c.name).join(' / ')}
          {species ? ` · ${species}` : ''}
          {background ? ` · ${background}` : ''}
        </p>
        <dl className={styles.statRow} aria-label="Ability scores">
          {ABILITIES.map((a) => (
            <div key={a} className={styles.stat}>
              <dt>{ABILITY_NAMES[a]}</dt>
              <dd>
                {sheet.abilities[a].score.value}{' '}
                <span className={inventory.muted}>({signed(sheet.abilities[a].mod)})</span>
              </dd>
            </div>
          ))}
        </dl>
        <dl className={styles.statRow} aria-label="Combat">
          <div className={styles.stat}>
            <dt>Hit points</dt>
            <dd>{sheet.hp.max.value}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Armor Class</dt>
            <dd>{sheet.ac.value}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Initiative</dt>
            <dd>{signed(sheet.initiative.bonus.value)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Speed</dt>
            <dd>{sheet.speed.walk?.value ?? 0} ft.</dd>
          </div>
          <div className={styles.stat}>
            <dt>Proficiency</dt>
            <dd>{signed(sheet.pb.value)}</dd>
          </div>
        </dl>
        <dl className={styles.facts}>
          <dt>Saving throws</dt>
          <dd>
            {ABILITIES.filter((a) => sheet.saves[a].proficiency !== 'none')
              .map((a) => ABILITY_NAMES[a])
              .join(', ') || 'None'}
          </dd>
          <dt>Skills</dt>
          <dd>
            {proficient
              .map(
                (s) =>
                  `${skillName(s)}${sheet.skills[s].proficiency === 'expertise' ? ' (Expertise)' : ''}`,
              )
              .join(', ') || 'None'}
          </dd>
          <dt>Languages</dt>
          <dd>
            {sheet.proficiencies.languages.map((l) => titleCase(l.value)).join(', ') || 'None'}
          </dd>
          <dt>Tools</dt>
          <dd>
            {[
              ...new Set(
                sheet.proficiencies.tools.map((t) =>
                  t.value.includes('|') ? nameOf(index, 'item', t.value) : titleCase(t.value),
                ),
              ),
            ].join(', ') || 'None'}
          </dd>
          <dt>Weapon Mastery</dt>
          <dd>{sheet.masteries.map((m) => nameOf(index, 'item', m.value)).join(', ') || 'None'}</dd>
          {spells.length > 0 && (
            <>
              <dt>Spells</dt>
              <dd>{spells.map((id) => nameOf(index, 'spell', id)).join(', ')}</dd>
            </>
          )}
        </dl>
      </section>

      <section className={page.card} aria-label="What you start with">
        <h2 className={page.cardTitle}>What you start with</h2>
        {character.inventory.length ? (
          <ul aria-label="Starting items" className={styles.items}>
            {character.inventory.map((r) => (
              <li key={r.uid}>
                {r.quantity > 1 ? `${r.quantity} × ` : ''}
                {r.name}
                {r.equipped ? (
                  <span className={inventory.muted}> ({SLOT_WORDS[r.equipped]})</span>
                ) : (
                  ''
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className={inventory.muted}>No items yet.</p>
        )}
        <p>
          Coins: <strong>{purse || 'none'}</strong>
        </p>
      </section>

      {todos.length > 0 && (
        <section aria-label="Still to choose">
          <h2 className={page.cardTitle}>Still to choose</h2>
          <ul className={styles.todo}>
            {todos.map((t, i) => (
              <li key={i}>
                <span>{t.text}</span>
                <Button size="sm" onClick={() => go(t.step)}>
                  {STEP_TITLES[t.step]}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section aria-label="Rules">
          <h2 className={page.cardTitle}>Rules</h2>
          <ul className={inventory.issues}>
            {warnings.map((w) => (
              <li key={`${w.code}:${w.message}`}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}
      <p className={styles.lead}>
        {todos.length
          ? 'Make these choices first; then you can create the character.'
          : 'Everything is chosen.'}
      </p>
      <div className={page.row}>
        <Button
          variant="primary"
          onClick={() => !todos.length && !creating && onCreate()}
          aria-disabled={creating || todos.length > 0}
        >
          Create character
        </Button>
      </div>
    </>
  );
}
