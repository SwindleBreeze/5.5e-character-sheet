import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useConditionOptions, useContentIndex } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { SwipeTabs, type TabDef } from '../../ui/SwipeTabs.tsx';
import { MainTab } from './MainTab.tsx';
import { SheetHeader } from './SheetHeader.tsx';
import styles from './SheetPage.module.css';
import { SHEET_TABS } from './sheetTabs.ts';
import { useCharacterActions } from './useCharacterActions.ts';

export function SheetPage() {
  const { id = '', tab = 'main' } = useParams();
  const navigate = useNavigate();
  // null = not found; undefined = still loading.
  const stored = useLiveQuery(async () => (await repos().characters.get(id)) ?? null, [id]);
  const { character, apply } = useCharacterActions(stored ?? undefined);
  const index = useContentIndex(character);
  const conditionOptions = useConditionOptions();
  const sheet = useMemo(
    () =>
      character && index && character.log.length > 0
        ? derive(character, index, { registry: featureEffects() })
        : undefined,
    [character, index],
  );

  if (!SHEET_TABS.some((t) => t.id === tab)) return <Navigate to={`/c/${id}/main`} replace />;
  if (stored === undefined) return <TopBar title="" backTo="/" />;
  if (stored === null || !character) {
    return (
      <>
        <TopBar title="Not found" backTo="/" />
        <div className={page.empty}>This character doesn’t exist on this device.</div>
      </>
    );
  }

  const placeholder = (label: string) => (
    <div className={page.empty}>
      <p>{label} arrives in phase 3.</p>
    </div>
  );
  const bindings = sheet && index ? { character, sheet, index, apply } : undefined;
  const options = conditionOptions ?? [];

  const tabs: TabDef[] = SHEET_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    content:
      t.id !== 'main' ? (
        placeholder(t.label)
      ) : bindings ? (
        <MainTab {...bindings} conditionOptions={options} />
      ) : character.log.length === 0 ? (
        <div className={page.empty}>This character has no class yet.</div>
      ) : (
        <div className={page.empty}>Loading…</div>
      ),
  }));

  return (
    <div className={styles.sheet}>
      {bindings ? (
        <SheetHeader {...bindings} conditionOptions={options} />
      ) : (
        <TopBar title={character.name} backTo="/" />
      )}
      <SwipeTabs
        label="Character sheet"
        tabs={tabs}
        activeId={tab}
        onChange={(next) => navigate(`/c/${id}/${next}`, { replace: true })}
      />
    </div>
  );
}
