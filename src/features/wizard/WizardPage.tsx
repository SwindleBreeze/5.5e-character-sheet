// The creation wizard (plan §9.3, step 4.4) at `#/new/:draftId/:step`. The draft is a real
// Character with `draft` set, saved on every change, so it can be left and continued from the
// characters list. `#/new/draft/class` starts a new one.
//
// Steps: Class → Background → Species → Ability scores → Equipment → Spells (only when something
// gives spells) → Other choices → Details → Review. Changing the class, background or species
// lists the picks that would be removed and removes them only on confirm.

import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import page from '../../app/Page.module.css';
import { TopBar } from '../../app/TopBar.tsx';
import { useAllContent } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { syncStartingEquipment } from '../../engine/build/equipment.ts';
import {
  dropPicks,
  finishDraft,
  isWizardStep,
  newDraft,
  previewChange,
  setStep,
  STEP_TITLES,
  wizardSteps,
  type DroppedPick,
  type WizardStep,
} from '../../engine/build/wizard.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import type { Character } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { DescriptionTab } from '../sheet/DescriptionTab.tsx';
import inventory from '../sheet/inventory/inventory.module.css';
import { useCharacterActions, type CharacterUpdate } from '../sheet/useCharacterActions.ts';
import { stepOf, type WizardBindings } from './bindings.ts';
import { AbilitiesStep } from './steps/AbilitiesStep.tsx';
import { BackgroundStep } from './steps/BackgroundStep.tsx';
import { ChoicesStep } from './steps/ChoicesStep.tsx';
import { ClassStep } from './steps/ClassStep.tsx';
import { EquipmentStep } from './steps/EquipmentStep.tsx';
import { ReviewStep } from './steps/ReviewStep.tsx';
import { SpeciesStep } from './steps/SpeciesStep.tsx';
import { SpellsStep } from './steps/SpellsStep.tsx';
import styles from './wizard.module.css';

const TITLE = 'New character';

/** `#/new/draft/…`: make a draft and go to it. */
function StartDraft() {
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void repos()
      .characters.save(newDraft())
      .then((c) => navigate(`/new/${c.id}/class`, { replace: true }));
  }, [navigate]);
  return (
    <>
      <TopBar title={TITLE} backTo="/" />
      <div className={page.empty}>Starting…</div>
    </>
  );
}

