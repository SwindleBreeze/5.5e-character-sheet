// The Bastion card (plan step 7.7): a short explanation, the facilities with their orders and
// the player's notes, and hirelings and defenders as plain numbers. The rules are each
// facility's own imported text; the sheet works out nothing.

import { newId } from '../../../engine/build/newCharacter.ts';
import {
  addFacility,
  bastionOf,
  removeFacility,
  setBastionCount,
  setFacilityNote,
  setFacilityOrder,
} from '../../../engine/play/bastion.ts';
import { useEntity } from '../../../content/hooks.ts';
import type { BastionFacility, Character } from '../../../schema/index.ts';
import { EntitySheet } from '../../../richtext/EntitySheet.tsx';
import { entityMeta } from '../../../richtext/entityMeta.ts';
import { Button } from '../../../ui/Button.tsx';
import { Counter } from '../../../ui/Counter.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import inventory from '../inventory/inventory.module.css';
import type { CharacterUpdate } from '../useCharacterActions.ts';
import styles from './description.module.css';
import { FacilitySheet } from './FacilitySheet.tsx';
import { characterSources } from '../../../sources/sourceFilter.ts';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function FacilityRow({
  row,
  apply,
}: {
  row: BastionFacility;
  apply: (update: CharacterUpdate) => void;
}) {
  const ui = useSheet();
  const facility = useEntity<'facility'>({ kind: 'facility', id: row.ref.id });
  const orders = [...(facility?.orders ?? [])];
  if (row.order && !orders.includes(row.order)) orders.push(row.order);
  const subtitle =
    facility === null ? 'Not in your library' : facility && entityMeta(facility).subtitle;

  const read = () =>
    ui.open({
      key: `facility:${row.ref.id}`,
      title: row.name,
      render: () => <EntitySheet entityRef={row.ref} />,
    });

  return (
    <li className={styles.facility}>
      <div className={styles.facilityHead}>
        <button type="button" className={inventory.result} onClick={read}>
          <span className={inventory.resultName}>{row.name}</span>
          {subtitle && <span className={inventory.muted}>{subtitle}</span>}
        </button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Remove ${row.name}`}
          onClick={() => apply((c) => removeFacility(c, row.uid))}
        >
          Remove
        </Button>
      </div>
      {orders.length > 0 && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Order</span>
          <select
            value={row.order ?? ''}
            onChange={(e) => apply((c) => setFacilityOrder(c, row.uid, e.target.value))}
          >
            <option value="">No order</option>
            {orders.map((o) => (
              <option key={o} value={o}>
                {cap(o)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={styles.text}>
        <span className={inventory.fieldLabel}>Note</span>
        <textarea
          rows={2}
          value={row.note ?? ''}
          placeholder="What it is working on, what came of it"
          onChange={(e) => apply((c) => setFacilityNote(c, row.uid, e.target.value))}
        />
      </label>
    </li>
  );
}

export function BastionCard({
  character,
  apply,
}: {
  character: Character;
  apply: (update: CharacterUpdate) => void;
}) {
  const ui = useSheet();
  const bastion = bastionOf(character);
  const have = new Map<string, number>();
  for (const f of bastion.facilities) have.set(f.ref.id, (have.get(f.ref.id) ?? 0) + 1);

  const add = () =>
    ui.open({
      key: 'description:facility',
      title: 'Add a facility',
      render: () => (
        <FacilitySheet
          have={have}
          sources={characterSources(character)}
          onAdd={(f) => {
            ui.close();
            apply((c) =>
              addFacility(c, { uid: newId(), ref: { kind: 'facility', id: f.id }, name: f.name }),
            );
          }}
        />
      ),
    });

  return (
    <div className={inventory.card}>
      <p className={inventory.help}>
        A Bastion is a home your character owns and runs, if your DM uses Bastions. It is made of
        facilities: basic ones are ordinary rooms, special ones can be given an order, such as to
        craft or trade. On each Bastion turn you choose the orders and your DM tells you what came
        of them. Hirelings work the facilities; defenders guard the place. The sheet only keeps your
        notes; open a facility to read its rules.
      </p>
      {bastion.facilities.length ? (
        <ul className={styles.facilities} aria-label="Facilities">
          {bastion.facilities.map((row) => (
            <FacilityRow key={row.uid} row={row} apply={apply} />
          ))}
        </ul>
      ) : (
        <p className={inventory.muted}>No facilities yet.</p>
      )}
      <div className={inventory.actions}>
        <Button onClick={add}>Add a facility</Button>
      </div>
      <div className={styles.counts}>
        {(['hirelings', 'defenders'] as const).map((key) => (
          <div key={key} className={inventory.field}>
            <span className={inventory.fieldLabel}>{cap(key)}</span>
            <Counter
              label={cap(key)}
              value={bastion[key]}
              onChange={(n) => apply((c) => setBastionCount(c, key, n))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
