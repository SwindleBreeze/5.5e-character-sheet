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
  changeDraft,
  finishDraft,
  isWizardStep,
  newDraft,
  setStep,
  STEP_TITLES,
  wizardSteps,
  type WizardStep,
} from '../../engine/build/wizard.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import type { Character } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { DescriptionTab } from '../sheet/DescriptionTab.tsx';
import { useCharacterActions, type CharacterUpdate } from '../sheet/useCharacterActions.ts';
import type { WizardBindings } from './bindings.ts';
import { STEP_INTROS } from './guide.ts';
import { picksOnStep, wizardTodos } from './progress.ts';
import { AbilitiesStep } from './steps/AbilitiesStep.tsx';
import { BackgroundStep } from './steps/BackgroundStep.tsx';
import { ChoicesStep } from './steps/ChoicesStep.tsx';
import { ClassStep } from './steps/ClassStep.tsx';
import { LevelsStep } from './steps/LevelsStep.tsx';
import { ReviewStep } from './steps/ReviewStep.tsx';
import { SpeciesStep } from './steps/SpeciesStep.tsx';
import { SpellsStep } from './steps/SpellsStep.tsx';
import { useStepFocus } from './useStepFocus.ts';
import styles from './wizard.module.css';

const TITLE = 'New character';

/**
 * `#/new/draft/…`: make a draft and go to it. Made once (React may run the effect twice); if
 * the page is left before the save lands, it stays where the player went.
 */
function StartDraft() {
  const navigate = useNavigate();
  const started = useRef(false);
  const mounted = useRef(true);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    if (!started.current) {
      started.current = true;
      repos()
        .characters.save(newDraft())
        .then((c) => {
          if (mounted.current) navigate(`/new/${c.id}/class`, { replace: true });
        })
        .catch((err: unknown) => {
          if (mounted.current) setFailed(err instanceof Error ? err.message : String(err));
        });
    }
    return () => {
      mounted.current = false;
    };
  }, [navigate]);
  return (
    <>
      <TopBar title={TITLE} backTo="/" />
      <div className={page.empty}>
        {failed ? `The new character couldn’t be saved on this device (${failed}).` : 'Starting…'}
      </div>
    </>
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

  // "Class features" only when the class's features have something to choose there.
  const steps = wizardSteps(sheet).filter(
    (s) => s !== 'choices' || (!!sheet && picksOnStep(sheet, 'choices').features.length > 0),
  );
  const step: WizardStep =
    isWizardStep(param) && steps.includes(param) ? param : (steps[0] ?? 'class');

  // Remember the step, so "Continue" comes back to it.
  useEffect(() => {
    if (character?.draft && character.draft.step !== step) rawApply((c) => setStep(c, step));
  }, [character?.draft, step, rawApply]);
  const stepHeading = useStepFocus(step);

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

  // Picks the change no longer offers are set aside, and come back when switched back.
  const change = (update: CharacterUpdate) =>
    apply((c) => changeDraft(c, update, content.index, registry));

  const create = async () => {
    if (creating || !character.log.length) return;
    setCreating(true);
    rawApply((c: Character) => finishDraft(c, content.index, registry));
    await actions.flush();
    navigate(`/c/${id}/main`, { replace: true });
  };

  const ctx = sheet
    ? { character, sheet, catalog: content.catalog, index: content.index }
    : undefined;
  const todos = wizardTodos(character, ctx);
  const b: WizardBindings = { character, sheet, content, apply, change, go, todos };
  const at = steps.indexOf(step);
  const prev = steps[at - 1];
  const next = steps[at + 1];
  const needsClass = step !== 'class' && !character.log.length;
  // Steps open up in order: one with picks still to make closes the ones after it.
  const open = new Set(todos.map((t) => t.step));
  const firstOpen = steps.findIndex((s) => open.has(s));
  const reachable = (i: number) => firstOpen < 0 || i <= firstOpen || i <= at;
  const here = todos.filter((t) => t.step === step);
  const earlier = firstOpen >= 0 && firstOpen < at ? steps[firstOpen] : undefined;
  const blocked = here.length > 0 || earlier !== undefined;
  const intro = STEP_INTROS[step];

  const body = (() => {
    if (needsClass) {
      return (
        <p className={styles.notice}>
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
      case 'spells':
        return <SpellsStep {...b} />;
      case 'choices':
        return <ChoicesStep {...b} />;
      case 'levels':
        return <LevelsStep {...b} />;
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
            {reachable(i) ? (
              <a
                href={`#/new/${id}/${s}`}
                aria-current={s === step ? 'step' : undefined}
                ref={
                  s === step
                    ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
                    : undefined
                }
                data-todo={open.has(s) && i < at}
                data-done={!open.has(s) && i < at}
                onClick={(e) => {
                  e.preventDefault();
                  go(s);
                }}
              >
                {i + 1}. {STEP_TITLES[s]}
              </a>
            ) : (
              <span className={styles.stepLocked} aria-disabled="true">
                {i + 1}. {STEP_TITLES[s]}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className={`${page.content} ${styles.body}`}>
        <header className={styles.stepHead}>
          <p className={styles.eyebrow}>{intro.rule}</p>
          <h2 ref={stepHeading} tabIndex={-1} className={styles.stepTitle}>
            {STEP_TITLES[step]}
          </h2>
          <p className={styles.lead}>{intro.lead}</p>
        </header>
        {body}
      </div>
      <nav className={styles.footer} aria-label="Wizard">
        {(here.length > 0 || earlier) && step !== 'review' && (
          <div className={styles.left} aria-live="polite">
            {earlier ? (
              <>
                <strong>{STEP_TITLES[earlier]}</strong> isn’t finished.{' '}
                <button type="button" className={styles.linkButton} onClick={() => go(earlier)}>
                  Go back to it
                </button>
              </>
            ) : (
              <>
                <strong>Still to choose</strong>
                <ul className={styles.todoTags}>
                  {here.map((t, i) => (
                    <li key={i}>{t.text}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className={styles.footerButtons}>
          {prev ? <Button onClick={() => go(prev)}>‹ {STEP_TITLES[prev]}</Button> : <span />}
          {next && (
            <Button
              variant="primary"
              aria-disabled={blocked || !character.log.length}
              onClick={() => {
                if (!blocked && character.log.length) go(next);
              }}
            >
              {STEP_TITLES[next]} ›
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
