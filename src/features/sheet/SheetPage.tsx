import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useConditionOptions, useContentIndex } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { refreshSnapshots } from '../../engine/content/snapshots.ts';
import { unstackHeld } from '../../engine/play/inventory.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { useRoller } from '../../ui/rollerContext.ts';
import { SwipeTabs, type TabDef } from '../../ui/SwipeTabs.tsx';
import { ActionsTab } from './ActionsTab.tsx';
import { DescriptionTab } from './DescriptionTab.tsx';
import { FeaturesTab } from './FeaturesTab.tsx';
import { InventoryTab } from './InventoryTab.tsx';
import { MainTab } from './MainTab.tsx';
import { NotesTab } from './NotesTab.tsx';
import { SpellsTab } from './SpellsTab.tsx';
import { SheetHeader } from './SheetHeader.tsx';
import styles from './SheetPage.module.css';
import type { SheetBindings } from './sheetBindings.ts';
import { SHEET_TABS, type SheetTabId } from './sheetTabs.ts';
import { useCharacterActions } from './useCharacterActions.ts';

export function SheetPage() {
  const { id = '', tab = 'main' } = useParams();
  const navigate = useNavigate();
  // null = not found; undefined = still loading.
  const stored = useLiveQuery(async () => (await repos().characters.get(id)) ?? null, [id]);
  const { character, apply } = useCharacterActions(stored ?? undefined);
  const index = useContentIndex(character);
  const conditionOptions = useConditionOptions();
  // Rolls made on this sheet are kept for this character (the dice roller shows them).
  const roller = useRoller();
  useEffect(() => {
    roller.setScope(id);
    return () => roller.setScope('');
  }, [roller, id]);
  const sheet = useMemo(
    () =>
      character && index && character.log.length > 0
        ? derive(character, index, { registry: featureEffects() })
        : undefined,
    [character, index],
  );

  // Snapshots of the content in use (plan §4.4): refreshed whenever the loaded content changes,
  // written only when they changed. A worn or held stack saved before they were split is
  // split too (one in hand, the rest carried).
  useEffect(() => {
    if (!index) return;
    apply((saved) => {
      const c = unstackHeld(saved);
      return c.log.length
        ? refreshSnapshots(c, index, derive(c, index, { registry: featureEffects() }))
        : c;
    });
  }, [index, apply]);

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

  const bindings = sheet && index ? { character, sheet, index, apply } : undefined;
  const options = conditionOptions ?? [];

  const built = (tab: ReactNode) =>
    bindings ? (
      tab
    ) : character.log.length === 0 ? (
      <div className={page.empty}>This character has no class yet.</div>
    ) : (
      <div className={page.empty}>Loading…</div>
    );
  const content = (id: SheetTabId, b: SheetBindings): ReactNode => {
    switch (id) {
      case 'main':
        return <MainTab {...b} conditionOptions={options} />;
      case 'actions':
        return <ActionsTab {...b} />;
      case 'spells':
        return <SpellsTab {...b} />;
      case 'inventory':
        return <InventoryTab {...b} />;
      case 'features':
        return <FeaturesTab {...b} />;
      case 'description':
        return <DescriptionTab {...b} />;
      case 'notes':
        return <NotesTab {...b} />;
    }
  };
  const tabs: TabDef[] = SHEET_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    content: built(bindings && content(t.id, bindings)),
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
