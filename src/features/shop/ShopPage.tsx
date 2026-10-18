// The Shop (play-test request): every item of the books switched on, on shelves by what it is
// for (weapons by kind, gear by use: light, containers, food…, magic items by kind), each with
// its price and the numbers that matter when choosing. Search finds one by name; tapping one
// shows its text and buys it for a character.

import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useEnabledSources, useEntitiesOfKind } from '../../content/hooks.ts';
import { isMagic, stockShop } from '../../engine/items/shop.ts';
import type { Item } from '../../schema/index.ts';
import { availableOf } from '../../sources/sourceFilter.ts';
import { Badge } from '../../ui/Badge.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { searchKey } from '../library/libraryFilter.ts';
import { gp, lb } from '../sheet/inventory/format.ts';
import { BuySheet } from './BuySheet.tsx';
import styles from './ShopPage.module.css';

/** What matters when choosing: price, weight, then damage, Armor Class or rarity. */
function facts(item: Item): string {
  const out: string[] = [];
  if (item.valueCp !== undefined) out.push(gp(item.valueCp));
  if (item.weightLb) out.push(`${lb(item.weightLb)} lb.`);
  if (item.weapon) out.push(`${item.weapon.damage} ${item.weapon.damageType}`);
  if (item.armor) out.push(`AC ${item.armor.ac}`);
  if (item.shieldAc) out.push(`AC +${item.shieldAc}`);
  if (isMagic(item)) out.push(item.rarity!);
  if (item.attunement) out.push('attunement');
  return out.join(' · ');
}

export function ShopPage() {
  const all = useEntitiesOfKind('item');
  const enabled = useEnabledSources();
  const sheet = useSheet();
  const [query, setQuery] = useState('');
  const available = useMemo(() => availableOf(all ?? [], new Set(enabled)), [all, enabled]);
  const q = searchKey(query);
  const shop = useMemo(
    () => stockShop(q ? available.filter((i) => searchKey(i.name).includes(q)) : available),
    [available, q],
  );
  // Content imported before the Shop sorts gear by kind only: a new import sorts it by use.
  const older = available.length > 0 && !available.some((i) => i.itemType);

  const open = (item: Item) =>
    sheet.open({
      key: `shop:${item.id}`,
      title: item.name,
      render: () => <BuySheet item={item} available={available} />,
    });

  return (
    <>
      <TopBar title="Shop" />
      <div className={page.content}>
        {all === undefined ? null : available.length === 0 ? (
          <div className={page.empty}>
            <p>No items from your sources.</p>
            <p>
              <Link to="/library/import">Import your group’s pack</Link>, or switch books on in the
              Library.
            </p>
          </div>
        ) : (
          <>
            <label className={styles.search}>
              <span className="visually-hidden">Find an item</span>
              <input
                type="search"
                placeholder="Find an item"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </label>
            {older && (
              <p className={page.muted}>
                Gear is sorted by kind only: import your content again to sort it by use (light,
                containers, food…).
              </p>
            )}
            {q && !shop.length && <p className={page.muted}>No items match.</p>}
            {shop.map((group) => (
              <details
                key={`${group.id}${q ? ':q' : ''}`}
                className={styles.group}
                open={!!q || undefined}
              >
                <summary className={styles.groupTitle}>
                  {group.title} <span className={styles.count}>{group.count}</span>
                </summary>
                {group.shelves.map((shelf) => (
                  <section key={shelf.title} className={styles.shelf} aria-label={shelf.title}>
                    <h2 className={styles.shelfTitle}>{shelf.title}</h2>
                    <ul className={styles.items}>
                      {shelf.items.map((item) => (
                        <li key={item.id}>
                          <button type="button" className={styles.item} onClick={() => open(item)}>
                            <span className={styles.itemText}>
                              <span className={styles.itemName}>{item.name}</span>
                              <span className={styles.itemFacts}>{facts(item)}</span>
                            </span>
                            <Badge>{item.source}</Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </details>
            ))}
          </>
        )}
      </div>
    </>
  );
}
