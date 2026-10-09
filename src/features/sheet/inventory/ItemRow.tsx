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
  WEAR_AREA_NAMES,
  wearArea,
  type WearArea,
} from '../../../engine/items/items.ts';
import {
  chooseGroupItem,
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
import { EntityView } from '../../../richtext/EntitySheet.tsx';
import { Badge } from '../../../ui/Badge.tsx';
import { Button } from '../../../ui/Button.tsx';
import { Counter } from '../../../ui/Counter.tsx';
import { useRoller } from '../../../ui/rollerContext.ts';
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
          aria-controls={open ? detailsId : undefined}
          onClick={onToggle}
        >
          {row.name}
          {quantityText(row)}
        </button>
        <span className={styles.badges}>
          {row.equipped && <Badge variant="accent">{equippedText(row.equipped)}</Badge>}
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
      {/* What the item does, first: more often wanted than the controls and notes under it. */}
      {variant || item ? (
        <div className={styles.itemText}>
          {variant && <EntityView entity={variant} bare />}
          {item && <EntityView entity={item} bare />}
        </div>
      ) : (
        <p className={styles.muted}>
          {itemKindText(item, variant)}
          {unit ? ` · ${lb(unit)} lb.${row.quantity > 1 ? ' each' : ''}` : ''}
          {value ? ` · ${gp(value)}${row.quantity > 1 ? ' each' : ''}` : ''}
        </p>
      )}

      {(slots.length > 0 || row.equipped) && (
        <EquipControl
          row={row}
          slots={slots}
          onEquip={(slot) => apply((c) => equipItem(c, row.uid, slot, index))}
          area={wearArea(item)}
          sameArea={
            wearArea(item)
              ? character.inventory.find(
                  (r) =>
                    r.uid !== row.uid &&
                    r.equipped === 'worn' &&
                    wearArea(rowItems(index, r).item) === wearArea(item),
                )?.name
              : undefined
          }
        />
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

      {item?.groupItemIds?.length ? <GroupPick row={row} bindings={bindings} /> : null}

      <div className={styles.actions}>
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

/** `Equipped`, or `Equipped · main hand` where the hand matters. */
function equippedText(slot: EquipSlot): string {
  return slot === 'mainHand' || slot === 'offHand' || slot === 'bothHands'
    ? `Equipped · ${SLOT_NAMES[slot].toLowerCase()}`
    : 'Equipped';
}

/**
 * Equip or unequip in one tap. An item that goes in one place has one button; a weapon that can
 * be held in either hand or both has one per way. Equipped, it says where, and can move.
 */
function EquipControl({
  row,
  slots,
  onEquip,
  area,
  sameArea,
}: {
  row: InventoryItem;
  slots: EquipSlot[];
  onEquip: (slot: EquipSlot | null) => void;
  area: WearArea | undefined;
  /** Another worn item in the same body area, taken off when this one is put on. */
  sameArea: string | undefined;
}) {
  const label = (s: EquipSlot) =>
    s === 'worn' ? 'Wear' : `Equip · ${SLOT_NAMES[s].toLowerCase()}`;
  const moves = slots.filter((s) => s !== row.equipped);
  return (
    <div className={styles.equip} role="group" aria-label="Equip">
      {row.equipped ? (
        <>
          <span className={styles.equipped}>{equippedText(row.equipped)}</span>
          <Button size="sm" onClick={() => onEquip(null)}>
            Unequip
          </Button>
          {moves.map((s) => (
            <Button key={s} size="sm" variant="ghost" onClick={() => onEquip(s)}>
              Move to {SLOT_NAMES[s].toLowerCase()}
            </Button>
          ))}
        </>
      ) : (
        <>
          <span className={styles.muted}>Not equipped</span>
          {slots.map((s, i) => (
            <Button
              key={s}
              size="sm"
              variant={i === 0 ? 'primary' : 'secondary'}
              onClick={() => onEquip(s)}
            >
              {slots.length === 1 && s !== 'worn' ? 'Equip' : label(s)}
            </Button>
          ))}
        </>
      )}
      {area && !row.equipped && sameArea && (
        <p className={styles.help}>
          You wear one {WEAR_AREA_NAMES[area]} at a time: wearing this takes off {sameArea}.
        </p>
      )}
    </div>
  );
}

/**
 * An item group (a Druidic Focus, an Arcane Focus) is one item of the group, not all of them:
 * which one this is.
 */
function GroupPick({ row, bindings }: { row: InventoryItem; bindings: SheetBindings }) {
  const { index, apply } = bindings;
  const id = useId();
  const { item } = rowItems(index, row);
  const members = (item?.groupItemIds ?? [])
    .map((m) => index.get({ kind: 'item', id: m }))
    .filter((m) => !!m);
  if (!item || !members.length) return null;
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>Which {item.name}?</span>
      <select
        id={id}
        value=""
        onChange={(e) => apply((c) => chooseGroupItem(c, row.uid, e.target.value, index))}
      >
        <option value="" disabled>
          Choose one…
        </option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <span className={styles.help}>
        {/^[aeiou]/i.test(item.name) ? 'An' : 'A'} {item.name} is one of these, not all of them.
        Pick the one you carry.
      </span>
    </label>
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
