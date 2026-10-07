// One inventory row (plan §9.2, step 3.19): a summary line, and when opened, its controls:
// where it is worn or held, which container it is in, quantity, Attunement, charges, notes,
// a custom item's details, unpacking and removal. The controls render in the tab, not in a
// bottom sheet, so they always show the live character.

import { useId, useState, type ReactNode } from 'react';
import { attuneBlock } from '../../../engine/derive/inventory.ts';
import {
  equipSlots,
  isContainer,
  needsAttunement,
  rowItems,
  SLOT_NAMES,
  unitWeight,
} from '../../../engine/items/items.ts';
import {
  descendants,
  equipItem,
  moveItem,
  removeItem,
  setAttuned,
  setChargesLeft,
  setChargesMax,
  setItemNotes,
  setQuantity,
  unpackItem,
  updateCustomItem,
} from '../../../engine/play/inventory.ts';
import type { EquipSlot, InventoryItem } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { Badge } from '../../../ui/Badge.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Counter } from '../../../ui/Counter.tsx';
import { useRoller } from '../../../ui/rollerContext.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import {
  containerFull,
  containerText,
  gp,
  itemKindText,
  lb,
  quantityText,
  rechargeText,
} from './format.ts';
import styles from './inventory.module.css';

export function ItemRow({
  row,
  bindings,
  open,
  onToggle,
  nested,
}: {
  row: InventoryItem;
  bindings: SheetBindings;
  open: boolean;
  onToggle: () => void;
  /** The rows inside it, when it is a container. */
  nested?: ReactNode;
}) {
  const { sheet, index } = bindings;
  const detailsId = useId();
  const { item, variant } = rowItems(index, row);
  const attunement = needsAttunement(item, variant);
  const charges = sheet.inventory.charges[row.uid];
  const container = sheet.inventory.containers[row.uid];
  const weight = unitWeight(row, item) * row.quantity;

  return (
    <li className={styles.item} aria-label={row.name}>
      <div className={styles.summary}>
        <button
          type="button"
          className={styles.itemName}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={onToggle}
        >
          {row.name}
          {quantityText(row)}
        </button>
        <span className={styles.badges}>
          {row.equipped && <Badge variant="accent">{SLOT_NAMES[row.equipped]}</Badge>}
          {attunement && row.attuned && <Badge variant="accent">Attuned</Badge>}
          {attunement && !row.attuned && <Badge>Needs Attunement</Badge>}
          {!item && !attunement && row.attuned && <Badge variant="accent">Attuned</Badge>}
          {charges?.max !== undefined && (
            <Badge>
              {charges.max - charges.used}/{charges.max} charges
            </Badge>
          )}
          {container && (
            <Badge variant={containerFull(container) ? 'warning' : 'neutral'}>
              {containerText(container)}
            </Badge>
          )}
        </span>
        <span className={styles.weight}>{weight ? `${lb(weight)} lb.` : '—'}</span>
      </div>
      {open && (
        <div id={detailsId}>
          <ItemDetails row={row} bindings={bindings} />
        </div>
      )}
      {nested}
    </li>
  );
}

