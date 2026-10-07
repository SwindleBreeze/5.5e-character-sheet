// Adding an item (plan §9.2, step 3.19): search the library of the enabled sources, or make a
// custom item. A base item can take a magic variant (`+1 Weapon` on a Longsword) and a variant
// needs a base item, matched by the variant's 5etools `requires`/`excludes` filters. An item
// group (Arcane Focus) is added as one of its members.

import { useMemo, useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import { variantApplies, variantName } from '../../../engine/items/items.ts';
import type { Item, SourceCode } from '../../../schema/index.ts';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import { itemKindText } from './format.ts';
import styles from './inventory.module.css';

export interface AddSpec {
  item?: Item;
  variant?: Item;
  name?: string;
  quantity: number;
  custom?: { weightLb?: number; valueCp?: number };
  notes?: string;
}

const MAX_RESULTS = 50;

const byName = (a: Item, b: Item) => a.name.localeCompare(b.name);

export function AddItemSheet({
  sources,
  onAdd,
}: {
  /** The character's own sources, when it has them (plan §6.7). */
  sources?: SourceCode[] | null;
  onAdd: (spec: AddSpec) => void;
}) {
  const all = useEntitiesOfKind('item');
  const enabled = useEnabledSources(sources);
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Item | null>(null);
  const available = useMemo(() => availableOf(all ?? [], new Set(enabled)), [all, enabled]);

  if (!all) return <p className={styles.muted}>Loading items…</p>;

  const q = query.trim().toLowerCase();
  const results = q
    ? available
        .filter((i) => i.name.toLowerCase().includes(q))
        .sort(byName)
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <div className={styles.add}>
      <div className={styles.segmented} role="group" aria-label="Kind of item">
        <Button
          size="sm"
          variant={mode === 'library' ? 'primary' : 'ghost'}
          aria-pressed={mode === 'library'}
          onClick={() => setMode('library')}
        >
          From the library
        </Button>
        <Button
          size="sm"
          variant={mode === 'custom' ? 'primary' : 'ghost'}
          aria-pressed={mode === 'custom'}
          onClick={() => setMode('custom')}
        >
          Custom item
        </Button>
      </div>

      {mode === 'custom' ? (
        <CustomForm onAdd={onAdd} />
      ) : picked ? (
        <PickedForm
          picked={picked}
          available={available}
          onBack={() => setPicked(null)}
          onAdd={onAdd}
        />
      ) : (
        <>
          <input
            type="search"
            className={styles.search}
            aria-label="Find an item"
            placeholder="Find an item or magic variant"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {q && !results.length && <p className={styles.muted}>No items match.</p>}
          {!q && (
            <p className={styles.muted}>
              Search {available.length} items from your sources. Magic variants such as “+1 Weapon”
              go on a base item you choose.
            </p>
          )}
          <ul className={styles.results} aria-label="Items found">
            {results.map((i) => (
              <li key={i.id}>
                <button type="button" className={styles.result} onClick={() => setPicked(i)}>
                  <span className={styles.resultName}>{i.name}</span>
                  <span className={styles.muted}>
                    {i.variant ? 'Magic variant' : itemKindText(i, undefined)} · {i.source}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PickedForm({
  picked,
  available,
  onBack,
  onAdd,
}: {
  picked: Item;
  available: Item[];
  onBack: () => void;
  onAdd: (spec: AddSpec) => void;
}) {
  const [baseId, setBaseId] = useState('');
  const [memberId, setMemberId] = useState(picked.groupItemIds?.[0] ?? '');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const byId = new Map(available.map((i) => [i.id, i]));

  const isVariant = !!picked.variant;
  const bases = isVariant
    ? available.filter((i) => i.variantBase && variantApplies(i, picked)).sort(byName)
    : [];
  const members = (picked.groupItemIds ?? [])
    .map((id) => byId.get(id))
    .filter((i): i is Item => !!i);
  const item = isVariant
    ? byId.get(baseId)
    : picked.groupItemIds
      ? (byId.get(memberId) ?? members[0])
      : picked;
  const variants =
    !isVariant && item?.variantBase
      ? available.filter((v) => v.variant && variantApplies(item, v)).sort(byName)
      : [];
  const variant = isVariant ? picked : variants.find((v) => v.id === variantId);
  const count = Math.floor(Number(quantity));
  const ready = !!item && Number.isFinite(count) && count >= 1;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdd({ item, ...(variant ? { variant } : {}), quantity: count });
      }}
    >
      <p>
        <strong>
          {item && variant ? variantName(item, variant) : (item?.name ?? picked.name)}
        </strong>
        <br />
        <span className={styles.muted}>
          {itemKindText(item ?? picked, variant)} · {picked.source}
        </span>
      </p>
      {isVariant && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Base item</span>
          <select value={baseId} onChange={(e) => setBaseId(e.target.value)} required>
            <option value="">Choose one ({bases.length})</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.source})
              </option>
            ))}
          </select>
        </label>
      )}
      {isVariant && !bases.length && (
        <p className={styles.warn}>
          No base item from your sources fits it. Base items imported before this version can’t take
          variants: import the content again.
        </p>
      )}
      {picked.groupItemIds && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Which one</span>
          <select value={item?.id ?? ''} onChange={(e) => setMemberId(e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {variants.length > 0 && (
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Magic variant</span>
          <select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            <option value="">None</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.source})
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Quantity</span>
        <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" variant="primary" aria-disabled={!ready}>
          Add
        </Button>
      </div>
    </form>
  );
}

function CustomForm({ onAdd }: { onAdd: (spec: AddSpec) => void }) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [weight, setWeight] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const num = (text: string) => {
    const n = Number(text.replace(',', '.'));
    return text.trim() !== '' && Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const count = Math.floor(Number(quantity));
  const ready = !!name.trim() && Number.isFinite(count) && count >= 1;

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        const custom: AddSpec['custom'] = {};
        const w = num(weight);
        const v = num(value);
        if (w !== undefined) custom.weightLb = w;
        if (v !== undefined) custom.valueCp = Math.round(v * 100);
        onAdd({
          name,
          quantity: count,
          ...(Object.keys(custom).length ? { custom } : {}),
          ...(notes.trim() ? { notes } : {}),
        });
      }}
    >
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Quantity</span>
        <input inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Weight (lb. each)</span>
        <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Value (GP each)</span>
        <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Notes</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" aria-disabled={!ready}>
          Add
        </Button>
      </div>
    </form>
  );
}
