// Buying an item in the Shop: for which character, how many (and its base item or magic variant,
// as on the sheet's add-item form), at what price, and whether it comes out of their coins.
// The price starts at the item's own and can be changed: the DM sets prices at the table.

import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { repos } from '../../db/repos.ts';
import { buyItem, coinValueCp } from '../../engine/play/inventory.ts';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import type { Item } from '../../schema/index.ts';
import { useRoller } from '../../ui/rollerContext.ts';
import { PickedForm, type AddSpec } from '../sheet/inventory/AddItemSheet.tsx';
import { rowFromSpec } from '../sheet/inventory/addSpec.ts';
import { gp } from '../sheet/inventory/format.ts';
import inventory from '../sheet/inventory/inventory.module.css';
import styles from './ShopPage.module.css';

/** `12.5` from a field in gold pieces; undefined when blank or not a price. */
function priceCp(text: string): number | undefined {
  const n = Number(text.replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
}

export function BuySheet({ item, available }: { item: Item; available: Item[] }) {
  const characters = useLiveQuery(() => repos().characters.list(), []);
  const roller = useRoller();
  const [buyerId, setBuyerId] = useState('');
  const [price, setPrice] = useState(item.valueCp !== undefined ? String(item.valueCp / 100) : '');
  const [pay, setPay] = useState(item.valueCp !== undefined);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const buyer = characters?.find((c) => c.id === buyerId) ?? characters?.[0];
  const each = priceCp(price);

  const buy = async (spec: AddSpec) => {
    if (!buyer) return;
    const total = pay && each !== undefined ? each * spec.quantity : 0;
    const current = await repos().characters.get(buyer.id);
    if (!current) return;
    const row = rowFromSpec(spec, (expr, label) => roller.roll({ label, expr }).total);
    const next = buyItem(current, row, total);
    if (!next) {
      setResult({
        ok: false,
        text: `${current.name} has ${gp(coinValueCp(current.currency))}: not enough for ${gp(total)}.`,
      });
      return;
    }
    await repos().characters.save(next);
    const count = spec.quantity > 1 ? `${spec.quantity} × ` : '';
    setResult({
      ok: true,
      text: `${count}${row.name} added to ${current.name}’s items${total ? `, ${gp(total)} paid` : ''}.`,
    });
  };

  return (
    <div className={styles.buy}>
      {characters === undefined ? null : !buyer ? (
        <p className={inventory.muted}>Make a character first to buy for them.</p>
      ) : (
        <PickedForm picked={item} available={available} onAdd={buy} submitLabel="Buy">
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>For</span>
            <select
              value={buyer.id}
              onChange={(e) => {
                setBuyerId(e.target.value);
                setResult(null);
              }}
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({gp(coinValueCp(c.currency))})
                </option>
              ))}
            </select>
          </label>
          <label className={inventory.field}>
            <span className={inventory.fieldLabel}>Price each (GP)</span>
            <input
              inputMode="decimal"
              value={price}
              placeholder="No set price"
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={pay && each !== undefined}
              disabled={each === undefined}
              onChange={(e) => setPay(e.target.checked)}
            />
            Pay from {buyer.name}’s coins
          </label>
          {result && (
            <p className={result.ok ? styles.done : inventory.warn} role="status">
              {result.text}
            </p>
          )}
        </PickedForm>
      )}
      <EntitySheet entityRef={{ kind: 'item', id: item.id }} />
    </div>
  );
}
