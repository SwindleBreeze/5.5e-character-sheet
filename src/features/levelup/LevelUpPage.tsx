// The level-up flow (plan §9.4, step 5.2) at `#/c/:id/level-up`: Class (the character's own,
// or another with the 2024 multiclass requirement shown) → Hit points → Subclass (when due) →
// Features (what the level brings, and its picks) → Spells (when it brings any) → Review →
// Apply. The level lives in memory until applied; leaving discards it. Like the creation
// wizard, a step's required picks close the next step until they are made.

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import page from '../../app/Page.module.css';
import { TopBar } from '../../app/TopBar.tsx';
import { useAllContent } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { setSubclass } from '../../engine/build/build.ts';
import { levelUpOptions, readLevelUp, setLevelHp, takeLevel } from '../../engine/build/levelUp.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { setPick } from '../../engine/play/features.ts';
import { decodeChoiceKey, type Character } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { FeatureChoices } from '../choices/FeatureChoices.tsx';
import { choiceTitle } from '../choices/labels.ts';
import { useCharacterActions } from '../sheet/useCharacterActions.ts';
import { fillable, isSpellOffer } from '../wizard/progress.ts';
import wizard from '../wizard/wizard.module.css';
import { levelPicks, type LevelUpBindings } from './bindings.ts';
import { ClassStep, FeaturesList, HpStep, ReviewStep, SubclassStep } from './steps.tsx';

export type LevelUpStep = 'class' | 'hp' | 'subclass' | 'features' | 'spells' | 'review';

const TITLES: Record<LevelUpStep, string> = {
  class: 'Class',
  hp: 'Hit points',
  subclass: 'Subclass',
  features: 'Features',
  spells: 'Spells',
  review: 'Review',
};

const LEADS: Record<LevelUpStep, string> = {
  class: 'Take the next level in a class you have, or start another one (multiclassing).',
  hp: 'Each level raises your hit point maximum by a roll of your class’s Hit Die, or its fixed value, plus your Constitution modifier.',
  subclass:
    'This level is where your class branches: pick the subclass that shapes the rest of it.',
  features: 'What this level gives you, and the choices it asks for.',
  spells: 'The spells this level adds.',
  review: 'Check the new level, then apply it to your character.',
};