function ItemDetails({ row, bindings }: { row: InventoryItem; bindings: SheetBindings }) {
  const { character, sheet, index, apply } = bindings;
  const ui = useSheet();
  const roller = useRoller();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { item, variant } = rowItems(index, row);
  const slots = equipSlots(item);
  const attunement = needsAttunement(item, variant);
  const charges = sheet.inventory.charges[row.uid];
  const inside = descendants(character, row.uid);
  const containers = character.inventory.filter(
    (r) => r.uid !== row.uid && !inside.has(r.uid) && isContainer(rowItems(index, r).item),
  );
  const blocked = attuneBlock(character, sheet, row);
  const custom = !row.itemRef;
  const unit = unitWeight(row, item);
  const value = row.custom?.valueCp ?? (variant ? undefined : item?.valueCp);

  const openText = () =>
    ui.open({
      key: `item:${row.uid}`,
      title: row.name,
      render: () => (
        <>
          {row.variantRef && <EntitySheet entityRef={row.variantRef} />}
          {row.itemRef && <EntitySheet entityRef={row.itemRef} />}
        </>
      ),
    });

  const regain = () => {
    if (!charges || charges.max === undefined) return;
    const left = charges.max - charges.used;
    const gained = charges.amount
      ? roller.roll({ label: `${row.name}: charges regained`, expr: charges.amount }).total
      : charges.max;
    apply((c) => setChargesLeft(c, row.uid, left + gained, charges.max!));
  };

  return (
    <div className={styles.details}>
      <p className={styles.muted}>
        {itemKindText(item, variant)}
        {unit ? ` · ${lb(unit)} lb.${row.quantity > 1 ? ' each' : ''}` : ''}
        {value ? ` · ${gp(value)}${row.quantity > 1 ? ' each' : ''}` : ''}
      </p>

      {(slots.length > 0 || row.equipped) && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Worn or held</span>
          <select
            value={row.equipped ?? ''}
            onChange={(e) =>
              apply((c) =>
                equipItem(c, row.uid, (e.target.value || null) as EquipSlot | null, index),
              )
            }
          >
            <option value="">Not worn or held</option>
            {slots.map((s) => (
              <option key={s} value={s}>
                {SLOT_NAMES[s]}
              </option>
            ))}
            {row.equipped && !slots.includes(row.equipped) && (
              <option value={row.equipped}>{SLOT_NAMES[row.equipped]}</option>
            )}
          </select>
        </label>
      )}
      {row.quantity > 1 && slots.length > 0 && !row.equipped && (
        <p className={styles.help}>Wearing or holding one leaves the rest here.</p>
      )}
      {item?.armor && (
        <p className={styles.help}>
          {item.armor.category === 'light'
            ? 'Light armor takes 1 minute to don and 1 minute to doff.'
            : item.armor.category === 'medium'
              ? 'Medium armor takes 5 minutes to don and 1 minute to doff.'
              : 'Heavy armor takes 10 minutes to don and 5 minutes to doff.'}
        </p>
      )}
      {item?.itemKind === 'shield' && (
        <p className={styles.help}>Donning or doffing a Shield takes the Utilize action.</p>
      )}

      {containers.length > 0 && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>In a container</span>
          <select
            value={row.containerUid ?? ''}
            onChange={(e) => apply((c) => moveItem(c, row.uid, e.target.value || null))}
          >
            <option value="">No</option>
            {containers.map((r) => (
              <option key={r.uid} value={r.uid}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {row.equipped && containers.length > 0 && (
        <p className={styles.help}>Putting it in a container stops wearing or holding it.</p>
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Quantity</span>
        <Counter
          label={`${row.name} quantity`}
          value={row.quantity}
          min={1}
          onChange={(q) => apply((c) => setQuantity(c, row.uid, q))}
        />
        {row.equipped && (
          <p className={styles.help}>Worn and held items are one each: more go to Carried.</p>
        )}
      </div>

      {(attunement || custom) && (
        <div className={styles.attune}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={row.attuned}
              aria-disabled={!!blocked}
              onChange={() => {
                if (row.attuned || !blocked) apply((c) => setAttuned(c, row.uid, !row.attuned));
              }}
            />
            Attuned
          </label>
          <p className={styles.help}>
            {typeof attunement === 'string'
              ? `Requires Attunement ${attunement}. `
              : attunement
                ? 'Requires Attunement. '
                : 'Mark it if this custom item needs Attunement. '}
            {blocked ??
              (row.attuned
                ? 'Ending Attunement voluntarily takes a Short Rest focused on the item.'
                : 'Attuning takes a Short Rest focused on the item.')}
          </p>
        </div>
      )}

      {charges && (
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Charges</span>
          {charges.max === undefined ? (
            <Button
              size="sm"
              onClick={() => {
                const total = roller.roll({
                  label: `${row.name}: charges`,
                  expr: charges.dice!,
                }).total;
                apply((c) => setChargesMax(c, row.uid, total));
              }}
            >
              Roll {charges.dice} for its charges
            </Button>
          ) : (
            <>
              <Counter
                label={`${row.name} charges left`}
                value={charges.max - charges.used}
                max={charges.max}
                onChange={(left) => apply((c) => setChargesLeft(c, row.uid, left, charges.max!))}
              />
              {charges.recharge && charges.used > 0 && (
                <Button size="sm" variant="ghost" onClick={regain}>
                  {charges.amount ? `Regain ${charges.amount}` : 'Regain all'}
                </Button>
              )}
            </>
          )}
          {rechargeText(charges) && <p className={styles.help}>{rechargeText(charges)}</p>}
        </div>
      )}

      {custom && <CustomFields row={row} apply={bindings.apply} />}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Notes</span>
        <textarea
          key={row.notes ?? ''}
          defaultValue={row.notes ?? ''}
          rows={2}
          onBlur={(e) => {
            if (e.target.value !== (row.notes ?? ''))
              apply((c) => setItemNotes(c, row.uid, e.target.value));
          }}
        />
      </label>

      <div className={styles.actions}>
        {row.itemRef && (
          <Button size="sm" variant="ghost" onClick={openText}>
            Item text
          </Button>
        )}
        {item?.packContents && (
          <Button size="sm" onClick={() => apply((c) => unpackItem(c, row.uid, index))}>
            Unpack{row.quantity > 1 ? ' one' : ''}
          </Button>
        )}
        {confirmRemove ? (
          <>
            <Button size="sm" variant="danger" onClick={() => apply((c) => removeItem(c, row.uid))}>
              Remove {row.name}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
              Keep
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
            Remove…
          </Button>
        )}
      </div>
      {confirmRemove && sheet.inventory.containers[row.uid] && (
        <p className={styles.help}>What is inside it stays, where it was.</p>
      )}
    </div>
  );
}

/** Name, weight and value of a custom item, saved when a field is left. */
function CustomFields({ row, apply }: { row: InventoryItem; apply: SheetBindings['apply'] }) {
  const num = (text: string): number | null => {
    const n = Number(text.replace(',', '.'));
    return text.trim() === '' || !Number.isFinite(n) ? null : n;
  };
  return (
    <div className={styles.customFields}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          key={row.name}
          defaultValue={row.name}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== row.name)
              apply((c) => updateCustomItem(c, row.uid, { name: e.target.value }));
          }}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Weight (lb. each)</span>
        <input
          key={`w${row.custom?.weightLb ?? ''}`}
          inputMode="decimal"
          defaultValue={row.custom?.weightLb ?? ''}
          onBlur={(e) => {
            const v = num(e.target.value);
            if (v !== (row.custom?.weightLb ?? null))
              apply((c) => updateCustomItem(c, row.uid, { weightLb: v }));
          }}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Value (GP each)</span>
        <input
          key={`v${row.custom?.valueCp ?? ''}`}
          inputMode="decimal"
          defaultValue={row.custom?.valueCp === undefined ? '' : row.custom.valueCp / 100}
          onBlur={(e) => {
            const v = num(e.target.value);
            const cp = v === null ? null : Math.round(v * 100);
            if (cp !== (row.custom?.valueCp ?? null))
              apply((c) => updateCustomItem(c, row.uid, { valueCp: cp }));
          }}
        />
      </label>
    </div>
  );
}
