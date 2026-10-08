// Starting equipment, chosen where it comes from (plan §9.3 step 4.4, §9.3b step 4B.5): inside
// the class's and the background's card. An option of gear, or gold to buy your own; an "any …"
// entry (any musical instrument, any simple weapon) or an item group (a Druidic Focus: which
// one) gets an item picker. Armor, a Shield and a
// weapon are put on for the character (`syncStartingEquipment`).

import { useId } from 'react';
import {
  anyItemKey,
  equipmentOptionText,
  grantPool,
  pickedEquipment,
  startingEquipmentOwners,
} from '../../../engine/build/equipment.ts';
import { setPick } from '../../../engine/play/features.ts';
import type { Character, Id, Ref } from '../../../schema/index.ts';
import choices from '../../choices/choices.module.css';
import inventory from '../../sheet/inventory/inventory.module.css';
import type { WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

function setAnyItem(c: Character, key: string, id: Id): Character {
  return {
    ...c,
    draft: { step: 'class', ...c.draft, anyItems: { ...c.draft?.anyItems, [key]: id } },
  };
}

export function EquipmentChoice({ b, owner: ownerRef }: { b: WizardBindings; owner: Ref }) {
  const { character, content, sheet, apply } = b;
  const baseId = useId();
  const owner = startingEquipmentOwners(character, content.index).find(
    (o) => o.ref.kind === ownerRef.kind && o.ref.id === ownerRef.id,
  );
  if (!owner) return null;
  const picked = pickedEquipment(character, owner.ref, owner.options);
  const tools = new Set(sheet?.proficiencies.tools.map((t) => t.value) ?? []);
  const name = `${baseId}-equipment`;

  const choose = (key: string, text: string) =>
    apply((c) =>
      setPick(
        c,
        { owner: owner.ref, slot: 'equipment' },
        { values: [key], labels: [text], entryIndex: 0, via: 'creation' },
      ),
    );

  return (
    <section className={choices.choice} aria-label="Starting equipment">
      <h3 className={choices.choiceTitle}>Starting equipment</h3>
      <p className={choices.help}>
        Take the gear, or the gold to buy your own. New players: take the gear. Armor, a Shield and
        a weapon are put on for you.
      </p>
      <span className={choices.count} data-done={!!picked}>
        {picked ? 'Chosen' : 'Choose one'}
      </span>
      <ul className={choices.options} aria-label={`${owner.name} equipment options`}>
        {owner.options.map((o) => {
          const text = equipmentOptionText(o, content.index);
          return (
            <li key={o.key} className={choices.option}>
              <label className={choices.check}>
                <input
                  type="radio"
                  name={name}
                  checked={picked?.key === o.key}
                  aria-labelledby={`${name}-${o.key}`}
                  aria-describedby={`${name}-${o.key}-text`}
                  onChange={() => choose(o.key, text)}
                />
                <span id={`${name}-${o.key}`} className={choices.label}>
                  Option {o.key}
                </span>
              </label>
              <span id={`${name}-${o.key}-text`} className={choices.text}>
                <span className={choices.detail}>{text}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {picked?.items.map((grant, i) => {
        const pool = grantPool(grant, content.catalog, content.index);
        if (!pool) return null;
        const key = anyItemKey(owner.ref, picked.key, i);
        const items = pool.items;
        // Tools the character is proficient with first (a Bard's instruments).
        const sorted = [
          ...items.filter((it) => tools.has(it.id)),
          ...items.filter((it) => !tools.has(it.id)),
        ];
        const label = `Which ${pool.label}?`;
        return (
          <label key={key} className={`${inventory.field} ${styles.anyItem}`}>
            <span className={inventory.fieldLabel}>{label}</span>
            <select
              aria-label={label}
              value={character.draft?.anyItems?.[key] ?? ''}
              onChange={(e) => apply((c) => setAnyItem(c, key, e.target.value))}
            >
              <option value="" disabled>
                Choose…
              </option>
              {sorted.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                  {tools.has(it.id) ? ' (proficient)' : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </section>
  );
}
