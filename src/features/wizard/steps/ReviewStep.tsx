// Step 9: review (plan §9.3, step 4.4): the character at a glance, what is still to choose (each
// with a link to its step), and rule warnings. Create finishes it and opens the sheet. Rules
// guide, never block: a character with picks left can be created and finished on the sheet.

import { unpickedAnyItems } from '../../../engine/build/equipment.ts';
import { STEP_TITLES } from '../../../engine/build/wizard.ts';
import { choiceTitle } from '../../choices/labels.ts';
import { signed, skillName, titleCase } from '../../sheet/components/format.ts';
import { nameOf } from '../../sheet/sheetBindings.ts';
import { ABILITIES, ABILITY_NAMES, SKILLS, refKey } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import page from '../../../app/Page.module.css';
import inventory from '../../sheet/inventory/inventory.module.css';
import { stepOf, type WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

export interface ReviewProps extends WizardBindings {
  onCreate: () => void;
  creating: boolean;
}

export function ReviewStep({ onCreate, creating, ...b }: ReviewProps) {
  const { character, content, sheet, go } = b;
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

  const todo: { text: string; step: keyof typeof STEP_TITLES }[] = [];
  if (!first.origin?.backgroundRef) todo.push({ text: 'Choose a background.', step: 'background' });
  if (!first.origin?.speciesRef) todo.push({ text: 'Choose a species.', step: 'species' });
  for (const p of sheet.choices.pending) {
    const owner = sheet.features.find((f) => refKey(f.ref) === refKey(p.offer.source.ref));
    const choice = owner?.choices.find((c) => c.offer === p.offer);
    const what =
      p.offer.kind === 'equipment'
        ? 'starting equipment'
        : choice
          ? choiceTitle(choice)
          : 'a choice';
    const left = p.count - p.have;
    todo.push({
      text: `${p.offer.source.name}: ${what}${p.offer.kind === 'equipment' ? '' : ` (${left} to pick)`}`,
      step: stepOf(p.offer, sheet),
    });
  }
  for (const item of unpickedAnyItems(character, index))
    todo.push({ text: `${item}: choose which`, step: 'equipment' });
  for (const caster of sheet.spellcasting.casters) {
    if (caster.preparedChange === 'restLong' && caster.prepared.length < caster.preparedMax)
      todo.push({
        text: `${caster.name}: ${caster.preparedMax - caster.prepared.length} more spells to prepare`,
        step: 'spells',
      });
  }
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
          <dt>Equipment</dt>
          <dd>
            {character.inventory
              .map((r) => (r.quantity > 1 ? `${r.quantity} × ${r.name}` : r.name))
              .join(', ') || 'None'}
          </dd>
          {spells.length > 0 && (
            <>
              <dt>Spells</dt>
              <dd>{spells.map((id) => nameOf(index, 'spell', id)).join(', ')}</dd>
            </>
          )}
        </dl>
      </section>

      {todo.length > 0 && (
        <section aria-label="Still to choose">
          <h2 className={page.cardTitle}>Still to choose</h2>
          <ul className={styles.todo}>
            {todo.map((t, i) => (
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
      <p className={styles.intro}>
        {todo.length
          ? 'You can create the character now and finish these on its sheet: they show under “Needs attention”.'
          : 'Everything is chosen.'}
      </p>
      <div className={page.row}>
        <Button variant="primary" onClick={onCreate} aria-disabled={creating}>
          Create character
        </Button>
      </div>
    </>
  );
}