export function LevelUpPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const stored = useLiveQuery(async () => (await repos().characters.get(id)) ?? null, [id]);
  const actions = useCharacterActions(stored ?? undefined);
  const content = useAllContent(stored?.enabledSources);
  const registry = featureEffects();
  // The character as it was when the level-up started: later saves (snapshots) don't reset it.
  const [base, setBase] = useState<Character | null>(null);
  const [draft, setDraft] = useState<Character | null>(null);
  const [step, setStep] = useState<LevelUpStep>('class');
  const [applying, setApplying] = useState(false);

  if (!base && stored) setBase(stored);
  const before = useMemo(
    () => (base && content ? derive(base, content.index, { registry }) : undefined),
    [base, content, registry],
  );
  const plan = useMemo(
    () =>
      draft && before && content
        ? readLevelUp(draft, before, { index: content.index, catalog: content.catalog, registry })
        : undefined,
    [draft, before, content, registry],
  );

  if (stored === undefined || (stored && (!content || !base || !before))) {
    return (
      <>
        <TopBar title="Level up" backTo={`/c/${id}/main`} />
        <div className={page.empty}>Loading…</div>
      </>
    );
  }
  if (stored === null || !base || !before || !content) {
    return (
      <>
        <TopBar title="Not found" backTo="/" />
        <div className={page.empty}>This character doesn’t exist on this device.</div>
      </>
    );
  }
  if (base.draft) return <Navigate to={`/new/${id}/${base.draft.step}`} replace />;
  if (!base.log.length) return <Navigate to={`/c/${id}/main`} replace />;

  const ctx = plan
    ? {
        character: plan.character,
        sheet: plan.sheet,
        catalog: content.catalog,
        index: content.index,
      }
    : undefined;
  const spellPicks = plan ? levelPicks(plan, true) : undefined;
  const steps: LevelUpStep[] = [
    'class',
    'hp',
    ...(plan?.subclassDue ? (['subclass'] as const) : []),
    'features',
    ...(spellPicks?.features.length ? (['spells'] as const) : []),
    'review',
  ];
  const current = steps.includes(step) ? step : 'class';

  // What is left, by step.
  const todos: { step: LevelUpStep; text: string }[] = [];
  if (!plan) todos.push({ step: 'class', text: 'Choose a class' });
  else {
    if (plan.subclassDue && !plan.subclassRef)
      todos.push({ step: 'subclass', text: `Choose a ${plan.cls?.subclassTitle ?? 'subclass'}` });
    for (const p of plan.pending) {
      if (!ctx || !fillable(p, ctx)) continue;
      const choice = plan.sheet.features.flatMap((f) => f.choices).find((c) => c.offer === p.offer);
      const what = choice ? choiceTitle(choice) : 'a choice';
      const source = p.offer.source.name;
      todos.push({
        step: isSpellOffer(p.offer) ? 'spells' : 'features',
        text: `${what === source ? what : `${source}: ${what}`} (${p.count - p.have} more)`,
      });
    }
  }
  const at = steps.indexOf(current);
  const open = new Set(todos.map((t) => t.step));
  const firstOpen = steps.findIndex((s) => open.has(s));
  const reachable = (i: number) => firstOpen < 0 || i <= firstOpen || i <= at;
  const here = todos.filter((t) => t.step === current);
  const prev = steps[at - 1];
  const next = steps[at + 1];
  const blocked = here.length > 0 || (firstOpen >= 0 && firstOpen < at);
  const go = (s: LevelUpStep) => {
    setStep(s);
    window.scrollTo(0, 0);
  };

  const b: LevelUpBindings = {
    base,
    before,
    plan,
    chooseClass: (ref) => setDraft(takeLevel(base, ref)),
    change: (update) => setDraft((d) => (d ? update(d) : d)),
  };

  const apply = async () => {
    if (!plan || todos.length || applying) return;
    setApplying(true);
    actions.apply(() => plan.character);
    await actions.flush();
    navigate(`/c/${id}/main`, { replace: true });
  };

  const picks = (spells: boolean) => {
    if (!plan || !ctx) return null;
    const { features, only } = levelPicks(plan, spells);
    if (!features.length)
      return <p className={wizard.notice}>Nothing to choose here: on you go.</p>;
    return (
      <FeatureChoices
        features={features}
        ctx={ctx}
        only={only}
        named
        onPick={(c, _f, pick) =>
          b.change((ch) =>
            setPick(ch, decodeChoiceKey(c.key), {
              ...pick,
              entryIndex: c.entryIndex,
              ...(c.entryIndex === plan.entryIndex ? { via: 'levelUp' as const } : {}),
            }),
          )
        }
      />
    );
  };

  const body = (() => {
    switch (current) {
      case 'class':
        return (
          <ClassStep
            b={b}
            options={levelUpOptions(base, before, content.index, content.catalog)}
            index={content.index}
          />
        );
      case 'hp':
        return plan ? (
          <HpStep plan={plan} onHp={(hp) => b.change((c) => setLevelHp(c, hp))} />
        ) : null;
      case 'subclass':
        return plan?.cls ? (
          <SubclassStep
            plan={plan}
            index={content.index}
            onPick={(ref) => b.change((c) => setSubclass(c, plan.cls!, ref))}
          />
        ) : null;
      case 'features':
        return plan ? (
          <>
            <FeaturesList plan={plan} index={content.index} />
            {picks(false)}
          </>
        ) : null;
      case 'spells':
        return picks(true);
      case 'review':
        return plan ? <ReviewStep plan={plan} before={before} todos={todos} /> : null;
    }
  })();

  const name = base.name || 'Character';
  return (
    <div className={wizard.page}>
      <TopBar title={`Level up ${name}`} backTo={`/c/${id}/main`} />
      <ol className={wizard.steps} aria-label="Steps">
        {steps.map((s, i) => (
          <li key={s}>
            {reachable(i) ? (
              <a
                href={`#/c/${id}/level-up`}
                aria-current={s === current ? 'step' : undefined}
                data-todo={open.has(s) && i < at}
                data-done={!open.has(s) && i < at}
                onClick={(e) => {
                  e.preventDefault();
                  go(s);
                }}
              >
                {i + 1}. {TITLES[s]}
              </a>
            ) : (
              <span className={wizard.stepLocked} aria-disabled="true">
                {i + 1}. {TITLES[s]}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className={`${page.content} ${wizard.body}`}>
        <header className={wizard.stepHead}>
          <p className={wizard.eyebrow}>
            {plan
              ? `Level ${plan.charLevel} · ${plan.cls?.name ?? 'Class'} ${plan.classLevel}`
              : `Level ${base.log.length + 1}`}
          </p>
          <h2 className={wizard.stepTitle}>{TITLES[current]}</h2>
          <p className={wizard.lead}>{LEADS[current]}</p>
        </header>
        {plan?.issues.map((i) => (
          <p key={i} className={wizard.notice}>
            {i}
          </p>
        ))}
        {body}
      </div>
      <nav className={wizard.footer} aria-label="Level up">
        {here.length > 0 && current !== 'review' && (
          <div className={wizard.left} aria-live="polite">
            <strong>Still to choose</strong>
            <ul className={wizard.todoTags}>
              {here.map((t, i) => (
                <li key={i}>{t.text}</li>
              ))}
            </ul>
          </div>
        )}
        <div className={wizard.footerButtons}>
          {prev ? <Button onClick={() => go(prev)}>‹ {TITLES[prev]}</Button> : <span />}
          {next ? (
            <Button
              variant="primary"
              aria-disabled={blocked}
              onClick={() => {
                if (!blocked) go(next);
              }}
            >
              {TITLES[next]} ›
            </Button>
          ) : (
            <Button
              variant="primary"
              aria-disabled={!plan || todos.length > 0 || applying}
              onClick={() => void apply()}
            >
              Apply level {plan?.charLevel ?? ''}
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