function DroppedList({
  dropped,
  onConfirm,
  onCancel,
}: {
  dropped: DroppedPick[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={inventory.form}>
      <p>
        These picks will be removed, since what offered them is no longer part of the character:
      </p>
      <ul aria-label="Picks to remove">
        {dropped.map((d) => (
          <li key={d.key}>
            {d.owner}: {d.labels.join(', ') || 'nothing picked'}
          </li>
        ))}
      </ul>
      <p className={inventory.muted}>Picks that still fit are kept.</p>
      <div className={inventory.actions}>
        <Button variant="danger" onClick={onConfirm}>
          Change and remove them
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Keep things as they are
        </Button>
      </div>
    </div>
  );
}

export function WizardPage() {
  const { draftId = '' } = useParams();
  if (draftId === 'draft') return <StartDraft />;
  return <Wizard id={draftId} />;
}

function Wizard({ id }: { id: string }) {
  const { step: param = 'class' } = useParams();
  const navigate = useNavigate();
  const ui = useSheet();
  // null = not found; undefined = still loading.
  const stored = useLiveQuery(async () => (await repos().characters.get(id)) ?? null, [id]);
  const actions = useCharacterActions(stored ?? undefined);
  const character = actions.character;
  const content = useAllContent(character?.enabledSources);
  const registry = featureEffects();
  const sheet = useMemo(
    () =>
      character && content && character.log.length
        ? derive(character, content.index, { registry })
        : undefined,
    [character, content, registry],
  );
  const [creating, setCreating] = useState(false);

  const index = content?.index;
  const rawApply = actions.apply;
  const apply = useCallback(
    (update: CharacterUpdate) =>
      rawApply((c) => (index ? syncStartingEquipment(update(c), index) : update(c))),
    [rawApply, index],
  );

  const steps = wizardSteps(sheet);
  const step: WizardStep =
    isWizardStep(param) && steps.includes(param) ? param : (steps[0] ?? 'class');

  // Remember the step, so "Continue" comes back to it.
  useEffect(() => {
    if (character?.draft && character.draft.step !== step) rawApply((c) => setStep(c, step));
  }, [character?.draft, step, rawApply]);

  if (stored === undefined || (stored && !content)) {
    return (
      <>
        <TopBar title={TITLE} backTo="/" />
        <div className={page.empty}>Loading…</div>
      </>
    );
  }
  if (stored === null || !character || !content) {
    return (
      <>
        <TopBar title="Not found" backTo="/" />
        <div className={page.empty}>This draft doesn’t exist on this device.</div>
      </>
    );
  }
  if (!character.draft && !creating) return <Navigate to={`/c/${character.id}/main`} replace />;
  if (param !== step) return <Navigate to={`/new/${id}/${step}`} replace />;

  const go = (next: WizardStep) => {
    navigate(`/new/${id}/${next}`);
    window.scrollTo(0, 0);
  };

  const change = (update: CharacterUpdate) => {
    const { dropped } = previewChange(character, update, content.index, registry);
    if (!dropped.length) {
      apply(update);
      return;
    }
    const keys = dropped.map((d) => d.key);
    ui.open({
      key: 'wizard:drop',
      title: 'Remove picks?',
      render: () => (
        <DroppedList
          dropped={dropped}
          onCancel={ui.close}
          onConfirm={() => {
            ui.close();
            apply((c) => dropPicks(update(c), keys));
          }}
        />
      ),
    });
  };

  const create = async () => {
    if (creating || !character.log.length) return;
    setCreating(true);
    rawApply((c: Character) => finishDraft(c, content.index, registry));
    await actions.flush();
    navigate(`/c/${id}/main`, { replace: true });
  };

  const b: WizardBindings = { character, sheet, content, apply, change, go };
  const at = steps.indexOf(step);
  const prev = steps[at - 1];
  const next = steps[at + 1];
  const needsClass = step !== 'class' && !character.log.length;
  // Steps with picks still to make, marked in the step list.
  const todo = new Set<WizardStep>(
    sheet ? sheet.choices.pending.map((p) => stepOf(p.offer, sheet)) : [],
  );

  const body = (() => {
    if (needsClass) {
      return (
        <p className={inventory.warn}>
          Choose a class first.{' '}
          <Button size="sm" onClick={() => go('class')}>
            Go to Class
          </Button>
        </p>
      );
    }
    switch (step) {
      case 'class':
        return <ClassStep {...b} />;
      case 'background':
        return <BackgroundStep {...b} />;
      case 'species':
        return <SpeciesStep {...b} />;
      case 'abilities':
        return <AbilitiesStep {...b} />;
      case 'equipment':
        return <EquipmentStep {...b} />;
      case 'spells':
        return <SpellsStep {...b} />;
      case 'choices':
        return <ChoicesStep {...b} />;
      case 'details':
        return sheet ? (
          <DescriptionTab character={character} sheet={sheet} index={content.index} apply={apply} />
        ) : null;
      case 'review':
        return <ReviewStep {...b} onCreate={() => void create()} creating={creating} />;
    }
  })();

  return (
    <div className={styles.page}>
      <TopBar title={TITLE} backTo="/" />
      <ol className={styles.steps} aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s}>
            <a
              href={`#/new/${id}/${s}`}
              aria-current={s === step ? 'step' : undefined}
              ref={
                s === step
                  ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
                  : undefined
              }
              data-todo={todo.has(s)}
              onClick={(e) => {
                e.preventDefault();
                go(s);
              }}
            >
              {i + 1}. {STEP_TITLES[s]}
            </a>
          </li>
        ))}
      </ol>
      <div className={`${page.content} ${styles.body}`}>
        <h2 className={page.cardTitle}>{STEP_TITLES[step]}</h2>
        {body}
      </div>
      <nav className={styles.footer} aria-label="Wizard">
        {prev ? <Button onClick={() => go(prev)}>‹ {STEP_TITLES[prev]}</Button> : <span />}
        {next && (
          <Button
            variant="primary"
            aria-disabled={!character.log.length}
            onClick={() => {
              if (character.log.length) go(next);
            }}
          >
            {STEP_TITLES[next]} ›
          </Button>
        )}
      </nav>
    </div>
  );
}
