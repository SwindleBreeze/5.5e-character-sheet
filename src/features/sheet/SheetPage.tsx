import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useContentIndex } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import type { Character } from '../../schema/index.ts';
import { DerivedView } from '../dev/DerivedView.tsx';
import { SwipeTabs, type TabDef } from '../../ui/SwipeTabs.tsx';
import styles from './SheetPage.module.css';
import { SHEET_TABS } from './sheetTabs.ts';

export function SheetPage() {
  const { id = '', tab = 'main' } = useParams();
  const navigate = useNavigate();
  // null = not found; undefined = still loading.
  const character = useLiveQuery(async () => (await repos().characters.get(id)) ?? null, [id]);

  if (!SHEET_TABS.some((t) => t.id === tab)) return <Navigate to={`/c/${id}/main`} replace />;
  if (character === undefined) return <TopBar title="" backTo="/" />;
  if (character === null) {
    return (
      <>
        <TopBar title="Not found" backTo="/" />
        <div className={page.empty}>This character doesn’t exist on this device.</div>
      </>
    );
  }

  const tabs: TabDef[] = SHEET_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    content:
      t.id === 'main' && character.log.length > 0 ? (
        <DerivedTab character={character} />
      ) : (
        <div className={page.empty}>
          <p>{t.label} arrives in phase 3.</p>
        </div>
      ),
  }));

  return (
    <div className={styles.sheet}>
      <TopBar title={character.name} backTo="/" />
      <SwipeTabs
        label="Character sheet"
        tabs={tabs}
        activeId={tab}
        onChange={(next) => navigate(`/c/${id}/${next}`, { replace: true })}
      />
    </div>
  );
}

/** Until the styled Main tab exists (step 3.15): every derived value, plainly listed. */
function DerivedTab({ character }: { character: Character }) {
  const index = useContentIndex(character);
  const sheet = useMemo(
    () => index && derive(character, index, { registry: featureEffects() }),
    [character, index],
  );
  if (!sheet) return <div className={page.empty}>Loading…</div>;
  return (
    <div className={page.content}>
      <DerivedView sheet={sheet} index={index} />
    </div>
  );
}
