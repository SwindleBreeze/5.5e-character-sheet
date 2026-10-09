// The Inventory tab (plan §9.2, step 3.19): weight carried against carrying capacity and
// Attunement; coins; what is worn or held; what else is carried, containers holding their
// contents. Items open in place to change where they are, Attunement, charges and notes.

import { useRef, useState, type ReactNode } from 'react';
import { newRow, newUid, addItem } from '../../engine/play/inventory.ts';
import { SLOT_NAMES } from '../../engine/items/items.ts';
import type { EquipSlot, InventoryItem } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useRoller } from '../../ui/rollerContext.ts';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { SectionHeader } from './components/stats.tsx';
import { useExplain } from './components/useExplain.tsx';
import { AddItemSheet, type AddSpec } from './inventory/AddItemSheet.tsx';
import { CoinsCard } from './inventory/CoinsCard.tsx';
import { lb } from './inventory/format.ts';
import { ItemRow } from './inventory/ItemRow.tsx';
import type { SheetBindings } from './sheetBindings.ts';
import mainStyles from './MainTab.module.css';
import styles from './inventory/inventory.module.css';
import { characterSources } from '../../sources/sourceFilter.ts';

const INVENTORY_ISSUES = new Set([
  'overCapacity',
  'overDragLimit',
  'containerFull',
  'attunement',
  'attunementCopies',
  'attunementPrereq',
  'armorUntrained',
  'shieldUntrained',
  'equipConflict',
]);

const SLOT_ORDER = Object.keys(SLOT_NAMES) as EquipSlot[];

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={mainStyles.section} aria-labelledby={`inventory-${id}`}>
      <SectionHeader id={`inventory-${id}`} title={title} action={action} />
      {children}
    </section>
  );
}

export function InventoryTab(bindings: SheetBindings) {
  const { character, sheet, apply } = bindings;
  const ref = useRef<HTMLDivElement>(null);
  const columns = Math.min(2, columnsFor(useContainerWidth(ref)));
  const ui = useSheet();
  const roller = useRoller();
  const explain = useExplain();
  const [open, setOpen] = useState<string[]>([]);
  const inv = sheet.inventory;
  const rows = character.inventory;
  const issues = sheet.issues.filter((i) => INVENTORY_ISSUES.has(i.code));

  const byUid = new Map(rows.map((r) => [r.uid, r]));
  const isTop = (r: InventoryItem) =>
    !r.containerUid || r.containerUid === r.uid || !byUid.has(r.containerUid);
  const toggle = (uid: string) =>
    setOpen(open.includes(uid) ? open.filter((u) => u !== uid) : [...open, uid]);

  const renderRow = (r: InventoryItem, seen: ReadonlySet<string>): ReactNode => {
    const inside = rows.filter((x) => x.containerUid === r.uid && !seen.has(x.uid));
    const next = new Set([...seen, r.uid]);
    return (
      <ItemRow
        key={r.uid}
        row={r}
        bindings={bindings}
        open={open.includes(r.uid)}
        onToggle={() => toggle(r.uid)}
        nested={
          inside.length > 0 && (
            <ul className={styles.nested} aria-label={`In ${r.name}`}>
              {inside.map((x) => renderRow(x, next))}
            </ul>
          )
        }
      />
    );
  };

  const equipped = rows
    .filter((r) => r.equipped && isTop(r))
    .sort((a, b) => SLOT_ORDER.indexOf(a.equipped!) - SLOT_ORDER.indexOf(b.equipped!));
  const carried = rows.filter((r) => !r.equipped && isTop(r));

  const add = (spec: AddSpec) => {
    const row = newRow({ uid: newUid(), ...spec });
    const dice = spec.item?.chargesDice ?? spec.variant?.chargesDice;
    const fixed = spec.item?.charges ?? spec.variant?.charges;
    if (dice && fixed === undefined) {
      row.chargesMax = roller.roll({ label: `${row.name}: charges`, expr: dice }).total;
    }
    ui.close();
    apply((c) => addItem(c, row));
  };
  const openAdd = () =>
    ui.open({
      key: 'inventory:add',
      title: 'Add an item',
      render: () => <AddItemSheet sources={characterSources(character)} onAdd={add} />,
    });

  const over = inv.weight.value > inv.carry.value;
  const carrying = (
    <Section id="carrying" title="Carrying">
      <div className={styles.card}>
        <div className={styles.load}>
          <button
            type="button"
            className={styles.statButton}
            onClick={() =>
              explain({ key: 'inventory.weight', title: 'Weight carried', derived: inv.weight })
            }
          >
            <span className={`${styles.big} numeric`}>{lb(inv.weight.value)}</span> lb.
          </button>
          <span className={styles.muted}>of</span>
          <button
            type="button"
            className={styles.statButton}
            onClick={() =>
              explain({ key: 'inventory.carry', title: 'Carrying capacity', derived: inv.carry })
            }
          >
            <span className="numeric">{lb(inv.carry.value)}</span> lb. you can carry
          </button>
        </div>
        <meter
          className={styles.meter}
          aria-label="Weight carried"
          min={0}
          max={inv.dragLiftPush}
          low={inv.carry.value}
          high={inv.carry.value}
          optimum={0}
          value={Math.min(inv.weight.value, inv.dragLiftPush)}
          data-over={over}
        />
        <p className={styles.help}>
          You can drag, lift or push up to {lb(inv.dragLiftPush)} lb. While you have more than you
          can carry, your Speed is at most 5 feet; more than you can drag, and it is 0.
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={!character.ignoreWeight}
            onChange={(e) => apply((c) => ({ ...c, ignoreWeight: !e.target.checked }))}
          />
          Weight slows {character.name || 'this character'} down (turn off if your DM doesn’t count
          weight)
        </label>
        <p className={styles.muted}>
          Attuned to{' '}
          <span className="numeric">
            {inv.attuned} of {inv.attunementMax}
          </span>{' '}
          magic items.
        </p>
      </div>
      {issues.length > 0 && (
        <ul className={styles.issues} aria-label="Inventory warnings">
          {issues.map((i, n) => (
            <li key={n} data-severity={i.severity}>
              {i.message}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );

  const coins = (
    <Section id="coins" title="Coins">
      <CoinsCard character={character} apply={apply} />
    </Section>
  );

  const items = (
    <>
      <Section id="equipped" title="Worn and held">
        {equipped.length ? (
          <ul className={styles.list} aria-label="Worn and held">
            {equipped.map((r) => renderRow(r, new Set()))}
          </ul>
        ) : (
          <p className={styles.muted}>Nothing worn or held.</p>
        )}
      </Section>
      <Section
        id="carried"
        title="Carried"
        action={
          <Button size="sm" onClick={openAdd}>
            Add item
          </Button>
        }
      >
        {carried.length ? (
          <ul className={styles.list} aria-label="Carried">
            {carried.map((r) => renderRow(r, new Set()))}
          </ul>
        ) : (
          <p className={styles.muted}>Nothing else carried.</p>
        )}
      </Section>
    </>
  );

  return (
    <div ref={ref} className={mainStyles.main} data-columns={columns}>
      {columns === 1 ? (
        <div className={mainStyles.column}>
          {carrying}
          {coins}
          {items}
        </div>
      ) : (
        <>
          <div className={mainStyles.column}>
            {carrying}
            {coins}
          </div>
          <div className={mainStyles.column}>{items}</div>
        </>
      )}
    </div>
  );
}
